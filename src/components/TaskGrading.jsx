// Балл за задание и критерии ФИПИ — общий вид для разбора работы и для доски.
//
// Второй копии тут быть не должно: балл, который репетитор ставит в окне
// заданий, и балл, который он ставит под листом на доске, — это одно и то же
// число в одной и той же работе (homework.task_marks). Разъедутся кнопки —
// разъедется и то, что видно на экране, а считаться будет одно.
import { useState } from "react"
import Icon from "./Icon"
import Collapse from "./Collapse"
import { plural } from "../utils"
import { criteriaOf } from "../examCriteria"

// Балл задания, который ставит репетитор. У задания в один балл это привычные
// «верно/неверно» — так отметка и выглядела, пока баллов не было; у задания
// части 2 — шкала от нуля до максимума номера, ровно та, по которой ставит балл
// эксперт на экзамене. Повторное нажатие по выбранному снимает отметку: попытка,
// которой репетитор не утверждал, не должна остаться в статистике.
//
// Цвет говорит о том же, о чём балл: полный — зелёный, ноль — красный,
// неполный — янтарный, как «частично» в любом разборе. Невыбранные баллы стоят
// кольцом без заливки (общее правило: заливка в интерфейсе не бывает серой).
//
// big — вид для доски: там подвал листа читают с расстояния, и мелкие кнопки
// разбора в нём не нажать.
export function ScoreButtons({ max, points, onPick, big = false, muted = null }) {
  // Классы Tailwind пишем целиком: собранные из кусков строкой сборщик не видит.
  const idle = "ring-gray-200 dark:ring-white/15"
  const pad = big ? "px-2.5 py-1.5 text-[15px]" : "px-2 py-1 text-[11px]"
  const cell = `press-fill rounded-lg ring-1 inline-flex items-center gap-1 ${pad}`
  const dim = muted ? "" : " text-gray-500"
  if (max <= 1) {
    return (
      <>
        <button type="button" onClick={() => onPick(points === 1 ? null : 1)}
          title="Задание решено верно — пойдёт в статистику по номеру"
          style={points === 1 || !muted ? undefined : { color: muted }}
          className={`${cell} ${points === 1
            ? "bg-green-500/15 text-green-700 dark:text-green-300 ring-green-500/30"
            : `${idle}${dim} hover:text-green-600`}`}>
          <Icon name="check" size={big ? 14 : 11} />верно
        </button>
        <button type="button" onClick={() => onPick(points === 0 ? null : 0)}
          title="Задание решено неверно — пойдёт в статистику по номеру"
          style={points === 0 || !muted ? undefined : { color: muted }}
          className={`${cell} ${points === 0
            ? "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30"
            : `${idle}${dim} hover:text-red-500`}`}>
          <Icon name="x" size={big ? 14 : 11} />неверно
        </button>
      </>
    )
  }
  const box = big ? "w-9 h-9 text-[15px]" : "w-7 h-7 text-[12px]"
  return (
    <>
      {Array.from({ length: max + 1 }, (_, p) => {
        const on = points === p
        const tone = p === max ? "bg-green-500/15 text-green-700 dark:text-green-300 ring-green-500/30"
          : p === 0 ? "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30"
        return (
          <button key={p} type="button" onClick={() => onPick(on ? null : p)}
            title={`${p} ${plural(p, "балл", "балла", "баллов")} из ${max}`}
            style={on || !muted ? undefined : { color: muted }}
            className={`press-fill rounded-lg ring-1 font-medium flex items-center justify-center ${box} ${on
              ? tone : `${idle}${dim} hover:text-blue-600`}`}>
            {p}
          </button>
        )
      })}
      <span className={big ? "text-[13px]" : "text-[11px]"} style={muted ? { color: muted } : undefined}>
        <span className={muted ? "" : "text-gray-400"}>из {max}</span>
      </span>
    </>
  )
}

// Критерии ФИПИ по этому номеру — то, по чему эксперт на экзамене и решает,
// сколько ставить за неполное решение. Без них балл части 2 ставится на глаз.
// Свёрнуты: развёрнутая лестница из пяти пунктов длиннее самого условия, а
// смотрят в неё один раз на задание.
export function TaskCriteria({ examType, number, big = false, muted = null }) {
  const [open, setOpen] = useState(false)
  const criteria = criteriaOf(examType, number)
  if (!criteria) return null
  const size = big ? "text-[13px]" : "text-[11px]"
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={open || !muted ? undefined : { color: muted }}
        className={`press-fill self-start rounded-lg px-2 py-1 ring-1 inline-flex items-center gap-1 ${size} ${open
          ? "bg-blue-500/12 text-blue-600 dark:text-blue-300 ring-blue-500/25"
          : `ring-gray-200 dark:ring-white/15 ${muted ? "" : "text-gray-500"} hover:text-blue-600`}`}>
        <Icon name="file-text" size={big ? 13 : 11} />Критерии ФИПИ
      </button>
      <Collapse open={open}>
        <div className="rounded-xl ring-1 ring-gray-200/70 dark:ring-white/10 px-3 py-2.5 flex flex-col gap-2">
          <div className={size} style={muted ? { color: muted } : undefined}>
            <span className={muted ? "" : "text-gray-400"}>Задание {number} · {examType}</span>
          </div>
          {criteria.map((c) => (
            <div key={c.score} className="flex items-start gap-2.5">
              <span className={`mt-px flex-shrink-0 rounded-md ring-1 ring-blue-500/25 bg-blue-500/[0.06] font-medium text-blue-600 dark:text-blue-300 flex items-center justify-center ${big ? "w-6 h-6 text-[13px]" : "w-5 h-5 text-[11px]"}`}>{c.score}</span>
              <span className={`leading-relaxed ${size}`} style={muted ? { color: muted } : undefined}>
                <span className={muted ? "" : "text-gray-500"}>{c.text}</span>
              </span>
            </div>
          ))}
        </div>
      </Collapse>
    </div>
  )
}
