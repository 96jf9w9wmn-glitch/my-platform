import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import { signRows } from "../storageUrl"
import Chat from "./Chat"
import { getInitials, plural, isLessonConducted } from "../utils"
import { studentDebt, fmtMoney } from "../invoices"
import Icon from "../components/Icon"
import MorphIcon from "../components/MorphIcon"
import BetaBadge from "../components/BetaBadge"
import SegmentSwitch from "../components/SegmentSwitch"
import { BETA_SUFFIX } from "../beta"
import InvoiceCard from "../components/InvoiceCard"

const MONTH_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
// Родительный падеж: toLocaleDateString с одним только месяцем даёт «июнь»,
// и дата собиралась как «1 июнь 2027».
const MONTH_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
const WEEKDAY_FULL = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"]

function parseDay(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number)
  return new Date(y, m - 1, d)
}

// Конец занятия: по нему решается, прошло оно или ещё впереди.
function lessonEnd(l) {
  if (!l.date) return new Date(0)
  const [y, m, d] = l.date.split("-").map(Number)
  const [h, min] = (l.time || "00:00").split(":").map(Number)
  return new Date(y, m - 1, d, h, min + (l.duration || 60))
}

// «Сегодня» и «Завтра» родитель считывает быстрее даты — но только для двух
// ближайших дней: дальше подпись перестаёт помогать и начинает шуметь.
function relDay(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((parseDay(dateStr) - today) / 86400000)
  return diff === 0 ? "Сегодня" : diff === 1 ? "Завтра" : null
}

function longDate(iso) {
  return parseDay(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
}

// Короткая дата для подписей, где строка обязана поместиться в одну строку.
function shortDate(iso) {
  const d = parseDay(iso)
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

const TONE_TILE = {
  blue: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  green: "bg-green-500/15 text-green-600 dark:text-green-300",
  purple: "bg-purple-500/15 text-purple-600 dark:text-purple-300",
}

// Панель раздела: иконка в цветной плитке + заголовок + место под действие
// справа. Один и тот же каркас у всех блоков — иначе кабинет распадается на
// разнородные карточки.
function Panel({ icon, title, tone = "blue", action, children, className = "" }) {
  return (
    <div className={`glass p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${TONE_TILE[tone]}`}>
            <Icon name={icon} size={16} />
          </span>
          <div className="text-[15px] font-semibold text-gray-800 truncate">{title}</div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// Плитка сводки. Показывается только тогда, когда за ней есть данные:
// плитка с прочерком занимает место и ничего не сообщает.
// wide — когда плитка одна и занимает всю ширину: столбиком она превращалась
// в почти пустое поле, строкой (подпись слева, число справа) смотрится собранно.
function StatTile({ icon, label, value, hint, color = "text-gray-800", wide = false, className = "" }) {
  if (wide) return (
    <div className={`glass rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Icon name={icon} size={13} />
          <span className="text-[11px] leading-tight">{label}</span>
        </div>
        {hint && <div className="text-[11px] text-gray-400 leading-tight mt-1">{hint}</div>}
      </div>
      <div className={`text-[22px] leading-none font-semibold shrink-0 ${color}`}>{value}</div>
    </div>
  )
  return (
    <div className={`glass rounded-2xl p-3.5 flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-1.5 text-gray-400">
        <Icon name={icon} size={13} />
        <span className="text-[11px] leading-tight">{label}</span>
      </div>
      <div className={`text-[22px] leading-none font-semibold ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-400 leading-tight">{hint}</div>}
    </div>
  )
}

function GradeBar({ label, count, max, color }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-5 text-xs font-semibold text-center ${color}`}>{label}</div>
      <div className="flex-1 h-2 bg-blue-500/12 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color.replace("text-", "bg-")}`} style={{ width: pct + "%" }} />
      </div>
      <div className="text-xs text-gray-400 w-6 text-right">{count}</div>
    </div>
  )
}

// Подписи те же, что на печатном листе (pages/reportSheet.js): родитель видит
// один и тот же отчёт в кабинете и в PDF — разные слова для одного статуса
// читались бы как разные оценки.
const CONF_TONE = {
  struggling: { label: "нужна помощь", cls: "bg-red-500/12 text-red-700 dark:text-red-300 ring-1 ring-red-500/25" },
  progress: { label: "в процессе", cls: "bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/25" },
  confident: { label: "уверенно", cls: "bg-green-500/12 text-green-700 dark:text-green-300 ring-1 ring-green-500/25" },
}

// Период отчёта: он не про одно занятие, а про промежуток между отчётами.
// Старые записи промежутка не хранят — у них остаётся одна дата.
function reportPeriod(r) {
  const day = (iso) => new Date(String(iso).slice(0, 10) + "T00:00:00")
    .toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
  if (r.period_from && r.period_to && r.period_from !== r.period_to) {
    return `${day(r.period_from)} — ${day(r.period_to)}`
  }
  return day(r.period_to || r.lesson_date)
}

function reportStatsLine(r) {
  const s = r.stats || {}
  return [
    s.lessons ? `${s.lessons} ${plural(s.lessons, "занятие", "занятия", "занятий")}` : null,
    s.homeworkDone ? `${s.homeworkDone} ${plural(s.homeworkDone, "работа", "работы", "работ")}` : null,
    s.avgGrade ? `средний балл ${String(s.avgGrade).replace(".", ",")}` : null,
  ].filter(Boolean).join(" · ")
}

// Лента отчётов о занятиях. Родителю показываются только ОТПРАВЛЕННЫЕ отчёты —
// это гарантирует функция в базе, а не фильтр здесь: черновик репетитора и
// сырые данные, которые скармливались модели, наружу не уходят вовсе.
function ReportsFeed({ parentCode, studentName, tutorName }) {
  const [reports, setReports] = useState([])
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    if (!parentCode) return
    let alive = true
    supabase.rpc("lesson_report_list_parent", { p_parent_code: parentCode })
      // Нет функции (миграция не выполнена) — блока просто не будет.
      .then(({ data }) => { if (alive && data) setReports(data) })
    return () => { alive = false }
  }, [parentCode])

  // Печатный лист. Собирается из того, что сохранено при отправке, — родитель
  // видит и печатает ровно тот отчёт, который отправил репетитор, а не
  // пересчитанный сегодня.
  async function savePdf(r) {
    setBusy(r.id)
    try {
      const { downloadReportPdf } = await import("./reportPdf")
      await downloadReportPdf({
        report: { ...r, lesson_date: r.period_to || r.lesson_date },
        studentName,
        tutorName,
        stats: r.stats || {},
        lessons: Array.isArray(r.lessons) ? r.lessons : [],
        period: { from: r.period_from, to: r.period_to || r.lesson_date },
      })
    } finally {
      setBusy(null)
    }
  }

  if (!reports.length) return null

  return (
    <Panel icon="mail" title="Отчёты о занятиях" tone="purple">
      <div className="flex flex-col gap-3">
        {reports.map((r) => (
          <div key={r.id} className="glass-sm rounded-2xl px-3.5 py-3">
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-700">{reportPeriod(r)}</div>
                {reportStatsLine(r) && (
                  <div className="text-[11px] text-gray-400 mt-0.5">{reportStatsLine(r)}</div>
                )}
              </div>
              <button
                onClick={() => savePdf(r)}
                disabled={busy === r.id}
                title="Сохранить отчёт в PDF"
                className="press-fill shrink-0 flex items-center gap-1.5 text-[12px] font-medium text-blue-600 dark:text-blue-300 px-2.5 py-1.5 rounded-xl ring-1 ring-blue-500/25 disabled:opacity-50"
              >
                <Icon name="download" size={13} />
                {busy === r.id ? "Готовим…" : "PDF"}
              </button>
            </div>
            {r.summary && <div className="text-sm text-gray-700 leading-relaxed">{r.summary}</div>}
            {Array.isArray(r.topics) && r.topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {r.topics.map((t, i) => {
                  const tone = CONF_TONE[t.confidence]
                  return (
                    <span
                      key={i}
                      title={t.comment || ""}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                        tone ? tone.cls : "text-gray-500 ring-1 ring-gray-200/70 dark:ring-white/12"
                      }`}
                    >
                      {t.title}{tone ? ` · ${tone.label}` : ""}
                    </span>
                  )
                })}
              </div>
            )}
            {r.next_steps && (
              <div className="text-[12px] text-gray-500 mt-2.5 leading-relaxed">
                Дальше: {r.next_steps}
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}

function ParentDashboard({ user, onLogout }) {
  const [student, setStudent] = useState(user.student)
  const [homework, setHomework] = useState([])
  const [loading, setLoading] = useState(true)
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark")
  const [hwTab, setHwTab] = useState("list")
  const [mainTab, setMainTab] = useState("home")
  const [tutorName, setTutorName] = useState("")
  const [chatUnread, setChatUnread] = useState(0)

  // user.student — снимок на момент входа; студента мог обновить репетитор
  // (уроки, оплаты, цель), поэтому подтягиваем актуальную строку при заходе.
  useEffect(() => {
    supabase.from("students").select("*").eq("id", user.student.id).maybeSingle()
      .then(async ({ data }) => {
        if (!data) return
        const [withAvatar] = await signRows([data], { avatar: "homework" })
        const refreshed = { ...withAvatar, lessonPrice: data.lesson_price, lessonDuration: data.lesson_duration }
        setStudent(refreshed)
        const stored = localStorage.getItem("parent_session")
        if (stored) {
          try {
            const session = JSON.parse(stored)
            localStorage.setItem("parent_session", JSON.stringify({ ...session, student: refreshed }))
          } catch { /* ignore malformed cache */ }
        }
      })
  }, [user.student.id])

  useEffect(() => {
    document.title = `${student.name} — Precettore${BETA_SUFFIX}`
    return () => { document.title = `Precettore${BETA_SUFFIX}` }
  }, [student.name])

  useEffect(() => {
    if (student.tutor_id) {
      supabase.from("tutors").select("name").eq("id", student.tutor_id).single()
        .then(({ data }) => { if (data) setTutorName(data.name) })
    }
  }, [student.tutor_id])

  useEffect(() => {
    const myId = `p:${student.id}`
    supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", myId)
      .eq("read", false)
      .then(({ count }) => setChatUnread(count || 0))

    const ch = supabase.channel(`chat_unread_parent_${student.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `recipient_id=eq.${myId}`,
      }, () => setChatUnread(n => n + 1))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [student.id])

  useEffect(() => {
    if (dark) document.documentElement.classList.add("dark")
    else document.documentElement.classList.remove("dark")
  }, [dark])

  useEffect(() => {
    supabase
      .from("homework")
      .select("*")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        setHomework(await signRows(data || [], { file_url: "homework", submission_url: "homework" }))
        setLoading(false)
      })
  }, [student.id])

  const lessons = student.lessons || []
  // Счётчик считает ВСЕ будущие занятия, а список показывает ближайшие: раньше
  // в плитку попадала длина обрезанного списка, и «занятий впереди» упиралось в 6.
  const upcomingAll = lessons
    .filter((l) => l.date && lessonEnd(l) >= new Date())
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
  const upcoming = upcomingAll.slice(0, 4)

  const conducted = lessons.filter((l) => isLessonConducted(l))
  const price = Number(student.lessonPrice ?? student.lesson_price ?? 0)
  const totalPaid = (student.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  // Долг считает общий помощник — то же число, что видят репетитор и квитанции.
  const debt = studentDebt({ ...student, lessonPrice: price })

  const graded = homework.filter((h) => h.grade != null)
  const avg = graded.length > 0
    ? Math.round(graded.reduce((s, h) => s + h.grade, 0) / graded.length * 10) / 10
    : null
  const doneCount = homework.filter((h) => h.status === "done" || h.grade != null).length

  const gradeDist = [5, 4, 3, 2, 1].map((g) => ({ g, count: graded.filter((h) => h.grade === g).length }))
  const maxGradeCount = Math.max(...gradeDist.map((d) => d.count), 1)
  const gradeColors = { 5: "text-green-500", 4: "text-blue-500", 3: "text-amber-500", 2: "text-orange-500", 1: "text-red-500" }
  const recentGraded = [...graded].reverse().slice(0, 8)

  const examDate = student.examDate || student.exam_date
  const targetScore = student.targetScore || student.target_score
  const daysToExam = examDate
    ? Math.ceil((parseDay(examDate) - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null
  // Без « г.» в хвосте: в узкой колонке эти две буквы утаскивали дату на вторую строку.
  const examDateLabel = examDate
    ? `${parseDay(examDate).getDate()} ${MONTH_GEN[parseDay(examDate).getMonth()]} ${parseDay(examDate).getFullYear()}`
    : ""

  const initials = getInitials(student.name)
  const remarks = [...(student.remarks || [])].reverse()

  // Сводка сверху: только плитки с настоящими данными. Пустая плитка
  // с прочерком занимала треть экрана и не сообщала ничего.
  const tiles = []
  if (upcomingAll.length) {
    tiles.push({
      id: "next", icon: "calendar", label: "Занятий впереди",
      value: upcomingAll.length, color: "text-blue-600",
      hint: `${relDay(upcoming[0].date) || shortDate(upcoming[0].date)}, ${upcoming[0].time}`,
    })
  }
  if (conducted.length && price > 0) {
    tiles.push(debt > 0
      ? { id: "debt", icon: "ruble", label: "К оплате", value: `${fmtMoney(debt)} ₽`, color: "text-amber-500", hint: `за ${conducted.length} ${plural(conducted.length, "занятие", "занятия", "занятий")}` }
      : { id: "debt", icon: "ruble", label: "Оплата", value: "Долга нет", color: "text-green-600 text-[18px]", hint: `оплачено ${fmtMoney(totalPaid)} ₽` })
  }
  if (avg != null) {
    tiles.push({
      id: "avg", icon: "bar-chart", label: "Средний балл",
      value: String(avg).replace(".", ","),
      color: avg >= 4.5 ? "text-green-600" : avg >= 3.5 ? "text-blue-600" : avg >= 2.5 ? "text-amber-500" : "text-red-500",
      hint: `${graded.length} ${plural(graded.length, "оценка", "оценки", "оценок")}`,
    })
  }
  // Три плитки в ряд помещаются только начиная с планшета: на телефоне
  // подписи в них ломались на три строки.
  const tilesCols = tiles.length >= 3 ? "grid-cols-2 sm:grid-cols-3" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-1"

  return (
    <div className="min-h-screen p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      {/* Ширина растёт вместе с экраном: на ноутбуке кабинет не должен
          оставаться телефонной колонкой посреди пустого поля. */}
      <div className="max-w-lg md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex flex-col gap-4">

        {/* Шапка */}
        <div className="glass p-3.5 sm:p-4 flex items-center gap-3">
          {/* Инициалы — всегда подложкой, фото поверх. Ссылка на фото временная
              (подписанная) и в кэше могла протухнуть: битая картинка прячется,
              и родитель видит инициалы, а не значок сломанного изображения. */}
          <div className="relative w-11 h-11 rounded-full shrink-0 overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold ring-2 ring-white/70 dark:ring-white/15">
            {initials}
            {student.avatar && (
              <img
                src={student.avatar}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = "none" }}
                onLoad={(e) => { e.currentTarget.style.display = "" }}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {/* Логотип — только там, где он не отъедает ширину у имени:
                  на телефоне из-за него имя обрывалось многоточием. */}
              <img src="/logo.webp" alt="" className="hidden sm:block w-4 h-4 rounded object-cover shrink-0" onError={(e) => { e.currentTarget.style.display = "none" }} />
              <div className="font-semibold text-gray-800 truncate">{student.name}</div>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-400 truncate">
                Кабинет родителя{tutorName ? ` · репетитор ${tutorName}` : ""}
              </span>
              <BetaBadge size="xs" />
            </div>
          </div>
          {/* На телефоне «Выйти» остаётся значком: подписью оно отъедало ширину
              у имени ученика, и то обрывалось многоточием. */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setDark(!dark)}
              title={dark ? "Светлая тема" : "Тёмная тема"}
              className="press-tap w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-xl"
            >
              <MorphIcon from="moon" to="sun" size={17} active={dark} hover={false} rotate />
            </button>
            <button
              onClick={onLogout}
              title="Выйти"
              aria-label="Выйти"
              className="press-fill flex items-center gap-1.5 text-sm text-gray-500 h-9 px-2.5 sm:px-3 rounded-xl sm:ring-1 sm:ring-gray-200/70 sm:dark:ring-white/12"
            >
              <Icon name="logout" size={17} />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>

        {/* Навигация */}
        <SegmentSwitch
          block
          ariaLabel="Разделы кабинета"
          value={mainTab}
          onChange={(k) => { setMainTab(k); if (k === "chat") setChatUnread(0) }}
          items={[
            { key: "home", label: "Кабинет" },
            {
              key: "chat",
              label: (
                <span className="flex items-center gap-1.5">
                  Чат
                  {chatUnread > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-semibold">
                      {chatUnread > 9 ? "9+" : chatUnread}
                    </span>
                  )}
                </span>
              ),
            },
          ]}
        />

        {mainTab === "chat" && (
          // flex обязателен: Chat растягивается через flex-1, и без flex-контейнера
          // он сжимался до высоты списка контактов, оставляя под собой пустоту.
          <div className="glass rounded-2xl overflow-hidden flex flex-col" style={{ height: "calc(var(--app-h, 100dvh) - 230px)", minHeight: 400 }}>
            <Chat
              myId={`p:${student.id}`}
              myName={`Родитель ${student.name.split(" ")[0]}`}
              initialContacts={student.tutor_id ? [{ id: `t:${student.tutor_id}`, name: tutorName || "Репетитор", role: "Репетитор" }] : []}
              canAddByCode={true}
              onUnreadChange={(delta, isInit) => {
                if (isInit) setChatUnread(delta)
                else if (mainTab !== "chat") setChatUnread(n => Math.max(0, n + delta))
              }}
            />
          </div>
        )}

        {mainTab === "home" && <>

        {tiles.length > 0 && (
          <div className={`grid gap-3 ${tilesCols}`}>
            {/* Третья плитка на телефоне занимает всю строку: вторым в ряду
                она оставляла рядом с собой пустое место. */}
            {tiles.map((t, i) => (
              <StatTile
                key={t.id}
                icon={t.icon}
                label={t.label}
                value={t.value}
                hint={t.hint}
                color={t.color}
                wide={tiles.length === 1}
                className={tiles.length === 3 && i === 2 ? "col-span-2 sm:col-span-1" : ""}
              />
            ))}
          </div>
        )}

        {/* Замечания репетитора — над всем остальным: это то, ради чего родитель
            заходит в кабинет чаще всего. */}
        {remarks.length > 0 && (
          <div className="glass-tint-amber p-4 sm:p-5 rounded-2xl">
            <div className="flex items-center gap-2.5 mb-3.5">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-600 dark:text-amber-300">
                <Icon name="warning" size={16} />
              </span>
              <div className="text-[15px] font-semibold text-gray-800">Замечания репетитора</div>
            </div>
            <div className="flex flex-col gap-2">
              {remarks.map((r) => (
                <div key={r.id} className="rounded-xl px-3.5 py-2.5 ring-1 ring-amber-500/25">
                  <div className="text-sm text-gray-700 leading-relaxed">{r.text}</div>
                  <div className="text-[11px] text-gray-400 mt-1">{r.date}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Колонки растянуты на одну высоту, последняя карточка каждой добирает
            остаток (flex-1): короткая колонка не оставляет под собой пустого поля. */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Левая колонка — расписание и деньги. min-w-0 обязателен: без него
              ячейка грида растягивается по самому широкому неразрывному
              элементу и на телефоне уезжает вправо. */}
          <div className="min-w-0 flex flex-col gap-4 [&>*:last-child]:flex-1">

            <Panel icon="calendar" title="Ближайшие занятия">
              {upcoming.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-6 rounded-2xl ring-1 ring-gray-200/70 dark:ring-white/10">
                  Занятия пока не назначены
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcoming.map((l, i) => {
                    const d = parseDay(l.date)
                    const rel = relDay(l.date)
                    return (
                      <div
                        key={`${l.date}-${l.time}-${i}`}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                          i === 0 ? "bg-blue-500/[0.07] ring-1 ring-blue-500/25" : "ring-1 ring-gray-200/70 dark:ring-white/10"
                        }`}
                      >
                        <div className="w-11 h-11 rounded-xl shrink-0 flex flex-col items-center justify-center bg-blue-500/12 text-blue-600 dark:text-blue-300">
                          <div className="text-[15px] font-semibold leading-none">{d.getDate()}</div>
                          <div className="text-[10px] leading-none mt-1 uppercase tracking-wide">{MONTH_SHORT[d.getMonth()]}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-700">{WEEKDAY_FULL[d.getDay()]}</span>
                            {rel && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/12 text-blue-600 dark:text-blue-300">{rel}</span>
                            )}
                            {l.extra && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/12 text-green-700 dark:text-green-300">дополнительное</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{l.time} · {l.duration || 60} мин</div>
                        </div>
                      </div>
                    )
                  })}
                  {upcomingAll.length > upcoming.length && (
                    <div className="text-xs text-gray-400 text-center pt-1">
                      И ещё {upcomingAll.length - upcoming.length} {plural(upcomingAll.length - upcoming.length, "занятие", "занятия", "занятий")} впереди
                    </div>
                  )}
                </div>
              )}
            </Panel>

            <Panel icon="ruble" title="Оплата" tone="green">
              {price === 0 ? (
                <div className="text-sm text-gray-500 leading-relaxed">
                  Стоимость занятия ещё не указана — суммы появятся, когда репетитор её заполнит.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Проведено занятий</span>
                    <span className="font-medium">{conducted.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Стоимость занятия</span>
                    <span className="font-medium">{fmtMoney(price)} ₽</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Оплачено</span>
                    <span className="font-medium text-green-600">{fmtMoney(totalPaid)} ₽</span>
                  </div>
                  <div className={`flex justify-between items-center rounded-xl px-3 py-2.5 mt-0.5 ring-1 ${
                    debt > 0 ? "ring-amber-500/25 bg-amber-500/[0.07]" : "ring-green-500/25 bg-green-500/[0.07]"
                  }`}>
                    <span className="text-sm font-medium text-gray-700">{debt > 0 ? "К оплате" : "Задолженности нет"}</span>
                    <span className={`text-sm font-semibold ${debt > 0 ? "text-amber-600 dark:text-amber-300" : "text-green-600 dark:text-green-300"}`}>
                      {debt > 0 ? `${fmtMoney(debt)} ₽` : "✓"}
                    </span>
                  </div>
                </div>
              )}
            </Panel>

            {/* Квитанции за проведённые занятия: приходят сами, платить можно переводом */}
            <InvoiceCard
              student={{ ...student, lessonPrice: price }}
              tutorId={student.tutor_id}
              tutorName={tutorName}
              className="rounded-2xl"
            />

            {(examDate || targetScore) && (
              <Panel icon="target" title="Цель" tone="purple">
                <div className="flex flex-col gap-2.5">
                  {examDate && (
                    <div className="flex justify-between items-center text-sm gap-3">
                      <span className="text-gray-500">Экзамен</span>
                      <span className="font-medium text-right">{examDateLabel}</span>
                    </div>
                  )}
                  {targetScore && (
                    <div className="flex justify-between items-center text-sm gap-3">
                      <span className="text-gray-500">Целевой балл</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-300">{targetScore}</span>
                    </div>
                  )}
                  {daysToExam > 0 && (
                    <div className="text-[12px] font-medium text-purple-600 dark:text-purple-300 bg-purple-500/10 rounded-xl px-3 py-2 text-center mt-0.5">
                      До экзамена {daysToExam} {plural(daysToExam, "день", "дня", "дней")}
                    </div>
                  )}
                </div>
              </Panel>
            )}

          </div>

          {/* Правая колонка — учёба */}
          <div className="min-w-0 flex flex-col gap-4 [&>*:last-child]:flex-1">

            <ReportsFeed parentCode={student.parent_code} studentName={student.name} tutorName={tutorName} />

            <Panel
              icon="book"
              title="Домашние задания"
              // На узком экране переключатель уходит на свою строку целиком:
              // рядом с заголовком он не помещался и вылезал за карточку.
              action={homework.length > 0 && (
                <SegmentSwitch
                  block
                  size="sm"
                  className="w-full sm:w-auto"
                  ariaLabel="Вид домашних заданий"
                  value={hwTab}
                  onChange={setHwTab}
                  items={[{ key: "list", label: "Список" }, { key: "analytics", label: "Аналитика" }]}
                />
              )}
            >
              {loading ? (
                <div className="text-sm text-gray-400 text-center py-6">Загружаем…</div>
              ) : homework.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-6 rounded-2xl ring-1 ring-gray-200/70 dark:ring-white/10">
                  Заданий пока нет
                </div>
              ) : hwTab === "list" ? (
                <>
                  <div className="flex justify-between text-xs text-gray-400 mb-2.5 px-0.5">
                    <span>Выполнено: {doneCount} из {homework.length}</span>
                    {avg != null && <span>Средний балл: {String(avg).replace(".", ",")}</span>}
                  </div>
                  <div className="flex flex-col divide-y divide-gray-100">
                    {homework.slice(0, 10).map((hw) => (
                      <div key={hw.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-gray-700 truncate">{hw.title}</div>
                          <div className="text-xs text-gray-400">
                            {hw.hw_type === "test" ? "Тест" : hw.hw_type === "written" ? "Письменное" : "Комбинированное"}
                            {hw.deadline ? ` · до ${longDate(hw.deadline)}` : ""}
                          </div>
                        </div>
                        {hw.grade != null ? (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ring-1 ${
                            hw.grade >= 4 ? "bg-green-500/12 text-green-700 dark:text-green-300 ring-green-500/25" :
                            hw.grade === 3 ? "bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/25" :
                            "bg-red-500/12 text-red-700 dark:text-red-300 ring-red-500/25"
                          }`}>{hw.grade}</span>
                        ) : hw.status === "done" ? (
                          <span className="text-xs px-2.5 py-1 rounded-full shrink-0 bg-blue-500/12 text-blue-600 dark:text-blue-300 ring-1 ring-blue-500/25">На проверке</span>
                        ) : (
                          <span className="text-xs text-gray-500 ring-1 ring-gray-200/70 dark:ring-white/15 px-2.5 py-1 rounded-full shrink-0">Задано</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-2.5">
                      Распределение оценок · проверено {graded.length}
                    </div>
                    {graded.length === 0 ? (
                      <div className="text-sm text-gray-400">Проверенных работ пока нет</div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {gradeDist.map(({ g, count }) => (
                          <GradeBar key={g} label={g} count={count} max={maxGradeCount} color={gradeColors[g]} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-3.5">
                    <div className="text-xs text-gray-400 mb-2.5">Выполнение · {doneCount} из {homework.length}</div>
                    <div className="h-2 bg-blue-500/12 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: homework.length > 0 ? Math.round((doneCount / homework.length) * 100) + "%" : "0%" }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1.5 text-right">
                      {homework.length > 0 ? Math.round((doneCount / homework.length) * 100) : 0}%
                    </div>
                  </div>

                  {recentGraded.length > 0 && (
                    <div className="border-t border-gray-100 pt-3.5">
                      <div className="text-xs text-gray-400 mb-2.5">Последние оценки</div>
                      <div className="flex items-end gap-1.5 h-14">
                        {recentGraded.map((hw, i) => {
                          const h = Math.round((hw.grade / 5) * 100)
                          const color = hw.grade >= 4 ? "bg-green-400" : hw.grade === 3 ? "bg-amber-400" : "bg-red-400"
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                              <div className={`w-full rounded-t-md ${color}`} style={{ height: h + "%" }} />
                              <div className="text-[11px] text-gray-400">{hw.grade}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Panel>

          </div>
        </div>

        </>}

      </div>
    </div>
  )
}

export default ParentDashboard
