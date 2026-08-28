import { parseLocalDate } from "../utils"

// Плитка срока — якорь карточки задания, как у школьных сервисов (Satchel,
// Google Classroom): дата читается раньше названия, цвет говорит о срочности.
// Общая для кабинета репетитора и ученика, чтобы карточки не разъехались.
// Тинты и срочность — в src/dueTint.js.

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]

export default function DateTile({ date, tint, className = "" }) {
  const d = typeof date === "string" ? parseLocalDate(date) : date
  return (
    <div className={`shrink-0 rounded-2xl flex flex-col items-center justify-center bg-gradient-to-br ${tint} ${className}`}>
      <span className="text-base font-semibold leading-none tabular-nums">{d.getDate()}</span>
      <span className="text-[9px] font-medium uppercase tracking-wide mt-0.5 opacity-80">{MONTHS[d.getMonth()]}</span>
    </div>
  )
}
