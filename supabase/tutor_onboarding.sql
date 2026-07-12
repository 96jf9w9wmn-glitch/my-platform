-- Анкета репетитора после регистрации: выполнить один раз в Supabase → SQL Editor.

alter table public.tutors
  add column if not exists subject text,
  add column if not exists experience text,
  add column if not exists student_count_range text,
  add column if not exists teaching_format text,
  add column if not exists exam_focus text[],
  add column if not exists onboarding_completed boolean not null default false;
