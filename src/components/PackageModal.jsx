import { useState } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import SegmentSwitch from "./SegmentSwitch"
import { plural } from "../utils"
import { PERIODS, periodEnd, lessonsInRange, todayIso, fromIsoDate, toIso, dayMonth } from "../billing"

// Выдача абонемента — оплаты вперёд за неделю, две недели или месяц.
//
// Ведёт период, а не количество: договариваются «плачу за месяц», а сколько там
// занятий — считает расписание. Поэтому число занятий и сумма подставляются
// сами, но остаются полями: у кого-то скидка за абонемент, у кого-то занятия
// ещё не расставлены, и упереться в подсчёт было бы обиднее, чем поправить
// цифру руками.
function PackageModal({ student, previous, onSubmit, onClose }) {
  const { cls: closingCls, close } = useClosing(onClose)
  const price = Number(student?.lessonPrice || 0)

  // Продление начинается со следующего дня после конца прошлого абонемента —
  // иначе периоды наложатся, и одно занятие попыталось бы списаться дважды.
  const suggestedStart = (() => {
    if (!previous?.until) return todayIso()
    const next = fromIsoDate(previous.until)
    if (!next) return todayIso()
    next.setDate(next.getDate() + 1)
    const iso = toIso(next)
    return iso > todayIso() ? iso : todayIso()
  })()

  const [period, setPeriod] = useState(previous?.period || "week")
  const [from, setFrom] = useState(suggestedStart)
  const [burn, setBurn] = useState(!!previous?.burn)
  // Занятия и сумму держим отдельно от подсказки: как только их правят руками,
  // подсказка перестаёт их перебивать (иначе смена периода стирала бы скидку).
  const [countEdit, setCountEdit] = useState(null)
  const [amountEdit, setAmountEdit] = useState(null)
  const [error, setError] = useState("")

  const until = periodEnd(from, period)
  const planned = lessonsInRange(student, from, until)
  const count = countEdit === null ? planned.length : Number(countEdit) || 0
  const amount = amountEdit === null ? count * price : Number(amountEdit) || 0

  function submit() {
    if (count <= 0) {
      setError("Укажите, сколько занятий покрывает абонемент.")
      return
    }
    if (amount <= 0) {
      setError("Укажите сумму оплаты.")
      return
    }
    onSubmit({ from, until, period, lessons: count, amount, burn })
    close()
  }

  return createPortal(
    <div className={`fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 ${closingCls}`} onClick={close}>
      <div
        className={`glass-modal w-full max-w-sm flex flex-col ${closingCls}`}
        style={{ maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100/60 flex-shrink-0">
          <h2 className="text-lg font-medium">{previous ? "Продлить абонемент" : "Абонемент"}</h2>
          <button onClick={close} aria-label="Закрыть" className="text-gray-400 hover:text-gray-600 transition-transform active:scale-90">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 flex flex-col gap-4">
          <div className="glass-sm px-3 py-2.5 flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-blue-500/12 text-blue-500 flex items-center justify-center flex-shrink-0">
              <Icon name="ruble" size={15} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{student?.name}</div>
              <div className="text-xs text-gray-500">
                {price ? `${price.toLocaleString("ru-RU")} ₽ за занятие` : "Стоимость занятия не указана"}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-2 block">Оплата вперёд за</label>
            <SegmentSwitch
              block
              ariaLabel="Период абонемента"
              value={period}
              onChange={(k) => { setPeriod(k); setCountEdit(null); setAmountEdit(null) }}
              items={PERIODS.map((p) => ({ key: p.key, label: p.label }))}
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1.5 block">Начало</label>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setCountEdit(null); setAmountEdit(null) }}
              className="input-glass"
            />
            {until && (
              <div className="text-xs text-gray-500 mt-1.5">
                Действует по {dayMonth(until)} включительно
              </div>
            )}
          </div>

          {/* Что посчитало расписание — до полей, чтобы правка была осознанной,
              а не вслепую. */}
          <div className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ring-1 ${
            planned.length ? "ring-blue-500/25 bg-blue-500/[0.06] text-gray-600 dark:text-gray-300"
                           : "ring-amber-500/30 bg-amber-500/[0.07] text-amber-700 dark:text-amber-300"
          }`}>
            {planned.length
              ? <>В расписании на этот период — <b>{planned.length} {plural(planned.length, "занятие", "занятия", "занятий")}</b>{price ? <> на {(planned.length * price).toLocaleString("ru-RU")} ₽</> : null}.</>
              : <>В этот период занятий пока нет. Поставьте их в расписание или укажите количество вручную.</>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-500 mb-1.5 block">Занятий</label>
              <input
                type="text"
                inputMode="numeric"
                value={count || ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "")
                  setCountEdit(raw)
                  setAmountEdit(null)   // сумма пересчитается от нового количества
                }}
                className="input-glass"
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1.5 block">Сумма, ₽</label>
              <input
                type="text"
                inputMode="numeric"
                value={amount ? amount.toLocaleString("ru-RU").replace(/\s/g, " ") : ""}
                onChange={(e) => setAmountEdit(e.target.value.replace(/\D/g, ""))}
                className="input-glass"
              />
            </div>
          </div>

          {/* Сгорание — не наше решение: одни репетиторы оставляют деньги себе,
              другие переносят занятие. По умолчанию выключено: оплаченное
              занятие переживает перенос за край периода. */}
          <button
            onClick={() => setBurn((v) => !v)}
            className="press-fill flex items-start gap-3 text-left rounded-xl px-3 py-2.5 ring-1 ring-gray-200/70 dark:ring-white/10"
          >
            <span className={`mt-0.5 w-9 h-5 rounded-full flex-shrink-0 relative transition-colors ${
              burn ? "bg-blue-600" : "bg-blue-500/12"
            }`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                burn ? "left-[1.15rem]" : "left-0.5"
              }`} />
            </span>
            <span className="min-w-0">
              <span className="text-sm font-medium block">Неиспользованные занятия сгорают</span>
              <span className="text-xs text-gray-500 block mt-0.5 leading-relaxed">
                {burn
                  ? "В конце срока непроведённые занятия пропадают, деньги остаются у вас."
                  : "Непроведённые занятия переходят на следующий период — перенос их не съедает."}
              </span>
            </span>
          </button>

          {/* Выставление — не оплата: деньги отмечаются отдельно, когда придут.
              Без этой строки кнопка читалась бы как «записать поступление». */}
          <p className="text-xs text-gray-400 leading-relaxed">
            Это ещё не оплата: абонемент появится со статусом «ждёт оплаты», а
            деньги вы отметите, когда они придут.
          </p>

          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100/60 flex-shrink-0">
          <button onClick={close} className="flex-1 rounded-xl py-2.5 text-sm text-gray-600 ring-1 ring-inset ring-gray-200/80 dark:ring-white/15 hover:bg-blue-500/[0.08] transition active:scale-[0.97]">
            Отмена
          </button>
          <button onClick={submit} className="flex-1 btn-primary py-2.5">
            {previous ? "Продлить" : "Выставить"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PackageModal
