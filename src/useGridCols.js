import { useEffect, useState } from "react"

// Число колонок в сетке карточек: 1 / 2 / 3 — теми же порогами, что и классы
// Tailwind у самой сетки (sm:grid-cols-2 xl:grid-cols-3). Нужно, чтобы разбор
// раскрывался целой строкой ПОД рядом выбранной карточки, а не разрывал ряд
// посередине. Один хук на «Варианты» и «Домашние задания»: списки в обоих
// разделах устроены одинаково, и пороги обязаны совпадать.
const read = () =>
  typeof window === "undefined" ? 1
    : window.matchMedia("(min-width: 1280px)").matches ? 3
    : window.matchMedia("(min-width: 640px)").matches ? 2
    : 1

export default function useGridCols() {
  const [cols, setCols] = useState(read)
  useEffect(() => {
    const mqs = [window.matchMedia("(min-width: 640px)"), window.matchMedia("(min-width: 1280px)")]
    const onChange = () => setCols(read())
    mqs.forEach((m) => m.addEventListener("change", onChange))
    return () => mqs.forEach((m) => m.removeEventListener("change", onChange))
  }, [])
  return cols
}

// Ряд, после которого встаёт раскрытый разбор: последняя карточка того ряда,
// в котором стоит выбранная. Возвращает −1, когда ничего не выбрано.
export function detailRowEndOf(index, total, cols) {
  if (index < 0) return -1
  return Math.min(Math.floor(index / cols) * cols + cols - 1, total - 1)
}
