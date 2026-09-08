-- Снимок доски занятия собирает САМА БАЗА, а не клиент.
--
-- Было: при закрытии доски кабинет отправлял в board_snapshots всю сцену
-- целиком. На боевой это 1,7 МБ в каждое закрытие (замер журнала запросов:
-- три закрытия за 25 минут занятия — 5 МБ отправки). Отправка идёт по тому же
-- соединению, что и весь остальной кабинет, поэтому на тонком канале сайт
-- замирал на минуту ровно в тот момент, когда репетитор закончил урок и
-- переходит к следующему делу. В логе Caddy такие отправки видны как запросы
-- длиной 60–150 секунд, оборвавшиеся 502.
--
-- Стало: штрихи и так лежат в board_strokes (миграция board_strokes.sql) —
-- база собирает сцену у себя, клиент шлёт только превью (около 30 КБ).
--
-- Старая board_snapshot_save НЕ удаляется: вкладка со старой сборкой должна
-- продолжать сохранять историю. Это тот же приём, что и с board_patch.

CREATE OR REPLACE FUNCTION public.board_snapshot_take(
  p_student_id text,
  p_date       date,
  p_preview    text,
  p_account    uuid default null,   -- ученик: аккаунт и токен, как в board_snapshot_save
  p_token      uuid default null
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scene jsonb;
  v_n     integer;
  v_by    text;
BEGIN
  -- Право на доску. У ученика оно проверяется токеном (та же функция, что у
  -- board_snapshot_save), у репетитора — по карточке ученика. Адрес доски
  -- бывает составным ("<карточка>:hw:<работа>"), поэтому сравниваем ПЕРВУЮ
  -- часть: составной адрес чужой доски открывать не должен.
  IF p_account IS NOT NULL THEN
    IF NOT board_snapshot_owner(p_account, p_token, p_student_id) THEN
      RETURN false;
    END IF;
    v_by := 's:' || p_account::text;
  ELSE
    IF auth.uid() IS NULL
       OR NOT EXISTS (SELECT 1 FROM students s
                       WHERE s.id::text = split_part(p_student_id, ':', 1)
                         AND s.tutor_id = auth.uid()) THEN
      RETURN false;
    END IF;
    v_by := 't:' || auth.uid()::text;
  END IF;

  SELECT jsonb_build_object(
           'strokes', coalesce(jsonb_agg(s.data ORDER BY s.ord), '[]'::jsonb),
           'bg',      coalesce((SELECT b.bg       FROM boards b WHERE b.student_id = p_student_id), 'plain'),
           'bgColor',          (SELECT b.bg_color FROM boards b WHERE b.student_id = p_student_id)
         ),
         count(*)
    INTO v_scene, v_n
    FROM board_strokes s
   WHERE s.room = p_student_id;

  -- Пустая доска в историю занятий не попадает — то же правило, что было на
  -- клиенте. Иначе закрытие только что открытой доски стёрло бы вчерашний
  -- снимок за ту же дату пустой сценой.
  IF coalesce(v_n, 0) = 0 THEN
    RETURN false;
  END IF;

  INSERT INTO board_snapshots (student_id, lesson_date, scene, preview, strokes, updated_by)
  VALUES (p_student_id, p_date, v_scene, p_preview, v_n, v_by)
  ON CONFLICT (student_id, lesson_date) DO UPDATE
     SET scene = EXCLUDED.scene,
         preview = EXCLUDED.preview,
         strokes = EXCLUDED.strokes,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.board_snapshot_take(text, date, text, uuid, uuid) TO anon, authenticated, app_user;

COMMENT ON FUNCTION public.board_snapshot_take IS
  'Снимок доски занятия: сцену база собирает из board_strokes сама, клиент шлёт только превью';

NOTIFY pgrst, 'reload schema';
