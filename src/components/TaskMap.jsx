import { useEffect, useMemo, useState } from "react"
import Icon from "./Icon"
import TaskNoteModal from "./TaskNoteModal"
import { aggregateAttempts } from "../reportData"
import { numberTitle } from "../pages/numberTitles"
import { TASK_MAX } from "../examScales"
import { loadTaskNotes, saveTaskNote, loadTaskOrder, saveTaskOrder, orderNumbers } from "../taskNotes"

// Карта заданий: весь экзамен номерами, у каждого — процент верных ответов
// ученика; нажатие на номер открывает методичку репетитора, а значок книжки
// говорит, что она уже написана.
//
// Считаем по ПЕРВЫМ ответам (attempt_no = 1), теми же правилами, что «Где
// ученик ошибается» и отчёт родителю: в режиме «решай до верного» повторные
// подходы превратили бы исправленную ошибку в две неудачи, и карта показывала
// бы провал там, где ученик разобрался.
const MIN_ATTEMPTS = 3

// Порог «задание освоено». Тот же, что у слабых типажей: ниже — задание в
// работе, выше — закрыто.
const OK_ACCURACY = 70

const toneOf = (row) => {
  if (!row || row.attempts < MIN_ATTEMPTS) return "unknown"
  if (row.accuracy >= OK_ACCURACY) return "ok"
  if (row.accuracy < 40) return "bad"
  return "work"
}

// Плитка вместо пилюли: номера одной ширины выстраиваются в сетку, и карта
// читается как карта, а не как строка тегов. Заливка — тон состояния (не
// серая), у нерешённого номера заливки нет вовсе, поэтому решённое выступает
// вперёд само.
const TILE = {
  ok: "ring-green-500/25 bg-green-500/[0.07] hover:bg-green-500/[0.12]",
  work: "ring-amber-500/30 bg-amber-500/[0.08] hover:bg-amber-500/[0.14]",
  bad: "ring-red-500/25 bg-red-500/[0.07] hover:bg-red-500/[0.12]",
  unknown: "ring-gray-200/80 dark:ring-white/10 hover:bg-blue-500/[0.06]",
}
// Цвет числа и полосы. Тот же набор, что у «Слабых тем», — состояние на всех
// экранах раздела обязано выглядеть одинаково.
const LINE = { ok: "#34c759", work: "#ff9f0a", bad: "#ff3b30", unknown: "#9ca3af" }

function TaskMap({ attempts, tutorId, examType: hinted }) {
  const rows = attempts
  const [notes, setNotes] = useState({})
  const [order, setOrder] = useState([])
  const [arranging, setArranging] = useState(false)
  const [openNote, setOpenNote] = useState(null)

  // Предмет карты берём из САМИХ ответов, а не из цели в карточке. Цель — это
  // «ЕГЭ», а решает ученик «ЕГЭ Профиль»: фильтр по цели не находил ни одной
  // попытки, и карта у такого ученика просто не появлялась. Подсказка (тип
  // последнего варианта) важнее, но только если по ней есть ответы.
  const examType = useMemo(() => {
    const count = {}
    for (const r of rows || []) count[r.exam_type] = (count[r.exam_type] || 0) + 1
    if (hinted && count[hinted]) return hinted
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0]
    return top ? top[0] : hinted || ""
  }, [rows, hinted])

  useEffect(() => {
    if (!tutorId || !examType) return
    let alive = true
    loadTaskNotes(tutorId, examType).then((n) => { if (alive) setNotes(n) })
    loadTaskOrder(tutorId).then((o) => { if (alive) setOrder(o[examType] || []) })
    return () => { alive = false }
  }, [tutorId, examType])

  // Свод по НОМЕРУ, а не по типажу: карта отвечает на вопрос «как у него с
  // одиннадцатым», а разбор по типажам внутри номера — это соседний блок.
  const byNumber = useMemo(() => {
    const out = {}
    for (const r of aggregateAttempts((rows || []).filter((a) => a.exam_type === examType))) {
      const cur = out[r.number] || { number: r.number, attempts: 0, correct: 0 }
      cur.attempts += r.attempts
      cur.correct += r.correct
      out[r.number] = cur
    }
    for (const k of Object.keys(out)) {
      out[k].accuracy = out[k].attempts ? Math.round((out[k].correct / out[k].attempts) * 100) : 0
    }
    return out
  }, [rows, examType])

  // Карта — это ВЕСЬ экзамен, а не только то, что ученик успел порешать. Номер,
  // по которому ответов ещё нет, — такой же факт, как и провальный: до него
  // просто не дошли, и на карте это должно быть видно. Плюс номера, по которым
  // есть ответы или написана методичка, — на случай, если состав экзамена в
  // шкале не полон (старые выданные варианты, чужая нумерация).
  const numbers = useMemo(() => {
    const composition = Object.keys(TASK_MAX[examType] || {}).map(Number).filter(Boolean)
    const known = [...Object.keys(byNumber), ...Object.keys(notes)].map(Number).filter(Boolean)
    return orderNumbers([...new Set([...composition, ...known])], order)
  }, [byNumber, notes, order, examType])

  function move(number, dir) {
    const next = [...numbers]
    const i = next.indexOf(number)
    const j = i + dir
    if (i < 0 || j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
    // Пишем сразу: «сохранить порядок» отдельной кнопкой — это ещё один шаг,
    // про который забывают, и порядок теряется при уходе с экрана.
    saveTaskOrder(tutorId, examType, next)
  }

  if (rows === null) return null
  // Предмет не определился (ученик не решал и вариантов не выдавали) — карту
  // строить не из чего: номера у каждого экзамена свои.
  if (!numbers.length) return null
  // Ответов нет ни по одному номеру: карта работает как список заданий, к
  // которым пишутся методички. Говорим об этом прямо, иначе пустые чипы
  // читаются как «ученик всё провалил».
  const noAnswers = !Object.keys(byNumber).length

  return (
    <div className="glass-sm p-3.5">
      <div className="flex items-baseline justify-between gap-3 mb-0.5">
        <span className="text-sm font-medium">Карта заданий</span>
        <button onClick={() => setArranging((v) => !v)}
          className="press-fill text-[11px] px-2 py-1 rounded-lg ring-1 ring-gray-200 dark:ring-white/15 text-gray-500">
          {arranging ? "Готово" : "Свой порядок"}
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        {arranging
          ? "Стрелками поставьте номера в том порядке, в каком разбираете их сами."
          : noAnswers
            ? "Ученик ещё ничего не решал — процентов пока нет. Методичку к заданию можно написать уже сейчас: она ваша, а не его."
            : "Процент — по первым ответам; без процента — задание ещё не решали. Нажатие на номер открывает методичку, значок книжки — что она уже написана."}
      </p>

      {/* Сетка одинаковых плиток: ширину задаёт auto-fill, поэтому и на телефоне,
          и на широком экране ряд получается ровным, без «лесенки» из пилюль
          разной длины. */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}>
        {numbers.map((n) => {
          const row = byNumber[n]
          const tone = toneOf(row)
          const note = notes[n]
          const shown = row && row.attempts >= MIN_ATTEMPTS
          const title = numberTitle(examType, n)

          // В режиме порядка плитка перестаёт быть кнопкой: внутри неё две
          // стрелки, и вложенная кнопка в кнопке недопустима.
          if (arranging) {
            return (
              <div key={n} className={`rounded-2xl ring-1 px-2 py-1.5 ${TILE[tone]}`}>
                <div className={`text-[13px] font-semibold tabular-nums leading-none${shown ? "" : " text-gray-500"}`}
                  style={shown ? { color: LINE[tone] } : undefined}>
                  <span className="text-[10px] font-medium opacity-50">№</span>{n}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <button onClick={() => move(n, -1)} aria-label={`Задание ${n} левее`}
                    className="press-tap text-gray-400 hover:text-blue-600">
                    <Icon name="arrow" size={12} className="rotate-180" />
                  </button>
                  <button onClick={() => move(n, 1)} aria-label={`Задание ${n} правее`}
                    className="press-tap text-gray-400 hover:text-blue-600">
                    <Icon name="arrow" size={12} />
                  </button>
                </div>
              </div>
            )
          }

          return (
            <button key={n} onClick={() => setOpenNote({ number: n, note: note || null })}
              title={title ? `${title} — методичка` : `Задание ${n} — методичка`}
              aria-label={note ? `Методичка к заданию ${n}` : `Написать методичку к заданию ${n}`}
              className={`press-fill relative rounded-2xl ring-1 px-2 py-1.5 text-left transition-colors ${TILE[tone]}`}>
              <div className="flex items-start justify-between gap-1">
                <span className={`text-[13px] font-semibold tabular-nums leading-none${shown ? "" : " text-gray-500"}`}
                  style={shown ? { color: LINE[tone] } : undefined}>
                  <span className="text-[10px] font-medium opacity-50">№</span>{n}
                </span>
                {/* Книжка — метка «методичка уже написана», а не кнопка: раньше
                    она висела у каждого номера бледно-серой и рябила. */}
                {note && <Icon name="book" size={11} className="shrink-0 mt-px text-blue-500 dark:text-blue-300" />}
              </div>
              {/* Процент только там, где ответов достаточно: «0 из 1» в карте
                  читается как провал по всему номеру. Полоса под ним — то же
                  число фигурой: ряд плиток читается одним взглядом. */}
              <div className="mt-1.5 h-[19px]">
                {shown && (
                  <>
                    <div className="text-[11px] font-medium tabular-nums leading-none" style={{ color: LINE[tone] }}>
                      {row.accuracy}%
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-blue-500/12 overflow-hidden">
                      <div className="h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{ width: `${Math.max(row.accuracy, 4)}%`, background: LINE[tone] }} />
                    </div>
                  </>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {openNote && (
        <TaskNoteModal
          examType={examType}
          number={openNote.number}
          note={openNote.note}
          tutorId={tutorId}
          onSave={async ({ number, title, body, files }) => {
            const res = await saveTaskNote({ tutorId, examType, number, title, body, files })
            // Ответ бывает и с записью, и с ошибкой разом: без миграции текст
            // сохраняется, а файлы — нет. Тогда карту всё равно обновляем.
            if (res.note !== undefined) {
              setNotes((prev) => {
                const next = { ...prev }
                if (res.note) next[number] = res.note
                else delete next[number]
                return next
              })
            }
            return res
          }}
          onClose={() => setOpenNote(null)}
        />
      )}
    </div>
  )
}

export default TaskMap
