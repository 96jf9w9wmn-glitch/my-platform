// Отправка SMS с кодом подтверждения.
//
// Провайдер выбирается переменной SMS_PROVIDER: у российских сервисов API —
// это один HTTP-запрос, поэтому драйвер занимает пять строк, а зависимости не
// нужны вовсе. Зарубежные шлюзы (Twilio и подобные) здесь не поддерживаются
// намеренно: номер телефона — персональные данные, и отправка его за границу
// это трансграничная передача по ст. 12 152-ФЗ — ровно то, из-за чего
// платформа уходила с Vercel.
//
// Пока ключ не задан, SMS не отправляются, а регистрация и сброс пароля
// работают как раньше, без кода (см. api/phone-verify.js). Забытый ключ не
// должен запирать учеников снаружи их же кабинетов.

const TIMEOUT = 12000

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) })
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { raw: text } }
}

// sms.ru: единственный обязательный параметр — api_id.
// https://sms.ru/api/send — status_code 100 значит «принято».
async function smsru(phone, text) {
  const url = new URL("https://sms.ru/sms/send")
  url.searchParams.set("api_id", process.env.SMS_API_KEY || "")
  url.searchParams.set("to", phone.replace(/\D/g, ""))
  url.searchParams.set("msg", text)
  url.searchParams.set("json", "1")
  if (process.env.SMS_SENDER) url.searchParams.set("from", process.env.SMS_SENDER)
  const data = await get(url)
  if (data?.status === "OK" && data?.status_code === 100) return
  throw new Error(`sms.ru: ${data?.status_code || "?"} ${data?.status_text || data?.raw || ""}`.trim())
}

// smsc.ru: логин и пароль (или apikey вместо пароля). fmt=3 — ответ в JSON,
// ошибка приходит полем error_code. https://smsc.ru/api/http/
async function smsc(phone, text) {
  const url = new URL("https://smsc.ru/sys/send.php")
  url.searchParams.set("login", process.env.SMS_LOGIN || "")
  url.searchParams.set("psw", process.env.SMS_API_KEY || "")
  url.searchParams.set("phones", phone.replace(/\D/g, ""))
  url.searchParams.set("mes", text)
  url.searchParams.set("fmt", "3")
  url.searchParams.set("charset", "utf-8")
  if (process.env.SMS_SENDER) url.searchParams.set("sender", process.env.SMS_SENDER)
  const data = await get(url)
  if (data?.id) return
  throw new Error(`smsc.ru: ${data?.error_code || "?"} ${data?.error || data?.raw || ""}`.trim())
}

const DRIVERS = { smsru: smsru, smsc: smsc }

// Настроен ли канал. Проверяют и обработчик (слать ли код вообще), и
// health-check — чтобы «SMS молча не работают» было видно снаружи.
export function smsReady() {
  const driver = DRIVERS[(process.env.SMS_PROVIDER || "smsru").toLowerCase()]
  if (!driver) return false
  if (!process.env.SMS_API_KEY) return false
  if (driver === smsc && !process.env.SMS_LOGIN) return false
  return true
}

export async function sendSms(phone, text) {
  const name = (process.env.SMS_PROVIDER || "smsru").toLowerCase()
  const driver = DRIVERS[name]
  if (!driver) throw new Error(`Неизвестный SMS_PROVIDER: ${name}`)
  await driver(phone, text)
}
