// Карточка «Телеграм» во вкладке «Настройки» кабинета ученика.
//
// Зачем ученику бот. Колокольчик видит только тот, кто открыл кабинет; почты у
// ученика нет вовсе (регистрация идёт по телефону), поэтому продублировать
// уведомление письмом, как репетитору, некуда. Telegram закрывает ровно ту же
// дыру: новая работа, проверка, сообщение репетитора и напоминание о занятии
// доходят при закрытом приложении.
//
// Тарифом привязка не ограничена — за платформу платит репетитор, и понижение
// его тарифа не должно молча отключать ученику напоминания о его же занятиях.
//
// Здесь только связка чата с аккаунтом: разделы и переключатель уведомлений
// живут в самом боте (api/telegram.js).
import { useState, useEffect } from "react"
import Icon from "./Icon"
import { supabase } from "../supabase"

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : ""

export default function StudentTelegram() {
  const [health, setHealth] = useState(null)   // null = ещё спрашиваем сервер
  const [link, setLink] = useState(null)       // строка student_telegram или null
  const [ready, setReady] = useState(true)     // миграция telegram_student.sql выполнена
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/telegram").then((r) => r.json()).then(setHealth).catch(() => setHealth({ ok: false }))
  }, [])

  useEffect(() => {
    let alive = true
    supabase.from("student_telegram")
      .select("chat_id, username, notify, linked_at")
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (!alive) return
        // Нет таблицы и нет привязки — разные вещи: во втором случае кнопка
        // должна работать, в первом честно сказать про миграцию.
        if (e) { setReady(false); return }
        setLink(data || null)
      })
    return () => { alive = false }
  }, [])

  // Бот на сервере не настроен — карточки нет вовсе: предлагать кнопку в никуда
  // хуже, чем не предлагать ничего (так же ведёт себя PushSettings).
  if (health && !health.ok) return null

  async function connect() {
    setError("")
    setBusy(true)
    const { data, error: e } = await supabase.rpc("telegram_link_code_student")
    setBusy(false)
    if (e || !data) {
      setError(e?.message?.includes("telegram_link_code_student")
        ? "Не выполнена миграция supabase/telegram_student.sql"
        : e?.message || "Не удалось получить код")
      return
    }
    setCode(data)
    // Код живёт 15 минут: держать его на экране дольше нельзя, иначе кнопка
    // «Открыть бота» поведёт с уже просроченным кодом.
    setTimeout(() => setCode(""), 15 * 60 * 1000)
  }

  async function unlink() {
    setBusy(true)
    await supabase.from("student_telegram").delete().eq("chat_id", link.chat_id)
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
          <h2 className="text-base font-medium">Телеграм</h2>
          {link && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/12 text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-500/25">
              Подключён
            </span>
          )}
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
        Бот напишет, когда репетитор выдаст работу или проверит её, и напомнит о
        занятии — накануне вечером и за час. Там же ближайшие занятия и сроки сдачи.
      </p>

      {link ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-blue-500/[0.05] dark:bg-white/[0.05]">
            <span className="w-8 h-8 rounded-xl bg-[#007AFF]/12 text-[#007AFF] flex items-center justify-center shrink-0">
              <Icon name="message" size={15} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                {link.username ? `@${link.username}` : "Чат привязан"}
              </div>
              <div className="text-[11px] text-gray-400">
                {fmtDate(link.linked_at)}{link.notify ? "" : " · уведомления выключены"}
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
            Кнопка откроет чат с ботом и передаст код сама. Если открываешь бота с
            другого устройства — отправь ему код сообщением.
          </p>
        </div>
      ) : (
        <button
          onClick={connect}
          disabled={busy || !ready || !health}
          className="no-press self-start inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-medium text-white active:scale-95 transition-transform disabled:opacity-45 disabled:cursor-default"
          style={{ background: "linear-gradient(135deg, #0A84FF 0%, #0060DF 100%)", boxShadow: "0 6px 18px rgba(0,122,255,0.28)" }}
        >
          {busy ? "Готовим код…" : !ready ? "Нужна миграция" : "Подключить Telegram"}
        </button>
      )}

      {error && (
        <div className="text-xs text-red-600 dark:text-red-300 bg-red-500/10 ring-1 ring-inset ring-red-500/20 rounded-xl px-3 py-2.5 mt-4">
          {error}
        </div>
      )}
      {!ready && (
        <div className="text-xs text-amber-600 dark:text-amber-300 bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 rounded-xl px-3 py-2.5 mt-4">
          Не выполнена миграция <span className="font-mono">supabase/telegram_student.sql</span> — привязку негде хранить.
        </div>
      )}
    </div>
  )
}
