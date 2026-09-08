import { useState } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import WheelPicker from "./WheelPicker"
import DurationPicker from "./DurationPicker"
import { tutorLessons, findClash, clashLine } from "../lessonConflict"
import { todayDateStr } from "../lessonMove"
import { GROUP_PREFIX, isGroupChatId as isGroupTarget, groupIdOfChat as groupIdOfTarget, groupMembers } from "../groups"

// Разовое занятие ставится одинаково из расписания и из карточки ученика,
// поэтому форма одна на оба места. Разница ровно в двух вещах: в карточке
// ученик уже выбран (поле не показывается), а из календаря приходит выбранный
// день — второй раз его не спрашиваем.
// Родитель монтирует модалку условно, поэтому каждое открытие начинается с
// чистого листа: прошлое время и ученик во второй раз не всплывают.
// Цель занятия — либо ученик (его id), либо группа (`g:<id>`, тот же вид
// адреса, что у чата). Группа не заводит второй формы: занятие у неё то же
// самое, просто ложится сразу всем участникам.
function AddLessonModal({ students = [], groups = [], studentId = "", date = "", onAdd, onClose }) {
  const fixedStudent = !!studentId
  const [form, setForm] = useState({
    studentId: studentId ? String(studentId) : "",
    date: date || "",
    time: "",
    duration: "",
  })
  const [dateFixed, setDateFixed] = useState(!!date)
  const [error, setError] = useState("")
  const { cls: closingCls, close } = useClosing(() => onClose?.())

  const group = isGroupTarget(form.studentId)
    ? groups.find((g) => g.id === groupIdOfTarget(form.studentId))
    : null
  const student = group ? null : students.find((s) => String(s.id) === String(form.studentId))
  const members = group ? groupMembers(group, students) : []
  // Длительность по умолчанию: у группы своя, у ученика своя, иначе час.
  const baseDuration = group?.lessonDuration || student?.lessonDuration || 60

  // Занятие, на которое налезает то, что сейчас набирается. Считаем на каждый
  // рендер: время и длительность меняются кнопками, и предупреждение должно
  // поспевать за ними, а не появляться после ошибки.
  function clash() {
    if (!form.studentId || !form.date || !form.time) return null
    const duration = Number(form.duration) || baseDuration
    const candidate = { date: form.date, time: form.time, duration }
    // Занятия самой группы своим же не мешают: репетитор ведёт их разом.
    const hit = findClash(candidate, tutorLessons(students).filter((l) => !group || l.groupId !== group.id))
    return hit ? { lesson: candidate, other: hit } : null
  }

  function submit() {
    if (!form.studentId || !form.date || !form.time) {
      setError(fixedStudent ? "Выберите дату и время." : "Выберите, кому назначить занятие, дату и время.")
      return
    }
    // Группу могли распустить в другой вкладке, пока форма была открыта.
    if (isGroupTarget(form.studentId) && !group) {
      setError("Эта группа больше не существует.")
      return
    }
    // Занятие задним числом не ставится: расписание — это план, а прошедшее
    // занятие сразу попало бы в долг и в отчёт родителю как проведённое.
    if (form.date < todayDateStr()) {
      setError("Занятие нельзя поставить на прошедший день.")
      return
    }
    // Два занятия в одно время — не опечатка, которую можно молча сохранить:
    // репетитор физически не проведёт оба.
    const hit = clash()
    if (hit) {
      setError(`Это время занято. ${clashLine(hit)}`)
      return
    }
    setError("")
    const duration = Number(form.duration) || baseDuration
    onAdd(form.studentId, { date: form.date, time: form.time, duration, extra: true })
    close()
  }

  const formClash = clash()

  return createPortal(
    <div className={`fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 ${closingCls}`}>
      <div className={`glass-modal w-full max-w-sm flex flex-col ${closingCls}`} style={{ maxHeight: "90dvh" }}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100/60 flex-shrink-0">
          <h2 className="text-lg font-medium">Новое занятие</h2>
          <button onClick={close} aria-label="Закрыть" className="text-gray-500 hover:text-gray-700"><Icon name="x" size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 flex flex-col gap-4">
          {/* В карточке ученика выбирать некого — он и есть ученик. */}
          {!fixedStudent && (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Кому</label>
              <select value={form.studentId} onChange={(e) => setForm((p) => ({ ...p, studentId: e.target.value }))}
                className="input-glass">
                <option value="">Выберите ученика или группу</option>
                {/* Группы первыми и отдельным разделом: иначе они теряются
                    среди учеников, а именно ради них список и стал общим. */}
                {groups.length > 0 && (
                  <optgroup label="Группы">
                    {groups.map((g) => (
                      <option key={g.id} value={GROUP_PREFIX + g.id}>{g.name}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Ученики">
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              </select>
              {/* Состав виден до постановки: занятие ляжет каждому из них, и
                  узнавать об этом постфактум не годится. */}
              {group && (
                <p className="text-xs text-gray-400 mt-1.5">
                  {members.length ? `Занятие встанет в расписание всем: ${members.map((m) => m.name).join(", ")}.`
                                  : "В группе никого не осталось — некому ставить занятие."}
                </p>
              )}
            </div>
          )}
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Дата</label>
            {dateFixed ? (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl ring-1 ring-inset ring-gray-200 dark:ring-white/[0.12]">
                <Icon name="calendar" size={15} className="text-blue-500 flex-shrink-0" />
                <span className="text-sm flex-1 min-w-0 truncate">
                  {new Date(form.date + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
                </span>
                <button onClick={() => setDateFixed(false)}
                  className="press-fill text-xs text-blue-600 rounded-lg px-2 py-1 flex-shrink-0">
                  Изменить
                </button>
              </div>
            ) : (
              <input type="date" value={form.date} min={todayDateStr()}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="input-glass" />
            )}
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-2 block">Время</label>
            {/* Колесо вместо сетки из двенадцати часов: та занимала треть
                окна и всё равно не давала поставить занятие на 8:30. */}
            <WheelPicker value={form.time || "09:00"}
              onChange={(time) => setForm((p) => ({ ...p, time }))} />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-2 block">Длительность</label>
            {/* Ползунком, а не пятью кнопками: занятие на 75 или 100 минут
                прежним набором было не поставить вовсе. */}
            {/* Пока длительность не тронули, показываем ту, с которой этот
                ученик занимается обычно, — её же подставит сохранение. */}
            <DurationPicker
              value={form.duration}
              fallback={baseDuration}
              onChange={(d) => setForm((p) => ({ ...p, duration: String(d) }))} />
          </div>
          {formClash && (
            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-xl px-3 py-2">
              <span className="flex-shrink-0 mt-0.5"><Icon name="warning" size={13} /></span>
              <span className="leading-relaxed">Это время занято. {clashLine(formClash)}</span>
            </div>
          )}
        </div>
        <div className="px-6 pt-1 flex-shrink-0">
          {error && <div className="text-sm text-red-500 text-center">{error}</div>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100/60 flex-shrink-0">
          <button onClick={close} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-blue-500/[0.06]">Отмена</button>
          <button onClick={submit} className="flex-1 btn-primary py-2.5">Добавить</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default AddLessonModal
