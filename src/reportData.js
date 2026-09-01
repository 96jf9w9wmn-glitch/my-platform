// Сбор отчёта родителю БЕЗ участия репетитора.
//
// Правило фичи: репетитор ничего не заполняет. Всё, что попадает в отчёт, —
// факты, которые платформа и так знает: проведённые занятия с заметками,
// выданные и проверенные домашние работы, попытки решения заданий банка.
// Уверенность по теме тоже не выставляется «на глаз»: это доля верных ответов
// за период, тот же критерий, по которому «Слабые типажи» красят строку.
//
// Модель (api/lesson-report.js) получает уже посчитанные факты и пишет только
// связный текст — темы и статусы она НЕ придумывает, иначе отчёт родителю
// расходился бы с тем, что видно в кабинете.

import { supabase } from "./supabase"
import { isLessonConducted } from "./utils"

// Меньше трёх попыток — не тема, а пара неудачных дней: в отчёт не идёт.
// То же число, что и в «Слабых типажах» (components/WeakTypes.jsx).
export const MIN_ATTEMPTS = 3

// Пороги те же, что у слабых типажей: <40% — нужна помощь, <70% — в процессе.
export function confidenceByAccuracy(accuracy) {
  if (accuracy < 40) return "struggling"
  if (accuracy < 70) return "progress"
  return "confident"
}

// Сколько тем показываем. Больше пяти строк родитель уже не читает, а лист
// перестаёт помещаться на страницу.
const MAX_TOPICS = 5

// Дата строкой — ПО МЕСТНОМУ времени. toISOString здесь нельзя: вечером в
// Москве он отдаёт вчерашнее число, и отчёт терял последнее занятие.
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }

// Начало периода: со следующего дня после прошлого отчёта, а если отчётов ещё
// не было — месяц назад. Так два отчёта подряд не пересказывают одно и то же.
export function periodStart(lastReportDate, fallbackDays = 30) {
  if (!lastReportDate) return daysAgo(fallbackDays)
  const d = new Date(String(lastReportDate).slice(0, 10) + "T00:00:00")
  d.setDate(d.getDate() + 1)
  const since = iso(d)
  // Отчёт, отправленный сегодня, не должен обнулить период до пустоты.
  return since > iso(new Date()) ? iso(new Date()) : since
}

// Ключ типажа — одинаковый везде, где попытки группируются: и сам свод, и
// источник данных рядом со строкой считаются по нему, разъехаться они не должны
// (иначе к строке подписался бы источник соседнего типажа).
export const attemptKey = (a) => `${a.exam_type}|${a.number}|${a.gen_key || ""}`

// Свод попыток решения по типажам за период. Считаем сами, а не берём вьюху
// v_student_weak_types: она агрегирует за всё время, а отчёт — про период.
export function aggregateAttempts(attempts) {
  const map = new Map()
  for (const a of attempts || []) {
    // Только ПЕРВЫЕ попытки. Домашнюю работу можно пересдать, а задание —
    // решать до верного ответа; если считать все подходы, ученик, который
    // исправился со второго раза, выглядел бы как решивший половину.
    if ((a.attempt_no ?? 1) > 1) continue
    const key = attemptKey(a)
    const row = map.get(key) || {
      exam_type: a.exam_type, number: a.number, gen_key: a.gen_key || null,
      attempts: 0, correct: 0,
    }
    row.attempts += 1
    if (a.is_correct) row.correct += 1
    map.set(key, row)
  }
  return [...map.values()].map((r) => ({ ...r, accuracy: Math.round((r.correct / r.attempts) * 100) }))
}

// Подписи из банка заданий. Родителю нужен не типаж («ax² = bx»), а тема
// («Квадратные уравнения»), поэтому берём и то и другое: имя раздела темы для
// заголовка строки и подпись типажа — на случай, если раздела нет.
// Банк тяжёлый, поэтому грузим лениво и только когда есть что подписывать —
// так же, как это делает useTypeLabels для слабых типажей.
export async function typeLabels(rows) {
  const keyed = (rows || []).filter((r) => r.gen_key)
  if (!keyed.length) return {}
  try {
    const { taskThemes } = await import("./pages/taskGenerators")
    const map = {}
    for (const r of keyed) {
      let themes
      try { themes = taskThemes(r.exam_type, r.number) } catch { continue }
      for (const t of themes || []) {
        for (const it of t.items) if (it.key === r.gen_key) map[r.gen_key] = { label: it.label, theme: t.theme }
      }
    }
    return map
  } catch {
    return {}   // банк не загрузился — обойдёмся номерами заданий
  }
}

function topicTitle(row, labels) {
  const hit = labels[row.gen_key]
  return hit?.theme || hit?.label || `Задание №${row.number}`
}

// Типажи внутри одной темы складываем: родителю важно, как идут «Квадратные
// уравнения» целиком, а не каждый из шести генераторов по отдельности. Заодно
// в бакете набирается достаточно попыток, чтобы процент что-то значил.
export function groupByTheme(aggregated, labels) {
  const map = new Map()
  for (const r of aggregated || []) {
    const title = topicTitle(r, labels)
    const key = `${r.exam_type}|${title}`
    const row = map.get(key) || { ...r, title, attempts: 0, correct: 0 }
    row.attempts += r.attempts
    row.correct += r.correct
    map.set(key, row)
  }
  return [...map.values()].map((r) => ({ ...r, accuracy: Math.round((r.correct / r.attempts) * 100) }))
}

// Одна строка отчёта — своими словами, без модели. Она же остаётся, если
// DeepSeek недоступен: отчёт всё равно уходит, просто суше.
function factComment(row) {
  const wrong = row.attempts - row.correct
  if (!wrong) return `${row.attempts} ${row.attempts === 1 ? "задача решена" : "задач решено"} без ошибок.`
  return `Решено ${row.correct} из ${row.attempts}, ошибок — ${wrong}.`
}

// Темы отчёта. Сначала то, что получается, потом то, над чем работаем:
// родитель должен увидеть успехи, а не только список провалов.
export function pickTopics(aggregated, labels) {
  const enough = groupByTheme(aggregated, labels).filter((r) => r.attempts >= MIN_ATTEMPTS)
  const strong = enough.filter((r) => r.accuracy >= 70).sort((a, b) => b.accuracy - a.accuracy)
  const weak = enough.filter((r) => r.accuracy < 70).sort((a, b) => a.accuracy - b.accuracy)

  // Слабым отдаём больше места: это то, ради чего отчёт и читают. Но хотя бы
  // одна сильная тема остаётся всегда, если она вообще есть.
  const weakTake = weak.slice(0, Math.max(MAX_TOPICS - Math.min(strong.length, 2), 3))
  const strongTake = strong.slice(0, Math.max(0, MAX_TOPICS - weakTake.length))

  return [...strongTake, ...weakTake]
    .sort((a, b) => b.accuracy - a.accuracy)
    .map((r) => ({
      title: r.title,
      confidence: confidenceByAccuracy(r.accuracy),
      comment: factComment(r),
      accuracy: r.accuracy,
      attempts: r.attempts,
      gen_key: r.gen_key,
      number: r.number,
      exam_type: r.exam_type,
    }))
}

// Запасной вариант, когда ученик решает не через банк, а файлами: темы берём
// из тем занятий. Уверенности у них нет — и мы её НЕ выдумываем: в листе такая
// тема выводится без статуса.
export function topicsFromLessons(lessons) {
  const seen = new Set()
  const out = []
  for (const l of [...(lessons || [])].reverse()) {
    const title = String(l.topic || "").trim()
    if (!title || seen.has(title.toLowerCase())) continue
    seen.add(title.toLowerCase())
    out.push({ title, confidence: null, comment: l.note ? String(l.note).trim() : "" })
    if (out.length >= MAX_TOPICS) break
  }
  return out.reverse()
}

// Главное: собрать лист из фактов. Чистая функция — сеть отдельно (loadFacts).
export function collectFacts({ student, homework = [], attempts = [], labels = {}, since, now = new Date() }) {
  const from = since || daysAgo(30)
  const to = iso(now)

  const lessons = (student?.lessons || [])
    .filter((l) => l.date && l.date >= from && l.date <= to && isLessonConducted(l, now))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({ date: l.date, topic: l.topic || "", note: l.note || "" }))

  const hw = (homework || []).filter((h) => {
    const d = String(h.created_at || h.due_date || "").slice(0, 10)
    return d && d >= from && d <= to
  })
  const graded = hw.filter((h) => h.grade != null)
  const done = hw.filter((h) => h.status === "done" || h.grade != null)

  const aggregated = aggregateAttempts(attempts)
  const solved = aggregated.reduce((s, r) => s + r.attempts, 0)
  const correct = aggregated.reduce((s, r) => s + r.correct, 0)

  const byBank = pickTopics(aggregated, labels)
  const topics = byBank.length ? byBank : topicsFromLessons(lessons)

  return {
    period: { from, to },
    lessons,
    topics,
    stats: {
      lessons: lessons.length,
      homeworkGiven: hw.length,
      homeworkDone: done.length,
      avgGrade: graded.length
        ? Math.round((graded.reduce((s, h) => s + h.grade, 0) / graded.length) * 10) / 10
        : null,
      tasksSolved: solved,
      accuracy: solved ? Math.round((correct / solved) * 100) : null,
    },
  }
}

// Всё, что нужно для отчёта, одним заходом в базу. Ничего чужого: только этот
// ученик. Ошибки не роняют сбор — отчёт должен уходить и без банка заданий.
export async function loadFacts(student, { fallbackDays = 30 } = {}) {
  const id = String(student.id)

  const [{ data: last }, { data: homework }] = await Promise.all([
    supabase.from("lesson_reports")
      .select("lesson_date, period_to")
      .eq("student_id", id)
      .not("sent_at", "is", null)
      .order("lesson_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("homework")
      .select("id, title, status, grade, created_at, due_date")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ])

  const since = periodStart(last?.period_to || last?.lesson_date, fallbackDays)

  const { data: attempts } = await supabase.from("task_attempts")
    .select("exam_type, number, gen_key, is_correct, attempt_no, created_at")
    .eq("student_id", id)
    .gte("created_at", `${since}T00:00:00`)
    .limit(2000)

  const aggregated = aggregateAttempts(attempts || [])
  const labels = await typeLabels(aggregated)

  return collectFacts({ student, homework: homework || [], attempts: attempts || [], labels, since })
}

// Хватает ли материала на отчёт. Пустой отчёт («занятий не было») родителю не
// нужен — он читается как отписка.
export function worthSending(facts, minLessons = 1) {
  return (facts?.stats?.lessons || 0) >= minLessons
}

// ── Имя ученика наружу не уходит ────────────────────────────────────────────
// DeepSeek — сервис в КНР, а имя школьника это персональные данные: их
// передача была бы трансграничной (152-ФЗ). Поэтому имя вырезается здесь, в
// браузере, а в готовый текст подставляется обратно. Модель на его месте
// пишет метку NAME_TOKEN. Код перенесён из ReportComposer без изменений
// логики: теперь он нужен и автоматической отправке, а не только кнопке.
const NAME_TOKEN = "{{ИМЯ}}"

// В свободном тексте имя склоняется («Ваня решил» → «у Вани»), поэтому ищем не
// точное слово, а основу с любым коротким окончанием. Обычный \b здесь не
// годится: в JS он считает кириллицу небуквенной — вместо него запрет на
// продолжение слова справа.
function nameRegexes(name) {
  return String(name || "")
    .split(/[\s,]+/)
    .filter((w) => w.length >= 3)
    .map((w) => {
      const stem = w.slice(0, Math.max(3, w.length - 2)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      return new RegExp(`${stem}[а-яёa-z]{0,3}(?![а-яёa-zA-ZА-ЯЁ])`, "gi")
    })
}

export function hideName(text, name) {
  return nameRegexes(name).reduce((acc, re) => acc.replace(re, NAME_TOKEN), String(text || ""))
}

export function restoreName(text, name) {
  return String(text || "").split(NAME_TOKEN).join(name || "ученик")
}

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня",
                    "июля", "августа", "сентября", "октября", "ноября", "декабря"]

function human(isoDate) {
  const d = new Date(String(isoDate || "").slice(0, 10) + "T00:00:00")
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`
}

// Текст отчёта без модели: сухой, зато всегда честный. Нужен, когда DeepSeek
// недоступен или тариф не даёт ИИ-отчётов — отчёт всё равно должен уйти.
export function fallbackText(facts) {
  const s = facts.stats
  const parts = [
    s.lessons ? `За период с ${human(facts.period.from)} по ${human(facts.period.to)} проведено занятий: ${s.lessons}.` : "",
    s.homeworkGiven ? `Домашних работ выдано ${s.homeworkGiven}, сдано ${s.homeworkDone}.` : "",
    s.avgGrade ? `Средний балл за домашние работы — ${String(s.avgGrade).replace(".", ",")} из 5.` : "",
    s.tasksSolved ? `Решено задач: ${s.tasksSolved}, верных ответов ${s.accuracy}%.` : "",
  ].filter(Boolean)

  const weak = facts.topics.filter((t) => t.confidence === "struggling").map((t) => t.title)
  return {
    summary: parts.join(" "),
    next_steps: weak.length
      ? `Дальше берём в работу темы, где пока больше всего ошибок: ${weak.join(", ")}.`
      : "",
  }
}

// Полный отчёт: факты из базы + человеческий текст от модели поверх них.
// Модель недоступна — отчёт собирается всё равно (fallbackText), потому что
// цифры и темы к ней отношения не имеют.
export async function generateReport(student, { accessToken } = {}) {
  const facts = await loadFacts(student)
  const firstName = String(student.name || "").split(/\s+/)[0]
  const fallback = fallbackText(facts)

  const notes = facts.lessons
    .map((l) => [l.date, l.topic, l.note].filter(Boolean).join(": "))
    .filter(Boolean)
    .join("; ")

  let ai = null
  try {
    const res = await fetch("/api/lesson-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        period: `${facts.period.from} — ${facts.period.to}`,
        stats: facts.stats,
        // Имя вырезаем и из тем: тему занятия репетитор пишет свободным текстом.
        topics: facts.topics.map((t) => ({
          title: hideName(t.title, firstName),
          confidence: t.confidence,
          attempts: t.attempts || 0,
          correct: t.attempts ? Math.round((t.accuracy / 100) * t.attempts) : 0,
        })),
        notes: hideName(notes, firstName),
      }),
    })
    if (res.ok) ai = await res.json()
  } catch { /* сеть недоступна — уходим на fallback ниже */ }

  const comments = Array.isArray(ai?.comments) ? ai.comments : []
  return {
    period_from: facts.period.from,
    period_to: facts.period.to,
    stats: facts.stats,
    lessons: facts.lessons,
    summary: restoreName(ai?.summary, firstName) || fallback.summary,
    // Без разобранных тем модели не из чего строить «что дальше»: она пишет
    // служебное «в предоставленных данных не определены», и это уходит
    // родителю. В таком отчёте раздела лучше не будет вовсе.
    next_steps: (facts.topics.length ? restoreName(ai?.next_steps, firstName) : "") || fallback.next_steps,
    topics: facts.topics.map((t, i) => ({
      title: t.title,
      confidence: t.confidence,
      // Комментарий модели — поверх фактического; если она промолчала,
      // остаётся счёт «решено 9 из 12», который посчитан здесь.
      comment: restoreName(comments[i], firstName) || t.comment || "",
      accuracy: t.accuracy ?? null,
      attempts: t.attempts ?? null,
    })),
    ai: !!ai,
  }
}

// Отправка родителю: строка в lesson_reports + уведомление в кабинет ученика
// (у родителя своего аккаунта в notifications нет, а приложение в семье чаще
// одно на двоих).
export async function sendReport(student, report, { auto = false } = {}) {
  const base = {
    tutor_id: student.tutor_id,
    student_id: String(student.id),
    lesson_date: report.period_to || iso(new Date()),
    topics: report.topics || [],
    summary: (report.summary || "").trim(),
    next_steps: (report.next_steps || "").trim() || null,
    sent_at: new Date().toISOString(),
  }
  const full = {
    ...base,
    period_from: report.period_from,
    period_to: report.period_to,
    stats: report.stats || {},
    lessons: report.lessons || [],
    auto,
  }

  let { error } = await supabase.from("lesson_reports").insert(full)
  // Пока lesson_reports_auto.sql не выполнен, новых колонок нет. Отчёт от
  // этого пропадать не должен: сохраняем без них — родитель увидит текст и
  // темы, а цифры лист досчитает уже при печати.
  if (error && /period_from|period_to|stats|lessons|auto/.test(error.message || "")) {
    ({ error } = await supabase.from("lesson_reports").insert(base))
  }
  if (error) return { error }

  const accountId = student.studentAccountId || (student.phone
    ? (await supabase.from("student_accounts").select("id").eq("phone", student.phone).maybeSingle()).data?.id
    : null)
  if (accountId) {
    await supabase.from("notifications").insert({
      user_id: accountId,
      title: "Отчёт о занятиях",
      body: "Репетитор отправил отчёт — он виден в кабинете родителя.",
    })
  }
  return { error: null }
}
