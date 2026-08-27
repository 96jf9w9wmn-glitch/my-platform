// На сколько недель вперёд расставить регулярные занятия.
//
// Ползунок, но не системный: нативный <input type="range"> рисуется по-своему
// в каждом браузере и выглядит деталью чужого интерфейса. Внешний вид задаёт
// класс .ios-range в index.css — тонкий трек, синяя заливка до бегунка и
// крупный белый бегунок с мягкой тенью, как у ползунков в iOS.
//
// Заливку рисует градиент по переменной --p: `::-webkit-slider-runnable-track`
// не умеет «прогресс», в отличие от `::-moz-range-progress`, поэтому долю
// считаем здесь и отдаём в CSS.
const MIN = 1
const MAX = 52

// Недели репетитор переводит в привычный срок, поэтому подписываем значение:
// «26 нед.» само по себе ни о чём не говорит, «полгода» — говорит.
function humanTerm(weeks) {
  if (weeks === 1) return "неделя"
  if (weeks < 4) return `${weeks} недели`
  if (weeks === 4) return "месяц"
  if (weeks === 26) return "полгода"
  if (weeks === 36) return "учебный год"
  if (weeks === 52) return "год"
  const months = Math.round(weeks / 4.345)
  return months === 1 ? "около месяца" : `около ${months} месяцев`
}

export default function WeeksPicker({ value, onChange }) {
  const safe = Math.min(MAX, Math.max(MIN, value || MIN))
  const percent = ((safe - MIN) / (MAX - MIN)) * 100

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="text-sm font-medium text-gray-700">{safe} нед.</span>
        <span className="text-xs text-gray-400">{humanTerm(safe)}</span>
      </div>
      <input
        type="range"
        min={MIN}
        max={MAX}
        value={safe}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="На сколько недель вперёд расставить занятия"
        className="ios-range"
        style={{ "--p": `${percent}%` }}
      />
      {/* Только края: срок словами уже стоит справа над треком, и посередине
          он повторялся бы сам с собой («полгода» дважды в одном блоке). */}
      <div className="flex justify-between text-[11px] text-gray-400 mt-1">
        <span>1 нед.</span>
        <span>год</span>
      </div>
    </div>
  )
}
