import { useState, useEffect, useMemo } from "react"
import StudentFormModal from "../components/StudentFormModal"
import ConfirmModal from "../components/ConfirmModal"
import Reveal from "../components/Reveal"
import Icon from "../components/Icon"
import MorphIcon from "../components/MorphIcon"
import FormulaBackdrop from "../components/FormulaBackdrop"
import StudentProfile from "./StudentProfile"
import { supabase } from "../supabase"
import { isLessonConducted, getInitials, plural, formatPhone } from "../utils"
import { usePlan } from "../subscription"
import { PlanHint } from "../components/PlanLock"

// Телефон — единственная связка карточки с аккаунтом ученика (по нему сшивает и
// RLS, current_student_rows), но записан он местами по-разному. Сравниваем по цифрам.
function phoneKey(raw) {
  return String(raw || "").replace(/\D/g, "")
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
}

// Столбец отвечает на один вопрос: сколько ученик должен за проведённые занятия.
// Поэтому нулевая цена больше не выдаётся за оплату (раньше ученик без указанной
// стоимости получал зелёное «Оплачено»), а вместо неё видно, чего не хватает.
function getPaymentStatus(student) {
  const conducted = (student.lessons || []).filter((l) => isLessonConducted(l))
  const price = student.lessonPrice || 0
  const paid = (student.payments || []).reduce((s, p) => s + (p.amount || 0), 0)
  if (conducted.length === 0) return { kind: "empty", label: "Занятий не было", debt: 0 }
  if (!price) return { kind: "noprice", label: "Цена не указана", debt: 0 }
  const debt = conducted.length * price - paid
  if (debt > 0) return { kind: "debt", label: `${debt.toLocaleString("ru-RU")} ₽`, debt }
  return { kind: "clear", label: "Долга нет", debt: 0 }
}

// Одна и та же метка в таблице и в мобильной карточке. В карточке заголовка
// столбца нет, поэтому сумма подписана словом «Долг».
function DebtBadge({ status, standalone = false }) {
  if (status.kind === "debt") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/12 ring-1 ring-inset ring-amber-500/20 px-2.5 py-1 rounded-lg">
      <Icon name="warning" size={11} />{standalone ? "Долг " : ""}{status.label}
    </span>
  )
  if (status.kind === "clear") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-500/12 ring-1 ring-inset ring-green-500/20 px-2.5 py-1 rounded-lg">
      <Icon name="check" size={11} />Долга нет
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-black/[0.04] dark:bg-white/[0.08] ring-1 ring-inset ring-black/[0.05] dark:ring-white/[0.1] px-2.5 py-1 rounded-lg">
      {status.label}
    </span>
  )
}

function getNextLesson(student) {
  const now = new Date()
  const todayStr = formatDate(now)
  const cur = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`
  return (student.lessons || [])
    .filter((l) => l.date > todayStr || (l.date === todayStr && l.time >= cur))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0] || null
}

function getDaysUntilExam(student) {
  if (!student.examDate) return null
  const exam = new Date(student.examDate + "T00:00:00")
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((exam - today) / 86400000)
  return diff >= 0 ? diff : null
}

const GOAL_STYLE = {
  "ОГЭ":          { cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",       label: "ОГЭ",    full: "ОГЭ" },
  "ЕГЭ":          { cls: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300", label: "ЕГЭ",    full: "ЕГЭ" },
  "Успеваемость": { cls: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",    label: "Успев.", full: "Успеваемость" },
}

// Раскладка таблицы учеников. Цель и телефон — отдельными столбцами, иначе
// строка выглядит пустой справа. Столбцы убираются по мере сужения окна, и
// порядок шаблона обязан совпадать с порядком видимых ячеек в разметке
// (до lg столбца «Следующий урок» нет — он самый широкий и уходит первым).
const COLS =
  "grid-cols-[minmax(120px,1.5fr)_minmax(100px,0.9fr)_minmax(120px,1fr)_minmax(110px,1fr)_36px] " +
  "lg:grid-cols-[minmax(160px,1.6fr)_minmax(110px,0.9fr)_minmax(140px,1fr)_minmax(160px,1.2fr)_minmax(120px,1fr)_36px]"

// Пустой список: карточку ученика вручную не заводят, поэтому объясняем, откуда
// ученик берётся, и даём единственное действие — пригласить.
function EmptyStudents({ onInvite, inviting }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
        <Icon name="users" size={22} />
      </div>
      <div>
        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Пока нет учеников</div>
        <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
          Ученик регистрируется сам: переходит по вашей ссылке или вводит ваш код —
          и вам приходит заявка. Карточку вы заполните при её приёме.
        </p>
      </div>
      <button onClick={onInvite} disabled={inviting} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
        {inviting ? "Готовим…" : "Пригласить ученика"}
      </button>
    </div>
  )
}

function Students({ students, setStudents, tutorId, onOpenBoard }) {
  // Приглашение одной ссылкой: одноразовый токен на 7 дней (student_invites.sql).
  const [invite, setInvite] = useState(null)      // { link, text }
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [returning, setReturning] = useState(false)
  const [search, setSearch] = useState("")
  const [pending, setPending] = useState([])
  const [linkedAccounts, setLinkedAccounts] = useState([])
  const [acceptingRequest, setAcceptingRequest] = useState(null)
  // Подтверждения — своей модалкой вместо системного window.confirm: он выглядит
  // как ошибка браузера и не говорит, о ком речь.
  const [confirm, setConfirm] = useState(null)   // { kind, ... }
  const [notice, setNotice] = useState("")       // ошибка полосой вверху списка
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // Лимит учеников по тарифу. Уже заведённых не трогаем и не прячем — упирается
  // только добавление нового.
  const { plan, within, limit, openPlans } = usePlan()
  const studentsLimit = limit("students")
  const canAddStudent = within("students", students.length)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])

  useEffect(() => {
    if (!tutorId) return
    let cancelled = false
    supabase.from("pending_students").select("*").eq("tutor_id", tutorId).order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled) setPending(data || []) })
    // Ученики, привязавшие этого репетитора. Нужны, чтобы не потерять того, у кого
    // строки заявки нет: вставки в students и pending_students при регистрации
    // сделаны best-effort (auth_hardening.sql — при сбое только raise warning), да и
    // карточку могли удалить. Читать их RLS разрешает: политика accounts_tutor_read
    // пускает репетитора к аккаунтам с tutor_id = auth.uid().
    supabase.from("student_accounts").select("id, name, phone").eq("tutor_id", tutorId)
      .then(({ data }) => { if (!cancelled) setLinkedAccounts(data || []) })
    return () => { cancelled = true }
  }, [tutorId])

  // Заявка = либо строка pending_students, либо привязанный аккаунт, под который
  // карточки нет вовсе. Второе — страховка: без неё такой ученик не виден никому,
  // а завести его руками репетитор больше не может.
  const requests = useMemo(() => {
    const fromPending = pending.map((p) => ({
      key: `p:${p.id}`, pendingId: p.id, accountId: p.student_account_id || null,
      name: p.name, phone: p.phone, orphan: false,
    }))
    const claimed = new Set(pending.map((p) => phoneKey(p.phone)).filter(Boolean))
    const carded = new Set(students.map((s) => phoneKey(s.phone)).filter(Boolean))
    const fromAccounts = linkedAccounts
      .filter((a) => {
        const key = phoneKey(a.phone)
        return key && !claimed.has(key) && !carded.has(key)
      })
      .map((a) => ({ key: `a:${a.id}`, pendingId: null, accountId: a.id, name: a.name, phone: a.phone, orphan: true }))
    return [...fromPending, ...fromAccounts]
  }, [pending, linkedAccounts, students])

  async function handleReject(req) {
    setConfirm(null)
    // Одной RPC (student_link_cleanup.sql): снимает заявку И отвязывает аккаунт.
    // Раньше удалялась только строка заявки, а привязка оставалась — ученик
    // возвращался в список при следующем заходе. Карточку, если по ней уже вели
    // занятия, функция не трогает: удалять её должен человек.
    const { error } = await supabase.rpc("student_request_reject", {
      p_account: req.accountId || null,
      p_pending: req.pendingId || null,
    })
    if (error) { setNotice("Не удалось отклонить заявку: " + error.message); return }
    if (req.pendingId) setPending((prev) => prev.filter((p) => p.id !== req.pendingId))
    if (req.accountId) {
      setPending((prev) => prev.filter((p) => p.student_account_id !== req.accountId))
      setLinkedAccounts((prev) => prev.filter((a) => a.id !== req.accountId))
    }
  }

  async function handleAcceptComplete(newStudent, request) {
    // Карточка ученика уже заведена автоматически в момент привязки (student_register
    // / привязка из кабинета), поэтому при приёме заявки её ДОЗАПОЛНЯЕМ, а не заводим
    // вторую. Вторая была бы не просто дублем: ученика с карточкой RLS сшивает по
    // телефону (current_student_rows), так что обе строки принадлежали бы ему, а ДЗ,
    // занятия и долги разъехались бы по двум карточкам.
    // Сверяем по цифрам, а не по строке: если карточка старая и номер в ней записан
    // в другом формате, слияние заодно перепишет его на номер из аккаунта — той самой
    // строкой, по которой ученика пускает RLS.
    const existing = students.find((s) => phoneKey(s.phone) && phoneKey(s.phone) === phoneKey(newStudent.phone))
    // setStudents is handleSetStudents from App.jsx — it diffs the new array against
    // the old one and upserts any added/changed student itself, so no separate insert here.
    if (existing) {
      const merged = {
        ...existing,
        ...newStudent,
        id: existing.id,
        // Уже накопленное в карточке важнее пустых значений из формы.
        lessons: [...(existing.lessons || []), ...(newStudent.lessons || [])]
          .filter((l, i, arr) => arr.findIndex((x) => x.date === l.date && x.time === l.time) === i)
          .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
        payments: existing.payments?.length ? existing.payments : newStudent.payments,
        results: existing.results?.length ? existing.results : newStudent.results,
        parent_code: existing.parent_code || newStudent.parent_code,
      }
      merged.lessonDates = merged.lessons.map((l) => l.date)
      setStudents((prev) => prev.map((s) => (s.id === existing.id ? merged : s)))
    } else {
      setStudents((prev) => [...prev, newStudent])
    }
    if (request?.pendingId) {
      await supabase.from("pending_students").delete().eq("id", request.pendingId)
      setPending((prev) => prev.filter((p) => p.id !== request.pendingId))
    }
    setAcceptingRequest(null)
  }

  async function handleDelete(studentId) {
    setConfirm(null)
    const { error } = await supabase.from("students").delete().eq("id", studentId)
    if (error) { setNotice("Не удалось удалить ученика: " + error.message); return }
    setStudents((prev) => prev.filter((s) => s.id !== studentId))
  }

  if (selectedStudent) {
    const student = students.find((s) => s.id === selectedStudent)
    return (
      <StudentProfile
        student={student}
        onBack={() => { setSelectedStudent(null); setReturning(true) }}
        onUpdate={(id, data) => setStudents((prev) => prev.map((s) => s.id === id ? { ...s, ...data } : s))}
        onOpenBoard={onOpenBoard}
      />
    )
  }

  // Attention lists
  const debtors = students.filter((s) => getPaymentStatus(s).debt > 0)
  const examSoon = students
    .filter((s) => { const d = getDaysUntilExam(s); return d !== null && d <= 30 })
    .sort((a, b) => getDaysUntilExam(a) - getDaysUntilExam(b))

  const query = search.trim().toLowerCase()
  const filtered = query
    ? students.filter((s) => s.name?.toLowerCase().includes(query) || s.phone?.toLowerCase().includes(query))
    : students

  async function createInvite() {
    setInviting(true)
    setCopied(false)
    const { data, error } = await supabase
      .from("student_invites")
      .insert({ tutor_id: tutorId })
      .select("token")
      .single()
    setInviting(false)
    if (error || !data) {
      setNotice(
        /student_invites/.test(error?.message || "")
          ? "Приглашения по ссылке пока недоступны: выполните supabase/student_invites.sql в SQL Editor."
          : "Не удалось создать приглашение: " + (error?.message || "")
      )
      return
    }
    setNotice("")
    const link = `${window.location.origin}/?invite=${data.token}`
    setInvite({
      link,
      text: `Привет! Занимаемся через Precettore — регистрация по ссылке, займёт пару минут: ${link}`,
    })
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Safari без https/разрешения — покажем текст, чтобы можно было выделить руками
      window.prompt("Скопируйте текст приглашения:", invite.text)
    }
  }

  return (
    <div
      className={"p-4 md:p-6" + (returning ? " view-back" : "")}
      onAnimationEnd={(e) => { if (e.animationName === "view-back") setReturning(false) }}
    >
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-medium">Ученики</h1>
          <p className="text-xs text-gray-400 mt-0.5">{students.length} {plural(students.length, "ученик", "ученика", "учеников")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Единственный способ завести ученика — он сам привязывается к репетитору
              (по ссылке или коду), после чего приходит заявка. Карточку заполняем
              при её приёме, вручную ученика не создаём. */}
          <button
            onClick={() => (canAddStudent ? createInvite() : openPlans())}
            disabled={inviting}
            className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
            title={canAddStudent ? undefined : `На тарифе «${plan.name}» доступно ${studentsLimit} учеников`}
          >
            {inviting ? "Готовим…" : "Пригласить ученика"}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={!!confirm}
        danger
        title={confirm?.kind === "delete" ? "Удалить ученика?" : "Отклонить заявку?"}
        message={confirm?.kind === "delete"
          ? `Карточка ${confirm?.name || "ученика"} и всё, что в ней — занятия, оплаты, оценки — удалятся без возврата.`
          : `${confirm?.name || "Ученик"} будет отвязан от вас и пропадёт из списка заявок.`}
        confirmLabel={confirm?.kind === "delete" ? "Удалить" : "Отклонить"}
        cancelLabel="Отмена"
        onConfirm={() => (confirm?.kind === "delete" ? handleDelete(confirm.id) : handleReject(confirm.req))}
        onCancel={() => setConfirm(null)}
      />

      <Reveal value={notice}>{(text) => (
        <div className="glass-tint-amber px-4 py-3 mb-4 flex items-start gap-2">
          <Icon name="warning" size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-amber-700 flex-1">{text}</span>
          <button onClick={() => setNotice("")} className="text-amber-600/70 hover:text-amber-700"><Icon name="x" size={14} /></button>
        </div>
      )}</Reveal>

      {!canAddStudent && (
        <div className="mb-4">
          <PlanHint feature="students">
            На тарифе «{plan.name}» можно вести {studentsLimit} {plural(studentsLimit, "ученика", "ученика", "учеников")}.
            Уже добавленные остаются на месте — чтобы принять нового, поднимите тариф.
          </PlanHint>
        </div>
      )}

      {/* Пока блок уезжает, invite уже null — Reveal передаёт сюда последнее
          непустое значение, поэтому ссылка не мигает пустотой. */}
      <Reveal value={invite}>{(inv) => (
        <div className="glass rounded-2xl p-4 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">Ссылка-приглашение готова</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Одноразовая, действует 7 дней. Ученик по ней зарегистрируется и сразу привяжется к вам.
              </div>
            </div>
            <button onClick={() => setInvite(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 break-all bg-black/[0.03] dark:bg-white/[0.06] rounded-xl px-3 py-2">
            {inv.link}
          </div>
          <div className="mt-3">
            <button onClick={copyInvite} className="press-fill px-3 py-2 text-sm rounded-xl bg-blue-600 text-white inline-flex items-center gap-1.5">
              <MorphIcon from="clipboard" size={14} active={copied} />
              {copied ? "Скопировано" : "Скопировать текст"}
            </button>
          </div>
        </div>
      )}</Reveal>

      {/* Pending requests */}
      {requests.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-medium mb-2 text-blue-600">Заявки от учеников</h2>
          <div className="flex flex-col gap-2">
            {requests.map((req) => (
              <div key={req.key} className="glass-tint-blue px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{req.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{formatPhone(req.phone)}</div>
                  {req.orphan && (
                    <div className="text-xs text-gray-400 mt-0.5">Привязал вас в своём кабинете — карточки ещё нет</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => (canAddStudent ? setAcceptingRequest(req) : openPlans())} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium">Принять</button>
                  <button onClick={() => setConfirm({ kind: "reject", req, name: req.name })} className="text-sm text-gray-400 hover:text-red-600 px-2 py-1.5">Отклонить</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attention strips */}
      {(debtors.length > 0 || examSoon.length > 0) && (
        <div className="flex flex-col gap-2 mb-4">
          {debtors.length > 0 && (
            <div className="glass-tint-amber px-4 py-3 flex items-center gap-3 overflow-x-auto">
              <Icon name="warning" size={15} className="text-amber-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-700 flex-shrink-0 uppercase tracking-wide">Долг</span>
              <div className="flex gap-2">
                {debtors.map((s) => (
                  <button key={s.id} onClick={() => setSelectedStudent(s.id)}
                    className="no-press flex items-center gap-1.5 bg-white/60 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/20 transition-colors rounded-lg px-2.5 py-1 text-xs font-medium text-gray-800 flex-shrink-0">
                    <span>{s.name.split(" ")[0]}</span>
                    <span className="text-amber-600 font-semibold">−{getPaymentStatus(s).label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {examSoon.length > 0 && (
            <div className="glass-tint-blue px-4 py-3 flex items-center gap-3 overflow-x-auto">
              <Icon name="target" size={15} className="text-blue-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-blue-700 flex-shrink-0 uppercase tracking-wide">Экзамен</span>
              <div className="flex gap-2">
                {examSoon.map((s) => {
                  const days = getDaysUntilExam(s)
                  return (
                    <button key={s.id} onClick={() => setSelectedStudent(s.id)}
                      className="no-press flex items-center gap-1.5 bg-white/60 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/20 transition-colors rounded-lg px-2.5 py-1 text-xs font-medium text-gray-800 flex-shrink-0">
                      <span>{s.name.split(" ")[0]}</span>
                      <span className={days <= 7 ? "text-red-600 font-semibold" : "text-blue-600"}>
                        {days === 0 ? "сегодня" : `через ${days} дн.`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени или телефону..."
          className="w-full pl-4 pr-9 py-2 text-sm rounded-xl bg-white/40 border border-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/40 placeholder-gray-400"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {/* Mobile cards */}
      {isMobile ? (
        <div className="flex flex-col gap-2 stagger">
          {filtered.map((student) => {
            const status = getPaymentStatus(student)
            const next = getNextLesson(student)
            const examDays = getDaysUntilExam(student)
            const goal = GOAL_STYLE[student.goal]
            return (
              <div key={student.id} onClick={() => setSelectedStudent(student.id)} className="glass press-tap px-4 py-3 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-300 flex-shrink-0 overflow-hidden">
                    {student.avatar ? <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" /> :
                      getInitials(student.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{student.name}</span>
                      {goal && <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${goal.cls}`}>{goal.label}</span>}
                    </div>
                    <div className="text-xs text-gray-400">{formatPhone(student.phone)}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirm({ kind: "delete", id: student.id, name: student.name }) }}
                    aria-label={`Удалить ученика ${student.name}`}
                    title="Удалить ученика"
                    className="text-gray-300 hover:text-red-500 px-1"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {next ? (
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-white/50 px-2 py-1 rounded-lg">
                      <Icon name="calendar" size={11} className="text-blue-400" />
                      {new Date(next.date + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })} · {next.time}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300 bg-white/30 px-2 py-1 rounded-lg">Нет урока</span>
                  )}
                  <DebtBadge status={status} standalone />
                  {examDays !== null && (
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ml-auto ${
                      examDays <= 7 ? "bg-red-50 text-red-700" : examDays <= 30 ? "bg-amber-50 text-amber-700" : "text-gray-500 ring-1 ring-gray-200/70 dark:ring-white/15"
                    }`}>
                      <Icon name="target" size={11} />{examDays === 0 ? "Сегодня!" : `${examDays} дн.`}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="relative overflow-hidden text-center py-10 px-4">
              <FormulaBackdrop variant="panel" />
              <div className="relative z-10">
                {query ? (
                  <span className="text-sm text-gray-400">Ничего не найдено</span>
                ) : (
                  <EmptyStudents onInvite={() => (canAddStudent ? createInvite() : openPlans())} inviting={inviting} />
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Desktop table */
        <div className="glass overflow-hidden">
          <div className={"grid px-4 py-2.5 glass-table-header text-xs text-gray-500 font-medium " + COLS}>
            <span>Ученик</span>
            <span>Цель</span>
            <span>Телефон</span>
            <span className="hidden lg:flex items-center gap-1"><Icon name="calendar" size={11} />Следующий урок</span>
            <span className="flex items-center gap-1"><Icon name="dollar" size={11} />Долг за занятия</span>
            <span />
          </div>

          {filtered.map((student) => {
            const status = getPaymentStatus(student)
            const next = getNextLesson(student)
            const goal = GOAL_STYLE[student.goal]

            return (
              <div key={student.id} onClick={() => setSelectedStudent(student.id)}
                className={"group grid border-t border-white/40 px-4 py-3 items-center cursor-pointer hover:bg-white/30 active:bg-white/50 transition-colors " + COLS}>

                {/* Student */}
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-300 flex-shrink-0 overflow-hidden">
                    {student.avatar
                      ? <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                      : getInitials(student.name)}
                  </div>
                  <span className="font-medium text-sm truncate">{student.name}</span>
                </div>

                {/* Goal */}
                <div>
                  {goal ? (
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${goal.cls}`}>{goal.full}</span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </div>

                {/* Phone */}
                <div className="text-xs text-gray-500 truncate">
                  {student.phone ? formatPhone(student.phone) : <span className="text-gray-300">—</span>}
                </div>

                {/* Next lesson */}
                <div className="hidden lg:block text-xs text-gray-600">
                  {next ? (
                    <span className="flex items-center gap-1.5">
                      <Icon name="calendar" size={12} className="text-blue-400 flex-shrink-0" />
                      {new Date(next.date + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })} · {next.time}
                    </span>
                  ) : (
                    <span className="text-gray-300">Не запланировано</span>
                  )}
                </div>

                {/* Payment */}
                <div>
                  <DebtBadge status={status} />
                </div>

                {/* Delete */}
                <div className="flex justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirm({ kind: "delete", id: student.id, name: student.name }) }}
                    aria-label={`Удалить ученика ${student.name}`}
                    title="Удалить ученика"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 active:scale-90">
                    <Icon name="x" size={14} />
                  </button>
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="relative overflow-hidden px-4 py-10 text-center border-t border-white/40">
              <FormulaBackdrop variant="panel" />
              <div className="relative z-10">
                {query ? (
                  <span className="text-sm text-gray-400">Ничего не найдено</span>
                ) : (
                  <EmptyStudents onInvite={() => (canAddStudent ? createInvite() : openPlans())} inviting={inviting} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {acceptingRequest && (
        <StudentFormModal
          onClose={() => setAcceptingRequest(null)}
          onSubmit={(s) => handleAcceptComplete(s, acceptingRequest)}
          initialName={acceptingRequest.name}
          initialPhone={acceptingRequest.phone}
        />
      )}
    </div>
  )
}

export default Students
