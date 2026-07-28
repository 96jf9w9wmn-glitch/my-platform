import { useState } from "react"
import { supabase } from "../supabase"
import Icon from "../components/Icon"

// Кнопка «Отчёт родителю»: собирает данные занятия, просит модель составить
// черновик и показывает его РЕПЕТИТОРУ на правку. Родителю ничего не уходит,
// пока он не нажмёт «Отправить» — модель здесь помощник, а не автор.
const CONF = [
  { id: "struggling", label: "тяжело" },
  { id: "progress", label: "движемся" },
  { id: "confident", label: "уверенно" },
]

// Имя ученика не уходит в DeepSeek: сервис в КНР, а имя школьника —
// персональные данные, их передача за границу требует отдельного согласия
// (152-ФЗ). Поэтому имя вырезается здесь, в браузере, а в готовый черновик
// подставляется обратно. Модель на его месте пишет метку NAME_TOKEN.
const NAME_TOKEN = "{{ИМЯ}}"

// В свободном тексте имя склоняется («Ваня решил» → «у Вани»), поэтому ищем не
// точное слово, а основу с любым коротким окончанием. Обычный \b здесь не
// годится: в JS он считает кириллицу небуквенной — вместо него запрет на
// продолжение слова справа.
function nameRegexes(name) {
  return String(name || "")
    .split(/[\s,]+/)
    .filter((w) => w.length >= 3)
    .map((w) => {
      const stem = w.slice(0, Math.max(3, w.length - 2)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      return new RegExp(`${stem}[а-яёa-z]{0,3}(?![а-яёa-zA-ZА-ЯЁ])`, "gi")
    })
}

function hideName(text, name) {
  return nameRegexes(name).reduce((acc, re) => acc.replace(re, NAME_TOKEN), String(text || ""))
}

function restoreName(text, name) {
  return String(text || "").split(NAME_TOKEN).join(name || "ученик")
}

function ReportComposer({ student }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [draft, setDraft] = useState(null)   // { summary, topics, next_steps }
  const [sent, setSent] = useState(false)

  // Что скармливаем модели: последние проведённые занятия с заметками и
  // замечания из карточки. Ничего чужого — только этот ученик.
  function collectSource() {
    const lessons = (student.lessons || []).slice(-5)
    const notes = lessons.map((l) => [l.date, l.note || l.topic || ""].filter(Boolean).join(": ")).filter(Boolean)
    const remarks = (student.remarks || []).slice(-5).map((r) => (typeof r === "string" ? r : r.text || ""))
    return {
      studentName: student.name,
      period: lessons.length ? `${lessons[0].date} — ${lessons[lessons.length - 1].date}` : "",
      notes: [...notes, ...remarks].join("; "),
      results: student.goal ? `цель: ${student.goal}` : "",
    }
  }

  // То же самое, но для отправки наружу: без имени — ни отдельным полем, ни
  // внутри заметок, куда репетитор его пишет свободным текстом.
  function forModel(src) {
    return {
      period: src.period,
      notes: hideName(src.notes, src.studentName),
      results: hideName(src.results, src.studentName),
    }
  }

  async function generate() {
    setOpen(true)
    setError("")
    setLoading(true)
    // Отчёт читает родитель, поэтому подставляем имя, а не «Иванов Иван».
    const source = collectSource()
    const firstName = String(source.studentName || "").split(/\s+/)[0]
    try {
      const res = await fetch("/api/lesson-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(forModel(source)),
      })
      const data = await res.json()
      if (!res.ok) {
        // Модель недоступна — не блокируем: даём пустой бланк под ручное заполнение.
        setError(data.error || "Сервис недоступен — заполните отчёт вручную")
        setDraft({ summary: "", topics: [], next_steps: "" })
        return
      }
      setDraft({
        summary: restoreName(data.summary, firstName),
        topics: (data.topics || []).map((t) => ({
          ...t,
          title: restoreName(t.title, firstName),
          comment: restoreName(t.comment, firstName),
        })),
        next_steps: restoreName(data.next_steps, firstName),
      })
    } catch {
      setError("Сеть недоступна — заполните отчёт вручную")
      setDraft({ summary: "", topics: [], next_steps: "" })
    } finally {
      setLoading(false)
    }
  }

  async function send() {
    if (!draft?.summary?.trim()) { setError("Отчёт без текста родителю не отправляем"); return }
    setSaving(true)
    const { error: err } = await supabase.from("lesson_reports").insert({
      tutor_id: student.tutor_id,
      student_id: String(student.id),
      topics: draft.topics,
      summary: draft.summary.trim(),
      next_steps: draft.next_steps?.trim() || null,
      source: collectSource(),
      sent_at: new Date().toISOString(),
    })
    setSaving(false)
    if (err) {
      setError(/lesson_reports/.test(err.message) ? "Выполните supabase/lesson_reports.sql в Supabase" : err.message)
      return
    }
    // Уведомляем ученика: у родителя своего аккаунта в notifications нет,
    // а семья смотрит приложение с одного телефона чаще, чем два раза.
    // studentAccountId проставляется в App.jsx сопоставлением по телефону и
    // бывает пустым — тогда ищем аккаунт сами, как это уже делает Homework.jsx.
    const accountId = student.studentAccountId || (student.phone
      ? (await supabase.from("student_accounts").select("id").eq("phone", student.phone).maybeSingle()).data?.id
      : null)
    if (accountId) {
      await supabase.from("notifications").insert({
        user_id: accountId,
        title: "Отчёт о занятиях",
        body: "Репетитор отправил отчёт — он виден в кабинете родителя.",
      })
    }
    setOpen(false)
    setDraft(null)
    setSent(true)
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <>
      <button onClick={generate} className="press-fill w-full glass p-4 flex items-center gap-3 text-left rounded-2xl">
        <span className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
          <Icon name="file-text" size={17} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">Отчёт родителю</span>
          <span className="block text-xs text-gray-400">
            {sent ? "Отчёт отправлен родителю" : "Черновик по заметкам занятий — перед отправкой можно править"}
          </span>
        </span>
      </button>

      {open && (
        <div className="glass p-4 rounded-2xl flex flex-col gap-3">
          {loading && <div className="text-sm text-gray-400 text-center py-6">Составляем черновик…</div>}
          {error && <div className="text-xs text-amber-600">{error}</div>}
          {draft && !loading && (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Что было на занятиях</label>
                <textarea
                  rows={4}
                  value={draft.summary}
                  onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-white/15 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none bg-transparent"
                />
              </div>

              {draft.topics.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-gray-400">Темы и уверенность</span>
                  {draft.topics.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={t.title || ""}
                        onChange={(e) => setDraft((d) => ({
                          ...d, topics: d.topics.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                        }))}
                        className="flex-1 min-w-0 border border-gray-200 dark:border-white/15 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-blue-400 bg-transparent"
                      />
                      <select
                        value={t.confidence || "progress"}
                        onChange={(e) => setDraft((d) => ({
                          ...d, topics: d.topics.map((x, j) => (j === i ? { ...x, confidence: e.target.value } : x)),
                        }))}
                        className="shrink-0 border border-gray-200 dark:border-white/15 rounded-xl px-2 py-1.5 text-xs bg-transparent"
                      >
                        {CONF.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      <button
                        onClick={() => setDraft((d) => ({ ...d, topics: d.topics.filter((_, j) => j !== i) }))}
                        className="shrink-0 text-gray-300 hover:text-red-500 w-6 h-6 flex items-center justify-center"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Что дальше</label>
                <input
                  value={draft.next_steps || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, next_steps: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-white/15 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 bg-transparent"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={send} disabled={saving} className="press-fill flex-1 h-11 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 disabled:opacity-50">
                  {saving ? "Отправляем…" : "Отправить родителю"}
                </button>
                <button onClick={() => { setOpen(false); setDraft(null) }} className="press-fill px-4 h-11 rounded-full text-sm ring-1 ring-gray-200 dark:ring-white/15">
                  Отмена
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

export default ReportComposer
