import { useState, useEffect } from "react"
import Icon from "../components/Icon"

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
    soft: "bg-blue-50 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-200 dark:ring-blue-700",
    glow: "shadow-blue-500/40",
    tagline: "Ведите всех учеников в одном месте",
    lead: "Хватит держать занятия в заметках, оплаты в табличке, а варианты собирать вручную. Precettore заменяет весь этот зоопарк одним кабинетом.",
    features: [
      { icon: "users", title: "Ученики и профили", desc: "Карточки учеников, прогресс по темам, привязка родителей по коду." },
      { icon: "file-text", title: "Варианты ОГЭ и ЕГЭ за минуту", desc: "Собирайте тренировочные варианты из банка заданий по образцу ФИПИ и выгружайте в PDF." },
      { icon: "clipboard", title: "Домашние задания", desc: "Выдавайте ДЗ и собирайте их ИИ по нужной теме за пару кликов." },
      { icon: "edit", title: "Онлайн-доска и чат", desc: "Разбирайте задачи на общей доске в реальном времени и переписывайтесь с учениками." },
      { icon: "dollar", title: "Финансы без Excel", desc: "Оплаты, расходы и чистая прибыль считаются автоматически." },
      { icon: "calendar", title: "Расписание и напоминания", desc: "Уроки, история занятий и напоминания — всегда под рукой." },
    ],
    steps: [
      { t: "Заведите учеников", d: "Добавьте карточки и раздайте коды родителям." },
      { t: "Соберите вариант", d: "За минуту из банка по образцу ФИПИ — с чертежами и ответами." },
      { t: "Ведите занятия", d: "Доска, ДЗ, расписание и оплаты — в одном кабинете." },
    ],
    cta: { label: "Создать аккаунт репетитора", mode: "register" },
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
    soft: "bg-emerald-50 dark:bg-emerald-900/30",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-200 dark:ring-emerald-700",
    glow: "shadow-emerald-500/40",
    tagline: "Готовьтесь к экзамену без хаоса",
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
    soft: "bg-amber-50 dark:bg-amber-900/30",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-200 dark:ring-amber-700",
    glow: "shadow-amber-500/40",
    tagline: "Будьте в курсе, не вмешиваясь",
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

// 13 предметов банка заданий — ключевая ценность платформы.
const SUBJECTS = [
  { name: "Математика", exam: "ОГЭ" },
  { name: "Русский язык", exam: "ОГЭ" },
  { name: "Информатика", exam: "ОГЭ" },
  { name: "Физика", exam: "ОГЭ" },
  { name: "Химия", exam: "ОГЭ" },
  { name: "Биология", exam: "ОГЭ" },
  { name: "Английский", exam: "ОГЭ" },
  { name: "История", exam: "ОГЭ" },
  { name: "Обществознание", exam: "ОГЭ" },
  { name: "Литература", exam: "ОГЭ" },
  { name: "География", exam: "ОГЭ" },
  { name: "Математика профиль", exam: "ЕГЭ" },
  { name: "Математика база", exam: "ЕГЭ" },
]

const STATS = [
  { n: "13", l: "предметов ОГЭ и ЕГЭ" },
  { n: "Сотни", l: "типов заданий" },
  { n: "по ФИПИ", l: "варианты по образцу" },
  { n: "3-в-1", l: "репетитор, ученик, родитель" },
]

// ── Мини-визуалы (декоративные макеты продукта) ──
function Line({ w = "100%", h = 8, className = "" }) {
  return <div className={`rounded-full bg-gray-200 dark:bg-gray-700 ${className}`} style={{ width: w, height: h }} />
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

function MiniProgressCard({ cfg }) {
  const r = 20, c = 2 * Math.PI * r, pct = 0.78
  return (
    <div className="glass rounded-2xl p-3.5 flex items-center gap-3">
      <div className="relative w-14 h-14 shrink-0">
        <svg viewBox="0 0 48 48" className="w-14 h-14 -rotate-90">
          <circle cx="24" cy="24" r={r} fill="none" strokeWidth="5" className="stroke-gray-200 dark:stroke-gray-700" />
          <circle cx="24" cy="24" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
            className={cfg.text} stroke="currentColor" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900">78%</div>
      </div>
      <div>
        <div className="text-sm font-semibold text-gray-900">Прогресс</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">Готовность к ОГЭ</div>
      </div>
    </div>
  )
}

function MiniScheduleCard() {
  const rows = [
    { d: "Пн", t: "17:00" },
    { d: "Ср", t: "18:30" },
    { d: "Пт", t: "16:00" },
  ]
  return (
    <div className="glass rounded-2xl p-3.5">
      <div className="flex items-center gap-1.5 mb-2.5 text-gray-900">
        <Icon name="calendar" size={14} />
        <span className="text-sm font-semibold">Расписание</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.d} className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500 dark:text-gray-400">{r.d}</span>
            <span className="font-semibold text-gray-900">{r.t}</span>
          </div>
        ))}
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
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
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
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2.5 space-y-1.5">
          {hw.map(([t, done]) => (
            <div key={t} className="flex items-center gap-2 text-[11px]">
              <span className={`w-4 h-4 shrink-0 rounded-full flex items-center justify-center ${done ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" : "bg-gray-200 dark:bg-gray-700 text-gray-400"}`}>
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
        <div className="relative h-28 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden">
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

function Landing({ onStart }) {
  const [role, setRole] = useState("tutor")
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark")
  const cfg = ROLES[role]

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
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDark(!dark)}
              aria-label="Переключить тему"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <span key={dark ? "sun" : "moon"} className={dark ? "icon-sun-enter" : "icon-moon-enter"}>
                {dark ? <Icon name="sun" size={16} /> : <Icon name="moon" size={16} />}
              </span>
            </button>
            <button
              onClick={() => onStart(role, "login")}
              className="text-sm font-medium px-4 py-2 rounded-xl text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-gray-800/70 ring-1 ring-gray-200 dark:ring-gray-700 hover:opacity-80 transition-opacity"
            >
              Войти
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        {/* ── Геро ── */}
        <section className="max-w-6xl mx-auto w-full px-4 pt-10 sm:pt-16 pb-4">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Текст */}
            <div className="text-center lg:text-left">
              <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ring-1 ${cfg.ring} ${cfg.soft} ${cfg.text} mb-5`}>
                <Icon name="sparkles" size={13} />
                Платформа для репетиторов и их учеников
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.05]">
                Вся подготовка к экзамену —{" "}
                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${cfg.grad}`}>
                  в одной платформе
                </span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto lg:mx-0">
                Precettore связывает репетитора, ученика и родителя: занятия, домашние
                задания, тренировочные варианты ОГЭ и ЕГЭ, оплата и прогресс — вместо
                десятка табличек, чатов и тетрадок.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <button
                  onClick={() => onStart("tutor", "register")}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-white font-semibold bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/40 hover:opacity-95 transition-opacity"
                >
                  <Icon name="user-teacher" size={17} />
                  Я репетитор
                </button>
                <button
                  onClick={() => onStart("student", "register")}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-semibold text-gray-800 dark:text-gray-100 bg-white/80 dark:bg-gray-800/80 ring-1 ring-gray-200 dark:ring-gray-700 hover:opacity-90 transition-opacity"
                >
                  <Icon name="book" size={17} />
                  Я ученик
                </button>
              </div>
              <div className="mt-4 text-sm text-gray-400 dark:text-gray-500">
                Бесплатно на старте · без привязки карты
              </div>
            </div>

            {/* Визуал-коллаж */}
            <div className="relative">
              <div className={`absolute -inset-6 rounded-[2rem] bg-gradient-to-br ${cfg.grad} opacity-10 blur-2xl`} />
              <div className="relative grid gap-3">
                <MiniVariantCard cfg={cfg} />
                <div className="grid grid-cols-2 gap-3">
                  <MiniProgressCard cfg={cfg} />
                  <MiniScheduleCard />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Цифры ── */}
        <section className="max-w-6xl mx-auto w-full px-4 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STATS.map((s) => (
              <div key={s.l} className="glass rounded-2xl p-4 text-center">
                <div className={`text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${cfg.grad}`}>{s.n}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Роли ── */}
        <section className="max-w-6xl mx-auto w-full px-4 py-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Одна платформа — три роли</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Выберите свою — и посмотрите, что получите именно вы.</p>
          </div>

          <div className="grid grid-cols-3 gap-2 max-w-xl mx-auto mb-8">
            {Object.entries(ROLES).map(([r, rc]) => {
              const active = role === r
              return (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 transition-all duration-200 ${
                    active
                      ? `bg-gradient-to-br ${rc.grad} text-white border-transparent shadow-lg ${rc.glow}`
                      : `bg-white dark:bg-gray-800 ${rc.text} border-gray-200 dark:border-gray-700`
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? "bg-white/20" : rc.soft}`}>
                    <Icon name={rc.icon} size={18} />
                  </div>
                  <span className="text-xs font-semibold">{rc.tab}</span>
                </button>
              )
            })}
          </div>

          {/* Контент выбранной роли — key перезапускает stagger при переключении */}
          <div key={role} className="slide-up">
            <div className="text-center mb-7">
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{cfg.tagline}</h3>
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
                onClick={() => onStart(role, cfg.cta.mode)}
                className={`inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white font-semibold bg-gradient-to-r ${cfg.grad} shadow-lg ${cfg.glow} hover:opacity-95 transition-opacity`}
              >
                {cfg.cta.label}
                <Icon name="arrow" size={16} />
              </button>
              <div className="mt-3 text-sm text-gray-400 dark:text-gray-500">
                {cfg.note}
                {role !== "parent" && (
                  <>
                    {" · "}
                    <button onClick={() => onStart(role, "login")} className={`font-medium ${cfg.text} hover:opacity-70 transition-opacity`}>
                      Уже есть аккаунт? Войти
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Предметы ── */}
        <section className="max-w-6xl mx-auto w-full px-4 py-10">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Банк заданий по 13 предметам</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Тренировочные варианты по образцу ФИПИ — с чертежами, графиками и ответами.
              Собственные аналоги заданий, а не чужой скрап.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {SUBJECTS.map((s) => (
              <div key={s.name} className="glass-sm rounded-xl px-3.5 py-2 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${s.exam === "ЕГЭ" ? "bg-purple-500" : "bg-blue-500"}`} />
                {/* gray-токены в .dark инвертируются сами — dark:-override не нужен */}
                <span className="text-sm font-medium text-gray-800">{s.name}</span>
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">{s.exam}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Разборы возможностей выбранной роли ── */}
        <section key={`deep-${role}`} className="max-w-6xl mx-auto w-full px-4 py-6 space-y-6 slide-up">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
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

        {/* ── Финальный призыв выбранной роли ── */}
        <section className="max-w-6xl mx-auto w-full px-4 py-10">
          <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${cfg.grad} px-6 sm:px-12 py-12 text-center text-white shadow-xl ${cfg.glow}`}>
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 0%, transparent 45%), radial-gradient(circle at 85% 70%, white 0%, transparent 40%)" }} />
            <div key={`final-${role}`} className="relative slide-up">
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">{cfg.final.title}</h2>
              <p className="mt-3 text-white/80 max-w-xl mx-auto">{cfg.final.sub}</p>
              <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => onStart(cfg.final.primary.role, cfg.final.primary.mode)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-semibold bg-white text-gray-900 shadow-lg hover:opacity-90 transition-opacity"
                >
                  <Icon name={cfg.final.primary.icon} size={17} />
                  {cfg.final.primary.label}
                </button>
                {cfg.final.secondary && (
                  <button
                    onClick={() => onStart(cfg.final.secondary.role, cfg.final.secondary.mode)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-semibold bg-white/15 text-white ring-1 ring-white/40 backdrop-blur-sm hover:bg-white/25 transition-colors"
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

      {/* Футер с юр-ссылками */}
      <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 pb-6 px-4 text-[11px] text-gray-400 dark:text-gray-500">
        <a href="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Политика конфиденциальности</a>
        <a href="/consent" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Согласие на обработку ПДн</a>
        <a href="/cookie" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Cookie</a>
        <a href="/rules" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Правила чата</a>
      </footer>
    </div>
  )
}

export default Landing
