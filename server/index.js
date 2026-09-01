// HTTP-сервер для функций из `api/` на своём сервере — замена Vercel.
//
// Зачем переехали: база с персональными данными уже в РФ (242-ФЗ закрыт), но
// функции `api/` обрабатывали те же данные на серверах американской компании,
// а это трансграничная передача по ст. 12 152-ФЗ — отдельное уведомление РКН
// до начала передачи, причём США не в списке стран с адекватной защитой.
// Плюс Vercel уже ограничивал российские аккаунты и оплату.
//
// Главная идея: НЕ переписывать обработчики. У Vercel контракт функции — это
// обычные node-шные `IncomingMessage`/`ServerResponse` плюс несколько сахарных
// полей (`req.body`, `req.query`, `res.status().json()`). Здесь мы досыпаем
// ровно этот сахар и зовём тот же `export default`. Поэтому файлы в `api/`
// продолжают работать и на Vercel, и у нас — откат сводится к переключению DNS,
// а не к откату кода.
//
// Статику (`dist/`) отдаёт Caddy напрямую, сюда приходит только `/api/*`.
// Разворачивание целиком — `docs/hosting.md`.

import http from "node:http"

import authLogin from "../api/auth-login.js"
import authSignup from "../api/auth-signup.js"
import generateHw from "../api/generate-hw.js"
import phoneVerify from "../api/phone-verify.js"
import lessonReport from "../api/lesson-report.js"
import subscription from "../api/subscription.js"
import subscriptionWebhook from "../api/subscription-webhook.js"
import telegram from "../api/telegram.js"
import yookassa from "../api/yookassa.js"
import yookassaWebhook from "../api/yookassa-webhook.js"
import { startEmailQueue } from "./emailQueue.js"

// Таблица адресов задана явно, а не сборкой пути из URL: путь из запроса,
// подставленный в import, — это обход каталогов и запуск чужого файла.
// Заодно все модули грузятся на старте, поэтому опечатка в импорте валит
// контейнер сразу, а не на первом обращении репетитора.
const ROUTES = {
  "/api/auth-login": authLogin,
  "/api/auth-signup": authSignup,
  "/api/generate-hw": generateHw,
  "/api/phone-verify": phoneVerify,
  "/api/lesson-report": lessonReport,
  "/api/subscription": subscription,
  "/api/subscription-webhook": subscriptionWebhook,
  "/api/telegram": telegram,
  "/api/yookassa": yookassa,
  "/api/yookassa-webhook": yookassaWebhook,
}

const PORT = Number(process.env.PORT) || 8787
// Тело больше этого не читаем. У Vercel лимит был свой (4.5 МБ), здесь по
// умолчанию нет никакого — без явного потолка одна долгая заливка занимает
// память процесса. Файлы к нам не ходят: вложения ученик кладёт в Storage
// напрямую, сюда приходят только JSON-запросы.
const MAX_BODY = Number(process.env.MAX_BODY_BYTES) || 2 * 1024 * 1024

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on("data", (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("payload too large"), { statusCode: 413 }))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

// Разбор тела ровно как у Vercel: JSON → объект, форма → объект, текст → строка,
// пустое тело → undefined. Обработчики повсюду пишут `req.body?.foo`, поэтому
// важно отдать именно undefined, а не пустой объект.
function parseBody(raw, contentType) {
  if (!raw.length) return undefined
  const type = String(contentType || "").split(";")[0].trim().toLowerCase()
  if (type === "application/json") {
    try {
      return JSON.parse(raw.toString("utf8"))
    } catch {
      throw Object.assign(new Error("invalid json"), { statusCode: 400 })
    }
  }
  if (type === "application/x-www-form-urlencoded") {
    return Object.fromEntries(new URLSearchParams(raw.toString("utf8")))
  }
  if (type.startsWith("text/")) return raw.toString("utf8")
  return raw
}

function parseQuery(searchParams) {
  const out = {}
  for (const key of searchParams.keys()) {
    if (key in out) continue
    const all = searchParams.getAll(key)
    // Повторяющийся параметр Vercel отдаёт массивом — повторяем поведение,
    // чтобы `?a=1&a=2` не молча превращалось в одно значение.
    out[key] = all.length > 1 ? all : all[0]
  }
  return out
}

function decorate(res) {
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (body) => {
    if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.end(JSON.stringify(body))
    return res
  }
  res.send = (body) => {
    if (body === undefined || body === null) return res.end()
    if (typeof body === "object" && !Buffer.isBuffer(body)) return res.json(body)
    if (!res.headersSent && !res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8")
    }
    res.end(body)
    return res
  }
  res.redirect = (a, b) => {
    const [code, url] = typeof a === "number" ? [a, b] : [302, a]
    res.statusCode = code
    res.setHeader("Location", url)
    res.end()
    return res
  }
  return res
}

const server = http.createServer(async (req, res) => {
  decorate(res)

  let url
  try {
    url = new URL(req.url, "http://localhost")
  } catch {
    res.status(400).json({ error: "Bad request" })
    return
  }

  // Проверка живости. Два адреса не по забывчивости: `/healthz` зовёт
  // healthcheck контейнера изнутри, `/api/healthz` — деплой снаружи, и наружу
  // Caddy пускает только `/api/*`.
  //
  // Заодно показывает адрес, который сервер видит у клиента: на этом адресе
  // держится и ограничитель частоты, и проверка вебхука ЮKassa, поэтому после
  // каждой правки прокси адрес надо перепроверять живьём — см. docs/hosting.md.
  if (url.pathname === "/healthz" || url.pathname === "/api/healthz") {
    res.status(200).json({
      ok: true,
      routes: Object.keys(ROUTES).length,
      ip: req.headers["x-real-ip"] || req.socket.remoteAddress || null,
    })
    return
  }

  const handler = ROUTES[url.pathname.replace(/\/+$/, "") || url.pathname]
  if (!handler) {
    res.status(404).json({ error: "Not found" })
    return
  }

  req.query = parseQuery(url.searchParams)

  try {
    req.body = parseBody(await readBody(req), req.headers["content-type"])
  } catch (e) {
    res.status(e.statusCode || 400).json({ error: e.message })
    return
  }

  try {
    await handler(req, res)
  } catch (e) {
    // Ошибку наружу не пересказываем: в тексте исключения бывают ключи и
    // куски запросов к базе. В журнал — целиком, клиенту — только код.
    console.error(`[api] ${url.pathname} упал:`, e)
    if (!res.headersSent) res.status(500).json({ error: "Internal error" })
    else res.end()
  }
})

// ИИ-генерация домашки ходит в DeepSeek и с «размышлениями» занимает до 120 с
// (см. `maxDuration` в api/generate-hw.js) — дефолтные 300 с запаса хватает, но
// заголовки должны прийти быстро, иначе висящее соединение держит воркер.
server.headersTimeout = 30_000
server.requestTimeout = 180_000
server.keepAliveTimeout = 65_000

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[api] слушаю :${PORT}, адресов: ${Object.keys(ROUTES).length}`)
  // Дублирование уведомлений репетитора на почту: очередь наполняет база,
  // разбираем её здесь — из базы наружу в SMTP не сходить.
  startEmailQueue()
})

// Без этого `docker compose restart` ждёт 10 с и убивает процесс по SIGKILL,
// обрывая запрос на полуслове.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`[api] ${sig}, закрываюсь`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 10_000).unref()
  })
}
