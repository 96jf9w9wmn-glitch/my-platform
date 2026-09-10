// Клиент фонового потока доски (boardWorker.worker.js). Поток один на вкладку
// и заводится при первом обращении; если браузер не умеет OffscreenCanvas или
// ImageBitmap (старые iPad), обе функции честно возвращают null, и место вызова
// делает то же самое в главном потоке, как раньше.

let worker = null
let seq = 0
const waiting = new Map()

export function workerAvailable() {
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function"
}

function get() {
  if (worker) return worker
  worker = new Worker(new URL("./boardWorker.worker.js", import.meta.url), { type: "module" })
  worker.onmessage = (e) => {
    const { id, error, ...rest } = e.data || {}
    const w = waiting.get(id)
    if (!w) return
    waiting.delete(id)
    if (error) w.reject(new Error(error))
    else w.resolve(rest)
  }
  // Поток упал (не собрался, нет памяти) — все ожидающие получают отказ и
  // переходят на главный поток; следующий вызов заведёт поток заново.
  worker.onerror = () => {
    for (const w of waiting.values()) w.reject(new Error("worker error"))
    waiting.clear()
    worker.terminate(); worker = null
  }
  return worker
}

function call(msg, transfer) {
  return new Promise((resolve, reject) => {
    const id = ++seq
    waiting.set(id, { resolve, reject })
    try { get().postMessage({ id, ...msg }, transfer) }
    catch (err) { waiting.delete(id); reject(err) }
  })
}

// Холст → файл в фоне. null — поток недоступен или упал: кодируйте сами.
export async function encodeCanvasAsync(canvas, type, quality) {
  if (!workerAvailable()) return null
  try {
    const bitmap = await createImageBitmap(canvas)
    const { blob } = await call({ op: "encode", bitmap, type, quality }, [bitmap])
    return blob || null
  } catch {
    return null
  }
}

// Лист под тёмную доску в фоне: ImageBitmap той же величины. null — поток
// недоступен, картинка без CORS или сбой: перекрашивайте сами (tintSheet).
export async function tintSheetAsync(source) {
  if (!workerAvailable()) return null
  try {
    const bitmap = await createImageBitmap(source)
    const { bitmap: out } = await call({ op: "tint", bitmap }, [bitmap])
    return out || null
  } catch {
    return null
  }
}
