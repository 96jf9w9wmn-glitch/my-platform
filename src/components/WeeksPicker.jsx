// На сколько недель вперёд расставить регулярные занятия.
//
// Был нативный <input type="range"> с подписями «1 нед — 26 нед — 52 нед»:
// выглядел он как системный элемент из чужого интерфейса, а попасть мышью в
// нужную неделю всё равно не получалось. Репетитор и не мыслит неделями — он
// держит ученика «месяц», «до конца полугодия», «весь учебный год», поэтому
// здесь готовые сроки, подписанные по-человечески. Их ровно шесть: сетка
// заполняется без огрызка последней строки.
const PRESETS = [
  { weeks: 4, label: "Месяц" },
  { weeks: 8, label: "2 месяца" },
  { weeks: 12, label: "3 месяца" },
  { weeks: 26, label: "Полгода" },
  { weeks: 36, label: "Учебный год" },
  { weeks: 52, label: "Год" },
]

export default function WeeksPicker({ value, onChange }) {
  // Старая карточка могла хранить произвольное число недель (ползунок давал
  // любое от 1 до 52). Показываем его отдельной плиткой, иначе выбор молча
  // сбросился бы на ближайший срок при первом же открытии.
  const items = PRESETS.some((p) => p.weeks === value)
    ? PRESETS
    : [...PRESETS, { weeks: value, label: "Свой срок" }]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map((p) => {
        const selected = p.weeks === value
        return (
          <button
            key={p.weeks}
            type="button"
            onClick={() => onChange(p.weeks)}
            aria-pressed={selected}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 rounded-xl border text-sm transition-all duration-200 active:scale-95 ${
              selected
                ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30"
                : "border-gray-200 dark:border-white/12 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
            }`}
          >
            <span className="font-medium">{p.label}</span>
            <span className={`text-xs ${selected ? "text-white/70" : "text-gray-400"}`}>{p.weeks} нед.</span>
          </button>
        )
      })}
    </div>
  )
}
