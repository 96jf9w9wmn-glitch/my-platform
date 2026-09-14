// Файлы, прилагаемые к заданию банка: архив с исходниками, электронная таблица,
// текстовый файл с данными. Почти все собираются в браузере: генератор отдаёт
// содержимое вместе с задачей, и на сервере ничего не лежит.
//
// Исключение — задания, ВЗЯТЫЕ ИЗ БАНКА ФИПИ вместе с их файлами (КЕГЭ №3 и
// №17): книга базы данных весит до 600 КБ, а последовательность чисел 67 КБ, и
// возить их внутри задания нельзя — пул едет в браузер вместе с банком (33 книги
// это 6,2 МБ). Такие файлы лежат в публичном бакете task-assets, как картинки
// банка, и приезжают по ссылке (`remoteFile`).
//
// Поэтому у файла две стороны: `blob()` — сам файл, чтобы отдать его браузеру или
// положить в хранилище (доска), и `download()` — сразу на диск.
import { makeZipBlob } from "./zipWriter"
import { makeXlsxBlob, makeXlsxBookBlob } from "./xlsxWriter"

const withExt = (name, ext) => (name.toLowerCase().endsWith(ext) ? name : `${name}${ext}`)

// Все прилагаемые к заданию файлы одним списком: имя, короткая мера объёма, сам
// файл и его скачивание. Одна точка правды на все места, где файл предлагают
// забрать (карточка задания, домашняя работа, лист на доске), — иначе списки
// разъедутся и где-нибудь пропадёт файл, без которого задание не решается.
export function taskFiles(task) {
  const out = []
  if (task?.archive) {
    const { files } = task.archive
    const name = withExt(task.archive.name || "архив", ".zip")
    out.push({ kind: "archive", name, hint: `${Object.keys(files).length} файлов`, blob: () => makeZipBlob(files) })
  }
  if (task?.spreadsheet) {
    const sp = task.spreadsheet
    // Книга может быть многолистовой (КЕГЭ №3): тогда в sheets лежит массив листов.
    const sheets = Array.isArray(sp.sheets) ? sp.sheets : null
    const rows = sheets ? sheets.reduce((a, sh) => a + sh.rows.length - 1, 0) : sp.rows.length - 1
    const name = withExt(sp.name || "таблица", ".xlsx")
    out.push({
      kind: "spreadsheet", name, hint: `${rows} строк`,
      blob: () => (sheets ? makeXlsxBookBlob(sheets) : makeXlsxBlob(sp.sheetName, sp.rows)),
    })
  }
  // Файл из банка ФИПИ: лежит в хранилище, скачивается по ссылке. Blob здесь
  // приходит ПОЗЖЕ, поэтому blob() у него — обещание; все, кто собирает файлы
  // (доска, окно «Задание на доску»), ждут его через Promise.all.
  const rf = task?.remoteFile
  if (rf) for (const f of Array.isArray(rf) ? rf : [rf]) {
    out.push({
      // Порода — по расширению: от неё зависит только вид кнопки, и книга из
      // хранилища должна выглядеть так же, как книга, собранная в браузере.
      kind: /\.(xlsx|ods|xls)$/i.test(f.name || "") ? "spreadsheet" : "text",
      name: f.name || "файл", hint: f.hint || "файл к заданию", url: f.url,
      blob: async () => {
        const res = await fetch(f.url)
        if (!res.ok) throw new Error(`файл не скачался: ${res.status}`)
        return await res.blob()
      },
    })
  }
  // КЕГЭ №27 приходит с ДВУМЯ входными файлами (A и B) — тогда textFile массив.
  const tf = task?.textFile
  if (tf) for (const f of Array.isArray(tf) ? tf : [tf]) {
    const lines = f.content.split("\n").length
    out.push({
      kind: "text", name: f.name || "файл.txt",
      hint: lines > 1 ? `${lines} строк` : `${f.content.length} символов`,
      blob: () => new Blob([f.content], { type: "text/plain;charset=utf-8" }),
    })
  }
  // Скачивание одинаково для всех: у собранного в браузере файла blob() отдаёт
  // сам Blob, у файла из хранилища — обещание, поэтому ждём в обоих случаях.
  for (const f of out) f.download = async () => downloadBlob(f.name, await f.blob())
  return out
}

// Отдать готовый файл браузеру. Файлы заданий нигде не лежат постоянно, поэтому
// путь один — ссылка на blob.
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
