-- Проверка телефона на стороне базы.
--
-- Зачем. Телефон — это ЛОГИН ученика и единственная связка его карточки с
-- аккаунтом (по нему сшивает и current_student_rows, то есть RLS). До этой
-- миграции не проверялось ничего: в боевой базе лежат аккаунты с номерами
-- «+7324», «+7343», «+7324433» — их владельцы никогда не привяжутся к
-- карточке, а репетитор не поймёт почему.
--
-- Проверка на клиенте (utils.js: isValidRuPhone) — это подсказка человеку.
-- Настоящий барьер здесь: карточку ученика клиент репетитора пишет прямой
-- записью в таблицу, RPC там нет, поэтому единственное место, мимо которого не
-- пройти, — триггер.
--
-- Правило то же, что в utils.js: одиннадцать цифр, код 7 (или 8 в старой
-- записи), первая цифра номера от 3 до 9 — коды 0xx, 1xx и 2xx в российской
-- нумерации не выданы.
create or replace function public.is_valid_ru_phone(p_phone text)
returns boolean
language sql
immutable
as $$
  select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') ~ '^[78][3-9][0-9]{9}$'
$$;

-- Имя проверяем тем же триггером: «35235» именем не является, а эту строку
-- увидят и репетитор в списке учеников, и родитель в отчёте, и квитанция.
-- Требуем хотя бы две буквы — «Ян» проходит, «Аня 2» тоже (так различают тёзок).
create or replace function public.is_valid_person_name(p_name text)
returns boolean
language sql
immutable
as $$
  select length(btrim(coalesce(p_name, ''))) between 2 and 60
     and length(regexp_replace(coalesce(p_name, ''), '[^A-Za-zА-Яа-яЁё]', '', 'g')) >= 2
$$;

-- Триггер ставим на ИЗМЕНЕНИЕ номера, а не на любую запись: старые кривые
-- номера в базе уже есть, и запретить трогать такие строки — значит запереть
-- репетитора в карточке, где номер как раз и надо поправить.
create or replace function public.check_phone_change()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.phone, '') <> ''
     and (tg_op = 'INSERT' or new.phone is distinct from old.phone)
     and not public.is_valid_ru_phone(new.phone) then
    raise exception 'Неверный номер телефона: нужны все десять цифр после +7';
  end if;
  if coalesce(new.name, '') <> ''
     and (tg_op = 'INSERT' or new.name is distinct from old.name)
     and not public.is_valid_person_name(new.name) then
    raise exception 'Имя пишется буквами';
  end if;
  return new;
end $$;

drop trigger if exists student_accounts_phone_check on public.student_accounts;
create trigger student_accounts_phone_check
  before insert or update on public.student_accounts
  for each row execute function public.check_phone_change();

drop trigger if exists students_phone_check on public.students;
create trigger students_phone_check
  before insert or update on public.students
  for each row execute function public.check_phone_change();

-- Регистрация ученика: отдельная понятная ошибка ещё до вставки, чтобы человек
-- увидел причину, а не «ошибка базы». Заодно номер приводится к каноничному
-- виду +7XXXXXXXXXX — иначе один и тот же человек, набрав «8…», завёл бы себе
-- второй аккаунт.
create or replace function public.student_register(p_phone text, p_password text, p_name text)
returns table(id uuid, name text, phone text, avatar text,
              tutor_id uuid, tutor_code text, session_token uuid, token text)
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_new_id uuid;
  v_token uuid;
  v_phone text;
begin
  if not public.is_valid_ru_phone(p_phone) then
    raise exception 'Неверный номер телефона: нужны все десять цифр после +7';
  end if;
  if not public.is_valid_person_name(p_name) then
    raise exception 'Имя пишется буквами';
  end if;
  v_phone := '+7' || right(regexp_replace(p_phone, '\D', '', 'g'), 10);

  if exists (select 1 from student_accounts sa where sa.phone = v_phone) then
    raise exception 'Этот номер уже зарегистрирован';
  end if;

  v_token := gen_random_uuid();
  insert into student_accounts (name, phone, password_hash, session_token)
  values (p_name, v_phone, extensions.crypt(p_password, extensions.gen_salt('bf', 12)), v_token)
  returning student_accounts.id into v_new_id;

  return query
    select a.id::uuid, a.name::text, a.phone::text, a.avatar::text,
           a.tutor_id::uuid, a.tutor_code::text, a.session_token::uuid,
           public.issue_student_jwt(a.id)
    from student_accounts a where a.id = v_new_id;
end $$;
