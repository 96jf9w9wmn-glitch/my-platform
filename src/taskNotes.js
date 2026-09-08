// Методички репетитора: его собственные шпаргалки к номерам заданий, и порядок,
// в котором номера стоят в «Карте заданий».
//
// Методичка привязана к НОМЕРУ, а не к типажу: типажей у номера бывает под
// сотню, материал к каждому никто не напишет, а номер — это тот кусок, которым
// мыслит и репетитор, и сам экзамен.
//
// Порядок карты — тоже свойство репетитора, а не платформы: один разбирает
// номера подряд, другой начинает с провальных, третий идёт по своей программе.
import { supabase } from "./supabase"

// Методички по предмету, ключ — номер задания. Таблицы может не быть (миграция
// supabase/task_notes.sql выполняется руками) — тогда методичек просто нет, а
// карта заданий работает как обычный список.
export async function loadTaskNotes(tutorId, examType) {
  if (!tutorId || !examType) return {}
  const { data, error } = await supabase
    .from("task_notes")
    .select("id, number, title, body, updated_at")
    .eq("tutor_id", tutorId)
    .eq("exam_type", examType)
  if (error) return {}
  const out = {}
  for (const r of data || []) out[r.number] = r
  return out
}

// Пустая методичка — это её отсутствие: сохранять заголовок без текста незачем,
// значок книжки на задании обещал бы материал, которого нет.
export async function saveTaskNote({ tutorId, examType, number, title, body }) {
  const text = (body || "").trim()
  if (!text) {
    const { error } = await supabase.from("task_notes")
      .delete().eq("tutor_id", tutorId).eq("exam_type", examType).eq("number", number)
    return error ? { error: error.message } : { note: null }
  }
  const { data, error } = await supabase.from("task_notes")
    .upsert({
      tutor_id: tutorId, exam_type: examType, number,
      title: (title || "").trim(), body: text, updated_at: new Date().toISOString(),
    }, { onConflict: "tutor_id,exam_type,number" })
    .select("id, number, title, body, updated_at")
    .maybeSingle()
  if (error) return { error: error.message }
  return { note: data }
}

// Порядок номеров лежит у репетитора одним объектом «предмет → список номеров».
export async function loadTaskOrder(tutorId) {
  if (!tutorId) return {}
  const { data, error } = await supabase.from("tutors").select("task_order").eq("id", tutorId).maybeSingle()
  if (error || !data) return {}
  return data.task_order || {}
}

export async function saveTaskOrder(tutorId, examType, numbers) {
  const current = await loadTaskOrder(tutorId)
  const next = { ...current, [examType]: numbers }
  const { error } = await supabase.from("tutors").update({ task_order: next }).eq("id", tutorId)
  return error ? { error: error.message } : {}
}

// Номера в порядке репетитора: сначала те, что он расставил сам, следом всё
// остальное по возрастанию. Так новый номер, которого в сохранённом порядке
// ещё нет, не пропадает из карты и не встаёт в её начало.
export function orderNumbers(all, saved) {
  const known = new Set(all)
  const first = (saved || []).filter((n) => known.has(n))
  const rest = all.filter((n) => !first.includes(n)).sort((a, b) => a - b)
  return [...first, ...rest]
}
