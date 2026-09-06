import { useState } from "react"
import Collapse from "./Collapse"

// Срок сдачи: чипы на частые случаи, календарь — на редкий. Общий для
// домашней работы и варианта: срок в обоих разделах ставится одинаково, и
// вторая копия чипов разошлась бы с первой при первой же правке.
//
// Дата собирается по МЕСТНОМУ времени, а не через toISOString: у него UTC, и
// вечером в Москве срок сдвинулся бы на день назад.
function isoDay(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const CHIPS = [
  { label: "Без срока", days: null },
  { label: "Завтра", days: 1 },
  { label: "3 дня", days: 3 },
  { label: "Неделя", days: 7 },
]

const chipCls = (on) =>
  `px-3 py-1.5 rounded-full text-xs transition-all active:scale-[0.94] ${
    on
      ? "bg-blue-600 text-white shadow-sm"
      : "text-gray-600 ring-1 ring-gray-200 dark:ring-white/15 hover:ring-gray-300"
  }`

export default function DeadlinePicker({ value, onChange, label = "Срок сдачи" }) {
  // Дата, не совпавшая ни с одним чипом (правка старой работы), сразу
  // открывает календарь: иначе выбранный срок нигде не виден.
  const [pickDate, setPickDate] = useState(
    () => !!value && !CHIPS.some((c) => c.days != null && isoDay(c.days) === value),
  )
  return (
    <div>
      <div className="text-sm text-gray-500 mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((c) => {
          const chipValue = c.days == null ? "" : isoDay(c.days)
          return (
            <button key={c.label} type="button" onClick={() => { onChange(chipValue); setPickDate(false) }}
              className={chipCls(!pickDate && value === chipValue)}>
              {c.label}
            </button>
          )
        })}
        <button type="button" onClick={() => setPickDate(true)} className={chipCls(pickDate)}>
          Другая дата
        </button>
      </div>
      <Collapse open={pickDate}>
        <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
          className="input-glass mt-2" />
      </Collapse>
    </div>
  )
}
