import { useEffect, useRef, useState } from "react"
import { supabase } from "../supabase"
import Icon from "./Icon"
import useTypeLabels from "./typeLabels"
import { aggregateAttempts, attemptKey } from "../reportData"
import { numberTitle } from "../pages/numberTitles"
import { plural } from "../utils"
import { usePlan } from "../subscription"

// Слабые места ученика: по каким разновидностям заданий он ошибается чаще
// всего. Считаем по самим попыткам (task_attempts, политика пускает репетитора
// только к своим ученикам), а НЕ по вьюхе v_student_weak_types: вьюха
// складывает все подходы подряд, и в режиме «решай до верного» три захода к
// одной задаче превращались в «0 из 3 верно». Отчёт родителю считает первые
// ответы (aggregateAttempts) — теперь тут ровно та же арифметика, иначе
// кабинет и отчёт расходятся на одном и том же ученике.
//
// Главное правило показа: пока ответов мало, вывода не делаем. Две ошибки из
// двух — это не «провальная тема», это два неудачных дня; такие строки не
// попадают в список, а собираются в одну поясняющую фразу под ним.
const MIN_ATTEMPTS = 3

// Выше этой точности типаж уже не «слабый»: раздел обещает места, где ученик
// ошибается, и строка «1 из 1 верно» в нём читается как сбой платформы.
const WEAK_ACCURACY = 70

// В списке — только то, по чему вывод действительно есть: достаточно ответов И
// точность ниже порога. Раньше сюда попадали и строки с одним ответом (просто
// потому, что он был неверный), и после первого же сданного варианта раздел
// превращался в десяток одинаковых «0 из 1 верно · мало данных» — по ним
// непонятно ни что случилось, ни откуда взялись цифры.
const isWeak = (row) => row.attempts >= MIN_ATTEMPTS && row.accuracy < WEAK_ACCURACY

// Ответов мало, но ошибки есть: в список не берём, а сказать о них надо —
// иначе выйдет «промахов нет» там, где ученик как раз ошибался.
const isThin = (row) => row.attempts < MIN_ATTEMPTS && row.correct < row.attempts

function tone(row) {
  if (row.accuracy < 40) return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
  return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
}

// Откуда взялись цифры. Главный вопрос репетитора к этому разделу: он выдал
// работу файлом, а строки появились — значит, посчитаны они по чему-то другому.
const SOURCE = { variant: "вариант", homework: "домашняя работа", practice: "тренировка" }

function sourceLabel(set) {
  const names = [...(set || [])].map((s) => SOURCE[s]).filter(Boolean)
  if (!names.length) return ""
  if (names.length === 1) return names[0]
  return names.slice(0, -1).join(", ") + " и " + names[names.length - 1]
}

// Откуда цифры — первый вопрос репетитора к разделу: он выдал работу файлом,
// а строки появились. Ответ нужен, но одной строкой: работа, прикреплённая
// файлом, сюда не попадает — что в файле, платформа не знает.
const SOURCE_NOTE = "По первым ответам в вариантах и работах из банка"

const fmtDay = (iso) =>
  iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : ""

// Сколько задач в тренировочной работе по одному типажу. Восемь — это один
// вечер, а не наказание: типаж повторится достаточно раз, чтобы проценты в
// этом же списке сдвинулись, но работа останется выполнимой за один подход.
// Число живёт здесь, а не в модуле выдачи: он приезжает динамически, а подпись
// кнопки нужна сразу.
const DRILL_SIZE = 8

const rowKey = (r) => `${r.number}-${r.gen_key || "no-key"}`

function WeakTypes({ student }) {
  const studentId = student?.id
  const [rows, setRows] = useState([])
  // Ошибки, по которым ещё рано судить: сколько их и откуда они пришли.
  const [thin, setThin] = useState({ count: 0, sources: new Set(), last: null })
  const [drilling, setDrilling] = useState(null)
  // Строка, по которой работа только что ушла, и текст отказа, если не ушла.
  const [assigned, setAssigned] = useState(null)
  const [failed, setFailed] = useState("")
  const doneTimer = useRef(null)
  const { allows, openPlans } = usePlan()
  const labels = useTypeLabels(rows)

  useEffect(() => () => clearTimeout(doneTimer.current), [])

  useEffect(() => {
    if (typeof location !== "undefined" && location.search.includes("weakdemo")) {
      setRows([
        { exam_type: "ОГЭ", number: 8, gen_key: "pow-frac", attempts: 9, correct: 3, accuracy: 33, sources: new Set(["homework"]), last: "2026-09-05T10:00:00Z" },
        { exam_type: "ОГЭ", number: 15, gen_key: "trap-midline", attempts: 6, correct: 3, accuracy: 50, sources: new Set(["variant"]), last: "2026-09-02T10:00:00Z" },
        { exam_type: "ОГЭ", number: 21, gen_key: null, attempts: 5, correct: 3, accuracy: 60, sources: new Set(["homework"]), last: "2026-08-30T10:00:00Z" },
      ])
      setThin({ count: 2, sources: new Set(["homework"]), last: null })
      return
    }
    if (!studentId) return
    let alive = true
    supabase
      .from("task_attempts")
      .select("exam_type, number, gen_key, is_correct, attempt_no, source, created_at")
      .eq("student_id", String(studentId))
      .limit(2000)
      // Таблицы может не быть (миграция task_attempts.sql не выполнена) — тогда блока просто нет.
      .then(({ data }) => {
        if (!alive || !data) return
        // Источник и дата — по тому же ключу типажа, что и сам свод: строка
        // должна уметь ответить, из какой работы взялись её цифры.
        const meta = new Map()
        for (const a of data) {
          if ((a.attempt_no ?? 1) > 1) continue
          const k = attemptKey(a)
          const m = meta.get(k) || { sources: new Set(), last: null }
          if (a.source) m.sources.add(a.source)
          if (a.created_at && (!m.last || a.created_at > m.last)) m.last = a.created_at
          meta.set(k, m)
        }
        const norm = aggregateAttempts(data).map((r) => ({ ...r, ...(meta.get(attemptKey(r)) || {}) }))
        // Худшие первыми, при равной точности — те, где ответов больше: сорок
        // процентов из двенадцати ответов — проблема надёжнее, чем из трёх.
        const sorted = norm.filter(isWeak).sort((a, b) =>
          a.accuracy - b.accuracy || b.attempts - a.attempts)
        const few = norm.filter(isThin)
        const sources = new Set()
        let last = null
        for (const r of few) {
          for (const s of r.sources || []) sources.add(s)
          if (r.last && (!last || r.last > last)) last = r.last
        }
        setThin({ count: few.length, sources, last })
        setRows(sorted.slice(0, 10))
      })
    return () => { alive = false }
  }, [studentId])

  // Подпись типажа — она же название работы у ученика. Когда ключа нет
  // (генератор не заведён в темы), называем сам раздел номера: «Задание без
  // типажа» — это про наши данные, а не про то, что решать.
  const rowLabel = (row) => labels[row.gen_key] || numberTitle(row.exam_type, row.number)

  // Работа из клонов того же типажа — прямо в кабинет ученика. До этого кнопка
  // скачивала PDF репетитору, и петля не замыкалась: решённое на бумаге в
  // платформу не возвращалось, процент у строки не двигался и закрыть слабое
  // место было нечем. Теперь ученик решает у себя, попытки идут в журнал, и
  // строка уходит из списка сама.
  async function assign(row) {
    if (!location.search.includes("weakdemo") && !allows("homework")) return openPlans()
    const key = rowKey(row)
    clearTimeout(doneTimer.current)
    setFailed("")
    setAssigned(null)
    setDrilling(key)
    try {
      const { assignDrill } = await import("../pages/homeworkDrill")
      const res = await assignDrill({
        student,
        examType: row.exam_type,
        number: row.number,
        genKey: row.gen_key,
        title: `Тренировка · ${rowLabel(row)}`,
        size: DRILL_SIZE,
      })
      if (res.error) { setFailed(res.error); return }
      setAssigned(key)
      // Отметка «Задано» держится недолго: список живёт на экране, и вечная
      // галочка соврала бы про следующую выдачу по той же строке.
      doneTimer.current = setTimeout(() => setAssigned(null), 4000)
    } catch (e) {
      setFailed("Не получилось выдать: " + (e.message || e))
    } finally {
      setDrilling(null)
    }
  }

  // Ошибки, не дотянувшие до порога: строкой под списком. Источник у них не
  // называем — у каждой строки списка он и так подписан.
  const thinCount = `${thin.count} ${plural(thin.count, "задании", "заданиях", "заданиях")}`
  const thinUnder = `Ошибки есть ещё в ${thinCount}, но там всего один-два ответа — для вывода этого мало.`

  // Раздела нет, пока сказать нечего. Пустой блок объяснял двумя строками, что
  // выводов не будет, — то есть занимал место ровно тем, что он бесполезен.
  // Появятся ответы — появится и раздел, вместе со списком.
  if (!rows.length) return null

  return (
    <div className="glass p-4">
      <h2 className="text-sm font-medium">Где ученик ошибается</h2>
      {/* Раздел раньше назывался «Слабые типажи» и не объяснял ни откуда цифры,
          ни что делает кнопка. Обе строки — ответ на эти два вопроса. */}
      <p className="text-xs text-gray-400 mt-0.5 mb-3">
        {SOURCE_NOTE}, с {MIN_ATTEMPTS}-го ответа по заданию
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const key = rowKey(r)
          const from = [sourceLabel(r.sources), fmtDay(r.last)].filter(Boolean).join(", ")
          return (
            <div key={key} className="glass-sm rounded-2xl px-3 py-2.5 flex items-center gap-3">
              <span className="shrink-0 w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300 text-xs font-semibold flex items-center justify-center">
                {r.number}
              </span>
              <div className="min-w-0 flex-1">
                {/* «Задание без типажа» — это про наши данные, а не про ученика.
                    Когда ключа нет, называем сам раздел номера. */}
                <div className="text-sm truncate">{rowLabel(r)}</div>
                {/* Голубой кружок с цифрой репетитор читал как «9 чего?» —
                    поэтому номер задания назван и словами. */}
                <div className="text-[11px] text-gray-400 truncate">
                  задание №{r.number} · {r.correct} из {r.attempts} верно{from ? " · " + from : ""}
                </div>
              </div>
              <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium tabular-nums ${tone(r)}`}>
                {r.accuracy}%
              </span>
              {/* Главное действие строки, поэтому чип тонирован акцентом, а не
                  висит бледной рамкой: увидев слабое место, репетитор тут же
                  задаёт по нему работу — и ответы вернутся в эти же проценты. */}
              <button
                onClick={() => assign(r)}
                disabled={drilling === key}
                title={`Домашняя работа из ${DRILL_SIZE} таких же задач со свежими числами — сразу в кабинет ученика`}
                className="press-fill shrink-0 inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-xl font-medium bg-blue-500/[0.08] ring-1 ring-blue-500/20 text-blue-600 dark:text-blue-300 disabled:opacity-50"
              >
                <Icon name={assigned === key ? "check" : "plus"} size={12} />
                {drilling === key ? "Выдаём…" : assigned === key ? "Задано" : `Задать ${DRILL_SIZE} таких`}
              </button>
            </div>
          )
        })}
      </div>
      {/* Отказ выдачи — строкой под списком: у кнопки для него нет места, а
          промолчать нельзя, репетитор решит, что работа ушла. */}
      {failed && <p className="text-[11px] text-red-600 dark:text-red-400 mt-3">{failed}</p>}
      {/* Ошибки, которых в списке нет: молча отбросить их нельзя — репетитор
          увидит десять строк и решит, что остального не было. */}
      {thin.count > 0 && <p className="text-[11px] text-gray-400 mt-3">{thinUnder}</p>}
    </div>
  )
}

export default WeakTypes
