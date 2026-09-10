// Фоновый поток доски: тяжёлая работа с пикселями, которой нечего делать в
// главном потоке. Две операции, обе получают ImageBitmap (передаётся без
// копирования) и отвечают по id запроса:
//   encode — упаковать холст в файл (WebP, а где браузер не умеет — PNG);
//   tint   — перекрасить лист с заданием под тёмную доску (sheetTint.js).
// Замер на Mac: кодирование листа КЕГЭ — 1,2 с, перекраска — 60 мс на лист;
// в главном потоке это и было «залагивало» при вставке задания и «доска
// зависает после перезагрузки» при десятках листов на тёмной доске.
import { tintPixels } from "./sheetTint"

self.onmessage = async (e) => {
  const { id, op, bitmap, type, quality } = e.data
  try {
    const c = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = c.getContext("2d")
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    if (op === "encode") {
      let blob = null
      try { blob = await c.convertToBlob({ type, quality }) } catch { /* формат не поддержан */ }
      // По спецификации незнакомый тип молча даёт PNG — тип берём у самого блоба.
      if (!blob) blob = await c.convertToBlob({ type: "image/png" })
      self.postMessage({ id, blob })
      return
    }
    if (op === "tint") {
      // Картинка без CORS «портит» холст — getImageData бросит, и главный поток
      // нарисует лист как есть.
      const img = ctx.getImageData(0, 0, c.width, c.height)
      tintPixels(img.data)
      ctx.putImageData(img, 0, 0)
      const out = c.transferToImageBitmap()
      self.postMessage({ id, bitmap: out }, [out])
      return
    }
    throw new Error("unknown op " + op)
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) })
  }
}
