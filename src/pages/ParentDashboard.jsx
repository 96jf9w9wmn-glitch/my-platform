import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import Chat from "./Chat"
import { getInitials } from "../utils"

function SvgIcon({ d, size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
}

const MONTH_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
const WEEKDAY = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]

function fmt(dateStr) {
  const d = new Date(dateStr + "T00:00:00")
  return `${WEEKDAY[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

function parseDate(l) {
  if (!l.date) return new Date(0)
  const [y, m, d] = l.date.split("-").map(Number)
  const [h, min] = (l.time || "00:00").split(":").map(Number)
  return new Date(y, m - 1, d, h, min + (l.duration || 60))
}

function GradeBar({ label, count, max, color }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className={`w-5 text-xs font-semibold text-center ${color}`}>{label}</div>
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color.replace("text-", "bg-")}`} style={{ width: pct + "%" }} />
      </div>
      <div className="text-xs text-gray-500 w-6 text-right">{count}</div>
    </div>
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
      .then(({ data }) => {
        if (!data) return
        const refreshed = { ...data, lessonPrice: data.lesson_price, lessonDuration: data.lesson_duration }
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
    document.title = `${student.name} — Precettore`
    return () => { document.title = "Precettore" }
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
      .then(({ data }) => { setHomework(data || []); setLoading(false) })
  }, [student.id])

  const now = new Date()

  const upcoming = (student.lessons || [])
    .filter((l) => l.date && parseDate(l) >= now)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)

  const conducted = (student.lessons || []).filter((l) => l.date && parseDate(l) < now)
  const totalOwed = conducted.length * (student.lessonPrice || student.lesson_price || 0)
  const totalPaid = (student.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
  const debt = totalOwed - totalPaid

  const graded = homework.filter((h) => h.grade != null)
  const avg = graded.length > 0
    ? Math.round(graded.reduce((s, h) => s + h.grade, 0) / graded.length * 10) / 10
    : null
  const doneCount = homework.filter((h) => h.status === "done" || h.grade != null).length

  // Grade distribution
  const gradeDist = [5, 4, 3, 2, 1].map((g) => ({ g, count: graded.filter((h) => h.grade === g).length }))
  const maxGradeCount = Math.max(...gradeDist.map((d) => d.count), 1)
  const gradeColors = { 5: "text-green-500", 4: "text-blue-500", 3: "text-amber-500", 2: "text-orange-500", 1: "text-red-500" }

  // Trend: last 8 graded homeworks
  const recentGraded = [...graded].reverse().slice(0, 8)

  const initials = getInitials(student.name)
  const remarks = [...(student.remarks || [])].reverse()

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">

        {/* Шапка */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {student.avatar ? (
              <img src={student.avatar} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm border-2 border-white shadow-sm">
                {initials}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <img src="/logo.webp" alt="" className="w-5 h-5 rounded-md object-cover" />
                <div className="font-semibold text-gray-800 dark:text-gray-100">{student.name}</div>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Кабинет родителя</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark(!dark)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/40 transition-colors"
            >
              <span key={dark ? "sun" : "moon"} className={dark ? "icon-sun-enter" : "icon-moon-enter"}>
                {dark
                  ? <SvgIcon d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" size={16}/>
                  : <SvgIcon d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" size={16}/>
                }
              </span>
            </button>
            <button
              onClick={onLogout}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>

        {/* Навигация */}
        <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-2xl p-1">
          {[{ id: "home", label: "Кабинет" }, { id: "chat", label: "Чат", badge: chatUnread }].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setMainTab(tab.id); if (tab.id === "chat") setChatUnread(0) }}
              className={`flex-1 py-2 text-sm rounded-xl transition-all font-medium flex items-center justify-center gap-1.5 ${
                mainTab === tab.id
                  ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span className="w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {mainTab === "chat" && (
          <div className="glass rounded-2xl overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
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

        {/* Статистика */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="glass p-3 text-center rounded-2xl">
            <div className="text-xl font-bold text-blue-600">{upcoming.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">занятий<br/>впереди</div>
          </div>
          <div className="glass p-3 text-center rounded-2xl">
            <div className={`text-xl font-bold ${debt > 0 ? "text-amber-500" : "text-green-500"}`}>
              {debt > 0 ? debt.toLocaleString("ru-RU") + " ₽" : "✓"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{debt > 0 ? "долг" : "оплата в порядке"}</div>
          </div>
          <div className="glass p-3 text-center rounded-2xl">
            <div className="text-xl font-bold text-purple-600">{avg ?? "—"}</div>
            <div className="text-xs text-gray-500 mt-0.5">средний<br/>балл</div>
          </div>
        </div>

        {/* Замечания от репетитора */}
        {remarks.length > 0 && (
          <div className="glass p-4 mb-3 rounded-2xl border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-500"><SvgIcon d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" size={18}/></span>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Замечания репетитора</div>
            </div>
            <div className="flex flex-col gap-2">
              {remarks.map((r) => (
                <div key={r.id} className="bg-amber-50 dark:bg-amber-900/30 rounded-xl px-3 py-2.5">
                  <div className="text-sm text-gray-700 dark:text-gray-200">{r.text}</div>
                  <div className="text-xs text-gray-400 mt-1">{r.date}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Расписание */}
        <div className="glass p-4 mb-3 rounded-2xl">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Ближайшие занятия</div>
          {upcoming.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-3">Нет запланированных занятий</div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
              {upcoming.map((l, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{fmt(l.date)}</div>
                    <div className="text-xs text-gray-400">{l.time} · {l.duration || 60} мин</div>
                  </div>
                  {l.extra && (
                    <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">доп</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Оплата */}
        <div className="glass p-4 mb-3 rounded-2xl">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Оплата</div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Проведено занятий</span>
              <span className="font-medium dark:text-gray-200">{conducted.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Стоимость занятия</span>
              <span className="font-medium dark:text-gray-200">{(student.lessonPrice || student.lesson_price || 0).toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Оплачено</span>
              <span className="font-medium text-green-600">{totalPaid.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 dark:border-gray-700 pt-2 mt-0.5">
              <span className="dark:text-gray-200">Задолженность</span>
              <span className={debt > 0 ? "text-amber-500" : "text-green-600"}>
                {debt > 0 ? debt.toLocaleString("ru-RU") + " ₽" : "Нет"}
              </span>
            </div>
          </div>
        </div>

        {/* Домашние задания */}
        <div className="glass p-4 mb-3 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Домашние задания</div>
            {homework.length > 0 && (
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                <button
                  onClick={() => setHwTab("list")}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${hwTab === "list" ? "bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 shadow-sm" : "text-gray-500"}`}
                >
                  Список
                </button>
                <button
                  onClick={() => setHwTab("analytics")}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${hwTab === "analytics" ? "bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 shadow-sm" : "text-gray-500"}`}
                >
                  Аналитика
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-sm text-gray-400 text-center py-3">Загрузка...</div>
          ) : homework.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-3">Нет заданий</div>
          ) : hwTab === "list" ? (
            <>
              <div className="flex justify-between text-xs text-gray-400 mb-2 px-0.5">
                <span>Выполнено: {doneCount} / {homework.length}</span>
                {avg && <span>Средний балл: {avg}</span>}
              </div>
              <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
                {homework.slice(0, 10).map((hw) => (
                  <div key={hw.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="text-sm text-gray-700 dark:text-gray-200 truncate">{hw.title}</div>
                      <div className="text-xs text-gray-400">
                        {hw.hw_type === "test" ? "Тест" : hw.hw_type === "written" ? "Письменное" : "Комбинированное"}
                      </div>
                    </div>
                    {hw.grade != null ? (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                        hw.grade >= 4 ? "bg-green-100 text-green-700" :
                        hw.grade === 3 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>{hw.grade}</span>
                    ) : hw.status === "done" ? (
                      <span className="text-xs bg-blue-50 text-blue-500 px-2.5 py-1 rounded-full flex-shrink-0">На проверке</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-400 px-2.5 py-1 rounded-full flex-shrink-0">Задано</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Аналитика */
            <div className="flex flex-col gap-4">
              {/* Распределение оценок */}
              <div>
                <div className="text-xs text-gray-400 mb-2">Распределение оценок ({graded.length} проверено)</div>
                <div className="flex flex-col gap-1.5">
                  {gradeDist.map(({ g, count }) => (
                    <GradeBar key={g} label={g} count={count} max={maxGradeCount} color={gradeColors[g]} />
                  ))}
                </div>
              </div>

              {/* Прогресс */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="text-xs text-gray-400 mb-2">Выполнение ({doneCount} / {homework.length})</div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: homework.length > 0 ? Math.round((doneCount / homework.length) * 100) + "%" : "0%" }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1 text-right">
                  {homework.length > 0 ? Math.round((doneCount / homework.length) * 100) : 0}%
                </div>
              </div>

              {/* Последние оценки */}
              {recentGraded.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="text-xs text-gray-400 mb-2">Последние оценки</div>
                  <div className="flex items-end gap-1.5 h-12">
                    {recentGraded.map((hw, i) => {
                      const h = Math.round((hw.grade / 5) * 100)
                      const color = hw.grade >= 4 ? "bg-green-400" : hw.grade === 3 ? "bg-amber-400" : "bg-red-400"
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                          <div className={`w-full rounded-t-sm ${color}`} style={{ height: h + "%" }} />
                          <div className="text-xs text-gray-400">{hw.grade}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Цель */}
        {(student.examDate || student.exam_date || student.targetScore || student.target_score) && (
          <div className="glass p-4 rounded-2xl">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Цель</div>
            <div className="flex flex-col gap-2">
              {(student.examDate || student.exam_date) && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Дата экзамена</span>
                  <span className="font-medium dark:text-gray-200">
                    {new Date((student.examDate || student.exam_date) + "T00:00:00")
                      .toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
              )}
              {(student.targetScore || student.target_score) && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Целевой балл</span>
                  <span className="font-semibold text-blue-600">{student.targetScore || student.target_score}</span>
                </div>
              )}
            </div>
          </div>
        )}

        </>}

      </div>
    </div>
  )
}

export default ParentDashboard
