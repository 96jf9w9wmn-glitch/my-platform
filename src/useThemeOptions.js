import { useCallback, useState } from "react"
import { normalizeTheme } from "./taskTheme"

// Подсказки к полю темы у задания из своего файла: темы ЭТОГО номера из банка
// плюс те, что репетитор заводил сам.
//
// Банк темы знает, но весит мегабайты, поэтому грузим его ТОЛЬКО по касанию
// поля (load) и один раз на кабинет — ради списка подписей тащить генераторы в
// бандл раздела нельзя. Пока он едет, поле работает: своя тема пишется руками,
// и в этом весь смысл — список тем номера подсказка, а не ограничение.
//
// Свои темы помнит само устройство (localStorage): в базе им места нет — тема
// живёт в самой работе, а это лишь «что я уже писал раньше», чтобы не набирать
// одно и то же по десять раз. Не прочиталось (приватное окно, чистка данных) —
// подсказок просто не будет.
const KEY = "precettore.ownThemes"
const MAX = 24

function readOwn() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]")
    return Array.isArray(raw) ? raw.filter((s) => typeof s === "string").slice(0, MAX) : []
  } catch { return [] }
}

export default function useThemeOptions() {
  const [gen, setGen] = useState(null)      // модуль генераторов (подписи тем)
  const [own, setOwn] = useState(readOwn)

  const load = useCallback(() => {
    setGen((cur) => {
      if (cur) return cur
      import("./pages/taskGenerators").then((m) => setGen(m)).catch(() => {})
      return cur
    })
  }, [])

  // Темы номера + свои. Порядок такой: сначала то, что предлагает экзамен, —
  // совпавшая с банком тема складывается в отчёте родителю с заданиями, которые
  // ученик решал из банка, а своя остаётся отдельной строкой.
  const options = useCallback((examType, number) => {
    let bank = []
    if (gen && number != null) {
      try { bank = (gen.taskThemes(examType, number) || []).map((t) => t.theme) } catch { bank = [] }
    }
    const seen = new Set(bank.map((s) => s.toLowerCase()))
    return bank.concat(own.filter((s) => !seen.has(s.toLowerCase())))
  }, [gen, own])

  // Запомнить тему, которую репетитор написал. Совпавшая с банком осядет в том
  // же списке и просто не покажется дважды (дубли отсеиваются при сборке).
  const remember = useCallback((value) => {
    const theme = normalizeTheme(value)
    if (!theme) return
    setOwn((prev) => {
      if (prev.some((s) => s.toLowerCase() === theme.toLowerCase())) return prev
      const next = [theme, ...prev].slice(0, MAX)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* некуда помнить — не беда */ }
      return next
    })
  }, [])

  return { load, options, remember }
}
