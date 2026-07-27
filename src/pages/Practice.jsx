import { useState, useEffect, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import Icon from "../components/Icon"
import { renderTaskMath } from "../utils"
import { COURSES } from "./practiceCourses.jsx"

// Условия/варианты проходят через тот же рендер, что и банк заданий,
// поэтому дроби идут столбиком, а корень — с чертой.
const M = ({ t, className, block }) => {
  const Tag = block ? "div" : "span"
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: renderTaskMath(String(t ?? "")) }} />
}

// ── прогресс ученика ─────────────────────────────────────────────────────
// Хранится локально: практика — тренажёр, а не оценка, синхронизация с
// Supabase тут не нужна (и не требует новых таблиц/RLS).

const EMPTY = { done: {}, xp: 0, streak: { n: 0, last: null } }
const key = (uid) => `practice_progress_${uid}`
const today = () => new Date().toISOString().slice(0, 10)

function loadProgress(uid) {
  try {
    const raw = JSON.parse(localStorage.getItem(key(uid)))
    if (!raw || typeof raw !== "object") return EMPTY
    return { ...EMPTY, ...raw, done: raw.done || {}, streak: raw.streak || EMPTY.streak }
  } catch { return EMPTY }
}

function bumpStreak(streak) {
  const t = today()
  if (streak.last === t) return streak
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  return { n: streak.last === yest ? streak.n + 1 : 1, last: t }
}

// ── мелкие детали интерфейса ─────────────────────────────────────────────

function Ring({ value, size = 44, stroke = 4, color = "#007AFF" }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
        stroke="currentColor" className="text-gray-200 dark:text-white/10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={color}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)}
        style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.34,1.4,0.64,1)" }} />
    </svg>
  )
}

// На узком экране плитка складывается в столбик и подпись переносится:
// в строку («иконка — значение — подпись») на 375px она обрезалась.
function StatChip({ icon, value, label, color }) {
  return (
    <div className="flex flex-col items-center text-center gap-1 sm:flex-row sm:text-left sm:gap-2.5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ color, backgroundColor: color + "1f" }}>
        <Icon name={icon} size={18} />
      </div>
      <div>
        <div className="text-base font-semibold text-gray-800 leading-tight tabular-nums">{value}</div>
        <div className="text-[11px] text-gray-400 leading-tight">{label}</div>
      </div>
    </div>
  )
}

// ── экран 1: список курсов ───────────────────────────────────────────────

function Hub({ progress, onOpenCourse }) {
  const totalLessons = COURSES.reduce((s, c) => s + c.lessons.length, 0)
  const doneCount = Object.keys(progress.done).length

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-800">Практика</h1>
        <p className="text-sm text-gray-500 mt-1">
          Короткие интерактивные уроки: крутите, двигайте, пробуйте — и сразу видите, что получилось.
        </p>
      </div>

      <div className="glass p-4 mb-6 grid grid-cols-3 gap-3 sm:flex sm:items-center sm:gap-8">
        <StatChip icon="sparkles" value={progress.xp} label="очков опыта" color="#007AFF" />
        <StatChip icon="target" value={progress.streak.n} label="дней подряд" color="#ff9f0a" />
        <StatChip icon="check" value={`${doneCount} / ${totalLessons}`} label="уроков пройдено" color="#30d158" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {COURSES.map((course) => {
          const done = course.lessons.filter((l) => progress.done[l.id]).length
          const ratio = done / course.lessons.length
          return (
            <button
              key={course.id}
              onClick={() => onOpenCourse(course.id)}
              className="press-fill glass p-4 text-left flex items-center gap-4 w-full"
            >
              <div className="relative flex-shrink-0">
                <Ring value={ratio} size={52} stroke={4} color={course.tint} />
                <div className="absolute inset-0 flex items-center justify-center" style={{ color: course.tint }}>
                  <Icon name={course.icon} size={22} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-gray-800 truncate">{course.title}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{course.subtitle}</div>
                <div className="text-[11px] text-gray-400 mt-1.5">
                  {done === course.lessons.length
                    ? "Курс пройден"
                    : `${done} из ${course.lessons.length} уроков`}
                </div>
              </div>
              <span className="text-gray-300 flex-shrink-0"><Icon name="chevron-right" size={20} /></span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── экран 2: путь уроков внутри курса ────────────────────────────────────

function CoursePath({ course, progress, onBack, onStart }) {
  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack}
        className="press-tap inline-flex items-center gap-1 text-sm text-gray-500 mb-4 -ml-1 px-2 py-2 rounded-lg">
        <Icon name="chevron-left" size={16} /> Все курсы
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ color: course.tint, backgroundColor: course.tint + "1f" }}>
          <Icon name={course.icon} size={24} />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-gray-800">{course.title}</h2>
          <p className="text-sm text-gray-500">{course.subtitle}</p>
        </div>
      </div>

      <div className="relative">
        {course.lessons.map((lesson, i) => {
          const isDone = !!progress.done[lesson.id]
          const unlocked = i === 0 || !!progress.done[course.lessons[i - 1].id]
          const last = i === course.lessons.length - 1
          return (
            <div key={lesson.id} className="relative flex gap-4 pb-4">
              {!last && (
                <span className="absolute left-[21px] top-11 bottom-0 w-0.5 rounded"
                  style={{ backgroundColor: isDone ? course.tint : "rgba(120,120,128,0.28)" }}
                  aria-hidden="true"
                />
              )}
              <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center z-[1] border-2"
                style={{
                  borderColor: isDone || unlocked ? course.tint : "transparent",
                  backgroundColor: isDone ? course.tint : unlocked ? course.tint + "1f" : "rgba(120,120,128,0.12)",
                  color: isDone ? "#fff" : unlocked ? course.tint : "#98989f",
                }}>
                <Icon name={isDone ? "check" : unlocked ? "sparkles" : "clipboard"} size={19} />
              </div>
              <button
                onClick={() => unlocked && onStart(lesson.id)}
                disabled={!unlocked}
                className={`press-fill glass p-4 flex-1 text-left flex items-center gap-3 ${
                  unlocked ? "" : "opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-gray-800">{lesson.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{lesson.blurb}</div>
                  <div className="text-[11px] text-gray-400 mt-1.5">
                    {lesson.steps.length} шагов{isDone ? " · пройден" : unlocked ? "" : " · откроется дальше"}
                  </div>
                </div>
                {unlocked && (
                  <span className="text-xs font-medium px-3 py-1.5 rounded-full flex-shrink-0"
                    style={{ color: course.tint, backgroundColor: course.tint + "1f" }}>
                    {isDone ? "Повторить" : "Начать"}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── проверка ответа ──────────────────────────────────────────────────────

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x))

function isCorrect(step, ans) {
  switch (step.kind) {
    case "info": return true
    case "choice": return ans === step.correct
    case "hotspot": return ans === step.correct
    case "multi": return Array.isArray(ans) && sameSet(ans, step.correct)
    case "number": {
      const n = parseFloat(String(ans).replace(",", ".").trim())
      if (!Number.isFinite(n)) return false
      return Math.abs(n - step.correct) <= (step.tol ?? 1e-9)
    }
    case "explore": return !!ans && step.check(ans)
    case "order": return Array.isArray(ans) && ans.length === step.correct.length &&
      ans.every((x, i) => x === step.correct[i])
    default: return false
  }
}

function hasAnswer(step, ans) {
  switch (step.kind) {
    case "info": return true
    case "explore": return true
    case "multi": return Array.isArray(ans) && ans.length > 0
    case "order": return Array.isArray(ans) && ans.length === step.items.length
    case "number": return String(ans ?? "").trim() !== ""
    default: return ans != null
  }
}

function initialAnswer(step) {
  if (step.kind === "explore") return Object.fromEntries(step.controls.map((c) => [c.key, c.def]))
  if (step.kind === "multi" || step.kind === "order") return []
  if (step.kind === "number") return ""
  return null
}

// ── тела шагов ───────────────────────────────────────────────────────────

function Visual({ children }) {
  return (
    <div className="rounded-2xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/10 p-2 mb-4">
      <div className="w-full aspect-[4/3] max-h-[42vh] mx-auto">{children}</div>
    </div>
  )
}

function OptionButton({ label, state, onClick, disabled, multi }) {
  // state: idle | picked | right | wrong
  const tone = {
    idle: "border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] text-gray-800",
    picked: "border-[#007AFF] bg-[#007AFF]/10 text-gray-800",
    right: "border-[#30d158] bg-[#30d158]/12 text-gray-800",
    wrong: "border-[#ff453a] bg-[#ff453a]/12 text-gray-800",
  }[state]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={multi ? state === "picked" : undefined}
      className={`press-fill w-full min-h-[52px] px-4 py-3 rounded-2xl border text-left text-[15px] flex items-center gap-3 ${tone} ${
        state === "wrong" ? "shake-x" : ""
      }`}
    >
      <span className="flex-1"><M t={label} /></span>
      {state === "right" && <span className="text-[#30d158] flex-shrink-0"><Icon name="check" size={18} /></span>}
      {state === "wrong" && <span className="text-[#ff453a] flex-shrink-0"><Icon name="x" size={18} /></span>}
    </button>
  )
}

function Slider({ ctrl, value, onChange }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-xs font-medium text-gray-500">{ctrl.label}</span>
        <span className="text-sm font-semibold tabular-nums" style={{ color: "#007AFF" }}>
          {String(value).replace(".", ",")}
        </span>
      </div>
      <input
        type="range"
        className="practice-range"
        min={ctrl.min} max={ctrl.max} step={ctrl.step} value={value}
        aria-label={ctrl.label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

function StepBody({ step, ans, setAns, phase }) {
  const locked = phase === "right" || phase === "revealed"
  const showAnswer = phase === "right" || phase === "revealed"

  if (step.kind === "info") {
    return (
      <>
        {step.visual && <Visual>{step.visual({})}</Visual>}
        <h3 className="text-xl font-semibold text-gray-800 mb-2">{step.title}</h3>
        <M block className="text-[15px] text-gray-600 leading-relaxed" t={step.body} />
      </>
    )
  }

  if (step.kind === "explore") {
    const readout = step.readout ? step.readout(ans) : null
    return (
      <>
        <M block className="text-[15px] text-gray-700 leading-relaxed mb-2" t={step.prompt} />
        <div className="inline-flex items-start gap-2 text-[13px] font-medium mb-3 px-3 py-2 rounded-xl"
          style={{ color: "#007AFF", backgroundColor: "rgba(0,122,255,0.10)" }}>
          <span className="mt-[1px] flex-shrink-0"><Icon name="target" size={15} /></span>
          <span>{step.goalText}</span>
        </div>
        {step.visual && <Visual>{step.visual({ vals: ans })}</Visual>}
        {readout && (
          <div className="text-center text-sm text-gray-600 mb-4 tabular-nums" aria-live="polite">
            <M t={readout} />
          </div>
        )}
        <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] p-4">
          {step.controls.map((c) => (
            <Slider key={c.key} ctrl={c} value={ans[c.key]}
              onChange={(v) => !locked && setAns({ ...ans, [c.key]: v })} />
          ))}
        </div>
      </>
    )
  }

  if (step.kind === "hotspot") {
    return (
      <>
        <M block className="text-[15px] text-gray-700 leading-relaxed mb-3" t={step.prompt} />
        <div
          onClick={(e) => {
            if (locked) return
            const z = e.target.closest?.("[data-zone]")
            if (z) setAns(z.getAttribute("data-zone"))
          }}
        >
          <Visual>{step.visual({ selected: showAnswer ? step.correct : ans })}</Visual>
        </div>
        <div className="text-center text-sm text-gray-500">
          {ans ? step.zones.find((z) => z.id === (showAnswer ? step.correct : ans))?.label : "Нажмите на нужную сторону"}
        </div>
      </>
    )
  }

  if (step.kind === "order") {
    const placed = ans
    const pool = step.items.filter((it) => !placed.includes(it.id))
    const wrongAt = showAnswer ? placed.map((id, i) => id !== step.correct[i]) : []
    return (
      <>
        <M block className="text-[15px] text-gray-700 leading-relaxed mb-4" t={step.prompt} />
        <div className="flex flex-wrap items-center gap-2 mb-5 min-h-[56px] rounded-2xl border border-dashed
          border-gray-200 dark:border-white/15 p-2.5">
          {placed.length === 0 && (
            <span className="text-sm text-gray-400 px-1.5">Нажимайте карточки снизу — от меньшего к большему</span>
          )}
          {placed.map((id, i) => {
            const it = step.items.find((x) => x.id === id)
            const bad = wrongAt[i]
            return (
              <button key={id} type="button" disabled={locked}
                onClick={() => !locked && setAns(placed.filter((x) => x !== id))}
                className={`press-fill min-h-[44px] px-4 rounded-xl border text-[15px] flex items-center gap-2 ${
                  showAnswer
                    ? bad ? "border-[#ff453a] bg-[#ff453a]/12" : "border-[#30d158] bg-[#30d158]/12"
                    : "border-[#007AFF] bg-[#007AFF]/10"
                }`}>
                <span className="text-[11px] text-gray-400 tabular-nums">{i + 1}</span>
                <M t={it.label} />
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {pool.map((it) => (
            <button key={it.id} type="button" disabled={locked}
              onClick={() => setAns([...placed, it.id])}
              className="press-fill min-h-[44px] px-4 rounded-xl border border-gray-200 dark:border-white/10
                bg-white/70 dark:bg-white/[0.04] text-[15px] text-gray-800">
              <M t={it.label} />
            </button>
          ))}
          {pool.length === 0 && !showAnswer && (
            <span className="text-sm text-gray-400 px-1">Порядок собран — нажмите «Проверить»</span>
          )}
        </div>
        {showAnswer && (
          <div className="mt-4 text-sm text-gray-500">
            Верный порядок:{" "}
            {step.correct.map((id, i) => (
              <span key={id}>
                {i > 0 && " < "}
                <M t={step.items.find((x) => x.id === id).label} />
              </span>
            ))}
          </div>
        )}
      </>
    )
  }

  if (step.kind === "number") {
    return (
      <>
        {step.visual && <Visual>{step.visual({})}</Visual>}
        <M block className="text-[15px] text-gray-700 leading-relaxed mb-4" t={step.prompt} />
        <label className="block text-xs font-medium text-gray-500 mb-1.5" htmlFor="practice-num">Ваш ответ</label>
        <input
          id="practice-num"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={ans}
          disabled={locked}
          onChange={(e) => setAns(e.target.value)}
          className={`w-full min-h-[52px] px-4 rounded-2xl border text-[17px] tabular-nums bg-white/70
            dark:bg-white/[0.04] text-gray-800 outline-none transition-colors ${
            phase === "wrong" ? "border-[#ff453a] shake-x"
              : showAnswer ? "border-[#30d158]" : "border-gray-200 dark:border-white/10 focus:border-[#007AFF]"
          }`}
          placeholder="Например: 12,5"
        />
        {phase === "revealed" && (
          <div className="mt-2 text-sm text-gray-500">
            Правильный ответ: <b className="text-gray-700">{String(step.correct).replace(".", ",")}</b>
          </div>
        )}
      </>
    )
  }

  // choice / multi
  const multi = step.kind === "multi"
  const picked = multi ? ans : ans == null ? [] : [ans]
  const stateOf = (id) => {
    if (showAnswer) {
      const isRight = multi ? step.correct.includes(id) : step.correct === id
      if (isRight) return "right"
      return picked.includes(id) ? "wrong" : "idle"
    }
    if (phase === "wrong" && picked.includes(id)) return "wrong"
    return picked.includes(id) ? "picked" : "idle"
  }
  return (
    <>
      {step.visual && <Visual>{step.visual({})}</Visual>}
      <M block className="text-[15px] text-gray-700 leading-relaxed mb-1" t={step.prompt} />
      {multi && <div className="text-xs text-gray-400 mb-3">Можно выбрать несколько</div>}
      <div className="flex flex-col gap-2.5 mt-3">
        {step.options.map((o) => (
          <OptionButton key={o.id} label={o.label} multi={multi} state={stateOf(o.id)} disabled={locked}
            onClick={() => {
              if (locked) return
              if (multi) setAns(picked.includes(o.id) ? picked.filter((x) => x !== o.id) : [...picked, o.id])
              else setAns(o.id)
            }} />
        ))}
      </div>
    </>
  )
}

// ── экран 3: плеер урока ─────────────────────────────────────────────────

function Player({ lesson, tint, onExit, onFinish }) {
  const [idx, setIdx] = useState(0)
  const [ans, setAns] = useState(() => initialAnswer(lesson.steps[0]))
  const [phase, setPhase] = useState("answer") // answer | wrong | revealed | right
  const [attempts, setAttempts] = useState(0)
  const [clean, setClean] = useState(0) // сколько шагов взято с первой попытки
  const [finished, setFinished] = useState(false)

  const step = lesson.steps[idx]
  const total = lesson.steps.length

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onExit() }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev }
  }, [onExit])

  const check = useCallback(() => {
    if (step.kind === "info") { next(true); return }
    const ok = isCorrect(step, ans)
    if (ok) {
      setPhase("right")
      if (attempts === 0) setClean((c) => c + 1)
    } else if (attempts === 0) {
      setAttempts(1)
      setPhase("wrong")
    } else {
      setPhase("revealed")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ans, attempts])

  function next(silent) {
    if (idx + 1 >= total) {
      setFinished(true)
      onFinish({ clean: clean + (silent ? 1 : 0), total })
      return
    }
    const n = lesson.steps[idx + 1]
    setIdx(idx + 1)
    setAns(initialAnswer(n))
    setPhase("answer")
    setAttempts(0)
    if (silent) setClean((c) => c + 1)
  }

  const bar = (() => {
    if (phase === "right") return { tone: "right", title: "Верно!", text: step.explain, cta: idx + 1 >= total ? "Завершить" : "Дальше" }
    if (phase === "wrong") return { tone: "wrong", title: "Пока не то", text: "Посмотрите ещё раз — одна попытка есть.", cta: "Попробовать снова" }
    if (phase === "revealed") return { tone: "wrong", title: "Разбираем", text: step.explain, cta: idx + 1 >= total ? "Завершить" : "Дальше" }
    return null
  })()

  const ready = hasAnswer(step, ans)

  const body = finished ? (
    <Finish clean={clean} total={total} tint={tint} onExit={onExit} />
  ) : (
    <>
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pt-4 pb-6">
        <div key={idx} className="max-w-xl mx-auto step-enter">
          <StepBody step={step} ans={ans} setAns={setAns} phase={phase} />
        </div>
      </div>

      <div className={`practice-bar flex-shrink-0 ${bar ? (bar.tone === "right" ? "bar-right" : "bar-wrong") : ""}`}>
        <div className="max-w-xl mx-auto px-4 md:px-6 py-3.5">
          {bar && (
            <div className="flex items-start gap-2.5 mb-3" role="status" aria-live="polite">
              <span className="flex-shrink-0 mt-0.5" style={{ color: bar.tone === "right" ? "#30d158" : "#ff453a" }}>
                <Icon name={bar.tone === "right" ? "check" : "x"} size={20} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: bar.tone === "right" ? "#1c8a3c" : "#c4291f" }}>
                  {bar.title}
                </div>
                {bar.text && <M block className="text-[13px] text-gray-600 leading-snug mt-0.5" t={bar.text} />}
              </div>
            </div>
          )}
          <button
            onClick={() => {
              if (phase === "answer") check()
              else if (phase === "wrong") { setPhase("answer") }
              else next(false)
            }}
            disabled={phase === "answer" && !ready}
            className={`press-fill w-full min-h-[50px] rounded-2xl text-[16px] font-semibold text-white
              transition-opacity ${phase === "answer" && !ready ? "opacity-40 cursor-not-allowed" : ""}`}
            style={{
              background: bar?.tone === "wrong"
                ? "linear-gradient(180deg,#ff6961,#e0342a)"
                : bar?.tone === "right"
                  ? "linear-gradient(180deg,#34d95f,#22a344)"
                  : "linear-gradient(180deg,#0a84ff,#0060df)",
            }}
          >
            {bar ? bar.cta : step.kind === "info" ? "Понятно" : "Проверить"}
          </button>
        </div>
      </div>
    </>
  )

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col practice-shell">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 md:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <button onClick={onExit} aria-label="Закрыть урок"
          className="press-tap w-10 h-10 -ml-2 rounded-xl flex items-center justify-center text-gray-400">
          <Icon name="x" size={20} />
        </button>
        <div className="flex-1 flex gap-1.5" aria-label={`Шаг ${idx + 1} из ${total}`}>
          {lesson.steps.map((_, i) => (
            <span key={i} className="flex-1 h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-white/10">
              <span className="block h-full rounded-full origin-left"
                style={{
                  background: tint,
                  transform: `scaleX(${finished || i < idx ? 1 : i === idx ? 0.45 : 0})`,
                  transition: "transform 400ms cubic-bezier(0.34,1.3,0.64,1)",
                }} />
            </span>
          ))}
        </div>
        <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">{Math.min(idx + 1, total)}/{total}</span>
      </div>
      {body}
    </div>,
    document.body
  )
}

function Finish({ clean, total, tint, onExit }) {
  const pct = Math.round((clean / total) * 100)
  const great = pct >= 80
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div className="relative finish-pop">
        <Ring value={clean / total} size={132} stroke={10} color={tint} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-semibold text-gray-800 tabular-nums">{pct}%</span>
        </div>
      </div>
      {/* подпись под кольцом, а не внутри: внутри она не помещалась по ширине */}
      <p className="mt-2 mb-4 text-xs text-gray-400">
        шагов взято с первой попытки: {clean} из {total}
      </p>
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
        style={{ color: tint, backgroundColor: tint + "1f" }}>
        <Icon name={great ? "party" : "trending-up"} size={26} />
      </div>
      <h3 className="text-xl font-semibold text-gray-800">{great ? "Отличная работа!" : "Урок пройден"}</h3>
      <p className="text-sm text-gray-500 mt-1.5 max-w-xs">
        {great
          ? "Почти всё взяли сразу. Следующий урок уже открыт."
          : "Главное — разобрались. Урок можно повторить в любой момент."}
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-full"
        style={{ color: "#007AFF", backgroundColor: "rgba(0,122,255,0.12)" }}>
        <Icon name="sparkles" size={16} /> +{clean * 10 + total * 5} очков опыта
      </div>
      <button onClick={onExit}
        className="press-fill mt-7 w-full max-w-xs min-h-[50px] rounded-2xl text-[16px] font-semibold text-white"
        style={{ background: "linear-gradient(180deg,#0a84ff,#0060df)" }}>
        Готово
      </button>
    </div>
  )
}

// ── корневой компонент вкладки ───────────────────────────────────────────

function Practice({ userId }) {
  const [progress, setProgress] = useState(() => loadProgress(userId))
  const [courseId, setCourseId] = useState(null)
  const [playing, setPlaying] = useState(null) // lessonId

  const course = useMemo(() => COURSES.find((c) => c.id === courseId) || null, [courseId])
  const lesson = useMemo(
    () => COURSES.flatMap((c) => c.lessons).find((l) => l.id === playing) || null,
    [playing]
  )

  function persist(p) {
    setProgress(p)
    try { localStorage.setItem(key(userId), JSON.stringify(p)) } catch { /* приватный режим — не критично */ }
  }

  function finishLesson(lessonId, { clean, total }) {
    const gained = clean * 10 + total * 5
    persist({
      ...progress,
      xp: progress.xp + gained,
      streak: bumpStreak(progress.streak),
      done: { ...progress.done, [lessonId]: { clean, total, at: today() } },
    })
  }

  return (
    <>
      {course
        ? <CoursePath course={course} progress={progress} onBack={() => setCourseId(null)} onStart={setPlaying} />
        : <Hub progress={progress} onOpenCourse={setCourseId} />}

      {lesson && (
        <Player
          key={lesson.id}
          lesson={lesson}
          tint={course?.tint || "#007AFF"}
          onExit={() => setPlaying(null)}
          onFinish={(r) => finishLesson(lesson.id, r)}
        />
      )}
    </>
  )
}

export default Practice
