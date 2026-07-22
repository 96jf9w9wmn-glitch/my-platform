import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import Icon from "../components/Icon"
import StudentOnboardingModal from "../components/StudentOnboardingModal" // ВРЕМЕННО: демо-кнопка опросника

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login")
  const [role, setRole] = useState("tutor")
  const [form, setForm] = useState({ name: "", email: "", phone: "+7", password: "", code: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [resetSent, setResetSent] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark")
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [showOnbDemo, setShowOnbDemo] = useState(false) // ВРЕМЕННО: демо опросника ученика

  useEffect(() => {
    if (cooldownLeft <= 0) return
    const t = setTimeout(() => setCooldownLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldownLeft])

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [dark])

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleResetPassword() {
    setError("")
    setLoading(true)
    try {
      if (role === "tutor") {
        if (!form.email) throw new Error("Введи email")
        const { error } = await supabase.auth.resetPasswordForEmail(form.email)
        if (error) throw error
        setResetSent(true)
      } else {
        const phone = form.phone.trim()
        if (!phone) throw new Error("Введи номер телефона")
        if (!newPassword || newPassword.length < 6) throw new Error("Новый пароль минимум 6 символов")

        const { data: ok, error: resetError } = await supabase
          .rpc("student_reset_password", { p_phone: phone, p_new_password: newPassword })
        if (resetError) throw resetError
        if (!ok) throw new Error("Аккаунт с таким номером не найден")

        setResetSent(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    setError("")
    if (cooldownLeft > 0) {
      setError(`Слишком много попыток. Подождите ${cooldownLeft} сек.`)
      return
    }
    setLoading(true)

    try {
      if (role === "parent") {
        const code = form.code.trim().toUpperCase()
        if (!code) throw new Error("Введи код ученика")
        const { data: found, error: fetchError } = await supabase
          .from("students")
          .select("*")
          .eq("parent_code", code)
        if (fetchError) throw fetchError
        if (!found || found.length === 0) throw new Error("Ученик с таким кодом не найден")
        const sessionData = { role: "parent", student: found[0] }
        localStorage.setItem("parent_session", JSON.stringify(sessionData))
        onLogin(sessionData)

      } else if (role === "student") {
        const phone = form.phone.trim()
        if (!phone) throw new Error("Введи номер телефона")
        if (!form.password) throw new Error("Введи пароль")

        if (mode === "login") {
          const { data: rows, error: loginError } = await supabase
            .rpc("student_login", { p_phone: phone, p_password: form.password })
          if (loginError) throw loginError
          const account = rows?.[0]
          if (!account) throw new Error("Неверный телефон или пароль")

          const { session_token, ...profile } = account
          const sessionData = { id: account.id, role: "student", profile, token: session_token }
          localStorage.setItem("student_session", JSON.stringify(sessionData))
          onLogin(sessionData)

        } else {
          if (!form.name) throw new Error("Введи имя")
          if (form.password.length < 6) throw new Error("Пароль минимум 6 символов")

          // Регистрация без кода репетитора — только аккаунт. Репетиторов ученик
          // привязывает по коду в опроснике/настройках (можно несколько).
          const { data: rows, error: registerError } = await supabase
            .rpc("student_register", {
              p_phone: phone,
              p_password: form.password,
              p_name: form.name,
            })
          if (registerError) throw registerError
          const newAccount = rows?.[0]
          if (!newAccount) throw new Error("Не удалось создать аккаунт")

          const { session_token, ...profile } = newAccount
          const sessionData = { id: newAccount.id, role: "student", profile, token: session_token }
          localStorage.setItem("student_session", JSON.stringify(sessionData))
          onLogin(sessionData)
        }

      } else {
        if (mode === "login") {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password,
          })
          if (error) throw error
          const { data: tutor } = await supabase.from("tutors").select("*").eq("id", data.user.id).single()
          onLogin({ ...data.user, role: "tutor", profile: tutor })

        } else {
          if (!form.name) throw new Error("Введи имя")
          if (!form.email) throw new Error("Введи email")
          if (form.password.length < 6) throw new Error("Пароль минимум 6 символов")

          const { data, error } = await supabase.auth.signUp({
            email: form.email,
            password: form.password,
          })
          if (error) throw error

          const { error: profileError } = await supabase.from("tutors").insert({
            id: data.user.id,
            email: form.email,
            name: form.name,
          })
          if (profileError) throw profileError

          const { data: tutor } = await supabase.from("tutors").select("*").eq("id", data.user.id).single()
          onLogin({ ...data.user, role: "tutor", profile: tutor })
        }
      }
    } catch (err) {
      setError(err.message)
      const next = failedAttempts + 1
      setFailedAttempts(next)
      if (next >= 5) {
        setCooldownLeft(30)
        setFailedAttempts(0)
        setError("Слишком много попыток. Подождите 30 секунд.")
      }
    } finally {
      setLoading(false)
    }
  }

  const roleConfig = {
    tutor:   { icon: "user-teacher", label: "Репетитор", desc: "Управляй учениками",   grad: "from-blue-500 to-blue-600",   soft: "bg-blue-50 dark:bg-blue-900/30",   text: "text-blue-600 dark:text-blue-400",   border: "border-blue-200 dark:border-blue-700" },
    student: { icon: "book",         label: "Ученик",     desc: "Готовься к экзамену",  grad: "from-emerald-500 to-teal-600", soft: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-700" },
    parent:  { icon: "users",        label: "Родитель",   desc: "Следи за успехами",    grad: "from-amber-500 to-orange-500", soft: "bg-amber-50 dark:bg-amber-900/30",   text: "text-amber-600 dark:text-amber-400",   border: "border-amber-200 dark:border-amber-700" },
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* ВРЕМЕННО: кнопка для предпросмотра опросника ученика (демо-режим, без БД). Удалить позже. */}
      <button
        onClick={() => setShowOnbDemo(true)}
        className="fixed bottom-4 left-4 z-50 text-xs px-3 py-2 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-transform"
      >
        Опросник (демо)
      </button>
      {showOnbDemo && (
        <StudentOnboardingModal demo studentId="demo" token="demo" onComplete={() => setShowOnbDemo(false)} />
      )}

      <button
        onClick={() => setDark(!dark)}
        className="fixed top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-sm z-50"
      >
        <span key={dark ? "sun" : "moon"} className={dark ? "icon-sun-enter" : "icon-moon-enter"}>
          {dark ? <Icon name="sun" size={16} /> : <Icon name="moon" size={16} />}
        </span>
      </button>
      <div className="glass-modal w-full max-w-md overflow-hidden">

        {/* Шапка с логотипом — плавный переход градиента */}
        <div className="relative px-8 pt-8 pb-10 text-white text-center overflow-hidden">
          {Object.entries(roleConfig).map(([r, cfg]) => (
            <div
              key={r}
              className={`absolute inset-0 bg-gradient-to-br ${cfg.grad} transition-opacity duration-500`}
              style={{ opacity: role === r ? 1 : 0 }}
            />
          ))}
          <div className="absolute inset-0 opacity-20" style={{backgroundImage: "radial-gradient(circle at 20% 50%, white 0%, transparent 50%), radial-gradient(circle at 80% 20%, white 0%, transparent 40%)"}} />
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/25 backdrop-blur-sm mx-auto mb-3 shadow-lg">
              <img src="/logo.webp" alt="Логотип" className="w-full h-full object-cover" />
            </div>
            <div className="text-xl font-bold tracking-tight">Precettore</div>
            <div className="text-sm text-white/75 mt-0.5">
              {mode === "login" ? "Войдите в аккаунт" : "Создайте аккаунт"}
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Выбор роли */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {["tutor", "student", "parent"].map((r) => {
              const cfg = roleConfig[r]
              const active = role === r
              return (
                <button
                  key={r}
                  onClick={() => { setRole(r); setError("") }}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 transition-all duration-200 ${
                    active
                      ? `bg-gradient-to-br ${cfg.grad} text-white border-transparent shadow-md`
                      : `bg-white dark:bg-gray-800 ${cfg.text} ${cfg.border}`
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? "bg-white/20" : cfg.soft}`}>
                    <Icon name={cfg.icon} size={18} />
                  </div>
                  <span className="text-xs font-semibold">{cfg.label}</span>
                </button>
              )
            })}
          </div>

        <div className="flex flex-col gap-3">
          {mode === "reset" && resetSent && (
            <div className="bg-green-50 text-green-700 text-sm px-3 py-3 rounded-lg text-center">
              {role === "tutor"
                ? "Письмо со ссылкой для сброса пароля отправлено на " + form.email
                : "Пароль успешно изменён! Теперь войди с новым паролем."}
            </div>
          )}

          {mode === "reset" && !resetSent && role === "tutor" && (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="example@mail.com"
                className="input-glass"
              />
            </div>
          )}

          {mode === "reset" && !resetSent && role === "student" && (
            <>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Номер телефона</label>
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^\d+]/g, "")
                    if (!val.startsWith("+7")) val = "+7"
                    if (val.length > 12) val = val.slice(0, 12)
                    setForm((prev) => ({ ...prev, phone: val }))
                  }}
                  placeholder="+79001234567"
                  className="input-glass"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Новый пароль</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    className="input-glass pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showNewPassword
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
            </>
          )}

          {mode !== "reset" && mode === "register" && (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Имя</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Иван Иванов"
                className="input-glass"
              />
            </div>
          )}

          {role === "parent" && (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Код ученика</label>
              <input
                name="code"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="Например: ABC123"
                className="input-glass tracking-widest text-center text-lg font-mono caret-transparent"
                maxLength={6}
                autoComplete="off"
              />
              <p className="text-xs text-gray-400 mt-1 text-center">Код выдаётся репетитором</p>
            </div>
          )}

          {mode !== "reset" && role !== "parent" && (role === "student" ? (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Номер телефона</label>
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d+]/g, "")
                  if (!val.startsWith("+7")) val = "+7"
                  if (val.length > 12) val = val.slice(0, 12)
                  setForm((prev) => ({ ...prev, phone: val }))
                }}
                placeholder="+79001234567"
                className="input-glass"
              />
            </div>
          ) : (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="example@mail.com"
                className="input-glass"
              />
            </div>
          ))}

          {mode !== "reset" && role !== "parent" && (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Пароль</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder={mode === "register" ? "Минимум 6 символов" : "Введите пароль"}
                  className="input-glass pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {!(mode === "reset" && resetSent) && (
            <button
              onClick={mode === "reset" ? handleResetPassword : handleSubmit}
              disabled={loading || cooldownLeft > 0}
              className={`w-full py-2.5 text-sm text-white font-medium rounded-xl disabled:opacity-50 mt-1 transition-all bg-gradient-to-r ${roleConfig[role].grad}`}
            >
              {loading
                ? "Загрузка..."
                : cooldownLeft > 0
                ? `Подождите ${cooldownLeft} сек.`
                : mode === "reset"
                ? "Сбросить пароль"
                : mode === "login"
                ? "Войти"
                : "Зарегистрироваться"}
            </button>
          )}
        </div>

        {mode === "login" && role !== "parent" && (
          <div className="text-center mt-3">
            <button
              onClick={() => { setMode("reset"); setError(""); setResetSent(false); setNewPassword("") }}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:opacity-70 transition-opacity"
            >
              Забыли пароль?
            </button>
          </div>
        )}

        {role !== "parent" && (
          <div className="text-center mt-4">
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login")
                setError("")
                setResetSent(false)
              }}
              className="text-sm text-blue-600 hover:opacity-70 transition-opacity"
            >
              {mode === "reset"
                ? "Назад ко входу"
                : mode === "login"
                ? "Нет аккаунта? Зарегистрироваться"
                : "Уже есть аккаунт? Войти"}
            </button>
          </div>
        )}
        </div> {/* p-6 */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pb-5 -mt-1 text-[11px] text-gray-400 dark:text-gray-500">
          <a href="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Политика конфиденциальности</a>
          <a href="/consent" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Согласие на обработку ПДн</a>
          <a href="/cookie" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Cookie</a>
        </div>
      </div>
    </div>
  )
}

export default Auth
