// Вход репетитора по почте и паролю.
//
// Раньше это был прямой `supabase.auth.signInWithPassword`. Теперь запрос идёт
// через свой обработчик `/api/auth-login`: у GoTrue нет блокировки по аккаунту,
// а счётчик попыток в браузере переживал только до перезагрузки страницы.
// Обработчик считает попытки в базе (пять — и вход закрыт на 15 минут) и
// возвращает ту же самую сессию GoTrue, которую мы кладём в клиент сами.
import { supabase } from "./supabase"

export async function tutorSignIn(email, password) {
  let res
  try {
    res = await fetch("/api/auth-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error("Не удалось связаться с сервером. Проверьте соединение.")
  }

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(payload?.error || "Неверная почта или пароль")
    // Сколько ждать — говорит сервер: форма показывает обратный отсчёт и
    // держит кнопку выключенной, а не выдумывает свой срок.
    if (payload?.retryAfter) err.retryAfter = Number(payload.retryAfter)
    throw err
  }
  if (!payload?.access_token) throw new Error("Сервер не вернул сессию")

  // Сессию кладём в клиент руками: дальше supabase-js сам обновляет токен по
  // refresh_token — этот путь у GoTrue открыт и через прокси не идёт.
  const { data, error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  })
  if (error) throw error
  const user = data?.user || payload.user
  if (!user) throw new Error("Сервер не вернул пользователя")
  return { user, session: data?.session || null }
}
