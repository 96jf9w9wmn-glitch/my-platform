// Считает реальные размеры банка заданий и записывает их в src/pages/bankStats.js,
// откуда цифры берёт лендинг. Смысл: цифры на витрине должны считаться из кода,
// а не быть вписаны руками — иначе они устаревают и превращаются в рекламу.
//
// Запуск из корня репозитория:
//   node scripts/bank-stats.mjs
//
// Грузим генераторы так же, как fipi-smoke: через vite в SSR-режиме, потому что
// taskGenerators.js — обычный ESM-модуль приложения со всеми его импортами.

import { createServer } from "vite"
import { writeFileSync } from "node:fs"

const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
})
const { taskThemes } = await server.ssrLoadModule("/src/pages/taskGenerators.js")

// Предметы, у которых есть выгруженный банк ФИПИ и генераторы (тот же список,
// что гоняет fipi-smoke).
const EXAMS = ["ОГЭ", "ЕГЭ", "ЕГЭ Профиль", "ОГЭ Информатика", "ОГЭ Английский",
  "ОГЭ Русский", "ОГЭ Химия", "ОГЭ Обществознание", "ОГЭ Физика", "ОГЭ История",
  "ОГЭ Биология", "ОГЭ Литература", "ОГЭ География"]

let subjects = 0, numbers = 0, types = 0
const perExam = {}

for (const exam of EXAMS) {
  let examNumbers = 0, examTypes = 0
  for (let num = 1; num <= 40; num++) {
    let themes
    try { themes = taskThemes(exam, num) } catch { themes = null }
    if (!themes || !themes.length) continue
    const keys = new Set(themes.flatMap((t) => t.items.map((i) => i.key)))
    if (!keys.size) continue
    examNumbers++
    examTypes += keys.size
  }
  if (!examNumbers) continue
  subjects++
  numbers += examNumbers
  types += examTypes
  perExam[exam] = { numbers: examNumbers, types: examTypes }
}

await server.close()

const out = `// СГЕНЕРИРОВАНО scripts/bank-stats.mjs — руками не править.
// Пересчитать после пополнения банка: node scripts/bank-stats.mjs
export const BANK_STATS = {
  subjects: ${subjects},   // предметов ОГЭ/ЕГЭ с генерацией
  numbers: ${numbers},     // номеров заданий, которые умеем генерировать
  types: ${types},         // типажей (разновидностей формулировки) всего
}
`
writeFileSync(new URL("../src/pages/bankStats.js", import.meta.url), out)

console.log(`предметов: ${subjects}\nномеров: ${numbers}\nтипажей: ${types}\n`)
for (const [e, v] of Object.entries(perExam)) console.log(`  ${e}: ${v.numbers} номеров, ${v.types} типажей`)
