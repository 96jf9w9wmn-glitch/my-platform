import { useState, useEffect } from "react"
import Icon from "../components/Icon"
import { PlanLock } from "../components/PlanLock"
import { usePlan } from "../subscription"
import ConfirmModal from "../components/ConfirmModal"
import Reveal from "../components/Reveal"
import Collapse from "../components/Collapse"
import SegmentSwitch from "../components/SegmentSwitch"
import { supabase } from "../supabase"
import { isLessonConducted, getInitials, parsePaymentDate, plural } from "../utils"
import { TAX_MODES, useTaxSettings } from "../taxModes"

// Подсказки для быстрого добавления при пустом списке расходов.
const EXPENSE_SUGGESTIONS = ["Онлайн-доска", "Подписка Precettore", "Реклама", "Связь"]

// Периоды истории оплат — списком, чтобы сегмент-контрол не пересоздавал items
// на каждый рендер (иначе замер «пальца» дёргается).
const PERIODS = [{ key: "all", label: "Все" }, { key: "month", label: "Месяц" }, { key: "week", label: "Неделя" }]

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
  // Смена месяца — не подмена цифр на месте: блок с суммой переезжает с той
  // стороны, куда переключили столбец. Направление запоминаем вместе с
  // выбором, а key={sel} пересоздаёт блок, чтобы анимация шла заново.
  const [dir, setDir] = useState(1)
  const pickMonth = (i) => { setDir(i >= sel ? 1 : -1); setSel(i) }
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
  const swapClass = dir > 0 ? "money-swap-next" : "money-swap-prev"
  const prevTotal = sel > 0 ? buckets[sel - 1].total : 0
  const deltaPct = prevTotal > 0 ? Math.round((received - prevTotal) / prevTotal * 100) : null

  const dt = new Date(cur.year, cur.month, 1)
  const rawFull = dt.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
  const fullLabel = rawFull.charAt(0).toUpperCase() + rawFull.slice(1)

  return (
    // Сумма слева, столбцы справа: после того как из шапки убрали цель месяца,
    // карточка растянулась во всю ширину и под суммой оставалась пустота в
    // половину экрана. На телефоне колонки схлопываются в одну.
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-8 lg:items-center">
      <div key={sel} className={swapClass}>
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

      </div>

      {/* Столбцы по месяцам — тап переключает выбранный месяц */}
      <div className="mt-5 lg:mt-0 flex items-end justify-between gap-1.5">
        {buckets.map((b, i) => {
          const isCur = i === lastIdx
          const isSel = i === sel
          const fc = isCur ? forecast : 0
          const solidPx = b.total > 0 ? Math.max((b.total / maxVal) * AREA, 10) : 0
          const fcPx = (fc / maxVal) * AREA
          const delay = i * 70
          return (
            <button key={i} type="button" onClick={() => pickMonth(i)}
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

function Payment({ students, setStudents, tutorId, setActivePage }) {
  const [tab, setTab] = useState("debts")
  const [expandedId, setExpandedId] = useState(null)
  const [period, setPeriod] = useState("all")
  const [confirmId, setConfirmId] = useState(null)
  const [customAmount, setCustomAmount] = useState("")
  const [mounted, setMounted] = useState(false)
  const [undoStudent, setUndoStudent] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [newExpName, setNewExpName] = useState("")
  const [newExpAmount, setNewExpAmount] = useState("")

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Налоговый режим сюда только приходит: выбирают его при регистрации и в
  // «Профиле», здесь он лишь применяется к доходу.
  const { mode: taxMode, effRate } = useTaxSettings(tutorId)

  // Загрузка расходов тьютора (RLS ограничивает своими строками).
  // До прогона миграции таблицы может не быть — ошибку глушим, работаем локально.
  useEffect(() => {
    if (!tutorId) return
    let alive = true
    supabase.from("tutor_expenses").select("id, name, amount").eq("tutor_id", tutorId).order("created_at")
      .then(({ data }) => {
        if (alive && data) setExpenses(data.map((e) => ({ ...e, amount: Number(e.amount) })))
      }, () => { /* таблицы ещё нет — остаётся локально */ })
    return () => { alive = false }
  }, [tutorId])

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

  const allPayments = students
    // isLast — самая свежая оплата ученика: только её можно откатить,
    // потому что handleUndo снимает последнюю запись из его массива.
    .flatMap((s) => (s.payments || []).map((p, i, arr) => ({
      ...p, studentName: s.name, studentId: s.id, isLast: i === arr.length - 1,
    })))
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

  const debtors = students.filter((s) => getStudentDebt(s) > 0)

  // Расходы / налог / чистая прибыль за текущий месяц.
  // НПД и УСН «Доходы» считают налог от дохода (расходы базу не уменьшают).
  const expenseTotal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const taxAmount = Math.round(monthTotal * effRate / 100)
  const netProfit = monthTotal - expenseTotal - taxAmount

  // Вкладки, а не одна простыня: у зарубежных сервисов (TutorBird, Teachworks,
  // TutorCruncher) деньги разложены по жанрам — рабочий список должников,
  // история платежей и отчётность живут на разных экранах. Пока всё лежало на
  // одной странице, найти «кто должен» было невозможно.
  const TABS = [
    { id: "debts", label: "Долги", badge: debtors.length },
    { id: "payments", label: "Платежи", badge: 0 },
    { id: "report", label: "Доход и налог", badge: 0 },
  ]

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl font-medium">Финансы</h1>
        <p className="text-sm text-gray-500 mt-0.5">Кто сколько должен, история оплат и доход за месяц. Настройки квитанций и онлайн-оплаты — в «Профиле».</p>
      </div>

      {/* HERO — доход по месяцам. Цели по доходу здесь нет намеренно: у
          Teachworks, TutorBird и TutorCruncher на финансовом экране только
          числа и таблицы, а кольцо прогресса — паттерн из фитнес-трекеров. */}
      <div className="glass p-4 sm:p-5 md:p-6 mb-4 overflow-hidden relative">
        <IncomeChart buckets={buckets} forecast={forecast} mounted={mounted} />
      </div>

      {/* Вкладки */}
      <SegmentSwitch
        block
        ariaLabel="Раздел финансов"
        value={tab}
        onChange={setTab}
        className="mb-4 w-full sm:w-auto"
        items={TABS.map((t) => ({
          key: t.id,
          label: (
            <>
              {t.label}
              {t.badge > 0 && (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 tabular-nums">
                  {t.badge}
                </span>
              )}
            </>
          ),
        }))}
      />

      {/* ── ДОЛГИ: рабочий список. Одна строка на ученика, одно действие ── */}
      {tab === "debts" && (
        <div className="flex flex-col gap-3">
          {debtors.length === 0 ? (
            <div className="glass p-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 bg-green-500/12 text-green-600 dark:text-green-300">
                <Icon name="check" size={18} />
              </div>
              <div>
                <div className="text-sm font-medium">Никто не должен</div>
                <div className="text-xs text-gray-400 mt-0.5">Все проведённые занятия оплачены</div>
              </div>
            </div>
          ) : (
            <div className="glass overflow-hidden">
              {debtors.map((s) => {
                const debt = getStudentDebt(s)
                const unpaid = getUnpaidLessons(s)
                const open = expandedId === s.id
                const paying = confirmId === s.id
                return (
                  <div key={s.id} className="border-t border-black/[0.06] dark:border-white/[0.08] first:border-t-0">
                    <div className="flex items-center gap-3 px-4 py-3 flex-wrap sm:flex-nowrap">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                        {getInitials(s.name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{s.name}</div>
                        <button
                          onClick={() => setExpandedId(open ? null : s.id)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
                        >
                          <span className="whitespace-nowrap">
                            {unpaid.length} {plural(unpaid.length, "занятие", "занятия", "занятий")} не оплачено
                          </span>
                          <Icon name={open ? "chevron-up" : "chevron-down"} size={13} className="shrink-0" />
                        </button>
                      </div>

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
                    </div>

                    {/* Ввод суммы: предзаполнен всем долгом — обычный случай,
                        когда платят целиком, закрывается одним нажатием. */}
                    <Reveal value={paying}>{() => (
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
                    )}</Reveal>

                    {/* За что именно долг — по запросу, а не всегда на экране */}
                    <Collapse open={open}>
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
            {/* период — сегмент-контролом: «палец» едет к выбранному, вместо того
                чтобы кнопки просто перекрашивались рывком */}
            <SegmentSwitch
              size="sm"
              ariaLabel="Период"
              value={period}
              onChange={setPeriod}
              items={PERIODS}
              className="shrink-0"
            />
          </div>
          {filteredPayments.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 text-center py-8">Оплат за этот период нет</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5 content-start">
              {filteredPayments.map((p, i) => (
                <div key={i} className="group flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 bg-green-500/12 text-green-700 dark:text-green-300">
                      {getInitials(p.studentName)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.studentName}</div>
                      <div className="text-xs text-gray-400">{p.date}{p.note ? " · " + p.note : ""}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-sm font-medium text-green-600 tabular-nums">+{fmt(p.amount)} ₽</div>
                    {/* Ошибочную оплату откатывают здесь: у ученика снимается
                        только последняя запись, поэтому кнопка есть у неё одной. */}
                    {p.isLast && (
                      <button
                        onClick={() => setUndoStudent(students.find((s) => s.id === p.studentId))}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-500/10 transition active:scale-90 md:opacity-0 md:group-hover:opacity-100"
                        title="Отменить эту оплату"
                      ><Icon name="x" size={14} /></button>
                    )}
                  </div>
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

            {/* Режим здесь показывается, а не выбирается: он спрашивается при
                регистрации и меняется в «Профиле» — это настройка аккаунта, а
                не рабочее число месяца. */}
            <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06]">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{TAX_MODES[taxMode]?.label || TAX_MODES.none.label}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {effRate > 0 ? `Налог ${effRate}% с дохода` : TAX_MODES.none.hint}
                </div>
              </div>
              <button
                onClick={() => setActivePage?.("profile")}
                className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full text-[#007AFF] bg-[#007AFF]/10 ring-1 ring-inset ring-[#007AFF]/25 transition-all active:scale-95"
              >
                Изменить
              </button>
            </div>

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
      <h1 className="text-xl font-medium mb-1">Финансы</h1>
      <p className="text-sm text-gray-500 mb-5">Оплаты, долги и доход по занятиям.</p>
      <PlanLock feature="finance" title="Финансы" text="Учёт оплат и долгов по каждому ученику, расходы, налог и чистая прибыль." />
    </div>
  )
}

export default PaymentGate
