import { hasGenerators, generateTask, taskThemes } from "./taskGenerators"

// Список предметов банка — общий для всех мест, где предмет выбирают: страница
// «Банк заданий», рабочая тетрадь и вставка задания на доску. Держать его в одном
// месте обязательно: type — ключ генераторов (не менять), label — короткая подпись,
// dot — цвет акцента. Разъедутся копии — предмет появится в одном списке и пропадёт
// в другом.
export const EXAM_GROUPS = [
  {
    key: "ЕГЭ",
    subjects: [
      { type: "ЕГЭ", label: "Математика база", dot: "bg-blue-500" },
      { type: "ЕГЭ Профиль", label: "Математика профиль", dot: "bg-indigo-500" },
      { type: "ЕГЭ Информатика", label: "Информатика", dot: "bg-cyan-500" },
    ],
  },
  {
    key: "ОГЭ",
    subjects: [
      { type: "ОГЭ", label: "Математика", dot: "bg-blue-500" },
      { type: "ОГЭ Русский", label: "Русский", dot: "bg-rose-500" },
      { type: "ОГЭ Английский", label: "Английский", dot: "bg-red-500" },
      { type: "ОГЭ Информатика", label: "Информатика", dot: "bg-cyan-500" },
      { type: "ОГЭ Физика", label: "Физика", dot: "bg-violet-500" },
      { type: "ОГЭ Химия", label: "Химия", dot: "bg-emerald-500" },
      { type: "ОГЭ Биология", label: "Биология", dot: "bg-green-500" },
      { type: "ОГЭ Обществознание", label: "Обществознание", dot: "bg-amber-500" },
      { type: "ОГЭ История", label: "История", dot: "bg-orange-500" },
      { type: "ОГЭ Литература", label: "Литература", dot: "bg-fuchsia-500" },
      { type: "ОГЭ География", label: "География", dot: "bg-teal-500" },
    ],
  },
]

export const MAX_NUMBER = 38   // англ. идёт до №38 (устная часть); numbersWithGen отсекает пустые

// Уровень (ЕГЭ / ОГЭ), к которому относится предмет.
export function levelOf(type) {
  const g = EXAM_GROUPS.find((grp) => grp.subjects.some((s) => s.type === type))
  return g ? g.key : "ОГЭ"
}

// Подпись предмета целиком: «ОГЭ Математика», «ЕГЭ Математика профиль».
export function subjectLabel(type) {
  const level = levelOf(type)
  const s = EXAM_GROUPS.find((g) => g.key === level)?.subjects.find((x) => x.type === type)
  return s ? `${level} ${s.label}` : type
}

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

// Предмет из анкеты репетитора («Математика», «Физика», …) + к каким экзаменам он
// готовит → тип банка. Нужно, чтобы выбор задания на доске открывался сразу на своём
// предмете, а не на «ОГЭ Математика» по умолчанию: репетитор ведёт один предмет и
// каждый раз выбирал его заново.
const SUBJECT_TO_TYPE = {
  "Математика": { "ОГЭ": "ОГЭ", "ЕГЭ": "ЕГЭ Профиль" },
  "Русский язык": { "ОГЭ": "ОГЭ Русский" },
  "Английский язык": { "ОГЭ": "ОГЭ Английский" },
  "Физика": { "ОГЭ": "ОГЭ Физика" },
  "Химия": { "ОГЭ": "ОГЭ Химия" },
  "Обществознание": { "ОГЭ": "ОГЭ Обществознание" },
  "Информатика": { "ОГЭ": "ОГЭ Информатика", "ЕГЭ": "ЕГЭ Информатика" },
}
export function examTypeForSubject(subject, examFocus = []) {
  const byLevel = SUBJECT_TO_TYPE[subject]
  if (!byLevel) return null
  const focus = Array.isArray(examFocus) ? examFocus : []
  // «Успеваемость» уровня банка не задаёт — берём тот, к которому готовят
  const level = focus.includes("ЕГЭ") && byLevel["ЕГЭ"] ? "ЕГЭ" : "ОГЭ"
  const type = byLevel[level] || byLevel["ОГЭ"] || byLevel["ЕГЭ"]
  return type && numbersWithGen(type).length ? type : null
}
