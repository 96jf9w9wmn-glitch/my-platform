-- Группа учеников: постоянный состав, который занимается вместе.
--
-- ГЛАВНОЕ РЕШЕНИЕ: группа НЕ заводит второй сущности «занятие» и второго
-- потока денег. Групповое занятие — это обычное занятие в карточке КАЖДОГО
-- участника (students.lessons), помеченное общим `groupId`. Поэтому долг,
-- квитанции, абонемент, кабинет ученика, кабинет родителя и телеграм-бот
-- продолжают считать ровно то же и тем же кодом, что и раньше: для них
-- групповое занятие ничем не отличается от обычного.
--
-- Так уже приходилось решать дважды — с абонементом и с переносом занятия — и
-- оба раза отдельная сущность оказывалась ошибкой: у одного ученика появлялись
-- два разных числа про деньги либо занятие расходилось со своим предложением о
-- переносе. Здесь та же логика: таблица хранит СОСТАВ и УСЛОВИЯ группы, а не
-- сами занятия.
--
-- Миграция аддитивная: без неё групп просто нет, а всё остальное работает как
-- раньше.

create extension if not exists pgcrypto;

create table if not exists public.student_groups (
  id              uuid primary key default gen_random_uuid(),
  tutor_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  -- Карточки учеников (students.id — bigint в этой базе, не uuid). Массивом, а
  -- не таблицей связей: состав читается и пишется всегда целиком, а джойн ради
  -- трёх строк только добавил бы политикам работы.
  member_ids      bigint[] not null default '{}',
  -- Цена ЗА ОДНОГО участника. NULL — «у каждого своя», то есть цена из карточки
  -- ученика. Отдельного потока денег это не заводит: цена уезжает в само
  -- занятие (lessons[].price), а долг по-прежнему «начислено − оплачено».
  lesson_price    numeric,
  lesson_duration integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists student_groups_tutor_idx on public.student_groups (tutor_id);
create index if not exists student_groups_members_idx on public.student_groups using gin (member_ids);

do $$
begin
  -- Пустое имя не запрещено интерфейсом «на всякий случай»: группа без имени
  -- неотличима от другой такой же ни в расписании, ни в списке чатов.
  if not exists (select 1 from pg_constraint where conname = 'student_groups_name_check') then
    alter table public.student_groups
      add constraint student_groups_name_check check (length(btrim(name)) > 0);
  end if;
  -- Ноль и минус — это описка, а не «бесплатно»: клиент такую цену считает
  -- несуществующей и возвращается к цене из карточки ученика.
  if not exists (select 1 from pg_constraint where conname = 'student_groups_price_check') then
    alter table public.student_groups
      add constraint student_groups_price_check
      check (lesson_price is null or lesson_price > 0);
  end if;
end $$;

alter table public.student_groups enable row level security;

-- Свежей таблице Supabase САМ выдаёт полный табличный грант роли anon (проверено
-- на боевой: anon имел select/insert/update/delete сразу после create table).
-- RLS его перекрывает, но полагаться на это нельзя — политику однажды напишут
-- пошире, и грант окажется дырой. Снимаем явно и сразу.
revoke all on public.student_groups from anon;

grant select, insert, update, delete on public.student_groups to authenticated;
-- Ученику и родителю — только чтение: название группы подписывает занятие в их
-- расписании и комнату в чате, а состав нужен, чтобы показать, с кем занятие.
grant select on public.student_groups to app_user;

drop policy if exists student_groups_tutor on public.student_groups;
create policy student_groups_tutor on public.student_groups for all to authenticated
  using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

drop policy if exists student_groups_member on public.student_groups;
create policy student_groups_member on public.student_groups for select to app_user
  using (
    member_ids && array(select public.current_student_rows())
    or public.current_parent_student_id() = any (member_ids)
  );

-- ---------------------------------------------------------------------------
-- Чат группы
-- ---------------------------------------------------------------------------
-- Комната адресуется как обычный собеседник — `g:<uuid>` в recipient_id, рядом
-- с уже существующими `t:` (репетитор), `s:` (ученик) и `p:` (родитель).
-- Отдельной таблицы сообщений у группы нет: одно сообщение — одна строка,
-- которую читают все участники, а не копия каждому. Копии разошлись бы при
-- первой же правке или удалении.
--
-- Разбор адреса вынесен в функцию: `substring(recipient_id from 3)::uuid`
-- падает на любом чужом значении, и одна кривая строка уронила бы политику для
-- всех сразу.
create or replace function public.chat_group_id(addr text) returns uuid
language sql immutable set search_path = public as $$
  select case
    when addr ~ '^g:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then substring(addr from 3)::uuid
  end
$$;

-- Участник группы (ученик). Родителя в комнату не пускаем намеренно: это чат
-- занимающихся, и переписка одноклассников — не то, что родитель подписывался
-- читать.
create or replace function public.in_student_group(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from student_groups g
    where g.id = gid and g.member_ids && array(select public.current_student_rows())
  )
$$;

create or replace function public.tutor_owns_group(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from student_groups g where g.id = gid and g.tutor_id = auth.uid()
  )
$$;

grant execute on function public.chat_group_id(text),
                        public.in_student_group(uuid),
                        public.tutor_owns_group(uuid)
  to anon, authenticated, app_user;

-- Политики ДОБАВЛЯЮТСЯ к существующим, а не заменяют их: политики
-- складываются по «или», и переписывать личную переписку ради группы не нужно.
--
-- Репетитор своими сообщениями в комнату попадал и по старой политике (он
-- отправитель), а вот сообщений учеников не видел — их recipient_id это `g:…`,
-- а не он сам.
drop policy if exists chat_group_tutor_select on public.chat_messages;
create policy chat_group_tutor_select on public.chat_messages for select to authenticated
  using (public.tutor_owns_group(public.chat_group_id(recipient_id)));

-- «Прочитано» в общей комнате одним флагом не описать (у сообщения много
-- читателей), поэтому групповые сообщения им и не помечаются — счётчика
-- непрочитанного у группы нет. Политика на UPDATE здесь не заводится
-- намеренно: флаг, который нельзя посчитать честно, лучше не трогать вовсе.

drop policy if exists chat_group_member_select on public.chat_messages;
create policy chat_group_member_select on public.chat_messages for select to app_user
  using (public.in_student_group(public.chat_group_id(recipient_id)));

-- Отправка ученика в комнату уже разрешена политикой chat_send_own (она
-- проверяет только отправителя), но полагаться на это нельзя: сузят её — и
-- групповой чат молча онемеет с одной стороны. Пишем явно.
drop policy if exists chat_group_member_send on public.chat_messages;
create policy chat_group_member_send on public.chat_messages for insert to app_user
  with check (
    sender_id = 's:' || public.current_account_id()::text
    and public.in_student_group(public.chat_group_id(recipient_id))
  );

notify pgrst, 'reload schema';
