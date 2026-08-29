// SmartDraw: набросок пером превращается в ровную фигуру.
// Работает только с пером и только когда штрих уверенно похож на фигуру — иначе
// возвращает null и рисунок остаётся рукописным. Порог намеренно строгий: ложное
// срабатывание посреди объяснения хуже, чем несработавшее «умное» распознавание.
//
// Выпрямляем прямую, круг, квадрат, прямоугольник и треугольник. Всё остальное —
// ромб, трапеция, пятиугольник, произвольный контур — остаётся рукописным.
//
// Возвращает либо готовую фигуру { tool, a, b } (габарит, как у инструмента
// «Фигуры»), либо треугольник по НАСТОЯЩИМ вершинам { tool: "poly", points }.
// Второе обязательно: готовый треугольник — равнобедренный с вершиной вверх, и
// прямоугольный он превратил бы в равнобедренный, то есть в другой чертёж.
// Стороны при этом всё равно становятся ровными отрезками.

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1])

// Расстояние от точки до отрезка (копия из Board — модуль должен быть самостоятельным)
function distToSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

// Упрощение ломаной (Рамер — Дуглас — Пекер): оставляет только «углы»
function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice()
  let far = 0, idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSeg(pts[i], pts[0], pts[pts.length - 1])
    if (d > far) { far = d; idx = i }
  }
  if (far <= eps) return [pts[0], pts[pts.length - 1]]
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)]
}

// Прореживание: точек в штрихе сотни, для геометрии хватает шага в 2 % диагонали
function thin(pts, step) {
  const out = [pts[0]]
  for (const p of pts) if (dist(p, out[out.length - 1]) >= step) out.push(p)
  const last = pts[pts.length - 1]
  if (dist(out[out.length - 1], last) > 1e-6) out.push(last)
  return out
}

// Убирает «углы», которых нет: вершины, где ломаная идёт почти прямо. Такие даёт
// и сам RDP на дрожащей стороне, и место, где человек начал вести штрих.
const STRAIGHT = (155 * Math.PI) / 180
function dropStraight(poly) {
  const out = poly.slice()
  let again = true
  while (again && out.length > 3) {
    again = false
    for (let i = 0; i < out.length; i++) {
      const p = out[(i - 1 + out.length) % out.length], v = out[i], q = out[(i + 1) % out.length]
      let d = Math.abs(Math.atan2(p[1] - v[1], p[0] - v[0]) - Math.atan2(q[1] - v[1], q[0] - v[0]))
      if (d > Math.PI) d = 2 * Math.PI - d
      if (d > STRAIGHT) { out.splice(i, 1); again = true; break }
    }
  }
  return out
}

// Замкнутая ломаная: первую точку повторяем в конце — так её рисует paintStroke
// и так же по ней считается попадание курсором (последняя сторона не теряется).
const closeRing = (poly) => [...poly.map((p) => [p[0], p[1]]), [poly[0][0], poly[0][1]]]

// Средний промах штриха мимо предполагаемого многоугольника
function polyError(pts, poly) {
  let sum = 0
  for (const p of pts) {
    let best = Infinity
    for (let i = 0; i < poly.length; i++) {
      const d = distToSeg(p, poly[i], poly[(i + 1) % poly.length])
      if (d < best) best = d
    }
    sum += best
  }
  return sum / pts.length
}

export function recognizeShape(rawPoints, { minSize = 30 } = {}) {
  if (!rawPoints || rawPoints.length < 8) return null
  const pts = rawPoints.map((p) => [p[0], p[1]])

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]
    if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]
  }
  const w = maxX - minX, h = maxY - minY
  const diag = Math.hypot(w, h)
  if (diag < minSize) return null

  // Длину и прямизну меряем по ПРОРЕЖЕННОЙ ломаной: дрожание руки добавляет сотни
  // микрозвеньев, и по сырым точкам длина ровного отрезка выходит вдвое больше его
  // же хорды — проверка «это не петля» тогда отвергала бы любую линию.
  const step = Math.max(1, diag * 0.02)
  const path = thin(pts, step)
  let len = 0
  for (let i = 1; i < path.length; i++) len += dist(path[i - 1], path[i])
  if (len < diag * 0.8) return null            // «клякса»: слишком короткий путь

  const first = pts[0], last = pts[pts.length - 1]
  const closed = dist(first, last) < diag * 0.3

  // --- Незамкнутый штрих: только прямая линия -----------------------------
  if (!closed) {
    if (len > diag * 1.25) return null          // петля/зигзаг, а не отрезок
    let dev = 0
    for (const p of path) dev = Math.max(dev, distToSeg(p, first, last))
    if (dev <= Math.max(2, len * 0.05)) return { tool: "line", a: first, b: last }
    return null
  }

  // --- Замкнутый штрих ----------------------------------------------------
  const box = { a: [minX, minY], b: [maxX, maxY] }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const rx = w / 2, ry = h / 2

  // Круг всегда РОВНЫЙ: распознаём по эллипсу (от руки окружность выходит слегка
  // сплюснутой, по строгой окружности её пришлось бы не узнавать), но на доску
  // кладём круг — габарит подменяем квадратом со стороной по среднему из ширины
  // и высоты. Эллипса SmartDraw не рисует намеренно.
  const round = () => {
    const d = (w + h) / 2
    return { tool: "circle", a: [cx - d / 2, cy - d / 2], b: [cx + d / 2, cy + d / 2] }
  }
  // Насколько точки легли на (x/rx)² + (y/ry)² = 1. Решение о круге принимается НЕ
  // здесь: правильный многоугольник тоже неплохо садится на овал, и ранний ответ
  // превращал начерченный пятиугольник в круг. Сначала считаем обе версии, потом
  // сравниваем промахи.
  let ellErr = 1
  if (rx > 3 && ry > 3) {
    let sum = 0
    for (const p of pts) sum += Math.abs(Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry) - 1)
    ellErr = sum / pts.length
  }

  // Углы. Контур ПЕРЕКЛАДЫВАЕМ так, чтобы он начинался с настоящего угла — самой
  // удалённой от центра точки. Иначе место, где человек начал вести штрих, само
  // считается углом: треугольник, начатый с середины стороны, выходил
  // четырёхугольником и распознавался прямоугольником.
  const ring0 = thin(pts, step)
  let far = 0, farD = -1
  for (let i = 0; i < ring0.length; i++) {
    const d = Math.hypot(ring0[i][0] - cx, ring0[i][1] - cy)
    if (d > farD) { farD = d; far = i }
  }
  const ring = [...ring0.slice(far), ...ring0.slice(0, far)]
  ring.push(ring[0])
  const poly = dropStraight(rdp(ring, diag * 0.06).slice(0, -1))   // без повтора первой точки
  const n = poly.length

  // Ломаная должна реально лежать на штрихе, а не «примерно рядом»: без этой
  // проверки размашистая петля становилась фигурой. Больше шести углов — это
  // почти всегда неровно обведённый круг: на дрожащем контуре RDP насаживает
  // углы где попало.
  const pErr = n >= 3 ? polyError(pts, poly) : Infinity
  const polyOk = n >= 3 && n <= 6 && pErr <= diag * 0.045
  const roundOk = rx > 3 && ry > 3 && ellErr < 0.16
  // Круг и ломаная спорят по промаху: у круга ломаная срезает дуги и мажет
  // заметно сильнее овала, у угловатой фигуры — наоборот.
  const ellDist = ellErr * (rx + ry) / 2
  if (!polyOk || (roundOk && pErr >= ellDist * 0.8)) return roundOk ? round() : null

  if (n === 3) {
    // Равнобедренный с вершиной вверх строится готовой фигурой — она ровнее.
    // Любой другой треугольник выпрямляем по его собственным вершинам: стороны
    // становятся ровными отрезками, а чертёж остаётся тем же, что начертили.
    const top = poly.reduce((a, b) => (a[1] <= b[1] ? a : b))
    const base = poly.filter((p) => p !== top)
    const flatBase = Math.abs(base[0][1] - base[1][1]) < h * 0.08
    const apexMid = Math.abs(top[0] - (base[0][0] + base[1][0]) / 2) < w * 0.08
    const baseDown = Math.min(base[0][1], base[1][1]) > top[1] + h * 0.8
    if (flatBase && apexMid && baseDown) return { tool: "triangle", a: box.a, b: box.b }
    return { tool: "poly", points: closeRing(poly) }
  }

  // Пятиугольник и прочее многоугольное SmartDraw не выпрямляет: штрих остаётся
  // рукописным.
  if (n !== 4) return null

  // Четырёхугольник выпрямляем, только если он лёг на габаритную рамку. Ромб,
  // трапеция, параллелограмм — мимо: их подмена прямоугольником сменила бы чертёж.
  const near = (list) => poly.reduce((acc, p) => acc + Math.min(...list.map((q) => dist(p, q))), 0) / 4
  if (near([[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]) > diag * 0.06) return null
  // Квадрат кладём ровным по той же причине, что и круг: от руки стороны
  // расходятся на проценты, и «почти квадрат» читается как кривой прямоугольник.
  // Разница больше 12 % — это уже осознанный прямоугольник, его не трогаем.
  if (Math.abs(w - h) <= Math.max(w, h) * 0.12) {
    const d = (w + h) / 2
    return { tool: "rect", a: [cx - d / 2, cy - d / 2], b: [cx + d / 2, cy + d / 2] }
  }
  return { tool: "rect", a: box.a, b: box.b }
}
