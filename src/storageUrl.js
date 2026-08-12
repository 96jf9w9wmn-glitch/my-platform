// Подписанные ссылки на файлы в хранилище.
//
// Бакеты `homework` и `variants` приватные: в них лежат ПДн — фото домашних
// работ, аватары учеников, сканы решений. Раньше они были публичными, и любой
// файл скачивался по прямому адресу без авторизации (проверено curl'ом).
// Теперь адрес выдаётся на время и только тому, кому база разрешает читать
// объект (политики на storage.objects — supabase/storage_private.sql).
//
// В базе исторически лежат готовые публичные адреса вида
// `https://…/storage/v1/object/public/homework/<путь>`; переписывать их не
// стали — резолвер понимает и их, и просто путь. Поэтому места записи
// (getPublicUrl) трогать не пришлось: эта функция не ходит в сеть, а лишь
// склеивает строку, из которой мы обратно достаём бакет и путь.
import { supabase } from "./supabase"

const PUBLIC_MARK = "/storage/v1/object/public/"
const SIGN_MARK = "/storage/v1/object/sign/"

// Бакет с картинками заданий — не ПДн, нужен всем и в PDF, остаётся публичным.
const PUBLIC_BUCKETS = new Set(["task-assets"])

const TTL_SEC = 60 * 60 * 4
// Подписываем заново заранее, чтобы ссылка не протухла на открытой странице.
const REFRESH_BEFORE_MS = 10 * 60 * 1000

const cache = new Map()

// Из значения в базе достаём бакет и путь. Понимает публичный адрес, голый
// путь и адрес с чужого домена (у ранних записей это старый облачный проект).
export function parseStorageRef(value, defaultBucket) {
  if (typeof value !== "string" || !value) return null
  if (value.startsWith("data:") || value.startsWith("blob:")) return null
  if (value.includes(SIGN_MARK)) return null

  const mark = value.indexOf(PUBLIC_MARK)
  if (mark !== -1) {
    const rest = value.slice(mark + PUBLIC_MARK.length)
    const slash = rest.indexOf("/")
    if (slash === -1) return null
    const path = rest.slice(slash + 1).split("?")[0]
    return { bucket: rest.slice(0, slash), path: decodeURIComponent(path) }
  }

  // Любой другой внешний адрес не наш — отдаём как есть.
  if (/^https?:\/\//i.test(value)) return null
  if (!defaultBucket) return null
  return { bucket: defaultBucket, path: value.replace(/^\/+/, "") }
}

function cached(key) {
  const hit = cache.get(key)
  if (hit && hit.expires - REFRESH_BEFORE_MS > Date.now()) return hit.url
  if (hit) cache.delete(key)
  return null
}

// Подписывает пачку значений разом: один запрос на бакет вместо запроса на
// файл — в списке домашних заданий таких ссылок бывают десятки.
export async function signStorageUrls(values, defaultBucket) {
  const out = new Map()
  const byBucket = new Map()

  for (const value of values) {
    if (!value || out.has(value)) continue
    const ref = parseStorageRef(value, defaultBucket)
    if (!ref || PUBLIC_BUCKETS.has(ref.bucket)) {
      out.set(value, value)
      continue
    }
    const key = ref.bucket + "/" + ref.path
    const hit = cached(key)
    if (hit) {
      out.set(value, hit)
      continue
    }
    if (!byBucket.has(ref.bucket)) byBucket.set(ref.bucket, new Map())
    byBucket.get(ref.bucket).set(ref.path, value)
  }

  await Promise.all(
    Array.from(byBucket.entries()).map(async ([bucket, paths]) => {
      const list = Array.from(paths.keys())
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(list, TTL_SEC)
      if (error || !data) {
        // Не смогли подписать — оставляем исходное значение, чтобы место
        // вызова вело себя как раньше, а не падало с пустой картинкой.
        for (const original of paths.values()) out.set(original, original)
        return
      }
      for (const row of data) {
        const original = paths.get(row.path)
        if (!original) continue
        if (row.error || !row.signedUrl) {
          out.set(original, original)
          continue
        }
        cache.set(bucket + "/" + row.path, { url: row.signedUrl, expires: Date.now() + TTL_SEC * 1000 })
        out.set(original, row.signedUrl)
      }
    })
  )

  return out
}

export async function signStorageUrl(value, defaultBucket) {
  if (!value) return value
  const map = await signStorageUrls([value], defaultBucket)
  return map.get(value) || value
}

// Возвращает копии строк, где перечисленные поля заменены подписанными
// ссылками. Так весь UI ниже продолжает читать те же поля и ничего не знает
// о подписи. spec: { поле: бакет-по-умолчанию }.
// Картинки, вставленные на доску, лежат в том же приватном бакете и хранятся
// прямо внутри сцены (strokes[].src). Подписываем их перед отрисовкой, иначе
// вместо картинки будет пустое место.
export async function signBoardScene(scene) {
  if (!scene) return scene
  const strokes = Array.isArray(scene) ? scene : scene.strokes
  if (!Array.isArray(strokes) || !strokes.length) return scene

  const values = strokes.filter((s) => s && s.tool === "image" && typeof s.src === "string").map((s) => s.src)
  if (!values.length) return scene

  const map = await signStorageUrls(values, "variants")
  const next = strokes.map((s) =>
    s && s.tool === "image" && typeof s.src === "string" ? { ...s, src: map.get(s.src) || s.src } : s
  )
  return Array.isArray(scene) ? next : { ...scene, strokes: next }
}

export async function signRows(rows, spec) {
  if (!Array.isArray(rows) || !rows.length) return rows
  const fields = Object.keys(spec)
  const values = []

  for (const row of rows) {
    if (!row) continue
    for (const field of fields) {
      const v = row[field]
      if (typeof v === "string") values.push(v)
      else if (Array.isArray(v)) values.push(...v.filter((x) => typeof x === "string"))
      else if (v && typeof v === "object") {
        for (const inner of Object.values(v)) if (typeof inner === "string") values.push(inner)
      }
    }
  }
  if (!values.length) return rows

  // Бакет у полей может отличаться, поэтому подписываем поле за полем —
  // запросов всё равно один на бакет.
  const maps = {}
  for (const field of fields) {
    const fieldValues = []
    for (const row of rows) {
      if (!row) continue
      const v = row[field]
      if (typeof v === "string") fieldValues.push(v)
      else if (Array.isArray(v)) fieldValues.push(...v.filter((x) => typeof x === "string"))
      else if (v && typeof v === "object") {
        for (const inner of Object.values(v)) if (typeof inner === "string") fieldValues.push(inner)
      }
    }
    maps[field] = fieldValues.length ? await signStorageUrls(fieldValues, spec[field]) : new Map()
  }

  return rows.map((row) => {
    if (!row) return row
    const copy = { ...row }
    for (const field of fields) {
      const v = row[field]
      const map = maps[field]
      if (typeof v === "string") copy[field] = map.get(v) || v
      else if (Array.isArray(v)) copy[field] = v.map((x) => (typeof x === "string" ? map.get(x) || x : x))
      else if (v && typeof v === "object") {
        const next = {}
        for (const [k, inner] of Object.entries(v)) next[k] = typeof inner === "string" ? map.get(inner) || inner : inner
        copy[field] = next
      }
    }
    return copy
  })
}
