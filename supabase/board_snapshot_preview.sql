-- Превью занятия пересобирает и УЧЕНИК, а не только репетитор.
--
-- Карточка в ленте «Доски занятий» одна на двоих: она лежит в board_snapshots и
-- показывается обоим кабинетам. Пересобрать её может лишь тот, кто открыл доску
-- (превью рисуется из сцены в браузере), но писать в таблицу ученик не мог —
-- у него нет ни Supabase Auth, ни прямых прав. Поэтому кривая карточка висела у
-- него до тех пор, пока то же занятие не откроет репетитор.
--
-- Сцену функция НЕ принимает намеренно: у ученика она уже в памяти, и отправлять
-- её обратно значит гнать мегабайты ради тридцати килобайт картинки (ровно эту
-- цену сняли board_snapshot_server.sql и board_delta.sql). Здесь только превью.
--
-- Выполнить в Studio → SQL Editor. Идемпотентно. Без миграции клиент получает
-- PGRST202 и просто показывает исправленную карточку до перезагрузки страницы.

CREATE OR REPLACE FUNCTION public.board_snapshot_preview(
  p_account    uuid,
  p_token      uuid,
  p_student_id text,
  p_date       date,
  p_preview    text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Право то же, что у board_snapshot_save: аккаунт с живым токеном и его же
  -- карточка. Чужую историю этой функцией не тронуть.
  IF NOT board_snapshot_owner(p_account, p_token, p_student_id) THEN
    RETURN false;
  END IF;
  -- Пустое превью не пишем: неудачная отрисовка (испорченный холст) не должна
  -- стирать ту картинку, что уже есть.
  IF p_preview IS NULL OR length(p_preview) = 0 THEN
    RETURN false;
  END IF;

  UPDATE board_snapshots
     SET preview = p_preview, updated_at = now()
   WHERE student_id = p_student_id AND lesson_date = p_date;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.board_snapshot_preview(uuid, uuid, text, date, text) TO anon, authenticated, app_user;

COMMENT ON FUNCTION public.board_snapshot_preview IS
  'Ученик пересобирает превью занятия в истории досок (только картинка, сцена не трогается)';

NOTIFY pgrst, 'reload schema';
