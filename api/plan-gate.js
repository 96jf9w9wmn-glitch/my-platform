// Серверная проверка тарифа: чем репетитору можно пользоваться и сколько ему
// осталось ИИ-генераций. Общий модуль для api/subscription.js, api/generate-hw.js
// и api/yookassa.js — вынесен отдельно, чтобы эти функции не импортировали друг
// друга по кругу.
//
// Ограничения в интерфейсе — это подсказка, а не защита: клиенту можно подменить
// запрос. Настоящий барьер стоит здесь, на сервере, и ровно там, где это важно:
// ИИ-генерация (стоит денег в DeepSeek) и приём онлайн-оплаты от учеников.
//
// Тарифы и лимиты берутся из src/plans.js — того же файла, что и у клиента.

import { createClient } from "@supabase/supabase-js"
import { effectivePlan, can, limitOf } from "../src/plans.js"

export function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// Магазин ПЛАТФОРМЫ (подписка репетитора). Пока отдельный магазин не заведён,
// берётся магазин репетитора — допустимо, только пока платформа
// однопользовательская, см. docs/subscriptions.md.
export function ykPlatformAuth() {
  const shopId = platformShopId()
  const secret = platformSecret()
  if (!shopId || !secret) return null
  return "Basic " + Buffer.from(`${shopId}:${secret}`).toString("base64")
}

export function platformShopId() {
  return process.env.YOOKASSA_PLATFORM_SHOP_ID || process.env.YOOKASSA_SHOP_ID || null
}

export function platformSecret() {
  return process.env.YOOKASSA_PLATFORM_SECRET_KEY || process.env.YOOKASSA_SECRET_KEY || ""
}

// Таблиц подписки может ещё не быть (миграция subscriptions.sql не выполнена).
// Тогда биллинг просто не установлен — и функциональность резать НЕЛЬЗЯ, иначе
// невыполненная миграция молча сломает уже работающие фичи. Это принципиально
// другой случай, чем «репетитор на бесплатном тарифе».
const MISSING = new Set(["42P01", "PGRST202", "PGRST205", "PGRST106", "42883"])

export const isMissingSchema = (error) => Boolean(error && MISSING.has(error.code))

// { sub, installed } — сама подписка и признак «биллинг установлен».
export async function tutorPlan(db, tutorId) {
  if (!tutorId) return { sub: null, installed: true }
  const { data, error } = await db
    .from("tutor_subscriptions")
    .select("plan, status, current_period_end")
    .eq("tutor_id", tutorId)
    .maybeSingle()
  if (isMissingSchema(error)) return { sub: null, installed: false }
  return { sub: data || null, installed: true }
}

// Доступна ли возможность («variants», «onlinePay», …) на текущем тарифе.
export async function featureAllowed(db, tutorId, feature) {
  const { sub, installed } = await tutorPlan(db, tutorId)
  if (!installed) return { ok: true, sub: null, installed: false }
  return { ok: can(sub, feature), sub, installed: true }
}

// Списание одной ИИ-генерации: { ok, used, limit, plan }.
export async function bumpAiUsage(db, tutorId) {
  const { sub, installed } = await tutorPlan(db, tutorId)
  if (!installed) return { ok: true, used: 0, limit: -1, plan: null, installed: false }

  const plan = effectivePlan(sub)
  const limit = limitOf(sub, "aiHomework")
  if (limit === 0) return { ok: false, used: 0, limit: 0, plan, installed: true }

  const { data, error } = await db.rpc("usage_bump_ai", { p_tutor: tutorId, p_limit: limit })
  if (error) {
    // Счётчика нет — право на возможность уже проверено по тарифу выше,
    // из-за отсутствующей инфраструктуры работу не блокируем.
    if (isMissingSchema(error)) return { ok: true, used: 0, limit, plan, installed: true }
    return { ok: false, used: 0, limit, plan, installed: true, error: error.message }
  }
  const row = Array.isArray(data) ? data[0] : data
  return { ok: Boolean(row?.allowed), used: Number(row?.used || 0), limit, plan, installed: true }
}

// Возврат списанной генерации, если генерация в итоге не состоялась.
export async function refundAiUsage(db, tutorId) {
  if (!db || !tutorId) return
  try {
    await db.rpc("usage_refund_ai", { p_tutor: tutorId })
  } catch {
    // Возврат — вежливость, а не обязательство: падать из-за него нельзя.
  }
}

// Репетитор из заголовка Authorization: Bearer <supabase access_token>.
export async function tutorFromRequest(db, req) {
  const raw = req.headers.authorization || req.headers.Authorization || ""
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : ""
  if (!token) return null
  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

// Модуль вспомогательный, но лежит в api/, поэтому у него есть свой адрес.
// Отвечаем честным 404, чтобы случайный запрос не выглядел как поломка сервера.
export default function handler(req, res) {
  res.status(404).json({ error: "Not found" })
}
