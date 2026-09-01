// Колесо выбора в духе iOS: значения крутятся по кругу, ближайшее к центру и
// есть выбранное. Здесь оно вместо сетки из двенадцати кнопок-часов — та
// занимала треть окна и всё равно не давала поставить занятие на 8:30.
//
// Прокрутка своя, но инерция — родная: колонка это обычный скроллящийся список
// со `scroll-snap`, поэтому на телефоне работает привычный «бросок» пальцем, а
// на компьютере — колесо мыши и клавиши. Самодельная физика была бы хуже.
//
// Бесконечность сделана повторами: список содержит одни и те же значения
// несколько десятков раз, человек стоит в середине, а когда прокрутка уводит
// его в крайние копии — колонка молча возвращается на ту же строку середины.
// Настоящая «бесконечная лента» с дорисовкой на лету рвала бы инерцию.
//
// Подсветка центральной строки правится напрямую по DOM, без состояния React:
// строк в колонке больше двухсот, и перерисовывать их все на каждый шаг
// прокрутки — это заметные рывки на телефоне.
import { useEffect, useRef } from "react"

const ITEM_H = 36        // высота строки, px
const VISIBLE = 5        // строк в окне (нечётное: выбранная ровно в центре)
const NEAR = 3           // на сколько строк вокруг центра распространяется подсветка

const ROW_BASE = "w-full flex items-center justify-center tabular-nums transition-[opacity] duration-100"
const ROW_ON = `${ROW_BASE} text-gray-900 dark:text-white`
const ROW_OFF = `${ROW_BASE} text-gray-500`

// Столько копий, чтобы в списке было около двух сотен строк: с меньшим числом
// сильный «бросок» упирался бы в край до того, как колонка успеет вернуться в
// середину. Нечётное — чтобы середина была ровно одной из копий.
function repeatsFor(n) {
  const r = Math.max(3, Math.ceil(200 / n))
  return r % 2 === 0 ? r + 1 : r
}

function WheelColumn({ items, value, onChange, ariaLabel }) {
  const ref = useRef(null)
  const listRef = useRef(null)
  const timer = useRef(null)
  const painted = useRef(-1)

  const n = items.length
  const repeats = repeatsFor(n)
  const middle = Math.floor(repeats / 2) * n
  const index = Math.max(0, items.findIndex((i) => i.value === value))

  // Подсветка: трогаем только строки вокруг прежнего и нового центра.
  function paint(centre) {
    const list = listRef.current
    if (!list || centre === painted.current) return
    const kids = list.children
    const touch = (i) => {
      const k = kids[i]
      if (!k) return
      const away = Math.abs(i - centre)
      k.className = i === centre ? ROW_ON : ROW_OFF
      k.style.opacity = away > 2 ? "0.3" : String(1 - away * 0.22)
      k.style.fontSize = i === centre ? "19px" : "16px"
      k.style.fontWeight = i === centre ? "600" : "400"
    }
    for (let i = painted.current - NEAR; i <= painted.current + NEAR; i++) touch(i)
    painted.current = centre
    for (let i = centre - NEAR; i <= centre + NEAR; i++) touch(i)
  }

  // Ставим колонку на нужное значение — но только если она стоит не на нём.
  // Проверка обязательна: без неё получался круг «прокрутка → значение →
  // прокрутка», и колесо уезжало само по себе.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const row = Math.round(el.scrollTop / ITEM_H)
    if (((row % n) + n) % n === index && row >= n && row < (repeats - 1) * n) {
      paint(row)
      return
    }
    const want = middle + index
    el.scrollTo({ top: want * ITEM_H, behavior: "auto" })
    paint(want)
  }, [index, n, repeats, middle])

  useEffect(() => () => clearTimeout(timer.current), [])

  function handleScroll() {
    const el = ref.current
    if (!el) return
    paint(Math.round(el.scrollTop / ITEM_H))
    clearTimeout(timer.current)
    // Значение снимаем, когда прокрутка и притяжение к строке закончились:
    // считать на лету — значит ловить строки, мимо которых пролистали.
    timer.current = setTimeout(settle, 140)
  }

  function settle() {
    const el = ref.current
    if (!el) return
    const row = Math.round(el.scrollTop / ITEM_H)
    const i = ((row % n) + n) % n
    // Ушли в крайние копии — возвращаемся на ту же строку середины. Человек
    // ничего не замечает: значение под полосой то же самое.
    if (row < n || row >= (repeats - 1) * n) {
      const want = middle + i
      el.scrollTo({ top: want * ITEM_H, behavior: "auto" })
      paint(want)
    }
    if (items[i] && items[i].value !== value) onChange(items[i].value)
  }

  function handleKey(e) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
    e.preventDefault()
    const next = (index + (e.key === "ArrowDown" ? 1 : -1) + n) % n
    onChange(items[next].value)
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
      <div ref={listRef} style={{ paddingTop: pad, paddingBottom: pad }}>
        {Array.from({ length: repeats * n }, (_, row) => {
          const item = items[row % n]
          return (
            <button
              key={row}
              type="button"
              role="option"
              aria-selected={row === middle + index}
              onClick={() => onChange(item.value)}
              className={ROW_OFF}
              style={{ height: ITEM_H, scrollSnapAlign: "center", opacity: 0.3, fontSize: 16 }}
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

// value — «ЧЧ:ММ».
export default function WheelPicker({ value, onChange, label = "Время" }) {
  // Последнее известное значение держим и в ссылке: две колонки могут прислать
  // изменение в одном такте, и вторая, читая значение из своего рендера,
  // вернула бы старые часы.
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
    const [ch, cm] = String(latest.current || "09:00").split(":").map((x) => Number(x) || 0)
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
