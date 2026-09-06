-- Доска сохраняется ДЕЛЬТОЙ, а не целиком.
--
-- Было: каждый клиент раз в 1,2 с заливал в boards.scene ВСЮ сцену. К середине
-- года сцена весит мегабайты (у боевых досок 1–3 МБ), и это давало сразу две
-- беды, обе видны как «ученику то видно, то не видно, что я пишу»:
--   1. Канал забит. Три мегабайта исходящего каждую паузу в письме — на обычном
--      аплинке это секунды; запросы наслаивались друг на друга, и посылки
--      realtime (тот же сокет, та же сеть) шли рывками и терялись.
--   2. Последний записавший ЗАТИРАЛ чужое. Каждый писал свою копию сцены целиком,
--      поэтому штрих собеседника, не доехавший по realtime, из базы ИСЧЕЗАЛ —
--      и «догон» (перечитывание сцены) его уже не возвращал.
--
-- Стало: клиент шлёт только изменившиеся штрихи и id удалённых. Сцену собирает
-- база, поэтому свои правки не затирают чужие. Обновлённый штрих остаётся на
-- СВОЁМ месте в массиве (порядок = порядок рисования = кто поверх кого).
--
-- security invoker: доступ решают те же политики boards_own / boards_tutor.
create or replace function public.board_patch(
  p_student_id text,
  p_up         jsonb   default '[]'::jsonb,  -- добавленные и изменённые штрихи
  p_del        jsonb   default '[]'::jsonb,  -- id удалённых
  p_bg         text    default null,
  p_bg_color   text    default null,
  p_by         text    default null,
  p_wipe       boolean default false         -- очистка доски: старое не сохраняем
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_strokes jsonb;
  kept        jsonb;
  added       jsonb;
begin
  select scene->'strokes' into old_strokes from boards where student_id = p_student_id for update;
  if p_wipe or old_strokes is null or jsonb_typeof(old_strokes) <> 'array' then
    old_strokes := '[]'::jsonb;
  end if;

  -- Старые: удалённые выбрасываем, изменённые подменяем НА МЕСТЕ (иначе
  -- передвинутый штрих уезжал бы в конец массива и всплывал поверх соседей).
  select coalesce(jsonb_agg(coalesce(u.val, t.s) order by t.ord), '[]'::jsonb)
    into kept
    from jsonb_array_elements(old_strokes) with ordinality t(s, ord)
    left join lateral (
      select e.value as val from jsonb_array_elements(p_up) e
       where e.value->>'id' = t.s->>'id' limit 1
    ) u on true
   where not (t.s->>'id' in (select jsonb_array_elements_text(p_del)));

  -- Новые — в конец, в том порядке, в каком их прислали.
  select coalesce(jsonb_agg(e.value order by e.ord), '[]'::jsonb)
    into added
    from jsonb_array_elements(p_up) with ordinality e(value, ord)
   where not (e.value->>'id' in (select s->>'id' from jsonb_array_elements(kept) s));

  insert into boards as b (student_id, scene, updated_by, updated_at)
  values (
    p_student_id,
    jsonb_build_object('strokes', kept || added, 'bg', coalesce(p_bg, 'plain'), 'bgColor', p_bg_color),
    p_by, now()
  )
  on conflict (student_id) do update set
    scene = jsonb_build_object(
      'strokes', kept || added,
      'bg',      coalesce(p_bg,       b.scene->>'bg'),
      'bgColor', coalesce(p_bg_color, b.scene->>'bgColor')
    ),
    updated_by = p_by,
    updated_at = now();
end
$$;

grant execute on function public.board_patch(text, jsonb, jsonb, text, text, text, boolean)
  to app_user, authenticated;

-- Лёгкая сверка «не потерялось ли». Читать всю сцену ради проверки нельзя — это
-- те же мегабайты; здесь только счётчик и id последнего штриха, десяток байт.
create or replace view public.boards_state
with (security_invoker = on) as
  select student_id,
         updated_at,
         updated_by,
         jsonb_array_length(coalesce(scene->'strokes', '[]'::jsonb)) as n,
         scene->'strokes'->-1->>'id'                                 as last_id
    from public.boards;

grant select on public.boards_state to app_user, authenticated;

comment on function public.board_patch is 'Дельта-сохранение доски: свои штрихи не затирают чужие (см. supabase/board_delta.sql)';
comment on view public.boards_state is 'Счётчик штрихов доски для лёгкой сверки без чтения всей сцены';
