-- Ручной зачёт задания репетитором.
--
-- Автопроверка сверяет ответ ученика с эталоном строкой (answersEqual), и обычно
-- этого хватает. Но эталон приходит из генератора банка, а генератор может
-- ошибиться: у задания оказывается два верных ответа, условие допускает другую
-- запись, чертёж расходится с ответом. Ученик прав, а работа показывает ошибку —
-- и она же уходит в оценку, в разбор и в аналитику слабых типажей.
--
-- Поэтому решение оставляем за репетитором: он смотрит задание и, если ошибка
-- подтвердилась, засчитывает номер. Зачёт хранится СПИСКОМ НОМЕРОВ, а не правкой
-- ответа ученика: ответ — свидетельство, его подменять нельзя, и по списку всегда
-- видно, что балл поставлен рукой, а не сверкой.
--
-- Выполнить в Studio → SQL Editor (db.precettore.ru). Идемпотентно.
-- Пока миграция не выполнена, кнопка «Засчитать» просто не появляется:
-- клиент проверяет наличие колонки в самой строке работы.

-- Номера заданий работы, засчитанные вручную: [3, 7]
ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS credited jsonb;

-- То же для части 1 варианта (часть 2 репетитор и так оценивает сам)
ALTER TABLE public.variant_submissions
  ADD COLUMN IF NOT EXISTS part1_credited jsonb;

-- Колонки табличные, гранты в rls_step3_policies.sql выданы на всю таблицу
-- (grant select, update on public.homework to app_user), поэтому отдельного
-- гранта новым колонкам не нужно.

-- ── Журнал попыток ──────────────────────────────────────────────────────────
-- Зачтённое задание должно перестать быть ошибкой и в аналитике: на долю верных
-- ПЕРВЫХ ответов в task_attempts держатся «Слабые типажи» и отчёт родителю.
-- Иначе типаж, который ученик решил правильно, навсегда останется у него слабым.
--
-- Репетитору дана не UPDATE-политика, а функция: правит она ровно одно поле
-- (is_correct) и только у попыток СВОИХ учеников, а промахнуться таблицей или
-- переписать ответ ученика через неё нельзя.
CREATE OR REPLACE FUNCTION public.task_attempt_credit(
  p_source    text,
  p_source_id uuid,
  p_number    smallint,
  p_answer    text,
  p_correct   boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE task_attempts a
     SET is_correct = p_correct
   WHERE a.source = p_source
     AND a.source_id = p_source_id
     AND a.number = p_number
     -- ответ ученика различает два задания одного номера в одной работе;
     -- null — «не различаем», тогда правится весь номер
     AND (p_answer IS NULL OR a.answer_given IS NOT DISTINCT FROM p_answer)
     AND EXISTS (
       SELECT 1 FROM students s
        WHERE s.id::text = a.student_id
          AND s.tutor_id = auth.uid()
     );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.task_attempt_credit(text, uuid, smallint, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.task_attempt_credit(text, uuid, smallint, text, boolean) TO authenticated;
