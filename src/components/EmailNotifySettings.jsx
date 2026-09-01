// Дублирование уведомлений репетитора на почту.
//
// Почта спрашивается при регистрации, но до этого использовалась только для
// входа: колокольчик в кабинете видит лишь тот, кто в кабинет зашёл, — то есть
// про сданное ДЗ или новую заявку репетитор узнавал, только открыв вкладку.
// Письмо шлёт сервер по очереди, которую наполняет база (supabase/email_notify.sql).
//
// Пока миграция не выполнена, колонки email_notify нет — карточка просто не
// показывается, а не сыпет ошибками.
import { useState, useEffect } from "react"
import { supabase } from "../supabase"

export default function EmailNotifySettings({ tutorId, email, onChange }) {
  const [value, setValue] = useState(null)   // null — грузим либо колонки нет
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!tutorId) return
    let cancelled = false
    supabase.from("tutors").select("email_notify").eq("id", tutorId).maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled || err || !data) return
        setValue(!!data.email_notify)
      })
    return () => { cancelled = true }
  }, [tutorId])

  if (value === null) return null

  async function toggle() {
    const next = !value
    setValue(next)
    setSaving(true)
    const { error: err } = await supabase.from("tutors").update({ email_notify: next }).eq("id", tutorId)
    setSaving(false)
    if (err) { setValue(!next); setError("Не удалось сохранить — попробуйте ещё раз."); return }
    setError("")
    onChange?.({ email_notify: next })
  }

  return (
    <div className="glass p-5">
      <h2 className="text-base font-medium mb-1">Уведомления на почту</h2>
      <p className="text-xs text-gray-500 mb-4">
        То же, что показывает колокольчик: сданные работы, заявки учеников, сообщения в чате.
        Письмо приходит на {email || "вашу почту"}. Переписка в чате шлётся не чаще раза в
        четверть часа — иначе разговор превратился бы в десяток писем.
      </p>
      <button
        onClick={toggle}
        disabled={saving}
        role="switch"
        aria-checked={value}
        className="flex items-center gap-3 text-sm text-gray-600 active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        <span
          className={`w-11 h-6 rounded-full p-0.5 flex transition-colors ${
            value ? "bg-[#007AFF]" : "bg-blue-500/15 ring-1 ring-inset ring-blue-500/25 dark:bg-white/[0.16] dark:ring-white/20"
          }`}
        >
          <span className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : ""}`} />
        </span>
        {value ? "Дублируются на почту" : "Только в кабинете"}
      </button>
      {error && <div className="text-xs text-red-500 mt-2">{error}</div>}
    </div>
  )
}
