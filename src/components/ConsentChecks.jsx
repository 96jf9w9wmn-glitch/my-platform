// Галочки согласий и запись их в журнал. Общий код для всех мест, где мы
// собираем персональные данные: регистрация (Auth), заявка с лендинга,
// вход родителя по коду, добавление ученика репетитором.
//
// Правило простое: собираем данные — значит показываем, на что человек
// соглашается, и фиксируем факт. Галочки НЕ проставлены заранее: с 01.09.2025
// согласие даётся активным действием, преднажатая галочка согласием не считается.

// Строка согласия: вся плашка — одна большая кнопка-переключатель, ссылки внутри
// открываются в новой вкладке и галочку не трогают.
export function ConsentRow({ checked, onChange, accent = "from-blue-500 to-blue-600", children }) {
  return (
    <label
      className="group flex items-start gap-2.5 py-2 px-3 -mx-1 rounded-2xl cursor-pointer select-none
                 bg-gray-50/70 dark:bg-white/5 ring-1 ring-gray-100 dark:ring-white/10
                 transition-all duration-150 hover:bg-gray-100/70 dark:hover:bg-white/10 active:scale-[0.985]"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`mt-px w-[18px] h-[18px] shrink-0 rounded-md flex items-center justify-center
                    ring-1 transition-all duration-150 group-active:scale-90 ${
          checked
            ? `bg-gradient-to-br ${accent} ring-transparent text-white shadow-sm`
            : "bg-white dark:bg-gray-800 ring-gray-300 dark:ring-gray-600 text-transparent"
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="text-[12px] leading-snug text-gray-500 dark:text-gray-400">{children}</span>
    </label>
  )
}

export function ConsentLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-blue-600 dark:text-blue-400 hover:opacity-70 transition-opacity underline underline-offset-2"
    >
      {children}
    </a>
  )
}
