// Занятия не должны налезать друг на друга: репетитор не ведёт двоих
// одновременно, а ученик не сидит на двух занятиях сразу.
//
// Проверка живёт отдельным файлом, потому что занятие ставится из четырёх
// разных мест (расписание, карточка ученика, перенос у репетитора, перенос у
// ученика), и раньше «занятость» понималась в каждом по-своему: сравнивалось
// ТОЧНОЕ совпадение даты и времени. Занятие в 14:30 на час и занятие в 15:00
// такую проверку проходили молча — именно так в расписании и появлялась пара
// состыкованных занятий.
//
// Ключевое: занятие занимает ОТРЕЗОК времени (начало + длительность), а не
// точку. Всё сравнение — пересечение отрезков.

import { LESSON_EXCUSED } from "./utils"

export const DEFAULT_LESSON_MINUTES = 60

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"]

export function timeToMinutes(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || "").trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function minutesToTime(total) {
  const wrapped = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`
}

// Отрезок занятия в минутах от полуночи. Без времени занятия отрезка нет —
// такое занятие в проверке не участвует.
export function lessonSpan(lesson, fallbackDuration = DEFAULT_LESSON_MINUTES) {
  const start = timeToMinutes(lesson?.time)
  if (start == null) return null
  const duration = Number(lesson?.duration) > 0
    ? Number(lesson.duration)
    : (Number(fallbackDuration) > 0 ? Number(fallbackDuration) : DEFAULT_LESSON_MINUTES)
  return { start, end: start + duration, duration }
}

// Налезают ли занятия друг на друга. Стык (одно кончается ровно там, где
// начинается второе) конфликтом НЕ считается: занятие за занятием — обычное
// дело, и запрещать его нельзя.
export function lessonsClash(a, b) {
  if (!a?.date || !b?.date || a.date !== b.date) return false
  const sa = lessonSpan(a)
  const sb = lessonSpan(b)
  if (!sa || !sb) return false
  return sa.start < sb.end && sb.start < sa.end
}

// Занятие, снятое со счёта («не состоялось, не в счёт»), время больше не
// занимает — на его место можно ставить другое.
function occupies(lesson) {
  return !!lesson && lesson.status !== LESSON_EXCUSED
}

function sameSlot(a, b) {
  return !!a && !!b && a.date === b.date && a.time === b.time
}

// Все занятия репетитора одним списком, с именем ученика у каждого: и новые
// (массив `lessons`), и легаси-даты (`lessonDates` + `lessonTime`, по ним
// показываются ученики, заведённые до появления массива).
export function tutorLessons(students, { exceptStudentId = null } = {}) {
  return (students || [])
    .filter((s) => exceptStudentId == null || String(s.id) !== String(exceptStudentId))
    .flatMap((s) => {
      const all = s.lessons || []
      const known = new Set(all.map((l) => l.date))
      const fallback = Number(s.lessonDuration) > 0 ? Number(s.lessonDuration) : DEFAULT_LESSON_MINUTES
      const own = all.filter(occupies).map((l) => ({
        date: l.date,
        time: l.time,
        duration: Number(l.duration) > 0 ? Number(l.duration) : fallback,
        studentId: s.id,
        studentName: s.name,
      }))
      const legacy = (s.lessonDates || [])
        .filter((d) => s.lessonTime && !known.has(d))
        .map((d) => ({
          date: d,
          time: s.lessonTime,
          duration: fallback,
          studentId: s.id,
          studentName: s.name,
        }))
      return [...own, ...legacy]
    })
}

// Первое занятие из списка, которое налезает на кандидата.
// `skip` — само переносимое (или редактируемое) занятие: с собой оно не
// конфликтует. Если в списке лежат занятия РАЗНЫХ учеников, нужен и
// `skipStudentId`: иначе чужое занятие в те же дату и время примут за своё и
// уже существующее пересечение спрячется.
export function findClash(candidate, list, { skip = null, skipStudentId = null } = {}) {
  if (!candidate?.date || !candidate?.time) return null
  const isSelf = (l) => sameSlot(l, skip)
    && (skipStudentId == null || String(l.studentId) === String(skipStudentId))
  return (list || []).find((l) => occupies(l) && !isSelf(l) && lessonsClash(candidate, l)) || null
}

// Пересечения пачки занятий (расписание ученика целиком) с чужими занятиями и
// между собой. Возвращает пары «наше занятие → на что налезло».
export function findClashes(candidates, list = []) {
  const hits = []
  const own = (candidates || []).filter((l) => l?.date && l?.time)
  own.forEach((lesson, i) => {
    const outer = (list || []).find((l) => occupies(l) && lessonsClash(lesson, l))
    if (outer) { hits.push({ lesson, other: outer }); return }
    // Пара «А налезло на Б» и «Б налезло на А» — одно и то же пересечение,
    // поэтому смотрим только вперёд по списку.
    const inner = own.findIndex((l, j) => j > i && lessonsClash(lesson, l))
    if (inner > -1) hits.push({ lesson, other: own[inner] })
  })
  return hits
}

export function formatSpan(lesson) {
  const span = lessonSpan(lesson)
  if (!span) return ""
  return `${minutesToTime(span.start)}–${minutesToTime(span.end)}`
}

export function formatDay(date) {
  const [y, m, d] = String(date || "").split("-").map(Number)
  if (!y || !m || !d) return ""
  return `${d} ${MONTHS[m - 1]}`
}

// «11 сентября, 15:00–16:00 — уже занято: Михаил, 14:30–15:30». Без имени
// (пересеклись два занятия одного и того же расписания) — «пересекается с».
export function clashLine({ lesson, other }) {
  const what = other?.studentName
    ? `уже занято: ${other.studentName}, ${formatSpan(other)}`
    : `пересекается с ${formatSpan(other)}`
  return `${formatDay(lesson.date)}, ${formatSpan(lesson)} — ${what}`
}

export function clashMessage(hits, limit = 3) {
  const list = hits.slice(0, limit).map(clashLine).join("; ")
  const rest = hits.length > limit ? ` и ещё ${hits.length - limit}` : ""
  return `${list}${rest}.`
}
