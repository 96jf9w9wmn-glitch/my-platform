// Вход репетитора: пять попыток — и аккаунт закрыт на 15 минут.
//
// Почему вход идёт через нас, а не напрямую в GoTrue, как раньше. Счётчик
// попыток в браузере (Auth.jsx) переживал ровно до перезагрузки страницы, а
// подбор пароля вообще не идёт из браузера. У самого GoTrue блокировки по
// аккаунту нет — только общий лимит на адрес, который обходится сменой адреса.
// Поэтому попытку записывает база (supabase/login_guard.sql), а этот
// обработчик — единственное место, через которое пароль репетитора вообще
// доходит до GoTrue: прямой `grant_type=password` Caddy пускает только с
// внутренним заголовком, которого у браузера нет.
//
// Ответ повторяет ответ GoTrue один в один (тот же JSON сессии), поэтому на
// клиенте достаточно `supabase.auth.setSession(...)`.

import { admin } from "./plan-gate.js"
import { rateLimit, clientIp } from "./generate-hw.js"

const SCOPE = "tutor"

function ident(email) {
  return String(email || "").trim().toLowerCase()
}

// Секрет, которым мы отличаем себя от браузера на входе в GoTrue. Пока он не
// задан, Caddy пускает пароль напрямую — вход работает, просто без барьера.
function internalHeader() {
  const secret = process.env.AUTH_PROXY_SECRET
  return secret ? { "X-Internal-Auth": secret } : {}
}

async function guard(db, fn, key) {
  if (!db) return 0
  const { data, error } = await db.rpc(fn, { p_scope: SCOPE, p_ident: key })
  // Миграция не выполнена — вход обязан продолжать работать: забытая миграция
  // не должна запирать репетиторов снаружи их же кабинета.
  if (error) {
    console.error(`login_guard (${fn}):`, error.message)
    return 0
  }
  return Number(data) || 0
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) {
    res.status(500).json({ error: "Сервер не настроен: нет адреса базы" })
    return
  }

  const email = ident(req.body?.email)
  const password = String(req.body?.password || "")
  if (!email || !password) {
    res.status(400).json({ error: "Введите почту и пароль" })
    return
  }

  // Грубый лимит на адрес поверх счётчика по аккаунту: перебор идёт не по
  // одной почте, а по списку.
  const limit = rateLimit(`login:${clientIp(req)}`)
  if (!limit.ok) {
    res.status(429).json({ error: "Слишком много запросов. Попробуйте через минуту.", retryAfter: limit.retryAfter })
    return
  }

  const db = admin()
  const left = await guard(db, "login_guard_left", email)
  if (left > 0) {
    res.status(429).json({
      error: `Слишком много попыток входа. Попробуйте через ${Math.max(1, Math.ceil(left / 60))} мин.`,
      retryAfter: left,
      locked: true,
    })
    return
  }

  let upstream
  try {
    upstream = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        ...internalHeader(),
      },
      body: JSON.stringify({ email, password }),
    })
  } catch (err) {
    console.error("auth-login upstream:", err)
    res.status(502).json({ error: "Сервер авторизации недоступен" })
    return
  }

  const payload = await upstream.json().catch(() => ({}))

  if (upstream.ok && payload?.access_token) {
    await guard(db, "login_guard_reset", email)
    res.status(200).json(payload)
    return
  }

  // 400 от GoTrue — это «неверные данные»; всё остальное (503, 500) не вина
  // человека за клавиатурой, и записывать это в его счётчик нельзя.
  if (upstream.status === 400) {
    const locked = await guard(db, "login_guard_fail", email)
    if (locked > 0) {
      res.status(429).json({
        error: `Слишком много попыток входа. Вход закрыт на ${Math.max(1, Math.ceil(locked / 60))} мин.`,
        retryAfter: locked,
        locked: true,
      })
      return
    }
  }

  res.status(upstream.status || 400).json({
    error: payload?.error_description || payload?.msg || payload?.message || "Неверная почта или пароль",
  })
}
