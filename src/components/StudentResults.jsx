import { useMemo } from "react"
import Icon from "./Icon"
import ExamProgress from "./ExamProgress"
import TaskMap from "./TaskMap"
import { useAttempts } from "../useAttempts"
import { examTypeOf, shownScore, shownScoreMax } from "../examStats"
import { aggregateAttempts } from "../reportData"
import { numberTitle } from "../pages/numberTitles"
import { plural } from "../utils"

// Результаты в кабинете САМОГО ученика. Раздел отвечает на три вопроса, и
// больше ни на что: где я сейчас, по каким заданиям проседаю, что повторить.
//
// Считается это теми же модулями, что и «Результаты» у репетитора (examStats,
// ExamProgress, TaskMap, первые ответы из task_attempts). Второй арифметики
// здесь нет намеренно: два кабинета, показывающие разные проценты по одному
// ученику, — это не два мнения, а поломка.
//
// Чего тут нет и не должно быть: методичек репетитора (они его личные) и
// кнопки «задать себе работу» — домашние работы выдаёт репетитор.

// Те же пороги, что у «Где ученик ошибается» и карты заданий. Меньше трёх
// ответов — не вывод, а пара неудачных дней.
const MIN_ATTEMPTS = 3
const WEAK_ACCURACY = 70

const fmtDay = (d) => (d ? new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "")

// Плитка сводки. Заливки нет — только кольцо и акцентный значок: серая
// подложка на стекле читается как выцветшее пятно.
function Tile({ icon, label, value, suffix, sub, tone = "blue" }) {
  const TONE = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-300 ring-blue-500/20",
    green: "bg-green-500/10 text-green-700 dark:text-green-300 ring-green-500/20",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/25",
    purple: "bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-purple-500/20",
  }
  return (
    <div className="glass p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className={`w-7 h-7 rounded-xl grid place-items-center ring-1 ${TONE[tone]}`}>
          <Icon name={icon} size={14} />
        </span>
        {/* Подпись переносится, а не обрезается: на телефоне плитки стоят по
            две в ряд, и «Верно с первого раза» ужималось до «Верно с перво…». */}
        <span className="text-xs text-gray-400 leading-tight">{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums leading-tight">
        {value}
        {suffix && <span className="text-sm font-normal text-gray-400"> {suffix}</span>}
      </div>
      {sub && <div className="text-xs text-gray-400 truncate">{sub}</div>}
    </div>
  )
}

// Классы сетки — картой: класс, собранный из переменной, Tailwind в сборку не возьмёт.
const COLS = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }

function StudentResults({ student, stats, hwStats, chart = null }) {
  const attempts = useAttempts(student?.id)
  const examType = examTypeOf(student || {}, stats)

  // Свод по первым ответам — тем же правилом, что у репетитора: повторные
  // подходы не считаем, иначе режим «решай до верного» превращал бы
  // исправленную ошибку в два промаха.
  const byType = useMemo(
    () => aggregateAttempts((attempts || []).filter((a) => !examType || a.exam_type === examType)),
    [attempts, examType],
  )

  // Точность с первого раза — единственное число, которого нет ни в одной
  // работе: балл говорит про одну работу, а это про все ответы сразу.
  const answered = byType.reduce((n, r) => n + r.attempts, 0)
  const correct = byType.reduce((n, r) => n + r.correct, 0)
  const accuracy = answered ? Math.round((correct / answered) * 100) : null

  // Слабые места — по НОМЕРУ задания, а не по типажу: подписи типажей живут в
  // банке заданий (это мегабайты кода), а ученику важнее «с девятым беда», чем
  // формальное имя разновидности. Карта заданий выше показывает все номера,
  // здесь — только те, за которые стоит взяться в первую очередь.
  const weak = useMemo(() => {
    const by = {}
    for (const r of byType) {
      const cur = by[r.number] || { number: r.number, attempts: 0, correct: 0 }
      cur.attempts += r.attempts
      cur.correct += r.correct
      by[r.number] = cur
    }
    return Object.values(by)
      .map((r) => ({ ...r, accuracy: Math.round((r.correct / r.attempts) * 100) }))
      .filter((r) => r.attempts >= MIN_ATTEMPTS && r.accuracy < WEAK_ACCURACY)
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
      .slice(0, 5)
  }, [byType])

  // Баллы показываем в тех же единицах, в каких они стоят на самой работе, —
  // общим правилом из examStats, чтобы главная и этот раздел не расходились.
  const shownOf = (r) => shownScore(examType, r)
  const scoreMax = shownScoreMax(examType)

  const rows = stats?.rows || []
  const avg = rows.length ? Math.round(rows.reduce((n, r) => n + shownOf(r), 0) / rows.length) : null
  const bestRow = rows.length ? rows.reduce((a, b) => (shownOf(b) > shownOf(a) ? b : a), rows[0]) : null

  const tiles = []
  if (avg != null) {
    tiles.push(
      <Tile key="avg" icon="bar-chart" label="Средний балл" value={avg}
        suffix={scoreMax ? `из ${scoreMax}` : null}
        sub={`${rows.length} ${plural(rows.length, "вариант", "варианта", "вариантов")}`} />,
    )
    tiles.push(
      <Tile key="best" icon="trending-up" tone="green" label="Лучший результат" value={shownOf(bestRow)}
        suffix={scoreMax ? `из ${scoreMax}` : null}
        sub={[bestRow.title, fmtDay(bestRow.date)].filter(Boolean).join(" · ")} />,
    )
  }
  if (hwStats?.avgGrade != null) {
    tiles.push(
      <Tile key="hw" icon="clipboard" tone="purple" label="Оценка за задания" value={hwStats.avgGrade} suffix="/ 5"
        sub={`${hwStats.gradedCount} ${plural(hwStats.gradedCount, "оценка", "оценки", "оценок")}`} />,
    )
  }
  if (accuracy != null) {
    tiles.push(
      <Tile key="acc" icon="check" tone={accuracy >= 70 ? "green" : "amber"} label="Верно с первого раза"
        value={`${accuracy}%`}
        sub={`${answered} ${plural(answered, "ответ", "ответа", "ответов")}`} />,
    )
  }

  const hasProgress = !!(stats?.isExam && stats?.hasData)
  const nothing = !tiles.length && !hasProgress && !(attempts || []).length

  if (!student) {
    return (
      <div className="text-sm text-gray-400 text-center py-8 border border-dashed border-white/50 glass-sm">
        Сначала подключись к репетитору
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-medium">Результаты</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Баллы за варианты, оценки за задания и то, на чём чаще всего теряются баллы.
        </p>
      </div>

      {nothing ? (
        <div className="glass p-6 md:p-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-300 mb-4">
            <Icon name="bar-chart" size={26} />
          </div>
          <div className="text-base font-semibold mb-1">Пока считать нечего</div>
          <div className="text-sm text-gray-500 max-w-sm">
            Реши первую работу или вариант — и здесь появятся баллы, готовность к экзамену
            и карта заданий с процентами по каждому номеру.
          </div>
        </div>
      ) : (
        <>
          {tiles.length > 0 && (
            <div className={`grid grid-cols-2 gap-4 ${COLS[tiles.length] || COLS[4]}`}>{tiles}</div>
          )}

          {/* Готовность к экзамену — тот же блок, что видит репетитор: прогноз,
              темп и шкала до цели. Скрывать от ученика собственный прогноз
              незачем, а приукрашивать его нельзя. */}
          {hasProgress && <ExamProgress student={student} stats={stats} attempts={attempts} />}

          {/* Динамика показывается графиком готовности; отдельная кривая нужна
              только там, где блока готовности нет (цель не экзамен). */}
          {!hasProgress && chart}

          <TaskMap attempts={attempts} examType={examType} readOnly />

          {weak.length > 0 && (
            <div className="glass p-4">
              <h3 className="text-sm font-medium">Над чем поработать</h3>
              <p className="text-xs text-gray-400 mt-0.5 mb-3">
                По первым ответам в вариантах и заданиях из банка, с {MIN_ATTEMPTS}-го ответа по заданию.
              </p>
              <div className="flex flex-col gap-2">
                {weak.map((r) => (
                  <div key={r.number} className="glass-sm rounded-2xl px-3 py-2.5 flex items-center gap-3">
                    <span className="shrink-0 w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300 text-xs font-semibold flex items-center justify-center">
                      {r.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{numberTitle(examType, r.number) || `Задание №${r.number}`}</div>
                      <div className="text-[11px] text-gray-400 truncate">
                        задание №{r.number} · {r.correct} из {r.attempts} верно
                      </div>
                    </div>
                    <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium tabular-nums ${
                      r.accuracy < 40
                        ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                    }`}>
                      {r.accuracy}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                Попроси репетитора дать тренировку по этим заданиям — проценты сдвинутся здесь же.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default StudentResults
