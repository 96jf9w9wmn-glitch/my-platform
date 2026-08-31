-- Способ оплаты ученика: поштучно или абонементом (оплата вперёд за период).
--
-- Абонемент НЕ заводит отдельной денежной сущности: оплаты как были, так и
-- остаются обычными записями в students.payments, а долг считается одной
-- формулой «начислено − оплачено» (src/billing.js). Эти три колонки меняют
-- только МОМЕНТ начисления: у абонементного ученика долг за весь период
-- появляется, как только период начался.
--
-- Миграция аддитивная и идемпотентная: существующие карточки получают
-- 'lesson', то есть ровно то поведение, которое было до неё.

alter table public.students
  add column if not exists payment_mode   text not null default 'lesson',
  add column if not exists package_period text,
  add column if not exists package_start  date;

-- Значения ограничены явно: опечатка в способе оплаты молча превратила бы
-- абонемент в поштучную оплату, и разошёлся бы долг.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_payment_mode_check'
  ) then
    alter table public.students
      add constraint students_payment_mode_check
      check (payment_mode in ('lesson', 'package'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'students_package_period_check'
  ) then
    alter table public.students
      add constraint students_package_period_check
      check (package_period is null or package_period in ('week', 'weeks2', 'month'));
  end if;
end $$;
