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

// Прочитанное держим на время жизни вкладки: и методички, и порядок номеров —
// свойство РЕПЕТИТОРА, а не ученика, а карту заданий показывает каждая
// раскрытая карточка в «Результатах». Без этого каждое раскрытие просило одни и
// те же строки заново (замер по журналу Caddy: 7 запросов task_notes и 7 к
// tutors в одну секунду на семь учеников). Запись кэш сбрасывает; сохранение
// порядка читает МИМО кэша — иначе read-modify-write записал бы поверх чужой
// правки устаревшим объектом.
const notesCache = new Map()
const orderCache = new Map()
const dropNotesCache = (tutorId, examType) => notesCache.delete(`${tutorId}|${examType}`)

// Методички по предмету, ключ — номер задания. Таблицы может не быть (миграция
// supabase/task_notes.sql выполняется руками) — тогда методичек просто нет, а
// карта заданий работает как обычный список.
export function loadTaskNotes(tutorId, examType) {
  if (!tutorId || !examType) return Promise.resolve({})
  const key = `${tutorId}|${examType}`
  let p = notesCache.get(key)
  if (!p) {
    // Отказ чтения в кэше не оставляем: он был бы навсегда, а причина у него
    // бывает временная (сеть, протухший токен).
    p = fetchTaskNotes(tutorId, examType).catch((e) => { notesCache.delete(key); throw e })
    notesCache.set(key, p)
  }
  return p
}

async function fetchTaskNotes(tutorId, examType) {
  const read = (fields) => supabase
    .from("task_notes")
    .select(fields)
    .eq("tutor_id", tutorId)
    .eq("exam_type", examType)
  let { data, error } = await read(FIELDS)
  // Без миграции колонки files нет, и запрос падает целиком: методички
  // пропали бы из карты вовсе, а не просто остались без вложений.
  if (error) ({ data, error } = await read(FIELDS_NO_FILES))
  // Таблицы нет — методичек нет, и это устойчивый ответ: его кэшировать можно.
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
  // Кэш чтения устарел с этого мгновения — как бы запись ни закончилась.
  dropNotesCache(tutorId, examType)
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
export function loadTaskOrder(tutorId) {
  if (!tutorId) return Promise.resolve({})
  let p = orderCache.get(tutorId)
  if (!p) {
    p = fetchTaskOrder(tutorId).catch((e) => { orderCache.delete(tutorId); throw e })
    orderCache.set(tutorId, p)
  }
  return p
}

async function fetchTaskOrder(tutorId) {
  const { data, error } = await supabase.from("tutors").select("task_order").eq("id", tutorId).maybeSingle()
  // Отказ запоминать нельзя: сохранение порядка на нём прерывается, и
  // застрявший в кэше отказ запер бы карту до перезагрузки страницы.
  if (error) { orderCache.delete(tutorId); return { error: error.message } }
  if (!data) return {}
  return data.task_order || {}
}

// Порядок всех предметов лежит одним объектом, поэтому запись обязана начинаться
// с чтения: не прочитав, мы затрём порядок остальных предметов. Отказ чтения
// (так уже было — у колонки пропал грант, см. supabase/task_notes.sql) поэтому
// прерывает сохранение, а не молча пишет объект из одного предмета.
export async function saveTaskOrder(tutorId, examType, numbers) {
  // Читаем МИМО кэша: записать надо поверх того, что в базе сейчас, а не
  // поверх снимка, сделанного при открытии первой карточки.
  const current = await fetchTaskOrder(tutorId)
  if (current.error) return { error: current.error }
  const next = { ...current, [examType]: numbers }
  const { error } = await supabase.from("tutors").update({ task_order: next }).eq("id", tutorId)
  if (error) return { error: error.message }
  orderCache.set(tutorId, Promise.resolve(next))
  return {}
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
