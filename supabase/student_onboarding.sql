-- Регистрация ученика без кода репетитора + поля онбординга + привязка
-- нескольких репетиторов по предметам. Выполнить один раз в Supabase → SQL Editor.
--
-- Что меняется:
--  1. student_register больше НЕ принимает код репетитора — создаёт только аккаунт
--     (имя/телефон/пароль). Это заодно убирает всю хрупкую логику вставок в
--     students/pending_students/notifications из регистрации.
--  2. Ученик проходит опросник в кабинете (экзамен/класс/цель) и привязывает
--     репетиторов по коду с предметом — можно несколько (student_link_tutor).
--  3. Поля профиля ученика (exam_goal/grade/target_score/onboarded) и subject у
--     карточки в ростере репетитора.

-- pgcrypto в схеме extensions (см. auth_hardening.sql)
create extension if not exists pgcrypto with schema extensions;

-- 1. Поля профиля ученика ---------------------------------------------------
alter table public.student_accounts
  add column if not exists exam_goal text,        -- 'ОГЭ' | 'ЕГЭ'
  add column if not exists grade smallint,         -- класс 7..11
  add column if not exists target_score smallint,  -- цель по баллам/оценка
  add column if not exists onboarded boolean not null default false;

-- Уже привязанные ученики (есть репетитор) опросник не проходят — помечаем.
update public.student_accounts set onboarded = true
  where tutor_id is not null and onboarded = false;

-- Репетитор больше не обязателен при регистрации — снимаем NOT NULL, если он был.
alter table public.student_accounts alter column tutor_id drop not null;
alter table public.student_accounts alter column tutor_code drop not null;

-- 2. Предмет в карточке ученика (мультирепетитор по предметам) ---------------
alter table public.students
  add column if not exists subject text;

-- 3. Регистрация без репетитора --------------------------------------------
drop function if exists public.student_register(text, text, text, text);
drop function if exists public.student_register(text, text, text);

create or replace function public.student_register(
  p_phone text, p_password text, p_name text
)
returns table (
  id uuid, name text, phone text, avatar text,
  tutor_id uuid, tutor_code text, session_token uuid
)
language plpgsql security definer set search_path = public, extensions as $register$
declare
  v_new_id uuid;
  v_token uuid;
begin
  if exists (select 1 from student_accounts sa where sa.phone = p_phone) then
    raise exception 'Этот номер уже зарегистрирован';
  end if;

  v_token := gen_random_uuid();

  insert into student_accounts (name, phone, password_hash, session_token)
  values (p_name, p_phone, extensions.crypt(p_password, extensions.gen_salt('bf', 12)), v_token)
  returning student_accounts.id into v_new_id;

  return query
    select a.id::uuid, a.name::text, a.phone::text, a.avatar::text, a.tutor_id::uuid, a.tutor_code::text, a.session_token::uuid
    from student_accounts a where a.id = v_new_id;
end;
$register$;

-- 4. Привязка репетитора по коду с предметом (можно вызывать несколько раз) --
-- Проверяет сессию ученика (id + токен), находит репетитора по коду, заводит/
-- дополняет карточку ученика в его ростере, создаёт заявку + уведомление.
-- Первый привязанный репетитор становится «основным» (student_accounts.tutor_id)
-- — так текущая загрузка данных по одному tutor_id продолжает работать.
create or replace function public.student_link_tutor(
  p_student_id uuid, p_token uuid, p_code text, p_subject text
)
returns table (tutor_id uuid, tutor_name text)
language plpgsql security definer set search_path = public, extensions as $link$
declare
  v_tutor_id uuid;
  v_tutor_name text;
  v_name text;
  v_phone text;
begin
  select a.name, a.phone into v_name, v_phone
  from student_accounts a where a.id = p_student_id and a.session_token = p_token;
  if v_name is null then
    raise exception 'Сессия недействительна';
  end if;

  select t.id, t.name into v_tutor_id, v_tutor_name from tutors t where t.code = lower(p_code);
  if v_tutor_id is null then
    raise exception 'Неверный код репетитора';
  end if;

  -- карточка ученика в ростере репетитора (по телефону)
  if not exists (select 1 from students s where s.tutor_id = v_tutor_id and s.phone = v_phone) then
    insert into students (id, tutor_id, name, phone, subject)
      values (gen_random_uuid(), v_tutor_id, v_name, v_phone, p_subject);
  else
    update students set subject = coalesce(subject, p_subject)
      where tutor_id = v_tutor_id and phone = v_phone;
  end if;

  -- первый репетитор — основной (для обратной совместимости загрузки по tutor_id)
  update student_accounts set tutor_id = v_tutor_id, tutor_code = lower(p_code)
    where id = p_student_id and tutor_id is null;

  -- заявка репетитору + уведомление (best-effort, не ломает привязку)
  begin
    if not exists (select 1 from pending_students p where p.tutor_id = v_tutor_id and p.student_account_id = p_student_id) then
      insert into pending_students (id, tutor_id, student_account_id, name, phone)
        values (gen_random_uuid(), v_tutor_id, p_student_id, v_name, v_phone);
    end if;
    insert into notifications (user_id, title, body)
      values (v_tutor_id, 'Новая заявка от ученика', v_name || ' привязался (' || coalesce(p_subject, 'предмет') || ')');
  exception when others then
    raise warning 'student_link_tutor side-effects: %', sqlerrm;
  end;

  return query select v_tutor_id, v_tutor_name;
end;
$link$;

revoke execute on function public.student_register(text, text, text) from public;
revoke execute on function public.student_link_tutor(uuid, uuid, text, text) from public;

grant execute on function public.student_register(text, text, text) to anon, authenticated;
grant execute on function public.student_link_tutor(uuid, uuid, text, text) to anon, authenticated;
