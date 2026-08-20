import { useState, useEffect, useMemo } from "react"
import Icon from "./Icon"
import { supabase } from "../supabase"
import { withPaymentState, totalDue, fmtMoney, shortDate } from "../invoices"

// «Квитанции после занятия» на странице «Финансы».
//
// Смысл фичи: репетитор не выставляет счета и не напоминает о них. Занятие
// закончилось — ученику и родителю ушла квитанция; долг висит дольше N дней —
// ушло напоминание. Репетитор только получает деньги и отмечает оплату там же,
// где отмечал всегда (кнопка «Оплатил» / онлайн-оплата).
//
// Выставляет квитанции сама база по расписанию (supabase/lesson_invoices.sql),
// поэтому здесь нет ни таймеров, ни фоновых задач — только настройки и журнал.

const DELAYS = [
  { min: 0,   label: "Сразу" },
  { min: 60,  label: "Через час" },
  { min: 180, label: "Через 3 часа" },
]
const REMINDERS = [
  { days: 0, label: "Не напоминать" },
  { days: 2, label: "Через 2 дня" },
  { days: 3, label: "Через 3 дня" },
  { days: 7, label: "Через неделю" },
]

const Chip = ({ active, children, ...props }) => (
  <button
    type="button"
    {...props}
    className={`no-press px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.94] ring-1 ${
      active
        ? "bg-[#007AFF] text-white ring-[#007AFF]"
        : "bg-white/60 text-gray-600 ring-gray-200 hover:bg-white dark:bg-white/5 dark:ring-white/10"
    }`}
  >
    {children}
  </button>
)

export default function AutoInvoiceSettings({ tutorId, students = [] }) {
  const [cfg, setCfg] = useState({ enabled: false, delay_min: 0, remind_days: 3, since: null, payee_name: "", payee_details: "" })
  const [ready, setReady] = useState(true)     // миграция lesson_invoices.sql выполнена
  const [rows, setRows] = useState([])
  const [saving, setSaving] = useState(false)
  const [payee, setPayee] = useState({ name: "", details: "" })
  const [payeeDirty, setPayeeDirty] = useState(false)

  useEffect(() => {
    if (!tutorId) return
    let alive = true

    supabase.from("tutor_invoice_settings")
      .select("enabled, delay_min, remind_days, since, payee_name, payee_details")
      .eq("tutor_id", tutorId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) { setReady(false); return }
        if (data) {
          setCfg((c) => ({ ...c, ...data }))
          setPayee({ name: data.payee_name || "", details: data.payee_details || "" })
        }
      })

    // Догоняем занятия, которые закончились между запусками cron: если на базе
    // его нет, квитанции появятся хотя бы при заходе в кабинет.
    supabase.rpc("invoices_sync_self").then(() => {
      supabase.from("lesson_invoices")
        .select("id, student_id, lesson_date, lesson_time, amount, canceled_at")
        .eq("tutor_id", tutorId)
        .order("lesson_date", { ascending: false })
        .limit(50)
        .then(({ data }) => { if (alive && data) setRows(data) })
    })

    return () => { alive = false }
  }, [tutorId])

  async function save(patch) {
    const next = { ...cfg, ...patch }
    setCfg(next)                 // оптимистично: тумблер не должен «залипать»
    if (!tutorId) return
    setSaving(true)
    const { error } = await supabase.from("tutor_invoice_settings").upsert({
      tutor_id: tutorId,
      enabled: next.enabled,
      delay_min: next.delay_min,
      remind_days: next.remind_days,
      since: next.since,
      payee_name: next.payee_name || null,
      payee_details: next.payee_details || null,
      updated_at: new Date().toISOString(),
    })
    if (error) setReady(false)
    setSaving(false)
  }

  function toggle() {
    // Дата включения фиксируется, чтобы первый запуск не выкатил ученику
    // квитанции за всю историю занятий.
    const today = new Date().toISOString().slice(0, 10)
    save({ enabled: !cfg.enabled, since: cfg.enabled ? cfg.since : (cfg.since || today) })
  }

  async function cancelInvoice(id) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, canceled_at: new Date().toISOString() } : r)))
    await supabase.from("lesson_invoices").update({ canceled_at: new Date().toISOString() }).eq("id", id)
  }

  const byStudent = useMemo(() => {
    const map = new Map()
    for (const s of students) map.set(String(s.id), s)
    return map
  }, [students])

  // Ждут оплаты — по той же арифметике, что видит ученик: долг раскладывается
  // по квитанциям от новых к старым.
  const pending = useMemo(() => {
    let sum = 0
    let count = 0
    for (const s of students) {
      const mine = rows.filter((r) => String(r.student_id) === String(s.id))
      if (!mine.length) continue
      const state = withPaymentState(mine, s)
      sum += totalDue(state)
      count += state.filter((i) => i.due > 0).length
    }
    return { sum, count }
  }, [rows, students])

  const active = rows.filter((r) => !r.canceled_at)
  const sinceLabel = cfg.since
    ? new Date(cfg.since).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    : "сегодня"

  return (
    <div className="glass p-5 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium">Квитанции после занятия</h2>
          {cfg.enabled && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/12 text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-500/25">
              Включено
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving || !ready}
          aria-label={cfg.enabled ? "Выключить квитанции" : "Включить квитанции"}
          className={`no-press relative w-12 h-7 rounded-full transition-colors disabled:opacity-40 active:scale-[0.96] ${
            cfg.enabled ? "bg-[#007AFF]" : "bg-black/[0.12] dark:bg-white/[0.16]"
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${cfg.enabled ? "translate-x-5" : ""}`} />
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Занятие закончилось — ученику и родителю сама уходит квитанция на его стоимость.
        Просить об оплате и считать долги больше не нужно: квитанции гасятся, когда вы отмечаете оплату.
      </p>

      {!ready && (
        <div className="text-xs text-amber-600 dark:text-amber-300 bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 rounded-xl px-3 py-2.5 mb-4">
          Не выполнена миграция supabase/lesson_invoices.sql — квитанции негде хранить.
        </div>
      )}

      {cfg.enabled && (
        <>
          <div className="flex flex-col gap-4 mb-5">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-gray-500">Выставлять квитанцию</span>
              <div className="flex flex-wrap gap-2">
                {DELAYS.map((d) => (
                  <Chip key={d.min} active={cfg.delay_min === d.min} onClick={() => save({ delay_min: d.min })}>
                    {d.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-gray-500">Напомнить, если не оплатили</span>
              <div className="flex flex-wrap gap-2">
                {REMINDERS.map((r) => (
                  <Chip key={r.days} active={cfg.remind_days === r.days} onClick={() => save({ remind_days: r.days })}>
                    {r.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-5">
            <span className="text-xs text-gray-500">Куда платить — покажем в квитанции</span>
            <input
              value={payee.name}
              onChange={(e) => { setPayee((p) => ({ ...p, name: e.target.value })); setPayeeDirty(true) }}
              onBlur={() => payeeDirty && save({ payee_name: payee.name })}
              placeholder="Получатель: Иванов Иван Иванович"
              className="input-glass text-sm"
            />
            <input
              value={payee.details}
              onChange={(e) => { setPayee((p) => ({ ...p, details: e.target.value })); setPayeeDirty(true) }}
              onBlur={() => payeeDirty && save({ payee_details: payee.details })}
              placeholder="СБП +7 900 000-00-00, Т-Банк"
              className="input-glass text-sm"
            />
            <span className="text-[11px] text-gray-400">
              Если подключена онлайн-оплата, ученик сможет заплатить картой прямо из кабинета — реквизиты нужны для перевода.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="stat-card">
              <div className="text-xs text-gray-500 mb-1">Выставлено</div>
              <div className="text-xl font-medium">{active.length}</div>
              <div className="text-[11px] text-gray-400 mt-1">с {sinceLabel}</div>
            </div>
            <div className={pending.sum > 0 ? "glass-tint-amber p-4 rounded-2xl" : "stat-card"}>
              <div className={`text-xs mb-1 ${pending.sum > 0 ? "text-amber-500" : "text-gray-500"}`}>Ждут оплаты</div>
              <div className={`text-xl font-medium ${pending.sum > 0 ? "text-amber-600" : "text-gray-400"}`}>
                {fmtMoney(pending.sum)} ₽
              </div>
              <div className={`text-[11px] mt-1 ${pending.sum > 0 ? "text-amber-400" : "text-gray-400"}`}>
                {pending.count > 0 ? `${pending.count} шт.` : "всё закрыто"}
              </div>
            </div>
          </div>

          {active.length > 0 && (
            <div className="flex flex-col divide-y divide-gray-100 dark:divide-white/5">
              {active.slice(0, 6).map((inv) => {
                const student = byStudent.get(String(inv.student_id))
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{student?.name || "Ученик"}</div>
                      <div className="text-[11px] text-gray-400">
                        Занятие {shortDate(inv.lesson_date)}{inv.lesson_time ? ` · ${inv.lesson_time}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-sm font-medium">{fmtMoney(inv.amount)} ₽</span>
                      <button
                        type="button"
                        onClick={() => cancelInvoice(inv.id)}
                        title="Аннулировать: занятие не состоялось"
                        aria-label="Аннулировать квитанцию"
                        className="no-press w-8 h-8 rounded-full grid place-items-center text-gray-400 ring-1 ring-gray-200 bg-white/60 transition-all active:scale-[0.9] hover:text-red-500 dark:bg-white/5 dark:ring-white/10"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
