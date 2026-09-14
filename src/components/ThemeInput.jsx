import { useId, useState } from "react"

// Поле темы у задания, нарезанного из своего файла.
//
// Отдельной кнопки «создать тему» нет намеренно: поле и есть создание — темы
// номера подсказываются списком, а написанное руками становится своей темой.
// Ставить рядом выбор «из банка / своя» значило бы спрашивать то, что и так
// видно по набранному тексту.
export default function ThemeInput({
  value, options = [], onChange, onOpen, placeholder = "Тема", className = "", title,
}) {
  // id списка: у useId в React есть двоеточия, а атрибут list ищет ровно по
  // значению id — путаницы не надо, чистим.
  const listId = "theme-" + useId().replace(/[^a-zA-Z0-9_-]/g, "")
  // Пока поле правят, истина — набранное в нём; пришло новое значение сверху
  // (соседняя кнопка проставила тему всем) — берём его.
  const [draft, setDraft] = useState(value ?? "")
  const [src, setSrc] = useState(value)
  if (src !== value) { setSrc(value); setDraft(value ?? "") }

  return (
    <>
      <input
        value={draft}
        list={options.length ? listId : undefined}
        onFocus={onOpen}
        onChange={(e) => { setDraft(e.target.value); onChange(e.target.value) }}
        placeholder={placeholder}
        title={title || "Тема задания — по ней собирается статистика и отчёт родителю"}
        className={`input-glass ${className}`}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((t) => <option key={t} value={t} />)}
        </datalist>
      )}
    </>
  )
}
