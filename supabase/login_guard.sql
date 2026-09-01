-- Лимит попыток входа: пять неудач — и вход по этому аккаунту закрыт на 15 минут.
--
-- Почему в базе, а не в браузере. Счётчик в React (Auth.jsx) переживал ровно до
-- перезагрузки страницы, а подбор пароля идёт вообще не из браузера. Лимит в
-- Caddy (15/мин на адрес) режет скорость, но не число попыток по конкретному
-- аккаунту и обходится сменой адреса. Единственное место, где попытку видно
-- вне зависимости от клиента и адреса, — сама база.
--
-- ВАЖНО про транзакции. У PostgREST один вызов = одна транзакция, поэтому
-- `raise exception` откатывает и запись счётчика. Отсюда порядок: неудачную
-- попытку мы ЗАПИСЫВАЕМ и молча возвращаем пустой ответ («неверный пароль»),
-- а исключение бросаем только на СЛЕДУЮЩЕМ вызове, когда блокировка уже
-- записана и в этой транзакции мы ничего не пишем.

create table if not exists public.login_attempts (
  scope        text        not null,               -- tutor | student | parent
  ident        text        not null,               -- почта, цифры телефона или адрес
  fails        integer     not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (scope, ident)
);

alter table public.login_attempts enable row level security;
-- Политик нет намеренно: таблицу не читает и не пишет никто, кроме функций
-- ниже (SECURITY DEFINER). Гранты снимаем явно — Supabase выдаёт табличные
-- права ролям по умолчанию, и без revoke аноним увидел бы, какие адреса
-- заблокированы.
revoke all on public.login_attempts from anon, authenticated, app_user;

comment on table public.login_attempts is
  'Неудачные попытки входа. Пять за 15 минут — блокировка на 15 минут.';

-- Порог и окно держим в одном месте: их видно и в ошибке пользователю.
create or replace function public.login_guard_max() returns integer
  language sql immutable as $$ select 5 $$;
create or replace function public.login_guard_window() returns interval
  language sql immutable as $$ select interval '15 minutes' $$;

-- Сколько секунд осталось блокировки. 0 — входить можно.
create or replace function public.login_guard_left(p_scope text, p_ident text)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_until timestamptz;
begin
  if coalesce(p_ident, '') = '' then return 0; end if;
  select locked_until into v_until
    from login_attempts where scope = p_scope and ident = p_ident;
  if v_until is null or v_until <= now() then return 0; end if;
  return ceil(extract(epoch from (v_until - now())))::integer;
end $$;

-- Записать неудачу. Возвращает секунды блокировки, если она наступила.
create or replace function public.login_guard_fail(p_scope text, p_ident text)
returns integer
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare v_fails integer;
begin
  if coalesce(p_ident, '') = '' then return 0; end if;

  insert into login_attempts (scope, ident, fails, updated_at)
  values (p_scope, p_ident, 1, now())
  on conflict (scope, ident) do update
    -- Тишина дольше окна — счёт начинается заново: пять опечаток за месяц
    -- не должны копиться в блокировку.
    set fails = case
                  when login_attempts.updated_at < now() - public.login_guard_window()
                    then 1
                  else login_attempts.fails + 1
                end,
        updated_at = now()
  returning fails into v_fails;

  if v_fails >= public.login_guard_max() then
    update login_attempts
       set locked_until = now() + public.login_guard_window(), fails = 0
     where scope = p_scope and ident = p_ident;
    return ceil(extract(epoch from public.login_guard_window()))::integer;
  end if;
  return 0;
end $$;

-- Успешный вход снимает счёт.
create or replace function public.login_guard_reset(p_scope text, p_ident text)
returns void
language sql
volatile
security definer
set search_path to 'public'
as $$
  delete from login_attempts where scope = p_scope and ident = p_ident;
$$;

-- Функции — служебные: их зовут другие SECURITY DEFINER функции и серверный
-- обработчик входа репетитора под service_role. Клиенту они не нужны.
revoke all on function public.login_guard_left(text, text) from public, anon, authenticated, app_user;
revoke all on function public.login_guard_fail(text, text) from public, anon, authenticated, app_user;
revoke all on function public.login_guard_reset(text, text) from public, anon, authenticated, app_user;
grant execute on function public.login_guard_left(text, text) to service_role;
grant execute on function public.login_guard_fail(text, text) to service_role;
grant execute on function public.login_guard_reset(text, text) to service_role;

-- Адрес клиента для тех входов, где аккаунта ещё нет (родитель заходит по коду
-- ребёнка — считать попытки по самому коду бессмысленно, перебирают как раз
-- коды). Заголовок X-Forwarded-For клиент может подделать, но Caddy дописывает
-- настоящий адрес В КОНЕЦ, а Kong после него — свой. Поэтому берём
-- ПРЕДПОСЛЕДНИЙ элемент: подставить туда чужой адрес клиент уже не может.
create or replace function public.client_ip()
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_raw  text;
  v_list text[];
begin
  v_raw := coalesce(current_setting('request.headers', true), '');
  if v_raw = '' then return ''; end if;
  v_raw := (v_raw::json ->> 'x-forwarded-for');
  if coalesce(v_raw, '') = '' then return ''; end if;
  v_list := regexp_split_to_array(v_raw, '\s*,\s*');
  if array_length(v_list, 1) >= 2 then
    return btrim(v_list[array_length(v_list, 1) - 1]);
  end if;
  return btrim(v_list[1]);
end $$;

-- ---------------------------------------------------------------------------
-- Вход ученика: тот же ответ, что и раньше (пустая выборка = неверные данные),
-- плюс счётчик и отказ после пятой неудачи.
-- ---------------------------------------------------------------------------
create or replace function public.student_login(p_phone text, p_password text)
returns table(id uuid, name text, phone text, avatar text,
              tutor_id uuid, tutor_code text, session_token uuid, token text)
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_ident text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_left  integer;
  v_row   student_accounts%rowtype;
begin
  v_left := public.login_guard_left('student', v_ident);
  if v_left > 0 then
    raise exception 'Слишком много попыток входа. Попробуйте через % мин.',
      greatest(1, ceil(v_left / 60.0)::integer);
  end if;

  select a.* into v_row
    from student_accounts a
   where a.phone = p_phone
     and a.password_hash = extensions.crypt(p_password, a.password_hash);

  if not found then
    perform public.login_guard_fail('student', v_ident);
    return;  -- клиент покажет «Неверный телефон или пароль»
  end if;

  perform public.login_guard_reset('student', v_ident);
  return query
    select v_row.id::uuid, v_row.name::text, v_row.phone::text, v_row.avatar::text,
           v_row.tutor_id::uuid, v_row.tutor_code::text, v_row.session_token::uuid,
           public.issue_student_jwt(v_row.id);
end $$;

-- ---------------------------------------------------------------------------
-- Вход родителя: пароля нет вовсе, вход по коду ребёнка. Считаем по адресу —
-- иначе счётчик на каждый перебираемый код заводился бы свой и не мешал бы
-- переборщику ничем. Функция перестаёт быть STABLE: она пишет счётчик.
-- ---------------------------------------------------------------------------
create or replace function public.parent_login(p_code text)
returns table(student_id bigint, student_name text, tutor_id uuid, token text)
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_ident text := public.client_ip();
  v_left  integer;
  v_row   students%rowtype;
begin
  v_left := public.login_guard_left('parent', v_ident);
  if v_left > 0 then
    raise exception 'Слишком много попыток входа. Попробуйте через % мин.',
      greatest(1, ceil(v_left / 60.0)::integer);
  end if;

  select * into v_row from students
   where parent_code is not null and upper(parent_code) = upper(trim(p_code))
   limit 1;

  if not found then
    perform public.login_guard_fail('parent', v_ident);
    return;
  end if;

  perform public.login_guard_reset('parent', v_ident);
  return query select v_row.id, v_row.name, v_row.tutor_id, public.issue_parent_jwt(v_row.id);
end $$;
