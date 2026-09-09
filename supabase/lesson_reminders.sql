-- Напоминания о занятии: накануне вечером и за час до начала.
--
-- Зачем. Уведомления в кабинете появляются в ответ на действие: выдали работу,
-- сдали вариант, написали в чат. О самом занятии не напоминал никто — а это
-- ровно то, что забывают. С появлением push (supabase/web_push.sql) напоминание
-- наконец доходит до человека, когда приложение закрыто, и фича стала осмысленной.
--
-- Почему в базе, а не в кабинете. Расписание лежит в `students.lessons`, и
-- напомнить надо в момент, когда кабинет, скорее всего, никем не открыт.
-- pg_cron здесь годится (в отличие от отчётов родителю, где нужен поход во
-- внешний DeepSeek): наружу ходить не требуется — функция только кладёт строку
-- в `notifications`, а дальше её разбирают уже готовые триггеры на почту и push.
--
-- ГЛАВНОЕ ПРИ ПРАВКАХ — три вещи.
--
-- 1. ЧАСОВЫЕ ПОЯСА. Занятие лежит настенным временем без пояса, а пояс, в
--    котором оно ЗАПИСАНО, — это `students.timezone` (якорь, см. CLAUDE.md).
--    Момент начала считается только через него, а показывается каждому в ЕГО
--    поясе: ученику — `student_accounts.timezone`, репетитору — `tutors.timezone`.
--    Пояс бывает пустым (у половины боевых строк), поэтому везде запасной
--    'Europe/Moscow' — без него репетитор из Еревана позвал бы ученика на час
--    позже, и заметить это было бы нечем.
--
-- 2. СВОДКОЙ, А НЕ ПОШТУЧНО. И почта, и push схлопывают одинаковые заголовки
--    одному получателю чаще раза в четверть часа. Занятия группы разложены по
--    карточкам ВСЕХ участников, поэтому «за час» у репетитора — это пять
--    уведомлений в одну секунду с одним заголовком, из которых дошло бы одно.
--    Поэтому напоминание одно на момент начала (и одно на день), а имена
--    перечислены в теле.
--
-- 3. ОТПРАВЛЕННОЕ ПОМНИМ. `lesson_reminders` хранит ключ события, и повтор
--    отсекает уникальный индекс, а не проверка времени. Поэтому пропущенный
--    запуск cron ничего не теряет: условие «пора и ещё не поздно» остаётся
--    истинным до самого занятия, и напоминание уйдёт при следующем запуске.
--    Занятие перенесли — ключ другой, напоминание уйдёт заново. Так и надо.

create table if not exists public.lesson_reminders (
  id      bigserial primary key,
  -- Ключ события целиком: 'hour:tutor:<uuid>:<момент>' и т.п. Строкой, а не
  -- набором колонок, потому что у сводки репетитора и у напоминания ученику
  -- разный состав ключа, а смысл один — «это мы уже отправляли».
  ref     text        not null unique,
  sent_at timestamptz not null default now()
);

alter table public.lesson_reminders enable row level security;
-- Политик нет намеренно: таблицу ведёт только сама база (SECURITY DEFINER).
revoke all on public.lesson_reminders from anon, authenticated, app_user;
revoke all on sequence public.lesson_reminders_id_seq from anon, authenticated, app_user;

comment on table public.lesson_reminders is
  'Что уже напомнили. Ведёт lesson_reminders_run(), чтобы не слать дважды.';

-- «12 сентября» — родительный падеж, которого to_char не даёт ни при какой
-- локали; ставить lc_time ради одной строки не стоит.
create or replace function public.ru_day_month(p_ts timestamptz, p_tz text)
returns text
language sql
immutable
as $$
  select ltrim(to_char(p_ts at time zone p_tz, 'DD'), '0') || ' ' ||
         (array['января','февраля','марта','апреля','мая','июня','июля',
                'августа','сентября','октября','ноября','декабря']
         )[extract(month from p_ts at time zone p_tz)::int];
$$;

create or replace function public.ru_hhmm(p_ts timestamptz, p_tz text)
returns text
language sql
immutable
as $$
  select to_char(p_ts at time zone p_tz, 'HH24:MI');
$$;

-- Точка в конце, если её ещё нет: имя ученика часто уже кончается точкой
-- («Аня К.»), и подпись давала «Аня К..».
create or replace function public.ru_dot(p text)
returns text
language sql
immutable
as $$
  select case when right(btrim(p), 1) in ('.', '!', '?') then btrim(p) else btrim(p) || '.' end;
$$;

-- «занятие / занятия / занятий»
create or replace function public.ru_plural(n integer, one text, few text, many text)
returns text
language sql
immutable
as $$
  select case
    when n % 100 between 11 and 14 then many
    when n % 10 = 1 then one
    when n % 10 between 2 and 4 then few
    else many
  end;
$$;

create or replace function public.lesson_reminders_run()
returns integer
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_sent integer := 0;
  rec    record;
  v_title text;
  v_body  text;
  v_list  text;
  v_n     integer;
begin
  -- Раскладываем расписание всех учеников в отдельные занятия с моментом
  -- начала. Легаси-занятия (только дата в lesson_dates, без объекта в lessons)
  -- сюда не попадают намеренно: у них нет времени, и «за час» для них не
  -- определено.
  drop table if exists _occ;
  create temporary table _occ on commit drop as
  select
    s.id                                          as student_id,
    s.tutor_id,
    s.student_account_id,
    s.name                                        as student_name,
    s.subject,
    ((l->>'date') || ' ' || (l->>'time'))::timestamp
      at time zone coalesce(nullif(s.timezone, ''), 'Europe/Moscow')
                                                  as start_utc
  from students s
  cross join lateral jsonb_array_elements(coalesce(s.lessons, '[]'::jsonb)) l
  where l->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
    and l->>'time' ~ '^\d{1,2}:\d{2}$'
    -- Снятое со счёта или пропущенное занятие не напоминаем: его не будет.
    and coalesce(l->>'status', '') not in ('missed', 'excused', 'cancelled');

  ---------------------------------------------------------------------------
  -- ЗА ЧАС. Одно напоминание на момент начала: у группы занятие разложено по
  -- карточкам всех участников, и поштучно репетитор получил бы пять одинаковых.
  ---------------------------------------------------------------------------
  for rec in
    select o.tutor_id,
           o.start_utc,
           coalesce(nullif(t.timezone, ''), 'Europe/Moscow') as tz,
           count(*)                                          as n,
           string_agg(o.student_name, ', ' order by o.student_name) as names
      from _occ o
      join tutors t on t.id = o.tutor_id
     where o.start_utc > now()
       and o.start_utc <= now() + interval '1 hour'
     group by o.tutor_id, o.start_utc, t.timezone
  loop
    insert into lesson_reminders (ref)
    values ('hour:tutor:' || rec.tutor_id || ':' || to_char(rec.start_utc, 'YYYYMMDDHH24MI'))
    on conflict (ref) do nothing;
    if not found then continue; end if;

    if rec.n = 1 then
      v_title := 'Занятие через час';
      v_body  := ru_dot(rec.names || ', в ' || ru_hhmm(rec.start_utc, rec.tz));
    else
      v_title := 'Через час ' || rec.n || ' ' || ru_plural(rec.n::int, 'занятие', 'занятия', 'занятий');
      v_body  := ru_dot(rec.names || ' — в ' || ru_hhmm(rec.start_utc, rec.tz));
    end if;
    insert into notifications (user_id, title, body) values (rec.tutor_id, v_title, v_body);
    v_sent := v_sent + 1;
  end loop;

  -- То же ученику. У него занятие своё, но в одно время их может быть два
  -- (два репетитора), поэтому тоже группируем.
  for rec in
    select o.student_account_id                                 as account_id,
           o.start_utc,
           coalesce(nullif(sa.timezone, ''), 'Europe/Moscow')    as tz,
           count(*)                                             as n,
           string_agg(coalesce(nullif(o.subject, ''), 'Занятие'), ', '
                      order by o.subject)                       as subjects
      from _occ o
      join student_accounts sa on sa.id = o.student_account_id
     where o.student_account_id is not null
       and o.start_utc > now()
       and o.start_utc <= now() + interval '1 hour'
     group by o.student_account_id, o.start_utc, sa.timezone
  loop
    insert into lesson_reminders (ref)
    values ('hour:student:' || rec.account_id || ':' || to_char(rec.start_utc, 'YYYYMMDDHH24MI'))
    on conflict (ref) do nothing;
    if not found then continue; end if;

    v_title := 'Занятие через час';
    v_body  := ru_dot(rec.subjects || ' в ' || ru_hhmm(rec.start_utc, rec.tz));
    insert into notifications (user_id, title, body) values (rec.account_id, v_title, v_body);
    v_sent := v_sent + 1;
  end loop;

  ---------------------------------------------------------------------------
  -- НАКАНУНЕ. Не «ровно за сутки»: для занятия в девять утра это значило бы
  -- звонок в девять вечера накануне, а для занятия в восемь — в восемь вечера,
  -- то есть время напоминания скакало бы вслед за временем занятия. Шлём в
  -- один и тот же вечерний час по местному времени получателя — это привычный
  -- ритм «план на завтра», и он же не будит ночью.
  ---------------------------------------------------------------------------
  for rec in
    select o.tutor_id,
           coalesce(nullif(t.timezone, ''), 'Europe/Moscow') as tz,
           (now() at time zone coalesce(nullif(t.timezone, ''), 'Europe/Moscow'))::date + 1 as day,
           count(*) as n,
           string_agg(ru_hhmm(o.start_utc, coalesce(nullif(t.timezone, ''), 'Europe/Moscow'))
                      || ' — ' || o.student_name, ', ' order by o.start_utc) as list
      from _occ o
      join tutors t on t.id = o.tutor_id
     where extract(hour from now() at time zone coalesce(nullif(t.timezone, ''), 'Europe/Moscow')) between 20 and 21
       and (o.start_utc at time zone coalesce(nullif(t.timezone, ''), 'Europe/Moscow'))::date
           = (now() at time zone coalesce(nullif(t.timezone, ''), 'Europe/Moscow'))::date + 1
     group by o.tutor_id, t.timezone
  loop
    insert into lesson_reminders (ref)
    values ('day:tutor:' || rec.tutor_id || ':' || to_char(rec.day, 'YYYYMMDD'))
    on conflict (ref) do nothing;
    if not found then continue; end if;

    v_title := 'Завтра ' || rec.n || ' ' || ru_plural(rec.n::int, 'занятие', 'занятия', 'занятий');
    v_body  := ru_dot(rec.list);
    insert into notifications (user_id, title, body) values (rec.tutor_id, v_title, v_body);
    v_sent := v_sent + 1;
  end loop;

  for rec in
    select o.student_account_id                              as account_id,
           coalesce(nullif(sa.timezone, ''), 'Europe/Moscow') as tz,
           (now() at time zone coalesce(nullif(sa.timezone, ''), 'Europe/Moscow'))::date + 1 as day,
           count(*) as n,
           min(o.start_utc) as first_start,
           string_agg(ru_hhmm(o.start_utc, coalesce(nullif(sa.timezone, ''), 'Europe/Moscow')),
                      ', ' order by o.start_utc) as times
      from _occ o
      join student_accounts sa on sa.id = o.student_account_id
     where o.student_account_id is not null
       and extract(hour from now() at time zone coalesce(nullif(sa.timezone, ''), 'Europe/Moscow')) between 20 and 21
       and (o.start_utc at time zone coalesce(nullif(sa.timezone, ''), 'Europe/Moscow'))::date
           = (now() at time zone coalesce(nullif(sa.timezone, ''), 'Europe/Moscow'))::date + 1
     group by o.student_account_id, sa.timezone
  loop
    insert into lesson_reminders (ref)
    values ('day:student:' || rec.account_id || ':' || to_char(rec.day, 'YYYYMMDD'))
    on conflict (ref) do nothing;
    if not found then continue; end if;

    if rec.n = 1 then
      v_title := 'Занятие завтра';
      v_body  := ru_dot(ru_day_month(rec.first_start, rec.tz) || ' в ' || rec.times);
    else
      v_title := 'Завтра ' || rec.n || ' ' || ru_plural(rec.n::int, 'занятие', 'занятия', 'занятий');
      v_body  := ru_dot(ru_day_month(rec.first_start, rec.tz) || ' — в ' || rec.times);
    end if;
    insert into notifications (user_id, title, body) values (rec.account_id, v_title, v_body);
    v_sent := v_sent + 1;
  end loop;

  -- Журнал не архив: год напоминаний хранить незачем.
  delete from lesson_reminders where sent_at < now() - interval '30 days';

  return v_sent;
end $$;

revoke all on function public.lesson_reminders_run() from public, anon, authenticated, app_user;

-- Раз в десять минут: шаг мельче не нужен (напоминание «за час» и так уходит
-- в пределах часа до начала), а крупнее — сдвинул бы вечернюю сводку.
do $$
begin
  perform cron.unschedule('lesson-reminders');
exception when others then null;
end $$;

select cron.schedule('lesson-reminders', '*/10 * * * *', 'select public.lesson_reminders_run()');
