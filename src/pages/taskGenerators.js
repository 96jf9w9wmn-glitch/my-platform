// Реестр банка заданий: диспетчер по предметам.
//
// Сами генераторы лежат по модулям предметов (taskGeneratorsOge.js — ОГЭ по
// математике, taskGeneratorsInf.js, …, taskGeneratorsEgeProf.js), и каждый
// подключается ЛЕНИВО — по первому обращению к предмету через loadBankSubject().
//
// ПОЧЕМУ ТАК (15.09.2026). Раньше реестр импортировал все предметы статически, и
// банк был одним куском на 4 МБ: замер на боевом сайте — одно его подключение
// держало главный поток 2,8 с, кадры не рисовались, кабинет «провисал». Разделу
// или доске нужен ОДИН предмет; теперь грузится только он.
//
// ПРАВИЛО ДЛЯ ВЫЗЫВАЮЩИХ: hasGenerators / taskThemes / generateTask остались
// синхронными, но отвечают только по ПОДКЛЮЧЁННОМУ предмету. Перед ними —
// `await loadBankSubject(examType)` (память о загруженном живёт в модуле, повтор
// бесплатен). В разработке обращение к неподключённому предмету пишет
// предупреждение в консоль — молчаливый «нет генераторов» тут был бы ошибкой.
// Какие номера у предмета есть, известно и БЕЗ подключения — из статического
// индекса bankIndex.js (его собирает scripts/bank-index.mjs при сборке).
import { BANK_INDEX } from "./bankIndex.js"

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

const SUBJECTS = {
  "ОГЭ": () => import("./taskGeneratorsOge.js").then((m) => [m.GENERATORS_OGE, m.GEN_META_OGE]),
  "ОГЭ Информатика": () => import("./taskGeneratorsInf.js").then((m) => [m.GENERATORS_INF, m.GEN_META_INF]),
  "ОГЭ Английский": () => import("./taskGeneratorsEng.js").then((m) => [m.GENERATORS_ENG, m.GEN_META_ENG]),
  "ОГЭ Русский": () => import("./taskGeneratorsRus.js").then((m) => [m.GENERATORS_RUS, m.GEN_META_RUS]),
  "ОГЭ Химия": () => import("./taskGeneratorsChem.js").then((m) => [m.GENERATORS_CHEM, m.GEN_META_CHEM]),
  "ОГЭ Обществознание": () => import("./taskGeneratorsObsh.js").then((m) => [m.GENERATORS_OBSH, m.GEN_META_OBSH]),
  "ОГЭ Физика": () => import("./taskGeneratorsPhys.js").then((m) => [m.GENERATORS_PHYS, m.GEN_META_PHYS]),
  "ОГЭ История": () => import("./taskGeneratorsHist.js").then((m) => [m.GENERATORS_HIST, m.GEN_META_HIST]),
  "ОГЭ Биология": () => import("./taskGeneratorsBio.js").then((m) => [m.GENERATORS_BIO, m.GEN_META_BIO]),
  "ОГЭ Литература": () => import("./taskGeneratorsLit.js").then((m) => [m.GENERATORS_LIT, m.GEN_META_LIT]),
  "ОГЭ География": () => import("./taskGeneratorsGeo.js").then((m) => [m.GENERATORS_GEO, m.GEN_META_GEO]),
  "ЕГЭ": () => import("./taskGeneratorsEgeBase.js").then((m) => [m.GENERATORS_EGE_BASE, m.GEN_META_EGE_BASE]),
  "ЕГЭ Профиль": () => import("./taskGeneratorsEgeProf.js").then((m) => [m.GENERATORS_EGE_PROF, m.GEN_META_EGE_PROF]),
  "ЕГЭ Информатика": () => import("./taskGeneratorsEgeInf.js").then((m) => [m.GENERATORS_EGE_INF, m.GEN_META_EGE_INF]),
}
export const BANK_SUBJECTS = Object.keys(SUBJECTS)

const GENERATORS = {}
const GEN_META = {}
const loading = new Map()
const warned = new Set()
const DEV = typeof import.meta !== "undefined" && !!import.meta.env?.DEV

export function bankLoaded(examType) {
  return Object.prototype.hasOwnProperty.call(GENERATORS, examType)
}

// Подключить предмет. Отвечает true, когда генераторы предмета готовы, false —
// когда такого предмета в банке нет. Повторный вызов и вызов во время загрузки
// возвращают то же обещание, второй раз модуль не тянется.
export function loadBankSubject(examType) {
  if (bankLoaded(examType)) return Promise.resolve(true)
  const load = SUBJECTS[examType]
  if (!load) return Promise.resolve(false)
  if (!loading.has(examType)) {
    const p = load().then(([gens, meta]) => {
      GENERATORS[examType] = gens
      GEN_META[examType] = meta
      if (DEV) checkIndex(examType, gens)
      return true
    }).finally(() => loading.delete(examType))
    loading.set(examType, p)
  }
  return loading.get(examType)
}

// Все предметы разом — для инструментов (смоук, статистика банка), не для кабинета.
export async function loadAllBankSubjects() {
  await Promise.all(BANK_SUBJECTS.map(loadBankSubject))
}

// Индекс собирается скриптом и может отстать от генераторов: в разработке
// сверяем при каждом подключении, чтобы расхождение было видно сразу.
function checkIndex(examType, gens) {
  const real = Object.keys(gens).filter((n) => gens[n]?.length).map(Number).sort((a, b) => a - b)
  const listed = (BANK_INDEX[examType] || []).slice().sort((a, b) => a - b)
  if (real.join(",") !== listed.join(",")) {
    console.error(`банк: индекс номеров «${examType}» устарел — запустите node scripts/bank-index.mjs`,
      { real, listed })
  }
}

function table(map, examType) {
  const t = map[examType]
  if (!t && DEV && SUBJECTS[examType] && !warned.has(examType)) {
    warned.add(examType)
    console.warn(`банк: предмет «${examType}» ещё не подключён — сначала await loadBankSubject(examType)`)
  }
  return t
}

export function hasGenerators(examType, number) {
  return !!table(GENERATORS, examType)?.[number]?.length
}

// Темы номера для UI: [{ theme, items: [{ key, label }] }] (без ссылок на функции).
export function taskThemes(examType, number) {
  const m = table(GEN_META, examType)?.[number]
  if (!m) return null
  return m.map(([theme, items]) => ({ theme, items: items.map(([key, label]) => ({ key, label })) }))
}
function findGen(examType, number, key) {
  const m = table(GEN_META, examType)?.[number]
  if (!m) return null
  for (const [, items] of m) for (const [k, , fn] of items) if (k === key) return fn
  return null
}

// Ключ типажа по самой функции-генератору: нужен, когда типаж выбран случайно
// (genKey не передали) — иначе потом невозможно повторить ЭТОТ ЖЕ типаж со
// свежими числами. Сравниваем ссылки на функции, а не имена: имена съедает минификация.
function keyOfGen(examType, number, fn) {
  const m = table(GEN_META, examType)?.[number]
  if (!m) return null
  for (const [, items] of m) for (const [k, , f] of items) if (f === fn) return k
  return null
}

// Собирает одно задание указанного номера: случайный шаблон (или конкретный типаж по
// genKey) + свежие числа. Форма объекта совпадает со строкой банка `tasks`.
//
// К результату всегда приписывается gen_key — ключ типажа, из которого задание
// собрано. По нему потом делается «вот такая же задача, но с другими числами»
// (работа над ошибками, тематическая тренировка, аналитика слабых типажей).
export function generateTask(examType, number, genKey) {
  // Типаж выбираем ЗДЕСЬ, а не внутри сборки: только так известно, какой именно
  // генератор сработал при случайном выборе, и его ключ можно записать в задание.
  //
  // Скину РАЗРЕШЕНО вернуть null («выпавшие числа не сошлись») — у некоторых типажей
  // это до половины вызовов. Поэтому пробуем несколько раз: при заданном genKey — тот же
  // типаж со свежими числами, иначе каждый раз новый случайный. При доле null 0,6
  // вероятность не собрать задание за 40 попыток порядка 10⁻⁹.
  const list = table(GENERATORS, examType)?.[number] || []
  for (let attempt = 0; attempt < 40; attempt++) {
    const fn = genKey ? findGen(examType, number, genKey) : pick(list)
    if (!fn) return null
    const task = buildTask(examType, number, fn)
    if (!task) continue
    task.gen_key = genKey || keyOfGen(examType, number, fn) || null
    return task
  }
  return null
}

function buildTask(examType, number, fn) {
  const out = fn()
  if (!out) return null                     // скин отказался от этого набора параметров
  // ВНИМАНИЕ: поле, которого нет в этом списке, до задания не доедет — buildTask
  // собирает новый объект, а не дополняет пришедший. Так пропадал remoteFile у
  // КЕГЭ №3 и №17: генератор его отдавал, а ученик получал задание без файла.
  const { condition_text, condition_tail, answer, image_url, solution_image, solution, program, archive, spreadsheet, textFile, remoteFile, answerProgram, source_text, source_title, intro, introGroup, introRef, fipi } = out
  const id = `gen-${number}-${Math.random().toString(36).slice(2, 10)}`
  // №23/№24 (часть 2, геометрия): чертёж строит сам ученик, поэтому в условие он не идёт —
  // прячем его в solution_image (пригодится для будущего разбора решения). Полное решение
  // складываем в solution. №24 — доказательство (answer = «Доказано.»), №23 — вычисление
  // (answer = число). ЭТО ТОЛЬКО ДЛЯ МАТЕМАТИКИ (ОГЭ ч.2): у английского те же номера значат
  // другое (грамматика), поэтому ветки гейтируются по examType.
  if (examType === "ОГЭ" && number === 24) {
    return {
      id, number, exam_type: examType, condition_text,
      image_url: null,
      solution_image: image_url ?? null,
      solution: answer ?? null,
      answer: "Доказано.",
      generated: true,
    }
  }
  if (examType === "ОГЭ" && (number === 23 || number === 25)) {
    return {
      id, number, exam_type: examType, condition_text,
      image_url: null,
      solution_image: image_url ?? null,
      solution: solution ?? null,
      answer,
      generated: true,
    }
  }
  // №20 (часть 2): показываем «настоящий» математический минус U+2212 и в отрицательных
  // числах (в остальных номерах ответы — String(число) с ASCII-дефисом, не трогаем).
  const dash = (s) => examType === "ОГЭ" && number === 20 && s != null ? String(s).replace(/-/g, "−") : s
  return {
    id,
    number,
    exam_type: examType,
    condition_text: dash(condition_text),
    condition_tail: condition_tail ?? null,   // текст ПОД картинкой (напр. вопрос ниже таблицы/программы)
    solution: solution ?? null,               // развёрнутое обоснование для репетитора (ЕГЭ Профиль №20)
    program: program ?? null,                 // блоки кода на 5 языках (интерактивный вывод с копированием)
    archive: archive ?? null,                 // №11/№12: дерево файлов { name, files } для скачивания .zip
    spreadsheet: spreadsheet ?? null,         // №14: данные таблицы { name, sheetName, rows } для .xlsx
    textFile: textFile ?? null,               // КЕГЭ №17/24/26/27: прилагаемый .txt (или массив файлов)
    remoteFile: remoteFile ?? null,           // файл задания, ВЗЯТОГО из банка ФИПИ: лежит в хранилище, приходит по ссылке
    answerProgram: answerProgram ?? null,     // №16: эталонное решение [{name,code}] — под «Ответ»
    image_url: image_url ?? null,
    // график РЕШЕНИЯ (строит ученик, поэтому в условие не идёт) — прячем до реализации
    // пошаговых решений; см. №22, где generateTask его не показывает, но сохраняет.
    solution_image: solution_image ?? null,
    source_text: source_text ?? null,         // ОГЭ русский №10–13: общий прочитанный текст (раскрывается в UI)
    source_title: source_title ?? null,
    // Связка заданий с общим условием (КЕГЭ №19–21 — одна игра). Само условие
    // самостоятельное, а эти поля нужны сборке варианта: там описание печатается
    // один раз, у первого номера связки (linkSharedIntros в taskBankApi.js).
    intro: intro ?? null,                     // описание, повторённое у всех заданий связки
    introGroup: introGroup ?? null,           // ключ связки (у разных наборов чисел разный)
    introRef: introRef ?? null,               // начало ссылки: «Для игры, описанной в задании»
    answer: dash(answer),
    generated: true,
    // Задание не собрано генератором, а ВЗЯТО из открытого банка ФИПИ целиком
    // (КЕГЭ №2, 3, 4, 6, 10, 13, 17, 22). Подпись в просмотре банка читает это
    // поле: без него такое задание подписано «генератор», что неправда.
    fipi: fipi === true,
  }
}
