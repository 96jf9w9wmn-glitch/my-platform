-- Родитель не видел фото ребёнка: политика «parent child avatar» изнутри
-- читала public.student_accounts под ролью app_user, а RLS этой таблицы
-- пускает только владельца аккаунта (current_account_id) и репетитора
-- (auth.uid()). У родительского JWT нет ни того, ни другого — EXISTS всегда
-- пуст, подпись ссылки не выдавалась, и в кабинете оставался протухший адрес.
--
-- Заодно связь «карточка ↔ аккаунт» приведена к текущей модели
-- (student_link_cleanup.sql): сначала students.student_account_id, телефон —
-- только как запасной путь для старых карточек.
--
-- ВЫПОЛНЕНО на боевой базе 29.08.2026.

begin;

-- Аккаунт ребёнка текущего родителя. SECURITY DEFINER: сам родитель строку
-- student_accounts по RLS не видит, а функции нужен доступ до политик.
-- Возвращает NULL, когда в JWT нет student_row_id — политика тогда не пускает.
create or replace function public.current_parent_child_account_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.student_account_id
       from students s
      where s.id = public.current_parent_student_id()
        and s.student_account_id is not null),
    (select sa.id
       from students s
       join student_accounts sa on sa.phone = s.phone
      where s.id = public.current_parent_student_id()
      limit 1)
  )
$$;

drop policy if exists "parent child avatar" on storage.objects;
create policy "parent child avatar" on storage.objects
  for select to app_user
  using (
    bucket_id = 'homework'
    and (storage.foldername(storage.objects.name))[1] = 'student-avatars'
    and (storage.foldername(storage.objects.name))[2]
        = public.current_parent_child_account_id()::text
  );

commit;
