// Сборка PDF из печатного листа (src/pages/reportSheet.js).
//
// Кириллицу встроенный шрифт jsPDF не умеет, поэтому лист собирается как HTML
// и снимается html2canvas — тот же приём, что в invoicePdf и variantPdf.

import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { reportSheetHtml, dayMonth } from "./reportSheet"

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2
const SNAP_W = 780        // ширина макета в CSS-пикселях (пропорция A4 без полей)

// Собирает PDF по одному отчёту. Возвращает Blob; сохранение — на вызывающей стороне.
export async function buildReportPdf(params) {
  const el = document.createElement("div")
  el.style.cssText = `position:fixed; left:-9999px; top:0; width:${SNAP_W}px; background:#fff;`
  el.innerHTML = reportSheetHtml(params)
  document.body.appendChild(el)

  try {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" })
    const pdf = new jsPDF({ unit: "mm", format: "a4" })

    // Отчёт почти всегда одностраничный. Если он перерос лист процентов на
    // двадцать, разрезать его нельзя: разрыв придётся на середину темы или
    // абзаца. Такой лист вписываем целиком, уменьшив масштаб.
    const pageH = PAGE_H - MARGIN * 2
    const fullH = (canvas.height / canvas.width) * CONTENT_W
    if (fullH <= pageH * 1.22) {
      const h = Math.min(fullH, pageH)
      const w = (h / fullH) * CONTENT_W
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG",
                   MARGIN + (CONTENT_W - w) / 2, MARGIN, w, h)
      return pdf.output("blob")
    }

    let offset = 0
    let page = 0
    while (offset < canvas.height) {
      const sliceH = Math.min(canvas.height - offset, Math.round(canvas.width * (PAGE_H - MARGIN * 2) / CONTENT_W))
      const part = document.createElement("canvas")
      part.width = canvas.width
      part.height = sliceH
      const ctx = part.getContext("2d")
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, part.width, part.height)
      ctx.drawImage(canvas, 0, -offset)
      if (page > 0) pdf.addPage()
      pdf.addImage(part.toDataURL("image/jpeg", 0.94), "JPEG", MARGIN, MARGIN,
                   CONTENT_W, (sliceH / canvas.width) * CONTENT_W)
      offset += sliceH
      page += 1
    }
    return pdf.output("blob")
  } finally {
    el.remove()
  }
}

export async function downloadReportPdf(params) {
  const blob = await buildReportPdf(params)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  const when = dayMonth(params.report?.lesson_date) || ""
  a.download = `Отчёт ${params.studentName || ""} ${when}`.trim().replace(/\s+/g, " ") + ".pdf"
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
