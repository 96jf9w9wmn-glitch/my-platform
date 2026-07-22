import jsPDF from "jspdf"
import html2canvas from "html2canvas"

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
const chW = (s) => { let w = 0; for (const ch of s) w += /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/.test(ch) ? 0.42 : 0.58; return w }

// корень внутри дроби (маркер √{X}) → √ с чертой над подкоренным; ширину считаем по «√X».
const rootInPdf = (s) => s.replace(/√\{([^}]+)\}/g, (_, x) => `√<tspan text-decoration="overline">${x}</tspan>`)
const stripRootMarker = (s) => s.replace(/√\{([^}]+)\}/g, "√$1")
function fracSvg(num0, den0) {
  const num = rootInPdf(num0), den = rootInPdf(den0)
  const fs = FS * 0.95
  const w = Math.max(chW(stripRootMarker(num0)), chW(stripRootMarker(den0))) * fs + 8
  const W = Math.ceil(w + 6), H = 34, cx = W / 2
  return { W, H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<text x="${cx}" y="13" font-size="${fs}" font-family="Arial, sans-serif" text-anchor="middle" fill="#1c1c1e">${num}</text>` +
    `<line x1="${cx - w / 2 - 2}" y1="16.5" x2="${cx + w / 2 + 2}" y2="16.5" stroke="#1c1c1e" stroke-width="1.3"/>` +
    `<text x="${cx}" y="30" font-size="${fs}" font-family="Arial, sans-serif" text-anchor="middle" fill="#1c1c1e">${den}</text></svg>` }
}

// Дробь в скобках по её высоте ((1/4)^x) — единым SVG, чтобы скобки точно совпали с
// дробью (в PDF дробь — растровая картинка, отдельные текст-скобки рядом не выровнять).
function pfracSvg(num0, den0) {
  const num = rootInPdf(num0), den = rootInPdf(den0)
  const fs = FS * 0.95, pfs = 30, pw = 9
  const w = Math.max(chW(stripRootMarker(num0)), chW(stripRootMarker(den0))) * fs + 8
  const inner = Math.ceil(w + 6), H = 34
  const fx = pw + 2, cx = fx + inner / 2, W = fx + inner + pw + 2
  return { W, H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<text x="1" y="25" font-size="${pfs}" font-family="Arial, sans-serif" fill="#1c1c1e">(</text>` +
    `<text x="${cx}" y="13" font-size="${fs}" font-family="Arial, sans-serif" text-anchor="middle" fill="#1c1c1e">${num}</text>` +
    `<line x1="${cx - w / 2 - 2}" y1="16.5" x2="${cx + w / 2 + 2}" y2="16.5" stroke="#1c1c1e" stroke-width="1.3"/>` +
    `<text x="${cx}" y="30" font-size="${fs}" font-family="Arial, sans-serif" text-anchor="middle" fill="#1c1c1e">${den}</text>` +
    `<text x="${fx + inner + 1}" y="25" font-size="${pfs}" font-family="Arial, sans-serif" fill="#1c1c1e">)</text></svg>` }
}

function rootSvg(content, index = "") {
  const tw = chW(content) * FS
  const idxFS = 10
  const ox = index ? Math.ceil(chW(String(index)) * idxFS) + 1 : 0
  const W = Math.ceil(13 + tw + 5) + ox, H = 22
  const d = `M${1.5 + ox},13 L${4 + ox},11.5 L${7.5 + ox},19 L${11.5 + ox},2.8 L${W - 1.5},2.8`
  const idx = index ? `<text x="${ox - 1}" y="10.5" font-size="${idxFS}" font-family="Arial, sans-serif" text-anchor="middle" fill="#1c1c1e">${index}</text>` : ""
  return { W, H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<path d="${d}" fill="none" stroke="#1c1c1e" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>` +
    idx +
    `<text x="${13 + ox}" y="17" font-size="${FS}" font-family="Arial, sans-serif" fill="#1c1c1e">${content}</text></svg>` }
}

// Корень НАД дробью (√ с чертой на всю дробь) — единый SVG: знак √, черта сверху,
// стоячая дробь (num/den) и опциональные pre/post по бокам от неё.
function rootFracSvg(pre, num, den, post) {
  const fs = FS * 0.92, sign = 12
  const preW = chW(stripRootMarker(pre)) * FS, postW = chW(stripRootMarker(post)) * FS
  const fracW = Math.max(chW(stripRootMarker(num)), chW(stripRootMarker(den))) * fs + 8
  const W = Math.ceil(sign + preW + fracW + postW + 8), H = 40
  const bar = 22, x0 = sign + 3, fcx = x0 + preW + fracW / 2
  const d = `M2,26 L6,38 L${sign},3 L${W - 1.5},3`   // √ + верхняя черта на всю ширину
  let g = `<path d="${d}" fill="none" stroke="#1c1c1e" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>`
  if (pre) g += `<text x="${x0}" y="${bar + 4}" font-size="${FS}" font-family="Arial, sans-serif" fill="#1c1c1e">${rootInPdf(pre)}</text>`
  g += `<text x="${fcx}" y="${bar - 4}" font-size="${fs}" font-family="Arial, sans-serif" text-anchor="middle" fill="#1c1c1e">${rootInPdf(num)}</text>`
  g += `<line x1="${x0 + preW + 1}" y1="${bar}" x2="${x0 + preW + fracW - 1}" y2="${bar}" stroke="#1c1c1e" stroke-width="1.3"/>`
  g += `<text x="${fcx}" y="${bar + 12}" font-size="${fs}" font-family="Arial, sans-serif" text-anchor="middle" fill="#1c1c1e">${rootInPdf(den)}</text>`
  if (post) g += `<text x="${x0 + preW + fracW + 1}" y="${bar + 4}" font-size="${FS}" font-family="Arial, sans-serif" fill="#1c1c1e">${rootInPdf(post)}</text>`
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
function matchTablePdf(body) {
  const [lh = "", rh = "", letters = "", lRaw = "", rRaw = ""] = body.split("‖")
  const L = lRaw ? lRaw.split("⁞") : []
  const R = rRaw ? rRaw.split("⁞") : []
  const la = letters.split("")
  const cell = "border:1px solid #333; padding:5px 9px; text-align:left; vertical-align:top; font-size:14px;"
  const hd = "border:1px solid #333; padding:5px 9px; text-align:left; background:#f2f2f7; font-weight:600; font-size:11px; text-transform:uppercase; color:#555;"
  const key = "color:#007AFF; font-weight:600;"
  let trs = ""
  for (let i = 0; i < Math.max(L.length, R.length); i++) {
    const lc = i < L.length ? `<span style="${key}">${la[i] || ""})</span> ${L[i]}` : ""
    const rc = i < R.length ? `<span style="${key}">${i + 1})</span> ${R[i]}` : ""
    trs += `<tr><td style="${cell}">${lc}</td><td style="${cell}">${rc}</td></tr>`
  }
  const ac = "border:1px solid #555; min-width:34px; height:30px; text-align:center; vertical-align:middle; font-size:14px;"
  const ah = ac + " background:#f2f2f7; font-weight:600;"
  const ansHead = la.map((c) => `<td style="${ah}">${c}</td>`).join("")
  const ansBlank = la.map(() => `<td style="${ac}"></td>`).join("")
  return `<table style="border-collapse:collapse; margin:8px 0;"><tr><td style="${hd}">${lh}</td><td style="${hd}">${rh}</td></tr>${trs}</table>` +
    `<table style="border-collapse:collapse; margin:2px 0 8px;"><tr>${ansHead}</tr><tr>${ansBlank}</tr></table>`
}

// Нумерованный список для PDF (инлайновые стили): синий номер + текст в одну строку.
function orderedListPdf(body) {
  const items = body.split("⁞")
  const li = "margin:2px 0; padding-left:1.6em; text-indent:-1.6em; font-size:14px; line-height:1.45;"
  return `<div style="margin:6px 0;">` +
    items.map((t, i) => `<div style="${li}"><span style="color:#007AFF; font-weight:600;">${i + 1})</span> ${t}</div>`).join("") +
    `</div>`
}

export async function renderTaskMathPdf(text) {
  const esc = escapeHtml(String(text ?? ""))
    .replace(/⟦match⟧([\s\S]*?)⟦endmatch⟧/g, (_, body) => matchTablePdf(body))
    .replace(/⟦list⟧([\s\S]*?)⟦endlist⟧/g, (_, body) => orderedListPdf(body))
  const re = /⟦rf:([^⟧]*)⟧|⟦f:([^:⟧]+):([^:⟧]+)⟧|⟦r:([^⟧]+)⟧|⟦b:([^⟧]+)⟧|⟦iso:([^:⟧]+):([^:⟧]+):([^⟧]+)⟧|⟦sup:([^⟧]+)⟧|⟦rn:([^:⟧]+):([^⟧]+)⟧|⟦pf:([^:⟧]+):([^:⟧]+)⟧/g
  let out = "", last = 0, m
  while ((m = re.exec(esc)) !== null) {
    out += esc.slice(last, m.index)
    if (m[1] !== undefined) { const [pre, n, d, post] = m[1].split("¦"); out += await svgToInlineImg(rootFracSvg(pre || "", n || "", d || "", post || ""), FRAC_VALIGN) }
    else if (m[4] !== undefined) out += await svgToInlineImg(rootSvg(m[4]), ROOT_VALIGN)
    else if (m[5] !== undefined) out += `<sub>${m[5]}</sub>`
    else if (m[6] !== undefined) out += `<span style="white-space:nowrap;"><span style="display:inline-flex; flex-direction:column; align-items:flex-end; text-align:right; vertical-align:-0.35em; font-size:0.62em; line-height:1.05; margin-right:0.05em;"><span>${m[6]}</span><span>${m[7]}</span></span>${m[8]}</span>`
    else if (m[9] !== undefined) out += `<sup style="font-size:0.72em; line-height:0; vertical-align:0.55em;">${m[9]}</sup>`
    else if (m[10] !== undefined) out += await svgToInlineImg(rootSvg(m[11], m[10]), ROOT_VALIGN)
    else if (m[12] !== undefined) out += await svgToInlineImg(pfracSvg(m[12], m[13]), FRAC_VALIGN)
    else out += await svgToInlineImg(fracSvg(m[2], m[3]), FRAC_VALIGN)
    last = m.index + m[0].length
  }
  return out + esc.slice(last)
}

// html2canvas ненадёжно рисует живые <img src="*.svg"> (известное ограничение библиотеки,
// не чинится через crossorigin/CORS-заголовки) — растеризуем SVG в PNG сами через offscreen
// canvas и вставляем уже готовую растровую картинку, это html2canvas снимает без проблем.
// Маленькие SVG (формулы вроде дроби №6) НЕ растягиваем до maxWidth — иначе формула
// раздувается на всю страницу; берём их натуральную ширину. Возвращает { dataUrl, width }.
async function svgUrlToPng(url, maxWidth = 380) {
  const svgText = await (await fetch(url)).text()
  const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }))
  const img = new Image()
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error("Не удалось загрузить SVG: " + url))
      img.src = blobUrl
    })
    const width = Math.min(maxWidth, img.naturalWidth || maxWidth)
    const aspect = (img.naturalHeight || 300) / (img.naturalWidth || 400)
    const canvas = document.createElement("canvas")
    canvas.width = width * 2
    canvas.height = Math.round(width * 2 * aspect)
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return { dataUrl: canvas.toDataURL("image/png"), width }
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

const CONTAINER_W = 750   // ширина offscreen-контейнера в px; блоки масштабируются на ширину страницы

// Снимает один HTML-блок в canvas (кириллица рендерится браузером как есть — иначе пришлось бы
// вшивать в PDF отдельный кириллический шрифт). Ждёт загрузки картинок перед снимком.
async function renderBlock(innerHtml) {
  const el = document.createElement("div")
  el.style.cssText = `position:fixed; left:-9999px; top:0; width:${CONTAINER_W}px; background:#fff; font-family:Arial,sans-serif; color:#1c1c1e;`
  el.innerHTML = innerHtml
  document.body.appendChild(el)
  const imgs = [...el.querySelectorAll("img")]
  await Promise.all(imgs.map((img) => img.complete
    ? Promise.resolve()
    : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve })))
  try {
    return await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" })
  } finally {
    document.body.removeChild(el)
  }
}

// Рендерит каждое задание отдельным блоком и раскладывает по страницам A4 так, чтобы задание
// НИКОГДА не разрывалось разворотом страниц — если блок не влезает в остаток текущей страницы,
// он целиком переносится на следующую.
export async function generateVariantPdf({ title, examType, tasks }) {
  const images = await Promise.all(
    tasks.map((t) => t.image_url ? svgUrlToPng(t.image_url) : Promise.resolve(null))
  )

  const headerCanvas = await renderBlock(
    `<div style="padding:40px 40px 18px;">
      <div style="font-size:22px; font-weight:600; margin-bottom:4px;">${escapeHtml(title)}</div>
      <div style="font-size:14px; color:#666;">${escapeHtml(examType)}, часть 1</div>
    </div>`
  )
  const taskCanvases = []
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    taskCanvases.push(await renderBlock(
      `<div style="padding:16px 40px;">
        <div style="font-weight:600; font-size:15px; margin-bottom:6px;">Задание ${t.number}</div>
        ${t.condition_text ? `<div style="font-size:14px; white-space:pre-wrap; line-height:1.5;">${await renderTaskMathPdf(t.condition_text)}</div>` : ""}
        ${images[i] ? `<img src="${images[i].dataUrl}" style="width:${images[i].width}px; display:block; margin-top:10px;" />` : ""}
      </div>`
    ))
  }

  const pdf = new jsPDF({ unit: "px", format: "a4" })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  let y = 0
  const place = (canvas, isFirst) => {
    const h = (canvas.height * pageW) / canvas.width
    if (!isFirst && y + h > pageH) { pdf.addPage(); y = 0 }
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, y, pageW, h)
    y += h
  }

  place(headerCanvas, true)
  taskCanvases.forEach((c) => place(c, false))

  return pdf.output("blob")
}
