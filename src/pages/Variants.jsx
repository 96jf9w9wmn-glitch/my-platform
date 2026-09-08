import { useState, useEffect, useMemo, useRef, Fragment } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import { signRows } from "../storageUrl"
import { plural, getInitials, plainTaskMath, answersEqual, parseLocalDate } from "../utils"
import Icon from "../components/Icon"
import { isModuleNumber, linkedGroupOf, part1NumbersOf, part1SlotsOf, part2NumbersOf, isPart2Number, examLevelOf, numbersLabel, packVariantTask, VARIANT_TYPES } from "./taskBankMeta"
import { choiceBaseOf } from "./answerChoices"
import { scaleOf, variantPart2MaxOf, isLegacyProfVariant, variantMaxPrimary, examResult, secondaryLabel, taskMaxOf } from "../examScales"
import { criteriaOf, gradingNotesOf } from "../examCriteria"
// Вариант ученик решает столько же, сколько длится настоящий экзамен.
import { examMinutesOf, formatExamDuration } from "./examTiming"
// Список предметов — из лёгкого модуля: генераторы приезжают отдельно, по кнопке.
import { BANK_SUBJECTS, subjectOf, examLabel } from "./examSubjectList"
import { isOwner } from "../owner"
import { usePlan } from "../subscription"
import { PlanHint } from "../components/PlanLock"
import ConfirmModal from "../components/ConfirmModal"
import DeadlinePicker from "../components/DeadlinePicker"
import TasksModal from "../components/TasksModal"
import SegmentSwitch from "../components/SegmentSwitch"
import StatTabs from "../components/StatTabs"
import MethodCards from "../components/MethodCards"
import AutoHeight from "../components/AutoHeight"
import { useClosing, POPUP_OUT_MS } from "../useClosing"
import useGridCols, { detailRowEndOf } from "../useGridCols"
import getAvatarColor from "../avatarColor"
import DateTile from "../components/DateTile"
import { TILE_TINTS, dueTintKey } from "../dueTint"
import Reveal from "../components/Reveal"
import { lazyChunk } from "../lazyChunk"
// Тетрадь тянет генераторы заданий — грузим только когда её открыли.

// Банк заданий — самый тяжёлый модуль приложения: генераторы всех предметов весят около
// 3,3 МБ. Разделу он нужен только по нажатию кнопки, поэтому подключается в этот момент,
// а не при открытии раздела: список вариантов появляется сразу. Сразу после отрисовки банк
// подтягивается фоном (prefetchBank), так что к нажатию «Собрать вариант» он обычно уже в кэше.
const loadBank = () => lazyChunk(() => import("./taskBankApi"), "банк заданий")
function prefetchBank() {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500))
  // Фоновая подгрузка молчит: не доехало — значит подождём нажатия, там о сбое
  // уже скажут словами.
  idle(() => { loadBank().catch(() => {}) })
}

// Состав варианта. Условия открываются окном, а не разворотом внутри колонки:
// задание банка везёт систему, дробь и чертёж, а карточка стоит в колонке
// шириной в половину разбора — формула там переносилась посреди предложения.
function BankTasksBlock({ tasks, title }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="glass-sm press-tap w-full p-3.5 flex items-center gap-3 text-left">
        <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center flex-shrink-0">
          <Icon name="book" size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">Задания из банка</div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {tasks.length} {plural(tasks.length, "задание", "задания", "заданий")} · условия и чертежи
          </div>
        </div>
        <span className="text-xs text-blue-600 flex-shrink-0">Посмотреть</span>
      </button>
      {open && (
        <TasksModal
          title={title || "Задания варианта"}
          note="состав варианта"
          items={variantTaskItems(tasks)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// Задания варианта → список для окна. Номер задания в варианте и есть его
// номер на экзамене, поэтому нумеруем им, а не порядком в списке.
const variantTaskItems = (tasks) =>
  tasks.map((t, i) => ({ n: t.number ?? i + 1, text: t.condition_text || "", bankTask: t, answer: t.answer ?? null, options: null }))

// Аккаунты учеников репетитора. Общий загрузчик окна создания и окна правки:
// список в обоих один и тот же, и вторая копия запроса разошлась бы с первой
// при первой же правке.
function useStudentAccounts(tutorId) {
  const [accounts, setAccounts] = useState([])
  useEffect(() => {
    if (!tutorId) return
    supabase.from("student_accounts").select("id, name, phone").eq("tutor_id", tutorId)
      .then(({ data }) => setAccounts(data || []))
  }, [tutorId])
  return accounts
}

// Кому задать вариант. Раньше здесь стоял выпадающий список «Все ученики (ЕГЭ)»
// или один ученик — а вариант чаще задают именно группе: тем, кто пишет этот
// экзамен, кроме заболевшего. Галочками состав выдачи виден целиком, и «Все»
// осталось одним нажатием, а не отдельным режимом.
//
// Заблокированная строка — ученик, который вариант уже открыл или сдал: отозвать
// у него работу нельзя, вместе с ней стёрлись бы ответы и баллы.
function StudentPicker({ accounts, value, onChange, lockedIds = [], noteOf, label = "Кому задать", empty }) {
  const locked = new Set((lockedIds || []).map(String))
  const free = accounts.map((a) => String(a.id)).filter((id) => !locked.has(id))
  const allOn = free.length > 0 && free.every((id) => value.includes(id))
  const toggle = (id) => {
    if (locked.has(id)) return
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="text-sm text-gray-500">{label}{value.length > 0 ? ` · ${value.length}` : ""}</div>
        {free.length > 1 && (
          <button type="button"
            onClick={() => onChange(allOn ? value.filter((id) => locked.has(id)) : [...new Set([...value, ...free])])}
            className="no-press text-[11px] text-blue-600 hover:opacity-70 active:scale-95 transition-all">
            {allOn ? "Снять всех" : "Выбрать всех"}
          </button>
        )}
      </div>
      {accounts.length === 0 ? (
        <div className="rounded-xl ring-1 ring-dashed ring-gray-200/80 dark:ring-white/10 text-xs text-gray-400 text-center py-4">
          {empty || "Учеников пока нет"}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto p-px -m-px">
          {accounts.map((a) => {
            const id = String(a.id)
            const on = value.includes(id)
            const isLocked = locked.has(id)
            const note = noteOf ? noteOf(a) : ""
            const color = getAvatarColor(a.name || "")
            return (
              <button key={id} type="button" onClick={() => toggle(id)} disabled={isLocked}
                aria-pressed={on}
                className={`w-full rounded-xl px-2.5 py-2 flex items-center gap-2.5 text-left ring-1 transition-colors ${
                  isLocked
                    ? "ring-gray-200/70 dark:ring-white/10 cursor-default"
                    : `press-fill ${on
                      ? "ring-blue-500/30 bg-blue-500/[0.06]"
                      : "ring-gray-200/70 dark:ring-white/10 hover:bg-blue-500/[0.06]"}`}`}>
                <span className={`w-5 h-5 rounded-md flex items-center justify-center ring-1 flex-shrink-0 transition-colors ${
                  on ? "bg-blue-600 text-white ring-blue-600" : "text-transparent ring-gray-300 dark:ring-white/20"}`}>
                  <Icon name="check" size={12} />
                </span>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${color.bg} ${color.text}`}>
                  {getInitials(a.name || "")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate">{a.name || a.phone}</span>
                  {note && <span className="block text-[11px] text-gray-400 truncate">{note}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Способы сборки варианта — теми же карточками, что у «Нового задания».
const VARIANT_METHODS = [
  { id: "file", icon: "paperclip", title: "Свой файл", note: "PDF или фото варианта, ответы вписываете сами" },
  { id: "bank", icon: "grid", title: "Из банка заданий", note: "Соберём состав экзамена с ответами" },
]

const isEgeType = (t) => examLevelOf(t) === "ЕГЭ"
// Разбивка «алгебра/геометрия» и подпись «задания 1–12» — про математику.
// У информатики их нет: там ни геометрии, ни части 2.
const isMathType = (t) => t === "ОГЭ" || t === "ЕГЭ" || t === "ЕГЭ Профиль"

// Задания части 2, реально вошедшие в вариант. У старых вариантов снимка нет —
// берём штатный состав экзамена. Баллы и набор — через variantPart2MaxOf:
// варианты, выданные до перенумерации КИМ-2027, живут по раскладке 2026 года.
function variantPart2Tasks(variant) {
  const max = variantPart2MaxOf(variant)
  const snap = [...new Set((variant?.tasks_snapshot || []).map((t) => t.number).filter((n) => max[n]))].sort((a, b) => a - b)
  return snap.length ? snap : part2NumbersOf(variant?.type).filter((n) => max[n])
}

// Максимум первичного балла этого варианта. Он меньше экзаменационного: в
// вариант идёт только то, что решается на бумаге, поэтому вторичный балл по
// нему — прогноз (см. examScales.js). Состав берём из снимка самого варианта:
// у выданных до перенумерации профилей часть 1 и часть 2 старые.
const variantMaxOf = (variant) => {
  const snapNums = [...new Set((variant?.tasks_snapshot || []).map((t) => t.number))]
  const nums = snapNums.length ? snapNums : [...part1NumbersOf(variant?.type), ...variantPart2Tasks(variant)]
  return variantMaxPrimary(variant?.type, nums, variantPart2MaxOf(variant))
}

// Результат сданной работы по шкале её экзамена. geom_score — колонка с двойным
// смыслом: у ОГЭ по математике там баллы за геометрию, у экзаменов с тестовым
// баллом — он сам, поэтому как геометрию её читаем только для математики.
function submissionResult(variant, sub) {
  const geomNums = scaleOf(variant?.type)?.geometryNumbers
  return examResult(variant?.type, sub?.total_score || 0, {
    geometry: geomNums ? (sub?.geom_score ?? null) : null,
    variantMax: variantMaxOf(variant),
  })
}

// Имя файла в Storage: непредсказуемая часть пути — метка времени (вне компонента,
// чтобы react-hooks/purity не считал Date.now() вызовом в рендере)
const storageFileName = (tutorId, ext) => `${tutorId}/${Date.now()}.${ext}`

// Название по умолчанию — сегодняшняя дата: вариант собирают к занятию, и дата отличает
// варианты друг от друга лучше, чем «Вариант 1» (переименовать по-прежнему можно).
// Вне компонента по той же причине, что и storageFileName.
const todayTitle = () => new Date().toLocaleDateString("ru-RU")

// Баллы за геометрию — условие отметки на ОГЭ по математике: без двух баллов
// за задания 15–19 и 23–25 ставится «2» при любой сумме. Номера приходят из
// шкалы экзамена, чтобы список не разъехался с examScales.js.
function getGeomScore(part1Answers, correctAnswers, part2ScoreDetail, geomNumbers) {
  return geomNumbers.reduce((geom, n) => {
    const inPart2 = part2ScoreDetail && part2ScoreDetail[n] !== undefined
    if (inPart2) return geom + Number(part2ScoreDetail[n] || 0)
    return geom + (answersEqual(part1Answers?.[n - 1], correctAnswers?.part1?.[n - 1]) ? 1 : 0)
  }, 0)
}

// Предметы, из которых репетитор может собрать вариант: отмеченные в «Профиле»
// (ничего не отмечено — все открытые) и такие, для которых вариант вообще
// собирается. Владельцу платформы — всё, что есть.
function variantSubjectsFor(bankSubjects, owner) {
  const picked = (Array.isArray(bankSubjects) ? bankSubjects : []).filter((t) => subjectOf(t))
  const out = []
  for (const item of BANK_SUBJECTS) {
    if (!owner && !item.open) continue
    const types = item.types.filter((t) => VARIANT_TYPES.includes(t) && (!picked.length || picked.includes(t)))
    if (types.length) out.push({ ...item, types })
  }
  return out
}

// Первый предмет и экзамен: уровень берём из анкеты («готовлю к ЕГЭ» — открываем
// ЕГЭ), иначе ОГЭ, как было до появления выбора предмета.
function defaultVariantType(subjects, examFocus) {
  const all = subjects.flatMap((s) => s.types)
  if (!all.length) return "ОГЭ"
  const wantEge = Array.isArray(examFocus) && examFocus.includes("ЕГЭ") && !examFocus.includes("ОГЭ")
  return all.find((t) => examLevelOf(t) === (wantEge ? "ЕГЭ" : "ОГЭ")) || all[0]
}

// Ответы — ВЕЗДЕ одинаково: сетка «номер — поле», и в части 1, и в части 2.
// Раньше часть 1 там, где номера идут подряд (математика), была одной строкой
// через пробел, а часть 2 рядом — сеткой: в одной форме уживались два разных
// вида ввода, и один экзамен не был похож на другой.
//
// Скорость строки осталась, но теперь у неё есть ВИДИМАЯ кнопка «Вставить
// списком»: раскладка ключа по номерам — это то, ради чего строку и держали, а
// подсказка мелким текстом («вставьте в первое поле») работой не была — про
// такое не догадываются, пока не прочтут. Поле в сетке тоже принимает список
// целиком, но это уже подспорье для тех, кто попробует, а не единственный путь.
function AnswerGrid({ label, numbers, valueOf, onChange, placeholderOf, hint, allowBulk = true }) {
  const [bulk, setBulk] = useState(null)      // null — панель вставки закрыта
  // Номера читаются столбиками (1, 2, 3… вниз), а не строками: ключ переносят
  // сверху вниз, и порядок обхода по Tab совпадает с порядком на экране —
  // разметка идёт теми же номерами подряд, меняется только направление потока.
  // Высоту столбца считает CSS (.answer-grid в index.css): столько же рядов,
  // сколько колонок в этой ширине. Считать колонки в JS нельзя — свой
  // matchMedia расходится с классами сетки, и на телефоне вместо двух колонок
  // получалось четыре.
  const colRows = { "--rows-2": Math.ceil(numbers.length / 2),
                    "--rows-3": Math.ceil(numbers.length / 3),
                    "--rows-4": Math.ceil(numbers.length / 4) }

  // Разложить список по номерам, начиная с idx-го поля сетки.
  function spread(text, idx = 0) {
    const vals = String(text).trim().split(/\s+/).filter(Boolean)
    vals.slice(0, numbers.length - idx).forEach((v, k) => onChange(numbers[idx + k], v))
  }

  function handlePaste(e, idx) {
    const text = e.clipboardData?.getData("text") || ""
    if (text.trim().split(/\s+/).filter(Boolean).length < 2) return   // одиночный ответ — как обычно
    e.preventDefault()
    spread(text, idx)
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <label className="text-sm text-gray-500">{label}</label>
        {/* Собранному из банка варианту вставка не нужна: ответы уже стоят в
            полях, и кнопка предлагала бы затереть их тем, чего у репетитора
            нет. */}
        {allowBulk && (
        <button type="button" onClick={() => setBulk((v) => (v === null ? "" : null))}
          className="no-press shrink-0 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:opacity-70 active:scale-95 transition-all">
          <Icon name={bulk === null ? "clipboard" : "chevron-up"} size={11} />
          {bulk === null ? "Вставить списком" : "Свернуть"}
        </button>
        )}
      </div>

      {/* Сетка заполняется прямо во время вставки — видно, что список разошёлся
          по номерам, и закрывать панель можно, уже видя результат. */}
      <Reveal value={allowBulk && bulk !== null ? "open" : ""} className="mb-2">
        {() => (
          <div className="pb-1">
            <textarea
              autoFocus rows={2}
              value={bulk || ""}
              onChange={(e) => { setBulk(e.target.value); spread(e.target.value) }}
              placeholder="3 12 4 -5 2 0.5 8 16 3 7"
              className="input-glass resize-none w-full text-sm"
            />
            <div className="text-[11px] text-gray-400 mt-1">
              Вставьте ответы через пробел — они разойдутся по номерам сверху вниз.
            </div>
          </div>
        )}
      </Reveal>

      <div className="answer-grid grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-3 gap-2" style={colRows}>
        {numbers.map((n, idx) => (
          <div key={n} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-5 flex-shrink-0">{n}</span>
            <input
              value={valueOf(n)}
              onChange={(e) => onChange(n, e.target.value)}
              onPaste={(e) => handlePaste(e, idx)}
              placeholder={placeholderOf ? placeholderOf(n) : "Ответ"}
              className="input-glass flex-1 px-2 py-1.5 text-sm min-w-0"
            />
          </div>
        ))}
      </div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  )
}

function AddVariantModal({ tutorId, students = [], examFocus, bankSubjects = null, owner = false, onClose, onAdd }) {
  const subjects = variantSubjectsFor(bankSubjects, owner)
  const [title, setTitle] = useState(todayTitle)
  // Срок сдачи — на самом варианте: он выдаётся всем сразу, и «до воскресенья»
  // это одно решение на всех (см. supabase/variant_deadline.sql).
  const [deadline, setDeadline] = useState("")
  const [examType, setExamType] = useState(() => defaultVariantType(subjects, examFocus))
  const [answers, setAnswers] = useState(() => Array(part1SlotsOf(defaultVariantType(subjects, examFocus))).fill(""))
  // Ответы части 2 (ОГЭ: 20–25) — объект { номер: ответ }; при сборке из банка заполняется сам
  const [part2Answers, setPart2Answers] = useState({})
  const [loading, setLoading] = useState(false)
  const [variantFile, setVariantFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const accounts = useStudentAccounts(tutorId)
  const [recipientIds, setRecipientIds] = useState([])
  // Ошибки формы показываем рядом с кнопкой, а не системным alert.
  const [formError, setFormError] = useState("")
  const { cls: closingCls, close } = useClosing(onClose)
  // Источник условий: свой файл или собранные из банка заданий
  const [source, setSource] = useState("file")
  const [bankPicked, setBankPicked] = useState([])
  const [showPicked, setShowPicked] = useState(false)  // собранный вариант окном
  const [bankMissing, setBankMissing] = useState([])
  const [assembling, setAssembling] = useState(false)
  const fileRef = useRef()

  // Цель (ОГЭ/ЕГЭ) берём из students по уже вычисленному studentAccountId
  // (App.jsx), чтобы не заводить второе, отдельное сопоставление.
  const goalByAccountId = useMemo(() => {
    const map = {}
    for (const s of students) {
      if (s.studentAccountId && s.goal) map[s.studentAccountId] = s.goal
    }
    return map
  }, [students])

  // По умолчанию отмечены те, кто пишет этот экзамен, — ровно то, что делал
  // пункт «Все ученики (ЕГЭ)». Разница в том, что теперь состав видно: раньше,
  // если под цель не подходил никто, вариант молча уходил в никуда и значился
  // в разборе «ещё никому не выдан».
  const examLevel = examLevelOf(examType)
  useEffect(() => {
    setRecipientIds(accounts
      .filter((a) => { const g = goalByAccountId[a.id]; return !g || g === examLevel })
      .map((a) => String(a.id)))
  }, [accounts, examLevel, goalByAccountId])

  // Номера части 1 идут подряд только в математике: в информатике из варианта
  // выпадают задания, которые без компьютера не решить (см. VARIANT_PART1).
  const p1Numbers = part1NumbersOf(examType)
  const answerCount = p1Numbers.length
  const answerSlots = part1SlotsOf(examType)          // ответы лежат по индексу «номер − 1»
  const part2Numbers = part2NumbersOf(examType)
  const subjectOfType = subjects.find((s) => s.types.includes(examType)) || subjects[0]

  function pickExamType(next) {
    setExamType(next)
    setAnswers(Array(part1SlotsOf(next)).fill(""))
    setPart2Answers({}); setBankPicked([]); setBankMissing([]); setFormError("")
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setVariantFile(file)
    setPreviewUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : null)
  }

  function removeFile() {
    setVariantFile(null)
    setPreviewUrl(null)
    fileRef.current.value = ""
  }

  async function handleAssemble() {
    setAssembling(true)
    const { assembleFromBank } = await loadBank()
    const { picked, missing } = await assembleFromBank(examType)
    setBankPicked(picked)
    setBankMissing(missing)
    const filled = Array(answerSlots).fill("")
    const p2 = {}
    picked.forEach((t) => {
      if (isPart2Number(examType, t.number)) p2[t.number] = t.answer
      else filled[t.number - 1] = t.answer
    })
    setAnswers(filled)
    setPart2Answers(p2)
    setAssembling(false)
  }

  async function handleReroll(number) {
    const { rerollModule, rerollTask, rerollLinked } = await loadBank()
    // Задания 1–5 — связанный модуль: замена любого пересобирает весь сценарий целиком.
    // Так же и со связкой КЕГЭ №19–21: там одна игра на три задания, и заменить
    // одно значит оставить соседей со ссылкой на игру, которой в варианте больше нет.
    const linked = linkedGroupOf(examType, number)
    if (isModuleNumber(examType, number) || linked) {
      const fresh = isModuleNumber(examType, number) ? rerollModule(examType) : rerollLinked(examType, linked)
      if (!fresh?.length) return
      const freshNums = new Set(fresh.map((t) => t.number))
      setBankPicked((prev) => [...prev.filter((t) => !freshNums.has(t.number)), ...fresh].sort((a, b) => a.number - b.number))
      setAnswers((prev) => { const upd = [...prev]; fresh.forEach((t) => { upd[t.number - 1] = t.answer }); return upd })
      return
    }
    const current = bankPicked.find((t) => t.number === number)
    const next = await rerollTask(examType, number, current?.id)
    if (!next) return
    setBankPicked((prev) => prev.map((t) => (t.number === number ? next : t)))
    if (isPart2Number(examType, number)) setPart2Answers((prev) => ({ ...prev, [number]: next.answer }))
    else setAnswers((prev) => { const upd = [...prev]; upd[number - 1] = next.answer; return upd })
  }

  async function handleSubmit() {
    if (!title) { setFormError("Дайте варианту название — по нему ученик найдёт его в списке."); return }
    if (source === "bank" && bankPicked.length === 0) { setFormError("Сначала соберите вариант из банка заданий."); return }
    const filledCount = p1Numbers.filter((n) => answers[n - 1]).length
    if (filledCount < answerCount) {
      setFormError(`Заполнены не все ответы части 1: ${filledCount} из ${answerCount}.`)
      return
    }
    setFormError("")
    setLoading(true)

    let fileUrl = null
    if (source === "file" && variantFile) {
      setUploading(true)
      const fileName = storageFileName(tutorId, variantFile.name.split(".").pop())
      const { error: uploadError } = await supabase.storage.from("variants").upload(fileName, variantFile, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("variants").getPublicUrl(fileName)
        fileUrl = urlData.publicUrl
      }
      setUploading(false)
    }

    const tasksSnapshot = source === "bank" ? bankPicked.map(packVariantTask) : null

    // Варианты ответа части 2 (ученик выбирает один из четырёх): у собранного из банка
    // берутся у сгенерированных заданий, у своего файла строятся из введённых ответов.
    // Ответ ЕГЭ двухчастный, и выбор идёт по пункту б) — букву пункта храним рядом,
    // иначе ученик не поймёт, к чему относятся четыре варианта.
    const { makeAnswerChoices } = await loadBank()
    const part2Choices = {}
    const part2ChoicesPart = {}
    for (const n of part2Numbers) {
      const picked = source === "bank" ? bankPicked.find((t) => t.number === n) : null
      const choices = picked?.choices || makeAnswerChoices(part2Answers[n])
      if (!choices) continue
      part2Choices[n] = choices
      const part = picked ? picked.choices_part : choiceBaseOf(part2Answers[n]).part
      if (part) part2ChoicesPart[n] = part
    }

    // PDF собранного варианта не делается вовсе: вариант из банка ученик решает прямо
    // в кабинете, печатный лист ему не нужен.

    const row = {
      tutor_id: tutorId, title, type: examType,
      answers: { part1: answers, part2: part2Answers, part2_choices: part2Choices, part2_choices_part: part2ChoicesPart },
      file_url: fileUrl, tasks_snapshot: tasksSnapshot,
      deadline: deadline || null,
    }
    let { data, error } = await supabase.from("variants").insert(row).select().single()
    // База без миграции срока (supabase/variant_deadline.sql) — сохраняем
    // вариант без него: забытая миграция не должна мешать выдать работу.
    if (error?.code === "PGRST204" || /deadline/i.test(error?.message || "")) {
      const { deadline: _skip, ...noDeadline } = row
      void _skip
      ;({ data, error } = await supabase.from("variants").insert(noDeadline).select().single())
    }

    if (error) { setFormError("Не получилось сохранить: " + error.message); setLoading(false); return }

    // Кому отправить — ровно те, кто отмечен галочкой.
    const recipients = accounts.filter((a) => recipientIds.includes(String(a.id)))

    if (recipients.length > 0) {
      await supabase.from("variant_submissions").insert(recipients.map((s) => ({ variant_id: data.id, student_id: s.id, status: "pending" })))
      await supabase.from("notifications").insert(recipients.map((s) => ({
        user_id: s.id,
        title: "Новый вариант " + examType,
        body: "Репетитор отправил новый вариант: " + title
          + (deadline ? ". Сдать до " + dayMonth(deadline) : ""),
      })))
    }

    onAdd(data)
    close()
    setLoading(false)
  }

  return createPortal(
    <div className={`fixed inset-0 glass-overlay z-50 overflow-y-auto ${closingCls}`}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div className={`glass-modal p-6 sm:p-7 w-full max-w-4xl ${closingCls}`}>
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-medium">Новый вариант</h2>
            <button onClick={close} aria-label="Закрыть" className="text-gray-500 hover:text-gray-700"><Icon name="x" size={18} /></button>
          </div>
          {/* Настройки слева, сама сборка — справа: собранный вариант это самая
              длинная часть окна, и рядом с полями он ужимался до узкой полосы.
              Ответы идут следом за сборкой, в том же правом столбце: их сверяют
              с заданиями, которые видно рядом. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 items-stretch">
            <div className="flex flex-col gap-4">

              <StudentPicker
                accounts={accounts}
                value={recipientIds}
                onChange={setRecipientIds}
                label="Кому задать вариант"
                empty="Учеников пока нет — вариант сохранится, задать его можно будет из окна правки"
                // Ученик, который готовится к другому экзамену, из списка не
                // прячется: пробник другого уровня дают намеренно, и молча
                // исчезнувшая строка выглядела бы как пропавший ученик.
                noteOf={(a) => (goalByAccountId[a.id] && goalByAccountId[a.id] !== examLevel
                  ? `готовится к ${goalByAccountId[a.id]}` : "")}
              />

              {/* Предмет — только те, что отмечены в «Профиле». Один предмет —
                  переключателя нет: выбирать не из чего. */}
              {subjects.length > 1 && (
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Предмет</label>
                  <SegmentSwitch
                    block
                    ariaLabel="Предмет"
                    value={subjectOfType?.label}
                    onChange={(label) => {
                      const next = subjects.find((s) => s.label === label)
                      if (next) pickExamType(next.types[0])
                    }}
                    items={subjects.map((s) => ({ key: s.label, label: s.label }))}
                  />
                </div>
              )}

              {(subjectOfType?.types.length || 0) > 1 && (
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Тип экзамена</label>
                  <SegmentSwitch
                    block
                    ariaLabel="Тип экзамена"
                    value={examType}
                    onChange={pickExamType}
                    items={subjectOfType.types.map((t) => ({
                      key: t,
                      label: <><Icon name={examLevelOf(t) === "ОГЭ" ? "file-text" : "book"} size={14} />{examLabel(t)}</>,
                    }))}
                  />
                </div>
              )}

              {examMinutesOf(examType) && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Icon name="clock" size={12} />
                  Ученик решает на время: {formatExamDuration(examMinutesOf(examType))} — столько же длится экзамен
                </div>
              )}

              <div>
                <label className="text-sm text-gray-500 mb-1 block">Название варианта</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Пробник перед экзаменом"
                  className="input-glass" />
              </div>

              {/* Срок сдачи — теми же чипами, что у домашней работы. Он не про
                  продолжительность работы (её задаёт таймер экзамена), а про
                  дату, к которой вариант ждут решённым. */}
              <DeadlinePicker value={deadline} onChange={setDeadline} />

              <MethodCards
                label="Из чего собрать вариант"
                items={VARIANT_METHODS}
                value={source}
                onChange={setSource}
              />

              <div className="bg-amber-500/10 ring-1 ring-amber-500/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300">
                {examType === "ОГЭ"
                  ? "Часть 2 (20–25): ученик выбирает ответ из четырёх и прикрепляет фото решения. Баллы начисляются только после вашей проверки."
                  : part2Numbers.length > 0
                    ? "Часть 2 (задания 13–19) проверяется вручную после загрузки решений учеником."
                    : isMathType(examType)
                      ? "Все задания — с кратким ответом: вариант проверяется автоматически."
                      : "В вариант входят только задания, которые решаются без компьютера: практическая часть (работа с файлами и таблицами) в печатный лист не помещается."}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-500 block">
                {source === "bank" ? "Задания варианта" : "Файл варианта"}
              </label>
              {/* Панель способа: высота едет плавно, иначе окно скачет при
                  переключении карточек — куски разной длины (как в «Новом задании»). */}
              <AutoHeight className="flex-1">
              <div key={source} className="tab-swap flex flex-col h-full">
              {source === "file" ? (
                <>
                  <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} />
                  {!variantFile ? (
                    <button
                      onClick={() => fileRef.current.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleFileUpload({ target: { files: e.dataTransfer.files } }) }}
                      className="w-full flex-1 min-h-28 rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/15 py-6 px-4 flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                    >
                      <Icon name="upload" size={18} />
                      <span className="text-sm">Перетащите файл или нажмите</span>
                      <span className="text-[11px] text-gray-400">PDF или фото варианта</span>
                    </button>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {previewUrl && <img src={previewUrl} alt="preview" className="w-full max-h-48 object-contain bg-white" />}
                      {!previewUrl && <div className="px-4 py-3"><span className="text-sm text-gray-700 truncate">{variantFile.name}</span></div>}
                      <div className="flex border-t border-gray-100">
                        <button onClick={() => fileRef.current.click()} className="flex-1 text-xs text-blue-600 py-2 hover:bg-blue-50">Заменить</button>
                        <div className="w-px bg-gray-200/70 dark:bg-white/10" />
                        <button onClick={removeFile} className="flex-1 text-xs text-red-500 py-2 hover:bg-red-50">Удалить</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-2 flex-1">
                  <button onClick={handleAssemble} disabled={assembling}
                    className="bg-blue-600 text-white rounded-xl py-2 text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99] transition-transform flex items-center justify-center gap-1.5">
                    {assembling
                      ? <><span className="loader-dots"><i /><i /><i /></span>Собираем задания</>
                      : <><Icon name="grid" size={14} />{bankPicked.length > 0 ? "Собрать заново" : "Собрать вариант из банка"}</>}
                  </button>

                  {bankPicked.length > 0 && (
                    <>
                      <div className="text-xs mb-1">
                        Собрано заданий: <span className={bankMissing.length === 0 ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                          {bankPicked.length} / {answerCount + part2Numbers.length}
                        </span>
                        {bankMissing.length > 0 && (
                          <span className="text-amber-600"> · нет в банке: {bankMissing.join(", ")}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 mb-1 leading-snug">
                        Ученик решит вариант прямо в кабинете. Печатный лист PDF собирается отдельно —
                        кнопкой в карточке варианта, чтобы отправка не ждала сборки файла.
                      </div>
                    </>
                  )}

                  {bankPicked.length > 0 && (
                    <>
                    {/* Список рядом с настройками тесный, условия в нём обрезаны
                        одной строкой. Вариант целиком смотрится окном — тем же,
                        каким он открывается из карточки. */}
                    <button type="button" onClick={() => setShowPicked(true)}
                      className="no-press self-start inline-flex items-center gap-1 text-[11px] text-blue-600 hover:opacity-70 active:scale-95 transition-all mb-1">
                      <Icon name="maximize" size={11} />Посмотреть целиком
                    </button>
                    {/* Пиксель запаса со всех сторон: кольцо (ring-*) рисуется
                        box-shadow'ом СНАРУЖИ карточки, и прокрутка срезала его
                        у первой и последней — рамка выглядела надрезанной. */}
                    <div className="flex flex-col gap-1.5 max-h-[24rem] overflow-y-auto p-px -m-px">
                      {bankPicked.map((t) => (
                        <div key={t.number} className="rounded-xl ring-1 ring-gray-200/70 dark:ring-white/10 px-2.5 py-2 flex items-start gap-2.5">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/12 text-blue-600 dark:text-blue-400 text-[10px] font-semibold flex items-center justify-center">
                            {t.number}
                          </span>
                          <div className="min-w-0 flex-1">
                            {t.condition_text && <div className="text-xs text-gray-600 leading-relaxed line-clamp-2">{plainTaskMath(t.condition_text)}</div>}
                            {t.image_url && (
                              <a href={t.image_url} target="_blank" rel="noreferrer">
                                <img src={t.image_url} alt={`Задание ${t.number}`} className="mt-1 h-16 rounded-lg ring-1 ring-gray-200/70 bg-white" />
                              </a>
                            )}
                          </div>
                          <button onClick={() => handleReroll(t.number)}
                            title={isModuleNumber(examType, t.number) ? "Другой блок 1–5"
                              : linkedGroupOf(examType, t.number) ? `Другая игра для ${numbersLabel(linkedGroupOf(examType, t.number), { hash: false })}`
                              : "Другое задание этого номера"}
                            className="text-gray-400 hover:text-blue-600 active:scale-90 transition-transform flex-shrink-0">
                            <Icon name="repeat" size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    </>
                  )}
                </div>
              )}
              </div>
              </AutoHeight>
              {/* Ответы — под сборкой, в том же столбце: их сверяют последними. */}
              <div className="flex flex-col gap-4 mt-2">
              <AnswerGrid
                label={source === "bank" && bankPicked.length > 0
                  ? `Ответы части 1 — подставлены из банка, проверьте (${answerCount} шт.)`
                  : `Ответы к части 1 — по номерам заданий (${answerCount} шт.)`}
                numbers={p1Numbers}
                allowBulk={!(source === "bank" && bankPicked.length > 0)}
                valueOf={(n) => answers[n - 1] || ""}
                onChange={(n, v) => setAnswers((prev) => { const upd = [...prev]; upd[n - 1] = v; return upd })}
                hint={`Введено: ${p1Numbers.filter((n) => answers[n - 1]).length} / ${answerCount}`}
              />

              {part2Numbers.length > 0 && (
                <AnswerGrid
                  label={`Ответы к части 2 (${numbersLabel(part2Numbers)})${source === "bank" && bankPicked.length > 0 ? " — подставлены из банка" : ""}`}
                  numbers={part2Numbers}
                  allowBulk={!(source === "bank" && bankPicked.length > 0)}
                  valueOf={(n) => part2Answers[n] || ""}
                  onChange={(n, v) => setPart2Answers((prev) => ({ ...prev, [n]: v }))}
                  placeholderOf={(n) => (n === 24 ? "Доказано." : "Ответ")}
                  // Задание-доказательство с ответом «Доказано.» есть только у
                  // ОГЭ (№24). У профиля номера части 2 другие, и «№24» там
                  // обещало задание, которого в работе нет.
                  hint={`Ученик выберет ответ из четырёх вариантов; ${part2Numbers.includes(24)
                    ? "для доказательства (№24)" : "где ответ развёрнутый"} — только фото решения`}
                />
              )}
              </div>
            </div>
          </div>

          {formError && <div className="text-sm text-red-500 mt-4 text-center">{formError}</div>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-5">
            <button onClick={close} className="press-fill border border-gray-200 rounded-xl px-5 py-2.5 text-sm text-gray-600">Отмена</button>
            <button onClick={handleSubmit} disabled={loading || uploading} className="btn-primary px-6 py-2.5 disabled:opacity-50">
              {uploading ? "Загружаем файл..." : loading ? "Отправляем..."
                : recipientIds.length === 0 ? "Сохранить вариант"
                : recipientIds.length === 1 ? "Отправить ученику"
                : `Отправить ученикам (${recipientIds.length})`}
            </button>
          </div>
        </div>
      </div>

      {showPicked && (
        <TasksModal
          title={title.trim() || "Собранный вариант"}
          note="условия и ответы"
          items={variantTaskItems(bankPicked)}
          onClose={() => setShowPicked(false)}
        />
      )}
    </div>,
    document.body
  )
}

// Проверка сданного варианта — одна форма на все экзамены.
//
// Раньше форм было две: «ЕГЭ» с жёсткими заданиями 13–19 и «ОГЭ» с жёсткими
// 20–25 и геометрией. Информатика попадала то в одну, то в другую и получала
// поля несуществующих заданий: у КЕГЭ и ОГЭ по информатике части 2 нет вовсе.
// Теперь состав части 2 берётся из самого варианта, а перевод балла — из
// examScales.js.
function VariantReview({ submission, variant, onClose, onSave }) {
  const { cls: closingCls, close } = useClosing(onClose)
  const type = variant?.type || "ОГЭ"
  const part2Max = variantPart2MaxOf(variant)
  const part2Tasks = variantPart2Tasks(variant)
  // Вариант выдан до перенумерации КИМ-2027: критерии показываем по его
  // старой раскладке («№13» в такой работе — тригонометрия, «№16» — экономическая).
  const legacyProf = isLegacyProfVariant(variant)
  const [scores, setScores] = useState(part2Tasks.reduce((acc, n) => ({ ...acc, [n]: submission.part2_score_detail?.[n] ?? "" }), {}))
  const [loading, setLoading] = useState(false)
  // Критерии ФИПИ по одному номеру за раз: развёрнутые сразу все занимают
  // больше экрана, чем сама форма, а сверяются всё равно по очереди.
  const [openCriteria, setOpenCriteria] = useState(null)
  const [showNotes, setShowNotes] = useState(false)
  const notes = gradingNotesOf(type)

  // Часть 1 — по сохранённым ответам самого варианта, а не по текущему списку
  // номеров: у выданных до перенумерации профилей состав части 1 другой.
  const part1Answers = variant.answers?.part1 || []
  // Знаменатель — БАЛЛЫ части 1, а не число заданий: у КЕГЭ №26 и №27 по 2 балла.
  const part1Nums = part1Answers.map((a, i) => (a != null && a !== "" ? i + 1 : null)).filter(Boolean)
  const part1Max = variantMaxPrimary(type, part1Nums.length ? part1Nums : part1NumbersOf(type))
  // Балл части 1 считает ученик при сдаче тем же answersEqual. Пересчитываем его
  // здесь заново — иначе ручной зачёт (ниже) прибавлялся бы к уже сохранённому
  // баллу второй раз при каждом открытии проверки. У старых записей, где ответов
  // ученика нет вовсе, остаётся сохранённое число.
  const part1Auto = part1Answers.reduce(
    (n, ans, i) => n + (answersEqual(submission.part1_answers?.[i], ans) ? taskMaxOf(type, i + 1) || 1 : 0), 0)
  const part1Base = submission.part1_answers ? part1Auto : (submission.part1_score ?? 0)

  // Задания части 1, которые репетитор засчитал вручную: эталон в банке бывает
  // неверным (два верных ответа, другая допустимая запись), и тогда прав ученик.
  // Ответ ученика не подменяем — храним отдельный список номеров.
  const canCredit = submission.part1_credited !== undefined
  const [credited, setCredited] = useState(() =>
    (Array.isArray(submission.part1_credited) ? submission.part1_credited.map(Number) : []))
  const part1Score = part1Base + credited.reduce((n, num) => n + (taskMaxOf(type, num) || 1), 0)

  // Разбор части 1 — только там, где ученик ответил и не сошлось: зачитывать
  // нечего у пропущенного задания, а верные и так верны.
  const part1Wrong = part1Answers.map((correct, i) => {
    const num = i + 1
    const raw = submission.part1_answers?.[i]
    const given = raw == null ? "" : String(raw).trim()
    if (!given || correct == null || String(correct).trim() === "") return null
    if (answersEqual(given, correct)) return null
    return { num, given, correct: String(correct) }
  }).filter(Boolean)

  // Зачёт — часть проверки: он записывается вместе с баллами по «Сохранить», а не
  // сам по себе. Иначе закрытая без сохранения проверка успела бы поправить журнал
  // попыток, а балл варианта остался бы прежним.
  const toggleCredit = (num, on) =>
    setCredited((prev) => (on ? [...new Set([...prev, num])].sort((a, b) => a - b) : prev.filter((x) => x !== num)))

  const part2Total = Object.values(scores).reduce((s, v) => s + (Number(v) || 0), 0)
  const part2MaxTotal = part2Tasks.reduce((s, n) => s + part2Max[n], 0)
  const total = part1Score + part2Total

  const scale = scaleOf(type)
  const geomNums = scale?.geometryNumbers || null
  const geomScore = geomNums ? getGeomScore(submission.part1_answers, variant.answers, scores, geomNums) : null
  const variantMax = variantMaxOf(variant)
  const res = examResult(type, total, { geometry: geomScore, variantMax })

  // Файлы, которым не нашлось карточки задания (номер вне части 2 этого типа):
  // их всё равно нужно показать, иначе решение ученика молча пропадёт.
  const orphanFiles = Object.entries(submission.part2_files || {})
    .filter(([task]) => !part2Tasks.some((n) => String(n) === String(task)))

  const algebra = part2Tasks.filter((n) => !geomNums || !geomNums.includes(n))
  const geometry = geomNums ? part2Tasks.filter((n) => geomNums.includes(n)) : []

  // Строка задания части 2: выбранный учеником ответ против верного, наличие фото решения
  // и поле балла. Балл ставит только репетитор — совпадение ответа лишь подсказка.
  const renderPart2Row = (n) => {
    const chosen = submission.part2_choices?.[n]
    const correct = variant.answers?.part2?.[n]
    const file = submission.part2_files?.[n]
    // Ученик выбирал ответ по пункту б) (ответ ЕГЭ двухчастный) — сверяем с той же
    // частью, иначе верный выбор всегда показывался бы как несовпавший.
    const match = chosen != null && correct != null && String(chosen).trim() === choiceBaseOf(correct).text.trim()
    // Критерии ФИПИ для этого номера: по ним эксперт на экзамене и решает,
    // сколько ставить за неполное решение. Без них балл ставится на глаз.
    const criteria = criteriaOf(type, n, { legacyProf })
    const open = openCriteria === n
    return (
      <div key={n} className="rounded-xl ring-1 ring-gray-200/70 dark:ring-white/10 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 flex-1 min-w-0">Задание {n}</span>
          {criteria ? (
            <button type="button" onClick={() => setOpenCriteria(open ? null : n)}
              aria-expanded={open}
              className={`press-fill flex-shrink-0 text-[11px] rounded-lg px-2 py-1 ring-1 transition-colors ${open ? "bg-blue-500 text-white ring-blue-500" : "bg-blue-50 text-blue-600 ring-blue-100"}`}>
              из {part2Max[n]}
            </button>
          ) : (
            <span className="text-xs text-gray-400 flex-shrink-0">макс. {part2Max[n]}</span>
          )}
          <input type="number" min="0" max={part2Max[n]} value={scores[n]}
            onChange={(e) => setScores((prev) => ({ ...prev, [n]: e.target.value }))}
            className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-blue-400 flex-shrink-0" />
        </div>
        {/* Ответ ученика и верный — двумя подписанными строками, а не одной
            красной фразой: длинные ответы («{0} ∪ [3; +∞)») переносились и
            слипались с «верный:», прочесть было нельзя. */}
        <div className="mt-2 flex flex-col gap-1 text-xs leading-relaxed">
          {chosen == null ? (
            <div className="text-gray-400">ответ не выбран</div>
          ) : match ? (
            <div className="flex items-start gap-1.5 text-green-600">
              <Icon name="check" size={13} className="mt-0.5 flex-shrink-0" />
              <span className="min-w-0 break-words">{chosen}</span>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <span className="w-14 flex-shrink-0 text-gray-400">ответ</span>
                <span className="min-w-0 break-words text-red-500">{chosen}</span>
              </div>
              {correct != null && (
                <div className="flex items-start gap-2">
                  <span className="w-14 flex-shrink-0 text-gray-400">верный</span>
                  <span className="min-w-0 break-words text-green-600">{correct}</span>
                </div>
              )}
            </>
          )}
          {/* Решение ученика — здесь же, в карточке своего задания: отдельным
              списком «Файлы ученика» сверху приходилось держать в голове, к
              какому номеру какой файл. */}
          {file ? (
            <a href={file} target="_blank" rel="noreferrer"
              className="press-fill self-start inline-flex items-center gap-1.5 text-blue-600 rounded-lg -mx-1 px-1 py-0.5">
              <Icon name="image" size={12} className="flex-shrink-0" />
              фото решения
            </a>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-600">
              <Icon name="image" size={12} className="flex-shrink-0" />
              нет фото решения
            </div>
          )}
        </div>
        <Reveal value={open && criteria ? n : null}>
          {() => (
            <div className="mt-2.5 pt-2.5 border-t border-gray-200/70 dark:border-white/10 flex flex-col gap-2">
              {criteria.map((c) => (
                <div key={c.score} className="flex items-start gap-2.5">
                  <span className="mt-px w-5 h-5 flex-shrink-0 rounded-md bg-white ring-1 ring-gray-200 text-[11px] font-medium text-gray-600 flex items-center justify-center">{c.score}</span>
                  <span className="text-[11px] leading-relaxed text-gray-500">{c.text}</span>
                </div>
              ))}
            </div>
          )}
        </Reveal>
      </div>
    )
  }

  async function handleSave() {
    setLoading(true)
    // geom_score — колонка с двойным смыслом: у экзаменов с тестовым баллом в
    // ней лежит он (так её читают «Результаты» и кабинет ученика), у ОГЭ по
    // математике — баллы за геометрию. Отдельная колонка потребовала бы
    // миграции ради значения, которое и так однозначно выводится по типу.
    const secondary = res.kind === "test" ? res.testScore : (geomScore ?? 0)
    const base = {
      part1_score: part1Score, part2_score: part2Total, part2_score_detail: scores,
      total_score: total, geom_score: secondary, status: "graded",
    }
    let { error } = await supabase.from("variant_submissions")
      .update(canCredit ? { ...base, part1_credited: credited } : base).eq("id", submission.id)
    // Колонка part1_credited приходит миграцией supabase/manual_credit.sql. Если
    // её нет, проверку это ронять не должно — сохраняем баллы, как раньше.
    if (error && canCredit) ({ error } = await supabase.from("variant_submissions").update(base).eq("id", submission.id))
    if (!error) {
      // Журнал попыток: зачтённое задание перестаёт быть ошибкой и в аналитике —
      // иначе типаж, в котором ошибся генератор, навсегда остался бы у ученика
      // слабым. Правим только изменившиеся номера; отказ (нет миграции) молча
      // пропускаем, проверку это ронять не должно.
      const before = new Set(Array.isArray(submission.part1_credited) ? submission.part1_credited.map(Number) : [])
      const after = new Set(credited)
      const changed = [...new Set([...before, ...after])].filter((n) => before.has(n) !== after.has(n))
      await Promise.all(changed.map((num) => supabase.rpc("task_attempt_credit", {
        p_source: "variant", p_source_id: submission.id, p_number: num,
        p_answer: part1Wrong.find((r) => r.num === num)?.given ?? null, p_correct: after.has(num),
      }).then(() => {}, () => {})))
      await supabase.from("notifications").insert({
        user_id: submission.student_id, title: "Вариант проверен",
        body: `Первичный балл: ${total} из ${variantMax}, ${secondaryLabel(res)}`,
      })
      onSave(); close()
    }
    setLoading(false)
  }

  return createPortal(
    <div className={`fixed inset-0 glass-overlay z-50 overflow-y-auto ${closingCls}`}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div className={`glass-modal p-6 w-full max-w-2xl ${closingCls}`}>
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-medium">Проверка · {type}</h2>
            <button onClick={close} aria-label="Закрыть" className="text-gray-500 hover:text-gray-700"><Icon name="x" size={18} /></button>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <div className="text-sm font-medium text-blue-700">Часть 1: {part1Score} / {part1Max} {plural(part1Max, "балл", "балла", "баллов")}</div>
          </div>

          {/* Часть 1 проверяется сверкой строк, и до сих пор репетитор видел от неё
              только итог. Ошибки нужно видеть по номерам: эталон приходит из
              генератора банка и иногда сам неверен (у задания два верных ответа,
              другая допустимая запись). Тогда прав ученик — и репетитор засчитывает
              задание руками, а не спорит с автопроверкой. */}
          {part1Wrong.length > 0 && (
            <div className="mb-4">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <label className="text-sm text-gray-500">Ошибки части 1</label>
                {canCredit && <span className="text-[11px] text-gray-400">эталон банка бывает неверным — такое задание можно засчитать</span>}
              </div>
              <div className="flex flex-col gap-2">
                {part1Wrong.map(({ num, given, correct }) => {
                  const byHand = credited.includes(num)
                  return (
                    <div key={num} className="rounded-xl ring-1 ring-gray-200/70 dark:ring-white/10 px-3 py-2.5 flex items-start gap-3">
                      <div className="min-w-0 flex-1 flex flex-col gap-1">
                        <div className="text-sm text-gray-600">Задание {num}</div>
                        <div className="flex items-start gap-2 text-xs">
                          <span className="w-14 flex-shrink-0 text-gray-400">ответ</span>
                          <span className={`min-w-0 break-words ${byHand ? "text-green-600" : "text-red-500"}`}>{given}</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs">
                          <span className="w-14 flex-shrink-0 text-gray-400">эталон</span>
                          <span className="min-w-0 break-words text-gray-700">{correct}</span>
                        </div>
                        {byHand && (
                          <span className="self-start inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-500/12 text-green-700 dark:text-green-300 ring-1 ring-green-500/25">
                            <Icon name="check" size={10} />Засчитано · {taskMaxOf(type, num) || 1} {plural(taskMaxOf(type, num) || 1, "балл", "балла", "баллов")}
                          </span>
                        )}
                      </div>
                      {canCredit && (
                        <button type="button" onClick={() => toggleCredit(num, !byHand)}
                          title={byHand ? "Снять зачёт: задание снова считается ошибкой" : "Ответ ученика верен, а эталон банка ошибочен — засчитать задание"}
                          className={`press-fill flex-shrink-0 text-[11px] rounded-lg px-2.5 py-1 ring-1 ${byHand
                            ? "text-gray-500 ring-gray-500/20 hover:text-red-500"
                            : "text-blue-600 ring-blue-500/25 hover:bg-blue-500/[0.06]"}`}>
                          {byHand ? "Отменить зачёт" : "Засчитать"}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {submission.auto_submitted && (
            <div className="flex items-start gap-1.5 text-xs text-amber-600 mb-4">
              <Icon name="clock" size={12} className="mt-0.5 flex-shrink-0" />
              Работа ушла на проверку автоматически: время экзамена вышло, часть ответов ученик мог не успеть вписать.
            </div>
          )}
          {orphanFiles.length > 0 && (
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-2 block">Файлы ученика</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {orphanFiles.map(([task, url]) => (
                  <a key={task} href={url} target="_blank" rel="noreferrer" className="press-fill text-sm text-blue-600 rounded-lg px-3 py-2 ring-1 ring-gray-200/70 dark:ring-white/10">
                    Задание {task}
                  </a>
                ))}
              </div>
            </div>
          )}
          {part2Tasks.length > 0 && (
            <div className="mb-4">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <label className="text-sm text-gray-500">Баллы за часть 2</label>
                {notes && (
                  <button type="button" onClick={() => setShowNotes((v) => !v)} aria-expanded={showNotes}
                    className="press-fill text-[11px] text-gray-500 hover:text-gray-700 rounded-lg px-1.5 py-0.5">
                    {showNotes ? "скрыть требования" : "общие требования"}
                  </button>
                )}
              </div>
              <Reveal value={showNotes && notes ? notes : null}>
                {(list) => (
                  <ul className="mb-3 rounded-xl ring-1 ring-gray-200/70 dark:ring-white/10 p-3 flex flex-col gap-1.5">
                    {list.map((t) => (
                      <li key={t} className="text-[11px] leading-relaxed text-gray-500">{t}</li>
                    ))}
                  </ul>
                )}
              </Reveal>
              {geometry.length > 0 ? (
                <>
                  <div className="mb-3">
                    <div className="text-xs font-medium text-blue-600 mb-2 bg-blue-50 px-2 py-1 rounded">Алгебра {algebra[0]}–{algebra[algebra.length - 1]}</div>
                    <div className="grid gap-2 sm:grid-cols-2 items-start">{algebra.map(renderPart2Row)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-purple-600 mb-2 bg-purple-50 px-2 py-1 rounded">Геометрия {geometry[0]}–{geometry[geometry.length - 1]}</div>
                    <div className="grid gap-2 sm:grid-cols-2 items-start">{geometry.map(renderPart2Row)}</div>
                  </div>
                </>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 items-start">{part2Tasks.map(renderPart2Row)}</div>
              )}
            </div>
          )}
          <div className="rounded-xl ring-1 ring-gray-200/70 dark:ring-white/10 p-4 mb-4">
            <div className="flex justify-between mb-2"><span className="text-sm text-gray-600">Часть 1</span><span className="text-sm font-medium">{part1Score} / {part1Max}</span></div>
            {part2Tasks.length > 0 && (
              <div className="flex justify-between mb-2"><span className="text-sm text-gray-600">Часть 2</span><span className="text-sm font-medium">{part2Total} / {part2MaxTotal}</span></div>
            )}
            {geomScore !== null && (
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Геометрия итого</span>
                <span className={geomScore < scale.geometryMin ? "text-sm font-medium text-red-600" : "text-sm font-medium text-green-600"}>
                  {geomScore} {geomScore < scale.geometryMin ? "!" : "ok"}
                </span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
              <span className="text-sm font-medium">Первичный балл</span>
              <span className="text-xl font-medium">{total} <span className="text-sm font-normal text-gray-400">/ {variantMax}</span></span>
            </div>
            {res.kind !== "none" && (
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-400">{res.kind === "test" ? "Тестовый балл" : "Оценка"}</span>
                <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {secondaryLabel(res, { short: true })}
                </span>
              </div>
            )}
            {res.projected && (
              <div className="text-[11px] text-gray-400 mt-2 leading-snug">
                Прогноз: в варианте {variantMax} {plural(variantMax, "балл", "балла", "баллов")} из {res.examMax} экзаменационных,
                поэтому {res.kind === "test" ? "тестовый балл" : "оценка"} пересчитан по доле выполнения.
              </div>
            )}
          </div>
          <div className="flex gap-3 sm:justify-end">
            <button onClick={close} className="flex-1 sm:flex-none sm:px-6 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600">Отмена</button>
            <button onClick={handleSave} disabled={loading} className="flex-1 sm:flex-none sm:px-6 btn-primary py-2.5 disabled:opacity-50">
              {loading ? "Сохраняем..." : "Сохранить и уведомить"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}



// Фильтр по ученику — ВЫПАДАЮЩИМ списком, а не лентой фишек: учеников бывают
// десятки, лента прокручивалась вбок (часть имён была не видна вовсе) и своим
// overflow срезала кольцо крайних фишек. В списке видно сразу всех.
// Кнопка сложена ТАК ЖЕ, как соседний сегмент-контрол «Все / ОГЭ / ЕГЭ»
// (SegmentSwitch, размер sm): рамка + p-1 вокруг содержимого в 32px, скругление
// rounded-2xl, шрифт text-sm font-semibold. Задавать вместо этого свою высоту
// нельзя — она разошлась бы с соседом на пару пикселей, и кнопка читалась бы
// съехавшей.
function StudentFilter({ options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const { closing, close, cancel } = useClosing(() => setOpen(false), POPUP_OUT_MS)
  const wrapRef = useRef(null)
  const current = options.find((o) => o.id === value) || options[0]

  // Закрытие по клику мимо и по Escape: список перекрывает карточки, и уйти от
  // него нужно тем же движением, что и от любого меню на сайте.
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) close() }
    const onKey = (e) => { if (e.key === "Escape") close() }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, close])

  const bubble = (o, size) => {
    if (o.id === "all") {
      return (
        <span className={`${size} rounded-full flex items-center justify-center bg-blue-500/12 text-blue-600 flex-shrink-0`}>
          <Icon name="users" size={14} />
        </span>
      )
    }
    const color = getAvatarColor(o.name)
    return (
      <span className={`${size} rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${color.bg} ${color.text}`}>
        {getInitials(o.name)}
      </span>
    )
  }

  return (
    <div ref={wrapRef} className="relative self-start">
      <button
        type="button"
        onClick={() => { if (open) close(); else { cancel(); setOpen(true) } }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`press-fill flex items-center gap-2 p-1 pr-3 rounded-2xl border text-sm font-semibold transition-colors ${
          value === "all"
            ? "text-gray-500 border-gray-200/70 dark:border-white/10 hover:text-blue-600 hover:border-blue-500/25"
            : "text-blue-600 bg-blue-500/12 border-blue-500/25"
        }`}
      >
        {bubble(current, "w-8 h-8")}
        <span className="truncate max-w-[11rem]">{current.name}</span>
        <Icon name="chevron-down" size={14} className={`flex-shrink-0 transition-transform duration-300 ${open && !closing ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{ transformOrigin: "top left" }}
          className={`absolute left-0 top-full mt-2 z-30 w-64 max-h-80 overflow-y-auto glass-modal rounded-2xl shadow-xl p-1.5 flex flex-col gap-0.5 ${closing ? "popup-bubble-out" : "popup-bubble"}`}
        >
          {options.map((o) => {
            const on = o.id === value
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => { onChange(o.id); close() }}
                className={`press-fill flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13px] transition-colors ${
                  on ? "text-blue-600 bg-blue-500/10" : "text-gray-600 hover:bg-blue-500/[0.06]"
                }`}
              >
                {bubble(o, "w-7 h-7")}
                <span className="flex-1 min-w-0 truncate font-medium">{o.name}</span>
                {o.count != null && <span className="text-[11px] text-gray-400 tabular-nums flex-shrink-0">{o.count}</span>}
                {on && <Icon name="check" size={14} className="flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Срок сдачи варианта: прошёл ли он и как назвать дату. Вариант «просрочен»
// только пока его кто-то ещё не сдал: у сданной работы дата уже ничего не
// решает, а красная метка на ней читалась бы как претензия.
function variantOverdue(v, pending) {
  if (!v.deadline || pending <= 0) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return parseLocalDate(v.deadline) < today
}

const dayMonth = (date) =>
  parseLocalDate(date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })

// Правка варианта — отдельным окном, как «Редактировать задание» у домашней
// работы. В самом разборе этих настроек быть не должно: разбор показывает, как
// вариант написали ученики, а панель правки читалась там как ещё одно свойство
// работы.
//
// Что здесь можно: срок сдачи, состав получателей и пересборка отдельного
// задания. Всё, кроме пересборки, применяется по «Сохранить» — одно окно, одна
// кнопка; отмена не оставляет следов.
function EditVariantModal({ variant, accounts, submissions, signal, onClose, onSaved }) {
  const { cls: closingCls, close, cancel } = useClosing(onClose)
  // Уход окна длится 240 мс, и всё это время оно ещё в дереве, а отложенный
  // onClose ждёт своей очереди. Нажатие «Изменить» в эту щель ничего не
  // меняло — окно уже «открыто», — а потом срабатывал таймер и закрывал его:
  // кнопка выглядела сломанной, но только если нажать сразу после закрытия.
  // Поэтому каждое нажатие шлёт сигнал, а сигнал отменяет уход.
  useEffect(() => { cancel() }, [signal, cancel])
  const [deadline, setDeadline] = useState(variant.deadline || "")
  const [tasks, setTasks] = useState(variant.tasks_snapshot || null)
  const [answers, setAnswers] = useState(variant.answers || {})
  const [tasksTouched, setTasksTouched] = useState(false)
  const [rerolling, setRerolling] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Работа, к которой ученик уже притронулся (открыл таймер, сдал, проверена).
  // Её нельзя ни отозвать, ни пересобрать под ней задания: отзыв стёр бы ответы
  // и баллы, а замена задания оставила бы ученику ответы к варианту, которого он
  // больше не видит.
  const busy = submissions.filter((s) => s.status !== "pending" || s.opened_at)
  const lockedIds = busy.map((s) => String(s.student_id))
  const [recipientIds, setRecipientIds] = useState(() => submissions.map((s) => String(s.student_id)))

  const busyNote = (id) => {
    const s = busy.find((x) => String(x.student_id) === String(id))
    if (!s) return ""
    return s.status === "graded" ? "работа проверена — выдачу не отозвать"
      : s.status === "submitted" ? "работа сдана — выдачу не отозвать"
        : "уже решает — выдачу не отозвать"
  }

  async function handleReroll(number) {
    if (busy.length > 0 || !tasks) return
    setError("")
    setRerolling(number)
    try {
      const { rerollModule, rerollTask, rerollLinked } = await loadBank()
      // Задания 1–5 ОГЭ — связанный модуль, а №19–21 КЕГЭ — одна игра на три
      // задания: заменять их можно только целиком, иначе соседи остаются со
      // ссылкой на условие, которого в варианте больше нет.
      const linked = linkedGroupOf(variant.type, number)
      let fresh
      if (isModuleNumber(variant.type, number)) fresh = rerollModule(variant.type)
      else if (linked) fresh = rerollLinked(variant.type, linked)
      else {
        // У снимка нет id задания, по которому rerollTask исключает текущее,
        // поэтому задание из таблицы банка может выпасть тем же самым.
        // Сверяем условие и просим ещё раз — но не бесконечно: в номере может
        // быть всего одно задание, и тогда повтор честнее пустоты.
        const was = tasks.find((t) => t.number === number)?.condition_text
        let next = null
        for (let i = 0; i < 4; i++) {
          next = await rerollTask(variant.type, number)
          if (!next || !was || next.condition_text !== was) break
        }
        fresh = [next]
      }
      const list = (fresh || []).filter(Boolean)
      if (!list.length) { setError("Не нашлось другого задания этого номера."); return }

      const byNum = new Map(list.map((t) => [t.number, t]))
      setTasks((prev) => prev.map((t) => (byNum.has(t.number) ? packVariantTask(byNum.get(t.number)) : t)))
      // Ответы варианта лежат отдельно от заданий, и без этого шага вариант
      // проверялся бы по эталону прежнего задания.
      setAnswers((prev) => {
        const next = {
          ...prev,
          part1: [...(prev.part1 || [])],
          part2: { ...(prev.part2 || {}) },
          part2_choices: { ...(prev.part2_choices || {}) },
          part2_choices_part: { ...(prev.part2_choices_part || {}) },
        }
        for (const t of list) {
          if (isPart2Number(variant.type, t.number)) {
            next.part2[t.number] = t.answer
            if (t.choices) next.part2_choices[t.number] = t.choices
            if (t.choices_part) next.part2_choices_part[t.number] = t.choices_part
          } else {
            next.part1[t.number - 1] = t.answer
          }
        }
        return next
      })
      setTasksTouched(true)
    } catch {
      setError("Банк заданий не отвечает — попробуйте ещё раз.")
    } finally {
      setRerolling(null)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError("")

    const patch = { deadline: deadline || null }
    if (tasksTouched && tasks) { patch.tasks_snapshot = tasks; patch.answers = answers }
    let { error: err } = await supabase.from("variants").update(patch).eq("id", variant.id)
    // База без миграции срока (supabase/variant_deadline.sql) — сохраняем
    // остальное: забытая миграция не должна мешать правке состава.
    if (err?.code === "PGRST204" || /deadline/i.test(err?.message || "")) {
      const { deadline: _skip, ...rest } = patch
      void _skip
      ;({ error: err } = Object.keys(rest).length
        ? await supabase.from("variants").update(rest).eq("id", variant.id)
        : { error: null })
    }
    if (err) { setError("Не получилось сохранить: " + err.message); setSaving(false); return }

    // Состав получателей: снятым выдачу удаляем, добавленным заводим работу и
    // уведомление — тем же, каким вариант приходит при выдаче.
    const wanted = new Set(recipientIds)
    const added = [...wanted].filter((id) => !submissions.some((s) => String(s.student_id) === id))
    const removed = submissions.filter((s) => !wanted.has(String(s.student_id)) && !lockedIds.includes(String(s.student_id)))
    if (removed.length > 0) {
      const { error: delErr } = await supabase.from("variant_submissions").delete().in("id", removed.map((s) => s.id))
      if (delErr) { setError("Не получилось убрать ученика: " + delErr.message); setSaving(false); return }
    }
    if (added.length > 0) {
      const { error: insErr } = await supabase.from("variant_submissions")
        .insert(added.map((id) => ({ variant_id: variant.id, student_id: id, status: "pending" })))
      if (insErr) { setError("Не получилось выдать вариант: " + insErr.message); setSaving(false); return }
      await supabase.from("notifications").insert(added.map((id) => ({
        user_id: id,
        title: "Новый вариант " + variant.type,
        body: "Репетитор отправил новый вариант: " + variant.title
          + (deadline ? ". Сдать до " + dayMonth(deadline) : ""),
      })))
    }

    setSaving(false)
    onSaved()
    close()
  }

  return createPortal(
    <div className={`fixed inset-0 glass-overlay z-50 overflow-y-auto ${closingCls}`}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div className={`glass-modal p-6 w-full max-w-lg ${closingCls}`}>
          <div className="flex justify-between items-start gap-3 mb-5">
            <div className="min-w-0">
              <h2 className="text-lg font-medium">Редактировать вариант</h2>
              <div className="text-xs text-gray-400 truncate mt-0.5">{variant.title}</div>
            </div>
            <button onClick={close} aria-label="Закрыть" className="text-gray-500 hover:text-gray-700 flex-shrink-0"><Icon name="x" size={18} /></button>
          </div>

          <div className="flex flex-col gap-5">
            {/* Срок стоит на самом варианте, а не на выдаче ученику: вариант
                выдаётся всем сразу одной строкой. */}
            <DeadlinePicker
              value={deadline}
              onChange={setDeadline}
              label={deadline ? `Ученик видит: до ${dayMonth(deadline)}` : "Без срока"}
            />

            <StudentPicker
              accounts={accounts}
              value={recipientIds}
              onChange={setRecipientIds}
              lockedIds={lockedIds}
              noteOf={(a) => busyNote(a.id)}
              label="Кому задан вариант"
              empty="Учеников пока нет"
            />

            {tasks?.length > 0 && (
              <div>
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <div className="text-sm text-gray-500">Задания · {tasks.length}</div>
                  {busy.length === 0 && <div className="text-[11px] text-gray-400">Заменить — значок повтора</div>}
                </div>
                {busy.length > 0 ? (
                  <div className="rounded-xl ring-1 ring-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
                    Задания уже нельзя пересобрать: вариант открыли {busy.length} {plural(busy.length, "ученик", "ученика", "учеников")}.
                    Замена оставила бы их с ответами к заданиям, которых они больше не увидят.
                  </div>
                ) : (
                  // Пиксель запаса со всех сторон: кольцо рисуется box-shadow'ом
                  // снаружи карточки, и прокрутка срезала бы его у крайних.
                  <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto p-px -m-px">
                    {tasks.map((t, i) => (
                      <div key={t.number ?? i} className="rounded-xl ring-1 ring-gray-200/70 dark:ring-white/10 px-2.5 py-2 flex items-start gap-2.5">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/12 text-blue-600 dark:text-blue-400 text-[10px] font-semibold flex items-center justify-center">
                          {t.number ?? i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          {t.condition_text && <div className="text-xs text-gray-600 leading-relaxed line-clamp-2">{plainTaskMath(t.condition_text)}</div>}
                          {t.image_url && (
                            <img src={t.image_url} alt={`Задание ${t.number ?? i + 1}`} className="mt-1 h-14 rounded-lg ring-1 ring-gray-200/70 bg-white" />
                          )}
                        </div>
                        <button type="button" onClick={() => handleReroll(t.number)} disabled={rerolling != null}
                          title={isModuleNumber(variant.type, t.number) ? "Другой блок 1–5"
                            : linkedGroupOf(variant.type, t.number) ? `Другая игра для ${numbersLabel(linkedGroupOf(variant.type, t.number), { hash: false })}`
                              : "Другое задание этого номера"}
                          aria-label="Пересобрать задание"
                          className={`flex-shrink-0 text-gray-400 hover:text-blue-600 active:scale-90 transition-transform disabled:opacity-40 ${rerolling === t.number ? "animate-spin text-blue-600" : ""}`}>
                          <Icon name="repeat" size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {tasksTouched && (
                  <div className="text-[11px] text-blue-600 mt-2">Ответы к заменённым заданиям подставлены заново — сохраните вариант.</div>
                )}
              </div>
            )}
          </div>

          {error && <div className="text-sm text-red-500 mt-4 text-center">{error}</div>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
            <button onClick={close} className="press-fill border border-gray-200 rounded-xl px-5 py-2.5 text-sm text-gray-600">Отмена</button>
            <button onClick={handleSave} disabled={saving || rerolling != null} className="btn-primary px-6 py-2.5 disabled:opacity-50">
              {saving ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Карточка варианта — того же склада, что карточка задания (Homework.jsx):
// плитка слева кодирует, на каком этапе работа, состояние написано один раз
// чипом, а действия (файл, удаление) живут в развороте, а не на каждой
// карточке. Разделы кабинета отличаются содержимым, а не оформлением.
function VariantCard({ variant: v, total, graded, submitted, selected, onOpen }) {
  const tileBox = "w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center bg-gradient-to-br"
  // Этап жизни варианта: не выдан → выдан → работы ждут проверки → всё проверено.
  const state = total === 0 ? "idle"
    : submitted > 0 ? "review"
      : graded === total ? "done"
        : "given"
  const pending = total - graded - submitted
  const overdue = variantOverdue(v, pending)
  // Плитка — тот же якорь, что у задания: пока работу ещё ждут, на ней стоит
  // срок (цвет — срочность), дальше её место занимает этап проверки.
  const tile = state === "done"
    ? <div className={`${tileBox} ${TILE_TINTS.green}`}><Icon name="check" size={18} /></div>
    : state === "review"
      ? <div className={`${tileBox} ${TILE_TINTS.indigo}`}><Icon name="clock" size={18} /></div>
      : v.deadline && pending > 0
        ? <DateTile date={v.deadline} tint={TILE_TINTS[dueTintKey(v.deadline)]} className="w-12 h-12" />
        : state === "given"
          ? <div className={`${tileBox} ${TILE_TINTS.blue}`}><Icon name="clipboard" size={18} /></div>
          : <div className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-gray-400 ring-1 ring-gray-200/70 dark:ring-white/10"><Icon name="clipboard" size={17} /></div>
  const chip = state === "done" ? { label: "Проверено", cls: "text-green-600 bg-green-500/12 ring-1 ring-green-500/20" }
    : state === "review" ? { label: `${submitted} на проверке`, cls: "text-amber-600 bg-amber-500/12 ring-1 ring-amber-500/20" }
      : state === "given" ? { label: "Выдан", cls: "text-blue-600 bg-blue-500/10 ring-1 ring-blue-500/20" }
        : { label: "Не выдан", cls: "text-gray-500 ring-1 ring-gray-200/80 dark:ring-white/15" }
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
          <span className="font-medium text-sm truncate flex-1">{v.title}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${chip.cls}`}>{chip.label}</span>
        </div>
        <div className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
          {/* Тип экзамена стоит первым: он и есть «что это за работа». */}
          <span className={isEgeType(v.type) ? "text-purple-600 dark:text-purple-300 font-medium" : "text-blue-600 dark:text-blue-300 font-medium"}>{v.type}</span>
          <span className="opacity-50">·</span>
          <span>{new Date(v.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span>
          {total > 0 && <><span className="opacity-50">·</span><span>{total} {plural(total, "ученик", "ученика", "учеников")}</span></>}
          {v.deadline && !overdue && state !== "done" && <><span className="opacity-50">·</span><span>до {dayMonth(v.deadline)}</span></>}
          {overdue && <><span className="opacity-50">·</span><span className="text-red-500 font-medium">просрочено</span></>}
          {v.file_url && <><span className="opacity-50">·</span><span className="inline-flex items-center gap-1"><Icon name="paperclip" size={11} />файл</span></>}
          {/* «Проверено всё» уже сказано чипом — в строке остаётся только
              незаконченная проверка. */}
          {graded > 0 && graded < total && <><span className="opacity-50">·</span><span className="text-blue-600 dark:text-blue-400 font-medium">{graded} из {total} проверено</span></>}
        </div>
      </div>
    </button>
  )
}

function Variants({ user, students = [] }) {
  const [variants, setVariants] = useState([])
  // Аккаунты учеников — для окна правки: там перевыбирают, кому задан вариант.
  const accounts = useStudentAccounts(user.id)
  const [submissions, setSubmissions] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  // Печатная тетрадь по номерам экзамена. Раньше открывалась только из
  // «Банка заданий», а он виден одному владельцу платформы.
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  // Счётчик нажатий «Изменить»: по нему окно отменяет свой уход, если его
  // открыли заново, пока оно ещё гаснет (см. EditVariantModal).
  const [editSignal, setEditSignal] = useState(0)
  // Заодно отменяем уход самого разбора: карточку часто нажимают ещё раз, а
  // потом тянутся к карандашу — панель в эти 240 мс видна, и без отмены её
  // отложенное закрытие снимало бы и панель, и только что открытое окно.
  const openEdit = () => { cancelDetailClose(); setEditOpen(true); setEditSignal((n) => n + 1) }
  const { cls: previewCls, close: closePreview } = useClosing(() => setPreviewFile(null))

  // Сборка вариантов — возможность платных тарифов. Уже выданные варианты
  // остаются доступными: тариф ограничивает создание нового, а не историю.
  const { allows, openPlans } = usePlan()
  const canVariants = allows("variants")
  const [selectedVariant, setSelectedVariant] = useState(null)
  // Разбор сворачивается плавно: панель уезжает вниз и только потом снимается
  // (см. src/useClosing.js). Раньше она пропадала в тот же кадр, что и нажатие.
  // Разбор закрывается — вместе с ним и окно правки: иначе оно осталось бы
  // висеть без варианта, к которому относится.
  const { cls: detailCls, close: closeDetail, cancel: cancelDetailClose } = useClosing(() => { setSelectedVariant(null); setEditOpen(false) })
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [previewFile, setPreviewFile] = useState(null)
  const [group, setGroup] = useState("all")
  const [stat, setStat] = useState("all")
  const [who, setWho] = useState("all")
  // Сколько карточек в ряду прямо сейчас — нужно, чтобы вставить разбор ПОСЛЕ
  // ряда выбранной карточки. Пороги обязаны совпадать с классами сетки ниже
  // (sm:grid-cols-2 xl:grid-cols-3), иначе панель разорвёт ряд.
  const cols = useGridCols()

  useEffect(() => { loadData() }, [])
  // Банк заданий сам по себе не нужен для показа списка — подтягиваем его фоном,
  // когда браузер освободится, чтобы «Собрать вариант» открывалось без ожидания.
  useEffect(() => { if (canVariants) prefetchBank() }, [canVariants])

  async function loadData({ silent } = {}) {
    if (!silent) setLoading(true)
    const { data: v } = await supabase.from("variants").select("*").eq("tutor_id", user.id).order("created_at", { ascending: false })
    const { data: s } = await supabase.from("variant_submissions").select("*, student_accounts(name, email)").in("variant_id", (v || []).map((x) => x.id))
    // Бакет `variants` приватный: PDF варианта и фото решений части 2 —
    // рабочие файлы учеников, отдаём по временной подписанной ссылке.
    const signed = await signRows(v || [], { file_url: "variants" })
    setVariants(signed)
    // Открытый разбор пересобираем из свежих данных: он держит СВОЮ копию
    // варианта, и после правки в окне редактирования показывал бы прежний срок
    // и прежние задания.
    setSelectedVariant((prev) => (prev ? signed.find((x) => x.id === prev.id) || prev : prev))
    setSubmissions(await signRows(s || [], { part2_files: "variants" }))
    setLoading(false)
  }

  async function deleteVariant(v) {
    setConfirmDelete(null)
    await supabase.from("variant_submissions").delete().eq("variant_id", v.id)
    await supabase.from("variants").delete().eq("id", v.id)
    setVariants((prev) => prev.filter((x) => x.id !== v.id))
    // Работы удалённого варианта убираем из стейта вместе с ним. Раньше они
    // там оставались, и плитки продолжали считать их: «Ждут проверки 1» при
    // пустом списке — вариант, к которому эта работа относилась, уже стёрт.
    // По той же причине в фильтре учеников висели те, у кого работ не осталось.
    setSubmissions((prev) => prev.filter((s) => s.variant_id !== v.id))
    if (selectedVariant && selectedVariant.id === v.id) setSelectedVariant(null)
  }

  const variantSubmissions = selectedVariant ? submissions.filter((s) => s.variant_id === selectedVariant.id) : []

  // Фильтр по экзамену — как на «Результатах». Базовый и профильный ЕГЭ идут
  // одной группой: в списке они помечены одним и тем же типом «ЕГЭ».
  // Кнопки показываем только когда в списке есть оба экзамена: с одним
  // «Все» и «ОГЭ» выбирали бы одно и то же.
  const groupOf = (v) => (isEgeType(v.type) ? "ЕГЭ" : "ОГЭ")
  const GROUPS = [
    { key: "all", label: "Все" },
    { key: "ОГЭ", label: "ОГЭ" },
    { key: "ЕГЭ", label: "ЕГЭ" },
  ].filter((g) => g.key === "all" || variants.some((v) => groupOf(v) === g.key))
  // Плитки сводки работают как фильтр: «Ждут проверки» оставляет варианты,
  // где есть несданная работа. Иначе число в плитке видно, а дойти до этих
  // работ можно только перебором карточек.
  const hasStatus = (v, st) => submissions.some((s) => s.variant_id === v.id && s.status === st)
  const matchStat = (v) => (
    stat === "pending" ? hasStatus(v, "submitted")
      : stat === "graded" ? hasStatus(v, "graded")
        : true
  )
  // Фильтр по ученику: «какие варианты я задавал вот этому». Список берём из
  // самих работ, а не из карточек учеников, — тогда в нём нет тех, кому вариант
  // ни разу не выдавали, и выбрать заведомо пустой фильтр невозможно.
  const whoList = (() => {
    const byId = new Map()
    for (const s of submissions) {
      const id = String(s.student_id)
      const cur = byId.get(id) || { id, name: s.student_accounts?.name || s.student_accounts?.email || "Без имени", count: 0 }
      cur.count += 1
      byId.set(id, cur)
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"))
  })()
  const hasStudent = (v, id) => submissions.some((s) => s.variant_id === v.id && String(s.student_id) === id)
  const matchWho = (v) => who === "all" || hasStudent(v, who)
  const whoName = whoList.find((s) => s.id === who)?.name || ""
  // Плитки — тоже фильтр, поэтому их числа считаются в тех же границах, что и
  // список: по выбранной группе и выбранному ученику. Считая по всем работам,
  // плитка обещала бы работы, которых в этих границах нет, и нажатие приводило
  // бы к пустому списку.
  const scoped = variants.filter((v) => (group === "all" || groupOf(v) === group) && matchWho(v))
  const scopedIds = new Set(scoped.map((v) => v.id))
  const totalPending = submissions.filter((s) => scopedIds.has(s.variant_id) && s.status === "submitted").length
  const totalGraded = submissions.filter((s) => scopedIds.has(s.variant_id) && s.status === "graded").length
  const visible = scoped.filter(matchStat)

  function renderScore(sub) {
    // opened_at ставится при старте таймера — значит, ученик уже сидит за вариантом.
    if (sub.status === "pending") return sub.opened_at ? "Решает — время идёт" : "Ещё не выполнял"
    if (sub.status === "submitted") return "Часть 1 сдана · ждёт проверки" + (sub.auto_submitted ? " · время вышло" : "")
    const res = submissionResult(selectedVariant, sub)
    return `Первичный: ${sub.total_score} из ${res.variantMax} · ${secondaryLabel(res)}`
  }

  // Разбор выбранного варианта раскрывается прямо под его рядом карточек:
  // так он всегда рядом с тем, что открыли, и не нужно ни второй колонки,
  // ни прокрутки к панели в конце списка.
  const selectedIndex = selectedVariant ? visible.findIndex((v) => v.id === selectedVariant.id) : -1
  const detailRowEnd = detailRowEndOf(selectedIndex, visible.length, cols)

  // Обёртка .detail-row сворачивает ВЫСОТУ ряда теми же кадрами, что панель
  // гаснет: без неё карточки под разбором стояли на месте и прыгали вверх
  // одним кадром после его снятия.
  const detailPanel = selectedVariant ? (
    <div className={`col-span-full detail-row ${detailCls}`}>
    <div className="min-h-0 overflow-hidden">
    <div className={`glass overflow-hidden slide-up ${detailCls}`}>
              <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-base truncate">{selectedVariant.title}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ring-1 ${isEgeType(selectedVariant.type) ? "text-purple-600 bg-purple-500/10 ring-purple-500/20" : "text-blue-600 bg-blue-500/10 ring-blue-500/20"}`}>{selectedVariant.type}</span>
                  {selectedVariant.deadline && (
                    <span className="text-[11px] text-gray-400 flex-shrink-0 hidden sm:inline">до {dayMonth(selectedVariant.deadline)}</span>
                  )}
                </div>
                {/* Действия варианта живут здесь, а не на каждой карточке: в
                    списке они шумели, а удалять вариант вслепую, не открыв его,
                    и не нужно. Так же устроен разбор задания. */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-gray-400 hidden sm:flex items-center gap-1.5">
                    <Icon name="users" size={12} />
                    {variantSubmissions.length} {plural(variantSubmissions.length, "ученик", "ученика", "учеников")}
                  </span>
                  {selectedVariant.file_url && (
                    <button onClick={() => setPreviewFile(selectedVariant.file_url)} title="Файл варианта"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors">
                      <Icon name="paperclip" size={15} />
                    </button>
                  )}
                  <button onClick={openEdit} aria-label="Редактировать вариант" title="Редактировать вариант"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors">
                    <Icon name="edit" size={15} />
                  </button>
                  <button onClick={() => setConfirmDelete(selectedVariant)} aria-label="Удалить вариант" title="Удалить вариант"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <Icon name="trash" size={15} />
                  </button>
                  <button onClick={closeDetail} title="Свернуть"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors">
                    <Icon name="x" size={15} />
                  </button>
                </div>
              </div>

              {/* Две колонки: раньше каждая секция шла полосой во всю ширину,
                  и справа от короткого содержимого оставалось пустое поле. У
                  варианта без заданий из банка колонка одна — вторая половина
                  ряда иначе стояла бы пустой. */}
              <div className={`grid grid-cols-1 ${selectedVariant.tasks_snapshot?.length > 0 ? "xl:grid-cols-2" : ""} gap-4 px-5 py-4 border-t border-gray-100/60 dark:border-white/10 items-start`}>
              {selectedVariant.tasks_snapshot?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="section-label mb-0.5">Материалы</div>
                  <BankTasksBlock key={selectedVariant.id} tasks={selectedVariant.tasks_snapshot} title={selectedVariant.title} />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="section-label mb-0.5">Ученики</div>
                <div className="flex flex-col gap-2">
                {variantSubmissions.length === 0 ? (
                  <div className="rounded-2xl ring-1 ring-dashed ring-gray-200/80 dark:ring-white/10 text-sm text-gray-400 text-center py-8">Вариант ещё никому не выдан</div>
                ) : variantSubmissions.map((sub) => {
                  const name = sub.student_accounts?.name || sub.student_accounts?.email || ""
                  const color = getAvatarColor(name)
                  return (
                    <div key={sub.id} className="flex items-center gap-3 ring-1 ring-gray-200/70 dark:ring-white/10 bg-white/45 dark:bg-white/[0.03] rounded-2xl p-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${color.bg} ${color.text}`}>
                        {getInitials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5 truncate">{renderScore(sub)}</div>
                      </div>
                      <div className="flex-shrink-0">
                        {sub.status === "pending" && (
                          <span className="text-[11px] text-gray-500 ring-1 ring-gray-200 dark:ring-white/15 px-2.5 py-1 rounded-full">Ожидает</span>
                        )}
                        {sub.status === "submitted" && (
                          <button onClick={() => setSelectedSubmission(sub)} className="press-fill text-[11px] text-amber-600 bg-amber-500/12 ring-1 ring-amber-500/25 px-2.5 py-1 rounded-full hover:bg-amber-500/20 transition-colors font-medium">
                            Проверить →
                          </button>
                        )}
                        {sub.status === "graded" && (
                          <span className="text-[11px] px-2.5 py-1 rounded-full text-green-600 bg-green-500/12 ring-1 ring-green-500/25 font-medium">
                            {secondaryLabel(submissionResult(selectedVariant, sub), { short: true })}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
                </div>
              </div>
              </div>
          </div>
    </div>
    </div>
  ) : null

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-medium page-title">Варианты</h1>
          <p className="text-sm page-subtitle mt-0.5">Пробные варианты ОГЭ и ЕГЭ: соберите из банка заданий или приложите свой файл — ученик решит вариант в кабинете.</p>
        </div>
        <button onClick={() => (canVariants ? setShowAdd(true) : openPlans())} className="btn-primary text-sm px-4 py-2 flex items-center justify-center gap-1.5 self-stretch sm:self-auto shrink-0">
          + Новый вариант
        </button>
      </div>

      {!canVariants && (
        <PlanHint feature="variants">
          Сборка вариантов ОГЭ/ЕГЭ из банка заданий и выдача их ученикам с PDF.
        </PlanHint>
      )}

      {editOpen && selectedVariant && (
        <EditVariantModal
          variant={selectedVariant}
          signal={editSignal}
          accounts={accounts}
          submissions={variantSubmissions}
          onSaved={() => loadData({ silent: true })}
          onClose={() => setEditOpen(false)}
        />
      )}

      <ConfirmModal
        open={!!confirmDelete}
        danger
        title="Удалить вариант?"
        message={`«${confirmDelete?.title || ""}» пропадёт вместе с работами учеников по нему.`}
        confirmLabel="Удалить"
        onConfirm={() => deleteVariant(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Та же полоса-фильтр, что на «Домашних заданиях»: одинаковые разделы
          должны и выглядеть одинаково. */}
      <StatTabs
        items={[
          { id: "all", icon: "clipboard", label: "Всего вариантов", short: "Всего", tint: "text-blue-600 bg-blue-500/10", count: scoped.length },
          { id: "pending", icon: "clock", label: "Ждут проверки", short: "На проверке", tint: "text-amber-600 bg-amber-500/12", count: totalPending },
          { id: "graded", icon: "check", label: "Проверено работ", short: "Проверено", tint: "text-green-600 bg-green-500/12", count: totalGraded },
        ]}
        value={stat}
        onChange={(next) => {
          setStat(next)
          // Открытый разбор скрывать молча нельзя — закрываем той же анимацией.
          const fits = next === "all" || hasStatus(selectedVariant || {}, next === "pending" ? "submitted" : "graded")
          if (selectedVariant && !fits) closeDetail()
        }}
      />


      {loading ? (
        <div className="text-sm text-gray-400 text-center py-8">Загрузка...</div>
      ) : (
        <div className="flex flex-col gap-4">
          {(GROUPS.length > 2 || whoList.length > 1) && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              {GROUPS.length > 2 && (
                <SegmentSwitch
                  size="sm" equal={false} items={GROUPS} value={group} ariaLabel="Фильтр по экзамену"
                  className="self-start flex-shrink-0"
                  onChange={(g) => {
                    setGroup(g)
                    // Разбор открытого варианта скрывать нельзя молча: если он не
                    // попадает в выбранную группу, закрываем его той же анимацией.
                    if (selectedVariant && g !== "all" && groupOf(selectedVariant) !== g) closeDetail()
                  }}
                />
              )}
              {/* Кому выдавали: выбор ученика оставляет в списке только его
                  варианты. Счётчик рядом с именем — сколько всего выдано. */}
              {whoList.length > 1 && (
                <StudentFilter
                  value={who}
                  options={[{ id: "all", name: "Все ученики" }, ...whoList]}
                  onChange={(id) => {
                    setWho(id)
                    // Открытый разбор не должен пережить свой вариант: если он
                    // выпал из фильтра — закрываем той же анимацией.
                    if (selectedVariant && id !== "all" && !hasStudent(selectedVariant, id)) closeDetail()
                  }}
                />
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
            {visible.length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-3 flex flex-col items-center gap-2 text-center py-12 px-4 border border-dashed border-gray-200 dark:border-white/15 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Icon name="clipboard" size={18} />
                </div>
                <div className="text-sm text-gray-400">
                  {variants.length === 0
                    ? "Вариантов пока нет"
                    : stat === "pending" ? "Здесь нет вариантов с работами на проверке"
                      : stat === "graded" ? "Здесь нет вариантов с проверенными работами"
                        : who !== "all" ? `${whoName}: подходящих вариантов нет`
                          : `Вариантов ${group} пока нет`}
                </div>
              </div>
            ) : visible.map((v, i) => {
              const subs = submissions.filter((s) => s.variant_id === v.id)
              const graded = subs.filter((s) => s.status === "graded").length
              const submitted = subs.filter((s) => s.status === "submitted").length
              const total = subs.length
              const isSelected = selectedVariant?.id === v.id
              return (
                <Fragment key={v.id}>
                <VariantCard
                  variant={v}
                  total={total}
                  graded={graded}
                  submitted={submitted}
                  selected={isSelected}
                  onOpen={() => { if (isSelected) closeDetail(); else { cancelDetailClose(); setSelectedVariant(v) } }}
                />
                {/* Разбор — целой строкой сразу после ряда, в котором стоит
                    выбранная карточка (на последнем ряду — после последней). */}
                {detailPanel && (i === detailRowEnd) && detailPanel}
                </Fragment>
              )
            })}
          </div>
        </div>
      )}
      {showAdd && canVariants && (
        <AddVariantModal tutorId={user.id} students={students} examFocus={user.profile?.exam_focus} bankSubjects={user.profile?.bank_subjects} owner={isOwner(user.email)} onClose={() => setShowAdd(false)} onAdd={(v) => { setVariants((prev) => [v, ...prev]); setShowAdd(false) }} />
      )}

      {selectedSubmission && (
        <VariantReview submission={selectedSubmission} variant={selectedVariant} onClose={() => setSelectedSubmission(null)} onSave={loadData} />
      )}

      {previewFile && createPortal(
        <div className={`fixed inset-0 glass-overlay z-50 flex items-end md:items-center justify-center ${previewCls}`} onClick={closePreview}>
          <div className={`glass-modal sheet-modal w-full md:max-w-lg p-6 ${previewCls}`} onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-blue-500/25 rounded-full mx-auto mb-5 md:hidden" />
            <h3 className="text-base font-medium mb-4 text-center">Просмотр варианта</h3>
            <div className="flex flex-col gap-3">
              <a href={previewFile} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3 text-sm font-medium">
                Открыть файл ↗
              </a>
              {previewFile.match(/\.(jpg|jpeg|png|gif|webp)/i) && (
                <img src={previewFile} alt="variant" className="w-full max-h-64 object-contain rounded-xl bg-white" />
              )}
              <button onClick={closePreview} className="w-full border border-gray-200 dark:border-white/15 rounded-xl py-3 text-sm text-gray-600">
                Закрыть
              </button>

            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default Variants
