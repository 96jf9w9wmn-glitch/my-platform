import { useEffect, useRef, useState } from "react"

// Блок «наши цифры» — приём с drfrost.org и sparxmaths.com: несколько крупных
// чисел в ряд с короткой подписью. Цифры берутся из bankStats.js, который
// считает scripts/bank-stats.mjs по самому банку — руками ничего не вписано.
//
// Анимация (A1): при въезде блока в вьюпорт число считается от 0 до значения
// за 1200ms с замедлением, ровно один раз. Цифры моноширинные
// (tabular-nums), иначе на каждом кадре меняется ширина и блок дёргается.

const DURATION = 1200

// Уважаем «меньше движения»: там число не считается, а сразу стоит итоговым —
// поэтому решение принимаем до первого рендера, а не внутри эффекта.
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

function useCountUp(target, active) {
  const [reduced] = useState(reducedMotion)
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0))
  useEffect(() => {
    if (!active || reduced) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / DURATION)
      const eased = 1 - Math.pow(1 - p, 3) // ease-out
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active, reduced])
  return value
}

function Stat({ item, active, grad }) {
  const counted = useCountUp(item.n || 0, active)
  const shown = item.n == null ? item.text : counted.toLocaleString("ru-RU")
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <div
        className={`text-[40px] leading-none font-bold text-transparent bg-clip-text bg-gradient-to-r ${grad}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {shown}
      </div>
      <div className="text-[13px] text-gray-500 dark:text-gray-400 mt-2 leading-snug">{item.label}</div>
    </div>
  )
}

// items: [{ n, label } | { text, label }] — n анимируется, text показывается как есть.
function StatCounters({ items, grad }) {
  const ref = useRef(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || active) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setActive(true); io.disconnect() } },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [active])

  return (
    <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((it) => <Stat key={it.label} item={it} active={active} grad={grad} />)}
    </div>
  )
}

export default StatCounters
