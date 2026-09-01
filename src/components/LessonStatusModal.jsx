import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import { LESSON_MISSED, LESSON_EXCUSED } from "../utils"
import { formatLessonWhen } from "../lessonMove"

// Что делать с занятием, на которое ученик не пришёл. Единого правила тут быть
// не может: одни репетиторы оставляют оплату себе, другие просто переносят
// время — поэтому выбор предлагается по каждому занятию, а решение хранится в
// нём самом (см. LESSON_MISSED / LESSON_EXCUSED в utils.js).
//
// Модалка одна и та же для расписания и карточки ученика: разные экраны с
// одинаковым выбором быстро разъезжаются в формулировках, а формулировка здесь
// и есть весь смысл — она объясняет, что будет с деньгами.
const OPTIONS = [
  {
    key: LESSON_MISSED,
    icon: "user-x",
    title: "Ученик не пришёл",
    note: "Занятие идёт в счёт: оплата начисляется как обычно.",
    tint: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
    ring: "ring-amber-500/40",
  },
  {
    key: LESSON_EXCUSED,
    icon: "repeat",
    title: "Не в счёт",
    note: "Оплата не начисляется, занятие можно перенести на другое время.",
    tint: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
    ring: "ring-blue-500/40",
  },
]

// Пометка в списках занятий. «Не пришёл» — янтарная, как всё, что требует
// внимания; «не в счёт» — кольцом без заливки: это не тревога, а спокойный
// факт, и серой заливки в интерфейсе быть не может.
export function LessonStatusBadge({ status, className = "" }) {
  if (!status) return null
  const missed = status === LESSON_MISSED
  return (
    <span
      title={missed ? "Ученик не пришёл, занятие идёт в счёт" : "Занятие не идёт в счёт: оплата не начисляется"}
      className={`text-xs px-1.5 py-0.5 rounded-full font-normal whitespace-nowrap ${
        missed
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
          : "text-gray-500 dark:text-gray-400 ring-1 ring-gray-200/70 dark:ring-white/15"
      } ${className}`}
    >
      {missed ? "не пришёл" : "не в счёт"}
    </span>
  )
}

function LessonStatusModal({ lesson, who = "", onPick, onClose }) {
  const { cls: closingCls, close } = useClosing(onClose)
  const current = lesson?.status || null

  function pick(key) {
    // Повторное нажатие на уже выбранное — снятие пометки: отдельная кнопка
    // «отменить выбор» была бы третьей на две опции.
    onPick(key === current ? null : key)
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
          <h2 className="text-lg font-medium">Занятие не состоялось</h2>
          <button onClick={close} aria-label="Закрыть" className="text-gray-500 hover:text-gray-700 transition-transform active:scale-90">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 flex flex-col gap-3">
          <div className="glass-sm px-3 py-2.5 flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-blue-500/12 text-blue-500 flex items-center justify-center flex-shrink-0">
              <Icon name="calendar" size={15} />
            </span>
            <div className="min-w-0">
              {who && <div className="text-sm font-medium truncate">{who}</div>}
              <div className="text-xs text-gray-500">{formatLessonWhen(lesson?.date, lesson?.time)}</div>
            </div>
          </div>

          {OPTIONS.map((o) => {
            const active = current === o.key
            return (
              <button
                key={o.key}
                onClick={() => pick(o.key)}
                className={`press-fill text-left rounded-2xl px-3.5 py-3 flex items-start gap-3 ring-1 transition ${
                  active ? `${o.ring} bg-blue-500/[0.06]` : "ring-gray-200/70 dark:ring-white/10"
                }`}
              >
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${o.tint}`}>
                  <Icon name={o.icon} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    {o.title}
                    {active && <Icon name="check" size={14} className="text-blue-500" />}
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">{o.note}</span>
                </span>
              </button>
            )
          })}

          <p className="text-xs text-gray-400 leading-relaxed">
            {current
              ? "Нажмите на выбранный вариант ещё раз, чтобы снять пометку — занятие снова станет обычным."
              : "Решение сохраняется в самом занятии, поэтому прошлые занятия оно не затрагивает."}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default LessonStatusModal
