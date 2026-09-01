import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
const M = await server.ssrLoadModule('/src/pages/taskGenerators.js')
const U = await server.ssrLoadModule('/src/utils.js')
const { generateTask, taskThemes } = M
const render = U.renderTaskMath || (x => x)
const strip = s => String(s).replace(/<[^>]*>/g, '')
const EXAMS = ["ОГЭ", "ЕГЭ", "ЕГЭ Профиль"]
const hits = new Map()
let runs = 0
const BAD = [
  [/(?<![\d,.])0\s*[a-zа-яx]/u, '0·переменная'],
  [/[+−-]\s*0(?![\d,.])/u, '± 0'],
  [/[⋅·*]\s*0(?![\d,.])/u, '× 0'],
]
for (const ex of EXAMS) for (let num = 1; num <= 30; num++) {
  let themes; try { themes = taskThemes(ex, num) } catch { themes = null }
  if (!themes) continue
  for (const key of themes.flatMap(t => t.items.map(i => i.key))) {
    for (let i = 0; i < 300; i++) {
      let t; try { t = generateTask(ex, num, key) } catch { continue }
      if (!t?.condition_text) continue
      runs++
      const txt = strip(render(t.condition_text))
      for (const [re, name] of BAD) if (re.test(txt)) {
        const k = `${ex} №${num} ${key} [${name}]`
        if (!hits.has(k)) hits.set(k, txt)
      }
    }
  }
}
for (const [k, v] of hits) console.log(k, '::', v.slice(0, 120))
console.log('прогонов:', runs, 'подозрительных типажей:', hits.size)
await server.close()
