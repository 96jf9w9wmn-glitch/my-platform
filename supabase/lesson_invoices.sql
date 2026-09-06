-- Автоматические квитанции за проведённые занятия.
--
-- Задача: репетитор не занимается выставлением счетов вообще. Занятие
-- закончилось — ученику и родителю сама пришла квитанция на его стоимость.
-- Репетитор только получает деньги (наличными, переводом или через ЮKassa) и
-- отмечает оплату там же, где отмечал всегда.
--
-- Что здесь есть:
--   * tutor_invoice_settings — тумблер, задержка, реквизиты для перевода;
--   * lesson_invoices        — журнал выставленного (одна строка = одно занятие);
--   * invoices_sync_for()    — выставление квитанций за уже прошедшие занятия;
--   * invoices_remind()      — напоминание, если долг висит дольше N дней;
--   * задание pg_cron        — чтобы всё это происходило БЕЗ участия кабинета.
--
-- Оплаченность квитанции ЗДЕСЬ НЕ ХРАНИТСЯ, и это осознанно. Долг во всём
-- приложении считается одинаково: «проведённые занятия × цена − сумма оплат»
-- (Payment.jsx, StudentDashboard, телеграм-бот). Заведи мы вторую истину —
-- «квитанция оплачена», — она бы разъезжалась с первой при любой правке цены,
-- удалении занятия или платеже задним числом. Поэтому квитанция — это только
-- факт «за это занятие выставлен счёт на такую сумму», а гасятся квитанции по
-- порядку той же суммой оплат, что и раньше.
--
-- Выполнить в Studio → SQL Editor. Идемпотентно, повторный запуск безопасен.

-- ---------------------------------------------------------------------------
-- 1. Настройки репетитора
-- ---------------------------------------------------------------------------
create table if not exists public.tutor_invoice_settings (
  tutor_id      uuid primary key references auth.users(id) on delete cascade,
  enabled       boolean  not null default false,
  -- Через сколько минут после конца занятия выставлять счёт. 0 = сразу.
  delay_min     smallint not null default 0 check (delay_min between 0 and 1440),
  -- С какого дня выставляем. Ставится датой включения: иначе первый же запуск
  -- выкатил бы ученику полсотни квитанций за всю историю занятий.
  since         date,
  -- Куда платить, если платят не картой: «СБП +7 900 000-00-00, Т-Банк, Иван И.»
  payee_name    text,
  payee_details text,
  -- Напоминать о неоплаченном через столько дней. 0 = не напоминать.
  remind_days   smallint not null default 3 check (remind_days between 0 and 30),
  updated_at    timestamptz not null default now()
);

alter table public.tutor_invoice_settings enable row level security;

drop policy if exists tutor_invoice_settings_own on public.tutor_invoice_settings;
create policy tutor_invoice_settings_own on public.tutor_invoice_settings
  for all to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Журнал квитанций
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_invoices (
  id          uuid primary key default gen_random_uuid(),
  tutor_id    uuid   not null,
  student_id  bigint not null,          -- students.id (в этой базе bigint)
  account_id  uuid,                     -- student_accounts.id, если ученик заведён
  lesson_date date   not null,
  lesson_time text   not null default '',
  duration    smallint,
  amount      numeric not null check (amount > 0),
  issued_at   timestamptz not null default now(),
  reminded_at timestamptz,              -- когда последний раз напоминали о долге
  canceled_at timestamptz,              -- репетитор аннулировал (занятие не состоялось)
  -- Ключ идемпотентности: одно занятие — одна квитанция, сколько бы раз ни
  -- запускалась синхронизация (cron, кабинет ученика, кабинет репетитора).
  unique (student_id, lesson_date, lesson_time)
);

create index if not exists lesson_invoices_tutor_idx   on public.lesson_invoices (tutor_id, lesson_date desc);
create index if not exists lesson_invoices_student_idx on public.lesson_invoices (student_id, lesson_date desc);

alter table public.lesson_invoices enable row level security;

-- Репетитор ведёт свои квитанции (в т.ч. может аннулировать).
drop policy if exists lesson_invoices_tutor on public.lesson_invoices;
create policy lesson_invoices_tutor on public.lesson_invoices
  for all to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

-- Ученик видит свои квитанции, родитель — квитанции ребёнка. Отдельных RPC с
-- session_token не нужно: с 30.07.2026 обе роли ходят с настоящим JWT
-- (rls_step2_identity.sql), и RLS работает нативно.
drop policy if exists lesson_invoices_read_own on public.lesson_invoices;
create policy lesson_invoices_read_own on public.lesson_invoices
  for select to app_user
  using (student_id in (select public.current_student_rows())
         or student_id = public.current_parent_student_id());

grant select on public.lesson_invoices to app_user;

-- ---------------------------------------------------------------------------
-- 3. Выставление квитанций
-- ---------------------------------------------------------------------------
-- Конец занятия в UTC. Дата и время в lessons — местные (московские), а база
-- живёт в UTC: без явной зоны вечернее занятие «заканчивалось» бы на три часа
-- позже, и квитанция уезжала бы в следующий день.
create or replace function public.lesson_end_utc(p_date text, p_time text, p_minutes int)
returns timestamptz
language sql immutable set search_path = public as $$
  select ((p_date || ' ' || coalesce(nullif(p_time, ''), '00:00'))::timestamp
            at time zone 'Europe/Moscow')
         + make_interval(mins => coalesce(p_minutes, 60))
$$;

-- Следующая граница периода абонемента. Повторяет арифметику addPeriod() из
-- src/billing.js ВКЛЮЧАЯ переполнение месяца: у JS `setMonth` 31 января + месяц
-- даёт 3 марта, а не 28 февраля. Расходиться тут нельзя — по этим границам
-- кабинет показывает долг, а база выставляет квитанции.
create or replace function public.package_next(p_date date, p_key text)
returns date
language sql immutable set search_path = public as $$
  select case p_key
    when 'week'   then p_date + 7
    when 'weeks2' then p_date + 14
    else ((date_trunc('month', p_date) + interval '1 month')::date
            + (extract(day from p_date)::int - 1))
  end
$$;

-- НАЧИСЛЕНИЯ УЧЕНИКА: одна строка на занятие, за которое он должен заплатить,
-- и сумма именно этого занятия.
--
-- Это SQL-зеркало accrualEntries() из src/billing.js, и оно обязано давать те
-- же числа: кабинет считает долг там, а квитанции выписываются здесь. Если
-- суммы разойдутся, «оплачено» у квитанций разъедется с долгом — ровно то, от
-- чего в шапке этого файла отказались, заводя квитанцию без своего флага.
--
-- Правила, все три взяты из billing.js:
--   * занятие со статусом 'excused' не начисляется никогда;
--   * поштучная оплата — начисляется прошедшее занятие по цене занятия;
--   * абонемент — с началом периода начисляются ВСЕ его занятия сразу, а сумма
--     периода (вписанная руками либо «занятий × цена») делится между ними;
--     остаток от деления кладётся на первое занятие периода.
create or replace function public.student_accrual(p_student public.students)
returns table (lesson_date date, lesson_time text, duration int, amount numeric)
language plpgsql stable set search_path = public as $$
declare
  v_price  numeric := coalesce(p_student.lesson_price, 0);
  v_key    text    := p_student.package_period;
  v_start  date    := p_student.package_start;
  v_manual numeric := nullif(p_student.package_amount, 0);
  v_from   date;
  v_until  date;
  v_total  numeric;
  v_base   numeric;
  v_n      int;
  i        int;
begin
  -- Поштучная оплата (и любая недонастроенная карточка абонемента: период без
  -- даты начала не от чего отсчитывать).
  if coalesce(p_student.payment_mode, 'lesson') <> 'package'
     or v_start is null
     or v_key is null or v_key not in ('week', 'weeks2', 'month') then
    if v_price <= 0 then return; end if;
    return query
      select (l->>'date')::date,
             coalesce(l->>'time', ''),
             coalesce((l->>'duration')::int, p_student.lesson_duration, 60),
             v_price
        from jsonb_array_elements(coalesce(p_student.lessons, '[]'::jsonb)) l
       where nullif(l->>'date', '') is not null
         and coalesce(l->>'status', '') <> 'excused'
         and public.lesson_end_utc(l->>'date', l->>'time',
               coalesce((l->>'duration')::int, p_student.lesson_duration, 60)) < now();
    return;
  end if;

  -- До абонемента ученик платил как все — по факту проведения.
  if v_price > 0 then
    return query
      select (l->>'date')::date,
             coalesce(l->>'time', ''),
             coalesce((l->>'duration')::int, p_student.lesson_duration, 60),
             v_price
        from jsonb_array_elements(coalesce(p_student.lessons, '[]'::jsonb)) l
       where nullif(l->>'date', '') is not null
         and coalesce(l->>'status', '') <> 'excused'
         and (l->>'date')::date < v_start
         and public.lesson_end_utc(l->>'date', l->>'time',
               coalesce((l->>'duration')::int, p_student.lesson_duration, 60)) < now();
  end if;

  -- Периоды от даты начала до текущего включительно. Прошедшие периоды
  -- начислены целиком, иначе долг за прошлый месяц исчезал бы с началом
  -- следующего. 500 шагов — страховка от битой даты, а не бизнес-правило.
  v_from := v_start;
  for i in 1..500 loop
    v_until := public.package_next(v_from, v_key) - 1;

    -- Сумма периода делится между его занятиями; занятия по порядку, остаток от
    -- деления — первому. Период БЕЗ занятий не стоит ничего даже при вписанной
    -- сумме: деньги, не привязанные ни к одному занятию, не легли бы ни в одну
    -- квитанцию (то же правило, что в billing.js).
    return query
      with lesson as (
        select (l->>'date')::date                       as d,
               coalesce(l->>'time', '')                 as t,
               coalesce((l->>'duration')::int, p_student.lesson_duration, 60) as dur
          from jsonb_array_elements(coalesce(p_student.lessons, '[]'::jsonb)) l
         where nullif(l->>'date', '') is not null
           and coalesce(l->>'status', '') <> 'excused'
           and (l->>'date')::date between v_from and v_until
      ),
      numbered as (
        select d, t, dur,
               row_number() over (order by d, t) as n,
               count(*)     over ()              as cnt
          from lesson
      ),
      priced as (
        select d, t, dur, n, cnt, coalesce(v_manual, cnt * v_price) as total
          from numbered
      )
      select d, t, dur,
             case when n = 1 then total - floor(total / cnt) * (cnt - 1)
                             else floor(total / cnt) end
        from priced
       where total > 0;

    exit when v_until >= current_date;
    v_from := public.package_next(v_from, v_key);
  end loop;
end;
$$;

-- Выставляет счета за все занятия, которые уже закончились, но ещё не оплачены
-- вниманием. Возвращает, сколько квитанций выписано за этот запуск.
-- p_tutor = null — по всем репетиторам (так её зовёт cron).
--
-- Сумма берётся из student_accrual(), а НЕ из цены занятия: у абонемента она
-- может быть вписана руками и поделена между занятиями периода. Считать здесь
-- по цене — значит выписать на 8 000 ₽ то, за что начислено 7 000, и тогда
-- самые старые квитанции показались бы погашенными без единой оплаты.
create or replace function public.invoices_sync_for(p_tutor uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with candidate as (
    select
      s.tutor_id,
      s.id           as student_id,
      a.lesson_date,
      a.lesson_time,
      a.duration,
      a.amount,
      (select acc.id
         from student_accounts acc
        where acc.phone is not null and acc.phone = s.phone
        order by (acc.tutor_id = s.tutor_id) desc
        limit 1)     as account_id
    from tutor_invoice_settings cfg
    join students s on s.tutor_id = cfg.tutor_id
    cross join lateral public.student_accrual(s) a
    where cfg.enabled
      and (p_tutor is null or cfg.tutor_id = p_tutor)
      and a.amount > 0
      and a.lesson_date >= coalesce(cfg.since, current_date)
      -- Счёт приходит ПОСЛЕ занятия, даже когда деньги начислены вперёд
      -- абонементом: квитанция за занятие, которого ещё не было, читается как
      -- ошибка. Долг за весь период при этом уже виден в разделе «Оплата».
      and public.lesson_end_utc(
            a.lesson_date::text, a.lesson_time, a.duration + cfg.delay_min
          ) < now()
  ),
  ins as (
    insert into lesson_invoices (tutor_id, student_id, account_id, lesson_date, lesson_time, duration, amount)
    select tutor_id, student_id, account_id, lesson_date, lesson_time, duration, amount
      from candidate
    on conflict (student_id, lesson_date, lesson_time) do nothing
    returning id, account_id, amount, lesson_date
  ),
  -- Уже выставленная квитанция подстраивается под начисление: репетитор мог
  -- поменять цену или сумму абонемента задним числом. Своей истины у квитанции
  -- нет (см. шапку файла) — иначе её сумма разошлась бы с долгом.
  fixed as (
    update lesson_invoices i
       set amount = c.amount
      from candidate c
     where i.student_id  = c.student_id
       and i.lesson_date = c.lesson_date
       and i.lesson_time = c.lesson_time
       and i.canceled_at is null
       and i.amount <> c.amount
    returning 1
  ),
  -- Занятие сняли со счёта («не состоялось») или убрали из расписания — счёт за
  -- него аннулируется. Отменяем ТОЛЬКО по факту отсутствия занятия в карточке:
  -- по пустому начислению было бы опасно, стёртая цена гасила бы всю историю.
  canceled as (
    update lesson_invoices i
       set canceled_at = now()
     where i.canceled_at is null
       and (p_tutor is null or i.tutor_id = p_tutor)
       and exists (select 1 from students s where s.id = i.student_id)
       and not exists (
         select 1
           from students s
           cross join lateral jsonb_array_elements(coalesce(s.lessons, '[]'::jsonb)) l
          where s.id = i.student_id
            and nullif(l->>'date', '') is not null
            and (l->>'date')::date = i.lesson_date
            and coalesce(l->>'time', '') = i.lesson_time
            and coalesce(l->>'status', '') <> 'excused'
       )
    returning 1
  ),
  notified as (
    insert into notifications (user_id, title, body)
    select i.account_id,
           'Квитанция за занятие',
           'Занятие ' || to_char(i.lesson_date, 'DD.MM') || ' — '
             || trim(to_char(i.amount, 'FM9999999990')) || ' ₽. Оплата — в разделе «Оплата».'
      from ins i
     where i.account_id is not null
    returning 1
  )
  select count(*) into v_count from ins;

  return v_count;
end;
$$;

-- Напоминание о неоплаченном. Долг считается ровно так же, как в кабинете:
-- сумма начислений минус все оплаты (student_accrual выше — то же правило, что
-- у billing.js, вместе с абонементом и снятыми со счёта занятиями). Напоминаем не чаще, чем раз в
-- remind_days, и только по самой старой висящей квитанции — чтобы у ученика
-- не появлялось по уведомлению на каждое занятие.
create or replace function public.invoices_remind()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec      record;
  v_count  integer := 0;
begin
  for rec in
    select
      s.id                                as student_id,
      cfg.remind_days,
      (select a.id
         from student_accounts a
        where a.phone is not null and a.phone = s.phone
        order by (a.tutor_id = s.tutor_id) desc
        limit 1)                          as account_id,
      -- Долг: всё начисленное минус всё оплаченное.
      coalesce((select sum(a.amount) from public.student_accrual(s) a), 0)
      - coalesce((
        select sum(coalesce((p->>'amount')::numeric, 0))
          from jsonb_array_elements(coalesce(s.payments, '[]'::jsonb)) p
      ), 0)                               as debt,
      exists (
        select 1
          from lesson_invoices i
         where i.student_id = s.id
           and i.canceled_at is null
           and i.issued_at < now() - make_interval(days => cfg.remind_days)
           and (i.reminded_at is null
                or i.reminded_at < now() - make_interval(days => cfg.remind_days))
      )                                   as due
    from tutor_invoice_settings cfg
    join students s on s.tutor_id = cfg.tutor_id
    where cfg.enabled and cfg.remind_days > 0
  loop
    if rec.debt > 0 and rec.account_id is not null and rec.due then
      insert into notifications (user_id, title, body)
      values (rec.account_id, 'Не забудьте про оплату',
              'По занятиям не хватает ' || trim(to_char(rec.debt, 'FM9999999990')) || ' ₽. Квитанции — в разделе «Оплата».');

      update lesson_invoices set reminded_at = now()
       where student_id = rec.student_id and canceled_at is null;

      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Обёртки для кабинета
-- ---------------------------------------------------------------------------
-- Запас на случай, если cron не работает (или пока не установлен): кабинет
-- дёргает синхронизацию при открытии. Идемпотентность даёт unique-ключ.

-- Репетитор — только по себе.
create or replace function public.invoices_sync_self()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return 0; end if;
  return public.invoices_sync_for(auth.uid());
end;
$$;

-- Ученик и родитель — по своим репетиторам (учеников бывает несколько).
create or replace function public.invoices_sync_mine()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid;
  v_total integer := 0;
begin
  for v_tutor in
    select distinct s.tutor_id
      from students s
     where s.tutor_id is not null
       and (s.id in (select public.current_student_rows())
            or s.id = public.current_parent_student_id())
  loop
    v_total := v_total + public.invoices_sync_for(v_tutor);
  end loop;
  return v_total;
end;
$$;

-- Реквизиты для перевода нужны плательщику, а таблица настроек ему закрыта.
-- Отдаём ровно три поля и только когда квитанции включены.
create or replace function public.invoice_payee(p_tutor uuid)
returns table (enabled boolean, payee_name text, payee_details text)
language sql
security definer
set search_path = public
as $$
  select cfg.enabled, cfg.payee_name, cfg.payee_details
    from tutor_invoice_settings cfg
   where cfg.tutor_id = p_tutor and cfg.enabled
$$;

revoke execute on function public.invoices_sync_for(uuid) from anon, authenticated, app_user;
-- Начисления — служебный расчёт для двух функций выше. Наружу не отдаём: строка
-- ученика целиком в аргументе, а читать её вправе не каждый.
revoke execute on function public.student_accrual(public.students) from anon, authenticated, app_user;
grant  execute on function public.package_next(date, text) to anon, authenticated, app_user;
grant  execute on function public.invoices_sync_self()  to authenticated;
grant  execute on function public.invoices_sync_mine()  to app_user;
grant  execute on function public.invoice_payee(uuid)   to anon, authenticated, app_user;
grant  execute on function public.lesson_end_utc(text, text, int) to anon, authenticated, app_user;

-- ---------------------------------------------------------------------------
-- 5. Расписание
-- ---------------------------------------------------------------------------
-- Ради этого блока всё и затевалось: без него квитанция появлялась бы только
-- когда кто-то откроет кабинет, а обещано «приходит само». pg_cron уже в
-- shared_preload_libraries образа supabase/postgres, поэтому расширение
-- ставится без перезапуска базы. Если его вдруг нет — не падаем: остаются
-- обёртки из п.4.
do $$
begin
  create extension if not exists pg_cron;

  perform cron.unschedule(jobid) from cron.job where jobname in ('invoices-sync', 'invoices-remind');

  perform cron.schedule('invoices-sync', '*/10 * * * *', 'select public.invoices_sync_for(null)');
  -- Напоминания — раз в сутки в 10:00 по Москве (база в UTC).
  perform cron.schedule('invoices-remind', '0 7 * * *', 'select public.invoices_remind()');
exception when others then
  raise notice 'pg_cron недоступен (%), квитанции будут выставляться при открытии кабинета', sqlerrm;
end;
$$;

NOTIFY pgrst, 'reload schema';
