import { useState, useEffect } from "react"
import AddStudentModal from "../components/AddStudentModal"
import Icon from "../components/Icon"
import StudentProfile from "./StudentProfile"
import { supabase } from "../supabase"
import { isLessonConducted, getInitials, plural } from "../utils"

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
}

function getPaymentStatus(student) {
  const conducted = (student.lessons || []).filter((l) => isLessonConducted(l))
  const owed = conducted.length * (student.lessonPrice || 0)
  const paid = (student.payments || []).reduce((s, p) => s + (p.amount || 0), 0)
  const debt = owed - paid
  if (conducted.length === 0) return { label: "Нет занятий", debt: 0 }
  if (debt <= 0) return { label: "Оплачено", debt: 0 }
  return { label: `${debt.toLocaleString("ru-RU")} ₽`, debt }
}

function getNextLesson(student) {
  const now = new Date()
  const todayStr = formatDate(now)
  const cur = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`
  return (student.lessons || [])
    .filter((l) => l.date > todayStr || (l.date === todayStr && l.time >= cur))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0] || null
}

function getDaysUntilExam(student) {
  if (!student.examDate) return null
  const exam = new Date(student.examDate + "T00:00:00")
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((exam - today) / 86400000)
  return diff >= 0 ? diff : null
}

function getProgressTrend(student) {
  const r = student.results || []
  if (r.length < 2) return null
  return r[r.length - 1] - r[r.length - 2]
}

const GOAL_STYLE = {
  "ОГЭ":          { cls: "bg-blue-100 text-blue-700",   label: "ОГЭ" },
  "ЕГЭ":          { cls: "bg-purple-100 text-purple-700", label: "ЕГЭ" },
  "Успеваемость": { cls: "bg-green-100 text-green-700",  label: "Успев." },
}

function Students({ students, setStudents, tutorId, onOpenBoard }) {
  const [showModal, setShowModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [search, setSearch] = useState("")
  const [pending, setPending] = useState([])
  const [acceptingRequest, setAcceptingRequest] = useState(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])

  useEffect(() => {
    if (!tutorId) return
    let cancelled = false
    supabase.from("pending_students").select("*").eq("tutor_id", tutorId).order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled) setPending(data || []) })
    return () => { cancelled = true }
  }, [tutorId])

  async function handleReject(requestId) {
    if (!window.confirm("Отклонить заявку?")) return
    await supabase.from("pending_students").delete().eq("id", requestId)
    setPending((prev) => prev.filter((p) => p.id !== requestId))
  }

  async function handleAcceptComplete(newStudent, requestId) {
    // setStudents is handleSetStudents from App.jsx — it diffs the new array against
    // the old one and upserts any added/changed student itself, so no separate insert here.
    setStudents((prev) => [...prev, newStudent])
    await supabase.from("pending_students").delete().eq("id", requestId)
    setPending((prev) => prev.filter((p) => p.id !== requestId))
    setAcceptingRequest(null)
  }

  async function handleDelete(studentId, e) {
    e.stopPropagation()
    if (!window.confirm("Удалить ученика?")) return
    await supabase.from("students").delete().eq("id", studentId)
    setStudents((prev) => prev.filter((s) => s.id !== studentId))
  }

  if (selectedStudent) {
    const student = students.find((s) => s.id === selectedStudent)
    return (
      <StudentProfile
        student={student}
        onBack={() => setSelectedStudent(null)}
        onUpdate={(id, data) => setStudents((prev) => prev.map((s) => s.id === id ? { ...s, ...data } : s))}
        onOpenBoard={onOpenBoard}
      />
    )
  }

  // Attention lists
  const debtors = students.filter((s) => getPaymentStatus(s).debt > 0)
  const examSoon = students
    .filter((s) => { const d = getDaysUntilExam(s); return d !== null && d <= 30 })
    .sort((a, b) => getDaysUntilExam(a) - getDaysUntilExam(b))

  const query = search.trim().toLowerCase()
  const filtered = query
    ? students.filter((s) => s.name?.toLowerCase().includes(query) || s.phone?.toLowerCase().includes(query))
    : students

  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-medium">Ученики</h1>
          <p className="text-xs text-gray-400 mt-0.5">{students.length} {plural(students.length, "ученик", "ученика", "учеников")}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary px-3 py-2 text-sm">+ Добавить</button>
      </div>

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-medium mb-2 text-blue-600">Заявки от учеников</h2>
          <div className="flex flex-col gap-2">
            {pending.map((req) => (
              <div key={req.id} className="glass-tint-blue px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{req.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{req.phone}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setAcceptingRequest(req)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium">Принять</button>
                  <button onClick={() => handleReject(req.id)} className="text-sm text-gray-400 hover:text-red-600 px-2 py-1.5">Отклонить</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attention strips */}
      {(debtors.length > 0 || examSoon.length > 0) && (
        <div className="flex flex-col gap-2 mb-4">
          {debtors.length > 0 && (
            <div className="glass-tint-amber px-4 py-3 flex items-center gap-3 overflow-x-auto">
              <Icon name="warning" size={15} className="text-amber-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-700 flex-shrink-0 uppercase tracking-wide">Долг</span>
              <div className="flex gap-2">
                {debtors.map((s) => (
                  <button key={s.id} onClick={() => setSelectedStudent(s.id)}
                    className="no-press flex items-center gap-1.5 bg-white/60 hover:bg-white/90 transition-colors rounded-lg px-2.5 py-1 text-xs font-medium text-gray-800 flex-shrink-0">
                    <span>{s.name.split(" ")[0]}</span>
                    <span className="text-amber-600 font-semibold">−{getPaymentStatus(s).label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {examSoon.length > 0 && (
            <div className="glass-tint-blue px-4 py-3 flex items-center gap-3 overflow-x-auto">
              <Icon name="target" size={15} className="text-blue-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-blue-700 flex-shrink-0 uppercase tracking-wide">Экзамен</span>
              <div className="flex gap-2">
                {examSoon.map((s) => {
                  const days = getDaysUntilExam(s)
                  return (
                    <button key={s.id} onClick={() => setSelectedStudent(s.id)}
                      className="no-press flex items-center gap-1.5 bg-white/60 hover:bg-white/90 transition-colors rounded-lg px-2.5 py-1 text-xs font-medium text-gray-800 flex-shrink-0">
                      <span>{s.name.split(" ")[0]}</span>
                      <span className={days <= 7 ? "text-red-600 font-semibold" : "text-blue-600"}>
                        {days === 0 ? "сегодня" : `через ${days} дн.`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени или телефону..."
          className="w-full pl-4 pr-9 py-2 text-sm rounded-xl bg-white/40 border border-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/40 placeholder-gray-400"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {/* Mobile cards */}
      {isMobile ? (
        <div className="flex flex-col gap-2 stagger">
          {filtered.map((student) => {
            const status = getPaymentStatus(student)
            const next = getNextLesson(student)
            const examDays = getDaysUntilExam(student)
            const goal = GOAL_STYLE[student.goal]
            return (
              <div key={student.id} onClick={() => setSelectedStudent(student.id)} className="glass press-tap px-4 py-3 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600 flex-shrink-0 overflow-hidden">
                    {student.avatar ? <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" /> :
                      getInitials(student.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{student.name}</span>
                      {goal && <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${goal.cls}`}>{goal.label}</span>}
                    </div>
                    <div className="text-xs text-gray-400">{student.phone}</div>
                  </div>
                  <button onClick={(e) => handleDelete(student.id, e)} className="text-gray-300 hover:text-red-500 px-1">
                    <Icon name="x" size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {next ? (
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-white/50 px-2 py-1 rounded-lg">
                      <Icon name="calendar" size={11} className="text-blue-400" />
                      {new Date(next.date + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })} · {next.time}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300 bg-white/30 px-2 py-1 rounded-lg">Нет урока</span>
                  )}
                  {status.debt > 0 ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                      <Icon name="warning" size={11} />−{status.label}
                    </span>
                  ) : status.label === "Оплачено" && (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-lg">
                      <Icon name="check" size={11} />Оплачено
                    </span>
                  )}
                  {examDays !== null && (
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ml-auto ${
                      examDays <= 7 ? "bg-red-50 text-red-700" : examDays <= 30 ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      <Icon name="target" size={11} />{examDays === 0 ? "Сегодня!" : `${examDays} дн.`}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-10">{query ? "Ничего не найдено" : "Пока нет учеников"}</div>
          )}
        </div>
      ) : (
        /* Desktop table */
        <div className="glass overflow-hidden">
          <div className="grid px-4 py-2.5 glass-table-header text-xs text-gray-500 font-medium"
            style={{ gridTemplateColumns: "1fr 180px 140px 130px" }}>
            <span>Ученик</span>
            <span className="flex items-center gap-1"><Icon name="calendar" size={11} />Следующий урок</span>
            <span className="flex items-center gap-1"><Icon name="dollar" size={11} />Оплата</span>
            <span className="flex items-center gap-1"><Icon name="target" size={11} />Статус</span>
          </div>

          {filtered.map((student) => {
            const status = getPaymentStatus(student)
            const next = getNextLesson(student)
            const examDays = getDaysUntilExam(student)
            const trend = getProgressTrend(student)
            const goal = GOAL_STYLE[student.goal]
            const avg = student.results?.length > 0
              ? Math.round(student.results.reduce((a, b) => a + b, 0) / student.results.length)
              : null

            return (
              <div key={student.id} onClick={() => setSelectedStudent(student.id)}
                className="group grid border-t border-white/40 px-4 py-3 items-center cursor-pointer hover:bg-white/30 active:bg-white/50 transition-colors"
                style={{ gridTemplateColumns: "1fr 180px 140px 130px" }}>

                {/* Student */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600 flex-shrink-0 overflow-hidden">
                    {student.avatar
                      ? <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                      : getInitials(student.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{student.name}</span>
                      {goal && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0 ${goal.cls}`}>
                          {goal.label}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">{student.phone}</div>
                  </div>
                </div>

                {/* Next lesson */}
                <div className="text-xs text-gray-600">
                  {next ? (
                    <span className="flex items-center gap-1.5">
                      <Icon name="calendar" size={12} className="text-blue-400 flex-shrink-0" />
                      {new Date(next.date + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })} · {next.time}
                    </span>
                  ) : (
                    <span className="text-gray-300">Не запланировано</span>
                  )}
                </div>

                {/* Payment */}
                <div>
                  {status.debt > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
                      <Icon name="warning" size={11} />−{status.label}
                    </span>
                  ) : status.label === "Оплачено" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-lg">
                      <Icon name="check" size={11} />Оплачено
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </div>

                {/* Status: exam countdown or score trend */}
                <div className="flex items-center justify-between">
                  {examDays !== null ? (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${
                      examDays <= 7  ? "bg-red-50 text-red-700" :
                      examDays <= 30 ? "bg-amber-50 text-amber-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      <Icon name="target" size={11} />
                      {examDays === 0 ? "Сегодня!" : `${examDays} дн.`}
                    </span>
                  ) : avg !== null ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                      {trend !== null && (
                        <Icon
                          name={trend >= 0 ? "trending-up" : "trending-down"}
                          size={13}
                          className={trend > 0 ? "text-green-500" : trend < 0 ? "text-red-400" : "text-gray-400"}
                        />
                      )}
                      <span className="font-medium">{avg}</span>
                      <span className="text-gray-400">баллов</span>
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                  <button onClick={(e) => handleDelete(student.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500">
                    <Icon name="x" size={14} />
                  </button>
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-gray-400 border-t border-white/40">
              {query ? "Ничего не найдено" : "Пока нет учеников"}
            </div>
          )}
        </div>
      )}

      {showModal && <AddStudentModal onClose={() => setShowModal(false)} onAdd={(s) => setStudents((prev) => [...prev, s])} />}
      {acceptingRequest && (
        <AddStudentModal
          onClose={() => setAcceptingRequest(null)}
          onAdd={(s) => handleAcceptComplete(s, acceptingRequest.id)}
          initialName={acceptingRequest.name}
          initialPhone={acceptingRequest.phone}
        />
      )}
    </div>
  )
}

export default Students
