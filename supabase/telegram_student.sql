-- Телеграм-бот у УЧЕНИКА: своя привязка, свои разделы, свои уведомления.
--
-- Зачем. До этой миграции бот был только репетиторским: расписание, домашки и
-- деньги в телефоне у того, кто ведёт занятия. У ученика телефон тот же самый,
-- а узнать о выданной работе или завтрашнем занятии он мог, только открыв
-- кабинет. Почты у него нет вовсе (регистрация идёт по номеру), поэтому
-- дублировать уведомления письмом, как репетитору, некуда — Telegram здесь
-- закрывает ровно ту же дыру, что письмо закрыло у репетитора.
--
-- Бот ОДИН на обе роли, второго заводить не нужно: роль определяется тем, какая
-- привязка нашлась по chat_id. Один чат обслуживает одну роль — привязка ученика
-- вытесняет привязку репетитора в этом же чате и наоборот, иначе в одном чате
-- смешались бы «мои ученики» и «мои задания».
--
-- Тарифом привязка ученика НЕ ограничена, в отличие от репетиторской. Ученик за
-- платформу не платит, и это такой же канал доставки его собственных
-- уведомлений, как уже работающий push в кабинете: гейт здесь означал бы, что
-- при понижении тарифа репетитора ученик молча перестаёт получать напоминания
-- о занятии.
--
-- Выполнить в Studio → SQL Editor. Идемпотентно. Пока миграция не выполнена,
-- карточка в кабинете ученика честно пишет, что привязку негде хранить, а бот
-- отвечает ученику «код не подошёл» вместо тишины.

begin;

-- ── Привязка чата к ученику ─────────────────────────────────────────────────
create table if not exists public.student_telegram (
  account_id uuid primary key references public.student_accounts(id) on delete cascade,
  -- UNIQUE по той же причине, что и у репетитора: один чат — один аккаунт.
  chat_id    bigint not null unique,
  username   text,
  first_name text,
  notify     boolean not null default true,
  linked_at  timestamptz not null default now(),
  last_seen  timestamptz
);

alter table public.student_telegram enable row level security;

drop policy if exists student_telegram_read on public.student_telegram;
create policy student_telegram_read on public.student_telegram
  for select to app_user
  using (account_id = public.current_account_id());

-- Отвязать ученик может сам: это снятие доступа, а не выдача.
drop policy if exists student_telegram_unlink on public.student_telegram;
create policy student_telegram_unlink on public.student_telegram
  for delete to app_user
  using (account_id = public.current_account_id());

revoke all on public.student_telegram from anon, authenticated;
grant select, delete on public.student_telegram to app_user;

-- ── Коды привязки теперь бывают двух пород ──────────────────────────────────
-- Таблица кодов общая: код одноразовый и живёт 15 минут в обоих случаях, а
-- разводить два одинаковых механизма ради одной колонки незачем.
alter table public.telegram_link_codes
  add column if not exists account_id uuid references public.student_accounts(id) on delete cascade;

alter table public.telegram_link_codes alter column tutor_id drop not null;

-- Ровно один владелец у кода: иначе погашение кода ученика могло бы привязать
-- чат к репетитору.
alter table public.telegram_link_codes
  drop constraint if exists telegram_link_codes_owner;
alter table public.telegram_link_codes
  add constraint telegram_link_codes_owner
  check ((tutor_id is not null) <> (account_id is not null));

create index if not exists telegram_link_codes_account_idx
  on public.telegram_link_codes (account_id, created_at desc);

-- ── Выдача кода ученику ─────────────────────────────────────────────────────
-- Зеркало telegram_link_code_new() для роли app_user: личность берётся из JWT
-- (claim account_id), поэтому выдать код чужому аккаунту нельзя.
create or replace function public.telegram_link_code_student()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid := public.current_account_id();
  v_code    text;
begin
  if v_account is null then
    raise exception 'Нужен вход ученика';
  end if;

  delete from telegram_link_codes
   where account_id = v_account and used_at is null;

  v_code := (
    select string_agg(
             substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                    1 + floor(random() * 32)::int, 1), '')
      from generate_series(1, 8)
  );

  insert into telegram_link_codes (code, account_id, expires_at)
  values (v_code, v_account, now() + interval '15 minutes');

  return v_code;
end;
$$;

revoke all on function public.telegram_link_code_student() from public, anon, authenticated;
grant execute on function public.telegram_link_code_student() to app_user;

-- ── Погашение кода ученика ──────────────────────────────────────────────────
create or replace function public.telegram_student_claim(
  p_code       text,
  p_chat       bigint,
  p_username   text,
  p_first_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  update telegram_link_codes
     set used_at = now()
   where code = upper(btrim(p_code))
     and used_at is null
     and expires_at > now()
     and account_id is not null
  returning account_id into v_account;

  if v_account is null then
    return null;
  end if;

  -- Чат уступает новой привязке — в том числе репетиторской, если этот же чат
  -- раньше обслуживал кабинет репетитора.
  delete from tutor_telegram   where chat_id = p_chat;
  delete from student_telegram where chat_id = p_chat and account_id <> v_account;

  insert into student_telegram (account_id, chat_id, username, first_name, last_seen)
  values (v_account, p_chat, p_username, p_first_name, now())
  on conflict (account_id) do update
    set chat_id    = excluded.chat_id,
        username   = excluded.username,
        first_name = excluded.first_name,
        linked_at  = now(),
        last_seen  = now();

  return v_account;
end;
$$;

revoke all on function public.telegram_student_claim(text, bigint, text, text)
  from public, anon, authenticated, app_user;
grant execute on function public.telegram_student_claim(text, bigint, text, text) to service_role;

-- ── Код репетитора больше не годится ученику и наоборот ─────────────────────
-- Переопределяем функцию из telegram_bot.sql: без условия на tutor_id она
-- погасила бы код ученика и вернула NULL, то есть код сгорал бы впустую.
create or replace function public.telegram_link_claim(
  p_code       text,
  p_chat       bigint,
  p_username   text,
  p_first_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid;
begin
  update telegram_link_codes
     set used_at = now()
   where code = upper(btrim(p_code))
     and used_at is null
     and expires_at > now()
     and tutor_id is not null
  returning tutor_id into v_tutor;

  if v_tutor is null then
    return null;
  end if;

  delete from tutor_telegram   where chat_id = p_chat and tutor_id <> v_tutor;
  delete from student_telegram where chat_id = p_chat;

  insert into tutor_telegram (tutor_id, chat_id, username, first_name, last_seen)
  values (v_tutor, p_chat, p_username, p_first_name, now())
  on conflict (tutor_id) do update
    set chat_id    = excluded.chat_id,
        username   = excluded.username,
        first_name = excluded.first_name,
        linked_at  = now(),
        last_seen  = now();

  return v_tutor;
end;
$$;

revoke all on function public.telegram_link_claim(text, bigint, text, text)
  from public, anon, authenticated, app_user;
grant execute on function public.telegram_link_claim(text, bigint, text, text) to service_role;

commit;

-- ── Очередь сообщений боту ──────────────────────────────────────────────────
--
-- Уведомления ученику берутся НЕ с клиента, в отличие от репетиторских
-- (те инициирует браузер ученика через src/telegramNotify.js). Причина простая:
-- всё, о чём стоит написать ученику, уже кладётся в `notifications` — выдача
-- работы, проверка, сообщение репетитора, напоминание о занятии от pg_cron.
-- Триггер на этой таблице даёт весь список разом и не требует трогать ни один
-- из экранов, которые уведомления создают.
--
-- Почему очередь, а не отправка прямо из триггера: из базы наружу в
-- api.telegram.org не сходить (та же причина, по которой письма разбирает
-- контейнер, а не pg_cron).
begin;

create table if not exists public.telegram_outbox (
  id         bigserial primary key,
  chat_id    bigint      not null,
  title      text        not null,
  body       text        not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at    timestamptz,
  tries      integer     not null default 0,
  last_error text
);

create index if not exists telegram_outbox_pending_idx
  on public.telegram_outbox (id) where sent_at is null;

alter table public.telegram_outbox enable row level security;
-- Политик нет намеренно: очередь наполняет триггер (SECURITY DEFINER), разбирает
-- service_role в обход RLS. В строках лежат чужие chat_id и тексты уведомлений.
revoke all on public.telegram_outbox from anon, authenticated, app_user;
revoke all on sequence public.telegram_outbox_id_seq from anon, authenticated, app_user;

comment on table public.telegram_outbox is
  'Очередь сообщений ученику в Telegram. Наполняет триггер на notifications, разбирает server/telegramQueue.js.';

create or replace function public.notify_to_telegram()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_chat bigint;
begin
  -- notifications.user_id хранит либо auth.uid() репетитора, либо
  -- student_accounts.id ученика — обе колонки uuid, поэтому различает их
  -- именно совпадение с таблицей привязки.
  select st.chat_id into v_chat
    from student_telegram st
   where st.account_id = new.user_id and st.notify;
  if v_chat is null then return new; end if;

  -- Та же защита от лавины, что у почты: переписка в чате — это десяток
  -- уведомлений подряд с одним заголовком. Разные события проходят как обычно.
  if exists (
    select 1 from telegram_outbox
     where chat_id = v_chat and title = new.title
       and created_at > now() - interval '15 minutes'
  ) then
    return new;
  end if;

  insert into telegram_outbox (chat_id, title, body)
  values (v_chat, new.title, coalesce(new.body, ''));
  return new;
exception when others then
  -- Сообщение в Telegram — приятное дополнение, а не условие работы: сбой здесь
  -- не должен ронять само уведомление.
  return new;
end $$;

drop trigger if exists notifications_telegram on public.notifications;
create trigger notifications_telegram
  after insert on public.notifications
  for each row execute function public.notify_to_telegram();

create or replace function public.telegram_outbox_claim(p_limit integer default 10)
returns table(id bigint, chat_id bigint, title text, body text)
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
begin
  delete from telegram_outbox where sent_at is not null and sent_at < now() - interval '7 days';

  return query
  update telegram_outbox o
     set claimed_at = now(), tries = o.tries + 1
   where o.id in (
     select x.id from telegram_outbox x
      where x.sent_at is null and x.tries < 5
        and (x.claimed_at is null or x.claimed_at < now() - interval '5 minutes')
      order by x.id
      limit greatest(1, least(50, p_limit))
      for update skip locked
   )
  returning o.id, o.chat_id, o.title, o.body;
end $$;

create or replace function public.telegram_outbox_done(p_id bigint, p_error text default null)
returns void
language sql
volatile
security definer
set search_path to 'public'
as $$
  update telegram_outbox
     set sent_at = case when p_error is null then now() else null end,
         last_error = p_error
   where id = p_id;
$$;

revoke all on function public.telegram_outbox_claim(integer) from public, anon, authenticated, app_user;
revoke all on function public.telegram_outbox_done(bigint, text) from public, anon, authenticated, app_user;
grant execute on function public.telegram_outbox_claim(integer) to service_role;
grant execute on function public.telegram_outbox_done(bigint, text) to service_role;

commit;

-- ── Функции для самого бота ─────────────────────────────────────────────────
-- Тот же приём, что и у репетиторских: бот ходит не под service_role, а под
-- своим секретом (supabase/telegram_bot_rpc.sql), и список того, что ему
-- разрешено, виден в одном месте.
begin;

-- Привязка чата: кого обслуживает этот чат, плюс переключатель уведомлений
-- и отвязка. Зеркало bot_link для ученика.
create or replace function public.bot_student_link(
  p_secret text,
  p_chat   bigint,
  p_touch  boolean default false,
  p_notify boolean default null,
  p_unlink boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  if not bot_ok(p_secret) then return null; end if;

  if p_unlink then
    delete from student_telegram where chat_id = p_chat;
    return null;
  end if;

  if p_notify is not null then
    update student_telegram set notify = p_notify where chat_id = p_chat;
  end if;

  if p_touch then
    update student_telegram set last_seen = now() where chat_id = p_chat;
  end if;

  select to_jsonb(t) into r
    from (select account_id, chat_id, notify
            from student_telegram where chat_id = p_chat) t;
  return r;
end;
$$;

create or replace function public.bot_student_claim(
  p_secret     text,
  p_code       text,
  p_chat       bigint,
  p_username   text,
  p_first_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not bot_ok(p_secret) then return null; end if;
  return telegram_student_claim(p_code, p_chat, p_username, p_first_name);
end;
$$;

-- Всё, что бот показывает ученику, одним запросом.
--
-- ПОЯСА. Занятия лежат настенным временем в поясе-ЯКОРЕ карточки
-- (students.timezone), а показывать их надо по часам самого ученика
-- (student_accounts.timezone). Поэтому оба пояса едут наружу, а перевод делает
-- бот тем же кодом, что и кабинет (src/timezone.js) — второй реализации
-- перевода быть не должно.
create or replace function public.bot_student_home(p_secret text, p_account uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_rows  bigint[];
  r       jsonb;
begin
  if not bot_ok(p_secret) then return null; end if;

  select phone into v_phone from student_accounts where id = p_account;

  -- Карточки ученика у всех его репетиторов. Условие повторяет
  -- current_student_rows(): связь идёт по student_account_id ИЛИ по телефону —
  -- у карточек, заведённых до student_link_cleanup.sql, ссылки нет.
  select coalesce(array_agg(s.id), '{}') into v_rows
    from students s
   where s.student_account_id = p_account
      or (v_phone is not null and s.phone = v_phone);

  select jsonb_build_object(
    'name', (select name from student_accounts where id = p_account),
    'tz',   (select timezone from student_accounts where id = p_account),
    'cards', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'tz', s.timezone,
               'tutor', t.name,
               'lessons', s.lessons))
        from students s
        left join tutors t on t.id = s.tutor_id
       where s.id = any(v_rows)), '[]'::jsonb),
    'homework', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.created_at desc)
        from (select id, student_id, title, status, deadline, grade, created_at
                from homework
               where student_id = any(v_rows)
               order by created_at desc limit 100) h), '[]'::jsonb),
    -- ВНИМАНИЕ: у вариантов student_id — это АККАУНТ (uuid), а не карточка
    -- ученика у репетитора (bigint), в отличие от домашних работ. Так их пишет
    -- и кабинет ученика (StudentDashboard), на этом же держится их RLS.
    'variants', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.created_at desc)
        from (select vs.id, va.title, va.deadline,
                     vs.status, vs.total_score, vs.created_at
                from variant_submissions vs
                join variants va on va.id = vs.variant_id
               where vs.student_id = p_account
               order by vs.created_at desc limit 50) v), '[]'::jsonb)
  ) into r;

  return r;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.bot_student_link(text, bigint, boolean, boolean, boolean)',
    'public.bot_student_claim(text, text, bigint, text, text)',
    'public.bot_student_home(text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, authenticated, app_user', f);
    execute format('grant execute on function %s to anon, service_role', f);
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';
