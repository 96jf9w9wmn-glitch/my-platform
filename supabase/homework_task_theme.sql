-- Тема задания, проставленная рукой репетитора, доезжает до статистики.
--
-- Задание из своего файла уже умеет носить НОМЕР экзамена (homework_task_marks.sql):
-- по нему работа попадает в карту заданий. Но внутри номера все такие задания
-- на одно лицо — «№9 берёт через раз» и всё. Тема отвечает на второй вопрос:
-- ЧТО именно отрабатывается («Квадратные уравнения», «Задачи на движение»).
-- Репетитор выбирает её из тем номера или пишет свою.
--
-- Хранится она в самой работе (homework.bank_tasks[i].theme — колонка jsonb,
-- миграции не требует), а в журнале попыток идёт ключом gen_key в виде
-- "theme:<подпись>" (см. src/taskTheme.js). Своей колонки под тему нет
-- НАМЕРЕННО: gen_key — это и есть «чем задание отличается внутри номера», по
-- нему считают «Где ученик ошибается», сводку в «Результатах» и темы отчёта
-- родителю. Вторая колонка развела бы одного ученика по двум разбивкам одного
-- номера.
--
-- Ученическая запись (task_attempt_log) gen_key принимала с самого начала —
-- править её не нужно. Здесь только отметка репетитора: она писала gen_key
-- жёстким NULL, потому что у задания из файла генератора нет.
--
-- ВЫПОЛНЕНА на боевой 14.09.2026. Идемпотентна.
-- Пока миграция не выполнена, клиент зовёт прежнюю, семиаргументную версию:
-- отметка доезжает в журнал как раньше, просто без темы.
--
-- ГНАТЬ ПОД supabase_admin (Studio → SQL Editor так и делает). Из psql под
-- ролью postgres пересоздание СТАРОЙ функции падает с «must be owner of
-- function task_attempt_mark»: владелец у неё supabase_admin, а postgres в
-- этой базе не суперпользователь. Новая функция при этом успевает создаться —
-- и остаётся с чужим владельцем, так что после такой осечки её надо снести и
-- прогнать файл заново под supabase_admin.

CREATE OR REPLACE FUNCTION public.task_attempt_mark(
  p_source     text,
  p_source_id  uuid,
  p_student_id text,
  p_exam_type  text,
  p_number     smallint,
  p_correct    boolean,
  p_task_no    smallint,
  p_gen_key    text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account uuid;
  v_id      uuid;
BEGIN
  -- Аккаунт ученика берём из его же карточки: связь по колонке, а при её
  -- отсутствии — по телефону (так же, как пускает ученика current_student_rows).
  SELECT COALESCE(s.student_account_id,
                  (SELECT a.id FROM student_accounts a WHERE a.phone = s.phone LIMIT 1))
    INTO v_account
    FROM students s
   WHERE s.id::text = p_student_id
     AND s.tutor_id = auth.uid();

  -- Чужой ученик, ученик без аккаунта (карточку завели, сам он ещё не входил) —
  -- писать попытку некуда и не за кого.
  IF v_account IS NULL THEN
    RETURN NULL;
  END IF;

  -- Ищем строку по ПОЗИЦИИ задания, а не по его номеру: номер репетитор мог
  -- поменять после отметки, а задание осталось тем же.
  IF p_correct IS NULL THEN
    DELETE FROM task_attempts a
     WHERE a.source = p_source AND a.source_id = p_source_id
       AND a.task_no = p_task_no AND a.account_id = v_account;
    RETURN NULL;
  END IF;

  -- gen_key переписываем ВСЕГДА, в том числе в NULL: репетитор мог стереть
  -- тему, и прежняя, оставшись в журнале, тянула бы задание в свод по теме,
  -- от которой он уже отказался.
  UPDATE task_attempts a
     SET is_correct = p_correct, exam_type = p_exam_type, number = p_number,
         gen_key = p_gen_key
   WHERE a.source = p_source AND a.source_id = p_source_id
     AND a.task_no = p_task_no AND a.account_id = v_account
  RETURNING a.id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO task_attempts (account_id, student_id, source, source_id, exam_type,
                               number, gen_key, is_correct, answer_given, attempt_no, task_no)
    -- Ключа типажа за заданием из файла нет и быть не может — генератора за ним
    -- не стоит. Здесь лежит ТЕМА репетитора ("theme:…") либо NULL; своды по
    -- номеру такие строки считают наравне с остальными.
    -- answer_given нет: ответ ученика лежит фотографией решения, а не строкой.
    -- Пустое поле честнее выдуманного.
    VALUES (v_account, p_student_id, p_source, p_source_id, p_exam_type,
            p_number, p_gen_key, p_correct, NULL, 1, p_task_no)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.task_attempt_mark(text, uuid, text, text, smallint, boolean, smallint, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.task_attempt_mark(text, uuid, text, text, smallint, boolean, smallint, text) TO authenticated;

-- Прежняя, семиаргументная версия ОСТАЁТСЯ и становится обёрткой. Удалять её
-- нельзя: её зовёт вкладка со старой сборкой, открытая прямо сейчас, и отметка
-- в ней перестала бы доезжать до журнала. PostgREST выбирает перегрузку по
-- именам переданных полей, так что две функции рядом друг другу не мешают.
CREATE OR REPLACE FUNCTION public.task_attempt_mark(
  p_source     text,
  p_source_id  uuid,
  p_student_id text,
  p_exam_type  text,
  p_number     smallint,
  p_correct    boolean,
  p_task_no    smallint
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.task_attempt_mark(p_source, p_source_id, p_student_id, p_exam_type,
                                  p_number, p_correct, p_task_no, NULL::text);
$$;

REVOKE ALL ON FUNCTION public.task_attempt_mark(text, uuid, text, text, smallint, boolean, smallint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.task_attempt_mark(text, uuid, text, text, smallint, boolean, smallint) TO authenticated;

NOTIFY pgrst, 'reload schema';
