-- Шаг 3 RLS: заменить декоративные политики на настоящие.
--
-- До этой миграции почти на всех таблицах стояло «using (true)» для роли public:
-- RLS числился включённым, а пускал кого угодно. Живая проба показывала, что
-- анониму доступны все ученики, ДЗ, чат, уведомления и варианты.
--
-- Роли после миграции:
--   authenticated — репетитор, узнаётся по auth.uid()
--   app_user      — ученик (claim account_id) и родитель (claim student_row_id),
--                   токен выдаётся при входе, см. rls_step2_identity.sql
--   anon          — только лендинг: заявки и вход
--
-- Идентификаторы в чате префиксные (так их строит клиент):
--   t:<auth.uid()>  репетитор,  s:<account_id>  ученик,  p:<students.id>  родитель

begin;

-- ---------------------------------------------------------------------------
-- Гранты для роли ученика/родителя. RLS отфильтрует строки, гранты лишь
-- открывают саму возможность обратиться к таблице.
-- ---------------------------------------------------------------------------
grant select, update on public.students to app_user;
grant select, update on public.homework to app_user;
grant select, insert, update, delete on public.notifications to app_user;
grant select, insert, update on public.chat_messages to app_user;
grant select, insert, update on public.variant_submissions to app_user;
grant select on public.variants to app_user;
grant select, insert, update on public.boards to app_user;
grant select on public.tutors to app_user;
grant insert on public.pending_students to app_user;
grant select (id, email, name, tutor_code, tutor_id, created_at, phone, avatar,
              exam_goal, grade, target_score, onboarded) on public.student_accounts to app_user;
grant update (avatar, exam_goal, grade, target_score, onboarded, tutor_id, tutor_code, name)
  on public.student_accounts to app_user;
grant select on public.v_student_weak_types to app_user;
grant usage, select on all sequences in schema public to app_user;

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
drop policy if exists "Tutor can manage own students" on public.students;
drop policy if exists "Tutor can insert own students" on public.students;
drop policy if exists students_public_read on public.students;

create policy students_tutor on public.students for all to authenticated
  using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());
-- Ученик видит свои карточки у всех репетиторов, родитель — карточку ребёнка.
create policy students_read_own on public.students for select to app_user
  using (id in (select public.current_student_rows()) or id = public.current_parent_student_id());
-- Ученик правит свою карточку (аватар, телефон, предмет) — родитель нет.
create policy students_update_own on public.students for update to app_user
  using (id in (select public.current_student_rows()))
  with check (id in (select public.current_student_rows()));

-- ---------------------------------------------------------------------------
-- homework
-- ---------------------------------------------------------------------------
drop policy if exists "Allow all on homework" on public.homework;

create policy homework_tutor on public.homework for all to authenticated
  using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());
create policy homework_read_own on public.homework for select to app_user
  using (student_id in (select public.current_student_rows())
         or student_id = public.current_parent_student_id());
-- Сдача ДЗ учеником. Родителю запись не нужна.
create policy homework_submit on public.homework for update to app_user
  using (student_id in (select public.current_student_rows()))
  with check (student_id in (select public.current_student_rows()));

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
drop policy if exists "Allow all on notifications" on public.notifications;

create policy notifications_tutor on public.notifications for all to authenticated
  using (user_id = auth.uid()) with check (true);
create policy notifications_own on public.notifications for select to app_user
  using (user_id = public.current_account_id());
create policy notifications_mark on public.notifications for update to app_user
  using (user_id = public.current_account_id())
  with check (user_id = public.current_account_id());
create policy notifications_delete_own on public.notifications for delete to app_user
  using (user_id = public.current_account_id());
-- Отправку уведомления другой стороне не ограничиваем: это не утечка данных,
-- обе стороны шлют их друг другу (репетитор ученику и наоборот).
create policy notifications_send on public.notifications for insert to app_user
  with check (true);

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------
drop policy if exists chat_select on public.chat_messages;
drop policy if exists chat_tutor_select on public.chat_messages;
drop policy if exists chat_tutor_insert on public.chat_messages;
drop policy if exists chat_tutor_mark_read on public.chat_messages;
drop policy if exists chat_insert on public.chat_messages;
drop policy if exists chat_update on public.chat_messages;

-- ВНИМАНИЕ: одной политикой FOR ALL тут не обойтись. WITH CHECK у неё
-- проверяет и строку ПОСЛЕ UPDATE, а у входящего сообщения отправитель —
-- ученик, поэтому пометка «прочитано» у репетитора отклонялась (см.
-- chat_tutor_mark_read.sql, 30.08.2026).
drop policy if exists chat_tutor on public.chat_messages;
create policy chat_tutor_select on public.chat_messages for select to authenticated
  using (
    sender_id    = 't:' || auth.uid()::text or
    recipient_id = 't:' || auth.uid()::text
  );
create policy chat_tutor_insert on public.chat_messages for insert to authenticated
  with check (sender_id = 't:' || auth.uid()::text);
create policy chat_tutor_mark_read on public.chat_messages for update to authenticated
  using (recipient_id = 't:' || auth.uid()::text)
  with check (recipient_id = 't:' || auth.uid()::text);
create policy chat_read_own on public.chat_messages for select to app_user
  using (
    sender_id    = 's:' || public.current_account_id()::text or
    recipient_id = 's:' || public.current_account_id()::text or
    sender_id    = 'p:' || public.current_parent_student_id()::text or
    recipient_id = 'p:' || public.current_parent_student_id()::text
  );
create policy chat_send_own on public.chat_messages for insert to app_user
  with check (
    sender_id = 's:' || public.current_account_id()::text or
    sender_id = 'p:' || public.current_parent_student_id()::text
  );
-- Пометка «прочитано» — только на своих входящих.
create policy chat_mark_read on public.chat_messages for update to app_user
  using (
    recipient_id = 's:' || public.current_account_id()::text or
    recipient_id = 'p:' || public.current_parent_student_id()::text
  ) with check (true);

-- ---------------------------------------------------------------------------
-- variants и variant_submissions
-- ---------------------------------------------------------------------------
drop policy if exists "Allow all on variants" on public.variants;
drop policy if exists "Allow all on submissions" on public.variant_submissions;

create policy variants_tutor on public.variants for all to authenticated
  using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());
-- Ученик видит варианты своего репетитора.
create policy variants_read_own on public.variants for select to app_user
  using (tutor_id = (select tutor_id from public.student_accounts
                      where id = public.current_account_id()));

create policy submissions_tutor on public.variant_submissions for all to authenticated
  using (exists (select 1 from public.variants v
                  where v.id = variant_submissions.variant_id and v.tutor_id = auth.uid()))
  with check (exists (select 1 from public.variants v
                       where v.id = variant_submissions.variant_id and v.tutor_id = auth.uid()));
create policy submissions_own on public.variant_submissions for select to app_user
  using (student_id = public.current_account_id());
create policy submissions_create on public.variant_submissions for insert to app_user
  with check (student_id = public.current_account_id());
create policy submissions_update_own on public.variant_submissions for update to app_user
  using (student_id = public.current_account_id())
  with check (student_id = public.current_account_id());

-- ---------------------------------------------------------------------------
-- boards — единственная таблица, где RLS вообще не был включён
-- ---------------------------------------------------------------------------
alter table public.boards enable row level security;
-- student_id здесь text: у репетитора это id карточки, у ученика — его же.
create policy boards_tutor on public.boards for all to authenticated
  using (exists (select 1 from public.students s
                  where s.id::text = boards.student_id and s.tutor_id = auth.uid()))
  with check (exists (select 1 from public.students s
                       where s.id::text = boards.student_id and s.tutor_id = auth.uid()));
create policy boards_own on public.boards for all to app_user
  using (student_id in (select public.current_student_rows()::text)
         or student_id = public.current_parent_student_id()::text)
  with check (student_id in (select public.current_student_rows()::text));

-- ---------------------------------------------------------------------------
-- tutors — карточка репетитора видна ученику, но без e-mail
-- ---------------------------------------------------------------------------
drop policy if exists "Allow all on tutors" on public.tutors;

revoke select on public.tutors from anon, authenticated, app_user;
grant select (id, name, code, subject, experience, student_count_range,
              teaching_format, exam_focus, onboarding_completed, created_at)
  on public.tutors to anon, authenticated, app_user;
grant select (email) on public.tutors to authenticated;

create policy tutors_self on public.tutors for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Ученик ищет репетитора по коду при привязке и читает имя своего.
create policy tutors_read_public on public.tutors for select to anon, authenticated, app_user
  using (true);

-- ---------------------------------------------------------------------------
-- student_accounts
-- ---------------------------------------------------------------------------
drop policy if exists "Allow all on student_accounts" on public.student_accounts;

-- Репетитор видит аккаунты своих учеников: привязанных к нему напрямую или
-- совпадающих по телефону с его карточками.
create policy accounts_tutor_read on public.student_accounts for select to authenticated
  using (tutor_id = auth.uid()
         or phone in (select s.phone from public.students s where s.tutor_id = auth.uid()));
create policy accounts_self on public.student_accounts for select to app_user
  using (id = public.current_account_id());
create policy accounts_self_update on public.student_accounts for update to app_user
  using (id = public.current_account_id()) with check (id = public.current_account_id());

-- ---------------------------------------------------------------------------
-- pending_students
-- ---------------------------------------------------------------------------
drop policy if exists "Allow all on pending_students" on public.pending_students;

create policy pending_tutor on public.pending_students for all to authenticated
  using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());
create policy pending_student_create on public.pending_students for insert to app_user
  with check (student_account_id = public.current_account_id());

-- ---------------------------------------------------------------------------
-- Снять избыточные права анонима. Ему остаётся лендинг: заявка и вход по RPC.
-- ---------------------------------------------------------------------------
revoke all on public.students, public.homework, public.notifications,
              public.chat_messages, public.variants, public.variant_submissions,
              public.boards, public.pending_students, public.tasks,
              public.student_invites, public.task_attempts
  from anon;
revoke select, insert, update, delete on public.student_accounts from anon;
-- TRUNCATE не нужен никому из клиентских ролей.
revoke truncate on all tables in schema public from anon, authenticated, app_user;

commit;
