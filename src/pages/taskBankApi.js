import { supabase } from "../supabase"
import { hasGenerators, generateTask } from "./taskGenerators"
import { hasModules, buildModuleTasks, moduleExamTypes } from "./taskModules"
import { normalizeTaskImage } from "../utils"
import { PART2_NUMBERS, MODULE_EXAM_TYPES, part1NumbersOf, part2NumbersOf, VARIANT_TYPES } from "./taskBankMeta"
import { makeAnswerChoices, choiceBaseOf } from "./answerChoices"
// Реэкспорт: «Варианты» берут построитель вариантов ответа из банка и не знают,
// что он живёт отдельным лёгким модулем.
export { makeAnswerChoices, choiceBaseOf } from "./answerChoices"

// «Лечит» image_url строк банка, сохранённых до разворота мат-токенов (иначе в подписи чертежа
// виден сырой «4⟦r:2⟧»). Идемпотентно для новых строк без токенов.
const healImages = (rows) => (rows || []).map((t) => t?.image_url ? { ...t, image_url: normalizeTaskImage(t.image_url) } : t)

const PART2_NUMBERS_BY_TYPE = PART2_NUMBERS

// Заданию части 2 добавляются варианты ответа: балл всё равно ставит репетитор по
// фотографии решения, но выбор фиксирует, к чему ученик пришёл, и даёт ему сверку.
// Раньше это делалось только для ОГЭ, и у части 2 ЕГЭ выбора не было вовсе. У ЕГЭ
// ответ двухчастный, поэтому выбор строится по пункту б) (choiceBaseOf), а его буква
// едет вместе с вариантами — иначе ученик не поймёт, что именно выбирает.
// Ответ без чисел (доказательства ОГЭ №24, «да/нет» с обоснованием) вариантов не
// получает — makeAnswerChoices вернёт null, и задание остаётся только с фото.
const withChoices = (examType, t) => {
  if (!t || t.choices || !PART2_NUMBERS_BY_TYPE[examType]?.includes(t.number)) return t
  const choices = makeAnswerChoices(t.answer)
  if (!choices) return t
  return { ...t, choices, choices_part: choiceBaseOf(t.answer).part }
}

export { isModuleNumber } from "./taskBankMeta"

// Лёгкий список типов с модулями в taskBankMeta.js дублирует MODULES — при расхождении
// «Варианты» подписали бы кнопку замены не тем текстом. Ловим это при разработке.
if (import.meta.env?.DEV) {
  const real = moduleExamTypes()
  if (real.length !== MODULE_EXAM_TYPES.length || real.some((t) => !MODULE_EXAM_TYPES.includes(t)))
    console.warn("MODULE_EXAM_TYPES в taskBankMeta.js разошёлся с MODULES:", real, MODULE_EXAM_TYPES)
}

// Одно задание номера. Прилагаемые файлы (архив, таблица, файл с текстом) больше
// НЕ отсеиваются: вариант решается в кабинете, и файл там открывается так же, как
// в домашней работе. До 01.09.2026 здесь стоял фильтр needsFile, из-за которого
// вариант КЕГЭ выходил из 17 заданий вместо 27.
function pickTask(examType, number) {
  for (let i = 0; i < 12; i++) {
    const t = generateTask(examType, number)
    if (t) return t
  }
  return null
}

// Связка заданий с общим условием: в КИМ по информатике №19–21 — ОДНА игра,
// её описание стоит у №19, а №20 и №21 начинаются со ссылки «Для игры, описанной
// в задании 19, …». В банке ФИПИ каждое задание самостоятельное и несёт описание
// целиком — иначе его нельзя выдать по одному, — поэтому склейка делается здесь,
// при сборке варианта, и уезжает уже в снимок: и печатный лист, и кабинет ученика
// читают готовый текст и про связку ничего не знают.
//
// Задание объявляет связку тремя полями: intro (описание), introGroup (ключ этой
// конкретной игры — у разных наборов чисел он разный) и introRef (начало ссылки).
function linkSharedIntros(picked) {
  const firstOf = new Map()
  for (const t of picked) {
    if (!t?.introGroup || !t.intro || !t.introRef) continue
    const first = firstOf.get(t.introGroup)
    if (first === undefined) { firstOf.set(t.introGroup, t.number); continue }
    const text = String(t.condition_text || "")
    // Хвост отрезаем по самой преамбуле, а не по её длине: если генератор её
    // изменил, лучше оставить условие целиком, чем срезать половину вопроса.
    if (!text.startsWith(t.intro)) continue
    const rest = text.slice(t.intro.length).trim()
    if (!rest) continue
    t.condition_text = `${t.introRef} ${first}, ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`
  }
  return picked
}

// Собирает один вариант из банка: по одному случайному заданию на каждый номер части 1
// и (для ОГЭ) части 2. Задания 1–5 (для ОГЭ) — единый практический модуль (buildModuleTasks).
// Номера с генераторами собираются кодом; остальные берутся из таблицы `tasks`. Заданиям
// части 2 добавляются 4 варианта ответа (withChoices). missing — номера, для которых нет
// ни модуля, ни генератора, ни строк в банке.
export async function assembleFromBank(examType) {
  if (!VARIANT_TYPES.includes(examType)) throw new Error(`Неизвестный тип экзамена: ${examType}`)
  const part1Numbers = part1NumbersOf(examType)
  const count = part1Numbers.length
  const part2Numbers = part2NumbersOf(examType)
  const { data: pool } = await supabase.from("tasks").select("*").eq("exam_type", examType)
  const byNumber = {}
  for (const t of healImages(pool)) {
    (byNumber[t.number] ||= []).push(t)
  }
  const moduleTasks = hasModules(examType) ? buildModuleTasks(examType) : null
  const moduleByNum = new Map((moduleTasks || []).map((t) => [t.number, t]))
  const picked = []
  const missing = []
  const numbers = [...part1Numbers, ...part2Numbers]
  for (const n of numbers) {
    if (moduleByNum.has(n)) { picked.push(moduleByNum.get(n)); continue }
    if (hasGenerators(examType, n)) {
      const t = pickTask(examType, n)
      if (t) { picked.push(withChoices(examType, t)); continue }
      missing.push(n)
      continue
    }
    const options = byNumber[n]
    if (!options?.length) { missing.push(n); continue }
    picked.push(withChoices(examType, options[Math.floor(Math.random() * options.length)]))
  }
  return { picked: linkSharedIntros(picked), missing, count, part1Numbers, part2Numbers }
}

// Пересобирает весь практический модуль 1–5 (задания взаимозависимы — нельзя менять одно).
export function rerollModule(examType) {
  return buildModuleTasks(examType)
}

// Пересобрать связку целиком: №19–21 — одна игра, поодиночке их менять нельзя
// (см. LINKED_GROUPS в taskBankMeta.js).
export function rerollLinked(examType, numbers) {
  const picked = []
  for (const n of numbers) {
    const t = pickTask(examType, n)
    if (t) picked.push(t)
  }
  return linkSharedIntros(picked)
}

export async function rerollTask(examType, number, excludeId) {
  if (hasGenerators(examType, number)) return withChoices(examType, generateTask(examType, number))
  const { data: options } = await supabase.from("tasks").select("*").eq("exam_type", examType).eq("number", number)
  const healed = healImages(options)
  const pool = healed.filter((t) => t.id !== excludeId)
  if (!pool.length) return withChoices(examType, healed[0] || null)
  return withChoices(examType, pool[Math.floor(Math.random() * pool.length)])
}

export { PART2_NUMBERS } from "./taskBankMeta"
