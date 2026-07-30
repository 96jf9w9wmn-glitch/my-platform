import { createClient } from "@supabase/supabase-js"

// Адрес базы и публичный ключ берутся из окружения, чтобы переключение
// на российский сервер (242-ФЗ) было сменой переменных, а не правкой кода.
// Локально — .env.local, в проде — переменные окружения Vercel.
// См. .env.example и supabase/selfhost/README.md
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Скопируйте .env.example в .env.local и подставьте значения."
  )
}

// Переход по ссылке «сброс пароля» из письма определяем ЗДЕСЬ и до createClient.
// Причина: клиент сам разбирает адрес, забирает из hash токены и вычищает его
// через history.replaceState, а событие PASSWORD_RECOVERY рассылает сразу же —
// до того, как React смонтируется и успеет подписаться. То есть к первому
// рендеру оба признака уже потеряны, и проверять их в компоненте бесполезно.
export const isPasswordRecovery =
  typeof window !== "undefined" && /[#&]type=recovery/.test(window.location.hash)

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
