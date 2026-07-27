import { rateLimit } from "./generate-hw.js"

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

function buildPrompt({ studentName, period, notes, results, weakTypes }) {
  return [
    "Ты — помощник репетитора. Составь короткий отчёт РОДИТЕЛЮ о занятиях.",
    "Пиши по-русски, спокойно и по делу, без рекламы и без обращения к ученику.",
    "НИЧЕГО НЕ ВЫДУМЫВАЙ: если данных мало, так и напиши в summary и оставь topics пустым.",
    "",
    `Ученик: ${studentName || "не указан"}`,
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

  const ip = (req.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || "unknown"
  const limit = rateLimit(ip)
  if (!limit.ok) {
    res.setHeader?.("Retry-After", String(limit.retryAfter))
    res.status(429).json({ error: `Слишком часто. Попробуйте через ${limit.retryAfter} с.` })
    return
  }

  if (!apiKey) {
    res.status(500).json({ error: "DEEPSEEK_API_KEY не задан на сервере" })
    return
  }

  const body = req.body || {}
  if (!body.studentName && !body.notes && !body.results) {
    res.status(400).json({ error: "Нет данных для отчёта: нужны хотя бы заметки или результаты" })
    return
  }

  let { model } = await pickModel(apiKey).catch(() => ({ model: MODEL_PREFERENCE[0] }))

  const ask = async (m) => fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: m,
      temperature: 0.3,
      messages: [{ role: "user", content: buildPrompt(body) }],
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
