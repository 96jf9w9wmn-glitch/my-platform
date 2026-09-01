import { Fragment, useState } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "../components/Icon"
import SegmentSwitch from "../components/SegmentSwitch"
import ConfirmModal from "../components/ConfirmModal"
import RescheduleModal from "../components/RescheduleModal"
import LessonStatusModal, { LessonStatusBadge } from "../components/LessonStatusModal"
import { lessonStatusNotice } from "../lessonStatus"
import { isLessonPast, setLessonStatus, LESSON_EXCUSED } from "../utils"
import { supabase } from "../supabase"
import { MOVE_ANCHOR_TUTOR } from "../notifTarget"
import { tutorLessons, findClash, clashLine, formatSpan, lessonsClash } from "../lessonConflict"
import {
  applyMoveToStudent, proposeMoveOnStudent, setMoveRequest, pendingMoveRequests,
  formatLessonWhen, formatLessonShort, MOVE_BY_STUDENT, MOVE_BY_TUTOR,
} from "../lessonMove"

const VIEWS = [{ key: "month", label: "Месяц" }, { key: "week", label: "Неделя" }]

const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"]
const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]

function getWeekDates(baseDate) {
  const date = new Date(baseDate)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function getDaysInMonth(year, month) {
  const days = []
  const date = new Date(year, month, 1)
  while (date.getMonth() === month) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function Schedule({ students, setStudents, onOpenBoard }) {
  const [baseDate, setBaseDate] = useState(new Date())
  const [showForm, setShowForm] = useState(false)
  const [newLesson, setNewLesson] = useState({ studentId: "", date: "", time: "", duration: "" })
  const [view, setView] = useState("month")
  const [formError, setFormError] = useState("")
  // Плавное закрытие: без этого модалка исчезала рывком.
  const { cls: closingCls, close: closeForm } = useClosing(() => { setShowForm(false); setFormError("") })
  const [selectedDay, setSelectedDay] = useState(formatDate(new Date()))
  // Занятие удаляется одним нажатием на крестик, а отменить это нечем —
  // поэтому сначала спрашиваем.
  const [confirmDel, setConfirmDel] = useState(null)
  // Перенос согласуют обе стороны: репетитор занятие не двигает, а предлагает
  // новое время — переезжает оно только после согласия ученика. Ответные
  // просьбы учеников ждут здесь же.
  const [moving, setMoving] = useState(null)
  const [confirmDecline, setConfirmDecline] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(null)
  // Занятие, которому выбирают пометку «не состоялось».
  const [statusFor, setStatusFor] = useState(null)
  const incomingMoves = pendingMoveRequests(students, MOVE_BY_STUDENT)
  const outgoingMoves = pendingMoveRequests(students, MOVE_BY_TUTOR)

  function notifyStudentOf(student, title, body) {
    // Пока ученик не завёл аккаунт, доставить уведомление некому — сам перенос
    // от этого не отменяется.
    const accountId = student?.studentAccountId
    if (!accountId) return
    supabase.from("notifications").insert({ user_id: accountId, title, body })
      .then(({ error }) => { if (error) console.error("Уведомление о переносе не ушло:", error.message) })
  }

  // Согласие с просьбой ученика — единственный случай, когда занятие двигается
  // прямо отсюда: вторая сторона уже высказалась.
  function acceptMove(entry) {
    const student = students.find((s) => String(s.id) === String(entry.studentId))
    if (!student) return
    const to = { date: entry.request.date, time: entry.request.time }
    setStudents((prev) => prev.map((s) => (
      String(s.id) === String(entry.studentId) ? { ...s, ...applyMoveToStudent(s, entry.lesson, to) } : s
    )))
    notifyStudentOf(student, "Перенос согласован",
      `${formatLessonWhen(entry.lesson.date, entry.lesson.time)} → ${formatLessonWhen(to.date, to.time)}`)
  }

  // Предложение репетитора. Занятие остаётся на месте, пока ученик не ответит.
  function proposeMove(studentId, from, to, comment) {
    const student = students.find((s) => String(s.id) === String(studentId))
    if (!student) return
    const request = {
      by: MOVE_BY_TUTOR,
      date: to.date,
      time: to.time,
      comment: comment || "",
      at: new Date().toISOString(),
    }
    setStudents((prev) => prev.map((s) => (
      String(s.id) === String(studentId) ? { ...s, ...proposeMoveOnStudent(s, from, request) } : s
    )))
    notifyStudentOf(student, "Репетитор предлагает перенести занятие",
      `${formatLessonWhen(from.date, from.time)} → ${formatLessonWhen(to.date, to.time)}. Подтверди перенос в кабинете.`
      + (comment ? ` «${comment}»` : ""))
  }

  function clearRequest(entry) {
    setStudents((prev) => prev.map((s) => (
      String(s.id) === String(entry.studentId)
        ? { ...s, lessons: setMoveRequest(s.lessons, entry.lesson, null) }
        : s
    )))
    return students.find((s) => String(s.id) === String(entry.studentId))
  }

  function declineRequest(entry) {
    const student = clearRequest(entry)
    notifyStudentOf(student, "Перенос не согласован",
      `Занятие ${formatLessonWhen(entry.lesson.date, entry.lesson.time)} остаётся в расписании. Напиши репетитору, чтобы договориться о другом времени.`)
  }

  function cancelOwnRequest(entry) {
    const student = clearRequest(entry)
    notifyStudentOf(student, "Предложение о переносе отменено",
      `Занятие ${formatLessonWhen(entry.lesson.date, entry.lesson.time)} остаётся на прежнем месте.`)
  }

  // Пометка «не состоялось». Единого правила нет: одни репетиторы оставляют
  // оплату за пропуск себе, другие переносят время — поэтому выбор делается по
  // каждому занятию и хранится в нём самом.
  function applyStatus(entry, status) {
    const student = students.find((s) => String(s.id) === String(entry.studentId))
    setStudents((prev) => prev.map((s) => (
      String(s.id) === String(entry.studentId)
        ? { ...s, lessons: setLessonStatus(s.lessons || [], entry.lesson, status) }
        : s
    )))
    const [title, body] = lessonStatusNotice(status, entry.lesson.date, entry.lesson.time)
    notifyStudentOf(student, title, body)
  }

  // Занят ли слот у самого репетитора: он не может вести двоих сразу. Сравниваем
  // ОТРЕЗКИ времени, а не начало: занятие в 14:30 на час перекрывает 15:00.
  // Перенос это не запрещает — только предупреждает.
  function slotBusy(studentId, from) {
    return (date, time) => {
      const others = tutorLessons(students)
      const duration = from?.duration || 60
      const hit = findClash({ date, time, duration }, others, { skip: from, skipStudentId: studentId })
      if (!hit) return null
      const who = hit.studentName ? `${hit.studentName}, ` : ""
      return `На это время уже поставлено занятие: ${who}${formatSpan(hit)}.`
    }
  }

  // Занятие, на которое налезает то, что сейчас набирается в форме «Новое
  // занятие». Показываем ещё до нажатия «Добавить», чтобы время правилось
  // сразу, а не после ошибки.
  function newLessonClash() {
    if (!newLesson.studentId || !newLesson.date || !newLesson.time) return null
    const student = students.find((s) => String(s.id) === String(newLesson.studentId))
    const duration = Number(newLesson.duration) || student?.lessonDuration || 60
    const candidate = { date: newLesson.date, time: newLesson.time, duration }
    const hit = findClash(candidate, tutorLessons(students))
    return hit ? { lesson: candidate, other: hit } : null
  }

  // Занятие, на которое налезет просьба ученика, если её принять.
  function requestClash(entry) {
    const candidate = {
      date: entry.request.date,
      time: entry.request.time,
      duration: entry.lesson.duration || 60,
    }
    const hit = findClash(candidate, tutorLessons(students), {
      skip: entry.lesson,
      skipStudentId: entry.studentId,
    })
    return hit ? { lesson: candidate, other: hit } : null
  }

  function openMove(lesson) {
    setMoving(lesson)
  }

  function openExtraForm(dateStr) {
    setNewLesson({ studentId: "", date: dateStr || "", time: "", duration: "" })
    setShowForm(true)
  }

  const weekDates = getWeekDates(baseDate)
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const monthDays = getDaysInMonth(year, month)
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const emptyDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1

  function prevPeriod() {
    const d = new Date(baseDate)
    if (view === "week") d.setDate(d.getDate() - 7)
    else d.setMonth(d.getMonth() - 1)
    setBaseDate(d)
  }

  function nextPeriod() {
    const d = new Date(baseDate)
    if (view === "week") d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
    setBaseDate(d)
  }

  function getLessonsForDate(dateStr) {
    return students.flatMap((s) => {
      const lessons = (s.lessons || []).filter((l) => l.date === dateStr)
      if (lessons.length > 0) return lessons.map((l) => ({ ...l, studentName: s.name, studentId: s.id }))
      const legacy = ((s.lessonDates || []).includes(dateStr) && s.lessonTime)
        ? [{ date: dateStr, time: s.lessonTime, duration: s.lessonDuration || 60 }]
        : []
      return legacy.map((l) => ({ ...l, studentName: s.name, studentId: s.id }))
    }).sort((a, b) => a.time.localeCompare(b.time))
  }

  function getLessonsForSlot(dateStr, time) {
    return students.filter((s) =>
      (s.lessons || []).some((l) => l.date === dateStr && l.time === time) ||
      ((s.lessonDates || []).includes(dateStr) && s.lessonTime === time)
    )
  }

  function handleAddLesson() {
    if (!newLesson.studentId || !newLesson.date || !newLesson.time) {
      setFormError("Выберите ученика, дату и время.")
      return
    }
    // Два занятия в одно время — не опечатка, которую можно молча сохранить:
    // репетитор физически не проведёт оба.
    const clash = newLessonClash()
    if (clash) {
      setFormError(`Это время занято. ${clashLine(clash)}`)
      return
    }
    setFormError("")
    setStudents((prev) =>
      prev.map((s) => {
        if (String(s.id) !== String(newLesson.studentId)) return s
        const duration = Number(newLesson.duration) || s.lessonDuration || 60
        return {
          ...s,
          lessons: [...(s.lessons || []), { date: newLesson.date, time: newLesson.time, duration, extra: true }],
        }
      })
    )
    closeForm()
    setNewLesson({ studentId: "", date: "", time: "", duration: "" })
  }

  function removeLesson(studentId, dateStr, time) {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              lessons: (s.lessons || []).filter((l) => !(l.date === dateStr && l.time === time)),
              lessonDates: (s.lessonDates || []).filter((d) => d !== dateStr),
            }
          : s
      )
    )
  }

  function confirmRemove() {
    if (!confirmDel) return
    removeLesson(confirmDel.studentId, confirmDel.date, confirmDel.time)
    setConfirmDel(null)
  }

  // Пересечение считаем на каждый рендер формы: время и длительность меняются
  // кнопками, и предупреждение должно поспевать за ними.
  const formClash = showForm ? newLessonClash() : null

  const weekLabel = `${weekDates[0].toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} — ${weekDates[6].toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}`
  const monthLabel = `${MONTH_NAMES[month]} ${year}`
  const todayStr = formatDate(new Date())
  const selectedDayLessons = selectedDay ? getLessonsForDate(selectedDay) : []
  // Занятия, идущие внахлёст. Раньше такую пару в дне не было видно вовсе:
  // 14:30 на час и 15:00 выглядели как два обычных занятия подряд.
  const dayOverlaps = selectedDayLessons.map((l, i) => (
    l.status !== LESSON_EXCUSED
    && selectedDayLessons.some((o, j) => j !== i && o.status !== LESSON_EXCUSED && lessonsClash(l, o))
  ))

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
        <div>
          <h1 className="text-xl font-medium page-title">Расписание</h1>
          {/* Постоянные дни задаются в карточке ученика, и человек, пришедший
              сюда ставить занятия, раньше об этом ниоткуда не узнавал. */}
          <p className="text-sm page-subtitle mt-0.5">
            Разовые занятия добавляйте здесь. Постоянные дни и время — в карточке ученика,
            раздел «Ученики» → «Редактировать».
          </p>
        </div>
        <button onClick={() => openExtraForm("")} className="btn-primary px-3 py-2 text-sm self-stretch sm:self-auto shrink-0">
          + Занятие
        </button>
      </div>

      {/* Переносы, ждущие ответа. Держим наверху расписания: пока стороны не
          договорились, занятие стоит на прежнем месте, и найти этот список
          должно быть негде больше, кроме как здесь. */}
      {incomingMoves.length > 0 && (
        <div id={MOVE_ANCHOR_TUTOR} className="glass-tint-amber p-4 mb-4 slide-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-amber-600"><Icon name="repeat" size={15} /></span>
            <span className="text-sm font-medium">Просьбы о переносе</span>
            <span className="text-[11px] text-amber-700 bg-amber-500/15 px-1.5 py-0.5 rounded-full tabular-nums">
              {incomingMoves.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {incomingMoves.map((r) => (
              <div key={`${r.studentId}-${r.lesson.date}-${r.lesson.time}`} className="glass-sm px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{r.studentName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {formatLessonShort(r.lesson.date, r.lesson.time)}
                    <span className="mx-1.5 text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {formatLessonShort(r.request.date, r.request.time)}
                    </span>
                  </div>
                  {r.request.comment && (
                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">«{r.request.comment}»</div>
                  )}
                  {/* Ученик видит только своё расписание, поэтому просьба может
                      прийти на время, где у репетитора уже стоит другой ученик.
                      Согласие не запрещаем — но показываем, на что соглашаемся. */}
                  {requestClash(r) && (
                    <div className="text-xs text-amber-700 mt-1 leading-relaxed">
                      Это время занято: {clashLine(requestClash(r))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => acceptMove(r)} className="btn-primary px-3 py-1.5 text-xs">
                    Согласиться
                  </button>
                  <button
                    onClick={() => openMove({
                      studentId: r.studentId, studentName: r.studentName,
                      date: r.lesson.date, time: r.lesson.time, duration: r.lesson.duration,
                      suggested: { date: r.request.date, time: r.request.time },
                    })}
                    className="text-xs border border-gray-200 dark:border-white/15 px-2.5 py-1.5 rounded-lg text-gray-600 hover:bg-white/60 dark:hover:bg-white/[0.08] transition active:scale-95"
                  >
                    Другое время
                  </button>
                  <button
                    onClick={() => setConfirmDecline(r)}
                    aria-label="Отклонить просьбу"
                    title="Отклонить"
                    className="text-gray-400 hover:text-red-500 transition-transform active:scale-90"
                  >
                    <Icon name="x" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Предложения, отправленные ученикам: занятие ещё не переехало. */}
      {outgoingMoves.length > 0 && (
        <div className="glass p-4 mb-4 slide-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gray-400"><Icon name="clock" size={15} /></span>
            <span className="text-sm font-medium">Ждут ответа ученика</span>
            <span className="text-[11px] text-gray-500 ring-1 ring-gray-200/70 dark:ring-white/15 px-1.5 py-0.5 rounded-full tabular-nums">
              {outgoingMoves.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {outgoingMoves.map((r) => (
              <div key={`${r.studentId}-${r.lesson.date}-${r.lesson.time}`} className="glass-sm px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{r.studentName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {formatLessonShort(r.lesson.date, r.lesson.time)}
                    <span className="mx-1.5 text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {formatLessonShort(r.request.date, r.request.time)}
                    </span>
                    <span className="text-gray-400"> · вы предложили</span>
                  </div>
                  {r.request.comment && (
                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">«{r.request.comment}»</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openMove({
                      studentId: r.studentId, studentName: r.studentName,
                      date: r.lesson.date, time: r.lesson.time, duration: r.lesson.duration,
                      suggested: { date: r.request.date, time: r.request.time, comment: r.request.comment },
                    })}
                    className="text-xs border border-gray-200 dark:border-white/15 px-2.5 py-1.5 rounded-lg text-gray-600 hover:bg-white/60 dark:hover:bg-white/[0.08] transition active:scale-95"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => setConfirmCancel(r)}
                    aria-label="Отменить предложение"
                    title="Отменить предложение"
                    className="text-gray-400 hover:text-red-500 transition-transform active:scale-90"
                  >
                    <Icon name="x" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod} className="text-gray-500 hover:text-gray-700 text-xl px-2">‹</button>
          <span className="text-sm font-medium text-gray-700">{view === "week" ? weekLabel : monthLabel}</span>
          <button onClick={nextPeriod} className="text-gray-500 hover:text-gray-700 text-xl px-2">›</button>
        </div>
        <SegmentSwitch size="sm" ariaLabel="Вид расписания" value={view} onChange={setView} items={VIEWS} />
      </div>

      {view === "month" && (
        <div className="sched-view-enter">
          <div className="glass p-3 mb-3">
            <div className="grid grid-cols-7 mb-2">
              {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((d) => (
                <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
              ))}
            </div>
            <div key={`${year}-${month}`} className="grid grid-cols-7 gap-0.5">
              {Array(emptyDays).fill(null).map((_, i) => (
                <div key={"e" + i} />
              ))}
              {monthDays.map((day, i) => {
                const dateStr = formatDate(day)
                const dayLessons = getLessonsForDate(dateStr)
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selectedDay
                const isWeekend = day.getDay() === 0 || day.getDay() === 6

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDay(dateStr)}
                    className={`cal-day relative flex flex-col items-center py-1 rounded-xl ${
                      isSelected ? "bg-blue-600 text-white" :
                      isToday ? "bg-blue-100" : ""
                    }`}
                    style={{ animationDelay: `${(emptyDays + i) * 8}ms` }}
                  >
                    <span className={`text-sm font-medium ${
                      isSelected ? "text-white" :
                      isToday ? "text-blue-600" :
                      isWeekend ? "text-gray-400" :
                      "text-gray-700"
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
            <div key={selectedDay} className="glass p-4 slide-up">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-700">
                  {new Date(selectedDay + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
                </div>
                <button
                  onClick={() => openExtraForm(selectedDay)}
                  className="text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                  + Доп занятие
                </button>
              </div>
              {selectedDayLessons.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-4">Занятий нет</div>
              ) : (
                <div className="flex flex-col gap-2 stagger">
                  {selectedDayLessons.map((l, i) => {
                    const stu = students.find((s) => s.id === l.studentId)
                    const isExtra = !!l.extra
                    // Решать судьбу занятия можно только после того, как оно
                    // прошло: до этого «не состоялось» — гадание.
                    const isPast = isLessonPast(l)
                    const off = l.status === LESSON_EXCUSED
                    return (
                      <div key={i} className={`${isExtra ? "bg-green-50" : "bg-blue-50"} rounded-xl px-3 py-2.5 ${off ? "opacity-70" : ""}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className={`text-sm font-medium flex items-center gap-1.5 flex-wrap ${isExtra ? "text-green-700" : "text-blue-700"}`}>
                              {l.studentName}
                              {isExtra && <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-normal">доп</span>}
                              {l.moveRequest && (
                                <span className="text-xs bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded-full font-normal">
                                  {l.moveRequest.by === MOVE_BY_TUTOR ? "ждёт ответа ученика" : "просит перенос"}
                                </span>
                              )}
                              <LessonStatusBadge status={l.status} />
                              {dayOverlaps[i] && (
                                <span
                                  title="Занятия идут внахлёст"
                                  className="text-xs bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded-full font-normal"
                                >
                                  наложение
                                </span>
                              )}
                            </div>
                            <div className={`text-xs ${isExtra ? "text-green-500" : "text-blue-500"}`}>
                              {l.time} · {l.duration} мин
                              {l.movedFrom && (
                                <span className="text-gray-400"> · перенесено с {formatLessonShort(l.movedFrom.date, l.movedFrom.time)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Доска у ученика одна: своя ссылка либо наша. */}
                            {stu?.boardUrl ? (
                              <a href={stu.boardUrl} target="_blank" rel="noreferrer"
                                className="press-tap flex items-center text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-400/30 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-400/10 transition-colors bg-white dark:bg-white/5"
                                title="Доска">
                                <Icon name="link" size={14} />
                              </a>
                            ) : stu && onOpenBoard ? (
                              <button onClick={() => onOpenBoard(stu.id, stu.name)}
                                className="press-tap flex items-center text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-400/30 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-400/10 transition-colors bg-white dark:bg-white/5"
                                title="Доска">
                                <Icon name="clipboard" size={14} />
                              </button>
                            ) : null}
                            {stu?.callUrl && (
                              <a href={stu.callUrl} target="_blank" rel="noreferrer"
                                className="flex items-center text-green-600 dark:text-green-400 border border-green-200 dark:border-green-400/30 px-2 py-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-400/10 transition-colors bg-white dark:bg-white/5"
                                title="Звонок">
                                <Icon name="video" size={14} />
                              </a>
                            )}
                            <button
                              onClick={() => openMove({
                                studentId: l.studentId, studentName: l.studentName,
                                date: selectedDay, time: l.time, duration: l.duration,
                                suggested: l.moveRequest ? { date: l.moveRequest.date, time: l.moveRequest.time } : null,
                              })}
                              aria-label="Перенести занятие"
                              title="Перенести"
                              className={`${isExtra ? "text-green-400" : "text-blue-400"} hover:text-blue-600 transition-transform active:scale-90`}
                            >
                              <Icon name="repeat" size={15} />
                            </button>
                            {isPast && (
                              <button
                                onClick={() => setStatusFor({
                                  studentId: l.studentId, studentName: l.studentName,
                                  lesson: { date: l.date, time: l.time, duration: l.duration, status: l.status },
                                })}
                                aria-label="Занятие не состоялось"
                                title="Не состоялось"
                                className={`${l.status ? "text-amber-500" : isExtra ? "text-green-400" : "text-blue-400"} hover:text-amber-600 transition-transform active:scale-90`}
                              >
                                <Icon name="user-x" size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmDel({ studentId: l.studentId, date: selectedDay, time: l.time, name: l.studentName })}
                              aria-label="Удалить занятие"
                              className={`${isExtra ? "text-green-300" : "text-blue-300"} hover:text-red-500 transition-transform active:scale-90`}
                            >
                              <Icon name="x" size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === "week" && (
        <div className="sched-view-enter glass overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: "60px repeat(7, minmax(70px, 1fr))", minWidth: "560px" }}>
            <div className="border-b border-gray-100 p-2" />
            {weekDates.map((date, i) => {
              const isToday = formatDate(date) === todayStr
              return (
                <div key={i} className={`border-b border-l border-gray-100 p-2 text-center ${isToday ? "bg-blue-50" : ""}`}>
                  <div className="text-xs text-gray-400">{DAY_NAMES[i]}</div>
                  <div className={`text-sm font-medium ${isToday ? "text-blue-600" : "text-gray-700"}`}>{date.getDate()}</div>
                </div>
              )
            })}
            {HOURS.map((hour) => (
              <Fragment key={hour}>
                <div className="border-b border-gray-100 p-2 text-xs text-gray-400 text-right pr-3 pt-3">{hour}</div>
                {weekDates.map((date) => {
                  const dateStr = formatDate(date)
                  const lessons = getLessonsForSlot(dateStr, hour)
                  const isToday = dateStr === todayStr
                  return (
                    <div key={dateStr + hour} className={`border-b border-l border-gray-100 min-h-[52px] relative ${isToday ? "bg-blue-50/50" : ""}`}>
                      {lessons.map((s, idx) => {
                        const lesson = (s.lessons || []).find((l) => l.date === dateStr && l.time === hour) || { duration: s.lessonDuration || 60 }
                        const duration = lesson.duration || 60
                        const isExtra = !!lesson.extra
                        const off = lesson.status === LESSON_EXCUSED
                        const past = isLessonPast({ date: dateStr, time: hour, duration })
                        const heightPx = (duration / 60) * 52
                        // Занятия в одном часе делят ячейку по ширине: после переноса
                        // на занятый слот они иначе легли бы друг на друга, и
                        // репетитор видел бы только одно из двух.
                        return (
                          <div key={s.id} style={{
                            height: heightPx + "px", position: "absolute", top: 0, zIndex: 1,
                            left: `${(idx * 100) / lessons.length}%`, width: `${100 / lessons.length}%`,
                          }}
                            className={`week-lesson ${isExtra ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"} ${off ? "opacity-60" : ""} text-xs rounded-md px-2 py-1 flex justify-between items-start group overflow-hidden`}>
                            <div className="min-w-0 flex-1">
                              <div className={`font-medium truncate ${off ? "line-through" : ""}`} title={off ? "Занятие не идёт в счёт" : lesson.status ? "Ученик не пришёл, занятие идёт в счёт" : undefined}>{s.name.split(" ")[0]}{isExtra && <span className="ml-1 opacity-60">доп</span>}{lesson.moveRequest && <span className="ml-1 text-amber-600">•</span>}{lesson.status && !off && <span className="ml-1 text-amber-600">✕</span>}</div>
                              <div className={`${isExtra ? "text-green-500" : "text-blue-500"} opacity-70`}>{duration} мин</div>
                              {(s.boardUrl || s.callUrl || onOpenBoard) && (
                                <div className="flex gap-0.5 mt-0.5">
                                  {s.boardUrl ? (
                                    <a href={s.boardUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Доска" className="opacity-60 hover:opacity-100 text-blue-600"><Icon name="link" size={10} /></a>
                                  ) : onOpenBoard ? (
                                    <button onClick={(e) => { e.stopPropagation(); onOpenBoard(s.id, s.name) }} title="Доска" className="opacity-60 hover:opacity-100 text-blue-600"><Icon name="clipboard" size={10} /></button>
                                  ) : null}
                                  {s.callUrl && (
                                    <a href={s.callUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Звонок" className="opacity-60 hover:opacity-100 text-green-600"><Icon name="video" size={10} /></a>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-center gap-0.5 flex-shrink-0 ml-1">
                            <button onClick={() => openMove({ studentId: s.id, studentName: s.name, date: dateStr, time: hour, duration, suggested: lesson.moveRequest ? { date: lesson.moveRequest.date, time: lesson.moveRequest.time } : null })} aria-label="Перенести занятие" title="Перенести" className={`${isExtra ? "text-green-400" : "text-blue-400"} hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-transform active:scale-90`}><Icon name="repeat" size={12} /></button>
                            {past && <button onClick={() => setStatusFor({ studentId: s.id, studentName: s.name, lesson: { date: dateStr, time: hour, duration, status: lesson.status } })} aria-label="Занятие не состоялось" title="Не состоялось" className={`${lesson.status ? "text-amber-500" : isExtra ? "text-green-400" : "text-blue-400"} hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-transform active:scale-90`}><Icon name="user-x" size={12} /></button>}
                            <button onClick={() => setConfirmDel({ studentId: s.id, date: dateStr, time: hour, name: s.name })} aria-label="Удалить занятие" className={`${isExtra ? "text-green-400" : "text-blue-400"} hover:text-red-500 opacity-0 group-hover:opacity-100 transition-transform active:scale-90`}><Icon name="x" size={12} /></button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {moving && (
        <RescheduleModal
          lesson={{ date: moving.date, time: moving.time, duration: moving.duration }}
          who={moving.studentName}
          title="Предложить перенос"
          hint={moving.suggested
            ? "Время, которое просит ученик, уже подставлено. Поправьте, если не подходит, — ученику уйдёт встречное предложение, и занятие переедет, когда он согласится."
            : "Занятие переедет, когда ученик подтвердит перенос. До этого оно остаётся на прежнем месте."}
          initial={moving.suggested}
          commentLabel="Комментарий ученику (по желанию)"
          commentPlaceholder="Например: в это время у меня появилось окно"
          conflictCheck={slotBusy(moving.studentId, { date: moving.date, time: moving.time })}
          submitLabel="Предложить"
          onSubmit={({ date, time, comment }) => {
            proposeMove(moving.studentId, { date: moving.date, time: moving.time, duration: moving.duration }, { date, time }, comment)
            setMoving(null)
          }}
          onClose={() => setMoving(null)}
        />
      )}

      {statusFor && (
        <LessonStatusModal
          lesson={statusFor.lesson}
          who={statusFor.studentName}
          onPick={(status) => applyStatus(statusFor, status)}
          onClose={() => setStatusFor(null)}
        />
      )}

      <ConfirmModal
        open={!!confirmDecline}
        danger
        title="Отклонить перенос?"
        message={confirmDecline
          ? `${confirmDecline.studentName} останется с занятием ${formatLessonWhen(confirmDecline.lesson.date, confirmDecline.lesson.time)}. Ученик получит уведомление.`
          : ""}
        confirmLabel="Отклонить"
        cancelLabel="Отмена"
        onConfirm={() => { declineRequest(confirmDecline); setConfirmDecline(null) }}
        onCancel={() => setConfirmDecline(null)}
      />

      <ConfirmModal
        open={!!confirmCancel}
        danger
        title="Отменить предложение?"
        message={confirmCancel
          ? `Занятие ${formatLessonWhen(confirmCancel.lesson.date, confirmCancel.lesson.time)} останется на прежнем месте, а ${confirmCancel.studentName} получит уведомление.`
          : ""}
        confirmLabel="Отменить перенос"
        cancelLabel="Оставить"
        onConfirm={() => { cancelOwnRequest(confirmCancel); setConfirmCancel(null) }}
        onCancel={() => setConfirmCancel(null)}
      />

      <ConfirmModal
        open={!!confirmDel}
        danger
        title="Удалить занятие?"
        message={confirmDel
          ? `${confirmDel.name}, ${new Date(confirmDel.date + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}, ${confirmDel.time}. Занятие пропадёт из расписания — вернуть его можно будет только добавив заново.`
          : ""}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        onConfirm={confirmRemove}
        onCancel={() => setConfirmDel(null)}
      />

      {showForm && createPortal(
        <div className={`fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 ${closingCls}`}>
          <div className={`glass-modal w-full max-w-sm flex flex-col ${closingCls}`} style={{ maxHeight: "90dvh" }}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100/60 flex-shrink-0">
              <h2 className="text-lg font-medium">Новое занятие</h2>
              <button onClick={closeForm} aria-label="Закрыть" className="text-gray-500 hover:text-gray-700"><Icon name="x" size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Ученик</label>
                <select value={newLesson.studentId} onChange={(e) => setNewLesson((p) => ({ ...p, studentId: e.target.value }))}
                  className="input-glass">
                  <option value="">Выберите ученика</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Дата</label>
                <input type="date" value={newLesson.date} onChange={(e) => setNewLesson((p) => ({ ...p, date: e.target.value }))}
                  className="input-glass" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Время</label>
                <div className="flex gap-2 flex-wrap">
                  {HOURS.map((time) => (
                    <button key={time} onClick={() => setNewLesson((p) => ({ ...p, time }))}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${newLesson.time === time ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-blue-500/[0.06]"}`}>
                      {time}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Длительность (мин)</label>
                <div className="flex gap-2 flex-wrap">
                  {[30, 45, 60, 90, 120].map((d) => (
                    <button key={d} onClick={() => setNewLesson((p) => ({ ...p, duration: String(d) }))}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${String(newLesson.duration) === String(d) ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-blue-500/[0.06]"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {formClash && (
                <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-xl px-3 py-2">
                  <span className="flex-shrink-0 mt-0.5"><Icon name="warning" size={13} /></span>
                  <span className="leading-relaxed">Это время занято. {clashLine(formClash)}</span>
                </div>
              )}
            </div>
            <div className="px-6 pt-1 flex-shrink-0">
              {formError && <div className="text-sm text-red-500 text-center">{formError}</div>}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100/60 flex-shrink-0">
              <button onClick={closeForm} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-blue-500/[0.06]">Отмена</button>
              <button onClick={handleAddLesson} className="flex-1 btn-primary py-2.5">Добавить</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default Schedule
