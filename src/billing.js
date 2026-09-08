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
// ПЕРИОД АБОНЕМЕНТА СЧИТАЕТСЯ ЗАНЯТИЯМИ, А НЕ ДАТАМИ. «Месяц» у ученика,
// который занимается дважды в неделю, — это восемь занятий, а не «с 4 сентября
// по 3 октября»: именно так об абонементе договариваются, и именно столько
// занятий человек ожидает получить за свои деньги. Календарное окно давало
// другое число — тридцать дней с 4 сентября накрывают пять суббот и разовое
// занятие в пятницу, и «месяц» молча превращался в десять занятий. Поэтому
// периоды здесь — это подряд идущие куски списка занятий по N штук, а N
// считается по расписанию: занятий в неделю × недель в периоде (см.
// weeklyRate и packageSize).
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
// `weeks` — во сколько недель расписания обходится период: месяц это четыре
// недели занятий, а не календарный месяц (см. шапку файла).
export const PERIODS = [
  { key: "week", label: "Неделя", weeks: 1 },
  { key: "weeks2", label: "Две недели", weeks: 2 },
  { key: "month", label: "Месяц", weeks: 4 },
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

// Занятие, снятое со счёта, не начисляется никогда — ни поштучно, ни в
// абонементе (см. LESSON_EXCUSED в utils.js).
const countable = (l) => l?.date && l.status !== LESSON_EXCUSED

const byDateTime = (a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))

// Во сколько обходится ОДНО занятие. Своя цена занятия важнее цены карточки:
// она появляется у групповых занятий (в группе занимаются дешевле), а карточка
// хранит одну цену на все занятия ученика. Ноль и мусор в занятии — это «цены
// нет», а не «бесплатно».
//
// ЗЕРКАЛО В БАЗЕ: то же правило внутри student_accrual (supabase/lesson_price.sql).
// Разойдутся — квитанции выпишутся не на ту сумму, что висит в долге.
const lessonPrice = (lesson, fallback) => {
  const own = Number(lesson?.price)
  return Number.isFinite(own) && own > 0 ? own : Number(fallback) || 0
}

// Сколько занятий в неделю у ученика — по расписанию, а не по календарю.
// Считаем повторяющиеся пары «день недели + время»: это и есть расписание
// («Чт 16:00, Сб 12:00» — два занятия в неделю). Разовая встреча, которой в
// расписании нет, в норму недели не входит — иначе одна пятница раздула бы
// месячный абонемент на лишнее занятие.
export function weeklyRate(student) {
  const list = (student?.lessons || []).filter((l) => l?.date)
  const slots = new Map()
  for (const l of list) {
    const d = fromIsoDate(l.date)
    if (!d) continue
    const key = `${d.getDay()} ${l.time || ""}`
    slots.set(key, (slots.get(key) || 0) + 1)
  }
  const regular = [...slots.values()].filter((n) => n > 1).length
  if (regular) return regular
  // Расписание ещё не повторилось (занятия расставлены на одну неделю вперёд
  // или ученик разовый) — считаем занятия первой недели абонемента.
  const from = startOf(student) || list.map((l) => l.date).sort()[0]
  const d = fromIsoDate(from)
  if (!d) return 1
  d.setDate(d.getDate() + 6)
  const until = toIso(d)
  return Math.max(1, list.filter((l) => l.date >= from && l.date <= until).length)
}

// Сколько занятий в одном периоде: занятий в неделю × недель в периоде.
// Отдельного поля у ученика нет намеренно — число обязано следовать за
// расписанием: стал ходить трижды в неделю, и «месяц» это уже двенадцать
// занятий, а не восемь.
export function packageSize(student) {
  const weeks = PERIODS.find((p) => p.key === periodKeyOf(student))?.weeks || 1
  return Math.max(1, weeklyRate(student) * weeks)
}

// Периоды абонемента: подряд идущие куски списка занятий по packageSize штук,
// начиная с даты, с которой считается абонемент. Период НАЧАЛСЯ, когда пришёл
// день его первого занятия, — с этого дня он и начисляется целиком.
//
// Границы периода — даты его первого и последнего занятия, а не календарное
// окно: у периода, который меряется занятиями, другого начала и конца нет.
export function packagePeriods(student, now = new Date()) {
  if (!onPackage(student)) return []
  const start = startOf(student)
  const size = packageSize(student)
  const list = (student?.lessons || [])
    .filter((l) => countable(l) && l.date >= start)
    .sort(byDateTime)
  const today = toIso(now)
  const out = []
  for (let i = 0; i < list.length; i += size) {
    const lessons = list.slice(i, i + size)
    out.push({
      period: periodKeyOf(student),
      size,
      from: lessons[0].date,
      until: lessons[lessons.length - 1].date,
      lessons,
      started: lessons[0].date <= today,
    })
  }
  return out
}

// Период, в котором мы сейчас, — последний начавшийся. Пока не начался ни
// один, показываем первый: ученик уже на абонементе, и период у него есть,
// просто он ещё впереди.
export function currentPeriod(student, now = new Date()) {
  const all = packagePeriods(student, now)
  if (!all.length) return null
  const started = all.filter((p) => p.started)
  return started.length ? started[started.length - 1] : all[0]
}

// Сумма, вписанная руками за период. Пусто, ноль и мусор — это «считай по
// расписанию»: пустое поле не должно молча обнулять долг.
export function packageAmount(student) {
  const v = Number(student?.packageAmount ?? student?.package_amount)
  return Number.isFinite(v) && v > 0 ? v : null
}

// Сколько стоит один период: вписанная сумма важнее расчётной. Период без
// занятий не стоит ничего даже при вписанной сумме — начислять не за что, а
// деньги, ни к чему не привязанные, разошлись бы с квитанциями и списком
// неоплаченных занятий.
export function periodAmount(student, period, price = Number(student?.lessonPrice ?? student?.lesson_price ?? 0)) {
  const lessons = period?.lessons || []
  if (!lessons.length) return { lessons, amount: 0 }
  const manual = packageAmount(student)
  // Расчётная сумма — СУММА ЦЕН занятий периода, а не «занятий × цена»: в
  // периоде могут стоять и обычные занятия, и групповые по своей цене. При
  // одинаковой цене это ровно прежнее число.
  const own = lessons.reduce((sum, l) => sum + lessonPrice(l, price), 0)
  return { lessons, amount: manual != null ? manual : own }
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
  const byDate = byDateTime
  const all = (student?.lessons || []).filter(countable)
  // Занятие без своей цены и без цены в карточке не начисляется вовсе: иначе в
  // долге и в квитанциях появились бы строки на ноль рублей.
  const charged = (l) => lessonPrice(l, price) > 0

  if (!onPackage(student)) {
    return all.filter((l) => charged(l) && isLessonConducted(l, now)).sort(byDate)
      .map((l) => ({ ...l, charge: lessonPrice(l, price) }))
  }

  const start = startOf(student)
  // До абонемента ученик платил как все — по факту проведения.
  const out = all.filter((l) => charged(l) && l.date < start && isLessonConducted(l, now)).sort(byDate)
    .map((l) => ({ ...l, charge: lessonPrice(l, price) }))

  // С началом периода начисляются ВСЕ его занятия сразу, ещё до того, как они
  // прошли: в этом и смысл оплаты вперёд.
  for (const p of packagePeriods(student, now)) {
    // Периоды идут по порядку, поэтому первый не начавшийся закрывает список:
    // за то, что ещё не началось, не начисляют.
    if (!p.started) break
    const { lessons, amount } = periodAmount(student, p, price)
    // Период, который ничего не стоит (у карточки нет цены и ни у одного его
    // занятия нет своей), не начисляется вовсе — иначе в долге и в квитанциях
    // появились бы строки на ноль рублей. Тем же условием `total > 0`
    // заканчивается student_accrual в базе.
    if (!lessons.length || amount <= 0) continue
    const parts = spread(amount, lessons.length)
    lessons.forEach((l, i) => out.push({ ...l, charge: parts[i] }))
  }
  return out
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
    // Для экранов период — это подпись: сколько в нём занятий, с какой по
    // какую дату и на какую сумму. Массив занятий тут схлопывается в число.
    package: cur
      ? { ...cur, lessons: cur.lessons.length,
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
