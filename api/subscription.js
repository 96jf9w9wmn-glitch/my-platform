// Оплата подписки репетитора на платформу.
//
// Отличие от api/yookassa.js (оплата занятий): там платит ученик и деньги идут
// репетитору, здесь платит РЕПЕТИТОР и деньги идут ПЛАТФОРМЕ. Поэтому и магазин
// другой: YOOKASSA_PLATFORM_SHOP_ID / YOOKASSA_PLATFORM_SECRET_KEY.
//
// Переменные окружения (Vercel → Project → Settings → Environment Variables):
//   YOOKASSA_PLATFORM_SHOP_ID     — магазин платформы (если не задан, берётся
//   YOOKASSA_PLATFORM_SECRET_KEY    магазин репетитора — допустимо, только пока
//                                   платформа однопользовательская)
//   SUPABASE_URL                  — тот же адрес, что и VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY     — service_role ключ (НЕ anon!)
//   PUBLIC_SITE_URL               — например https://precettore.ru
//   YOOKASSA_RECEIPT              — «1», если включена отправка чеков
//
// Два правила, как и в оплате занятий:
//   • сумму считает СЕРВЕР по src/plans.js — браузеру верить нельзя, иначе
//     «Макс» покупался бы за рубль;
//   • Idempotence-Key = id заказа: повторный клик не создаёт второй платёж.
//
// Проверка тарифа и ключи магазина платформы живут в api/plan-gate.js — их же
// используют api/generate-hw.js и api/yookassa.js.

import { rateLimit, clientIp } from "./generate-hw.js"
import { admin, ykPlatformAuth, platformShopId, platformSecret, tutorFromRequest, isMissingSchema } from "./plan-gate.js"
import { PLANS, planById, priceOf, monthsOf } from "../src/plans.js"

const API = "https://api.yookassa.ru/v3"

const money = (n) => (Math.round(n * 100) / 100).toFixed(2)

export default async function handler(req, res) {
  const auth = ykPlatformAuth()

  // GET — health-check без создания платежа: видно, доехали ли ключи и не
  // подключён ли по ошибке тестовый магазин.
  if (req.method === "GET") {
    res.status(auth ? 200 : 500).json({
      ok: Boolean(auth),
      shop: platformShopId(),
      mode: platformSecret().startsWith("live_") ? "live" : "test",
      dedicated: Boolean(process.env.YOOKASSA_PLATFORM_SHOP_ID),
      receipts: process.env.YOOKASSA_RECEIPT === "1",
      db: Boolean(admin()),
      plans: PLANS.map((p) => ({ id: p.id, price: p.price })),
      error: auth ? undefined : "YOOKASSA_PLATFORM_SHOP_ID / YOOKASSA_PLATFORM_SECRET_KEY не заданы на сервере",
    })
    return
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  if (!auth) {
    res.status(500).json({ error: "Оплата подписки не настроена: нет ключей ЮKassa" })
    return
  }

  const db = admin()
  if (!db) {
    res.status(500).json({ error: "Оплата подписки не настроена: нет SUPABASE_SERVICE_ROLE_KEY" })
    return
  }

  const limit = rateLimit(`sub:${clientIp(req)}`)
  if (!limit.ok) {
    res.status(429).json({ error: `Слишком часто. Повторите через ${limit.retryAfter} с.` })
    return
  }

  const user = await tutorFromRequest(db, req)
  if (!user) {
    res.status(401).json({ error: "Нужна авторизация репетитора" })
    return
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})
  const planId = String(body.plan || "")
  const periodId = String(body.period || "month")

  const plan = PLANS.find((p) => p.id === planId)
  if (!plan || plan.price.month === 0) {
    res.status(400).json({ error: "Такой тариф нельзя оплатить" })
    return
  }
  if (periodId !== "month" && periodId !== "year") {
    res.status(400).json({ error: "Некорректный период оплаты" })
    return
  }

  const amount = priceOf(planId, periodId)
  const months = monthsOf(periodId)
  if (!(amount > 0)) {
    res.status(400).json({ error: "Некорректная сумма подписки" })
    return
  }

  const description = `Precettore · тариф «${plan.name}» на ${months === 12 ? "год" : "месяц"}`

  // Заказ заводим ДО обращения к ЮKassa: его id — и ключ идемпотентности,
  // и то, по чему вебхук найдёт заказ обратно.
  const { data: order, error: orderErr } = await db
    .from("subscription_orders")
    .insert({
      tutor_id: user.id,
      plan: planId,
      period: periodId,
      months,
      amount,
      description,
      test: !platformSecret().startsWith("live_"),
    })
    .select("id")
    .single()

  if (orderErr || !order) {
    const hint = isMissingSchema(orderErr)
      ? "Не выполнена миграция supabase/subscriptions.sql"
      : orderErr?.message
    res.status(500).json({ error: "Не удалось создать заказ", detail: hint })
    return
  }

  const site = (process.env.PUBLIC_SITE_URL || "https://precettore.ru").replace(/\/$/, "")
  const payload = {
    amount: { value: money(amount), currency: "RUB" },
    capture: true,
    confirmation: { type: "redirect", return_url: `${site}/?sub=${order.id}` },
    description: description.slice(0, 128),
    // kind — по нему вебхук отличает подписку от оплаты занятия.
    metadata: { kind: "subscription", order_id: order.id, tutor_id: user.id, plan: planId },
  }

  if (process.env.YOOKASSA_RECEIPT === "1" && user.email) {
    payload.receipt = {
      customer: { email: user.email },
      items: [{
        description: description.slice(0, 128),
        quantity: "1",
        amount: { value: money(amount), currency: "RUB" },
        vat_code: 1,
        payment_subject: "service",
        payment_mode: "full_payment",
      }],
    }
  }

  let yk
  try {
    const r = await fetch(`${API}/payments`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        "Idempotence-Key": order.id,
      },
      body: JSON.stringify(payload),
    })
    yk = await r.json().catch(() => ({}))
    if (!r.ok) {
      await db.from("subscription_orders").update({ status: "canceled" }).eq("id", order.id)
      res.status(502).json({ error: yk?.description || "ЮKassa отклонила платёж", code: yk?.code })
      return
    }
  } catch (e) {
    await db.from("subscription_orders").update({ status: "canceled" }).eq("id", order.id)
    res.status(502).json({ error: "ЮKassa недоступна", detail: String(e?.message || e) })
    return
  }

  const confirmationUrl = yk?.confirmation?.confirmation_url || null
  await db.from("subscription_orders")
    .update({ yk_payment_id: yk.id, confirmation_url: confirmationUrl })
    .eq("id", order.id)

  if (!confirmationUrl) {
    res.status(502).json({ error: "ЮKassa не вернула ссылку на оплату" })
    return
  }

  res.status(200).json({
    orderId: order.id,
    amount,
    plan: planById(planId).name,
    confirmationUrl,
  })
}
