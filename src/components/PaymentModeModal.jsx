import { useState } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import SegmentSwitch from "./SegmentSwitch"
import { plural } from "../utils"
import { fmtNum } from "../num"
import {
  PERIODS, dayMonth, todayIso, lessonsInRange,
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

  // Что будет начислено сразу после включения — считаем по расписанию, чтобы
  // сумма не оказалась сюрпризом.
  const preview = (() => {
    if (mode !== MODE_PACKAGE) return null
    const p = PERIODS.find((x) => x.key === period) || PERIODS[0]
    const from = new Date(start + "T00:00:00")
    if (Number.isNaN(from.getTime())) return null
    const until = new Date(from)
    if (p.months) until.setMonth(until.getMonth() + p.months)
    else until.setDate(until.getDate() + p.days)
    until.setDate(until.getDate() - 1)
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const lessons = lessonsInRange(student, start, iso(until))
    return { until: iso(until), count: lessons.length }
  })()

  function submit() {
    onSubmit(mode === MODE_PACKAGE
      ? { paymentMode: MODE_PACKAGE, packagePeriod: period, packageStart: start }
      : { paymentMode: MODE_LESSON, packagePeriod: null, packageStart: null })
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

              {preview && (
                <div className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ring-1 ${
                  preview.count ? "ring-blue-500/25 bg-blue-500/[0.06] text-gray-600"
                                : "ring-amber-500/30 bg-amber-500/[0.07] text-amber-700 dark:text-amber-300"
                }`}>
                  {preview.count ? (
                    <>Первый период — по {dayMonth(preview.until)}: <b>{preview.count} {plural(preview.count, "занятие", "занятия", "занятий")}</b>
                      {price ? <>, к оплате {fmtNum(preview.count * price)} ₽</> : null}. Долг появится сразу.</>
                  ) : (
                    <>В этот период занятий пока нет — начислять будет нечего. Поставьте занятия в расписание.</>
                  )}
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
