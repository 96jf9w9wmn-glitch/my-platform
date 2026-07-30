// Тарифы подписки репетитора на платформу — ЕДИНСТВЕННЫЙ источник правды.
//
// Файл специально сделан «чистым» JS без React и без импортов: его подключают
// и клиент (страница «Подписка», ограничения в интерфейсе), и серверные
// функции в api/ (проверка права на ИИ-генерацию и онлайн-оплату). Разъезд
// цен или лимитов между клиентом и сервером — самый дорогой баг в биллинге,
// поэтому цифры живут ровно в одном месте.
//
// Деньги за подписку идут ПЛАТФОРМЕ (магазин ЮKassa платформы), в отличие от
// оплаты занятий, где магазин оформлен на самого репетитора (см. docs/yookassa.md).
//
// −1 в лимите означает «без ограничений».

export const UNLIMITED = -1

export const PLANS = [
  {
    id: "start",
    name: "Старт",
    tagline: "Попробовать платформу на паре учеников",
    price: { month: 0, year: 0 },
    limits: { students: 3, aiHomework: 0 },
    features: {
      variants: false,
      onlinePay: false,
      boardHistory: false,
      parentReports: false,
      telegramBot: false,
      prioritySupport: false,
    },
    // Что показываем в карточке тарифа (коротко, без повтора таблицы ниже)
    highlights: [
      "До 3 учеников",
      "Расписание, задания, чат, финансы",
      "Банк заданий: просмотр и тренировка",
      "Совместная доска",
    ],
  },
  {
    id: "pro",
    name: "Про",
    tagline: "Рабочий тариф для практикующего репетитора",
    price: { month: 990, year: 9900 },
    limits: { students: 25, aiHomework: 150 },
    features: {
      variants: true,
      onlinePay: true,
      boardHistory: true,
      parentReports: true,
      telegramBot: true,
      prioritySupport: false,
    },
    popular: true,
    highlights: [
      "До 25 учеников",
      "Сборка вариантов ОГЭ/ЕГЭ и PDF",
      "ИИ-генерация ДЗ — 150 в месяц",
      "Онлайн-оплата занятий учениками",
      "Телеграм-бот: расписание и ДЗ в телефоне",
      "История досок и отчёты родителям",
    ],
  },
  {
    id: "studio",
    name: "Студия",
    tagline: "Для большого потока и небольшой команды",
    price: { month: 2490, year: 24900 },
    limits: { students: UNLIMITED, aiHomework: UNLIMITED },
    features: {
      variants: true,
      onlinePay: true,
      boardHistory: true,
      parentReports: true,
      telegramBot: true,
      prioritySupport: true,
    },
    highlights: [
      "Учеников без ограничений",
      "ИИ-генерация ДЗ без лимита",
      "Всё из «Про»",
      "Приоритетная поддержка",
    ],
  },
]

export const PLAN_IDS = PLANS.map((p) => p.id)
export const FREE_PLAN_ID = "start"

// Периоды оплаты. Год дешевле двух месяцев — скидку не считаем формулой,
// а храним готовой ценой, чтобы в интерфейсе и в чеке было одно и то же число.
export const PERIODS = {
  month: { id: "month", months: 1, label: "Месяц", short: "мес" },
  year: { id: "year", months: 12, label: "Год", short: "год" },
}

// Строки сравнительной таблицы. kind: "bool" — галочка/прочерк,
// "limit" — число из limits (−1 → «без ограничений»).
export const FEATURE_ROWS = [
  { key: "students", kind: "limit", label: "Учеников", suffix: "" },
  { key: "core", kind: "always", label: "Расписание, ДЗ, чат, финансы" },
  { key: "bank", kind: "always", label: "Банк заданий и тренировка" },
  { key: "variants", kind: "bool", label: "Сборка вариантов ОГЭ/ЕГЭ и PDF" },
  { key: "aiHomework", kind: "limit", label: "ИИ-генерация ДЗ", suffix: " / мес" },
  { key: "onlinePay", kind: "bool", label: "Онлайн-оплата занятий учениками" },
  { key: "boardHistory", kind: "bool", label: "История досок занятий" },
  { key: "parentReports", kind: "bool", label: "Отчёты родителям об уроке" },
  { key: "telegramBot", kind: "bool", label: "Телеграм-бот репетитора" },
  { key: "prioritySupport", kind: "bool", label: "Приоритетная поддержка" },
]

export function planById(id) {
  return PLANS.find((p) => p.id === id) || PLANS[0]
}

export function priceOf(planId, periodId) {
  const plan = planById(planId)
  return plan.price[periodId] ?? plan.price.month
}

export function monthsOf(periodId) {
  return PERIODS[periodId]?.months || 1
}

// Подписка «живая», только если она оплачена и срок ещё не вышел. Просрочка не
// удаляет строку в базе, а просто перестаёт учитываться — так репетитор видит
// в интерфейсе, какой тариф у него был, и может продлить одной кнопкой.
export function isActive(sub) {
  if (!sub || sub.status !== "active") return false
  if (!sub.current_period_end) return false
  return new Date(sub.current_period_end).getTime() > Date.now()
}

// Фактический тариф: истёкшая подписка = бесплатный «Старт».
export function effectivePlanId(sub) {
  if (!isActive(sub)) return FREE_PLAN_ID
  return PLAN_IDS.includes(sub.plan) ? sub.plan : FREE_PLAN_ID
}

export function effectivePlan(sub) {
  return planById(effectivePlanId(sub))
}

// can(sub, "variants") — доступна ли возможность на текущем тарифе.
export function can(sub, feature) {
  return Boolean(effectivePlan(sub).features[feature])
}

// limitOf(sub, "students") — число или UNLIMITED (−1).
export function limitOf(sub, key) {
  const value = effectivePlan(sub).limits[key]
  return value === undefined ? UNLIMITED : value
}

// Можно ли добавить ещё одну сущность (ученика) при текущем количестве.
export function withinLimit(sub, key, current) {
  const limit = limitOf(sub, key)
  return limit === UNLIMITED || current < limit
}

export function formatLimit(value, suffix = "") {
  if (value === UNLIMITED) return "Без ограничений"
  if (value === 0) return "—"          // «0 / мес» читается как поломка, а не как «нет»
  return `${value}${suffix}`
}

export function formatPrice(rub) {
  return rub === 0 ? "Бесплатно" : `${rub.toLocaleString("ru-RU")} ₽`
}
