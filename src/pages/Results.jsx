import { useEffect, useId, useMemo, useState } from "react"
import { supabase } from "../supabase"
import Icon from "../components/Icon"
import WeakTypes from "../components/WeakTypes"
import Collapse from "../components/Collapse"
import SegmentSwitch from "../components/SegmentSwitch"
import useCountUp from "../components/useCountUp"
import useTypeLabels from "../components/typeLabels"
import { plural, getInitials } from "../utils"
import { PlanLock } from "../components/PlanLock"
import { usePlan } from "../subscription"
import { part1NumbersOf, part2NumbersOf } from "./taskBankMeta"
import { numberTitle } from "./numberTitles"
import { scaleOf, part2MaxOf, variantMaxPrimary, examResult, secondaryLabel, testScoreOf } from "../examScales"

// ─────────────────────────────────────────────────────────────────────────────
// Шкалы экзаменов
// ─────────────────────────────────────────────────────────────────────────────
// Перевод первичного балла во вторичный (тестовый балл ЕГЭ или отметку) живёт
// в src/examScales.js — одном файле на всё приложение. Здесь остаётся только
// разметка разбора работы.

// Разбор работы по заданиям строится по составу самого экзамена: номера части 1
// берём из банка (в информатике они идут не подряд), баллы части 2 — из шкалы.
// Раньше здесь лежали две жёстких разметки, ОГЭ и «ЕГЭ», и информатика рисовалась
// по чужой: показывались несуществующие задания 13–19 и деление на геометрию.
const gridCols = (n) => (n <= 5 ? "grid-cols-5" : n <= 12 ? "grid-cols-6" : "grid-cols-7")

function buildLayout(type) {
  const p1 = part1NumbersOf(type)
  const geomNums = scaleOf(type)?.geometryNumbers || []
  const p1Geom = p1.filter((n) => geomNums.includes(n))
  // Деление «алгебра / геометрия» есть только у ОГЭ по математике.
  const part1 = p1Geom.length
    ? [
        { label: `Алгебра — задания ${p1[0]}–${p1Geom[0] - 1}`, nums: p1.filter((n) => !geomNums.includes(n)), tone: "blue", cols: "grid-cols-7" },
        { label: `Геометрия — задания ${p1Geom[0]}–${p1Geom[p1Geom.length - 1]}`, nums: p1Geom, tone: "purple", cols: "grid-cols-5" },
      ]
    : [{ label: `Часть 1 — ${p1.length} ${plural(p1.length, "задание", "задания", "заданий")}`, nums: p1, tone: "blue", cols: gridCols(p1.length) }]

  const part2Max = part2MaxOf(type)
  // Номера части 2 берём из состава ВАРИАНТА, а баллы — из шкалы экзамена.
  // Обратный порядок рисовал бы клетки под задания, которых в варианте нет
  // (у профиля в банке пока нет №14 и №17).
  const p2 = part2NumbersOf(type).filter((n) => part2Max[n])
  const part2 = !p2.length ? []
    : geomNums.length
      ? [
          { label: "Алгебра", nums: p2.filter((n) => !geomNums.includes(n)) },
          { label: "Геометрия", nums: p2.filter((n) => geomNums.includes(n)) },
        ]
      : [{ label: "Часть 2", nums: p2 }]

  return { part1, part2, part2Max, part1Max: p1.length, part2Total: p2.reduce((s, n) => s + part2Max[n], 0) }
}

const LAYOUTS = {}
const layoutOf = (type) => (LAYOUTS[type] ||= buildLayout(type))

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

// Доля от максимума — единственная величина, сопоставимая между ОГЭ и ЕГЭ:
// первичные баллы у них по разным шкалам. Считается от максимума ВАРИАНТА:
// в него входит не весь экзамен, и делить на экзаменационный максимум значило
// бы занижать всех подряд.
function share(row) {
  return row.max ? Math.round((row.total / row.max) * 100) : 0
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

// Catmull-Rom → кубические Безье: ломаная из 3–4 точек выглядит рвано, а
// сглаженная читается как динамика.
function smoothPath(pts) {
  if (pts.length < 2) return ""
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6}` +
         ` ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6}` +
         ` ${p2.x},${p2.y}`
  }
  return d
}

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

// Большой график динамики. Значения подписаны прямо над точками: работ у
// ученика единицы, и подпись честнее всплывающей подсказки — видно сразу всё.
function ScoreChart({ rows, max, target }) {
  const uid = useId()
  const W = 660, H = 230
  const padX = 22, padTop = 34, padBottom = 30
  const step = rows.length > 1 ? (W - padX * 2) / (rows.length - 1) : 0
  const y = (v) => padTop + (1 - Math.max(0, Math.min(v / max, 1))) * (H - padTop - padBottom)
  const pts = rows.map((r, i) => ({
    x: padX + i * step + (rows.length === 1 ? (W - padX * 2) / 2 : 0),
    y: y(r.total),
    row: r,
  }))
  const line = smoothPath(pts)
  const everyNth = rows.length > 6 ? Math.ceil(rows.length / 5) : 1

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Динамика первичных баллов">
      <defs>
        <linearGradient id={`ch${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#007aff" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#007aff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={padX} x2={W - padX} y1={y(max * f)} y2={y(max * f)}
          stroke="currentColor" strokeOpacity="0.09" strokeWidth="1" className="text-gray-500" />
      ))}

      {/* Подпись линии цели вынесена в заголовок карточки: у правого края она
          налезала на значение последней работы. */}
      {target > 0 && target <= max && (
        <line x1={padX} x2={W - padX} y1={y(target)} y2={y(target)}
          stroke="#34c759" strokeWidth="1.4" strokeDasharray="5 5" opacity="0.7" />
      )}

      {rows.length > 1 && <path d={`${line} L${pts[pts.length - 1].x},${H - padBottom} L${pts[0].x},${H - padBottom} Z`} fill={`url(#ch${uid})`} />}
      {rows.length > 1 && <path d={line} fill="none" stroke="#007aff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}

      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="5.5" fill="#ffffff" stroke="#007aff" strokeWidth="2.4" />
          <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" className="text-gray-800">
            {p.row.total}
          </text>
          {(i % everyNth === 0 || i === pts.length - 1) && (
            <text x={p.x} y={H - 9} textAnchor="middle" fontSize="11" fill="currentColor" className="text-gray-400">
              {new Date(p.row.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
            </text>
          )}
        </g>
      ))}
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

function StatTile({ icon, label, value, sub, tone = "blue", suffix, active, onClick }) {
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

  if (!onClick) return <div className="stat-card">{body}</div>
  return (
    <button
      onClick={onClick}
      className={`press-fill stat-card text-left ${active ? "ring-2 ring-blue-500/40" : ""}`}
    >
      {body}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Разбор одной работы
// ─────────────────────────────────────────────────────────────────────────────

function AnswerCell({ n, correct, student }) {
  const has = student !== undefined && student !== null && String(student).trim() !== ""
  const isRight = has && correct && String(correct).trim() === String(student).trim()
  const isWrong = has && correct && !isRight
  return (
    <div className={`text-center rounded-xl py-1.5 px-1 ring-1 ${
      isRight ? "bg-green-500/10 text-green-700 dark:text-green-300 ring-green-500/20" :
      isWrong ? "bg-red-500/10 text-red-600 dark:text-red-300 ring-red-500/20" :
      "text-gray-400 ring-gray-300/70 dark:ring-white/15"
    }`}>
      <div className="text-[10px] text-gray-400 leading-tight">{n}</div>
      <div className="text-xs font-medium truncate">{has ? student : "—"}</div>
      {isWrong && <div className="text-[9px] text-green-600 dark:text-green-400 truncate">{correct}</div>}
    </div>
  )
}

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
              <div className={`grid ${g.cols} gap-1 mt-2`}>
                {g.nums.map((n) => (
                  <AnswerCell key={n} n={n} correct={correctAnswers[n - 1]} student={studentAnswers[n - 1]} />
                ))}
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

function StudentDetail({ student, stats }) {
  const { rows, last, avg, best, bestRow, target } = stats
  const isTest = last.res.kind === "test"
  const max = last.max
  const L = layoutOf(last.type)
  // При единственной работе «средний» и «лучший» — это она же. Три плитки с
  // одним и тем же числом читаются как поломка, поэтому их просто нет.
  const many = rows.length >= 2

  return (
    <div className="flex flex-col gap-3 px-3.5 pb-3.5 sm:px-4 sm:pb-4">
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

      {rows.length >= 2 && (
        <div className="glass-sm p-3.5">
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-sm font-medium">Динамика первичных баллов</span>
            <span className="flex items-center gap-3 text-[11px] text-gray-400">
              {target > 0 && (
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <svg width="16" height="2" aria-hidden="true"><line x1="0" y1="1" x2="16" y2="1" stroke="#34c759" strokeWidth="2" strokeDasharray="4 3" /></svg>
                  цель {target}
                </span>
              )}
              <span>максимум {max}</span>
            </span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              <ScoreChart rows={rows} max={max} target={target || 0} />
            </div>
          </div>
        </div>
      )}

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

      {/* Общий балл говорит «72%», а репетитору нужно знать, КАКОЙ типаж проседает. */}
      <WeakTypes studentId={student.id} studentName={student.name} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Строка ученика в дашборде
// ─────────────────────────────────────────────────────────────────────────────

function StudentCard({ student, stats, open, onToggle }) {
  const perf = !stats.hasData && !stats.isExam
  const tone = perf ? "purple" : "blue"
  // Средний и лучший балл отсюда убраны намеренно: при одной работе строка
  // трижды повторяла одно число рядом с ним же справа. В свёрнутом виде важно
  // другое — сколько работ и насколько свежая последняя.
  const summary = stats.hasData
    ? `${stats.rows.length} ${plural(stats.rows.length, "работа", "работы", "работ")} · последняя ${fmtDay(stats.last.date)}`
    : "Проверенных работ пока нет"

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
        {stats.hasData
          ? <StudentDetail student={student} stats={stats} />
          : (
            <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 flex flex-col gap-3">
              <div className="glass-sm p-4 text-sm text-gray-500">
                {stats.isExam
                  ? "Здесь появятся баллы, как только ученик решит вариант и вы его проверите — раздел «Варианты»."
                  : "Ученик готовится не к экзамену, поэтому баллов за варианты нет. Ниже — типы заданий из домашних работ и тренировок, если они уже решались."}
              </div>
              <WeakTypes studentId={student.id} studentName={student.name} />
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
      .from("v_student_weak_types")
      .select("*")
      .in("student_id", ids)
      .limit(500)
      // Вьюхи может не быть (миграция task_attempts.sql не выполнена) — тогда блока просто нет.
      .then(({ data }) => {
        if (!alive || !data) return
        // PostgREST отдаёт numeric и count строками — приводим сами, иначе
        // сложение попыток склеило бы «12» и «7» в «127».
        const agg = {}
        for (const r of data) {
          const k = `${r.exam_type}|${r.number}|${r.gen_key || ""}`
          const cur = agg[k] || { exam_type: r.exam_type, number: r.number, gen_key: r.gen_key, attempts: 0, correct: 0, students: 0 }
          cur.attempts += Number(r.attempts)
          cur.correct += Number(r.correct)
          cur.students += 1
          agg[k] = cur
        }
        const list = Object.values(agg)
          .filter((r) => r.attempts >= COHORT_MIN_ATTEMPTS)
          .map((r) => ({ ...r, accuracy: Math.round((r.correct / r.attempts) * 100) }))
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

function toRow(variant, submission, fallbackType) {
  const type = variant.type || fallbackType || "ОГЭ"
  const L = layoutOf(type)
  const total = submission.total_score || 0
  // Задания части 2, реально вошедшие в вариант: у ЕГЭ их состав свой у каждой
  // работы, поэтому максимум считается по снимку, а не по всему экзамену.
  const p2 = [...new Set((variant.tasks_snapshot || []).map((t) => t.number).filter((n) => L.part2Max[n]))]
  const p2Nums = p2.length ? p2 : Object.keys(L.part2Max).map(Number)
  const max = variantMaxPrimary(type, [...part1NumbersOf(type), ...p2Nums])
  // geom_score хранит либо баллы за геометрию (ОГЭ по математике), либо
  // тестовый балл — как это записала форма проверки. Как геометрию читаем
  // только там, где геометрия вообще есть.
  const geomNums = scaleOf(type)?.geometryNumbers
  const res = examResult(type, total, {
    geometry: geomNums ? (submission.geom_score ?? null) : null,
    variantMax: max,
  })
  return {
    title: variant.title,
    type,
    date: variant.created_at,
    total,
    max,
    part1: submission.part1_score || 0,
    part2: submission.part2_score || 0,
    res,
    grade: res.grade,
    testScore: res.testScore,
    answers: variant.answers,
    submission,
  }
}

// Наследие: у части карточек баллы лежат простым массивом students.results[].
// Разбивку по частям такая запись не хранит, поэтому раскладываем по типовой
// пропорции — это оценка, а не данные проверки.
function synthesizeRows(student) {
  // Старые записи не помнят предмет: у цели «ЕГЭ» считаем профильную математику —
  // единственный ЕГЭ, по которому эти баллы и выставляли.
  const isEge = student.goal === "ЕГЭ"
  const legacyType = isEge ? "ЕГЭ Профиль" : "ОГЭ"
  const now = Date.now()
  return student.results.map((total, i) => {
    const part1 = isEge ? Math.min(12, Math.round(total * 0.45)) : Math.min(19, Math.round(total * 0.68))
    const geomOrTest = isEge ? testScoreOf("ЕГЭ Профиль", total) : Math.max(2, Math.round(total * 0.22))
    return toRow(
      {
        title: `Вариант ${i + 1}`,
        type: legacyType,
        created_at: new Date(now - (student.results.length - i) * 14 * 24 * 60 * 60 * 1000).toISOString(),
        answers: { part1: [] },
      },
      {
        status: "graded",
        total_score: total,
        part1_score: part1,
        part2_score: Math.max(0, total - part1),
        geom_score: geomOrTest,
        part1_answers: [],
        part2_score_detail: {},
      },
      legacyType,
    )
  })
}

function computeStats(student, rows) {
  const isExam = student.goal === "ОГЭ" || student.goal === "ЕГЭ"
  if (!rows.length) return { hasData: false, isExam, rows: [] }

  const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date))
  const last = sorted[sorted.length - 1]
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null
  const delta = prev ? last.total - prev.total : null
  const pct = share(last)
  const target = student.targetScore || 0
  const bestRow = sorted.reduce((a, b) => (b.total > a.total ? b : a), sorted[0])

  // Что считать тревогой. Порядок важен: двойка перевешивает спад, спад —
  // просто низкий балл. Показываем ОДНУ причину, самую весомую.
  let attention = null
  if (last.grade === 2) attention = "ниже тройки"
  else if (delta !== null && delta < 0) attention = `спад на ${Math.abs(delta)}`
  else if (pct < 50) attention = "меньше половины"

  return {
    hasData: true,
    isExam,
    rows: sorted,
    last,
    delta,
    pct,
    target,
    attention,
    avg: Math.round(sorted.reduce((s, v) => s + v.total, 0) / sorted.length),
    best: bestRow.total,
    bestRow,
    trendTone: delta === null || delta === 0 ? "blue" : delta > 0 ? "green" : "red",
    reachedTarget: target ? last.total >= target : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function Results({ students, user }) {
  const [variants, setVariants] = useState([])
  const [accounts, setAccounts] = useState([])
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
    Promise.all([
      supabase.from("variants").select("*, variant_submissions(*)").eq("tutor_id", user.id),
      supabase.from("student_accounts").select("id, name").eq("tutor_id", user.id),
    ]).then(([v, a]) => {
      if (!alive) return
      setVariants(v.data || [])
      setAccounts(a.data || [])
      setLoading(false)
    })
    return () => { alive = false }
  }, [user?.id])

  const cards = useMemo(() => {
    // Связь карточки с аккаунтом — по student_account_id (App.jsx его уже
    // вычислил), имя остаётся запасным путём для старых записей без привязки.
    const idByName = {}
    for (const a of accounts) if (a.name) idByName[a.name.toLowerCase()] = a.id

    return students.map((s) => {
      const accId = s.studentAccountId || idByName[(s.name || "").toLowerCase()] || null
      let rows = accId
        ? variants.flatMap((v) =>
            (v.variant_submissions || [])
              .filter((sub) => sub.student_id === accId && sub.status === "graded")
              .map((sub) => toRow(v, sub, s.goal)))
        : []
      if (!rows.length && s.results?.length) rows = synthesizeRows(s)
      return { student: s, stats: computeStats(s, rows) }
    })
  }, [students, variants, accounts])

  const totalWorks = cards.reduce((n, c) => n + c.stats.rows.length, 0)
  const withData = cards.filter((c) => c.stats.hasData)
  const attentionCount = withData.filter((c) => c.stats.attention).length
  const withTarget = withData.filter((c) => c.stats.target > 0)
  const reachedCount = withTarget.filter((c) => c.stats.reachedTarget).length

  // Средний результат — в процентах от максимума: первичные баллы ОГЭ и ЕГЭ
  // по разным шкалам, и их среднее арифметическое ничего не значило бы.
  const avgShare = withData.length
    ? Math.round(withData.reduce((s, c) => s + c.stats.pct, 0) / withData.length)
    : 0
  const prevShare = (() => {
    const arr = withData.filter((c) => c.stats.rows.length > 1)
    if (!arr.length) return null
    return Math.round(arr.reduce((s, c) => {
      const prev = c.stats.rows[c.stats.rows.length - 2]
      return s + share(prev)
    }, 0) / arr.length)
  })()
  const shareDelta = prevShare === null ? null : avgShare - prevShare

  const worksThisMonth = cards.reduce(
    (n, c) => n + c.stats.rows.filter((r) => new Date(r.date).getTime() >= monthAgo).length, 0)

  const GROUPS = [
    { key: "all", label: "Все" },
    { key: "ОГЭ", label: "ОГЭ" },
    { key: "ЕГЭ", label: "ЕГЭ" },
    { key: "Успеваемость", label: "Успеваемость" },
  ].filter((g) => g.key === "all" || cards.some((c) => (c.student.goal || "Успеваемость") === g.key))

  const visible = cards
    .filter((c) => group === "all" || (c.student.goal || "Успеваемость") === group)
    .filter((c) => !onlyAttention || c.stats.attention)
    // Сначала те, с кем есть проблема, затем сильные, затем без данных —
    // репетитор открывает страницу ради первой строки, а не ради алфавита.
    .sort((a, b) => {
      if (!!a.stats.attention !== !!b.stats.attention) return a.stats.attention ? -1 : 1
      if (a.stats.hasData !== b.stats.hasData) return a.stats.hasData ? -1 : 1
      if (a.stats.hasData && b.stats.hasData) return b.stats.pct - a.stats.pct
      return (a.student.name || "").localeCompare(b.student.name || "", "ru")
    })

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-medium">Результаты</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Баллы за варианты, динамика и слабые типы заданий — видно, кого и что подтянуть к экзамену.
        </p>
      </div>

      {loading ? (
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              <StatTile
                icon="file-text" tone="blue" label="Проверено работ" value={totalWorks}
                sub={worksThisMonth ? `${worksThisMonth} за последние 30 дней` : "за 30 дней — ни одной"}
              />
              <StatTile
                icon="bar-chart" tone={shareTone(avgShare)} label="Средний результат" value={avgShare} suffix="%"
                sub={shareDelta === null
                  ? "по последним работам"
                  : `${shareDelta > 0 ? "+" : shareDelta < 0 ? "−" : "±"}${Math.abs(shareDelta)} п.п. к предыдущим`}
              />
              <StatTile
                icon="target" tone="green" label="Достигли цели" value={reachedCount}
                suffix={withTarget.length ? ` из ${withTarget.length}` : ""}
                sub={withTarget.length ? "цель — в карточке ученика" : "цель никому не задана"}
              />
              <StatTile
                icon="alert-triangle" tone={attentionCount ? "red" : "gray"} label="Требуют внимания"
                value={attentionCount}
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
                  Соберите вариант в разделе «Варианты» и выдайте его ученику. Как только вы проверите работу,
                  здесь появятся баллы, динамика между пробниками и разбор слабых типов заданий.
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
            {visible.map(({ student, stats }) => (
              <StudentCard
                key={student.id}
                student={student}
                stats={stats}
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
      <h1 className="text-xl font-medium mb-1">Результаты</h1>
      <p className="text-sm text-gray-500 mb-5">
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
