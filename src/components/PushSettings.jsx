// Уведомления на устройство (push).
//
// Зачем отдельно от почты. Колокольчик видит только тот, кто открыл кабинет, а
// письмо репетитор прочитает, когда дойдёт до почты. У ученика нет и письма:
// адрес у него не спрашивается вовсе. При этом iOS выгружает фоновую вкладку
// постоянно, то есть «приложение открыто» — состояние редкое. Push — то
// единственное, что доходит при закрытом приложении.
//
// Разрешение спрашивается ТОЛЬКО по нажатию и ровно один раз: отказ уже не
// переспросить из кода, только через настройки устройства. Поэтому текст
// объясняет, на что человек соглашается, до нажатия, а не после.
//
// Пока ключи VAPID на сервере не заданы, `/api/push` отвечает `push:false` —
// карточка не показывается вовсе, а не предлагает кнопку в никуда.
import { useState, useEffect } from "react"
import {
  pushSupported, pushBlockedReason, pushAvailable,
  currentSubscription, subscribePush, unsubscribePush, isIOS, isStandalone,
} from "../push"

export default function PushSettings({ userId, informal = false }) {
  const [ready, setReady] = useState(false)   // сервер умеет рассылать
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    pushAvailable().then(async (key) => {
      if (cancelled || !key) return
      setReady(true)
      const sub = await currentSubscription()
      if (!cancelled) setOn(!!sub)
    })
    return () => { cancelled = true }
  }, [])

  if (!ready) return null

  const blocked = pushBlockedReason()
  // На iPhone во вкладке браузера подписаться нельзя в принципе — вместо
  // неработающей кнопки показываем, что для этого сделать.
  const needsHomeScreen = isIOS() && !isStandalone() && !pushSupported()

  async function toggle() {
    setBusy(true)
    setError("")
    try {
      if (on) { await unsubscribePush(); setOn(false) }
      else { await subscribePush(userId); setOn(true) }
    } catch (e) {
      setError(e.message || "Не получилось — попробуйте ещё раз.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass p-5">
      <h2 className="text-base font-medium mb-1">Уведомления на устройство</h2>
      <p className="text-xs text-gray-500 mb-4">
        То же, что показывает колокольчик, но приходит и когда приложение закрыто.
        {informal
          ? " Уведомление появится на экране телефона — открывать сайт для этого не нужно."
          : " Уведомление появится на экране телефона — открывать кабинет для этого не нужно."}
      </p>

      {needsHomeScreen ? (
        <p className="text-xs text-gray-500 ring-1 ring-gray-200/70 dark:ring-white/10 rounded-xl p-3">
          На iPhone уведомления приходят только в приложении с экрана «Домой».
          {informal ? " Нажми " : " Нажмите "}
          «Поделиться» → «На экран „Домой“»
          {informal ? " и заходи оттуда." : " и заходите оттуда."}
        </p>
      ) : blocked ? (
        <p className="text-xs text-gray-500 ring-1 ring-gray-200/70 dark:ring-white/10 rounded-xl p-3">
          {blocked}
        </p>
      ) : (
        <button
          onClick={toggle}
          disabled={busy}
          role="switch"
          aria-checked={on}
          className="flex items-center gap-3 text-sm text-gray-600 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          <span
            className={`w-11 h-6 rounded-full p-0.5 flex transition-colors ${
              on ? "bg-[#007AFF]" : "bg-blue-500/15 ring-1 ring-inset ring-blue-500/25 dark:bg-white/[0.16] dark:ring-white/20"
            }`}
          >
            <span className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
          </span>
          {on ? "Приходят на это устройство" : "Только в кабинете"}
        </button>
      )}

      {error && <div className="text-xs text-red-500 mt-2">{error}</div>}
    </div>
  )
}
