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

// Ученик на абонементе? Период без даты начала не считается: не от чего
// отсчитывать, и «текущий период» посчитать не из чего.
export function onPackage(student) {
  return student?.paymentMode === MODE_PACKAGE
    && !!student?.packageStart
    && PERIODS.some((p) => p.key === student?.packagePeriod)
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
  const start = fromIsoDate(student.packageStart)
  if (!start) return null
  const key = student.packagePeriod
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

// Что ученику НАЧИСЛЕНО на сегодня — занятия, за которые он должен заплатить.
// Здесь и лежит вся разница между способами оплаты.
export function accruedLessons(student, now = new Date()) {
  const all = (student?.lessons || []).filter(countable)
  if (!onPackage(student)) return all.filter((l) => isLessonConducted(l, now))

  const cur = currentPeriod(student, now)
  const start = student.packageStart
  return all
    .filter((l) => (l.date < start
      // До абонемента ученик платил как все — по факту проведения.
      ? isLessonConducted(l, now)
      // С началом периода начисляются ВСЕ его занятия сразу, ещё до того, как
      // они прошли: в этом и смысл оплаты вперёд.
      : l.date <= cur.until))
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
}

export function studentBilling(student, now = new Date()) {
  const price = Number(student?.lessonPrice ?? student?.lesson_price ?? 0)
  const paid = (student?.payments || []).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0)
  const accrued = accruedLessons(student, now)
  const cur = currentPeriod(student, now)

  return {
    price,
    paid,
    accrued,
    debt: accrued.length * price - paid,
    package: cur ? { ...cur, lessons: lessonsInRange(student, cur.from, cur.until).length } : null,
  }
}

// Долг ученика — то же число, что показывают все экраны и телеграм-бот.
export function studentDebt(student, now = new Date()) {
  return studentBilling(student, now).debt
}

// Занятия, за которые ещё не заплатили, — старые первыми. У абонемента сюда
// попадают и не проведённые занятия текущего периода: они уже начислены.
export function unpaidLessons(student, now = new Date()) {
  const { accrued, price, paid } = studentBilling(student, now)
  if (price <= 0) return []
  const paidCount = Math.floor(paid / price)
  const credit = paid % price
  return accrued.slice(paidCount).map((l, i) => ({
    ...l,
    amountDue: i === 0 ? price - credit : price,
  }))
}
