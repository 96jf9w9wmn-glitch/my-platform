// Чертежи и живые визуализации для интерактивной практики.
// Данные уроков — в practiceCourses.jsx, движок — в Practice.jsx.
// Все размеры заданы в юнитах viewBox, цвета — либо currentColor (следует
// теме), либо системные акценты iOS.

import { fmtNum as fmt } from "../utils"

const AX = "#007AFF"

// ── общие детали чертежей ───────────────────────────────────────────────

// Координатная сетка с осями. vw — половина ширины видимой области в юнитах.
function Grid({ vw = 6, vh = 6 }) {
  const ticks = []
  for (let i = -vw; i <= vw; i++) {
    ticks.push(<line key={`v${i}`} x1={i} y1={-vh} x2={i} y2={vh} stroke="currentColor" strokeWidth="0.03" />)
  }
  for (let i = -vh; i <= vh; i++) {
    ticks.push(<line key={`h${i}`} x1={-vw} y1={i} x2={vw} y2={i} stroke="currentColor" strokeWidth="0.03" />)
  }
  return (
    <>
      <g className="text-gray-300 dark:text-white/15">{ticks}</g>
      <g className="text-gray-400 dark:text-white/40">
        <line x1={-vw} y1="0" x2={vw} y2="0" stroke="currentColor" strokeWidth="0.06" />
        <line x1="0" y1={-vh} x2="0" y2={vh} stroke="currentColor" strokeWidth="0.06" />
      </g>
    </>
  )
}

// Прямая y = kx + b внутри окна [-vw..vw] × [-vh..vh], обрезанная по рамке.
function LineGraph({ k, b, vw = 6, vh = 6, color = AX }) {
  const pts = []
  const step = 0.05
  for (let x = -vw; x <= vw + 1e-9; x += step) {
    const y = k * x + b
    if (y >= -vh && y <= vh) pts.push(`${x.toFixed(3)},${(-y).toFixed(3)}`)
    else if (pts.length) { pts.push(null); }
  }
  // разрыв на выходе за рамку — рисуем несколько полилиний
  const chunks = []
  let cur = []
  for (const p of pts) {
    if (p === null) { if (cur.length > 1) chunks.push(cur); cur = [] }
    else cur.push(p)
  }
  if (cur.length > 1) chunks.push(cur)
  return (
    <>
      {chunks.map((c, i) => (
        <polyline key={i} points={c.join(" ")} fill="none" stroke={color} strokeWidth="0.12" strokeLinecap="round" />
      ))}
    </>
  )
}

// Подпись числом на графике (SVG-текст масштабируется вместе с viewBox,
// поэтому размер задаём в юнитах).
function Tag({ x, y, children, color = "currentColor", anchor = "middle" }) {
  return (
    <text x={x} y={y} fontSize="0.5" fill={color} textAnchor={anchor} dominantBaseline="middle"
      style={{ fontWeight: 600 }}>{children}</text>
  )
}

// ── визуализации курсов ─────────────────────────────────────────────────

export function LinearVisual({ vals, mark }) {
  const k = vals?.k ?? 1
  const b = vals?.b ?? 0
  return (
    <svg viewBox="-6.6 -6.6 13.2 13.2" className="w-full h-full">
      <Grid />
      <LineGraph k={k} b={b} />
      {mark && <circle cx={mark[0]} cy={-mark[1]} r="0.2" fill="#ff9f0a" />}
      {mark && <Tag x={mark[0] + 0.9} y={-mark[1] - 0.55} color="#ff9f0a">({fmt(mark[0])}; {fmt(mark[1])})</Tag>}
      <circle cx="0" cy={-b} r="0.16" fill={AX} />
      <g className="text-gray-400 dark:text-white/40">
        <Tag x="6.1" y="0.45">x</Tag>
        <Tag x="-0.45" y="-6.1">y</Tag>
      </g>
    </svg>
  )
}

// Прямоугольный треугольник с квадратами на катетах (наглядная теорема).
//
// Компоновка: прямой угол в точке P, катет b идёт вправо, катет a — вверх.
// Квадрат на b пристроен снизу, квадрат на a — слева-сверху, поэтому вся
// конструкция ровно квадратная: x ∈ [−A, B], y ∈ [−A, B] относительно P.
// Отсюда честное центрирование при любых катетах (раньше фигура уползала
// вниз-вправо и подпись гипотенузы налезала на треугольник).
export function PythVisual({ vals }) {
  const a = vals?.a ?? 3
  const b = vals?.b ?? 4
  const c = Math.sqrt(a * a + b * b)
  // мелкие фигуры остаются мелкими (видна разница), крупные не вылезают за рамку
  const s = 9 / Math.max(a + b, 5)
  const A = a * s, B = b * s
  const off = (B - A) / 2               // сдвиг, ставящий центр bbox в начало
  const px = -off, py = -0.6 - off      // −0.6: место под строку a² + b² внизу
  const P = { x: px, y: py }
  const Q = { x: px + B, y: py }
  const R = { x: px, y: py - A }
  const m = Math.min(0.45, A * 0.3, B * 0.3)   // размер метки прямого угла
  // подпись гипотенузы выносим по внешней нормали, чтобы не легла на фигуру
  const hyp = Math.hypot(A, B) || 1
  const cx = px + B / 2 + (A / hyp) * 1.1
  const cy = py - A / 2 - (B / hyp) * 1.1
  return (
    <svg viewBox="-7.2 -6.4 14.4 12.8" className="w-full h-full">
      <rect x={P.x} y={P.y} width={B} height={B} fill="rgba(0,122,255,0.14)" stroke={AX} strokeWidth="0.05" />
      <rect x={P.x - A} y={P.y - A} width={A} height={A} fill="rgba(52,199,89,0.16)" stroke="#30d158" strokeWidth="0.05" />
      <polygon points={`${P.x},${P.y} ${Q.x},${Q.y} ${R.x},${R.y}`} fill="rgba(255,159,10,0.22)" stroke="#ff9f0a" strokeWidth="0.09" />
      <polyline points={`${P.x + m},${P.y} ${P.x + m},${P.y - m} ${P.x},${P.y - m}`} fill="none" stroke="#ff9f0a" strokeWidth="0.06" />
      {/* подписи катетов — в центрах «своих» квадратов; если квадрат узкий,
          выносим наружу, иначе подпись вылезает за его границы */}
      {B >= 1.5
        ? <Tag x={P.x + B / 2} y={P.y + B / 2} color={AX}>b = {fmt(b)}</Tag>
        : <Tag x={P.x + B + 0.35} y={P.y + B / 2} color={AX} anchor="start">b = {fmt(b)}</Tag>}
      {A >= 1.5
        ? <Tag x={P.x - A / 2} y={P.y - A / 2} color="#30d158">a = {fmt(a)}</Tag>
        : <Tag x={P.x - A - 0.35} y={P.y - A / 2} color="#30d158" anchor="end">a = {fmt(a)}</Tag>}
      <Tag x={cx} y={cy} color="#ff9f0a">c = {fmt(c)}</Tag>
      <g className="text-gray-500 dark:text-white/70">
        <Tag x="0" y="5.7">{fmt(a)}² + {fmt(b)}² = {fmt(a * a + b * b)}</Tag>
      </g>
    </svg>
  )
}

// Треугольник для «тапни по гипотенузе»: зоны кликабельны в движке.
export function TriangleHotspot({ selected }) {
  const col = (id) => (selected === id ? "#007AFF" : "currentColor")
  const w = (id) => (selected === id ? 0.22 : 0.11)
  return (
    <svg viewBox="-6 -4.6 12 9.2" className="w-full h-full text-gray-500 dark:text-white/70">
      <polygon points="-3.6,3 4,3 -3.6,-3" fill="rgba(0,122,255,0.06)" stroke="none" />
      <line x1="-3.6" y1="3" x2="4" y2="3" stroke={col("cat-b")} strokeWidth={w("cat-b")} strokeLinecap="round" />
      <line x1="-3.6" y1="3" x2="-3.6" y2="-3" stroke={col("cat-a")} strokeWidth={w("cat-a")} strokeLinecap="round" />
      <line x1="-3.6" y1="-3" x2="4" y2="3" stroke={col("hyp")} strokeWidth={w("hyp")} strokeLinecap="round" />
      {/* невидимые «толстые» зоны попадания: тонкую линию пальцем не поймать */}
      <line data-zone="cat-b" x1="-3.6" y1="3" x2="4" y2="3" stroke="transparent" strokeWidth="1.1" strokeLinecap="round" style={{ cursor: "pointer" }} />
      <line data-zone="cat-a" x1="-3.6" y1="3" x2="-3.6" y2="-3" stroke="transparent" strokeWidth="1.1" strokeLinecap="round" style={{ cursor: "pointer" }} />
      <line data-zone="hyp" x1="-3.6" y1="-3" x2="4" y2="3" stroke="transparent" strokeWidth="1.1" strokeLinecap="round" style={{ cursor: "pointer" }} />
      <polyline points="-2.9,3 -2.9,2.3 -3.6,2.3" fill="none" stroke="currentColor" strokeWidth="0.07" />
      <Tag x="-4.1" y="-3.2">A</Tag>
      <Tag x="-4.1" y="3.5">C</Tag>
      <Tag x="4.5" y="3.5">B</Tag>
    </svg>
  )
}

// Мешок с шарами: наглядная вероятность.
export function BallsVisual({ vals }) {
  const blue = Math.round(vals?.blue ?? 3)
  const red = Math.round(vals?.red ?? 5)
  const total = blue + red
  const balls = []
  const perRow = 6
  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / perRow)
    const inRow = Math.min(perRow, total - row * perRow)
    const x = (i % perRow) - (inRow - 1) / 2
    balls.push(
      <circle key={i} cx={x * 1.5} cy={row * 1.5 - (Math.ceil(total / perRow) - 1) * 0.75} r="0.6"
        fill={i < blue ? AX : "#ff453a"} opacity="0.9" />
    )
  }
  const p = total ? blue / total : 0
  return (
    <svg viewBox="-5.4 -4.4 10.8 8.8" className="w-full h-full">
      <rect x="-5" y="-3.9" width="10" height="6.2" rx="0.8" fill="rgba(0,122,255,0.05)" stroke="currentColor"
        strokeWidth="0.05" className="text-gray-300 dark:text-white/20" />
      <g transform="translate(0,-0.9)">{balls}</g>
      <g className="text-gray-600 dark:text-white/80">
        <Tag x="0" y="3.4">
          {total ? `P(синий) = ${blue}/${total} = ${fmt(p)}` : "Мешок пуст"}
        </Tag>
      </g>
    </svg>
  )
}

// Ценник со скидкой: полоса «сколько осталось от цены».
export function PriceVisual({ vals }) {
  const base = 4000
  const d = Math.round(vals?.d ?? 0)
  const price = Math.round(base * (100 - d) / 100)
  const wFull = 9.4
  const wLeft = wFull * (100 - d) / 100
  return (
    <svg viewBox="-5.2 -3.4 10.4 6.8" className="w-full h-full">
      <rect x="-4.7" y="-0.75" width={wFull} height="1.5" rx="0.5" fill="currentColor"
        className="text-gray-200 dark:text-white/10" />
      <rect x="-4.7" y="-0.75" width={Math.max(wLeft, 0.001)} height="1.5" rx="0.5" fill={AX} opacity="0.85"
        style={{ transition: "width 220ms cubic-bezier(0.34,1.2,0.64,1)" }} />
      <g className="text-gray-500 dark:text-white/60">
        <Tag x="-4.7" y="-1.5" anchor="start">было {base} ₽</Tag>
        <Tag x="4.7" y="-1.5" anchor="end">{d ? `−${d}%` : "без скидки"}</Tag>
      </g>
      <g className="text-gray-800 dark:text-white">
        <text x="0" y="2.3" fontSize="1.05" textAnchor="middle" fill="currentColor" style={{ fontWeight: 700 }}>
          {price} ₽
        </text>
      </g>
    </svg>
  )
}

// Числовая прямая для сравнения чисел.
export function NumberLineVisual({ marks = [] }) {
  return (
    <svg viewBox="-5.6 -1.9 11.2 3.8" className="w-full h-full">
      <line x1="-5" y1="0" x2="5" y2="0" stroke="currentColor" strokeWidth="0.06"
        className="text-gray-400 dark:text-white/40" />
      {[0, 0.5, 1, 1.5, 2].map((v, i) => (
        <g key={i}>
          <line x1={-5 + i * 2.5} y1="-0.25" x2={-5 + i * 2.5} y2="0.25" stroke="currentColor" strokeWidth="0.05"
            className="text-gray-400 dark:text-white/40" />
          <g className="text-gray-400 dark:text-white/50"><Tag x={-5 + i * 2.5} y="0.85">{fmt(v)}</Tag></g>
        </g>
      ))}
      {marks.map((m, i) => (
        <g key={i}>
          <circle cx={-5 + m.v * 5} cy="0" r="0.17" fill={AX} />
          {/* подписи через одну на разной высоте — близкие числа не слипаются */}
          <Tag x={-5 + m.v * 5} y={i % 2 ? -1.5 : -0.85} color={AX}>{m.label}</Tag>
        </g>
      ))}
    </svg>
  )
}

