import { useEffect, useState } from "react"
import { supabase } from "../supabase"
import useTypeLabels from "./typeLabels"
import { numberTitle } from "../pages/numberTitles"

// Слабые типажи ученика: по каким разновидностям заданий он ошибается чаще
// всего. Читает вьюху v_student_weak_types (свод по task_attempts) — она
// исполняется правами вызывающего, поэтому репетитор видит только своих.
//
// Главное правило показа: пока попыток мало, ничего не красим в красный.
// Две ошибки из двух — это не «провальная тема», это два неудачных дня.
const MIN_ATTEMPTS = 3

// Выше этой точности типаж уже не «слабый»: раздел обещает места, где ученик
// ошибается, и строка «1 из 1 верно» в нём читается как сбой платформы.
const WEAK_ACCURACY = 70

// Слабым считаем то, где есть чему учиться: при достаточном числе попыток —
// низкая точность, при малом — сам факт ошибок. Безошибочные типажи в раздел
// не попадают ни при каком числе попыток.
function isWeak(row) {
  return row.attempts >= MIN_ATTEMPTS ? row.accuracy < WEAK_ACCURACY : row.correct < row.attempts
}

function tone(row) {
  if (row.attempts < MIN_ATTEMPTS) return { cls: "text-gray-500 ring-1 ring-gray-200/70 dark:ring-white/15", note: "мало данных" }
  if (row.accuracy < 40) return { cls: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300", note: null }
  return { cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", note: null }
}

// Сколько задач кладём в тренировочный лист по одному типажу.
const DRILL_SIZE = 8

const rowKey = (r) => `${r.number}-${r.gen_key || "no-key"}`

function WeakTypes({ studentId, studentName }) {
  const [rows, setRows] = useState([])
  // Были ли вообще данные: пустой раздел после отбора значит «промахов нет»,
  // а это другая новость, чем «ученик ничего не решал».
  const [hadData, setHadData] = useState(false)
  const [drilling, setDrilling] = useState(null)
  const [failed, setFailed] = useState(null)
  const labels = useTypeLabels(rows)

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
        const sorted = norm.filter(isWeak).sort((a, b) => {
          const aEnough = a.attempts >= MIN_ATTEMPTS, bEnough = b.attempts >= MIN_ATTEMPTS
          if (aEnough !== bEnough) return aEnough ? -1 : 1
          if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy
          return b.attempts - a.attempts
        })
        setHadData(norm.length > 0)
        setRows(sorted.slice(0, 10))
      })
    return () => { alive = false }
  }, [studentId])

  // Лист-тренировка по одному типажу: тот же genKey, свежие числа. Ровно то,
  // ради чего ключ типажа вообще появился — «ещё восемь таких же».
  //
  // У части номеров ключ не проставляется (генератор не заведён в темы), и
  // раньше кнопки там просто не было — ряд выглядел сломанным. Теперь такой
  // строке собирается лист по самому номеру: типаж будет случайный, но это
  // лучше, чем неработающая половина списка.
  async function drill(row) {
    const key = rowKey(row)
    setFailed(null)
    setDrilling(key)
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
      if (!tasks.length) { setFailed(key); return }
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

  if (!rows.length) {
    if (!hadData) return null
    return (
      <div className="glass p-4">
        <h2 className="text-sm font-medium">Слабые типажи</h2>
        <p className="text-xs text-gray-400 mt-1">Промахов пока нет: решённые задания идут без ошибок.</p>
      </div>
    )
  }

  return (
    <div className="glass p-4">
      <h2 className="text-sm font-medium">Слабые типажи</h2>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">Задания, где ученик ошибается. Точность — доля верных ответов.</p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const t = tone(r)
          const key = rowKey(r)
          return (
            <div key={key} className="glass-sm rounded-2xl px-3 py-2.5 flex items-center gap-3">
              <span className="shrink-0 w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300 text-xs font-semibold flex items-center justify-center">
                {r.number}
              </span>
              <div className="min-w-0 flex-1">
                {/* «Задание без типажа» — это про наши данные, а не про ученика.
                    Когда ключа нет, называем сам раздел номера. */}
                <div className="text-sm truncate">{labels[r.gen_key] || numberTitle(r.exam_type, r.number)}</div>
                <div className="text-[11px] text-gray-400">
                  {r.correct} из {r.attempts} верно{t.note ? " · " + t.note : ""}
                </div>
              </div>
              {/* Раньше при малом числе попыток тут стоял прочерк — пустая
                  пилюля, из которой ничего не следует. Процент показываем
                  всегда, а неуверенность передаёт спокойный тон и подпись. */}
              <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium tabular-nums ${t.cls}`}>
                {r.accuracy}%
              </span>
              <button
                onClick={() => drill(r)}
                disabled={drilling === key}
                title={`Лист из ${DRILL_SIZE} задач того же вида, числа новые`}
                className="press-fill shrink-0 text-[11px] px-2.5 py-1.5 rounded-xl ring-1 ring-gray-200 dark:ring-white/15 text-gray-700 disabled:opacity-50"
              >
                {drilling === key ? "Собираем…" : failed === key ? "Не собралось" : "Тренировка"}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WeakTypes
