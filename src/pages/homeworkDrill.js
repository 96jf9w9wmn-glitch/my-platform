// Работа из клонов одного типажа: «ещё восемь таких же» — но не листом на
// печать, а домашней работой в кабинете ученика.
//
// Раньше «Где ученик ошибается» умело только скачивать PDF репетитору, и на
// этом след обрывался: решённое обратно в платформу не возвращалось, процент у
// строки не двигался, слабое место закрыть было нечем. Теперь тот же ключ
// типажа собирает обычную домашнюю работу — ученик решает её в кабинете,
// попытки уходят в task_attempts, и строка уходит из списка сама, когда
// точность поднимется выше порога.
//
// Отдельным модулем, потому что тянет генераторы (несколько мегабайт):
// WeakTypes подгружает его динамически, только когда репетитор нажал кнопку.
import { supabase } from "../supabase"
import { hasAttachment, isSimpleAnswer, oneLine } from "../utils"
import { drillTasks, packTask, taskText } from "./homeworkBank"

// Выдать собранное ученику. Возвращает { count } либо { error } с текстом,
// который можно показать репетитору: молчаливый отказ здесь недопустим —
// репетитор решит, что работа ушла, а её нет.
export async function assignDrill({ student, examType, number, genKey, title, size }) {
  const tasks = drillTasks({ examType, number, genKey, size })
  if (!tasks.length) return { error: "Задания этого вида не собрались" }

  const answers = tasks.map((t) => String(t.answer ?? "").trim())
  // Автопроверка — только когда ученик способен набрать все ответы с
  // клавиатуры. Иначе работа уходит письменной: обещанная и не случившаяся
  // проверка хуже, чем её отсутствие.
  const testable = answers.every(isSimpleAnswer)

  const payload = {
    tutor_id: student.tutor_id,
    student_id: Number(student.id),
    title,
    description: tasks.map((t, i) => `${i + 1}. ${oneLine(taskText(t))}`).join("\n"),
    hw_type: testable ? "test" : "written",
    question_count: testable ? answers.length : null,
    correct_answers: testable ? answers : null,
    test_options: null,
    require_solution: false,
    // Чертёж, программа, архив и таблица едут к ученику целиком. В description
    // те же условия лежат текстом, поэтому список работ, бот и старые записи
    // ничего не замечают. Колонку добавляет supabase/homework_bank_tasks.sql.
    bank_tasks: tasks.map(packTask),
  }

  window.__drillPayload = payload
  const insert = (body) => supabase.from("homework").insert({ ...body, status: "assigned" })
  let { error } = await insert(payload)
  // Миграции homework_bank_tasks.sql может не быть на этой базе. Работу всё
  // равно выдаём — но только если терять нечего: задания без чертежей и файлов
  // полностью описаны текстом в description. Если терять есть что, выдача
  // останавливается, иначе ученик получит «На рисунке изображён график» без
  // самого рисунка.
  if (error && /bank_tasks/.test(error.message || "")) {
    if (tasks.some(hasAttachment)) {
      return { error: "Задания с чертежом негде хранить: выполните supabase/homework_bank_tasks.sql" }
    }
    const plain = { ...payload }
    delete plain.bank_tasks
    ;({ error } = await insert(plain))
  }
  if (error) return { error: "Не получилось выдать: " + error.message }

  // Уведомление — best-effort: работа уже выдана, и сбой колокольчика не повод
  // говорить репетитору, что ничего не вышло.
  if (student.studentAccountId) {
    await supabase.from("notifications").insert({
      user_id: student.studentAccountId,
      title: "Новое домашнее задание",
      body: title,
    })
  }
  return { count: tasks.length }
}
