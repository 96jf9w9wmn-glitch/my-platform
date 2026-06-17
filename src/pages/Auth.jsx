import { useState } from "react"
import { supabase } from "../supabase"

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login")
  const [role, setRole] = useState("tutor")
  const [form, setForm] = useState({ name: "", email: "", password: "", code: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    setError("")
    setLoading(true)

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
        if (error) throw error

        if (role === "tutor") {
          const { data: tutor } = await supabase.from("tutors").select("*").eq("id", data.user.id).single()
          onLogin({ ...data.user, role: "tutor", profile: tutor })
        } else {
          const { data: student } = await supabase.from("student_accounts").select("*").eq("id", data.user.id).single()
          onLogin({ ...data.user, role: "student", profile: student })
        }

      } else {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
        })
        if (error) throw error

        if (role === "tutor") {
          const { error: profileError } = await supabase.from("tutors").insert({
            id: data.user.id,
            email: form.email,
            name: form.name,
          })
          if (profileError) throw profileError
          const { data: tutor } = await supabase.from("tutors").select("*").eq("id", data.user.id).single()
          onLogin({ ...data.user, role: "tutor", profile: tutor })
        } else {
          const { data: tutorData, error: tutorError } = await supabase
            .from("tutors").select("id").eq("code", form.code.toLowerCase()).single()
          if (tutorError || !tutorData) throw new Error("Неверный код репетитора!")

          const { error: profileError } = await supabase.from("student_accounts").insert({
            id: data.user.id,
            email: form.email,
            name: form.name,
            tutor_code: form.code.toLowerCase(),
            tutor_id: tutorData.id,
          })
          if (profileError) throw profileError
          const { data: student } = await supabase.from("student_accounts").select("*").eq("id", data.user.id).single()
          onLogin({ ...data.user, role: "student", profile: student })
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-md shadow-sm">
        <h1 className="text-2xl font-medium mb-2 text-center">Платформа</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          {mode === "login" ? "Войдите в аккаунт" : "Создайте аккаунт"}
        </p>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setRole("tutor")}
            className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
              role === "tutor" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            👨‍🏫 Репетитор
          </button>
          <button
            onClick={() => setRole("student")}
            className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
              role === "student" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            👨‍🎓 Ученик
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {mode === "register" && (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Имя</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Иван Иванов"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
          )}

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="example@mail.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Пароль</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Минимум 6 символов"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>

          {mode === "register" && role === "student" && (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Код репетитора</label>
              <input
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="Введи 6-значный код"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 text-white rounded-lg py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50 mt-1"
          >
            {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </div>

        <div className="text-center mt-4">
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError("") }}
            className="text-sm text-blue-600 hover:underline"
          >
            {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Auth
