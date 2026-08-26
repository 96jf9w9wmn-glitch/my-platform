import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { noBreakMath } from "../utils"

function escapeHtml(s) {
  const div = document.createElement("div")
  div.textContent = s
  return div.innerHTML
}

// ── Математика в PDF ─────────────────────────────────────────────────────────
// CSS-дроби/корни (renderTaskMath + .tmath-*) в PDF использовать нельзя: html2canvas
// смещает глифы относительно боксов (черта дроби ложится ПОВЕРХ числителя, черта корня
// отрывается от знака √ — проверено экспериментально, и border, и background-блоки).
// Зато растровые <img> он рисует точно, поэтому токены ⟦f:n:d⟧/⟦r:x⟧ здесь растеризуются
// в PNG: дробь и корень рисуются SVG-примитивами (черта корня — продолжение того же
// path, что и знак, непрерывность гарантирована построением), затем canvas → data-URL.

const FS = 14                                  // размер шрифта условия в PDF-блоке
// приближённая ширина строки в долях em (надстрочные ⁰¹²…⁻ уже)
const chW = (s, k = 0.58) => { let w = 0; for (const ch of s) w += /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/.test(ch) ? k * 0.724 : k; return w }

// Шрифт формул: у печатного варианта весь лист — Times New Roman (как в КИМ ФИПИ),
// поэтому дроби и корни рисуются тем же шрифтом. k — средняя ширина символа в долях em,
// по ней считается длина черты дроби (у Times символы уже, чем у Arial).
export const MATH_ARIAL = { family: "Arial, sans-serif", k: 0.58 }
export const MATH_TIMES = { family: "'Times New Roman', Times, serif", k: 0.5, plain: true }

// корень внутри дроби (маркер √{X}) → √ с чертой над подкоренным; ширину считаем по «√X».
const rootInPdf = (s) => s.replace(/√(?:\[([^\]{}]+)\])?\{([^{}]+)\}/g, (_, i, x) => `${i ? `<tspan baseline-shift="super" font-size="0.7em">${i}</tspan>` : ""}√<tspan text-decoration="overline">${x}</tspan>`)
// Для ОЦЕНКИ ШИРИНЫ: убираем маркеры (√{}, ⁅⁆ степень, ⦃¦⦄ вложенная дробь, ⦉⦊ индекс) —
// иначе ширина дроби считается по служебным символам и черта получается длиннее текста.
const stripRootMarker = (s) => String(s)
  .replace(/√(?:\[([^\]{}]+)\])?\{([^{}]+)\}/g, (_, i, x) => `${i || ""}√${x}`)
  .replace(/⁅([^⁆]*)⁆/g, "$1")
  .replace(/⦃([^¦⦄]*)¦([^⦄]*)⦄/g, "$1/$2")
  .replace(/⦉([^⦊]*)⦊/g, "$1")
// Маркеры ВНУТРИ над/подстрочника условия. Настоящую стопку там не построить: дробь в
// PDF — картинка фиксированного кегля, в индексе она была бы ростом со строку. Поэтому
// дробь пишем в строку (log с основанием 1/15), а корень — знаком с чертой над числом.
// Молча оставлять маркеры нельзя: в условии видны сырые «⦃1¦15⦄» и «√{15}».
const flatMarks = (s) => String(s)
  .replace(/⦃([^¦⦄]*)¦([^⦄]*)⦄/g, "$1/$2")
  .replace(/√(?:\[([^\]{}]+)\])?\{([^{}]+)\}/g,
    (_, i, x) => `${i ? `<sup style="font-size:.7em;">${i}</sup>` : ""}√<span style="text-decoration:overline;">${x}</span>`)
  .replace(/⁅([^⁆]*)⁆/g, `<sup style="font-size:0.72em; line-height:0; vertical-align:0.55em;">$1</sup>`)

// ⁅x⁆ внутри числителя/знаменателя дроби (степень: 2ˣ, 4ˣ⁻³) — SVG-надстрочник.
const supInSvg = (s) => String(s)
  .replace(/⁅([^⁆]*)⁆/g, (_, x) => `<tspan baseline-shift="super" font-size="0.72em">${x}</tspan>`)
  // вложенная дробь внутри SVG-дроби — в строку («x/25»): второй ярус черты не рисуем
  .replace(/⦃([^¦⦄]*)¦([^⦄]*)⦄/g, "$1/$2")
  .replace(/⦉([^⦊]*)⦊/g, (_, x) => `<tspan baseline-shift="sub" font-size="0.75em">${x}</tspan>`)
  .replace(/⦅([^¦⦆]*)¦([^⦆]*)⦆/g, (_, a, b) =>
    `<tspan baseline-shift="super" font-size="0.7em">${a}</tspan><tspan baseline-shift="sub" font-size="0.7em">${b}</tspan>`)
function fracSvg(num0, den0, mf = MATH_ARIAL) {
  const num = supInSvg(rootInPdf(num0)), den = supInSvg(rootInPdf(den0))
  const fs = FS * 0.95
  const w = Math.max(chW(stripRootMarker(num0), mf.k), chW(stripRootMarker(den0), mf.k)) * fs + 8
  const W = Math.ceil(w + 6), H = 34, cx = W / 2
  return { W, H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<text x="${cx}" y="13" font-size="${fs}" font-family="${mf.family}" text-anchor="middle" fill="#1c1c1e">${num}</text>` +
    `<line x1="${cx - w / 2 - 2}" y1="16.5" x2="${cx + w / 2 + 2}" y2="16.5" stroke="#1c1c1e" stroke-width="1.3"/>` +
    `<text x="${cx}" y="30" font-size="${fs}" font-family="${mf.family}" text-anchor="middle" fill="#1c1c1e">${den}</text></svg>` }
}

// Дробь в скобках по её высоте ((1/4)^x) — единым SVG, чтобы скобки точно совпали с
// дробью (в PDF дробь — растровая картинка, отдельные текст-скобки рядом не выровнять).
// Скобки тянутся по высоте вертикальным scale (тоньше штрих, чем крупный шрифт) + weight 300;
// translate компенсирует сдвиг базовой линии от scale, чтобы скобка осталась по центру дроби.
function pfracSvg(num0, den0, mf = MATH_ARIAL) {
  const num = rootInPdf(num0), den = rootInPdf(den0)
  const fs = FS * 0.95, pfs = 21, sy = 1.35, pb = 25.6, pw = 8
  const pt = `translate(0,${(-(sy - 1) * pb).toFixed(2)}) scale(1,${sy})`
  const w = Math.max(chW(stripRootMarker(num0), mf.k), chW(stripRootMarker(den0), mf.k)) * fs + 8
  const inner = Math.ceil(w + 6), H = 34
  const fx = pw + 2, cx = fx + inner / 2, W = fx + inner + pw + 2
  return { W, H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<text x="1" y="${pb}" font-size="${pfs}" font-weight="300" font-family="${mf.family}" fill="#1c1c1e" transform="${pt}">(</text>` +
    `<text x="${cx}" y="13" font-size="${fs}" font-family="${mf.family}" text-anchor="middle" fill="#1c1c1e">${num}</text>` +
    `<line x1="${cx - w / 2 - 2}" y1="16.5" x2="${cx + w / 2 + 2}" y2="16.5" stroke="#1c1c1e" stroke-width="1.3"/>` +
    `<text x="${cx}" y="30" font-size="${fs}" font-family="${mf.family}" text-anchor="middle" fill="#1c1c1e">${den}</text>` +
    `<text x="${fx + inner + 1}" y="${pb}" font-size="${pfs}" font-weight="300" font-family="${mf.family}" fill="#1c1c1e" transform="${pt}">)</text></svg>` }
}

function rootSvg(content, index = "", mf = MATH_ARIAL) {
  const tw = chW(content, mf.k) * FS
  const idxFS = 10
  const ox = index ? Math.ceil(chW(String(index), mf.k) * idxFS) + 1 : 0
  const W = Math.ceil(13 + tw + 2.5) + ox, H = 22
  const d = `M${1.5 + ox},13 L${4 + ox},11.5 L${7.5 + ox},19 L${11.5 + ox},2.8 L${W - 1.5},2.8`
  const idx = index ? `<text x="${ox - 1}" y="10.5" font-size="${idxFS}" font-family="${mf.family}" text-anchor="middle" fill="#1c1c1e">${index}</text>` : ""
  return { W, H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<path d="${d}" fill="none" stroke="#1c1c1e" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>` +
    idx +
    `<text x="${13 + ox}" y="17" font-size="${FS}" font-family="${mf.family}" fill="#1c1c1e">${content}</text></svg>` }
}

// Корень НАД дробью (√ с чертой на всю дробь) — единый SVG: знак √, черта сверху,
// стоячая дробь (num/den) и опциональные pre/post по бокам от неё.
function rootFracSvg(pre, num, den, post, mf = MATH_ARIAL) {
  const fs = FS * 0.92, sign = 12
  const preW = chW(stripRootMarker(pre), mf.k) * FS, postW = chW(stripRootMarker(post), mf.k) * FS
  const fracW = Math.max(chW(stripRootMarker(num), mf.k), chW(stripRootMarker(den), mf.k)) * fs + 8
  const W = Math.ceil(sign + preW + fracW + postW + 8), H = 40
  const bar = 22, x0 = sign + 3, fcx = x0 + preW + fracW / 2
  const d = `M2,26 L6,38 L${sign},3 L${W - 1.5},3`   // √ + верхняя черта на всю ширину
  let g = `<path d="${d}" fill="none" stroke="#1c1c1e" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>`
  if (pre) g += `<text x="${x0}" y="${bar + 4}" font-size="${FS}" font-family="${mf.family}" fill="#1c1c1e">${rootInPdf(pre)}</text>`
  g += `<text x="${fcx}" y="${bar - 4}" font-size="${fs}" font-family="${mf.family}" text-anchor="middle" fill="#1c1c1e">${rootInPdf(num)}</text>`
  g += `<line x1="${x0 + preW + 1}" y1="${bar}" x2="${x0 + preW + fracW - 1}" y2="${bar}" stroke="#1c1c1e" stroke-width="1.3"/>`
  g += `<text x="${fcx}" y="${bar + 12}" font-size="${fs}" font-family="${mf.family}" text-anchor="middle" fill="#1c1c1e">${rootInPdf(den)}</text>`
  if (post) g += `<text x="${x0 + preW + fracW + 1}" y="${bar + 4}" font-size="${FS}" font-family="${mf.family}" fill="#1c1c1e">${rootInPdf(post)}</text>`
  return { W, H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>` }
}

// SVG-примитив → PNG data-URL (2x) → inline <img>. display:inline обязателен — Tailwind
// preflight ставит img{display:block}, и формула выпадает из строки. vertical-align
// откалиброван ПОД html2canvas (он рисует inline-img выше, чем браузер; смотреть в
// браузере этот скрытый блок никто не будет — важен только снимок).
async function svgToInlineImg({ W, H, svg }, valign) {
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
  const img = new Image()
  try {
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error("SVG-формула не загрузилась")); img.src = blobUrl })
    const c = document.createElement("canvas")
    c.width = W * 2; c.height = H * 2
    const ctx = c.getContext("2d")
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return `<img src="${c.toDataURL("image/png")}" style="display:inline; width:${W}px; height:${H}px; vertical-align:${valign};" />`
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

// vertical-align PNG-картинок ПОД html2canvas (он рисует inline-img выше браузера) —
// подобраны так, чтобы центр дроби/черта корня легли на матось (вровень с − и скобками).
const FRAC_VALIGN = "-20px"
const ROOT_VALIGN = "-10px"

// PDF-аналог renderTaskMath из utils.js: тот же порядок (сначала экранирование, потом
// токены). Дробь/корень — PNG-картинками, нижний индекс — обычным <sub> (html2canvas
// рисует его верно). \n остаётся как есть (white-space:pre-wrap).
// Таблица соответствия для PDF: те же данные, что и в matchTableHtml (utils.js), но с
// инлайновыми стилями — html2canvas не подхватывает классы. Внутренние мат-токены в ячейках
// остаются и разворачиваются общим циклом ниже. body уже экранирован.
function matchTablePdf(body, plain) {
  const [lh = "", rh = "", letters = "", lRaw = "", rRaw = ""] = body.split("‖")
  const L = lRaw ? lRaw.split("⁞") : []
  const R = rRaw ? rRaw.split("⁞") : []
  const la = letters.split("")
  const cell = `border:1px solid #333; padding:5px 9px; text-align:left; vertical-align:top; font-size:${plain ? 15 : 14}px;`
  const hd = plain
    ? cell + " font-weight:600;"
    : "border:1px solid #333; padding:5px 9px; text-align:left; background:#f2f2f7; font-weight:600; font-size:11px; text-transform:uppercase; color:#555;"
  const key = plain ? "font-weight:600;" : "color:#007AFF; font-weight:600;"
  let trs = ""
  for (let i = 0; i < Math.max(L.length, R.length); i++) {
    const lc = i < L.length ? `<span style="${key}">${la[i] || ""})</span> ${L[i]}` : ""
    const rc = i < R.length ? `<span style="${key}">${i + 1})</span> ${R[i]}` : ""
    trs += `<tr><td style="${cell}">${lc}</td><td style="${cell}">${rc}</td></tr>`
  }
  const ac = `border:1px solid #555; min-width:34px; height:30px; text-align:center; vertical-align:middle; font-size:${plain ? 15 : 14}px;`
  const ah = ac + (plain ? " font-weight:600;" : " background:#f2f2f7; font-weight:600;")
  const ansHead = la.map((c) => `<td style="${ah}">${c}</td>`).join("")
  const ansBlank = la.map(() => `<td style="${ac}"></td>`).join("")
  return `<table style="border-collapse:collapse; margin:8px 0;"><tr><td style="${hd}">${lh}</td><td style="${hd}">${rh}</td></tr>${trs}</table>` +
    `<table style="border-collapse:collapse; margin:2px 0 8px;"><tr>${ansHead}</tr><tr>${ansBlank}</tr></table>`
}

// Простая таблица данных для PDF (график погашения долга в №16): первая строка — шапка.
function dataTablePdf(body, plain) {
  const rows = body.split("‖").map((r) => r.split("⁞"))
  const [head, ...rest] = rows
  const cell = `border:1px solid #333; padding:4px 8px; text-align:center; font-size:${plain ? 14 : 13}px; white-space:nowrap;`
  const hd = cell + (plain ? " font-weight:600;" : " background:#f2f2f7; font-weight:600;")
  const th = head.map((c) => `<td style="${hd}">${c}</td>`).join("")
  const trs = rest.map((r) => `<tr>${r.map((c) => `<td style="${cell}">${c}</td>`).join("")}</tr>`).join("")
  return `<table style="border-collapse:collapse; margin:8px 0;"><tr>${th}</tr>${trs}</table>`
}

// Нумерованный список для PDF (инлайновые стили): синий номер + текст в одну строку.
function orderedListPdf(body, plain) {
  const items = body.split("⁞")
  const li = `margin:2px 0; padding-left:1.6em; text-indent:-1.6em; font-size:${plain ? 15 : 14}px; line-height:1.45;`
  const num = plain ? "" : "color:#007AFF; font-weight:600;"
  return `<div style="margin:6px 0;">` +
    items.map((t, i) => `<div style="${li}"><span style="${num}">${i + 1})</span> ${t}</div>`).join("") +
    `</div>`
}

// Фигурная скобка системы под известную высоту H. Растянутый SVG (viewBox +
// preserveAspectRatio="none", как в вебе) html2canvas снимает бледной ниткой, поэтому
// path считаем сразу в пикселях и растеризуем в PNG — так же, как дробь и корень.
function braceSvg(H) {
  const W = 10, mid = H / 2
  const k = Math.min(14, mid * 0.45)                    // длина прямого «плеча» скобки
  const n = (v) => v.toFixed(1)
  const d = `M8.6,1 C5.2,1 5,2.4 5,${n(1 + k)} L5,${n(mid - k * 0.55)} `
    + `C5,${n(mid - 1.5)} 3.6,${n(mid - 0.6)} 1,${n(mid)} `
    + `C3.6,${n(mid + 0.6)} 5,${n(mid + 1.5)} 5,${n(mid + k * 0.55)} `
    + `L5,${n(H - 1 - k)} C5,${n(H - 2.4)} 5.2,${n(H - 1)} 8.6,${n(H - 1)}`
  return { W, H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<path d="${d}" fill="none" stroke="#1c1c1e" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>` }
}

// Границы «чернил» (тёмных пикселей) на снимке: по ним видно, где html2canvas РЕАЛЬНО
// нарисовал строки системы. Порог 150 — текст #1c1c1e и линии дробей заведомо темнее.
function inkBounds(canvas) {
  const { width: w, height: h } = canvas
  const d = canvas.getContext("2d").getImageData(0, 0, w, h).data
  let top = -1, bot = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (d[i] < 150 && d[i + 1] < 150 && d[i + 2] < 150) { if (top < 0) top = y; bot = y; break }
    }
  }
  return top < 0 ? null : { top, bot }
}

// ⟦cases:строка⁞строка…⟧ — система (фигурная скобка) в PDF. Разворачивается ПОСЛЕ
// цикла формул: к этому моменту внутренние ⟦f⟧/⟦r⟧ уже стали <img>, поэтому их «⟧»
// не рвут токен, а разделителем строк остаётся только ⁞ или ¦ (в ЕГЭ №18 — ¦).
//
// Высоту и положение скобки НЕЛЬЗЯ брать из DOM-бокса колонки строк: html2canvas рисует
// ТЕКСТ примерно на пол-строки ниже браузера, а картинки (дроби, сама скобка) — ровно по
// DOM-боксу. Скобка, выставленная по DOM, оказывалась на эти полстроки выше текста системы
// и налезала на строку над формулой («Постройте график функции»). Поэтому колонку строк
// снимаем тем же html2canvas и меряем границы чернил — то есть где строки стоят НА САМОМ
// ДЕЛЕ в снимке, — и уже под них подгоняем высоту и сдвиг скобки. Замер с запасом-полями
// (PROBE_PAD), иначе съехавший вниз текст обрезался бы краем пробного снимка.
const PROBE_PAD = 28          // поля пробного снимка, чтобы сдвинутый текст не обрезался
const BRACE_PAD = 4           // насколько скобка выступает за чернила строк сверху и снизу

async function casesPdf(html, mf = MATH_ARIAL) {
  const re = /⟦cases:([^⟧]+)⟧/g
  let out = "", last = 0, m
  while ((m = re.exec(html)) !== null) {
    out += html.slice(last, m.index)
    const lines = m[1].split(/[⁞¦]/)
      .map((l) => `<span style="display:block; white-space:nowrap;">${l}</span>`).join("")
    const probe = document.createElement("div")
    probe.style.cssText = `position:fixed; left:-9999px; top:0; background:#fff; color:#1c1c1e;`
      + ` font-family:${mf.family}; font-size:${FS}px; line-height:1.5; padding:${PROBE_PAD}px; width:max-content;`
    probe.innerHTML = lines
    document.body.appendChild(probe)
    const colH = Math.max(24, Math.round(probe.getBoundingClientRect().height) - 2 * PROBE_PAD)
    let ink
    try {
      const pImgs = [...probe.querySelectorAll("img")]
      await Promise.all(pImgs.map((img) => img.complete
        ? Promise.resolve()
        : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve })))
      ink = inkBounds(await html2canvas(probe, { scale: 1, backgroundColor: "#ffffff" }))
    } catch { ink = null }                       // снимок не удался — рисуем скобку по DOM-боксу
    document.body.removeChild(probe)
    // top — сдвиг скобки относительно верха колонки строк (может быть отрицательным)
    const H = ink ? Math.max(24, ink.bot - ink.top + 2 * BRACE_PAD) : colH
    const top = ink ? ink.top - PROBE_PAD - BRACE_PAD : Math.round((colH - H) / 2)
    out += `<span data-cases="1" style="display:inline-flex; align-items:flex-start; vertical-align:middle;">`
      + `<span style="flex:none; margin-right:6px; font-size:0; position:relative; top:${top}px;">`
      + `${await svgToInlineImg(braceSvg(H), "top")}</span>`
      + `<span style="display:inline-flex; flex-direction:column; align-items:flex-start;">${lines}</span></span>`
    last = m.index + m[0].length
  }
  return out + html.slice(last)
}

export async function renderTaskMathPdf(text, mf = MATH_ARIAL) {
  const esc = escapeHtml(String(text ?? ""))
    .replace(/⟦match⟧([\s\S]*?)⟦endmatch⟧/g, (_, body) => matchTablePdf(body, mf.plain))
    .replace(/⟦tbl⟧([\s\S]*?)⟦endtbl⟧/g, (_, body) => dataTablePdf(body, mf.plain))
    .replace(/⟦list⟧([\s\S]*?)⟦endlist⟧/g, (_, body) => orderedListPdf(body, mf.plain))
  const re = /⟦rf:([^⟧]*)⟧|⟦f:([^:⟧]+):([^:⟧]+)⟧|⟦r:([^⟧]+)⟧|⟦b:([^⟧]+)⟧|⟦iso:([^:⟧]+):([^:⟧]+):([^⟧]+)⟧|⟦sup:([^⟧]+)⟧|⟦rn:([^:⟧]+):([^⟧]+)⟧|⟦pf:([^:⟧]+):([^:⟧]+)⟧|⁅([^⁆]*)⁆|⦃([^¦⦄]*)¦([^⦄]*)⦄|⦉([^⦊]*)⦊|⦅([^¦⦆]*)¦([^⦆]*)⦆|√(?:\[([^\]{}]+)\])?\{([^{}]+)\}|⟦code:([^⟧]*)⟧/g
  let out = "", last = 0, m
  while ((m = re.exec(esc)) !== null) {
    out += esc.slice(last, m.index)
    if (m[1] !== undefined) { const [pre, n, d, post] = m[1].split("¦"); out += await svgToInlineImg(rootFracSvg(pre || "", n || "", d || "", post || "", mf), FRAC_VALIGN) }
    else if (m[4] !== undefined) out += await svgToInlineImg(rootSvg(m[4], "", mf), ROOT_VALIGN)
    else if (m[5] !== undefined) out += `<sub>${flatMarks(m[5])}</sub>`
    else if (m[6] !== undefined) out += `<span style="white-space:nowrap;"><span style="display:inline-flex; flex-direction:column; align-items:flex-end; text-align:right; vertical-align:-0.35em; font-size:0.62em; line-height:1.05; margin-right:0.05em;"><span>${m[6]}</span><span>${m[7]}</span></span>${m[8]}</span>`
    else if (m[9] !== undefined) out += `<sup style="font-size:0.72em; line-height:0; vertical-align:0.55em;">${flatMarks(m[9])}</sup>`
    else if (m[10] !== undefined) out += await svgToInlineImg(rootSvg(m[11], m[10], mf), ROOT_VALIGN)
    else if (m[12] !== undefined) out += await svgToInlineImg(pfracSvg(m[12], m[13], mf), FRAC_VALIGN)
    else if (m[14] !== undefined) out += `<sup style="font-size:0.72em; line-height:0; vertical-align:0.55em;">${flatMarks(m[14])}</sup>`
    else if (m[15] !== undefined) out += await svgToInlineImg(fracSvg(m[15], m[16], mf), FRAC_VALIGN)
    else if (m[17] !== undefined) out += `<sub>${flatMarks(m[17])}</sub>`
    // √{X} и √[i]{X} в самом условии (внутри дробей их разворачивает rootInPdf)
    else if (m[21] !== undefined) out += await svgToInlineImg(rootSvg(m[21], m[20] || "", mf), ROOT_VALIGN)
    else if (m[22] !== undefined) out += `<code style="font-family:Menlo,Consolas,monospace; font-size:0.92em; white-space:pre-wrap;">${m[22]}</code>`
    else if (m[18] !== undefined) out += `<span style="display:inline-flex; flex-direction:column; align-items:flex-start; text-align:left; vertical-align:-0.35em; font-size:0.62em; line-height:1.05; margin-right:0.05em;"><span>${m[18]}</span><span>${m[19]}</span></span>`
    else out += await svgToInlineImg(fracSvg(m[2], m[3], mf), FRAC_VALIGN)
    last = m.index + m[0].length
  }
  // формула не должна рваться переносом строки и в PDF (см. noBreakMath в utils.js)
  return noBreakMath(await casesPdf(out + esc.slice(last), mf))
}

// html2canvas ненадёжно рисует живые <img src="*.svg"> (известное ограничение библиотеки,
// не чинится через crossorigin/CORS-заголовки) — растеризуем SVG в PNG сами через offscreen
// canvas и вставляем уже готовую растровую картинку, это html2canvas снимает без проблем.
// Маленькие SVG (формулы вроде дроби №6) НЕ растягиваем до maxWidth — иначе формула
// раздувается на всю страницу; берём их натуральную ширину. Возвращает { dataUrl, width }.
export async function svgUrlToPng(url, maxWidth = 380, scale = 2) {
  // Иллюстрация задания бывает и растровой (модуль «Шины» — /tire-fig1.png): её нельзя
  // заворачивать в SVG-блоб, иначе картинка не загружается и падает ВЕСЬ экспорт варианта.
  const raw = await (await fetch(url)).blob()
  const isSvg = /svg/i.test(raw.type) || /\.svg(\?|$)/i.test(url)
  const blobUrl = URL.createObjectURL(isSvg ? new Blob([await raw.text()], { type: "image/svg+xml" }) : raw)
  const img = new Image()
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error("Не удалось загрузить картинку: " + url))
      img.src = blobUrl
    })
    const width = Math.min(maxWidth, img.naturalWidth || maxWidth)
    const aspect = (img.naturalHeight || 300) / (img.naturalWidth || 400)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(width * scale * aspect)
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    // height отдаём вместе с шириной: <img> получает явные размеры, чтобы высота блока
    // не зависела от того, успел ли браузер декодировать картинку
    return { dataUrl: canvas.toDataURL("image/png"), width, height: Math.round(width * aspect) }
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

// Картинка задания. Генераторы отдают SVG (data-URL) — его надо растеризовать самим,
// html2canvas живые SVG рисует ненадёжно; готовый растр из банка вставляем как есть.
//
// Высота известна ЗДЕСЬ и проставляется в <img> явным атрибутом. Без неё высота блока
// зависит от того, успел ли браузер декодировать картинку: html2canvas снимает не сам
// документ, а его клон, и недекодированная картинка в клоне даёт нулевую высоту — блок
// в снимке выходит короче, чем в DOM, и чертёж пропадает из задания (у ученика остаётся
// «на рисунке изображён график» без графика).

// Размер растровой картинки из банка (у SVG он известен после растеризации, мерить нечего).
async function measure(dataUrl, width) {
  const img = new Image()
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error("картинка не загрузилась"))
      img.src = dataUrl
    })
    if (!img.naturalWidth) return null
    return Math.round((width * img.naturalHeight) / img.naturalWidth)
  } catch {
    return null
  }
}

export async function taskImage(url, { scale = 2 } = {}) {
  if (!url) return null
  const isSvg = url.startsWith("data:image/svg") || /\.svg($|\?)/i.test(url)
  if (isSvg) {
    try {
      const png = await svgUrlToPng(url, 380, scale)
      return { dataUrl: png.dataUrl, width: png.width, height: png.height }
    } catch {
      // растеризовать не вышло — отдаём исходный адрес: пусть попробует html2canvas.
      // Молча терять чертёж нельзя, задание без него нерешаемо.
    }
  }
  return { dataUrl: url, width: 380, height: await measure(url, 380) }
}

export const CONTAINER_W = 750   // ширина offscreen-контейнера в px; блоки масштабируются на ширину страницы

// Снимает один HTML-блок в canvas (кириллица рендерится браузером как есть — иначе пришлось бы
// вшивать в PDF отдельный кириллический шрифт). Ждёт загрузки картинок перед снимком.
// width/font/fontSize задаются печатным листом варианта (Times, ширина колонки).
export async function renderBlock(innerHtml, opts = {}) {
  const { width = CONTAINER_W, font = "Arial,sans-serif", fontSize = null, lineHeight = null, scale = 2 } = opts
  const el = document.createElement("div")
  el.style.cssText = `position:fixed; left:-9999px; top:0; width:${width}px; background:#fff; font-family:${font}; color:#1c1c1e;`
    + (fontSize ? ` font-size:${fontSize}px;` : "") + (lineHeight ? ` line-height:${lineHeight};` : "")
  el.innerHTML = innerHtml
  document.body.appendChild(el)
  const imgs = [...el.querySelectorAll("img")]
  await Promise.all(imgs.map((img) => img.complete
    ? Promise.resolve()
    : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve })))
  try {
    return await html2canvas(el, { scale, useCORS: true, backgroundColor: "#ffffff" })
  } finally {
    document.body.removeChild(el)
  }
}

// ── Печатный лист варианта ───────────────────────────────────────────────────
// Формат повторяет тренировочные варианты ФИПИ: A4 ЛАНДШАФТ, две колонки, сквозной
// колонтитул, инструкция по выполнению работы в первой колонке, номер задания в выносе,
// строка «Ответ:» после каждого задания части 1, ответы — отдельной страницей в рамке.
// Текст — Times New Roman, поэтому формулы рисуются тем же шрифтом (MATH_TIMES).
const SHEET_FONT = "'Times New Roman', Times, serif"
const SHEET_MX = 46            // поля страницы слева/справа
const SHEET_TOP = 62           // верх колонок (под колонтитулом)
const SHEET_BOTTOM = 30
const COL_GAP = 38
const SHEET_FS = 15            // кегль условия
const SHEET_LH = 1.45
const NUM_W = 32               // вынос под номер задания
// Отступ между блоками в колонке: снимок обрезан по чернилам (см. snapBatch), поэтому
// воздух между заданиями задаётся здесь, а не полями в вёрстке блока.
const BLOCK_GAP = 12
const IMG_MAX = 300            // ширина чертежа в колонке
const FLOAT_MAX = 240          // до этой ширины чертёж обтекается текстом (как в КИМ)
const INK = "#1c1c1e"

const SUBJECT_OF = {
  "Русский": "РУССКОМУ ЯЗЫКУ", "Английский": "АНГЛИЙСКОМУ ЯЗЫКУ", "Информатика": "ИНФОРМАТИКЕ",
  "Физика": "ФИЗИКЕ", "Химия": "ХИМИИ", "Биология": "БИОЛОГИИ", "Обществознание": "ОБЩЕСТВОЗНАНИЮ",
  "История": "ИСТОРИИ", "Литература": "ЛИТЕРАТУРЕ", "География": "ГЕОГРАФИИ",
}
// Номер, с которого начинается часть 2 (развёрнутый ответ) — по типу экзамена.
const PART2_FROM = { "ОГЭ": 20, "ЕГЭ Профиль": 13 }
const EXAM_TIME = {
  "ОГЭ": "3 часа 55 минут (235 минут)",
  "ЕГЭ": "3 часа (180 минут)",
  "ЕГЭ Профиль": "3 часа 55 минут (235 минут)",
  // Информатика: время указано за экзамен целиком, а в лист входит только та
  // часть, что решается без компьютера, — поэтому его тут нет намеренно.
}

function examHeading(examType) {
  if (examType === "ЕГЭ") return "Единый государственный экзамен по МАТЕМАТИКЕ (базовый уровень)"
  if (examType === "ЕГЭ Профиль") return "Единый государственный экзамен по МАТЕМАТИКЕ (профильный уровень)"
  const ege = String(examType || "").startsWith("ЕГЭ")
  const subj = String(examType || "").replace(/^(ОГЭ|ЕГЭ)\s*/, "")
  const name = SUBJECT_OF[subj] || "МАТЕМАТИКЕ"
  return ege
    ? `Единый государственный экзамен по ${name}`
    : `Основной государственный экзамен по ${name}`
}

// Инструкция собирается по фактическому составу листа (сколько заданий, есть ли часть 2),
// а не берётся готовым текстом: вариант может быть собран не из всех номеров.
function instructionParas({ examType, total, p1, p2 }) {
  const time = EXAM_TIME[examType]
  const out = []
  out.push(p2
    ? `Экзаменационная работа состоит из двух частей, включающих в себя ${total} ${plu(total, "задание", "задания", "заданий")}. Часть 1 содержит ${p1} ${plu(p1, "задание", "задания", "заданий")} с кратким ответом, часть 2 — ${p2} ${plu(p2, "задание", "задания", "заданий")} с развёрнутым ответом.`
    : `Экзаменационная работа состоит из ${total} ${plu(total, "задания", "заданий", "заданий")} с кратким ответом.`)
  if (time) out.push(`На выполнение экзаменационной работы отводится ${time}.`)
  out.push(`Ответом к каждому заданию${p2 ? " части 1" : ""} является число или последовательность цифр. Ответ запишите в поле «Ответ» после задания. Если получилась обыкновенная дробь, ответ запишите в виде десятичной.`)
  if (p2) out.push("Решения заданий части 2 и ответы к ним запишите на отдельном листе. Сначала укажите номер задания, а затем запишите его решение и ответ. Пишите чётко и разборчиво.")
  out.push("Задания можно выполнять в любом порядке. Начать советуем с тех заданий, которые вызывают у Вас меньше затруднений, затем переходите к остальным. Для экономии времени пропускайте задание, которое не удаётся выполнить сразу, и переходите к следующему: если останется время, Вы сможете вернуться к пропущенным заданиям.")
  out.push("Если задание содержит рисунок, на нём непосредственно в тексте работы можно выполнять необходимые Вам построения. Все необходимые вычисления и преобразования выполняйте в черновике: записи в черновике не проверяются и не оцениваются.")
  if (examType === "ОГЭ") out.push("Для прохождения аттестационного порога необходимо набрать не менее 8 баллов, из которых не менее 2 баллов должны быть получены за решение заданий по геометрии.")
  out.push("Постарайтесь выполнить как можно больше заданий и набрать наибольшее количество баллов.")
  return out
}

const plu = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

// Общий текст практического модуля №1–5 приклеен к заданию 1 (buildModuleTasks в
// taskBankApi.js разделяет его от условия пустой строкой). На печатном листе он идёт
// отдельным абзацем под рамкой «Прочитайте внимательно текст…», как в КИМ.
function splitModuleIntro(task) {
  if (!task?.module) return null
  const text = String(task.condition_text || "")
  const i = text.indexOf("\n\n")
  if (i < 0) return null
  return { intro: text.slice(0, i).trim(), rest: text.slice(i + 2).trim() }
}

// Чертёж вставляем с ЯВНОЙ высотой: высота известна после растеризации, а без неё
// геометрия блока зависит от того, успел ли браузер декодировать картинку — в снимке
// пачки это сдвинуло бы границы всех следующих блоков.
const sheetImg = (img, style) =>
  `<img src="${img.dataUrl}" width="${img.width}"${img.height ? ` height="${img.height}"` : ""}`
  + ` style="display:block; width:${img.width}px;${img.height ? ` height:${img.height}px;` : ""} ${style}" />`

const boxed = (html) => `<div style="border:1px solid ${INK}; padding:5px 10px; margin:6px 0 8px;">${html}</div>`
const centered = (html, style = "") => `<div style="text-align:center; font-weight:bold; ${style}">${html}</div>`
const answerRule = `<div style="margin:5px 0 0;">Ответ:<span style="display:inline-block; width:62%; border-bottom:1px solid ${INK}; height:0.85em; margin-left:2px;"></span></div>`

// ── Снимок листа пачками ─────────────────────────────────────────────────────
// Один вызов html2canvas стоит около секунды независимо от размера блока: библиотека
// клонирует документ и разбирает весь CSS (проверено: вынести блок в чистый iframe не
// помогает, цена та же). В листе варианта блоков три-четыре десятка — поблочно он
// собирался минутами, поэтому блоки снимаются пачкой, а снимок режется на блоки.
//
// Режем НЕ по DOM-боксам: html2canvas разводит строки шире, чем браузер (у кегля 15
// строка выходит на ~3 px выше), поэтому текст блока не умещается в свой бокс, и рез по
// боксу отрезал бы у задания последнюю строку — ту самую «Ответ:». Между блоками в
// контейнере оставляется широкий зазор SEP, граница ищется по самой длинной белой полосе
// внутри него, а сама полоса снимка обрезается по чернилам. Поэтому отступы между блоками
// в лист приходят не из вёрстки, а одинаковым BLOCK_GAP при раскладке.
const SHEET_SCALE = 2
const SEP = 80                  // зазор между блоками в снимке, px: в нём ищется рез
const BATCH_MAX_H = 2400        // максимум CSS-px на один снимок (иначе холст раздувается)
const INK_PAD = 4               // сколько белого оставить вокруг чернил, px снимка

// Ждём картинку не дольше срока: у контейнера, уехавшего за край экрана, событие загрузки
// иногда не приходит вовсе, и пачка стояла бы впустую.
const capped = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))])

const containerCss = ({ width, font, fontSize, lineHeight }) =>
  `position:fixed; left:-9999px; top:0; width:${width}px; background:#fff; font-family:${font}; color:${INK};`
  + (fontSize ? ` font-size:${fontSize}px;` : "") + (lineHeight ? ` line-height:${lineHeight};` : "")

// Профиль снимка: для каждой строки пикселей — есть ли в ней чернила.
function inkRows(canvas) {
  const { width: w, height: h } = canvas
  const d = canvas.getContext("2d").getImageData(0, 0, w, h).data
  const rows = new Uint8Array(h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (d[i] < 245 && d[i + 1] < 245 && d[i + 2] < 245) { rows[y] = 1; break }
    }
  }
  return rows
}

// Середина самой длинной белой полосы в окне [from, to) — по ней и режем.
function whiteCut(rows, from, to) {
  let best = -1, bestLen = -1, run = -1
  for (let y = from; y <= to; y++) {
    const white = y < to && !rows[y]
    if (white && run < 0) run = y
    if (!white && run >= 0) {
      if (y - run > bestLen) { bestLen = y - run; best = (run + y) >> 1 }
      run = -1
    }
  }
  return best < 0 ? (from + to) >> 1 : best
}

// Полоса снимка [top, bot) → картинка блока, обрезанная по чернилам, и её высота в CSS-px.
function stripe(canvas, rows, top, bot, k, fallbackH) {
  let y0 = top, y1 = bot
  while (y0 < bot && !rows[y0]) y0++
  while (y1 > y0 && !rows[y1 - 1]) y1--
  if (y0 >= y1) return null                       // блок без чернил — снимать нечего
  y0 = Math.max(top, y0 - INK_PAD); y1 = Math.min(bot, y1 + INK_PAD)
  const out = document.createElement("canvas")
  out.width = canvas.width
  out.height = Math.max(1, y1 - y0)
  const ctx = out.getContext("2d")
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas, 0, -y0)
  return { dataUrl: out.toDataURL("image/jpeg", 0.95), h: out.height / k, fallbackH }
}

// Снимает пачку блоков одним html2canvas и возвращает по картинке на блок.
async function snapBatch(htmls, opts) {
  const el = document.createElement("div")
  el.style.cssText = containerCss(opts)
  el.innerHTML = htmls.map((h) => `<div style="padding-bottom:${SEP}px;">${h}</div>`).join("")
  document.body.appendChild(el)
  try {
    const imgs = [...el.querySelectorAll("img")]
    await Promise.all(imgs.map((img) => img.complete
      ? Promise.resolve()
      : capped(new Promise((resolve) => { img.onload = resolve; img.onerror = resolve }), 5000)))
    // боксы читаем ПОСЛЕ загрузки картинок — иначе чертёж нулевой высоты сдвинет все границы
    const kids = [...el.children]
    const boxes = kids.map((kid) => ({ top: kid.offsetTop, bot: kid.offsetTop + kid.offsetHeight - SEP }))
    const totalCss = el.offsetHeight
    const canvas = await html2canvas(el, { scale: SHEET_SCALE, useCORS: true, backgroundColor: "#ffffff" })
    const k = canvas.height / totalCss
    const rows = inkRows(canvas)
    const px = (v) => Math.max(0, Math.min(canvas.height, Math.round(v * k)))
    const cuts = [0]
    for (let i = 0; i < kids.length - 1; i++) cuts.push(whiteCut(rows, px(boxes[i].bot), px(boxes[i + 1].top)))
    cuts.push(canvas.height)
    return kids.map((_, i) => stripe(canvas, rows, cuts[i], cuts[i + 1], k, boxes[i].bot - boxes[i].top))
  } finally {
    document.body.removeChild(el)
  }
}

// Все блоки листа → картинки. Пачка набирается по высоте (холст в десяток тысяч пикселей
// на телефоне просто не создастся); не снялась пачка — блоки честно доснимаются по одному.
async function snapSheet(htmls, opts) {
  const probe = document.createElement("div")
  probe.style.cssText = containerCss(opts)
  probe.innerHTML = htmls.map((h) => `<div>${h}</div>`).join("")
  document.body.appendChild(probe)
  const heights = [...probe.children].map((kid) => kid.offsetHeight)
  document.body.removeChild(probe)

  const batches = []
  let cur = [], curH = 0
  htmls.forEach((h, i) => {
    if (cur.length && curH + heights[i] + SEP > BATCH_MAX_H) { batches.push(cur); cur = []; curH = 0 }
    cur.push(h); curH += heights[i] + SEP
  })
  if (cur.length) batches.push(cur)

  // Одиночный снимок — запасной путь: своё поле снизу (иначе html2canvas срежет последнюю
  // строку) и та же обрезка по чернилам, чтобы блок встал в лист так же, как из пачки.
  const snapOne = async (html) => {
    const c = await renderBlock(`<div style="padding-bottom:${SEP / 2}px;">${html}</div>`, opts)
    const k = SHEET_SCALE
    return stripe(c, inkRows(c), 0, c.height, k, c.height / k)
  }

  const out = []
  for (const batch of batches) {
    let shots
    try {
      shots = await snapBatch(batch, opts)
    } catch {
      shots = null
    }
    for (let i = 0; i < batch.length; i++) {
      // блок без чернил (такого на листе быть не должно) остаётся пустым местом своей высоты
      out.push(shots?.[i] || await snapOne(batch[i]) || { dataUrl: null, h: heights[out.length] })
    }
  }
  return out
}

// Рендерит каждый блок листа отдельным снимком и раскладывает по колонкам так, чтобы
// задание НИКОГДА не разрывалось: не влезло в остаток колонки — целиком уходит в следующую.
// mode: "blank" — лист ученику, "answers" — плюс страница ответов. Разбор в лист не
// подшивается: печатный вариант — это КИМ, а не методичка. Ответы идут ОТДЕЛЬНОЙ
// страницей в конце, а не рядом с заданием: иначе лист нельзя дать ученику, не засветив их.
export async function generateVariantPdf({ title, examType, tasks, mode = "blank" }) {
  const pdf = new jsPDF({ unit: "px", format: "a4", orientation: "landscape" })
  // «px» у jsPDF — НЕ CSS-пиксель (A4-ландшафт = 631 единица, а не 1122): считаем всю
  // раскладку в CSS-пикселях (96 dpi, как рисует html2canvas), а на страницу кладём с
  // коэффициентом K. Без него блоки ложатся вдвое крупнее и всё расползается по страницам.
  const K = 72 / (96 * pdf.internal.scaleFactor)
  const pageW = pdf.internal.pageSize.getWidth() / K
  const pageH = pdf.internal.pageSize.getHeight() / K
  const colW = Math.floor((pageW - 2 * SHEET_MX - COL_GAP) / 2)
  const colH = pageH - SHEET_TOP - SHEET_BOTTOM
  const contentW = colW * 2 + COL_GAP
  const opts = { width: colW, font: SHEET_FONT, fontSize: SHEET_FS, lineHeight: SHEET_LH }

  const part2From = PART2_FROM[examType] ?? null
  const part1 = tasks.filter((t) => part2From == null || t.number < part2From)
  const part2 = part2From == null ? [] : tasks.filter((t) => t.number >= part2From)
  const hasPart2 = part2.length > 0
  const range = (arr) => arr.length === 1 ? `${arr[0].number}` : `${arr[0].number}–${arr[arr.length - 1].number}`

  const images = await Promise.all(
    tasks.map((t) => t.image_url ? svgUrlToPng(t.image_url, IMG_MAX) : Promise.resolve(null))
  )

  // ── Поток блоков: {html, glue} + разрывы колонки/страницы ──────────────────
  // Снимки делаются не здесь, а одной пачкой после сборки всего листа (snapSheet).
  const flow = []
  const push = (html, glue = false) => { flow.push({ html, glue }) }
  const brk = (kind) => flow.push({ break: kind })

  // Титул + инструкция — первая колонка целиком, ОДНИМ блоком (дальше принудительный
  // переход в колонку 2). Одним — потому что раскладка разделяет блоки зазором, а абзацы
  // инструкции идут подряд, отделяясь красной строкой, как в КИМ.
  const paras = instructionParas({ examType, total: tasks.length, p1: part1.length, p2: part2.length })
  push(
    centered(escapeHtml(examHeading(examType)), "margin-bottom:4px;") +
    centered(escapeHtml(title || "Тренировочный вариант"), "margin-bottom:8px;") +
    centered("Инструкция по выполнению работы", "margin-bottom:4px;") +
    paras.map((p) => `<div style="text-align:justify; text-indent:1.6em;">${escapeHtml(p)}</div>`).join("") +
    `<div style="text-align:center; font-weight:bold; font-style:italic; margin-top:10px;">Желаем успеха!</div>`)
  brk("col")

  if (hasPart2) push(centered("Часть 1", "margin-bottom:4px;"), true)

  // Общий текст практического модуля №1–5 — в рамке-заголовке, чертёж обтекается текстом
  const mod = splitModuleIntro(tasks[0])
  const modTasks = tasks.filter((t) => t.module)
  let introImg = null
  if (mod) {
    if (images[0] && images[0].width <= IMG_MAX) introImg = images[0]
    push(boxed(`<div style="text-align:center; font-weight:bold; font-style:italic;">Прочитайте внимательно текст и выполните задания ${range(modTasks.length ? modTasks : part1)}.</div>`), true)
    push(
      `<div style="display:flow-root;">` +
      (introImg ? sheetImg(introImg, "float:right; margin:2px 0 6px 12px;") : "") +
      `<div style="text-align:justify; white-space:pre-wrap;">${await renderTaskMathPdf(mod.intro, MATH_TIMES)}</div></div>`)
  }

  let part2Started = false
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const isPart2 = part2From != null && t.number >= part2From
    if (isPart2 && !part2Started) {
      part2Started = true
      push(boxed(`Не забудьте перенести все ответы в бланк ответов № 1 в соответствии с инструкцией по выполнению работы.`))
      push(centered("Часть 2", "margin-bottom:4px;"), true)
      push(boxed(`Для выполнения ${plu(part2.length, "задания", "заданий", "заданий")} ${range(part2)} используйте отдельный лист. Сначала укажите номер задания, а затем запишите его решение и ответ. Пишите чётко и разборчиво.`), true)
    }
    // Модули части 2 ОГЭ по математике — как в КИМ: 20–22 алгебра, 23–25 геометрия
    if (examType === "ОГЭ" && (t.number === 20 || t.number === 23)) {
      push(boxed(centered(t.number === 20 ? "Модуль «Алгебра»" : "Модуль «Геометрия»")), true)
    }

    const cond = mod && i === 0 ? mod.rest : t.condition_text
    const img = introImg && i === 0 ? null : images[i]
    const float = img && img.width <= FLOAT_MAX && String(cond || "").length >= 110
    push(
      `<div style="display:flex; align-items:flex-start; padding:5px 0 8px;">` +
        `<div style="flex:0 0 ${NUM_W}px;">${t.number}.</div>` +
        `<div style="flex:1; min-width:0; display:flow-root;">` +
          (float ? sheetImg(img, "float:right; margin:0 0 6px 12px;") : "") +
          (cond ? `<div style="text-align:justify; white-space:pre-wrap;">${await renderTaskMathPdf(cond, MATH_TIMES)}</div>` : "") +
          (img && !float ? sheetImg(img, "margin:8px auto 0;") : "") +
          (t.condition_tail ? `<div style="text-align:justify; white-space:pre-wrap; margin-top:6px;">${await renderTaskMathPdf(t.condition_tail, MATH_TIMES)}</div>` : "") +
          (isPart2 ? `<div style="height:30px;"></div>` : answerRule) +
        `</div>` +
      `</div>`)
  }
  if (!hasPart2) push(boxed(`Не забудьте перенести все ответы в бланк ответов № 1 в соответствии с инструкцией по выполнению работы.`))

  // ── Ответы (лист проверяющего) ────────────────────────────────────────────
  const answerRows = async (list) => {
    // запас снизу: html2canvas рисует строку ниже бокса, и без него ответ ложится на
    // нижнюю линию ячейки
    const cell = `border:1px solid ${INK}; padding:2px 10px 7px; text-align:center;`
    const rows = []
    for (const t of list) {
      if (t.answer == null || String(t.answer).trim() === "") continue
      rows.push(`<tr><td style="${cell} width:44px;">${t.number}</td>`
        + `<td style="${cell} min-width:150px;">${await renderTaskMathPdf(String(t.answer), MATH_TIMES)}</td></tr>`)
    }
    return rows.length ? `<table style="border-collapse:collapse;">${rows.join("")}</table>` : ""
  }

  if (mode === "answers") {
    brk("page")
    // название варианта не дублируем — оно в колонтитуле на каждой странице
    push(`<div style="font-weight:bold;">ОТВЕТЫ</div>`
      + `<div style="font-size:13px; margin:2px 0 10px;">Лист для проверяющего — ученику не выдавать.</div>`, true)
    const t1 = await answerRows(part1)
    if (t1) push(t1)
    const t2 = await answerRows(part2)
    if (t2) { brk("col"); push(t2) }
  }

  // ── Снимки: одна пачка на весь лист ───────────────────────────────────────
  const shots = await snapSheet(flow.filter((it) => !it.break).map((it) => it.html), opts)
  let shotAt = 0
  for (const it of flow) if (!it.break) Object.assign(it, shots[shotAt++])

  // ── Раскладка по колонкам ─────────────────────────────────────────────────
  const dateStr = new Date().toLocaleDateString("ru-RU")
  const name = title || "Тренировочный вариант"
  // Название по умолчанию — сегодняшняя дата, поэтому дату отдельно не приписываем.
  const stamp = [name, name.includes(dateStr) ? null : dateStr, examType]
    .filter(Boolean).map(escapeHtml).join(" &nbsp; ")
  const headerCanvas = await renderBlock(
    `<div style="display:flex; padding-bottom:7px;">` +
      `<div style="width:50%; text-align:center;">${stamp}</div>` +
      `<div style="width:50%; text-align:center;">precettore.ru</div>` +
    `</div>`, { width: contentW, font: SHEET_FONT, fontSize: 14, lineHeight: 1.2 })
  const headerUrl = headerCanvas.toDataURL("image/jpeg", 0.95)
  const headerH = (headerCanvas.height * contentW) / headerCanvas.width

  let col = 0, y = SHEET_TOP
  const stampHeader = () => pdf.addImage(headerUrl, "JPEG", SHEET_MX * K, 26 * K, contentW * K, headerH * K)
  const nextCol = () => {
    if (col === 0) { col = 1; y = SHEET_TOP } else { pdf.addPage(); stampHeader(); col = 0; y = SHEET_TOP }
  }
  stampHeader()

  for (let i = 0; i < flow.length; i++) {
    const it = flow[i]
    if (it.break) {
      if (it.break === "page") { if (col !== 0 || y !== SHEET_TOP) { pdf.addPage(); stampHeader(); col = 0; y = SHEET_TOP } }
      else if (y !== SHEET_TOP) nextCol()
      continue
    }
    let h = it.h, w = colW
    // «клей»: заголовок раздела не должен остаться внизу колонки без своего блока
    let need = h, j = i
    while (flow[j]?.glue && flow[j + 1] && !flow[j + 1].break) { need += flow[j + 1].h + BLOCK_GAP; j++ }
    if (need > colH) need = h
    if (h > colH) { w = colW * (colH / h); h = colH }   // блок выше колонки — ужимаем целиком
    if (y + need > SHEET_TOP + colH && y > SHEET_TOP) nextCol()
    const x = SHEET_MX + col * (colW + COL_GAP)
    if (it.dataUrl) pdf.addImage(it.dataUrl, "JPEG", x * K, y * K, w * K, h * K)
    y += h + BLOCK_GAP
  }

  return pdf.output("blob")
}
