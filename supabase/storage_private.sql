-- Приватные бакеты для файлов с персональными данными.
--
-- Было: бакеты `homework` и `variants` публичные — любой файл (фото домашней
-- работы, аватар ребёнка, скан решения) скачивался прямым адресом вообще без
-- авторизации, проверено curl'ом. Непредсказуемость пути мерой защиты не
-- является: адрес не истекает, попадает в историю браузера, пересылается.
--
-- Стало: бакеты приватные, адрес выдаётся подписанным и на время, а читать
-- объект может только тот, кому это разрешено политиками ниже. Клиент
-- подписывает ссылки через src/storageUrl.js.
--
-- Картинки заданий банка — не ПДн и нужны всем (в том числе в PDF), поэтому
-- вынесены в отдельный публичный бакет `task-assets`.
--
-- Роли: репетитор — `authenticated` (auth.uid()), ученик и родитель —
-- `app_user` с JWT из rls_step2_identity.sql (account_id / student_row_id).

begin;

-- ---------------------------------------------------------------------------
-- 1. Доступ ролей к самим таблицам storage
-- ---------------------------------------------------------------------------
grant usage on schema storage to app_user;
grant select on storage.buckets to app_user;
grant select, insert, update, delete on storage.objects to app_user;

-- ---------------------------------------------------------------------------
-- 2. Бакеты
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('task-assets', 'task-assets', true)
on conflict (id) do update set public = true;

-- Сами бакеты видны всем ролям: без этого storage-api не отдаёт даже
-- подписанную ссылку. Ничего чувствительного в строке бакета нет.
drop policy if exists "buckets readable" on storage.buckets;
create policy "buckets readable" on storage.buckets
  for select to anon, authenticated, app_user using (true);

-- ---------------------------------------------------------------------------
-- 3. Картинки заданий — публичный бакет, пишет только репетитор
-- ---------------------------------------------------------------------------
drop policy if exists "task assets read" on storage.objects;
create policy "task assets read" on storage.objects
  for select to anon, authenticated, app_user
  using (bucket_id = 'task-assets');

drop policy if exists "task assets write" on storage.objects;
create policy "task assets write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-assets');

drop policy if exists "task assets update" on storage.objects;
create policy "task assets update" on storage.objects
  for update to authenticated
  using (bucket_id = 'task-assets') with check (bucket_id = 'task-assets');

-- ---------------------------------------------------------------------------
-- 4. Репетитор
-- ---------------------------------------------------------------------------
-- Свои загрузки: путь начинается с его идентификатора (так кладут и файл
-- задания в `homework`, и PDF варианта в `variants`).
drop policy if exists "tutor own files" on storage.objects;
create policy "tutor own files" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('homework', 'variants')
    and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('homework', 'variants')
    and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  );

-- Работы, присланные учениками по его домашним заданиям: путь начинается с id
-- домашнего задания.
drop policy if exists "tutor homework files" on storage.objects;
create policy "tutor homework files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'homework'
    and exists (
      select 1 from public.homework h
      where h.tutor_id = auth.uid()
        and h.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

-- Аватары своих учеников.
drop policy if exists "tutor student avatars" on storage.objects;
create policy "tutor student avatars" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'homework'
    and (storage.foldername(storage.objects.name))[1] = 'student-avatars'
    and exists (
      select 1 from public.student_accounts sa
      join public.students s on s.phone = sa.phone
      where sa.id::text = (storage.foldername(storage.objects.name))[2]
        and s.tutor_id = auth.uid()
    )
  );

-- Фото части 2 по его вариантам: путь начинается с id сдачи.
drop policy if exists "tutor variant part2" on storage.objects;
create policy "tutor variant part2" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'variants'
    and exists (
      select 1 from public.variant_submissions vs
      join public.variants v on v.id = vs.variant_id
      where v.tutor_id = auth.uid()
        and vs.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

-- Картинки с доски своих учеников: board/<id ученика>/…
drop policy if exists "tutor board images" on storage.objects;
create policy "tutor board images" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'variants'
    and (storage.foldername(storage.objects.name))[1] = 'board'
    and exists (
      select 1 from public.students s
      where s.tutor_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[2]
    )
  )
  with check (
    bucket_id = 'variants'
    and (storage.foldername(storage.objects.name))[1] = 'board'
    and exists (
      select 1 from public.students s
      where s.tutor_id = auth.uid()
        and s.id::text = (storage.foldername(storage.objects.name))[2]
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Ученик
-- ---------------------------------------------------------------------------
-- Свой аватар: student-avatars/<account_id>/…
drop policy if exists "student own avatar" on storage.objects;
create policy "student own avatar" on storage.objects
  for all to app_user
  using (
    bucket_id = 'homework'
    and (storage.foldername(storage.objects.name))[1] = 'student-avatars'
    and (storage.foldername(storage.objects.name))[2] = public.current_account_id()::text
  )
  with check (
    bucket_id = 'homework'
    and (storage.foldername(storage.objects.name))[1] = 'student-avatars'
    and (storage.foldername(storage.objects.name))[2] = public.current_account_id()::text
  );

-- Свои сдачи: путь начинается с id его домашнего задания.
drop policy if exists "student homework files" on storage.objects;
create policy "student homework files" on storage.objects
  for all to app_user
  using (
    bucket_id = 'homework'
    and exists (
      select 1 from public.homework h
      where h.id::text = (storage.foldername(storage.objects.name))[1]
        and h.student_id in (select public.current_student_rows())
    )
  )
  with check (
    bucket_id = 'homework'
    and exists (
      select 1 from public.homework h
      where h.id::text = (storage.foldername(storage.objects.name))[1]
        and h.student_id in (select public.current_student_rows())
    )
  );

-- Файл, приложенный репетитором к его заданию. Путь начинается с id
-- репетитора, поэтому по одному пути такой файл от чужого не отличить —
-- связь берём из самой строки задания.
drop policy if exists "student assigned files" on storage.objects;
create policy "student assigned files" on storage.objects
  for select to app_user
  using (
    bucket_id = 'homework'
    and exists (
      select 1 from public.homework h
      where h.student_id in (select public.current_student_rows())
        and (h.file_url like '%/' || name or h.submission_url like '%/' || storage.objects.name)
    )
  );

-- PDF варианта, назначенного этому ученику.
drop policy if exists "student assigned variant" on storage.objects;
create policy "student assigned variant" on storage.objects
  for select to app_user
  using (
    bucket_id = 'variants'
    and exists (
      select 1 from public.variant_submissions vs
      join public.variants v on v.id = vs.variant_id
      where vs.student_id = public.current_account_id()
        and v.file_url like '%/' || name
    )
  );

-- Свои фото части 2: путь начинается с id его сдачи.
drop policy if exists "student part2 files" on storage.objects;
create policy "student part2 files" on storage.objects
  for all to app_user
  using (
    bucket_id = 'variants'
    and exists (
      select 1 from public.variant_submissions vs
      where vs.id::text = (storage.foldername(storage.objects.name))[1]
        and vs.student_id = public.current_account_id()
    )
  )
  with check (
    bucket_id = 'variants'
    and exists (
      select 1 from public.variant_submissions vs
      where vs.id::text = (storage.foldername(storage.objects.name))[1]
        and vs.student_id = public.current_account_id()
    )
  );

-- Картинки со своей доски: board/<id его карточки>/…
drop policy if exists "student board images" on storage.objects;
create policy "student board images" on storage.objects
  for all to app_user
  using (
    bucket_id = 'variants'
    and (storage.foldername(storage.objects.name))[1] = 'board'
    and exists (
      select 1 from public.current_student_rows() r
      where r::text = (storage.foldername(storage.objects.name))[2]
    )
  )
  with check (
    bucket_id = 'variants'
    and (storage.foldername(storage.objects.name))[1] = 'board'
    and exists (
      select 1 from public.current_student_rows() r
      where r::text = (storage.foldername(storage.objects.name))[2]
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Родитель (только чтение по карточке своего ребёнка)
-- ---------------------------------------------------------------------------
drop policy if exists "parent child files" on storage.objects;
create policy "parent child files" on storage.objects
  for select to app_user
  using (
    bucket_id = 'homework'
    and public.current_parent_student_id() is not null
    and exists (
      select 1 from public.homework h
      where h.student_id = public.current_parent_student_id()
        and (
          h.id::text = (storage.foldername(storage.objects.name))[1]
          or h.file_url like '%/' || name
          or h.submission_url like '%/' || name
        )
    )
  );

drop policy if exists "parent child avatar" on storage.objects;
create policy "parent child avatar" on storage.objects
  for select to app_user
  using (
    bucket_id = 'homework'
    and (storage.foldername(storage.objects.name))[1] = 'student-avatars'
    and public.current_parent_student_id() is not null
    and exists (
      select 1 from public.students s
      join public.student_accounts sa on sa.phone = s.phone
      where s.id = public.current_parent_student_id()
        and sa.id::text = (storage.foldername(storage.objects.name))[2]
    )
  );

commit;
