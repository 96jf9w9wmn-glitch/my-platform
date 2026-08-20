import { useState, useEffect, useRef, lazy, Suspense } from "react"
import { createPortal } from "react-dom"
import { supabase, isPasswordRecovery, setAppToken } from "./supabase"
import { signRows } from "./storageUrl"
import Sidebar from "./components/Sidebar"
import NavIcon from "./components/NavIcon"
import Icon from "./components/Icon"
import MorphIcon from "./components/MorphIcon"
import Students from "./pages/Students"
import Payment from "./pages/Payment"
import Auth from "./pages/Auth"
import ResetPassword from "./pages/ResetPassword"
import Landing from "./pages/Landing"
import Results from "./pages/Results"
import Dashboard from "./pages/Dashboard"
import Homework from "./pages/Homework"
import Schedule from "./pages/Schedule"
import ParentDashboard from "./pages/ParentDashboard"
import Chat from "./pages/Chat"
import Legal from "./pages/Legal"
import { LEGAL_PATHS } from "./legalPaths"
import Profile from "./pages/Profile"
import { SubscriptionProvider } from "./subscriptionProvider"
import { isOwner } from "./owner"
import TutorOnboardingModal from "./components/TutorOnboardingModal"
// Excalidraw тяжёлый (mermaid/katex) — грузим доску только при открытии
const Board = lazy(() => import("./components/Board"))
// Тяжёлые экраны — грузим лениво, чтобы их код (генераторы заданий на 34k строк,
// jspdf/html2canvas/recharts) не сидел в стартовом бандле. Рендерятся только при заходе.
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"))
const Variants = lazy(() => import("./pages/Variants"))
const TaskGenPreview = lazy(() => import("./pages/TaskGenPreview"))

function readStoredSession(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark")

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [dark])

  return (
    <button
      onClick={() => setDark(!dark)}
      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-sm"
    >
      <MorphIcon from="moon" to="sun" size={16} active={dark} hover={false} rotate />
    </button>
  )
}

// По заголовку уведомления понимаем, на какую вкладку тьютора вести при клике,
// чтобы можно было сразу открыть детали (сданный вариант, ДЗ, заявку, чат).
function tutorNotifTarget(title) {
  const t = (title || "").toLowerCase()
  if (t.startsWith("сообщение от")) return "chat"
  if (t.includes("заявк")) return "students"
  if (t.includes("вариант") || t.includes("часть 1")) return "variants"
  if (t.includes("дз") || t.includes("домашн") || t.includes("тест")) return "homework"
  return null
}

function NotificationItem({ notification: n, onDelete, onRead, onNavigate }) {
  const [deleting, setDeleting] = useState(false)
  const target = tutorNotifTarget(n.title)

  async function handleDelete(e) {
    e.stopPropagation()
    setDeleting(true)
    await supabase.from("notifications").delete().eq("id", n.id)
    onDelete(n.id)
  }

  async function handleRead() {
    if (!n.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id)
      onRead(n.id)
    }
    if (target) onNavigate(target)
  }

  return (
    <div
      onClick={handleRead}
      className={`group px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${!n.read ? "bg-blue-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-700">{n.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(n.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          {target && <Icon name="chevron-right" size={14} className="text-gray-300 group-hover:text-gray-400 transition-colors" />}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function NotificationBell({ userId, onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const [ringKey, setRingKey] = useState(0)
  const btnRef = useRef(null)
  const closeTimer = useRef(null)

  useEffect(() => {
    loadNotifications()
  }, [])

  async function loadNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function closePanel() {
    clearTimeout(closeTimer.current)
    setIsClosing(true)
    closeTimer.current = setTimeout(() => {
      setOpen(false)
      setIsClosing(false)
    }, 200)
  }

  function handleOpen(e) {
    e.stopPropagation()
    setRingKey(k => k + 1)
    if (open) {
      closePanel()
      return
    }
    clearTimeout(closeTimer.current)
    setIsClosing(false)
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 12, right: window.innerWidth - rect.right })
    loadNotifications()
    setOpen(true)
  }

  useEffect(() => {
    if (!open || isClosing) return
    function handleClick() { closePanel() }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [open, isClosing])

  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
      >
        <span key={ringKey} className={ringKey > 0 ? "bell-ringing" : "inline-flex"}>
          <MorphIcon from="bell" to="bell-ring" size={16} active={unread > 0} rotate toClassName="text-orange-500" />
        </span>
        {unread > 0 && (
          <span className="badge-pulse absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[10px] font-semibold leading-none rounded-full flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          className={`fixed w-80 bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl ${isClosing ? "popup-bubble-out" : "popup-bubble"}`}
          style={{ top: pos.top, right: pos.right, zIndex: 99999 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium">Уведомления</span>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-600 hover:opacity-70 transition-opacity">
                  Прочитать все
                </button>
              )}
              <button
                onClick={async () => {
                  await supabase.from("notifications").delete().eq("user_id", userId)
                  setNotifications([])
                }}
                className="text-xs text-red-400 hover:text-red-600 hover:opacity-70 transition-opacity"
              >
                Очистить
              </button>
              <button onClick={closePanel} className="text-gray-400 hover:text-gray-600"><Icon name="x" size={16} /></button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-8">Уведомлений нет</div>
            ) : notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onDelete={(id) => setNotifications((prev) => prev.filter((x) => x.id !== id))}
                onRead={(id) => setNotifications((prev) => prev.map((x) => x.id === id ? { ...x, read: true } : x))}
                onNavigate={(page) => { closePanel(); onNavigate?.(page) }}
              />
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function App() {
  // Родительская сессия по-прежнему доверяется мгновенно (без сервeрной проверки —
  // это отдельный, ещё не закрытый пробел, см. supabase/auth_hardening.sql).
  // Студенческая — больше не доверяется до подтверждения через RPC ниже,
  // иначе голый id из localStorage давал мгновенный доступ без проверки токена.
  const [user, setUser] = useState(() => readStoredSession("parent_session"))
  const [loadingAuth, setLoadingAuth] = useState(() => !readStoredSession("parent_session"))
  // Переход по ссылке «сброс пароля» из письма. Признак вычисляется в
  // src/supabase.js до создания клиента — к моменту первого рендера hash уже
  // вычищен клиентом, здесь его проверять поздно.
  const [recovery, setRecovery] = useState(isPasswordRecovery)
  // Возврат с оплаты подписки (?sub=<заказ>) должен открыть «Профиль»: там
  // живёт секция подписки, которая ждёт подтверждения платежа.
  const startPage = new URLSearchParams(window.location.search).get("sub") ? "profile" : "dashboard"
  const [activePage, setActivePage] = useState(startPage)
  const [visitedPages, setVisitedPages] = useState(() => new Set([startPage]))
  const [chatUnread, setChatUnread] = useState(0)
  const [board, setBoard] = useState(null) // { roomId, title } — открытая доска ученика
  // Лендинг показывается первым для неавторизованного гостя; из него уходим
  // в Auth с предвыбранной ролью/режимом. null → показываем лендинг.
  // Ссылка-приглашение от репетитора: ?invite=<token>. Токен запоминаем до
  // конца регистрации и гасим сразу после входа ученика (см. эффект ниже).
  const [authIntent, setAuthIntent] = useState(() => {
    const t = new URLSearchParams(window.location.search).get("invite")
    if (!t) return null
    sessionStorage.setItem("pending_invite", t)
    return { role: "student", mode: "register" }
  })

  // Приглашение по ссылке: как только ученик вошёл, обмениваем токен на код
  // репетитора (RPC invite_claim гасит токен — второй раз ссылка не сработает).
  // Сам код кладём в localStorage: кабинет подставит его в поле привязки.
  useEffect(() => {
    const token = sessionStorage.getItem("pending_invite")
    if (!token || user?.role !== "student" || !user?.id) return
    supabase.rpc("invite_claim", { p_token: token, p_account: user.id }).then(({ data }) => {
      sessionStorage.removeItem("pending_invite")
      if (data) localStorage.setItem("pending_tutor_code", data)
    })
  }, [user])

  function openBoard(studentId, title) {
    if (studentId) setBoard({ roomId: studentId, title })
  }

  const pageTitles = {
    dashboard: "Главная",
    students: "Ученики",
    homework: "Задания",
    payment: "Оплата",
    results: "Результаты",
    variants: "Варианты",
    schedule: "Расписание",
    chat: "Чат",
    taskgen: "Банк заданий",
    profile: "Профиль",
  }

  // «Банк заданий» — внутренний раздел владельца платформы (src/owner.js).
  // Проверяем и здесь, и в меню: пункт скрыт, но переход мог остаться в стейте
  // (например, ?sub= или старая вкладка), а показывать чужому кабинету раздел,
  // которого у него нет, нельзя.
  const ownerPages = { taskgen: isOwner(user?.email) }
  const pageAllowed = (page) => ownerPages[page] !== false

  function navigateTo(page) {
    if (!pageAllowed(page)) return
    setActivePage(page)
    setVisitedPages((prev) => new Set([...prev, page]))
  }

  useEffect(() => {
    if (!user || user.role !== "tutor") return
    const myId = `t:${user.id}`
    supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", myId)
      .eq("read", false)
      .then(({ count }) => setChatUnread(count || 0))
    const ch = supabase.channel(`chat_unread_tutor_${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `recipient_id=eq.${myId}`,
      }, () => setChatUnread(n => n + 1))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user?.id])

  useEffect(() => {
    if (user?.role === "tutor") {
      document.title = `${pageTitles[activePage] || "Precettore"} — Precettore`
    }
  }, [activePage, user])
  const [students, setStudents] = useState([])
  const [studentsLoaded, setStudentsLoaded] = useState(false)

  const studentsTutorId = user?.role === "tutor" ? user.id
    : user?.role === "student" ? user.profile?.tutor_id
    : null
  // У студента без репетитора грузить нечего — считаем загруженным без setState в эффекте
  const studentsReady = studentsLoaded || (user?.role === "student" && !user.profile?.tutor_id)

  const loadedTutorRef = useRef(null)
  useEffect(() => {
    // Смена репетитора (другой аккаунт без перезагрузки) — сбрасываем чужой список
    if (loadedTutorRef.current && loadedTutorRef.current !== studentsTutorId) {
      loadedTutorRef.current = null
      setStudents([])
      setStudentsLoaded(false)
      return
    }
    if (studentsTutorId && !studentsLoaded) {
      loadedTutorRef.current = studentsTutorId
      loadStudents(studentsTutorId)
    }
  }, [studentsTutorId, studentsLoaded])

  async function loadStudents(tutorId) {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("tutor_id", tutorId)
      .order("created_at", { ascending: true })
    if (error || !data) return  // не помечаем как загружено — при следующем рендере повторится
    let mapped = data.map((s) => ({
      ...s,
      id: s.id,
      lessonPrice: s.lesson_price,
      lessonDuration: s.lesson_duration,
      lessonDates: s.lesson_dates || [],
      isRecurring: s.is_recurring,
      examDate: s.exam_date,
      targetScore: s.target_score,
      remarks: s.remarks || [],
      boardUrl: s.board_url || "",
      callUrl: s.call_url || "",
    }))

    // Подгружаем аватарки из student_accounts (студент пишет туда, т.к. students RLS может блокировать)
    const phones = mapped.filter((s) => s.phone).map((s) => s.phone)
    if (phones.length) {
      const { data: accounts } = await supabase
        .from("student_accounts")
        .select("phone, avatar, id")
        .in("phone", phones)
      if (accounts?.length) {
        const avatarByPhone = {}
        const idByPhone = {}
        accounts.forEach((a) => {
          if (a.avatar) avatarByPhone[a.phone] = a.avatar
          if (a.id) idByPhone[a.phone] = a.id
        })
        mapped = mapped.map((s) => ({
          ...s,
          avatar: s.avatar || avatarByPhone[s.phone] || null,
          studentAccountId: idByPhone[s.phone] || null,
        }))
      }
    }

    // Бакет с аватарами приватный, поэтому адрес подписываем на время.
    mapped = await signRows(mapped, { avatar: "homework" })

    setStudents(mapped)
    setStudentsLoaded(true)
  }

  async function saveStudent(student) {
    const { error } = await supabase.from("students").upsert({
      id: student.id,
      tutor_id: user.id,
      name: student.name,
      phone: student.phone,
      goal: student.goal,
      lesson_price: student.lessonPrice,
      lessons: student.lessons || [],
      lesson_dates: student.lessonDates || [],
      lesson_duration: student.lessonDuration,
      is_recurring: student.isRecurring,
      schedule: student.schedule,
      contacts: student.contacts || [],
      payments: student.payments || [],
      paid: student.paid || false,
      balance: student.balance || 0,
      avatar: student.avatar || null,
      exam_date: student.examDate || null,
      target_score: student.targetScore || null,
      parent_code: student.parent_code || null,
      remarks: student.remarks || [],
      board_url: student.boardUrl || null,
      call_url: student.callUrl || null,
    })
    if (error) console.error("saveStudent failed:", error.message, error)
  }

  async function handleSetStudents(updater) {
    const newStudents = typeof updater === "function" ? updater(students) : updater
    setStudents(newStudents)
    const added = newStudents.filter((s) => !students.find((old) => old.id === s.id))
    const updated = newStudents.filter((s) => {
      const old = students.find((o) => o.id === s.id)
      return old && JSON.stringify(old) !== JSON.stringify(s)
    })
    for (const s of [...added, ...updated]) {
      await saveStudent(s)
    }
  }

  useEffect(() => {
    async function restoreSession(session) {
      const minDelay = new Promise(r => setTimeout(r, 600))
      if (!session) { await minDelay; setLoadingAuth(false); return }
      const [{ data: tutor }] = await Promise.all([
        supabase.from("tutors").select("*").eq("id", session.user.id).single(),
        minDelay,
      ])
      if (tutor) {
        setUser({ ...session.user, role: "tutor", profile: tutor })
      }
      setLoadingAuth(false)
    }

    if (localStorage.getItem("parent_session")) {
      // Валидная сессия уже восстановлена в useState-инициализаторе
      const parentSession = readStoredSession("parent_session")
      if (parentSession) {
        // Сессия родителя в браузере бессрочна, а его JWT живёт 12 часов —
        // перевыпускаем по коду ребёнка при каждом заходе, иначе через полдня
        // кабинет молча опустеет: запросы пойдут под ролью anon.
        const code = parentSession.student?.parent_code
        if (code) {
          supabase.rpc("parent_login", { p_code: code })
            .then(({ data }) => setAppToken(data?.[0]?.token || null))
        }
        return
      }
      localStorage.removeItem("parent_session") // битый JSON — продолжаем обычный вход
    }

    const studentSession = localStorage.getItem("student_session")
    if (studentSession) {
      try {
        const parsed = JSON.parse(studentSession)
        // user ещё не установлен (см. инициализатор выше) — ждём подтверждения.
        // Токена нет (сессия ещё до этой миграции) или он не совпал с текущим —
        // считаем сессию невалидной и разлогиниваем, а не доверяем голому id.
        supabase.rpc("student_validate_session", { p_id: parsed.id, p_token: parsed.token }).then(({ data }) => {
          const account = data?.[0]
          if (!account) {
            localStorage.removeItem("student_session")
            setUser(null)
            setLoadingAuth(false)
            return
          }
          const { session_token, ...profile } = account
          const updated = { ...parsed, profile, token: session_token }
          setUser(updated)
          setLoadingAuth(false)
          localStorage.setItem("student_session", JSON.stringify(updated))
        })
        return
      } catch {
        // Битый JSON: user/loadingAuth уже null/true из инициализаторов — просто чистим ключ
        localStorage.removeItem("student_session")
      }
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => restoreSession(session))
      .catch(() => setLoadingAuth(false))

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        // Дубль защиты к проверке hash выше: событие приходит асинхронно, но
        // если hash по какой-то причине уже подчищен — ловим здесь.
        setRecovery(true)
        setLoadingAuth(false)
        return
      }
      if (session) {
        restoreSession(session)
      } else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        setUser(null)
        setLoadingAuth(false)
      }
      // TOKEN_REFRESHED с null (сбой обновления токена) — игнорируем, не выкидываем юзера
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    localStorage.removeItem("student_session")
    localStorage.removeItem("parent_session")
    setAppToken(null)
    await supabase.auth.signOut()
    setUser(null)
    // Сбрасываем данные учеников, иначе при входе под другим аккаунтом
    // без перезагрузки страницы остаётся список прошлого репетитора
    // (studentsLoaded === true блокирует повторную загрузку).
    setStudents([])
    setStudentsLoaded(false)
  }

  // Публичные юр-страницы — доступны без авторизации и до загрузки сессии
  // (152-ФЗ требует свободного доступа к Политике обработки ПДн).
  // Список адресов держит сама страница (LEGAL_PATHS), чтобы новый документ не
  // забыли добавить в маршрут и он не отдавал кабинет вместо текста.
  const legalPath = typeof window !== "undefined" ? window.location.pathname : "/"
  if (LEGAL_PATHS.includes(legalPath)) {
    return <Legal path={legalPath} />
  }

  // Сброс пароля важнее всех остальных экранов: пока новый пароль не задан, в
  // кабинет не пускаем, иначе ссылка из письма превращается в обычный вход.
  // После сохранения перезагружаем страницу без hash — сессия уже действует,
  // и обычный путь через getSession() откроет кабинет.
  if (recovery) {
    return (
      <ResetPassword
        onDone={() => window.location.replace(window.location.pathname)}
      />
    )
  }

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader-wrap flex flex-col items-center gap-5">
          <img src="/logo.webp" alt="Precettore" className="loader-breathe w-16 h-16 rounded-2xl object-cover shadow-xl shadow-blue-500/30" />
          <div className="loader-label text-[11px] text-gray-400 uppercase font-medium">
            Precettore
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    if (!authIntent) {
      return <Landing onStart={(role, mode) => setAuthIntent({ role, mode })} />
    }
    return (
      <Auth
        onLogin={setUser}
        initialRole={authIntent.role}
        initialMode={authIntent.mode}
        onBack={() => setAuthIntent(null)}
      />
    )
  }

  if (user.role === "parent") {
    return <ParentDashboard user={user} onLogout={handleLogout} />
  }

  if (user.role === "student") {
    return (
      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-[#1c1c1e]"><div className="loader-logo" /></div>}>
      <StudentDashboard
        user={user}
        students={students}
        studentsLoaded={studentsReady}
        onLogout={handleLogout}
        onReloadStudents={(newTutorId) => {
          if (newTutorId && newTutorId !== user.profile?.tutor_id) {
            // Студент только что привязался к репетитору — обновляем сессию и перегружаем
            const updated = { ...user, profile: { ...user.profile, tutor_id: newTutorId } }
            localStorage.setItem("student_session", JSON.stringify(updated))
            setStudentsLoaded(false)
            setUser(updated)
          } else {
            setStudentsLoaded(false)
            if (user.profile?.tutor_id) loadStudents(user.profile.tutor_id)
          }
        }}
      />
      </Suspense>
    )
  }

  const tutorChatContacts = students
    .filter(s => s.studentAccountId)
    .map(s => ({ id: `s:${s.studentAccountId}`, name: s.name, avatar: s.avatar || null, role: "Ученик" }))

  const mobileNav = [
    { label: "Главная", id: "dashboard" },
    { label: "Ученики", id: "students" },
    { label: "Задания", id: "homework" },
    { label: "Чат", id: "chat" },
    { label: "Оплата", id: "payment" },
  ]

  return (
    <SubscriptionProvider tutorId={user.id} onOpenPlans={() => navigateTo("profile")}>
    <div className="flex app-shell overflow-clip">
      {user.profile && !user.profile.onboarding_completed && (
        <TutorOnboardingModal
          tutorId={user.id}
          // second arg — куда пойти сразу после анкеты («Добавить первого ученика»)
          onComplete={(fields, goTo) => {
            setUser((prev) => ({ ...prev, profile: { ...prev.profile, ...fields } }))
            if (goTo) navigateTo(goTo)
          }}
        />
      )}

      {board && (
        <Suspense fallback={<div className="fixed inset-0 z-[100000] bg-white dark:bg-[#1c1c1e] flex items-center justify-center"><div className="loader-logo" /></div>}>
          <Board
            roomId={board.roomId}
            userId={`t:${user.id}`}
            userName={user.profile?.name || user.email}
            theme={document.documentElement.classList.contains("dark") ? "dark" : "light"}
            onClose={() => setBoard(null)}
          />
        </Suspense>
      )}

      <div className="hidden md:block">
        <Sidebar activePage={activePage} setActivePage={navigateTo} badges={{ chat: chatUnread }} name={user.profile?.name} email={user.email} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="topbar-glass flex justify-between items-center px-4 py-3">
          <div className="md:hidden text-sm font-semibold text-gray-700">Precettore</div>
          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle />
            <NotificationBell userId={user.id} onNavigate={navigateTo} />
            {/* Аватар — вход в «Профиль»: аккаунт, код для учеников, подписка
                и выход. На телефоне это единственная точка входа туда. */}
            <button
              onClick={() => navigateTo("profile")}
              aria-label="Профиль"
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium transition-all active:scale-95 ${
                activePage === "profile" ? "ring-2 ring-[#007AFF]/50 ring-offset-1 ring-offset-transparent" : ""
              }`}
              style={{ background: "linear-gradient(135deg, #0A84FF 0%, #5E5CE6 100%)" }}
            >
              {(user.profile?.name || user.email || "?").trim().charAt(0).toUpperCase()}
            </button>
          </div>
        </div>

        <div className={`flex-1 min-h-0 overflow-x-hidden ${activePage === "chat" ? "flex flex-col overflow-hidden" : "page-scroll overflow-y-auto pb-20 md:pb-0"}`}>
          <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="loader-logo" /></div>}>
          <div className={activePage !== "dashboard" ? "hidden" : "page-active"}>{visitedPages.has("dashboard") && <Dashboard students={students} setActivePage={navigateTo} onOpenBoard={openBoard} />}</div>
          <div className={activePage !== "students" ? "hidden" : "page-active"}>{visitedPages.has("students") && <Students students={students} setStudents={handleSetStudents} tutorId={user.id} onOpenBoard={openBoard} />}</div>
<div className={activePage !== "payment" ? "hidden" : "page-active"}>{visitedPages.has("payment") && <Payment students={students} setStudents={handleSetStudents} tutorId={user.id} />}</div>
          <div className={activePage !== "variants" ? "hidden" : "page-active"}>{visitedPages.has("variants") && <Variants user={user} students={students} />}</div>
          <div className={activePage !== "schedule" ? "hidden" : "page-active"}>{visitedPages.has("schedule") && <Schedule students={students} setStudents={handleSetStudents} />}</div>
          <div className={activePage !== "homework" ? "hidden" : "page-active"}>{visitedPages.has("homework") && <Homework user={user} students={students} />}</div>
          <div className={activePage !== "results" ? "hidden" : "page-active"}>{visitedPages.has("results") && <Results students={students} user={user} />}</div>
          <div className={activePage !== "taskgen" ? "hidden" : "page-active"}>{pageAllowed("taskgen") && visitedPages.has("taskgen") && <TaskGenPreview />}</div>
          <div className={activePage !== "profile" ? "hidden" : "page-active"}>{visitedPages.has("profile") && (
            <Profile
              user={user}
              students={students}
              studentsCount={students.length}
              onLogout={handleLogout}
              onProfileChange={(fields) => setUser((prev) => ({ ...prev, profile: { ...prev.profile, ...fields } }))}
            />
          )}</div>
          <div className={activePage !== "chat" ? "hidden" : "flex-1 min-h-0 flex flex-col page-active"}>{visitedPages.has("chat") && (
            <Chat
              myId={`t:${user.id}`}
              myName={user.profile?.name || user.email}
              initialContacts={tutorChatContacts}
              canAddByCode={false}
              onUnreadChange={(delta, isInit) => {
                if (isInit) setChatUnread(delta)
                else setChatUnread(n => Math.max(0, n + delta))
              }}
            />
          )}</div>
          </Suspense>
        </div>

        <div className="mobile-nav-glass md:hidden fixed bottom-0 left-0 right-0 z-50">
          <div className="flex justify-around items-center px-1 pt-2 pb-2">
            {mobileNav.map((item) => {
              const badge = item.id === "chat" ? chatUnread : 0
              return (
                <button
                  key={item.id}
                  onClick={() => { navigateTo(item.id); if (item.id === "chat") setChatUnread(0) }}
                  className={`relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all min-w-[48px] ${
                    activePage === item.id
                      ? "text-blue-600 bg-blue-500/10 font-semibold"
                      : "text-gray-400"
                  }`}
                >
                  <NavIcon id={item.id} size={22} />
                  {badge > 0 && (
                    <span className="absolute -top-0.5 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                  <span className="text-[10px]">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
    </SubscriptionProvider>
  )
}

export default App
