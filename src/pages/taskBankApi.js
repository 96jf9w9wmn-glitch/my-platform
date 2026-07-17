import { supabase } from "../supabase"
import { hasGenerators, generateTask } from "./taskGenerators"
import { hasModules, generateModule } from "./taskModules"
import { normalizeTaskImage } from "../utils"

// «Лечит» image_url строк банка, сохранённых до разворота мат-токенов (иначе в подписи чертежа
// виден сырой «4⟦r:2⟧»). Идемпотентно для новых строк без токенов.
const healImages = (rows) => (rows || []).map((t) => t?.image_url ? { ...t, image_url: normalizeTaskImage(t.image_url) } : t)

const NUMBERS_BY_TYPE = { "ОГЭ": 19, "ЕГЭ": 12, "ЕГЭ Профиль": 12 }
const MODULE_COUNT = 5   // задания 1–5 — связанный практический модуль (общий текст + рисунок)

// Номер входит в практический модуль №1–5 (когда для типа экзамена есть модули).
export function isModuleNumber(examType, number) {
  return hasModules(examType) && number >= 1 && number <= MODULE_COUNT
}

// Генерирует модуль №1–5 (случайный сценарий) и разворачивает его в 5 «плоских» заданий,
// совместимых со схемой банка (number/condition_text/image_url/answer). Формат «5 отдельных»:
// общий вводный текст приклеивается к заданию 1, общие иллюстрации сценария раскидываются по
// первым заданиям без собственной картинки (график→1, таблица→2 и т.п.), чтобы у «Тарифов»/
// «Шин» не терялась вторая картинка и вариант оставался решаемым.
export function buildModuleTasks(examType) {
  let mod = null
  for (let i = 0; i < 5 && !mod; i++) {
    try { mod = generateModule(examType) } catch { mod = null }
  }
  if (!mod || !mod.tasks?.length) return null
  // общий вводный текст (у «Шин» он в двух частях — intro + introRest) идёт перед заданием 1
  const preamble = [mod.intro, mod.introRest].filter(Boolean).join("\n")
  const tasks = mod.tasks.map((q, i) => ({
    id: `mod-${mod.scenario}-${q.number}-${Math.random().toString(36).slice(2, 8)}`,
    number: q.number,
    exam_type: examType,
    condition_text: i === 0 && preamble ? `${preamble}\n\n${q.condition_text}` : q.condition_text,
    image_url: q.image_url ?? null,
    answer: q.answer,
    generated: true,
    module: true,
  }))
  const shared = [mod.image_url, mod.image_url2].filter(Boolean)
  let si = 0
  for (const img of shared) {
    while (si < tasks.length && tasks[si].image_url) si++
    if (si >= tasks.length) break
    tasks[si].image_url = img
    si++
  }
  return tasks
}

// Собирает один вариант из банка: по одному случайному заданию на каждый номер части 1.
// Задания 1–5 (для ОГЭ) — единый практический модуль (buildModuleTasks). Номера с одиночными
// генераторами (напр. ОГЭ №10) собираются кодом; остальные берутся из таблицы `tasks`.
// missing — номера, для которых нет ни модуля, ни генератора, ни строк в банке.
export async function assembleFromBank(examType) {
  const count = NUMBERS_BY_TYPE[examType]
  if (!count) throw new Error(`Неизвестный тип экзамена: ${examType}`)
  const { data: pool } = await supabase.from("tasks").select("*").eq("exam_type", examType)
  const byNumber = {}
  for (const t of healImages(pool)) {
    (byNumber[t.number] ||= []).push(t)
  }
  const moduleTasks = hasModules(examType) ? buildModuleTasks(examType) : null
  const moduleByNum = new Map((moduleTasks || []).map((t) => [t.number, t]))
  const picked = []
  const missing = []
  for (let n = 1; n <= count; n++) {
    if (moduleByNum.has(n)) { picked.push(moduleByNum.get(n)); continue }
    if (hasGenerators(examType, n)) { picked.push(generateTask(examType, n)); continue }
    const options = byNumber[n]
    if (!options?.length) { missing.push(n); continue }
    picked.push(options[Math.floor(Math.random() * options.length)])
  }
  return { picked, missing, count }
}

// Пересобирает весь практический модуль 1–5 (задания взаимозависимы — нельзя менять одно).
export function rerollModule(examType) {
  return buildModuleTasks(examType)
}

export async function rerollTask(examType, number, excludeId) {
  if (hasGenerators(examType, number)) return generateTask(examType, number)
  const { data: options } = await supabase.from("tasks").select("*").eq("exam_type", examType).eq("number", number)
  const healed = healImages(options)
  const pool = healed.filter((t) => t.id !== excludeId)
  if (!pool.length) return healed[0] || null
  return pool[Math.floor(Math.random() * pool.length)]
}

export const TASK_NUMBERS_BY_TYPE = NUMBERS_BY_TYPE
