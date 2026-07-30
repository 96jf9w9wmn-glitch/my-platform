-- Ужесточение доступа по итогам аудита 30.07.2026.
-- ВЫПОЛНИТЬ В Supabase → SQL Editor. Идемпотентно, можно гонять повторно.
--
-- Что делает:
--   1) student_accounts: секретные колонки (password_hash, session_token)
--      закрываются от ролей anon/authenticated — работать с ними должны только
--      SECURITY DEFINER RPC из auth_hardening.sql, а не клиент напрямую.
--   2) Ротация session_token — гигиена после смены прав доступа.
--      ВНИМАНИЕ: разлогинит всех учеников, войдут заново по паролю. Так и надо.
--   3) leads: чтение и ведение воронки — только у владельца платформы,
--      а не у любого пользователя с аккаунтом.
--
-- Фронтенд НЕ ломается: password_hash/session_token он не читает
-- (App.jsx выбрасывает session_token из ответа RPC), а логин/регистрация/сброс
-- идут через SECURITY DEFINER RPC — те выполняются от владельца функции,
-- и колоночные гранты anon им не мешают.

-- 1. student_accounts: anon больше не видит секретные колонки ------------------
--
-- Почему не хватило `revoke select (password_hash, session_token)` из
-- auth_hardening.sql: в Postgres колоночный REVOKE не отменяет table-level
-- GRANT SELECT, который Supabase выдаёт anon по умолчанию. Поэтому сначала
-- снимаем табличный грант целиком, а потом выдаём поколоночно — всё, кроме
-- секретов. Перечисление колонок обязано быть полным, иначе отвалится фронт.

revoke select on public.student_accounts from anon, authenticated;

grant select (
  id, email, name, tutor_code, tutor_id, created_at, phone, avatar,
  exam_goal, grade, target_score, onboarded
) on public.student_accounts to anon, authenticated;

-- Записи секретов и так нет (триггер guard_student_account_secrets из
-- auth_hardening.sql), но снимем и колоночные права на всякий случай.
revoke insert (password_hash, session_token) on public.student_accounts from anon, authenticated;
revoke update (password_hash, session_token) on public.student_accounts from anon, authenticated;

-- Проверка: должно вернуть 0 строк. Если вернуло — грант остался, разбирайся.
--   select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--   where table_name = 'student_accounts'
--     and column_name in ('password_hash','session_token')
--     and grantee in ('anon','authenticated');

-- 2. Ротация токенов сессии ---------------------------------------------------
--
-- Старые токены могли быть выгружены кем угодно, пока действовал грант выше.
-- Строка закомментирована НАМЕРЕННО: она разлогинит всех учеников разом.
-- Раскомментируй и выполни, когда готов к этому (лучше сразу — утечка реальна).

-- update public.student_accounts set session_token = gen_random_uuid();

-- 3. leads: заявки с лендинга читает только владелец платформы -----------------
--
-- Было: FOR SELECT/UPDATE TO authenticated USING (true) — регистрация репетитора
-- открыта, значит контакты всех лидов выгружал любой желающий.
-- Стало: список админов платформы в отдельной таблице.

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Список админов не должен быть виден никому из клиента: политик нет вообще,
-- значит через anon/authenticated таблица недоступна. Правится только отсюда,
-- из SQL Editor (он работает под service_role и RLS обходит).

-- >>> ПОДСТАВЬ СВОЙ EMAIL РЕПЕТИТОРА-ВЛАДЕЛЬЦА <<<
insert into public.platform_admins (user_id, note)
select id, 'владелец платформы' from auth.users
where email = 'ПОСТАВЬ_СЮДА_СВОЙ_EMAIL'
on conflict (user_id) do nothing;

-- Оставить заявку по-прежнему может кто угодно — это форма на лендинге.
DROP POLICY IF EXISTS leads_public_insert ON public.leads;
CREATE POLICY leads_public_insert ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Старые имена (leads_tutor_*) сносим, новые тоже — иначе повторный прогон
-- файла упадёт на CREATE POLICY «уже существует».
DROP POLICY IF EXISTS leads_tutor_read ON public.leads;
DROP POLICY IF EXISTS leads_admin_read ON public.leads;
CREATE POLICY leads_admin_read ON public.leads
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS leads_tutor_update ON public.leads;
DROP POLICY IF EXISTS leads_admin_update ON public.leads;
CREATE POLICY leads_admin_update ON public.leads
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ЧТО ОСТАЁТСЯ ПОСЛЕ ЭТОГО ФАЙЛА (гранты тут не помогут, нужен RLS + RPC-слой):
--   • Таблицы из списка известных долгов (students, homework, notifications,
--     chat_messages, variants, variant_submissions, boards, tutors) по-прежнему
--     без RLS. План — supabase/rls_migration_plan.md, делать по таблице за раз,
--     на РФ-базе, чтобы не мигрировать дважды.
--   • Storage-бакеты нужно перевести в приватные + signed URL.
--   • Подробности аудита — вне репозитория (репо публичный).
