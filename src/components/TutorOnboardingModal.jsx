import { useState, useRef, useEffect } from "react"
import { useClosing } from "../useClosing"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import Icon from "./Icon"
import { TUTOR_STEPS } from "../onboardingSteps"
import { TAX_MODES } from "../taxModes"

const SUBJECTS = ["Математика", "Русский язык", "Английский язык", "Физика", "Химия", "Обществознание", "Информатика", "Другое"]
const EXPERIENCE_OPTIONS = ["До 1 года", "1–3 года", "3–5 лет", "5+ лет"]
const STUDENT_COUNT_OPTIONS = ["1–3", "4–9", "10–20", "20+"]
const FORMAT_OPTIONS = [
  { id: "online", label: "Онлайн", iconName: "video" },
  { id: "offline", label: "Очно", iconName: "users" },
  { id: "mixed", label: "Смешанный", iconName: "repeat" },
]
const EXAM_FOCUS_OPTIONS = [
  { id: "ОГЭ", label: "ОГЭ", iconName: "file-text" },
  { id: "ЕГЭ", label: "ЕГЭ", iconName: "book" },
  { id: "Успеваемость", label: "Успеваемость", iconName: "trending-up" },
]

// Режим спрашиваем сразу при регистрации: от него зависит расчёт налога и
// чистой прибыли в «Финансах», а искать эту настройку потом никто не идёт.
const TAX_OPTIONS = Object.entries(TAX_MODES).map(([id, m]) => ({ id, label: m.label, hint: m.hint }))

const STEPS = [
  { key: "subject", icon: "book", title: "Какой предмет вы преподаёте?" },
  { key: "experience", icon: "clock", title: "Какой у вас стаж репетиторства?" },
  { key: "studentCountRange", icon: "users", title: "Сколько сейчас учеников?" },
  { key: "teachingFormat", icon: "video", title: "В каком формате занимаетесь?" },
  { key: "examFocus", icon: "target", title: "К каким экзаменам готовите?" },
  { key: "taxMode", icon: "ruble", title: "Как оформлена ваша деятельность?" },
]

function PillGroup({ options, value, onChange, multi = false, autoFocus }) {
  const isSelected = (id) => (multi ? value.includes(id) : value === id)
  function toggle(id) {
    if (!multi) return onChange(id)
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {options.map((opt, i) => {
        const id = opt.id ?? opt
        const label = opt.label ?? opt
        return (
          <button key={id} type="button" onClick={() => toggle(id)}
            style={{ animationDelay: `${i * 35}ms` }}
            className={`pill-pop flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
              isSelected(id)
                ? "bg-blue-600 text-white border-blue-600 scale-105 shadow-sm shadow-blue-500/30"
                : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
            }`}
            autoFocus={autoFocus && i === 0}>
            {opt.iconName && <Icon name={opt.iconName} size={14} />}{label}
          </button>
        )
      })}
    </div>
  )
}

function TutorOnboardingModal({ tutorId, onComplete }) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState("forward")
  const [subject, setSubject] = useState(null)
  const [customSubject, setCustomSubject] = useState("")
  const [experience, setExperience] = useState(null)
  const [studentCountRange, setStudentCountRange] = useState(null)
  const [teachingFormat, setTeachingFormat] = useState(null)
  const [examFocus, setExamFocus] = useState([])
  const [taxMode, setTaxMode] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  // Куда уйти после анкеты; закрывается плавно, как и остальные модалки.
  const finishRef = useRef(null)
  const { cls: closingCls, close } = useClosing(() => onComplete(finishRef.current?.fields, finishRef.current?.goTo))
  const leave = (fields, goTo) => { finishRef.current = { fields, goTo }; close() }
  // Анкета сохранена — вместо мгновенного закрытия показываем маршрут первого
  // занятия: сразу после регистрации кабинет пуст, и без подсказки непонятно,
  // с чего начинать. Те же три шага обещал лендинг (TUTOR_STEPS).
  const [done, setDone] = useState(null)   // сохранённые поля или null
  const advanceTimer = useRef(null)

  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  const isLast = step === STEPS.length - 1

  function goTo(nextStep, dir) {
    setDirection(dir)
    setStep(nextStep)
  }

  function autoAdvance() {
    clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      setDirection("forward")
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
    }, 320)
  }

  function handleSelectSubject(val) {
    setSubject(val)
    if (val !== "Другое") autoAdvance()
  }
  function handleSelectExperience(val) {
    setExperience(val)
    autoAdvance()
  }
  function handleSelectStudentCount(val) {
    setStudentCountRange(val)
    autoAdvance()
  }
  function handleSelectFormat(val) {
    setTeachingFormat(val)
    autoAdvance()
  }

  // Налоговый режим живёт не в анкете тьютора, а в tutor_finance_settings —
  // там же, откуда его читают «Финансы», поэтому пишем отдельной строкой.
  // Ошибку глушим: до прогона finance.sql таблицы может не быть, и это не
  // повод не пустить репетитора в кабинет — режим переключается в «Финансах».
  async function persistTax(mode) {
    if (!mode) return
    try {
      await supabase.from("tutor_finance_settings").upsert({
        tutor_id: tutorId,
        tax_mode: mode,
        tax_rate: TAX_MODES[mode].rate,
        updated_at: new Date().toISOString(),
      })
    } catch { /* таблицы ещё нет — молча */ }
  }

  async function persist(fields, mode) {
    setSaving(true)
    const { error } = await supabase.from("tutors").update({ ...fields, onboarding_completed: true }).eq("id", tutorId)
    if (!error) await persistTax(mode)
    setSaving(false)
    if (error) { setSaveError("Не удалось сохранить: " + error.message); return }
    setDone({ ...fields, onboarding_completed: true })
  }

  function handleSkip() {
    clearTimeout(advanceTimer.current)
    persist({})
  }

  function handleFinish() {
    persist({
      subject: subject === "Другое" ? (customSubject.trim() || "Другое") : subject,
      experience,
      student_count_range: studentCountRange,
      teaching_format: teachingFormat,
      exam_focus: examFocus,
    }, taxMode)
  }

  const current = STEPS[step]

  // Экран маршрута: анкета уже сохранена, дальше — куда идти в пустом кабинете
  if (done) {
    return createPortal(
      <div className={`fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 ${closingCls}`}>
        <div className={`glass-modal w-full max-w-md flex flex-col overflow-hidden step-enter-forward ${closingCls}`}>
          <div className="px-6 pt-7 pb-2 flex flex-col items-center text-center gap-1">
            <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-500/15 flex items-center justify-center text-green-600 dark:text-green-400 mb-2">
              <Icon name="check" size={22} />
            </div>
            <h2 className="font-display text-xl font-semibold">Готово, кабинет ваш</h2>
            <p className="text-xs text-gray-400">Три шага до первого занятия</p>
          </div>

          <div className="px-6 pt-4 pb-2 flex flex-col gap-2.5">
            {TUTOR_STEPS.map((s, i) => (
              <div key={s.t} className="flex gap-3 items-start" style={{ animationDelay: `${i * 70}ms` }}>
                <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br from-blue-500 to-blue-600 shadow shadow-blue-500/25">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{s.t}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 pb-6 pt-4 flex flex-col gap-2">
            <button onClick={() => leave(done, "students")}
              className="press-fill w-full h-[50px] rounded-full font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25 hover:opacity-95 transition-opacity">
              Пригласить первого ученика
            </button>
            <button onClick={() => leave(done)} className="press-fill w-full py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 transition-colors">
              Осмотрюсь сам
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className={`fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 ${closingCls}`}>
      <div className={`glass-modal w-full max-w-md flex flex-col overflow-hidden ${closingCls}`}>
        <div className="px-6 pt-5 pb-1 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => goTo(step - 1, "back")} disabled={step === 0}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-0 disabled:pointer-events-none transition-all">
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="text-xs font-medium text-gray-400">Шаг {step + 1} из {STEPS.length}</span>
            <button onClick={handleSkip} disabled={saving} className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50">
              Пропустить
            </button>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full bg-blue-600 rounded-full transition-transform duration-300 ease-out origin-left ${i <= step ? "scale-x-100" : "scale-x-0"}`} />
              </div>
            ))}
          </div>
        </div>

        <div key={step} className={`px-6 pt-6 pb-7 ${direction === "forward" ? "step-enter-forward" : "step-enter-back"}`}>
          <div className="flex flex-col items-center text-center gap-1 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
              <Icon name={current.icon} size={22} />
            </div>
            <h2 className="text-base font-medium">{current.title}</h2>
            {step === 0 && <p className="text-xs text-gray-400">Поможет платформе подстроиться под вас</p>}
          </div>

          {current.key === "subject" && (
            <div className="flex flex-col items-center gap-3">
              <PillGroup options={SUBJECTS} value={subject} onChange={handleSelectSubject} autoFocus />
              {subject === "Другое" && (
                <input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="Напиши какой" autoFocus
                  className="input-glass mt-1 max-w-xs text-center" />
              )}
              {subject === "Другое" && (
                <button onClick={() => goTo(step + 1, "forward")} disabled={!customSubject.trim()}
                  className="btn-primary px-6 py-2 mt-1 disabled:opacity-40">
                  Далее
                </button>
              )}
            </div>
          )}

          {current.key === "experience" && (
            <PillGroup options={EXPERIENCE_OPTIONS} value={experience} onChange={handleSelectExperience} autoFocus />
          )}

          {current.key === "studentCountRange" && (
            <PillGroup options={STUDENT_COUNT_OPTIONS} value={studentCountRange} onChange={handleSelectStudentCount} autoFocus />
          )}

          {current.key === "teachingFormat" && (
            <PillGroup options={FORMAT_OPTIONS} value={teachingFormat} onChange={handleSelectFormat} autoFocus />
          )}

          {current.key === "examFocus" && (
            <div className="flex flex-col items-center gap-4">
              <PillGroup options={EXAM_FOCUS_OPTIONS} value={examFocus} onChange={setExamFocus} multi autoFocus />
              <p className="text-xs text-gray-400">Можно выбрать несколько</p>
              {/* Выбор здесь множественный, поэтому сам шаг не перелистнётся */}
              <button onClick={() => goTo(step + 1, "forward")} className="btn-primary px-6 py-2">
                Далее
              </button>
            </div>
          )}

          {current.key === "taxMode" && (
            <div className="flex flex-col gap-2">
              {TAX_OPTIONS.map((opt, i) => (
                <button key={opt.id} type="button" onClick={() => setTaxMode(opt.id)}
                  style={{ animationDelay: `${i * 35}ms` }}
                  autoFocus={i === 0}
                  className={`pill-pop flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left border transition-all duration-200 ${
                    taxMode === opt.id
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30"
                      : "border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:border-gray-300"
                  }`}>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className={`block text-xs mt-0.5 ${taxMode === opt.id ? "text-white/70" : "text-gray-400"}`}>{opt.hint}</span>
                  </span>
                  {taxMode === opt.id && <Icon name="check" size={16} className="shrink-0" />}
                </button>
              ))}
              <p className="text-xs text-gray-400 text-center mt-2">
                Нужно, чтобы «Финансы» считали налог и чистый доход. Режим можно поменять там же.
              </p>
            </div>
          )}
        </div>

        {isLast && (
          <div className="px-6 pb-6 pt-1 flex-shrink-0">
            {saveError && <div className="text-sm text-red-500 mb-2 text-center">{saveError}</div>}
            <button onClick={handleFinish} disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
              {saving ? "Сохраняем..." : "Готово"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default TutorOnboardingModal
