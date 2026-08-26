import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import UpdateToast from './components/UpdateToast.jsx'

if (localStorage.getItem("theme") === "dark") {
  document.documentElement.classList.add("dark")
}

// Синхронизируем высоту приложения с реально видимой областью (visualViewport):
// dvh на iOS не учитывает клавиатуру, а 100vh — панель Safari
function syncAppHeight() {
  const vv = window.visualViewport
  if (vv && vv.scale > 1) return // пользователь зумит — не трогаем
  document.documentElement.style.setProperty("--app-h", `${vv ? vv.height : window.innerHeight}px`)
}
// Ширина полосы прокрутки: её место всегда зарезервировано (scrollbar-gutter:
// stable), а под открытым полноэкранным оверлеем резерв снимается — иначе
// оверлей не доходил бы до правого края. Чтобы страница под оверлеем при этом
// не расширялась на ширину полосы (дёргалась вправо), CSS возвращает эти
// пиксели паддингом по --sbw. Меряем только когда оверлея нет: при открытом
// резерв уже снят и получился бы 0.
function syncScrollbarWidth() {
  // Меряем отдельным пробником, а не разницей innerWidth и clientWidth: разница
  // зависит от того, скроллится ли документ прямо сейчас и применился ли уже
  // scrollbar-gutter, и на старте давала 0 там, где полоса на самом деле есть.
  const probe = document.createElement("div")
  probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll"
  document.body.appendChild(probe)
  const w = probe.offsetWidth - probe.clientWidth
  probe.remove()
  document.documentElement.style.setProperty("--sbw", `${w > 0 ? w : 0}px`)
}
syncScrollbarWidth()
// Полоса может смениться на ходу: подключили мышь, сменили системную настройку,
// перетащили окно на другой монитор.
window.addEventListener("resize", syncScrollbarWidth)

syncAppHeight()
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", syncAppHeight)
  window.visualViewport.addEventListener("scroll", syncAppHeight)
}
window.addEventListener("resize", syncAppHeight)
window.addEventListener("orientationchange", syncAppHeight)
// Safari восстанавливает вкладку из bfcache со старым состоянием — пересинхронизируем
window.addEventListener("pageshow", () => {
  window.scrollTo(0, 0)
  syncAppHeight()
})
// После закрытия клавиатуры Safari может оставить страницу «запаркованной» со сдвигом
document.addEventListener("focusout", () => {
  setTimeout(() => {
    window.scrollTo(0, 0)
    syncAppHeight()
  }, 60)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* Открытая вкладка сама не узнаёт о раскатке — плашка предлагает обновиться */}
    <UpdateToast />
  </StrictMode>,
)

// Снимаем стартовый экран (см. #splash в index.html) после первого кадра React:
// двойной rAF — чтобы приложение успело отрисоваться и подмены не было видно.
const splash = document.getElementById("splash")
if (splash) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      // Splash проявляется с задержкой (animation splash-in). Гасим от той
      // прозрачности, до которой он реально успел дойти: при быстрой загрузке
      // это 0 — экран исчезает незаметно, вместо «мигнул и пропал». Анимацию
      // снимаем явно, иначе она перебивает transition затухания.
      const shown = getComputedStyle(splash).opacity
      splash.style.animation = "none"
      splash.style.opacity = shown
      requestAnimationFrame(() => {
        splash.classList.add("splash-off")
        setTimeout(() => splash.remove(), 260)
      })
    })
  )
}

// PWA: регистрируем service worker (офлайн + установка на домашний экран).
// Только в проде — в dev SW мешает hot-reload.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW registration failed:", err)
    })
  })
}
