// Серверный прокси к DeepSeek для генерации домашних заданий по теме.
// Ключ DEEPSEEK_API_KEY берётся из переменных окружения Vercel и НИКОГДА
// не попадает в клиент. Клиент шлёт только тему/уровень/кол-во.
//
// Настройка: в дашборде Vercel → Project → Settings → Environment Variables
// добавить DEEPSEEK_API_KEY (значение — ключ из platform.deepseek.com).
//
// Тариф. Генерация есть только на платных тарифах, у «Про» — 150 в месяц
// (см. src/plans.js). Проверка идёт по токену репетитора и включается, только
// когда задан SUPABASE_SERVICE_ROLE_KEY: без него сервер не может ни узнать,
// кто пришёл, ни посчитать расход, и функция работает как раньше.
// Побочный плюс: с ключом функция перестаёт быть анонимной — это закрывает
// старый долг «anon-доступ жжёт баланс DeepSeek».

import { admin, tutorFromRequest, bumpAiUsage, refundAiUsage } from "./plan-gate.js"
import { hasHigherAiLimit } from "../src/plans.js"

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
const DEEPSEEK_MODELS_URL = "https://api.deepseek.com/models"
// DeepSeek УЖЕ ломал нас переименованием: `deepseek-chat` сняли, и генерация встала
// с 400. Поэтому имя модели не одно, а список по предпочтению, и при ошибке «нет
// такой модели» функция сама спрашивает /models и берёт живую (см. resolveModel).
export const MODEL_PREFERENCE = ["deepseek-v4-flash", "deepseek-v4-pro"]
const MAX_COUNT = 20
const MAX_TOPIC_LEN = 200

// Имя модели, которое сработало последним, — переиспользуем в тёплом инстансе,
// чтобы не платить лишним запросом к /models на каждую генерацию.
let cachedModel = null

// С включёнными «размышлениями» генерация занимает 10–60 с; дефолтного лимита не хватает.
export const config = { maxDuration: 120 }

// Ограничитель частоты. Функция открыта анонимно, а каждый вызов стоит денег в
// DeepSeek — без лимита один скрипт выжигает баланс за минуты. Счётчик живёт в
// памяти инстанса: на Vercel их несколько, поэтому это не строгий барьер, а
// защита от самого дешёвого злоупотребления. Строгий лимит потребует внешнего
// хранилища (KV/Redis) — отдельным шагом.
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 8            // генераций в минуту с одного адреса
const hits = new Map()        // ip -> [метки времени]

export function rateLimit(ip, now = Date.now()) {
  const fresh = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS)
  if (fresh.length >= RATE_MAX) {
    hits.set(ip, fresh)
    return { ok: false, retryAfter: Math.ceil((RATE_WINDOW_MS - (now - fresh[0])) / 1000) }
  }
  fresh.push(now)
  hits.set(ip, fresh)
  // Карта не должна расти бесконечно: изредка чистим протухшие адреса.
  if (hits.size > 500) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k)
  }
  return { ok: true }
}

// Адрес клиента для лимитера и — важнее — для первой ступени проверки вебхука
// ЮKassa (api/yookassa-webhook.js: сеть отправителя, затем перезапрос платежа).
//
// `x-forwarded-for` присылает сам клиент, и первый его элемент подставляет кто
// угодно (аудит 30.07.2026, P2-3). Поэтому верим только заголовку, который наш
// прокси ПЕРЕЗАПИСЫВАЕТ поверх присланного:
//   Vercel  — `x-vercel-forwarded-for`;
//   свой сервер — `x-real-ip`, его задаёт `header_up X-Real-IP {remote_host}`
//   в Caddyfile (server/Caddyfile.precettore) — правки здесь и там парные.
// XFF убран из цепочки сознательно: за Caddy настоящий адрес дописывается в
// КОНЕЦ списка, так что старое «взять первый» отдавало бы подделку. Последний
// запасной вариант — адрес сокета: он не подделывается, а если прокси однажды
// перестанет слать заголовок, лимит просто станет общим на всех вместо того,
// чтобы пускать вебхук с любого адреса.
export function clientIp(req) {
  const h = req.headers || {}
  const first = (v) => String(v || "").split(",")[0].trim()
  return (
    first(h["x-vercel-forwarded-for"]) ||
    first(h["x-real-ip"]) ||
    String(req.socket?.remoteAddress || "").replace(/^::ffff:/, "") ||
    "unknown"
  )
}

export default async function handler(req, res) {
  const apiKey = process.env.DEEPSEEK_API_KEY

  // GET — health-check без генерации (дёшево, токенов не тратит): показывает, какие
  // модели реально доступны и не разошлось ли это с нашим списком. Дёргается
  // ежедневной задачей статуса, чтобы поломку заметили мы, а не репетитор.
  if (req.method === "GET") {
    if (!apiKey) {
      res.status(500).json({ ok: false, error: "DEEPSEEK_API_KEY не задан на сервере" })
      return
    }
    try {
      const models = await listModels(apiKey)
      const usable = MODEL_PREFERENCE.filter((m) => models.includes(m))
      res.status(usable.length ? 200 : 503).json({
        ok: usable.length > 0,
        model: usable[0] || null,
        preference: MODEL_PREFERENCE,
        available: models,
      })
    } catch (e) {
      res.status(502).json({ ok: false, error: "DeepSeek /models недоступен", detail: String(e).slice(0, 200) })
    }
    return
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const limit = rateLimit(clientIp(req))
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter))
    res.status(429).json({ error: `Слишком часто. Попробуйте через ${limit.retryAfter} с.` })
    return
  }

  if (!apiKey) {
    res.status(500).json({ error: "DEEPSEEK_API_KEY не задан на сервере" })
    return
  }

  // Тариф и месячный лимит. Списываем генерацию ДО обращения к DeepSeek
  // (иначе две вкладки одновременно проскочат мимо лимита), а если генерация
  // не состоялась — возвращаем списанное обратно.
  const db = admin()
  let payer = null
  if (db) {
    const tutor = await tutorFromRequest(db, req)
    if (!tutor) {
      res.status(401).json({ error: "Нужна авторизация репетитора" })
      return
    }
    const usage = await bumpAiUsage(db, tutor.id)
    if (!usage.ok) {
      const canUpgrade = !usage.soft && hasHigherAiLimit(usage.plan?.id)
      res.status(403).json({
        error: usage.soft
          ? `За месяц с аккаунта ушло ${usage.used} ИИ-генераций — это похоже на автоматический перебор. Напишите нам, снимем ограничение.`
          : usage.limit === 0
          ? "ИИ-генерация ДЗ доступна на тарифах «Про» и «Макс»"
          : canUpgrade
          ? `Лимит ИИ-генераций исчерпан: ${usage.used} из ${usage.limit} в этом месяце`
          : `Лимит ИИ-генераций исчерпан: ${usage.used} из ${usage.limit} в этом месяце. Это старший тариф — если генераций нужно больше, напишите нам.`,
        // Тариф дороже не поможет ни мягкому потолку, ни тому, кто уже на
        // старшем тарифе, — предлагать его в этих случаях нечестно.
        upgrade: canUpgrade,
      })
      return
    }
    if (usage.installed) payer = tutor.id
  }
  const refund = () => refundAiUsage(db, payer)

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {}
  const topic = String(body.topic || "").trim().slice(0, MAX_TOPIC_LEN)
  const subject = String(body.subject || "").trim().slice(0, 80)
  const level = String(body.level || "средний").trim().slice(0, 40)
  const count = Math.min(Math.max(parseInt(body.count, 10) || 5, 1), MAX_COUNT)
  // format === "test" — интерактивный тест: к каждому вопросу 4 варианта ответа,
  // ученик выбирает один. Иначе (по умолчанию) — свободный ответ.
  const asTest = String(body.format || "").trim() === "test"

  if (!topic) {
    await refund()
    res.status(400).json({ error: "Не указана тема" })
    return
  }

  const mathRules =
    "Всю математику записывай в простом LaTeX БЕЗ обёрток $...$: дроби — \\frac{a}{b}, " +
    "корни — \\sqrt{x} или \\sqrt[3]{x}, степени — x^{2}, индексы — x_{1}. " +
    "Обычные слова и текст оставляй как есть."

  // Ответ у работы со свободным вводом ученик НАБИРАЕТ с клавиатуры, поэтому
  // LaTeX в нём недопустим: \frac{1}{3} не набрать, и работа теряет
  // автопроверку. Правило касается только свободного ответа — в тесте ответ
  // дословно повторяет вариант, а варианты ученик выбирает мышью.
  const answerRules =
    "ВАЖНО про answer: это ровно то, что ученик впишет в поле ответа с клавиатуры. " +
    "В answer НЕ используй LaTeX, знаки $ и фигурные скобки, не пиши пояснений и единиц измерения. " +
    "Десятичную дробь пиши через запятую (0,5), обыкновенную — как 1/3, " +
    "несколько значений — через точку с запятой (0; 4). " +
    "Если краткого ответа не существует, дай самый короткий словесный (например: нет корней)."

  const system = asTest
    ? "Ты — опытный репетитор, который составляет интерактивные тесты для школьников. " +
      "Отвечай СТРОГО валидным JSON без markdown-обёрток. " +
      "Формат: {\"title\": string, \"description\": string, \"tasks\": " +
      "[{\"question\": string, \"options\": [string, string, string, string], \"answer\": string}]}. " +
      "title — короткое название теста. description — 1-2 предложения инструкции для ученика. " +
      "tasks — массив вопросов с выбором ответа. Для КАЖДОГО вопроса: question — полный текст, " +
      "options — РОВНО 4 коротких, различных варианта ответа, answer — правильный вариант, " +
      "который ДОСЛОВНО совпадает с одним из options (та же строка, без изменений). " +
      "Ровно один вариант правильный, остальные три — правдоподобные, но неверные (типичные ошибки). " +
      "Варианты короткие (число/слово/короткая фраза), не пиши «а)», «1)» и т.п. в начале варианта. " +
      "Пиши по-русски, без ошибок. " + mathRules
    : "Ты — опытный репетитор, который составляет домашние задания для школьников. " +
      "Отвечай СТРОГО валидным JSON без markdown-обёрток. " +
      "Формат: {\"title\": string, \"description\": string, \"tasks\": [{\"question\": string, \"answer\": string}]}. " +
      "title — короткое название ДЗ. description — 1-2 предложения общей инструкции для ученика. " +
      "tasks — массив заданий; question — полный текст задачи, answer — краткий правильный ответ " +
      "(число/слово/короткая фраза). Пиши по-русски, аккуратно и без ошибок в ответах. " +
      mathRules + " " + answerRules

  const user =
    (asTest ? `Составь интерактивный тест с выбором ответа.` : `Составь домашнее задание.`) +
    (subject ? ` Предмет: ${subject}.` : "") +
    ` Тема: «${topic}». Уровень сложности: ${level}. Количество ${asTest ? "вопросов" : "заданий"}: ${count}. ` +
    `${asTest ? "Вопросы" : "Задания"} должны быть разнообразными в рамках темы. Каждое самодостаточно ` +
    `(не ссылается на «предыдущее»). Обязательно укажи правильный ответ к каждому.` +
    (asTest ? ` У каждого вопроса ровно 4 варианта ответа, ровно один верный, answer дословно равен одному из options.` : "")

  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ]

  try {
    let upstream = await chatCompletion(apiKey, cachedModel || MODEL_PREFERENCE[0], messages)

    // 400 про модель — значит имя устарело (так и было с deepseek-chat). Спрашиваем
    // живой список и пробуем ещё раз, а не отдаём репетитору «DeepSeek: 400».
    if (upstream.status === 400) {
      const text = await upstream.text()
      if (/model/i.test(text)) {
        const fallback = await resolveModel(apiKey)
        console.error("DeepSeek: модель устарела, беру", fallback, "—", text.slice(0, 200))
        if (fallback) {
          upstream = await chatCompletion(apiKey, fallback, messages)
          if (upstream.ok) cachedModel = fallback
        }
      } else {
        console.error("DeepSeek error 400", text.slice(0, 500))
        await refund()
        res.status(502).json({ error: "DeepSeek: 400", detail: text.slice(0, 300) })
        return
      }
    }

    if (!upstream.ok) {
      const text = await upstream.text()
      console.error("DeepSeek error", upstream.status, text.slice(0, 500))
      await refund()
      res.status(502).json({ error: `DeepSeek: ${upstream.status}`, detail: text.slice(0, 300) })
      return
    }

    const data = await upstream.json()
    const content = data?.choices?.[0]?.message?.content || ""
    const parsed = safeParse(content)

    if (!parsed || !Array.isArray(parsed.tasks)) {
      await refund()
      res.status(502).json({ error: "Некорректный ответ модели", detail: content.slice(0, 300) })
      return
    }

    const tasks = parsed.tasks
      .filter((t) => t && (t.question || t.q))
      .map((t) => {
        const task = {
          question: String(t.question || t.q || "").trim(),
          answer: String(t.answer ?? t.a ?? "").trim(),
        }
        if (asTest) {
          // Нормализуем варианты: строки, без пустых и дублей.
          let options = Array.isArray(t.options)
            ? t.options.map((o) => String(o ?? "").trim()).filter(Boolean)
            : []
          options = [...new Set(options)]
          // Гарантируем, что правильный ответ есть среди вариантов.
          if (task.answer && !options.includes(task.answer)) options.unshift(task.answer)
          task.options = options
        }
        return task
      })
      // Для теста берём только вопросы с корректным набором (≥2 варианта и ответ среди них).
      .filter((t) => !asTest || (t.options.length >= 2 && t.options.includes(t.answer)))

    res.status(200).json({
      title: String(parsed.title || topic).trim().slice(0, 120),
      description: String(parsed.description || "").trim(),
      tasks,
    })
  } catch (e) {
    await refund()
    res.status(500).json({ error: "Сбой запроса к DeepSeek", detail: String(e).slice(0, 300) })
  }
}

function chatCompletion(apiKey, model, messages) {
  return fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      thinking: { type: "enabled" },
      max_tokens: 8000,
      response_format: { type: "json_object" },
    }),
  })
}

async function listModels(apiKey) {
  const r = await fetch(DEEPSEEK_MODELS_URL, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!r.ok) throw new Error(`models ${r.status}`)
  const j = await r.json()
  return (j?.data || []).map((m) => String(m.id)).filter(Boolean)
}

// Живая модель: сначала наш порядок предпочтения, иначе — любая, что отдал DeepSeek
// (лучше сгенерировать неоптимальной моделью, чем показать ошибку).
async function resolveModel(apiKey) {
  try {
    const models = await listModels(apiKey)
    return MODEL_PREFERENCE.find((m) => models.includes(m)) || models[0] || null
  } catch (e) {
    console.error("DeepSeek /models недоступен", String(e).slice(0, 200))
    return MODEL_PREFERENCE.find((m) => m !== MODEL_PREFERENCE[0]) || null
  }
}

function safeParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    // Модель регулярно отдаёт LaTeX внутри JSON неэкранированным («\log», «\frac»),
    // а это невалидный JSON-эскейп и весь ответ разваливается. Чиним: удваиваем
    // все обратные слэши, которые не начинают допустимый эскейп.
    try {
      return JSON.parse(escapeStrayBackslashes(String(s).replace(/```(?:json)?/gi, "")))
    } catch {
      return null
    }
  }
}

// Удваивает «одинокие» обратные слэши, оставляя настоящие пары (\\, \", \/, \uXXXX).
// Буквенные эскейпы (\n, \t, \f, \b, \r) здесь СПЕЦИАЛЬНО считаются LaTeX-командами:
// в сломанном ответе «\frac», «\times», «\neq» несравнимо вероятнее переноса строки,
// а сюда мы попадаем только после того, как обычный JSON.parse уже упал.
function escapeStrayBackslashes(s) {
  let out = ""
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "\\") {
      out += s[i]
      continue
    }
    const next = s[i + 1]
    const validPair =
      next === "u"
        ? /^[0-9a-fA-F]{4}$/.test(s.slice(i + 2, i + 6))
        : next === '"' || next === "\\" || next === "/"
    if (validPair) {
      out += s[i] + next
      i++
    } else {
      out += "\\\\"
    }
  }
  return out
}
