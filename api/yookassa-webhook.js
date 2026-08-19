// Уведомления ЮKassa: сюда прилетает payment.succeeded / payment.canceled.
//
// Адрес вебхука указывается в личном кабинете ЮKassa
// (Настройки → Уведомления): https://precettore.ru/api/yookassa-webhook
//
// Три правила, без которых вебхук опасен:
//   1. Телу уведомления НЕ верим. Подписи у ЮKassa нет, поэтому подлинность
//      подтверждаем сами: проверяем IP отправителя по списку ЮKassa и заново
//      спрашиваем платёж через API. Статус берём из ответа API, а не из тела.
//   2. Отвечаем 200 всегда, когда уведомление разобрано. На любой другой код
//      ЮKassa будет повторять доставку сутки.
//   3. Повторы неизбежны, значит запись обязана быть идемпотентной: платёж
//      переносится в историю ученика ровно один раз (флаг payment_orders.applied
//      захватывается атомарно).

//
// Сюда же прилетают уведомления об оплате ПОДПИСКИ репетитора на платформу
// (другой магазин ЮKassa). Отличаем их по metadata.kind === "subscription":
// заказ ищем в subscription_orders и продлеваем тариф, а не пишем в историю
// ученика. Если магазин платформы отдельный, в его кабинете можно указать
// адрес /api/subscription-webhook — это тот же самый обработчик.

import { createClient } from "@supabase/supabase-js"
import { ykAuth } from "./yookassa.js"
import { ykPlatformAuth } from "./plan-gate.js"
import { clientIp } from "./generate-hw.js"

const API = "https://api.yookassa.ru/v3"

// Официальный список сетей ЮKassa (yookassa.ru/developers/using-api/webhooks).
const ALLOWED_V4 = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.154.128/25",
  "77.75.156.11/32",
  "77.75.156.35/32",
]
const ALLOWED_V6 = ["2a02:5180::/32"]

const ipToInt = (ip) => ip.split(".").reduce((acc, o) => (acc << 8 >>> 0) + Number(o), 0) >>> 0

function inV4(ip, cidr) {
  const [net, bitsRaw] = cidr.split("/")
  const bits = Number(bitsRaw)
  const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0
  return (ipToInt(ip) & mask) >>> 0 === (ipToInt(net) & mask) >>> 0
}

// Разворачиваем IPv6 в 32 hex-символа и сравниваем нужное число нибблов —
// у ЮKassa всего одна сеть, префикс кратен 4 битам, поэтому этого достаточно.
function expandV6(ip) {
  const clean = ip.replace(/^\[|\]$/g, "").split("%")[0]
  const [head, tail = ""] = clean.split("::")
  const h = head ? head.split(":") : []
  const t = tail ? tail.split(":") : []
  const fill = Array(8 - h.length - t.length).fill("0")
  const groups = clean.includes("::") ? [...h, ...fill, ...t] : clean.split(":")
  if (groups.length !== 8) return null
  return groups.map((g) => (g || "0").padStart(4, "0")).join("").toLowerCase()
}

export function isYooKassaIp(raw) {
  const ip = String(raw || "").trim()
  if (!ip) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ALLOWED_V4.some((c) => inV4(ip, c))
  const full = expandV6(ip)
  if (!full) return false
  return ALLOWED_V6.some((cidr) => {
    const [net, bits] = cidr.split("/")
    const netFull = expandV6(net)
    const nibbles = Math.floor(Number(bits) / 4)
    return netFull && full.slice(0, nibbles) === netFull.slice(0, nibbles)
  })
}

// Дата платежа в том же виде, в каком её пишет репетитор вручную (дд.мм.гггг),
// иначе Payment.jsx не разберёт её в графике дохода. Часовой пояс — московский:
// сервер Vercel живёт в UTC, и вечерний платёж иначе уезжал бы на день назад.
function ruDate(iso) {
  const d = iso ? new Date(iso) : new Date()
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(d)
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  // Здесь на адресе держится ВСЯ проверка подлинности (подписи у ЮKassa нет),
  // поэтому берём его только из заголовков прокси Vercel: клиентский
  // `x-forwarded-for` подделывается и пускал бы кого угодно (аудит 30.07.2026).
  const ip = clientIp(req)
  if (!isYooKassaIp(ip)) {
    // Не 200: это не ЮKassa, повторов бояться нечего.
    res.status(403).json({ error: "forbidden" })
    return
  }

  // Магазинов может быть два (репетиторский и платформенный), а какому именно
  // принадлежит платёж, до запроса неизвестно. Поэтому спрашиваем по очереди:
  // чужой магазин на GET /payments/{id} отвечает 404, свой — платежом.
  const auths = [...new Set([ykAuth(), ykPlatformAuth()].filter(Boolean))]
  const db = admin()
  if (!auths.length || !db) {
    // Сервер не настроен — просим ЮKassa повторить позже (не 200).
    res.status(503).json({ error: "not configured" })
    return
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})
  const event = body?.event
  const paymentId = body?.object?.id
  if (!paymentId || !String(event || "").startsWith("payment.")) {
    res.status(200).json({ ok: true, ignored: true })
    return
  }

  // Единственный достоверный источник — сам API ЮKassa.
  let payment = null
  let notFound = false
  try {
    for (const a of auths) {
      const r = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: a },
      })
      const body = await r.json().catch(() => null)
      if (r.ok && body?.id) { payment = body; break }
      if (r.status === 404) { notFound = true; continue }
    }
  } catch {
    res.status(503).json({ error: "yookassa unreachable" })
    return
  }
  if (!payment) {
    // Платежа нет ни в одном нашем магазине — повторять бессмысленно, отвечаем 200.
    // Любая другая причина (сеть, 5xx) — 503, чтобы ЮKassa попробовала снова.
    res.status(notFound ? 200 : 503).json(
      notFound ? { ok: true, unknown_payment: true } : { error: "cannot verify payment" }
    )
    return
  }

  // Подписка репетитора на платформу — своя ветка: продлеваем тариф.
  if (payment?.metadata?.kind === "subscription") {
    await applySubscription(db, payment, res)
    return
  }

  const orderId = payment?.metadata?.order_id
  const { data: order } = await db
    .from("payment_orders")
    .select("id, tutor_id, student_id, amount, lessons, status, applied")
    .eq(orderId ? "id" : "yk_payment_id", orderId || payment.id)
    .maybeSingle()

  if (!order) {
    // Заказа нет (чужой магазин, стёртая база) — принимаем, чтобы не долбилось сутки.
    res.status(200).json({ ok: true, unknown_order: true })
    return
  }

  if (payment.status === "canceled") {
    await db.from("payment_orders")
      .update({ status: "canceled", yk_payment_id: payment.id })
      .eq("id", order.id)
      .eq("applied", false)
    res.status(200).json({ ok: true, status: "canceled" })
    return
  }

  if (payment.status !== "succeeded") {
    res.status(200).json({ ok: true, status: payment.status })
    return
  }

  // Сумму берём из ответа ЮKassa, но сверяем с заказом: расхождение — повод не
  // трогать историю ученика, а оставить платёж репетитору на ручной разбор.
  const paidAmount = Number(payment?.amount?.value || 0)
  const expected = Number(order.amount || 0)
  if (Math.abs(paidAmount - expected) > 0.01) {
    await db.from("payment_orders")
      .update({ status: "succeeded", yk_payment_id: payment.id, paid_at: payment.captured_at || new Date().toISOString() })
      .eq("id", order.id)
    res.status(200).json({ ok: true, amount_mismatch: true })
    return
  }

  // Атомарный захват: applied false → true проходит ровно у одного из повторов.
  const { data: claimed } = await db
    .from("payment_orders")
    .update({
      status: "succeeded",
      applied: true,
      yk_payment_id: payment.id,
      paid_at: payment.captured_at || new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("applied", false)
    .select("id")

  if (!claimed?.length) {
    res.status(200).json({ ok: true, already_applied: true })
    return
  }

  // Переносим платёж в карточку ученика — туда же, куда репетитор пишет наличные.
  try {
    const { data: student } = await db
      .from("students")
      .select("id, payments, balance")
      .eq("id", order.student_id)
      .maybeSingle()

    if (student) {
      const payments = Array.isArray(student.payments) ? student.payments : []
      const already = payments.some((p) => p?.order_id === order.id)
      if (!already) {
        payments.push({
          id: `yk_${order.id}`,
          order_id: order.id,
          amount: paidAmount,
          date: ruDate(payment.captured_at),
          note: order.lessons ? `ЮKassa · ${order.lessons} зан.` : "ЮKassa",
          source: "yookassa",
        })
        await db.from("students").update({
          payments,
          paid: true,
          balance: Number(student.balance || 0) + paidAmount,
        }).eq("id", student.id)
      }
    }
  } catch (e) {
    // Захват уже сделан, а запись не удалась — снимаем флаг, чтобы следующая
    // доставка (ЮKassa повторяет сутки) попробовала снова.
    await db.from("payment_orders").update({ applied: false }).eq("id", order.id)
    res.status(503).json({ error: "apply failed", detail: String(e?.message || e) })
    return
  }

  res.status(200).json({ ok: true, applied: true })
}

// Подписка на платформу. Продление делает RPC subscription_apply: захват флага
// applied и сдвиг срока обязаны быть одной атомарной операцией, иначе повторная
// доставка уведомления продлила бы тариф дважды.
async function applySubscription(db, payment, res) {
  const orderId = payment?.metadata?.order_id
  const { data: order } = await db
    .from("subscription_orders")
    .select("id, tutor_id, plan, months, amount, status, applied")
    .eq(orderId ? "id" : "yk_payment_id", orderId || payment.id)
    .maybeSingle()

  if (!order) {
    res.status(200).json({ ok: true, unknown_order: true })
    return
  }

  if (payment.status === "canceled") {
    await db.from("subscription_orders")
      .update({ status: "canceled", yk_payment_id: payment.id })
      .eq("id", order.id)
      .eq("applied", false)
    res.status(200).json({ ok: true, status: "canceled" })
    return
  }

  if (payment.status !== "succeeded") {
    res.status(200).json({ ok: true, status: payment.status })
    return
  }

  const paidAmount = Number(payment?.amount?.value || 0)
  if (Math.abs(paidAmount - Number(order.amount || 0)) > 0.01) {
    // Заплатили не ту сумму — фиксируем платёж, но тариф не выдаём: такой случай
    // разбирается руками, автоматически «Макс» за 100 ₽ выдавать нельзя.
    await db.from("subscription_orders")
      .update({
        status: "succeeded",
        yk_payment_id: payment.id,
        paid_at: payment.captured_at || new Date().toISOString(),
      })
      .eq("id", order.id)
    res.status(200).json({ ok: true, amount_mismatch: true })
    return
  }

  const { data: applied, error } = await db.rpc("subscription_apply", {
    p_order: order.id,
    p_payment: payment.id,
    p_paid_at: payment.captured_at || new Date().toISOString(),
  })

  if (error) {
    // Миграция не выполнена или база недоступна — просим ЮKassa повторить.
    res.status(503).json({ error: "apply failed", detail: error.message })
    return
  }

  res.status(200).json({ ok: true, applied: Boolean(applied), already_applied: !applied })
}
