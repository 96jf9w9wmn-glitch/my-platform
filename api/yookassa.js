// Создание платежа в ЮKassa: ученик жмёт «Оплатить», сервер заводит заказ и
// отдаёт ссылку на страницу оплаты.
//
// Магазин оформлен на самого репетитора — деньги идут напрямую ему, платформа
// их не держит. shopId и секретный ключ живут ТОЛЬКО в переменных окружения
// Vercel и в клиент не попадают.
//
// Переменные окружения (Vercel → Project → Settings → Environment Variables):
//   YOOKASSA_SHOP_ID           — идентификатор магазина
//   YOOKASSA_SECRET_KEY        — секретный ключ магазина (test_… или live_…)
//   SUPABASE_URL               — тот же адрес, что и VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  — service_role ключ (НЕ anon!), нужен для записи заказа
//   PUBLIC_SITE_URL            — например https://precettore.ru (куда вернуть плательщика)
//   YOOKASSA_RECEIPT           — «1», если в личном кабинете включена отправка чеков
//
// Два правила, ради которых тут больше кода, чем кажется нужным:
//   • сумму считает СЕРВЕР по students.lesson_price — браузеру верить нельзя,
//     иначе занятие оплачивалось бы рублём;
//   • Idempotence-Key = id нашего заказа: повторный клик по кнопке не создаёт
//     второй платёж, ЮKassa вернёт тот же самый (гарантия — 24 часа).

import { createClient } from "@supabase/supabase-js"
import { rateLimit, clientIp } from "./generate-hw.js"
import { featureAllowed } from "./plan-gate.js"

const API = "https://api.yookassa.ru/v3"
const MAX_AMOUNT = 300_000        // предохранитель от опечатки в цене занятия
const DEFAULT_MAX_LESSONS = 10

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// Магазин РЕПЕТИТОРА: сюда ученик платит за занятия. Магазин ПЛАТФОРМЫ (куда
// репетитор платит за подписку) — отдельный, его ключи живут в api/subscription.js.
export function ykAuth() {
  const shopId = process.env.YOOKASSA_SHOP_ID
  const secret = process.env.YOOKASSA_SECRET_KEY
  if (!shopId || !secret) return null
  return "Basic " + Buffer.from(`${shopId}:${secret}`).toString("base64")
}

// Сумма для ЮKassa — строка с двумя знаками после запятой, иначе 400.
const money = (n) => (Math.round(n * 100) / 100).toFixed(2)

// Телефон в чек ЮKassa принимает в формате ITU-T E.164: только цифры с ведущим +.
function normPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "")
  return digits.length >= 10 ? "+" + digits : null
}

// Ученик в кабинете сопоставляется со строкой students так же, как на фронте
// (StudentDashboard): сначала по телефону, потом по имени. Логику копируем
// намеренно — иначе платёж прилетит не тому ученику.
function matchStudent(rows, profile) {
  const phone = profile?.phone
  const byPhone = phone ? rows.find((s) => s.phone && s.phone === phone) : null
  if (byPhone) return byPhone
  const name = profile?.name?.toLowerCase().trim()
  if (!name) return null
  return rows.find((s) => (s.name || "").toLowerCase().trim() === name) || null
}

export default async function handler(req, res) {
  const auth = ykAuth()

  // GET — health-check без создания платежа: им же удобно проверить,
  // что ключи вообще доехали до окружения (как в generate-hw.js).
  if (req.method === "GET") {
    res.status(auth ? 200 : 500).json({
      ok: Boolean(auth),
      shop: process.env.YOOKASSA_SHOP_ID || null,
      mode: (process.env.YOOKASSA_SECRET_KEY || "").startsWith("live_") ? "live" : "test",
      receipts: process.env.YOOKASSA_RECEIPT === "1",
      db: Boolean(admin()),
      error: auth ? undefined : "YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY не заданы на сервере",
    })
    return
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  if (!auth) {
    res.status(500).json({ error: "Оплата не настроена: нет ключей ЮKassa" })
    return
  }

  const db = admin()
  if (!db) {
    res.status(500).json({ error: "Оплата не настроена: нет SUPABASE_SERVICE_ROLE_KEY" })
    return
  }

  const limit = rateLimit(`pay:${clientIp(req)}`)
  if (!limit.ok) {
    res.status(429).json({ error: `Слишком часто. Повторите через ${limit.retryAfter} с.` })
    return
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})
  const accountId = String(body.accountId || "")
  const token = String(body.token || "")
  const lessons = Math.floor(Number(body.lessons))

  if (!accountId || !token) {
    res.status(401).json({ error: "Нужна авторизация ученика" })
    return
  }
  if (!Number.isFinite(lessons) || lessons < 1) {
    res.status(400).json({ error: "Некорректное количество занятий" })
    return
  }

  // 1. Сессия ученика. Токен из localStorage проверяем по базе — id мало.
  const { data: account } = await db
    .from("student_accounts")
    .select("id, name, phone, tutor_id, session_token")
    .eq("id", accountId)
    .maybeSingle()

  if (!account || !account.session_token || account.session_token !== token) {
    res.status(401).json({ error: "Сессия недействительна, войдите заново" })
    return
  }
  if (!account.tutor_id) {
    res.status(400).json({ error: "Вы ещё не привязаны к репетитору" })
    return
  }

  // 2. Настройки приёма оплаты у этого репетитора.
  const { data: settings } = await db
    .from("tutor_payment_settings")
    .select("online_enabled, max_lessons")
    .eq("tutor_id", account.tutor_id)
    .maybeSingle()

  if (!settings?.online_enabled) {
    res.status(403).json({ error: "Репетитор пока не подключил онлайн-оплату" })
    return
  }
  // Приём онлайн-оплаты — возможность платных тарифов репетитора. Тумблер в его
  // настройках мог остаться включённым с оплаченного периода, поэтому право
  // проверяем здесь, а не только в интерфейсе.
  const access = await featureAllowed(db, account.tutor_id, "onlinePay")
  if (!access.ok) {
    res.status(403).json({ error: "Репетитор пока не подключил онлайн-оплату" })
    return
  }

  const maxLessons = settings.max_lessons || DEFAULT_MAX_LESSONS
  if (lessons > maxLessons) {
    res.status(400).json({ error: `Не больше ${maxLessons} занятий за раз` })
    return
  }

  // 3. Цена занятия — из карточки ученика у репетитора, не из запроса.
  const { data: rows } = await db
    .from("students")
    .select("id, name, phone, lesson_price")
    .eq("tutor_id", account.tutor_id)

  const student = matchStudent(rows || [], account)
  const price = Number(student?.lesson_price || 0)
  if (!student) {
    res.status(400).json({ error: "Не нашли вашу карточку у репетитора" })
    return
  }
  if (!(price > 0)) {
    res.status(400).json({ error: "Репетитор ещё не указал стоимость занятия" })
    return
  }

  const amount = price * lessons
  if (!(amount > 0) || amount > MAX_AMOUNT) {
    res.status(400).json({ error: "Некорректная сумма платежа" })
    return
  }

  const plural = lessons === 1 ? "занятие" : lessons < 5 ? "занятия" : "занятий"
  const description = `Оплата ${lessons} ${plural} · ${student.name || account.name || "ученик"}`

  // 4. Заказ заводим ДО обращения к ЮKassa: его id и будет ключом идемпотентности,
  // а metadata.order_id — тем, по чему вебхук найдёт заказ обратно.
  const { data: order, error: orderErr } = await db
    .from("payment_orders")
    .insert({
      tutor_id: account.tutor_id,
      student_id: student.id,
      account_id: account.id,
      student_name: student.name || account.name || null,
      lessons,
      amount,
      description,
      test: !(process.env.YOOKASSA_SECRET_KEY || "").startsWith("live_"),
    })
    .select("id")
    .single()

  if (orderErr || !order) {
    res.status(500).json({ error: "Не удалось создать заказ", detail: orderErr?.message })
    return
  }

  const site = (process.env.PUBLIC_SITE_URL || "https://precettore.ru").replace(/\/$/, "")
  const payload = {
    amount: { value: money(amount), currency: "RUB" },
    capture: true,                                  // деньги списываются сразу, без двухстадийности
    confirmation: { type: "redirect", return_url: `${site}/?pay=${order.id}` },
    description: description.slice(0, 128),
    metadata: { order_id: order.id, tutor_id: account.tutor_id },
  }

  // Чек по 54-ФЗ. Включается флагом: пока в личном кабинете ЮKassa не выдано
  // разрешение на отправку чеков, поле receipt приводит к ошибке платежа.
  if (process.env.YOOKASSA_RECEIPT === "1") {
    const phone = normPhone(account.phone)
    payload.receipt = {
      customer: phone ? { phone } : { email: body.email || "" },
      items: [{
        description: `Занятие с репетитором (${lessons} шт.)`.slice(0, 128),
        quantity: String(lessons),
        amount: { value: money(price), currency: "RUB" },
        vat_code: 1,                 // без НДС — режим НПД / УСН
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
      await db.from("payment_orders").update({ status: "canceled" }).eq("id", order.id)
      res.status(502).json({ error: yk?.description || "ЮKassa отклонила платёж", code: yk?.code })
      return
    }
  } catch (e) {
    await db.from("payment_orders").update({ status: "canceled" }).eq("id", order.id)
    res.status(502).json({ error: "ЮKassa недоступна", detail: String(e?.message || e) })
    return
  }

  const confirmationUrl = yk?.confirmation?.confirmation_url || null
  await db.from("payment_orders")
    .update({ yk_payment_id: yk.id, confirmation_url: confirmationUrl })
    .eq("id", order.id)

  if (!confirmationUrl) {
    res.status(502).json({ error: "ЮKassa не вернула ссылку на оплату" })
    return
  }

  res.status(200).json({ orderId: order.id, amount, confirmationUrl })
}
