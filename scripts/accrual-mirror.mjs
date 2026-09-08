// Сверка начислений: accrualEntries() из src/billing.js против её зеркала в
// базе — student_accrual() (supabase/lesson_price.sql).
//
// Зачем: на SQL-функции держатся квитанции, на JS — долг, списки неоплаченных
// занятий и кабинет родителя. Разойдутся — счета выпишутся не на ту сумму, что
// висит в долге, и самые старые покажутся погашенными без единой оплаты. Такое
// уже случалось, поэтому правку любой из двух сторон полагается прогонять здесь.
//
// Запуск:  node scripts/accrual-mirror.mjs
// Требует доступа к боевой базе по ssh (docker exec supabase-db psql).
import { execFileSync } from "node:child_process"
import { writeFileSync, unlinkSync } from "node:fs"
import { accrualEntries } from "../src/billing.js"

const pad = (n) => String(n).padStart(2, "0")
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return iso(d) }

// Даты держим ПОДАЛЬШЕ от сегодняшнего дня: «прошло ли занятие» база считает по
// московскому времени и своим часам, а узел — по своим. Занятие, стоящее на
// границе, дало бы разное «прошло/не прошло» и ложное расхождение.
const PAST = [-60, -53, -46, -39, -32, -25, -18, -11]
const FUTURE = [11, 18, 25, 32]

const lesson = (days, extra = {}) => ({ date: shift(days), time: "16:00", duration: 60, ...extra })

// Случаи подобраны так, чтобы каждая ветка обеих реализаций была задета:
// поштучно и абонементом, с ценой занятия и без, со снятыми со счёта, с
// вписанной суммой периода и без неё, с недонастроенным абонементом.
const cases = []
for (const mode of ["lesson", "package"]) {
  for (const period of ["week", "weeks2", "month"]) {
    for (const manual of [null, 12000]) {
      for (const price of [1500, 0]) {
        for (const withOwn of [false, true]) {
          const lessons = [
            ...PAST.map((d, i) => lesson(d, withOwn && i % 2 ? { price: 900 } : {})),
            ...FUTURE.map((d, i) => lesson(d, withOwn && i % 2 ? { price: 900 } : {})),
          ]
          lessons[2] = { ...lessons[2], status: "excused" }
          lessons[5] = { ...lessons[5], status: "missed" }
          cases.push({
            name: `${mode}/${period}/сумма ${manual ?? "по расписанию"}/цена ${price}/своя цена ${withOwn ? "есть" : "нет"}`,
            row: {
              lesson_price: price,
              lesson_duration: 60,
              payment_mode: mode,
              package_period: period,
              package_start: shift(-60),
              package_amount: manual,
              lessons,
            },
          })
        }
      }
    }
  }
}
// Абонемент без даты начала — по обеим реализациям это поштучная оплата.
cases.push({
  name: "package без даты начала",
  row: {
    lesson_price: 2000, lesson_duration: 60, payment_mode: "package",
    package_period: "month", package_start: null, package_amount: null,
    lessons: PAST.map((d) => lesson(d)),
  },
})

// Карточка приходит в billing.js в snake_case тоже (так её читает бот) —
// сверяем ровно ту форму, что лежит в базе.
const jsRows = (row) => accrualEntries(row)
  .map((l) => `${l.date}|${l.time || ""}|${Math.round(Number(l.charge))}`)
  .sort()

// SQL уезжает на сервер ФАЙЛОМ, а не аргументом psql: карточка — это JSON с
// кавычками, и в цепочке ssh → docker → psql он превращается в кашу из
// экранирования. JSON внутри запроса взят в долларовые кавычки по той же
// причине.
const sql = cases.map((c, i) => `select ${i} as case_no, lesson_date::text, lesson_time, amount::int
  from public.student_accrual(jsonb_populate_record(null::public.students,
    $json$${JSON.stringify(c.row)}$json$::jsonb))`).join("\nunion all\n") + "\norder by 1,2,3;\n"

const tmp = `/tmp/accrual-mirror-${process.pid}.sql`
writeFileSync(tmp, sql)
execFileSync("scp", ["-q", tmp, `precettore-db:${tmp}`])
const out = execFileSync("ssh", ["precettore-db",
  `docker exec -i supabase-db psql -U postgres -Atf /dev/stdin < ${tmp}; rm -f ${tmp}`],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
unlinkSync(tmp)

const dbByCase = new Map()
for (const line of out.trim().split("\n")) {
  if (!line) continue
  const [no, date, time, amount] = line.split("|")
  if (!dbByCase.has(no)) dbByCase.set(no, [])
  dbByCase.get(no).push(`${date}|${time || ""}|${amount}`)
}

let bad = 0, entries = 0
cases.forEach((c, i) => {
  const js = jsRows(c.row)
  const db = (dbByCase.get(String(i)) || []).sort()
  entries += js.length
  if (js.join(";") === db.join(";")) return
  bad++
  console.log(`РАСХОЖДЕНИЕ · ${c.name}`)
  console.log(`  JS (${js.length}): ${js.slice(0, 6).join("  ")}`)
  console.log(`  БД (${db.length}): ${db.slice(0, 6).join("  ")}`)
  const only = js.filter((x) => !db.includes(x)).slice(0, 4)
  const back = db.filter((x) => !js.includes(x)).slice(0, 4)
  if (only.length) console.log(`  только в JS: ${only.join("  ")}`)
  if (back.length) console.log(`  только в БД: ${back.join("  ")}`)
})
console.log(`\nСлучаев: ${cases.length}, начислений: ${entries}, расхождений: ${bad}`)
process.exit(bad ? 1 : 0)
