import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import Icon from "../components/Icon"
import MorphIcon from "../components/MorphIcon"
import WeakTypes from "../components/WeakTypes"
import BoardHistory from "../components/BoardHistory"
import Collapse from "../components/Collapse"
import Reveal from "../components/Reveal"
import ReportComposer from "../components/ReportComposer"
import { parseLocalDate, isLessonPast, isLessonConducted, setLessonStatus, getInitials, formatPhone, contactHref, contactLabel, plural, LESSON_EXCUSED } from "../utils"
import RescheduleModal from "../components/RescheduleModal"
import StudentFormModal from "../components/StudentFormModal"
import LessonStatusModal, { LessonStatusBadge } from "../components/LessonStatusModal"
import PaymentModeModal from "../components/PaymentModeModal"
import { studentBilling, periodLabel, dayMonth } from "../billing"
import { lessonStatusNotice } from "../lessonStatus"
import {
  applyMoveToStudent, proposeMoveOnStudent, setMoveRequest,
  formatLessonWhen, formatLessonShort, MOVE_BY_TUTOR,
} from "../lessonMove"
import { tutorLessons, findClash, formatSpan } from "../lessonConflict"
import { usePlan } from "../subscription"
import { PlanLock } from "../components/PlanLock"

const MESSENGER_LABELS = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  max: "MAX",
  vk: "ВКонтакте",
  other: "Другое",
  // Instagram из выбора убран, но у контактов, записанных раньше, в базе лежит
  // «instagram» — без подписи карточка показала бы сырой идентификатор.
  instagram: "Instagram",
}


function generateParentCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}


function StudentProfile({ student, students = [], onBack, onUpdate, onOpenBoard }) {
  const { allows, openPlans } = usePlan()
  const [showEdit, setShowEdit] = useState(false)
  const [hwAvg, setHwAvg] = useState(null)
  const [hwCount, setHwCount] = useState(0)
  const [editingNote, setEditingNote] = useState(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [remarkDraft, setRemarkDraft] = useState("")
  const [remarkOpen, setRemarkOpen] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [movingLesson, setMovingLesson] = useState(null)
  // Занятие из архива, которому выбирают пометку «не состоялось».
  const [statusFor, setStatusFor] = useState(null)
  const [packageOpen, setPackageOpen] = useState(false)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])

  function copyParentCode(code) {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  function addRemark() {
    const text = remarkDraft.trim()
    if (!text) return
    const newRemark = { id: Date.now().toString(), text, date: new Date().toISOString().slice(0, 10) }
    onUpdate(student.id, { remarks: [...(student.remarks || []), newRemark] })
    setRemarkDraft("")
    setRemarkOpen(false)
  }

  function deleteRemark(id) {
    onUpdate(student.id, { remarks: (student.remarks || []).filter((r) => r.id !== id) })
  }

  useEffect(() => {
    async function loadStats() {
      const { data } = await supabase
        .from("homework")
        .select("grade")
        .eq("student_id", student.id)
        .not("grade", "is", null)
      if (data?.length) {
        setHwCount(data.length)
        setHwAvg(Math.round((data.reduce((s, h) => s + h.grade, 0) / data.length) * 10) / 10)
      }
    }
    loadStats()
  }, [student.id])

  function handleSave(data) {
    onUpdate(student.id, data)
  }

  function notifyStudent(title, body) {
    // Пока ученик не завёл аккаунт, доставить уведомление некому.
    if (!student.studentAccountId) return
    supabase.from("notifications").insert({ user_id: student.studentAccountId, title, body })
      .then(({ error }) => { if (error) console.error("Уведомление о переносе не ушло:", error.message) })
  }

  // Перенос из карточки — тот же порядок, что и в расписании: репетитор
  // предлагает, занятие переезжает после согласия ученика.
  function proposeMove(from, to, comment) {
    const request = {
      by: MOVE_BY_TUTOR,
      date: to.date,
      time: to.time,
      comment: comment || "",
      at: new Date().toISOString(),
    }
    onUpdate(student.id, proposeMoveOnStudent(student, from, request))
    notifyStudent("Репетитор предлагает перенести занятие",
      `${formatLessonWhen(from.date, from.time)} → ${formatLessonWhen(to.date, to.time)}. Подтверди перенос в кабинете.`
      + (comment ? ` «${comment}»` : ""))
  }

  // Согласие с просьбой ученика: вторая сторона уже высказалась — двигаем.
  function acceptMove(lesson) {
    const to = { date: lesson.moveRequest.date, time: lesson.moveRequest.time }
    onUpdate(student.id, applyMoveToStudent(student, lesson, to))
    notifyStudent("Перенос согласован",
      `${formatLessonWhen(lesson.date, lesson.time)} → ${formatLessonWhen(to.date, to.time)}`)
  }

  function withdrawMove(lesson) {
    const own = lesson.moveRequest?.by === MOVE_BY_TUTOR
    onUpdate(student.id, { lessons: setMoveRequest(student.lessons || [], lesson, null) })
    notifyStudent(own ? "Предложение о переносе отменено" : "Перенос не согласован",
      `Занятие ${formatLessonWhen(lesson.date, lesson.time)} остаётся на прежнем месте.`)
  }

  // Пометка «не состоялось» — та же, что в расписании: решение принимается по
  // каждому занятию, потому что репетиторы работают с пропусками по-разному.
  function applyStatus(lesson, status) {
    onUpdate(student.id, { lessons: setLessonStatus(student.lessons || [], lesson, status) })
    const [title, body] = lessonStatusNotice(status, lesson.date, lesson.time)
    notifyStudent(title, body)
  }

  // Абонемент — это оплата, а не отдельная сущность: он ложится в тот же
  // массив payments, что и обычный платёж, только с полями периода.
  // Способ оплаты — свойство ученика: сохраняется в его карточке, как цена
  // занятия. Никаких денежных записей при этом не создаётся.
  function savePaymentMode(next) {
    onUpdate(student.id, next)
    setPackageOpen(false)
  }

  function saveNote(origIdx) {
    const updatedLessons = (student.lessons || []).map((l, i) =>
      i === origIdx ? { ...l, note: noteDraft.trim() || undefined } : l
    )
    onUpdate(student.id, { lessons: updatedLessons })
    setEditingNote(null)
  }

  const future = (student.lessons || [])
    .filter((l) => {
      if (!l.date) return false
      const [y, m, d] = l.date.split("-").map(Number)
      const [h, min] = (l.time || "00:00").split(":").map(Number)
      return new Date(y, m - 1, d, h, min + (l.duration || 60)) >= new Date()
    })
    .sort((a, b) => a.date.localeCompare(b.date))
  // «Ближайшие» — это два-три занятия. Пять уже превращали блок в ленту,
  // а всё расписание целиком живёт в «Расписании»; сколько их всего впереди,
  // говорит строка внизу карточки.
  const upcoming = future.slice(0, 3)

  // Архив — по времени, а не по «проведено»: занятие, снятое со счёта, из
  // истории не исчезает, иначе решение нельзя было бы переиграть.
  const past = (student.lessons || [])
    .map((l, origIdx) => ({ ...l, _origIdx: origIdx }))
    .filter((l) => isLessonPast(l))
    .sort((a, b) => b.date.localeCompare(a.date))
  // Проведённые — те, за которые платят.
  const conducted = past.filter((l) => isLessonConducted(l))
  // Деньги целиком — долг, абонементы, оплаченное вперёд (billing.js).
  const billing = studentBilling(student)
  const pack = billing.package

  const initials = getInitials(student.name)

  const statTiles = [{
    label: "Проведено",
    value: (
      <div className="flex items-end gap-1.5">
        <div className="text-2xl font-medium">{conducted.length}</div>
        <div className="text-xs text-gray-400 mb-0.5">из {(student.lessons || []).length}</div>
      </div>
    ),
  }]
  if (hwAvg) statTiles.push({
    label: "Ср. оценка ДЗ",
    value: (
      <div className="flex items-end gap-1.5">
        <div className="text-2xl font-medium">{hwAvg}</div>
        <div className="text-xs text-gray-400 mb-0.5">/ 5 ({hwCount} зад.)</div>
      </div>
    ),
  })
  // Долг появляется, только когда есть с чего его считать: до первого
  // проведённого занятия платить не за что.
  if (conducted.length > 0) {
    const { price, debt } = billing
    statTiles.push({
      label: "Долг",
      // Без цены занятия долг посчитать не из чего: показывать «Оплачено» здесь — обман.
      value: !price ? <div className="text-sm font-medium text-gray-400 pt-1.5">Цена не указана</div>
        : debt <= 0 ? <div className="text-xl font-medium text-green-600">Нет</div>
        : <div className="text-xl font-medium text-amber-600">{debt.toLocaleString("ru-RU")} ₽</div>,
    })
  }

  return (
    <div className="p-4 md:p-6 page-active">
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
        ← Назад к ученикам
      </button>

      {/* Шапка карточки — во всю ширину, а не колонкой в 300 px. Колонка с
          профилем была вдвое выше соседней, и справа под ней зияла пустота в
          пол-экрана; заодно сюда переехали цифры по ученику — одинокая плитка
          «Проведено» занимала полосу во всю ширину ради двух знаков. */}
      <div className="glass p-4 mb-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border-2 border-gray-200 dark:border-white/15">
            {student.avatar ? (
              <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center text-xl font-medium text-blue-600 dark:text-blue-300">
                {initials}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-[10rem]">
            <h1 className="text-lg font-medium truncate">{student.name}</h1>
            {/* Расписание — в подписи к имени: отдельной строкой поля оно
                держало целую строку ради шести знаков. */}
            <div className="text-xs text-gray-500 flex items-center gap-x-3 gap-y-0.5 flex-wrap">
              <span className="flex items-center gap-1">
                <Icon name={student.isRecurring ? "repeat" : "calendar"} size={12} />
                {student.isRecurring ? "Регулярные занятия" : "Разовые занятия"}
              </span>
              {/* Разделителя между строчками нет намеренно: точка при переносе
                  оставалась висеть в конце строки или начинала следующую. */}
              {student.schedule && <span>{student.schedule}</span>}
            </div>
          </div>

          {/* Цифры прижаты к правому краю строки с именем: так шапка занята по
              всей ширине, а не обрывается на середине. */}
          <div className="flex items-end gap-6 sm:gap-8 w-full sm:w-auto sm:ml-auto">
            {statTiles.map((tile) => (
              <div key={tile.label}>
                <div className="text-[11px] text-gray-400 mb-0.5">{tile.label}</div>
                {tile.value}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3.5 pt-3.5 border-t border-gray-100 dark:border-white/10 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <div className="text-[11px] text-gray-400 mb-0.5">Телефон</div>
            <a href={`tel:${student.phone}`} className="text-sm text-blue-600 hover:opacity-70 transition-opacity">{formatPhone(student.phone)}</a>
          </div>

          {(student.contacts || []).map((c, i) => {
            const href = contactHref(c.messenger, c.url)
            const label = contactLabel(c.messenger, c.url)
            return (
              <div key={i} className="min-w-0">
                <div className="text-[11px] text-gray-400 mb-0.5">{MESSENGER_LABELS[c.messenger] || c.messenger}</div>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="block max-w-[12rem] truncate text-sm text-blue-600 hover:opacity-70 transition-opacity">{label}</a>
                ) : (
                  <span className="block max-w-[12rem] truncate text-sm text-gray-600">{label}</span>
                )}
              </div>
            )
          })}

          {/* Пояснение про вход родителя стало подписью поля: абзацем в три
              строки оно было самым заметным текстом карточки. */}
          <div>
            <div className="text-[11px] text-gray-400 mb-0.5">Код родителя · вход без пароля</div>
            {student.parent_code ? (
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono ring-1 ring-gray-200 dark:ring-white/15 px-2 py-0.5 rounded tracking-wider text-gray-700">
                  {student.parent_code}
                </code>
                <button
                  onClick={() => copyParentCode(student.parent_code)}
                  className={`text-xs flex items-center gap-1.5 transition-colors ${copiedCode ? "text-green-500" : "text-blue-500 hover:text-blue-700"}`}
                >
                  <MorphIcon from="clipboard" size={13} active={copiedCode} />
                  {copiedCode ? "Скопировано!" : "Копировать"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => onUpdate(student.id, { parent_code: generateParentCode() })}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                Создать код
              </button>
            )}
          </div>

          {/* Действия — у правого края нижней строки. Доска одна: та, что
              выбрана в карточке, наша или своя ссылка. */}
          <div className="flex items-center gap-2 ml-auto">
            {student.boardUrl ? (
              <a href={student.boardUrl} target="_blank" rel="noreferrer"
                className="press-tap flex items-center gap-1.5 text-xs bg-blue-50 text-blue-600 dark:text-blue-400 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                <Icon name="external-link" size={12} />Доска
              </a>
            ) : (
              <button onClick={() => (allows("board") ? onOpenBoard?.(student.id, student.name) : openPlans())}
                className="press-tap flex items-center gap-1.5 text-xs bg-blue-50 text-blue-600 dark:text-blue-400 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                <Icon name="clipboard" size={12} />Доска
              </button>
            )}
            {student.callUrl && (
              <a href={student.callUrl} target="_blank" rel="noreferrer"
                className="press-tap flex items-center gap-1.5 text-xs bg-green-50 text-green-600 dark:text-green-400 border border-green-100 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors">
                <Icon name="video" size={12} />Звонок
              </a>
            )}
            <button
              onClick={() => setShowEdit(true)}
              className="press-tap flex items-center gap-1.5 text-xs ring-1 ring-gray-200 dark:ring-white/15 text-gray-600 px-3 py-1.5 rounded-lg"
            >
              <Icon name="edit" size={12} />Редактировать
            </button>
          </div>
        </div>
      </div>

      {/* Отчёт родителю — во всю ширину: он про ученика целиком. */}
      <div className="mb-4">
        {allows("parentReports")
          ? <ReportComposer student={student} />
          : <PlanLock
              feature="parentReports"
              title="Отчёт родителю"
              text="Отчёт об уроке с темами, ошибками и рекомендациями — родитель открывает его по коду."
            />}
      </div>

      {/* Три карточки одним рядом. Раньше это были две колонки разной длины:
          «Ближайшие занятия» растягивались на высоту соседней колонки, и под
          тремя строками оставалось пол-экрана пустоты. Здесь высоту задаёт
          содержимое, а ряд заполнен целиком на любой ширине: на среднем экране
          два столбца, и третья карточка занимает оставшийся ряд целиком. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-stretch">
        <div className="glass p-4 flex flex-col">
          <h2 className="text-sm font-medium mb-3">Ближайшие занятия</h2>
          {upcoming.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-4">Нет предстоящих занятий</div>
          ) : (
            <div className="flex flex-col gap-1">
              {upcoming.map((l, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {parseLocalDate(l.date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}
                    </div>
                    <div className="text-xs text-gray-400">
                      {l.time} · {l.duration} мин
                      {l.movedFrom && <span> · перенесено с {formatLessonShort(l.movedFrom.date, l.movedFrom.time)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {l.moveRequest ? (
                      <span className="text-xs bg-amber-500/12 text-amber-600 px-2 py-1 rounded-full">
                        {l.moveRequest.by === MOVE_BY_TUTOR ? "Ждёт ответа" : "Просит перенос"}
                        {" · "}{formatLessonShort(l.moveRequest.date, l.moveRequest.time)}
                      </span>
                    ) : (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">Запланировано</span>
                    )}
                    {l.moveRequest && l.moveRequest.by !== MOVE_BY_TUTOR && (
                      <button
                        onClick={() => acceptMove(l)}
                        className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg transition active:scale-95"
                      >
                        Согласиться
                      </button>
                    )}
                    <button
                      onClick={() => setMovingLesson({
                        date: l.date, time: l.time, duration: l.duration,
                        suggested: l.moveRequest ? { date: l.moveRequest.date, time: l.moveRequest.time, comment: l.moveRequest.comment } : null,
                        fromStudent: l.moveRequest && l.moveRequest.by !== MOVE_BY_TUTOR,
                      })}
                      aria-label="Предложить перенос"
                      title="Предложить перенос"
                      className="text-gray-400 hover:text-blue-600 transition-transform active:scale-90"
                    >
                      <Icon name="repeat" size={15} />
                    </button>
                    {l.moveRequest && (
                      <button
                        onClick={() => withdrawMove(l)}
                        aria-label={l.moveRequest.by === MOVE_BY_TUTOR ? "Отменить предложение" : "Отклонить просьбу"}
                        title={l.moveRequest.by === MOVE_BY_TUTOR ? "Отменить предложение" : "Отклонить"}
                        className="text-gray-400 hover:text-red-500 transition-transform active:scale-90"
                      >
                        <Icon name="x" size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Сколько занятий впереди всего: в списке их только три, и строка
              заодно держит низ карточки, чтобы ряд оставался ровным. */}
          <div className="mt-auto pt-3 flex items-baseline justify-between gap-2">
            <span className="text-xs text-gray-400">Впереди занятий</span>
            <span className="text-sm font-medium">{future.length}</span>
          </div>
        </div>

        {/* Способ оплаты. Здесь он только НАСТРАИВАЕТСЯ — сами деньги живут в
            «Финансах», как и у поштучной оплаты. Абонемент не заводит второй
            денежный поток: он лишь меняет момент начисления долга, поэтому
            никакого «остатка» и «ждёт оплаты» тут нет. */}
        <div className="glass p-4 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="text-sm font-medium">Оплата</div>
            <button
              onClick={() => setPackageOpen(true)}
              className="press-tap text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              Настроить
            </button>
          </div>

          {pack ? (
            <>
              <div className="text-sm text-gray-700">
                Абонементом · {periodLabel(pack.period).toLowerCase()}
              </div>
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                Текущий период — {dayMonth(pack.from)} — {dayMonth(pack.until)},
                {" "}{pack.lessons} {plural(pack.lessons, "занятие", "занятия", "занятий")}.
                Долг за него начислен целиком, оплата вносится в «Финансах».
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-gray-700">За занятие</div>
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                Долг растёт по мере проведения занятий. Абонементом ученик платит
                вперёд — за неделю, две недели или месяц сразу.
              </div>
            </>
          )}

          {/* Цена занятия — основа всего долга; mt-auto держит строку у нижнего
              края, чтобы карточка ровно занимала высоту ряда. */}
          <div className="mt-auto pt-3 flex items-baseline justify-between gap-2">
            <span className="text-xs text-gray-400">Цена занятия</span>
            <span className="text-sm font-medium">
              {billing.price ? `${billing.price.toLocaleString("ru-RU")} ₽` : "не указана"}
            </span>
          </div>
        </div>

        {/* Замечания. Поле ввода спрятано за кнопкой: пишут их редко, а открытая
            форма занимала треть карточки на каждом заходе. На среднем экране
            карточка занимает оставшийся ряд целиком — иначе рядом с ней
            оставалась бы пустая половина. */}
        <div className="glass p-4 flex flex-col min-h-0 md:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Замечания для родителей</div>
            {((student.remarks || []).length > 0 || remarkOpen) && (
              <button
                onClick={() => setRemarkOpen((v) => !v)}
                className="press-tap text-xs text-blue-500 hover:text-blue-700 transition-colors"
              >
                {remarkOpen ? "Отмена" : "+ Замечание"}
              </button>
            )}
          </div>
          {/* Пока замечаний нет, поле для первого занимает всю оставшуюся
              высоту карточки — ряд остаётся ровным, без провала внизу. */}
          {(student.remarks || []).length === 0 && !remarkOpen && (
            <button
              onClick={() => setRemarkOpen(true)}
              className="mt-3 flex-1 min-h-20 w-full border-2 border-dashed border-gray-200 dark:border-white/15 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              Что передать родителям
            </button>
          )}
          <div className={`flex flex-col gap-2 min-h-0 overflow-y-auto ${(student.remarks || []).length > 0 ? "mt-3 flex-1" : ""}`}>
            {(student.remarks || []).length > 0 && (
              [...(student.remarks || [])].reverse().map((r) => (
                <div key={r.id} className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700">{r.text}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{r.date}</div>
                  </div>
                  <button
                    onClick={() => deleteRemark(r.id)}
                    className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0 mt-0.5"
                  >✕</button>
                </div>
              ))
            )}
          </div>
          <Collapse open={remarkOpen}>
            <div className="flex flex-col gap-2 pt-3">
              <textarea
                value={remarkDraft}
                onChange={(e) => setRemarkDraft(e.target.value)}
                placeholder="Написать замечание..."
                rows={2}
                className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={addRemark}
                disabled={!remarkDraft.trim()}
                className="press-tap px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-40 self-end"
              >
                Добавить
              </button>
            </div>
          </Collapse>
        </div>
      </div>

      {/* Разделы, которых у нового ученика ещё нет, идут во всю ширину ниже
          ряда: пустой ячейкой в сетке они оставляли бы дыру, а сами по себе
          просто не появляются, пока нечего показывать. */}
      <div className="flex flex-col gap-4 mt-4">
        <WeakTypes studentId={student.id} studentName={student.name} />

        {/* Доски прошлых занятий — блока нет, пока ни одной не сохранено */}
        {allows("boardHistory")
          ? <BoardHistory studentId={student.id} studentName={student.name}
              onOpenBoard={() => (allows("board") ? onOpenBoard?.(student.id, student.name) : openPlans())} />
          : <PlanLock
              feature="boardHistory"
              title="Доски занятий"
              text="Снимки доски за каждое занятие: можно вернуться к разобранной задаче через месяц."
            />}
      </div>

      {/* Архив — во всю ширину и со своей прокруткой. В колонке он вытягивал
          страницу на десятки занятий, а соседняя растягивалась вслед за ним
          пустой рамкой. Счётчик на кнопке показывает, сколько внутри, не
          открывая её. */}
      <div className="glass p-4 mt-4">
        <button
          onClick={() => setArchiveOpen((v) => !v)}
          className="press-fill w-full flex items-center justify-between gap-2 rounded-lg text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Icon name="archive" size={15} className="text-gray-400" />
            Архив занятий
            <span className="text-[11px] font-normal text-gray-500 ring-1 ring-gray-200/70 dark:ring-white/15 px-1.5 py-0.5 rounded-full tabular-nums">
              {past.length}
            </span>
          </span>
          <Icon name="chevron-down" size={14}
            className={`text-gray-400 transition-transform duration-300 ${archiveOpen ? "rotate-180" : ""}`} />
        </button>

        <Collapse open={archiveOpen}>
          {/* Своя прокрутка, а не весь список наружу: занятий за год — десятки. */}
          <div className="pt-3 max-h-[24rem] overflow-y-auto pr-1">
            {past.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">Занятий ещё не было</div>
            ) : (
              <div className={`grid gap-2 ${(editingNote !== null || isMobile) ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-3"}`}>
          {past.map((l) => (
            <div key={l._origIdx} className={`flex flex-col py-2 px-3 glass-sm gap-1 ${l.status === LESSON_EXCUSED ? "opacity-70" : ""}`}>
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="text-sm flex items-center gap-1.5 flex-wrap">
                    {parseLocalDate(l.date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}
                    <LessonStatusBadge status={l.status} />
                  </div>
                  <div className="text-xs text-gray-400">{l.time} · {l.duration} мин</div>
                </div>
                {/* Обе иконки — одной группой у правого края: врозь justify-between
                    растаскивал их по разным углам, и «не состоялось» оказывалась
                    посреди карточки только у занятий с заметкой. */}
                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                  <button
                    onClick={() => setStatusFor({ date: l.date, time: l.time, duration: l.duration, status: l.status })}
                    aria-label="Занятие не состоялось"
                    title="Не состоялось"
                    className={`no-press transition-colors ${l.status ? "text-amber-500 hover:text-amber-600" : "text-gray-300 dark:text-white/25 hover:text-amber-500"}`}
                  >
                    <Icon name="user-x" size={15} />
                  </button>
                  {l.note && editingNote !== l._origIdx && (
                    <button
                      className="no-press text-blue-400 hover:text-blue-600 transition-colors"
                      onClick={() => { setEditingNote(l._origIdx); setNoteDraft(l.note || "") }}
                    >
                      <Icon name="clipboard" size={15} />
                    </button>
                  )}
                </div>
              </div>
              {l.note && editingNote !== l._origIdx && (
                <div className="text-xs text-gray-500 leading-relaxed">{l.note}</div>
              )}
              {!l.note && editingNote !== l._origIdx && (
                <button
                  /* Серым по светлому «+ заметка» не читалась вовсе — теперь
                     это видимое действие, а не призрак. */
                  className="no-press text-xs text-blue-500/80 hover:text-blue-600 transition-colors text-left"
                  onClick={() => { setEditingNote(l._origIdx); setNoteDraft("") }}
                >
                  + заметка
                </button>
              )}
              {/* Поле заметки не только появляется, но и УХОДИТ плавно: «Отмена»
                  и «Сохранить» раньше снимали его в тот же кадр, и строка
                  занятия дёргалась. Значение — сам индекс, а не флаг: у первого
                  занятия он 0, и `open` в Reveal считает пустыми только
                  null/undefined/false/"" — ноль остаётся открытым. */}
              <Reveal value={editingNote === l._origIdx ? l._origIdx : null}>{() => (
                <div className="mt-1">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Что прошли, комментарий после урока..."
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-none bg-white/80"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      onClick={() => setEditingNote(null)}
                      className="no-press text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={() => saveNote(l._origIdx)}
                      className="no-press text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              )}</Reveal>
            </div>
          ))}
              </div>
            )}
          </div>
        </Collapse>
      </div>

      {showEdit && (
        <StudentFormModal
          student={student}
          students={students}
          onClose={() => setShowEdit(false)}
          onSubmit={handleSave}
        />
      )}

      {packageOpen && (
        <PaymentModeModal
          student={student}
          onSubmit={savePaymentMode}
          onClose={() => setPackageOpen(false)}
        />
      )}

      {statusFor && (
        <LessonStatusModal
          lesson={statusFor}
          who={student.name}
          onPick={(status) => applyStatus(statusFor, status)}
          onClose={() => setStatusFor(null)}
        />
      )}

      {movingLesson && (
        <RescheduleModal
          lesson={movingLesson}
          who={student.name}
          title="Предложить перенос"
          hint={movingLesson.fromStudent
            ? "Время, которое просит ученик, уже подставлено. Поправьте, если не подходит, — ученику уйдёт встречное предложение."
            : "Занятие переедет, когда ученик подтвердит перенос. До этого оно остаётся на прежнем месте."}
          initial={movingLesson.suggested}
          commentLabel="Комментарий ученику (по желанию)"
          commentPlaceholder="Например: в это время у меня появилось окно"
          conflictCheck={(date, time) => {
            // Сравниваем отрезки времени, а не начало занятия: час с 14:30
            // перекрывает 15:00. И смотрим расписание целиком — репетитор не
            // ведёт двоих одновременно.
            const hit = findClash(
              { date, time, duration: movingLesson.duration || student.lessonDuration || 60 },
              tutorLessons(students.length ? students : [student]),
              { skip: movingLesson, skipStudentId: student.id },
            )
            if (!hit) return null
            const who = String(hit.studentId) === String(student.id) ? "у ученика" : `у вас (${hit.studentName})`
            return `На это время ${who} уже стоит занятие: ${formatSpan(hit)}.`
          }}
          submitLabel="Предложить"
          onSubmit={({ date, time, comment }) => {
            proposeMove({ date: movingLesson.date, time: movingLesson.time, duration: movingLesson.duration }, { date, time }, comment)
            setMovingLesson(null)
          }}
          onClose={() => setMovingLesson(null)}
        />
      )}
    </div>
  )
}

export default StudentProfile
