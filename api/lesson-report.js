import { createClient } from "@supabase/supabase-js"
import { rateLimit, clientIp } from "./generate-hw.js"
import { tutorFromRequest } from "./plan-gate.js"

// Отчёт родителю после занятия: на входе — заметки репетитора и результаты
// работ, на выходе строгий JSON, который репетитор правит перед отправкой.
// Балл никому не ставится и ученику ничего не уходит: это черновик письма.
//
// Пара правил взята из горького опыта generate-hw.js:
//  • имя модели — СПИСОК: DeepSeek уже ломал фичу переименованием модели;
//  • GET без тела — health-check, его дёргают задачи статуса;
//  • ответ модели парсим бережно: LaTeX внутри JSON приходит неэкранированным.
const MODEL_PREFERENCE = ["deepseek-chat", "deepseek-v3", "deepseek-reasoner"]
const API = "https://api.deepseek.com"

async function listModels(apiKey) {
  const r = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!r.ok) return []
  const j = await r.json().catch(() => ({}))
  return (j.data || []).map((m) => m.id)
}

async function pickModel(apiKey) {
  const available = await listModels(apiKey)
  const hit = MODEL_PREFERENCE.find((m) => available.includes(m))
  return { model: hit || MODEL_PREFERENCE[0], available }
}

// Модель охотно возвращает JSON с сырыми обратными слэшами из LaTeX — обычный
// JSON.parse на этом падает. Чиним только то, что мешает разбору.
export function safeParse(raw) {
  const text = String(raw || "").replace(/^```(?:json)?|```$/g, "").trim()
  try { return JSON.parse(text) } catch { /* пробуем починить ниже */ }
  const fixed = text.replace(/\\(?!["\\/bfnrtu])/g, "\\\\")
  try { return JSON.parse(fixed) } catch { return null }
}

// Имя ученика сюда НЕ передаётся: DeepSeek — сервис в КНР, а имя школьника это
// персональные данные, и их отправка была бы трансграничной передачей (152-ФЗ).
// Клиент вырезает имя из текста перед отправкой и подставляет обратно в готовый
// черновик; модель пишет вместо имени метку NAME_TOKEN. Поле studentName
// игнорируется намеренно — на случай, если его пришлёт старый билд фронтенда.
const NAME_TOKEN = "{{ИМЯ}}"

// Телефон и почта в заметках модели не нужны ни для чего — вырезаем.
// Телефон ищем строго в формате 3-3-2-2 («+7 (900) 123-45-67», «89001234567»),
// а не «любые 10+ цифр подряд»: широкий шаблон съедает даты занятий 2026-07-29,
// которые в заметках как раз есть.
export function scrubContacts(value) {
  return String(value || "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[почта]")
    .replace(/(?:\+7|\b8|\b7)?[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b/g, "[телефон]")
}

// Тот же клиент под service_role, что и в generate-hw.js: нужен только для
// проверки токена репетитора. Нет ключа — нет проверки (см. handler ниже).
function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function buildPrompt({ period, notes, results, weakTypes }) {
  return [
    "Ты — помощник репетитора. Составь короткий отчёт РОДИТЕЛЮ о занятиях.",
    "Пиши по-русски, спокойно и по делу, без рекламы и без обращения к ученику.",
    "НИЧЕГО НЕ ВЫДУМЫВАЙ: если данных мало, так и напиши в summary и оставь topics пустым.",
    "",
    `Имя ученика не передаётся. Там, где по смыслу нужно имя, пиши ровно ${NAME_TOKEN} —`,
    "эту метку подставят вместо имени уже после тебя. Не придумывай имя сам.",
    "",
    `Период: ${period || "последние занятия"}`,
    `Заметки репетитора: ${notes || "нет"}`,
    `Результаты работ: ${results || "нет"}`,
    `Темы с ошибками: ${weakTypes || "нет данных"}`,
    "",
    "Ответь СТРОГО одним JSON-объектом без пояснений:",
    '{"summary":"2-3 предложения","topics":[{"title":"тема","confidence":"struggling|progress|confident","comment":"одно предложение"}],"next_steps":"что делаем дальше","homework_hint":"что имеет смысл задать"}',
  ].join("\n")
}

export default async function handler(req, res) {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (req.method === "GET") {
    if (!apiKey) {
      res.status(500).json({ ok: false, error: "DEEPSEEK_API_KEY не задан на сервере" })
      return
    }
    try {
      const { model, available } = await pickModel(apiKey)
      res.status(available.length ? 200 : 503).json({ ok: available.length > 0, model, available })
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
    res.setHeader?.("Retry-After", String(limit.retryAfter))
    res.status(429).json({ error: `Слишком часто. Попробуйте через ${limit.retryAfter} с.` })
    return
  }

  // Функция ходит в платный DeepSeek, поэтому анонимной быть не должна: без
  // проверки токена любой желающий жёг бы баланс с чужого адреса (аудит
  // 30.07.2026, P2-1). Логика та же, что в generate-hw.js: если сервер знает
  // service_role — требуем токен репетитора; без ключа работаем как раньше,
  // чтобы забытая переменная окружения не выключила фичу целиком.
  const db = admin()
  if (db && !(await tutorFromRequest(db, req))) {
    res.status(401).json({ error: "Нужна авторизация репетитора" })
    return
  }

  if (!apiKey) {
    res.status(500).json({ error: "DEEPSEEK_API_KEY не задан на сервере" })
    return
  }

  const body = req.body || {}
  if (!body.notes && !body.results) {
    res.status(400).json({ error: "Нет данных для отчёта: нужны хотя бы заметки или результаты" })
    return
  }

  // Второй рубеж: имя вырезает клиент, но телефон или почта могли попасть в
  // свободный текст заметок мимо него. Наружу они уходить не должны.
  const safe = {
    period: scrubContacts(body.period),
    notes: scrubContacts(body.notes),
    results: scrubContacts(body.results),
    weakTypes: scrubContacts(body.weakTypes),
  }

  let { model } = await pickModel(apiKey).catch(() => ({ model: MODEL_PREFERENCE[0] }))

  const ask = async (m) => fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: m,
      temperature: 0.3,
      messages: [{ role: "user", content: buildPrompt(safe) }],
    }),
  })

  let upstream = await ask(model)
  if (upstream.status === 400) {
    // Классический сюрприз: модель переименовали. Спрашиваем список и повторяем.
    const { model: fresh } = await pickModel(apiKey)
    if (fresh !== model) { model = fresh; upstream = await ask(model) }
  }
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "")
    res.status(502).json({ error: `DeepSeek: ${upstream.status}`, detail: text.slice(0, 300) })
    return
  }

  const data = await upstream.json().catch(() => null)
  const content = data?.choices?.[0]?.message?.content || ""
  const parsed = safeParse(content)
  if (!parsed) {
    res.status(502).json({ error: "Некорректный ответ модели", detail: content.slice(0, 300) })
    return
  }

  res.status(200).json({
    summary: parsed.summary || "",
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    next_steps: parsed.next_steps || "",
    homework_hint: parsed.homework_hint || "",
    model,
  })
}
