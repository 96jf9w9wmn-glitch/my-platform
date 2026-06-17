import { useState } from "react"
import PhoneInput from "react-phone-number-input"
import "react-phone-number-input/style.css"

const DURATIONS = [30, 45, 60, 90, 120]
const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
const DAY_NAMES_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
const MESSENGERS = [
  { id: "telegram", label: "Telegram", placeholder: "https://t.me/username" },
  { id: "whatsapp", label: "WhatsApp", placeholder: "https://wa.me/79001234567" },
  { id: "instagram", label: "Instagram", placeholder: "https://instagram.com/username" },
  { id: "vk", label: "ВКонтакте", placeholder: "https://vk.com/username" },
  { id: "other", label: "Другое", placeholder: "https://..." },
]

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

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function TimePicker({ value, onChange }) {
  const [hours, setHours] = useState(value ? value.split(":")[0] : "09")
  const [minutes, setMinutes] = useState(value ? value.split(":")[1] : "00")

  function update(h, m) {
    const time = `${h}:${m}`
    onChange(time)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center">
        <button
          onClick={() => {
            const h = String((Number(hours) + 1) % 24).padStart(2, "0")
            setHours(h); update(h, minutes)
          }}
          className="text-gray-400 hover:text-gray-600 text-xs px-2 py-0.5"
        >▲</button>
        <div className="text-xl font-medium w-10 text-center">{hours}</div>
        <button
          onClick={() => {
            const h = String((Number(hours) - 1 + 24) % 24).padStart(2, "0")
            setHours(h); update(h, minutes)
          }}
          className="text-gray-400 hover:text-gray-600 text-xs px-2 py-0.5"
        >▼</button>
      </div>
      <div className="text-xl font-medium">:</div>
      <div className="flex flex-col items-center">
        <button
          onClick={() => {
            const m = String((Number(minutes) + 5) % 60).padStart(2, "0")
            setMinutes(m); update(hours, m)
          }}
          className="text-gray-400 hover:text-gray-600 text-xs px-2 py-0.5"
        >▲</button>
        <div className="text-xl font-medium w-10 text-center">{minutes}</div>
        <button
          onClick={() => {
            const m = String((Number(minutes) - 5 + 60) % 60).padStart(2, "0")
            setMinutes(m); update(hours, m)
          }}
          className="text-gray-400 hover:text-gray-600 text-xs px-2 py-0.5"
        >▼</button>
      </div>
      <div className="ml-2 text-sm text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-lg">
        {hours}:{minutes}
      </div>
    </div>
  )
}

function MiniCalendar({ lessons, onToggleDate }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const days = getDaysInMonth(viewYear, viewMonth)
  const firstDay = days[0].getDay()
  const selectedDates = lessons.map((l) => l.date)

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <button onClick={prevMonth} className="text-gray-400 hover:text-gray-600 px-2 text-lg">‹</button>
        <span className="text-sm font-medium">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="text-gray-400 hover:text-gray-600 px-2 text-lg">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="text-xs text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {Array(firstDay).fill(null).map((_, i) => <div key={"e" + i} />)}
        {days.map((day) => {
          const key = formatDate(day)
          const isSelected = selectedDates.includes(key)
          const isToday = key === formatDate(today)
          return (
            <button
              key={key}
              onClick={() => onToggleDate(key)}
              className={`text-xs py-1.5 rounded-md transition-colors ${
                isSelected ? "bg-blue-600 text-white"
                : isToday ? "border border-blue-300 text-blue-600"
                : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AddStudentModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: "" })
  const [phone, setPhone] = useState("")
  const [contacts, setContacts] = useState([])
  const [mode, setMode] = useState("single")
  const [lessons, setLessons] = useState([])
  const [globalDuration, setGlobalDuration] = useState(60)
  const [recurringDays, setRecurringDays] = useState([])
  const [recurringDuration, setRecurringDuration] = useState(60)
  const [recurringStartDate, setRecurringStartDate] = useState("")
  const [recurringWeeks, setRecurringWeeks] = useState(4)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function addContact() {
    setContacts((prev) => [...prev, { messenger: "telegram", url: "" }])
  }

  function updateContact(i, field, value) {
    setContacts((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  function removeContact(i) {
    setContacts((prev) => prev.filter((_, idx) => idx !== i))
  }

  function toggleDate(dateStr) {
    setLessons((prev) => {
      const exists = prev.find((l) => l.date === dateStr)
      if (exists) return prev.filter((l) => l.date !== dateStr)
      return [...prev, { date: dateStr, time: "09:00", duration: globalDuration }].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
    })
  }

  function setFieldForDate(dateStr, field, value) {
    setLessons((prev) =>
      prev.map((l) => l.date === dateStr ? { ...l, [field]: value } : l)
    )
  }

  function toggleRecurringDay(day) {
    setRecurringDays((prev) => {
      const exists = prev.find((d) => d.name === day)
      if (exists) return prev.filter((d) => d.name !== day)
      return [...prev, { name: day, time: "09:00" }]
    })
  }

  function setTimeForDay(dayName, time) {
    setRecurringDays((prev) =>
      prev.map((d) => d.name === dayName ? { ...d, time } : d)
    )
  }

  function generateRecurringLessons() {
    if (!recurringStartDate || recurringDays.length === 0) return []
    const dayIndexMap = { "Пн": 1, "Вт": 2, "Ср": 3, "Чт": 4, "Пт": 5, "Сб": 6, "Вс": 0 }
    const result = []
    const start = parseLocalDate(recurringStartDate)

    for (let week = 0; week < recurringWeeks; week++) {
      for (const day of recurringDays) {
        const targetDay = dayIndexMap[day.name]
        const base = new Date(start)
        base.setDate(start.getDate() + week * 7)
        const currentDay = base.getDay()
        const diff = (targetDay - currentDay + 7) % 7
        const lessonDate = new Date(base)
        lessonDate.setDate(base.getDate() + diff)
        result.push({ date: formatDate(lessonDate), time: day.time, duration: recurringDuration })
      }
    }
    return result
      .filter((l, i, arr) => arr.findIndex((x) => x.date === l.date && x.time === l.time) === i)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  const previewLessons = mode === "recurring" ? generateRecurringLessons() : lessons

  function handleSubmit() {
    if (!form.name || !phone) { alert("Заполни имя и телефон!"); return }
    if (mode === "single") {
      if (lessons.length === 0) { alert("Выбери даты занятий!"); return }
      if (lessons.some((l) => !l.time)) { alert("Укажи время для каждого занятия!"); return }
    }
    if (mode === "recurring") {
      if (!recurringStartDate || recurringDays.length === 0) {
        alert("Укажи дату начала и дни недели!"); return
      }
    }

    const finalLessons = previewLessons
    onAdd({
      ...form,
      phone,
      contacts,
      id: Date.now(),
      balance: 0,
      results: [],
      lessons: finalLessons,
      lessonDates: finalLessons.map((l) => l.date),
      lessonDuration: mode === "recurring" ? recurringDuration : globalDuration,
      isRecurring: mode === "recurring",
      schedule: mode === "recurring"
        ? recurringDays.map((d) => `${d.name} ${d.time}`).join(", ") + ` (${recurringDuration} мин)`
        : finalLessons.map((l) =>
            parseLocalDate(l.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) +
            " " + l.time + " (" + l.duration + " мин)"
          ).join(", "),
      payments: [],
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-medium">Новый ученик</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Имя и фамилия</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Например: Иван Иванов"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Телефон</label>
            <div className="phone-input-wrapper">
              <PhoneInput
                international
                defaultCountry="RU"
                value={phone}
                onChange={setPhone}
                placeholder="Введи номер телефона"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-500">Мессенджеры (необязательно)</label>
              <button
                onClick={addContact}
                className="text-xs text-blue-600 hover:underline"
              >
                + Добавить
              </button>
            </div>
            {contacts.map((c, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <select
                  value={c.messenger}
                  onChange={(e) => updateContact(i, "messenger", e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400"
                >
                  {MESSENGERS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <input
                  value={c.url}
                  onChange={(e) => updateContact(i, "url", e.target.value)}
                  placeholder={MESSENGERS.find((m) => m.id === c.messenger)?.placeholder}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
                <button
                  onClick={() => removeContact(i)}
                  className="text-gray-400 hover:text-red-500 text-lg"
                >✕</button>
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-2 block">Тип занятий</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("single")}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  mode === "single" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                📅 Разовые
              </button>
              <button
                onClick={() => setMode("recurring")}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  mode === "recurring" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                🔁 Регулярные
              </button>
            </div>
          </div>

          {mode === "single" && (
            <>
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Длительность занятия</label>
                <div className="flex gap-2 flex-wrap">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setGlobalDuration(d)
                        setLessons((prev) => prev.map((l) => ({ ...l, duration: d })))
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        globalDuration === d ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {d} мин
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">
                  Даты занятий
                  {lessons.length > 0 && <span className="ml-2 text-blue-600">({lessons.length} выбрано)</span>}
                </label>
                <div className="border border-gray-200 rounded-lg p-3">
                  <MiniCalendar lessons={lessons} onToggleDate={toggleDate} />
                </div>
              </div>

              {lessons.length > 0 && (
                <div className="flex flex-col gap-3">
                  <label className="text-sm text-gray-500">Время для каждого занятия</label>
                  {lessons.map((lesson) => (
                    <div key={lesson.date} className="border border-gray-100 rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-700 mb-3">
                        {parseLocalDate(lesson.date).toLocaleDateString("ru-RU", {
                          weekday: "short", day: "numeric", month: "long"
                        })}
                      </div>
                      <TimePicker
                        value={lesson.time}
                        onChange={(time) => setFieldForDate(lesson.date, "time", time)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {mode === "recurring" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Длительность занятия</label>
                <div className="flex gap-2 flex-wrap">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setRecurringDuration(d)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        recurringDuration === d ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {d} мин
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">Дни недели и время</label>
                <div className="flex flex-col gap-2">
                  {WEEK_DAYS.map((day) => {
                    const selected = recurringDays.find((d) => d.name === day)
                    return (
                      <div key={day} className={`border rounded-lg transition-colors ${selected ? "border-blue-200 bg-blue-50" : "border-gray-100"}`}>
                        <div
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                          onClick={() => toggleRecurringDay(day)}
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center text-xs transition-colors ${
                            selected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300"
                          }`}>
                            {selected ? "✓" : ""}
                          </div>
                          <span className="text-sm font-medium text-gray-700">{day}</span>
                          {selected?.time && (
                            <span className="ml-auto text-xs text-blue-600 font-medium">{selected.time}</span>
                          )}
                        </div>
                        {selected && (
                          <div className="px-3 pb-3 border-t border-blue-100 pt-3">
                            <TimePicker
                              value={selected.time}
                              onChange={(time) => setTimeForDay(day, time)}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-1 block">Дата начала</label>
                <input
                  type="date"
                  value={recurringStartDate}
                  onChange={(e) => setRecurringStartDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-1 block">
                  На сколько недель вперёд — {recurringWeeks} нед.
                </label>
                <input
                  type="range"
                  min="1"
                  max="52"
                  value={recurringWeeks}
                  onChange={(e) => setRecurringWeeks(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 нед</span>
                  <span>26 нед</span>
                  <span>52 нед (1 год)</span>
                </div>
              </div>

              {previewLessons.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs font-medium text-blue-700 mb-2">
                    Будет создано {previewLessons.length} занятий по {recurringDuration} мин:
                  </div>
                  <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                    {previewLessons.map((l, i) => (
                      <div key={i} className="text-xs text-blue-600">
                        {parseLocalDate(l.date).toLocaleDateString("ru-RU", {
                          weekday: "short", day: "numeric", month: "short"
                        })} в {l.time} · {l.duration} мин
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
            Отмена
          </button>
          <button onClick={handleSubmit} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700">
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddStudentModal
