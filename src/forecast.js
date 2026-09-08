// Готовность к экзамену одним числом: где ученик сейчас, куда он идёт по своему
// же темпу и дотянет ли до цели к дате экзамена.
//
// ЧЕСТНОСТЬ ВАЖНЕЕ КРАСОТЫ. Прогноз — это продолжение уже наблюдаемой линии, а
// не обещание. Поэтому здесь нет ни одного подкрученного коэффициента, а там,
// где данных мало, число не показывается вовсе: «примерно 80» по двум работам —
// это не прогноз, это гадание, и родитель прочтёт его как обещание.
//
// Что считается:
//   сейчас   — последний первичный балл (его же видит ученик в своей работе);
//   темп     — наклон прямой наименьших квадратов по датам работ, баллов в неделю;
//   прогноз  — «сейчас + темп × недель до экзамена», обрезанный по максимуму
//              экзамена снизу нулём: отрицательный балл и балл выше максимума
//              не бывают, а прямая их даёт легко.
//
// Прогноз считается по ПЕРВИЧНЫМ баллам, а не по тестовым и не по отметкам:
// первичный балл линеен (одно задание — один балл), а тестовый растянут
// таблицей перевода, и прямая по нему означала бы не то, что кажется.
import { scaleOf, testScoreOf, examMaxPrimary } from "./examScales"

// Сколько работ нужно, чтобы говорить о темпе. Две точки дают прямую всегда, и
// по ним «темп» получается из одной случайной разницы между работами.
export const MIN_ROWS_FOR_TREND = 3

const WEEK = 7 * 24 * 3600 * 1000

const at = (d) => new Date(d).getTime()

// Порог сдачи в ПЕРВИЧНЫХ баллах: у экзамена с отметкой это нижняя граница
// тройки, у экзамена с тестовым баллом — первый первичный, который даёт
// минимальный тестовый. Считаем перебором, а не формулой: перевод задан
// таблицей, и обратной формулы у неё нет.
export function passThreshold(examType) {
  const scale = scaleOf(examType)
  if (!scale) return 0
  if (scale.kind === "grade") return scale.gradeCuts?.[0] || 0
  const max = examMaxPrimary(examType)
  for (let primary = 0; primary <= max; primary++) {
    if (testScoreOf(examType, primary) >= (scale.minTest || 0)) return primary
  }
  return 0
}

// Наклон прямой наименьших квадратов: баллов в неделю. null — точек мало либо
// все работы сданы в один день (тогда наклон не определён).
export function trendPerWeek(rows) {
  const pts = (rows || []).filter((r) => r?.date && Number.isFinite(r.total))
  if (pts.length < MIN_ROWS_FOR_TREND) return null
  const t0 = at(pts[0].date)
  const xs = pts.map((r) => (at(r.date) - t0) / WEEK)
  const ys = pts.map((r) => r.total)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0, den = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return null
  return num / den
}

// Полная картина по ученику. rows — работы по возрастанию даты, каждая
// { date, total, max }.
export function examForecast(rows, { examType, target = 0, examDate = null, now = new Date() } = {}) {
  const list = (rows || []).filter((r) => r?.date && Number.isFinite(r.total))
  const max = examMaxPrimary(examType) || list.reduce((m, r) => Math.max(m, r.max || 0), 0)
  const out = {
    max,
    target: target > 0 && target <= max ? target : 0,
    pass: passThreshold(examType),
    now: list.length ? list[list.length - 1].total : null,
    best: list.length ? Math.max(...list.map((r) => r.total)) : null,
    perWeek: null,
    forecast: null,
    weeks: null,
    examDate,
    reachesTarget: null,
    // Почему число такое: показывается прямо под прогнозом, иначе цифра
    // выглядит взятой с потолка.
    note: "",
  }
  if (!list.length) { out.note = "Работ ещё не было — считать не по чему."; return out }
  if (list.length < MIN_ROWS_FOR_TREND) {
    out.note = `Прогноз появится с ${MIN_ROWS_FOR_TREND}-й работы: по ${list.length === 1 ? "одной" : "двум"} темп не виден.`
    return out
  }

  const perWeek = trendPerWeek(list)
  out.perWeek = perWeek
  if (perWeek == null) { out.note = "Все работы сданы в один день — темп по ним не считается."; return out }

  if (!examDate) {
    out.note = "Дата экзамена не указана — есть только темп, прогнозировать не на что."
    return out
  }
  const weeks = (at(examDate) - now.getTime()) / WEEK
  out.weeks = weeks
  if (weeks <= 0) { out.note = "Экзамен уже прошёл."; return out }

  const raw = list[list.length - 1].total + perWeek * weeks
  out.forecast = Math.max(0, Math.min(max, Math.round(raw)))
  out.reachesTarget = out.target ? out.forecast >= out.target : null
  // Обрезка по максимуму — не мелочь: прямая с хорошим наклоном за полгода
  // уводит балл далеко за предел экзамена, и «прогноз 48 из 33» читался бы как
  // поломка. Говорим об этом прямо, а не молча подменяем число.
  const capped = raw > max
  out.note = capped
    ? `По темпу последних ${list.length} работ выходит выше максимума — показан предел экзамена, ${max}.`
    : `Продолжение темпа последних ${list.length} работ: ${fmtPace(perWeek)} до экзамена.`
  return out
}

// «+1,2 балла в неделю» / «−0,4 балла в неделю» / «без роста». Неделя, а не
// месяц: занятия идут неделями, и репетитор мыслит тем же шагом.
export function fmtPace(perWeek) {
  if (perWeek == null) return ""
  const v = Math.round(perWeek * 10) / 10
  if (v === 0) return "без роста"
  const abs = Math.abs(v).toString().replace(".", ",")
  return `${v > 0 ? "+" : "−"}${abs} ${plural(Math.abs(v), "балл", "балла", "баллов")} в неделю`
}

// Своя, потому что forecast.js обязан оставаться считающим модулем без единого
// импорта из интерфейса — его гоняет проверка в node.
function plural(n, one, few, many) {
  const int = Math.floor(Math.abs(n))
  const frac = Math.abs(n) - int
  // Дробное число всегда «балла»: 1,2 балла, 0,4 балла.
  if (frac > 0) return few
  const mod10 = int % 10
  const mod100 = int % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
