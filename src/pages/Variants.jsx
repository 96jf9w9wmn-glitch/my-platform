import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import { plural, getInitials, defaultExamType, renderTaskMath, plainTaskMath } from "../utils"
import Icon from "../components/Icon"
import { assembleFromBank, rerollTask, rerollModule, isModuleNumber, PART2_NUMBERS, makeAnswerChoices } from "./taskBankApi"
import { generateVariantPdf } from "./variantPdf"

const OGE_PART1_GEOMETRY = [15,16,17,18,19]
const OGE_PART2_TASKS = [20, 21, 22, 23, 24, 25]
// По спецификации ФИПИ все задания части 2 ОГЭ оцениваются в 2 балла (максимум 12).
const OGE_PART2_MAX = { 20: 2, 21: 2, 22: 2, 23: 2, 24: 2, 25: 2 }
const OGE_PART2_ALGEBRA = [20, 21, 22]
const OGE_PART2_GEOMETRY = [23, 24, 25]

const EGE_SCORES = [0,6,11,17,22,27,34,40,46,52,58,64,70,72,74,76,78,80,82,84,86,88,90,92,94,95,96,97,98,99,100,100,100]

function getOgeGrade(total, geomScore) {
  if (total < 8 || geomScore < 2) return 2
  if (total <= 14) return 3
  if (total <= 21) return 4
  return 5
}

function getEgeTestScore(primary) {
  return EGE_SCORES[Math.min(primary, EGE_SCORES.length - 1)] || 0
}

// Имя файла в Storage: непредсказуемая часть пути — метка времени (вне компонента,
// чтобы react-hooks/purity не считал Date.now() вызовом в рендере)
const storageFileName = (tutorId, ext) => `${tutorId}/${Date.now()}.${ext}`

function getGeomScore(part1Answers, correctAnswers, part2ScoreDetail) {
  let geom = 0
  OGE_PART1_GEOMETRY.forEach((n) => {
    const i = n - 1
    if (part1Answers?.[i]?.trim() === correctAnswers?.part1?.[i]?.trim()) geom++
  })
  OGE_PART2_GEOMETRY.forEach((n) => {
    geom += Number(part2ScoreDetail?.[n] || 0)
  })
  return geom
}

function AddVariantModal({ tutorId, students = [], examFocus, onClose, onAdd }) {
  const [title, setTitle] = useState("")
  const [examType, setExamType] = useState(() => defaultExamType(examFocus))
  const [answers, setAnswers] = useState(() => Array(defaultExamType(examFocus) === "ОГЭ" ? 19 : 12).fill(""))
  // Ответы части 2 (ОГЭ: 20–25) — объект { номер: ответ }; при сборке из банка заполняется сам
  const [part2Answers, setPart2Answers] = useState({})
  const [loading, setLoading] = useState(false)
  const [variantFile, setVariantFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [recipientId, setRecipientId] = useState("all")
  // Источник условий: свой файл или собранные из банка заданий
  const [source, setSource] = useState("file")
  const [bankPicked, setBankPicked] = useState([])
  const [bankMissing, setBankMissing] = useState([])
  const [assembling, setAssembling] = useState(false)
  const fileRef = useRef()

  // Аккаунты учеников; цель (ОГЭ/ЕГЭ) берём из students по уже вычисленному
  // studentAccountId (App.jsx), чтобы не заводить второе, отдельное сопоставление.
  useEffect(() => {
    supabase.from("student_accounts").select("id, name, phone").eq("tutor_id", tutorId)
      .then(({ data: accs }) => setAccounts(accs || []))
  }, [tutorId])

  const goalByAccountId = {}
  for (const s of students) {
    if (s.studentAccountId && s.goal) goalByAccountId[s.studentAccountId] = s.goal
  }

  const answerCount = examType === "ОГЭ" ? 19 : 12
  const part2Numbers = PART2_NUMBERS[examType] || []

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setVariantFile(file)
    setPreviewUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : null)
  }

  function removeFile() {
    setVariantFile(null)
    setPreviewUrl(null)
    fileRef.current.value = ""
  }

  async function handleAssemble() {
    setAssembling(true)
    const { picked, missing, count } = await assembleFromBank(examType)
    setBankPicked(picked)
    setBankMissing(missing)
    const filled = Array(count).fill("")
    const p2 = {}
    picked.forEach((t) => {
      if (t.number <= count) filled[t.number - 1] = t.answer
      else p2[t.number] = t.answer
    })
    setAnswers(filled)
    setPart2Answers(p2)
    setAssembling(false)
  }

  async function handleReroll(number) {
    // Задания 1–5 — связанный модуль: замена любого пересобирает весь сценарий целиком.
    if (isModuleNumber(examType, number)) {
      const fresh = rerollModule(examType)
      if (!fresh?.length) return
      const freshNums = new Set(fresh.map((t) => t.number))
      setBankPicked((prev) => [...prev.filter((t) => !freshNums.has(t.number)), ...fresh].sort((a, b) => a.number - b.number))
      setAnswers((prev) => { const upd = [...prev]; fresh.forEach((t) => { upd[t.number - 1] = t.answer }); return upd })
      return
    }
    const current = bankPicked.find((t) => t.number === number)
    const next = await rerollTask(examType, number, current?.id)
    if (!next) return
    setBankPicked((prev) => prev.map((t) => (t.number === number ? next : t)))
    if (number > answerCount) setPart2Answers((prev) => ({ ...prev, [number]: next.answer }))
    else setAnswers((prev) => { const upd = [...prev]; upd[number - 1] = next.answer; return upd })
  }

  async function handleSubmit() {
    if (!title) { alert("Введи название!"); return }
    if (source === "bank" && bankPicked.length === 0) { alert("Сначала собери вариант из банка"); return }
    if (answers.filter(Boolean).length < answerCount) { alert(`Заполни все ответы (${answers.filter(Boolean).length} / ${answerCount})`); return }
    setLoading(true)

    let fileUrl = null
    if (source === "file" && variantFile) {
      setUploading(true)
      const fileName = storageFileName(tutorId, variantFile.name.split(".").pop())
      const { error: uploadError } = await supabase.storage.from("variants").upload(fileName, variantFile, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("variants").getPublicUrl(fileName)
        fileUrl = urlData.publicUrl
      }
      setUploading(false)
    }

    const tasksSnapshot = source === "bank"
      ? bankPicked.map((t) => ({ number: t.number, condition_text: t.condition_text, image_url: t.image_url }))
      : null

    // Варианты ответа части 2 (ученик выбирает один из четырёх): у собранного из банка
    // берутся у сгенерированных заданий, у своего файла строятся из введённых ответов.
    const part2Choices = {}
    for (const n of part2Numbers) {
      const fromBank = source === "bank" ? bankPicked.find((t) => t.number === n)?.choices : null
      const choices = fromBank || makeAnswerChoices(part2Answers[n])
      if (choices) part2Choices[n] = choices
    }

    // Ученику вариант из банка отправляется тем же файловым PDF-просмотром, что и обычный
    // загруженный вариант — генерируем PDF из собранных условий прямо в браузере
    if (source === "bank") {
      setUploading(true)
      const pdfBlob = await generateVariantPdf({ title, examType, tasks: bankPicked })
      const fileName = storageFileName(tutorId, "pdf")
      const { error: uploadError } = await supabase.storage.from("variants").upload(fileName, pdfBlob, { contentType: "application/pdf" })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("variants").getPublicUrl(fileName)
        fileUrl = urlData.publicUrl
      }
      setUploading(false)
    }

    const { data, error } = await supabase.from("variants").insert({
      tutor_id: tutorId, title, type: examType,
      answers: { part1: answers, part2: part2Answers, part2_choices: part2Choices },
      file_url: fileUrl, tasks_snapshot: tasksSnapshot,
    }).select().single()

    if (error) { alert(error.message); setLoading(false); return }

    // Кому отправить: конкретному ученику или всем с подходящей целью экзамена
    const recipients = recipientId === "all"
      ? accounts.filter((a) => {
          const goal = goalByAccountId[a.id]
          return !goal || goal === examType
        })
      : accounts.filter((a) => String(a.id) === recipientId)

    if (recipients.length > 0) {
      await supabase.from("variant_submissions").insert(recipients.map((s) => ({ variant_id: data.id, student_id: s.id, status: "pending" })))
      await supabase.from("notifications").insert(recipients.map((s) => ({ user_id: s.id, title: "Новый вариант " + examType, body: "Репетитор отправил новый вариант: " + title })))
    }

    onAdd(data)
    onClose()
    setLoading(false)
  }

  return createPortal(
    <div className="fixed inset-0 glass-overlay z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="glass-modal p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-medium">Новый вариант</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><Icon name="x" size={18} /></button>
          </div>
          <div className="flex flex-col gap-4">

            <div>
              <label className="text-sm text-gray-500 mb-1 block">Ученик</label>
              <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400">
                <option value="all">Все ученики ({examType})</option>
                {accounts.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Тип экзамена</label>
              <div className="flex gap-2">
                {["ОГЭ", "ЕГЭ"].map((t) => (
                  <button key={t} type="button"
                    onClick={() => { setExamType(t); setAnswers(Array(t === "ОГЭ" ? 19 : 12).fill("")); setPart2Answers({}); setBankPicked([]); setBankMissing([]) }}
                    className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${examType === t ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    <span className="flex items-center justify-center gap-1"><Icon name={t === "ОГЭ" ? "file-text" : "book"} size={14} />{t}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">Название варианта</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Вариант 1 - Июнь 2026"
                className="input-glass" />
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Условия варианта</label>
              <div className="flex gap-2 mb-3">
                {[{ id: "file", label: "Свой файл" }, { id: "bank", label: "Из банка заданий" }].map((s) => (
                  <button key={s.id} type="button"
                    onClick={() => setSource(s.id)}
                    className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${source === s.id ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    {s.label}
                  </button>
                ))}
              </div>

              {source === "file" ? (
                <>
                  <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} />
                  {!variantFile ? (
                    <button onClick={() => fileRef.current.click()} className="w-full border-2 border-dashed border-gray-200 rounded-lg py-4 text-sm text-gray-500 hover:bg-gray-50">
                      Прикрепить файл с вариантом
                    </button>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {previewUrl && <img src={previewUrl} alt="preview" className="w-full max-h-48 object-contain bg-gray-50" />}
                      {!previewUrl && <div className="bg-gray-50 px-4 py-3"><span className="text-sm text-gray-700 truncate">{variantFile.name}</span></div>}
                      <div className="flex border-t border-gray-100">
                        <button onClick={() => fileRef.current.click()} className="flex-1 text-xs text-blue-600 py-2 hover:bg-blue-50">Заменить</button>
                        <div className="w-px bg-gray-100" />
                        <button onClick={removeFile} className="flex-1 text-xs text-red-500 py-2 hover:bg-red-50">Удалить</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <button onClick={handleAssemble} disabled={assembling}
                    className="w-full border-2 border-dashed border-blue-200 rounded-lg py-3 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50">
                    {assembling ? "Собираем..." : bankPicked.length > 0 ? "Собрать заново" : "Собрать вариант из банка"}
                  </button>

                  {bankPicked.length > 0 && (
                    <div className="text-xs mb-1">
                      Собрано заданий: <span className={bankMissing.length === 0 ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                        {bankPicked.length} / {answerCount + part2Numbers.length}
                      </span>
                      {bankMissing.length > 0 && (
                        <span className="text-amber-600"> · нет в банке: {bankMissing.join(", ")}</span>
                      )}
                    </div>
                  )}

                  {bankPicked.length > 0 && (
                    <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                      {bankPicked.map((t) => (
                        <div key={t.number} className="border border-gray-100 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-gray-500 mb-0.5">Задание {t.number}</div>
                            {t.condition_text && <div className="text-xs text-gray-600 truncate">{plainTaskMath(t.condition_text)}</div>}
                            {t.image_url && (
                              <a href={t.image_url} target="_blank" rel="noreferrer">
                                <img src={t.image_url} alt={`Задание ${t.number}`} className="mt-1 h-16 rounded border border-gray-100 bg-white" />
                              </a>
                            )}
                          </div>
                          <button onClick={() => handleReroll(t.number)} className="text-xs text-blue-600 hover:opacity-70 transition-opacity flex-shrink-0">
                            {isModuleNumber(examType, t.number) ? "Заменить блок 1–5" : "Заменить"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">
                Ответы к части 1 — введи все {answerCount} через пробел
              </label>
              <textarea
                value={answers.filter(Boolean).join(" ")}
                onChange={(e) => {
                  const vals = e.target.value.trim().split(/\s+/).filter(Boolean).slice(0, answerCount)
                  setAnswers([...vals, ...Array(answerCount).fill("")].slice(0, answerCount))
                }}
                placeholder={examType === "ОГЭ" ? "3 12 4 -5 2 0.5 8 16 3 7 4 2 6 9 45 8 12 3 7" : "3 12 4 -5 2 0.5 8 16 3 7 4 2"}
                rows={2}
                className="input-glass resize-none"
              />
              <div className="text-xs text-gray-400 mt-1">Введено: {answers.filter((a) => a).length} / {answerCount}</div>
            </div>

            {part2Numbers.length > 0 && (
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Ответы к части 2 (20–25)</label>
                <div className="grid grid-cols-2 gap-2">
                  {part2Numbers.map((n) => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 flex-shrink-0">{n}</span>
                      <input
                        value={part2Answers[n] || ""}
                        onChange={(e) => setPart2Answers((prev) => ({ ...prev, [n]: e.target.value }))}
                        placeholder={n === 24 ? "Доказано." : "Ответ"}
                        className="input-glass flex-1 px-2 py-1.5 text-sm min-w-0"
                      />
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Ученик выберет ответ из четырёх вариантов; для доказательства (№24) — только фото решения
                </div>
              </div>
            )}

            {answers.some((a) => a) && (
              <div>
                {examType === "ОГЭ" ? (
                  <>
                    <div className="text-xs font-medium text-blue-600 mb-1 bg-blue-50 px-2 py-1 rounded">Алгебра 1–14</div>
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {answers.slice(0, 14).map((a, i) => (
                        <div key={i} className={a ? "text-center rounded-lg py-1 text-xs bg-blue-100 text-blue-700 font-medium" : "text-center rounded-lg py-1 text-xs bg-gray-100 text-gray-400"}>
                          <div style={{fontSize:"10px"}}>{i+1}</div><div>{a||"-"}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs font-medium text-purple-600 mb-1 bg-purple-50 px-2 py-1 rounded">Геометрия 15–19</div>
                    <div className="grid grid-cols-5 gap-1">
                      {answers.slice(14, 19).map((a, i) => (
                        <div key={i} className={a ? "text-center rounded-lg py-1 text-xs bg-purple-100 text-purple-700 font-medium" : "text-center rounded-lg py-1 text-xs bg-gray-100 text-gray-400"}>
                          <div style={{fontSize:"10px"}}>{i+15}</div><div>{a||"-"}</div>
                        </div>
                      ))}
                    </div>
                    {part2Numbers.some((n) => part2Answers[n]) && (
                      <>
                        <div className="text-xs font-medium text-green-600 mb-1 mt-2 bg-green-50 px-2 py-1 rounded">Часть 2 · 20–25</div>
                        <div className="grid grid-cols-3 gap-1">
                          {part2Numbers.map((n) => (
                            <div key={n} className={part2Answers[n] ? "text-center rounded-lg py-1 text-xs bg-green-100 text-green-700 font-medium" : "text-center rounded-lg py-1 text-xs bg-gray-100 text-gray-400"}>
                              <div style={{fontSize:"10px"}}>{n}</div><div className="truncate px-1">{part2Answers[n]||"-"}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-xs font-medium text-blue-600 mb-1 bg-blue-50 px-2 py-1 rounded">Задания 1–12 (часть 1 ЕГЭ)</div>
                    <div className="grid grid-cols-6 gap-1">
                      {answers.slice(0, 12).map((a, i) => (
                        <div key={i} className={a ? "text-center rounded-lg py-1 text-xs bg-blue-100 text-blue-700 font-medium" : "text-center rounded-lg py-1 text-xs bg-gray-100 text-gray-400"}>
                          <div style={{fontSize:"10px"}}>{i+1}</div><div>{a||"-"}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
              {examType === "ОГЭ"
                ? "Часть 2 (20–25): ученик выбирает ответ из четырёх и прикрепляет фото решения. Баллы начисляются только после твоей проверки."
                : "Часть 2 (задания 13–19) проверяется вручную после загрузки решений учеником"}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
            <button onClick={handleSubmit} disabled={loading || uploading} className="flex-1 btn-primary py-2.5 disabled:opacity-50">
              {uploading ? (source === "bank" ? "Готовим PDF..." : "Загружаем...") : loading ? "Отправляем..." : recipientId === "all" ? "Отправить ученикам" : "Отправить ученику"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function EgeReview({ submission, variant, onClose, onSave }) {
  const EGE_PART2_TASKS = [13,14,15,16,17,18,19]
  const EGE_PART2_MAX_SCORES = { 13:2, 14:3, 15:2, 16:2, 17:3, 18:4, 19:4 }
  const [scores, setScores] = useState(EGE_PART2_TASKS.reduce((acc, n) => ({ ...acc, [n]: submission.part2_score_detail?.[n] ?? "" }), {}))
  const [loading, setLoading] = useState(false)

  const part1Answers = submission.part1_answers || []
  const correctAnswers = variant.answers?.part1 || []
  let part1Score = 0
  part1Answers.forEach((ans, i) => {
    if (ans?.trim() === correctAnswers[i]?.trim()) part1Score++
  })

  const part2Total = Object.values(scores).reduce((s, v) => s + (Number(v) || 0), 0)
  const primaryTotal = part1Score + part2Total
  const testScore = getEgeTestScore(primaryTotal)

  async function handleSave() {
    setLoading(true)
    const { error } = await supabase.from("variant_submissions").update({
      part2_score: part2Total, part2_score_detail: scores,
      total_score: primaryTotal, geom_score: testScore, status: "graded",
    }).eq("id", submission.id)
    if (!error) {
      await supabase.from("notifications").insert({
        user_id: submission.student_id, title: "Вариант ЕГЭ проверен",
        body: "Первичный балл: " + primaryTotal + ", тестовый: " + testScore,
      })
      onSave(); onClose()
    }
    setLoading(false)
  }

  return createPortal(
    <div className="fixed inset-0 glass-overlay z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="glass-modal p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-medium">Проверка ЕГЭ</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">X</button>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <div className="text-sm font-medium text-blue-700">Часть 1: {part1Score} / 12 баллов</div>
          </div>
          {submission.part2_files && Object.keys(submission.part2_files).length > 0 && (
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-2 block">Файлы ученика</label>
              <div className="flex flex-col gap-2">
                {Object.entries(submission.part2_files).map(([task, url]) => (
                  <a key={task} href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:opacity-70 transition-opacity border border-gray-100 rounded-lg px-3 py-2">
                    Задание {task}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="mb-4">
            <label className="text-sm text-gray-500 mb-2 block">Баллы за задания 13–19</label>
            <div className="flex flex-col gap-2">
              {EGE_PART2_TASKS.map((n) => (
                <div key={n} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-24">Задание {n}</span>
                  <span className="text-xs text-gray-400">макс. {EGE_PART2_MAX_SCORES[n]}</span>
                  <input type="number" min="0" max={EGE_PART2_MAX_SCORES[n]} value={scores[n]}
                    onChange={(e) => setScores((prev) => ({ ...prev, [n]: e.target.value }))}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-400" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between mb-2"><span className="text-sm text-gray-600">Часть 1 (1–12)</span><span className="text-sm font-medium">{part1Score} / 12</span></div>
            <div className="flex justify-between mb-2"><span className="text-sm text-gray-600">Часть 2 (13–19)</span><span className="text-sm font-medium">{part2Total} / 20</span></div>
            <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
              <span className="text-sm font-medium">Первичный балл</span>
              <span className="text-xl font-medium">{primaryTotal}</span>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-gray-400">Тестовый балл</span>
              <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{testScore}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
            <button onClick={handleSave} disabled={loading} className="flex-1 btn-primary py-2.5 disabled:opacity-50">
              {loading ? "Сохраняем..." : "Сохранить и уведомить"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function SubmissionReview({ submission, variant, onClose, onSave }) {
  const [scores, setScores] = useState(OGE_PART2_TASKS.reduce((acc, n) => ({ ...acc, [n]: submission.part2_score_detail?.[n] ?? "" }), {}))
  const [loading, setLoading] = useState(false)

  // Строка задания части 2: выбранный учеником ответ против верного, наличие фото решения
  // и поле балла. Балл ставит только репетитор — совпадение ответа лишь подсказка.
  const renderPart2Row = (n) => {
    const chosen = submission.part2_choices?.[n]
    const correct = variant.answers?.part2?.[n]
    const hasFile = !!submission.part2_files?.[n]
    const match = chosen != null && correct != null && String(chosen).trim() === String(correct).trim()
    return (
      <div key={n} className="flex items-center gap-3">
        <span className="text-sm text-gray-600 w-24 flex-shrink-0">Задание {n}</span>
        <div className="flex-1 min-w-0 text-xs leading-snug">
          {chosen != null ? (
            <div className={match ? "text-green-600" : "text-red-500"}>
              выбран: {chosen} {match ? "✓" : correct ? `· верный: ${correct}` : ""}
            </div>
          ) : (
            <div className="text-gray-400">ответ не выбран</div>
          )}
          {!hasFile && <div className="text-amber-600">нет фото решения</div>}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">макс. {OGE_PART2_MAX[n]}</span>
        <input type="number" min="0" max={OGE_PART2_MAX[n]} value={scores[n]}
          onChange={(e) => setScores((prev) => ({ ...prev, [n]: e.target.value }))}
          className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-400 flex-shrink-0" />
      </div>
    )
  }

  const part1Score = submission.part1_score ?? 0
  const part2Total = Object.values(scores).reduce((s, v) => s + (Number(v) || 0), 0)
  const total = part1Score + part2Total
  const geomScore = getGeomScore(submission.part1_answers, variant.answers, scores)

  async function handleSave() {
    setLoading(true)
    const { error } = await supabase.from("variant_submissions").update({
      part2_score: part2Total, part2_score_detail: scores, total_score: total, geom_score: geomScore, status: "graded",
    }).eq("id", submission.id)
    if (!error) {
      await supabase.from("notifications").insert({
        user_id: submission.student_id, title: "Вариант проверен",
        body: "Результат: " + total + " баллов, оценка " + getOgeGrade(total, geomScore),
      })
      onSave(); onClose()
    }
    setLoading(false)
  }

  return createPortal(
    <div className="fixed inset-0 glass-overlay z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="glass-modal p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-medium">Проверка части 2 (ОГЭ)</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">X</button>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <div className="text-sm font-medium text-blue-700">Часть 1: {part1Score} / 19 баллов</div>
          </div>
          {submission.part2_files && Object.keys(submission.part2_files).length > 0 && (
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-2 block">Файлы ученика</label>
              <div className="flex flex-col gap-2">
                {Object.entries(submission.part2_files).map(([task, url]) => (
                  <a key={task} href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:opacity-70 transition-opacity border border-gray-100 rounded-lg px-3 py-2">
                    Задание {task}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="mb-4">
            <label className="text-sm text-gray-500 mb-2 block">Баллы за часть 2</label>
            <div className="mb-3">
              <div className="text-xs font-medium text-blue-600 mb-2 bg-blue-50 px-2 py-1 rounded">Алгебра 20–22</div>
              <div className="flex flex-col gap-2">
                {OGE_PART2_ALGEBRA.map(renderPart2Row)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-purple-600 mb-2 bg-purple-50 px-2 py-1 rounded">Геометрия 23–25</div>
              <div className="flex flex-col gap-2">
                {OGE_PART2_GEOMETRY.map(renderPart2Row)}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between mb-2"><span className="text-sm text-gray-600">Часть 1</span><span className="text-sm font-medium">{part1Score} / 19</span></div>
            <div className="flex justify-between mb-2"><span className="text-sm text-gray-600">Часть 2</span><span className="text-sm font-medium">{part2Total} / 12</span></div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Геометрия итого</span>
              <span className={geomScore < 2 ? "text-sm font-medium text-red-600" : "text-sm font-medium text-green-600"}>{geomScore} {geomScore < 2 ? "!" : "ok"}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
              <span className="text-sm font-medium">Итого</span>
              <span className="text-xl font-medium">{total} баллов</span>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-gray-400">Оценка</span>
              <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{getOgeGrade(total, geomScore)}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
            <button onClick={handleSave} disabled={loading} className="flex-1 btn-primary py-2.5 disabled:opacity-50">
              {loading ? "Сохраняем..." : "Сохранить и уведомить"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function Variants({ user, students = [], embedded = false, addOpen, onAddOpenChange }) {
  const [variants, setVariants] = useState([])
  const [submissions, setSubmissions] = useState([])
  // Модалка добавления может управляться извне (кнопка в шапке блока «Задания»)
  const [showAddInternal, setShowAddInternal] = useState(false)
  const controlled = typeof onAddOpenChange === "function"
  const showAdd = controlled ? addOpen : showAddInternal
  const setShowAdd = controlled ? onAddOpenChange : setShowAddInternal
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [previewFile, setPreviewFile] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: v } = await supabase.from("variants").select("*").eq("tutor_id", user.id).order("created_at", { ascending: false })
    const { data: s } = await supabase.from("variant_submissions").select("*, student_accounts(name, email)").in("variant_id", (v || []).map((x) => x.id))
    setVariants(v || [])
    setSubmissions(s || [])
    setLoading(false)
  }

  async function deleteVariant(v) {
    if (!window.confirm("Удалить вариант " + v.title + "?")) return
    await supabase.from("variant_submissions").delete().eq("variant_id", v.id)
    await supabase.from("variants").delete().eq("id", v.id)
    setVariants((prev) => prev.filter((x) => x.id !== v.id))
    if (selectedVariant && selectedVariant.id === v.id) setSelectedVariant(null)
  }

  const variantSubmissions = selectedVariant ? submissions.filter((s) => s.variant_id === selectedVariant.id) : []

  const totalPending = submissions.filter((s) => s.status === "submitted").length
  const totalGraded = submissions.filter((s) => s.status === "graded").length

  const AVATAR_COLORS = [
    { bg: "bg-blue-100", text: "text-blue-700" },
    { bg: "bg-purple-100", text: "text-purple-700" },
    { bg: "bg-amber-100", text: "text-amber-700" },
    { bg: "bg-green-100", text: "text-green-700" },
    { bg: "bg-pink-100", text: "text-pink-700" },
  ]

  function getAvatarColor(name) {
    if (!name) return AVATAR_COLORS[0]
    let sum = 0
    for (const c of name) sum += c.charCodeAt(0)
    return AVATAR_COLORS[sum % AVATAR_COLORS.length]
  }

  function renderScore(sub) {
    if (sub.status === "pending") return "Ещё не выполнял"
    if (sub.status === "submitted") return "Часть 1 сдана · ждёт проверки"
    if (selectedVariant?.type === "ЕГЭ") {
      return "Первичный: " + sub.total_score + " · тестовый: " + getEgeTestScore(sub.total_score)
    }
    return "Итого: " + sub.total_score + " баллов · оценка " + getOgeGrade(sub.total_score, sub.geom_score || 0)
  }

  return (
    <div className={`flex flex-col gap-5 ${embedded ? "" : "p-4 md:p-6"}`}>
      {!controlled && (
        <div className="flex justify-between items-center">
          {!embedded && <h1 className="text-xl font-medium">Варианты</h1>}
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5 ml-auto">
            + Новый вариант
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="glass p-4">
          <div className="text-xs text-gray-400 mb-1">Всего вариантов</div>
          <div className="text-2xl font-medium">{variants.length}</div>
        </div>
        <div className="glass p-4">
          <div className="text-xs text-gray-400 mb-1">Ждут проверки</div>
          <div className={`text-2xl font-medium ${totalPending > 0 ? "text-amber-600" : ""}`}>{totalPending}</div>
        </div>
        <div className="glass p-4">
          <div className="text-xs text-gray-400 mb-1">Проверено работ</div>
          <div className={`text-2xl font-medium ${totalGraded > 0 ? "text-green-600" : ""}`}>{totalGraded}</div>
        </div>
      </div>


      {loading ? (
        <div className="text-sm text-gray-400 text-center py-8">Загрузка...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className={`col-span-1 flex flex-col gap-2 ${selectedVariant ? "hidden md:flex" : "flex"}`}>
            {variants.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-12 border border-dashed border-gray-200 rounded-xl">
                Вариантов пока нет
              </div>
            ) : variants.map((v) => {
              const subs = submissions.filter((s) => s.variant_id === v.id)
              const graded = subs.filter((s) => s.status === "graded").length
              const submitted = subs.filter((s) => s.status === "submitted").length
              const total = subs.length
              const progressPct = total > 0 ? Math.round((graded / total) * 100) : 0
              const isSelected = selectedVariant?.id === v.id
              return (
                <div key={v.id} className={`glass-sm overflow-hidden transition-all ${isSelected ? "!border-blue-400/60 ring-1 ring-blue-400/30" : ""}`}>
                  <button onClick={() => setSelectedVariant(v)} className="w-full text-left p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-sm">{v.title}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.type === "ЕГЭ" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{v.type}</span>
                    </div>
                    <div className="text-xs text-gray-400 mb-3">
                      {new Date(v.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                    </div>
                    {total > 0 && (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Проверено</span>
                          <span>{graded} / {total}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${graded === total ? "bg-green-500" : "bg-blue-500"}`}
                            style={{ width: progressPct + "%" }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {submitted > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{submitted} на проверке</span>}
                      {graded > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{graded} проверено</span>}
                      {total === 0 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Ожидают</span>}
                    </div>
                  </button>
                  <div className="flex border-t border-gray-100/60">
                    {v.file_url && (
                      <>
                        <button onClick={() => setPreviewFile(v.file_url)} className="flex-1 text-xs text-blue-600 py-2 hover:bg-blue-50/60 transition-colors">Файл</button>
                        <div className="w-px bg-gray-100" />
                      </>
                    )}
                    <button onClick={() => deleteVariant(v)} className="flex-1 text-xs text-red-500 py-2 hover:bg-red-50/60 transition-colors">Удалить</button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className={`md:col-span-2 ${!selectedVariant ? "hidden md:block" : "block"}`}>
            {!selectedVariant ? (
              <div className="glass p-5 text-sm text-gray-400 text-center py-16">Выбери вариант слева</div>
            ) : (
              <div className="glass overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100/60">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedVariant(null)} className="md:hidden text-blue-600 text-sm mr-1">← Назад</button>
                    <span className="font-medium text-base">{selectedVariant.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedVariant.type === "ЕГЭ" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{selectedVariant.type}</span>
                  </div>
                  <span className="text-xs text-gray-400">{variantSubmissions.length} {plural(variantSubmissions.length, "ученик", "ученика", "учеников")}</span>
                </div>

                {selectedVariant.file_url && (
                  <div className="mx-5 mt-4 border border-gray-100 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/60">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Icon name="paperclip" size={12} />
                        <span>{selectedVariant.file_url.split("/").pop() || "Файл варианта"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <a href={selectedVariant.file_url + (selectedVariant.file_url.includes("?") ? "&" : "?") + "download"} download className="text-xs text-blue-600 hover:opacity-70 transition-opacity flex items-center gap-1"><Icon name="download" size={12} />Скачать PDF</a>
                        <a href={selectedVariant.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:opacity-70 transition-opacity">Открыть ↗</a>
                        <button onClick={() => setPreviewFile(selectedVariant.file_url)} className="text-xs text-gray-400 hover:text-gray-600">На весь экран</button>
                      </div>
                    </div>
                    {selectedVariant.file_url.match(/\.(jpg|jpeg|png|gif|webp)/i) && (
                      <img src={selectedVariant.file_url} alt="вариант" className="w-full max-h-48 object-contain bg-white cursor-pointer" onClick={() => setPreviewFile(selectedVariant.file_url)} />
                    )}
                  </div>
                )}

                {selectedVariant.tasks_snapshot?.length > 0 && (
                  <details className="mx-5 mt-4 border border-gray-100 rounded-xl overflow-hidden">
                    <summary className="px-4 py-2.5 bg-gray-50/60 text-xs text-gray-500 cursor-pointer flex items-center gap-2">
                      <Icon name="book" size={12} />Задания из банка ({selectedVariant.tasks_snapshot.length})
                    </summary>
                    <div className="flex flex-col gap-2 p-3">
                      {selectedVariant.tasks_snapshot.map((t) => (
                        <div key={t.number} className="text-xs border border-gray-100 rounded-lg p-2">
                          <span className="font-medium text-gray-500">№{t.number}. </span>
                          {t.condition_text && <span className="text-gray-600" dangerouslySetInnerHTML={{ __html: renderTaskMath(t.condition_text) }} />}
                          {t.image_url && (
                            <a href={t.image_url} target="_blank" rel="noreferrer" className="block mt-1">
                              <img src={t.image_url} alt={`Задание ${t.number}`} className="h-20 rounded border border-gray-100 bg-white" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="flex flex-col gap-2 p-5">
                  {variantSubmissions.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-10">Никто ещё не отвечал</div>
                  ) : variantSubmissions.map((sub) => {
                    const name = sub.student_accounts?.name || sub.student_accounts?.email || ""
                    const color = getAvatarColor(name)
                    return (
                      <div key={sub.id} className="flex items-center gap-3 bg-gray-50/50 rounded-xl px-4 py-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${color.bg} ${color.text}`}>
                          {getInitials(name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{renderScore(sub)}</div>
                        </div>
                        <div className="flex-shrink-0">
                          {sub.status === "pending" && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">Ожидает</span>
                          )}
                          {sub.status === "submitted" && (
                            <button onClick={() => setSelectedSubmission(sub)} className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full hover:bg-amber-200 transition-colors font-medium">
                              Проверить →
                            </button>
                          )}
                          {sub.status === "graded" && (
                            <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                              {selectedVariant.type === "ЕГЭ"
                                ? getEgeTestScore(sub.total_score) + " б"
                                : "Оценка " + getOgeGrade(sub.total_score, sub.geom_score || 0)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {showAdd && (
        <AddVariantModal tutorId={user.id} students={students} examFocus={user.profile?.exam_focus} onClose={() => setShowAdd(false)} onAdd={(v) => { setVariants((prev) => [v, ...prev]); setShowAdd(false) }} />
      )}

      {selectedSubmission && selectedVariant?.type === "ЕГЭ" && (
        <EgeReview submission={selectedSubmission} variant={selectedVariant} onClose={() => setSelectedSubmission(null)} onSave={loadData} />
      )}

      {selectedSubmission && selectedVariant?.type !== "ЕГЭ" && (
        <SubmissionReview submission={selectedSubmission} variant={selectedVariant} onClose={() => setSelectedSubmission(null)} onSave={loadData} />
      )}

      {previewFile && createPortal(
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center" onClick={() => setPreviewFile(null)}>
          <div className="glass-modal sheet-modal w-full md:max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 md:hidden" />
            <h3 className="text-base font-medium mb-4 text-center">Просмотр варианта</h3>
            <div className="flex flex-col gap-3">
              <a href={previewFile} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3 text-sm font-medium">
                Открыть файл ↗
              </a>
              {previewFile.match(/\.(jpg|jpeg|png|gif|webp)/i) && (
                <img src={previewFile} alt="variant" className="w-full max-h-64 object-contain rounded-xl bg-gray-50" />
              )}
              <button onClick={() => setPreviewFile(null)} className="w-full border border-gray-200 rounded-xl py-3 text-sm text-gray-600 hover:bg-gray-50">
                Закрыть
              </button>

            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default Variants
