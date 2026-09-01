// Загрузка профиля репетитора одной функцией — и в App при восстановлении
// сессии, и в Auth сразу после входа/регистрации.
//
// Зачем отдельный файл: `select("*")` у PostgREST требует SELECT на КАЖДУЮ
// колонку таблицы. Стоит появиться новой колонке без гранта роли
// `authenticated` — и весь запрос отдаёт 42501, то есть кабинет остаётся вовсе
// без профиля: пропадают имя, тариф и «Код для учеников». Так уже ломала
// кабинет колонка marketing_opt_in (см. supabase/user_consents.sql).
//
// Поэтому на ошибку есть запасной путь: перечитать поимённо те поля, без
// которых кабинет неполноценен. Код для учеников — среди них: без него
// репетитор не может привязать к себе ни одного ученика.
import { supabase } from "./supabase"

// Поля, которые обязаны доехать даже при потере гранта на что-то новое.
const CORE = "id, email, name, code, subject, bank_subjects, onboarding_completed"

export async function loadTutorProfile(id) {
  const { data, error } = await supabase.from("tutors").select("*").eq("id", id).single()
  if (data && data.code) return data
  const { data: core, error: coreError } = await supabase
    .from("tutors").select(CORE).eq("id", id).single()
  if (coreError) {
    console.error("Профиль репетитора не загрузился:", error || coreError)
    return data || null
  }
  // Широкий запрос мог пройти и просто не довезти код (его не бывает, но
  // проверка дешёвая) — тогда дополняем его, а не заменяем целиком.
  return data ? { ...data, ...core } : core
}
