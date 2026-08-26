// Сборка домашнего задания из банка: выбранные номера ОГЭ/ЕГЭ и темы → готовые
// задания с ответами (приём «РешуЕГЭ»: сам укажи номер, тему и количество).
//
// Отдельным модулем, потому что тянет за собой все генераторы (несколько мегабайт):
// Homework.jsx подгружает его динамически и только когда репетитор открыл эту
// вкладку — иначе бы вес генераторов попал в основной бандл кабинета.
import { EXAM_GROUPS, numbersWithGen, subjectLabel, genTask, genThemeTask } from "./examSubjects"
import { taskThemes } from "./taskGenerators"

export { EXAM_GROUPS, numbersWithGen, subjectLabel, taskThemes }

// Домашнее задание хранит условия ОДНОЙ строкой текста, поэтому в сборку идут
// только самодостаточные задания: без чертежа (image_url), без прилагаемых файлов
// (archive/spreadsheet/textFile), без блоков кода (program) и без общего текста для
// чтения (source_text) — всему этому в строке взяться неоткуда, и задание приехало
// бы к ученику покалеченным. Если у номера таких заданий нет вовсе, возвращаем null,
// и вызывающий честно скажет, что номер пропущен.
const isSelfContained = (t) =>
  t && !t.image_url && !t.archive && !t.spreadsheet && !t.textFile && !t.program && !t.source_text

// Условие целиком: у части заданий вопрос вынесен в отдельную строку под картинкой.
export const taskText = (t) =>
  [t.condition_text, t.condition_tail].filter(Boolean).map((x) => String(x).trim()).join(" ")

export function pickTextTask(examType, number, themes, seen) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const t = themes && themes.length
      ? genThemeTask(examType, number, themes[Math.floor(Math.random() * themes.length)])
      : genTask(examType, number)
    if (!isSelfContained(t)) continue
    const text = taskText(t)
    if (!text) continue
    if (seen && seen.has(text)) continue     // не выдавать одно и то же условие дважды
    seen?.add(text)
    return t
  }
  return null
}

// Набор заданий по кругу из выбранных номеров: 3 номера и 6 заданий → по два на
// каждый. Номер, у которого не нашлось ни одного текстового задания, выбывает и
// попадает в skipped — интерфейс перечислит такие номера.
export function assembleHomework({ examType, numbers, themes, count }) {
  const live = numbers.filter((n) => Number.isFinite(n))
  const skipped = []
  const tasks = []
  const seen = new Set()
  let i = 0
  while (tasks.length < count && live.length) {
    const n = live[i % live.length]
    const t = pickTextTask(examType, n, themes, seen)
    if (!t) {
      skipped.push(n)
      live.splice(live.indexOf(n), 1)
      i = 0
      continue
    }
    tasks.push(t)
    i++
  }
  return { tasks, skipped }
}
