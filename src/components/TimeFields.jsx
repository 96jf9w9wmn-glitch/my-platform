// Время и длительность занятия — нативные поля вместо самодельной крутилки ▲▼:
// та занимала три строки на КАЖДОЕ занятие, и расписание из пяти дат
// превращалось в экран прокрутки.
//
// Живут отдельным файлом, потому что расписание ставится из двух мест —
// карточки ученика и группы, — и поля обязаны быть одними и теми же.

import { DURATIONS } from "../recurring"

export function TimeField({ value, onChange }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-glass !w-auto flex-shrink-0 px-2.5 py-1.5 text-sm tabular-nums" />
  )
}

export function DurationField({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="input-glass !w-auto flex-shrink-0 px-2.5 py-1.5 text-sm">
      {DURATIONS.map((d) => <option key={d} value={d}>{d} мин</option>)}
    </select>
  )
}
