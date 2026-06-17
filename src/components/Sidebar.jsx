import { useState } from "react"

const navItems = [
  { icon: "👥", label: "Ученики", id: "students" },
  { icon: "📅", label: "Расписание", id: "schedule" },
  { icon: "💰", label: "Оплата", id: "payment" },
  { icon: "📝", label: "Варианты", id: "variants" },
  { icon: "📊", label: "Результаты", id: "results" },
]

function Sidebar({ activePage, setActivePage }) {
  return (
    <div className="w-52 min-h-screen bg-gray-100 border-r border-gray-200 p-4">
      <div className="text-sm font-medium text-gray-500 mb-4 px-2">
        Платформа
      </div>
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActivePage(item.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
            activePage === item.id
              ? "bg-white text-gray-900 font-medium shadow-sm border border-gray-200"
              : "text-gray-600 hover:bg-gray-200"
          }`}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

export default Sidebar
