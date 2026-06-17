import { useState, useEffect } from "react"
import { supabase } from "./supabase"
import Sidebar from "./components/Sidebar"
import Students from "./pages/Students"
import Payment from "./pages/Payment"
import Schedule from "./pages/Schedule"
import Auth from "./pages/Auth"
import StudentDashboard from "./pages/StudentDashboard"
import Results from "./pages/Results"
import Variants from "./pages/Variants"
import { students as initialStudents } from "./data/students"

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
      {dark ? "☀️" : "🌙"}
    </button>
  )
}

function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)

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
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) loadNotifications() }}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium">Уведомления</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                Прочитать все
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-8">Уведомлений нет</div>
            ) : notifications.map((n) => (
              <div key={n.id} className={`px-4 py-3 border-b border-gray-50 ${!n.read ? "bg-blue-50" : ""}`}>
                <div className="text-sm font-medium text-gray-700">{n.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(n.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  )
}
function App() {
  const [user, setUser] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [activePage, setActivePage] = useState("students")
  const [students, setStudents] = useState(() => {
    const saved = localStorage.getItem("students")
    return saved ? JSON.parse(saved) : initialStudents
  })

  useEffect(() => {
    localStorage.setItem("students", JSON.stringify(students))
  }, [students])

  useEffect(() => {
    async function restoreSession(session) {
      if (!session) { setLoadingAuth(false); return }
      const { data: tutor } = await supabase.from("tutors").select("*").eq("id", session.user.id).single()
      if (tutor) {
        setUser({ ...session.user, role: "tutor", profile: tutor })
      } else {
        const { data: student } = await supabase.from("student_accounts").select("*").eq("id", session.user.id).single()
        if (student) setUser({ ...session.user, role: "student", profile: student })
      }
      setLoadingAuth(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      restoreSession(session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) restoreSession(session)
      else { setUser(null); setLoadingAuth(false) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Загрузка...</div>
      </div>
    )
  }

  if (!user) {
    return <Auth onLogin={setUser} />
  }

  if (user.role === "student") {
    return <StudentDashboard user={user} students={students} onLogout={handleLogout} />
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="flex-1">
        <div className="flex justify-end items-center px-6 py-3 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            {user.profile?.code && (
              <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                Код для учеников: <span className="font-mono font-medium text-gray-700">{user.profile.code}</span>
              </div>
            )}
            <ThemeToggle />
            <NotificationBell userId={user.id} />
            <span className="text-sm text-gray-600">{user.profile?.name || user.email}</span>
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">Выйти</button>
          </div>
        </div>
        {activePage === "students" && <Students students={students} setStudents={setStudents} />}
        {activePage === "schedule" && <Schedule students={students} setStudents={setStudents} />}
        {activePage === "payment" && <Payment students={students} setStudents={setStudents} />}
        {activePage === "variants" && <Variants user={user} />}
        {activePage === "results" && <Results students={students} setStudents={setStudents} />}
      </div>
    </div>
  )
}

export default App
