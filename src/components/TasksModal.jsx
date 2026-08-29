// Задания во всплывающем окне — общее окно домашней работы и варианта.
//
// Зачем окно, а не список внутри карточки: условия банка везут системы, дроби и
// чертежи, а разбор стоит в колонке шириной в половину карточки. Кусочно
// заданная функция там переносится посреди предложения, и условие читается как
// каша. Окно даёт заданию всю ширину экрана и нормальный кегль — ровно тот вид,
// в котором его увидит ученик.
import { useEffect } from "react"
import { createPortal } from "react-dom"
import Icon from "./Icon"
import TaskAttachments from "./TaskAttachments"
import { renderHomeworkMath, plural } from "../utils"
import { useClosing } from "../useClosing"

// Одно задание в окне: номер кружком, условие во всю ширину, под ним — чертёж и
// файлы, ответ и варианты. Ответ стоит ПОД условием, а не чипом справа: справа
// он отъедал у формулы ту самую ширину, из-за которой всё и переносилось.
function TaskBlock({ item }) {
  const { bankTask } = item
  // Серые токены в тёмной теме перевёрнуты: `dark:`-вариант дал бы тёмный
  // текст на тёмном фоне (см. комментарий у шкалы в index.css).
  const body = "text-[15px] text-gray-700 leading-relaxed break-words"
  return (
    <div className="rounded-2xl ring-1 ring-gray-200/70 dark:ring-white/10 px-4 py-3.5 flex gap-3.5">
      <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/12 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center justify-center">
        {item.n}
      </span>
      <div className="min-w-0 flex-1 flex flex-col gap-2">
        {/* Задание из банка показываем его же половинами: вопрос под чертежом,
            как на бланке ФИПИ. В строке описания обе половины склеены. */}
        {bankTask ? (
          <>
            {bankTask.condition_text && (
              <div className={body} dangerouslySetInnerHTML={{ __html: renderHomeworkMath(bankTask.condition_text) }} />
            )}
            <TaskAttachments
              task={bankTask}
              imageAlt={`Задание №${bankTask.number}`}
              tail={bankTask.condition_tail ? (
                <div className={body} dangerouslySetInnerHTML={{ __html: renderHomeworkMath(bankTask.condition_tail) }} />
              ) : null}
            />
          </>
        ) : (
          <div className={body} dangerouslySetInnerHTML={{ __html: renderHomeworkMath(item.text) }} />
        )}

        {item.options?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.options.map((o, j) => {
              const correct = item.answer != null && o === item.answer
              return (
                <span key={j}
                  className={`text-xs px-2.5 py-1 rounded-full ring-1 ${
                    correct ? "bg-green-500/15 text-green-700 dark:text-green-300 ring-green-500/30" : "text-gray-500 ring-gray-500/20"
                  }`}
                  dangerouslySetInnerHTML={{ __html: renderHomeworkMath(String(o)) }} />
              )
            })}
          </div>
        )}

        {item.answer != null && item.answer !== "" && !item.options && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-400">Ответ:</span>
            <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-300 ring-1 ring-green-500/30"
              dangerouslySetInnerHTML={{ __html: renderHomeworkMath(String(item.answer)) }} />
          </div>
        )}

        {/* Номер задания на экзамене. В варианте им же подписан кружок, и второй
            раз он не нужен — там номер по порядку и есть номер задания. */}
        {bankTask?.number != null && String(bankTask.number) !== String(item.n) && (
          <div className="text-[11px] text-gray-400">
            №{bankTask.number}{bankTask.module ? " · блок 1–5" : ""}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TasksModal({ title, note, intro, items, onClose }) {
  const { cls: closingCls, close } = useClosing(onClose)

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])

  return createPortal(
    // z выше модалки «Новое задание» (z-50): окно открывается и поверх неё.
    <div className={`fixed inset-0 glass-overlay z-[60] overflow-y-auto ${closingCls}`} onClick={close}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
        <div className={`glass-modal p-5 sm:p-6 w-full max-w-3xl max-h-[92dvh] overflow-y-auto ${closingCls}`}
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2 className="text-lg font-medium leading-tight truncate">{title || "Задания"}</h2>
              <div className="text-[11px] text-gray-400 mt-1">
                {items.length > 0
                  ? `${items.length} ${plural(items.length, "задание", "задания", "заданий")}`
                  : "Условия работы"}{note ? ` · ${note}` : ""}
              </div>
            </div>
            <button onClick={close} aria-label="Закрыть"
              className="press-tap shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600">
              <Icon name="x" size={18} />
            </button>
          </div>

          {intro && (
            <div className="text-sm text-gray-600 leading-relaxed mb-3"
              dangerouslySetInnerHTML={{ __html: renderHomeworkMath(intro) }} />
          )}

          <div className="flex flex-col gap-2.5">
            {items.map((it, i) => <TaskBlock key={i} item={it} />)}
            {items.length === 0 && !intro && (
              <div className="rounded-2xl ring-1 ring-dashed ring-gray-200/80 dark:ring-white/10 text-sm text-gray-400 text-center py-8">
                Условий нет
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
