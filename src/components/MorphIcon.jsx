import { useEffect, useRef, useState } from "react"
import Icon from "./Icon"

// Иконка, которая с пружинкой перетекает в другую (по умолчанию — в галочку):
// при наведении на кнопку-родителя либо по флагу `active` (например, когда текст
// уже скопирован или пришло уведомление).
//
// Слои лежат друг на друге в боксе фиксированного размера, поэтому подпись рядом
// не дёргается при смене иконки. Пружинка — cubic-bezier с перелётом, аналог
// spring(stiffness 600, damping 25). Hover берём с ближайшей кнопки/ссылки
// событиями указателя, а не CSS `:hover`: тач-тап hover не включает, поэтому
// на телефоне иконка меняется только по `active`.
const SPRING = "transform 260ms cubic-bezier(.34,1.56,.64,1), opacity 160ms ease"

function layerStyle(shown, rotate, leaving) {
  const tilt = rotate ? `rotate(${leaving ? 15 : -15}deg)` : ""
  return {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: shown ? "scale(1)" : `scale(0.5) ${tilt}`,
    opacity: shown ? 1 : 0,
    transition: SPRING,
  }
}

function MorphIcon({ from, to = "check", size = 14, active = false, rotate = false, dot = false, toClassName = "", className = "" }) {
  const ref = useRef(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const host = ref.current?.closest("button, a, [role='button']")
    if (!host) return
    // Тач-тап шлёт pointerenter, но «навести и убрать» пальцем нельзя — иконка
    // залипла бы в галочке, поэтому касания игнорируем.
    const enter = (e) => { if (e.pointerType !== "touch") setHovered(true) }
    const leave = () => setHovered(false)
    host.addEventListener("pointerenter", enter)
    host.addEventListener("pointerleave", leave)
    host.addEventListener("pointercancel", leave)
    host.addEventListener("blur", leave)
    return () => {
      host.removeEventListener("pointerenter", enter)
      host.removeEventListener("pointerleave", leave)
      host.removeEventListener("pointercancel", leave)
      host.removeEventListener("blur", leave)
    }
  }, [])

  const shown = active || hovered

  return (
    <span
      ref={ref}
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span style={layerStyle(!shown, rotate, shown)}>
        <Icon name={from} size={size} />
      </span>
      <span style={layerStyle(shown, rotate, !shown)} className={toClassName}>
        <Icon name={to} size={size} />
        {dot && (
          <span
            className="absolute top-0 right-0 rounded-full bg-red-500"
            style={{
              width: Math.max(4, Math.round(size / 3.5)),
              height: Math.max(4, Math.round(size / 3.5)),
              transform: shown ? "scale(1)" : "scale(0)",
              transition: "transform 240ms cubic-bezier(.34,1.9,.5,1) 90ms",
            }}
          />
        )}
      </span>
    </span>
  )
}

export default MorphIcon
