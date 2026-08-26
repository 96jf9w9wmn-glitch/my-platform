import { useState, useEffect, useMemo } from "react"
import Icon from "./Icon"
import { supabase } from "../supabase"
import { withPaymentState, totalDue, fmtMoney, invoiceNumber, shortDate, longDate } from "../invoices"
import { downloadInvoicePdf } from "../pages/invoicePdf"
import Reveal from "./Reveal"

// Квитанции за проведённые занятия — в кабинете ученика и в кабинете родителя.
//
// Квитанции выписывает база сама (supabase/lesson_invoices.sql): занятие
// закончилось — появилась строка и уведомление. Здесь их только показывают.
// Вызов invoices_sync_mine при открытии — подстраховка на случай, если
// расписание cron не работает: он идемпотентен, лишних квитанций не создаст.
//
// Оплачено/не оплачено НЕ хранится в базе, а раскладывается из общего долга
// (см. src/invoices.js) — иначе у ученика и репетитора разъезжались бы числа.
//
// Пока репетитор не включил квитанции, строк нет и блока не видно вовсе.

const STATUS = {
  paid:    { label: "Оплачено", cls: "bg-green-500/12 text-green-700 dark:text-green-300 ring-green-500/20" },
  partial: { label: "Частично", cls: "bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-amber-500/25" },
  unpaid:  { label: "Ждёт оплаты", cls: "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/20" },
}

export default function InvoiceCard({ student, tutorId, tutorName, className = "" }) {
  const [rows, setRows] = useState([])
  const [payee, setPayee] = useState(null)

  useEffect(() => {
    if (!student?.id) return
    let alive = true
    ;(async () => {
      // Тихо: нет миграции или расширения — просто останемся без квитанций.
      await supabase.rpc("invoices_sync_mine")
      const { data } = await supabase
        .from("lesson_invoices")
        .select("id, lesson_date, lesson_time, duration, amount, canceled_at")
        .eq("student_id", student.id)
        .order("lesson_date", { ascending: false })
        .limit(60)
      if (alive && data) setRows(data)
    })()
    return () => { alive = false }
  }, [student?.id])

  useEffect(() => {
    if (!tutorId) return
    let alive = true
    supabase.rpc("invoice_payee", { p_tutor: tutorId }).then(({ data }) => {
      if (alive) setPayee(Array.isArray(data) ? data[0] : data)
    })
    return () => { alive = false }
  }, [tutorId])

  return <InvoiceView rows={rows} payee={payee} student={student} tutorName={tutorName} className={className} />
}

// Отдельно от загрузки — чтобы вёрстку можно было прогнать на любых данных,
// не поднимая сессию ученика.
export function InvoiceView({ rows, payee, student, tutorName, className = "" }) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const invoices = useMemo(() => withPaymentState(rows, student), [rows, student])
  const unpaid = invoices.filter((i) => i.due > 0)
  const due = totalDue(invoices)

  if (!invoices.length) return null

  const details = payee?.payee_details || payee?.payee_name

  const row = (inv) => {
    const tone = STATUS[inv.status]
    return (
            <div key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  Занятие {shortDate(inv.lesson_date)}
                  {inv.lesson_time && <span className="text-gray-400 font-normal"> · {inv.lesson_time}</span>}
                </div>
                <div className="text-[11px] text-gray-400">№ {invoiceNumber(inv)}</div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${tone.cls}`}>{tone.label}</span>
                <span className="text-sm font-medium w-[74px] text-right">{fmtMoney(inv.amount)} ₽</span>
                <button
                  type="button"
                  onClick={() => download([inv])}
                  title={`Квитанция за ${longDate(inv.lesson_date)}`}
                  aria-label="Скачать квитанцию"
                  className="no-press w-8 h-8 rounded-full grid place-items-center text-gray-400 ring-1 ring-gray-200 bg-white/60 transition-all active:scale-[0.9] hover:text-gray-600 dark:bg-white/5 dark:ring-white/10"
                >
                  <Icon name="download" size={14} />
                </button>
              </div>
            </div>
    )
  }

  async function download(list) {
    if (busy) return
    setBusy(true)
    try {
      await downloadInvoicePdf({
        invoices: list,
        studentName: student?.name,
        tutorName,
        payee,
        note: details ? `Оплата переводом: ${details}` : "",
      })
    } finally {
      setBusy(false)
    }
  }

  function copyDetails() {
    navigator.clipboard?.writeText(details).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <div className={`glass p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-base font-medium">Квитанции</h2>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-gray-500 ring-1 ring-inset ring-gray-300/70 dark:ring-white/15">
          после каждого занятия
        </span>
      </div>

      {due > 0 ? (
        <>
          <p className="text-xs text-gray-500 mb-4">
            {unpaid.length === 1 ? "Одно занятие ждёт оплаты" : `Занятий ждёт оплаты: ${unpaid.length}`}
          </p>
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <div className="text-[11px] text-gray-400 mb-1">К оплате</div>
              <div className="text-3xl font-semibold leading-none bg-gradient-to-r from-[#007AFF] to-[#5856D6] bg-clip-text text-transparent">
                {fmtMoney(due)} ₽
              </div>
            </div>
            <button
              type="button"
              onClick={() => download(unpaid)}
              disabled={busy}
              className="press-fill shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium text-white bg-gradient-to-r from-[#007AFF] to-[#5856D6] disabled:opacity-60 transition-transform active:scale-[0.97]"
            >
              <Icon name="download" size={16} />
              {busy ? "Готовим…" : "Квитанция"}
            </button>
          </div>

          {details && (
            <button
              type="button"
              onClick={copyDetails}
              className="no-press w-full text-left mb-4 rounded-2xl px-4 py-3 ring-1 ring-gray-200 bg-white/60 transition-all active:scale-[0.99] hover:bg-white dark:bg-white/5 dark:ring-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-gray-400 mb-0.5">Куда платить</div>
                  <div className="text-sm text-gray-700 leading-snug break-words">{details}</div>
                </div>
                <span className={`shrink-0 flex items-center gap-1 text-[11px] font-medium ${copied ? "text-green-600" : "text-gray-400"}`}>
                  <Icon name={copied ? "check" : "copy"} size={14} />
                  {copied ? "Скопировано" : "Копировать"}
                </span>
              </div>
            </button>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3 mb-4 mt-3 text-sm bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-500/25">
          <Icon name="check" size={18} className="shrink-0" />
          Все выставленные квитанции оплачены
        </div>
      )}

      <div className="flex flex-col divide-y divide-gray-100 dark:divide-white/5 [&>*:first-child]:pt-0">
        {invoices.slice(0, 5).map(row)}
      </div>

      {/* Хвост списка раскрывается и сворачивается плавно: «Свернуть» — та же
          кнопка закрытия, а список исчезал рывком. */}
      {invoices.length > 5 && (
        <Reveal value={expanded}>{() => (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-white/5 border-t border-gray-100 dark:border-white/5">
            {invoices.slice(5).map(row)}
          </div>
        )}</Reveal>
      )}

      {invoices.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="no-press mt-3 text-xs font-medium text-[#007AFF] transition-transform active:scale-[0.96]"
        >
          {expanded ? "Свернуть" : `Показать все (${invoices.length})`}
        </button>
      )}
    </div>
  )
}
