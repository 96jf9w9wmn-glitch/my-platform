// Модули ОГЭ №1–5 — практико-ориентированный блок: один сценарий (текст + план) и
// пять привязанных к нему вопросов. Не пять независимых задач: №1 — соответствие
// объектов номерам, №5 — выбор отопления (газ/электричество) по таблице, №2–4 —
// расчёты из пула типажей банка. Всё считается кодом; план и таблицу рендерим сами
// по образцу ФИПИ (свой аналог). Эталон типажей — сборник math100 «Дачный участок»
// (варианты I–VIII): №1 соответствие, №2–4 {плитка/периметр/площадь/расстояние/
// проценты}, №5 отопление. См. fipi_bank/README.md (КЭС 3.3, «Задание №1…№5»).
//
// Форма модуля: { intro, image_url, tasks:[{number, condition_text, answer, image_url?}×5] }.

import { HORSE_ICON } from "./horseIcon.js"
import { POND_ICON, POND_ASPECT } from "./pondIcon.js"

const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
// пруд — 3D игровая иконка (растр, инлайн base64); (cx,cy) — центр, w — ширина
const pondImg = (cx, cy, w) => { const h = w / POND_ASPECT; return `<image href="${POND_ICON}" x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>` }
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i);[a[i], a[j]] = [a[j], a[i]] } return a }
const svgToDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
const CELL = 2

// ── Сценарий «Дачный участок» ────────────────────────────────────────────────
// Топология фиксирована (прототип ФИПИ): ворота справа; слева от них гараж, справа
// сарай (24 м²), дом в глубине, баня по дорожке, огород (цифра n) с теплицей.
function genPlot() {
  const Pw = 13, Ph = 9, gy = 4
  // Топология-скелет фиксирована (соответствует тексту: ворота справа, гараж слева/снизу,
  // сарай справа/сверху, дом в глубине, огород в левом верхнем углу, баня внизу слева).
  // Внутри скелета варьируем размеры и точное положение строений, теплицу, вырез дома,
  // яблони и «шаг» дорожки — чтобы каждый план заметно отличался, а текст/дорожка/ворота
  // оставались корректными. Баня, площадка и коридоры дорожки закреплены (от них идёт
  // маршрут плитки), поэтому их не двигаем.
  const hw = randInt(3, 4)                          // ширина дома (глубина 3)
  const hx = hw === 4 ? 4 : pick([4, 5])            // сдвиг дома вправо, не задевая сарай
  const greenH = pick([1, 2])                       // высота теплицы внутри огорода
  const shedH = pick([2, 3])                        // сарай 16 или 24 м²
  const garageH = pick([2, 3])                      // гараж 16 или 24 м²
  const objs = [
    { key: "shed", name: "сарай", gen: "сарая", g: "m", x: Pw - 2, y: 1, w: 2, h: shedH, ask: true },        // справа-сверху
    { key: "garage", name: "гараж", gen: "гаража", g: "m", x: Pw - 2, y: Ph - garageH, w: 2, h: garageH, ask: true }, // справа-снизу
    { key: "house", name: "жилой дом", gen: "жилого дома", g: "m", x: hx, y: 1, w: hw, h: 3, ask: true, notch: { nw: pick([1, 2]), nh: pick([1, 2]) } },  // Г-образный
    { key: "bath", name: "баня", gen: "бани", g: "f", x: 1, y: 6, w: 2, h: 2, ask: true },
    { key: "green", name: "теплица", gen: "теплицы", g: "f", x: 1, y: 1, w: 2, h: greenH, ask: true },
    { key: "garden", name: "огород", gen: "огорода", g: "m", x: 1, y: 1, w: 2, h: 3, ask: false, region: true },
  ]
  // Яблони — «напротив дома», поэтому под его проекцией, у нижнего края участка.
  const ax = Math.max(3, Math.min(hx, Pw - 4))
  const apples = [{ x: ax, y: Ph - 2 }, { x: ax + hw - 1, y: Ph - 2 }]
  shuffle(objs.map((_, i) => i + 1)).forEach((n, i) => { objs[i].n = n })
  // Плитка — в 1-метровых клетках (u = полклетки), СТРОГО по 1-м сетке (иначе квадраты
  // «плавают» и не стыкуются). u-координаты: баня правый край=6, площадка x22..25 y8..11.
  const pad = { x: Pw - 2, y: gy, w: 2, h: 2 }       // площадка между гаражом и сараем
  const pathCells = new Set(), padCells = new Set()
  const addH = (uy, a, b) => { for (let ux = Math.min(a, b); ux <= Math.max(a, b); ux++) pathCells.add(ux + "," + uy) }
  const addV = (ux, a, b) => { for (let uy = Math.min(a, b); uy <= Math.max(a, b); uy++) pathCells.add(ux + "," + uy) }
  addH(13, 6, 15); addV(15, 10, 13); addH(10, 15, 21)  // баня → вверх → к площадке
  for (let ux = pad.x * 2; ux < (pad.x + pad.w) * 2; ux++) for (let uy = pad.y * 2; uy < (pad.y + pad.h) * 2; uy++) padCells.add(ux + "," + uy)
  return { Pw, Ph, gy, objs, apples, pad, pathCells, padCells, pathTiles: pathCells.size, padTiles: padCells.size }
}

// Пара объектов с перекрытием проекций по оси → «расстояние по прямой» (целое).
function alignedPair(objs) {
  const cand = []
  for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) {
    const A = objs[i], B = objs[j]
    if (A.region || B.region) continue
    const xOv = Math.max(A.x, B.x) < Math.min(A.x + A.w, B.x + B.w)
    const yOv = Math.max(A.y, B.y) < Math.min(A.y + A.h, B.y + B.h)
    if (xOv && !yOv) { const gap = A.y < B.y ? B.y - (A.y + A.h) : A.y - (B.y + B.h); if (gap >= 1) cand.push({ a: A, b: B, dist: gap * CELL }) }
    else if (yOv && !xOv) { const gap = A.x < B.x ? B.x - (A.x + A.w) : A.x - (B.x + B.w); if (gap >= 1) cand.push({ a: A, b: B, dist: gap * CELL }) }
  }
  return cand.length ? pick(cand) : null
}

// Рендер плана по образцу ФИПИ (см. предыдущую версию: сетка, ворота, кружки, плитка).
function renderPlan(p) {
  const { Pw, Ph, gy, objs, apples, pathCells, padCells } = p
  const greenH = (objs.find((o) => o.key === "green") || {}).h || 1
  const S = 30, LEG = 150
  const gridW = Pw + 2, gridH = Ph + 2
  const W = gridW * S + LEG, H = gridH * S + 10
  const ox = S, oy = S
  const X = (i) => ox + i * S, Y = (j) => oy + j * S
  const gateY1 = Y(gy), gateY2 = Y(gy + 1), gm = (gateY1 + gateY2) / 2, pw = S / 2
  let g = `<rect width="${W}" height="${H}" fill="#fff"/>`
  for (let i = 0; i <= gridW; i++) g += `<line x1="${i * S}" y1="0" x2="${i * S}" y2="${gridH * S}" stroke="#c4c4c4" stroke-width="1"/>`
  for (let j = 0; j <= gridH; j++) g += `<line x1="0" y1="${j * S}" x2="${gridW * S}" y2="${j * S}" stroke="#c4c4c4" stroke-width="1"/>`
  // плитка — квадраты 1×1 м, выровнены по 1-м сетке (u = pw = S/2); стыки совпадают
  const u = pw
  const drawTile = (k) => { const [ux, uy] = k.split(",").map(Number); return `<rect x="${ox + ux * u}" y="${oy + uy * u}" width="${u}" height="${u}" fill="#d6d6d6" stroke="#9a9a9a" stroke-width="0.7"/>` }
  for (const k of padCells) g += drawTile(k)
  for (const k of pathCells) g += drawTile(k)
  g += `<g stroke="#111" stroke-width="3" fill="none" stroke-linecap="square">`
  g += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(Pw)}" y2="${Y(0)}"/><line x1="${X(0)}" y1="${Y(Ph)}" x2="${X(Pw)}" y2="${Y(Ph)}"/>`
  g += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(Ph)}"/>`
  g += `<line x1="${X(Pw)}" y1="${Y(0)}" x2="${X(Pw)}" y2="${gateY1}"/><line x1="${X(Pw)}" y1="${gateY2}" x2="${X(Pw)}" y2="${Y(Ph)}"/></g>`
  g += `<text x="${X(Pw) + 16}" y="${gm}" font-size="15" fill="#111" transform="rotate(90 ${X(Pw) + 16} ${gm})" text-anchor="middle">ворота</text>`
  for (const o of objs) {
    if (o.region) {
      g += `<rect x="${X(o.x)}" y="${Y(o.y)}" width="${o.w * S}" height="${o.h * S}" fill="none" stroke="#111" stroke-width="1.4" stroke-dasharray="4 3"/>`
      // Морковки — только в открытом грунте (ниже теплицы) и мимо кружка-цифры (он в
      // левом-нижнем углу). Если открытая полоса ≥2 клеток — грядки в её верхней клетке
      // (кружок остаётся ниже); если открыта одна клетка — грядки правее кружка.
      const openRows = o.h - greenH
      if (openRows >= 2) {
        const cy = Y(o.y + greenH) + 24
        for (let k = 0; k < 3; k++) g += carrot(X(o.x) + 11 + k * 16, cy)
      } else {
        const cy = Y(o.y + o.h) - 6
        for (let k = 0; k < 3; k++) g += carrot(X(o.x) + 32 + k * 11, cy)
      }
    } else if (o.key === "house" && o.notch) {
      const x0 = X(o.x), y0 = Y(o.y), x1 = X(o.x + o.w), y1 = Y(o.y + o.h)
      const nx = X(o.x + o.notch.nw), ny = Y(o.y + o.h - o.notch.nh)
      g += `<polygon points="${x0},${y0} ${x1},${y0} ${x1},${y1} ${nx},${y1} ${nx},${ny} ${x0},${ny}" fill="#cfcfcf" stroke="#111" stroke-width="1.6"/>`
    } else {
      g += `<rect x="${X(o.x)}" y="${Y(o.y)}" width="${o.w * S}" height="${o.h * S}" fill="${o.key === "green" ? "#ededed" : "#cfcfcf"}" stroke="#111" stroke-width="1.6"/>`
    }
  }
  for (const a of apples) g += tree(X(a.x) + S / 2, Y(a.y) + S / 2)
  for (const o of objs) {
    let cx, cy
    if (o.region) {
      cx = X(o.x) + S * 0.5; cy = Y(o.y + o.h) - S * 0.5          // левый-нижний угол огорода
    } else if (o.key === "house" && o.notch) {
      // Г-образный дом: ставим кружок в центр большей сплошной части (верхняя полоса
      // на всю ширину либо нижний-правый прямоугольник), иначе он попадёт в вырез.
      const { nw, nh } = o.notch
      const topA = o.w * (o.h - nh), botA = (o.w - nw) * nh
      const r = topA >= botA
        ? { x: o.x, y: o.y, w: o.w, h: o.h - nh }
        : { x: o.x + nw, y: o.y + o.h - nh, w: o.w - nw, h: nh }
      cx = X(r.x) + r.w * S / 2; cy = Y(r.y) + r.h * S / 2
    } else {
      cx = X(o.x) + o.w * S / 2; cy = Y(o.y) + o.h * S / 2
    }
    g += `<circle cx="${cx}" cy="${cy}" r="13" fill="#fff" stroke="#111" stroke-width="1.6"/><text x="${cx}" y="${cy + 5}" font-size="15" font-weight="700" text-anchor="middle" fill="#111">${o.n}</text>`
  }
  const lx = gridW * S + 14; let ly = oy + 6
  g += [[0, 0], [7, 0], [0, 7], [7, 7]].map(([dx, dy]) => `<rect x="${lx + dx}" y="${ly + dy}" width="6" height="6" fill="#d6d6d6" stroke="#9a9a9a" stroke-width="0.7"/>`).join("") + `<text x="${lx + 22}" y="${ly + 12}" font-size="14" fill="#111">плитки</text>`
  ly += 42; g += tree(lx + 7, ly + 3) + `<text x="${lx + 22}" y="${ly + 8}" font-size="14" fill="#111">яблони</text>`
  ly += 42; g += carrot(lx + 3, ly + 10) + carrot(lx + 15, ly + 10) + `<text x="${lx + 28}" y="${ly + 5}" font-size="14" fill="#111">огород</text>`
  ly += 46; g += `<line x1="${lx}" y1="${ly}" x2="${lx + S}" y2="${ly}" stroke="#111" stroke-width="1.5"/><line x1="${lx}" y1="${ly - 4}" x2="${lx}" y2="${ly + 4}" stroke="#111" stroke-width="1.5"/><line x1="${lx + S}" y1="${ly - 4}" x2="${lx + S}" y2="${ly + 4}" stroke="#111" stroke-width="1.5"/><text x="${lx + S + 6}" y="${ly + 5}" font-size="13" fill="#111">2 м</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`
}
const tree = (cx, cy) => `<circle cx="${cx}" cy="${cy - 4}" r="7" fill="#111"/><circle cx="${cx - 5}" cy="${cy}" r="5" fill="#111"/><circle cx="${cx + 5}" cy="${cy}" r="5" fill="#111"/><rect x="${cx - 1}" y="${cy + 2}" width="2" height="8" fill="#111"/>`
const carrot = (x, y) => `<path d="M${x},${y} l3,-9 l3,9 z" fill="#111"/><path d="M${x + 1},${y - 9} l1,-3 M${x + 3},${y - 9} l0,-3 M${x + 5},${y - 9} l-1,-3" stroke="#111" stroke-width="1"/>`

// ── №5: отопление (газ vs электричество) ─────────────────────────────────────
// Газовое дороже по покупке+установке, но дешевле в час. Ответ — часы окупаемости
// = Δ(стоимость оборуд.+установки) / (экономия в час). Числа подобраны так, что
// ответ — целое (проверяется по построению).
function genHeating() {
  for (let i = 0; i < 200; i++) {
    const priceE = pick([4, 5, 6]), powE = pick([4, 5, 6, 8]), costE = powE * priceE
    const consG = pick([1, 2]), priceG = pick([5, 6, 7]), costG = consG * priceG
    if (costG >= costE) continue
    const s = costE - costG
    const t = pick([200, 250, 300, 350, 400, 450, 500, 550, 600, 650])
    const dC = s * t
    const eqE = pick([15, 18, 20, 24]) * 1000, instE = pick([2, 3, 4]) * 1000
    const dInst = pick([1, 2, 3]) * 1000, instG = instE + dInst, dEq = dC - dInst
    if (dEq < 2000) continue
    return { priceE, powE, costE, consG, priceG, costG, eqE, instE, eqG: eqE + dEq, instG, t }
  }
  return null
}

function renderHeatTable(h) {
  const R = 30, x0 = 10
  // Ширины подобраны под заголовки: «Оборудование, руб.» и «Установка, руб.» длиннее
  // числовых значений. x0-поля слева и справа, чтобы рамка не срезалась по краю viewBox.
  const cols = [150, 132, 112, 84, 92]             // назв., оборуд., установка, расход, тариф
  const W = x0 * 2 + cols.reduce((s, w) => s + w, 0)
  const cx = []; let acc = x0; for (const w of cols) { cx.push(acc); acc += w }
  const H = R * 3 + 8
  const rub = (n) => n.toLocaleString("ru-RU")
  let g = `<rect width="${W}" height="${H}" fill="#fff"/>`
  const cell = (r, c, txt, opt = "") => `<text x="${cx[c] + cols[c] / 2}" y="${8 + r * R + R / 2 + 4}" font-size="12" text-anchor="middle" fill="#111" ${opt}>${txt}</text>`
  // сетка таблицы
  for (let r = 0; r <= 3; r++) g += `<line x1="${x0}" y1="${8 + r * R}" x2="${x0 + acc - x0}" y2="${8 + r * R}" stroke="#111" stroke-width="1"/>`
  let vx = x0; for (let c = 0; c <= cols.length; c++) { g += `<line x1="${vx}" y1="8" x2="${vx}" y2="${8 + 3 * R}" stroke="#111" stroke-width="1"/>`; vx += cols[c] || 0 }
  const head = ["", "Оборудование, руб.", "Установка, руб.", "Расход", "Тариф"]
  head.forEach((t, c) => { if (t) g += cell(0, c, t, 'font-weight="600"') })
  g += cell(1, 0, "Газовое", 'font-weight="600"') + cell(1, 1, rub(h.eqG)) + cell(1, 2, rub(h.instG)) + cell(1, 3, `${h.consG} м³/ч`) + cell(1, 4, `${h.priceG} руб/м³`)
  g += cell(2, 0, "Электрическое", 'font-weight="600"') + cell(2, 1, rub(h.eqE)) + cell(2, 2, rub(h.instE)) + cell(2, 3, `${h.powE} кВт·ч/ч`) + cell(2, 4, `${h.priceE} руб/кВт·ч`)
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`
}

// ── Пул типажей №2–4 (каждый → {condition_text, answer}) ──────────────────────
const area = (o) => (o.w * o.h - (o.notch ? o.notch.nw * o.notch.nh : 0)) * CELL * CELL

function qTile(p) {
  const packSize = pick([4, 5, 6, 8, 10])
  const withPad = pick([true, false])
  const tiles = p.pathTiles + (withPad ? p.padTiles : 0)
  return {
    condition_text:
      `Тротуарная плитка размером 1 м × 1 м продаётся в упаковках по ${packSize} штук. ` +
      `Сколько упаковок плитки понадобилось, чтобы выложить ` +
      (withPad ? `все дорожки и площадку между гаражом и сараем?` : `все дорожки?`),
    answer: String(Math.ceil(tiles / packSize)),
  }
}
function qPerimeter(p) {
  const h = p.objs.find((o) => o.key === "house")
  return { condition_text: `Найдите периметр фундамента жилого дома. Ответ дайте в метрах.`, answer: String(2 * (h.w + h.h) * CELL) }
}
function qAreaObject(p) {
  const o = pick(p.objs.filter((x) => ["house", "bath", "shed"].includes(x.key)))
  return { condition_text: `Найдите площадь, которую занимает ${o.name}. Ответ дайте в квадратных метрах.`, answer: String(area(o)) }
}
function qGardenOpen(p) {
  const garden = p.objs.find((o) => o.key === "garden"), green = p.objs.find((o) => o.key === "green")
  return { condition_text: `Найдите площадь открытого грунта огорода (вне теплицы). Ответ дайте в квадратных метрах.`, answer: String(area(garden) - area(green)) }
}
function qDistance(p) {
  const pr = alignedPair(p.objs)
  return { condition_text: `Найдите расстояние от ${pr.a.gen} до ${pr.b.gen} (расстояние между двумя ближайшими точками) в метрах.`, answer: String(pr.dist) }
}
function qPctBuildings(p) {
  const plotArea = p.Pw * p.Ph * CELL * CELL
  const builds = p.objs.filter((o) => ["house", "garage", "shed", "bath"].includes(o.key))
  return { condition_text: `Сколько процентов от площади всего участка занимают строения (жилой дом, гараж, сарай, баня)? Ответ округлите до целого.`, answer: String(Math.round(builds.reduce((s, o) => s + area(o), 0) / plotArea * 100)) }
}
function qPctShed(p) {
  const plotArea = p.Pw * p.Ph * CELL * CELL
  return { condition_text: `Сколько процентов площади всего участка занимает сарай? Ответ округлите до целого.`, answer: String(Math.round(area(p.objs.find((o) => o.key === "shed")) / plotArea * 100)) }
}
function qPctGreenGarden(p) {
  const garden = p.objs.find((o) => o.key === "garden"), green = p.objs.find((o) => o.key === "green")
  return { condition_text: `Сколько процентов площади всего огорода занимает теплица? Ответ округлите до целого.`, answer: String(Math.round(area(green) / area(garden) * 100)) }
}
function qPctCompare(p) {
  const garage = p.objs.find((o) => o.key === "garage"), green = p.objs.find((o) => o.key === "green")
  const house = p.objs.find((o) => o.key === "house")
  // гараж vs теплица (как у ФИПИ); если площади совпали — дом vs гараж (дом всегда больше)
  let big = garage, small = green
  if (area(garage) === area(green)) { big = house; small = garage }
  else if (area(green) > area(garage)) { big = green; small = garage }
  const nm = (o) => o.name
  return { condition_text: `На сколько процентов площадь, которую занимает ${nm(big)}, больше площади, которую занимает ${nm(small)}? Ответ округлите до целого.`, answer: String(Math.round((area(big) - area(small)) / area(small) * 100)) }
}
const POOL = [qPerimeter, qAreaObject, qGardenOpen, qDistance, qPctBuildings, qPctShed, qPctGreenGarden, qPctCompare]

// Собирает модуль «участок»: план + 5 вопросов (№1 соответствие, №5 отопление,
// №2–4 = плитка + два типажа из пула), ответы считаются кодом.
function mPlot() {
  const p = genPlot()
  const { objs } = p
  const shed = objs.find((o) => o.key === "shed"), garden = objs.find((o) => o.key === "garden")

  const intro =
    `На плане изображён дачный участок (сторона каждой клетки на плане равна ${CELL} м). ` +
    `Участок имеет прямоугольную форму. Выезд и въезд — через единственные ворота (на плане справа). ` +
    `Если встать у ворот лицом к участку, то слева находится гараж, а справа — сарай площадью ${area(shed)} кв. м; ` +
    `чуть подальше, в глубине участка, — жилой дом. Напротив жилого дома расположены яблоневые посадки. ` +
    `Также на участке есть баня, к которой ведёт дорожка, выложенная плиткой, и огород с теплицей внутри ` +
    `(огород отмечен на плане цифрой ${garden.n}). Все дорожки внутри участка имеют ширину 1 м и вымощены ` +
    `тротуарной плиткой размером 1 м × 1 м. Между гаражом и сараем находится площадка, вымощенная такой же плиткой.`

  const four = shuffle(objs.filter((o) => o.ask)).slice(0, 4)
  const q1 = {
    number: 1,
    condition_text:
      `Пользуясь описанием, определите, какими цифрами на плане обозначены следующие объекты. ` +
      `Объекты: ${four.map((o) => o.name).join(", ")}. ` +
      `В ответе запишите четыре цифры без пробелов и запятых в том же порядке, в каком объекты даны в списке.`,
    answer: four.map((o) => o.n).join(""),
  }

  // №2–4: плитка (всегда) + два разных типажа из пула, порядок перемешан
  const mid = shuffle([qTile(p), ...shuffle(POOL).slice(0, 2).map((f) => f(p))])
  const q234 = mid.map((q, i) => ({ number: i + 2, ...q }))

  const h = genHeating()
  const q5 = {
    number: 5,
    condition_text:
      `Хозяин участка планирует установить в жилом доме систему отопления. Он рассматривает два варианта: ` +
      `электрическое или газовое отопление. Цены на оборудование, стоимость установки, расход и тарифы даны в таблице. ` +
      `Обдумав оба варианта, хозяин решил установить газовое отопление. Через сколько часов непрерывной работы ` +
      `отопления экономия от использования газа вместо электричества компенсирует разницу в стоимости ` +
      `покупки и установки газового и электрического оборудования?`,
    answer: String(h.t),
    image_url: svgToDataUrl(renderHeatTable(h)),
  }

  return { scenario: "plot", intro, image_url: svgToDataUrl(renderPlan(p)), tasks: [q1, ...q234, q5] }
}

// ── Сценарий «Квартира» ──────────────────────────────────────────────────────
// Топология фиксирована (прототип ФИПИ, math100 «Квартира» I–VIII): 2-комнатная,
// комнаты замощают прямоугольник; клетка 0,4 м. Лоджии сверху (у кухни/спальни),
// гостиная в центре (самая большая), низ — санузел/коридор/кладовая. №1 соответствие,
// №2 паркет/плитка (пол комнаты), №3 площадь (десятичная), №4 «на сколько % A больше
// B», №5 стиральная машина (фильтр→дешевейший) ИЛИ интернет-тариф (3 плана→дешевейший).
const APT_A = 0.16                                // площадь клетки квартиры (0,4×0,4 м²)
const decA = (x) => (Math.round(x * 100) / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",")

function genApt() {
  for (let t = 0; t < 80; t++) {
    const lh = pick([3, 4]), uh = pick([6, 7]), cb = pick([5, 6])   // широкие пропорции (~1.7:1)
    const kux = pick([6, 7]), spx = pick([6, 7]), gux = pick([12, 14, 16])
    const C = kux + gux + spx, R = lh + uh + cb
    const sw = pick([5, 6]), kw = pick([5, 6]), cor = C - sw - kw
    if (cor < 8) continue
    const rooms = [
      { key: "logK", name: "лоджия у кухни", gen: "лоджии у кухни", prep: "на лоджии у кухни", x: 0, y: 0, w: kux, h: lh, loggia: true },
      { key: "kitchen", name: "кухня", gen: "кухни", prep: "на кухне", x: 0, y: lh, w: kux, h: uh },
      { key: "living", name: "гостиная", gen: "гостиной", prep: "в гостиной", x: kux, y: 0, w: gux, h: lh + uh },
      { key: "logS", name: "лоджия у спальни", gen: "лоджии у спальни", prep: "на лоджии у спальни", x: kux + gux, y: 0, w: spx, h: lh, loggia: true },
      { key: "bedroom", name: "спальня", gen: "спальни", prep: "в спальне", x: kux + gux, y: lh, w: spx, h: uh },
      { key: "bath", name: "санузел", gen: "санузла", prep: "в санузле", x: 0, y: lh + uh, w: sw, h: cb },
      { key: "corridor", name: "коридор", gen: "коридора", prep: "в коридоре", x: sw, y: lh + uh, w: cor, h: cb },
      { key: "storage", name: "кладовая", gen: "кладовой", prep: "в кладовой", x: C - kw, y: lh + uh, w: kw, h: cb },
    ]
    const cells = (r) => r.w * r.h
    const living = rooms.find((r) => r.key === "living")
    if (rooms.some((r) => r !== living && cells(r) >= cells(living))) continue  // гостиная — самая большая
    shuffle(rooms.map((_, i) => i + 1)).forEach((n, i) => { rooms[i].n = n })
    return { C, R, lh, uh, cb, kux, gux, spx, sw, kw, cor, rooms }
  }
  return null
}

// Рендер плана квартиры по образцу ФИПИ: КЛЕТКИ ВИДНЫ ВЕЗДЕ (комнаты без заливки —
// сетка просвечивает), стены, двери с дугой открывания, окна на внешних стенах.
function renderApt(a) {
  const { C, R, lh, uh, gux, kux, spx, sw, kw, cor, rooms } = a
  const S = 14, M = S, LEG = 100
  const W = (C + 2) * S + LEG, H = (R + 2) * S
  const X = (i) => M + i * S, Y = (j) => M + j * S
  let g = `<rect width="${W}" height="${H}" fill="#fff"/>`
  for (let i = 0; i <= C + 2; i++) g += `<line x1="${i * S}" y1="0" x2="${i * S}" y2="${(R + 2) * S}" stroke="#c4c4c4" stroke-width="1"/>`
  for (let j = 0; j <= R + 2; j++) g += `<line x1="0" y1="${j * S}" x2="${(C + 2) * S}" y2="${j * S}" stroke="#c4c4c4" stroke-width="1"/>`
  for (const r of rooms) g += `<rect x="${X(r.x)}" y="${Y(r.y)}" width="${r.w * S}" height="${r.h * S}" fill="none" stroke="#111" stroke-width="2.4"/>`
  g += `<rect x="${X(0)}" y="${Y(0)}" width="${C * S}" height="${R * S}" fill="none" stroke="#111" stroke-width="3.6"/>`
  const winH = (gx, gy, gl) => { const x0 = X(gx), x1 = X(gx + gl), y = Y(gy); return `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#fff" stroke-width="5"/><line x1="${x0}" y1="${y - 1.6}" x2="${x1}" y2="${y - 1.6}" stroke="#111" stroke-width="1"/><line x1="${x0}" y1="${y + 1.6}" x2="${x1}" y2="${y + 1.6}" stroke="#111" stroke-width="1"/>` }
  const winV = (gx, gy, gl) => { const y0 = Y(gy), y1 = Y(gy + gl), x = X(gx); return `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="#fff" stroke-width="5"/><line x1="${x - 1.6}" y1="${y0}" x2="${x - 1.6}" y2="${y1}" stroke="#111" stroke-width="1"/><line x1="${x + 1.6}" y1="${y0}" x2="${x + 1.6}" y2="${y1}" stroke="#111" stroke-width="1"/>` }
  g += winH(1, 0, kux - 2) + winH(kux + gux + 1, 0, spx - 2) + winH(kux + 2, 0, gux - 4) + winV(0, lh + 1, uh - 2) + winV(C, lh + 1, uh - 2)
  // Двери в стиле ФИПИ: проём (белый разрыв стены) + короткая диагональная створка, БЕЗ дуги.
  const LF = 0.6                                   // длина створки относительно ширины проёма
  const vDoor = (gx, gy, gl, sx) => { const x = X(gx), y0 = Y(gy), d = gl * S; return `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + d}" stroke="#fff" stroke-width="4"/><line x1="${x}" y1="${y0}" x2="${x + sx * d * LF}" y2="${y0 + d * LF}" stroke="#111" stroke-width="1.2"/>` }
  const hDoor = (gx, gy, gl, sy) => { const x0 = X(gx), y = Y(gy), d = gl * S; return `<line x1="${x0}" y1="${y}" x2="${x0 + d}" y2="${y}" stroke="#fff" stroke-width="4"/><line x1="${x0}" y1="${y}" x2="${x0 + d * LF}" y2="${y + sy * d * LF}" stroke="#111" stroke-width="1.2"/>` }
  g += hDoor(sw + ((cor / 2) | 0) - 1, R, 2, -1) + vDoor(sw, lh + uh + 1, 2, -1) + vDoor(C - kw, lh + uh + 1, 2, 1) +
    hDoor(kux + 1, lh + uh, 2, -1) + vDoor(kux, lh + 1, 2, -1) + vDoor(kux + gux, lh + 1, 2, 1) +
    hDoor(1, lh, 2, -1) + hDoor(kux + gux + 1, lh, 2, -1) + hDoor(C - kw + 1, lh + uh, 2, -1)
  for (const r of rooms) {
    const cx = X(r.x) + r.w * S / 2, cy = Y(r.y) + r.h * S / 2
    g += `<circle cx="${cx}" cy="${cy}" r="12" fill="#fff" stroke="#111" stroke-width="1.6"/><text x="${cx}" y="${cy + 5}" font-size="14" font-weight="700" text-anchor="middle" fill="#111">${r.n}</text>`
  }
  const lx = (C + 2) * S + 8; let ly = M + 14
  g += `<line x1="${lx}" y1="${ly}" x2="${lx + 20}" y2="${ly}" stroke="#111" stroke-width="2"/><line x1="${lx + 20}" y1="${ly}" x2="${lx + 7}" y2="${ly - 13}" stroke="#111" stroke-width="1.2"/><text x="${lx + 30}" y="${ly + 4}" font-size="12" fill="#111">дверь</text>`
  ly += 44; g += `<line x1="${lx}" y1="${ly - 2.5}" x2="${lx + 24}" y2="${ly - 2.5}" stroke="#111" stroke-width="1"/><line x1="${lx}" y1="${ly + 2.5}" x2="${lx + 24}" y2="${ly + 2.5}" stroke="#111" stroke-width="1"/><text x="${lx + 30}" y="${ly + 2}" font-size="12" fill="#111">окно</text>`
  ly += 40; g += `<line x1="${lx}" y1="${ly}" x2="${lx + S}" y2="${ly}" stroke="#111" stroke-width="1.4"/><line x1="${lx}" y1="${ly - 4}" x2="${lx}" y2="${ly + 4}" stroke="#111" stroke-width="1.4"/><line x1="${lx + S}" y1="${ly - 4}" x2="${lx + S}" y2="${ly + 4}" stroke="#111" stroke-width="1.4"/><text x="${lx + S + 6}" y="${ly + 4}" font-size="11" fill="#111">0,4 м</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`
}

// Универсальная таблица (для №5): заголовки + строки, ширины столбцов.
// noHead=true — без строки-заголовка (как в ФИПИ, иначе во 2-й колонке шапки пустая ячейка).
// Строка вида [текст] (один элемент) — подзаголовок на всю ширину без внутреннего разделителя
// (например «После расходования пакетов:»).
// Приблизительная ширина строки в Arial (px) для авто-подгонки колонок. Arial шире Times,
// поэтому фиксированные colW из старой вёрстки не вмещали заголовки — считаем по символам
// с запасом, чтобы текст гарантированно не вылезал за границу ячейки.
function arialTextW(s, fs, bold) {
  let u = 0
  for (const ch of String(s)) {
    if (ch === " ") u += 0.30
    else if (/[.,:;!|'’]/.test(ch)) u += 0.30
    else if (/[ilIjt]/.test(ch)) u += 0.32
    else if (/[0-9]/.test(ch)) u += 0.56
    else if (/[A-ZА-ЯЁ×%()№/]/.test(ch)) u += 0.70
    else if (/[мшщжюфы]/.test(ch)) u += 0.72        // широкие строчные кириллические
    else u += 0.56                                  // прочие строчные латиница/кириллица
  }
  return u * fs * (bold ? 1.06 : 1)
}

function renderTable(headers, rows, colW, noHead = false) {
  const RH = 28, x0 = 6, pad = 6, FS = 12, cpad = 9
  const nRows = rows.length + (noHead ? 0 : 1)
  // Колонку расширяем до самого широкого текста (заголовок или ячейка) + отступы; переданная
  // colW становится минимумом, чтобы узкие числовые столбцы не сжимались сильнее прежнего.
  const isSpanRow = (row) => Array.isArray(row) && row.length === 1
  const cw = colW.map((w, c) => {
    let m = noHead ? 0 : arialTextW(headers[c] ?? "", FS, true)
    for (const row of rows) { if (isSpanRow(row)) continue; const cell = row[c]; if (cell != null) m = Math.max(m, arialTextW(cell, FS, c === 0)) }
    return Math.max(w, Math.ceil(m + 2 * cpad))
  })
  const cx = []; let acc = x0; for (const w of cw) { cx.push(acc); acc += w }
  const right = acc, W = right + x0, H = RH * nRows + 2 * pad
  const yAt = (r) => pad + r * RH
  const ln = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="1"/>`
  let g = `<rect width="${W}" height="${H}" fill="#fff"/>`
  for (let r = 0; r <= nRows; r++) g += ln(x0, yAt(r), right, yAt(r))                 // горизонтальные
  g += ln(x0, yAt(0), x0, yAt(nRows)) + ln(right, yAt(0), right, yAt(nRows))           // внешние вертикальные
  for (let band = 0; band < nRows; band++) {                                          // внутренние — по полосам
    const di = band - (noHead ? 0 : 1)
    if (di >= 0 && isSpanRow(rows[di])) continue                                      // подзаголовок — без разделителя
    let vx = x0
    for (let c = 0; c < cw.length - 1; c++) { vx += cw[c]; g += ln(vx, yAt(band), vx, yAt(band + 1)) }
  }
  const cellC = (r, c, tx, b) => `<text x="${cx[c] + cw[c] / 2}" y="${yAt(r) + RH / 2 + 4}" font-size="${FS}" text-anchor="middle" fill="#111"${b ? ' font-weight="600"' : ""}>${tx}</text>`
  const cellSpan = (r, tx) => `<text x="${x0 + 8}" y="${yAt(r) + RH / 2 + 4}" font-size="${FS}" text-anchor="start" fill="#111" font-weight="600">${tx}</text>`
  if (!noHead) headers.forEach((tx, c) => { g += cellC(0, c, tx, true) })
  rows.forEach((row, r) => { const band = r + (noHead ? 0 : 1); if (isSpanRow(row)) g += cellSpan(band, row[0]); else row.forEach((tx, c) => { g += cellC(band, c, tx, c === 0) }) })
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`
}

function genWasher() {
  for (let i = 0; i < 200; i++) {
    const models = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К"].map((m) => ({
      m, type: pick(["вертикальная", "фронтальная"]), cap: pick([4, 5, 6, 7]),
      price: randInt(18, 33) * 1000, conn: pick([1000, 1500, 2000, 2300]), deliv: pick([0, 0, 5, 10, 15]),
      hgt: pick([80, 85, 90]), wid: 60, dep: pick([40, 42, 44, 45, 50]),
    }))
    const filters = [
      { txt: "с вертикальной загрузкой, высота которой не превышает 85 см", ok: (x) => x.type === "вертикальная" && x.hgt <= 85 },
      { txt: "с вертикальной загрузкой вместимостью не менее 6 кг", ok: (x) => x.type === "вертикальная" && x.cap >= 6 },
      { txt: "с фронтальной загрузкой вместимостью не менее 6 кг", ok: (x) => x.type === "фронтальная" && x.cap >= 6 },
      { txt: "с фронтальной загрузкой, глубина которой не превышает 42 см", ok: (x) => x.type === "фронтальная" && x.dep <= 42 },
    ]
    const f = pick(filters), match = models.filter(f.ok)
    if (!match.length) continue
    const total = (x) => x.price + x.conn + Math.round(x.price * x.deliv / 100)
    return { models, filter: f.txt, answer: Math.min(...match.map(total)) }
  }
  return null
}

function genInternet() {
  const T = pick([600, 650, 700, 800, 850, 1000])
  const plans = ["«Мини»", "«Стандарт»", "«Максимум»"].map((name) => ({
    name, fee: randInt(4, 9) * 100, inc: pick([300, 400, 500, 700]), over: pick([1, 2, 3]),
  }))
  const cost = (p) => p.fee + Math.max(0, T - p.inc) * p.over
  return { T, plans, answer: Math.min(...plans.map(cost)) }
}

function q5Washer() {
  const w = genWasher()
  const rows = w.models.map((x) => [x.m, String(x.cap), x.type, String(x.price), String(x.conn), x.deliv === 0 ? "бесплатно" : `${x.deliv}%`, `${x.hgt}×${x.wid}×${x.dep}`])
  return {
    condition_text:
      `В квартире планируется установить стиральную машину. Характеристики машин, стоимость подключения и ` +
      `доставки приведены в таблице (доставка — процент от стоимости машины). Планируется купить стиральную ` +
      `машину ${w.filter}. Сколько рублей будет стоить наиболее дешёвый подходящий вариант вместе с ` +
      `подключением и доставкой?`,
    answer: String(w.answer),
    image_url: svgToDataUrl(renderTable(
      ["Модель", "Вмести­мость, кг", "Тип загрузки", "Стоимость, руб", "Подключение, руб", "Доставка", "Габариты (В×Ш×Г), см"],
      rows, [58, 98, 96, 96, 104, 78, 128])),
  }
}
function q5Internet() {
  const n = genInternet()
  const rows = n.plans.map((p) => [p.name, String(p.fee), String(p.inc), String(p.over)])
  return {
    condition_text:
      `В квартире планируется подключить интернет. Провайдер предлагает три тарифных плана (см. таблицу): ` +
      `абонентская плата включает указанный объём трафика, за каждый мегабайт сверх лимита взимается отдельная ` +
      `плата. Предполагается, что трафик составит ${n.T} Мб в месяц. Сколько рублей нужно будет заплатить за ` +
      `месяц по самому дешёвому подходящему тарифу?`,
    answer: String(n.answer),
    image_url: svgToDataUrl(renderTable(
      ["Тарифный план", "Абонентская плата, руб", "Входит в плату, Мб", "Сверх лимита, руб/Мб"],
      rows, [130, 150, 140, 150])),
  }
}

// Собирает модуль «квартира»: план + 5 вопросов (№1 соответствие, №5 таблица), №2–4 из пула.
function mApartment() {
  const a = genApt()
  const { rooms } = a
  const cells = (r) => r.w * r.h
  const roomArea = (r) => cells(r) * APT_A
  const byKey = (k) => rooms.find((r) => r.key === k)

  const intro =
    `На рисунке изображён план двухкомнатной квартиры (сторона одной клетки на плане равна 0,4 м; ` +
    `условные обозначения двери и окна приведены справа). Вход в квартиру находится в коридоре. Слева от ` +
    `входа находится санузел, а в противоположном конце коридора — дверь в кладовую. Рядом с кладовой ` +
    `находится спальня, из которой можно пройти на застеклённую лоджию. Самое большое по площади помещение — ` +
    `гостиная, откуда можно попасть в коридор и на кухню. Из кухни также можно попасть на застеклённую лоджию.`

  const askable = rooms.filter((r) => !r.loggia)
  const four = shuffle(askable).slice(0, 4)
  const q1 = {
    number: 1,
    condition_text:
      `Пользуясь описанием, определите, какими цифрами на плане обозначены следующие помещения. ` +
      `Помещения: ${four.map((r) => r.name).join(", ")}. ` +
      `В ответе запишите четыре цифры без пробелов и запятых в том же порядке, в каком помещения даны в списке.`,
    answer: four.map((r) => r.n).join(""),
  }

  // №2 — паркет/плитка на пол комнаты (или обеих лоджий)
  const piece = pick([
    { nom: "Паркетная доска", gen: "паркетной доски", dim: "20 см × 80 см", area: 0.16 },
    { nom: "Паркетная доска", gen: "паркетной доски", dim: "20 см × 40 см", area: 0.08 },
    { nom: "Плитка для пола", gen: "плитки", dim: "40 см × 40 см", area: 0.16 },
  ])
  const bothLog = { prep: "на обеих лоджиях", cells: cells(byKey("logK")) + cells(byKey("logS")) }
  const target = pick([...askable.map((r) => ({ prep: r.prep, cells: cells(r) })), bothLog])
  const pieces = Math.round(target.cells * APT_A / piece.area)
  const packSize = pick([8, 10, 12, 14])
  const q2 = {
    number: 2,
    condition_text:
      `${piece.nom} размером ${piece.dim} продаётся в упаковках по ${packSize} штук. ` +
      `Сколько упаковок ${piece.gen} понадобилось, чтобы выложить пол ${target.prep}?`,
    answer: String(Math.ceil(pieces / packSize)),
  }

  // №3 — площадь помещения (десятичная)
  const oArea = pick(rooms.filter((r) => !r.loggia || Math.random() < 0.3))
  const q3 = { number: 3, condition_text: `Найдите площадь ${oArea.gen}. Ответ дайте в квадратных метрах.`, answer: decA(roomArea(oArea)) }

  // №4 — на сколько % площадь A больше площади B (A>B)
  let [rA, rB] = shuffle(rooms).slice(0, 2)
  if (cells(rA) === cells(rB)) [rA, rB] = [byKey("living"), byKey("bath")]
  if (cells(rA) < cells(rB)) [rA, rB] = [rB, rA]
  const q4 = {
    number: 4,
    condition_text: `На сколько процентов площадь ${rA.gen} больше площади ${rB.gen}? Ответ округлите до целого.`,
    answer: String(Math.round((cells(rA) - cells(rB)) / cells(rB) * 100)),
  }

  const q5 = { number: 5, ...(pick([q5Washer, q5Internet])()) }

  return { scenario: "apartment", intro, image_url: svgToDataUrl(renderApt(a)), tasks: [q1, q2, q3, q4, q5] }
}

// ── Сценарий «Листы бумаги» ──────────────────────────────────────────────────
// Без плана: таблица размеров листов + текст (форматы A0–A6; площадь A0 = 1 м²;
// разрез пополам → следующий формат; отношение сторон √2, все листы подобны).
// Эталон — math100 «Листы бумаги» I–IV. №1 соответствие форматов↔номерам,
// №2 сколько листов Аm из Аk (2^разн.), №3 площадь, №4 длина/ширина или отношение
// сторон, №5 масса пачки или размер шрифта. Формулы сверены с ключом ответов ФИПИ.
const A_LONG = [1189, 841, 594, 420, 297, 210, 148, 105]   // A0..A7 бо́льшая сторона, мм
const A_SHORT = [841, 594, 420, 297, 210, 148, 105, 74]    // ме́ньшая сторона, мм
const r10 = (x) => Math.round(x / 10) * 10

// Поясняющий рисунок (как у ФИПИ): А0, разрезанный пополам (пунктир + ножницы) на два
// А1, левая половина рекурсивно поделена на А2…А5. Иллюстративный, размеры условные.
function renderFold() {
  const W = 300, H = 210, m = 16, top = 22
  const x = m, y = top, w = W - 2 * m, h = H - top - m, cx = x + w / 2
  const dash = 'stroke="#333" stroke-width="1" stroke-dasharray="5 4"'
  let g = `<rect width="${W}" height="${H}" fill="#fff"/>`
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#111" stroke-width="1.5"/>`
  // весь лист — это А0: крупная полупрозрачная подпись на фоне (под остальным)
  g += `<text x="${cx}" y="${y + h / 2 + 32}" font-size="96" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle" fill="#000" opacity="0.09">А0</text>`
  g += `<line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + h}" ${dash}/>`                      // центр: A1 | A1
  g += `<line x1="${x}" y1="${y + h / 2}" x2="${cx}" y2="${y + h / 2}" ${dash}/>`            // левая: A2 снизу
  g += `<line x1="${x + w / 4}" y1="${y}" x2="${x + w / 4}" y2="${y + h / 2}" ${dash}/>`     // верх-лево: A3
  g += `<line x1="${x}" y1="${y + h / 4}" x2="${x + w / 4}" y2="${y + h / 4}" ${dash}/>`     // A4 / A5
  const lab = (a, b, t, fs) => `<text x="${a}" y="${b + fs / 3}" font-size="${fs}" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle" fill="#1a1a1a">${t}</text>`
  g += lab(x + 3 * w / 4, y + h / 2, "А1", 30) + lab(x + w / 4, y + 3 * h / 4, "А2", 22) +
    lab(x + 3 * w / 8, y + h / 4, "А3", 15) + lab(x + w / 8, y + 3 * h / 8, "А4", 11) + lab(x + w / 8, y + h / 8, "А5", 10)
  // ножницы на линии разреза сверху
  const sy = y - 8
  g += `<circle cx="${cx - 5}" cy="${sy - 2}" r="3" fill="none" stroke="#111" stroke-width="1.2"/><circle cx="${cx + 5}" cy="${sy - 2}" r="3" fill="none" stroke="#111" stroke-width="1.2"/>` +
    `<line x1="${cx - 5}" y1="${sy + 1}" x2="${cx + 5}" y2="${sy + 9}" stroke="#111" stroke-width="1.2"/><line x1="${cx + 5}" y1="${sy + 1}" x2="${cx - 5}" y2="${sy + 9}" stroke="#111" stroke-width="1.2"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`
}

function mPaper() {
  const formats = pick([[2, 3, 5, 6], [2, 3, 4, 6], [0, 1, 2, 4], [0, 2, 3, 5], [1, 3, 4, 5], [0, 1, 3, 6]])
  const sheets = shuffle(formats)                          // лист (i+1) имеет формат sheets[i]
  const rows = [["Размеры листа, мм", ...sheets.map((f) => `${A_SHORT[f]} × ${A_LONG[f]}`)]]
  const fmtList = formats.map((f) => "А" + f).join(", ")
  const table = svgToDataUrl(renderTable(["Номер листа", "1", "2", "3", "4"], rows, [150, 92, 92, 92, 92]))
  const q1 = {
    number: 1,
    condition_text:
      `В таблице даны размеры (с точностью до мм) четырёх листов форматов ${fmtList}. ` +
      `Установите соответствие между форматами и номерами листов. В ответе укажите номера листов, ` +
      `соответствующие форматам ${fmtList} (именно в этом порядке).`,
    answer: formats.map((f) => sheets.indexOf(f) + 1).join(""),
    image_url: table,
  }
  const k2 = randInt(0, 4), m2 = k2 + randInt(1, 3)
  const q2 = { condition_text: `Сколько листов формата А${m2} получится из одного листа формата А${k2}?`, answer: String(2 ** (m2 - k2)) }

  const mkArea = () => { const k = randInt(0, 6); return { condition_text: `Найдите площадь листа формата А${k}. Ответ дайте в квадратных сантиметрах.`, answer: decA(10000 / 2 ** k) } }
  const mkDim = () => { const k = randInt(0, 6), long = pick([true, false]); return { condition_text: `Найдите ${long ? "длину" : "ширину"} листа формата А${k}. Ответ дайте в миллиметрах и округлите до ближайшего целого числа, кратного 10.`, answer: String(r10(long ? A_LONG[k] : A_SHORT[k])) } }
  const mkRatio = () => { const k = randInt(1, 5), big = pick([true, false]); return { condition_text: `Найдите отношение длины ${big ? "большей стороны листа формата А" + k + " к меньшей" : "меньшей стороны листа формата А" + k + " к большей"}. Ответ округлите до десятых.`, answer: decA(Math.round((big ? Math.SQRT2 : 1 / Math.SQRT2) * 10) / 10) } }
  const mkMass = () => {
    let k, N, M, mass
    do { k = randInt(1, 5); N = pick([80, 100, 200, 250, 500]); M = pick([80, 120, 160, 200]); mass = N * M / 2 ** k } while (!Number.isInteger(mass))
    return { condition_text: `Бумагу формата А${k} упаковали в пачки по ${N} листов. Найдите массу пачки, если масса бумаги площади 1 кв. м равна ${M} г. Ответ дайте в граммах.`, answer: String(mass) }
  }
  const mkFont = () => {
    let src, tgt; do { src = randInt(3, 5); tgt = randInt(2, 6) } while (tgt === src)
    const h = pick([12, 14, 15, 16, 18])
    return { condition_text: `Размер (высота) типографского шрифта измеряется в пунктах. Какой высоты (в пунктах) нужен шрифт, чтобы текст был расположен на листе формата А${tgt} так же, как этот же текст, напечатанный шрифтом высотой ${h} пунктов на листе формата А${src}? Размер шрифта округлите до целого.`, answer: String(Math.round(h * 2 ** ((src - tgt) / 2))) }
  }
  const s3 = pick([mkArea, mkDim])()
  const s4 = /длину|ширину/.test(s3.condition_text) ? mkRatio() : pick([mkDim, mkRatio])()
  const s5 = pick([mkMass, mkFont])()

  const intro =
    `Форматы листов бумаги обозначают буквой А и цифрой: А0, А1, А2 и так далее. Лист формата А0 — ` +
    `прямоугольник площадью 1 кв. м. Если лист А0 разрезать пополам параллельно меньшей стороне, ` +
    `получаются два равных листа формата А1; лист А1 так же — два листа А2, и так далее. Отношение ` +
    `большей стороны к меньшей у листов каждого формата одно и то же, поэтому все листы подобны.`
  return { scenario: "paper", intro, image_url: svgToDataUrl(renderFold()), tasks: [q1, { number: 2, ...q2 }, { number: 3, ...s3 }, { number: 4, ...s4 }, { number: 5, ...s5 }] }
}

// ── Сценарий «Печь для бани» ─────────────────────────────────────────────────
// Парное отделение (L×W×H) + таблица 3 печей (тип/объём/масса/стоимость). Эталон —
// math100 «Печь для бани» I–II. №1 соответствие масс или стоимостей↔номерам (3 цифры),
// №2 объём или площадь пола, №3 на сколько дровяная (подходящая по объёму) дешевле/
// дороже электрической (с/без установки), №4 скидка 10% на дровяную печь массой X,
// №5 радиус арки кожуха R=√((ширина/2)²+высота²) по чертежу (пифагорова тройка).
const ARCH_TRIPLES = [[15, 20, 25], [20, 15, 25], [25, 60, 65], [30, 40, 50], [40, 30, 50], [10, 24, 26], [24, 10, 26], [20, 21, 29], [45, 60, 75], [16, 30, 34], [30, 16, 34], [21, 20, 29]]

// Чертёж по образцу ФИПИ «Рис. 2»: тонкий внешний прямоугольник (заготовка), внутри снизу —
// штрихованный кожух с аркой сверху и белой «дверцей топки». Радиус R — из середины низа
// в верхний угол. Геометрия ОДИНАКОВАЯ для всех вариантов; числами подписываем реальные
// высоту (h), ширину (2·hw) и букву R (без «пляшущего» размера от варианта к варианту).
function renderArch(hw, h) {
  const W = 360, H = 250, cx = 120, yB = 200
  const hwp = 58, shp = 80, xL = cx - hwp, xR = cx + hwp, yS = yB - shp
  const Rp = Math.hypot(hwp, shp), yTop = 62
  const F = (n) => n.toFixed(1)
  let g = `<rect width="${W}" height="${H}" fill="#fff"/>`
  g += `<defs><pattern id="ah" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#9a9a9a" stroke-width="0.8"/></pattern></defs>`
  // тонкий внешний прямоугольник (заготовка), выше арки
  g += `<path d="M${xL},${yB} L${xL},${yTop} L${xR},${yTop} L${xR},${yB}" fill="none" stroke="#111" stroke-width="1"/>`
  // кожух: прямая часть высотой shp + арка сверху (штриховка, жирный контур)
  g += `<path d="M${xL},${yB} L${xL},${yS} A${F(Rp)} ${F(Rp)} 0 0 1 ${xR},${yS} L${xR},${yB} Z" fill="url(#ah)" stroke="#111" stroke-width="1.8"/>`
  // дверца топки — белый прямоугольник у низа по центру
  const dw = 50, dh = 46, dx = cx - dw / 2, dy = yB - dh
  g += `<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" fill="#fff" stroke="#111" stroke-width="1.3"/>`
  // радиус R: линия из середины низа в верхний левый угол; подпись сбоку от линии (+ белый ореол)
  g += `<line x1="${cx}" y1="${yB}" x2="${xL}" y2="${yS}" stroke="#111" stroke-width="1"/>`
  const t = 0.72, lpx = cx + (xL - cx) * t, lpy = yB + (yS - yB) * t
  g += `<circle cx="${F(lpx + 11)}" cy="${F(lpy - 4)}" r="8" fill="#fff"/><text x="${F(lpx + 11)}" y="${F(lpy)}" font-size="14" font-style="italic" text-anchor="middle" fill="#111">R</text>`
  // размер высоты h (левая вертикальная линия со стрелками — по прямой части кожуха)
  const dlx = xL - 14
  g += `<line x1="${dlx}" y1="${yB}" x2="${dlx}" y2="${yS}" stroke="#111" stroke-width="0.8"/><line x1="${dlx - 3}" y1="${yB}" x2="${dlx + 3}" y2="${yB}" stroke="#111" stroke-width="0.8"/><line x1="${dlx - 3}" y1="${yS}" x2="${dlx + 3}" y2="${yS}" stroke="#111" stroke-width="0.8"/><text x="${dlx - 6}" y="${F((yB + yS) / 2 + 4)}" font-size="12" text-anchor="end" fill="#111">${h}</text>`
  // размер ширины 2·hw (нижняя линия со стрелками)
  const dby = yB + 16
  g += `<line x1="${xL}" y1="${dby}" x2="${xR}" y2="${dby}" stroke="#111" stroke-width="0.8"/><line x1="${xL}" y1="${dby - 3}" x2="${xL}" y2="${dby + 3}" stroke="#111" stroke-width="0.8"/><line x1="${xR}" y1="${dby - 3}" x2="${xR}" y2="${dby + 3}" stroke="#111" stroke-width="0.8"/><text x="${cx}" y="${dby + 14}" font-size="12" text-anchor="middle" fill="#111">${2 * hw}</text>`
  // выносные подписи справа
  g += `<line x1="${F(cx + hwp * 0.55)}" y1="${F(yB - Rp * 0.97)}" x2="212" y2="98" stroke="#111" stroke-width="0.8"/><text x="216" y="102" font-size="12" fill="#111">арка кожуха</text>`
  g += `<line x1="${dx + dw}" y1="${dy + 16}" x2="212" y2="172" stroke="#111" stroke-width="0.8"/><text x="216" y="176" font-size="12" fill="#111">дверца топки</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`
}

function mStove() {
  const L = pick([3, 3.5, 4]), Wm = pick([2, 2.2, 2.5]), Hm = 2
  const V = Math.round(L * Wm * Hm * 10) / 10, floorA = Math.round(L * Wm * 10) / 10
  const install = pick([5500, 6000, 6500, 7000])
  const elPrice = pick([13000, 13500, 14000, 15000, 16000])
  const fV = Math.floor(V), cV = Math.ceil(V)
  const drFit = { type: "дровяная", lo: fV - pick([3, 4]), hi: cV + pick([0, 1]), mass: pick([46, 48, 50, 55]), price: elPrice + pick([3000, 3500, 4000, 4500]) }
  const drNoFit = { type: "дровяная", lo: fV - pick([6, 7]), hi: fV - pick([2, 3]), mass: pick([36, 40, 42, 44]), price: elPrice + pick([1500, 2000, 2500]) }
  const el = { type: "электрическая", lo: fV - pick([5, 6]), hi: cV === V ? cV : V + 0.5, mass: pick([12, 14, 15, 18]), price: elPrice }
  const pechi = shuffle([drFit, drNoFit, el]); pechi.forEach((p, i) => { p.n = i + 1 })
  const rng = (p) => `${p.lo}—${p.hi}`.replace(/\./g, ",")
  const table = svgToDataUrl(renderTable(
    ["Номер печи", "Тип", "Объём помещения, м³", "Масса, кг", "Стоимость, руб"],
    pechi.map((p) => [String(p.n), p.type, rng(p), String(p.mass), String(p.price)]), [86, 108, 130, 74, 100]))

  const byMass = pick([true, false])
  const key = byMass ? "mass" : "price"
  const sorted = [...pechi].sort((a, b) => a[key] - b[key])
  const q1 = {
    number: 1,
    condition_text:
      `Установите соответствие между ${byMass ? "массами" : "стоимостями"} и номерами печей. ` +
      `В ответе укажите номера печей, соответствующие ${byMass ? "массам" : "стоимостям"} ` +
      `${sorted.map((p) => p[key]).join(", ")} ${byMass ? "кг" : "руб"} (именно в этом порядке).`,
    answer: sorted.map((p) => p.n).join(""),
  }
  const q2 = pick([
    { condition_text: `Найдите объём парного отделения строящейся бани. Ответ дайте в кубических метрах.`, answer: decA(V) },
    { condition_text: `Найдите площадь пола парного отделения строящейся бани. Ответ дайте в квадратных метрах.`, answer: decA(floorA) },
  ])
  const a3 = el.price + install - drFit.price, b3 = drFit.price - el.price
  const q3 = pick([
    { condition_text: `На сколько рублей покупка дровяной печи, подходящей по объёму парного отделения, обойдётся дешевле электрической с учётом установки?`, answer: String(a3) },
    { condition_text: `На сколько рублей покупка дровяной печи, подходящей по объёму парного отделения, обойдётся дороже электрической без учёта установки?`, answer: String(b3) },
  ])
  const dr = pick([drFit, drNoFit])
  const q4 = { condition_text: `На дровяную печь, масса которой ${dr.mass} кг, сделали скидку 10%. Сколько рублей стала стоить печь?`, answer: String(dr.price * 0.9) }
  const [hw, h, R] = pick(ARCH_TRIPLES)
  const q5 = {
    condition_text:
      `Хозяин выбрал дровяную печь. Она снабжена кожухом вокруг дверцы топки; верхняя часть кожуха — ` +
      `арка по дуге окружности с центром в середине нижней части кожуха. Размеры кожуха (в см) показаны ` +
      `на рисунке. Найдите радиус R закругления арки в сантиметрах.`,
    answer: String(R), image_url: svgToDataUrl(renderArch(hw, h)),
  }
  const intro =
    `Хозяин дачного участка строит баню с парным отделением. Парное отделение имеет размеры: длина ` +
    `${decA(L)} м, ширина ${decA(Wm)} м, высота ${decA(Hm)} м. Окон нет, для доступа внутрь — дверь ` +
    `шириной 60 см и высотой 1,8 м. Для прогрева можно использовать электрическую или дровяную печь ` +
    `(характеристики трёх печей приведены в таблице). Установка дровяной печи не требует дополнительных ` +
    `затрат; установка электрической потребует подведения кабеля за ${install} руб.`
  return { scenario: "stove", intro, image_url: table, tasks: [q1, { number: 2, ...q2 }, { number: 3, ...q3 }, { number: 4, ...q4 }, { number: 5, ...q5 }] }
}

// ── Сценарий «Тарифы» ────────────────────────────────────────────────────────
// График: минуты (сплошная) и ГБ (пунктир) по 12 месяцам, двойная ось (100 мин = 1 ГБ),
// лимит 300 мин / 3 ГБ. Тариф «Стандартный»: 350 руб + 300 мин + 3 ГБ + 120 SMS; сверх:
// 3 руб/мин, 90 руб/0,5 ГБ, 2 руб/SMS (SMS 110/год — бесплатно). Эталон — math100
// «Тарифы» I–VI. №1 соответствие месяцев↔трафику/минутам, №2 расходы за месяц, №3 счётчик
// превышений/минимум, №4 проценты, №5 смена тарифа или домашний интернет (3 плана).
const M_PREP = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"]
const M_INSTR = ["январём", "февралём", "мартом", "апрелем", "маем", "июнем", "июлем", "августом", "сентябрём", "октябрём", "ноябрём", "декабрём"]
const costStd = (mn, g) => 350 + Math.max(0, mn - 300) * 3 + Math.ceil(Math.max(0, g - 3) / 0.5) * 90
const costNew = (mn, g) => 440 + Math.max(0, mn - 400) * 4 + Math.ceil(Math.max(0, g - 4) / 0.5) * 180

function renderChart(mins, gb) {
  const W = 470, H = 310, L = 52, R = 52, T = 34, B = 34
  const pw = W - L - R, ph = H - T - B, n = 12
  const x = (i) => L + ((i + 0.5) / n) * pw
  const y = (v) => T + ph - (v / 400) * ph
  let g = `<rect width="${W}" height="${H}" fill="#fff"/>`
  for (let v = 0; v <= 400; v += 50) {
    if (v !== 300) g += `<line x1="${L}" y1="${y(v).toFixed(1)}" x2="${L + pw}" y2="${y(v).toFixed(1)}" stroke="#ccc" stroke-width="1"/>`
    g += `<text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" font-size="11" text-anchor="end" fill="#111">${v}</text>`
    g += `<text x="${L + pw + 6}" y="${(y(v) + 4).toFixed(1)}" font-size="11" fill="#111">${String(v / 100).replace(".", ",")}</text>`
  }
  g += `<line x1="${L}" y1="${y(300)}" x2="${L + pw}" y2="${y(300)}" stroke="#111" stroke-width="1.8"/>`
  for (let i = 0; i < n; i++) {
    g += `<line x1="${x(i).toFixed(1)}" y1="${T}" x2="${x(i).toFixed(1)}" y2="${T + ph}" stroke="#eee" stroke-width="1"/>`
    g += `<text x="${x(i).toFixed(1)}" y="${T + ph + 16}" font-size="11" text-anchor="middle" fill="#111">${i + 1}</text>`
  }
  g += `<line x1="${L}" y1="${T}" x2="${L}" y2="${T + ph}" stroke="#111" stroke-width="1.4"/><line x1="${L + pw}" y1="${T}" x2="${L + pw}" y2="${T + ph}" stroke="#111" stroke-width="1.4"/><line x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}" stroke="#111" stroke-width="1.4"/>`
  g += `<path d="M${L},${T} l-3,7 l6,0 z" fill="#111"/><path d="M${L + pw},${T} l-3,7 l6,0 z" fill="#111"/>`
  g += `<text x="${L - 30}" y="${T - 12}" font-size="12" font-weight="700" fill="#111">минуты</text><text x="${L + pw}" y="${T - 12}" font-size="12" font-weight="700" text-anchor="end" fill="#111">гигабайты</text>`
  const poly = (arr, sc) => arr.map((v, i) => `${x(i).toFixed(1)},${y(v * sc).toFixed(1)}`).join(" ")
  g += `<polyline points="${poly(mins, 1)}" fill="none" stroke="#111" stroke-width="2"/>`
  mins.forEach((v, i) => { g += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.3" fill="#111"/>` })
  g += `<polyline points="${poly(gb, 100)}" fill="none" stroke="#111" stroke-width="1.3" stroke-dasharray="4 3"/>`
  gb.forEach((v, i) => { g += `<circle cx="${x(i).toFixed(1)}" cy="${y(v * 100).toFixed(1)}" r="3" fill="#111"/>` })
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`
}

function mTariff() {
  let mins, gb, uniq
  for (let t = 0; t < 200; t++) {
    mins = Array.from({ length: 12 }, () => 25 * randInt(4, 16))       // 100..400, кратно 25
    gb = Array.from({ length: 12 }, () => 0.25 * randInt(4, 16))       // 1..4, кратно 0,25
    const cntG = {}; gb.forEach((v) => { cntG[v] = (cntG[v] || 0) + 1 })
    uniq = [...Array(12).keys()].filter((i) => cntG[gb[i]] === 1)      // месяцы с уникальным ГБ
    const over = gb.filter((v) => v > 3).length, under = gb.filter((v) => v <= 3).length
    if (uniq.length >= 4 && over >= 2 && under >= 2 && mins.some((v) => v > 300) && mins.some((v) => v <= 300)) break
  }
  const chart = svgToDataUrl(renderChart(mins, gb))
  // Таблица «сверх пакета» — отдельным изображением; в карточке идёт сразу под текстом условия.
  // Без строки-заголовка (как в ФИПИ): само пояснение уже есть в тексте условия.
  const stdTable = svgToDataUrl(renderTable([], [
    ["Исходящие вызовы", "3 руб./мин."],
    ["Мобильный интернет (пакет)", "90 руб. за 0,5 ГБ"],
    ["SMS", "2 руб./шт."],
  ], [252, 150], true))

  // №1 — соответствие месяцев трафику (4 уникальных значения ГБ)
  const chosen = shuffle(uniq).slice(0, 4).sort((a, b) => gb[a] - gb[b])
  const q1 = {
    number: 1,
    condition_text:
      `Определите, какие месяцы 2019 года соответствуют указанному в таблице трафику мобильного интернета. ` +
      `Заполните таблицу: в ответ перенесите числа, соответствующие номерам месяцев, без пробелов, запятых ` +
      `и других дополнительных символов (например, для месяцев май, январь, ноябрь, август нужно записать число 51118).`,
    answer: chosen.map((i) => i + 1).join(""),
    // Таблица «значение трафика → номер месяца» (нижняя строка пустая — её заполняет ученик),
    // чтобы соотносить было удобно, как в оригинале ФИПИ.
    image_url: svgToDataUrl(renderTable(
      ["Мобильный интернет", ...chosen.map((i) => decA(gb[i]) + " ГБ")],
      [["Номер месяца", "", "", "", ""]],
      [150, 68, 68, 68, 68])),
  }
  // №2 — расходы за месяц
  const m2 = randInt(0, 11)
  const q2 = { number: 2, condition_text: `Сколько рублей потратил абонент на услуги связи в ${M_PREP[m2]}?`, answer: String(costStd(mins[m2], gb[m2])) }
  // №3 — счётчик/минимум
  const q3opts = [
    { condition_text: `Сколько месяцев в 2019 году абонент превысил лимит по пакету мобильного интернета?`, answer: String(gb.filter((v) => v > 3).length) },
    { condition_text: `Сколько месяцев в 2019 году абонент превысил лимит по пакету минут?`, answer: String(mins.filter((v) => v > 300).length) },
    { condition_text: `Сколько месяцев в 2019 году абонент не превышал лимит ни по пакету минут, ни по пакету интернета?`, answer: String(mins.filter((v, i) => v <= 300 && gb[i] <= 3).length) },
    { condition_text: `Сколько месяцев в 2019 году расходы по тарифу составили ровно 350 рублей?`, answer: String(mins.filter((v, i) => costStd(v, gb[i]) === 350).length) },
    { condition_text: `Какое наименьшее количество минут исходящих вызовов за месяц было в 2019 году?`, answer: String(Math.min(...mins)) },
    { condition_text: `Какой наименьший трафик мобильного интернета в гигабайтах за месяц был в 2019 году?`, answer: decA(Math.min(...gb)) },
  ].filter((q) => +q.answer.replace(",", ".") > 0)
  const q3 = { number: 3, ...pick(q3opts) }
  // №4 — проценты
  const q4opts = []
  for (let i = 0; i < 11; i++) {
    if (gb[i + 1] > gb[i]) { const p = (gb[i + 1] - gb[i]) / gb[i] * 100; if (Number.isInteger(p)) q4opts.push({ condition_text: `На сколько процентов увеличился трафик мобильного интернета в ${M_PREP[i + 1]} по сравнению с ${M_INSTR[i]}?`, answer: String(p) }) }
  }
  const v2018 = pick([200, 250, 280, 175, 300])
  if (Number.isInteger((350 - v2018) / v2018 * 100)) q4opts.push({ condition_text: `Известно, что в 2018 году абонентская плата по тарифу «Стандартный» составляла ${v2018} рублей. На сколько процентов выросла абонентская плата в 2019 году по сравнению с 2018 годом?`, answer: String(Math.round((350 - v2018) / v2018 * 100)) })
  const newFee = pick([420, 455, 490, 560])
  q4opts.push({ condition_text: `В январе 2020 года абонентская плата по тарифу «Стандартный» повысилась и составила ${newFee} рублей. На сколько процентов повысилась абонентская плата?`, answer: String(Math.round((newFee - 350) / 350 * 100)) })
  const q4 = { number: 4, ...pick(q4opts) }
  // №5 — смена тарифа ИЛИ домашний интернет
  let q5
  if (pick([true, false])) {
    const actual = mins.reduce((s, v, i) => s + costStd(v, gb[i]), 0)
    const nw = mins.reduce((s, v, i) => s + costNew(v, gb[i]), 0)
    q5 = {
      number: 5,
      condition_text:
        `В конце 2019 года оператор связи предложил абоненту перейти на новый тариф, условия которого ` +
        `приведены в таблице. Абонент решает, перейти ли ему на новый тариф, посчитав, сколько бы он ` +
        `потратил на услуги связи за 2019 год, если бы пользовался им. Если получится меньше, чем он ` +
        `потратил фактически за 2019 год, то абонент примет решение сменить тариф. Перейдёт ли абонент ` +
        `на новый тариф? В ответе запишите ежемесячную абонентскую плату по тарифу, который выберет ` +
        `абонент на 2020 год. (* Исходящие вызовы — на номера, зарегистрированные на территории РФ.)`,
      answer: String(nw < actual ? 440 : 350),
      // Структура как в прототипе ФИПИ: без строки-заголовка, с подзаголовками-разделителями
      // «включены пакеты» / «после расходования пакетов». SMS 110/год < 120 → доплата 0 (ответ не меняет).
      image_url: svgToDataUrl(renderTable([], [
        ["Стоимость перехода на тариф", "0 руб."],
        ["Абонентская плата в месяц", "440 руб."],
        ["В абонентскую плату включены пакеты:"],
        ["пакет исходящих вызовов", "400 минут"],
        ["пакет мобильного интернета", "4 ГБ"],
        ["пакет SMS", "120 SMS"],
        ["После расходования пакетов:"],
        ["входящие вызовы", "0 руб./мин."],
        ["исходящие вызовы*", "4 руб./мин."],
        ["мобильный интернет (пакет)", "180 руб. за 0,5 ГБ"],
        ["SMS", "2 руб./шт."],
      ], [252, 150], true)),
    }
  } else {
    const Tr = pick([500, 600, 700, 800, 850, 1000])
    const plans = ["«Омега-100»", "«Омега-350»", "«Омега-700»"].map((name) => ({ name, fee: randInt(3, 8) * 100, inc: pick([300, 500, 700]), over: pick([1, 2, 3]) }))
    const cost = (p) => p.fee + Math.max(0, Tr - p.inc) * p.over
    q5 = {
      number: 5,
      condition_text:
        `Помимо мобильного интернета, абонент использует домашний интернет от провайдера «Омега» (три тарифных ` +
        `плана в таблице). Абонент предполагает, что трафик составит ${Tr} Мб в месяц, и выбирает самый дешёвый ` +
        `план. Сколько рублей он заплатит за месяц, если трафик действительно будет равен ${Tr} Мб?`,
      answer: String(Math.min(...plans.map(cost))),
      image_url: svgToDataUrl(renderTable(["Тарифный план", "Абон. плата, руб", "Входит, Мб", "Сверх, руб/Мб"],
        plans.map((p) => [p.name, String(p.fee), String(p.inc), String(p.over)]), [120, 120, 100, 110])),
    }
  }
  const intro =
    `На графике точками показано количество минут исходящих вызовов (сплошная линия) и трафик мобильного ` +
    `интернета в гигабайтах (пунктирная линия) за каждый месяц 2019 года (левая шкала — минуты, правая — ГБ). ` +
    `В течение года абонент пользовался тарифом «Стандартный», абонентская плата по которому составляла ` +
    `350 рублей в месяц. При условии нахождения абонента на территории РФ в абонентскую плату тарифа ` +
    `«Стандартный» входит:\n` +
    `• пакет из 300 минут исходящих вызовов на номера, зарегистрированные на территории РФ;\n` +
    `• пакет из 3 ГБ мобильного интернета;\n` +
    `• пакет из 120 SMS в месяц;\n` +
    `• безлимитные бесплатные входящие вызовы.\n` +
    `Стоимость минут, интернета и SMS сверх пакета тарифа указана в таблице. Абонент не пользовался услугами ` +
    `связи в роуминге. За весь год абонент отправил 110 SMS.`
  return { scenario: "tariff", intro, image_url: chart, image_url2: stdTable, tasks: [q1, q2, q3, q4, q5] }
}

// ── Сценарий «Шины» ──────────────────────────────────────────────────────────
// Маркировка B/H Rd: B — ширина (мм), H% — высота боковины в % от B (H=B·H%/100 мм),
// d — диаметр диска (дюймы, 1″=25,4 мм). Диаметр колеса D=d·25,4+2H. Эталон — math100
// «Шины» I–XII. №1 макс. ширина для диаметра диска (по таблице), №2 высота боковины,
// №3 Δ диаметра при замене, №4 диаметр заводского колеса, №5 % изменения пробега за оборот.
const tireH = (B, a) => B * a / 100
const tireD = (B, a, d) => d * 25.4 + 2 * tireH(B, a)
const r1 = (x) => Math.round(x * 10) / 10

// Таблица разрешённых размеров шин с ДВУХУРОВНЕВОЙ шапкой (как в ФИПИ): «Ширина шины (мм)»
// на всю высоту шапки | «Диаметр диска (дюймы)» над числами 16/17/18. В ячейках — одна или
// несколько маркировок.
function renderTireTable(diams, rows) {
  const x0 = 6, RH = 28, pad = 6, cw0 = 156, cwd = 116
  const cols = [cw0, cwd, cwd, cwd]
  const cx = []; let acc = x0; for (const w of cols) { cx.push(acc); acc += w }
  const right = acc, W = right + x0
  const yA = pad, yB = pad + RH, yD = pad + 2 * RH, H = yD + rows.length * RH + pad
  const ln = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="1"/>`
  let g = `<rect width="${W}" height="${H}" fill="#fff"/>`
  g += ln(x0, yA, right, yA) + ln(cx[1], yB, right, yB) + ln(x0, yD, right, yD)   // горизонтальные шапки
  for (let r = 1; r <= rows.length; r++) g += ln(x0, yD + r * RH, right, yD + r * RH)
  g += ln(x0, yA, x0, H - pad) + ln(cx[1], yA, cx[1], H - pad) + ln(right, yA, right, H - pad)  // внешние + после «ширины»
  for (let c = 2; c < cols.length; c++) g += ln(cx[c], yB, cx[c], H - pad)          // между диаметрами (от yB вниз)
  const T = (x, y, t, b) => `<text x="${x}" y="${y}" font-size="12" text-anchor="middle" fill="#111"${b ? ' font-weight="600"' : ""}>${t}</text>`
  g += T(cx[0] + cw0 / 2, (yA + yD) / 2 + 4, "Ширина шины (мм)", true)
  g += T((cx[1] + right) / 2, yA + RH / 2 + 4, "Диаметр диска (дюймы)", true)
  diams.forEach((d, j) => { g += T(cx[j + 1] + cwd / 2, yB + RH / 2 + 4, String(d), true) })
  rows.forEach((row, r) => { const y = yD + r * RH + RH / 2 + 4; row.forEach((tx, c) => { g += T(cx[c] + cols[c] / 2, y, tx, c === 0) }) })
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`
}

function mTires() {
  const Bf = pick([195, 205, 215, 225, 235]), Hf = pick([55, 60, 65, 70]), df = pick([15, 16, 17])
  const Dfact = tireD(Bf, Hf, df)
  // таблица разрешённых размеров: 3 ширины × 3 диаметра
  const W0 = pick([195, 205, 215]), widths = [W0, W0 + 10, W0 + 20]
  const d0 = pick([15, 16, 17]), diams = [d0, d0 + 1, d0 + 2]
  const allow = [[0, 1], [0, 2], [1, 2]]               // строка i разрешена для диаметров j∈диапазон
  const cell = (i, j) => {                             // «—» если не разрешено; иначе 1–2 маркировки
    if (!(j >= allow[i][0] && j <= allow[i][1])) return "—"
    return shuffle([50, 55, 60, 65]).slice(0, pick([1, 1, 1, 2])).sort((a, b) => b - a).map((a) => `${widths[i]}/${a}`).join("; ")
  }
  const table = svgToDataUrl(renderTireTable(diams, widths.map((w, i) => [String(w), cell(i, 0), cell(i, 1), cell(i, 2)])))
  const qj = randInt(0, 2)                             // спрашиваемый диаметр (столбец)
  const maxW = Math.max(...widths.filter((_, i) => qj >= allow[i][0] && qj <= allow[i][1]))
  const q1 = {
    number: 1,
    condition_text:
      `Завод допускает установку шин с другими маркировками. В таблице показаны разрешённые размеры шин. ` +
      `Шины какой наибольшей ширины можно устанавливать на автомобиль, если диаметр диска равен ${diams[qj]} ` +
      `дюймам? Ответ дайте в миллиметрах.`,
    answer: String(maxW),
    image_url: table,
  }
  const q2mk = { B: pick([185, 195, 205, 215, 225, 235, 245, 255, 265, 275]), a: pick([45, 50, 55, 60, 65, 70]), d: pick([15, 16, 17, 18]) }
  const q2 = { number: 2, condition_text: `Сколько миллиметров составляет высота боковины шины, имеющей маркировку ${q2mk.B}/${q2mk.a} R${q2mk.d}?`, answer: decA(tireH(q2mk.B, q2mk.a)) }
  const bigger = () => { for (let i = 0; i < 100; i++) { const m = { B: pick([185, 195, 205, 215, 225, 235, 245, 255, 265, 275]), a: pick([45, 50, 55, 60, 65, 70]), d: pick([df, df + 1, df + 2]) }; const dd = r1(tireD(m.B, m.a, m.d) - Dfact); if (dd > 0 && dd <= 40) return { m, dd } } return { m: { B: Bf + 20, a: Hf, d: df + 1 }, dd: r1(tireD(Bf + 20, Hf, df + 1) - Dfact) } }
  const b3 = bigger()
  const q3 = { number: 3, condition_text: `На сколько миллиметров увеличится диаметр колеса, если заменить заводские колёса (${Bf}/${Hf} R${df}) колёсами с шинами маркировки ${b3.m.B}/${b3.m.a} R${b3.m.d}?`, answer: decA(b3.dd) }
  const q4 = { number: 4, condition_text: `Найдите диаметр колеса автомобиля, выходящего с завода (шины ${Bf}/${Hf} R${df}). Ответ дайте в миллиметрах.`, answer: decA(r1(Dfact)) }
  let b5 = null
  for (let i = 0; i < 200 && !b5; i++) { const m = { B: pick([185, 195, 205, 215, 225, 235, 245, 255, 265, 275]), a: pick([45, 50, 55, 60, 65, 70]), d: pick([df, df + 1, df + 2]) }; const p = r1((tireD(m.B, m.a, m.d) - Dfact) / Dfact * 100); if (p >= 0.1 && p <= 8) b5 = { m, p } }
  if (!b5) { const m = { B: Bf + 20, a: Hf, d: df + 1 }; b5 = { m, p: r1((tireD(m.B, m.a, m.d) - Dfact) / Dfact * 100) } }
  const q5 = { number: 5, condition_text: `На сколько процентов увеличится пробег автомобиля при одном обороте колеса, если заменить заводские колёса (${Bf}/${Hf} R${df}) колёсами с шинами маркировки ${b5.m.B}/${b5.m.a} R${b5.m.d}? Результат округлите до десятых.`, answer: decA(b5.p) }
  // Текст ФИПИ. intro — до рисунков, introRest — после (рисунки идут между ними, как в оригинале).
  const intro =
    `Прочитайте внимательно текст и выполните задания.\n` +
    `Автомобильное колесо, как правило, представляет из себя металлический диск с установленной на него ` +
    `резиновой шиной. Диаметр диска совпадает с диаметром внутреннего отверстия в шине.`
  const introRest =
    `Для маркировки автомобильных шин применяется единая система обозначений. Например, 195/65 R15 (рис. 1). ` +
    `Первое число (число 195 в приведённом примере) обозначает ширину шины в миллиметрах (параметр B на ` +
    `рисунке 2). Второе число (число 65 в приведённом примере) — процентное отношение высоты боковины ` +
    `(параметр H на рисунке 2) к ширине шины, то есть 100·H/B.\n` +
    `Последующая буква обозначает тип конструкции шины. В данном примере буква R означает, что шина ` +
    `радиальная, то есть нити каркаса в боковине шины расположены вдоль радиусов колеса. На всех легковых ` +
    `автомобилях применяются шины радиальной конструкции.\n` +
    `За обозначением типа конструкции шины идёт число, указывающее диаметр диска колеса d в дюймах ` +
    `(в одном дюйме 25,4 мм). Таким образом, общий диаметр колеса D легко найти, зная диаметр диска и высоту боковины.\n` +
    `Возможны дополнительные маркировки, обозначающие допустимую нагрузку на шину, сезонность использования, ` +
    `тип дорожного покрытия и другие параметры.\n` +
    `Завод производит легковые автомобили определённой модели и устанавливает на них колёса с шинами ` +
    `маркировки ${Bf}/${Hf} R${df}.`
  return { scenario: "tires", intro, introRest, image_url: "/tire-fig1.png", image_url2: "/tire-fig2.png", tasks: [q1, q2, q3, q4, q5] }
}

// ── Сценарий «План местности» ─────────────────────────────────────────────────
// 4 пункта: старт M, промежуточная V, угловая P, финиш Z. Шоссе M→V→P прямое, в P
// поворот 90° → P→Z. Лесная дорожка M→Z и тропинка V→Z — гипотенузы прямоугольных
// треугольников с прямым углом в P (пифагоровы тройки → целые расстояния; при
// масштабе клетки 3 км расстояния и времена остаются целыми, т.к. 60/18·3 = 10).
// Оформления: «Масловка» (шоссе по левому краю, поворот направо, 20/15 км/ч, продукты),
// «Лягушкино» (по нижнему краю, поворот налево, 25/15 км/ч, спортивные товары),
// «Васильевка» (по верхнему краю, поворот направо вниз, 25/18 км/ч, клетка 3 км,
// ярмарка). Эталон — math100/ФИПИ «План местности». №1 соответствие,
// №2 путь по шоссе, №3 расстояние по прямой, №4 время в пути, №5 таблица цен
// в 4 магазинах (дешевейший набор).
const TERRAIN_CFG = [
  { PZ: 12, MP: 16, MZ: 20, VP: 9, VZ: 15 },   // 16²+12²=20², 9²+12²=15²
  { PZ: 12, MP: 16, MZ: 20, VP: 5, VZ: 13 },   // 16²+12²=20², 5²+12²=13²
  { PZ: 8, MP: 15, MZ: 17, VP: 6, VZ: 10 },    // 15²+8²=17², 6²+8²=10²
  { PZ: 12, MP: 9, MZ: 15, VP: 5, VZ: 13 },    // 9²+12²=15², 5²+12²=13²
]
// склонение «деревня/село X»: родительный, винительный, предложный
const tGen = (n) => n.replace(/^деревня /, "деревни ").replace(/^село /, "села ")
const tAcc = (n) => n.replace(/^деревня /, "деревню ")
const tLoc = (n) => n.replace(/^деревня /, "деревне ").replace(/^село /, "селе ")

// Оформления: имена пунктов, герои, скорости (v1 — шоссе, v2 — дорожка/тропинка),
// масштаб клетки в км, раскладка плана и ассортимент магазина для №5. Раскладки:
// "left" — шоссе по левому краю вниз, поворот направо; "bottom" — по нижнему краю,
// поворот налево вверх; "top" — по верхнему краю, поворот направо вниз. Товар без
// unit подставляется в текст счётной формой pauc («2 волейбольных мяча»), с unit —
// как «2 л молока». cfgs — необязательное ограничение на индексы TERRAIN_CFG
// (при клетке 3 км большие конфигурации дают неправдоподобные расстояния).
const T_FRAMINGS = [
  {
    layout: "left", v1: 20, v2: 15, scale: 1, turn: "направо", who: "Саша с дедушкой",
    name: { M: "деревня Масловка", V: "деревня Вёсенка", P: "деревня Полянка", Z: "село Захарово" },
    introStart: `Саша летом отдыхает у дедушки в деревне Масловка. В субботу они собираются съездить на велосипедах в село Захарово в магазин.`,
    q5what: "некоторых продуктов", q5col: "Наименование продукта",
    prods: [
      { name: "Молоко (1 л)", unit: "л", gen: "молока", lo: 40, hi: 55, buy: true },
      { name: "Хлеб (1 батон)", lo: 20, hi: 35, buy: false },
      { name: "Сыр «Российский» (1 кг)", unit: "кг", gen: "сыра «Российский»", lo: 250, hi: 320, buy: true },
      { name: "Говядина (1 кг)", unit: "кг", gen: "говядины", lo: 340, hi: 420, buy: true },
      { name: "Картофель (1 кг)", unit: "кг", gen: "картофеля", lo: 22, hi: 40, buy: true },
    ],
  },
  {
    layout: "bottom", v1: 25, v2: 15, scale: 1, turn: "налево", who: "Никита с папой",
    name: { M: "деревня Лягушкино", V: "деревня Куровка", P: "деревня Марусино", Z: "село Вятское" },
    introStart: `Никита и папа летом живут в деревне Лягушкино. В субботу они собираются съездить на велосипедах в село Вятское в спортивный магазин.`,
    q5what: "некоторых спортивных товаров", q5col: "Наименование товара",
    prods: [
      { name: "Мяч волейбольный (1 шт.)", pauc: "волейбольных мяча", lo: 600, hi: 900, buy: true },
      { name: "Насос для мячей (1 шт.)", lo: 250, hi: 400, buy: false },
      { name: "Скакалка (1 шт.)", pauc: "скакалки", lo: 150, hi: 260, buy: true },
      { name: "Эспандер кистевой (1 шт.)", pauc: "эспандера", lo: 180, hi: 320, buy: true },
      { name: "Гантель виниловая (1 шт.)", pauc: "виниловые гантели", lo: 350, hi: 520, buy: true },
    ],
  },
  {
    layout: "top", v1: 25, v2: 18, scale: 3, turn: "направо", who: "Дима с дедушкой", cfgs: [2, 3],
    name: { M: "деревня Васильевка", V: "деревня Шарковка", P: "деревня Рассвет", Z: "село Плодородное" },
    introStart: `Дима летом отдыхает у дедушки в деревне Васильевка. Во вторник они собираются съездить на велосипедах в село Плодородное на ярмарку.`,
    q5what: "некоторых товаров", q5col: "Наименование товара",
    prods: [
      { name: "Мёд цветочный (1 кг)", unit: "кг", gen: "цветочного мёда", lo: 500, hi: 700, buy: true },
      { name: "Яблоки (1 кг)", unit: "кг", gen: "яблок", lo: 60, hi: 110, buy: true },
      { name: "Грабли (1 шт.)", lo: 250, hi: 400, buy: false },
      { name: "Саженец смородины (1 шт.)", pauc: "саженца смородины", lo: 200, hi: 350, buy: true },
      { name: "Картофель семенной (1 кг)", unit: "кг", gen: "семенного картофеля", lo: 35, hi: 60, buy: true },
    ],
  },
]

function renderTerrain(t) {
  const { PZ, MP, VP, dig, layout, scale } = t
  const vert = layout === "left"
  const S = 20, MG = 24, LEG = vert ? 74 : 10
  const gw = vert ? PZ + 2 : MP + 2, gh = vert ? MP + 2 : PZ + 3
  const W = MG + gw * S + LEG, H = MG + gh * S + 10
  const X = (i) => MG + i * S, Y = (j) => MG + j * S
  let pM, pV, pP, pZ
  if (layout === "left") {          // шоссе по левому краю снизу вверх, P→Z вправо
    pP = [1, 1]; pZ = [1 + PZ, 1]; pM = [1, 1 + MP]; pV = [1, 1 + VP]
  } else if (layout === "bottom") { // шоссе по нижнему краю вправо, P→Z вверх
    const by = 1 + PZ
    pM = [1, by]; pV = [1 + MP - VP, by]; pP = [1 + MP, by]; pZ = [1 + MP, 1]
  } else {                          // "top": шоссе по верхнему краю вправо, P→Z вниз
    pM = [1, 1]; pV = [1 + MP - VP, 1]; pP = [1 + MP, 1]; pZ = [1 + MP, 1 + PZ]
  }
  const cx = (p) => X(p[0]), cy = (p) => Y(p[1])
  let g = `<rect width="${W}" height="${H}" fill="#fff"/>`
  for (let i = 0; i <= gw; i++) g += `<line x1="${X(i)}" y1="${MG}" x2="${X(i)}" y2="${MG + gh * S}" stroke="#d0d0d0" stroke-width="1"/>`
  for (let j = 0; j <= gh; j++) g += `<line x1="${MG}" y1="${Y(j)}" x2="${MG + gw * S}" y2="${Y(j)}" stroke="#d0d0d0" stroke-width="1"/>`
  // шоссе M→V→P→Z (сплошная дорога)
  g += `<polyline points="${cx(pM)},${cy(pM)} ${cx(pP)},${cy(pP)} ${cx(pZ)},${cy(pZ)}" fill="none" stroke="#111" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`
  // лесная дорожка M→Z и тропинка V→Z (пунктир)
  g += `<line x1="${cx(pM)}" y1="${cy(pM)}" x2="${cx(pZ)}" y2="${cy(pZ)}" stroke="#111" stroke-width="1.4" stroke-dasharray="5 4"/>`
  g += `<line x1="${cx(pV)}" y1="${cy(pV)}" x2="${cx(pZ)}" y2="${cy(pZ)}" stroke="#111" stroke-width="1.4" stroke-dasharray="5 4"/>`
  // пруд у середины тропинки (смещение вбок от пунктира — тропинка идёт «мимо пруда»)
  const mx = (cx(pV) + cx(pZ)) / 2, my = (cy(pV) + cy(pZ)) / 2
  g += layout === "bottom" ? pondImg(mx + 14, my + 10, 50)
    : layout === "top" ? pondImg(mx + 18, my - 8, 50)
    : pondImg(mx + 12, my - 6, 50)
  // масштаб: в вертикальной раскладке — на правом поле, в горизонтальных — внутри
  // свободного угла сетки (bottom — левый верхний, top — левый нижний)
  const scaleBar = (sx, sy, below) =>
    `<line x1="${sx}" y1="${sy}" x2="${sx + S}" y2="${sy}" stroke="#111" stroke-width="1.4"/><line x1="${sx}" y1="${sy - 4}" x2="${sx}" y2="${sy + 4}" stroke="#111" stroke-width="1.4"/><line x1="${sx + S}" y1="${sy - 4}" x2="${sx + S}" y2="${sy + 4}" stroke="#111" stroke-width="1.4"/>` +
    (below
      ? `<text x="${sx + S / 2}" y="${sy + 18}" font-size="12" text-anchor="middle" fill="#111">${scale} км</text>`
      : `<text x="${sx + S + 5}" y="${sy + 4}" font-size="12" fill="#111">${scale} км</text>`)
  if (layout === "bottom") g += scaleBar(X(3), Y(2), true)
  else if (layout === "top") g += scaleBar(X(2), Y(gh - 3), true)
  else g += scaleBar(MG + gw * S + 12, MG + 44, false)
  // пины (маркер над точкой)
  const pin = (p, n) => { const x = cx(p), y = cy(p), c = y - 19, r = 11; return `<polygon points="${x - 5},${c + 8} ${x + 5},${c + 8} ${x},${y}" fill="#fff" stroke="#111" stroke-width="1.4"/><circle cx="${x}" cy="${c}" r="${r}" fill="#fff" stroke="#111" stroke-width="1.6"/><text x="${x}" y="${c + 5}" font-size="14" font-weight="700" text-anchor="middle" fill="#111">${n}</text>` }
  g += pin(pP, dig.P) + pin(pZ, dig.Z) + pin(pM, dig.M) + pin(pV, dig.V)
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`
}

function mTerrain() {
  const F = pick(T_FRAMINGS)
  const N = F.name
  const cfg = pick(F.cfgs ? F.cfgs.map((i) => TERRAIN_CFG[i]) : TERRAIN_CFG)
  const { PZ, MP, MZ, VP, VZ } = cfg, MV = MP - VP
  const km = (d) => d * F.scale // конфигурации заданы в клетках, расстояния — в км
  const dig = {}; shuffle([1, 2, 3, 4]).forEach((n, i) => { dig[["M", "V", "P", "Z"][i]] = n })
  const intro =
    `${F.introStart} Из ${tGen(N.M)} в ${tAcc(N.Z)} можно проехать по прямой лесной дорожке. ` +
    `Есть более длинный путь: по прямолинейному шоссе через ${tAcc(N.V)} до ${tGen(N.P)}, где нужно ` +
    `повернуть под прямым углом ${F.turn} на другое шоссе, ведущее в ${N.Z}. Есть и третий маршрут: ` +
    `в ${tLoc(N.V)} можно свернуть на прямую тропинку в ${N.Z}, которая идёт мимо пруда. Лесная ` +
    `дорожка и тропинка образуют с шоссе прямоугольные треугольники. По шоссе ${F.who} едут со ` +
    `скоростью ${F.v1} км/ч, а по лесной дорожке и тропинке — со скоростью ${F.v2} км/ч. На плане изображено взаимное ` +
    `расположение населённых пунктов, сторона каждой клетки равна ${F.scale} км.`
  const ask = shuffle(["M", "V", "P", "Z"]).slice(0, 3)
  const q1 = {
    number: 1,
    condition_text:
      `Пользуясь описанием, определите, какими цифрами на плане обозначены населённые пункты. В ответе ` +
      `запишите три цифры, соответствующие пунктам: ${ask.map((k) => N[k]).join(", ")}, — без пробелов, ` +
      `запятых и других дополнительных символов.`,
    answer: ask.map((k) => dig[k]).join(""),
  }
  const s2 = pick(["M", "V"])
  const q2 = { number: 2, condition_text: `Сколько километров проедут ${F.who} от ${tGen(N[s2])} до ${tGen(N.Z)}, если они поедут по шоссе через ${tAcc(N.P)}?`, answer: String(km((s2 === "M" ? MP : VP) + PZ)) }
  const s3 = pick(["M", "V"])
  const q3 = { number: 3, condition_text: `Найдите расстояние от ${tGen(N[s3])} до ${tGen(N.Z)} по прямой. Ответ дайте в километрах.`, answer: String(km(s3 === "M" ? MZ : VZ)) }
  // при 25 км/ч время по шоссе целое не для всех конфигураций — нецелые варианты отбрасываем
  const q4opts = [
    { condition_text: `Сколько минут затратят на дорогу из ${tGen(N.M)} в ${tAcc(N.Z)} ${F.who}, если они поедут по прямой лесной дорожке?`, answer: (km(MZ) * 60) / F.v2 },
    { condition_text: `Сколько минут затратят на дорогу из ${tGen(N.M)} в ${tAcc(N.Z)} ${F.who}, если они поедут по шоссе до ${tGen(N.V)}, а затем свернут на прямую тропинку, которая проходит мимо пруда?`, answer: (km(MV) * 60) / F.v1 + (km(VZ) * 60) / F.v2 },
  ].filter((o) => Number.isInteger(o.answer))
  const o4 = pick(q4opts)
  const q4 = { number: 4, condition_text: o4.condition_text, answer: String(o4.answer) }
  // №5 — таблица цен в 4 магазинах, дешевейший набор
  const short = (n) => `${n.startsWith("село") ? "с." : "д."} ${n.split(" ")[1]}`
  const towns = [N.M, N.Z, N.V, N.P].map(short)
  const prods = F.prods.map((p) => ({ ...p, price: towns.map(() => randInt(p.lo, p.hi)) }))
  const setItems = shuffle(prods.filter((p) => p.buy)).slice(0, 3).map((p) => ({ p, q: pick([2, 2, 3, 4]) }))
  const total = (ti) => setItems.reduce((s, it) => s + it.q * it.p.price[ti], 0)
  const q5 = {
    number: 5,
    condition_text:
      `В таблице указана стоимость (в рублях) ${F.q5what} в четырёх магазинах, расположенных в ` +
      `${tLoc(N.M)}, ${tLoc(N.Z)}, ${tLoc(N.V)} и ${tLoc(N.P)}. ${F.who} хотят купить ` +
      `${setItems.map((it) => (it.p.unit ? `${it.q} ${it.p.unit} ${it.p.gen}` : `${it.q} ${it.p.pauc}`)).join(", ")}. В каком магазине такой набор ` +
      `будет стоить дешевле всего? В ответе запишите стоимость данного набора в этом магазине.`,
    answer: String(Math.min(...towns.map((_, ti) => total(ti)))),
    image_url: svgToDataUrl(renderTable([F.q5col, ...towns], prods.map((p) => [p.name, ...p.price.map(String)]), [186, 80, 80, 80, 80])),
  }
  return { scenario: "terrain", intro, image_url: svgToDataUrl(renderTerrain({ ...cfg, MV, dig, layout: F.layout, scale: F.scale })), tasks: [q1, q2, q3, q4, q5] }
}

// ── Сценарий «План местности (без сетки)» ─────────────────────────────────────
// Тип B (эталон math100 XXII–XXIV): БЕЗ сетки, расстояния даны в тексте. 7 пунктов, Г-образное
// шоссе + просёлочные (диагонали) образуют прямоугольные треугольники. Названия деревень, имя
// ребёнка/родственника и геометрия — РАЗНЫЕ от варианта к варианту. Геометрия задаётся тройкой
// n<m<k: верхнее плечо (км от угла) Егорка 4n, Доломино 4m, Антоновка 4k; вертикаль Жилино 3n,
// Горюново 3m, Богданово 3k. Диагонали 5n/5m/5k (наклон 4:3) всегда целые; расход бензина = 1,4·X.
// На плане, как в ФИПИ, есть и 4-я просёлочная Антоновка→Горюново («мимо пруда»): её длина
// √((4k)²+(3m)²) нецелая и в вопросах не используется — она только на плане и в тексте маршрутов.
const TW_CFG = [[2, 3, 4], [2, 3, 5], [2, 4, 5], [2, 4, 6], [3, 4, 5], [3, 4, 6], [3, 5, 6], [3, 5, 7], [2, 3, 6], [2, 5, 7], [3, 4, 7], [4, 5, 6], [4, 5, 7], [2, 4, 7], [3, 6, 7], [2, 3, 7]]
const TW_VILLAGES = ["Антоновка", "Богданово", "Ванютино", "Горюново", "Доломино", "Егорка", "Жилино", "Осиновка", "Таловка", "Ёлочки", "Сосенки", "Камышино", "Журавушка", "Дивная", "Калиновка", "Васильевка", "Лягушкино", "Куровка", "Марусино", "Пирожки", "Малиновка", "Берёзовка", "Ольховка", "Клюквино", "Ромашково", "Синицыно", "Гнездово", "Барсуково", "Лужки", "Сосновка", "Вербилки", "Кузьминки", "Дубровка", "Родники"]
const TW_KIDS = ["Таня", "Саша", "Гриша", "Володя", "Полина", "Ваня", "Дима", "Никита", "Серёжа", "Маша", "Петя", "Катя", "Оля", "Лена", "Марина", "Юра", "Коля"]
const TW_REL = [{ nom: "дедушка", gen: "дедушки", dat: "дедушке", ins: "дедушкой" }, { nom: "папа", gen: "папы", dat: "папе", ins: "папой" }]
const kidAcc = (nm) => nm.slice(0, -1) + (nm.endsWith("я") ? "ю" : "у")

function renderTerrainWhite(cfg, dig) {
  const { n, m, k } = cfg
  const W = 500, H = 266, CX = 44, CY = 40, SC = 60 / k, F = (x) => x.toFixed(1)
  const P = { Ван: [CX, CY], Ег: [CX + 4 * n * SC, CY], Дол: [CX + 4 * m * SC, CY], Ант: [CX + 240, CY], Жил: [CX, CY + 3 * n * SC], Гор: [CX, CY + 3 * m * SC], Богд: [CX, CY + 180] }
  let g = `<rect width="${W}" height="${H}" fill="#fff"/>`
  const wavyD = (x1, y1, x2, y2, amp, nn) => { const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L; let d = `M${F(x1)},${F(y1)}`; for (let i = 1; i <= nn; i++) { const mp = (i - 0.5) / nn, t = i / nn, o = amp * ((i % 2) ? 1 : -1); d += ` Q${F(x1 + dx * mp + nx * o)},${F(y1 + dy * mp + ny * o)} ${F(x1 + dx * t)},${F(y1 + dy * t)}` } return d }
  // конюшня — 3D-эмодзи коня (растровая иконка, инлайн base64); (x,y) — тот же якорь, что был у барна
  const HW = 22, HH = 27.5
  const horse = (x, y) => `<image href="${HORSE_ICON}" x="${F(x - 5)}" y="${F(y - 14)}" width="${HW}" height="${HH}"/>`
  // Река (как в эталоне ФИПИ): выходит из-за правого верхнего края, пересекает верхнее шоссе
  // (мост №1, x≈307), уходит вниз-влево поперёк просёлочных, пересекает вертикальное шоссе ниже
  // Богданово (мост №2, y≈243) и уходит за левый край. Шоссе рисуются после реки — дорога
  // перекрывает реку, а знаки моста (скобки) стоят ровно на пересечениях.
  g += `<path d="${wavyD(348, 8, 22, 260, 6, 12)}" fill="none" stroke="#3a3a3a" stroke-width="4" stroke-linecap="round"/>`
  const dash = (a, b) => `<line x1="${F(P[a][0])}" y1="${F(P[a][1])}" x2="${F(P[b][0])}" y2="${F(P[b][1])}" stroke="#111" stroke-width="1.2" stroke-dasharray="1.6 3"/>`
  // 4 просёлочные, как в ФИПИ: из Антоновки веером две (в Богданово мимо реки и в Горюново мимо
  // пруда), в Горюново сходятся две (из Антоновки и из Доломино) + Егорка→Жилино мимо конюшни
  g += dash("Ант", "Богд") + dash("Ант", "Гор") + dash("Дол", "Гор") + dash("Ег", "Жил")
  // пруд — на середине просёлочной Антоновка→Горюново (маршрут «мимо пруда»), поверх пунктира;
  // конюшня — в левом верхнем секторе у дороги Егорка→Жилино (маршрут «мимо конюшни»)
  g += pondImg(CX + 120, CY + 1.5 * m * SC, 40)
  g += horse(CX + 4 * n * SC * 0.28, CY + 1.4 * n * SC)
  const road = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="5"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="2.4"/>`
  g += road(28, 40, 332, 40) + road(44, 24, 44, 258)                   // шоссе (двойная линия), Г-образное
  // знаки моста — «скобки» по обе стороны шоссе в местах пересечения с рекой
  g += `<path d="M297,30 Q309,38 321,30 M297,50 Q309,42 321,50" stroke="#111" stroke-width="1.5" fill="none"/>`
  g += `<path d="M34,233 Q42,245 34,257 M54,233 Q46,245 54,257" stroke="#111" stroke-width="1.5" fill="none"/>`
  for (const key of Object.keys(P)) g += `<circle cx="${F(P[key][0])}" cy="${F(P[key][1])}" r="11" fill="#fff" stroke="#111" stroke-width="1.6"/><text x="${F(P[key][0])}" y="${F(P[key][1] + 5)}" font-size="14" font-weight="700" text-anchor="middle" fill="#111">${dig[key]}</text>`
  const lx = 338; let ly = 58                                          // легенда (ниже шоссе, чтобы знак «шоссе» не сливался с дорогой)
  const row = (sym, txt) => { const r = sym + `<text x="${lx + 42}" y="${ly + 4}" font-size="12" fill="#111">${txt}</text>`; ly += 27; return r }
  g += row(`<line x1="${lx}" y1="${ly - 2}" x2="${lx + 32}" y2="${ly - 2}" stroke="#111" stroke-width="4"/><line x1="${lx}" y1="${ly - 2}" x2="${lx + 32}" y2="${ly - 2}" stroke="#fff" stroke-width="1.8"/>`, "шоссе")
  g += row(`<line x1="${lx}" y1="${ly - 2}" x2="${lx + 32}" y2="${ly - 2}" stroke="#111" stroke-width="1.2" stroke-dasharray="1.6 3"/>`, "просёлочная")
  g += row(`<path d="M${lx + 4},${ly - 11} Q${lx + 16},${ly - 3} ${lx + 28},${ly - 11} M${lx + 4},${ly + 7} Q${lx + 16},${ly - 1} ${lx + 28},${ly + 7}" stroke="#111" stroke-width="1.5" fill="none"/>`, "мост")
  g += row(`<path d="${wavyD(lx, ly - 2, lx + 32, ly - 2, 3, 4)}" fill="none" stroke="#3a3a3a" stroke-width="3.5" stroke-linecap="round"/>`, "река")
  g += row(pondImg(lx + 15, ly - 2, 34), "пруд")
  g += row(horse(lx + 12, ly - 3), "конюшня")
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`
}

function mTerrainWhite() {
  const [n, m, k] = pick(TW_CFG), cfg = { n, m, k }
  const nm = shuffle(TW_VILLAGES).slice(0, 7)
  const NAME = { Ант: nm[0], Богд: nm[1], Ван: nm[2], Ег: nm[3], Дол: nm[4], Жил: nm[5], Гор: nm[6] }
  const dv = (key) => `деревни ${NAME[key]}`, dvA = (key) => `деревню ${NAME[key]}`, dvP = (key) => `деревне ${NAME[key]}`
  const kid = pick(TW_KIDS), rel = pick(TW_REL)
  const dig = { Ант: 1 }; shuffle([2, 3, 4, 5, 6, 7]).forEach((d, i) => { dig[["Ван", "Ег", "Дол", "Жил", "Гор", "Богд"][i]] = d })
  const intro =
    `На рисунке изображён план сельской местности. ${kid} на летних каникулах приезжает в гости к ${rel.dat} ` +
    `в ${dvA("Ант")} (на плане обозначена цифрой 1). В конце каникул ${rel.nom} на машине собирается отвезти ` +
    `${kidAcc(kid)} на автобусную станцию, которая находится в ${dvP("Богд")}. Из деревни ${NAME.Ант} в деревню ` +
    `${NAME.Богд} можно проехать по просёлочной дороге мимо реки. Есть другой путь — по шоссе до ${dv("Ван")}, ` +
    `где нужно повернуть под прямым углом налево на другое шоссе, ведущее в ${dvA("Богд")}. Третий маршрут ` +
    `проходит по просёлочной дороге мимо пруда до ${dv("Гор")}, где можно свернуть на шоссе до ${dv("Богд")}. ` +
    `Четвёртый маршрут пролегает по шоссе до ${dv("Дол")}, от ${dv("Дол")} до ${dv("Гор")} по просёлочной ` +
    `дороге и от ${dv("Гор")} до ${dv("Богд")} по шоссе. Ещё один маршрут проходит по шоссе до ${dv("Ег")}, ` +
    `от ${dv("Ег")} до ${dv("Жил")} по просёлочной дороге мимо конюшни и от ${dv("Жил")} до ${dv("Богд")} ` +
    `по шоссе. Шоссе и просёлочные дороги образуют прямоугольные треугольники.\n` +
    `По шоссе ${kid} с ${rel.ins} едут со скоростью 60 км/ч, а по просёлочным дорогам — со скоростью 30 км/ч. ` +
    `Расстояние от ${dv("Ант")} до ${dv("Дол")} равно ${4 * (k - m)} км, от ${dv("Дол")} до ${dv("Ег")} — ` +
    `${4 * (m - n)} км, от ${dv("Ег")} до ${dv("Ван")} — ${4 * n} км, от ${dv("Ван")} до ${dv("Жил")} — ` +
    `${3 * n} км, от ${dv("Жил")} до ${dv("Гор")} — ${3 * (m - n)} км, а от ${dv("Гор")} до ${dv("Богд")} — ${3 * (k - m)} км.`
  const ask = shuffle(["Ван", "Ег", "Дол", "Жил", "Гор", "Богд"]).slice(0, 4)
  const q1 = {
    number: 1,
    condition_text:
      `Пользуясь описанием, определите, какими цифрами на плане обозначены населённые пункты. В ответе ` +
      `запишите четыре цифры, соответствующие пунктам: ${ask.map((key) => `деревня ${NAME[key]}`).join(", ")}, — ` +
      `без пробелов, запятых и других дополнительных символов.`,
    answer: ask.map((key) => dig[key]).join(""),
  }
  const p2 = pick([
    ["Ант", "Ег", 4 * (k - n)], ["Ант", "Дол", 4 * (k - m)], ["Ант", "Ван", 4 * k], ["Дол", "Ег", 4 * (m - n)], ["Дол", "Ван", 4 * m], ["Ег", "Ван", 4 * n],
    ["Богд", "Жил", 3 * (k - n)], ["Богд", "Гор", 3 * (k - m)], ["Богд", "Ван", 3 * k], ["Гор", "Жил", 3 * (m - n)], ["Гор", "Ван", 3 * m], ["Жил", "Ван", 3 * n],
  ])
  const q2 = { number: 2, condition_text: `Найдите расстояние от ${dv(p2[0])} до ${dv(p2[1])} по шоссе. Ответ дайте в километрах.`, answer: String(p2[2]) }
  const p3 = pick([["Ант", "Богд", 5 * k], ["Дол", "Гор", 5 * m], ["Ег", "Жил", 5 * n]])
  const q3 = { number: 3, condition_text: `Найдите расстояние от ${dv(p3[0])} до ${dv(p3[1])} по прямой. Ответ дайте в километрах.`, answer: String(p3[2]) }
  const q4 = { number: 4, ...pick([
    { condition_text: `Сколько минут затратят ${kid} с ${rel.ins} на дорогу из ${dv("Ант")} в ${dvA("Богд")}, если поедут напрямик по просёлочной дороге мимо реки?`, answer: String(10 * k) },
    { condition_text: `Сколько минут затратят ${kid} с ${rel.ins} на дорогу из ${dv("Ант")} в ${dvA("Богд")}, если поедут по шоссе до ${dv("Дол")}, затем по просёлочной дороге до ${dv("Гор")} и по шоссе до ${dv("Богд")}?`, answer: String(7 * k + 3 * m) },
    { condition_text: `Сколько минут затратят ${kid} с ${rel.ins} на дорогу из ${dv("Ант")} в ${dvA("Богд")}, если поедут по шоссе до ${dv("Ег")}, затем по просёлочной дороге мимо конюшни до ${dv("Жил")} и по шоссе до ${dv("Богд")}?`, answer: String(7 * k + 3 * n) },
  ]) }
  const xf = pick([5, 6, 6.5, 7, 7.5, 8, 8.5])
  const q5 = {
    number: 5,
    condition_text:
      `На шоссе машина ${rel.gen} расходует ${decA(xf)} литра бензина на 100 км. Известно, что на путь из ` +
      `${dv("Ант")} в ${dvA("Богд")} по шоссе через ${dv("Ван")} и на путь напрямик по просёлочной дороге мимо ` +
      `реки машине необходим один и тот же объём бензина. Сколько литров бензина на 100 км машина ${rel.gen} ` +
      `расходует на просёлочных дорогах?`,
    answer: decA(1.4 * xf),
  }
  return { scenario: "terrainWhite", intro, image_url: svgToDataUrl(renderTerrainWhite(cfg, dig)), tasks: [q1, q2, q3, q4, q5] }
}

// ── Реестр модулей ────────────────────────────────────────────────────────────
// Каждый сценарий с ключом и подписью — чтобы превью показывало вкладки по типам.
const MODULES = {
  "ОГЭ": [
    { key: "plot", label: "Дачный участок", build: mPlot },
    { key: "apartment", label: "Квартира", build: mApartment },
    { key: "paper", label: "Листы бумаги", build: mPaper },
    { key: "stove", label: "Печь для бани", build: mStove },
    { key: "tariff", label: "Тарифы", build: mTariff },
    { key: "tires", label: "Шины", build: mTires },
    { key: "terrain", label: "План местности", build: mTerrain },
    { key: "terrainWhite", label: "План местности (без сетки)", build: mTerrainWhite },
  ],
}

export function hasModules(examType) {
  return !!MODULES[examType]?.length
}

// Список сценариев №1–5 (ключ + подпись) для вкладок превью.
export function moduleScenarios(examType) {
  return (MODULES[examType] || []).map((s) => ({ key: s.key, label: s.label }))
}

// Собирает один модуль №1–5. scenarioKey задаёт конкретный сценарий (для вкладок);
// без него — случайный.
export function generateModule(examType, scenarioKey) {
  const list = MODULES[examType]
  if (!list?.length) return null
  const s = scenarioKey ? list.find((x) => x.key === scenarioKey) : pick(list)
  if (!s) return null
  const m = s.build()
  if (!m) return null
  return {
    id: `mod-${m.scenario}-${Math.random().toString(36).slice(2, 10)}`,
    exam_type: examType,
    scenario: m.scenario,
    intro: m.intro,
    introRest: m.introRest || null,
    image_url: m.image_url,
    image_url2: m.image_url2 || null,
    tasks: m.tasks.map((t) => ({ ...t, generated: true })),
  }
}
