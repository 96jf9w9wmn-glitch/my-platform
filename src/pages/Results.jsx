import { useState } from "react"
import { supabase } from "../supabase"
import Icon from "../components/Icon"
import Collapse from "../components/Collapse"
import { plural, getInitials } from "../utils"

function getOgeGrade(total, geomScore) {
  if (total < 8 || geomScore < 2) return 2
  if (total <= 14) return 3
  if (total <= 21) return 4
  return 5
}

const EGE_SCORES = [0,6,11,17,22,27,34,40,46,52,58,64,70,72,74,76,78,80,82,84,86,88,90,92,94,95,96,97,98,99,100,100,100]
function getEgeTestScore(primary) {
  return EGE_SCORES[Math.min(primary, EGE_SCORES.length - 1)] || 0
}

function MiniLineChart({ data, maxVal }) {
  if (data.length < 2) return null
  const w = 300
  const h = 100
  const pad = 10
  const xStep = (w - pad * 2) / (data.length - 1)
  const points = data.map((v, i) => ({
    x: pad + i * xStep,
    y: h - pad - ((v / maxVal) * (h - pad * 2)),
  }))
  const path = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ")
  const area = `${path} L${points[points.length - 1].x},${h - pad} L${points[0].x},${h - pad} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#grad)" />
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#3b82f6" />
      ))}
    </svg>
  )
}

const OGE_PART1_ALGEBRA = [1,2,3,4,5,6,7,8,9,10,11,12,13,14]
const OGE_PART1_GEOMETRY = [15,16,17,18,19]
const OGE_PART2_ALGEBRA = [20,21,22]
const OGE_PART2_GEOMETRY = [23,24,25]
const OGE_PART2_MAX = { 20: 2, 21: 2, 22: 3, 23: 2, 24: 2, 25: 3 }

function VariantRow({ variant: v }) {
  const isEge = v.type === "ЕГЭ"
  const [expanded, setExpanded] = useState(false)

  const correctAnswers = v.answers?.part1 || []
  const studentAnswers = v.submission?.part1_answers || []
  const part2Detail = v.submission?.part2_score_detail || {}

  return (
    <div className="border-t border-gray-100">
      <div
        className="grid grid-cols-6 px-4 py-3 text-sm items-center cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="col-span-2 text-gray-700 truncate flex items-center gap-2">
          <span className={`text-gray-400 text-xs inline-block transition-transform duration-300 ${expanded ? "rotate-90" : ""}`}>▶</span>
          {v.title}
        </span>
        <span>{v.part1} / {isEge ? 12 : 19}</span>
        <span>{v.part2} / {isEge ? 20 : 12}</span>
        <span className="font-medium">{v.total}</span>
        {isEge ? (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
            v.testScore >= 73 ? "bg-green-100 text-green-700" :
            v.testScore >= 50 ? "bg-amber-100 text-amber-700" :
            "bg-red-100 text-red-700"
          }`}>{v.testScore}</span>
        ) : (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
            v.grade >= 4 ? "bg-green-100 text-green-700" :
            v.grade === 3 ? "bg-amber-100 text-amber-700" :
            "bg-red-100 text-red-700"
          }`}>{v.grade}</span>
        )}
      </div>

      <Collapse open={expanded}>
        <div className="px-4 pb-4 glass-table-header border-t border-white/30">
          <div className="mb-3 mt-3">
            <div className="text-xs font-medium text-blue-600 mb-2 bg-blue-50 px-2 py-1 rounded inline-block">
              Алгебра — задания 1–14
            </div>
            <div className="grid grid-cols-7 gap-1 mt-2">
              {OGE_PART1_ALGEBRA.map((n) => {
                const i = n - 1
                const correct = correctAnswers[i]
                const student = studentAnswers[i]
                const isRight = correct && student && correct.trim() === student.trim()
                const isWrong = student && correct && correct.trim() !== student.trim()
                return (
                  <div key={n} className={`text-center rounded-lg py-1.5 text-xs ${
                    isRight ? "bg-green-100 text-green-700" :
                    isWrong ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-400"
                  }`}>
                    <div style={{fontSize: "10px"}} className="text-gray-400">{n}</div>
                    <div className="font-medium">{student || "—"}</div>
                    {isWrong && <div style={{fontSize: "9px"}} className="text-green-600">{correct}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mb-3">
            <div className="text-xs font-medium text-purple-600 mb-2 bg-purple-50 px-2 py-1 rounded inline-block">
              Геометрия — задания 15–19
            </div>
            <div className="grid grid-cols-5 gap-1 mt-2">
              {OGE_PART1_GEOMETRY.map((n) => {
                const i = n - 1
                const correct = correctAnswers[i]
                const student = studentAnswers[i]
                const isRight = correct && student && correct.trim() === student.trim()
                const isWrong = student && correct && correct.trim() !== student.trim()
                return (
                  <div key={n} className={`text-center rounded-lg py-1.5 text-xs ${
                    isRight ? "bg-green-100 text-green-700" :
                    isWrong ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-400"
                  }`}>
                    <div style={{fontSize: "10px"}} className="text-gray-400">{n}</div>
                    <div className="font-medium">{student || "—"}</div>
                    {isWrong && <div style={{fontSize: "9px"}} className="text-green-600">{correct}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Часть 2</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-blue-500 mb-1">Алгебра</div>
                {OGE_PART2_ALGEBRA.map((n) => (
                  <div key={n} className="flex justify-between text-xs py-1 border-b border-gray-100">
                    <span className="text-gray-500">Задание {n}</span>
                    <span className="font-medium">{part2Detail[n] || 0} / {OGE_PART2_MAX[n]}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs text-purple-500 mb-1">Геометрия</div>
                {OGE_PART2_GEOMETRY.map((n) => (
                  <div key={n} className="flex justify-between text-xs py-1 border-b border-gray-100">
                    <span className="text-gray-500">Задание {n}</span>
                    <span className="font-medium">{part2Detail[n] || 0} / {OGE_PART2_MAX[n]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Collapse>
    </div>
  )
}
function StudentResults({ student, variants, isEge }) {
  const studentVariants = variants.filter(
    (v) => v.submission?.status === "graded"
  ).map((v) => {
    const rowIsEge = (v.type || (isEge ? "ЕГЭ" : "ОГЭ")) === "ЕГЭ"
    return {
      title: v.title,
      type: v.type || (isEge ? "ЕГЭ" : "ОГЭ"),
      date: v.created_at,
      total: v.submission.total_score,
      part1: v.submission.part1_score,
      part2: v.submission.part2_score,
      geom: v.submission.geom_score || 0,
      grade: rowIsEge ? null : getOgeGrade(v.submission.total_score, v.submission.geom_score || 0),
      testScore: rowIsEge ? (v.submission.geom_score ?? getEgeTestScore(v.submission.total_score)) : null,
      answers: v.answers,
      submission: v.submission,
    }
  }).sort((a, b) => new Date(a.date) - new Date(b.date))

  if (studentVariants.length === 0) {
    return (
      <div className="text-sm text-gray-400 text-center py-12 border border-dashed border-gray-200 rounded-xl">
        Нет проверенных вариантов
      </div>
    )
  }

  const last = studentVariants[studentVariants.length - 1]
  const lastIsEge = last.type === "ЕГЭ"
  const maxPrimary = lastIsEge ? 32 : 31
  const avg = Math.round(studentVariants.reduce((s, v) => s + v.total, 0) / studentVariants.length)
  const best = Math.max(...studentVariants.map((v) => v.total))
  const targetScore = student.targetScore || maxPrimary

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1">Последний</div>
          <div className="text-2xl font-medium">{last.total}</div>
          {lastIsEge ? (
            <div className="text-xs text-blue-600 mt-0.5 font-medium">тест: {last.testScore}</div>
          ) : (
            <div className={`text-xs mt-0.5 font-medium ${
              last.grade >= 4 ? "text-green-600" : last.grade === 3 ? "text-amber-600" : "text-red-600"
            }`}>Оценка {last.grade}</div>
          )}
        </div>
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1">Средний</div>
          <div className="text-2xl font-medium">{avg}</div>
          <div className="text-xs text-gray-400 mt-0.5">{studentVariants.length} {plural(studentVariants.length, "вариант", "варианта", "вариантов")}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1">Лучший</div>
          <div className="text-2xl font-medium text-green-600">{best}</div>
          <div className="text-xs text-gray-400 mt-0.5">из {maxPrimary}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1">Цель</div>
          <div className="text-2xl font-medium text-blue-600">{targetScore}</div>
          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5">{last.total >= targetScore ? <><Icon name="check" size={10} />Достигнута</> : `осталось ${targetScore - last.total}`}</div>
        </div>
      </div>

      {studentVariants.length >= 2 && (
        <div className="glass p-4">
          <div className="text-sm font-medium mb-3">Динамика {lastIsEge ? "первичных" : ""} баллов</div>
          <MiniLineChart data={studentVariants.map((v) => v.total)} maxVal={maxPrimary} />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            {studentVariants.map((v, i) => (
              <span key={i}>{new Date(v.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
            ))}
          </div>
        </div>
      )}

      {student.targetScore && (
        <div className="glass p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Прогресс к цели</span>
            <span className="font-medium">{last.total} / {targetScore}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: Math.min((last.total / targetScore) * 100, 100) + "%" }}
            />
          </div>
        </div>
      )}

      <div className="glass overflow-hidden">
        <div className="grid grid-cols-6 px-4 py-2 glass-table-header text-xs text-gray-500 font-medium">
          <span className="col-span-2">Вариант</span>
          <span>Часть 1</span>
          <span>Часть 2</span>
          <span>{lastIsEge ? "Первичный" : "Итого"}</span>
          <span>{lastIsEge ? "Тестовый" : "Оценка"}</span>
        </div>
        {[...studentVariants].reverse().map((v, i) => (
          <VariantRow key={i} variant={v} />
        ))}
      </div>
    </div>
  )
}


// Синтезируем варианты из student.results[], если в Supabase нет данных
function synthesizeVariants(student) {
  const isEge = student.goal === "ЕГЭ"
  const now = Date.now()
  return student.results.map((total, i) => {
    const part1 = isEge
      ? Math.min(12, Math.round(total * 0.45))
      : Math.min(19, Math.round(total * 0.68))
    const part2 = Math.max(0, total - part1)
    const geomOrTest = isEge
      ? getEgeTestScore(total)
      : Math.max(2, Math.round(total * 0.22))
    return {
      title: `Вариант ${i + 1}`,
      type: isEge ? "ЕГЭ" : "ОГЭ",
      created_at: new Date(now - (student.results.length - i) * 14 * 24 * 60 * 60 * 1000).toISOString(),
      answers: { part1: [] },
      submission: {
        status: "graded",
        total_score: total,
        part1_score: part1,
        part2_score: part2,
        geom_score: geomOrTest,
        part1_answers: [],
        part2_score_detail: {},
      },
    }
  })
}

function Results({ students, user }) {
  const [selectedId, setSelectedId] = useState(null)
  const [variantsData, setVariantsData] = useState({})

  const examStudents = students.filter((s) => s.goal === "ОГЭ" || s.goal === "ЕГЭ")
  const otherStudents = students.filter((s) => s.goal === "Успеваемость" || !s.goal)
  const selected = students.find((s) => s.id === selectedId)

  async function handleSelect(student) {
    setSelectedId(student.id)
    if (variantsData[student.id]) return

    const { data: variants } = await supabase
      .from("variants")
      .select("*, variant_submissions(*)")
      .eq("tutor_id", user.id)

    const { data: studentAccounts } = await supabase
      .from("student_accounts")
      .select("id, name")
      .eq("tutor_id", user.id)

    const studentAccount = studentAccounts?.find(
      (a) => a.name?.toLowerCase() === student.name?.toLowerCase()
    )

    const studentSubs = (variants || []).map((v) => ({
      ...v,
      submission: (v.variant_submissions || []).find((s) =>
        studentAccount ? s.student_id === studentAccount.id : false
      ),
    })).filter((v) => v.submission?.status === "graded")

    // Fallback: synthesise variants from student.results[] if no Supabase data
    if (studentSubs.length === 0 && student.results?.length > 0) {
      setVariantsData((prev) => ({ ...prev, [student.id]: synthesizeVariants(student) }))
      return
    }

    setVariantsData((prev) => ({ ...prev, [student.id]: studentSubs }))
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-medium mb-6">Результаты</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1">
          {examStudents.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-400 uppercase mb-2">ОГЭ / ЕГЭ</div>
              <div className="flex flex-col gap-1">
                {examStudents.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelect(s)}
                    className={`no-press flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selectedId === s.id ? "glass-tint-blue" : "nav-item hover:bg-white/30 border border-transparent"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600 flex-shrink-0 overflow-hidden">
                      {s.avatar ? <img src={s.avatar} alt={s.name} className="w-full h-full object-cover" /> :
                        getInitials(s.name)}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.goal}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {otherStudents.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase mb-2">Успеваемость</div>
              <div className="flex flex-col gap-1">
                {otherStudents.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelect(s)}
                    className={`no-press flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selectedId === s.id ? "glass-tint-blue" : "nav-item hover:bg-white/30 border border-transparent"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-medium text-purple-600 flex-shrink-0 overflow-hidden">
                      {s.avatar ? <img src={s.avatar} alt={s.name} className="w-full h-full object-cover" /> :
                        getInitials(s.name)}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-gray-400">Успеваемость</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {students.length === 0 && (
            <div className="text-sm text-gray-400 text-center py-8">Нет учеников</div>
          )}
        </div>

        <div className="md:col-span-2">
          {!selected ? (
            <div className="glass p-5 text-sm text-gray-400 text-center py-16">
              Выбери ученика слева
            </div>
          ) : (
            <StudentResults
              student={selected}
              variants={variantsData[selected.id] || []}
              isEge={selected.goal === "ЕГЭ"}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default Results
