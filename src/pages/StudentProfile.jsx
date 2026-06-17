import { useRef, useState } from "react"

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

const MESSENGER_LABELS = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  vk: "ВКонтакте",
  other: "Другое",
}

const MESSENGERS = [
  { id: "telegram", label: "Telegram", placeholder: "https://t.me/username" },
  { id: "whatsapp", label: "WhatsApp", placeholder: "https://wa.me/79001234567" },
  { id: "instagram", label: "Instagram", placeholder: "https://instagram.com/username" },
  { id: "vk", label: "ВКонтакте", placeholder: "https://vk.com/username" },
  { id: "other", label: "Другое", placeholder: "https://..." },
]

function EditModal({ student, onClose, onSave }) {
  const [form, setForm] = useState({
    name: student.name || "",
    phone: student.phone || "",
    contacts: student.contacts || [],
  })

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function addContact() {
    setForm((prev) => ({ ...prev, contacts: [...prev.contacts, { messenger: "telegram", url: "" }] }))
  }

  function updateContact(i, field, value) {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, idx) => idx === i ? { ...c, [field]: value } : c),
    }))
  }

  function removeContact(i) {
    setForm((prev) => ({ ...prev, contacts: prev.contacts.filter((_, idx) => idx !== i) }))
  }

  function handleSave() {
    if (!form.name || !form.phone) { alert("Заполни имя и телефон!"); return }
    onSave(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-medium">Редактировать</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Имя и фамилия</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Телефон</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-500">Мессенджеры</label>
              <button onClick={addContact} className="text-xs text-blue-600 hover:underline">+ Добавить</button>
            </div>
            {form.contacts.map((c, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <select
                  value={c.messenger}
                  onChange={(e) => updateContact(i, "messenger", e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none"
                >
                  {MESSENGERS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <input
                  value={c.url}
                  onChange={(e) => updateContact(i, "url", e.target.value)}
                  placeholder={MESSENGERS.find((m) => m.id === c.messenger)?.placeholder}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
                <button onClick={() => removeContact(i)} className="text-gray-400 hover:text-red-500 text-lg">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
            Отмена
          </button>
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

function StudentProfile({ student, onBack, onUpdate }) {
  const fileRef = useRef()
  const [showEdit, setShowEdit] = useState(false)

  function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      onUpdate(student.id, { avatar: ev.target.result })
    }
    reader.readAsDataURL(file)
  }

  function handleSave(data) {
    onUpdate(student.id, data)
  }

  const upcoming = (student.lessons || [])
    .filter((l) => parseLocalDate(l.date) >= new Date())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  const past = (student.lessons || [])
    .filter((l) => parseLocalDate(l.date) < new Date())
    .sort((a, b) => b.date.localeCompare(a.date))

  const avgScore = student.results?.length > 0
    ? Math.round(student.results.reduce((a, b) => a + b, 0) / student.results.length)
    : null

  const initials = student.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="p-6 max-w-3xl">
      <button
        onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
      >
        ← Назад к ученикам
      </button>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <div
              onClick={() => fileRef.current.click()}
              className="w-16 h-16 rounded-full overflow-hidden cursor-pointer border-2 border-gray-200 hover:border-blue-400 transition-colors"
            >
              {student.avatar ? (
                <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-blue-100 flex items-center justify-center text-xl font-medium text-blue-600">
                  {initials}
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current.click()}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full text-white text-xs flex items-center justify-center hover:bg-blue-700"
            >
              📷
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          <div>
            <h1 className="text-xl font-medium">{student.name}</h1>
            <div className="text-sm text-gray-500 mt-0.5">
              {student.isRecurring ? "🔁 Регулярные занятия" : "📅 Разовые занятия"}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setShowEdit(true)}
              className="text-sm border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              ✏️ Редактировать
            </button>
            {student.paid ? (
              <span className="bg-green-100 text-green-700 text-xs px-3 py-1.5 rounded-full">Оплачено</span>
            ) : (
              <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1.5 rounded-full">Долг</span>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm w-24">Телефон</span>
            <a href={`tel:${student.phone}`} className="text-sm text-blue-600 hover:underline">{student.phone}</a>
          </div>

          {(student.contacts || []).map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-gray-400 text-sm w-24">{MESSENGER_LABELS[c.messenger] || c.messenger}</span>
              <a href={c.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate">{c.url}</a>
            </div>
          ))}

          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm w-24">Расписание</span>
            <span className="text-sm text-gray-700">{student.schedule}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm w-24">Длительность</span>
            <span className="text-sm text-gray-700">{student.lessonDuration} мин</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Всего занятий</div>
          <div className="text-2xl font-medium">{(student.lessons || []).length}</div>
        </div>
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Проведено</div>
          <div className="text-2xl font-medium">{past.length}</div>
        </div>
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Средний балл</div>
          <div className="text-2xl font-medium">{avgScore ?? "—"}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-medium mb-3">Ближайшие занятия</h2>
          {upcoming.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Нет предстоящих занятий</div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((l, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium">
                      {parseLocalDate(l.date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}
                    </div>
                    <div className="text-xs text-gray-400">{l.time} · {l.duration} мин</div>
                  </div>
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">Запланировано</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-medium mb-3">История оплат</h2>
          {(student.payments || []).length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Оплат пока нет</div>
          ) : (
            <div className="flex flex-col gap-2">
              {(student.payments || []).map((p, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium">{p.date}</div>
                    {p.note && <div className="text-xs text-gray-400">{p.note}</div>}
                  </div>
                  <div className="text-sm font-medium text-green-600">+{p.amount.toLocaleString("ru-RU")} ₽</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 col-span-2">
          <h2 className="text-sm font-medium mb-3">Прошедшие занятия</h2>
          {past.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Занятий ещё не было</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {past.map((l, i) => (
                <div key={i} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm">
                      {parseLocalDate(l.date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}
                    </div>
                    <div className="text-xs text-gray-400">{l.time} · {l.duration} мин</div>
                  </div>
                  <span className="text-xs text-gray-400">Проведено</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <EditModal
          student={student}
          onClose={() => setShowEdit(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

export default StudentProfile
