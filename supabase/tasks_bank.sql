-- Банк заданий: выполнить один раз в Supabase → SQL Editor.
-- Часть 1 экзамена: ОГЭ номера 1-19, ЕГЭ (профиль) номера 1-12 — совпадает
-- с существующей логикой автопроверки part1 в приложении.

create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  exam_type text not null check (exam_type in ('ОГЭ', 'ЕГЭ')),
  number smallint not null check (number > 0),
  condition_text text,
  image_url text,
  answer text not null,
  created_at timestamptz not null default now()
);

create index if not exists tasks_exam_number_idx on public.tasks (exam_type, number);

alter table public.tasks enable row level security;

-- Студенты логинятся через свою таблицу student_accounts, а не supabase.auth,
-- поэтому их сессии остаются anon — banch заданий (в т.ч. ответы) им недоступен.
-- Читать/писать банк могут только репетиторы (supabase.auth), как и остальные их данные.
create policy "tutors read tasks" on public.tasks
  for select using (auth.role() = 'authenticated');

create policy "tutors insert tasks" on public.tasks
  for insert with check (auth.role() = 'authenticated');

create policy "tutors update tasks" on public.tasks
  for update using (auth.role() = 'authenticated');

create policy "tutors delete tasks" on public.tasks
  for delete using (auth.role() = 'authenticated');

-- Снимок собранных из банка заданий на момент создания варианта — хранится
-- в самой строке variants, чтобы правки банка не меняли уже отправленные ученикам варианты.
alter table public.variants add column if not exists tasks_snapshot jsonb;
