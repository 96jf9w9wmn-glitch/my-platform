// Питон на доске: панель, в которой программу пишут, запускают и кладут
// результат на доску.
//
// ПОЧЕМУ ПАНЕЛЬ, А НЕ ЗАПУСК ПРЯМО У КАРТОЧКИ. Программу на занятии не столько
// показывают, сколько ПРАВЯТ: «а если поставить не 10, а 100?» Панель — это
// место, где правку делают и сразу видят ответ, а на доску уезжает то, что
// стоит обсуждать дальше. Карточка кода при этом остаётся карточкой: её берут
// в панель одним нажатием и возвращают обратно вместе с выводом.
//
// Движок (настоящий CPython в wasm) грузится в фоновом потоке и только когда
// панель открыли — см. pyRunner.js.
import { useEffect, useRef, useState } from "react"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import { CODE_FONT, CODE_BG, CODE_BORDER, CODE_INK, codeTokens } from "./boardCode"
import { runPython, stopPython, warmPython, pythonAvailable } from "./pyRunner"

const FONT_PX = 13
const LINE = 1.5
const PAD = 12

// Отступ строки — то же, чем живёт сам питон: блок задаётся пробелами, и
// редактор, который их не бережёт, делает язык неработающим.
const INDENT = "    "

// store — простой объект доски (не состояние!): панель кладёт в него код и
// ввод, чтобы написанное пережило закрытие. Держать это состоянием доски
// нельзя: код правят посимвольно, и каждая буква перерисовывала бы весь её
// кабинет.
export default function PythonPanel({ dark, store = {}, closeRef, onPlace, onClose }) {
  const [code, setCode] = useState(store.code || "")
  const [stdin, setStdin] = useState(store.stdin || "")
  const [showStdin, setShowStdin] = useState(false)
  const [chunks, setChunks] = useState([])   // вывод: { err, text }
  const [state, setState] = useState("idle") // idle | load | run | done | stopped
  const [note, setNote] = useState("")
  const [secs, setSecs] = useState(0)
  const { cls: closingCls, close } = useClosing(onClose)
  const taRef = useRef(null)
  const layerRef = useRef(null)
  const outRef = useRef(null)
  const runSeq = useRef(0)

  // Открыли панель — значит собираются запускать: качаем движок заранее, иначе
  // ожидание в несколько секунд начнётся уже ПОСЛЕ нажатия «Запустить».
  useEffect(() => { warmPython() }, [])

  // Закрыть панель может и кнопка доски (повторное нажатие на «<>»). Отдаём ей
  // НАШ close, а не право снять компонент: иначе панель исчезала бы рывком,
  // мимо анимации ухода.
  useEffect(() => {
    if (!closeRef) return undefined
    closeRef.current = close
    return () => { if (closeRef.current === close) closeRef.current = null }
  }, [closeRef, close])

  // Секундомер идущей программы: без него долгий счёт неотличим от зависания.
  useEffect(() => {
    if (state !== "run" && state !== "load") return
    const t0 = Date.now()
    const id = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 250)
    return () => clearInterval(id)
  }, [state])

  useEffect(() => { paint() })
  useEffect(() => { store.code = code; store.stdin = stdin })
  useEffect(() => {
    const el = outRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chunks])

  // Подсветка под полем ввода — тот же приём, что у карточки кода на доске:
  // текст в поле прозрачный, цвета рисует слой под ним, метрики совпадают до
  // пикселя. Разметку собираем УЗЛАМИ: код пришёл извне, и innerHTML тут
  // означал бы выполнение чужого.
  function paint() {
    const el = layerRef.current
    if (!el) return
    el.textContent = ""
    const src = code.split("\n")
    const lines = codeTokens(code, "python")
    for (let i = 0; i < lines.length; i++) {
      const line = src[i] ?? ""
      let pos = 0
      for (const tk of lines[i] || []) {
        if (tk.c > pos) el.append(document.createTextNode(line.slice(pos, tk.c)))
        const sp = document.createElement("span")
        sp.style.color = CODE_INK[tk.k] || CODE_INK.plain
        sp.textContent = tk.t
        el.append(sp)
        pos = tk.c + tk.t.length
      }
      if (pos < line.length) el.append(document.createTextNode(line.slice(pos)))
      el.append(document.createTextNode("\n"))
    }
  }

  // Слой подсветки едет за полем. Только по вертикали: длинные строки
  // ПЕРЕНОСЯТСЯ, поэтому вбок ничего не уезжает (см. whitespace-pre-wrap ниже).
  function syncScroll() {
    const ta = taRef.current, el = layerRef.current
    if (ta && el) el.scrollTop = ta.scrollTop
  }

  // Tab и перевод строки в поле ввода. Без них питон в браузере не пишется:
  // Tab уводит фокус с поля, а новая строка теряет отступ блока, и программа
  // ломается там, где человек ничего не делал.
  function onKey(e) {
    const ta = e.target
    // ⌘↵ / Ctrl+↵ — запуск, как в любом редакторе кода. Проверка идёт ПЕРВОЙ:
    // ниже стоит обычный перевод строки, и он перехватывал бы сочетание себе.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); return }
    if (e.key === "Tab") {
      e.preventDefault()
      insert(INDENT)
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      const before = ta.value.slice(0, ta.selectionStart)
      const line = before.slice(before.lastIndexOf("\n") + 1)
      const pad = line.match(/^[ \t]*/)[0]
      insert("\n" + pad + (/:\s*$/.test(line) ? INDENT : ""))
      return
    }
    if (e.key === "Backspace" && ta.selectionStart === ta.selectionEnd) {
      // Отступ снимается целиком, а не по пробелу: иначе выравнивание блока
      // разъезжается незаметно для глаза.
      const before = ta.value.slice(0, ta.selectionStart)
      const line = before.slice(before.lastIndexOf("\n") + 1)
      if (line && /^ +$/.test(line) && line.length % INDENT.length === 0) {
        e.preventDefault()
        const at = ta.selectionStart
        ta.value = ta.value.slice(0, at - INDENT.length) + ta.value.slice(at)
        ta.selectionStart = ta.selectionEnd = at - INDENT.length
        setCode(ta.value)
      }
    }
  }

  // Пишем в САМО поле, а не только в состояние. Через setCode браузер узнаёт о
  // новом тексте лишь на следующей перерисовке, и следующая нажатая клавиша
  // приходит раньше неё: onChange отдаёт ещё старое значение поля, и вставленный
  // перевод строки с отступом пропадает. При быстром наборе «def f(n):↵ return»
  // превращалось в одну строку — проверено на стенде.
  function insert(text) {
    const ta = taRef.current
    if (!ta) return
    const a = ta.selectionStart, b = ta.selectionEnd
    ta.value = ta.value.slice(0, a) + text + ta.value.slice(b)
    ta.selectionStart = ta.selectionEnd = a + text.length
    setCode(ta.value)
  }

  async function run() {
    if (!code.trim()) return
    const seq = ++runSeq.current
    setChunks([])
    setNote("")
    setSecs(0)
    setState("load")
    const res = await runPython(code, stdin, {
      onOut: (list) => {
        if (runSeq.current !== seq) return
        // Куски копим в один массив, склеивая соседние одного потока: иначе
        // тысяча печатей станет тысячей узлов разметки.
        setChunks((prev) => {
          const next = prev.slice()
          for (const c of list) {
            const last = next[next.length - 1]
            if (last && last.err === c.err) next[next.length - 1] = { err: c.err, text: last.text + c.text }
            else next.push(c)
          }
          return next
        })
      },
      onStage: (stage) => { if (runSeq.current === seq) setState(stage === "load" ? "load" : "run") },
    })
    if (runSeq.current !== seq) return
    setState(res.stopped ? "stopped" : "done")
    // Причину сбоя самого движка пишем В ВЫВОД, а не только строчкой сбоку:
    // туда смотрят, когда программа не сработала, а мелкая подпись у кнопки
    // остаётся незамеченной.
    if (res.fatal) setChunks((prev) => [...prev, { err: true, text: `\n⚠ ${res.fatal}\n` }])
    setNote(res.fatal ? "Движок перезапущен"
      : res.truncated ? "Вывод обрезан: показано первые 200 КБ"
      : res.stopped ? "Остановлено"
      : res.failed ? "" : `Готово за ${(res.ms / 1000).toFixed(res.ms < 1000 ? 2 : 1)} с`)
  }

  function stop() {
    stopPython()
    setState("stopped")
    setNote("Остановлено")
  }

  const busy = state === "load" || state === "run"
  // Поле ввода открывается САМО, как только в программе появился input(): без
  // него такая программа не запустится вовсе, а догадываться, где взять ввод,
  // ученику негде. Кнопка «Ввод» остаётся для обратного случая — данные уже
  // есть, а вызов ещё не написан.
  const stdinOpen = showStdin || /input\s*\(/.test(code)
  const outText = chunks.map((c) => c.text).join("")
  const panelBg = dark ? "#2c2c2e" : "#fff"
  const panelBorder = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"
  const ink = dark ? "#f5f5f7" : "#1c1c1e"
  const dim = dark ? "#9ca3af" : "#6b7280"
  const codeBox = {
    background: CODE_BG,
    border: `1px solid ${CODE_BORDER}`,
    font: `${FONT_PX}px ${CODE_FONT}`,
    lineHeight: `${FONT_PX * LINE}px`,
    padding: `${PAD}px`,
    boxSizing: "content-box",
    tabSize: 4,
  }

  return (
    // Отступы снизу держат панель НАД тем, что уже стоит в тех углах: над баром
    // инструментов на телефоне и над столбиком зума справа на широком экране.
    // Числа не на глаз: пересечение прямоугольников проверено замером на стенде
    // (до правки панель наезжала на «+ / 100% / −»).
    <div className={`board-panel absolute z-30 flex flex-col rounded-2xl shadow-2xl overflow-hidden
        left-2 right-2 bottom-32 max-h-[56vh]
        big:left-auto big:right-4 big:top-20 big:bottom-36 big:w-[440px] big:max-h-none ${closingCls}`}
      style={{ background: panelBg, border: `1px solid ${panelBorder}` }}
      // Нажатия внутри панели — её дело: без этого доска приняла бы их за
      // рисование и оставила бы штрих под панелью.
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}>

      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: panelBorder }}>
        <Icon name="code" size={16} className="text-blue-500" />
        <span className="text-sm font-medium" style={{ color: ink }}>Python</span>
        <span className="flex-1" />
        <button onClick={() => onPlace?.({ code, out: outText })} disabled={!code.trim()}
          title="Положить программу и вывод на доску"
          className="press-tap px-2.5 py-1 rounded-lg text-xs board-hover disabled:opacity-40"
          style={{ color: dim }}>
          На доску
        </button>
        <button onClick={close} aria-label="Закрыть" title="Закрыть"
          className="press-tap w-7 h-7 rounded-lg flex items-center justify-center board-hover" style={{ color: dim }}>
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="relative rounded-xl overflow-hidden" style={{ height: "min(34vh, 230px)" }}>
          {/* Слой подсветки и поле ввода лежат друг на друге: цвета рисует
              слой, курсор и выделение остаются у поля. */}
          <pre ref={layerRef} aria-hidden="true"
            className="absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words"
            style={{ ...codeBox, color: CODE_INK.plain, width: "100%", height: "100%", borderRadius: 12 }} />
          <textarea ref={taRef} value={code} onChange={(e) => setCode(e.target.value)}
            onScroll={syncScroll} onKeyDown={onKey}
            spellCheck="false" autoCapitalize="off" autoCorrect="off" autoComplete="off"
            placeholder="# программа на питоне"
            // Длинные строки ПЕРЕНОСЯТСЯ, а не уезжают вбок. Панель узкая —
            // около полусотни знаков, а строки кода бывают вдвое длиннее: при
            // боковой прокрутке у строк без отступа пропадало начало, и код
            // читался кусками (жалоба «текст не видно слева»). Перенос держат
            // одинаково поле и слой подсветки — у них общий шрифт, кегль, поля
            // и ширина, поэтому цвета остаются ровно под буквами.
            className="code-input absolute inset-0 w-full h-full resize-none outline-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words"
            style={{ ...codeBox, background: "transparent", border: "1px solid transparent",
              color: "transparent", caretColor: CODE_INK.plain, borderRadius: 12 }} />
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5">
        {busy ? (
          <button onClick={stop} className="press-tap px-3 py-1.5 rounded-xl text-sm font-medium flex items-center gap-1.5 bg-blue-500/12 text-blue-500">
            <Icon name="stop" size={13} /> Стоп
          </button>
        ) : (
          <button onClick={run} disabled={!code.trim()}
            className="press-tap px-3 py-1.5 rounded-xl text-sm font-medium flex items-center gap-1.5 bg-blue-600 text-white disabled:opacity-40">
            <Icon name="play" size={13} /> Запустить
          </button>
        )}
        <button onClick={() => setShowStdin((v) => !v)}
          className={`press-tap px-2.5 py-1.5 rounded-xl text-xs ${stdinOpen ? "bg-blue-500/12 text-blue-500" : "board-hover"}`}
          style={stdinOpen ? undefined : { color: dim }}>
          Ввод
        </button>
        <span className="text-xs flex-1 text-right" style={{ color: dim }}>
          {state === "load" ? (secs > 2 ? `Движок качается, ${secs} с` : "Движок готовится…")
            : state === "run" ? `Выполняется ${secs} с`
            : note}
        </span>
      </div>

      {stdinOpen && (
        <div className="px-3 pb-2">
          <textarea value={stdin} onChange={(e) => setStdin(e.target.value)}
            spellCheck="false" placeholder="то, что программа прочитает через input() — по строке на вызов"
            className="w-full rounded-xl outline-none resize-none"
            style={{ ...codeBox, height: 52, color: CODE_INK.plain, width: "auto" }} />
        </div>
      )}

      <div className="px-3 pb-3 flex-1 min-h-0 flex flex-col">
        <pre ref={outRef} className="m-0 rounded-xl overflow-auto whitespace-pre-wrap flex-1 min-h-[64px]"
          style={{ ...codeBox, color: CODE_INK.plain, maxHeight: "26vh" }}>
          {chunks.length === 0
            ? <span style={{ color: CODE_INK.comment }}>{pythonAvailable() ? "# вывод программы" : "# этот браузер не умеет запускать программы"}</span>
            : chunks.map((c, i) => (
              <span key={i} style={c.err ? { color: "#ff7b72" } : undefined}>{c.text}</span>
            ))}
        </pre>
      </div>
    </div>
  )
}
