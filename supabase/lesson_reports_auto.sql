-- Автоматический отчёт родителю.
--
-- Что меняется по сравнению с lesson_reports.sql: отчёт больше не заполняется
-- руками. Темы, уверенность по ним и цифры считаются из фактов (проведённые
-- занятия, домашние работы, попытки решения), модель пишет только связный
-- текст, а репетитор в норме вообще ничего не делает. Поэтому отчёт хранит не
-- один текст, а весь лист целиком: период, цифры и занятия — иначе печатный
-- PDF у родителя пришлось бы досчитывать заново и он разъезжался бы с тем, что
-- было на момент отправки.
--
-- Выполнить в Supabase → SQL Editor. Идемпотентно.

ALTER TABLE public.lesson_reports ADD COLUMN IF NOT EXISTS period_from date;
ALTER TABLE public.lesson_reports ADD COLUMN IF NOT EXISTS period_to   date;
ALTER TABLE public.lesson_reports ADD COLUMN IF NOT EXISTS stats       jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.lesson_reports ADD COLUMN IF NOT EXISTS lessons     jsonb NOT NULL DEFAULT '[]'::jsonb;
-- true = отчёт ушёл сам, по расписанию. Нужен, чтобы отличать его в журнале и
-- не отправлять два отчёта за один период (авто + вручную).
ALTER TABLE public.lesson_reports ADD COLUMN IF NOT EXISTS auto        boolean NOT NULL DEFAULT false;

-- Настройки автоотправки. Одна строка на репетитора; нет строки — считаем, что
-- автоотправка выключена (забытая миграция не должна начать сама писать
-- родителям).
CREATE TABLE IF NOT EXISTS public.tutor_report_settings (
  tutor_id   uuid PRIMARY KEY,
  enabled    boolean NOT NULL DEFAULT false,
  every_days smallint NOT NULL DEFAULT 14,   -- как часто отправлять: 7 / 14 / 30
  min_lessons smallint NOT NULL DEFAULT 2,   -- меньше занятий за период — отчёт не о чем
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_report_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_report_settings_owner ON public.tutor_report_settings;
CREATE POLICY tutor_report_settings_owner ON public.tutor_report_settings
  FOR ALL TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

-- Читающие функции отдают те же поля, что и раньше, плюс новые: печатный лист
-- у родителя и ученика собирается ровно из того, что сохранено при отправке.
-- Список колонок в RETURNS TABLE меняется, поэтому CREATE OR REPLACE поверх
-- прежней версии падает («cannot change return type») — сначала снимаем старую.
DROP FUNCTION IF EXISTS public.lesson_report_list(uuid, uuid, text);
CREATE FUNCTION public.lesson_report_list(p_account uuid, p_token uuid, p_student_id text)
RETURNS TABLE (id uuid, lesson_date date, topics jsonb, summary text, next_steps text,
               sent_at timestamptz, period_from date, period_to date, stats jsonb, lessons jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM student_accounts a WHERE a.id = p_account AND a.session_token = p_token
  ) THEN
    RETURN;  -- чужой или протухший токен: пустой результат, без подсказок
  END IF;

  RETURN QUERY
    SELECT r.id, r.lesson_date, r.topics, r.summary, r.next_steps, r.sent_at,
           r.period_from, r.period_to, r.stats, r.lessons
      FROM lesson_reports r
     WHERE r.student_id = p_student_id
       AND r.sent_at IS NOT NULL
     ORDER BY r.lesson_date DESC
     LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lesson_report_list(uuid, uuid, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.lesson_report_list_parent(text);
CREATE FUNCTION public.lesson_report_list_parent(p_parent_code text)
RETURNS TABLE (id uuid, lesson_date date, topics jsonb, summary text, next_steps text,
               period_from date, period_to date, stats jsonb, lessons jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student text;
BEGIN
  IF p_parent_code IS NULL OR length(trim(p_parent_code)) < 4 THEN
    RETURN;
  END IF;

  SELECT s.id::text INTO v_student
    FROM students s
   WHERE upper(s.parent_code) = upper(trim(p_parent_code))
   LIMIT 1;

  IF v_student IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT r.id, r.lesson_date, r.topics, r.summary, r.next_steps,
           r.period_from, r.period_to, r.stats, r.lessons
      FROM lesson_reports r
     WHERE r.student_id = v_student
       AND r.sent_at IS NOT NULL
     ORDER BY r.lesson_date DESC
     LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lesson_report_list_parent(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
