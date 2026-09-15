// Вид оценки: цвет плитки, чипа и подписи. Общий модуль, потому что оценку
// показывают и список работ ученика, и главная — двух палитр у одной пятёрки
// быть не должно.
export const GRADE_LOOK = {
  5: { tint: "glass-tint-green", accent: "text-green-600 dark:text-green-300", chip: "bg-green-500/18 text-green-700 dark:text-green-300 ring-1 ring-green-500/35", tile: "from-green-400/25 to-green-500/10 text-green-600 dark:text-green-300", note: "Отличная работа" },
  4: { tint: "glass-tint-blue",  accent: "text-blue-600 dark:text-blue-300",   chip: "bg-blue-500/18 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/35",    tile: "from-blue-400/25 to-blue-500/10 text-blue-600 dark:text-blue-300",    note: "Хорошая работа" },
  3: { tint: "glass-tint-amber", accent: "text-amber-600 dark:text-amber-300", chip: "bg-amber-500/18 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/35", tile: "from-amber-400/25 to-amber-500/10 text-amber-600 dark:text-amber-300", note: "Есть над чем поработать" },
  2: { tint: "glass-tint-red",   accent: "text-red-600 dark:text-red-300",     chip: "bg-red-500/18 text-red-700 dark:text-red-300 ring-1 ring-red-500/35",      tile: "from-red-400/25 to-red-500/10 text-red-600 dark:text-red-300",      note: "Разберём ошибки на уроке" },
}
export const GRADE_NEUTRAL = { tint: "glass-tint-green", accent: "text-green-600 dark:text-green-300", chip: "bg-green-500/18 text-green-700 dark:text-green-300 ring-1 ring-green-500/35", note: "" }
