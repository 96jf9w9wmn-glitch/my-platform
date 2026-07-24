// Серверный прокси к DeepSeek для генерации домашних заданий по теме.
// Ключ DEEPSEEK_API_KEY берётся из переменных окружения Vercel и НИКОГДА
// не попадает в клиент. Клиент шлёт только тему/уровень/кол-во.
//
// Настройка: в дашборде Vercel → Project → Settings → Environment Variables
// добавить DEEPSEEK_API_KEY (значение — ключ из platform.deepseek.com).

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
const MAX_COUNT = 20
const MAX_TOPIC_LEN = 200

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: "DEEPSEEK_API_KEY не задан на сервере" })
    return
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {}
  const topic = String(body.topic || "").trim().slice(0, MAX_TOPIC_LEN)
  const subject = String(body.subject || "").trim().slice(0, 80)
  const level = String(body.level || "средний").trim().slice(0, 40)
  const count = Math.min(Math.max(parseInt(body.count, 10) || 5, 1), MAX_COUNT)

  if (!topic) {
    res.status(400).json({ error: "Не указана тема" })
    return
  }

  const system =
    "Ты — опытный репетитор, который составляет домашние задания для школьников. " +
    "Отвечай СТРОГО валидным JSON без markdown-обёрток. " +
    "Формат: {\"title\": string, \"description\": string, \"tasks\": [{\"question\": string, \"answer\": string}]}. " +
    "title — короткое название ДЗ. description — 1-2 предложения общей инструкции для ученика. " +
    "tasks — массив заданий; question — полный текст задачи, answer — краткий правильный ответ " +
    "(число/слово/короткая фраза). Пиши по-русски, аккуратно и без ошибок в ответах."

  const user =
    `Составь домашнее задание.` +
    (subject ? ` Предмет: ${subject}.` : "") +
    ` Тема: «${topic}». Уровень сложности: ${level}. Количество заданий: ${count}. ` +
    `Задания должны быть разнообразными в рамках темы. Каждое задание самодостаточно ` +
    `(не ссылается на «предыдущее»). Обязательно укажи правильный ответ к каждому.`

  try {
    const upstream = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens: 2500,
        response_format: { type: "json_object" },
      }),
    })

    if (!upstream.ok) {
      const text = await upstream.text()
      res.status(502).json({ error: `DeepSeek: ${upstream.status}`, detail: text.slice(0, 300) })
      return
    }

    const data = await upstream.json()
    const content = data?.choices?.[0]?.message?.content || ""
    const parsed = safeParse(content)

    if (!parsed || !Array.isArray(parsed.tasks)) {
      res.status(502).json({ error: "Некорректный ответ модели", detail: content.slice(0, 300) })
      return
    }

    const tasks = parsed.tasks
      .filter((t) => t && (t.question || t.q))
      .map((t) => ({
        question: String(t.question || t.q || "").trim(),
        answer: String(t.answer ?? t.a ?? "").trim(),
      }))

    res.status(200).json({
      title: String(parsed.title || topic).trim().slice(0, 120),
      description: String(parsed.description || "").trim(),
      tasks,
    })
  } catch (e) {
    res.status(500).json({ error: "Сбой запроса к DeepSeek", detail: String(e).slice(0, 300) })
  }
}

function safeParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
