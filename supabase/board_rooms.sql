-- Отдельная доска у каждой домашней работы.
--
-- Было: доска одна на ученика. Задание, открытое кнопкой «Решить на доске»,
-- ложилось листом на ту же доску, что и разбор занятия, — к концу недели там
-- вперемешку лежали урок, задания понедельника и задания среды.
--
-- Стало: адрес доски (boards.student_id, он же комната realtime) бывает двух
-- пород — "<id карточки>" (доска занятия, как раньше) и "<id карточки>:hw:<id>"
-- (доска конкретной домашней работы). Колонка text, поэтому таблицу менять не
-- нужно; поправить надо ровно политики — они сравнивали адрес с карточкой
-- ЦЕЛИКОМ, и составной адрес не проходил ни у ученика, ни у репетитора.
--
-- Ключевое: доступ решает ПЕРВАЯ часть адреса — карточка ученика. Что стоит
-- после двоеточия, на права не влияет вовсе, поэтому чужой доски составной
-- адрес не открывает.
--
-- Картинки доски по-прежнему лежат в папке ученика (board/<id карточки>/…):
-- политики storage разбирают путь по папкам, и трогать их не требуется.

drop policy if exists boards_tutor on public.boards;
create policy boards_tutor on public.boards for all to authenticated
  using (exists (select 1 from public.students s
                  where s.id::text = split_part(boards.student_id, ':', 1)
                    and s.tutor_id = auth.uid()))
  with check (exists (select 1 from public.students s
                       where s.id::text = split_part(boards.student_id, ':', 1)
                         and s.tutor_id = auth.uid()));

drop policy if exists boards_own on public.boards;
create policy boards_own on public.boards for all to app_user
  using (split_part(student_id, ':', 1) in (select public.current_student_rows()::text)
         or split_part(student_id, ':', 1) = public.current_parent_student_id()::text)
  with check (split_part(student_id, ':', 1) in (select public.current_student_rows()::text));

comment on table public.boards is
  'Снапшот сцены доски. Адрес: "<id карточки>" — доска занятия, "<id карточки>:hw:<id работы>" — доска домашней работы (см. src/boardRoom.js).';
