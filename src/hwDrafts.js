// Черновик ответов домашней работы — то, что ученик вписал до сдачи.
//
// До сдачи ответы нигде, кроме кабинета, не лежат: в базу они уезжают одной
// строкой вместе со сдачей. А кабинет на телефоне перезапускается по нескольку
// раз в минуту — iOS выгружает фоновую вкладку, и «переключился на калькулятор
// и обратно» это полный старт страницы заново (см. журнал сайта в CLAUDE.md).
// Поэтому черновик хранится в localStorage: ученик решает на доске, вписывает
// ответ под заданием, уходит с доски или из приложения — и, вернувшись, находит
// ответ на месте. Один и тот же черновик правят карточка работы (поля ответов)
// и поле под листом задания на доске, поэтому живёт он в кабинете, а не в
// карточке, и это ЕДИНСТВЕННАЯ запись ответа: второй нет и заводить нельзя.
//
// У черновика есть ключ СОСТОЯНИЯ работы (hwDraftKey): при каком статусе и с
// какими принятыми ответами он начат. Сдали, вернули на доработку, репетитор
// что-то принял — состояние другое, и черновик прежнего не годится: заготовка
// собирается заново (hwInitialAnswers). А пока состояние то же, черновик НЕ
// затирается ничем — ни повторным заходом в карточку (ушёл на другую вкладку и
// вернулся), ни открытием доски, ни перезапуском страницы. До этого модуля
// карточка при каждом монтировании клала наверх пустую заготовку, и набранное
// пропадало ровно так.
import { useCallback, useEffect, useState } from "react"

// Состояние работы, при котором начат черновик. Строка признака не меняется,
// пока работа решается, — поэтому набранное переживает и перечитывание списка
// работ (строки в нём новые, состояние то же).
export const hwDraftKey = (hw) =>
  `${hw.id}|${hw.status}|${(Array.isArray(hw.student_answers) ? hw.student_answers : []).join("")}`

// Заготовка ответов: пустые поля, а у доработки — прежние принятые ответы.
// Репетитор оставил в работе зачтённые и стёр только те задания, которые
// предстоит решить заново; при сдаче уедет весь список, и балл посчитается по
// всей работе, а не по одной доработке.
export function hwInitialAnswers(hw) {
  const prev = hw.status === "revision" && Array.isArray(hw.student_answers) ? hw.student_answers : null
  return Array.from({ length: hw.question_count || 0 }, (_, i) => (prev?.[i] == null ? "" : String(prev[i])))
}

// Черновик годится, только если начат при ЭТОМ состоянии работы.
export const hwDraftFits = (draft, hw) => !!draft && draft.key === hwDraftKey(hw) && Array.isArray(draft.list)

// Ответы работы по порядку заданий: подходящий черновик либо заготовка.
export const hwDraftList = (draft, hw) => (hwDraftFits(draft, hw) ? draft.list : hwInitialAnswers(hw))

const STORE_KEY = (accountId) => `hw_drafts_${accountId}`
// Черновик старше трёх месяцев — от работы, которой давно нет: выкидываем при
// чтении, иначе хранилище растёт вечно.
const TTL_MS = 90 * 24 * 3600 * 1000

export function readHwDrafts(accountId) {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY(accountId)) || "{}")
    const out = {}
    const now = Date.now()
    for (const [id, d] of Object.entries(all && typeof all === "object" ? all : {})) {
      if (d && typeof d.key === "string" && Array.isArray(d.list) && now - (Number(d.at) || 0) < TTL_MS) out[id] = d
    }
    return out
  } catch {
    return {}
  }
}

export function writeHwDrafts(accountId, drafts) {
  try { localStorage.setItem(STORE_KEY(accountId), JSON.stringify(drafts)) } catch { /* некуда помнить — не беда */ }
}

// Черновики всех работ ученика: { «id работы»: { key, list, at } }.
export function useHwDrafts(accountId) {
  const [drafts, setDrafts] = useState(() => readHwDrafts(accountId))
  useEffect(() => { writeHwDrafts(accountId, drafts) }, [accountId, drafts])

  // Весь список сразу — так пишет карточка работы.
  const setList = useCallback((hwId, list, key) => {
    setDrafts((prev) => ({ ...prev, [hwId]: { key, list, at: Date.now() } }))
  }, [])

  // Один ответ по позиции — так пишет поле под листом на доске. Черновик другого
  // состояния работы не продолжаем: начинаем с заготовки, как это делает
  // карточка. count — сколько ответов у работы (длина списка держится под него).
  const setAt = useCallback((hw, idx, value, count = 0) => {
    setDrafts((prev) => {
      const cur = hwDraftList(prev[hw.id], hw)
      if ((cur[idx] ?? "") === value) return prev
      const next = Array.from({ length: Math.max(count, cur.length, idx + 1) }, (_, i) => cur[i] ?? "")
      next[idx] = value
      return { ...prev, [hw.id]: { key: hwDraftKey(hw), list: next, at: Date.now() } }
    })
  }, [])

  // Работа сдана — черновик больше не нужен.
  const forget = useCallback((hwId) => {
    setDrafts((prev) => {
      if (!(hwId in prev)) return prev
      const next = { ...prev }
      delete next[hwId]
      return next
    })
  }, [])

  return { drafts, setList, setAt, forget }
}
