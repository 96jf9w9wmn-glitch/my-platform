// Отправка Web Push — своя реализация вместо пакета `web-push`.
//
// Почему свой код, а не зависимость. Ровно по той же причине, что и свой SMTP
// (server/mailer.js): node_modules раскатываются отдельно и только вместе с
// package-lock, поэтому каждая новая зависимость — это отдельный шаг деплоя,
// про который легко забыть и получить упавший контейнер. Здесь всё нужное уже
// есть в node:crypto: ECDH на P-256, HKDF и AES-128-GCM.
//
// Что происходит. Стандарт разнесён на два документа, и оба обязательны:
//  • RFC 8291 — шифрование посылки. Ключ выводится из общего секрета ECDH
//    между нашей ОДНОРАЗОВОЙ парой и постоянным ключом устройства, плюс
//    `auth`-секрет подписки. Расшифровать посылку не может никто, кроме самого
//    устройства, — ни Apple, ни Google, через чьи серверы она идёт.
//  • RFC 8292 (VAPID) — подпись отправителя. Заголовок Authorization несёт
//    JWT, подписанный нашим постоянным ключом, и сам публичный ключ. Так шлюз
//    видит, что посылка от того же отправителя, на которого подписался
//    браузер: чужой ключ — отказ.
//
// Apple-аккаунт разработчика для этого не нужен: iOS с 16.4 принимает обычный
// Web Push и сама заворачивает его в APNs. Единственное жёсткое условие —
// приложение должно быть добавлено на экран «Домой» (см. src/push.js).

import crypto from "node:crypto"

// Размер записи из RFC 8188. Посылка у нас одна и маленькая, поэтому запись
// одна: больше 4 КБ шлюзы всё равно не принимают.
const RECORD_SIZE = 4096
// 16 байт соли + 4 байта длины записи + 1 байт длины ключа + 65 байт ключа.
const HEADER_LEN = 86
// Тег GCM (16) плюс байт-разделитель записи (1) — на них ужимается полезная часть.
const OVERHEAD = 17

const b64 = (buf) => Buffer.from(buf).toString("base64url")
const unb64 = (str) => Buffer.from(String(str), "base64url")

// HKDF из node возвращает ArrayBuffer и делает extract+expand за раз — ровно
// то, что описано в RFC 8291: «PRK = HMAC(salt, ikm); okm = HMAC(PRK, info|0x01)».
function hkdf(ikm, salt, info, len) {
  return Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, len))
}

// Приведение сырых 65 байт ECDH-ключа (0x04 || X || Y) к виду, который понимает
// crypto.createPublicKey. Собирать DER руками не нужно: префикс SPKI для
// P-256 постоянный, меняются только сами координаты.
const SPKI_P256_PREFIX = Buffer.from(
  "3059301306072a8648ce3d020106082a8648ce3d030107034200",
  "hex"
)

function toPublicKey(raw) {
  return crypto.createPublicKey({
    key: Buffer.concat([SPKI_P256_PREFIX, raw]),
    format: "der",
    type: "spki",
  })
}

// То же для приватного ключа VAPID: 32 байта скаляра → PKCS#8. Публичную часть
// в структуру не кладём, она выводится из скаляра.
const PKCS8_P256_PREFIX = Buffer.from(
  "308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420",
  "hex"
)

function toPrivateKey(raw) {
  return crypto.createPrivateKey({
    key: Buffer.concat([PKCS8_P256_PREFIX, raw]),
    format: "der",
    type: "pkcs8",
  })
}

// Шифрование посылки под конкретную подписку (RFC 8291 §3.1, RFC 8188 §2.1).
// `salt` и `senderKeys` — параметры только ради проверки на тестовом векторе
// RFC; в бою они всегда случайные, иначе повторное использование пары
// «ключ + nonce» в GCM раскрывает содержимое.
export function encrypt(payload, { p256dh, auth }, salt = null, senderKeys = null) {
  const uaPublic = unb64(p256dh)
  const authSecret = unb64(auth)
  if (uaPublic.length !== 65) throw new Error("ключ подписки не 65 байт")
  if (authSecret.length !== 16) throw new Error("auth-секрет подписки не 16 байт")

  const plaintext = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), "utf8")
  const maxLen = RECORD_SIZE - HEADER_LEN - OVERHEAD
  if (plaintext.length > maxLen) throw new Error(`посылка длиннее ${maxLen} байт`)

  // Одноразовая пара отправителя: своя на КАЖДУЮ посылку.
  const ecdh = crypto.createECDH("prime256v1")
  if (senderKeys) ecdh.setPrivateKey(unb64(senderKeys.private))
  else ecdh.generateKeys()
  const asPublic = ecdh.getPublicKey()
  const shared = ecdh.computeSecret(uaPublic)

  // Общий ключ «привязывается» к обеим сторонам: в info входят оба публичных
  // ключа, поэтому подменить один из них незаметно нельзя.
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    uaPublic,
    asPublic,
  ])
  const ikm = hkdf(shared, authSecret, keyInfo, 32)

  const realSalt = salt ? unb64(salt) : crypto.randomBytes(16)
  const cek = hkdf(ikm, realSalt, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16)
  const nonce = hkdf(ikm, realSalt, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12)

  // 0x02 — признак последней записи (RFC 8188 §2). Он ВНУТРИ шифра: иначе
  // посредник мог бы обрезать поток, и получатель не отличил бы это от конца.
  const padded = Buffer.concat([plaintext, Buffer.from([0x02])])
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce)
  const body = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()])

  const header = Buffer.alloc(HEADER_LEN)
  realSalt.copy(header, 0)
  header.writeUInt32BE(RECORD_SIZE, 16)
  header.writeUInt8(asPublic.length, 20)
  asPublic.copy(header, 21)

  return Buffer.concat([header, body])
}

// Заголовок Authorization по RFC 8292. `aud` — origin шлюза (не адрес
// подписки целиком: там уникальный идентификатор устройства, и шлюзу он в
// подписи не нужен), `exp` не дальше суток — Apple отвергает более долгие.
export function vapidHeader(endpoint, { publicKey, privateKey, subject }) {
  const aud = new URL(endpoint).origin
  const header = b64(JSON.stringify({ typ: "JWT", alg: "ES256" }))
  const claims = b64(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  }))
  const signed = `${header}.${claims}`
  // ieee-p1363 — это r||s по 32 байта, как требует JOSE. По умолчанию node
  // подписывает в DER, и шлюз такую подпись не принимает.
  const sig = crypto.sign("sha256", Buffer.from(signed, "utf8"), {
    key: toPrivateKey(unb64(privateKey)),
    dsaEncoding: "ieee-p1363",
  })
  return `vapid t=${signed}.${b64(sig)}, k=${publicKey}`
}

// Отправка. Возвращает { ok, status, gone } — `gone` означает, что подписки
// больше нет (приложение удалили с домашнего экрана) и её надо вычистить.
export async function sendPush(subscription, payload, vapid, { ttl = 86400, urgency = "normal" } = {}) {
  const body = encrypt(payload, subscription)
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidHeader(subscription.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Urgency: urgency,
    },
    body,
  })
  if (res.ok) return { ok: true, status: res.status, gone: false }
  const text = await res.text().catch(() => "")

  // Когда подписку можно считать мёртвой и снять.
  //  • 404/410 — так отвечают все шлюзы про исчезнувшую подписку.
  //  • 400 BadDeviceToken — так отвечает Apple, когда приложение снесли с
  //    домашнего экрана. Опираемся именно на эту причину, а не на код 400
  //    целиком: 400 приходит и на НАШИ ошибки (испорченный заголовок VAPID,
  //    негодный формат посылки), и снимать по нему подписки означало бы
  //    вычистить их все разом на первой же собственной оплошности.
  const gone =
    res.status === 404 || res.status === 410 ||
    (res.status === 400 && /BadDeviceToken/i.test(text))
  // 403 сюда НЕ входит: это «подписаны на другой ключ», то есть след ротации
  // VAPID, а не пропавшее устройство. Клиент переподпишется сам.
  return { ok: false, status: res.status, gone, error: text.slice(0, 300) }
}

// Пара ключей VAPID. Зовётся скриптом установки на сервере, не в бою.
export function generateKeys() {
  const ecdh = crypto.createECDH("prime256v1")
  ecdh.generateKeys()
  return { publicKey: b64(ecdh.getPublicKey()), privateKey: b64(ecdh.getPrivateKey()) }
}

export { toPublicKey }
