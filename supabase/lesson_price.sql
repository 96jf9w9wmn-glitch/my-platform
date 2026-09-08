-- У занятия может быть СВОЯ цена (lessons[].price).
--
-- Появилась она ради групповых занятий: в группе занимаются дешевле, чем один
-- на один, а цена в карточке ученика одна на все его занятия. Второго потока
-- денег это не заводит — долг по-прежнему «начислено − оплачено», просто у
-- конкретного занятия сумма своя.
--
-- ЭТО ЗЕРКАЛО accrualEntries ИЗ src/billing.js. Правя одну сторону, правь
-- вторую: на этой функции держатся квитанции, и разойдись они — счета
-- выпишутся не на ту сумму, что висит в долге, а самые старые покажутся
-- погашенными без единой оплаты (так уже было, см. lesson_invoices.sql).
--
-- Правило одно: цена занятия важнее цены карточки, ноль и мусор в занятии —
-- это «цены нет», то есть берётся цена карточки.

create or replace function public.student_accrual(p_student public.students)
returns table (lesson_date date, lesson_time text, duration int, amount numeric)
language plpgsql stable set search_path = public as $$
declare
  v_price  numeric := coalesce(p_student.lesson_price, 0);
  v_key    text    := p_student.package_period;
  v_start  date    := p_student.package_start;
  v_manual numeric := nullif(p_student.package_amount, 0);
  v_size   int;
begin
  -- Поштучная оплата (и любая недонастроенная карточка абонемента: период без
  -- даты начала не от чего отсчитывать).
  if coalesce(p_student.payment_mode, 'lesson') <> 'package'
     or v_start is null
     or v_key is null or v_key not in ('week', 'weeks2', 'month') then
    -- Раньше здесь стоял ранний выход по «цены нет». Теперь выходить нельзя:
    -- у карточки без цены могут стоять групповые занятия со своей. Пустые
    -- начисления отсекает условие amount > 0 в самом запросе.
    return query
      select (l->>'date')::date,
             coalesce(l->>'time', ''),
             coalesce((l->>'duration')::int, p_student.lesson_duration, 60),
             coalesce(nullif((l->>'price')::numeric, 0), v_price)
        from jsonb_array_elements(coalesce(p_student.lessons, '[]'::jsonb)) l
       where nullif(l->>'date', '') is not null
         and coalesce(l->>'status', '') <> 'excused'
         and coalesce(nullif((l->>'price')::numeric, 0), v_price) > 0
         and public.lesson_end_utc(l->>'date', l->>'time',
               coalesce((l->>'duration')::int, p_student.lesson_duration, 60)) < now();
    return;
  end if;

  v_size := public.package_size(p_student);

  -- До абонемента ученик платил как все — по факту проведения.
  return query
    select (l->>'date')::date,
           coalesce(l->>'time', ''),
           coalesce((l->>'duration')::int, p_student.lesson_duration, 60),
           coalesce(nullif((l->>'price')::numeric, 0), v_price)
      from jsonb_array_elements(coalesce(p_student.lessons, '[]'::jsonb)) l
     where nullif(l->>'date', '') is not null
       and coalesce(l->>'status', '') <> 'excused'
       and (l->>'date')::date < v_start
       and coalesce(nullif((l->>'price')::numeric, 0), v_price) > 0
       and public.lesson_end_utc(l->>'date', l->>'time',
             coalesce((l->>'duration')::int, p_student.lesson_duration, 60)) < now();

  -- Периоды абонемента — подряд идущие куски списка занятий по package_size()
  -- штук: «месяц» у ученика с двумя занятиями в неделю это восемь занятий, а не
  -- календарное окно (см. шапку src/billing.js). Период начисляется целиком, как
  -- только пришёл день его первого занятия.
  --
  -- Сумма периода делится между его занятиями, остаток от деления — первому.
  -- Расчётная сумма периода теперь СУММА ЦЕН его занятий, а не «занятий ×
  -- цена»: в периоде могут стоять и обычные занятия, и групповые по своей цене.
  -- При одинаковой цене это ровно прежнее число.
  return query
    with lesson as (
      select (l->>'date')::date                       as d,
             coalesce(l->>'time', '')                 as t,
             coalesce((l->>'duration')::int, p_student.lesson_duration, 60) as dur,
             coalesce(nullif((l->>'price')::numeric, 0), v_price)           as p
        from jsonb_array_elements(coalesce(p_student.lessons, '[]'::jsonb)) l
       where nullif(l->>'date', '') is not null
         and coalesce(l->>'status', '') <> 'excused'
         and (l->>'date')::date >= v_start
    ),
    numbered as (
      select d, t, dur, p, (row_number() over (order by d, t) - 1) as i from lesson
    ),
    chunked as (
      select d, t, dur,
             row_number() over (partition by i / v_size order by d, t) as n,
             count(*)     over (partition by i / v_size)               as cnt,
             sum(p)       over (partition by i / v_size)               as chunk_price,
             min(d)       over (partition by i / v_size)               as first_d
        from numbered
    ),
    priced as (
      select d, t, dur, n, cnt, coalesce(v_manual, chunk_price) as total
        from chunked
       where first_d <= current_date
    )
    select d, t, dur,
           case when n = 1 then total - floor(total / cnt) * (cnt - 1)
                           else floor(total / cnt) end
      from priced
     where total > 0;
end;
$$;

notify pgrst, 'reload schema';
