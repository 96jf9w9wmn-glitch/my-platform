-- Шаг 4 RLS: RPC входа теперь выдают ещё и JWT.
--
-- session_token остаётся как был — на нём держится восстановление сессии и
-- проверки внутри других RPC. JWT добавляется рядом: он нужен, чтобы запросы
-- ученика проходили под ролью app_user и попадали под свои политики.
--
-- Меняется тип возврата, поэтому функции пересоздаются через drop.

begin;

drop function if exists public.student_login(text, text);
create function public.student_login(p_phone text, p_password text)
returns table (id uuid, name text, phone text, avatar text,
               tutor_id uuid, tutor_code text, session_token uuid, token text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select a.id::uuid, a.name::text, a.phone::text, a.avatar::text,
           a.tutor_id::uuid, a.tutor_code::text, a.session_token::uuid,
           public.issue_student_jwt(a.id)
    from student_accounts a
    where a.phone = p_phone
      and a.password_hash = extensions.crypt(p_password, a.password_hash);
end $$;

drop function if exists public.student_validate_session(uuid, uuid);
create function public.student_validate_session(p_id uuid, p_token uuid)
returns table (id uuid, name text, phone text, avatar text,
               tutor_id uuid, tutor_code text, session_token uuid, token text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Здесь же выдаётся свежий JWT: он живёт 12 часов, а восстановление сессии
  -- происходит при каждом открытии приложения — этого достаточно, чтобы
  -- токен не протухал у активного ученика.
  return query
    select a.id::uuid, a.name::text, a.phone::text, a.avatar::text,
           a.tutor_id::uuid, a.tutor_code::text, a.session_token::uuid,
           public.issue_student_jwt(a.id)
    from student_accounts a
    where a.id = p_id and a.session_token = p_token;
end $$;

drop function if exists public.student_register(text, text, text);
create function public.student_register(p_phone text, p_password text, p_name text)
returns table (id uuid, name text, phone text, avatar text,
               tutor_id uuid, tutor_code text, session_token uuid, token text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_new_id uuid; v_token uuid;
begin
  if exists (select 1 from student_accounts sa where sa.phone = p_phone) then
    raise exception 'Этот номер уже зарегистрирован';
  end if;
  v_token := gen_random_uuid();
  insert into student_accounts (name, phone, password_hash, session_token)
  values (p_name, p_phone, extensions.crypt(p_password, extensions.gen_salt('bf', 12)), v_token)
  returning student_accounts.id into v_new_id;
  return query
    select a.id::uuid, a.name::text, a.phone::text, a.avatar::text,
           a.tutor_id::uuid, a.tutor_code::text, a.session_token::uuid,
           public.issue_student_jwt(a.id)
    from student_accounts a where a.id = v_new_id;
end $$;

grant execute on function public.student_login(text, text) to anon, authenticated, app_user;
grant execute on function public.student_validate_session(uuid, uuid) to anon, authenticated, app_user;
grant execute on function public.student_register(text, text, text) to anon, authenticated, app_user;

commit;
