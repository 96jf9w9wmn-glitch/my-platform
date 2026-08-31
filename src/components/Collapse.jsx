// Плавное сворачивание/разворачивание блока произвольной высоты
// (grid-rows 0fr↔1fr — анимируется без измерения высоты контента).
export default function Collapse({ open, children }) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      {/* Пиксель запаса с компенсирующим отрицательным полем — как в <Reveal>:
          кольца (ring-*) и тени рисуются СНАРУЖИ элемента, а обрезка содержимого
          срезала их по бокам — у поля ввода в фокусе пропадала обводка слева и
          справа. Положение содержимого не меняется. */}
      <div className="overflow-hidden min-h-0 p-px -m-px">{children}</div>
    </div>
  )
}
