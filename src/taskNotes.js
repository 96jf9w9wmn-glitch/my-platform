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
import { parseStorageRef } from "./storageUrl"

// Файлы методички лежат в приватном бакете репетитора: политика «tutor own
// files» пускает его в собственный каталог по auth.uid, поэтому отдельных
// правил хранилища заводить не пришлось.
const FILE_BUCKET = "homework"

// Колонки files может не быть (миграция supabase/task_note_files.sql
// выполняется руками) — тогда читаем и пишем методичку без файлов, как раньше.
const FIELDS = "id, number, title, body, files, updated_at"
const FIELDS_NO_FILES = "id, number, title, body, updated_at"

// Методички по предмету, ключ — номер задания. Таблицы может не быть (миграция
// supabase/task_notes.sql выполняется руками) — тогда методичек просто нет, а
// карта заданий работает как обычный список.
export async function loadTaskNotes(tutorId, examType) {
  if (!tutorId || !examType) return {}
  const read = (fields) => supabase
    .from("task_notes")
    .select(fields)
    .eq("tutor_id", tutorId)
    .eq("exam_type", examType)
  let { data, error } = await read(FIELDS)
  // Без миграции колонки files нет, и запрос падает целиком: методички
  // пропали бы из карты вовсе, а не просто остались без вложений.
  if (error) ({ data, error } = await read(FIELDS_NO_FILES))
  if (error) return {}
  const out = {}
  for (const r of data || []) out[r.number] = { ...r, files: normalizeFiles(r.files) }
  return out
}

// В базе список бывает и пустым, и отсутствующим (запись до миграции).
export function normalizeFiles(files) {
  if (!Array.isArray(files)) return []
  return files.filter((f) => f && typeof f.url === "string" && f.url)
}

// Пустая методичка — это её отсутствие: сохранять заголовок без текста незачем,
// значок книжки на задании обещал бы материал, которого нет.
export async function saveTaskNote({ tutorId, examType, number, title, body, files }) {
  const text = (body || "").trim()
  const list = normalizeFiles(files)
  // Методичка из одних файлов — обычное дело: памятка PDF и скрин разбора без
  // единой строки текста. Пустой её делает только отсутствие и того, и другого.
  if (!text && !list.length) {
    const { error } = await supabase.from("task_notes")
      .delete().eq("tutor_id", tutorId).eq("exam_type", examType).eq("number", number)
    return error ? { error: error.message } : { note: null }
  }
  const base = {
    tutor_id: tutorId, exam_type: examType, number,
    title: (title || "").trim(), body: text, updated_at: new Date().toISOString(),
  }
  const write = (payload, fields) => supabase.from("task_notes")
    .upsert(payload, { onConflict: "tutor_id,exam_type,number" })
    .select(fields)
    .maybeSingle()

  let { data, error } = await write({ ...base, files: list }, FIELDS)
  if (!error) return { note: { ...data, files: normalizeFiles(data?.files) } }

  // Колонки нет — сохраняем хотя бы текст, но молчать об этом нельзя: файлы
  // репетитор уже загрузил и считает бы их сохранёнными.
  const retry = await write(base, FIELDS_NO_FILES)
  if (retry.error) return { error: retry.error.message }
  if (list.length) {
    return {
      note: { ...retry.data, files: [] },
      error: "Материал сохранён, а файлы — нет: не выполнена миграция supabase/task_note_files.sql",
    }
  }
  return { note: { ...retry.data, files: [] } }
}

// Файл методички уходит в каталог репетитора: имя в хранилище техническое, а
// настоящее хранится в самой записи — так путь остаётся безопасным для любых
// имён (кириллица, пробелы), а репетитор видит файл, как он его назвал.
export async function uploadTaskNoteFile({ tutorId, file }) {
  const ext = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)
  const path = `${tutorId}/task-notes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? "." + ext : ""}`
  const { error } = await supabase.storage.from(FILE_BUCKET).upload(path, file, { contentType: file.type || undefined })
  if (error) return { error: error.message }
  const { data } = supabase.storage.from(FILE_BUCKET).getPublicUrl(path)
  return {
    file: { name: file.name, url: data.publicUrl, size: file.size, type: file.type || "" },
  }
}

// Убранный файл удаляем из хранилища: иначе каталог репетитора копит вложения,
// на которые уже ничто не ссылается. Лучшее усилие — если не вышло, методичка
// всё равно уже сохранена без него.
export async function deleteTaskNoteFiles(urls) {
  const paths = (urls || [])
    .map((u) => parseStorageRef(u, FILE_BUCKET))
    .filter((r) => r && r.bucket === FILE_BUCKET)
    .map((r) => r.path)
  if (!paths.length) return
  try { await supabase.storage.from(FILE_BUCKET).remove(paths) } catch { /* остался лежать */ }
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
