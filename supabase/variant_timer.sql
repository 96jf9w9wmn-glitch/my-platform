-- Таймер решения варианта с автосдачей по истечении времени.
-- Ученик решает вариант столько же, сколько длится настоящий экзамен
-- (таблица продолжительностей — src/pages/examTiming.js), отсчёт начинается
-- по кнопке «Начать» и НЕ сбрасывается ни перезагрузкой страницы, ни входом
-- с другого устройства: момент старта ставит сервер и ровно один раз.
--
-- Выполнить один раз в Studio → SQL Editor. Идемпотентно.

ALTER TABLE public.variant_submissions
  ADD COLUMN IF NOT EXISTS opened_at      timestamptz,   -- когда ученик начал (время сервера)
  ADD COLUMN IF NOT EXISTS time_limit_min integer,       -- сколько минут дано на этот вариант
  ADD COLUMN IF NOT EXISTS auto_submitted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.variant_submissions.opened_at IS
  'Момент старта решения (время сервера). Ставится один раз функцией variant_open.';
COMMENT ON COLUMN public.variant_submissions.time_limit_min IS
  'Время на вариант в минутах — фиксируется при старте, чтобы отсчёт не поехал при правке таблицы продолжительностей.';
COMMENT ON COLUMN public.variant_submissions.auto_submitted IS
  'Работа ушла на проверку автоматически: время вышло.';

-- Старт отсчёта. Время ставит СЕРВЕР: иначе таймер обходится переводом часов
-- на устройстве. COALESCE — чтобы повторный вызов (перезаход, второе
-- устройство, второй таб) возвращал исходный момент, а не начинал заново.
--
-- SECURITY DEFINER, но с проверкой владельца: ученик ходит под ролью app_user
-- со своим JWT (rls_step4_tokens.sql), account_id лежит в claims, и стартовать
-- чужую работу через эту функцию нельзя. Условие status = 'pending' не даёт
-- переоткрыть уже сданный вариант.
DROP FUNCTION IF EXISTS public.variant_open(uuid, integer);
CREATE OR REPLACE FUNCTION public.variant_open(p_id uuid, p_minutes integer)
RETURNS TABLE (started_at timestamptz, limit_min integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE variant_submissions s
     SET opened_at      = COALESCE(s.opened_at, now()),
         time_limit_min = COALESCE(s.time_limit_min, p_minutes)
   WHERE s.id = p_id
     AND s.student_id = public.current_account_id()
     AND s.status = 'pending'
  RETURNING s.opened_at, s.time_limit_min;
$$;

GRANT EXECUTE ON FUNCTION public.variant_open(uuid, integer) TO app_user, anon, authenticated;

-- Сбросить кэш схемы PostgREST, иначе колонки и функция не подхватятся сразу.
NOTIFY pgrst, 'reload schema';
