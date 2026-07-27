-- Чтение отчётов РОДИТЕЛЕМ. Отдельной функцией, потому что у родителя, в
-- отличие от ученика, нет session_token: он входит по коду ученика
-- (students.parent_code), и его сессия — просто копия строки ученика.
--
-- Осознанное ограничение: код родителя работает как постоянный пароль без
-- второго фактора. Это не хуже того, что уже есть (по этому же коду родитель
-- видит весь кабинет), но и не лучше — нормальная сессия родителю появится
-- вместе с общей работой по RLS (см. supabase/rls_migration_plan.md).
--
-- Выполнить в Supabase → SQL Editor. Идемпотентно.

CREATE OR REPLACE FUNCTION public.lesson_report_list_parent(p_parent_code text)
RETURNS TABLE (id uuid, lesson_date date, topics jsonb, summary text, next_steps text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student text;
BEGIN
  IF p_parent_code IS NULL OR length(trim(p_parent_code)) < 4 THEN
    RETURN;  -- слишком короткий код не перебираем даже теоретически
  END IF;

  SELECT s.id::text INTO v_student
    FROM students s
   WHERE upper(s.parent_code) = upper(trim(p_parent_code))
   LIMIT 1;

  IF v_student IS NULL THEN
    RETURN;  -- код не найден: пустой ответ, без намёка на то, что кода нет
  END IF;

  RETURN QUERY
    SELECT r.id, r.lesson_date, r.topics, r.summary, r.next_steps
      FROM lesson_reports r
     WHERE r.student_id = v_student
       AND r.sent_at IS NOT NULL   -- черновики родителю не показываем
     ORDER BY r.lesson_date DESC
     LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lesson_report_list_parent(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
