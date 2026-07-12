import { useState } from "react"
import { hasGenerators, generateTask, taskThemes } from "./taskGenerators"
import { hasModules, generateModule, moduleScenarios } from "./taskModules"
import { genReadingModule, genMatchingModule, TFN } from "./readingEng"
import { renderTaskMath } from "../utils"
import { downloadZip } from "./zipWriter"
import { downloadXlsx } from "./xlsxWriter"
import Icon from "../components/Icon"

// Временный раздел: быстрый предпросмотр сгенерированных заданий (проверить вид/опечатки).
// Работает целиком на клиентских генераторах (taskGenerators.js), без Supabase.

const EXAM_TYPES = ["ОГЭ", "ЕГЭ", "ОГЭ Информатика", "ОГЭ Английский", "ОГЭ Русский", "ОГЭ Химия", "ОГЭ Обществознание", "ОГЭ История", "ОГЭ Физика", "ОГЭ Биология", "ОГЭ Литература", "ОГЭ География"]
const MAX_NUMBER = 38   // англ. идёт до №38 (устная часть); фильтр numbersWithGen отсекает пустые
const BATCH = 8   // сколько вариантов одного номера показывать за раз
const MOD_BATCH = 3   // модули №1–5 крупнее — показываем меньше за раз

function numbersWithGen(examType) {
  const out = []
  for (let n = 1; n <= MAX_NUMBER; n++) if (hasGenerators(examType, n)) out.push(n)
  return out
}

// Генерация с перехватом ошибок — упавший генератор показывается карточкой-ошибкой,
// а не роняет всю страницу (удобно ловить баги при просмотре). genKey — конкретный типаж.
function genSafe(examType, number, genKey) {
  try {
    const t = generateTask(examType, number, genKey)
    return t || { number, error: "нет генератора" }
  } catch (e) {
    return { number, error: e?.message || String(e) }
  }
}

// focus «gen:<номер>:<ключ>» — конкретный типаж (тема). Разбор в [номер, ключ].
const isGen = (focus) => typeof focus === "string" && focus.startsWith("gen:")
function parseGen(focus) {
  const [, n, ...rest] = focus.split(":")
  return { number: Number(n), key: rest.join(":") }
}
// номер, к которому относится текущий focus (для показа вкладок тем)
function focusNumber(focus) {
  if (typeof focus === "number") return focus
  if (isGen(focus)) return parseGen(focus).number
  return null
}

// Подписи сценариев №1–5 для карточки модуля.
const SCEN_LABEL = { plot: "Дачный участок", apartment: "Квартира", paper: "Листы бумаги", stove: "Печь для бани", tariff: "Тарифы", tires: "Шины", terrain: "План местности", terrainWhite: "План местности (без сетки)" }
const isMod = (focus) => typeof focus === "string" && focus.startsWith("mod:")

// Модуль №1–5 — с перехватом ошибок, как и одиночные задания.
function genModuleSafe(examType, scenarioKey) {
  try {
    return generateModule(examType, scenarioKey) || { module: true, error: "нет модуля" }
  } catch (e) {
    return { module: true, error: e?.message || String(e) }
  }
}

function buildTasks(examType, focus) {
  const nums = numbersWithGen(examType)
  if (isMod(focus)) return Array.from({ length: MOD_BATCH }, () => genModuleSafe(examType, focus.slice(4)))
  if (focus == null) return nums.map((n) => genSafe(examType, n))
  if (isGen(focus)) { const { number, key } = parseGen(focus); return Array.from({ length: BATCH }, () => genSafe(examType, number, key)) }
  return Array.from({ length: BATCH }, () => genSafe(examType, focus))
}

// Копирование текста: сперва Clipboard API (secure context + жест), иначе — execCommand.
function copyText(text) {
  try {
    const ta = document.createElement("textarea")
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch { return false }
}
// Блок кода одного языка с кнопкой «Копировать» (как на решуОГЭ). C++ — во всю ширину.
function CodeBlock({ name, code, wide }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1200) }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(() => { if (copyText(code)) done() })
    } else if (copyText(code)) { done() }
  }
  return (
    <div className={`rounded-lg border border-gray-200 bg-white overflow-hidden ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-600">{name}</span>
        <button onClick={copy} title="Скопировать код"
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-600 transition active:scale-95">
          <Icon name={copied ? "check" : "clipboard"} size={13} />
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <pre className="px-3 py-2.5 text-xs font-mono text-gray-800 overflow-x-auto whitespace-pre leading-relaxed">{code}</pre>
    </div>
  )
}
function ProgramGrid({ blocks }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1">
      {blocks.map((b, i) => <CodeBlock key={b.name} name={b.name} code={b.code} wide={i === blocks.length - 1} />)}
    </div>
  )
}

// №11: кнопка скачивания прилагаемого архива (.zip собирается на клиенте из дерева файлов).
function ArchiveButton({ archive }) {
  const totalFiles = Object.keys(archive.files).length
  return (
    <button
      onClick={() => downloadZip(archive.name, archive.files)}
      className="self-start flex items-center gap-2 mt-1 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition active:scale-95">
      <Icon name="download" size={15} />
      {archive.name}
      <span className="text-[11px] text-blue-400">({totalFiles} файлов)</span>
    </button>
  )
}

// №14: кнопка скачивания прилагаемой электронной таблицы (.xlsx собирается на клиенте).
function SpreadsheetButton({ spreadsheet }) {
  const rows = spreadsheet.rows.length - 1
  return (
    <button
      onClick={() => downloadXlsx(spreadsheet.name, spreadsheet.sheetName, spreadsheet.rows)}
      className="self-start flex items-center gap-2 mt-1 px-3 py-2 rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition active:scale-95">
      <Icon name="download" size={15} />
      {spreadsheet.name}
      <span className="text-[11px] text-green-500">({rows} строк)</span>
    </button>
  )
}

function TaskCard({ task, showAnswer }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Задание {task.number}</span>
        {task.generated && <span className="text-[10px] text-gray-300 uppercase tracking-wide">генератор</span>}
      </div>
      {task.error ? (
        <div className="text-sm text-red-500">Ошибка генерации: {task.error}</div>
      ) : (
        <>
          {task.condition_text && (
            <div
              className="text-sm text-gray-700 leading-relaxed break-words"
              dangerouslySetInnerHTML={{ __html: renderTaskMath(task.condition_text) }}
            />
          )}
          {task.source_text && (
            <Expandable label={task.source_title ? `Развернуть текст «${task.source_title}»` : "Развернуть текст"}>
              <div className="whitespace-pre-line">{task.source_text}</div>
            </Expandable>
          )}
          {task.archive && <ArchiveButton archive={task.archive} />}
          {task.program ? (
            <ProgramGrid blocks={task.program} />
          ) : task.image_url && (
            <img
              src={task.image_url}
              alt={`Задание ${task.number}`}
              className="max-w-full self-start rounded-lg border border-gray-100 bg-white mt-1"
            />
          )}
          {task.condition_tail && (
            <div
              className="text-sm text-gray-700 leading-relaxed break-words"
              dangerouslySetInnerHTML={{ __html: renderTaskMath(task.condition_tail) }}
            />
          )}
          {task.spreadsheet && <SpreadsheetButton spreadsheet={task.spreadsheet} />}
          {showAnswer && (
            <div className="text-xs text-gray-400 mt-1 pt-2 border-t border-gray-50">
              Ответ: <span className="font-mono text-gray-600 whitespace-pre-line">{String(task.answer)}</span>
            </div>
          )}
          {showAnswer && task.answerProgram && (
            <div className="mt-1">
              <div className="text-xs text-gray-400 mb-1">Эталонное решение:</div>
              <ProgramGrid blocks={task.answerProgram} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Модуль №1–5: общий блок (описание + план) и пять привязанных вопросов.
function ModuleCard({ module, showAnswer }) {
  if (module.error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm md:col-span-2">
        <div className="text-sm text-red-500">Ошибка модуля: {module.error}</div>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3 md:col-span-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Задания 1–5 · {SCEN_LABEL[module.scenario] || "практический модуль"}</span>
        <span className="text-[10px] text-gray-300 uppercase tracking-wide">генератор</span>
      </div>
      {/* Тарифы: график сверху, затем текст, затем таблица под текстом. Шины: текст → Рис. 1 и
          Рис. 2 бок о бок с подписями → продолжение текста. Прочие: текст → иллюстрация. */}
      {module.scenario === "tariff" && module.image_url && (
        <img src={module.image_url} alt={SCEN_LABEL[module.scenario] || "иллюстрация"} className="max-w-full self-start rounded-lg border border-gray-100 bg-white" />
      )}
      <div className="text-sm text-gray-700 leading-relaxed break-words whitespace-pre-line">{module.intro}</div>
      {module.scenario === "tires" ? (
        <>
          <div className="flex flex-wrap gap-6 items-end justify-center self-stretch">
            {[["Рис. 1", module.image_url], ["Рис. 2", module.image_url2]].map(([cap, src]) => src && (
              <figure key={cap} className="flex flex-col items-center gap-1 min-w-[130px] max-w-[300px]">
                <img src={src} alt={cap} className="max-w-full rounded-lg border border-gray-100 bg-white" />
                <figcaption className="text-xs text-gray-500">{cap}</figcaption>
              </figure>
            ))}
          </div>
          {module.introRest && (
            <div className="text-sm text-gray-700 leading-relaxed break-words whitespace-pre-line">{module.introRest}</div>
          )}
        </>
      ) : (
        <>
          {module.scenario !== "tariff" && module.image_url && (
            <img src={module.image_url} alt={SCEN_LABEL[module.scenario] || "иллюстрация"} className="max-w-full self-start rounded-lg border border-gray-100 bg-white" />
          )}
          {module.image_url2 && (
            <img src={module.image_url2} alt={SCEN_LABEL[module.scenario] || "иллюстрация"} className="max-w-full self-start rounded-lg border border-gray-100 bg-white" />
          )}
        </>
      )}
      <div className="flex flex-col gap-2">
        {module.tasks.map((t) => (
          <div key={t.number} className="border-t border-gray-50 pt-2">
            <div className="text-sm text-gray-700 leading-relaxed break-words">
              <span className="font-semibold text-gray-500 mr-1">{t.number}.</span>
              <span dangerouslySetInnerHTML={{ __html: renderTaskMath(t.condition_text) }} />
            </div>
            {t.image_url && (
              <img src={t.image_url} alt={`К заданию ${t.number}`} className="max-w-full self-start rounded-lg border border-gray-100 bg-white mt-1" />
            )}
            {showAnswer && (
              <div className="text-xs text-gray-400 mt-1">Ответ: <span className="font-mono text-gray-600">{String(t.answer)}</span></div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Разворачиваемая панель с текстом (кнопка «Развернуть текст» → показывает пассаж/тексты).
function Expandable({ label, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition active:scale-95"
      >
        <Icon name="book" size={15} className={`transition-transform ${open ? "rotate-6" : ""}`} />
        {open ? "Свернуть текст" : label}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-sm text-gray-700 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  )
}

// № 12 — понимание основного содержания (matching, 6 текстов A–F, 7 вопросов, 1 лишний).
// Отдельное задание, не связано с №13–19.
function MatchingCard({ matching, showAnswer }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Задание 12 · Понимание основного содержания</span>
        <span className="text-[10px] text-gray-300 uppercase tracking-wide">чтение</span>
      </div>
      <p className="text-sm text-gray-600">{matching.intro}</p>
      <ol className="text-sm text-gray-700 flex flex-col gap-1 mt-1">
        {matching.questions.map((q) => (
          <li key={q.n}><span className="font-semibold text-gray-500 mr-1">{q.n}.</span>{q.text}</li>
        ))}
      </ol>
      <Expandable label="Развернуть тексты A–F">
        <div className="flex flex-col gap-2">
          {matching.texts.map((t) => (
            <p key={t.letter}><span className="font-semibold text-blue-600 mr-1">{t.letter}.</span>{t.text}</p>
          ))}
        </div>
      </Expandable>
      {showAnswer && (
        <div className="text-xs text-gray-400 mt-1 pt-2 border-t border-gray-50">
          Ответ:{" "}
          <span className="font-mono text-gray-600">
            {["A", "B", "C", "D", "E", "F"].map((l) => `${l}–${matching.key[l]}`).join(", ")}
          </span>
          <span className="ml-2">(лишний вопрос: {matching.extraQ})</span>
        </div>
      )}
    </div>
  )
}

// № 13–19 — понимание запрашиваемой информации: ОДИН общий текст + 7 утверждений
// True/False/Not stated. По задумке: сначала вопрос, рядом кнопка «Развернуть текст».
function ReadingStatementsCard({ module, showAnswer }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Задания 13–19 · один текст «{module.title}»</span>
        <span className="text-[10px] text-gray-300 uppercase tracking-wide">чтение</span>
      </div>
      <p className="text-sm text-gray-600">
        Прочитайте текст и определите, соответствуют ли утверждения его содержанию
        (1 — True, 2 — False, 3 — Not stated).
      </p>
      <Expandable label="Развернуть текст">
        <div className="flex flex-col gap-2">
          {module.text.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </Expandable>
      <div className="flex flex-col gap-2 mt-1">
        {module.statements.map((s) => (
          <div key={s.n} className="border-t border-gray-50 pt-2">
            <div className="text-sm text-gray-700">
              <span className="font-semibold text-gray-500 mr-1">{s.n}.</span>{s.text}
            </div>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {TFN.map((opt, i) => {
                const correct = showAnswer && opt === s.answer
                return (
                  <span key={opt}
                    className={`text-xs px-2.5 py-1 rounded-lg border ${
                      correct ? "bg-green-50 border-green-300 text-green-700 font-medium" : "border-gray-200 text-gray-500"
                    }`}>
                    {i + 1}) {opt}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TaskGenPreview() {
  const [examType, setExamType] = useState("ОГЭ")
  const [focus, setFocus] = useState(null)          // null → «Все», иначе конкретный номер
  const [showAnswer, setShowAnswer] = useState(true)
  const [tasks, setTasks] = useState(() => buildTasks("ОГЭ", null))
  const [reading, setReading] = useState(null)      // {matching, module} для блока чтения №12–19

  const numbers = numbersWithGen(examType)
  const hasReading = examType === "ОГЭ Английский"
  const isReading = focus === "read12" || focus === "read13"
  const rerollReading = () => setReading({ matching: genMatchingModule(), module: genReadingModule() })

  // Генерация запускается явно при выборе (эффект тут не нужен — набор случайный, а не
  // производный от стейта, и setState-в-эффекте вызывает каскадные рендеры).
  function selectExam(t) { setExamType(t); setFocus(null); setTasks(buildTasks(t, null)) }
  function selectFocus(f) {
    setFocus(f)
    if (f === "read12" || f === "read13") rerollReading()
    else setTasks(buildTasks(examType, f))
  }

  function addMore() {
    if (focus == null) return
    if (isMod(focus)) { setTasks((prev) => [...prev, ...Array.from({ length: MOD_BATCH }, () => genModuleSafe(examType, focus.slice(4)))]); return }
    if (isGen(focus)) { const { number, key } = parseGen(focus); setTasks((prev) => [...prev, ...Array.from({ length: BATCH }, () => genSafe(examType, number, key))]); return }
    setTasks((prev) => [...prev, ...Array.from({ length: BATCH }, () => genSafe(examType, focus))])
  }

  const chip = (active, disabled = false) =>
    `px-3 py-1.5 rounded-xl text-sm border transition-all active:scale-95 ${
      active ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-1 flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-gray-800">Банк заданий</h1>
        <span className="text-[10px] uppercase tracking-wide text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
          превью генератора
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-5">
        Быстрый просмотр сгенерированных заданий — проверить вид и опечатки. Временный раздел.
      </p>

      {/* тип экзамена */}
      <div className="flex flex-wrap gap-2 mb-3">
        {EXAM_TYPES.map((t) => {
          const has = numbersWithGen(t).length > 0
          return (
            <button
              key={t}
              disabled={!has}
              onClick={() => selectExam(t)}
              className={chip(examType === t, !has)}
            >
              {t}{!has && " (нет)"}
            </button>
          )
        })}
      </div>

      {/* модули №1–5 по типам (отдельные вкладки для проверки каждого сценария) */}
      {hasModules(examType) && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-gray-400 mr-1">№1–5 по типам:</span>
          {moduleScenarios(examType).map((s) => (
            <button key={s.key} onClick={() => selectFocus("mod:" + s.key)} className={chip(focus === "mod:" + s.key)}>{s.label}</button>
          ))}
        </div>
      )}

      {/* одиночные номера */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => selectFocus(null)} className={chip(focus == null)}>Все</button>
        {hasReading && (
          <>
            <button onClick={() => selectFocus("read12")} className={chip(focus === "read12")}>📖 №12</button>
            <button onClick={() => selectFocus("read13")} className={chip(focus === "read13")}>📖 №13–19</button>
          </>
        )}
        {numbers.map((n) => (
          <button key={n} onClick={() => selectFocus(n)} className={chip(focusNumber(focus) === n)}>№{n}</button>
        ))}
      </div>

      {/* темы выбранного номера — можно листать и обновлять каждый типаж отдельно */}
      {focusNumber(focus) != null && taskThemes(examType, focusNumber(focus)) && (
        <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3 flex flex-col gap-2.5">
          <button
            onClick={() => selectFocus(focusNumber(focus))}
            className={`self-start ${chip(typeof focus === "number")}`}
          >
            Все типажи №{focusNumber(focus)}
          </button>
          {taskThemes(examType, focusNumber(focus)).map((g) => (
            <div key={g.theme} className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 w-full sm:w-36 shrink-0">{g.theme}</span>
              {g.items.map((it) => {
                const key = `gen:${focusNumber(focus)}:${it.key}`
                return (
                  <button key={it.key} onClick={() => selectFocus(key)} className={chip(focus === key)}>{it.label}</button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* действия */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={() => (isReading ? rerollReading() : setTasks(buildTasks(examType, focus)))}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 active:scale-95 transition-all"
        >
          <Icon name="repeat" size={15} /> Обновить
        </button>
        {focus != null && !isReading && (
          <button
            onClick={addMore}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            Ещё {isMod(focus) ? MOD_BATCH : BATCH}
          </button>
        )}
        <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer ml-auto select-none">
          <input type="checkbox" checked={showAnswer} onChange={(e) => setShowAnswer(e.target.checked)} />
          Ответы
        </label>
      </div>

      {isReading ? (
        reading && (focus === "read12"
          ? <MatchingCard matching={reading.matching} showAnswer={showAnswer} />
          : <ReadingStatementsCard module={reading.module} showAnswer={showAnswer} />)
      ) : numbers.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-12 border border-dashed border-gray-200 rounded-xl">
          Для {examType} генераторов пока нет.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((t, i) => t.tasks || (t.module && t.error)
            ? <ModuleCard key={i} module={t} showAnswer={showAnswer} />
            : <TaskCard key={i} task={t} showAnswer={showAnswer} />)}
        </div>
      )}
    </div>
  )
}
