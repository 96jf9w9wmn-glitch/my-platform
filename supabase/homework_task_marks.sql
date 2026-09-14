-- Проверка письменного задания рукой репетитора попадает в статистику.
--
-- Автопроверка сверяет ответ с эталоном и пишет попытку в task_attempts — на
-- ней держатся карта заданий, «Где ученик ошибается» и отчёт родителю. Но у
-- работы, которую репетитор проверяет сам (свой файл, фотография решения,
-- развёрнутый ответ), эталона нет вовсе: сверять нечего, попытка не пишется, и
-- такая работа для статистики не существует — притом что именно так задают
-- чаще всего.
--
-- Кто верно решил, а кто нет, в этом случае знает только репетитор. Поэтому:
--   * его отметка по каждому заданию живёт в самой работе (homework.task_marks,
--     «номер задания → верно/неверно») — это то, что он видит в разборе;
--   * и она же уходит в журнал попыток функцией ниже, чтобы карта заданий у
--     такой работы заполнялась наравне с собранной из банка.
--
-- Отметка — НЕ то же самое, что `credited` из manual_credit.sql, хотя и стоит
-- рядом. Зачёт правит ошибку ЭТАЛОНА: ответ ученика есть, сверка назвала его
-- неверным, репетитор с ней не согласился. Отметка ставится там, где сверки не
-- было вовсе. Свести их в одну колонку нельзя: зачёт бывает только
-- положительным, а отметка обязана различать «неверно» и «ещё не смотрел».
--
-- Выполнить в Studio → SQL Editor (db.precettore.ru). Идемпотентно.
-- Пока миграция не выполнена, кнопок «верно/неверно» в разборе просто нет:
-- клиент проверяет наличие колонки в самой строке работы.

-- Отметки репетитора по заданиям работы: {"3": true, "5": false}
ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS task_marks jsonb;

-- Колонка табличная, грант в rls_step3_policies.sql выдан на всю таблицу
-- (grant select, update on public.homework to app_user) — отдельного не нужно.

-- Позиция задания ВНУТРИ источника (1..N). Нужна там, где в одной работе
-- несколько заданий ОДНОГО номера: раздатка по одной теме — это девять задач
-- №7, и каждая из них своя попытка. Без этого поля отметки девяти заданий
-- ложились бы в одну строку, затирая друг друга, и «6 из 9» превращалось бы в
-- «верно» или «неверно». Старые строки остаются с NULL: своды считают по
-- exam_type/number/gen_key и этой колонки не замечают.
ALTER TABLE public.task_attempts
  ADD COLUMN IF NOT EXISTS task_no smallint;

-- ── Журнал попыток ──────────────────────────────────────────────────────────
-- Пишет попытку ОТ ИМЕНИ РЕПЕТИТОРА. Ученической функцией (task_attempt_log)
-- тут не обойтись: она требует session_token ученика, а отмечает задание не он.
-- Право проверяется по карточке: ученик должен быть свой.
--
-- Одно задание — одна строка: повторная отметка ПРАВИТ прежнюю, а не добавляет
-- вторую. Иначе репетитор, передумав дважды, растянул бы историю по номеру и
-- сам же испортил бы себе проценты. Снятие отметки (p_correct is null) строку
-- удаляет — в статистике не должно остаться следа от того, чего он не утверждал.
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

  UPDATE task_attempts a
     SET is_correct = p_correct, exam_type = p_exam_type, number = p_number
   WHERE a.source = p_source AND a.source_id = p_source_id
     AND a.task_no = p_task_no AND a.account_id = v_account
  RETURNING a.id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO task_attempts (account_id, student_id, source, source_id, exam_type,
                               number, gen_key, is_correct, answer_given, attempt_no, task_no)
    -- gen_key нет и быть не может: за заданием из своего файла не стоит
    -- генератора. Колонка это допускает, а своды по номеру такие строки
    -- считают наравне с остальными.
    -- answer_given тоже нет: ответ ученика лежит фотографией решения, а не
    -- строкой. Пустое поле честнее выдуманного.
    VALUES (v_account, p_student_id, p_source, p_source_id, p_exam_type,
            p_number, NULL, p_correct, NULL, 1, p_task_no)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.task_attempt_mark(text, uuid, text, text, smallint, boolean, smallint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.task_attempt_mark(text, uuid, text, text, smallint, boolean, smallint) TO authenticated;

-- Прежняя, шестиаргументная версия (её в боевой базе не было ни минуты, но
-- пересоздание функции с новым аргументом оставляет старую рядом) — убираем,
-- чтобы PostgREST не пришлось выбирать между двумя перегрузками.
DROP FUNCTION IF EXISTS public.task_attempt_mark(text, uuid, text, text, smallint, boolean);
