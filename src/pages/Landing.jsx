import { useState, useEffect } from "react"
import Icon from "../components/Icon"

// Лендинг перед регистрацией: коротко объясняет, что даёт платформа
// каждой из трёх ролей (репетитор / ученик / родитель), и уводит в Auth
// с предвыбранной ролью и режимом. Язык оформления — тот же iOS-glass,
// что и во всём приложении; акцент-градиент следует за выбранной ролью.
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
    tagline: "Веди всех учеников в одном месте",
    lead: "Занятия, задания, варианты ОГЭ и ЕГЭ, оплата и прогресс — без десятка табличек и переписок.",
    features: [
      { icon: "users", title: "Ученики и профили", desc: "Карточки учеников, прогресс, привязка родителей по коду." },
      { icon: "calendar", title: "Расписание", desc: "Уроки, напоминания и история занятий под рукой." },
      { icon: "dollar", title: "Финансы", desc: "Оплаты, расходы и чистая прибыль считаются автоматически." },
      { icon: "file-text", title: "Варианты ОГЭ и ЕГЭ", desc: "Генерация тренировочных вариантов из банка заданий по образцу ФИПИ." },
      { icon: "clipboard", title: "Домашние задания", desc: "Выдавай ДЗ, в том числе собранные ИИ по нужной теме." },
      { icon: "edit", title: "Доска и чат", desc: "Совместная онлайн-доска и переписка с учениками." },
    ],
    cta: { label: "Создать аккаунт репетитора", mode: "register" },
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
    tagline: "Готовься к экзамену без хаоса",
    lead: "Все задания, тренировочные варианты и переписка с репетитором — в одном приложении.",
    features: [
      { icon: "clipboard", title: "Домашние задания", desc: "Все задания от репетитора в одном списке." },
      { icon: "target", title: "Тренировочные варианты", desc: "Решай варианты по образцу ФИПИ и проверяй себя." },
      { icon: "trending-up", title: "Прогресс", desc: "Результаты и рост по темам — наглядно." },
      { icon: "message", title: "Чат с репетитором", desc: "Задавай вопросы прямо в приложении." },
      { icon: "edit", title: "Онлайн-доска", desc: "Разбирайте задачи вместе в реальном времени." },
      { icon: "users", title: "Несколько репетиторов", desc: "Один аккаунт — все твои преподаватели." },
    ],
    cta: { label: "Создать аккаунт ученика", mode: "register" },
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
    lead: "Видите занятия, задания, оплаты и прогресс ребёнка — по коду от репетитора, отдельный аккаунт не нужен.",
    features: [
      { icon: "bar-chart", title: "Успеваемость", desc: "Результаты и прогресс ребёнка на виду." },
      { icon: "calendar", title: "Расписание", desc: "Когда и какие занятия проходят." },
      { icon: "dollar", title: "Оплаты", desc: "Прозрачная история платежей за занятия." },
      { icon: "clipboard", title: "Домашние задания", desc: "Что задано и что уже сделано." },
    ],
    cta: { label: "Войти по коду ученика", mode: "login" },
  },
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
        <div className="max-w-5xl mx-auto w-full px-4 pb-2.5 flex items-center justify-between">
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

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pb-10">
        {/* Геро */}
        <section className="text-center pt-10 sm:pt-14 pb-8">
          <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ring-1 ${cfg.ring} ${cfg.soft} ${cfg.text} mb-5`}>
            <Icon name="sparkles" size={13} />
            Платформа подготовки к ОГЭ и ЕГЭ
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
            Всё для подготовки —{" "}
            <span className={`text-transparent bg-clip-text bg-gradient-to-r ${cfg.grad}`}>
              в одной платформе
            </span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Precettore связывает репетитора, ученика и родителя: занятия, задания,
            тренировочные варианты, оплата и прогресс — в одном месте.
          </p>
        </section>

        {/* Сегменты ролей */}
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
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{cfg.tagline}</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">{cfg.lead}</p>
          </div>

          <div className="stagger grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cfg.features.map((f) => (
              <div key={f.title} className="glass rounded-2xl p-4 flex flex-col gap-3">
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

          {/* CTA роли */}
          <div className="mt-8 text-center">
            <button
              onClick={() => onStart(role, cfg.cta.mode)}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-semibold bg-gradient-to-r ${cfg.grad} shadow-lg ${cfg.glow} hover:opacity-95 transition-opacity`}
            >
              {cfg.cta.label}
              <Icon name="arrow" size={16} />
            </button>
            <div className="mt-3 text-sm text-gray-400 dark:text-gray-500">
              {role === "parent" ? (
                "Код выдаёт репетитор ученика"
              ) : (
                <>
                  Уже есть аккаунт?{" "}
                  <button onClick={() => onStart(role, "login")} className={`font-medium ${cfg.text} hover:opacity-70 transition-opacity`}>
                    Войти
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
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
