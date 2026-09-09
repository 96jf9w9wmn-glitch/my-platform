// Подписка устройства на push-уведомления.
//
// Что важно знать про iPhone (остальное работает как везде):
//  • Web Push на iOS есть с 16.4, но ТОЛЬКО в приложении, добавленном на экран
//    «Домой». В обычной вкладке Safari объекта PushManager нет вовсе, поэтому
//    отдельной проверки версии не нужно — достаточно проверить поддержку.
//  • Разрешение спрашивается один раз и только по нажатию: без жеста
//    пользователя iOS молча откажет. Поэтому запрос живёт в кнопке, а не в
//    useEffect при открытии экрана.
//  • Отказали — переспросить из кода нельзя никогда, только руками в
//    настройках iOS. Значит текст у кнопки обязан объяснять, на что человек
//    соглашается, ДО нажатия: второго шанса не будет.
//
// Саму подписку клиент пишет в базу сам, под своей ролью и своим RLS
// (`push_subscriptions`), как и остальные 235 запросов кабинета. Серверу
// достаётся только рассылка: приватный ключ VAPID браузеру показывать нельзя.

import { supabase } from "./supabase"

// applicationServerKey принимает байты, а ключ приезжает строкой base64url.
function keyBytes(base64url) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

// Приложение открыто с домашнего экрана, а не во вкладке браузера.
export function isStandalone() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  )
}

export function isIOS() {
  if (typeof navigator === "undefined") return false
  // iPad с iPadOS представляется как Mac, поэтому одного userAgent мало:
  // отличаем по наличию сенсорного ввода.
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

// Почему подписаться нельзя прямо сейчас — текстом, который можно показать.
// null означает «можно».
export function pushBlockedReason() {
  if (!pushSupported()) {
    if (isIOS() && !isStandalone()) {
      return "Уведомления на iPhone приходят только в приложении с экрана «Домой». Откройте «Поделиться» → «На экран „Домой“» и зайдите уже оттуда."
    }
    return "Этот браузер не умеет присылать уведомления."
  }
  if (Notification.permission === "denied") {
    return "Уведомления запрещены в настройках устройства. Включить их обратно можно только там: «Настройки» → «Уведомления» → Precettore."
  }
  return null
}

async function registration() {
  // ready ждёт активного воркера. В dev его нет вовсе (регистрируем только в
  // проде, см. main.jsx), поэтому ждём не бесконечно.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rej) => setTimeout(() => rej(new Error("service worker не запустился")), 8000)),
  ])
}

// Публичный ключ VAPID берём с сервера, а не из сборки: иначе ротация ключа
// потребовала бы пересборки фронта, а до неё браузер подписывался бы на старый
// ключ и посылки молча отбивались бы шлюзом.
export async function pushAvailable() {
  try {
    const res = await fetch("/api/push")
    if (!res.ok) return null
    const data = await res.json()
    return data.push && data.key ? data.key : null
  } catch {
    return null
  }
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  try {
    const reg = await registration()
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

// Подписать это устройство. Зовётся ТОЛЬКО из обработчика нажатия.
export async function subscribePush(userId) {
  const key = await pushAvailable()
  if (!key) throw new Error("Уведомления пока не настроены на сервере.")

  const permission = await Notification.requestPermission()
  if (permission !== "granted") throw new Error("Вы не разрешили уведомления.")

  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  // Подписка могла остаться от прежнего ключа VAPID — тогда шлюз будет
  // отбивать посылки, а человек видеть тишину. Проще переподписаться.
  if (sub && !sameKey(sub, key)) {
    await sub.unsubscribe().catch(() => {})
    sub = null
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      // Обязательно true: тихих push на iOS нет, и подписка без обещания
      // показывать уведомление просто не выдаётся.
      userVisibleOnly: true,
      applicationServerKey: keyBytes(key),
    })
  }

  const json = sub.toJSON()
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      label: deviceLabel(),
    },
    { onConflict: "endpoint" }
  )
  if (error) throw new Error("Подписка не сохранилась: " + error.message)
  return sub
}

function sameKey(sub, key) {
  const have = sub.options?.applicationServerKey
  if (!have) return true // браузер не говорит — не трогаем рабочую подписку
  const a = new Uint8Array(have)
  const b = keyBytes(key)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export async function unsubscribePush() {
  const sub = await currentSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => {})
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint)
}

// Подпись устройства в списке — чтобы «отключить на этом телефоне» было
// понятно, о каком устройстве речь.
function deviceLabel() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return "iPhone"
  if (/iPad/.test(ua)) return "iPad"
  if (/Android/.test(ua)) return "Android"
  if (/Macintosh/.test(ua)) return "Mac"
  if (/Windows/.test(ua)) return "Windows"
  return "Устройство"
}
