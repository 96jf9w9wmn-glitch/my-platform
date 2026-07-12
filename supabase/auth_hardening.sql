-- Хэширование паролей учеников + серверная проверка логина/регистрации/сброса.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- ВАЖНО (порядок деплоя): сразу после выполнения этого файла нужно задеплоить
-- новую версию фронтенда. Старый билд читает колонку pass_word и сравнивает
-- пароль на клиенте — после миграции колонки не будет, старый билд сломается.
-- Так и задумано: без одновременного отключения старого пути эта дыра остаётся.
--
-- Что чинит:
--  1. student_accounts.pass_word хранился в открытом виде и был читаем через
--     anon-ключ любым select("*") — теперь хэш (bcrypt) и колонка отдельно
--     закрыта от anon/authenticated, доступ только через функции ниже.
--  2. Логин/регистрация/сброс пароля студента раньше делали select всей
--     таблицы на клиенте и сравнивали пароль в браузере — теперь сравнение
--     происходит в security definer функции на сервере.
--  3. Восстановление сессии из localStorage верило голому id ({id: 1} —
--     и ты вошёл под чужим учеником). Добавлен session_token — случайный
--     секрет, выдаваемый только при логине/регистрации, обязателен при
--     восстановлении сессии.
--
-- Что НЕ чинит (сознательно, см. итог ревью в чате):
--  - RLS на students/homework/pending_students/notifications/variant_submissions
--    всё ещё выключен — эти таблицы читаются и пишутся напрямую через anon-ключ.
--    Ученики и родители не имеют auth.uid() (не заведены в auth.users), поэтому
--    RLS для них требует либо полноценных сессий Supabase Auth, либо отдельного
--    RPC-слоя на каждую операцию (аватар, привязка к репетитору, сдача ДЗ, чат,
--    сдача вариантов, код родителя) — это отдельная задача, которую стоит
--    тестировать на реальной базе, а не догадками в одном мега-патче.
--  - Публичные storage-бакеты (homework, variants) — файлы по-прежнему
--    доступны всем, кто знает URL.
--  - Сброс пароля по номеру телефона без SMS/OTP — по-прежнему только знание
--    номера телефона, без второго фактора (нужен провайдер SMS, это решение
--    по инфраструктуре/деньгам, не техническое).

create extension if not exists pgcrypto with schema extensions;

-- В Supabase pgcrypto живёт в схеме extensions, которой нет в search_path по
-- умолчанию — из-за этого crypt()/gen_salt() «не находятся». Полагаться на путь
-- ненадёжно (у SECURITY DEFINER функций он свой), поэтому НИЖЕ все вызовы
-- pgcrypto заданы явной схемой: extensions.crypt / extensions.gen_salt.
-- Если запрос `select nspname from pg_namespace ... где extname='pgcrypto'`
-- вернёт другую схему — замени здесь префикс extensions. на неё.
set search_path = public, extensions;

-- 1. Хэш пароля и токен сессии --------------------------------------------

alter table public.student_accounts
  add column if not exists password_hash text,
  add column if not exists session_token uuid not null default gen_random_uuid();

-- Хэшируем старые пароли и удаляем открытую колонку pass_word ТОЛЬКО если она
-- ещё существует. Иначе повторный прогон падает на `column "pass_word" does not
-- exist` (в прошлый прогон эта часть уже выполнилась — до падения на функции).
-- extensions.crypt/gen_salt заданы явной схемой, поэтому search_path здесь не важен.
do $migrate$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_accounts'
      and column_name = 'pass_word'
  ) then
    -- Проверь один раз глазами, что не осталось строк без пароля:
    --   select count(*) from public.student_accounts where pass_word is null;
    -- у таких аккаунтов password_hash останется null и войти они не смогут.
    update public.student_accounts
      set password_hash = extensions.crypt(pass_word, extensions.gen_salt('bf', 12))
      where password_hash is null and pass_word is not null;
    alter table public.student_accounts drop column pass_word;
  end if;
end;
$migrate$;

update public.student_accounts
  set session_token = gen_random_uuid()
  where session_token is null;

-- password_hash/session_token — ни читать, ни писать напрямую через anon-ключ.
-- Всё легитимное чтение/сравнение/обновление идёт через SECURITY DEFINER
-- функции ниже (выполняются от имени владельца функции, не от anon/authenticated).
revoke select (password_hash, session_token) on public.student_accounts from anon, authenticated;
revoke insert (password_hash, session_token) on public.student_accounts from anon, authenticated;
revoke update (password_hash, session_token) on public.student_accounts from anon, authenticated;

-- Column-level revoke выше не поможет, если у anon/authenticated уже есть
-- широкий table-level grant на student_accounts (в Supabase по умолчанию
-- так и есть, пока нет RLS) — column revoke не отменяет table-level grant.
-- Таблица не под RLS (см. долги в конце файла), а update(...).eq("id", ...)
-- на этой таблице уже используется в приложении для других колонок напрямую —
-- без этого триггера можно было бы записать session_token = 'свой uuid' в
-- чужую строку и пройти student_validate_session, минуя логин.
create or replace function public.guard_student_account_secrets()
returns trigger
language plpgsql as $guard$
begin
  if current_user not in ('anon', 'authenticated') then
    return new; -- вызов идёт из SECURITY DEFINER RPC (роль владельца функции)
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Прямая вставка в student_accounts запрещена, используй student_register';
  end if;

  if new.password_hash is distinct from old.password_hash
     or new.session_token is distinct from old.session_token then
    raise exception 'password_hash/session_token нельзя менять напрямую, только через RPC';
  end if;

  return new;
end;
$guard$;

drop trigger if exists guard_student_account_secrets_trg on public.student_accounts;
create trigger guard_student_account_secrets_trg
  before insert or update on public.student_accounts
  for each row execute function public.guard_student_account_secrets();

-- 2. RPC для логина/регистрации/сброса/восстановления сессии ---------------

-- Прошлые прогоны создали эти функции со старым типом (id bigint / p_id bigint).
-- CREATE OR REPLACE не умеет менять тип возврата и оставил бы дубль-перегрузку
-- validate — поэтому сначала дропаем старые сигнатуры (if exists, безопасно).
drop function if exists public.student_login(text, text);
drop function if exists public.student_validate_session(bigint, uuid);
drop function if exists public.student_validate_session(uuid, uuid);
drop function if exists public.student_reset_password(text, text);
drop function if exists public.student_register(text, text, text, text);

create or replace function public.student_login(p_phone text, p_password text)
returns table (
  id uuid, name text, phone text, avatar text,
  tutor_id uuid, tutor_code text, session_token uuid
)
language plpgsql security definer set search_path = public, extensions as $login$
begin
  return query
    select a.id::uuid, a.name::text, a.phone::text, a.avatar::text, a.tutor_id::uuid, a.tutor_code::text, a.session_token::uuid
    from student_accounts a
    where a.phone = p_phone
      and a.password_hash = extensions.crypt(p_password, a.password_hash);
end;
$login$;

create or replace function public.student_validate_session(p_id uuid, p_token uuid)
returns table (
  id uuid, name text, phone text, avatar text,
  tutor_id uuid, tutor_code text, session_token uuid
)
language plpgsql security definer set search_path = public, extensions as $validate$
begin
  return query
    select a.id::uuid, a.name::text, a.phone::text, a.avatar::text, a.tutor_id::uuid, a.tutor_code::text, a.session_token::uuid
    from student_accounts a
    where a.id = p_id and a.session_token = p_token;
end;
$validate$;

create or replace function public.student_reset_password(p_phone text, p_new_password text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $reset$
declare
  v_count int;
begin
  update student_accounts
    set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 12)),
        session_token = gen_random_uuid()
    where phone = p_phone;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$reset$;

create or replace function public.student_register(
  p_phone text, p_password text, p_name text, p_tutor_code text
)
returns table (
  id uuid, name text, phone text, avatar text,
  tutor_id uuid, tutor_code text, session_token uuid
)
language plpgsql security definer set search_path = public, extensions as $register$
declare
  v_tutor_id uuid;
  v_new_id uuid;
  v_token uuid;
begin
  select t.id into v_tutor_id from tutors t where t.code = lower(p_tutor_code);
  if v_tutor_id is null then
    raise exception 'Неверный код репетитора';
  end if;

  if exists (select 1 from student_accounts sa where sa.phone = p_phone) then
    raise exception 'Этот номер уже зарегистрирован';
  end if;

  v_token := gen_random_uuid();

  insert into student_accounts (name, phone, password_hash, tutor_code, tutor_id, session_token)
  values (p_name, p_phone, extensions.crypt(p_password, extensions.gen_salt('bf', 12)), lower(p_tutor_code), v_tutor_id, v_token)
  returning student_accounts.id into v_new_id;

  -- Тот же матчинг, что раньше жил в Auth.jsx: сперва по телефону, потом по имени.
  -- Через exists, а не через id-переменную — чтобы не зависеть от типа students.id.
  -- Побочные эффекты (ростер / заявка репетитору / уведомление) — best-effort и
  -- каждый в своём блоке: сбой любого из них (например неизвестная NOT NULL-колонка)
  -- НЕ ломает регистрацию — аккаунт ученика уже создан и он сможет войти.
  -- id генерируем сами: схема на uuid, на клиенте это crypto.randomUUID().
  begin
    if not exists (select 1 from students s where s.tutor_id = v_tutor_id and s.phone = p_phone) then
      if exists (select 1 from students s where s.tutor_id = v_tutor_id and s.name ilike '%' || p_name || '%') then
        update students set phone = p_phone
          where tutor_id = v_tutor_id and name ilike '%' || p_name || '%' and phone is null;
      else
        insert into students (id, tutor_id, name, phone)
          values (gen_random_uuid(), v_tutor_id, p_name, p_phone);
      end if;
    end if;
  exception when others then raise warning 'student_register/students: %', sqlerrm;
  end;

  begin
    insert into pending_students (id, tutor_id, student_account_id, name, phone)
      values (gen_random_uuid(), v_tutor_id, v_new_id, p_name, p_phone);
  exception when others then raise warning 'student_register/pending_students: %', sqlerrm;
  end;

  begin
    insert into notifications (user_id, title, body)
      values (v_tutor_id, 'Новая заявка от ученика', p_name || ' хочет присоединиться к тебе');
  exception when others then raise warning 'student_register/notifications: %', sqlerrm;
  end;

  return query
    select a.id::uuid, a.name::text, a.phone::text, a.avatar::text, a.tutor_id::uuid, a.tutor_code::text, a.session_token::uuid
    from student_accounts a where a.id = v_new_id;
end;
$register$;

revoke execute on function
  public.student_login(text, text),
  public.student_validate_session(uuid, uuid),
  public.student_reset_password(text, text),
  public.student_register(text, text, text, text)
from public;

grant execute on function
  public.student_login(text, text),
  public.student_validate_session(uuid, uuid),
  public.student_reset_password(text, text),
  public.student_register(text, text, text, text)
to anon, authenticated;
