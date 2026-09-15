// Клиент фонового потока с питоном (pyWorker.worker.js). Поток один на вкладку
// и заводится при первом обращении; движок (13 МБ файлов, ~6 МБ по проводу)
// качается ТОЛЬКО когда его действительно позвали — в стартовый набор
// приложения не попадает ни байта.
//
// Версия обязана совпадать с папкой в public/py — за этим следит
// scripts/pyodide-assets.mjs и роняет сборку при расхождении.
export const PYODIDE_VERSION = "314.0.7"
const BASE = `/py/${PYODIDE_VERSION}/`

let worker = null
let current = null   // идущий запуск: { resolve, onOut, onStage }

export function pythonAvailable() {
  return typeof Worker !== "undefined" && typeof WebAssembly === "object"
}

function get() {
  if (worker) return worker
  worker = new Worker(new URL("./pyWorker.worker.js", import.meta.url), { type: "module" })
  worker.onmessage = (e) => {
    const m = e.data || {}
    const run = current
    if (!run) return
    if (m.type === "out") run.onOut?.(m.chunks)
    else if (m.type === "trunc") run.truncated = true
    else if (m.type === "stage") run.onStage?.(m.stage, m.ms)
    else if (m.type === "done") {
      current = null
      // Движок умер (переполнил стек, кончилась память) — сносим поток целиком.
      // Продолжать в нём нельзя: он отвечает отказом на что угодно, и ученик
      // видел бы ту же ошибку на любой следующей программе, даже верной.
      if (m.dead && worker) { worker.terminate(); worker = null }
      run.resolve({ failed: !!m.failed, fatal: m.fatal || null, ms: m.ms || 0, truncated: !!run.truncated })
    }
  }
  worker.onerror = (e) => {
    // Поток не собрался или кончилась память. Следующий запуск заведёт новый.
    const run = current
    current = null
    worker?.terminate(); worker = null
    run?.resolve({ failed: true, fatal: e?.message || "поток не запустился", ms: 0, truncated: false })
  }
  return worker
}

// Греем движок заранее (открыли панель — значит собираются запускать): первый
// запуск иначе стоит ожидания в несколько секунд уже ПОСЛЕ нажатия «Запустить».
export function warmPython() {
  if (!pythonAvailable() || worker) return
  get().postMessage({ type: "run", base: BASE, code: "", stdin: "" })
  current = { resolve: () => {}, onOut: null, onStage: null }
}

export function pythonBusy() { return !!current }

export function runPython(code, stdin, { onOut, onStage } = {}) {
  if (!pythonAvailable()) {
    return Promise.resolve({ failed: true, fatal: "браузер не умеет WebAssembly", ms: 0, truncated: false })
  }
  // Второй запуск поверх идущего не запускаем: у питона одно состояние на
  // поток, и две программы в нём перемешали бы вывод и переменные.
  if (current) stopPython()
  return new Promise((resolve) => {
    current = { resolve, onOut, onStage, truncated: false }
    get().postMessage({ type: "run", base: BASE, code: String(code || ""), stdin: String(stdin || "") })
  })
}

// Единственный способ прервать программу — снести поток целиком (см. заголовок
// воркера). Движок после этого грузится заново, но уже из кэша браузера.
export function stopPython() {
  const run = current
  current = null
  if (worker) { worker.terminate(); worker = null }
  run?.resolve({ failed: true, stopped: true, ms: 0, truncated: !!run.truncated })
}
