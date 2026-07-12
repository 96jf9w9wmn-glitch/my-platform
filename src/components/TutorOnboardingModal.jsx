import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import Icon from "./Icon"

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

const STEPS = [
  { key: "subject", icon: "book", title: "Какой предмет ты преподаёшь?" },
  { key: "experience", icon: "clock", title: "Какой у тебя стаж репетиторства?" },
  { key: "studentCountRange", icon: "users", title: "Сколько сейчас учеников?" },
  { key: "teachingFormat", icon: "video", title: "В каком формате занимаешься?" },
  { key: "examFocus", icon: "target", title: "К каким экзаменам готовишь?" },
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
  const [saving, setSaving] = useState(false)
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

  async function persist(fields) {
    setSaving(true)
    const { error } = await supabase.from("tutors").update({ ...fields, onboarding_completed: true }).eq("id", tutorId)
    setSaving(false)
    if (error) { alert("Не удалось сохранить: " + error.message); return }
    onComplete({ ...fields, onboarding_completed: true })
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
    })
  }

  const current = STEPS[step]

  return createPortal(
    <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
      <div className="glass-modal w-full max-w-md flex flex-col overflow-hidden">
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
            {step === 0 && <p className="text-xs text-gray-400">Поможет платформе подстроиться под тебя</p>}
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
            </div>
          )}
        </div>

        {isLast && (
          <div className="px-6 pb-6 pt-1 flex-shrink-0">
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
