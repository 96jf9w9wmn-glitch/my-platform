-- Уведомления репетитора дублируются на почту.
--
-- Зачем. Почту репетитор указывает при регистрации, но она использовалась
-- только для входа: колокольчик в кабинете видит лишь тот, кто в кабинет зашёл.
-- Пока репетитор не открыл вкладку, он не знает ни о сданном ДЗ, ни о новой
-- заявке, ни о сообщении в чате.
--
-- Почему письмо шлёт сервер, а не клиент. Уведомления кладёт в таблицу тот, кто
-- их вызвал (ученик из своего кабинета, репетитор из своего), и просить клиента
-- ещё и отправить письмо — значит открыть отправку почты кому угодно. Поэтому
-- база сама складывает письмо в очередь `email_outbox`, а разбирает очередь
-- контейнер функций (server/index.js) под service_role.
--
-- Ученику не дублируем: колонка email в student_accounts не заполняется вовсе
-- (регистрация идёт по телефону), писать некуда.

-- Переключатель в «Профиле». По умолчанию включено: почта уже указана, и
-- смысл её указывать появляется как раз здесь.
alter table public.tutors
  add column if not exists email_notify boolean not null default true;

-- ВАЖНО: без гранта на новую колонку `select("*")` у PostgREST начинает
-- отдавать 42501, и кабинет репетитора остаётся вовсе без профиля — так уже
-- ломала его колонка marketing_opt_in (см. supabase/user_consents.sql).
grant select (email_notify), update (email_notify) on public.tutors to authenticated;

create table if not exists public.email_outbox (
  id         bigserial primary key,
  to_email   text        not null,
  subject    text        not null,
  body       text        not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at    timestamptz,
  tries      integer     not null default 0,
  last_error text
);

create index if not exists email_outbox_pending_idx
  on public.email_outbox (id) where sent_at is null;

alter table public.email_outbox enable row level security;
-- Политик нет намеренно: очередь наполняет триггер (SECURITY DEFINER), а
-- разбирает service_role в обход RLS. Клиенту здесь делать нечего — в письмах
-- лежат чужие адреса и тексты уведомлений.
revoke all on public.email_outbox from anon, authenticated, app_user;
revoke all on sequence public.email_outbox_id_seq from anon, authenticated, app_user;

comment on table public.email_outbox is
  'Очередь писем. Наполняет триггер на notifications, разбирает server/index.js.';

-- Кладём уведомление в очередь, если получатель — репетитор с почтой и не
-- отключил дублирование.
create or replace function public.notify_to_email()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text;
  v_subject text;
begin
  select t.email into v_email
    from tutors t
   where t.id = new.user_id and t.email_notify and coalesce(t.email, '') <> '';
  if v_email is null then return new; end if;

  v_subject := 'Precettore: ' || new.title;

  -- Защита от лавины: переписка в чате — это десяток уведомлений подряд с
  -- одним и тем же заголовком, и столько же писем никому не нужно. Разные
  -- события (заголовки) проходят как обычно.
  if exists (
    select 1 from email_outbox
     where to_email = v_email and subject = v_subject
       and created_at > now() - interval '15 minutes'
  ) then
    return new;
  end if;

  insert into email_outbox (to_email, subject, body)
  values (v_email, v_subject, new.body);
  return new;
exception when others then
  -- Письмо — приятное дополнение, а не условие работы: сбой здесь не должен
  -- ронять само уведомление (иначе ученик не смог бы сдать домашнюю работу).
  return new;
end $$;

drop trigger if exists notifications_email on public.notifications;
create trigger notifications_email
  after insert on public.notifications
  for each row execute function public.notify_to_email();

-- Разбор очереди: забрать пачку писем. Повторно взятыми считаются те, что
-- висят в работе дольше пяти минут (контейнер мог перезапуститься на середине).
create or replace function public.email_outbox_claim(p_limit integer default 10)
returns table(id bigint, to_email text, subject text, body text)
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
begin
  -- Отправленное дольше недели назад не нужно: это журнал доставки, а не архив.
  delete from email_outbox where sent_at is not null and sent_at < now() - interval '7 days';

  return query
  update email_outbox o
     set claimed_at = now(), tries = o.tries + 1
   where o.id in (
     select x.id from email_outbox x
      where x.sent_at is null and x.tries < 5
        and (x.claimed_at is null or x.claimed_at < now() - interval '5 minutes')
      order by x.id
      limit greatest(1, least(50, p_limit))
      for update skip locked
   )
  returning o.id, o.to_email, o.subject, o.body;
end $$;

create or replace function public.email_outbox_done(p_id bigint, p_error text default null)
returns void
language sql
volatile
security definer
set search_path to 'public'
as $$
  update email_outbox
     set sent_at = case when p_error is null then now() else null end,
         last_error = p_error
   where id = p_id;
$$;

revoke all on function public.email_outbox_claim(integer) from public, anon, authenticated, app_user;
revoke all on function public.email_outbox_done(bigint, text) from public, anon, authenticated, app_user;
grant execute on function public.email_outbox_claim(integer) to service_role;
grant execute on function public.email_outbox_done(bigint, text) to service_role;
