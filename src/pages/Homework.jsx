import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import { signRows } from "../storageUrl"
import Icon from "../components/Icon"
import Collapse from "../components/Collapse"
import AutoHeight from "../components/AutoHeight"
import FormulaBackdrop from "../components/FormulaBackdrop"
import { parseLocalDate, renderHomeworkMath, parseHomeworkTasks, plural } from "../utils"
import { usePlan } from "../subscription"
import { PlanHint, PlanLock } from "../components/PlanLock"
import ConfirmModal from "../components/ConfirmModal"
import { useClosing } from "../useClosing"

const STATUS_LABELS = {
  assigned: { label: "Выдано", cls: "bg-gray-100 text-gray-600" },
  submitted: { label: "На проверке", cls: "bg-blue-100 text-blue-700" },
  done: { label: "Выполнено", cls: "bg-green-100 text-green-700" },
  revision: { label: "На доработку", cls: "bg-amber-100 text-amber-700" },
}

const TYPE_LABELS = {
  written: { label: "Письменное", iconName: "edit" },
  test: { label: "Тест", iconName: "file-text" },
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

function buildUploadPath(tutorId, name) {
  const ext = name.split(".").pop()
  return tutorId + "/" + Date.now() + "." + ext
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

const TIME_CHIPS = [0, 20, 45, 60]

const chipCls = (on) =>
  `px-3 py-1.5 rounded-full text-xs transition-all active:scale-[0.94] ${
    on
      ? "bg-blue-600 text-white shadow-sm"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
  }`

// Переключатель «тумблер + подпись»: одинаковый во всей форме.
function Toggle({ on, onClick, title, note }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-start gap-3 text-left active:scale-[0.99] transition-transform">
      <div className={`mt-0.5 w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${on ? "bg-blue-600" : "bg-gray-200"}`}>
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
  { id: "file", icon: "paperclip", title: "Свой файл", note: "PDF или фотография задания, ответы вписываете сами" },
  { id: "bank", icon: "grid", title: "Из банка заданий", note: "Номера и темы ОГЭ/ЕГЭ — соберём с ответами" },
  { id: "ai", icon: "sparkles", title: "Составить ИИ", note: "Задания по любой теме, готовы за минуту" },
]

const BANK_COUNTS = [3, 5, 8, 10, 15]

// Условие в одну строку: описание ДЗ разбирается по строкам («1. …», «2. …»),
// и перенос внутри задания превратил бы его в два.
const oneLine = (s) => String(s || "").replace(/\s*\n+\s*/g, " ").trim()

// Ответ годится для автопроверки, только если это одно значение без пробелов:
// поле ответов делит строку по пробелам, и «x₁ = 2, x₂ = 0.5» рассыпалось бы.
// Запятая внутри числа при этом разрешена — «3,75» это обычный ответ ОГЭ.
const isSimpleAnswer = (a) => a.length > 0 && !/[\s\\{}]/.test(a)

// Непустые варианты ответа одного задания.
const cleanOpts = (t) => (t.options || []).map((o) => o.trim()).filter(Boolean)

function CreateHomeworkModal({ students, tutorId, onClose, onCreated, editingHw }) {
  const isEditing = !!editingHw
  const [studentId, setStudentId] = useState(editingHw?.student_id ? String(editingHw.student_id) : "")
  const [title, setTitle] = useState(editingHw?.title || "")
  const [description, setDescription] = useState(editingHw?.description || "")
  const [deadline, setDeadline] = useState(editingHw?.deadline || "")
  // Ограничение по времени в минутах: пусто — без таймера (как было раньше).
  const [timeLimit, setTimeLimit] = useState(editingHw?.time_limit_min ? String(editingHw.time_limit_min) : "")
  // Календарь показываем только если срок не попал в быстрые чипы.
  const [pickDate, setPickDate] = useState(
    !!editingHw?.deadline && !DEADLINE_CHIPS.some((c) => c.days != null && isoDay(c.days) === editingHw.deadline)
  )
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  // Тип задания больше не выбирается вручную: работа становится тестом ровно
  // тогда, когда у неё появляются ответы для автопроверки (тумблер в форме).
  // «Комбинированное» сохраняем только у старых заданий, чтобы правка не меняла
  // ученику способ сдачи.
  const [autoCheck, setAutoCheck] = useState(editingHw ? editingHw.hw_type !== "written" : false)
  const [requireSolution, setRequireSolution] = useState(editingHw?.require_solution || false)
  const [answersInput, setAnswersInput] = useState(editingHw?.correct_answers?.join(" ") || "")
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
  const [bankType, setBankType] = useState("ОГЭ")
  const [bankNums, setBankNums] = useState([])
  const [bankThemes, setBankThemes] = useState([])
  const [bankCount, setBankCount] = useState(5)
  const [bankTasks, setBankTasks] = useState([])
  const [bankSkipped, setBankSkipped] = useState([])
  const [bankBusy, setBankBusy] = useState(false)
  const [bankError, setBankError] = useState("")
  // Номера, у которых нет ни одного самодостаточного задания (всё с чертежами или
  // файлами). Проверяем пробой генераторов при выборе предмета — весь предмет
  // укладывается в доли секунды, зато номер видно НЕДОСТУПНЫМ сразу, а не после
  // нажатия «Собрать».
  const [bankBad, setBankBad] = useState([])

  function probeBank(mod, type) {
    setBankBad(mod.numbersWithGen(type).filter((n) => !mod.pickTextTask(type, n, null, new Set())))
  }

  // Модуль банка подгружаем по нажатию на карточку, а не эффектом: генераторы
  // весят мегабайты, и в основном бандле кабинета им делать нечего.
  function chooseMethod(id) {
    setMethod(id)
    if (id !== "bank" || bank || bankLoading) return
    setBankLoading(true)
    import("./homeworkBank")
      .then((m) => { setBank(m); probeBank(m, bankType) })
      .catch(() => setBankError("Не удалось загрузить банк заданий"))
      .finally(() => setBankLoading(false))
  }

  // --- Генерация ДЗ по теме через DeepSeek (серверный прокси /api/generate-hw) ---
  const [genTopic, setGenTopic] = useState("")
  const [genSubject, setGenSubject] = useState("")
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
        tasks: (data.tasks || []).map((t) => ({
          question: t.question || "",
          answer: t.answer || "",
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
      setAnswersInput(tasks.map((t) => t.answer.trim()).join(" "))
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
    // Фолбэк: свободный ввод ответа. Ответы с пробелами и формулами для
    // автопроверки не годятся — такая работа остаётся письменной.
    const answers = tasks.map((t) => t.answer.trim())
    const mode = mcqOk ? "mcq" : answers.length > 0 && answers.every(isSimpleAnswer) ? "free" : null

    setAiMode(mode)
    setAutoCheck(mode !== null)
    if (mode !== "mcq") { setTestOptions(null); setMcqCorrect([]) }
    if (mode !== "free") setAnswersInput("")
    // Название репетитора важнее предложенного моделью — своё не затираем.
    if (!title.trim()) setTitle(p.title.trim() || genTopic)
    syncPreview(p, mode)
  }

  function editPreview(fn) {
    const next = fn(preview)
    setPreview(next)
    syncPreview(next)
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
    setTestOptions(null)
    setMcqCorrect([])
    setAutoCheck(false)
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
      setAnswersInput(answers.join(" "))
    } else {
      setAutoCheck(false)
      setAnswersInput("")
    }
    if (tasks.length && !title.trim()) {
      const nums = [...new Set(tasks.map((t) => t.number))].sort((a, b) => a - b)
      setTitle(`${bank.subjectLabel(bankType)}: № ${nums.join(", ")}`)
    }
  }

  function handleAssemble() {
    if (!bank) return
    if (!bankNums.length) return setBankError("Выберите хотя бы один номер")
    setBankError("")
    setBankBusy(true)
    // Генераторы работают синхронно и не мгновенно — отдаём кадр, чтобы кнопка
    // успела показать «Собираем…», а не подвисла молча.
    setTimeout(() => {
      const { tasks, skipped } = bank.assembleHomework({
        examType: bankType,
        numbers: bankNums,
        themes: bankNums.length === 1 ? bankThemes : null,
        count: bankCount,
      })
      setBankSkipped(skipped)
      if (tasks.length) applyBank(tasks)
      else {
        setBankTasks([])
        setBankError("У выбранных номеров все задания с чертежом — выберите другие")
      }
      setBankBusy(false)
    }, 30)
  }

  function rerollBankTask(idx) {
    const seen = new Set(bankTasks.map((t) => bank.taskText(t)))
    const fresh = bank.pickTextTask(bankType, bankTasks[idx].number, bankNums.length === 1 ? bankThemes : null, seen)
    if (fresh) applyBank(bankTasks.map((t, i) => (i === idx ? fresh : t)))
  }

  function removeBankTask(idx) {
    applyBank(bankTasks.filter((_, i) => i !== idx))
  }

  function toggleBankNum(n) {
    setBankThemes([])
    setBankNums((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)))
  }

  const bankNumbers = bank ? bank.numbersWithGen(bankType) : []
  const themeGroups = bank && bankNums.length === 1 ? bank.taskThemes(bankType, bankNums[0]) : null

  // Уже выставленное нестандартное время (например, у старого задания) не должно
  // пропадать из чипов — иначе правка молча его сбросит.
  const timeChips = timeLimit && !TIME_CHIPS.includes(Number(timeLimit))
    ? [...TIME_CHIPS, Number(timeLimit)].sort((a, b) => a - b)
    : TIME_CHIPS

  const isMcq = Array.isArray(testOptions) && testOptions.length > 0
  const hwType = !autoCheck ? "written" : editingHw?.hw_type === "combined" ? "combined" : "test"
  const freeAnswers = answersInput
    .trim()
    .split(/\s+/)
    .filter((a) => a.length > 0)
  const correctAnswers = isMcq ? mcqCorrect : freeAnswers
  const questionCount = correctAnswers.length

  async function handleSubmit() {
    // Ошибку показываем в самой форме, у кнопки: alert прерывает заполнение и
    // не подсказывает, какое поле пустое.
    if (!studentId) return setFormError("Выберите, кому задать")
    if (!title.trim()) return setFormError("Напишите, что задать")
    if (hwType !== "written" && questionCount === 0) {
      return setFormError("Впишите ответы — по ним работа проверится автоматически")
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
    // Колонку добавляет supabase/homework_timer.sql. Пока миграция не выполнена,
    // поля в payload нет вовсе — выдача ДЗ работает как раньше.
    if (timeLimit) payload.time_limit_min = Number(timeLimit)
    else if (editingHw?.time_limit_min != null) payload.time_limit_min = null

    let error
    if (isEditing) {
      const res = await supabase.from("homework").update(payload).eq("id", editingHw.id)
      error = res.error
    } else {
      const res = await supabase.from("homework").insert({ ...payload, status: "assigned" })
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
    } else if (/time_limit_min/.test(error.message || "")) {
      // Колонки ещё нет: миграция supabase/homework_timer.sql не выполнена.
      setFormError("Ограничение по времени пока недоступно: выполните supabase/homework_timer.sql в SQL Editor. Пока оставьте «Без лимита».")
    } else {
      setFormError("Не получилось сохранить: " + error.message)
    }
    setSaving(false)
  }

  // Блок ответов нужен только «своему файлу»: у банка и ИИ ответы проставлены
  // и показаны рядом с самими заданиями.
  const answersBlock = (
    <div>
      {isMcq ? (
        <>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-gray-500">Правильные ответы — {questionCount} вопр.</span>
            <button
              type="button"
              onClick={() => { setTestOptions(null); setMcqCorrect([]) }}
              className="text-xs text-gray-400 hover:text-gray-600 active:scale-95 transition-all"
            >
              Ввести вручную
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {testOptions.map((opts, i) => (
              <div key={i} className="rounded-xl bg-gray-500/[0.06] p-2">
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
                          sel ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-700 hover:bg-gray-100"
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
          <button onClick={close} aria-label="Закрыть" className="text-gray-400 hover:text-gray-600 active:scale-90 transition-transform"><Icon name="x" size={18} /></button>
        </div>

        {/* Две колонки: слева — кому и когда (это одинаково для любого способа),
            справа — из чего задание собирается. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] gap-x-6 gap-y-5 items-stretch">

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm text-gray-500 mb-1.5 block">Кому задать</label>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)}
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

            {/* Как ученик сдаёт. Тип задания берётся отсюда: есть ответы — тест. */}
            <div className="rounded-2xl ring-1 ring-gray-500/15 p-3 lg:mt-auto">
              <Toggle
                on={autoCheck}
                onClick={() => setAutoCheck((v) => !v)}
                title="Автопроверка"
                note={autoCheck
                  ? "Ученик впишет ответы в кабинете, оценка выставится сразу"
                  : "Ученик прикрепит фотографию или файл с работой, оценку поставите вы"}
              />

              <Collapse open={autoCheck}>
                <div className="pt-3 flex flex-col gap-3">
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Время на работу</div>
                    <div className="flex flex-wrap gap-1.5">
                      {timeChips.map((n) => (
                        <button key={n} type="button" onClick={() => setTimeLimit(n ? String(n) : "")}
                          className={chipCls(String(n) === (timeLimit || "0"))}>
                          {n ? `${n} мин` : "Без лимита"}
                        </button>
                      ))}
                    </div>
                    {timeLimit && (
                      <div className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                        Отсчёт начнётся, когда ученик откроет работу. По истечении времени она автоматически уйдёт на проверку.
                      </div>
                    )}
                  </div>

                  <Toggle
                    on={requireSolution}
                    onClick={() => setRequireSolution(!requireSolution)}
                    title="Дополнительно — фотография решения"
                    note="Без неё отправить тест нельзя"
                  />
                </div>
              </Collapse>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-2">Из чего собрать задание</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {HW_METHODS.map((m) => {
                  const on = method === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => chooseMethod(m.id)}
                      className={`press-fill text-left rounded-2xl p-3 ring-1 transition-colors ${
                        on ? "ring-blue-500/40 bg-blue-500/[0.08]" : "ring-gray-500/15 hover:bg-gray-500/[0.04]"
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${
                        on ? "bg-blue-500/15 text-blue-600" : "bg-gray-500/10 text-gray-500"
                      }`}>
                        <Icon name={m.icon} size={15} />
                      </span>
                      <span className={`block text-sm ${on ? "text-blue-700 dark:text-blue-300 font-medium" : "text-gray-700"}`}>{m.title}</span>
                      <span className="block text-[11px] text-gray-400 leading-snug mt-0.5">{m.note}</span>
                    </button>
                  )
                })}
              </div>
            </div>

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
                      <span className="text-[11px] text-gray-400">PDF, фотография или документ</span>
                    </button>
                    {file && (
                      <button type="button" onClick={() => setFile(null)} className="self-start text-xs text-gray-400 hover:text-red-500 active:scale-95 transition-all">
                        Убрать файл
                      </button>
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
                            onChange={(e) => {
                              setBankType(e.target.value)
                              setBankNums([]); setBankThemes([]); setBankTasks([]); setBankSkipped([]); setBankError("")
                              probeBank(bank, e.target.value)
                            }}
                            className="input-glass"
                          >
                            {bank.EXAM_GROUPS.map((g) => (
                              <optgroup key={g.key} label={g.key}>
                                {g.subjects.map((s) => <option key={s.type} value={s.type}>{g.key} · {s.label}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex items-baseline justify-between mb-1.5">
                            <span className="text-xs text-gray-500">
                              Номера заданий{bankNums.length > 0 ? ` — выбрано ${bankNums.length}` : ""}
                            </span>
                            {bankNums.length > 0 && (
                              <button type="button" onClick={() => { setBankNums([]); setBankThemes([]) }}
                                className="text-[11px] text-gray-400 hover:text-gray-600 active:scale-95 transition-all">
                                сбросить
                              </button>
                            )}
                          </div>
                          {bankNumbers.length === 0 ? (
                            <div className="text-xs text-gray-400">Для этого предмета генераторов пока нет</div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {bankNumbers.map((n) => {
                                const off = bankBad.includes(n)
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    disabled={off}
                                    title={off ? "Задания этого номера идут с чертежом или файлом — в текст домашней работы они не помещаются" : undefined}
                                    onClick={() => toggleBankNum(n)}
                                    className={`w-9 h-9 rounded-xl text-xs transition-all ${
                                      off
                                        ? "bg-gray-500/[0.06] text-gray-300 cursor-not-allowed"
                                        : bankNums.includes(n)
                                        ? "bg-blue-600 text-white shadow-sm active:scale-[0.94]"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-[0.94]"
                                    }`}
                                  >
                                    {n}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                          {bankBad.length > 0 && bankNumbers.length > 0 && (
                            <div className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                              Бледные номера недоступны: их задания идут с чертежом или отдельным файлом, а домашняя работа хранит только текст.
                            </div>
                          )}
                        </div>

                        {themeGroups && themeGroups.length > 0 && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1.5">
                              Темы №{bankNums[0]} — {bankThemes.length ? `выбрано ${bankThemes.length}` : "любая"}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {themeGroups.map((g) => (
                                <button
                                  key={g.theme}
                                  type="button"
                                  onClick={() => setBankThemes((prev) => prev.includes(g.theme) ? prev.filter((x) => x !== g.theme) : [...prev, g.theme])}
                                  className={chipCls(bankThemes.includes(g.theme))}
                                >
                                  {g.theme}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <div className="text-xs text-gray-500 mb-1.5">Сколько заданий</div>
                          <div className="flex flex-wrap gap-1.5">
                            {BANK_COUNTS.map((n) => (
                              <button key={n} type="button" onClick={() => setBankCount(n)} className={chipCls(bankCount === n)}>
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>

                        {bankError && <div className="text-xs text-red-500">{bankError}</div>}

                        <button
                          type="button"
                          onClick={handleAssemble}
                          disabled={bankBusy || !bankNums.length}
                          className="bg-blue-600 text-white rounded-xl py-2 text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99] transition-transform flex items-center justify-center gap-1.5"
                        >
                          {bankBusy
                            ? <><span className="loader-dots"><i /><i /><i /></span>Собираем задания</>
                            : <><Icon name="grid" size={14} />{bankTasks.length ? "Собрать заново" : "Собрать задания"}</>}
                        </button>

                        {bankSkipped.length > 0 && (
                          <div className="text-[11px] text-amber-600 leading-snug">
                            № {bankSkipped.join(", ")} пропущены: их задания идут с чертежом, а в тексте домашней работы картинке взяться неоткуда.
                          </div>
                        )}

                        {bankTasks.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {bankTasks.map((t, i) => (
                              <div key={t.id || i} className="rounded-xl bg-gray-500/[0.06] dark:bg-white/[0.05] px-2.5 py-2 flex items-start gap-2.5">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/12 text-blue-600 dark:text-blue-400 text-[10px] font-semibold flex items-center justify-center">
                                  {i + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs text-gray-700 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: renderHomeworkMath(bank.taskText(t)) }} />
                                  <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                                    <span>№{t.number} · ответ:</span>
                                    <span dangerouslySetInnerHTML={{ __html: renderHomeworkMath(String(t.answer ?? "—")) }} />
                                  </div>
                                </div>
                                <button type="button" onClick={() => rerollBankTask(i)} title="Другое задание этого номера"
                                  className="text-gray-400 hover:text-blue-600 active:scale-90 transition-transform">
                                  <Icon name="repeat" size={13} />
                                </button>
                                <button type="button" onClick={() => removeBankTask(i)} title="Убрать задание"
                                  className="text-gray-300 hover:text-red-500 active:scale-90 transition-transform">
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
                        ИИ составит задания по теме и оформит их тестом с автоматической проверкой.
                      </PlanHint>
                    ) : (
                      <>
                        <input
                          value={genTopic}
                          onChange={(e) => setGenTopic(e.target.value)}
                          placeholder="Тема. Например: квадратные уравнения"
                          className="input-glass"
                        />
                        <input
                          value={genSubject}
                          onChange={(e) => setGenSubject(e.target.value)}
                          placeholder="Предмет (необязательно)"
                          className="input-glass"
                        />
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
                              <div key={i} className="rounded-lg bg-gray-500/[0.06] p-2 flex flex-col gap-1.5">
                                <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-400 pt-2 w-4 flex-shrink-0">{i + 1}.</span>
                                  <textarea
                                    value={t.question}
                                    onChange={(e) => updatePreviewTask(i, "question", e.target.value)}
                                    rows={2}
                                    className="input-glass flex-1 min-w-0 px-2 py-1.5 resize-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removePreviewTask(i)}
                                    className="text-gray-300 hover:text-red-500 pt-1.5 active:scale-90 transition-transform"
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
                                            <input
                                              value={o}
                                              onChange={(e) => updatePreviewOption(i, j, e.target.value)}
                                              className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                                            />
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 pl-6">
                                    <span className="text-xs text-gray-400 flex-shrink-0">Ответ:</span>
                                    <input
                                      value={t.answer}
                                      onChange={(e) => updatePreviewTask(i, "answer", e.target.value)}
                                      className="input-glass flex-1 min-w-0 px-2 py-1"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                            <div className="text-[11px] text-gray-400 leading-snug">
                              Проверьте вопросы и ответы: ИИ может ошибаться. Правки сохраняются сразу — задание уйдёт ученику в этом виде.
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
                {method === "file" && !!description.trim() && (
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

                {autoCheck && method === "file" && answersBlock}
              </div>
            </AutoHeight>
          </div>
        </div>

        {formError && <div className="text-xs text-red-500 mt-4 text-center">{formError}</div>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-5">
          <button onClick={close} className="press-fill border border-gray-200 rounded-xl px-5 py-2.5 text-sm text-gray-600">
            Отмена
          </button>
          <button onClick={handleSubmit} disabled={saving} className="bg-blue-600 text-white rounded-xl px-6 py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-transform">
            {saving ? "Сохраняем..." : isEditing ? "Сохранить" : "Задать"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}


// Сколько заданий видно до разворота: карточек в списке много, полный текст
// теста на 15 вопросов превращает страницу в простыню.
const TASKS_PREVIEW = 3

// Одно задание строкой: номер кружком, условие, правильный ответ справа.
function TaskLine({ t, options, answer }) {
  return (
    <div className="rounded-xl bg-gray-500/[0.06] dark:bg-white/[0.05] px-2.5 py-2">
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/12 text-blue-600 dark:text-blue-400 text-[10px] font-semibold flex items-center justify-center">
          {t.n}
        </span>
        <div
          className="text-xs text-gray-700 leading-relaxed min-w-0 flex-1"
          dangerouslySetInnerHTML={{ __html: renderHomeworkMath(t.text) }}
        />
        {answer && !options && (
          <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 ring-1 ring-green-500/30">
            <span dangerouslySetInnerHTML={{ __html: renderHomeworkMath(answer) }} />
          </span>
        )}
      </div>
      {options && (
        <div className="flex flex-wrap gap-1.5 mt-1.5 pl-[30px]">
          {options.map((o, j) => {
            const correct = answer != null && o === answer
            return (
              <span
                key={j}
                className={`text-[11px] px-2 py-0.5 rounded-full ring-1 ${
                  correct
                    ? "bg-green-500/15 text-green-700 ring-green-500/30"
                    : "text-gray-500 ring-gray-500/20"
                }`}
                dangerouslySetInnerHTML={{ __html: renderHomeworkMath(o) }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// Описание ДЗ: вступление + пронумерованные задания карточками (как видит ученик),
// а не сплошной абзац. Если разбить не удалось — показываем текст как есть.
function HomeworkTasks({ hw }) {
  const [showAll, setShowAll] = useState(false)
  if (!hw.description) return null

  const { intro, tasks } = parseHomeworkTasks(hw.description)
  const options = Array.isArray(hw.test_options) ? hw.test_options : null
  const answers = Array.isArray(hw.correct_answers) ? hw.correct_answers : []
  const hidden = Math.max(0, tasks.length - TASKS_PREVIEW)

  const line = (t, i) => (
    <TaskLine key={i} t={t} options={options?.[i] || null} answer={answers[i] ?? null} />
  )

  return (
    <div className="mt-2">
      {intro && (
        <div className="text-xs text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderHomeworkMath(intro) }} />
      )}

      {tasks.length > 0 && (
        <div className={`flex flex-col gap-1.5 ${intro ? "mt-2" : ""}`}>
          {tasks.slice(0, TASKS_PREVIEW).map(line)}

          {hidden > 0 && (
            <>
              <Collapse open={showAll}>
                <div className="flex flex-col gap-1.5 pb-1.5">{tasks.slice(TASKS_PREVIEW).map(line)}</div>
              </Collapse>
              <button
                onClick={() => setShowAll((v) => !v)}
                className="self-start inline-flex items-center gap-1 text-xs text-blue-600 hover:opacity-70 active:scale-[0.97] transition-all"
              >
                {showAll ? "Свернуть" : `Ещё ${hidden} ${plural(hidden, "задание", "задания", "заданий")}`}
                <Icon name="chevron-down" size={12} className={`transition-transform duration-300 ${showAll ? "rotate-180" : ""}`} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function HomeworkCard({ hw, studentName, studentPhone, studentAccountId, onUpdate, onEdit }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [grading, setGrading] = useState(false)
  const [comment, setComment] = useState(hw.comment || "")
  const [selectedGrade, setSelectedGrade] = useState(hw.grade || null)
  const status = STATUS_LABELS[hw.status] || STATUS_LABELS.assigned
  const typeInfo = TYPE_LABELS[hw.hw_type] || TYPE_LABELS.written
  const isPureTest = hw.hw_type === "test"

  const testPercent = hw.test_score != null && hw.question_count
    ? Math.round((hw.test_score / hw.question_count) * 100)
    : null
  const suggestedGrade = testPercent != null ? getGradeFromPercent(testPercent) : null

  async function setStatus(newStatus, grade) {
    const updates = { status: newStatus, comment, grade: grade ?? null }
    if (newStatus === "revision") {
      updates.test_score = null
      updates.student_answers = null
      updates.submission_url = null
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
        body: `«${hw.title}» — репетитор отправил на пересдачу${comment ? ": " + comment : ""}`,
      })
    }

    onUpdate()
    setGrading(false)
  }

  async function finishPureTest() {
    const grade = suggestedGrade
    await supabase.from("homework").update({ status: "done", grade }).eq("id", hw.id)
    onUpdate()
  }

  async function handleDelete() {
    setConfirmDelete(false)
    await supabase.from("homework").delete().eq("id", hw.id)
    onUpdate()
  }

  return (
    <div className="glass p-4">
      <ConfirmModal
        open={confirmDelete}
        danger
        title="Удалить задание?"
        message={`«${hw.title}» пропадёт и у вас, и у ученика — вместе с его ответами и оценкой.`}
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">{hw.title}</div>
            <span className="flex items-center gap-1 text-xs text-gray-400"><Icon name={typeInfo.iconName} size={12} />{typeInfo.label}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{studentName}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-1 rounded-full ${status.cls}`}>{status.label}</span>
          <button onClick={() => onEdit(hw)} className="text-gray-400 hover:text-blue-600 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-blue-50" title="Редактировать">
            <Icon name="edit" size={14} />
          </button>
          <button onClick={() => setConfirmDelete(true)} className="text-gray-400 hover:text-red-600 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50" aria-label="Удалить задание" title="Удалить">
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>

      <HomeworkTasks hw={hw} />

      {hw.deadline && (
        <div className={`text-xs mt-2 inline-flex items-center gap-1 ${isOverdue(hw) ? "text-red-500 font-medium" : "text-gray-400"}`}>
          {isOverdue(hw) && <Icon name="alert-triangle" size={12} />}
          {isOverdue(hw) ? "Просрочено · " : "Дедлайн: "}
          {parseLocalDate(hw.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
        </div>
      )}

      {hw.file_url && (
        <a href={hw.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:opacity-70 transition-opacity mt-2">
          <Icon name="paperclip" size={12} />Файл задания
        </a>
      )}

      {hw.test_score != null && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">Результат теста</div>
          <div className="text-sm font-medium text-blue-700">{hw.test_score} / {hw.question_count}</div>
        </div>
      )}

      {hw.submission_url && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-1">{hw.hw_type === "test" ? "Решение ученика:" : "Письменная работа:"}</div>
          <a href={hw.submission_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:opacity-70 transition-opacity">
            <Icon name="paperclip" size={12} />Открыть файл
          </a>
        </div>
      )}

      {hw.status === "submitted" && isPureTest && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {testPercent}% — рекомендуется оценка <span className="font-medium">{suggestedGrade}</span>
            </div>
            <button onClick={finishPureTest} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
              Завершить
            </button>
          </div>
        </div>
      )}

      {hw.status === "submitted" && !isPureTest && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {!grading ? (
            <button onClick={() => setGrading(true)} className="text-xs text-blue-600 hover:opacity-70 transition-opacity">
              Проверить и оценить
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              {testPercent != null && (
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                  Тестовая часть: {testPercent}% (рекомендуется {suggestedGrade})
                </div>
              )}

              <div>
                <div className="text-xs text-gray-500 mb-1">Оценка</div>
                <div className="flex gap-1.5">
                  {[2, 3, 4, 5].map((g) => (
                    <button
                      key={g}
                      onClick={() => setSelectedGrade(g)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        selectedGrade === g
                          ? GRADE_COLORS[g] + " border-transparent"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
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
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none resize-none"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setStatus("done", selectedGrade)}
                  disabled={!selectedGrade}
                  className="flex-1 bg-green-600 text-white rounded-lg py-1.5 text-xs hover:bg-green-700 disabled:opacity-40"
                >
                  Выполнено
                </button>
                <button
                  onClick={() => setStatus("revision", selectedGrade)}
                  className="flex-1 bg-amber-500 text-white rounded-lg py-1.5 text-xs hover:bg-amber-600"
                >
                  На доработку
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {hw.grade && hw.status === "done" && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">Итоговая оценка</span>
          <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${GRADE_COLORS[hw.grade]}`}>{hw.grade}</span>
        </div>
      )}

      {hw.comment && hw.status !== "submitted" && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-start gap-1">
          <Icon name="message" size={12} className="mt-0.5 flex-shrink-0" />{hw.comment}
        </div>
      )}
    </div>
  )
}

function StudentHomeworkGroup({ studentName, studentPhone, studentAccountId, items, onUpdate, onEdit }) {
  const [expanded, setExpanded] = useState(true)

  const pending = items.filter((h) => h.status === "submitted").length
  const needsAttention = items.filter((h) => h.status === "assigned" || h.status === "revision").length

  return (
    <div className="glass overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-gray-400 transition-transform duration-300 ${expanded ? "rotate-90" : ""}`}>›</span>
          <span className="text-sm font-medium">{studentName}</span>
          <span className="text-xs text-gray-400">{items.length} {items.length === 1 ? "задание" : "заданий"}</span>
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{pending} на проверке</span>
          )}
          {needsAttention > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{needsAttention} активных</span>
          )}
        </div>
      </button>

      <Collapse open={expanded}>
        <div className="px-4 pb-4 pt-1 flex flex-col gap-3 border-t border-white/40">
          {items.map((hw) => (
            <HomeworkCard key={hw.id} hw={hw} studentName={studentName} studentPhone={studentPhone} studentAccountId={studentAccountId} onUpdate={onUpdate} onEdit={onEdit} />
          ))}
        </div>
      </Collapse>
    </div>
  )
}

function Homework({ user, students }) {
  const [homework, setHomework] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState("all")
  const [editingHw, setEditingHw] = useState(null)

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
    setHomework(await signRows(data || [], { file_url: "homework", submission_url: "homework" }))
  }

  const overdueCount = homework.filter(isOverdue).length

  const FILTERS = [
    { id: "all", label: "Все", icon: "clipboard", tint: "text-blue-600 bg-blue-500/10", count: homework.length },
    { id: "assigned", label: "Выдано", icon: "file-text", tint: "text-blue-600 bg-blue-500/10" },
    { id: "submitted", label: "На проверке", icon: "clock", tint: "text-amber-600 bg-amber-500/12" },
    { id: "done", label: "Выполнено", icon: "check", tint: "text-green-600 bg-green-500/12" },
    { id: "revision", label: "На доработку", icon: "repeat", tint: "text-orange-600 bg-orange-500/12" },
    // Просрочку показываем отдельной кнопкой и только когда она есть —
    // пустой фильтр в списке ни к чему.
    ...(overdueCount ? [{ id: "overdue", label: "Просрочено", icon: "alert-triangle", tint: "text-red-600 bg-red-500/12", count: overdueCount }] : []),
  ]

  // Подчёркивание активной вкладки — одна полоска, которая переезжает с кнопки
  // на кнопку, а не появляется рывком в новом месте. Позицию берём с самой
  // кнопки: ширины у вкладок разные и на узком экране полоса ещё и скроллится.
  const tabsRef = useRef(null)
  const tabsScrollRef = useRef(null)
  const [ind, setInd] = useState(null)
  const indAnimated = useRef(false)

  useLayoutEffect(() => {
    const wrap = tabsRef.current
    if (!wrap) return
    const measure = () => {
      const el = wrap.querySelector(`[data-filter="${filter}"]`)
      if (!el) return
      setInd({ left: el.offsetLeft, width: el.offsetWidth })
      // На узком экране выбранная вкладка может быть наполовину за краем —
      // подтягиваем её в видимую часть, иначе полоска уезжает «в никуда».
      const sc = tabsScrollRef.current
      if (sc && indAnimated.current && sc.scrollWidth > sc.clientWidth) {
        const left = el.offsetLeft - 16
        const right = el.offsetLeft + el.offsetWidth - sc.clientWidth + 16
        const to = sc.scrollLeft > left ? left : sc.scrollLeft < right ? right : null
        if (to !== null) sc.scrollTo({ left: Math.max(0, to), behavior: "smooth" })
      }
      indAnimated.current = true
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [filter, overdueCount])

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
  const groupNames = Object.keys(grouped).sort()

  return (
    <div className="p-4 md:p-6">
      {/* Варианты ОГЭ/ЕГЭ — свой раздел меню, а не вкладка внутри этого:
          у ученика они тоже отдельным пунктом, и в боковом меню репетитора
          слова «Варианты» раньше не было вовсе. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <h1 className="text-xl font-medium">Домашние задания</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary px-4 py-2 text-sm self-stretch sm:self-auto">
          + Задание
        </button>
      </div>

      {(
        <>
          {/* Фильтры — сводкой одной полосой: сразу видно, сколько заданий в каждом
              состоянии, и та же полоса переключает список. */}
          <div ref={tabsScrollRef} className="glass no-scrollbar overflow-x-auto mb-4">
            <div ref={tabsRef} className="relative flex min-w-full divide-x divide-gray-500/12 dark:divide-white/10">
              {FILTERS.map((f) => {
                const on = f.id === filter
                const count = f.count ?? homework.filter((h) => h.status === f.id).length
                return (
                  <button
                    key={f.id}
                    data-filter={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`press-fill flex-1 min-w-[7.5rem] sm:min-w-[9rem] flex items-center gap-3 px-3 sm:px-4 py-3.5 text-left transition-colors duration-200 ${
                      on ? "bg-blue-500/[0.07] dark:bg-blue-400/10" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl hidden sm:flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${count > 0 ? f.tint : "text-gray-400 bg-gray-500/8"}`}>
                      <Icon name={f.icon} size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xl font-semibold leading-none transition-colors duration-200 ${count > 0 ? f.tint.split(" ")[0] : "text-gray-400"}`}>{count}</div>
                      <div className={`text-[11px] mt-1.5 truncate transition-colors duration-200 ${on ? "text-gray-600 font-medium" : "text-gray-400"}`}>{f.label}</div>
                    </div>
                  </button>
                )
              })}
              {ind && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 left-0 h-[3px] rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
                  style={{ width: ind.width, transform: `translateX(${ind.left}px)` }}
                />
              )}
            </div>
          </div>

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
                      Задайте первое: текстом, файлом или тестом с автопроверкой — ученик увидит его в своём кабинете.
                    </p>
                    <button onClick={() => setShowModal(true)} className="btn-primary px-4 py-2 text-sm">
                      + Задание
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div key={filter} className="tab-swap flex flex-col gap-3">
              {groupNames.map((name) => {
                const s = students.find(st => st.name === name)
                return (
                  <StudentHomeworkGroup
                    key={name}
                    studentName={name}
                    studentPhone={s?.phone || null}
                    studentAccountId={s?.studentAccountId || null}
                    items={grouped[name]}
                    onUpdate={loadHomework}
                    onEdit={setEditingHw}
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      {showModal && (
        <CreateHomeworkModal
          students={students}
          tutorId={user.id}
          onClose={() => setShowModal(false)}
          onCreated={loadHomework}
        />
      )}

      {editingHw && (
        <CreateHomeworkModal
          students={students}
          tutorId={user.id}
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
      <h1 className="text-xl font-medium mb-1">Задания</h1>
      <p className="text-sm text-gray-500 mb-5">Домашние задания ученикам и их проверка.</p>
      <PlanLock feature="homework" title="Домашние задания" text="Выдача заданий ученикам, таймер как на экзамене, проверка с комментариями и возврат на доработку." />
    </div>
  )
}

export default HomeworkGate
