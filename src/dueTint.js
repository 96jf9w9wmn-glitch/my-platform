import { parseLocalDate } from "./utils"

// Тинты плиток на карточках заданий: единые для кабинета репетитора и ученика.
// В отдельном модуле, а не в DateTile.jsx — react-refresh требует, чтобы файл
// компонента экспортировал только компоненты.
export const TILE_TINTS = {
  red: "from-red-400/25 to-red-500/10 text-red-600 dark:text-red-300",
  amber: "from-amber-400/25 to-amber-500/10 text-amber-600 dark:text-amber-300",
  blue: "from-blue-400/25 to-blue-500/10 text-blue-600 dark:text-blue-300",
  indigo: "from-indigo-400/25 to-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  green: "from-green-400/25 to-green-500/10 text-green-600 dark:text-green-300",
}

// Срочность срока: прошёл — красный, сегодня-завтра — янтарный, дальше — синий.
export function dueTintKey(deadline) {
  const d = parseLocalDate(deadline)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((d - today) / 86400000)
  if (days < 0) return "red"
  if (days <= 1) return "amber"
  return "blue"
}
