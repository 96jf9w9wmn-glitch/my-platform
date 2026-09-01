// Регистрация ученика и сброс его пароля — с кодом из SMS.
//
// Зачем на сервере. Телефон у ученика это логин, и проверять код на клиенте
// бессмысленно: запрос к RPC можно послать мимо проверки. Поэтому
// student_register и student_reset_password больше не вызываются из браузера
// (грант anon снят, см. supabase/phone_codes.sql) — единственный вход сюда.
//
// Что закрывает сброс пароля. Раньше он шёл ТОЛЬКО по номеру: кто знал телефон
// ученика — а его знает любой одноклассник, — тот менял пароль и забирал
// аккаунт вместе с перепиской и данными родителя. Теперь между «знаю номер» и
// «меняю пароль» стоит код, который придёт на сам номер.
//
// Пока SMS не настроены (нет ключа провайдера), оба действия работают как
// раньше, БЕЗ кода: забытый ключ не должен запирать учеников снаружи их же
// кабинетов. Признак виден в ответе (`sms: false`) и в health-check.

import crypto from "node:crypto"
import { admin } from "./plan-gate.js"
import { rateLimit, clientIp } from "./generate-hw.js"
import { sendSms, smsReady } from "../server/sms.js"

const CODE_TTL_MIN = 10
const MAX_TRIES = 5
const RESEND_SEC = 60

// Правило то же, что в utils.js и в базе: одиннадцать цифр, код 7, первая
// цифра номера от 3 до 9.
function canonPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "")
  const body = d.length === 11 && (d[0] === "7" || d[0] === "8") ? d.slice(1) : d.length === 10 ? d : null
  return body && /^[3-9]\d{9}$/.test(body) ? `+7${body}` : null
}

function validName(raw) {
  const v = String(raw || "").trim()
  return v.length >= 2 && v.length <= 60 && (v.match(/[A-Za-zА-Яа-яЁё]/g) || []).length >= 2
}

function hash(code) {
  const pepper = process.env.AUTH_PROXY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  return crypto.createHash("sha256").update(`${code}:${pepper}`).digest("hex")
}

const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0")

async function phoneTaken(db, phone) {
  const { data } = await db.from("student_accounts").select("id").eq("phone", phone).maybeSingle()
  return !!data
}

// Само действие. Вынесено отдельно: его зовут и после сверки кода, и сразу —
// когда SMS не настроены.
async function perform(db, purpose, phone, body, res) {
  if (purpose === "register") {
    const { data, error } = await db.rpc("student_register", {
      p_phone: phone,
      p_password: String(body?.password || ""),
      p_name: String(body?.name || "").trim(),
    })
    if (error) { res.status(400).json({ error: error.message }); return }
    res.status(200).json({ ok: true, account: data?.[0] || null })
    return
  }
  const { data, error } = await db.rpc("student_reset_password", {
    p_phone: phone,
    p_new_password: String(body?.password || ""),
  })
  if (error) { res.status(400).json({ error: error.message }); return }
  if (!data) { res.status(404).json({ error: "Аккаунт с таким номером не найден" }); return }
  res.status(200).json({ ok: true })
}

async function start(db, purpose, phone, res) {
  const taken = await phoneTaken(db, phone)
  if (purpose === "register" && taken) {
    res.status(409).json({ error: "Этот номер уже зарегистрирован. Войди или восстанови пароль." })
    return
  }
  if (purpose === "reset" && !taken) {
    res.status(404).json({ error: "Аккаунт с таким номером не найден" })
    return
  }

  const { data: prev } = await db.from("phone_codes")
    .select("created_at").eq("phone", phone).eq("purpose", purpose).maybeSingle()
  if (prev?.created_at && Date.now() - new Date(prev.created_at).getTime() < RESEND_SEC * 1000) {
    res.status(429).json({ error: `Код уже отправлен. Повторить можно через ${RESEND_SEC} секунд.` })
    return
  }

  const code = newCode()
  const { error } = await db.from("phone_codes").upsert({
    phone,
    purpose,
    code_hash: hash(code),
    expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
    tries: 0,
    created_at: new Date().toISOString(),
  })
  if (error) {
    console.error("[телефон] код не сохранился:", error.message)
    res.status(500).json({ error: "Не удалось отправить код. Попробуй позже." })
    return
  }

  try {
    await sendSms(phone, `Precettore: код ${code}. Никому его не сообщай.`)
  } catch (e) {
    console.error("[телефон] SMS не ушла:", e.message)
    await db.from("phone_codes").delete().eq("phone", phone).eq("purpose", purpose)
    res.status(502).json({ error: "Не удалось отправить SMS. Попробуй позже." })
    return
  }
  res.status(200).json({ ok: true, sms: true, resendAfter: RESEND_SEC })
}

async function verify(db, purpose, phone, body, res) {
  const code = String(body?.code || "").trim()
  if (!/^\d{6}$/.test(code)) { res.status(400).json({ error: "Код состоит из шести цифр" }); return }

  const { data: row } = await db.from("phone_codes")
    .select("code_hash, expires_at, tries").eq("phone", phone).eq("purpose", purpose).maybeSingle()
  if (!row) { res.status(400).json({ error: "Код не запрашивали. Начни заново." }); return }

  const drop = () => db.from("phone_codes").delete().eq("phone", phone).eq("purpose", purpose)

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await drop()
    res.status(400).json({ error: "Код устарел. Запроси новый." })
    return
  }
  if (row.tries >= MAX_TRIES) {
    await drop()
    res.status(429).json({ error: "Слишком много попыток. Запроси новый код." })
    return
  }
  if (row.code_hash !== hash(code)) {
    await db.from("phone_codes").update({ tries: row.tries + 1 })
      .eq("phone", phone).eq("purpose", purpose)
    const left = MAX_TRIES - row.tries - 1
    res.status(400).json({ error: left > 0 ? `Неверный код. Осталось попыток: ${left}` : "Неверный код. Запроси новый." })
    return
  }

  await drop()
  await perform(db, purpose, phone, body, res)
}

export default async function handler(req, res) {
  // GET — health-check: видно снаружи, включены ли SMS вообще.
  if (req.method === "GET") { res.status(200).json({ ok: true, sms: smsReady() }); return }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return }

  const db = admin()
  if (!db) { res.status(503).json({ error: "Регистрация временно недоступна" }); return }

  const limit = rateLimit(`phone:${clientIp(req)}`)
  if (!limit.ok) {
    res.status(429).json({ error: "Слишком много запросов. Попробуй через минуту.", retryAfter: limit.retryAfter })
    return
  }

  const phone = canonPhone(req.body?.phone)
  if (!phone) { res.status(400).json({ error: "Проверь номер: нужны все десять цифр после +7" }); return }

  const purpose = req.body?.purpose === "reset" ? "reset" : "register"
  const password = String(req.body?.password || "")
  if (password.length < 6) { res.status(400).json({ error: "Пароль минимум 6 символов" }); return }
  if (purpose === "register" && !validName(req.body?.name)) {
    res.status(400).json({ error: "Впиши имя буквами" }); return
  }

  // SMS не настроены — делаем то же, что делалось до кода. Иначе забытый ключ
  // провайдера означал бы «зарегистрироваться нельзя вообще».
  if (!smsReady()) {
    if (purpose === "register" && await phoneTaken(db, phone)) {
      res.status(409).json({ error: "Этот номер уже зарегистрирован. Войди или восстанови пароль." })
      return
    }
    console.warn("[телефон] SMS не настроены — код не спрашиваем")
    await perform(db, purpose, phone, req.body, res)
    return
  }

  if (req.body?.action === "verify") return verify(db, purpose, phone, req.body, res)
  return start(db, purpose, phone, res)
}
