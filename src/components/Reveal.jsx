import { useEffect, useState } from "react"

// Длительность ухода — синхронно с .reveal.is-closing в index.css
export const REVEAL_MS = 240

// Встроенный блок, который не только появляется, но и УХОДИТ плавно:
// баннер с ошибкой, готовая ссылка-приглашение, поле ввода суммы. Раньше такие
// блоки пропадали в тот же кадр, что и нажатие на крестик, — страница дёргалась.
//
// Отличие от <Collapse>: тот держит содержимое смонтированным всегда, а здесь
// блок снимается после анимации — это важно для полей с autoFocus и для рядов
// списка, где скрытый экземпляр висел бы у каждого элемента.
//
// Содержимое задаётся функцией от `value`, а не готовым узлом: состояние гасят
// тем же нажатием, поэтому во время ухода показывать уже нечего — блок
// сворачивал бы пустоту. Функцию зовём с последним НЕпустым значением.
//
//   <Reveal value={invite}>{(inv) => <div>{inv.link}</div>}</Reveal>
//
// Пустым считается null/undefined/false/"" — то есть обычные «нет значения».
export default function Reveal({ value, children, className = "" }) {
  const open = value !== null && value !== undefined && value !== false && value !== ""
  const [kept, setKept] = useState(value)
  const [prev, setPrev] = useState(value)
  const [closing, setClosing] = useState(false)

  // Правка состояния прямо в рендере — приём React для «сбросить при смене
  // входа»: лишний кадр со старым содержимым не показывается.
  if (prev !== value) {
    setPrev(value)
    if (open) {
      setKept(value)
      if (closing) setClosing(false)
    } else {
      setClosing(true)
    }
  }

  useEffect(() => {
    if (!closing) return
    const t = setTimeout(() => setClosing(false), REVEAL_MS)
    return () => clearTimeout(t)
  }, [closing])

  if (!open && !closing) return null

  return (
    <div className={`reveal ${closing ? "is-closing" : "reveal-in"} ${className}`}>
      {/* Пиксель запаса с компенсирующим отрицательным полем: кольца (ring-*)
          рисуются box-shadow'ом СНАРУЖИ элемента, а обрезка содержимого при
          сворачивании срезала им края — обводка панели выглядела надрезанной. */}
      <div className="overflow-hidden min-h-0 p-px -m-px">{children(open ? value : kept)}</div>
    </div>
  )
}
