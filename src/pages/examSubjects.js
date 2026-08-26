import { hasGenerators, generateTask, taskThemes } from "./taskGenerators"
import { MAX_NUMBER, SUBJECT_TO_TYPE } from "./examSubjectList"

// Всё, что требует самих генераторов. Список предметов и подписи живут в
// examSubjectList.js (без импорта генераторов) и переэкспортируются отсюда,
// чтобы места, которым нужен и список, и выдача задания, обходились одним
// импортом, как раньше.
export {
  EXAM_GROUPS, MAX_NUMBER, levelOf, subjectOf, subjectLabel,
  subjectGroups, firstType, SUBJECT_TO_TYPE, typesFromProfile,
} from "./examSubjectList"

// Номера, для которых у предмета есть генераторы.
export function numbersWithGen(examType) {
  const out = []
  for (let n = 1; n <= MAX_NUMBER; n++) if (hasGenerators(examType, n)) out.push(n)
  return out
}

// Одно задание нужного типажа. null — генератора нет или он упал: вызывающий показывает
// это пользователем, а не роняет экран.
export function genTask(examType, number, genKey) {
  try { return generateTask(examType, number, genKey) || null } catch { return null }
}

// Случайный типаж внутри темы — чтобы подряд не выпадала одна и та же задача.
export function genThemeTask(examType, number, theme) {
  const g = (taskThemes(examType, number) || []).find((t) => t.theme === theme)
  if (!g?.items.length) return null
  return genTask(examType, number, g.items[Math.floor(Math.random() * g.items.length)].key)
}

// Тип банка по анкете репетитора — только если генераторы у него правда есть:
// иначе выбор задания открылся бы на пустом предмете.
export function examTypeForSubject(subject, examFocus = []) {
  const byLevel = SUBJECT_TO_TYPE[subject]
  if (!byLevel) return null
  const focus = Array.isArray(examFocus) ? examFocus : []
  const level = focus.includes("ЕГЭ") && byLevel["ЕГЭ"] ? "ЕГЭ" : "ОГЭ"
  const type = byLevel[level] || byLevel["ОГЭ"] || byLevel["ЕГЭ"]
  return type && numbersWithGen(type).length ? type : null
}

// Предметы репетитора → первый, у которого есть генераторы. Нужен, когда предмет
// выбирают из отфильтрованного списка: отмеченный предмет может оказаться без
// заведённых номеров, и открываться на нём нечем.
export function firstTypeWithGen(groups, fallback = "ОГЭ") {
  for (const g of groups || []) {
    for (const s of g.subjects) if (numbersWithGen(s.type).length) return s.type
  }
  return groups?.[0]?.subjects?.[0]?.type || fallback
}
