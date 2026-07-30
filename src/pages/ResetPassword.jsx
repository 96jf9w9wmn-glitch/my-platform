import { useState } from "react"
import { supabase } from "../supabase"

// Экран установки нового пароля после перехода по ссылке из письма.
//
// GoTrue проверяет токен и возвращает репетитора на сайт с уже действующей
// сессией. Без этого экрана ссылка работала бы как одноразовый вход: человек
// попадал в кабинет, а пароль оставался прежним и сменить его было негде.
// Поэтому App.jsx показывает этот экран ВМЕСТО кабинета, пока пароль не задан.
function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("")
  const [repeat, setRepeat] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  async function submit() {
    setError("")
    if (password.length < 6) { setError("Пароль минимум 6 символов"); return }
    if (password !== repeat) { setError("Пароли не совпадают"); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) {
      // Ссылка живёт ограниченное время — самая частая причина отказа.
      setError(/expired|invalid/i.test(err.message)
        ? "Ссылка устарела. Запросите сброс пароля заново."
        : err.message)
      return
    }
    setDone(true)
    setTimeout(onDone, 1400)
  }

  return (
    // Тот же якорь по верху, что и в Auth: экран сброса открывается из формы
    // входа и не должен прыгать относительно неё.
    <div className="min-h-dvh flex items-center justify-center px-4 py-16 sm:py-8">
      <div className="glass-modal w-full max-w-md overflow-hidden">
        <div className="relative px-8 pt-6 pb-6 text-white text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 0%, transparent 50%), radial-gradient(circle at 80% 20%, white 0%, transparent 40%)" }} />
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/25 backdrop-blur-sm mx-auto mb-2 shadow-lg">
              <img src="/logo.webp" alt="Логотип" className="w-full h-full object-cover" />
            </div>
            <div className="text-lg font-bold tracking-tight">Новый пароль</div>
            <div className="text-[13px] text-white/75 mt-0.5">
              Придумайте пароль для входа
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-3">
          {done ? (
            <div className="bg-green-50 text-green-700 text-sm px-3 py-4 rounded-lg text-center">
              Пароль изменён. Открываем кабинет…
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Новый пароль</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="минимум 6 символов"
                  className="input-glass"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-1 block">Повторите пароль</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  className="input-glass"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <button
                onClick={submit}
                disabled={loading}
                className="w-full h-[52px] text-[15px] text-white font-semibold rounded-full disabled:opacity-50 mt-1 transition-all bg-gradient-to-r from-blue-500 to-blue-600"
              >
                {loading ? "Сохраняем..." : "Сохранить пароль"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResetPassword
