// Печатная квитанция на оплату занятий.
//
// Зачем PDF, если сумма и так видна в кабинете: родители часто платят
// переводом и просят «бумажку» — с номером, датой, перечнем занятий и
// реквизитами. Этот же файл удобно переслать в мессенджере.
//
// Кириллицу встроенный шрифт jsPDF не умеет, поэтому лист собирается как HTML
// и снимается html2canvas — тот же приём, что в variantPdf/workbookPdf.

import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { fmtMoney, invoiceNumber, longDate, shortDate } from "../invoices"
import { plural } from "../utils"

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2
const SNAP_W = 780        // ширина макета в CSS-пикселях (пропорция A4 без полей)

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
))

// Год в каждой строке не нужен: он уже стоит в дате квитанции.
function withoutYear(iso) {
  return longDate(iso).replace(/\s\d{4}$/, "")
}

function row(invoice, i) {
  const time = invoice.lesson_time ? `, ${esc(invoice.lesson_time)}` : ""
  const dur = invoice.duration ? ` · ${invoice.duration} мин` : ""
  return `
    <tr>
      <td style="padding:9px 0; color:#8e8e93; font-size:13px; width:34px;">${i + 1}</td>
      <td style="padding:9px 0; font-size:15px;">Занятие ${withoutYear(invoice.lesson_date)}${time}${dur}</td>
      <td style="padding:9px 0; font-size:15px; text-align:right; white-space:nowrap; font-weight:600;">${fmtMoney(invoice.amount)} ₽</td>
    </tr>`
}

// Разметка листа. Экспортируется, чтобы её можно было посмотреть в браузере
// без сборки PDF (стенд при отладке вёрстки).
export function invoiceSheetHtml({ invoices, studentName, tutorName, payee, note, total }) {
  // invoices приходят от новых к старым — так их раскладывает withPaymentState.
  const first = invoices[0]
  const last = invoices[invoices.length - 1]
  const many = invoices.length > 1
  // Номер один и тот же, что и у самой свежей строки: по нему квитанция
  // находится в базе, а сводная — просто добавляет к ней прошлые занятия.
  const number = invoiceNumber(first)
  // Сводная квитанция датируется днём, когда её выписали: занятий в ней
  // несколько, и дата одного из них номером документа быть не может.
  const issued = many ? new Date().toISOString().slice(0, 10) : first.lesson_date
  const period = many
    ? `${invoices.length} ${plural(invoices.length, "занятие", "занятия", "занятий")} · ${shortDate(last.lesson_date)}—${shortDate(first.lesson_date)}`
    : ""

  const payeeBlock = [payee?.payee_name || tutorName, payee?.payee_details]
    .filter(Boolean)
    .map((line) => `<div style="font-size:14px; line-height:1.5;">${esc(line)}</div>`)
    .join("")

  return `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif; color:#1c1c1e; padding:6px 2px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1c1c1e; padding-bottom:14px;">
        <div>
          <div style="font-size:27px; font-weight:700; letter-spacing:-0.4px;">Квитанция на оплату</div>
          <div style="font-size:14px; color:#6b7280; margin-top:5px;">№ ${esc(number)} от ${longDate(issued)}</div>
          ${period ? `<div style="font-size:13px; color:#8e8e93; margin-top:3px;">${esc(period)}</div>` : ""}
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px; color:#8e8e93; text-transform:uppercase; letter-spacing:0.6px;">К оплате</div>
          <div style="font-size:27px; font-weight:700; margin-top:3px;">${fmtMoney(total)} ₽</div>
        </div>
      </div>

      <table style="width:100%; margin-top:22px; border-collapse:collapse;">
        <tr>
          <td style="width:50%; vertical-align:top; padding-right:18px;">
            <div style="font-size:12px; color:#8e8e93; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:6px;">Получатель</div>
            ${payeeBlock || `<div style="font-size:14px;">${esc(tutorName || "Репетитор")}</div>`}
          </td>
          <td style="width:50%; vertical-align:top;">
            <div style="font-size:12px; color:#8e8e93; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:6px;">Плательщик</div>
            <div style="font-size:14px; line-height:1.5;">${esc(studentName || "Ученик")}</div>
          </td>
        </tr>
      </table>

      <div style="font-size:12px; color:#8e8e93; text-transform:uppercase; letter-spacing:0.6px; margin:26px 0 4px;">
        ${many ? "Проведённые занятия" : "Услуга"}
      </div>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid #d1d1d6;">
            <th style="padding-bottom:7px;"></th>
            <th style="text-align:left; padding-bottom:7px; font-size:12px; color:#8e8e93; font-weight:500;">Наименование</th>
            <th style="text-align:right; padding-bottom:7px; font-size:12px; color:#8e8e93; font-weight:500;">Сумма</th>
          </tr>
        </thead>
        <tbody>${invoices.map(row).join("")}</tbody>
      </table>

      <table style="width:100%; border-collapse:collapse; border-top:2px solid #1c1c1e; margin-top:4px;">
        <tr>
          <td style="padding-top:11px; font-size:16px; font-weight:600;">Итого к оплате</td>
          <td style="padding-top:11px; font-size:20px; font-weight:700; text-align:right;">${fmtMoney(total)} ₽</td>
        </tr>
      </table>

      ${note ? `<div style="margin-top:22px; font-size:14px; line-height:1.55; color:#3a3a3c; background:#f2f2f7; border-radius:12px; padding:12px 14px;">${esc(note)}</div>` : ""}

      <div style="margin-top:26px; font-size:11.5px; line-height:1.6; color:#8e8e93;">
        Занятия оказывает и оплату получает репетитор. Квитанция сформирована
        автоматически сервисом Precettore и не является кассовым чеком.
      </div>
    </div>`
}

// Собирает PDF по списку квитанций (обычно — по всем неоплаченным сразу).
// Возвращает Blob; сохранение — на вызывающей стороне.
export async function buildInvoicePdf({ invoices, studentName, tutorName, payee, note }) {
  const list = (invoices || []).filter(Boolean)
  if (!list.length) return null
  const total = list.reduce((sum, i) => sum + (Number(i.due ?? i.amount) || 0), 0)

  const el = document.createElement("div")
  el.style.cssText = `position:fixed; left:-9999px; top:0; width:${SNAP_W}px; background:#fff;`
  el.innerHTML = invoiceSheetHtml({ invoices: list, studentName, tutorName, payee, note, total })
  document.body.appendChild(el)

  try {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" })
    const pdf = new jsPDF({ unit: "mm", format: "a4" })
    // Лист длиннее страницы бывает только при десятках занятий — тогда режем
    // снимок по высоте страницы, перенося остаток на следующую.
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

export async function downloadInvoicePdf(params) {
  const blob = await buildInvoicePdf(params)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  const first = params.invoices[0]
  a.download = `Квитанция ${invoiceNumber(first)}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
