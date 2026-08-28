import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Icon from "./Icon"
import { CLOSE_MS } from "../useClosing"

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
  // Слой. По умолчанию обычный модальный, но поверх полноэкранных панелей
  // (доска живёт на z-100000) подтверждение иначе оказывается ПОД ними и
  // выглядит как «кнопка не сработала».
  zIndex = 50,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null)
  // Модалку нельзя снять сразу: пока идёт анимация ухода, она остаётся в дереве
  // с классом .is-closing (см. src/useClosing.js — здесь та же логика, но от
  // внешнего пропа open, а не от нажатия).
  const [prevOpen, setPrevOpen] = useState(open)
  const [visible, setVisible] = useState(open)
  const [closing, setClosing] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) { setVisible(true); setClosing(false) }
    else if (visible) setClosing(true)
  }

  useEffect(() => {
    if (!closing) return
    const t = setTimeout(() => { setVisible(false); setClosing(false) }, CLOSE_MS)
    return () => clearTimeout(t)
  }, [closing])

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

  if (!visible) return null

  const tint = danger ? "text-red-500 bg-red-500/12" : "text-blue-500 bg-blue-500/12"
  const confirmBtn = danger
    ? "bg-red-500 hover:bg-red-600 shadow-[0_2px_12px_rgba(239,68,68,0.4)]"
    : "bg-blue-600 hover:bg-blue-700 shadow-[0_2px_12px_rgba(0,122,255,0.4)]"

  return createPortal(
    <div
      className={`fixed inset-0 glass-overlay flex items-center justify-center p-4 ${closing ? "is-closing" : ""}`}
      style={{ zIndex }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`glass-modal w-full max-w-sm p-6 flex flex-col items-center text-center ${closing ? "is-closing" : ""}`}
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
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-200/80 dark:ring-white/15 hover:bg-blue-500/10 dark:hover:bg-white/[0.12] transition active:scale-[0.97]"
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
