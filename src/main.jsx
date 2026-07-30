import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

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
