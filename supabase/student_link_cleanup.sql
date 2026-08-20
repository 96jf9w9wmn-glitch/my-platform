-- Порядок в связке «аккаунт ученика ↔ карточка в ростере репетитора», 21.08.2026.
-- Выполнить один раз (Studio → SQL Editor). Идемпотентно.
--
-- Что чиним:
--  1. students.id — bigint без автогенерации. Id выдумывал клиент (миллисекунды),
--     а серверные вставки клали туда gen_random_uuid() и молча падали
--     («invalid input syntax for type bigint»). Из-за этого с 08.07.2026 карточки
--     ученика не создавались вообще, а ученики оседали привязанными «в никуда».
--  2. Связь карточки с аккаунтом держалась на СОВПАДЕНИИ СТРОКИ телефона — по нему
--     же пускает ученика RLS (current_student_rows). Любая правка номера тихо
--     отрезала ученику доступ к собственной карточке. Добавляем явный
--     students.student_account_id и переводим проверку на него, оставив телефон
--     запасным путём для старых строк.
--  3. Привязку репетитора клиент делал четырьмя запросами сам (матчинг по ilike,
--     вставка карточки, заявка, уведомление). Одна из вставок была заведомо
--     обречена, а прав на неё у роли app_user нет вовсе. Оставляем ровно одну
--     точку — RPC student_link_tutor, как и задумывал student_onboarding.sql.
--  4. «Отклонить» у репетитора удалял строку заявки, но ученик оставался
--     привязанным и возвращался тем же списком. Добавляем student_request_reject.

-- ---------------------------------------------------------------------------
-- 1. students.id: автогенерация вместо самодельных id
-- ---------------------------------------------------------------------------
-- Владелец таблицы — postgres, а миграцию выполняет supabase_admin: у sequence
-- должен быть тот же владелец, иначе «sequence must have same owner as table».
create sequence if not exists public.students_id_seq;
do $seq$
declare v_owner text;
begin
  select tableowner into v_owner from pg_tables where schemaname = 'public' and tablename = 'students';
  execute format('alter sequence public.students_id_seq owner to %I', v_owner);
end;
$seq$;
alter sequence public.students_id_seq owned by public.students.id;
-- Старые id — это Date.now() (порядок 1.7e12), поэтому продолжаем с максимума:
-- is_called = false, значит первый nextval вернёт ровно это значение.
select setval('public.students_id_seq', coalesce((select max(id) from public.students), 0) + 1, false);
alter table public.students alter column id set default nextval('public.students_id_seq');

-- ---------------------------------------------------------------------------
-- 2. Явная связь карточки с аккаунтом ученика
-- ---------------------------------------------------------------------------
alter table public.students add column if not exists student_account_id uuid;
create index if not exists students_account_idx on public.students (student_account_id);

update public.students s
   set student_account_id = a.id
  from public.student_accounts a
 where s.student_account_id is null
   and s.phone is not null
   and a.phone = s.phone;

-- Карточка заведена (или ей поменяли номер) — проставляем аккаунт по телефону.
create or replace function public.students_fill_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.student_account_id is null and new.phone is not null then
    select a.id into new.student_account_id
      from student_accounts a where a.phone = new.phone limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists students_fill_account_trg on public.students;
create trigger students_fill_account_trg
  before insert or update of phone, student_account_id on public.students
  for each row execute function public.students_fill_account();

-- Обратная сторона: аккаунт зарегистрировался (или сменил номер) позже карточки.
create or replace function public.accounts_fill_students() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update students set student_account_id = new.id
   where student_account_id is null and phone is not null and phone = new.phone;
  return null;
end;
$$;

drop trigger if exists accounts_fill_students_trg on public.student_accounts;
create trigger accounts_fill_students_trg
  after insert or update of phone on public.student_accounts
  for each row execute function public.accounts_fill_students();

-- ---------------------------------------------------------------------------
-- 3. RLS: ученик находит свои карточки по аккаунту, телефон — запасной путь
-- ---------------------------------------------------------------------------
-- Строго шире прежней версии (та знала только телефон), поэтому доступ никому
-- не сужается: старые строки без student_account_id продолжают находиться.
create or replace function public.current_student_rows() returns setof bigint
language sql stable security definer set search_path = public as $$
  select s.id from students s
   where (s.student_account_id is not null and s.student_account_id = public.current_account_id())
      or (s.phone is not null and s.phone = public.current_student_phone())
$$;

-- ---------------------------------------------------------------------------
-- 4. Привязка репетитора — одной функцией
-- ---------------------------------------------------------------------------
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

  -- Карточка в ростере репетитора. Ищем по аккаунту, а не по телефону: номер в
  -- старой карточке мог быть записан иначе. id не задаём — его выдаёт sequence.
  if not exists (
    select 1 from students s
     where s.tutor_id = v_tutor_id
       and (s.student_account_id = p_student_id or s.phone = v_phone)
  ) then
    insert into students (tutor_id, name, phone, subject, student_account_id)
      values (v_tutor_id, v_name, v_phone, p_subject, p_student_id);
  else
    -- Псевдоним обязателен: tutor_id — ещё и имя OUT-параметра функции, без
    -- квалификации Postgres не понимает, колонка это или переменная.
    update students s
       set subject = coalesce(s.subject, p_subject),
           student_account_id = coalesce(s.student_account_id, p_student_id)
     where s.tutor_id = v_tutor_id
       and (s.student_account_id = p_student_id or s.phone = v_phone);
  end if;

  -- Первый репетитор — основной: загрузка кабинета ученика идёт по tutor_id.
  update student_accounts sa set tutor_id = v_tutor_id, tutor_code = lower(p_code)
    where sa.id = p_student_id and sa.tutor_id is null;

  -- Заявка репетитору + уведомление. Best-effort: сорвётся — ученик всё равно
  -- виден репетитору как привязанный аккаунт без карточки (кабинет это учитывает).
  begin
    if not exists (select 1 from pending_students p
                    where p.tutor_id = v_tutor_id and p.student_account_id = p_student_id) then
      insert into pending_students (tutor_id, student_account_id, name, phone)
        values (v_tutor_id, p_student_id, v_name, v_phone);
    end if;
    insert into notifications (user_id, title, body)
      values (v_tutor_id, 'Новая заявка от ученика',
              v_name || ' привязался (' || coalesce(p_subject, 'предмет') || ')');
  exception when others then
    raise warning 'student_link_tutor side-effects: %', sqlerrm;
  end;

  return query select v_tutor_id, v_tutor_name;
end;
$link$;

-- ---------------------------------------------------------------------------
-- 5. Отказ репетитора: заявка снимается вместе с привязкой
-- ---------------------------------------------------------------------------
-- Без этого «Отклонить» был косметикой: строка заявки удалялась, а ученик
-- оставался привязан к репетитору и возвращался в список при следующем заходе.
-- Карточку не трогаем: если по ученику уже вели занятия, удалять её должен
-- человек, кнопкой в списке.
create or replace function public.student_request_reject(p_account uuid, p_pending uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tutor uuid := auth.uid();
begin
  if v_tutor is null then
    raise exception 'Доступно только репетитору';
  end if;

  if p_pending is not null then
    delete from pending_students where id = p_pending and tutor_id = v_tutor;
  end if;

  if p_account is not null then
    delete from pending_students where student_account_id = p_account and tutor_id = v_tutor;
    -- Отвязываем только от себя: чужую привязку тронуть нельзя.
    update student_accounts set tutor_id = null, tutor_code = null
      where id = p_account and tutor_id = v_tutor;
  end if;
end;
$$;

revoke execute on function public.student_request_reject(uuid, uuid) from public, anon, app_user;
grant execute on function public.student_request_reject(uuid, uuid) to authenticated;

grant execute on function public.student_link_tutor(uuid, uuid, text, text) to anon, authenticated, app_user;

-- Сбросить кэш схемы PostgREST, иначе новая функция и колонка не подхватятся.
notify pgrst, 'reload schema';
