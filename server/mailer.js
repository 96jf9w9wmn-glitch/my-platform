// Отправка письма по SMTP — сотня строк вместо зависимости.
//
// Почему без nodemailer: node_modules раскатываются на сервер отдельно и только
// вместе с package-lock.json (см. scripts/deploy.sh), поэтому новая зависимость
// означает отдельную раскатку 160 МБ ради одного файла. Нам нужен ровно один
// сценарий: отдать письмо СВОЕМУ релею на 172.17.0.1:587 — он стоит в сети
// хоста и уже сам отправляет наружу с обязательным TLS (см. docker-compose.
// override.yml на сервере). Соединение до релея машину не покидает, поэтому
// здесь ни TLS, ни авторизации не нужно.
//
// Провайдер не пропускает SMTP из docker-сети наружу — ходить в smtp.mail.ru
// отсюда напрямую бесполезно, это уже проверено при настройке GoTrue.

import net from "node:net"

const HOST = process.env.SMTP_HOST || "172.17.0.1"
const PORT = Number(process.env.SMTP_PORT) || 587
// Домен отправителя жёстко разрешён на релее (ALLOWED_SENDER_DOMAINS=inbox.ru):
// адрес не из него релей отклонит.
const FROM = process.env.SMTP_FROM || "precettore@inbox.ru"
const FROM_NAME = process.env.SMTP_FROM_NAME || "Precettore"
const TIMEOUT = 15000

// Заголовок с русским текстом уходит в base64 по RFC 2047: восьмибитная тема
// в письме — это либо «кракозябры», либо отказ сервера.
function encodeHeader(text) {
  const raw = String(text || "")
  if (/^[\x20-\x7E]*$/.test(raw)) return raw
  return `=?UTF-8?B?${Buffer.from(raw, "utf8").toString("base64")}?=`
}

// Точка в начале строки в SMTP означает конец письма — экранируем удвоением.
function dotStuff(body) {
  return String(body).replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..")
}

function talk(socket, command, expect) {
  return new Promise((resolve, reject) => {
    let buf = ""
    const onData = (chunk) => {
      buf += chunk
      // Последняя строка ответа — «250 текст», промежуточные — «250-текст».
      const lines = buf.split("\r\n").filter(Boolean)
      const last = lines[lines.length - 1] || ""
      if (!/^\d{3} /.test(last)) return
      socket.off("data", onData)
      const code = Number(last.slice(0, 3))
      if (expect && code !== expect) return reject(new Error(`SMTP ${code}: ${last}`))
      resolve(code)
    }
    socket.on("data", onData)
    if (command !== null) socket.write(command + "\r\n")
  })
}

export async function sendMail({ to, subject, text }) {
  const socket = net.connect({ host: HOST, port: PORT })
  socket.setEncoding("utf8")
  socket.setTimeout(TIMEOUT)

  const failed = new Promise((_, reject) => {
    socket.on("error", reject)
    socket.on("timeout", () => reject(new Error("SMTP timeout")))
  })

  const session = (async () => {
    await talk(socket, null, 220)
    await talk(socket, "EHLO precettore.ru", 250)
    await talk(socket, `MAIL FROM:<${FROM}>`, 250)
    await talk(socket, `RCPT TO:<${to}>`, 250)
    await talk(socket, "DATA", 354)

    const headers = [
      `From: ${encodeHeader(FROM_NAME)} <${FROM}>`,
      `To: <${to}>`,
      `Subject: ${encodeHeader(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="utf-8"',
      "Content-Transfer-Encoding: 8bit",
      // Письмо не приглашает к переписке: ответ уйдёт в служебный ящик впустую.
      "Auto-Submitted: auto-generated",
    ].join("\r\n")

    await talk(socket, `${headers}\r\n\r\n${dotStuff(text)}\r\n.`, 250)
    await talk(socket, "QUIT")
  })()

  try {
    await Promise.race([session, failed])
  } finally {
    socket.destroy()
  }
}
