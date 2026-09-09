// Разбор очереди сообщений ученику в Telegram: раз в полминуты забираем пачку.
//
// Очередь наполняет триггер на `notifications` (supabase/telegram_student.sql),
// то есть в неё попадает ровно то, что ученик и так видит в колокольчике:
// выданная работа, проверка, сообщение репетитора, напоминание о занятии.
// Отдельного кода «а теперь ещё напиши в Telegram» ни на одном экране нет и не
// нужно — иначе каждое новое уведомление пришлось бы дублировать руками.
//
// Почему сервер, а не база: из базы наружу в api.telegram.org не сходить.
// Почему не клиент, как у репетиторских уведомлений: писать ученику нужно как
// раз тогда, когда его вкладка закрыта.
//
// Пока пуст TELEGRAM_BOT_TOKEN или SUPABASE_SERVICE_ROLE_KEY, очередь просто
// копится: уведомления в кабинете при этом работают как всегда.

import { createClient } from "@supabase/supabase-js"

const EVERY_MS = 30_000
const BATCH = 10
const API = "https://api.telegram.org"

let db = null

function client() {
  if (db) return db
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  db = createClient(url, key, { auth: { persistSession: false } })
  return db
}

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// Подвал собираем здесь, а не в триггере: адрес кабинета знает сервер.
function compose(title, body) {
  const url = process.env.APP_URL || process.env.PUBLIC_SITE_URL || "https://precettore.ru"
  const lines = [`<b>${esc(title)}</b>`]
  if (body) lines.push(esc(body))
  lines.push("", `<a href="${url}">Открыть кабинет</a>`)
  return lines.join("\n")
}

async function send(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const r = await fetch(`${API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      parse_mode: "HTML",
      text,
      link_preview_options: { is_disabled: true },
    }),
  })
  const data = await r.json().catch(() => null)
  if (!data?.ok) throw new Error(data?.description || `Telegram ответил ${r.status}`)
}

async function tick() {
  const api = client()
  if (!api || !process.env.TELEGRAM_BOT_TOKEN) return

  const { data, error } = await api.rpc("telegram_outbox_claim", { p_limit: BATCH })
  if (error) {
    // Миграция не выполнена — это не повод шуметь каждые полминуты.
    if (error.code !== "PGRST202" && error.code !== "42883") {
      console.error("[телеграм] очередь не читается:", error.message)
    }
    return
  }

  for (const row of data || []) {
    try {
      await send(row.chat_id, compose(row.title, row.body))
      await api.rpc("telegram_outbox_done", { p_id: row.id })
    } catch (e) {
      console.error(`[телеграм] сообщение ${row.id} не ушло:`, e.message)
      await api.rpc("telegram_outbox_done", { p_id: row.id, p_error: String(e.message).slice(0, 500) })
    }
  }
}

export function startTelegramQueue() {
  if (!client()) {
    console.log("[телеграм] SUPABASE_SERVICE_ROLE_KEY не задан — очередь не разбирается")
    return
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log("[телеграм] TELEGRAM_BOT_TOKEN не задан — очередь не разбирается")
    return
  }
  const run = () => { tick().catch((e) => console.error("[телеграм] сбой разбора:", e)) }
  run()
  setInterval(run, EVERY_MS).unref()
  console.log(`[телеграм] разбор очереди раз в ${EVERY_MS / 1000} с`)
}
