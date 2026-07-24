import { useState, useEffect, useRef, Fragment } from "react"
import { supabase } from "../supabase"

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

export default function Chat({ myId, myName, initialContacts = [], canAddByCode = false, onUnreadChange }) {
  const initialContactIds = initialContacts.map(c => c.id).join(",")

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
  const [input, setInput] = useState("")
  const [adding, setAdding] = useState(false)
  const [codeInput, setCodeInput] = useState("")
  const [codeError, setCodeError] = useState("")
  const [searching, setSearching] = useState(false)
  const [unreadByContact, setUnreadByContact] = useState({})
  const bottomRef = useRef(null)
  const channelRef = useRef(null)
  const incomingChannelRef = useRef(null)
  const initialLoadDone = useRef(false)
  const prevMsgCount = useRef(0)
  const activeIdRef = useRef(null)

  useEffect(() => { activeIdRef.current = activeId }, [activeId])

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
      .select("sender_id")
      .eq("recipient_id", myId)
      .eq("read", false)
      .then(({ data, error }) => {
        if (error) { console.error("Failed to load unread chat counts:", error); return }
        if (!data) return
        const counts = {}
        data.forEach(m => { counts[m.sender_id] = (counts[m.sender_id] || 0) + 1 })
        setUnreadByContact(counts)
        if (onUnreadChange && data.length > 0) onUnreadChange(data.length, true)
      })
  }, [myId])

  // Scroll: instant on conversation switch, smooth on new message
  useEffect(() => {
    const isNew = messages.length > prevMsgCount.current && initialLoadDone.current
    prevMsgCount.current = messages.length
    bottomRef.current?.scrollIntoView({ behavior: isNew ? "smooth" : "auto" })
  }, [messages.length])

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
      .then(({ data }) => {
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
          supabase.from("chat_messages").update({ read: true }).eq("id", msg.id)
          if (onUnreadChange) onUnreadChange(-1)
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
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel); channelRef.current = null }
  }, [convId])

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
    let contactId, contactName, contactAvatar = student.avatar || null

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
    <div className="flex-1 min-h-0 flex overflow-hidden pb-20 md:pb-0 bg-white dark:bg-gray-900">

      {/* Контакты: полный экран на мобильном (когда нет активного диалога) */}
      <div className={`flex-col border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 ${
        activeContact ? "hidden md:flex md:w-64 md:flex-shrink-0" : "flex w-full md:w-64 md:flex-shrink-0"
      }`}>
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
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

        {adding && (
          <div className="m-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Код ученика (6 символов)</p>
            <input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="AB1234"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 mb-2"
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
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2"
              >Отмена</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="p-6 text-xs text-gray-400 dark:text-gray-500 text-center mt-4">
              {canAddByCode ? 'Нажми "+" чтобы найти собеседника' : "Нет контактов"}
            </div>
          ) : contacts.map(c => {
            const unread = unreadByContact[c.id] || 0
            const isActive = activeId === c.id
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`no-press press-tap w-full flex items-center gap-3 px-3 py-3 transition-colors text-left ${
                  isActive
                    ? "bg-blue-500 dark:bg-blue-600"
                    : "hover:bg-gray-50 dark:hover:bg-white/5"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold overflow-hidden ${
                  isActive
                    ? "bg-white/25 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}>
                  {c.avatar
                    ? <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                    : (c.name || "?").charAt(0).toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${
                    isActive ? "text-white" : "text-gray-800 dark:text-white"
                  }`}>
                    {c.name}
                  </div>
                  {c.role && (
                    <div className={`text-xs truncate ${isActive ? "text-white/70" : "text-gray-400"}`}>
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
      </div>

      {/* Правая панель: скрыта на мобильном если нет активного диалога */}
      <div className={`flex-1 min-h-0 flex-col min-w-0 bg-white dark:bg-gray-900 ${
        activeContact ? "flex" : "hidden md:flex"
      }`}>
        {!activeContact ? (
          <div className="relative flex-1 flex flex-col items-center justify-center gap-4 overflow-hidden">
            {/* Мягкий равномерный фон — без резкого пятна, чтобы сайдбар не выбивался.
                bg-gray-50 сам remap-ается в тёмный тон под .dark (см. index.css), dark:-override не нужен. */}
            <div className="pointer-events-none absolute inset-0 bg-gray-50" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.5] dark:opacity-[0.12]"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(100,116,139,0.10) 1px, transparent 1px)",
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
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 bg-white dark:bg-gray-900">
              <button
                onClick={() => setActiveId(null)}
                className="md:hidden text-blue-600 dark:text-blue-400 flex-shrink-0 -ml-1 p-1"
                aria-label="Назад"
              >
                <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
                  <path d="M8 1L1 7.5L8 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
                {activeContact.avatar
                  ? <img src={activeContact.avatar} alt="" className="w-full h-full object-cover" />
                  : activeContact.name.charAt(0).toUpperCase()
                }
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{activeContact.name}</div>
                {activeContact.role && <div className="text-xs text-gray-400">{activeContact.role}</div>}
              </div>
            </div>

            {/* Сообщения + Ввод */}
            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-4 pt-3 pb-[68px] flex flex-col gap-1.5 chat-bg">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 dark:text-gray-600 text-sm mt-10 select-none">
                    Начни переписку
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.sender_id === myId
                  const isNew = newMsgIds.has(msg.id)
                  const prev = messages[i - 1]
                  const showDate = !prev || !isSameDay(prev.created_at, msg.created_at)
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
                      className={`flex ${isMe ? "justify-end" : "justify-start"} ${isNew ? (isMe ? "chat-msg-right" : "chat-msg-left") : ""}`}
                    >
                      <div className={`max-w-[65%] px-3.5 py-2 rounded-2xl text-sm break-words ${
                        isMe
                          ? "bg-blue-600 text-white rounded-tr-sm"
                          : "chat-bubble-in rounded-tl-sm shadow-sm"
                      }`}>
                        <div className="leading-relaxed">{msg.text}</div>
                        <div className={`text-[10px] mt-0.5 flex items-center justify-end gap-1 ${
                          isMe ? "text-white/60" : "text-gray-400 dark:text-gray-400"
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
                        </div>
                      </div>
                    </div>
                    </Fragment>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Ввод — закреплён снизу */}
              <div className="absolute bottom-0 left-0 right-0 px-3 py-3 border-t border-gray-100 dark:border-gray-800 flex gap-2 bg-white dark:bg-gray-900">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Сообщение..."
                  rows={1}
                  className="flex-1 px-4 py-2.5 text-sm rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none leading-5"
                  style={{ minHeight: 42, maxHeight: 120, overflowY: "auto" }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="chat-send-btn w-10 h-10 self-end bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm transition-colors"
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
    </div>
  )
}
