-- Порядковый номер штриха обязан только РАСТИ.
--
-- Было: `ord = max(ord) + номер в посылке`. Пока доску только дополняют, это
-- верно, но ластик удаляет строки — и max(ord) по оставшимся ПАДАЕТ. Тогда
-- следующий штрих получает номер, который собеседник уже прошёл, и дешёвый
-- догон `board_strokes_after(ord)` его НЕ ВИДИТ: база отвечает «нового нет»,
-- хотя новое есть. Клиент в этом случае перечитывает сцену ЦЕЛИКОМ.
--
-- Замер на боевой доске домашней работы 11.09.2026 (1273 штриха, 1,66 МБ
-- сцены): пока ученик писал и стирал, репетитор скачал полную сцену трижды за
-- 33 секунды — по 330 КБ сжатыми, с разбором мегабайтного JSON в каждом. Это и
-- есть «доска то работает, то нет».
--
-- Стало: номер выдаёт последовательность. Она общая на все доски — порядок
-- важен только ВНУТРИ комнаты, а глобальный счётчик никогда не пойдёт назад,
-- сколько бы ни стёрли.
create sequence if not exists public.board_stroke_ord as bigint;

-- Стартуем заведомо выше всех уже выданных номеров (в том числе в досках, где
-- сейчас никто не пишет), с запасом.
select setval('public.board_stroke_ord',
              coalesce((select max(ord) from public.board_strokes), 0) + 1000);

-- board_patch работает от имени вызывающего (security invoker), поэтому право
-- на последовательность нужно обеим ролям.
grant usage on sequence public.board_stroke_ord to app_user, authenticated;

create or replace function public.board_patch(
  p_student_id text,
  p_up         jsonb   default '[]'::jsonb,  -- добавленные и изменённые штрихи
  p_del        jsonb   default '[]'::jsonb,  -- id удалённых
  p_bg         text    default null,
  p_bg_color   text    default null,
  p_by         text    default null,
  p_wipe       boolean default false         -- очистка доски: старого не оставляем
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Строка доски: фон, отметка о правке и проверка прав (RLS сработает здесь же).
  -- scene НЕ трогаем: в ней зеркало сцены целиком, то есть мегабайты в TOAST.
  insert into boards as b (student_id, scene, bg, bg_color, updated_by, updated_at)
  values (p_student_id,
          jsonb_build_object('strokes', '[]'::jsonb, 'bg', coalesce(p_bg, 'plain'), 'bgColor', p_bg_color),
          coalesce(p_bg, 'plain'), p_bg_color, p_by, now())
  on conflict (student_id) do update set
    bg         = coalesce(p_bg,       b.bg),
    bg_color   = coalesce(p_bg_color, b.bg_color),
    updated_by = p_by,
    updated_at = now();

  if p_wipe then
    delete from board_strokes where room = p_student_id;
  elsif jsonb_array_length(p_del) > 0 then
    delete from board_strokes
     where room = p_student_id
       and id in (select jsonb_array_elements_text(p_del));
  end if;

  if jsonb_array_length(p_up) > 0 then
    insert into board_strokes (room, id, ord, data)
    select p_student_id, e.value->>'id', nextval('public.board_stroke_ord'), e.value
      from jsonb_array_elements(p_up) with ordinality e(value, ord)
     where e.value->>'id' is not null
    -- Правка существующего штриха НЕ двигает его ord: порядок массива — это
    -- порядок рисования, и передвинутый штрих не должен всплывать поверх соседей.
    on conflict (room, id) do update set data = excluded.data;
  end if;
end
$$;

grant execute on function public.board_patch(text, jsonb, jsonb, text, text, text, boolean)
  to app_user, authenticated;

comment on sequence public.board_stroke_ord is 'Номер штриха доски: только растёт, иначе догон board_strokes_after пропускает новые штрихи после стирания';
