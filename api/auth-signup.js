// Регистрация репетитора в два шага: код на почту, потом аккаунт.
//
// Зачем. Раньше аккаунт заводился одним нажатием, и адрес не проверялся вовсе:
// зарегистрироваться можно было на чужую почту или на несуществующую. Второе
// хуже, чем кажется, — сброс пароля идёт письмом, то есть человек оставался бы
// без доступа к собственному кабинету.
//
// Почему аккаунт создаёт сервер, а не браузер. Проверка кода на клиенте — это
// не проверка: запрос к GoTrue можно послать и мимо неё. Поэтому GoTrue создаёт
// пользователя только отсюда, под service_role, и только после сверки кода.
// Каждый шаг ограничен: пять неверных кодов — и код сгорает.
//
// Ученику второй фактор так не сделать: почта у него не спрашивается вовсе
// (регистрация по телефону), а SMS требует провайдера — это отдельный долг.

import crypto from "node:crypto"
import { admin } from "./plan-gate.js"
import { rateLimit, clientIp } from "./generate-hw.js"
import { sendMail } from "../server/mailer.js"

const CODE_TTL_MIN = 10
const MAX_TRIES = 5
const RESEND_SEC = 60

const norm = (email) => String(email || "").trim().toLowerCase()
const looksLikeEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)

// Хэш с серверным секретом: без него утечка таблицы означала бы готовые коды.
function hash(code) {
  const pepper = process.env.AUTH_PROXY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  return crypto.createHash("sha256").update(`${code}:${pepper}`).digest("hex")
}

function newCode() {
  // crypto, а не Math.random: предсказуемый код — это отсутствие проверки.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0")
}

async function emailTaken(url, key, email) {
  const res = await fetch(`${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) return false
  const data = await res.json().catch(() => ({}))
  return (data?.users || []).some((u) => norm(u.email) === email)
}

async function start(db, url, key, email, res) {
  if (await emailTaken(url, key, email)) {
    res.status(409).json({ error: "Этот адрес уже зарегистрирован. Войдите или восстановите пароль." })
    return
  }

  const { data: prev } = await db.from("email_codes").select("created_at").eq("email", email).maybeSingle()
  if (prev?.created_at && Date.now() - new Date(prev.created_at).getTime() < RESEND_SEC * 1000) {
    res.status(429).json({ error: `Код уже отправлен. Повторить можно через ${RESEND_SEC} секунд.` })
    return
  }

  const code = newCode()
  const { error } = await db.from("email_codes").upsert({
    email,
    code_hash: hash(code),
    expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
    tries: 0,
    created_at: new Date().toISOString(),
  })
  if (error) {
    console.error("[регистрация] код не сохранился:", error.message)
    res.status(500).json({ error: "Не удалось отправить код. Попробуйте позже." })
    return
  }

  await sendMail({
    to: email,
    subject: `Precettore: код подтверждения ${code}`,
    text: [
      `Код подтверждения: ${code}`,
      "",
      `Он нужен, чтобы завершить регистрацию, и действует ${CODE_TTL_MIN} минут.`,
      "",
      "Если регистрацию начинали не вы — просто не вводите код: без него аккаунт не создастся.",
    ].join("\n"),
  })
  res.status(200).json({ ok: true, resendAfter: RESEND_SEC })
}

async function verify(db, url, key, anon, body, email, res) {
  const code = String(body?.code || "").trim()
  const password = String(body?.password || "")
  const name = String(body?.name || "").trim()
  if (!/^\d{6}$/.test(code)) { res.status(400).json({ error: "Код состоит из шести цифр" }); return }
  if (password.length < 6) { res.status(400).json({ error: "Пароль минимум 6 символов" }); return }
  if (!name) { res.status(400).json({ error: "Введите имя" }); return }

  const { data: row } = await db
    .from("email_codes").select("code_hash, expires_at, tries").eq("email", email).maybeSingle()
  if (!row) { res.status(400).json({ error: "Код не запрашивали. Начните регистрацию заново." }); return }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.from("email_codes").delete().eq("email", email)
    res.status(400).json({ error: "Код устарел. Запросите новый." })
    return
  }
  if (row.tries >= MAX_TRIES) {
    await db.from("email_codes").delete().eq("email", email)
    res.status(429).json({ error: "Слишком много попыток. Запросите новый код." })
    return
  }
  if (row.code_hash !== hash(code)) {
    await db.from("email_codes").update({ tries: row.tries + 1 }).eq("email", email)
    const left = MAX_TRIES - row.tries - 1
    res.status(400).json({ error: left > 0 ? `Неверный код. Осталось попыток: ${left}` : "Неверный код. Запросите новый." })
    return
  }

  // Код верный — заводим аккаунт. email_confirm: адрес только что подтверждён
  // этим самым кодом, второй раз спрашивать нечего.
  const created = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  const user = await created.json().catch(() => ({}))
  if (!created.ok || !user?.id) {
    res.status(created.status === 422 ? 409 : 500).json({
      error: created.status === 422
        ? "Этот адрес уже зарегистрирован. Войдите или восстановите пароль."
        : "Не удалось создать аккаунт. Попробуйте позже.",
    })
    return
  }

  // Карточка репетитора. Код для учеников база выдаёт сама (default у колонки).
  const { error: profileError } = await db.from("tutors").insert({ id: user.id, email, name })
  if (profileError) console.error("[регистрация] профиль не создан:", profileError.message)

  await db.from("email_codes").delete().eq("email", email)

  // Сразу отдаём сессию, чтобы человек попал в кабинет без второго входа.
  // Заголовок обязателен: Caddy пускает password-grant только от нас.
  const session = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
      ...(process.env.AUTH_PROXY_SECRET ? { "X-Internal-Auth": process.env.AUTH_PROXY_SECRET } : {}),
    },
    body: JSON.stringify({ email, password }),
  })
  const payload = await session.json().catch(() => ({}))
  if (!session.ok || !payload?.access_token) {
    res.status(200).json({ created: true, user, session: null })
    return
  }
  res.status(200).json({ created: true, ...payload })
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const db = admin()
  if (!url || !anon || !db) {
    res.status(503).json({ error: "Регистрация временно недоступна" })
    return
  }

  const limit = rateLimit(`signup:${clientIp(req)}`)
  if (!limit.ok) {
    res.status(429).json({ error: "Слишком много запросов. Попробуйте через минуту.", retryAfter: limit.retryAfter })
    return
  }

  const email = norm(req.body?.email)
  if (!looksLikeEmail(email)) { res.status(400).json({ error: "Проверьте адрес почты" }); return }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (req.body?.action === "verify") return verify(db, url, key, anon, req.body, email, res)
  return start(db, url, key, email, res)
}
