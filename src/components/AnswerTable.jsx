import Icon from "./Icon"
import { answersEqual } from "../utils"

// Разбор части 1 — таблица, а не сетка клеток. Клетка вмещала три строки
// (номер, свой ответ, верный) и держалась на цвете: ряд из 27 залитых клеток
// читался как сплошное красное полотно, а без заливки клетки рассыпались.
// В таблице у каждой величины свой столбец, а неверный ответ помечен КРАСНЫМ
// ТЕКСТОМ — не зачёркиванием: перечёркнутый ответ читается плохо (особенно
// длинный или записанный словами), а найти в столбце ошибку нужно с одного
// взгляда. Заливок по-прежнему нет, цвет живёт только в самом ответе.
export default function AnswerTable({ nums, correct: correctAnswers, student: studentAnswers, credited }) {
  // Номера, засчитанные репетитором вручную: эталон банка бывает неверным, и
  // тогда прав ученик (supabase/manual_credit.sql). В разборе такое задание —
  // верное, иначе балл не сходился бы с таблицей.
  const byHand = new Set(Array.isArray(credited) ? credited.map(Number) : [])
  const rows = nums.map((n) => {
    const correct = correctAnswers[n - 1]
    const raw = studentAnswers[n - 1]
    const has = raw !== undefined && raw !== null && String(raw).trim() !== ""
    // Сверка — тем же answersEqual, каким считался балл части 1 (Variants.jsx).
    // Сравнение строк красило «0,5» при эталоне «0.5» в ошибку, и разбор
    // расходился с числом рядом.
    const known = correct !== undefined && correct !== null && String(correct).trim() !== ""
    const isRight = byHand.has(Number(n)) || (has && known && answersEqual(raw, correct))
    return { n, has, given: has ? String(raw) : "—", correct, known, isRight, isWrong: known && !isRight, byHand: byHand.has(Number(n)) }
  })
  // Двадцать семь строк в один столбец — простыня в половину экрана, поэтому
  // на широком экране таблица идёт двумя столбцами. Короткие группы (геометрия
  // ОГЭ — пять заданий) делить незачем.
  const half = Math.ceil(rows.length / 2)
  const parts = rows.length > 8 ? [rows.slice(0, half), rows.slice(half)] : [rows]

  return (
    <div className="grid sm:grid-cols-2 gap-x-6">
      {parts.map((part, i) => (
        <table key={i} className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-[11px] text-gray-400 text-left">
              <th className="font-normal py-1 w-7">№</th>
              <th className="font-normal py-1">Ответ</th>
              <th className="font-normal py-1">Верный</th>
            </tr>
          </thead>
          <tbody>
            {part.map((r) => (
              <tr key={r.n} className="border-t border-gray-100 dark:border-white/10">
                <td className="py-1 pr-1 align-top text-gray-400 tabular-nums">{r.n}</td>
                <td className={`py-1 pr-2 align-top break-words tabular-nums ${
                  // Красным помечаем только написанное: у пропущенного задания
                  // красный прочерк читался бы как ответ, которого нет.
                  r.isWrong && r.has ? "text-red-600 dark:text-red-400 font-medium"
                    : r.has ? "text-gray-700 font-medium" : "text-gray-400"
                }`}>{r.given}</td>
                {/* У верного ответа столбец пуст — заполнены ровно те строки,
                    где ученик ошибся, и промахи видны без единой заливки.
                    Эталон стоит ЗЕЛЁНЫМ напротив красного ответа ученика: в
                    строке сразу видно, что он написал и как было надо. */}
                <td className="py-1 align-top break-words tabular-nums font-semibold text-green-700 dark:text-green-400">
                  {r.isWrong ? r.correct : r.byHand
                    ? <span className="text-[11px] font-normal text-green-600 dark:text-green-300" title="Ответ засчитан репетитором: эталон оказался неверным">засчитано</span>
                    : r.isRight
                    ? <Icon name="check" size={11} className="text-green-500/70" />
                    : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  )
}
