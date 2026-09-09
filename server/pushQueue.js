// Разбор очереди push: раз в полминуты забираем пачку и отправляем.
//
// Очередь наполняет триггер на `notifications` (supabase/web_push.sql), тот же
// самый, что наполняет очередь писем. Почему не клиент: уведомления кладут и
// ученик, и репетитор, и дать клиенту рассылку — значит открыть её кому
// угодно (плюс приватный ключ VAPID нельзя показывать браузеру вовсе). Почему
// не pg_cron: из базы наружу, к шлюзам Apple и Google, не сходить.
//
// Забирает пачку RPC `push_outbox_claim` под service_role: без ключа очередь
// просто не разбирается — уведомления в кабинете при этом работают как всегда.

import { createClient } from "@supabase/supabase-js"
import { sendPush } from "./webpush.js"

const EVERY_MS = 30_000
const BATCH = 20

let db = null

function client() {
  if (db) return db
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  db = createClient(url, key, { auth: { persistSession: false } })
  return db
}

// Ключи VAPID. Публичный отдаётся браузеру (api/push.js), приватный не выходит
// за пределы контейнера. Пока их нет — очередь не разбирается, и это штатный
// режим, а не поломка: ровно так же ведёт себя SMS без SMS_API_KEY.
export function vapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null
  return {
    publicKey,
    privateKey,
    // Контакт отправителя по RFC 8292: по нему шлюз пишет, если наши посылки
    // начали доставлять неприятности. Обязателен, Apple без него отвечает 400.
    subject: process.env.VAPID_SUBJECT || "mailto:info@precettore.ru",
  }
}

async function tick() {
  const api = client()
  const vapid = vapidKeys()
  if (!api || !vapid) return

  const { data, error } = await api.rpc("push_outbox_claim", { p_limit: BATCH })
  if (error) {
    // Миграция не выполнена — это не повод шуметь каждые полминуты.
    if (error.code !== "PGRST202" && error.code !== "42883") {
      console.error("[push] очередь не читается:", error.message)
    }
    return
  }

  for (const row of data || []) {
    // Посылка расшифровывается на самом устройстве, поэтому текст уведомления
    // безопасно везти целиком: ни Apple, ни Google его не видят.
    const payload = JSON.stringify({ t: row.title, b: row.body })
    try {
      const res = await sendPush(
        { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
        payload,
        vapid
      )
      if (res.ok) {
        await api.rpc("push_outbox_done", { p_id: row.id })
      } else if (res.gone) {
        // Приложение удалили с домашнего экрана: подписка мертва навсегда.
        // Снимаем её, иначе каждая посылка будет впустую ходить в сеть.
        await api.rpc("push_subscription_drop", { p_id: row.subscription_id })
        await api.rpc("push_outbox_done", { p_id: row.id, p_error: `подписка снята (${res.status})` })
      } else {
        await api.rpc("push_outbox_done", {
          p_id: row.id,
          p_error: `${res.status}: ${res.error || ""}`.slice(0, 500),
        })
      }
    } catch (e) {
      console.error(`[push] посылка ${row.id} не ушла:`, e.message)
      await api.rpc("push_outbox_done", { p_id: row.id, p_error: String(e.message).slice(0, 500) })
    }
  }
}

export function startPushQueue() {
  if (!client()) {
    console.log("[push] SUPABASE_SERVICE_ROLE_KEY не задан — очередь не разбирается")
    return
  }
  if (!vapidKeys()) {
    console.log("[push] ключи VAPID не заданы — очередь не разбирается")
    return
  }
  const run = () => { tick().catch((e) => console.error("[push] сбой разбора:", e)) }
  run()
  // unref: незаконченный таймер не должен держать процесс при остановке.
  setInterval(run, EVERY_MS).unref()
  console.log(`[push] разбор очереди раз в ${EVERY_MS / 1000} с`)
}
