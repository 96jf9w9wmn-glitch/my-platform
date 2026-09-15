import { useMemo } from "react"
import Icon from "./Icon"
import DateTile from "./DateTile"
import ExamProgress from "./ExamProgress"
import { TILE_TINTS, dueTintKey } from "../dueTint"
import { parseLocalDate, getInitials, plural, timeUntilLesson, isLessonConducted } from "../utils"
import { studentBilling } from "../billing"
import { fmtNum } from "../num"

// Главная кабинета ученика.
//
// Экран отвечает на один вопрос — ЧТО ДЕЛАТЬ СЕЙЧАС, — и уже потом на все
// остальные. До этой версии он был устроен наоборот: сверху стояла карточка с
// собственным именем и телефоном (ученик их знает), затем четыре плитки
// отчётности, а ни одного задания на главной не было вовсе — за ними надо было
// уходить во вкладку. Отсюда и ощущение пустоты: блоки есть, дела нет.
//
// Порядок теперь такой: приветствие со сводкой дня → «Что сделать» и ближайшее
// занятие → полоса показателей → готовность к экзамену → расписание → репетитор
// и доски. Карточки НЕ равнозначны: цветная только одна (занятие), остальные
// стеклянные и тихие — иначе экран снова читается как список прямоугольников.
//
// Своей арифметики здесь нет: баллы приходят из examStats, деньги из billing.js,
// готовность считает тот же ExamProgress, что и «Результаты».

// Срок словами. Дата в плитке слева уже сказала «когда», подпись говорит
// «насколько это срочно» — и молчит, когда срока нет.
function dueNote(deadline) {
  if (!deadline) return null
  const d = parseLocalDate(deadline)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((d - today) / 86400000)
  if (days < 0) return { text: "Просрочено", tone: "text-red-500 font-medium" }
  if (days === 0) return { text: "Сдать сегодня", tone: "text-amber-600 dark:text-amber-400 font-medium" }
  if (days === 1) return { text: "Сдать завтра", tone: "text-amber-600 dark:text-amber-400" }
  return { text: `Сдать до ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`, tone: "text-gray-400" }
}

// Строка дела: плитка срока (или иконка, если срока нет), название, подпись.
// Вид общий у задания и варианта намеренно — для ученика это одна очередь дел,
// а не два разных списка.
function TodoRow({ item, index, onOpen }) {
  const due = dueNote(item.deadline)
  return (
    <button
      onClick={() => onOpen(item)}
      style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
      className="item-enter press-fill w-full text-left rounded-2xl px-2.5 py-2 -mx-1 flex items-center gap-3 transition-colors hover:bg-blue-500/[0.06]"
    >
      {item.deadline ? (
        <DateTile date={item.deadline} tint={TILE_TINTS[dueTintKey(item.deadline)]} className="w-11 h-11" />
      ) : (
        <div className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br ${TILE_TINTS.blue}`}>
          <Icon name={item.kind === "variant" ? "file-text" : "clipboard"} size={18} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{item.title}</div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] min-w-0">
          <span className="text-gray-400 shrink-0">{item.kindLabel}</span>
          {(item.note || due) && <span className="text-gray-400">•</span>}
          <span className={`truncate ${item.note ? "text-amber-600 dark:text-amber-400" : due?.tone || "text-gray-400"}`}>
            {item.note || due?.text}
          </span>
        </div>
      </div>
      <Icon name="chevron-right" size={16} className="text-gray-400 shrink-0" />
    </button>
  )
}

// Показатель в полосе. Заливки у сегмента нет — только волосяной разделитель и
// тонированное кольцо у значка: серая подложка на стекле читается как пятно.
function Metric({ icon, tone, value, unit, sub, onClick }) {
  const TONE = {
    blue: "text-blue-600 dark:text-blue-300 bg-blue-500/10 ring-blue-500/20",
    green: "text-green-700 dark:text-green-300 bg-green-500/10 ring-green-500/20",
    amber: "text-amber-700 dark:text-amber-300 bg-amber-500/10 ring-amber-500/25",
    red: "text-red-600 dark:text-red-300 bg-red-500/10 ring-red-500/20",
    purple: "text-purple-700 dark:text-purple-300 bg-purple-500/10 ring-purple-500/20",
  }
  return (
    <button
      onClick={onClick}
      className="press-fill basis-1/2 sm:basis-0 flex-1 min-w-0 flex items-center gap-3 px-3.5 sm:px-4 py-3.5 text-left transition-colors hover:bg-blue-500/[0.05]"
    >
      <span className={`w-9 h-9 rounded-xl hidden sm:flex items-center justify-center shrink-0 ring-1 ${TONE[tone] || TONE.blue}`}>
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0">
        <span className={`block text-xl font-semibold leading-none tabular-nums truncate ${(TONE[tone] || TONE.blue).split(" ")[0]}`}>
          {value}
          {unit && <span className="text-xs font-normal text-gray-400"> {unit}</span>}
        </span>
        <span className="block text-[11px] text-gray-400 mt-1.5 truncate">{sub}</span>
      </span>
    </button>
  )
}

function StudentHome({
  student, user, avatar, initials, onAvatarClick,
  tutorName, lessonSubject, onAddTutor,
  next, minuteTick, onOpenBoard, callUrl,
  upcoming = [], pendingMoves = [], moveError, onRequestMove, moveAnchorId, moveNotes,
  homework = [], variants = [], stats, hwStats, variantAvg, variantAvgMax, streak,
  onOpenTab, onOpenHomework, onOpenVariant,
  parentCode, calendar, boardHistory,
}) {
  // Очередь дел — задания и варианты в одном списке: для ученика это одна
  // стопка работы, а не два раздела. Просроченное и ближнее наверху, работа без
  // срока — в конце: её можно сделать когда угодно.
  const todos = useMemo(() => {
    const items = []
    for (const h of homework || []) {
      if (h.status !== "assigned" && h.status !== "revision") continue
      items.push({
        kind: "hw", key: `h${h.id}`, row: h, title: h.title || "Задание",
        kindLabel: "Задание", deadline: h.deadline || null,
        note: h.status === "revision" ? "Вернули на доработку" : null,
      })
    }
    for (const v of variants || []) {
      const st = v.submission?.status
      if (st === "graded" || st === "submitted") continue
      items.push({
        kind: "variant", key: `v${v.id}`, row: v, title: v.title || "Вариант",
        kindLabel: v.type || "Вариант", deadline: v.deadline || null,
        note: v.submission?.opened_at ? "Работа начата" : null,
      })
    }
    const at = (x) => (x.deadline ? parseLocalDate(x.deadline).getTime() : Infinity)
    return items.sort((a, b) => at(a) - at(b))
  }, [homework, variants])

  const overdue = todos.filter((t) => t.deadline && dueNote(t.deadline).text === "Просрочено").length
  const firstName = (user?.profile?.name || student?.name || "").trim().split(/\s+/)[0]

  // Сводка дня одной строкой — то, что сказал бы репетитор, встретив ученика:
  // сначала занятие, потом работа, потом просрочка.
  const summary = (() => {
    const parts = []
    if (next?.lesson) {
      parts.push(next.inProgress
        ? "Занятие идёт прямо сейчас"
        : next.isToday ? `Сегодня занятие в ${next.lesson.time}` : `Занятие ${next.dateLabel} в ${next.lesson.time}`)
    }
    if (overdue > 0) parts.push(`${overdue} ${plural(overdue, "работа просрочена", "работы просрочены", "работ просрочено")}`)
    else if (todos.length) parts.push(`${todos.length} ${plural(todos.length, "работа ждёт", "работы ждут", "работ ждут")}`)
    if (!parts.length) return "Всё сдано — ничего не горит"
    return parts.join(" · ")
  })()

  // «Проведено» считается тем же предикатом, что и деньги (isLessonConducted):
  // снятое со счёта занятие не проведено ни для оплаты, ни для этой цифры.
  const conducted = (student?.lessons || []).filter((l) => isLessonConducted(l)).length
  const billing = studentBilling(student || {})
  const hwAvg = hwStats?.avgGrade

  // Полоса показателей. Собирается списком, а не четырьмя кусками разметки:
  // показатель без числа из неё выпадает целиком (у нового ученика полоса
  // прочерков сообщала ровно ничего и занимала целую строку экрана).
  const metrics = []
  if (hwAvg != null) {
    metrics.push({
      key: "hw", icon: "clipboard", onClick: () => onOpenTab("results"),
      tone: hwAvg >= 4.5 ? "green" : hwAvg >= 3.5 ? "blue" : hwAvg >= 2.5 ? "amber" : "red",
      value: hwAvg, unit: "/ 5",
      sub: `${hwStats.gradedCount} ${plural(hwStats.gradedCount, "оценка", "оценки", "оценок")} за задания`,
    })
  }
  if (variantAvg != null) {
    // Цвет — по доле от максимума, а не по абсолютному числу: у ЕГЭ балл
    // тестовый (до 100), у ОГЭ первичный (до 32), и один порог на двоих врал бы.
    const pct = variantAvgMax ? (variantAvg / variantAvgMax) * 100 : 0
    metrics.push({
      key: "var", icon: "bar-chart", onClick: () => onOpenTab("results"),
      tone: pct >= 75 ? "green" : pct >= 50 ? "blue" : "amber",
      value: variantAvg, unit: variantAvgMax ? `/ ${variantAvgMax}` : null,
      sub: `${stats.rows.length} ${plural(stats.rows.length, "вариант", "варианта", "вариантов")} решено`,
    })
  }
  // Серия важнее числа проведённых занятий: она про привычку ученика, а
  // «проведено 1 из 1» — строка из отчётности репетитора.
  if (streak?.best > 0) {
    metrics.push({
      key: "streak", icon: "flame", tone: "amber", onClick: () => onOpenTab("homework"),
      value: streak.current, unit: plural(streak.current, "работа", "работы", "работ"),
      sub: streak.best > streak.current ? `в срок · рекорд ${streak.best}` : "подряд сданы в срок",
    })
  } else if (conducted > 0) {
    metrics.push({
      key: "lessons", icon: "calendar", tone: "blue", onClick: () => onOpenTab("payment"),
      value: conducted, unit: plural(conducted, "занятие", "занятия", "занятий"), sub: "проведено",
    })
  }
  if (billing.accrued?.length) {
    metrics.push({
      key: "money", icon: "ruble", tone: billing.debt > 0 ? "amber" : "green",
      onClick: () => onOpenTab("payment"),
      value: billing.debt > 0 ? `${fmtNum(billing.debt)} ₽` : "Оплачено",
      sub: billing.debt > 0 ? "к оплате" : billing.price ? `${fmtNum(billing.price)} ₽ за занятие` : "долга нет",
    })
  }

  const examDays = student?.examDate ? Math.ceil((parseLocalDate(student.examDate) - new Date().setHours(0, 0, 0, 0)) / 86400000) : null

  return (
    <div className="flex flex-col gap-4">

      {/* ПРИВЕТСТВИЕ. Не карточка: экран должен начинаться с человека и его дня,
          а не с ещё одного стеклянного прямоугольника. Аватар оставлен здесь
          вместе с кнопкой съёмки — это единственное место, где ученик его меняет. */}
      <div className="flex items-center gap-3.5 sm:gap-4 px-0.5 pt-0.5">
        <button
          onClick={onAvatarClick}
          aria-label="Сменить фотографию"
          className="relative shrink-0 rounded-full press-tap active:scale-95 transition-transform"
        >
          {avatar ? (
            <img src={avatar} alt="" className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover ring-1 ring-white/60 dark:ring-white/10" />
          ) : (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-xl font-semibold text-white">
              {initials}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-md ring-2 ring-white/80 dark:ring-[#1c1c1e]">
            <Icon name="camera" size={11} className="text-white" />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          {/* Системное начертание, а не витринное: засечки живут на лендинге и
              в приветствии после регистрации, а рабочий кабинет весь набран
              SF Pro — серифный заголовок читался в нём как чужая вставка. */}
          <h1 className="page-title text-[22px] sm:text-[26px] font-semibold tracking-tight leading-tight truncate">
            {firstName ? `Привет, ${firstName}` : "Привет"}
          </h1>
          <p className="page-subtitle text-sm mt-0.5 line-clamp-2">{summary}</p>
        </div>

        {/* Отсчёт до экзамена — единственная цифра, которую ученик хочет видеть
            каждый раз, и её негде было взять без перехода в «Результаты». */}
        {examDays != null && examDays >= 0 && (
          <button
            onClick={() => onOpenTab("results")}
            className="press-tap hidden sm:flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2 ring-1 ring-blue-500/25 hover:bg-blue-500/[0.06] transition-colors"
          >
            <Icon name="target" size={15} className="text-blue-600 dark:text-blue-300" />
            <span className="text-left leading-tight">
              <span className="block text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-300">
                {examDays} {plural(examDays, "день", "дня", "дней")}
              </span>
              <span className="block text-[10px] text-gray-400">до {student.goal || "экзамена"}</span>
            </span>
          </button>
        )}
      </div>

      {/* ФОКУС ЭКРАНА: слева занятие, справа работа. Всё остальное ниже. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] gap-4 items-stretch">

        {/* Левая колонка — всё про занятия: ближайшее и то, что за ним.
            Отдельной строкой ниже расписание стояло зря: две карточки об одном
            и том же расходились по экрану, а рядом с занятием оставался воздух. */}
        <div className="flex flex-col gap-4">
        {/* Ближайшее занятие — единственная цветная карточка экрана. Вход в
            занятие (доска, звонок) живёт только здесь, чтобы его не искали. */}
        {next?.lesson ? (
          <div className="next-lesson-card relative overflow-hidden rounded-2xl p-5 flex flex-col bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25">
            {/* Метка дня и отсчёт — отдельной строкой сверху: на телефоне чип
                отсчёта отнимал ширину у имени репетитора, и оно обрезалось. */}
            <div className="relative flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-medium opacity-70 uppercase tracking-wide truncate">
                {next.inProgress ? "Текущее занятие" : next.isToday ? "Сегодня" : next.dateLabel}
              </span>
              <span className="shrink-0 text-[13px] font-medium tabular-nums bg-[rgba(255,255,255,0.2)] rounded-full px-2.5 py-1 backdrop-blur-sm">
                {next.inProgress
                  ? <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />Идёт</span>
                  : minuteTick >= 0 && timeUntilLesson(next.lesson.date, next.lesson.time)}
              </span>
            </div>

            <div className="relative flex items-center gap-3.5 min-w-0 mb-4">
              {/* bg-[rgba(...)] вместо bg-white/20: классы bg-white/N глобально
                  гасятся под .dark, а карточка синяя в обеих темах */}
              <div className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-base font-semibold bg-[rgba(255,255,255,0.2)] ring-2 ring-white/30 backdrop-blur-sm">
                {getInitials(tutorName || "Репетитор")}
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-semibold leading-tight truncate">{next.lesson.time}</div>
                <div className="text-sm opacity-85 truncate">{tutorName || "Репетитор"}</div>
                <div className="text-[11px] opacity-70 truncate">
                  {lessonSubject ? `${lessonSubject} · ` : ""}{next.lesson.duration || 60} мин
                </div>
              </div>
            </div>

            <div className="relative flex gap-2">
              <button onClick={onOpenBoard}
                className="press-tap flex items-center gap-1.5 bg-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.3)] transition-colors rounded-xl px-3.5 py-2 text-sm font-medium backdrop-blur-sm">
                <Icon name="clipboard" size={14} />Доска
              </button>
              {callUrl && (
                <a href={callUrl} target="_blank" rel="noreferrer"
                  className="press-tap flex items-center gap-1.5 bg-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.3)] transition-colors rounded-xl px-3.5 py-2 text-sm font-medium backdrop-blur-sm">
                  <Icon name="video" size={14} />Звонок
                </a>
              )}
            </div>
          </div>
        ) : (
          // Занятий нет — это говорится ОДИН раз и здесь. Ниже, в расписании,
          // та же мысль больше не повторяется. Пустая карточка — по центру, как
          // «Всё сдано» напротив: иначе между заголовком и кнопками зияет воздух.
          <div className="glass h-full p-5 flex flex-col items-center justify-center text-center gap-2.5 py-8">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center ring-1 ring-blue-500/25 text-blue-600 dark:text-blue-300">
              <Icon name="calendar" size={22} />
            </span>
            <div className="text-sm font-medium">Занятие пока не назначено</div>
            <p className="text-xs text-gray-400 max-w-[16rem] leading-relaxed">
              Оно появится здесь, как только репетитор поставит его в расписание.
            </p>
            <div className="flex gap-2 mt-1">
              <button onClick={onOpenBoard} className="press-tap btn-glass px-4 py-2 text-sm">
                <span className="flex items-center gap-1.5"><Icon name="clipboard" size={14} />Доска</span>
              </button>
              <button onClick={() => onOpenTab("chat")} className="press-tap btn-glass px-4 py-2 text-sm">
                <span className="flex items-center gap-1.5"><Icon name="message" size={14} />Написать</span>
              </button>
            </div>
          </div>
        )}

        {/* РАСПИСАНИЕ. Ближайшие занятия чипами — нажатие просит о переносе. */}
        {(upcoming.length > 0 || pendingMoves.length > 0 || student?.schedule) && (
          <div id={moveAnchorId} className="glass p-5 flex-1">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-base font-medium">Занятия</span>
              {student?.schedule && (
                <span className="text-[11px] text-gray-400 truncate max-w-[60%] text-right">{student.schedule}</span>
              )}
            </div>

            {upcoming.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {upcoming.slice(0, 6).map((l, i) => {
                  const asked = !!l.moveRequest
                  return (
                    <button
                      key={i}
                      onClick={() => onRequestMove(l)}
                      disabled={asked}
                      title={asked ? "Предложение о переносе уже отправлено" : "Попросить о переносе"}
                      className={`press-tap inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                        asked
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                          : "text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/25 hover:bg-blue-500/[0.08]"
                      }`}
                    >
                      <Icon name={asked ? "repeat" : "calendar"} size={12} />
                      {parseLocalDate(l.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} в {l.time}
                    </button>
                  )
                })}
              </div>
            )}

            {upcoming.length > 0 && !pendingMoves.length && (
              <div className="text-[11px] text-gray-400 mt-2.5">Нажми на занятие, чтобы попросить о переносе.</div>
            )}

            {moveNotes}
            {moveError && <div className="mt-2 text-xs text-red-500">{moveError}</div>}
          </div>
        )}
        </div>

        <div className="glass h-full p-5 flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base font-medium">Что сделать</span>
              {todos.length > 0 && (
                <span className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300 ring-1 ring-blue-500/20">
                  {todos.length}
                </span>
              )}
            </div>
            {todos.length > 0 && (
              <button onClick={() => onOpenTab("homework")}
                className="press-tap flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-500/[0.08] transition-colors">
                Все работы<Icon name="chevron-right" size={13} />
              </button>
            )}
          </div>

          {todos.length === 0 ? (
            // Пустое состояние занимает строку, а не карточку в полный рост:
            // отсутствие дел — хорошая новость, а не повод для пустого блока.
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2.5">
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center ring-1 ring-[color:var(--accent-mint)]/30 text-[color:var(--accent-mint)]">
                <Icon name="check" size={22} />
              </span>
              <div className="text-sm font-medium">Всё сдано</div>
              <p className="text-xs text-gray-400 max-w-[15rem] leading-relaxed">
                Новые задания и варианты появятся здесь, как только репетитор их выдаст.
              </p>
            </div>
          ) : (
            // justify-between: список тянется на всю высоту карточки, и под
            // последним делом не остаётся воздуха рядом с колонкой занятий.
            <div className="flex-1 flex flex-col justify-between gap-0.5 -mx-1">
              {todos.slice(0, 4).map((t, i) => (
                <TodoRow key={t.key} item={t} index={i}
                  onOpen={(x) => (x.kind === "hw" ? onOpenHomework(x.row) : onOpenVariant(x.row))} />
              ))}
              {todos.length > 4 && (
                <button onClick={() => onOpenTab("homework")}
                  className="press-tap self-start mt-1.5 ml-1 text-[11px] text-gray-400 hover:text-blue-600 transition-colors">
                  и ещё {todos.length - 4} {plural(todos.length - 4, "работа", "работы", "работ")}
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ПОКАЗАТЕЛИ — одной полосой, как сводка над списком работ: четыре
          отдельные коробки делали из успеваемости отчёт, а не подсказку.
          Каждый сегмент ведёт туда, где число разбирается подробно, и сегмента
          БЕЗ ЧИСЛА в полосе нет: ряд прочерков — это не сводка, а пустая полка. */}
      {metrics.length > 0 && (
        <div className="glass overflow-hidden">
          <div className="flex flex-wrap sm:flex-nowrap divide-x divide-y sm:divide-y-0 divide-gray-500/12 dark:divide-white/10">
            {metrics.map((m) => <Metric key={m.key} {...m} />)}
          </div>
        </div>
      )}

      {/* Готовность к экзамену — тот же блок, что в «Результатах», в компактном
          виде. Прогноз не должен требовать перехода в другой раздел. */}
      {stats?.isExam && stats?.hasData && (
        <ExamProgress student={student} stats={stats} compact onMore={() => onOpenTab("results")} />
      )}

      {calendar}

      {/* Репетитор и код для родителей — справочные вещи, поэтому внизу и тихо.
          Ряд становится двухколоночным только когда есть код: одна карточка в
          половину ширины оставила бы справа пустоту. */}
      <div className={parentCode ? "grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch" : ""}>
        <div className="glass h-full p-5 flex flex-col">
          <div className="text-base font-medium mb-3.5">Репетитор</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-medium ring-1 ring-purple-500/25 text-purple-600 dark:text-purple-300">
              {tutorName ? getInitials(tutorName) : "Р"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{tutorName || "Ваш репетитор"}</div>
              <div className="text-[11px] text-gray-400 truncate">{lessonSubject || "Предмет не указан"}</div>
            </div>
            <button onClick={() => onOpenTab("chat")}
              className="press-tap shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-300 ring-1 ring-blue-500/25 hover:bg-blue-500/[0.08] transition-colors">
              <Icon name="message" size={13} />Написать
            </button>
          </div>

          <button onClick={onAddTutor}
            className="press-tap self-start mt-3.5 flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-300 hover:underline">
            <Icon name="plus" size={12} />Подключить ещё репетитора
          </button>
        </div>

        {parentCode && (
          <div className="glass h-full p-5 flex flex-col">
            <div className="text-base font-medium mb-1">Код для родителей</div>
            <p className="text-[11px] text-gray-400 mb-3.5 leading-relaxed">
              По нему родители видят занятия, оценки и оплату — без доступа к твоему кабинету.
            </p>
            <div className="mt-auto">{parentCode}</div>
          </div>
        )}
      </div>

      {boardHistory}
    </div>
  )
}

export default StudentHome
