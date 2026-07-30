// Телеграм-бот репетитора: второй вход в тот же кабинет.
//
// Бот НЕ хранит своих данных: он читает те же students / homework / lessons, что
// и сайт, и умеет ровно то, что нужно между занятиями с телефона в руке —
// посмотреть расписание, увидеть, кто сдал и кто не сдал ДЗ, зачесть работу,
// проверить долги. Всё остальное остаётся в кабинете.
//
// Три вещи, из-за которых файл выглядит именно так:
//
//  1. Telegram обращается к нам НАПРЯМУЮ, минуя интерфейс с его ограничениями,
//     поэтому и тариф, и владение данными проверяются здесь на каждом сообщении.
//     Доступ к боту входит в «Про» (src/plans.js → features.telegramBot).
//  2. Ответ должен быть быстрым и всегда 200: на ошибку Telegram присылает тот же
//     update снова и снова, и репетитор получит пачку одинаковых сообщений.
//  3. Telegram — внешний сервис за пределами РФ. Поэтому имена учеников по
//     умолчанию сокращаются до «Имя Ф.», а телефонов и адресов бот не пишет
//     вовсе (152-ФЗ, минимизация; та же логика, что с DeepSeek в lesson-report.js).
//
// Адреса:
//   POST /api/telegram                 — webhook Telegram (секрет в заголовке)
//   POST /api/telegram?action=notify   — событие от клиента («ученик сдал ДЗ»)
//   GET  /api/telegram                 — health-check: настроен ли бот
//
// Переменные окружения Vercel: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET и
// TELEGRAM_DB_SECRET — секрет, которым бот опознаётся перед базой. Ключ
// service_role боту НЕ нужен: он ходит через узкий набор функций
// (supabase/telegram_bot_rpc.sql). Создание бота — docs/telegram.md.
//
// Внутренние функции экспортированы намеренно (как rateLimit в generate-hw.js):
// на них гоняется локальная проверка разделов и уведомлений с мок-базой, без
// Telegram и без боевых ключей.

import { createClient } from "@supabase/supabase-js"
import { admin, tutorFromRequest } from "./plan-gate.js"
import { clientIp } from "./generate-hw.js"
import { isLessonConducted, parsePaymentDate, plural } from "../src/utils.js"
import { can } from "../src/plans.js"

const API = "https://api.telegram.org"
const APP_URL = process.env.APP_URL || "https://precettore.ru"

// Расписание, дедлайны и «уже проведён» у репетитора московские, а сервер Vercel
// живёт по UTC. Без пересчёта после 21:00 МСК бот показывал бы вчерашний день.
const TZ = "Europe/Moscow"

const token = () => process.env.TELEGRAM_BOT_TOKEN || ""

// ── Доступ к базе ───────────────────────────────────────────────────────────
//
// Бот ходит в базу НЕ под service_role (тот ключ может в базе всё), а через
// восемь именованных функций из supabase/telegram_bot_rpc.sql, опознаваясь
// собственным секретом. Утечка этого секрета не открывает базу целиком, а
// список того, что боту разрешено делать с данными, виден в одном файле.
//
// Ключ PostgREST здесь публичный (anon) — тот же, что у браузера: сами функции
// без секрета не отдают ничего.
export function botDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const secret = process.env.TELEGRAM_DB_SECRET
  if (!url || !key || !secret) return null

  const client = createClient(url, key, { auth: { persistSession: false } })
  return {
    async call(fn, args = {}) {
      const { data, error } = await client.rpc(fn, { p_secret: secret, ...args })
      if (error) {
        // Молчаливое падение здесь выглядело бы как «бот сломался»: пишем в лог
        // функции, а наверх отдаём null — вызывающий решает, что показать.
        console.error(`telegram rpc ${fn}:`, error.message)
        return null
      }
      return data
    },
  }
}

// Тариф репетитора. Как и в api/plan-gate.js: «биллинг не установлен» — это не
// бесплатный тариф, и резать возможности в этом случае нельзя, иначе забытая
// миграция молча выключила бы бота.
async function planAllows(db, tutorId) {
  const plan = await db.call("bot_plan", { p_tutor: tutorId })
  if (!plan || plan.installed === false) return true
  return can(plan.sub || null, "telegramBot")
}

async function tg(method, payload) {
  const t = token()
  if (!t) return null
  try {
    const r = await fetch(`${API}/bot${t}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    return await r.json().catch(() => null)
  } catch {
    // Telegram недоступен — это не причина отвечать ему ошибкой и получить ретрай.
    return null
  }
}

// ── Даты по Москве ──────────────────────────────────────────────────────────

// "YYYY-MM-DD" текущего московского дня.
export function mskToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date())
}

// Момент «сейчас» московскими компонентами, но в локальной зоне процесса —
// чтобы сравнивать его с уроками, которые isLessonConducted() тоже собирает
// локальным конструктором из "YYYY-MM-DD" + "HH:MM".
export function mskNow() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {})
  return new Date(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
}

const shiftDay = (iso, days) => {
  const [y, m, d] = iso.split("-").map(Number)
  const t = new Date(y, m - 1, d + days)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
}

const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"]
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"]

export function humanDate(iso) {
  const [y, m, d] = iso.split("-").map(Number)
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${d} ${MONTHS[m - 1]}, ${wd}`
}

// Дата без дня недели: для дедлайнов и даты экзамена. Год добавляем, только если
// он не текущий, — «1 июня 2027» полезно, «27 июля 2026» в июле 2026 шумит.
export function shortDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return String(iso || "")
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  const thisYear = Number(mskToday().slice(0, 4))
  return `${d} ${MONTHS[m - 1]}${y === thisYear ? "" : ` ${y}`}`
}

// «3 занятия», а не «3 занятий».
const lessonsWord = (n) => `${n} ${plural(n, "занятие", "занятия", "занятий")}`

// ── Текст ───────────────────────────────────────────────────────────────────

// parse_mode HTML — экранируем всё, что пришло из базы: имя ученика вида
// «Петя <3» иначе развалит разметку сообщения.
const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const money = (n) => `${Math.round(n).toLocaleString("ru-RU")} ₽`

// «Иван Петров» → «Иван П.». Полное имя — только если репетитор сам включил:
// в Telegram уходит ровно столько, сколько нужно, чтобы узнать ученика.
export function studentName(name, full) {
  const clean = String(name || "").trim()
  // Заглушку сокращать нельзя: «Без имени» превращалось в «Без И.».
  if (!clean) return "Без имени"
  if (full) return clean
  const parts = clean.split(/\s+/)
  if (parts.length < 2) return clean
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`
}

// Сообщения Telegram обрезаются на 4096 символах, и обрезаются молча. Длинные
// списки режем сами и ЧЕСТНО пишем, сколько осталось за кадром.
export function joinLimited(lines, max, tailWord = "строк") {
  if (lines.length <= max) return lines.join("\n")
  const rest = lines.length - max
  return [...lines.slice(0, max), `<i>…и ещё ${rest} ${tailWord}</i>`].join("\n")
}

// ── Клавиатуры ──────────────────────────────────────────────────────────────

const MENU = {
  inline_keyboard: [
    [{ text: "📅 Сегодня", callback_data: "today" }, { text: "🗓 Неделя", callback_data: "week" }],
    [{ text: "📝 Домашки", callback_data: "hw" }, { text: "👥 Ученики", callback_data: "st" }],
    [{ text: "💰 Деньги", callback_data: "money" }, { text: "⚙️ Настройки", callback_data: "set" }],
  ],
}

const backTo = (target = "menu", extra = []) => ({
  inline_keyboard: [...extra, [{ text: "‹ Меню", callback_data: target }]],
})

// ── Данные репетитора ───────────────────────────────────────────────────────

// Один поход в базу на весь ответ: у бота обычно спрашивают сводку, а не одну
// строку, и два-три раздельных запроса на каждое нажатие кнопки — это лишние
// сотни миллисекунд в чате.
async function loadStudents(db, tutorId) {
  return (await db.call("bot_students", { p_tutor: tutorId })) || []
}

async function loadHomework(db, tutorId) {
  return (await db.call("bot_homework", { p_tutor: tutorId })) || []
}

// Все уроки всех учеников в плоский список за интервал дат.
export function lessonsBetween(students, fromIso, toIso) {
  const out = []
  for (const s of students) {
    for (const l of s.lessons || []) {
      if (!l?.date || l.date < fromIso || l.date > toIso) continue
      out.push({ ...l, student: s })
    }
  }
  return out.sort((a, b) =>
    a.date.localeCompare(b.date) || String(a.time || "").localeCompare(String(b.time || "")))
}

function nextLesson(students, fromIso) {
  const all = lessonsBetween(students, fromIso, shiftDay(fromIso, 60))
  const now = mskNow()
  return all.find((l) => !isLessonConducted(l, now)) || null
}

// Долг ученика считается так же, как на странице «Финансы»: проведённые уроки
// по цене занятия минус все внесённые платежи.
export function debtOf(student) {
  const now = mskNow()
  const conducted = (student.lessons || []).filter((l) => isLessonConducted(l, now)).length
  const owed = conducted * (student.lesson_price || 0)
  const paid = (student.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
  return owed - paid
}

const HW_ACTIVE = new Set(["assigned", "revision"])

// ── Разделы ─────────────────────────────────────────────────────────────────

export async function viewToday(db, link) {
  const students = await loadStudents(db, link.tutor_id)
  const today = mskToday()
  const items = lessonsBetween(students, today, today)
  const now = mskNow()

  if (!items.length) {
    const next = nextLesson(students, today)
    return {
      text: [
        `<b>${humanDate(today)}</b>`,
        "",
        "Занятий нет.",
        next
          ? `Ближайшее — ${humanDate(next.date)} в ${esc(next.time || "—")}: ${esc(studentName(next.student.name, link.full_names))}`
          : "Дальше в расписании тоже пусто.",
      ].join("\n"),
      keyboard: backTo(),
    }
  }

  const sum = items.reduce((s, l) => s + (l.student.lesson_price || 0), 0)
  const lines = items.map((l) => {
    const done = isLessonConducted(l, now)
    return `${done ? "✅" : "🕐"} <b>${esc(l.time || "—")}</b> · ${esc(studentName(l.student.name, link.full_names))}` +
      ` · ${l.duration || 60} мин`
  })

  return {
    text: [
      `<b>${humanDate(today)}</b>`,
      `${lessonsWord(items.length)} · ${money(sum)}`,
      "",
      joinLimited(lines, 20, "занятий"),
    ].join("\n"),
    keyboard: backTo(),
  }
}

export async function viewWeek(db, link) {
  const students = await loadStudents(db, link.tutor_id)
  const from = mskToday()
  const to = shiftDay(from, 6)
  const items = lessonsBetween(students, from, to)

  if (!items.length) {
    return { text: "<b>Неделя впереди</b>\n\nЗанятий не запланировано.", keyboard: backTo() }
  }

  const byDay = new Map()
  for (const l of items) {
    if (!byDay.has(l.date)) byDay.set(l.date, [])
    byDay.get(l.date).push(l)
  }

  const blocks = [...byDay.entries()].map(([date, day]) => {
    const rows = day.map((l) =>
      `  ${esc(l.time || "—")} · ${esc(studentName(l.student.name, link.full_names))}`)
    return [`<b>${humanDate(date)}</b>`, ...rows].join("\n")
  })

  const sum = items.reduce((s, l) => s + (l.student.lesson_price || 0), 0)
  return {
    text: [
      `<b>Ближайшие 7 дней</b>`,
      `${lessonsWord(items.length)} · ${money(sum)}`,
      "",
      joinLimited(blocks, 7, "дней"),
    ].join("\n"),
    keyboard: backTo(),
  }
}

export async function viewHomework(db, link) {
  const [students, homework] = await Promise.all([
    loadStudents(db, link.tutor_id),
    loadHomework(db, link.tutor_id),
  ])
  const nameById = new Map(students.map((s) => [String(s.id), s.name]))
  const who = (id) => esc(studentName(nameById.get(String(id)), link.full_names))
  const today = mskToday()

  const toCheck = homework.filter((h) => h.status === "submitted")
  const overdue = homework.filter((h) => HW_ACTIVE.has(h.status) && h.deadline && h.deadline < today)
  const active = homework.filter((h) => HW_ACTIVE.has(h.status) && (!h.deadline || h.deadline >= today))

  const parts = [`<b>Домашние задания</b>`,
    `На проверке ${toCheck.length} · просрочено ${overdue.length} · в работе ${active.length}`]

  if (toCheck.length) {
    parts.push("", "<b>Ждут проверки</b>")
    parts.push(joinLimited(toCheck.map((h) =>
      `📩 ${who(h.student_id)} · ${esc(h.title)}` +
      (h.submission_url ? ` · <a href="${esc(h.submission_url)}">работа</a>` : "")), 10, "работ"))
  }
  if (overdue.length) {
    parts.push("", "<b>Просрочено</b>")
    parts.push(joinLimited(overdue.map((h) =>
      `⚠️ ${who(h.student_id)} · ${esc(h.title)} · до ${esc(shortDate(h.deadline))}`), 10, "заданий"))
  }
  if (!toCheck.length && !overdue.length) {
    parts.push("", active.length ? "Всё сдано в срок — проверять пока нечего." : "Активных заданий нет.")
  }

  // Кнопка «Зачесть» — на каждую сданную работу. Больше пяти в один экран не
  // ставим: клавиатура из двадцати кнопок в телефоне бесполезна.
  const rows = toCheck.slice(0, 5).map((h) => ([
    { text: `✅ Зачесть · ${studentName(nameById.get(String(h.student_id)), link.full_names)}`, callback_data: `hwok:${h.id}` },
    { text: "↩️ На доработку", callback_data: `hwrev:${h.id}` },
  ]))

  return { text: parts.join("\n"), keyboard: backTo("menu", rows) }
}

export async function viewStudents(db, link) {
  const students = await loadStudents(db, link.tutor_id)
  if (!students.length) {
    return { text: "<b>Ученики</b>\n\nПока никого нет — добавьте ученика в кабинете.", keyboard: backTo() }
  }
  const homework = await loadHomework(db, link.tutor_id)
  const hwActive = new Map()
  for (const h of homework) {
    if (!HW_ACTIVE.has(h.status) && h.status !== "submitted") continue
    const k = String(h.student_id)
    hwActive.set(k, (hwActive.get(k) || 0) + 1)
  }

  const now = mskNow()
  const lines = students.map((s) => {
    const conducted = (s.lessons || []).filter((l) => isLessonConducted(l, now)).length
    const debt = debtOf(s)
    const hw = hwActive.get(String(s.id)) || 0
    const tail = [
      `${conducted} зан.`,
      hw ? `${hw} ДЗ` : null,
      debt > 0 ? `долг ${money(debt)}` : null,
    ].filter(Boolean).join(" · ")
    return `• <b>${esc(studentName(s.name, link.full_names))}</b> — ${tail}`
  })

  // Кнопки-карточки: первые восемь учеников, дальше подробности в кабинете.
  const rows = []
  students.slice(0, 8).forEach((s, i) => {
    const btn = { text: studentName(s.name, link.full_names), callback_data: `stu:${s.id}` }
    if (i % 2 === 0) rows.push([btn])
    else rows[rows.length - 1].push(btn)
  })

  return {
    text: [`<b>Ученики</b> · ${students.length}`, "", joinLimited(lines, 25, "учеников")].join("\n"),
    keyboard: backTo("menu", rows),
  }
}

export async function viewStudent(db, link, studentId) {
  const [students, homework] = await Promise.all([
    loadStudents(db, link.tutor_id),
    loadHomework(db, link.tutor_id),
  ])
  const s = students.find((x) => String(x.id) === String(studentId))
  // Ученик чужого репетитора сюда не попадёт: выборка идёт по tutor_id владельца
  // чата, а не по присланному id.
  if (!s) return { text: "Ученик не найден.", keyboard: backTo("st") }

  const now = mskNow()
  const lessons = s.lessons || []
  const conducted = lessons.filter((l) => isLessonConducted(l, now))
  const upcoming = lessons
    .filter((l) => !isLessonConducted(l, now) && l.date >= mskToday())
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || "").localeCompare(String(b.time || "")))
  const mine = homework.filter((h) => String(h.student_id) === String(s.id))
  const toCheck = mine.filter((h) => h.status === "submitted").length
  const activeHw = mine.filter((h) => HW_ACTIVE.has(h.status)).length
  const debt = debtOf(s)

  const lines = [
    `<b>${esc(studentName(s.name, link.full_names))}</b>`,
    s.goal ? `Цель: ${esc(s.goal)}` : null,
    s.exam_date ? `Экзамен: ${esc(shortDate(s.exam_date))}` : null,
    s.target_score ? `Цель по баллам: ${esc(s.target_score)}` : null,
    "",
    `Проведено занятий: ${conducted.length}`,
    upcoming.length
      ? `Ближайшее: ${humanDate(upcoming[0].date)} в ${esc(upcoming[0].time || "—")}`
      : "Ближайшее занятие не назначено",
    s.lesson_price ? `Цена занятия: ${money(s.lesson_price)}` : null,
    debt > 0 ? `Долг: <b>${money(debt)}</b>` : debt < 0 ? `Предоплата: ${money(-debt)}` : "Оплачено полностью",
    "",
    `ДЗ: ${activeHw} в работе, ${toCheck} на проверке`,
  ].filter((x) => x !== null)

  return { text: lines.join("\n"), keyboard: backTo("st") }
}

export async function viewMoney(db, link) {
  const students = await loadStudents(db, link.tutor_id)
  const now = mskNow()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  let monthIncome = 0
  for (const s of students) {
    for (const p of s.payments || []) {
      const d = parsePaymentDate(p.date)
      if (d && d >= monthStart && d <= now) monthIncome += p.amount || 0
    }
  }

  const debtors = students
    .map((s) => ({ name: s.name, debt: debtOf(s) }))
    .filter((x) => x.debt > 0)
    .sort((a, b) => b.debt - a.debt)
  const debtTotal = debtors.reduce((sum, d) => sum + d.debt, 0)

  // Ожидаемый доход: занятия, которые ещё будут проведены до конца месяца.
  const monthEndIso = (() => {
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`
  })()
  const ahead = lessonsBetween(students, mskToday(), monthEndIso)
    .filter((l) => !isLessonConducted(l, now))
    .reduce((sum, l) => sum + (l.student.lesson_price || 0), 0)

  const parts = [
    "<b>Деньги</b>",
    `Получено в этом месяце: <b>${money(monthIncome)}</b>`,
    `Ещё запланировано до конца месяца: ${money(ahead)}`,
  ]
  if (debtors.length) {
    parts.push("", `<b>Долги</b> · ${money(debtTotal)}`)
    parts.push(joinLimited(debtors.map((d) =>
      `• ${esc(studentName(d.name, link.full_names))} — ${money(d.debt)}`), 12, "учеников"))
  } else {
    parts.push("", "Долгов нет.")
  }
  parts.push("", `<i>Расходы и налог — в кабинете: ${APP_URL}</i>`)

  return { text: parts.join("\n"), keyboard: backTo() }
}

export function viewSettings(link) {
  return {
    text: [
      "<b>Настройки</b>",
      "",
      `Полные имена учеников: <b>${link.full_names ? "показывать" : "сокращать"}</b>`,
      link.full_names
        ? "<i>Фамилии уходят в Telegram полностью.</i>"
        : "<i>Бот пишет «Имя Ф.» — в Telegram уходит меньше персональных данных.</i>",
      "",
      `Уведомления: <b>${link.notify ? "включены" : "выключены"}</b>`,
      "<i>Сданные ДЗ, работы по вариантам и сообщения учеников.</i>",
    ].join("\n"),
    keyboard: {
      inline_keyboard: [
        [{ text: link.full_names ? "Сокращать имена" : "Показывать полные имена", callback_data: "setname" }],
        [{ text: link.notify ? "🔕 Выключить уведомления" : "🔔 Включить уведомления", callback_data: "setnotify" }],
        [{ text: "🚫 Отвязать этот чат", callback_data: "unlink" }],
        [{ text: "‹ Меню", callback_data: "menu" }],
      ],
    },
  }
}

const HELP = [
  "<b>Что умеет бот</b>",
  "",
  "📅 <b>Сегодня</b> и 🗓 <b>Неделя</b> — расписание занятий.",
  "📝 <b>Домашки</b> — кто сдал, кто просрочил; работу можно зачесть или вернуть на доработку.",
  "👥 <b>Ученики</b> — карточка: занятия, ближайший урок, долг, ДЗ.",
  "💰 <b>Деньги</b> — получено за месяц, план и долги.",
  "",
  "Команды: /menu, /today, /week, /hw, /students, /money, /help",
  "",
  `Полный кабинет — ${APP_URL}`,
].join("\n")

// ── Диспетчер ───────────────────────────────────────────────────────────────

const MENU_TEXT = "<b>Кабинет репетитора</b>\n\nВыберите раздел.";

// Действия над ДЗ. tutor_id в условии обязателен: id задания приходит из
// callback_data, то есть снаружи, и без этой проверки чужую работу можно было бы
// зачесть, подставив её id.
async function setHomeworkStatus(db, tutorId, hwId, status) {
  return db.call("bot_hw_status", { p_tutor: tutorId, p_hw: hwId, p_status: status })
}

export async function route(db, link, action) {
  if (action === "today") return viewToday(db, link)
  if (action === "week") return viewWeek(db, link)
  if (action === "hw") return viewHomework(db, link)
  if (action === "st") return viewStudents(db, link)
  if (action === "money") return viewMoney(db, link)
  if (action === "set") return viewSettings(link)
  if (action === "help") return { text: HELP, keyboard: backTo() }
  if (action.startsWith("stu:")) return viewStudent(db, link, action.slice(4))
  return { text: MENU_TEXT, keyboard: MENU }
}

const COMMANDS = {
  "/menu": "menu", "/start": "menu",
  "/today": "today", "/week": "week",
  "/hw": "hw", "/students": "st", "/money": "money",
  "/help": "help", "/settings": "set",
}

// ── Обработка update ────────────────────────────────────────────────────────

export async function handleUpdate(db, update) {
  const msg = update.message || update.edited_message
  const cb = update.callback_query
  const chat = msg?.chat?.id ?? cb?.message?.chat?.id
  if (!chat) return

  // Бот личный: в группе он выдавал бы данные учеников всем участникам.
  const chatType = msg?.chat?.type || cb?.message?.chat?.type
  if (chatType && chatType !== "private") {
    await tg("sendMessage", { chat_id: chat, text: "Бот работает только в личном чате." })
    return
  }

  const link = await db.call("bot_link", { p_chat: chat })

  // ── Ещё не привязан: единственное, что можно — прислать код ──
  if (!link) {
    const text = String(msg?.text || "").trim()
    const code = text.startsWith("/start") ? text.slice(6).trim() : text
    if (cb) await tg("answerCallbackQuery", { callback_query_id: cb.id })

    if (!code) {
      await tg("sendMessage", {
        chat_id: chat,
        parse_mode: "HTML",
        text: [
          "<b>Precettore</b> — бот репетитора.",
          "",
          "Чтобы связать бота с вашим кабинетом:",
          `1. откройте ${APP_URL} → «Подписка»;`,
          "2. в блоке «Телеграм-бот» нажмите «Подключить»;",
          "3. пришлите сюда код привязки.",
          "",
          "<i>Бот входит в тариф «Про».</i>",
        ].join("\n"),
      })
      return
    }

    const tutorId = await db.call("bot_link_claim", {
      p_code: code,
      p_chat: chat,
      p_username: msg?.from?.username || null,
      p_first_name: msg?.from?.first_name || null,
    })

    if (!tutorId) {
      await tg("sendMessage", {
        chat_id: chat,
        text: "Код не подошёл: он одноразовый и живёт 15 минут. Возьмите новый в кабинете.",
      })
      return
    }

    if (!(await planAllows(db, tutorId))) {
      await tg("sendMessage", {
        chat_id: chat,
        parse_mode: "HTML",
        text: `Чат привязан, но бот входит в тариф «Про».\nПодключить — ${APP_URL}`,
      })
      return
    }

    await tg("sendMessage", {
      chat_id: chat,
      parse_mode: "HTML",
      text: `✅ Чат привязан к вашему кабинету.\n\n${HELP}`,
      reply_markup: MENU,
    })
    return
  }

  // ── Привязан: тариф проверяем на каждом действии ──
  if (!(await planAllows(db, link.tutor_id))) {
    if (cb) await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Нужен тариф «Про»" })
    await tg("sendMessage", {
      chat_id: chat,
      parse_mode: "HTML",
      text: `Бот входит в тариф «Про». Данные никуда не пропали — они в кабинете: ${APP_URL}`,
    })
    return
  }

  db.call("bot_link", { p_chat: chat, p_touch: true }).catch(() => {})

  // ── Нажатие кнопки ──
  if (cb) {
    const data = String(cb.data || "")
    const answer = (text) => tg("answerCallbackQuery", { callback_query_id: cb.id, ...(text ? { text } : {}) })

    if (data === "setname" || data === "setnotify") {
      const patch = data === "setname"
        ? { p_full_names: !link.full_names }
        : { p_notify: !link.notify }
      const fresh = (await db.call("bot_link", { p_chat: chat, ...patch })) || link
      const view = viewSettings(fresh)
      await answer("Готово")
      await tg("editMessageText", {
        chat_id: chat, message_id: cb.message.message_id,
        parse_mode: "HTML", text: view.text, reply_markup: view.keyboard,
      })
      return
    }

    if (data === "unlink") {
      await db.call("bot_link", { p_chat: chat, p_unlink: true })
      await answer("Чат отвязан")
      await tg("sendMessage", {
        chat_id: chat,
        text: "Чат отвязан. Чтобы вернуть бота, возьмите новый код в кабинете.",
      })
      return
    }

    if (data.startsWith("hwok:") || data.startsWith("hwrev:")) {
      const done = data.startsWith("hwok:")
      const id = data.slice(data.indexOf(":") + 1)
      const row = await setHomeworkStatus(db, link.tutor_id, id, done ? "done" : "revision")
      await answer(row ? (done ? "Зачтено" : "Отправлено на доработку") : "Не получилось")
      const view = await viewHomework(db, link)
      await tg("editMessageText", {
        chat_id: chat, message_id: cb.message.message_id,
        parse_mode: "HTML", text: view.text, reply_markup: view.keyboard,
        link_preview_options: { is_disabled: true },
      })
      return
    }

    const view = await route(db, link, data)
    await answer()
    await tg("editMessageText", {
      chat_id: chat, message_id: cb.message.message_id,
      parse_mode: "HTML", text: view.text, reply_markup: view.keyboard,
      link_preview_options: { is_disabled: true },
    })
    return
  }

  // ── Текст и команды ──
  const text = String(msg?.text || "").trim()
  const cmd = text.split(/[\s@]/)[0].toLowerCase()
  const action = COMMANDS[cmd] || (text ? "menu" : "menu")
  const view = await route(db, link, action)
  await tg("sendMessage", {
    chat_id: chat,
    parse_mode: "HTML",
    text: view.text,
    reply_markup: view.keyboard,
    link_preview_options: { is_disabled: true },
  })
}

// ── Уведомления от клиента ──────────────────────────────────────────────────
//
// Сдача ДЗ, работа по варианту и сообщение в чате уходят в базу напрямую из
// браузера ученика (так работает RLS), поэтому серверу неоткуда узнать о них
// самому. Клиент сообщает только ТИП и ID события — что произошло, сервер
// проверяет в базе сам и пишет репетитору. Ответ всегда 204: по нему нельзя
// понять, существует ли задание и подключён ли у репетитора бот.

const NOTIFY_WINDOW_MS = 60_000
const NOTIFY_MAX = 40
const notifyHits = new Map()

function notifyLimited(ip, now = Date.now()) {
  const fresh = (notifyHits.get(ip) || []).filter((t) => now - t < NOTIFY_WINDOW_MS)
  notifyHits.set(ip, fresh)
  if (fresh.length >= NOTIFY_MAX) return true
  fresh.push(now)
  if (notifyHits.size > 500) {
    for (const [k, v] of notifyHits) if (!v.some((t) => now - t < NOTIFY_WINDOW_MS)) notifyHits.delete(k)
  }
  return false
}

// Что произошло, кому это принадлежит и стоит ли вообще писать — выясняет база
// (bot_notice): клиент присылает только вид события и его id, поэтому подделать
// уведомление этим вызовом нельзя. Сюда возвращаются голые факты, а текст и
// сокращение имени — уже здесь.
const NOTICE_LOOK = {
  hw_submitted: { icon: "📩", what: "сдал домашнее задание" },
  hw_test:      { icon: "🧮", what: "прошёл тест" },
  variant_submitted: { icon: "🧾", what: "сдал вариант" },
  chat:         { icon: "💬", what: "написал в чат" },
}

export async function handleNotify(db, body) {
  const kind = String(body?.kind || "")
  const id = body?.id
  if (!id) return

  const notice = await db.call("bot_notice", { p_kind: kind, p_id: String(id) })
  if (!notice?.chat_id) return

  if (!(await planAllows(db, notice.tutor))) return

  // Захват события: если его уже отправляли, второй раз не пишем.
  const claimed = await db.call("bot_event_claim", { p_key: notice.key, p_tutor: notice.tutor })
  if (claimed !== true) return

  const look = NOTICE_LOOK[notice.test ? "hw_test" : kind] || NOTICE_LOOK.chat
  const name = studentName(notice.name, notice.full_names)
  const lines = [`${look.icon} <b>${esc(name)}</b> ${look.what}`]
  if (notice.title) lines.push(esc(notice.title))
  if (notice.url) lines.push(`<a href="${esc(notice.url)}">Посмотреть работу</a>`)

  await tg("sendMessage", {
    chat_id: notice.chat_id,
    parse_mode: "HTML",
    text: lines.join("\n"),
    reply_markup: { inline_keyboard: [[{ text: "📝 Домашки", callback_data: "hw" }]] },
    link_preview_options: { is_disabled: true },
  })
}


// ── Точка входа ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const db = botDb()

  // GET — health-check: настроен ли бот и как он называется. Им пользуется
  // страница «Подписка», чтобы дать правильную ссылку t.me и не обещать
  // работающего бота там, где не хватает ключей.
  if (req.method === "GET") {
    if (!token()) {
      res.status(200).json({ ok: false, error: "TELEGRAM_BOT_TOKEN не задан на сервере" })
      return
    }
    if (!db) {
      res.status(200).json({ ok: false, error: "TELEGRAM_DB_SECRET не задан — боту нечего читать" })
      return
    }
    const me = await tg("getMe", {})
    if (!me?.ok) {
      res.status(200).json({ ok: false, error: "Telegram не принял токен бота" })
      return
    }
    // Проба секрета базы: без неё расхождение между TELEGRAM_DB_SECRET и тем,
    // что записано в bot_config, выглядит как «бот не отвечает на код привязки» —
    // самая незаметная из возможных поломок.
    const probe = await db.call("bot_plan", { p_tutor: "00000000-0000-0000-0000-000000000000" })
    if (!probe) {
      res.status(200).json({ ok: false, error: "TELEGRAM_DB_SECRET не совпадает с базой (bot_secret_set)" })
      return
    }
    // Заодно состояние вебхука: без него бот молчит на любые сообщения, и это
    // единственная поломка, которую по самому боту не отличить от «не привязан».
    let hook = await tg("getWebhookInfo", {})

    // Самонастройка: адрес вебхука — не выбор и не настройка, а единственное
    // правильное значение, поэтому лишний ручной шаг здесь не нужен. Как только
    // на сервере появляются токен и секрет, первый же health-check прописывает
    // вебхук сам.
    //
    // Строго на БОЕВОМ домене: превью-деплой Vercel получает тот же токен, и без
    // этой проверки случайно открытый предпросмотр перевёл бы живого бота на себя.
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    const isProdHost = host === new URL(APP_URL).host
    if (!hook?.result?.url && process.env.TELEGRAM_WEBHOOK_SECRET && isProdHost) {
      const set = await tg("setWebhook", {
        url: `https://${host}/api/telegram`,
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ["message", "callback_query"],
      })
      if (set?.ok) hook = await tg("getWebhookInfo", {})
    }

    res.status(200).json({
      ok: true,
      bot: me.result?.username || null,
      webhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
      webhook: hook?.result?.url || "",
      webhookError: hook?.result?.last_error_message || "",
    })
    return
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  if (!db) {
    res.status(503).json({ error: "TELEGRAM_DB_SECRET не задан" })
    return
  }

  // Уведомление от клиента платформы.
  if (req.query?.action === "notify") {
    if (notifyLimited(clientIp(req))) {
      res.status(429).end()
      return
    }
    try {
      await handleNotify(db, req.body || {})
    } catch (e) {
      console.error("telegram notify failed:", e)
    }
    // Всегда 204: ответ не должен подсказывать, что за id существует.
    res.status(204).end()
    return
  }

  // Прописать вебхук из кабинета. Иначе это делается руками через curl с
  // токеном бота в командной строке — лишний повод носить секрет по буферам
  // обмена. Токен берётся из переменных окружения и наружу не выходит.
  // Право на действие — вход репетитора с подходящим тарифом.
  if (req.query?.action === "setup") {
    if (!token()) {
      res.status(503).json({ error: "TELEGRAM_BOT_TOKEN не задан на сервере" })
      return
    }
    if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
      res.status(503).json({ error: "TELEGRAM_WEBHOOK_SECRET не задан на сервере" })
      return
    }
    // Здесь нужен разбор токена репетитора, а он умеет только supabase-клиент
    // под service_role. Ключа может не быть — тогда ручная настройка недоступна,
    // но она и не нужна: вебхук ставится сам при health-check (см. GET выше).
    const auth = admin()
    if (!auth) {
      res.status(503).json({ error: "Ручная настройка недоступна — вебхук ставится сам при заходе в кабинет" })
      return
    }
    const tutor = await tutorFromRequest(auth, req)
    if (!tutor) {
      res.status(401).json({ error: "Нужна авторизация репетитора" })
      return
    }
    if (!(await planAllows(db, tutor.id))) {
      res.status(403).json({ error: "Бот входит в тариф «Про»" })
      return
    }
    // Адрес берём из запроса, а не из настроек: кабинет открыт на том же домене,
    // на который Telegram и должен стучаться (боевой, а не превью-деплой).
    const host = req.headers["x-forwarded-host"] || req.headers.host
    if (!host) {
      res.status(400).json({ error: "Не удалось определить адрес сервера" })
      return
    }
    const result = await tg("setWebhook", {
      url: `https://${host}/api/telegram`,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    })
    if (!result?.ok) {
      res.status(502).json({ error: "Telegram не принял вебхук", detail: result?.description || "" })
      return
    }
    const hook = await tg("getWebhookInfo", {})
    res.status(200).json({ ok: true, webhook: hook?.result?.url || "" })
    return
  }

  // Вебхук Telegram. Секрет обязателен: без него адрес открыт любому, кто его
  // угадал, и «нажать кнопку за репетитора» стало бы делом одного curl.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) {
    res.status(503).json({ error: "TELEGRAM_WEBHOOK_SECRET не задан" })
    return
  }
  if (req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  try {
    await handleUpdate(db, req.body || {})
  } catch (e) {
    // Ошибку логируем, но Telegram отвечаем 200: иначе он повторит этот же
    // update десятки раз, и репетитор получит пачку одинаковых сообщений.
    console.error("telegram update failed:", e)
  }
  res.status(200).json({ ok: true })
}
