// Деньги ученика: долг, оплаты и абонементы — одной арифметикой на всё
// приложение.
//
// До этого файла формула «проведённые занятия × цена − оплаты» была переписана
// от руки в семи местах (страница «Финансы», карточка ученика, кабинет ученика,
// кабинет родителя, карточка онлайн-оплаты, квитанции, телеграм-бот). Пока
// правило было одно, это сходило с рук; с появлением абонемента разошлось бы на
// первой же правке — поэтому считает теперь одна функция, а экраны только
// показывают.
//
// АБОНЕМЕНТ — ЭТО ОПЛАТА ВПЕРЁД ЗА ПЕРИОД. Ученик платит сразу за неделю, две
// недели или месяц; система считает, сколько занятий у него в этом периоде, и
// эти занятия дальше не попадают в долг — они уже оплачены. Отдельной таблицы
// у абонемента нет намеренно: это запись в том же `students.payments`, что и
// обычная оплата, только с полями периода. Поэтому фича не ждёт миграции, а
// история денег остаётся одним списком, а не двумя, которые надо сводить.
//
// Из этого следует главное правило: сумма абонемента НЕ входит в «оплачено» при
// расчёте долга — вместо неё из долга выпадают сами покрытые занятия. Считать и
// то, и другое значило бы зачесть одни деньги дважды.

import { isLessonConducted, LESSON_EXCUSED } from "./utils.js"

export const PACKAGE_KIND = "package"

export const isPackage = (p) => p?.kind === PACKAGE_KIND && Number(p?.lessons) > 0

// ВЫСТАВИТЬ АБОНЕМЕНТ И ПОЛУЧИТЬ ЗА НЕГО ДЕНЬГИ — РАЗНЫЕ СОБЫТИЯ. Абонемент без
// отметки об оплате не считается деньгами: он не идёт в доход, не гасит долг и
// не покрывает занятия периода — они начисляются как обычно, пока оплата не
// пришла. Иначе договорённость «плачу за месяц» немедленно рисовала бы
// репетитору доход, которого у него ещё нет.
export const isPaidPackage = (p) => isPackage(p) && !!p.paidAt
export const isPendingPackage = (p) => isPackage(p) && !p.paidAt

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

// Последний день периода — ВКЛЮЧИТЕЛЬНО: «абонемент до 6 сентября» человек
// понимает как «шестое ещё входит». Поэтому от конца отнимается день.
export function periodEnd(fromIso, key) {
  const start = fromIsoDate(fromIso)
  if (!start) return ""
  const p = PERIODS.find((x) => x.key === key) || PERIODS[0]
  const end = new Date(start)
  if (p.months) end.setMonth(end.getMonth() + p.months)
  else end.setDate(end.getDate() + p.days)
  end.setDate(end.getDate() - 1)
  return toIso(end)
}

// Занятия, попадающие в период, — по ним считается, за сколько платить вперёд.
// Берутся и прошедшие, и будущие: период может начинаться задним числом.
// Занятие, снятое со счёта, в оплату не идёт (см. LESSON_EXCUSED в utils.js).
export function lessonsInRange(student, fromIso, untilIso) {
  return (student?.lessons || [])
    .filter((l) => l.date && l.date >= fromIso && l.date <= untilIso && l.status !== LESSON_EXCUSED)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
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

const lessonKey = (l) => `${l.date}|${l.time || ""}`

// Полная картина по деньгам ученика.
//
// Занятия раздаются по абонементам по порядку: каждое проведённое занятие
// занимает место в самом раннем абонементе, который ещё не исчерпан и который
// его покрывает. Что не покрыто ничем — оплачивается поштучно и составляет долг.
// Без абонементов формула вырождается в прежнюю, поэтому все существующие
// карточки считаются ровно как раньше.
export function studentBilling(student, now = new Date()) {
  const price = Number(student?.lessonPrice ?? student?.lesson_price ?? 0)
  const all = student?.payments || []
  const today = toIso(now)

  const packs = all
    .filter(isPaidPackage)
    .map((p) => ({
      ...p,
      lessons: Number(p.lessons) || 0,
      amount: Number(p.amount) || 0,
      used: 0,
      covers: [],
    }))
    .sort((a, b) => String(a.from || "").localeCompare(String(b.from || "")))

  // Обычные оплаты — только они гасят долг деньгами. Сумма оплаченного
  // абонемента сюда не входит: она уже «потрачена» на покрытые занятия.
  const plainPaid = all
    .filter((p) => !isPackage(p))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  // Выставленные, но не оплаченные — деньгами ещё не стали.
  const pending = all
    .filter(isPendingPackage)
    .sort((a, b) => String(a.from || "").localeCompare(String(b.from || "")))

  const conducted = (student?.lessons || [])
    .filter((l) => isLessonConducted(l, now))
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))

  const coveredKeys = new Set()
  const uncovered = []
  for (const l of conducted) {
    // Занятие после начала абонемента. Верхняя граница проверяется, только если
    // репетитор включил сгорание: по умолчанию оплаченное занятие не пропадает
    // из-за того, что его перенесли за край периода.
    const slot = packs.find((p) => p.used < p.lessons
      && l.date >= String(p.from || "")
      && (!p.burn || !p.until || l.date <= p.until))
    if (slot) {
      slot.used += 1
      slot.covers.push(lessonKey(l))
      coveredKeys.add(lessonKey(l))
    } else {
      uncovered.push(l)
    }
  }

  const packages = packs.map((p) => {
    const expired = !!(p.until && today > p.until)
    const left = Math.max(0, p.lessons - p.used)
    return {
      ...p,
      left,
      expired,
      // Сгоревшие места: срок вышел, сгорание включено — эти занятия уже не
      // получить, и показывать их как «осталось» было бы обманом.
      lost: expired && p.burn ? left : 0,
      // Абонемент, которым сейчас платят: место есть и он ещё не сгорел.
      live: left > 0 && !(expired && p.burn),
    }
  })

  const owed = uncovered.length * price
  const debt = owed - plainPaid

  return {
    price,
    debt,
    plainPaid,
    conducted,
    uncovered,
    coveredKeys,
    packages,
    // Действующий абонемент — самый ранний непотраченный: из него спишется
    // следующее занятие.
    active: packages.find((p) => p.live) || null,
    // Сколько занятий оплачено вперёд по всем действующим абонементам.
    prepaid: packages.reduce((sum, p) => sum + (p.live ? p.left : 0), 0),
    pending,
    pendingAmount: pending.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    // Для подстановки при продлении берём последний по началу периода —
    // в том числе ещё не оплаченный, иначе продление предложило бы старые даты.
    lastPackage: [...all.filter(isPackage)]
      .sort((a, b) => String(a.from || "").localeCompare(String(b.from || "")))
      .pop() || null,
  }
}

// Долг ученика — то же число, что показывают все экраны и телеграм-бот.
export function studentDebt(student, now = new Date()) {
  return studentBilling(student, now).debt
}

// Занятия, за которые ещё не заплатили, — старые первыми. Покрытые абонементом
// сюда не попадают: они оплачены вперёд.
export function unpaidLessons(student, now = new Date()) {
  const { uncovered, price, plainPaid } = studentBilling(student, now)
  if (price <= 0) return []
  const paidCount = Math.floor(plainPaid / price)
  const credit = plainPaid % price
  return uncovered.slice(paidCount).map((l, i) => ({
    ...l,
    amountDue: i === 0 ? price - credit : price,
  }))
}

// Пора ли продлевать: занятий не осталось, осталось одно, или срок выходит на
// днях. Это сигнал репетитору, а не ученику — деньги просит он.
export const RENEW_SOON_DAYS = 5

export function renewalState(student, now = new Date()) {
  const { packages, active, prepaid } = studentBilling(student, now)
  if (!packages.length) return null              // ученик не на абонементе
  const today = toIso(now)
  const limit = new Date(now)
  limit.setDate(limit.getDate() + RENEW_SOON_DAYS)
  const endingSoon = !!(active?.until && active.until >= today && active.until <= toIso(limit))
  return {
    active,
    prepaid,
    // «Кончился» — мест больше нет ни в одном действующем абонементе.
    over: prepaid <= 0,
    endingSoon,
    due: prepaid <= 0 || prepaid === 1 || endingSoon,
    last: packages[packages.length - 1],
  }
}
