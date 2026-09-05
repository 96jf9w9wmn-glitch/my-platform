import { useState, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense } from "react"
import { supabase } from "../supabase"
import { signBoardScene, signStorageUrl } from "../storageUrl"
import Icon from "./Icon"
import ConfirmModal from "./ConfirmModal"
import { useClosing, CLOSE_MS, POPUP_OUT_MS } from "../useClosing"
import { recognizeShape } from "./boardSmartDraw"
import {
  GRID, ENCLOSED_SHAPES, SHAPE_TOOLS, DASHABLE_SHAPES,
  isDarkColor, resolveColor, strokeBBox, sceneBBox, viewForBBox, paintStroke, scenePreview, tintSheet,
} from "./boardPaint"
// Выбор задания тянет за собой генераторы всех предметов и html2canvas — грузим
// только когда репетитор открыл выбор, иначе доска стала бы тяжелее на мегабайты.
const BoardTaskModal = lazy(() => import("./BoardTaskModal"))

// Совместная доска платформы (свой движок на HTML5 Canvas, без внешних библиотек).
// БЕСКОНЕЧНЫЙ холст на весь экран: штрихи хранятся в МИРОВЫХ координатах, у каждого
// клиента свой обзор (view = смещение + масштаб) — можно зумить и двигать полотно
// независимо, при этом рисунок общий. Одна комната = один ученик (roomId = student.id).
// Синхронизация через Supabase Realtime broadcast; снапшот сцены — в таблицу boards.

// Толщина маркера задаётся ползунком: три готовые ступени не покрывали ни
// тонкую подпись под чертежом, ни жирную линию, видную ученику с телефона.
const WIDTH_MIN = 1, WIDTH_MAX = 30, WIDTH_DEFAULT = 3
const MIN_SCALE = 0.15, MAX_SCALE = 8

const HISTORY_MAX = 100      // шагов «отменить» держим столько же, сколько привычно в редакторах
// Копия штриха для истории: points — массив массивов, поверхностная копия его бы разделила
const cloneStroke = (s) => s && { ...s, points: s.points.map((p) => p.slice()) }
const SHEET_MAX_DIM = 4000   // лист с заданием: длинные условия не должны терять чёткость
// Затухание доски и стало общей «походкой» ухода для всего сайта: значение
// живёт в CLOSE_MS (useClosing.js) и в --leave-ms (index.css), здесь только имя
// для читаемости. Хук снимает доску, когда затухание кончилось.
const BOARD_CLOSE_MS = CLOSE_MS
const BG_LIGHT = "#ffffff", BG_DARK = "#1c1c1e"
const BG_COLORS = ["#ffffff", "#f2f2f7", "#fdf6e3", "#1c1c1e", "#0f172a", "#123a2e"]

// «Чернила» — первый цвет палитры; хранится как маркер "ink" и адаптируется под фон.
// Остальные взяты насыщенными (не пастельными): на тёмной доске бледный цвет
// сливался с фоном, и кружок в панели было не различить.
const BASE_INKS = ["ink", "#0A84FF", "#FF3B30", "#30D158", "#FF9F0A", "#BF5AF2"]
const SMART_KEY = "board-smart-draw"
// Где на бесконечном холсте лежит работа — вопрос не праздный: доска за учебный
// год уезжает вниз на десятки экранов, а вход всегда открывал точку (0,0), то
// есть самое начало. Написанное за время отсутствия оказывалось далеко за краем
// экрана, и человек видел пустоту вместо чужой работы. Поэтому вход открывается
// у СВЕЖИХ записей, а своё место запоминается на устройстве.
const VIEW_KEY = "board-view"       // localStorage: последний обзор по каждой доске
const FRESH_STROKES = 24            // «последние записи» — примерно последняя строка-две
const OFFSCREEN_HINT_MS = 8000      // столько висит подсказка «пишут за краем экрана»

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
// Частота, с которой доска уходит собеседнику. Чем она выше, тем ровнее у него
// растёт линия, но тем плотнее поток в общем канале; сервер realtime держит до
// сотни сообщений в секунду на клиента, и суммы ниже в неё укладываются с
// запасом (курсор и штрих не идут одновременно — курсор не шлётся, пока ведут
// линию, а обзор — только когда за нами кто-то следит).
const POINTER_RATE = 40 // не чаще 1 посылки в 40 мс (25/сек)
const CURSORS_KEY = "board-cursors"   // личная настройка «показывать курсоры собеседников»
const VIEW_RATE = 60    // не чаще 1 посылки своего обзора в 60 мс: за ним следят глазами
// Прилипание при перетаскивании: допуск в ЭКРАННЫХ пикселях (в мировые переводим
// делением на масштаб — иначе на приближённой доске объект липнул бы за версту).
const SNAP_PX = 6
const GUIDE_COLOR = "#FF2D55"  // направляющая заметно отличается от синей рамки выделения
const STROKE_RATE = 30  // не чаще 1 посылки дописанных точек в 30 мс (33/сек)
// Точки штриха округляются до сотых мировой единицы: на экране это доли пикселя
// даже при максимальном увеличении, зато и по сети, и в снапшоте сцены каждая
// точка занимает втрое меньше места, чем сырой double.
const q2 = (n) => Math.round(n * 100) / 100
const q1 = (n) => Math.round(n * 10) / 10
const packPoints = (pts) => pts.map((p) => (p[2] == null ? [q2(p[0]), q2(p[1])] : [q2(p[0]), q2(p[1]), q1(p[2])]))
const DASH_STYLES = ["solid", "dashed", "dotted"]

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
// Ужимаем до разумного размера + получаем blob и data URL.
// maxDim — потолок по большей стороне: фотографии с телефона хватает 1400, а лист с
// заданием снят втрое крупнее своей ширины ради зума, и ужимать его — значит вернуть
// то самое мыло, ради которого он снимался крупным.
async function processImageFile(file, maxDim = 1400) {
  const dataUrl = await readFileAsDataURL(file)
  const im = await loadImg(dataUrl)
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
// Подсказка к иконке. Показывается по наведению И на 1,6 с после нажатия:
// на планшете и телефоне наведения нет вовсе, и все 15 инструментов доски
// оставались безымянными картинками.
function Tip({ label, hotkey, dark, show = false }) {
  return (
    <span
      className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 ${show ? "opacity-100" : "opacity-0"} group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap rounded-lg px-2 py-1 text-xs flex items-center gap-1.5 shadow-lg`}
      style={{ background: dark ? "#f5f5f7" : "#1f2937", color: dark ? "#1c1c1e" : "#fff", zIndex: 30 }}>
      {label}
      {hotkey && (
        <kbd className="rounded px-1 text-[10px] font-semibold leading-4"
          style={{ background: dark ? "rgba(0,0,0,.1)" : "rgba(255,255,255,.22)" }}>{hotkey}</kbd>
      )}
    </span>
  )
}

// Содержимое попапа «Настройки обводки»: толщина + стиль линии (в одну строку).
// Стиль линии применяется только к фигурам (см. paintStroke): у пера и ластика
// штрих всегда сплошной — для него эту группу не показываем.
function StrokeSettings({ dark, tool, curWidth, curDash, onWidth, onDash }) {
  const swatch = dark ? "#e5e5ea" : "#1c1c1e"
  const dashArr = (d) => d === "dashed" ? "5,4" : d === "dotted" ? "0.1,5" : ""
  const showDash = DASHABLE_SHAPES.has(tool)
  const w = clamp(Math.round(curWidth || WIDTH_DEFAULT), WIDTH_MIN, WIDTH_MAX)
  const pct = ((w - WIDTH_MIN) / (WIDTH_MAX - WIDTH_MIN)) * 100
  // commit=false — тянут ползунок (правку видно сразу, но в историю она ещё не
  // легла), commit=true — отпустили. Иначе каждое движение ползунка было бы
  // отдельным шагом «отменить» и отдельной посылкой собеседнику.
  const pick = (e, commit) => onWidth(clamp(+e.target.value, WIDTH_MIN, WIDTH_MAX), commit)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5 px-1.5 h-9">
        {/* Кружок показывает выбранную толщину в натуральную величину */}
        <span className="rounded-full flex-shrink-0" aria-hidden="true"
          style={{ width: Math.min(w, 22), height: Math.min(w, 22), background: swatch, transition: "width .12s, height .12s" }} />
        <input type="range" min={WIDTH_MIN} max={WIDTH_MAX} step={1} value={w}
          className="board-range" style={{ "--p": `${pct}%`, width: 136 }}
          aria-label="Толщина линии" title="Толщина линии"
          onChange={(e) => pick(e, false)}
          onPointerUp={(e) => pick(e, true)}
          onKeyUp={(e) => pick(e, true)}
          onBlur={(e) => pick(e, true)} />
        <span className="w-5 text-right text-xs tabular-nums flex-shrink-0"
          style={{ color: dark ? "#a1a1a6" : "#6b7280" }}>{w}</span>
      </div>
      {showDash && (
        <>
          <div className="h-px mx-1" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)" }} />
          <div className="flex items-center gap-1">
            {DASH_STYLES.map((d) => (
              <button key={d} onClick={() => onDash(d)} title={d === "solid" ? "Сплошная" : d === "dashed" ? "Пунктир" : "Точки"}
                className={`press-tap flex-1 h-9 rounded-xl flex items-center justify-center ${curDash === d ? "bg-blue-500/15" : "board-hover"}`}>
                <svg width="34" height="12" viewBox="0 0 34 12"><line x1="2" y1="6" x2="32" y2="6" stroke={swatch} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={dashArr(d)} /></svg>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Кружок цвета. Обводка контрастная к доске: на тёмной доске тёмный цвет без неё
// сливался с панелью, и палитра читалась как несколько пустых мест.
function Swatch({ hex, active, dark, title, onClick, size = 24 }) {
  const d = active ? size + 4 : size
  return (
    <button onClick={onClick} title={title} aria-label={title}
      className="press-tap rounded-full flex items-center justify-center"
      style={{ width: size + 10, height: size + 10 }}>
      <span className="rounded-full" style={{
        width: d, height: d, background: hex,
        boxShadow: active
          ? `0 0 0 2px ${dark ? "#0A84FF" : "#007AFF"}, 0 0 0 3.5px ${dark ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.08)"}`
          : `0 0 0 1.5px ${dark ? "rgba(255,255,255,.4)" : "rgba(0,0,0,.22)"}`,
        transition: "all .12s",
      }} />
    </button>
  )
}

// Свой цвет из системной палитры. Выбранный цвет только КРАСИТ и в ряд кружков не
// добавляется: ряд и так забит базовыми цветами, лишний кружок туда не помещался.
function ColorPick({ value, dark, title, onPreview, size = 24 }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#007AFF"
  return (
    <label title={title} aria-label={title}
      className="press-tap relative rounded-full flex items-center justify-center cursor-pointer"
      style={{ width: size + 10, height: size + 10 }}>
      <span className="rounded-full flex items-center justify-center" style={{
        width: size, height: size,
        background: "conic-gradient(#FF3B30,#FF9F0A,#FFD60A,#30D158,#0A84FF,#BF5AF2,#FF3B30)",
        boxShadow: `0 0 0 1.5px ${dark ? "rgba(255,255,255,.4)" : "rgba(0,0,0,.22)"}`,
      }}>
        <span className="rounded-full flex items-center justify-center"
          style={{ width: size - 11, height: size - 11, background: dark ? "#2c2c2e" : "#fff", color: dark ? "#f5f5f7" : "#1c1c1e" }}>
          <Icon name="plus" size={size - 15} />
        </span>
      </span>
      <input type="color" value={hex} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={(e) => onPreview(e.target.value)} />
    </label>
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

// Секция панели инструментов, нужная не всем инструментам (цвет и обводка, ровные
// фигуры). Ненужная секция не пропадает рывком, а съезжает по ширине. Ширину берём
// с самого содержимого: `auto` не анимируется, а сумма кнопок зависит от размера
// экрана и набора значков, поэтому числом её не задать.
function BoardStrip({ open, children }) {
  const inner = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const measure = () => setW(el.getBoundingClientRect().width)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Подрезка содержимого нужна только на время съезда: в покое она обрезала бы
  // всплывающее меню обводки, которое рисуется над панелью.
  const [anim, setAnim] = useState(false)
  const was = useRef(open)
  useEffect(() => {
    if (was.current === open) return   // при первом заходе анимировать нечего
    was.current = open
    setAnim(true)
    const t = setTimeout(() => setAnim(false), 320)
    return () => clearTimeout(t)
  }, [open])
  return (
    <div className={`board-strip ${open ? "is-open" : ""} ${anim ? "is-anim" : ""}`}
      aria-hidden={!open} inert={!open}
      style={{ width: open ? w || "auto" : 0 }}>
      <div className="board-strip-in" ref={inner}>{children}</div>
    </div>
  )
}

export default function Board({ roomId, userId, userName, theme = "light", onClose, account = null, token = null, canAddTasks = false, tutorSubject = null, tutorExamFocus = null, tutorSubjects = null, tutorOwner = false }) {
  // Доска занимает весь экран, поэтому её уход тоже должен быть плавным:
  // класс .is-closing держится, пока идёт затухание, и лишь потом зовётся onClose.
  const { cls: closingCls, close: leave } = useClosing(onClose, BOARD_CLOSE_MS)
  const [tool, setTool] = useState("pen")   // pen | line | rect | eraser | hand
  const [panKey, setPanKey] = useState(false)   // зажат пробел → полотно можно тащить
  const [panDrag, setPanDrag] = useState(false) // полотно тащат прямо сейчас
  const [color, setColor] = useState("ink")
  // Толщина при каждом входе на доску — самая тонкая: ею пишут формулы и мелкий
  // разбор, а средняя годится разве что для выделения. Выбранная толщина живёт
  // до закрытия доски и намеренно не запоминается между занятиями.
  const [width, setWidth] = useState(WIDTH_DEFAULT)
  const [dash, setDash] = useState("solid")     // solid | dashed | dotted
  // Открытый попап панели — ОДИН на всех: "stroke" | "selStroke" | "shapes" | "bg" | null.
  // Поэтому открытие любого попапа автоматически закрывает предыдущий, а клик мимо
  // (по холсту или где-то ещё) закрывает открытый — см. эффект ниже и onPointerDown.
  const [menu, setMenu] = useState(null)
  // «Просторный» экран (см. вариант big: в index.css). На телефоне вместо
  // широкой панели — узкая строка по образцу мобильных tldraw и Excalidraw:
  // главные инструменты видны всегда, цвет и обводка — за кнопкой-кружком
  // текущего цвета, редкие действия — за «⋯».
  const BIG_MQ = "(min-width: 640px) and (min-height: 520px)"
  const [isBig, setIsBig] = useState(() => window.matchMedia(BIG_MQ).matches)
  useEffect(() => {
    const mq = window.matchMedia(BIG_MQ)
    const onChange = () => setIsBig(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  // Закрывающийся попап держим смонтированным, пока играет анимация ухода
  const [closingMenu, setClosingMenu] = useState(null)
  const closeTimer = useRef(null)
  const shotTimer = useRef(null)   // уход предложения «вставить снимок»
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
  useEffect(() => () => { clearTimeout(closeTimer.current); clearTimeout(bgSendTimer.current); clearTimeout(shotTimer.current) }, [])
  const [bg, setBg] = useState("plain")      // plain | grid | dots — узор
  const [bgColor, setBgColor] = useState(theme === "dark" ? BG_DARK : BG_LIGHT) // цвет фона
  const [shapeTool, setShapeTool] = useState("rect") // последняя выбранная фигура
  // Ластик по умолчанию убирает объект целиком: на доске лежат готовые фигуры,
  // линии и листы с заданиями, и от ластика ждут именно этого — одно касание,
  // объекта нет. Стирание следа (как мелом, по частям) осталось вторым режимом
  // в попапе — оно нужно редко, когда правят кусок своего же рисунка.
  const [eraserMode, setEraserMode] = useState("object")   // object | stroke
  const [online, setOnline] = useState([])
  // Курсоры собеседников можно убрать: чужая стрелка с подписью ходит поверх
  // чертежа и мешает читать доску. Настройка ЛИЧНАЯ и только на просмотр — свой
  // курсор при этом уходит собеседнику по-прежнему, иначе он терял бы нас, ничего
  // об этом не зная.
  const [showCursors, setShowCursors] = useState(() => localStorage.getItem(CURSORS_KEY) !== "off")
  // Слежение за участником: наш обзор повторяет его обзор, пока мы сами не
  // подвинем доску. Держим id, а не флаг: на доске может быть больше двоих.
  const [followId, setFollowId] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [zoomPct, setZoomPct] = useState(100)
  const [selCount, setSelCount] = useState(0)
  // Число выделенных штрихов: пропало выделение — закрываем попап его настроек
  const applySelCount = (n) => { setSelCount(n); if (!n && menu === "selStroke") closeMenu("selStroke") }
  const [selBox, setSelBox] = useState(null)   // ориентированная рамка выделения (экранные координаты)
  const [selProps, setSelProps] = useState(null) // свойства первого стилизуемого штриха {width,dash}; null — выделены только картинки
  // В выделении есть картинка → формат при масштабировании держим и рёберные ручки не показываем
  const [selHasImage, setSelHasImage] = useState(false)
  const [dragActive, setDragActive] = useState(false) // перетаскивание файла над доской
  const [taskPick, setTaskPick] = useState(false)     // открыт выбор задания из банка
  const [confirmClear, setConfirmClear] = useState(false) // спрашиваем перед очисткой доски
  // SmartDraw: набросок пером превращается в ровную фигуру (см. boardSmartDraw.js)
  const [smart, setSmart] = useState(() => localStorage.getItem(SMART_KEY) === "1")
  // Скриншот из буфера обмена. Режимы слежения:
  //   "off"  — браузер буфер не отдаёт, остаётся ⌘V (кнопки нет);
  //   "ask"  — разрешение ещё не выдано, слежение не ведём;
  //   "auto" — разрешение есть, доска сама замечает скриншот и предлагает вставить.
  const [clipMode, setClipMode] = useState("off")
  // Собеседник пишет за краем экрана. Холст бесконечный и обзор у каждого свой,
  // поэтому чужая запись запросто оказывается там, куда мы не смотрим, — молча
  // она бы просто не существовала для нас.
  const [offscreen, setOffscreen] = useState(false)
  const [offscreenOut, setOffscreenOut] = useState(false)
  const offscreenRef = useRef(false)
  const offscreenBB = useRef(null)      // габарит последней такой записи (мир)
  const offscreenTimer = useRef(null)
  const offscreenOutTimer = useRef(null)
  const [clipShot, setClipShot] = useState(null)   // {blob, url, key} — что предлагаем
  const [shotOut, setShotOut] = useState(false)   // предложение уходит: держим кадр анимации
  const clipSkip = useRef(null)                    // ключ снимка, от которого отказались
  // Цвет и обводка нужны только тем инструментам, которые оставляют линию
  const stylingTool = tool === "pen" || SHAPE_TOOLS.has(tool)
  // «Ровные фигуры» распрямляют набросок пером — другим инструментам кнопка
  // ничего не меняет, поэтому показываем её только при пере.
  const smartTool = tool === "pen"
  // Какая подсказка сейчас показана после нажатия (на сенсорном экране навести
  // мышь нельзя, а без названий панель — набор непонятных значков).
  const [tapped, setTapped] = useState("")
  const tipTimer = useRef(null)
  function flashTip(key) {
    clearTimeout(tipTimer.current)
    setTapped(key)
    tipTimer.current = setTimeout(() => setTapped(""), 1600)
  }

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
  // История действий: шаг = список изменений { id, before, after }, где before/after —
  // копия штриха или null (не существовал). Раньше «отменить» просто удаляла последний
  // свой штрих, поэтому после сжатия или перемещения объект ИСЧЕЗАЛ вместо возврата формы,
  // а удаление нельзя было отменить вовсе.
  const history = useRef([])
  const redoStack = useRef([])
  const drawing = useRef(null)
  const cursors = useRef(new Map())   // userId -> {x, y, name} в МИРОВЫХ координатах
  const cursorTimers = useRef(new Map()) // userId -> таймер авто-скрытия неподвижного курсора
  const showCursorsRef = useRef(showCursors) // то же самое для отрисовки (она вне рендера)
  const followRef = useRef(null)      // за кем следим (для обработчиков канала)
  const followTarget = useRef(null)   // его обзор: мировой прямоугольник {x,y,w,h}
  const followedBy = useRef(false)    // за НАМИ кто-то следит → шлём свой обзор
  const lastViewSend = useRef(0)
  const viewSendTimer = useRef(null)
  const sentView = useRef(null)
  const snapBoxes = useRef([])        // габариты чужих объектов на время перетаскивания
  const guides = useRef([])           // направляющие прилипания {axis,v,from,to} (мир)
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
  const lastSelHasImage = useRef(false)
  const spaceHeld = useRef(false)
  const bgRef = useRef(bg)
  const bgColorRef = useRef(bgColor)
  const channelRef = useRef(null)
  const teardownTimer = useRef(null)
  const saveTimer = useRef(null)
  const bgSendTimer = useRef(null)    // троттлинг рассылки цвета фона (см. changeBgColor)
  const sendTimer = useRef(null)
  // Незаконченные штрихи собеседников: держим их ОТДЕЛЬНО от strokes.current.
  // Пока штрих растёт, он меняется по многу раз в секунду, и будь он в общей
  // сцене — на каждую дописанную точку пришлось бы заново рисовать всю доску.
  // Здесь же он рисуется поверх готового слоя (см. redraw), а в сцену попадает
  // одним куском, когда автор оторвал перо.
  const live = useRef(new Map())      // id -> штрих, который прямо сейчас рисует собеседник
  const legacyPeer = useRef(false)    // на доске есть клиент старой сборки (см. presence sync)
  const sentId = useRef(null)         // id штриха, чьи точки уже разосланы
  const sentN = useRef(0)             // сколько точек этого штриха разослано
  const bgCanvasRef = useRef(null)    // холст узора фона (клетка/точки) — ПОД основным
  const imgCanvasRef = useRef(null)   // холст картинок и листов с заданиями — между фоном и чернилами
  const sceneCanvas = useRef(null)    // закадровый слой: завершённые штрихи (без картинок)
  const sceneValid = useRef(false)    // слой актуален (иначе перерисовать)
  const dirty = useRef(false)
  const rafId = useRef(0)
  const actions = useRef({})
  const imgCache = useRef(new Map())  // src -> HTMLImageElement (ленивая загрузка картинок)
  const tintCache = useRef(new Map()) // src -> холст листа, перекрашенный под тёмную доску
  const fileInputRef = useRef(null)   // скрытый input для загрузки картинки кнопкой
  const loadedRef = useRef(false)     // сцена успешно загружена (иначе не сохраняем — чтобы не затереть)
  const modalOpen = useRef(false)     // поверх доски открыт диалог (глушим горячие клавиши)
  const taskShift = useRef(0)         // лесенка для подряд вставленных заданий
  const erasing = useRef(null)        // текущий проход объектного ластика: [{id, before, after}]

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
    stopFollow()   // сами меняем обзор → перестаём повторять чужой
    const v = view.current
    const ns = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
    if (!Number.isFinite(ns) || ns <= 0) return
    const k = ns / v.scale
    v.x = sx - (sx - v.x) * k
    v.y = sy - (sy - v.y) * k
    v.scale = ns
    setZoomPct(Math.round(ns * 100))
  }

  // --- Слежение за участником ---------------------------------------------
  // Экраны у всех разные, поэтому повторяем не сдвиг в пикселях, а ВИДИМЫЙ КУСОК
  // доски: центр его в центр нашего холста и такой масштаб, чтобы кусок целиком
  // поместился. Иначе на телефоне мы «следили» бы за краем чужого экрана.
  function stopFollow() {
    if (!followRef.current) return
    followRef.current = null
    followTarget.current = null
    setFollowId(null)
  }
  function stepFollow() {
    const t = followTarget.current
    const canvas = canvasRef.current
    if (!t || !followRef.current || !canvas) return
    const cw = canvas.clientWidth, ch = canvas.clientHeight
    if (!cw || !ch || !(t.w > 0) || !(t.h > 0)) return
    const scale = clamp(Math.min(cw / t.w, ch / t.h), MIN_SCALE, MAX_SCALE)
    const tx = cw / 2 - (t.x + t.w / 2) * scale
    const ty = ch / 2 - (t.y + t.h / 2) * scale
    const v = view.current
    // Догоняем плавно: обзор приходит ~11 раз в секунду, и прыжок кадрами
    // читался бы как рывки. Когда догнали — садимся ровно в цель.
    const done = Math.abs(tx - v.x) < 0.4 && Math.abs(ty - v.y) < 0.4 && Math.abs(scale - v.scale) < 0.002
    const k = 0.3
    v.x = done ? tx : v.x + (tx - v.x) * k
    v.y = done ? ty : v.y + (ty - v.y) * k
    v.scale = done ? scale : v.scale + (scale - v.scale) * k
    sceneValid.current = false          // обзор изменился → слой сцены пересобрать
    const pct = Math.round(v.scale * 100)
    setZoomPct((prev) => (prev === pct ? prev : pct))
    if (!done) scheduleLive()
  }
  // Свой обзор — тем, кто за нами следит (и только им: без наблюдателей это был
  // бы лишний поток событий в общем канале).
  function sendView() {
    const canvas = canvasRef.current
    const ch = channelRef.current
    if (!canvas || !ch) return
    const v = view.current
    const box = {
      x: -v.x / v.scale, y: -v.y / v.scale,
      w: canvas.clientWidth / v.scale, h: canvas.clientHeight / v.scale,
    }
    const p = sentView.current
    if (p && Math.abs(p.x - box.x) < 0.5 && Math.abs(p.y - box.y) < 0.5 && Math.abs(p.w - box.w) < 0.5) return
    sentView.current = box
    lastViewSend.current = performance.now()
    ch.send({ type: "broadcast", event: "view", payload: { id: userId, ...box } })
  }
  function maybeSendView() {
    if (!followedBy.current) return
    const wait = VIEW_RATE - (performance.now() - lastViewSend.current)
    if (wait > 0) {
      // Хвост движения обязательно досылаем таймером: иначе последний сдвиг —
      // тот, на котором рука остановилась, — у наблюдателя не появился бы вовсе.
      clearTimeout(viewSendTimer.current)
      viewSendTimer.current = setTimeout(sendView, wait)
      return
    }
    sendView()
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
  // --- Прилипание при перетаскивании --------------------------------------
  // Края и середина перетаскиваемого габарита ловятся на края и середины чужих
  // объектов, и по месту совпадения рисуется пунктирная направляющая. Без неё
  // две картинки рядом на глаз ровно не поставить: разницу в пару пикселей видно,
  // а поймать её мышью нельзя.
  function bestSnap(mine, others, tol) {
    let best = null
    for (const mv of mine) for (const ov of others) {
      const d = Math.abs(ov - mv)
      if (d <= tol && (!best || d < best.d)) best = { d, off: ov - mv, at: ov }
    }
    return best
  }
  // bb — габарит выделения на НАЧАЛО жеста, dx/dy — сдвиг мышью.
  // Возвращает поправленный сдвиг и направляющие (мировые координаты).
  function computeSnap(bb, dx, dy) {
    if (!snapBoxes.current.length) return { dx, dy, guides: [] }
    const tol = SNAP_PX / view.current.scale
    const box = { minX: bb.minX + dx, maxX: bb.maxX + dx, minY: bb.minY + dy, maxY: bb.maxY + dy }
    const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2
    const xs = [], ys = []
    for (const o of snapBoxes.current) {
      xs.push(o.minX, (o.minX + o.maxX) / 2, o.maxX)
      ys.push(o.minY, (o.minY + o.maxY) / 2, o.maxY)
    }
    const bx = bestSnap([box.minX, cx, box.maxX], xs, tol)
    const by = bestSnap([box.minY, cy, box.maxY], ys, tol)
    const ox = bx ? bx.off : 0, oy = by ? by.off : 0
    const fin = { minX: box.minX + ox, maxX: box.maxX + ox, minY: box.minY + oy, maxY: box.maxY + oy }
    const eps = 0.5 / view.current.scale
    const g = []
    if (bx) {
      // Линию тянем через все объекты, вставшие на эту же вертикаль, — видно, по
      // чему именно выровнялись.
      let from = fin.minY, to = fin.maxY
      for (const o of snapBoxes.current) {
        const on = Math.abs(o.minX - bx.at) < eps || Math.abs((o.minX + o.maxX) / 2 - bx.at) < eps || Math.abs(o.maxX - bx.at) < eps
        if (on) { from = Math.min(from, o.minY); to = Math.max(to, o.maxY) }
      }
      g.push({ axis: "x", v: bx.at, from, to })
    }
    if (by) {
      let from = fin.minX, to = fin.maxX
      for (const o of snapBoxes.current) {
        const on = Math.abs(o.minY - by.at) < eps || Math.abs((o.minY + o.maxY) / 2 - by.at) < eps || Math.abs(o.maxY - by.at) < eps
        if (on) { from = Math.min(from, o.minX); to = Math.max(to, o.maxX) }
      }
      g.push({ axis: "y", v: by.at, from, to })
    }
    return { dx: dx + ox, dy: dy + oy, guides: g }
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
    // Слежение двигает обзор ДО кадра, рассылка своего обзора идёт после сдвига:
    // так наблюдатель получает ровно то, что мы сейчас видим.
    stepFollow()
    maybeSendView()
    const ctx = canvas.getContext("2d")
    const dpr = window.devicePixelRatio || 1
    const cw = canvas.clientWidth, ch = canvas.clientHeight
    const bw = Math.round(cw * dpr), bh = Math.round(ch * dpr)
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; sceneValid.current = false }
    // Доска собрана из ТРЁХ наложенных холстов, и порядок здесь не косметика:
    // ластик стирает в destination-out, то есть выедает всё, что нарисовано на
    // ЕГО холсте. Поэтому под чернилами лежат отдельными слоями узор фона
    // (иначе стёрлась бы и клетка) и картинки с листами заданий (иначе ластик
    // вместе со штрихом прогрызал бы дырку в самой картинке).
    const bgc = bgCanvasRef.current
    if (bgc && (bgc.width !== bw || bgc.height !== bh)) { bgc.width = bw; bgc.height = bh; sceneValid.current = false }
    const imgc = imgCanvasRef.current
    if (imgc && (imgc.width !== bw || imgc.height !== bh)) { imgc.width = bw; imgc.height = bh; sceneValid.current = false }
    const v = view.current

    // Готовая часть доски (завершённые штрихи) живёт закадровым слоем и
    // перерисовывается только когда действительно изменилась: пока собеседник
    // ведёт линию или двигается чужой курсор, кадр — это блиттинг готового слоя
    // плюс один растущий штрих. Раньше каждая пришедшая точка перерисовывала
    // всю сцену целиком, и на слабом устройстве доска захлёбывалась.
    let cache = sceneCanvas.current
    if (!cache) { cache = document.createElement("canvas"); sceneCanvas.current = cache }
    if (cache.width !== bw || cache.height !== bh) { cache.width = bw; cache.height = bh; sceneValid.current = false }
    if (!sceneValid.current) {
      const sx = cache.getContext("2d")
      sx.setTransform(1, 0, 0, 1, 0, 0)
      sx.globalCompositeOperation = "source-over"
      sx.clearRect(0, 0, bw, bh)
      sx.setTransform(v.scale * dpr, 0, 0, v.scale * dpr, v.x * dpr, v.y * dpr)
      let mx = null
      if (imgc) {
        mx = imgc.getContext("2d")
        mx.setTransform(1, 0, 0, 1, 0, 0)
        mx.globalCompositeOperation = "source-over"
        mx.clearRect(0, 0, bw, bh)
        mx.setTransform(v.scale * dpr, 0, 0, v.scale * dpr, v.x * dpr, v.y * dpr)
      }
      // Картинки — на нижний слой, всё остальное (перо, фигуры, ластик) — на верхний.
      for (const st of strokes.current.values()) drawStroke(st.tool === "image" && mx ? mx : sx, st)
      sceneValid.current = true
      if (bgc) {
        const bx = bgc.getContext("2d")
        bx.setTransform(1, 0, 0, 1, 0, 0)
        bx.globalCompositeOperation = "source-over"
        bx.clearRect(0, 0, bw, bh)
        bx.setTransform(dpr, 0, 0, dpr, 0, 0)
        drawBackground(bx, cw, ch)
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = "source-over"
    ctx.clearRect(0, 0, bw, bh)
    ctx.drawImage(cache, 0, 0)

    // Штрихи в работе — свой и чужие (в мировых координатах через view-трансформ).
    // Ластик рисуется в destination-out и стирает уже положенный слой сцены — то
    // же самое, что было, когда всё рисовалось одним проходом.
    ctx.setTransform(v.scale * dpr, 0, 0, v.scale * dpr, v.x * dpr, v.y * dpr)
    for (const st of live.current.values()) if (st.tool !== "image") drawStroke(ctx, st)
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
    // Свойства первого выделенного ШТРИХА → для цвета и попапа «Настройки обводки».
    // У картинок и листов с заданием (tool "image") ни цвет, ни толщина ничего не меняют,
    // поэтому такие объекты пропускаем: если стилизовать нечего, props = null и панель
    // показывает только «Дублировать» и «Удалить».
    let props = null, hasImg = false
    if (frame && selection.current.size) {
      for (const id of selection.current) {
        const s0 = strokes.current.get(id)
        if (!s0 || s0.tool === "eraser") continue
        if (s0.tool === "image") { hasImg = true }
        else if (!props) props = { tool: s0.tool, width: s0.width, dash: s0.dash || "solid" }
        if (props && hasImg) break
      }
    }
    if (hasImg !== lastSelHasImage.current) { lastSelHasImage.current = hasImg; setSelHasImage(hasImg) }
    const pp = lastSelProps.current
    if ((!pp) !== (!props) || (pp && props && (pp.tool !== props.tool || pp.width !== props.width || pp.dash !== props.dash))) {
      lastSelProps.current = props; setSelProps(props)
    }
    // Направляющие прилипания: пунктир того же цвета, что и в чертёжных
    // редакторах, но не синий — иначе он сливался бы с рамкой выделения.
    if (guides.current.length) {
      ctx.save()
      ctx.strokeStyle = GUIDE_COLOR
      ctx.lineWidth = 1
      ctx.setLineDash([6, 4])
      for (const g of guides.current) {
        ctx.beginPath()
        if (g.axis === "x") {
          const [x, y0] = toScreen(g.v, g.from)
          const [, y1] = toScreen(g.v, g.to)
          ctx.moveTo(x, y0 - 12); ctx.lineTo(x, y1 + 12)
        } else {
          const [x0, y] = toScreen(g.from, g.v)
          const [x1] = toScreen(g.to, g.v)
          ctx.moveTo(x0 - 12, y); ctx.lineTo(x1 + 12, y)
        }
        ctx.stroke()
      }
      ctx.restore()
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
    if (showCursorsRef.current) for (const [id, c] of cursors.current) {
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
    // Подсказку «пишут за краем экрана» снимаем, как только это место видно —
    // хоть по нажатию, хоть потому, что доску подвинули руками.
    if (offscreenRef.current && bboxOnScreen(offscreenBB.current)) hideOffscreen()
    // Пока курсор гаснет, кадры нужны сами по себе — событий больше не будет
    if (fading) scheduleLive()
  }

  // Кадр, в котором готовый слой сцены остаётся годным: растущий штрих, чужой
  // курсор, рамка выделения. Всё остальное зовёт scheduleDraw и слой пересобирается.
  const scheduleLive = useCallback(() => {
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

  const scheduleDraw = useCallback(() => {
    sceneValid.current = false
    scheduleLive()
  }, [scheduleLive])

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
        // Штрихи, прилетевшие по realtime, пока сцена грузилась, уже новее её —
        // ставим их в конец, иначе «последними записями» окажется старое.
        const early = [...strokes.current.entries()]
        strokes.current.clear()
        for (const s of scene.strokes || []) strokes.current.set(s.id, s)
        for (const [id, s] of early) { strokes.current.delete(id); strokes.current.set(id, s) }
        if (scene.bg) setBg(scene.bg)
        if (scene.bgColor) setBgColor(scene.bgColor)
        loadedRef.current = true   // сохранять можно только после успешной загрузки
        setLoaded(true)
        // Куда смотреть. Доска бесконечная и за год уезжает вниз на десятки
        // экранов: открывать её в (0,0) значит показывать сентябрь вместо того,
        // что написали сегодня. Своё место возвращаем, только если доска с тех
        // пор не изменилась, — иначе едем к свежим записям.
        const list = [...strokes.current.values()]
        const saved = readSavedView()
        const lastId = list.length ? list[list.length - 1].id : null
        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && saved.n === list.length && saved.last === lastId) {
          view.current = { x: saved.x, y: saved.y, scale: clamp(saved.scale || 1, MIN_SCALE, MAX_SCALE) }
          setZoomPct(Math.round(view.current.scale * 100))
          scheduleDraw()
        } else {
          focusLatest()
        }
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
      // Готовый штрих: кладём в сцену и убираем из «в работе».
      .on("broadcast", { event: "draw" }, ({ payload }) => {
        live.current.delete(payload.id)
        strokes.current.set(payload.id, payload)
        noticeOffscreen(payload)
        scheduleDraw()
      })
      // Штрих в работе: приходят только ДОПИСАННЫЕ точки (from — сколько их уже
      // было). Пропуск в нумерации не добираем: собеседник в конце пришлёт штрих
      // целиком событием draw, и оно всё вылечит.
      .on("broadcast", { event: "drawp" }, ({ payload }) => {
        const { from, ...st } = payload
        if (!from) { live.current.set(payload.id, st); scheduleLive(); return }
        const cur = live.current.get(payload.id)
        if (!cur || from > cur.points.length) return  // пробел — ждём финальный draw
        const tail = payload.points.slice(cur.points.length - from)
        if (!tail.length) return                      // дубль
        cur.points.push(...tail)
        scheduleLive()
      })
      .on("broadcast", { event: "remove" }, ({ payload }) => { live.current.delete(payload.id); strokes.current.delete(payload.id); selection.current.delete(payload.id); scheduleDraw() })
      .on("broadcast", { event: "clear" }, () => { live.current.clear(); strokes.current.clear(); selection.current.clear(); scheduleDraw() })
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
          cursorTimers.current.delete(payload.id); scheduleLive()
        }, CURSOR_HOLD))
        scheduleLive()
      })
      // Обзор того, за кем следим. Чужие обзоры приходят всем, но повторяем мы
      // ровно один — тот, что выбран.
      .on("broadcast", { event: "view" }, ({ payload }) => {
        if (!followRef.current || payload.id !== followRef.current) return
        followTarget.current = payload
        scheduleLive()
      })
      .on("presence", { event: "sync" }, () => {
        const people = Object.values(channel.presenceState()).flat()
        // Клиент старой сборки (открытая до раскатки вкладка, кэш PWA) события
        // drawp не слушает вовсе — линия появлялась бы у него только целиком в
        // конце штриха. Замечаем такого по отсутствию метки proto и шлём ему
        // штрихи по-старому: медленно, но одинаково для всех участников.
        legacyPeer.current = people.some((p) => p.userId !== userId && !(p.proto >= 2))
        // Наблюдателя видно по его же presence: пока за нами никто не следит,
        // обзор не рассылается вовсе.
        const watched = people.some((p) => p.userId !== userId && p.following === userId)
        const gained = watched && !followedBy.current
        followedBy.current = watched
        // Только что начали следить — обзор нужен сразу, не дожидаясь, пока мы
        // что-нибудь подвинем: иначе наблюдатель смотрел бы в пустоту.
        if (gained) { sentView.current = null; maybeSendView() }
        setOnline(people)
        const ids = new Set(people.map((p) => p.userId))
        // Ведущий ушёл с доски — слежение отпускаем, иначе обзор навсегда
        // застыл бы на его последнем кадре.
        if (followRef.current && !ids.has(followRef.current)) stopFollow()
        for (const id of cursors.current.keys()) if (!ids.has(id)) {
          cursors.current.delete(id)
          clearTimeout(cursorTimers.current.get(id)); cursorTimers.current.delete(id)
        }
        // Ушёл посреди штриха — его недорисованная линия иначе висела бы вечно
        for (const [id, st] of live.current) if (!ids.has(st.author)) live.current.delete(id)
        scheduleLive()
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") channel.track({ userId, name: userName, proto: 2, following: followRef.current || null }) })

    return scheduleTeardown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, userName])

  // О том, за кем мы следим, знает канал: presence — единственное место, где
  // ведущий может узнать, что его обзор кому-то нужен.
  useEffect(() => {
    followRef.current = followId
    if (!followId) followTarget.current = null
    const ch = channelRef.current
    if (ch?.state === "joined") ch.track({ userId, name: userName, proto: 2, following: followId || null })
  }, [followId, userId, userName])

  useEffect(() => { showCursorsRef.current = showCursors; scheduleLive() }, [showCursors, scheduleLive])

  useEffect(() => {
    const ro = new ResizeObserver(() => scheduleDraw())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [scheduleDraw])

  useEffect(() => scheduleDraw(), [bg, scheduleDraw])
  useEffect(() => { bgColorRef.current = bgColor; scheduleDraw() }, [bgColor, scheduleDraw])

  useEffect(() => () => {
    saveView()   // вернёмся на ту же доску — сядем на то же место
    clearTimeout(saveTimer.current); clearTimeout(sendTimer.current); clearTimeout(viewSendTimer.current)
    clearTimeout(offscreenTimer.current); clearTimeout(offscreenOutTimer.current)
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
    // Колесо шлёт дельту в строках или страницах, тачпад — в пикселях: без
    // приведения к пикселям один и тот же жест давал бы разный шаг в разных
    // браузерах.
    const px = (d, mode) => (mode === 1 ? d * 16 : mode === 2 ? d * 100 : d)
    const onWheel = (e) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        // Один щелчок мыши — это сразу 100+ пикселей дельты, тачпад же
        // отдаёт по 1–10. Без ограничения щелчок менял масштаб в 2,7 раза,
        // и доска прыгала. Предел в 20 пикселей держит шаг мыши около 22%,
        // а плавное сведение пальцев на тачпаде не задевает вовсе.
        const d = clamp(px(e.deltaY, e.deltaMode), -20, 20)
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-d * 0.01))
      } else {
        stopFollow()
        view.current.x -= px(e.deltaX, e.deltaMode)
        view.current.y -= px(e.deltaY, e.deltaMode)
      }
      scheduleDraw()
    }
    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Сохранение ---------------------------------------------------------
  // Доска сохраняется сама и молча: отметки «сохр…/сохранено» в шапке нет — она
  // мигала при каждом штрихе и отвлекала от занятия. Сбой сохранения остаётся
  // виден в консоли, чтобы молчание не прятало настоящую ошибку.
  const persist = useCallback(() => {
    const scene = { strokes: Array.from(strokes.current.values()), bg: bgRef.current, bgColor: bgColorRef.current }
    supabase.from("boards")
      .upsert({ student_id: String(roomId), scene, updated_by: userId, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.error("board save", error) })
  }, [roomId, userId])
  function scheduleSave() {
    if (!loadedRef.current) return // не сохраняем до успешной загрузки сцены — иначе затрём её пустой
    clearTimeout(saveTimer.current)
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
    // Превью рисуем по ПОДПИСАННОЙ копии сцены: картинки доски лежат в приватном
    // бакете, по постоянному адресу они не отдаются — без подписи на месте
    // картинки запекалась пустая плашка, и снимок расходился с самой доской.
    // В базу при этом уходит исходная сцена: подпись живёт 4 часа и протухла бы.
    const preview = await scenePreview(await signBoardScene(scene)) // null, если холст «испорчен» картинкой без CORS
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
    leave()
    // Снимок кладём в фоне и не ждём его: закрытие доски должно быть мгновенным,
    // а превью ещё догружает картинки. Промис держит ref'ы и доживает после
    // размонтирования, поэтому запускаем его ПОСЛЕ ухода: рисование превью
    // занимает главный поток и рвало бы затухание доски.
    setTimeout(() => {
      archiveSnapshot().catch(() => {})  // истории может не быть (миграция не выполнена) — выход это не ломает
    }, BOARD_CLOSE_MS)
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
    pts.push([q2(p[0]), q2(p[1]), q1(w)])
  }

  // Рассылка штриха, который сейчас ведут.
  //
  // Раньше каждые 60 мс уходил ВЕСЬ штрих целиком, и чем дольше вели линию, тем
  // толще становилось каждое сообщение: десять секунд письма — это сотня посылок
  // по два-три десятка килобайт, то есть мегабайты на одну строчку. Канал
  // захлёбывался, сообщения копились, и у собеседника линия ползла рывками.
  // Теперь в промежуточных посылках едут только дописанные точки, а целиком штрих
  // уходит ровно один раз — когда оторвали перо (заодно лечит потерю посылки).
  function broadcastDrawing(final) {
    if (!drawing.current) return
    const s = drawing.current
    if (final) {
      clearTimeout(sendTimer.current); sendTimer.current = null
      sentId.current = null; sentN.current = 0
      channelRef.current?.send({ type: "broadcast", event: "draw", payload: s })
      return
    }
    if (sendTimer.current) return
    sendTimer.current = setTimeout(() => {
      sendTimer.current = null
      const cur = drawing.current
      const ch = channelRef.current
      if (!cur || !ch) return
      // Совместимость: собеседник старой сборки понимает только событие draw
      // с целым штрихом — шлём как до оптимизации, пока он не обновится.
      if (legacyPeer.current) {
        ch.send({ type: "broadcast", event: "draw", payload: cur })
        return
      }
      // Фигура задаётся двумя точками, которые всё время переставляются, —
      // дописывать нечего, шлём её целиком (это и так две точки).
      if (SHAPE_TOOLS.has(cur.tool)) {
        ch.send({ type: "broadcast", event: "drawp", payload: { ...cur, from: 0, points: packPoints(cur.points) } })
        return
      }
      const from = sentId.current === cur.id ? sentN.current : 0
      if (from >= cur.points.length) return
      const points = packPoints(cur.points.slice(from))
      ch.send({
        type: "broadcast", event: "drawp",
        payload: from ? { id: cur.id, from, points } : { ...cur, from: 0, points },
      })
      sentId.current = cur.id; sentN.current = cur.points.length
    }, STROKE_RATE)
  }

  // Штрих брошен, не завершившись (второй палец превратил рисование в жест).
  // Часть точек уже разослана drawp-посылками, и без отзыва собеседник видел бы
  // обрывок линии, которой у автора нет, пока автор не выйдет с доски.
  function dropDrawing() {
    const cur = drawing.current
    drawing.current = null
    clearTimeout(sendTimer.current); sendTimer.current = null
    if (cur && sentId.current === cur.id) {
      channelRef.current?.send({ type: "broadcast", event: "remove", payload: { id: cur.id } })
    }
    sentId.current = null; sentN.current = 0
  }

  function beginGesture() {
    stopFollow()
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
    // Захват может кинуть NotFoundError (Safari с уже отменённым касанием) —
    // это не повод не рисовать: без захвата штрих просто оборвётся на выходе
    // указателя за холст.
    try { canvasRef.current.setPointerCapture?.(e.pointerId) } catch { /* рисуем без захвата */ }

    // Два ОДНОВРЕМЕННЫХ касания (только touch) → жест панорама/зум
    if (e.pointerType === "touch" && pointers.current.size >= 2) {
      dropDrawing(); beginGesture(); setPanDrag(true); scheduleDraw(); return
    }
    // Правая/боковая кнопка (её же выдаёт боковая кнопка пера планшета — button 2 /
    // бит 2 в buttons) или средняя кнопка → двигаем полотно, ПОКА кнопка зажата.
    // Инструмент при этом не меняется: раньше здесь стояло setTool("hand"), и
    // после сдвига маркер оказывался выключен — приходилось брать его заново,
    // хотя человек всего лишь подвинул доску.
    const secondaryBtn = e.button === 1 || e.button === 2 || (e.buttons & 2) === 2
    const wantPan = tool === "hand" || spaceHeld.current || secondaryBtn
    if (wantPan) { stopFollow(); panning.current = { x: e.clientX, y: e.clientY }; setPanDrag(true); return }
    if (e.pointerType === "mouse" && e.button != null && e.button !== 0) return

    // «Курсор» — выделение рамкой / перемещение выделенного (не рисует)
    if (tool === "cursor") {
      const p = toWorld(e.clientX, e.clientY)
      const bb = selectionBBox()
      if (bb && pointInBBox(p[0], p[1], bb)) {
        // Клик по выделению → двигаем. Габарит и габариты чужих объектов
        // запоминаем на весь жест: прилипание считается от НАЧАЛЬНОГО положения,
        // иначе поправка накапливалась бы сама на себя и объект «залипал» бы.
        snapBoxes.current = []
        const cv = canvasRef.current, vv = view.current
        // Берём только то, что рядом с видимой областью: направляющая к объекту
        // где-то за краем доски ничего не объясняет, а прилипание к нему мешает.
        const seen = {
          minX: -vv.x / vv.scale - cv.clientWidth / vv.scale / 2,
          minY: -vv.y / vv.scale - cv.clientHeight / vv.scale / 2,
          maxX: (-vv.x + cv.clientWidth * 1.5) / vv.scale,
          maxY: (-vv.y + cv.clientHeight * 1.5) / vv.scale,
        }
        for (const [sid, so] of strokes.current) {
          if (selection.current.has(sid) || so.tool === "eraser") continue
          const sb = strokeBBox(so)
          if (rectsIntersect(seen, sb)) snapBoxes.current.push(sb)
        }
        guides.current = []
        movingSel.current = { x0: p[0], y0: p[1], bb0: bb, dx: 0, dy: 0, before: snapshotSelection() }
      } else {
        marquee.current = { x0: p[0], y0: p[1], x1: p[0], y1: p[1] } // иначе — рамка
      }
      scheduleDraw()
      return
    }

    // Ластик в режиме «объект целиком» ничего не рисует — он удаляет то, чего коснулся
    if (tool === "eraser" && eraserMode === "object") {
      erasing.current = []
      eraseObjectsAt(e.clientX, e.clientY)
      return
    }

    const base = tool === "eraser" ? width * 3 : width
    const p = toWorld(e.clientX, e.clientY)
    drawing.current = {
      id: makeId(userId), author: userId, tool,
      color: tool === "eraser" ? "#000" : color,
      width: base, dash, points: [[p[0], p[1], base]],
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
    if (erasing.current) { eraseObjectsAt(e.clientX, e.clientY); return }
    // Перетаскивание выделенного
    if (movingSel.current) {
      const m = movingSel.current
      const p = toWorld(e.clientX, e.clientY)
      let dx = p[0] - m.x0, dy = p[1] - m.y0
      // Alt (⌥) отключает прилипание: иногда нужно поставить объект именно
      // чуть-чуть мимо ровной линии.
      if (e.altKey) guides.current = []
      else {
        const sn = computeSnap(m.bb0, dx, dy)
        dx = sn.dx; dy = sn.dy; guides.current = sn.guides
      }
      // Двигаем на разницу с уже применённым сдвигом — сами штрихи хранят
      // абсолютные координаты, и пересчитывать их от начала было бы дороже.
      const ddx = dx - m.dx, ddy = dy - m.dy
      if (ddx || ddy) for (const id of selection.current) {
        const s = strokes.current.get(id)
        if (s) s.points = s.points.map((pt) => [pt[0] + ddx, pt[1] + ddy, ...pt.slice(2)])
      }
      m.dx = dx; m.dy = dy
      scheduleDraw()
      return
    }
    // Растягивание рамки выделения
    if (marquee.current) {
      const p = toWorld(e.clientX, e.clientY)
      marquee.current.x1 = p[0]; marquee.current.y1 = p[1]
      scheduleLive()
      return
    }
    // курсор собеседникам (в мировых координатах), не чаще POINTER_RATE:
    // pointermove сыплется сотнями в секунду, а канал у нас общий с рисованием.
    const w = toWorld(e.clientX, e.clientY)
    const nowMs = performance.now()
    if (!drawing.current && nowMs - lastPointerSend.current >= POINTER_RATE) {
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
    scheduleLive()
    broadcastDrawing(false)
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current = null
    // Сдвиг кончился (кнопкой/пробелом или разъехавшимися пальцами) — гасим
    // подсветку «Двигать полотно» в панели.
    if (panning.current || !gesture.current) setPanDrag(false)
    panning.current = null

    // Конец прохода объектным ластиком — весь проход одним шагом истории
    if (erasing.current) {
      pushHistory(erasing.current)
      erasing.current = null
      return
    }
    // Завершение перемещения выделенного — рассылаем сдвинутые штрихи и сохраняем
    if (movingSel.current) {
      const before = movingSel.current.before
      movingSel.current = null
      guides.current = []; snapBoxes.current = []
      commitSelection(before)
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
    let s = drawing.current
    drawing.current = null
    // SmartDraw: набросок пером, уверенно похожий на прямую, круг, квадрат,
    // прямоугольник или треугольник, заменяем ровной фигурой; остальное остаётся
    // рукописным.
    // id сохраняем — у собеседника уже лежит рукописный вариант с тем же id, и
    // рассылка ровной фигуры просто заменяет его, а не кладёт вторую поверх.
    if (smart && s.tool === "pen") {
      const shape = recognizeShape(s.points, { minSize: 30 / view.current.scale })
      if (shape) {
        // Готовая фигура задаётся габаритом (a→b), треугольник по своим вершинам —
        // ими самими; ширина и стиль линии берутся текущие, как у нарисованной от руки.
        const points = shape.points || [shape.a.slice(0, 2), shape.b.slice(0, 2)]
        s = { ...s, tool: shape.tool, points, width: s.width, dash }
      }
    }
    strokes.current.set(s.id, s)
    drawing.current = s          // broadcastDrawing шлёт именно его
    broadcastDrawing(true)
    drawing.current = null
    pushHistory([{ id: s.id, before: null, after: cloneStroke(s) }])
    scheduleDraw(); scheduleSave()
  }

  // Объектный ластик: всё, чего коснулись, удаляется целиком. Собственный след
  // пиксельного ластика пропускаем — стирать «дырку» как объект бессмысленно.
  // Картинки и листы с заданиями ластик не берёт вовсе (как и след ластика их не
  // стирает): по листу пишут поверх, и случайный мазок рядом уносил бы всё
  // задание целиком. Убрать картинку можно «Курсором» — выделить и удалить.
  function eraseObjectsAt(clientX, clientY) {
    if (!erasing.current) return
    const p = toWorld(clientX, clientY)
    const tol = Math.max(4, (width || 3) * 1.2) / view.current.scale
    let hit = false
    for (const [id, st] of [...strokes.current]) {
      if (st.tool === "eraser" || st.tool === "image" || !hitStroke(st, p[0], p[1], tol)) continue
      erasing.current.push({ id, before: cloneStroke(st), after: null })
      strokes.current.delete(id)
      channelRef.current?.send({ type: "broadcast", event: "remove", payload: { id } })
      hit = true
    }
    if (hit) { scheduleDraw(); scheduleSave() }
  }

  function pushHistory(step) {
    if (!step?.length) return
    history.current.push(step)
    if (history.current.length > HISTORY_MAX) history.current.shift()
    redoStack.current = []   // новая ветка действий — «вернуть» больше некуда
  }

  // Состояние выделенных штрихов ДО правки: с ним «отменить» возвращает форму,
  // а не удаляет объект.
  function snapshotSelection() {
    const out = []
    for (const id of selection.current) {
      const s = strokes.current.get(id)
      if (s) out.push({ id, before: cloneStroke(s) })
    }
    return out
  }
  // Шаг истории из снимка «до» и текущего состояния тех же штрихов.
  function stepFromSnapshot(before) {
    return before
      .map((b) => ({ id: b.id, before: b.before, after: cloneStroke(strokes.current.get(b.id)) }))
      .filter((ch) => ch.after)
  }

  function deleteSelection() {
    if (!selection.current.size) return
    const step = []
    for (const id of selection.current) {
      const s = strokes.current.get(id)
      if (s) step.push({ id, before: cloneStroke(s), after: null })
      strokes.current.delete(id)
      channelRef.current?.send({ type: "broadcast", event: "remove", payload: { id } })
    }
    pushHistory(step)
    selection.current.clear(); applySelCount(0)
    scheduleDraw(); scheduleSave()
  }

  // Рассылка изменённых штрихов после трансформации/правки + сохранение.
  // before — снимок из snapshotSelection(): без него правка не попадёт в историю.
  function commitSelection(before = null) {
    for (const id of selection.current) {
      const s = strokes.current.get(id)
      if (s) channelRef.current?.send({ type: "broadcast", event: "draw", payload: s })
    }
    if (before) pushHistory(stepFromSnapshot(before))
    scheduleSave()
  }

  // Масштабирование (углы nw/ne/se/sw — обе оси, рёбра n/e/s/w — одна ось) или поворот "rotate"
  function startTransform(handle, e) {
    e.preventDefault(); e.stopPropagation()
    const bb = selectionBBox(); if (!bb) return
    const before = snapshotSelection()   // «отменить» вернёт форму, а не сотрёт объект
    const mode = handle === "rotate" ? "rotate" : "resize"
    const center = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2]
    // Знаки ручки: угол = обе оси, ребро = одна ось
    const hx = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0
    const hy = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0
    const enc = mode === "resize" ? singleEnclosed() : null
    // Картинку (фото и лист с заданием) тянем только пропорционально: сплюснутое
    // фото и растянутое условие читаются как брак, а вернуть исходный формат
    // «на глаз» уже нельзя. Пропорция держится и на углах, и на рёбрах.
    let keepRatio = false
    if (mode === "resize") for (const id of selection.current) { if (strokes.current.get(id)?.tool === "image") { keepRatio = true; break } }
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
        if (keepRatio || (ev.shiftKey && hx !== 0 && hy !== 0)) {
          // Ребро задаёт масштаб одной осью, угол — большей из двух
          const k = hx !== 0 && hy !== 0 ? Math.max(Math.abs(scaleU), Math.abs(scaleV)) : hx !== 0 ? Math.abs(scaleU) : Math.abs(scaleV)
          scaleU = Math.sign(scaleU || 1) * k; scaleV = Math.sign(scaleV || 1) * k
        }
        // Нижний предел габарита 2px берём общим множителем, иначе на самом
        // маленьком размере пропорция сорвалась бы «в квадрат»
        if (keepRatio) {
          const kmin = Math.max(2 / L.hw0, 2 / L.hh0)
          if (Math.abs(scaleU) < kmin) { scaleU = Math.sign(scaleU || 1) * kmin; scaleV = Math.sign(scaleV || 1) * kmin }
        }
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
        if (keepRatio || (ev.shiftKey && !lockX && !lockY)) {
          const k = !lockX && !lockY ? Math.max(Math.abs(sx), Math.abs(sy)) : !lockX ? Math.abs(sx) : Math.abs(sy)
          sx = Math.sign(sx || 1) * k; sy = Math.sign(sy || 1) * k
        }
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
      commitSelection(before); scheduleDraw()
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
    try { info = await processImageFile(file, sheet ? SHEET_MAX_DIM : 1400) } catch { return }
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
    pushHistory([{ id, before: null, after: cloneStroke(s) }])
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
  // Центр видимой области в мировых координатах — куда кладём всё, что пришло не мышью
  function centerWorld() {
    const c = canvasRef.current; if (!c) return null
    const r = c.getBoundingClientRect()
    return toWorld(r.left + c.clientWidth / 2, r.top + c.clientHeight / 2)
  }
  // Выбор картинки через кнопку → в центр видимой области
  function onPickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = "" // позволяем выбрать тот же файл повторно
    if (!file) return
    const p = centerWorld(); if (!p) return
    addImageAt(file, p[0], p[1])
  }

  // Кладём картинку из буфера в центр видимой области
  async function insertBlob(blob) {
    const p = centerWorld(); if (!p) return
    const ext = blob.type === "image/png" ? "png" : "jpg"
    await addImageAt(new File([blob], `clipboard.${ext}`, { type: blob.type }), p[0], p[1])
  }
  // Предложение уходит с той же анимацией, что и остальные попапы: раньше оно
  // пропадало в тот же кадр, что и нажатие на крестик. Снимок держим
  // смонтированным, пока играет .popup-bubble-out, и только потом снимаем
  // (адрес превью освобождает эффект по смене clipShot).
  function dropShot(skip = false) {
    if (!clipShot || shotOut) return
    if (skip) clipSkip.current = clipShot.key
    setShotOut(true)
    clearTimeout(shotTimer.current)
    shotTimer.current = setTimeout(() => {
      shotTimer.current = null
      setShotOut(false)
      setClipShot(null)
    }, POPUP_OUT_MS)
  }
  async function insertShot() {
    const shot = clipShot
    if (!shot) return
    clipSkip.current = shot.key    // тот же снимок предлагать заново не нужно
    dropShot()
    await insertBlob(shot.blob)
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
    pushHistory([...next].map((nid) => ({ id: nid, before: null, after: cloneStroke(strokes.current.get(nid)) })))
    scheduleDraw(); scheduleSave()
  }

  function setSelectionColor(c) {
    if (!selection.current.size) return
    const before = snapshotSelection()
    for (const id of selection.current) { const s = strokes.current.get(id); if (s && s.tool !== "eraser") s.color = c }
    commitSelection(before); scheduleDraw()
  }
  // Толщину выделенного тянут ползунком, поэтому правка идёт в два такта: пока
  // ползунок ведут (commit=false) меняется только картинка на доске, а в историю
  // и собеседнику уходит один раз — когда ползунок отпустили. Снимок «до» берём
  // на первом же движении и держим до конца жеста.
  const widthDrag = useRef(null)
  function setSelectionWidth(w, commit = true) {
    if (!selection.current.size) return
    if (!widthDrag.current) widthDrag.current = { before: snapshotSelection(), changed: false }
    for (const id of selection.current) {
      const s = strokes.current.get(id); if (!s || s.tool === "eraser") continue
      const cur = s.width || 3
      if (cur === w) continue
      const k = w / cur
      s.width = w
      s.points = s.points.map((p) => p.length > 2 ? [p[0], p[1], p[2] * k, ...p.slice(3)] : p)
      widthDrag.current.changed = true
    }
    if (commit) {
      const d = widthDrag.current
      widthDrag.current = null
      if (d.changed) commitSelection(d.before)   // отпустили, ничего не изменив, — шага истории нет
    }
    scheduleDraw()
  }
  function setSelectionDash(d) {
    if (!selection.current.size) return
    const before = snapshotSelection()
    for (const id of selection.current) { const s = strokes.current.get(id); if (s && s.tool !== "eraser") s.dash = d }
    commitSelection(before); scheduleDraw()
  }

  // --- Действия -----------------------------------------------------------
  // Применяет одну сторону шага истории: null — штриха не было, значит удалить.
  function applyStep(step, side) {
    for (const ch of step) {
      const s = ch[side]
      if (s) {
        const copy = cloneStroke(s)
        strokes.current.set(ch.id, copy)
        channelRef.current?.send({ type: "broadcast", event: "draw", payload: copy })
      } else {
        strokes.current.delete(ch.id)
        channelRef.current?.send({ type: "broadcast", event: "remove", payload: { id: ch.id } })
      }
    }
    // Выделение после отмены может указывать на исчезнувшие штрихи — снимаем его
    selection.current.clear(); applySelCount(0)
    scheduleDraw(); scheduleSave()
  }
  function undo() {
    const step = history.current.pop()
    if (!step) return
    redoStack.current.push(step)
    applyStep(step, "before")
  }
  function redo() {
    const step = redoStack.current.pop()
    if (!step) return
    history.current.push(step)
    applyStep(step, "after")
  }
  // Очистка стирает всё разом, поэтому идёт через подтверждение: промах по кнопке
  // рядом с «Вернуть» уносил доску целиком.
  function askClear() {
    if (!strokes.current.size) return
    setConfirmClear(true)
  }
  function cancelClear() { setConfirmClear(false) }
  function clearAll() {
    setConfirmClear(false)
    const step = [...strokes.current.values()].map((s) => ({ id: s.id, before: cloneStroke(s), after: null }))
    strokes.current.clear()
    pushHistory(step)                       // очистку доски тоже можно отменить
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} })
    scheduleDraw(); scheduleSave()
  }
  function changeBg(mode) {
    setBg(mode)
    channelRef.current?.send({ type: "broadcast", event: "bg", payload: { bg: mode } })
    scheduleSave()
  }
  // Ползунок системной палитры шлёт событие на каждое движение — рассылку прижимаем
  // к 120 мс, иначе один подбор цвета фона забивает общий realtime-канал сотней сообщений.
  function changeBgColor(hex) {
    setBgColor(hex)
    if (!bgSendTimer.current) {
      bgSendTimer.current = setTimeout(() => {
        bgSendTimer.current = null
        channelRef.current?.send({ type: "broadcast", event: "bg", payload: { bgColor: bgColorRef.current } })
      }, 120)
    }
    scheduleSave()
  }
  function toggleTheme() {
    changeBgColor(isDarkColor(bgColor) ? BG_LIGHT : BG_DARK)
  }
  // Свой цвет пера из системной палитры: красит сразу, пока ведут ползунок.
  function previewInk(hex) {
    setColor(hex)
    if (tool === "eraser" || tool === "hand" || tool === "cursor") setTool("pen")
  }
  function toggleCursors() {
    setShowCursors((v) => { localStorage.setItem(CURSORS_KEY, v ? "off" : "on"); return !v })
  }
  function toggleSmart() {
    setSmart((v) => { localStorage.setItem(SMART_KEY, v ? "0" : "1"); return !v })
  }
  function pickShape(id) {
    setShapeTool(id); setTool(id); closeMenu()
  }
  function zoomBy(factor) {
    const c = canvasRef.current
    zoomAt(c.clientWidth / 2, c.clientHeight / 2, factor)
    scheduleDraw()
  }
  // «100%» возвращает масштаб, НЕ трогая место: на длинной доске прыжок в (0,0)
  // уносил бы к самой первой странице за год.
  function resetView() {
    stopFollow()
    const canvas = canvasRef.current
    if (canvas) zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1 / view.current.scale)
    else { view.current = { x: 0, y: 0, scale: 1 }; setZoomPct(100) }
    scheduleDraw()
  }

  // Подогнать обзор под габарит (мировые координаты). bottom — поставить габарит
  // к нижнему краю: у свежей записи так видно и то, что писали перед ней.
  function viewToBBox(bb, { bottom = false } = {}) {
    const canvas = canvasRef.current
    if (!canvas) return false
    const nv = viewForBBox(bb, canvas.clientWidth, canvas.clientHeight, { bottom, minScale: MIN_SCALE })
    if (!nv) return false
    view.current = nv
    setZoomPct(Math.round(nv.scale * 100))
    sceneValid.current = false
    scheduleDraw()
    return true
  }

  // Габарит последних записей. Свежие штрихи — хвост сцены: она и хранится, и
  // сохраняется в порядке появления. Хвост берём тем короче, чем меньше экран:
  // целая строка доски в ширину телефона влезает только в 21%, а это уже не
  // чтение — лучше показать самый конец работы, но разборчиво.
  function latestBBox() {
    const all = [...strokes.current.values()].filter((st) => st.tool !== "eraser")
    if (!all.length) return null
    const canvas = canvasRef.current
    const cw = canvas?.clientWidth || 1200, ch = canvas?.clientHeight || 800
    let bb = null
    for (const n of [FRESH_STROKES, 12, 6, 3, 1]) {
      bb = sceneBBox(all.slice(-Math.min(n, all.length)))
      const nv = viewForBBox(bb, cw, ch, { bottom: true, minScale: MIN_SCALE })
      if (!nv || nv.scale >= 0.5 || n === 1) break
    }
    return bb
  }
  // Показать последние записи (пустая доска — просто начало координат).
  function focusLatest() {
    stopFollow()
    const bb = latestBBox()
    if (!bb) { view.current = { x: 0, y: 0, scale: 1 }; setZoomPct(100); scheduleDraw(); return false }
    return viewToBBox(bb, { bottom: true })
  }

  // Виден ли габарит на экране хотя бы частично
  function bboxOnScreen(bb) {
    const canvas = canvasRef.current
    if (!bb || !canvas) return true
    const v = view.current
    return !(bb.maxX * v.scale + v.x < 0 || bb.minX * v.scale + v.x > canvas.clientWidth ||
             bb.maxY * v.scale + v.y < 0 || bb.minY * v.scale + v.y > canvas.clientHeight)
  }

  // Показ/скрытие подсказки. Через ref — потому что redraw живёт в замыкании
  // первого рендера (см. scheduleLive) и текущего состояния не видит.
  function showOffscreen(on) {
    if (offscreenRef.current === on) return
    offscreenRef.current = on
    if (on) { clearTimeout(offscreenOutTimer.current); setOffscreenOut(false); setOffscreen(true); return }
    setOffscreenOut(true)               // уходит с той же анимацией, что и другие попапы
    clearTimeout(offscreenOutTimer.current)
    offscreenOutTimer.current = setTimeout(() => { setOffscreenOut(false); setOffscreen(false) }, POPUP_OUT_MS)
  }
  function hideOffscreen() { clearTimeout(offscreenTimer.current); showOffscreen(false) }
  // Пришёл чужой штрих: если он лёг за экраном — зовём посмотреть.
  function noticeOffscreen(st) {
    if (!st || st.tool === "eraser" || !st.points?.length) return
    const bb = strokeBBox(st)
    if (bboxOnScreen(bb)) return
    offscreenBB.current = bb
    showOffscreen(true)
    clearTimeout(offscreenTimer.current)
    offscreenTimer.current = setTimeout(() => showOffscreen(false), OFFSCREEN_HINT_MS)
  }
  function goOffscreen() {
    hideOffscreen()
    if (offscreenBB.current) viewToBBox(offscreenBB.current, { bottom: false })
  }

  // Свой обзор запоминается ПО ДОСКЕ и только вместе с приметой сцены: вернулись,
  // а доска та же — садимся ровно туда, где были; появилось новое — едем к нему.
  function readSavedView() {
    try {
      const all = JSON.parse(localStorage.getItem(VIEW_KEY) || "{}")
      return all[String(roomId)] || null
    } catch { return null }
  }
  function saveView() {
    if (!loadedRef.current) return
    const list = [...strokes.current.values()]
    const v = view.current
    try {
      const all = JSON.parse(localStorage.getItem(VIEW_KEY) || "{}")
      all[String(roomId)] = { x: v.x, y: v.y, scale: v.scale, n: list.length, last: list.length ? list[list.length - 1].id : null }
      localStorage.setItem(VIEW_KEY, JSON.stringify(all))
    } catch { /* приватный режим — обзор просто не запомнится */ }
  }

  useEffect(() => { actions.current.undo = undo; actions.current.redo = redo; actions.current.del = deleteSelection; actions.current.paste = addImageAt })

  // «Поверх доски открыт диалог» считается из самих состояний. Раньше флаг
  // выставляли руками в пяти местах, и один пропущенный сброс глушил ВСЕ горячие
  // клавиши доски — включая ⌘Z — до перезагрузки страницы.
  useEffect(() => { modalOpen.current = taskPick || confirmClear }, [taskPick, confirmClear])
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

  // Один снимок из буфера: {blob, key}. Ключ — тип и размер: скриншот, снятый
  // заново, почти всегда весит иначе, а читать байты каждые пару секунд накладно.
  async function readClipboardShot() {
    if (!navigator.clipboard?.read) return null
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"))
        if (!type) continue
        const blob = await item.getType(type)
        return { blob, key: `${blob.type}:${blob.size}` }
      }
    } catch { /* нет разрешения или буфер пуст */ }
    return null
  }
  // Показать предложение, если это не тот же снимок, что уже показан или отвергнут
  function offerShot(shot) {
    // Новый снимок перебивает уходящий: иначе отложенный setClipShot(null)
    // снял бы только что показанное предложение.
    clearTimeout(shotTimer.current)
    shotTimer.current = null
    setShotOut(false)
    setClipShot((cur) => {
      if (cur && cur.key === shot.key) return cur
      if (clipSkip.current === shot.key) return cur
      if (cur) URL.revokeObjectURL(cur.url)
      return { ...shot, url: URL.createObjectURL(shot.blob) }
    })
  }

  // Слежение за буфером: сняли скриншот — доска сама предлагает положить его на лист.
  // Фоном читать буфер браузер разрешает только при выданном clipboard-read, поэтому
  // до согласия сидим в режиме "ask" (одна кнопка в панели), а после — опрашиваем
  // буфер, пока вкладка на экране. Интервал нужен вдобавок к focus: скриншот на macOS
  // снимается поверх окна, и события фокуса при возврате может не быть вовсе.
  useEffect(() => {
    let alive = true
    async function detectMode() {
      if (!navigator.clipboard?.read) return setClipMode("off")
      let state
      try { state = (await navigator.permissions.query({ name: "clipboard-read" })).state }
      catch { return alive && setClipMode("ask") }   // Safari: только по нажатию
      if (!alive) return
      setClipMode(state === "denied" ? "off" : state === "granted" ? "auto" : "ask")
    }
    detectMode()
    const onPerm = () => detectMode()
    let sub = null
    navigator.permissions?.query?.({ name: "clipboard-read" })
      .then((p) => { if (alive) { sub = p; p.addEventListener("change", onPerm) } })
      .catch(() => { /* разрешения нет в этом браузере */ })
    return () => { alive = false; sub?.removeEventListener("change", onPerm) }
  }, [])

  useEffect(() => {
    if (clipMode !== "auto") return
    let alive = true
    const check = async () => {
      if (!alive || document.visibilityState !== "visible" || !document.hasFocus()) return
      const shot = await readClipboardShot()
      if (alive && shot) offerShot(shot)
    }
    check()
    const timer = setInterval(check, 2500)
    // Вернулись на доску из другого окна — прежний отказ забываем: скорее всего
    // человек уходил именно за новым снимком.
    const onFocus = () => { clipSkip.current = null; check() }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", check)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", check)
    }
  }, [clipMode])

  // Отданный наружу адрес превью надо освободить, иначе снимок висит в памяти
  useEffect(() => () => { if (clipShot) URL.revokeObjectURL(clipShot.url) }, [clipShot])
  // Смена инструмента сбрасывает выделение
  useEffect(() => {
    if (tool === "cursor") return
    selection.current.clear(); marquee.current = null; movingSel.current = null; guides.current = []
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applySelCount(0)
    scheduleDraw()
  }, [tool, scheduleDraw])
  useEffect(() => {
    // По e.code (физическая клавиша) — иначе на русской раскладке e.key = «з/у/…» и не совпадает
    const TOOL_CODES = { KeyP: "pen", KeyE: "eraser", KeyL: "line", KeyR: "rect", KeyH: "hand", KeyV: "cursor" }
    // Типы input, в которые не печатают: они не должны глушить горячие клавиши доски.
    const NON_TEXT_INPUTS = new Set(["color", "file", "range", "checkbox", "radio", "button", "submit", "reset", "image"])
    function onKeyDown(e) {
      if (modalOpen.current) return   // поверх доски открыт выбор задания — клавиши не наши
      // Поле ввода — только то, куда действительно печатают. Проверять по одному
      // лишь тегу INPUT нельзя: у палитры цвета и у выбора файла на доске тоже
      // input, и после того как ими один раз воспользовались, фокус остаётся на
      // них. Тогда ⌘Z уходил браузеру, а тот выполнял своё «Отменить» —
      // возвращал последнюю закрытую вкладку, то есть поверх доски открывалась
      // посторонняя страница.
      const el = e.target
      const tagName = el?.tagName
      const type = (el?.type || "").toLowerCase()
      const inField = tagName === "TEXTAREA" || el?.isContentEditable ||
        (tagName === "INPUT" && !NON_TEXT_INPUTS.has(type))
      // Пробел — временное «двигать полотно» при ЛЮБОМ инструменте: держим —
      // тащим доску, отпустили — рисуем тем же маркером. Раньше отслеживался
      // только тот пробел, что пришёл в document.body, поэтому после первого же
      // клика по холсту (или по кнопке панели) он переставал работать.
      if (e.code === "Space" && !inField) {
        e.preventDefault()                       // иначе страница прокручивается под доской
        if (!e.repeat) { spaceHeld.current = true; setPanKey(true) }
        return
      }
      if (e.metaKey || e.ctrlKey) {
        // Ловим и по физической клавише, и по символу. Только e.code недостаточно:
        // на части внешних клавиатур и переключателей раскладки он приходит пустым,
        // и тогда ⌘Z уходил браузеру. Браузер выполняет своё «Отменить» — в Chrome
        // это возвращает последнюю закрытую вкладку, то есть поверх доски внезапно
        // открывается посторонняя страница. На русской раскладке та же клавиша
        // даёт «я»/«н», поэтому символы проверяем в обеих раскладках.
        const k = (e.key || "").toLowerCase()
        const isZ = e.code === "KeyZ" || k === "z" || k === "я"
        const isY = e.code === "KeyY" || k === "y" || k === "н"
        if ((isZ || isY) && !inField) {
          e.preventDefault()
          e.stopPropagation()
          if (isY || e.shiftKey) actions.current.redo()
          else actions.current.undo()
        }
        return
      }
      // Горячие клавиши инструментов (без модификаторов, не в поле ввода)
      if (inField) return
      if (e.code === "Escape") { setTool("cursor"); closeMenuRef.current(); return }
      if (e.code === "Delete" || e.code === "Backspace") { e.preventDefault(); actions.current.del(); return }
      const t = TOOL_CODES[e.code]
      if (t) { setTool(t); if (SHAPE_TOOLS.has(t)) setShapeTool(t) }
    }
    function onKeyUp(e) { if (e.code === "Space") { spaceHeld.current = false; setPanKey(false) } }
    // Переключились в другое окно с зажатым пробелом — keyup не придёт, и доска
    // осталась бы «в режиме руки», пока не нажмёшь пробел ещё раз.
    function onBlur() { spaceHeld.current = false; setPanKey(false) }
    window.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => { window.removeEventListener("keydown", onKeyDown, true); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", onBlur) }
  }, [])

  const others = online.filter((p) => p.userId !== userId)
  const followName = others.find((p) => p.userId === followId)?.name || "участник"
  const TOOLS = [
    { id: "cursor", icon: "cursor", label: "Курсор", key: "Esc" },
    { id: "pen", icon: "pencil", label: "Перо", key: "P" },
    { id: "line", icon: "line", label: "Линия", key: "L" },
    { id: "shapes", shapes: true },
    { id: "eraser", icon: "eraser", label: "Ластик", key: "E", erasers: true },
    { id: "hand", icon: "move", label: "Двигать полотно", short: "Двигать", key: "H" },
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
  const divider = <div className="w-px h-7 mx-0.5" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)" }} />
  const panelBg = dark ? "#2c2c2e" : "#fff"
  const panelBorder = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"
  // Кнопки панели: один размер на все, значок крупный, подписи заменены подсказками.
  // Цвет значка задаём стилем по светлости ДОСКИ, а не темы кабинета: на тёмной доске
  // серые токены Tailwind давали почти невидимые значки.
  const btnBase = "group relative press-tap w-9 h-9 big:w-11 big:h-11 rounded-xl flex items-center justify-center transition-colors"
  const btnOn = "bg-blue-500 text-white"
  const btnIdle = "board-hover"
  // Временно включённое (не выбранное) — «Двигать полотно», пока тащат полотно
  const btnHot = "bg-blue-500/15 text-blue-500"
  const idleStyle = { color: dark ? "#d1d1d6" : "#3f4652" }
  // Попапы ластика и фигур — общие для широкой (big) и мобильной панелей,
  // поэтому собраны один раз здесь, а не инлайном в каждой раскладке.
  const eraserPopup = menuShown("eraser") && (
    <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex gap-1 p-2 rounded-xl shadow-lg ${menuAnim("eraser")}`}
      style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
      {[["object", "Объект целиком"], ["stroke", "След"]].map(([mode, label]) => (
        <button key={mode} onClick={() => { setEraserMode(mode); setTool("eraser"); closeMenu("eraser") }}
          className={`press-tap px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap ${
            eraserMode === mode ? "bg-blue-500 text-white" : "board-hover"
          }`} style={eraserMode === mode ? undefined : idleStyle}>
          {label}
        </button>
      ))}
    </div>
  )
  const shapesPopup = menuShown("shapes") && (
    <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex flex-col gap-2 p-2 rounded-xl shadow-lg ${menuAnim("shapes")}`}
      style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
      {[["Плоские", SHAPES_2D], ["Объёмные", SHAPES_3D]].map(([title, list]) => (
        <div key={title}>
          <div className="text-[10px] uppercase tracking-wide px-1 mb-1" style={{ color: dark ? "#8e8e93" : "#9ca3af" }}>{title}</div>
          <div className="flex gap-1">
            {/* Подписи не нужны: фигуру видно по значку, а название
                остаётся во всплывающей подсказке. */}
            {list.map((sh) => (
              <button key={sh.id} onClick={() => pickShape(sh.id)} title={sh.label} aria-label={sh.label}
                className={`press-tap w-10 h-10 rounded-lg flex items-center justify-center ${tool === sh.id ? "bg-blue-500 text-white" : "board-hover"}`}
                style={tool === sh.id ? undefined : idleStyle}>
                <Icon name={sh.icon} size={20} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  // Пока полотно тащат (или держат пробел), курсор — рука, каким бы ни был
  // выбранный инструмент: иначе неясно, что маркер никуда не делся.
  const cursor = panDrag ? "grabbing"
    : (panKey || tool === "hand") ? "grab"
    : tool === "cursor" ? "default" : "crosshair"
  // …и в панели на это время дополнительно загорается «Двигать полотно».
  // Именно дополнительно: выбранный инструмент горит по-прежнему, потому что он
  // и остаётся выбранным — отпустил кнопку (пальцы, пробел) и рисуешь дальше.
  // Подсветка сдвига поэтому не сплошная, как у выбранного, а залитая тоном:
  // два одинаково закрашенных инструмента читались бы как «выбраны оба».
  const panLit = (id) => id === "hand" && (panDrag || panKey) && tool !== "hand"

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
    <div data-board-version="14" className={`fixed inset-0 z-[100000] flex flex-col screen-fade ${dark ? "board-dark" : ""} ${closingCls}`} style={{ background: baseBg }}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-3 h-12 border-b flex-shrink-0"
        style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: dark ? "#e5e5ea" : "#374151" }}>
            <Icon name="clipboard" size={16} /> Доска
          </div>
          {/* Фон доски — в верхней панели: это настройка листа, а не инструмент рисования */}
          <div className="relative" data-menu>
            <button onClick={() => toggleMenu("bg")}
              className={`press-tap flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors ${
                menuShown("bg") ? "bg-blue-500/15 text-blue-500" : "board-hover"
              }`}
              style={menuShown("bg") ? undefined : { color: dark ? "#a1a1aa" : "#6b7280" }}>
              <span className="w-3.5 h-3.5 rounded-[5px] shrink-0" style={{
                background: bgColor,
                boxShadow: `0 0 0 1.5px ${dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.2)"}`,
              }} />
              Фон
              <Icon name="chevron-down" size={12} />
            </button>
            {menuShown("bg") && (
              <div className={`absolute top-full mt-2 left-0 flex flex-col gap-2 p-2 rounded-xl shadow-lg z-20 ${menuAnim("bg")}`}
                style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
                {/* Узор */}
                <div className="flex gap-1">
                  {BGS.map((b) => (
                    <button key={b.id} onClick={() => changeBg(b.id)} title={b.label}
                      className={`press-tap px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap ${bg === b.id ? "bg-blue-500 text-white" : "board-hover"}`}
                      style={bg === b.id ? undefined : idleStyle}>
                      {b.label}
                    </button>
                  ))}
                </div>
                {/* Цвет фона: готовые + свои + системная палитра */}
                <div className="flex gap-1 items-center flex-wrap max-w-[16rem] pt-0.5">
                  {BG_COLORS.map((hex) => (
                    <Swatch key={hex} hex={hex} active={bgColor === hex} dark={dark} title="Цвет фона"
                      onClick={() => changeBgColor(hex)} />
                  ))}
                  <ColorPick value={bgColor} dark={dark} title="Свой цвет фона"
                    onPreview={changeBgColor} />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {others.length > 0 && (
            <button onClick={toggleCursors} title={showCursors ? "Скрыть курсоры участников" : "Показать курсоры участников"}
              className={`press-tap p-1.5 rounded-lg transition-colors ${
                showCursors ? "board-hover" : "text-blue-500 bg-blue-500/12"
              }`} style={showCursors ? idleStyle : undefined}>
              <span className="relative flex items-center justify-center">
                <Icon name="cursor" size={16} />
                {/* Перечёркнутый значок понятнее подписи: курсоров на доске нет */}
                {!showCursors && <span className="absolute w-[19px] h-[1.5px] rotate-45 rounded-full" style={{ background: "currentColor" }} />}
              </span>
            </button>
          )}
          <button onClick={toggleTheme} title={dark ? "Светлая доска" : "Тёмная доска"}
            className="press-tap p-1.5 rounded-lg board-hover" style={idleStyle}>
            <Icon name={dark ? "sun" : "moon"} size={16} />
          </button>
          {/* Аватар участника — кнопка слежения: обзор повторяет его обзор,
              пока мы сами не подвинем доску. Точка на аватаре значит обратное —
              этот участник сейчас смотрит нашими глазами. */}
          <div className="flex items-center -space-x-1.5">
            {others.map((p) => {
              const on = followId === p.userId
              return (
                <button key={p.userId} onClick={() => setFollowId(on ? null : p.userId)}
                  title={`${on ? "Не следить за экраном" : "Следить за экраном"}: ${p.name || "участник"}${p.following === userId ? " · следит за вами" : ""}`}
                  className="press-tap relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                  style={{ background: colorFor(p.userId),
                    boxShadow: on ? `0 0 0 2px ${baseBg}, 0 0 0 4px #007AFF` : `0 0 0 2px ${baseBg}` }}>
                  {(p.name || "?").slice(0, 1).toUpperCase()}
                  {p.following === userId && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                      style={{ background: "#007AFF", boxShadow: `0 0 0 1.5px ${baseBg}` }} />
                  )}
                </button>
              )
            })}
            {others.length > 0 && <span className="pl-3 text-xs" style={idleStyle}>в сети</span>}
          </div>
          <button onClick={closeBoard}
            className="press-tap p-1.5 rounded-lg board-hover" style={idleStyle}>
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>

      {/* Холст на всю область */}
      <div ref={wrapRef} className="flex-1 min-h-0 relative overflow-hidden"
        onDragOver={onDragOver} onDragLeave={onDragLeaveWrap} onDrop={onDropWrap}>
        {/* Узор фона — свой холст: ластик работает по слою штрихов и клетку не трогает */}
        <canvas ref={bgCanvasRef} aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: "100%", display: "block" }} />
        {/* Картинки и листы с заданиями — свой холст между фоном и чернилами:
            ластик работает по слою чернил и картинку не задевает, а всё
            нарисованное всегда ложится ПОВЕРХ листа. */}
        <canvas ref={imgCanvasRef} aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: "100%", display: "block" }} />
        <canvas
          ref={canvasRef}
          className="relative"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor }}
        />

        {/* Слежение включено — об этом надо помнить: доска будет ездить сама.
            Любой свой сдвиг или зум слежение снимает, кнопка — запасной путь. */}
        {followId && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 pl-3 pr-1.5 h-8 rounded-full text-xs font-medium shadow-lg popup-bubble"
            style={{ background: panelBg, border: `1px solid ${panelBorder}`, color: dark ? "#e5e5ea" : "#374151" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: colorFor(followId) }} />
            Следим за экраном: {followName}
            <button onClick={stopFollow}
              className="press-tap px-2 py-1 rounded-full text-blue-500 hover:bg-blue-500/[0.08]">Отпустить</button>
          </div>
        )}

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

            {/* Рёбра: у фигур — ручка (масштаб по одной оси), у картинки —
                прозрачная полоса вдоль всей стороны: формат не меняется, поэтому
                ручка не нужна, нужен только курсор-стрелка под рукой. */}
            {edgeHandles.map((h) => (selHasImage ? (
              <div key={h.k} onPointerDown={(e) => startTransform(h.k, e)}
                className="absolute board-edge-grip"
                style={{ left: h.x, top: h.y,
                  // Толщину полосы ужимаем на мелкой картинке: иначе четыре полосы
                  // накрыли бы её целиком и перетащить объект стало бы нечем
                  width: h.k === "n" || h.k === "s" ? Math.max(frameW - 14, 8) : Math.min(12, Math.max(4, frameW / 3)),
                  height: h.k === "n" || h.k === "s" ? Math.min(12, Math.max(4, frameH / 3)) : Math.max(frameH - 14, 8),
                  transform: `translate(-50%, -50%) rotate(${H.angle}rad)`,
                  cursor: h.c, touchAction: "none" }} />
            ) : (
              <div key={h.k} onPointerDown={(e) => startTransform(h.k, e)}
                className="absolute rounded-full"
                style={{ left: h.x - 5, top: h.y - 5, width: 10, height: 10, cursor: h.c, touchAction: "none",
                  background: dark ? "#5c5c60" : "#c7c7cc", boxShadow: "0 0 0 1.5px #fff" }} />
            )))}

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
              {selProps && BASE_INKS.map((c) => (
                <button key={c} onClick={() => setSelectionColor(c)} title={c === "ink" ? "Чернила" : "Цвет"}
                  className="press-tap w-6 h-6 rounded-full flex items-center justify-center">
                  <span className="rounded-full" style={{ width: 17, height: 17, background: resolveColor(c, dark),
                    boxShadow: `0 0 0 1px ${dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)"}` }} />
                </button>
              ))}
              {selProps && divider}
              {/* Настройки обводки для выделения */}
              {selProps && (
              <div className="relative" data-menu>
                <button onClick={() => toggleMenu("selStroke")} title="Настройки обводки"
                  className="press-tap w-8 h-8 rounded-lg flex items-center justify-center board-hover" style={idleStyle}>
                  <Icon name="stroke" size={16} />
                </button>
                {menuShown("selStroke") && (
                  <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 p-2 rounded-xl shadow-lg z-10 ${menuAnim("selStroke")}`}
                    style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
                    <StrokeSettings dark={dark} tool={selProps?.tool} curWidth={selProps?.width} curDash={selProps?.dash || "solid"}
                      onWidth={setSelectionWidth} onDash={setSelectionDash} />
                  </div>
                )}
              </div>
              )}
              {selProps && divider}
              <button onClick={duplicateSelection} title="Дублировать"
                className="press-tap w-8 h-8 rounded-lg flex items-center justify-center board-hover" style={idleStyle}>
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

        {/* Зум-контролы. На телефоне скрыты: зум там — щипок, а угол занят панелью */}
        <div className="absolute bottom-4 right-4 hidden big:flex flex-col rounded-xl shadow-lg overflow-hidden"
          style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
          <button onClick={() => zoomBy(1.2)} title="Приблизить"
            className="press-tap w-9 h-9 flex items-center justify-center board-hover" style={idleStyle}>
            <Icon name="plus" size={16} />
          </button>
          <button onClick={resetView} title="Сбросить масштаб"
            className="press-tap h-7 flex items-center justify-center text-[10px] board-hover border-y"
            style={{ ...idleStyle, borderColor: panelBorder }}>
            {zoomPct}%
          </button>
          <button onClick={() => zoomBy(1 / 1.2)} title="Отдалить"
            className="press-tap w-9 h-9 flex items-center justify-center board-hover" style={idleStyle}>
            <Icon name="minus" size={16} />
          </button>
          {/* Доска бесконечная, и найти на ней работу вручную — отдельный труд:
              эта кнопка приводит к последним записям с любого места. */}
          <button onClick={focusLatest} title="К последним записям"
            className="press-tap w-9 h-9 flex items-center justify-center board-hover border-t"
            style={{ ...idleStyle, borderColor: panelBorder }}>
            <Icon name="target" size={16} />
          </button>
        </div>

        {/* Панель инструментов — плавает поверх холста, чтобы вся область была доской.
            Подписей у кнопок нет намеренно: панель стала крупнее и читается значками,
            а название показывает подсказка — по наведению и по нажатию на сенсорном экране. */}
        <div className="absolute bottom-2 big:bottom-4 left-0 right-0 flex flex-col items-center gap-2 px-2 big:px-3 pointer-events-none">
        {/* Заметили снимок в буфере — предлагаем положить его на доску одним нажатием */}
        {offscreen && (
          <div className={`flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-2xl shadow-xl max-w-full ${
            offscreenOut ? "popup-bubble-out" : "popup-bubble pointer-events-auto"}`}
            style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
            <button onClick={goOffscreen}
              className="press-tap flex items-center gap-2 rounded-xl pr-2 text-sm font-medium"
              style={{ color: dark ? "#f5f5f7" : "#1c1c1e" }}>
              <Icon name="target" size={16} />
              Пишут за краем экрана
              <span className="text-blue-500">Показать</span>
            </button>
            <button onClick={hideOffscreen} aria-label="Скрыть"
              className="press-tap w-8 h-8 rounded-lg flex items-center justify-center shrink-0 board-hover"
              style={idleStyle}>
              <Icon name="x" size={16} />
            </button>
          </div>
        )}
        {clipShot && (
          <div className={`flex items-center gap-2.5 pl-2 pr-1.5 py-1.5 rounded-2xl shadow-xl max-w-full ${
            shotOut ? "popup-bubble-out" : "popup-bubble pointer-events-auto"}`}
            style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
            <button onClick={insertShot} className="press-tap flex items-center gap-2.5 min-w-0 rounded-xl pr-1">
              <img src={clipShot.url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0"
                style={{ boxShadow: `0 0 0 1px ${panelBorder}` }} />
              <span className="text-sm font-medium truncate" style={{ color: dark ? "#f5f5f7" : "#1c1c1e" }}>
                Вставить снимок
              </span>
            </button>
            <button onClick={() => dropShot(true)} aria-label="Не вставлять"
              className="press-tap w-8 h-8 rounded-lg flex items-center justify-center shrink-0 board-hover"
              style={idleStyle}>
              <Icon name="x" size={16} />
            </button>
          </div>
        )}
        {isBig && (
        <div className="flex flex-wrap items-center justify-center gap-1 rounded-2xl px-2.5 py-2 shadow-xl relative pointer-events-auto max-w-full"
          style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
          {TOOLS.map((t) => t.erasers ? (
            <div key="eraser" className="relative" data-menu>
              {/* Клик берёт ластик и сразу показывает выбор режима: иначе про «стирать
                  объект целиком» никто бы не узнал */}
              <button onPointerDown={() => flashTip("eraser")} onClick={() => { const was = tool === "eraser"; setTool("eraser"); was ? toggleMenu("eraser") : openMenu("eraser") }}
                className={`${btnBase} ${tool === "eraser" ? btnOn : btnIdle}`}
                style={tool === "eraser" ? undefined : idleStyle}>
                <Icon name="eraser" size={21} />
                {!menuShown("eraser") && (
                  <Tip label={eraserMode === "object" ? "Ластик · объект целиком" : "Ластик · след"} hotkey="E" dark={dark} show={tapped === "eraser"} />
                )}
              </button>
              {eraserPopup}
            </div>
          ) : t.shapes ? (
            <div key="shapes" className="relative" data-menu>
              <button onPointerDown={() => flashTip("shapes")} onClick={() => toggleMenu("shapes")}
                className={`${btnBase} ${shapeMenuIds.has(tool) ? btnOn : btnIdle}`}
                style={shapeMenuIds.has(tool) ? undefined : idleStyle}>
                <Icon name={shapeIconOf(shapeTool)} size={21} />
                {!menuShown("shapes") && <Tip label="Фигуры" dark={dark} show={tapped === "shapes"} />}
              </button>
              {shapesPopup}
            </div>
          ) : (
            <button key={t.id} onPointerDown={() => flashTip(t.id)} onClick={() => setTool(t.id)}
              className={`${btnBase} ${tool === t.id ? btnOn : panLit(t.id) ? btnHot : btnIdle}`}
              style={tool === t.id || panLit(t.id) ? undefined : idleStyle}>
              <Icon name={t.icon} size={21} />
              <Tip label={t.label} hotkey={t.key} dark={dark} show={tapped === t.id} />
            </button>
          ))}

          {/* SmartDraw: набросок пером сам становится ровной фигурой. Кнопка есть
              только у пера — остальным инструментам она ничего не меняла. */}
          <BoardStrip open={smartTool}>
            {divider}
            <button onPointerDown={() => flashTip("smart")} onClick={toggleSmart}
              className={`${btnBase} ${smart ? btnOn : btnIdle}`} style={smart ? undefined : idleStyle}>
              <Icon name="sparkles" size={21} />
              <Tip label={smart ? "Ровные фигуры включены" : "Ровные фигуры выключены"} dark={dark} show={tapped === "smart"} />
            </button>
          </BoardStrip>

          {/* Цвет и обводка — только для инструментов, которые рисуют линию.
              У ластика, курсора и руки они ничего не меняли и сбивали с толку. */}
          <BoardStrip open={stylingTool}>
              {divider}
              {BASE_INKS.map((c) => {
                const shown = resolveColor(c, dark) // «чернила» показываем реальным цветом
                return (
                  <Swatch key={c} hex={shown} active={color === c} dark={dark}
                    title={c === "ink" ? "Чернила" : "Цвет"}
                    onClick={() => { setColor(c); if (tool === "eraser" || tool === "hand" || tool === "cursor") setTool("pen") }} />
                )
              })}
              <ColorPick value={resolveColor(color, dark)} dark={dark} title="Свой цвет"
                onPreview={previewInk} />
              {divider}
              {/* Настройки обводки */}
              <div className="relative" data-menu>
                <button onPointerDown={() => flashTip("stroke")} onClick={() => toggleMenu("stroke")}
                  className={`${btnBase} ${menuShown("stroke") ? "bg-blue-500/15 text-blue-500" : btnIdle}`}
                  style={menuShown("stroke") ? undefined : idleStyle}>
                  <Icon name="stroke" size={21} />
                  <Tip label="Настройки обводки" dark={dark} show={tapped === "stroke"} />
                </button>
                {menuShown("stroke") && (
                  <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 p-2 rounded-xl shadow-lg ${menuAnim("stroke")}`}
                    style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
                    <StrokeSettings dark={dark} tool={tool} curWidth={width} curDash={dash} onWidth={setWidth} onDash={setDash} />
                  </div>
                )}
              </div>
          </BoardStrip>

          {divider}

          {/* Загрузить картинку */}
          <button onPointerDown={() => flashTip("image")} onClick={() => fileInputRef.current?.click()}
            className={`${btnBase} ${btnIdle}`} style={idleStyle}>
            <Icon name="image" size={21} />
            <Tip label="Добавить картинку" dark={dark} show={tapped === "image"} />
          </button>

          {/* Задание из банка листом на доску */}
          {canAddTasks && (
            <button onPointerDown={() => flashTip("task")} onClick={() => setTaskPick(true)}
              className={`${btnBase} ${taskPick ? btnOn : btnIdle}`} style={taskPick ? undefined : idleStyle}>
              <Icon name="book" size={21} />
              <Tip label="Задание из банка" dark={dark} show={tapped === "task"} />
            </button>
          )}

          {divider}

          <button onPointerDown={() => flashTip("undo")} onClick={undo}
            className={`${btnBase} ${btnIdle}`} style={idleStyle}>
            <Icon name="undo" size={21} />
            <Tip label="Отменить" hotkey="⌘Z" dark={dark} show={tapped === "undo"} />
          </button>
          <button onPointerDown={() => flashTip("redo")} onClick={redo}
            className={`${btnBase} ${btnIdle}`} style={idleStyle}>
            <Icon name="redo" size={21} />
            <Tip label="Вернуть" hotkey="⌘⇧Z" dark={dark} show={tapped === "redo"} />
          </button>
          <button onPointerDown={() => flashTip("clear")} onClick={askClear}
            className={`${btnBase} text-red-500 hover:bg-red-500/10`}>
            <Icon name="trash" size={21} />
            <Tip label="Очистить всё" dark={dark} show={tapped === "clear"} />
          </button>
        </div>
        )}

        {/* Телефон: раскладка по образцу мобильных tldraw и Excalidraw.
            Главные инструменты — узкой строкой, всегда видны; цвет и обводка —
            за кнопкой-кружком текущего цвета; картинка, задание, ровные фигуры
            и очистка — за «⋯». Отмена и возврат — приглушённым лотком над
            строкой: на телефоне нет ⌘Z, ими пользуются постоянно. */}
        {!isBig && (
          <>
            <div className="flex gap-0.5 rounded-xl px-1 py-0.5 shadow-md pointer-events-auto"
              style={{ background: panelBg, border: `1px solid ${panelBorder}`, opacity: 0.92 }}>
              <button onClick={undo} aria-label="Отменить"
                className="press-tap w-9 h-8 rounded-lg flex items-center justify-center" style={idleStyle}>
                <Icon name="undo" size={18} />
              </button>
              <button onClick={redo} aria-label="Вернуть"
                className="press-tap w-9 h-8 rounded-lg flex items-center justify-center" style={idleStyle}>
                <Icon name="redo" size={18} />
              </button>
            </div>
            <div className="flex items-center gap-0.5 rounded-2xl px-1.5 py-1 shadow-xl relative pointer-events-auto max-w-full"
              style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
              {TOOLS.map((t) => t.erasers ? (
                <div key="eraser" className="relative" data-menu>
                  <button onClick={() => { const was = tool === "eraser"; setTool("eraser"); was ? toggleMenu("eraser") : openMenu("eraser") }}
                    className={`${btnBase} ${tool === "eraser" ? btnOn : btnIdle}`}
                    style={tool === "eraser" ? undefined : idleStyle} aria-label="Ластик">
                    <Icon name="eraser" size={21} />
                  </button>
                  {eraserPopup}
                </div>
              ) : t.shapes ? (
                <div key="shapes" className="relative" data-menu>
                  <button onClick={() => toggleMenu("shapes")} aria-label="Фигуры"
                    className={`${btnBase} ${shapeMenuIds.has(tool) ? btnOn : btnIdle}`}
                    style={shapeMenuIds.has(tool) ? undefined : idleStyle}>
                    <Icon name={shapeIconOf(shapeTool)} size={21} />
                  </button>
                  {shapesPopup}
                </div>
              ) : (
                <button key={t.id} onClick={() => setTool(t.id)} aria-label={t.label}
                  className={`${btnBase} ${tool === t.id ? btnOn : panLit(t.id) ? btnHot : btnIdle}`}
                  style={tool === t.id || panLit(t.id) ? undefined : idleStyle}>
                  <Icon name={t.icon} size={21} />
                </button>
              ))}

              {divider}

              {/* Текущий цвет: кружок открывает свотчи и настройки обводки */}
              <div className="relative" data-menu>
                <button onClick={() => { toggleMenu("mColor"); if (!stylingTool) setTool("pen") }} aria-label="Цвет и обводка"
                  className={`${btnBase} ${btnIdle}`}>
                  <span className="rounded-full" style={{ width: 22, height: 22, background: resolveColor(color, dark),
                    boxShadow: `0 0 0 1.5px ${dark ? "rgba(255,255,255,.4)" : "rgba(0,0,0,.22)"}` }} />
                </button>
                {menuShown("mColor") && (
                  <div className={`absolute bottom-full mb-2 right-0 p-2.5 rounded-xl shadow-lg ${menuAnim("mColor")}`}
                    style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
                    <div className="grid grid-cols-4 gap-0.5 mb-2">
                      {BASE_INKS.map((c) => (
                        <Swatch key={c} hex={resolveColor(c, dark)} active={color === c} dark={dark}
                          title={c === "ink" ? "Чернила" : "Цвет"}
                          onClick={() => { setColor(c); if (!stylingTool) setTool("pen") }} />
                      ))}
                      <ColorPick value={resolveColor(color, dark)} dark={dark} title="Свой цвет" onPreview={previewInk} />
                    </div>
                    <StrokeSettings dark={dark} tool={stylingTool ? tool : "pen"} curWidth={width} curDash={dash} onWidth={setWidth} onDash={setDash} />
                  </div>
                )}
              </div>

              {/* Остальное — за «⋯»: пункты редкие, подписи важнее скорости */}
              <div className="relative" data-menu>
                <button onClick={() => toggleMenu("mMore")} aria-label="Ещё"
                  className={`${btnBase} ${menuShown("mMore") ? "bg-blue-500/15 text-blue-500" : btnIdle}`}
                  style={menuShown("mMore") ? undefined : idleStyle}>
                  <Icon name="dots" size={21} />
                </button>
                {menuShown("mMore") && (
                  <div className={`absolute bottom-full mb-2 right-0 flex flex-col p-1.5 rounded-xl shadow-lg whitespace-nowrap ${menuAnim("mMore")}`}
                    style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
                    {/* Ровные фигуры распрямляют набросок пером — другим инструментам
                        пункт ничего не меняет, поэтому его там нет */}
                    {smartTool && (
                      <button onClick={toggleSmart}
                        className={`press-tap flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm ${smart ? "text-blue-500" : "board-hover"}`}
                        style={smart ? undefined : idleStyle}>
                        <Icon name="sparkles" size={18} />Ровные фигуры{smart && <Icon name="check" size={15} />}
                      </button>
                    )}
                    <button onClick={() => { closeMenu("mMore"); focusLatest() }}
                      className="press-tap flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm board-hover" style={idleStyle}>
                      <Icon name="target" size={18} />К последним записям
                    </button>
                    <button onClick={() => { closeMenu("mMore"); fileInputRef.current?.click() }}
                      className="press-tap flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm board-hover" style={idleStyle}>
                      <Icon name="image" size={18} />Добавить картинку
                    </button>
                    {canAddTasks && (
                      <button onClick={() => { closeMenu("mMore"); setTaskPick(true) }}
                        className="press-tap flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm board-hover" style={idleStyle}>
                        <Icon name="book" size={18} />Задание из банка
                      </button>
                    )}
                    <button onClick={() => { closeMenu("mMore"); askClear() }}
                      className="press-tap flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10">
                      <Icon name="trash" size={18} />Очистить всё
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        </div>

      </div>

      {/* Банк заданий грузится отдельным куском — без заглушки клик выглядел бы
          как «ничего не произошло» */}
      {taskPick && (
        <Suspense fallback={<div className="fixed inset-0 z-[100010] flex items-center justify-center" style={{ background: "rgba(0,0,0,.15)" }}><div className="loader-logo" /></div>}>
          <BoardTaskModal
            dark={dark}
            roomId={roomId}
            tutorSubject={tutorSubject}
            tutorExamFocus={tutorExamFocus}
            tutorSubjects={tutorSubjects}
            owner={tutorOwner}
            onInsert={insertTaskSheet}
            onClose={() => setTaskPick(false)}
          />
        </Suspense>
      )}

      <ConfirmModal
        open={confirmClear}
        title="Очистить доску?"
        message="С доски исчезнут все рисунки, картинки и листы с заданиями. Действие можно отменить кнопкой «Отменить»."
        confirmLabel="Очистить"
        cancelLabel="Отмена"
        danger
        zIndex={100010}
        onConfirm={clearAll}
        onCancel={cancelClear}
      />
    </div>
  )
}
