// Сегмент-контрол в стиле iOS: белый «палец» ЕДЕТ к выбранному сегменту, а не
// перекрашивается на месте — перекраска читалась как грубый скачок. Тот же приём
// уже был у RoleSwitch на лендинге, здесь он вынесен для переиспользования.
// Сегменты равной ширины (flex-1 basis-0 + min-w-0: без min-w-0 более широкая
// подпись не даёт сегменту ужаться до равной доли, и «палец» встаёт мимо),
// поэтому «палец» сдвигается простым translateX(index * 100%). Плавность и
// уважение к prefers-reduced-motion — в классе .seg-finger (index.css).
export default function SegmentSwitch({ items, value, onChange, className = "", ariaLabel }) {
  const idx = Math.max(0, items.findIndex((it) => it.key === value))
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`relative inline-flex p-1 rounded-2xl bg-gray-100 border border-gray-200/70 ${className}`}
    >
      {/* прямой ребёнок .bg-gray-100 — в тёмной теме его перекрашивает правило из index.css */}
      <span
        aria-hidden="true"
        className="seg-finger absolute top-1 bottom-1 left-1 rounded-xl bg-white shadow-sm"
        style={{ width: `calc((100% - 0.5rem) / ${items.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          aria-selected={value === it.key}
          onClick={() => onChange(it.key)}
          className={`seg-label relative z-10 flex-1 basis-0 min-w-0 px-6 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap ${
            value === it.key ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {it.label ?? it.key}
        </button>
      ))}
    </div>
  )
}
