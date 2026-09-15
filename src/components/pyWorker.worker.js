// Запуск программ ученика — НАСТОЯЩИЙ CPython (Pyodide, Python в wasm) и
// обязательно в фоновом потоке.
//
// ПОЧЕМУ НЕ СВОЙ ИНТЕРПРЕТАТОР. Разбор подмножества питона пишется за пару
// тысяч строк и весит копейки, но `0.1 + 0.2`, целочисленное деление, порядок
// словаря, формат вывода float, срезы с шагом — сотня мест, где самоделка
// молча разойдётся с тем питоном, который стоит на экзамене. Ученик готовится
// к КЕГЭ: расхождение здесь — это обучение неправде.
//
// ПОЧЕМУ ПОТОК. Программа ученика бывает бесконечной (`while True`), и в
// главном потоке она повесила бы доску насмерть. В потоке её обрывает
// terminate() по кнопке «Стоп» — другого способа прервать код нет: прерывание
// изнутри требует SharedArrayBuffer, а тот требует заголовков COOP/COEP,
// которые сломали бы загрузку картинок доски с db.precettore.ru.

// Загрузчик (18 КБ) едет обычным импортом и попадает в кусок самого потока, а
// тяжёлое (wasm, стандартная библиотека) он качает сам по indexURL из
// /py/<версия>/. Динамический import(url) тут не годится дважды: в разработке
// vite дописывает к адресу «?import» и отдаёт 500, а обход через new Function
// потребовал бы 'unsafe-eval' в CSP.
import { loadPyodide } from "pyodide"

let pyodide = null
let loading = null

// Вывод копится и уходит пачками: `for i in range(100000): print(i)` иначе даёт
// сотню тысяч сообщений в секунду и кладёт главный поток тем же, от чего мы
// уходили в фон.
const FLUSH_MS = 60
const FLUSH_BYTES = 8192
const FLOOD_MS = 200
const FLOOD_N = 20
// Потолок вывода на один запуск. Больше на доске всё равно не прочитать, а
// штрих на мегабайт уехал бы в базу и собеседнику по realtime.
const MAX_OUT = 200 * 1024

// Вывод копится КУСКАМИ с пометкой потока: обычная печать и сообщения об
// ошибках идут вперемешку, но на экране traceback должен быть виден сразу —
// он красный, и именно его ищет глазами тот, у кого не работает программа.
let buf = []
let sent = 0
let truncated = false
let timer = null
let lastFlush = 0
let windowAt = 0
let hits = 0

function flush() {
  if (timer) { clearTimeout(timer); timer = null }
  if (!buf.length) return
  postMessage({ type: "out", chunks: buf })
  buf = []
  lastFlush = Date.now()
}

// Обычную печать отправляем СРАЗУ, и только лавину собираем пачками. Дело в
// том, что пока программа считает, поток занят ею целиком и setTimeout не
// срабатывает НИ РАЗУ: всё, что легло в буфер перед долгим циклом, пропадёт
// для того, кто нажмёт «Стоп». На стенде это выглядело так: программа печатает
// четыре строки и уходит в `while True`, а на экране пусто.
// Поэтому порог не по времени, а по частоте: больше FLOOD_N отправок за
// FLOOD_MS — включается накопление, и тогда пачки уходят по часам (таймер и
// здесь ненадёжен, он лишь добирает хвост после конца выполнения).
function write(text, err = false) {
  if (truncated || !text) return
  if (sent + text.length > MAX_OUT) {
    text = text.slice(0, Math.max(0, MAX_OUT - sent))
    truncated = true
  }
  sent += text.length
  const last = buf[buf.length - 1]
  if (last && !!last.err === !!err) last.text += text
  else buf.push({ err: !!err, text })
  const now = Date.now()
  if (now - windowAt > FLOOD_MS) { windowAt = now; hits = 0 }
  const flood = hits >= FLOOD_N
  const size = buf.reduce((n, c) => n + c.text.length, 0)
  if (!flood || size >= FLUSH_BYTES || now - lastFlush >= FLUSH_MS) { hits++; flush() }
  else if (!timer) timer = setTimeout(flush, FLUSH_MS)
  if (truncated) { flush(); postMessage({ type: "trunc" }) }
}

// Ввод отдаётся построчно, как его читает input(). Кончился — не молчаливый
// EOFError, а понятная строка (см. обёртку RUNNER ниже).
let stdinLines = []
let stdinAt = 0

async function boot(base) {
  if (pyodide) return pyodide
  if (loading) return loading
  loading = (async () => {
    postMessage({ type: "stage", stage: "load" })
    const t0 = Date.now()
    const py = await loadPyodide({ indexURL: base })
    // Байтами, а не «пачками строк» (batched): batched отдаёт кусок БЕЗ
    // завершающего перевода строки, и весь вывод слипался бы в одну строку, а
    // `print(..., end="")` нельзя было бы отличить от обычной печати.
    // У потоков свои декодеры: буква из двух байтов может прийти половинами.
    const outDec = new TextDecoder(), errDec = new TextDecoder()
    py.setStdout({ write: (b) => { write(outDec.decode(b, { stream: true })); return b.length } })
    py.setStderr({ write: (b) => { write(errDec.decode(b, { stream: true }), true); return b.length } })
    py.setStdin({
      stdin: () => (stdinAt < stdinLines.length ? stdinLines[stdinAt++] + "\n" : null),
      isatty: false,
    })
    py.runPython(RUNNER)
    pyodide = py
    postMessage({ type: "stage", stage: "ready", ms: Date.now() - t0 })
    return py
  })()
  try { return await loading } finally { loading = null }
}

// Обёртка на стороне питона. Нужна ради ДВУХ вещей, и обе про то, что читает
// ученик: traceback без кадров самой обёртки (иначе поверх своей ошибки он
// видит наши внутренности) и человеческий текст, когда программа просит ввод,
// а его не дали.
const RUNNER = `
import sys, traceback

def __board_run(src):
    g = {"__name__": "__main__", "__builtins__": __builtins__}
    try:
        exec(compile(src, "программа", "exec"), g)
    except SystemExit:
        pass
    except EOFError:
        print("Программа ждёт ввод, а поле «Ввод» пусто или уже прочитано целиком.",
              file=sys.stderr)
        return 1
    except BaseException:
        t, v, tb = sys.exc_info()
        traceback.print_exception(t, v, tb.tb_next if tb else tb, file=sys.stderr)
        return 1
    return 0
`

onmessage = async (e) => {
  const msg = e.data || {}
  if (msg.type !== "run") return
  buf = []; sent = 0; truncated = false; lastFlush = 0; windowAt = 0; hits = 0
  stdinLines = String(msg.stdin || "").replace(/\r\n?/g, "\n").split("\n")
  if (stdinLines.length && stdinLines[stdinLines.length - 1] === "") stdinLines.pop()
  stdinAt = 0
  try {
    const py = await boot(msg.base)
    postMessage({ type: "stage", stage: "run" })
    const t0 = Date.now()
    const rc = py.globals.get("__board_run")(String(msg.code || ""))
    flush()
    postMessage({ type: "done", failed: rc === 1, ms: Date.now() - t0 })
  } catch (err) {
    flush()
    // Сюда попадает сбой самого движка (не собрался, не докачался), а не
    // ошибка в программе ученика — её уже напечатала обёртка.
    postMessage({ type: "done", failed: true, fatal: String(err?.message || err) })
  }
}
