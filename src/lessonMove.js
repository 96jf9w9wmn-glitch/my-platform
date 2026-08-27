// Перенос занятия.
//
// Занятия лежат JSONB-массивом внутри строки ученика и своего id не имеют:
// единственный ключ занятия — пара «дата + время». Поэтому переносим, сравнивая
// эту пару, а не индекс в массиве: индекс меняется от любой сортировки.
//
// Две стороны переносят по-разному, и это намеренно:
//   репетитор — двигает занятие сразу (расписание ведёт он), ученику уходит
//               уведомление;
//   ученик    — просит о переносе: просьба живёт в самом занятии
//               (`moveRequest`), пока репетитор не примет или не отклонит её.
// Отдельной таблицы у просьбы нет — иначе фича не работала бы до выполнения
// очередной миграции, а занятие и просьба разъезжались бы при правке расписания.

export function isSameLesson(lesson, ref) {
  return !!lesson && !!ref && lesson.date === ref.date && lesson.time === ref.time
}

function byDateTime(a, b) {
  return (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || "")
}

export function formatLessonWhen(date, time) {
  if (!date) return ""
  const when = new Date(date + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
  return time ? `${when}, ${time}` : when
}

export function formatLessonShort(date, time) {
  if (!date) return ""
  const when = new Date(date + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
  return time ? `${when} в ${time}` : when
}

export function todayDateStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

// Занятие на этих дате и времени, кроме самого переносимого. Репетитору важны
// занятия всех учеников (он не может вести двоих сразу), ученику — только свои.
export function findSlotConflict(lessons, to, from) {
  return (lessons || []).find((l) => !isSameLesson(l, from) && l.date === to.date && l.time === to.time) || null
}

// Просьба о переносе: ставится ученику в занятие, снимается передачей null.
export function setMoveRequest(lessons, target, request) {
  return (lessons || []).map((l) => {
    if (!isSameLesson(l, target)) return l
    const rest = { ...l }
    delete rest.moveRequest
    return request ? { ...rest, moveRequest: request } : rest
  })
}

// Патч для карточки ученика: занятие переезжает, просьба снимается, а откуда
// оно переехало — остаётся видно в расписании.
//
// `lessonDates` — легаси-список дат: по нему занятие показывается у тех, кого
// заводили до появления массива `lessons`. Такое занятие переносом
// материализуется в настоящее.
export function applyMoveToStudent(student, from, to) {
  const lessons = student?.lessons || []
  const exists = lessons.some((l) => isSameLesson(l, from))
  const moved = { date: to.date, time: to.time, movedFrom: { date: from.date, time: from.time } }

  const nextLessons = (exists
    ? lessons.map((l) => {
        if (!isSameLesson(l, from)) return l
        const rest = { ...l }
        delete rest.moveRequest
        return { ...rest, ...moved, duration: to.duration || l.duration || 60 }
      })
    : [...lessons, { ...moved, duration: to.duration || from.duration || student?.lessonDuration || 60 }]
  ).sort(byDateTime)

  const nextDates = [...new Set([
    ...(student?.lessonDates || []).filter((d) => d !== from.date),
    ...nextLessons.map((l) => l.date),
  ])]

  return { lessons: nextLessons, lessonDates: nextDates }
}

// Просьбы, ожидающие ответа репетитора — по всем ученикам, ближайшие сверху.
export function pendingMoveRequests(students) {
  return (students || [])
    .flatMap((s) =>
      (s.lessons || [])
        .filter((l) => l.moveRequest)
        .map((l) => ({
          student: s,
          studentId: s.id,
          studentName: s.name,
          lesson: { date: l.date, time: l.time, duration: l.duration },
          request: l.moveRequest,
        }))
    )
    .sort((a, b) => byDateTime(a.lesson, b.lesson))
}
