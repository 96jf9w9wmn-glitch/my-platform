-- Приводим students.id (и связанный homework.student_id) к типу uuid.
--
-- Причина: весь код приложения использует uuid — клиент генерирует
-- crypto.randomUUID() (AddStudentModal / App.saveStudent), RPC используют
-- gen_random_uuid() (student_onboarding.sql / auth_hardening.sql). В этой базе
-- students.id создан как bigint (значения вида Date.now()), из-за чего
-- student_link_tutor и saveStudent падают:
--   column "id" is of type bigint but expression is of type uuid
--
-- Что НЕ трогаем:
--   * students.tutor_id — уже uuid (ссылается на реального репетитора);
--   * RLS-политики students (зависят от tutor_id, а не от id);
--   * variant_submissions.student_id — уже uuid (ссылается на student_accounts).
--
-- Связь homework.student_id (bigint) -> students.id (bigint) держится по
-- значению (без FK), поэтому обе колонки переводим в uuid СОГЛАСОВАННО через
-- временную карту старый_bigint -> новый_uuid, чтобы домашки остались привязаны
-- к своим ученикам.
--
-- Выполнить один раз в Supabase → SQL Editor. Всё в одной транзакции: при любой
-- ошибке откатывается целиком.

begin;

-- Карта соответствия: текущий bigint-id ученика -> будущий uuid
create temporary table _id_map on commit drop as
  select id as old_id, gen_random_uuid() as new_id
  from public.students;

-- 1) homework.student_id: bigint -> uuid по карте.
--    Домашки без совпадения (осиротевшие) получат NULL.
alter table public.homework alter column student_id drop default;
alter table public.homework
  alter column student_id set data type uuid
  using (select m.new_id from _id_map m where m.old_id = homework.student_id);

-- 2) students.id: bigint -> uuid (те же значения из карты)
alter table public.students alter column id drop identity if exists;
alter table public.students alter column id drop default;
alter table public.students
  alter column id set data type uuid
  using (select m.new_id from _id_map m where m.old_id = students.id);
alter table public.students alter column id set default gen_random_uuid();

commit;
