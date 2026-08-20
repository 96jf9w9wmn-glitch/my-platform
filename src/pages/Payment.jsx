import { useState, useEffect } from "react"
import Icon from "../components/Icon"
import { PlanLock } from "../components/PlanLock"
import { usePlan } from "../subscription"
import ConfirmModal from "../components/ConfirmModal"
import Collapse from "../components/Collapse"
import { supabase } from "../supabase"
import { isLessonConducted, getInitials, parsePaymentDate, plural } from "../utils"

const TAX_MODES = {
  none: { label: "Без налога", rate: 0 },
  npd: { label: "Самозанятый", rate: 4 },
  usn6: { label: "ИП · УСН 6%", rate: 6 },
}
// Подсказки для быстрого добавления при пустом списке расходов.
const EXPENSE_SUGGESTIONS = ["Онлайн-доска", "Подписка Precettore", "Реклама", "Связь"]

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

// Доход по месяцам в стиле аналитики Т-Банка: крупная сумма выбранного месяца
// сверху, под ней ряд высоких скруглённых столбцов. Тап по столбцу выбирает
// месяц — сумма и подпись обновляются. Читается за счёт большого числа и
// высоких столбцов, а не мелких подписей на каждом.
function IncomeChart({ buckets, forecast, mounted }) {
  const lastIdx = buckets.length - 1
  const [sel, setSel] = useState(lastIdx)
  const projectedLast = buckets[lastIdx].total + forecast
  const maxVal = Math.max(...buckets.map((b) => b.total), projectedLast, 1)
  // Высота зоны столбцов. На телефоне ниже: там график и так занимает
  // весь первый экран, а при коротких столбцах над ними висела пустота.
  const [area, setArea] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? 92 : 132)
  useEffect(() => {
    const onResize = () => setArea(window.innerWidth < 640 ? 92 : 132)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  const AREA = area

  const cur = buckets[sel]
  const isCurrentMonth = sel === lastIdx
  const received = cur.total
  const prevTotal = sel > 0 ? buckets[sel - 1].total : 0
  const deltaPct = prevTotal > 0 ? Math.round((received - prevTotal) / prevTotal * 100) : null

  const dt = new Date(cur.year, cur.month, 1)
  const rawFull = dt.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
  const fullLabel = rawFull.charAt(0).toUpperCase() + rawFull.slice(1)

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div className="text-sm text-gray-500">{fullLabel}</div>
        {deltaPct !== null && (
          <div className={`flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${
            deltaPct >= 0
              ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
          }`}>
            <Icon name={deltaPct >= 0 ? "trending-up" : "trending-down"} size={13} />
            {deltaPct >= 0 ? "+" : ""}{deltaPct}%
          </div>
        )}
      </div>
      <div className="text-4xl md:text-5xl font-semibold leading-none bg-gradient-to-r from-[#007AFF] to-[#5856D6] bg-clip-text text-transparent">
        {fmt(received)} ₽
      </div>
      <div className="text-xs text-gray-400 mt-1.5 h-4">
        {isCurrentMonth && forecast > 0
          ? <>прогноз <span className="text-blue-500 font-medium">+{fmt(forecast)} ₽</span> → {fmt(received + forecast)} ₽</>
          : isCurrentMonth ? "получено в этом месяце" : "получено за месяц"}
      </div>

      {/* Столбцы по месяцам — тап переключает выбранный месяц */}
      <div className="mt-5 flex items-end justify-between gap-1.5">
        {buckets.map((b, i) => {
          const isCur = i === lastIdx
          const isSel = i === sel
          const fc = isCur ? forecast : 0
          const solidPx = b.total > 0 ? Math.max((b.total / maxVal) * AREA, 10) : 0
          const fcPx = (fc / maxVal) * AREA
          const delay = i * 70
          return (
            <button key={i} type="button" onClick={() => setSel(i)}
              className="flex-1 flex flex-col items-center gap-2 focus:outline-none active:scale-[0.96] transition-transform">
              <div className="w-full flex flex-col justify-end items-center" style={{ height: AREA }}>
                {solidPx + fcPx === 0 ? (
                  <div className="w-full max-w-[44px] h-2 rounded-full bg-black/[0.08] dark:bg-white/[0.12]" />
                ) : (
                  <div className="w-full max-w-[44px] flex flex-col justify-end rounded-lg overflow-hidden"
                    style={{ height: mounted ? solidPx + fcPx : 0, transition: `height .7s cubic-bezier(.22,1,.36,1) ${delay}ms` }}>
                    {fcPx > 0 && (
                      <div style={{ height: fcPx, background: "repeating-linear-gradient(45deg,rgba(0,122,255,0.55),rgba(0,122,255,0.55) 3px,transparent 3px,transparent 6px)" }} />
                    )}
                    {/* Инлайновый градиент, а не Tailwind-класс: произвольные bg-gradient
                        с hex-стопами в тёмной теме давали прозрачную заливку (столбец
                        сливался с карточкой). Цвет невыбранного задан явно для обеих тем. */}
                    <div style={{
                      height: solidPx,
                      background: isSel
                        ? "linear-gradient(180deg,#5AC8FA,#007AFF)"
                        : "rgba(142,142,147,0.5)",
                    }} />
                  </div>
                )}
              </div>
              <span className={`text-sm ${isSel ? "font-semibold text-gray-800" : "text-gray-400"}`}>
                {b.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
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

  // Пустая цель — аккуратная подсказка, а не сырое поле в узкой карточке.
  if (!goal && !editing) {
    return (
      <button
        onClick={() => { setDraft(""); setEditing(true) }}
        className="stat-card flex items-center gap-3 text-left transition active:scale-[0.98]"
      >
        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-blue-500 bg-blue-500/10 border border-dashed border-blue-500/45">
          <Icon name="target" size={20} />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-gray-500">Цель месяца</div>
          <div className="text-sm font-medium text-blue-600 dark:text-blue-300">Поставить цель</div>
        </div>
      </button>
    )
  }

  if (editing) {
    return (
      <div className="stat-card flex flex-col justify-center">
        <div className="text-sm text-gray-500 mb-2">Цель месяца</div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              type="text" inputMode="numeric" autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false) }}
              placeholder="60 000"
              className="input-glass pr-7 w-full"
            />
            <span className="absolute right-3 top-1.5 text-sm text-gray-400">₽</span>
          </div>
          <button onClick={save}
            className="bg-blue-600 text-white w-9 h-9 flex items-center justify-center rounded-lg shrink-0 hover:bg-blue-700 transition active:scale-95">
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
          <span className="font-semibold tracking-tight tabular-nums"
            style={{ fontSize: pct >= 1 ? 13 : 15 }}>{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-sm text-gray-500 mb-0.5 flex items-center gap-1">
          Цель месяца
          <Icon name="edit" size={11} className="opacity-0 group-hover:opacity-40 transition-opacity" />
        </div>
        <div className="text-base font-medium">{fmt(goal)} ₽</div>
        {/* Одной строкой и без иконки: колонка узкая, и «цель достигнута» с
            конфетти переносилась, а иконка уезжала под текст в угол карточки. */}
        <div className="text-xs mt-0.5 truncate">
          {remaining > 0
            ? <span className="text-gray-400">осталось {fmt(remaining)} ₽</span>
            : <span className="text-green-600 dark:text-green-400 font-medium">Цель достигнута</span>}
        </div>
      </div>
    </button>
  )
}

function Payment({ students, setStudents, tutorId }) {
  const [tab, setTab] = useState("debts")
  const [filter, setFilter] = useState("debt")
  const [expandedId, setExpandedId] = useState(null)
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
  const forecast = getMonthForecast(students)
  const projected = monthTotal + forecast

  const debtors = students.filter((s) => getStudentDebt(s) > 0)
  const totalDebt = debtors.reduce((sum, s) => sum + getStudentDebt(s), 0)
  const paid = students.filter((s) => hasConductedLessons(s) && getStudentDebt(s) <= 0)
  const noLessons = students.filter((s) => !hasConductedLessons(s))

  // Расходы / налог / чистая прибыль за текущий месяц.
  // НПД и УСН «Доходы» считают налог от дохода (расходы базу не уменьшают).
  const expenseTotal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const effRate = taxMode === "usn6" ? 6 : taxMode === "npd" ? taxRate : 0
  const taxAmount = Math.round(monthTotal * effRate / 100)
  const netProfit = monthTotal - expenseTotal - taxAmount

  // Вкладки, а не одна простыня: у зарубежных сервисов (TutorBird, Teachworks,
  // TutorCruncher) деньги разложены по жанрам — рабочий список должников,
  // история платежей и отчётность живут на разных экранах. Пока всё лежало на
  // одной странице, найти «кто должен» было невозможно.
  const TABS = [
    { id: "debts", label: "Долги", badge: debtors.length },
    { id: "payments", label: "Платежи", badge: 0 },
    { id: "report", label: "Отчёт", badge: 0 },
  ]

  // Статусы работают фильтрами списка, а не декоративными плитками: так же
  // устроены Overdue / Outstanding / Paid у FreshBooks — по счётчику кликают.
  const FILTERS = [
    { id: "debt", label: "Должны", count: debtors.length, sum: totalDebt, tone: "amber" },
    { id: "paid", label: "Рассчитались", count: paid.length, tone: "green" },
    { id: "none", label: "Без занятий", count: noLessons.length, tone: "gray" },
  ]
  const shownList = filter === "debt" ? debtors : filter === "paid" ? paid : noLessons

  const chipTone = {
    amber: "bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/25",
    green: "bg-green-500/12 text-green-700 dark:text-green-300 ring-green-500/25",
    gray: "bg-black/[0.05] dark:bg-white/[0.08] text-gray-500 ring-black/[0.05] dark:ring-white/[0.1]",
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-medium mb-4 sm:mb-6">Финансы</h1>

      {/* HERO — доход по месяцам. Цель месяца стоит здесь, а не отдельной
          плиткой: справа от столбцов всё равно пустовало. */}
      <div className="glass p-4 sm:p-5 md:p-6 mb-4 overflow-hidden relative">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_248px] gap-5 items-center">
          <IncomeChart buckets={buckets} forecast={forecast} mounted={mounted} />
          <GoalRing value={monthTotal} projected={projected} goal={goal} onSetGoal={saveGoal} />
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-1 p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] mb-4 w-full sm:w-auto sm:inline-flex">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2 rounded-xl text-sm font-medium transition active:scale-[0.97] ${
              tab === t.id
                ? "bg-white dark:bg-white/15 shadow-sm text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 tabular-nums">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ДОЛГИ: рабочий список. Одна строка на ученика, одно действие ── */}
      {tab === "debts" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium ring-1 ring-inset transition active:scale-[0.96] ${
                  filter === f.id
                    ? chipTone[f.tone]
                    : "bg-white/50 dark:bg-white/[0.04] text-gray-500 ring-black/[0.06] dark:ring-white/[0.08] hover:bg-white/80"
                }`}
              >
                {f.label}
                <span className="tabular-nums opacity-70">{f.count}</span>
                {f.sum > 0 && filter === f.id && (
                  <span className="tabular-nums font-semibold">· {fmt(f.sum)} ₽</span>
                )}
              </button>
            ))}
          </div>

          {shownList.length === 0 ? (
            <div className="glass p-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 bg-green-500/12 text-green-600 dark:text-green-300">
                <Icon name="check" size={18} />
              </div>
              <div>
                <div className="text-sm font-medium">
                  {filter === "debt" ? "Никто не должен" : "Здесь пусто"}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {filter === "debt" ? "Все проведённые занятия оплачены" : "Выберите другой фильтр"}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass overflow-hidden">
              {shownList.map((s) => {
                const debt = getStudentDebt(s)
                const unpaid = filter === "debt" ? getUnpaidLessons(s) : []
                const open = expandedId === s.id
                const paying = confirmId === s.id
                return (
                  <div key={s.id} className="border-t border-black/[0.06] dark:border-white/[0.08] first:border-t-0">
                    <div className="flex items-center gap-3 px-4 py-3 flex-wrap sm:flex-nowrap">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                        filter === "debt"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : filter === "paid"
                            ? "bg-green-500/15 text-green-700 dark:text-green-300"
                            : "bg-black/[0.05] dark:bg-white/[0.08] text-gray-400"
                      }`}>
                        {getInitials(s.name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{s.name}</div>
                        {filter === "debt" ? (
                          <button
                            onClick={() => setExpandedId(open ? null : s.id)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
                          >
                            <span className="whitespace-nowrap">
                              {unpaid.length} {plural(unpaid.length, "занятие", "занятия", "занятий")} не оплачено
                            </span>
                            <Icon name={open ? "chevron-up" : "chevron-down"} size={13} className="shrink-0" />
                          </button>
                        ) : (
                          <div className="text-xs text-gray-400 tabular-nums">
                            {s.lessonPrice ? fmt(s.lessonPrice) + " ₽ / занятие" : "Стоимость не указана"}
                          </div>
                        )}
                      </div>

                      {filter === "debt" && (
                        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
                          <div className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-300">
                            {fmt(debt)} ₽
                          </div>
                          {!paying && (
                            <button
                              onClick={() => { setConfirmId(s.id); setCustomAmount(String(Math.round(debt) || "")) }}
                              className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-b from-[#34C759] to-[#28A745] shadow-[0_2px_10px_rgba(52,199,89,0.35)] transition hover:brightness-105 active:scale-[0.97]"
                            >
                              <Icon name="check" size={14} /> Оплата
                            </button>
                          )}
                        </div>
                      )}

                      {filter === "paid" && (
                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-500/12 ring-1 ring-inset ring-green-500/25 px-2.5 py-1 rounded-full">
                            <Icon name="check" size={12} /> Оплачено
                          </span>
                          <button
                            onClick={() => setUndoStudent(s)}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-500/10 transition active:scale-90"
                            title="Откатить последнюю оплату"
                          ><Icon name="x" size={15} /></button>
                        </div>
                      )}

                      {filter === "none" && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-black/[0.04] dark:bg-white/[0.08] ring-1 ring-inset ring-black/[0.05] dark:ring-white/[0.1] px-2.5 py-1 rounded-full">
                          <Icon name="clock" size={12} /> Ожидает
                        </span>
                      )}
                    </div>

                    {/* Ввод суммы: предзаполнен всем долгом — обычный случай,
                        когда платят целиком, закрывается одним нажатием. */}
                    {paying && (
                      <div className="flex items-center gap-2 px-4 pb-3">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            autoFocus
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ""))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handlePay(s, Number(customAmount))
                              if (e.key === "Escape") setConfirmId(null)
                            }}
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

                    {/* За что именно долг — по запросу, а не всегда на экране */}
                    <Collapse open={open && filter === "debt"}>
                      <div className="px-4 pb-3 pl-16 divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                        {unpaid.map((l, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 py-2">
                            <div className="text-sm">
                              {new Date(l.date + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" })}
                              <span className="text-xs text-gray-400"> · {l.time}</span>
                            </div>
                            <div className="text-sm tabular-nums text-gray-500">{fmt(l.amountDue)} ₽</div>
                          </div>
                        ))}
                      </div>
                    </Collapse>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ПЛАТЕЖИ: что уже пришло ── */}
      {tab === "payments" && (
        <div className="glass p-5 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-baseline gap-2.5 min-w-0">
              <h2 className="text-base font-medium">История оплат</h2>
              <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">{fmt(allTotal)} ₽ за всё время</span>
            </div>
            <div className="flex gap-1">
              {[{ id: "all", label: "Все" }, { id: "month", label: "Месяц" }, { id: "week", label: "Неделя" }].map((p) => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  className={p.id === period ? "px-3 py-1 rounded-lg text-xs border bg-blue-600 text-white border-blue-600 transition active:scale-95" : "px-3 py-1 rounded-lg text-xs border border-gray-200 dark:border-white/10 text-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 transition active:scale-95"}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {filteredPayments.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 text-center py-8">Оплат за этот период нет</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5 content-start">
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
            <div className="pt-3 mt-4 border-t border-gray-200 dark:border-white/10 flex justify-between">
              <span className="text-sm text-gray-500">Итого за период</span>
              <span className="text-sm font-semibold text-green-600 tabular-nums">{fmt(filteredPayments.reduce((s, p) => s + p.amount, 0))} ₽</span>
            </div>
          )}
        </div>
      )}

      {/* ── ОТЧЁТ: расходы, налог, что осталось ── */}
      {tab === "report" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="glass p-5 flex flex-col">
            <h2 className="text-base font-medium mb-4">Налог и прибыль</h2>

            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] mb-4">
              {Object.entries(TAX_MODES).map(([key, m]) => (
                <button key={key}
                  onClick={() => saveTaxSettings(key, key === "npd" ? (taxMode === "npd" ? taxRate : 4) : m.rate)}
                  className={`text-xs font-medium py-2 rounded-lg transition active:scale-[0.97] ${
                    taxMode === key
                      ? "bg-white dark:bg-white/15 shadow-sm text-gray-900 dark:text-white"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>

            {taxMode === "npd" && (
              <div className="flex items-center gap-2 mb-4 -mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">Ставка НПД:</span>
                {[4, 6].map((r) => (
                  <button key={r} onClick={() => saveTaxSettings("npd", r)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full transition active:scale-95 ${
                      taxRate === r
                        ? "bg-blue-500/12 text-blue-600 dark:text-blue-300 ring-1 ring-inset ring-blue-500/25"
                        : "text-gray-400 hover:text-gray-600"
                    }`}>
                    {r}% {r === 4 ? "с физлиц" : "с юрлиц"}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Доход за месяц</span>
                <span className="font-medium tabular-nums text-green-600 dark:text-green-400">+{fmt(monthTotal)} ₽</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Расходы</span>
                <span className="font-medium tabular-nums text-gray-500 dark:text-gray-400">−{fmt(expenseTotal)} ₽</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Налог {effRate > 0 ? `(${effRate}%)` : ""}</span>
                <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">−{fmt(taxAmount)} ₽</span>
              </div>
              <div className="flex justify-between items-center pt-3 mt-1 border-t border-black/[0.07] dark:border-white/[0.1]">
                <span className="font-medium">Чистыми</span>
                <span className={`text-lg font-semibold tabular-nums ${netProfit >= 0 ? "text-gray-900 dark:text-white" : "text-red-500"}`}>
                  {fmt(netProfit)} ₽
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 mt-1 border-t border-black/[0.07] dark:border-white/[0.1]">
                <span className="text-gray-500 dark:text-gray-400">Получено за всё время</span>
                <span className="font-medium tabular-nums">{fmt(allTotal)} ₽</span>
              </div>
            </div>
          </div>

          <div className="glass p-5 flex flex-col">
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
                      <div className="text-sm font-semibold tabular-nums text-gray-600">{fmt(e.amount)} ₽</div>
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

            {EXPENSE_SUGGESTIONS.some((name) => !expenses.some((e) => e.name === name)) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {EXPENSE_SUGGESTIONS.filter((name) => !expenses.some((e) => e.name === name)).map((name) => (
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
        </div>
      )}

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

// Раздел под тарифом. Гейт стоит ОБЁРТКОЙ, а не условным return внутри
// Payment: иначе часть хуков компонента перестала бы вызываться.
function PaymentGate(props) {
  const { allows } = usePlan()
  if (allows("finance")) return <Payment {...props} />
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-medium mb-1">Оплата</h1>
      <p className="text-sm text-gray-500 mb-5">Оплаты, долги и доход по занятиям.</p>
      <PlanLock feature="finance" title="Финансы" text="Учёт оплат и долгов по каждому ученику, расходы, налог и чистая прибыль." />
    </div>
  )
}

export default PaymentGate
