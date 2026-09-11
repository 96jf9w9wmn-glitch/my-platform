-- Горячее исправление зависаний доски. Выполнить на боевой базе ОДИН РАЗ.
--
-- Это намеренно отдельная миграция, а не повторный запуск board_strokes.sql:
-- исходный файл содержит первичный перенос старых boards.scene в board_strokes,
-- который на работающей доске повторять незачем.

create or replace function public.board_patch(
  p_student_id text,
  p_up         jsonb   default '[]'::jsonb,
  p_del        jsonb   default '[]'::jsonb,
  p_bg         text    default null,
  p_bg_color   text    default null,
  p_by         text    default null,
  p_wipe       boolean default false
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  nxt bigint;
begin
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
    on conflict (room, id) do update set data = excluded.data;
  end if;
end
$$;

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
     and b.updated_at <= cutoff;
  get diagnostics mirrored = row_count;
  return mirrored;
end
$$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'board-scene-mirror';
  perform cron.schedule('board-scene-mirror', '*/5 * * * *', 'select public.board_mirror_scenes()');
exception when others then
  raise notice 'pg_cron недоступен (%); зеркало boards.scene не будет обновляться автоматически', sqlerrm;
end
$$;

comment on function public.board_patch is 'Дельта-сохранение доски построчно; boards.scene обновляет pg_cron';
comment on function public.board_mirror_scenes is 'Фоновое зеркало board_strokes в boards.scene для старых вкладок и резервной копии';

notify pgrst, 'reload schema';
