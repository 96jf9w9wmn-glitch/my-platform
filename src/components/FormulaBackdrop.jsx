import { renderTaskMath } from "../utils"

// Декоративный фон из формул «мелом». Приём подсмотрен у drfrost.org: вокруг
// текста, в полях страницы, лежат полупрозрачные рукописные формулы и чертежи —
// одним цветом-«чернилами», под небольшим наклоном, кластерами (выкладка решения
// стопкой), а не равномерным конфетти.
//
// Формулы у нас НЕ выдуманные: это те же выражения, что порождают генераторы
// банка, и рендерятся они тем же пайплайном renderTaskMath — дроби столбиком,
// корень с чертой над подкоренным. Поэтому фон выглядит как наш собственный
// контент, а не как картинка «на тему математики».
//
// Слой абсолютный и aria-hidden: клики проходят насквозь, скринридер его не
// читает, overflow скрыт — горизонтального скролла на мобиле не появляется.

// Чертёж прямоугольного треугольника с подписями сторон — как на листе тетради.
function SketchTriangle({ size = 96 }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 100 78" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 68 L10 12 L86 68 Z" />
      <path d="M10 60 L18 60 L18 68" strokeWidth="1.2" />
      <text x="1" y="40" fill="currentColor" stroke="none" fontSize="11">a</text>
      <text x="46" y="76" fill="currentColor" stroke="none" fontSize="11">b</text>
      <text x="50" y="34" fill="currentColor" stroke="none" fontSize="11">c</text>
    </svg>
  )
}

// Парабола с осями — узнаваемый силуэт графика из №11/№23.
function SketchParabola({ size = 104 }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 100 72" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M8 8 L8 64 L94 64" strokeWidth="1.2" />
      <path d="M16 12 Q50 96 90 12" />
    </svg>
  )
}

// Окружность с радиусом и центром — геометрия №16/№17.
function SketchCircle({ size = 84 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="40" cy="40" r="30" />
      <path d="M40 40 L66 55" />
      <circle cx="40" cy="40" r="1.8" fill="currentColor" />
      <text x="46" y="42" fill="currentColor" stroke="none" fontSize="11">R</text>
    </svg>
  )
}

const SKETCHES = { triangle: SketchTriangle, parabola: SketchParabola, circle: SketchCircle }

// x/y — проценты от контейнера (позиция центра элемента), rot — наклон,
// size — кегль формулы (px), o — прозрачность слоя, wide — только для широких
// экранов (на мобиле такой элемент прячется, чтобы не спорить с текстом).
// Хиро: формулы живут ТОЛЬКО в боковых полях страницы (как на drfrost.org) —
// в колонках слева и справа от контентного max-w-6xl. Координаты x внутри своей
// колонки, поэтому под заголовок формулы не заезжают ни при какой ширине окна:
// когда полей нет (ноутбук уже 1200px, планшет, телефон) — колонки просто
// схлопываются, и фон не показывается вовсе. Лучше без фона, чем поверх текста.
// d — отступ от внутреннего края поля (px): им формулы «расходятся лесенкой»,
// как строки решения на полях тетради.
const HERO_LEFT = [
  { d: 10, y: 10, rot: -8, size: 19, o: 0.95, t: "x² − 5x + 6 = 0" },
  { d: 26, y: 22, rot: 5, size: 16, o: 0.7, t: "D = b² − 4ac" },
  { d: 4, y: 36, rot: -4, size: 21, o: 1, t: "⟦f:3:4⟧ + ⟦f:5:6⟧" },
  { d: 20, y: 50, rot: 7, size: 17, o: 0.75, t: "⟦r:50⟧ = 5⟦r:2⟧" },
  { d: 8, y: 66, rot: -6, size: 18, o: 0.85, sketch: "triangle" },
  { d: 24, y: 82, rot: 3, size: 16, o: 0.6, t: "a² + b² = c²" },
  { d: 6, y: 93, rot: -7, size: 15, o: 0.5, t: "y = kx + b" },
]
const HERO_RIGHT = [
  { d: 8, y: 9, rot: 6, size: 19, o: 0.9, t: "S = ⟦f:1:2⟧ah" },
  { d: 24, y: 21, rot: -5, size: 16, o: 0.65, t: "sin²α + cos²α = 1" },
  { d: 4, y: 35, rot: 4, size: 21, o: 1, t: "log⦉2⦊8 = 3" },
  { d: 18, y: 50, rot: -9, size: 17, o: 0.8, sketch: "parabola" },
  { d: 6, y: 65, rot: 8, size: 17, o: 0.7, t: "2⁅x⁆ = 16" },
  { d: 22, y: 80, rot: -3, size: 18, o: 0.85, sketch: "circle" },
  { d: 8, y: 93, rot: 5, size: 16, o: 0.55, t: "P(A) = ⟦f:4:9⟧" },
]

// Пустое состояние / панель — тише и мельче: пара формул по углам свободного
// блока. Здесь центр занят одной короткой строкой, поля есть на любой ширине.
const PANEL = [
  { x: 12, y: 30, rot: -7, size: 17, o: 0.9, t: "⟦f:1:2⟧ah" },
  { x: 88, y: 26, rot: 6, size: 16, o: 0.75, t: "⟦r:169⟧ = 13", wide: true },
  { x: 17, y: 76, rot: 5, size: 15, o: 0.6, t: "x² − 9 = 0", wide: true },
  { x: 85, y: 68, rot: -5, size: 13, o: 0.85, sketch: "triangle" },
]

// side: "l" — поле слева (формула прижата вправо, уходит за левый край экрана),
// "r" — поле справа, без side — свободное размещение по центру точки (панели).
function Item({ it, i, side }) {
  const Sketch = it.sketch ? SKETCHES[it.sketch] : null
  const pos = side === "l" ? { right: it.d } : side === "r" ? { left: it.d } : { left: `${it.x}%` }
  const props = {
    className: `fb-item${side ? " fb-item-edge" : ""}${it.wide ? " fb-wide" : ""}`,
    style: {
      ...pos,
      top: `${it.y}%`,
      fontSize: it.size,
      opacity: it.o,
      "--fb-rot": `${it.rot}deg`,
      animationDelay: `${(i % 5) * 1.4}s`,
    },
  }
  return Sketch
    ? <span {...props}><Sketch size={it.size * 5} /></span>
    : <span {...props} dangerouslySetInnerHTML={{ __html: renderTaskMath(it.t) }} />
}

function FormulaBackdrop({ variant = "hero", className = "" }) {
  if (variant === "panel") {
    return (
      <div className={`formula-backdrop ${className}`} aria-hidden="true">
        {PANEL.map((it, i) => <Item key={i} it={it} i={i} />)}
      </div>
    )
  }
  return (
    <div className={`formula-backdrop ${className}`} aria-hidden="true">
      <div className="fb-gutter fb-gutter-l">
        {HERO_LEFT.map((it, i) => <Item key={i} it={it} i={i} side="l" />)}
      </div>
      <div className="fb-gutter fb-gutter-r">
        {HERO_RIGHT.map((it, i) => <Item key={i} it={it} i={i + 2} side="r" />)}
      </div>
    </div>
  )
}

export default FormulaBackdrop
