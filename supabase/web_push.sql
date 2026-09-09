-- Push-уведомления на телефон (Web Push).
--
-- Зачем. Колокольчик видит только тот, кто открыл кабинет, а письмо репетитор
-- прочитает, когда дойдёт до почты. У ученика нет и письма: колонка email в
-- student_accounts пуста у всех, регистрация идёт по телефону. При этом iOS
-- выгружает фоновую вкладку постоянно (за восемь минут телефон загружал
-- страницу 24 раза, см. CLAUDE.md), то есть «приложение открыто» — состояние
-- редкое. Push — единственный способ дотянуться до человека, когда приложение
-- закрыто, и единственный, который работает у ученика.
--
-- Устроено ровно как дублирование на почту (supabase/email_notify.sql), и это
-- намеренно: триггер на `notifications` складывает посылку в очередь, а
-- разбирает её контейнер функций под service_role (server/pushQueue.js).
-- pg_cron не годится по той же причине — из базы наружу, к шлюзам Apple и
-- Google, не сходить.
--
-- Отдельного переключателя «включить push» НЕТ намеренно. Подписка и есть
-- переключатель: она заводится по нажатию кнопки на устройстве и удаляется
-- ею же. Колонка-тумблер рядом с этим только разошлась бы с правдой — на
-- телефоне разрешение можно отозвать в настройках iOS, и база об этом не
-- узнает.

-- Подписки. Одна строка — одно устройство: у человека это может быть и
-- телефон, и рабочий ноутбук, и уведомление должно прийти на оба.
create table if not exists public.push_subscriptions (
  id         bigserial primary key,
  -- Для репетитора это auth.uid(), для ученика и родителя — current_account_id().
  -- Ровно то же значение, что лежит в notifications.user_id, поэтому одна
  -- таблица покрывает обе роли и триггеру не нужно знать, кто перед ним.
  user_id    uuid        not null,
  -- Адрес шлюза с идентификатором устройства внутри. Он же естественный ключ:
  -- повторная подписка того же устройства должна обновлять строку, а не
  -- плодить копии (иначе одно уведомление придёт пять раз).
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null,
  label      text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subs_tutor on public.push_subscriptions;
create policy push_subs_tutor on public.push_subscriptions
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists push_subs_account on public.push_subscriptions;
create policy push_subs_account on public.push_subscriptions
  to app_user using (user_id = current_account_id()) with check (user_id = current_account_id());

grant select, insert, update, delete on public.push_subscriptions to authenticated, app_user;
grant usage, select on sequence public.push_subscriptions_id_seq to authenticated, app_user;

comment on table public.push_subscriptions is
  'Подписки устройств на push. Заводит и удаляет сам клиент (src/push.js).';

-- Очередь посылок. Строка на КАЖДОЕ устройство: доставка у них независимая, и
-- протухший телефон не должен мешать доставке на ноутбук.
create table if not exists public.push_outbox (
  id              bigserial primary key,
  subscription_id bigint      not null references public.push_subscriptions(id) on delete cascade,
  title           text        not null,
  body            text        not null,
  created_at      timestamptz not null default now(),
  claimed_at      timestamptz,
  sent_at         timestamptz,
  tries           integer     not null default 0,
  last_error      text
);

create index if not exists push_outbox_pending_idx
  on public.push_outbox (id) where sent_at is null;

alter table public.push_outbox enable row level security;
-- Политик нет намеренно, как и у email_outbox: очередь наполняет триггер
-- (SECURITY DEFINER), а разбирает service_role в обход RLS. В посылках лежат
-- чужие тексты уведомлений, клиенту тут делать нечего.
revoke all on public.push_outbox from anon, authenticated, app_user;
revoke all on sequence public.push_outbox_id_seq from anon, authenticated, app_user;

comment on table public.push_outbox is
  'Очередь push. Наполняет триггер на notifications, разбирает server/pushQueue.js.';

-- Раскладываем уведомление по устройствам получателя.
create or replace function public.notify_to_push()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from push_subscriptions s where s.user_id = new.user_id) then
    return new;
  end if;

  -- Защита от лавины, та же что у почты: переписка в чате — это десяток
  -- уведомлений подряд с одним заголовком, и столько же посылок на телефон
  -- превратили бы разговор в трезвон. Разные события проходят как обычно.
  if exists (
    select 1
      from push_outbox o
      join push_subscriptions s on s.id = o.subscription_id
     where s.user_id = new.user_id and o.title = new.title
       and o.created_at > now() - interval '15 minutes'
  ) then
    return new;
  end if;

  insert into push_outbox (subscription_id, title, body)
  select s.id, new.title, new.body
    from push_subscriptions s
   where s.user_id = new.user_id;
  return new;
exception when others then
  -- Push — приятное дополнение, а не условие работы: сбой здесь не должен
  -- ронять само уведомление (иначе ученик не смог бы сдать домашнюю работу).
  return new;
end $$;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.notify_to_push();

-- Разбор очереди: забрать пачку вместе с ключами подписки. Повторно взятыми
-- считаются посылки, висящие в работе дольше пяти минут (контейнер мог
-- перезапуститься на середине).
create or replace function public.push_outbox_claim(p_limit integer default 20)
returns table(id bigint, subscription_id bigint, endpoint text, p256dh text, auth text,
              title text, body text)
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
begin
  -- Отправленное дольше недели назад не нужно: это журнал доставки, а не архив.
  delete from push_outbox where sent_at is not null and sent_at < now() - interval '7 days';

  return query
  with taken as (
    update push_outbox o
       set claimed_at = now(), tries = o.tries + 1
     where o.id in (
       select x.id from push_outbox x
        where x.sent_at is null and x.tries < 5
          and (x.claimed_at is null or x.claimed_at < now() - interval '5 minutes')
        order by x.id
        limit greatest(1, least(100, p_limit))
        for update skip locked
     )
    returning o.id, o.subscription_id, o.title, o.body
  )
  select t.id, t.subscription_id, s.endpoint, s.p256dh, s.auth, t.title, t.body
    from taken t
    join push_subscriptions s on s.id = t.subscription_id;
end $$;

create or replace function public.push_outbox_done(p_id bigint, p_error text default null)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
begin
  update push_outbox
     set sent_at = case when p_error is null then now() else null end,
         last_error = p_error
   where id = p_id;
  if p_error is null then
    update push_subscriptions s
       set last_ok_at = now()
      from push_outbox o
     where o.id = p_id and s.id = o.subscription_id;
  end if;
end $$;

-- Шлюз ответил «такой подписки нет» (приложение удалили с домашнего экрана).
-- Держать её дальше незачем: каждая посылка будет впустую ходить в сеть.
create or replace function public.push_subscription_drop(p_id bigint)
returns void
language sql
volatile
security definer
set search_path to 'public'
as $$
  delete from push_subscriptions where id = p_id;
$$;

revoke all on function public.push_outbox_claim(integer) from public, anon, authenticated, app_user;
revoke all on function public.push_outbox_done(bigint, text) from public, anon, authenticated, app_user;
revoke all on function public.push_subscription_drop(bigint) from public, anon, authenticated, app_user;
grant execute on function public.push_outbox_claim(integer) to service_role;
grant execute on function public.push_outbox_done(bigint, text) to service_role;
grant execute on function public.push_subscription_drop(bigint) to service_role;
