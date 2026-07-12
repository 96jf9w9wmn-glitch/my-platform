// Банк заданий ОГЭ по литературе (предмет «ОГЭ Литература»).
//
// ВАЖНО: литература — НЕ генератор аналогов (как математика/история), а браузер РЕАЛЬНЫХ
// формулировок открытого банка ФИПИ. Все пять заданий — «развёрнутый ответ» (мини-сочинения
// и сочинение), ключей/кратких ответов в природе нет → answer: null (как открытые задания
// обществознания/русского). «Генератор» каждого номера просто выдаёт случайную реальную
// формулировку из банка — репетитор листает кнопкой «Обновить».
//
// Ось литературы — не «тип задания», а ПРОИЗВЕДЕНИЕ. Поэтому темы номера (GEN_META_LIT) —
// это список произведений (КЭС), встречающихся в этом номере, по убыванию числа вопросов.
// Выбор произведения фильтрует номер по нему.
//
// Данные — src/pages/litBank.json (копия fipi_bank_lit/tasks.json, см. fipi_bank_lit/README.md).
// Нюанс: в №01/№02 сам фрагмент текста в выгрузке ФИПИ ОТСУТСТВУЕТ (печатается в КИМе) —
// поэтому в условии показываем произведение (kes_text) и явную пометку про фрагмент.
// В №03 для стихотворных произведений приведён второй текст → отдаём его в source_text.
//
// Диспетчер подхватывает GENERATORS_LIT / GEN_META_LIT под ключом "ОГЭ Литература".
import BANK from "./litBank.json"

const pick = (a) => a[Math.floor(Math.random() * a.length)]

// Группируем банк по числовому номеру задания (в JSON номера — строки "01".."05").
const BY_NUMBER = {}
for (const t of BANK) {
  const n = parseInt(t.number, 10)
  ;(BY_NUMBER[n] ||= []).push(t)
}

// Номера, где вопрос опирается на фрагмент, которого в выгрузке ФИПИ нет.
const FRAGMENT_ABSENT = new Set([1, 2])

function buildTask(t, number) {
  const lines = [t.kes_text, "", t.condition_text]
  if (FRAGMENT_ABSENT.has(number)) {
    lines.push("", "(Фрагмент — из указанного произведения; на экзамене печатается в КИМе.)")
  }
  const out = { condition_text: lines.join("\n"), answer: null }
  if (t.compare_text) {
    out.source_text = t.compare_text
    out.source_title = "текст для сопоставления"
  }
  return out
}

// Случайный вопрос номера (kes === null → любое произведение).
function makeTask(number, kes = null) {
  const pool = kes == null ? BY_NUMBER[number] : BY_NUMBER[number].filter((t) => t.kes === kes)
  if (!pool || !pool.length) return { condition_text: "—", answer: null }
  return buildTask(pick(pool), number)
}

// Короткая подпись произведения для чипа: убрать инициалы, обрезать длинные названия.
function shortLabel(kesText) {
  let s = kesText.replace(/^(?:[А-ЯЁ]\.\s*){1,3}/, "").trim() // «Ф.И. Тютчев…» → «Тютчев…»
  if (s.length > 46) s = s.slice(0, 45).replace(/[\s,«]+$/, "") + "…"
  return s
}

// GENERATORS_LIT: по одному «генератору по умолчанию» на номер (любое произведение).
export const GENERATORS_LIT = {}
// GEN_META_LIT: тема «Произведение» → чип на каждое произведение, встречающееся в номере.
export const GEN_META_LIT = {}

for (const n of [1, 2, 3, 4, 5]) {
  GENERATORS_LIT[n] = [() => makeTask(n)]

  // список произведений в этом номере по убыванию частоты
  const byKes = new Map() // kes → { kes_text, count }
  for (const t of BY_NUMBER[n]) {
    const e = byKes.get(t.kes) || { kes_text: t.kes_text, count: 0 }
    e.count++
    byKes.set(t.kes, e)
  }
  const items = [...byKes.entries()]
    .sort((a, b) => b[1].count - a[1].count || Number(a[0]) - Number(b[0]))
    .map(([kes, { kes_text, count }]) => [
      `w${kes}`,                              // ключ типажа (уникален в пределах номера)
      `${shortLabel(kes_text)} · ${count}`,   // подпись с числом вопросов
      () => makeTask(n, kes),                 // генератор: случайный вопрос этого произведения
    ])
  GEN_META_LIT[n] = [["Произведение", items]]
}
