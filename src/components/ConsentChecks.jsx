import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import { logConsent } from "../consents"

// Галочки согласий. Общий код для всех мест, где мы собираем персональные
// данные: регистрация (Auth), заявка с лендинга, вход родителя по коду,
// добавление ученика репетитором. Плюс переключатель необязательной рассылки —
// её спрашиваем уже в кабинете, чтобы не удлинять форму регистрации.
//
// Правило простое: собираем данные — значит показываем, на что человек
// соглашается, и фиксируем факт. Галочки НЕ проставлены заранее: с 01.09.2025
// согласие даётся активным действием, преднажатая галочка согласием не считается.

// Строка согласия: вся строка — переключатель, ссылки внутри открываются в новой
// вкладке и галочку не трогают. Без плашки-фона: на форме входа таких строк
// несколько, и карточка от них переставала помещаться на экран.
export function ConsentRow({ checked, onChange, accent = "from-blue-500 to-blue-600", children }) {
  return (
    <label
      className="group flex items-start gap-2.5 py-1 cursor-pointer select-none
                 transition-transform duration-150 active:scale-[0.985]"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`mt-0.5 w-[18px] h-[18px] shrink-0 rounded-md flex items-center justify-center
                    ring-1 transition-all duration-150 group-hover:ring-gray-400 dark:group-hover:ring-gray-500
                    group-active:scale-90 ${
          checked
            ? `bg-gradient-to-br ${accent} ring-transparent text-white shadow-sm`
            : "bg-white dark:bg-gray-800 ring-gray-300 dark:ring-gray-600 text-transparent"
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="text-[12px] leading-snug text-gray-500 dark:text-gray-400">{children}</span>
    </label>
  )
}

export function ConsentLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-blue-600 dark:text-blue-400 hover:opacity-70 transition-opacity underline underline-offset-2"
    >
      {children}
    </a>
  )
}

// Переключатель необязательной рассылки в кабинете. Текущее состояние берём из
// профиля, каждое переключение дополнительно пишем в журнал согласий — по нему
// видно, когда человек рассылку разрешил, а когда отозвал.
//
// Пока миграция user_consents.sql не выполнена, колонки marketing_opt_in нет —
// тогда блок просто не показывается, а не сыпет ошибками.
export function MarketingToggle({ table, id, role }) {
  const [value, setValue] = useState(null) // null — грузим либо колонки нет
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    supabase
      .from(table)
      .select("marketing_opt_in")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        setValue(!!data.marketing_opt_in)
      })
    return () => { cancelled = true }
  }, [table, id])

  if (value === null) return null

  async function toggle() {
    const next = !value
    setValue(next)
    setSaving(true)
    const { error } = await supabase.from(table).update({ marketing_opt_in: next }).eq("id", id)
    setSaving(false)
    if (error) { setValue(!next); return }
    // Отдельная запись именно про рассылку: обязательные согласия давались при
    // регистрации и здесь не переподтверждаются.
    logConsent({ role: `${role}_marketing`, subjectId: id, terms: false, personalData: false, marketing: next })
  }

  return (
    <div className="glass p-5">
      <h2 className="text-base font-medium mb-1">Письма и напоминания</h2>
      <p className="text-xs text-gray-500 mb-4">
        Напоминания о занятиях и новости сервиса. Необязательно — на работу кабинета не влияет.
      </p>
      <button
        onClick={toggle}
        disabled={saving}
        role="switch"
        aria-checked={value}
        className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        <span
          className={`w-11 h-6 rounded-full p-0.5 flex transition-colors ${
            value ? "bg-[#007AFF]" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : ""}`} />
        </span>
        {value ? "Получаю письма" : "Письма отключены"}
      </button>
    </div>
  )
}
