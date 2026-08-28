// Раздел «Профиль»: всё про аккаунт репетитора в одном месте — карточка
// аккаунта, код для учеников, телеграм-бот и настройки приёма денег.
//
// Подписка отсюда ушла обратно на свою вкладку (звёздочка в верхней панели,
// рядом с аватаром): внизу страницы аккаунта тариф никто не находил.
// Ярлык тарифа в карточке ниже — ссылка туда же.
//
// Сюда же переехали настройки квитанций и онлайн-оплаты: на «Финансах» они
// стояли наравне с долгами и историей, хотя трогают их раз в жизни. Так же
// разделены и зарубежные сервисы — у TutorCruncher настройки биллинга лежат в
// General Accounting Settings, а не на экране с деньгами.

import { useState } from "react"
import Icon from "../components/Icon"
import { supabase } from "../supabase"
import { useSubscription } from "../subscription"
import { effectivePlan, isActive } from "../plans"
import AutoInvoiceSettings from "../components/AutoInvoiceSettings"
import AutoReportSettings from "../components/AutoReportSettings"
import OnlinePaySettings from "../components/OnlinePaySettings"
import TaxModeSettings from "../components/TaxModeSettings"
import TelegramSettings from "../components/TelegramSettings"
import { BetaNotice } from "../components/BetaBadge"
import SubjectsSettings from "../components/SubjectsSettings"
import { isOwner } from "../owner"

// Инициал в цветном кружке: аватара у репетитора в базе нет, а пустой серый
// круг выглядит как незагрузившаяся картинка.
function Avatar({ name, email, size = 56 }) {
  const letter = (name || email || "?").trim().charAt(0).toUpperCase()
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-medium shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: "linear-gradient(135deg, #0A84FF 0%, #5E5CE6 100%)",
        boxShadow: "0 8px 22px rgba(10,132,255,0.28)",
      }}
    >
      {letter}
    </div>
  )
}

export default function Profile({ user, students = [], onLogout, onProfileChange }) {
  const { sub, openPlans } = useSubscription()
  const plan = effectivePlan(sub)
  const paid = isActive(sub)

  const [name, setName] = useState(user.profile?.name || "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const dirty = name.trim() && name.trim() !== (user.profile?.name || "")

  async function saveName() {
    const value = name.trim()
    setSaving(true)
    const { error } = await supabase.from("tutors").update({ name: value }).eq("id", user.id)
    setSaving(false)
    if (error) return
    onProfileChange?.({ name: value })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function copyCode() {
    navigator.clipboard?.writeText(user.profile?.code || "").then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-medium mb-1">Профиль</h1>
      <p className="text-sm text-gray-500 mb-5 sm:mb-6">
        Аккаунт и код для учеников, предметы, приём денег и налоги, телеграм-бот.
      </p>

      {/* Аккаунт */}
      <div className="glass p-5 mb-4">
        <div className="flex items-start gap-4">
          <Avatar name={user.profile?.name} email={user.email} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-medium break-words">{user.profile?.name || "Без имени"}</span>
              {/* Ярлык тарифа кликабелен: раз подписка живёт на своей вкладке,
                  отсюда должен быть переход, а не тупик. */}
              <button
                onClick={openPlans}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset flex items-center gap-1 transition-all hover:brightness-105 active:scale-95 ${
                  paid
                    ? "bg-[#007AFF]/10 text-[#007AFF] ring-[#007AFF]/25"
                    : "text-gray-500 ring-gray-300/70 dark:ring-white/15"
                }`}
              >
                Тариф «{plan.name}»
                <Icon name="chevron-right" size={11} />
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1 break-all">{user.email}</div>
          </div>
          <button
            onClick={onLogout}
            className="self-start shrink-0 px-3.5 py-1.5 rounded-full text-sm text-gray-500 ring-1 ring-inset ring-gray-200 dark:ring-white/[0.12] hover:bg-blue-500/[0.07] dark:hover:bg-white/[0.06] active:scale-95 transition-all"
          >
            Выйти
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="flex-1 min-w-0">
            <span className="block text-xs text-gray-500 mb-1.5">Имя, которое видят ученики</span>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false) }}
              placeholder="Имя и фамилия"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] text-sm outline-none focus:border-[#007AFF]/50 transition-colors"
            />
          </label>
          <button
            onClick={saveName}
            disabled={!dirty || saving}
            className="shrink-0 px-5 py-2.5 rounded-full text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-default"
            style={{ background: "linear-gradient(135deg, #0A84FF 0%, #0060DF 100%)" }}
          >
            {saving ? "Сохраняем…" : saved ? "Сохранено" : "Сохранить"}
          </button>
        </div>
      </div>

      {/* Предметы репетитора: от них зависит, какие генераторы банка ему
          открываются в сборке ДЗ и на доске. */}
      <SubjectsSettings
        tutorId={user.id}
        profile={user.profile}
        owner={isOwner(user.email)}
        onChange={onProfileChange}
      />

      {/* Код для учеников: раньше жил в верхней панели — здесь он рядом с
          остальными данными аккаунта и с кнопкой копирования. */}
      {user.profile?.code && (
        <div className="glass p-5 mb-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium mb-1">Код для учеников</div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Ученик вводит его при регистрации, чтобы попасть именно к вам.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-lg font-medium tracking-wider px-4 py-2 rounded-xl bg-blue-500/[0.08] dark:bg-white/[0.08]">
              {user.profile?.code || "—"}
            </span>
            <button
              onClick={copyCode}
              className="px-3.5 py-2 rounded-xl text-sm font-medium text-[#007AFF] bg-[#007AFF]/10 ring-1 ring-inset ring-[#007AFF]/25 transition-all flex items-center gap-1.5"
            >
              <Icon name={copied ? "check" : "copy"} size={14} />
              {copied ? "Скопирован" : "Копировать"}
            </button>
          </div>
        </div>
      )}

      {/* Телеграм-бот: второй вход в тот же кабинет. Раньше лежал внутри блока
          «Подписка» в самом низу страницы — о нём никто не знал. */}
      <div className="mb-4">
        <TelegramSettings />
      </div>

      {/* Отчёты родителям уходят сами — здесь только расписание. */}
      <div className="mb-4">
        <AutoReportSettings tutorId={user.id} students={students} />
      </div>

      {/* Приём денег с учеников: квитанции после занятия и онлайн-оплата. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-stretch">
        <AutoInvoiceSettings tutorId={user.id} students={students} />
        {/* Колонка тянется на высоту соседа, нижняя карточка добирает остаток —
            иначе под короткой колонкой висит пустота. */}
        <div className="flex flex-col gap-4">
          <OnlinePaySettings tutorId={user.id} />
          {/* Налоговый режим спрашивается при регистрации; оформление со временем
              меняется, поэтому здесь же его и переключают. */}
          <TaxModeSettings tutorId={user.id} surface="glass p-5 flex-1" />
        </div>
      </div>

      {/* Статус сервиса — в самом низу «Профиля»: это про платформу целиком,
          а не про конкретную настройку. */}
      <BetaNotice />
    </div>
  )
}
