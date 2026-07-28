-- История досок по каждому ученику: снимок сцены за день занятия + PNG-превью.
-- Живая доска (одна на ученика) остаётся в public.boards — здесь ЛЕТОПИСЬ: при
-- закрытии доски её сцена откладывается отдельной записью на дату занятия, чтобы
-- к разобранному на прошлом уроке можно было вернуться в режиме чтения.
--
-- Одна запись на ученика в день (primary key student_id + lesson_date): доска за
-- урок закрывается и открывается по многу раз, и каждый раз плодить строку значит
-- превратить список занятий в мусор. Повторное закрытие обновляет запись дня.
--
-- Выполнить в Supabase → SQL Editor ДО деплоя фронта. Идемпотентно.

CREATE TABLE IF NOT EXISTS public.board_snapshots (
  student_id  text NOT NULL,          -- students.id у репетитора (= roomId доски)
  lesson_date date NOT NULL,          -- дата занятия (локальная дата клиента)
  scene       jsonb NOT NULL,         -- та же форма, что и boards.scene
  preview     text,                   -- data:image/jpeg;base64 — маленькое превью (может быть null)
  strokes     integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text,                   -- 't:<tutor_id>' | 's:<account_id>'
  PRIMARY KEY (student_id, lesson_date)
);

CREATE INDEX IF NOT EXISTS board_snapshots_student_idx
  ON public.board_snapshots (student_id, lesson_date DESC);

-- RLS с самого начала (см. CLAUDE.md: на новых таблицах не повторяем схему
-- «anon пишет напрямую»). Репетитор ходит своим Supabase Auth, ученик — только
-- через SECURITY DEFINER функции ниже с проверкой session_token.
ALTER TABLE public.board_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS board_snapshots_tutor_read ON public.board_snapshots;
CREATE POLICY board_snapshots_tutor_read ON public.board_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s
                  WHERE s.id::text = board_snapshots.student_id
                    AND s.tutor_id = auth.uid()));

DROP POLICY IF EXISTS board_snapshots_tutor_write ON public.board_snapshots;
CREATE POLICY board_snapshots_tutor_write ON public.board_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s
                       WHERE s.id::text = board_snapshots.student_id
                         AND s.tutor_id = auth.uid()));

DROP POLICY IF EXISTS board_snapshots_tutor_update ON public.board_snapshots;
CREATE POLICY board_snapshots_tutor_update ON public.board_snapshots
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s
                  WHERE s.id::text = board_snapshots.student_id
                    AND s.tutor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s
                       WHERE s.id::text = board_snapshots.student_id
                         AND s.tutor_id = auth.uid()));

DROP POLICY IF EXISTS board_snapshots_tutor_delete ON public.board_snapshots;
CREATE POLICY board_snapshots_tutor_delete ON public.board_snapshots
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s
                  WHERE s.id::text = board_snapshots.student_id
                    AND s.tutor_id = auth.uid()));

-- Аккаунт ученика связан со строкой students по телефону — ровно так же, как это
-- делает App.jsx (studentAccountId). Отдельного внешнего ключа в базе нет, поэтому
-- проверяем этой же связкой: иначе по чужому student_id можно было бы затереть
-- чужую историю.
CREATE OR REPLACE FUNCTION public.board_snapshot_owner(p_account uuid, p_token uuid, p_student_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM student_accounts a
      JOIN students s ON s.phone = a.phone
     WHERE a.id = p_account
       AND a.session_token = p_token
       AND s.id::text = p_student_id
  );
$$;

-- Сохранение снимка учеником (репетитор пишет напрямую — ему хватает политик выше).
CREATE OR REPLACE FUNCTION public.board_snapshot_save(
  p_account    uuid,
  p_token      uuid,
  p_student_id text,
  p_date       date,
  p_scene      jsonb,
  p_preview    text,
  p_strokes    integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT board_snapshot_owner(p_account, p_token, p_student_id) THEN
    RETURN false;  -- чужой ученик или протухший токен: молча ничего не пишем
  END IF;

  INSERT INTO board_snapshots (student_id, lesson_date, scene, preview, strokes, updated_by)
  VALUES (p_student_id, p_date, p_scene, p_preview, p_strokes, 's:' || p_account::text)
  ON CONFLICT (student_id, lesson_date) DO UPDATE
     SET scene = EXCLUDED.scene,
         preview = EXCLUDED.preview,
         strokes = EXCLUDED.strokes,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by;
  RETURN true;
END;
$$;

-- Список занятий (без сцен — они тяжёлые; сцена отдаётся отдельно по дате).
CREATE OR REPLACE FUNCTION public.board_snapshot_list(p_account uuid, p_token uuid, p_student_id text)
RETURNS TABLE (lesson_date date, preview text, strokes integer, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT board_snapshot_owner(p_account, p_token, p_student_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT b.lesson_date, b.preview, b.strokes, b.updated_at
      FROM board_snapshots b
     WHERE b.student_id = p_student_id
     ORDER BY b.lesson_date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.board_snapshot_get(p_account uuid, p_token uuid, p_student_id text, p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scene jsonb;
BEGIN
  IF NOT board_snapshot_owner(p_account, p_token, p_student_id) THEN
    RETURN NULL;
  END IF;
  SELECT b.scene INTO v_scene
    FROM board_snapshots b
   WHERE b.student_id = p_student_id AND b.lesson_date = p_date;
  RETURN v_scene;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.board_snapshot_owner(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.board_snapshot_save(uuid, uuid, text, date, jsonb, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.board_snapshot_list(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.board_snapshot_get(uuid, uuid, text, date) TO anon, authenticated;

COMMENT ON TABLE public.board_snapshots IS 'История досок по ученику: сцена и превью за дату занятия. Живая доска — в public.boards.';

NOTIFY pgrst, 'reload schema';
