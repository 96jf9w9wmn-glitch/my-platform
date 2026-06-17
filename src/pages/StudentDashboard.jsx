function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function StudentDashboard({ user, students, onLogout }) {
  const student = students.find(
    (s) => s.name?.toLowerCase() === user.profile?.name?.toLowerCase()
  )

  const upcoming = (student?.lessons || [])
    .filter((l) => parseLocalDate(l.date) >= new Date())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10)

  const past = (student?.lessons || [])
    .filter((l) => parseLocalDate(l.date) < new Date())
    .sort((a, b) => b.date.localeCompare(a.date))

  const initials = user.profile?.name
    ? user.profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?"

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-medium">Мой кабинет</h1>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">
            {initials}
          </div>
          <span className="text-sm text-gray-600">{user.profile?.name}</span>
          <button
            onClick={onLogout}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Выйти
          </button>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        {!student ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <div className="text-amber-600 text-lg mb-2">⚠️</div>
            <div className="text-sm text-amber-700 font-medium">Репетитор ещё не добавил тебя в систему</div>
            <div className="text-xs text-amber-600 mt-1">Попроси репетитора добавить тебя по имени: <b>{user.profile?.name}</b></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-500 mb-1">Всего занятий</div>
                <div className="text-2xl font-medium">{(student.lessons || []).length}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-500 mb-1">Проведено</div>
                <div className="text-2xl font-medium">{past.length}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-500 mb-1">Средний балл</div>
                <div className="text-2xl font-medium">
                  {student.results?.length > 0
                    ? Math.round(student.results.reduce((a, b) => a + b, 0) / student.results.length)
                    : "—"}
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h2 className="text-base font-medium mb-4">Ближайшие занятия</h2>
              {upcoming.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-4">Нет предстоящих занятий</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {upcoming.map((l, i) => (
                    <div key={i} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-sm font-medium">
                          {parseLocalDate(l.date).toLocaleDateString("ru-RU", {
                            weekday: "long", day: "numeric", month: "long"
                          })}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{l.time} · {l.duration} мин</div>
                      </div>
                      <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full">Запланировано</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {past.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-base font-medium mb-4">Прошедшие занятия</h2>
                <div className="flex flex-col gap-2">
                  {past.map((l, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div className="text-sm">
                        {parseLocalDate(l.date).toLocaleDateString("ru-RU", {
                          weekday: "short", day: "numeric", month: "short"
                        })} в {l.time}
                      </div>
                      <span className="text-xs text-gray-400">Проведено</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default StudentDashboard
