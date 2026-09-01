import { useState, useEffect } from "react"
import Icon from "../components/Icon"
import MorphIcon from "../components/MorphIcon"
import Collapse from "../components/Collapse"
import FormulaBackdrop from "../components/FormulaBackdrop"
import { TUTOR_STEPS } from "../onboardingSteps"
import { Highlight } from "../components/Mark"
import SiteFooter from "../components/SiteFooter"
import BetaBadge, { BetaNotice } from "../components/BetaBadge"
import { ConsentRow, ConsentLink } from "../components/ConsentChecks"
import { logConsent } from "../consents"
import { supabase } from "../supabase"

// Продающий лендинг перед регистрацией. Объясняет ценность платформы
// и убеждает зарегистрироваться — отдельно для репетитора, ученика и
// родителя. Оформление — тот же iOS-glass, что и во всём приложении;
// акцент-градиент следует за выбранной ролью. Тёмная тема и мобилка учтены.

const ROLES = {
  tutor: {
    icon: "user-teacher",
    tab: "Репетиторам",
    label: "Репетитор",
    grad: "from-blue-500 to-blue-600",
    gradDark: "dark:from-blue-900 dark:to-blue-950",
    ctaDark: { bg: "#0a84ff", fg: "#ffffff" },
    soft: "bg-blue-50 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-200 dark:ring-blue-700",
    glow: "shadow-blue-500/40 dark:shadow-blue-900/30",
    tagline: "Ведите всех учеников в одном месте",
    taglineMark: "в одном месте",
    mark: "blue",
    lead: "Хватит держать занятия в заметках, оплаты в табличке, а варианты собирать вручную. Precettore заменяет весь этот зоопарк одним кабинетом.",
    features: [
      { icon: "users", title: "Ученики и профили", desc: "Карточки учеников, прогресс по темам, привязка родителей по коду." },
      { icon: "file-text", title: "Варианты ОГЭ и ЕГЭ за минуту", desc: "Собирайте тренировочные варианты из банка заданий по образцу ФИПИ и выгружайте в PDF." },
      { icon: "clipboard", title: "Домашние задания", desc: "Выдавайте ДЗ и собирайте их ИИ по нужной теме за пару кликов." },
      { icon: "edit", title: "Онлайн-доска и чат", desc: "Разбирайте задачи на общей доске в реальном времени и переписывайтесь с учениками." },
      { icon: "dollar", title: "Финансы без Excel", desc: "Оплаты, расходы и чистая прибыль считаются автоматически." },
      { icon: "calendar", title: "Расписание и напоминания", desc: "Уроки, история занятий и напоминания — всегда под рукой." },
    ],
    // Тот же список, что показывается репетитору в анкете после регистрации
    steps: TUTOR_STEPS,
    cta: { label: "Создать аккаунт репетитора", mode: "register" },
    card: { title: "Я репетитор", sub: "Ученики, ДЗ, варианты и оплата" },
    pains: [
      { q: "Варианты приходится собирать вручную", a: "Вариант собирается из банка за минуту — с чертежами и ответами, сразу в PDF." },
      { q: "Ученик находит решение в интернете", a: "Задания генерируются заново: готового решения нет ни в поиске, ни у соседа по парте." },
      { q: "Оплаты и долги живут в табличке", a: "Оплаты, расходы и чистая прибыль считаются в кабинете — без Excel и калькулятора." },
      { q: "Домашки теряются в переписке", a: "ДЗ выдаётся в приложении: видно, кто сдал, кто нет и что пора проверить." },
    ],
    hero: {
      // Бейдж над заголовком — свой у каждой роли: тезис «задания генерируются»
      // это выгода репетитора, ученику он читается как запрет, родителю — мимо.
      badge: { icon: "sparkles", text: "Задания генерируются — их нет в интернете" },
      title: "Вся подготовка ваших учеников —",
      accent: "в одном кабинете",
      lead: "Занятия, домашние задания, тренировочные варианты ОГЭ и ЕГЭ, оплаты и прогресс каждого ученика — вместо десятка табличек, чатов и тетрадок.",
    },
    note: "Бесплатно на старте · без привязки карты",
    deep: [
      {
        icon: "file-text",
        kicker: "Банк заданий",
        title: "Тренировочные варианты по образцу ФИПИ",
        desc: "Собирайте варианты за минуту: собственные аналоги заданий с чертежами, графиками и ответами. Выгрузка в PDF — готово к печати и раздаче.",
        bullets: ["Свои аналоги, а не чужой скрап", "Чертежи и графики в задании", "Экспорт варианта в PDF"],
        grad: "from-blue-500 to-blue-600", soft: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400",
        visual: "variant",
      },
      {
        icon: "edit",
        kicker: "Совместная работа",
        title: "Доска, чат и домашки — в реальном времени",
        desc: "Разбирайте задачи на бесконечной онлайн-доске вместе с учеником, переписывайтесь в чате и выдавайте ДЗ — в том числе собранные ИИ по теме.",
        bullets: ["Общая доска с синхронизацией", "Встроенный чат", "ДЗ с помощью ИИ"],
        grad: "from-purple-500 to-purple-600", soft: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400",
        visual: "board",
      },
      {
        icon: "dollar",
        kicker: "Деньги и время",
        title: "Расписание, оплаты и прогресс под контролем",
        desc: "Уроки и напоминания, учёт оплат и расходов с чистой прибылью, наглядный прогресс каждого ученика — без табличек и калькулятора.",
        bullets: ["Оплаты, расходы, чистая прибыль", "Расписание с напоминаниями", "Прогресс по темам"],
        grad: "from-emerald-500 to-teal-600", soft: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400",
        visual: "finance",
      },
    ],
    final: {
      title: "Готовьте к экзаменам умнее",
      sub: "Заведите аккаунт за минуту и соберите первый вариант уже сегодня.",
      primary: { label: "Создать аккаунт репетитора", icon: "user-teacher", role: "tutor", mode: "register" },
      secondary: { label: "Я ученик", icon: "book", role: "student", mode: "register" },
    },
  },
  student: {
    icon: "book",
    tab: "Ученикам",
    label: "Ученик",
    grad: "from-emerald-500 to-teal-600",
    gradDark: "dark:from-emerald-900 dark:to-teal-950",
    ctaDark: { bg: "#30d9b0", fg: "#06251f" },
    soft: "bg-emerald-50 dark:bg-emerald-900/30",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-200 dark:ring-emerald-700",
    glow: "shadow-emerald-500/40 dark:shadow-emerald-900/30",
    tagline: "Готовьтесь к экзамену без хаоса",
    taglineMark: "без хаоса",
    mark: "mint",
    lead: "Все задания, тренировочные варианты и переписка с репетитором — в одном приложении на телефоне. Ничего не потеряется в чатах и тетрадках.",
    features: [
      { icon: "clipboard", title: "Домашние задания", desc: "Все задания от репетитора в одном списке — видно, что сделано." },
      { icon: "target", title: "Тренировочные варианты", desc: "Решайте варианты по образцу ФИПИ и проверяйте себя перед экзаменом." },
      { icon: "trending-up", title: "Наглядный прогресс", desc: "Результаты и рост по темам — видно, где подтянуть." },
      { icon: "message", title: "Чат с репетитором", desc: "Задавайте вопросы прямо в приложении, не теряясь в мессенджерах." },
      { icon: "edit", title: "Онлайн-доска", desc: "Разбирайте задачи вместе в реальном времени." },
      { icon: "users", title: "Несколько репетиторов", desc: "Один аккаунт — все ваши преподаватели и предметы." },
    ],
    steps: [
      { t: "Создайте аккаунт", d: "По номеру телефона за минуту." },
      { t: "Привяжите репетитора", d: "Введите код от преподавателя в опроснике." },
      { t: "Решайте и растите", d: "ДЗ, варианты и прогресс — всё под рукой." },
    ],
    cta: { label: "Создать аккаунт ученика", mode: "register" },
    card: { title: "Я ученик", sub: "Задания, варианты и прогресс" },
    pains: [
      { q: "Кажется, что не успею подготовиться", a: "Занятия, задания и прогресс в одном месте: видно, что уже сделано и что осталось." },
      { q: "На экзамене попадётся незнакомое", a: "Варианты по образцу ФИПИ: те же формулировки, чертежи и бланк ответов." },
      { q: "Решаю одни и те же задачи по кругу", a: "Задание собирается заново — числа и чертёж каждый раз новые." },
      { q: "Забываю, что задали", a: "Задания от репетитора приходят в приложение и не теряются в чатах." },
    ],
    hero: {
      badge: { icon: "target", text: "Варианты как на настоящем экзамене" },
      title: "Вся подготовка к экзамену —",
      accent: "в одном приложении",
      lead: "Домашние задания, тренировочные варианты по образцу ФИПИ и разбор с репетитором — всё в телефоне. Ничего не теряется в чатах и тетрадках.",
    },
    note: "Бесплатно · регистрация по номеру телефона",
    deep: [
      {
        icon: "target",
        kicker: "Тренировка",
        title: "Варианты — как на настоящем экзамене",
        desc: "Решайте тренировочные варианты по образцу ФИПИ: те же формулировки, чертежи и бланки ответов. На экзамене не будет сюрпризов.",
        bullets: ["Задания как на ОГЭ и ЕГЭ", "Чертежи и графики как в настоящих КИМах", "Сразу видно результат и ошибки"],
        grad: "from-emerald-500 to-teal-600", soft: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400",
        visual: "variant",
      },
      {
        icon: "edit",
        kicker: "Занятия",
        title: "Доска и чат с репетитором",
        desc: "Разбирайте задачи на общей онлайн-доске в реальном времени, а вопросы задавайте в чате — не нужно ждать следующего урока.",
        bullets: ["Разбор задач в реальном времени", "Вопрос репетитору — в любой момент", "ДЗ приходят прямо в приложение"],
        grad: "from-purple-500 to-purple-600", soft: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400",
        visual: "board",
      },
      {
        icon: "trending-up",
        kicker: "Мотивация",
        title: "Виден каждый шаг к цели",
        desc: "Готовность к экзамену в процентах, сильные и слабые темы, история результатов — понятно, что уже получается и что подтянуть.",
        bullets: ["Готовность к экзамену в процентах", "Сильные и слабые темы", "История результатов"],
        grad: "from-blue-500 to-blue-600", soft: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400",
        visual: "progress",
      },
    ],
    final: {
      title: "Начните готовиться уже сегодня",
      sub: "Аккаунт за минуту — и все задания, варианты и прогресс всегда в кармане.",
      primary: { label: "Создать аккаунт ученика", icon: "book", role: "student", mode: "register" },
      secondary: { label: "Я репетитор", icon: "user-teacher", role: "tutor", mode: "register" },
    },
  },
  parent: {
    icon: "users",
    tab: "Родителям",
    label: "Родитель",
    grad: "from-amber-500 to-orange-500",
    gradDark: "dark:from-amber-900 dark:to-orange-950",
    ctaDark: { bg: "#ff9f0a", fg: "#2a1705" },
    soft: "bg-amber-50 dark:bg-amber-900/30",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-200 dark:ring-amber-700",
    glow: "shadow-amber-500/40 dark:shadow-amber-900/30",
    tagline: "Будьте в курсе, не вмешиваясь",
    taglineMark: "не вмешиваясь",
    mark: "amber",
    lead: "Видите занятия, задания, оплаты и прогресс ребёнка — прозрачно и в одном месте. По коду от репетитора, отдельный аккаунт заводить не нужно.",
    features: [
      { icon: "bar-chart", title: "Успеваемость", desc: "Результаты и прогресс ребёнка по темам — на виду." },
      { icon: "calendar", title: "Расписание", desc: "Когда и какие занятия проходят — без лишних вопросов." },
      { icon: "dollar", title: "Прозрачные оплаты", desc: "История платежей за занятия без путаницы." },
      { icon: "clipboard", title: "Домашние задания", desc: "Что задано и что уже сделано ребёнком." },
    ],
    steps: [
      { t: "Возьмите код", d: "Репетитор выдаёт код ученика." },
      { t: "Войдите без регистрации", d: "Отдельный аккаунт заводить не нужно." },
      { t: "Следите за успехами", d: "Прогресс, расписание и оплаты — в одном экране." },
    ],
    cta: { label: "Войти по коду ученика", mode: "login" },
    card: { title: "Я родитель", sub: "Успехи и оплаты ребёнка" },
    pains: [
      { q: "Непонятно, занимается ли ребёнок", a: "Видно расписание, сданные домашние задания и результаты — без расспросов." },
      { q: "Неясно, за что именно платим", a: "История оплат по занятиям: каждое занятие и его оплата в одном списке." },
      { q: "А вдруг он просто списывает", a: "Задания генерируются: у каждого ученика свои числа, списать негде." },
      { q: "Нужно заводить ещё один аккаунт", a: "Вход по коду от репетитора — отдельная регистрация не нужна." },
    ],
    hero: {
      badge: { icon: "check", text: "Вход по коду — без регистрации" },
      title: "Успехи ребёнка —",
      accent: "видно без расспросов",
      lead: "Занятия, домашние задания, оплаты и прогресс — прозрачно и в одном месте. По коду от репетитора: отдельный аккаунт заводить не нужно.",
    },
    note: "Код выдаёт репетитор ученика",
    deep: [
      {
        icon: "bar-chart",
        kicker: "Спокойствие",
        title: "Прогресс ребёнка — на виду",
        desc: "Готовность к экзамену в процентах и результаты по темам. Видно динамику от занятия к занятию — без расспросов и догадок.",
        bullets: ["Готовность к экзамену в процентах", "Результаты по темам", "Динамика от месяца к месяцу"],
        grad: "from-amber-500 to-orange-500", soft: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400",
        visual: "progress",
      },
      {
        icon: "dollar",
        kicker: "Прозрачность",
        title: "Оплаты без вопросов",
        desc: "Каждое занятие и его оплата — в одной истории. Всегда понятно, за что и когда заплачено, без пересчётов вручную.",
        bullets: ["Каждое занятие и его оплата", "История платежей в одном месте", "Никаких пересчётов вручную"],
        grad: "from-emerald-500 to-teal-600", soft: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400",
        visual: "finance",
      },
      {
        icon: "calendar",
        kicker: "Порядок",
        title: "Расписание и домашние задания",
        desc: "Календарь занятий и статус домашних заданий: что задано, что сдано, что ждёт. Без переписок с репетитором и уточнений у ребёнка.",
        bullets: ["Календарь занятий недели", "Что задано и что сдано", "Всё видно по коду от репетитора"],
        grad: "from-blue-500 to-blue-600", soft: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400",
        visual: "schedule",
      },
    ],
    final: {
      title: "Будьте в курсе успехов ребёнка",
      sub: "Возьмите код у репетитора и войдите — отдельная регистрация не нужна.",
      primary: { label: "Войти по коду ученика", icon: "users", role: "parent", mode: "login" },
      secondary: null,
    },
  },
}

// Главное отличие платформы: задание собирается заново при каждой выдаче,
// поэтому готового ответа на него нет ни в интернете, ни у соседа по парте.
// Приём вынесен на первый экран по образцу didak.ru, где «защита заданий от
// поиска в интернете» стоит первым пунктом лендинга.
const NO_CHEATING = [
  {
    icon: "repeat",
    title: "Задание собирается заново",
    desc: "Каждый раз новые числа и чертёж. Нагуглить готовое решение не выйдет — такого задания ещё не существовало.",
  },
  {
    icon: "users",
    title: "У каждого ученика — своё",
    desc: "Один и тот же номер приходит разным ученикам с разными числами. Списать у соседа нечего.",
  },
  {
    icon: "file-text",
    title: "Но всё — по образцу ФИПИ",
    desc: "Формулировки, чертежи и бланк ответов как на настоящем экзамене: тренировка честная, а не «похожая».",
  },
]

// ── Мини-визуалы (декоративные макеты продукта) ──
function Line({ w = "100%", h = 8, className = "" }) {
  return <div className={`rounded-full bg-blue-500/15 ${className}`} style={{ width: w, height: h }} />
}

function MiniVariantCard({ cfg }) {
  return (
    <div className="glass rounded-2xl p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.soft} ${cfg.text}`}>
            <Icon name="file-text" size={14} />
          </div>
          <div className="text-sm font-semibold text-gray-900">Вариант ОГЭ · Математика</div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cfg.soft} ${cfg.text}`}>PDF</span>
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${cfg.soft} ${cfg.text}`}>{i}</div>
            <div className="flex-1 space-y-1.5">
              <Line w={i === 2 ? "85%" : "100%"} />
              <Line w={i === 2 ? "60%" : "45%"} h={7} />
            </div>
          </div>
        ))}
      </div>
      <div className={`mt-3 h-8 rounded-xl border border-dashed ${cfg.text} opacity-60 flex items-center px-3 text-[11px] font-medium ${cfg.text}`}>
        Ответ: ________
      </div>
    </div>
  )
}

function DeepVisual({ kind, accent }) {
  if (kind === "variant") return <MiniVariantCard cfg={accent} />
  if (kind === "progress") {
    const topics = [["Алгебра", 82], ["Геометрия", 64], ["Функции", 71]]
    return (
      <div className="glass rounded-2xl p-4 w-full">
        <div className="flex items-center gap-2 mb-3 text-gray-900">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent.soft} ${accent.text}`}><Icon name="trending-up" size={14} /></div>
          <span className="text-sm font-semibold">Прогресс</span>
          <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-md ${accent.soft} ${accent.text}`}>78% к экзамену</span>
        </div>
        <div className="space-y-2.5">
          {topics.map(([t, p]) => (
            <div key={t}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-gray-500 dark:text-gray-400">{t}</span>
                <span className="font-semibold text-gray-900">{p}%</span>
              </div>
              <div className="h-2 rounded-full bg-blue-500/12 overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${accent.grad}`} style={{ width: `${p}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (kind === "schedule") {
    const lessons = [["Пн 17:00", "Математика"], ["Ср 18:30", "Физика"]]
    const hw = [["Уравнения", true], ["Теорема Пифагора", true], ["Вариант №4", false]]
    return (
      <div className="glass rounded-2xl p-4 w-full">
        <div className="flex items-center gap-2 mb-2.5 text-gray-900">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent.soft} ${accent.text}`}><Icon name="calendar" size={14} /></div>
          <span className="text-sm font-semibold">Неделя ребёнка</span>
        </div>
        <div className="space-y-1.5 mb-3">
          {lessons.map(([t, s]) => (
            <div key={t} className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-gray-900">{t}</span>
              <span className="text-gray-500 dark:text-gray-400">{s}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-200 pt-2.5 space-y-1.5">
          {hw.map(([t, done]) => (
            <div key={t} className="flex items-center gap-2 text-[11px]">
              <span className={`w-4 h-4 shrink-0 rounded-full flex items-center justify-center ${done ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" : "bg-blue-500/12 text-gray-400"}`}>
                {done ? <Icon name="check" size={10} /> : <Icon name="clock" size={10} />}
              </span>
              <span className={done ? "text-gray-500 dark:text-gray-400 line-through" : "font-medium text-gray-900"}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (kind === "board") {
    return (
      <div className="glass rounded-2xl p-4 w-full">
        <div className="flex items-center gap-2 mb-3 text-gray-900">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent.soft} ${accent.text}`}><Icon name="edit" size={14} /></div>
          <span className="text-sm font-semibold">Онлайн-доска</span>
        </div>
        <div className="relative h-28 rounded-xl bg-blue-500/[0.06] ring-1 ring-inset ring-blue-500/12 overflow-hidden">
          <svg viewBox="0 0 200 100" className="w-full h-full">
            <path d="M15 70 Q40 20 70 55 T130 45" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={accent.text} />
            <circle cx="150" cy="30" r="12" fill="none" stroke="currentColor" strokeWidth="3" className="text-purple-400" />
            <path d="M20 85 L90 85" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-gray-400" />
          </svg>
          <div className="absolute bottom-2 right-2 glass-sm rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
            <Icon name="message" size={12} />
            <span className="text-[10px] font-medium text-gray-900">Понятно?</span>
          </div>
        </div>
      </div>
    )
  }
  // finance
  const bars = [40, 65, 50, 80, 60, 90]
  return (
    <div className="glass rounded-2xl p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-900">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent.soft} ${accent.text}`}><Icon name="dollar" size={14} /></div>
          <span className="text-sm font-semibold">Финансы</span>
        </div>
        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">▲ 24%</span>
      </div>
      <div className="flex items-end gap-2 h-24">
        {bars.map((b, i) => (
          <div key={i} className={`flex-1 rounded-t-lg bg-gradient-to-t ${accent.grad}`} style={{ height: `${b}%`, opacity: 0.55 + i * 0.07 }} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">Чистая прибыль</span>
        <span className="text-sm font-bold text-gray-900">₽ 84 200</span>
      </div>
    </div>
  )
}

// Ролевая карточка входа. Приём с savemyexams.com: тонированная иконка в
// скруглённом квадрате с кольцом, заголовок, короткая подпись и стрелка справа.
// Кликается вся карточка целиком и ведёт СРАЗУ в нужную форму входа — один клик
// с лендинга до формы. Нажатие — заливкой (.press-fill), а не scale: карточка
// широкая, scale дал бы зазоры по краям.
function RoleCard({ cfg, onClick }) {
  return (
    <button
      onClick={onClick}
      className="press-fill group glass rounded-2xl w-full p-3.5 flex items-center gap-3.5 text-left ring-1 ring-black/5 dark:ring-white/10"
    >
      <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ring-1 ${cfg.ring} ${cfg.soft} ${cfg.text}`}>
        <Icon name={cfg.icon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold text-gray-900 leading-tight">{cfg.card.title}</span>
        <span className="block text-[13px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{cfg.card.sub}</span>
      </span>
      <span className={`shrink-0 ${cfg.text} transition-transform duration-200 group-hover:translate-x-0.5`}>
        <Icon name="arrow" size={17} />
      </span>
    </button>
  )
}

// Сегмент-контрол роли — первый элемент страницы, как на umschool.net и
// webium.ru: пилюля-дорожка и белый «палец», который едет к выбранному
// сегменту. Переключает весь лендинг: заголовок геро, подводку и разборы.
function RoleSwitch({ role, onChange }) {
  const keys = Object.keys(ROLES)
  const idx = keys.indexOf(role)
  return (
    <div
      role="tablist"
      aria-label="Кому платформа"
      /* Дорожка не серая, а еле голубая (серые заливки на стекле читались как
         выцветшие пятна); в .dark — белая прозрачность, а не gray-*, потому что
         серые токены там инвертированы. */
      className="relative flex p-1 rounded-full bg-blue-500/[0.06] dark:bg-white/[0.06] ring-1 ring-blue-500/15 dark:ring-white/10"
    >
      <span
        aria-hidden="true"
        className="seg-finger absolute top-1 bottom-1 left-1 rounded-full bg-white dark:bg-white/[0.14] shadow-sm"
        style={{ width: "calc((100% - 0.5rem) / 3)", transform: `translateX(${idx * 100}%)` }}
      />
      {keys.map((r) => (
        <button
          key={r}
          role="tab"
          aria-selected={role === r}
          onClick={() => onChange(r)}
          className={`no-press relative z-10 flex-1 py-2 px-2 rounded-full text-sm font-semibold transition-colors duration-200 ${
            role === r ? ROLES[r].text : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {ROLES[r].tab}
        </button>
      ))}
    </div>
  )
}

// Блок «что обычно мешает» — приём с umschool.net («Бинго страхов»), но без
// запугивания и без выдуманных цифр «N учеников этого боятся»: карточка — это
// вопрос, который правда задают, а по нажатию раскрывается, как платформа его
// закрывает. Список свой для каждой роли.
function PainCard({ item, index, cfg, open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className="press-fill glass rounded-2xl p-4 text-left w-full flex flex-col gap-2"
    >
      <span className="flex items-center gap-2.5">
        <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold ring-1 ${cfg.ring} ${cfg.soft} ${cfg.text}`}>
          {index + 1}
        </span>
        <span className="flex-1 font-semibold text-gray-900 leading-snug">«{item.q}»</span>
        <span className={`shrink-0 transition-transform duration-300 ${cfg.text} ${open ? "rotate-90" : ""}`}>
          <Icon name="arrow" size={16} />
        </span>
      </span>
      <Collapse open={open}>
        <span className="flex gap-2.5 pt-1 pl-9.5">
          <span className="text-sm text-gray-500 dark:text-gray-400 leading-snug">{item.a}</span>
        </span>
      </Collapse>
    </button>
  )
}

// Опросники вместо формы «пробного занятия»: платформа не школа и учеников не
// подбирает. У каждой роли свой набор вопросов — репетитора спрашиваем про его
// работу, ученика и родителя про то, что у них болит. Ответы приходят в CRM
// вместе с контактом, поэтому первый разговор начинается не с «расскажите о себе».
//
// Формулировки финального шага намеренно ничего не обещают про подбор
// преподавателя: мы этого не делаем, и обещать это в заявке — врать.
const QUIZZES = {
  tutor: {
    steps: [
      {
        id: "subject",
        q: "Какой предмет вы ведёте?",
        hint: "Если несколько — выберите основной",
        options: ["Математика", "Русский язык", "Физика", "Информатика", "Английский", "Другой предмет"],
      },
      {
        id: "students",
        q: "Сколько учеников ведёте сейчас?",
        options: ["1–3", "4–10", "11–20", "Больше 20"],
      },
      {
        id: "tools",
        q: "Где сейчас живут занятия, оплаты и домашки?",
        options: ["В тетради и заметках", "В таблицах Excel или Google", "В другой платформе", "Нигде — держу в голове"],
      },
      {
        id: "pain",
        q: "Что забирает больше всего времени?",
        options: ["Собирать задания и варианты", "Проверять домашние работы", "Расписание и оплаты", "Отчитываться родителям"],
      },
    ],
    finalTitle: "Куда прислать ответ?",
    finalLead: "Покажем кабинет на ваших предметах и поможем перенести учеников. Аккаунт заводить не нужно.",
    doneTitle: "Спасибо, записали",
    doneLead: "Свяжемся по указанному контакту, покажем кабинет и поможем перенести учеников.",
    summaryKeys: ["subject", "students", "tools"],
  },

  student: {
    steps: [
      {
        id: "exam",
        q: "К чему готовишься?",
        options: ["ОГЭ", "ЕГЭ", "Школьная программа", "Олимпиады", "Пока не решил"],
      },
      {
        id: "subject",
        q: "Какой предмет даётся тяжелее всего?",
        options: ["Математика", "Русский язык", "Физика", "Информатика", "Английский", "Другой предмет"],
      },
      {
        id: "pain",
        q: "Что мешает больше всего?",
        hint: "Выбери то, что ближе",
        options: [
          "Не понимаю темы, объясняют быстро",
          "Не знаю, с чего начать и что учить",
          "Нет режима — откладываю до последнего",
          "Решаю, но забываю и не повторяю",
          "Волнуюсь и теряю баллы на ошибках",
        ],
      },
      {
        id: "howNow",
        q: "Как занимаешься сейчас?",
        options: ["С репетитором", "Сам по учебникам и видео", "На курсах", "Никак — только школа"],
      },
    ],
    finalTitle: "Куда прислать ответ?",
    finalLead: "Напишем, как платформа помогает с подготовкой, и что делать с твоей ситуацией. Аккаунт заводить не нужно.",
    doneTitle: "Спасибо, записали",
    doneLead: "Свяжемся по указанному контакту и подскажем, с чего начать подготовку.",
    summaryKeys: ["exam", "subject", "pain"],
  },

  parent: {
    steps: [
      {
        id: "grade",
        q: "В каком классе ребёнок?",
        options: ["5–7 класс", "8–9 класс", "10–11 класс", "Выпускник"],
      },
      {
        id: "goal",
        q: "К чему готовитесь?",
        options: ["ОГЭ", "ЕГЭ", "Подтянуть школьную программу", "Олимпиады", "Пока разбираемся"],
      },
      {
        id: "worry",
        q: "Что беспокоит больше всего?",
        hint: "Выберите то, что ближе",
        options: [
          "Не видно, есть ли прогресс",
          "Не знаю, чем занимаются на занятиях",
          "Ребёнок не занимается без контроля",
          "Занятия идут, а результата нет",
          "Дорого, непонятно за что платим",
        ],
      },
      {
        id: "tutorNow",
        q: "Репетитор сейчас есть?",
        options: ["Да, занимаемся", "Ищем", "Занимались, но бросили", "Нет, справляемся сами"],
      },
    ],
    finalTitle: "Куда прислать ответ?",
    finalLead: "Расскажем, как видеть занятия, домашние задания и прогресс ребёнка. Аккаунт заводить не нужно.",
    doneTitle: "Спасибо, записали",
    doneLead: "Свяжемся по указанному контакту и покажем, как следить за подготовкой ребёнка.",
    summaryKeys: ["grade", "goal", "worry"],
  },
}

function RoleQuiz({ cfg, role }) {
  const quiz = QUIZZES[role]
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [form, setForm] = useState({ name: "", contact: "" })
  const [agreed, setAgreed] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const total = quiz.steps.length + 1          // вопросы + шаг с контактами
  const isContactStep = step === quiz.steps.length
  const canGoBack = !sent && step > 0

  function choose(id, value) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
    setStep((s) => s + 1)
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.contact.trim()) {
      setError("Оставьте имя и способ связи — иначе не сможем ответить")
      return
    }
    if (!agreed) {
      setError("Отметьте согласие на обработку персональных данных — без него заявку принять нельзя")
      return
    }
    setError("")
    setSending(true)
    // Сводка в goal — чтобы суть была видна в списке заявок без раскрытия
    // карточки; полные ответы уходят в answers.
    const summary = quiz.summaryKeys.map((k) => answers[k]).filter(Boolean).join(" · ")
    const { error: err } = await supabase.from("leads").insert({
      name: form.name.trim(),
      contact: form.contact.trim(),
      goal: summary || null,
      source: "квиз",
      role,
      answers,
    })
    setSending(false)
    if (err) {
      setError("Не получилось отправить. Попробуйте ещё раз или напишите нам напрямую.")
      return
    }
    logConsent({ role: "lead", contact: form.contact.trim() })
    setSent(true)
  }

  // Экраны квиза (вопросы → контакты → «спасибо») лежат в ОДНОЙ ячейке грида:
  // высота карточки равна самому высокому экрану и не прыгает при переходе с
  // вопроса на вопрос — вопросы разной длины и с разным числом вариантов.
  // Неактивные экраны остаются в потоке (visibility: hidden), поэтому не ловят
  // фокус, не кликаются и не читаются скринридером.
  // Само перелистывание — в .quiz-panel: экран знает, он позади текущего шага
  // или впереди, и уходит/приходит с нужной стороны, поэтому «Назад»
  // отыгрывается обратной анимацией, а не той же, что «вперёд».
  const current = sent ? quiz.steps.length + 1 : step
  const panelPos = (i) => (i === current ? "active" : i < current ? "before" : "after")

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 max-w-xl mx-auto">
      {/* «Назад» держим наверху и в одном месте: экраны разной высоты, и внизу
          кнопка съезжала бы вслед за списком вариантов — палец промахивается.
          Место резервируем всегда, поэтому на первом шаге и на «спасибо»
          карточка не дёргается. */}
      <button
        type="button"
        tabIndex={canGoBack ? undefined : -1}
        aria-hidden={!canGoBack}
        onClick={() => setStep((s) => s - 1)}
        className={`-ml-1 mb-3 px-1 py-1 text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1.5
          ${canGoBack ? "" : "invisible pointer-events-none"}`}
      >
        <Icon name="arrow" size={14} className="rotate-180" />
        Назад
      </button>

      {/* Прогресс: видно, что вопросов немного и это не анкета на полчаса.
          На экране «спасибо» прячем, но место оставляем — иначе прыжок. */}
      <div className={`flex items-center gap-3 ${sent ? "invisible" : ""}`}>
        <div className="flex-1 h-1.5 rounded-full bg-blue-500/12 dark:bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${cfg.grad} transition-[width] duration-300`}
            style={{ width: `${((step + (isContactStep ? 1 : 0)) / total) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 tabular-nums shrink-0">
          {Math.min(step + 1, total)} из {total}
        </span>
      </div>

      <div className="grid items-start">
        {quiz.steps.map((s, i) => {
          const active = !sent && step === i
          return (
            <div key={`${role}-${s.id}`} className="quiz-panel" data-pos={panelPos(i)} aria-hidden={!active}>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 mt-5">
                {s.q}
              </h3>
              {s.hint && <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{s.hint}</p>}

              <div className="flex flex-col gap-2 mt-5">
                {s.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    tabIndex={active ? undefined : -1}
                    onClick={() => choose(s.id, opt)}
                    className={`press-fill w-full text-left px-4 py-3.5 rounded-2xl ring-1 transition-colors
                      ${answers[s.id] === opt
                        ? `${cfg.soft} ${cfg.text} ${cfg.ring} font-medium`
                        : "bg-white/70 dark:bg-white/[0.06] ring-gray-200 dark:ring-white/10 text-gray-700 hover:bg-white dark:hover:bg-white/[0.12]"}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        <form
          onSubmit={submit}
          className="quiz-panel"
          data-pos={panelPos(quiz.steps.length)}
          aria-hidden={sent || !isContactStep}
        >
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 mt-5">
            {quiz.finalTitle}
          </h3>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{quiz.finalLead}</p>

          <div className="flex flex-col gap-3 mt-5">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Как вас зовут"
              autoComplete="name"
              className="input-glass"
            />
            <input
              value={form.contact}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              placeholder="Телефон или @телеграм"
              className="input-glass"
            />
            <ConsentRow checked={agreed} onChange={setAgreed} accent={cfg.grad}>
              Ознакомлен(а) с <ConsentLink href="/privacy">Политикой конфиденциальности</ConsentLink> и{" "}
              <ConsentLink href="/cookie">Политикой в отношении файлов cookie</ConsentLink>, даю{" "}
              <ConsentLink href="/consent">согласие на обработку персональных данных</ConsentLink> для
              ответа на заявку
            </ConsentRow>
            {error && <div className="text-sm text-red-500">{error}</div>}
            {!agreed && (
              <p className="text-[12px] text-center text-gray-400 dark:text-gray-500">
                Отметьте согласие выше, чтобы отправить заявку
              </p>
            )}
            <button
              type="submit"
              disabled={sending || !agreed}
              className={`press-fill w-full h-[52px] rounded-full text-white font-semibold bg-gradient-to-r ${cfg.grad} shadow-lg ${cfg.glow} disabled:opacity-50`}
            >
              {sending ? "Отправляем…" : "Отправить"}
            </button>          </div>
        </form>

        <div className="quiz-panel text-center" data-pos={panelPos(quiz.steps.length + 1)} aria-hidden={!sent}>
          <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ring-1 mt-5 ${cfg.ring} ${cfg.soft} ${cfg.text}`}>
            <Icon name="check" size={22} />
          </div>
          <h3 className="text-xl font-bold tracking-tight text-gray-900 mt-4">{quiz.doneTitle}</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">{quiz.doneLead}</p>
        </div>
      </div>
    </div>
  )
}

function Landing({ onStart }) {
  // Роль берём сперва из ссылки (?for=parent — чтобы можно было дать родителю
  // прямую ссылку), затем из памяти прошлого захода.
  const [role, setRole] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("for")
    if (fromUrl && ROLES[fromUrl]) return fromUrl
    return localStorage.getItem("preferred_role") || "tutor"
  })
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark")
  const cfg = ROLES[role]

  // Какая из карточек «что обычно мешает» раскрыта (null — все свёрнуты)
  const [openPain, setOpenPain] = useState(null)

  function chooseRole(r) {
    setRole(r)
    setOpenPain(null)
    localStorage.setItem("preferred_role", r)
    // Роль — в адресную строку, без записи в историю: ссылкой можно поделиться,
    // но кнопка «назад» не превращается в перебор ролей.
    const url = new URL(window.location.href)
    url.searchParams.set("for", r)
    window.history.replaceState(null, "", url)
  }

  // Единая точка перехода в Auth: попутно запоминает роль.
  function start(r, mode) {
    localStorage.setItem("preferred_role", r)
    onStart(r, mode)
  }

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [dark])

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Шапка */}
      <header
        className="sticky top-0 z-30 topbar-glass"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.6rem)" }}
      >
        <div className="max-w-6xl mx-auto w-full px-4 pb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-blue-500/20">
              <img src="/logo.webp" alt="Precettore" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold tracking-tight text-gray-900">Precettore</span>
            <BetaBadge />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDark(!dark)}
              aria-label="Переключить тему"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-blue-500/10 rounded-lg"
            >
              <MorphIcon from="moon" to="sun" size={16} active={dark} hover={false} rotate />
            </button>
            <button
              onClick={() => start(role, "login")}
              className="text-sm font-medium px-4 py-2 rounded-full text-gray-700 bg-white/70 dark:bg-white/[0.08] ring-1 ring-gray-200 dark:ring-white/15 hover:opacity-80 transition-opacity"
            >
              Войти
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        {/* ── Геро ── */}
        {/* Фон из формул кладём на всю ширину экрана (а не внутрь max-w-6xl):
            формулы должны лежать в полях по краям, не под текстом. */}
        {/* min-h на широком экране: заголовки ролей разной длины (у «Ученикам»
            на строку больше), и без запаса высоты вся секция прыгала бы при
            переключении роли — вместе с фоном-формулами и карточками входа. */}
        <section className="relative overflow-hidden pt-10 sm:pt-16 pb-10 lg:min-h-[36rem]">
          <FormulaBackdrop variant="hero" />
          <div className="relative z-10 max-w-6xl mx-auto w-full px-4 grid lg:grid-cols-2 gap-10 items-center">
            {/* Текст */}
            <div className="text-center lg:text-left">
              <div className="max-w-sm mx-auto lg:mx-0 mb-6">
                <RoleSwitch role={role} onChange={chooseRole} />
              </div>
              {/* key на роли — бейдж въезжает вместе с заголовком, а не
                  подменяет текст на месте при переключении роли */}
              <div
                key={`badge-${role}`}
                className={`slide-up inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ring-1 ${cfg.ring} ${cfg.soft} ${cfg.text} mb-5`}
              >
                <Icon name={cfg.hero.badge.icon} size={13} />
                {cfg.hero.badge.text}
              </div>
              {/* Все три варианта заголовка лежат в ОДНОЙ клетке грида (друг
                  поверх друга), неактивные — invisible. Высота блока всегда
                  равна самому длинному тексту, поэтому карточки входа под ним
                  не подпрыгивают при переключении роли: у «Родителям» заголовок
                  на строку короче, чем у «Репетиторам». Жёсткий min-h пришлось
                  бы подгонять под каждый брейкпоинт и он бы врал при смене
                  шрифта. key на активном — чтобы текст мягко въезжал. */}
              {/* items-center: у короткой роли лишняя высота делится пополам
                  сверху и снизу — воздух, а не пустота под текстом */}
              <div className="grid items-center">
                {Object.keys(ROLES).map((r) => {
                  const active = r === role
                  return (
                    <div
                      key={active ? `${r}-active` : r}
                      aria-hidden={!active}
                      className={`col-start-1 row-start-1 ${active ? "slide-up" : "invisible"}`}
                    >
                      <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-gray-900 leading-[1.05] text-balance">
                        {ROLES[r].hero.title}{" "}
                        <span className={`text-transparent bg-clip-text bg-gradient-to-r ${ROLES[r].grad}`}>
                          {ROLES[r].hero.accent}
                        </span>
                      </h1>
                      <p className="mt-5 text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto lg:mx-0">
                        {ROLES[r].hero.lead}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Вход по роли: репетитор, ученик, родитель — родителю раньше
                на первом экране места не было вовсе. Карточки стоят справа от
                заголовка: это главное действие первого экрана, а не картинка. */}
            <div className="relative w-full max-w-md mx-auto">
              <div className={`absolute -inset-6 rounded-[2rem] bg-gradient-to-br ${cfg.grad} opacity-10 blur-2xl`} />
              <div className="relative flex flex-col gap-2.5">
                {["tutor", "student", "parent"].map((r) => (
                  <RoleCard key={r} cfg={ROLES[r]} onClick={() => start(r, ROLES[r].cta.mode)} />
                ))}
                <div className="mt-1 text-center text-sm text-gray-400 dark:text-gray-500">
                  Регистрация за минуту · без привязки карты
                </div>
                {/* Про бету говорим сразу на первом экране, рядом с кнопкой
                    входа: человек должен знать это ДО регистрации, а не найти
                    потом в подвале. */}
                <BetaNotice className="mt-3" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Почему задания нельзя нагуглить ── */}
        <section className="max-w-6xl mx-auto w-full px-4 py-8">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 text-center mb-6">
            <Highlight text="Эти задания нельзя нагуглить" mark="нельзя нагуглить" tone={cfg.mark} />
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {NO_CHEATING.map((f) => (
              <div key={f.title} className="glass rounded-2xl p-5 flex flex-col gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ring-1 ${cfg.ring} ${cfg.soft} ${cfg.text}`}>
                  <Icon name={f.icon} size={20} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{f.title}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Что обычно мешает ── */}
        <section className="max-w-6xl mx-auto w-full px-4 py-8">
          <div className="text-center mb-6">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">Что обычно мешает</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Нажмите на знакомое — покажем, как это решается.</p>
          </div>
          {/* items-start: свёрнутая карточка не должна растягиваться под высоту
              раскрытой соседки — иначе под ней зияет пустота */}
          <div key={`pains-${role}`} className="grid sm:grid-cols-2 gap-3 items-start">
            {cfg.pains.map((p, i) => (
              <PainCard
                key={p.q}
                item={p}
                index={i}
                cfg={cfg}
                open={openPain === i}
                onToggle={() => setOpenPain(openPain === i ? null : i)}
              />
            ))}
          </div>
        </section>

        {/* ── Роли ── */}
        <section className="max-w-6xl mx-auto w-full px-4 py-6">
          {/* Контент выбранной роли — key перезапускает stagger при переключении */}
          <div key={role} className="slide-up">
            <div className="text-center mb-7">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
                <Highlight text={cfg.tagline} mark={cfg.taglineMark} tone={cfg.mark} />
              </h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">{cfg.lead}</p>
            </div>

            <div className="stagger grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cfg.features.map((f) => (
                <div key={f.title} className="stat-card glass rounded-2xl p-4 flex flex-col gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.soft} ${cfg.text}`}>
                    <Icon name={f.icon} size={19} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{f.title}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Как это работает */}
            <div className="mt-9">
              <div className="text-center text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-4">
                Как это работает
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {cfg.steps.map((s, i) => (
                  <div key={s.t} className="glass rounded-2xl p-4 flex gap-3">
                    <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br ${cfg.grad} shadow ${cfg.glow}`}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{s.t}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{s.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA роли */}
            <div className="mt-8 text-center">
              <button
                onClick={() => start(role, cfg.cta.mode)}
                className={`press-fill w-full sm:w-auto inline-flex items-center justify-center gap-2 h-[52px] px-7 rounded-full text-white font-semibold bg-gradient-to-r ${cfg.grad} shadow-lg ${cfg.glow} hover:opacity-95 transition-opacity`}
              >
                {cfg.cta.label}
                <Icon name="arrow" size={16} />
              </button>
              <div className="mt-3 text-sm text-gray-400 dark:text-gray-500">
                {cfg.note}
                {role !== "parent" && (
                  <>
                    {" · "}
                    <button onClick={() => start(role, "login")} className={`font-medium ${cfg.text} hover:opacity-70 transition-opacity`}>
                      Уже есть аккаунт? Войти
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Разборы возможностей выбранной роли ── */}
        <section key={`deep-${role}`} className="max-w-6xl mx-auto w-full px-4 py-6 space-y-6 slide-up">
          <div className="text-center">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
              {role === "tutor" ? "Что получает репетитор" : role === "student" ? "Что получает ученик" : "Что видит родитель"}
            </h2>
          </div>
          {cfg.deep.map((d, i) => (
            <div key={d.title} className="glass rounded-3xl p-6 sm:p-8">
              <div className={`grid lg:grid-cols-2 gap-8 items-center ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                <div>
                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${d.soft} ${d.text} mb-3`}>
                    <Icon name={d.icon} size={13} />
                    {d.kicker}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 leading-snug">{d.title}</h3>
                  <p className="mt-3 text-gray-500 dark:text-gray-400">{d.desc}</p>
                  <ul className="mt-4 space-y-2">
                    {d.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2.5 text-sm text-gray-700">
                        <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center ${d.soft} ${d.text}`}>
                          <Icon name="check" size={12} />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <DeepVisual kind={d.visual} accent={d} />
              </div>
            </div>
          ))}
        </section>

        {/* ── Опросник выбранной роли ── */}
        <section className="max-w-6xl mx-auto w-full px-4 py-8">
          {/* key по роли: смена вкладки — это другой опросник, и состояние надо
              начинать с нуля, иначе ответы репетитора уехали бы в заявку родителя. */}
          <RoleQuiz key={role} cfg={cfg} role={role} />
        </section>

        {/* ── Финальный призыв выбранной роли ── */}
        <section className="max-w-6xl mx-auto w-full px-4 py-10">
          <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${cfg.grad} ${cfg.gradDark} px-6 sm:px-12 py-12 text-center text-white shadow-xl dark:shadow-lg ${cfg.glow} dark:ring-1 dark:ring-white/10`}>
            <div className="absolute inset-0 opacity-20 dark:opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 0%, transparent 45%), radial-gradient(circle at 85% 70%, white 0%, transparent 40%)" }} />
            <div key={`final-${role}`} className="relative slide-up">
              <h2 className="font-display text-2xl sm:text-4xl font-semibold tracking-tight">{cfg.final.title}</h2>
              <p className="mt-3 text-white/80 max-w-xl mx-auto">{cfg.final.sub}</p>
              <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => start(cfg.final.primary.role, cfg.final.primary.mode)}
                  style={{ "--cta-dark": cfg.ctaDark.bg, "--cta-dark-fg": cfg.ctaDark.fg }}
                  className="press-fill w-full sm:w-auto inline-flex items-center justify-center gap-2 h-[52px] px-7 rounded-full font-semibold cta-solid shadow-lg hover:opacity-90 transition-opacity"
                >
                  <Icon name={cfg.final.primary.icon} size={17} />
                  {cfg.final.primary.label}
                </button>
                {cfg.final.secondary && (
                  <button
                    onClick={() => start(cfg.final.secondary.role, cfg.final.secondary.mode)}
                    className="press-fill w-full sm:w-auto inline-flex items-center justify-center gap-2 h-[52px] px-7 rounded-full font-semibold bg-white/15 text-white ring-1 ring-white/40 backdrop-blur-sm hover:bg-white/25 transition-colors"
                  >
                    <Icon name={cfg.final.secondary.icon} size={17} />
                    {cfg.final.secondary.label}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

export default Landing
