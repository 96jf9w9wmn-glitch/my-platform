import { createPortal } from "react-dom"
import NavIcon from "./NavIcon"
import Icon from "./Icon"
import { useClosing } from "../useClosing"

// Лист «Меню» на телефоне: шторка снизу со ВСЕМИ разделами кабинета — полная
// карта, а не остаток, как прежнее «Ещё». Открывается кнопкой-бургером в
// нижней панели, поэтому и выезжает снизу, из-под пальца, а не сбоку: боковую
// шторку пользователь счёл неудобной — до верхнего бургера тянуться далеко.
//
// Разделы стоят СЕТКОЙ ПЛИТОК, а не строчками списка: списком девять разделов
// занимали почти весь экран, и до нижних приходилось тянуться; плитками они
// умещаются в три ряда, палец попадает в крупную мишень, а не в тонкую полоску.
// Заливки у плитки нет (правило «никаких серых заливок»): обычная — кольцо,
// текущая — синий тон с синим кольцом, поэтому «где я сейчас» видно сразу.
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
        <div className="w-10 h-1 rounded-full bg-blue-500/25 dark:bg-white/20 mx-auto mb-4" />
        <div className="grid grid-cols-4 gap-2">
          {items.map((item) => {
            const active = activeId === item.id
            const badge = badges[item.id] || 0
            return (
              <button
                key={item.id}
                onClick={() => { onSelect(item.id); close() }}
                className={`press-fill relative flex flex-col items-center gap-2 px-1 pt-3.5 pb-2.5 min-h-[86px] rounded-2xl ring-1 ring-inset transition-colors focus:outline-none ${
                  active
                    ? "bg-blue-500/10 ring-[#007AFF]/30 text-blue-600 dark:text-blue-400 font-medium"
                    : "ring-gray-200/70 dark:ring-white/10 text-gray-600 dark:text-gray-300"
                }`}
              >
                <NavIcon id={item.icon || item.id} size={24} />
                {/* Подпись переносится по словам («Банк заданий»), поэтому
                    высота плитки задана снизу, а не жёстко. */}
                <span className="text-[11px] leading-tight text-center">{item.label}</span>
                {badge > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {footer && (
          <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
            {footer(close)}
          </div>
        )}
        {/* Закрыть можно и тапом мимо шторки, но кнопка нужна: у сетки плиток
            «мимо» — это узкая полоса сверху, и промах открывает случайный раздел. */}
        <button
          onClick={close}
          className="press-fill mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl ring-1 ring-inset ring-gray-200/70 dark:ring-white/10 text-sm text-gray-500 dark:text-gray-400 focus:outline-none"
        >
          <Icon name="x" size={16} /> Закрыть
        </button>
      </div>
    </div>,
    document.body
  )
}

export default MobileMenu
