import { useEffect, useState } from "react"

// Человеческие подписи типажей (gen_key → «Площадь трапеции»). Банк большой,
// поэтому грузим его лениво и только когда есть что подписывать. Общий код для
// «Слабых типажей» ученика и сводки по всем ученикам в «Результатах».
export default function useTypeLabels(rows) {
  const [labels, setLabels] = useState({})

  useEffect(() => {
    if (!rows.length) return
    let alive = true
    import("../pages/taskGenerators").then(({ taskThemes }) => {
      if (!alive) return
      const map = {}
      for (const r of rows) {
        if (!r.gen_key) continue
        let themes
        try { themes = taskThemes(r.exam_type, r.number) } catch { /* предмета/номера нет — подписи не будет */ }
        for (const t of themes || []) {
          for (const it of t.items) if (it.key === r.gen_key) map[r.gen_key] = it.label
        }
      }
      setLabels(map)
    })
    return () => { alive = false }
  }, [rows])

  return labels
}
