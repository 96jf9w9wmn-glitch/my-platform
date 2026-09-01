// Разбор очереди писем: раз в полминуты забираем пачку и отправляем.
//
// Очередь наполняет триггер на `notifications` (supabase/email_notify.sql).
// Почему не сам клиент шлёт письмо: уведомления кладут и ученик, и репетитор из
// своих кабинетов, и дать клиенту отправку почты — значит открыть её кому
// угодно. Почему не pg_cron: из базы наружу (в SMTP-релей на хосте) не сходить.
//
// Забирает пачку RPC `email_outbox_claim` под service_role: без ключа очередь
// просто не разбирается — уведомления в кабинете при этом работают как всегда.

import { createClient } from "@supabase/supabase-js"
import { sendMail } from "./mailer.js"

const EVERY_MS = 30_000
const BATCH = 10

let db = null

function client() {
  if (db) return db
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  db = createClient(url, key, { auth: { persistSession: false } })
  return db
}

// Подвал письма собираем здесь, а не в триггере: адрес кабинета знает сервер,
// а база про домен ничего не знает и знать не должна.
function compose(body) {
  const url = process.env.APP_URL || process.env.PUBLIC_SITE_URL || "https://precettore.ru"
  return [
    body,
    "",
    `Открыть кабинет: ${url}`,
    "",
    "Это копия уведомления из кабинета. Отключить дублирование на почту —",
    "«Профиль» → «Уведомления на почту».",
  ].join("\n")
}

async function tick() {
  const api = client()
  if (!api) return
  const { data, error } = await api.rpc("email_outbox_claim", { p_limit: BATCH })
  if (error) {
    // Миграция не выполнена — это не повод шуметь каждые полминуты.
    if (error.code !== "PGRST202" && error.code !== "42883") {
      console.error("[почта] очередь не читается:", error.message)
    }
    return
  }
  for (const row of data || []) {
    try {
      await sendMail({ to: row.to_email, subject: row.subject, text: compose(row.body) })
      await api.rpc("email_outbox_done", { p_id: row.id })
    } catch (e) {
      console.error(`[почта] письмо ${row.id} не ушло:`, e.message)
      await api.rpc("email_outbox_done", { p_id: row.id, p_error: String(e.message).slice(0, 500) })
    }
  }
}

export function startEmailQueue() {
  if (!client()) {
    console.log("[почта] SUPABASE_SERVICE_ROLE_KEY не задан — очередь не разбирается")
    return
  }
  const run = () => { tick().catch((e) => console.error("[почта] сбой разбора:", e)) }
  run()
  // unref: незаконченный таймер не должен держать процесс при остановке.
  setInterval(run, EVERY_MS).unref()
  console.log(`[почта] разбор очереди раз в ${EVERY_MS / 1000} с`)
}
