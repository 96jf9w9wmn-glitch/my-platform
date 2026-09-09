// Бот сам забирает обновления у Telegram (long polling) вместо вебхука.
//
// ЗАЧЕМ. Вебхук требует, чтобы Telegram достучался ДО нас, а сервер стоит в
// России, и этот путь не работает: доставки от 91.108.5.79 то проходили, то
// отваливались с «Connection timed out», и зависшие обновления не разбирались
// вовсе. Наружу при этом мы ходим (см. extra_hosts в docker-compose.web.yml),
// поэтому направление меняется: не «Telegram стучится к нам», а «мы спрашиваем
// Telegram». Проверено на боевом — getUpdates вернул те самые нажатия, которые
// вебхук доставить не смог.
//
// ВАЖНО: вебхук и getUpdates взаимно исключают друг друга — при установленном
// вебхуке Telegram отвечает на getUpdates ошибкой 409. Поэтому поллер сам
// снимает вебхук на старте и по 409, а самонастройка вебхука в api/telegram.js
// в этом режиме отключена. Двух поллеров быть не должно по той же причине:
// параллельные getUpdates дают 409 друг другу.
//
// Смещение (offset) в памяти процесса: Telegram держит необработанные
// обновления у себя, пока их не подтвердят следующим запросом с offset. При
// перезапуске контейнера неподтверждённое придёт заново — это лучше, чем
// потерять, а повтор ответа для бота безобиден.

import { botDb, handleUpdate } from "../api/telegram.js"

const API = "https://api.telegram.org"
// 25 с — Telegram держит соединение открытым, пока нет событий. Меньше — лишние
// запросы вхолостую, больше — риск разрыва по таймауту у промежуточных узлов.
const LONG_POLL_S = 25
const ERROR_PAUSE_MS = 5000

let offset = 0
let stopped = false

const token = () => process.env.TELEGRAM_BOT_TOKEN || ""

async function tg(method, payload, timeoutMs) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(`${API}/bot${token()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ac.signal,
    })
    return await r.json().catch(() => null)
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

async function dropWebhook() {
  // Очередь не сбрасываем: там могут лежать нажатия, которые вебхук не довёз.
  await tg("deleteWebhook", { drop_pending_updates: false }, 20000)
}

async function loop() {
  const db = botDb()
  if (!db) {
    console.log("[телеграм] TELEGRAM_DB_SECRET не задан — боту нечего читать, опрос не запущен")
    return
  }

  await dropWebhook()
  console.log(`[телеграм] опрос обновлений раз в ${LONG_POLL_S} с`)

  while (!stopped) {
    const res = await tg("getUpdates", {
      offset,
      timeout: LONG_POLL_S,
      allowed_updates: ["message", "callback_query"],
    }, (LONG_POLL_S + 10) * 1000)

    if (!res) {
      // Сеть моргнула. Пауза, иначе при недоступном Telegram мы бы крутили
      // цикл без остановки.
      await new Promise((r) => setTimeout(r, ERROR_PAUSE_MS))
      continue
    }

    if (!res.ok) {
      // 409 — кто-то поставил вебхук (например, зашли в кабинет старой сборкой).
      // Снимаем и продолжаем, а не падаем.
      if (res.error_code === 409) {
        console.error("[телеграм] конфликт с вебхуком, снимаю его")
        await dropWebhook()
      } else {
        console.error("[телеграм] getUpdates:", res.description || "неизвестная ошибка")
      }
      await new Promise((r) => setTimeout(r, ERROR_PAUSE_MS))
      continue
    }

    for (const update of res.result || []) {
      // Сдвигаем смещение ДО обработки: обновление, на котором обработчик
      // падает, иначе возвращалось бы вечно и бот встал бы на нём намертво.
      offset = Math.max(offset, (update.update_id || 0) + 1)
      try {
        await handleUpdate(db, update)
      } catch (e) {
        console.error("[телеграм] обновление не обработано:", e?.message || e)
      }
    }
  }
}

export function startTelegramPolling() {
  if (!token()) {
    console.log("[телеграм] TELEGRAM_BOT_TOKEN не задан — опрос не запущен")
    return
  }
  loop().catch((e) => console.error("[телеграм] опрос остановлен:", e))
}

export function stopTelegramPolling() {
  stopped = true
}
