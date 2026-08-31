// Ширина строки в долях em (надстрочные ⁰¹²…⁻ уже) — для длины черты радикала.
const glyphW = (s) => { let w = 0; for (const ch of s) w += /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/.test(ch) ? 0.42 : 0.58; return w }

// Точная ширина строки в долях кегля — меряем настоящим шрифтом через canvas.
// Оценка «каждый символ ≈ 0.58 кегля» врала тем сильнее, чем длиннее подкоренное:
// у «4ˣ − 17a + 60» черта корня уезжала на 15 px правее содержимого, у «√3» — на 3 px.
// Без canvas (тесты, сборка вне браузера) возвращаемся к прежней оценке.
const measureEm = (() => {
  let ctx
  const cache = new Map()
  return (s, family) => {
    if (typeof document === "undefined") return null
    const key = family + "\u0000" + s
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    if (!ctx) ctx = document.createElement("canvas").getContext("2d")
    if (!ctx) return null
    ctx.font = `100px ${family}`
    const w = ctx.measureText(s).width / 100
    cache.set(key, w)
    return w
  }
})()

// Мерка ширины для конкретного шрифта — её ждут svgMathBody и rootGeom.
export function glyphWFor(family) {
  return (s) => {
    const str = String(s)
    const w = measureEm(str, family)
    return w == null ? glyphW(str) : w
  }
}

// ── Мини-раскладка математики ВНУТРИ SVG ─────────────────────────────────────
// Под корнем встречается не только текст: ⁵√(32^{4x−3}), √(16^{(x+3)/x}) — показатель
// ⁅…⁆, а в нём стоячая дробь ⦃n¦d⦄. Разворачивать их в HTML (<sup>, .tmath-frac) внутри
// <svg><text> НЕЛЬЗЯ: по правилам разбора foreign content парсер выбрасывает <sup> из
// SVG наружу — степень уезжала за конец черты, а сама черта считалась по служебным
// символам ⁅⁆ и торчала далеко вправо. Поэтому внутри радикала показатель и дробь
// рисуются средствами SVG (<tspan>, <text>, <line>).
// svgMathBody меряет содержимое (ширина + границы над и под базовой линией) и умеет его
// нарисовать; тем же пользуется PDF (rootSvg в variantPdf.js), поэтому цвет, шрифт и
// толщину штриха задаёт вызывающий.
const SUP_K = 0.72     // кегль показателя относительно основания
const FRAC_K = 0.86    // кегль стопки дроби
const PAREN_K = 1.8    // скобка вокруг стоячей дроби — во столько раз крупнее основания
const TOP_K = 0.78     // высота прописной над базовой линией, в долях кегля
const BOT_K = 0.24     // свес скобок/запятых под базовой линией

// Маркеры, которым в SVG нет стопочного эквивалента (индекс, стопка степень-основание,
// вложенный корень): текст для ширины и разметка тем же <tspan>, что и в PDF.
const svgFlatPlain = (s) => String(s)
  .replace(/⦉([^⦊]*)⦊/g, "$1")
  .replace(/⦅([^¦⦆]*)¦([^⦆]*)⦆/g, "$1$2")
  .replace(/√(?:\[([^\]{}]+)\])?\{([^{}]+)\}/g, (_, i, x) => `${i || ""}√${x}`)
const svgFlatMarkup = (s) => String(s)
  .replace(/⦉([^⦊]*)⦊/g, (_, x) => `<tspan baseline-shift="sub" font-size="0.75em">${x}</tspan>`)
  .replace(/⦅([^¦⦆]*)¦([^⦆]*)⦆/g, (_, a, b) =>
    `<tspan baseline-shift="super" font-size="0.7em">${a}</tspan><tspan baseline-shift="sub" font-size="0.7em">${b}</tspan>`)
  .replace(/√(?:\[([^\]{}]+)\])?\{([^{}]+)\}/g, (_, i, x) =>
    `${i ? `<tspan baseline-shift="super" font-size="0.7em">${i}</tspan>` : ""}√<tspan text-decoration="overline">${x}</tspan>`)

// Разбор содержимого на прогоны: текст, показатель ⁅…⁆ (внутри снова прогоны) и дробь ⦃n¦d⦄.
function svgRuns(src) {
  const re = /⁅([^⁆]*)⁆|⦃([^¦⦄]*)¦([^⦄]*)⦄/g   // своя копия: разбор рекурсивный, lastIndex общим быть не может
  const out = []
  let last = 0, m
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ t: "t", s: src.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ t: "s", r: svgRuns(m[1]) })
    else out.push({ t: "f", n: m[2], d: m[3] })
    last = re.lastIndex
  }
  if (last < src.length) out.push({ t: "t", s: src.slice(last) })
  return svgParens(out)
}

// Скобки вокруг стоячей дроби ((1/16)^x) вынимаем из текста в отдельный прогон: обычная
// скобка ростом с цифру рядом с двухъярусной дробью выглядит обрезанной, растянутая —
// как в ФИПИ.
function svgParens(runs) {
  const out = []
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i]
    if (r.t === "t" && r.s.endsWith("(") && runs[i + 1] && runs[i + 1].t === "f") {
      if (r.s.length > 1) out.push({ t: "t", s: r.s.slice(0, -1) })
      out.push({ t: "p", c: "(" })
    } else if (r.t === "t" && r.s.startsWith(")") && runs[i - 1] && runs[i - 1].t === "f") {
      out.push({ t: "p", c: ")" })
      if (r.s.length > 1) out.push({ t: "t", s: r.s.slice(1) })
    } else out.push(r)
  }
  return out
}

// Раскладка прогонов: координаты относительно точки (0, базовая линия).
function svgLay(runs, fs, gw) {
  const parts = []
  let x = 0, top = 0, bot = 0
  for (const r of runs) {
    if (r.t === "t") {
      parts.push({ k: "t", s: r.s, x, fs })
      x += gw(svgFlatPlain(r.s)) * fs
      top = Math.min(top, -TOP_K * fs); bot = Math.max(bot, BOT_K * fs)
    } else if (r.t === "f") {
      const f = fs * FRAC_K
      const w = Math.max(gw(svgFlatPlain(r.n)), gw(svgFlatPlain(r.d))) * f + 6
      const ay = -0.32 * fs                       // черта дроби — чуть выше базовой линии
      parts.push({ k: "f", n: r.n, d: r.d, x, w, ay, fs: f })
      top = Math.min(top, ay - 3 - TOP_K * f)
      bot = Math.max(bot, ay + 0.95 * f + BOT_K * f)
      x += w
    } else if (r.t === "p") {
      const f = fs * PAREN_K
      const dy = 0.13 * fs                        // скобка садится по центру черты дроби
      parts.push({ k: "p", c: r.c, x, dy, fs: f })
      x += 0.34 * f
      top = Math.min(top, dy - 0.75 * f); bot = Math.max(bot, dy + 0.22 * f)
    } else {
      const sub = svgLay(r.r, fs * SUP_K, gw)
      // Подъём показателя: обычный — на 0.46 кегля; если в показателе стоячая дробь
      // (√(16^{(x+3)/x})), поднимаем настолько, чтобы её низ не опускался к основанию.
      const dy = Math.min(-0.46 * fs, -0.25 * fs - sub.bot)
      parts.push({ k: "g", x, dy, sub })
      top = Math.min(top, dy + sub.top); bot = Math.max(bot, dy + sub.bot)
      x += sub.w
    }
  }
  return { w: x, top, bot, parts }
}

function svgPaint(lay, x0, y0, o) {
  const f = (v) => v.toFixed(2)
  let g = ""
  for (const p of lay.parts) {
    if (p.k === "t") {
      g += `<text xml:space="preserve" x="${f(x0 + p.x)}" y="${f(y0)}" font-size="${f(p.fs)}"${o.family ? ` font-family="${o.family}"` : ""} fill="${o.fill}">${svgFlatMarkup(p.s)}</text>`
    } else if (p.k === "p") {
      g += `<text x="${f(x0 + p.x)}" y="${f(y0 + p.dy)}" font-size="${f(p.fs)}"${o.family ? ` font-family="${o.family}"` : ""} font-weight="300" fill="${o.fill}">${p.c}</text>`
    } else if (p.k === "f") {
      const cx = x0 + p.x + p.w / 2, ay = y0 + p.ay
      const fam = o.family ? ` font-family="${o.family}"` : ""
      g += `<text xml:space="preserve" x="${f(cx)}" y="${f(ay - 3)}" font-size="${f(p.fs)}"${fam} text-anchor="middle" fill="${o.fill}">${svgFlatMarkup(p.n)}</text>` +
        `<line x1="${f(x0 + p.x + 1)}" y1="${f(ay)}" x2="${f(x0 + p.x + p.w - 1)}" y2="${f(ay)}" stroke="${o.fill}" stroke-width="${o.sw}"/>` +
        `<text xml:space="preserve" x="${f(cx)}" y="${f(ay + 0.95 * p.fs)}" font-size="${f(p.fs)}"${fam} text-anchor="middle" fill="${o.fill}">${svgFlatMarkup(p.d)}</text>`
    } else {
      g += svgPaint(p.sub, x0 + p.x, y0 + p.dy, o)
    }
  }
  return g
}

// Публичная обёртка: { w, top, bot, paint(x, y, {fill, family, sw}) } для содержимого корня.
export function svgMathBody(content, fs, gw = glyphW) {
  const lay = svgLay(svgRuns(String(content)), fs, gw)
  return { w: lay.w, top: lay.top, bot: lay.bot, paint: (x, y, o) => svgPaint(lay, x, y, o) }
}

// Геометрия радикала (общая с PDF): по границам содержимого считаем, насколько высоко
// поднять черту. by — базовая линия подкоренного, BAR — черта, hk — растяжение крючка
// (у высокого корня узкая «галочка» смотрелась бы иглой).
export function rootGeom(body, index, idxFS, gw = glyphW) {
  const BAR = 2.8
  const by = Math.max(17, Math.ceil(BAR + 2.6 - body.top))
  const H = Math.ceil(by + Math.max(4.4, body.bot + 1))
  const hk = Math.min(1.6, by / 17)
  const ox = index ? Math.ceil(gw(String(index)) * idxFS) + 1 : 0
  const tx = 13 * hk + ox
  const W = Math.ceil(tx + body.w + 2.5)
  const d = `M${(1.5 * hk + ox).toFixed(2)},${by - 4} L${(4 * hk + ox).toFixed(2)},${by - 5.5} ` +
    `L${(7.5 * hk + ox).toFixed(2)},${by + 2} L${(11.5 * hk + ox).toFixed(2)},${BAR} L${W - 1.5},${BAR}`
  return { W, H, by, ox, tx, d, idxY: by - 6.5 }
}

// Радикал одним НЕПРЕРЫВНЫМ SVG-path (знак √ + верхняя черта — единый штрих, стыка нет
// по построению). Инлайновый SVG (не <img>): stroke/fill = currentColor → адаптируется к
// тёмной теме; размер в em → масштабируется вместе со шрифтом. Геометрия совпадает с
// rootSvg в variantPdf.js (там <img> с жёстким цветом — в PDF фон всегда светлый).
// index — показатель степени корня (∛ → index="3"): цифра сидит В КРЮЧКЕ радикала
// (как у ФИПИ), а не висит высоким надстрочником слева. Радикал сдвигается вправо на ox,
// освобождая слева место под индекс.
// vertical-align задаётся инлайном (а не только классом): у корня с показателем-дробью
// картинка выше, и постоянный сдвиг посадил бы её мимо строки.
// Маркер корня, который можно класть ВНУТРЬ дроби/степени: √{X} и √[i]{X} (со степенью).
// В отличие от токенов ⟦r⟧/⟦rn⟧ не содержит «⟧» и «:», поэтому не рвёт захват ⟦f:n:d⟧.
const RE_ROOT_MARK = /√(?:\[([^\]{}]+)\])?\{([^{}]+)\}/g
function rootMarkup(content, index = "") {
  const FS = 14
  const idxFS = 10
  const body = svgMathBody(content, FS)
  const { W, H, by, ox, tx, d, idxY } = rootGeom(body, index, idxFS)
  const idx = index
    ? `<text x="${ox - 1}" y="${idxY}" font-size="${idxFS}" text-anchor="middle" fill="currentColor">${index}</text>`
    : ""
  return `<svg class="tmath-radical" style="vertical-align:-${((H - by) / FS).toFixed(3)}em" viewBox="0 0 ${W} ${H}" width="${(W / FS).toFixed(3)}em" height="${(H / FS).toFixed(3)}em" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>` +
    idx +
    body.paint(tx, by, { fill: "currentColor", sw: 1.2 }) + `</svg>`
}

// Корень НАД дробью одним SVG: знак √, верхняя черта и черта дроби — единый stroke-width
// (равная толщина всех палочек), √ не искажается. num/den/pre/post — уже экранированный текст.
function rootFracMarkup(pre, num, den, post) {
  const FS = 14, fs = 12.4, SW = 1.2
  const preW = glyphW(pre) * FS, postW = glyphW(post) * FS
  const fracW = Math.max(glyphW(num), glyphW(den)) * fs + 8
  const signW = 10, x0 = signW + 3, bar = 20
  const fcx = x0 + preW + fracW / 2
  // H = 2 × bar: черта дроби приходится ровно на центр картинки, а vertical-align:middle
  // сажает центр на матось — так корень над дробью встаёт вровень с обычными дробями.
  const W = Math.ceil(signW + preW + fracW + postW + 7), H = 2 * bar
  const d = `M0.8 24 L3.4 26 L6 36 L${signW} 2 L${W - 1} 2`   // √ + верхняя черта — единый путь
  let g = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linejoin="miter" stroke-linecap="butt"/>`
  if (pre) g += `<text x="${x0}" y="${bar + 4}" font-size="${FS}" fill="currentColor">${pre}</text>`
  g += `<text x="${fcx}" y="${bar - 3}" font-size="${fs}" text-anchor="middle" fill="currentColor">${num}</text>`
  g += `<line x1="${x0 + preW + 1}" y1="${bar}" x2="${x0 + preW + fracW - 1}" y2="${bar}" stroke="currentColor" stroke-width="${SW}"/>`
  g += `<text x="${fcx}" y="${bar + 12}" font-size="${fs}" text-anchor="middle" fill="currentColor">${den}</text>`
  if (post) g += `<text x="${x0 + preW + fracW + 1}" y="${bar + 4}" font-size="${FS}" fill="currentColor">${post}</text>`
  return `<svg class="tmath-rootfrac" viewBox="0 0 ${W} ${H}" width="${(W / FS).toFixed(3)}em" height="${(H / FS).toFixed(3)}em" xmlns="http://www.w3.org/2000/svg">${g}</svg>`
}

// ── Задания «на соответствие» (единый вид во всех предметах) ──────────────────
// Генераторы собирают токен ⟦match⟧ через matchBlock(), а рендер разворачивает его в
// компактную таблицу: левый столбец (А, Б, В…) и правый (1, 2, 3…) стоят РЯДОМ, а не
// стопкой друг под другом — так ученику проще соотносить. Ниже — сетка для ответа.
// left/right — «сырые» пункты БЕЗ меток; метки А)/1) добавляет рендер. Разделители
// ‖ (между полями) и ⁞ (между пунктами) в контенте не встречаются.
const MATCH_LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж"]
export function matchBlock({ leftHdr, rightHdr, left, right, letters }) {
  const L = (letters || MATCH_LETTERS).slice(0, left.length)
  return `⟦match⟧${leftHdr}‖${rightHdr}‖${L.join("")}‖${left.join("⁞")}‖${right.join("⁞")}⟦endmatch⟧`
}

// ── Простая таблица данных (график погашения долга в №13 ЕГЭ Профиль и т.п.) ──
// В эталоне ФИПИ график долга напечатан именно ТАБЛИЦЕЙ («Дата | 15.01 | 15.02 …»,
// «Долг (в млн руб) | 1 | 0,6 …»), а не строкой текста, — повторяем один в один.
// rows — массив строк, каждая строка массив ячеек; ПЕРВАЯ строка = шапка.
export function tableBlock(rows) {
  return `⟦tbl⟧${rows.map((r) => r.join("⁞")).join("‖")}⟦endtbl⟧`
}
function dataTableHtml(body) {
  const rows = body.split("‖").map((r) => r.split("⁞"))
  const [head, ...rest] = rows
  const th = head.map((c) => `<th>${c}</th>`).join("")
  const trs = rest.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")
  // Таблица-сетка: все ячейки короткие (фрагмент таблицы истинности, звёздочки в
  // схеме дорог). Ширина колонок по содержимому делала бы её кривой — пустой
  // столбец уже заполненного, — поэтому колонки выравниваются по одной ширине.
  const plain = (c) => c.replace(/<[^>]*>/g, "").trim()
  const cells = rows.flat().map(plain)
  const grid = cells.every((c) => c.length <= 3)
  const cls = grid ? " tmath-grid" : ""
  // Ширину сетки задаём явно (число колонок × ширина клетки): без определённой ширины
  // раскладка table-layout: fixed раздаёт остаток неравномерно и первый столбец
  // получается на пару пикселей шире.
  const style = grid ? ` style="--tmath-cols:${head.length}"` : ""
  return `<div class="tmath-tblwrap"><table class="tmath-table${cls}"${style}><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`
}

// ── Нумерованный список вариантов (задания «на последовательность» и «вставьте элементы») ──
// Раньше номер и текст стояли на РАЗНЫХ строках (`n)\nтекст`) — большие пустые отступы.
// Теперь единый компактный список: синий номер и текст в одну строку (как ключи в таблице
// соответствия). items — «сырые» пункты; нумерацию 1…n (= порядок показа) даёт рендер.
export function listBlock(items) {
  return `⟦list⟧${items.join("⁞")}⟦endlist⟧`
}
function orderedListHtml(body) {
  const items = body.split("⁞")
  return `<ol class="tmath-list">` +
    items.map((t, i) => `<li><b class="tmath-key">${i + 1})</b> ${t}</li>`).join("") +
    `</ol>`
}

// HTML-таблица соответствия. body уже ЭКРАНИРОВАН (вызывается из renderTaskMath после
// escape), внутренние мат-токены в ячейках остаются и разворачиваются следующими .replace.
function matchTableHtml(body) {
  const [lh = "", rh = "", letters = "", lRaw = "", rRaw = ""] = body.split("‖")
  const L = lRaw ? lRaw.split("⁞") : []
  const R = rRaw ? rRaw.split("⁞") : []
  const la = letters.split("")
  const rows = Math.max(L.length, R.length)
  let trs = ""
  for (let i = 0; i < rows; i++) {
    const lc = i < L.length ? `<b class="tmath-key">${la[i] || ""})</b> ${L[i]}` : ""
    const rc = i < R.length ? `<b class="tmath-key">${i + 1})</b> ${R[i]}` : ""
    trs += `<tr><td>${lc}</td><td>${rc}</td></tr>`
  }
  const ansHead = la.map((c) => `<th>${c}</th>`).join("")
  const ansBlank = la.map(() => "<td></td>").join("")
  return `<table class="tmath-match"><thead><tr><th>${lh}</th><th>${rh}</th></tr></thead><tbody>${trs}</tbody></table>` +
    `<table class="tmath-answer"><thead><tr>${ansHead}</tr></thead><tbody><tr>${ansBlank}</tr></tbody></table>`
}

// ── Формула НИКОГДА не переносится на следующую строку ───────────────────────
// Дробь, корень, скобки, стопка индексов — атомарные inline-block-боксы, а браузер
// по умолчанию разрешает перенос строки ВОКРУГ такого бокса даже там, где пробела
// нет. Из-за этого «S=v₀t−» оставалось на одной строке, а дробь at²/2 уезжала на
// следующую — формула рвалась пополам. Поэтому после разворота токенов:
//   1) каждый «кусок без пробелов», в котором есть формульная разметка, заворачивается
//      в <span class="tmath-nb"> (white-space:nowrap) — перенос внутри запрещён;
//   2) соседние ЧИСТО математические куски (без кириллицы) сшиваются через пробел,
//      если между ними стоит знак операции («x = ⟦f⟧», «⟦f⟧ + 1»), — тогда и формула
//      с пробелами вокруг «=» остаётся целиком на одной строке.
// Ограничение длины (NB_MAX_LEN) — страховка от переполнения узкой карточки на
// телефоне: слишком длинную формулу лучше перенести, чем выпустить за край экрана.
const NB_MAX_LEN = 38
const NB_VOID = /^(br|img|hr|input|col|path|line|circle|rect|ellipse|polyline|polygon|use|stop|source)$/i
// блочные (и «широкие» формульные) элементы разрывают склейку: таблица соответствия,
// список, код, система ⟦cases⟧ — сами по себе занимают строку целиком.
const NB_BLOCK = /^(table|thead|tbody|tr|td|th|div|ol|ul|li|p|br|code|pre|h[1-6])$/i
// data-cases — та же система, но в PDF-разметке (там классов нет, только инлайн-стили)
const NB_WIDE = /class="tmath-(cases|code|match|answer|table|tblwrap|list)|data-cases/
// формульная разметка: SVG-радикал, PNG-формула в PDF, индексы/степени, .tmath-* и
// inline-flex-стопки (в PDF классов нет — только инлайновые стили)
const NB_MATH = /^<(?:svg|img|sub|sup)\b|class="tmath-|inline-flex/
const NB_OP_END = /[=+\-−–—±·⋅×÷*/^<>≤≥≠≈]$/
const NB_OP_START = /^[=+\-−–—±·⋅×÷*/^<>≤≥≠≈]/
const NB_CYR = /[А-Яа-яЁё]/

// Разбор HTML на узлы ВЕРХНЕГО уровня (текст / целиком элемент со всем содержимым).
// Атрибуты нашей разметки «>» не содержат (в тексте он уже экранирован в &gt;).
function nbTopLevel(html) {
  const out = []
  const tagRe = /<(\/?)([a-zA-Z0-9]+)([^>]*)>/g
  let depth = 0, pos = 0, elStart = 0, elTag = "", m
  while ((m = tagRe.exec(html)) !== null) {
    const closing = m[1] === "/"
    const selfClosed = /\/$/.test(m[3]) || NB_VOID.test(m[2])
    if (depth === 0) {
      if (closing) continue                                  // непарный </…> — уйдёт в текст
      if (m.index > pos) out.push({ t: "text", s: html.slice(pos, m.index) })
      pos = tagRe.lastIndex
      if (selfClosed) { out.push({ t: "el", tag: m[2], s: m[0] }); continue }
      elStart = m.index; elTag = m[2]; depth = 1
      continue
    }
    if (selfClosed) continue
    depth += closing ? -1 : 1
    if (depth === 0) {
      out.push({ t: "el", tag: elTag, s: html.slice(elStart, tagRe.lastIndex) })
      pos = tagRe.lastIndex
    }
  }
  if (pos < html.length) out.push({ t: "text", s: html.slice(pos) })
  return out
}

// Приблизительная «видимая» длина куска (для NB_MAX_LEN): теги выброшены, сущности — 1 символ.
const nbPlain = (s) => s.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, "x")

export function noBreakMath(html) {
  if (!html || html.indexOf("<") < 0) return html
  // 1) режем на куски: chunk (без пробелов внутри) / пробелы / блочный элемент
  const items = []
  let cur = null
  const closeChunk = () => { if (cur) { items.push(cur); cur = null } }
  const addText = (s) => { if (!cur) cur = { t: "chunk", s: "", math: false }; cur.s += s }
  for (const n of nbTopLevel(html)) {
    if (n.t === "text") {
      for (const part of n.s.split(/(\s+)/)) {
        if (!part) continue
        if (/^\s+$/.test(part)) { closeChunk(); items.push({ t: "sp", s: part }) }
        else addText(part)
      }
    } else if (NB_BLOCK.test(n.tag) || NB_WIDE.test(n.s)) {
      closeChunk(); items.push({ t: "raw", s: n.s })
    } else {
      addText(n.s)
      if (NB_MATH.test(n.s)) cur.math = true
    }
  }
  closeChunk()
  // 2) сшиваем соседние математические куски через пробел (перенос по знаку операции)
  for (let i = 0; i + 2 < items.length; i++) {
    const a = items[i], sp = items[i + 1], b = items[i + 2]
    if (!a || a.t !== "chunk" || sp.t !== "sp" || sp.s !== " " || b.t !== "chunk") continue
    if (!a.math && !b.math) continue
    const pa = nbPlain(a.s), pb = nbPlain(b.s)
    if (NB_CYR.test(pa) || NB_CYR.test(pb)) continue
    if (!NB_OP_END.test(pa) && !NB_OP_START.test(pb)) continue
    if (pa.length + pb.length + 1 > NB_MAX_LEN) continue
    a.s += "&nbsp;" + b.s
    a.math = a.math || b.math
    items.splice(i + 1, 2)
    i = Math.max(-1, i - 3)         // назад: к куску слева мог приклеиться теперь и он («S = ⟦f⟧»)
  }
  // 3) неразрывными делаем только куски с формулой; если кусок всё же длиннее строки —
  //    отдаём его как есть (и возвращаем обычные пробелы), перенос лучше вылезания за край
  return items.map((it) =>
    it.t === "chunk" && it.math && nbPlain(it.s).length <= NB_MAX_LEN
      // инлайновый style обязателен для PDF: html2canvas не подхватывает классы
      ? `<span class="tmath-nb" style="white-space:nowrap;">${it.s}</span>`
      : it.s.replace(/&nbsp;/g, " ")
  ).join("")
}

// ── Скобки по высоте того, что обнимают ──────────────────────────────────────
// «(» и «)» — обычные глифы высотой в строку, а рядом с ними стоит дробь высотой в два
// яруса: скобка выглядит вдвое ниже своего содержимого (·(1/14 + 1/18)·). Поэтому после
// разворота токенов пары скобок (круглых и квадратных), ВНУТРИ которых оказалась дробь, заменяются на
// растянутые: SVG-дуга тянется по высоте содержимого (тем же приёмом, что фигурная
// скобка системы), preserveAspectRatio="none" + non-scaling-stroke держат штрих тонким
// при любой высоте. Скобки вокруг обычного текста и корня остаются глифами — растягивать
// там нечего, а глиф всегда красивее дуги.
const PAREN_TALL = /class="tmath-(frac|rootfrac)/
const parenSvg = (d) => '<svg class="tmath-pbr" viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true">'
  + `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.1" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg>`
// Квадратная скобка нужна не для симметрии, а для промежутков: −8/7 ≤ x ≤ 8/7 записывают
// как [−8/7; 8/7], и полуинтервал (−∞; −8/7] закрывается скобкой ДРУГОГО вида — поэтому
// пара ищется по позиции, а вид каждой стороны берётся из своего символа.
const PAREN_GLYPH = {
  "(": parenSvg("M8.2 1C3.4 24 3.4 76 8.2 99"),
  ")": parenSvg("M1.8 1C6.6 24 6.6 76 1.8 99"),
  "[": parenSvg("M8.2 1H3.2V99H8.2"),
  "]": parenSvg("M1.8 1H6.8V99H1.8"),
}
const PAREN_OPEN = "(["
const PAREN_CLOSE = ")]"
const parenGroup = (inner, l, r) =>
  `<span class="tmath-parens">${PAREN_GLYPH[l]}<span class="tmath-pbody">${inner}</span>${PAREN_GLYPH[r]}</span>`

// Конец парного </tag> (с учётом вложенности) — чтобы целиком перепрыгнуть содержимое
// <svg> и <code>: там скобки принадлежат картинке или коду, а не формуле.
function closeTagEnd(html, from, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi")
  re.lastIndex = from
  let d = 0, m
  while ((m = re.exec(html)) !== null) {
    if (m[1]) { d -= 1; if (d <= 0) return re.lastIndex }
    else if (!/\/>$/.test(m[0])) d += 1
  }
  return html.length
}

// Индекс парной «)» для скобки в позиции i или −1. Тем же пользуется PDF-рендер
// (variantPdf.js): там дробь — картинка, но пары скобок ищутся по той же логике.
// Теги пропускаются целиком, а пара принимается, только если открывающая и закрывающая
// скобки лежат на ОДНОМ уровне вложенности тегов (иначе обёртка порвала бы разметку:
// «(» в числителе дроби, «)» снаружи неё).
export function matchParen(html, i) {
  let depth = 0, par = 0
  for (let k = i; k < html.length; k++) {
    const c = html[k]
    if (c === "<") {
      const t = /^<(\/?)([a-zA-Z0-9]+)([^>]*)>/.exec(html.slice(k))
      const j = html.indexOf(">", k)
      if (j < 0) return -1
      if (t && !t[1] && /^(svg|code)$/i.test(t[2])) { k = closeTagEnd(html, k, t[2]) - 1; continue }
      if (t && !(/\/$/.test(t[3]) || NB_VOID.test(t[2]))) depth += t[1] ? -1 : 1
      if (depth < 0) return -1
      k = j
      continue
    }
    if (PAREN_OPEN.includes(c)) par += 1
    else if (PAREN_CLOSE.includes(c)) { par -= 1; if (par === 0) return depth === 0 ? k : -1 }
  }
  return -1
}

function stretchParens(html) {
  if (!/[([]/.test(html) || !PAREN_TALL.test(html)) return html
  let out = "", i = 0
  while (i < html.length) {
    const c = html[i]
    if (c === "<") {
      const t = /^<(\/?)([a-zA-Z0-9]+)/.exec(html.slice(i))
      const j = html.indexOf(">", i)
      if (j < 0) { out += html.slice(i); break }
      if (t && !t[1] && /^(svg|code)$/i.test(t[2])) {
        const end = closeTagEnd(html, i, t[2])
        out += html.slice(i, end); i = end; continue
      }
      out += html.slice(i, j + 1); i = j + 1; continue
    }
    if (PAREN_OPEN.includes(c)) {
      const j = matchParen(html, i)
      if (j > 0) {
        const inner = stretchParens(html.slice(i + 1, j))
        out += PAREN_TALL.test(inner) ? parenGroup(inner, c, html[j]) : c + inner + html[j]
        i = j + 1; continue
      }
    }
    out += c
    i += 1
  }
  return out
}

// Условие задания рендерится как HTML, чтобы дроби были СТОЛБИКОМ (не «в строчку»),
// а корень — с верхней чертой над подкоренным. Генераторы вставляют токены
// ⟦f:n:d⟧ (дробь) и ⟦r:x⟧ (корень); здесь текст сначала ЭКРАНИРУЕТСЯ (защита от XSS
// в задачах, введённых репетитором), и только потом токены разворачиваются в разметку.
export function renderTaskMath(text) {
  if (!text) return ""
  return noBreakMath(stretchParens(renderTaskMathRaw(text)))
}
function renderTaskMathRaw(text) {
  const esc = String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  // корень внутри числителя/знаменателя дроби записывается маркером √{X} (не токеном ⟦r⟧,
  // т.к. ⟦r⟧ содержит «⟧» и рвёт захват дроби) — разворачиваем его в настоящий радикал.
  // √[i]{X} — тот же маркер со степенью корня (аналог ⟦rn:i:X⟧), индекс сидит в крючке.
  const rootIn = (s) => s.replace(RE_ROOT_MARK, (_, i, x) => rootMarkup(x, i || ""))
  return esc
    // ⟦match⟧…⟦endmatch⟧ — задание «на соответствие»: два столбца РЯДОМ (таблица) +
    // сетка для ответа. Разворачиваем ПЕРВЫМ, оставляя внутри ячеек мат-токены (⟦f⟧,
    // ⟦b⟧…) — их развернут следующие .replace ниже по цепочке уже внутри таблицы.
    .replace(/⟦match⟧([\s\S]*?)⟦endmatch⟧/g, (_, body) => matchTableHtml(body))
    // ⟦tbl⟧…⟦endtbl⟧ — простая таблица данных (график погашения долга).
    .replace(/⟦tbl⟧([\s\S]*?)⟦endtbl⟧/g, (_, body) => dataTableHtml(body))
    // ⟦list⟧…⟦endlist⟧ — компактный нумерованный список вариантов (номер + текст в строку).
    .replace(/⟦list⟧([\s\S]*?)⟦endlist⟧/g, (_, body) => orderedListHtml(body))
    // ⟦code:…⟧ — моноширинный код-блок (примеры КуМира в №15 и т.п.). \n внутри станут <br>
    // ниже по цепочке, а .tmath-code (white-space:pre-wrap) сохранит ведущие отступы строк.
    .replace(/⟦code:([^⟧]*)⟧/g, (_, x) => `<code class="tmath-code">${x}</code>`)
    // ⟦rf:pre¦num¦den¦post⟧ — корень НАД дробью: знак √ с чертой, растянутой на всю
    // высоту дроби (SVG-галочка тянется по высоте flex-строки, как скобка системы).
    .replace(/⟦rf:([^⟧]*)⟧/g, (_, b) => {
      const [pre, num, den, post] = b.split("¦")
      return rootFracMarkup(pre || "", num || "", den || "", post || "")
    })
    // ⟦pf:n:d⟧ — дробь в скобках, растянутых по её высоте (основание степени: (1/4)^x).
    // Скобки отдаём голыми — их растянет общий проход stretchParens в самом конце, тот же,
    // что и для скобок, написанных в условии руками. Раскрываем ДО ⟦f⟧: содержат ⟦f⟧ внутри.
    .replace(/⟦pf:([^:⟧]+):([^:⟧]+)⟧/g,
      (_, n, d) => `(<span class="tmath-frac"><span class="tmath-num">${rootIn(n)}</span><span class="tmath-den">${rootIn(d)}</span></span>)`)
    // числитель/знаменатель — любой текст без «:» (числа, степени вида 7⁴), уже экранированный
    .replace(/⟦f:([^:⟧]+):([^:⟧]+)⟧/g,
      (_, n, d) => `<span class="tmath-frac"><span class="tmath-num">${rootIn(n)}</span><span class="tmath-den">${rootIn(d)}</span></span>`)
    // ⟦rn:i:x⟧ — корень степени i (∛ → i=3): индекс сидит в крючке радикала
    .replace(/⟦rn:([^:⟧]+):([^⟧]+)⟧/g, (_, i, x) => rootMarkup(x, i))
    .replace(/⟦r:([^⟧]+)⟧/g, (_, x) => rootMarkup(x))
    // Корень вне дроби, записанный маркером √{X} (внутри ⟦sup⟧ токен ⟦r⟧ применить нельзя —
    // он содержит «⟧»): разворачиваем в радикал, иначе фигурные скобки видны в условии.
    // Обязательно ДО ⁅⁆/⦃¦⦄ (но после ⟦f⟧, чьи ячейки не терпят «:» от разметки): иначе под
    // корень попадал уже готовый <sup>, черта считалась по его тегу и уезжала на пол-строки.
    .replace(RE_ROOT_MARK, (_, i, x) => rootMarkup(x, i || ""))
    .replace(/⟦b:([^⟧]+)⟧/g, (_, x) => `<sub class="tmath-sub">${x}</sub>`)
    // ⟦sup:x⟧ — надстрочник (степень с переменным показателем, напр. 2^(1−4x))
    .replace(/⟦sup:([^⟧]+)⟧/g, (_, x) => `<sup class="tmath-sup">${x}</sup>`)
    // ⁅x⁆ — тот же надстрочник, но БЕЗ «:» и «⟧» внутри токена, поэтому его можно класть
    // ВНУТРЬ дроби/корня (⟦f⟧/⟦r⟧ ловят содержимое до первого «⟧» и ломаются на ⟦sup⟧).
    .replace(/⁅([^⁆]*)⁆/g, (_, x) => `<sup class="tmath-sup">${x}</sup>`)
    // ⦅k¦b⦆ — степень НАД основанием логарифма стопкой, выровнены по левому краю
    // (log²₂x: двойка-степень стоит над двойкой-основанием, как в ФИПИ, а не после неё).
    .replace(/⦅([^¦⦆]*)¦([^⦆]*)⦆/g, (_, a, b) =>
      `<span class="tmath-logpow"><span>${a}</span><span>${b}</span></span>`)
    // ⦉x⦊ — нижний индекс без «:» и «⟧» (основание логарифма: log с корнем/дробью/x
    // в индексе). Разворачивается ПОСЛЕ ⟦r⟧/⟦rn⟧/⟦f⟧, поэтому внутрь можно вложить их.
    .replace(/⦉([^⦊]*)⦊/g, (_, x) => `<sub class="tmath-sub">${x}</sub>`)
    // ⦃n¦d⦄ — ВЛОЖЕННАЯ дробь: те же ⟦f⟧-стили, но без «:» и «⟧», поэтому её можно
    // положить внутрь другой дроби (log₅(x/25) в знаменателе большой дроби).
    .replace(/⦃([^¦⦄]*)¦([^⦄]*)⦄/g, (_, n, d) =>
      `<span class="tmath-frac"><span class="tmath-num">${n}</span><span class="tmath-den">${d}</span></span>`)
    // ⟦iso:A:Z:Sym⟧ — символ нуклида: массовое число A над зарядовым Z (стопкой),
    // прижаты вправо и стоят слева от символа элемента (¹⁴₇N).
    .replace(/⟦iso:([^:⟧]+):([^:⟧]+):([^⟧]+)⟧/g, (_, a, z, s) =>
      `<span class="tmath-iso"><span class="tmath-iso-nums"><span>${a}</span><span>${z}</span></span>${s}</span>`)
    // ⟦cases:строка⁞строка…⟧ — система (фигурная скобка) для кусочно-заданных функций;
    // раскрываем ПОСЛЕ дробей, чтобы внутренние ⟦f⟧ уже стали <span> (без ⟧ внутри).
    // Разделитель строк — ⁞ или ¦ (генераторы ЕГЭ №18 пишут ¦); к этому моменту все
    // токены со «своим» ¦ (⟦rf⟧, ⦃¦⦄, ⦅¦⦆) уже развёрнуты, так что путаницы нет.
    .replace(/⟦cases:([^⟧]+)⟧/g, (_, b) =>
      `<span class="tmath-cases"><svg class="tmath-brace" viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true"><path d="M9 1C5 1 5 6 5 25C5 44 4 49 1 50C4 51 5 56 5 75C5 94 5 99 9 99" fill="none" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg><span class="tmath-lines">${b.split(/[⁞¦]/).map((l) => `<span>${l}</span>`).join("")}</span></span>`)
    .replace(/\n/g, "<br>")
}

// Плоский вид тех же токенов (n/d, √x) — для узких усечённых превью, где столбик не нужен.
export function plainTaskMath(text) {
  if (!text) return ""
  return String(text)
    // ⟦match⟧ в плоском виде (для узких усечённых превью-строк): столбцы через «; ».
    .replace(/⟦match⟧([\s\S]*?)⟦endmatch⟧/g, (_, body) => {
      const [lh = "", rh = "", letters = "", lRaw = "", rRaw = ""] = body.split("‖")
      const la = letters.split("")
      const L = (lRaw ? lRaw.split("⁞") : []).map((x, i) => `${la[i] || ""}) ${x}`)
      const R = (rRaw ? rRaw.split("⁞") : []).map((x, i) => `${i + 1}) ${x}`)
      return `${lh}: ${L.join("; ")} — ${rh}: ${R.join("; ")}`
    })
    .replace(/⟦tbl⟧([\s\S]*?)⟦endtbl⟧/g, (_, body) =>
      body.split("‖").map((r) => r.split("⁞").join(" | ")).join("; "))
    .replace(/⟦list⟧([\s\S]*?)⟦endlist⟧/g, (_, body) =>
      body.split("⁞").map((t, i) => `${i + 1}) ${t}`).join("; "))
    .replace(/⟦rf:([^⟧]*)⟧/g, (_, b) => { const [pre, n, d, post] = b.split("¦"); return `√(${pre || ""}${n}/${d}${post || ""})` })
    .replace(RE_ROOT_MARK, (_, i, x) => (i ? `${i}√(${x})` : `√${x}`))
    .replace(/⟦pf:([^:⟧]+):([^:⟧]+)⟧/g, "($1/$2)")
    .replace(/⟦f:([^:⟧]+):([^:⟧]+)⟧/g, "$1/$2")
    .replace(/⟦rn:([^:⟧]+):([^⟧]+)⟧/g, (_, i, x) => `${i}√(${x})`)
    .replace(/⟦r:([^⟧]+)⟧/g, "√$1")
    .replace(/⟦b:([^⟧]+)⟧/g, "$1")
    .replace(/⟦sup:([^⟧]+)⟧/g, "^($1)")
    .replace(/⁅([^⁆]*)⁆/g, "^($1)")
    .replace(/⦃([^¦⦄]*)¦([^⦄]*)⦄/g, "$1/$2")
    .replace(/⦅([^¦⦆]*)¦([^⦆]*)⦆/g, "^$1_$2")
    .replace(/⦉([^⦊]*)⦊/g, "$1")
    .replace(/⟦iso:([^:⟧]+):([^:⟧]+):([^⟧]+)⟧/g, (_, a, z, s) =>
      a.replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]) + z.replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[+d]) + s)
    .replace(/⟦cases:([^⟧]+)⟧/g, (_, b) => b.split(/[⁞¦]/).join("; "))
}

// Разворачивает мат-токены в SVG-РАЗМЕТКУ (корень — √ с чертой над подкоренным, дробь —
// «в строчку», нижний индекс). Используется и при генерации чертежа, и для «лечения» старых
// картинок из банка, сохранённых до появления этого разворота (иначе в подписи виден «4⟦r:2⟧»).
export function expandSvgMathTokens(svg) {
  return String(svg)
    .replace(/⟦rf:([^⟧]*)⟧/g, (_, b) => { const [pre, n, d, post] = b.split("¦"); return `√(${pre || ""}${n}/${d}${post || ""})` })
    .replace(RE_ROOT_MARK, (_, i, x) => `${i ? `<tspan baseline-shift="super" font-size="0.7em">${i}</tspan>` : ""}√<tspan text-decoration="overline">${x}</tspan>`)
    .replace(/⟦pf:([^:⟧]+):([^:⟧]+)⟧/g, "($1/$2)")
    .replace(/⟦f:([^:⟧]+):([^:⟧]+)⟧/g, "$1/$2")
    .replace(/⟦r:([^⟧]+)⟧/g, (_, x) => `√<tspan text-decoration="overline">${x}</tspan>`)
    .replace(/⟦b:([^⟧]+)⟧/g, (_, x) => `<tspan baseline-shift="sub" font-size="0.75em">${x}</tspan>`)
    .replace(/⟦sup:([^⟧]+)⟧/g, (_, x) => `<tspan baseline-shift="super" font-size="0.75em">${x}</tspan>`)
    .replace(/⁅([^⁆]*)⁆/g, (_, x) => `<tspan baseline-shift="super" font-size="0.75em">${x}</tspan>`)
    .replace(/⦃([^¦⦄]*)¦([^⦄]*)⦄/g, "$1/$2")
    .replace(/⦉([^⦊]*)⦊/g, (_, x) => `<tspan baseline-shift="sub" font-size="0.75em">${x}</tspan>`)
    .replace(/⦅([^¦⦆]*)¦([^⦆]*)⦆/g, (_, a, b) =>
      `<tspan baseline-shift="super" font-size="0.7em">${a}</tspan><tspan baseline-shift="sub" font-size="0.7em">${b}</tspan>`)
    .replace(/⟦iso:([^:⟧]+):([^:⟧]+):([^⟧]+)⟧/g, (_, a, z, s) =>
      `<tspan baseline-shift="super" font-size="0.7em">${a}</tspan><tspan baseline-shift="sub" font-size="0.7em">${z}</tspan>${s}`)
}

// Нормализует уже готовый data:image/svg+xml URL задания (напр. сохранённый в банке до фикса):
// декодирует, разворачивает оставшиеся токены и кодирует обратно. Идемпотентна — если сырых
// токенов нет, возвращает URL без изменений.
export function normalizeTaskImage(url) {
  if (!url || typeof url !== "string" || !url.startsWith("data:image/svg+xml")) return url
  const comma = url.indexOf(",")
  if (comma < 0) return url
  let svg
  try { svg = decodeURIComponent(url.slice(comma + 1)) } catch { return url }
  if (!/⟦[frb]:/.test(svg)) return url
  return url.slice(0, comma + 1) + encodeURIComponent(expandSvgMathTokens(svg))
}

export function plural(n, one, few, many) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

// Превращает «плоские» степени из свободного текста (в т.ч. от ИИ-генерации ДЗ)
// в надстрочные символы Юникода: x^2 → x², a^{10} → a¹⁰, x^n → xⁿ.
// Работает над обычным текстом (не над токенами банка заданий).
const SUPERSCRIPT_MAP = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵",
  "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻",
  "=": "⁼", "(": "⁽", ")": "⁾", "n": "ⁿ", "i": "ⁱ",
}
function toSup(str) {
  return Array.from(str).map((c) => SUPERSCRIPT_MAP[c] || c).join("")
}
// Показатель целиком раскладывается в юникод? Половинчатый («x²ᵏ» вместо «x^{2k}»)
// читался бы хуже, поэтому либо все символы, либо ни одного.
const canSup = (str) => !!str && Array.from(str).every((c) => SUPERSCRIPT_MAP[c])
export function superscriptPowers(text) {
  if (!text) return text
  return text
    .replace(/\^\{([^}]*)\}/g, (_, g) => toSup(g))
    .replace(/\^(-?[0-9]+|[nix])/g, (_, g) => toSup(g))
}

// Читает сбалансированную группу {...}, начиная с позиции i (s[i] === "{").
function takeBrace(s, i) {
  if (s[i] !== "{") return null
  let depth = 0
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++
    else if (s[j] === "}") { depth--; if (depth === 0) return { content: s.slice(i + 1, j), next: j + 1 } }
  }
  return null
}

// Подстрочные символы Юникода — нужны внутри SVG-радикала, где <sub> не работает.
const SUBSCRIPT_MAP = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅",
  "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋",
  "=": "₌", "(": "₍", ")": "₎", "a": "ₐ", "e": "ₑ", "x": "ₓ",
  "n": "ₙ", "i": "ᵢ", "k": "ₖ", "m": "ₘ", "p": "ₚ", "s": "ₛ", "t": "ₜ",
}
// Индекс целиком либо уходит в юникод, либо остаётся как «_2» — половинчатый
// («log₂ₓ» vs «log_2x») читался бы хуже.
function toSub(str) {
  const chars = Array.from(str)
  const ok = (c) => SUBSCRIPT_MAP[c] || c === "." || c === ","
  return chars.every(ok)
    ? chars.map((c) => SUBSCRIPT_MAP[c] || c).join("")
    : `_${str}`
}

// Команды LaTeX → символы. Общие для HTML-рендера и для плоского текста в радикале.
function latexSymbols(s) {
  return s
    // инлайн-разделители формул \( \) \[ \] (модель иногда оборачивает ими математику)
    .replace(/\\[()[\]]/g, "")
    .replace(/\\left|\\right/g, "")
    // имена функций пишутся без слэша: \log_{2} 8 → log₂ 8. Границу проверяем
    // сами (не \b): после «\log» обычно идёт «_», а это словесный символ.
    .replace(/\\(log|lg|ln|sin|cos|tan|cot|tg|ctg|arcsin|arccos|arctan|min|max)(?![a-zA-Z])/g, "$1")
    .replace(/\\infty/g, "∞").replace(/\\pi\b/g, "π")
    .replace(/\\cup\b/g, "∪").replace(/\\cap\b/g, "∩")
    .replace(/\\in\b/g, "∈").replace(/\\notin\b/g, "∉")
    .replace(/\\varnothing\b|\\emptyset\b/g, "∅")
    .replace(/\\setminus\b/g, "\\")
    .replace(/\\ldots\b|\\dots\b/g, "…")
    .replace(/\\Rightarrow\b/g, "⇒").replace(/\\rightarrow\b|\\to\b/g, "→")
    .replace(/\\([{}])/g, "$1")
    .replace(/\\cdot/g, "·").replace(/\\times/g, "×").replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±").replace(/\\mp/g, "∓")
    .replace(/\\leq\b|\\le\b/g, "≤").replace(/\\geq\b|\\ge\b/g, "≥")
    .replace(/\\neq\b/g, "≠").replace(/\\approx\b/g, "≈")
    .replace(/\\,|\\;|\\!|\\quad/g, " ")
    .replace(/\$/g, "")
}

// Содержимое SVG-радикала рисуется элементом <text>, внутри которого разметка не
// работает — поэтому подкоренное выражение приводим к ПЛОСКОМУ тексту:
// дробь через «/», индексы и степени юникодом.
function wrapIfCompound(part) {
  return /[+\-·×÷/\s]/.test(part.trim()) ? `(${part.trim()})` : part.trim()
}

function plainMath(s) {
  let t = latexSymbols(s)
    // скобки только там, где без них меняется смысл: √((a+1)/b), но √(a/b)
    .replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, n, d) => `${wrapIfCompound(n)}/${wrapIfCompound(d)}`)
    .replace(/\\sqrt(?:\[([^\]]*)\])?\{([^{}]+)\}/g, (_, idx, x) => `${idx || ""}√(${x})`)
    .replace(/_\{([^{}]*)\}/g, (_, x) => toSub(x))
    .replace(/_([0-9A-Za-z])/g, (_, x) => toSub(x))
  t = superscriptPowers(t)
  return t.replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "")
}

// \frac{a}{b} → стоячая дробь, \sqrt{x} / \sqrt[3]{x} → радикал, x^{…}/x_{…} → над- и
// подстрочник. Скобки считаются сбалансированно, поэтому и \frac{\sqrt{2}}{2}, и
// 2^{\log_{2} 5} разбираются целиком. Вход уже экранирован.
function convFracRoot(s) {
  let out = ""
  for (let i = 0; i < s.length;) {
    if (s.startsWith("\\frac", i) || s.startsWith("\\dfrac", i)) {
      const start = i + (s.startsWith("\\dfrac", i) ? 6 : 5)
      const a = takeBrace(s, start)
      const b = a && takeBrace(s, a.next)
      if (a && b) {
        out += `<span class="tmath-frac"><span class="tmath-num">${convFracRoot(a.content)}</span><span class="tmath-den">${convFracRoot(b.content)}</span></span>`
        i = b.next
        continue
      }
    }
    if (s.startsWith("\\sqrt", i)) {
      let j = i + 5, idx = ""
      if (s[j] === "[") { const e = s.indexOf("]", j); if (e !== -1) { idx = s.slice(j + 1, e); j = e + 1 } }
      const a = takeBrace(s, j)
      if (a) { out += rootMarkup(plainMath(a.content), idx); i = a.next; continue }
    }
    if ((s[i] === "^" || s[i] === "_") && s[i + 1] === "{") {
      const a = takeBrace(s, i + 1)
      if (a) {
        // Короткий числовой показатель (x^{2}, x^{-3}, x^{n+1}) — юникодом, как и «плоский»
        // x^2 из того же текста: <sup class="tmath-sup"> задуман под ДЛИННЫЙ показатель
        // с переменной ((1/5)^{x+6}) и потому крупный и высоко поднятый — над обычным
        // квадратом он выглядит великаном, висящим над строкой.
        if (s[i] === "^" && canSup(a.content)) { out += toSup(a.content); i = a.next; continue }
        const tag = s[i] === "^" ? ["sup", "tmath-sup"] : ["sub", "tmath-sub"]
        out += `<${tag[0]} class="${tag[1]}">${convFracRoot(a.content)}</${tag[0]}>`
        i = a.next
        continue
      }
    }
    out += s[i]
    i++
  }
  return out
}

// Красивый рендер описания ДЗ (в т.ч. сгенерированного ИИ): дроби столбиком, корни с
// чертой, степени/индексы, базовые операторы LaTeX. Текст сначала ЭКРАНИРУЕТСЯ, затем
// разворачивается в разметку — вставляется через dangerouslySetInnerHTML безопасно.
export function renderHomeworkMath(text) {
  if (!text) return ""
  // Задания, собранные из банка, приходят с токенами ⟦…⟧ (дроби, корни, таблицы):
  // их разворачивает только рендерер банка. Прогонять текст через оба прохода
  // нельзя — второй портит уже готовую разметку, поэтому выбираем ветку по токену.
  if (String(text).includes("⟦")) return renderTaskMath(String(text)).replace(/\n/g, "<br>")
  let s = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  s = convFracRoot(s)
  s = latexSymbols(s)
    // корни без \ (юникод от модели): √{x}, √(x), √2, √x
    .replace(/√\{([^{}]+)\}/g, (_, x) => rootMarkup(plainMath(x)))
    .replace(/√\(([^()]+)\)/g, (_, x) => rootMarkup(plainMath(x)))
    .replace(/√\s*(-?\d+(?:[.,]\d+)?|[A-Za-zА-Яа-я])/g, (_, x) => rootMarkup(x))
    // одиночный индекс без скобок: x_1 (групповые ^{…}/_{…} уже развёрнуты выше)
    .replace(/_([0-9A-Za-zА-Яа-я])/g, (_, x) => `<sub class="tmath-sub">${x}</sub>`)
  s = superscriptPowers(s)          // оставшиеся ^2, ^n → ², ⁿ
  return noBreakMath(s.replace(/\n/g, "<br>"))
}

// Есть ли у задания банка что-то, кроме текста условия: чертёж, программа,
// архив, таблица, файл с данными, общий текст для чтения. По этому признаку
// решается, обязательна ли для работы колонка homework.bank_tasks — задание
// без приложений полностью описано текстом в description и переживёт базу без
// миграции. Рисует всё это components/TaskAttachments.jsx.
export const hasAttachment = (t) =>
  !!(t && (t.image_url || t.program || t.archive || t.spreadsheet || t.textFile || t.source_text))

// Разбивает описание ДЗ на вступление и отдельные пронумерованные задания
// («1. …», «2. …»), чтобы показать каждое своей карточкой, а не сплошным абзацем.
// Общая для кабинета ученика и карточки репетитора — иначе они расходятся видом.
export function parseHomeworkTasks(desc) {
  if (!desc) return { intro: "", tasks: [] }
  const tasks = []
  const intro = []
  let cur = null
  for (const raw of desc.split("\n")) {
    const line = raw.trim()
    const m = line.match(/^(\d+)[.)]\s+(.*)$/)
    if (m) { if (cur) tasks.push(cur); cur = { n: m[1], text: m[2] } }
    else if (cur) { if (line) cur.text += "\n" + line }
    else if (line) intro.push(line)
  }
  if (cur) tasks.push(cur)
  return { intro: intro.join("\n"), tasks }
}

// Строки описания + приложения из банка → единый список для окна.
// Счёт заданий банка должен сходиться со строками описания, иначе к заданию
// прилипнет чужой чертёж (то же условие, что и в списке разбора).
export function homeworkTaskItems(hw) {
  const { intro, tasks } = parseHomeworkTasks(hw.description || "")
  const options = Array.isArray(hw.test_options) ? hw.test_options : null
  const answers = Array.isArray(hw.correct_answers) ? hw.correct_answers : []
  const bank = Array.isArray(hw.bank_tasks) && hw.bank_tasks.length === tasks.length ? hw.bank_tasks : null
  // Ответы ученика (есть только у решённой работы) — чтобы окно показывало не
  // просто условия, а разбор: где ответ сошёлся с эталоном, а где нет.
  const given = Array.isArray(hw.student_answers) ? hw.student_answers : null
  // Фото решения ученик снимает к каждому заданию, ключ — НОМЕР задания (1..N),
  // а не индекс: так их пишет кабинет ученика (homework.solution_files).
  const shots = hw.solution_files && typeof hw.solution_files === "object" ? hw.solution_files : null
  return {
    intro,
    items: tasks.map((t, i) => {
      const n = t.n ?? i + 1
      const ans = answers[i] ?? null
      // Пустая строка — не ответ, а пропуск: показываем его прочерком, но не
      // считаем неверным ответом «—», иначе разбор врал бы про то, что ученик
      // написал.
      const raw = given ? given[i] : undefined
      const gave = raw == null || String(raw).trim() === "" ? null : String(raw)
      return {
        n,
        text: t.text,
        bankTask: bank?.[i] || null,
        answer: ans,
        options: options?.[i] || null,
        given: given ? gave : undefined,
        // Верность считаем только когда есть с чем сверять: у задания без
        // эталона (развёрнутый ответ) её ставит репетитор, а не сверка строк.
        ok: given && ans != null && ans !== "" ? answersEqual(gave ?? "", ans) : null,
        solutionUrl: shots?.[n] || shots?.[String(n)] || null,
      }
    }),
  }
}

// new Date("YYYY-MM-DD") parses as UTC midnight, which shifts a day back in
// timezones behind UTC — this constructs the date from local components instead.
export function parseLocalDate(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

// Дата платежа хранится строкой в том виде, в каком её показывают: "дд.мм.гггг"
// (toLocaleDateString("ru-RU") при записи в Payment.jsx). ISO-строки тоже
// встречаются — у платежей из ЮKassa. Разбор нужен и странице «Финансы», и
// телеграм-боту, поэтому живёт здесь, а не в одной из них.
export function parsePaymentDate(dateStr) {
  if (!dateStr) return null
  const parts = String(dateStr).split(".")
  if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0])
  return new Date(dateStr)
}

export function isLessonConducted(lesson, now = new Date()) {
  if (!lesson.date) return false
  const [y, m, d] = lesson.date.split("-").map(Number)
  const [h, min] = (lesson.time || "00:00").split(":").map(Number)
  return new Date(y, m - 1, d, h, min + (lesson.duration || 60)) < now
}

export function getInitials(name) {
  if (!name) return "?"
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}

// Единый формат телефона для показа во всём приложении: "+7 (XXX) XXX-XX-XX".
// В базе номер хранится каноничным "+7XXXXXXXXXX" — форматируем только при выводе.
// Если строка не похожа на российский номер (11 цифр с 7/8) — возвращаем как есть.
export function formatPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "")
  const body = d.length === 11 && (d[0] === "7" || d[0] === "8") ? d.slice(1)
    : d.length === 10 ? d
    : null
  if (!body) return raw || ""
  return `+7 (${body.slice(0, 3)}) ${body.slice(3, 6)}-${body.slice(6, 8)}-${body.slice(8, 10)}`
}


// Число в русском виде: округление до сотых и десятичная ЗАПЯТАЯ
// (используется в подписях чертежей интерактивной практики).
export const fmtNum = (n) =>
  String(Math.round(n * 100) / 100).replace(".", ",").replace("-", "\u2212")

// ── Сравнение ответа ученика с эталоном ──────────────────────────────────────
// Раньше ответы сравнивались строкой: «0,5» и «0.5», «−3» и «-3», «2 3» и «23»
// считались разными, и ученик терял балл за оформление, а не за математику.
//
// Осторожно: нормализация НЕ должна прощать неверный формат там, где ФИПИ
// требует конкретную запись («в ответ запишите целое число»). Поэтому здесь
// только заведомо безопасные приведения: пробелы, юникод-минусы, десятичная
// запятая, обычная дробь и порядок в перечислении. Округления «на глазок» и
// отбрасывания единиц измерения тут нет намеренно.
function normalizeAnswerPart(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    // юникод-минусы и тире → обычный дефис
    .replace(/[−–—]/g, "-")
    // неразрывные и обычные пробелы внутри числа: «1 234» → «1234».
    // \u00a0 записан кодом: «неправильный» пробел в исходнике ловит линтер.
    .replace(/(\d)[\s\u00a0](?=\d)/g, "$1")
    // десятичная запятая → точка (только между цифрами, иначе это разделитель)
    .replace(/(\d),(?=\d)/g, "$1.")
    .replace(/\s+/g, "")
}

// Значение части ответа как число: понимает «7», «-0.5», «3/4», «+2».
// Возвращает null, если это не число (тогда сравниваем как текст).
function answerToNumber(part) {
  if (/^[+-]?\d+(\.\d+)?$/.test(part)) return Number(part)
  const frac = part.match(/^([+-]?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/)
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2])
  return null
}

// Перечисление: «2;3», «2 3», «2,3» (когда рядом не цифры десятичной дроби).
function splitAnswerParts(norm) {
  return norm.split(/[;]+/).filter(Boolean)
}

// Равны ли ответы по смыслу. Числа сравниваются с допуском 1e-9 (иначе
// 0.1+0.2 и 0.3 разошлись бы), перечисления — без учёта порядка.
//
// allowFractions по умолчанию ВЫКЛЮЧЕН намеренно. В бланк ФИПИ ответ вносится
// целым или десятичной дробью; «1/2» вместо «0,5» на настоящем экзамене — это
// потерянный балл. Принимать такую запись в тренировке значит учить ошибке,
// поэтому дробь засчитывается только там, где типаж явно это разрешает.
export function answersEqual(given, expected, { allowFractions = false } = {}) {
  const a = normalizeAnswerPart(given)
  const b = normalizeAnswerPart(expected)
  if (!a || !b) return false
  if (a === b) return true

  const isFrac = (x) => x.includes("/")
  if (!allowFractions && (isFrac(a) !== isFrac(b))) return false

  const an = answerToNumber(a)
  const bn = answerToNumber(b)
  if (an !== null && bn !== null) return Math.abs(an - bn) < 1e-9

  const ap = splitAnswerParts(a)
  const bp = splitAnswerParts(b)
  if (ap.length > 1 && ap.length === bp.length) {
    const norm = (arr) => arr.map((x) => {
      const n = answerToNumber(x)
      return n === null ? x : String(n)
    }).sort()
    const na = norm(ap), nb = norm(bp)
    return na.every((x, i) => x === nb[i])
  }
  return false
}


// Контакт-мессенджер репетитор вписывает как придётся: «@user», «user»,
// «t.me/user», номер телефона или полный адрес. Голое «@user» в href браузер
// считает ОТНОСИТЕЛЬНЫМ путём внутри сайта — ссылка никуда не ведёт, поэтому
// адрес всегда достраиваем сами по выбранному мессенджеру.
const MESSENGER_BASE = {
  telegram: "https://t.me/",
  instagram: "https://instagram.com/",
  vk: "https://vk.com/",
}

export function contactHref(messenger, raw) {
  const value = String(raw || "").trim()
  if (!value) return ""
  if (/^https?:\/\//i.test(value)) return value
  // Домен без схемы: «t.me/user», «vk.com/user», «wa.me/7900…».
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(value)) return `https://${value}`

  const digits = value.replace(/\D/g, "")
  const isPhone = /^[+\d][\d\s()-]*$/.test(value) && digits.length >= 10
  if (messenger === "whatsapp") {
    if (!isPhone) return `https://wa.me/${value.replace(/^@/, "")}`
    return `https://wa.me/${digits.length === 11 && digits[0] === "8" ? `7${digits.slice(1)}` : digits}`
  }
  if (messenger === "telegram" && isPhone) {
    return `https://t.me/+${digits.length === 11 && digits[0] === "8" ? `7${digits.slice(1)}` : digits}`
  }
  const base = MESSENGER_BASE[messenger]
  if (base) return base + value.replace(/^@/, "")
  // «Другое»: без схемы и без домена ссылку строить не из чего — отдаём пустоту,
  // чтобы показать значение текстом, а не мёртвой ссылкой.
  return ""
}

// Как показать контакт: «https://t.me/user» читается хуже, чем «@user».
export function contactLabel(messenger, raw) {
  const value = String(raw || "").trim()
  if (!value) return ""
  const path = value
    .replace(/^https?:\/\//i, "")
    .replace(/^(t\.me|telegram\.me|wa\.me|instagram\.com|www\.instagram\.com|vk\.com|m\.vk\.com)\//i, "")
    .replace(/\/$/, "")
  if (!path) return value
  if (messenger === "whatsapp") return formatPhone(path) || path
  if (messenger === "other") return path
  return path.startsWith("@") || path.startsWith("+") ? path : `@${path}`
}

// Отсчёт до занятия для карточки «Следующее занятие». Общий для кабинета
// репетитора и кабинета ученика: формулировка отсчёта должна совпадать, иначе
// две стороны одного занятия видят разное время до него.
export function timeUntilLesson(dateStr, timeStr) {
  const [h, m] = (timeStr || "00:00").split(":").map(Number)
  const [y, mo, d] = dateStr.split("-").map(Number)
  const diff = new Date(y, mo - 1, d, h, m) - new Date()
  if (diff <= 0) return "Сейчас"
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `через ${mins} мин`
  const totalHrs = Math.floor(mins / 60)
  const rem = mins % 60
  if (totalHrs < 24) return rem === 0 ? `через ${totalHrs} ч` : `через ${totalHrs} ч ${rem} мин`
  const days = Math.floor(totalHrs / 24)
  const hrs = totalHrs % 24
  return hrs === 0 ? `через ${days} дн` : `через ${days} дн ${hrs} ч`
}
