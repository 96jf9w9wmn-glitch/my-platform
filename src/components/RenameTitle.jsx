import { useEffect, useRef, useState } from "react"
import Icon from "./Icon"

/**
 * Название работы, которое переименовывается прямо в шапке — в том числе после
 * проверки. Правка условий сданной работе закрыта намеренно (ответы ученика
 * разошлись бы с заданиями), но имя к ответам отношения не имеет: «Пробник
 * 12.09» и «Домашка» живут в списке месяцами, и опечатку в них до сих пор
 * нельзя было исправить вовсе — оставалось удалить работу вместе с ответами
 * ученика и выдать заново.
 *
 * Показанное имя держим у себя: список перечитывается после сохранения, и без
 * своей копии название на секунду возвращалось бы к прежнему.
 */
export default function RenameTitle({ value, onSave, className = "font-medium text-base" }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value || "")
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")
  const ref = useRef(null)
  // Escape отменяет правку, но сам уводит фокус — и без этой пометки следом
  // сработало бы сохранение по blur.
  const cancelled = useRef(false)

  // Пришло новое имя снаружи (список перечитался) — показываем его. Правка
  // состояния прямо в рендере, а не эффектом: эффект дал бы лишний кадр со
  // старым именем.
  const [seen, setSeen] = useState(value)
  if (seen !== value) { setSeen(value); setText(value || "") }

  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])

  function start() {
    setError("")
    setDraft(text)
    cancelled.current = false
    setEditing(true)
  }

  async function commit() {
    if (cancelled.current) { setEditing(false); return }
    const next = draft.trim()
    setEditing(false)
    // Пустое имя не сохраняем: работа без названия неотличима от соседних
    // в списке. Молча возвращаем прежнее.
    if (!next || next === text) return
    const was = text
    setText(next)
    const err = await onSave(next)
    if (err) { setText(was); setError(typeof err === "string" ? err : "Не получилось переименовать") }
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur() }
          if (e.key === "Escape") { e.preventDefault(); cancelled.current = true; e.currentTarget.blur() }
        }}
        aria-label="Название"
        className={`${className} min-w-0 flex-1 sm:w-64 sm:flex-none bg-transparent rounded-lg px-2 py-0.5 -my-0.5 outline-none ring-1 ring-blue-500/35 focus:ring-blue-500/70 transition-shadow`}
      />
    )
  }

  return (
    <>
      <span className={`${className} truncate`}>{text}</span>
      {/* Карандаш стоит у самого названия, а не в общем ряду значков справа:
          там он означал бы правку всей работы, которой у проверенной нет. */}
      <button
        type="button"
        onClick={start}
        title="Переименовать"
        aria-label="Переименовать"
        className="press-tap w-6 h-6 -mx-0.5 rounded-md flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
      >
        <Icon name="edit" size={12} />
      </button>
      {error && <span className="text-[11px] text-red-500 truncate">{error}</span>}
    </>
  )
}
