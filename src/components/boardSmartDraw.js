// SmartDraw: набросок пером превращается в ровную фигуру.
// Работает только с пером и только когда штрих уверенно похож на фигуру — иначе
// возвращает null и рисунок остаётся рукописным. Порог намеренно строгий: ложное
// срабатывание посреди объяснения хуже, чем несработавшее «умное» распознавание.
//
// Возвращает { tool, a, b } в МИРОВЫХ координатах — то же, что даёт обычная фигура,
// поэтому дальше штрих живёт как нарисованный инструментом «Фигуры».

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
  // Все точки лежат на (x/rx)² + (y/ry)² = 1
  let ellErr = 1
  if (rx > 3 && ry > 3) {
    let sum = 0
    for (const p of pts) sum += Math.abs(Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry) - 1)
    ellErr = sum / pts.length
    if (ellErr < 0.1) return round()
  }

  // Углы замкнутой ломаной. Контур замыкаем явно, иначе стык первой и последней
  // точки RDP считает концом пути и всегда оставляет там «угол».
  const ring = thin([...pts, first], step)
  const corners = rdp(ring, diag * 0.06)
  const n = corners.length - 1               // последняя точка = первая

  if (n === 3) return { tool: "triangle", a: box.a, b: box.b }
  if (n === 4) {
    // Ромб или прямоугольник: у ромба вершины сидят на серединах сторон габарита,
    // у прямоугольника — в его углах.
    const mids = [[cx, minY], [maxX, cy], [cx, maxY], [minX, cy]]
    const corns = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]
    const near = (list) => corners.slice(0, 4)
      .reduce((acc, p) => acc + Math.min(...list.map((q) => dist(p, q))), 0)
    return { tool: near(mids) < near(corns) ? "diamond" : "rect", a: box.a, b: box.b }
  }
  // Много мелких углов и приличная посадка на овал — всё-таки круглая фигура
  if (n >= 6 && ellErr < 0.18) return round()
  return null
}
