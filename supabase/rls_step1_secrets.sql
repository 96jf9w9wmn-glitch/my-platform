-- Шаг 1 RLS: закрыть хэши паролей и токены сессий от публичного ключа.
--
-- ДО этой миграции живой пробой подтверждено:
--   curl .../rest/v1/student_accounts?select=phone,password_hash,session_token
--   отдавал анониму bcrypt-хэши и активные session_token. С токеном можно было
--   войти под любым учеником вообще без пароля.
--
-- Почему колоночный revoke из auth_hardening.sql не сработал: поверх table-level
-- гранта он не действует. Нужно сначала снять грант с таблицы целиком, а потом
-- выдать его на конкретные колонки — порядок здесь принципиален.
--
-- Список колонок сверен с клиентом: ни один запрос не читает password_hash и
-- session_token, все select перечисляют поля явно (App.jsx, Chat.jsx,
-- Results.jsx, Variants.jsx, AddStudentModal, StudentDashboard). Записываются
-- из клиента только avatar / exam_goal / grade / target_score / onboarded /
-- tutor_id / tutor_code / name. Всё остальное идёт через SECURITY DEFINER RPC
-- (student_login, student_register, student_reset_password,
-- student_validate_session), которые бегут от владельца и этих ограничений
-- не касаются.

begin;

-- 1. Чтение: снимаем табличный грант и возвращаем по колонкам, без секретов.
revoke select on public.student_accounts from anon, authenticated;
grant select (
  id, email, name, tutor_code, tutor_id, created_at,
  phone, avatar, exam_goal, grade, target_score, onboarded
) on public.student_accounts to anon, authenticated;

-- 2. Запись: только те поля, которые реально меняет клиент.
revoke update on public.student_accounts from anon, authenticated;
grant update (
  avatar, exam_goal, grade, target_score, onboarded, tutor_id, tutor_code, name
) on public.student_accounts to anon, authenticated;

-- 3. Создание и удаление аккаунтов — только через RPC.
revoke insert, delete, truncate, references, trigger
  on public.student_accounts from anon, authenticated;

commit;

-- Проверка (должна вернуть ошибку доступа):
--   set local role anon;
--   select password_hash from public.student_accounts limit 1;
