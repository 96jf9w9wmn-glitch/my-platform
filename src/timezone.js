// Часовые пояса.
//
// Занятие лежит в карточке ученика «настенным» временем: строка даты и строка
// «ЧЧ:ММ», без всякого пояса. Пока репетитор и ученики жили в одном поясе, это
// было верно и дёшево. Как только репетитор переехал (Ереван, UTC+4), одно и то
// же «18:00» стало означать разные моменты у него и у ученика в Москве.
//
// Пояс НИГДЕ не выбирается руками — он берётся с устройства (`deviceTimezone`)
// и обновляется сам при переезде. Выбор из списка тут был бы лишней настройкой:
// телефон и ноутбук и так знают, в какой стране находятся.
//
// ГЛАВНОЕ ПРАВИЛО: у расписания есть ЯКОРЬ — пояс, в котором время записано
// (`students.timezone`, пояс ученика). Якорь не двигается ни от переезда
// репетитора, ни от чего-либо ещё, поэтому в кабинете ученика, у родителя, в
// квитанции и в уведомлении стоит ровно то время, о котором договаривались.
// Меняется только то, как это же занятие показывают САМОМУ репетитору: его
// кабинет переводит время из якоря в пояс своего устройства на входе
// (App.jsx, loadStudents) и обратно на выходе — при сохранении карточки и при
// составлении текста уведомления ученику. Поэтому весь остальной код кабинета
// продолжает работать с «настенным» временем и о поясах ничего не знает.

// Пояс устройства. Кабинет без единой настройки обязан вести себя ровно как
// раньше, поэтому неизвестный пояс — это «как было», а не «Москва».
export function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ""
  } catch {
    return ""
  }
}

// Названия городов по-русски: «Asia/Yerevan» читается хуже, чем «Ереван».
// Это таблица ПОДПИСЕЙ, а не список выбора — пояс может прийти любой, и
// незнакомый показывается своим идентификатором, а не подменяется соседним.
const CITY = {
  "Europe/Kaliningrad": "Калининград",
  "Europe/Moscow": "Москва",
  "Europe/Simferopol": "Симферополь",
  "Europe/Volgograd": "Волгоград",
  "Europe/Kirov": "Киров",
  "Europe/Astrakhan": "Астрахань",
  "Europe/Saratov": "Саратов",
  "Europe/Ulyanovsk": "Ульяновск",
  "Europe/Samara": "Самара",
  "Asia/Yekaterinburg": "Екатеринбург",
  "Asia/Omsk": "Омск",
  "Asia/Novosibirsk": "Новосибирск",
  "Asia/Barnaul": "Барнаул",
  "Asia/Tomsk": "Томск",
  "Asia/Novokuznetsk": "Новокузнецк",
  "Asia/Krasnoyarsk": "Красноярск",
  "Asia/Irkutsk": "Иркутск",
  "Asia/Chita": "Чита",
  "Asia/Yakutsk": "Якутск",
  "Asia/Khandyga": "Хандыга",
  "Asia/Vladivostok": "Владивосток",
  "Asia/Ust-Nera": "Усть-Нера",
  "Asia/Magadan": "Магадан",
  "Asia/Sakhalin": "Южно-Сахалинск",
  "Asia/Srednekolymsk": "Среднеколымск",
  "Asia/Kamchatka": "Петропавловск-Камчатский",
  "Asia/Anadyr": "Анадырь",
  "Asia/Yerevan": "Ереван",
  "Asia/Tbilisi": "Тбилиси",
  "Asia/Baku": "Баку",
  "Europe/Minsk": "Минск",
  "Europe/Kyiv": "Киев",
  "Europe/Chisinau": "Кишинёв",
  "Asia/Almaty": "Алматы",
  "Asia/Aqtobe": "Актобе",
  "Asia/Tashkent": "Ташкент",
  "Asia/Bishkek": "Бишкек",
  "Asia/Dushanbe": "Душанбе",
  "Asia/Ashgabat": "Ашхабад",
  "Europe/Istanbul": "Стамбул",
  "Asia/Nicosia": "Никосия",
  "Asia/Jerusalem": "Тель-Авив",
  "Asia/Dubai": "Дубай",
  "Asia/Bangkok": "Бангкок",
  "Asia/Shanghai": "Шанхай",
  "Europe/Belgrade": "Белград",
  "Europe/Berlin": "Берлин",
  "Europe/Warsaw": "Варшава",
  "Europe/Prague": "Прага",
  "Europe/Lisbon": "Лиссабон",
  "Europe/Madrid": "Мадрид",
  "Europe/Paris": "Париж",
  "Europe/London": "Лондон",
  "America/New_York": "Нью-Йорк",
  "America/Los_Angeles": "Лос-Анджелес",
}

export function tzCity(tz) {
  if (!tz) return ""
  return CITY[tz] || String(tz).split("/").pop().replace(/_/g, " ")
}

// Смещение пояса от UTC в минутах в указанный момент. Считается через Intl:
// своей таблицы переходов на летнее время у нас нет и быть не должно — она
// устаревает молча.
export function tzOffsetMinutes(tz, date = new Date()) {
  if (!tz) return 0
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc }, {})
    const asUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
    )
    return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000)
  } catch {
    // Пояс, которого не знает браузер: считаем, что перевода нет. Показать
    // время как есть честнее, чем сдвинуть его наугад.
    return 0
  }
}

// «UTC+4», «UTC−3:30».
export function offsetLabel(tz, date = new Date()) {
  const min = tzOffsetMinutes(tz, date)
  const sign = min < 0 ? "−" : "+"
  const abs = Math.abs(min)
  return `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, "0")}` : ""}`
}

// «Ереван (UTC+4)».
export function tzLabel(tz) {
  return tz ? `${tzCity(tz)} (${offsetLabel(tz)})` : ""
}

// Разница поясов в минутах на указанный день: сколько прибавить ко времени в
// `fromTz`, чтобы получить время в `toTz`. Ноль — пояса совпадают по времени
// (Москва и Минск — разные пояса, но одно время, и разводить их незачем).
export function zoneDiffMinutes(fromTz, toTz, dateStr) {
  if (!fromTz || !toTz || fromTz === toTz) return 0
  const at = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date()
  return tzOffsetMinutes(toTz, at) - tzOffsetMinutes(fromTz, at)
}

// Момент времени по настенным дате и времени в указанном поясе.
// Две итерации: первая догадка может попасть в другое смещение, если между
// догадкой и настоящим моментом лежит перевод часов.
function wallToInstant(dateStr, timeStr, tz) {
  const [y, m, d] = String(dateStr).split("-").map(Number)
  const [hh, mm] = String(timeStr || "00:00").split(":").map(Number)
  const naive = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0)
  let guess = naive
  for (let i = 0; i < 2; i++) {
    const next = naive - tzOffsetMinutes(tz, new Date(guess)) * 60000
    if (next === guess) break
    guess = next
  }
  return new Date(guess)
}

// Момент времени → настенные дата и время в поясе.
function instantToWall(date, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc }, {})
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${String(Number(parts.hour) % 24).padStart(2, "0")}:${parts.minute}`,
  }
}

// Настенное время из одного пояса в другой. Дата может съехать на сутки — это
// не ошибка: занятие в 23:30 по Москве у репетитора в Ереване стоит уже на
// следующий день, и расписание обязано показывать его там.
export function convertWall(dateStr, timeStr, fromTz, toTz) {
  const time = timeStr || ""
  // Занятие без времени переводить нечем: у него есть день, но нет момента.
  if (!dateStr || !time || !fromTz || !toTz || fromTz === toTz) return { date: dateStr, time }
  try {
    return instantToWall(wallToInstant(dateStr, time, fromTz), toTz)
  } catch {
    return { date: dateStr, time }
  }
}

// Занятие целиком: вместе с предложением о переносе и пометкой «переехало
// отсюда». Пропустить их нельзя — иначе в расписании репетитора предложение
// стояло бы на час мимо самого занятия.
export function convertLesson(lesson, fromTz, toTz) {
  if (!lesson || !fromTz || !toTz || fromTz === toTz) return lesson
  const next = { ...lesson, ...convertWall(lesson.date, lesson.time, fromTz, toTz) }
  if (lesson.moveRequest?.date) {
    next.moveRequest = { ...lesson.moveRequest, ...convertWall(lesson.moveRequest.date, lesson.moveRequest.time, fromTz, toTz) }
  }
  if (lesson.movedFrom?.date) {
    next.movedFrom = { ...lesson.movedFrom, ...convertWall(lesson.movedFrom.date, lesson.movedFrom.time, fromTz, toTz) }
  }
  return next
}

export function convertLessons(lessons, fromTz, toTz) {
  if (!Array.isArray(lessons) || !fromTz || !toTz || fromTz === toTz) return lessons || []
  return lessons.map((l) => convertLesson(l, fromTz, toTz))
}

// ── Кадры времени в кабинете репетитора ──────────────────────────────────────
//
// `tzFrame` — пояс, в котором лежат занятия ученика ПРЯМО СЕЙЧАС в стейте
// (пояс устройства репетитора); `timezone` — якорь, то есть пояс, в котором они
// лежат в базе и в котором их видит ученик. Оба поля ставит App.jsx при
// загрузке; у ученика без аккаунта и на устройстве без пояса они пустые, и
// тогда все функции ниже — тождественные.

// Разошлись ли часы репетитора и ученика.
export function studentZoneDiffers(student) {
  return !!student?.tzFrame && !!student?.timezone && student.tzFrame !== student.timezone
    && zoneDiffMinutes(student.timezone, student.tzFrame) !== 0
}

// Время из кадра репетитора в кадр ученика — для записи в базу и для ЛЮБОГО
// текста, который прочитает ученик.
export function toStudentWall(student, dateStr, timeStr) {
  return convertWall(dateStr, timeStr, student?.tzFrame, student?.timezone)
}

// Обратный перевод: время ученика на экран репетитора.
export function toTutorWall(student, dateStr, timeStr) {
  return convertWall(dateStr, timeStr, student?.timezone, student?.tzFrame)
}

// «у ученика 18:00» — короткая подпись под временем занятия. Пустая строка,
// когда пояса совпадают: лишней приписки в расписании быть не должно.
export function studentTimeNote(student, dateStr, timeStr) {
  if (!timeStr || !studentZoneDiffers(student)) return ""
  const w = toStudentWall(student, dateStr, timeStr)
  return `у ученика ${w.time}`
}

// Витрина расписания («Пн 18:00, Ср 18:00») — строка, которую читает ученик,
// поэтому её тоже надо перевести в его пояс. День недели при этом может
// сдвинуться: занятие в 23:30 у репетитора в Ереване стоит у ученика в Москве
// ещё в предыдущий день.
export function shiftDayTime(dayIndex, timeStr, minutes) {
  const [h, m] = String(timeStr || "00:00").split(":").map(Number)
  const total = (h || 0) * 60 + (m || 0) + (minutes || 0)
  const dayShift = Math.floor(total / 1440)
  const inDay = ((total % 1440) + 1440) % 1440
  return {
    dayIndex: (((dayIndex + dayShift) % 7) + 7) % 7,
    time: `${String(Math.floor(inDay / 60)).padStart(2, "0")}:${String(inDay % 60).padStart(2, "0")}`,
  }
}
