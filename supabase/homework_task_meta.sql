-- Балл работы, проверенной рукой, виден в «Результатах» — без выгрузки условий.
--
-- Балл всей работы считает ОДНА арифметика (homeworkPointsOf в src/utils.js):
-- у задания с эталоном верность даёт сверка, у задания без эталона — отметка
-- репетитора, и каждое весит столько баллов, сколько за него дают на экзамене.
-- Отсюда и оценка за работу. Чтобы посчитать это, нужны две вещи из строки:
-- отметки (homework.task_marks) и НОМЕР экзамена у каждого задания — он лежит
-- внутри homework.bank_tasks.
--
-- А bank_tasks выгружать в список нельзя: там сами условия, чертежи внутри
-- data-URI и архивы, то есть больше, чем вся остальная таблица вместе взятая
-- (на боевой 646 КБ против 12 КБ описаний). Ровно из-за этого списки работ
-- перестали её просить. Поэтому вместо колонки отдаётся ВЫЖИМКА: номер и
-- предмет каждого задания по порядку, десятки байтов на работу.
--
-- Это вычисляемое поле PostgREST (функция от строки таблицы), а не вторая
-- копия данных: разойтись с bank_tasks ей нечем. Читается как обычная колонка
-- с переименованием: select=...,task_meta:homework_task_meta.
--
-- Выполнить в Studio → SQL Editor (db.precettore.ru). Идемпотентно, данные не
-- меняет. Пока миграция не выполнена, запрос с этим полем падает, клиент
-- повторяет его без поля, и работа, проверенная рукой, показывается в таблице
-- прочерками — как до этой правки.

CREATE OR REPLACE FUNCTION public.homework_task_meta(h public.homework)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_agg(
           jsonb_build_object('number', t->'number', 'exam_type', t->'exam_type')
           ORDER BY ord)
  FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(h.bank_tasks) = 'array' THEN h.bank_tasks ELSE '[]'::jsonb END
       ) WITH ORDINALITY AS e(t, ord)
$$;

-- Репетитор читает свои работы, ученик и родитель — свои: доступ к самой строке
-- решает RLS на homework, функция лишь пересказывает то, что уже отдано.
GRANT EXECUTE ON FUNCTION public.homework_task_meta(public.homework) TO authenticated, app_user;

NOTIFY pgrst, 'reload schema';
