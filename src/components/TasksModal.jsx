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
import { renderHomeworkMath, plural, answersEqual } from "../utils"
import { useClosing } from "../useClosing"

// Одно задание в окне: номер кружком, условие во всю ширину, под ним — чертёж и
// файлы, ответ и варианты. Ответ стоит ПОД условием, а не чипом справа: справа
// он отъедал у формулы ту самую ширину, из-за которой всё и переносилось.
// Ответ у задания части 2 — это не одно число: эталон занимает несколько строк
// («а) да… б) нет… в) 1632»). Капсула (rounded-full), рассчитанная на «7» или
// «−4; 1», растягивалась вокруг такого абзаца сплошным зелёным пятном — вид,
// который читается как сбой вёрстки. Длинный ответ показываем блоком: обычные
// поля, переносы строк на месте, подпись «Ответ:» встаёт над ним.
const isLongAnswer = (text) => String(text).length > 48 || String(text).includes("\n")
const answerShape = (text) =>
  isLongAnswer(text) ? "px-2.5 py-1.5 rounded-xl whitespace-pre-line leading-relaxed"
    : "px-2 py-0.5 rounded-full"

function TaskBlock({ item, onCredit, onBoard }) {
  const { bankTask } = item
  // Задание с эталоном проверяет сама работа; без эталона (развёрнутый ответ,
  // письменная работа) ход решения смотрит репетитор — для него и есть доска.
  const autoChecked = item.answer != null && item.answer !== ""
  // Работа уже решена — значит окно показывает не условия, а разбор: у каждого
  // задания видно, что написал ученик и сошлось ли это с эталоном. `given`
  // приходит только у решённой работы (undefined — работа ещё не сдана),
  // а null внутри неё — задание, которое ученик пропустил.
  const reviewed = item.given !== undefined
  // Пропущенное задание видно ещё до чтения разбора: янтарная рамка у карточки и
  // такой же номер. Серым оно терялось между верными — а именно к нему и надо
  // вернуться на занятии, ошибку ученик хотя бы попробовал разобрать.
  const skipped = reviewed && item.given == null
  // Серые токены в тёмной теме перевёрнуты: `dark:`-вариант дал бы тёмный
  // текст на тёмном фоне (см. комментарий у шкалы в index.css).
  const body = "text-[15px] text-gray-700 leading-relaxed break-words"
  return (
    <div className={`rounded-2xl ring-1 px-4 py-3.5 flex gap-3.5 ${skipped
      ? "ring-amber-500/40 bg-amber-500/[0.06]" : "ring-gray-200/70 dark:ring-white/10"}`}>
      <span className={`shrink-0 w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${skipped
        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
        : "bg-blue-500/12 text-blue-600 dark:text-blue-400"}`}>
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
              imageAlt={bankTask.number != null ? `Задание №${bankTask.number}` : "Условие задания"}
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
              // В разборе видно и то, что выбрал ученик: верный вариант зелёный,
              // выбранный им неверный — красный, остальные без заливки.
              const chosen = reviewed && item.given != null && answersEqual(item.given, o)
              const cls = correct ? "bg-green-500/15 text-green-700 dark:text-green-300 ring-green-500/30"
                : chosen ? "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30"
                : "text-gray-500 ring-gray-500/20"
              return (
                <span key={j} className={`text-xs px-2.5 py-1 rounded-full ring-1 ${cls}`}
                  dangerouslySetInnerHTML={{ __html: renderHomeworkMath(String(o)) }} />
              )
            })}
          </div>
        )}

        {/* Эталон без разбора: работу ещё не решали, показываем только ответ. */}
        {!reviewed && item.answer != null && item.answer !== "" && !item.options && (
          <div className={`flex gap-1.5 text-xs ${isLongAnswer(item.answer) ? "flex-col items-start" : "items-center"}`}>
            <span className="text-gray-400">Ответ:</span>
            <span className={`bg-green-500/15 text-green-700 dark:text-green-300 ring-1 ring-green-500/30 ${answerShape(item.answer)}`}
              dangerouslySetInnerHTML={{ __html: renderHomeworkMath(String(item.answer)) }} />
          </div>
        )}

        {reviewed && (
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="text-gray-400">Ответ ученика:</span>
            {item.given == null ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 inline-flex items-center gap-1">
                <Icon name="minus" size={11} />не отвечено
              </span>
            ) : (
              <span className={`px-2 py-0.5 rounded-full ring-1 inline-flex items-center gap-1 ${
                item.ok === false ? "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30"
                  : item.ok ? "bg-green-500/15 text-green-700 dark:text-green-300 ring-green-500/30"
                  : "text-gray-500 ring-gray-500/20"
              }`}>
                {item.ok != null && <Icon name={item.ok ? "check" : "x"} size={11} />}
                <span dangerouslySetInnerHTML={{ __html: renderHomeworkMath(String(item.given)) }} />
              </span>
            )}
            {/* Верный ответ дописываем только там, где ученик ошибся: у верного
                он тот же самый, и вторая плашка была бы дублем. */}
            {item.ok === false && item.answer != null && item.answer !== "" && (
              <>
                <span className="text-gray-400">верный:</span>
                <span className={`bg-green-500/15 text-green-700 dark:text-green-300 ring-1 ring-green-500/30 ${answerShape(item.answer)}`}
                  dangerouslySetInnerHTML={{ __html: renderHomeworkMath(String(item.answer)) }} />
              </>
            )}
            {/* У зачтённого задания ответ ученика уже зелёный, но эталон всё равно
                показываем: именно он оказался неверным, и по нему видно, что
                именно поправили. Плашка без заливки — эталон здесь под сомнением. */}
            {item.credited && item.answer != null && item.answer !== "" && (
              <>
                <span className="text-gray-400">эталон:</span>
                <span className={`text-gray-500 ring-1 ring-gray-500/20 ${answerShape(item.answer)}`}
                  dangerouslySetInnerHTML={{ __html: renderHomeworkMath(String(item.answer)) }} />
              </>
            )}
          </div>
        )}

        {/* Зачёт задания руками репетитора. Эталон приходит из генератора банка и
            иногда ошибается (два верных ответа, другая допустимая запись), и тогда
            ученик прав, а работа показывает ошибку. Решает это репетитор: смотрит
            задание и, если ошибка подтвердилась, засчитывает номер. Ответ ученика
            при этом не подменяется — меняется только балл и разбор. */}
        {/* Незаполненное задание засчитывать нечего: эталон тут ни при чём —
            ученик просто не ответил. Кнопку показываем только там, где ответ
            есть и он разошёлся с эталоном. */}
        {(item.credited || (onCredit && item.ok === false && item.given != null)) && (
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            {item.credited && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/12 text-green-700 dark:text-green-300 ring-1 ring-green-500/25">
                <Icon name="check" size={10} />Засчитано репетитором
              </span>
            )}
            {onCredit && (
              <button type="button" onClick={() => onCredit(item, !item.credited)}
                title={item.credited ? "Снять зачёт: задание снова считается ошибкой"
                  : "Ответ ученика верен, а эталон банка ошибочен — засчитать задание"}
                className={`press-fill rounded-lg px-2.5 py-1 ring-1 ${item.credited
                  ? "text-gray-500 ring-gray-500/20 hover:text-red-500"
                  : "text-blue-600 ring-blue-500/25 hover:bg-blue-500/[0.06]"}`}>
                {item.credited ? "Отменить зачёт" : "Засчитать задание"}
              </button>
            )}
          </div>
        )}

        {/* Фото решения стоит у своего задания: ошибку ищут в ходе решения, а не
            в одном ответе. Общий список фото в разборе остаётся для старых работ. */}
        {(item.solutionUrl || (onBoard && !autoChecked)) && (
          <div className="flex items-center gap-2 flex-wrap">
            {item.solutionUrl && (
              <a href={item.solutionUrl} target="_blank" rel="noreferrer"
                className="press-fill text-xs px-3 py-1.5 rounded-lg ring-1 ring-gray-200 dark:ring-white/15 text-gray-600 inline-flex items-center gap-1.5">
                <Icon name="camera" size={12} />Фото решения
              </a>
            )}
            {/* Проверка на доске — у задания без автопроверки: сверить его не с
                чем, и репетитор разбирает ход решения сам. Условие и фото решения
                ложатся на доску ЭТОЙ работы — ту же, где ученик решает кнопкой
                «Решить на доске», — поэтому пометки репетитора он увидит там же. */}
            {onBoard && !autoChecked && (
              <button type="button" onClick={() => onBoard(item)}
                className="press-fill text-xs px-3 py-1.5 rounded-lg ring-1 ring-blue-500/25 text-blue-600 dark:text-blue-300 inline-flex items-center gap-1.5">
                <Icon name="clipboard" size={12} />Проверить на доске
              </button>
            )}
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

export default function TasksModal({ title, note, intro, items, onClose, onCredit, onBoard }) {
  const { cls: closingCls, close } = useClosing(onClose)
  // Уходя на доску, окно закрываем: доска открывается поверх кабинета, и
  // оставленное под ней окно встретило бы репетитора при возвращении.
  const toBoard = onBoard ? (item) => { onBoard(item); close() } : undefined

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
            {items.map((it, i) => <TaskBlock key={i} item={it} onCredit={onCredit} onBoard={toBoard} />)}
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
