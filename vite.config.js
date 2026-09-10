import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

// «Что нового» для плашки «Вышло обновление платформы» (src/components/UpdateToast.jsx).
//
// Список правок берётся из истории git, а не из файла, который надо помнить и
// заполнять руками: сообщения коммитов в этом репозитории и есть человеческие
// описания изменений («Доска: стёртое больше не воскресает»), а отдельный
// changelog рано или поздно отстал бы от кода и врал бы пользователю.
//
// В dist/changelog.json уезжает ВСЯ последняя история (новые сверху), а вкладка
// знает свой коммит через __BUILD__ и берёт то, что стоит выше него. Поэтому
// одного файла хватает любой вкладке, какой бы старой она ни была: телефон
// может неделю держать сборку, до которой было десять правок.
const HISTORY = 60

function buildLog() {
  try {
    // Разделители \x1f (поля) и \x1e (записи), а не привычные «|»: заголовок
    // коммита — свободный текст, и любой печатный разделитель в нём однажды
    // встретится.
    const out = execSync(
      `git log --no-merges -n ${HISTORY} --date=short --pretty=format:%h%x1f%ad%x1f%s%x1e`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const list = []
    for (const rec of out.split('\x1e')) {
      const [h, d, t] = rec.trim().split('\x1f')
      if (h && d && t) list.push({ h, d, t })
    }
    return list
  } catch {
    // Не репозиторий, нет git, обрезанная история — плашка просто останется без
    // списка и будет работать как раньше. Ронять сборку из-за этого незачем.
    return []
  }
}

const log = buildLog()

// Файл кладётся рядом с index.html (а не в assets/): имени с хэшем у него нет,
// и вкладка просит его по постоянному адресу /changelog.json.
function changelog() {
  return {
    name: 'precettore-changelog',
    apply: 'build',
    generateBundle() {
      if (!log.length) return
      this.emitFile({ type: 'asset', fileName: 'changelog.json', source: JSON.stringify({ entries: log }) })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    changelog(),
  ],
  // Коммит, на котором собрана эта вкладка. По нему она находит своё место в
  // истории и понимает, что именно вышло после неё.
  define: {
    __BUILD__: JSON.stringify(log[0]?.h || ''),
  },
  server: {
    host: true,
  },
})
