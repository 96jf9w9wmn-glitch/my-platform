import { useState, useEffect, useMemo } from "react"
import { supabase } from "../supabase"

// «Отчёты родителям» в разделе «Профиль».
//
// Смысл фичи: репетитор не составляет отчёты. Прошёл период, были занятия —
// родителю ушёл готовый лист: сколько занимались, что разобрали, где пока
// ошибки, над чем работаем дальше. Всё это платформа знает и без него.
//
// Расписание отрабатывает сам кабинет при заходе (src/reportAuto.js): текст
// пишет модель, а из базы во внешний DeepSeek не сходить — pg_cron, на котором
// держатся квитанции, здесь не годится.

const PERIODS = [
  { days: 7,  label: "Раз в неделю" },
  { days: 14, label: "Раз в две недели" },
  { days: 30, label: "Раз в месяц" },
]

const MIN_LESSONS = [
  { n: 1, label: "от одного" },
  { n: 2, label: "от двух" },
  { n: 3, label: "от трёх" },
]

const Chip = ({ active, children, ...props }) => (
  <button
    type="button"
    {...props}
    className={`no-press px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.94] ring-1 ${
      active
        ? "bg-[#007AFF] text-white ring-[#007AFF]"
        : "bg-white/60 text-gray-600 ring-gray-200 hover:bg-white dark:bg-white/5 dark:ring-white/10"
    }`}
  >
    {children}
  </button>
)

export default function AutoReportSettings({ tutorId, students = [], surface = "glass p-5" }) {
  const [cfg, setCfg] = useState({ enabled: false, every_days: 14, min_lessons: 2 })
  const [ready, setReady] = useState(true)   // миграция lesson_reports_auto.sql выполнена
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])

  useEffect(() => {
    if (!tutorId) return
    let alive = true

    supabase.from("tutor_report_settings")
      .select("enabled, every_days, min_lessons")
      .eq("tutor_id", tutorId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) { setReady(false); return }
        if (data) setCfg((c) => ({ ...c, ...data }))
      })

    supabase.from("lesson_reports")
      .select("id, student_id, lesson_date, auto, sent_at")
      .eq("tutor_id", tutorId)
      .not("sent_at", "is", null)
      .order("lesson_date", { ascending: false })
      .limit(8)
      .then(({ data }) => { if (alive && data) setRows(data) })

    return () => { alive = false }
  }, [tutorId])

  async function save(patch) {
    const next = { ...cfg, ...patch }
    setCfg(next)                 // оптимистично: тумблер не должен «залипать»
    if (!tutorId) return
    setSaving(true)
    const { error } = await supabase.from("tutor_report_settings").upsert({
      tutor_id: tutorId,
      enabled: next.enabled,
      every_days: next.every_days,
      min_lessons: next.min_lessons,
      updated_at: new Date().toISOString(),
    })
    if (error) setReady(false)
    setSaving(false)
  }

  const nameById = useMemo(() => {
    const map = new Map()
    for (const s of students) map.set(String(s.id), s.name)
    return map
  }, [students])

  return (
    <div className={`${surface} flex flex-col`}>
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium">Отчёты родителям</h2>
          {cfg.enabled && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/12 text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-500/25">
              Включено
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => save({ enabled: !cfg.enabled })}
          disabled={saving || !ready}
          aria-label={cfg.enabled ? "Выключить отчёты" : "Включить отчёты"}
          className={`no-press relative w-12 h-7 rounded-full transition-colors disabled:opacity-40 active:scale-[0.96] ${
            cfg.enabled ? "bg-[#007AFF]" : "bg-blue-500/15 ring-1 ring-inset ring-blue-500/25 dark:bg-white/[0.16] dark:ring-white/20"
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${cfg.enabled ? "translate-x-5" : ""}`} />
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Родитель сам получает лист с занятиями, домашними работами, темами и планом на дальше.
        Заполнять ничего не нужно: отчёт собирается по проведённым занятиям и решённым задачам,
        а темы отмечаются по доле верных ответов, а не на глаз.
      </p>

      {!ready && (
        <div className="text-xs text-amber-600 dark:text-amber-300 bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 rounded-xl px-3 py-2.5 mb-4">
          Не выполнена миграция supabase/lesson_reports_auto.sql — расписанию негде храниться.
        </div>
      )}

      {cfg.enabled && (
        <div className="flex flex-col gap-4 mb-5">
          <div className="flex flex-col gap-2">
            <span className="text-xs text-gray-500">Как часто отправлять</span>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <Chip key={p.days} active={cfg.every_days === p.days} onClick={() => save({ every_days: p.days })}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-gray-500">Отправлять, если занятий за период</span>
            <div className="flex flex-wrap gap-2">
              {MIN_LESSONS.map((m) => (
                <Chip key={m.n} active={cfg.min_lessons === m.n} onClick={() => save({ min_lessons: m.n })}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-auto">
          <div className="text-xs text-gray-500 mb-2">Последние отчёты</div>
          <div className="flex flex-col gap-1.5">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-gray-700 dark:text-gray-200">
                  {nameById.get(String(r.student_id)) || "Ученик"}
                </span>
                <span className="shrink-0 text-gray-400">
                  {new Date(r.lesson_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  {r.auto ? " · сам" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
