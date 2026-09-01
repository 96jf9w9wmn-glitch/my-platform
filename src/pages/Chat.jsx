import { useState, useEffect, useLayoutEffect, useRef, Fragment } from "react"
import { supabase } from "../supabase"
import { signStorageUrl } from "../storageUrl"
import { notifyTutor } from "../telegramNotify"
import Reveal from "../components/Reveal"
import Icon from "../components/Icon"
import ConfirmModal from "../components/ConfirmModal"

// Один ли это календарный день у двух сообщений
function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate()
}

// Подпись-разделитель дня: «Сегодня» / «Вчера» / «4 июля» / «4 июля 2024 г.»
function formatDayLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diffDays === 0) return "Сегодня"
  if (diffDays === 1) return "Вчера"
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString("ru-RU", sameYear
    ? { day: "numeric", month: "long" }
    : { day: "numeric", month: "long", year: "numeric" })
}

// Роль по префиксу id контакта: p → родитель, s → ученик, t → репетитор
function roleLabel(id) {
  const prefix = (id || "").split(":")[0]
  return prefix === "p" ? "Родитель" : prefix === "s" ? "Ученик" : prefix === "t" ? "Репетитор" : null
}

export default function Chat({ myId, myName, initialContacts = [], canAddByCode = false, onUnreadChange }) {
  const initialContactIds = initialContacts.map(c => c.id).join(",")

  // Удаление у ВСЕХ, а не «только у себя»: два разных представления одной
  // переписки — это готовый спор «я такого не писал».
  //
  // Очистить переписку может любая сторона: в кабинете ученика и родителя
  // такой кнопки не было вовсе. Отдельное сообщение в интерфейсе удаляет автор,
  // а репетитор — любое. Это удобство, а не запрет: политика в базе
  // (supabase/chat_delete.sql) пускает обоих участников на любое сообщение
  // своего разговора, потому что для неё удаление одной строки и очистка всей
  // переписки неотличимы. Роль нужна ещё и для текста подтверждения — сказать,
  // у кого именно пропадёт переписка.
  const isTutor = String(myId || "").startsWith("t:")

  const [contacts, setContacts] = useState(() => {
    const saved = JSON.parse(localStorage.getItem(`chat_contacts_${myId}`) || "[]")
    const merged = [...initialContacts]
    for (const s of saved) {
      if (!merged.find(c => c.id === s.id)) merged.push(s)
    }
    return merged
  })

  // Подмешиваем новые initialContacts при изменении пропа (корректировка состояния при рендере)
  const [prevInitialIds, setPrevInitialIds] = useState(initialContactIds)
  if (prevInitialIds !== initialContactIds) {
    setPrevInitialIds(initialContactIds)
    setContacts(prev => {
      const merged = [...initialContacts]
      for (const s of prev) {
        if (!merged.find(c => c.id === s.id)) merged.push(s)
      }
      return merged
    })
  }

  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMsgIds, setNewMsgIds] = useState(new Set())
  // Подтверждение удаления: { kind: "msg" | "all", id?, text? }
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [delError, setDelError] = useState("")
  const [input, setInput] = useState("")
  const [adding, setAdding] = useState(false)
  const [codeInput, setCodeInput] = useState("")
  const [codeError, setCodeError] = useState("")
  const [searching, setSearching] = useState(false)
  const [unreadByContact, setUnreadByContact] = useState({})
  const bottomRef = useRef(null)
  // Был ли пользователь у низа переписки (обновляется в onScroll ленты) —
  // по этому флагу лента прижимается к низу при появлении клавиатуры.
  const nearBottomRef = useRef(true)
  const channelRef = useRef(null)
  const incomingChannelRef = useRef(null)
  const initialLoadDone = useRef(false)
  const prevMsgCount = useRef(0)
  const activeIdRef = useRef(null)
  // Строки списка контактов — по ним меряется, куда переехать подложке выбора.
  const rowRefs = useRef({})
  const listRef = useRef(null)
  const [pick, setPick] = useState({ top: 0, height: 0, shown: false, moving: false })

  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  // Подложка выбранного контакта: считаем её место ДО отрисовки кадра, иначе
  // видно, как она прыгает из старого положения. `moving` включает переезд
  // только со второго раза — первое появление должно проступить на месте,
  // а не приехать сверху списка.
  useLayoutEffect(() => {
    const measure = () => {
      const el = activeId ? rowRefs.current[activeId] : null
      // Список скрыт (мобильный: открыт диалог) — размеры нулевые, мерить нечего.
      if (!el || !el.offsetHeight) {
        setPick(p => (p.shown ? { ...p, shown: false } : p))
        return
      }
      setPick(p => {
        const next = { top: el.offsetTop, height: el.offsetHeight, shown: true, moving: p.shown }
        return (p.top === next.top && p.height === next.height && p.shown && p.moving === next.moving)
          ? p : next
      })
    }
    measure()
    // Список то скрывается, то возвращается (узкое окно, поворот экрана), и
    // строки меняют высоту при переносе имени. Без пересчёта подложка осталась
    // бы спрятанной или под чужой строкой до следующего переключения.
    const box = listRef.current
    if (!box || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [activeId, contacts, adding])

  // Добавляет собеседников, которые нам написали, но которых нет в списке
  // (напр. родитель p:<ученик> — репетитору его никто не заводит в контакты).
  // Иначе непрочитанное «светится», а открыть переписку нельзя.
  function mergeContacts(prev, incoming) {
    const seen = new Set(prev.map(c => c.id))
    const additions = []
    for (const c of incoming) {
      if (!c.id || c.id === myId || seen.has(c.id)) continue
      seen.add(c.id)
      additions.push({ ...c, role: c.role || roleLabel(c.id) })
    }
    if (additions.length === 0) return prev
    const updated = [...prev, ...additions]
    const extras = updated.filter(c => !initialContacts.find(ic => ic.id === c.id))
    localStorage.setItem(`chat_contacts_${myId}`, JSON.stringify(extras))
    return updated
  }

  const activeContact = contacts.find(c => c.id === activeId)
  const convId = activeContact ? [myId, activeId].sort().join("|") : null

  // Сбрасываем переписку при смене диалога (корректировка состояния при рендере)
  const [prevConvId, setPrevConvId] = useState(convId)
  if (prevConvId !== convId) {
    setPrevConvId(convId)
    setMessages([])
    setNewMsgIds(new Set())
    if (convId) {
      // Оптимистично убираем бейдж непрочитанных у выбранного контакта
      setUnreadByContact(prev => { const n = { ...prev }; delete n[activeId]; return n })
    }
  }

  // ── Global incoming subscription for unread counts ──
  useEffect(() => {
    if (!myId) return
    if (incomingChannelRef.current) supabase.removeChannel(incomingChannelRef.current)

    const ch = supabase
      .channel(`chat_incoming_${myId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `recipient_id=eq.${myId}`,
      }, ({ new: msg }) => {
        // Гарантируем, что отправитель есть в списке контактов (иначе открыть нечем)
        setContacts(prev => mergeContacts(prev, [{
          id: msg.sender_id,
          name: msg.sender_name || roleLabel(msg.sender_id) || "Контакт",
          avatar: null,
        }]))
        if (msg.sender_id !== activeIdRef.current) {
          setUnreadByContact(prev => ({
            ...prev,
            [msg.sender_id]: (prev[msg.sender_id] || 0) + 1,
          }))
        }
      })
      .subscribe()

    incomingChannelRef.current = ch
    return () => { supabase.removeChannel(ch); incomingChannelRef.current = null }
  }, [myId])

  // Initial unread fetch
  useEffect(() => {
    if (!myId) return
    supabase
      .from("chat_messages")
      .select("sender_id, sender_name")
      .eq("recipient_id", myId)
      .eq("read", false)
      .then(({ data, error }) => {
        if (error) { console.error("Failed to load unread chat counts:", error); return }
        if (!data) return
        const counts = {}
        data.forEach(m => { counts[m.sender_id] = (counts[m.sender_id] || 0) + 1 })
        setUnreadByContact(counts)
        // Заводим контакты для непрочитанных отправителей, которых нет в списке
        setContacts(prev => mergeContacts(prev, data.map(m => ({
          id: m.sender_id,
          name: m.sender_name || roleLabel(m.sender_id) || "Контакт",
          avatar: null,
        }))))
        if (onUnreadChange && data.length > 0) onUnreadChange(data.length, true)
      })
  }, [myId])

  // Scroll: instant on conversation switch, smooth on new message
  useEffect(() => {
    const isNew = messages.length > prevMsgCount.current && initialLoadDone.current
    prevMsgCount.current = messages.length
    bottomRef.current?.scrollIntoView({ behavior: isNew ? "smooth" : "auto" })
  }, [messages.length])

  // Клавиатура открылась/закрылась (resize visualViewport) — лента ужимается,
  // и последние сообщения ушли бы под поле ввода. Если пользователь был у низа
  // переписки, держим его у низа; если читал историю выше — не дёргаем.
  // «Был ли у низа» меряем в onScroll, ДО ужатия: после resize расстояние до
  // низа уже включает высоту клавиатуры и сравнивать его с порогом поздно.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const keepBottom = () => {
      // НЕ block:"end": он ровняет по видимому низу ленты БЕЗ её padding-bottom,
      // и последнее сообщение остаётся на 68px под полем ввода. Дефолтный вызов
      // упирается в настоящий низ (scrollTop клампится с учётом паддинга).
      if (nearBottomRef.current) bottomRef.current?.scrollIntoView()
    }
    vv.addEventListener("resize", keepBottom)
    return () => vv.removeEventListener("resize", keepBottom)
  }, [])

  // Load messages when conversation changes
  useEffect(() => {
    if (!convId) return
    initialLoadDone.current = false
    prevMsgCount.current = 0
    supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setMessages(data || [])
        initialLoadDone.current = true
      })

    // Mark as read — use .select("id") so Supabase returns updated rows
    supabase
      .from("chat_messages")
      .update({ read: true })
      .eq("conversation_id", convId)
      .eq("recipient_id", myId)
      .eq("read", false)
      .select("id")
      .then(({ data, error }) => {
        // Ошибку не глотаем: пометка «прочитано» упирается в RLS (так висел
        // счётчик у репетитора до chat_tutor_mark_read.sql), а молчащий сбой
        // виден только тем, что бейдж не гаснет.
        if (error) { console.error("Failed to mark chat messages read:", error); return }
        if (data?.length && onUnreadChange) onUnreadChange(-data.length)
      })
  }, [convId])

  // Realtime for active conversation
  useEffect(() => {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    if (!convId) return

    const channel = supabase
      .channel(`chat_conv_${convId}_${Date.now()}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${convId}`,
      }, ({ new: msg }) => {
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
        setNewMsgIds(prev => new Set([...prev, msg.id]))
        if (msg.recipient_id === myId && !msg.read) {
          // Счётчик уменьшаем по факту записи, а не оптимистично: иначе при
          // отказе базы бейдж гаснет и возвращается после перезагрузки.
          supabase.from("chat_messages").update({ read: true }).eq("id", msg.id).select("id")
            .then(({ data, error }) => {
              if (error) { console.error("Failed to mark chat message read:", error); return }
              if (data?.length && onUnreadChange) onUnreadChange(-data.length)
            })
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${convId}`,
      }, ({ new: msg }) => {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: msg.read } : m))
      })
      // Удаление приходит без фильтра по разговору: в событии DELETE едет СТАРАЯ
      // строка, и фильтр по ней Realtime не применяет. Поэтому просто выкидываем
      // из ленты сообщение с таким id — чужого здесь и так нет.
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "chat_messages",
      }, ({ old: gone }) => {
        if (!gone?.id) return
        setMessages(prev => prev.filter(m => m.id !== gone.id))
      })
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel); channelRef.current = null }
  }, [convId])

  // Удаление у ВСЕХ: строка уходит из базы, вторая сторона узнаёт об этом
  // realtime-событием. Своё состояние правим сразу — ждать эха от сервера в
  // собственном окне незачем.
  // Долгое нажатие по пузырю — то же удаление, но для касания: наведения на
  // телефоне не бывает, а прятать функцию за жестом, который никто не угадает,
  // нельзя. Полсекунды — привычный порог мессенджеров.
  const pressTimer = useRef(null)
  function startPress(msg) {
    if (!canDelete(msg)) return
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => {
      setDelError("")
      setConfirmDel({ kind: "msg", id: msg.id, text: msg.text })
    }, 500)
  }
  const endPress = () => clearTimeout(pressTimer.current)

  // Своё сообщение удаляет любой, чужое — только репетитор. Это разделение
  // живёт ТОЛЬКО здесь: для базы удаление одной строки и очистка всей
  // переписки неотличимы, поэтому политика пускает обе стороны на любое
  // сообщение своего разговора (supabase/chat_delete.sql). То есть это
  // удобство, а не запрет.
  function canDelete(msg) {
    return isTutor || msg.sender_id === myId
  }

  async function deleteMessage(id) {
    setDeleting(true)
    const { error } = await supabase.from("chat_messages").delete().eq("id", id)
    setDeleting(false)
    if (error) { setDelError("Не удалось удалить сообщение"); return }
    setDelError("")
    setMessages(prev => prev.filter(m => m.id !== id))
    setConfirmDel(null)
  }

  async function clearConversation() {
    if (!convId) return
    setDeleting(true)
    const { error } = await supabase.from("chat_messages").delete().eq("conversation_id", convId)
    setDeleting(false)
    if (error) { setDelError("Не удалось очистить переписку"); return }
    setDelError("")
    setMessages([])
    setConfirmDel(null)
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || !convId) return
    setInput("")

    await supabase.from("chat_messages").insert({
      conversation_id: convId,
      sender_id: myId,
      sender_name: myName,
      recipient_id: activeId,
      text,
    })

    // Send notification to recipient (tutors and students have notification inboxes)
    const recipientRole = activeId.split(":")[0]
    const recipientUuid = activeId.split(":")[1]
    if (recipientRole === "t" || recipientRole === "s") {
      const preview = text.length > 60 ? text.slice(0, 60) + "…" : text
      supabase.from("notifications").insert({
        user_id: recipientUuid,
        title: `Сообщение от ${myName}`,
        body: preview,
      })
    }

    // Репетитору — ещё и в телеграм-бот, если он подключён. Текст сообщения туда
    // не уходит: бот пишет только «кто-то ответил в чате», сама переписка
    // остаётся на платформе. Передаём разговор, а не сообщение: id вставленной
    // строки клиенту неизвестен, последнее сообщение сервер найдёт сам.
    if (recipientRole === "t") notifyTutor("chat", convId)
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function findByCode() {
    const code = codeInput.trim().toUpperCase()
    if (code.length < 6) { setCodeError("Введи 6-значный код"); return }
    setSearching(true)
    setCodeError("")

    const { data: student } = await supabase
      .from("students")
      .select("id, name, phone, avatar")
      .eq("parent_code", code)
      .maybeSingle()

    if (!student) {
      setCodeError("Ученик с таким кодом не найден")
      setSearching(false)
      return
    }

    const myRole = myId.split(":")[0]
    // Аватары лежат в приватном бакете — подписываем ссылку на время.
    let contactId, contactName, contactAvatar = (await signStorageUrl(student.avatar, "homework")) || null

    if (myRole === "p") {
      contactId = `p:${student.id}`
      contactName = `Родитель ${student.name.split(" ")[0]}`
    } else {
      if (!student.phone) {
        setCodeError("У этого ученика нет телефона в профиле")
        setSearching(false)
        return
      }
      const { data: account } = await supabase
        .from("student_accounts")
        .select("id, name")
        .eq("phone", student.phone)
        .maybeSingle()
      if (!account) {
        setCodeError("Ученик ещё не зарегистрировался")
        setSearching(false)
        return
      }
      contactId = `s:${account.id}`
      contactName = account.name || student.name
    }

    if (contactId === myId) {
      setCodeError("Это твой собственный аккаунт")
      setSearching(false)
      return
    }

    const newContact = {
      id: contactId,
      name: contactName,
      role: myRole === "p" ? "Родитель" : "Ученик",
      avatar: contactAvatar,
    }

    setContacts(prev => {
      if (prev.find(c => c.id === contactId)) {
        setActiveId(contactId)
        return prev
      }
      const updated = [...prev, newContact]
      const extras = updated.filter(c => !initialContacts.find(ic => ic.id === c.id))
      localStorage.setItem(`chat_contacts_${myId}`, JSON.stringify(extras))
      return updated
    })
    setActiveId(contactId)
    setAdding(false)
    setCodeInput("")
    setSearching(false)
  }

  const totalUnread = Object.values(unreadByContact).reduce((a, b) => a + b, 0)

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden pb-20 md:pb-0 kb-collapse bg-white">

      {/* Контакты: полный экран на мобильном (когда нет активного диалога) */}
      <div className={`flex-col border-r border-gray-100 bg-white ${
        activeContact ? "hidden md:flex md:w-64 md:flex-shrink-0" : "flex w-full md:w-64 md:flex-shrink-0"
      }`}>
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Сообщения</span>
            {totalUnread > 0 && (
              <span className="min-w-[20px] h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-semibold px-1">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          {canAddByCode && (
            <button
              onClick={() => { setAdding(a => !a); setCodeError(""); setCodeInput("") }}
              className="w-7 h-7 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center text-lg leading-none transition-colors"
              title="Найти по коду"
            >
              {adding ? "×" : "+"}
            </button>
          )}
        </div>

        <Reveal value={adding}>{() => (
          <div className="m-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Код ученика (6 символов)</p>
            <input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="AB1234"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 dark:text-white text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 mb-2"
              maxLength={6}
              autoFocus
              onKeyDown={e => e.key === "Enter" && findByCode()}
            />
            {codeError && <p className="text-xs text-red-500 mb-2">{codeError}</p>}
            <div className="flex gap-1.5">
              <button
                onClick={findByCode}
                disabled={searching}
                className="flex-1 text-xs bg-blue-500 hover:bg-blue-600 text-white py-1.5 rounded-lg disabled:opacity-50 transition-colors font-medium"
              >
                {searching ? "Поиск..." : "Найти"}
              </button>
              <button
                onClick={() => { setAdding(false); setCodeError(""); setCodeInput("") }}
                className="text-xs text-gray-500 hover:text-gray-700 px-2"
              >Отмена</button>
            </div>
          </div>
        )}</Reveal>

        <div className="flex-1 overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="p-6 text-xs text-gray-400 dark:text-gray-500 text-center mt-4">
              {canAddByCode ? 'Нажми "+" чтобы найти собеседника' : "Нет контактов"}
            </div>
          ) : (
          <div ref={listRef} className="relative">
            {/* Выделение активного контакта — ОДНА подложка, которая переезжает
                между строками, а не заливка, зажигающаяся на новой строке:
                при переключении видно, куда именно ушёл выбор. */}
            <div
              aria-hidden
              className={`chat-pick pointer-events-none absolute left-0 right-0 top-0 bg-blue-500 dark:bg-blue-600 ${pick.moving ? "is-moving" : ""}`}
              style={{
                transform: `translateY(${pick.top}px)`,
                height: pick.height,
                opacity: pick.shown ? 1 : 0,
              }}
            />
            {contacts.map(c => {
            const unread = unreadByContact[c.id] || 0
            const isActive = activeId === c.id
            return (
              <button
                key={c.id}
                ref={el => { if (el) rowRefs.current[c.id] = el; else delete rowRefs.current[c.id] }}
                onClick={() => setActiveId(c.id)}
                className={`no-press press-tap relative w-full flex items-center gap-3 px-3 py-3 transition-colors duration-200 text-left ${
                  isActive ? "" : "hover:bg-blue-500/[0.06] dark:hover:bg-white/5"
                }`}
              >
                <div className={`relative w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold overflow-hidden ring-1 transition-colors duration-200 ${
                  isActive
                    ? "bg-white/25 text-white ring-white/0"
                    : "bg-blue-500/12 text-blue-600 ring-blue-500/15"
                }`}>
                  {/* Буква — всегда подложкой: подписанная ссылка на фото могла
                      протухнуть, и вместо битой картинки остаётся инициал. */}
                  {(c.name || "?").charAt(0).toUpperCase()}
                  {c.avatar && (
                    <img
                      src={c.avatar}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none" }}
                      onLoad={(e) => { e.currentTarget.style.display = "" }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate transition-colors duration-200 ${
                    isActive ? "text-white" : "text-gray-800 dark:text-white"
                  }`}>
                    {c.name}
                  </div>
                  {c.role && (
                    <div className={`text-xs truncate transition-colors duration-200 ${isActive ? "text-white/70" : "text-gray-400"}`}>
                      {c.role}
                    </div>
                  )}
                </div>
                {unread > 0 && !isActive && (
                  <span className="min-w-[20px] h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-semibold px-1 flex-shrink-0">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            )
            })}
          </div>
          )}
        </div>
      </div>

      {/* Правая панель: скрыта на мобильном если нет активного диалога */}
      <div className={`flex-1 min-h-0 flex-col min-w-0 bg-white ${
        activeContact ? "flex" : "hidden md:flex"
      }`}>
        {!activeContact ? (
          <div className="relative flex-1 flex flex-col items-center justify-center gap-4 overflow-hidden">
            {/* Базовый тон — РОВНЫЙ, без цветных пятен (решено: мягкий однотонный фон).
                Тот же .chat-bg, что и у ленты сообщений: холодный светлый тон
                вместо серой заливки, в тёмной теме — почти чёрный (index.css). */}
            <div className="pointer-events-none absolute inset-0 chat-bg" />
            {/* Еле заметные точки для текстуры */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.5] dark:opacity-[0.15]"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(120,130,150,0.12) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            {/* Контент */}
            <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center bg-white/80 dark:bg-white/5 backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10 shadow-lg shadow-blue-500/10 text-blue-500/80 dark:text-blue-400/80">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <span className="relative text-sm font-medium text-gray-400 dark:text-gray-500">Выбери контакт для начала чата</span>
          </div>
        ) : (
          <>
            {/* Шапка */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 bg-white">
              <button
                onClick={() => setActiveId(null)}
                className="md:hidden text-blue-600 dark:text-blue-400 flex-shrink-0 -ml-1 p-1"
                aria-label="Назад"
              >
                <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
                  <path d="M8 1L1 7.5L8 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="relative w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
                {activeContact.name.charAt(0).toUpperCase()}
                {activeContact.avatar && (
                  <img
                    src={activeContact.avatar}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none" }}
                    onLoad={(e) => { e.currentTarget.style.display = "" }}
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{activeContact.name}</div>
                {activeContact.role && <div className="text-xs text-gray-400">{activeContact.role}</div>}
              </div>
              {/* Очистка переписки есть у обеих сторон: в кабинете ученика и
                  родителя её не было вовсе, и удалить переписку они не могли
                  никак. Кнопка видимая, а не спрятанная в меню, но с
                  подтверждением: восстановить переписку будет нечем. */}
              {messages.length > 0 && (
                <button
                  onClick={() => { setDelError(""); setConfirmDel({ kind: "all" }) }}
                  title="Очистить переписку"
                  aria-label="Очистить переписку"
                  className="press-fill ml-auto flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Icon name="trash" size={16} />
                </button>
              )}
            </div>

            {/* Сообщения + Ввод */}
            <div className="flex-1 min-h-0 relative">
              <div
                className="absolute inset-0 overflow-y-auto overflow-x-hidden px-4 pt-3 pb-[68px] flex flex-col gap-1 chat-bg"
                onScroll={e => {
                  const el = e.currentTarget
                  nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
                }}
              >
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 dark:text-gray-600 text-sm mt-10 select-none">
                    Начни переписку
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.sender_id === myId
                  const isNew = newMsgIds.has(msg.id)
                  const prev = messages[i - 1]
                  const next = messages[i + 1]
                  const showDate = !prev || !isSameDay(prev.created_at, msg.created_at)
                  // Группа — подряд идущие сообщения одного отправителя за один
                  // день. Хвостик рисуется только у последнего в группе.
                  const startsGroup = showDate || !prev || prev.sender_id !== msg.sender_id
                  const endsGroup = !next || next.sender_id !== msg.sender_id
                    || !isSameDay(msg.created_at, next.created_at)
                  return (
                    <Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-2 select-none">
                          <span className="chat-date text-[11px] font-semibold px-2.5 py-1 rounded-full">
                            {formatDayLabel(msg.created_at)}
                          </span>
                        </div>
                      )}
                    <div
                      className={`chat-row group flex items-center gap-1.5 ${isMe ? "justify-end" : "justify-start"} ${startsGroup && !showDate ? "mt-2" : ""} ${isNew ? (isMe ? "chat-msg-right" : "chat-msg-left") : ""}`}
                    >
                      {/* Кнопка удаления стоит СНАРУЖИ пузыря, со стороны поля:
                          внутри она перекрывала бы текст и время. На мыши
                          появляется по наведению, на касании видна всегда —
                          иначе на телефоне до неё никак не добраться. */}
                      {canDelete(msg) && isMe && (
                        <button
                          type="button"
                          onClick={() => { setDelError(""); setConfirmDel({ kind: "msg", id: msg.id, text: msg.text }) }}
                          aria-label="Удалить сообщение"
                          className="chat-del order-first flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 active:scale-90"
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      )}
                      <div
                        onPointerDown={() => startPress(msg)}
                        onPointerUp={endPress}
                        onPointerLeave={endPress}
                        onPointerCancel={endPress}
                        onContextMenu={(e) => {
                          if (!canDelete(msg)) return
                          e.preventDefault()
                          setDelError("")
                          setConfirmDel({ kind: "msg", id: msg.id, text: msg.text })
                        }}
                        className={`chat-bubble chat-tail relative max-w-[65%] px-3.5 py-2 rounded-[13px] text-sm break-words ${
                        isMe
                          ? "bg-blue-600 text-white chat-tail-out"
                          : "chat-bubble-in shadow-sm chat-tail-in"
                      } ${endsGroup ? "is-tailed" : ""} ${isNew ? "chat-tail-new" : ""}`}>
                        <div className="leading-relaxed">
                          {msg.text}
                          {/* Время и галочки — в конце последней строки, как в
                              Telegram: float переносит их сами на новую строку,
                              если текст занял всю ширину. */}
                          <span className={`chat-meta ${
                            isMe ? "text-white/65" : "text-gray-400 dark:text-gray-400"
                          }`}>
                            {new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                            {isMe && (
                              msg.read ? (
                                <svg width="15" height="8" viewBox="0 0 18 10" fill="none" className="opacity-75 flex-shrink-0">
                                  <path d="M1 5L5 9L13 1" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M5 5L9 9L17 1" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              ) : (
                                <svg width="10" height="8" viewBox="0 0 12 10" fill="none" className="opacity-45 flex-shrink-0">
                                  <path d="M1 5L5 9L11 1" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )
                            )}
                          </span>
                        </div>
                      </div>
                      {canDelete(msg) && !isMe && (
                        <button
                          onClick={() => { setDelError(""); setConfirmDel({ kind: "msg", id: msg.id, text: msg.text }) }}
                          aria-label="Удалить сообщение"
                          className="chat-del flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 active:scale-90"
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      )}
                    </div>
                    </Fragment>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Ввод — закреплён снизу */}
              <div className="absolute bottom-0 left-0 right-0 px-3 py-3 border-t border-gray-100 flex gap-2 bg-white">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Сообщение..."
                  rows={1}
                  className="flex-1 px-4 py-2.5 text-sm rounded-2xl border border-gray-200 bg-white/70 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none leading-5"
                  style={{ minHeight: 42, maxHeight: 120, overflowY: "auto" }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="chat-send-btn w-10 h-10 self-end bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500/15 dark:disabled:bg-white/10 text-white disabled:text-gray-400 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Удаление — только через подтверждение: возвращать будет нечего. */}
      <ConfirmModal
        open={!!confirmDel}
        danger
        title={confirmDel?.kind === "all" ? "Очистить переписку?" : "Удалить сообщение?"}
        message={confirmDel?.kind === "all"
          ? `Вся переписка с ${activeContact?.name || "собеседником"} пропадёт и у ${isTutor ? "ученика" : "репетитора"} — восстановить её будет нечем.`
          : `Сообщение «${(confirmDel?.text || "").slice(0, 80)}${(confirmDel?.text || "").length > 80 ? "…" : ""}» пропадёт и у собеседника.`}
        confirmLabel={deleting ? "Удаляем…" : "Удалить"}
        cancelLabel="Отмена"
        onConfirm={() => (confirmDel?.kind === "all" ? clearConversation() : deleteMessage(confirmDel.id))}
        onCancel={() => { setConfirmDel(null); setDelError("") }}
      />
      {delError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass-tint-amber px-4 py-2.5 text-sm text-amber-700">
          {delError}
        </div>
      )}
    </div>
  )
}
