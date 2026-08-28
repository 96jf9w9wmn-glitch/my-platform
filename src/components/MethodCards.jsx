import Icon from "./Icon"

// Выбор способа сборки — карточками, а не строкой переключателя: способ, который
// прячется в узкой вкладке, попросту не находят (так было с ИИ-сборкой ДЗ).
// Общий компонент для «Нового задания» и «Нового варианта»: одинаковый шаг в
// обоих окнах должен и выглядеть одинаково.
//
// items: [{ id, icon, title, note }]
export default function MethodCards({ items, value, onChange, label, className = "" }) {
  return (
    <div className={className}>
      {label && <div className="text-sm text-gray-500 mb-2">{label}</div>}
      <div className={`grid grid-cols-1 gap-2 ${items.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {items.map((m) => {
          const on = value === m.id
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(m.id)}
              className={`press-fill text-left rounded-2xl p-3 ring-1 transition-colors ${
                on ? "ring-blue-500/40 bg-blue-500/[0.08]" : "ring-gray-500/15 hover:bg-blue-500/[0.06]"
              }`}
            >
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${
                on ? "bg-blue-500/15 text-blue-600" : "text-gray-500 ring-1 ring-gray-200/70 dark:ring-white/15"
              }`}>
                <Icon name={m.icon} size={15} />
              </span>
              <span className={`block text-sm ${on ? "text-blue-700 dark:text-blue-300 font-medium" : "text-gray-700"}`}>{m.title}</span>
              <span className="block text-[11px] text-gray-400 leading-snug mt-0.5">{m.note}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
