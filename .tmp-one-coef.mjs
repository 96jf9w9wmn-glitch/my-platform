// Сканер: коэффициент 1 перед переменной/функцией в условиях заданий.
import { createServer } from 'vite'

const arg = (name, def) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : def
}
const N = parseInt(arg('runs', '40'), 10)
const ONLY_EXAM = arg('exam', null)

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
const M = await server.ssrLoadModule('/src/pages/taskGenerators.js')
const { generateTask, taskThemes } = M

const ALL_EXAMS = ["ОГЭ", "ЕГЭ", "ЕГЭ Профиль", "ОГЭ Информатика", "ОГЭ Английский",
  "ОГЭ Русский", "ОГЭ Химия", "ОГЭ Обществознание", "ОГЭ Физика", "ОГЭ История",
  "ОГЭ Биология", "ОГЭ Литература", "ОГЭ География", "ЕГЭ Информатика"]
const EXAMS = ONLY_EXAM ? [ONLY_EXAM] : ALL_EXAMS

// «1» без цифры/точки/запятой слева, сразу перед латинской переменной, √ или скобкой
const RE = /(?<![\d.,№])1(?=[a-zA-Z√(])/g

const hits = new Map() // exam|num|key -> Set(sample)
for (const ex of EXAMS) {
  for (let num = 0; num <= 40; num++) {
    let themes
    try { themes = taskThemes(ex, num) } catch { themes = null }
    if (!themes) continue
    for (const key of themes.flatMap(t => t.items.map(i => i.key))) {
      for (let i = 0; i < N; i++) {
        let t
        try { t = generateTask(ex, num, key) } catch { continue }
        if (!t) continue
        for (const f of ['condition_text', 'condition_tail', 'solution', 'answer']) {
          const s = t[f]
          if (typeof s !== 'string') continue
          for (const m of s.matchAll(RE)) {
            const id = `${ex} №${num} ${key} [${f}]`
            if (!hits.has(id)) hits.set(id, new Set())
            const set = hits.get(id)
            if (set.size < 2) set.add(s.slice(Math.max(0, m.index - 45), m.index + 45).replace(/\n/g, ' '))
          }
        }
      }
    }
  }
}
const ids = [...hits.keys()].sort()
console.log(`Найдено типажей: ${ids.length}`)
for (const id of ids) {
  console.log('\n' + id)
  for (const s of hits.get(id)) console.log('   …' + s + '…')
}
await server.close()
