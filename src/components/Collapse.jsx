// Плавное сворачивание/разворачивание блока произвольной высоты
// (grid-rows 0fr↔1fr — анимируется без измерения высоты контента).
export default function Collapse({ open, children }) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden min-h-0">{children}</div>
    </div>
  )
}
