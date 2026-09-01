import { useState, useEffect, useRef, Fragment } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import { signRows } from "../storageUrl"
import { plural, getInitials, plainTaskMath, answersEqual } from "../utils"
import Icon from "../components/Icon"
import MorphIcon from "../components/MorphIcon"
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
import TasksModal from "../components/TasksModal"
import SegmentSwitch from "../components/SegmentSwitch"
import StatTabs from "../components/StatTabs"
import MethodCards from "../components/MethodCards"
import AutoHeight from "../components/AutoHeight"
import { useClosing, POPUP_OUT_MS } from "../useClosing"
import useGridCols, { detailRowEndOf } from "../useGridCols"
import getAvatarColor from "../avatarColor"
import Reveal from "../components/Reveal"
// Тетрадь тянет генераторы заданий — грузим только когда её открыли.

// Банк заданий и сборка PDF — самые тяжёлые модули приложения: генераторы всех предметов
// весят около 3,3 МБ, jsPDF с html2canvas — ещё около 0,2 МБ. Разделу они нужны только по
// нажатию кнопки, поэтому подключаются в этот момент, а не при открытии раздела: список
// вариантов появляется сразу. Сразу после отрисовки банк подтягивается фоном (prefetchBank),
// так что к нажатию «Собрать вариант» он обычно уже в кэше.
const loadBank = () => import("./taskBankApi")
const loadVariantPdf = () => import("./variantPdf")
function prefetchBank() {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500))
  idle(() => { loadBank(); loadVariantPdf() })
}

// Файл варианта: свой PDF/фото репетитора или печатный лист, собранный из банка.
// Лист СОБИРАЕТСЯ ЗДЕСЬ, а не при сохранении варианта: html2canvas снимает страницу
// секундами, и отправка ученикам не должна их ждать — вариант из банка ученик решает
// в кабинете, файл нужен только для печати и для скачивания.
function VariantFileBlock({ variant, tutorId, onBuilt, onPreview }) {
  const [busy, setBusy] = useState(false)
  const [ansBusy, setAnsBusy] = useState(false)
  const [err, setErr] = useState("")
  const url = variant.file_url
  const fromBank = variant.tasks_snapshot?.length > 0

  // Тот же лист, но с ответами — для проверки (приём Kuta Software). Отдельной
  // карточкой он только дублировал строку файла, поэтому это просто вторая кнопка:
  // скачать вариант с ответами или без. Лист пересобирается из tasks_snapshot,
  // так что числа те же, что получил ученик, а не новые.
  async function downloadAnswers() {
    setAnsBusy(true); setErr("")
    try {
      // В снимке варианта ответов НЕТ намеренно: ученик решает его в кабинете и прочитал
      // бы их прямо в данных страницы. Для листа проверяющего подставляем их из самой
      // строки варианта: часть 1 — массив по номеру−1, часть 2 — по номеру.
      const p1 = variant.answers?.part1 || []
      const p2 = variant.answers?.part2 || {}
      const tasks = (variant.tasks_snapshot || []).map((t) => ({
        ...t, answer: t.answer ?? p1[t.number - 1] ?? p2[t.number] ?? null,
      }))
      const blob = await (await loadVariantPdf()).generateVariantPdf({
        title: variant.title, examType: variant.type, tasks, mode: "answers",
        part2Numbers: variantPart2Tasks(variant),
      })
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objUrl
      a.download = `${variant.title || "Вариант"} — с ответами.pdf`
      a.click()
      URL.revokeObjectURL(objUrl)
    } catch {
      setErr("Не получилось собрать лист с ответами")
    } finally {
      setAnsBusy(false)
    }
  }

  async function build() {
    setBusy(true); setErr("")
    try {
      const { generateVariantPdf } = await loadVariantPdf()
      const blob = await generateVariantPdf({
        title: variant.title, examType: variant.type, tasks: variant.tasks_snapshot,
        part2Numbers: variantPart2Tasks(variant),
      })
      const fileName = storageFileName(tutorId, "pdf")
      const { error: upErr } = await supabase.storage.from("variants").upload(fileName, blob, { contentType: "application/pdf" })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from("variants").getPublicUrl(fileName)
      const { error: rowErr } = await supabase.from("variants").update({ file_url: urlData.publicUrl }).eq("id", variant.id)
      if (rowErr) throw rowErr
      // бакет приватный — показываем по временной ссылке, как и остальные файлы списка
      const [signed] = await signRows([{ file_url: urlData.publicUrl }], { file_url: "variants" })
      onBuilt(signed.file_url)
    } catch {
      setErr("Не получилось собрать PDF. Попробуйте ещё раз.")
    } finally {
      setBusy(false)
    }
  }

  if (!url && !(variant.tasks_snapshot?.length > 0)) return null

  const fileName = url ? (url.split("?")[0].split("/").pop() || "Файл варианта") : ""

  return (
    <div className="rounded-2xl ring-1 ring-gray-200/70 dark:ring-white/10 bg-white/45 dark:bg-white/[0.03] overflow-hidden">
      <div className="p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
          <Icon name={url ? "paperclip" : "file-text"} size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">Печатный лист варианта</div>
          {/* адрес подписанный — имя берём без хвоста с токеном */}
          <div className={`text-[11px] mt-0.5 truncate ${err ? "text-red-500" : "text-gray-400"}`}>
            {err || (busy ? "Собираем…" : url ? fileName : "Ещё не собран — нужен для печати")}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {url ? (
            <a href={url + (url.includes("?") ? "&" : "?") + "download"} download
              className="press-fill text-xs px-3 py-1.5 rounded-lg ring-1 ring-gray-200 dark:ring-white/15 text-gray-700 flex items-center gap-1.5">
              <MorphIcon from="download" size={13} />Скачать
            </a>
          ) : (
            <button onClick={build} disabled={busy}
              className="press-fill text-xs px-3 py-1.5 rounded-lg ring-1 ring-blue-200 dark:ring-blue-400/25 text-blue-600 bg-blue-500/8 disabled:opacity-50 flex items-center gap-1.5">
              <MorphIcon from="file-text" to="download" size={13} />
              {busy ? "Собираем…" : "Собрать"}
            </button>
          )}
          {/* Тот же лист, но с ответами: вариант из банка скачивается с ключами или без. */}
          {fromBank && (
            <button onClick={downloadAnswers} disabled={ansBusy}
              className="press-fill text-xs px-3 py-1.5 rounded-lg ring-1 ring-gray-200 dark:ring-white/15 text-gray-700 disabled:opacity-50 flex items-center gap-1.5">
              <MorphIcon from="check" to="download" size={13} />
              {ansBusy ? "Собираем…" : "С ответами"}
            </button>
          )}
          {url && (
            <>
              {/* Лист уже собран, но вёрстка формул с тех пор могла поправиться —
                  пересобрать его надо уметь, не удаляя вариант. */}
              {fromBank && (
                <button onClick={build} disabled={busy} title="Собрать лист заново"
                  className="press-tap w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors disabled:opacity-50">
                  <Icon name="repeat" size={14} />
                </button>
              )}
              <button onClick={() => onPreview(url)} title="На весь экран"
                className="press-tap w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors">
                <Icon name="maximize" size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      {url && url.match(/\.(jpg|jpeg|png|gif|webp)/i) && (
        <img src={url} alt="вариант" className="w-full max-h-48 object-contain bg-white cursor-pointer border-t border-gray-100/70 dark:border-white/10" onClick={() => onPreview(url)} />
      )}
    </div>
  )
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

function AddVariantModal({ tutorId, students = [], examFocus, bankSubjects = null, owner = false, onClose, onAdd }) {
  const subjects = variantSubjectsFor(bankSubjects, owner)
  const [title, setTitle] = useState(todayTitle)
  const [examType, setExamType] = useState(() => defaultVariantType(subjects, examFocus))
  const [answers, setAnswers] = useState(() => Array(part1SlotsOf(defaultVariantType(subjects, examFocus))).fill(""))
  // Ответы части 2 (ОГЭ: 20–25) — объект { номер: ответ }; при сборке из банка заполняется сам
  const [part2Answers, setPart2Answers] = useState({})
  const [loading, setLoading] = useState(false)
  const [variantFile, setVariantFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [recipientId, setRecipientId] = useState("all")
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

  // Аккаунты учеников; цель (ОГЭ/ЕГЭ) берём из students по уже вычисленному
  // studentAccountId (App.jsx), чтобы не заводить второе, отдельное сопоставление.
  useEffect(() => {
    supabase.from("student_accounts").select("id, name, phone").eq("tutor_id", tutorId)
      .then(({ data: accs }) => setAccounts(accs || []))
  }, [tutorId])

  const goalByAccountId = {}
  for (const s of students) {
    if (s.studentAccountId && s.goal) goalByAccountId[s.studentAccountId] = s.goal
  }

  // Номера части 1 идут подряд только в математике: в информатике из варианта
  // выпадают задания, которые без компьютера не решить (см. VARIANT_PART1).
  const p1Numbers = part1NumbersOf(examType)
  const answerCount = p1Numbers.length
  const answerSlots = part1SlotsOf(examType)          // ответы лежат по индексу «номер − 1»
  const inOrder = answerSlots === answerCount         // можно вводить строкой через пробел
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

    // PDF собранного варианта здесь НЕ делается: сборка листа занимает секунды, и всё это
    // время репетитор смотрел бы на «Сохраняем…» ради файла, который ученику для решения
    // не нужен (вариант из банка он решает прямо в кабинете). Лист собирается потом,
    // кнопкой в карточке варианта (VariantFileBlock).

    const { data, error } = await supabase.from("variants").insert({
      tutor_id: tutorId, title, type: examType,
      answers: { part1: answers, part2: part2Answers, part2_choices: part2Choices, part2_choices_part: part2ChoicesPart },
      file_url: fileUrl, tasks_snapshot: tasksSnapshot,
    }).select().single()

    if (error) { setFormError("Не получилось сохранить: " + error.message); setLoading(false); return }

    // Кому отправить: конкретному ученику или всем с подходящей целью экзамена
    const recipients = recipientId === "all"
      ? accounts.filter((a) => {
          const goal = goalByAccountId[a.id]
          return !goal || goal === examLevelOf(examType)
        })
      : accounts.filter((a) => String(a.id) === recipientId)

    if (recipients.length > 0) {
      await supabase.from("variant_submissions").insert(recipients.map((s) => ({ variant_id: data.id, student_id: s.id, status: "pending" })))
      await supabase.from("notifications").insert(recipients.map((s) => ({ user_id: s.id, title: "Новый вариант " + examType, body: "Репетитор отправил новый вариант: " + title })))
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
              Ответы уехали вниз во всю ширину — их проверяют последними. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 items-stretch">
            <div className="flex flex-col gap-4">

              <div>
                <label className="text-sm text-gray-500 mb-1 block">Ученик</label>
                <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)}
                  aria-label="Ученик" className="input-glass">
                  <option value="all">Все ученики ({examLevelOf(examType)})</option>
                  {accounts.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
                </select>
              </div>

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

              <MethodCards
                label="Из чего собрать вариант"
                items={VARIANT_METHODS}
                value={source}
                onChange={setSource}
              />
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
                    <div className="flex flex-col gap-1.5 max-h-[24rem] overflow-y-auto px-px -mx-px">
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
            </div>
          </div>

          {/* Ответы — во всю ширину под сборкой: их сверяют в последнюю очередь. */}
          <div className="flex flex-col gap-4 mt-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">
                {source === "bank" && bankPicked.length > 0
                  ? `Ответы части 1 — подставлены из банка, проверьте (${answerCount} шт.)`
                  : inOrder
                    ? `Ответы к части 1 — введите все ${answerCount} через пробел`
                    : `Ответы к части 1 — по номерам заданий (${answerCount} шт.)`}
              </label>
              {/* Номера подряд (математика, ОГЭ информатика) — строкой через пробел:
                  так ответы переносят из готового ключа одним движением. Где номера
                  идут с пропусками, строка обманывала бы: третье число легло бы не в
                  то задание — там сетка с номерами. */}
              {inOrder ? (
                <>
                  <textarea
                    value={answers.filter(Boolean).join(" ")}
                    onChange={(e) => {
                      const vals = e.target.value.trim().split(/\s+/).filter(Boolean).slice(0, answerCount)
                      setAnswers([...vals, ...Array(answerCount).fill("")].slice(0, answerCount))
                    }}
                    placeholder={examType === "ОГЭ" ? "3 12 4 -5 2 0.5 8 16 3 7 4 2 6 9 45 8 12 3 7" : "3 12 4 -5 2 0.5 8 16 3 7"}
                    rows={2}
                    className="input-glass resize-none"
                  />
                  <div className="text-xs text-gray-400 mt-1">Введено: {answers.filter((a) => a).length} / {answerCount}</div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {p1Numbers.map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-5 flex-shrink-0">{n}</span>
                        <input
                          value={answers[n - 1] || ""}
                          onChange={(e) => setAnswers((prev) => { const upd = [...prev]; upd[n - 1] = e.target.value; return upd })}
                          placeholder="Ответ"
                          className="input-glass flex-1 px-2 py-1.5 text-sm min-w-0"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Введено: {p1Numbers.filter((n) => answers[n - 1]).length} / {answerCount}
                  </div>
                </>
              )}
            </div>

            {part2Numbers.length > 0 && (
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Ответы к части 2 ({numbersLabel(part2Numbers)}){source === "bank" && bankPicked.length > 0 ? " — подставлены из банка" : ""}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {part2Numbers.map((n) => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 flex-shrink-0">{n}</span>
                      <input
                        value={part2Answers[n] || ""}
                        onChange={(e) => setPart2Answers((prev) => ({ ...prev, [n]: e.target.value }))}
                        placeholder={n === 24 ? "Доказано." : "Ответ"}
                        className="input-glass flex-1 px-2 py-1.5 text-sm min-w-0"
                      />
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Ученик выберет ответ из четырёх вариантов; для доказательства (№24) — только фото решения
                </div>
              </div>
            )}

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

          {formError && <div className="text-sm text-red-500 mt-4 text-center">{formError}</div>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-5">
            <button onClick={close} className="press-fill border border-gray-200 rounded-xl px-5 py-2.5 text-sm text-gray-600">Отмена</button>
            <button onClick={handleSubmit} disabled={loading || uploading} className="btn-primary px-6 py-2.5 disabled:opacity-50">
              {uploading ? "Загружаем файл..." : loading ? "Отправляем..." : recipientId === "all" ? "Отправить ученикам" : "Отправить ученику"}
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
  // Балл части 1 считает ученик при сдаче тем же answersEqual. Пересчитываем
  // только для старых записей, где его не сохранили.
  const part1Score = submission.part1_score ?? part1Answers.reduce(
    (n, ans, i) => n + (answersEqual(submission.part1_answers?.[i], ans) ? taskMaxOf(type, i + 1) || 1 : 0), 0)

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
    const { error } = await supabase.from("variant_submissions").update({
      part1_score: part1Score, part2_score: part2Total, part2_score_detail: scores,
      total_score: total, geom_score: secondary, status: "graded",
    }).eq("id", submission.id)
    if (!error) {
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
// Высота (h-10), скругление (rounded-2xl) и шрифт кнопки повторяют соседний
// сегмент-контрол «Все / ОГЭ / ЕГЭ» (SegmentSwitch, размер sm): они стоят в
// одной строке, и любая разница читается как съехавшая кнопка.
export function StudentFilter({ options, value, onChange }) {
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
        className={`press-fill flex items-center gap-2 h-10 rounded-2xl ring-1 pl-1.5 pr-3 text-sm font-semibold transition-colors ${
          value === "all"
            ? "text-gray-500 dark:text-gray-300 ring-gray-200/70 dark:ring-white/10 hover:text-blue-600 hover:ring-blue-500/25"
            : "text-blue-600 bg-blue-500/12 ring-blue-500/25"
        }`}
      >
        {bubble(current, "w-7 h-7")}
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
                  on ? "text-blue-600 bg-blue-500/10" : "text-gray-600 dark:text-gray-200 hover:bg-blue-500/[0.06]"
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

function Variants({ user, students = [] }) {
  const [variants, setVariants] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  // Печатная тетрадь по номерам экзамена. Раньше открывалась только из
  // «Банка заданий», а он виден одному владельцу платформы.
  const [confirmDelete, setConfirmDelete] = useState(null)
  const { cls: previewCls, close: closePreview } = useClosing(() => setPreviewFile(null))

  // Сборка вариантов — возможность платных тарифов. Уже выданные варианты
  // остаются доступными: тариф ограничивает создание нового, а не историю.
  const { allows, openPlans } = usePlan()
  const canVariants = allows("variants")
  const [selectedVariant, setSelectedVariant] = useState(null)
  // Разбор сворачивается плавно: панель уезжает вниз и только потом снимается
  // (см. src/useClosing.js). Раньше она пропадала в тот же кадр, что и нажатие.
  const { cls: detailCls, close: closeDetail, cancel: cancelDetailClose } = useClosing(() => setSelectedVariant(null))
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

  async function loadData() {
    setLoading(true)
    const { data: v } = await supabase.from("variants").select("*").eq("tutor_id", user.id).order("created_at", { ascending: false })
    const { data: s } = await supabase.from("variant_submissions").select("*, student_accounts(name, email)").in("variant_id", (v || []).map((x) => x.id))
    // Бакет `variants` приватный: PDF варианта и фото решений части 2 —
    // рабочие файлы учеников, отдаём по временной подписанной ссылке.
    setVariants(await signRows(v || [], { file_url: "variants" }))
    setSubmissions(await signRows(s || [], { part2_files: "variants" }))
    setLoading(false)
  }

  async function deleteVariant(v) {
    setConfirmDelete(null)
    await supabase.from("variant_submissions").delete().eq("variant_id", v.id)
    await supabase.from("variants").delete().eq("id", v.id)
    setVariants((prev) => prev.filter((x) => x.id !== v.id))
    if (selectedVariant && selectedVariant.id === v.id) setSelectedVariant(null)
  }

  const variantSubmissions = selectedVariant ? submissions.filter((s) => s.variant_id === selectedVariant.id) : []

  const totalPending = submissions.filter((s) => s.status === "submitted").length
  const totalGraded = submissions.filter((s) => s.status === "graded").length

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
  const visible = variants.filter((v) => (group === "all" || groupOf(v) === group) && matchStat(v) && matchWho(v))

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
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                    <Icon name="users" size={12} />
                    {variantSubmissions.length} {plural(variantSubmissions.length, "ученик", "ученика", "учеников")}
                  </span>
                  <button onClick={closeDetail} title="Свернуть"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors">
                    <Icon name="x" size={15} />
                  </button>
                </div>
              </div>

              {/* Две колонки: раньше каждая секция шла полосой во всю ширину,
                  и справа от короткого содержимого оставалось пустое поле. */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 px-5 py-4 border-t border-gray-100/60 dark:border-white/10 items-start">
              <div className="flex flex-col gap-2">
                <div className="section-label mb-0.5">Материалы</div>

                <VariantFileBlock
                  variant={selectedVariant}
                  tutorId={user.id}
                  onPreview={setPreviewFile}
                  onBuilt={(url) => {
                    setVariants((prev) => prev.map((x) => (x.id === selectedVariant.id ? { ...x, file_url: url } : x)))
                    setSelectedVariant((prev) => (prev ? { ...prev, file_url: url } : prev))
                  }}
                />

                {selectedVariant.tasks_snapshot?.length > 0 && (
                  <BankTasksBlock key={selectedVariant.id} tasks={selectedVariant.tasks_snapshot} title={selectedVariant.title} />
                )}
              </div>

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
          { id: "all", icon: "clipboard", label: "Всего вариантов", short: "Всего", tint: "text-blue-600 bg-blue-500/10", count: variants.length },
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
              const progressPct = total > 0 ? Math.round((graded / total) * 100) : 0
              const isSelected = selectedVariant?.id === v.id
              return (
                <Fragment key={v.id}>
                <div className={`glass-sm overflow-hidden transition-all flex flex-col ${isSelected ? "!border-blue-400/70 ring-2 ring-blue-400/35" : "hover:!border-blue-300/60"}`}>
                  {/* Повторный клик сворачивает разбор: карточки стоят строкой,
                      и закрывать панель под ними больше нечем. */}
                  <button onClick={() => { if (isSelected) closeDetail(); else { cancelDetailClose(); setSelectedVariant(v) } }} className="w-full text-left px-4 pt-3.5 pb-3 flex-1">
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <div className="font-medium text-sm truncate">{v.title}</div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ring-1 ${isEgeType(v.type) ? "text-purple-600 bg-purple-500/10 ring-purple-500/20" : "text-blue-600 bg-blue-500/10 ring-blue-500/20"}`}>{v.type}</span>
                    </div>
                    {/* Дата и охват — одной строкой: раньше «5 учеников» жило только
                        в правой панели, а под датой оставалась пустая полоса. */}
                    <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <span>{new Date(v.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span>
                      {total > 0 && <><span className="opacity-50">·</span><span>{total} {plural(total, "ученик", "ученика", "учеников")}</span></>}
                    </div>
                    {total > 0 && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="text-[11px] text-gray-400 flex-shrink-0">Проверено</span>
                        <div className="h-1 flex-1 bg-blue-500/12 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${graded === total ? "bg-green-500" : "bg-blue-500"}`}
                            style={{ width: progressPct + "%" }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-400 tabular-nums flex-shrink-0">{graded} / {total}</span>
                      </div>
                    )}
                  </button>
                  {/* Статус слева, действия справа: две половинчатые текстовые кнопки
                      во всю ширину выглядели как футер объявления. */}
                  <div className="flex items-center justify-between gap-2 pl-4 pr-2 py-1.5 border-t border-gray-100/60">
                    <div className="flex gap-1.5 flex-wrap min-w-0">
                      {submitted > 0 && <span className="text-[11px] text-amber-600 bg-amber-500/12 ring-1 ring-amber-500/20 px-2 py-0.5 rounded-full">{submitted} на проверке</span>}
                      {graded > 0 && <span className="text-[11px] text-green-600 bg-green-500/12 ring-1 ring-green-500/20 px-2 py-0.5 rounded-full">{graded} проверено</span>}
                      {total === 0 && <span className="text-[11px] text-gray-400">Ещё никому не выдан</span>}
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {v.file_url && (
                        <button onClick={() => setPreviewFile(v.file_url)} title="Файл варианта"
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors">
                          <Icon name="paperclip" size={15} />
                        </button>
                      )}
                      <button onClick={() => setConfirmDelete(v)} aria-label="Удалить вариант" title="Удалить вариант"
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>
                </div>
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
