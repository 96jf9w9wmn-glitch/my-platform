import { useEffect, useId, useMemo, useState } from "react"
import { supabase } from "../supabase"
import Icon from "../components/Icon"
import WeakTypes from "../components/WeakTypes"
import TaskMap from "../components/TaskMap"
import Collapse from "../components/Collapse"
import AnswerTable from "../components/AnswerTable"
import SegmentSwitch from "../components/SegmentSwitch"
import useCountUp from "../components/useCountUp"
import useTypeLabels from "../components/typeLabels"
import { plural, getInitials, answersEqual } from "../utils"
import { PlanLock } from "../components/PlanLock"
import { usePlan } from "../subscription"
import { part1NumbersOf } from "./taskBankMeta"
import { numberTitle } from "./numberTitles"
import { secondaryLabel } from "../examScales"
// Арифметика результатов и блок готовности — общие с кабинетом ученика:
// баллы и прогноз у репетитора и у ученика обязаны считаться одним правилом.
import { layoutOf, examTypeOf, toRow, synthesizeRows, computeStats, hwSolved, toHwRow, computeHwStats } from "../examStats"
import { useAttempts } from "../useAttempts"
import ExamProgress from "../components/ExamProgress"
import { smoothPath } from "../smoothPath"

// ─────────────────────────────────────────────────────────────────────────────
// Мелкие детали оформления
// ─────────────────────────────────────────────────────────────────────────────

// Мягкая заливка + кольцо вместо плотной плашки: иначе ряд чипов рябит.
const TONE = {
  blue:   "bg-blue-500/10 text-blue-600 dark:text-blue-300 ring-blue-500/20",
  green:  "bg-green-500/10 text-green-700 dark:text-green-300 ring-green-500/20",
  amber:  "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/25",
  red:    "bg-red-500/10 text-red-600 dark:text-red-300 ring-red-500/20",
  purple: "bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-purple-500/20",
  gray:   "text-gray-500 ring-gray-300/70 dark:ring-white/15",
}
// Классы сетки — картой, а не строкой: Tailwind сканирует исходник и класс,
// собранный из переменной, в сборку не попадёт.
const TILE_COLS = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" }
const LINE = { blue: "#007aff", green: "#34c759", amber: "#ff9f0a", red: "#ff3b30", purple: "#af52de", gray: "#9ca3af" }

// Дата работы короткой строкой: «12 авг». Без неё «лучший результат 12» не
// говорит, за какую именно работу он получен, — а это первое, что спрашивают.
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "")

function Chip({ tone = "gray", className = "", children }) {
  return (
    <span className={`inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${TONE[tone]} ${className}`}>
      {children}
    </span>
  )
}

// Порог тестового балла ЕГЭ: 73 — «отлично» у большинства вузов, 50 — рубеж
// проходного. Те же числа стоят в разборе работы.
function egeTone(testScore) {
  return testScore >= 73 ? "green" : testScore >= 50 ? "amber" : "red"
}

function shareTone(pct) {
  if (pct >= 75) return "green"
  if (pct >= 50) return "amber"
  return "red"
}

// Пилюля стоит в колонке шириной 74 px под последним баллом, поэтому она
// обязана быть короткой: словами «без изменений» она вылезала влево и
// наезжала на чип с оценкой. Знак «±0» читается так же и держится в колонке.
function DeltaPill({ delta }) {
  if (delta === null || delta === undefined) return null
  if (delta === 0) return <Chip tone="gray">±0</Chip>
  const up = delta > 0
  return (
    <Chip tone={up ? "green" : "red"}>
      <Icon name={up ? "trending-up" : "trending-down"} size={11} />
      {up ? "+" : "−"}{Math.abs(delta)}
    </Chip>
  )
}

function Avatar({ student, size = 40, tone = "blue" }) {
  const ring = tone === "purple" ? "ring-purple-500/25" : "ring-blue-500/25"
  const bg = tone === "purple" ? "bg-purple-500/10 text-purple-600 dark:text-purple-300" : "bg-blue-500/10 text-blue-600 dark:text-blue-300"
  return (
    <div
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center text-[13px] font-semibold ring-1 ${ring} ${bg}`}
    >
      {student.avatar
        ? <img src={student.avatar} alt="" className="w-full h-full object-cover" />
        : getInitials(student.name)}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Графика
// ─────────────────────────────────────────────────────────────────────────────

function Sparkline({ values, tone = "blue", width = 90, height = 32 }) {
  const uid = useId()
  if (!values.length) return null
  const pad = 4
  const color = LINE[tone] || LINE.blue
  // Шкала — по самим значениям с запасом сверху и снизу. От нуля разница
  // 9 → 14 на фоне максимума в 31 балл выглядела бы прямой линией.
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo
  const base = span > 0 ? lo - span * 0.3 : lo - 1
  const top = span > 0 ? hi + span * 0.3 : lo + 1
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0
  const pts = values.map((v, i) => ({
    x: pad + i * step + (values.length === 1 ? (width - pad * 2) / 2 : 0),
    y: height - pad - ((v - base) / (top - base)) * (height - pad * 2),
  }))
  const line = values.length > 1 ? smoothPath(pts) : ""
  const last = pts[pts.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      <defs>
        <linearGradient id={`sp${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {line && <path d={`${line} L${last.x},${height} L${pts[0].x},${height} Z`} fill={`url(#sp${uid})`} />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />}
      <circle cx={last.x} cy={last.y} r="3" fill={color} />
      <circle cx={last.x} cy={last.y} r="5.5" fill={color} opacity="0.18" />
    </svg>
  )
}

function TargetBar({ value, target, className = "" }) {
  const pct = Math.min((value / target) * 100, 100)
  const reached = value >= target
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between text-[11px] mb-1.5">
        <span className="text-gray-400">
          {reached ? "Цель достигнута" : `До цели ещё ${target - value} ${plural(target - value, "балл", "балла", "баллов")}`}
        </span>
        <span className="text-gray-500 font-medium tabular-nums">{value} / {target}</span>
      </div>
      <div className="h-1.5 rounded-full bg-blue-500/12 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: reached
              ? "linear-gradient(90deg,#34c759,#30d158)"
              : "linear-gradient(90deg,#007aff,#5ac8fa)",
          }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Сводные плитки
// ─────────────────────────────────────────────────────────────────────────────

function StatTile({ icon, label, value, sub, tone = "blue", suffix, active, onClick, className = "" }) {
  const shown = useCountUp(typeof value === "number" ? value : 0)
  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className={`w-7 h-7 rounded-xl grid place-items-center ring-1 ${TONE[tone]}`}>
          <Icon name={icon} size={14} />
        </span>
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2.5 text-[26px] leading-none font-semibold tabular-nums">
        {typeof value === "number" ? shown : value}
        {suffix && <span className="text-base font-medium text-gray-400 ml-0.5">{suffix}</span>}
      </div>
      {sub && <div className="mt-1.5 text-xs text-gray-400 truncate">{sub}</div>}
    </>
  )

  if (!onClick) return <div className={`stat-card ${className}`}>{body}</div>
  return (
    <button
      onClick={onClick}
      className={`press-fill stat-card text-left ${className} ${active ? "ring-2 ring-blue-500/40" : ""}`}
    >
      {body}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Разбор одной работы
// ─────────────────────────────────────────────────────────────────────────────

function VariantRow({ variant: v }) {
  const [expanded, setExpanded] = useState(false)
  const isTest = v.res.kind === "test"
  const L = layoutOf(v.type)
  const correctAnswers = v.answers?.part1 || []
  const studentAnswers = v.submission?.part1_answers || []
  const part2Detail = v.submission?.part2_score_detail || {}
  // У ЕГЭ вторая часть у каждого варианта своя (что собрали, то и проверяли) —
  // показываем только реально оценённые задания, иначе «0 из 4» появлялось бы
  // там, где задания просто не было.
  const part2Groups = L.part2.length && v.type !== "ОГЭ"
    ? L.part2.map((g) => ({ ...g, nums: g.nums.filter((n) => part2Detail[n] !== undefined) })).filter((g) => g.nums.length)
    : L.part2
  const scoreTone = isTest
    ? egeTone(v.testScore)
    : (v.grade >= 4 ? "green" : v.grade === 3 ? "amber" : "red")

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setExpanded(!expanded)}
        className="press-fill w-full grid grid-cols-[1.6fr_repeat(4,minmax(0,1fr))] gap-2 px-4 py-2.5 text-sm items-center text-left"
      >
        <span className="text-gray-700 truncate flex items-center gap-1.5 min-w-0">
          <Icon name="chevron-right" size={13} className={`text-gray-400 shrink-0 transition-transform duration-300 ${expanded ? "rotate-90" : ""}`} />
          <span className="truncate">{v.title}</span>
          {/* Без даты список работ не даёт понять, какая из них когда решалась. */}
          <span className="hidden sm:inline text-[11px] text-gray-400 shrink-0">{fmtDay(v.date)}</span>
        </span>
        <span className="text-gray-500 tabular-nums">{v.part1} / {L.part1Max}</span>
        <span className="text-gray-500 tabular-nums">{L.part2Total ? `${v.part2} / ${L.part2Total}` : "—"}</span>
        <span className="font-medium tabular-nums">{v.total} <span className="text-gray-400 font-normal">/ {v.max}</span></span>
        <span className="justify-self-start"><Chip tone={scoreTone}>{secondaryLabel(v.res, { short: true })}</Chip></span>
      </button>

      <Collapse open={expanded}>
        <div className="px-4 pb-4 pt-3 glass-table-header border-t border-white/30 flex flex-col gap-3">
          {L.part1.map((g) => (
            <div key={g.label}>
              <Chip tone={g.tone}>{g.label}</Chip>
              <div className="mt-2">
                <AnswerTable nums={g.nums} correct={correctAnswers} student={studentAnswers} credited={v.submission?.part1_credited} />
              </div>
            </div>
          ))}

          {part2Groups.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">Часть 2 — баллы за решение</div>
              {/* Один блок (ЕГЭ) раскладываем сами в две колонки: подпись
                  дублировала бы заголовок, а список в одну колонку оставлял
                  пустую половину строки. */}
              {part2Groups.length === 1 ? (
                <div className="grid sm:grid-cols-2 gap-x-6">
                  {part2Groups[0].nums.map((n) => (
                    <div key={n} className="flex justify-between text-xs py-1 border-b border-gray-100">
                      <span className="text-gray-500">Задание {n}</span>
                      <span className="font-medium tabular-nums">{part2Detail[n] || 0} / {L.part2Max[n]}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-x-6">
                  {part2Groups.map((g) => (
                    <div key={g.label}>
                      <div className="text-[11px] text-gray-400 mb-1">{g.label}</div>
                      {g.nums.map((n) => (
                        <div key={n} className="flex justify-between text-xs py-1 border-b border-gray-100">
                          <span className="text-gray-500">Задание {n}</span>
                          <span className="font-medium tabular-nums">{part2Detail[n] || 0} / {L.part2Max[n]}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Collapse>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Раскрытая карточка ученика
// ─────────────────────────────────────────────────────────────────────────────

// `taskMap` — готовая карта заданий: она стоит внутри дорожки вариантов, между
// плитками с баллами и таблицей работ. Элемент приходит готовым, а не собирается
// здесь: попытки читаются один раз на карточку (см. useAttempts), и второй
// запрос ради перестановки блока был бы платой ни за что.
function VariantsPane({ stats, taskMap = null }) {
  const { rows, last, avg, best, bestRow } = stats
  const isTest = last.res.kind === "test"
  const max = last.max
  const L = layoutOf(last.type)
  // При единственной работе «средний» и «лучший» — это она же. Три плитки с
  // одним и тем же числом читаются как поломка, поэтому их просто нет.
  const many = rows.length >= 2

  return (
    <div className="flex flex-col gap-3">
      <div className={`grid grid-cols-2 ${many ? "md:grid-cols-4" : "md:grid-cols-2"} gap-2.5`}>
        <div className="glass-sm p-3">
          <div className="text-[11px] text-gray-400">Последняя работа</div>
          <div className="text-xl font-semibold mt-1 tabular-nums">{last.total} <span className="text-sm font-normal text-gray-400">/ {max}</span></div>
          <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
            {isTest
              ? <Chip tone={egeTone(last.testScore)}>{secondaryLabel(last.res)}</Chip>
              : <Chip tone={last.grade >= 4 ? "green" : last.grade === 3 ? "amber" : "red"}>{secondaryLabel(last.res)}</Chip>}
            <span className="text-[11px] text-gray-400 truncate">{fmtDay(last.date)}</span>
          </div>
        </div>
        {many && (
          <div className="glass-sm p-3">
            <div className="text-[11px] text-gray-400">Средний балл</div>
            <div className="text-xl font-semibold mt-1 tabular-nums">{avg} <span className="text-sm font-normal text-gray-400">/ {max}</span></div>
            <div className="text-[11px] text-gray-400 mt-1.5">по {rows.length} {plural(rows.length, "работе", "работам", "работам")}</div>
          </div>
        )}
        {many && (
          <div className="glass-sm p-3">
            <div className="text-[11px] text-gray-400">Лучший результат</div>
            <div className="text-xl font-semibold mt-1 tabular-nums text-green-600 dark:text-green-400">{best} <span className="text-sm font-normal text-gray-400">/ {bestRow.max}</span></div>
            {/* «Лучший 12» без имени работы не отвечает на вопрос «за что» —
                поэтому рядом стоит сама работа и её дата. */}
            <div className="text-[11px] text-gray-400 mt-1.5 truncate">{bestRow.title} · {fmtDay(bestRow.date)}</div>
          </div>
        )}
        <div className="glass-sm p-3">
          <div className="text-[11px] text-gray-400">Последняя работа по частям</div>
          {/* Было «4 · 8» с подписью «из 19 и 12» — чтобы понять, что к чему,
              приходилось сопоставлять два ряда чисел. Теперь каждая часть
              названа и несёт свой максимум. */}
          <div className="mt-1.5 flex flex-col gap-1 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-gray-500">Часть 1</span>
              <span className="font-semibold tabular-nums">{last.part1} <span className="text-gray-400 font-normal">/ {L.part1Max}</span></span>
            </div>
            {L.part2Total > 0 && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-gray-500">Часть 2</span>
                <span className="font-semibold tabular-nums">{last.part2} <span className="text-gray-400 font-normal">/ {L.part2Total}</span></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Графика динамики здесь больше НЕТ. Он рисовал те же точки, что и
          «Готовность к экзамену», только без прогноза и без порога — два
          одинаковых графика на одном экране заставляли сличать их между собой.
          Остался один, с прогнозом; карта заданий занимает всю ширину. */}
      {taskMap}

      <div className="glass-sm overflow-hidden">
        <div className="grid grid-cols-[1.6fr_repeat(4,minmax(0,1fr))] gap-2 px-4 py-2 glass-table-header text-[11px] text-gray-500 font-medium">
          <span>Работа</span>
          <span>Часть 1</span>
          <span>Часть 2</span>
          <span>Первичный</span>
          <span>{isTest ? "Тестовый" : "Оценка"}</span>
        </div>
        {[...rows].reverse().map((v, i) => <VariantRow key={i} variant={v} />)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Разбор домашних работ
// ─────────────────────────────────────────────────────────────────────────────

// Чип статуса работы. У проверенной работы статус и есть оценка — «Выполнено»
// рядом с ней ничего не добавляет (тот же приём, что в разделе «Задания»).
function hwChip(r) {
  if (r.status === "submitted") return { tone: "amber", label: "На проверке" }
  if (r.status === "revision") return { tone: "red", label: "На доработке" }
  if (r.grade) return { tone: r.grade >= 4 ? "green" : r.grade === 3 ? "amber" : "red", label: `Оценка ${r.grade}` }
  if (r.status === "done") return { tone: "green", label: "Зачтено" }
  return { tone: "gray", label: "Решается" }
}

// Раскладка таблицы работ: на телефоне без столбца «Верно» (см. заголовок).
const HW_COLS_CLS = "grid-cols-[1.4fr_minmax(0,1fr)_auto] sm:grid-cols-[1.6fr_repeat(3,minmax(0,1fr))]"

function HomeworkRow({ row: r }) {
  const [expanded, setExpanded] = useState(false)
  const chip = hwChip(r)
  // Разбор есть только у работы с ответами: письменную смотрит репетитор, и
  // раскрывать в ней нечего.
  const canOpen = r.correct.length > 0
  // Номера в таблице — это порядок заданий в работе: и эталон, и ответы ученика
  // лежат массивами в этом же порядке.
  const nums = r.correct.map((_, i) => i + 1)

  return (
    <div className="border-t border-gray-100 dark:border-white/10">
      <button
        onClick={() => canOpen && setExpanded(!expanded)}
        className={`${canOpen ? "press-fill" : "cursor-default"} w-full grid ${HW_COLS_CLS} gap-2 px-4 py-2.5 text-sm items-center text-left`}
      >
        <span className="text-gray-700 truncate flex items-center gap-1.5 min-w-0">
          <Icon
            name="chevron-right" size={13}
            className={`shrink-0 transition-transform duration-300 ${canOpen ? "text-gray-400" : "text-transparent"} ${expanded ? "rotate-90" : ""}`}
          />
          <span className="truncate">{r.title}</span>
          <span className="hidden sm:inline text-[11px] text-gray-400 shrink-0">{fmtDay(r.date)}</span>
        </span>
        <span className="hidden sm:block text-gray-500 tabular-nums">{r.score === null ? "—" : `${r.score} / ${r.max}`}</span>
        <span className="font-medium tabular-nums">
          {r.percent === null ? "—" : `${r.percent}%`}
        </span>
        <span className="justify-self-start min-w-0"><Chip tone={chip.tone} className="whitespace-nowrap">{chip.label}</Chip></span>
      </button>

      <Collapse open={expanded}>
        <div className="px-4 pb-4 pt-3 glass-table-header border-t border-white/30">
          <AnswerTable nums={nums} correct={r.correct} student={r.given} credited={r.credited} />
        </div>
      </Collapse>
    </div>
  )
}

function HomeworkPane({ hw, noVariants }) {
  const { rows, last, avgPct, scoredCount, avgGrade, gradedCount, pending } = hw
  const lastChip = hwChip(last)
  // Плитки собираем списком: их от одной до четырёх, и нечётную последнюю на
  // телефоне надо растянуть на всю строку — иначе рядом остаётся пустая
  // половина (то же правило, что у плиток наверху страницы).
  const tiles = [
    {
      key: "last",
      label: "Последняя работа",
      value: last.percent !== null
        ? <>{last.percent}<span className="text-sm font-normal text-gray-400">% · {last.score} из {last.max}</span></>
        : last.grade ? `Оценка ${last.grade}` : <span className="text-base font-normal text-gray-400">Без автопроверки</span>,
      // Статус повторял бы оценку, уже стоящую крупно, поэтому у проверенной
      // работы под числом идёт её название, а чип остаётся для «На проверке».
      foot: (
        <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
          {(last.status === "submitted" || last.status === "revision") && <Chip tone={lastChip.tone}>{lastChip.label}</Chip>}
          <span className="text-[11px] text-gray-400 truncate">{last.title} · {fmtDay(last.date)}</span>
        </div>
      ),
    },
    scoredCount >= 2 && {
      key: "avg",
      label: "Верных ответов",
      value: <>{avgPct}<span className="text-sm font-normal text-gray-400">%</span></>,
      foot: <div className="text-[11px] text-gray-400 mt-1.5">в среднем по {scoredCount} {plural(scoredCount, "работе", "работам", "работам")}</div>,
    },
    gradedCount >= 2 && {
      key: "grade",
      label: "Средняя оценка",
      value: avgGrade,
      foot: <div className="text-[11px] text-gray-400 mt-1.5">по {gradedCount} {plural(gradedCount, "проверенной работе", "проверенным работам", "проверенным работам")}</div>,
    },
    pending > 0 && {
      key: "pending",
      label: "Ждут проверки",
      value: pending,
      foot: <div className="text-[11px] text-gray-400 mt-1.5">проверить — в разделе «Задания»</div>,
    },
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-3">
      {noVariants && (
        <div className="glass-sm p-3 text-xs text-gray-500">
          Баллов за варианты пока нет — ниже то, как ученик решает домашние работы.
          Первичный балл появится, когда он решит вариант и вы его проверите.
        </div>
      )}

      <div className={`grid ${tiles.length === 1 ? "grid-cols-1" : `grid-cols-2 ${TILE_COLS[tiles.length] || ""}`} gap-2.5`}>
        {tiles.map((t, i) => (
          <div
            key={t.key}
            className={`glass-sm p-3 ${tiles.length % 2 && i === tiles.length - 1 && tiles.length > 1 ? "col-span-2 md:col-span-1" : ""}`}
          >
            <div className="text-[11px] text-gray-400">{t.label}</div>
            <div className="text-xl font-semibold mt-1 tabular-nums">{t.value}</div>
            {t.foot}
          </div>
        ))}
      </div>

      {/* График по домашним работам не строим намеренно: их «процент верных»
          зависит от того, из чего собрана работа, и линия показывала бы разницу
          между работами, а не рост ученика. Для роста есть варианты. */}

      <div className="glass-sm overflow-hidden">
        <div className={`grid ${HW_COLS_CLS} gap-2 px-4 py-2 glass-table-header text-[11px] text-gray-500 font-medium`}>
          <span>Работа</span>
          {/* На телефоне «5 из 6» и «83%» — одно и то же дважды, и от них
              статусу не оставалось ширины: чип «Оценка 4» ломался на две
              строки. Поэтому там остаётся процент. */}
          <span className="hidden sm:block">Верно</span>
          <span>Процент</span>
          <span>Статус</span>
        </div>
        {[...rows].reverse().map((r) => <HomeworkRow key={r.id} row={r} />)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Раскрытая карточка: варианты и домашние работы — разными дорожками
// ─────────────────────────────────────────────────────────────────────────────

function StudentDetail({ student, stats, hw, tutorId }) {
  const attempts = useAttempts(student.id)
  const both = stats.hasData && hw.count > 0
  const [tab, setTab] = useState(stats.hasData ? "variants" : "homework")
  // Работы могли догрузиться уже после открытия карточки — вкладка, которой
  // больше нечего показать, не должна остаться выбранной.
  const shown = tab === "variants" && !stats.hasData ? "homework"
    : tab === "homework" && !hw.count ? "variants" : tab

  // Весь экзамен номерами: где ученик стоит по каждому заданию и что вы сами
  // написали к этому заданию. Разбор по типажам внутри номеров — соседний блок:
  // карта отвечает «как с одиннадцатым», WeakTypes — «каким именно одиннадцатым».
  const taskMap = (
    <TaskMap attempts={attempts} tutorId={tutorId} examType={examTypeOf(student, stats)} />
  )

  return (
    <div className="flex flex-col gap-3 px-3.5 pb-3.5 sm:px-4 sm:pb-4">
      {/* Готовность — первое, за чем сюда приходят: баллы по работам ниже
          отвечают «как было», а этот блок — «чем кончится». */}
      {stats.isExam && <ExamProgress student={student} stats={stats} attempts={attempts} />}

      {both && (
        <SegmentSwitch
          size="sm" equal={false} value={shown} onChange={setTab} ariaLabel="Какие работы показать"
          className="self-start"
          items={[
            { key: "variants", label: `Варианты · ${stats.rows.length}` },
            { key: "homework", label: `Домашние работы · ${hw.count}` },
          ]}
        />
      )}

      <div key={shown} className="slide-up">
        {shown === "variants"
          ? <VariantsPane stats={stats} taskMap={taskMap} />
          : <HomeworkPane hw={hw} noVariants={!stats.hasData} />}
      </div>

      {/* На дорожке домашних работ вариантов и графика нет, а карта нужна
          по-прежнему: там она стоит отдельным блоком, как стояла раньше. */}
      {shown !== "variants" && taskMap}

      {/* Общий балл говорит «72%», а репетитору нужно знать, КАКОЙ типаж
          проседает. Считается и по вариантам, и по работам из банка сразу,
          поэтому блок общий для обеих дорожек. */}
      <WeakTypes student={student} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Строка ученика в дашборде
// ─────────────────────────────────────────────────────────────────────────────

function StudentCard({ student, stats, hw, tutorId, open, onToggle }) {
  const perf = !stats.hasData && !stats.isExam
  const tone = perf ? "purple" : "blue"
  // Средний и лучший балл отсюда убраны намеренно: при одной работе строка
  // трижды повторяла одно число рядом с ним же справа. В свёрнутом виде важно
  // другое — сколько работ и насколько свежая последняя.
  // Варианты и домашние работы считаются по отдельности: «7 работ» без деления
  // обещало бы семь баллов за варианты, которых нет.
  const parts = []
  if (stats.hasData) parts.push(`${stats.rows.length} ${plural(stats.rows.length, "вариант", "варианта", "вариантов")}`)
  if (hw.count) parts.push(`${hw.count} ${plural(hw.count, "домашняя работа", "домашние работы", "домашних работ")}`)
  const lastDate = [stats.hasData ? stats.last.date : null, hw.count ? hw.last.date : null]
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0]
  const summary = parts.length
    ? `${parts.join(" · ")} · последняя ${fmtDay(lastDate)}`
    : "Решённых работ пока нет"

  return (
    <div className={`glass overflow-hidden transition-shadow ${open ? "shadow-lg" : ""}`}>
      <button onClick={onToggle} className="press-fill w-full text-left px-3.5 py-3 sm:px-4 sm:py-3.5">
        <div className="flex items-center gap-3 sm:gap-4">
          <Avatar student={student} tone={tone} />

          {/* Имя не должно ужиматься чипами до нуля — на узком экране оно
              пропадало целиком. Поэтому имя занимает всю строку и обрезается
              многоточием, а причина тревоги уходит во вторую строку. */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-[15px] font-medium truncate min-w-0">{student.name}</span>
              {/* На телефоне чип цели съедал у имени почти полсотни точек, и
                  «София Лебедева» превращалась в «София Лебе…». Поэтому там он
                  уходит во вторую строку, к остальным пометкам. */}
              {/* Прятать сам чип классом нельзя: у него в базовых классах уже есть
                  inline-flex, и display-утилиты конфликтуют. Поэтому видимостью
                  управляет обёртка. */}
              <span className="hidden sm:flex shrink-0 self-center">
                <Chip tone={perf ? "purple" : "blue"}>{student.goal || "Успеваемость"}</Chip>
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 min-w-0">
              <span className="flex sm:hidden shrink-0">
                <Chip tone={perf ? "purple" : "blue"}>{student.goal || "Успеваемость"}</Chip>
              </span>
              {stats.attention && (
                <Chip tone="red">
                  <Icon name="alert-triangle" size={11} />{stats.attention}
                </Chip>
              )}
              {/* Рядом с двумя чипами на телефоне от сводки оставался огрызок
                  («3.»), поэтому там она вынесена под шапку целой строкой. */}
              <span className="hidden sm:block text-xs text-gray-400 truncate min-w-0">{summary}</span>
            </div>
          </div>

          {/* Вариантов нет, а работы решались — в строке всё равно должно стоять
              число, иначе ученик выглядит как «ничего не делал». Процент верных
              подписан, чтобы его не приняли за первичный балл. */}
          {!stats.hasData && hw.count > 0 && (
            <div className="shrink-0 text-right w-[92px]">
              <div className="text-[22px] leading-none font-semibold tabular-nums">
                {hw.avgPct === null ? "—" : <>{hw.avgPct}<span className="text-xs font-normal text-gray-400">%</span></>}
              </div>
              <div className="mt-1.5 text-[11px] text-gray-400">верных в ДЗ</div>
            </div>
          )}

          {stats.hasData && (
            <>
              {/* По одной работе линия вырождается в точку — она ничего не
                  показывает и читается как случайная метка. */}
              {stats.rows.length >= 2 && (
                <div className="hidden sm:block shrink-0">
                  <Sparkline values={stats.rows.map((r) => r.total)} tone={stats.trendTone} />
                </div>
              )}
              <div className="hidden md:flex shrink-0">
                {stats.last.res.kind === "test"
                  ? <Chip tone={egeTone(stats.last.testScore)}>тест {secondaryLabel(stats.last.res, { short: true })}</Chip>
                  : <Chip tone={stats.last.grade >= 4 ? "green" : stats.last.grade === 3 ? "amber" : "red"}>{secondaryLabel(stats.last.res)}</Chip>}
              </div>
              <div className="shrink-0 text-right w-[88px]">
                {/* Голое «12» не говорит, из скольких. Максимум рядом — и балл
                    сразу читается без раскрытия карточки. */}
                <div className="text-[22px] leading-none font-semibold tabular-nums">
                  {stats.last.total}<span className="text-xs font-normal text-gray-400"> / {stats.last.max}</span>
                </div>
                <div className="mt-1.5 flex justify-end"><DeltaPill delta={stats.delta} /></div>
              </div>
            </>
          )}

          <span className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-gray-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
            <Icon name="chevron-down" size={16} />
          </span>
        </div>

        <div className="sm:hidden mt-2 text-xs text-gray-400 truncate">{summary}</div>

        {stats.hasData && stats.target > 0 && <TargetBar value={stats.last.total} target={stats.target} className="mt-3" />}
      </button>

      <Collapse open={open}>
        {stats.hasData || hw.count
          ? <StudentDetail student={student} stats={stats} hw={hw} tutorId={tutorId} />
          : (
            <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 flex flex-col gap-3">
              <div className="glass-sm p-4 text-sm text-gray-500">
                {stats.isExam
                  ? "Баллы появятся, как только ученик решит вариант и вы его проверите — раздел «Варианты», а решённые домашние работы попадут сюда отдельной дорожкой."
                  : "Ученик готовится не к экзамену, поэтому баллов за варианты нет. Здесь появятся его домашние работы и типы заданий, в которых он ошибается."}
              </div>
              <WeakTypes student={student} />
            </div>
          )}
      </Collapse>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Слабые темы по всем ученикам сразу
// ─────────────────────────────────────────────────────────────────────────────

// Порог показа: по одной-двум попыткам тема не «провальная», это просто
// неудачный день. Для сводки по группе порог выше, чем у отдельного ученика.
const COHORT_MIN_ATTEMPTS = 5
const COHORT_WEAK_ACCURACY = 70

function CohortWeakTypes({ studentIds }) {
  const [rows, setRows] = useState([])
  const labels = useTypeLabels(rows)
  const key = studentIds.join(",")

  useEffect(() => {
    const ids = key ? key.split(",") : []
    if (!ids.length) return
    let alive = true
    supabase
      .from("task_attempts")
      .select("student_id, exam_type, number, gen_key, is_correct, attempt_no")
      .in("student_id", ids)
      .limit(4000)
      // Таблицы может не быть (миграция task_attempts.sql не выполнена) — тогда блока просто нет.
      .then(({ data }) => {
        if (!alive || !data) return
        // Считаем по самим попыткам, а не по вьюхе v_student_weak_types: она
        // складывает все подходы, и «решай до верного» превращал исправленную
        // ошибку в две неудачи. Первые ответы — та же арифметика, что в
        // «Где ученик ошибается» и в отчёте родителю.
        const agg = {}
        for (const r of data) {
          if ((r.attempt_no ?? 1) > 1) continue
          const k = `${r.exam_type}|${r.number}|${r.gen_key || ""}`
          const cur = agg[k] || { exam_type: r.exam_type, number: r.number, gen_key: r.gen_key, attempts: 0, correct: 0, students: new Set() }
          cur.attempts += 1
          if (r.is_correct) cur.correct += 1
          cur.students.add(r.student_id)
          agg[k] = cur
        }
        const list = Object.values(agg)
          .filter((r) => r.attempts >= COHORT_MIN_ATTEMPTS)
          .map((r) => ({ ...r, students: r.students.size, accuracy: Math.round((r.correct / r.attempts) * 100) }))
          // Раздел называется «слабые»: тема, где почти не ошибаются, в нём
          // только отнимает место у настоящей проблемы.
          .filter((r) => r.accuracy < COHORT_WEAK_ACCURACY)
          .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
          .slice(0, 6)
        setRows(list)
      })
    return () => { alive = false }
  }, [key])

  if (!rows.length) return null

  return (
    <div className="glass p-4">
      <div className="flex items-baseline justify-between gap-3 mb-0.5">
        <h2 className="text-sm font-medium">Слабые темы по всем ученикам</h2>
        <span className="text-[11px] text-gray-400">от {COHORT_MIN_ATTEMPTS} попыток</span>
      </div>
      <p className="text-xs text-gray-400 mb-3">Где ошибаются чаще всего — с этого стоит начинать занятие.</p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const tone = shareTone(r.accuracy)
          return (
            <div key={`${r.exam_type}-${r.number}-${r.gen_key}`} className="flex items-center gap-3">
              <span className={`shrink-0 w-8 h-8 rounded-xl grid place-items-center text-xs font-semibold ring-1 ${TONE.blue}`}>
                {r.number}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm truncate">{labels[r.gen_key] || numberTitle(r.exam_type, r.number)}</span>
                  <span className="text-xs font-medium tabular-nums shrink-0" style={{ color: LINE[tone] }}>{r.accuracy}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-blue-500/12 overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.max(r.accuracy, 3)}%`, background: LINE[tone] }} />
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  {r.correct} из {r.attempts} верно · {r.students} {plural(r.students, "ученик", "ученика", "учеников")}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Данные
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Домашние работы
// ─────────────────────────────────────────────────────────────────────────────
// В результатах видно и решённые домашние работы, но отдельной дорожкой:
// складывать их с вариантами нельзя. У варианта первичный балл по шкале
// экзамена, у работы — доля верных ответов из скольких-то заданий; одно число
// на двоих не значило бы ничего, а динамика по нему прыгала бы от длины работы.
// Поэтому внутри карточки ученика стоит переключатель «Варианты / Домашние
// работы», а не общий список.


function Results({ students, loaded = true, user }) {
  const [variants, setVariants] = useState([])
  const [accounts, setAccounts] = useState([])
  const [homework, setHomework] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [group, setGroup] = useState("all")
  const [onlyAttention, setOnlyAttention] = useState(false)
  // Границу «последних 30 дней» фиксируем один раз за жизнь страницы: считать
  // её на каждом рендере — значит получать новое значение от перерисовки.
  const [monthAgo] = useState(() => Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Раньше данные догружались на каждый выбор ученика — и до выбора страница
  // была пустой. Дашборд обязан показывать всё сразу, поэтому запрос один.
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    // Домашние работы берём поимённо перечисленными колонками, а не «*»:
    // в строке лежат условия и приложения из банка (чертежи внутри data-URI),
    // и на весь список учеников это мегабайты, которые тут не нужны.
    const HW_COLS = "id, student_id, title, hw_type, status, grade, test_score, question_count, correct_answers, student_answers, created_at"
    const loadHw = async () => {
      const res = await supabase.from("homework").select(`${HW_COLS}, credited`).eq("tutor_id", user.id)
      // Колонки credited нет на базе без manual_credit.sql — работы всё равно
      // нужны, зачёт вручную там просто не с чего показывать.
      return res.error ? supabase.from("homework").select(HW_COLS).eq("tutor_id", user.id) : res
    }
    Promise.all([
      supabase.from("variants").select("*, variant_submissions(*)").eq("tutor_id", user.id),
      supabase.from("student_accounts").select("id, name").eq("tutor_id", user.id),
      loadHw(),
    ]).then(([v, a, h]) => {
      if (!alive) return
      setVariants(v.data || [])
      setAccounts(a.data || [])
      setHomework((h.data || []).filter(hwSolved).map(toHwRow))
      setLoading(false)
    })
    return () => { alive = false }
  }, [user?.id])

  const cards = useMemo(() => {
    // Связь карточки с аккаунтом — по student_account_id (App.jsx его уже
    // вычислил), имя остаётся запасным путём для старых записей без привязки.
    const idByName = {}
    for (const a of accounts) if (a.name) idByName[a.name.toLowerCase()] = a.id

    // Домашняя работа привязана к КАРТОЧКЕ ученика (students.id), а не к его
    // аккаунту, — поэтому раскладывается по ней напрямую.
    const hwByStudent = {}
    for (const r of homework) (hwByStudent[String(r.studentId)] ||= []).push(r)

    return students.map((s) => {
      const accId = s.studentAccountId || idByName[(s.name || "").toLowerCase()] || null
      let rows = accId
        ? variants.flatMap((v) =>
            (v.variant_submissions || [])
              .filter((sub) => sub.student_id === accId && sub.status === "graded")
              .map((sub) => toRow(v, sub, s.goal)))
        : []
      if (!rows.length && s.results?.length) rows = synthesizeRows(s)
      return {
        student: s,
        stats: computeStats(s, rows),
        hw: computeHwStats(hwByStudent[String(s.id)] || []),
      }
    })
  }, [students, variants, accounts, homework])

  // «Проверено работ» — варианты и решённые домашние вместе: обе дорожки
  // приводят человека на эту страницу, и ноль при десятке сданных работ читался
  // бы как поломка.
  const totalWorks = cards.reduce((n, c) => n + c.stats.rows.length + c.hw.count, 0)
  const withData = cards.filter((c) => c.stats.hasData)
  // «Требуют внимания» — плитка-фильтр, поэтому её число считается по той же
  // группе, что показывает список. Считая по всем ученикам, она обещала N
  // тревожных, а нажатие при выбранной группе (ОГЭ/ЕГЭ/Успеваемость) давало
  // «В этой группе учеников нет»: тревожные сидели в другой группе.
  const inGroup = (c) => group === "all" || (c.student.goal || "Успеваемость") === group
  const attentionCount = withData.filter((c) => inGroup(c) && c.stats.attention).length
  const withTarget = withData.filter((c) => c.stats.target > 0)
  const reachedCount = withTarget.filter((c) => c.stats.reachedTarget).length

  // Общего «среднего результата» здесь намеренно нет: одно число на всех
  // смешивает разных людей и разные экзамены (первичные баллы ОГЭ и ЕГЭ — по
  // разным шкалам) и ни к какому действию не ведёт. Вместо него — задание, на
  // котором спотыкаются чаще всего: это и есть ответ на «что подтянуть».
  const weakSpot = useMemo(() => {
    const acc = new Map()
    for (const c of cards) {
      for (const r of c.stats.rows) {
        const correct = r.answers?.part1 || []
        const given = r.submission?.part1_answers || []
        // Задание, засчитанное репетитором вручную, ошибкой не считается: там
        // ошибся эталон банка, а не ученик (supabase/manual_credit.sql).
        const byHand = new Set(Array.isArray(r.submission?.part1_credited) ? r.submission.part1_credited.map(Number) : [])
        for (const n of part1NumbersOf(r.type)) {
          const exp = correct[n - 1]
          // Задания без эталона в варианте (и старые записи без разбора)
          // пропускаем: по ним не видно, ошибся ученик или нет.
          if (exp === undefined || exp === null || String(exp).trim() === "") continue
          const key = `${r.type}|${n}`
          let cell = acc.get(key)
          if (!cell) acc.set(key, (cell = { type: r.type, n, works: 0, wrong: 0, students: new Set() }))
          cell.works++
          if (!byHand.has(n) && !answersEqual(given[n - 1] ?? "", exp)) {
            cell.wrong++
            cell.students.add(c.student.id)
          }
        }
      }
    }
    // Один промах в одной работе — случайность, а не слабое место. Считаем
    // проблемой номер, который встретился минимум дважды и провален чаще, чем
    // в половине работ. Номера разных экзаменов не смешиваем: №11 ОГЭ и №11 ЕГЭ —
    // разные темы.
    const list = [...acc.values()].filter((x) => x.works >= 2 && x.wrong * 2 > x.works)
    if (!list.length) return null
    list.sort((a, b) => (b.wrong / b.works) - (a.wrong / a.works) || b.wrong - a.wrong || a.n - b.n)
    const top = list[0]
    return { ...top, manyTypes: new Set([...acc.values()].map((x) => x.type)).size > 1 }
  }, [cards])

  const worksThisMonth = cards.reduce(
    (n, c) => n
      + c.stats.rows.filter((r) => new Date(r.date).getTime() >= monthAgo).length
      + c.hw.rows.filter((r) => new Date(r.date).getTime() >= monthAgo).length, 0)

  // Третья плитка подстраивается под то, что есть на руках. «Достигли цели»
  // без единой заданной цели — это ноль и подпись «цель никому не задана»:
  // числа нет, действия нет, место занято. Поэтому пока цели не выставлены,
  // на её месте стоит рост — сколько учеников написали последнюю работу лучше
  // предыдущей; а если сравнивать ещё не с чем, плитки нет вовсе.
  const withPrev = withData.filter((c) => c.stats.delta !== null)
  const grewCount = withPrev.filter((c) => c.stats.delta > 0).length
  const thirdTile = withTarget.length ? "target" : withPrev.length ? "growth" : null
  const tileCount = 2 + (weakSpot ? 1 : 0) + (thirdTile ? 1 : 0)

  const GROUPS = [
    { key: "all", label: "Все" },
    { key: "ОГЭ", label: "ОГЭ" },
    { key: "ЕГЭ", label: "ЕГЭ" },
    { key: "Успеваемость", label: "Успеваемость" },
  ].filter((g) => g.key === "all" || cards.some((c) => (c.student.goal || "Успеваемость") === g.key))

  const visible = cards
    .filter(inGroup)
    .filter((c) => !onlyAttention || c.stats.attention)
    // Сначала те, с кем есть проблема, затем сильные, затем без данных —
    // репетитор открывает страницу ради первой строки, а не ради алфавита.
    .sort((a, b) => {
      if (!!a.stats.attention !== !!b.stats.attention) return a.stats.attention ? -1 : 1
      if (a.stats.hasData !== b.stats.hasData) return a.stats.hasData ? -1 : 1
      if (a.stats.hasData && b.stats.hasData) return b.stats.pct - a.stats.pct
      // Без вариантов сравнивать по баллам нечего, но ученик с решёнными
      // домашними работами стоит выше того, у кого нет вообще ничего.
      if (!a.stats.hasData && (a.hw.count > 0) !== (b.hw.count > 0)) return a.hw.count ? -1 : 1
      return (a.student.name || "").localeCompare(b.student.name || "", "ru")
    })

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-medium page-title">Результаты</h1>
        <p className="text-[15px] page-subtitle mt-0.5">
          Баллы за варианты, домашние работы и слабые типы заданий — видно, кого и что подтянуть к экзамену.
        </p>
      </div>

      {/* Пока список учеников не пришёл, «Учеников пока нет» — неправда:
          показываем те же карточки-заготовки, что и при загрузке работ. */}
      {loading || !loaded ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-[74px] animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="glass p-8 text-center">
          <span className={`w-12 h-12 mx-auto rounded-2xl grid place-items-center ring-1 ${TONE.blue}`}>
            <Icon name="bar-chart" size={22} />
          </span>
          <div className="text-sm font-medium mt-3">Учеников пока нет</div>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
            Результаты появятся здесь, как только ученик привяжется к вам и решит первый вариант.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {totalWorks > 0 && (
            <div className={`grid grid-cols-2 ${TILE_COLS[tileCount]} gap-2.5 sm:gap-3`}>
              <StatTile
                icon="file-text" tone="blue" label="Проверено работ" value={totalWorks}
                sub={worksThisMonth ? `${worksThisMonth} за последние 30 дней` : "за 30 дней — ни одной"}
              />
              {weakSpot && (
                <StatTile
                  icon="book" tone="amber"
                  label={weakSpot.manyTypes ? `Слабое место · ${weakSpot.type}` : "Слабое место"}
                  value={`№${weakSpot.n}`}
                  sub={`${numberTitle(weakSpot.type, weakSpot.n)} — ошибок ${weakSpot.wrong} из ${weakSpot.works}`}
                />
              )}
              {thirdTile === "target" && (
                <StatTile
                  icon="target" tone="green" label="Достигли цели" value={reachedCount}
                  suffix={` из ${withTarget.length}`}
                  sub="цель — в карточке ученика"
                />
              )}
              {thirdTile === "growth" && (
                <StatTile
                  icon="trending-up" tone={grewCount ? "green" : "gray"} label="Прибавили в баллах"
                  value={grewCount}
                  suffix={` из ${withPrev.length}`}
                  sub={grewCount ? "последняя работа лучше предыдущей" : "лучше предыдущей не написал никто"}
                />
              )}
              {/* Нечётную плитку на телефоне растягиваем на всю строку: иначе
                  рядом с ней остаётся пустая половина. */}
              <StatTile
                icon="alert-triangle" tone={attentionCount ? "red" : "gray"} label="Требуют внимания"
                value={attentionCount}
                className={tileCount % 2 ? "col-span-2 md:col-span-1" : ""}
                sub={attentionCount ? (onlyAttention ? "показаны только они" : "показать только их") : "спадов и провалов нет"}
                active={onlyAttention}
                onClick={attentionCount ? () => setOnlyAttention((v) => !v) : undefined}
              />
            </div>
          )}

          {totalWorks === 0 && (
            <div className="glass p-6 flex items-start gap-4">
              <span className={`shrink-0 w-11 h-11 rounded-2xl grid place-items-center ring-1 ${TONE.blue}`}>
                <Icon name="sparkles" size={20} />
              </span>
              <div>
                <div className="text-sm font-medium">Проверенных работ пока нет</div>
                <p className="text-sm text-gray-400 mt-1">
                  Баллы и динамику между пробниками дают проверенные варианты, а рядом с ними отдельной
                  дорожкой идут решённые домашние работы. Выдайте ученику вариант или задание — и результат
                  появится здесь.
                </p>
              </div>
            </div>
          )}

          {/* Строка фильтров нужна и тогда, когда групп меньше двух: иначе
              вместе с ней пропадал бы выход из режима «только тревожные». */}
          {(GROUPS.length > 2 || onlyAttention) && (
            <div className="flex items-center gap-3 flex-wrap">
              {GROUPS.length > 2 && (
                <SegmentSwitch
                  size="sm" equal={false} items={GROUPS} value={group} onChange={setGroup} ariaLabel="Фильтр по цели"
                />
              )}
              {onlyAttention && (
                <button onClick={() => setOnlyAttention(false)} className="press-fill text-xs text-blue-600 px-2 py-1 rounded-lg">
                  Показать всех
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {visible.map(({ student, stats, hw }) => (
              <StudentCard
                key={student.id}
                student={student}
                stats={stats}
                hw={hw}
                tutorId={user?.id}
                open={openId === student.id}
                onToggle={() => setOpenId(openId === student.id ? null : student.id)}
              />
            ))}
            {visible.length === 0 && (
              <div className="glass p-6 text-sm text-gray-400 text-center">
                В этой группе учеников нет.
              </div>
            )}
          </div>

          <CohortWeakTypes studentIds={students.map((s) => String(s.id))} />
        </div>
      )}
    </div>
  )
}

// Раздел под тарифом. Гейт стоит ОБЁРТКОЙ, а не условным return внутри
// Results: иначе половина хуков компонента переставала бы вызываться и React
// ругался бы на разное их число между рендерами.
function ResultsGate(props) {
  const { allows } = usePlan()
  if (allows("analytics")) return <Results {...props} />
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-medium page-title mb-1">Результаты</h1>
      <p className="text-[15px] page-subtitle mb-5">
        Баллы за пробники, динамика и типы заданий, которые чаще всего не выходят.
      </p>
      <PlanLock
        feature="analytics"
        title="Результаты и аналитика"
        text="Графики баллов по каждому ученику, прогресс между пробниками и разбор слабых типов заданий."
      />
    </div>
  )
}

export default ResultsGate
