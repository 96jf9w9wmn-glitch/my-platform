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
