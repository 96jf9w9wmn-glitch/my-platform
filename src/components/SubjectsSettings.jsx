// Предметы, которые ведёт репетитор.
//
// Банк заданий устроен по типам («ОГЭ Математика», «ЕГЭ Профиль»,
// «ЕГЭ Информатика»), а анкета при регистрации спрашивает один предмет словом и
// экзамены отдельно — вывести из неё несколько типов нельзя. Поэтому выбор живёт
// здесь: отмеченные предметы и открываются потом при сборке ДЗ из банка и при
// вставке задания на доску, вместо того чтобы каждый раз выбирать заново.
//
// Ничего не отмечено — банк показывает все открытые предметы: пустая анкета не
// должна запирать раздел.
import { useState } from "react"
import Icon from "./Icon"
import { supabase } from "../supabase"
import { subjectGroups, typesFromProfile } from "../pages/examSubjectList"

const same = (a, b) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|")

export default function SubjectsSettings({ tutorId, profile, owner = false, onChange }) {
  const groups = subjectGroups({ owner })
  const visible = groups.flatMap((g) => g.subjects.map((s) => s.type))
  const saved = (Array.isArray(profile?.bank_subjects) ? profile.bank_subjects : []).filter((t) => visible.includes(t))
  // Ничего не сохранено — предлагаем то, что следует из анкеты: галочки уже
  // стоят, остаётся проверить и нажать «Сохранить». Показывать пустой список и
  // ждать, что репетитор соберёт его сам, — лишний шаг на пустом месте.
  const suggested = saved.length ? [] : typesFromProfile(profile?.subject, profile?.exam_focus).filter((t) => visible.includes(t))

  const [picked, setPicked] = useState(saved.length ? saved : suggested)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  const dirty = !same(picked, saved)

  function toggle(type) {
    setDone(false); setError("")
    setPicked((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  async function save() {
    setSaving(true); setError("")
    const { error: err } = await supabase.from("tutors").update({ bank_subjects: picked }).eq("id", tutorId)
    setSaving(false)
    if (err) { setError("Не удалось сохранить: " + err.message); return }
    onChange?.({ bank_subjects: picked })
    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }

  return (
    <div className="glass p-5 mb-4">
      <div className="text-sm font-medium mb-1">Предметы, которые вы ведёте</div>
      <p className="text-xs text-gray-500 leading-relaxed mb-4">
        Отмеченные предметы открываются в банке заданий: сборка домашней работы и задание на доску.
        {!saved.length && !picked.length && " Пока не отмечено ничего — доступны все предметы."}
      </p>

      <div className="flex flex-col gap-3.5">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="text-[11px] font-medium text-gray-400 mb-1.5">{g.key}</div>
            <div className="flex flex-wrap gap-2">
              {g.subjects.map((s) => {
                const on = picked.includes(s.type)
                return (
                  <button
                    key={s.type}
                    type="button"
                    onClick={() => toggle(s.type)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm ring-1 ring-inset transition-all active:scale-95 ${
                      on
                        ? "bg-[#007AFF]/10 text-[#007AFF] ring-[#007AFF]/25"
                        : "text-gray-600 ring-gray-200 dark:ring-white/[0.12] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${on ? "bg-[#007AFF]" : s.dot}`} />
                    {s.label}
                    {on && <Icon name="check" size={13} />}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="text-xs text-red-500 mt-3">{error}</div>}

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.06] flex items-center gap-3">
        <span className="text-xs text-gray-400 flex-1 min-w-0">
          {picked.length ? `Отмечено: ${picked.length}` : "Ни одного предмета не отмечено"}
        </span>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="shrink-0 px-5 py-2 rounded-full text-sm font-medium text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-default disabled:active:scale-100"
          style={{ background: "linear-gradient(135deg, #0A84FF 0%, #0060DF 100%)" }}
        >
          {saving ? "Сохраняем…" : done ? "Сохранено" : "Сохранить"}
        </button>
      </div>
    </div>
  )
}
