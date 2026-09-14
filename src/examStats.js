// Арифметика результатов: как из варианта и его проверки получается строка с
// баллами и как из строк получается свод по ученику. Файл общий для «Результатов»
// репетитора и раздела «Результаты» в кабинете ученика — одни и те же баллы
// обязаны считаться одним правилом, иначе кабинеты разойдутся на одном ученике.
import { plural, answersEqual, creditedNums, homeworkTaskItems, homeworkPointsOf } from "./utils"
import { part1NumbersOf, part2NumbersOf } from "./pages/taskBankMeta"
import { scaleOf, part2MaxOf, variantMaxPrimary, examResult, testScoreOf, examMaxPrimary, parseTarget } from "./examScales"

// ─────────────────────────────────────────────────────────────────────────────
// Шкалы экзаменов
// ─────────────────────────────────────────────────────────────────────────────
// Перевод первичного балла во вторичный (тестовый балл ЕГЭ или отметку) живёт
// в src/examScales.js — одном файле на всё приложение. Здесь остаётся только
// разметка разбора работы.

// Разбор работы по заданиям строится по составу самого экзамена: номера части 1
// берём из банка (в информатике они идут не подряд), баллы части 2 — из шкалы.
// Раньше здесь лежали две жёстких разметки, ОГЭ и «ЕГЭ», и информатика рисовалась
// по чужой: показывались несуществующие задания 13–19 и деление на геометрию.
function buildLayout(type) {
  const p1 = part1NumbersOf(type)
  const geomNums = scaleOf(type)?.geometryNumbers || []
  const p1Geom = p1.filter((n) => geomNums.includes(n))
  // Деление «алгебра / геометрия» есть только у ОГЭ по математике.
  const part1 = p1Geom.length
    ? [
        { label: `Алгебра — задания ${p1[0]}–${p1Geom[0] - 1}`, nums: p1.filter((n) => !geomNums.includes(n)), tone: "blue" },
        { label: `Геометрия — задания ${p1Geom[0]}–${p1Geom[p1Geom.length - 1]}`, nums: p1Geom, tone: "purple" },
      ]
    : [{ label: `Часть 1 — ${p1.length} ${plural(p1.length, "задание", "задания", "заданий")}`, nums: p1, tone: "blue" }]

  const part2Max = part2MaxOf(type)
  // Номера части 2 берём из состава ВАРИАНТА, а баллы — из шкалы экзамена.
  // Обратный порядок рисовал бы клетки под задания, которых в варианте нет
  // (у профиля в банке пока нет №14 и №17).
  const p2 = part2NumbersOf(type).filter((n) => part2Max[n])
  const part2 = !p2.length ? []
    : geomNums.length
      ? [
          { label: "Алгебра", nums: p2.filter((n) => !geomNums.includes(n)) },
          { label: "Геометрия", nums: p2.filter((n) => geomNums.includes(n)) },
        ]
      : [{ label: "Часть 2", nums: p2 }]

  return { part1, part2, part2Max, part1Max: p1.length, part2Total: p2.reduce((s, n) => s + part2Max[n], 0) }
}

const LAYOUTS = {}
export const layoutOf = (type) => (LAYOUTS[type] ||= buildLayout(type))

// Доля от максимума — единственная величина, сопоставимая между ОГЭ и ЕГЭ:
// первичные баллы у них по разным шкалам. Считается от максимума ВАРИАНТА:
// в него входит не весь экзамен, и делить на экзаменационный максимум значило
// бы занижать всех подряд.
export function share(row) {
  return row.max ? Math.round((row.total / row.max) * 100) : 0
}

// Каким экзаменом мерить карту заданий: тем, по которому ученик реально решает
// работы. Цель в карточке («ЕГЭ») предмета не называет — профиль это или база,
// а номера и подписи у них разные.
export const examTypeOf = (student, stats) =>
  stats.rows?.[stats.rows.length - 1]?.type || student.examType || student.goal || ""

// ─────────────────────────────────────────────────────────────────────────────
// Данные
// ─────────────────────────────────────────────────────────────────────────────

export function toRow(variant, submission, fallbackType) {
  const type = variant.type || fallbackType || "ОГЭ"
  const L = layoutOf(type)
  const total = submission.total_score || 0
  // Задания части 2, реально вошедшие в вариант: у ЕГЭ их состав свой у каждой
  // работы, поэтому максимум считается по снимку, а не по всему экзамену.
  const p2 = [...new Set((variant.tasks_snapshot || []).map((t) => t.number).filter((n) => L.part2Max[n]))]
  const p2Nums = p2.length ? p2 : Object.keys(L.part2Max).map(Number)
  const max = variantMaxPrimary(type, [...part1NumbersOf(type), ...p2Nums])
  // geom_score хранит либо баллы за геометрию (ОГЭ по математике), либо
  // тестовый балл — как это записала форма проверки. Как геометрию читаем
  // только там, где геометрия вообще есть.
  const geomNums = scaleOf(type)?.geometryNumbers
  const res = examResult(type, total, {
    geometry: geomNums ? (submission.geom_score ?? null) : null,
    variantMax: max,
  })
  return {
    title: variant.title,
    type,
    date: variant.created_at,
    total,
    max,
    part1: submission.part1_score || 0,
    part2: submission.part2_score || 0,
    res,
    grade: res.grade,
    testScore: res.testScore,
    answers: variant.answers,
    submission,
  }
}

// Наследие: у части карточек баллы лежат простым массивом students.results[].
// Разбивку по частям такая запись не хранит, поэтому раскладываем по типовой
// пропорции — это оценка, а не данные проверки.
export function synthesizeRows(student) {
  // Старые записи не помнят предмет: у цели «ЕГЭ» считаем профильную математику —
  // единственный ЕГЭ, по которому эти баллы и выставляли.
  const isEge = student.goal === "ЕГЭ"
  const legacyType = isEge ? "ЕГЭ Профиль" : "ОГЭ"
  const now = Date.now()
  return student.results.map((total, i) => {
    const part1 = isEge ? Math.min(12, Math.round(total * 0.45)) : Math.min(19, Math.round(total * 0.68))
    const geomOrTest = isEge ? testScoreOf("ЕГЭ Профиль", total) : Math.max(2, Math.round(total * 0.22))
    return toRow(
      {
        title: `Вариант ${i + 1}`,
        type: legacyType,
        created_at: new Date(now - (student.results.length - i) * 14 * 24 * 60 * 60 * 1000).toISOString(),
        answers: { part1: [] },
      },
      {
        status: "graded",
        total_score: total,
        part1_score: part1,
        part2_score: Math.max(0, total - part1),
        geom_score: geomOrTest,
        part1_answers: [],
        part2_score_detail: {},
      },
      legacyType,
    )
  })
}

export function computeStats(student, rows) {
  const isExam = student.goal === "ОГЭ" || student.goal === "ЕГЭ"
  if (!rows.length) return { hasData: false, isExam, rows: [] }

  const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date))
  const last = sorted[sorted.length - 1]
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null
  const delta = prev ? last.total - prev.total : null
  const pct = share(last)
  const bestRow = sorted.reduce((a, b) => (b.total > a.total ? b : a), sorted[0])

  // ЦЕЛЬ ЗАПИСАНА НЕ В ПЕРВИЧНЫХ БАЛЛАХ, и сравнивать её с баллом работы
  // напрямую нельзя. students.target_score хранит то, чем цель является для
  // человека: у ЕГЭ с тестовой шкалой это тестовый балл (0–100), у ОГЭ —
  // отметка. Первичный балл работы против тестовой сотни давал «14 / 100» и
  // «до цели ещё 86 баллов» — баллов, которых на этом экзамене не существует
  // (максимум профиля 33 первичных). Перевод один на всё приложение —
  // parseTarget, его же зовёт «Готовность к экзамену».
  const examType = examTypeOf(student, { rows: sorted })
  const goal = parseTarget(examType, student.targetScore)
  // Балл последней работы в шкале НАСТОЯЩЕГО экзамена: наш вариант почти всегда
  // короче полного КИМ, и сравнивать с целью надо приведённый балл (examResult).
  const lastPrimary = last.res?.scaledPrimary ?? last.total

  // Что считать тревогой. Порядок важен: несданный экзамен перевешивает спад,
  // спад — просто низкий балл. Показываем ОДНУ причину, самую весомую.
  //
  // МЕРИТЬ ТРЕВОГУ НАДО ТОЙ ЖЕ ШКАЛОЙ, ЧТО СТОИТ НА ЭКРАНЕ. Доля первичных
  // баллов годится там, где первичный балл и есть результат (ОГЭ, база: отметка
  // выставляется по сумме). У профиля и информатики результат экзамена —
  // ТЕСТОВЫЙ балл, а перевод в него нелинейный: 14 из 32 первичных — это 74 из
  // 100, то есть и выше порога, и выше половины. Пока порог считался по
  // первичным, карточка противоречила сама себе: рядом стояли «меньше
  // половины», «тест ≈74» и «74 из 100».
  const byTest = last.res?.kind === "test" && last.testScore != null
  const belowMin = byTest && last.res.minTest ? last.testScore < last.res.minTest : false
  const belowHalf = byTest ? last.testScore < 50 : pct < 50
  let attention = null
  if (last.grade === 2) attention = "ниже тройки"
  else if (belowMin) attention = "ниже порога"
  else if (delta !== null && delta < 0) attention = `спад на ${Math.abs(delta)}`
  else if (belowHalf) attention = "меньше половины"

  return {
    hasData: true,
    isExam,
    rows: sorted,
    last,
    delta,
    pct,
    examType,
    goal,
    // Цель в первичных баллах: в них считает вся арифметика результатов.
    target: goal.primary,
    attention,
    avg: Math.round(sorted.reduce((s, v) => s + v.total, 0) / sorted.length),
    best: bestRow.total,
    bestRow,
    trendTone: delta === null || delta === 0 ? "blue" : delta > 0 ? "green" : "red",
    reachedTarget: goal.primary ? lastPrimary >= goal.primary : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Домашние работы
// ─────────────────────────────────────────────────────────────────────────────

// Работа попала в результаты, если ученик её решал: одна выдача — ещё не результат.
export const hwSolved = (hw) =>
  hw.status === "done" || hw.status === "submitted" ||
  hw.test_score != null || (Array.isArray(hw.student_answers) && hw.student_answers.length > 0)

export function toHwRow(hw) {
  const correct = Array.isArray(hw.correct_answers) ? hw.correct_answers : []
  const given = Array.isArray(hw.student_answers) ? hw.student_answers : []
  const byHand = creditedNums(hw.credited)
  // Балл работы считает та же арифметика, что и разбор у репетитора
  // (homeworkPointsOf): у задания с эталоном верность даёт сверка и ручной
  // зачёт, у задания без эталона — отметка репетитора, и каждое весит столько
  // баллов, сколько за него дают на экзамене. Второго счёта тут быть не должно:
  // он стоял здесь раньше — «сколько ответов сошлось с эталоном» — и терял
  // работу, проверенную рукой (свой файл, фотография решения). У неё нет ни
  // эталона, ни test_score, поэтому в таблице стояли прочерки, хотя балл был
  // выставлен по заданиям и из него же выведена оценка.
  //
  // Номер экзамена у каждого задания лежит в bank_tasks; список работ её не
  // просит (там условия и чертежи, мегабайты), поэтому в запросе идёт выжимка
  // task_meta — номер и предмет по порядку (supabase/homework_task_meta.sql).
  const { items } = homeworkTaskItems({ ...hw, bank_tasks: hw.bank_tasks || hw.task_meta || null })
  // Считать по заданиям можно, только когда описание работы разобралось на те
  // же задания, что и эталон: разошлись — считаем по строкам эталона, иначе
  // балл сложился бы не по тем заданиям.
  const points = items.length && (!correct.length || items.length === correct.length)
    ? homeworkPointsOf(items)
    : null
  const byPoints = points && points.counted > 0
  const max = byPoints ? points.max : (hw.question_count || correct.length || 0)
  const score = byPoints ? points.got
    : correct.length
    ? correct.reduce((n, c, i) => n + (byHand.has(i + 1) || answersEqual(given[i] ?? "", c) ? 1 : 0), 0)
    : (hw.test_score ?? null)
  return {
    id: hw.id,
    studentId: hw.student_id,
    title: hw.title || "Домашняя работа",
    date: hw.created_at,
    status: hw.status,
    written: hw.hw_type === "written",
    grade: hw.grade || null,
    score: score == null || !max ? null : score,
    max,
    percent: score == null || !max ? null : Math.round((score / max) * 100),
    correct,
    given,
    credited: hw.credited,
  }
}

export function computeHwStats(rows) {
  if (!rows.length) return { count: 0, rows: [] }
  const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date))
  const scored = sorted.filter((r) => r.percent !== null)
  const graded = sorted.filter((r) => r.grade)
  return {
    count: sorted.length,
    rows: sorted,
    last: sorted[sorted.length - 1],
    avgPct: scored.length ? Math.round(scored.reduce((n, r) => n + r.percent, 0) / scored.length) : null,
    scoredCount: scored.length,
    avgGrade: graded.length ? Math.round((graded.reduce((n, r) => n + r.grade, 0) / graded.length) * 10) / 10 : null,
    gradedCount: graded.length,
    pending: sorted.filter((r) => r.status === "submitted").length,
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Единицы показа балла
// ─────────────────────────────────────────────────────────────────────────────
// На ЕГЭ балл работы называют ТЕСТОВЫМ (0–100), у ОГЭ и базы вторичного балла
// не бывает вовсе — там первичный, а отметка стоит рядом отдельной строкой.
// Правило одно на все экраны: главная ученика, его «Результаты» и карточка у
// репетитора обязаны показывать за одну и ту же работу одно и то же число.
export const isTestScale = (examType) => scaleOf(examType)?.kind === "test"

// Балл строки в единицах показа. Первичный берём ПЕРЕСЧИТАННЫМ на полный КИМ
// (res.scaledPrimary): наш вариант почти всегда короче экзамена.
export const shownScore = (examType, row) =>
  isTestScale(examType) ? (row.res?.testScore ?? 0) : (row.res?.scaledPrimary ?? row.total)

export const shownScoreMax = (examType) =>
  isTestScale(examType) ? 100 : (examMaxPrimary(examType) || null)
