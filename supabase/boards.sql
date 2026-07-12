-- Собственная доска платформы — совместное рисование репетитора и ученика.
-- Холст рисуем сами на HTML5 Canvas (без внешних движков); сцена = массив штрихов
-- в логических координатах 1600×1000. Одна доска на ученика (как раньше внешняя
-- board_url). Синхронизация в реальном времени идёт через Supabase Realtime
-- broadcast-канал board:{student_id} и НЕ требует репликации этой таблицы — здесь
-- хранится только персистентный снапшот сцены.
--
-- ВНИМАНИЕ (тех. долг, см. CLAUDE.md): RLS здесь НЕ включён, как и на students/
-- homework/notifications — таблица читается и пишется через anon-ключ. Ученики/родители
-- не заведены в auth.users, поэтому обычная политика по auth.uid() тут не сработает —
-- закрывать доступ придётся RPC-слоем вместе с остальными таблицами, отдельным шагом.

-- student_id — ТЕКСТ, а не uuid: в этой базе students.id местами bigint (Date.now()),
-- местами uuid (см. fix_student_id_uuid.sql, который мог быть не выполнен). text
-- принимает оба формата; uuid-колонка давала 400 "invalid input syntax for type uuid".
create table if not exists public.boards (
  student_id  text primary key,
  -- Снапшот сцены: { "strokes": [ {id, author, tool, color, width, points:[[x,y],...]} ], "bg": "plain|grid|dots" }
  scene       jsonb not null default '{"strokes":[]}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text  -- 't:<tutor_id>' или 's:<account_id>' — кто сохранил последним
);

-- Если таблица уже создавалась с uuid — привести к text (безопасно, без потери данных):
alter table public.boards alter column student_id type text;

-- Свежие таблицы Supabase часто создаются с включённым RLS. Явно выключаем, чтобы
-- модель доступа совпадала с остальными таблицами (students/homework и т.д.) — иначе
-- anon-ключ получает "violates row-level security policy" и доска не сохраняется.
-- Закрытие доступа (RLS/RPC) — общий следующий шаг для всех этих таблиц, см. CLAUDE.md.
alter table public.boards disable row level security;

comment on table public.boards is 'Снапшот сцены доски (массив штрихов), одна доска на ученика (student_id). Realtime — через broadcast, не через репликацию.';
