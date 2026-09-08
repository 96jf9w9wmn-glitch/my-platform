// Группа учеников: постоянный состав, который занимается вместе.
//
// ГЛАВНОЕ ПРИ ПРАВКАХ: группа хранит СОСТАВ И УСЛОВИЯ, но не сами занятия.
// Групповое занятие — это обычное занятие в карточке каждого участника
// (`students.lessons`), помеченное общим `groupId`. Второй сущности «занятие»
// у группы нет и заводить её нельзя: на `students.lessons` держатся долг,
// квитанции, абонемент, кабинет ученика, кабинет родителя и телеграм-бот, и
// параллельный список занятий разошёлся бы с ними при первой же правке
// расписания. Ровно так уже пришлось решать с абонементом и с переносом.
//
// Отсюда следствие, о котором легко забыть: удаление группы НЕ удаляет её
// занятия — они уже стоят в расписании у людей. Метка `groupId` у них
// остаётся, и занятие продолжает показываться групповым по снимку названия в
// самом занятии (`groupName`).
import { supabase } from "./supabase"

export const GROUP_PREFIX = "g:"

export const groupChatId = (group) => GROUP_PREFIX + (group?.id ?? group)
export const isGroupChatId = (id) => String(id || "").startsWith(GROUP_PREFIX)
export const groupIdOfChat = (id) => (isGroupChatId(id) ? String(id).slice(GROUP_PREFIX.length) : null)

// Строка базы → вид, в котором группу читает кабинет. Состав держим строками:
// `students.id` — bigint, и сравнение с ним по всему кабинету идёт через
// String(), иначе «3» из select и 3 из базы перестают быть одним учеником.
const fromRow = (r) => ({
  id: r.id,
  tutorId: r.tutor_id,
  name: r.name || "",
  memberIds: (r.member_ids || []).map(String),
  lessonPrice: r.lesson_price != null ? Number(r.lesson_price) : null,
  lessonDuration: r.lesson_duration != null ? Number(r.lesson_duration) : null,
  createdAt: r.created_at,
})

// Группы репетитора. Таблицы может не быть (миграция student_groups.sql
// выполняется руками) — тогда групп просто нет, и кабинет ведёт себя как до
// этой правки, а не падает.
export async function loadGroups(tutorId) {
  if (!tutorId) return []
  const { data, error } = await supabase
    .from("student_groups")
    .select("*")
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: true })
  if (error) {
    if (!/student_groups/.test(error.message || "")) console.error("Группы не загрузились:", error.message)
    return []
  }
  return (data || []).map(fromRow)
}

const toRow = (g, tutorId) => ({
  tutor_id: tutorId,
  name: (g.name || "").trim(),
  member_ids: (g.memberIds || []).map(Number).filter(Number.isFinite),
  lesson_price: g.lessonPrice > 0 ? Number(g.lessonPrice) : null,
  lesson_duration: g.lessonDuration > 0 ? Number(g.lessonDuration) : null,
})

// Создание и правка одной функцией: у формы они отличаются только наличием id.
export async function saveGroup(group, tutorId) {
  const row = toRow(group, tutorId)
  const res = group.id
    ? await supabase.from("student_groups").update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", group.id).select("*").maybeSingle()
    : await supabase.from("student_groups").insert(row).select("*").maybeSingle()
  if (res.error) return { error: res.error.message }
  return { group: fromRow(res.data) }
}

export async function deleteGroup(id) {
  const { error } = await supabase.from("student_groups").delete().eq("id", id)
  return error ? { error: error.message } : {}
}

// Участники группы карточками, в порядке списка учеников. Ученик мог быть
// удалён — таких в составе просто нет, а не «неизвестный ученик».
export function groupMembers(group, students) {
  const ids = new Set(group?.memberIds || [])
  return (students || []).filter((s) => ids.has(String(s.id)))
}

// Во сколько занятие обходится ОДНОМУ участнику. Цена группы важнее цены
// карточки: в группе занимаются дешевле, и это ровно то, ради чего у группы
// своя цена. Нет её — платит как обычно.
export function groupLessonPrice(group, student) {
  if (group?.lessonPrice > 0) return Number(group.lessonPrice)
  const own = Number(student?.lessonPrice ?? student?.lesson_price ?? 0)
  return own > 0 ? own : 0
}

// Занятие, которое кладётся в карточку участника. Название группы едет
// СНИМКОМ: группу могут переименовать или распустить, а занятие в прошлом
// обязано остаться подписанным так, как оно шло на самом деле.
export function groupLesson(group, student, { date, time, duration }) {
  const price = groupLessonPrice(group, student)
  return {
    date,
    time,
    duration: Number(duration) || group?.lessonDuration || student?.lessonDuration || 60,
    groupId: group.id,
    groupName: group.name,
    ...(price > 0 ? { price } : {}),
    extra: true,
  }
}

// Занятия одной группы — это ОДНО занятие, показанное у разных людей.
export const sameGroupLesson = (a, b) =>
  !!a?.groupId && a.groupId === b?.groupId && a.date === b.date && a.time === b.time

// Групповое занятие лежит у каждого участника отдельной строкой, а показывать
// его надо ОДНОЙ карточкой: в расписании репетитора это один час его жизни, а
// не три занятия подряд. Схлопываем по паре «группа + время».
//
// У схлопнутой записи появляется `members` — по участнику на каждую исходную
// строку. Он нужен не для красоты: пометка «не пришёл» ставится КОНКРЕТНОМУ
// ученику (не пришёл один, а занятие состоялось), поэтому за схлопнутой
// карточкой обязан оставаться доступ к каждому.
export function collapseGroupLessons(list) {
  const out = []
  const byKey = new Map()
  for (const l of list || []) {
    if (!l.groupId) { out.push(l); continue }
    const key = `${l.groupId}|${l.date}|${l.time}`
    const seen = byKey.get(key)
    const member = { id: l.studentId, name: l.studentName, status: l.status || null }
    if (seen) { seen.members.push(member); continue }
    const entry = { ...l, studentName: l.groupName || "Группа", members: [member] }
    byKey.set(key, entry)
    out.push(entry)
  }
  return out
}

// Занятие группы у ОДНОГО участника: по нему ставится пометка и считается
// «прошло ли». Схлопнутая карточка держит общие поля, а статус у каждого свой.
export const memberLesson = (entry, member) => ({
  date: entry.date, time: entry.time, duration: entry.duration, status: member?.status || null,
})
