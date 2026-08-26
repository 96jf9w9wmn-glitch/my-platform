// Рисование сцены доски — чистые функции без React и без состояния компонента.
// Вынесены из Board.jsx, чтобы ту же сцену можно было отрисовать вне доски:
// превью снимка занятия и просмотр истории в режиме чтения (см. BoardSnapshotView).
// Сцена — то же, что лежит в boards.scene / board_snapshots.scene:
//   { strokes: [ {id, author, tool, color, width, points:[[x,y,w],…], angle?, src?} ], bg, bgColor }

export const GRID = 40 // шаг сетки/точек в мировых единицах
export const INK_DARK = "#f5f5f7", INK_LIGHT = "#1c1c1e"

// Замкнутые фигуры — клик по площади (внутри габарита) считается попаданием;
// открытые (перо/линия/стрелка) — только рядом с самой линией.
export const ENCLOSED_SHAPES = new Set(["rect", "circle", "triangle", "diamond", "cube", "cylinder", "cone", "sphere", "pyramid", "image"])
// Инструменты-фигуры (рисуются по двум точкам: старт → конец перетаскивания)
export const SHAPE_TOOLS = new Set(["line", "rect", "circle", "triangle", "diamond", "arrow", "cube", "cylinder", "cone", "sphere", "pyramid"])
// Фигуры/линии, к которым применим стиль линии (сплошная/пунктир/точки)
export const DASHABLE_SHAPES = new Set(["line", "arrow", "rect", "circle", "triangle", "diamond"])

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export function isDarkColor(hex) {
  const h = (hex || "").replace("#", "")
  if (h.length < 6) return false
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) < 130
}

// Реальный цвет штриха: "ink" (и старые чёрный/белый) → контраст к фону, остальное как есть
export function resolveColor(c, darkBg) {
  if (c === "ink" || c === INK_LIGHT || c === INK_DARK) return darkBg ? INK_DARK : INK_LIGHT
  return c
}

// Габаритный прямоугольник штриха (в мировых координатах) с учётом толщины
export function strokeBBox(s) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const acc = (x, y) => { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
  const pts = s.points
  if (s.angle && ENCLOSED_SHAPES.has(s.tool) && pts.length >= 2) {
    // Повёрнутая фигура: габарит по 4 повёрнутым углам бокса
    const a = pts[0], b = pts[pts.length - 1]
    const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1])
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cos = Math.cos(s.angle), sin = Math.sin(s.angle)
    for (const [px, py] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
      const dx = px - cx, dy = py - cy
      acc(cx + dx * cos - dy * sin, cy + dx * sin + dy * cos)
    }
  } else {
    for (const p of pts) acc(p[0], p[1])
  }
  const pad = (s.width || 3) / 2 + 2
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }
}

// Рисует фигуру заданного типа в габарите между точками a и b (мировые координаты).
// corner ("round" | иное) читается только у СТАРЫХ штрихов: выбор скругления убран из
// панели 26.08.2026, новые фигуры всегда с острыми углами — но снимки досок, снятые до
// этого, должны открываться такими же, какими их закрыли.
export function drawShape(ctx, tool, a, b, corner) {
  const x0 = a[0], y0 = a[1], x1 = b[0], y1 = b[1]
  const x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0)
  const cx = x + w / 2, cy = y + h / 2
  const P = Math.PI * 2
  const round = corner === "round"
  // Пунктир: плоские торцы (иначе круглые «затягивают» промежутки в сплошную),
  // штрих/промежуток масштабируются под толщину линии, чтобы всегда читались.
  const beginDash = () => {
    const lw = ctx.lineWidth
    ctx.setLineDash([Math.max(8, lw * 1.4), Math.max(9, lw * 2.2)])
    ctx.lineCap = "butt"
  }
  ctx.beginPath()
  switch (tool) {
    case "line": ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); break
    case "rect": {
      const r = round ? Math.min(w, h) * 0.16 : 0
      if (r > 0 && ctx.roundRect) { ctx.roundRect(x, y, w, h, r); ctx.stroke() }
      else ctx.strokeRect(x, y, w, h)
      break
    }
    case "circle": ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, P); ctx.stroke(); break
    case "triangle": ctx.moveTo(cx, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.stroke(); break
    case "diamond": ctx.moveTo(cx, y); ctx.lineTo(x + w, cy); ctx.lineTo(cx, y + h); ctx.lineTo(x, cy); ctx.closePath(); ctx.stroke(); break
    case "arrow": {
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
      const ang = Math.atan2(y1 - y0, x1 - x0), hl = Math.min(22, Math.hypot(x1 - x0, y1 - y0) * 0.3)
      ctx.beginPath()
      ctx.moveTo(x1, y1); ctx.lineTo(x1 - hl * Math.cos(ang - 0.42), y1 - hl * Math.sin(ang - 0.42))
      ctx.moveTo(x1, y1); ctx.lineTo(x1 - hl * Math.cos(ang + 0.42), y1 - hl * Math.sin(ang + 0.42))
      ctx.stroke(); break
    }
    case "cube": {
      const d = Math.min(w, h) * 0.35, fw = w - d, fh = h - d
      const FL = [x, y + d], FR = [x + fw, y + d], FBR = [x + fw, y + d + fh], FBL = [x, y + d + fh]
      const BL = [x + d, y], BR = [x + d + fw, y], BBR = [x + d + fw, y + fh], BBL = [x + d, y + fh]
      const seg = (p, q) => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke() }
      seg(FL, FR); seg(FR, FBR); seg(FBR, FBL); seg(FBL, FL)   // передняя грань
      seg(BL, BR); seg(BR, BBR)                                // видимые задние рёбра
      seg(FL, BL); seg(FR, BR); seg(FBR, BBR)                  // видимые соединители
      ctx.save(); beginDash()                     // скрытые рёбра при задней-нижней-левой вершине
      seg(BBL, BL); seg(BBL, BBR); seg(BBL, FBL)
      ctx.restore(); break
    }
    case "cylinder": {
      const ry = Math.max(3, h * 0.1), rx = w / 2, yt = y + ry, yb = y + h - ry
      ctx.ellipse(cx, yt, rx, ry, 0, 0, P); ctx.stroke()                                 // верх — виден весь
      ctx.beginPath(); ctx.moveTo(x, yt); ctx.lineTo(x, yb); ctx.moveTo(x + w, yt); ctx.lineTo(x + w, yb); ctx.stroke()
      ctx.beginPath(); ctx.ellipse(cx, yb, rx, ry, 0, 0, Math.PI); ctx.stroke()          // низ, перед — сплошной
      ctx.save(); beginDash(); ctx.beginPath(); ctx.ellipse(cx, yb, rx, ry, 0, Math.PI, P); ctx.stroke(); ctx.restore()
      break
    }
    case "cone": {
      const ry = Math.max(3, h * 0.1), rx = w / 2, yb = y + h - ry
      ctx.ellipse(cx, yb, rx, ry, 0, 0, Math.PI); ctx.stroke()                           // основание перед — сплошное
      ctx.save(); beginDash(); ctx.beginPath(); ctx.ellipse(cx, yb, rx, ry, 0, Math.PI, P); ctx.stroke(); ctx.restore()
      ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(x, yb); ctx.moveTo(cx, y); ctx.lineTo(x + w, yb); ctx.stroke()
      break
    }
    case "sphere": {
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, P); ctx.stroke()                           // контур
      const eq = Math.max(3, h * 0.16)
      ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, eq, 0, 0, Math.PI); ctx.stroke()       // экватор перед — сплошной
      ctx.save(); beginDash(); ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, eq, 0, Math.PI, P); ctx.stroke(); ctx.restore()
      break
    }
    case "pyramid": {
      const d = Math.min(w, h) * 0.3
      const A = [x, y + h], B = [x + w - d, y + h], C = [x + w, y + h - d], D = [x + d, y + h - d], E = [cx, y]
      const seg = (p, q) => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke() }
      seg(A, B); seg(B, C)                          // видимые рёбра основания
      seg(E, A); seg(E, B); seg(E, C); seg(E, D)    // ВСЕ боковые рёбра — сплошные (видны)
      ctx.save(); beginDash()                       // пунктиром — только задние рёбра основания
      seg(C, D); seg(D, A)
      ctx.restore(); break
    }
    default: break
  }
}

// Один штрих в мировых координатах. darkBg — светлость ФОНА доски (не темы приложения),
// getImage(src) отдаёт уже загруженную картинку или null (тогда рисуется заглушка).
export function paintStroke(ctx, s, { darkBg = false, getImage = () => null } = {}) {
  const pts = s.points
  if (!pts || pts.length === 0) return
  ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over"
  const col = resolveColor(s.color, darkBg)
  ctx.strokeStyle = col
  ctx.fillStyle = col
  ctx.lineWidth = s.width
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.setLineDash([])

  if (s.tool === "image") {
    const a = pts[0], b = pts[pts.length - 1]
    const ix = Math.min(a[0], b[0]), iy = Math.min(a[1], b[1]), iw = Math.abs(b[0] - a[0]), ih = Math.abs(b[1] - a[1])
    // s.sheet — лист с заданием из банка: на тёмной доске рисуем его перекрашенным
    const img = getImage(s.src, !!s.sheet && darkBg)
    // готовность: у <img> её показывает complete, у перекрашенного холста — размер
    const ready = img && (img.naturalWidth ? img.complete : img.width > 0)
    const drawIt = () => {
      if (ready) ctx.drawImage(img, ix, iy, iw, ih)
      else { ctx.save(); ctx.fillStyle = darkBg ? "#3a3a3c" : "#e5e5ea"; ctx.fillRect(ix, iy, iw, ih); ctx.restore() }
    }
    if (s.angle) {
      const ccx = ix + iw / 2, ccy = iy + ih / 2
      ctx.save(); ctx.translate(ccx, ccy); ctx.rotate(s.angle); ctx.translate(-ccx, -ccy); drawIt(); ctx.restore()
    } else drawIt()
    return
  }

  if (SHAPE_TOOLS.has(s.tool)) {
    // Углы: скруглённые (round) vs острые (по умолчанию — sharp)
    const round = s.corner === "round"
    ctx.lineJoin = round ? "round" : "miter"
    ctx.lineCap = round ? "round" : "butt"
    // Стиль линии (пунктир/точки) — только для линий и плоских фигур
    if (s.dash && s.dash !== "solid" && DASHABLE_SHAPES.has(s.tool)) {
      const lw = s.width
      if (s.dash === "dotted") { ctx.setLineDash([0.01, lw * 2]); ctx.lineCap = "round" }
      else ctx.setLineDash([lw * 2.4, lw * 1.8])
    }
    const a = pts[0], b = pts[pts.length - 1]
    if (s.angle && ENCLOSED_SHAPES.has(s.tool)) {
      const ccx = (a[0] + b[0]) / 2, ccy = (a[1] + b[1]) / 2
      ctx.save(); ctx.translate(ccx, ccy); ctx.rotate(s.angle); ctx.translate(-ccx, -ccy)
      drawShape(ctx, s.tool, a, b, s.corner)
      ctx.restore()
    } else {
      drawShape(ctx, s.tool, a, b, s.corner)
    }
    return
  }
  // Многоугольник, узнанный SmartDraw: замкнутая ломаная по НАСТОЯЩИМ углам штриха.
  // Отдельный тип нужен потому, что готовые фигуры строятся по габариту (a→b) и
  // умеют только правильные формы: произвольный треугольник габарит превращал бы
  // в равнобедренный, то есть в другой чертёж.
  if (s.tool === "poly") {
    ctx.lineJoin = s.corner === "round" ? "round" : "miter"
    ctx.lineCap = s.corner === "round" ? "round" : "butt"
    if (s.dash === "dotted") { ctx.setLineDash([0.01, s.width * 2]); ctx.lineCap = "round" }
    else if (s.dash === "dashed") ctx.setLineDash([s.width * 2.4, s.width * 1.8])
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.stroke()
    return
  }

  // Многоугольник, узнанный SmartDraw: замкнутая ломаная по НАСТОЯЩИМ углам штриха.
  // Отдельный тип нужен потому, что готовые фигуры строятся по габариту (a→b) и
  // умеют только правильные формы: произвольный треугольник габарит превращал бы
  // в равнобедренный, то есть в другой чертёж.
  if (s.tool === "poly") {
    ctx.lineJoin = s.corner === "round" ? "round" : "miter"
    ctx.lineCap = s.corner === "round" ? "round" : "butt"
    if (s.dash === "dotted") { ctx.setLineDash([0.01, s.width * 2]); ctx.lineCap = "round" }
    else if (s.dash === "dashed") ctx.setLineDash([s.width * 2.4, s.width * 1.8])
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.stroke()
    return
  }

  const wOf = (pt) => (pt[2] != null && pt[2] > 2.5 ? pt[2] : s.width)
  if (pts.length === 1) {
    ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], wOf(pts[0]) / 2, 0, Math.PI * 2); ctx.fill()
    return
  }
  if (s.tool === "pen") {
    // Сплайн Catmull-Rom с дроблением — гладко даже при редких точках
    const P = pts
    if (P.length === 2) {
      ctx.lineWidth = (wOf(P[0]) + wOf(P[1])) / 2
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); ctx.lineTo(P[1][0], P[1][1]); ctx.stroke()
      return
    }
    const cr = (a, b, c, d, t) => {
      const t2 = t * t, t3 = t2 * t
      return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
    }
    let px = P[0][0], py = P[0][1], pw = wOf(P[0])
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1]
      const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
      const steps = Math.max(2, Math.min(24, Math.round(segLen / 8)))
      const w1 = wOf(p1), w2 = wOf(p2)
      for (let k = 1; k <= steps; k++) {
        const t = k / steps
        const x = cr(p0[0], p1[0], p2[0], p3[0], t)
        const y = cr(p0[1], p1[1], p2[1], p3[1], t)
        const w = w1 + (w2 - w1) * t
        ctx.lineWidth = (pw + w) / 2
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke()
        px = x; py = y; pw = w
      }
    }
    return
  }
  // Ластик — ровная сглаженная кривая
  ctx.lineWidth = s.width
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2
    const my = (pts[i][1] + pts[i + 1][1]) / 2
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last[0], last[1]); ctx.stroke()
}

// Лист с заданием под тёмную доску. Лист всегда ХРАНИТСЯ светлым (белая бумага), а
// тёмный вид считается здесь — поэтому переключение темы доски перекрашивает и уже
// лежащие задания, а не только новые.
//
// Переворачивается только СВЕТЛОТА пикселя, оттенок и насыщенность остаются: обычная
// инверсия сделала бы оранжевые стены Робота голубыми, а синюю точку жёлтой.
// Возвращает null, если холст «испорчен» картинкой без CORS — тогда рисуем как есть.
const SHEET_BG_L = 44 / 255    // цвет тёмного листа = панель доски (#2c2c2e)
const SHEET_INK_L = 0.96       // куда уезжает бывший чёрный текст

function hueToRgb(p, q, t) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

export function tintSheet(source) {
  const w = source.naturalWidth || source.width, h = source.naturalHeight || source.height
  if (!w || !h) return null
  const out = document.createElement("canvas")
  out.width = w; out.height = h
  const ctx = out.getContext("2d")
  ctx.drawImage(source, 0, 0, w, h)
  let img
  try {
    img = ctx.getImageData(0, 0, w, h)
  } catch {
    return null      // картинка без CORS — холст читать нельзя
  }
  const d = img.data
  const span = SHEET_INK_L - SHEET_BG_L
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const nl = SHEET_BG_L + (1 - (max + min) / 2) * span
    if (max === min) {                       // серый — светлота и есть весь цвет
      const v = Math.round(nl * 255)
      d[i] = v; d[i + 1] = v; d[i + 2] = v
      continue
    }
    const dmax = max - min
    const l = (max + min) / 2
    const sat = l > 0.5 ? dmax / (2 - max - min) : dmax / (max + min)
    let hue
    if (max === r) hue = (g - b) / dmax + (g < b ? 6 : 0)
    else if (max === g) hue = (b - r) / dmax + 2
    else hue = (r - g) / dmax + 4
    hue /= 6
    const q = nl < 0.5 ? nl * (1 + sat) : nl + sat - nl * sat
    const pp = 2 * nl - q
    d[i] = Math.round(hueToRgb(pp, q, hue + 1 / 3) * 255)
    d[i + 1] = Math.round(hueToRgb(pp, q, hue) * 255)
    d[i + 2] = Math.round(hueToRgb(pp, q, hue - 1 / 3) * 255)
  }
  ctx.putImageData(img, 0, 0)
  return out
}

// Габарит всей сцены (по видимым штрихам; ластик сам по себе площадь не занимает)
export function sceneBBox(strokes) {
  let bb = null
  for (const s of strokes) {
    if (!s || s.tool === "eraser" || !s.points?.length) continue
    const b = strokeBBox(s)
    bb = bb ? { minX: Math.min(bb.minX, b.minX), minY: Math.min(bb.minY, b.minY), maxX: Math.max(bb.maxX, b.maxX), maxY: Math.max(bb.maxY, b.maxY) } : b
  }
  return bb
}

// Картинки сцены (лежат в публичном бакете). crossOrigin — иначе холст «портится»
// и toDataURL кидает SecurityError; ждём с потолком по времени, чтобы снимок при
// закрытии доски не подвешивал выход.
export function preloadSceneImages(strokes, timeout = 2500) {
  const srcs = [...new Set(strokes.filter((s) => s.tool === "image" && s.src).map((s) => s.src))]
  const cache = new Map()
  if (!srcs.length) return Promise.resolve(cache)
  const one = (src) => new Promise((res) => {
    const im = new Image()
    if (!src.startsWith("data:")) im.crossOrigin = "anonymous"
    im.onload = () => { cache.set(src, im); res() }
    im.onerror = () => res()
    im.src = src
  })
  return Promise.race([
    Promise.all(srcs.map(one)),
    new Promise((res) => setTimeout(res, timeout)),
  ]).then(() => cache)
}

// Рисует сцену целиком в холст размера w×h: подгоняет масштаб под габарит, кладёт
// фон и узор. Возвращает применённый масштаб (нужен, если сверху что-то дорисовывать).
export function renderScene(canvas, scene, { width, height, padding = 24, images = new Map(), dpr = 1 } = {}) {
  const strokes = scene?.strokes || []
  const bgColor = scene?.bgColor || "#ffffff"
  const darkBg = isDarkColor(bgColor)
  const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height))
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext("2d")
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, w, h)

  const bb = sceneBBox(strokes)
  const scale = bb
    ? clamp(Math.min((w - padding * 2) / Math.max(1, bb.maxX - bb.minX), (h - padding * 2) / Math.max(1, bb.maxY - bb.minY)), 0.02, 3)
    : 1
  const ox = bb ? (w - (bb.maxX - bb.minX) * scale) / 2 - bb.minX * scale : 0
  const oy = bb ? (h - (bb.maxY - bb.minY) * scale) / 2 - bb.minY * scale : 0

  // Узор фона — в экранных координатах, как на живой доске
  const mode = scene?.bg
  const step = GRID * scale
  if ((mode === "grid" || mode === "dots") && step >= 6) {
    const gc = darkBg ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"
    const sx = ((ox % step) + step) % step, sy = ((oy % step) + step) % step
    if (mode === "grid") {
      ctx.strokeStyle = gc; ctx.lineWidth = 1; ctx.beginPath()
      for (let x = sx; x < w; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h) }
      for (let y = sy; y < h; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5) }
      ctx.stroke()
    } else {
      ctx.fillStyle = gc
      const r = clamp(1.3 * scale, 0.8, 2.2)
      for (let x = sx; x < w; x += step)
        for (let y = sy; y < h; y += step) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill() }
    }
  }

  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr)
  const tinted = new Map()
  const getImage = (src, wantTint) => {
    const im = images.get(src) || null
    if (!im || !wantTint) return im
    if (!tinted.has(src)) tinted.set(src, tintSheet(im))
    return tinted.get(src) || im
  }
  for (const s of strokes) paintStroke(ctx, s, { darkBg, getImage })
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.globalCompositeOperation = "source-over"
  return scale
}

// Маленькое превью сцены для карточки в истории занятий (data URL, jpeg).
export async function scenePreview(scene, { width = 480, height = 300, quality = 0.72 } = {}) {
  const strokes = scene?.strokes || []
  if (!strokes.length) return null
  const images = await preloadSceneImages(strokes)
  const canvas = document.createElement("canvas")
  renderScene(canvas, scene, { width, height, padding: 12, images, dpr: 1 })
  try {
    return canvas.toDataURL("image/jpeg", quality)
  } catch {
    return null   // холст «испорчен» картинкой без CORS — обойдёмся без превью
  }
}
