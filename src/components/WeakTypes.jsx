import { useEffect, useState } from "react"
import { supabase } from "../supabase"

// Слабые типажи ученика: по каким разновидностям заданий он ошибается чаще
// всего. Читает вьюху v_student_weak_types (свод по task_attempts) — она
// исполняется правами вызывающего, поэтому репетитор видит только своих.
//
// Главное правило показа: пока попыток мало, ничего не красим в красный.
// Две ошибки из двух — это не «провальная тема», это два неудачных дня.
const MIN_ATTEMPTS = 3

function tone(row) {
  if (row.attempts < MIN_ATTEMPTS) return { cls: "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300", note: "мало данных" }
  if (row.accuracy < 40) return { cls: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300", note: null }
  if (row.accuracy < 70) return { cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", note: null }
  return { cls: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300", note: null }
}

function WeakTypes({ studentId }) {
  const [rows, setRows] = useState([])
  const [labels, setLabels] = useState({})

  useEffect(() => {
    if (!studentId) return
    let alive = true
    supabase
      .from("v_student_weak_types")
      .select("*")
      .eq("student_id", String(studentId))
      // Сначала самые проблемные, при равной точности — где больше попыток.
      .order("accuracy", { ascending: true })
      .order("attempts", { ascending: false })
      .limit(10)
      // Вьюхи может не быть (миграция task_attempts.sql не выполнена) — тогда блока просто нет.
      .then(({ data }) => { if (alive && data) setRows(data) })
    return () => { alive = false }
  }, [studentId])

  // Человеческие названия типажей берём из банка. Он большой, поэтому грузим
  // его лениво и только когда есть что подписывать.
  useEffect(() => {
    if (!rows.length) return
    let alive = true
    import("../pages/taskGenerators").then(({ taskThemes }) => {
      if (!alive) return
      const map = {}
      for (const r of rows) {
        if (!r.gen_key) continue
        let themes
        try { themes = taskThemes(r.exam_type, r.number) } catch { /* предмета/номера нет — подписи не будет */ }
        for (const t of themes || []) {
          for (const it of t.items) if (it.key === r.gen_key) map[r.gen_key] = it.label
        }
      }
      setLabels(map)
    })
    return () => { alive = false }
  }, [rows])

  if (!rows.length) return null

  return (
    <div className="glass p-4">
      <h2 className="text-sm font-medium mb-3">Слабые типажи</h2>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const t = tone(r)
          return (
            <div key={`${r.number}-${r.gen_key || "no-key"}`} className="glass-sm rounded-2xl px-3 py-2.5 flex items-center gap-3">
              <span className="shrink-0 w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300 text-xs font-semibold flex items-center justify-center">
                {r.number}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{labels[r.gen_key] || r.gen_key || "Задание без типажа"}</div>
                <div className="text-[11px] text-gray-400">
                  {r.correct} из {r.attempts} верно{t.note ? " · " + t.note : ""}
                </div>
              </div>
              <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${t.cls}`}>
                {r.attempts < MIN_ATTEMPTS ? "—" : `${r.accuracy}%`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WeakTypes
