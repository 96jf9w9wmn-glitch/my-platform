import { useEffect, useState } from "react"
import Icon from "../components/Icon"
import { isLessonConducted, getInitials } from "../utils"

function useCountUp(target, duration = 700) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf
    const start = performance.now()
    const step = (now) => {
      if (!target) { setVal(0); return }
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(target * ease))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"]
const DAY_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"]

function getDaysInMonth(year, month) {
  const days = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function timeUntil(dateStr, timeStr) {
  const [h, m] = timeStr.split(":").map(Number)
  const [y, mo, d] = dateStr.split("-").map(Number)
  const diff = new Date(y, mo - 1, d, h, m) - new Date()
  if (diff <= 0) return "Сейчас"
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `через ${mins} мин`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem === 0 ? `через ${hrs} ч` : `через ${hrs} ч ${rem} мин`
}

function Dashboard({ students, setActivePage, onOpenBoard }) {
  const today = new Date()
  const todayStr = formatDate(today)
  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`

  const [baseDate, setBaseDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(todayStr)
  const [tick, setTick] = useState(0)

  // Refresh countdown every minute
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const monthDays = getDaysInMonth(year, month)
  const firstDay = new Date(year, month, 1).getDay()
  const emptyDays = firstDay === 0 ? 6 : firstDay - 1

  function getLessonsForDate(dateStr) {
    return students.flatMap((s) => {
      const lessons = (s.lessons || []).filter((l) => l.date === dateStr)
      if (lessons.length > 0) return lessons.map((l) => ({
        ...l, studentName: s.name, studentId: s.id,
        avatar: s.avatar, boardUrl: s.boardUrl, callUrl: s.callUrl,
      }))
      const legacy = (s.lessonDates || []).includes(dateStr) && s.lessonTime
        ? [{ date: dateStr, time: s.lessonTime, duration: s.lessonDuration || 60 }] : []
      return legacy.map((l) => ({ ...l, studentName: s.name, studentId: s.id, avatar: s.avatar }))
    }).sort((a, b) => a.time.localeCompare(b.time))
  }

  // Next upcoming lesson
  const nextLesson = (() => {
    const todayUpcoming = students.flatMap((s) =>
      (s.lessons || [])
        .filter((l) => l.date === todayStr && l.time >= currentTime)
        .map((l) => ({ ...l, studentName: s.name, studentId: s.id, avatar: s.avatar, boardUrl: s.boardUrl, callUrl: s.callUrl, isToday: true }))
    ).sort((a, b) => a.time.localeCompare(b.time))
    if (todayUpcoming.length > 0) return todayUpcoming[0]

    const future = students.flatMap((s) =>
      (s.lessons || [])
        .filter((l) => l.date > todayStr)
        .map((l) => ({ ...l, studentName: s.name, studentId: s.id, avatar: s.avatar, boardUrl: s.boardUrl, callUrl: s.callUrl, isToday: false }))
    ).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    return future[0] || null
  })()

  // Today's lessons
  const todayLessons = getLessonsForDate(todayStr)

  // This week
  const weekStart = new Date(today)
  const dow = today.getDay()
  weekStart.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  weekStart.setHours(0, 0, 0, 0)
  const weekCount = students.flatMap((s) =>
    (s.lessons || []).filter((l) => {
      const d = new Date(l.date + "T00:00:00")
      return d >= weekStart && d <= today
    })
  ).length

  // Debtors
  const debtors = students.filter((s) => {
    const conducted = (s.lessons || []).filter((l) => isLessonConducted(l, now))
    const owed = conducted.length * (s.lessonPrice || 0)
    const paid = (s.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
    return owed - paid > 0
  })

  // Upcoming next 7 days
  const in7 = new Date(today)
  in7.setDate(today.getDate() + 7)
  const upcoming = students.flatMap((s) =>
    (s.lessons || [])
      .filter((l) => l.date > todayStr && l.date <= formatDate(in7))
      .map((l) => ({ ...l, studentName: s.name }))
  ).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 5)

  const selectedLessons = selectedDay ? getLessonsForDate(selectedDay) : []
  const selectedDate = selectedDay ? new Date(selectedDay + "T00:00:00") : null

  const countStudents = useCountUp(students.length)
  const countToday = useCountUp(todayLessons.length)
  const countWeek = useCountUp(weekCount)
  const countDebtors = useCountUp(debtors.length)

  const nextLessonDate = nextLesson && !nextLesson.isToday
    ? new Date(nextLesson.date + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })
    : null

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-medium capitalize">
          {today.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Добро пожаловать</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Icon name="users" size={16} className="text-blue-600" />
          </div>
          <div>
            <div className="text-xl font-semibold leading-none">{countStudents}</div>
            <div className="text-xs text-gray-400 mt-0.5">учеников</div>
          </div>
        </div>
        <div className="glass px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Icon name="calendar" size={16} className="text-purple-600" />
          </div>
          <div>
            <div className="text-xl font-semibold leading-none">{countToday}</div>
            <div className="text-xs text-gray-400 mt-0.5">сегодня</div>
          </div>
        </div>
        <div className="glass px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <Icon name="check" size={16} className="text-green-600" />
          </div>
          <div>
            <div className="text-xl font-semibold leading-none">{countWeek}</div>
            <div className="text-xs text-gray-400 mt-0.5">за неделю</div>
          </div>
        </div>
        <button
          onClick={() => debtors.length > 0 && setActivePage("payment")}
          className={`no-press glass px-4 py-3 flex items-center gap-3 text-left ${debtors.length > 0 ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${debtors.length > 0 ? "bg-amber-100" : "bg-gray-100"}`}>
            <Icon name="warning" size={16} className={debtors.length > 0 ? "text-amber-600" : "text-gray-400"} />
          </div>
          <div>
            <div className={`text-xl font-semibold leading-none ${debtors.length > 0 ? "text-amber-600" : ""}`}>{countDebtors}</div>
            <div className="text-xs text-gray-400 mt-0.5">должников</div>
          </div>
        </button>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left: next lesson + today */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* Next lesson hero */}
          {nextLesson ? (
            <div className="next-lesson-card rounded-2xl p-5 bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xs font-medium opacity-70 uppercase tracking-wide mb-1">
                    {nextLesson.isToday ? "Следующее занятие" : `Следующее занятие · ${nextLessonDate}`}
                  </div>
                  <div className="text-2xl font-semibold">{nextLesson.studentName}</div>
                  <div className="text-sm opacity-80 mt-0.5">{nextLesson.time} · {nextLesson.duration} мин</div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <div className="text-sm font-medium bg-white/20 rounded-xl px-3 py-1.5 backdrop-blur-sm">
                    {tick >= 0 && timeUntil(nextLesson.date, nextLesson.time)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                  <button onClick={() => onOpenBoard?.(nextLesson.studentId, nextLesson.studentName)}
                    className="press-tap flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
                    <Icon name="clipboard" size={14} />Доска
                  </button>
                  {nextLesson.boardUrl && (
                    <a href={nextLesson.boardUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
                      <Icon name="link" size={14} />Внешняя
                    </a>
                  )}
                  {nextLesson.callUrl && (
                    <a href={nextLesson.callUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
                      <Icon name="video" size={14} />Звонок
                    </a>
                  )}
                </div>
            </div>
          ) : (
            <div className="glass p-5 flex items-center gap-3 text-gray-400">
              <Icon name="calendar" size={20} />
              <span className="text-sm">Занятий не запланировано</span>
            </div>
          )}

          {/* Today's lessons */}
          <div className="glass p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium">Занятия сегодня</h2>
              {todayLessons.length > 0 && (
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{todayLessons.length}</span>
              )}
            </div>
            {todayLessons.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-6">Занятий сегодня нет</div>
            ) : (
              <div className="flex flex-col gap-0.5 stagger">
                {todayLessons.map((l, i) => {
                  const isPast = l.time < currentTime
                  const isNext = nextLesson?.isToday && nextLesson.time === l.time && nextLesson.studentId === l.studentId
                  return (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      isNext ? "bg-blue-50" : isPast ? "opacity-45" : "hover:bg-white/40"
                    }`}>
                      <div className="text-sm font-medium text-blue-600 w-12 flex-shrink-0">{l.time}</div>
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600 flex-shrink-0 overflow-hidden">
                        {l.avatar
                          ? <img src={l.avatar} alt={l.studentName} className="w-full h-full object-cover" />
                          : getInitials(l.studentName)
                        }
                      </div>
                      <div className="flex-1 text-sm font-medium">{l.studentName}</div>
                      <div className="text-xs text-gray-400">{l.duration} мин</div>
                      {isNext && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: mini calendar + upcoming */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Compact calendar */}
          <div className="glass p-4">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => { const d = new Date(baseDate); d.setMonth(d.getMonth()-1); setBaseDate(d) }}
                className="no-press w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-black/5">‹</button>
              <span className="text-xs font-medium text-gray-600">{MONTH_NAMES[month]} {year}</span>
              <button onClick={() => { const d = new Date(baseDate); d.setMonth(d.getMonth()+1); setBaseDate(d) }}
                className="no-press w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-black/5">›</button>
            </div>
            <div className="grid grid-cols-7 mb-0.5">
              {DAY_SHORT.map((d) => (
                <div key={d} className="text-center text-[10px] text-gray-400 py-0.5">{d}</div>
              ))}
            </div>
            <div key={`${year}-${month}`} className="grid grid-cols-7 gap-px">
              {Array(emptyDays).fill(null).map((_, i) => <div key={"e" + i} />)}
              {monthDays.map((day, i) => {
                const dateStr = formatDate(day)
                const hasLessons = getLessonsForDate(dateStr).length > 0
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selectedDay
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    className={`cal-day relative flex flex-col items-center py-1 rounded-lg ${
                      isSelected ? "bg-blue-600 text-white" : isToday ? "bg-blue-100" : ""
                    }`}
                    style={{ animationDelay: `${(emptyDays + i) * 6}ms` }}
                  >
                    <span className={`text-xs font-medium ${
                      isSelected ? "text-white" : isToday ? "text-blue-600" : isWeekend ? "text-gray-400" : "text-gray-700"
                    }`}>{day.getDate()}</span>
                    {hasLessons && (
                      <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-white" : "bg-blue-400"}`} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Selected day */}
            {selectedDay && (
              <div key={selectedDay} className="mt-3 pt-3 border-t border-white/30 slide-up">
                <div className="text-xs font-medium text-gray-600 mb-2">
                  {selectedDate?.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "short" })}
                </div>
                {selectedLessons.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-2">Нет занятий</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {selectedLessons.map((l, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1">
                        <span className="text-gray-700 font-medium">{l.studentName}</span>
                        <span className="text-blue-600">{l.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="glass p-4">
              <h2 className="text-sm font-medium mb-3">Ближайшие 7 дней</h2>
              <div className="flex flex-col gap-2.5 stagger">
                {upcoming.map((l, i) => {
                  const d = new Date(l.date + "T00:00:00")
                  return (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{l.studentName}</div>
                        <div className="text-xs text-gray-400">
                          {d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })} · {l.time}
                        </div>
                      </div>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex-shrink-0">{l.duration} мин</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
