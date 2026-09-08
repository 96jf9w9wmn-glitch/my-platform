import { useEffect, useMemo, useState } from "react"
import Icon from "./Icon"
import TaskNoteModal from "./TaskNoteModal"
import { aggregateAttempts } from "../reportData"
import { numberTitle } from "../pages/numberTitles"
import { TASK_MAX } from "../examScales"
import { loadTaskNotes, saveTaskNote, loadTaskOrder, saveTaskOrder, orderNumbers } from "../taskNotes"

// Карта заданий: весь экзамен номерами, у каждого — процент верных ответов
// ученика и, если репетитор её написал, методичка по значку книжки.
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

const CHIP = {
  ok: "ring-green-500/30 text-green-700 dark:text-green-300",
  work: "ring-amber-500/30 text-amber-700 dark:text-amber-300",
  bad: "ring-red-500/30 text-red-700 dark:text-red-300",
  unknown: "ring-gray-200 dark:ring-white/12 text-gray-500",
}

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
            : "Процент — по первым ответам; без процента — задание ещё не решали. Значок книжки открывает вашу методичку."}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {numbers.map((n) => {
          const row = byNumber[n]
          const tone = toneOf(row)
          const note = notes[n]
          return (
            <span key={n} className={`inline-flex items-center gap-1.5 rounded-xl ring-1 px-2.5 py-1.5 text-xs ${CHIP[tone]}`}>
              {arranging && (
                <button onClick={() => move(n, -1)} aria-label="Левее" className="press-tap text-gray-400 hover:text-blue-600">
                  <Icon name="arrow" size={11} className="rotate-180" />
                </button>
              )}
              <span className="font-medium" title={numberTitle(examType, n)}>№{n}</span>
              {/* Процент только там, где ответов достаточно: «0 из 1» в карте
                  читается как провал по всему номеру. */}
              {row && row.attempts >= MIN_ATTEMPTS && (
                <span className="tabular-nums opacity-70">{row.accuracy}%</span>
              )}
              <button
                onClick={() => setOpenNote({ number: n, note: note || null })}
                title={note ? "Открыть методичку" : "Написать методичку к заданию"}
                className={"press-tap " + (note ? "text-blue-600 dark:text-blue-300" : "text-gray-300 dark:text-white/25 hover:text-blue-500")}
                aria-label={note ? `Методичка к заданию ${n}` : `Написать методичку к заданию ${n}`}>
                <Icon name="book" size={12} />
              </button>
              {arranging && (
                <button onClick={() => move(n, 1)} aria-label="Правее" className="press-tap text-gray-400 hover:text-blue-600">
                  <Icon name="arrow" size={11} />
                </button>
              )}
            </span>
          )
        })}
      </div>

      {openNote && (
        <TaskNoteModal
          examType={examType}
          number={openNote.number}
          note={openNote.note}
          onSave={async ({ number, title, body }) => {
            const res = await saveTaskNote({ tutorId, examType, number, title, body })
            if (res.error) return res
            setNotes((prev) => {
              const next = { ...prev }
              if (res.note) next[number] = res.note
              else delete next[number]
              return next
            })
            return res
          }}
          onClose={() => setOpenNote(null)}
        />
      )}
    </div>
  )
}

export default TaskMap
