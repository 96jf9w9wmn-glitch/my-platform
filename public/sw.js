// Service worker для Precettore PWA.
//
// Стратегия по типу ресурса (главное — быстрый старт):
//  • /assets/*-[hash].(js|css) — cache-first. Vite вшивает хэш содержимого в имя
//    файла, поэтому такой файл НИКОГДА не меняется: при любой правке кода имя
//    становится другим. Значит его безопасно отдавать из кэша мгновенно, не
//    дожидаясь сети. Именно это убирает «загрузку 7 секунд» при каждом запуске:
//    раньше network-first заново качал ~3.6 МБ JS даже из кэша.
//  • навигация / index.html — network-first. Маленький файл; берём свежий, чтобы
//    новый деплой подхватывался, а он уже сошлётся на новые хэш-файлы.
//  • прочий same-origin GET — network-first с фолбэком на кэш (офлайн).
//
// При изменении САМОЙ логики воркера — поднимай версию CACHE.
const CACHE = "precettore-v2"

// Мгновенно активируем новую версию воркера, не дожидаясь закрытия вкладок.
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Чистим старые кэши прошлых версий.
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

// Хэшированные ассеты Vite: /assets/index-CBzOmHRR.js и т.п. — контент неизменен.
function isImmutableAsset(url) {
  return url.pathname.startsWith("/assets/")
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)
  // Обрабатываем только GET того же origin. Всё остальное (Supabase, POST и т.п.) — мимо.
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return
  }

  // Cache-first для неизменных ассетов: отдаём из кэша сразу, если есть.
  if (isImmutableAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        // Первый раз — качаем и кладём в кэш навсегда (имя с хэшем).
        const fresh = await fetch(request)
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          const cache = await caches.open(CACHE)
          cache.put(request, fresh.clone())
        }
        return fresh
      })()
    )
    return
  }

  // Навигация и остальное — network-first с фолбэком на кэш (свежесть важнее).
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request)
        // Кладём успешный ответ в кэш для офлайна.
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          const cache = await caches.open(CACHE)
          cache.put(request, fresh.clone())
        }
        return fresh
      } catch (err) {
        // Сеть недоступна — отдаём из кэша, для навигации фолбэк на корень.
        const cached = await caches.match(request)
        if (cached) return cached
        if (request.mode === "navigate") {
          const shell = await caches.match("/")
          if (shell) return shell
        }
        throw err
      }
    })()
  )
})
