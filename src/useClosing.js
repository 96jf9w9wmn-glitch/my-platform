import { useCallback, useEffect, useRef, useState } from "react"

// Плавное закрытие модалок. Появление рисует CSS (.glass-modal → modal-enter),
// а исчезновение так не сделать: компонент размонтируется в момент нажатия и
// анимации проигрываться уже негде. Хук держит модалку лишние 180 мс с классом
// .is-closing и только потом зовёт onClose.
//
// Использование:
//   const { closing, close } = useClosing(onClose)
//   <div className={`... glass-overlay ${closing ? "is-closing" : ""}`} onClick={close}>
//     <div className={`glass-modal ${closing ? "is-closing" : ""}`}>…
// и все места, где раньше вызывался onClose(), зовут close().
export const CLOSE_MS = 180

export function useClosing(onClose, ms = CLOSE_MS) {
  const [closing, setClosing] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  // Повторное нажатие во время ухода ничего не делает: иначе onClose вызвался бы дважды.
  // Таймер обязательно сбрасывается: хук живёт и в страницах, которые не
  // размонтируются, — иначе второе открытие уже не закрылось бы.
  const close = useCallback(() => {
    if (timer.current) return
    setClosing(true)
    timer.current = setTimeout(() => {
      timer.current = null
      setClosing(false)
      onClose?.()
    }, ms)
  }, [onClose, ms])

  return { closing, close, cls: closing ? "is-closing" : "" }
}
