// Страница «Подписка»: три тарифа, текущий статус, расход лимитов и история оплат.
//
// Деньги идут платформе (магазин ЮKassa платформы, см. api/subscription.js).
// Сумму считает сервер по src/plans.js — здесь цены только показываются.
//
// Пока миграция subscriptions.sql не выполнена или не заданы ключи магазина,
// страница не притворяется рабочей: тарифы видно, кнопки оплаты честно
// сообщают, чего не хватает.

import { useEffect, useState } from "react"
import Icon from "../components/Icon"
import { supabase } from "../supabase"
import { useSubscription } from "../subscription"
import { MarketingToggle } from "../components/ConsentChecks"
import TelegramSettings from "../components/TelegramSettings"
import {
  PLANS, PERIODS, FEATURE_ROWS, UNLIMITED,
  effectivePlanId, isActive, formatLimit, formatPrice, priceOf, planById,
} from "../plans"

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : ""

const ORDER_STATUS = {
  succeeded: { label: "Оплачен", cls: "bg-green-500/12 text-green-700 dark:text-green-300 ring-green-500/20" },
  pending: { label: "Ожидает", cls: "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/20" },
  canceled: { label: "Отменён", cls: "bg-gray-500/10 text-gray-500 ring-gray-500/20" },
}

// Полоска расхода лимита. limit === −1 — «без ограничений», полоску не рисуем.
function UsageBar({ label, used, limit }) {
  if (limit === UNLIMITED) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs font-medium text-gray-600 tabular-nums">{used} · без ограничений</span>
      </div>
    )
  }
  // Лимит 0 — возможности нет на тарифе вовсе. Полоска «на весь красный» тут
  // врала бы: это не исчерпанный лимит, а невключённая возможность.
  if (limit === 0) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs text-gray-400">не входит в тариф</span>
      </div>
    )
  }
  const share = Math.min(100, Math.round((used / limit) * 100))
  const tight = share >= 90
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`text-xs font-medium tabular-nums ${tight ? "text-amber-600 dark:text-amber-300" : "text-gray-600"}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.10] overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${tight ? "bg-amber-500" : "bg-[#007AFF]"}`}
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  )
}

function PlanCard({ plan, period, currentId, active, busy, onBuy }) {
  const isCurrent = plan.id === currentId
  const price = priceOf(plan.id, period)
  const free = plan.price.month === 0
  const monthly = period === "year" && !free ? Math.round(price / 12) : null

  const label = free
    ? (isCurrent ? "Текущий тариф" : "Базовый доступ")
    : isCurrent && active ? "Продлить"
    : "Перейти"

  return (
    <div
      className={`glass p-5 flex flex-col h-full relative ${plan.popular ? "ring-2 ring-[#007AFF]/35" : ""}`}
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
      <p className="text-xs text-gray-500 leading-relaxed mb-4">{plan.tagline}</p>

      <div className="mb-4">
        <div className="text-2xl font-medium tabular-nums">
          {formatPrice(price)}
          {!free && <span className="text-sm text-gray-400 font-normal"> / {PERIODS[period].short}</span>}
        </div>
        {monthly && <div className="text-xs text-gray-400 mt-0.5 tabular-nums">≈ {monthly.toLocaleString("ru-RU")} ₽ в месяц</div>}
      </div>

      <ul className="flex flex-col gap-2 mb-5">
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-sm text-gray-600">
            <Icon name="check" size={14} className="mt-0.5 shrink-0 text-[#007AFF]" />
            <span className="leading-snug">{h}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onBuy(plan.id)}
        disabled={free || busy}
        className={`mt-auto w-full py-2.5 rounded-full text-sm font-medium transition-all disabled:opacity-45 disabled:cursor-default ${
          free ? "text-[#007AFF] bg-[#007AFF]/10 ring-1 ring-inset ring-[#007AFF]/25" : "text-white"
        }`}
        style={free
          ? undefined
          : { background: "linear-gradient(135deg, #0A84FF 0%, #0060DF 100%)", boxShadow: "0 6px 18px rgba(0,122,255,0.28)" }}
      >
        {busy ? "Открываем оплату…" : label}
      </button>
    </div>
  )
}

export default function Subscription({ studentsCount = 0, tutorId }) {
  const { sub, usage, installed, reload } = useSubscription()
  const [period, setPeriod] = useState("month")
  const [health, setHealth] = useState(null)
  const [orders, setOrders] = useState([])
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  // Возврат с оплаты: ?sub=<id заказа>. Ждём вебхук — он приходит за секунды.
  const [pendingOrder] = useState(() => new URLSearchParams(window.location.search).get("sub"))
  const [result, setResult] = useState(null)   // "succeeded" | "canceled" | "slow"
  const checking = Boolean(pendingOrder) && !result

  const currentId = effectivePlanId(sub)
  const active = isActive(sub)
  const studentsLimit = planById(currentId).limits.students
  const aiLimit = planById(currentId).limits.aiHomework

  useEffect(() => {
    fetch("/api/subscription").then((r) => r.json()).then(setHealth).catch(() => setHealth({ ok: false }))
  }, [])

  useEffect(() => {
    if (!installed) return
    supabase.from("subscription_orders")
      .select("id, plan, period, amount, status, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => { if (data) setOrders(data) })
  }, [installed, result])

  // Проверка результата оплаты. Тариф выдаёт вебхук, а не редирект плательщика,
  // поэтому статус спрашиваем у заказа, а не верим адресной строке.
  useEffect(() => {
    if (!pendingOrder) return
    let alive = true
    let timer = null

    // Вебхук приходит за секунды, но банк иногда думает дольше: спрашиваем
    // заказ раз в две секунды и через ~16 с честно говорим «ждём подтверждения».
    const check = (attempt) => {
      supabase.from("subscription_orders")
        .select("status").eq("id", pendingOrder).maybeSingle()
        .then(({ data }) => {
          if (!alive) return
          if (data?.status && data.status !== "pending") {
            setResult(data.status)
            reload()
            return
          }
          if (attempt >= 8) {
            setResult("slow")
            return
          }
          timer = setTimeout(() => check(attempt + 1), 2000)
        })
    }
    check(0)

    // Адрес чистим сразу: перезагрузка страницы не должна снова открывать проверку.
    window.history.replaceState({}, "", window.location.pathname)
    return () => { alive = false; clearTimeout(timer) }
  }, [pendingOrder, reload])

  async function buy(planId) {
    setError("")
    setBusy(planId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setError("Сессия истекла — войдите заново")
        return
      }
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId, period }),
      })
      const data = await res.json()
      if (!res.ok || !data.confirmationUrl) {
        setError(data.detail ? `${data.error}: ${data.detail}` : data.error || "Не удалось открыть оплату")
        return
      }
      window.location.href = data.confirmationUrl
    } catch (e) {
      setError("Сеть недоступна: " + String(e?.message || e))
    } finally {
      setBusy("")
    }
  }

  const notReady = health && !health.ok

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-medium mb-1">Подписка</h1>
      <p className="text-sm text-gray-500 mb-5 sm:mb-6">
        Тариф определяет, сколько у вас может быть учеников и какие возможности платформы включены.
      </p>

      {/* Результат возврата с оплаты */}
      {checking && (
        <div className="glass-tint-blue px-4 py-3 mb-4 flex items-center gap-2.5 text-sm text-[#007AFF]">
          <span className="loader-dots"><i /><i /><i /></span>
          Проверяем оплату…
        </div>
      )}
      {result === "succeeded" && (
        <div className="glass-tint-green px-4 py-3 mb-4 flex items-center gap-2.5 text-sm text-green-700 dark:text-green-300">
          <Icon name="check" size={15} /> Оплата прошла, тариф обновлён.
        </div>
      )}
      {result === "canceled" && (
        <div className="glass-tint-amber px-4 py-3 mb-4 text-sm text-amber-600 dark:text-amber-300">
          Платёж отменён — тариф не изменился.
        </div>
      )}
      {result === "slow" && (
        <div className="glass-tint-amber px-4 py-3 mb-4 text-sm text-amber-600 dark:text-amber-300">
          Банк ещё не подтвердил платёж. Тариф включится сам, как только придёт подтверждение.
        </div>
      )}

      {/* Текущий тариф и расход лимитов */}
      <div className="glass p-5 mb-4 flex flex-col md:flex-row md:items-center gap-5">
        <div className="min-w-0 md:w-64">
          <div className="text-xs text-gray-500 mb-1.5">Текущий тариф</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-medium">{planById(currentId).name}</span>
            {active ? (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/12 text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-500/25">
                Активен
              </span>
            ) : sub ? (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-1 ring-inset ring-amber-500/25">
                Истёк
              </span>
            ) : null}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {active
              ? `Оплачен до ${fmtDate(sub.current_period_end)}`
              : sub?.current_period_end
              ? `Закончился ${fmtDate(sub.current_period_end)}`
              : "Бесплатный доступ без срока"}
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-3 md:border-l md:border-gray-100 dark:md:border-white/[0.08] md:pl-5">
          <UsageBar label="Учеников" used={studentsCount} limit={studentsLimit} />
          <UsageBar label="ИИ-генерации ДЗ в этом месяце" used={usage?.ai_homework || 0} limit={aiLimit} />
        </div>
      </div>

      {/* Телеграм-бот: тот же кабинет в телефоне. Стоит здесь, потому что это
          единственная страница про аккаунт репетитора, а сам бот — возможность
          тарифа «Про». */}
      <div className="mb-4">
        <TelegramSettings />
      </div>

      {/* Период оплаты */}
      <div className="flex items-center justify-center gap-1.5 mb-4">
        <div className="inline-flex p-1 rounded-full bg-black/[0.05] dark:bg-white/[0.08]">
          {Object.values(PERIODS).map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`no-press px-4 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 ${
                period === p.id ? "bg-white dark:bg-white/[0.14] shadow-sm text-gray-700" : "text-gray-500 hover:text-gray-600"
              }`}
            >
              {p.label}
              {p.id === "year" && <span className="ml-1.5 text-[11px] text-[#007AFF]">−2 мес.</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Тарифы */}
      <div className="grid md:grid-cols-3 gap-4 items-stretch mb-4">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            period={period}
            currentId={currentId}
            active={active}
            busy={busy === plan.id}
            onBuy={buy}
          />
        ))}
      </div>

      {error && (
        <div className="glass-tint-red px-4 py-3 mb-4 text-sm text-red-600 dark:text-red-300">{error}</div>
      )}
      {!installed && (
        <div className="glass-tint-amber px-4 py-3 mb-4 text-xs text-amber-600 dark:text-amber-300">
          Не выполнена миграция <span className="font-mono">supabase/subscriptions.sql</span> — подписку негде хранить.
          Пока она не выполнена, ограничения тарифов не применяются.
        </div>
      )}
      {notReady && (
        <div className="glass-tint-amber px-4 py-3 mb-4 text-xs text-amber-600 dark:text-amber-300">
          Оплата подписки не настроена: нет ключей магазина платформы. Инструкция — <span className="font-mono">docs/subscriptions.md</span>.
        </div>
      )}
      {health?.ok && health.mode === "test" && (
        <div className="text-[11px] text-gray-400 mb-4 flex items-center gap-1.5">
          <Icon name="alert-triangle" size={12} />
          Подключён тестовый магазин ЮKassa — реальные деньги не списываются.
        </div>
      )}

      {/* Сравнение тарифов */}
      <div className="glass p-5 mb-4 overflow-x-auto">
        <h2 className="text-base font-medium mb-4">Что входит</h2>
        <table className="w-full text-sm border-collapse min-w-[520px]">
          <thead>
            <tr className="text-xs text-gray-400">
              <th className="text-left font-normal pb-3">Возможность</th>
              {PLANS.map((p) => (
                <th key={p.id} className="font-medium pb-3 px-2 text-center text-gray-500">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROWS.map((row) => (
              <tr key={row.key} className="border-t border-gray-100 dark:border-white/[0.06]">
                <td className="py-2.5 pr-3 text-gray-600">{row.label}</td>
                {PLANS.map((p) => (
                  <td key={p.id} className="py-2.5 px-2 text-center">
                    {row.kind === "always" ? (
                      <Icon name="check" size={15} className="inline text-[#007AFF]" />
                    ) : row.kind === "limit" ? (
                      <span className="text-xs text-gray-600 tabular-nums">
                        {formatLimit(p.limits[row.key], row.suffix)}
                      </span>
                    ) : p.features[row.key] ? (
                      <Icon name="check" size={15} className="inline text-[#007AFF]" />
                    ) : (
                      <span className="text-gray-300 dark:text-white/20">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* История оплат */}
      {orders.length > 0 && (
        <div className="glass p-5">
          <h2 className="text-base font-medium mb-3">История оплат</h2>
          <div className="flex flex-col">
            {orders.map((o) => {
              const s = ORDER_STATUS[o.status] || ORDER_STATUS.pending
              return (
                <div key={o.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-100 dark:border-white/[0.06] last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {planById(o.plan).name} · {o.period === "year" ? "год" : "месяц"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(o.created_at).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${s.cls}`}>{s.label}</span>
                    <span className="text-sm font-medium tabular-nums">{Math.round(o.amount).toLocaleString("ru-RU")} ₽</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Единственная страница про аккаунт репетитора — здесь же и согласие на
          необязательную рассылку, которое мы больше не спрашиваем при регистрации. */}
      <div className="mt-4">
        <MarketingToggle table="tutors" id={tutorId} role="tutor" />
      </div>

      <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
        Оплата проходит через ЮKassa. Подписка не продлевается автоматически: когда срок закончится,
        доступ станет бесплатным «Стартом», а данные учеников останутся на месте.
      </p>
    </div>
  )
}
