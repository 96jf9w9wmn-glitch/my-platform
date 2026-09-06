import { useState } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import SegmentSwitch from "./SegmentSwitch"
import { plural } from "../utils"
import { fmtNum } from "../num"
import {
  PERIODS, dayMonth, todayIso, packagePeriods, packageSize,
  MODE_LESSON, MODE_PACKAGE,
} from "../billing"

// Способ оплаты ученика. Здесь НАСТРОЙКА, а не деньги: сами оплаты вносятся в
// «Финансах» — и у поштучного ученика, и у абонементного одинаково. Абонемент
// не заводит второй денежный поток, он лишь меняет момент начисления долга.
function PaymentModeModal({ student, onSubmit, onClose }) {
  const { cls: closingCls, close } = useClosing(onClose)
  const price = Number(student?.lessonPrice || 0)

  const [mode, setMode] = useState(student?.paymentMode === MODE_PACKAGE ? MODE_PACKAGE : MODE_LESSON)
  const [period, setPeriod] = useState(student?.packagePeriod || "week")
  const [start, setStart] = useState(student?.packageStart || todayIso())
  // Сумма за период. Пустая строка — «считать по расписанию»: договариваются
  // чаще о круглом числе (скидка за оплату вперёд, «столько в месяц независимо
  // от переносов»), но и расчёт по занятиям никуда не девается.
  const [amount, setAmount] = useState(
    student?.packageAmount > 0 ? String(student.packageAmount) : "")

  // Что будет начислено сразу после включения. Период меряется ЗАНЯТИЯМИ
  // (месяц у ученика с двумя занятиями в неделю — это восемь занятий, а не
  // календарное окно), поэтому первый период здесь считает тот же код, что
  // потом будет считать долг.
  const draft = {
    ...student,
    paymentMode: MODE_PACKAGE, packagePeriod: period, packageStart: start,
  }
  const size = mode === MODE_PACKAGE ? packageSize(draft) : 0
  const preview = mode === MODE_PACKAGE ? packagePeriods(draft)[0] || null : null
  const count = preview ? preview.lessons.length : 0

  // Расчётная сумма — подсказка и значение по умолчанию. Вписанная важнее её.
  const calc = count * price
  const manual = Number(String(amount).replace(",", ".").trim())
  const manualOk = Number.isFinite(manual) && manual > 0
  const due = manualOk ? manual : calc

  function submit() {
    onSubmit(mode === MODE_PACKAGE
      ? {
        paymentMode: MODE_PACKAGE, packagePeriod: period, packageStart: start,
        packageAmount: manualOk ? manual : null,
      }
      : { paymentMode: MODE_LESSON, packagePeriod: null, packageStart: null, packageAmount: null })
  }

  return createPortal(
    <div className={`fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 ${closingCls}`} onClick={close}>
      <div
        className={`glass-modal w-full max-w-sm flex flex-col ${closingCls}`}
        style={{ maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100/60 flex-shrink-0">
          <h2 className="text-lg font-medium">Как платит ученик</h2>
          <button onClick={close} aria-label="Закрыть" className="text-gray-500 hover:text-gray-700 transition-transform active:scale-90">
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
                {price ? `${fmtNum(price)} ₽ за занятие` : "Стоимость занятия не указана"}
              </div>
            </div>
          </div>

          <SegmentSwitch
            block
            ariaLabel="Способ оплаты"
            value={mode}
            onChange={setMode}
            items={[{ key: MODE_LESSON, label: "За занятие" }, { key: MODE_PACKAGE, label: "Абонементом" }]}
          />

          {mode === MODE_LESSON ? (
            <p className="text-xs text-gray-500 leading-relaxed">
              Долг растёт по мере проведения занятий: провели — начислилось.
              Так работает по умолчанию.
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500 leading-relaxed">
                Ученик платит вперёд. Как только период начался, долг за все его
                занятия начисляется сразу — и закрывается одной оплатой в «Финансах».
                Период считается занятиями: месяц у того, кто занимается дважды
                в неделю, — это восемь занятий.
              </p>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">Период</label>
                <SegmentSwitch
                  block
                  ariaLabel="Период абонемента"
                  value={period}
                  onChange={setPeriod}
                  items={PERIODS.map((p) => ({ key: p.key, label: p.label }))}
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-1.5 block">Считать периоды с</label>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input-glass" />
              </div>

              {/* Сумма за период. Считается по расписанию сама, но вписать своё
                  число можно всегда: договариваются о круглой сумме, а расчёт
                  по занятиям её только предлагает. */}
              <div>
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <label htmlFor="package-amount" className="text-sm text-gray-500">Сумма за период</label>
                  {manualOk && (
                    <button
                      type="button"
                      onClick={() => setAmount("")}
                      className="press-tap text-xs text-blue-500 hover:text-blue-700 transition-colors"
                    >
                      Считать по расписанию
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="package-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                    placeholder={calc ? fmtNum(calc) : "Своя сумма"}
                    className="input-glass pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">₽</span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  {manualOk
                    ? <>Начисляем {fmtNum(manual)} ₽ за период{calc ? <> вместо расчётных {fmtNum(calc)} ₽</> : null}.</>
                    : calc
                      ? <>Оставьте пустым — посчитаем по расписанию: {count} × {fmtNum(price)} ₽ = {fmtNum(calc)} ₽.</>
                      : <>Оставьте пустым — посчитаем по расписанию.</>}
                </p>
              </div>

              {preview ? (
                <div className="rounded-xl px-3 py-2.5 text-xs leading-relaxed ring-1 ring-blue-500/25 bg-blue-500/[0.06] text-gray-600">
                  Первый период — <b>{count} {plural(count, "занятие", "занятия", "занятий")}</b>,
                  {" "}{dayMonth(preview.from)} — {dayMonth(preview.until)}
                  {due ? <>, к оплате {fmtNum(due)} ₽</> : null}. Долг появится сразу.
                  {count < size && (
                    <> В периоде их {size}: остальные ещё не стоят в расписании.</>
                  )}
                </div>
              ) : (
                <div className="rounded-xl px-3 py-2.5 text-xs leading-relaxed ring-1 ring-amber-500/30 bg-amber-500/[0.07] text-amber-700 dark:text-amber-300">
                  С этой даты занятий пока нет — начислять будет нечего{manualOk ? <>, даже вписанную сумму</> : null}. Поставьте занятия в расписание.
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100/60 flex-shrink-0">
          <button onClick={close} className="flex-1 rounded-xl py-2.5 text-sm text-gray-600 ring-1 ring-inset ring-gray-200/80 dark:ring-white/15 hover:bg-blue-500/[0.08] transition active:scale-[0.97]">
            Отмена
          </button>
          <button onClick={submit} className="flex-1 btn-primary py-2.5">Сохранить</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PaymentModeModal
