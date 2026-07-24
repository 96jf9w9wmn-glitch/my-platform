import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import Icon from "../components/Icon"
import { parseLocalDate, isLessonConducted, getInitials, formatPhone } from "../utils"

const MESSENGER_LABELS = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  vk: "ВКонтакте",
  other: "Другое",
}

const MESSENGERS = [
  { id: "telegram", label: "Telegram", placeholder: "https://t.me/username" },
  { id: "whatsapp", label: "WhatsApp", placeholder: "https://wa.me/79001234567" },
  { id: "instagram", label: "Instagram", placeholder: "https://instagram.com/username" },
  { id: "vk", label: "ВКонтакте", placeholder: "https://vk.com/username" },
  { id: "other", label: "Другое", placeholder: "https://..." },
]

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
const DURATIONS = [30, 45, 60, 90, 120]
const DAY_INDEX = { "Пн": 1, "Вт": 2, "Ср": 3, "Чт": 4, "Пт": 5, "Сб": 6, "Вс": 0 }

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function generateParentCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

function parseScheduleToDays(schedule) {
  if (!schedule) return []
  return schedule.split(", ").map((p) => {
    const match = p.match(/^([А-Яа-я]{2})\s+(\d{2}:\d{2})/)
    return match ? { name: match[1], time: match[2] } : null
  }).filter(Boolean)
}

function EditModal({ student, onClose, onSave }) {
  const [form, setForm] = useState({
    name: student.name || "",
    phone: student.phone || "",
    contacts: student.contacts || [],
    boardUrl: student.boardUrl || "",
    callUrl: student.callUrl || "",
    isRecurring: student.isRecurring || false,
  })
  const [recurringDays, setRecurringDays] = useState(() =>
    student.isRecurring ? parseScheduleToDays(student.schedule) : []
  )
  const [recurringDuration, setRecurringDuration] = useState(student.lessonDuration || 60)
  const [recurringWeeks, setRecurringWeeks] = useState(8)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function addContact() {
    setForm((prev) => ({ ...prev, contacts: [...prev.contacts, { messenger: "telegram", url: "" }] }))
  }

  function updateContact(i, field, value) {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, idx) => idx === i ? { ...c, [field]: value } : c),
    }))
  }

  function removeContact(i) {
    setForm((prev) => ({ ...prev, contacts: prev.contacts.filter((_, idx) => idx !== i) }))
  }

  function toggleRecurringDay(day) {
    setRecurringDays((prev) => {
      const exists = prev.find((d) => d.name === day)
      if (exists) return prev.filter((d) => d.name !== day)
      return [...prev, { name: day, time: "09:00" }]
    })
  }

  function handleSave() {
    if (!form.name || !form.phone) { alert("Заполни имя и телефон!"); return }
    if (form.isRecurring && recurringDays.length === 0) { alert("Выбери хотя бы один день недели!"); return }

    const data = { ...form, lessonDuration: recurringDuration }

    if (form.isRecurring && recurringDays.length > 0) {
      data.schedule = recurringDays.map((d) => `${d.name} ${d.time}`).join(", ") + ` (${recurringDuration} мин)`
      // Генерируем занятия на выбранное количество недель вперёд
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const newLessons = []
      for (let week = 0; week < recurringWeeks; week++) {
        for (const day of recurringDays) {
          const base = new Date(today)
          base.setDate(today.getDate() + week * 7)
          const diff = (DAY_INDEX[day.name] - base.getDay() + 7) % 7
          const lessonDate = new Date(base)
          lessonDate.setDate(base.getDate() + diff)
          const dateStr = formatDate(lessonDate)
          const alreadyExists = (student.lessons || []).some((l) => l.date === dateStr && l.time === day.time)
          if (!alreadyExists) newLessons.push({ date: dateStr, time: day.time, duration: recurringDuration })
        }
      }
      const merged = [...(student.lessons || []), ...newLessons]
        .filter((l, i, arr) => arr.findIndex((x) => x.date === l.date && x.time === l.time) === i)
        .sort((a, b) => a.date.localeCompare(b.date))
      data.lessons = merged
      data.lessonDates = merged.map((l) => l.date)
    }

    onSave(data)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
      <div className="glass-modal p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-medium">Редактировать</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><Icon name="x" size={18} /></button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Имя и фамилия</label>
            <input name="name" value={form.name} onChange={handleChange} className="input-glass" />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Телефон</label>
            <input name="phone" value={form.phone} onChange={handleChange} className="input-glass" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-500">Мессенджеры</label>
              <button onClick={addContact} className="text-xs text-blue-600 hover:opacity-70 transition-opacity">+ Добавить</button>
            </div>
            {form.contacts.map((c, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <select
                  value={c.messenger}
                  onChange={(e) => updateContact(i, "messenger", e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none"
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
                <button onClick={() => removeContact(i)} className="text-gray-400 hover:text-red-500"><Icon name="x" size={16} /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-gray-700 font-medium">Тип занятий</div>
              <div className="text-xs text-gray-400 mt-0.5">{form.isRecurring ? "Регулярные занятия" : "Разовые занятия"}</div>
            </div>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, isRecurring: !p.isRecurring }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${form.isRecurring ? "bg-blue-600" : "bg-gray-200"}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${form.isRecurring ? "left-7" : "left-1"}`} />
            </button>
          </div>

          {form.isRecurring && (
            <div className="flex flex-col gap-3 pt-1">
              <div>
                <div className="text-sm text-gray-500 mb-2">Дни недели и время</div>
                <div className="flex flex-col gap-1.5">
                  {WEEK_DAYS.map((day) => {
                    const selected = recurringDays.find((d) => d.name === day)
                    return (
                      <div key={day} className={`border rounded-xl transition-colors ${selected ? "border-blue-200 bg-blue-50" : "border-gray-100"}`}>
                        <div className="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-xl active:bg-black/5 transition-colors" onClick={() => toggleRecurringDay(day)}>
                          <div className={`w-5 h-5 rounded border flex items-center justify-center text-xs transition-colors flex-shrink-0 ${selected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300"}`}>
                            {selected ? <Icon name="check" size={12} /> : null}
                          </div>
                          <span className="text-sm font-medium text-gray-700">{day}</span>
                          {selected?.time && <span className="ml-auto text-xs text-blue-600 font-medium">{selected.time}</span>}
                        </div>
                        {selected && (
                          <div className="px-3 pb-3 border-t border-blue-100 pt-2">
                            <input
                              type="time"
                              value={selected.time}
                              onChange={(e) => setRecurringDays((prev) => prev.map((d) => d.name === day ? { ...d, time: e.target.value } : d))}
                              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400 w-full"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-2">Длительность занятия</div>
                <div className="flex gap-2 flex-wrap">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setRecurringDuration(d)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${recurringDuration === d ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                      {d} мин
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">На сколько недель вперёд — {recurringWeeks} нед.</div>
                <input
                  type="range" min="1" max="52" value={recurringWeeks}
                  onChange={(e) => setRecurringWeeks(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 нед</span><span>26 нед</span><span>52 нед (1 год)</span>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Ссылка на доску</label>
            <input
              name="boardUrl"
              value={form.boardUrl}
              onChange={handleChange}
              placeholder="https://miro.com/..."
              className="input-glass"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Ссылка на звонок</label>
            <input
              name="callUrl"
              value={form.callUrl}
              onChange={handleChange}
              placeholder="https://meet.google.com/..."
              className="input-glass"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
            Отмена
          </button>
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700">
            Сохранить
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function StudentProfile({ student, onBack, onUpdate, onOpenBoard }) {
  const [showEdit, setShowEdit] = useState(false)
  const [hwAvg, setHwAvg] = useState(null)
  const [hwCount, setHwCount] = useState(0)
  const [editingNote, setEditingNote] = useState(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [remarkDraft, setRemarkDraft] = useState("")
  const [copiedCode, setCopiedCode] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])

  function copyParentCode(code) {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  function addRemark() {
    const text = remarkDraft.trim()
    if (!text) return
    const newRemark = { id: Date.now().toString(), text, date: new Date().toISOString().slice(0, 10) }
    onUpdate(student.id, { remarks: [...(student.remarks || []), newRemark] })
    setRemarkDraft("")
  }

  function deleteRemark(id) {
    onUpdate(student.id, { remarks: (student.remarks || []).filter((r) => r.id !== id) })
  }

  useEffect(() => {
    async function loadStats() {
      const { data } = await supabase
        .from("homework")
        .select("grade")
        .eq("student_id", student.id)
        .not("grade", "is", null)
      if (data?.length) {
        setHwCount(data.length)
        setHwAvg(Math.round((data.reduce((s, h) => s + h.grade, 0) / data.length) * 10) / 10)
      }
    }
    loadStats()
  }, [student.id])

  function handleSave(data) {
    onUpdate(student.id, data)
  }

  function saveNote(origIdx) {
    const updatedLessons = (student.lessons || []).map((l, i) =>
      i === origIdx ? { ...l, note: noteDraft.trim() || undefined } : l
    )
    onUpdate(student.id, { lessons: updatedLessons })
    setEditingNote(null)
  }

  const upcoming = (student.lessons || [])
    .filter((l) => {
      if (!l.date) return false
      const [y, m, d] = l.date.split("-").map(Number)
      const [h, min] = (l.time || "00:00").split(":").map(Number)
      return new Date(y, m - 1, d, h, min + (l.duration || 60)) >= new Date()
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  const past = (student.lessons || [])
    .map((l, origIdx) => ({ ...l, _origIdx: origIdx }))
    .filter((l) => isLessonConducted(l))
    .sort((a, b) => b.date.localeCompare(a.date))

  const initials = getInitials(student.name)

  return (
    <div className="p-4 md:p-6 page-active">
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
        ← Назад к ученикам
      </button>

      <div className="grid md:grid-cols-[300px_1fr] gap-4 items-start">
      {/* Левая колонка: профиль + статистика */}
      <div className="flex flex-col gap-3">

      {/* Карточка ученика */}
      <div className="glass p-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border-2 border-gray-200">
            {student.avatar ? (
              <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-blue-100 flex items-center justify-center text-xl font-medium text-blue-600">
                {initials}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-medium">{student.name}</h1>
            <div className="text-xs text-gray-500 mt-0.5">
              <span className="flex items-center gap-1"><Icon name={student.isRecurring ? "repeat" : "calendar"} size={12} />{student.isRecurring ? "Регулярные занятия" : "Разовые занятия"}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setShowEdit(true)}
                className="text-xs border border-gray-200 px-2.5 py-1 rounded-lg text-gray-600"
              >
                <span className="flex items-center gap-1"><Icon name="edit" size={12} />Редактировать</span>
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3 flex flex-col gap-2.5">
          <div className="flex items-start gap-2">
            <span className="text-gray-400 text-xs w-20 flex-shrink-0 pt-0.5">Телефон</span>
            <a href={`tel:${student.phone}`} className="text-sm text-blue-600 hover:opacity-70 transition-opacity">{formatPhone(student.phone)}</a>
          </div>

          {(student.contacts || []).map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-gray-400 text-xs w-20 flex-shrink-0 pt-0.5">{MESSENGER_LABELS[c.messenger] || c.messenger}</span>
              <a href={c.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:opacity-70 transition-opacity truncate">{c.url}</a>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1">
              <button onClick={() => onOpenBoard?.(student.id, student.name)}
                className="press-tap flex items-center gap-1.5 text-xs bg-blue-50 text-blue-600 dark:text-blue-400 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                <Icon name="clipboard" size={12} />Доска
              </button>
              {student.boardUrl && (
                <a href={student.boardUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-gray-50 text-gray-500 dark:text-gray-400 border border-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <Icon name="external-link" size={12} />Внешняя
                </a>
              )}
              {student.callUrl && (
                <a href={student.callUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-green-50 text-green-600 dark:text-green-400 border border-green-100 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors">
                  <Icon name="video" size={12} />Звонок
                </a>
              )}
            </div>

          {student.schedule && (
            <div className="flex items-start gap-2">
              <span className="text-gray-400 text-xs w-20 flex-shrink-0 pt-0.5">Расписание</span>
              <div className="flex flex-col gap-0.5">
                {student.schedule.split(", ").map((slot, i) => (
                  <span key={i} className="text-sm text-gray-700">{slot}</span>
                ))}
              </div>
            </div>
          )}

          {/* Код для родителей */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700 mt-1">
            <span className="text-xs text-gray-400">Код для родителей</span>
            <div className="flex items-center gap-2">
              {student.parent_code ? (
                <>
                  <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded tracking-wider text-gray-700 dark:text-gray-300">
                    {student.parent_code}
                  </code>
                  <button
                    onClick={() => copyParentCode(student.parent_code)}
                    className={`text-xs transition-colors ${copiedCode ? "text-green-500" : "text-blue-500 hover:text-blue-700"}`}
                  >
                    {copiedCode ? "Скопировано!" : "Копировать"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onUpdate(student.id, { parent_code: generateParentCode() })}
                  className="text-xs text-blue-500 hover:text-blue-700"
                >
                  Создать код
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-2">
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1">Занятий всего</div>
          <div className="text-2xl font-medium">{(student.lessons || []).length}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1">Проведено</div>
          <div className="text-2xl font-medium">{past.length}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1">Ср. оценка ДЗ</div>
          <div className="flex items-end gap-1.5">
            <div className="text-2xl font-medium">{hwAvg ?? "—"}</div>
            {hwAvg && <div className="text-xs text-gray-400 mb-0.5">/ 5 ({hwCount} зад.)</div>}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1">Долг</div>
          {(() => {
            const conducted = (student.lessons || []).filter((l) => isLessonConducted(l))
            const debt = conducted.length * (student.lessonPrice || 0) - (student.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
            if (conducted.length === 0) return <div className="text-xl font-medium text-gray-400">—</div>
            if (debt <= 0) return <div className="text-xl font-medium text-green-600">Оплачено</div>
            return <div className="text-xl font-medium text-amber-600">{debt.toLocaleString("ru-RU")} ₽</div>
          })()}
        </div>
      </div>

      {/* Замечания */}
      <div className="glass p-4">
        <div className="text-sm font-medium mb-3">Замечания для родителей</div>
        <div className="flex flex-col gap-2 mb-3">
          {(student.remarks || []).length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-2">Замечаний нет</div>
          ) : (
            [...(student.remarks || [])].reverse().map((r) => (
              <div key={r.id} className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 dark:text-gray-200">{r.text}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{r.date}</div>
                </div>
                <button
                  onClick={() => deleteRemark(r.id)}
                  className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0 mt-0.5"
                >✕</button>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <textarea
            value={remarkDraft}
            onChange={(e) => setRemarkDraft(e.target.value)}
            placeholder="Написать замечание..."
            rows={2}
            className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={addRemark}
            disabled={!remarkDraft.trim()}
            className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-40 self-end"
          >
            Добавить
          </button>
        </div>
      </div>

      </div> {/* конец левой колонки */}

      {/* Правая колонка: занятия + оплата */}
      <div className="flex flex-col gap-3">
        <div className="glass p-4">
          <h2 className="text-sm font-medium mb-3">Ближайшие занятия</h2>
          {upcoming.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Нет предстоящих занятий</div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((l, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {parseLocalDate(l.date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}
                    </div>
                    <div className="text-xs text-gray-400">{l.time} · {l.duration} мин</div>
                  </div>
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full flex-shrink-0">Запланировано</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass p-4">
          <h2 className="text-sm font-medium mb-3">История оплат</h2>
          {(student.payments || []).length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Оплат пока нет</div>
          ) : (
            <div className="flex flex-col gap-2">
              {(student.payments || []).map((p, i) => (
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

        <div className="glass p-4">
          <h2 className="text-sm font-medium mb-3">Прошедшие занятия</h2>
          {past.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Занятий ещё не было</div>
          ) : (
            <div className={`grid gap-2 ${(editingNote !== null || isMobile) ? "grid-cols-1" : "grid-cols-2"}`}>
              {past.map((l) => (
                <div key={l._origIdx} className="flex flex-col py-2 px-3 glass-sm gap-1">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-sm">
                        {parseLocalDate(l.date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}
                      </div>
                      <div className="text-xs text-gray-400">{l.time} · {l.duration} мин</div>
                    </div>
                    {l.note && editingNote !== l._origIdx && (
                      <button
                        className="no-press text-blue-400 hover:text-blue-600 transition-colors mt-0.5 flex-shrink-0"
                        onClick={() => { setEditingNote(l._origIdx); setNoteDraft(l.note || "") }}
                      >
                        <Icon name="clipboard" size={15} />
                      </button>
                    )}
                  </div>
                  {l.note && editingNote !== l._origIdx && (
                    <div className="text-xs text-gray-500 leading-relaxed">{l.note}</div>
                  )}
                  {!l.note && editingNote !== l._origIdx && (
                    <button
                      className="no-press text-xs text-gray-300 hover:text-blue-500 transition-colors text-left"
                      onClick={() => { setEditingNote(l._origIdx); setNoteDraft("") }}
                    >
                      + заметка
                    </button>
                  )}
                  {editingNote === l._origIdx && (
                    <div className="mt-1">
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Что прошли, комментарий после урока..."
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-none bg-white/80"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => setEditingNote(null)}
                          className="no-press text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={() => saveNote(l._origIdx)}
                          className="no-press text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>

      {showEdit && (
        <EditModal
          student={student}
          onClose={() => setShowEdit(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

export default StudentProfile
