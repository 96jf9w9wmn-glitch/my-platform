-- Журнал попыток для работы, размеченной ЗАДНИМ ЧИСЛОМ.
--
-- Своя раздатка связывается с номерами экзамена когда угодно, в том числе
-- после сдачи: репетитор нарезал файл, ученик ответил, и только на разборе
-- дошли руки проставить «№». Сдача такую работу в журнал не писала (номера
-- тогда не было), а разметка журнала не касалась — работа навсегда оставалась
-- вне карты заданий. На боевой так потерялась работа на 44 задания: 33 ответа,
-- выставленный балл 27 — и ни одной строки в task_attempts.
--
-- Пишет РЕПЕТИТОР, как и ручная отметка (task_attempt_mark): у ученической
-- task_attempt_log нужен session_token, которого здесь нет. Право — «ученик
-- мой», аккаунт берётся из карточки.
--
-- ЧТО СЧИТАТЬ ВЕРНЫМ, функция НЕ решает: сверка ответов живёт в JS
-- (answersEqual — дроби, множества, числовые формы) и второй копии на SQL у
-- неё быть не должно, иначе две сверки разойдутся на первом же «0,5 = 1/2».
-- Клиент присылает готовые строки (src/homeworkAttempts.js, markupAttempts).
create or replace function homework_attempts_fill(
  p_source_id uuid,
  p_student_id text,
  p_rows jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_rows integer := 0;
  r record;
begin
  -- Аккаунт ученика — из его карточки: связь по колонке, а при её отсутствии
  -- по телефону, ровно как это делает task_attempt_mark.
  select coalesce(s.student_account_id,
                  (select a.id from student_accounts a where a.phone = s.phone limit 1))
    into v_account
    from students s
   where s.id::text = p_student_id
     and s.tutor_id = auth.uid();

  if v_account is null then
    return 0;                           -- чужой ученик или ученик без аккаунта
  end if;

  -- СТРОКИ БЕЗ ПОЗИЦИИ НЕ ТРОГАЕМ ВОВСЕ. Их записала сдача (task_attempt_log
  -- позиции не знает), то есть номера у заданий были уже тогда и журнал верен.
  -- Сопоставить их с заданиями нечем — в раздатке все задания одного номера, —
  -- и «обновление» свелось бы к вставке вторых строк поверх правильных.
  if exists (
    select 1 from task_attempts t
     where t.source = 'homework' and t.source_id = p_source_id and t.task_no is null
  ) then
    return 0;
  end if;

  for r in
    select (x->>'task_no')::smallint            as task_no,
           x->>'exam_type'                      as exam_type,
           (x->>'number')::smallint             as number,
           nullif(x->>'gen_key', '')            as gen_key,
           (x->>'correct')::boolean             as correct,
           coalesce(x->>'answer', '')           as answer
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
  loop
    update task_attempts t
       set exam_type = r.exam_type, number = r.number, gen_key = r.gen_key,
           is_correct = r.correct, answer_given = r.answer
     where t.source = 'homework' and t.source_id = p_source_id
       and t.task_no = r.task_no and t.account_id = v_account
       -- Доработку не трогаем: её попытки — вторые, и своды по первым их не
       -- считают. Переписать их разметкой значило бы стереть историю пересдачи.
       and t.attempt_no = 1;

    if not found then
      insert into task_attempts (account_id, student_id, source, source_id, exam_type,
                                 number, gen_key, is_correct, answer_given, attempt_no, task_no)
      values (v_account, p_student_id, 'homework', p_source_id, r.exam_type,
              r.number, r.gen_key, r.correct, r.answer, 1, r.task_no);
    end if;
    v_rows := v_rows + 1;
  end loop;

  -- Номер СНЯЛИ — строки быть не должно: задание вернулось в «не связано с
  -- экзаменом», и оставленная попытка тянула бы в свод номер, от которого
  -- репетитор уже отказался.
  delete from task_attempts t
   where t.source = 'homework' and t.source_id = p_source_id
     and t.account_id = v_account and t.attempt_no = 1
     and t.task_no is not null
     and not exists (
       select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
        where (x->>'task_no')::smallint = t.task_no
     );

  return v_rows;
end;
$$;

revoke all on function homework_attempts_fill(uuid, text, jsonb) from public;
grant execute on function homework_attempts_fill(uuid, text, jsonb) to authenticated;
