// Мини-генератор .xlsx (OOXML) поверх нашего zipWriter — чтобы к заданию №14 приложить
// НАСТОЯЩУЮ электронную таблицу без внешних зависимостей. Строки храним как inlineStr (без
// sharedStrings), числа — как <v> с точкой-разделителем (Excel сам покажет их по локали, в
// т.ч. с запятой) — это снимает проблему «45,2 читается как текст». Файл небольшой, метод
// упаковки — stored (Excel такие открывает).
import { makeZipBlob } from "./zipWriter"

const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const colLetter = (i) => {
  let s = "", n = i
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return s
}
const isNum = (v) => typeof v === "number" && Number.isFinite(v)

function sheetXml(rows) {
  const body = rows.map((cells, r) => {
    const rn = r + 1
    const cs = cells.map((v, c) => {
      const ref = `${colLetter(c)}${rn}`
      return isNum(v)
        ? `<c r="${ref}"><v>${v}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
    }).join("")
    return `<row r="${rn}">${cs}</row>`
  }).join("")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${body}</sheetData></worksheet>`
}

// sheetName — до 31 символа; rows — массив массивов ячеек (string | number). → Blob (.xlsx)
export function makeXlsxBlob(sheetName, rows) {
  const name = esc(String(sheetName).slice(0, 31).replace(/[\\/?*[\]:]/g, " ") || "Лист1")
  const files = {
    "[Content_Types].xml":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `</Types>`,
    "_rels/.rels":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
    "xl/workbook.xml":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `</Relationships>`,
    "xl/worksheets/sheet1.xml": sheetXml(rows),
  }
  const blob = makeZipBlob(files)
  return new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

export function downloadXlsx(fileName, sheetName, rows) {
  const url = URL.createObjectURL(makeXlsxBlob(sheetName, rows))
  const a = document.createElement("a")
  a.href = url
  a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
