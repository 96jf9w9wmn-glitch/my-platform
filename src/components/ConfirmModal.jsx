import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import Icon from "./Icon"

// Кастомный glass-подтверждатель вместо нативного window.confirm — единый стиль с
// остальными модалками (createPortal + glass-overlay/glass-modal). Danger-вариант красит
// подтверждающую кнопку в красный и рисует предупреждающую иконку.
function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  danger = false,
  icon = danger ? "alert-triangle" : "check",
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.()
      if (e.key === "Enter") onConfirm?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onCancel, onConfirm])

  if (!open) return null

  const tint = danger ? "text-red-500 bg-red-500/12" : "text-blue-500 bg-blue-500/12"
  const confirmBtn = danger
    ? "bg-red-500 hover:bg-red-600 shadow-[0_2px_12px_rgba(239,68,68,0.4)]"
    : "bg-blue-600 hover:bg-blue-700 shadow-[0_2px_12px_rgba(0,122,255,0.4)]"

  return createPortal(
    <div
      className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="glass-modal w-full max-w-sm p-6 flex flex-col items-center text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${tint}`}>
          <Icon name={icon} size={26} />
        </div>
        <h3 className="text-lg font-semibold mb-1.5">{title}</h3>
        {message && <p className="text-sm text-gray-500 leading-relaxed mb-6">{message}</p>}
        <div className="flex gap-2.5 w-full">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] transition active:scale-[0.97]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition active:scale-[0.97] ${confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ConfirmModal
