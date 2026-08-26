// Сборка домашнего задания из банка: выбранные номера ОГЭ/ЕГЭ и темы → готовые
// задания с ответами (приём «РешуЕГЭ»: сам укажи номер, тему и количество).
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

// Темы номера, из которых нельзя собрать текстовое задание (всё с чертежом или
// файлом). Проверяем пробой генераторов, когда номер раскрыли: тема сразу видна
// недоступной, а не молча выпадает из сборки.
export function badThemes(examType, number) {
  return (taskThemes(examType, number) || [])
    .map((g) => g.theme)
    .filter((theme) => !pickTextTask(examType, number, [theme], new Set()))
}

// Задания по выбору репетитора: picks — [{ number, themes, count }], сколько
// заданий каждого номера. Порядок сохраняется: сначала все задания первого
// номера, потом второго — так же, как они перечислены в списке.
//
// Номер, который дал меньше запрошенного (все задания оказались с чертежом или
// свежие условия кончились), попадает в short — интерфейс скажет об этом
// честно, а не подсунет молча работу короче заказанной.
export function assembleHomework({ examType, picks }) {
  const tasks = []
  const short = []
  const seen = new Set()
  for (const p of picks || []) {
    if (!Number.isFinite(p.number) || !(p.count > 0)) continue
    let got = 0
    while (got < p.count) {
      const t = pickTextTask(examType, p.number, p.themes, seen)
      if (!t) break
      tasks.push(t)
      got++
    }
    if (got < p.count) short.push({ number: p.number, got, want: p.count })
  }
  return { tasks, short }
}
