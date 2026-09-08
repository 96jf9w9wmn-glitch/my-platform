import { useState } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import Reveal from "./Reveal"
import WeeksPicker from "./WeeksPicker"
import { TimeField, DurationField } from "./TimeFields"
import { getInitials, plural, parseLocalDate } from "../utils"
import getAvatarColor from "../avatarColor"
import { fmtNum } from "../num"
import { WEEK_DAYS, formatDate, generateRecurring } from "../recurring"
import { groupSchedule } from "../groups"
import { tutorLessons, findClashes, clashLine } from "../lessonConflict"

// Создание и правка группы. Группа — это состав, условия и РАСПИСАНИЕ, по
// которым он занимается; сами занятия лежат у каждого участника
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

  // Расписание группы читается из занятий участников: своего списка занятий у
  // группы нет. Открытая и сохранённая без правок группа обязана вернуть то же
  // расписание, поэтому и дни, и срок берутся из того, что уже стоит.
  const [current] = useState(() => groupSchedule(group, students))
  const [days, setDays] = useState(current.days)
  const [duration, setDuration] = useState(group?.lessonDuration || current.days[0]?.duration || 60)
  // Отсчёт всегда от сегодня: расписание меняют на будущее, а прошедшие
  // занятия уже проведены и оплачены.
  const [startDate, setStartDate] = useState(formatDate(new Date()))
  const [weeks, setWeeks] = useState(current.weeks)
  // Расписание, которого не касались, НЕ пересобирается при сохранении. Зайти
  // поправить название и молча переставить всем занятия — не то, о чём просили,
  // а разовые занятия группы в недельную сетку и вовсе не укладываются.
  const [scheduleTouched, setScheduleTouched] = useState(false)

  function touchSchedule(fn) {
    setScheduleTouched(true)
    fn()
  }

  function toggle(id) {
    setMembers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleDay(day) {
    touchSchedule(() => setDays((prev) => (
      prev.some((d) => d.name === day)
        ? prev.filter((d) => d.name !== day)
        : [...prev, { name: day, time: prev[0]?.time || "17:00", duration }]
    )))
  }

  const setDayField = (day, field, value) =>
    touchSchedule(() => setDays((prev) => prev.map((d) => (d.name === day ? { ...d, [field]: value } : d))))

  const memberList = students.filter((s) => members.has(String(s.id)))

  // Занятия, которые встанут участникам. Пока расписание не трогали, это те,
  // что уже стоят, — их и показываем, чтобы окно не выглядело пустым.
  // Само по себе расписание не удлиняется: срок берётся из того, на сколько
  // занятия расставлены сейчас, и растёт только рукой (WeeksPicker).
  const preview = scheduleTouched
    ? generateRecurring({ startDate, days, weeks, duration })
    : current.lessons

  // Пересечения считаем по ОДНОМУ занятию группы, а не по копии на каждого
  // участника: репетитор ведёт его один раз. Занятия самой группы из проверки
  // выпадают сами — lessonsClash пропускает пару с одним groupId.
  const clashes = scheduleTouched
    ? findClashes(preview.map((l) => ({ ...l, groupId: group?.id || "new" })), tutorLessons(students))
    : []

  const dropped = scheduleTouched
    ? current.lessons.filter((l) => !preview.some((p) => p.date === l.date && p.time === l.time))
    : []

  async function submit() {
    if (!name.trim()) return setError("Назовите группу")
    // Группа из одного человека — это обычные занятия один на один: она не
    // сделает ничего, чего не делает карточка ученика, зато будет вторым
    // местом, где у него стоит расписание.
    if (members.size < 2) return setError("В группе должно быть хотя бы двое")
    if (scheduleTouched && days.length && startDate < formatDate(new Date()))
      return setError("Дата начала не может быть в прошлом")
    if (clashes.length)
      return setError("Занятия группы налезают на уже назначенные. Поправьте время или дни.")
    setError("")
    setSaving(true)
    const res = await onSave({
      id: group?.id,
      name: name.trim(),
      memberIds: [...members],
      lessonPrice: Number(price) > 0 ? Number(price) : null,
      lessonDuration: duration,
      // null — «расписание не трогали»: занятия участников остаются как есть.
      schedule: scheduleTouched ? { days, lessons: preview } : null,
    })
    setSaving(false)
    if (res?.error) return setError(res.error)
    close()
  }

  // Подсказка в поле цены — то, сколько участники платят сейчас: пустое поле
  // означает ровно её, поэтому в подсказке стоит число, а не пояснение.
  const memberPrices = memberList.map((s) => Number(s?.lessonPrice) || 0).filter((v) => v > 0)
  const priceHint = memberPrices.length
    ? (Math.min(...memberPrices) === Math.max(...memberPrices)
        ? fmtNum(memberPrices[0])
        : `${fmtNum(Math.min(...memberPrices))} — ${fmtNum(Math.max(...memberPrices))}`)
    : fmtNum(2000)

  // Расчётная стоимость часа группы: за то же время репетитор получает сумму со
  // всех участников. Ради этого группы и заводят, поэтому число видно сразу.
  const perLesson = memberList.reduce(
    (sum, s) => sum + (Number(price) > 0 ? Number(price) : Number(s?.lessonPrice) || 0), 0)

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
              // Запас со всех четырёх сторон: кольцо рисуется ЗА границей
              // кнопки, и без него прокрутка срезала бы обводку у первой и
              // последней строки. Справа запас больше — там идёт полоса
              // прокрутки, и она ложилась поверх скруглённого угла.
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto -mx-1 -my-1 py-1 pl-1 pr-3">
                {students.map((s) => {
                  const on = members.has(String(s.id))
                  const color = getAvatarColor(s.name)
                  return (
                    <button key={s.id} onClick={() => toggle(String(s.id))}
                      className={"press-fill flex items-center gap-3 rounded-2xl px-3 py-2 text-left ring-1 transition-colors "
                        + (on ? "bg-blue-500/[0.08] ring-blue-500/25" : "ring-gray-200 dark:ring-white/10")}>
                      {/* Цвет аватара — пара классов (фон + текст), а не строка
                          для style: иначе кружок остаётся без фона, а белые
                          инициалы на светлом не видно вовсе. */}
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${color.bg} ${color.text}`}>
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

          {/* Расписание стоит у самой группы: занятие у неё одно на всех, и
              ставить его каждому в карточку отдельно значит семь раз повторить
              одно и то же и разойтись в первой же опечатке. */}
          <div>
            <label className="text-sm text-gray-500 mb-2 block">Дни недели и время</label>
            <div className="flex flex-col gap-2">
              {WEEK_DAYS.map((day) => {
                const selected = days.find((d) => d.name === day)
                return (
                  <div key={day} className={`rounded-xl ring-1 transition-colors ${selected ? "bg-blue-500/[0.06] ring-blue-500/25" : "ring-gray-200 dark:ring-white/10"}`}>
                    <button type="button" onClick={() => toggleDay(day)}
                      className="press-fill w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left">
                      <span className={`w-5 h-5 rounded-md grid place-items-center ring-1 transition-colors ${selected ? "bg-blue-600 ring-blue-600 text-white" : "ring-gray-300 dark:ring-white/20"}`}>
                        {selected ? <Icon name="check" size={12} /> : null}
                      </span>
                      <span className="text-sm font-medium">{day}</span>
                      {selected?.time && <span className="ml-auto text-xs font-medium text-blue-600 dark:text-blue-300">{selected.time}</span>}
                    </button>
                    {selected && (
                      <div className="px-3.5 pb-3 pt-3 border-t border-blue-500/15 flex items-center gap-2">
                        <TimeField value={selected.time} onChange={(t) => setDayField(day, "time", t)} />
                        <DurationField value={selected.duration || duration}
                          onChange={(d) => { setDuration(d); setDayField(day, "duration", d) }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <Reveal value={days.length ? "yes" : null}>
            {() => (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-sm text-gray-500 mb-1.5 block">Дата начала</label>
                  <input type="date" value={startDate} min={formatDate(new Date())}
                    onChange={(e) => touchSchedule(() => setStartDate(e.target.value))}
                    className="input-glass" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">На сколько вперёд расставить</label>
                  <WeeksPicker value={weeks} onChange={(w) => touchSchedule(() => setWeeks(w))} />
                </div>
              </div>
            )}
          </Reveal>

          <Reveal value={preview.length || null}>
            {() => (
              <div className="rounded-2xl bg-blue-500/[0.06] ring-1 ring-blue-500/15 px-3.5 py-3">
                <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                  {scheduleTouched ? "Будет поставлено" : "В расписании"} {preview.length} {plural(preview.length, "занятие", "занятия", "занятий")}
                  {memberList.length > 0 && ` у ${memberList.length} ${plural(memberList.length, "участника", "участников", "участников")}`}
                </div>
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {preview.slice(0, 40).map((l, i) => (
                    <div key={i} className="text-xs text-blue-600 dark:text-blue-300">
                      {parseLocalDate(l.date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })} в {l.time} · {l.duration || duration} мин
                    </div>
                  ))}
                  {preview.length > 40 && (
                    <div className="text-xs text-blue-600/70 dark:text-blue-300/70">и ещё {preview.length - 40}</div>
                  )}
                </div>
                {dropped.length > 0 && (
                  <div className="text-xs text-amber-600 mt-2 pt-2 border-t border-blue-500/15">
                    {dropped.length} {plural(dropped.length, "занятие", "занятия", "занятий")} из прежнего расписания будет убрано.
                  </div>
                )}
              </div>
            )}
          </Reveal>

          {clashes.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-xl px-3 py-2">
              <span className="flex-shrink-0 mt-0.5"><Icon name="warning" size={13} /></span>
              <div className="leading-relaxed flex flex-col gap-0.5">
                <span className="font-medium">Занятия налезают друг на друга</span>
                {clashes.slice(0, 3).map((hit, i) => <span key={i}>{clashLine(hit)}</span>)}
                {clashes.length > 3 && <span>и ещё {clashes.length - 3}</span>}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Цена за занятие с участника</label>
            <div className="relative">
              <input value={price ? fmtNum(price) : ""}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric" placeholder={priceHint} className="input-glass pr-8" />
              <span className="absolute right-3 top-2.5 text-sm text-gray-400">₽</span>
            </div>
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
