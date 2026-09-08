import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import { numberTitle } from "../pages/numberTitles"
import { uploadTaskNoteFile, deleteTaskNoteFiles } from "../taskNotes"
import { signStorageUrls } from "../storageUrl"

// Хранилище отказывает большому файлу уже после загрузки, поэтому предел
// называем заранее: репетитор кладёт сюда памятки и скрины, а не видео.
const MAX_MB = 25

function sizeLabel(bytes) {
  if (!bytes && bytes !== 0) return ""
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " КБ"
  return (bytes / 1024 / 1024).toFixed(1).replace(".", ",") + " МБ"
}

const isImage = (f) => (f.type || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/i.test(f.name || "")
const fileIcon = (f) => (isImage(f) ? "image" : "file-text")

// Методичка к номеру задания: то, что репетитор пишет себе сам — как объясняет
// этот номер, на чём ловятся ученики, какие формулы держать под рукой, и файлы
// к нему: своя памятка, скрин разбора, таблица формул.
//
// Открывается на ЧТЕНИЕ: во время занятия в неё заглядывают, а не правят.
// Правка — по кнопке, чтобы случайное касание не превращало шпаргалку в поле
// ввода посреди урока.
function TaskNoteModal({ examType, number, note, tutorId, onSave, onClose }) {
  const [editing, setEditing] = useState(!note)
  const [title, setTitle] = useState(note?.title || "")
  const [body, setBody] = useState(note?.body || "")
  const [files, setFiles] = useState(note?.files || [])
  // Убранные файлы стираем из хранилища только после успешного сохранения:
  // отменённая правка не должна уносить вложение, которое в базе ещё есть.
  const [removed, setRemoved] = useState([])
  // Загруженное в этой правке: если её отменить, файлы останутся лежать в
  // хранилище, на которые уже ничто не ссылается, — стираем их при уходе.
  const addedRef = useRef([])
  const savedRef = useRef(false)
  const [uploading, setUploading] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [links, setLinks] = useState({})
  const fileRef = useRef(null)
  const { cls: closingCls, close } = useClosing(() => onClose?.())

  // Бакет приватный: без подписи ссылка ведёт в пустоту. Подписываем весь
  // список разом — один запрос вместо запроса на файл.
  useEffect(() => {
    if (!files.length) return
    let alive = true
    signStorageUrls(files.map((f) => f.url), "homework").then((map) => {
      if (!alive) return
      setLinks(Object.fromEntries(files.map((f) => [f.url, map.get(f.url) || f.url])))
    })
    return () => { alive = false }
  }, [files])

  async function addFiles(picked) {
    const list = Array.from(picked || [])
    if (!list.length) return
    setError("")
    for (const file of list) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`«${file.name}» больше ${MAX_MB} МБ — такой файл не загрузится`)
        continue
      }
      setUploading((n) => n + 1)
      const res = await uploadTaskNoteFile({ tutorId, file })
      setUploading((n) => n - 1)
      if (res.error) { setError("Файл не загрузился: " + res.error); continue }
      addedRef.current.push(res.file.url)
      setFiles((prev) => [...prev, res.file])
    }
  }

  function dropFile(url) {
    setFiles((prev) => prev.filter((f) => f.url !== url))
    setRemoved((prev) => [...prev, url])
  }

  async function submit() {
    setSaving(true)
    const res = await onSave({ number, title, body, files })
    setSaving(false)
    if (res?.error) return setError(res.error)
    savedRef.current = true
    if (removed.length) deleteTaskNoteFiles(removed)
    close()
  }

  // Уход без сохранения: загруженное в этой правке в базу не попало, и в
  // хранилище ему делать нечего.
  function dismiss() {
    if (!savedRef.current && addedRef.current.length) deleteTaskNoteFiles(addedRef.current)
    close()
  }

  // Файл в списке: в чтении открывается, в правке снимается. Строка одна и та
  // же, чтобы после «Изменить» ничего не переезжало.
  const fileRow = (f) => (
    <li key={f.url} className="flex items-center gap-2.5 rounded-xl ring-1 ring-gray-200/70 dark:ring-white/10 px-3 py-2">
      <Icon name={fileIcon(f)} size={15} className="text-blue-600 dark:text-blue-300 shrink-0" />
      <a href={links[f.url] || f.url} target="_blank" rel="noreferrer"
        className="press-tap min-w-0 flex-1 text-sm truncate hover:text-blue-600" title={f.name}>
        {f.name}
      </a>
      <span className="text-[11px] text-gray-400 tabular-nums shrink-0">{sizeLabel(f.size)}</span>
      {editing && (
        <button onClick={() => dropFile(f.url)} aria-label={`Убрать ${f.name}`}
          className="press-tap text-gray-400 hover:text-red-500 shrink-0">
          <Icon name="x" size={14} />
        </button>
      )}
    </li>
  )

  return createPortal(
    <div className={`fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 ${closingCls}`}>
      <div className={`glass-modal w-full max-w-lg flex flex-col ${closingCls}`} style={{ maxHeight: "90dvh" }}>
        <div className="flex justify-between items-start gap-3 px-6 py-4 border-b border-gray-100/60 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-medium truncate">
              {note?.title || `Задание №${number}`}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{numberTitle(examType, number)}</p>
          </div>
          <button onClick={dismiss} aria-label="Закрыть" className="press-tap text-gray-500 hover:text-gray-700 shrink-0 mt-1">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 flex flex-col gap-4">
          {editing ? (
            <>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Заголовок</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-glass"
                  placeholder={`Например, «№${number}: как не потерять корень»`} />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Материал</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
                  className="input-glass resize-y leading-relaxed"
                  placeholder="Формулы, порядок разбора, типичные ошибки — всё, что вы обычно диктуете на занятии." />
                {/* Пустая методичка стирается — сказать об этом надо здесь, а
                    не выяснять после исчезнувшего значка книжки. */}
                <p className="text-xs text-gray-400 mt-1.5">
                  Пустой материал без файлов удаляет методичку — значок книжки у задания пропадёт.
                </p>
              </div>
            </>
          ) : (
            // Перенос строк сохраняем как есть: методичка пишется списком и
            // столбиком формул, схлопнутая в абзац она нечитаема.
            note.body
              ? <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{note.body}</div>
              : <p className="text-sm text-gray-400">Текста нет — методичка собрана из файлов.</p>
          )}

          {/* Файлы: памятка PDF, скрин разбора, таблица формул. Лежат в самой
              методичке, чтобы не искать их по компьютеру во время занятия. */}
          {(editing || files.length > 0) && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-sm text-gray-500">Файлы</span>
                {editing && (
                  <button onClick={() => fileRef.current?.click()} disabled={uploading > 0}
                    className="press-fill text-xs px-2.5 py-1.5 rounded-lg ring-1 ring-gray-200 dark:ring-white/15 text-gray-600 dark:text-gray-300 inline-flex items-center gap-1.5 disabled:opacity-50">
                    <Icon name="paperclip" size={13} />
                    {uploading > 0 ? "Загружаем…" : "Добавить"}
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" multiple className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = "" }} />
              {files.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {files.map(fileRow)}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">
                  Памятка, скрин разбора, таблица формул — до {MAX_MB} МБ. Видит только репетитор.
                </p>
              )}
            </div>
          )}
        </div>

        {error && <div className="px-6 pt-1 text-sm text-red-500 text-center flex-shrink-0">{error}</div>}

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100/60 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={dismiss} className="press-fill flex-1 ring-1 ring-gray-200 dark:ring-white/15 rounded-xl py-2.5 text-sm text-gray-600">
                Отмена
              </button>
              <button onClick={submit} disabled={saving || uploading > 0} className="flex-1 btn-primary py-2.5 disabled:opacity-50">
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="press-fill flex-1 ring-1 ring-gray-200 dark:ring-white/15 rounded-xl py-2.5 text-sm text-gray-600 inline-flex items-center justify-center gap-1.5">
                <Icon name="edit" size={14} />Изменить
              </button>
              <button onClick={dismiss} className="flex-1 btn-primary py-2.5">Закрыть</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default TaskNoteModal
