// Журнал попыток по домашней работе: что уходит в task_attempts после сдачи.
//
// Вынесено из самой сдачи (StudentDashboard) отдельной чистой функцией по двум
// причинам. Во-первых, на этих строках держится вся статистика ученика — карта
// заданий, «Где ученик ошибается», отчёт родителю, — и ошибка здесь не видна
// нигде до конца четверти. Во-вторых, только так её можно прогнать проверкой
// на выдуманных работах, не поднимая кабинет целиком.
//
// Задание попадает в журнал, когда у него есть ПРЕДМЕТ И НОМЕР экзамена. У
// собранного из банка они приезжают вместе с заданием, у нарезанного из своего
// файла — их проставляет репетитор при выдаче (поле «№» в форме). Нет номера —
// задание просто не попадает в свод по номерам; работа при этом проверяется и
// оценивается как обычно.

import { answersEqual } from "./utils"

export function homeworkAttempts(hw, { answers, correct, account, token, studentId }) {
  const bank = Array.isArray(hw?.bank_tasks) ? hw.bank_tasks : []
  // Соответствие ответа заданию держится на ПОРЯДКЕ: при расхождении длин
  // попытка приписалась бы чужому номеру, а это хуже, чем её отсутствие.
  if (!bank.length || bank.length !== (correct?.length ?? -1)) return []

  // Повторная сдача — вторая попытка. Доля верных в аналитике считается по
  // первым: иначе режим «решай до верного ответа» показывал бы 50% там, где
  // тема на самом деле освоена.
  const attemptNo = Array.isArray(hw.student_answers) && hw.student_answers.length ? 2 : 1
  // Доработка присылает и принятые ответы — они уже записаны первой попыткой,
  // второй раз в журнал не идут: иначе один ответ считался бы дважды и растянул
  // бы историю по типажу.
  const kept = hw.status === "revision" && Array.isArray(hw.student_answers) ? hw.student_answers : null

  const out = []
  ;(answers || []).forEach((ans, i) => {
    const given = String(ans || "").trim()
    const task = bank[i]
    // Не отвечал — это пропуск, а не ошибка. Задание без предмета и номера
    // (работа из файла, которой номера не проставили) в журнал не идёт.
    if (!given || !task?.exam_type || task.number == null) return
    if (String(kept?.[i] ?? "").trim() !== "") return
    out.push({
      p_account: account,
      p_token: token,
      // Нужен id ученика У РЕПЕТИТОРА: по нему джойнит и RLS, и вся аналитика.
      p_student_id: studentId != null ? String(studentId) : null,
      p_source: "homework",
      p_source_id: hw.id,
      p_exam_type: task.exam_type,
      p_number: task.number,
      // Ключа типажа у задания из файла нет и быть не может — генератора за ним
      // не стоит. Колонка это допускает (null = «не из генератора»), а своды по
      // номерам такие строки считают наравне с остальными.
      p_gen_key: task.gen_key || null,
      p_is_correct: answersEqual(given, correct[i]),
      p_answer: given,
      p_attempt_no: attemptNo,
    })
  })
  return out
}
