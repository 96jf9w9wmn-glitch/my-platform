// Длительность занятия ползунком, а не пятью кнопками: кнопки давали ровно
// пять вариантов, и занятие на 75 или 100 минут поставить было нечем.
//
// Оформление общее с WeeksPicker — класс .ios-range в index.css (тонкий трек,
// синяя заливка до бегунка, крупный белый бегунок). Заливку рисует градиент по
// переменной --p: у WebKit нет «прогресса» у трека, поэтому долю считаем здесь.
const MIN = 15
const MAX = 180
const STEP = 5

// «90 мин» репетитор про себя переводит в «полтора часа» — подписываем сразу.
function humanDuration(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} мин`
  if (m === 0) return h === 1 ? "1 час" : `${h} ч`
  return `${h} ч ${m} мин`
}

export default function DurationPicker({ value, onChange, fallback = 60 }) {
  const safe = Math.min(MAX, Math.max(MIN, Number(value) || fallback))
  const percent = ((safe - MIN) / (MAX - MIN)) * 100

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="text-sm font-medium text-gray-700">{safe} мин</span>
        <span className="text-xs text-gray-400">{humanDuration(safe)}</span>
      </div>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={safe}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Длительность занятия в минутах"
        className="ios-range"
        style={{ "--p": `${percent}%` }}
      />
      <div className="flex justify-between text-[11px] text-gray-400 mt-1">
        <span>15 мин</span>
        <span>3 часа</span>
      </div>
    </div>
  )
}
