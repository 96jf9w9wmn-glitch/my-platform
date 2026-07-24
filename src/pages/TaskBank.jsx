import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import Icon from "../components/Icon"
import Collapse from "../components/Collapse"
import { TASK_NUMBERS_BY_TYPE } from "./taskBankApi"
import { plainTaskMath, normalizeTaskImage } from "../utils"

function TaskForm({ examType, editingTask, onSaved, onCancel }) {
  const [number, setNumber] = useState(editingTask?.number || 1)
  const [conditionText, setConditionText] = useState(editingTask?.condition_text || "")
  const [answer, setAnswer] = useState(editingTask?.answer || "")
  // Существующая картинка редактируемого задания — сеттер не нужен, меняется только через finalImageUrl при сохранении
  const [imageUrl] = useState(editingTask?.image_url || "")
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()
  const maxNumber = TASK_NUMBERS_BY_TYPE[examType]

  async function handleSubmit() {
    if (!answer.trim()) { alert("Введи правильный ответ"); return }
    if (!conditionText.trim() && !imageUrl && !file) { alert("Добавь текст условия или картинку"); return }
    setSaving(true)

    let finalImageUrl = imageUrl
    if (file) {
      const ext = file.name.split(".").pop()
      const fileName = "tasks/" + Date.now() + "." + ext
      const { error: uploadError } = await supabase.storage.from("variants").upload(fileName, file, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("variants").getPublicUrl(fileName)
        finalImageUrl = urlData.publicUrl
      }
    }

    const payload = {
      exam_type: examType,
      number: Number(number),
      condition_text: conditionText.trim() || null,
      image_url: finalImageUrl || null,
      answer: answer.trim(),
    }

    const res = editingTask
      ? await supabase.from("tasks").update(payload).eq("id", editingTask.id)
      : await supabase.from("tasks").insert(payload)

    setSaving(false)
    if (res.error) { alert(res.error.message); return }
    onSaved()
  }

  return (
    <div className="glass-sm p-4 flex flex-col gap-3">
      <div className="flex gap-3">
        <div className="w-24">
          <label className="text-xs text-gray-500 mb-1 block">Номер</label>
          <select value={number} onChange={(e) => setNumber(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400">
            {Array.from({ length: maxNumber }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Правильный ответ</label>
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="42"
            className="input-glass py-2" />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Текст условия</label>
        <textarea value={conditionText} onChange={(e) => setConditionText(e.target.value)}
          rows={3} placeholder="Условие задания..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Картинка (необязательно)</label>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => setFile(e.target.files[0] || null)} />
        <button onClick={() => fileRef.current.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-lg py-2 text-xs text-gray-500 hover:bg-gray-50">
          {file ? file.name : imageUrl ? "Заменить картинку" : "Прикрепить картинку"}
        </button>
      </div>

      <div className="flex gap-2 mt-1">
        <button onClick={onCancel} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
          Отмена
        </button>
        <button onClick={handleSubmit} disabled={saving} className="flex-1 btn-primary py-2 disabled:opacity-50">
          {saving ? "Сохраняем..." : editingTask ? "Сохранить" : "Добавить"}
        </button>
      </div>
    </div>
  )
}

export function TaskBankModal({ initialExamType = "ОГЭ", onClose }) {
  const [examType, setExamType] = useState(initialExamType)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [expandedNumber, setExpandedNumber] = useState(null)

  useEffect(() => { loadTasks() }, [examType])

  async function loadTasks() {
    setLoading(true)
    const { data } = await supabase.from("tasks").select("*").eq("exam_type", examType).order("number")
    setTasks((data || []).map((t) => t.image_url ? { ...t, image_url: normalizeTaskImage(t.image_url) } : t))
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!window.confirm("Удалить задание из банка?")) return
    await supabase.from("tasks").delete().eq("id", id)
    loadTasks()
  }

  const maxNumber = TASK_NUMBERS_BY_TYPE[examType]
  const grouped = {}
  tasks.forEach((t) => { (grouped[t.number] ||= []).push(t) })
  const coveredCount = Array.from({ length: maxNumber }, (_, i) => i + 1).filter((n) => grouped[n]?.length).length

  return createPortal(
    <div className="fixed inset-0 glass-overlay z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="glass-modal p-6 w-full max-w-lg max-h-[90dvh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Банк заданий</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><Icon name="x" size={18} /></button>
          </div>

          <div className="flex gap-2 mb-4">
            {["ОГЭ", "ЕГЭ"].map((t) => (
              <button key={t} onClick={() => { setExamType(t); setShowForm(false); setEditingTask(null) }}
                className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${examType === t ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {t}
              </button>
            ))}
          </div>

          <div className="text-xs text-gray-500 mb-3">
            Заполнено номеров: <span className={coveredCount === maxNumber ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>{coveredCount} / {maxNumber}</span>
          </div>

          {showForm ? (
            <TaskForm
              examType={examType}
              editingTask={editingTask}
              onCancel={() => { setShowForm(false); setEditingTask(null) }}
              onSaved={() => { setShowForm(false); setEditingTask(null); loadTasks() }}
            />
          ) : (
            <button onClick={() => setShowForm(true)} className="btn-primary w-full py-2.5 text-sm mb-4">
              + Добавить задание
            </button>
          )}

          {loading ? (
            <div className="text-sm text-gray-400 text-center py-8">Загрузка...</div>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {Array.from({ length: maxNumber }, (_, i) => i + 1).map((n) => {
                const items = grouped[n] || []
                const isOpen = expandedNumber === n
                return (
                  <div key={n} className="border border-gray-100 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedNumber(isOpen ? null : n)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <span>Задание {n}</span>
                      <span className={items.length ? "text-xs text-gray-400" : "text-xs text-amber-600"}>
                        {items.length} шт.
                      </span>
                    </button>
                    <Collapse open={isOpen}>
                      <div className="border-t border-gray-100 divide-y divide-gray-50">
                        {items.length === 0 && (
                          <div className="px-3 py-2 text-xs text-gray-400">Заданий пока нет</div>
                        )}
                        {items.map((task) => (
                          <div key={task.id} className="px-3 py-2 flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {task.condition_text && <div className="text-xs text-gray-600 truncate">{plainTaskMath(task.condition_text)}</div>}
                              {task.image_url && (
                                <a href={task.image_url} target="_blank" rel="noreferrer">
                                  <img src={task.image_url} alt={`Задание ${task.number}`} className="mt-1 h-16 rounded border border-gray-100 bg-white" />
                                </a>
                              )}
                              <div className="text-xs text-gray-400 mt-0.5">Ответ: {task.answer}</div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => { setEditingTask(task); setShowForm(true) }} className="text-gray-400 hover:text-blue-600 p-1">
                                <Icon name="edit" size={14} />
                              </button>
                              <button onClick={() => handleDelete(task.id)} className="text-gray-400 hover:text-red-500 p-1">
                                <Icon name="x" size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Collapse>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
