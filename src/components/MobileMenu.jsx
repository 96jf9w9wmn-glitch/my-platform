import { createPortal } from "react-dom"
import NavIcon from "./NavIcon"
import { useClosing } from "../useClosing"

// Бургер-меню телефона: шторка с полным списком разделов, выезжает слева по
// кнопке в верхней панели. Заменила нижнюю панель вкладок: разделов стало
// больше, чем помещалось внизу подписями, и половина пряталась за листом
// «Ещё». Разметка пунктов повторяет боковое меню десктопа — меню одно и то
// же, просто в другой подаче.
//
// footer — render-prop, а не элемент: пункту внизу (профиль репетитора) нужен
// close(), чтобы шторка ушла с анимацией, а не пропала при размонтировании.
function MobileMenu({ title, items, activeId, badges = {}, onSelect, onClose, footer }) {
  const { cls, close } = useClosing(onClose)

  return createPortal(
    <div className="md:hidden fixed inset-0 z-[60]" onClick={close}>
      <div className={`absolute inset-0 glass-overlay ${cls}`} />
      <div
        className={`absolute inset-y-0 left-0 w-64 max-w-[85vw] drawer-glass p-4 flex flex-col overflow-y-auto no-scrollbar ${cls}`}
        style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))", paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 mb-5 px-1">
          <img src="/logo.webp" alt="Логотип" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-600 tracking-wide">{title}</span>
        </div>
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => { onSelect(item.id); close() }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 focus:outline-none border border-transparent ${
                activeId === item.id ? "nav-active font-medium" : "text-gray-600 hover:bg-white/40"
              }`}
            >
              <NavIcon id={item.icon || item.id} size={18} />
              <span className="flex-1 text-left">{item.label}</span>
              {badges[item.id] > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium flex-shrink-0">
                  {badges[item.id] > 9 ? "9+" : badges[item.id]}
                </span>
              )}
            </button>
          ))}
        </div>
        {footer ? footer(close) : null}
      </div>
    </div>,
    document.body
  )
}

export default MobileMenu
