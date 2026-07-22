import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import Icon from "./Icon"

const EXAM_OPTIONS = [
  { id: "ОГЭ", label: "ОГЭ", iconName: "file-text" },
  { id: "ЕГЭ", label: "ЕГЭ", iconName: "book" },
  { id: "Успеваемость", label: "Успеваемость", iconName: "trending-up" },
]
const GRADE_OPTIONS = ["7", "8", "9", "10", "11"]
// Лого предмета — линейные иконки со своим цветом (полные классы Tailwind,
// иначе цвет не попадёт в сборку).
const SUBJECTS = [
  { name: "Математика", icon: "ruler", color: "text-blue-600" },
  { name: "Информатика", icon: "code", color: "text-indigo-600" },
  { name: "Физика", icon: "atom", color: "text-cyan-600" },
  { name: "Русский язык", icon: "type", color: "text-red-600" },
  { name: "Английский язык", icon: "globe", color: "text-emerald-600" },
  { name: "Химия", icon: "flask", color: "text-teal-600" },
  { name: "Обществознание", icon: "users", color: "text-amber-600" },
  { name: "Биология", icon: "leaf", color: "text-green-600" },
  { name: "География", icon: "map", color: "text-orange-600" },
  { name: "История", icon: "columns", color: "text-rose-600" },
  { name: "Литература", icon: "book", color: "text-purple-600" },
  { name: "Другое", icon: "edit", color: "text-gray-500" },
]

function PillGroup({ options, value, onChange, autoFocus }) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {options.map((opt, i) => {
        const id = opt.id ?? opt
        const label = opt.label ?? opt
        const selected = value === id
        return (
          <button key={id} type="button" onClick={() => onChange(id)}
            style={{ animationDelay: `${i * 35}ms` }}
            className={`pill-pop flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 active:scale-95 ${
              selected
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

function StudentOnboardingModal({ studentId, onComplete, demo = false }) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState("forward")
  const [exam, setExam] = useState(null)
  const [grade, setGrade] = useState(null)
  const [target, setTarget] = useState("")
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [customSubject, setCustomSubject] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const advanceTimer = useRef(null)

  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  // Класс спрашиваем ТОЛЬКО при подготовке к успеваемости; для ОГЭ/ЕГЭ он не нужен.
  const isPerf = exam === "Успеваемость"
  // Балл (0–100) — только у ЕГЭ; у ОГЭ и успеваемости цель — оценка (2–5).
  const isScore = exam === "ЕГЭ"
  const STEPS = [
    { key: "exam", icon: "target", title: "Какая у тебя цель?" },
    ...(isPerf ? [{ key: "grade", icon: "user-graduate", title: "В каком ты классе?" }] : []),
    { key: "target", icon: "trending-up", title: isScore ? "Какая цель по баллам?" : "Какую оценку хочешь?" },
    { key: "subjects", icon: "book", title: "Какие предметы изучаешь?" },
  ]
  const safeStep = Math.min(step, STEPS.length - 1)
  const current = STEPS[safeStep]
  const isLast = safeStep === STEPS.length - 1

  function goTo(nextStep, dir) {
    setDirection(dir)
    setStep(Math.max(0, nextStep))
  }
  function autoAdvance() {
    clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      setDirection("forward")
      setStep((s) => s + 1)
    }, 320)
  }
  function handleSelectExam(val) { setExam(val); setGrade(null); autoAdvance() }
  function handleSelectGrade(val) { setGrade(val); autoAdvance() }

  function toggleSubject(name) {
    setSelectedSubjects((prev) => prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name])
  }

  function collectSubjects() {
    const list = selectedSubjects.filter((s) => s !== "Другое")
    if (selectedSubjects.includes("Другое") && customSubject.trim()) list.push(customSubject.trim())
    return list
  }

  async function finish() {
    const subjects = collectSubjects()
    const payload = {
      exam_goal: exam,
      grade: isPerf && grade ? Number(grade) : null,
      target_score: target ? Number(target) : null,
      subjects,
      onboarded: true,
    }
    // Предметы храним локально — привязка к репетитору по коду происходит уже
    // в кабинете (заметный блок), и там предмет подставляется из этого выбора.
    try { localStorage.setItem(`student_subjects_${studentId}`, JSON.stringify(subjects)) } catch { /* переполнение localStorage не критично */ }
    if (demo) { onComplete(payload); return }
    setSaving(true)
    const { error: err } = await supabase.from("student_accounts").update({
      exam_goal: exam,
      grade: isPerf && grade ? Number(grade) : null,
      target_score: target ? Number(target) : null,
      onboarded: true,
    }).eq("id", studentId)
    setSaving(false)
    if (err) { setError("Не удалось сохранить: " + err.message); return }
    onComplete(payload)
  }

  return createPortal(
    <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
      <div className="glass-modal w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 pt-5 pb-1 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => goTo(step - 1, "back")} disabled={safeStep === 0}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-0 disabled:pointer-events-none transition-all active:scale-90">
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="text-xs font-medium text-gray-400">Шаг {safeStep + 1} из {STEPS.length}</span>
            <span className="w-7" />
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full bg-blue-600 rounded-full transition-transform duration-300 ease-out origin-left ${i <= safeStep ? "scale-x-100" : "scale-x-0"}`} />
              </div>
            ))}
          </div>
        </div>

        <div key={current.key} className={`px-6 pt-6 pb-7 flex-1 overflow-y-auto min-h-0 ${direction === "forward" ? "step-enter-forward" : "step-enter-back"}`}>
          <div className="flex flex-col items-center text-center gap-1 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
              <Icon name={current.icon} size={22} />
            </div>
            <h2 className="text-base font-medium">{current.title}</h2>
            {current.key === "exam" && <p className="text-xs text-gray-400">Настроим кабинет под тебя</p>}
          </div>

          {current.key === "exam" && (
            <PillGroup options={EXAM_OPTIONS} value={exam} onChange={handleSelectExam} autoFocus />
          )}

          {current.key === "grade" && (
            <PillGroup options={GRADE_OPTIONS} value={grade} onChange={handleSelectGrade} autoFocus />
          )}

          {current.key === "target" && (
            <div className="flex flex-col items-center gap-4">
              <input
                type="number" inputMode="numeric" value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={isScore ? "например, 85" : "например, 5"}
                autoFocus
                className="input-glass max-w-[180px] text-left text-lg" />
              <p className="text-xs text-gray-400">{isScore ? "Тестовый балл (0–100)" : "Желаемая оценка (2–5)"}</p>
              <button onClick={() => goTo(step + 1, "forward")} className="btn-primary px-6 py-2 active:scale-95 transition-transform">
                Далее
              </button>
            </div>
          )}

          {current.key === "subjects" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-400 text-center -mt-3">Выбери один или несколько — репетитора привяжешь в кабинете сразу после анкеты.</p>

              <div className="grid grid-cols-3 gap-2">
                {SUBJECTS.map((s, i) => {
                  const selected = selectedSubjects.includes(s.name)
                  return (
                    <button key={s.name} type="button" onClick={() => toggleSubject(s.name)}
                      style={{ animationDelay: `${i * 25}ms` }}
                      className={`pill-pop flex flex-col items-center justify-center gap-1.5 rounded-xl border py-3 transition-all duration-200 active:scale-95 ${
                        selected ? "border-blue-600 bg-blue-50 shadow-sm shadow-blue-500/20" : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                      }`}>
                      <Icon name={s.icon} size={22} className={s.color} />
                      <span className={`text-[11px] leading-tight text-center ${selected ? "text-blue-700 font-medium" : "text-gray-600"}`}>{s.name}</span>
                    </button>
                  )
                })}
              </div>
              {selectedSubjects.includes("Другое") && (
                <input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="Какой предмет?" className="input-glass text-center" />
              )}
              {error && <div className="text-xs text-red-500 text-center">{error}</div>}
            </div>
          )}
        </div>

        {isLast && (
          <div className="px-6 pb-6 pt-1 flex-shrink-0">
            <button onClick={finish} disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50 active:scale-[0.99] transition-transform">
              {saving ? "Сохраняем..." : "Готово"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default StudentOnboardingModal
