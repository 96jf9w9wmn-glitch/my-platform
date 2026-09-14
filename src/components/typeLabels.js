import { useEffect, useState } from "react"
import { themeFromKey } from "../taskTheme"

// Человеческие подписи типажей (gen_key → «Площадь трапеции»). Банк большой,
// поэтому грузим его лениво и только когда есть что подписывать. Общий код для
// «Слабых типажей» ученика и сводки по всем ученикам в «Результатах».
export default function useTypeLabels(rows) {
  const [labels, setLabels] = useState({})

  useEffect(() => {
    if (!rows.length) return
    let alive = true
    // Тема, проставленная репетитором заданию из своего файла, подписывает себя
    // сама: её текст и есть ключ («theme:Квадратные уравнения»). Банк ради неё
    // не нужен — и если других ключей в строках нет, он не грузится вовсе.
    const own = {}
    let needBank = false
    for (const r of rows) {
      if (!r.gen_key) continue
      const theme = themeFromKey(r.gen_key)
      if (theme) own[r.gen_key] = theme
      else needBank = true
    }
    const bank = needBank ? import("../pages/taskGenerators") : Promise.resolve(null)
    bank.then((mod) => {
      if (!alive) return
      const map = { ...own }
      for (const r of mod ? rows : []) {
        if (!r.gen_key || themeFromKey(r.gen_key)) continue
        let themes
        try { themes = mod.taskThemes(r.exam_type, r.number) } catch { /* предмета/номера нет — подписи не будет */ }
        for (const t of themes || []) {
          for (const it of t.items) if (it.key === r.gen_key) map[r.gen_key] = it.label
        }
      }
      setLabels(map)
    }, () => {})
    return () => { alive = false }
  }, [rows])

  return labels
}
