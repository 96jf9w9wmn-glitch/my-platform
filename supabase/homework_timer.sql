-- Таймер выполнения домашней работы с автосдачей по истечении времени.
-- Репетитор задаёт ограничение в минутах; отсчёт начинается в момент, когда
-- ученик ПЕРВЫЙ раз открыл работу, и не сбрасывается ни перезагрузкой страницы,
-- ни сменой устройства — потому что момент открытия фиксируется временем СЕРВЕРА
-- и записывается ровно один раз (coalesce внутри функции ниже).
--
-- Выполнить один раз в Supabase → SQL Editor. Идемпотентно.

ALTER TABLE homework ADD COLUMN IF NOT EXISTS time_limit_min  integer;      -- null = без ограничения
ALTER TABLE homework ADD COLUMN IF NOT EXISTS opened_at       timestamptz;  -- когда ученик открыл работу (время сервера)
ALTER TABLE homework ADD COLUMN IF NOT EXISTS auto_submitted  boolean DEFAULT false;

-- Момент открытия ставит сервер, а не клиент: иначе таймер обходится переводом
-- часов на устройстве. Проставляется только если ещё пуст — повторный вызов
-- (перезаход, второе устройство) возвращает исходное время, а не новое.
--
-- SECURITY DEFINER: у ученика нет своей роли в auth.users (см. CLAUDE.md),
-- операция идёт под anon-ключом. Функция умышленно узкая — умеет только
-- проставить отметку открытия у конкретной работы и вернуть её.
--
-- homework.id — uuid (проверено запросом к information_schema), поэтому и
-- аргумент uuid: с bigint функция создалась бы, но падала бы при вызове.
DROP FUNCTION IF EXISTS public.homework_open(bigint);
CREATE OR REPLACE FUNCTION public.homework_open(p_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t timestamptz;
BEGIN
  UPDATE homework
     SET opened_at = COALESCE(opened_at, now())
   WHERE id = p_id
  RETURNING opened_at INTO t;
  RETURN t;
END;
$$;

GRANT EXECUTE ON FUNCTION public.homework_open(uuid) TO anon, authenticated;

-- Сбросить кэш схемы PostgREST, иначе колонки и функция не подхватятся сразу.
NOTIFY pgrst, 'reload schema';
