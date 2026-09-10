import { renderTaskMathPdf, renderBlock, taskImage } from "./variantPdf"
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

/**
 * Снимает задание банка в картинку для доски.
 * task — задание в формате генераторов ({ number, condition_text, condition_tail,
 * image_url, program }); label — подпись предмета в углу листа.
 * Возвращает File — его принимает вставка картинки на доску, как и файл с диска.
 */
export async function taskToImageFile(task, { label = "" } = {}) {
  const img = await trimImage(await taskImage(task.image_url, { scale: SCALE }))
  const caption = [task.number ? `№${task.number}` : "", label].filter(Boolean).join(" · ")
  const text = (v) => `<div style="font-size:${FS}px; line-height:1.55; white-space:pre-wrap;">${v}</div>`

  const html = `<div style="padding:22px 24px 26px;">
    ${caption ? `<div style="font-size:12px; letter-spacing:.4px; text-transform:uppercase; color:#8e8e93; margin-bottom:10px;">${escapeHtml(caption)}</div>` : ""}
    ${task.condition_text ? text(await renderTaskMathPdf(task.condition_text)) : ""}
    ${img ? `<img src="${img.dataUrl}" width="${img.width}"${img.height ? ` height="${img.height}"` : ""} style="width:${img.width}px;${img.height ? ` height:${img.height}px;` : ""} display:block; margin-top:12px;" />` : ""}
    ${task.condition_tail ? `<div style="margin-top:10px;">${text(await renderTaskMathPdf(task.condition_tail))}</div>` : ""}
    ${(task.program || []).map((b) => `<div style="margin-top:12px;">
      <div style="font-size:12px; color:#8e8e93; margin-bottom:4px;">${escapeHtml(b.name)}</div>
      <pre style="margin:0; padding:10px 12px; border-radius:10px; background:#f5f5f7; font-family:'SF Mono',Menlo,Consolas,monospace; font-size:13px; line-height:1.45; white-space:pre-wrap;">${escapeHtml(b.code)}</pre>
    </div>`).join("")}
  </div>`

  // Шрифты обязаны быть готовы: html2canvas снимает клон документа, и на неготовом
  // шрифте лист выходит пустым.
  await document.fonts?.ready
  let shot = await renderBlock(html, { width: SHEET_W, scale: SCALE })
  if (!hasInk(shot)) shot = await renderBlock(html, { width: SHEET_W, scale: SCALE })   // одна честная попытка ещё
  if (!hasInk(shot)) throw new Error("снимок задания вышел пустым")

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
