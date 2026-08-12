import { useState } from "react"
import { createPortal } from "react-dom"
import Icon from "../components/Icon"
import MorphIcon from "../components/MorphIcon"
import { plural } from "../utils"
import { hasGenerators, generateTask, taskThemes } from "./taskGenerators"
import { assembleFromBank, TASK_NUMBERS_BY_TYPE, PART2_NUMBERS } from "./taskBankApi"
import { generateWorkbookPdf } from "./workbookPdf"

// «Рабочая тетрадь» — лист для печати: условие, а под ним поле в клетку для решения от руки.
// Настроек ровно столько, сколько нужно: что вошло, сколько заданий и сколько места под
// решение. Всё остальное подставляется само, чтобы тетрадь собиралась одним нажатием.

const MAX_NUMBER = 38

function numbersWithGen(examType) {
  const out = []
  for (let n = 1; n <= MAX_NUMBER; n++) if (hasGenerators(examType, n)) out.push(n)
  return out
}

// focus из «Банка заданий»: число | "gen:номер:типаж" | "fam:номер:тема" | "mod:…" | "read…"
function parseFocus(focus) {
  if (typeof focus === "number") return { number: focus }
  if (typeof focus !== "string") return null
  const [kind, n, ...rest] = focus.split(":")
  if (kind === "gen") return { number: Number(n), genKey: rest.join(":") }
  if (kind === "fam") return { number: Number(n), theme: rest.join(":") }
  return null
}

function focusTitle(examType, f) {
  if (!f) return ""
  if (f.genKey) {
    const items = (taskThemes(examType, f.number) || []).flatMap((g) => g.items)
    const it = items.find((i) => i.key === f.genKey)
    return `№${f.number} · ${it?.label || "типаж"}`
  }
  if (f.theme) return `№${f.number} · ${f.theme}`
  return `№${f.number}`
}

const COUNTS = [4, 8, 12, 20]

// Высота поля под решение: «Авто» — по номеру задания (часть 2 получает больше места).
const SPACES = [
  { key: "auto", label: "Авто" },
  { key: "compact", label: "Мало" },
  { key: "medium", label: "Средне" },
  { key: "large", label: "Много" },
]

function genSafe(examType, number, genKey) {
  try { return generateTask(examType, number, genKey) } catch { return null }
}

// Случайный типаж внутри семейства — чтобы тетрадь по теме не была из одной и той же задачи.
function genFam(examType, number, theme) {
  const g = (taskThemes(examType, number) || []).find((t) => t.theme === theme)
  if (!g?.items.length) return null
  return genSafe(examType, number, g.items[Math.floor(Math.random() * g.items.length)].key)
}

export default function WorkbookModal({ examType, examLabel = "", focus = null, onClose }) {
  const f = parseFocus(focus)
  const canVariant = !!TASK_NUMBERS_BY_TYPE[examType]
  const [scope, setScope] = useState(f ? "focus" : "all")
  const [count, setCount] = useState(8)
  const [space, setSpace] = useState("auto")
  const [answersPage, setAnswersPage] = useState(true)
  const [title, setTitle] = useState("Рабочая тетрадь")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  // в варианте, кроме части 1, идут номера части 2 (ОГЭ 20–25, профиль 13)
  const allCount = canVariant
    ? TASK_NUMBERS_BY_TYPE[examType] + (PART2_NUMBERS[examType]?.length || 0)
    : numbersWithGen(examType).length
  const willBe = scope === "focus" ? count : allCount
  const subject = examLabel || examType

  async function buildTasks() {
    if (scope === "focus" && f) {
      const out = []
      for (let i = 0; i < count; i++) {
        const t = f.genKey ? genSafe(examType, f.number, f.genKey)
          : f.theme ? genFam(examType, f.number, f.theme)
            : genSafe(examType, f.number)
        if (t) out.push(t)
      }
      return out
    }
    if (canVariant) {
      const { picked } = await assembleFromBank(examType)
      return picked.filter(Boolean)
    }
    return numbersWithGen(examType).map((n) => genSafe(examType, n)).filter(Boolean)
  }

  async function download() {
    setBusy(true); setErr("")
    try {
      const tasks = await buildTasks()
      if (!tasks.length) throw new Error("нет заданий")
      const blob = await generateWorkbookPdf({
        title: title.trim() || "Рабочая тетрадь",
        subtitle: scope === "focus" ? `${subject} · ${focusTitle(examType, f)}` : subject,
        examType,
        tasks,
        space,
        answersPage,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${title.trim() || "Рабочая тетрадь"} — ${subject}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (e) {
      setErr(e?.message === "нет заданий" ? "Для этого выбора заданий не нашлось" : "Не получилось собрать PDF")
    } finally {
      setBusy(false)
    }
  }

  const chip = (active) =>
    `px-3.5 py-2 rounded-xl text-sm border transition-all active:scale-95 ${
      active
        ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
    }`

  return createPortal(
    <div className="fixed inset-0 glass-overlay z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="glass-modal p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto">
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Icon name="grid" size={18} />
              </div>
              <div>
                <h2 className="text-lg font-medium leading-tight">Рабочая тетрадь</h2>
                <div className="text-xs text-gray-400">{subject}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-1"><Icon name="x" size={18} /></button>
          </div>

          <p className="text-xs text-gray-400 mt-3 mb-4 leading-snug">
            Задание, под ним поле в клетку 5 мм для решения от руки. PDF готов к печати на A4.
          </p>

          <label className="text-xs text-gray-500 mb-1.5 block">Название на обложке</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-glass py-2 mb-4" />

          <div className="text-xs text-gray-500 mb-1.5">Что войдёт</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {f && (
              <button onClick={() => setScope("focus")} className={chip(scope === "focus")}>
                {focusTitle(examType, f)}
              </button>
            )}
            <button onClick={() => setScope("all")} className={chip(scope === "all")}>
              {canVariant ? "Весь вариант" : "Все номера"}
            </button>
          </div>

          {scope === "focus" && (
            <>
              <div className="text-xs text-gray-500 mb-1.5">Сколько заданий</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {COUNTS.map((c) => (
                  <button key={c} onClick={() => setCount(c)} className={chip(count === c)}>{c}</button>
                ))}
              </div>
            </>
          )}

          <div className="text-xs text-gray-500 mb-1.5">Места под решение</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {SPACES.map((s) => (
              <button key={s.key} onClick={() => setSpace(s.key)} className={chip(space === s.key)}>{s.label}</button>
            ))}
          </div>

          <button
            onClick={() => setAnswersPage((v) => !v)}
            className="w-full flex items-center gap-2.5 text-left mb-5 active:scale-[0.99] transition-transform"
          >
            <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
              answersPage ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300"
            }`}>
              {answersPage && <Icon name="check" size={13} />}
            </span>
            <span className="text-sm text-gray-600">Страница ответов в конце</span>
          </button>

          {err && <div className="text-xs text-red-500 mb-3">{err}</div>}

          <button onClick={download} disabled={busy} className="btn-primary w-full py-2.5 disabled:opacity-50 flex items-center justify-center gap-2">
            <MorphIcon from="download" size={15} active={busy} />
            {busy ? "Собираем PDF…" : `Скачать PDF · ${willBe} ${plural(willBe, "задание", "задания", "заданий")}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
