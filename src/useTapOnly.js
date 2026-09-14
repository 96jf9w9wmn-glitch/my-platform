import { useRef } from "react"

// Нажатие, которое не путается с листанием.
//
// Браузер прощает пальцу движение примерно в полтора десятка точек и всё равно
// шлёт `click`: на мышке это верно (рука дрожит), а на телефоне — нет, потому
// что ровно таким движением список и листают. Отсюда жалоба репетитора «открыл
// уведомления — просматриваются сами, без нажатия»: палец вёл список, браузер
// считал это нажатием, уведомление гасло, а при заголовке с переходом кабинет
// ещё и уезжал на другую вкладку. Замерено на стенде: движение до 12 точек
// доходит нажатием, с 20 уже нет.
//
// Здесь нажатием считается только то, при чём палец почти не двигался И список
// под ним не прокрутился. Клавиатурный «клик» (Enter на кнопке) приходит без
// pointerdown — его пропускаем как есть.
const SLOP = 6

function scrollTopOf(el) {
  for (let n = el; n; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1) return n.scrollTop
  }
  return 0
}

export function useTapOnly(onTap) {
  const start = useRef(null)
  return {
    onPointerDown: (e) => {
      start.current = { x: e.clientX, y: e.clientY, scroll: scrollTopOf(e.currentTarget) }
    },
    onClick: (e) => {
      const s = start.current
      start.current = null
      if (s) {
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > SLOP) return
        if (scrollTopOf(e.currentTarget) !== s.scroll) return
      }
      onTap(e)
    },
  }
}
