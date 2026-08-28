// Блок тарифов страницы «Подписка»: центрированная шапка, переключатель
// периода со скользящей «таблеткой» и три карточки.
//
// Собран по образцу pricing-section из shadcn-блоков, но на своих токенах:
// стекло, акцент #007AFF, тонированная карточка старшего тарифа вместо
// bg-foreground (чёрная карточка в светлой теме слишком выбивалась),
// общий хук useAnimatedNumber вместо NumberFlow и CSS-переход вместо
// framer-motion (лишние зависимости ради одного блока не тянем). Стили — в index.css, раздел
// «Блок тарифов».
//
// Цены и состав тарифов сюда НЕ попадают: они живут в src/plans.js, общем
// с серверными функциями.

import Icon from "./Icon"
import { PLANS, PERIODS, priceOf, formatPrice } from "../plans"
import { useAnimatedNumber } from "../useAnimatedNumber"

// Переключатель периода: «таблетка» едет под кнопками, а не перекрашивается
// скачком. Две колонки одинаковой ширины — поэтому сдвиг ровно на 100%.
function PeriodTabs({ period, onChange }) {
  const ids = Object.values(PERIODS)
  const index = ids.findIndex((p) => p.id === period)

  return (
    <div
      className="relative inline-grid grid-cols-2 p-1 rounded-full bg-blue-500/[0.06] border border-blue-500/15 dark:bg-white/[0.08] dark:border-white/10"
      role="group"
      aria-label="Период оплаты"
    >
      <span className="period-pill" data-i={index} aria-hidden="true" />
      {ids.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          aria-pressed={period === p.id}
          className={`no-press relative z-10 flex items-center justify-center gap-2 px-4 sm:px-5 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 ${
            period === p.id ? "text-gray-700" : "text-gray-500 hover:text-gray-600"
          }`}
        >
          {p.label}
          {p.id === "year" && (
            <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF] ring-1 ring-inset ring-[#007AFF]/20 whitespace-nowrap">
              −2 месяца
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function PlanCard({ plan, period, currentId, active, busy, onBuy }) {
  const isCurrent = plan.id === currentId
  const price = priceOf(plan.id, period)
  const free = plan.price.month === 0
  const monthly = period === "year" && !free ? Math.round(price / 12) : null
  const shown = useAnimatedNumber(price)
  const premium = Boolean(plan.highlighted)   // старший тариф: тонированная карточка

  const label = free
    ? (isCurrent ? "Текущий тариф" : "Базовый доступ")
    : isCurrent && active ? "Продлить"
    : "Перейти"

  return (
    <div
      className={`plan-card p-5 flex flex-col h-full relative ${
        premium ? "plan-premium" : "glass"
      } ${plan.popular ? "plan-popular ring-2 ring-[#007AFF]/35" : ""}`}
    >
      {plan.popular && (
        <span className="absolute -top-2.5 left-5 text-[11px] font-medium text-white px-2.5 py-1 rounded-full"
          style={{ background: "linear-gradient(135deg, #0A84FF 0%, #0060DF 100%)" }}>
          Чаще всего берут
        </span>
      )}

      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-medium">{plan.name}</h3>
        {isCurrent && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/12 text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-500/25">
            Ваш
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 leading-relaxed mb-4 md:min-h-[36px]">{plan.tagline}</p>

      {/* Высота фиксирована с ряда в три колонки: при переключении периода
          строка «≈ … в месяц» появляется и исчезает, и без этого цены съезжали
          бы относительно соседних карточек. На мобильном карточки идут одна под
          другой — там фиксация только добавила бы пустоту. */}
      <div className="mb-4 md:h-[52px]">
        <div className="text-2xl font-medium tabular-nums">
          {formatPrice(shown)}
          {!free && <span className="text-sm font-normal text-gray-400"> / {PERIODS[period].short}</span>}
        </div>
        {monthly && (
          <div className="text-xs text-gray-400 mt-0.5 tabular-nums">
            ≈ {monthly.toLocaleString("ru-RU")} ₽ в месяц
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-2 mb-5">
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-sm text-gray-600">
            <Icon name="check" size={14} className="mt-0.5 shrink-0 text-[#007AFF]" />
            <span className="leading-snug">{h}</span>
          </li>
        ))}
      </ul>

      {/* У бесплатного тарифа список короткий — без этой строки под ним зияла бы
          пустота, а главное, было бы непонятно, что именно он НЕ умеет. */}
      {free && (
        <p className="-mt-3 mb-5 text-xs text-gray-400 leading-relaxed">
          Задания, финансы, банк заданий, доска и аналитика открываются на «Про».
        </p>
      )}

      <button
        onClick={() => onBuy(plan.id)}
        disabled={free || busy}
        className={`group mt-auto w-full py-2.5 rounded-full text-sm font-medium transition-all disabled:opacity-45 disabled:cursor-default flex items-center justify-center gap-1.5 ${
          free
            ? "text-[#007AFF] bg-[#007AFF]/10 ring-1 ring-inset ring-[#007AFF]/25"
            : premium ? "pc-btn" : "text-white"
        }`}
        style={free || premium
          ? undefined
          : { background: "linear-gradient(135deg, #0A84FF 0%, #0060DF 100%)", boxShadow: "0 6px 18px rgba(0,122,255,0.28)" }}
      >
        {busy ? "Открываем оплату…" : (
          <>
            {label}
            {!free && <Icon name="arrow" size={15} className="transition-transform duration-300 group-hover:translate-x-0.5" />}
          </>
        )}
      </button>
    </div>
  )
}

export default function PricingPlans({ period, onPeriod, currentId, active, busy, onBuy }) {
  return (
    <div className="relative">
      <div className="pricing-bg" aria-hidden="true" />

      <div className="relative z-10">
        <div className="text-center mb-6 sm:mb-7">
          <h3 className="text-xl sm:text-2xl font-medium">Тарифы</h3>
          <p className="text-sm text-gray-500 mt-2">
            Год стоит как десять месяцев вместо двенадцати. Тариф можно сменить в любой момент.
          </p>
          <div className="mt-5 flex justify-center">
            <PeriodTabs period={period} onChange={onPeriod} />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 items-stretch">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              period={period}
              currentId={currentId}
              active={active}
              busy={busy === plan.id}
              onBuy={onBuy}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
