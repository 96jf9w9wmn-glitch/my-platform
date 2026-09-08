import { useState } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import { getInitials } from "../utils"
import getAvatarColor from "../avatarColor"
import { fmtNum } from "../num"

// Создание и правка группы. Группа — это состав и условия, по которым он
// занимается; сами занятия ставятся в расписании и лежат у каждого участника
// (см. шапку src/groups.js).
function GroupModal({ group = null, students = [], onSave, onDelete, onClose }) {
  const editing = !!group?.id
  const [name, setName] = useState(group?.name || "")
  const [members, setMembers] = useState(() => new Set(group?.memberIds || []))
  const [price, setPrice] = useState(group?.lessonPrice ? String(group.lessonPrice) : "")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [askDelete, setAskDelete] = useState(false)
  const { cls: closingCls, close } = useClosing(() => onClose?.())

  function toggle(id) {
    setMembers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function submit() {
    if (!name.trim()) return setError("Назовите группу")
    // Группа из одного человека — это обычные занятия один на один: она не
    // сделает ничего, чего не делает карточка ученика, зато будет вторым
    // местом, где у него стоит расписание.
    if (members.size < 2) return setError("В группе должно быть хотя бы двое")
    setError("")
    setSaving(true)
    const res = await onSave({
      id: group?.id,
      name: name.trim(),
      memberIds: [...members],
      lessonPrice: Number(price) > 0 ? Number(price) : null,
    })
    setSaving(false)
    if (res?.error) return setError(res.error)
    close()
  }

  // Расчётная стоимость часа группы: за то же время репетитор получает сумму со
  // всех участников. Ради этого группы и заводят, поэтому число видно сразу.
  const perLesson = [...members].reduce((sum, id) => {
    const s = students.find((x) => String(x.id) === String(id))
    return sum + (Number(price) > 0 ? Number(price) : Number(s?.lessonPrice) || 0)
  }, 0)

  return createPortal(
    <div className={`fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 ${closingCls}`}>
      <div className={`glass-modal w-full max-w-md flex flex-col ${closingCls}`} style={{ maxHeight: "90dvh" }}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100/60 flex-shrink-0">
          <h2 className="text-lg font-medium">{editing ? "Группа" : "Новая группа"}</h2>
          <button onClick={close} aria-label="Закрыть" className="press-tap text-gray-500 hover:text-gray-700">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Название</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-glass"
              placeholder="Например, «Девятый класс, вторник»" />
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <label className="text-sm text-gray-500">Кто занимается</label>
              <span className="text-xs text-gray-400">{members.size} из {students.length}</span>
            </div>
            {students.length === 0 ? (
              <p className="text-sm text-gray-400">Учеников пока нет — сначала пригласите их.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto -mx-1 px-1">
                {students.map((s) => {
                  const on = members.has(String(s.id))
                  return (
                    <button key={s.id} onClick={() => toggle(String(s.id))}
                      className={"press-fill flex items-center gap-3 rounded-2xl px-3 py-2 text-left ring-1 transition-colors "
                        + (on ? "bg-blue-500/[0.08] ring-blue-500/25" : "ring-gray-200 dark:ring-white/10")}>
                      <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                        style={{ background: getAvatarColor(s.name) }}>
                        {getInitials(s.name)}
                      </span>
                      <span className="flex-1 min-w-0 text-sm truncate">{s.name}</span>
                      {/* Отметка выбора — кольцо с галочкой, а не серый чекбокс:
                          заливок серым в интерфейсе нет. */}
                      <span className={"w-5 h-5 rounded-full grid place-items-center shrink-0 ring-1 "
                        + (on ? "bg-blue-600 ring-blue-600 text-white" : "ring-gray-300 dark:ring-white/20")}>
                        {on && <Icon name="check" size={12} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Цена за занятие с участника</label>
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric" className="input-glass" placeholder="Как в карточке ученика" />
            {/* Поле пустое — платят как обычно. Об этом надо сказать прямо:
                иначе непонятно, бесплатно ли занятие в группе. */}
            <p className="text-xs text-gray-400 mt-1.5">
              {Number(price) > 0
                ? "Эта цена важнее цены в карточке — по ней считаются долг и квитанции."
                : "Пусто — каждый платит столько же, сколько за занятие один на один."}
            </p>
          </div>

          {members.size > 1 && perLesson > 0 && (
            <div className="glass-sm rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5">
              <Icon name="ruble" size={14} className="text-blue-500 shrink-0" />
              <span className="text-sm">
                За одно занятие группы — {fmtNum(perLesson)} ₽
                <span className="text-gray-400"> со всех участников</span>
              </span>
            </div>
          )}
        </div>

        {error && <div className="px-6 pt-1 text-sm text-red-500 text-center flex-shrink-0">{error}</div>}

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100/60 flex-shrink-0">
          {editing && (
            <button onClick={() => setAskDelete(true)}
              className="press-fill px-3 py-2.5 rounded-xl text-sm text-red-600 ring-1 ring-red-500/25">
              Распустить
            </button>
          )}
          <button onClick={close} className="press-fill flex-1 ring-1 ring-gray-200 dark:ring-white/15 rounded-xl py-2.5 text-sm text-gray-600">
            Отмена
          </button>
          <button onClick={submit} disabled={saving} className="flex-1 btn-primary py-2.5 disabled:opacity-50">
            {saving ? "Сохраняем…" : editing ? "Сохранить" : "Создать"}
          </button>
        </div>

        {/* Роспуск группы занятий не отменяет: они уже стоят у людей в
            расписании. Сказать это надо здесь, а не выяснять потом. */}
        {askDelete && (
          <div className="absolute inset-0 glass-overlay flex items-center justify-center p-6 rounded-[inherit]">
            <div className="glass-modal w-full max-w-xs p-5 flex flex-col gap-3">
              <h3 className="text-base font-medium">Распустить группу?</h3>
              <p className="text-sm text-gray-500">
                Уже назначенные занятия останутся в расписании у каждого участника — вместе с оплатой за них.
                Пропадёт только сама группа и общий чат.
              </p>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setAskDelete(false)}
                  className="press-fill flex-1 ring-1 ring-gray-200 dark:ring-white/15 rounded-xl py-2 text-sm text-gray-600">
                  Оставить
                </button>
                <button onClick={async () => { await onDelete?.(group.id); close() }}
                  className="press-fill flex-1 rounded-xl py-2 text-sm text-white bg-red-600">
                  Распустить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default GroupModal
