import { useEffect, useRef, useState } from "react"

// Плавная смена цифр: при новом значении считаем промежуточные на rAF, а не
// показываем сумму рывком. Первое значение выводится сразу, без счётчика от
// нуля. Уважает «уменьшенное движение» в системе.
export function useAnimatedNumber(value, dur = 520) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const raf = useRef(0)

  useEffect(() => {
    const start = from.current
    const still = start === value ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (still) {
      from.current = value
      setShown(value)
      return
    }
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(start + (value - start) * eased))
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else from.current = value
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, dur])

  return shown
}
