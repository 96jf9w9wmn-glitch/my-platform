import { useState, useEffect, useRef } from "react"
import { supabase, setAppToken, clearAppSession } from "../supabase"
import Icon from "../components/Icon"
import MorphIcon from "../components/MorphIcon"
import BetaBadge from "../components/BetaBadge"
import { ConsentRow, ConsentLink } from "../components/ConsentChecks"
import { logConsent } from "../consents"
import { isValidRuPhone, isValidEmail, isValidPersonName } from "../utils"
import { loadTutorProfile } from "../tutorProfile"
import { tutorSignIn } from "../tutorSignIn"
import CodeModal from "../components/CodeModal"

// Столько же попыток считает сервер (supabase/login_guard.sql и
// api/auth-login.js). Здесь число нужно ровно для подсказки «осталось N».
const LOGIN_MAX_TRIES = 5

// Блокировка длится 15 минут, и «Подождите 900 сек.» читается как ошибка.
function formatWait(sec) {
  if (sec >= 90) return `${Math.ceil(sec / 60)} мин.`
  return `${sec} сек.`
}

// Подсказка под полем: одна строка, появляется плавно и не двигает форму
// рывком — карточка входа измеряет свою высоту и анимирует её.
function FieldHint({ show, children }) {
  return (
    <div className={`overflow-hidden transition-all duration-200 ${show ? "max-h-8 mt-1 opacity-100" : "max-h-0 opacity-0"}`}>
      <p className="text-xs text-red-500">{children}</p>
    </div>
  )
}

function Auth({ onLogin, initialRole, initialMode = "login", onBack }) {
  const [mode, setMode] = useState(initialMode)
  // Роль помним между заходами (её же выбирают карточками на лендинге):
  // повторный вход открывается сразу нужной формой.
  const [role, setRole] = useState(() => initialRole || localStorage.getItem("preferred_role") || "tutor")
  const [form, setForm] = useState({ name: "", email: "", phone: "+7", password: "", code: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [resetSent, setResetSent] = useState(false)
  // Подсказку про формат показываем только после того, как поле покинули:
  // ругаться на «+7 (9» посреди набора номера — значит мешать вводу.
  const [touched, setTouched] = useState({})
  // Второй шаг: код подтверждения. У репетитора он приходит на почту при
  // регистрации, у ученика — в SMS, и при регистрации, и при смене пароля.
  // { channel: "email" | "sms", to, title, purpose }
  const [codeStep, setCodeStep] = useState(null)
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeError, setCodeError] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark")
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  // Кнопки «На главную» и темы прибиты к вьюпорту, а страница под ними
  // прокручивается. Как только прокрутка началась, под кнопками проявляется
  // матовая подложка — иначе на телефоне карточка (там она во всю ширину)
  // проезжает прямо сквозь них.
  const [scrolled, setScrolled] = useState(false)
  // Согласия при регистрации — только обязательные, чтобы форма помещалась на
  // экран. Галочки НЕ проставлены заранее: с 01.09.2025 согласие на обработку
  // ПДн даётся активным действием (см. legal/consent.md). Необязательная
  // рассылка спрашивается уже в кабинете, а не здесь.
  const [consent, setConsent] = useState({ terms: false, pd: false, guardian: false })

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Карточка центрирована по вертикали, а формы разной длины (вход 655px,
  // регистрация ученика 836px). Без этого при каждом переключении роли или
  // режима карточка перецентрировалась рывком. Меряем содержимое и задаём
  // карточке высоту числом — тогда её можно анимировать (height: auto CSS
  // анимировать не умеет), и она мягко раскрывается из центра.
  const bodyRef = useRef(null)
  const cardRef = useRef(null)
  const [cardHeight, setCardHeight] = useState(null)

  useEffect(() => {
    const el = bodyRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    // Мерить строго высоту В ПОТОКЕ (borderBoxSize / offsetHeight), НЕ
    // getBoundingClientRect: при появлении карточки играет `modal-enter` со
    // scale(0.94), а rect отдаёт высоту С УЧЁТОМ трансформа родителя. Первый
    // же вызов наблюдателя приходится на анимацию, и карточка запоминала
    // высоту на ~6% меньше нужной (670 → 630). Больше наблюдатель не
    // срабатывал (в потоке-то ничего не менялось), поэтому overflow-hidden
    // навсегда срезал нижнюю строку — ссылку «Нет аккаунта?».
    // Плюс к содержимому нужны рамки самой карточки: box-sizing: border-box,
    // и без них height срезал бы ещё 2px.
    const ro = new ResizeObserver(([entry]) => {
      const inner = entry?.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight
      const card = cardRef.current
      const borders = card ? card.offsetHeight - card.clientHeight : 0
      setCardHeight(Math.ceil(inner) + borders)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  // Телефон храним в каноничном виде "+7XXXXXXXXXX", а показываем маской
  // "+7 (XXX) XXX-XX-XX" — RPC/база не меняются.
  function normalizePhone(input) {
    let d = (input || "").replace(/\D/g, "")
    if (d.startsWith("8")) d = "7" + d.slice(1)
    if (!d.startsWith("7")) d = "7" + d
    return "+" + d.slice(0, 11)
  }

  function formatPhone(raw) {
    const rest = (raw || "").replace(/\D/g, "").slice(1) // цифры после кода 7
    let out = "+7"
    if (rest.length > 0) out += " (" + rest.slice(0, 3)
    if (rest.length >= 3) out += ")"
    if (rest.length > 3) out += " " + rest.slice(3, 6)
    if (rest.length > 6) out += "-" + rest.slice(6, 8)
    if (rest.length > 8) out += "-" + rest.slice(8, 10)
    return out
  }

  function handlePhoneChange(e) {
    const phone = normalizePhone(e.target.value)
    setForm((prev) => ({ ...prev, phone }))
  }

  async function handleResetPassword() {
    setError("")
    setLoading(true)
    try {
      if (role === "tutor") {
        if (!form.email) throw new Error("Введи email")
        if (!isValidEmail(form.email)) throw new Error("Проверьте адрес почты: он записан с ошибкой")
        // redirectTo задаём явно: иначе ссылка ведёт на SITE_URL из настроек
        // сервера, а он один и тот же для прода и локальной разработки.
        // Адрес должен быть в ADDITIONAL_REDIRECT_URLS на сервере.
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setResetSent(true)
      } else {
        const phone = form.phone.trim()
        if (!phone) throw new Error("Введи номер телефона")
        if (!isValidRuPhone(phone)) throw new Error("Проверь номер: нужны все десять цифр после +7")
        if (!newPassword || newPassword.length < 6) throw new Error("Новый пароль минимум 6 символов")

        // Пароль меняется только после кода из SMS. Раньше хватало одного
        // знания номера — а его знает любой одноклассник, и вместе с паролем
        // забирались переписка, домашние работы и данные родителя.
        const data = await callPhoneVerify()
        if (data.sms) {
          setCodeStep({ channel: "sms", to: formatPhone(phone), title: "Подтверди номер" })
          setCodeError("")
        } else {
          setResetSent(true)   // SMS у платформы не настроены — пароль уже сменён
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Обязательные согласия. Необязательная галочка (рассылка) тут намеренно
  // не проверяется — она добровольная.
  function requireConsent() {
    // У родителя аккаунта нет, он входит по коду ребёнка — но своё имя оставляет
    // и получает доступ к данным ребёнка, поэтому согласие нужно и здесь.
    if (role === "parent") {
      if (!consent.pd) throw new Error("Подтвердите согласие на обработку данных — без него доступ к кабинету ребёнка открыть нельзя")
      return
    }
    if (!consent.terms) throw new Error("Подтвердите принятие документов сервиса — без этого договор не считается заключённым")
    if (!consent.pd) throw new Error("Без согласия на обработку персональных данных зарегистрировать аккаунт нельзя")
    if (role === "student" && !consent.guardian) throw new Error("Подтвердите возраст или согласие законного представителя")
  }

  // Те же условия, что и в requireConsent(), но до нажатия: юрист просил, чтобы
  // без галочек зарегистрироваться было НЕЛЬЗЯ, а не чтобы человек получал
  // ошибку после отправки формы. Кнопка гаснет, под ней появляется подсказка.
  // requireConsent() при этом остаётся: он страхует отправку в обход кнопки.
  const consentReady =
    mode === "reset"
      ? true
      : role === "parent"
        ? consent.pd
        : mode === "register"
          ? consent.terms && consent.pd && (role !== "student" || consent.guardian)
          : true

  function saveConsent(subjectId, contact) {
    return logConsent({
      role,
      subjectId,
      contact,
      terms: consent.terms,
      personalData: consent.pd,
      guardian: role === "student" ? consent.guardian : null,
    })
  }

  // ── Телефон ученика: код в SMS ───────────────────────────────────────────
  // Регистрация и смена пароля идут через свой обработчик, а не через RPC:
  // проверять код на клиенте бессмысленно — запрос можно послать мимо неё,
  // поэтому грант на student_register/student_reset_password у anon снят.
  //
  // Тело запроса одно и то же на обоих шагах: на первом сервер шлёт код, на
  // втором — сверяет его и тут же выполняет действие. Держать пароль на сервере
  // между шагами было бы хуже: пришлось бы где-то его хранить.
  function phoneBody(extra = {}) {
    return {
      phone: form.phone.trim(),
      purpose: mode === "reset" ? "reset" : "register",
      password: mode === "reset" ? newPassword : form.password,
      name: form.name,
      ...extra,
    }
  }

  async function callPhoneVerify(extra) {
    const res = await fetch("/api/phone-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(phoneBody(extra)),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || "Не получилось. Попробуй ещё раз")
    return data
  }

  // Ученик зарегистрирован — дальше как раньше: JWT роли app_user в клиент,
  // сессия в localStorage.
  async function finishStudentRegister(account, phone) {
    if (!account) throw new Error("Не удалось создать аккаунт")
    const { session_token, token: jwt, ...profile } = account
    setAppToken(jwt || null)
    await saveConsent(account.id, phone)
    const sessionData = { id: account.id, role: "student", profile, token: session_token }
    localStorage.setItem("student_session", JSON.stringify(sessionData))
    onLogin(sessionData)
  }

  async function resendPhoneCode() {
    try {
      await callPhoneVerify()
      setCodeError("")
      return true
    } catch (err) {
      setCodeError(err.message)
      return false
    }
  }

  async function confirmPhoneCode(code) {
    setCodeBusy(true)
    setCodeError("")
    try {
      const data = await callPhoneVerify({ action: "verify", code })
      setCodeStep(null)
      if (data.account) await finishStudentRegister(data.account, form.phone.trim())
      else setResetSent(true)
    } catch (err) {
      setCodeError(err.message)
    } finally {
      setCodeBusy(false)
    }
  }

  // Запрос кода. Ошибку пробрасываем наверх: её показывает та же форма.
  async function requestEmailCode(email) {
    const res = await fetch("/api/auth-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", email }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || "Не удалось отправить код")
    return true
  }

  async function resendEmailCode() {
    try {
      await requestEmailCode(form.email)
      setCodeError("")
      return true
    } catch (err) {
      setCodeError(err.message)
      return false
    }
  }

  // Проверка кода и создание аккаунта — одним запросом на сервер: без верного
  // кода пользователя в GoTrue не появляется вовсе.
  async function confirmEmailCode(code) {
    setCodeBusy(true)
    setCodeError("")
    try {
      const res = await fetch("/api/auth-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email: form.email, code, password: form.password, name: form.name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Не удалось подтвердить код")

      clearAppSession()
      if (data.access_token) {
        const { error } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
        if (error) throw error
      }
      const user = data.user
      await saveConsent(user.id, form.email)
      const tutor = await loadTutorProfile(user.id)
      setCodeStep(null)
      onLogin({ ...user, role: "tutor", profile: tutor })
    } catch (err) {
      setCodeError(err.message)
    } finally {
      setCodeBusy(false)
    }
  }

  async function handleSubmit() {
    setError("")
    if (cooldownLeft > 0) {
      setError(`Слишком много попыток. Подождите ${formatWait(cooldownLeft)}.`)
      return
    }
    setLoading(true)

    try {
      if (role === "parent") {
        const code = form.code.trim().toUpperCase()
        if (!code) throw new Error("Введи код ученика")
        requireConsent()
        // Раньше это был прямой select по parent_code — он требовал держать
        // таблицу учеников открытой на чтение анониму. Теперь код проверяет RPC
        // и возвращает токен, под которым родитель уже читает карточку ребёнка.
        const { data: rows, error: fetchError } = await supabase
          .rpc("parent_login", { p_code: code })
        if (fetchError) throw fetchError
        const match = rows?.[0]
        if (!match) throw new Error("Ученик с таким кодом не найден")
        setAppToken(match.token)
        const { data: found, error: rowError } = await supabase
          .from("students")
          .select("*")
          .eq("id", match.student_id)
        if (rowError) throw rowError
        if (!found || found.length === 0) throw new Error("Не удалось открыть карточку ученика")
        await saveConsent(found[0].id, form.name.trim() || null)
        const sessionData = { role: "parent", parentName: form.name.trim() || null, student: found[0] }
        localStorage.setItem("parent_session", JSON.stringify(sessionData))
        onLogin(sessionData)

      } else if (role === "student") {
        const phone = form.phone.trim()
        if (!phone) throw new Error("Введи номер телефона")
        // Телефон — это логин ученика и единственная связка его карточки с
        // аккаунтом, поэтому «+7 12» пускать нельзя ни при регистрации, ни при
        // входе: с кривым номером человек просто не найдёт свою запись.
        if (!isValidRuPhone(phone)) throw new Error("Проверь номер: нужны все десять цифр после +7")
        if (!form.password) throw new Error("Введи пароль")

        if (mode === "login") {
          const { data: rows, error: loginError } = await supabase
            .rpc("student_login", { p_phone: phone, p_password: form.password })
          if (loginError) throw loginError
          const account = rows?.[0]
          if (!account) throw new Error("Неверный телефон или пароль")

          // token — это JWT роли app_user: без него запросы кабинета идут под
          // anon, которому после включения RLS не доступно ничего.
          const { session_token, token: jwt, ...profile } = account
          setAppToken(jwt || null)
          const sessionData = { id: account.id, role: "student", profile, token: session_token }
          localStorage.setItem("student_session", JSON.stringify(sessionData))
          onLogin(sessionData)

        } else {
          if (!form.name) throw new Error("Введи имя")
          // «35235» именем не является: эту строку репетитор увидит в списке
          // учеников, в отчёте родителю и в квитанции.
          if (!isValidPersonName(form.name)) throw new Error("Впиши имя буквами — так тебя увидит репетитор")
          if (form.password.length < 6) throw new Error("Пароль минимум 6 символов")
          requireConsent()

          // Регистрация без кода репетитора — только аккаунт. Репетиторов ученик
          // привязывает по коду в опроснике/настройках (можно несколько).
          //
          // Номер подтверждается кодом из SMS: до этого зарегистрироваться можно
          // было на ЧУЖОЙ телефон. Если SMS у платформы не настроены, сервер
          // заводит аккаунт сразу и возвращает его — тогда шага с кодом нет.
          const data = await callPhoneVerify()
          if (data.sms) {
            setCodeStep({ channel: "sms", to: formatPhone(phone), title: "Подтверди номер" })
            setCodeError("")
          } else {
            await finishStudentRegister(data.account, phone)  // SMS не настроены
          }
        }

      } else {
        if (mode === "login") {
          // Вход идёт через свой обработчик, а не напрямую в GoTrue: только там
          // считаются попытки по конкретному аккаунту (пять — и вход закрыт на
          // 15 минут, см. api/auth-login.js). Ответ — та же сессия GoTrue,
          // поэтому дальше всё как раньше.
          // Проверяем адрес ДО запроса: неверно набранная почта иначе съела бы
          // одну из пяти попыток входа, которые считает сервер.
          if (!isValidEmail(form.email)) throw new Error("Проверьте адрес почты: он записан с ошибкой")
          const data = await tutorSignIn(form.email, form.password)
          // Сессия ученика или родителя из этого же браузера теперь не нужна, а
          // её токен подменял бы авторизацию репетитора (см. supabase.js).
          clearAppSession()
          const tutor = await loadTutorProfile(data.user.id)
          onLogin({ ...data.user, role: "tutor", profile: tutor })

        } else {
          if (!form.name) throw new Error("Введи имя")
          if (!isValidPersonName(form.name)) throw new Error("Впишите имя буквами — его видят ученики")
          if (!form.email) throw new Error("Введи email")
          if (!isValidEmail(form.email)) throw new Error("Проверьте адрес почты: он записан с ошибкой")
          if (form.password.length < 6) throw new Error("Пароль минимум 6 символов")
          requireConsent()

          // Второй фактор при регистрации: аккаунт создаётся ТОЛЬКО после кода
          // с почты, и создаёт его сервер (api/auth-signup.js). Проверка кода на
          // клиенте была бы не проверкой — запрос к GoTrue можно послать мимо.
          await requestEmailCode(form.email)
          setCodeStep({ channel: "email", to: form.email, title: "Подтвердите почту" })
          setCodeError("")
        }
      }
    } catch (err) {
      // Настоящий предел попыток теперь держит сервер: у ученика и родителя его
      // считает база (supabase/login_guard.sql), у репетитора — обработчик
      // /api/auth-login. Здесь только подсказка «сколько осталось» и обратный
      // отсчёт по времени, которое назвал сервер: счётчик в браузере всё равно
      // обнулялся перезагрузкой страницы и защитой не был.
      const wait = Number(err.retryAfter) || 0
      if (wait > 0) {
        setCooldownLeft(wait)
        setFailedAttempts(0)
        setError(err.message)
      } else if (mode === "login" && /парол|логин|неверн|не найден/i.test(err.message || "")) {
        const next = failedAttempts + 1
        setFailedAttempts(next)
        const left = LOGIN_MAX_TRIES - next
        setError(left > 0 && left <= 2
          ? `${err.message}. Осталось попыток: ${left}`
          : err.message)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // Что показывать под полями. phoneStarted — набор начат: на пустом поле
  // подсказка не нужна, про пустоту скажет сама отправка.
  const phoneOk = isValidRuPhone(form.phone)
  const phoneStarted = form.phone.replace(/\D/g, "").length > 1
  const emailOk = isValidEmail(form.email)
  const nameOk = isValidPersonName(form.name)

  // Подложка плавающих кнопок: появляется только при прокрутке. Цвет текста
  // тоже подтягиваем — на цветной шапке карточки, которая уезжает под кнопки,
  // gray-500 читается плохо (в тёмной теме это #98989f).
  const floatBtn = scrolled
    ? "text-gray-700 bg-white/80 hover:bg-white dark:bg-white/15 dark:hover:bg-white/25 backdrop-blur-xl shadow-sm"
    : "text-gray-500 hover:text-gray-700 hover:bg-blue-500/10"

  const roleConfig = {
    tutor:   { icon: "user-teacher", label: "Репетитор", desc: "Управляй учениками",   grad: "from-blue-500 to-blue-600",   soft: "bg-blue-50 dark:bg-blue-900/30",   text: "text-blue-600 dark:text-blue-400",   border: "border-blue-200 dark:border-blue-700",   glow: "shadow-blue-500/40" },
    student: { icon: "book",         label: "Ученик",     desc: "Готовься к экзамену",  grad: "from-emerald-500 to-teal-600", soft: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-700", glow: "shadow-emerald-500/40" },
    parent:  { icon: "users",        label: "Родитель",   desc: "Следи за успехами",    grad: "from-amber-500 to-orange-500", soft: "bg-amber-50 dark:bg-amber-900/30",   text: "text-amber-600 dark:text-amber-400",   border: "border-amber-200 dark:border-amber-700",   glow: "shadow-amber-500/40" },
  }

  return (
    // items-start, а НЕ items-center: формы разной высоты (вход 655px,
    // регистрация ученика 836px), и при центрировании карточка на каждое
    // переключение роли/режима перецентрировалась — шапка, вкладки ролей и
    // первое поле уезжали. Верх прибит к постоянному отступу, форма растёт
    // только вниз. dvh, а не vh: на мобильном Safari 100vh врёт на высоту
    // адресной строки.
    // py-16 на узком экране: карточка там во всю ширину, и при меньшем
    // отступе кнопки «На главную» и темы легли бы на её шапку.
    // Отступы сверху и снизу равны — иначе центр перекошен.
    // min-h (а не h) + items-center: когда форма выше экрана, документ растёт
    // и страница прокручивается, а не обрезает карточку сверху.
    <div className="relative min-h-dvh flex items-center justify-center px-4 py-16 sm:py-8">
      {/* fixed, а НЕ absolute: форма регистрации выше экрана, страницу
          приходится прокручивать, и на absolute кнопки уезжали вверх вместе с
          ней. Прежняя причина отказа от fixed (карточка проезжала под ними и
          кнопки читались поверх синей шапки) снята подложкой `floatBtn`: пока
          прокрутки нет — кнопки голые, как раньше; как только страница поехала
          — под ними проявляется матовое стекло, и наезд выглядит намеренным. */}
      {onBack && (
        <button
          onClick={onBack}
          className={`fixed top-4 left-4 flex items-center gap-1 p-2 pr-3 rounded-lg text-sm z-50 transition-all duration-200 active:scale-95 ${floatBtn}`}
        >
          <Icon name="chevron-left" size={16} />
          На главную
        </button>
      )}
      <button
        onClick={() => setDark(!dark)}
        className={`fixed top-4 right-4 p-2 rounded-lg text-sm z-50 transition-all duration-200 active:scale-95 ${floatBtn}`}
      >
        <MorphIcon from="moon" to="sun" size={16} active={dark} hover={false} rotate />
      </button>
      <div
        ref={cardRef}
        className="glass-modal w-full max-w-md overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none"
        style={cardHeight ? { height: cardHeight } : undefined}
      >
       <div ref={bodyRef}>

        {/* Шапка с логотипом — плавный переход градиента */}
        <div className="relative px-8 pt-6 pb-6 text-white text-center overflow-hidden">
          {Object.entries(roleConfig).map(([r, cfg]) => (
            <div
              key={r}
              className={`absolute inset-0 bg-gradient-to-br ${cfg.grad} transition-opacity duration-500`}
              style={{ opacity: role === r ? 1 : 0 }}
            />
          ))}
          <div className="absolute inset-0 opacity-20" style={{backgroundImage: "radial-gradient(circle at 20% 50%, white 0%, transparent 50%), radial-gradient(circle at 80% 20%, white 0%, transparent 40%)"}} />
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/25 backdrop-blur-sm mx-auto mb-2 shadow-lg">
              <img src="/logo.webp" alt="Логотип" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="text-lg font-bold tracking-tight">Precettore</div>
              <BetaBadge tone="onColor" />
            </div>
            <div className="text-[13px] text-white/75 mt-0.5">
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
                  // Галочки сбрасываем при смене роли: текст согласия у ролей
                  // разный (родитель отвечает ещё и за данные ребёнка), и
                  // отметка, поставленная в форме репетитора, его согласием не
                  // является. Согласие даётся активным действием под тем
                  // текстом, который человек видит.
                  onClick={() => {
                    setRole(r)
                    localStorage.setItem("preferred_role", r)
                    setError("")
                    setConsent({ terms: false, pd: false, guardian: false })
                  }}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 transition-all duration-200 ${
                    active
                      ? `bg-gradient-to-br ${cfg.grad} text-white border-transparent shadow-lg ${cfg.glow}`
                      : `bg-white ${cfg.text} ${cfg.border}`
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
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                placeholder="example@mail.com"
                className="input-glass"
              />
              <FieldHint show={touched.email && !!form.email.trim() && !emailOk}>
                Похоже, в адресе опечатка
              </FieldHint>
            </div>
          )}

          {mode === "reset" && !resetSent && role === "student" && (
            <>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Номер телефона</label>
                <input
                  name="phone"
                  type="tel"
                  value={formatPhone(form.phone)}
                  onChange={handlePhoneChange}
                  onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                  placeholder="+7 (900) 123-45-67"
                  className="input-glass"
                />
                <FieldHint show={touched.phone && phoneStarted && !phoneOk}>
                  Нужны все десять цифр после +7
                </FieldHint>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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

          {/* role !== "parent": у родителя ниже своё поле имени
              («Имя и фамилия — необязательно»), иначе два поля подряд */}
          {mode === "register" && role !== "parent" && (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Имя</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                placeholder="Иван Иванов"
                className="input-glass"
              />
              <FieldHint show={touched.name && !!form.name.trim() && !nameOk}>
                Имя пишется буквами
              </FieldHint>
            </div>
          )}

          {role === "parent" && (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">
                Имя и фамилия <span className="text-gray-400 font-normal">— необязательно</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Иван Иванов"
                className="input-glass"
                autoComplete="name"
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
                className="input-glass tracking-widest text-left text-lg font-mono"
                maxLength={6}
                autoComplete="off"
              />
            </div>
          )}

          {mode !== "reset" && role !== "parent" && (role === "student" ? (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Номер телефона</label>
              <input
                name="phone"
                type="tel"
                value={formatPhone(form.phone)}
                onChange={handlePhoneChange}
                onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                placeholder="+7 (900) 123-45-67"
                className="input-glass"
              />
              <FieldHint show={touched.phone && phoneStarted && !phoneOk}>
                Нужны все десять цифр после +7
              </FieldHint>
            </div>
          ) : (
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                placeholder="example@mail.com"
                className="input-glass"
              />
              <FieldHint show={touched.email && !!form.email.trim() && !emailOk}>
                Похоже, в адресе опечатка
              </FieldHint>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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

          {mode === "register" && role !== "parent" && (
            <div className="flex flex-col gap-1.5 mt-1">
              <ConsentRow
                checked={consent.terms}
                onChange={(v) => setConsent((p) => ({ ...p, terms: v }))}
                accent={roleConfig[role].grad}
              >
                {/* Оферта адресована только репетитору: он единственный заказчик
                    платных услуг (п. 1.4 Правил, п. 4.6 оферты). Ученик принимает
                    пользовательское соглашение — предлагать ему принять оферту
                    значит расходиться с опубликованными документами. */}
                Принимаю{" "}
                {role === "tutor" && (
                  <>
                    <ConsentLink href="/offer">договор-оферту</ConsentLink> и{" "}
                  </>
                )}
                <ConsentLink href="/rules">Пользовательское соглашение</ConsentLink>,
                ознакомлен(а) с{" "}
                <ConsentLink href="/privacy">Политикой конфиденциальности</ConsentLink> и{" "}
                <ConsentLink href="/cookie">Политикой в отношении файлов cookie</ConsentLink>
              </ConsentRow>

              <ConsentRow
                checked={consent.pd}
                onChange={(v) => setConsent((p) => ({ ...p, pd: v }))}
                accent={roleConfig[role].grad}
              >
                Даю <ConsentLink href="/consent">согласие на обработку персональных данных</ConsentLink>
              </ConsentRow>

              {role === "student" && (
                <ConsentRow
                  checked={consent.guardian}
                  onChange={(v) => setConsent((p) => ({ ...p, guardian: v }))}
                  accent={roleConfig[role].grad}
                >
                  Мне 18 лет — либо мой родитель (законный представитель) согласен
                  на обработку моих данных
                </ConsentRow>
              )}
            </div>
          )}

          {role === "parent" && (
            <div className="mt-1">
              <ConsentRow
                checked={consent.pd}
                onChange={(v) => setConsent((p) => ({ ...p, pd: v }))}
                accent={roleConfig.parent.grad}
              >
                Я законный представитель ученика: принимаю{" "}
                <ConsentLink href="/rules">Пользовательское соглашение</ConsentLink>, ознакомлен(а) с{" "}
                <ConsentLink href="/privacy">Политикой конфиденциальности</ConsentLink> и{" "}
                <ConsentLink href="/cookie">Политикой в отношении файлов cookie</ConsentLink>, даю{" "}
                <ConsentLink href="/consent">согласие на обработку персональных данных</ConsentLink> — своих и ребёнка
              </ConsentRow>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {!(mode === "reset" && resetSent) && !consentReady && (
            <p className="text-[12px] text-center text-gray-400 dark:text-gray-500 -mb-0.5">
              {role === "parent"
                ? "Отметьте согласие выше, чтобы открыть кабинет"
                : "Отметьте согласия выше, чтобы продолжить"}
            </p>
          )}

          {!(mode === "reset" && resetSent) && (
            <button
              onClick={mode === "reset" ? handleResetPassword : handleSubmit}
              disabled={loading || cooldownLeft > 0 || !consentReady}
              className={`w-full h-[52px] text-[15px] text-white font-semibold rounded-full disabled:opacity-50 mt-1 transition-all bg-gradient-to-r ${roleConfig[role].grad}`}
            >
              {loading
                ? "Загрузка..."
                : cooldownLeft > 0
                ? `Подождите ${formatWait(cooldownLeft)}`
                : mode === "reset"
                ? "Сбросить пароль"
                : mode === "login"
                ? "Войти"
                : "Зарегистрироваться"}
            </button>
          )}
        </div>

        {mode === "login" && (
          <div className="text-center mt-3">
            {role === "parent" ? (
              <span className="text-xs text-gray-400 dark:text-gray-500">Код выдаётся репетитором</span>
            ) : (
              <button
                onClick={() => { setMode("reset"); setError(""); setResetSent(false); setNewPassword("") }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:opacity-70 transition-opacity"
              >
                Забыли пароль?
              </button>
            )}
          </div>
        )}

        {role !== "parent" ? (
          <div className="text-center mt-4">
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login")
                setError("")
                setResetSent(false)
                setConsent({ terms: false, pd: false, guardian: false })
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
        ) : (
          <div className="text-center mt-4" aria-hidden="true">
            <span className="text-sm invisible select-none">Нет аккаунта?</span>
          </div>
        )}
        </div> {/* p-6 */}
       </div> {/* измеряемое содержимое */}
      </div>

      {/* Второй шаг регистрации репетитора. Пока код не введён, аккаунта не
          существует: закрыли окно — регистрация просто не состоялась. */}
      {codeStep && (
        <CodeModal
          channel={codeStep.channel}
          to={codeStep.to}
          title={codeStep.title}
          busy={codeBusy}
          error={codeError}
          onSubmit={(code) => (codeStep.channel === "sms" ? confirmPhoneCode(code) : confirmEmailCode(code))}
          onResend={() => (codeStep.channel === "sms" ? resendPhoneCode() : resendEmailCode())}
          onClose={() => { setCodeStep(null); setCodeError("") }}
        />
      )}
    </div>
  )
}

export default Auth
