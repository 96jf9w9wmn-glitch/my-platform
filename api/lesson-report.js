import { createClient } from "@supabase/supabase-js"
import { rateLimit, clientIp, MODEL_PREFERENCE } from "./generate-hw.js"
import { featureAllowed, tutorFromRequest } from "./plan-gate.js"

// Отчёт родителю после занятия: на входе — заметки репетитора и результаты
// работ, на выходе строгий JSON, который репетитор правит перед отправкой.
// Балл никому не ставится и ученику ничего не уходит: это черновик письма.
//
// Пара правил взята из горького опыта generate-hw.js:
//  • имя модели — СПИСОК: DeepSeek уже ломал фичу переименованием модели;
//  • GET без тела — health-check, его дёргают задачи статуса;
//  • ответ модели парсим бережно: LaTeX внутри JSON приходит неэкранированным.
// Список моделей — ОДИН на обе ИИ-функции (импортируется из generate-hw.js).
// Здесь он когда-то жил своей копией и успел протухнуть: остались имена
// deepseek-chat/v3, которых у DeepSeek давно нет, — то есть отчёты уходили в
// 400 и держались только на аварийном переборе /models.
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

// Отчёт, собранный платформой автоматически (src/reportData.js). Здесь модель
// НЕ решает, какие темы разобраны и как они идут: и то и другое уже посчитано
// по фактам — занятиям, домашним работам и попыткам решения. Её работа —
// только связный человеческий текст поверх этих чисел, иначе отчёт родителю
// разошёлся бы с тем, что видно в кабинете.
function buildAutoPrompt({ period, stats, topics, notes }) {
  const s = stats || {}
  const facts = [
    s.lessons ? `занятий проведено: ${s.lessons}` : null,
    s.homeworkGiven ? `домашних работ выдано: ${s.homeworkGiven}` : null,
    s.homeworkDone ? `из них сдано: ${s.homeworkDone}` : null,
    s.avgGrade ? `средний балл за домашние работы: ${s.avgGrade} из 5` : null,
    s.tasksSolved ? `задач решено: ${s.tasksSolved}` : null,
    s.accuracy != null ? `верных ответов: ${s.accuracy}%` : null,
  ].filter(Boolean).join("; ")

  const list = (topics || []).map((t, i) => {
    const conf = { struggling: "даётся тяжело", progress: "в процессе", confident: "получается уверенно" }[t.confidence]
    const acc = t.attempts ? `, верно ${t.correct ?? "?"} из ${t.attempts}` : ""
    return `${i + 1}. ${t.title}${conf ? ` — ${conf}` : ""}${acc}`
  }).join("\n")

  return [
    "Ты — помощник репетитора. Напиши текст отчёта РОДИТЕЛЮ по готовым фактам.",
    "Пиши по-русски, спокойно и по делу, обращаясь к родителю на «вы». Без рекламы,",
    "без обращения к ученику, без восклицаний и без оценок личности («молодец», «ленится»).",
    "",
    "ЖЁСТКО: пользуйся только фактами ниже. Не добавляй тем, оценок и событий, которых в них нет.",
    "Не меняй статусы тем: они посчитаны по доле верных ответов.",
    "",
    `Имя ученика не передаётся. Там, где по смыслу нужно имя, пиши ровно ${NAME_TOKEN} —`,
    "эту метку подставят вместо имени уже после тебя. Не придумывай имя сам.",
    "",
    `Период: ${period || "последние занятия"}`,
    `Цифры: ${facts || "нет"}`,
    `Темы: \n${list || "нет"}`,
    `Заметки репетитора с занятий: ${notes || "нет"}`,
    "",
    "Ответь СТРОГО одним JSON-объектом без пояснений:",
    '{"summary":"2-4 предложения: что разобрали и как идут дела","comments":["по одному короткому предложению на каждую тему, В ТОМ ЖЕ ПОРЯДКЕ"],"next_steps":"1-2 предложения: над чем работаем дальше"}',
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
  if (db) {
    const tutor = await tutorFromRequest(db, req)
    if (!tutor) {
      res.status(401).json({ error: "Нужна авторизация репетитора" })
      return
    }
    // Отчёт родителю — возможность тарифа, а не бесплатная: он так же ходит в
    // платный DeepSeek, как генерация ДЗ. Раньше здесь стояла только проверка
    // авторизации, и на «Старте» ИИ-отчёты работали в обход тарифа.
    const allowed = await featureAllowed(db, tutor.id, "parentReports")
    if (!allowed.ok) {
      res.status(403).json({
        error: "Отчёты родителям с ИИ доступны на тарифах «Про» и «Макс»",
        upgrade: true,
      })
      return
    }
  }

  if (!apiKey) {
    res.status(500).json({ error: "DEEPSEEK_API_KEY не задан на сервере" })
    return
  }

  const body = req.body || {}
  // Новый (автоматический) режим узнаётся по присланным темам и цифрам: их
  // считает платформа. Старое тело (только заметки) продолжает работать —
  // на боевом может стоять предыдущий билд фронтенда.
  const auto = Array.isArray(body.topics) || !!body.stats
  if (!auto && !body.notes && !body.results) {
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
    stats: body.stats || null,
    // Названия тем приходят из банка заданий («Площадь трапеции») либо из тем
    // занятий, которые репетитор пишет свободным текстом, — второй случай так
    // же чистим от телефонов и почты, как и заметки.
    topics: Array.isArray(body.topics)
      ? body.topics.slice(0, 8).map((t) => ({
          title: scrubContacts(t?.title).slice(0, 120),
          confidence: ["struggling", "progress", "confident"].includes(t?.confidence) ? t.confidence : null,
          attempts: Number(t?.attempts) || 0,
          correct: Number(t?.correct) || 0,
        }))
      : [],
  }

  const prompt = auto ? buildAutoPrompt(safe) : buildPrompt(safe)

  let { model } = await pickModel(apiKey).catch(() => ({ model: MODEL_PREFERENCE[0] }))

  const ask = async (m) => fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: m,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
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
    // В автоматическом режиме темы задаёт платформа, модель возвращает только
    // комментарии к ним; в старом — темы приходят от модели целиком.
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    comments: Array.isArray(parsed.comments) ? parsed.comments.map((c) => String(c || "")) : [],
    next_steps: parsed.next_steps || "",
    homework_hint: parsed.homework_hint || "",
    model,
  })
}
