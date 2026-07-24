// ЕГЭ Профиль — Задание 3 (стереометрия). ЧИСТАЯ ПЕРЕСБОРКА С НУЛЯ.
// Единый движок кабинетной проекции для всех тел. Стиль 1-в-1 с ФИПИ:
// всё ЧЁРНОЕ, скрытые рёбра штрихом, выделенное тело жирным чёрным (без заливки),
// размеры на фигуру НЕ наносятся (в банке они в тексте; в «Доп.» — наносятся).
// Ответы считаются кодом. Источник эталона — fipi_bank_ege_prof (49 банк + 164 Доп).

// ── базовые утилиты ─────────────────────────────────────────────────────────
export function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)) }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
// число → строка с запятой (рус.), без лишних нулей
export function ru(x) {
  if (!isFinite(x)) return String(x)
  const r = Math.round(x * 1e6) / 1e6
  return (Number.isInteger(r) ? String(r) : String(r).replace(".", ","))
}
const cl = (n) => (Math.round(n * 100) / 100)
const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
const HALO = 'paint-order="stroke" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"'
const INK = "#000"

// ── кабинетная проекция ─────────────────────────────────────────────────────
// x → вправо, y → вверх, z → вглубь (вверх-вправо). Экранный y растёт вниз.
const SX = 46, SY = 42, DX = 33, DY = 17
function project(p) { return [p[0] * SX + p[2] * DX, -p[1] * SY - p[2] * DY] }

// Отрисовать тело из вершин и рёбер.
//  V: { name: [x,y,z] }
//  edges: [ [a, b, {hidden?, bold?}] ]  — a,b имена вершин
//  labels: [ {at:name, text} ]  — подписи вершин (снаружи центроида)
//  extra: доп. svg-строка поверх (напр. цифры-размеры для Доп.)
//  pad, minSize — компоновка
function drawSolid({ V, edges, labels = [], extra = "", W = 300, H = 240, sx = SX, sy = SY, dx = DX, dy = DY }) {
  const proj = (p) => [p[0] * sx + p[2] * dx, -p[1] * sy - p[2] * dy]
  const names = Object.keys(V)
  const S = {}; for (const n of names) S[n] = proj(V[n])
  const xs = names.map(n => S[n][0]), ys = names.map(n => S[n][1])
  let minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const ox = (W - (maxX - minX)) / 2 - minX, oy = (H - (maxY - minY)) / 2 - minY
  const P = (n) => [cl(S[n][0] + ox), cl(S[n][1] + oy)]
  const cen = [names.reduce((s, n) => s + S[n][0] + ox, 0) / names.length,
  names.reduce((s, n) => s + S[n][1] + oy, 0) / names.length]
  let g = ""
  // рёбра: сначала скрытые (штрих), потом видимые, жирные — последними
  const draw = (e) => {
    const [a, b, o = {}] = e, pa = P(a), pb = P(b)
    const w = o.bold ? 2.6 : 1.5
    const dash = o.hidden ? ' stroke-dasharray="6 4"' : ""
    return `<line x1="${pa[0]}" y1="${pa[1]}" x2="${pb[0]}" y2="${pb[1]}" stroke="${INK}" stroke-width="${w}"${dash} stroke-linecap="round"/>`
  }
  for (const e of edges) if (e[2]?.hidden) g += draw(e)
  for (const e of edges) if (!e[2]?.hidden && !e[2]?.bold) g += draw(e)
  for (const e of edges) if (!e[2]?.hidden && e[2]?.bold) g += draw(e)
  // подписи вершин
  for (const L of labels) {
    const p = P(L.at), dx = p[0] - cen[0], dy = p[1] - cen[1], d = Math.hypot(dx, dy) || 1
    const x = p[0] + dx / d * 13, y = p[1] + dy / d * 13 + 5
    g += `<text x="${cl(x)}" y="${cl(y)}" font-size="15" font-style="italic" font-weight="bold" fill="${INK}" text-anchor="middle" ${HALO}>${L.text}</text>`
  }
  g += extra
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`
}

// ── прямоугольный параллелепипед ABCDA₁B₁C₁D₁ ────────────────────────────────
// A,B — перёд-низ (лево/право); C,D — зад-низ (право/лево); *1 — верх.
// hi: массив «жирных» рёбер (имена пар "AB") — искомое тело; hiDash: жирные, но скрытые.
const SUB = { A: "A", B: "B", C: "C", D: "D", A1: "A₁", B1: "B₁", C1: "C₁", D1: "D₁" }
function boxV(w = 2.7, h = 2.5, d = 1.9) {
  return {
    A: [0, 0, 0], B: [w, 0, 0], C: [w, 0, d], D: [0, 0, d],
    A1: [0, h, 0], B1: [w, h, 0], C1: [w, h, d], D1: [0, h, d],
  }
}
// базовые 12 рёбер каркаса с корректными скрытыми (вокруг зад-лев-низ D)
// hi: жирные видимые рёбра (сплошные); hiDash: жирные скрытые (штрих, напр. боковые пирамиды).
// Скрытость каркасных рёбер (у зад-лев-низ D) сохраняется, если ребро не выделено сплошным.
function boxEdges(hi = [], hiDash = []) {
  const norm = (a, b) => [a, b].sort().join("|")
  const H = new Set(hi.map(p => norm(p[0], p[1])))
  const HD = new Set(hiDash.map(p => norm(p[0], p[1])))
  const frame = [
    ["A", "B", 0], ["B", "C", 0], ["C", "D", 1], ["D", "A", 1],
    ["A1", "B1", 0], ["B1", "C1", 0], ["C1", "D1", 0], ["D1", "A1", 0],
    ["A", "A1", 0], ["B", "B1", 0], ["C", "C1", 0], ["D", "D1", 1],
  ]
  const out = []
  for (const [a, b, hid] of frame) {
    const k = norm(a, b)
    const bold = H.has(k), boldDash = HD.has(k)
    out.push([a, b, { hidden: boldDash || (!!hid && !bold), bold: bold || boldDash }])
    H.delete(k); HD.delete(k)
  }
  for (const k of H) { const [a, b] = k.split("|"); out.push([a, b, { bold: true, hidden: false }]) }
  for (const k of HD) { const [a, b] = k.split("|"); out.push([a, b, { bold: true, hidden: true }]) }
  return out
}
function boxLabels() { return Object.keys(SUB).map(n => ({ at: n, text: SUB[n] })) }

// ── правильная треугольная призма ABCA₁B₁C₁ ─────────────────────────────────
// Основание — треугольник (A перёд-лево, B перёд-право, C зад-центр), высота вверх.
const PRISMNAME = "ABCA₁B₁C₁"
// A — задняя (скрытая) вершина; B перёд-лево, C перёд-право; высота вверх (как ФИПИ image10).
function prismV(w = 1.9, d = 1.5, h = 2.6) {
  return {
    B: [0, 0, 0], C: [w, 0, 0], A: [w / 2, 0, d],
    B1: [0, h, 0], C1: [w, h, 0], A1: [w / 2, h, d],
  }
}
// hi: жирные видимые, hiDash: жирные скрытые. Скрытые каркасные — рёбра к задней вершине A.
function prismEdges(hi = [], hiDash = []) {
  const norm = (a, b) => [a, b].sort().join("|")
  const H = new Set(hi.map(p => norm(p[0], p[1]))), HD = new Set(hiDash.map(p => norm(p[0], p[1])))
  const frame = [
    ["B", "C", 0], ["C", "A", 1], ["A", "B", 1],   // низ: B-C виден, к A — штрих
    ["B1", "C1", 0], ["C1", "A1", 0], ["A1", "B1", 0], // верх — виден
    ["B", "B1", 0], ["C", "C1", 0], ["A", "A1", 1],  // A-A1 за телом → штрих
  ]
  const out = []
  for (const [a, b, hid] of frame) {
    const k = norm(a, b), bold = H.has(k), bd = HD.has(k)
    out.push([a, b, { hidden: bd || (!!hid && !bold), bold: bold || bd }])
    H.delete(k); HD.delete(k)
  }
  for (const k of H) { const [a, b] = k.split("|"); out.push([a, b, { bold: true }]) }
  for (const k of HD) { const [a, b] = k.split("|"); out.push([a, b, { bold: true, hidden: true }]) }
  return out
}
function prismLabels() { return ["A", "B", "C", "A1", "B1", "C1"].map(n => ({ at: n, text: SUB[n] })) }
// проекция призмы (круче-вверх, чем у куба; сверено с ФИПИ image10)
const PRISM_PROJ = { sx: 46, sy: 42, dx: 18, dy: 24, W: 240, H: 250 }
// S·L, кратные 3 (для «красивого» ответа ÷3)
function prismSL() { let S, L; do { S = rnd(2, 12); L = rnd(3, 12) } while ((S * L) % 3 !== 0); return [S, L] }

// Тетраэдр A,B,C,C₁ (основание + верхняя вершина): V = S·L/3.
function t3PrismTetra() {
  const [S, L] = prismSL()
  const V = prismV()
  const hi = [["A", "B"], ["B", "C"], ["C", "A"], ["C1", "A"], ["C1", "B"], ["C1", "C"]]
  return {
    condition_text: `Найдите объём многогранника, вершинами которого являются вершины A, B, C, C₁ правильной треугольной призмы ${PRISMNAME}, площадь основания которой равна ${ru(S)}, а боковое ребро равно ${ru(L)}.`,
    image_url: svgUrl(drawSolid({ V, edges: prismEdges(hi), labels: prismLabels(), ...PRISM_PROJ })),
    answer: ru(S * L / 3),
  }
}
// Пятивершинник B,C,A₁,B₁,C₁ (призма без тетраэдра A,A₁,B₁,C₁): V = 2·S·L/3.
function t3PrismBig() {
  const [S, L] = prismSL()
  const V = prismV()
  const hi = [["B", "C"], ["A1", "B1"], ["B1", "C1"], ["C1", "A1"], ["B", "B1"], ["C", "C1"], ["B", "A1"], ["C", "A1"]]
  return {
    condition_text: `Дана правильная треугольная призма ${PRISMNAME}, площадь основания которой равна ${ru(S)}, а боковое ребро равно ${ru(L)}. Найдите объём многогранника, вершинами которого являются точки B, C, A₁, B₁, C₁.`,
    image_url: svgUrl(drawSolid({ V, edges: prismEdges(hi), labels: prismLabels(), ...PRISM_PROJ })),
    answer: ru(2 * S * L / 3),
  }
}

const BOXNAME = "ABCDA₁B₁C₁D₁"
// целые a,b,c из [2..9] с произведением, кратным k (чтобы ответ был «красивым»)
function tripleDiv(k) {
  let a, b, c
  do { a = rnd(2, 9); b = rnd(2, 9); c = rnd(2, 9) } while ((a * b * c) % k !== 0)
  return [a, b, c]
}

// Тетраэдр A,B,C,B₁ — четверть основания × высота ÷ 3 = a·b·c/6.
function t3BoxTetra() {
  const [a, b, c] = tripleDiv(6)
  const V = boxV()
  const hi = [["A", "B"], ["B", "C"], ["C", "A"], ["A", "B1"], ["B", "B1"], ["C", "B1"]]
  return {
    condition_text: `В прямоугольном параллелепипеде ${BOXNAME} известно, что AB = ${ru(a)}, BC = ${ru(b)}, AA₁ = ${ru(c)}. Найдите объём многогранника, вершинами которого являются точки A, B, C, B₁.`,
    image_url: svgUrl(drawSolid({ V, edges: boxEdges(hi), labels: boxLabels() })),
    answer: ru(a * b * c / 6),
  }
}
// Пирамида ABCD + вершина B₁: V = a·b·c/3.
function t3BoxPyr() {
  const [a, b, c] = tripleDiv(3)
  const V = boxV()
  const base = [["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"]]
  const lat = [["B1", "A"], ["B1", "B"], ["B1", "C"], ["B1", "D"]]
  return {
    condition_text: `В прямоугольном параллелепипеде ${BOXNAME} известно, что AB = ${ru(a)}, BC = ${ru(b)}, BB₁ = ${ru(c)}. Найдите объём многогранника, вершинами которого являются точки A, B, C, D, B₁.`,
    image_url: svgUrl(drawSolid({ V, edges: boxEdges(base, lat), labels: boxLabels() })),
    answer: ru(a * b * c / 3),
  }
}
// Клин из 6 вершин A,B,C,D,A₁,B₁ (половина параллелепипеда): V = a·b·c/2.
function t3BoxHalf() {
  const [a, b, c] = tripleDiv(2)
  const V = boxV()
  const hi = [["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"], ["A", "A1"], ["B", "B1"], ["A1", "B1"], ["A1", "D"], ["B1", "C"]]
  return {
    condition_text: `В прямоугольном параллелепипеде ${BOXNAME} известно, что AB = ${ru(a)}, BC = ${ru(b)}, AA₁ = ${ru(c)}. Найдите объём многогранника, вершинами которого являются точки A, B, C, D, A₁, B₁.`,
    image_url: svgUrl(drawSolid({ V, edges: boxEdges(hi), labels: boxLabels() })),
    answer: ru(a * b * c / 2),
  }
}

// Клин A,B,C,A₁,B₁,C₁ (треугольная призма по диагонали AC, полная высота): V = a·b·c/2.
function t3BoxHalf2() {
  const [a, b, c] = tripleDiv(2)
  const V = boxV()
  const hi = [["A", "B"], ["B", "C"], ["C", "A"], ["A1", "B1"], ["B1", "C1"], ["C1", "A1"], ["A", "A1"], ["B", "B1"], ["C", "C1"]]
  return {
    condition_text: `В прямоугольном параллелепипеде ${BOXNAME} известно, что AB = ${ru(a)}, BC = ${ru(b)}, AA₁ = ${ru(c)}. Найдите объём многогранника, вершинами которого являются точки A, B, C, A₁, B₁, C₁.`,
    image_url: svgUrl(drawSolid({ V, edges: boxEdges(hi), labels: boxLabels() })),
    answer: ru(a * b * c / 2),
  }
}

// Реестр блоков (наполняется по мере сборки). Номер 3.
export const GEN3 = {
  boxTetra: t3BoxTetra, boxPyr: t3BoxPyr, boxHalf: t3BoxHalf, boxHalf2: t3BoxHalf2,
  prismTetra: t3PrismTetra, prismBig: t3PrismBig,
}

// экспорт для теста
export const __test = { drawSolid, boxV, boxEdges, boxLabels, svgUrl, project }
