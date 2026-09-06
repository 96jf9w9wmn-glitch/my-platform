import { useState } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import WheelPicker from "./WheelPicker"
import { formatLessonWhen, todayDateStr } from "../lessonMove"

// Общая модалка переноса: одна и та же и у репетитора (двигает занятие), и у
// ученика (просит о переносе) — меняются только подписи и проверка занятости.
function RescheduleModal({
  lesson,
  title = "Перенести занятие",
  who = "",
  hint = "",
  initial = null,
  commentLabel = "",
  commentPlaceholder = "",
  submitLabel = "Перенести",
  conflictCheck,
  busy = false,
  error = "",
  onSubmit,
  onClose,
}) {
  const [date, setDate] = useState(initial?.date || lesson?.date || "")
  const [time, setTime] = useState(initial?.time || lesson?.time || "")
  const [comment, setComment] = useState(initial?.comment || "")
  const [localError, setLocalError] = useState("")
  const { cls: closingCls, close } = useClosing(onClose)

  const unchanged = date === lesson?.date && time === lesson?.time
  const conflict = !unchanged && date && time ? conflictCheck?.(date, time) : null

  function handleSubmit() {
    if (!date || !time) { setLocalError("Выберите дату и время."); return }
    if (unchanged) { setLocalError("Это те же дата и время, что и сейчас."); return }
    setLocalError("")
    onSubmit({ date, time, comment: comment.trim() })
  }

  return createPortal(
    <div className={`fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 ${closingCls}`} onClick={close}>
      <div
        className={`glass-modal w-full max-w-sm flex flex-col ${closingCls}`}
        style={{ maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100/60 flex-shrink-0">
          <h2 className="text-lg font-medium">{title}</h2>
          <button onClick={close} aria-label="Закрыть" className="text-gray-500 hover:text-gray-700 transition-transform active:scale-90">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 flex flex-col gap-4">
          <div className="glass-sm px-3 py-2.5 flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-blue-500/12 text-blue-500 flex items-center justify-center flex-shrink-0">
              <Icon name="repeat" size={15} />
            </span>
            <div className="min-w-0">
              {who && <div className="text-sm font-medium truncate">{who}</div>}
              <div className="text-xs text-gray-500">
                Сейчас: {formatLessonWhen(lesson?.date, lesson?.time)}
                {lesson?.duration ? ` · ${lesson.duration} мин` : ""}
              </div>
            </div>
          </div>

          {hint && <p className="text-xs text-gray-500 leading-relaxed">{hint}</p>}

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Новая дата</label>
            <input
              type="date"
              value={date}
              min={todayDateStr()}
              onChange={(e) => setDate(e.target.value)}
              className="input-glass"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-2 block">Новое время</label>
            {/* Колесо вместо сетки часов и отдельного поля «другое время»:
                любое время набирается в одном месте, как в iOS. */}
            <WheelPicker value={time || lesson?.time || "09:00"} onChange={setTime} label="Новое время" />
          </div>

          {commentLabel && (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">{commentLabel}</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder={commentPlaceholder}
                className="input-glass resize-none"
              />
            </div>
          )}

          {conflict && (
            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-xl px-3 py-2">
              <span className="flex-shrink-0 mt-0.5"><Icon name="warning" size={13} /></span>
              <span className="leading-relaxed">{conflict}</span>
            </div>
          )}
        </div>

        {(localError || error) && (
          <div className="px-6 pt-1 flex-shrink-0">
            <div className="text-sm text-red-500 text-center">{localError || error}</div>
          </div>
        )}

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100/60 flex-shrink-0">
          <button
            onClick={close}
            className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-blue-500/[0.06] dark:hover:bg-white/[0.06] transition active:scale-[0.97]"
          >
            Отмена
          </button>
          <button onClick={handleSubmit} disabled={busy} className="flex-1 btn-primary py-2.5 disabled:opacity-60">
            {busy ? "Сохраняем…" : submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default RescheduleModal
