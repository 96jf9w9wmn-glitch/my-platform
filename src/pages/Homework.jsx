import { useState, useEffect, useRef, lazy, Suspense } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import Icon from "../components/Icon"
import { parseLocalDate } from "../utils"
// Лениво: Variants тянет весь банк заданий (генераторы на 34k строк) + jspdf.
// Нужен только во вкладке «варианты», незачем держать его в стартовом бандле.
const Variants = lazy(() => import("./Variants"))

const STATUS_LABELS = {
  assigned: { label: "Выдано", cls: "bg-gray-100 text-gray-600" },
  submitted: { label: "На проверке", cls: "bg-blue-100 text-blue-700" },
  done: { label: "Выполнено", cls: "bg-green-100 text-green-700" },
  revision: { label: "На доработку", cls: "bg-amber-100 text-amber-700" },
}

const TYPE_LABELS = {
  written: { label: "Письменное", iconName: "edit" },
  test: { label: "Тест", iconName: "file-text" },
  combined: { label: "Комбинированное", iconName: "clipboard" },
}

function getGradeFromPercent(percent) {
  if (percent >= 90) return 5
  if (percent >= 75) return 4
  if (percent >= 50) return 3
  return 2
}

const GRADE_COLORS = {
  5: "bg-green-100 text-green-700",
  4: "bg-blue-100 text-blue-700",
  3: "bg-amber-100 text-amber-700",
  2: "bg-red-100 text-red-700",
}

function buildUploadPath(tutorId, name) {
  const ext = name.split(".").pop()
  return tutorId + "/" + Date.now() + "." + ext
}

function CreateHomeworkModal({ students, tutorId, onClose, onCreated, editingHw }) {
  const isEditing = !!editingHw
  const [studentId, setStudentId] = useState(editingHw?.student_id ? String(editingHw.student_id) : "")
  const [title, setTitle] = useState(editingHw?.title || "")
  const [description, setDescription] = useState(editingHw?.description || "")
  const [deadline, setDeadline] = useState(editingHw?.deadline || "")
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [hwType, setHwType] = useState(editingHw?.hw_type || "written")
  const [requireSolution, setRequireSolution] = useState(editingHw?.require_solution || false)
  const [answersInput, setAnswersInput] = useState(editingHw?.correct_answers?.join(" ") || "")
  const fileRef = useRef()

  // --- Генерация ДЗ по теме через DeepSeek (серверный прокси /api/generate-hw) ---
  const [showGen, setShowGen] = useState(false)
  const [genTopic, setGenTopic] = useState("")
  const [genSubject, setGenSubject] = useState("")
  const [genLevel, setGenLevel] = useState("средний")
  const [genCount, setGenCount] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState("")
  const [preview, setPreview] = useState(null) // {title, description, tasks:[{question,answer}]}

  async function handleGenerate() {
    if (!genTopic.trim()) {
      setGenError("Введи тему")
      return
    }
    setGenError("")
    setGenerating(true)
    try {
      const res = await fetch("/api/generate-hw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: genTopic, subject: genSubject, level: genLevel, count: genCount }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenError(data.error || "Ошибка генерации")
        return
      }
      setPreview({
        title: data.title || genTopic,
        description: data.description || "",
        tasks: (data.tasks || []).map((t) => ({ question: t.question || "", answer: t.answer || "" })),
      })
    } catch (e) {
      setGenError("Сеть недоступна: " + String(e))
    } finally {
      setGenerating(false)
    }
  }

  function updatePreviewTask(idx, field, value) {
    setPreview((p) => ({
      ...p,
      tasks: p.tasks.map((t, i) => (i === idx ? { ...t, [field]: value } : t)),
    }))
  }

  function removePreviewTask(idx) {
    setPreview((p) => ({ ...p, tasks: p.tasks.filter((_, i) => i !== idx) }))
  }

  function applyPreview() {
    const tasks = preview.tasks.filter((t) => t.question.trim())
    setTitle(preview.title.trim() || genTopic)
    const body = tasks.map((t, i) => `${i + 1}. ${t.question.trim()}`).join("\n")
    setDescription([preview.description.trim(), body].filter(Boolean).join("\n\n"))
    const answers = tasks.map((t) => t.answer.trim())
    // Режим «Тест» с автопроверкой годится только если у КАЖДОГО задания ответ —
    // одно короткое значение без пробелов и запятых (тест-поле делит по пробелам,
    // поэтому «x₁ = 2, x₂ = 0.5» превратилось бы в кучу обрывков). Иначе —
    // «Письменное», ответы в тест-поле не пишем.
    const allTestable =
      answers.length > 0 &&
      answers.every((a) => a.length > 0 && !/[\s,]/.test(a))
    if (allTestable) {
      setHwType("test")
      setAnswersInput(answers.join(" "))
    }
    setPreview(null)
    setShowGen(false)
  }

  const correctAnswers = answersInput
    .trim()
    .split(/\s+/)
    .filter((a) => a.length > 0)
  const questionCount = correctAnswers.length

  async function handleSubmit() {
    if (!studentId || !title) {
      alert("Выбери ученика и заполни название")
      return
    }
    if ((hwType === "test" || hwType === "combined") && questionCount === 0) {
      alert("Введи правильные ответы для теста")
      return
    }
    setSaving(true)

    let fileUrl = isEditing ? editingHw.file_url : null
    if (file) {
      const fileName = buildUploadPath(tutorId, file.name)
      const { error: uploadError } = await supabase.storage.from("homework").upload(fileName, file)
      if (uploadError) {
        console.error("Upload error:", uploadError)
        alert("Ошибка загрузки файла: " + uploadError.message)
      } else {
        const { data } = supabase.storage.from("homework").getPublicUrl(fileName)
        fileUrl = data.publicUrl
      }
    }

    const payload = {
      tutor_id: tutorId,
      student_id: Number(studentId),
      title,
      description,
      deadline: deadline || null,
      file_url: fileUrl,
      hw_type: hwType,
      question_count: hwType === "written" ? null : questionCount,
      correct_answers: hwType === "written" ? null : correctAnswers,
      require_solution: hwType !== "written" ? requireSolution : false,
    }

    let error
    if (isEditing) {
      const res = await supabase.from("homework").update(payload).eq("id", editingHw.id)
      error = res.error
    } else {
      const res = await supabase.from("homework").insert({ ...payload, status: "assigned" })
      error = res.error
      if (!res.error) {
        const targetStudent = students.find(s => String(s.id) === studentId)
        const accountId = targetStudent?.studentAccountId
        if (accountId) {
          await supabase.from("notifications").insert({
            user_id: accountId,
            title: "Новое домашнее задание",
            body: title,
          })
        }
      }
    }

    if (!error) {
      onCreated()
      onClose()
    } else {
      alert("Ошибка: " + error.message)
    }
    setSaving(false)
  }

  return createPortal(
    <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
      <div className="glass-modal p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-medium">{isEditing ? "Редактировать задание" : "Новое задание"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><Icon name="x" size={18} /></button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Ученик</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400">
              <option value="">Выбери ученика...</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-2 block">Тип задания</label>
            <div className="flex gap-2">
              {Object.entries(TYPE_LABELS).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHwType(key)}
                  className={`flex-1 py-2.5 px-1 rounded-lg border transition-colors flex flex-col items-center gap-0.5 ${
                    hwType === key ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon name={val.iconName} size={14} />
                  <span className="text-[10px] leading-tight text-center">{val.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Генерация ДЗ по теме через ИИ */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
            <button
              type="button"
              onClick={() => setShowGen((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-medium text-blue-700 active:scale-[0.99] transition-transform"
            >
              <span className="flex items-center gap-1.5"><Icon name="sparkles" size={15} />Сгенерировать по теме</span>
              <Icon name={showGen ? "chevron-up" : "chevron-down"} size={16} />
            </button>

            {showGen && (
              <div className="mt-3 flex flex-col gap-2.5">
                <input
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  placeholder="Тема, например: Квадратные уравнения"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
                <div className="flex gap-2">
                  <input
                    value={genSubject}
                    onChange={(e) => setGenSubject(e.target.value)}
                    placeholder="Предмет (необяз.)"
                    className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                  <select
                    value={genLevel}
                    onChange={(e) => setGenLevel(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="лёгкий">Лёгкий</option>
                    <option value="средний">Средний</option>
                    <option value="сложный">Сложный</option>
                  </select>
                  <select
                    value={genCount}
                    onChange={(e) => setGenCount(Number(e.target.value))}
                    className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400"
                    title="Количество заданий"
                  >
                    {[3, 5, 8, 10, 15].map((n) => <option key={n} value={n}>{n} зад.</option>)}
                  </select>
                </div>

                {genError && <div className="text-xs text-red-500">{genError}</div>}

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99] transition-transform flex items-center justify-center gap-1.5"
                >
                  {generating ? "Генерирую…" : <><Icon name="sparkles" size={14} />Сгенерировать</>}
                </button>

                {preview && (
                  <div className="mt-1 rounded-xl border border-blue-200 bg-white p-3 flex flex-col gap-2.5 max-h-[45dvh] overflow-y-auto">
                    <input
                      value={preview.title}
                      onChange={(e) => setPreview((p) => ({ ...p, title: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:border-blue-400"
                    />
                    {preview.tasks.map((t, i) => (
                      <div key={i} className="rounded-lg bg-gray-50 p-2 flex flex-col gap-1.5">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-400 pt-2 w-4 flex-shrink-0">{i + 1}.</span>
                          <textarea
                            value={t.question}
                            onChange={(e) => updatePreviewTask(i, "question", e.target.value)}
                            rows={2}
                            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 resize-none"
                          />
                          <button
                            type="button"
                            onClick={() => removePreviewTask(i)}
                            className="text-gray-300 hover:text-red-500 pt-1.5"
                            title="Удалить задание"
                          >
                            <Icon name="x" size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 pl-6">
                          <span className="text-xs text-gray-400 flex-shrink-0">Ответ:</span>
                          <input
                            value={t.answer}
                            onChange={(e) => updatePreviewTask(i, "answer", e.target.value)}
                            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-400"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="text-[11px] text-gray-400 leading-snug">
                      Проверь задания и ответы — ИИ может ошибаться. При применении задания уйдут в описание, а ответы (если есть у всех) оформятся как тест.
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPreview(null)}
                        className="flex-1 border border-gray-200 rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                      >
                        Отклонить
                      </button>
                      <button
                        type="button"
                        onClick={applyPreview}
                        className="flex-1 bg-green-600 text-white rounded-lg py-1.5 text-sm hover:bg-green-700 active:scale-[0.99] transition-transform"
                      >
                        Применить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Название</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Параграф 5, упражнения 1-10"
              className="input-glass" />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Описание (необязательно)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Дополнительные пояснения..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Дедлайн (необязательно)</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">
              Файл {hwType === "written" ? "(необязательно)" : "с заданиями/тестом"}
            </label>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
            <button
              onClick={() => fileRef.current.click()}
              className="w-full border border-dashed border-gray-200 rounded-lg py-2.5 text-sm text-gray-500 hover:bg-gray-50"
            >
              <span className="flex items-center justify-center gap-1.5"><Icon name="paperclip" size={14} />{file ? file.name : "Прикрепить файл"}</span>
            </button>
          </div>

          {(hwType === "test" || hwType === "combined") && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setRequireSolution(!requireSolution)}
                className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${requireSolution ? "bg-blue-600" : "bg-gray-200"}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${requireSolution ? "left-5" : "left-1"}`} />
              </div>
              <div>
                <div className="text-sm text-gray-700">Требовать прикрепить решение</div>
                <div className="text-xs text-gray-400">Ученик должен сфотографировать или загрузить файл с решением</div>
              </div>
            </label>
          )}

          {(hwType === "test" || hwType === "combined") && (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">
                Ответы к тесту — введи все через пробел
              </label>
              <textarea
                value={answersInput}
                onChange={(e) => setAnswersInput(e.target.value)}
                placeholder="1 3 2 4 1 5 2 3 4 1"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
              />
              <div className="text-xs text-gray-400 mt-1">Введено: {questionCount}</div>

              {questionCount > 0 && (
                <div className="grid grid-cols-7 gap-1 mt-2">
                  {correctAnswers.map((a, i) => (
                    <div key={i} className="text-center rounded-lg py-1 text-xs bg-blue-100 text-blue-700 font-medium">
                      <div style={{ fontSize: "10px" }}>{i + 1}</div>
                      <div>{a}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
            Отмена
          </button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Сохраняем..." : isEditing ? "Сохранить" : "Создать"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function HomeworkCard({ hw, studentName, studentPhone, studentAccountId, onUpdate, onEdit }) {
  const [grading, setGrading] = useState(false)
  const [comment, setComment] = useState(hw.comment || "")
  const [selectedGrade, setSelectedGrade] = useState(hw.grade || null)
  const status = STATUS_LABELS[hw.status] || STATUS_LABELS.assigned
  const typeInfo = TYPE_LABELS[hw.hw_type] || TYPE_LABELS.written
  const isPureTest = hw.hw_type === "test"

  const testPercent = hw.test_score != null && hw.question_count
    ? Math.round((hw.test_score / hw.question_count) * 100)
    : null
  const suggestedGrade = testPercent != null ? getGradeFromPercent(testPercent) : null

  async function setStatus(newStatus, grade) {
    const updates = { status: newStatus, comment, grade: grade ?? null }
    if (newStatus === "revision") {
      updates.test_score = null
      updates.student_answers = null
      updates.submission_url = null
    }
    await supabase.from("homework").update(updates).eq("id", hw.id)

    const accountId = studentAccountId || (studentPhone
      ? (await supabase.from("student_accounts").select("id").eq("phone", studentPhone).maybeSingle()).data?.id
      : null)

    if (newStatus === "done" && grade && accountId) {
      await supabase.from("notifications").insert({
        user_id: accountId,
        title: "Задание проверено",
        body: `«${hw.title}» — оценка ${grade} из 5`,
      })
    } else if (newStatus === "revision" && accountId) {
      await supabase.from("notifications").insert({
        user_id: accountId,
        title: "Задание на доработке",
        body: `«${hw.title}» — репетитор отправил на пересдачу${comment ? ": " + comment : ""}`,
      })
    }

    onUpdate()
    setGrading(false)
  }

  async function finishPureTest() {
    const grade = suggestedGrade
    await supabase.from("homework").update({ status: "done", grade }).eq("id", hw.id)
    onUpdate()
  }

  async function handleDelete() {
    if (!window.confirm("Удалить задание «" + hw.title + "»?")) return
    await supabase.from("homework").delete().eq("id", hw.id)
    onUpdate()
  }

  return (
    <div className="glass p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">{hw.title}</div>
            <span className="flex items-center gap-1 text-xs text-gray-400"><Icon name={typeInfo.iconName} size={12} />{typeInfo.label}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{studentName}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-1 rounded-full ${status.cls}`}>{status.label}</span>
          <button onClick={() => onEdit(hw)} className="text-gray-400 hover:text-blue-600 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-blue-50" title="Редактировать">
            <Icon name="edit" size={14} />
          </button>
          <button onClick={handleDelete} className="text-gray-400 hover:text-red-600 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50" title="Удалить">
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>

      {hw.description && (
        <div className="text-xs text-gray-600 mt-2">{hw.description}</div>
      )}

      {hw.deadline && (
        <div className="text-xs text-gray-400 mt-2">
          Дедлайн: {parseLocalDate(hw.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
        </div>
      )}

      {hw.file_url && (
        <a href={hw.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:opacity-70 transition-opacity mt-2">
          <Icon name="paperclip" size={12} />Файл задания
        </a>
      )}

      {hw.test_score != null && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">Результат теста</div>
          <div className="text-sm font-medium text-blue-700">{hw.test_score} / {hw.question_count}</div>
        </div>
      )}

      {hw.submission_url && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-1">{hw.hw_type === "test" ? "Решение ученика:" : "Письменная работа:"}</div>
          <a href={hw.submission_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:opacity-70 transition-opacity">
            <Icon name="paperclip" size={12} />Открыть файл
          </a>
        </div>
      )}

      {hw.status === "submitted" && isPureTest && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {testPercent}% — рекомендуется оценка <span className="font-medium">{suggestedGrade}</span>
            </div>
            <button onClick={finishPureTest} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
              Завершить
            </button>
          </div>
        </div>
      )}

      {hw.status === "submitted" && !isPureTest && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {!grading ? (
            <button onClick={() => setGrading(true)} className="text-xs text-blue-600 hover:opacity-70 transition-opacity">
              Проверить и оценить
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              {testPercent != null && (
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                  Тестовая часть: {testPercent}% (рекомендуется {suggestedGrade})
                </div>
              )}

              <div>
                <div className="text-xs text-gray-500 mb-1">Оценка</div>
                <div className="flex gap-1.5">
                  {[2, 3, 4, 5].map((g) => (
                    <button
                      key={g}
                      onClick={() => setSelectedGrade(g)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        selectedGrade === g
                          ? GRADE_COLORS[g] + " border-transparent"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Комментарий (необязательно)"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none resize-none"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setStatus("done", selectedGrade)}
                  disabled={!selectedGrade}
                  className="flex-1 bg-green-600 text-white rounded-lg py-1.5 text-xs hover:bg-green-700 disabled:opacity-40"
                >
                  Выполнено
                </button>
                <button
                  onClick={() => setStatus("revision", selectedGrade)}
                  className="flex-1 bg-amber-500 text-white rounded-lg py-1.5 text-xs hover:bg-amber-600"
                >
                  На доработку
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {hw.grade && hw.status === "done" && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">Итоговая оценка</span>
          <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${GRADE_COLORS[hw.grade]}`}>{hw.grade}</span>
        </div>
      )}

      {hw.comment && hw.status !== "submitted" && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-start gap-1">
          <Icon name="message" size={12} className="mt-0.5 flex-shrink-0" />{hw.comment}
        </div>
      )}
    </div>
  )
}

function StudentHomeworkGroup({ studentName, studentPhone, studentAccountId, items, onUpdate, onEdit }) {
  const [expanded, setExpanded] = useState(true)

  const pending = items.filter((h) => h.status === "submitted").length
  const needsAttention = items.filter((h) => h.status === "assigned" || h.status === "revision").length

  return (
    <div className="glass overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
          <span className="text-sm font-medium">{studentName}</span>
          <span className="text-xs text-gray-400">{items.length} {items.length === 1 ? "задание" : "заданий"}</span>
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{pending} на проверке</span>
          )}
          {needsAttention > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{needsAttention} активных</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 flex flex-col gap-3 border-t border-white/40">
          {items.map((hw) => (
            <HomeworkCard key={hw.id} hw={hw} studentName={studentName} studentPhone={studentPhone} studentAccountId={studentAccountId} onUpdate={onUpdate} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  )
}

function Homework({ user, students, embedded = false }) {
  const [tab, setTab] = useState("homework")
  const [homework, setHomework] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showAddVariant, setShowAddVariant] = useState(false)
  const [filter, setFilter] = useState("all")
  const [editingHw, setEditingHw] = useState(null)

  useEffect(() => {
    loadHomework()
  }, [])

  async function loadHomework() {
    const { data } = await supabase
      .from("homework")
      .select("*")
      .eq("tutor_id", user.id)
      .order("created_at", { ascending: false })
    setHomework(data || [])
  }

  const filtered = filter === "all" ? homework : homework.filter((h) => h.status === filter)

  const grouped = {}
  filtered.forEach((hw) => {
    const student = students.find((s) => s.id === hw.student_id)
    const name = student?.name || "Неизвестный ученик"
    if (!grouped[name]) grouped[name] = []
    grouped[name].push(hw)
  })
  const groupNames = Object.keys(grouped).sort()

  return (
    <div className={embedded ? "" : "p-4 md:p-6"}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        {/* На мобильном кнопка добавления — первой, во всю ширину; на десктопе — справа */}
        <div className="flex gap-1 bg-gray-100/70 p-1 rounded-xl self-start order-2 sm:order-1">
          {[{ id: "homework", label: "Домашние задания" }, { id: "variants", label: "Варианты" }].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${tab === t.id ? "bg-white shadow-sm font-medium text-gray-800" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "homework" ? (
          <button onClick={() => setShowModal(true)} className="btn-primary px-4 py-2 text-sm self-end sm:self-auto order-1 sm:order-2">
            + Задание
          </button>
        ) : (
          <button onClick={() => setShowAddVariant(true)} className="btn-primary px-4 py-2 text-sm self-end sm:self-auto order-1 sm:order-2">
            + Новый вариант
          </button>
        )}
      </div>

      {tab === "variants" && (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="loader-ring" /></div>}>
          <Variants user={user} embedded addOpen={showAddVariant} onAddOpenChange={setShowAddVariant} />
        </Suspense>
      )}

      {tab === "homework" && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { id: "all", label: "Все" },
              { id: "assigned", label: "Выдано" },
              { id: "submitted", label: "На проверке" },
              { id: "done", label: "Выполнено" },
              { id: "revision", label: "На доработку" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                  f.id === filter
                    ? "bg-blue-600 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {groupNames.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-12 border border-dashed border-white/50 glass-sm">
              {filter === "all" ? "Заданий пока нет" : "Нет заданий с таким статусом"}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {groupNames.map((name) => {
                const s = students.find(st => st.name === name)
                return (
                  <StudentHomeworkGroup
                    key={name}
                    studentName={name}
                    studentPhone={s?.phone || null}
                    studentAccountId={s?.studentAccountId || null}
                    items={grouped[name]}
                    onUpdate={loadHomework}
                    onEdit={setEditingHw}
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      {showModal && (
        <CreateHomeworkModal
          students={students}
          tutorId={user.id}
          onClose={() => setShowModal(false)}
          onCreated={loadHomework}
        />
      )}

      {editingHw && (
        <CreateHomeworkModal
          students={students}
          tutorId={user.id}
          editingHw={editingHw}
          onClose={() => setEditingHw(null)}
          onCreated={loadHomework}
        />
      )}
    </div>
  )
}

export default Homework
