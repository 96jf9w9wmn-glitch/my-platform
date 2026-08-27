// Сборка домашнего задания из банка: выбранные номера ОГЭ/ЕГЭ и темы → готовые
// задания с ответами (приём «Решу ЕГЭ»: сам укажи номер, тему и количество).
//
// Отдельным модулем, потому что тянет за собой все генераторы (несколько мегабайт):
// Homework.jsx подгружает его динамически и только когда репетитор открыл эту
// вкладку — иначе бы вес генераторов попал в основной бандл кабинета.
import { EXAM_GROUPS, numbersWithGen, subjectLabel, genTask, genThemeTask } from "./examSubjects"
import { taskThemes } from "./taskGenerators"
import { numberTitle } from "./numberTitles"

export { EXAM_GROUPS, numbersWithGen, subjectLabel, taskThemes }

// Номер целиком: подпись раздела и его темы с количеством типажей — из этого
// собран список номеров в сборке ДЗ.
export function numberInfo(examType, number) {
  const themes = taskThemes(examType, number) || []
  return { number, title: numberTitle(examType, number, themes), themes }
}

// Условие целиком: у части заданий вопрос вынесен в отдельную строку под
// картинкой. Нужен там, где задание показывается ОДНОЙ строкой текста — в
// описании домашней работы и в списке собранного.
export const taskText = (t) =>
  [t.condition_text, t.condition_tail].filter(Boolean).map((x) => String(x).trim()).join(" ")

// Что уходит в базу вместе с работой (homework.bank_tasks). Отбираем поля
// поимённо: у сгенерированного задания есть и служебное (id, generated), и
// решение с ответом на будущее (solution, solution_image, answerProgram) —
// ученику это отдавать нельзя, он увидел бы ответ в исходном коде страницы.
// exam_type нужен не для показа, а для журнала попыток: без предмета строку в
// task_attempts не записать, а без неё тема не попадёт ни в «Слабые типажи»,
// ни в отчёт родителю.
const KEEP = ["number", "exam_type", "condition_text", "condition_tail", "answer", "gen_key",
  "image_url", "program", "archive", "spreadsheet", "textFile", "source_text", "source_title"]

export const packTask = (t) =>
  Object.fromEntries(KEEP.filter((k) => t[k] !== undefined && t[k] !== null).map((k) => [k, t[k]]))

// Признак «это то же самое задание». Раньше сравнивали только текст условия, и
// этого хватало, пока в сборку шли одни текстовые задания. Теперь идут и
// чертёжные, а у них условие часто дословно одинаковое («На рисунке изображён
// график…») при совершенно разных рисунках — по одному тексту второе задание
// номера уже не нашлось бы.
const taskKey = (t) => JSON.stringify([taskText(t), t.image_url, t.program, t.archive,
  t.spreadsheet, t.textFile, t.source_text, t.answer])

// Одно задание номера: со свежими числами и не повторяющее уже собранные.
// null — за 30 попыток ничего нового не вышло (у номера мало типажей).
export function pickTask(examType, number, themes, seen) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const t = themes && themes.length
      ? genThemeTask(examType, number, themes[Math.floor(Math.random() * themes.length)])
      : genTask(examType, number)
    if (!t || !taskText(t)) continue
    const key = taskKey(t)
    if (seen && seen.has(key)) continue
    seen?.add(key)
    return t
  }
  return null
}

// Задания по выбору репетитора: picks — [{ number, themes, count }], сколько
// заданий каждого номера. Порядок сохраняется: сначала все задания первого
// номера, потом второго — так же, как они перечислены в списке.
//
// Номер, который дал меньше запрошенного (свежие условия кончились), попадает
// в short — интерфейс скажет об этом честно, а не подсунет молча работу короче
// заказанной.
export function assembleHomework({ examType, picks }) {
  const tasks = []
  const short = []
  const seen = new Set()
  for (const p of picks || []) {
    if (!Number.isFinite(p.number) || !(p.count > 0)) continue
    let got = 0
    while (got < p.count) {
      const t = pickTask(examType, p.number, p.themes, seen)
      if (!t) break
      tasks.push(t)
      got++
    }
    if (got < p.count) short.push({ number: p.number, got, want: p.count })
  }
  return { tasks, short }
}
