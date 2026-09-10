// Файлы, прилагаемые к заданию банка: архив с исходниками, электронная таблица,
// текстовый файл с данными. Ни один из них не лежит на сервере — генератор отдаёт
// содержимое вместе с задачей, а сам файл собирается в браузере в момент нажатия.
import { downloadZip } from "./zipWriter"
import { downloadXlsx } from "./xlsxWriter"

// Все прилагаемые к заданию файлы одним списком: имя, короткая мера объёма и само
// скачивание. Одна точка правды на все места, где файл предлагают забрать (карточка
// задания, предпросмотр домашней работы, вставка задания на доску), — иначе списки
// разъедутся и где-нибудь пропадёт файл, без которого задание не решается.
export function taskFiles(task) {
  const out = []
  if (task?.archive) {
    const { name = "архив", files } = task.archive
    out.push({ kind: "archive", name, hint: `${Object.keys(files).length} файлов`, download: () => downloadZip(name, files) })
  }
  if (task?.spreadsheet) {
    const sp = task.spreadsheet
    // Книга может быть многолистовой (КЕГЭ №3): тогда в sheets лежит массив листов.
    const sheets = Array.isArray(sp.sheets) ? sp.sheets : null
    const rows = sheets ? sheets.reduce((a, sh) => a + sh.rows.length - 1, 0) : sp.rows.length - 1
    const name = sp.name || "таблица"
    out.push({ kind: "spreadsheet", name, hint: `${rows} строк`, download: () => downloadXlsx(name, sheets || sp.sheetName, sp.rows) })
  }
  // КЕГЭ №27 приходит с ДВУМЯ входными файлами (A и B) — тогда textFile массив.
  const tf = task?.textFile
  if (tf) for (const f of Array.isArray(tf) ? tf : [tf]) {
    const name = f.name || "файл"
    const lines = f.content.split("\n").length
    out.push({
      kind: "text", name,
      hint: lines > 1 ? `${lines} строк` : `${f.content.length} символов`,
      download: () => downloadBlob(name, new Blob([f.content], { type: "text/plain;charset=utf-8" })),
    })
  }
  return out
}

// Файлы заданий нигде не лежат на сервере: .zip/.xlsx/.txt собираются в браузере в
// момент нажатия, поэтому отдать их можно только ссылкой на blob.
export function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
