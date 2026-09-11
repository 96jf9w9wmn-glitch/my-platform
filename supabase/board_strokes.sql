-- Штрих доски — отдельная СТРОКА, а не элемент одного мегабайтного jsonb.
--
-- Было: вся сцена лежала в boards.scene одним jsonb, и КАЖДОЕ сохранение
-- переписывало её целиком. Замер на боевой доске (2935 штрихов, 3,7 МБ):
-- добавление ОДНОГО штриха — 489 мс работы базы, из них ~240 мс только сборка
-- нового jsonb, остальное — перезапись 3,7 МБ (TOAST + WAL). Клиент шлёт
-- сохранение раз в 1,2 с, значит одна пишущая рука занимала базу почти
-- наполовину, а двое пишущих вставали в очередь на «select … for update».
-- Отсюда «сайт лёг, доска легла, ничего не работало»: ответы приходили через
-- секунду и позже, сохранения наслаивались, и написанное терялось.
--
-- Стало: строка на штрих. Добавление — одна вставка, правка — один update по
-- первичному ключу, удаление — delete. Стоимость не зависит от того, сколько
-- уже нарисовано.
--
-- Порядок рисования (кто поверх кого) хранит ord: у обновлённого штриха он НЕ
-- меняется, поэтому передвинутый штрих остаётся на своём слое.
--
-- boards остаётся: в ней фон доски, права и ЗЕРКАЛО сцены целиком. Зеркало
-- обновляет фоновый pg_cron раз в пять минут — оно нужно двум вещам:
-- вкладке со старой сборкой, которая читает scene напрямую, и как запасная
-- копия всей сцены одной строкой.

create table if not exists public.board_strokes (
  room text   not null,
  id   text   not null,
  ord  bigint not null,
  data jsonb  not null,
  primary key (room, id)
);
create index if not exists board_strokes_room_ord on public.board_strokes (room, ord);

-- Когда сцену последний раз зеркалили в boards.scene целиком.
alter table public.boards add column if not exists mirror_at timestamptz;

-- Фон доски — своими колонками. В scene он лежал рядом со сценой, а прочитать
-- оттуда даже одно поле значит распаковать все мегабайты TOAST: на боевой доске
-- это ~20 мс на каждое сохранение штриха, на ровном месте.
alter table public.boards add column if not exists bg       text;
alter table public.boards add column if not exists bg_color text;
update public.boards set bg = scene->>'bg', bg_color = scene->>'bgColor' where bg is null;

alter table public.board_strokes enable row level security;

-- Права те же, что у самой доски, и решает их ПЕРВАЯ часть адреса — карточка
-- ученика (см. supabase/board_rooms.sql).
drop policy if exists board_strokes_tutor on public.board_strokes;
create policy board_strokes_tutor on public.board_strokes for all to authenticated
  using (exists (select 1 from public.students s
                  where s.id::text = split_part(board_strokes.room, ':', 1)
                    and s.tutor_id = auth.uid()))
  with check (exists (select 1 from public.students s
                       where s.id::text = split_part(board_strokes.room, ':', 1)
                         and s.tutor_id = auth.uid()));

drop policy if exists board_strokes_own on public.board_strokes;
create policy board_strokes_own on public.board_strokes for all to app_user
  using (split_part(room, ':', 1) in (select public.current_student_rows()::text)
         or split_part(room, ':', 1) = public.current_parent_student_id()::text)
  with check (split_part(room, ':', 1) in (select public.current_student_rows()::text));

grant select, insert, update, delete on public.board_strokes to app_user, authenticated;

-- Перенос того, что уже нарисовано. Идёт один раз: повторный запуск ничего не
-- перезапишет (on conflict do nothing), потому что дальше правду держат строки.
insert into public.board_strokes (room, id, ord, data)
select b.student_id, x->>'id', ord, x
  from public.boards b,
       lateral jsonb_array_elements(coalesce(b.scene->'strokes', '[]'::jsonb)) with ordinality t(x, ord)
 where x->>'id' is not null
on conflict (room, id) do nothing;

-- Сцена целиком: собирается из строк по порядку рисования.
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
    'bg',      coalesce((select b.bg       from public.boards b where b.student_id = p_student_id), 'plain'),
    'bgColor',          (select b.bg_color from public.boards b where b.student_id = p_student_id)
  );
$$;

grant execute on function public.board_scene(text) to app_user, authenticated;

-- Сохранение дельты. Сигнатура та же, что была у jsonb-версии: вкладка со
-- старой сборкой продолжает сохраняться правильно, ничего не зная о строках.
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
declare
  nxt bigint;
begin
  -- Строка доски: фон, отметка о правке и проверка прав (RLS сработает здесь же).
  --
  -- scene ТРОГАЕМ ТОЛЬКО при смене фона. В ней лежит зеркало сцены целиком, то
  -- есть мегабайты в TOAST: пока колонке присваивают то же значение, Postgres
  -- переиспользует её и правка строки стоит 2 мс, а одно «безобидное»
  -- jsonb_set — уже 177 мс, и весь смысл построчного хранения пропадает
  -- (замерено на боевой доске в 3,7 МБ).
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
    select coalesce(max(ord), 0) into nxt from board_strokes where room = p_student_id;
    insert into board_strokes (room, id, ord, data)
    select p_student_id, e.value->>'id', nxt + e.ord, e.value
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

-- Тяжёлую сборку boards.scene намеренно выносим ИЗ board_patch. Иначе первый
-- штрих после пяти минут простоя всё равно ждёт jsonb_agg всей доски и держит
-- живую запись в очереди. Снимок нужен лишь старой вкладке и как резервная копия,
-- поэтому фоновая свежесть до пяти минут для него достаточна.
create or replace function public.board_mirror_scenes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := clock_timestamp();
  mirrored integer;
begin
  update public.boards b set
    scene = jsonb_build_object(
      'strokes', coalesce((select jsonb_agg(s.data order by s.ord)
                             from public.board_strokes s where s.room = b.student_id), '[]'::jsonb),
      'bg',      coalesce(b.bg, 'plain'),
      'bgColor', b.bg_color),
    mirror_at = clock_timestamp()
   where (b.mirror_at is null or b.mirror_at < b.updated_at)
     -- Правка, начавшаяся уже после запуска задания, останется грязной и попадёт
     -- в следующий проход: фоновая копия никогда не объявит её сохранённой раньше
     -- времени.
     and b.updated_at <= cutoff;
  get diagnostics mirrored = row_count;
  return mirrored;
end
$$;

-- Повторный запуск миграции безопасен: старую задачу с тем же именем заменяем.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'board-scene-mirror';
  perform cron.schedule('board-scene-mirror', '*/5 * * * *', 'select public.board_mirror_scenes()');
exception when others then
  raise notice 'pg_cron недоступен (%); зеркало boards.scene не будет обновляться автоматически', sqlerrm;
end
$$;

-- Лёгкая сверка «не потерялось ли»: теперь это счёт по индексу, а не распаковка
-- мегабайтного jsonb на каждый опрос.
drop view if exists public.boards_state;
create view public.boards_state
with (security_invoker = on) as
  select b.student_id,
         b.updated_at,
         b.updated_by,
         (select count(*) from public.board_strokes s where s.room = b.student_id)                          as n,
         (select s.data->>'id' from public.board_strokes s where s.room = b.student_id
           order by s.ord desc limit 1)                                                                     as last_id
    from public.boards b;

grant select on public.boards_state to app_user, authenticated;

comment on table public.board_strokes is 'Штрихи доски построчно: сохранение штриха не переписывает всю сцену (см. supabase/board_strokes.sql)';
comment on function public.board_patch is 'Дельта-сохранение доски построчно; boards.scene обновляет pg_cron';
comment on function public.board_scene is 'Сцена доски целиком, собранная из board_strokes по порядку рисования';
comment on function public.board_mirror_scenes is 'Фоновое зеркало board_strokes в boards.scene для старых вкладок и резервной копии';

-- Гранты новым таблицам Supabase раздаёт сам, в том числе анониму: защита тогда
-- держится только на RLS. Снимаем явно — как это сделано у остальных таблиц с
-- персональными данными.
revoke all on public.board_strokes from anon;
