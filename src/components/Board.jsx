import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react"
import { supabase } from "../supabase"
import { signBoardScene, signStorageUrl } from "../storageUrl"
import Icon from "./Icon"
import {
  GRID, ENCLOSED_SHAPES, SHAPE_TOOLS, DASHABLE_SHAPES,
  isDarkColor, resolveColor, strokeBBox, paintStroke, scenePreview, tintSheet,
} from "./boardPaint"
// Выбор задания тянет за собой генераторы всех предметов и html2canvas — грузим
// только когда репетитор открыл выбор, иначе доска стала бы тяжелее на мегабайты.
const BoardTaskModal = lazy(() => import("./BoardTaskModal"))

// Совместная доска платформы (свой движок на HTML5 Canvas, без внешних библиотек).
// БЕСКОНЕЧНЫЙ холст на весь экран: штрихи хранятся в МИРОВЫХ координатах, у каждого
// клиента свой обзор (view = смещение + масштаб) — можно зумить и двигать полотно
// независимо, при этом рисунок общий. Одна комната = один ученик (roomId = student.id).
// Синхронизация через Supabase Realtime broadcast; снапшот сцены — в таблицу boards.

const WIDTHS = [3, 6, 12]
const MIN_SCALE = 0.15, MAX_SCALE = 8

const BG_LIGHT = "#ffffff", BG_DARK = "#1c1c1e"
const BG_COLORS = ["#ffffff", "#f2f2f7", "#fdf6e3", "#1c1c1e", "#0f172a", "#123a2e"]

// «Чернила» — первый цвет палитры; хранится как маркер "ink" и адаптируется под фон.
const palette = () => ["ink", "#007AFF", "#FF3B30", "#34C759", "#FF9500", "#AF52DE"]

const CURSOR_COLORS = ["#007AFF", "#34C759", "#FF9500", "#AF52DE", "#FF3B30"]
function colorFor(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CURSOR_COLORS[h % CURSOR_COLORS.length]
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

let uidCounter = 0
const makeId = (author) => `${author}-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`

const rectsIntersect = (a, b) => !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY)
const pointInBBox = (x, y, b) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY

// Курсор собеседника держится CURSOR_HOLD мс после последнего движения, потом гаснет
const CURSOR_HOLD = 3000, CURSOR_FADE = 400
const POINTER_RATE = 60 // не чаще 1 посылки в 60 мс (~16/сек) — экономим realtime
const DASH_STYLES = ["solid", "dashed", "dotted"]
// Длительность анимации ухода попапа — синхронно с .popup-bubble-out в index.css
const POPUP_OUT_MS = 200

// Расстояние от точки до отрезка
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// Попал ли клик (в мировых координатах) по штриху; tol — допуск в мировых единицах
function hitStroke(s, x, y, tol) {
  const t = Math.max(tol, (s.width || 3) / 2 + tol)
  if (ENCLOSED_SHAPES.has(s.tool)) {
    const b = strokeBBox(s)
    return pointInBBox(x, y, { minX: b.minX - tol, minY: b.minY - tol, maxX: b.maxX + tol, maxY: b.maxY + tol })
  }
  const pts = s.points
  if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= t
  for (let i = 1; i < pts.length; i++)
    if (distToSeg(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= t) return true
  return false
}

// Ровное построение при зажатом Shift: линии/стрелки — под угол кратный 45°,
// остальные фигуры — квадратный габарит (круг → окружность, прямоугольник → квадрат).
function constrainShape(tool, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  if (tool === "line" || tool === "arrow") {
    const len = Math.hypot(dx, dy)
    if (!len) return b
    const step = Math.PI / 4
    const ang = Math.round(Math.atan2(dy, dx) / step) * step
    return [a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len]
  }
  const side = Math.max(Math.abs(dx), Math.abs(dy))
  return [a[0] + Math.sign(dx || 1) * side, a[1] + Math.sign(dy || 1) * side]
}

// --- Картинки на доске ----------------------------------------------------
const IMG_BUCKET = "variants" // публичный бакет (уже существует); картинки кладём в board/…
function readFileAsDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file) })
}
function loadImg(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src })
}
// Ужимаем до разумного размера + получаем blob и data URL
async function processImageFile(file) {
  const dataUrl = await readFileAsDataURL(file)
  const im = await loadImg(dataUrl)
  const maxDim = 1400
  const scale = Math.min(1, maxDim / Math.max(im.naturalWidth, im.naturalHeight))
  const cw = Math.max(1, Math.round(im.naturalWidth * scale)), ch = Math.max(1, Math.round(im.naturalHeight * scale))
  const cnv = document.createElement("canvas"); cnv.width = cw; cnv.height = ch
  cnv.getContext("2d").drawImage(im, 0, 0, cw, ch)
  const isPng = file.type === "image/png"
  const type = isPng ? "image/png" : "image/jpeg"
  const blob = await new Promise((r) => cnv.toBlob(r, type, 0.85))
  return { blob, type, ext: isPng ? "png" : "jpg", w: cw, h: ch, dataUrl: cnv.toDataURL(type, 0.85) }
}

// Всплывающая подсказка над кнопкой (родитель должен иметь класс group + relative)
function Tip({ label, hotkey, dark }) {
  return (
    <span
      className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap rounded-lg px-2 py-1 text-xs flex items-center gap-1.5 shadow-lg"
      style={{ background: dark ? "#f5f5f7" : "#1f2937", color: dark ? "#1c1c1e" : "#fff", zIndex: 30 }}>
      {label}
      {hotkey && (
        <kbd className="rounded px-1 text-[10px] font-semibold leading-4"
          style={{ background: dark ? "rgba(0,0,0,.1)" : "rgba(255,255,255,.22)" }}>{hotkey}</kbd>
      )}
    </span>
  )
}

// Содержимое попапа «Настройки обводки»: толщина + стиль линии + углы (в одну строку).
// Стиль линии и углы применяются только к фигурам (см. paintStroke): у пера и ластика
// штрих всегда сплошной и со скруглёнными стыками — для них эти группы не показываем.
function StrokeSettings({ dark, tool, curWidth, curDash, curCorner, onWidth, onDash, onCorner }) {
  const swatch = dark ? "#e5e5ea" : "#1c1c1e"
  const sep = <div className="w-px h-7 mx-0.5 flex-shrink-0" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)" }} />
  const dashArr = (d) => d === "dashed" ? "5,4" : d === "dotted" ? "0.1,5" : ""
  const showDash = DASHABLE_SHAPES.has(tool)
  const showCorner = SHAPE_TOOLS.has(tool)
  return (
    <div className="flex items-center gap-1">
      {WIDTHS.map((w) => (
        <button key={w} onClick={() => onWidth(w)} title="Толщина"
          className={`press-tap w-9 h-9 rounded-xl flex items-center justify-center ${curWidth === w ? "bg-blue-500/15" : "hover:bg-black/5 dark:hover:bg-white/10"}`}>
          <span className="rounded-full" style={{ width: w + 4, height: w + 4, background: swatch }} />
        </button>
      ))}
      {showDash && sep}
      {showDash && DASH_STYLES.map((d) => (
        <button key={d} onClick={() => onDash(d)} title={d === "solid" ? "Сплошная" : d === "dashed" ? "Пунктир" : "Точки"}
          className={`press-tap w-11 h-9 rounded-xl flex items-center justify-center ${curDash === d ? "bg-blue-500/15" : "hover:bg-black/5 dark:hover:bg-white/10"}`}>
          <svg width="34" height="12" viewBox="0 0 34 12"><line x1="2" y1="6" x2="32" y2="6" stroke={swatch} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={dashArr(d)} /></svg>
        </button>
      ))}
      {showCorner && sep}
      {showCorner && [["round", true], ["sharp", false]].map(([id, round]) => (
        <button key={id} onClick={() => onCorner(id)} title={round ? "Скруглённые углы" : "Острые углы"}
          className={`press-tap w-11 h-9 rounded-xl flex items-center justify-center ${curCorner === id ? "bg-blue-500/15" : "hover:bg-black/5 dark:hover:bg-white/10"}`}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={swatch} strokeWidth="2">
            {round ? <path d="M4 15 V9 A5 5 0 0 1 9 4 H15" strokeLinecap="round" /> : <path d="M4 15 V4 H15" strokeLinecap="butt" />}
          </svg>
        </button>
      ))}
    </div>
  )
}

// Ширина в точке = базовая × множитель от СКОРОСТИ и (если есть) НАЖАТИЯ.
// Мышь не передаёт нажатие → главный драйвер скорость: медленно=толще, быстро=тоньше.
const SPEED_SLOW = 4, SPEED_FAST = 60
function widthAt(base, speed, pressure) {
  const t = clamp((speed - SPEED_SLOW) / (SPEED_FAST - SPEED_SLOW), 0, 1)
  const vMul = 1.5 + (0.6 - 1.5) * t
  const pMul = (pressure > 0 && Math.abs(pressure - 0.5) > 0.02) ? (0.6 + 0.9 * pressure) : 1
  return clamp(base * vMul * pMul, base * 0.5, base * 1.7)
}

export default function Board({ roomId, userId, userName, theme = "light", onClose, account = null, token = null, canAddTasks = false }) {
  const colors = palette()
  const [tool, setTool] = useState("pen")   // pen | line | rect | eraser | hand
  const [color, setColor] = useState("ink")
  const [width, setWidth] = useState(WIDTHS[1])
  const [dash, setDash] = useState("solid")     // solid | dashed | dotted
  const [corner, setCorner] = useState("sharp") // round | sharp
  // Открытый попап панели — ОДИН на всех: "stroke" | "selStroke" | "shapes" | "bg" | null.
  // Поэтому открытие любого попапа автоматически закрывает предыдущий, а клик мимо
  // (по холсту или где-то ещё) закрывает открытый — см. эффект ниже и onPointerDown.
  const [menu, setMenu] = useState(null)
  // Закрывающийся попап держим смонтированным, пока играет анимация ухода
  const [closingMenu, setClosingMenu] = useState(null)
  const closeTimer = useRef(null)
  const beginClosing = (id) => {
    setClosingMenu(id)
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setClosingMenu(null), POPUP_OUT_MS)
  }
  const closeMenu = (id = menu) => { if (id) { beginClosing(id); setMenu(null) } }
  const openMenu = (id) => {
    if (menu === id) return
    if (menu) beginClosing(menu)                 // предыдущий уходит с анимацией
    else if (closingMenu === id) setClosingMenu(null) // открыли тот же, пока он ещё уходил
    setMenu(id)
  }
  const toggleMenu = (id) => (menu === id ? closeMenu(id) : openMenu(id))
  // Попап виден и пока уходит; класс задаёт нужную анимацию
  const menuShown = (id) => menu === id || closingMenu === id
  const menuAnim = (id) => (menu === id ? "popup-bubble" : "popup-bubble-out")
  const closeMenuRef = useRef(closeMenu)
  useEffect(() => { closeMenuRef.current = closeMenu })
  useEffect(() => () => clearTimeout(closeTimer.current), [])
  const [bg, setBg] = useState("plain")      // plain | grid | dots — узор
  const [bgColor, setBgColor] = useState(theme === "dark" ? BG_DARK : BG_LIGHT) // цвет фона
  const [shapeTool, setShapeTool] = useState("rect") // последняя выбранная фигура
  const [online, setOnline] = useState([])
  const [saveState, setSaveState] = useState("idle")
  const [loaded, setLoaded] = useState(false)
  const [zoomPct, setZoomPct] = useState(100)
  const [selCount, setSelCount] = useState(0)
  // Число выделенных штрихов: пропало выделение — закрываем попап его настроек
  const applySelCount = (n) => { setSelCount(n); if (!n && menu === "selStroke") closeMenu("selStroke") }
  const [selBox, setSelBox] = useState(null)   // ориентированная рамка выделения (экранные координаты)
  const [selProps, setSelProps] = useState(null) // свойства первого выделенного штриха {width,dash,corner}
  const [dragActive, setDragActive] = useState(false) // перетаскивание файла над доской
  const [taskPick, setTaskPick] = useState(false)     // открыт выбор задания из банка

  // Клик мимо открытого попапа закрывает его. Всё, что должно считаться «своим»
  // (кнопка попапа + сам попап), обёрнуто в контейнер с data-menu.
  useEffect(() => {
    if (!menu) return
    const onDown = (e) => { if (!e.target?.closest?.("[data-menu]")) closeMenu() }
    window.addEventListener("pointerdown", onDown)
    return () => window.removeEventListener("pointerdown", onDown)
  }, [menu])

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const strokes = useRef(new Map())
  const redoStack = useRef([])
  const drawing = useRef(null)
  const cursors = useRef(new Map())   // userId -> {x, y, name} в МИРОВЫХ координатах
  const cursorTimers = useRef(new Map()) // userId -> таймер авто-скрытия неподвижного курсора
  const lastPointerSend = useRef(0)   // троттлинг рассылки своего курсора
  const view = useRef({ x: 0, y: 0, scale: 1 }) // экранное смещение (css px) + масштаб
  const pointers = useRef(new Map())  // активные указатели для мультитача
  const gesture = useRef(null)        // состояние пинча
  const panning = useRef(null)        // текущее панорамирование мышью/рукой
  const selection = useRef(new Set()) // id выделенных штрихов (инструмент «курсор»)
  const marquee = useRef(null)        // {x0,y0,x1,y1} рамка выделения (мир)
  const movingSel = useRef(null)      // {x,y} перетаскивание выделенного
  const transform = useRef(null)      // активное масштабирование/поворот выделения
  const lastSelBox = useRef(null)     // предыдущий экранный габарит (защита от лишних setState)
  const lastSelProps = useRef(null)   // предыдущие свойства выделения (защита от лишних setState)
  const spaceHeld = useRef(false)
  const bgRef = useRef(bg)
  const bgColorRef = useRef(bgColor)
  const channelRef = useRef(null)
  const teardownTimer = useRef(null)
  const saveTimer = useRef(null)
  const sendTimer = useRef(null)
  const dirty = useRef(false)
  const rafId = useRef(0)
  const actions = useRef({})
  const imgCache = useRef(new Map())  // src -> HTMLImageElement (ленивая загрузка картинок)
  const tintCache = useRef(new Map()) // src -> холст листа, перекрашенный под тёмную доску
  const fileInputRef = useRef(null)   // скрытый input для загрузки картинки кнопкой
  const loadedRef = useRef(false)     // сцена успешно загружена (иначе не сохраняем — чтобы не затереть)
  const modalOpen = useRef(false)     // поверх доски открыт диалог (глушим горячие клавиши)
  const taskShift = useRef(0)         // лесенка для подряд вставленных заданий

  const dark = isDarkColor(bgColor)      // светлость доски определяется цветом фона
  const baseBg = bgColor

  useEffect(() => { bgRef.current = bg }, [bg])

  // --- Координаты ---------------------------------------------------------
  function toWorld(clientX, clientY) {
    const rect = canvasRef.current.getBoundingClientRect()
    const v = view.current
    return [(clientX - rect.left - v.x) / v.scale, (clientY - rect.top - v.y) / v.scale]
  }
  function zoomAt(sx, sy, factor) {
    if (!Number.isFinite(factor) || factor <= 0 || !Number.isFinite(sx) || !Number.isFinite(sy)) return
    const v = view.current
    const ns = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
    if (!Number.isFinite(ns) || ns <= 0) return
    const k = ns / v.scale
    v.x = sx - (sx - v.x) * k
    v.y = sy - (sy - v.y) * k
    v.scale = ns
    setZoomPct(Math.round(ns * 100))
  }

  // --- Рендер -------------------------------------------------------------
  // Штрих рисуется общей функцией из boardPaint — та же самая, что и в превью
  // снимка занятия: иначе история занятий выглядела бы иначе, чем живая доска.
  function drawStroke(ctx, s) {
    paintStroke(ctx, s, { darkBg: isDarkColor(bgColorRef.current), getImage })
  }

  function drawBackground(ctx, cw, ch) {
    const mode = bgRef.current
    if (mode === "plain") return
    const gc = isDarkColor(bgColorRef.current) ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"
    const v = view.current
    const step = GRID * v.scale
    if (step < 6) return
    const ox = ((v.x % step) + step) % step
    const oy = ((v.y % step) + step) % step
    ctx.globalCompositeOperation = "source-over"
    if (mode === "grid") {
      ctx.strokeStyle = gc
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = ox; x < cw; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, ch) }
      for (let y = oy; y < ch; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(cw, y + 0.5) }
      ctx.stroke()
    } else { // dots
      ctx.fillStyle = gc
      const r = clamp(1.3 * v.scale, 0.8, 2.2)
      for (let x = ox; x < cw; x += step)
        for (let y = oy; y < ch; y += step) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill() }
    }
  }

  // Габарит объединения выделенных штрихов (или null)
  function selectionBBox() {
    let bb = null
    for (const id of selection.current) {
      const s = strokes.current.get(id)
      if (!s) continue
      const b = strokeBBox(s)
      bb = bb ? { minX: Math.min(bb.minX, b.minX), minY: Math.min(bb.minY, b.minY), maxX: Math.max(bb.maxX, b.maxX), maxY: Math.max(bb.maxY, b.maxY) } : b
    }
    return bb
  }
  // Одна выделенная фигура? (тогда рамка поворачивается вместе с ней)
  function singleEnclosed() {
    if (selection.current.size !== 1) return null
    const s = strokes.current.get([...selection.current][0])
    return s && ENCLOSED_SHAPES.has(s.tool) && s.points.length >= 2 ? s : null
  }
  // Ориентированная рамка выделения (в мировых координатах): {cx,cy,hw,hh,angle}
  function orientedWorldBox() {
    if (!selection.current.size) return null
    const s = singleEnclosed()
    if (s) {
      const a = s.points[0], b = s.points[s.points.length - 1]
      const pad = (s.width || 3) / 2 + 3
      return { cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, hw: Math.abs(b[0] - a[0]) / 2 + pad, hh: Math.abs(b[1] - a[1]) / 2 + pad, angle: s.angle || 0 }
    }
    const bb = selectionBBox()
    if (!bb) return null
    return { cx: (bb.minX + bb.maxX) / 2, cy: (bb.minY + bb.maxY) / 2, hw: (bb.maxX - bb.minX) / 2, hh: (bb.maxY - bb.minY) / 2, angle: 0 }
  }

  function redraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const dpr = window.devicePixelRatio || 1
    const cw = canvas.clientWidth, ch = canvas.clientHeight
    const bw = Math.round(cw * dpr), bh = Math.round(ch * dpr)
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh }

    // Фон (в экранных координатах)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cw, ch)
    drawBackground(ctx, cw, ch)

    // Штрихи (в мировых координатах через view-трансформ)
    const v = view.current
    ctx.setTransform(v.scale * dpr, 0, 0, v.scale * dpr, v.x * dpr, v.y * dpr)
    for (const s of strokes.current.values()) drawStroke(ctx, s)
    if (drawing.current) drawStroke(ctx, drawing.current)

    // Курсоры (обратно в экранные координаты, постоянный размер)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalCompositeOperation = "source-over"
    // Выделение и рамка (в экранных координатах — постоянная толщина)
    const toScreen = (wx, wy) => [wx * v.scale + v.x, wy * v.scale + v.y]
    const drawDashRect = (bb, color, dash) => {
      const [x0, y0] = toScreen(bb.minX, bb.minY), [x1, y1] = toScreen(bb.maxX, bb.maxY)
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash(dash)
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.restore()
    }
    // Ориентированная рамка выделения → в стейт для HTML-оверлея
    const ob = orientedWorldBox()
    let frame = null
    if (ob) {
      const cx = ob.cx * v.scale + v.x, cy = ob.cy * v.scale + v.y
      const cos = Math.cos(ob.angle), sin = Math.sin(ob.angle)
      frame = {
        cx, cy, angle: ob.angle,
        ax: { x: cos * ob.hw * v.scale, y: sin * ob.hw * v.scale },   // полу-ось «ширина»
        ay: { x: -sin * ob.hh * v.scale, y: cos * ob.hh * v.scale },  // полу-ось «высота»
      }
    }
    const prev = lastSelBox.current
    const near = (a, b) => a && b && Math.abs(a.cx - b.cx) < 0.5 && Math.abs(a.cy - b.cy) < 0.5 &&
      Math.abs(a.ax.x - b.ax.x) < 0.5 && Math.abs(a.ax.y - b.ax.y) < 0.5 && Math.abs(a.ay.x - b.ay.x) < 0.5 && Math.abs(a.ay.y - b.ay.y) < 0.5
    if ((!prev) !== (!frame) || (frame && prev && !near(frame, prev))) { lastSelBox.current = frame; setSelBox(frame) }
    // Свойства первого выделенного штриха → для попапа «Настройки обводки»
    let props = null
    if (frame && selection.current.size) {
      const s0 = strokes.current.get([...selection.current][0])
      if (s0) props = { tool: s0.tool, width: s0.width, dash: s0.dash || "solid", corner: s0.corner || "sharp" }
    }
    const pp = lastSelProps.current
    if ((!pp) !== (!props) || (pp && props && (pp.tool !== props.tool || pp.width !== props.width || pp.dash !== props.dash || pp.corner !== props.corner))) {
      lastSelProps.current = props; setSelProps(props)
    }
    if (marquee.current) {
      const m = marquee.current
      drawDashRect({ minX: Math.min(m.x0, m.x1), minY: Math.min(m.y0, m.y1), maxX: Math.max(m.x0, m.x1), maxY: Math.max(m.y0, m.y1) }, "#007AFF", [5, 4])
    }
    // Курсоры собеседников: стрелка своего цвета и подпись именем. Через
    // CURSOR_HOLD после последнего движения курсор гаснет за CURSOR_FADE —
    // забытый чужой курсор посреди чертежа мешает читать доску.
    const now = performance.now()
    let fading = false
    for (const [id, c] of cursors.current) {
      const age = now - c.t
      if (age > CURSOR_HOLD + CURSOR_FADE) { cursors.current.delete(id); continue }
      const alpha = age <= CURSOR_HOLD ? 1 : 1 - (age - CURSOR_HOLD) / CURSOR_FADE
      if (age > CURSOR_HOLD - 100) fading = true
      const sx = c.x * v.scale + v.x, sy = c.y * v.scale + v.y
      const col = colorFor(id)
      ctx.save()
      ctx.globalAlpha = alpha
      // Стрелка: белая обводка держит её читаемой на любом фоне и на штрихах
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx + 12, sy + 12.5)
      ctx.lineTo(sx + 5.2, sy + 12.6)
      ctx.lineTo(sx + 2.4, sy + 18.5)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = 1.5
      ctx.lineJoin = "round"
      ctx.fill()
      ctx.stroke()
      const name = c.name || ""
      if (name) {
        ctx.font = "600 11px -apple-system, system-ui, sans-serif"
        const tw = ctx.measureText(name).width
        const bx = sx + 14, by = sy + 16, bw = tw + 12, bh = 18
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 9)
        else ctx.rect(bx, by, bw, bh)
        ctx.fillStyle = col
        ctx.fill()
        ctx.fillStyle = "#fff"
        ctx.textBaseline = "middle"
        ctx.fillText(name, bx + 6, by + bh / 2 + 0.5)
      }
      ctx.restore()
    }
    // Пока курсор гаснет, кадры нужны сами по себе — событий больше не будет
    if (fading) scheduleDraw()
  }

  const scheduleDraw = useCallback(() => {
    dirty.current = true
    if (rafId.current) return
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0
      if (!dirty.current) return
      dirty.current = false
      redraw()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Картинка по src (кэш + ленивая загрузка, перерисовка по onload).
  //
  // Адрес ОБЯЗАТЕЛЬНО подписываем: бакет приватный, и по голому публичному адресу
  // хранилище отвечает 400 — картинка не рисуется вовсе. Сцену при открытии доски
  // подписывает signBoardScene, поэтому только что вставленное задание (и своё, и
  // прилетевшее от собеседника) не появлялось до перезахода на доску, а после
  // перезахода появлялось. Для data-URL и чужих адресов подпись возвращает их же.
  function getImage(src, wantTint = false) {
    if (!src) return null
    let img = imgCache.current.get(src)
    if (!img) {
      img = new Image()
      // crossOrigin обязателен, чтобы холст не «портился»: без него перекрасить лист
      // под тёмную доску нельзя (getImageData кидает SecurityError). Хранилище отдаёт
      // Access-Control-Allow-Origin, но если какой-то адрес его не отдаст — картинка
      // перезагрузится без CORS и просто останется неперекрашиваемой.
      if (!src.startsWith("data:")) img.crossOrigin = "anonymous"
      img.onload = () => scheduleDraw()
      img.onerror = () => {
        if (!img.crossOrigin) return
        const plain = new Image()
        plain.onload = () => scheduleDraw()
        plain.src = img.src
        imgCache.current.set(src, plain)
      }
      imgCache.current.set(src, img)
      signStorageUrl(src, IMG_BUCKET).then(
        (url) => { img.src = url || src },
        () => { img.src = src },     // подписать не вышло — пробуем как есть
      )
    }
    if (!wantTint || !img.complete || !img.naturalWidth) return img
    if (!tintCache.current.has(src)) tintCache.current.set(src, tintSheet(img))
    return tintCache.current.get(src) || img
  }

  // --- Загрузка снапшота --------------------------------------------------
  useEffect(() => {
    let alive = true
    supabase.from("boards").select("scene").eq("student_id", String(roomId)).maybeSingle()
      .then(async ({ data }) => {
        if (!alive) return
        // Бакет с картинками доски приватный — подписываем их ссылки.
        const scene = (await signBoardScene(data?.scene)) || {}
        for (const s of scene.strokes || []) strokes.current.set(s.id, s)
        if (scene.bg) setBg(scene.bg)
        if (scene.bgColor) setBgColor(scene.bgColor)
        loadedRef.current = true   // сохранять можно только после успешной загрузки
        setLoaded(true)
        scheduleDraw()
      })
      .catch(() => { if (alive) setLoaded(true) })  // не зависаем на лоадере при сбое (но и не сохраняем)
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // --- Realtime -----------------------------------------------------------
  useEffect(() => {
    const scheduleTeardown = () => {
      clearTimeout(teardownTimer.current)
      teardownTimer.current = setTimeout(() => {
        if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
      }, 150)
    }
    clearTimeout(teardownTimer.current)
    if (channelRef.current && channelRef.current._boardRoom !== roomId) {
      supabase.removeChannel(channelRef.current); channelRef.current = null
    }
    if (channelRef.current) return scheduleTeardown

    const channel = supabase.channel(`board:${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: userId } },
    })
    channel._boardRoom = roomId
    channelRef.current = channel

    channel
      .on("broadcast", { event: "draw" }, ({ payload }) => { strokes.current.set(payload.id, payload); scheduleDraw() })
      .on("broadcast", { event: "remove" }, ({ payload }) => { strokes.current.delete(payload.id); selection.current.delete(payload.id); scheduleDraw() })
      .on("broadcast", { event: "clear" }, () => { strokes.current.clear(); selection.current.clear(); scheduleDraw() })
      .on("broadcast", { event: "bg" }, ({ payload }) => {
        if (payload.bg != null) setBg(payload.bg)
        if (payload.bgColor != null) setBgColor(payload.bgColor)
      })
      .on("broadcast", { event: "pointer" }, ({ payload }) => {
        cursors.current.set(payload.id, { x: payload.x, y: payload.y, name: payload.name, t: performance.now() })
        // Само затухание считает redraw по времени; таймер нужен только чтобы
        // разбудить отрисовку, когда событий больше не приходит.
        clearTimeout(cursorTimers.current.get(payload.id))
        cursorTimers.current.set(payload.id, setTimeout(() => {
          cursorTimers.current.delete(payload.id); scheduleDraw()
        }, CURSOR_HOLD))
        scheduleDraw()
      })
      .on("presence", { event: "sync" }, () => {
        const people = Object.values(channel.presenceState()).flat()
        setOnline(people)
        const ids = new Set(people.map((p) => p.userId))
        for (const id of cursors.current.keys()) if (!ids.has(id)) {
          cursors.current.delete(id)
          clearTimeout(cursorTimers.current.get(id)); cursorTimers.current.delete(id)
        }
        scheduleDraw()
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") channel.track({ userId, name: userName }) })

    return scheduleTeardown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, userName])

  useEffect(() => {
    const ro = new ResizeObserver(() => scheduleDraw())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [scheduleDraw])

  useEffect(() => scheduleDraw(), [bg, scheduleDraw])
  useEffect(() => { bgColorRef.current = bgColor; scheduleDraw() }, [bgColor, scheduleDraw])

  useEffect(() => () => {
    clearTimeout(saveTimer.current); clearTimeout(sendTimer.current)
    // ВАЖНО: НЕ отменяем teardownTimer — иначе канал board:${roomId} не удаляется
    // при выходе, остаётся подписанным, и при повторном входе новый канал не может
    // занять тот же топик (белый экран, «не грузит», лечится только F5). Таймер
    // teardown сам удалит канал через 150 мс; StrictMode-ремоунт успевает его
    // отменить в realtime-эффекте (там канал переиспользуется).
    if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = 0 }
    dirty.current = false
    for (const t of cursorTimers.current.values()) clearTimeout(t)
    cursorTimers.current.clear()
  }, [])

  // Зум колесом / тачпадом (native listener — нужен passive:false для preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.01))
      } else {
        view.current.x -= e.deltaX
        view.current.y -= e.deltaY
      }
      scheduleDraw()
    }
    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Сохранение ---------------------------------------------------------
  const persist = useCallback(() => {
    setSaveState("saving")
    const scene = { strokes: Array.from(strokes.current.values()), bg: bgRef.current, bgColor: bgColorRef.current }
    supabase.from("boards")
      .upsert({ student_id: String(roomId), scene, updated_by: userId, updated_at: new Date().toISOString() })
      .then(({ error }) => setSaveState(error ? "idle" : "saved"))
  }, [roomId, userId])
  function scheduleSave() {
    if (!loadedRef.current) return // не сохраняем до успешной загрузки сцены — иначе затрём её пустой
    clearTimeout(saveTimer.current)
    setSaveState("saving")
    saveTimer.current = setTimeout(persist, 1200)
  }

  // Снимок занятия в историю (board_snapshots): живая доска у ученика одна, а
  // разобранное на прошлом уроке должно оставаться доступным. Одна запись на день —
  // повторное закрытие доски за то же занятие обновляет её, а не плодит строки.
  async function archiveSnapshot() {
    if (!loadedRef.current) return            // сцену не загрузили — архивировать нечего
    const list = Array.from(strokes.current.values())
    if (!list.length) return                  // пустая доска в историю занятий не попадает
    const scene = { strokes: list, bg: bgRef.current, bgColor: bgColorRef.current }
    const preview = await scenePreview(scene) // null, если холст «испорчен» картинкой без CORS
    const d = new Date()
    const lessonDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    // Ученику прямой записи в таблицу нет — только RPC с session_token (RLS включён).
    if (account && token) {
      await supabase.rpc("board_snapshot_save", {
        p_account: account, p_token: token, p_student_id: String(roomId),
        p_date: lessonDate, p_scene: scene, p_preview: preview, p_strokes: list.length,
      })
    } else {
      await supabase.from("board_snapshots").upsert({
        student_id: String(roomId), lesson_date: lessonDate, scene, preview,
        strokes: list.length, updated_by: userId, updated_at: new Date().toISOString(),
      }, { onConflict: "student_id,lesson_date" })
    }
  }

  function closeBoard() {
    // Живую доску дописываем сразу: отложенное сохранение могло ещё не сработать.
    clearTimeout(saveTimer.current)
    if (loadedRef.current) persist()
    // Снимок кладём в фоне и не ждём его: закрытие доски должно быть мгновенным,
    // а превью ещё догружает картинки. Промис держит ref'ы и доживает после размонтирования.
    archiveSnapshot().catch(() => {})  // истории может не быть (миграция не выполнена) — выход это не ломает
    onClose?.()
  }

  // --- Рисование ----------------------------------------------------------
  function addPoint(clientX, clientY, pressure) {
    const p = toWorld(clientX, clientY)
    const pts = drawing.current.points
    const prev = pts[pts.length - 1]
    const speed = Math.hypot(p[0] - prev[0], p[1] - prev[1])
    const target = drawing.current.tool === "eraser"
      ? drawing.current.width
      : widthAt(drawing.current.width, speed, pressure)
    const prevW = prev[2] ?? drawing.current.width
    const w = prevW + (target - prevW) * 0.15
    pts.push([p[0], p[1], w])
  }

  function broadcastDrawing(final) {
    if (!drawing.current) return
    const s = drawing.current
    const send = () => channelRef.current?.send({ type: "broadcast", event: "draw", payload: s })
    if (final) { clearTimeout(sendTimer.current); sendTimer.current = null; send(); return }
    if (sendTimer.current) return
    sendTimer.current = setTimeout(() => { sendTimer.current = null; send() }, 60)
  }

  function beginGesture() {
    const [a, b] = [...pointers.current.values()]
    gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
  }
  function updateGesture() {
    const vals = [...pointers.current.values()]
    const g = gesture.current
    if (!g || vals.length < 2) return
    const [a, b] = vals
    const rect = canvasRef.current.getBoundingClientRect()
    const dist = Math.hypot(a.x - b.x, a.y - b.y)
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
    view.current.x += mx - g.mx
    view.current.y += my - g.my
    if (g.dist > 0 && dist > 0) zoomAt(mx - rect.left, my - rect.top, dist / g.dist)
    g.dist = dist; g.mx = mx; g.my = my
    scheduleDraw()
  }

  function onPointerDown(e) {
    // Открыт попап панели → первый тык по холсту просто закрывает его, не рисуя
    if (menu) { closeMenu(); return }
    // Новый первичный указатель = начало нового жеста → сбрасываем возможные
    // «зависшие» указатели (недоснятое касание и т.п.), иначе рисование
    // навсегда уходит в режим жеста. Это самовосстановление.
    if (e.isPrimary) { pointers.current.clear(); gesture.current = null; panning.current = null }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    canvasRef.current.setPointerCapture?.(e.pointerId)

    // Два ОДНОВРЕМЕННЫХ касания (только touch) → жест панорама/зум
    if (e.pointerType === "touch" && pointers.current.size >= 2) {
      drawing.current = null; beginGesture(); scheduleDraw(); return
    }
    // Правая/боковая кнопка (её же выдаёт боковая кнопка пера планшета — button 2 /
    // бит 2 в buttons) или средняя кнопка → ВЫБИРАЕМ инструмент «Двигать полотно».
    const secondaryBtn = e.button === 1 || e.button === 2 || (e.buttons & 2) === 2
    if (secondaryBtn && tool !== "hand") setTool("hand")
    const wantPan = tool === "hand" || spaceHeld.current || secondaryBtn
    if (wantPan) { panning.current = { x: e.clientX, y: e.clientY }; return }
    if (e.pointerType === "mouse" && e.button != null && e.button !== 0) return

    // «Курсор» — выделение рамкой / перемещение выделенного (не рисует)
    if (tool === "cursor") {
      const p = toWorld(e.clientX, e.clientY)
      const bb = selectionBBox()
      if (bb && pointInBBox(p[0], p[1], bb)) {
        movingSel.current = { x: p[0], y: p[1] }   // клик по выделению → двигаем
      } else {
        marquee.current = { x0: p[0], y0: p[1], x1: p[0], y1: p[1] } // иначе — рамка
      }
      scheduleDraw()
      return
    }

    const base = tool === "eraser" ? width * 3 : width
    const p = toWorld(e.clientX, e.clientY)
    drawing.current = {
      id: makeId(userId), author: userId, tool,
      color: tool === "eraser" ? "#000" : color,
      width: base, dash, corner, points: [[p[0], p[1], base]],
    }
    scheduleDraw()
  }

  function onPointerMove(e) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (gesture.current) { updateGesture(); return }
    if (panning.current) {
      view.current.x += e.clientX - panning.current.x
      view.current.y += e.clientY - panning.current.y
      panning.current = { x: e.clientX, y: e.clientY }
      scheduleDraw(); return
    }
    // Перетаскивание выделенного
    if (movingSel.current) {
      const p = toWorld(e.clientX, e.clientY)
      const dx = p[0] - movingSel.current.x, dy = p[1] - movingSel.current.y
      for (const id of selection.current) {
        const s = strokes.current.get(id)
        if (s) s.points = s.points.map((pt) => [pt[0] + dx, pt[1] + dy, ...pt.slice(2)])
      }
      movingSel.current = { x: p[0], y: p[1] }
      scheduleDraw()
      return
    }
    // Растягивание рамки выделения
    if (marquee.current) {
      const p = toWorld(e.clientX, e.clientY)
      marquee.current.x1 = p[0]; marquee.current.y1 = p[1]
      scheduleDraw()
      return
    }
    // курсор собеседникам (в мировых координатах), не чаще POINTER_RATE:
    // pointermove сыплется сотнями в секунду, а канал у нас общий с рисованием.
    const w = toWorld(e.clientX, e.clientY)
    const nowMs = performance.now()
    if (nowMs - lastPointerSend.current >= POINTER_RATE) {
      lastPointerSend.current = nowMs
      channelRef.current?.send({ type: "broadcast", event: "pointer", payload: { id: userId, name: userName, x: w[0], y: w[1] } })
    }

    if (!drawing.current) return
    const pts = drawing.current.points
    if (SHAPE_TOOLS.has(drawing.current.tool)) {
      const end = e.shiftKey ? constrainShape(drawing.current.tool, pts[0], w) : [w[0], w[1]]
      drawing.current.points = [pts[0], end]
    } else {
      const evts = e.getCoalescedEvents ? e.getCoalescedEvents() : []
      if (evts.length) evts.forEach((ev) => addPoint(ev.clientX, ev.clientY, ev.pressure))
      else addPoint(e.clientX, e.clientY, e.pressure)
    }
    scheduleDraw()
    broadcastDrawing(false)
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current = null
    panning.current = null

    // Завершение перемещения выделенного — рассылаем сдвинутые штрихи и сохраняем
    if (movingSel.current) {
      movingSel.current = null
      for (const id of selection.current) {
        const s = strokes.current.get(id)
        if (s) channelRef.current?.send({ type: "broadcast", event: "draw", payload: s })
      }
      scheduleSave()
      return
    }
    // Завершение рамки — выбираем штрихи, попавшие в неё (крошечная рамка = клик = снять выделение)
    if (marquee.current) {
      const m = marquee.current; marquee.current = null
      const rect = { minX: Math.min(m.x0, m.x1), minY: Math.min(m.y0, m.y1), maxX: Math.max(m.x0, m.x1), maxY: Math.max(m.y0, m.y1) }
      selection.current.clear()
      if (Math.abs(m.x1 - m.x0) > 4 || Math.abs(m.y1 - m.y0) > 4) {
        for (const [id, s] of strokes.current) if (rectsIntersect(rect, strokeBBox(s))) selection.current.add(id)
      } else {
        // Крошечная рамка = одиночный клик: выделяем верхний объект под курсором
        const tol = 6 / view.current.scale
        let hit = null
        for (const [id, s] of strokes.current) if (hitStroke(s, m.x0, m.y0, tol)) hit = id
        if (hit) selection.current.add(hit)
      }
      applySelCount(selection.current.size)
      scheduleDraw()
      return
    }

    if (!drawing.current) return
    const s = drawing.current
    drawing.current = null
    strokes.current.set(s.id, s)
    redoStack.current = []
    broadcastDrawing(true)
    scheduleDraw(); scheduleSave()
  }

  function deleteSelection() {
    if (!selection.current.size) return
    for (const id of selection.current) {
      strokes.current.delete(id)
      channelRef.current?.send({ type: "broadcast", event: "remove", payload: { id } })
    }
    selection.current.clear(); applySelCount(0)
    scheduleDraw(); scheduleSave()
  }

  // Рассылка изменённых штрихов после трансформации/правки + сохранение
  function commitSelection() {
    for (const id of selection.current) {
      const s = strokes.current.get(id)
      if (s) channelRef.current?.send({ type: "broadcast", event: "draw", payload: s })
    }
    redoStack.current = []; scheduleSave()
  }

  // Масштабирование (углы nw/ne/se/sw — обе оси, рёбра n/e/s/w — одна ось) или поворот "rotate"
  function startTransform(handle, e) {
    e.preventDefault(); e.stopPropagation()
    const bb = selectionBBox(); if (!bb) return
    const mode = handle === "rotate" ? "rotate" : "resize"
    const center = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
    // Знаки ручки: угол = обе оси, ребро = одна ось
    const hx = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0
    const hy = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0
    const enc = mode === "resize" ? singleEnclosed() : null
    const startW = toWorld(e.clientX, e.clientY)
    const snapshot = new Map()
    for (const id of selection.current) {
      const s = strokes.current.get(id)
      if (s) snapshot.set(id, { points: s.points.map((p) => [...p]), angle: s.angle || 0 })
    }
    // Одиночная фигура — масштаб вдоль её собственных (наклонённых) осей
    let L = null
    if (enc) {
      const snap = snapshot.get(enc.id)
      const a0 = snap.points[0], b0 = snap.points[snap.points.length - 1]
      const hw0 = Math.abs(b0[0] - a0[0]) / 2, hh0 = Math.abs(b0[1] - a0[1]) / 2
      const cx0 = (a0[0] + b0[0]) / 2, cy0 = (a0[1] + b0[1]) / 2
      const ang = snap.angle, u = [Math.cos(ang), Math.sin(ang)], vv = [-Math.sin(ang), Math.cos(ang)]
      const pv = [cx0 - hx * hw0 * u[0] - hy * hh0 * vv[0], cy0 - hx * hw0 * u[1] - hy * hh0 * vv[1]]
      const dot = (p, ax) => (p[0] - pv[0]) * ax[0] + (p[1] - pv[1]) * ax[1]
      L = { id: enc.id, a0, b0, hw0, hh0, ang, u, vv, pv, startU: dot(startW, u), startV: dot(startW, vv) }
    }
    // Мировая опора для группового/линейного масштаба
    const px = hx > 0 ? bb.minX : hx < 0 ? bb.maxX : center[0]
    const py = hy > 0 ? bb.minY : hy < 0 ? bb.maxY : center[1]
    const startAngle = Math.atan2(startW[1] - center[1], startW[0] - center[0])
    transform.current = { mode }

    const move = (ev) => {
      const w = toWorld(ev.clientX, ev.clientY)
      if (mode === "resize" && enc) {
        const s = strokes.current.get(L.id); if (!s) return
        const dot = (p, ax) => (p[0] - L.pv[0]) * ax[0] + (p[1] - L.pv[1]) * ax[1]
        let scaleU = hx !== 0 && L.startU ? dot(w, L.u) / L.startU : 1
        let scaleV = hy !== 0 && L.startV ? dot(w, L.vv) / L.startV : 1
        if (ev.shiftKey && hx !== 0 && hy !== 0) { const k = Math.max(Math.abs(scaleU), Math.abs(scaleV)); scaleU = Math.sign(scaleU || 1) * k; scaleV = Math.sign(scaleV || 1) * k }
        const nhw = Math.max(2, L.hw0 * Math.abs(scaleU)), nhh = Math.max(2, L.hh0 * Math.abs(scaleV))
        const cU = hx !== 0 ? hx * L.hw0 * scaleU : 0, cV = hy !== 0 ? hy * L.hh0 * scaleV : 0
        const ncx = L.pv[0] + cU * L.u[0] + cV * L.vv[0], ncy = L.pv[1] + cU * L.u[1] + cV * L.vv[1]
        // Толщина обводки НЕ меняется — только габарит + сохранённый угол
        s.points = [[ncx - nhw, ncy - nhh, ...L.a0.slice(2)], [ncx + nhw, ncy + nhh, ...L.b0.slice(2)]]
        s.angle = L.ang
      } else if (mode === "resize") {
        const lockX = hx === 0, lockY = hy === 0
        let sx = lockX ? 1 : ((startW[0] - px) ? (w[0] - px) / (startW[0] - px) : 1)
        let sy = lockY ? 1 : ((startW[1] - py) ? (w[1] - py) / (startW[1] - py) : 1)
        if (ev.shiftKey && !lockX && !lockY) { const k = Math.max(Math.abs(sx), Math.abs(sy)); sx = Math.sign(sx || 1) * k; sy = Math.sign(sy || 1) * k }
        for (const [id, snap] of snapshot) {
          const s = strokes.current.get(id); if (!s) continue
          s.points = snap.points.map((p) => [px + (p[0] - px) * sx, py + (p[1] - py) * sy, ...p.slice(2)])
        }
      } else {
        let ang = Math.atan2(w[1] - center[1], w[0] - center[0]) - startAngle
        if (ev.shiftKey) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12) // шаг 15°
        const cos = Math.cos(ang), sin = Math.sin(ang), cx = center[0], cy = center[1]
        const rot = (p) => { const dx = p[0] - cx, dy = p[1] - cy; return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos, ...p.slice(2)] }
        for (const [id, snap] of snapshot) {
          const s = strokes.current.get(id); if (!s) continue
          if (ENCLOSED_SHAPES.has(s.tool)) {
            // Габаритные фигуры рисуются как axis-aligned box: поворачиваем ЦЕНТР
            // вокруг центра группы (габарит не крутится) + храним угол для отрисовки
            const a = snap.points[0], b = snap.points[snap.points.length - 1]
            const oc = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
            const nc = rot([oc[0], oc[1]])
            const dx = nc[0] - oc[0], dy = nc[1] - oc[1]
            s.points = snap.points.map((p) => [p[0] + dx, p[1] + dy, ...p.slice(2)])
            s.angle = snap.angle + ang
          } else {
            // Перо/линия/стрелка — поворот вшивается прямо в точки
            s.points = snap.points.map(rot)
          }
        }
      }
      scheduleDraw()
    }
    const end = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", end)
      transform.current = null
      commitSelection(); scheduleDraw()
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", end)
  }

  // Добавить картинку из файла в точке (мировые координаты).
  // fitWidth — положить в заданную ШИРИНУ (лист с заданием: длинное условие иначе
  // ужалось бы по высоте и стало нечитаемым), иначе вписываем по большей стороне.
  async function addImageAt(file, worldX, worldY, { fitWidth = null, maxSide = 360, sheet = false } = {}) {
    if (!file || !file.type?.startsWith("image/")) return
    let info
    try { info = await processImageFile(file) } catch { return }
    const id = makeId(userId)
    let src = info.dataUrl
    try {
      const path = `board/${roomId}/${id}.${info.ext}`
      const { error } = await supabase.storage.from(IMG_BUCKET).upload(path, info.blob, { upsert: true, contentType: info.type })
      if (!error) src = supabase.storage.from(IMG_BUCKET).getPublicUrl(path).data.publicUrl
    } catch { /* остаётся data URL как запасной вариант */ }
    const k = fitWidth ? fitWidth / info.w : Math.min(1, maxSide / Math.max(info.w, info.h))
    const ww = info.w * k, hh = info.h * k
    const s = { id, author: userId, tool: "image", src, points: [[worldX - ww / 2, worldY - hh / 2], [worldX + ww / 2, worldY + hh / 2]] }
    if (sheet) s.sheet = 1   // лист с заданием: рисуется в цветах доски, а не как фото
    // Своя картинка уже в памяти — кладём её в кэш под итоговым адресом, чтобы лист
    // появился мгновенно, не дожидаясь подписи и сети.
    getImage(src) // начать загрузку/кэшировать для мгновенной отрисовки
    strokes.current.set(id, s)
    channelRef.current?.send({ type: "broadcast", event: "draw", payload: s })
    redoStack.current = []
    setTool("cursor"); selection.current = new Set([id]); setSelCount(1)
    scheduleDraw(); scheduleSave()
  }

  function onDragOver(e) {
    if (Array.from(e.dataTransfer.types || []).includes("Files")) { e.preventDefault(); if (!dragActive) setDragActive(true) }
  }
  function onDragLeaveWrap(e) {
    if (e.target === e.currentTarget) setDragActive(false)
  }
  function onDropWrap(e) {
    e.preventDefault(); setDragActive(false)
    const file = Array.from(e.dataTransfer.files || []).find((f) => f.type.startsWith("image/"))
    if (file) { const [wx, wy] = toWorld(e.clientX, e.clientY); addImageAt(file, wx, wy) }
  }
  // Выбор картинки через кнопку → в центр видимой области
  function onPickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = "" // позволяем выбрать тот же файл повторно
    if (!file) return
    const c = canvasRef.current; if (!c) return
    const r = c.getBoundingClientRect()
    const [wx, wy] = toWorld(r.left + c.clientWidth / 2, r.top + c.clientHeight / 2)
    addImageAt(file, wx, wy)
  }

  // Лист с заданием из банка — в центр видимой области. Каждое следующее смещаем
  // лесенкой: иначе задания легли бы ровно друг на друга и выглядели бы как одно.
  async function insertTaskSheet(file, sheetWidth) {
    const c = canvasRef.current; if (!c) return
    const r = c.getBoundingClientRect()
    const step = (taskShift.current++ % 6) * 26
    const [wx, wy] = toWorld(r.left + c.clientWidth / 2 + step, r.top + c.clientHeight / 2 + step)
    await addImageAt(file, wx, wy, { fitWidth: sheetWidth, sheet: true })
  }

  function duplicateSelection() {
    if (!selection.current.size) return
    const next = new Set()
    for (const id of selection.current) {
      const s = strokes.current.get(id); if (!s) continue
      const ns = { ...s, id: makeId(userId), author: userId, points: s.points.map((p) => [p[0] + 16, p[1] + 16, ...p.slice(2)]) }
      strokes.current.set(ns.id, ns)
      channelRef.current?.send({ type: "broadcast", event: "draw", payload: ns })
      next.add(ns.id)
    }
    selection.current = next; applySelCount(next.size)
    redoStack.current = []; scheduleDraw(); scheduleSave()
  }

  function setSelectionColor(c) {
    if (!selection.current.size) return
    for (const id of selection.current) { const s = strokes.current.get(id); if (s && s.tool !== "eraser") s.color = c }
    commitSelection(); scheduleDraw()
  }
  function setSelectionWidth(w) {
    if (!selection.current.size) return
    for (const id of selection.current) {
      const s = strokes.current.get(id); if (!s || s.tool === "eraser") continue
      const cur = s.width || 3, k = w / cur
      s.width = w
      s.points = s.points.map((p) => p.length > 2 ? [p[0], p[1], p[2] * k, ...p.slice(3)] : p)
    }
    commitSelection(); scheduleDraw()
  }
  function setSelectionDash(d) {
    if (!selection.current.size) return
    for (const id of selection.current) { const s = strokes.current.get(id); if (s && s.tool !== "eraser") s.dash = d }
    commitSelection(); scheduleDraw()
  }
  function setSelectionCorner(cn) {
    if (!selection.current.size) return
    for (const id of selection.current) { const s = strokes.current.get(id); if (s && s.tool !== "eraser") s.corner = cn }
    commitSelection(); scheduleDraw()
  }

  // --- Действия -----------------------------------------------------------
  function undo() {
    let lastId = null
    for (const [id, s] of strokes.current) if (s.author === userId) lastId = id
    if (!lastId) return
    redoStack.current.push(strokes.current.get(lastId))
    strokes.current.delete(lastId)
    channelRef.current?.send({ type: "broadcast", event: "remove", payload: { id: lastId } })
    scheduleDraw(); scheduleSave()
  }
  function redo() {
    const s = redoStack.current.pop()
    if (!s) return
    strokes.current.set(s.id, s)
    channelRef.current?.send({ type: "broadcast", event: "draw", payload: s })
    scheduleDraw(); scheduleSave()
  }
  function clearAll() {
    strokes.current.clear(); redoStack.current = []
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} })
    scheduleDraw(); scheduleSave()
  }
  function changeBg(mode) {
    setBg(mode)
    channelRef.current?.send({ type: "broadcast", event: "bg", payload: { bg: mode } })
    scheduleSave()
  }
  function changeBgColor(hex) {
    setBgColor(hex)
    channelRef.current?.send({ type: "broadcast", event: "bg", payload: { bgColor: hex } })
    scheduleSave()
  }
  function toggleTheme() {
    changeBgColor(isDarkColor(bgColor) ? BG_LIGHT : BG_DARK)
  }
  function pickShape(id) {
    setShapeTool(id); setTool(id); closeMenu()
  }
  function zoomBy(factor) {
    const c = canvasRef.current
    zoomAt(c.clientWidth / 2, c.clientHeight / 2, factor)
    scheduleDraw()
  }
  function resetView() {
    view.current = { x: 0, y: 0, scale: 1 }; setZoomPct(100); scheduleDraw()
  }

  useEffect(() => { actions.current.undo = undo; actions.current.redo = redo; actions.current.del = deleteSelection; actions.current.paste = addImageAt })
  // Вставка картинки из буфера обмена (Ctrl/Cmd+V) — в центр видимой области
  useEffect(() => {
    function onPaste(e) {
      const tag = e.target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"))
      const file = item?.getAsFile()
      if (!file) return
      e.preventDefault()
      const c = canvasRef.current; if (!c) return
      const r = c.getBoundingClientRect()
      const [wx, wy] = toWorld(r.left + c.clientWidth / 2, r.top + c.clientHeight / 2)
      actions.current.paste?.(file, wx, wy)
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [])
  // Смена инструмента сбрасывает выделение
  useEffect(() => {
    if (tool === "cursor") return
    selection.current.clear(); marquee.current = null; movingSel.current = null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applySelCount(0)
    scheduleDraw()
  }, [tool, scheduleDraw])
  useEffect(() => {
    // По e.code (физическая клавиша) — иначе на русской раскладке e.key = «з/у/…» и не совпадает
    const TOOL_CODES = { KeyP: "pen", KeyE: "eraser", KeyL: "line", KeyR: "rect", KeyH: "hand", KeyV: "cursor" }
    function onKeyDown(e) {
      if (modalOpen.current) return   // поверх доски открыт выбор задания — клавиши не наши
      if (e.code === "Space" && !e.repeat && e.target === document.body) { spaceHeld.current = true }
      if (e.metaKey || e.ctrlKey) {
        if (e.code === "KeyZ") { e.preventDefault(); e.shiftKey ? actions.current.redo() : actions.current.undo() }
        else if (e.code === "KeyY") { e.preventDefault(); actions.current.redo() }
        return
      }
      // Горячие клавиши инструментов (без модификаторов, не в поле ввода)
      const tag = e.target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return
      if (e.code === "Escape") { setTool("cursor"); closeMenuRef.current(); return }
      if (e.code === "Delete" || e.code === "Backspace") { e.preventDefault(); actions.current.del(); return }
      const t = TOOL_CODES[e.code]
      if (t) { setTool(t); if (SHAPE_TOOLS.has(t)) setShapeTool(t) }
    }
    function onKeyUp(e) { if (e.code === "Space") spaceHeld.current = false }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp) }
  }, [])

  const others = online.filter((p) => p.userId !== userId)
  const TOOLS = [
    { id: "cursor", icon: "cursor", label: "Курсор", key: "Esc" },
    { id: "pen", icon: "pencil", label: "Перо", key: "P" },
    { id: "line", icon: "line", label: "Линия", key: "L" },
    { id: "shapes", shapes: true },
    { id: "eraser", icon: "eraser", label: "Ластик", key: "E" },
    { id: "hand", icon: "move", label: "Двигать полотно", key: "H" },
  ]
  const SHAPES_2D = [
    { id: "rect", icon: "square", label: "Прямоугольник" },
    { id: "circle", icon: "circle", label: "Круг" },
    { id: "triangle", icon: "triangle", label: "Треугольник" },
    { id: "diamond", icon: "diamond", label: "Ромб" },
    { id: "arrow", icon: "arrow", label: "Стрелка" },
  ]
  const SHAPES_3D = [
    { id: "cube", icon: "cube", label: "Куб" },
    { id: "cylinder", icon: "cylinder", label: "Цилиндр" },
    { id: "cone", icon: "cone", label: "Конус" },
    { id: "sphere", icon: "sphere", label: "Шар" },
    { id: "pyramid", icon: "pyramid", label: "Пирамида" },
  ]
  const shapeIconOf = (id) => [...SHAPES_2D, ...SHAPES_3D].find((s) => s.id === id)?.icon || "square"
  const shapeMenuIds = new Set([...SHAPES_2D, ...SHAPES_3D].map((s) => s.id)) // фигуры из меню (без «Линии» — у неё своя кнопка)
  const BGS = [
    { id: "plain", label: "Чистый" },
    { id: "grid", label: "Клетка" },
    { id: "dots", label: "Точки" },
  ]
  const divider = <div className="w-px h-6 mx-0.5" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)" }} />
  const panelBg = dark ? "#2c2c2e" : "#fff"
  const panelBorder = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"
  const cursor = tool === "cursor" ? "default" : tool === "hand" ? "grab" : "crosshair"

  // Ручки выделения из ОРИЕНТИРОВАННОЙ рамки {cx,cy,ax,ay,angle} (экранные координаты)
  const H = selBox
  // Точка рамки по локальным знакам (sx,sy ∈ -1..1): центр + sx·ax + sy·ay
  const framePt = (sx, sy) => H ? { x: H.cx + sx * H.ax.x + sy * H.ay.x, y: H.cy + sx * H.ax.y + sy * H.ay.y } : null
  const cornerHandles = H ? [
    { k: "nw", c: "nwse-resize", ...framePt(-1, -1) }, { k: "ne", c: "nesw-resize", ...framePt(1, -1) },
    { k: "se", c: "nwse-resize", ...framePt(1, 1) }, { k: "sw", c: "nesw-resize", ...framePt(-1, 1) },
  ] : []
  const edgeHandles = H ? [
    { k: "n", c: "ns-resize", ...framePt(0, -1) }, { k: "s", c: "ns-resize", ...framePt(0, 1) },
    { k: "e", c: "ew-resize", ...framePt(1, 0) }, { k: "w", c: "ew-resize", ...framePt(-1, 0) },
  ] : []
  // Геометрия рамки-div и ручки поворота
  const frameW = H ? 2 * Math.hypot(H.ax.x, H.ax.y) : 0
  const frameH = H ? 2 * Math.hypot(H.ay.x, H.ay.y) : 0
  const axLen = H ? Math.hypot(H.ax.x, H.ax.y) : 1
  const ayLen = H ? Math.hypot(H.ay.x, H.ay.y) : 1
  // Ручка поворота — у нижне-ЛЕВОГО угла рамки, смещена наружу (по -ax и +ay)
  const rotatePt = H ? {
    x: framePt(-1, 1).x + (-H.ax.x / axLen + H.ay.x / ayLen) * 18,
    y: framePt(-1, 1).y + (-H.ax.y / axLen + H.ay.y / ayLen) * 18,
  } : null
  // Панель свойств — над верхним краем рамки; при нехватке места сверху уводим вниз
  const topPt = H ? framePt(0, -1) : null
  const barAbove = H && topPt.y - 54 >= 8
  const barY = H ? (barAbove ? topPt.y - 54 : framePt(0, 1).y + 30) : 0
  const barX = H ? H.cx : 0

  return (
    <div data-board-version="12" className="fixed inset-0 z-[100000] flex flex-col" style={{ background: baseBg }}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-3 h-12 border-b flex-shrink-0"
        style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)" }}>
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: dark ? "#e5e5ea" : "#374151" }}>
          <Icon name="clipboard" size={16} /> Доска
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} title={dark ? "Светлая доска" : "Тёмная доска"}
            className="press-tap p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-black/5 dark:hover:bg-white/10">
            <Icon name={dark ? "sun" : "moon"} size={16} />
          </button>
          <div className="flex items-center -space-x-1.5">
            {others.map((p) => (
              <span key={p.userId} title={p.name}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                style={{ background: colorFor(p.userId), boxShadow: `0 0 0 2px ${baseBg}` }}>
                {(p.name || "?").slice(0, 1).toUpperCase()}
              </span>
            ))}
            {others.length > 0 && <span className="pl-3 text-xs text-gray-400">в сети</span>}
          </div>
          <span className="text-xs text-gray-400 w-16 text-right">
            {saveState === "saving" ? "сохр…" : saveState === "saved" ? "сохранено" : ""}
          </span>
          <button onClick={closeBoard}
            className="press-tap p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-black/5 dark:hover:bg-white/10">
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>

      {/* Холст на всю область */}
      <div ref={wrapRef} className="flex-1 min-h-0 relative overflow-hidden"
        onDragOver={onDragOver} onDragLeave={onDragLeaveWrap} onDrop={onDropWrap}>
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor }}
        />

        {/* Подсказка при перетаскивании файла */}
        {dragActive && (
          <div className="absolute inset-2 rounded-2xl flex items-center justify-center pointer-events-none"
            style={{ border: "2px dashed #007AFF", background: "rgba(0,122,255,.06)" }}>
            <span className="px-3 py-1.5 rounded-xl text-sm font-medium shadow-lg"
              style={{ background: panelBg, border: `1px solid ${panelBorder}`, color: dark ? "#e5e5ea" : "#374151" }}>
              Отпустите, чтобы добавить изображение
            </span>
          </div>
        )}

        {/* Оверлей выделения: рамка + ручки + панель свойств */}
        {H && selCount > 0 && (
          <>
            {/* Рамка (поворачивается вместе с фигурой) */}
            <div className="absolute pointer-events-none"
              style={{ left: H.cx, top: H.cy, width: frameW, height: frameH,
                transform: `translate(-50%, -50%) rotate(${H.angle}rad)`, border: "1.5px solid #007AFF", borderRadius: 2 }} />

            {/* Рёбра (масштаб по одной оси) */}
            {edgeHandles.map((h) => (
              <div key={h.k} onPointerDown={(e) => startTransform(h.k, e)}
                className="absolute rounded-full"
                style={{ left: h.x - 5, top: h.y - 5, width: 10, height: 10, cursor: h.c, touchAction: "none",
                  background: dark ? "#5c5c60" : "#c7c7cc", boxShadow: "0 0 0 1.5px #fff" }} />
            ))}

            {/* Углы (масштаб по обеим осям) */}
            {cornerHandles.map((h) => (
              <div key={h.k} onPointerDown={(e) => startTransform(h.k, e)}
                className="absolute rounded-[3px]"
                style={{ left: h.x - 6, top: h.y - 6, width: 12, height: 12, cursor: h.c, touchAction: "none",
                  background: "#fff", boxShadow: "0 0 0 1.5px #007AFF, 0 1px 2px rgba(0,0,0,.2)" }} />
            ))}

            {/* Поворот */}
            <div onPointerDown={(e) => startTransform("rotate", e)} title="Повернуть"
              className="absolute flex items-center justify-center rounded-full"
              style={{ left: rotatePt.x - 12, top: rotatePt.y - 12, width: 24, height: 24, cursor: "grab", touchAction: "none",
                background: "#fff", boxShadow: "0 0 0 1.5px #007AFF, 0 1px 3px rgba(0,0,0,.2)", color: "#007AFF" }}>
              <Icon name="rotate" size={13} />
            </div>

            {/* Панель свойств — по центру над рамкой */}
            <div className="absolute flex items-center gap-1 px-2 py-1.5 rounded-2xl shadow-lg popup-bubble pointer-events-auto"
              style={{ left: barX, top: barY, transform: "translateX(-50%)", background: panelBg, border: `1px solid ${panelBorder}`, maxWidth: "92vw", flexWrap: "wrap" }}>
              {colors.map((c) => (
                <button key={c} onClick={() => setSelectionColor(c)} title={c === "ink" ? "Чернила" : "Цвет"}
                  className="press-tap w-6 h-6 rounded-full flex items-center justify-center">
                  <span className="rounded-full" style={{ width: 17, height: 17, background: resolveColor(c, dark),
                    boxShadow: `0 0 0 1px ${dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)"}` }} />
                </button>
              ))}
              {divider}
              {/* Настройки обводки для выделения */}
              <div className="relative" data-menu>
                <button onClick={() => toggleMenu("selStroke")} title="Настройки обводки"
                  className="press-tap w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">
                  <Icon name="stroke" size={16} />
                </button>
                {menuShown("selStroke") && (
                  <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 p-2 rounded-xl shadow-lg z-10 ${menuAnim("selStroke")}`}
                    style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
                    <StrokeSettings dark={dark} tool={selProps?.tool} curWidth={selProps?.width} curDash={selProps?.dash || "solid"} curCorner={selProps?.corner || "sharp"}
                      onWidth={setSelectionWidth} onDash={setSelectionDash} onCorner={setSelectionCorner} />
                  </div>
                )}
              </div>
              {divider}
              <button onClick={duplicateSelection} title="Дублировать"
                className="press-tap w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">
                <Icon name="copy" size={15} />
              </button>
              <button onClick={deleteSelection} title="Удалить (Delete)"
                className="press-tap w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10">
                <Icon name="trash" size={15} />
              </button>
            </div>
          </>
        )}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="loader-logo" /></div>
        )}

        {/* Зум-контролы */}
        <div className="absolute bottom-4 right-4 flex flex-col rounded-xl shadow-lg overflow-hidden"
          style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
          <button onClick={() => zoomBy(1.2)} title="Приблизить"
            className="press-tap w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">
            <Icon name="plus" size={16} />
          </button>
          <button onClick={resetView} title="Сбросить масштаб"
            className="press-tap h-7 flex items-center justify-center text-[10px] text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 border-y"
            style={{ borderColor: panelBorder }}>
            {zoomPct}%
          </button>
          <button onClick={() => zoomBy(1 / 1.2)} title="Отдалить"
            className="press-tap w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">
            <Icon name="minus" size={16} />
          </button>
        </div>

        {/* Панель инструментов — плавает поверх холста, чтобы вся область была доской */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center px-3 pointer-events-none">
        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl px-2 py-1.5 shadow-lg relative pointer-events-auto max-w-full"
          style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
          {TOOLS.map((t) => t.shapes ? (
            <div key="shapes" className="relative" data-menu>
              <button onClick={() => toggleMenu("shapes")}
                className={`group relative press-tap w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  shapeMenuIds.has(tool) ? "bg-blue-500 text-white" : "text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
                }`}>
                <Icon name={shapeIconOf(shapeTool)} size={17} />
                <Tip label="Фигуры" dark={dark} />
              </button>
              {menuShown("shapes") && (
                <div className={`absolute bottom-11 left-1/2 -translate-x-1/2 flex flex-col gap-2 p-2 rounded-xl shadow-lg ${menuAnim("shapes")}`}
                  style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
                  {[["Плоские", SHAPES_2D], ["Объёмные", SHAPES_3D]].map(([title, list]) => (
                    <div key={title}>
                      <div className="text-[10px] uppercase tracking-wide px-1 mb-1" style={{ color: dark ? "#8e8e93" : "#9ca3af" }}>{title}</div>
                      <div className="flex gap-1">
                        {list.map((s) => (
                          <button key={s.id} onClick={() => pickShape(s.id)} title={s.label}
                            className={`press-tap w-9 h-9 rounded-lg flex items-center justify-center ${tool === s.id ? "bg-blue-500 text-white" : "text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"}`}>
                            <Icon name={s.icon} size={18} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button key={t.id} onClick={() => setTool(t.id)}
              className={`group relative press-tap w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                tool === t.id ? "bg-blue-500 text-white" : "text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
              }`}>
              <Icon name={t.icon} size={17} />
              <Tip label={t.label} hotkey={t.key} dark={dark} />
            </button>
          ))}

          {divider}

          {colors.map((c) => {
            const shown = resolveColor(c, dark) // «чернила» показываем реальным цветом
            const active = color === c && tool !== "eraser"
            return (
              <button key={c} onClick={() => { setColor(c); if (tool === "eraser" || tool === "hand" || tool === "cursor") setTool("pen") }}
                className="press-tap w-7 h-7 rounded-full flex items-center justify-center" title={c === "ink" ? "Чернила" : "Цвет"}>
                <span className="rounded-full" style={{
                  width: active ? 22 : 18,
                  height: active ? 22 : 18,
                  background: shown,
                  boxShadow: active ? "0 0 0 2px #007AFF" : `0 0 0 1px ${dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)"}`,
                  transition: "all .12s",
                }} />
              </button>
            )
          })}

          {divider}

          {/* Настройки обводки */}
          <div className="relative" data-menu>
            <button onClick={() => toggleMenu("stroke")}
              className="group relative press-tap w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">
              <Icon name="stroke" size={17} />
              <Tip label="Настройки обводки" dark={dark} />
            </button>
            {menuShown("stroke") && (
              <div className={`absolute bottom-11 left-1/2 -translate-x-1/2 p-2 rounded-xl shadow-lg ${menuAnim("stroke")}`}
                style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
                <StrokeSettings dark={dark} tool={tool} curWidth={width} curDash={dash} curCorner={corner} onWidth={setWidth} onDash={setDash} onCorner={setCorner} />
              </div>
            )}
          </div>

          {divider}

          {/* Загрузить картинку */}
          <button onClick={() => fileInputRef.current?.click()}
            className="group relative press-tap w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">
            <Icon name="image" size={17} />
            <Tip label="Добавить картинку" dark={dark} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />

          {/* Задание из банка листом на доску */}
          {canAddTasks && (
            <button onClick={() => { modalOpen.current = true; setTaskPick(true) }}
              className={`group relative press-tap w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                taskPick ? "bg-blue-500 text-white" : "text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
              }`}>
              <Icon name="book" size={17} />
              <Tip label="Задание из банка" dark={dark} />
            </button>
          )}

          {divider}

          {/* Фон */}
          <div className="relative" data-menu>
            <button onClick={() => toggleMenu("bg")}
              className={`group relative press-tap w-9 h-9 rounded-xl flex items-center justify-center ${bg !== "plain" ? "text-blue-500" : "text-gray-500"} hover:bg-black/5 dark:hover:bg-white/10`}>
              <Icon name="grid" size={17} />
              <Tip label="Фон доски" dark={dark} />
            </button>
            {menuShown("bg") && (
              <div className={`absolute bottom-11 left-1/2 -translate-x-1/2 flex flex-col gap-2 p-2 rounded-xl shadow-lg ${menuAnim("bg")}`}
                style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
                {/* Узор */}
                <div className="flex gap-1">
                  {BGS.map((b) => (
                    <button key={b.id} onClick={() => changeBg(b.id)} title={b.label}
                      className={`press-tap px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap ${bg === b.id ? "bg-blue-500 text-white" : "text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"}`}>
                      {b.label}
                    </button>
                  ))}
                </div>
                {/* Цвет фона */}
                <div className="flex gap-1.5 justify-center pt-0.5">
                  {BG_COLORS.map((hex) => (
                    <button key={hex} onClick={() => changeBgColor(hex)} title="Цвет фона"
                      className="press-tap w-6 h-6 rounded-full flex items-center justify-center">
                      <span className="rounded-full" style={{
                        width: bgColor === hex ? 22 : 18, height: bgColor === hex ? 22 : 18, background: hex,
                        boxShadow: bgColor === hex ? "0 0 0 2px #007AFF" : `0 0 0 1px ${dark ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.15)"}`,
                        transition: "all .12s",
                      }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {divider}

          <button onClick={undo}
            className="group relative press-tap w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">
            <Icon name="undo" size={17} />
            <Tip label="Отменить" hotkey="⌘Z" dark={dark} />
          </button>
          <button onClick={redo}
            className="group relative press-tap w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">
            <Icon name="redo" size={17} />
            <Tip label="Вернуть" hotkey="⌘⇧Z" dark={dark} />
          </button>
          <button onClick={clearAll}
            className="group relative press-tap w-9 h-9 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-500/10">
            <Icon name="trash" size={17} />
            <Tip label="Очистить всё" dark={dark} />
          </button>
        </div>
        </div>
      </div>

      {/* Банк заданий грузится отдельным куском — без заглушки клик выглядел бы
          как «ничего не произошло» */}
      {taskPick && (
        <Suspense fallback={<div className="fixed inset-0 z-[100010] flex items-center justify-center" style={{ background: "rgba(0,0,0,.15)" }}><div className="loader-logo" /></div>}>
          <BoardTaskModal
            dark={dark}
            onInsert={insertTaskSheet}
            onClose={() => { modalOpen.current = false; setTaskPick(false) }}
          />
        </Suspense>
      )}
    </div>
  )
}
