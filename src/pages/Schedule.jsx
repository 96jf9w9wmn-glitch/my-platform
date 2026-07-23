import { Fragment, useState } from "react"
import { createPortal } from "react-dom"
import Icon from "../components/Icon"

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

function Schedule({ students, setStudents }) {
  const [baseDate, setBaseDate] = useState(new Date())
  const [showForm, setShowForm] = useState(false)
  const [newLesson, setNewLesson] = useState({ studentId: "", date: "", time: "", duration: "" })
  const [view, setView] = useState("month")
  const [selectedDay, setSelectedDay] = useState(formatDate(new Date()))

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
      alert("Заполни все поля!")
      return
    }
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
    setShowForm(false)
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

  const weekLabel = `${weekDates[0].toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} — ${weekDates[6].toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}`
  const monthLabel = `${MONTH_NAMES[month]} ${year}`
  const todayStr = formatDate(new Date())
  const selectedDayLessons = selectedDay ? getLessonsForDate(selectedDay) : []

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-medium">Расписание</h1>
        <button onClick={() => openExtraForm("")} className="btn-primary px-3 py-2 text-sm">
          + Доп занятие
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod} className="text-gray-400 hover:text-gray-600 text-xl px-2">‹</button>
          <span className="text-sm font-medium text-gray-700">{view === "week" ? weekLabel : monthLabel}</span>
          <button onClick={nextPeriod} className="text-gray-400 hover:text-gray-600 text-xl px-2">›</button>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView("month")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === "month" ? "bg-white dark:bg-white/15 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500"}`}
          >
            Месяц
          </button>
          <button
            onClick={() => setView("week")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === "week" ? "bg-white dark:bg-white/15 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500"}`}
          >
            Неделя
          </button>
        </div>
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
                    return (
                      <div key={i} className={`${isExtra ? "bg-green-50" : "bg-blue-50"} rounded-xl px-3 py-2.5`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className={`text-sm font-medium flex items-center gap-1.5 ${isExtra ? "text-green-700" : "text-blue-700"}`}>
                              {l.studentName}
                              {isExtra && <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-normal">доп</span>}
                            </div>
                            <div className={`text-xs ${isExtra ? "text-green-500" : "text-blue-500"}`}>{l.time} · {l.duration} мин</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {stu?.boardUrl && (
                              <a href={stu.boardUrl} target="_blank" rel="noreferrer"
                                className="flex items-center text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-400/30 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-400/10 transition-colors bg-white dark:bg-white/5"
                                title="Доска">
                                <Icon name="clipboard" size={14} />
                              </a>
                            )}
                            {stu?.callUrl && (
                              <a href={stu.callUrl} target="_blank" rel="noreferrer"
                                className="flex items-center text-green-600 dark:text-green-400 border border-green-200 dark:border-green-400/30 px-2 py-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-400/10 transition-colors bg-white dark:bg-white/5"
                                title="Звонок">
                                <Icon name="video" size={14} />
                              </a>
                            )}
                            <button
                              onClick={() => removeLesson(l.studentId, selectedDay, l.time)}
                              className={`${isExtra ? "text-green-300" : "text-blue-300"} hover:text-red-500`}
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
                      {lessons.map((s) => {
                        const lesson = (s.lessons || []).find((l) => l.date === dateStr && l.time === hour) || { duration: s.lessonDuration || 60 }
                        const duration = lesson.duration || 60
                        const isExtra = !!lesson.extra
                        const heightPx = (duration / 60) * 52
                        return (
                          <div key={s.id} style={{ height: heightPx + "px", position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 }}
                            className={`week-lesson ${isExtra ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"} text-xs rounded-md px-2 py-1 flex justify-between items-start group overflow-hidden`}>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">{s.name.split(" ")[0]}{isExtra && <span className="ml-1 opacity-60">доп</span>}</div>
                              <div className={`${isExtra ? "text-green-500" : "text-blue-500"} opacity-70`}>{duration} мин</div>
                              {(s.boardUrl || s.callUrl) && (
                                <div className="flex gap-0.5 mt-0.5">
                                  {s.boardUrl && (
                                    <a href={s.boardUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Доска" className="opacity-60 hover:opacity-100 text-blue-600"><Icon name="clipboard" size={10} /></a>
                                  )}
                                  {s.callUrl && (
                                    <a href={s.callUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Звонок" className="opacity-60 hover:opacity-100 text-green-600"><Icon name="video" size={10} /></a>
                                  )}
                                </div>
                              )}
                            </div>
                            <button onClick={() => removeLesson(s.id, dateStr, hour)} className={`${isExtra ? "text-green-400" : "text-blue-400"} hover:text-red-500 opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0`}><Icon name="x" size={12} /></button>
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

      {showForm && createPortal(
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
          <div className="glass-modal w-full max-w-sm flex flex-col" style={{ maxHeight: "90dvh" }}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100/60 flex-shrink-0">
              <h2 className="text-lg font-medium">Доп. занятие</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><Icon name="x" size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Ученик</label>
                <select value={newLesson.studentId} onChange={(e) => setNewLesson((p) => ({ ...p, studentId: e.target.value }))}
                  className="input-glass">
                  <option value="">Выбери ученика...</option>
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
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${newLesson.time === time ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
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
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${String(newLesson.duration) === String(d) ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100/60 flex-shrink-0">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
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
