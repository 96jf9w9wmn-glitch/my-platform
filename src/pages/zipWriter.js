// Мини-упаковщик ZIP (метод «stored», без сжатия) на чистом JS — чтобы прикреплять к
// заданию №11 распаковываемый архив без внешних зависимостей. Имена файлов пишем в UTF-8
// (флаг общего назначения, бит 11), поэтому кириллические каталоги (Проза/Пушкин) читаются
// корректно и в Проводнике, и в macOS. Файлы небольшие текстовые — сжатие не нужно.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(bytes) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}
const enc = new TextEncoder()
const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF]
const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]

// files: { "путь/файл.txt": "содержимое" }  →  Blob (application/zip)
export function makeZipBlob(files) {
  const entries = Object.entries(files).map(([name, content]) => {
    const data = enc.encode(content)
    return { nameBytes: enc.encode(name), data, crc: crc32(data) }
  })
  const chunks = []
  let offset = 0
  entries.forEach((e) => {
    e.offset = offset
    const header = [
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), // сигнатура, версия, флаг UTF-8, метод=stored
      ...u16(0), ...u16(0x21),                                    // время, дата (фикс. 1980-01-01)
      ...u32(e.crc), ...u32(e.data.length), ...u32(e.data.length),
      ...u16(e.nameBytes.length), ...u16(0),
    ]
    const h = Uint8Array.from([...header, ...e.nameBytes])
    chunks.push(h, e.data)
    offset += h.length + e.data.length
  })
  const cdStart = offset
  entries.forEach((e) => {
    const central = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(0), ...u16(0x21),
      ...u32(e.crc), ...u32(e.data.length), ...u32(e.data.length),
      ...u16(e.nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(e.offset),
    ]
    const cd = Uint8Array.from([...central, ...e.nameBytes])
    chunks.push(cd)
    offset += cd.length
  })
  const end = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(offset - cdStart), ...u32(cdStart), ...u16(0),
  ])
  chunks.push(end)
  return new Blob(chunks, { type: "application/zip" })
}

// Собрать архив из дерева файлов и отдать пользователю на скачивание.
export function downloadZip(name, files) {
  const url = URL.createObjectURL(makeZipBlob(files))
  const a = document.createElement("a")
  a.href = url
  a.download = name.endsWith(".zip") ? name : `${name}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
