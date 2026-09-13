// Чип-переключатель: выбранный — сплошной синий, остальные — кольцо без заливки
// (серая заливка на стеклянных карточках читается как выцветшее пятно).
// Общий для «Срока сдачи» и цели ученика: две копии этой строки разошлись бы
// при первой же правке палитры.
export const chipCls = (on) =>
  `px-3 py-1.5 rounded-full text-xs transition-all active:scale-[0.94] ${
    on
      ? "bg-blue-600 text-white shadow-sm"
      : "text-gray-600 ring-1 ring-gray-200 dark:ring-white/15 hover:ring-gray-300"
  }`
