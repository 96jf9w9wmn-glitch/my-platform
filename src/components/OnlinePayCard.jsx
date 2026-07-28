import { useState, useEffect, useMemo } from "react"
import Icon from "./Icon"
import { supabase } from "../supabase"

// Онлайн-оплата занятий в кабинете ученика.
//
// Деньги идут напрямую репетитору (его магазин ЮKassa) — платформа только
// заводит заказ на сервере и уводит на страницу оплаты. Сумму здесь НЕ
// отправляем: клиентское число сервер всё равно проигнорирует и посчитает
// стоимость сам по карточке ученика. Кнопка показывает ту же арифметику,
// чтобы ученик видел, за что платит.
//
// Карточки нет вовсе, пока репетитор не включил приём оплаты
// (tutor_payment_settings.online_enabled) — см. supabase/yookassa.sql.

const PRESETS = [1, 2, 4, 8]
const fmt = (n) => Math.round(n || 0).toLocaleString("ru-RU")

export default function OnlinePayCard({ user, student, debt = 0 }) {
  const [settings, setSettings] = useState(null)
  const [picked, setPicked] = useState(null)   // null = ученик ещё не выбирал, показываем подсказанное
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState(null)   // статус вернувшегося платежа

  const tutorId = user?.profile?.tutor_id
  const price = Number(student?.lessonPrice || 0)

  useEffect(() => {
    if (!tutorId) return
    let alive = true
    supabase.rpc("payment_settings_public", { p_tutor: tutorId }).then(({ data }) => {
      if (alive) setSettings(Array.isArray(data) ? data[0] : data)
    }).catch(() => { /* миграция ещё не выполнена — карточки просто нет */ })
    return () => { alive = false }
  }, [tutorId])

  // Возврат с оплаты: ЮKassa приводит на /?pay=<id заказа>. Статус спрашиваем
  // у базы, а не у адресной строки — в ней может быть что угодно.
  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("pay")
    if (!orderId || !user?.id || !user?.token) return
    window.history.replaceState({}, "", window.location.pathname)
    let tries = 0
    const check = () => {
      supabase.rpc("payment_order_list", { p_account: user.id, p_token: user.token }).then(({ data }) => {
        const order = (data || []).find((o) => o.id === orderId)
        if (!order) return
        if (order.status === "pending" && tries++ < 5) {
          setResult({ status: "pending", amount: order.amount })
          setTimeout(check, 2000)   // вебхук может прийти на секунду-другую позже возврата
          return
        }
        setResult({ status: order.status, amount: order.amount })
      }).catch(() => { /* нет миграции — молчим */ })
    }
    check()
  }, [user?.id, user?.token])

  const maxLessons = settings?.max_lessons || 10
  // По умолчанию предлагаем закрыть долг целиком — это то, зачем сюда заходят.
  const suggested = useMemo(() => {
    if (!(price > 0) || debt <= 0) return 1
    return Math.min(Math.max(1, Math.ceil(debt / price)), maxLessons)
  }, [price, debt, maxLessons])

  // Пока ученик не трогал выбор, показываем подсказанное количество — так число
  // остаётся живым, когда репетитор проведёт ещё занятие и долг вырастет.
  const lessons = Math.min(Math.max(picked ?? suggested, 1), maxLessons)

  if (!settings?.online_enabled || !(price > 0)) return null

  const amount = price * lessons
  const presets = [...new Set([...PRESETS, suggested])].filter((n) => n >= 1 && n <= maxLessons).sort((a, b) => a - b)

  async function pay() {
    setBusy(true)
    setError("")
    try {
      const r = await fetch("/api/yookassa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: user.id, token: user.token, lessons }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.confirmationUrl) {
        setError(j.error || "Не получилось создать платёж")
        setBusy(false)
        return
      }
      window.location.href = j.confirmationUrl
    } catch {
      setError("Нет связи с сервером оплаты")
      setBusy(false)
    }
  }

  return (
    <div className="glass p-5">
      {result && (
        <div className={`mb-4 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm ring-1 ${
          result.status === "succeeded"
            ? "bg-green-50 text-green-700 ring-green-200 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-500/25"
            : result.status === "canceled"
              ? "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25"
              : "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/25"
        }`}>
          <Icon name={result.status === "succeeded" ? "check" : result.status === "canceled" ? "x" : "clock"} size={18} className="mt-0.5 shrink-0" />
          <div>
            {result.status === "succeeded" && <>Оплата на {fmt(result.amount)} ₽ прошла — платёж уже в истории.</>}
            {result.status === "canceled" && <>Платёж не прошёл. Деньги не списаны, можно попробовать снова.</>}
            {result.status === "pending" && <>Ждём подтверждение банка. Обычно это занимает несколько секунд.</>}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-base font-medium">Оплатить онлайн</h2>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/25">ЮKassa</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {settings.note || "Картой или через СБП. Деньги уходят напрямую репетитору."}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPicked(n)}
            className={`no-press px-3.5 py-1.5 rounded-full text-sm font-medium transition-all active:scale-[0.94] ring-1 ${
              lessons === n
                ? "bg-[#007AFF] text-white ring-[#007AFF]"
                : "bg-white/60 text-gray-600 ring-gray-200 hover:bg-white dark:bg-white/5 dark:ring-white/10"
            }`}
          >
            {n} зан.
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPicked(Math.max(1, lessons - 1))}
            disabled={lessons <= 1}
            className="no-press w-9 h-9 rounded-full grid place-items-center ring-1 ring-gray-200 bg-white/60 text-gray-600 disabled:opacity-40 transition-all active:scale-[0.9] dark:bg-white/5 dark:ring-white/10"
            aria-label="Меньше занятий"
          >
            <Icon name="minus" size={16} />
          </button>
          <div className="w-12 text-center text-sm font-medium">{lessons}</div>
          <button
            type="button"
            onClick={() => setPicked(Math.min(maxLessons, lessons + 1))}
            disabled={lessons >= maxLessons}
            className="no-press w-9 h-9 rounded-full grid place-items-center ring-1 ring-gray-200 bg-white/60 text-gray-600 disabled:opacity-40 transition-all active:scale-[0.9] dark:bg-white/5 dark:ring-white/10"
            aria-label="Больше занятий"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold leading-none bg-gradient-to-r from-[#007AFF] to-[#5856D6] bg-clip-text text-transparent">
            {fmt(amount)} ₽
          </div>
          <div className="text-[11px] text-gray-400 mt-1">{fmt(price)} ₽ за занятие</div>
        </div>
      </div>

      {error && <div className="text-xs text-red-500 mb-3">{error}</div>}

      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="press-fill w-full py-3 rounded-2xl text-sm font-medium text-white bg-gradient-to-r from-[#007AFF] to-[#5856D6] disabled:opacity-60 transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
      >
        {busy ? "Открываем оплату…" : <>Оплатить {fmt(amount)} ₽</>}
      </button>
      <p className="text-[11px] text-gray-400 text-center mt-2.5">
        Оплата на защищённой странице ЮKassa. Данные карты платформа не видит.
      </p>
    </div>
  )
}
