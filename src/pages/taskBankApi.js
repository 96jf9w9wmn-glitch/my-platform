import { supabase } from "../supabase"
import { hasGenerators, generateTask } from "./taskGenerators"
import { hasModules, generateModule } from "./taskModules"
import { normalizeTaskImage } from "../utils"

// «Лечит» image_url строк банка, сохранённых до разворота мат-токенов (иначе в подписи чертежа
// виден сырой «4⟦r:2⟧»). Идемпотентно для новых строк без токенов.
const healImages = (rows) => (rows || []).map((t) => t?.image_url ? { ...t, image_url: normalizeTaskImage(t.image_url) } : t)

const NUMBERS_BY_TYPE = { "ОГЭ": 19, "ЕГЭ": 12, "ЕГЭ Профиль": 12 }
// Номера части 2, входящие в собранный вариант (у ЕГЭ в приложении части 2 пока нет).
const PART2_NUMBERS_BY_TYPE = { "ОГЭ": [20, 21, 22, 23, 24, 25] }
const MODULE_COUNT = 5   // задания 1–5 — связанный практический модуль (общий текст + рисунок)

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const NUM_RE = /[−-]?\d+(?:[.,]\d+)?/g

// Шаг возмущения числа в ответе: у десятичных — последний разряд («0,6» → ±0,1),
// у целых — 1, у крупных целых (скорости, площади) — 5, чтобы дистрактор был правдоподобен.
function perturbStep(tok) {
  const frac = (tok.split(/[.,]/)[1] || "").length
  if (frac > 0) return Math.pow(10, -frac)
  return Math.abs(parseFloat(tok.replace(",", ".").replace("−", "-"))) >= 30 ? 5 : 1
}

// Сдвигает числовой токен на delta, сохраняя формат: десятичную запятую, число знаков
// после запятой и стиль минуса исходного ответа (в №20 — математический U+2212).
function perturbToken(tok, delta, minus) {
  const frac = (tok.split(/[.,]/)[1] || "").length
  const comma = tok.includes(",")
  const v = parseFloat(tok.replace(",", ".").replace("−", "-")) + delta
  let out = Math.abs(v).toFixed(frac)
  if (comma) out = out.replace(".", ",")
  return (v < 0 ? minus : "") + out
}

// Дистрактор не должен выдавать себя: отсеиваем вырожденные варианты — двойное неравенство
// с перевёрнутыми границами («2 < m < 1» — пустое множество) и повтор части составного
// ответа («m = −5; m = −5»).
function plausibleChoice(cand) {
  for (const m of cand.matchAll(/([−-]?\d+(?:[.,]\d+)?)\s*[<⩽≤]\s*[a-zа-яё]+\s*[<⩽≤]\s*([−-]?\d+(?:[.,]\d+)?)/gi)) {
    const a = parseFloat(m[1].replace(",", ".").replace("−", "-"))
    const b = parseFloat(m[2].replace(",", ".").replace("−", "-"))
    if (!(a < b)) return false
  }
  const parts = cand.split(/;\s*/)
  if (parts.length > 1 && new Set(parts.map((p) => p.trim())).size !== parts.length) return false
  return true
}

// Четыре варианта ответа для задания части 2: правильный + три правдоподобных дистрактора
// (возмущение чисел правильного ответа). Работает и для составных ответов («−4; 1», «12/5»,
// «3√2», «6 и 4»). Текстовые ответы без чисел (доказательства №24) вариантов не получают — null.
export function makeAnswerChoices(answer) {
  const src = String(answer ?? "").trim()
  if (!src || src.length > 60) return null
  const tokens = [...src.matchAll(NUM_RE)]
  if (!tokens.length) return null
  const minus = src.includes("−") ? "−" : "-"
  const seen = new Set([src])
  const cands = []
  outer: for (const k of [1, -1, 2, -2, 3, -3]) {
    for (const m of tokens) {
      const orig = parseFloat(m[0].replace(",", ".").replace("−", "-"))
      const shifted = orig + k * perturbStep(m[0])
      // положительное число (длина, скорость, площадь) не делаем отрицательным — такой
      // дистрактор неправдоподобен и выдаёт себя
      if (orig >= 0 && shifted < 0) continue
      const next = perturbToken(m[0], k * perturbStep(m[0]), minus)
      const cand = src.slice(0, m.index) + next + src.slice(m.index + m[0].length)
      if (!seen.has(cand) && plausibleChoice(cand)) { seen.add(cand); cands.push(cand) }
      if (cands.length >= 6) break outer
    }
  }
  if (cands.length < 3) return null
  return shuffle([src, ...shuffle(cands).slice(0, 3)])
}

// Заданию части 2 добавляются варианты ответа (ученик выбирает один из четырёх в кабинете).
const withChoices = (examType, t) =>
  t && PART2_NUMBERS_BY_TYPE[examType]?.includes(t.number) && !t.choices
    ? { ...t, choices: makeAnswerChoices(t.answer) }
    : t

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

// Собирает один вариант из банка: по одному случайному заданию на каждый номер части 1
// и (для ОГЭ) части 2. Задания 1–5 (для ОГЭ) — единый практический модуль (buildModuleTasks).
// Номера с генераторами собираются кодом; остальные берутся из таблицы `tasks`. Заданиям
// части 2 добавляются 4 варианта ответа (withChoices). missing — номера, для которых нет
// ни модуля, ни генератора, ни строк в банке.
export async function assembleFromBank(examType) {
  const count = NUMBERS_BY_TYPE[examType]
  if (!count) throw new Error(`Неизвестный тип экзамена: ${examType}`)
  const part2Numbers = PART2_NUMBERS_BY_TYPE[examType] || []
  const { data: pool } = await supabase.from("tasks").select("*").eq("exam_type", examType)
  const byNumber = {}
  for (const t of healImages(pool)) {
    (byNumber[t.number] ||= []).push(t)
  }
  const moduleTasks = hasModules(examType) ? buildModuleTasks(examType) : null
  const moduleByNum = new Map((moduleTasks || []).map((t) => [t.number, t]))
  const picked = []
  const missing = []
  const numbers = [...Array.from({ length: count }, (_, i) => i + 1), ...part2Numbers]
  for (const n of numbers) {
    if (moduleByNum.has(n)) { picked.push(moduleByNum.get(n)); continue }
    if (hasGenerators(examType, n)) { picked.push(withChoices(examType, generateTask(examType, n))); continue }
    const options = byNumber[n]
    if (!options?.length) { missing.push(n); continue }
    picked.push(withChoices(examType, options[Math.floor(Math.random() * options.length)]))
  }
  return { picked, missing, count, part2Numbers }
}

// Пересобирает весь практический модуль 1–5 (задания взаимозависимы — нельзя менять одно).
export function rerollModule(examType) {
  return buildModuleTasks(examType)
}

export async function rerollTask(examType, number, excludeId) {
  if (hasGenerators(examType, number)) return withChoices(examType, generateTask(examType, number))
  const { data: options } = await supabase.from("tasks").select("*").eq("exam_type", examType).eq("number", number)
  const healed = healImages(options)
  const pool = healed.filter((t) => t.id !== excludeId)
  if (!pool.length) return withChoices(examType, healed[0] || null)
  return withChoices(examType, pool[Math.floor(Math.random() * pool.length)])
}

export const TASK_NUMBERS_BY_TYPE = NUMBERS_BY_TYPE
export const PART2_NUMBERS = PART2_NUMBERS_BY_TYPE
