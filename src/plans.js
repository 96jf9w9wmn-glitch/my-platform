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
//
// Откуда цены (19.08.2026). Ориентир — прямой профильный конкурент
// repetitor.tech: 2 990 ₽/мес до 15 учеников и 4 990 ₽/мес без ограничений
// (сверки рынка — docs/upgrade-prompt.md, раздел M5). Плюс проверка снизу:
// «Про» — это меньше одного занятия в месяц при выручке репетитора 100–150
// тыс. ₽, то есть ~1,5% его оборота. Прежние 990/2490 равнялись цене голой
// CRM для учебных центров (Параплан) — без банка заданий, доски и ИИ, то есть
// без всего, ради чего платформу и берут.
//
// Год = десять месяцев вместо двенадцати; это обещание напечатано в интерфейсе
// («Тарифы» в components/PricingPlans.jsx), поэтому year должен оставаться
// ровно month × 10.

export const UNLIMITED = -1

// Страховочный потолок ИИ-генераций для тарифов, где лимит объявлен
// безлимитным (сейчас таких нет — «Макс» получил честное число, см. ниже).
// Оставлен как защита от скрипта и утёкшего токена: DeepSeek считает деньги за
// каждый запрос, а единственной защитой иначе остаётся rate-limit по адресу
// (8/мин — это до 345 000 генераций в месяц).
export const AI_SOFT_CAP = 2000

export const PLANS = [
  {
    id: "start",
    name: "Старт",
    tagline: "Расписание и переписка с тремя учениками",
    price: { month: 0, year: 0 },
    limits: { students: 3, aiHomework: 0 },
    // На бесплатном тарифе включены только расписание и чат (они всегда «✓» и
    // флагов не имеют). Всё остальное — домашние задания, финансы, банк
    // заданий, доска, варианты, аналитика — начинается с «Про».
    features: {
      homework: false,
      finance: false,
      taskBank: false,
      board: false,
      variants: false,
      analytics: false,
      onlinePay: false,
      boardHistory: false,
      parentReports: false,
      telegramBot: false,
      prioritySupport: false,
    },
    // Что показываем в карточке тарифа (коротко, без повтора таблицы ниже)
    highlights: [
      "До 3 учеников",
      "Расписание занятий",
      "Чат с учениками и родителями",
    ],
  },
  {
    id: "pro",
    name: "Про",
    tagline: "Рабочий тариф для практикующего репетитора",
    price: { month: 1990, year: 19900 },
    limits: { students: 15, aiHomework: 150 },
    features: {
      homework: true,
      finance: true,
      taskBank: true,
      board: true,
      variants: true,
      analytics: true,
      onlinePay: true,
      boardHistory: true,
      parentReports: true,
      telegramBot: true,
      prioritySupport: false,
    },
    popular: true,
    highlights: [
      "До 15 учеников",
      "Домашние задания, финансы, доска",
      "Банк заданий, варианты и печатные тетради",
      "Результаты и аналитика по ученикам",
      "ИИ-генерация ДЗ — 150 в месяц",
      "Онлайн-оплата занятий учениками",
      "Телеграм-бот: расписание и ДЗ в телефоне",
      "История досок и отчёты родителям",
    ],
  },
  {
    id: "studio",          // id в базе и в чеках менять нельзя — только имя
    name: "Макс",
    tagline: "Когда учеников много и лимиты только мешают",
    price: { month: 4900, year: 49000 },
    // Учеников — сколько угодно, а ИИ-генерации ограничены числом: каждая
    // стоит денег в DeepSeek, и «без лимита» превращало тариф в открытый кран
    // при утёкшем токене. 600 в месяц — вчетверо больше «Про» и заведомо выше
    // живого пользования (самый плотный месяц у репетитора — сотни).
    limits: { students: UNLIMITED, aiHomework: 600 },
    features: {
      homework: true,
      finance: true,
      taskBank: true,
      board: true,
      variants: true,
      analytics: true,
      onlinePay: true,
      boardHistory: true,
      parentReports: true,
      telegramBot: true,
      prioritySupport: true,
    },
    // Визуальный флаг для карточки тарифа: старший тариф рисуется тонированным
    // стеклом с более заметной рамкой — так же, как popular у «Про».
    highlighted: true,
    highlights: [
      "Учеников без ограничений",
      "ИИ-генерация ДЗ — 600 в месяц",
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
  { key: "schedule", kind: "always", label: "Расписание занятий" },
  { key: "chat", kind: "always", label: "Чат с учениками и родителями" },
  { key: "homework", kind: "bool", label: "Домашние задания и проверка" },
  { key: "finance", kind: "bool", label: "Финансы: оплаты и долги" },
  { key: "taskBank", kind: "bool", label: "Банк заданий и печатные тетради" },
  { key: "board", kind: "bool", label: "Совместная доска" },
  { key: "variants", kind: "bool", label: "Сборка вариантов ОГЭ/ЕГЭ и PDF" },
  { key: "analytics", kind: "bool", label: "Результаты и аналитика по ученикам" },
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

// Есть ли тариф с бо́льшим лимитом ИИ-генераций, чем на этом. Нужно, чтобы не
// предлагать «купите тариф дороже» тому, кто уже на старшем тарифе: дороже
// некуда, и такое сообщение выглядит издевательством.
export function hasHigherAiLimit(planId) {
  const current = planById(planId).limits.aiHomework
  if (current === UNLIMITED) return false
  return PLANS.some((p) => {
    const other = p.limits.aiHomework
    return other === UNLIMITED || other > current
  })
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
