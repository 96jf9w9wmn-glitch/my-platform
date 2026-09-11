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
//
// v5 (12.09.2026) поднята НЕ из-за правки логики, а чтобы вычистить залипший
// кэш: страница берётся из сети с таймаутом 1,2 с, и на медленной сети в кэше
// остаётся СТАРЫЙ index.html со ссылками на старые чанки — телефон продолжает
// показывать предыдущую сборку, хотя на сервере уже новая (так и вышло с
// просмотром прошлых занятий). Смена имени кэша удаляет прежний в activate,
// поэтому следующая навигация идёт за свежей страницей.
const CACHE = "precettore-v5"

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

// ── Push-уведомления ────────────────────────────────────────────────────────
//
// На iPhone это работает ТОЛЬКО в приложении, добавленном на экран «Домой»
// (iOS 16.4+); в обычной вкладке Safari нет ни разрешения, ни доставки.
// Посылку расшифровывает само устройство ключами подписки, поэтому текст
// уведомления не видят ни Apple, ни Google — они везут запечатанный конверт.

self.addEventListener("push", (event) => {
  // Показать уведомление ОБЯЗАТЕЛЬНО: тихих push на iOS нет, и посылка без
  // видимого уведомления стоит подписки — система отзовёт её.
  let data = { t: "Precettore", b: "" }
  try {
    if (event.data) data = event.data.json()
  } catch {
    if (event.data) data = { t: "Precettore", b: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(data.t || "Precettore", {
      body: data.b || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // tag со сдвигом по заголовку: одинаковые события схлопываются в одно
      // уведомление вместо стопки, разные лежат отдельно.
      tag: data.t || "precettore",
      data: { url: data.u || "/" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = event.notification.data?.url || "/"
  event.waitUntil(
    (async () => {
      // Если приложение уже открыто — переводим фокус на него, а не открываем
      // второе окно поверх.
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const client of all) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus()
          if ("navigate" in client && target !== "/") await client.navigate(target)
          return
        }
      }
      await self.clients.openWindow(target)
    })()
  )
})
