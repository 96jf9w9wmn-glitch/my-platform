import { renderTaskMathPdf, renderBlock, taskImage } from "./variantPdf"

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
const SCALE = 2            // renderBlock снимает в двойном разрешении

const escapeHtml = (s) => {
  const div = document.createElement("div")
  div.textContent = String(s ?? "")
  return div.innerHTML
}

// Прилагаемые к заданию файлы (архив КЕГЭ, таблица, текстовый файл) на доску не
// переносятся: это скачиваемые вложения, а не часть условия. Показываем это в
// интерфейсе, а не молчим — иначе задание на доске окажется нерешаемым.
export function attachmentsOf(task) {
  const out = []
  if (task?.archive) out.push(task.archive.name || "архив")
  if (task?.spreadsheet) out.push(task.spreadsheet.name || "таблица")
  const tf = task?.textFile
  if (tf) (Array.isArray(tf) ? tf : [tf]).forEach((f) => out.push(f.name || "файл"))
  return out
}

// В снимке есть хоть один не-белый пиксель? html2canvas, вызванный до готовности
// документа, отдаёт пустой белый холст — на доске это молча превращается в чистый лист
// вместо задания. Шаг по пикселям крупный: нам важен сам факт чернил, а не их граница.
function hasInk(canvas) {
  const d = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
  for (let i = 0; i < d.length; i += 4 * 7) {
    if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) return true
  }
  return false
}

// Лист с заданием: мягкие скруглённые углы и волосяная рамка, чтобы на белой доске он
// не сливался с фоном. Лист снимается СВЕТЛЫМ всегда: под тёмную доску его перекрашивает
// сама доска при отрисовке (tintSheet в boardPaint.js), поэтому переключение темы
// перекрашивает и уже лежащие задания.
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
  const img = await taskImage(task.image_url)
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
  let shot = await renderBlock(html, { width: SHEET_W })
  if (!hasInk(shot)) shot = await renderBlock(html, { width: SHEET_W })   // одна честная попытка ещё
  if (!hasInk(shot)) throw new Error("снимок задания вышел пустым")

  const canvas = roundSheet(shot)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("не удалось снять задание")
  return new File([blob], `task-${task.number || "x"}.png`, { type: "image/png" })
}

export const SHEET_WIDTH = SHEET_W
