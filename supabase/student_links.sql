-- Ссылки на доску и звонок у ученика: выполнить один раз в Supabase → SQL Editor.
-- Без этих колонок App.jsx.saveStudent молча теряет boardUrl/callUrl при сохранении
-- (upsert просто не отправлял их — колонок не было вовсе).

alter table public.students
  add column if not exists board_url text,
  add column if not exists call_url text;
