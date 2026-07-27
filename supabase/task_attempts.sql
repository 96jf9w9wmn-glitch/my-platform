-- Попытки решения заданий — фундамент для работы над ошибками (повтор типажа
-- свежими числами), аналитики слабых типажей и интервальных повторений.
-- Ключ здесь — gen_key: ключ типажа генератора, по которому задание можно
-- воспроизвести бесконечно (см. generateTask в src/pages/taskGenerators.js).
--
-- Выполнить в Supabase → SQL Editor ДО деплоя фронта. Идемпотентно.

CREATE TABLE IF NOT EXISTS public.task_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL,              -- student_accounts.id (владелец попытки)
  student_id   text,                       -- students.id у репетитора, если известен
  source       text NOT NULL,              -- 'homework' | 'variant' | 'practice'
  source_id    uuid,
  exam_type    text NOT NULL,
  number       smallint NOT NULL,
  gen_key      text,                       -- null = задание не из генератора (файл, ручной банк)
  is_correct   boolean NOT NULL,
  answer_given text,
  attempt_no   smallint NOT NULL DEFAULT 1,
  hints_used   smallint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_attempts_account_idx ON public.task_attempts (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_attempts_type_idx    ON public.task_attempts (account_id, exam_type, number, gen_key);

-- RLS с самого начала. Ученик/родитель не заведены в auth.users, поэтому пишут
-- и читают ТОЛЬКО через SECURITY DEFINER функции ниже с проверкой session_token —
-- старый паттерн «anon пишет в таблицу напрямую» здесь не повторяем.
ALTER TABLE public.task_attempts ENABLE ROW LEVEL SECURITY;

-- Репетитор читает попытки своих учеников (нужно для аналитики слабых типажей).
DROP POLICY IF EXISTS task_attempts_tutor_read ON public.task_attempts;
CREATE POLICY task_attempts_tutor_read ON public.task_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
       WHERE s.id::text = task_attempts.student_id
         AND s.tutor_id = auth.uid()
    )
  );

-- Запись попытки. Токен сессии обязателен: без него чужие попытки не подделать.
CREATE OR REPLACE FUNCTION public.task_attempt_log(
  p_account    uuid,
  p_token      uuid,
  p_student_id text,
  p_source     text,
  p_source_id  uuid,
  p_exam_type  text,
  p_number     smallint,
  p_gen_key    text,
  p_is_correct boolean,
  p_answer     text,
  p_attempt_no smallint DEFAULT 1,
  p_hints      smallint DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM student_accounts a
     WHERE a.id = p_account AND a.session_token = p_token
  ) THEN
    RETURN NULL;  -- чужой или протухший токен: молча ничего не пишем
  END IF;

  INSERT INTO task_attempts (account_id, student_id, source, source_id, exam_type,
                             number, gen_key, is_correct, answer_given, attempt_no, hints_used)
  VALUES (p_account, p_student_id, p_source, p_source_id, p_exam_type,
          p_number, p_gen_key, p_is_correct, p_answer, p_attempt_no, p_hints)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.task_attempt_log(uuid, uuid, text, text, uuid, text, smallint, text, boolean, text, smallint, smallint) TO anon, authenticated;

-- Свод по типажам: сколько попыток, сколько верных, когда встречался последний раз.
-- «Мало данных» (attempts < 3) решает интерфейс — здесь только факты.
CREATE OR REPLACE VIEW public.v_student_weak_types AS
SELECT account_id,
       student_id,
       exam_type,
       number,
       gen_key,
       count(*)                                              AS attempts,
       count(*) FILTER (WHERE is_correct)                    AS correct,
       round(100.0 * count(*) FILTER (WHERE is_correct) / count(*)) AS accuracy,
       max(created_at)                                       AS last_seen
  FROM public.task_attempts
 GROUP BY account_id, student_id, exam_type, number, gen_key;

-- КРИТИЧНО: вьюха поверх RLS-таблицы по умолчанию исполняется правами ВЛАДЕЛЬЦА
-- и обходит RLS — иначе любой с публичным anon-ключом прочитал бы сводку по всем
-- ученикам сразу. security_invoker переводит её на права вызывающего, и тогда
-- работает та же политика, что и на самой таблице.
ALTER VIEW public.v_student_weak_types SET (security_invoker = on);

-- Режим работы над ошибками у домашней работы.
ALTER TABLE homework ADD COLUMN IF NOT EXISTS retry_policy text DEFAULT 'none';  -- 'none' | 'until_correct' | 'n_tries'
ALTER TABLE homework ADD COLUMN IF NOT EXISTS retry_limit  smallint;

NOTIFY pgrst, 'reload schema';
