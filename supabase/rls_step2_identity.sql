-- Шаг 2 RLS: дать ученику и родителю способ доказать базе, кто они.
--
-- Проблема, из-за которой RLS годами оставался декоративным: ученик и родитель
-- не заведены в auth.users, у них нет auth.uid(), их клиент ходит под ролью
-- anon. Поэтому политики писали как «using (true)» — то есть не писали вовсе.
--
-- Старый план (supabase/rls_migration_plan.md) предлагал увести КАЖДУЮ
-- ученическую операцию в SECURITY DEFINER RPC — это несколько десятков функций
-- и переписывание клиента. Здесь выбран другой путь: выдавать ученику и
-- родителю настоящий JWT, подписанный тем же секретом, которым PostgREST
-- проверяет токены. Тогда RLS работает нативно, а клиентские запросы остаются
-- как есть — меняется только заголовок Authorization.
--
-- Секрет доступен внутри базы как app.settings.jwt_secret (задан на уровне
-- базы postgres) и совпадает с JWT_SECRET из .env — проверено.

begin;

create extension if not exists pgjwt with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Роль, под которой ходят ученик и родитель
-- ---------------------------------------------------------------------------
-- Отдельная от authenticated: у той свои гранты и политики репетитора.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin noinherit;
  end if;
end $$;

-- PostgREST переключается в роль из claim role, для этого authenticator
-- должен иметь право SET ROLE в неё.
grant app_user to authenticator;
grant usage on schema public to app_user;

-- ---------------------------------------------------------------------------
-- 2. Кто сейчас в запросе
-- ---------------------------------------------------------------------------
-- account_id     — ученик (student_accounts.id)
-- student_row_id — родитель (students.id, карточка ребёнка у репетитора)
create or replace function public.current_account_id() returns uuid
language sql stable security invoker set search_path = public as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'account_id', '')::uuid
$$;

create or replace function public.current_parent_student_id() returns bigint
language sql stable security invoker set search_path = public as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'student_row_id', '')::bigint
$$;

-- Телефон текущего ученика — по нему связаны student_accounts и students.
-- SECURITY DEFINER: сам ученик читать чужие строки не должен, а функции нужен
-- доступ к таблице до применения политик.
create or replace function public.current_student_phone() returns text
language sql stable security definer set search_path = public as $$
  select phone from student_accounts where id = public.current_account_id()
$$;

-- Карточки этого ученика у всех его репетиторов (учеников бывает несколько).
create or replace function public.current_student_rows() returns setof bigint
language sql stable security definer set search_path = public as $$
  select s.id from students s
  where s.phone is not null and s.phone = public.current_student_phone()
$$;

grant execute on function public.current_account_id(),
                        public.current_parent_student_id(),
                        public.current_student_phone(),
                        public.current_student_rows()
  to anon, authenticated, app_user;

-- ---------------------------------------------------------------------------
-- 3. Выдача токенов
-- ---------------------------------------------------------------------------
-- Токен живёт 12 часов. Ученик получает его при входе; клиент хранит рядом с
-- session_token и обновляет через student_validate_session.
create or replace function public.issue_student_jwt(p_account_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select extensions.sign(
    json_build_object(
      'role', 'app_user',
      'account_id', p_account_id::text,
      'iat', extract(epoch from now())::int,
      'exp', extract(epoch from now())::int + 43200
    ),
    current_setting('app.settings.jwt_secret')
  )
$$;

create or replace function public.issue_parent_jwt(p_student_row_id bigint) returns text
language sql stable security definer set search_path = public as $$
  select extensions.sign(
    json_build_object(
      'role', 'app_user',
      'student_row_id', p_student_row_id::text,
      'iat', extract(epoch from now())::int,
      'exp', extract(epoch from now())::int + 43200
    ),
    current_setting('app.settings.jwt_secret')
  )
$$;

revoke execute on function public.issue_student_jwt(uuid) from public, anon, authenticated, app_user;
revoke execute on function public.issue_parent_jwt(bigint) from public, anon, authenticated, app_user;

-- Вход родителя по коду ребёнка. Раньше клиент делал это прямым запросом
-- `students.select(*).eq(parent_code, ...)`, что требовало держать всю таблицу
-- открытой на чтение анониму.
create or replace function public.parent_login(p_code text)
returns table (student_id bigint, student_name text, tutor_id uuid, token text)
language plpgsql stable security definer set search_path = public as $$
declare v_row students%rowtype;
begin
  select * into v_row from students
   where parent_code is not null and upper(parent_code) = upper(trim(p_code))
   limit 1;
  if not found then return; end if;
  return query select v_row.id, v_row.name, v_row.tutor_id,
                      public.issue_parent_jwt(v_row.id);
end $$;

grant execute on function public.parent_login(text) to anon, authenticated, app_user;

commit;
