-- Правка штриха НА МЕСТЕ доезжает до собеседника, даже если посылка потерялась.
--
-- Разбор 12.09.2026, доска 1783096584987. Репетитор и ученик строили на одном
-- чертеже один и тот же треугольник производной — и построения разъехались на
-- 35,6 единиц доски (0,68 клетки чертежа). В базе штрихи действительно лежат в
-- разных местах: значит, КАРТИНКА у двоих стояла по-разному, и каждый рисовал
-- верно по тому, что видел. У того же ученика на предыдущем и следующем
-- чертеже построения ложатся точно — то есть дело не в устройстве, а в
-- коротком расхождении сцен.
--
-- Почему расхождение не чинилось само. Правка УЖЕ существующего штриха
-- (перенос, поворот, цвет, ответ на листе — в том числе сдвиг только что
-- вставленного снимка: после вставки инструмент сам становится курсором, а
-- картинка выделена) уходит собеседнику ОДНОЙ посылкой realtime. Если она не
-- доехала, догнать её было нечем:
--   * board_strokes_after отдаёт только то, что новее известного ord, а у
--     передвинутого штриха ord НАМЕРЕННО не меняется (порядок рисования);
--   * сверка раз в пять секунд смотрит на boards_state, а это count(*) и
--     последний id — перенос не меняет ни того, ни другого.
-- То есть штрих оставался в старом месте до перезахода на доску, молча. Что
-- посылки в те минуты терялись, видно в журнале Caddy: клиент репетитора
-- каждые несколько секунд дёргал board_strokes_after, а в 11:27:14 перечитал
-- всю сцену целиком (856 КБ) — это делается только когда счёт не сошёлся.
--
-- Лечение: у каждой строки появляется rev — номер ЗАПИСИ (не рисования). Он
-- растёт при ЛЮБОМ сохранении строки, в том числе при правке на месте, и
-- поэтому ord заменить не может: ord — это кто поверх кого, и он обязан
-- оставаться прежним. Сверка сравнивает наибольший rev в комнате с тем, до
-- которого клиент всё видел, а догон (board_strokes_since) отдаёт строки,
-- изменившиеся после него, — то есть и новые штрихи, и правки на месте. Обычная
-- правка стоит теперь одного крошечного ответа вместо перечитывания сцены.
--
-- ГЛАВНОЕ ПРИ ПРАВКАХ: клиент двигает свою отметку только по ответу базы,
-- пришедшему ОДНИМ снимком (догон, сцена целиком), либо по своему сохранению —
-- и только если база подтвердила, что до него ничего чужого не появилось
-- (board_patch отдаёт "top" — наибольший rev ДО этой записи). Иначе чужая
-- правка с номером МЕНЬШЕ нашей записи была бы перешагнута и потеряна навсегда
-- — ровно та беда, ради которой всё это и делается.

create sequence if not exists public.board_stroke_rev;
-- Номер выдаёт сама board_patch, а она SECURITY INVOKER — право на
-- последовательность нужно ВЫЗЫВАЮЩЕМУ. Ученик ходит под app_user, и без этой
-- строки у него молча ломается всякое сохранение доски (как у board_stroke_ord).
grant usage on sequence public.board_stroke_rev to app_user, authenticated;

-- default ставим сразу: пока миграция идёт, сохранения от старой board_patch
-- продолжают приходить, и строка без rev сломала бы сверку у всех.
alter table public.board_strokes
  add column if not exists rev bigint default nextval('public.board_stroke_rev');

update public.board_strokes set rev = nextval('public.board_stroke_rev') where rev is null;
alter table public.board_strokes alter column rev set not null;

-- Наибольший rev спрашивают на КАЖДОЙ сверке (раз в пять секунд у каждого
-- клиента), поэтому он обязан браться из индекса, а не чтением строк комнаты.
create index if not exists board_strokes_room_rev on public.board_strokes (room, rev);

-- Сцена целиком: отдаёт и наибольший rev — с него клиент ведёт отсчёт.
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
    'maxRev',  coalesce((select max(s.rev) from public.board_strokes s where s.room = p_student_id), 0),
    'bg',      coalesce((select b.bg       from public.boards b where b.student_id = p_student_id), 'plain'),
    'bgColor',          (select b.bg_color from public.boards b where b.student_id = p_student_id)
  );
$$;

-- Догон по номеру ЗАПИСИ: и новые штрихи, и правки на месте. Порядок — по ord:
-- он и есть порядок рисования, и у пришедшей правки он прежний, поэтому
-- передвинутый штрих не всплывает поверх соседей.
--
-- n отдаём тем же ответом: удаление ни rev, ни ord не меняет, и заметить его
-- можно только по числу строк.
create or replace function public.board_strokes_since(p_student_id text, p_rev bigint)
returns jsonb
language sql
security invoker
stable
set search_path = public
as $$
  select jsonb_build_object(
    'strokes', coalesce((select jsonb_agg(s.data order by s.ord)
                           from public.board_strokes s
                          where s.room = p_student_id and s.rev > p_rev), '[]'::jsonb),
    'maxOrd',  coalesce((select max(s.ord) from public.board_strokes s where s.room = p_student_id), 0),
    'maxRev',  coalesce((select max(s.rev) from public.board_strokes s where s.room = p_student_id), p_rev),
    'n',       (select count(*) from public.board_strokes s where s.room = p_student_id)
  );
$$;

grant execute on function public.board_strokes_since(text, bigint) to app_user, authenticated;

-- board_patch теперь ВОЗВРАЩАЕТ номера записи: "rev" — наибольший после этого
-- сохранения, "top" — наибольший ДО него. Второе и есть разрешение сдвинуть
-- свою отметку: top не больше нашей отметки значит, что чужого, чего мы не
-- видели, в базе не появилось. Возвращаемый тип меняется (void → jsonb),
-- поэтому функцию приходится удалять: create or replace на смену типа не идёт.
-- Набор АРГУМЕНТОВ прежний — вкладка со старой сборкой сохраняется как
-- сохраняла и просто не читает ответ.
drop function if exists public.board_patch(text, jsonb, jsonb, text, text, text, boolean);

create function public.board_patch(
  p_student_id text,
  p_up         jsonb   default '[]'::jsonb,  -- добавленные и изменённые штрихи
  p_del        jsonb   default '[]'::jsonb,  -- id удалённых
  p_bg         text    default null,
  p_bg_color   text    default null,
  p_by         text    default null,
  p_wipe       boolean default false         -- очистка доски: старого не оставляем
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  top_before bigint;
  top_after  bigint;
begin
  select coalesce(max(rev), 0) into top_before from board_strokes where room = p_student_id;

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
    insert into board_strokes (room, id, ord, data, rev)
    select p_student_id, e.value->>'id', nextval('public.board_stroke_ord'), e.value,
           nextval('public.board_stroke_rev')
      from jsonb_array_elements(p_up) with ordinality e(value, ord)
     where e.value->>'id' is not null
    -- Правка существующего штриха НЕ двигает его ord: порядок массива — это
    -- порядок рисования, и передвинутый штрих не должен всплывать поверх
    -- соседей. А вот rev двигает: по нему сверка и замечает такую правку.
    on conflict (room, id) do update set data = excluded.data, rev = excluded.rev;
  end if;

  select coalesce(max(rev), 0) into top_after from board_strokes where room = p_student_id;
  return jsonb_build_object('rev', top_after, 'top', top_before);
end
$$;

grant execute on function public.board_patch(text, jsonb, jsonb, text, text, text, boolean)
  to app_user, authenticated;

-- Сверка: к счётчику и последнему id добавляется наибольший номер записи.
-- Первые два ловят вставку и удаление, третий — ещё и правку на месте.
drop view if exists public.boards_state;
create view public.boards_state
with (security_invoker = on) as
  select b.student_id,
         b.updated_at,
         b.updated_by,
         (select count(*) from public.board_strokes s where s.room = b.student_id)        as n,
         (select s.data->>'id' from public.board_strokes s where s.room = b.student_id
           order by s.ord desc limit 1)                                                   as last_id,
         (select coalesce(max(s.rev), 0) from public.board_strokes s
           where s.room = b.student_id)                                                   as rev
    from public.boards b;

grant select on public.boards_state to app_user, authenticated;

comment on column public.board_strokes.rev is
  'Номер записи строки: растёт при любом сохранении, в том числе при правке на месте (см. supabase/board_stroke_rev.sql)';
comment on function public.board_strokes_since is
  'Догон доски по номеру записи: и новые штрихи, и правки на месте (перенос, цвет, ответ)';
comment on view public.boards_state is
  'Сверка доски без чтения сцены: число штрихов, последний id и наибольший rev';

notify pgrst, 'reload schema';
