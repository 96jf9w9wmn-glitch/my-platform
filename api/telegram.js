// Телеграм-бот платформы: второй вход в тот же кабинет — и репетитору, и ученику.
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
// Переменные окружения (/opt/precettore-web/api.env на сервере):
// TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET и
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
import { isLessonPast, isLessonConducted, LESSON_EXCUSED, parsePaymentDate, plural } from "../src/utils.js"
import { studentDebt, studentBilling } from "../src/billing.js"
import { convertLessons } from "../src/timezone.js"
import { can } from "../src/plans.js"

const API = "https://api.telegram.org"
const APP_URL = process.env.APP_URL || "https://precettore.ru"

// Расписание, дедлайны и «уже проведён» у репетитора московские, а сервер
// живёт по UTC. Без пересчёта после 21:00 МСК бот показывал бы вчерашний день.
const TZ = "Europe/Moscow"

const token = () => process.env.TELEGRAM_BOT_TOKEN || ""

// Вебхук перерегистрирован в ЭТОМ запуске процесса. Ровно один раз.
let webhookEnsured = false

// Как бот получает обновления.
//
// По умолчанию — ОПРОСОМ (server/telegramPoll.js): сервер стоит в России, и
// Telegram до него не достукивается. Замерено на боевом: доставки вебхука то
// проходили, то отваливались с «Connection timed out», а зависшие обновления не
// приходили вовсе — при том что сами мы к Telegram ходим нормально. Поэтому
// направление перевёрнуто: не «Telegram стучится к нам», а «мы спрашиваем».
//
// TELEGRAM_WEBHOOK_MODE=1 возвращает вебхук — на случай переезда на хостинг,
// откуда Telegram достучаться может. Одновременно эти два режима работать не
// могут: при установленном вебхуке getUpdates отвечает 409.
export const webhookMode = () => process.env.TELEGRAM_WEBHOOK_MODE === "1"

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
// чтобы сравнивать его с уроками, которые isLessonPast() тоже собирает
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
const WEEKDAYS_FULL = ["воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота"]
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"]
// Именительный падеж — отдельным списком. Получать его из родительного заменой
// окончания нельзя: «марта» и «августа» так не чинятся.
const MONTHS_NOM = ["январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]

export function humanDate(iso) {
  const [y, m, d] = iso.split("-").map(Number)
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${d} ${MONTHS[m - 1]}, ${wd}`
}

// «9 сентября, среда» — для подзаголовка раздела, где сокращение «ср» выглядит
// телеграммой, а не интерфейсом.
export function humanDateFull(iso) {
  const [y, m, d] = iso.split("-").map(Number)
  return `${d} ${MONTHS[m - 1]}, ${WEEKDAYS_FULL[new Date(y, m - 1, d).getDay()]}`
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
//
// Слово склоняем: «…и ещё 104 занятий» — это не по-русски, а числа тут любые.
// Хвост задаётся тройкой «одно / два / пять»; строка тоже принимается, но
// склонять её нечем, поэтому новые списки лучше писать тройкой.
export function joinLimited(lines, max, tail = ["строка", "строки", "строк"]) {
  if (lines.length <= max) return lines.join("\n")
  const rest = lines.length - max
  const word = Array.isArray(tail) ? plural(rest, tail[0], tail[1], tail[2]) : tail
  return [...lines.slice(0, max), `<i>…и ещё ${rest} ${word}</i>`].join("\n")
}

// ── Профиль бота в Telegram ─────────────────────────────────────────────────
//
// Имя, описание и список команд — часть интерфейса, которую человек видит ДО
// первого сообщения: пустой чат показывает описание, а поле ввода — команды.
// Пока там стояло «бот репетитора», ученик, открыв бота по ссылке из кабинета,
// читал, что попал не туда.
//
// Само @username сменить нельзя — ни ботом, ни в BotFather (только просьбой в
// @BotSupport или новым ботом). Поэтому всё, что зависит от нас, обязано быть
// нейтральным по роли.
//
// Ставится САМО на боевом домене вместе с вебхуком: это не настройка и не
// выбор, а единственное правильное значение. Пишем только при расхождении —
// Telegram ограничивает частоту смены имени, и слать одно и то же на каждый
// health-check нельзя.

const BOT_NAME = "Precettore"

const BOT_DESCRIPTION = [
  "Precettore — платформа для репетиторов и их учеников.",
  "",
  "Репетитору: расписание, домашние работы, долги.",
  "Ученику: ближайшие занятия, задания со сроками и напоминания.",
  "",
  "Чтобы начать, возьмите код привязки в кабинете на precettore.ru.",
].join("\n")

const BOT_SHORT = "Кабинет Precettore в телефоне: занятия, домашние работы и напоминания."

// Команды по умолчанию видит тот, кто ещё не привязан: обещать ему разделы
// кабинета незачем, он до них всё равно не дойдёт без кода.
const CMDS_DEFAULT = [
  { command: "start", description: "Привязать кабинет" },
  { command: "help", description: "Что умеет бот" },
]

const CMDS_TUTOR = [
  { command: "menu", description: "Меню" },
  { command: "today", description: "Занятия сегодня" },
  { command: "week", description: "Расписание на неделю" },
  { command: "hw", description: "Домашние работы" },
  { command: "students", description: "Ученики" },
  { command: "money", description: "Деньги и долги" },
  { command: "settings", description: "Настройки" },
]

const CMDS_STUDENT = [
  { command: "menu", description: "Меню" },
  { command: "lessons", description: "Ближайшие занятия" },
  { command: "tasks", description: "Задания и сроки" },
  { command: "settings", description: "Настройки" },
]

const same = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null)

export async function ensureBotProfile() {
  const name = await tg("getMyName", {})
  if (name?.ok && name.result?.name !== BOT_NAME) {
    await tg("setMyName", { name: BOT_NAME })
  }

  const desc = await tg("getMyDescription", {})
  if (desc?.ok && desc.result?.description !== BOT_DESCRIPTION) {
    await tg("setMyDescription", { description: BOT_DESCRIPTION })
  }

  const short = await tg("getMyShortDescription", {})
  if (short?.ok && short.result?.short_description !== BOT_SHORT) {
    await tg("setMyShortDescription", { short_description: BOT_SHORT })
  }

  const cmds = await tg("getMyCommands", {})
  if (cmds?.ok && !same(cmds.result, CMDS_DEFAULT)) {
    await tg("setMyCommands", { commands: CMDS_DEFAULT })
  }
}

// Команды у КОНКРЕТНОГО чата: у репетитора и ученика они разные, и общий список
// на двоих был бы наполовину ложным — «Деньги и долги» в кабинете ученика
// открывать нечему. Ставится один раз, при привязке.
async function setChatCommands(chatId, commands) {
  await tg("setMyCommands", { commands, scope: { type: "chat", chat_id: chatId } })
}

// Отвязка снимает и команды: иначе в отвязанном чате остаётся список разделов,
// которых там больше нет, а чат, привязанный потом другой ролью, до следующей
// привязки показывал бы чужие. Привязка ставит их заново.
async function clearChatCommands(chatId) {
  await tg("deleteMyCommands", { scope: { type: "chat", chat_id: chatId } })
}

// ── Оформление ──────────────────────────────────────────────────────────────
//
// У Telegram из средств вёрстки есть только жирный, курсив, моноширинный,
// ссылка и цитата — поэтому все экраны собираются из ЧЕТЫРЁХ приёмов, и ни один
// раздел не выдумывает своих. Иначе бот выглядит как набор разных программ.
//
//   head   — эмодзи, название, под ним приглушённая строка с цифрами;
//   quote  — цитата: единственный способ показать структуру, кроме отступов.
//            Telegram рисует её вертикальной чертой, и список перестаёт быть
//            стеной текста. Длинные — раскрывающиеся, чтобы неделя не занимала
//            весь экран;
//   pair   — «подпись · значение», выровненные одинаково во всех разделах;
//   footer — ссылка СЛОВОМ. Голый https://… в тексте и есть та самая скудость:
//            он длиннее подписи и ничего не сообщает.

const head = (icon, title, sub) =>
  sub ? `${icon} <b>${title}</b>\n<i>${sub}</i>` : `${icon} <b>${title}</b>`

const quote = (rows, expandable = false) =>
  `<blockquote${expandable ? " expandable" : ""}>${rows.join("\n")}</blockquote>`

// Цитату раскрываем, только когда она реально длинная: у короткой кнопка
// «развернуть» — лишний шум.
const QUOTE_FOLD = 14

const pair = (label, value) => `${label} · ${value}`

// Две цитаты подряд Telegram СКЛЕИВАЕТ в одну: между ними нужна пустая строка,
// иначе три раздела карточки ученика читаются как один сплошной список.
// Проверено на боевых данных.
const stack = (...parts) => parts.filter(Boolean).join("\n\n")

const footer = (what) => `<i>${what} — <a href="${APP_URL}">в кабинете</a></i>`

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
  // Past, а не Conducted: занятие, снятое со счёта, уже прошло — иначе бот
  // назвал бы «следующим» то, которого не было.
  return all.find((l) => !isLessonPast(l, now)) || null
}

// Долг ученика считает тот же код, что и страница «Финансы» (billing.js):
// бот — второй вход в тот же кабинет, разойтись в цифрах он не имеет права.
// Оттуда же берутся абонементы: занятие, оплаченное вперёд, в долг не идёт.
export function debtOf(student) {
  return studentDebt(student, mskNow())
}

// Текущий период абонемента, если ученик на нём: за него уже начислено.
export function packageOf(student) {
  return studentBilling(student, mskNow()).package
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
        head("📅", "Сегодня", humanDateFull(today)),
        "",
        "Занятий нет.",
        next
          ? quote([
              pair("Ближайшее", `${humanDate(next.date)} в ${esc(next.time || "—")}`),
              pair("Ученик", esc(studentName(next.student.name, link.full_names))),
            ])
          : "<i>Дальше в расписании тоже пусто.</i>",
      ].join("\n"),
      keyboard: backTo(),
    }
  }

  // Снятое со счёта занятие не выдаём за проведённое и его денег не считаем:
  // бот — второй вход в тот же кабинет, цифры обязаны совпадать.
  const sum = items.reduce((s, l) => s + (isLessonConducted(l, now) || !isLessonPast(l, now)
    ? (l.student.lesson_price || 0) : 0), 0)
  const lines = items.map((l) => {
    const off = l.status === LESSON_EXCUSED
    const done = isLessonPast(l, now)
    return `${off ? "🚫" : done ? "✅" : "🕐"} <b>${esc(l.time || "—")}</b> · ${esc(studentName(l.student.name, link.full_names))}` +
      ` · ${l.duration || 60} мин${off ? " · не в счёт" : ""}`
  })

  return {
    text: [
      head("📅", "Сегодня", `${humanDateFull(today)} · ${lessonsWord(items.length)} · ${money(sum)}`),
      "",
      quote(lines.slice(0, 20), lines.length > QUOTE_FOLD),
      lines.length > 20
        ? `<i>…и ещё ${lines.length - 20} ${plural(lines.length - 20, "занятие", "занятия", "занятий")}</i>`
        : null,
    ].filter((x) => x !== null).join("\n"),
    keyboard: backTo(),
  }
}

export async function viewWeek(db, link) {
  const students = await loadStudents(db, link.tutor_id)
  const from = mskToday()
  const to = shiftDay(from, 6)
  const items = lessonsBetween(students, from, to)

  if (!items.length) {
    return {
      text: `${head("🗓", "Ближайшие семь дней")}\n\nЗанятий не запланировано.`,
      keyboard: backTo(),
    }
  }

  const byDay = new Map()
  for (const l of items) {
    if (!byDay.has(l.date)) byDay.set(l.date, [])
    byDay.get(l.date).push(l)
  }

  // Один блок на всю неделю, а не по блоку на день: семь цитат подряд рябят,
  // а внутри одной дни уже разделены жирной строкой и пустой строкой.
  const rows = []
  for (const [date, day] of byDay.entries()) {
    if (rows.length) rows.push("")
    rows.push(`<b>${humanDate(date)}</b>`)
    for (const l of day) {
      rows.push(pair(esc(l.time || "—"), esc(studentName(l.student.name, link.full_names))))
    }
  }

  const sum = items.reduce((s, l) => s + (l.student.lesson_price || 0), 0)
  return {
    text: [
      head("🗓", "Ближайшие семь дней", `${lessonsWord(items.length)} · ${money(sum)}`),
      "",
      quote(rows, rows.length > QUOTE_FOLD),
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

  const parts = [head("📝", "Домашние работы",
    `на проверке ${toCheck.length} · просрочено ${overdue.length} · в работе ${active.length}`)]

  if (toCheck.length) {
    parts.push("", "<b>Ждут проверки</b>")
    parts.push(quote(toCheck.slice(0, 10).map((h) =>
      `📩 <b>${who(h.student_id)}</b> · ${esc(h.title)}` +
      (h.submission_url ? ` · <a href="${esc(h.submission_url)}">работа</a>` : "")),
      toCheck.length > QUOTE_FOLD))
    if (toCheck.length > 10) {
      parts.push(`<i>…и ещё ${toCheck.length - 10} ${plural(toCheck.length - 10, "работа", "работы", "работ")}</i>`)
    }
  }
  if (overdue.length) {
    parts.push("", "<b>Просрочено</b>")
    parts.push(quote(overdue.slice(0, 10).map((h) =>
      `⚠️ <b>${who(h.student_id)}</b> · ${esc(h.title)} · <i>до ${esc(shortDate(h.deadline))}</i>`),
      overdue.length > QUOTE_FOLD))
    if (overdue.length > 10) {
      parts.push(`<i>…и ещё ${overdue.length - 10} ${plural(overdue.length - 10, "задание", "задания", "заданий")}</i>`)
    }
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
    return {
      text: `${head("👥", "Ученики")}\n\nПока никого нет.\n${footer("Ученик заводится заявкой")}`,
      keyboard: backTo(),
    }
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
    // Сокращения «зан.» и «ДЗ» убраны намеренно: в интерфейсе они читаются как
    // экономия на читателе, а места экономят три символа.
    const tail = [
      `${conducted} ${plural(conducted, "занятие", "занятия", "занятий")}`,
      hw ? `${hw} ${plural(hw, "работа", "работы", "работ")}` : null,
      debt > 0 ? `долг ${money(debt)}` : null,
    ].filter(Boolean).join(" · ")
    return pair(`<b>${esc(studentName(s.name, link.full_names))}</b>`, tail)
  })

  // Кнопки-карточки: первые восемь учеников, дальше подробности в кабинете.
  const rows = []
  students.slice(0, 8).forEach((s, i) => {
    const btn = { text: studentName(s.name, link.full_names), callback_data: `stu:${s.id}` }
    if (i % 2 === 0) rows.push([btn])
    else rows[rows.length - 1].push(btn)
  })

  return {
    text: [
      head("👥", "Ученики", `${students.length} ${plural(students.length, "человек", "человека", "человек")}`),
      "",
      quote(lines.slice(0, 25), lines.length > QUOTE_FOLD),
      lines.length > 25
        ? `<i>…и ещё ${lines.length - 25} ${plural(lines.length - 25, "ученик", "ученика", "учеников")}</i>`
        : null,
    ].filter((x) => x !== null).join("\n"),
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
    .filter((l) => !isLessonPast(l, now) && l.date >= mskToday())
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || "").localeCompare(String(b.time || "")))
  const mine = homework.filter((h) => String(h.student_id) === String(s.id))
  const toCheck = mine.filter((h) => h.status === "submitted").length
  const activeHw = mine.filter((h) => HW_ACTIVE.has(h.status)).length
  const debt = debtOf(s)
  const pack = packageOf(s)

  // Три блока вместо плоского перечня «подпись: значение»: учёба, деньги,
  // работы. Так карточка читается взглядом, а не построчно.
  const subtitle = [
    s.goal ? esc(s.goal) : null,
    s.exam_date ? `экзамен ${esc(shortDate(s.exam_date))}` : null,
    s.target_score ? `цель ${esc(s.target_score)}` : null,
  ].filter(Boolean).join(" · ")

  const study = [
    pair("Проведено", `${conducted.length} ${plural(conducted.length, "занятие", "занятия", "занятий")}`),
    upcoming.length
      ? pair("Ближайшее", `${humanDate(upcoming[0].date)} в ${esc(upcoming[0].time || "—")}`)
      : pair("Ближайшее", "не назначено"),
  ]

  const finance = [
    s.lesson_price ? pair("Цена занятия", money(s.lesson_price)) : null,
    debt > 0 ? pair("Долг", `<b>${money(debt)}</b>`)
      : debt < 0 ? pair("Предоплата", money(-debt))
      : pair("Оплата", "закрыта полностью"),
    pack
      ? pair("Абонемент", `${pack.lessons} ${plural(pack.lessons, "занятие", "занятия", "занятий")} по ${esc(shortDate(pack.until))}${pack.amount ? ` — ${money(pack.amount)}` : ""}`)
      : null,
  ].filter(Boolean)

  const text = stack(
    head("👤", esc(studentName(s.name, link.full_names)), subtitle || null),
    quote(study),
    quote(finance),
    quote([pair("Домашние работы", `${activeHw} в работе · ${toCheck} на проверке`)]),
  )

  return { text, keyboard: backTo("st") }
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
    .filter((l) => !isLessonPast(l, now))
    .reduce((sum, l) => sum + (l.student.lesson_price || 0), 0)

  const parts = [
    head("💰", "Деньги", `${MONTHS_NOM[now.getMonth()]} · ${now.getFullYear()}`),
    "",
    quote([
      pair("Получено", `<b>${money(monthIncome)}</b>`),
      pair("Ожидается до конца месяца", money(ahead)),
    ]),
  ]
  if (debtors.length) {
    parts.push("", `<b>Долги</b> · ${money(debtTotal)}`)
    parts.push(quote(debtors.slice(0, 12).map((d) =>
      pair(esc(studentName(d.name, link.full_names)), money(d.debt))),
      debtors.length > QUOTE_FOLD))
    if (debtors.length > 12) {
      parts.push(`<i>…и ещё ${debtors.length - 12} ${plural(debtors.length - 12, "ученик", "ученика", "учеников")}</i>`)
    }
  } else {
    parts.push("", "Долгов нет.")
  }
  parts.push("", footer("Расходы и налог"))

  return { text: parts.join("\n"), keyboard: backTo() }
}

export function viewSettings(link) {
  return {
    text: stack(
      head("⚙️", "Настройки"),
      quote([
        pair("Имена учеников", `<b>${link.full_names ? "полностью" : "сокращённо"}</b>`),
        link.full_names
          ? "<i>Фамилии уходят в Telegram целиком.</i>"
          : "<i>Бот пишет «Имя Ф.» — в Telegram уходит меньше личных данных.</i>",
      ]),
      quote([
        pair("Уведомления", `<b>${link.notify ? "включены" : "выключены"}</b>`),
        "<i>Сданные работы, варианты и сообщения учеников.</i>",
      ]),
    ),
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

// ── Ученик ──────────────────────────────────────────────────────────────────
//
// У ученика свой чат, своя привязка (student_telegram) и свои разделы: занятия
// и задания. Денег, чужих имён и списка учеников здесь нет — это его
// собственный кабинет, а не второй экземпляр репетиторского.
//
// Тарифом ученик не ограничен, в отличие от репетитора: платит за платформу не
// он, и это такой же канал доставки его собственных уведомлений, как push в
// кабинете.

const STUDENT_MENU = {
  inline_keyboard: [
    [{ text: "📅 Занятия", callback_data: "s:lessons" }, { text: "📝 Задания", callback_data: "s:tasks" }],
    [{ text: "⚙️ Настройки", callback_data: "s:set" }],
  ],
}

const studentBack = (extra = []) => ({
  inline_keyboard: [...extra, [{ text: "‹ Меню", callback_data: "s:menu" }]],
})

// «Сегодня» и «сейчас» по часам САМОГО УЧЕНИКА, а не по Москве: репетитор может
// вести занятие из другого пояса, и московский день здесь ни при чём.
function wallToday(tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date())
}

function wallNow(tz) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {})
  return new Date(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
}

// Всё, что бот показывает ученику, одним походом в базу — и сразу в его поясе.
//
// ГЛАВНОЕ: занятия лежат настенным временем в поясе-ЯКОРЕ карточки
// (students.timezone), а ученик обязан видеть их по своим часам. Перевод делает
// тот же код, что и кабинет (src/timezone.js); пояса нет ни у карточки, ни у
// аккаунта — функция тождественная, и бот ведёт себя как до поясов.
export async function studentHome(db, link) {
  const home = await db.call("bot_student_home", { p_account: link.account_id })
  if (!home) return null

  const tz = home.tz || TZ
  const cards = home.cards || []
  const lessons = []
  for (const card of cards) {
    for (const l of convertLessons(card.lessons || [], card.tz || tz, tz)) {
      if (l?.date) lessons.push({ ...l, tutor: card.tutor, card_id: card.id })
    }
  }
  lessons.sort((a, b) =>
    a.date.localeCompare(b.date) || String(a.time || "").localeCompare(String(b.time || "")))

  // Имя репетитора подписываем, только когда их несколько: одному ученику одного
  // репетитора эта строка ничего не сообщает и лишь занимает место.
  const tutors = new Set(cards.map((c) => c.tutor).filter(Boolean))

  return { ...home, tz, cards, lessons, manyTutors: tutors.size > 1 }
}

// Занятие уже прошло, либо снято со счёта — в «ближайших» ему не место.
const lessonAhead = (l, now) =>
  !isLessonPast(l, now) && l.status !== LESSON_EXCUSED && l.status !== "missed"

export async function viewStudentLessons(db, link) {
  const home = await studentHome(db, link)
  if (!home) return { text: "Данные не читаются. Попробуй позже.", keyboard: studentBack() }

  const now = wallNow(home.tz)
  const today = wallToday(home.tz)
  const ahead = home.lessons.filter((l) => l.date >= today && lessonAhead(l, now))

  if (!ahead.length) {
    return {
      text: [head("📅", "Занятия"), "", "Ближайших занятий нет.", "",
        footer("Расписание целиком")].join("\n"),
      keyboard: studentBack(),
    }
  }

  // Режем сами и честно пишем, сколько осталось: у ученика с занятиями два раза
  // в неделю «ближайшие» — это полгода вперёд, и молча показать первые восемь
  // значило бы соврать, что дальше ничего нет.
  const lines = ahead.map((l) => {
    const when = l.date === today ? "сегодня"
      : l.date === shiftDay(today, 1) ? "завтра"
      : humanDate(l.date)
    const time = l.time ? esc(l.time) : "—"
    const who = home.manyTutors && l.tutor ? ` · ${esc(l.tutor)}` : ""
    // Предложенный перенос виден сразу: иначе ученик придёт к старому времени.
    const move = l.moveRequest?.date
      ? `\n<i>↪ перенос на ${humanDate(l.moveRequest.date)}${l.moveRequest.time ? ` в ${esc(l.moveRequest.time)}` : ""}</i>`
      : ""
    return `${pair(`<b>${when}</b>`, time)}${who}${move}`
  })

  const shown = lines.slice(0, 8)
  return {
    text: [
      head("📅", "Ближайшие занятия",
        `${ahead.length} ${plural(ahead.length, "занятие", "занятия", "занятий")} впереди`),
      "",
      quote(shown),
      lines.length > 8
        ? `<i>…и ещё ${lines.length - 8} ${plural(lines.length - 8, "занятие", "занятия", "занятий")}</i>`
        : null,
      "",
      footer("Перенести занятие"),
    ].filter((x) => x !== null).join("\n"),
    keyboard: studentBack(),
  }
}

const STUDENT_HW_ACTIVE = new Set(["assigned", "revision"])

export async function viewStudentTasks(db, link) {
  const home = await studentHome(db, link)
  if (!home) return { text: "Данные не читаются. Попробуй позже.", keyboard: studentBack() }

  const today = wallToday(home.tz)
  const hw = (home.homework || []).filter((h) => STUDENT_HW_ACTIVE.has(h.status))
  const waiting = (home.homework || []).filter((h) => h.status === "submitted").length
  const variants = (home.variants || []).filter((v) => v.status === "pending")

  const counts = [
    hw.length ? `${hw.length} ${plural(hw.length, "работа", "работы", "работ")}` : null,
    variants.length ? `${variants.length} ${plural(variants.length, "вариант", "варианта", "вариантов")}` : null,
  ].filter(Boolean).join(" · ")

  const parts = [head("📝", "Задания", counts || null)]

  const due = (deadline) => {
    if (!deadline) return ""
    return deadline < today
      ? " · <b>просрочено</b>"
      : ` · <i>до ${shortDate(deadline)}</i>`
  }

  if (hw.length) {
    parts.push("", "<b>Домашние работы</b>")
    parts.push(quote(hw.slice(0, 10).map((h) =>
      `${esc(h.title || "Без названия")}${due(h.deadline)}` +
      (h.status === "revision" ? " · <i>на доработку</i>" : "")),
      hw.length > QUOTE_FOLD))
    if (hw.length > 10) {
      parts.push(`<i>…и ещё ${hw.length - 10} ${plural(hw.length - 10, "работа", "работы", "работ")}</i>`)
    }
  }

  if (variants.length) {
    parts.push("", "<b>Варианты</b>")
    parts.push(quote(variants.slice(0, 6).map((v) =>
      `${esc(v.title || "Вариант")}${due(v.deadline)}`)))
    if (variants.length > 6) {
      parts.push(`<i>…и ещё ${variants.length - 6} ${plural(variants.length - 6, "вариант", "варианта", "вариантов")}</i>`)
    }
  }

  if (!hw.length && !variants.length) {
    parts.push("", waiting
      ? `Новых заданий нет: ${waiting} ${plural(waiting, "работа ждёт", "работы ждут", "работ ждут")} проверки.`
      : "Новых заданий нет.")
  } else if (waiting) {
    parts.push("", `<i>Ещё ${waiting} ${plural(waiting, "работа ждёт", "работы ждут", "работ ждут")} проверки.</i>`)
  }

  parts.push("", footer("Решать"))
  return { text: parts.join("\n"), keyboard: studentBack() }
}

export function viewStudentSettings(link) {
  return {
    text: [
      head("⚙️", "Настройки"),
      "",
      quote([
        pair("Уведомления", `<b>${link.notify ? "включены" : "выключены"}</b>`),
        "<i>Новая работа, проверка, сообщение репетитора и напоминание о занятии.</i>",
      ]),
    ].join("\n"),
    keyboard: {
      inline_keyboard: [
        [{ text: link.notify ? "🔕 Выключить уведомления" : "🔔 Включить уведомления", callback_data: "s:notify" }],
        [{ text: "🚫 Отвязать этот чат", callback_data: "s:unlink" }],
        [{ text: "‹ Меню", callback_data: "s:menu" }],
      ],
    },
  }
}

const STUDENT_HELP = [
  "<b>Что умеет бот</b>",
  "",
  "📅 <b>Занятия</b> — ближайшие занятия по твоим часам.",
  "📝 <b>Задания</b> — домашние работы и варианты со сроками.",
  "",
  "Сам он напишет, когда репетитор выдаст работу или проверит её, пришлёт",
  "сообщение в чат и напомнит о занятии — накануне вечером и за час.",
  "",
  "Команды: /menu, /lessons, /tasks, /help",
  "",
  `Решать работы и писать репетитору — в кабинете: ${APP_URL}`,
].join("\n")

// Как и у репетитора: меню отвечает на вопрос, ради которого его открывают, —
// когда занятие и сколько несделанного. «Выбери раздел» видно по кнопкам.
async function viewStudentMenu(db, link) {
  const home = await studentHome(db, link)
  if (!home) return { text: head("📚", "Твой кабинет"), keyboard: STUDENT_MENU }

  const now = wallNow(home.tz)
  const today = wallToday(home.tz)
  const next = home.lessons.find((l) => l.date >= today && lessonAhead(l, now))
  const tasks = (home.homework || []).filter((h) => STUDENT_HW_ACTIVE.has(h.status)).length

  const when = !next ? "занятий впереди нет"
    : next.date === today ? `занятие сегодня в ${esc(next.time || "—")}`
    : next.date === shiftDay(today, 1) ? `занятие завтра в ${esc(next.time || "—")}`
    : `занятие ${humanDate(next.date)} в ${esc(next.time || "—")}`

  const sub = tasks
    ? `${when} · ${tasks} ${plural(tasks, "работа", "работы", "работ")} не сдано`
    : when

  return { text: head("📚", "Твой кабинет", sub), keyboard: STUDENT_MENU }
}

export async function studentRoute(db, link, action) {
  if (action === "s:menu") return viewStudentMenu(db, link)
  if (action === "s:lessons") return viewStudentLessons(db, link)
  if (action === "s:tasks") return viewStudentTasks(db, link)
  if (action === "s:set") return viewStudentSettings(link)
  if (action === "s:help") return { text: STUDENT_HELP, keyboard: studentBack() }
  return viewStudentMenu(db, link)
}

const STUDENT_COMMANDS = {
  "/menu": "s:menu", "/start": "s:menu",
  "/lessons": "s:lessons", "/today": "s:lessons", "/week": "s:lessons",
  "/tasks": "s:tasks", "/hw": "s:tasks",
  "/help": "s:help", "/settings": "s:set",
}

// ── Диспетчер ───────────────────────────────────────────────────────────────

// Меню без данных — пустой экран с подписью «выберите раздел», которую и так
// видно по кнопкам. Поэтому оно само отвечает на вопрос, ради которого его чаще
// всего и открывают: что сегодня.
async function viewMenu(db, link) {
  const students = await loadStudents(db, link.tutor_id)
  const today = mskToday()
  const now = mskNow()
  const items = lessonsBetween(students, today, today)
  const ahead = items.filter((l) => !isLessonPast(l, now))

  const sub = !items.length
    ? "сегодня занятий нет"
    : ahead.length
      ? `сегодня ${lessonsWord(items.length)} · ближайшее в ${esc(ahead[0].time || "—")}`
      : `сегодня ${lessonsWord(items.length)} · все прошли`

  return { text: head("📚", "Кабинет репетитора", sub), keyboard: MENU }
}

// Действия над ДЗ. tutor_id в условии обязателен: id задания приходит из
// callback_data, то есть снаружи, и без этой проверки чужую работу можно было бы
// зачесть, подставив её id.
async function setHomeworkStatus(db, tutorId, hwId, status) {
  return db.call("bot_hw_status", { p_tutor: tutorId, p_hw: hwId, p_status: status })
}

export async function route(db, link, action) {
  if (action === "menu") return viewMenu(db, link)
  if (action === "today") return viewToday(db, link)
  if (action === "week") return viewWeek(db, link)
  if (action === "hw") return viewHomework(db, link)
  if (action === "st") return viewStudents(db, link)
  if (action === "money") return viewMoney(db, link)
  if (action === "set") return viewSettings(link)
  if (action === "help") return { text: HELP, keyboard: backTo() }
  if (action.startsWith("stu:")) return viewStudent(db, link, action.slice(4))
  return viewMenu(db, link)
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
  // Бот ОДИН на обе роли, и роль чата решает то, какая привязка нашлась.
  // Вторую таблицу спрашиваем, только если первая пуста: у привязанного
  // репетитора лишнего запроса на каждое нажатие кнопки быть не должно.
  const slink = link ? null : await db.call("bot_student_link", { p_chat: chat })

  // ── Ещё не привязан: единственное, что можно — прислать код ──
  if (!link && !slink) {
    const text = String(msg?.text || "").trim()
    const code = text.startsWith("/start") ? text.slice(6).trim() : text
    if (cb) await tg("answerCallbackQuery", { callback_query_id: cb.id })

    if (!code) {
      await tg("sendMessage", {
        chat_id: chat,
        parse_mode: "HTML",
        text: [
          "<b>Precettore</b> — бот платформы.",
          "<i>Сервис работает в режиме бета-тестирования.</i>",
          "",
          "Чтобы связать бота с кабинетом, возьмите код привязки и пришлите его сюда:",
          `• репетитор — ${APP_URL} → «Профиль» → «Телеграм-бот»;`,
          `• ученик — ${APP_URL} → «Настройки» → «Телеграм».`,
          "",
          "<i>Боту репетитора нужен тариф «Про»; ученику — нет.</i>",
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
      // Код репетитора не подошёл — пробуем как ученический. Порядок неважен:
      // погашение каждой породы кодов смотрит на свою колонку, поэтому чужой
      // код первой попыткой не сгорает (supabase/telegram_student.sql).
      const accountId = await db.call("bot_student_claim", {
        p_code: code,
        p_chat: chat,
        p_username: msg?.from?.username || null,
        p_first_name: msg?.from?.first_name || null,
      })

      if (accountId) {
        await setChatCommands(chat, CMDS_STUDENT)
        await tg("sendMessage", {
          chat_id: chat,
          parse_mode: "HTML",
          text: `✅ Чат привязан к твоему кабинету.\n\n${STUDENT_HELP}`,
          reply_markup: STUDENT_MENU,
        })
        return
      }

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

    await setChatCommands(chat, CMDS_TUTOR)
    await tg("sendMessage", {
      chat_id: chat,
      parse_mode: "HTML",
      text: `✅ Чат привязан к вашему кабинету.\n\n${HELP}`,
      reply_markup: MENU,
    })
    return
  }

  // ── Привязан как ученик ──
  // Тариф здесь не проверяется намеренно: за платформу платит репетитор, и
  // понижение его тарифа не должно молча отключать ученику напоминания о
  // собственных занятиях.
  if (slink) {
    db.call("bot_student_link", { p_chat: chat, p_touch: true }).catch(() => {})

    if (cb) {
      const data = String(cb.data || "")
      const answer = (text) => tg("answerCallbackQuery", { callback_query_id: cb.id, ...(text ? { text } : {}) })

      if (data === "s:notify") {
        const fresh = (await db.call("bot_student_link", { p_chat: chat, p_notify: !slink.notify })) || slink
        const view = viewStudentSettings(fresh)
        await answer("Готово")
        await tg("editMessageText", {
          chat_id: chat, message_id: cb.message.message_id,
          parse_mode: "HTML", text: view.text, reply_markup: view.keyboard,
        })
        return
      }

      if (data === "s:unlink") {
        await db.call("bot_student_link", { p_chat: chat, p_unlink: true })
        await clearChatCommands(chat)
        await answer("Чат отвязан")
        await tg("sendMessage", {
          chat_id: chat,
          text: "Чат отвязан. Чтобы вернуть бота, возьми новый код в кабинете.",
        })
        return
      }

      const view = await studentRoute(db, slink, data)
      await answer()
      await tg("editMessageText", {
        chat_id: chat, message_id: cb.message.message_id,
        parse_mode: "HTML", text: view.text, reply_markup: view.keyboard,
        link_preview_options: { is_disabled: true },
      })
      return
    }

    const stext = String(msg?.text || "").trim()
    const scmd = stext.split(/[\s@]/)[0].toLowerCase()
    const view = await studentRoute(db, slink, STUDENT_COMMANDS[scmd] || "s:menu")
    await tg("sendMessage", {
      chat_id: chat,
      parse_mode: "HTML",
      text: view.text,
      reply_markup: view.keyboard,
      link_preview_options: { is_disabled: true },
    })
    return
  }

  // ── Привязан как репетитор: тариф проверяем на каждом действии ──
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
      await clearChatCommands(chat)
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
  hw_test:      { icon: "🧮", what: "сдал ответы к работе" },
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
    // Строго на БОЕВОМ домене: тот же токен виден любому другому запуску того же
    // кода (локальный, тестовый домен), и без этой проверки он перевёл бы живого
    // бота на себя. Так было заведено против превью-деплоев Vercel; сборок там
    // больше нет, но защита нужна ровно та же.
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    const isProdHost = host === new URL(APP_URL).host

    // Имя, описание и команды — тем же правилом и на том же боевом домене.
    // Не ждём завершения: health-check дёргает кабинет при открытии страницы,
    // и четыре лишних запроса в Telegram задержали бы ответ на ровном месте.
    if (isProdHost) ensureBotProfile().catch(() => {})

    // В режиме опроса вебхук не ставим и НЕ показываем его отсутствие как
    // поломку: он тут не нужен, а поставленный — сломал бы опрос (409).
    if (!webhookMode()) {
      res.status(200).json({
        ok: true,
        bot: me.result?.username || null,
        mode: "polling",
        webhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
        webhook: "",
        webhookError: "",
      })
      return
    }

    // Перерегистрируем вебхук ОДИН РАЗ за запуск процесса, а не только когда
    // его нет вовсе.
    //
    // Почему так, а не «нет адреса — поставить». Секрет вебхука хранится ТОЛЬКО
    // у Telegram, и getWebhookInfo его не возвращает: сверить нечем. При этом
    // адрес у нас не менялся с переезда с Vercel, а секрет сменился — его
    // выпускает заново set-telegram-token.sh, потому что прежний лежал в env
    // Vercel и не читается. Прежнее условие видело непустой адрес и НЕ трогало
    // вебхук, поэтому Telegram продолжал бы слать обновления со старым
    // секретом, обработчик отвечал бы 401, и бот молчал бы ровно так же, как до
    // установки токена. Кнопка «Настроить вебхук» в кабинете тоже не спасала:
    // она показывается как раз при ОТСУТСТВИИ вебхука.
    //
    // Раз в запуск — потому что правка api.env требует пересоздания контейнера
    // (docker restart env_file не перечитывает), то есть новый секрет и новый
    // процесс появляются ВМЕСТЕ. Лишний запрос к Telegram при этом один на
    // перезапуск, а не на каждое открытие кабинета.
    const needWebhook = !hook?.result?.url || !webhookEnsured
    if (needWebhook && process.env.TELEGRAM_WEBHOOK_SECRET && isProdHost) {
      // Сначала СНЯТЬ, потом поставить. На setWebhook с тем же адресом Telegram
      // отвечает «Webhook is already set» и новый secret_token не применяет —
      // проверено 09.09.2026 живьём: после смены секрета он продолжал слать
      // старый, обработчик отвечал 401, и это выглядело как «бот молчит».
      if (hook?.result?.url) await tg("deleteWebhook", { drop_pending_updates: false })
      const set = await tg("setWebhook", {
        url: `https://${host}/api/telegram`,
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ["message", "callback_query"],
      })
      if (set?.ok) {
        webhookEnsured = true
        hook = await tg("getWebhookInfo", {})
      }
    }

    res.status(200).json({
      ok: true,
      bot: me.result?.username || null,
      mode: "webhook",
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
  if (req.query?.action === "setup" && !webhookMode()) {
    res.status(409).json({ error: "Бот работает опросом — вебхук ему не нужен и сломал бы приём обновлений" })
    return
  }

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
