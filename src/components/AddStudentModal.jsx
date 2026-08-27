import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import Reveal from "./Reveal"
import SegmentSwitch from "./SegmentSwitch"
import WeeksPicker from "./WeeksPicker"
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input"
import "react-phone-number-input/style.css"
import { plural, parseLocalDate, formatPhone } from "../utils"
import { ConsentRow, ConsentLink } from "./ConsentChecks"
import { logConsent } from "../consents"
import { supabase } from "../supabase"

const DURATIONS = [30, 45, 60, 90, 120]

function generateParentCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}
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


// Время и длительность — нативные поля вместо самодельной крутилки ▲▼: та
// занимала три строки на КАЖДОЕ занятие (часы, минуты, пять кнопок длительности),
// и расписание из пяти дат превращалось в экран прокрутки. Минуты крутились
// шагом в пять, поэтому «17:20» набиралось четырьмя нажатиями.
function TimeField({ value, onChange }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-glass !w-auto flex-shrink-0 px-2.5 py-1.5 text-sm tabular-nums" />
  )
}

function DurationField({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="input-glass !w-auto flex-shrink-0 px-2.5 py-1.5 text-sm">
      {DURATIONS.map((d) => <option key={d} value={d}>{d} мин</option>)}
    </select>
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
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) } else setViewMonth((m) => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) } else setViewMonth((m) => m + 1)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <button onClick={prevMonth} className="text-gray-400 hover:text-gray-600 px-2 text-lg">‹</button>
        <span className="text-sm font-medium">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="text-gray-400 hover:text-gray-600 px-2 text-lg">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {DAY_NAMES_SHORT.map((d) => <div key={d} className="text-xs text-gray-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {Array(firstDay).fill(null).map((_, i) => <div key={"e" + i} />)}
        {days.map((day) => {
          const key = formatDate(day)
          const isSelected = selectedDates.includes(key)
          const isToday = key === formatDate(today)
          return (
            <button key={key} onClick={() => onToggleDate(key)}
              className={`text-xs py-1.5 rounded-md transition-colors ${isSelected ? "bg-blue-600 text-white" : isToday ? "border border-blue-300 text-blue-600" : "text-gray-600 hover:bg-gray-100"}`}>
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AddStudentModal({ onClose, onAdd, initialName, initialPhone }) {
  const [form, setForm] = useState({ name: initialName || "", goal: "" })
  const [phone, setPhone] = useState(initialPhone || "")
  const [submitting, setSubmitting] = useState(false)
  const [contacts, setContacts] = useState([])
  // Регулярные занятия — обычный случай: ученика ведут неделями, разовые
  // встречи скорее исключение. Поэтому режим открыт сразу на них.
  const [mode, setMode] = useState("recurring")
  const [lessons, setLessons] = useState([])
  // Общее время и длительность: их получает каждая новая выбранная дата, и ими
  // же правится сразу всё расписание. Отдельный день можно поправить в списке.
  const [bulkTime, setBulkTime] = useState("09:00")
  const [bulkDuration, setBulkDuration] = useState(60)
  const [recurringDays, setRecurringDays] = useState([])
  const [recurringDuration] = useState(60)
  const [recurringStartDate, setRecurringStartDate] = useState("")
  const [recurringWeeks, setRecurringWeeks] = useState(4)
  const [onboardingPulled, setOnboardingPulled] = useState(false)
  const [hasStudentConsent, setHasStudentConsent] = useState(false)
  const [formError, setFormError] = useState("")
  const { cls: closingCls, close } = useClosing(onClose)

  // Если ученик уже прошёл анкету в своём кабинете — при добавлении его репетитором
  // подтягиваем результаты анкеты (цель, целевой балл) по совпадению телефона.
  // Целевой балл берём только у ЕГЭ: там анкета спрашивает балл 0–100, как и поле
  // репетитора. У ОГЭ анкета спрашивает оценку 2–5 — это не «баллы», не переносим.
  useEffect(() => {
    if (!phone || !isValidPhoneNumber(phone)) return
    let cancelled = false
    supabase
      .from("student_accounts")
      .select("exam_goal, target_score, onboarded")
      .eq("phone", phone)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data || !data.onboarded) { setOnboardingPulled(false); return }
        const targetFromExam = data.exam_goal === "ЕГЭ" && data.target_score != null ? data.target_score : null
        setForm((prev) => ({
          ...prev,
          goal: prev.goal || data.exam_goal || "",
          targetScore: prev.targetScore || (targetFromExam ?? ""),
        }))
        setOnboardingPulled(!!(data.exam_goal || targetFromExam != null))
      })
    return () => { cancelled = true }
  }, [phone])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: name === "lessonPrice" ? Number(value) : value }))
  }

  function addContact() { setContacts((prev) => [...prev, { messenger: "telegram", url: "" }]) }
  function updateContact(i, field, value) { setContacts((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c)) }
  function removeContact(i) { setContacts((prev) => prev.filter((_, idx) => idx !== i)) }

  function toggleDate(dateStr) {
    setLessons((prev) => {
      const exists = prev.find((l) => l.date === dateStr)
      if (exists) return prev.filter((l) => l.date !== dateStr)
      return [...prev, { date: dateStr, time: bulkTime, duration: bulkDuration }].sort((a, b) => a.date.localeCompare(b.date))
    })
  }

  function applyTimeToAll(time) {
    setBulkTime(time)
    setLessons((prev) => prev.map((l) => ({ ...l, time })))
  }

  function applyDurationToAll(duration) {
    setBulkDuration(duration)
    setLessons((prev) => prev.map((l) => ({ ...l, duration })))
  }

  function setFieldForDate(dateStr, field, value) {
    setLessons((prev) => prev.map((l) => l.date === dateStr ? { ...l, [field]: value } : l))
  }

  function toggleRecurringDay(day) {
    setRecurringDays((prev) => {
      const exists = prev.find((d) => d.name === day)
      if (exists) return prev.filter((d) => d.name !== day)
      return [...prev, { name: day, time: "09:00" }]
    })
  }

  function setTimeForDay(dayName, time) {
    setRecurringDays((prev) => prev.map((d) => d.name === dayName ? { ...d, time } : d))
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
        const diff = (targetDay - base.getDay() + 7) % 7
        const lessonDate = new Date(base)
        lessonDate.setDate(base.getDate() + diff)
        result.push({ date: formatDate(lessonDate), time: day.time, duration: day.duration || recurringDuration })
      }
    }
    return result.filter((l, i, arr) => arr.findIndex((x) => x.date === l.date && x.time === l.time) === i).sort((a, b) => a.date.localeCompare(b.date))
  }

  const previewLessons = mode === "recurring" ? generateRecurringLessons() : lessons

  function handleSubmit() {
    if (submitting) return
    if (!form.name || !phone) { setFormError("Заполните имя и телефон."); return }
    if (!hasStudentConsent) { setFormError("Отметьте, что согласие ученика или его родителя на внесение данных получено."); return }
    if (mode === "single" && lessons.length === 0) { setFormError("Выберите даты занятий."); return }
    if (mode === "recurring" && (!recurringStartDate || recurringDays.length === 0)) { setFormError("Укажите дату начала и дни недели."); return }
    setFormError("")

    setSubmitting(true)

    logConsent({ role: "tutor_for_student", contact: phone, guardian: true })

    const finalLessons = previewLessons
    onAdd({
      ...form,
      phone, contacts,
      // Временный id — только чтобы карточка дожила до вставки: настоящий выдаёт
      // база (student_link_cleanup.sql). Раньше клиент клал сюда UUID, а колонка —
      // bigint, и вставка молча падала: карточки не создавались полтора месяца.
      id: `tmp:${crypto.randomUUID()}`,
      balance: 0, results: [],
      lessons: finalLessons,
      lessonDates: finalLessons.map((l) => l.date),
      lessonDuration: mode === "recurring" ? recurringDuration : bulkDuration,
      isRecurring: mode === "recurring",
      schedule: mode === "recurring"
        ? recurringDays.map((d) => `${d.name} ${d.time} (${d.duration || recurringDuration} мин)`).join(", ")
        : finalLessons.map((l) => parseLocalDate(l.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) + " " + l.time + " (" + l.duration + " мин)").join(", "),
      payments: [],
      targetScore: form.targetScore || null,
      parent_code: generateParentCode(),
    })
    // close(), а не onClose(): иначе после сохранения окно исчезало рывком,
    // хотя по крестику уходило плавно.
    close()
  }

  return createPortal(
    // Раскладка та же, что у «Нового варианта»: широкое окно в две колонки и
    // прокрутка всей подложки. В узком окне с внутренним скроллом карточка
    // выглядела тесной — поля жались друг к другу, а расписание уезжало вниз.
    <div className={`fixed inset-0 glass-overlay z-50 overflow-y-auto ${closingCls}`}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div className={`glass-modal p-6 sm:p-7 w-full max-w-4xl ${closingCls}`}>
          <div className="flex justify-between items-start gap-4 mb-6">
            <div>
              {/* Модалка открывается только при приёме заявки: ученик уже привязался
                  сам, репетитор лишь дозаполняет карточку. */}
              <h2 className="text-lg font-medium">Данные ученика</h2>
              <p className="text-xs text-gray-400 mt-0.5">Заявка от ученика — заполните карточку и примите</p>
            </div>
            <button onClick={close} aria-label="Закрыть" className="text-gray-400 hover:text-gray-600 p-1"><Icon name="x" size={18} /></button>
          </div>

          {/* Слева — кто ученик и почём занятия, справа — когда заниматься. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-7 gap-y-5 items-stretch">
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-sm text-gray-500 mb-1.5 block">Имя и фамилия</label>
                <input name="name" value={form.name} onChange={handleChange} placeholder="Например: Иван Иванов"
                  className="input-glass" />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-1.5 block">Телефон</label>
                {initialPhone ? (
                  // Номер пришёл из аккаунта ученика. Именно по нему база сшивает карточку
                  // с аккаунтом (current_student_rows в RLS), поэтому править его нельзя:
                  // изменив номер, репетитор молча отрежет ученику доступ к своей карточке.
                  <>
                    <div className="input-glass flex items-center justify-between gap-2 text-gray-500">
                      <span>{formatPhone(initialPhone)}</span>
                      <Icon name="check" size={14} className="text-green-600 flex-shrink-0" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">Номер подтверждён при регистрации ученика — по нему карточка связана с его кабинетом.</p>
                  </>
                ) : (
                  <div className="phone-input-wrapper">
                    <PhoneInput international defaultCountry="RU" value={phone} onChange={setPhone} placeholder="Номер телефона" />
                  </div>
                )}
              </div>

              {/* Цель и целевой балл ученик выбирает сам в своей анкете — репетитор их
                  здесь не заполняет, только видит. Дублировать выбор значило спорить
                  с анкетой: два источника расходились уже на второй правке. */}
              {onboardingPulled && (
                <div className="flex items-start gap-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 px-3.5 py-3">
                  <Icon name="check" size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-600">
                    Из анкеты ученика: <span className="font-medium">{form.goal}</span>
                    {form.targetScore ? <>, цель — {form.targetScore} {plural(form.targetScore, "балл", "балла", "баллов")}</> : null}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm text-gray-500 mb-1.5 block">Стоимость занятия</label>
                <div className="relative">
                  <input name="lessonPrice" type="text"
                    value={form.lessonPrice ? Number(form.lessonPrice).toLocaleString("ru-RU").replace(/\s/g, "\u2009") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\s/g, "")
                      if (/^\d*$/.test(raw)) setForm((prev) => ({ ...prev, lessonPrice: raw ? Number(raw) : "" }))
                    }}
                    placeholder="Например: 2 000"
                    className="input-glass pr-8" />
                  <span className="absolute right-3 top-2.5 text-sm text-gray-400">₽</span>
                </div>
              </div>

              {/* Растягиваем последний блок: иначе под короткой левой колонкой
                  зияет пустота — расписание справа заметно длиннее. */}
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-gray-500">Мессенджеры (необязательно)</label>
                  <button onClick={addContact} className="text-xs text-blue-600 hover:opacity-70 transition-opacity">+ Добавить</button>
                </div>
                {contacts.length === 0 ? (
                  <button onClick={addContact}
                    className="w-full flex-1 min-h-20 max-h-32 border-2 border-dashed border-gray-200 dark:border-white/15 rounded-xl py-4 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-600 transition-colors">
                    Telegram, WhatsApp или другой способ связи
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    {contacts.map((c, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <select value={c.messenger} onChange={(e) => updateContact(i, "messenger", e.target.value)}
                          className="input-glass !w-auto flex-shrink-0 px-2.5 py-1.5 text-sm">
                          {MESSENGERS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                        <input value={c.url} onChange={(e) => updateContact(i, "url", e.target.value)}
                          placeholder={MESSENGERS.find((m) => m.id === c.messenger)?.placeholder}
                          className="input-glass flex-1 !w-auto min-w-0 px-2.5 py-1.5 text-sm" />
                        <button onClick={() => removeContact(i)} aria-label="Убрать способ связи"
                          className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 active:scale-90 transition-all">
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Тип занятий</label>
                {/* size="sm": с крупными сегментами подпись «Регулярные» вместе с
                    иконкой не помещалась в узкую колонку — иконка обрезалась. */}
                <SegmentSwitch
                  block
                  size="sm"
                  ariaLabel="Тип занятий"
                  value={mode}
                  onChange={setMode}
                  items={[
                    { key: "recurring", label: <><Icon name="repeat" size={14} />Регулярные</> },
                    { key: "single", label: <><Icon name="calendar" size={14} />Разовые</> },
                  ]}
                />
              </div>

              {mode === "single" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-500">Даты занятий</label>
                      {lessons.length > 0 && (
                        <span className="text-xs font-medium text-blue-600">
                          {lessons.length} {plural(lessons.length, "дата", "даты", "дат")}
                        </span>
                      )}
                    </div>
                    <div className="border border-gray-100 dark:border-white/10 rounded-xl p-3.5">
                      <MiniCalendar lessons={lessons} onToggleDate={toggleDate} />
                    </div>
                  </div>
                  {/* Одна строка на занятие: дата, время, длительность. Раньше на
                      каждую дату разворачивалась отдельная карточка на пол-экрана. */}
                  <Reveal value={lessons.length || null}>
                    {() => (
                      <div>
                        <label className="text-sm text-gray-500 mb-2 block">Время и длительность</label>
                        <div className="border border-gray-100 dark:border-white/10 rounded-xl overflow-hidden">
                          <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 bg-gray-50 dark:bg-white/5">
                            <span className="basis-full sm:basis-auto sm:flex-1 min-w-0 text-sm text-gray-500">Для всех дат</span>
                            <TimeField value={bulkTime} onChange={applyTimeToAll} />
                            <DurationField value={bulkDuration} onChange={applyDurationToAll} />
                            <span className="w-6 flex-shrink-0" />
                          </div>
                          {lessons.map((lesson) => (
                            <div key={lesson.date} className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 border-t border-gray-100 dark:border-white/10">
                              <span className="basis-full sm:basis-auto sm:flex-1 min-w-0 truncate text-sm text-gray-700">
                                {parseLocalDate(lesson.date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}
                              </span>
                              <TimeField value={lesson.time} onChange={(time) => setFieldForDate(lesson.date, "time", time)} />
                              <DurationField value={lesson.duration} onChange={(d) => setFieldForDate(lesson.date, "duration", d)} />
                              <button type="button" onClick={() => toggleDate(lesson.date)} aria-label="Убрать дату"
                                className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 active:scale-90 transition-all">
                                <Icon name="x" size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Верхняя строка задаёт время сразу всем занятиям; отдельный день можно поправить в списке.</p>
                      </div>
                    )}
                  </Reveal>
                </>
              )}

              {mode === "recurring" && (
                <>
                  <div>
                    <label className="text-sm text-gray-500 mb-2 block">Дни недели и время</label>
                    <div className="flex flex-col gap-2">
                      {WEEK_DAYS.map((day) => {
                        const selected = recurringDays.find((d) => d.name === day)
                        return (
                          <div key={day} className={`border rounded-xl transition-colors ${selected ? "border-blue-200 bg-blue-50" : "border-gray-100 dark:border-white/10"}`}>
                            <div className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer rounded-xl active:bg-black/5 transition-colors" onClick={() => toggleRecurringDay(day)}>
                              <div className={`w-5 h-5 rounded border flex items-center justify-center text-xs transition-colors ${selected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300"}`}>
                                {selected ? <Icon name="check" size={12} /> : null}
                              </div>
                              <span className="text-sm font-medium text-gray-700">{day}</span>
                              {selected?.time && <span className="ml-auto text-xs text-blue-600 font-medium">{selected.time}</span>}
                            </div>
                            {selected && (
                              <div className="px-3.5 pb-3 border-t border-blue-100 pt-3 flex items-center gap-2">
                                <TimeField value={selected.time} onChange={(time) => setTimeForDay(day, time)} />
                                <DurationField
                                  value={selected.duration || recurringDuration}
                                  onChange={(d) => setRecurringDays((prev) => prev.map((rd) => rd.name === day ? { ...rd, duration: d } : rd))} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1.5 block">Дата начала</label>
                    <input type="date" value={recurringStartDate} onChange={(e) => setRecurringStartDate(e.target.value)}
                      className="input-glass" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-2 block">На сколько вперёд расставить</label>
                    <WeeksPicker value={recurringWeeks} onChange={setRecurringWeeks} />
                  </div>
                  <Reveal value={previewLessons.length || null}>
                    {() => (
                      <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-3.5">
                        <div className="text-xs font-medium text-blue-700 mb-2">Будет создано {previewLessons.length} {plural(previewLessons.length, "занятие", "занятия", "занятий")}:</div>
                        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                          {previewLessons.map((l, i) => (
                            <div key={i} className="text-xs text-blue-600">
                              {parseLocalDate(l.date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })} в {l.time} · {l.duration} мин
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Reveal>
                </>
              )}
            </div>
          </div>

          {/* Данные ученика вносит репетитор, а согласие даёт сам ученик или его
              родитель — поэтому здесь подтверждение, что оно уже получено. */}
          <div className="mt-6 pt-5 border-t border-gray-100/70 dark:border-white/10">
            <ConsentRow checked={hasStudentConsent} onChange={setHasStudentConsent}>
              У меня есть согласие ученика или его законного представителя на внесение
              этих данных в сервис и на обработку по{" "}
              <ConsentLink href="/privacy">Политике конфиденциальности</ConsentLink>
            </ConsentRow>
          </div>

          {formError && <div className="text-sm text-red-500 mt-4 text-center">{formError}</div>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-5">
            <button onClick={close} className="press-fill border border-gray-200 rounded-xl px-5 py-2.5 text-sm text-gray-600">Отмена</button>
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary px-6 py-2.5 disabled:opacity-50">
              {submitting ? "Принимаем..." : "Принять ученика"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default AddStudentModal
