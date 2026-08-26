// Автоматическая отправка отчётов родителям.
//
// Смысл фичи ровно тот же, что у автоматических квитанций: репетитор не сидит
// и не составляет отчёты — прошёл период, были занятия, отчёт ушёл сам.
// Разница в том, что текст пишет модель, а до неё из базы не дотянуться:
// pg_cron не ходит во внешний DeepSeek. Поэтому расписание отрабатывает
// кабинет репетитора при заходе — так же, как он догоняет квитанции вызовом
// invoices_sync_self.
//
// Осторожность здесь важнее скорости: отчёт уходит семье от имени репетитора,
// поэтому автоотправка выключена по умолчанию, работает не чаще раза в сутки
// на кабинет и берёт за проход не больше нескольких учеников (каждый отчёт —
// платный запрос к модели и списание месячного лимита тарифа).

import { useEffect, useRef } from "react"
import { supabase } from "./supabase"
import { generateReport, sendReport, worthSending } from "./reportData"

const STAMP_KEY = (tutorId) => `auto_reports_run:${tutorId}`
const RUN_EVERY_MS = 12 * 60 * 60 * 1000   // как часто вообще проверяем
const MAX_PER_RUN = 3                       // сколько отчётов отправляем за заход

// По местному времени, как и в reportData: под вечер UTC-дата отстаёт на сутки.
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function daysBetween(fromIso, toIso) {
  const a = new Date(String(fromIso).slice(0, 10) + "T00:00:00")
  const b = new Date(String(toIso).slice(0, 10) + "T00:00:00")
  return Math.round((b - a) / 86400000)
}

// Кому пора отправлять: отчётов ещё не было или прошло достаточно дней.
export function dueStudents(students, lastByStudent, everyDays, now = today()) {
  return (students || []).filter((s) => {
    const last = lastByStudent[String(s.id)]
    if (!last) return true
    return daysBetween(last, now) >= everyDays
  })
}

export async function runAutoReports({ tutorId, students, force = false }) {
  if (!tutorId || !students?.length) return { sent: 0, skipped: "нет учеников" }

  const { data: cfg, error } = await supabase
    .from("tutor_report_settings")
    .select("enabled, every_days, min_lessons")
    .eq("tutor_id", tutorId)
    .maybeSingle()
  // Нет таблицы (миграция не выполнена) или нет строки — молчим. Забытая
  // миграция не должна начать сама писать родителям.
  if (error || !cfg?.enabled) return { sent: 0, skipped: "выключено" }

  if (!force) {
    const stamp = Number(localStorage.getItem(STAMP_KEY(tutorId)) || 0)
    if (Date.now() - stamp < RUN_EVERY_MS) return { sent: 0, skipped: "проверяли недавно" }
  }
  localStorage.setItem(STAMP_KEY(tutorId), String(Date.now()))

  const { data: history } = await supabase
    .from("lesson_reports")
    .select("student_id, lesson_date")
    .eq("tutor_id", tutorId)
    .not("sent_at", "is", null)
    .order("lesson_date", { ascending: false })
    .limit(500)

  const lastByStudent = {}
  for (const r of history || []) {
    const key = String(r.student_id)
    if (!lastByStudent[key]) lastByStudent[key] = r.lesson_date
  }

  const due = dueStudents(students, lastByStudent, cfg.every_days || 14).slice(0, MAX_PER_RUN)
  if (!due.length) return { sent: 0, skipped: "все отчёты свежие" }

  const { data: { session } } = await supabase.auth.getSession()
  let sent = 0
  for (const student of due) {
    try {
      const report = await generateReport(student, { accessToken: session?.access_token })
      // Пара занятий — минимум, ниже которого отчёт превращается в отписку.
      if (!worthSending(report, cfg.min_lessons || 2)) continue
      const { error: err } = await sendReport(student, report, { auto: true })
      if (!err) sent += 1
    } catch { /* один ученик не должен ронять весь проход */ }
  }
  return { sent }
}

// Хук для кабинета репетитора: проверяет расписание при заходе на главную.
export function useAutoReports({ tutorId, students, enabled }) {
  const done = useRef(false)
  useEffect(() => {
    if (!enabled || !tutorId || !students?.length || done.current) return
    done.current = true
    runAutoReports({ tutorId, students })
  }, [tutorId, students, enabled])
}
