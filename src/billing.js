// Деньги ученика: что начислено, что оплачено и сколько он должен.
//
// До этого файла формула «проведённые занятия × цена − оплаты» была переписана
// от руки в семи местах (страница «Финансы», карточка ученика, кабинет ученика,
// кабинет родителя, карточка онлайн-оплаты, квитанции, телеграм-бот). Теперь
// считает одна функция, а экраны только показывают.
//
// АБОНЕМЕНТ — ЭТО НЕ ОТДЕЛЬНЫЕ ДЕНЬГИ, А НАСТРОЙКА УЧЕНИКА. Денежный поток
// остаётся один: начислено − оплачено = долг. Абонемент меняет только то,
// КОГДА начисляется долг:
//
//   «за занятие»  — долг растёт по мере проведения занятий (как было всегда);
//   «абонементом» — долг за весь период появляется сразу, как только период
//                   начался, и гасится одной оплатой за несколько занятий.
//
// Поэтому у абонемента нет ни своей записи в оплатах, ни своего статуса
// «оплачен»: оплата у него та же самая, что у всех, — обычная запись в
// `students.payments`, которую репетитор вносит в «Финансах». Второй денежной
// сущности здесь быть не должно: как только их становится две, у одного
// ученика появляются два разных числа про деньги, и понять их нельзя.
//
// СУММА ПЕРИОДА МОЖЕТ БЫТЬ ВПИСАНА РУКОЙ (`packageAmount`). Расчётная сумма —
// «занятий в периоде × цена» — это догадка по расписанию, а договариваются
// репетитор с родителем о круглом числе: скидка за оплату вперёд, «десять
// тысяч в месяц независимо от переносов». Вписанная сумма важнее расчётной, но
// она НЕ заводит второго потока денег: это по-прежнему начисление за период,
// которое раскладывается по его занятиям (см. accrualEntries) и гасится теми же
// оплатами. Поэтому «начислено − оплачено» остаётся единственной формулой долга.

import { isLessonConducted, LESSON_EXCUSED } from "./utils.js"

export const MODE_LESSON = "lesson"
export const MODE_PACKAGE = "package"

// Периоды, за которые платят вперёд. Списком, а не свободным числом дней:
// «неделя, две недели, месяц» — то, как об этом договариваются на самом деле.
export const PERIODS = [
  { key: "week", label: "Неделя", days: 7 },
  { key: "weeks2", label: "Две недели", days: 14 },
  { key: "month", label: "Месяц", months: 1 },
]

export const periodLabel = (key) => PERIODS.find((p) => p.key === key)?.label || "Период"

const pad = (n) => String(n).padStart(2, "0")
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayIso = () => toIso(new Date())

export function fromIsoDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number)
  return y ? new Date(y, m - 1, d) : null
}

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
                "июля", "августа", "сентября", "октября", "ноября", "декабря"]

// «7 сентября», а в другом году — «7 сентября 2027». Год в текущем году только
// занимает строку: в узкой колонке карточки из-за него подпись едет в две.
export function dayMonth(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number)
  if (!y) return ""
  const now = new Date().getFullYear()
  return `${d} ${MONTHS[m - 1]}${y === now ? "" : ` ${y}`}`
}

// Карточка приходит сюда и из стейта кабинета (camelCase), и прямо из базы
// (snake_case — так её читает телеграм-бот). Читаем оба написания: бот обязан
// показывать то же число, что и кабинет, а не считать абонемент поштучной
// оплатой из-за имени поля.
const modeOf = (s) => s?.paymentMode ?? s?.payment_mode
const periodKeyOf = (s) => s?.packagePeriod ?? s?.package_period
const startOf = (s) => s?.packageStart ?? s?.package_start

// Ученик на абонементе? Период без даты начала не считается: не от чего
// отсчитывать, и «текущий период» посчитать не из чего.
export function onPackage(student) {
  return modeOf(student) === MODE_PACKAGE
    && !!startOf(student)
    && PERIODS.some((p) => p.key === periodKeyOf(student))
}

function addPeriod(date, key, times = 1) {
  const p = PERIODS.find((x) => x.key === key) || PERIODS[0]
  const d = new Date(date)
  if (p.months) d.setMonth(d.getMonth() + p.months * times)
  else d.setDate(d.getDate() + p.days * times)
  return d
}

// Период, в котором мы сейчас: периоды идут подряд от даты начала абонемента.
// Границы включительные с обеих сторон — «с 1 по 30 сентября» человек понимает
// именно так.
export function currentPeriod(student, now = new Date()) {
  if (!onPackage(student)) return null
  const start = fromIsoDate(startOf(student))
  if (!start) return null
  const key = periodKeyOf(student)
  let from = start
  // Шагаем периодами, пока не накроем сегодняшний день. Ограничение на 500
  // шагов — страховка от битой даты, а не бизнес-правило.
  for (let i = 0; i < 500; i++) {
    const next = addPeriod(from, key)
    if (next > now) break
    from = next
  }
  const until = new Date(addPeriod(from, key))
  until.setDate(until.getDate() - 1)
  return { from: toIso(from), until: toIso(until), period: key }
}

// Следующий период — им подписывается, что будет начислено дальше.
export function nextPeriod(student, now = new Date()) {
  const cur = currentPeriod(student, now)
  if (!cur) return null
  const from = addPeriod(fromIsoDate(cur.from), cur.period)
  const until = new Date(addPeriod(from, cur.period))
  until.setDate(until.getDate() - 1)
  return { from: toIso(from), until: toIso(until), period: cur.period }
}

// Занятие, снятое со счёта, не начисляется никогда — ни поштучно, ни в
// абонементе (см. LESSON_EXCUSED в utils.js).
const countable = (l) => l?.date && l.status !== LESSON_EXCUSED

export function lessonsInRange(student, fromIso, untilIso) {
  return (student?.lessons || [])
    .filter((l) => countable(l) && l.date >= fromIso && l.date <= untilIso)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
}

// Сумма, вписанная руками за период. Пусто, ноль и мусор — это «считай по
// расписанию»: пустое поле не должно молча обнулять долг.
export function packageAmount(student) {
  const v = Number(student?.packageAmount ?? student?.package_amount)
  return Number.isFinite(v) && v > 0 ? v : null
}

// Периоды абонемента от даты начала до текущего включительно. Периоды, которые
// уже прошли, начислены целиком — иначе долг за прошлый месяц исчезал бы с
// началом следующего.
export function elapsedPeriods(student, now = new Date()) {
  const cur = currentPeriod(student, now)
  if (!cur) return []
  const key = periodKeyOf(student)
  const out = []
  let from = fromIsoDate(startOf(student))
  for (let i = 0; i < 500; i++) {
    const until = new Date(addPeriod(from, key))
    until.setDate(until.getDate() - 1)
    const iso = toIso(from)
    out.push({ from: iso, until: toIso(until), period: key })
    if (iso >= cur.from) break
    from = addPeriod(from, key)
  }
  return out
}

// Сколько стоит один период: вписанная сумма важнее расчётной. Период без
// занятий не стоит ничего даже при вписанной сумме — начислять не за что, а
// деньги, ни к чему не привязанные, разошлись бы с квитанциями и списком
// неоплаченных занятий.
export function periodAmount(student, period, price = Number(student?.lessonPrice ?? student?.lesson_price ?? 0)) {
  const lessons = lessonsInRange(student, period.from, period.until)
  if (!lessons.length) return { lessons, amount: 0 }
  const manual = packageAmount(student)
  return { lessons, amount: manual != null ? manual : lessons.length * price }
}

// Раскладывает сумму периода по его занятиям без потери копеек: остаток от
// деления кладётся на первое занятие. Нужно затем, что квитанции, список
// неоплаченных занятий и кабинет родителя показывают деньги ПО ЗАНЯТИЯМ, и их
// сумма обязана сойтись с долгом до рубля.
function spread(amount, count) {
  const base = Math.floor(amount / count)
  return Array.from({ length: count }, (_, i) => (i === 0 ? amount - base * (count - 1) : base))
}

// Что ученику НАЧИСЛЕНО на сегодня — занятия, за которые он должен заплатить,
// у каждого своя сумма (`charge`). Здесь и лежит вся разница между способами
// оплаты. Старые — первыми.
export function accrualEntries(student, now = new Date()) {
  const price = Number(student?.lessonPrice ?? student?.lesson_price ?? 0)
  const byDate = (a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))
  const all = (student?.lessons || []).filter(countable)

  if (!onPackage(student)) {
    return all.filter((l) => isLessonConducted(l, now)).sort(byDate)
      .map((l) => ({ ...l, charge: price }))
  }

  const start = startOf(student)
  // До абонемента ученик платил как все — по факту проведения.
  const out = all.filter((l) => l.date < start && isLessonConducted(l, now)).sort(byDate)
    .map((l) => ({ ...l, charge: price }))

  // С началом периода начисляются ВСЕ его занятия сразу, ещё до того, как они
  // прошли: в этом и смысл оплаты вперёд.
  for (const p of elapsedPeriods(student, now)) {
    const { lessons, amount } = periodAmount(student, p, price)
    if (!lessons.length) continue
    const parts = spread(amount, lessons.length)
    lessons.forEach((l, i) => out.push({ ...l, charge: parts[i] }))
  }
  return out
}

// Тот же список без сумм — им пользуются экраны, которым нужно только «сколько
// занятий уже начислено».
export function accruedLessons(student, now = new Date()) {
  return accrualEntries(student, now)
}

export function studentBilling(student, now = new Date()) {
  const price = Number(student?.lessonPrice ?? student?.lesson_price ?? 0)
  const paid = (student?.payments || []).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0)
  const accrued = accrualEntries(student, now)
  const charged = accrued.reduce((sum, l) => sum + l.charge, 0)
  const cur = currentPeriod(student, now)

  return {
    price,
    paid,
    accrued,
    charged,
    // Занятия, уже начисленные, но ещё не проведённые: их деньги посчитаны, и
    // второй раз, в прогнозе дохода, их брать нельзя.
    prepaid: accrued.filter((l) => !isLessonConducted(l, now)).length,
    debt: charged - paid,
    package: cur
      ? { ...cur, lessons: periodAmount(student, cur, price).lessons.length,
          amount: periodAmount(student, cur, price).amount,
          manual: packageAmount(student) != null }
      : null,
  }
}

// Долг ученика — то же число, что показывают все экраны и телеграм-бот.
export function studentDebt(student, now = new Date()) {
  return studentBilling(student, now).debt
}

// Занятия, за которые ещё не заплатили, — старые первыми. У абонемента сюда
// попадают и не проведённые занятия текущего периода: они уже начислены.
// Оплата закрывает начисления по порядку, поэтому первое занятие в списке
// может быть закрыто частично.
export function unpaidLessons(student, now = new Date()) {
  const { accrued, paid } = studentBilling(student, now)
  let left = paid
  const out = []
  for (const l of accrued) {
    if (l.charge <= 0) continue
    if (left >= l.charge) { left -= l.charge; continue }
    out.push({ ...l, amountDue: l.charge - left })
    left = 0
  }
  return out
}
