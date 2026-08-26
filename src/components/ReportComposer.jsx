import { useEffect, useRef, useState } from "react"
import { supabase } from "../supabase"
import Icon from "../components/Icon"
import Reveal from "./Reveal"
import { generateReport, sendReport, worthSending } from "../reportData"
import { reportSheetHtml } from "../pages/reportSheet"

// «Отчёт родителю»: репетитор ничего не заполняет.
//
// Одна кнопка собирает лист целиком — занятия, домашние работы, темы и
// уверенность по ним считаются из фактов (src/reportData.js), модель пишет
// поверх них человеческий текст. Репетитор видит готовый лист ровно в том
// виде, в каком его получит родитель, и либо отправляет, либо правит текст —
// но править ничего не обязан.
//
// Ширина листа фиксированная (780px — пропорция A4 без полей), поэтому
// превью просто масштабируется под колонку.
const SHEET_W = 780

function SheetPreview({ html }) {
  const box = useRef(null)
  const sheet = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(Math.min(1, el.clientWidth / SHEET_W))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Высота обёртки — высота листа после масштабирования: без этого под
  // превью оставалась бы пустота в исходный рост листа.
  const [height, setHeight] = useState(0)
  useEffect(() => {
    if (sheet.current) setHeight(sheet.current.scrollHeight * scale)
  }, [html, scale])

  return (
    <div ref={box} className="rounded-2xl overflow-hidden ring-1 ring-gray-200 dark:ring-white/10 bg-white" style={{ height }}>
      <div
        ref={sheet}
        style={{ width: SHEET_W, transform: `scale(${scale})`, transformOrigin: "top left", padding: "26px 24px" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function ReportComposer({ student }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [report, setReport] = useState(null)
  const [editing, setEditing] = useState(false)
  const [sent, setSent] = useState(false)
  const [tutorName, setTutorName] = useState("")

  useEffect(() => {
    if (!student.tutor_id) return
    supabase.from("tutors").select("name").eq("id", student.tutor_id).single()
      .then(({ data }) => { if (data?.name) setTutorName(data.name) })
  }, [student.tutor_id])

  const sheetParams = report && {
    report: { ...report, lesson_date: report.period_to },
    studentName: student.name,
    tutorName,
    stats: report.stats,
    lessons: report.lessons,
    period: { from: report.period_from, to: report.period_to },
  }

  async function build() {
    setOpen(true)
    setError("")
    setEditing(false)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const draft = await generateReport(student, { accessToken: session?.access_token })
      if (!worthSending({ stats: draft.stats })) {
        setError("За период не было проведённых занятий — отчитываться пока не о чем")
        setReport(null)
        return
      }
      // Модель могла не ответить (нет ключа, лимит тарифа, сеть): цифры и темы
      // от неё не зависят, поэтому лист собирается всё равно — просто суше.
      if (!draft.ai) setError("Текст составлен по цифрам без ИИ — можно поправить вручную")
      setReport(draft)
    } catch (e) {
      setError(e?.message || "Не удалось собрать отчёт")
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  // jspdf и html2canvas тянут около 250 кБ — грузим их только когда лист
  // действительно сохраняют, а не при каждом открытии карточки ученика.
  async function savePdf() {
    const { downloadReportPdf } = await import("../pages/reportPdf")
    await downloadReportPdf(sheetParams)
  }

  async function send() {
    if (!report?.summary?.trim()) { setError("Отчёт без текста родителю не отправляем"); return }
    setSaving(true)
    const { error: err } = await sendReport(student, report)
    setSaving(false)
    if (err) {
      setError(/lesson_reports/.test(err.message) ? "Выполните supabase/lesson_reports.sql в Supabase" : err.message)
      return
    }
    setOpen(false)
    setReport(null)
    setSent(true)
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <>
      <button onClick={build} className="press-fill w-full glass p-4 flex items-center gap-3 text-left rounded-2xl">
        <span className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
          <Icon name="file-text" size={17} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">Отчёт родителю</span>
          <span className="block text-xs text-gray-400">
            {sent ? "Отчёт отправлен родителю" : "Собирается сам по занятиям, работам и решённым задачам"}
          </span>
        </span>
      </button>

      <Reveal value={open}>{() => (
        <div className="glass p-4 rounded-2xl flex flex-col gap-3">
          {loading && <div className="text-sm text-gray-400 text-center py-6">Собираем отчёт…</div>}
          {error && <div className="text-xs text-amber-600">{error}</div>}

          {report && !loading && (
            <>
              <SheetPreview html={reportSheetHtml(sheetParams)} />

              <Reveal value={editing}>{() => (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Коротко о главном</label>
                    <textarea
                      rows={4}
                      value={report.summary}
                      onChange={(e) => setReport((r) => ({ ...r, summary: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-white/15 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Что дальше</label>
                    <textarea
                      rows={2}
                      value={report.next_steps || ""}
                      onChange={(e) => setReport((r) => ({ ...r, next_steps: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-white/15 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none bg-transparent"
                    />
                  </div>
                </div>
              )}</Reveal>

              <div className="flex gap-2">
                <button onClick={send} disabled={saving} className="press-fill flex-1 h-11 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 disabled:opacity-50">
                  {saving ? "Отправляем…" : "Отправить родителю"}
                </button>
                <button
                  onClick={savePdf}
                  title="Скачать PDF"
                  className="press-fill w-11 h-11 rounded-full ring-1 ring-gray-200 dark:ring-white/15 flex items-center justify-center"
                >
                  <Icon name="download" size={16} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => setEditing((v) => !v)} className="press-fill text-xs text-blue-600 dark:text-blue-300 px-2 py-1 rounded-lg">
                  {editing ? "Скрыть правку" : "Изменить текст"}
                </button>
                <button onClick={() => { setOpen(false); setReport(null); setEditing(false) }} className="press-fill text-xs text-gray-400 px-2 py-1 rounded-lg">
                  Отмена
                </button>
              </div>
            </>
          )}

          {!report && !loading && (
            <button onClick={() => { setOpen(false); setError("") }} className="press-fill h-10 rounded-full text-sm ring-1 ring-gray-200 dark:ring-white/15">
              Закрыть
            </button>
          )}
        </div>
      )}</Reveal>
    </>
  )
}

export default ReportComposer
