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
const CACHE = "precettore-v3"

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

// Картинки и значки в корне. Имени с хэшем у них нет, но меняются они раз в
// год, а качались при КАЖДОМ запуске приложения: на боевом телефоне это
// логотип на экране загрузки, то есть прямо на пути к первому кадру. Отдаём из
// кэша сразу и обновляем в фоне — новая картинка доедет к следующему запуску.
const STATIC_RE = /\.(webp|png|jpg|jpeg|svg|ico|woff2?)$/i
function isStaticMedia(url) {
  return STATIC_RE.test(url.pathname)
}

// Сколько ждём сеть для страницы, прежде чем показать её из кэша. Приложение
// перезапускается часто (iOS выгружает вкладку), и ждать медленную сеть ради
// двух килобайт разметки — это те самые секунды белого экрана. Свежесть при
// этом не теряется: ответ, пришедший позже, ложится в кэш, а про новую сборку
// вкладке скажет плашка «Вышло обновление» (UpdateToast).
const NAV_TIMEOUT_MS = 1200

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

  // Картинки в корне — из кэша сразу, обновление в фоне.
  if (isStaticMedia(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        const network = fetch(request).then((fresh) => {
          if (fresh && fresh.status === 200 && fresh.type === "basic") {
            caches.open(CACHE).then((c) => c.put(request, fresh.clone()))
          }
          return fresh
        })
        if (cached) { event.waitUntil(network.catch(() => {})); return cached }
        return network
      })()
    )
    return
  }

  // Навигация — сеть, но с ограничением по времени: не ответила за NAV_TIMEOUT_MS,
  // показываем страницу из кэша, а свежую дописываем в кэш, когда придёт.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const network = fetch(request).then((fresh) => {
          if (fresh && fresh.status === 200 && fresh.type === "basic") {
            caches.open(CACHE).then((c) => c.put(request, fresh.clone()))
          }
          return fresh
        })
        const cached = await caches.match(request) || await caches.match("/")
        if (!cached) return network
        const slow = new Promise((r) => setTimeout(() => r(null), NAV_TIMEOUT_MS))
        const first = await Promise.race([network.catch(() => null), slow])
        event.waitUntil(network.catch(() => {}))
        return first || cached
      })()
    )
    return
  }

  // Остальное — network-first с фолбэком на кэш (свежесть важнее).
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
