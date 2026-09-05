// Разбор загруженного файла домашней работы на отдельные задания.
//
// Репетитор приносит один файл (PDF-раздатку или фотографию страницы), где
// задания идут подряд под номерами. Отдать такой файл целиком — значит вернуть
// ученика к бумаге: он не может ответить по заданию, а кабинет не может ничего
// проверить. Здесь файл превращается в то же, чем является работа из банка, —
// список заданий, у каждого своя картинка условия (`bank_tasks[].image_url`) и
// своё поле ответа.
//
// Границы заданий ищутся ДВУМЯ способами, потому что файлы бывают двух родов:
//   * PDF с текстовым слоем — берём сам текст с координатами и находим строки,
//     начинающиеся с номера. Это точно: номер, отступ и порядок видны как есть,
//     заодно достаётся текст условия (он нужен в `description` — на нём держатся
//     список работ, телеграм-бот и все записи, выданные раньше).
//   * фотография и PDF-скан — текста нет, поэтому смотрим на сами пиксели:
//     ищем пустые горизонтальные полосы между блоками. Это догадка, а не факт.
//
// Поэтому нарезка НЕ применяется молча: движок только ПРЕДЛАГАЕТ границы, а
// решает репетитор в редакторе (components/SplitTasksModal.jsx). Ошибись
// автоматика без него — ученик получил бы половину условия и не заметил бы.
//
// pdf.js подгружается динамически: он весит больше самого кабинета, а нужен
// одному экрану из десятка.

// Ширина, до которой ужимается страница при разборе. Меньше — на чертеже
// пропадают тонкие линии, больше — телефон не тянет несколько страниц разом.
const PAGE_WIDTH = 1240
// Дальше этого файл не разбираем: столько заданий в одну домашнюю работу не
// кладут, а память на телефоне кончится раньше, чем польза.
export const MAX_PAGES = 40

// Safari не умеет асинхронно перебирать поток (`for await … of ReadableStream`),
// а pdf.js читает им текстовый слой страницы. Из-за этого РАЗБОР ЛЮБОГО PDF в
// Safari падал сразу («undefined is not a function … value of readableStream»),
// хотя в Chrome работал. Дописываем перебор сами — это ровно то, что делает
// стандарт, и на браузерах с поддержкой ничего не меняется.
function patchStreamIteration() {
  if (typeof ReadableStream === "undefined") return
  const proto = ReadableStream.prototype
  if (proto[Symbol.asyncIterator]) return
  const iterate = function ({ preventCancel = false } = {}) {
    const reader = this.getReader()
    return {
      next: () => reader.read(),
      async return(value) {
        if (!preventCancel) await reader.cancel(value)
        reader.releaseLock()
        return { done: true, value }
      },
      [Symbol.asyncIterator]() { return this },
    }
  }
  proto[Symbol.asyncIterator] = iterate
  if (!proto.values) proto.values = iterate
}

let pdfLib = null
async function loadPdfLib() {
  if (pdfLib) return pdfLib
  patchStreamIteration()
  const lib = await import("pdfjs-dist/build/pdf.mjs")
  // Воркер собирает Vite (`?worker`), а не адрес в GlobalWorkerOptions: по
  // адресу браузер получил бы модуль с несобранными импортами и повис бы молча
  // (проверено — разбор просто не заканчивался). За CDN pdf.js при этом не
  // ходит, чего наш CSP всё равно не пустил бы.
  const { default: PdfWorker } = await import("pdfjs-dist/build/pdf.worker.mjs?worker")
  lib.GlobalWorkerOptions.workerPort = new PdfWorker()
  pdfLib = lib
  return lib
}

// --- строки текстового слоя -------------------------------------------------

// Фрагменты pdf.js приходят по одному куску на смену шрифта и в порядке
// отрисовки, а не чтения. Собираем из них строки: один y — одна строка.
export function groupLines(items, pageHeight, scale = 1) {
  const lines = []
  for (const it of items) {
    const str = it.str
    if (!str || !str.trim()) continue
    const h = Math.abs(it.transform?.[3] || it.height || 10) * scale
    const x = it.transform[4] * scale
    // pdf.js считает y снизу вверх, картинка — сверху вниз.
    const y = (pageHeight - it.transform[5]) * scale
    const w = (it.width || 0) * scale
    const near = lines.find((l) => Math.abs(l.y - y) <= Math.max(3, l.h * 0.6))
    if (near) {
      near.parts.push({ x, w, str })
      near.h = Math.max(near.h, h)
    } else {
      lines.push({ y, h, parts: [{ x, w, str }] })
    }
  }
  return lines
    .map((l) => {
      const parts = l.parts.slice().sort((a, b) => a.x - b.x)
      // Между фрагментами пробела в PDF нет — он есть только в разметке. Если
      // между концом одного куска и началом другого зазор, ставим пробел сами:
      // иначе номер слипается с заголовком («1Задание 1»), и строка перестаёт
      // читаться как начало задания.
      let text = ""
      let end = null
      for (const p of parts) {
        if (end != null && p.x - end > Math.max(1.5, l.h * 0.22) && !/\s$/.test(text)) text += " "
        text += p.str
        end = p.x + p.w
      }
      return { y: l.y, h: l.h, x: parts[0].x, text: text.trim() }
    })
    .filter((l) => l.text)
    .sort((a, b) => a.y - b.y)
}

// Номер в начале строки: «7.», «7)», «№7», «Задание 7», «Задача 7» и голое «7»
// отдельным фрагментом слева от текста (так номер стоит в раздатках, собранных
// таблицей). Возвращает и остаток строки — он идёт в текст условия.
const NUM_PATTERNS = [
  /^(?:задание|задача|упражнение|упр\.?)\s*№?\s*(\d{1,2})\s*[.)]?\s*(.*)$/i,
  /^[№#]\s*(\d{1,2})\s*[.)]?\s*(.*)$/,
  /^(\d{1,2})\s*[.)]\s*(.*)$/,
  /^(\d{1,2})\s+(\S.*)$/,
  /^(\d{1,2})$/,
]

function numberAt(text) {
  for (const re of NUM_PATTERNS) {
    const m = text.match(re)
    if (m) return { n: Number(m[1]), tail: (m[2] || "").trim() }
  }
  return null
}

// Левое поле основного текста: медиана левого края у длинных строк. Номер
// задания стоит левее него — по этому отступу номер и отличается от числа,
// которым просто начинается предложение («10 яблок разделили…»).
function bodyLeft(lines) {
  const xs = lines.filter((l) => l.text.length > 25).map((l) => l.x).sort((a, b) => a - b)
  if (!xs.length) return null
  return xs[Math.floor(xs.length / 2)]
}

// Начала заданий на одной странице. Кандидатов много (номер года, число в
// таблице), поэтому берём только те, что идут ВОЗРАСТАЮЩЕЙ цепочкой: у настоящей
// нумерации 1, 2, 3 подряд, у случайных чисел порядка нет.
export function detectStarts(lines) {
  const left = bodyLeft(lines)
  const cands = []
  for (const l of lines) {
    const hit = numberAt(l.text)
    if (!hit || !(hit.n > 0) || hit.n > 60) continue
    // Строка с номером и длинным текстом годится и без отступа: «1. Найдите…».
    const indented = left == null || l.x <= left - 2
    const explicit = /^(?:задание|задача|упражнение|упр\.?|[№#])/i.test(l.text) || /^\d{1,2}\s*[.)]/.test(l.text)
    if (!indented && !explicit) continue
    // y строки — это базовая линия, по ней буквы режутся пополам: в конец
    // предыдущего задания попадала шапка следующего. Поднимаем границу над
    // строкой целиком и даём немного воздуха.
    cands.push({ y: Math.max(0, l.y - l.h * 1.35), n: hit.n, tail: hit.tail })
  }
  return cands
}

// Из кандидатов всех страниц оставляем одну возрастающую цепочку — самую
// длинную. Работа, где после «5» идёт «2», означает, что во второй раз номер
// найден не там (число из таблицы, год, номер страницы).
export function chainStarts(all) {
  if (!all.length) return []
  // Классический «наибольшая возрастающая подпоследовательность», но по номеру:
  // порядок задан самим документом, менять его местами нельзя.
  const best = new Array(all.length).fill(1)
  const prev = new Array(all.length).fill(-1)
  let end = 0
  for (let i = 0; i < all.length; i++) {
    for (let j = 0; j < i; j++) {
      if (all[j].n < all[i].n && best[j] + 1 > best[i]) { best[i] = best[j] + 1; prev[i] = j }
    }
    if (best[i] > best[end]) end = i
  }
  const out = []
  for (let i = end; i !== -1; i = prev[i]) out.push(all[i])
  return out.reverse()
}

// --- пустые полосы на картинке ---------------------------------------------

// Файл без текстового слоя: границу задания ищем по пикселям. Строка считается
// пустой, если тёмных точек в ней почти нет; несколько пустых строк подряд —
// промежуток между заданиями. Берём самые широкие промежутки: между заданиями
// воздуха больше, чем между строками одного условия.
export function blankGaps(gray, width, height, want = 12) {
  // Порог «тёмного» считаем от самой страницы: у скана фон бывает серый или
  // желтоватый, и фиксированные 170 объявляли тёмной всю страницу — пустых
  // полос не находилось вовсе, а с ними и границ.
  const hist = new Uint32Array(256)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++
  let seen = 0
  let bg = 255
  for (let v = 255; v >= 0; v--) { seen += hist[v]; if (seen > gray.length * 0.5) { bg = v; break } }
  const darkLimit = Math.max(60, Math.min(200, bg - 45))
  const rowDark = new Float32Array(height)
  for (let y = 0; y < height; y++) {
    let dark = 0
    for (let x = 0; x < width; x++) if (gray[y * width + x] < darkLimit) dark++
    rowDark[y] = dark / width
  }
  const gaps = []
  let start = -1
  for (let y = 0; y < height; y++) {
    const blank = rowDark[y] < 0.004
    if (blank && start === -1) start = y
    if (!blank && start !== -1) {
      if (y - start >= height * 0.012) gaps.push({ from: start, to: y, size: y - start })
      start = -1
    }
  }
  // Промежуток в самом верху и в самом низу — это поля страницы, а не граница.
  const inner = gaps.filter((g) => g.from > height * 0.03 && g.to < height * 0.97)
  if (!inner.length) return []
  // Между строками одного условия воздух тоже есть, поэтому граница — только
  // промежуток заметно больше обычного. Меру «обычного» берём у самой страницы
  // (медиана): у листа с крупным шрифтом и у убористой раздатки она разная, а
  // одно число на все файлы резало бы то на абзацах, то не резало вовсе.
  // Ищем не «широкие» промежутки вообще, а место, где они делятся на два рода:
  // межстрочные и междузадачные. Это самый большой скачок в ряду размеров. Нет
  // выраженного скачка (страница однородная) — берём просто самые широкие:
  // ноль границ хуже, чем несколько лишних, их убрать — одно нажатие.
  const sizes = inner.map((g) => g.size).sort((a, b) => a - b)
  let limit = 0
  let jump = 1
  for (let i = 0; i < sizes.length - 1; i++) {
    const ratio = sizes[i + 1] / Math.max(1, sizes[i])
    if (ratio > jump && sizes[i + 1] >= height * 0.015) { jump = ratio; limit = sizes[i + 1] }
  }
  if (jump < 1.35) limit = 0
  return inner
    .filter((g) => g.size >= limit)
    .sort((a, b) => b.size - a.size)
    .slice(0, want)
    .map((g) => Math.round((g.from + g.to) / 2))
    .sort((a, b) => a - b)
}

function grayscale(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height)
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Прозрачное считаем белым: у PNG-скана фон часто именно такой.
    const a = data[i + 3] / 255
    gray[p] = 255 - a * (255 - (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114))
  }
  return gray
}

// --- разбор файла -----------------------------------------------------------

const canvasOf = (w, h) => {
  const c = document.createElement("canvas")
  c.width = w; c.height = h
  return c
}

async function readPdf(file, onProgress) {
  const lib = await loadPdfLib()
  const buf = new Uint8Array(await file.arrayBuffer())
  const pdf = await lib.getDocument({ data: buf, isEvalSupported: false }).promise
  const total = Math.min(pdf.numPages, MAX_PAGES)
  const pages = []
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const scale = PAGE_WIDTH / base.width
    const vp = page.getViewport({ scale })
    const canvas = canvasOf(Math.round(vp.width), Math.round(vp.height))
    const ctx = canvas.getContext("2d")
    // Белая подложка: у PDF фон прозрачный, а задание уедет ученику картинкой —
    // в тёмной теме чёрное на чёрном не читалось бы.
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // intent: "print" — не «печать», а способ отрисовки: обычный режим гонит
    // рендер через requestAnimationFrame, и стоит переключить вкладку, как
    // разбор встаёт до возвращения (проверено — файл не заканчивал
    // разбираться вовсе). Печатный проход идёт сам по себе и даёт тот же вид
    // страницы, что уходит на бумагу.
    await page.render({ canvasContext: ctx, viewport: vp, intent: "print" }).promise
    const content = await page.getTextContent()
    pages.push({
      canvas,
      width: canvas.width,
      height: canvas.height,
      lines: groupLines(content.items, base.height, scale),
    })
    onProgress?.(i, total)
  }
  pdf.destroy?.()
  return pages
}

async function readImage(file, onProgress) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("Файл не открылся как изображение"))
      el.src = url
    })
    const scale = Math.min(1, PAGE_WIDTH / img.naturalWidth)
    const canvas = canvasOf(Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    onProgress?.(1, 1)
    return [{ canvas, width: canvas.width, height: canvas.height, lines: [] }]
  } finally {
    URL.revokeObjectURL(url)
  }
}

// --- документ Word ------------------------------------------------------------

// .docx репетиторы приносят чаще, чем PDF, а нарисовать его в браузере нечем:
// это zip с XML, а не страницы. Раскладывает его docx-preview — он же
// восстанавливает формулы (OMML → MathML) и чертежи (картинки data-URI).
// Дальше документ надо превратить в такие же страницы-картинки, как у PDF.
//
// Рисует их САМ БРАУЗЕР через <foreignObject>: html2canvas, который у нас уже
// есть, рисует свою копию разметки и MathML не понимает — формулы из условий
// просто исчезали, а это половина математики. Ограничение приёма: картинка
// собирается из строки, и вся страница целиком в неё не влезает (документ на
// полсотни заданий — это 16 МБ разметки, и браузер молча рисует пустоту).
// Поэтому в каждый кусок кладутся только те блоки, что в него попали.
const DOCX_WIDTH = 900
const DOCX_CHUNK = 1500

const serializer = typeof XMLSerializer !== "undefined" ? new XMLSerializer() : null
const xmlEscape = (s) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))

// Абзацы, заголовки и таблицы документа с их положением — из них собираются и
// куски страниц, и строки для поиска номеров заданий. Именно абзацы, а не дети
// корня: docx-preview кладёт весь документ ОДНИМ <article>, и по детям корня
// блок получался ровно один — на всю высоту, отчего не находилось ни одного
// номера, а в каждую картинку уходил весь документ целиком.
const BLOCK_SEL = "p, h1, h2, h3, h4, h5, h6, table, ul, ol, blockquote, figure"

function docxBlocks(host) {
  const base = host.getBoundingClientRect()
  // Таблица и список идут целиком: их строки — не отдельные задания, а части
  // одного, и резать между ними нельзя.
  const nodes = Array.from(host.querySelectorAll(BLOCK_SEL))
    .filter((el) => el.parentElement === host || !el.parentElement?.closest("table, ul, ol"))
  const out = []
  for (const el of nodes) {
    const box = el.getBoundingClientRect()
    if (box.height <= 0) continue
    out.push({ el, top: box.top - base.top, height: box.height, left: box.left - base.left })
  }
  return out.sort((a, b) => a.top - b.top)
}

// Разметка куска: сами блоки плюс все их обёртки (секция, article, таблица
// стилей документа). Без обёрток теряются поля страницы и ширина колонки —
// текст в картинке расходится с тем, что репетитор видел в редакторе.
function shellFor(host, blocks) {
  const root = host.cloneNode(false)
  // Сам контейнер живёт за экраном (position:absolute; left:-20000px). Внутри
  // картинки это увезло бы страницу за её край — рисовалась чистая белизна.
  root.setAttribute("style", `width:${DOCX_WIDTH}px;background:#fff`)
  const made = new Map([[host, root]])
  const shellOf = (el) => {
    if (made.has(el)) return made.get(el)
    const copy = el.cloneNode(false)
    // Верхние поля страницы обёртка добавила бы ЗАНОВО: положение блоков уже
    // посчитано с ними, и содержимое куска уезжало вниз на высоту полей —
    // задание разрезалось не там, где стоит граница. Боковые поля оставляем:
    // на них держится ширина колонки, а с ней и переносы строк.
    copy.style.paddingTop = "0"
    copy.style.marginTop = "0"
    shellOf(el.parentElement).appendChild(copy)
    made.set(el, copy)
    return copy
  }
  for (const b of blocks) shellOf(b.el.parentElement).appendChild(b.el.cloneNode(true))
  return root
}

async function svgToCanvas(html, width, height, offset, scale) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject x="0" y="${offset}" width="${width}" height="${Math.max(height, 1) + Math.abs(offset) + 4000}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;background:#fff">${html}</div>` +
    `</foreignObject></svg>`
  const img = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error("Страницу документа не удалось нарисовать"))
    // Именно data-URI, а не blob: последний считается чужим источником, и
    // снять с холста готовую картинку («холст испорчен») уже нельзя.
    el.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
  })
  const canvas = canvasOf(Math.round(width * scale), Math.round(height * scale))
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0)
  return canvas
}

async function readDocx(file, onProgress) {
  const dp = await import("docx-preview")
  const host = document.createElement("div")
  // За экраном, но в потоке: размеры блоков берутся у настоящей раскладки, а
  // у display:none их нет вовсе.
  host.style.cssText = `position:absolute;left:-20000px;top:0;width:${DOCX_WIDTH}px;background:#fff`
  document.body.appendChild(host)
  try {
    await dp.renderAsync(file, host, null, {
      className: "docx",
      inWrapper: false,
      breakPages: false,
      ignoreHeight: true,
      ignoreWidth: true,
      useBase64URL: true,
    })
    // Стили документа docx-preview кладёт в <style> — без них в картинке будет
    // голый текст без отступов и таблиц.
    const styles = Array.from(document.querySelectorAll("style"))
      .map((el) => el.textContent)
      .join("\n")
    const blocks = docxBlocks(host)
    if (!blocks.length) throw new Error("В документе не нашлось ни одного абзаца")

    const scale = PAGE_WIDTH / DOCX_WIDTH
    const total = Math.min(Math.ceil(host.scrollHeight / DOCX_CHUNK), MAX_PAGES)
    const pages = []
    for (let i = 0; i < total; i++) {
      const from = i * DOCX_CHUNK
      const to = Math.min(from + DOCX_CHUNK, host.scrollHeight)
      const inside = blocks.filter((b) => b.top + b.height > from && b.top < to)
      const head = inside.length ? inside[0].top : from
      // Сериализуем через XMLSerializer, а не outerHTML: внутри <foreignObject>
      // разметка разбирается как XML, и первый же <br> без закрытия рушит
      // картинку целиком (браузер молча отдаёт ошибку загрузки).
      const html = `<style>${xmlEscape(styles)}</style>` + serializer.serializeToString(shellFor(host, inside))
      const canvas = await svgToCanvas(html, DOCX_WIDTH, to - from, head - from, scale)
      pages.push({
        canvas,
        width: canvas.width,
        height: canvas.height,
        // Строки страницы — сами блоки: у документа они известны точно, и
        // номера заданий ищутся по ним же, что и в текстовом слое PDF.
        lines: inside.map((b) => ({
          y: (b.top - from + b.height) * scale,
          h: Math.min(b.height, 40) * scale,
          x: b.left * scale,
          text: (b.el.textContent || "").replace(/\s+/g, " ").trim(),
        })).filter((l) => l.text),
      })
      onProgress?.(i + 1, total)
    }
    return pages
  } finally {
    host.remove()
  }
}

const isDocx = (file) =>
  file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
  /\.docx$/i.test(file.name || "")

export const canSplit = (file) =>
  !!file && (file.type === "application/pdf" || /^image\//.test(file.type) ||
    /\.pdf$/i.test(file.name || "") || isDocx(file))

// Файл → страницы с картинкой и (для PDF) текстовым слоем, плюс предложенные
// границы заданий. Границы — в координатах страницы: { page, y }.
export async function splitSource(file, onProgress) {
  const pages = /^image\//.test(file.type) ? await readImage(file, onProgress)
    : isDocx(file) ? await readDocx(file, onProgress)
    : await readPdf(file, onProgress)

  // Сначала пробуем текстовый слой: он даёт и границу, и текст условия.
  const all = []
  pages.forEach((p, page) => detectStarts(p.lines).forEach((s) => all.push({ ...s, page })))
  let starts = chainStarts(all)

  // Текста нет (фото, скан) или нумерация не нашлась — идём по пикселям.
  if (starts.length < 2) {
    starts = []
    pages.forEach((p, page) => {
      const ctx = p.canvas.getContext("2d", { willReadFrequently: true })
      const gray = grayscale(ctx, p.width, p.height)
      // На первой странице первое задание начинается после заголовка, поэтому
      // верхнюю границу не ставим: её роль играет начало страницы.
      blankGaps(gray, p.width, p.height).forEach((y) => starts.push({ page, y, guess: true }))
    })
  }

  // Ни номеров, ни пустых полос — так бывает у плотной вёрстки и у скана с
  // шумом. Пустой разбор выглядит как поломка, поэтому ставим границу в начале
  // каждой страницы: «задание — страница» почти всегда неверно, но это
  // понятная отправная точка, от которой репетитор двигает линии.
  if (starts.length < 2) starts = pages.map((_, page) => ({ page, y: 0, guess: true }))

  return { pages, starts, guessed: starts.some((s) => s.guess) }
}

// --- сборка заданий ---------------------------------------------------------

// Кусок страницы от границы до следующей. Задание, переехавшее через разрыв
// страницы, склеивается из хвоста одной и начала другой — иначе ученик получил
// бы половину условия.
function cutRanges(pages, cuts) {
  const sorted = cuts.slice().sort((a, b) => a.page - b.page || a.y - b.y)
  const out = []
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i]
    const to = sorted[i + 1] || { page: pages.length - 1, y: pages[pages.length - 1].height }
    const parts = []
    for (let p = from.page; p <= to.page && p < pages.length; p++) {
      const top = p === from.page ? from.y : 0
      const bottom = p === to.page ? to.y : pages[p].height
      if (bottom - top > 8) parts.push({ page: p, top, bottom })
    }
    if (parts.length) out.push(parts)
  }
  return out
}

// Поля вокруг задания режем по самим пикселям: страница А4 с широкими полями
// на телефоне превращается в марку. Оставляем небольшой воздух.
function trimBox(ctx, w, h) {
  const { data } = ctx.getImageData(0, 0, w, h)
  let top = h, bottom = -1, left = w, right = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      if (data[i + 3] > 20 && lum < 205) {
        if (y < top) top = y
        if (y > bottom) bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }
  if (bottom < 0) return null
  const pad = Math.round(w * 0.015)
  return {
    x: Math.max(0, left - pad),
    y: Math.max(0, top - pad),
    w: Math.min(w, right + pad) - Math.max(0, left - pad),
    h: Math.min(h, bottom + pad) - Math.max(0, top - pad),
  }
}

// Текст задания из текстового слоя: строки, попавшие в границы куска. Нужен и
// ученику (условие читается голосом, ищется поиском), и всем местам, которые
// показывают работу одной строкой.
function textOf(pages, parts) {
  const out = []
  for (const part of parts) {
    for (const l of pages[part.page].lines) {
      // Строку относим к куску по её СЕРЕДИНЕ: послабление на всю высоту
      // затягивало в задание последнюю строку предыдущего («Источник: …»).
      const mid = l.y - l.h / 2
      if (mid >= part.top && mid <= part.bottom) out.push(l.text)
    }
  }
  // Номер задания снимаем: он и так стоит перед строкой в описании работы, а
  // «1. 1 Задание 1 …» читается как ошибка.
  if (out.length) {
    const hit = numberAt(out[0])
    if (hit) out[0] = hit.tail
  }
  return out.join(" ").replace(/\s+/g, " ").trim()
}

// Границы → готовые задания: картинка (data-URI) и текст условия.
export function buildTasks(pages, cuts, { quality = 0.82 } = {}) {
  return cutRanges(pages, cuts).map((parts, idx) => {
    const width = Math.max(...parts.map((p) => pages[p.page].width))
    const height = parts.reduce((s, p) => s + (p.bottom - p.top), 0)
    const canvas = canvasOf(width, Math.max(1, Math.round(height)))
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    let y = 0
    for (const part of parts) {
      const h = part.bottom - part.top
      ctx.drawImage(pages[part.page].canvas, 0, part.top, pages[part.page].width, h, 0, y, pages[part.page].width, h)
      y += h
    }
    const box = trimBox(ctx, canvas.width, canvas.height)
    let out = canvas
    if (box && (box.w < canvas.width || box.h < canvas.height)) {
      out = canvasOf(box.w, box.h)
      const octx = out.getContext("2d")
      octx.fillStyle = "#fff"
      octx.fillRect(0, 0, box.w, box.h)
      octx.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
    }
    return {
      n: idx + 1,
      image: out.toDataURL("image/jpeg", quality),
      text: textOf(pages, parts),
    }
  })
}
