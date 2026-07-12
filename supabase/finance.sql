-- Учёт расходов и налогового режима тьютора.
--
-- В ОТЛИЧИЕ от таблиц учеников (students/homework/…), тьютор ЗАВЕДЁН в auth.users
-- (логинится через Supabase Auth), поэтому обычная RLS по auth.uid() здесь работает
-- корректно и включена сразу. Каждый тьютор видит и меняет только свои строки.
--
-- Запустить в Supabase → SQL Editor. Идемпотентно (можно выполнять повторно).

-- Настройки налога: режим + ставка (для НПД можно 4% с физлиц или 6%).
create table if not exists public.tutor_finance_settings (
  tutor_id   uuid primary key references auth.users(id) on delete cascade,
  tax_mode   text not null default 'none' check (tax_mode in ('none', 'npd', 'usn6')),
  tax_rate   numeric not null default 4 check (tax_rate >= 0 and tax_rate <= 100),
  updated_at timestamptz not null default now()
);

-- Ежемесячные постоянные расходы (онлайн-доска, подписка на платформу и т.п.).
create table if not exists public.tutor_expenses (
  id         uuid primary key default gen_random_uuid(),
  tutor_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  amount     numeric not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists tutor_expenses_tutor_idx on public.tutor_expenses(tutor_id);

alter table public.tutor_finance_settings enable row level security;
alter table public.tutor_expenses enable row level security;

-- Одна политика на все операции: строка принадлежит текущему тьютору.
drop policy if exists tutor_finance_settings_own on public.tutor_finance_settings;
create policy tutor_finance_settings_own on public.tutor_finance_settings
  for all
  using (auth.uid() = tutor_id)
  with check (auth.uid() = tutor_id);

drop policy if exists tutor_expenses_own on public.tutor_expenses;
create policy tutor_expenses_own on public.tutor_expenses
  for all
  using (auth.uid() = tutor_id)
  with check (auth.uid() = tutor_id);
