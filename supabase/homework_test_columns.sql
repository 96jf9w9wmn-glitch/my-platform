-- Недостающие колонки таблицы homework для функции «Тест / Комбинированное»
-- и генерации ДЗ. Код (src/pages/Homework.jsx) пишет эти поля при создании
-- задания, но в таблице их не завели вручную — из-за чего insert падает с
-- «Could not find the 'require_solution' column of 'homework' in the schema cache».
--
-- Выполнить один раз в Supabase → SQL Editor. Идемпотентно (IF NOT EXISTS).

ALTER TABLE homework ADD COLUMN IF NOT EXISTS hw_type          text    DEFAULT 'written';
ALTER TABLE homework ADD COLUMN IF NOT EXISTS question_count   integer;
ALTER TABLE homework ADD COLUMN IF NOT EXISTS correct_answers  text[];
ALTER TABLE homework ADD COLUMN IF NOT EXISTS require_solution boolean DEFAULT false;

-- Сбросить кэш схемы PostgREST, иначе колонки могут не подхватиться сразу.
NOTIFY pgrst, 'reload schema';
