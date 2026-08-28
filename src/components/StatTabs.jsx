import { useState, useLayoutEffect, useRef } from "react"
import Icon from "./Icon"

// Полоса «сводка + фильтр»: число в каждом состоянии сразу видно, и та же полоса
// переключает список. Общая для «Домашних заданий» и «Вариантов» — раньше жила
// только в Homework, и на «Вариантах» стояла её похожая, но неживая копия.
//
// items: [{ id, label, short?, icon, tint, count }]
// Пустой пункт нажимается наравне с остальными: ноль — такой же ответ («здесь
// пусто»), и кнопка, которая не отзывается, читается как поломка.
export default function StatTabs({ items, value, onChange, className = "" }) {
  // Подчёркивание активной вкладки — одна полоска, которая переезжает с кнопки
  // на кнопку, а не появляется рывком в новом месте. Позицию берём с самой
  // кнопки: ширины у вкладок разные и на узком экране полоса ещё и скроллится.
  const tabsRef = useRef(null)
  const tabsScrollRef = useRef(null)
  const [ind, setInd] = useState(null)
  const indAnimated = useRef(false)
  const count = items.length

  useLayoutEffect(() => {
    const wrap = tabsRef.current
    if (!wrap) return
    const measure = () => {
      const el = wrap.querySelector(`[data-filter="${value}"]`)
      if (!el) return
      setInd({ left: el.offsetLeft, width: el.offsetWidth })
      // На узком экране выбранная вкладка может быть наполовину за краем —
      // подтягиваем её в видимую часть, иначе полоска уезжает «в никуда».
      const sc = tabsScrollRef.current
      if (sc && indAnimated.current && sc.scrollWidth > sc.clientWidth) {
        const left = el.offsetLeft - 16
        const right = el.offsetLeft + el.offsetWidth - sc.clientWidth + 16
        const to = sc.scrollLeft > left ? left : sc.scrollLeft < right ? right : null
        if (to !== null) sc.scrollTo({ left: Math.max(0, to), behavior: "smooth" })
      }
      indAnimated.current = true
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [value, count])

  return (
    <div ref={tabsScrollRef} className={`glass no-scrollbar overflow-x-auto ${className}`}>
      <div ref={tabsRef} className="relative flex min-w-full divide-x divide-gray-500/12 dark:divide-white/10">
        {items.map((f) => {
          const on = f.id === value
          return (
            <button
              key={f.id}
              data-filter={f.id}
              aria-pressed={on}
              onClick={() => onChange(f.id)}
              className={`press-fill flex-1 min-w-[7.5rem] sm:min-w-[9rem] flex items-center gap-3 px-3 sm:px-4 py-3.5 text-left transition-colors duration-200 ${
                on ? "bg-blue-500/[0.07] dark:bg-blue-400/10" : "hover:bg-blue-500/[0.05] dark:hover:bg-white/[0.04]"
              }`}
            >
              <div className={`w-9 h-9 rounded-xl hidden sm:flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${f.count > 0 ? f.tint : "text-gray-400 ring-1 ring-gray-200/70 dark:ring-white/10"}`}>
                <Icon name={f.icon} size={16} />
              </div>
              <div className="min-w-0">
                <div className={`text-xl font-semibold leading-none transition-colors duration-200 ${f.count > 0 ? f.tint.split(" ")[0] : "text-gray-400"}`}>{f.count}</div>
                {/* На узком экране подпись короче: полная не влезает и обрезалась многоточием */}
                <div className={`text-[11px] mt-1.5 truncate transition-colors duration-200 ${on ? "text-gray-600 font-medium" : "text-gray-400"}`}>
                  {f.short ? (
                    <>
                      <span className="sm:hidden">{f.short}</span>
                      <span className="hidden sm:inline">{f.label}</span>
                    </>
                  ) : f.label}
                </div>
              </div>
            </button>
          )
        })}
        {ind && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 h-[3px] rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: ind.width, transform: `translateX(${ind.left}px)` }}
          />
        )}
      </div>
    </div>
  )
}
