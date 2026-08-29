import Icon from "./Icon"
import { BETA, BETA_LABEL, BETA_NOTE, BETA_ASK } from "../beta"

/* Метка «Бета» рядом с названием сервиса.
   Мягкая заливка с кольцом, как у остальных статусных чипов интерфейса: она
   сообщает состояние, а не зовёт нажать, поэтому без анимации и без тени.
   tone="onColor" — вариант для цветной шапки (белый на полупрозрачном).
   size="xs" — для узких мест (боковое меню шириной 13rem), где полный бейдж
   отодвинул бы название за край. */
function BetaBadge({ tone = "soft", size = "sm", className = "" }) {
  if (!BETA) return null
  const skin = tone === "onColor"
    ? "bg-white/20 text-white ring-white/30"
    : "bg-[#007AFF]/10 text-[#007AFF] ring-[#007AFF]/20 dark:bg-[#0A84FF]/15 dark:text-[#4DA3FF] dark:ring-[#0A84FF]/30"
  const box = size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
  return (
    <span
      className={`inline-flex items-center flex-shrink-0 rounded-full ring-1 font-semibold uppercase tracking-wider leading-none ${box} ${skin} ${className}`}
    >
      {BETA_LABEL}
    </span>
  )
}

/* Плашка с пояснением, что идёт бета: ставится там, где у текста есть место
   на две строки — лендинг, подвал, экран тарифов. Бейджа рядом с логотипом
   мало: «Бета» без объяснения не говорит, чего ждать. */
export function BetaNotice({ className = "" }) {
  if (!BETA) return null
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 ring-[#007AFF]/15 bg-[#007AFF]/[0.06] dark:ring-[#0A84FF]/25 dark:bg-[#0A84FF]/10 ${className}`}
    >
      <span className="mt-px flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#0A84FF]/20 dark:text-[#4DA3FF]">
        <Icon name="flask" size={15} />
      </span>
      <p className="text-[13px] leading-snug text-gray-600">
        <span className="font-semibold text-gray-800">Идёт бета-тестирование. </span>
        {BETA_NOTE} {BETA_ASK}
      </p>
    </div>
  )
}

export default BetaBadge
