import { useState } from "react"
import { generateTask, taskThemes } from "./taskGenerators"
import { EXAM_GROUPS, levelOf, numbersWithGen } from "./examSubjects"
import { hasModules, generateModule, moduleScenarios } from "./taskModules"
import { genReadingModule, genMatchingModule, TFN } from "./readingEng"
import { renderTaskMath } from "../utils"
import { downloadZip } from "./zipWriter"
import { downloadXlsx } from "./xlsxWriter"
import Icon from "../components/Icon"
import MorphIcon from "../components/MorphIcon"
import SegmentSwitch from "../components/SegmentSwitch"
import { PlanLock } from "../components/PlanLock"
import { usePlan } from "../subscription"
import Reveal from "../components/Reveal"
// Тетрадь тянет за собой jsPDF и html2canvas — грузим только когда её открыли,
// иначе просмотр банка стал бы на полмегабайта тяжелее.

// Временный раздел: быстрый предпросмотр сгенерированных заданий (проверить вид/опечатки).
// Работает целиком на клиентских генераторах (taskGenerators.js), без Supabase.

const BATCH = 8   // сколько вариантов одного номера показывать за раз
const MOD_BATCH = 3   // модули №1–5 крупнее — показываем меньше за раз

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
// focus «fam:<номер>:<тема>» — всё семейство целиком (случайный типаж внутри темы на каждую
// карточку): у №13 профиля 20 семейств и 89 типажей, поштучно их листать неудобно.
const isFam = (focus) => typeof focus === "string" && focus.startsWith("fam:")
function parseFam(focus) {
  const [, n, ...rest] = focus.split(":")
  return { number: Number(n), theme: rest.join(":") }
}
const famKey = (n, theme) => `fam:${n}:${theme}`
// номер, к которому относится текущий focus (для показа вкладок тем)
function focusNumber(focus) {
  if (typeof focus === "number") return focus
  if (isGen(focus)) return parseGen(focus).number
  if (isFam(focus)) return parseFam(focus).number
  return null
}
// один случайный типаж семейства
function genFamSafe(examType, number, theme) {
  const g = (taskThemes(examType, number) || []).find((t) => t.theme === theme)
  if (!g || !g.items.length) return { number, error: "нет семейства" }
  return genSafe(examType, number, g.items[Math.floor(Math.random() * g.items.length)].key)
}

// «89 типажей» / «2 типажа» / «1 типаж»
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
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
  if (isFam(focus)) { const { number, theme } = parseFam(focus); return Array.from({ length: BATCH }, () => genFamSafe(examType, number, theme)) }
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
    <div className={`rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e] overflow-hidden ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-white/10">
        <span className="text-xs font-semibold text-gray-600">{name}</span>
        <button onClick={copy} title="Скопировать код"
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-blue-600 transition active:scale-95">
          <MorphIcon from="clipboard" size={13} active={copied} />
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      {/* Длинные строки (C++, Паскаль) переносим, а не прячем за горизонтальным скроллом:
          в колонке шириной в половину карточки скроллилась почти каждая программа. */}
      <pre className="px-3 py-2.5 text-xs font-mono text-gray-800 whitespace-pre-wrap break-words leading-relaxed">{code}</pre>
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
  // Книга может быть многолистовой (КЕГЭ №3): тогда в rows лежит массив листов.
  const sheets = Array.isArray(spreadsheet.sheets) ? spreadsheet.sheets : null
  const rows = sheets ? sheets.reduce((a, sh) => a + sh.rows.length - 1, 0) : spreadsheet.rows.length - 1
  return (
    <button
      onClick={() => downloadXlsx(spreadsheet.name, sheets || spreadsheet.sheetName, spreadsheet.rows)}
      className="self-start flex items-center gap-2 mt-1 px-3 py-2 rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition active:scale-95">
      <Icon name="download" size={15} />
      {spreadsheet.name}
      <span className="text-[11px] text-green-500">({rows} строк)</span>
    </button>
  )
}

// КЕГЭ №17, №24, №26, №27: кнопка скачивания прилагаемого текстового файла с данными.
// Файл генерируется вместе с задачей, поэтому ответ всегда соответствует его содержимому.
function TextFileButton({ textFile }) {
  const lines = textFile.content.split("\n").length
  const download = () => {
    const url = URL.createObjectURL(new Blob([textFile.content], { type: "text/plain;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = textFile.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <button
      onClick={download}
      className="self-start flex items-center gap-2 mt-1 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition active:scale-95">
      <Icon name="download" size={15} />
      {textFile.name}
      <span className="text-[11px] text-amber-500">({lines > 1 ? `${lines} строк` : `${textFile.content.length} символов`})</span>
    </button>
  )
}

function TaskCard({ task, showAnswer }) {
  return (
    <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-gray-100 dark:border-white/10 p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-500">Задание {task.number}</span>
        {task.generated && <span className="text-[10px] text-gray-300 uppercase tracking-wide">генератор</span>}
      </div>
      {task.error ? (
        <div className="text-sm text-red-500">Ошибка генерации: {task.error}</div>
      ) : (
        <>
          {task.condition_text && (
            <div
              className="text-base text-gray-700 leading-relaxed break-words"
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
              className="max-w-full h-auto self-start rounded-lg border border-gray-100 bg-white mt-1"
            />
          )}
          {task.condition_tail && (
            <div
              className="text-base text-gray-700 leading-relaxed break-words"
              dangerouslySetInnerHTML={{ __html: renderTaskMath(task.condition_tail) }}
            />
          )}
          {task.spreadsheet && <SpreadsheetButton spreadsheet={task.spreadsheet} />}
          {/* №27 приходит с ДВУМЯ входными файлами (A и B) — тогда task.textFile массив. */}
          {task.textFile && (Array.isArray(task.textFile) ? task.textFile : [task.textFile])
            .map((f) => <TextFileButton key={f.name} textFile={f} />)}
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
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-gray-100 dark:border-white/10 p-4 shadow-sm md:col-span-2">
        <div className="text-sm text-red-500">Ошибка модуля: {module.error}</div>
      </div>
    )
  }
  return (
    <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-gray-100 dark:border-white/10 p-4 shadow-sm flex flex-col gap-3 md:col-span-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Задания 1–5 · {SCEN_LABEL[module.scenario] || "практический модуль"}</span>
        <span className="text-[10px] text-gray-300 uppercase tracking-wide">генератор</span>
      </div>
      {/* Тарифы: график сверху, затем текст, затем таблица под текстом. Шины: текст → Рис. 1 и
          Рис. 2 бок о бок с подписями → продолжение текста. Прочие: текст → иллюстрация. */}
      {module.scenario === "tariff" && module.image_url && (
        <img src={module.image_url} alt={SCEN_LABEL[module.scenario] || "иллюстрация"} className="w-full max-w-md self-start rounded-lg border border-gray-100 bg-white" />
      )}
      <div className="text-base text-gray-700 leading-relaxed break-words whitespace-pre-line">{module.intro}</div>
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
            <div className="text-base text-gray-700 leading-relaxed break-words whitespace-pre-line">{module.introRest}</div>
          )}
        </>
      ) : (
        <>
          {module.scenario !== "tariff" && module.image_url && (
            <img src={module.image_url} alt={SCEN_LABEL[module.scenario] || "иллюстрация"} className="w-full max-w-md self-start rounded-lg border border-gray-100 bg-white" />
          )}
          {module.image_url2 && (
            <img src={module.image_url2} alt={SCEN_LABEL[module.scenario] || "иллюстрация"} className="w-full max-w-md self-start rounded-lg border border-gray-100 bg-white" />
          )}
        </>
      )}
      <div className="flex flex-col gap-2">
        {module.tasks.map((t) => (
          <div key={t.number} className="border-t border-gray-50 pt-2">
            <div className="text-base text-gray-700 leading-relaxed break-words">
              <span className="font-semibold text-gray-500 mr-1">{t.number}.</span>
              <span dangerouslySetInnerHTML={{ __html: renderTaskMath(t.condition_text) }} />
            </div>
            {t.image_url && (
              <img src={t.image_url} alt={`К заданию ${t.number}`} className="max-w-full h-auto self-start rounded-lg border border-gray-100 bg-white mt-1" />
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
      <Reveal value={open}>{() => (
        <div className="mt-2 rounded-xl border border-gray-100 dark:border-white/10 p-3 text-sm text-gray-700 leading-relaxed">
          {children}
        </div>
      )}</Reveal>
    </div>
  )
}

// № 12 — понимание основного содержания (matching, 6 текстов A–F, 7 вопросов, 1 лишний).
// Отдельное задание, не связано с №13–19.
function MatchingCard({ matching, showAnswer }) {
  return (
    <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-gray-100 dark:border-white/10 p-4 shadow-sm flex flex-col gap-2">
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
    <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-gray-100 dark:border-white/10 p-4 shadow-sm flex flex-col gap-2">
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

function TaskGenPreview() {
  const [examType, setExamType] = useState("ОГЭ")
  const [focus, setFocus] = useState(null)          // null → «Все», иначе конкретный номер
  const [showAnswer, setShowAnswer] = useState(true)
  const [tasks, setTasks] = useState(() => buildTasks("ОГЭ", null))
  const [reading, setReading] = useState(null)      // {matching, module} для блока чтения №12–19
  const [openTheme, setOpenTheme] = useState(null)  // раскрытое семейство типажей (аккордеон)

  const numbers = numbersWithGen(examType)
  const level = levelOf(examType)
  const currentGroup = EXAM_GROUPS.find((g) => g.key === level) || EXAM_GROUPS[1]
  const hasReading = examType === "ОГЭ Английский"
  const isReading = focus === "read12" || focus === "read13"
  const rerollReading = () => setReading({ matching: genMatchingModule(), module: genReadingModule() })

  // Генерация запускается явно при выборе (эффект тут не нужен — набор случайный, а не
  // производный от стейта, и setState-в-эффекте вызывает каскадные рендеры).
  function selectExam(t) { setExamType(t); setFocus(null); setOpenTheme(null); setTasks(buildTasks(t, null)) }
  // Переключение уровня (ЕГЭ / ОГЭ) → берём первый доступный предмет группы.
  function selectLevel(key) {
    if (key === level) return
    const group = EXAM_GROUPS.find((g) => g.key === key)
    const first = group.subjects.find((s) => numbersWithGen(s.type).length > 0) || group.subjects[0]
    selectExam(first.type)
  }
  function selectFocus(f) {
    if (focusNumber(f) !== focusNumber(focus)) setOpenTheme(null)   // сменили номер — свернуть темы
    setFocus(f)
    if (f === "read12" || f === "read13") rerollReading()
    else setTasks(buildTasks(examType, f))
  }

  function addMore() {
    if (focus == null) return
    if (isMod(focus)) { setTasks((prev) => [...prev, ...Array.from({ length: MOD_BATCH }, () => genModuleSafe(examType, focus.slice(4)))]); return }
    if (isGen(focus)) { const { number, key } = parseGen(focus); setTasks((prev) => [...prev, ...Array.from({ length: BATCH }, () => genSafe(examType, number, key))]); return }
    if (isFam(focus)) { const { number, theme } = parseFam(focus); setTasks((prev) => [...prev, ...Array.from({ length: BATCH }, () => genFamSafe(examType, number, theme))]); return }
    setTasks((prev) => [...prev, ...Array.from({ length: BATCH }, () => genSafe(examType, focus))])
  }

  const themes = focusNumber(focus) != null ? taskThemes(examType, focusNumber(focus)) : null
  const themeCount = themes ? themes.reduce((a, g) => a + g.items.length, 0) : 0

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

      {/* уровень экзамена — сегмент-контрол ЕГЭ / ОГЭ */}
      <SegmentSwitch
        items={EXAM_GROUPS.map((g) => ({ key: g.key }))}
        value={level}
        onChange={selectLevel}
        ariaLabel="Уровень экзамена"
        className="mb-4"
      />

      {/* предметы выбранного уровня */}
      <div className="flex flex-wrap gap-2 mb-4">
        {currentGroup.subjects.map((s) => {
          const has = numbersWithGen(s.type).length > 0
          const active = examType === s.type
          return (
            <button
              key={s.type}
              disabled={!has}
              onClick={() => selectExam(s.type)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm border transition-all active:scale-95 ${
                active
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              } ${!has ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <span className={`w-2 h-2 rounded-full ${active ? "bg-white/90" : s.dot}`} />
              {s.label}{!has && " (нет)"}
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

      {/* Темы выбранного номера. Семейств бывает много (№13 профиля — 20 семейств / 89
          типажей), поэтому список свёрнут: видны названия семейств, раскрывается одно.
          «Смотреть» рядом с названием листает случайные типажи всего семейства. */}
      {focusNumber(focus) != null && themes && (
        <div className="mb-4 rounded-xl border border-gray-100 dark:border-white/10 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => selectFocus(focusNumber(focus))} className={chip(typeof focus === "number")}>
              Все типажи №{focusNumber(focus)}
            </button>
            <span className="text-xs text-gray-400">
              {themeCount} {plural(themeCount, "типаж", "типажа", "типажей")} в {themes.length}{" "}
              {plural(themes.length, "теме", "темах", "темах")}
            </span>
          </div>
          {themes.map((g) => {
            const fam = famKey(focusNumber(focus), g.theme)
            const open = openTheme === g.theme
            const inside = g.items.some((it) => focus === `gen:${focusNumber(focus)}:${it.key}`)
            return (
              <div
                key={g.theme}
                className={`rounded-xl border transition-colors ${
                  open || inside || focus === fam ? "border-blue-200 bg-white" : "border-gray-200/70 bg-white/60"
                }`}
              >
                <div className="flex items-center gap-2 px-2.5 py-1.5">
                  <button
                    onClick={() => setOpenTheme(open ? null : g.theme)}
                    className="flex items-center gap-1.5 min-w-0 text-left text-[13px] font-semibold text-gray-600 hover:text-gray-800 transition-colors active:scale-[0.98]"
                  >
                    <Icon
                      name="chevron-right"
                      size={13}
                      className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                    />
                    <span className="truncate">{g.theme}</span>
                    <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-blue-500/10 ring-1 ring-blue-500/20 text-[11px] font-medium text-blue-600">
                      {g.items.length}
                    </span>
                  </button>
                  <button
                    onClick={() => { setOpenTheme(g.theme); selectFocus(fam) }}
                    className={`ml-auto shrink-0 px-2.5 py-1 rounded-lg text-xs border transition-all active:scale-95 ${
                      focus === fam
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    Смотреть
                  </button>
                </div>
                <Reveal value={open}>{() => (
                  <div className="flex flex-wrap gap-2 px-2.5 pb-2.5 pt-2 border-t border-gray-100">
                    {g.items.map((it) => {
                      const key = `gen:${focusNumber(focus)}:${it.key}`
                      return (
                        <button key={it.key} onClick={() => selectFocus(key)} className={chip(focus === key)}>{it.label}</button>
                      )
                    })}
                  </div>
                )}</Reveal>
              </div>
            )
          })}
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

// Весь раздел — возможность тарифа: банк заданий и печатные тетради начинаются
// с «Про». Гейт обёрткой, а не условным return внутри: иначе часть хуков
// компонента перестала бы вызываться.
export default function TaskGenPreviewGate(props) {
  const { allows } = usePlan()
  if (allows("taskBank")) return <TaskGenPreview {...props} />
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-medium mb-1">Банк заданий</h1>
      <p className="text-sm text-gray-500 mb-5">
        Задания по образцу ФИПИ: 13 предметов ОГЭ и ЕГЭ, каждое генерируется заново.
      </p>
      <PlanLock
        feature="taskBank"
        title="Банк заданий"
        text="Свой банк заданий по 13 предметам, тренировка на экране и печатные рабочие тетради."
      />
    </div>
  )
}
