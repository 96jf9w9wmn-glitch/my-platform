// Файлы Pyodide (настоящий CPython, собранный в wasm) для запуска программ на
// доске. Их 13 МБ, и в репозитории им не место: пакет стоит в devDependencies,
// а перед сборкой нужные файлы копируются в public/py/<версия>/ — оттуда они
// попадают в dist и на сервер обычной статикой.
//
// ВЕРСИЯ В ИМЕНИ ПАПКИ — не украшение: адрес файла меняется вместе с версией,
// поэтому Caddy отдаёт их с immutable-кэшем, как ассеты с хэшем, и обновление
// Pyodide не требует ни сброса кэша, ни разговора с браузером.
//
// СТОРОЖ: версию знает и клиент (PYODIDE_VERSION в src/components/pyRunner.js).
// Разъедутся — воркер полезет по несуществующему адресу и запуск кода молча
// перестанет работать, поэтому расхождение роняет сборку прямо здесь.
import { copyFileSync, mkdirSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const src = join(root, "node_modules", "pyodide")

if (!existsSync(src)) {
  console.error("pyodide не установлен: npm i")
  process.exit(1)
}

const version = JSON.parse(readFileSync(join(src, "package.json"), "utf8")).version
const runner = readFileSync(join(root, "src", "components", "pyRunner.js"), "utf8")
const want = runner.match(/PYODIDE_VERSION\s*=\s*"([^"]+)"/)?.[1]
if (want !== version) {
  console.error(`pyodide ${version} в node_modules, а pyRunner.js ждёт ${want}.\n` +
    `Поправьте PYODIDE_VERSION в src/components/pyRunner.js и проверьте запуск кода.`)
  process.exit(1)
}

// Только то, что нужно для запуска без внешних пакетов. Карты исходников,
// типы и демо-консоль пакета в веб-корень не едут.
const FILES = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]

const outRoot = join(root, "public", "py")
const out = join(outRoot, version)
mkdirSync(out, { recursive: true })
// Старые версии выносим: иначе public/py копит по 13 МБ на каждое обновление.
for (const name of readdirSync(outRoot)) {
  if (name !== version) rmSync(join(outRoot, name), { recursive: true, force: true })
}
for (const f of FILES) copyFileSync(join(src, f), join(out, f))
console.log(`pyodide ${version} → public/py/${version}/ (${FILES.length} файлов)`)
