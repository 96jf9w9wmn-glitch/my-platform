import NavIcon from "./NavIcon"

const navItems = [
  { label: "Главная", id: "dashboard" },
  { label: "Ученики", id: "students" },
  { label: "Расписание", id: "schedule" },
  { label: "Задания", id: "homework" },
  { label: "Чат", id: "chat" },
  { label: "Оплата", id: "payment" },
  { label: "Результаты", id: "results" },
  { label: "Банк заданий", id: "taskgen" },
  { label: "Подписка", id: "subscription" },
]

function Sidebar({ activePage, setActivePage, badges = {} }) {
  return (
    <div className="sidebar-glass w-52 h-dvh sticky top-0 p-4 flex flex-col">
      <div className="flex items-center gap-2.5 mb-5 px-1">
        <img src="/logo.webp" alt="Логотип" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-600 tracking-wide">Precettore</span>
      </div>
      <div className="flex flex-col gap-1">
        {navItems.map((item) => (
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
    </div>
  )
}

export default Sidebar
