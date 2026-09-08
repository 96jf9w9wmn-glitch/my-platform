import { useState } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import { numberTitle } from "../pages/numberTitles"

// Методичка к номеру задания: то, что репетитор пишет себе сам — как объясняет
// этот номер, на чём ловятся ученики, какие формулы держать под рукой.
//
// Открывается на ЧТЕНИЕ: во время занятия в неё заглядывают, а не правят.
// Правка — по кнопке, чтобы случайное касание не превращало шпаргалку в поле
// ввода посреди урока.
function TaskNoteModal({ examType, number, note, onSave, onClose }) {
  const [editing, setEditing] = useState(!note)
  const [title, setTitle] = useState(note?.title || "")
  const [body, setBody] = useState(note?.body || "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const { cls: closingCls, close } = useClosing(() => onClose?.())

  async function submit() {
    setSaving(true)
    const res = await onSave({ number, title, body })
    setSaving(false)
    if (res?.error) return setError(res.error)
    close()
  }

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
          <button onClick={close} aria-label="Закрыть" className="press-tap text-gray-500 hover:text-gray-700 shrink-0 mt-1">
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
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12}
                  className="input-glass resize-y leading-relaxed"
                  placeholder="Формулы, порядок разбора, типичные ошибки — всё, что вы обычно диктуете на занятии." />
                {/* Пустой текст стирает методичку — сказать об этом надо здесь,
                    а не выяснять после исчезнувшего значка книжки. */}
                <p className="text-xs text-gray-400 mt-1.5">
                  Пустой материал удаляет методичку — значок книжки у задания пропадёт.
                </p>
              </div>
            </>
          ) : (
            // Перенос строк сохраняем как есть: методичка пишется списком и
            // столбиком формул, схлопнутая в абзац она нечитаема.
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{note.body}</div>
          )}
        </div>

        {error && <div className="px-6 pt-1 text-sm text-red-500 text-center flex-shrink-0">{error}</div>}

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100/60 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={close} className="press-fill flex-1 ring-1 ring-gray-200 dark:ring-white/15 rounded-xl py-2.5 text-sm text-gray-600">
                Отмена
              </button>
              <button onClick={submit} disabled={saving} className="flex-1 btn-primary py-2.5 disabled:opacity-50">
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="press-fill flex-1 ring-1 ring-gray-200 dark:ring-white/15 rounded-xl py-2.5 text-sm text-gray-600 inline-flex items-center justify-center gap-1.5">
                <Icon name="edit" size={14} />Изменить
              </button>
              <button onClick={close} className="flex-1 btn-primary py-2.5">Закрыть</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default TaskNoteModal
