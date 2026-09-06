import { useState, useEffect, useRef, Fragment } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import { signRows } from "../storageUrl"
import SplitTasksModal from "../components/SplitTasksModal"
import { canSplit } from "./homeworkSplit"
import Icon from "../components/Icon"
import StatTabs from "../components/StatTabs"
import MethodCards from "../components/MethodCards"
import Collapse from "../components/Collapse"
import Reveal from "../components/Reveal"
import AutoHeight from "../components/AutoHeight"
import FormulaBackdrop from "../components/FormulaBackdrop"
import { parseLocalDate, renderHomeworkMath, plainTaskMath, superscriptPowers, parseHomeworkTasks, homeworkTaskItems, homeworkTestScore, plural, hasAttachment, getInitials, answersEqual } from "../utils"
import { usePlan } from "../subscription"
import { PlanHint, PlanLock } from "../components/PlanLock"
import ConfirmModal from "../components/ConfirmModal"
import { isOwner } from "../owner"
import TaskAttachments from "../components/TaskAttachments"
import TasksModal from "../components/TasksModal"
import { useClosing } from "../useClosing"
import useGridCols, { detailRowEndOf } from "../useGridCols"
import getAvatarColor from "../avatarColor"
import DateTile from "../components/DateTile"
import { TILE_TINTS, dueTintKey } from "../dueTint"
// Список предметов — из лёгкого модуля: сами генераторы приезжают отдельно
// (homeworkBank), и тащить их в бандл раздела ради подписей нельзя.
import { subjectGroups, firstType, typeForStudent, BANK_SUBJECTS } from "./examSubjectList"

const STATUS_LABELS = {
  assigned: { label: "Выдано", cls: "text-gray-600 ring-1 ring-gray-200 dark:ring-white/15" },
  submitted: { label: "На проверке", cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  done: { label: "Выполнено", cls: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" },
  revision: { label: "На доработке", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
}

const TYPE_LABELS = {
  written: { label: "Письменное", iconName: "edit" },
  test: { label: "С ответами", iconName: "file-text" },
  combined: { label: "Комбинированное", iconName: "clipboard" },
}

function getGradeFromPercent(percent) {
  if (percent >= 90) return 5
  if (percent >= 75) return 4
  if (percent >= 50) return 3
  return 2
}

// Тинты на opacity + кольцо → одинаково читаются в светлой и тёмной теме.
const GRADE_COLORS = {
  5: "bg-green-500/18 text-green-700 dark:text-green-300 ring-1 ring-green-500/35",
  4: "bg-blue-500/18 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/35",
  3: "bg-amber-500/18 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/35",
  2: "bg-red-500/18 text-red-700 dark:text-red-300 ring-1 ring-red-500/35",
}

// Просрочка: дедлайн прошёл, а работа ещё не сдана и не проверена.
// Сравниваем по началу суток — дедлайн в базе хранится датой, без времени.
function isOverdue(hw) {
  if (!hw.deadline) return false
  if (hw.status === "done" || hw.status === "submitted") return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return parseLocalDate(hw.deadline) < today
}

// Название по умолчанию — сегодняшняя дата: чаще всего задание выдаётся на
// текущем занятии, и репетитору остаётся только переименовать при желании.
function todayTitle() {
  const d = new Date()
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) + " " + d.getFullYear()
}

function buildUploadPath(tutorId, name) {
  const ext = name.split(".").pop()
  return tutorId + "/" + Date.now() + "." + ext
}

// Картинка задания, нарезанного из файла. Хранится рядом с остальными файлами
// репетитора (свой каталог по auth.uid — так разрешает политика бакета), а не
// внутри строки задания: работа со скринами весит мегабайты, и список домашних
// работ тянул бы их все разом при каждом открытии раздела.
async function uploadTaskImage(tutorId, dataUrl, idx) {
  const blob = await (await fetch(dataUrl)).blob()
  const path = `${tutorId}/hw-tasks/${Date.now()}-${idx}.jpg`
  const { error } = await supabase.storage.from("homework").upload(path, blob, { contentType: "image/jpeg" })
  if (error) throw error
  const { data } = supabase.storage.from("homework").getPublicUrl(path)
  return data.publicUrl
}

// Локальная дата в формате YYYY-MM-DD. toISOString() отдал бы UTC и вечером по
// Москве сдвинул бы срок на день назад.
function isoDay(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Срок сдачи выбирается одним нажатием: календарь остаётся для редкого случая.
const DEADLINE_CHIPS = [
  { label: "Без срока", days: null },
  { label: "Завтра", days: 1 },
  { label: "3 дня", days: 3 },
  { label: "Неделя", days: 7 },
]

const chipCls = (on) =>
  `px-3 py-1.5 rounded-full text-xs transition-all active:scale-[0.94] ${
    on
      ? "bg-blue-600 text-white shadow-sm"
      : "text-gray-600 ring-1 ring-gray-200 dark:ring-white/15 hover:ring-gray-300"
  }`

// Переключатель «тумблер + подпись»: одинаковый во всей форме.
// Нажатие показывает сам переключатель (щелчок рычажка + лёгкое сжатие), а не
// серая заливка во всю строку: .no-press снимает общий overlay для широких
// кнопок — на строке с подписью в две строки он читался как выделение текста.
function Toggle({ on, onClick, title, note, disabled = false }) {
  return (
    <button type="button" onClick={disabled ? undefined : onClick} aria-disabled={disabled || undefined}
      className={`no-press group w-full flex items-start gap-3 text-left ${disabled ? "opacity-60 cursor-default" : ""}`}>
      <div className={`mt-0.5 w-10 h-6 rounded-full transition relative flex-shrink-0 ${disabled ? "" : "group-active:scale-95"} ${on ? "bg-blue-600" : "bg-blue-500/15 ring-1 ring-inset ring-blue-500/25 dark:bg-white/[0.16] dark:ring-white/20"}`}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${on ? "left-5" : "left-1"}`} />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-gray-700">{title}</div>
        {note && <div className="text-xs text-gray-400 leading-snug">{note}</div>}
      </div>
    </button>
  )
}

// Три способа собрать домашнее задание. Карточками, а не спрятанной строкой:
// раньше сборка ИИ пряталась за узкой ссылкой, и о ней никто не догадывался.
const HW_METHODS = [
  { id: "file", icon: "paperclip", title: "Свой файл", note: "PDF, Word или фото — разберём на задания" },
  { id: "bank", icon: "grid", title: "Из банка заданий", note: "Номера и темы ОГЭ/ЕГЭ — соберём с ответами" },
  { id: "ai", icon: "sparkles", title: "Составить ИИ", note: "Задания по любой теме, готовы за минуту" },
]

// Потолок счётчика у одного номера. Не про технику, а про смысл: домашняя
// работа из двадцати задач одного номера — это уже не домашняя работа.
const BANK_MAX_PER_NUMBER = 10
// Практических блоков — меньше: в каждом сразу пять заданий с общим чертежом.
const BANK_MAX_MODULES = 3

// Ключ вон из объекта выбора: номер без количества и без тем в нём не хранится,
// иначе «сбросить» перестало бы быть отличимым от «выбрано ноль заданий».
const dropKey = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== String(key)))

// Кружок «−» / «+» у счётчика заданий.
function StepBtn({ icon, onClick, disabled, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="no-press w-6 h-6 shrink-0 rounded-full grid place-items-center text-gray-500 ring-1 ring-gray-500/20
        hover:bg-blue-500/10 active:scale-90 transition-all disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <Icon name={icon} size={11} />
    </button>
  )
}

// Строка номера в сборке из банка: слева счётчик заданий, дальше название
// раздела, внутри — темы с числом типажей. Раньше номера были сеткой квадратов
// с одним общим количеством на всю работу: по «17» не понять, что это за
// задание, а «пять любых» — не то, что репетитор задаёт на самом деле.
function BankNumberRow({ info, pick, open, onCount, onTheme, onOpen }) {
  const count = pick?.count || 0
  const picked = pick?.themes || []
  const themes = info.themes || []
  const expandable = themes.length > 1
  // Практический блок считается блоками: за каждым стоит пять связанных заданий,
  // и репетитор должен видеть это прямо в строке, а не после сборки.
  const isModule = !!info.module
  const max = isModule ? BANK_MAX_MODULES : BANK_MAX_PER_NUMBER
  return (
    <div className={count ? "bg-blue-500/[0.05]" : ""}>
      <div className="flex items-center gap-1.5 px-2 py-1">
        <StepBtn icon="minus" onClick={() => onCount(count - 1)} disabled={!count} title="Меньше заданий" />
        <span className={`w-5 text-center text-xs tabular-nums ${count ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-400"}`}>
          {count}
        </span>
        <StepBtn icon="plus" onClick={() => onCount(count + 1)} disabled={count >= max}
          title={isModule ? "Больше блоков" : "Больше заданий"} />
        <button
          type="button"
          onClick={expandable ? onOpen : () => onCount(count + 1)}
          className="press-fill min-w-0 flex-1 text-left rounded-lg px-1.5 py-1 flex items-baseline gap-1.5"
        >
          <span className="text-xs tabular-nums shrink-0 text-gray-400">{info.label || info.number}.</span>
          <span className="text-sm truncate text-gray-700">{info.title}</span>
          {isModule && count > 0 && (
            <span className="text-[11px] text-gray-400 shrink-0">
              · {count * 5} {plural(count * 5, "задание", "задания", "заданий")}
            </span>
          )}
          {picked.length > 0 && (
            <span className="text-[11px] text-blue-600 dark:text-blue-400 shrink-0">
              · {picked.length} {isModule
                ? plural(picked.length, "сценарий", "сценария", "сценариев")
                : plural(picked.length, "тема", "темы", "тем")}
            </span>
          )}
          {expandable && (
            <span className={`ml-auto shrink-0 text-gray-400 transition-transform ${open ? "-rotate-90" : "rotate-90"}`}>
              <Icon name="arrow" size={11} />
            </span>
          )}
        </button>
      </div>
      {expandable && (
        <Collapse open={open}>
          <div className="pl-9 pr-2 pb-2 flex flex-col gap-0.5">
            {themes.map((g) => {
              const on = picked.includes(g.theme)
              return (
                <button
                  key={g.theme}
                  type="button"
                  onClick={() => onTheme(g.theme)}
                  className="press-fill rounded-lg px-1.5 py-1 flex items-center gap-2 text-left"
                >
                  <span className={`w-4 h-4 shrink-0 rounded-[6px] grid place-items-center transition-colors ${
                    on ? "bg-blue-600 text-white" : "ring-1 ring-gray-500/25"
                  }`}>
                    {on && <Icon name="check" size={9} />}
                  </span>
                  <span className={`text-xs truncate ${on ? "text-gray-800" : "text-gray-600"}`}>
                    {g.theme}
                  </span>
                  {g.items.length > 0 && (
                    <span className="text-[11px] text-gray-400 shrink-0 ml-auto">
                      {g.items.length} {plural(g.items.length, "типаж", "типажа", "типажей")}
                    </span>
                  )}
                </button>
              )
            })}
            <div className="text-[11px] text-gray-400 px-1.5 pt-0.5 leading-snug">
              {isModule
                ? (picked.length
                  ? "Блок собирается только по отмеченным сценариям."
                  : "Сценарий не отмечен — блок берётся из любого. В блоке пять заданий с общим условием и чертежом.")
                : (picked.length ? "Задания берутся только из отмеченных тем." : "Тема не отмечена — задания берутся из любой.")}
            </div>
          </div>
        </Collapse>
      )}
    </div>
  )
}

// Условие в одну строку: описание ДЗ разбирается по строкам («1. …», «2. …»),
// и перенос внутри задания превратил бы его в два.
const oneLine = (s) => String(s || "").replace(/\s*\n+\s*/g, " ").trim()

// Ответ годится для автопроверки, если ученик способен набрать его с
// клавиатуры. Пробел этому не мешает: «0; 4» и «нет корней» answersEqual()
// сверяет как обычные ответы (пробелы при сравнении убираются). Не годятся
// сырой LaTeX от модели (\frac{1}{3} ученик не наберёт) и развёрнутый ответ —
// у заданий части 2 в «ответе» лежит целое доказательство, его не сверить.
const ANSWER_MAX = 40
const isSimpleAnswer = (a) => a.length > 0 && a.length <= ANSWER_MAX && !/[\n\\{}]/.test(a)

// Модель пишет математику в LaTeX — и норовит писать его же в ответе, хотя
// ответ ученик НАБИРАЕТ с клавиатуры. Переводим то, что переводится
// однозначно: обёртки, тонкие пробелы и дроби (\frac{1}{3} → 1/3). Корни,
// степени и прочее оставляем как есть — работа уйдёт письменной, и это
// честнее, чем подсунуть ученику ответ, который он не наберёт.
function plainAnswer(raw) {
  let a = String(raw ?? "").trim()
  if (!a) return ""
  a = a
    .replace(/\$+/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\\[,;:!]/g, "")
    .replace(/\\ /g, " ")
  // Дробь разворачиваем в одну черту: \frac{1}{3} → 1/3, перечисление дробей —
  // тем же проходом. Дробь в дроби так не записать («1/2/3» читается двояко):
  // после прохода в записи остаётся внешний \frac, и мы оставляем ответ
  // формулой — работа уйдёт письменной, а не со сверкой по кривому ответу.
  const flat = a.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2")
  if (flat !== a && !/\\[dt]?frac/.test(flat)) a = flat
  return a.replace(/\s+/g, " ").trim()
}

// Поле правки, которое вне редактирования показывает то же, что увидит ученик:
// ИИ отдаёт математику простым LaTeX (\frac{1}{3}), и без рендера репетитор
// проверял бы варианты по сырому исходнику. Клик (или фокус с клавиатуры)
// превращает строку в поле ввода, потеря фокуса возвращает формулу.
function MathField({ value, onChange, multiline = false, rows = 2, className = "", viewClassName = "", placeholder = "" }) {
  const [editing, setEditing] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!editing || !el) return
    el.focus()
    // Курсор в конец, а не в начало: правят обычно хвост формулы.
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  if (editing) {
    const common = {
      ref,
      value,
      onChange: (e) => onChange(e.target.value),
      onBlur: () => setEditing(false),
      // Enter в однострочном поле и Escape в любом — выход из правки, а не отправка формы.
      onKeyDown: (e) => { if (e.key === "Escape" || (e.key === "Enter" && !multiline)) { e.preventDefault(); e.currentTarget.blur() } },
      className,
    }
    return multiline ? <textarea {...common} rows={rows} /> : <input {...common} />
  }

  const shown = String(value ?? "").trim()
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onFocus={() => setEditing(true)}
      title="Нажмите, чтобы изменить"
      className={`${viewClassName} cursor-text transition-colors hover:bg-blue-500/[0.06] focus:outline-none`}
      {...(shown
        ? { dangerouslySetInnerHTML: { __html: renderHomeworkMath(shown) } }
        : { children: <span className="text-gray-400">{placeholder}</span> })}
    />
  )
}

// Непустые варианты ответа одного задания.
const cleanOpts = (t) => (t.options || []).map((o) => o.trim()).filter(Boolean)

function CreateHomeworkModal({ students, tutorId, onClose, onCreated, editingHw, bankSubjects = null, owner = false }) {
  const isEditing = !!editingHw
  const [studentId, setStudentId] = useState(editingHw?.student_id ? String(editingHw.student_id) : "")
  // Дату подставляем один раз при открытии — иначе перерисовка вернула бы
  // подстановку поверх того, что репетитор уже написал.
  const [defaultTitle] = useState(todayTitle)
  const [title, setTitle] = useState(editingHw?.title || defaultTitle)
  // Подставленную дату банк и ИИ вправе заменить своим названием, набранное
  // вручную — нет.
  const isAutoTitle = !title.trim() || title === defaultTitle
  const [description, setDescription] = useState(editingHw?.description || "")
  const [deadline, setDeadline] = useState(editingHw?.deadline || "")
  // Календарь показываем только если срок не попал в быстрые чипы.
  const [pickDate, setPickDate] = useState(
    !!editingHw?.deadline && !DEADLINE_CHIPS.some((c) => c.days != null && isoDay(c.days) === editingHw.deadline)
  )
  const [file, setFile] = useState(null)
  // Задания, нарезанные из загруженного файла: картинка условия, текст (если у
  // файла был текстовый слой) и ответ, который вписывает репетитор. Работа
  // после этого ничем не отличается от собранной из банка — ученик решает её
  // по заданиям, а не смотрит на PDF целиком.
  const [splitTasks, setSplitTasks] = useState([])
  const [splitOpen, setSplitOpen] = useState(false)
  // Ответы к нарезанным заданиям у репетитора обычно уже есть одной строкой
  // (ключ к варианту), а полей бывает под сотню. Строка раскладывается по
  // заданиям по порядку; сколько слов из неё разошлось — держим отдельно,
  // чтобы при укорачивании строки освободившиеся поля очищались.
  const [bulkAnswers, setBulkAnswers] = useState("")
  const [bulkCount, setBulkCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  // Тип задания больше не выбирается вручную: работа становится тестом ровно
  // тогда, когда у неё появляются ответы для автопроверки (тумблер в форме).
  // Новое задание всегда начинается с автопроверки — письменная сдача остаётся
  // осознанным исключением, а не тем, что получается само собой.
  // «Комбинированное» сохраняем только у старых заданий, чтобы правка не меняла
  // ученику способ сдачи.
  const [autoCheck, setAutoCheck] = useState(editingHw ? editingHw.hw_type !== "written" : true)
  const [requireSolution, setRequireSolution] = useState(editingHw?.require_solution || false)
  const [answersInput, setAnswersInput] = useState(editingHw?.correct_answers?.join(" ") || "")
  // Ответы, собранные ВМЕСТЕ с заданиями (банк или ИИ), живут массивом, а не
  // строкой поля: «0; 4» и «нет корней» — обычные ответы, а поле делит строку по
  // пробелам и разорвало бы такой ответ на два. Тогда ответов становилось больше
  // вопросов, а стёртый пробелами ответ («нет корней» на последнем задании)
  // оставлял работу вовсе без ответов — и «Задать» упиралось в требование их
  // вписать, хотя вписывать было некуда. null — ответы берутся из поля.
  const [answersList, setAnswersList] = useState(
    editingHw?.correct_answers?.some((a) => /\s/.test(String(a)))
      ? editingHw.correct_answers.map((a) => String(a))
      : null
  )
  // Интерактивный тест с выбором ответа: варианты по вопросам + правильный на каждый.
  // null — обычный тест со свободным вводом ответа.
  const [testOptions, setTestOptions] = useState(editingHw?.test_options || null)
  const [mcqCorrect, setMcqCorrect] = useState(
    editingHw?.test_options ? editingHw?.correct_answers || [] : []
  )
  const fileRef = useRef()
  const { cls: closingCls, close } = useClosing(onClose)

  // Способ сборки. При правке задание уже собрано — показываем «свой файл»,
  // то есть обычные поля с текстом и ответами.
  const [method, setMethod] = useState("file")

  // --- Сборка из банка заданий (генераторы грузятся лениво: они тяжёлые) ---
  const [bank, setBank] = useState(null)
  const [bankLoading, setBankLoading] = useState(false)
  // Предметы, отмеченные репетитором в «Профиле»: банк открывается сразу на них.
  // Ничего не отмечено — все открытые предметы, как было раньше.
  const bankGroups = subjectGroups({ picked: bankSubjects, owner })
  // Предмет банка следует за учеником: он указан в его карточке, а уровень —
  // в его цели. Пока репетитор не выбрал предмет руками, смена ученика меняет и
  // предмет; после ручного выбора — уже нет, иначе выбор сбрасывался бы под рукой.
  const studentById = (id) => students.find((s) => String(s.id) === String(id)) || null
  const [bankType, setBankType] = useState(
    () => typeForStudent(studentById(editingHw?.student_id), bankGroups) || firstType(bankGroups)
  )
  const [bankTypeTouched, setBankTypeTouched] = useState(false)
  // Предметы репетитора для ИИ-генерации: там нужно НАЗВАНИЕ предмета, а не банк,
  // поэтому список плоский — «Математика», «Информатика».
  const genSubjects = BANK_SUBJECTS
    .filter((s) => (owner || s.open) && (!bankSubjects?.length || s.types.some((t) => bankSubjects.includes(t))))
    .map((s) => s.label)
  // Выбор репетитора: сколько заданий и по каким темам взять с КАЖДОГО номера —
  // { 6: { count: 3, themes: ["Десятичные дроби"] } }. Одного общего количества
  // мало: работа обычно собирается «два таких, три таких», а не «пять любых».
  const [bankPick, setBankPick] = useState({})
  const [bankOpen, setBankOpen] = useState(null)   // раскрытый номер (темы)
  const [bankTasks, setBankTasks] = useState([])
  const [showBankPreview, setShowBankPreview] = useState(false) // собранная работа окном
  const [bankSkipped, setBankSkipped] = useState([])
  const [bankBusy, setBankBusy] = useState(false)
  const [bankError, setBankError] = useState("")
  // Номера, у которых нет ни одного самодостаточного задания (всё с чертежами или
  // файлами). Проверяем пробой генераторов при выборе предмета — весь предмет
  // укладывается в доли секунды, зато номер видно НЕДОСТУПНЫМ сразу, а не после
  // нажатия «Собрать».
  // Номера с подписью раздела и темами — список, из которого выбирают.
  const [bankList, setBankList] = useState([])

  function loadBankList(mod, type) {
    setBankList(mod.bankNumbers(type))
  }

  // Модуль банка подгружаем по нажатию на карточку, а не эффектом: генераторы
  // весят мегабайты, и в основном бандле кабинета им делать нечего.
  function chooseMethod(id) {
    setMethod(id)
    if (id !== "bank" || bank || bankLoading) return
    setBankLoading(true)
    import("./homeworkBank")
      .then((m) => { setBank(m); loadBankList(m, bankType) })
      .catch(() => setBankError("Не удалось загрузить банк заданий"))
      .finally(() => setBankLoading(false))
  }

  // --- Генерация ДЗ по теме через DeepSeek (серверный прокси /api/generate-hw) ---
  const [genTopic, setGenTopic] = useState("")
  // Предмет для ИИ: если репетитор ведёт один — он и подставлен, выбирать нечего.
  const [genSubject, setGenSubject] = useState(() => (genSubjects.length === 1 ? genSubjects[0] : ""))
  const [genLevel, setGenLevel] = useState("средний")
  const [genCount, setGenCount] = useState(5)
  const [genAsTest, setGenAsTest] = useState(true) // тест с выбором ответа
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState("")
  const [preview, setPreview] = useState(null) // {title, description, tasks:[{question,answer,options}]}
  // Как проверяется собранное ИИ: "mcq" — выбор варианта, "free" — свободный
  // ответ, null — письменная работа. Выбирается один раз, при генерации.
  const [aiMode, setAiMode] = useState(null)

  // Тариф: генерация есть только на платных, у «Про» — месячный лимит.
  // Настоящая проверка на сервере (api/generate-hw.js), здесь — чтобы репетитор
  // видел остаток и не жал кнопку в пустоту.
  const { limit: planLimit, usage, reload: reloadPlan } = usePlan()
  const aiLimit = planLimit("aiHomework")
  const aiUsed = usage?.ai_homework || 0
  const aiBlocked = aiLimit === 0
  const aiLeft = aiLimit < 0 ? null : Math.max(0, aiLimit - aiUsed)

  // Сырой код ошибки («DeepSeek: 400») репетитору ничего не говорит — показываем
  // человеческий текст, а исходный оставляем в title для диагностики.
  function humanGenError(err) {
    if (/^DeepSeek: \d+/.test(err)) return "Сервис генерации не ответил. Попробуйте ещё раз."
    if (/Некорректный ответ модели/.test(err)) return "Не удалось разобрать ответ сервиса. Попробуйте ещё раз."
    return err
  }

  async function handleGenerate() {
    if (!genTopic.trim()) {
      setGenError("Напишите тему — по ней ИИ придумает задания")
      return
    }
    setGenError("")
    setGenerating(true)
    try {
      // Токен репетитора: по нему сервер понимает, чей это лимит (и функция
      // перестаёт быть анонимной).
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/generate-hw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          topic: genTopic,
          subject: genSubject,
          level: genLevel,
          count: genCount,
          format: genAsTest ? "test" : "open",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenError(data.error || "Ошибка генерации")
        return
      }
      reloadPlan()   // одна генерация списана — обновляем остаток
      const fresh = {
        title: data.title || genTopic,
        description: data.description || "",
        // Ответ свободной работы приводим к тому виду, в котором его вводит
        // ученик, ЗДЕСЬ — тогда репетитор в карточке видит ровно то, что уйдёт
        // на проверку. В тесте ответ обязан дословно совпадать с вариантом,
        // поэтому его не трогаем.
        tasks: (data.tasks || []).map((t) => ({
          question: t.question || "",
          answer: genAsTest ? t.answer || "" : plainAnswer(t.answer),
          options: Array.isArray(t.options) ? t.options.map((o) => String(o)) : [],
        })),
      }
      setPreview(fresh)
      applyGenerated(fresh)
    } catch (e) {
      setGenError("Сеть недоступна: " + String(e))
    } finally {
      setGenerating(false)
    }
  }

  // Собранное ИИ сразу становится содержанием работы: вопросы — в текст задания,
  // ответы — в автопроверку. Отдельной кнопки «применить» нет намеренно, иначе
  // карточки на экране и то, что уйдёт ученику, живут отдельно и расходятся
  // (так же устроена сборка из банка).
  function syncPreview(p, mode = aiMode) {
    const tasks = p.tasks.filter((t) => t.question.trim())
    const body = tasks.map((t, i) => `${i + 1}. ${t.question.trim()}`).join("\n")
    setDescription([p.description.trim(), body].filter(Boolean).join("\n\n"))
    if (mode === "mcq") {
      setTestOptions(tasks.map((t) => cleanOpts(t)))
      setMcqCorrect(tasks.map((t) => t.answer.trim()))
    } else if (mode === "free") {
      const answers = tasks.map((t) => t.answer.trim())
      setAnswersList(answers.length ? answers : null)
    }
  }

  // Способ проверки выбирается ОДИН раз — при генерации. Пересчитывать его на
  // каждую правку нельзя: стёр репетитор ответ, чтобы вписать свой, — и блок
  // проверки исчез бы у него из-под рук.
  function applyGenerated(p) {
    const tasks = p.tasks.filter((t) => t.question.trim())
    // Интерактивный тест: у КАЖДОГО вопроса ≥2 непустых варианта и выбран правильный
    // среди них. Тогда ученик выбирает ответ, репетитору ответы проставляются сами.
    const mcqOk =
      tasks.length > 0 &&
      tasks.every((t) => {
        const opts = cleanOpts(t)
        return opts.length >= 2 && opts.includes(t.answer.trim())
      })
    // Фолбэк: свободный ввод ответа. Не годятся для сверки только ответы
    // формулами (сырой LaTeX от модели) — такая работа остаётся письменной.
    const answers = tasks.map((t) => t.answer.trim())
    const mode = mcqOk ? "mcq" : answers.length > 0 && answers.every(isSimpleAnswer) ? "free" : null

    setAiMode(mode)
    setAutoCheck(mode !== null)
    if (mode !== "mcq") { setTestOptions(null); setMcqCorrect([]) }
    if (mode !== "free") { setAnswersInput(""); setAnswersList(null) }
    // Название репетитора важнее предложенного моделью — своё не затираем.
    if (isAutoTitle) setTitle(p.title.trim() || genTopic)
    syncPreview(p, mode)
  }

  // Правка карточки. Способ проверки при этом можно только ПОВЫСИТЬ: репетитор
  // переписал ответ формулой на тот, что ученик наберёт, — работа сама
  // становится тестом. Обратно (стёр ответ, чтобы вписать свой) не сбрасываем,
  // иначе блок проверки исчезал бы из-под рук на полуслове.
  function editPreview(fn) {
    const next = fn(preview)
    setPreview(next)
    let mode = aiMode
    if (mode === null) {
      const answers = next.tasks.filter((t) => t.question.trim()).map((t) => t.answer.trim())
      if (answers.length > 0 && answers.every(isSimpleAnswer)) {
        mode = "free"
        setAiMode(mode)
        setAutoCheck(true)
      }
    }
    syncPreview(next, mode)
  }

  function updatePreviewTask(idx, field, value) {
    editPreview((p) => ({
      ...p,
      tasks: p.tasks.map((t, i) => (i === idx ? { ...t, [field]: value } : t)),
    }))
  }

  function removePreviewTask(idx) {
    editPreview((p) => ({ ...p, tasks: p.tasks.filter((_, i) => i !== idx) }))
  }

  // Правка текста варианта; если правим тот, что был помечен правильным — двигаем и answer.
  function updatePreviewOption(taskIdx, optIdx, value) {
    editPreview((p) => ({
      ...p,
      tasks: p.tasks.map((t, i) => {
        if (i !== taskIdx) return t
        const wasCorrect = t.options[optIdx] === t.answer
        const options = t.options.map((o, j) => (j === optIdx ? value : o))
        return { ...t, options, answer: wasCorrect ? value : t.answer }
      }),
    }))
  }

  function setPreviewCorrect(taskIdx, optValue) {
    editPreview((p) => ({
      ...p,
      tasks: p.tasks.map((t, i) => (i === taskIdx ? { ...t, answer: optValue } : t)),
    }))
  }

  // Убрать собранное ИИ целиком — вместе с текстом задания и ответами.
  function dropPreview() {
    setPreview(null)
    setAiMode(null)
    setDescription("")
    setAnswersInput("")
    setAnswersList(null)
    setTestOptions(null)
    setMcqCorrect([])
    // Возврат к исходному состоянию формы, а оно — с автопроверкой.
    setAutoCheck(true)
  }

  // --- Задания, нарезанные из своего файла ---

  // Нарезка даёт условия картинками, а ответов в файле нет — их вписывает
  // репетитор. Всё остальное устроено как у банка: описание работы собирается
  // из текстов, ответы едут списком (в них бывают пробелы, и поле-строка
  // разорвало бы такой ответ надвое).
  function syncSplit(next) {
    setSplitTasks(next)
    setDescription(next.map((t, i) => `${i + 1}. ${oneLine(t.text) || `Задание ${i + 1}`}`).join("\n"))
    setTestOptions(null)
    setMcqCorrect([])
    setAnswersInput("")
    setAnswersList(next.length ? next.map((t) => t.answer) : null)
  }

  function applySplit(tasks) {
    resetBulk()
    syncSplit(tasks.map((t) => ({ image: t.image, text: t.text, answer: "" })))
  }

  const setSplitAnswer = (idx, value) =>
    syncSplit(splitTasks.map((t, i) => (i === idx ? { ...t, answer: value } : t)))

  const removeSplitTask = (idx) => {
    // Номера сдвинулись — строка ответов больше не соответствует списку, и
    // управлять чужими полями ей нельзя. Уже разложенные ответы остаются.
    resetBulk()
    syncSplit(splitTasks.filter((_, i) => i !== idx))
  }

  function resetBulk() {
    setBulkAnswers("")
    setBulkCount(0)
  }

  // Строка задаёт ответы ровно своему префиксу заданий: слов стало меньше —
  // хвост, который она занимала, очищается. Иначе стёртый ответ оставался бы
  // в работе, и репетитор отправил бы ученику не то, что видит в строке.
  function applyBulkAnswers(value) {
    const parts = value.trim() ? value.trim().split(/\s+/) : []
    const prev = bulkCount
    setBulkAnswers(value)
    setBulkCount(parts.length)
    if (!parts.length && !prev) return
    syncSplit(
      splitTasks.map((t, i) =>
        i < parts.length ? { ...t, answer: parts[i] } : i < prev ? { ...t, answer: "" } : t
      )
    )
  }

  // Убрать нарезку целиком: файл остаётся приложенным, работа снова становится
  // обычной — файл плюс ответы, как было до разбора.
  function dropSplit() {
    setSplitTasks([])
    setDescription("")
    setAnswersList(null)
    setAnswersInput("")
    resetBulk()
  }

  // Собранные задания сразу становятся содержанием работы: текст — в описание,
  // ответы — в автопроверку. Отдельной кнопки «применить» нет намеренно, иначе
  // список в панели и то, что уйдёт ученику, живут отдельно и расходятся.
  function applyBank(tasks) {
    setBankTasks(tasks)
    setDescription(tasks.map((t, i) => `${i + 1}. ${oneLine(bank.taskText(t))}`).join("\n"))
    const answers = tasks.map((t) => String(t.answer ?? "").trim())
    const testable = answers.length > 0 && answers.every(isSimpleAnswer)
    setTestOptions(null)
    setMcqCorrect([])
    if (testable) {
      setAutoCheck(true)
      setAnswersList(answers.length ? answers : null)
    } else {
      setAutoCheck(false)
      setAnswersList(null)
    }
    setAnswersInput("")
    if (tasks.length && isAutoTitle) {
      // Практический блок в названии — одним диапазоном «1–5», а не пятёркой
      // номеров подряд: так работа и называется у самих школьников.
      const hasModule = tasks.some((t) => t.module)
      const nums = [...new Set(tasks.map((t) => t.number))]
        .filter((n) => !(hasModule && n <= 5))
        .sort((a, b) => a - b)
        .map(String)
      setTitle(`${bank.subjectLabel(bankType)}: № ${(hasModule ? ["1–5", ...nums] : nums).join(", ")}`)
    }
  }

  // Смена предмета: своя (репетитор выбрал в списке) или подставленная учеником.
  // Собранное по прежнему предмету не переносим — номера у предметов разные.
  function chooseBankType(next, byTutor = true) {
    setBankType(next)
    if (byTutor) setBankTypeTouched(true)
    resetBankPick(); setBankTasks([]); setBankSkipped([]); setBankError("")
    if (bank) loadBankList(bank, next)
  }

  function chooseStudent(id) {
    setStudentId(id)
    if (bankTypeTouched) return
    const next = typeForStudent(studentById(id), bankGroups)
    if (next && next !== bankType) chooseBankType(next, false)
  }

  function handleAssemble() {
    if (!bank) return
    if (!bankPicks.length) return setBankError("Поставьте количество хотя бы одному номеру")
    setBankError("")
    setBankBusy(true)
    // Генераторы работают синхронно и не мгновенно — отдаём кадр, чтобы кнопка
    // успела показать «Собираем…», а не подвисла молча.
    setTimeout(() => {
      const { tasks, short } = bank.assembleHomework({ examType: bankType, picks: bankPicks })
      setBankSkipped(short)
      if (tasks.length) applyBank(tasks)
      else {
        setBankTasks([])
        setBankError("У выбранных номеров все задания с чертежом — выберите другие")
      }
      setBankBusy(false)
    }, 30)
  }

  // Задания практического блока взаимозависимы: без общего условия и чертежа
  // отдельный вопрос не решается, поэтому блок меняется и убирается целиком.
  function rerollBankTask(idx) {
    const t = bankTasks[idx]
    if (t.module) {
      const fresh = bank.pickModule(bankType, [t.scenario])
      if (!fresh?.length) return
      const before = bankTasks.slice(0, idx).filter((x) => x.moduleId !== t.moduleId)
      const after = bankTasks.slice(idx).filter((x) => x.moduleId !== t.moduleId)
      return applyBank([...before, ...fresh, ...after])
    }
    const fresh = bank.pickTask(bankType, t.number, bankPick[t.number]?.themes || null, new Set())
    if (fresh) applyBank(bankTasks.map((x, i) => (i === idx ? fresh : x)))
  }

  function removeBankTask(idx) {
    const t = bankTasks[idx]
    if (t.module) return applyBank(bankTasks.filter((x) => x.moduleId !== t.moduleId))
    applyBank(bankTasks.filter((_, i) => i !== idx))
  }

  // Количество заданий номера. 0 — номер просто не входит в работу, отдельной
  // «галочки номера» нет намеренно: счётчик и есть выбор.
  function setBankCount(n, next) {
    const limit = bank && n === bank.MODULE_NUMBER ? BANK_MAX_MODULES : BANK_MAX_PER_NUMBER
    const count = Math.max(0, Math.min(limit, next))
    setBankError("")
    setBankPick((prev) => {
      const cur = prev[n] || { count: 0, themes: [] }
      if (!count && !cur.themes.length) return dropKey(prev, n)
      return { ...prev, [n]: { ...cur, count } }
    })
  }

  // Тема номера: выбрана хотя бы одна — задания берутся только из них, ни одной
  // — из любой. Первая отметка сама ставит номеру одно задание, иначе тема
  // выбрана, а в работу ничего не пойдёт.
  function toggleBankTheme(n, theme) {
    setBankError("")
    setBankPick((prev) => {
      const cur = prev[n] || { count: 0, themes: [] }
      const themes = cur.themes.includes(theme)
        ? cur.themes.filter((x) => x !== theme)
        : [...cur.themes, theme]
      if (!themes.length && !cur.count) return dropKey(prev, n)
      return { ...prev, [n]: { count: Math.max(cur.count, themes.length ? 1 : 0), themes } }
    })
  }

  function toggleBankOpen(n) {
    setBankOpen((prev) => (prev === n ? null : n))
  }

  function resetBankPick() {
    setBankPick({})
    setBankOpen(null)
    setBankError("")
  }

  const bankPicks = Object.entries(bankPick)
    .map(([n, v]) => ({ number: Number(n), count: v.count, themes: v.themes.length ? v.themes : null }))
    .filter((p) => p.count > 0)
    .sort((a, b) => a.number - b.number)
  const bankTotal = bankPicks.reduce((s, p) => s + (bank ? bank.rowTaskCount(p.number, p.count) : p.count), 0)

  const isMcq = Array.isArray(testOptions) && testOptions.length > 0
  const hwType = !autoCheck ? "written" : editingHw?.hw_type === "combined" ? "combined" : "test"
  const freeAnswers = answersInput
    .trim()
    .split(/\s+/)
    .filter((a) => a.length > 0)
  const correctAnswers = isMcq ? mcqCorrect : answersList ?? freeAnswers
  const questionCount = correctAnswers.length
  // Сверять нечем: работа собрана ИИ или банком, а пригодных для автопроверки
  // ответов у неё нет. Включённый тумблер обещал бы то, чего не будет, и
  // упирался бы в «впишите ответы» без единого поля для них.
  const autoCheckLocked =
    !autoCheck && method !== "file" && !isMcq && !answersList && (!!preview || bankTasks.length > 0)

  async function handleSubmit() {
    // Ошибку показываем в самой форме, у кнопки: alert прерывает заполнение и
    // не подсказывает, какое поле пустое.
    if (!studentId) return setFormError("Выберите, кому задать")
    if (!title.trim()) return setFormError("Напишите, что задать")
    if (hwType !== "written" && questionCount === 0) {
      // Ответов нет и вписать их негде — у банка и ИИ они приходят вместе с
      // заданиями. Просим то, что репетитор действительно может сделать.
      return setFormError(method === "file"
        ? "Впишите ответы — по ним работа проверится автоматически"
        : "Соберите задания — ответы подставятся сами. Или выключите автопроверку")
    }
    // Пустой ответ засчитал бы ученику ошибку всегда — называем номер задания,
    // а не молчим о нём.
    if (hwType !== "written") {
      const blank = correctAnswers.findIndex((a) => !String(a).trim())
      if (blank >= 0) return setFormError(`Ответ на задание ${blank + 1} не заполнен`)
    }
    setFormError("")
    setSaving(true)

    let fileUrl = isEditing ? editingHw.file_url : null
    if (file) {
      const fileName = buildUploadPath(tutorId, file.name)
      const { error: uploadError } = await supabase.storage.from("homework").upload(fileName, file)
      if (uploadError) {
        console.error("Upload error:", uploadError)
        setFormError("Файл не загрузился: " + uploadError.message)
        setSaving(false)
        return
      } else {
        const { data } = supabase.storage.from("homework").getPublicUrl(fileName)
        fileUrl = data.publicUrl
      }
    }

    const payload = {
      tutor_id: tutorId,
      student_id: Number(studentId),
      title,
      description,
      deadline: deadline || null,
      file_url: fileUrl,
      hw_type: hwType,
      question_count: hwType === "written" ? null : questionCount,
      correct_answers: hwType === "written" ? null : correctAnswers,
      test_options: hwType !== "written" && isMcq ? testOptions : null,
      require_solution: hwType !== "written" ? requireSolution : false,
    }
    // Собранное из банка едет к ученику целиком: чертёж, программа, архив,
    // таблица. В description те же условия лежат текстом, поэтому список работ,
    // бот и старые записи ничего не замечают. Колонку добавляет
    // supabase/homework_bank_tasks.sql; при правке работы, собранной раньше,
    // поля в payload нет — и записанное тогда остаётся нетронутым.
    if (bankTasks.length) payload.bank_tasks = bankTasks.map(bank.packTask)

    // Нарезанные из файла задания: картинки уезжают в хранилище, в строку
    // работы идут ссылки на них и текст условия (он же лежит в description —
    // на нём держатся список работ, бот и все записи, выданные раньше).
    if (splitTasks.length) {
      try {
        // Только картинка: тот же текст уже лежит в description и показывается
        // строкой задания. Положи его ещё и сюда — ученик увидел бы условие
        // дважды, текстом и на картинке.
        payload.bank_tasks = await Promise.all(
          splitTasks.map(async (t, i) => ({ image_url: await uploadTaskImage(tutorId, t.image, i) }))
        )
      } catch (e) {
        setFormError("Картинки заданий не загрузились: " + (e.message || e))
        setSaving(false)
        return
      }
    }

    // Миграции homework_bank_tasks.sql может не быть на этой базе. Тогда работу
    // всё равно выдаём — но только если терять нечего: задания без чертежей и
    // файлов полностью описаны текстом в description. Если же терять есть что,
    // выдача останавливается с понятной просьбой, иначе ученик получил бы
    // «На рисунке изображён график» без самого рисунка.
    const richTasks = splitTasks.length || bankTasks.filter((t) => hasAttachment(t)).length
    const save = async (body) => {
      const res = isEditing
        ? await supabase.from("homework").update(body).eq("id", editingHw.id)
        : await supabase.from("homework").insert({ ...body, status: "assigned" })
      if (res.error && /bank_tasks/.test(res.error.message || "") && !richTasks) {
        const plain = { ...body }
        delete plain.bank_tasks
        return isEditing
          ? await supabase.from("homework").update(plain).eq("id", editingHw.id)
          : await supabase.from("homework").insert({ ...plain, status: "assigned" })
      }
      return res
    }

    let error
    if (isEditing) {
      const res = await save(payload)
      error = res.error
    } else {
      const res = await save(payload)
      error = res.error
      if (!res.error) {
        const targetStudent = students.find(s => String(s.id) === studentId)
        const accountId = targetStudent?.studentAccountId
        if (accountId) {
          await supabase.from("notifications").insert({
            user_id: accountId,
            title: "Новое домашнее задание",
            body: title,
          })
        }
      }
    }

    if (!error) {
      onCreated()
      close()
    } else if (/bank_tasks/.test(error.message || "")) {
      setFormError("Задания с чертежом и файлами пока негде хранить: выполните supabase/homework_bank_tasks.sql в SQL Editor.")
    } else {
      setFormError("Не получилось сохранить: " + error.message)
    }
    setSaving(false)
  }

  // Блок ответов нужен «своему файлу», а ещё — как запасной путь, когда
  // автопроверка включена, а ответов у работы нет: без него репетитор упирался
  // в «впишите ответы», не имея ни одного поля, куда их вписать.
  const answersBlock = (
    <div>
      {isMcq ? (
        <>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-gray-500">Правильные ответы — {questionCount} вопр.</span>
            <button
              type="button"
              onClick={() => { setTestOptions(null); setMcqCorrect([]) }}
              className="text-xs text-gray-500 hover:text-gray-700 active:scale-95 transition-all"
            >
              Ввести вручную
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {testOptions.map((opts, i) => (
              <div key={i} className="rounded-xl ring-1 ring-gray-200/70 dark:ring-white/10 p-2">
                <div className="text-xs text-gray-400 mb-1.5">Вопрос {i + 1}</div>
                <div className="flex flex-wrap items-start gap-1.5">
                  {opts.map((o, j) => {
                    const sel = mcqCorrect[i] === o
                    return (
                      <button
                        key={j}
                        type="button"
                        onClick={() => setMcqCorrect((prev) => prev.map((c, k) => (k === i ? o : c)))}
                        className={`rounded-lg px-3 py-1.5 text-sm border text-left transition-all active:scale-[0.96] ${
                          sel ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-700 hover:bg-blue-500/10"
                        }`}
                      >
                        {o}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : answersList ? (
        // Ответы пришли вместе с заданиями. Правим их по одному: ответ бывает
        // с пробелом («0; 4»), и общее поле склеило бы его с соседним.
        <>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-gray-500">Ответы — {answersList.length} зад.</span>
            <button
              type="button"
              onClick={() => { setAnswersInput(""); setAnswersList(null) }}
              className="text-xs text-gray-500 hover:text-gray-700 active:scale-95 transition-all"
            >
              Ввести вручную
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {answersList.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-right">{i + 1}.</span>
                <input
                  value={a}
                  onChange={(e) =>
                    setAnswersList((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  placeholder="Ответ"
                  className="input-glass flex-1 min-w-0 px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="text-sm text-gray-500 mb-1.5">Ответы по порядку, через пробел</div>
          <textarea
            value={answersInput}
            onChange={(e) => setAnswersInput(e.target.value)}
            placeholder="1 3 2 4 1 5 2 3 4 1"
            rows={2}
            className="input-glass resize-none"
          />
          {questionCount > 0 && (
            <div className="grid grid-cols-7 gap-1 mt-2">
              {correctAnswers.map((a, i) => (
                <div key={i} className="text-center rounded-lg py-1 text-xs bg-blue-100 text-blue-700 font-medium">
                  <div style={{ fontSize: "10px" }}>{i + 1}</div>
                  <div className="truncate px-0.5">{a}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )

  return createPortal(
    <div className={`fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 ${closingCls}`}>
      <div className={`glass-modal p-6 sm:p-7 w-full max-w-4xl max-h-[92dvh] overflow-y-auto ${closingCls}`}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-medium">{isEditing ? "Редактировать задание" : "Новое задание"}</h2>
          <button onClick={close} aria-label="Закрыть" className="text-gray-500 hover:text-gray-700 active:scale-90 transition-transform"><Icon name="x" size={18} /></button>
        </div>

        {/* Две колонки: слева — кому и когда (это одинаково для любого способа),
            справа — из чего задание собирается. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] gap-x-6 gap-y-5 items-stretch">

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm text-gray-500 mb-1.5 block">Кому задать</label>
              <select value={studentId} onChange={(e) => chooseStudent(e.target.value)}
                aria-label="Ученик" className="input-glass">
                <option value="">Выберите ученика</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1.5 block">Название задания</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: параграф 5, № 1–10"
                className="input-glass" />
            </div>

            <div>
              <div className="text-sm text-gray-500 mb-2">Срок сдачи</div>
              <div className="flex flex-wrap gap-1.5">
                {DEADLINE_CHIPS.map((c) => {
                  const value = c.days == null ? "" : isoDay(c.days)
                  return (
                    <button key={c.label} type="button" onClick={() => { setDeadline(value); setPickDate(false) }}
                      className={chipCls(!pickDate && deadline === value)}>
                      {c.label}
                    </button>
                  )
                })}
                <button type="button" onClick={() => setPickDate(true)} className={chipCls(pickDate)}>
                  Другая дата
                </button>
              </div>
              <Collapse open={pickDate}>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  className="input-glass mt-2" />
              </Collapse>
            </div>

            {/* Как ученик сдаёт. Тип задания берётся отсюда: есть ответы — тест.
                Карточка ровно по содержимому: ни flex-1 (растягивал рамку до низа
                колонки, и внутри зияла пустая коробка), ни mt-auto (отрывал её от
                чипов срока). Незанятое место под колонкой — просто фон, его не
                видно, в отличие от пустоты внутри рамки. */}
            <div className="rounded-2xl ring-1 ring-gray-500/15 p-3">
              {/* Автопроверку нельзя включить там, где сверять нечем: у работы,
                  собранной ИИ или банком, ответы приходят вместе с заданиями, и
                  если они не годятся для сверки (формула, развёрнутое решение),
                  включённый тумблер вёл в тупик — «впишите ответы» без единого
                  поля, куда их вписать. Поправьте ответ в карточке задания, и
                  автопроверка включится сама. */}
              <Toggle
                on={autoCheck}
                disabled={autoCheckLocked}
                onClick={() => setAutoCheck((v) => !v)}
                title="Автопроверка"
                note={autoCheckLocked
                  ? "Ответы этих заданий для сверки не годятся — работу проверите вы. Впишите ответ так, как его наберёт ученик, и проверка включится"
                  : autoCheck
                  ? "Ученик впишет ответы в кабинете, оценка выставится сразу"
                  : "Ученик прикрепит фото или файл с работой, оценку поставите вы"}
              />

              <Collapse open={autoCheck}>
                <div className="pt-3 flex flex-col gap-3">
                  <Toggle
                    on={requireSolution}
                    onClick={() => setRequireSolution(!requireSolution)}
                    title="Дополнительно — фото решения"
                    note="Без фотографии ученик работу не сдаст"
                  />
                </div>
              </Collapse>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Способ сборки выбирается только у НОВОГО задания. Правится
                уже собранная работа: её текст, ответы и файл лежат в полях
                «своего файла», а пересборка банком или ИИ переписала бы
                ученику задание целиком — не «редактирование», а другая
                работа под тем же номером. */}
            {!isEditing && (
              <MethodCards
                label="Из чего собрать задание"
                items={HW_METHODS}
                value={method}
                onChange={chooseMethod}
              />
            )}

            {/* Панель способа: высота едет плавно, иначе окно скачет при
                переключении карточек — куски разной длины. */}
            <AutoHeight>
              <div key={method} className="tab-swap flex flex-col gap-4">
                {/* --- Способ 1: свой файл --- */}
                {method === "file" && (
                  <>
                    <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                    <button
                      type="button"
                      onClick={() => fileRef.current.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]) }}
                      className="w-full rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/15 py-6 px-4 flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                    >
                      <Icon name="upload" size={18} />
                      <span className="text-sm truncate max-w-full">
                        {file ? file.name : isEditing && editingHw.file_url ? "Заменить файл" : "Перетащите файл или нажмите"}
                      </span>
                      <span className="text-[11px] text-gray-400">PDF, Word (.docx) или фотография</span>
                    </button>
                    {file && (
                      <button type="button" onClick={() => { setFile(null); if (splitTasks.length) dropSplit() }}
                        className="self-start text-xs btn-quiet hover:text-red-500 active:scale-95">
                        Убрать файл
                      </button>
                    )}

                    {/* Файл целиком — это возврат к бумаге: ученик не может
                        ответить по заданию, а кабинет не может ничего проверить.
                        Поэтому у PDF и фотографии сразу предлагаем разобрать их
                        на задания; отказаться можно, просто не нажав. */}
                    {canSplit(file) && !splitTasks.length && (
                      <button type="button" onClick={() => setSplitOpen(true)}
                        className="press-fill w-full flex items-center gap-3 rounded-2xl ring-1 ring-blue-500/25 px-4 py-3 text-left">
                        <span className="shrink-0 w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                          <Icon name="scissors" size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm text-gray-700">Разбить файл на задания</span>
                          <span className="block text-[11px] text-gray-400 leading-snug">
                            Ученик решит их в кабинете по одному: своё поле ответа и фото решения к каждому
                          </span>
                        </span>
                      </button>
                    )}

                    {splitTasks.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-gray-500">
                            Заданий из файла — {splitTasks.length}
                          </span>
                          <button type="button" onClick={() => setSplitOpen(true)}
                            className="no-press text-xs text-blue-600 hover:text-blue-700 active:scale-95 transition-transform">
                            Разобрать заново
                          </button>
                        </div>

                        {/* Ключ к работе почти всегда есть строкой, а полей
                            бывает под сотню: вписывать их по одному — работа
                            на полчаса. Поля заданий при этом остаются: ответ
                            с пробелом внутри строкой не задать. */}
                        <div className="flex flex-col gap-1">
                          <input
                            value={bulkAnswers}
                            onChange={(e) => applyBulkAnswers(e.target.value)}
                            placeholder="Все ответы через пробел: 12 3,5 25"
                            className="input-glass py-2 text-sm"
                          />
                          <div className="text-[11px] text-gray-400 leading-snug">
                            {bulkCount
                              ? `Разложено по заданиям — ${Math.min(bulkCount, splitTasks.length)} из ${splitTasks.length}` +
                                (bulkCount > splitTasks.length
                                  ? `, лишние ${bulkCount - splitTasks.length} не использованы`
                                  : "")
                              : "Ответы разложатся по заданиям по порядку. Ответ с пробелом внутри впишите в поле задания."}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          {splitTasks.map((t, i) => (
                            <div key={i} className="flex items-start gap-3 rounded-2xl ring-1 ring-gray-200/70 dark:ring-white/10 p-2.5">
                              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 text-xs font-semibold flex items-center justify-center">
                                {i + 1}
                              </span>
                              <img src={t.image} alt={`Задание ${i + 1}`}
                                className="w-28 sm:w-40 rounded-lg ring-1 ring-gray-200/70 dark:ring-white/10 bg-white" />
                              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                                <input
                                  value={t.answer}
                                  onChange={(e) => setSplitAnswer(i, e.target.value)}
                                  placeholder="Ответ"
                                  className="input-glass py-1.5 text-sm"
                                />
                                {!!t.text && (
                                  <div className="text-[11px] text-gray-400 leading-snug line-clamp-2">{t.text}</div>
                                )}
                              </div>
                              <button type="button" onClick={() => removeSplitTask(i)} title="Убрать задание"
                                className="no-press shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-blue-500/[0.08] transition active:scale-90">
                                <Icon name="x" size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="text-[11px] text-gray-400 leading-snug">
                          Ответы нужны для автоматической проверки. Если проверяете сами — выключите автопроверку ниже, задания всё равно останутся отдельными.
                        </div>
                        <button type="button" onClick={dropSplit}
                          className="self-start text-xs text-gray-400 hover:text-red-500 active:scale-95 transition-all">
                          Убрать задания
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* --- Способ 2: из банка заданий --- */}
                {method === "bank" && (
                  <div className="flex flex-col gap-3">
                    {bankLoading && <div className="text-xs text-gray-400">Загружаем банк заданий…</div>}

                    {bank && (
                      <>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Предмет</label>
                          <select
                            value={bankType}
                            onChange={(e) => chooseBankType(e.target.value)}
                            className="input-glass"
                          >
                            {bankGroups.map((g) => (
                              <optgroup key={g.key} label={g.key}>
                                {g.subjects.map((s) => <option key={s.type} value={s.type}>{g.key} · {s.label}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex items-baseline justify-between mb-1.5">
                            <span className="text-xs text-gray-500">
                              Номера и темы{bankTotal > 0 ? ` — ${bankTotal} ${plural(bankTotal, "задание", "задания", "заданий")}` : ""}
                            </span>
                            {bankTotal > 0 && (
                              <button type="button" onClick={resetBankPick}
                                className="no-press text-[11px] text-gray-500 hover:text-gray-700 active:scale-95 transition-all">
                                сбросить
                              </button>
                            )}
                          </div>
                          {bankList.length === 0 ? (
                            <div className="text-xs text-gray-400">Для этого предмета генераторов пока нет</div>
                          ) : (
                            <div className="rounded-2xl ring-1 ring-gray-500/12 divide-y divide-gray-500/10 overflow-hidden">
                              {bankList.map((info) => (
                                <BankNumberRow
                                  key={info.number}
                                  info={info}
                                  pick={bankPick[info.number]}
                                  open={bankOpen === info.number}
                                  onCount={(next) => setBankCount(info.number, next)}
                                  onTheme={(theme) => toggleBankTheme(info.number, theme)}
                                  onOpen={() => toggleBankOpen(info.number)}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {bankError && <div className="text-xs text-red-500">{bankError}</div>}

                        <button
                          type="button"
                          onClick={handleAssemble}
                          disabled={bankBusy || !bankTotal}
                          className="bg-blue-600 text-white rounded-xl py-2 text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99] transition-transform flex items-center justify-center gap-1.5"
                        >
                          {bankBusy
                            ? <><span className="loader-dots"><i /><i /><i /></span>Собираем задания</>
                            : <>
                                <Icon name="grid" size={14} />
                                {bankTasks.length ? "Собрать заново" : "Собрать задания"}
                                {bankTotal > 0 && <span className="opacity-70">· {bankTotal}</span>}
                              </>}
                        </button>

                        {bankSkipped.length > 0 && (
                          <div className="text-[11px] text-amber-600 leading-snug">
                            Заданий хватило не на всё: {bankSkipped.map((s) => `№${s.label || s.number} — ${s.got} из ${s.want}`).join(", ")}.
                            У этой темы кончились непохожие условия — возьмите меньше или добавьте тему.
                          </div>
                        )}

                        {bankTasks.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {/* Список рядом с настройками тесный: длинные условия
                                с системой и дробью в нём переносятся посреди
                                формулы. Целиком работа смотрится окном — тем же,
                                каким репетитор открывает её из разбора. */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">
                                Собрано {bankTasks.length} {plural(bankTasks.length, "задание", "задания", "заданий")}
                              </span>
                              <button type="button" onClick={() => setShowBankPreview(true)}
                                className="no-press inline-flex items-center gap-1 text-[11px] text-blue-600 hover:opacity-70 active:scale-95 transition-all">
                                <Icon name="maximize" size={11} />Посмотреть целиком
                              </button>
                            </div>
                            {bankTasks.map((t, i) => (
                              <div key={t.id || i} className="rounded-xl ring-1 ring-gray-200/70 dark:ring-white/10 px-2.5 py-2 flex items-start gap-2.5">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/12 text-blue-600 dark:text-blue-400 text-[10px] font-semibold flex items-center justify-center">
                                  {i + 1}
                                </span>
                                <div className="min-w-0 flex-1 flex flex-col gap-1">
                                  <div className="text-xs text-gray-700 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: renderHomeworkMath(bank.taskText(t)) }} />
                                  {/* Чертёж и файлы — те же, что увидит ученик: репетитор собирает
                                      работу вслепую, если чертежа в предпросмотре нет. */}
                                  <TaskAttachments task={t} compact imageAlt={`Задание №${t.number}`} />
                                  <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                                    <span>№{t.number}{t.module ? " · блок 1–5" : ""} · ответ:</span>
                                    <span dangerouslySetInnerHTML={{ __html: renderHomeworkMath(String(t.answer ?? "—")) }} />
                                  </div>
                                </div>
                                <button type="button" onClick={() => rerollBankTask(i)} title="Другое задание этого номера"
                                  className="text-gray-400 hover:text-blue-600 active:scale-90 transition-transform">
                                  <Icon name="repeat" size={13} />
                                </button>
                                <button type="button" onClick={() => removeBankTask(i)} title="Убрать задание"
                                  className="text-gray-400 hover:text-red-500 active:scale-90 transition-transform">
                                  <Icon name="x" size={13} />
                                </button>
                              </div>
                            ))}
                            <div className="text-[11px] text-gray-400 leading-snug">
                              {autoCheck
                                ? "Ответы подставлены — работа проверится автоматически."
                                : "Ответы этих заданий не годятся для автопроверки, работу проверите вручную."}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* --- Способ 3: составить ИИ --- */}
                {method === "ai" && (
                  <div className="flex flex-col gap-2.5">
                    {aiBlocked ? (
                      <PlanHint feature="aiHomework">
                        ИИ составит задания по теме и оформит их с автоматической проверкой ответов.
                      </PlanHint>
                    ) : (
                      <>
                        <input
                          value={genTopic}
                          onChange={(e) => setGenTopic(e.target.value)}
                          placeholder="Тема. Например: квадратные уравнения"
                          className="input-glass"
                        />
                        {/* Предмет — выбором из тех, что отмечены в «Профиле»:
                            вводить его руками при каждой генерации незачем. */}
                        <label className="block">
                          <span className="block text-xs text-gray-500 mb-1">Предмет</span>
                          <select
                            value={genSubject}
                            onChange={(e) => setGenSubject(e.target.value)}
                            className="input-glass w-full px-3 py-2"
                          >
                            <option value="">Не указывать</option>
                            {genSubjects.map((name) => <option key={name} value={name}>{name}</option>)}
                          </select>
                        </label>
                        <div className="flex gap-2">
                          <label className="flex-1 min-w-0">
                            <span className="block text-xs text-gray-500 mb-1">Сложность</span>
                            <select value={genLevel} onChange={(e) => setGenLevel(e.target.value)} className="input-glass w-full px-3 py-2">
                              <option value="лёгкий">Лёгкий</option>
                              <option value="средний">Средний</option>
                              <option value="сложный">Сложный</option>
                            </select>
                          </label>
                          <label className="flex-1 min-w-0">
                            <span className="block text-xs text-gray-500 mb-1">Количество заданий</span>
                            <select value={genCount} onChange={(e) => setGenCount(Number(e.target.value))} className="input-glass w-full px-3 py-2">
                              {[3, 5, 8, 10, 15].map((n) => <option key={n} value={n}>{n} зад.</option>)}
                            </select>
                          </label>
                        </div>

                        <Toggle
                          on={genAsTest}
                          onClick={() => setGenAsTest((v) => !v)}
                          title="Тест с выбором ответа"
                          note="Ученик выбирает один из вариантов, проверка автоматическая"
                        />

                        {genError && <div className="text-xs text-red-500" title={genError}>{humanGenError(genError)}</div>}

                        <button
                          type="button"
                          onClick={handleGenerate}
                          disabled={generating || aiLeft === 0}
                          className="bg-blue-600 text-white rounded-xl py-2 text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99] transition-transform flex items-center justify-center gap-1.5"
                        >
                          {generating
                            ? <><span className="loader-dots"><i /><i /><i /></span>Составляем задания, это займёт до минуты</>
                            : aiLeft === 0
                            ? <>Лимит на этот месяц исчерпан</>
                            : <><Icon name="sparkles" size={14} />Составить задания</>}
                        </button>

                        {aiLeft !== null && (
                          <div className="text-[11px] text-gray-400 text-center tabular-nums">
                            Осталось генераций в этом месяце: {aiLeft}
                          </div>
                        )}

                        {preview && (
                          <div className="rounded-xl border border-blue-200 bg-white dark:bg-white/5 p-3 flex flex-col gap-2.5">
                            {preview.description.trim() && (
                              <div className="text-xs text-gray-600 leading-relaxed">{preview.description.trim()}</div>
                            )}
                            {preview.tasks.map((t, i) => (
                              <div key={i} className="rounded-lg ring-1 ring-gray-200/70 dark:ring-white/10 p-2 flex flex-col gap-1.5">
                                <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-400 pt-2 w-4 flex-shrink-0">{i + 1}.</span>
                                  <MathField
                                    value={t.question}
                                    onChange={(v) => updatePreviewTask(i, "question", v)}
                                    multiline
                                    rows={2}
                                    placeholder="Текст задания"
                                    className="input-glass flex-1 min-w-0 px-2 py-1.5 resize-none min-h-[4rem]"
                                    viewClassName="input-glass flex-1 min-w-0 px-2 py-1.5 min-h-[4rem] leading-relaxed"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removePreviewTask(i)}
                                    className="text-gray-400 hover:text-red-500 pt-1.5 active:scale-90 transition-transform"
                                    title="Удалить задание"
                                  >
                                    <Icon name="x" size={14} />
                                  </button>
                                </div>
                                {t.options && t.options.length > 0 ? (
                                  <div className="pl-6 flex flex-col gap-1">
                                    <span className="text-xs text-gray-400">Варианты ответа — отметьте правильный</span>
                                    <div className="flex flex-col gap-1.5">
                                      {t.options.map((o, j) => {
                                        const correct = o === t.answer
                                        return (
                                          <div
                                            key={j}
                                            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors ${
                                              correct ? "border-green-500 bg-green-50" : "border-gray-200"
                                            }`}
                                          >
                                            <button
                                              type="button"
                                              onClick={() => setPreviewCorrect(i, o)}
                                              title="Правильный ответ"
                                              className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center active:scale-90 transition-transform ${
                                                correct ? "border-green-500 bg-green-500 text-white" : "border-gray-300"
                                              }`}
                                            >
                                              {correct && <Icon name="check" size={10} />}
                                            </button>
                                            <MathField
                                              value={o}
                                              onChange={(v) => updatePreviewOption(i, j, v)}
                                              placeholder="Вариант ответа"
                                              className="flex-1 min-w-0 bg-transparent text-sm outline-none min-h-[2rem]"
                                              viewClassName="flex-1 min-w-0 text-sm min-h-[2rem] flex items-center rounded-md px-1 -mx-1"
                                            />
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 pl-6">
                                    <span className="text-xs text-gray-400 flex-shrink-0">Ответ:</span>
                                    <MathField
                                      value={t.answer}
                                      onChange={(v) => updatePreviewTask(i, "answer", v)}
                                      placeholder="Ответ"
                                      className="input-glass flex-1 min-w-0 px-2 py-1 min-h-[3.2rem]"
                                      viewClassName="input-glass flex-1 min-w-0 px-2 py-1 min-h-[3.2rem] flex items-center"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                            <div className="text-[11px] text-gray-400 leading-snug">
                              Проверьте задания и ответы: ИИ может ошибаться. Правки сохраняются сразу — задание уйдёт ученику в этом виде.
                              {aiMode === null && " Ответы для автоматической проверки не годятся, работу проверите вручную."}
                            </div>
                            <button
                              type="button"
                              onClick={dropPreview}
                              className="self-start text-xs text-gray-400 hover:text-red-500 active:scale-95 transition-all"
                            >
                              Убрать задания
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Отдельного поля с текстом заданий нет: содержание работы задаёт
                    выбранный способ — файл, банк или ИИ. У старого задания текст уже
                    есть, поэтому показываем его так, как его видит ученик (править
                    буквами нечего: в тексте живут токены дробей и корней). */}
                {/* Работа, нарезанная из файла, показана списком заданий выше —
                    второй раз тем же текстом её не показываем. */}
                {method === "file" && !splitTasks.length && !!description.trim() && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1.5">Что увидит ученик</div>
                    <div className="rounded-xl ring-1 ring-gray-500/15 p-3 text-xs text-gray-700 leading-relaxed max-h-44 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: renderHomeworkMath(description) }} />
                    <button
                      type="button"
                      onClick={() => setDescription("")}
                      className="mt-1.5 text-xs text-gray-400 hover:text-red-500 active:scale-95 transition-all"
                    >
                      Убрать текст
                    </button>
                  </div>
                )}

                {/* У банка и ИИ ответы стоят рядом с самими заданиями — второй
                    раз их не показываем. Включить автопроверку без ответов там
                    нельзя (тумблер заблокирован), так что задание без ответов не
                    упрётся в требование их вписать. */}
                {/* У нарезанных заданий ответ стоит рядом с самим заданием —
                    общего поля со списком ответов там быть не должно: два места
                    для одних и тех же ответов расходятся при первой же правке. */}
                {autoCheck && method === "file" && !splitTasks.length && answersBlock}
              </div>
            </AutoHeight>
          </div>
        </div>

        {splitOpen && file && (
          <SplitTasksModal file={file} onDone={applySplit} onClose={() => setSplitOpen(false)} />
        )}

        {/* Ошибка стоит в одном ряду с кнопками, слева от «Задать»: строка по
            центру пустого ряда терялась и не связывалась с нажатием. На узком
            экране плашка ложится над кнопками — там же, куда смотрит палец. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-5">
          <Reveal value={formError} className="min-w-0">
            {(msg) => (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 ring-1 ring-red-500/20 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                <Icon name="alert-triangle" size={14} className="mt-px flex-shrink-0" />
                <span className="leading-snug">{msg}</span>
              </div>
            )}
          </Reveal>
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:ml-auto">
            <button onClick={close} className="press-fill border border-gray-200 rounded-xl px-5 py-2.5 text-sm text-gray-600">
              Отмена
            </button>
            <button onClick={handleSubmit} disabled={saving} className="bg-blue-600 text-white rounded-xl px-6 py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-transform">
              {saving ? "Сохраняем..." : isEditing ? "Сохранить" : "Задать"}
            </button>
          </div>
        </div>
      </div>
      {showBankPreview && bank && (
        <TasksModal
          title={title.trim() || "Собранная работа"}
          note="условия и ответы"
          items={bankTasks.map((t, i) => ({
            n: i + 1,
            text: bank.taskText(t),
            bankTask: t,
            answer: t.answer ?? null,
            options: null,
          }))}
          onClose={() => setShowBankPreview(false)}
        />
      )}
    </div>,
    document.body
  )
}

// Карточка задания в списке. Якорь — плитка срока слева, как у школьных
// сервисов (Satchel, Google Classroom): дата читается раньше названия, цвет
// плитки — срочность. Статус написан один раз, а кнопки правки и удаления
// живут в развороте, а не на каждой карточке — раньше статус повторялся
// дважды («На проверке» чипом и «Ждёт проверки» плашкой), и карточка шумела.
function HomeworkCard({ hw, selected, onOpen }) {
  const typeInfo = TYPE_LABELS[hw.hw_type] || TYPE_LABELS.written
  const taskCount = parseHomeworkTasks(hw.description).tasks.length
  const overdue = isOverdue(hw)
  const done = hw.status === "done"

  // У проверенной работы статус и есть оценка — отдельного «Выполнено» рядом
  // с ней не нужно.
  const chip = done && hw.grade
    ? { label: `Оценка ${hw.grade}`, cls: GRADE_COLORS[hw.grade] }
    : STATUS_LABELS[hw.status] || STATUS_LABELS.assigned

  // Плитка кодирует этап жизни работы: срок → часы «на проверке» → галка.
  const tileBox = "w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center bg-gradient-to-br"
  const tile = done
    ? <div className={`${tileBox} ${TILE_TINTS.green}`}><Icon name="check" size={18} /></div>
    : hw.status === "submitted"
    ? <div className={`${tileBox} ${TILE_TINTS.indigo}`}><Icon name="clock" size={18} /></div>
    : hw.deadline
    ? <DateTile date={hw.deadline} tint={TILE_TINTS[dueTintKey(hw.deadline)]} className="w-12 h-12" />
    : <div className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-gray-400 ring-1 ring-gray-200/70 dark:ring-white/10"><Icon name="calendar" size={17} /></div>

  return (
    // Повторное нажатие сворачивает разбор: карточки стоят рядом, и закрывать
    // панель под ними больше нечем.
    <button
      onClick={onOpen}
      className={`glass-sm press-tap text-left w-full p-3.5 flex items-center gap-3 transition-all ${selected ? "!border-blue-400/70 ring-2 ring-blue-400/35" : "hover:!border-blue-300/60"}`}
    >
      {tile}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate flex-1">{hw.title}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${chip.cls}`}>{chip.label}</span>
        </div>
        <div className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
          <span>{typeInfo.label}</span>
          {taskCount > 0 && <><span className="opacity-50">·</span><span>{taskCount} {plural(taskCount, "задание", "задания", "заданий")}</span></>}
          {hw.file_url && <><span className="opacity-50">·</span><span className="inline-flex items-center gap-1"><Icon name="paperclip" size={11} />файл</span></>}
          {hw.test_score != null && <><span className="opacity-50">·</span><span className="text-blue-600 dark:text-blue-400 font-medium">{hw.test_score} из {hw.question_count}</span></>}
          {overdue && <><span className="opacity-50">·</span><span className="text-red-500 font-medium">просрочено</span></>}
        </div>
      </div>
    </button>
  )
}

// Блок внутри разбора: одинаковая подложка у файла, результата и комментария.
//
// Геометрия ровно как у карточки слева (.glass-sm): скругление 14px, отступ
// 14px и НАСТОЯЩАЯ рамка вместо кольца. Иначе соседние блоки первого ряда
// («5 заданий» и «Срок сдачи») при одинаковом содержимом расходились по высоте
// на 6px: отступ был меньше на 2px с каждой стороны, а ring — это тень, она
// места не занимает, тогда как border у карточки слева добавляет ещё 2px.
function DetailBlock({ children, className = "" }) {
  return (
    <div className={`rounded-[14px] border border-gray-200/70 dark:border-white/10 bg-white/45 dark:bg-white/[0.03] p-3.5 ${className}`}>
      {children}
    </div>
  )
}

// Разбор выбранного задания — целой строкой под рядом карточек, как разбор
// варианта: слева условия, справа работа ученика и проверка.
export function HomeworkDetail({ hw, studentPhone, studentAccountId, onUpdate, onEdit, onDelete, onClose, cls }) {
  const [grading, setGrading] = useState(false)
  const [revising, setRevising] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const [comment, setComment] = useState(hw.comment || "")
  const [selectedGrade, setSelectedGrade] = useState(hw.grade || null)
  // Зачтённые вручную номера держим и в своём состоянии: список работ
  // перезагружается запросом, а разбор с зачётом должен откликаться сразу.
  // Сброс — правкой состояния на рендере (не эффектом): пришла новая строка
  // работы — берём её список, он и есть истина.
  const hwCredited = Array.isArray(hw.credited) ? hw.credited.map(Number) : []
  const [credited, setCredited] = useState(hwCredited)
  const [creditedSrc, setCreditedSrc] = useState(hw.credited)
  if (creditedSrc !== hw.credited) { setCreditedSrc(hw.credited); setCredited(hwCredited) }
  const status = STATUS_LABELS[hw.status] || STATUS_LABELS.assigned
  const typeInfo = TYPE_LABELS[hw.hw_type] || TYPE_LABELS.written
  const isPureTest = hw.hw_type === "test"
  const overdue = isOverdue(hw)
  // Итог проверки: оценка стоит только у завершённой работы, комментарий
  // репетитора виден и на доработке, но не пока работа ждёт проверки — там
  // поле комментария открыто в форме и текст показывался бы дважды.
  const graded = Boolean(hw.grade) && hw.status === "done"
  const verdictComment = hw.status !== "submitted" ? hw.comment : ""
  // Работу, которую ученик уже решал, править нельзя: правка условия разошлась бы
  // с уже данными ответами и сданным файлом. Смотрим не только на статус: у
  // комбинированной работы ответы теста сохраняются ещё до сдачи файла, статус
  // при этом остаётся «Выдано». Возврат на доработку эти следы стирает
  // (см. setStatus ниже) — там правка снова открывается.
  const solutionShots = hw.solution_files && typeof hw.solution_files === "object"
    ? Object.entries(hw.solution_files).filter(([, url]) => typeof url === "string" && url)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
    : []
  const attempted = hw.status === "submitted" || hw.status === "done"
    || (Array.isArray(hw.student_answers) && hw.student_answers.length > 0)
    || !!hw.submission_url || solutionShots.length > 0

  // Балл считаем на месте: сразу после зачёта он должен смениться, не дожидаясь
  // перезагрузки списка. Правила те же, что у кабинета ученика при сдаче.
  const testScore = hw.test_score == null ? null : homeworkTestScore({ ...hw, credited })
  const testPercent = testScore != null && hw.question_count
    ? Math.round((testScore / hw.question_count) * 100)
    : null
  const suggestedGrade = testPercent != null ? getGradeFromPercent(testPercent) : null

  // Задания для окна и строка-подсказка: токены дробей и корней в одну строку
  // не рисуются, поэтому в подсказке они разворачиваются текстом.
  const { intro: tasksIntro, items: taskItems } = homeworkTaskItems({ ...hw, credited })
  const taskCount = taskItems.length
  // Зачёт доступен, только когда колонка есть в строке: на базе без миграции
  // manual_credit.sql запись упала бы, а кнопка обещала бы несуществующее.
  const canCredit = hw.credited !== undefined && Array.isArray(hw.correct_answers) && Array.isArray(hw.student_answers)
  // Разбор по номерам: репетитору важно не «сколько», а «где» — иначе к ошибке
  // не вернуться на занятии. Считаем по тем же правилам, что и оценку теста
  // (answersEqual, а не сравнение строк), поэтому чипы не разойдутся со счётом.
  // Номер берём из описания работы (taskItems), а не из индекса: у работы из
  // банка нумерация описания и есть та, что видит ученик.
  const answerRows = Array.isArray(hw.student_answers) && Array.isArray(hw.correct_answers)
    ? hw.correct_answers.map((correct, i) => {
        const raw = hw.student_answers[i]
        const gave = raw == null || String(raw).trim() === "" ? null : String(raw)
        const n = taskItems[i]?.n ?? i + 1
        const byHand = credited.includes(Number(n))
        return {
          n,
          // Задание без эталона (развёрнутый ответ) не верное и не неверное:
          // его смотрит репетитор, чип у него нейтральный. Зачтённое вручную —
          // верное: эталон банка ошибся, а не ученик.
          ok: byHand ? true : correct == null || correct === "" ? null : answersEqual(gave ?? "", correct),
          credited: byHand,
        }
      })
    : []
  const wrongNums = answerRows.filter((r) => r.ok === false).map((r) => r.n)
  // В доработку уходит всё, что не принято: ошибки, пустые ответы и задания без
  // эталона (их автопроверка рассудить не может). Когда принято хотя бы одно и
  // не всё — возврат частичный, и об этом надо предупредить прямо в вопросе.
  const redoNums = answerRows.filter((r) => r.ok !== true).map((r) => r.n)
  const partialRedo = redoNums.length > 0 && redoNums.length < answerRows.length
  const creditedNumsShown = answerRows.filter((r) => r.credited).map((r) => r.n)

  // Результат теста стоит в карточке заданий, а не отдельной плашкой в колонке
  // «Проверка»: ошибки — это про сами задания, и вся карточка открывает разбор.
  // Плашкой справа он вклинивался в ход проверки, а под заданиями оставалось
  // пустое поле в половину ширины. Номера — не кнопки: они внутри кнопки-карточки.
  const resultRow = testScore == null ? null : (
    <div className="w-full border-t border-gray-100/80 dark:border-white/10 pt-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">Результат</span>
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          {testScore} / {hw.question_count}{testPercent != null ? ` · ${testPercent}%` : ""}
        </span>
      </div>
      {answerRows.length > 0 && (
        <>
          {/* Номера заданий цветом: сразу видно, где ошибка. */}
          <div className="flex flex-wrap gap-1.5">
            {answerRows.map((r, i) => (
              <span
                key={i}
                title={r.credited ? `Задание ${r.n} — засчитано вручную` : r.ok === false ? `Задание ${r.n} — ошибка` : r.ok ? `Задание ${r.n} — верно` : `Задание ${r.n} — проверяет репетитор`}
                className={`w-7 h-7 rounded-lg text-xs font-medium flex items-center justify-center ring-1 ${
                  r.ok === false ? "bg-red-500/12 text-red-600 ring-red-500/25"
                    : r.ok ? "bg-green-500/12 text-green-700 dark:text-green-300 ring-green-500/25"
                    : "text-gray-500 ring-gray-200 dark:ring-white/15"
                }`}
              >
                {r.n}
              </span>
            ))}
          </div>
          <div className="text-[11px] text-gray-400">
            {wrongNums.length === 0
              ? "Ошибок нет"
              : wrongNums.length === 1
              ? `Ошибка в задании №${wrongNums[0]}`
              : `Ошибки в заданиях ${wrongNums.map((n) => "№" + n).join(", ")}`}
            {/* Зачтённые руками номера называем прямо: иначе балл не сходится с
                числом верных ответов, и понять почему — неоткуда. */}
            {creditedNumsShown.length > 0 && (
              <> · {creditedNumsShown.map((n) => "№" + n).join(", ")} {creditedNumsShown.length === 1 ? "засчитано" : "засчитаны"} вручную</>
            )}
          </div>
        </>
      )}
    </div>
  )
  // Степень plainTaskMath отдаёт как «x^(2)» — в строке это лишний шум, поэтому
  // раскладываем её в юникод (x²): скобки степени та же функция уже понимает
  // в фигурном виде.
  const tasksPreview = superscriptPowers(
    plainTaskMath(taskItems[0]?.text || tasksIntro || hw.description || "").replace(/\^\(([^()]*)\)/g, "^{$1}")
  )

  // Комментарий по умолчанию берётся из формы проверки, но возврат кнопкой в
  // шапке передаёт пустой: прежний вердикт («молодец») относился к работе,
  // которую ученик сейчас будет решать заново, и в уведомлении о пересдаче
  // читался бы как издёвка.
  async function setStatus(newStatus, grade, note = comment) {
    const updates = { status: newStatus, comment: note, grade: grade ?? null }
    if (newStatus === "revision") {
      // Доработка — это не «решить всё заново»: ученик возвращается к заданиям,
      // где ошибся или не ответил вовсе. Принятые ответы остаются в работе,
      // пустыми становятся только те, что предстоит переделать — по ним кабинет
      // ученика и понимает, что ему показывать (см. redoOnly в StudentDashboard).
      // Балл после пересдачи считается по всему списку, поэтому зачтённые
      // вручную номера тоже сохраняются: их ответы никуда не делись.
      const answers = Array.isArray(hw.student_answers) ? hw.student_answers : []
      const keep = answerRows.map((r, i) => (r.ok === true ? answers[i] ?? "" : ""))
      const isKept = (i) => String(keep[i] ?? "").trim() !== ""
      // Частичный возврат имеет смысл, только когда часть заданий принята.
      // Всё верно (репетитор недоволен ходом решения) или всё неверно —
      // работа решается заново, как и раньше.
      const partial = keep.some((_, i) => isKept(i)) && keep.some((_, i) => !isKept(i))

      updates.test_score = null
      updates.student_answers = partial ? keep : null
      if (hw.credited !== undefined) updates.credited = partial ? credited : null
      // Колонку трогаем только когда она в строке есть: на базе без миграции
      // homework_solution_files.sql запись с этим полем упала бы целиком и
      // работа осталась бы не возвращённой. Фото принятых заданий остаются —
      // переделывать их ученику не нужно. Ключ карты — ПОЗИЦИЯ задания в работе
      // (i + 1), так её пишет кабинет ученика.
      const shots = hw.solution_files && typeof hw.solution_files === "object" ? hw.solution_files : null
      const keptShots = partial && shots
        ? Object.fromEntries(Object.entries(shots).filter(([num, url]) => url && isKept(Number(num) - 1)))
        : null
      const left = keptShots && Object.keys(keptShots).length ? keptShots : null
      if (hw.solution_files !== undefined) updates.solution_files = left
      // Ссылка «Решение ученика» — это первое из тех же фото.
      updates.submission_url = left
        ? Object.entries(left).sort((a, b) => Number(a[0]) - Number(b[0]))[0][1]
        : null
      // Отсчёт времени начинается заново: момент открытия ставится один раз
      // (RPC homework_open, coalesce), и с прежней отметкой доработка сдалась бы
      // сама в ту же секунду, что ученик её откроет. Колонки может не быть —
      // миграция homework_timer.sql, — тогда таймера нет и сбрасывать нечего.
      if (hw.opened_at !== undefined) updates.opened_at = null
      if (hw.auto_submitted !== undefined) updates.auto_submitted = null
    }
    await supabase.from("homework").update(updates).eq("id", hw.id)

    const accountId = studentAccountId || (studentPhone
      ? (await supabase.from("student_accounts").select("id").eq("phone", studentPhone).maybeSingle()).data?.id
      : null)

    if (newStatus === "done" && grade && accountId) {
      await supabase.from("notifications").insert({
        user_id: accountId,
        title: "Задание проверено",
        body: `«${hw.title}» — оценка ${grade} из 5`,
      })
    } else if (newStatus === "revision" && accountId) {
      await supabase.from("notifications").insert({
        user_id: accountId,
        title: "Задание на доработке",
        body: `«${hw.title}» — репетитор отправил на пересдачу${note ? ": " + note : ""}`,
      })
    }

    onUpdate()
    setGrading(false)
  }

  // Зачесть задание руками. Ответ ученика не трогаем — он свидетельство; меняется
  // список зачтённых номеров, а балл и оценка чистого теста пересчитываются из него.
  async function toggleCredit(item, on) {
    const n = Number(item.n)
    const prev = credited
    const next = on ? [...new Set([...credited, n])].sort((a, b) => a - b) : credited.filter((x) => x !== n)
    setCredited(next)
    const updates = { credited: next }
    if (hw.test_score != null) {
      const score = homeworkTestScore({ ...hw, credited: next })
      updates.test_score = score
      // У чистого теста оценка выведена из процента — иначе она разошлась бы с баллом.
      if (isPureTest && hw.question_count) updates.grade = getGradeFromPercent(Math.round((score / hw.question_count) * 100))
    }
    const { error } = await supabase.from("homework").update(updates).eq("id", hw.id)
    if (error) { setCredited(prev); return }
    // Журнал попыток: иначе задание, где ошибся генератор, навсегда осталось бы у
    // ученика слабым типажом (на task_attempts держатся «Слабые типажи» и отчёт).
    // Не критичный путь: на базе без миграции функции нет, зачёт от этого не рвётся.
    if (item.bankTask?.number != null) {
      supabase.rpc("task_attempt_credit", {
        p_source: "homework", p_source_id: hw.id, p_number: Number(item.bankTask.number),
        p_answer: item.given ?? null, p_correct: on,
      }).then(() => {}, () => {})
    }
    onUpdate()
  }

  async function finishPureTest() {
    await supabase.from("homework").update({ status: "done", grade: suggestedGrade }).eq("id", hw.id)
    onUpdate()
  }

  return (
    <div className={`glass overflow-hidden slide-up ${cls}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-base truncate">{hw.title}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${status.cls}`}>{status.label}</span>
          {/* Возврат стоит прямо у статуса «Выполнено» — это ответ на него, а
              не отдельный раздел проверки. Без этой кнопки у работы с
              автопроверкой возврата не было ВОВСЕ: кабинет ученика при сдаче
              теста сам ставит «Выполнено» и оценку по проценту
              (submitHomeworkTest), состояния «на проверке» такая работа не
              проходит, а у завершённой не было ни одной кнопки. */}
          {hw.status === "done" && (
            <button
              onClick={() => setRevising(true)}
              className="press-fill text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ring-1 ring-amber-500/40 text-amber-600 dark:text-amber-300"
            >
              На доработку
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <span className="text-[11px] text-gray-400 flex items-center gap-1.5 mr-1.5">
            <Icon name={typeInfo.iconName} size={12} />
            <span className="hidden sm:inline">{typeInfo.label}</span>
          </span>
          {!attempted && (
            <button onClick={() => onEdit(hw)} title="Редактировать задание" aria-label="Редактировать задание"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors">
              <Icon name="edit" size={15} />
            </button>
          )}
          <button onClick={() => onDelete(hw)} title="Удалить задание" aria-label="Удалить задание"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors">
            <Icon name="trash" size={15} />
          </button>
          <button onClick={onClose} title="Свернуть" aria-label="Свернуть"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors">
            <Icon name="x" size={15} />
          </button>
        </div>
      </div>

      {/* Две колонки: условия отдельно от проверки — иначе каждая секция шла бы
          полосой во всю ширину, а справа от неё оставалось пустое поле. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 px-5 py-4 border-t border-gray-100/60 dark:border-white/10 items-start">
        <div className="flex flex-col gap-2">
          <div className="section-label mb-0.5">Задания</div>
          {hw.description ? (
            // Условия открываются окном: система, дробь и чертёж не помещаются
            // в колонку шириной в половину карточки — предложение переносилось
            // посреди формулы. В строке — первое задание, чтобы работа
            // узнавалась не открывая окна.
            <button
              onClick={() => setShowTasks(true)}
              className="glass-sm press-tap w-full p-3.5 flex flex-col gap-3 text-left"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="w-9 h-9 rounded-xl bg-blue-500/12 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Icon name="file-text" size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {taskCount > 0
                      ? `${taskCount} ${plural(taskCount, "задание", "задания", "заданий")}`
                      : "Условия работы"}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 truncate">{tasksPreview}</div>
                </div>
                <span className="text-xs text-blue-600 flex-shrink-0">Посмотреть</span>
              </div>
              {resultRow}
            </button>
          ) : !hw.file_url ? (
            <div className="rounded-2xl ring-1 ring-dashed ring-gray-200/80 dark:ring-white/10 text-sm text-gray-400 text-center py-8">
              Условий нет
            </div>
          ) : null}
          {/* Условия в файле — сам файл и есть задание, поэтому он стоит первым,
              на месте карточки условий. Пустая заглушка «условия в файле» тут
              была бы дырой во весь блок, а файл уезжал бы под результат. */}
          {hw.file_url && (
            <DetailBlock className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/12 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Icon name="paperclip" size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{hw.description ? "Файл задания" : "Условия работы"}</div>
                <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                  {hw.description ? "То же, что видит ученик" : "В приложенном файле — то же, что видит ученик"}
                </div>
              </div>
              <a href={hw.file_url} target="_blank" rel="noreferrer"
                className="press-fill text-xs px-3 py-1.5 rounded-lg ring-1 ring-gray-200 dark:ring-white/15 text-gray-700 flex-shrink-0">
                Открыть
              </a>
            </DetailBlock>
          )}
          {/* Условий в работе нет (задания в файле) — результату всё равно нужно
              место, и это по-прежнему колонка заданий, а не колонка проверки. */}
          {!hw.description && resultRow && <DetailBlock>{resultRow}</DetailBlock>}
        </div>

        <div className="flex flex-col gap-2">
          <div className="section-label mb-0.5">Проверка</div>

          {/* Ученика тут не повторяем: разбор открывается под его же группой
              карточек, имя и аватар уже стоят строкой выше. Здесь только то,
              что относится к проверке: итог, срок и работа ученика.

              Итог — оценка вместе с комментарием, одним блоком и первым: он и
              есть ответ на вопрос «как проверено». Раньше оценка висела справа
              от срока сдачи, где ей нечего делать (срок — про «когда сдать»),
              и рядом они читались как оценка за срок. */}
          {(graded || verdictComment) && (
            <DetailBlock className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                  graded ? GRADE_COLORS[hw.grade] : "bg-blue-500/12 text-blue-600"
                }`}>
                  {graded ? hw.grade : <Icon name="message" size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{graded ? "Оценка" : "Комментарий"}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                    {graded ? "Работа проверена" : "От репетитора"}
                  </div>
                </div>
              </div>
              {verdictComment && (
                <div className="text-xs text-gray-500">{verdictComment}</div>
              )}
            </DetailBlock>
          )}

          <DetailBlock className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${overdue ? "bg-red-500/12 text-red-500" : "bg-blue-500/12 text-blue-600"}`}>
              <Icon name="calendar" size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-medium truncate ${overdue ? "text-red-500" : ""}`}>
                {hw.deadline ? (overdue ? "Просрочено" : "Срок сдачи") : "Без срока сдачи"}
              </div>
              {hw.deadline && (
                <div className={`text-[11px] mt-0.5 truncate ${overdue ? "text-red-500" : "text-gray-400"}`}>
                  {parseLocalDate(hw.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                </div>
              )}
            </div>
          </DetailBlock>


          {hw.submission_url && (
            <DetailBlock className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/12 text-green-600 flex items-center justify-center flex-shrink-0">
                <Icon name="check" size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{isPureTest ? "Решение ученика" : "Письменная работа"}</div>
                <div className="text-[11px] text-gray-400 mt-0.5 truncate">Прислано учеником</div>
              </div>
              <a href={hw.submission_url} target="_blank" rel="noreferrer"
                className="press-fill text-xs px-3 py-1.5 rounded-lg ring-1 ring-gray-200 dark:ring-white/15 text-gray-700 flex-shrink-0">
                Открыть
              </a>
            </DetailBlock>
          )}

          {/* Решение ученик фотографирует к каждому заданию отдельно, поэтому и
              открывается оно по заданиям: одна ссылка «Решение ученика» выше —
              это первое из этих же фото, оставленное ради старых работ. */}
          {solutionShots.length > 1 && (
            <DetailBlock>
              <div className="text-sm font-medium mb-2">Решение по заданиям</div>
              <div className="flex flex-wrap gap-2">
                {solutionShots.map(([num, url]) => (
                  <a key={num} href={url} target="_blank" rel="noreferrer"
                    className="press-fill text-xs px-3 py-1.5 rounded-lg ring-1 ring-gray-200 dark:ring-white/15 text-gray-700 flex items-center gap-1.5">
                    <Icon name="paperclip" size={12} />№{num}
                  </a>
                ))}
              </div>
            </DetailBlock>
          )}

          {hw.status === "submitted" && isPureTest && (
            <DetailBlock className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                {testPercent}% — рекомендуется оценка <span className="font-medium">{suggestedGrade}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setStatus("revision")} className="press-fill text-xs px-3 py-1.5 rounded-lg ring-1 ring-amber-500/35 text-amber-600 dark:text-amber-300">
                  На доработку
                </button>
                <button onClick={finishPureTest} className="press-fill text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg">
                  Завершить
                </button>
              </div>
            </DetailBlock>
          )}

          {hw.status === "submitted" && !isPureTest && (
            <DetailBlock>
              {!grading ? (
                <button onClick={() => setGrading(true)} className="text-xs text-blue-600 hover:opacity-70 transition-opacity">
                  Проверить и оценить
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  {testPercent != null && (
                    <div className="text-xs text-blue-700 dark:text-blue-300">
                      Часть с ответами: {testPercent}% (рекомендуется {suggestedGrade})
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-gray-500 mb-1">Оценка</div>
                    <div className="flex gap-1.5">
                      {[2, 3, 4, 5].map((g) => (
                        <button
                          key={g}
                          onClick={() => setSelectedGrade(g)}
                          className={`press-fill flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            selectedGrade === g
                              ? GRADE_COLORS[g]
                              : "ring-1 ring-gray-200 dark:ring-white/15 text-gray-500"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Комментарий (необязательно)"
                    rows={2}
                    className="input-glass text-xs resize-none"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => setStatus("done", selectedGrade)}
                      disabled={!selectedGrade}
                      className="press-fill flex-1 bg-green-600 text-white rounded-lg py-1.5 text-xs disabled:opacity-40"
                    >
                      Выполнено
                    </button>
                    <button
                      onClick={() => setStatus("revision", selectedGrade)}
                      className="press-fill flex-1 bg-amber-500 text-white rounded-lg py-1.5 text-xs"
                    >
                      На доработку
                    </button>
                  </div>
                </div>
              )}
            </DetailBlock>
          )}

        </div>
      </div>

      <ConfirmModal
        open={revising}
        icon="repeat"
        title="Вернуть на доработку?"
        message={partialRedo
          ? `Ученик заново решит ${redoNums.length} ${plural(redoNums.length, "задание", "задания", "заданий")} — те, где ошибся или не ответил (${redoNums.map((n) => "№" + n).join(", ")}). Принятые ответы останутся, оценка снимется до пересдачи.`
          : `«${hw.title}» снова станет активным у ученика. Ответы, оценка и фото решения сотрутся — работа решается заново.`}
        confirmLabel="Вернуть"
        onConfirm={() => { setRevising(false); setStatus("revision", null, "") }}
        onCancel={() => setRevising(false)}
      />

      {showTasks && (
        <TasksModal
          title={hw.title}
          note={answerRows.length > 0 ? "разбор ответов" : "условия и ответы"}
          intro={tasksIntro}
          items={taskItems}
          onCredit={canCredit ? toggleCredit : undefined}
          onClose={() => setShowTasks(false)}
        />
      )}
    </div>
  )
}

// Задания одного ученика: подпись с именем и сетка карточек. Разбор встаёт
// строкой после того ряда, в котором стоит выбранная карточка.
export function StudentHomeworkGroup({ studentName, items, selectedId, cols, detailPanel, onOpen }) {
  const color = getAvatarColor(studentName)
  const pending = items.filter((h) => h.status === "submitted").length
  const overdue = items.filter(isOverdue).length
  const selectedIndex = selectedId ? items.findIndex((h) => h.id === selectedId) : -1
  const detailRowEnd = detailRowEndOf(selectedIndex, items.length, cols)

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5 px-0.5">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0 ${color.bg} ${color.text}`}>
          {getInitials(studentName)}
        </div>
        <span className="text-sm font-medium truncate">{studentName}</span>
        <span className="text-xs text-gray-400 flex-shrink-0">{items.length} {plural(items.length, "задание", "задания", "заданий")}</span>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          {pending > 0 && <span className="text-[11px] text-amber-600 bg-amber-500/12 ring-1 ring-amber-500/20 px-2 py-0.5 rounded-full">{pending} на проверке</span>}
          {overdue > 0 && <span className="text-[11px] text-red-600 bg-red-500/12 ring-1 ring-red-500/20 px-2 py-0.5 rounded-full">{overdue} просрочено</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
        {items.map((hw, i) => (
          <Fragment key={hw.id}>
            <HomeworkCard
              hw={hw}
              selected={selectedId === hw.id}
              onOpen={() => onOpen(hw)}
            />
            {detailPanel && i === detailRowEnd && detailPanel}
          </Fragment>
        ))}
      </div>
    </section>
  )
}

function Homework({ user, students }) {
  const [homework, setHomework] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState("all")
  const [editingHw, setEditingHw] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  // Выбранное задание держим по id, а не объектом: после проверки список
  // перечитывается, и объект-снимок показывал бы старый статус и оценку.
  const [selectedId, setSelectedId] = useState(null)
  // Разбор сворачивается плавно: панель уезжает вниз и только потом снимается.
  const { cls: detailCls, close: closeDetail, cancel: cancelDetailClose } = useClosing(() => setSelectedId(null))
  const cols = useGridCols()

  useEffect(() => {
    loadHomework()
  }, [])

  async function loadHomework() {
    const { data } = await supabase
      .from("homework")
      .select("*")
      .eq("tutor_id", user.id)
      .order("created_at", { ascending: false })
    // Бакет `homework` приватный — файл задания и присланное решение
    // открываются по временной подписанной ссылке.
    setHomework(await signRows(data || [], { file_url: "homework", submission_url: "homework", solution_files: "homework", bank_tasks: "homework" }))
  }

  const overdueCount = homework.filter(isOverdue).length

  const FILTERS = [
    { id: "all", label: "Все", icon: "clipboard", tint: "text-blue-600 bg-blue-500/10", count: homework.length },
    { id: "assigned", label: "Выдано", icon: "file-text", tint: "text-blue-600 bg-blue-500/10" },
    { id: "submitted", label: "На проверке", icon: "clock", tint: "text-amber-600 bg-amber-500/12" },
    { id: "done", label: "Выполнено", icon: "check", tint: "text-green-600 bg-green-500/12" },
    { id: "revision", label: "На доработке", icon: "repeat", tint: "text-orange-600 bg-orange-500/12" },
    // Просрочку показываем отдельной кнопкой и только когда она есть —
    // пустой фильтр в списке ни к чему.
    ...(overdueCount ? [{ id: "overdue", label: "Просрочено", icon: "alert-triangle", tint: "text-red-600 bg-red-500/12", count: overdueCount }] : []),
  ]

  // Полоса-сводка с фильтром — общий StatTabs (та же полоса на «Вариантах»).

  const filtered =
    filter === "all" ? homework :
    filter === "overdue" ? homework.filter(isOverdue) :
    homework.filter((h) => h.status === filter)

  const grouped = {}
  filtered.forEach((hw) => {
    const student = students.find((s) => s.id === hw.student_id)
    const name = student?.name || "Неизвестный ученик"
    if (!grouped[name]) grouped[name] = []
    grouped[name].push(hw)
  })
  // Порядок внутри группы — по важности для репетитора, как у школьных
  // сервисов: сначала работы, которые ждут его проверки, затем выданные по
  // близости срока, проверенные — в конце. Свежая дата выдачи сама по себе
  // очередность не задаёт.
  const statusRank = { submitted: 0, assigned: 1, revision: 1, done: 2 }
  const dueTime = (h) => (h.deadline ? parseLocalDate(h.deadline).getTime() : Infinity)
  Object.values(grouped).forEach((items) =>
    items.sort((a, b) => {
      const r = (statusRank[a.status] ?? 1) - (statusRank[b.status] ?? 1)
      if (r) return r
      if ((statusRank[a.status] ?? 1) === 1 && dueTime(a) !== dueTime(b)) return dueTime(a) - dueTime(b)
      return new Date(b.created_at) - new Date(a.created_at)
    })
  )
  const groupNames = Object.keys(grouped).sort()

  // Разбор берём из полного списка: пока панель уезжает, задание уже могло
  // выпасть из фильтра — иначе она пропала бы в тот же кадр.
  const selectedHw = selectedId ? homework.find((h) => h.id === selectedId) : null
  const selectedStudent = selectedHw ? students.find((s) => s.id === selectedHw.student_id) : null

  // Повторное нажатие по карточке сворачивает разбор; нажатие по соседней
  // перебивает уход, иначе отложенное закрытие погасило бы только что открытую.
  function openHw(hw) {
    if (selectedId === hw.id) closeDetail()
    else { cancelDetailClose(); setSelectedId(hw.id) }
  }

  async function handleDelete() {
    const hw = confirmDelete
    setConfirmDelete(null)
    await supabase.from("homework").delete().eq("id", hw.id)
    if (selectedId === hw.id) setSelectedId(null)
    loadHomework()
  }

  // Обёртка .detail-row сворачивает ВЫСОТУ ряда теми же кадрами, что панель
  // гаснет: без неё карточки под разбором стояли на месте и прыгали вверх
  // одним кадром после его снятия.
  const detailPanel = selectedHw ? (
    <div className={`col-span-full detail-row ${detailCls}`}>
      <div className="min-h-0 overflow-hidden">
        <HomeworkDetail
          key={selectedHw.id}
          hw={selectedHw}
          studentPhone={selectedStudent?.phone || null}
          studentAccountId={selectedStudent?.studentAccountId || null}
          onUpdate={loadHomework}
          onEdit={setEditingHw}
          onDelete={setConfirmDelete}
          onClose={closeDetail}
          cls={detailCls}
        />
      </div>
    </div>
  ) : null

  return (
    <div className="p-4 md:p-6">
      {/* Варианты ОГЭ/ЕГЭ — свой раздел меню, а не вкладка внутри этого:
          у ученика они тоже отдельным пунктом, и в боковом меню репетитора
          слова «Варианты» раньше не было вовсе. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <h1 className="text-xl font-medium page-title">Домашние задания</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary px-4 py-2 text-sm self-stretch sm:self-auto">
          + Задание
        </button>
      </div>

      {(
        <>
          <StatTabs
            className="mb-4"
            items={FILTERS.map((f) => ({ ...f, count: f.count ?? homework.filter((h) => h.status === f.id).length }))}
            value={filter}
            onChange={(next) => {
              setFilter(next)
              // Открытый разбор скрывать молча нельзя: если задание не попадает
              // в выбранный фильтр, сворачиваем его той же анимацией.
              const hw = selectedId ? homework.find((h) => h.id === selectedId) : null
              const fits = !hw || next === "all" || (next === "overdue" ? isOverdue(hw) : hw.status === next)
              if (hw && !fits) closeDetail()
            }}
          />

          {groupNames.length === 0 ? (
            <div key={filter} className="tab-swap relative overflow-hidden text-center py-12 border border-dashed border-white/50 glass-sm">
              <FormulaBackdrop variant="panel" />
              <div className="relative z-10 flex flex-col items-center gap-3 px-4">
                <span className="text-sm text-gray-400">
                  {filter === "all" ? "Заданий пока нет" : filter === "overdue" ? "Просроченных заданий нет" : "Нет заданий с таким статусом"}
                </span>
                {filter === "all" && (
                  <>
                    <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                      Задайте первое: текстом, файлом или с автопроверкой ответов — ученик увидит его в своём кабинете.
                    </p>
                    <button onClick={() => setShowModal(true)} className="btn-primary px-4 py-2 text-sm">
                      + Задание
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div key={filter} className="tab-swap flex flex-col gap-5">
              {groupNames.map((name) => (
                <StudentHomeworkGroup
                  key={name}
                  studentName={name}
                  items={grouped[name]}
                  selectedId={grouped[name].some((h) => h.id === selectedId) ? selectedId : null}
                  cols={cols}
                  detailPanel={grouped[name].some((h) => h.id === selectedId) ? detailPanel : null}
                  onOpen={openHw}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        danger
        title="Удалить задание?"
        message={`«${confirmDelete?.title || ""}» пропадёт и у вас, и у ученика — вместе с его ответами и оценкой.`}
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {showModal && (
        <CreateHomeworkModal
          students={students}
          tutorId={user.id}
          bankSubjects={user.profile?.bank_subjects}
          owner={isOwner(user.email)}
          onClose={() => setShowModal(false)}
          onCreated={loadHomework}
        />
      )}

      {editingHw && (
        <CreateHomeworkModal
          students={students}
          tutorId={user.id}
          bankSubjects={user.profile?.bank_subjects}
          owner={isOwner(user.email)}
          editingHw={editingHw}
          onClose={() => setEditingHw(null)}
          onCreated={loadHomework}
        />
      )}
    </div>
  )
}

// Раздел под тарифом. Гейт стоит ОБЁРТКОЙ, а не условным return внутри
// Homework: иначе часть хуков компонента перестала бы вызываться.
function HomeworkGate(props) {
  const { allows } = usePlan()
  if (allows("homework")) return <Homework {...props} />
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-medium page-title mb-1">Задания</h1>
      <p className="text-sm page-subtitle mb-5">Домашние задания ученикам и их проверка.</p>
      <PlanLock feature="homework" title="Домашние задания" text="Выдача заданий ученикам, таймер как на экзамене, проверка с комментариями и возврат на доработку." />
    </div>
  )
}

export default HomeworkGate
