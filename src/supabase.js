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

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
