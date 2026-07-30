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
  if (row.attempts < MIN_ATTEMPTS) return { cls: "bg-gray-100 text-gray-500 dark:bg-white/10", note: "мало данных" }
  if (row.accuracy < 40) return { cls: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300", note: null }
  if (row.accuracy < 70) return { cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", note: null }
  return { cls: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300", note: null }
}

// Сколько задач кладём в тренировочный лист по одному типажу.
const DRILL_SIZE = 8

function WeakTypes({ studentId, studentName }) {
  const [rows, setRows] = useState([])
  const [labels, setLabels] = useState({})
  const [drilling, setDrilling] = useState(null)

  useEffect(() => {
    if (!studentId) return
    let alive = true
    supabase
      .from("v_student_weak_types")
      .select("*")
      .eq("student_id", String(studentId))
      // Берём с запасом: сортировать нужно по правилу, которого нет в SQL (см. ниже).
      .limit(60)
      // Вьюхи может не быть (миграция task_attempts.sql не выполнена) — тогда блока просто нет.
      .then(({ data }) => {
        if (!alive || !data) return
        // Наверх — типажи, по которым данных достаточно, худшие первыми. Строки с
        // одной-двумя попытками уходят вниз: иначе единственная случайная ошибка
        // (точность 0%) вытеснила бы из десятки настоящую проблему с 40% из 12 попыток.
        // PostgREST отдаёт numeric и count как СТРОКИ («40», «12»). Сравнения
        // вроде accuracy < 40 на строках срабатывают только благодаря приведению
        // типов, а «40.0%» в подписи уже выглядело бы неряшливо — приводим сами.
        const norm = data.map((r) => ({
          ...r,
          attempts: Number(r.attempts),
          correct: Number(r.correct),
          accuracy: Math.round(Number(r.accuracy)),
        }))
        const sorted = norm.sort((a, b) => {
          const aEnough = a.attempts >= MIN_ATTEMPTS, bEnough = b.attempts >= MIN_ATTEMPTS
          if (aEnough !== bEnough) return aEnough ? -1 : 1
          if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy
          return b.attempts - a.attempts
        })
        setRows(sorted.slice(0, 10))
      })
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

  // Лист-тренировка по одному типажу: тот же genKey, свежие числа. Ровно то,
  // ради чего ключ типажа вообще появился — «ещё восемь таких же».
  async function drill(row) {
    if (!row.gen_key) return
    setDrilling(row.gen_key)
    try {
      const [{ generateTask }, { generateVariantPdf }] = await Promise.all([
        import("../pages/taskGenerators"),
        import("../pages/variantPdf"),
      ])
      // У части типажей пространство параметров узкое (например, ЕГЭ Профиль №5
      // «lamps» даёт всего 5 разных условий на 20 генераций), поэтому не берём
      // подряд, а отбираем НЕПОВТОРЯЮЩИЕСЯ: лист с двумя одинаковыми задачами
      // выглядит как ошибка платформы. Если разных меньше восьми — отдаём
      // сколько есть, а не добираем дублями.
      const tasks = []
      const seen = new Set()
      for (let i = 0; i < DRILL_SIZE * 4 && tasks.length < DRILL_SIZE; i++) {
        const t = generateTask(row.exam_type, row.number, row.gen_key)
        if (!t) continue
        const fingerprint = `${t.condition_text || ""}|${t.answer || ""}`
        if (seen.has(fingerprint)) continue
        seen.add(fingerprint)
        tasks.push({ ...t, number: row.number })
      }
      if (!tasks.length) return
      const title = `Тренировка · №${row.number}${labels[row.gen_key] ? " · " + labels[row.gen_key] : ""}` +
        (studentName ? ` · ${studentName}` : "")
      // Сразу с ответами: лист делается для репетитора, чтобы дать и проверить.
      const blob = await generateVariantPdf({ title, examType: row.exam_type, tasks, mode: "answers" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = title + ".pdf"
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDrilling(null)
    }
  }

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
              {r.gen_key && (
                <button
                  onClick={() => drill(r)}
                  disabled={drilling === r.gen_key}
                  title={`Лист из ${DRILL_SIZE} задач этого же типажа, числа новые`}
                  className="press-fill shrink-0 text-[11px] px-2.5 py-1.5 rounded-xl ring-1 ring-gray-200 dark:ring-white/15 text-gray-700 disabled:opacity-50"
                >
                  {drilling === r.gen_key ? "Собираем…" : "Тренировка"}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WeakTypes
