import { renderTaskMathPdf, renderBlock, taskImage } from "./variantPdf"
import { renderTaskMath } from "../utils"
import { encodeCanvasAsync } from "../components/boardWorker"

// Снимок задания в PNG — чтобы задание можно было положить на доску. Доска знает
// только штрихи и растр (`tool: "image"`), поэтому условие со всеми дробями, корнями
// и чертежом снимается html2canvas тем же путём, что и в PDF варианта и тетради:
// формулы там уже картинки, а кириллицу рисует сам браузер.
//
// Ширина снимка в CSS-пикселях равна ширине листа на доске при масштабе 100%, поэтому
// кегль подобран так, чтобы условие читалось с проектора, а не только вблизи.
const SHEET_W = 620
const FS = 17
const RADIUS = 18          // скругление листа, css-px
// Лист снимается ВТРОЕ крупнее своей ширины на доске: доску увеличивают, и при
// двойном разрешении (как в PDF, где лист печатают в натуральную величину) чертёж
// на зуме расплывался. Больше трёх не берём — вес картинки растёт квадратично.
const SCALE = 3

const escapeHtml = (s) => {
  const div = document.createElement("div")
  div.textContent = String(s ?? "")
  return div.innerHTML
}

// Поля вокруг чертежа. Генераторы рисуют в холсте с запасом (у иных до сотни пустых
// пикселей сверху и полусотни снизу — это нормально для печатного листа, где чертёж
// стоит в колонке), но на доске лист получает пустой хвост под заданием. Поэтому перед
// вставкой поля обрезаем по чернилам, оставляя небольшой воздух.
//
// Возвращает картинку в том же виде ({dataUrl, width, height}), пересчитав размеры;
// если холст «испорчен» картинкой без CORS — отдаём исходную, вид важнее плотности.
const TRIM_PAD = 6        // сколько белого оставить вокруг чертежа, px исходника

async function trimImage(pic) {
  if (!pic?.dataUrl) return pic
  const img = new Image()
  if (!pic.dataUrl.startsWith("data:")) img.crossOrigin = "anonymous"
  try {
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = pic.dataUrl })
  } catch {
    return pic
  }
  const w = img.naturalWidth, h = img.naturalHeight
  if (!w || !h) return pic
  const c = document.createElement("canvas")
  c.width = w; c.height = h
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  let d
  try {
    d = ctx.getImageData(0, 0, w, h).data
  } catch {
    return pic
  }
  let top = -1, bottom = -1, left = w, right = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) {
        if (top < 0) top = y
        bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }
  if (top < 0) return pic                       // чертёж пустой — не трогаем
  const x0 = Math.max(0, left - TRIM_PAD), y0 = Math.max(0, top - TRIM_PAD)
  const x1 = Math.min(w, right + TRIM_PAD + 1), y1 = Math.min(h, bottom + TRIM_PAD + 1)
  const cw = x1 - x0, ch = y1 - y0
  if (cw === w && ch === h) return pic           // обрезать нечего
  const out = document.createElement("canvas")
  out.width = cw; out.height = ch
  const octx = out.getContext("2d")
  octx.fillStyle = "#ffffff"; octx.fillRect(0, 0, cw, ch)
  octx.drawImage(c, -x0, -y0)
  // масштаб «css-пиксель на пиксель картинки» сохраняем — чертёж не должен вырасти
  const k = (pic.width || w) / w
  return { dataUrl: out.toDataURL("image/png"), width: Math.round(cw * k), height: Math.round(ch * k) }
}

// В снимке есть хоть один не-белый пиксель? html2canvas, вызванный до готовности
// документа, отдаёт пустой белый холст — на доске это молча превращается в чистый лист
// вместо задания. Смотрим не сам лист, а его уменьшенную копию: getImageData тянет
// мегапиксели из видеопамяти обратно в память, а нам нужен только факт чернил.
// Уменьшение усредняет, но чёрный текст на белом остаётся заметно темнее порога.
function hasInk(canvas) {
  const w = Math.max(1, Math.min(240, canvas.width))
  const h = Math.max(1, Math.round((canvas.height * w) / canvas.width))
  const c = document.createElement("canvas")
  c.width = w; c.height = h
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h)
  ctx.drawImage(canvas, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) return true
  }
  return false
}

// Лист с заданием: мягкие скруглённые углы и волосяная рамка, чтобы на белой доске он
// не сливался с фоном. Лист снимается СВЕТЛЫМ всегда: под тёмную доску его перекрашивает
// сама доска при отрисовке (tintSheet в boardPaint.js), поэтому переключение темы
// перекрашивает и уже лежащие задания.
// Углы срезаются копированием во ВТОРОЙ холст, и это не расточительство: рисовать по
// холсту html2canvas нельзя. Он оставляет на своём контексте свою систему координат
// (масштаб съёмки и сдвиг на положение блока, а блок стоит за левым краем экрана, на
// -9999px). Любой наш контур попадает при этом далеко за пределы холста, и обрезка по
// нему (destination-in) стирает ЛИСТ ЦЕЛИКОМ — на доске оказывается пустое место.
// Проверено на боевой: лист пропадал именно так. У нового холста система координат
// своя и чистая.
function roundSheet(canvas) {
  const r = RADIUS * SCALE
  const out = document.createElement("canvas")
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext("2d")
  const path = new Path2D()
  // roundRect появился в Safari только в 16.4 — на старых iPad лист остаётся прямоугольным,
  // но не пропадает
  if (path.roundRect) path.roundRect(0.5, 0.5, out.width - 1, out.height - 1, r)
  else path.rect(0.5, 0.5, out.width - 1, out.height - 1)
  ctx.save()
  ctx.clip(path)
  ctx.drawImage(canvas, 0, 0)
  ctx.restore()
  ctx.lineWidth = SCALE
  ctx.strokeStyle = "rgba(0,0,0,.10)"
  ctx.stroke(path)
  return out
}

// ── Нативный рендер листа ──────────────────────────────────────────────────
// html2canvas стоит 0,4–1,0 с НА КАЖДЫЙ лист и всё это время держит главный
// поток (клон документа, от размера блока не зависит) — это и было «залагивало»
// при переносе задания. Тот же блок, отданный браузеру через SVG
// <foreignObject>, рисуется за единицы миллисекунд (замер 10.09.2026: 1–3 мс
// против 400–1000). Приём тот же, что в разборе Word-файлов (homeworkSplit.js).
//
// Формулы здесь — ЭКРАННЫЕ (renderTaskMath + правила .tmath-* из index.css),
// а не растровые из renderTaskMathPdf: те подогнаны под причуды html2canvas
// (он ставит inline-картинку выше, чем браузер), и нативному рендеру их поправки
// только мешают. Лист получается ровно таким, каким задание видно в модалке
// «Что уедет на доску». Правила берутся из живой таблицы стилей, поэтому
// правка .tmath-* в index.css доезжает и сюда; .dark и @media не берём — лист
// всегда светлый и одной ширины.
//
// Не вышло (старый браузер, испорченная разметка, пустой снимок) — молча
// возвращаемся к html2canvas, как было.
// Одинарные кавычки не случайно: стек попадает в атрибут style="…" внутри XML,
// и двойные кавычки внутри него рушат разметку — картинка молча не грузится.
const SHEET_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
let sheetCss = null
function sheetStyles() {
  if (sheetCss != null) return sheetCss
  const out = []
  for (const sheet of document.styleSheets) {
    let rules
    try { rules = sheet.cssRules } catch { continue }     // чужой домен — не читается
    for (const r of rules) {
      const sel = r.selectorText
      if (!sel || !sel.includes(".tmath") || sel.includes(".dark")) continue
      out.push(r.cssText)
    }
  }
  sheetCss = out.join("\n")
  return sheetCss
}

// Разметка → XHTML: внутри <foreignObject> она разбирается как XML, и первый же
// <br> без закрытия рушит картинку целиком (браузер молча отдаёт ошибку загрузки).
function toXhtml(html) {
  const host = document.createElement("div")
  host.innerHTML = html
  return new XMLSerializer().serializeToString(host)
}

const NATIVE_LOAD_MS = 4000

async function renderSheetNative(html, { width, scale, figure = null }) {
  const css = sheetStyles()
  const inner = `<style>${css.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</style>`
    + `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px; background:#fff; color:#1c1c1e; font-family:${SHEET_FONT};">${toXhtml(html)}</div>`
  // Высоту меряем настоящей раскладкой той же разметки: у картинки в SVG размер
  // должен быть известен заранее.
  const probe = document.createElement("div")
  probe.style.cssText = `position:fixed; left:-9999px; top:0; width:${width}px; background:#fff; color:#1c1c1e; font-family:${SHEET_FONT};`
  probe.innerHTML = `<style>${css}</style>${html}`
  document.body.appendChild(probe)
  let height, fig = null
  try {
    await document.fonts?.ready
    const box = probe.getBoundingClientRect()
    height = Math.ceil(box.height)
    // Где в раскладке стоит слот под чертёж — туда он и ляжет на холст.
    const slot = figure ? probe.querySelector("[data-fig]") : null
    if (slot) {
      const r = slot.getBoundingClientRect()
      fig = { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }
    }
  } finally {
    document.body.removeChild(probe)
  }
  if (!height) return null
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    + `<foreignObject width="100%" height="100%">${inner}</foreignObject></svg>`
  const img = new Image()
  const ok = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), NATIVE_LOAD_MS)
    img.onload = () => { clearTimeout(t); resolve(true) }
    img.onerror = () => { clearTimeout(t); resolve(false) }
    // data:, а не blob: — с blob холст считается испорченным, и снять с него
    // готовую картинку уже нельзя (проверено в homeworkSplit).
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
  })
  if (!ok) return null
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0)
  if (fig && figure?.dataUrl) {
    const pic = new Image()
    const got = await new Promise((resolve) => {
      pic.onload = () => resolve(true); pic.onerror = () => resolve(false)
      pic.src = figure.dataUrl
    })
    if (!got) return null            // без чертежа лист нерешаем — пусть рисует html2canvas
    ctx.drawImage(pic, fig.x, fig.y, fig.w, fig.h)
  }
  return canvas
}

/**
 * Снимает задание банка в картинку для доски.
 * task — задание в формате генераторов ({ number, condition_text, condition_tail,
 * image_url, program }); label — подпись предмета в углу листа.
 * Возвращает File — его принимает вставка картинки на доску, как и файл с диска.
 */
export async function taskToImageFile(task, { label = "", engine = "auto" } = {}) {
  const img = await trimImage(await taskImage(task.image_url, { scale: SCALE }))
  const caption = [task.number ? `№${task.number}` : "", label].filter(Boolean).join(" · ")
  const text = (v) => `<div style="font-size:${FS}px; line-height:1.55; white-space:pre-wrap;">${v}</div>`

  // math — рендер формул: экранный для нативного пути, растровый для html2canvas.
  // slot — вместо <img> оставить под чертёж пустое место того же размера:
  // WebKit (Safari) картинку внутри <foreignObject> не рисует вовсе, поэтому
  // нативный путь кладёт чертёж на холст сам, поверх снимка (см. renderSheetNative).
  const figTag = (slot) => slot
    ? `<div data-fig="1" style="width:${img.width}px; height:${img.height || img.width}px; margin-top:12px;"></div>`
    : `<img src="${img.dataUrl}" width="${img.width}"${img.height ? ` height="${img.height}"` : ""} style="width:${img.width}px;${img.height ? ` height:${img.height}px;` : ""} display:block; margin-top:12px;" />`
  const build = async (math, slot = false) => `<div style="padding:22px 24px 26px;">
    ${caption ? `<div style="font-size:12px; letter-spacing:.4px; text-transform:uppercase; color:#8e8e93; margin-bottom:10px;">${escapeHtml(caption)}</div>` : ""}
    ${task.condition_text ? text(await math(task.condition_text)) : ""}
    ${img ? figTag(slot) : ""}
    ${task.condition_tail ? `<div style="margin-top:10px;">${text(await math(task.condition_tail))}</div>` : ""}
    ${(task.program || []).map((b) => `<div style="margin-top:12px;">
      <div style="font-size:12px; color:#8e8e93; margin-bottom:4px;">${escapeHtml(b.name)}</div>
      <pre style="margin:0; padding:10px 12px; border-radius:10px; background:#f5f5f7; font-family:'SF Mono',Menlo,Consolas,monospace; font-size:13px; line-height:1.45; white-space:pre-wrap;">${escapeHtml(b.code)}</pre>
    </div>`).join("")}
  </div>`

  // Сначала нативный рендер (см. renderSheetNative), html2canvas — запасной путь.
  let shot = null
  if (engine !== "legacy") {
    try { shot = await renderSheetNative(await build(async (t) => renderTaskMath(t), true), { width: SHEET_W, scale: SCALE, figure: img }) }
    catch { shot = null }
    if (shot && !hasInk(shot)) shot = null
  }
  if (!shot && engine !== "native") {
    const html = await build(renderTaskMathPdf)
    // Шрифты обязаны быть готовы: html2canvas снимает клон документа, и на неготовом
    // шрифте лист выходит пустым.
    await document.fonts?.ready
    shot = await renderBlock(html, { width: SHEET_W, scale: SCALE })
    if (!hasInk(shot)) shot = await renderBlock(html, { width: SHEET_W, scale: SCALE })   // одна честная попытка ещё
  }
  if (!shot || !hasInk(shot)) throw new Error("снимок задания вышел пустым")

  const canvas = roundSheet(shot)
  // WebP, а не PNG: лист снят втрое крупнее (около 1860×2200), и кодирование PNG
  // такого холста занимало больше секунды — дольше самого снимка. Замер на боевом
  // задании: PNG 1066 мс и 433 КБ, WebP 150 мс и 199 КБ. Браузер, который webp с
  // холста не умеет, по спецификации вернёт PNG — тогда всё работает как раньше,
  // поэтому тип и расширение берём у самого блоба, а не задаём наперёд.
  //
  // Кодируется В ФОНОВОМ ПОТОКЕ: Safari webp с холста не умеет вовсе (по журналу
  // хранилища — все листы репетитора PNG по 450 КБ), и секунда кодирования
  // замораживала доску вместе с модалкой. Замер: самая длинная заморозка при
  // вставке 1123 мс → см. boardWorker.js. Нет потока — кодируем как раньше.
  const blob = await encodeCanvasAsync(canvas, "image/webp", 0.95)
    || await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.95))
    || await new Promise((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("не удалось снять задание")
  const type = blob.type || "image/png"
  const ext = type === "image/webp" ? "webp" : "png"
  return new File([blob], `task-${task.number || "x"}.${ext}`, { type })
}

export const SHEET_WIDTH = SHEET_W
