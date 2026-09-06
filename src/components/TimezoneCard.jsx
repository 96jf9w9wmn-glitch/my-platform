import { useEffect, useState } from "react"
import Icon from "./Icon"
import { deviceTimezone, tzCity, offsetLabel, studentZoneDiffers, toStudentWall, zoneDiffMinutes } from "../timezone"

// Карточка «Часовой пояс» в разделе «Профиль».
//
// Выбирать тут нечего: пояс берётся с устройства и меняется сам при переезде —
// список «выберите свой часовой пояс» устарел бы в первой же поездке. Карточка
// нужна для другого: показать, что расписание СЕЙЧАС показано по вашим часам, и
// назвать поимённо тех учеников, у кого время своё. Молча сдвинутое на час
// расписание — худшее, что тут можно сделать.

function nowIn(tz) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date())
  } catch {
    return ""
  }
}

export default function TimezoneCard({ students = [] }) {
  const myTz = deviceTimezone()
  const [, tick] = useState(0)

  // Часы идут: карточку открывают именно чтобы сверить время.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 20000)
    return () => clearInterval(id)
  }, [])

  // Ученики, чьи часы разошлись с вашими. Порядок — от большей разницы:
  // «на два часа раньше» важнее получаса.
  const apart = students
    .filter((s) => studentZoneDiffers(s))
    .map((s) => ({ student: s, diff: zoneDiffMinutes(s.timezone, s.tzFrame) }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

  function diffWords(min) {
    const abs = Math.abs(min)
    const h = Math.floor(abs / 60)
    const m = abs % 60
    const parts = [h ? `${h} ч` : "", m ? `${m} мин` : ""].filter(Boolean).join(" ")
    return `${parts} ${min > 0 ? "назад" : "вперёд"}`
  }

  return (
    <div className="glass p-5 flex flex-col">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
          <Icon name="globe" size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">Часовой пояс</div>
          <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
            Определяется устройством и меняется сам при переезде. Расписание показано по вашим часам,
            а ученик видит время, о котором вы договаривались, — оно не сдвигается.
          </p>
        </div>
      </div>

      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-semibold tabular-nums">{nowIn(myTz)}</span>
        <span className="text-sm text-gray-500">
          {myTz ? `${tzCity(myTz)} · ${offsetLabel(myTz)}` : "пояс устройства неизвестен"}
        </span>
      </div>

      {apart.length > 0 && (
        <div className="mt-4 rounded-xl ring-1 ring-inset ring-[#007AFF]/20 px-3 py-2.5">
          <div className="text-xs font-medium text-[#007AFF] mb-1.5">
            {apart.length === 1 ? "У одного ученика время своё" : `Время своё у ${apart.length} учеников`}
          </div>
          <div className="flex flex-col gap-1">
            {apart.map(({ student, diff }) => (
              <div key={student.id} className="text-xs text-gray-500 flex flex-wrap gap-x-1.5">
                <span className="font-medium text-gray-700 dark:text-gray-300">{student.name}</span>
                <span>{tzCity(student.timezone)} — {diffWords(diff)}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed mt-2">
            Например, занятие в {sample(apart[0])} у вас — это {sampleStudent(apart[0])} у ученика.
            В расписании и в уведомлениях это уже учтено.
          </p>
        </div>
      )}
    </div>
  )
}

// Пример на живом занятии, а не на выдуманном времени: так понятнее, что
// сдвиг относится к настоящему расписанию. Занятия нет — берём 18:00.
function firstLesson(entry) {
  return (entry.student.lessons || []).find((l) => l.time) || null
}
function sample(entry) {
  return firstLesson(entry)?.time || "18:00"
}
function sampleStudent(entry) {
  const l = firstLesson(entry)
  const w = toStudentWall(entry.student, l?.date || new Date().toISOString().slice(0, 10), sample(entry))
  return w.time
}
