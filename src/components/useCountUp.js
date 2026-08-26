import { useEffect, useState } from "react"

// Число не подставляется скачком, а докручивается до цели. Общий код для
// сводок «Главной» и «Результатов» — раньше хук лежал копией в Dashboard.jsx.
export default function useCountUp(target, duration = 700) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf
    const start = performance.now()
    const step = (now) => {
      if (!target) { setVal(0); return }
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(target * ease))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}
