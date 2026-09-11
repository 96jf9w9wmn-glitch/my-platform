-- Ученик читает СВОИ попытки решения заданий.
--
-- Зачем: в кабинете ученика появился раздел «Результаты» (готовность к
-- экзамену, карта заданий по номерам, «над чем поработать»). Считается он по
-- task_attempts — тем же попыткам и тем же правилом первых ответов, что и
-- «Результаты» у репетитора, иначе два кабинета показали бы разные проценты
-- по одному и тому же ученику.
--
-- Почему миграция вообще нужна: у task_attempts RLS включён с самого начала
-- (supabase/task_attempts.sql), но политика там ровно одна — репетиторская, а
-- табличного гранта роли app_user нет вовсе. То есть ученик до этой миграции
-- получал не пустой список, а 42501 «permission denied for table
-- task_attempts». Клиент это переживает (блоки просто не появляются), но
-- раздел был бы пустым.
--
-- Ключ доступа — account_id, а не student_id: попытку пишет
-- task_attempt_log под проверкой session_token и всегда проставляет аккаунт,
-- тогда как student_id (карточка у репетитора) бывает и пустым. Родителю
-- доступа тут не даём: в его кабинете этого раздела нет, а открывать таблицу
-- «на будущее» — это лишняя поверхность.
--
-- Выполнить в Studio → SQL Editor. Идемпотентно.

begin;

grant select on public.task_attempts to app_user;

drop policy if exists task_attempts_read_own on public.task_attempts;
create policy task_attempts_read_own on public.task_attempts
  for select to app_user
  using (account_id = public.current_account_id());

commit;

-- Вьюха v_student_weak_types (security_invoker) теперь тоже отвечает ученику:
-- грант на неё роли app_user был выдан ещё в rls_step3_policies.sql, не
-- работала она именно из-за отсутствия доступа к самой таблице.
NOTIFY pgrst, 'reload schema';
