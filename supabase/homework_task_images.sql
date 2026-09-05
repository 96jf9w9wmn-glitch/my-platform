-- Картинки заданий, нарезанных из файла репетитора.
--
-- Репетитор загружает свой файл (PDF-раздатку, фотографию страницы), кабинет
-- режет его на отдельные задания и кладёт каждое картинкой в приватный бакет
-- `homework`, а ссылки — в `homework.bank_tasks[].image_url`. Условие такого
-- задания живёт ТОЛЬКО картинкой: не увидит её ученик — работа для него пустая.
--
-- Существующие политики этого не разрешают: ученик читает в бакете `homework`
-- лишь то, что лежит под id его домашней работы, либо ровно тот файл, что
-- записан в `file_url`/`submission_url`. Картинки заданий не подходят ни туда,
-- ни туда — они лежат в каталоге репетитора (`<auth.uid>/hw-tasks/…`, так их
-- разрешает загружать политика «tutor own files»).
--
-- Поэтому доступ даётся не по пути, а по самой работе: объект читается, если
-- он упомянут в bank_tasks домашнего задания этого ученика. Путь тут ничего не
-- доказывает — упоминание в строке работы доказывает.
--
-- Без этой миграции нарезка у репетитора работает, но ученик и родитель
-- увидят задание без условия. Выполнять вместе с выкаткой фронтенда.

begin;

-- Ученик: картинки заданий его домашних работ.
drop policy if exists "student task images" on storage.objects;
create policy "student task images" on storage.objects
  for select to app_user
  using (
    bucket_id = 'homework'
    and exists (
      select 1
      from public.homework h
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(h.bank_tasks) = 'array' then h.bank_tasks else '[]'::jsonb end
      ) as t
      where h.student_id in (select public.current_student_rows())
        and t->>'image_url' like '%' || storage.objects.name
    )
  );

-- Родитель: то же по карточке своего ребёнка (он открывает работы на чтение).
drop policy if exists "parent task images" on storage.objects;
create policy "parent task images" on storage.objects
  for select to app_user
  using (
    bucket_id = 'homework'
    and public.current_parent_student_id() is not null
    and exists (
      select 1
      from public.homework h
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(h.bank_tasks) = 'array' then h.bank_tasks else '[]'::jsonb end
      ) as t
      where h.student_id = public.current_parent_student_id()
        and t->>'image_url' like '%' || storage.objects.name
    )
  );

commit;
