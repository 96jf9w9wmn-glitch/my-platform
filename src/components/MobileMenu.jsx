import { createPortal } from "react-dom"
import NavIcon from "./NavIcon"
import { useClosing } from "../useClosing"

// Лист «Меню» на телефоне: шторка снизу со ВСЕМИ разделами кабинета — полная
// карта, а не остаток, как прежнее «Ещё». Открывается кнопкой-бургером в
// нижней панели, поэтому и выезжает снизу, из-под пальца, а не сбоку: боковую
// шторку пользователь счёл неудобной — до верхнего бургера тянуться далеко.
// Разметка пунктов повторяет боковое меню десктопа.
//
// footer — render-prop, а не элемент: пункту внизу (профиль репетитора) нужен
// close(), чтобы шторка ушла с анимацией, а не пропала при размонтировании.
function MobileMenu({ items, activeId, badges = {}, onSelect, onClose, footer }) {
  const { cls, close } = useClosing(onClose)

  return createPortal(
    <div className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end" onClick={close}>
      <div className={`absolute inset-0 glass-overlay ${cls}`} />
      <div
        className={`relative glass-modal sheet-modal p-4 max-h-[85dvh] overflow-y-auto ${cls || "slide-up"}`}
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/20 mx-auto mb-4" />
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
        {footer && (
          <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
            {footer(close)}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default MobileMenu
