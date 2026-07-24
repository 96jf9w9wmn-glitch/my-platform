import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import Icon from "../components/Icon"
import NavIcon from "../components/NavIcon"
import StudentSidebar from "../components/StudentSidebar"
import Chat from "./Chat"
import StudentOnboardingModal from "../components/StudentOnboardingModal"
const Board = lazy(() => import("../components/Board"))
import { parseLocalDate, isLessonConducted, getInitials, renderTaskMath, renderHomeworkMath, formatPhone } from "../utils"

function Part2Upload({ taskNum, submissionId, existingUrl, onUpload }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split(".").pop()
    const fileName = submissionId + "/task" + taskNum + "." + ext
    const { error } = await supabase.storage.from("variants").upload(fileName, file, { upsert: true })

    if (!error) {
      const { data: urlData } = supabase.storage.from("variants").getPublicUrl(fileName)
      const { data: sub } = await supabase
        .from("variant_submissions")
        .select("part2_files")
        .eq("id", submissionId)
        .single()

      const updatedFiles = { ...(sub?.part2_files || {}), [taskNum]: urlData.publicUrl }
      await supabase.from("variant_submissions").update({ part2_files: updatedFiles }).eq("id", submissionId)
      onUpload()
    }
    setUploading(false)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-24">Задание {taskNum}</span>
      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
      {existingUrl ? (
        <div className="flex items-center gap-2 flex-1">
          <a href={existingUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:opacity-70 transition-opacity">
            <span className="flex items-center gap-1"><Icon name="check" size={12} />Файл загружен</span>
          </a>
          <button onClick={() => fileRef.current.click()} className="text-xs text-gray-400 hover:opacity-70 transition-opacity">
            Заменить
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current.click()}
          disabled={uploading}
          className="flex-1 border border-dashed border-gray-200 rounded-lg py-2 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
        >
          {uploading ? "Загружаем..." : <span className="flex items-center justify-center gap-1.5"><Icon name="paperclip" size={14} />Загрузить файл</span>}
        </button>
      )}
    </div>
  )
}
const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]

function getDaysInMonth(year, month) {
  const days = []
  const date = new Date(year, month, 1)
  while (date.getMonth() === month) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

function formatLocalDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function StudentScheduleCalendar({ student, onOpenBoard }) {
  const [baseDate, setBaseDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const monthDays = getDaysInMonth(year, month)
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const emptyDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
  const monthLabel = `${MONTH_NAMES[month]} ${year}`
  const todayStr = formatLocalDate(new Date())

  function prevMonth() {
    const d = new Date(baseDate)
    d.setMonth(d.getMonth() - 1)
    setBaseDate(d)
  }

  function nextMonth() {
    const d = new Date(baseDate)
    d.setMonth(d.getMonth() + 1)
    setBaseDate(d)
  }

  function getLessonsForDate(dateStr) {
    return (student.lessons || [])
      .filter((l) => l.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time))
  }

  const selectedDayLessons = selectedDay ? getLessonsForDate(selectedDay) : []

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="text-gray-400 hover:text-gray-600 text-xl px-2">‹</button>
        <span className="text-sm font-medium text-gray-700">{monthLabel}</span>
        <button onClick={nextMonth} className="text-gray-400 hover:text-gray-600 text-xl px-2">›</button>
      </div>

      <div className="glass p-3 mb-3">
        <div className="grid grid-cols-7 mb-2">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array(emptyDays).fill(null).map((_, i) => (
            <div key={"e" + i} />
          ))}
          {monthDays.map((day) => {
            const dateStr = formatLocalDate(day)
            const dayLessons = getLessonsForDate(dateStr)
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDay
            const isWeekend = day.getDay() === 0 || day.getDay() === 6

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                className={`relative flex flex-col items-center py-1 rounded-xl transition-all ${
                  isSelected ? "bg-blue-600 text-white" : isToday ? "bg-blue-100" : ""
                }`}
              >
                <span className={`text-sm font-medium ${
                  isSelected ? "text-white" : isToday ? "text-blue-600" : isWeekend ? "text-gray-400" : "text-gray-700"
                }`}>
                  {day.getDate()}
                </span>
                {dayLessons.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                    {dayLessons.slice(0, 3).map((_, i) => (
                      <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-blue-500"}`} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="glass p-4">
          <div className="text-sm font-medium mb-3 text-gray-700">
            {new Date(selectedDay + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          {selectedDayLessons.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-4">Занятий нет</div>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedDayLessons.map((l, i) => (
                <div key={i} className="bg-blue-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-blue-700">{l.time}</div>
                      <div className="text-xs text-blue-500">{l.duration} мин</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => onOpenBoard?.()}
                        className="press-tap text-xs bg-white text-blue-600 dark:text-blue-400 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                        <span className="flex items-center gap-1"><Icon name="clipboard" size={12} />Доска</span>
                      </button>
                      {student.callUrl && (
                        <a href={student.callUrl} target="_blank" rel="noreferrer"
                          className="text-xs bg-white text-green-600 dark:text-green-400 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors">
                          <span className="flex items-center gap-1"><Icon name="video" size={12} />Звонок</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedDay && (
        <div className="glass p-4">
          <div className="text-sm font-medium mb-3 text-gray-700">Занятия в {MONTH_NAMES[month].toLowerCase()}</div>
          {monthDays.flatMap((day) => getLessonsForDate(formatLocalDate(day))).length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-4">Занятий нет</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {monthDays.flatMap((day) =>
                getLessonsForDate(formatLocalDate(day)).map((l) => ({ ...l, date: formatLocalDate(day) }))
              ).map((l, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="text-sm">
                    {new Date(l.date + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} в {l.time}
                  </div>
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{l.duration} мин</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function calcStreak(homework) {
  const withDeadline = homework
    .filter((h) => h.deadline && (h.status === "done" || h.status === "submitted" || h.status === "revision"))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))

  let current = 0
  let best = 0
  for (const hw of withDeadline) {
    const onTime = hw.submitted_at && new Date(hw.submitted_at) <= new Date(hw.deadline + "T23:59:59")
    if (onTime) {
      current++
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }
  return { current, best }
}

function StreakBadge({ homework }) {
  const { current, best } = calcStreak(homework)

  if (best === 0) return null

  return (
    <div className="glass-tint-amber px-4 py-3 mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔥</span>
        <div>
          <div className="text-lg font-medium text-amber-700">
            {current} {current === 1 ? "задание" : current >= 2 && current <= 4 ? "задания" : "заданий"} подряд
          </div>
          <div className="text-xs text-amber-500">сдано вовремя без пропусков</div>
        </div>
      </div>
      {best > current && (
        <div className="text-right">
          <div className="text-xs text-amber-500">Рекорд</div>
          <div className="text-sm font-medium text-amber-700">{best}</div>
        </div>
      )}
    </div>
  )
}

function ProgressChart({ variants, targetScore, maxScore }) {
  const gradedSorted = variants
    .filter((v) => v.submission?.status === "graded" && v.submission?.total_score != null)
    .sort((a, b) => new Date(a.submission.created_at || 0) - new Date(b.submission.created_at || 0))

  if (gradedSorted.length < 2) return null

  const chartData = gradedSorted.map((v, i) => ({
    name: "В" + (i + 1),
    title: v.title,
    score: v.submission.total_score,
  }))

  return (
    <div className="glass p-5 mb-4">
      <h2 className="text-base font-medium mb-4">Динамика баллов</h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, maxScore]} tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => [value + " баллов", "Результат"]}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.title || label}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
          />
          {targetScore && (
            <Line
              type="monotone"
              dataKey={() => targetScore}
              stroke="#22c55e"
              strokeDasharray="5 5"
              dot={false}
              strokeWidth={1.5}
              name="Цель"
            />
          )}
          <Line
            type="monotone"
            dataKey="score"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#2563eb" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {targetScore && (
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <div className="w-3 h-0.5 bg-blue-600" /> Твой результат
          <div className="w-3 h-0.5 bg-green-500 ml-3" style={{ borderTop: "1px dashed #22c55e" }} /> Цель
        </div>
      )}
    </div>
  )
}

const GRADE_COLORS = {
  5: "bg-green-100 text-green-700",
  4: "bg-blue-100 text-blue-700",
  3: "bg-amber-100 text-amber-700",
  2: "bg-red-100 text-red-700",
}

// Вид карточки ДЗ у ученика по статусу: цвет плитки-иконки (аватар) и чипа.
// Тинты на opacity → одинаково ок в светлой и тёмной теме.
const HW_STATUS = {
  assigned:  { label: "Выдано",      icon: "clipboard", tile: "from-blue-400/25 to-blue-500/10 text-blue-600 dark:text-blue-300",     chip: "bg-blue-500/10 text-blue-600 dark:text-blue-300 ring-1 ring-blue-500/20" },
  submitted: { label: "На проверке", icon: "clock",     tile: "from-indigo-400/25 to-indigo-500/10 text-indigo-600 dark:text-indigo-300", chip: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/20" },
  revision:  { label: "Доработать",  icon: "repeat",    tile: "from-amber-400/25 to-amber-500/10 text-amber-600 dark:text-amber-300",   chip: "bg-amber-500/10 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/20" },
  done:      { label: "Выполнено",   icon: "check",     tile: "from-green-400/25 to-green-500/10 text-green-600 dark:text-green-300",   chip: "bg-green-500/10 text-green-600 dark:text-green-300 ring-1 ring-green-500/20" },
}

// Плоский короткий текст описания для превью в карточке (без LaTeX-разметки).
function hwPreview(text) {
  if (!text) return ""
  return text
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2")
    .replace(/\\sqrt(?:\[[^\]]*\])?\{([^{}]+)\}/g, "√$1")
    .replace(/\\[a-zA-Z]+/g, "").replace(/[{}$^]/g, "").replace(/\\[()[\]]/g, "")
    .replace(/\s+/g, " ").trim()
}

// Разбивает описание ДЗ на вступление и отдельные пронумерованные задания
// («1. …», «2. …»), чтобы показать каждое своей карточкой, а не сплошным абзацем.
function parseHomeworkTasks(desc) {
  if (!desc) return { intro: "", tasks: [] }
  const tasks = []
  const intro = []
  let cur = null
  for (const raw of desc.split("\n")) {
    const line = raw.trim()
    const m = line.match(/^(\d+)[.)]\s+(.*)$/)
    if (m) { if (cur) tasks.push(cur); cur = { n: m[1], text: m[2] } }
    else if (cur) { if (line) cur.text += "\n" + line }
    else if (line) intro.push(line)
  }
  if (cur) tasks.push(cur)
  return { intro: intro.join("\n"), tasks }
}

// Дедлайн со срочностью: просрочено/сегодня/завтра — цветом, иначе дата.
function deadlineInfo(hw) {
  if (!hw.deadline) return null
  const d = parseLocalDate(hw.deadline)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((d - today) / 86400000)
  const dateStr = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
  if (hw.status === "done" || hw.status === "submitted") return { text: dateStr, cls: "text-gray-400", icon: "calendar" }
  if (days < 0) return { text: "Просрочено", cls: "text-red-500", icon: "alert-triangle" }
  if (days === 0) return { text: "Сегодня", cls: "text-amber-600", icon: "clock" }
  if (days === 1) return { text: "Завтра", cls: "text-amber-600", icon: "clock" }
  if (days <= 3) return { text: `Через ${days} дн.`, cls: "text-amber-600", icon: "clock" }
  return { text: dateStr, cls: "text-gray-400", icon: "calendar" }
}

function StudentHomeworkCard({ hw, index, onSelect }) {
  const meta = HW_STATUS[hw.status] || HW_STATUS.assigned
  const dl = deadlineInfo(hw)
  const isDone = hw.status === "done"
  const typeLabel = hw.hw_type === "test" ? `Тест · ${hw.question_count || 0} вопр.`
    : hw.hw_type === "combined" ? "Тест + письменное" : "Письменное"
  const preview = hw.hw_type !== "test" ? hwPreview(hw.description) : ""
  const icon = isDone ? "check" : hw.hw_type === "test" ? "clipboard" : hw.hw_type === "combined" ? "file-text" : "edit"
  return (
    <button
      onClick={() => onSelect(hw)}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className="item-enter press-tap text-left w-full glass rounded-2xl p-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform"
    >
      <div className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br ${meta.tile}`}>
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="font-medium text-sm truncate flex-1">{hw.title}</div>
          {isDone && hw.grade ? (
            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${GRADE_COLORS[hw.grade]}`}>{hw.grade}</span>
          ) : (
            <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${meta.chip}`}>{meta.label}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-[11px]">
          <span className="text-gray-400 shrink-0">{typeLabel}</span>
          {dl && (
            <span className={`inline-flex items-center gap-1 shrink-0 ${dl.cls}`}>
              <span className="text-gray-300">•</span>
              {dl.icon && <Icon name={dl.icon} size={10} />}
              {dl.text}
            </span>
          )}
        </div>
        {preview && <div className="text-[11px] text-gray-400 mt-1 line-clamp-1">{preview}</div>}
      </div>
      <Icon name="chevron-right" size={16} className="shrink-0 text-gray-300" />
    </button>
  )
}

function StudentHomeworkList({ homework, onSelect }) {
  const [filter, setFilter] = useState("all")
  const match = {
    all: () => true,
    active: (h) => h.status === "assigned" || h.status === "revision",
    submitted: (h) => h.status === "submitted",
    done: (h) => h.status === "done",
  }
  const FILTERS = [
    { key: "all", label: "Все" },
    { key: "active", label: "Активные" },
    { key: "submitted", label: "Проверка" },
    { key: "done", label: "Готово" },
  ]
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, homework.filter(match[f.key]).length]))
  const list = homework.filter(match[filter])
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => {
          const on = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.96] ${
                on ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm" : "glass-sm text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.label}
              <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] ${on ? "bg-white/25" : "bg-black/5 dark:bg-white/10"}`}>{counts[f.key]}</span>
            </button>
          )
        })}
      </div>
      {list.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-10 border border-dashed border-white/50 glass-sm">
          {filter === "all" ? "Заданий пока нет" : "В этой категории пусто"}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((hw, i) => <StudentHomeworkCard key={hw.id} hw={hw} index={i} onSelect={onSelect} />)}
        </div>
      )}
    </div>
  )
}

function HomeworkDetail({ hw, onBack, onUpload, onSubmitTest }) {
  const [uploading, setUploading] = useState(false)
  const [testAnswers, setTestAnswers] = useState(Array(hw.question_count || 0).fill(""))
  const [submittingTest, setSubmittingTest] = useState(false)
  const [solutionFile, setSolutionFile] = useState(null)
  const fileRef = useRef()
  const solutionCameraRef = useRef()
  const solutionFileRef = useRef()

  const hasTest = hw.hw_type === "test" || hw.hw_type === "combined"
  const hasWritten = hw.hw_type === "written" || hw.hw_type === "combined"
  const testDone = hw.test_score != null
  const requireSolution = !!hw.require_solution && hasTest

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    await onUpload(hw.id, file)
    setUploading(false)
  }

  async function handleSubmitTest() {
    if (testAnswers.every((a) => !a.trim())) {
      alert("Введи хотя бы один ответ!")
      return
    }
    if (requireSolution && !solutionFile) {
      alert("Прикрепи фото или файл своего решения!")
      return
    }
    setSubmittingTest(true)
    await onSubmitTest(hw.id, testAnswers, solutionFile)
    setSolutionFile(null)
    setSubmittingTest(false)
  }

  const showWrittenUpload = hasWritten && (hw.status === "assigned" || hw.status === "revision") && (!hasTest || testDone)

  const meta = HW_STATUS[hw.status] || HW_STATUS.assigned
  const dl = deadlineInfo(hw)
  const typeLabel = hw.hw_type === "test" ? `Тест · ${hw.question_count || 0} вопр.`
    : hw.hw_type === "combined" ? "Тест + письменное" : "Письменное"
  const headerIcon = hw.status === "done" ? "check" : hw.hw_type === "test" ? "clipboard" : hw.hw_type === "combined" ? "file-text" : "edit"
  const { intro, tasks } = parseHomeworkTasks(hw.description)

  return (
    <div>
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1 active:scale-[0.97] transition-transform">
        ← Назад
      </button>

      <div className="glass p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${meta.tile}`}>
            <Icon name={headerIcon} size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-medium leading-snug">{hw.title}</h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px]">
              <span className={`px-2 py-0.5 rounded-full font-medium ${meta.chip}`}>{meta.label}</span>
              <span className="text-gray-400">{typeLabel}</span>
              {dl && (
                <span className={`inline-flex items-center gap-1 ${dl.cls}`}>
                  {dl.icon && <Icon name={dl.icon} size={10} />}{dl.text}
                </span>
              )}
            </div>
          </div>
        </div>

        {intro && <div className="text-sm text-gray-600 mt-4" dangerouslySetInnerHTML={{ __html: renderHomeworkMath(intro) }} />}

        {tasks.length > 0 && (
          <div className="flex flex-col gap-2 mt-3">
            {tasks.map((t, i) => (
              <div
                key={i}
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                className="item-enter glass-sm rounded-2xl px-3 py-2.5 flex items-start gap-2.5"
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300 text-xs font-semibold flex items-center justify-center mt-0.5">{t.n}</span>
                <div className="text-sm text-gray-700 dark:text-gray-200 min-w-0 flex-1 pt-0.5" dangerouslySetInnerHTML={{ __html: renderHomeworkMath(t.text) }} />
              </div>
            ))}
          </div>
        )}

        {hw.file_url && (
          <a href={hw.file_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:opacity-70 transition-opacity mt-4 inline-block">
            <span className="flex items-center gap-1"><Icon name="paperclip" size={12} />Открыть файл задания</span>
          </a>
        )}
      </div>

      {hw.status === "done" && (
        <div className="glass-tint-green p-5 text-center mb-4">
          <div className="text-green-600 mb-2 flex justify-center"><Icon name="check" size={28} /></div>
          <div className="text-sm font-medium text-green-700">Задание выполнено!</div>
          {hw.grade && (
            <div className={`inline-block mt-2 text-lg font-medium px-4 py-1 rounded-full ${GRADE_COLORS[hw.grade]}`}>
              Оценка: {hw.grade}
            </div>
          )}
          {hw.comment && <div className="text-xs text-green-600 mt-2 flex items-start gap-1"><Icon name="message" size={12} className="mt-0.5 flex-shrink-0" />{hw.comment}</div>}
        </div>
      )}

      {hasTest && !testDone && (hw.status === "assigned" || hw.status === "revision") && (
        <div className="glass p-5 mb-4">
          {hw.status === "revision" && hw.comment && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 mb-4">
              <span className="flex items-start gap-1"><Icon name="message" size={12} className="mt-0.5 flex-shrink-0" />Комментарий репетитора: {hw.comment}</span>
            </div>
          )}
          <h3 className="text-base font-medium mb-4">Тест — введи ответы</h3>
          <div
            className="grid gap-2 mb-4"
            style={{
              gridTemplateRows: `repeat(${Math.ceil(testAnswers.length / 3)}, auto)`,
              gridAutoFlow: "column",
            }}
          >
            {testAnswers.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                <input
                  value={a}
                  onChange={(e) => {
                    const updated = [...testAnswers]
                    updated[i] = e.target.value
                    setTestAnswers(updated)
                  }}
                  placeholder="Ответ"
                  className="input-glass flex-1 px-2 py-1.5"
                />
              </div>
            ))}
          </div>
          {requireSolution && (
            <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-sm font-medium mb-1">Прикрепи решение</div>
              <div className="text-xs text-gray-400 mb-3">Сфотографируй или загрузи файл с черновиком — репетитор его увидит</div>
              <input ref={solutionCameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { if (e.target.files[0]) setSolutionFile(e.target.files[0]) }} />
              <input ref={solutionFileRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={(e) => { if (e.target.files[0]) setSolutionFile(e.target.files[0]) }} />
              {solutionFile ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon name="check" size={14} className="text-green-600 flex-shrink-0" />
                    <span className="text-sm text-green-700 truncate">{solutionFile.name}</span>
                  </div>
                  <button onClick={() => setSolutionFile(null)} className="text-xs text-gray-400 hover:text-red-500 ml-3 flex-shrink-0">Убрать</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => solutionCameraRef.current.click()}
                    className="flex-1 flex flex-col items-center gap-1.5 border border-dashed border-blue-200 bg-blue-50/50 rounded-xl py-3 text-blue-600 hover:bg-blue-50 transition-colors">
                    <Icon name="camera" size={18} />
                    <span className="text-xs font-medium">Камера</span>
                  </button>
                  <button onClick={() => solutionFileRef.current.click()}
                    className="flex-1 flex flex-col items-center gap-1.5 border border-dashed border-gray-200 rounded-xl py-3 text-gray-500 hover:bg-gray-50 transition-colors">
                    <Icon name="paperclip" size={18} />
                    <span className="text-xs font-medium">Файл</span>
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleSubmitTest}
            disabled={submittingTest || (requireSolution && !solutionFile)}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {submittingTest ? "Проверяем..." : requireSolution ? "Отправить тест и решение" : "Отправить тест"}
          </button>
        </div>
      )}

      {hasTest && testDone && (
        <div className="glass-tint-blue p-4 mb-4">
          <div className="text-sm font-medium text-blue-700 flex items-center gap-1"><Icon name="check" size={14} />Тест проверен</div>
          <div className="text-sm text-blue-600 mt-1">
            {hw.test_score} / {hw.question_count} ({Math.round((hw.test_score / hw.question_count) * 100)}%)
          </div>
        </div>
      )}

      {hasTest && testDone && hw.student_answers && hw.correct_answers && (
        <div className="glass p-5 mb-4">
          <h3 className="text-sm font-medium mb-3">Разбор ответов</h3>
          <div className="flex flex-col gap-1">
            {hw.correct_answers.map((correct, i) => {
              const studentAns = hw.student_answers[i] || "—"
              const isCorrect = studentAns.trim().toLowerCase() === correct.trim().toLowerCase()
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                    isCorrect ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  <span className="text-gray-500 w-6">{i + 1}</span>
                  <span className={isCorrect ? "text-green-700 font-medium flex-1" : "text-red-700 font-medium flex-1"}>
                    {studentAns}
                  </span>
                  {!isCorrect && (
                    <span className="text-gray-400 text-xs">
                      правильно: <span className="text-gray-700 font-medium">{correct}</span>
                    </span>
                  )}
                  {isCorrect && <Icon name="check" size={12} className="text-green-500" />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showWrittenUpload && (
        <div className="glass p-5">
          {hw.status === "revision" && hw.comment && !hasTest && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 mb-4">
              <span className="flex items-start gap-1"><Icon name="message" size={12} className="mt-0.5 flex-shrink-0" />Комментарий репетитора: {hw.comment}</span>
            </div>
          )}
          <h3 className="text-base font-medium mb-3">Загрузи выполненную работу</h3>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileRef.current.click()}
            disabled={uploading}
            className="w-full border border-dashed border-gray-200 rounded-lg py-3 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "Загружаем..." : <span className="flex items-center justify-center gap-1.5"><Icon name="paperclip" size={14} />Загрузить файл</span>}
          </button>
        </div>
      )}

      {hw.status === "submitted" && hw.hw_type !== "test" && (
        <div className="glass-tint-blue p-5 text-center">
          <div className="text-sm font-medium text-blue-700">На проверке у репетитора</div>
          {hw.submission_url && (
            <a href={hw.submission_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:opacity-70 transition-opacity mt-2 inline-block">
              <span className="flex items-center gap-1"><Icon name="paperclip" size={12} />Твоя работа</span>
            </a>
          )}
        </div>
      )}
    </div>
  )
}


function CopyCodeBlock({ code }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-700">
      <div className="text-xs text-gray-400 mb-1.5">Код для родителей</div>
      <div className="flex items-center gap-2">
        <code className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-lg tracking-widest text-gray-700 dark:text-gray-300 flex-1 text-center">
          {code}
        </code>
        <button
          onClick={copy}
          className={`text-xs flex-shrink-0 transition-colors ${copied ? "text-green-500" : "text-blue-500 hover:text-blue-700"}`}
        >
          {copied ? "Скопировано!" : "Копировать"}
        </button>
      </div>
    </div>
  )
}

// По заголовку уведомления понимаем, на какую вкладку ученика вести при клике,
// чтобы сразу открыть детали (проверенный вариант, ДЗ, сообщение в чате).
function studentNotifTarget(title) {
  const t = (title || "").toLowerCase()
  if (t.startsWith("сообщение от")) return "chat"
  if (t.includes("вариант")) return "variants"
  if (t.includes("задани") || t.includes("дз")) return "homework"
  return null
}

function StudentNotificationBell({ userId, onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const [ringKey, setRingKey] = useState(0)
  const btnRef = useRef(null)
  const closeTimer = useRef(null)

  useEffect(() => { loadNotifications() }, [])

  async function loadNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  function closePanel() {
    clearTimeout(closeTimer.current)
    setIsClosing(true)
    closeTimer.current = setTimeout(() => { setOpen(false); setIsClosing(false) }, 200)
  }

  function handleOpen(e) {
    e.stopPropagation()
    setRingKey(k => k + 1)
    if (open) { closePanel(); return }
    clearTimeout(closeTimer.current)
    setIsClosing(false)
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 12, right: window.innerWidth - rect.right })
    loadNotifications()
    setOpen(true)
  }

  useEffect(() => {
    if (!open || isClosing) return
    function handleClick() { closePanel() }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [open, isClosing])

  async function markRead(id) {
    await supabase.from("notifications").update({ read: true }).eq("id", id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  function handleNotifClick(n) {
    if (!n.read) markRead(n.id)
    const target = studentNotifTarget(n.title)
    if (target) { closePanel(); onNavigate?.(target) }
  }

  async function deleteNotification(id) {
    await supabase.from("notifications").delete().eq("id", id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unread = notifications.filter(n => !n.read).length

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
      >
        <span key={ringKey} className={ringKey > 0 ? "bell-ringing" : "inline-flex"}>
          <Icon name="bell" size={16} />
        </span>
        {unread > 0 && (
          <span className="badge-pulse absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[10px] font-semibold leading-none rounded-full flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          className={`fixed z-[9999] w-80 glass-modal shadow-2xl rounded-2xl overflow-hidden ${isClosing ? "animate-out" : "popup-bubble"}`}
          style={{ top: pos.top, right: pos.right }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Уведомления</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-500 hover:text-blue-700">
                Прочитать все
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-8">Нет уведомлений</div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={`group px-4 py-3 border-b border-gray-50 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${!n.read ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{n.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    {studentNotifTarget(n.title) && <Icon name="chevron-right" size={14} className="text-gray-300 group-hover:text-gray-400 transition-colors" />}
                    <button
                      onClick={e => { e.stopPropagation(); deleteNotification(n.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// Результат сдачи части 1 — вместо системного alert() показываем модалку в стиле
// приложения: кольцо-прогресс с долей верных, ободряющая подпись, кнопка закрытия.
function SubmitResultDialog({ score, max, onClose }) {
  const ratio = max > 0 ? score / max : 0
  const pct = Math.round(ratio * 100)
  // Мотивационное сообщение по доле верных ответов — от «идеально» до «не сдавайся».
  const tone =
    score === max
      ? { ring: "#34c759", text: "text-green-600", icon: "party", title: "Идеально!", msg: "Все ответы верные — так держать!" }
    : ratio >= 0.8
      ? { ring: "#34c759", text: "text-green-600", icon: "sparkles", title: "Отличный результат!", msg: "Ты почти у цели — совсем немного до максимума." }
    : ratio >= 0.6
      ? { ring: "#007AFF", text: "text-blue-600", icon: "check", title: "Хорошая работа!", msg: "Крепкий результат. Разбери спорные задания — и будет ещё лучше." }
    : ratio >= 0.4
      ? { ring: "#007AFF", text: "text-blue-600", icon: "book", title: "Неплохо!", msg: "Ты на верном пути. Повтори темы, где ошибся, — прогресс близко." }
    : score > 0
      ? { ring: "#ff9500", text: "text-amber-600", icon: "target", title: "Есть над чем поработать", msg: "Каждая ошибка — это тема для роста. Разбери их с репетитором." }
      : { ring: "#ff9500", text: "text-amber-600", icon: "leaf", title: "Не сдавайся!", msg: "Начало положено. Разбери решения — в следующий раз будет лучше." }
  const R = 42, C = 2 * Math.PI * R
  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm dialog-fade"
      onClick={onClose}
    >
      <div
        className="glass-modal rounded-3xl shadow-2xl w-full max-w-xs p-6 flex flex-col items-center text-center popup-bubble"
        style={{ transformOrigin: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-200/70 dark:text-white/10" />
            <circle
              cx="50" cy="50" r={R} fill="none" stroke={tone.ring} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - ratio)}
              style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.34,1.56,0.64,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-semibold ${tone.text}`}>{score}<span className="text-gray-400 text-lg">/{max}</span></span>
            <span className="text-[11px] text-gray-400">{pct}%</span>
          </div>
        </div>
        <div
          className="mt-4 w-12 h-12 rounded-full flex items-center justify-center"
          style={{ color: tone.ring, backgroundColor: tone.ring + "1f" }}
        >
          <Icon name={tone.icon} size={24} />
        </div>
        <h3 className="mt-1 text-base font-semibold text-gray-800 dark:text-gray-100">{tone.title}</h3>
        <p className="mt-1 text-sm text-gray-500 leading-snug">{tone.msg}</p>
        <p className="mt-2 text-xs text-gray-400">Часть 1 · {score} из {max} баллов</p>
        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-b from-[#0a84ff] to-[#0060df] text-white text-sm font-medium shadow-sm hover:opacity-95 active:scale-[0.98] transition"
        >
          Готово
        </button>
      </div>
    </div>,
    document.body
  )
}

function StudentDashboard({ user, students, studentsLoaded, onLogout, onReloadStudents }) {
  const [activeTab, setActiveTab] = useState("schedule")
  const variantsCacheKey = `variants_cache_${user.id}`
  const [variants, setVariants] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`variants_cache_${user.id}`)) || [] } catch { return [] }
  })
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [part1Answers, setPart1Answers] = useState(Array(19).fill(""))
  const [submitting, setSubmitting] = useState(false)
  const [resultDialog, setResultDialog] = useState(null)
  const [tutorCode, setTutorCode] = useState("")
  const [tutorLinking, setTutorLinking] = useState(false)
  const [tutorLinkError, setTutorLinkError] = useState("")
  const [tutorLinkSuccess, setTutorLinkSuccess] = useState("")
  const [homework, setHomework] = useState([])
  const [selectedHomework, setSelectedHomework] = useState(null)
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark")
  const [avatarOverride, setAvatarOverride] = useState(null)
  const autoCreateRef = useRef(false)
  const studentAvatarRef = useRef()

  const [tutorName, setTutorName] = useState("")
  const [chatUnread, setChatUnread] = useState(0)
  const [boardOpen, setBoardOpen] = useState(false)

  // Опросник онбординга: показываем один раз, пока onboarded !== true.
  // Статус тянем прямо из student_accounts (в сессионных RPC его нет).
  const [needsOnboard, setNeedsOnboard] = useState(false)
  useEffect(() => {
    let alive = true
    supabase.from("student_accounts").select("onboarded").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (alive && data && data.onboarded === false) setNeedsOnboard(true) })
    return () => { alive = false }
  }, [user.id])

  useEffect(() => {
    document.title = "Мой кабинет — Precettore"
    return () => { document.title = "Precettore" }
  }, [])

  useEffect(() => {
    if (user.profile?.tutor_id) {
      supabase.from("tutors").select("name").eq("id", user.profile.tutor_id).single()
        .then(({ data }) => { if (data) setTutorName(data.name) })
    }
  }, [user.profile?.tutor_id])

  useEffect(() => {
    const myId = `s:${user.id}`
    supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", myId)
      .eq("read", false)
      .then(({ count }) => setChatUnread(count || 0))

    const ch = supabase.channel(`chat_unread_student_${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `recipient_id=eq.${myId}`,
      }, () => setChatUnread(n => n + 1))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user.id])

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [dark])

  const liveStudent = students.find((s) => {
    const phone = user.profile?.phone
    if (phone && s.phone && s.phone === phone) return true
    const name = user.profile?.name?.toLowerCase().trim() || ""
    const sName = s.name?.toLowerCase().trim() || ""
    return name.length > 0 && sName === name
  })

  // Кэш на случай если RLS блокирует чтение students (студент — anon пользователь)
  const cachedStudentKey = `student_cache_${user.id}`
  const cachedStudent = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(cachedStudentKey)) } catch { return null }
  }, [cachedStudentKey])

  // Сохраняем данные в кэш при успешной загрузке, сохраняя аватарку если она не в students таблице
  useEffect(() => {
    if (liveStudent) {
      const existingAvatar = cachedStudent?.avatar
      const toSave = { ...liveStudent }
      if (!toSave.avatar && existingAvatar) toSave.avatar = existingAvatar
      localStorage.setItem(cachedStudentKey, JSON.stringify(toSave))
    }
  }, [liveStudent, cachedStudentKey])

  // Живые данные с сохранением аватарки из кэша если она не дошла до students таблицы
  const student = liveStudent
    ? { ...liveStudent, avatar: liveStudent.avatar || cachedStudent?.avatar || null }
    : cachedStudent

  const gradedHw = homework.filter((h) => h.grade != null)
  const hwAvg = gradedHw.length > 0
    ? Math.round((gradedHw.reduce((s, h) => s + h.grade, 0) / gradedHw.length) * 10) / 10
    : null

  const gradedVariants = variants.filter((v) => v.submission?.status === "graded" && v.submission?.total_score != null)
  const variantAvg = gradedVariants.length > 0
    ? Math.round(gradedVariants.reduce((s, v) => s + v.submission.total_score, 0) / gradedVariants.length)
    : null

  // Сгенерированный вариант (собран из банка) несёт tasks_snapshot — его решаем прямо на
  // сайте; свой файл репетитора (tasks_snapshot нет) по-прежнему показываем как файл.
  const isGeneratedVariant = (selectedVariant?.tasks_snapshot?.length || 0) > 0
  // ?download → Supabase отдаёт файл с Content-Disposition: attachment (скачивание, а не открытие)
  const variantDownloadUrl = selectedVariant?.file_url
    ? selectedVariant.file_url + (selectedVariant.file_url.includes("?") ? "&" : "?") + "download"
    : null

  const upcoming = (student?.lessons || [])
    .filter((l) => {
      if (!l.date) return false
      const [y, m, d] = l.date.split("-").map(Number)
      const [h, min] = (l.time || "00:00").split(":").map(Number)
      return new Date(y, m - 1, d, h, min + (l.duration || 60)) >= new Date()
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10)

  const past = (student?.lessons || [])
    .filter((l) => isLessonConducted(l))
    .sort((a, b) => b.date.localeCompare(a.date))

  const initials = getInitials(user.profile?.name)

  // Если студент загружен, строки в students нет И нет кэша — создаём строку автоматически
  // (кэш есть → строка существует, просто RLS блокирует чтение — не дублируем)
  useEffect(() => {
    if (!studentsLoaded || students.length > 0 || !user.profile?.tutor_id) return
    if (cachedStudent) return  // строка точно есть, просто RLS — не создаём дубликат
    if (autoCreateRef.current) return
    autoCreateRef.current = true

    const tutorId = user.profile.tutor_id
    const phone = user.profile?.phone
    const name = user.profile?.name
    if (!name) return

    supabase.from("students")
      .insert({ tutor_id: tutorId, name, phone: phone || null })
      .then(() => { if (onReloadStudents) onReloadStudents() })
  }, [studentsLoaded, students.length, user.profile?.tutor_id, cachedStudent])

  useEffect(() => {
    loadVariants()
  }, [user])

  useEffect(() => {
    loadHomework()
  }, [student?.id])

  async function loadHomework() {
    if (!student) { setHomework([]); return }
    const { data } = await supabase
      .from("homework")
      .select("*")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
    setHomework(data || [])
  }

  async function handleStudentAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return

    // Показать сразу через base64
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarOverride(ev.target.result)
    reader.readAsDataURL(file)

    // Загрузить в Storage
    const ext = file.name.split(".").pop()
    const fileName = `student-avatars/${user.id}/avatar.${ext}`
    const { error } = await supabase.storage
      .from("homework")
      .upload(fileName, file, { upsert: true })
    if (error) return

    const { data } = supabase.storage.from("homework").getPublicUrl(fileName)
    const url = data.publicUrl

    // Сохранить в student_accounts (студент всегда может писать в свою строку)
    await supabase.from("student_accounts").update({ avatar: url }).eq("id", user.id)

    // Попытаться также обновить students (сработает если RLS позволяет)
    if (student?.id) {
      await supabase.from("students").update({ avatar: url }).eq("id", student.id)
    }

    // Обновить кэш
    if (student) {
      localStorage.setItem(cachedStudentKey, JSON.stringify({ ...student, avatar: url }))
    }

    // Обновить общий список студентов у репетитора (Students/Dashboard/Payment)
    if (onReloadStudents) onReloadStudents()
  }

  async function submitHomeworkTest(hwId, answers, solutionFile) {
    const hw = homework.find((h) => h.id === hwId)
    if (!hw) return
    const correct = hw.correct_answers || []
    let score = 0
    answers.forEach((ans, i) => {
      if (ans.trim().toLowerCase() === correct[i]?.trim().toLowerCase()) score++
    })

    const isPureTest = hw.hw_type === "test"
    const updates = {
      student_answers: answers,
      test_score: score,
    }
    if (isPureTest) {
      const percent = Math.round((score / hw.question_count) * 100)
      updates.status = "done"
      updates.grade = percent >= 90 ? 5 : percent >= 75 ? 4 : percent >= 50 ? 3 : 2
    }

    if (solutionFile) {
      const ext = solutionFile.name.split(".").pop()
      const fileName = hwId + "/solution-" + Date.now() + "." + ext
      const { error: uploadError } = await supabase.storage.from("homework").upload(fileName, solutionFile)
      if (!uploadError) {
        const { data } = supabase.storage.from("homework").getPublicUrl(fileName)
        updates.submission_url = data.publicUrl
      }
    }

    await supabase.from("homework").update(updates).eq("id", hwId)

    if (!isPureTest) {
      await supabase.from("notifications").insert({
        user_id: hw.tutor_id,
        title: "Ученик прошёл тест в ДЗ",
        body: user.profile?.name + " прошёл тест в «" + hw.title + "»: " + score + " / " + hw.question_count,
      })
    }

    loadHomework()
    const updated = await supabase.from("homework").select("*").eq("id", hwId).single()
    if (updated.data) setSelectedHomework(updated.data)
  }

  async function uploadHomeworkSubmission(hwId, file) {
    const ext = file.name.split(".").pop()
    const fileName = hwId + "/" + Date.now() + "." + ext
    const { error: uploadError } = await supabase.storage.from("homework").upload(fileName, file)
    if (uploadError) return
    const { data } = supabase.storage.from("homework").getPublicUrl(fileName)

    const hw = homework.find((h) => h.id === hwId)
    await supabase.from("homework").update({
      submission_url: data.publicUrl,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }).eq("id", hwId)

    await supabase.from("notifications").insert({
      user_id: hw.tutor_id,
      title: "Ученик сдал домашнее задание",
      body: user.profile?.name + " сдал «" + hw.title + "»",
    })

    loadHomework()
    setSelectedHomework(null)
  }

  async function linkTutor() {
    setTutorLinkError("")
    setTutorLinkSuccess("")
    setTutorLinking(true)
    try {
      const code = tutorCode.trim().toLowerCase()
      if (!code) throw new Error("Введи код репетитора")

      const { data: tutorData, error: tutorError } = await supabase
        .from("tutors")
        .select("id, name")
        .eq("code", code)
        .single()
      if (tutorError || !tutorData) throw new Error("Репетитор с таким кодом не найден")

      const phone = user.profile?.phone
      const name = user.profile?.name

      // Предметы, выбранные в анкете — подставляем их в карточку у репетитора.
      let subjectStr = null
      try {
        const arr = JSON.parse(localStorage.getItem(`student_subjects_${user.id}`) || "[]")
        if (Array.isArray(arr) && arr.length) subjectStr = arr.join(", ")
      } catch { /* нет сохранённых предметов — не критично */ }

      // Update student_accounts with tutor link
      await supabase
        .from("student_accounts")
        .update({ tutor_id: tutorData.id, tutor_code: code })
        .eq("id", user.id)

      // Find student row by phone (most reliable)
      const { data: byPhone } = await supabase
        .from("students")
        .select("id")
        .eq("tutor_id", tutorData.id)
        .eq("phone", phone)
        .maybeSingle()

      if (!byPhone) {
        // Try by name, then update phone so future matches work
        const { data: byName } = await supabase
          .from("students")
          .select("id")
          .eq("tutor_id", tutorData.id)
          .ilike("name", `%${name}%`)
          .maybeSingle()

        if (byName) {
          await supabase.from("students").update({ phone, ...(subjectStr ? { subject: subjectStr } : {}) }).eq("id", byName.id)
        } else {
          // Not in tutor's list yet — create a row
          await supabase.from("students").insert({
            tutor_id: tutorData.id,
            name,
            phone,
            ...(subjectStr ? { subject: subjectStr } : {}),
          })
        }
      }

      // Pending request + notification
      const { data: existingPending } = await supabase
        .from("pending_students")
        .select("id")
        .eq("tutor_id", tutorData.id)
        .eq("student_account_id", user.id)
        .maybeSingle()

      if (!existingPending) {
        await supabase.from("pending_students").insert({
          tutor_id: tutorData.id,
          student_account_id: user.id,
          name,
          phone,
        })
        await supabase.from("notifications").insert({
          user_id: tutorData.id,
          title: "Новая заявка от ученика",
          body: name + " хочет присоединиться к тебе",
        })
      }

      setTutorLinkSuccess("Подключено к репетитору " + tutorData.name + "!")
      setTutorCode("")
      if (onReloadStudents) onReloadStudents(tutorData.id)
    } catch (err) {
      setTutorLinkError(err.message)
    } finally {
      setTutorLinking(false)
    }
  }

  async function loadVariants() {
    const { data: subs } = await supabase
      .from("variant_submissions")
      .select("*, variants(*)")
      .eq("student_id", user.id)
    const mapped = (subs || []).map((s) => ({ ...s.variants, submission: s }))
    setVariants(mapped)
    try { localStorage.setItem(variantsCacheKey, JSON.stringify(mapped)) } catch { /* переполнение localStorage — кэш не критичен */ }
  }

  async function submitPart1() {
    if (part1Answers.every((a) => !a)) {
      alert("Введи хотя бы один ответ!")
      return
    }
    setSubmitting(true)

    const variant = selectedVariant
    const maxCount = variant.type === "ЕГЭ" ? 12 : 19
    const correctAnswers = variant.answers?.part1 || []
    let score = 0
    part1Answers.forEach((ans, i) => {
      if (ans.trim().toLowerCase() === correctAnswers[i]?.trim().toLowerCase()) score++
    })

    await supabase.from("variant_submissions").update({
      part1_answers: part1Answers,
      part1_score: score,
      status: "submitted",
    }).eq("id", variant.submission.id)

    await supabase.from("notifications").insert({
      user_id: variant.tutor_id,
      title: "Ученик сдал часть 1",
      body: user.profile?.name + " выполнил вариант «" + variant.title + "». Часть 1: " + score + " / " + maxCount,
    })

    setSubmitting(false)
    setSelectedVariant(null)
    loadVariants()
    setResultDialog({ score, max: maxCount })
  }

  const navItems = [
    { id: "schedule", label: "Профиль", icon: "profile" },
    { id: "chat", label: "Чат", icon: "chat" },
    { id: "variants", label: "Варианты", icon: "variants" },
    { id: "homework", label: "Задания", icon: "homework" },
    { id: "payment", label: "Оплата", icon: "payment" },
    { id: "settings", label: "Настройки", icon: "settings" },
  ]

  function goTab(id) {
    setActiveTab(id)
    if (id === "chat") setChatUnread(0)
  }

  return (
    <div className="flex app-shell overflow-clip">
      {resultDialog && (
        <SubmitResultDialog
          score={resultDialog.score}
          max={resultDialog.max}
          onClose={() => setResultDialog(null)}
        />
      )}
      {boardOpen && student?.id && (
        <Suspense fallback={<div className="fixed inset-0 z-[100000] bg-white dark:bg-[#1c1c1e] flex items-center justify-center"><div className="loader-ring" /></div>}>
          <Board
            roomId={student.id}
            userId={`s:${user.id}`}
            userName={user.profile?.name || "Ученик"}
            theme={dark ? "dark" : "light"}
            onClose={() => setBoardOpen(false)}
          />
        </Suspense>
      )}
      <div className="hidden md:block">
        <StudentSidebar activeTab={activeTab} setActiveTab={goTab} items={navItems} badges={{ chat: chatUnread }} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="topbar-glass px-4 md:px-6 py-3 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2.5 md:hidden">
            <img src="/logo.webp" alt="Логотип" className="w-8 h-8 rounded-xl object-cover" />
            <span className="text-sm font-semibold text-gray-700">Мой кабинет</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">
              {initials}
            </div>
            <span className="hidden md:block text-sm text-gray-600">{user.profile?.name}</span>
            <button
              onClick={() => setDark(!dark)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-sm"
            >
              <span key={dark ? "sun" : "moon"} className={dark ? "icon-sun-enter" : "icon-moon-enter"}>
                {dark ? <Icon name="sun" size={16} /> : <Icon name="moon" size={16} />}
              </span>
            </button>
            <StudentNotificationBell userId={user.id} onNavigate={goTab} />
            <button onClick={onLogout} className="text-sm text-gray-400 hover:text-gray-600">Выйти</button>
          </div>
        </div>

        <div className={`flex-1 min-h-0 overflow-x-hidden ${activeTab === "chat" ? "flex flex-col overflow-hidden" : "overflow-y-auto pb-20 md:pb-0"}`}>
          {activeTab === "chat" ? (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden page-active">
              <Chat
                myId={`s:${user.id}`}
                myName={user.profile?.name || "Ученик"}
                initialContacts={user.profile?.tutor_id ? [{ id: `t:${user.profile.tutor_id}`, name: tutorName || "Репетитор", role: "Репетитор" }] : []}
                canAddByCode={true}
                onUnreadChange={(delta, isInit) => {
                  if (isInit) setChatUnread(delta)
                  else setChatUnread(n => Math.max(0, n + delta))
                }}
              />
            </div>
          ) : (
            <div key={activeTab} className="page-active p-4 md:p-6">
        {activeTab === "schedule" && (
          <>
            {!student ? (
              !studentsLoaded ? (
                <div className="text-center py-16 text-gray-400 text-sm">Загрузка...</div>
              ) : students.length === 0 ? (
                <div className="glass p-6 md:p-8 flex flex-col items-center text-center max-w-md mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
                    <Icon name="link" size={26} />
                  </div>
                  <div className="text-lg font-semibold mb-1">Привяжись к репетитору</div>
                  <div className="text-sm text-gray-500 mb-5">Введи код, который дал репетитор — и здесь появятся занятия, задания, варианты и оплата.</div>
                  <div className="w-full max-w-xs flex flex-col gap-2.5">
                    <input
                      value={tutorCode}
                      onChange={(e) => { setTutorCode(e.target.value); setTutorLinkError("") }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !tutorLinking) linkTutor() }}
                      placeholder="Код репетитора"
                      className="input-glass text-center tracking-widest"
                    />
                    {tutorLinkError && <div className="text-sm text-red-500">{tutorLinkError}</div>}
                    {tutorLinkSuccess && <div className="text-sm text-green-600">{tutorLinkSuccess}</div>}
                    <button
                      onClick={linkTutor}
                      disabled={tutorLinking || !tutorCode.trim()}
                      className="btn-primary py-2.5 disabled:opacity-50 active:scale-[0.99] transition-transform"
                    >
                      {tutorLinking ? "Привязываем..." : "Привязать"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass-tint-amber p-6 text-center">
                  <div className="text-sm text-amber-700 font-medium mb-1">Имя в системе не совпадает</div>
                  <div className="text-xs text-amber-600">Ты зарегистрирован как <b>{user.profile?.name}</b>, но репетитор добавил тебя под другим именем или телефоном. Попроси репетитора проверить карточку.</div>
                </div>
              )
            ) : (
              <div className="flex flex-col md:flex-row gap-4 items-start">

                {/* LEFT: avatar + info */}
                <div className="w-full md:w-52 flex-shrink-0 flex flex-col gap-3">

                  {/* Avatar card */}
                  <div className="glass p-5 flex flex-col items-center text-center">
                    <div className="relative mb-3 cursor-pointer active:scale-95 transition-transform" onClick={() => studentAvatarRef.current.click()}>
                      {(avatarOverride || student.avatar) ? (
                        <img src={avatarOverride || student.avatar} alt="" className="w-24 h-24 rounded-full object-cover" />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-3xl font-semibold text-white">
                          {initials}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-md pointer-events-none">
                        <Icon name="camera" size={13} className="text-white" />
                      </div>
                    </div>
                    <input ref={studentAvatarRef} type="file" accept="image/*" className="hidden" onChange={handleStudentAvatarChange} />
                    <div className="flex gap-2 w-full mt-1">
                        <button onClick={() => setBoardOpen(true)}
                          className="press-tap flex-1 btn-glass py-2 text-xs text-center">
                          <span className="flex items-center justify-center gap-1"><Icon name="clipboard" size={12} />Доска</span>
                        </button>
                        {student.callUrl && (
                          <a href={student.callUrl} target="_blank" rel="noreferrer"
                            className="flex-1 btn-glass py-2 text-xs text-center">
                            <span className="flex items-center gap-1"><Icon name="video" size={12} />Звонок</span>
                          </a>
                        )}
                      </div>
                  </div>

                  {/* Репетитор */}
                  <div className="glass p-4">
                    <div className="text-xs text-gray-400 font-medium mb-3">Репетитор</div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-medium text-purple-600 flex-shrink-0">Р</div>
                      <div className="text-sm text-gray-700 leading-tight">Ваш репетитор</div>
                    </div>
                  </div>

                  {/* Информация */}
                  <div className="glass p-4">
                    <div className="text-xs text-gray-400 font-medium mb-3">Информация</div>
                    <div className="flex flex-col gap-2">
                      {user.profile?.phone && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 flex-shrink-0"><Icon name="phone" size={14} /></span>
                          <span className="text-sm text-gray-700">{formatPhone(user.profile.phone)}</span>
                        </div>
                      )}
                      {student.goal && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 flex-shrink-0"><Icon name="target" size={14} /></span>
                          <span className="text-sm text-gray-700">{student.goal}</span>
                        </div>
                      )}
                      {student.examDate && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 flex-shrink-0"><Icon name="calendar" size={14} /></span>
                          <span className="text-sm text-gray-700">
                            {parseLocalDate(student.examDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                      )}
                      {student.lessonPrice > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 flex-shrink-0"><Icon name="dollar" size={14} /></span>
                          <span className="text-sm text-gray-700">{student.lessonPrice.toLocaleString("ru-RU")} ₽/занятие</span>
                        </div>
                      )}
                      {student.parent_code && (
                        <CopyCodeBlock code={student.parent_code} />
                      )}
                    </div>
                  </div>

                </div>

                {/* RIGHT: main content */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">

                  {/* Name header */}
                  <div className="glass p-5">
                    <div className="text-2xl font-semibold mb-0.5">{user.profile?.name}</div>
                    <div className="text-sm text-gray-500">Ученик</div>
                    {student.goal && (
                      <div className="text-sm text-gray-400 mt-0.5">Готовлюсь к {student.goal}</div>
                    )}
                    {user.profile?.phone && (
                      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/30">
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/40 bg-white/20">
                          <div>
                            <div className="text-sm font-medium text-gray-700">{formatPhone(user.profile.phone)}</div>
                            <div className="text-xs text-gray-400">Телефон</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Мои занятия */}
                  <div className="glass p-5">
                    <div className="text-base font-medium mb-4">Мои занятия</div>
                    <div className="text-xs text-gray-400 mb-2">Ближайшие</div>
                    {upcoming.length === 0 ? (
                      <div className="text-sm text-gray-400">Занятий не запланировано</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {upcoming.slice(0, 6).map((l, i) => {
                          const date = new Date(l.date + "T00:00:00")
                          const dateStr = date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
                          return (
                            <span key={i} className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-full font-medium">
                              <Icon name="calendar" size={12} />{dateStr} в {l.time}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Расписание / Экзамен */}
                  <div className="glass p-5">
                    <div className="text-base font-medium mb-4">Расписание</div>
                    {student.schedule && (
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full flex-shrink-0 font-medium">Регулярные</span>
                        <div className="text-sm text-gray-600 pt-0.5">{student.schedule}</div>
                      </div>
                    )}
                    {student.examDate && (
                      <div className="flex items-start gap-3">
                        <span className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 font-medium ${
                          student.goal === "ЕГЭ" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                        }`}>{student.goal || "Экзамен"}</span>
                        <div>
                          <div className="text-sm text-gray-700">
                            {parseLocalDate(student.examDate).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                          </div>
                          {(() => {
                            const today = new Date(); today.setHours(0,0,0,0)
                            const examDate = parseLocalDate(student.examDate)
                            const daysLeft = Math.ceil((examDate - today) / (1000*60*60*24))
                            if (daysLeft <= 0) return null
                            return <div className="text-xs text-gray-400 mt-0.5">{daysLeft} {daysLeft === 1 ? "день" : daysLeft >= 2 && daysLeft <= 4 ? "дня" : "дней"} до экзамена</div>
                          })()}
                          {student.targetScore && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              Цель: {student.targetScore} {student.goal === "ЕГЭ" ? "/ 100" : "/ 32"} баллов
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {!student.schedule && !student.examDate && (
                      <div className="text-sm text-gray-400">Расписание не задано</div>
                    )}

                  </div>

                  {/* Успеваемость */}
                  <div className="glass p-5">
                    <div className="text-base font-medium mb-4">Успеваемость</div>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between py-2 border-b border-white/30">
                        <span className="text-sm text-gray-500">Средняя оценка ДЗ</span>
                        {hwAvg != null ? (
                          <span className={`text-sm font-semibold ${hwAvg >= 4.5 ? "text-green-600" : hwAvg >= 3.5 ? "text-blue-600" : hwAvg >= 2.5 ? "text-amber-600" : "text-red-600"}`}>
                            {hwAvg} / 5 <span className="text-xs font-normal text-gray-400">({gradedHw.length} оценок)</span>
                          </span>
                        ) : <span className="text-sm text-gray-300">—</span>}
                      </div>
                      {variantAvg != null && (
                        <div className="flex items-center justify-between py-2 border-b border-white/30">
                          <span className="text-sm text-gray-500">Средний балл вариантов</span>
                          <span className={`text-sm font-semibold ${variantAvg >= 24 ? "text-green-600" : variantAvg >= 18 ? "text-blue-600" : "text-amber-600"}`}>
                            {variantAvg} <span className="text-xs font-normal text-gray-400">({gradedVariants.length} вар.)</span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between py-2 border-b border-white/30">
                        <span className="text-sm text-gray-500">Проведено занятий</span>
                        <span className="text-sm font-semibold text-gray-700">{past.length} <span className="text-xs font-normal text-gray-400">из {(student.lessons || []).length}</span></span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500">Оплата</span>
                        {(() => {
                          const conducted = (student.lessons || []).filter((l) => isLessonConducted(l))
                          const debt = conducted.length * (student.lessonPrice || 0) - (student.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
                          if (conducted.length === 0) return <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">Нет занятий</span>
                          if (debt <= 0) return <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">Оплачено</span>
                          return <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Долг {debt.toLocaleString("ru-RU")} ₽</span>
                        })()}
                      </div>
                    </div>
                  </div>

                  <StreakBadge homework={homework} />

                  <ProgressChart
                    variants={variants}
                    targetScore={student.targetScore}
                    maxScore={student.goal === "ЕГЭ" ? 100 : 32}
                  />

                  <StudentScheduleCalendar student={student} onOpenBoard={() => setBoardOpen(true)} />

                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "homework" && (
          <div>
            {selectedHomework ? (
              <HomeworkDetail
                hw={selectedHomework}
                onBack={() => setSelectedHomework(null)}
                onUpload={uploadHomeworkSubmission}
                onSubmitTest={submitHomeworkTest}
              />
            ) : (
              <div>
                <h2 className="text-base font-medium mb-4">Мои задания</h2>
                <StudentHomeworkList homework={homework} onSelect={setSelectedHomework} />
              </div>
            )}
          </div>
        )}

        {activeTab === "payment" && (
          <div>
            {!student ? (
              <div className="text-sm text-gray-400 text-center py-8 border border-dashed border-white/50 glass-sm">
                Сначала подключись к репетитору
              </div>
            ) : (() => {
              const conducted = (student.lessons || []).filter((l) => isLessonConducted(l))
              const totalOwed = conducted.length * (student.lessonPrice || 0)
              const totalPaid = (student.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
              const debt = totalOwed - totalPaid
              const payments = [...(student.payments || [])].sort((a, b) => {
                const parseDate = (d) => {
                  const parts = d.split(".")
                  return parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date(d)
                }
                return parseDate(b.date) - parseDate(a.date)
              })

              return (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="stat-card">
                      <div className="text-sm text-gray-500 mb-1">Всего оплачено</div>
                      <div className="text-2xl font-medium text-green-600">{totalPaid.toLocaleString("ru-RU")} ₽</div>
                    </div>
                    <div className="stat-card">
                      <div className="text-sm text-gray-500 mb-1">{debt > 0 ? "Текущий долг" : "Статус"}</div>
                      {debt > 0 ? (
                        <div className="text-2xl font-medium text-amber-600">{debt.toLocaleString("ru-RU")} ₽</div>
                      ) : (
                        <div className="text-2xl font-medium text-green-600">Оплачено</div>
                      )}
                    </div>
                  </div>

                  {student.lessonPrice && (
                    <div className="glass-sm px-4 py-3 text-sm text-gray-600">
                      Стоимость занятия: <span className="font-medium text-gray-800">{student.lessonPrice.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  )}

                  <div className="glass p-5">
                    <h2 className="text-base font-medium mb-4">История платежей</h2>
                    {payments.length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-8">Платежей пока нет</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {payments.map((p, i) => (
                          <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                            <div>
                              <div className="text-sm font-medium">{p.date}</div>
                              {p.note && <div className="text-xs text-gray-400">{p.note}</div>}
                            </div>
                            <div className="text-sm font-medium text-green-600">+{p.amount.toLocaleString("ru-RU")} ₽</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="flex flex-col gap-4">
            <div className="glass p-5">
              <h2 className="text-base font-medium mb-1">Подключить репетитора</h2>
              <p className="text-xs text-gray-500 mb-4">Введи код репетитора чтобы подключиться к нему</p>
              <div className="flex flex-col gap-3">
                <input
                  value={tutorCode}
                  onChange={(e) => setTutorCode(e.target.value)}
                  placeholder="Введи 6-значный код"
                  className="input-glass"
                />
                {tutorLinkError && (
                  <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{tutorLinkError}</div>
                )}
                {tutorLinkSuccess && (
                  <div className="bg-green-50 text-green-600 text-sm px-3 py-2 rounded-lg">{tutorLinkSuccess}</div>
                )}
                <button
                  onClick={linkTutor}
                  disabled={tutorLinking}
                  className="btn-primary py-2.5 text-sm disabled:opacity-50"
                >
                  {tutorLinking ? "Подключаем..." : "Подключить"}
                </button>
              </div>
            </div>

            <div className="glass p-5">
              <h2 className="text-base font-medium mb-1">Профиль</h2>
              <div className="flex flex-col gap-2 mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-20">Имя</span>
                  <span className="text-sm">{user.profile?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-20">Телефон</span>
                  <span className="text-sm">{formatPhone(user.profile?.phone)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-20">Код</span>
                  <span className="text-sm font-mono">{user.profile?.tutor_code || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "variants" && (
          <div>
            {selectedVariant ? (
              <div>
                <button
                  onClick={() => { setSelectedVariant(null); setPart1Answers(Array(19).fill("")) }}
                  className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
                >
                  ← Назад
                </button>

                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="text-lg font-medium">{selectedVariant.title}</h2>
                  {variantDownloadUrl && (
                    <a href={variantDownloadUrl} download
                      className="flex-shrink-0 flex items-center gap-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors active:scale-95">
                      <Icon name="download" size={14} />Скачать PDF
                    </a>
                  )}
                </div>

                {/* Свой файл репетитора (без tasks_snapshot) показываем как файл; сгенерированный
                    вариант решается интерактивно ниже, поэтому его PDF не встраиваем. */}
                {!isGeneratedVariant && selectedVariant.file_url && (
                  <div className="mb-4 glass-sm overflow-hidden">
                    {selectedVariant.file_url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                      <img src={selectedVariant.file_url} alt="вариант" className="w-full max-w-2xl object-contain bg-gray-50" />
                    ) : (
                      <iframe src={selectedVariant.file_url} className="w-full h-96 bg-white" title="вариант" />
                    )}
                    <div className="border-t border-gray-100 p-2 text-center">
                      <a href={selectedVariant.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:opacity-70 transition-opacity">
                        Открыть в новой вкладке
                      </a>
                    </div>
                  </div>
                )}

                {/* Сгенерированный вариант уже сдан — показываем задания только для просмотра (ответы уже в разборе) */}
                {isGeneratedVariant && selectedVariant.submission.status !== "pending" && (
                  <div className="mb-4 flex flex-col gap-2">
                    {selectedVariant.tasks_snapshot.map((t) => (
                      <div key={t.number} className="glass-sm p-3">
                        <div className="text-xs font-medium text-blue-600 mb-1">Задание {t.number}</div>
                        {t.condition_text && <div className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderTaskMath(t.condition_text) }} />}
                        {t.image_url && <img src={t.image_url} alt={`Задание ${t.number}`} className="w-full max-w-md object-contain rounded-lg mt-2 bg-gray-50" />}
                      </div>
                    ))}
                  </div>
                )}

                {selectedVariant.submission.status === "pending" && isGeneratedVariant && (
                  <div className="glass p-5">
                    <h3 className="text-base font-medium mb-1">Реши вариант</h3>
                    <p className="text-xs text-gray-500 mb-4">Впиши ответ под каждым заданием части 1. Часть 2 загрузишь фото после отправки.</p>
                    <div className="flex flex-col gap-3">
                      {selectedVariant.tasks_snapshot.map((t) => (
                        <div key={t.number} className="border border-gray-100 rounded-xl p-3">
                          <div className="text-xs font-medium text-blue-600 mb-1">Задание {t.number}</div>
                          {t.condition_text && <div className="text-sm whitespace-pre-wrap mb-2" dangerouslySetInnerHTML={{ __html: renderTaskMath(t.condition_text) }} />}
                          {t.image_url && <img src={t.image_url} alt={`Задание ${t.number}`} className="w-full max-w-md object-contain rounded-lg mb-2 bg-gray-50" />}
                          <input
                            value={part1Answers[t.number - 1] || ""}
                            onChange={(e) => { const u = [...part1Answers]; u[t.number - 1] = e.target.value; setPart1Answers(u) }}
                            placeholder="Твой ответ"
                            className="input-glass w-full px-3 py-2"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 my-4">
                      <span className="flex items-start gap-1"><Icon name="clipboard" size={12} className="mt-0.5 flex-shrink-0" />Часть 2 сдаётся отдельно — загрузи фото решений после отправки части 1</span>
                    </div>
                    <button
                      onClick={submitPart1}
                      disabled={submitting}
                      className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99] transition-transform"
                    >
                      {submitting ? "Отправляем..." : "Отправить ответы части 1"}
                    </button>
                  </div>
                )}

                {selectedVariant.submission.status === "pending" && !isGeneratedVariant && (
                  <div className="glass p-5">
                    <h3 className="text-base font-medium mb-4">Часть 1 — введи ответы</h3>
                    <div className="mb-3">
                      <div className="text-xs font-medium text-blue-600 mb-2 bg-blue-50 px-2 py-1 rounded">Алгебра — задания 1–14</div>
                      <div className="grid grid-cols-3 gap-2">
                        {part1Answers.slice(0, 14).map((a, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                            <input
                              value={a}
                              onChange={(e) => {
                                const updated = [...part1Answers]
                                updated[i] = e.target.value
                                setPart1Answers(updated)
                              }}
                              placeholder="Ответ"
                              className="input-glass flex-1 px-2 py-1.5"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="text-xs font-medium text-purple-600 mb-2 bg-purple-50 px-2 py-1 rounded">Геометрия — задания 15–19</div>
                      <div className="grid grid-cols-3 gap-2">
                        {part1Answers.slice(14, 19).map((a, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-5">{i + 15}</span>
                            <input
                              value={a}
                              onChange={(e) => {
                                const updated = [...part1Answers]
                                updated[i + 14] = e.target.value
                                setPart1Answers(updated)
                              }}
                              placeholder="Ответ"
                              className="input-glass flex-1 px-2 py-1.5"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 mb-4">
                      <span className="flex items-start gap-1"><Icon name="clipboard" size={12} className="mt-0.5 flex-shrink-0" />Часть 2 сдаётся отдельно — загрузи фото решений после отправки части 1</span>
                    </div>
                    <button
                      onClick={submitPart1}
                      disabled={submitting}
                      className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {submitting ? "Отправляем..." : "Отправить ответы части 1"}
                    </button>
                  </div>
                )}

                {selectedVariant.submission.status === "submitted" && (
                  <div className="flex flex-col gap-4">
                    <div className="glass-tint-blue p-4">
                      <div className="text-sm font-medium text-blue-700 flex items-center gap-1"><Icon name="check" size={14} />Часть 1 сдана</div>
                      <div className="text-sm text-blue-600 mt-1">Балл: {selectedVariant.submission.part1_score} / 19</div>
                    </div>

                    {selectedVariant.submission.part1_answers && selectedVariant.answers?.part1 && (
                      <div className="glass p-5">
                        <h3 className="text-sm font-medium mb-3">Разбор части 1</h3>
                        <div className="flex flex-col gap-1">
                          {selectedVariant.answers.part1.map((correct, i) => {
                            const studentAns = selectedVariant.submission.part1_answers[i] || "—"
                            const isCorrect = studentAns.trim() === correct.trim()
                            return (
                              <div
                                key={i}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                                  isCorrect ? "bg-green-50" : "bg-red-50"
                                }`}
                              >
                                <span className="text-gray-500 w-6">{i + 1}</span>
                                <span className={isCorrect ? "text-green-700 font-medium flex-1" : "text-red-700 font-medium flex-1"}>
                                  {studentAns}
                                </span>
                                {!isCorrect && (
                                  <span className="text-gray-400 text-xs">
                                    правильно: <span className="text-gray-700 font-medium">{correct}</span>
                                  </span>
                                )}
                                {isCorrect && <Icon name="check" size={12} className="text-green-500" />}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <div className="glass p-5">
                      <h3 className="text-base font-medium mb-3">Часть 2 — загрузи решения</h3>
                      <div className="text-xs text-gray-500 mb-4">Загрузи фото или файл решения для каждого задания (20–25)</div>
                      <div className="flex flex-col gap-3">
                        {[20, 21, 22, 23, 24, 25].map((taskNum) => (
                          <Part2Upload
                            key={taskNum}
                            taskNum={taskNum}
                            submissionId={selectedVariant.submission.id}
                            existingUrl={selectedVariant.submission.part2_files?.[taskNum]}
                            onUpload={loadVariants}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedVariant.submission.status === "graded" && (
                  <div className="flex flex-col gap-4">
                    <div className="glass-tint-green p-5 text-center">
                      <div className="text-green-600 mb-2 flex justify-center"><Icon name="check" size={28} /></div>
                      <div className="text-sm font-medium text-green-700">Вариант проверен!</div>
                      <div className="text-3xl font-medium text-green-600 mt-2">{selectedVariant.submission.total_score} баллов</div>
                      <div className="text-sm text-green-500 mt-1">
                        Часть 1: {selectedVariant.submission.part1_score} / 19 · Часть 2: {selectedVariant.submission.part2_score} / 12
                      </div>
                    </div>

                    {selectedVariant.submission.part1_answers && selectedVariant.answers?.part1 && (
                      <div className="glass p-5">
                        <h3 className="text-sm font-medium mb-3">Разбор части 1</h3>
                        <div className="flex flex-col gap-1">
                          {selectedVariant.answers.part1.map((correct, i) => {
                            const studentAns = selectedVariant.submission.part1_answers[i] || "—"
                            const isCorrect = studentAns.trim() === correct.trim()
                            return (
                              <div
                                key={i}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                                  isCorrect ? "bg-green-50" : "bg-red-50"
                                }`}
                              >
                                <span className="text-gray-500 w-6">{i + 1}</span>
                                <span className={isCorrect ? "text-green-700 font-medium flex-1" : "text-red-700 font-medium flex-1"}>
                                  {studentAns}
                                </span>
                                {!isCorrect && (
                                  <span className="text-gray-400 text-xs">
                                    правильно: <span className="text-gray-700 font-medium">{correct}</span>
                                  </span>
                                )}
                                {isCorrect && <Icon name="check" size={12} className="text-green-500" />}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h2 className="text-base font-medium mb-4">Мои варианты</h2>
                {variants.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-8 border border-dashed border-white/50 glass-sm">
                    Репетитор ещё не отправил варианты
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => { setSelectedVariant(v); setPart1Answers(Array(v.type === "ЕГЭ" ? 12 : 19).fill("")) }}
                        className="text-left glass p-4 hover:bg-white/80 transition-colors w-full"
                      >
                        <div className="flex justify-between items-center">
                          <div className="font-medium text-sm">{v.title}</div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            v.submission.status === "graded" ? "bg-green-100 text-green-700" :
                            v.submission.status === "submitted" ? "bg-blue-100 text-blue-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {v.submission.status === "graded" ? "Проверено" :
                             v.submission.status === "submitted" ? "На проверке" :
                             "Не сдан"}
                          </span>
                        </div>
                        {v.submission.status === "graded" && (
                          <div className="text-xs text-gray-500 mt-1">
                            Итого: {v.submission.total_score} баллов
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
            </div>
          )}
        </div>

        <div className="mobile-nav-glass md:hidden fixed bottom-0 left-0 right-0 z-50">
          <div className="flex justify-around items-center px-1 pt-2 pb-2">
            {navItems.map((item) => {
              const badge = item.id === "chat" ? chatUnread : 0
              return (
                <button
                  key={item.id}
                  onClick={() => goTab(item.id)}
                  className={`relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all min-w-[44px] ${
                    activeTab === item.id
                      ? "text-blue-600 bg-blue-500/10 font-semibold"
                      : "text-gray-400"
                  }`}
                >
                  <NavIcon id={item.icon} size={22} />
                  {badge > 0 && (
                    <span className="absolute -top-0.5 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                  <span className="text-[10px]">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {needsOnboard && (
        <StudentOnboardingModal
          studentId={user.id}
          onComplete={() => {
            setNeedsOnboard(false)
            // Обновляем кэш сессии, чтобы опросник не всплыл снова после перезагрузки
            try {
              const s = JSON.parse(localStorage.getItem("student_session") || "{}")
              s.profile = { ...(s.profile || {}), onboarded: true }
              localStorage.setItem("student_session", JSON.stringify(s))
            } catch { /* кэш не критичен */ }
            // Привязка к репетитору теперь происходит в кабинете (заметный блок),
            // а не в анкете — поэтому здесь ничего перечитывать не нужно.
          }}
        />
      )}
    </div>
  )
}

export default StudentDashboard
