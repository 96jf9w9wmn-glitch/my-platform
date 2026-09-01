// Второй шаг регистрации репетитора: код с почты.
//
// Отдельным окном, а не ещё одним полем в форме: пока код не введён, аккаунта
// не существует вовсе, и остальные поля трогать уже нечего. Окно закрывается —
// регистрация просто не состоялась, ничего чистить не нужно.
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"

export default function EmailCodeModal({ email, onSubmit, onResend, busy, error, resendAfter = 60, onClose }) {
  const [code, setCode] = useState("")
  const [left, setLeft] = useState(resendAfter)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState("")
  const { cls: closingCls, close } = useClosing(onClose)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  async function resend() {
    setResending(true)
    setResent("")
    const ok = await onResend()
    setResending(false)
    if (ok) { setLeft(resendAfter); setResent("Код отправлен ещё раз") }
  }

  const ready = /^\d{6}$/.test(code)

  return createPortal(
    <div className={`fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 ${closingCls}`}>
      <div className={`glass-modal w-full max-w-sm flex flex-col ${closingCls}`}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100/60">
          <h2 className="text-lg font-medium">Подтвердите почту</h2>
          <button onClick={close} aria-label="Закрыть" className="text-gray-500 hover:text-gray-700 transition-transform active:scale-90">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-gray-500 leading-relaxed">
            Мы отправили код из шести цифр на <span className="text-gray-700 dark:text-gray-200 break-all">{email}</span>.
            Он действует десять минут — без него аккаунт не создастся.
          </p>

          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => { if (e.key === "Enter" && ready && !busy) onSubmit(code) }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            aria-label="Код из письма"
            className="input-glass text-center text-2xl tracking-[0.5em] font-medium tabular-nums"
          />

          {error && <div className="text-sm text-red-500 text-center">{error}</div>}
          {!error && resent && <div className="text-sm text-green-600 text-center">{resent}</div>}

          <button
            onClick={() => onSubmit(code)}
            disabled={!ready || busy}
            className="btn-primary w-full py-2.5 disabled:opacity-50"
          >
            {busy ? "Проверяем…" : "Подтвердить и войти"}
          </button>

          <button
            onClick={resend}
            disabled={left > 0 || resending}
            className="text-sm text-[#007AFF] disabled:text-gray-400 transition-colors"
          >
            {resending ? "Отправляем…" : left > 0 ? `Отправить снова через ${left} с` : "Отправить код ещё раз"}
          </button>

          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            Письмо приходит с адреса precettore@inbox.ru. Если его нет во «Входящих» — посмотрите в «Спаме».
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
