// Колесо выбора в духе iOS: значения крутятся, ближайшее к центру и есть
// выбранное. Здесь оно вместо сетки из двенадцати кнопок-часов — та занимала
// треть окна и всё равно не давала поставить занятие на 8:30.
//
// Прокрутка своя, но инерция — родная: колонка это обычный скроллящийся
// список со `scroll-snap`, поэтому на телефоне работает привычный «бросок»
// пальцем, а на компьютере — колесо мыши и клавиши. Самодельная физика тут
// была бы хуже системной.
import { useEffect, useRef } from "react"

const ITEM_H = 36        // высота строки, px
const VISIBLE = 5        // строк в окне (нечётное: выбранная ровно в центре)

function WheelColumn({ items, value, onChange, ariaLabel }) {
  const ref = useRef(null)
  const timer = useRef(null)

  const index = Math.max(0, items.findIndex((i) => i.value === value))

  // Доводка до строки — только если колонка стоит не там. Проверка обязательна:
  // без неё получался круг (прокрутка присылает значение, значение возвращает
  // колонку прокруткой, та снова присылает значение) и колесо уезжало само.
  // Признак «прокрутил я сам» тут не нужен именно из-за неё: доводка ставит
  // ровно ту же строку, поэтому следующий разбор прокрутки вернёт то же
  // значение и onChange не сработает.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const want = index * ITEM_H
    if (Math.abs(el.scrollTop - want) > 1) el.scrollTo({ top: want, behavior: "auto" })
  }, [index])

  useEffect(() => () => clearTimeout(timer.current), [])

  function handleScroll() {
    clearTimeout(timer.current)
    // Ждём, пока прокрутка и притяжение к строке закончатся: считать значение
    // на лету — значит ловить строки, мимо которых пролистали.
    timer.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
      if (items[i] && items[i].value !== value) onChange(items[i].value)
    }, 140)
  }

  function handleKey(e) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
    e.preventDefault()
    const next = Math.min(items.length - 1, Math.max(0, index + (e.key === "ArrowDown" ? 1 : -1)))
    if (items[next]) onChange(items[next].value)
  }

  const pad = ((VISIBLE - 1) / 2) * ITEM_H

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={handleKey}
      className="no-scrollbar overflow-y-auto outline-none flex-1 min-w-0 rounded-xl focus-visible:ring-2 focus-visible:ring-[#007AFF]/40"
      style={{ height: VISIBLE * ITEM_H, scrollSnapType: "y mandatory" }}
    >
      <div style={{ paddingTop: pad, paddingBottom: pad }}>
        {items.map((item, i) => {
          const away = Math.abs(i - index)
          return (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected={i === index}
              onClick={() => onChange(item.value)}
              className={`w-full flex items-center justify-center tabular-nums transition-[color,opacity,font-size] duration-150 ${
                i === index
                  ? "text-[19px] font-semibold text-gray-900 dark:text-white"
                  : "text-[16px] text-gray-500"
              }`}
              style={{ height: ITEM_H, scrollSnapAlign: "center", opacity: away > 2 ? 0.3 : 1 - away * 0.22 }}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Часы 0–23 и минуты с шагом в пять: занятие на 17:23 никто не ставит, а
// вчетверо более длинная колонка минут крутилась бы бесконечно.
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: String(h).padStart(2, "0") }))
const MINUTES = Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: String(i * 5).padStart(2, "0") }))

// value — «ЧЧ:ММ». Пустое значение не выдумываем: подставляем 09:00, но наверх
// отдаём только то, что человек действительно выбрал.
export default function WheelPicker({ value, onChange, label = "Время" }) {
  // Последнее известное значение держим и в ссылке: две колонки могут прислать
  // изменение в одном такте (клик по часам и тут же по минутам), и вторая, читая
  // значение из своего рендера, вернула бы старые часы.
  const latest = useRef(value || "09:00")
  useEffect(() => { if (value) latest.current = value }, [value])

  const [h, m] = String(value || "09:00").split(":").map((n) => Number(n) || 0)
  // Минуты не из пятёрки (пришли из старого занятия) округляем к ближайшей —
  // иначе колонка встала бы между строк.
  const mSnap = Math.min(55, Math.round(m / 5) * 5)

  function set(hh, mm) {
    const next = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
    latest.current = next
    onChange(next)
  }
  const parts = () => {
    const [ch, cm] = String(latest.current || "09:00").split(":").map((n) => Number(n) || 0)
    return [ch, Math.min(55, Math.round(cm / 5) * 5)]
  }

  return (
    <div className="relative flex items-stretch gap-1 rounded-2xl ring-1 ring-inset ring-gray-200 dark:ring-white/[0.12] px-2">
      {/* Полоса выбора: акцентная подложка вместо серой — правило проекта. */}
      <div
        className="pointer-events-none absolute inset-x-1.5 rounded-xl bg-blue-500/[0.10] dark:bg-blue-400/[0.14]"
        style={{ height: ITEM_H, top: `calc(50% - ${ITEM_H / 2}px)` }}
      />
      <WheelColumn items={HOURS} value={h} onChange={(hh) => set(hh, parts()[1])} ariaLabel={`${label}: часы`} />
      <span className="relative self-center text-[19px] font-semibold text-gray-400 select-none">:</span>
      <WheelColumn items={MINUTES} value={mSnap} onChange={(mm) => set(parts()[0], mm)} ariaLabel={`${label}: минуты`} />
    </div>
  )
}
