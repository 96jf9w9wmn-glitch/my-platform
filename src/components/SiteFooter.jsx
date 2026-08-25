import Icon from "./Icon"

// Подвал публичных страниц (лендинг, вход, юр-документы): контакт для сообщений
// об ошибках, соцсети и юр-ссылки. Ссылки на соцсети пока МАКЕТЫ — реальные
// адреса подставляются в SOCIALS ниже, менять больше нигде не нужно.

const SUPPORT_EMAIL = "precettore@inbox.ru"
const SUPPORT_SUBJECT = "Ошибка на precettore.ru"

// href: "" — канал ещё не заведён, чип показывается, но никуда не ведёт.
const SOCIALS = [
  {
    key: "telegram",
    // Бот — кабинет репетитора в телефоне, а не служба поддержки: незнакомому
    // человеку он ответит «пришлите код привязки». Подпись честно об этом говорит,
    // иначе ученик пишет в него с вопросом и не получает ответа.
    label: "Telegram-бот",
    hint: "кабинет репетитора в телефоне",
    href: "https://t.me/precettore_tutor_bot",
    soft: "bg-sky-50 dark:bg-sky-900/30",
    text: "text-sky-500 dark:text-sky-400",
    ring: "hover:ring-sky-200 dark:hover:ring-sky-700",
  },
  {
    key: "instagram",
    label: "Instagram",
    hint: "разборы и жизнь платформы",
    href: "",
    soft: "bg-pink-50 dark:bg-pink-900/30",
    text: "text-pink-500 dark:text-pink-400",
    ring: "hover:ring-pink-200 dark:hover:ring-pink-700",
  },
  {
    key: "vk",
    label: "VK",
    hint: "новости и анонсы",
    href: "",
    soft: "bg-blue-50 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
    ring: "hover:ring-blue-200 dark:hover:ring-blue-700",
  },
]

const LEGAL = [
  { href: "/offer", label: "Договор-оферта" },
  { href: "/privacy", label: "Политика конфиденциальности" },
  { href: "/consent", label: "Согласие на обработку ПДн" },
  { href: "/cookie", label: "Cookie" },
  { href: "/rules", label: "Пользовательское соглашение" },
  { href: "/requisites", label: "Реквизиты" },
]

// Фирменные знаки соцсетей. Не в Icon.jsx: там все иконки линейные (fill=none),
// а знаки брендов — заливка, общий <svg> не подходит.
function SocialGlyph({ name, size = 17 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true }
  if (name === "telegram") {
    return (
      <svg {...common} fill="currentColor">
        <path d="M21.6 4.3 18.5 19a1.1 1.1 0 0 1-1.72.62l-4.36-3.2-2.13 2.05a.68.68 0 0 1-1.15-.4l-.42-4.02 8.1-7.3c.28-.25-.06-.4-.42-.18l-9.95 6.26-4.06-1.27c-.9-.28-.92-1.4.2-1.83L20.3 3.05c.75-.28 1.46.17 1.3 1.25Z" />
      </svg>
    )
  }
  if (name === "instagram") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="5.4" />
        <circle cx="12" cy="12" r="4.1" />
        <circle cx="17.2" cy="6.8" r="1.05" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  // VK — словесный знак, как в актуальном логотипе
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4.5 7.5 8.2 16.5 11.9 7.5" />
      <line x1="15" y1="7.5" x2="15" y2="16.5" />
      <polyline points="20 7.5 15 12 20 16.5" />
    </svg>
  )
}

function SocialChip({ s }) {
  const ready = Boolean(s.href)
  return (
    <a
      href={ready ? s.href : "#"}
      {...(ready ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      onClick={ready ? undefined : (e) => e.preventDefault()}
      aria-disabled={ready ? undefined : true}
      title={ready ? s.label : `${s.label} — ссылка появится позже`}
      className={`press-fill flex items-center gap-2.5 rounded-2xl px-3 py-2.5 glass-sm ring-1 ring-transparent ${s.ring} transition-shadow ${ready ? "" : "cursor-default"}`}
    >
      <span className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center ${s.soft} ${s.text}`}>
        <SocialGlyph name={s.key} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-gray-800 leading-tight">{s.label}</span>
        <span className="block text-[11px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5 truncate">{s.hint}</span>
      </span>
    </a>
  )
}

// Юр-ссылки отдельно от подвала: на карточке входа нужны только они,
// без контактов и соцсетей — те живут в подвале страницы.
export function LegalLinks({ className = "" }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-gray-400 dark:text-gray-500 ${className}`}>
      {LEGAL.map((l) => (
        <a key={l.href} href={l.href} className="hover:text-gray-600 transition-colors">
          {l.label}
        </a>
      ))}
    </div>
  )
}

function MailChip({ full = true }) {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`}
      className={`press-fill inline-flex items-center gap-2.5 rounded-2xl px-3 py-2.5 glass-sm ring-1 ring-transparent hover:ring-blue-200 dark:hover:ring-blue-700 transition-shadow ${full ? "" : "text-[13px]"}`}
    >
      <span className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
        <Icon name="mail" size={16} />
      </span>
      <span className="text-[13px] font-semibold text-gray-800">{SUPPORT_EMAIL}</span>
    </a>
  )
}

function SiteFooter() {
  return (
    <footer className="mt-6 border-t border-gray-200/70 dark:border-white/10">
      {/* @container, а не media-query: подвал стоит и в широком лендинге, и в
          узкой колонке юр-страниц — раскладку задаёт ширина самого подвала */}
      <div className="@container max-w-6xl mx-auto w-full px-4 py-10">
        <div className="grid gap-8 @[720px]:grid-cols-3">
          {/* Бренд */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-blue-500/20">
                <img src="/logo.webp" alt="Precettore" className="w-full h-full object-cover" />
              </div>
              <span className="font-bold tracking-tight text-gray-900">Precettore</span>
            </div>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 leading-snug max-w-xs">
              Кабинет репетитора и его учеников: занятия, домашние задания и
              тренировочные варианты ОГЭ и ЕГЭ в одном месте.
            </p>
          </div>

          {/* Связь при ошибке */}
          <div>
            <div className="text-sm font-semibold text-gray-900">Нашли ошибку?</div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-snug max-w-xs">
              Ошибка в задании, неверный ответ или что-то сломалось в кабинете —
              напишите, и я поправлю. Приложите скриншот и название экрана.
            </p>
            <div className="mt-3">
              <MailChip />
            </div>
          </div>

          {/* Соцсети */}
          <div>
            <div className="text-sm font-semibold text-gray-900">Мы на связи</div>
            <div className="mt-3 grid gap-2 sm:max-w-xs">
              {SOCIALS.map((s) => (
                <SocialChip key={s.key} s={s} />
              ))}
            </div>
          </div>
        </div>

        {/* Нижняя строка */}
        <div className="mt-9 pt-5 border-t border-gray-200/70 dark:border-white/10 flex flex-col gap-3 @[1000px]:flex-row @[1000px]:items-center @[1000px]:justify-between">
          <LegalLinks />
          <div className="text-[11px] text-gray-400 dark:text-gray-500 @[1000px]:text-right shrink-0">
            © {new Date().getFullYear()} Precettore · Саркисян А. Н. (самозанятый), ИНН 262308648105
          </div>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
