-- Догон доски — только тем, чего у клиента нет.
--
-- Было: раз в 15 секунд доска сверяет у базы счётчик штрихов, и если своего не
-- хватает (посылка realtime не доехала, вкладка засыпала, связь моргнула) —
-- перечитывает СЦЕНУ ЦЕЛИКОМ. На боевой доске это 3,87 МБ, после включения
-- сжатия 805 КБ, и так при каждом обрыве. А обрывы штатные: realtime закрывает
-- соединение, если вкладка не прислала heartbeat за минуту, а вкладка в фоне
-- свои таймеры тормозит. Отсюда «зашёл на доску — секунд пять ничего не
-- работает» и провисания посреди занятия.
--
-- Стало: у каждого штриха есть ord (порядок рисования), он растёт и у
-- обновлённого штриха не меняется. Клиент помнит наибольший свой ord и просит
-- только то, что появилось после, — обычно это несколько килобайт.
--
-- Правка существующего штриха ord не двигает, поэтому догоном её не поймать —
-- но догон и запускается только когда штрихов НЕ ХВАТАЕТ, а правки приходят
-- по realtime. Если после догона счёт всё равно не сошёлся, клиент один раз
-- перечитывает сцену целиком, как раньше.

-- Сцена целиком: теперь отдаёт и наибольший ord — с него клиент начинает догон.
create or replace function public.board_scene(p_student_id text)
returns jsonb
language sql
security invoker
stable
set search_path = public
as $$
  select jsonb_build_object(
    'strokes', coalesce((select jsonb_agg(s.data order by s.ord)
                           from public.board_strokes s where s.room = p_student_id), '[]'::jsonb),
    'maxOrd',  coalesce((select max(s.ord) from public.board_strokes s where s.room = p_student_id), 0),
    'bg',      coalesce((select b.bg       from public.boards b where b.student_id = p_student_id), 'plain'),
    'bgColor',          (select b.bg_color from public.boards b where b.student_id = p_student_id)
  );
$$;

-- Только то, что нарисовано после ord. Права — те же политики board_strokes,
-- поэтому security invoker: чужую доску функция не откроет.
create or replace function public.board_strokes_after(p_student_id text, p_ord bigint)
returns jsonb
language sql
security invoker
stable
set search_path = public
as $$
  select jsonb_build_object(
    'strokes', coalesce((select jsonb_agg(s.data order by s.ord)
                           from public.board_strokes s
                          where s.room = p_student_id and s.ord > p_ord), '[]'::jsonb),
    'maxOrd',  coalesce((select max(s.ord) from public.board_strokes s where s.room = p_student_id), p_ord)
  );
$$;

grant execute on function public.board_scene(text) to app_user, authenticated;
grant execute on function public.board_strokes_after(text, bigint) to app_user, authenticated;

comment on function public.board_strokes_after is
  'Штрихи доски, нарисованные после указанного ord: догон без перечитывания всей сцены';

notify pgrst, 'reload schema';
