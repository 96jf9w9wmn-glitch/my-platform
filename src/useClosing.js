import { useCallback, useEffect, useRef, useState } from "react"

// Плавное закрытие модалок. Появление рисует CSS (.glass-modal → modal-enter),
// а исчезновение так не сделать: компонент размонтируется в момент нажатия и
// анимации проигрываться уже негде. Хук держит модалку лишние CLOSE_MS мс с классом
// .is-closing и только потом зовёт onClose.
//
// Использование:
//   const { closing, close } = useClosing(onClose)
//   <div className={`... glass-overlay ${closing ? "is-closing" : ""}`} onClick={close}>
//     <div className={`glass-modal ${closing ? "is-closing" : ""}`}>…
// и все места, где раньше вызывался onClose(), зовут close().
// 240 мс с мягкой кривой — «походка» ухода доски, которую перенесли на весь
// сайт (см. --leave-ms / --leave-ease в index.css). Прежние 180 мс с ease-in
// давали щелчок: блок почти стоял, а последние кадры пролетал рывком.
// Величина обязана совпадать с --leave-ms: по ней снимается компонент, и
// более короткий таймер обрезал бы анимацию на полпути.
export const CLOSE_MS = 240

// Попапы (колокольчик уведомлений, меню на доске) уходят своей анимацией
// (.popup-bubble-out), но по той же длительности — иначе у сайта было бы две
// разные скорости закрытия.
export const POPUP_OUT_MS = CLOSE_MS

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

  // Отмена ухода. Нужна там, где закрытие можно «перебить»: например, разбор
  // варианта сворачивается, а по дороге открыли соседний — иначе отложенный
  // onClose закрыл бы уже другой, только что открытый блок.
  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
    setClosing(false)
  }, [])

  return { closing, close, cancel, cls: closing ? "is-closing" : "" }
}
