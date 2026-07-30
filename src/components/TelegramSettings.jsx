import { useState, useEffect } from "react"
import Icon from "./Icon"
import { supabase } from "../supabase"
import { usePlan } from "../subscription"
import { PlanHint } from "./PlanLock"

// Карточка «Телеграм-бот» на странице «Подписка».
//
// Бот — второй вход в тот же кабинет (api/telegram.js), поэтому здесь только
// связка аккаунта с чатом: репетитор берёт одноразовый код и открывает бота по
// ссылке — код улетает боту сам, вводить руками ничего не нужно.
//
// Состояние собирается из двух источников: подключён ли бот вообще (ключи лежат
// в переменных окружения Vercel, поэтому спрашиваем сервер) и привязан ли чат
// у этого репетитора (таблица tutor_telegram, RLS отдаёт только свою строку).

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : ""

export default function TelegramSettings() {
  const [health, setHealth] = useState(null)      // null = ещё спрашиваем сервер
  const [link, setLink] = useState(null)          // строка tutor_telegram или null
  const [ready, setReady] = useState(true)        // миграция telegram_bot.sql выполнена
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const { allows } = usePlan()
  const canBot = allows("telegramBot")

  useEffect(() => {
    fetch("/api/telegram").then((r) => r.json()).then(setHealth).catch(() => setHealth({ ok: false }))
  }, [])

  useEffect(() => {
    let alive = true
    supabase.from("tutor_telegram")
      .select("chat_id, username, full_names, notify, linked_at")
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (!alive) return
        // Отсутствие таблицы и отсутствие привязки — разные вещи: во втором
        // случае кнопка должна работать, в первом честно сказать про миграцию.
        if (e) { setReady(false); return }
        setLink(data || null)
      })
    return () => { alive = false }
  }, [])

  async function connect() {
    setError("")
    setBusy(true)
    const { data, error: e } = await supabase.rpc("telegram_link_code_new")
    setBusy(false)
    if (e || !data) {
      setError(e?.message?.includes("telegram_link_code_new")
        ? "Не выполнена миграция supabase/telegram_bot.sql"
        : e?.message || "Не удалось получить код")
      return
    }
    setCode(data)
    // Код живёт 15 минут — держать его на экране дольше нельзя, иначе кнопка
    // «Открыть бота» будет вести с уже просроченным кодом.
    setTimeout(() => setCode(""), 15 * 60 * 1000)
  }

  async function unlink() {
    setBusy(true)
    await supabase.from("tutor_telegram").delete().eq("chat_id", link.chat_id)
    setLink(null)
    setCode("")
    setBusy(false)
  }

  const botLink = health?.bot
    ? `https://t.me/${health.bot}${code ? `?start=${code}` : ""}`
    : null

  return (
    <div className="glass p-5 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium">Телеграм-бот</h2>
          {link ? (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/12 text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-500/25">
              Подключён
            </span>
          ) : health && !health.ok ? (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-1 ring-inset ring-amber-500/25">
              Не настроен
            </span>
          ) : null}
        </div>
        {link && (
          <button
            onClick={unlink}
            disabled={busy}
            className="no-press text-xs font-medium text-gray-500 hover:text-red-500 transition-colors active:scale-95 disabled:opacity-40"
          >
            Отвязать
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 leading-relaxed mb-4">
        Расписание, сданные домашки и долги — в телефоне. Работу можно зачесть или
        вернуть на доработку прямо из чата, не открывая кабинет.
      </p>

      {!canBot && (
        <div className="mb-4">
          <PlanHint feature="telegramBot">
            Бот присылает уведомления о сданных работах и показывает расписание на день.
          </PlanHint>
        </div>
      )}

      {link ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-black/[0.03] dark:bg-white/[0.05]">
            <span className="w-8 h-8 rounded-xl bg-[#007AFF]/12 text-[#007AFF] flex items-center justify-center shrink-0">
              <Icon name="message" size={15} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                {link.username ? `@${link.username}` : "Чат привязан"}
              </div>
              <div className="text-[11px] text-gray-400">
                {fmtDate(link.linked_at)} · имена {link.full_names ? "полностью" : "сокращённо"}
                {link.notify ? "" : " · уведомления выключены"}
              </div>
            </div>
          </div>
          {botLink && (
            <a
              href={botLink}
              target="_blank"
              rel="noreferrer"
              className="no-press self-start inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-[#007AFF] bg-[#007AFF]/10 ring-1 ring-inset ring-[#007AFF]/25 active:scale-95 transition-transform"
            >
              Открыть бота <Icon name="external-link" size={13} />
            </a>
          )}
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Настройки показа имён и уведомлений — в самом боте, раздел «Настройки».
          </p>
        </div>
      ) : code ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-3 bg-[#007AFF]/[0.07] ring-1 ring-inset ring-[#007AFF]/20">
            <div className="min-w-0">
              <div className="text-[11px] text-gray-500 mb-0.5">Код привязки · 15 минут</div>
              <div className="text-lg font-medium tracking-[0.18em] tabular-nums">{code}</div>
            </div>
          </div>
          <a
            href={botLink || "#"}
            target="_blank"
            rel="noreferrer"
            className="no-press self-start inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-medium text-white active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg, #0A84FF 0%, #0060DF 100%)", boxShadow: "0 6px 18px rgba(0,122,255,0.28)" }}
          >
            Открыть бота и привязать <Icon name="external-link" size={13} />
          </a>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Кнопка открывает чат с ботом и передаёт код сама. Если открываете бота с
            другого устройства — отправьте ему код сообщением.
          </p>
        </div>
      ) : (
        <button
          onClick={connect}
          disabled={busy || !canBot || !ready || (health && !health.ok)}
          className="no-press self-start inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-medium text-white active:scale-95 transition-transform disabled:opacity-45 disabled:cursor-default"
          style={{ background: "linear-gradient(135deg, #0A84FF 0%, #0060DF 100%)", boxShadow: "0 6px 18px rgba(0,122,255,0.28)" }}
        >
          {busy ? "Готовим код…" : "Подключить Telegram"}
        </button>
      )}

      {error && (
        <div className="text-xs text-red-600 dark:text-red-300 bg-red-500/10 ring-1 ring-inset ring-red-500/20 rounded-xl px-3 py-2.5 mt-4">
          {error}
        </div>
      )}
      {!ready && (
        <div className="text-xs text-amber-600 dark:text-amber-300 bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 rounded-xl px-3 py-2.5 mt-4">
          Не выполнена миграция <span className="font-mono">supabase/telegram_bot.sql</span> — привязку негде хранить.
        </div>
      )}
      {health && !health.ok && (
        <div className="text-xs text-amber-600 dark:text-amber-300 bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 rounded-xl px-3 py-2.5 mt-4">
          {health.error || "Бот не подключён на сервере"}. Инструкция — <span className="font-mono">docs/telegram.md</span>.
        </div>
      )}
      {health?.ok && !health.webhookSecret && (
        <div className="text-xs text-amber-600 dark:text-amber-300 bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 rounded-xl px-3 py-2.5 mt-4">
          Не задан <span className="font-mono">TELEGRAM_WEBHOOK_SECRET</span> — бот не будет отвечать на сообщения.
        </div>
      )}
    </div>
  )
}
