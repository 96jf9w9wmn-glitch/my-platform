// Проверка прогноза готовности к экзамену: пороги сдачи, темп роста, обрезка по
// максимуму и по нулю, поведение при нехватке данных.
//
// Запуск:  node scripts/forecast-check.mjs
// Прогноз читают родитель и ученик, и ошибка здесь читается как обещание —
// поэтому правку src/forecast.js полагается прогонять тут.
import { register } from "node:module"
register("data:text/javascript," + encodeURIComponent(`
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx) } catch (e) {
    if (spec.startsWith(".") && ctx.parentURL) {
      const u = new URL(spec + ".js", ctx.parentURL)
      if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }
    }
    throw e
  }
}`))
const { examForecast, trendPerWeek, passThreshold, MIN_ROWS_FOR_TREND } =
  await import("/Users/armansarkisyan/my-platform/src/forecast.js")
const { testScoreOf, examMaxPrimary } = await import("/Users/armansarkisyan/my-platform/src/examScales.js")

let bad = 0
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { bad++; console.log(`✗ ${name}\n   получено ${JSON.stringify(got)}\n   ожидалось ${JSON.stringify(want)}`) }
  else console.log(`✓ ${name} → ${JSON.stringify(got)}`)
}

// Порог: у экзамена с отметкой — нижняя граница тройки, у тестового — первый
// первичный, дающий минимальный тестовый балл. Второе проверяем независимо.
eq("порог ОГЭ", passThreshold("ОГЭ"), 8)
eq("порог ЕГЭ базы", passThreshold("ЕГЭ"), 7)
for (const type of ["ЕГЭ Профиль", "ЕГЭ Информатика"]) {
  const p = passThreshold(type)
  const below = p > 0 ? testScoreOf(type, p - 1) : -1
  const atP = testScoreOf(type, p)
  eq(`порог ${type}: ${p} проходит, ${p - 1} нет`,
     [atP >= (type === "ЕГЭ Профиль" ? 27 : 40), below < (type === "ЕГЭ Профиль" ? 27 : 40)], [true, true])
}

// Темп: ровный рост на 2 балла в неделю должен дать ровно 2.
const day = (n) => new Date(2026, 0, 1 + n).toISOString().slice(0, 10)
eq("темп ровного роста", Math.round(trendPerWeek([
  { date: day(0), total: 10 }, { date: day(7), total: 12 }, { date: day(14), total: 14 },
]) * 1000) / 1000, 2)
eq("темп спада", Math.round(trendPerWeek([
  { date: day(0), total: 20 }, { date: day(7), total: 18 }, { date: day(14), total: 16 },
]) * 1000) / 1000, -2)
eq("двух работ мало", trendPerWeek([{ date: day(0), total: 10 }, { date: day(7), total: 12 }]), null)
eq("все в один день — темпа нет", trendPerWeek([
  { date: day(0), total: 10 }, { date: day(0), total: 12 }, { date: day(0), total: 14 },
]), null)

// Прогноз: от последней работы плюс темп × недель до экзамена.
const rows = [
  { date: day(0), total: 10, max: 33 },
  { date: day(7), total: 12, max: 33 },
  { date: day(14), total: 14, max: 33 },
]
const now = new Date(2026, 0, 15)
const f = examForecast(rows, { examType: "ЕГЭ Профиль", target: 25, examDate: day(42), now })
// От 14 баллов, темп 2/нед, до экзамена ровно 4 недели (15 янв → 12 фев) → 22.
eq("прогноз", [f.now, Math.round(f.perWeek), f.forecast, f.reachesTarget], [14, 2, 22, false])
eq("максимум и порог", [f.max, f.pass], [examMaxPrimary("ЕГЭ Профиль"), passThreshold("ЕГЭ Профиль")])

// Обрезка: прямая уводит выше максимума экзамена — показываем предел.
const far = examForecast(rows, { examType: "ЕГЭ Профиль", target: 30, examDate: day(400), now })
eq("прогноз не выше максимума", far.forecast, examMaxPrimary("ЕГЭ Профиль"))
eq("про обрезку сказано", /выше максимума/.test(far.note), true)

// Прогноз не уходит ниже нуля при спаде.
const down = examForecast([
  { date: day(0), total: 8, max: 33 }, { date: day(7), total: 5, max: 33 }, { date: day(14), total: 2, max: 33 },
], { examType: "ЕГЭ Профиль", target: 25, examDate: day(120), now })
eq("прогноз не ниже нуля", down.forecast, 0)

// Мало данных и нет даты — числа нет, но сказано почему.
const few = examForecast([{ date: day(0), total: 10, max: 33 }], { examType: "ЕГЭ Профиль", examDate: day(42), now })
eq("по одной работе прогноза нет", [few.forecast, few.note.length > 0], [null, true])
const noDate = examForecast(rows, { examType: "ЕГЭ Профиль", now })
eq("без даты экзамена прогноза нет", [noDate.forecast, noDate.perWeek != null], [null, true])
const passed = examForecast(rows, { examType: "ЕГЭ Профиль", examDate: day(1), now })
eq("экзамен позади", [passed.forecast, passed.note], [null, "Экзамен уже прошёл."])

console.log(bad ? `\nПровалов: ${bad}` : `\nВсё сошлось (MIN_ROWS_FOR_TREND = ${MIN_ROWS_FOR_TREND})`)
process.exit(bad ? 1 : 0)
