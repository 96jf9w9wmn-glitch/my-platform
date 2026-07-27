-- Отчёт родителю после занятия: темы, уверенность по каждой, что дальше.
-- Составляется ИИ по заметкам репетитора (api/lesson-report.js), правится
-- репетитором и только потом отправляется — родителю ничего не уходит само.
--
-- Выполнить в Supabase → SQL Editor ДО деплоя фронта. Идемпотентно.

CREATE TABLE IF NOT EXISTS public.lesson_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id    uuid NOT NULL,
  student_id  text NOT NULL,
  lesson_date date NOT NULL DEFAULT current_date,
  topics      jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{title, confidence, comment}]
  summary     text,
  next_steps  text,
  source      jsonb,                                 -- что скормили модели (для разбора спорных отчётов)
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz                            -- null = черновик, родителю не показываем
);

CREATE INDEX IF NOT EXISTS lesson_reports_student_idx ON public.lesson_reports (student_id, lesson_date DESC);

ALTER TABLE public.lesson_reports ENABLE ROW LEVEL SECURITY;

-- Репетитор ведёт только свои отчёты.
DROP POLICY IF EXISTS lesson_reports_owner ON public.lesson_reports;
CREATE POLICY lesson_reports_owner ON public.lesson_reports
  FOR ALL TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

-- Родитель и ученик не заведены в auth.users, поэтому читают только через
-- функцию с проверкой сессии — и только ОТПРАВЛЕННЫЕ отчёты: черновик и
-- сырые данные для модели наружу не уходят.
CREATE OR REPLACE FUNCTION public.lesson_report_list(p_account uuid, p_token uuid, p_student_id text)
RETURNS TABLE (id uuid, lesson_date date, topics jsonb, summary text, next_steps text, sent_at timestamptz)
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
    SELECT r.id, r.lesson_date, r.topics, r.summary, r.next_steps, r.sent_at
      FROM lesson_reports r
     WHERE r.student_id = p_student_id
       AND r.sent_at IS NOT NULL
     ORDER BY r.lesson_date DESC
     LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lesson_report_list(uuid, uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
