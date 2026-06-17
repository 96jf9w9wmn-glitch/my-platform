import { useState, useEffect, useRef } from "react"
import { supabase } from "../supabase"

const OGE_PART1_GEOMETRY = [15,16,17,18,19]
const OGE_PART1_COUNT = 19
const OGE_PART2_TASKS = [20, 21, 22, 23, 24, 25]
const OGE_PART2_MAX = { 20: 2, 21: 2, 22: 3, 23: 2, 24: 2, 25: 3 }
const OGE_PART2_ALGEBRA = [20, 21, 22]
const OGE_PART2_GEOMETRY = [23, 24, 25]

function getOgeGrade(total, geomScore) {
  if (total < 8 || geomScore < 2) return 2
  if (total <= 14) return 3
  if (total <= 21) return 4
  return 5
}

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

function AddVariantModal({ tutorId, onClose, onAdd }) {
  const [title, setTitle] = useState("")
  const [answers, setAnswers] = useState(Array(OGE_PART1_COUNT).fill(""))
  const [loading, setLoading] = useState(false)
  const [variantFile, setVariantFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const fileRef = useRef()

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setVariantFile(file)
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file))
    } else {
      setPreviewUrl(null)
    }
  }

  function removeFile() {
    setVariantFile(null)
    setPreviewUrl(null)
    fileRef.current.value = ""
  }

  async function handleSubmit() {
    if (!title) { alert("Введи название!"); return }
    if (answers.some((a) => !a)) { alert("Заполни все 19 ответов!"); return }
    setLoading(true)

    let fileUrl = null
    if (variantFile) {
      setUploading(true)
      const fileName = tutorId + "/" + Date.now() + "." + variantFile.name.split(".").pop()
      const { error: uploadError } = await supabase.storage
        .from("variants")
        .upload(fileName, variantFile)
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("variants").getPublicUrl(fileName)
        fileUrl = urlData.publicUrl
      }
      setUploading(false)
    }

    const { data, error } = await supabase.from("variants").insert({
      tutor_id: tutorId,
      title: title,
      type: "OGE",
      answers: { part1: answers },
      file_url: fileUrl,
    }).select().single()

    if (error) { alert(error.message); setLoading(false); return }

    const { data: students } = await supabase
      .from("student_accounts")
      .select("id")
      .eq("tutor_id", tutorId)

    if (students && students.length > 0) {
      await supabase.from("variant_submissions").insert(
        students.map((s) => ({
          variant_id: data.id,
          student_id: s.id,
          status: "pending",
        }))
      )
      await supabase.from("notifications").insert(
        students.map((s) => ({
          user_id: s.id,
          title: "Новый вариант",
          body: "Репетитор отправил новый вариант: " + title,
        }))
      )
    }

    onAdd(data)
    onClose()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-medium">Новый вариант ОГЭ</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">X</button>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Название варианта</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Вариант 1 - Июнь 2026"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Файл с вариантом (PDF или фото)</label>
              <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} />
              {!variantFile ? (
                <button
                  onClick={() => fileRef.current.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-lg py-4 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Прикрепить файл с вариантом
                </button>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {previewUrl && (
                    <img src={previewUrl} alt="preview" className="w-full max-h-48 object-contain bg-gray-50" />
                  )}
                  {!previewUrl && (
                    <div className="bg-gray-50 px-4 py-3">
                      <span className="text-sm text-gray-700 truncate">{variantFile.name}</span>
                    </div>
                  )}
                  <div className="flex border-t border-gray-100">
                    <button onClick={() => fileRef.current.click()} className="flex-1 text-xs text-blue-600 py-2 hover:bg-blue-50">Заменить</button>
                    <div className="w-px bg-gray-100" />
                    <button onClick={removeFile} className="flex-1 text-xs text-red-500 py-2 hover:bg-red-50">Удалить</button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Ответы к части 1 - введи все 19 через пробел</label>
              <textarea
                value={answers.join(" ")}
                onChange={(e) => {
                  const vals = e.target.value.split(/\s+/).slice(0, 19)
                  const padded = [...vals, ...Array(19).fill("")].slice(0, 19)
                  setAnswers(padded)
                }}
                placeholder="Например: 3 12 4 -5 2 0.5 8 16 3 7 4 2 6 9 45 8 12 3 7"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
              />
              <div className="text-xs text-gray-400 mt-1">Введено: {answers.filter((a) => a).length} / 19</div>
            </div>
            {answers.some((a) => a) && (
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Предпросмотр</label>
                <div className="mb-2">
                  <div className="text-xs font-medium text-blue-600 mb-1 bg-blue-50 px-2 py-1 rounded">Алгебра - задания 1-14</div>
                  <div className="grid grid-cols-7 gap-1">
                    {answers.slice(0, 14).map((a, i) => (
                      <div key={i} className={a ? "text-center rounded-lg py-1 text-xs bg-blue-100 text-blue-700 font-medium" : "text-center rounded-lg py-1 text-xs bg-gray-100 text-gray-400"}>
                        <div style={{fontSize: "10px"}}>{i + 1}</div>
                        <div>{a || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-purple-600 mb-1 bg-purple-50 px-2 py-1 rounded">Геометрия - задания 15-19</div>
                  <div className="grid grid-cols-5 gap-1">
                    {answers.slice(14, 19).map((a, i) => (
                      <div key={i} className={a ? "text-center rounded-lg py-1 text-xs bg-purple-100 text-purple-700 font-medium" : "text-center rounded-lg py-1 text-xs bg-gray-100 text-gray-400"}>
                        <div style={{fontSize: "10px"}}>{i + 15}</div>
                        <div>{a || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
              Часть 2 (задания 20-25) проверяется вручную после загрузки решений учеником
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
            <button onClick={handleSubmit} disabled={loading || uploading} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
              {uploading ? "Загружаем..." : loading ? "Отправляем..." : "Отправить ученикам"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SubmissionReview({ submission, variant, onClose, onSave }) {
  const [scores, setScores] = useState(
    OGE_PART2_TASKS.reduce((acc, n) => ({ ...acc, [n]: submission.part2_score_detail?.[n] ?? "" }), {})
  )
  const [loading, setLoading] = useState(false)

  const part1Score = submission.part1_score ?? 0
  const part2Total = Object.values(scores).reduce((s, v) => s + (Number(v) || 0), 0)
  const total = part1Score + part2Total
  const geomScore = getGeomScore(submission.part1_answers, variant.answers, scores)

  async function handleSave() {
    setLoading(true)
    const { error } = await supabase.from("variant_submissions").update({
      part2_score: part2Total,
      part2_score_detail: scores,
      total_score: total,
      geom_score: geomScore,
      status: "graded",
    }).eq("id", submission.id)
    if (!error) {
      await supabase.from("notifications").insert({
        user_id: submission.student_id,
        title: "Вариант проверен",
        body: "Результат: " + total + " баллов, оценка " + getOgeGrade(total, geomScore),
      })
      onSave()
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-medium">Проверка части 2</h2>
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
                  <a key={task} href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline border border-gray-100 rounded-lg px-3 py-2">
                    Задание {task}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="mb-4">
            <label className="text-sm text-gray-500 mb-2 block">Баллы за часть 2</label>
            <div className="mb-3">
              <div className="text-xs font-medium text-blue-600 mb-2 bg-blue-50 px-2 py-1 rounded">Алгебра - задания 20-22</div>
              <div className="flex flex-col gap-2">
                {OGE_PART2_ALGEBRA.map((n) => (
                  <div key={n} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">Задание {n}</span>
                    <span className="text-xs text-gray-400">макс. {OGE_PART2_MAX[n]}</span>
                    <input type="number" min="0" max={OGE_PART2_MAX[n]} value={scores[n]}
                      onChange={(e) => setScores((prev) => ({ ...prev, [n]: e.target.value }))}
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-purple-600 mb-2 bg-purple-50 px-2 py-1 rounded">Геометрия - задания 23-25</div>
              <div className="flex flex-col gap-2">
                {OGE_PART2_GEOMETRY.map((n) => (
                  <div key={n} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">Задание {n}</span>
                    <span className="text-xs text-gray-400">макс. {OGE_PART2_MAX[n]}</span>
                    <input type="number" min="0" max={OGE_PART2_MAX[n]} value={scores[n]}
                      onChange={(e) => setScores((prev) => ({ ...prev, [n]: e.target.value }))}
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Часть 1</span>
              <span className="text-sm font-medium">{part1Score} / 19</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Часть 2</span>
              <span className="text-sm font-medium">{part2Total} / 12</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Геометрия итого</span>
              <span className={geomScore < 2 ? "text-sm font-medium text-red-600" : "text-sm font-medium text-green-600"}>
                {geomScore} {geomScore < 2 ? "!" : "ok"}
              </span>
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
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
            <button onClick={handleSave} disabled={loading} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Сохраняем..." : "Сохранить и уведомить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Variants({ user }) {
  const [variants, setVariants] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [showAdd, setShowAdd] = useState(false)
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-medium">Варианты</h1>
        <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + Новый вариант
        </button>
      </div>
      {loading ? <div className="text-sm text-gray-400">Загрузка...</div> : (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 flex flex-col gap-2">
            {variants.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-8 border border-dashed border-gray-200 rounded-xl">Вариантов пока нет</div>
            ) : variants.map((v) => {
              const subs = submissions.filter((s) => s.variant_id === v.id)
              const graded = subs.filter((s) => s.status === "graded").length
              const submitted = subs.filter((s) => s.status === "submitted").length
              const isSelected = selectedVariant && selectedVariant.id === v.id
              return (
                <div key={v.id} className={isSelected ? "rounded-xl border border-blue-300 bg-blue-50" : "rounded-xl border border-gray-200"}>
                  <button onClick={() => setSelectedVariant(v)} className="w-full text-left p-4">
                    <div className="font-medium text-sm mb-1">{v.title}</div>
                    <div className="text-xs text-gray-400">{new Date(v.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</div>
                    {v.file_url && <div className="text-xs text-blue-500 mt-1">файл прикреплен</div>}
                    <div className="flex gap-2 mt-2">
                      {submitted > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{submitted} на проверке</span>}
                      {graded > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{graded} проверено</span>}
                      {subs.length === 0 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Ожидают</span>}
                    </div>
                  </button>
                  <div className="flex border-t border-gray-100">
                    {v.file_url && (
                      <>
                        <button onClick={() => setPreviewFile(v.file_url)} className="flex-1 text-xs text-blue-600 py-2 hover:bg-blue-50 rounded-bl-xl">Просмотр</button>
                        <div className="w-px bg-gray-100" />
                      </>
                    )}
                    <button onClick={() => deleteVariant(v)} className="flex-1 text-xs text-red-500 py-2 hover:bg-red-50 rounded-br-xl">Удалить</button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-5">
            {!selectedVariant ? (
              <div className="text-sm text-gray-400 text-center py-16">Выбери вариант слева</div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-base font-medium">{selectedVariant.title}</h2>
                  <span className="text-xs text-gray-400">{variantSubmissions.length} учеников</span>
                </div>
                {selectedVariant.file_url && (
                  <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
                    {selectedVariant.file_url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                      <img
                        src={selectedVariant.file_url}
                        alt="вариант"
                        className="w-full max-h-64 object-contain bg-gray-50 cursor-pointer"
                        onClick={() => setPreviewFile(selectedVariant.file_url)}
                      />
                    ) : (
                      <iframe
                        src={selectedVariant.file_url}
                        className="w-full h-64 bg-white"
                        title="вариант"
                      />
                    )}
                    <div className="flex border-t border-gray-100">
                      <a href={selectedVariant.file_url} target="_blank" rel="noreferrer" className="flex-1 text-xs text-blue-600 py-2 text-center hover:bg-blue-50">
                        Открыть в новой вкладке
                      </a>
                      <div className="w-px bg-gray-100" />
                      <button onClick={() => setPreviewFile(selectedVariant.file_url)} className="flex-1 text-xs text-gray-600 py-2 hover:bg-gray-50">
                        На весь экран
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {variantSubmissions.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-8">Никто ещё не отвечал</div>
                  ) : variantSubmissions.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                      <div>
                        <div className="text-sm font-medium">{sub.student_accounts ? (sub.student_accounts.name || sub.student_accounts.email) : ""}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {sub.status === "pending" && "Ещё не выполнял"}
                          {sub.status === "submitted" && ("Часть 1: " + sub.part1_score + " / 19")}
                          {sub.status === "graded" && ("Итого: " + sub.total_score + " баллов, оценка " + getOgeGrade(sub.total_score, sub.geom_score || 0))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {sub.status === "pending" && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Ожидает</span>}
                        {sub.status === "submitted" && (
                          <button onClick={() => setSelectedSubmission(sub)} className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full hover:bg-amber-200">Проверить</button>
                        )}
                        {sub.status === "graded" && (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">{getOgeGrade(sub.total_score, sub.geom_score || 0)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {showAdd && (
        <AddVariantModal
          tutorId={user.id}
          onClose={() => setShowAdd(false)}
          onAdd={(v) => { setVariants((prev) => [v, ...prev]); setShowAdd(false) }}
        />
      )}
      {selectedSubmission && (
        <SubmissionReview
          submission={selectedSubmission}
          variant={selectedVariant}
          onClose={() => setSelectedSubmission(null)}
          onSave={loadData}
        />
      )}
      {previewFile && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewFile(null)}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-2">
              <a href={previewFile} target="_blank" rel="noreferrer" className="text-white text-sm hover:text-gray-300">Открыть в новой вкладке</a>
              <button onClick={() => setPreviewFile(null)} className="text-white text-sm hover:text-gray-300">Закрыть</button>
            </div>
            {previewFile.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
              <img src={previewFile} alt="variant" className="w-full max-h-screen object-contain rounded-xl" />
            ) : (
              <iframe src={previewFile} className="w-full h-screen rounded-xl bg-white" title="variant" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Variants
