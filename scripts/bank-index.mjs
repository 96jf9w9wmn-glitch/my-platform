// Индекс банка заданий: у какого предмета какие номера имеют генераторы.
//
// Генераторы предметов подключаются в кабинете ЛЕНИВО (см. src/pages/
// taskGenerators.js), а выбор предмета по умолчанию и списки номеров нужны ДО
// подключения. Поэтому список «номера с генераторами» лежит статикой в
// src/pages/bankIndex.js, и собирает его этот скрипт — он импортирует модули
// предметов в node и применяет то же правило, что hasGenerators(): у номера
// есть хотя бы одна функция. Запускается хуками predev/prebuild; расхождение
// индекса с генераторами в разработке ловит проверка при подключении предмета.
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { createServer } from "vite"

const here = dirname(fileURLToPath(import.meta.url))
const pages = resolve(here, "../src/pages")
// Модули банка написаны для vite (импорты без расширений, ../utils), поэтому
// грузим их через него же в SSR-режиме — как это делает смоук банка.
const server = await createServer({
  root: resolve(here, ".."), logLevel: "silent", appType: "custom",
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
})

// Порядок и имена — как в реестре taskGenerators.js (SUBJECTS).
const SUBJECTS = {
  "ОГЭ": ["taskGeneratorsOge.js", "GENERATORS_OGE"],
  "ОГЭ Информатика": ["taskGeneratorsInf.js", "GENERATORS_INF"],
  "ОГЭ Английский": ["taskGeneratorsEng.js", "GENERATORS_ENG"],
  "ОГЭ Русский": ["taskGeneratorsRus.js", "GENERATORS_RUS"],
  "ОГЭ Химия": ["taskGeneratorsChem.js", "GENERATORS_CHEM"],
  "ОГЭ Обществознание": ["taskGeneratorsObsh.js", "GENERATORS_OBSH"],
  "ОГЭ Физика": ["taskGeneratorsPhys.js", "GENERATORS_PHYS"],
  "ОГЭ История": ["taskGeneratorsHist.js", "GENERATORS_HIST"],
  "ОГЭ Биология": ["taskGeneratorsBio.js", "GENERATORS_BIO"],
  "ОГЭ Литература": ["taskGeneratorsLit.js", "GENERATORS_LIT"],
  "ОГЭ География": ["taskGeneratorsGeo.js", "GENERATORS_GEO"],
  "ЕГЭ": ["taskGeneratorsEgeBase.js", "GENERATORS_EGE_BASE"],
  "ЕГЭ Профиль": ["taskGeneratorsEgeProf.js", "GENERATORS_EGE_PROF"],
  "ЕГЭ Информатика": ["taskGeneratorsEgeInf.js", "GENERATORS_EGE_INF"],
}

const index = {}
for (const [exam, [file, name]] of Object.entries(SUBJECTS)) {
  const mod = await server.ssrLoadModule(`/src/pages/${file}`)
  const gens = mod[name]
  if (!gens || typeof gens !== "object") throw new Error(`${file}: нет экспорта ${name}`)
  index[exam] = Object.keys(gens).filter((n) => gens[n]?.length).map(Number).sort((a, b) => a - b)
}

const out = resolve(pages, "bankIndex.js")
const text = `// СОБРАНО СКРИПТОМ scripts/bank-index.mjs — руками не править.
// Номера с генераторами по предметам; нужен реестру банка (taskGenerators.js)
// и выбору предмета, пока сами генераторы ещё не подключены.
export const BANK_INDEX = ${JSON.stringify(index, null, 2)}
`
let prev = ""
try { prev = readFileSync(out, "utf8") } catch { /* первого запуска ещё не было */ }
if (prev !== text) { writeFileSync(out, text); console.log("bankIndex.js обновлён") }
else console.log("bankIndex.js без изменений")
await server.close()
