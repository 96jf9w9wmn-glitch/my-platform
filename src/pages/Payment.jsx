import { useState, useEffect } from "react"
import Icon from "../components/Icon"
import ConfirmModal from "../components/ConfirmModal"
import { supabase } from "../supabase"
import { isLessonConducted, getInitials } from "../utils"

const TAX_MODES = {
  none: { label: "Без налога", rate: 0 },
  npd: { label: "Самозанятый", rate: 4 },
  usn6: { label: "ИП · УСН 6%", rate: 6 },
}
// Подсказки для быстрого добавления при пустом списке расходов.
const EXPENSE_SUGGESTIONS = ["Онлайн-доска", "Подписка Precettore", "Реклама", "Связь"]

function parsePaymentDate(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split(".")
  if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0])
  return new Date(dateStr)
}

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return { start, end }
}

// Деньги, полученные помесячно (по дате платежа) за последние `count` месяцев —
// это «касса», из которой строятся столбцы графика.
function getMonthlyIncome(payments, count = 6) {
  const now = new Date()
  const buckets = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      total: 0,
      label: d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", ""),
    })
  }
  for (const p of payments) {
    const d = parsePaymentDate(p.date)
    if (!d) continue
    const b = buckets.find((x) => x.year === d.getFullYear() && x.month === d.getMonth())
    if (b) b.total += p.amount || 0
  }
  return buckets
}

// Прогноз до конца месяца — сумма ещё не проведённых уроков, запланированных
// в текущем календарном месяце (потенциальные деньги, которые вот-вот придут).
function getMonthForecast(students) {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  let sum = 0
  for (const s of students) {
    const price = s.lessonPrice || 0
    if (!price) continue
    for (const l of (s.lessons || [])) {
      if (!l.date) continue
      const [ly, lm] = l.date.split("-").map(Number)
      if (ly === y && lm - 1 === m && !isLessonConducted(l)) sum += price
    }
  }
  return sum
}

const fmt = (n) => Math.round(n || 0).toLocaleString("ru-RU").replace(/\s/g, " ")

// Столбец с округлённой верхушкой (низ плоский — стоит на базовой линии).
function barPath(x, yTop, w, yBase, r) {
  r = Math.max(0, Math.min(r, w / 2, yBase - yTop))
  return `M${x},${yBase} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} ` +
    `L${x + w - r},${yTop} Q${x + w},${yTop} ${x + w},${yTop + r} L${x + w},${yBase} Z`
}

function IncomeChart({ buckets, forecast, mounted }) {
  const W = 760, H = 200
  const padX = 14, top = 30, bottom = H - 30
  const chartH = bottom - top
  const n = buckets.length
  const slot = (W - padX * 2) / n
  const barW = Math.min(slot * 0.52, 46)
  const lastIdx = n - 1
  const projectedLast = buckets[lastIdx].total + forecast
  const maxVal = Math.max(...buckets.map((b) => b.total), projectedLast, 1) * 1.2
  const y = (v) => bottom - (v / maxVal) * chartH
  const r = Math.min(barW / 2, 9)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="incomeBar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5AC8FA" />
          <stop offset="55%" stopColor="#007AFF" />
          <stop offset="100%" stopColor="#5856D6" />
        </linearGradient>
      </defs>

      {/* базовая линия */}
      <line x1={padX} y1={bottom + 0.5} x2={W - padX} y2={bottom + 0.5}
        stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />

      {buckets.map((b, i) => {
        const x = padX + slot * i + (slot - barW) / 2
        const cx = x + barW / 2
        const isLast = i === lastIdx
        const fc = isLast ? forecast : 0
        const total = b.total
        const projected = total + fc
        const solidTopY = y(total)
        const fullTopY = y(projected)
        const solidH = bottom - solidTopY
        const delay = i * 70
        return (
          <g key={i}>
            <g style={{
              transformBox: "fill-box", transformOrigin: "bottom",
              transform: mounted ? "scaleY(1)" : "scaleY(0)",
              transition: `transform .7s cubic-bezier(.22,1,.36,1) ${delay}ms`,
            }}>
              {fc > 0 ? (
                <>
                  {/* прогноз — полупрозрачная надстройка того же цвета, пунктирный контур */}
                  <path d={barPath(x, fullTopY, barW, solidTopY, r)}
                    fill="url(#incomeBar)" fillOpacity="0.18"
                    stroke="#007AFF" strokeOpacity="0.6" strokeWidth="1.3" strokeDasharray="4 3" />
                  {/* уже полученное — сплошной низ */}
                  <rect x={x} y={solidTopY} width={barW} height={solidH} fill="url(#incomeBar)" />
                  {/* граница «получено / прогноз» */}
                  <line x1={x} y1={solidTopY} x2={x + barW} y2={solidTopY}
                    stroke="#fff" strokeOpacity="0.85" strokeWidth="1.5" />
                </>
              ) : total > 0 ? (
                <path d={barPath(x, solidTopY, barW, bottom, r)}
                  fill="url(#incomeBar)" opacity={isLast ? 1 : 0.85} />
              ) : (
                /* месяц без дохода — едва заметная отметка на оси */
                <rect x={x} y={bottom - 4} width={barW} height={4} rx={2}
                  fill="currentColor" fillOpacity="0.09" />
              )}
            </g>

            {/* число над столбцом: прогнозный итог для текущего месяца, иначе — доход */}
            {projected > 0 && (
              <text x={cx} y={fullTopY - 8} textAnchor="middle"
                fontSize="12" fontWeight="600" fill="currentColor"
                fillOpacity={isLast ? "0.9" : "0.5"}
                style={{ opacity: mounted ? 1 : 0, transition: `opacity .45s ${delay + 240}ms` }}>
                {fmt(projected)}
              </text>
            )}
            {/* полученная часть — белым внутри сплошного столбца */}
            {fc > 0 && solidH > 30 && (
              <text x={cx} y={solidTopY + 17} textAnchor="middle"
                fontSize="11" fontWeight="600" fill="#fff"
                style={{ opacity: mounted ? 1 : 0, transition: `opacity .45s ${delay + 320}ms` }}>
                {fmt(total)}
              </text>
            )}
            {/* подпись месяца */}
            <text x={cx} y={bottom + 18} textAnchor="middle"
              fontSize="12" fontWeight={isLast ? "600" : "400"} fill="currentColor"
              fillOpacity={isLast ? "0.9" : "0.45"}>
              {b.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function GoalRing({ value, projected, goal, onSetGoal }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(goal ? String(goal) : "")
  const R = 32, C = 2 * Math.PI * R
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0
  const projPct = goal > 0 ? Math.min(projected / goal, 1) : 0
  const remaining = Math.max(0, goal - value)

  function save() {
    onSetGoal(Number(draft) || 0)
    setEditing(false)
  }

  if (editing || !goal) {
    return (
      <div className="stat-card flex flex-col justify-center">
        <div className="text-sm text-gray-500 mb-2">Цель месяца</div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text" inputMode="numeric" autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="Напр. 60000"
              className="input-glass pr-7 w-full"
            />
            <span className="absolute right-3 top-1.5 text-sm text-gray-400">₽</span>
          </div>
          <button onClick={save}
            className="bg-blue-600 text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-700 transition active:scale-95">
            <Icon name="check" size={16} />
          </button>
        </div>
      </div>
    )
  }

  const dash = (frac) => `${C * frac} ${C}`

  return (
    <button
      onClick={() => { setDraft(String(goal)); setEditing(true) }}
      className="stat-card flex items-center gap-3 text-left group transition active:scale-[0.98]"
      title="Изменить цель"
    >
      <div className="relative shrink-0" style={{ width: 62, height: 62 }}>
        <svg viewBox="0 0 78 78" className="w-full h-full -rotate-90">
          <circle cx="39" cy="39" r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="7" />
          {projPct > pct && (
            <circle cx="39" cy="39" r={R} fill="none" stroke="#007AFF" strokeOpacity="0.25"
              strokeWidth="7" strokeLinecap="round" strokeDasharray={dash(projPct)} />
          )}
          <circle cx="39" cy="39" r={R} fill="none" stroke="url(#goalStroke)"
            strokeWidth="7" strokeLinecap="round" strokeDasharray={dash(pct)}
            style={{ transition: "stroke-dasharray .9s cubic-bezier(.22,1,.36,1)" }} />
          <defs>
            <linearGradient id="goalStroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5AC8FA" />
              <stop offset="100%" stopColor="#5856D6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-semibold">{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-sm text-gray-500 mb-0.5 flex items-center gap-1">
          Цель месяца
          <Icon name="edit" size={11} className="opacity-0 group-hover:opacity-40 transition-opacity" />
        </div>
        <div className="text-base font-medium">{fmt(goal)} ₽</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {remaining > 0 ? `осталось ${fmt(remaining)} ₽` : "цель достигнута 🎉"}
        </div>
      </div>
    </button>
  )
}

function Payment({ students, setStudents, tutorId }) {
  const [period, setPeriod] = useState("all")
  const [confirmId, setConfirmId] = useState(null)
  const [customAmount, setCustomAmount] = useState("")
  const [mounted, setMounted] = useState(false)
  const [undoStudent, setUndoStudent] = useState(null)
  const [goal, setGoal] = useState(() => {
    const v = localStorage.getItem("precettore_finance_goal")
    return v ? Number(v) : 0
  })
  const [taxMode, setTaxMode] = useState("none")
  const [taxRate, setTaxRate] = useState(4)
  const [expenses, setExpenses] = useState([])
  const [newExpName, setNewExpName] = useState("")
  const [newExpAmount, setNewExpAmount] = useState("")

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Загрузка налоговых настроек и расходов тьютора (RLS ограничивает своими строками).
  // До прогона миграции таблиц может не быть — ошибку глушим, работаем локально.
  useEffect(() => {
    if (!tutorId) return
    let alive = true
    ;(async () => {
      const [{ data: settings }, { data: exp }] = await Promise.all([
        supabase.from("tutor_finance_settings").select("tax_mode, tax_rate").eq("tutor_id", tutorId).maybeSingle(),
        supabase.from("tutor_expenses").select("id, name, amount").eq("tutor_id", tutorId).order("created_at"),
      ]).catch(() => [{ data: null }, { data: null }])
      if (!alive) return
      if (settings) { setTaxMode(settings.tax_mode); setTaxRate(Number(settings.tax_rate) || 4) }
      if (exp) setExpenses(exp.map((e) => ({ ...e, amount: Number(e.amount) })))
    })()
    return () => { alive = false }
  }, [tutorId])

  async function saveTaxSettings(mode, rate) {
    setTaxMode(mode); setTaxRate(rate)
    if (!tutorId) return
    try {
      await supabase.from("tutor_finance_settings")
        .upsert({ tutor_id: tutorId, tax_mode: mode, tax_rate: rate, updated_at: new Date().toISOString() })
    } catch { /* таблицы ещё нет — молча */ }
  }

  async function addExpense(name, amount) {
    const trimmed = (name || "").trim()
    if (!trimmed || !amount || amount <= 0) return
    const optimistic = { id: `tmp_${Date.now()}`, name: trimmed, amount }
    setExpenses((prev) => [...prev, optimistic])
    setNewExpName(""); setNewExpAmount("")
    if (!tutorId) return
    try {
      const { data } = await supabase.from("tutor_expenses")
        .insert({ tutor_id: tutorId, name: trimmed, amount }).select("id, name, amount").single()
      if (data) setExpenses((prev) => prev.map((e) => e.id === optimistic.id ? { ...data, amount: Number(data.amount) } : e))
    } catch { /* таблицы ещё нет — остаётся локально */ }
  }

  async function removeExpense(id) {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    if (!tutorId || String(id).startsWith("tmp_")) return
    try { await supabase.from("tutor_expenses").delete().eq("id", id).eq("tutor_id", tutorId) } catch { /* no-op */ }
  }

  function saveGoal(v) {
    setGoal(v)
    if (v > 0) localStorage.setItem("precettore_finance_goal", String(v))
    else localStorage.removeItem("precettore_finance_goal")
  }

  function handlePay(student, amount) {
    if (!amount || amount <= 0) return
    setStudents((prev) =>
      prev.map((s) =>
        s.id === student.id ? {
          ...s,
          paid: true,
          balance: (s.balance || 0) + amount,
          payments: [...(s.payments || []), {
            amount,
            date: new Date().toLocaleDateString("ru-RU"),
            note: "",
            id: Date.now(),
          }],
        } : s
      )
    )
    setConfirmId(null)
    setCustomAmount("")
  }

  function handleUndo(student) {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== student.id) return s
        const payments = [...(s.payments || [])]
        payments.pop()
        return {
          ...s,
          paid: payments.length > 0,
          balance: payments.reduce((sum, p) => sum + p.amount, 0),
          payments,
        }
      })
    )
  }

  function getStudentDebt(student) {
    const conducted = (student.lessons || []).filter((l) => isLessonConducted(l))
    const totalOwed = conducted.length * (student.lessonPrice || 0)
    const totalPaid = (student.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
    return totalOwed - totalPaid
  }

  function getUnpaidLessons(student) {
    const conducted = (student.lessons || [])
      .filter((l) => isLessonConducted(l))
      .sort((a, b) => a.date.localeCompare(b.date))
    const price = student.lessonPrice || 0
    const totalPaid = (student.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
    const paidCount = price > 0 ? Math.floor(totalPaid / price) : 0
    const credit = price > 0 ? totalPaid % price : 0
    return conducted.slice(paidCount).map((l, i) => ({
      ...l,
      amountDue: i === 0 ? price - credit : price,
    }))
  }

  function hasConductedLessons(student) {
    return (student.lessons || []).some((l) => isLessonConducted(l))
  }

  const allPayments = students
    .flatMap((s) => (s.payments || []).map((p) => ({ ...p, studentName: s.name })))
    .sort((a, b) => parsePaymentDate(b.date) - parsePaymentDate(a.date))

  const weekRange = getWeekRange()
  const monthRange = getMonthRange()
  const weekPayments = allPayments.filter((p) => { const d = parsePaymentDate(p.date); return d >= weekRange.start && d <= weekRange.end })
  const monthPayments = allPayments.filter((p) => { const d = parsePaymentDate(p.date); return d >= monthRange.start && d <= monthRange.end })
  const monthTotal = monthPayments.reduce((sum, p) => sum + p.amount, 0)
  const allTotal = allPayments.reduce((sum, p) => sum + p.amount, 0)
  const filteredPayments = period === "week" ? weekPayments : period === "month" ? monthPayments : allPayments

  const buckets = getMonthlyIncome(allPayments, 6)
  const lastMonthTotal = buckets.length >= 2 ? buckets[buckets.length - 2].total : 0
  const deltaPct = lastMonthTotal > 0 ? Math.round((monthTotal - lastMonthTotal) / lastMonthTotal * 100) : null
  const forecast = getMonthForecast(students)
  const projected = monthTotal + forecast
  const avgCheck = allPayments.length > 0 ? allTotal / allPayments.length : 0

  const debtors = students.filter((s) => getStudentDebt(s) > 0)
  const totalDebt = debtors.reduce((sum, s) => sum + getStudentDebt(s), 0)
  const paid = students.filter((s) => hasConductedLessons(s) && getStudentDebt(s) <= 0)
  const noLessons = students.filter((s) => !hasConductedLessons(s))

  const rawMonth = new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
  const monthLabel = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)

  // Расходы / налог / чистая прибыль за текущий месяц.
  // НПД и УСН «Доходы» считают налог от дохода (расходы базу не уменьшают).
  const expenseTotal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const effRate = taxMode === "usn6" ? 6 : taxMode === "npd" ? taxRate : 0
  const taxAmount = Math.round(monthTotal * effRate / 100)
  const netProfit = monthTotal - expenseTotal - taxAmount

  return (
    <div className="p-6">
      <h1 className="text-xl font-medium mb-6">Финансы</h1>

      {/* HERO — финансовый поток */}
      <div className="glass p-5 md:p-6 mb-4 overflow-hidden relative">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,300px)_1fr] gap-6 items-center">
          <div>
            <div className="text-sm text-gray-500 mb-1">{monthLabel}</div>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="text-4xl md:text-5xl font-semibold leading-none bg-gradient-to-r from-[#007AFF] to-[#5856D6] bg-clip-text text-transparent">
                {fmt(monthTotal)} ₽
              </div>
              {deltaPct !== null && (
                <div className={`flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-full mb-0.5 ${
                  deltaPct >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  <Icon name={deltaPct >= 0 ? "trending-up" : "trending-down"} size={13} />
                  {deltaPct >= 0 ? "+" : ""}{deltaPct}%
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {deltaPct !== null ? "к прошлому месяцу" : "получено в этом месяце"}
            </div>

            {forecast > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: "repeating-linear-gradient(45deg,rgba(0,122,255,0.5),rgba(0,122,255,0.5) 2px,transparent 2px,transparent 4px)", border: "1px solid rgba(0,122,255,0.4)" }} />
                  <span className="text-gray-500">Прогноз до конца месяца</span>
                </div>
                <div className="mt-1 text-lg font-medium">
                  <span className="text-blue-600">+{fmt(forecast)} ₽</span>
                  <span className="text-gray-400 text-sm font-normal"> → {fmt(projected)} ₽</span>
                </div>
              </div>
            )}
          </div>

          <div className="text-gray-800">
            <IncomeChart buckets={buckets} forecast={forecast} mounted={mounted} />
          </div>
        </div>
      </div>

      {/* KPI-полоса */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <div className="text-sm text-gray-500 mb-1">Всего получено</div>
          <div className="text-2xl font-medium text-green-600">{fmt(allTotal)} ₽</div>
          <div className="text-xs text-gray-400 mt-1">за всё время</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-gray-500 mb-1">Средний чек</div>
          <div className="text-2xl font-medium">{fmt(avgCheck)} ₽</div>
          <div className="text-xs text-gray-400 mt-1">{allPayments.length} платеж{allPayments.length % 10 === 1 && allPayments.length % 100 !== 11 ? "" : "ей"}</div>
        </div>
        <div className={debtors.length > 0 ? "glass-tint-amber p-4" : "stat-card"}>
          <div className={`text-sm mb-1 ${debtors.length > 0 ? "text-amber-500" : "text-gray-500"}`}>Задолженность</div>
          <div className={`text-2xl font-medium ${debtors.length > 0 ? "text-amber-600" : "text-gray-400"}`}>{fmt(totalDebt)} ₽</div>
          <div className={`text-xs mt-1 ${debtors.length > 0 ? "text-amber-400" : "text-gray-400"}`}>
            {debtors.length > 0 ? `${debtors.length} должник${debtors.length % 10 === 1 && debtors.length % 100 !== 11 ? "" : "ов"}` : "все рассчитались"}
          </div>
        </div>
        <GoalRing value={monthTotal} projected={projected} goal={goal} onSetGoal={saveGoal} />
      </div>

      {/* Две flex-колонки равной высоты (grid → items-stretch). Замыкающая карточка
          каждой колонки (расходы слева, история справа) растягивается на остаток
          высоты, поэтому низ колонок выровнен и под ними не остаётся пустот. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">

        {/* ЛЕВАЯ КОЛОНКА: статусы оплат + расходы */}
        <div className="flex flex-col gap-4 min-h-0">

          {debtors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <h2 className="text-base font-medium">Ждут оплаты</h2>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-300 bg-amber-500/12 ring-1 ring-inset ring-amber-500/20 px-2 py-0.5 rounded-full">{debtors.length}</span>
              </div>
              <div className="flex flex-col gap-3">
                {debtors.map((s) => (
                  <div key={s.id} className="glass rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          {getInitials(s.name)}
                        </div>
                        <div className="text-sm font-semibold truncate">{s.name}</div>
                      </div>
                      <div className="text-[13px] font-semibold text-amber-600 dark:text-amber-300 bg-amber-500/12 ring-1 ring-inset ring-amber-500/20 px-2.5 py-1 rounded-full shrink-0 tabular-nums">
                        Долг {fmt(getStudentDebt(s))} ₽
                      </div>
                    </div>
                    <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                      {getUnpaidLessons(s).map((l, i) => {
                        const lessonKey = s.id + "_" + l.date + "_" + l.time
                        const open = confirmId === lessonKey
                        return (
                          <div key={i} className="py-3 first:pt-2 last:pb-0">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-gray-400 shrink-0">
                                  <Icon name="calendar" size={16} />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate whitespace-nowrap">
                                    {new Date(l.date + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" })}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">{l.time} · {l.duration || 60} мин</div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <div className="text-sm font-semibold tabular-nums">{fmt(l.amountDue)} ₽</div>
                                {!open && (
                                  <button
                                    onClick={() => { setConfirmId(lessonKey); setCustomAmount(String(l.amountDue || "")) }}
                                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-b from-[#34C759] to-[#28A745] shadow-[0_2px_10px_rgba(52,199,89,0.35)] transition hover:brightness-105 active:scale-[0.97]"
                                  >
                                    <Icon name="check" size={14} /> Оплата
                                  </button>
                                )}
                              </div>
                            </div>
                            {open && (
                              <div className="mt-3 flex items-center gap-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-2">
                                <div className="relative flex-1">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    autoFocus
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ""))}
                                    onKeyDown={(e) => e.key === "Enter" && handlePay(s, Number(customAmount))}
                                    placeholder="Сумма"
                                    className="input-glass pr-8 w-full"
                                  />
                                  <span className="absolute right-3 top-1.5 text-sm text-gray-400">₽</span>
                                </div>
                                <button onClick={() => handlePay(s, Number(customAmount))}
                                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition active:scale-95">
                                  Внести
                                </button>
                                <button onClick={() => setConfirmId(null)}
                                  className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition">
                                  <Icon name="x" size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {paid.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <h2 className="text-base font-medium">Оплатили</h2>
                <span className="text-xs font-medium text-green-700 dark:text-green-300 bg-green-500/12 ring-1 ring-inset ring-green-500/25 px-2 py-0.5 rounded-full">{paid.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {paid.map((s) => (
                  <div key={s.id} className="group flex items-center justify-between glass rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-green-500/15 text-green-700 dark:text-green-300">
                        <Icon name="check" size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{s.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5 tabular-nums">
                          {s.lessonPrice ? fmt(s.lessonPrice) + " ₽ / занятие" : "Рассчитан"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-500/12 ring-1 ring-inset ring-green-500/25 px-2.5 py-1 rounded-full">
                        <Icon name="check" size={12} /> Оплачено
                      </span>
                      <button
                        onClick={() => setUndoStudent(s)}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-500/10 transition active:scale-90 md:opacity-0 md:group-hover:opacity-100"
                        title="Откатить последнюю оплату"
                      ><Icon name="x" size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {noLessons.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-white/25" />
                <h2 className="text-base font-medium text-gray-500">Занятий ещё не было</h2>
              </div>
              <div className="flex flex-col gap-2">
                {noLessons.map((s) => (
                  <div key={s.id} className="flex items-center justify-between glass rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-black/[0.05] dark:bg-white/[0.08] text-gray-400">
                        {getInitials(s.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{s.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5 tabular-nums">
                          {s.lessonPrice ? fmt(s.lessonPrice) + " ₽ / занятие" : "Стоимость не указана"}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-black/[0.04] dark:bg-white/[0.08] ring-1 ring-inset ring-black/[0.05] dark:ring-white/[0.1] px-2.5 py-1 rounded-full shrink-0">
                      <Icon name="clock" size={12} /> Ожидает
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ежемесячные расходы — замыкающая (растягивающаяся) карточка левой колонки */}
          <div className="glass p-5 flex flex-col flex-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium">Ежемесячные расходы</h2>
            <span className="text-sm font-semibold text-gray-500 tabular-nums">−{fmt(expenseTotal)} ₽/мес</span>
          </div>

          {expenses.length > 0 && (
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08] mb-3">
              {expenses.map((e) => (
                <div key={e.id} className="group flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-gray-400 shrink-0">
                      <Icon name="repeat" size={14} />
                    </div>
                    <div className="text-sm font-medium truncate">{e.name}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-sm font-semibold tabular-nums text-gray-600 dark:text-gray-300">{fmt(e.amount)} ₽</div>
                    <button onClick={() => removeExpense(e.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-500/10 transition active:scale-90 md:opacity-0 md:group-hover:opacity-100"
                      title="Удалить расход">
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {expenses.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {EXPENSE_SUGGESTIONS.map((name) => (
                <button key={name} onClick={() => setNewExpName(name)}
                  className="text-xs font-medium text-gray-500 bg-black/[0.04] dark:bg-white/[0.08] ring-1 ring-inset ring-black/[0.05] dark:ring-white/[0.1] px-2.5 py-1.5 rounded-full hover:bg-black/[0.07] dark:hover:bg-white/[0.12] transition active:scale-95">
                  + {name}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-auto">
            <input
              type="text"
              value={newExpName}
              onChange={(e) => setNewExpName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addExpense(newExpName, Number(newExpAmount))}
              placeholder="Название"
              className="input-glass flex-1 min-w-0"
            />
            <div className="relative w-28 shrink-0">
              <input
                type="text"
                inputMode="numeric"
                value={newExpAmount}
                onChange={(e) => setNewExpAmount(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && addExpense(newExpName, Number(newExpAmount))}
                placeholder="Сумма"
                className="input-glass pr-7 w-full"
              />
              <span className="absolute right-3 top-1.5 text-sm text-gray-400">₽</span>
            </div>
            <button
              onClick={() => addExpense(newExpName, Number(newExpAmount))}
              disabled={!newExpName.trim() || !newExpAmount}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-600 text-white shrink-0 hover:bg-blue-700 transition active:scale-95 disabled:opacity-40 disabled:active:scale-100"
              title="Добавить расход">
              <Icon name="plus" size={18} />
            </button>
          </div>
        </div>

        </div>{/* /ЛЕВАЯ КОЛОНКА */}

        {/* ПРАВАЯ КОЛОНКА: налог/прибыль + история оплат */}
        <div className="flex flex-col gap-4 min-h-0">

        {/* Налог и чистая прибыль */}
        <div className="glass p-5 flex flex-col">
          <h2 className="text-base font-medium mb-4">Налог и прибыль</h2>

          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] mb-4">
            {Object.entries(TAX_MODES).map(([key, m]) => (
              <button key={key}
                onClick={() => saveTaxSettings(key, key === "npd" ? (taxMode === "npd" ? taxRate : 4) : m.rate)}
                className={`text-xs font-medium py-2 rounded-lg transition active:scale-[0.97] ${
                  taxMode === key
                    ? "bg-white dark:bg-white/15 shadow-sm text-gray-900 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          {taxMode === "npd" && (
            <div className="flex items-center gap-2 mb-4 -mt-1">
              <span className="text-xs text-gray-400">Ставка НПД:</span>
              {[4, 6].map((r) => (
                <button key={r} onClick={() => saveTaxSettings("npd", r)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full transition active:scale-95 ${
                    taxRate === r
                      ? "bg-blue-500/12 text-blue-600 dark:text-blue-300 ring-1 ring-inset ring-blue-500/25"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  }`}>
                  {r}% {r === 4 ? "с физлиц" : "с юрлиц"}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 text-sm mt-auto">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Доход за месяц</span>
              <span className="font-medium tabular-nums text-green-600">+{fmt(monthTotal)} ₽</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Расходы</span>
              <span className="font-medium tabular-nums text-gray-500">−{fmt(expenseTotal)} ₽</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Налог {effRate > 0 ? `(${effRate}%)` : ""}</span>
              <span className="font-medium tabular-nums text-amber-600">−{fmt(taxAmount)} ₽</span>
            </div>
            <div className="flex justify-between items-center pt-3 mt-1 border-t border-black/[0.07] dark:border-white/[0.1]">
              <span className="font-medium">Чистыми</span>
              <span className={`text-lg font-semibold tabular-nums ${netProfit >= 0 ? "text-gray-900 dark:text-white" : "text-red-500"}`}>
                {fmt(netProfit)} ₽
              </span>
            </div>
          </div>
        </div>

      {/* История оплат — замыкающая (растягивающаяся) карточка правой колонки */}
      <div className="glass p-5 flex flex-col flex-1">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-medium">История оплат</h2>
          <div className="flex gap-1">
            {[{ id: "all", label: "Все" }, { id: "month", label: "Месяц" }, { id: "week", label: "Неделя" }].map((p) => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={p.id === period ? "px-3 py-1 rounded-lg text-xs border bg-blue-600 text-white border-blue-600 transition active:scale-95" : "px-3 py-1 rounded-lg text-xs border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition active:scale-95"}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {filteredPayments.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400 text-center py-8">Оплат за этот период нет</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5 max-h-80 overflow-y-auto content-start">
            {filteredPayments.map((p, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 bg-green-500/12 text-green-700 dark:text-green-300">
                    {getInitials(p.studentName)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.studentName}</div>
                    <div className="text-xs text-gray-400">{p.date}{p.note ? " · " + p.note : ""}</div>
                  </div>
                </div>
                <div className="text-sm font-medium text-green-600 tabular-nums shrink-0">+{fmt(p.amount)} ₽</div>
              </div>
            ))}
          </div>
        )}
        {filteredPayments.length > 0 && (
          <div className="pt-3 mt-auto border-t border-gray-200 dark:border-white/10 flex justify-between">
            <span className="text-sm text-gray-500">Итого за период</span>
            <span className="text-sm font-semibold text-green-600 tabular-nums">{fmt(filteredPayments.reduce((s, p) => s + p.amount, 0))} ₽</span>
          </div>
        )}
      </div>{/* /История */}

        </div>{/* /ПРАВАЯ КОЛОНКА */}
      </div>{/* /grid */}

      <ConfirmModal
        open={!!undoStudent}
        danger
        icon="repeat"
        title="Отменить оплату?"
        message={undoStudent ? `Последняя оплата ученика ${undoStudent.name} будет удалена из истории. Это действие можно повторить вручную.` : ""}
        confirmLabel="Отменить оплату"
        cancelLabel="Оставить"
        onConfirm={() => { handleUndo(undoStudent); setUndoStudent(null) }}
        onCancel={() => setUndoStudent(null)}
      />
    </div>
  )
}

export default Payment
