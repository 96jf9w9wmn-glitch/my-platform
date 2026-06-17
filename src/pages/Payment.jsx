import { useState } from "react"

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

function parsePaymentDate(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split(".")
  if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0])
  return new Date(dateStr)
}

function Payment({ students, setStudents }) {
  const [selectedStudent, setSelectedStudent] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [note, setNote] = useState("")
  const [period, setPeriod] = useState("all")

  function handleAddPayment() {
    if (!selectedStudent || !amount) {
      alert("Выбери ученика и укажи сумму!")
      return
    }
    setStudents((prev) =>
      prev.map((s) =>
        s.id === Number(selectedStudent)
          ? {
              ...s,
              paid: true,
              balance: (s.balance || 0) + Number(amount),
              payments: [
                ...(s.payments || []),
                {
                  amount: Number(amount),
                  date: new Date(date).toLocaleDateString("ru-RU"),
                  note,
                },
              ],
            }
          : s
      )
    )
    setSelectedStudent("")
    setAmount("")
    setNote("")
  }

  const allPayments = students
    .flatMap((s) =>
      (s.payments || []).map((p) => ({ ...p, studentName: s.name }))
    )
    .sort((a, b) => {
      const da = parsePaymentDate(a.date)
      const db = parsePaymentDate(b.date)
      return db - da
    })

  const weekRange = getWeekRange()
  const monthRange = getMonthRange()

  const weekPayments = allPayments.filter((p) => {
    const d = parsePaymentDate(p.date)
    return d >= weekRange.start && d <= weekRange.end
  })

  const monthPayments = allPayments.filter((p) => {
    const d = parsePaymentDate(p.date)
    return d >= monthRange.start && d <= monthRange.end
  })

  const weekTotal = weekPayments.reduce((sum, p) => sum + p.amount, 0)
  const monthTotal = monthPayments.reduce((sum, p) => sum + p.amount, 0)
  const allTotal = allPayments.reduce((sum, p) => sum + p.amount, 0)

  const filteredPayments = period === "week" ? weekPayments
    : period === "month" ? monthPayments
    : allPayments

  const debtors = students.filter((s) => !s.paid)

  return (
    <div className="p-6">
      <h1 className="text-xl font-medium mb-6">Оплата</h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Всего получено</div>
          <div className="text-2xl font-medium text-green-600">{allTotal.toLocaleString("ru-RU")} ₽</div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <div className="text-sm text-blue-500 mb-1">За эту неделю</div>
          <div className="text-2xl font-medium text-blue-600">{weekTotal.toLocaleString("ru-RU")} ₽</div>
          <div className="text-xs text-blue-400 mt-1">
            {weekRange.start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} —{" "}
            {weekRange.end.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
          <div className="text-sm text-purple-500 mb-1">За этот месяц</div>
          <div className="text-2xl font-medium text-purple-600">{monthTotal.toLocaleString("ru-RU")} ₽</div>
          <div className="text-xs text-purple-400 mt-1">
            {new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
          </div>
        </div>
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Должники</div>
          <div className="text-2xl font-medium text-amber-600">{debtors.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h2 className="text-base font-medium mb-4">Добавить оплату</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Ученик</label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  <option value="">Выбери ученика...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {!s.paid ? "⚠️ долг" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Сумма</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 pr-8"
                  />
                  <span className="absolute right-3 top-2 text-sm text-gray-400">₽</span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Дата оплаты</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Примечание (необязательно)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Например: за июнь"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <button
                onClick={handleAddPayment}
                className="bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 mt-1"
              >
                Записать оплату
              </button>
            </div>
          </div>

          {debtors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h2 className="text-sm font-medium text-amber-700 mb-3">⚠️ Должники</h2>
              <div className="flex flex-col gap-2">
                {debtors.map((s) => (
                  <div key={s.id} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">{s.name}</span>
                    <button
                      onClick={() => setSelectedStudent(String(s.id))}
                      className="text-blue-600 text-xs hover:underline"
                    >
                      Записать оплату
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-medium">История оплат</h2>
            <div className="flex gap-1">
              {[
                { id: "all", label: "Все" },
                { id: "month", label: "Месяц" },
                { id: "week", label: "Неделя" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                    period === p.id
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-8">Оплат за этот период нет</div>
          ) : (
            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
              {filteredPayments.map((p, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium">{p.studentName}</div>
                    <div className="text-xs text-gray-400">
                      {p.date} {p.note && `· ${p.note}`}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-green-600">
                    +{p.amount.toLocaleString("ru-RU")} ₽
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm text-gray-500">Итого за период</span>
                <span className="text-sm font-medium text-green-600">
                  {filteredPayments.reduce((s, p) => s + p.amount, 0).toLocaleString("ru-RU")} ₽
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Payment
