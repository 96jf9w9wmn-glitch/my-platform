-- Методички репетитора и порядок заданий в «Карте заданий».
--
-- Методичка — это шпаргалка к НОМЕРУ задания, которую репетитор пишет сам: как
-- он объясняет этот номер, на что ловятся ученики, какие формулы держать под
-- рукой. Привязка к номеру, а не к типажу, — намеренно: типажей у номера бывает
-- под сотню, и материал к каждому из них никто не напишет, а номер — это ровно
-- тот кусок, которым мыслит и репетитор, и сам экзамен.
--
-- Порядок заданий в карте у каждого репетитора свой: один разбирает номера по
-- возрастанию, другой — от самых провальных, третий — в порядке своей
-- программы. Поэтому он хранится у репетитора, а не считается платформой.

create extension if not exists pgcrypto;

create table if not exists public.task_notes (
  id         uuid primary key default gen_random_uuid(),
  tutor_id   uuid not null references auth.users(id) on delete cascade,
  exam_type  text not null,
  number     integer not null,
  title      text not null default '',
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Одна методичка на номер: вторая означала бы, что репетитору надо выбирать,
  -- какую открыть, а он открывает «свою по этому номеру».
  unique (tutor_id, exam_type, number)
);

create index if not exists task_notes_tutor_idx on public.task_notes (tutor_id, exam_type);

alter table public.task_notes enable row level security;

-- Свежей таблице Supabase сам выдаёт полный грант роли anon (проверено на
-- боевой при student_groups). Снимаем сразу.
revoke all on public.task_notes from anon;
grant select, insert, update, delete on public.task_notes to authenticated;

drop policy if exists task_notes_own on public.task_notes;
create policy task_notes_own on public.task_notes for all to authenticated
  using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

-- Порядок номеров в карте: { "ЕГЭ Профиль": [11, 7, 1, ...] }. Отдельной
-- таблицей это была бы строка на номер ради списка чисел.
alter table public.tutors
  add column if not exists task_order jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
