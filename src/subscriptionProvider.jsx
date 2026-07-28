// Провайдер подписки: один загрузчик тарифа на весь кабинет репетитора.
// Контекст и хуки — в subscription.js.

import { useCallback, useEffect, useState } from "react"
import { SubscriptionCtx, fetchPlanState } from "./subscription"

export function SubscriptionProvider({ tutorId, onOpenPlans, children }) {
  const [state, setState] = useState({ sub: null, usage: null, installed: true })
  const [loading, setLoading] = useState(Boolean(tutorId))

  const reload = useCallback(() => {
    if (!tutorId) return Promise.resolve()
    return fetchPlanState(tutorId).then((next) => {
      setState(next)
      setLoading(false)
    })
  }, [tutorId])

  useEffect(() => { reload() }, [reload])

  const value = {
    // Пока биллинг не установлен, подписки нет и быть не может — отдаём null,
    // а решение «ограничивать или нет» принимает usePlan по флагу installed.
    sub: state.installed ? state.sub : null,
    usage: state.usage,
    installed: state.installed,
    loading,
    reload,
    openPlans: onOpenPlans || (() => {}),
  }

  return <SubscriptionCtx.Provider value={value}>{children}</SubscriptionCtx.Provider>
}
