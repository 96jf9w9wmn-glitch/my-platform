import NavIcon from "./NavIcon"
import { useSubscription } from "../subscription"
import { effectivePlan } from "../plans"
import { isOwner } from "../owner"

// Только рабочие разделы. Всё про сам аккаунт (подписка, код для учеников,
// выход) живёт в «Профиле» — он открывается из блока внизу меню, поэтому
// список вкладок не растёт от каждой такой мелочи.
const navItems = [
  { label: "Главная", id: "dashboard" },
  { label: "Ученики", id: "students" },
  { label: "Расписание", id: "schedule" },
  { label: "Задания", id: "homework" },
  { label: "Чат", id: "chat" },
  { label: "Оплата", id: "payment" },
  { label: "Результаты", id: "results" },
  // Виден только владельцу платформы: это просмотр генераторов, а не
  // возможность тарифа (см. src/owner.js).
  { label: "Банк заданий", id: "taskgen", ownerOnly: true },
]

function Sidebar({ activePage, setActivePage, badges = {}, name, email }) {
  const { sub } = useSubscription()
  const plan = effectivePlan(sub)
  const title = name || email || "Профиль"
  const letter = title.trim().charAt(0).toUpperCase()
  const active = activePage === "profile"

  return (
    <div className="sidebar-glass w-52 h-dvh sticky top-0 p-4 flex flex-col">
      <div className="flex items-center gap-2.5 mb-5 px-1">
        <img src="/logo.webp" alt="Логотип" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-600 tracking-wide">Precettore</span>
      </div>
      <div className="flex flex-col gap-1">
        {navItems.filter((item) => !item.ownerOnly || isOwner(email)).map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 focus:outline-none border border-transparent ${
              activePage === item.id
                ? "nav-active font-medium"
                : "text-gray-600 hover:bg-white/40"
            }`}
          >
            <NavIcon id={item.id} size={18} />
            <span className="flex-1 text-left">{item.label}</span>
            {badges[item.id] > 0 && (
              <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium flex-shrink-0">
                {badges[item.id] > 9 ? "9+" : badges[item.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Профиль репетитора: аккаунт и подписка. Прижат к низу — так же, как
          в почте и мессенджерах, где «это я» всегда в нижнем углу. */}
      <button
        onClick={() => setActivePage("profile")}
        className={`mt-auto w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all duration-200 focus:outline-none border border-transparent ${
          active ? "nav-active" : "hover:bg-white/40"
        }`}
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #0A84FF 0%, #5E5CE6 100%)" }}
        >
          {letter}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm truncate ${active ? "font-medium" : "text-gray-600"}`}>{title}</span>
          <span className="block text-[11px] text-gray-400 truncate">Тариф «{plan.name}»</span>
        </span>
      </button>
    </div>
  )
}

export default Sidebar
