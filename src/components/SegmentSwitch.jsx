import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

// Сегмент-контрол в стиле iOS: белый «палец» ЕДЕТ к выбранному сегменту, а не
// перекрашивается на месте — перекраска читалась как грубый скачок. Тот же приём
// уже был у RoleSwitch на лендинге, здесь он вынесен для переиспользования.
//
// Положение «пальца» СНИМАЕТСЯ С САМОЙ КНОПКИ (offsetLeft/Top/Width/Height), а не
// вычисляется из доли ширины: сегменты бывают неравные (подпись со счётчиком,
// разная длина слов), и доля тогда промахивается. Замер идёт в useLayoutEffect —
// то есть до отрисовки, поэтому на первом кадре «палец» уже стоит на месте и
// ниоткуда не выезжает. Плавность и уважение к prefers-reduced-motion —
// в классе .seg-finger (index.css).
// В тёмной теме активной подписи нужен ЯРКИЙ синий (blue-400 = #5ac8fa):
// blue-300 там полупрозрачный (rgba(0,122,255,0.5)) и на «пальце» читался хуже
// неактивных соседей — выбранный сегмент выглядел выключенным.
// Мельче этого не делать: подписи сегментов — основной способ переключения
// раздела, и на 12px они читались как служебная подпись, а не как кнопки.
const SIZES = {
  md: { wrap: "p-1 rounded-2xl", btn: "px-6 py-2 text-[15px] font-semibold", finger: "rounded-xl" },
  sm: { wrap: "p-1 rounded-2xl", btn: "px-4 py-1.5 text-sm font-semibold", finger: "rounded-xl" },
}

// equal=false — сегменты по ширине текста, а не поровну. Нужно, когда одна
// подпись заметно длиннее прочих: при равных долях длинное слово вылезало
// за пределы «пальца» (случай «Все / ОГЭ / ЕГЭ / Успеваемость»).
export default function SegmentSwitch({ items, value, onChange, className = "", ariaLabel, size = "md", block = false, equal = true }) {
  const s = SIZES[size] || SIZES.md
  const wrapRef = useRef(null)
  const btnRefs = useRef([])
  const [box, setBox] = useState(null)
  const idx = Math.max(0, items.findIndex((it) => it.key === value))

  const measure = useCallback(() => {
    const el = btnRefs.current[idx]
    if (!el) return
    setBox((prev) => {
      const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }
      return prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next
    })
  }, [idx])

  useLayoutEffect(measure, [measure, items])

  // Ширина сегментов меняется от резины контейнера и от смены шрифта/языка —
  // без этого «палец» остался бы на старом месте после ресайза.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [measure])

  return (
    <div
      ref={wrapRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`relative ${block ? "flex" : "inline-flex"} ${s.wrap} bg-gray-100 border border-gray-200/70 ${className}`}
    >
      {/* прямой ребёнок .bg-gray-100 — в тёмной теме его перекрашивает правило из index.css */}
      {box && (
        <span
          aria-hidden="true"
          className={`seg-finger absolute left-0 top-0 bg-white shadow-sm ${s.finger}`}
          style={{ width: box.w, height: box.h, transform: `translate3d(${box.x}px, ${box.y}px, 0)` }}
        />
      )}
      {items.map((it, i) => (
        <button
          key={it.key}
          ref={(el) => { btnRefs.current[i] = el }}
          role="tab"
          aria-selected={value === it.key}
          onClick={() => onChange(it.key)}
          className={`seg-label relative z-10 ${equal ? "flex-1 basis-0" : "flex-none"} min-w-0 flex items-center justify-center gap-2 whitespace-nowrap ${s.btn} ${s.finger} ${
            value === it.key ? "text-blue-600 dark:text-blue-400" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {it.label ?? it.key}
        </button>
      ))}
    </div>
  )
}
