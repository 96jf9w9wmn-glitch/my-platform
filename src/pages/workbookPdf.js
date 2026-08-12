import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { renderTaskMathPdf, renderBlock, svgUrlToPng, CONTAINER_W } from "./variantPdf"

// Рабочая тетрадь: условие задания, а под ним — поле в клетку, где ученик пишет решение
// от руки. Печатается на обычном принтере, поэтому вся геометрия считается в миллиметрах
// (jsPDF unit "mm"), а клетка — ровно 5 мм, как в школьной тетради.
//
// Условия снимаются html2canvas (кириллица + формулы-картинки — см. variantPdf.js), а сама
// СЕТКА рисуется векторными линиями jsPDF, а не картинкой: на печати линии остаются
// тонкими и чёткими при любом масштабе, а страница тетради весит килобайты вместо мегабайт.

const PAGE_W = 210, PAGE_H = 297
const MARGIN = { top: 15, bottom: 16, left: 15, right: 15 }
const CONTENT_W = PAGE_W - MARGIN.left - MARGIN.right    // 180 мм = ровно 36 клеток
const PAGE_BOTTOM = PAGE_H - MARGIN.bottom

const CELL = 5                 // сторона клетки, мм
const GAP_COND_FIELD = 3       // от условия до поля
const GAP_TASKS = 9            // между заданиями
const MIN_FIELD = 35           // поле меньше этого бессмысленно — задание уезжает на след. страницу
const ANSWER_LINE_H = 8        // строка «Ответ: ______» под полем

const GRID_COLOR = [183, 199, 219]   // цвет клетки — блёкло-синий, как в тетради
const FRAME_COLOR = [148, 163, 184]
const RULE_COLOR = [100, 116, 139]

// Высота поля для письма (мм). Задания части 2 требуют полного решения — им место
// в полстраницы и больше; коротким заданиям части 1 хватает нескольких строк.
export const FIELD_PRESETS = {
  compact: 45,
  medium: 75,
  large: 115,
  page: PAGE_BOTTOM - MARGIN.top,
}

// Номера с развёрнутым решением: у них поле всегда крупное (режим «auto»).
function isLongTask(examType, number) {
  if (examType === "ОГЭ") return number >= 20
  if (examType === "ЕГЭ Профиль") return number >= 13
  return false
}

function fieldHeightFor(space, examType, task) {
  if (typeof space === "number") return space
  if (space === "auto") return isLongTask(examType, task.number) ? FIELD_PRESETS.large : FIELD_PRESETS.medium
  return FIELD_PRESETS[space] || FIELD_PRESETS.medium
}

// Картинка задания. Генераторы отдают SVG (data-URL) — его надо растеризовать самим,
// html2canvas живые SVG рисует ненадёжно; готовый растр из банка вставляем как есть.
async function taskImage(url) {
  if (!url) return null
  const isSvg = url.startsWith("data:image/svg") || /\.svg($|\?)/i.test(url)
  if (!isSvg) return { dataUrl: url, width: 380 }
  try {
    return await svgUrlToPng(url)
  } catch {
    return null
  }
}

// Сетка в клетку + рамка. Возвращает фактическую высоту (кратна клетке, чтобы у поля
// не оставалось обрезанного ряда).
function drawGrid(pdf, x, y, w, h) {
  const cols = Math.floor(w / CELL)
  const rows = Math.floor(h / CELL)
  if (cols < 1 || rows < 1) return 0
  const gw = cols * CELL, gh = rows * CELL

  pdf.setLineWidth(0.1)
  pdf.setDrawColor(...GRID_COLOR)
  for (let i = 1; i < cols; i++) pdf.line(x + i * CELL, y, x + i * CELL, y + gh)
  for (let j = 1; j < rows; j++) pdf.line(x, y + j * CELL, x + gw, y + j * CELL)

  pdf.setLineWidth(0.3)
  pdf.setDrawColor(...FRAME_COLOR)
  pdf.rect(x, y, gw, gh)
  return gh
}

// Подпись «Ответ:» — картинкой: кириллицу встроенными шрифтами jsPDF не написать.
// Снимается один раз на всю тетрадь и обрезается по чернилам с четырёх сторон, иначе к
// слову приклеился бы пустой хвост блока во всю ширину страницы и линия уехала бы вправо.
//
// Запас снизу (LABEL_PAD) обязателен: html2canvas рисует текст ниже DOM-бокса, и у блока
// высотой ровно в строку низ букв не попадал в снимок — подпись выходила срезанной пополам.
const LABEL_PAD = 24     // запас вокруг подписи в снимке, px
async function renderAnswerLabel() {
  const c = await renderBlock(
    `<div style="font-family:Arial,sans-serif; font-size:15px; color:#3a3a3c; padding:${LABEL_PAD}px 0;">Ответ:</div>`
  )
  const { width: w, height: h } = c
  const d = c.getContext("2d").getImageData(0, 0, w, h).data
  let left = w, right = 0, top = h, bottom = 0
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4
      if (d[i] < 200 && d[i + 1] < 200 && d[i + 2] < 200) {
        if (px < left) left = px
        if (px > right) right = px
        if (py < top) top = py
        if (py > bottom) bottom = py
      }
    }
  }
  if (right < left || bottom < top) return null
  const x0 = Math.max(0, left - 2), y0 = Math.max(0, top - 2)
  const crop = document.createElement("canvas")
  crop.width = Math.min(w, right + 3) - x0
  crop.height = Math.min(h, bottom + 3) - y0
  const ctx = crop.getContext("2d")
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, crop.width, crop.height)
  ctx.drawImage(c, -x0, -y0)
  // размеры в мм — по фактическому масштабу снимка (вся его ширина = ширина колонки),
  // чтобы подпись была того же кегля, что и текст условий, а не растянутой под заданную высоту
  const mm = CONTENT_W / w
  return { dataUrl: crop.toDataURL("image/png"), w: crop.width * mm, h: crop.height * mm }
}

// Строка «Ответ: ______» под полем: подпись-картинка + векторная линия.
function drawAnswerLine(pdf, label, x, y, w) {
  pdf.addImage(label.dataUrl, "PNG", x, y - label.h + 1, label.w, label.h)
  pdf.setLineWidth(0.3)
  pdf.setDrawColor(...RULE_COLOR)
  pdf.line(x + label.w + 2, y + 1, Math.min(x + w, x + label.w + 2 + 70), y + 1)
}

const escapeHtml = (s) => {
  const div = document.createElement("div")
  div.textContent = String(s ?? "")
  return div.innerHTML
}

// html2canvas-блок → размещение на странице; возвращает высоту в мм.
const blockHeight = (canvas) => (canvas.height * CONTENT_W) / canvas.width

// ── снимок условий пачками ───────────────────────────────────────────────────
// Один вызов html2canvas стоит около секунды независимо от размера блока: библиотека
// клонирует документ и разбирает весь CSS (а у нас Tailwind). Двадцать пять заданий по
// снимку — это полминуты ожидания, поэтому условия снимаются пачкой и снимок режется на
// задания. Резать по DOM-боксам безопасно: между заданиями стоит зазор SEP, а граница
// проходит по его середине — вертикальный сдвиг текста у html2canvas (полстроки) в него
// заведомо укладывается. Внутри сегмента лишние поля снимаются по «чернилам».
const SNAP_SCALE = 2
const SEP = 80              // зазор между заданиями в снимке, px
const BATCH_MAX_H = 1800    // максимум CSS-px на один снимок (иначе canvas раздувается)
const INK_PAD = 4           // сколько белого оставить вокруг чернил, px снимка

// Границы чернил внутри полосы снимка [top, bot).
function inkRange(data, w, top, bot) {
  let first = -1, last = -1
  for (let y = top; y < bot; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (data[i] < 245 && data[i + 1] < 245 && data[i + 2] < 245) {
        if (first < 0) first = y
        last = y
        break
      }
    }
  }
  return first < 0 ? null : { first, last }
}

function cropStripe(canvas, data, top, bot) {
  const ink = inkRange(data, canvas.width, top, bot)
  const y0 = ink ? Math.max(top, ink.first - INK_PAD) : top
  const y1 = ink ? Math.min(bot, ink.last + INK_PAD) : bot
  const out = document.createElement("canvas")
  out.width = canvas.width
  out.height = Math.max(1, y1 - y0)
  const ctx = out.getContext("2d")
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas, 0, -y0)
  return out
}

// Снимает пачку условий одним html2canvas и возвращает по картинке на задание.
async function snapBatch(htmls) {
  const el = document.createElement("div")
  el.style.cssText = `position:fixed; left:-9999px; top:0; width:${CONTAINER_W}px; background:#fff; font-family:Arial,sans-serif; color:#1c1c1e;`
  el.innerHTML = htmls.map((h) => `<div style="padding-bottom:${SEP}px;">${h}</div>`).join("")
  document.body.appendChild(el)
  try {
    const imgs = [...el.querySelectorAll("img")]
    await Promise.all(imgs.map((img) => img.complete
      ? Promise.resolve()
      : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve })))
    const kids = [...el.children]
    const tops = kids.map((k) => k.offsetTop)
    const totalCss = el.offsetHeight
    const canvas = await html2canvas(el, { scale: SNAP_SCALE, useCORS: true, backgroundColor: "#ffffff" })
    const k = canvas.height / totalCss
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
    return kids.map((_, i) => {
      const top = Math.max(0, Math.round((i === 0 ? 0 : tops[i] - SEP / 2) * k))
      const bot = Math.min(canvas.height, Math.round((i === kids.length - 1 ? totalCss : tops[i + 1] - SEP / 2) * k))
      const stripe = cropStripe(canvas, data, top, bot)
      return { dataUrl: stripe.toDataURL("image/jpeg", 0.92), h: blockHeight(stripe) }
    })
  } finally {
    document.body.removeChild(el)
  }
}

// Все условия → картинки. Пачка набирается по высоте; если снимок пачки не удался,
// эти задания честно доснимаются по одному (медленно, зато без потерь).
async function snapAll(htmls) {
  const probe = document.createElement("div")
  probe.style.cssText = `position:fixed; left:-9999px; top:0; width:${CONTAINER_W}px; font-family:Arial,sans-serif;`
  probe.innerHTML = htmls.map((h) => `<div>${h}</div>`).join("")
  document.body.appendChild(probe)
  const heights = [...probe.children].map((k) => k.offsetHeight)
  document.body.removeChild(probe)

  const batches = []
  let cur = [], curH = 0
  htmls.forEach((h, i) => {
    const need = heights[i] + SEP
    if (cur.length && curH + need > BATCH_MAX_H) { batches.push(cur); cur = []; curH = 0 }
    cur.push(h); curH += need
  })
  if (cur.length) batches.push(cur)

  const out = []
  for (const batch of batches) {
    try {
      out.push(...await snapBatch(batch))
    } catch {
      for (const h of batch) {
        // запас снизу и здесь: без него html2canvas срезает низ последней строки
        // (текст он рисует ниже DOM-бокса), а лишнее белое поле снимет обрезка по чернилам
        const c = await renderBlock(`<div style="padding-bottom:${SEP / 2}px;">${h}</div>`)
        const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data
        const stripe = cropStripe(c, data, 0, c.height)
        out.push({ dataUrl: stripe.toDataURL("image/jpeg", 0.92), h: blockHeight(stripe) })
      }
    }
  }
  return out
}

/**
 * Собирает рабочую тетрадь.
 * tasks — задания в формате банка ({ number, condition_text, condition_tail, image_url, answer }).
 * space — "compact" | "medium" | "large" | "page" | "auto" | число миллиметров.
 */
export async function generateWorkbookPdf({
  title = "Рабочая тетрадь",
  subtitle = "",
  examType = "",
  tasks = [],
  space = "auto",
  answersPage = true,
  answerLine = true,
  showBankNumber = true,
}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" })
  let y = MARGIN.top

  const newPage = () => { pdf.addPage(); y = MARGIN.top }

  // Шапка первой страницы: название, подзаголовок и строки «Ученик / Дата» —
  // распечатанную тетрадь обычно подписывают от руки.
  const header = await renderBlock(
    `<div style="font-family:Arial,sans-serif; color:#1c1c1e;">
      <div style="font-size:26px; font-weight:700; letter-spacing:-0.3px;">${escapeHtml(title)}</div>
      ${subtitle ? `<div style="font-size:15px; color:#6b7280; margin-top:4px;">${escapeHtml(subtitle)}</div>` : ""}
      <div style="margin-top:18px; font-size:15px; color:#3a3a3c;">
        <span style="display:inline-block; margin-right:40px;">Ученик: ______________________________</span>
        <span style="display:inline-block;">Дата: ______________</span>
      </div>
      <div style="border-bottom:2px solid #1c1c1e; margin-top:14px;"></div>
    </div>`
  )
  pdf.addImage(header.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN.left, y, CONTENT_W, blockHeight(header))
  y += blockHeight(header) + 6

  const answerLabel = answerLine ? await renderAnswerLabel() : null

  // Сначала снимаем ВСЕ условия (пачками) и держим их картинками, а не холстами: два
  // десятка canvas'ов по 1500px на телефоне съели бы всю память. Раскладка идёт вторым
  // проходом — зная высоту следующего задания, поле текущего можно дотянуть до низа
  // страницы и не оставлять там дыру в полстраницы.
  const htmls = []
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const img = await taskImage(t.image_url)
    const num = showBankNumber && t.number
      ? `<span style="color:#8e8e93; font-weight:500; font-size:13px; margin-left:8px;">№${t.number}</span>`
      : ""
    htmls.push(
      `<div style="font-family:Arial,sans-serif; color:#1c1c1e;">
        <div style="font-weight:700; font-size:16px; margin-bottom:6px;">Задание ${i + 1}${num}</div>
        ${t.condition_text ? `<div style="font-size:15px; white-space:pre-wrap; line-height:1.5;">${await renderTaskMathPdf(t.condition_text)}</div>` : ""}
        ${img ? `<img src="${img.dataUrl}" style="width:${img.width}px; display:block; margin-top:10px;" />` : ""}
        ${t.condition_tail ? `<div style="font-size:15px; white-space:pre-wrap; line-height:1.5; margin-top:8px;">${await renderTaskMathPdf(t.condition_tail)}</div>` : ""}
      </div>`
    )
  }
  const blocks = (await snapAll(htmls)).map((b, i) => ({
    ...b,
    want: fieldHeightFor(space, examType, tasks[i]),
    extra: answerLabel && hasShortAnswer(tasks[i]) ? ANSWER_LINE_H : 0,
  }))

  // Сколько места нужно заданию как минимум (условие + самое маленькое поле).
  const minNeed = (b) => b.h + GAP_COND_FIELD + MIN_FIELD + b.extra

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    // Задание и поле под него не разрываются страницей: если на остатке не помещается
    // даже минимальное поле — всё задание уходит на следующую страницу.
    if (y > MARGIN.top && y + minNeed(b) > PAGE_BOTTOM) newPage()

    pdf.addImage(b.dataUrl, "JPEG", MARGIN.left, y, CONTENT_W, b.h)
    y += b.h + GAP_COND_FIELD

    const avail = PAGE_BOTTOM - y - b.extra
    let fieldH = Math.min(b.want, avail)
    // Следующему заданию остатка страницы всё равно не хватит (или заданий больше нет) —
    // отдаём остаток текущему полю: пустой хвост страницы ученику ни к чему.
    const next = blocks[i + 1]
    if (!next || avail - fieldH - GAP_TASKS < minNeed(next)) fieldH = avail

    y += drawGrid(pdf, MARGIN.left, y, CONTENT_W, fieldH)
    if (b.extra) { y += ANSWER_LINE_H - 2; drawAnswerLine(pdf, answerLabel, MARGIN.left, y, CONTENT_W); y += 2 }
    y += GAP_TASKS
  }

  if (answersPage) {
    const rows = tasks
      .map((t, i) => [i + 1, t.answer])
      .filter(([, a]) => a != null && String(a).trim() !== "")
    if (rows.length) {
      newPage()
      const block = await renderBlock(
        `<div style="font-family:Arial,sans-serif; color:#1c1c1e;">
          <div style="font-size:20px; font-weight:700; border-bottom:2px solid #1c1c1e; padding-bottom:6px;">Ответы</div>
          <div style="font-size:13px; color:#8e8e93; margin:8px 0 12px;">Лист для проверяющего — ученику не выдавать.</div>
          <table style="border-collapse:collapse; font-size:15px;">
            ${rows.map(([n, a]) => `<tr><td style="padding:3px 14px 3px 0; font-weight:600; white-space:nowrap;">${n}</td><td style="padding:3px 0;">${escapeHtml(a)}</td></tr>`).join("")}
          </table>
        </div>`
      )
      pdf.addImage(block.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN.left, y, CONTENT_W, blockHeight(block))
    }
  }

  // Номера страниц — цифры, их встроенный шрифт jsPDF рисует без кириллических проблем.
  const total = pdf.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p)
    pdf.setFontSize(9)
    pdf.setTextColor(150)
    pdf.text(String(p), PAGE_W / 2, PAGE_H - 8, { align: "center" })
  }

  return pdf.output("blob")
}

// Короткий ответ (число, «12/5», «−4; 1») — под полем есть смысл в строке «Ответ:».
// У доказательств и развёрнутых решений ответа-строки нет.
function hasShortAnswer(t) {
  const a = String(t.answer ?? "").trim()
  return a !== "" && a.length <= 24 && a !== "Доказано."
}
