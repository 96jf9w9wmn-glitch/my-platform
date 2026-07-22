// Service worker для Precettore PWA.
// Стратегия: network-first с фолбэком на кэш, чтобы приложение работало офлайн,
// но НЕ залипало на старой версии (главная боль PWA). При каждом деплое меняй CACHE.
const CACHE = "precettore-v1"

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

self.addEventListener("fetch", (event) => {
  const { request } = event
  // Обрабатываем только GET того же origin. Всё остальное (Supabase, POST и т.п.) — мимо.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return
  }

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
