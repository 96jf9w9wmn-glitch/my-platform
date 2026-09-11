import { useEffect, useId, useMemo, useRef } from "react"
import { examForecast, fmtPace } from "../forecast"
import { aggregateAttempts } from "../reportData"
import { plural } from "../utils"
import { scaleOf, testScoreOf, taskMaxOf, parseTarget, gradeOf } from "../examScales"
import { examTypeOf } from "../examStats"
import { smoothPath } from "../smoothPath"

// Готовность к экзамену и график динамики. Блок общий: его показывает и карточка
// ученика у репетитора, и раздел «Результаты» в кабинете самого ученика —
// прогноз, темп и шкала обязаны быть у обоих одни и те же.


// Большой график динамики. Значения подписаны прямо над точками: работ у
// ученика единицы, и подпись честнее всплывающей подсказки — видно сразу всё.
// `forecast` — { total, date }: точка прогноза на день экзамена. Рисуется
// пунктиром от последней работы, потому что это не результат, а продолжение
// линии; сплошной она читалась бы как ещё одна сданная работа.
// `pass` — порог сдачи в первичных баллах.
export function ScoreChart({ rows, max, target, pass = 0, forecast = null }) {
  const uid = useId()
  const W = 660, H = 230
  const padX = 22, padTop = 34, padBottom = 30
  // Прогноз занимает ещё одно деление по оси: без него точка легла бы на
  // последнюю работу, и «куда идём» из графика было бы не видно.
  const slots = rows.length + (forecast ? 1 : 0)
  const step = slots > 1 ? (W - padX * 2) / (slots - 1) : 0
  const y = (v) => padTop + (1 - Math.max(0, Math.min(v / max, 1))) * (H - padTop - padBottom)
  const pts = rows.map((r, i) => ({
    x: padX + i * step + (slots === 1 ? (W - padX * 2) / 2 : 0),
    y: y(r.total),
    row: r,
  }))
  const fPt = forecast ? { x: padX + rows.length * step, y: y(forecast.total) } : null
  const line = smoothPath(pts)
  const everyNth = rows.length > 6 ? Math.ceil(rows.length / 5) : 1
  // Длинная история: подписи у каждой точки перестают помогать и начинают
  // мешать. Порог взят по месту — до восьми работ числа ещё стоят свободно.
  const dense = rows.length > 8
  const bestIdx = rows.reduce((bi, r, i) => (r.total > rows[bi].total ? i : bi), 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Динамика первичных баллов">
      <defs>
        <linearGradient id={`ch${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#007aff" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#007aff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={padX} x2={W - padX} y1={y(max * f)} y2={y(max * f)}
          stroke="currentColor" strokeOpacity="0.09" strokeWidth="1" className="text-gray-500" />
      ))}

      {/* Подпись линии цели вынесена в заголовок карточки: у правого края она
          налезала на значение последней работы. */}
      {target > 0 && target <= max && (
        <line x1={padX} x2={W - padX} y1={y(target)} y2={y(target)}
          stroke="#34c759" strokeWidth="1.4" strokeDasharray="5 5" opacity="0.7" />
      )}

      {/* Порог сдачи. Линия важнее цели по смыслу — цель это желание, порог это
          граница «сдал или нет», — поэтому она подписана прямо на графике. */}
      {pass > 0 && pass <= max && (
        <g>
          <line x1={padX} x2={W - padX} y1={y(pass)} y2={y(pass)}
            stroke="currentColor" className="text-gray-400" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.75" />
          <text x={W - padX} y={y(pass) - 5} textAnchor="end" fontSize="11" fill="currentColor" className="text-gray-400">
            порог {pass}
          </text>
        </g>
      )}

      {rows.length > 1 && <path d={`${line} L${pts[pts.length - 1].x},${H - padBottom} L${pts[0].x},${H - padBottom} Z`} fill={`url(#ch${uid})`} />}
      {rows.length > 1 && <path d={line} fill="none" stroke="#007aff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}

      {/* Пунктир до прогноза и сама точка — до кружков работ, чтобы кружок
          последней работы лёг поверх начала пунктира, а не наоборот. */}
      {fPt && pts.length > 0 && (
        <g>
          <path d={`M${pts[pts.length - 1].x},${pts[pts.length - 1].y} L${fPt.x},${fPt.y}`}
            fill="none" stroke="#ff9500" strokeWidth="2.2" strokeDasharray="6 5" strokeLinecap="round" />
          <circle cx={fPt.x} cy={fPt.y} r="5.5" fill="#ff9500" />
          <text x={fPt.x} y={fPt.y - 14} textAnchor="middle" fontSize="13" fontWeight="600" fill="#ff9500">
            ≈{forecast.total}
          </text>
          <text x={fPt.x} y={H - 9} textAnchor="middle" fontSize="11" fill="#ff9500">
            экзамен
          </text>
        </g>
      )}

      {pts.map((p, i) => (
        <g key={i}>
          {/* На длинной истории точки мельче, а подписи стоят только у первой,
              последней и лучшей работы. Двадцать чисел над двадцатью точками
              спорят с линией: график перестаёт читаться как линия и становится
              таблицей, набранной по диагонали. */}
          <circle cx={p.x} cy={p.y} r={dense ? 3.6 : 5.5} fill="#ffffff" stroke="#007aff" strokeWidth={dense ? 1.8 : 2.4} />
          {(!dense || i === 0 || i === pts.length - 1 || i === bestIdx) && (
          <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" className="text-gray-800">
            {p.row.total}
          </text>
          )}
          {/* Дата последней работы у правого края уступает место подписи
              «экзамен»: обе стоят в 30 пикселях друг от друга и налезают. */}
          {(i % everyNth === 0 || (i === pts.length - 1 && !fPt)) && (
            <text x={p.x} y={H - 9} textAnchor="middle" fontSize="11" fill="currentColor" className="text-gray-400">
              {new Date(p.row.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Готовность к экзамену
// ─────────────────────────────────────────────────────────────────────────────

// Главное число раздела: где ученик сейчас и куда придёт к экзамену по своему
// же темпу. Стоит первым, до вкладок с работами, — за ним и приходят.
//
// ЧИСЛА НЕ ПРИУКРАШИВАЮТСЯ. Прогноз — продолжение уже наблюдаемой линии, и
// когда данных мало, вместо числа стоит объяснение, почему его нет: «примерно
// 80» по двум работам родитель прочтёт как обещание.
export default function ExamProgress({ student, stats, attempts }) {
  const examType = examTypeOf(student, stats)

  // Работы приводим к шкале НАСТОЯЩЕГО экзамена: наш вариант почти всегда
  // короче полного КИМ, и 17 из 17 в укороченном КЕГЭ — это не 17 первичных на
  // экзамене. Пересчёт по доле выполнения уже сделан в examResult, здесь мы им
  // просто пользуемся, иначе прогноз и точки графика жили бы в разных шкалах.
  const rows = useMemo(
    () => stats.rows.map((r) => ({ ...r, total: r.res?.scaledPrimary ?? r.total })),
    [stats.rows],
  )

  // Цель ученика записана в тех единицах, в каких её спрашивают: у ЕГЭ это
  // тестовый балл, у ОГЭ — отметка. Прогноз считается в первичных, поэтому
  // цель переводится в них (см. parseTarget) — иначе «85» у профиля молча
  // отбрасывалось как «больше максимума», а «5» у ОГЭ рисовалось линией на
  // пяти баллах из тридцати одного.
  const goal = useMemo(() => parseTarget(examType, student.targetScore), [examType, student.targetScore])

  const f = useMemo(() => examForecast(rows, {
    examType,
    target: goal.primary,
    examDate: student.examDate || null,
  }), [rows, goal.primary, student.examDate, examType])

  // Где теряется больше всего баллов: цена номера на экзамене, умноженная на
  // долю неверных ответов. Это и есть ответ на вопрос «а что делать» — без него
  // блок сообщает диагноз и молчит о лечении.
  const leaks = useMemo(() => {
    const by = {}
    for (const r of aggregateAttempts((attempts || []).filter((a) => a.exam_type === examType))) {
      const cur = by[r.number] || { number: r.number, attempts: 0, correct: 0 }
      cur.attempts += r.attempts
      cur.correct += r.correct
      by[r.number] = cur
    }
    return Object.values(by)
      // По одному-двум ответам вывода нет: тот же порог, что у карты заданий.
      .filter((r) => r.attempts >= 3)
      .map((r) => ({ ...r, lost: taskMaxOf(examType, r.number) * (1 - r.correct / r.attempts) }))
      .filter((r) => r.lost > 0.5)
      .sort((a, b) => b.lost - a.lost)
      .slice(0, 2)
  }, [attempts, examType])

  // Длинную историю показываем с КОНЦА: свежие работы и прогноз — то, ради чего
  // сюда смотрят, а начало года листается назад по желанию.
  const scrollRef = useRef(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [stats.rows.length])

  if (!stats.hasData) return null
  const { now, forecast, target, pass, max, perWeek } = f

  // ЕДИНИЦЫ ПОКАЗА. На ЕГЭ говорят «85 баллов» — это ВТОРИЧНЫЙ (тестовый)
  // балл, а первичный нужен только для арифметики: он линеен, поэтому темп и
  // прогноз считаются по нему, и лишь готовый ответ переводится таблицей.
  // У ОГЭ и базового ЕГЭ вторичного балла не бывает вовсе: там отметка, и
  // шкалой она быть не может (пять значений вместо тридцати одного) — поэтому
  // числа остаются первичными, а отметка стоит рядом отдельной строкой.
  const isTest = scaleOf(examType)?.kind === "test"
  const show = (primary) => (primary == null ? null : isTest ? testScoreOf(examType, primary) : primary)
  const showMax = isTest ? 100 : max
  const unitName = isTest ? "тестовых" : "первичных"
  // Цель показываем РОВНО ТОЙ, какой её ввели. Обратный перевод через первичный
  // балл её сдвигает: цель «85» — это 20 первичных, а 20 первичных дают уже 86,
  // и на экране появлялась цифра, которой никто не задавал.
  const targetShown = target > 0 ? (goal.unit === "test" ? goal.value : show(target)) : 0
  const examDay = student.examDate
    ? new Date(student.examDate + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    : ""

  // Главное число блока. Прогноз важнее текущего балла: за ним сюда и приходят,
  // а «сейчас» ученик и так видит в своей последней работе.
  const headline = forecast != null ? forecast : now
  const headlineIsForecast = forecast != null

  // Итог одной фразой. Порядок ответов: не сдаёт → не дотягивает до цели →
  // дотягивает. Показываем ОДИН, самый весомый.
  // Разница считается в тех же единицах, что и показанные числа: «до цели не
  // хватает трёх» рядом с тестовыми баллами обязано означать три тестовых.
  let verdict = null
  if (forecast != null) {
    const fs = show(forecast)
    const goalName = goal.unit === "grade" ? `до отметки ${goal.value}` : "до цели"
    if (pass > 0 && forecast < pass) {
      const d = Math.max(0, show(pass) - fs)
      verdict = { tone: "red", text: `До порога сдачи не хватает ${d} ${plural(d, "балла", "баллов", "баллов")}` }
    } else if (target > 0 && forecast < target) {
      const d = Math.max(0, targetShown - fs)
      verdict = { tone: "amber", text: `Не хватает ${d} ${plural(d, "балла", "баллов", "баллов")} ${goalName}` }
    } else if (target > 0) {
      const d = Math.max(0, fs - targetShown)
      verdict = { tone: "green", text: d > 0 ? `Цель берётся с запасом в ${d} ${plural(d, "балл", "балла", "баллов")}` : "Цель берётся ровно" }
    }
  }
  const TONE_TEXT = {
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-700 dark:text-amber-300",
    green: "text-green-700 dark:text-green-400",
  }

  return (
    <div className="glass-sm p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <span className="text-sm font-medium">Готовность к экзамену</span>
        {examDay && <span className="text-[11px] text-gray-400">экзамен {examDay}</span>}
      </div>

      <div className="grid md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-4 md:gap-5 items-start">
        {/* Слева — ответ, справа — обоснование. Раньше было наоборот: график
            занимал две трети ширины, а число, ради которого блок существует,
            стояло мелкой строчкой сбоку среди трёх таких же. */}
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-[42px] leading-none font-semibold tabular-nums ${headlineIsForecast ? "text-amber-600 dark:text-amber-400" : ""}`}>
                {headlineIsForecast && <span className="text-2xl font-normal align-top opacity-60">≈</span>}
                {show(headline)}
              </span>
              <span className="text-base text-gray-400 font-medium">из {showMax}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1.5">
              {headlineIsForecast
                ? `прогноз к ${examDay || "экзамену"} · сейчас ${show(now)}`
                : "последняя работа"}
            </div>
            {/* Первичный балл — то, из чего вторичный получен. Он нужен: работы
                проверяются в первичных, и без этой строки репетитор не свяжет
                «95» на экране с «25 из 33» в проверенной работе. У экзамена с
                отметкой второй строкой стоит сама отметка. */}
            <div className="text-[11px] text-gray-400 mt-1">
              {isTest
                ? `${headlineIsForecast ? "≈" : ""}${headline} из ${max} первичных`
                : `отметка ${headlineIsForecast ? "≈" : ""}${gradeOf(examType, headline) ?? "—"}`}
            </div>
          </div>

          <ReadinessScale now={show(now)} forecast={show(forecast)} target={targetShown}
            pass={show(pass)} max={showMax}
            targetLabel={goal.unit === "grade" ? `цель — отметка ${goal.value}` : null} />

          {verdict && <div className={`text-sm font-medium leading-snug ${TONE_TEXT[verdict.tone]}`}>{verdict.text}</div>}

          <div className="flex flex-col gap-1 text-xs text-gray-500">
            {/* Темп ВСЕГДА в первичных: тестовый балл растянут таблицей
                перевода, и «+0,7 тестового в неделю» означало бы разное в
                разных местах шкалы. Поэтому единица названа явно. */}
            {perWeek != null && <div>Темп {fmtPace(perWeek)} {unitName === "тестовых" ? "(первичных)" : ""}</div>}
            {/* Единственная строка блока, которая говорит, ЧТО ДЕЛАТЬ. Считается
                по цене задания на экзамене, а не по проценту: 40% на задании в
                четыре балла стоят дороже, чем 10% на задании в один. */}
            {leaks.length > 0 && (
              <div>
                Больше всего баллов теряется на {leaks.map((r) => `№${r.number}`).join(" и ")}
              </div>
            )}
          </div>

          {/* Откуда взялось число. Без этой строки прогноз выглядит взятым с
              потолка — и ему либо верят слишком сильно, либо не верят вовсе. */}
          {f.note && <p className="text-[11px] text-gray-400 leading-relaxed">{f.note}</p>}
        </div>

        <div className="min-w-0">
          {stats.rows.length >= 2 ? (
            <div ref={scrollRef} className="overflow-x-auto">
              {/* Полотно растёт с числом работ: двадцать точек, втиснутые в
                  ширину телефона, дают нечитаемую кашу из подписей. */}
              <div style={{ minWidth: Math.max(360, rows.length * 30) }}>
                <ScoreChart rows={rows.map((r) => ({ ...r, total: show(r.total) }))} max={showMax}
                  target={targetShown} pass={show(pass)}
                  forecast={forecast != null ? { total: show(forecast) } : null} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">График появится со второй работы: по одной точке линии нет.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Шкала готовности: весь экзамен от нуля до максимума одной полосой. Отвечает
// на вопрос «где мы» быстрее графика — тот показывает ПУТЬ, а полоса ПОЛОЖЕНИЕ,
// и это разные вопросы.
//
// Заливка сплошная до нынешнего балла и полупрозрачная до прогноза: видно и
// то, что уже есть, и то, что только ожидается, — и второе не выдаётся за
// первое. Порог и цель стоят засечками прямо на полосе, потому что смысл у них
// позиционный: важно не «цель 28», а «цель вот здесь, а мы вот тут».
export function ReadinessScale({ now, forecast, target, pass, max, targetLabel = null }) {
  const at = (v) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`
  const ahead = forecast != null && forecast > now
  return (
    <div className="pt-1">
      <div className="relative h-2.5 rounded-full bg-blue-500/12">
        {ahead && (
          <div className="absolute inset-y-0 left-0 rounded-full bg-amber-400/35" style={{ width: at(forecast) }} />
        )}
        <div className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: at(now), background: "linear-gradient(90deg,#007aff,#5ac8fa)" }} />
        {pass > 0 && pass < max && (
          <span className="absolute -top-0.5 -bottom-0.5 w-px bg-gray-400/70" style={{ left: at(pass) }} />
        )}
        {target > 0 && target <= max && (
          <span className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-green-500" style={{ left: at(target) }} />
        )}
      </div>
      <div className="relative h-4 mt-1 text-[10px] text-gray-400">
        {pass > 0 && pass < max && (
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: at(pass) }}>порог {pass}</span>
        )}
        {target > 0 && target <= max && (
          <span className="absolute -translate-x-1/2 whitespace-nowrap text-green-600 dark:text-green-400" style={{ left: at(target) }}>
            {targetLabel || `цель ${target}`}
          </span>
        )}
      </div>
    </div>
  )
}
