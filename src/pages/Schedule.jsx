import { useState } from "react"

const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"]
const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

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

function formatDate(date) {
  return date.toISOString().split("T")[0]
}

function Schedule({ students, setStudents }) {
  const [baseDate, setBaseDate] = useState(new Date())
  const [showForm, setShowForm] = useState(false)
  const [newLesson, setNewLesson] = useState({ studentId: "", date: "", time: "" })

  const weekDates = getWeekDates(baseDate)

  function prevWeek() {
    const d = new Date(baseDate)
    d.setDate(d.getDate() - 7)
    setBaseDate(d)
  }

  function nextWeek() {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + 7)
    setBaseDate(d)
  }

  function getLessonsForSlot(dateStr, time) {
    return students.filter((s) =>
      (s.lessonDates || []).includes(dateStr) && s.lessonTime === time
    )
  }

  function handleAddLesson() {
    if (!newLesson.studentId || !newLesson.date || !newLesson.time) {
      alert("Заполни все поля!")
      return
    }
    setStudents((prev) =>
      prev.map((s) =>
        s.id === Number(newLesson.studentId)
          ? {
              ...s,
              lessonDates: [...(s.lessonDates || []), newLesson.date].sort(),
              lessonTime: newLesson.time,
            }
          : s
      )
    )
    setShowForm(false)
    setNewLesson({ studentId: "", date: "", time: "" })
  }

  function removeLesson(studentId, dateStr) {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, lessonDates: (s.lessonDates || []).filter((d) => d !== dateStr) }
          : s
      )
    )
  }

  const weekLabel = `${weekDates[0].toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} — ${weekDates[6].toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}`

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-medium">Расписание</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + Добавить занятие
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <button onClick={prevWeek} className="text-gray-400 hover:text-gray-600 text-xl px-2">‹</button>
        <span className="text-sm font-medium text-gray-700">{weekLabel}</span>
        <button onClick={nextWeek} className="text-gray-400 hover:text-gray-600 text-xl px-2">›</button>
        <button
          onClick={() => setBaseDate(new Date())}
          className="text-xs text-blue-600 border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50"
        >
          Сегодня
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
        <div className="grid min-w-[700px]" style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}>
          <div className="border-b border-gray-100 p-2" />
          {weekDates.map((date, i) => {
            const isToday = formatDate(date) === formatDate(new Date())
            return (
              <div
                key={i}
                className={`border-b border-l border-gray-100 p-2 text-center ${isToday ? "bg-blue-50" : ""}`}
              >
                <div className="text-xs text-gray-400">{DAY_NAMES[i]}</div>
                <div className={`text-sm font-medium ${isToday ? "text-blue-600" : "text-gray-700"}`}>
                  {date.getDate()}
                </div>
              </div>
            )
          })}

          {HOURS.map((hour) => (
            <>
              <div key={"h" + hour} className="border-b border-gray-100 p-2 text-xs text-gray-400 text-right pr-3 pt-3">
                {hour}
              </div>
              {weekDates.map((date, di) => {
                const dateStr = formatDate(date)
                const lessons = getLessonsForSlot(dateStr, hour)
                const isToday = dateStr === formatDate(new Date())
                return (
                  <div
                    key={dateStr + hour}
                    className={`border-b border-l border-gray-100 p-1 min-h-[52px] ${isToday ? "bg-blue-50/50" : ""}`}
                  >
                    {lessons.map((s) => (
                      <div
                        key={s.id}
                        className="bg-blue-100 text-blue-800 text-xs rounded-md px-2 py-1 mb-1 flex justify-between items-center group"
                      >
                        <span className="truncate">{s.name.split(" ")[0]}</span>
                        <button
                          onClick={() => removeLesson(s.id, dateStr)}
                          className="text-blue-400 hover:text-red-500 opacity-0 group-hover:opacity-100 ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-medium">Новое занятие</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Ученик</label>
                <select
                  value={newLesson.studentId}
                  onChange={(e) => setNewLesson((p) => ({ ...p, studentId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  <option value="">Выбери ученика...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Дата</label>
                <input
                  type="date"
                  value={newLesson.date}
                  onChange={(e) => setNewLesson((p) => ({ ...p, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Время</label>
                <div className="flex gap-2 flex-wrap">
                  {HOURS.map((time) => (
                    <button
                      key={time}
                      onClick={() => setNewLesson((p) => ({ ...p, time }))}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        newLesson.time === time
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleAddLesson}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Schedule
