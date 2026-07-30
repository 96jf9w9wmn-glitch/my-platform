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

// Токен ученика или родителя. В отличие от репетитора, они не заведены в
// auth.users, поэтому GoTrue им сессию не выдаёт — токен приходит из RPC входа
// (student_login / student_validate_session / parent_login) и хранится здесь.
// Без него их запросы идут под ролью anon, которой после включения RLS не
// доступно ничего. См. supabase/rls_step2_identity.sql
const APP_TOKEN_KEY = "app_jwt"

export function setAppToken(token) {
  if (token) localStorage.setItem(APP_TOKEN_KEY, token)
  else localStorage.removeItem(APP_TOKEN_KEY)
  // Realtime держит отдельное соединение и свой заголовок — подмена fetch его
  // не касается. Без этого чат и доска у ученика замолчат при включённом RLS.
  try { supabase?.realtime?.setAuth(token || SUPABASE_ANON_KEY) } catch { /* до создания клиента */ }
}

export function getAppToken() {
  try { return localStorage.getItem(APP_TOKEN_KEY) } catch { return null }
}

// Подменяем Authorization на лету, а не через опцию accessToken: та отключает
// собственный auth клиента, а он нужен репетитору. Репетитор и ученик никогда
// не залогинены одновременно, поэтому конфликта нет: если токен ученика лежит
// в хранилище, он и уходит в заголовке.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: (input, init = {}) => {
      const token = getAppToken()
      if (token) {
        init.headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` }
      }
      return fetch(input, init)
    },
  },
})
