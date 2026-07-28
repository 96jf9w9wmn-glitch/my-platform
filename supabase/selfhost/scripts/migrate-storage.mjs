#!/usr/bin/env node
// Перенос файлов Storage со старого Supabase на новый.
//
// Строки storage.objects без самих файлов бесполезны, поэтому бакеты и файлы
// копируются через API — тогда объекты в новой базе создаются штатным путём.
//
//   CLOUD_URL=https://<ref>.supabase.co \
//   CLOUD_SERVICE_KEY=<service_role старого> \
//   LOCAL_URL=https://db.precettore.ru \
//   LOCAL_SERVICE_KEY=<SERVICE_ROLE_KEY нового> \
//   node supabase/selfhost/scripts/migrate-storage.mjs
//
// Запускать можно повторно: файлы совпадающего размера пропускаются.
import { createClient } from "@supabase/supabase-js"

const { CLOUD_URL, CLOUD_SERVICE_KEY, LOCAL_URL, LOCAL_SERVICE_KEY } = process.env
const missing = ["CLOUD_URL", "CLOUD_SERVICE_KEY", "LOCAL_URL", "LOCAL_SERVICE_KEY"].filter(
  (k) => !process.env[k]
)
if (missing.length) {
  console.error("Не заданы переменные: " + missing.join(", "))
  process.exit(1)
}

const opts = { auth: { persistSession: false } }
const cloud = createClient(CLOUD_URL, CLOUD_SERVICE_KEY, opts)
const local = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, opts)

const PAGE = 100
const stats = { copied: 0, skipped: 0, failed: 0, bytes: 0 }
const failures = []

// Обход бакета: в списке папка отличается от файла тем, что у неё id === null.
async function* walk(client, bucket, prefix = "") {
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } })
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    if (!data?.length) return
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id === null) yield* walk(client, bucket, path)
      else yield { path, size: entry.metadata?.size ?? 0, mime: entry.metadata?.mimetype }
    }
    if (data.length < PAGE) return
  }
}

// Уже перенесён? Сравниваем по размеру — этого достаточно, чтобы не качать заново.
async function existsWithSize(bucket, path, size) {
  const slash = path.lastIndexOf("/")
  const dir = slash === -1 ? "" : path.slice(0, slash)
  const name = slash === -1 ? path : path.slice(slash + 1)
  const { data } = await local.storage.from(bucket).list(dir, { limit: PAGE, search: name })
  const hit = data?.find((e) => e.name === name)
  return !!hit && (hit.metadata?.size ?? -1) === size
}

async function copyFile(bucket, file) {
  if (await existsWithSize(bucket, file.path, file.size)) {
    stats.skipped++
    return
  }
  const { data: blob, error: dlErr } = await cloud.storage.from(bucket).download(file.path)
  if (dlErr) throw new Error(`download ${file.path}: ${dlErr.message}`)
  const { error: upErr } = await local.storage.from(bucket).upload(file.path, blob, {
    contentType: file.mime || blob.type || "application/octet-stream",
    upsert: true,
  })
  if (upErr) throw new Error(`upload ${file.path}: ${upErr.message}`)
  stats.copied++
  stats.bytes += file.size
}

const mb = (b) => (b / 1024 / 1024).toFixed(1)

const { data: buckets, error: bErr } = await cloud.storage.listBuckets()
if (bErr) {
  console.error("Не удалось получить список бакетов старого проекта: " + bErr.message)
  process.exit(1)
}
console.log(`Бакетов на источнике: ${buckets.length} (${buckets.map((b) => b.name).join(", ")})\n`)

for (const bucket of buckets) {
  // Публичность переносим как есть: закрытие бакетов — отдельная задача (RLS-план).
  const { error } = await local.storage.createBucket(bucket.name, {
    public: bucket.public,
    fileSizeLimit: bucket.file_size_limit ?? undefined,
    allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
  })
  if (error && !/exist/i.test(error.message)) {
    console.error(`  бакет ${bucket.name}: ${error.message}`)
    stats.failed++
    continue
  }
  console.log(`Бакет ${bucket.name} (${bucket.public ? "публичный" : "приватный"}):`)

  let n = 0
  for await (const file of walk(cloud, bucket.name)) {
    n++
    try {
      await copyFile(bucket.name, file)
    } catch (e) {
      stats.failed++
      failures.push(`${bucket.name}/${file.path} — ${e.message}`)
    }
    if (n % 25 === 0) process.stdout.write(`  ...${n} файлов\r`)
  }
  console.log(`  всего файлов: ${n}`)
}

console.log(
  `\nИтог: скопировано ${stats.copied} (${mb(stats.bytes)} МБ), ` +
    `пропущено как уже перенесённые ${stats.skipped}, ошибок ${stats.failed}`
)
if (failures.length) {
  console.log("\nНе перенеслись:")
  for (const f of failures.slice(0, 50)) console.log("  " + f)
  if (failures.length > 50) console.log(`  ...и ещё ${failures.length - 50}`)
  process.exit(1)
}
