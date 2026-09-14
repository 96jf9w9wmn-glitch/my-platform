// Задания во всплывающем окне — общее окно домашней работы и варианта.
//
// Зачем окно, а не список внутри карточки: условия банка везут системы, дроби и
// чертежи, а разбор стоит в колонке шириной в половину карточки. Кусочно
// заданная функция там переносится посреди предложения, и условие читается как
// каша. Окно даёт заданию всю ширину экрана и нормальный кегль — ровно тот вид,
// в котором его увидит ученик.
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Icon from "./Icon"
import TaskAttachments from "./TaskAttachments"
import ThemeInput from "./ThemeInput"
import { PhotoButton } from "./PhotoViewer"
import { renderHomeworkMath, plural, answersEqual, fileUrls } from "../utils"
import { useClosing } from "../useClosing"
import { numberTitle } from "../pages/numberTitles"
import { TASK_MAX, taskMaxOf, markPoints } from "../examScales"
import { ScoreButtons, TaskCriteria } from "./TaskGrading"

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

function TaskBlock({ item, onCredit, onBoard, marking }) {
  const { bankTask } = item
  // Задание с эталоном проверяет сама работа; без эталона (развёрнутый ответ,
  // письменная работа) ход решения смотрит репетитор — для него и есть доска.
  const autoChecked = item.answer != null && item.answer !== ""
  // Фото решения к этому заданию: список, а не одна ссылка — ученик
  // прикладывает столько листов, сколько занял ход решения.
  const shots = item.solutionUrls?.length ? item.solutionUrls : fileUrls(item.solutionUrl)
  // Работа уже решена — значит окно показывает не условия, а разбор: у каждого
  // задания видно, что написал ученик и сошлось ли это с эталоном. `given`
  // приходит только у решённой работы (undefined — работа ещё не сдана),
  // а null внутри неё — задание, которое ученик пропустил.
  const reviewed = item.given !== undefined
  // Пропущенное задание видно ещё до чтения разбора: янтарная рамка у карточки и
  // такой же номер. Серым оно терялось между верными — а именно к нему и надо
  // вернуться на занятии, ошибку ученик хотя бы попробовал разобрать.
  // Задание части 2 ответа и не ждёт: его решают на листе, и пустое поле —
  // не пропуск, а нормальный ход работы.
  const skipped = reviewed && item.given == null && !item.expert
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

        {/* У задания части 2 ответа и не ждут: ученик решает его на листе, и
            «не отвечено» читалось бы как пропуск работы. */}
        {reviewed && !(item.expert && item.given == null) && (
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
        {(shots.length > 0 || (onBoard && !autoChecked)) && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Фотографий к заданию бывает несколько — решение по действиям на
                один лист не влезает. Кнопка при этом одна: листы одного задания
                перелистываются внутри окна просмотра, а не стоят россыпью
                отдельных ссылок. */}
            {shots.length > 0 && (
              <PhotoButton photos={shots} title={`Задание ${item.n} · решение ученика`}
                className="press-fill text-xs px-3 py-1.5 rounded-lg ring-1 ring-gray-200 dark:ring-white/15 text-gray-600 inline-flex items-center gap-1.5">
                <Icon name="camera" size={12} />
                {shots.length > 1 ? `Решение · ${shots.length} фото` : "Фото решения"}
              </PhotoButton>
            )}
            {/* Проверка на доске — у задания без автопроверки: сверить его не с
                чем, и репетитор разбирает ход решения сам. Условие и фото решения
                ложатся на доску ЭТОЙ работы — ту же, где ученик решает кнопкой
                «Решить на доске», — поэтому пометки репетитора он увидит там же. */}
            {onBoard && !autoChecked && (
              <button type="button" onClick={() => onBoard(item)}
                className="press-fill text-xs px-3 py-1.5 rounded-lg ring-1 ring-blue-500/25 text-blue-600 dark:text-blue-300 inline-flex items-center gap-1.5">
                <Icon name="clipboard" size={12} />Задание на доску
              </button>
            )}
          </div>
        )}

        {/* Номер задания на экзамене. У задания из банка он приезжает вместе с
            заданием и только показывается; у нарезанного из своего файла его
            ставит репетитор — на нём держится вся статистика по номерам, и без
            него работа в неё не попадает вовсе (см. MarkRow). */}
        {/* Номер задания на экзамене и балл за него. Номер правится только у
            работы из своего файла: у задания из банка он приезжает с
            генератором, и менять его рукой нельзя — разойдётся с тем, что
            выдали. Балл же ставится и там и там. */}
        {marking && bankTask ? (
          <MarkRow item={item} marking={marking} autoChecked={autoChecked}
            editable={!!marking.canNumber && !bankTask.gen_key} />
        ) : bankTask?.number != null && String(bankTask.number) !== String(item.n) ? (
          <div className="text-[11px] text-gray-400">
            №{bankTask.number}{bankTask.module ? " · блок 1–5" : ""}
          </div>
        ) : null}

        {/* Критерии оценивания ФИПИ — у номера части 2, где балл ставит человек.
            Предмет берём у самого задания (у собранного из банка он приезжает с
            генератором), а у нарезанного из файла — тот, что выбрал репетитор
            в шапке разметки. */}
        <TaskCriteria examType={bankTask?.exam_type || marking?.examType} number={bankTask?.number} />
      </div>
    </div>
  )
}

// Предмет работы и разметка СКОПОМ. Предмет один на работу: задания одного
// файла — это задания одного экзамена, и спрашивать его у каждого было бы
// издевательством. Номер и тема здесь же: раздатка почти всегда собрана по
// одному номеру и одной теме, и до этой строки репетитор проставлял их по
// заданию — пятьдесят раз одно и то же.
//
// Поля показывают и состояние: разметка у заданий разная — они пустые, а
// написанное в них становится общим. Пустой номер снимает разметку со всех.
function MarkHeader({ items, marking }) {
  const own = items.filter((it) => it.bankTask && !it.bankTask.gen_key)
  if (!own.length) return null
  const known = (it) => !!TASK_MAX[marking.examType]?.[it.bankTask.number]
  const numbered = own.filter(known).length
  const themed = own.filter((it) => known(it) && it.bankTask.theme).length
  // Общее у всех заданий — или ничего, если они размечены вразнобой.
  const commonOf = (of) => {
    const first = of(own[0])
    return own.every((it) => of(it) === first) ? first : null
  }
  const commonNumber = commonOf((it) => it.bankTask.number ?? null)
  const commonTheme = commonOf((it) => it.bankTask.theme ?? "")
  return (
    <div className="flex flex-col gap-1.5 mb-3">
      <select value={marking.examType} onChange={(e) => marking.onExamType(e.target.value)}
        className="input-glass py-2 text-sm w-full">
        {marking.groups.map((g) => (
          <optgroup key={g.key} label={g.key}>
            {g.subjects.map((sub) => <option key={sub.type} value={sub.type}>{g.key} · {sub.label}</option>)}
          </optgroup>
        ))}
      </select>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-gray-400 shrink-0">Всем заданиям</span>
        {/* Ширину полю задаёт обёртка: у .input-glass стоит width:100% вне
            слоёв, и утилита w-14 на самом поле не действует. */}
        <div className="w-14 shrink-0">
          <input
            value={commonNumber ?? ""}
            onChange={(e) => marking.onAll(e.target.value)}
            placeholder="№"
            inputMode="numeric"
            title="Номер на экзамене — сразу всем заданиям работы"
            className="input-glass py-1 px-2 text-xs text-center"
          />
        </div>
        <div className="flex-1 min-w-[9rem]">
          <ThemeInput
            value={commonTheme ?? ""}
            options={marking.themes?.(marking.examType, commonNumber) || []}
            onOpen={marking.onThemesNeeded}
            onChange={marking.onThemeAll}
            placeholder="Тема — всем заданиям"
            className="py-1 px-2 text-xs"
          />
        </div>
      </div>
      <div className="text-[11px] text-gray-400 leading-snug">
        {numbered
          ? `Номер экзамена есть у ${numbered} ${plural(numbered, "задания", "заданий", "заданий")} из ${own.length}` +
            (themed ? `, тема — у ${themed}.` : ".") +
            (marking.canMark ? " Ставьте баллы — они пойдут в карту заданий." : "")
          : "Номер задания на экзамене связывает работу со статистикой ученика — картой заданий и слабыми темами. Тема уточняет её внутри номера: выберите из тем экзамена или напишите свою."}
      </div>
    </div>
  )
}

// Номер задания на экзамене и отметка репетитора — одной строкой под заданием.
//
// Обе половины про одно и то же: попадёт ли это задание в статистику ученика.
// Попытка пишется, когда известны ПРЕДМЕТ, НОМЕР и то, верно ли решено. У
// работы из банка всё это есть само; у работы из своего файла номер ставит
// репетитор здесь, а верность — он же кнопками, потому что сверять ответ не с
// чем: решение приходит фотографией.
function MarkRow({ item, marking, autoChecked, editable }) {
  const { onNumber, onMark, canMark } = marking
  const num = item.bankTask?.number ?? null
  const examType = item.bankTask?.exam_type || marking.examType
  const known = num != null && !!TASK_MAX[examType]?.[num]
  // Максимум НОМЕРА: за №14 профиля на экзамене дают два балла, за №15 — три, и
  // «верно/неверно» такому заданию мало — за половину решения там ставят
  // половину баллов. Поэтому у многобалльного номера отметка это шкала 0…max.
  const max = (known && taskMaxOf(examType, num)) || 1
  const points = markPoints(item.mark, max)
  // Балл ставится там, где его есть кому поставить. Задание в ОДИН балл, которое
  // сверилось с эталоном само, репетитор не размечает: верность уже известна, а
  // для ошибочного эталона есть «Засчитать задание». А вот у задания части 2
  // сверка знает только «сошлось или нет» и даёт либо ноль, либо максимум —
  // промежуточный балл (1 из 2 за пункт а у №14 профиля) поставить может только
  // человек, и именно так его ставят на экзамене.
  const markable = canMark && known && (max > 1 || !autoChecked)
  // Строка ни о чём: номер править нельзя и балл ставить не за что. Показываем
  // только расхождение нумерации — как было до разметки.
  if (!editable && !markable) {
    return num != null && String(num) !== String(item.n) ? (
      <div className="text-[11px] text-gray-400">
        №{num}{item.bankTask?.module ? " · блок 1–5" : ""}
      </div>
    ) : null
  }
  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px]">
      {/* Ширину полю задаёт обёртка: у .input-glass стоит width:100% вне слоёв,
          и утилита w-14 на самом поле не действует. */}
      {editable ? (
        <>
          <div className="w-14 shrink-0">
            <input
              value={num ?? ""}
              onChange={(e) => onNumber(item, e.target.value)}
              placeholder="№"
              inputMode="numeric"
              title="Номер этого задания на экзамене"
              className={`input-glass py-1 px-2 text-xs text-center ${num != null && !known ? "ring-1 ring-red-500/40" : ""}`}
            />
          </div>
          <span className={num != null && !known ? "text-red-500" : "text-gray-400"}>
            {num == null ? "Номер на экзамене — для статистики"
              : known ? numberTitle(examType, num)
              : `В «${examType}» нет задания №${num}`}
          </span>
        </>
      ) : (
        <span className="text-gray-400">
          №{num} · {numberTitle(examType, num)}
          {item.bankTask?.theme ? ` · ${item.bankTask.theme}` : ""}
        </span>
      )}
      {markable && (
        // Повторное нажатие по отмеченному снимает отметку: репетитор мог
        // промахнуться, а попытка, которой он не утверждал, не должна остаться
        // в статистике (RPC на p_correct = null удаляет строку).
        <div className="ml-auto flex items-center gap-1.5">
          <ScoreButtons max={max} points={points} onPick={(p) => onMark(item, p)} />
        </div>
      )}
      {/* Тема — только у задания с известным номером: она уточняет статистику
          ВНУТРИ номера, и без номера писать её некуда. Строка своя: рядом с
          номером и баллом ей уже не хватает ширины на телефоне. */}
      {editable && known && marking.onTheme && (
        <div className="w-full">
          <ThemeInput
            value={item.bankTask?.theme ?? ""}
            options={marking.themes?.(examType, num) || []}
            onOpen={marking.onThemesNeeded}
            onChange={(v) => marking.onTheme(item, v)}
            className="py-1 px-2 text-xs"
          />
        </div>
      )}
    </div>
  )
}

export default function TasksModal({ title, note, intro, items, onClose, onCredit, onBoard, onBoardAll, marking }) {
  const { cls: closingCls, close } = useClosing(onClose)
  // Уходя на доску, окно закрываем: доска открывается поверх кабинета, и
  // оставленное под ней окно встретило бы репетитора при возвращении.
  const toBoard = onBoard ? (item) => { onBoard(item); close() } : undefined
  // Вся работа на доску — отсюда же, из окна разбора: раньше эта кнопка стояла
  // у списка фотографий в колонке проверки, и разбор выглядел разделённым
  // надвое — задания в одном месте, решение и доска в другом.
  const toBoardAll = onBoardAll ? () => { onBoardAll(); close() } : undefined
  // Шапка отделяется волосяной линией только когда под неё уехало условие —
  // у самого верха линия висела бы просто так.
  const [scrolled, setScrolled] = useState(false)
  const bodyRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])

  return createPortal(
    // z выше модалки «Новое задание» (z-50): окно открывается и поверх неё.
    <div className={`fixed inset-0 glass-overlay z-[60] overflow-y-auto ${closingCls}`} onClick={close}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
        {/* Шапка стоит НАД областью прокрутки, а не приклеена внутри неё
            (`sticky`): стекло модалки полупрозрачно, и приклеенная шапка
            показывала бы уезжающие под неё условия насквозь. Здесь список
            обрезается краем своей области, и под шапкой пусто. */}
        <div className={`glass-modal w-full max-w-3xl max-h-[92dvh] flex flex-col overflow-hidden ${closingCls}`}
          onClick={(e) => e.stopPropagation()}>
          <div className={`shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b transition-colors ${
            scrolled ? "border-gray-200/70 dark:border-white/10" : "border-transparent"}`}>
            <div className="min-w-0">
              <h2 className="text-lg font-medium leading-tight truncate">{title || "Задания"}</h2>
              <div className="text-[11px] text-gray-400 mt-1">
                {items.length > 0
                  ? `${items.length} ${plural(items.length, "задание", "задания", "заданий")}`
                  : "Условия работы"}{note ? ` · ${note}` : ""}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {toBoardAll && (
                <button type="button" onClick={toBoardAll}
                  title="Условия и решение ученика — на доску этой работы"
                  className="press-fill text-xs px-3 py-1.5 rounded-lg ring-1 ring-blue-500/25 text-blue-600 dark:text-blue-300 inline-flex items-center gap-1.5">
                  <Icon name="clipboard" size={12} />
                  <span className="hidden sm:inline">Вся работа на доску</span>
                  <span className="sm:hidden">На доску</span>
                </button>
              )}
              <button onClick={close} aria-label="Закрыть"
                className="press-tap w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600">
                <Icon name="x" size={18} />
              </button>
            </div>
          </div>

          <div ref={bodyRef} onScroll={() => setScrolled((bodyRef.current?.scrollTop || 0) > 2)}
            className="no-scrollbar min-h-0 overflow-y-auto px-5 sm:px-6 pb-5 sm:pb-6">
            {intro && (
              <div className="text-sm text-gray-600 leading-relaxed mb-3"
                dangerouslySetInnerHTML={{ __html: renderHomeworkMath(intro) }} />
            )}

            {marking?.canNumber && <MarkHeader items={items} marking={marking} />}

            <div className="flex flex-col gap-2.5">
              {items.map((it, i) => <TaskBlock key={i} item={it} onCredit={onCredit} onBoard={toBoard} marking={marking} />)}
              {items.length === 0 && !intro && (
                <div className="rounded-2xl ring-1 ring-dashed ring-gray-200/80 dark:ring-white/10 text-sm text-gray-400 text-center py-8">
                  Условий нет
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
