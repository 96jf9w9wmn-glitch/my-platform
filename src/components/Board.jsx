import { useState, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense } from "react"
import { supabase } from "../supabase"
import { signBoardScene, signStorageUrl } from "../storageUrl"
import Icon from "./Icon"
import ConfirmModal from "./ConfirmModal"
import { useClosing, CLOSE_MS, POPUP_OUT_MS } from "../useClosing"
import { recognizeShape } from "./boardSmartDraw"
import { answersEqual } from "../utils"
import {
  GRID, ENCLOSED_SHAPES, SHAPE_TOOLS, DASHABLE_SHAPES,
  TEXT_FONT, TEXT_LINE, TEXT_MIN, TEXT_MAX, TEXT_DEFAULT, textMetrics, textBoxPoints, textFont,
  isDarkColor, resolveColor, strokeBBox, sceneBBox, viewForBBox, paintStroke, scenePreview, tintSheet,
} from "./boardPaint"
// Выбор задания тянет за собой генераторы всех предметов и html2canvas — грузим
// только когда репетитор открыл выбор, иначе доска стала бы тяжелее на мегабайты.
const BoardTaskModal = lazy(() => import("./BoardTaskModal"))
import { roomStudentId, isHomeworkRoom, HW_ROOM } from "../boardRoom"

// Совместная доска платформы (свой движок на HTML5 Canvas, без внешних библиотек).
// БЕСКОНЕЧНЫЙ холст на весь экран: штрихи хранятся в МИРОВЫХ координатах, у каждого
// клиента свой обзор (view = смещение + масштаб) — можно зумить и двигать полотно
// независимо, при этом рисунок общий. Комната — это либо занятие ученика (roomId =
// student.id), либо отдельная домашняя работа (student.id:hw:<id>): доски разных
// работ не пересекаются, см. src/boardRoom.js.
// Синхронизация через Supabase Realtime broadcast; снапшот сцены — в таблицу boards.

// Толщина маркера задаётся ползунком: три готовые ступени не покрывали ни
// тонкую подпись под чертежом, ни жирную линию, видную ученику с телефона.
const WIDTH_MIN = 1, WIDTH_MAX = 30, WIDTH_DEFAULT = 3
const MIN_SCALE = 0.15, MAX_SCALE = 8

const HISTORY_MAX = 100      // шагов «отменить» держим столько же, сколько привычно в редакторах
// Копия штриха для истории: points — массив массивов, поверхностная копия его бы разделила
const cloneStroke = (s) => s && { ...s, points: s.points.map((p) => p.slice()) }
const SHEET_MAX_DIM = 4000   // лист с заданием: длинные условия не должны терять чёткость
const SHEET_GAP = 140        // отступ от написанного до нового листа с заданием, мировые px
const SPOT_PAD = 40          // зазор вокруг листа при поиске свободного места, там же
const CULL_PAD = 80          // запас за краем экрана, в пределах которого штрих ещё рисуем
// Поле ответа под листом набрано в тех же единицах, в каких снят сам лист (SHEET_W и
// кегль условия в pages/taskSnapshot.js), и потом целиком масштабируется вместе с ним —
// поэтому у задания и поля один масштаб. Держать эту ширину в согласии с taskSnapshot.
const QA_SHEET_W = 620       // ширина листа в его собственных единицах
const QA_GAP = 14            // отступ поля от нижнего края листа, там же
const QA_TUTOR_INSET = 30    // на столько строка репетитора отступает от низа листа внутрь
// Лист меньше этого на экране — поля не показываем: набрать в него всё равно нельзя,
// а условие на такой доске читают глазами, а не решают.
const QA_MIN_ON_SCREEN = 300
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
const TEXT_DRAFT_RATE = 120         // как часто набираемая надпись уходит собеседнику, мс

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
// Габарит штриха считается по всем его точкам, а их у рукописной строки сотни.
// Кэш по САМОМУ массиву точек: везде, где штрих двигают, поворачивают или правят,
// points пересоздаётся (.map / textBoxPoints), поэтому устаревшего габарита не
// остаётся, а WeakMap отпускает запись вместе со стёртым штрихом.
const bbCache = new WeakMap()
function strokeBox(s) {
  const key = s?.points
  if (!key || typeof key !== "object") return strokeBBox(s)
  let bb = bbCache.get(key)
  if (!bb) { bb = strokeBBox(s); bbCache.set(key, bb) }
  return bb
}
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
// Цвет — единственная настройка пера, которая переживает вход-выход: репетитор
// весь год пишет одним и тем же, и заново искать его в палитре каждое занятие
// незачем. Толщина, наоборот, намеренно сбрасывается (см. WIDTH_DEFAULT).
const COLOR_KEY = "board-color"
const VIEW_RATE = 60    // не чаще 1 посылки своего обзора в 60 мс: за ним следят глазами
// Прилипание при перетаскивании: допуск в ЭКРАННЫХ пикселях (в мировые переводим
// делением на масштаб — иначе на приближённой доске объект липнул бы за версту).
const SNAP_PX = 6
const GUIDE_COLOR = "#FF2D55"  // направляющая заметно отличается от синей рамки выделения
const STROKE_RATE = 30  // не чаще 1 посылки дописанных точек в 30 мс (33/сек)
const BOARD_SYNC_MS = 15000 // как часто сверяемся с базой, что ничего не потерялось
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
// Ужимаем до разумного размера + получаем blob и размеры.
// maxDim — потолок по большей стороне: фотографии с телефона хватает 1400, а лист с
// заданием снят втрое крупнее своей ширины ради зума, и ужимать его — значит вернуть
// то самое мыло, ради которого он снимался крупным.
//
// Картинка, которая в потолок уже влезает, уходит в хранилище КАК ЕСТЬ. Раньше её всё
// равно перерисовывали в холст и снимали оттуда и blob, и data URL — то есть кодировали
// PNG дважды поверх base64-чтения файла. У листа с заданием это три мегапикселя, и
// секунды уходили на то, чтобы получить ровно тот же файл. Разобранный <img> отдаём
// наружу: доска нарисует лист сразу, не выкачивая его обратно из хранилища.
async function processImageFile(file, maxDim = 1400) {
  const url = URL.createObjectURL(file)
  let im
  try {
    im = await loadImg(url)
    // Ждём именно ДЕКОДИРОВАНИЯ, а не onload: тот значит лишь «файл получен», а
    // растр WebKit разбирает лениво, к первой отрисовке. Отпустишь blob-адрес
    // раньше — рисовать будет уже неоткуда, и лист выходит пустым.
    await im.decode?.()
  } catch (err) {
    if (!im) { URL.revokeObjectURL(url); throw err }   // не загрузилась вовсе
  }
  const scale = Math.min(1, maxDim / Math.max(im.naturalWidth, im.naturalHeight))
  // Без потерь — только PNG и WebP: лист с заданием снимается в WebP, и пережать
  // его в jpeg значило бы размыть формулы.
  const lossless = file.type === "image/png" || file.type === "image/webp"
  const type = lossless ? file.type : "image/jpeg"
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"
  // Адрес отдаём вместе с картинкой и НЕ отпускаем: пока разобранный <img> живёт в
  // кэше доски, браузер вправе выбросить растр и перечитать его по этому адресу.
  if (scale === 1 && file.type) return { blob: file, type: file.type, ext, w: im.naturalWidth, h: im.naturalHeight, img: im, url }
  const cw = Math.max(1, Math.round(im.naturalWidth * scale)), ch = Math.max(1, Math.round(im.naturalHeight * scale))
  const cnv = document.createElement("canvas"); cnv.width = cw; cnv.height = ch
  cnv.getContext("2d").drawImage(im, 0, 0, cw, ch)
  const blob = await new Promise((r) => cnv.toBlob(r, type, 0.85))
  URL.revokeObjectURL(url)                              // исходник больше не нужен
  return { blob, type, ext, w: cw, h: ch, img: null, url: null }
}

// Поле ответа под листом с заданием из банка. У сторон оно РАЗНОЕ, и это главное,
// что про него нужно знать:
//   ученик  — вписывает ответ и проверяет себя: «Верно»/«Неверно» и свой ответ,
//             правильного он не видит НИКОГДА, иначе первая же неверная попытка
//             выдавала бы ответ и решать дальше было бы нечего;
//   репетитор — видит, ответил ли ученик и что именно, а правильный ответ
//             открывает кнопкой «Ответ». За кнопкой, а не строкой на виду:
//             занятие часто идёт с показом экрана, и ответ, лежащий открытым,
//             ученик прочитал бы через демонстрацию.
// Ответ сверяется тем же answersEqual, что и домашние работы с вариантами, — «0,5»
// и «1/2» не должны расходиться с кабинетом.
//
// Панель живёт в DOM, а не на холсте: в неё вводят текст. Но растёт и уменьшается она
// ВМЕСТЕ С ЛИСТОМ: вёрстка набрана в тех же единицах, что и сам лист (ширина
// QA_SHEET_W, кегль от кегля условия), а на экран её кладёт одно преобразование
// scale(panel.k), где k — во сколько раз лист сейчас показан. Экранный размер,
// стоявший тут раньше, читался как чужая наклейка: на увеличенном листе поле
// оказывалось втрое мельче условия, на отдалённом — накрывало его целиком.
// Масштаб на ОБЁРТКЕ, а не на самой панели: у появления попапа свои кадры с
// transform, и на одном элементе они затёрли бы друг друга.
function TaskAnswerBox({ panel, dark, panelBg, panelBorder, tutor = false, onCheck, onReset }) {
  const [val, setVal] = useState("")
  const [shown, setShown] = useState(false)   // репетитор раскрыл правильный ответ
  const done = panel.ok != null
  const ink = dark ? "#e5e5ea" : "#1f2937"
  const meta = dark ? "#a1a1aa" : "#6b7280"
  const tone = panel.ok ? "#34c759" : "#ff3b30"
  // Отступ от листа — тоже в единицах листа, иначе на зуме он «отклеивался»
  const frame = {
    left: panel.x, top: panel.y + QA_GAP * panel.k, width: QA_SHEET_W,
    transform: `scale(${panel.k})`, transformOrigin: "top left",
  }
  const box = { background: panelBg, border: `1px solid ${panelBorder}`, padding: "12px 16px" }

  // Репетитор: что с заданием у ученика + ответ по кнопке. Поля ввода тут нет —
  // проверяет себя ученик, а репетитору нужен сам ответ.
  //
  // Своей плашки у этой строки НЕТ: она стоит внутри листа, у нижнего края, и
  // читается как его же подпись. Отдельная карточка под заданием несла одну
  // кнопку, а весила больше самого условия.
  if (tutor) {
    return (
      <div className="absolute flex justify-end" style={{ ...frame, top: panel.y - QA_TUTOR_INSET * panel.k }}>
        <div className="flex items-center gap-2 pr-4">
          <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: done ? `${tone}22` : "rgba(0,122,255,.10)", color: done ? tone : "#007AFF" }}
            title={done ? (panel.ok ? "Ученик ответил верно" : "Ученик ответил неверно") : "Ученик ещё не ответил"}>
            <Icon name={done ? (panel.ok ? "check" : "x") : "clock"} size={15} />
          </span>
          {done && <span className="text-[15px] font-mono max-w-[200px] truncate" style={{ color: tone }}>{panel.v}</span>}
          {/* Ответ не мигает, а выезжает и так же уезжает */}
          <span className="text-[15px] font-mono truncate transition-all duration-200"
            style={{ color: ink, opacity: shown ? 1 : 0, maxWidth: shown ? 200 : 0, pointerEvents: "none" }}>
            {panel.a ?? "—"}
          </span>
          <button onClick={() => setShown((v) => !v)}
            className="press-tap flex-shrink-0 px-2 py-0.5 rounded-full text-[15px] text-blue-500 hover:bg-blue-500/[0.08]">
            {shown ? "Скрыть" : "Ответ"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute" style={frame}>
      <div className="rounded-2xl shadow-lg popup-bubble" style={box}>
        {done ? (
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${tone}22`, color: tone }}>
              <Icon name={panel.ok ? "check" : "x"} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-medium leading-tight" style={{ color: tone }}>
                {panel.ok ? "Верно" : "Неверно"}
              </div>
              {/* Свой ответ показываем, правильный — нет: его знает только репетитор */}
              <div className="text-[15px] leading-tight truncate mt-0.5" style={{ color: meta }}>
                {panel.ok ? panel.v : `Твой ответ: ${panel.v} · попробуй ещё раз`}
              </div>
            </div>
            <button onClick={() => { setVal(""); onReset(panel.id) }}
              className="press-tap flex-shrink-0 px-3 py-1.5 rounded-xl text-[15px] text-blue-500 hover:bg-blue-500/[0.08]">
              Заново
            </button>
          </div>
        ) : (
          <form className="flex items-center gap-3" onSubmit={(e) => { e.preventDefault(); onCheck(panel.id, val) }}>
            <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Ответ"
              className="flex-1 min-w-0 h-11 px-3.5 rounded-xl text-[17px] outline-none focus:ring-2 focus:ring-blue-500/40"
              style={{ background: "transparent", color: ink, border: `1px solid ${panelBorder}` }} />
            <button type="submit" disabled={!val.trim()}
              className="press-tap flex-shrink-0 h-11 px-5 rounded-xl text-[15px] font-medium text-white disabled:opacity-40"
              style={{ background: "#007AFF" }}>
              Проверить
            </button>
          </form>
        )}
      </div>
    </div>
  )
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
  // У текста тот же ползунок задаёт КЕГЛЬ: заводить ему отдельный попап незачем,
  // а шкала нужна своя — на толщине линии подпись к чертежу не набрать.
  const isText = tool === "text"
  const lo = isText ? TEXT_MIN : WIDTH_MIN, hi = isText ? TEXT_MAX : WIDTH_MAX
  const w = clamp(Math.round(curWidth || (isText ? TEXT_DEFAULT : WIDTH_DEFAULT)), lo, hi)
  const pct = ((w - lo) / (hi - lo)) * 100
  // commit=false — тянут ползунок (правку видно сразу, но в историю она ещё не
  // легла), commit=true — отпустили. Иначе каждое движение ползунка было бы
  // отдельным шагом «отменить» и отдельной посылкой собеседнику.
  const pick = (e, commit) => onWidth(clamp(+e.target.value, lo, hi), commit)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5 px-1.5 h-9">
        {/* Кружок показывает выбранную толщину в натуральную величину, у текста — буква выбранного кегля */}
        {isText ? (
          <span className="flex-shrink-0 w-6 text-center leading-none font-semibold" aria-hidden="true"
            style={{ fontSize: Math.min(w, 22), color: swatch, fontFamily: TEXT_FONT }}>А</span>
        ) : (
          <span className="rounded-full flex-shrink-0" aria-hidden="true"
            style={{ width: Math.min(w, 22), height: Math.min(w, 22), background: swatch, transition: "width .12s, height .12s" }} />
        )}
        <input type="range" min={lo} max={hi} step={1} value={w}
          className="board-range" style={{ "--p": `${pct}%`, width: 136 }}
          aria-label={isText ? "Размер текста" : "Толщина линии"} title={isText ? "Размер текста" : "Толщина линии"}
          onChange={(e) => pick(e, false)}
          onPointerUp={(e) => pick(e, true)}
          onKeyUp={(e) => pick(e, true)}
          onBlur={(e) => pick(e, true)} />
        <span className="w-6 text-right text-xs tabular-nums flex-shrink-0"
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

export default function Board({ roomId, label = "", userId, userName, theme = "light", onClose, account = null, token = null, canAddTasks = false, tutorSubject = null, tutorExamFocus = null, tutorSubjects = null, tutorOwner = false, taskSheet = null }) {
  // Доска занимает весь экран, поэтому её уход тоже должен быть плавным:
  // класс .is-closing держится, пока идёт затухание, и лишь потом зовётся onClose.
  const { cls: closingCls, close: leave } = useClosing(onClose, BOARD_CLOSE_MS)
  // Кто смотрит на доску. Роль видна по самому userId: у репетитора он начинается
  // с «t:», у ученика — с «s:» (так же их различает чат). Нужна она ровно для одного:
  // правильный ответ к листу из банка показывается только репетитору.
  const isTutor = String(userId || "").startsWith("t:")
  const [tool, setTool] = useState("pen")   // pen | line | rect | eraser | hand
  const [panKey, setPanKey] = useState(false)   // зажат пробел → полотно можно тащить
  const [panDrag, setPanDrag] = useState(false) // полотно тащат прямо сейчас
  const [color, setColor] = useState(() => {
    try { return localStorage.getItem(COLOR_KEY) || "ink" } catch { return "ink" }
  })
  // Толщина при каждом входе на доску — самая тонкая: ею пишут формулы и мелкий
  // разбор, а средняя годится разве что для выделения. Выбранная толщина живёт
  // до закрытия доски и намеренно не запоминается между занятиями.
  const [width, setWidth] = useState(WIDTH_DEFAULT)
  const [dash, setDash] = useState("solid")     // solid | dashed | dotted
  // Кегль текста живёт отдельно от толщины линии: у пера ходовые значения 1–5,
  // у надписи — десятки, и одна общая ручка каждый раз давала бы не то.
  const [textSize, setTextSize] = useState(TEXT_DEFAULT)
  const [textBold, setTextBold] = useState(false)
  const [textItalic, setTextItalic] = useState(false)
  // Идёт набор надписи: {id, x, y, size, color, angle, value, seq}. id = null —
  // надпись новая; x,y — левый верх в МИРОВЫХ координатах.
  const [editText, setEditText] = useState(null)
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
    // Подсказку кнопки гасим: попап уходит с анимацией, и всплывшая поверх него
    // подпись накрыла бы его содержимое
    clearTimeout(tipTimer.current)
    setTapped("")
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
  // Поля ответа под листами с заданием (экранные координаты). Считаются в кадре, как
  // и рамка выделения: их положение зависит от обзора, а не от React-стейта.
  const [qaBoxes, setQaBoxes] = useState([])
  const lastQa = useRef("")
  // Картинки, которые сейчас едут в хранилище (экранные координаты, тот же кадр)
  const [busyImgs, setBusyImgs] = useState([])
  const lastBusy = useRef("")
  const [selProps, setSelProps] = useState(null) // свойства первого стилизуемого штриха {width,dash}; null — выделены только картинки
  // В выделении есть картинка → формат при масштабировании держим и рёберные ручки не показываем
  const [selHasImage, setSelHasImage] = useState(false)
  const [dragActive, setDragActive] = useState(false) // перетаскивание файла над доской
  const [taskPick, setTaskPick] = useState(false)     // открыт выбор задания из банка
  // Банк заданий — самый тяжёлый кусок приложения: генераторы всех предметов плюс
  // снимок листа, вместе под мегабайт сжатого кода. Пока он качается и компилируется,
  // нажатие на «Задание из банка» выглядит как «ничего не произошло», и ждать этого
  // посреди занятия каждый раз нельзя. Поэтому тянем его сразу, как открыли доску:
  // до первой задачи репетитор обычно успевает что-то написать, и к нажатию кусок
  // уже готов. Только тому, у кого эта кнопка есть, — ученику качать нечего.
  // Ошибку глотаем: это опережающая загрузка, а не работа. Не вышло — обычный
  // ленивый импорт по нажатию сделает то же самое.
  useEffect(() => {
    if (!canAddTasks) return
    const warm = () => { import("./BoardTaskModal").catch(() => {}) }
    // Пауза — чтобы не отнимать сеть и поток у первого кадра самой доски и загрузки сцены.
    const t = setTimeout(() => {
      if (window.requestIdleCallback) window.requestIdleCallback(warm, { timeout: 4000 })
      else warm()
    }, 1500)
    return () => clearTimeout(t)
  }, [canAddTasks])
  // Задание, с которым доску открыли снаружи (кнопка «Решить на доске» в
  // домашней работе). Снимок листа делается здесь же, поэтому пока он готовится,
  // доска показывает тот же загрузчик, что и при загрузке сцены.
  const [sheetBusy, setSheetBusy] = useState(false)
  const [sheetErr, setSheetErr] = useState(false)
  // База отказала в записи (42501): доска сохраняться не будет, и молчать об этом
  // нельзя — написанное пропадёт при перезагрузке, а человек об этом не узнает.
  // Единственная причина такого отказа — не выполненная миграция board_rooms.sql
  // (составной адрес доски домашней работы не проходит политику).
  const [saveDenied, setSaveDenied] = useState(false)
  const sheetDone = useRef(null)                      // ключ задания, которое уже разобрали
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
  // Цвет и обводка нужны только тем инструментам, которые оставляют линию.
  // «Текст» сюда НЕ входит: у надписи цвет, размер и начертание стоят в панели
  // над самим полем ввода, и вторая такая же полоса внизу — лишний повтор,
  // который к тому же уводит взгляд от того места, где правят.
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

  const rootRef = useRef(null)
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
  // Что из сцены уже лежит в базе: id → { s — ссылка на штрих, json — его снимок
  // (считаем лениво, только когда ссылка изменилась). На этом держится дельта:
  // сохраняем не всю сцену, а разницу (см. supabase/board_delta.sql).
  const savedRef = useRef(new Map())
  const savedMeta = useRef({ bg: null, bgColor: null })
  const dirtyRef = useRef(new Set())  // штрихи, изменённые НА МЕСТЕ: ссылка та же, содержимое другое
  const savingRef = useRef(false)     // запрос сохранения в полёте — второй не запускаем
  const saveAgain = useRef(false)     // пока он летел, появилось новое
  const patchOff = useRef(false)      // в базе нет board_patch — пишем сцену целиком, как раньше
  const persistRef = useRef(null)     // дозапись после ухода с доски — уже без React
  const joinedOnce = useRef(false)    // канал уже подключался: следующий SUBSCRIBED — после обрыва
  const lastResync = useRef(0)        // когда в последний раз перечитывали сцену (см. resync)
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
  const textDraftAt = useRef(0)       // когда набираемая надпись уходила собеседнику
  const textDraftTimer = useRef(null)
  const textDraftSent = useRef(false) // черновик надписи сейчас висит у собеседника
  const dirty = useRef(false)
  const rafId = useRef(0)
  const actions = useRef({})
  const imgCache = useRef(new Map())  // src -> HTMLImageElement (ленивая загрузка картинок)
  // Адреса blob-ов, под которыми в кэше лежат СВОИ картинки. Отпускать их, пока
  // картинка в кэше, нельзя: браузер вправе выбросить растр и перечитать его по
  // этому адресу — поэтому освобождаем всё разом при закрытии доски.
  const ownBlobs = useRef([])
  useEffect(() => () => { ownBlobs.current.forEach((u) => URL.revokeObjectURL(u)); ownBlobs.current = [] }, [])
  const tintCache = useRef(new Map()) // src -> холст листа, перекрашенный под тёмную доску
  const fileInputRef = useRef(null)   // скрытый input для загрузки картинки кнопкой
  // Адрес доски, ДЛЯ КОТОРОЙ загружена сцена (null — ещё не загружена). Именно
  // адрес, а не «да/нет»: комнату можно сменить на живом компоненте (кнопка
  // «назад», переход между доской занятия и доской домашней работы), и голый
  // флаг оставался бы поднятым от ПРЕДЫДУЩЕЙ доски — тогда её штрихи успевали
  // сохраниться в новую комнату. Так уже случилось: листы домашней работы легли
  // на доску занятия (см. src/boardRoom.js — доски не должны пересекаться).
  const loadedRef = useRef(null)
  const modalOpen = useRef(false)     // поверх доски открыт диалог (глушим горячие клавиши)
  const erasing = useRef(null)        // текущий проход объектного ластика: [{id, before, after}]
  // Ввод текста. editPos — то же, что и editText, но доступное вне рендера:
  // положение поля правит кадр отрисовки (обзор двигают колесом и пальцами, а
  // view лежит в ref и React о нём не знает).
  const editPos = useRef(null)
  const editBoxRef = useRef(null)     // обёртка поля (её двигаем и поворачиваем)
  const editRef = useRef(null)        // само поле ввода
  const textSeq = useRef(0)           // номер сеанса набора: по нему поле пересоздаётся
  const editBarRef = useRef(null)     // панель над полем: цвет, размер, начертание

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
      const b = strokeBox(s)
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
      // Набираемую сейчас надпись пропускаем: её показывает поле ввода, и вторым
      // экземпляром она двоилась бы под курсором.
      const editId = editPos.current?.id
      // Рисуем только то, что видно. Доска бесконечная и за учебный год уезжает на
      // десятки экранов, а слой сцены пересобирается на КАЖДОМ кадре сдвига и зума:
      // без этого отсечения кабинет перерисовывал всю историю занятий, чтобы
      // показать один экран. Замер на 3000 рукописных штрихов (450 тыс. точек):
      // 39 мс на кадр против 3 мс — то есть 8 кадров в секунду вместо плавного хода.
      // Запас по краям — на толщину линии и на скругления.
      const vis = {
        minX: (-v.x) / v.scale - CULL_PAD, minY: (-v.y) / v.scale - CULL_PAD,
        maxX: (cw - v.x) / v.scale + CULL_PAD, maxY: (ch - v.y) / v.scale + CULL_PAD,
      }
      for (const st of strokes.current.values()) {
        if (editId && st.id === editId) continue
        if (live.current.has(st.id)) continue   // собеседник правит эту надпись прямо сейчас
        const bb = strokeBox(st)
        if (bb && !rectsIntersect(vis, bb)) continue
        drawStroke(st.tool === "image" && mx ? mx : sx, st)
      }
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
    // Листы с заданием, у которых есть поле ответа → в стейт для HTML-оверлея.
    // Мелкий и уехавший за край лист панели не получает: в поле шириной с ноготь всё
    // равно не попасть, а панели на весь экран мешали бы рисовать.
    const qa = []
    // Картинки, которые прямо сейчас едут в хранилище, → в стейт для плашки
    // «Отправляется»: она стоит на самой картинке, потому что объяснять надо
    // именно про неё, а не вообще про доску.
    const busy = []
    for (const st of strokes.current.values()) {
      if (st.pending) {
        const b = strokeBox(st)
        const [x0, y0] = toScreen(b.minX, b.minY), [x1, y1] = toScreen(b.maxX, b.maxY)
        if (x1 > 0 && y1 > 0 && x0 < cw && y0 < ch) {
          busy.push({ id: st.id, x: Math.round((x0 + x1) / 2), y: Math.round((y0 + y1) / 2) })
        }
      }
      if (!st.qa) continue
      const b = strokeBox(st)
      const [x0, y0] = toScreen(b.minX, b.minY), [x1, y1] = toScreen(b.maxX, b.maxY)
      const sw = x1 - x0
      if (sw < QA_MIN_ON_SCREEN || x1 < 0 || y1 < 0 || x0 > cw || y0 > ch) continue
      // x — ЛЕВЫЙ край листа: поле ответа стоит под условием по одной с ним линии,
      // как строка «Ответ:» на бланке. По центру оно уезжало от начала условия.
      // k — во сколько раз лист сейчас показан: поле шириной ровно с лист и с той же
      // крупностью текста, что и условие (см. TaskAnswerBox). Округляем, иначе
      // дрожание последних знаков перерисовывало бы панель на каждом кадре.
      // Правильный ответ уходит в панель ТОЛЬКО репетитору: у ученика панель его
      // не показывает, и класть его туда незачем.
      qa.push({ id: st.id, x: Math.round(x0), y: Math.round(y1),
        k: Math.round((sw / QA_SHEET_W) * 1000) / 1000,
        a: isTutor ? st.qa.a : null, v: st.qa.v || "", ok: st.qa.ok ?? null })
    }
    const qaKey = JSON.stringify(qa)
    if (qaKey !== lastQa.current) { lastQa.current = qaKey; setQaBoxes(qa) }
    const busyKey = JSON.stringify(busy)
    if (busyKey !== lastBusy.current) { lastBusy.current = busyKey; setBusyImgs(busy) }
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
        else if (!props) props = { tool: s0.tool, dash: s0.dash || "solid", bold: !!s0.bold, italic: !!s0.italic,
          width: s0.tool === "text" ? (s0.size || TEXT_DEFAULT) : s0.width }
        if (props && hasImg) break
      }
    }
    if (hasImg !== lastSelHasImage.current) { lastSelHasImage.current = hasImg; setSelHasImage(hasImg) }
    const pp = lastSelProps.current
    if ((!pp) !== (!props) || (pp && props && (pp.tool !== props.tool || pp.width !== props.width || pp.dash !== props.dash ||
      pp.bold !== props.bold || pp.italic !== props.italic))) {
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
    layoutTextEditor()
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

  // Сцена целиком. Штрихи лежат построчно (board_strokes), и собирает их база:
  // сохранение штриха тогда не переписывает всю доску — на боевой доске в 3,7 МБ
  // это было 489 мс на КАЖДЫЙ штрих, отсюда «сайт лёг, доска легла».
  // Пока миграции board_strokes.sql нет, читаем сцену из boards.scene, как раньше.
  const sceneRpcOff = useRef(false)
  const fetchScene = useCallback(async () => {
    if (!sceneRpcOff.current) {
      const { data, error } = await supabase.rpc("board_scene", { p_student_id: String(roomId) })
      if (!error) return data || null
      if (error.code !== "PGRST202" && error.code !== "42883") return null  // не «функции нет» — это отказ прав или сбой
      sceneRpcOff.current = true
    }
    const { data } = await supabase.from("boards").select("scene").eq("student_id", String(roomId)).maybeSingle()
    return data?.scene || null
  }, [roomId])

  // Сменилась комната — сцену обнуляем СИНХРОННО, до всякой загрузки.
  //
  // Доска занятия и доска домашней работы обязаны быть непересекающимися (см.
  // src/boardRoom.js), а компонент при смене адреса переживает её живым (кнопка
  // «назад» в браузере, переход между работой и занятием). Всё, что лежит в
  // рефах, — штрихи, дельта сохранения, история отмен, ключ уже положенного
  // листа — от ПРЕДЫДУЩЕЙ доски, и без этого сброса они утекали в новую: так
  // листы домашней работы и оказались на доске занятия.
  const roomRef = useRef(roomId)
  useLayoutEffect(() => {
    if (roomRef.current === roomId) return
    roomRef.current = roomId
    clearTimeout(saveTimer.current); saveTimer.current = null
    saveAgain.current = false
    loadedRef.current = null    // до загрузки новой сцены не сохраняем ничего
    strokes.current.clear(); live.current.clear(); selection.current.clear()
    savedRef.current = new Map(); dirtyRef.current.clear()
    history.current = []; redoStack.current = []
    cursors.current.clear()
    sheetDone.current = null    // лист задания кладётся заново — но уже в свою комнату
    patchOff.current = false
    setLoaded(false)
    scheduleDraw()
  }, [roomId, scheduleDraw])

  // --- Загрузка снапшота --------------------------------------------------
  useEffect(() => {
    let alive = true
    fetchScene()
      .then(async (raw) => {
        if (!alive) return
        // Бакет с картинками доски приватный — подписываем их ссылки.
        const scene = (await signBoardScene(raw)) || {}
        // Штрихи, прилетевшие по realtime, пока сцена грузилась, уже новее её —
        // ставим их в конец, иначе «последними записями» окажется старое.
        const early = [...strokes.current.entries()]
        strokes.current.clear()
        for (const s of scene.strokes || []) strokes.current.set(s.id, s)
        // Пришедшее из базы уже сохранено — с этого начинается отсчёт дельты.
        // early сюда НЕ кладём: они прилетели по realtime и в базе их может не быть,
        // пусть первое же сохранение их допишет.
        rememberSaved(scene.strokes || [])
        savedMeta.current = { bg: scene.bg ?? null, bgColor: scene.bgColor ?? null }
        for (const [id, s] of early) { strokes.current.delete(id); strokes.current.set(id, s) }
        if (scene.bg) setBg(scene.bg)
        if (scene.bgColor) setBgColor(scene.bgColor)
        loadedRef.current = roomId   // сохранять можно только после успешной загрузки ЭТОЙ доски
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

  // Догнать пропущенное. Штрихи расходятся по realtime и нигде не повторяются:
  // всё, что собеседник написал, пока связи не было (телефон уснул, вкладка ушла
  // в фон, сеть моргнула, ноутбук закрыли), прошло мимо — и до этой правки не
  // появлялось до перезахода на доску. Сцена же лежит в boards и обновляется при
  // каждом штрихе, поэтому вернувшись мы просто перечитываем её.
  //
  // Слияние — ОБЪЕДИНЕНИЕМ: сохранённая сцена основой, наши штрихи поверх неё.
  // Взять снимок как есть нельзя — его могли сохранить за секунду до нашего
  // последнего штриха, и он бы пропал с экрана. Обратная сторона: стёртое, пока
  // нас не было, вернётся — это заметно меньшая беда, чем ненаписанная работа.
  const resync = useCallback(async () => {
    if (loadedRef.current !== roomId) return             // начальная загрузка ещё идёт — она и принесёт свежее
    if (Date.now() - lastResync.current < 3000) return  // не дёргаем базу на каждый чих
    lastResync.current = Date.now()
    const scene = await signBoardScene(await fetchScene())
    if (!scene?.strokes?.length) return
    const local = [...strokes.current.entries()]
    strokes.current.clear()
    for (const s of scene.strokes) strokes.current.set(s.id, s)
    rememberSaved(scene.strokes)   // теперь мы знаем, что в базе; своё недошедшее допишется дельтой
    for (const [id, s] of local) if (!strokes.current.has(id)) strokes.current.set(id, s)
    scheduleDraw()
  }, [roomId, scheduleDraw, fetchScene])

  // Сверка «не потерялось ли». Штрих ходит по realtime ровно один раз и без
  // подтверждения: одна не доехавшая посылка — и написанного у собеседника нет,
  // причём молча и до самого перезахода на доску. Поэтому раз в BOARD_SYNC_MS
  // спрашиваем у базы только счётчик и последний id (вся сцена — это мегабайты) и,
  // если у нас чего-то нет, перечитываем её.
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return
      if (loadedRef.current !== roomId || drawing.current) return
      // Своё ещё не сохранено — сверять не с чем: база заведомо отстаёт от нас,
      // и «догон» вернул бы только что стёртое.
      if (savingRef.current || saveTimer.current) return
      const { data } = await supabase.from("boards_state")
        .select("n,last_id").eq("student_id", String(roomId)).maybeSingle()
      if (!data) return
      if ((data.n || 0) > strokes.current.size || (data.last_id && !strokes.current.has(data.last_id))) resync()
    }
    const id = setInterval(tick, BOARD_SYNC_MS)
    return () => clearInterval(id)
  }, [roomId, resync])

  // Вкладку могут убить, не дав нам размонтироваться: телефон ушёл в фон, PWA
  // выгрузили, страницу закрыли. Отложенное сохранение (1,2 с) в этот момент
  // ещё не сработало, и написанное последним пропадало — «решил на доске, зашёл
  // заново, а там ничего». Поэтому на уход в фон и на закрытие дописываем сразу.
  useEffect(() => {
    const flush = () => {
      if (!saveTimer.current) return
      clearTimeout(saveTimer.current); saveTimer.current = null
      persistRef.current?.()
    }
    const onHide = () => { if (document.visibilityState === "hidden") flush() }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", flush)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", flush)
    }
  }, [])

  // Обрыв сокета виден не сразу — heartbeat замечает его до полуминуты, и всё это
  // время канал считается живым, а сообщения уже не идут. Поэтому ждать события
  // канала нельзя: перечитываем сцену и по возвращении вкладки, и по подъёму сети.
  useEffect(() => {
    const onWake = () => { if (document.visibilityState === "visible") resync() }
    document.addEventListener("visibilitychange", onWake)
    window.addEventListener("online", onWake)
    return () => {
      document.removeEventListener("visibilitychange", onWake)
      window.removeEventListener("online", onWake)
    }
  }, [resync])

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
        if (!from) {
          // Черновик правки идёт под id уже готового штриха: пока он в «работе»,
          // сцену надо пересобрать без оригинала, иначе старая надпись просвечивает.
          const over = strokes.current.has(payload.id)
          live.current.set(payload.id, st)
          if (over) scheduleDraw(); else scheduleLive()
          return
        }
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
        // Вкладка, закрытая без выхода (телефон уснул, PWA убили, сеть оборвалась),
        // остаётся в presence до таймаута сокета, а её ключ — тот же аккаунт: ученик,
        // зашедший заново, светился бы вторым и третьим человеком. Оставляем по одному
        // на аккаунт — последнего, он и есть живой.
        const people = [...new Map(
          Object.values(channel.presenceState()).flat().map((p) => [p.userId, p]),
        ).values()]
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
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return
        channel.track({ userId, name: userName, proto: 2, following: followRef.current || null })
        // Первое подключение сцену принесёт начальная загрузка; повторное — это
        // подъём после обрыва, и вот тут надо догнать написанное без нас.
        if (joinedOnce.current) resync()
        joinedOnce.current = true
      })

    return scheduleTeardown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, userName, resync])

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
    // Написанное в последнюю секунду ДОПИСЫВАЕМ, а не выбрасываем. Отложенное
    // сохранение ждёт 1,2 с, и раньше уход отсюда его просто отменял: доску
    // закрывают не только кнопкой (смена комнаты, «назад», выход из кабинета),
    // и последний штрих в этих случаях пропадал молча.
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; persistRef.current?.() }
    clearTimeout(sendTimer.current); clearTimeout(viewSendTimer.current)
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

  // Щипок по тачпаду. Safari (и только он) шлёт на такой жест НЕ колесо с ctrl, а
  // свои gesturestart/change/end, и, пока их никто не перехватывает, увеличивает
  // САМУ СТРАНИЦУ. Доска при этом остаётся `fixed` во весь layout-вьюпорт, а
  // видно только его кусок — то есть шапка уезжает выше экрана, панель ниже, и
  // на экране остаётся один холст без единой кнопки. Ровно так доска и «теряла
  // интерфейс»: увеличенная страница ещё и перерисовывается заметно медленнее.
  // Поэтому жест ловим на ВСЁМ слое доски (не только на холсте: щипок над
  // панелью зумил бы страницу так же) и переводим в зум самой доски.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let prev = 1
    const start = (e) => { e.preventDefault(); prev = e.scale || 1 }
    const change = (e) => {
      e.preventDefault()
      const cv = canvasRef.current
      const s = e.scale || 1
      const f = prev > 0 ? s / prev : 1
      prev = s
      if (!cv) return
      // На сенсорном экране щипок уже считают сами касания (beginGesture), а
      // Safari шлёт поверх них ещё и свой жест: без этой проверки доска
      // увеличивалась бы вдвое быстрее пальцев. Здесь остаётся только запрет
      // страничного зума — им и ограничиваемся.
      if (gesture.current || pointers.current.size >= 2) return
      const r = cv.getBoundingClientRect()
      zoomAt(clamp(e.clientX - r.left, 0, r.width), clamp(e.clientY - r.top, 0, r.height), f)
      scheduleDraw()
    }
    const end = (e) => { e.preventDefault(); prev = 1 }
    // Колёсный зум страницы (ctrl+колесо в Chrome и Firefox, ⌘+колесо в Safari)
    // над шапкой и панелью — та же беда, что и щипок: холст свой wheel уже
    // перехватывает, а здесь остаётся всё остальное.
    const wheel = (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault() }
    const opts = { passive: false }
    root.addEventListener("gesturestart", start, opts)
    root.addEventListener("gesturechange", change, opts)
    root.addEventListener("gestureend", end, opts)
    root.addEventListener("wheel", wheel, opts)
    return () => {
      root.removeEventListener("gesturestart", start, opts)
      root.removeEventListener("gesturechange", change, opts)
      root.removeEventListener("gestureend", end, opts)
      root.removeEventListener("wheel", wheel, opts)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Подстраховка: страницу всё равно могли увеличить — с клавиатуры (⌘+), жестом
  // мимо доски или ещё до её открытия. Тогда `fixed inset-0` шире видимой области,
  // и шапка с панелью оказываются за экраном. Пока страница увеличена, слой доски
  // держим по ВИДИМОЙ области (visualViewport), а не по layout-вьюпорту, — чтобы
  // интерфейс нельзя было потерять вовсе. Масштаб 1 — стиля нет, и всё как было.
  const [vvBox, setVvBox] = useState(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => {
      if (vv.scale > 1.01) {
        setVvBox((b) => (b && b.left === vv.offsetLeft && b.top === vv.offsetTop
          && b.width === vv.width && b.height === vv.height) ? b
          : { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height })
      } else setVvBox((b) => (b ? null : b))
    }
    sync()
    vv.addEventListener("resize", sync)
    vv.addEventListener("scroll", sync)
    return () => { vv.removeEventListener("resize", sync); vv.removeEventListener("scroll", sync) }
  }, [])

  // --- Сохранение ---------------------------------------------------------
  // Доска сохраняется сама и молча: отметки «сохр…/сохранено» в шапке нет — она
  // мигала при каждом штрихе и отвлекала от занятия. Сбой сохранения остаётся
  // виден в консоли, чтобы молчание не прятало настоящую ошибку.
  //
  // Сохраняем ДЕЛЬТУ, а не всю сцену. Раньше каждый клиент заливал сюда весь
  // холст целиком, а к середине года он весит мегабайты: три мегабайта в каждую
  // паузу письма забивали канал (посылки realtime идут по той же сети и начинали
  // теряться), да ещё и затирали чужое — штрих собеседника, не доехавший по
  // realtime, пропадал из базы, и «догон» его уже не возвращал.
  const rememberSaved = (list) => {
    savedRef.current = new Map(list.map((s) => [s.id, { s, json: null }]))
  }
  // Запасной путь: миграции board_delta.sql нет — пишем сцену целиком, как раньше.
  // Картинка, которая ещё едет в хранилище (pending), лежит под временным
  // blob-адресом: за пределами этой вкладки он не значит ничего, поэтому в базу
  // такой штрих не пишем. Он сохранится сам, когда получит постоянный адрес
  // (см. addImageAt) — то же самое и в persist, и в снимке занятия.
  const fullSave = useCallback(() => {
    const list = Array.from(strokes.current.values()).filter((s) => !s.pending)
    const scene = { strokes: list, bg: bgRef.current, bgColor: bgColorRef.current }
    return supabase.from("boards")
      .upsert({ student_id: String(roomId), scene, updated_by: userId, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) {
          if (error.code === "42501") setSaveDenied(true)
          throw error
        }
        rememberSaved(list)
        savedMeta.current = { bg: scene.bg, bgColor: scene.bgColor }
      })
  }, [roomId, userId])

  const persist = useCallback(() => {
    if (savingRef.current) { saveAgain.current = true; return }
    const bg = bgRef.current, bgColor = bgColorRef.current
    const saved = savedRef.current, dirty = dirtyRef.current
    // Что изменилось: новый объект штриха (перерисовали, заменили) ловится
    // сравнением ссылок, правка на месте (цвет, ширина, перенос) — пометкой dirty.
    const up = [], pend = new Map()
    for (const [id, st] of strokes.current) {
      if (st.pending) continue      // ещё не в хранилище — см. fullSave выше
      const rec = saved.get(id)
      if (rec && rec.s === st && !dirty.has(id)) continue
      const json = JSON.stringify(st)
      if (rec && rec.json === json) { rec.s = st; continue }  // изменили и вернули как было
      up.push(st); pend.set(id, { s: st, json })
    }
    const del = []
    for (const id of saved.keys()) if (!strokes.current.has(id)) del.push(id)
    const metaNew = savedMeta.current.bg !== bg || savedMeta.current.bgColor !== bgColor
    dirty.clear()
    if (!up.length && !del.length && !metaNew) return
    savingRef.current = true
    const done = (ok) => {
      savingRef.current = false
      if (ok) {
        for (const [id, rec] of pend) saved.set(id, rec)
        for (const id of del) saved.delete(id)
        savedMeta.current = { bg, bgColor }
      } else {
        // не доехало — вернём в следующую посылку (ссылка та же, поэтому через dirty)
        for (const id of pend.keys()) dirty.add(id)
      }
      // Дозапись идёт СВОИМ таймером, а не scheduleSave: тот гасится при уходе с
      // доски, и написанное в последнюю секунду терялось бы вместе с ним.
      if (saveAgain.current) { saveAgain.current = false; setTimeout(persistRef.current, 300) }
    }
    if (patchOff.current) { fullSave().then(() => done(true), (e) => { console.error("board save", e); done(false) }); return }
    // Доску очистили — не перечисляем тысячу id, а говорим «старого не оставляем».
    const wipe = strokes.current.size === 0 && del.length > 0
    supabase.rpc("board_patch", {
      p_student_id: String(roomId),
      p_up: up, p_del: wipe ? [] : del,
      p_bg: bg, p_bg_color: bgColor, p_by: userId, p_wipe: wipe,
    }).then(({ error }) => {
      // Функции в базе нет (миграция не выполнена) — переходим на старый путь и
      // больше её не дёргаем: доска обязана сохраняться и без миграции.
      if (error && (error.code === "PGRST202" || error.code === "42883")) {
        patchOff.current = true
        fullSave().then(() => done(true), (e) => { console.error("board save", e); done(false) })
        return
      }
      if (error) console.error("board save", error)
      if (error?.code === "42501") setSaveDenied(true)
      done(!error)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, fullSave])
  persistRef.current = persist
  function scheduleSave() {
    if (loadedRef.current !== roomId) return // не сохраняем до загрузки сцены ЭТОЙ доски — иначе затрём её пустой или чужой
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { saveTimer.current = null; persist() }, 1200)
  }

  // Снимок занятия в историю (board_snapshots): живая доска у ученика одна, а
  // разобранное на прошлом уроке должно оставаться доступным. Одна запись на день —
  // повторное закрытие доски за то же занятие обновляет её, а не плодит строки.
  async function archiveSnapshot() {
    if (loadedRef.current !== roomId) return   // сцену не загрузили — архивировать нечего
    // Доска домашней работы в летопись занятий не идёт: она не про урок, живёт
    // столько же, сколько сама работа, и открывается из неё же.
    if (isHomeworkRoom(roomId)) return
    const list = Array.from(strokes.current.values()).filter((s) => !s.pending)
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
    commitTextEdit()   // недописанная надпись не должна пропасть вместе с доской
    // Живую доску дописываем сразу: отложенное сохранение могло ещё не сработать.
    clearTimeout(saveTimer.current)
    if (loadedRef.current === roomId) persist()
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

  // Верхний объект под точкой (мировые координаты). Порядок карты — это порядок
  // рисования, поэтому берём ПОСЛЕДНИЙ подходящий: он лежит поверх остальных.
  // След ластика пропускаем: он невидим, и «выделить» его человек не собирался.
  function topStrokeAt(x, y, tol) {
    let hit = null
    for (const [id, s] of strokes.current) {
      if (s.tool === "eraser") continue
      if (hitStroke(s, x, y, tol)) hit = id
    }
    return hit
  }

  function onPointerDown(e) {
    // Открыт попап панели → первый тык по холсту просто закрывает его, не рисуя
    if (menu) { closeMenu(); return }
    // Идёт набор надписи → тык по холсту его завершает. Инструмент «Текст» при
    // этом тем же нажатием начинает следующую надпись: так пишут подписи к
    // чертежу — одну за другой, не возвращаясь каждый раз в панель.
    if (editPos.current) { commitTextEdit(); if (tool !== "text") return }
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

    // «Текст» ничего не рисует: нажатие ставит поле ввода (или открывает то,
    // что уже написано в этом месте).
    // preventDefault — чтобы браузер не увёл фокус с только что открытого поля
    // на холст своим mousedown: ровно из-за этого приходилось нажимать второй раз.
    if (tool === "text") { e.preventDefault(); beginTextAt(e.clientX, e.clientY); return }

    // «Курсор» — выделение рамкой / перемещение выделенного (не рисует)
    if (tool === "cursor") {
      const p = toWorld(e.clientX, e.clientY)
      let bb = selectionBBox()
      // Взяться можно за САМ объект, а не только за уже выделенное: нажали на
      // фигуру — она тут же под рукой и едет за курсором, без предварительного
      // клика «сначала выдели». Выделенной она при этом становится (иначе
      // нечем было бы поменять ей цвет или размер сразу после переноса), но
      // отдельного нажатия ради этого больше не нужно.
      if (!bb || !pointInBBox(p[0], p[1], bb)) {
        const hit = topStrokeAt(p[0], p[1], 6 / view.current.scale)
        // Рамкой выделения (marquee) остаётся протяжка ПО ПУСТОМУ месту.
        bb = null
        if (hit) { selection.current = new Set([hit]); applySelCount(1); bb = selectionBBox() }
      }
      if (bb) {
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
          const sb = strokeBox(so)
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
      const { before, dx, dy } = movingSel.current
      movingSel.current = null
      guides.current = []; snapBoxes.current = []
      // Нажали и отпустили, не сдвинув, — это просто выбор объекта: рассылать и
      // класть в историю нечего, иначе «отменить» тратилось бы на пустой шаг.
      if (dx || dy) commitSelection(before)
      scheduleDraw()
      return
    }
    // Завершение рамки — выбираем штрихи, попавшие в неё (крошечная рамка = клик = снять выделение)
    if (marquee.current) {
      const m = marquee.current; marquee.current = null
      const rect = { minX: Math.min(m.x0, m.x1), minY: Math.min(m.y0, m.y1), maxX: Math.max(m.x0, m.x1), maxY: Math.max(m.y0, m.y1) }
      selection.current.clear()
      if (Math.abs(m.x1 - m.x0) > 4 || Math.abs(m.y1 - m.y0) > 4) {
        for (const [id, s] of strokes.current) if (rectsIntersect(rect, strokeBox(s))) selection.current.add(id)
      } else {
        // Крошечная рамка = одиночный клик: выделяем верхний объект под курсором
        const hit = topStrokeAt(m.x0, m.y0, 6 / view.current.scale)
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

  // Двойное нажатие по надписи открывает её на правку — привычка из любого
  // редактора; иначе поправить опечатку можно было бы только стерев всё заново.
  function onDoubleClick(e) {
    if (tool === "text" || editPos.current) return   // там хватает одиночного нажатия
    const st = textAt(toWorld(e.clientX, e.clientY))
    if (st) editTextStroke(st)
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

  // ⌘A — выделить всё написанное. Рамкой этого не сделать: доска бесконечная,
  // и написанное на предыдущем экране остаётся за краем видимой области.
  function selectAll() {
    actions.current.commitText?.()   // набираемое становится штрихом, иначе выделение его не увидит
    if (!strokes.current.size) return
    // Порядок важен: сначала берём курсор (сброс выделения при смене инструмента
    // на «курсор» не срабатывает), потом выделяем.
    setTool("cursor")
    selection.current = new Set(strokes.current.keys())
    applySelCount(selection.current.size)
    scheduleDraw()
  }

  // Рассылка изменённых штрихов после трансформации/правки + сохранение.
  // before — снимок из snapshotSelection(): без него правка не попадёт в историю.
  function commitSelection(before = null) {
    for (const id of selection.current) {
      const s = strokes.current.get(id)
      // Правки выделения (цвет, ширина, перенос, поворот) меняют штрих НА МЕСТЕ,
      // ссылка остаётся прежней — без пометки сохранение их не заметит.
      // Картинку, ещё едущую в хранилище, собеседнику не шлём: у него нет её
      // временного адреса. Он получит её целиком, когда загрузка кончится.
      if (s) { dirtyRef.current.add(id); if (!s.pending) channelRef.current?.send({ type: "broadcast", event: "draw", payload: s }) }
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
    if (mode === "resize") for (const id of selection.current) { const t0 = strokes.current.get(id)?.tool; if (t0 === "image" || t0 === "text") { keepRatio = true; break } }
    const startW = toWorld(e.clientX, e.clientY)
    const snapshot = new Map()
    for (const id of selection.current) {
      const s = strokes.current.get(id)
      if (s) snapshot.set(id, { points: s.points.map((p) => [...p]), angle: s.angle || 0, size: s.size || TEXT_DEFAULT })
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
        // Надпись тянется не габаритом, а КЕГЛЕМ: растянутая буква читается как
        // брак, поэтому размер шрифта умножается на тот же коэффициент, а рамка
        // пересобирается по новым метрикам текста.
        let nhw, nhh
        if (s.tool === "text") {
          s.size = clamp(snapshot.get(L.id).size * Math.abs(scaleU), TEXT_MIN, TEXT_MAX)
          const m = textMetrics(s.text, s.size, s)
          nhw = m.w / 2; nhh = m.h / 2
        } else {
          nhw = Math.max(2, L.hw0 * Math.abs(scaleU)); nhh = Math.max(2, L.hh0 * Math.abs(scaleV))
        }
        const cU = hx !== 0 ? hx * nhw * Math.sign(scaleU || 1) : 0, cV = hy !== 0 ? hy * nhh * Math.sign(scaleV || 1) : 0
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
          if (s.tool === "text") {
            // В группе надпись тоже меняет кегль, а не растягивается
            s.size = clamp(snap.size * Math.min(Math.abs(sx), Math.abs(sy)), TEXT_MIN, TEXT_MAX)
            const a = s.points[0], b = s.points[s.points.length - 1]
            s.points = textBoxPoints(Math.min(a[0], b[0]), Math.min(a[1], b[1]), s.text, s.size, s)
          }
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
  // topLeft — координаты задают ЛЕВЫЙ ВЕРХНИЙ угол, а не центр: лист с заданием
  // кладётся под уже написанным, а его высота известна только здесь, после снимка.
  // taskKey — пометка «это задание из работы»: по ней доска узнаёт лежащий лист и
  // не кладёт второй, когда ученик открывает то же задание снова.
  // answer — правильный ответ задания: с ним под листом появляется поле для ответа
  // с проверкой (см. TaskAnswerBox).
  // onPlaced — картинка уже на доске (адреса в хранилище ещё нет). Ею гасится
  // ожидание у листа с заданием: держать поверх доски лоадер, пока лист на ней
  // уже лежит, значит показывать занятость на пустом месте.
  //
  // Картинка ложится на доску СРАЗУ, а в хранилище едет фоном. Снимок экрана
  // весит мегабайты, и раньше всё это время на доске не было ничего: ни
  // картинки, ни признака, что идёт загрузка, — вставка выглядела как «нажал и
  // ничего не произошло». Пока адрес хранилища не получен, штрих помечен
  // pending: он виден, его можно двигать и стирать, но собеседнику он не
  // уходит и в базу не сохраняется — blob-адрес за пределами этой вкладки не
  // значит ничего. Что загрузка идёт, видно по плашке над самой картинкой.
  async function addImageAt(file, worldX, worldY, { fitWidth = null, maxSide = 360, sheet = false, topLeft = false, taskKey = null, answer = null, onPlaced = null, place = null } = {}) {
    if (!file || !file.type?.startsWith("image/")) return null
    let info
    try { info = await processImageFile(file, sheet ? SHEET_MAX_DIM : 1400) } catch { return null }
    const id = makeId(userId)
    const localSrc = URL.createObjectURL(info.blob)
    const k = fitWidth ? fitWidth / info.w : Math.min(1, maxSide / Math.max(info.w, info.h))
    const ww = info.w * k, hh = info.h * k
    // place выбирает место, ЗНАЯ готовый размер: свободный угол доски нельзя
    // найти, пока не известно, какой ширины и высоты будет лист.
    let px = worldX, py = worldY, tl = topLeft
    if (place) { const pt = place(ww, hh); px = pt[0]; py = pt[1]; tl = true }
    const x0 = tl ? px : px - ww / 2, y0 = tl ? py : py - hh / 2
    const s = { id, author: userId, tool: "image", src: localSrc, pending: 1, points: [[x0, y0], [x0 + ww, y0 + hh]] }
    if (sheet) s.sheet = 1   // лист с заданием: рисуется в цветах доски, а не как фото
    if (taskKey) s.task = taskKey
    // Правильный ответ едет вместе с листом: сверку ученик делает у себя, без
    // сервера, поэтому эталон должен быть на доске. ПОКАЗЫВАЕТСЯ он при этом
    // только репетитору (см. TaskAnswerBox): ученик получает «верно/неверно», а
    // не готовый ответ.
    if (answer) s.qa = { a: answer }
    // Своя картинка уже разобрана в памяти — кладём её в кэш, чтобы лист появился
    // мгновенно: иначе доска пошла бы читать заново то, что уже держит в руках.
    if (info.img) imgCache.current.set(localSrc, info.img)
    if (info.url) ownBlobs.current.push(info.url)
    getImage(localSrc) // начать загрузку/кэшировать для мгновенной отрисовки
    strokes.current.set(id, s)
    // Шаг истории кладём сразу — «отменить» должно убирать картинку, не дожидаясь
    // хранилища; когда адрес придёт, он проставится и в этот шаг (иначе «вернуть»
    // восстановило бы картинку с временным адресом).
    const step = { id, before: null, after: cloneStroke(s) }
    pushHistory([step])
    setTool("cursor"); selection.current = new Set([id]); setSelCount(1)
    scheduleDraw()
    onPlaced?.(s)

    let src = null
    try {
      // Папка — КАРТОЧКА ученика, а не адрес доски: политики storage разбирают
      // путь по папкам и составного адреса доски домашней работы не знают.
      const path = `board/${roomStudentId(roomId)}/${id}.${info.ext}`
      const { error } = await supabase.storage.from(IMG_BUCKET).upload(path, info.blob, { upsert: true, contentType: info.type })
      if (!error) src = supabase.storage.from(IMG_BUCKET).getPublicUrl(path).data.publicUrl
    } catch { /* остаётся data URL как запасной вариант */ }
    // Загрузка не удалась — картинка едет внутри самой сцены. Это дорого (сцена
    // раздувается), поэтому base64 считаем только здесь, а не на каждой вставке.
    if (!src) src = await readFileAsDataURL(info.blob)
    // Разобранную картинку переносим под постоянный адрес: качать из хранилища
    // то, что сами только что туда отправили, незачем. Временный адрес после
    // этого освобождаем — но только когда картинка по нему дочитана, иначе
    // отзыв оборвал бы саму загрузку.
    const img = imgCache.current.get(localSrc)
    if (img && !imgCache.current.has(src)) imgCache.current.set(src, img)
    imgCache.current.delete(localSrc)
    // Отпускаем временный адрес, только когда растр ДОЧИТАН: complete значит лишь
    // «файл получен», а разбирает его WebKit лениво, к первой отрисовке — отзыв до
    // этого оставляет на доске пустое место вместо картинки.
    const free = () => URL.revokeObjectURL(localSrc)
    if (!img) free()
    else Promise.resolve(img.decode?.()).then(free, free)
    step.after.src = src; delete step.after.pending
    const cur = strokes.current.get(id)
    if (!cur) return null   // картинку успели стереть или отменить — рассылать нечего
    cur.src = src; delete cur.pending
    dirtyRef.current.add(id)   // правка НА МЕСТЕ: без пометки дельта её не заметит
    channelRef.current?.send({ type: "broadcast", event: "draw", payload: cur })
    scheduleDraw()
    // Сохраняем сразу, а не общим отложенным таймером: доску могли закрыть, пока
    // картинка ехала, — тот таймер при уходе гасится, и она пропала бы.
    persistRef.current?.()
    return cur
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
  // Свободное место под лист размером w×h. Центр экрана лист занимал и тогда,
  // когда там уже написано, — задание ложилось поверх разбора и закрывало его.
  // Поэтому сначала центр, потом сетка по видимой области, а если и там занято —
  // под всем написанным (туда же ведём обзор, иначе лист лёг бы за краем экрана).
  function freeSpot(w, h) {
    const c = canvasRef.current
    const boxes = []
    for (const st of strokes.current.values()) { const b = strokeBox(st); if (b) boxes.push(b) }
    const free = (x, y) => !boxes.some((b) => rectsIntersect({ minX: x - SPOT_PAD, minY: y - SPOT_PAD, maxX: x + w + SPOT_PAD, maxY: y + h + SPOT_PAD }, b))
    const r = c.getBoundingClientRect()
    const [vx0, vy0] = toWorld(r.left, r.top)
    const [vx1, vy1] = toWorld(r.left + c.clientWidth, r.top + c.clientHeight)
    const cx = (vx0 + vx1) / 2 - w / 2, cy = (vy0 + vy1) / 2 - h / 2
    if (free(cx, cy)) return { x: cx, y: cy }
    const stepX = Math.max(w / 2, 80), stepY = Math.max(h / 3, 80)
    for (let y = vy0 + SPOT_PAD; y + h <= vy1 - SPOT_PAD; y += stepY)
      for (let x = vx0 + SPOT_PAD; x + w <= vx1 - SPOT_PAD; x += stepX)
        if (free(x, y)) return { x, y }
    const bb = sceneBBox([...strokes.current.values()])
    return bb ? { x: bb.minX, y: bb.maxY + SHEET_GAP, off: true } : { x: cx, y: cy }
  }
  // Лист с заданием из банка — на свободное место, а не поверх написанного.
  async function insertTaskSheet(file, sheetWidth, answer = null) {
    const c = canvasRef.current; if (!c) return
    let off = false
    await addImageAt(file, 0, 0, {
      fitWidth: sheetWidth, sheet: true, answer,
      place: (w, h) => { const spot = freeSpot(w, h); off = !!spot.off; return [spot.x, spot.y] },
      onPlaced: (st) => { if (off) focusSheet(strokeBBox(st)) },
    })
  }

  // Проверка ответа на листе. Ответ и результат кладутся в САМ штрих: так их видит
  // вторая сторона (доска общая) и они переживают перезагрузку. Правка идёт НА МЕСТЕ,
  // поэтому штрих помечается в dirtyRef — иначе дельта его не заметит и не сохранит.
  function checkTaskAnswer(id, given) {
    const st = strokes.current.get(id)
    if (!st?.qa) return
    const v = String(given || "").trim()
    if (!v) return
    st.qa = { ...st.qa, v, ok: answersEqual(v, st.qa.a) }
    dirtyRef.current.add(id)
    channelRef.current?.send({ type: "broadcast", event: "draw", payload: st })
    scheduleSave(); scheduleDraw()
  }
  function resetTaskAnswer(id) {
    const st = strokes.current.get(id)
    if (!st?.qa) return
    st.qa = { a: st.qa.a }
    dirtyRef.current.add(id)
    channelRef.current?.send({ type: "broadcast", event: "draw", payload: st })
    scheduleSave(); scheduleDraw()
  }

  // Задание, которое ученик открыл кнопкой «Решить на доске» в домашней работе.
  // Лист кладётся ПОД всем написанным, а не в центр обзора: доска бесконечная,
  // место под решение всегда есть, а поверх чужой записи лист лёг бы стеной.
  // Второй раз то же задание не переносим — лист помечен ключом работы и номера,
  // и доска просто везёт к нему обзор: иначе к концу недели их лежала бы стопка.
  async function placeTaskSheet(req) {
    const found = [...strokes.current.values()].find((st) => st.task === req.key)
    if (found) { focusSheet(strokeBBox(found)); return }
    setSheetBusy(true); setSheetErr(false)
    try {
      // Снимок задания тянет за собой html2canvas — грузим только по нажатию,
      // иначе кабинет ученика потяжелел бы на него у всех.
      const { taskToImageFile, SHEET_WIDTH } = await import("../pages/taskSnapshot")
      const file = await taskToImageFile(req.task, { label: req.label || "" })
      const bb = sceneBBox([...strokes.current.values()])
      const x = bb ? bb.minX : -SHEET_WIDTH / 2
      const y = bb ? bb.maxY + SHEET_GAP : -SHEET_GAP
      // Лоадер гасим и ведём обзор к листу, как только он лёг на доску: ждать
      // конца загрузки в хранилище незачем — лист уже виден, и на нём стоит
      // своя плашка «Отправляется».
      let placed = false
      await addImageAt(file, x, y, {
        fitWidth: SHEET_WIDTH, sheet: true, topLeft: true, taskKey: req.key,
        onPlaced: (st) => { placed = true; setSheetBusy(false); focusSheet(strokeBBox(st)) },
      })
      if (!placed) setSheetErr(true)
    } catch {
      // Молчать нельзя: ученик остался бы на пустой доске, не понимая, куда делось
      // задание, — а условие у него на соседней вкладке кабинета.
      setSheetErr(true)
    }
    setSheetBusy(false)
  }

  // Лист ставим в ВЕРХ экрана: под ним должно остаться место, где решают.
  // С повтором: доска открывается поверх кабинета, и в первые кадры холст ещё
  // нулевой ширины — навести обзор по одной попытке значило бы оставить ученика
  // смотреть мимо только что перенесённого задания. Повтор идёт ТОЛЬКО пока
  // холст не измерен (только в этом случае viewToBBox отвечает false), поэтому
  // рисующему в это время человеку доска обзор не дёргает.
  function focusSheet(bb, tries = 20) {
    if (!bb) return
    stopFollow()
    if (viewToBBox({ ...bb, maxY: bb.maxY + (bb.maxY - bb.minY) * 0.6 })) return
    if (tries > 0) setTimeout(() => focusSheet(bb, tries - 1), 100)
  }

  function duplicateSelection() {
    if (!selection.current.size) return
    const next = new Set()
    for (const id of selection.current) {
      const s = strokes.current.get(id); if (!s) continue
      // Картинку, ещё едущую в хранилище, дублировать нечем: у копии остался бы
      // временный адрес, который никогда не заменится постоянным.
      if (s.pending) continue
      const ns = { ...s, id: makeId(userId), author: userId, points: s.points.map((p) => [p[0] + 16, p[1] + 16, ...p.slice(2)]) }
      strokes.current.set(ns.id, ns)
      channelRef.current?.send({ type: "broadcast", event: "draw", payload: ns })
      next.add(ns.id)
    }
    if (!next.size) return                    // дублировать было нечего
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
      // У надписи тот же ползунок меняет кегль, а габарит собирается заново по
      // метрикам — вокруг прежнего центра, чтобы текст не уползал из-под руки.
      if (s.tool === "text") {
        if ((s.size || TEXT_DEFAULT) === w) continue
        s.size = w
        refitText(s)
        widthDrag.current.changed = true
        continue
      }
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
  // Кегль и начертание меняют ширину строки, поэтому габарит надписи собирается
  // заново по метрикам — вокруг прежнего центра, чтобы текст не уползал из-под руки.
  function refitText(s) {
    const a = s.points[0], b = s.points[s.points.length - 1]
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2
    const m = textMetrics(s.text, s.size || TEXT_DEFAULT, s)
    s.points = [[cx - m.w / 2, cy - m.h / 2], [cx + m.w / 2, cy + m.h / 2]]
  }
  // Полужирный и курсив у выделенной надписи. Обычное начертание — это отсутствие
  // поля: «bold: false» у каждой подписи только раздувал бы сцену.
  function setSelectionFace(key, on) {
    if (!selection.current.size) return
    const before = snapshotSelection()
    let changed = false
    for (const id of selection.current) {
      const s = strokes.current.get(id)
      if (!s || s.tool !== "text") continue
      if (on) s[key] = 1
      else delete s[key]
      refitText(s)
      changed = true
    }
    if (changed) commitSelection(before)
    scheduleDraw()
  }
  function setSelectionDash(d) {
    if (!selection.current.size) return
    const before = snapshotSelection()
    for (const id of selection.current) { const s = strokes.current.get(id); if (s && s.tool !== "eraser") s.dash = d }
    commitSelection(before); scheduleDraw()
  }

  // --- Текст --------------------------------------------------------------
  // Надпись набирается настоящим полем ввода поверх холста (со своей раскладкой,
  // автозаменой и подсказками клавиатуры на телефоне), а на доску ложится
  // строкой — см. paintStroke. Рисовать буквы самим значило бы отнять у ученика
  // и родной ввод, и возможность потом эту надпись поправить.
  const TEXT_PAD = 4   // насколько поле ввода шире набранного: место под курсор

  // Поле стоит в МИРОВЫХ координатах, а живёт в HTML — значит, его место и кегль
  // надо править в каждом кадре: обзор двигают колесом, пальцами и слежением, и
  // ни одно из этих движений через React не проходит.
  function layoutTextEditor() {
    const box = editBoxRef.current, ta = editRef.current, p = editPos.current
    if (!box || !p) return
    const v = view.current
    const m = textMetrics(ta ? ta.value : p.value, p.size, p)
    box.style.left = `${p.x * v.scale + v.x}px`
    box.style.top = `${p.y * v.scale + v.y}px`
    box.style.transform = p.angle ? `rotate(${p.angle}rad)` : ""
    if (!ta) return
    const col = resolveColor(p.color, isDarkColor(bgColorRef.current))
    ta.style.font = textFont(p.size * v.scale, p)   // сокращённая запись сбрасывает интерлиньяж…
    ta.style.lineHeight = `${p.size * v.scale * TEXT_LINE}px`  // …поэтому он ставится следом
    ta.style.width = `${m.w * v.scale + TEXT_PAD}px`
    ta.style.height = `${m.h * v.scale}px`
    ta.style.color = col
    ta.style.caretColor = col
    // Панель ставим НАД полем, а у самого верха экрана — под ним, иначе она уедет
    // за край. Поворот надписи ей компенсируем: наклонённый ряд кнопок не читается.
    const bar = editBarRef.current
    if (!bar) return
    const above = p.y * v.scale + v.y > 64
    bar.style.bottom = above ? "100%" : "auto"
    bar.style.top = above ? "auto" : "100%"
    bar.style.marginBottom = above ? "8px" : "0"
    bar.style.marginTop = above ? "0" : "8px"
    bar.style.transformOrigin = above ? "0 100%" : "0 0"
    bar.style.transform = p.angle ? `rotate(${-p.angle}rad)` : ""
  }

  // Надпись под точкой (мировые координаты) — по ней открывается правка
  function textAt(p) {
    const tol = 6 / view.current.scale
    let hit = null
    for (const st of strokes.current.values()) if (st.tool === "text" && hitStroke(st, p[0], p[1], tol)) hit = st
    return hit
  }
  // ГЛАВНОЕ: фокус ставится ПРЯМО ЗДЕСЬ, внутри обработчика нажатия, и до того,
  // как React перерисует доску. Иначе поле появляется, а курсора в нём нет:
  // Safari и iOS ставят фокус (и показывают клавиатуру) только по ходу самого
  // жеста, а в прочих браузерах фокус тут же уводит совместимостное mousedown по
  // холсту. Поэтому же поле ввода ВСЕГДА живёт в разметке — создать его и
  // сфокусировать одним жестом React не успевает.
  function openTextEditor(ed) {
    // draftId — id будущего штриха. Он нужен ДО окончания набора: черновик
    // уходит собеседнику под ним же, и финальный штрих просто заменяет черновик.
    const next = { ...ed, seq: ++textSeq.current, draftId: ed.id || makeId(userId) }
    editPos.current = next
    const ta = editRef.current
    if (ta) {
      ta.value = ed.value || ""
      layoutTextEditor()                  // сначала на место, иначе экран дёрнется к нулю
      ta.focus({ preventScroll: true })
      const n = ta.value.length
      try { ta.setSelectionRange(n, n) } catch { /* поле ещё не готово — курсор встанет сам */ }
    }
    setEditText(next)
    scheduleDraw()   // правимая надпись уходит с холста в поле ввода
  }
  // Правка уже написанного: цвет и кегль подставляются в панель, иначе первое же
  // прикосновение к ползунку перекрасило бы надпись во что-то постороннее.
  function editTextStroke(st) {
    setTool("text")
    setColor(st.color)
    setTextSize(st.size || TEXT_DEFAULT)
    setTextBold(!!st.bold); setTextItalic(!!st.italic)
    openTextEditor({ id: st.id, x: st.points[0][0], y: st.points[0][1], size: st.size || TEXT_DEFAULT,
      color: st.color, angle: st.angle || 0, value: st.text || "", bold: !!st.bold, italic: !!st.italic })
  }
  function beginTextAt(clientX, clientY) {
    const p = toWorld(clientX, clientY)
    const st = textAt(p)
    if (st) { editTextStroke(st); return }
    // Ставим строку СЕРЕДИНОЙ на точку нажатия: так надпись оказывается там, куда
    // смотрели, а не свисает под курсор.
    const m = textMetrics("", textSize, { bold: textBold, italic: textItalic })
    openTextEditor({ id: null, x: p[0], y: p[1] - m.lh / 2, size: textSize, color, angle: 0, value: "",
      bold: textBold, italic: textItalic })
  }
  // Набираемую надпись собеседник видит сразу, буква за буквой: на занятии
  // написанное читают по ходу, а не после того, как автор закончил и вышел из
  // поля. Черновик идёт «штрихом в работе» (drawp, from 0 — полная замена), в
  // сцену собеседника он не попадает и его сохранение не трогает.
  function textDraftStroke() {
    const ed = editPos.current
    if (!ed) return null
    const raw = editRef.current ? editRef.current.value : ed.value
    const text = raw.replace(/[ \t]+$/gm, "").replace(/\n+$/, "")
    if (!text.trim()) return null
    const st = { id: ed.draftId, author: userId, tool: "text", color: ed.color, text, size: ed.size,
      points: textBoxPoints(ed.x, ed.y, text, ed.size, ed) }
    if (ed.angle) st.angle = ed.angle
    if (ed.bold) st.bold = 1
    if (ed.italic) st.italic = 1
    return st
  }
  function sendTextDraft() {
    if (textDraftTimer.current) { clearTimeout(textDraftTimer.current); textDraftTimer.current = null }
    const ch = channelRef.current
    const ed = editPos.current
    if (!ch || !ed) return
    textDraftAt.current = performance.now()
    const st = textDraftStroke()
    if (!st) {
      // Поле опустело — черновик надо убрать, иначе стёртое висело бы у
      // собеседника до конца набора.
      if (textDraftSent.current) { textDraftSent.current = false; ch.send({ type: "broadcast", event: "remove", payload: { id: ed.draftId } }) }
      return
    }
    textDraftSent.current = true
    ch.send({ type: "broadcast", event: "drawp", payload: { ...st, from: 0 } })
  }
  // Не чаще TEXT_DRAFT_RATE, но последнее нажатие уходит обязательно.
  function scheduleTextDraft() {
    if (!editPos.current) return
    const wait = TEXT_DRAFT_RATE - (performance.now() - textDraftAt.current)
    if (wait <= 0) { sendTextDraft(); return }
    if (!textDraftTimer.current) textDraftTimer.current = setTimeout(sendTextDraft, wait)
  }

  // Набор окончен. Пустая надпись объекта не заводит, а стёртая — исчезает с доски:
  // прозрачный прямоугольник, который нельзя увидеть и можно случайно выделить,
  // хуже, чем его отсутствие.
  function commitTextEdit() {
    const ed = editPos.current
    if (!ed) return
    if (textDraftTimer.current) { clearTimeout(textDraftTimer.current); textDraftTimer.current = null }
    const draftSent = textDraftSent.current
    textDraftSent.current = false
    const raw = editRef.current ? editRef.current.value : ed.value
    // Поле остаётся в разметке, поэтому фокус надо снять руками: иначе он висит
    // в невидимом поле и глушит горячие клавиши доски (P, E, ⌘Z считают, что печатают).
    editRef.current?.blur()
    editPos.current = null
    setEditText(null)
    const text = raw.replace(/[ \t]+$/gm, "").replace(/\n+$/, "")
    const cur = ed.id ? strokes.current.get(ed.id) : null
    if (!text.trim()) {
      // Черновик у собеседника надо снять и тогда, когда своего штриха не было:
      // иначе набранное и стёртое осталось бы висеть на его доске.
      if (draftSent && !cur) channelRef.current?.send({ type: "broadcast", event: "remove", payload: { id: ed.draftId } })
      if (cur) {
        strokes.current.delete(ed.id)
        selection.current.delete(ed.id)
        channelRef.current?.send({ type: "broadcast", event: "remove", payload: { id: ed.id } })
        pushHistory([{ id: ed.id, before: cloneStroke(cur), after: null }])
        scheduleSave()
      }
      scheduleDraw()
      return
    }
    if (cur) {
      const before = cloneStroke(cur)
      cur.text = text; cur.size = ed.size; cur.color = ed.color
      // Обычное начертание — это ОТСУТСТВИЕ полей: сцена ходит по сети и лежит в
      // базе целиком, и «bold:false» у каждой подписи там лишний.
      if (ed.bold) cur.bold = 1; else delete cur.bold
      if (ed.italic) cur.italic = 1; else delete cur.italic
      cur.points = textBoxPoints(ed.x, ed.y, text, ed.size, ed)
      // Правка идёт НА МЕСТЕ (ссылка та же) — без пометки дельта её не заметит
      dirtyRef.current.add(cur.id)
      channelRef.current?.send({ type: "broadcast", event: "draw", payload: cur })
      pushHistory([{ id: cur.id, before, after: cloneStroke(cur) }])
    } else {
      const id = ed.draftId || makeId(userId)
      const st = { id, author: userId, tool: "text", color: ed.color, text, size: ed.size, points: textBoxPoints(ed.x, ed.y, text, ed.size, ed) }
      if (ed.angle) st.angle = ed.angle
      if (ed.bold) st.bold = 1
      if (ed.italic) st.italic = 1
      strokes.current.set(id, st)
      channelRef.current?.send({ type: "broadcast", event: "draw", payload: st })
      pushHistory([{ id, before: null, after: cloneStroke(st) }])
    }
    scheduleDraw(); scheduleSave()
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
    if (loadedRef.current !== roomId) return
    const list = [...strokes.current.values()]
    const v = view.current
    try {
      const all = JSON.parse(localStorage.getItem(VIEW_KEY) || "{}")
      all[String(roomId)] = { x: v.x, y: v.y, scale: v.scale, n: list.length, last: list.length ? list[list.length - 1].id : null }
      localStorage.setItem(VIEW_KEY, JSON.stringify(all))
    } catch { /* приватный режим — обзор просто не запомнится */ }
  }

  useEffect(() => { actions.current.undo = undo; actions.current.redo = redo; actions.current.del = deleteSelection; actions.current.selectAll = selectAll; actions.current.paste = addImageAt; actions.current.commitText = commitTextEdit })

  // Выбранный цвет держится между занятиями (см. COLOR_KEY)
  useEffect(() => {
    try { localStorage.setItem(COLOR_KEY, color) } catch { /* приватный режим — цвет просто не запомнится */ }
  }, [color])

  // Взяли другой инструмент — набранное сохраняем, а не теряем
  useEffect(() => { if (tool !== "text") actions.current.commitText?.() }, [tool])

  // Цвет и кегль меняют надпись прямо во время набора: панель для того и открыта.
  useEffect(() => {
    if (!editPos.current) return
    const next = { ...editPos.current, color, size: textSize, bold: textBold, italic: textItalic }
    editPos.current = next
    layoutTextEditor()   // начертание меняет ширину строки — поле подгоняем сразу
    setEditText((ed) => (ed && (ed.color !== color || ed.size !== textSize || ed.bold !== textBold || ed.italic !== textItalic)
      ? { ...ed, color, size: textSize, bold: textBold, italic: textItalic } : ed))
    scheduleLive()
    scheduleTextDraft()   // собеседник видит и смену цвета/кегля, а не только буквы
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, textSize, textBold, textItalic, scheduleLive])

  // Подстраховка: фокус и значение ставит openTextEditor (синхронно, в жесте), а
  // здесь поле лишь встаёт по месту после перерисовки.
  useEffect(() => {
    if (editText) layoutTextEditor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editText?.seq])

  // «Поверх доски открыт диалог» считается из самих состояний. Раньше флаг
  // выставляли руками в пяти местах, и один пропущенный сброс глушил ВСЕ горячие
  // клавиши доски — включая ⌘Z — до перезагрузки страницы.
  useEffect(() => { modalOpen.current = taskPick || confirmClear }, [taskPick, confirmClear])

  // Задание, с которым доску открыли снаружи. Ждём загрузки сцены: пока она не
  // прочитана, уже лежащего листа не видно, и задание легло бы вторым экземпляром.
  useEffect(() => {
    if (!loaded || !taskSheet?.key || !taskSheet.task) return
    // Лист ложится ТОЛЬКО на доску своей домашней работы. Открытая доска и
    // задание приходят разными путями (комната — из адреса страницы, задание —
    // из карточки работы), и при смене комнаты на живом компоненте они успевали
    // разъехаться: лист уезжал на доску занятия поверх записей с уроков.
    if (!isHomeworkRoom(roomId) || !String(roomId).endsWith(`${HW_ROOM}${taskSheet.hwId}`)) return
    if (sheetDone.current === taskSheet.key) return
    sheetDone.current = taskSheet.key
    placeTaskSheet(taskSheet)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, taskSheet, roomId])
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
    const TOOL_CODES = { KeyP: "pen", KeyT: "text", KeyE: "eraser", KeyL: "line", KeyA: "arrow", KeyR: "rect", KeyH: "hand", KeyV: "cursor" }
    // Запасной путь по символу: на части клавиатур e.code приходит пустым.
    // Русские буквы — те же физические клавиши.
    const TOOL_KEYS = { p: "pen", з: "pen", t: "text", е: "text", e: "eraser", у: "eraser",
      l: "line", д: "line", a: "arrow", ф: "arrow", r: "rect", к: "rect", h: "hand", р: "hand", v: "cursor", м: "cursor" }
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
        const isA = e.code === "KeyA" || k === "a" || k === "ф"
        if (isA && !inField) {
          // Иначе браузер выделит текст всей страницы — панель, подписи участников.
          e.preventDefault()
          e.stopPropagation()
          actions.current.selectAll()
          return
        }
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
      // По e.code И по e.key: на части клавиатур и в некоторых средах code
      // приходит пустым, и удаление тогда молча не работало.
      if (e.code === "Delete" || e.code === "Backspace" || e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault(); actions.current.del(); return
      }
      const t = TOOL_CODES[e.code] || (e.code ? null : TOOL_KEYS[(e.key || "").toLowerCase()])
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
    { id: "text", icon: "type", label: "Текст", key: "T" },
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
    { id: "arrow", icon: "arrow", label: "Стрелка", key: "A" },
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
              <button key={sh.id} onClick={() => pickShape(sh.id)} title={sh.key ? `${sh.label} (${sh.key})` : sh.label} aria-label={sh.label}
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
    : tool === "cursor" ? "default"
    : tool === "text" ? "text" : "crosshair"
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
    <div ref={rootRef} data-board-version="14" className={`fixed inset-0 z-[100000] flex flex-col screen-fade ${dark ? "board-dark" : ""} ${closingCls}`}
      style={vvBox
        ? { background: baseBg, left: vvBox.left, top: vvBox.top, width: vvBox.width, height: vvBox.height, right: "auto", bottom: "auto" }
        : { background: baseBg }}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-3 h-12 border-b flex-shrink-0"
        style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium min-w-0" style={{ color: dark ? "#e5e5ea" : "#374151" }}>
            <Icon name="clipboard" size={16} className="shrink-0" />
            <span className="shrink-0">Доска</span>
            {/* Чья это доска: у домашней работы она своя, и без подписи их не
                отличить одну от другой. */}
            {label && (
              <span className="hidden sm:block truncate max-w-[16rem] text-xs font-normal"
                style={{ color: dark ? "#8e8e93" : "#9ca3af" }}>· {label}</span>
            )}
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
          onDoubleClick={onDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
          style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor }}
        />

        {/* Поле ввода надписи — поверх холста, ровно на том месте и того кегля,
            каким текст ляжет на доску. Фон прозрачный: подписывают поверх чертежа,
            и белая (тем более серая) подложка накрыла бы его собой.

            Поле ВСЕГДА в разметке, даже когда не пишут: сфокусировать можно только
            то, что уже есть в документе, а фокус обязан встать в тот же миг, что и
            нажатие (см. openTextEditor). Прятать его через display/visibility нельзя
            — так элемент перестаёт быть фокусируемым, поэтому вне набора он просто
            прозрачный и не ловит нажатия. Значение полю ставит openTextEditor, а не
            React: перерисовка из-за смены цвета или кегля не должна стирать набранное. */}
        <div ref={editBoxRef} className="absolute"
          style={{
            left: editText ? editText.x * view.current.scale + view.current.x : 0,
            top: editText ? editText.y * view.current.scale + view.current.y : 0,
            transformOrigin: "50% 50%",
            opacity: editText ? 1 : 0,
            pointerEvents: editText ? "auto" : "none",
          }}>
          {/* Панель набора: цвет, размер, начертание. Стоит над самой надписью, а не
              внизу экрана: правят то, что видят, и глазами уходить некуда.
              onPointerDown с preventDefault — чтобы нажатие на кнопку не уводило
              фокус из поля: курсор должен остаться там, где его оставили. */}
          {editText && (
            <div ref={editBarRef}
              className="absolute left-0 flex items-center gap-1 px-1.5 py-1 rounded-2xl shadow-lg popup-bubble"
              style={{ background: panelBg, border: `1px solid ${panelBorder}`, whiteSpace: "nowrap" }}>
              {/* Цвет — кружком текущего: шесть кружков рядом с полем ввода заняли бы
                  пол-экрана телефона и накрыли бы саму надпись. */}
              <div className="relative" data-menu>
                <button onPointerDown={(e) => e.preventDefault()} onClick={() => toggleMenu("txtColor")}
                  aria-label="Цвет надписи" title="Цвет надписи"
                  className={`press-tap w-8 h-8 rounded-lg flex items-center justify-center ${menuShown("txtColor") ? "bg-blue-500/15" : "board-hover"}`}>
                  <span className="rounded-full" style={{ width: 18, height: 18, background: resolveColor(color, dark),
                    boxShadow: `0 0 0 1.5px ${dark ? "rgba(255,255,255,.4)" : "rgba(0,0,0,.22)"}` }} />
                </button>
                {menuShown("txtColor") && (
                  // width по содержимому обязателен: попап абсолютный, а опорная
                  // кнопка — 32 px, и без него колонки схлопывались в одну.
                  <div className={`absolute bottom-full mb-2 left-0 grid grid-cols-4 gap-0.5 p-2 rounded-xl shadow-lg z-10 ${menuAnim("txtColor")}`}
                    style={{ background: panelBg, border: `1px solid ${panelBorder}`, width: "max-content" }}>
                    {BASE_INKS.map((c) => (
                      <Swatch key={c} hex={resolveColor(c, dark)} active={color === c} dark={dark}
                        title={c === "ink" ? "Чернила" : "Цвет"} onClick={() => setColor(c)} />
                    ))}
                    <ColorPick value={resolveColor(color, dark)} dark={dark} title="Свой цвет" onPreview={setColor} />
                  </div>
                )}
              </div>

              {divider}

              {/* Ж и К — привычные буквы русских редакторов, значок тут ничего не добавит */}
              <button onPointerDown={(e) => e.preventDefault()} onClick={() => setTextBold((v) => !v)}
                aria-pressed={textBold} aria-label="Полужирный" title="Полужирный"
                className={`press-tap w-8 h-8 rounded-lg flex items-center justify-center text-[15px] font-bold ${textBold ? "bg-blue-500 text-white" : "board-hover"}`}
                style={textBold ? undefined : idleStyle}>Ж</button>
              <button onPointerDown={(e) => e.preventDefault()} onClick={() => setTextItalic((v) => !v)}
                aria-pressed={textItalic} aria-label="Курсив" title="Курсив"
                className={`press-tap w-8 h-8 rounded-lg flex items-center justify-center text-[15px] italic ${textItalic ? "bg-blue-500 text-white" : "board-hover"}`}
                style={textItalic ? undefined : idleStyle}>К</button>

              {divider}

              {/* Размер: буква и текущее число — понятнее значка, и видно, что стоит сейчас */}
              <div className="relative" data-menu>
                <button onPointerDown={(e) => e.preventDefault()} onClick={() => toggleMenu("txtSize")}
                  aria-label="Размер надписи" title="Размер надписи"
                  className={`press-tap h-8 px-2 rounded-lg flex items-center gap-1 ${menuShown("txtSize") ? "bg-blue-500/15 text-blue-500" : "board-hover"}`}
                  style={menuShown("txtSize") ? undefined : idleStyle}>
                  <span className="text-[15px] font-semibold leading-none" style={{ fontFamily: TEXT_FONT }}>А</span>
                  <span className="text-[11px] tabular-nums leading-none">{textSize}</span>
                </button>
                {menuShown("txtSize") && (
                  <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 p-2 rounded-xl shadow-lg z-10 ${menuAnim("txtSize")}`}
                    style={{ background: panelBg, border: `1px solid ${panelBorder}`, width: "max-content" }}>
                    <StrokeSettings dark={dark} tool="text" curWidth={textSize} curDash="solid"
                      onWidth={(w, commit) => { setTextSize(w); if (commit) editRef.current?.focus({ preventScroll: true }) }}
                      onDash={() => {}} />
                  </div>
                )}
              </div>
            </div>
          )}
          <textarea
            ref={editRef}
            rows={1}
            wrap="off"
            spellCheck={false}
            tabIndex={editText ? 0 : -1}
            aria-hidden={!editText}
            aria-label="Надпись на доске"
            onInput={() => { layoutTextEditor(); scheduleLive(); scheduleTextDraft() }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // Esc и ⌘↵ заканчивают набор. Остальное — обычный ввод: Enter даёт
              // новую строку, ⌘Z правит текст, а не откатывает доску.
              if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
                e.preventDefault(); e.stopPropagation(); commitTextEdit()
              }
            }}
            style={{
              display: "block", margin: 0, padding: 0, border: 0, background: "transparent",
              outline: editText ? "1px dashed rgba(0,122,255,.55)" : "none", outlineOffset: 4,
              resize: "none", overflow: "hidden", whiteSpace: "pre", minWidth: 2,
              font: `${(editText?.size || TEXT_DEFAULT) * view.current.scale}px ${TEXT_FONT}`,
              lineHeight: `${(editText?.size || TEXT_DEFAULT) * view.current.scale * TEXT_LINE}px`,
              color: resolveColor(editText?.color || "ink", dark),
              caretColor: resolveColor(editText?.color || "ink", dark),
            }}
          />
        </div>

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

        {/* Картинка уже на доске, но ещё едет в хранилище. Плашка нужна, потому
            что до конца загрузки собеседник её не видит и она не сохранена. */}
        {busyImgs.map((b) => (
          // Сдвиг «на половину себя» — на ОБЁРТКЕ: у появления попапа свои кадры
          // с transform, и на одном элементе они затирали бы центровку.
          <div key={b.id} className="absolute pointer-events-none"
            style={{ left: b.x, top: b.y, transform: "translate(-50%, -50%)" }}>
            <div className="popup-bubble flex items-center gap-2 px-2.5 h-8 rounded-full text-xs font-medium shadow-lg"
              style={{ background: panelBg, border: `1px solid ${panelBorder}`, color: dark ? "#e5e5ea" : "#374151" }}>
              Отправляется
              <span className="loader-dots text-blue-500"><i /><i /><i /></span>
            </div>
          </div>
        ))}

        {/* Поля ответа под листами с заданием */}
        {qaBoxes.map((b) => (
          <TaskAnswerBox key={b.id} panel={b} dark={dark} panelBg={panelBg} panelBorder={panelBorder}
            tutor={isTutor} onCheck={checkTaskAnswer} onReset={resetTaskAnswer} />
        ))}

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
              {/* Начертание — только у надписи. Ж и К стоят рядом с цветом и размером,
                  чтобы выделенная надпись правилась ровно тем же набором кнопок, что
                  и во время набора: разные панели для одного и того же сбивают с толку. */}
              {selProps?.tool === "text" && (
                <>
                  <button onClick={() => setSelectionFace("bold", !selProps.bold)}
                    aria-pressed={selProps.bold} aria-label="Полужирный" title="Полужирный"
                    className={`press-tap w-8 h-8 rounded-lg flex items-center justify-center text-[15px] font-bold ${selProps.bold ? "bg-blue-500 text-white" : "board-hover"}`}
                    style={selProps.bold ? undefined : idleStyle}>Ж</button>
                  <button onClick={() => setSelectionFace("italic", !selProps.italic)}
                    aria-pressed={selProps.italic} aria-label="Курсив" title="Курсив"
                    className={`press-tap w-8 h-8 rounded-lg flex items-center justify-center text-[15px] italic ${selProps.italic ? "bg-blue-500 text-white" : "board-hover"}`}
                    style={selProps.italic ? undefined : idleStyle}>К</button>
                  {divider}
                </>
              )}
              {/* Настройки обводки для выделения (у надписи — размер) */}
              {selProps && (
              <div className="relative" data-menu>
                <button onClick={() => toggleMenu("selStroke")}
                  title={selProps.tool === "text" ? "Размер надписи" : "Настройки обводки"}
                  aria-label={selProps.tool === "text" ? "Размер надписи" : "Настройки обводки"}
                  className={`press-tap h-8 rounded-lg flex items-center justify-center board-hover ${selProps.tool === "text" ? "px-2 gap-1" : "w-8"}`}
                  style={idleStyle}>
                  {selProps.tool === "text" ? (
                    <>
                      <span className="text-[15px] font-semibold leading-none" style={{ fontFamily: TEXT_FONT }}>А</span>
                      <span className="text-[11px] tabular-nums leading-none">{Math.round(selProps.width || TEXT_DEFAULT)}</span>
                    </>
                  ) : <Icon name="stroke" size={16} />}
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
        {(!loaded || sheetBusy) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="loader-logo" /></div>
        )}
        {saveDenied && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-xs shadow-lg"
            style={{ background: panelBg, border: "1px solid rgba(239,68,68,.45)", color: dark ? "#f5f5f7" : "#1c1c1e" }}>
            Эта доска не сохраняется — написанное пропадёт при перезагрузке
          </div>
        )}
        {sheetErr && (
          <button onClick={() => setSheetErr(false)}
            className={`press-tap absolute ${saveDenied ? "top-16" : "top-4"} left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-xs shadow-lg`}
            style={{ background: panelBg, border: `1px solid ${panelBorder}`, color: dark ? "#f5f5f7" : "#1c1c1e" }}>
            Задание не перенеслось на доску — условие осталось в кабинете
          </button>
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
                  {!menuShown("stroke") && <Tip label="Настройки обводки" dark={dark} show={tapped === "stroke"} />}
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
            и очистка — за «⋯». Отмена и возврат — приглушённым лотком СБОКУ от
            строки: на телефоне нет ⌘Z, ими пользуются постоянно, а отдельная
            полка над панелью съедала высоту — в горизонтальной ориентации её и
            так почти нет. Ширины не хватило — лоток уезжает строкой выше
            (flex-wrap-reverse), то есть ровно туда, где он стоял раньше. */}
        {!isBig && (
          <div className="flex flex-wrap-reverse items-end justify-center gap-1.5 max-w-full">
            <div className="flex flex-wrap items-center justify-center gap-0.5 rounded-2xl px-1.5 py-1 shadow-xl relative pointer-events-auto max-w-full"
              style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
              {/* «Двигать полотно» на телефоне не показываем: полотно там двигают
                  двумя пальцами, а лишняя кнопка не давала строке уместиться. */}
              {TOOLS.filter((t) => t.id !== "hand").map((t) => t.erasers ? (
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

              {tool !== "text" && divider}

              {/* Текущий цвет: кружок открывает свотчи и настройки обводки.
                  У «Текста» их показывает панель над надписью. */}
              {tool !== "text" && (
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
              )}

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
          </div>
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
