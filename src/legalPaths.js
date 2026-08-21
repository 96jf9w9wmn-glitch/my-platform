// Адреса публичных юридических страниц и их подписи — общий список для
// маршрутизации в App.jsx и для переключателя документов в Legal.jsx.
// Отдельным файлом, потому что Legal.jsx должен экспортировать только
// компоненты (иначе ломается fast refresh).
//
// Тексты самих документов — src/pages/Legal.jsx, утверждённые редакции —
// /legal/*.md. Добавляешь документ — добавляй сюда, в Legal.jsx и в подвал
// (components/SiteFooter.jsx).

export const LEGAL_DOCS = [
  { path: "/offer", short: "Оферта", title: "Договор-оферта на оказание услуг" },
  { path: "/privacy", short: "Политика", title: "Политика конфиденциальности" },
  { path: "/consent", short: "Согласия", title: "Согласия на обработку персональных данных" },
  { path: "/cookie", short: "Cookie", title: "Использование файлов cookie" },
  { path: "/rules", short: "Правила чата", title: "Правила использования чата и пользовательского контента" },
  { path: "/requisites", short: "Реквизиты", title: "Реквизиты и сведения об исполнителе" },
]

export const LEGAL_PATHS = LEGAL_DOCS.map((d) => d.path)
