// Подписка репетитора на клиенте: контекст, хуки и загрузка состояния.
// Сам провайдер — в subscriptionProvider.jsx (файл с компонентом держим
// отдельно, иначе ломается fast refresh).
//
// Контекст, а не проп через пять экранов: тариф спрашивают Ученики, Задания,
// Варианты, Финансы и карточка ученика.
//
// Важно про честность ограничений: всё, что здесь, — интерфейсные подсказки.
// Настоящая защита стоит на сервере (api/plan-gate.js), потому что клиенту
// можно подменить что угодно. Здесь мы избавляем репетитора от тупика
// «нажал — получил 403», а не защищаем платформу.

import { createContext, useContext } from "react"
import { supabase } from "./supabase"
import { can, limitOf, effectivePlan, withinLimit } from "./plans"

export const SubscriptionCtx = createContext({
  sub: null,
  usage: null,
  installed: true,
  loading: true,
  reload: () => {},
  openPlans: () => {},
})

// Миграции subscriptions.sql может ещё не быть: тогда биллинг не установлен и
// ограничивать нельзя — иначе невыполненная миграция молча выключила бы
// половину приложения.
const MISSING = new Set(["42P01", "PGRST205", "PGRST106", "PGRST202"])

// Первое число текущего месяца — ключ строки расхода (по местному времени,
// как его видит репетитор).
function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

// Состояние подписки одним запросом. Чистая функция: ничего не пишет в стейт,
// поэтому её одинаково зовут и провайдер, и ручное обновление после оплаты.
export function fetchPlanState(tutorId) {
  return Promise.all([
    supabase.from("tutor_subscriptions")
      .select("plan, status, current_period_end")
      .eq("tutor_id", tutorId)
      .maybeSingle(),
    supabase.from("tutor_usage")
      .select("ai_homework, period")
      .eq("tutor_id", tutorId)
      .eq("period", currentPeriod())
      .maybeSingle(),
  ]).then(([{ data: sub, error }, { data: usage }]) => {
    if (error && MISSING.has(error.code)) return { installed: false, sub: null, usage: null }
    return { installed: true, sub: sub || null, usage: usage || null }
  })
}

export function useSubscription() {
  return useContext(SubscriptionCtx)
}

// Доступна ли возможность. Пока биллинг не установлен — доступно всё, ровно
// как и на сервере: это состояние «оплата не подключена», а не «тариф Старт».
export function usePlan() {
  const { sub, installed, usage, openPlans, reload, loading } = useSubscription()
  return {
    sub,
    usage,
    installed,
    loading,
    reload,
    openPlans,
    plan: effectivePlan(sub),
    allows: (feature) => !installed || can(sub, feature),
    limit: (key) => (installed ? limitOf(sub, key) : -1),
    within: (key, current) => !installed || withinLimit(sub, key, current),
  }
}
