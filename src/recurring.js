// Регулярное расписание: «дни недели + время» → конкретные занятия.
//
// Код общий для карточки ученика и для группы. Раньше он жил внутри
// StudentFormModal, и у группы расписания не было вовсе — занятие ей ставили
// по одному из «Расписания». Вторую копию генератора заводить нельзя: правило
// «на сколько недель вперёд расставлять» и разбор дней недели обязаны быть
// одними и теми же, иначе у ученика и у его же группы занятия встанут
// по-разному.
import { parseLocalDate } from "./utils"

export const DURATIONS = [30, 45, 60, 90, 120]
export const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
export const DAY_INDEX = { "Пн": 1, "Вт": 2, "Ср": 3, "Чт": 4, "Пт": 5, "Сб": 6, "Вс": 0 }

export function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export const todayStr = () => formatDate(new Date())

export function byDateTime(a, b) {
  return a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "")
}

export function uniqueLessons(list) {
  return list.filter((l, i, arr) => arr.findIndex((x) => x.date === l.date && x.time === l.time) === i)
}

// Занятия по дням недели, начиная с даты старта. День недели ищется ВПЕРЁД от
// начала недели (`diff` неотрицателен), поэтому расписание никогда не заезжает
// в прошлое относительно выбранной даты начала.
export function generateRecurring({ startDate, days, weeks = 4, duration = 60 }) {
  if (!startDate || !days?.length) return []
  const result = []
  const start = parseLocalDate(startDate)
  for (let week = 0; week < weeks; week++) {
    for (const day of days) {
      const base = new Date(start)
      base.setDate(start.getDate() + week * 7)
      const diff = (DAY_INDEX[day.name] - base.getDay() + 7) % 7
      const lessonDate = new Date(base)
      lessonDate.setDate(base.getDate() + diff)
      result.push({ date: formatDate(lessonDate), time: day.time, duration: day.duration || duration })
    }
  }
  return uniqueLessons(result).sort(byDateTime)
}

// Расписание для правки собираем из САМИХ будущих занятий, а не из строки
// `schedule`: строка — витрина, а занятия — факт, и после переносов эти двое
// расходятся. Открыв окно, репетитор должен увидеть то, что стоит в календаре.
export function daysFromLessons(lessons) {
  const byDay = new Map()
  for (const l of lessons || []) {
    const name = WEEK_DAYS[(parseLocalDate(l.date).getDay() + 6) % 7]
    if (!byDay.has(name)) byDay.set(name, { name, time: l.time || "09:00", duration: l.duration || 60 })
  }
  return WEEK_DAYS.filter((d) => byDay.has(d)).map((d) => byDay.get(d))
}

// На сколько недель вперёд расписание расставлено сейчас: чтобы окно, открытое
// и сохранённое без правок, вернуло то же расписание, а не обрезало его.
export function weeksAhead(lessons) {
  if (!lessons?.length) return 4
  const last = parseLocalDate(lessons[lessons.length - 1].date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weeks = Math.ceil((last - today) / (7 * 24 * 3600 * 1000))
  return Math.min(52, Math.max(1, weeks))
}

// Строка-витрина расписания: «Пн 17:00 (60 мин), Чт 17:00 (60 мин)».
export function scheduleString(days, duration = 60) {
  return (days || []).map((d) => `${d.name} ${d.time} (${d.duration || duration} мин)`).join(", ")
}
