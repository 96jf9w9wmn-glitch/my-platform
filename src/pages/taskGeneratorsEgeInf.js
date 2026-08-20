// Генераторы аналогов ЕГЭ по ИНФОРМАТИКЕ (КЕГЭ). Эталон типажей — открытый банк ФИПИ,
// распарсенный в fipi_bank_ege_inf/ (docx → tasks.json; сверка — inventory.py/coverage.py).
// Своя нумерация повторяет номера КЕГЭ 1–27. Ответ считается кодом — в банке ФИПИ
// правильных ответов нет. Форма объекта задачи как у остальных предметов:
// { condition_text, answer, image_url?, archive? }.
//
// Обозначения логических связок — как в КИМ: ¬ отрицание, /\ конъюнкция, \/ дизъюнкция,
// → импликация, ≡ тождество (именно в таком текстовом виде они напечатаны в банке).

import { tableBlock } from "../utils.js"

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i);[a[i], a[j]] = [a[j], a[i]] } return a }

// ── Логический движок (общий для №2 и №15) ───────────────────────────────────
// Дерево: {t:"v",v} | {t:"¬",a} | {t:"∧"|"∨"|"→"|"≡",a,b}. Значения переменных —
// объект { w:0, x:1, … }. Печать расставляет скобки по приоритету КИМ:
// ¬ выше /\ выше \/ выше → выше ≡.
const V = (v) => ({ t: "v", v })
const NOT = (a) => ({ t: "¬", a })
const AND = (a, b) => ({ t: "∧", a, b })
const OR = (a, b) => ({ t: "∨", a, b })
const IMP = (a, b) => ({ t: "→", a, b })
const EQV = (a, b) => ({ t: "≡", a, b })

const evalNode = (n, env) => {
  switch (n.t) {
    case "v": return env[n.v] ? 1 : 0
    case "¬": return evalNode(n.a, env) ? 0 : 1
    case "∧": return evalNode(n.a, env) && evalNode(n.b, env) ? 1 : 0
    case "∨": return evalNode(n.a, env) || evalNode(n.b, env) ? 1 : 0
    case "→": return !evalNode(n.a, env) || evalNode(n.b, env) ? 1 : 0
    case "≡": return evalNode(n.a, env) === evalNode(n.b, env) ? 1 : 0
    default: return 0
  }
}

const PREC = { "≡": 1, "→": 2, "∨": 3, "∧": 4, "¬": 5, v: 6 }
const OPSTR = { "∧": " /\\ ", "∨": " \\/ ", "→": " → ", "≡": " ≡ " }
function fmt(n, parentPrec = 0) {
  if (n.t === "v") return n.v
  if (n.t === "¬") {
    const inner = fmt(n.a, PREC["¬"])
    return `¬${n.a.t === "v" ? inner : `(${fmt(n.a, 0)})`}`
  }
  const p = PREC[n.t]
  // Импликация ПРАВОассоциативна (a → b → c ≡ a → (b → c)), поэтому левый операнд
  // той же силы обязан быть в скобках: ((w → y) → x) нельзя печатать как w → y → x.
  const left = fmt(n.a, n.t === "→" ? p + 1 : p)
  const s = `${left}${OPSTR[n.t]}${fmt(n.b, p)}`
  return p < parentPrec ? `(${s})` : s
}
const formula = (n) => fmt(n, 0)

// Все 2^k наборов значений для списка переменных.
function allEnvs(vars) {
  const out = []
  for (let m = 0; m < (1 << vars.length); m++) {
    const env = {}
    vars.forEach((v, i) => { env[v] = (m >> (vars.length - 1 - i)) & 1 })
    out.push(env)
  }
  return out
}

// Перестановки массива (для 4 переменных — 24 штуки).
function perms(arr) {
  if (arr.length <= 1) return [arr]
  const out = []
  arr.forEach((x, i) => {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1))
    perms(rest).forEach((p) => out.push([x, ...p]))
  })
  return out
}

// ── №02 «Построение таблиц истинности логических выражений» ──────────────────
// Эталон (108 задач банка) даёт три типажа:
//   misha   94 — фрагмент из ТРЁХ строк с пропусками, столбцы не подписаны;
//   allrows 10 — фрагмент содержит ВСЕ наборы, при которых F ложна (истинна);
//   choose   4 — три переменные, дан фрагмент, выбрать выражение из четырёх.
// В первых двух ответ — порядок букв w, x, y, z по столбцам; единственность
// решения проверяется перебором всех 24 перестановок (иначе задача некорректна).

// Структурные семейства формул ФИПИ. Каждое — функция от четырёх букв (роли a, b, c, d)
// и от «шумовых» отрицаний ng(i, node): бит i включает ¬ над узлом. Роли повторяют
// реальные формулы банка, включая случаи, где одна переменная входит дважды.
const T2_FORMS = [
  // (x /\ ¬y) \/ (y ≡ z) \/ w   — конъюнкция, эквиваленция, свободная переменная
  ([a, b, c, d], g) => OR(OR(AND(g(0, V(a)), g(1, V(b))), EQV(V(b), V(c))), g(2, V(d))),
  // (x \/ ¬y) /\ ¬(y ≡ z) /\ ¬w
  ([a, b, c, d], g) => AND(AND(OR(g(0, V(a)), g(1, V(b))), NOT(EQV(V(b), V(c)))), g(2, V(d))),
  // (x /\ ¬y) \/ (x ≡ z) \/ w   — повторяется первая переменная
  ([a, b, c, d], g) => OR(OR(AND(g(0, V(a)), g(1, V(b))), EQV(V(a), V(c))), g(2, V(d))),
  // ((w → y) → x) \/ ¬z
  ([a, b, c, d], g) => OR(IMP(IMP(V(a), V(b)), V(c)), g(0, V(d))),
  // ((w → y) → (x ≡ y)) \/ ¬z
  ([a, b, c, d], g) => OR(IMP(IMP(V(a), V(b)), EQV(V(c), V(b))), g(0, V(d))),
  // ((w ≡ ¬x) → ¬(z → w)) \/ ¬y
  ([a, b, c, d], g) => OR(IMP(EQV(V(a), g(0, V(b))), NOT(IMP(V(c), V(a)))), g(1, V(d))),
  // ¬(w → x) \/ (y → z) \/ ¬y
  ([a, b, c, d], g) => OR(OR(NOT(IMP(V(a), V(b))), IMP(V(c), V(d))), g(0, V(c))),
  // ¬(w → x) \/ (y ≡ z) \/ y
  ([a, b, c, d], g) => OR(OR(NOT(IMP(V(a), V(b))), EQV(V(c), V(d))), g(0, V(c))),
  // ¬(w → (x ≡ y)) /\ (z → y)
  ([a, b, c, d], g) => AND(NOT(IMP(V(a), EQV(V(b), V(c)))), IMP(V(d), g(0, V(c)))),
  // (z → (x ≡ y)) \/ ¬(w → x)
  ([a, b, c, d]) => OR(IMP(V(d), EQV(V(b), V(c))), NOT(IMP(V(a), V(b)))),
  // (x → y) \/ ¬(w → z)
  ([a, b, c, d], g) => OR(IMP(g(0, V(a)), V(b)), NOT(IMP(V(c), V(d)))),
  // ¬x \/ y \/ (¬z /\ w)
  ([a, b, c, d]) => OR(OR(NOT(V(a)), V(b)), AND(NOT(V(c)), V(d))),
  // (x → y) \/ ¬(¬z \/ w)
  ([a, b, c, d]) => OR(IMP(V(a), V(b)), NOT(OR(NOT(V(c)), V(d)))),
  // ¬((x → w) → (w ≡ z)) /\ y
  ([a, b, c, d], g) => AND(NOT(IMP(IMP(V(a), V(b)), EQV(V(b), V(c)))), g(0, V(d))),
  // ((x ≡ ¬y) → ¬(w → x)) \/ ¬z
  ([a, b, c, d], g) => OR(IMP(EQV(V(a), NOT(V(b))), NOT(IMP(V(c), V(a)))), g(0, V(d))),
]

const T2_VARS = ["w", "x", "y", "z"]

// Случайная формула от w, x, y, z: шаблон + случайное назначение букв на роли +
// случайные отрицания. Возвращает { node, text }.
function t2Formula() {
  const form = pick(T2_FORMS)
  const roles = shuffle(T2_VARS)
  const bits = randInt(0, 7)
  const g = (i, node) => ((bits >> i) & 1 ? NOT(node) : node)
  const node = form(roles, g)
  return { node, text: formula(node) }
}

// Наборы значений (как массивы по порядку w, x, y, z) с заданным значением F.
function t2Rows(node, target) {
  return allEnvs(T2_VARS)
    .filter((e) => evalNode(node, e) === target)
    .map((e) => T2_VARS.map((v) => e[v]))
}

// Совместим ли набор row (значения по переменным в порядке T2_VARS) с показанной
// строкой cells при раскладке столбцов perm (perm[j] — переменная j-го столбца)?
function t2Fits(cells, row, perm) {
  return cells.every((c, j) => c === null || row[T2_VARS.indexOf(perm[j])] === c)
}

// Есть ли для раскладки perm выбор трёх ПОПАРНО РАЗНЫХ наборов из rows,
// согласованный с показанными ячейками? (Каждая строка фрагмента — своя строка таблицы.)
function t2Solvable(cellRows, rows, perm) {
  const cand = cellRows.map((cells) => rows.filter((r) => t2Fits(cells, r, perm)))
  const used = []
  const rec = (i) => {
    if (i === cand.length) return true
    for (const r of cand[i]) {
      const key = r.join("")
      if (used.includes(key)) continue
      used.push(key)
      if (rec(i + 1)) { used.pop(); return true }
      used.pop()
    }
    return false
  }
  return rec(0)
}

// Сколько раскладок столбцов допускает фрагмент (нужна ровно одна).
function t2CountSolutions(cellRows, rows, allPerms) {
  let n = 0
  for (const p of allPerms) if (t2Solvable(cellRows, rows, p)) { n++; if (n > 1) return n }
  return n
}

const T2_TAIL =
  "В ответе напишите буквы w, x, y, z в том порядке, в котором идут соответствующие им столбцы " +
  "(сначала — буква, соответствующая первому столбцу; затем — буква, соответствующая второму столбцу, и т.д.). " +
  "Буквы в ответе пишите подряд, никаких разделителей между буквами ставить не нужно."

const T2_EXAMPLE =
  "Пример. Функция задана выражением ¬x \\/ y, зависящим от двух переменных, а фрагмент таблицы имеет следующий вид.\n" +
  tableBlock([["", "", "F"], ["0", "1", "0"]]) + "\n" +
  "В этом случае первому столбцу соответствует переменная y, а второму столбцу — переменная x. В ответе следует написать: yx."

// Типаж «Миша»: фрагмент из трёх строк, часть значений стёрта.
export function t2Misha() {
  const allPerms = perms(T2_VARS)
  for (let attempt = 0; attempt < 200; attempt++) {
    const { node, text } = t2Formula()
    const target = Math.random() < 0.66 ? 0 : 1
    const rows = t2Rows(node, target)
    if (rows.length < 3 || rows.length > 6) continue          // много строк → фрагмент пришлось бы почти не стирать
    const perm = shuffle(T2_VARS)                              // истинная раскладка столбцов
    const chosen = shuffle(rows).slice(0, 3)
    // Полная матрица фрагмента: столбец j показывает значение переменной perm[j].
    let cellRows = chosen.map((r) => perm.map((v) => r[T2_VARS.indexOf(v)]))
    if (t2CountSolutions(cellRows, rows, allPerms) !== 1) continue   // даже полная не различает
    // Жадно стираем ячейки, пока решение остаётся единственным (как в банке — видно 4–6 значений из 12).
    const cells = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    for (const c of cells) {
      const i = Math.floor(c / 4), j = c % 4
      const keep = cellRows[i][j]
      cellRows[i][j] = null
      if (t2CountSolutions(cellRows, rows, allPerms) !== 1) cellRows[i][j] = keep
    }
    const shown = cellRows.filter((r) => r.some((c) => c !== null)).length
    if (shown < 3) continue                                    // строка без единого значения — вырождение
    const table = tableBlock([
      ["", "", "", "", "F"],
      ...cellRows.map((r) => [...r.map((c) => (c === null ? "" : String(c))), String(target)]),
    ])
    return {
      condition_text:
        `Миша заполнял таблицу истинности логической функции F\n${text},\n` +
        "но успел заполнить лишь фрагмент из трёх различных её строк, даже не указав, какому столбцу " +
        "таблицы соответствует каждая из переменных w, x, y, z.\n" +
        table + "\n" +
        "Определите, какому столбцу таблицы соответствует каждая из переменных w, x, y, z.\n" +
        T2_TAIL + "\n" + T2_EXAMPLE,
      answer: perm.join(""),
    }
  }
  return null
}

// Типаж «все наборы, при которых F ложна (истинна)»: значения показаны полностью,
// но столбцы не подписаны; строк ровно столько, сколько нулей (единиц) у функции.
export function t2AllRows() {
  const allPerms = perms(T2_VARS)
  for (let attempt = 0; attempt < 200; attempt++) {
    const { node, text } = t2Formula()
    const target = Math.random() < 0.7 ? 0 : 1
    const rows = t2Rows(node, target)
    if (rows.length < 3 || rows.length > 5) continue
    const perm = shuffle(T2_VARS)
    const cellRows = shuffle(rows).map((r) => perm.map((v) => r[T2_VARS.indexOf(v)]))
    if (t2CountSolutions(cellRows, rows, allPerms) !== 1) continue
    const word = target === 0 ? "ложна" : "истинна"
    const table = tableBlock([
      ["Переменная 1", "Переменная 2", "Переменная 3", "Переменная 4", "Функция F"],
      ...cellRows.map((r) => r.map(String).concat(String(target))),
    ])
    return {
      condition_text:
        `Логическая функция F задаётся выражением\n${text}.\n` +
        `На рисунке приведён фрагмент таблицы истинности функции F, содержащий все наборы аргументов, при которых функция F ${word}.\n` +
        "Определите, какому столбцу таблицы истинности функции F соответствует каждая из переменных w, x, y, z.\n" +
        table + "\n" + T2_TAIL,
      answer: perm.join(""),
    }
  }
  return null
}

// Типаж старого формата: три переменные X, Y, Z, дан фрагмент таблицы —
// выбрать из четырёх выражений то, которому фрагмент соответствует.
const T3VARS = ["X", "Y", "Z"]
function t2Expr3() {
  const [a, b, c] = shuffle(T3VARS)
  const kind = randInt(0, 3)
  const n = (v) => (Math.random() < 0.5 ? NOT(V(v)) : V(v))
  if (kind === 0) return OR(OR(n(a), n(b)), n(c))
  if (kind === 1) return AND(AND(n(a), n(b)), n(c))
  if (kind === 2) return OR(AND(n(a), n(b)), n(c))
  return AND(OR(n(a), n(b)), n(c))
}

export function t2ChooseExpr() {
  for (let attempt = 0; attempt < 300; attempt++) {
    const right = t2Expr3()
    const envs = allEnvs(T3VARS)
    const sig = (node) => envs.map((e) => evalNode(node, e)).join("")
    const rightSig = sig(right)
    if (rightSig === "00000000" || rightSig === "11111111") continue
    // Фрагмент из трёх строк таблицы истинности правильного выражения.
    const rowsIdx = shuffle(envs.map((_, i) => i)).slice(0, 3).sort((p, q) => p - q)
    const frag = rowsIdx.map((i) => ({ e: envs[i], f: rightSig[i] }))
    // Три отвлекающих выражения, каждое обязано противоречить хотя бы одной строке фрагмента.
    const wrong = []
    for (let k = 0; k < 400 && wrong.length < 3; k++) {
      const w = t2Expr3()
      const ws = sig(w)
      if (ws === rightSig || wrong.some((x) => sig(x) === ws)) continue
      const conflicts = rowsIdx.some((i) => ws[i] !== rightSig[i])
      if (conflicts) wrong.push(w)
    }
    if (wrong.length < 3) continue
    const options = shuffle([right, ...wrong])
    const answer = String(options.indexOf(right) + 1)
    return {
      condition_text:
        "Символом F обозначено одно из указанных ниже логических выражений от трёх аргументов: X, Y, Z.\n" +
        "Дан фрагмент таблицы истинности выражения F:\n" +
        tableBlock([
          ["X", "Y", "Z", "F"],
          ...frag.map(({ e, f }) => [String(e.X), String(e.Y), String(e.Z), String(f)]),
        ]) + "\n" +
        "Какое выражение соответствует F?\n" +
        tableBlock([["№", "Выражение"], ...options.map((o, i) => [`${i + 1})`, formula(o)])]) + "\n" +
        "В ответе укажите номер выражения.",
      answer,
    }
  }
  return null
}


// ── №05 «Анализ и построение алгоритмов для исполнителей» ────────────────────
// Эталон (77 задач) — четыре механизма:
//   bin      41 — правило дописывает разряды к ДВОИЧНОЙ записи N (ветви по чётности / делимости на 3);
//   parity   17 — контроль чётности: справа дописывается остаток суммы цифр на 2 (иногда дважды);
//   ternary   8 — то же самое, но запись ТРОИЧНАЯ (остаток × 5 → троичная запись);
//   calc      4 — исполнитель Калькулятор/Квадратор: собрать программу из двух команд;
//   automat   2 — автомат над трёхзначным числом (произведения соседних цифр).
// Вопрос всегда один из четырёх: мин./макс. R с порогом либо мин./макс. N по условию на R.
// Ответ ищется перебором N до N_MAX — так же, как его находит ученик, только машинно.

const bin = (n) => n.toString(2)
const ter = (n) => n.toString(3)
const sub2 = (b) => `⟦b:${b}⟧`
const digsum = (s) => [...s].reduce((a, c) => a + Number(c), 0)

// Правила над двоичной записью: text — как в КИМ, apply — что делает алгоритм.
const T5_BIN_RULES = [
  { text: "а) если число N чётное, то к этой записи справа и слева дописываются по две единицы;\n" +
      "б) если число N нечётное, то в конец двоичной записи (справа) дописываются два нуля, а в начало (слева) дописывается единица.",
    note: "(в ней на три или четыре разряда больше, чем в записи исходного числа N)",
    apply: (n) => (n % 2 === 0 ? `11${bin(n)}11` : `1${bin(n)}00`) },
  { text: "а) если число N чётное, то к этой записи справа дописываются два нуля;\n" +
      "б) если число N нечётное, то к этой записи справа дописываются две единицы.",
    note: "(в ней на два разряда больше, чем в записи исходного числа N)",
    apply: (n) => `${bin(n)}${n % 2 === 0 ? "00" : "11"}` },
  { text: "если N чётное, в конец числа (справа) дописывается сначала ноль, а затем единица. " +
      "В противном случае, если N нечётное, справа дописывается сначала единица, а затем ноль.",
    note: "(в ней на два разряда больше, чем в записи исходного числа N)",
    apply: (n) => `${bin(n)}${n % 2 === 0 ? "01" : "10"}` },
  { text: "а) если число N чётное, то к двоичной записи числа слева дописывается 10;\n" +
      "б) если число N нечётное, то к двоичной записи числа слева дописывается 1 и справа дописывается 01.",
    note: "",
    apply: (n) => (n % 2 === 0 ? `10${bin(n)}` : `1${bin(n)}01`) },
  { text: "если N чётное, то в конец числа (справа) дописывается нуль, а в начало числа (слева) дописывается единица; " +
      "если N нечётное, то в конец числа (справа) и в начало числа (слева) дописываются по две единицы.",
    note: "(в ней на два или четыре разряда больше, чем в записи исходного числа N)",
    apply: (n) => (n % 2 === 0 ? `1${bin(n)}0` : `11${bin(n)}11`) },
  { text: "а) если N чётное, то к нему справа приписываются два нуля, а слева единица;\n" +
      "б) если N нечётное, то к нему справа приписывается в двоичном виде сумма цифр его двоичной записи.",
    note: "(в ней как минимум на один разряд больше, чем в записи исходного числа N)",
    apply: (n) => (n % 2 === 0 ? `1${bin(n)}00` : `${bin(n)}${bin(digsum(bin(n)))}`) },
  { text: "а) если число N делится на 3, то к этой записи дописываются три последние двоичные цифры;\n" +
      "б) если число N на 3 не делится, то остаток от деления умножается на 3, переводится в двоичную запись\nи дописывается в конец числа.",
    note: "",
    apply: (n) => (n % 3 === 0 ? `${bin(n)}${bin(n).slice(-3)}` : `${bin(n)}${bin((n % 3) * 3)}`) },
]

// Контроль чётности — отдельное семейство: дописываемый разряд считается по сумме цифр.
const T5_PARITY_RULES = [
  { intro: "2. К этой записи дописываются справа ещё два разряда по следующему правилу:\n" +
      "а) складываются все цифры двоичной записи числа N, и остаток от деления суммы на 2 дописывается в конец числа (справа). " +
      "Например, запись 11100 преобразуется в запись 111001;\n" +
      "б) над этой записью производятся те же действия — справа дописывается остаток от деления суммы её цифр на 2.",
    note: "(в ней на два разряда больше, чем в записи исходного числа N)",
    apply: (n) => { let s = bin(n); s += digsum(s) % 2; s += digsum(s) % 2; return s } },
  { intro: "2. Далее эта запись обрабатывается по следующему правилу:\n" +
      "а) если сумма цифр в двоичной записи числа чётная, то к этой записи справа дописывается 0, а затем два левых разряда заменяются на 10;\n" +
      "б) если сумма цифр в двоичной записи числа нечётная, то к этой записи справа дописывается 1, а затем два левых разряда заменяются на 11.",
    note: "",
    apply: (n) => { const s = bin(n); const even = digsum(s) % 2 === 0; const t = s + (even ? "0" : "1"); return (even ? "10" : "11") + t.slice(2) } },
]

const T5_TER_RULES = [
  { text: "а) если число N делится на 3, то к этой записи дописываются две последние троичные цифры;\n" +
      "б) если число N на 3 не делится, то остаток от деления умножается на 5, переводится в троичную запись\nи дописывается в конец числа.",
    apply: (n) => (n % 3 === 0 ? `${ter(n)}${ter(n).slice(-2)}` : `${ter(n)}${ter((n % 3) * 5)}`) },
  { text: "а) если число N делится на 3, то слева к нему приписывается «1», а справа «02»;\n" +
      "б) если число N на 3 не делится, то остаток от деления на 3 умножается на 5, переводится в троичную запись и дописывается в конец числа.",
    apply: (n) => (n % 3 === 0 ? `1${ter(n)}02` : `${ter(n)}${ter((n % 3) * 5)}`) },
]

const T5_NMAX = 4000

// Вопрос и ответ по таблице R(N). Возвращает { text, answer } либо null, если ответа нет.
function t5Question(R) {
  const values = R.map((r, n) => ({ n, r })).slice(1)
  const kind = randInt(0, 3)
  const rs = [...new Set(values.map((v) => v.r))].sort((a, b) => a - b)
  // Порог берём НЕ из множества значений R: иначе «наибольшее R, не превышающее M»
  // давало бы ответом сам порог — у ФИПИ пороги всегда «мимо» достижимых значений.
  let M = null
  for (let k = 0; k < 200 && M === null; k++) {
    const cand = randInt(45, 900)
    if (!rs.includes(cand)) M = cand
  }
  if (M === null) return null
  if (kind === 0) {                       // минимальное R, превышающее M
    const cand = rs.filter((r) => r > M)
    if (!cand.length) return null
    return { text: `Укажите минимальное число R, которое превышает число ${M} и может являться результатом работы данного алгоритма.\nВ ответе это число запишите в десятичной системе счисления.`, answer: String(cand[0]) }
  }
  if (kind === 1) {                       // максимальное R, не превышающее M
    const cand = rs.filter((r) => r <= M)
    if (!cand.length) return null
    return { text: `Укажите наибольшее число R, не превышающее ${M}, которое может быть результатом работы данного алгоритма.\nВ ответе запишите это число в десятичной системе счисления.`, answer: String(cand[cand.length - 1]) }
  }
  if (kind === 2) {                       // минимальное N, дающее R ≥ M
    const cand = values.filter((v) => v.r >= M)
    if (!cand.length) return null
    return { text: `Укажите минимальное число N, после обработки которого с помощью этого алгоритма получается число R, не меньшее ${M}.\nВ ответе запишите это число в десятичной системе счисления.`, answer: String(Math.min(...cand.map((v) => v.n))) }
  }
  const cand = values.filter((v) => v.r < M)   // максимальное N, дающее R < M
  if (!cand.length) return null
  return { text: `Укажите максимальное число N, после обработки которого с помощью этого алгоритма получается число R, меньшее ${M}.\nВ ответе запишите это число в десятичной системе счисления.`, answer: String(Math.max(...cand.map((v) => v.n))) }
}

// Общая сборка условия для правил над записью в системе base.
function t5Build({ head, rule, note, apply, base }) {
  const R = [0]
  for (let n = 1; n <= T5_NMAX; n++) R.push(parseInt(apply(n), base))
  const q = t5Question(R)
  if (!q) return null
  // Два примера — обязательно из РАЗНЫХ ветвей правила (как в банке).
  const small = []
  for (let n = 4; n <= 15; n++) small.push(n)
  const a = pick(small.filter((n) => (base === 2 ? n % 2 === 0 : n % 3 === 0)))
  const b = pick(small.filter((n) => (base === 2 ? n % 2 === 1 : n % 3 !== 0)))
  const ex = (n) => `${n}${sub2(10)} = ${base === 2 ? bin(n) : ter(n)}${sub2(base)} результатом является число ${apply(n)}${sub2(base)} = ${parseInt(apply(n), base)}${sub2(10)}`
  const sysName = base === 2 ? "двоичная" : "троичная"
  return {
    condition_text:
      "На вход алгоритма подаётся натуральное число N. Алгоритм строит по нему новое число R следующим образом.\n" +
      `1. Строится ${sysName === "двоичная" ? "двоичная" : "троичная"} запись числа N.\n` +
      (head ? head + "\n" : "") +
      rule + "\n" +
      `Полученная таким образом запись ${note ? note + " " : ""}является ${base === 2 ? "двоичной" : "троичной"} записью искомого числа R.\n` +
      "3. Результат переводится в десятичную систему и выводится на экран.\n" +
      `Например, для исходного числа ${ex(a)}, а для исходного числа ${ex(b)}.\n` +
      q.text,
    answer: q.answer,
  }
}

export function t5Bin() {
  for (let k = 0; k < 40; k++) {
    const r = pick(T5_BIN_RULES)
    const t = t5Build({ head: "2. Далее эта запись обрабатывается по следующему правилу:", rule: r.text, note: r.note, apply: r.apply, base: 2 })
    if (t) return t
  }
  return null
}

export function t5Parity() {
  for (let k = 0; k < 40; k++) {
    const r = pick(T5_PARITY_RULES)
    const t = t5Build({ head: "", rule: r.intro, note: r.note, apply: r.apply, base: 2 })
    if (t) return t
  }
  return null
}

export function t5Ternary() {
  for (let k = 0; k < 40; k++) {
    const r = pick(T5_TER_RULES)
    const t = t5Build({ head: "2. Далее эта запись обрабатывается по следующему правилу:", rule: r.text, note: "", apply: r.apply, base: 3 })
    if (t) return t
  }
  return null
}

// Исполнитель с двумя командами: найти программу из ≤ k команд, переводящую a в b.
const T5_EXECUTORS = [
  { name: "Калькулятор", c1: ["прибавь 2", (x) => x + 2], c2: ["умножь на 5", (x) => x * 5],
    desc: () => `Выполняя первую из них, Калькулятор прибавляет к числу на экране 2, а выполняя вторую, умножает его на 5.` },
  { name: "Калькулятор", c1: ["прибавь 3", (x) => x + 3], c2: ["умножь на 4", (x) => x * 4],
    desc: () => "Выполняя первую из них, Калькулятор прибавляет к числу на экране 3, а выполняя вторую, умножает его на 4." },
  { name: "Квадратор", c1: ["возведи в квадрат", (x) => x * x], c2: ["прибавь 1", (x) => x + 1],
    desc: () => "Первая из них возводит число на экране в квадрат, вторая — увеличивает его на 1." },
  { name: "Удвоитель", c1: ["прибавь 1", (x) => x + 1], c2: ["умножь на 2", (x) => x * 2],
    desc: () => "Первая из них увеличивает число на экране на 1, вторая — удваивает его." },
]

export function t5Calc() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const ex = pick(T5_EXECUTORS)
    const start = randInt(1, 3)
    const len = randInt(3, 5)                      // длина программы-цели
    // Все результаты программ длиной ≤ len; ищем цель, достижимую РОВНО за len команд.
    // Все программы длиной ≤ len: значение → список программ. Цель берём такую,
    // для которой программа РОВНО одна, — тогда ответ проверяется автоматически
    // (формулировка «запишите любую» у ФИПИ на автопроверку не рассчитана).
    const reach = new Map()
    let frontier = [[start, ""]]
    for (let step = 1; step <= len; step++) {
      const next = []
      for (const [val, prog] of frontier) {
        for (const [num, cmd] of [[1, ex.c1], [2, ex.c2]]) {
          const v = cmd[1](val)
          if (v > 10000) continue
          const p = prog + num
          next.push([v, p])
          if (!reach.has(v)) reach.set(v, [])
          reach.get(v).push(p)
        }
      }
      frontier = next
    }
    const targets = [...reach.entries()].filter(([v, ps]) => ps.length === 1 && ps[0].length === len && v > start + 5 && v < 1000)
    if (!targets.length) continue
    const [target, progs] = pick(targets)
    const prog = progs[0]
    const demoEntry = pick([...reach.entries()].filter(([v, ps]) => v !== target && ps.some((p) => p.length === 4)))
    if (!demoEntry) continue
    const demo = [demoEntry[0], demoEntry[1].find((p) => p.length === 4)]
    return {
      condition_text:
        `У исполнителя ${ex.name} две команды, которым присвоены номера:\n` +
        `1. ${ex.c1[0]},\n2. ${ex.c2[0]}.\n` +
        ex.desc() + "\n" +
        `Например, программа ${demo[1]} — это программа\n` +
        demo[1].split("").map((d) => (d === "1" ? ex.c1[0] : ex.c2[0])).join(",\n") + ",\n" +
        `которая преобразует число ${start} в число ${demo[0]}.\n` +
        `Запишите порядок команд в программе, которая преобразует число ${start} в число ${target} и содержит не более ${NUMW_GEN[len]} команд. ` +
        "Указывайте лишь номера команд. Если таких программ более одной, то запишите любую из них.",
      answer: prog,
    }
  }
  return null
}

// Автомат над трёхзначным числом: произведения соседних цифр, записанные по неубыванию.
export function t5Automat() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const build = (n) => {
      const d = String(n).split("").map(Number)
      const p = [d[0] * d[1], d[1] * d[2]].sort((a, b) => a - b)
      return `${p[0]}${p[1]}`
    }
    const all = []
    for (let n = 100; n <= 999; n++) all.push([n, build(n)])
    const target = pick(all)[1]
    const src = all.filter(([, r]) => r === target).map(([n]) => n)
    if (src.length < 2) continue                    // ответ должен быть «наименьшим из нескольких»
    const demoN = pick(all.map(([n]) => n).filter((n) => String(n).indexOf("0") < 0))
    const d = String(demoN).split("").map(Number)
    const kind = pick(["наименьшее", "наибольшее"])
    return {
      condition_text:
        "Автомат получает на вход трёхзначное число. По этому числу строится новое число по следующим правилам.\n" +
        "1. Перемножаются первая и вторая, а также вторая и третья цифры исходного числа.\n" +
        "2. Полученные два числа записываются друг за другом в порядке неубывания (без разделителей).\n" +
        `Пример. Исходное число: ${demoN}. Произведения: ${d[0]} × ${d[1]} = ${d[0] * d[1]}; ${d[1]} × ${d[2]} = ${d[1] * d[2]}. Результат: ${build(demoN)}.\n` +
        `Укажите ${kind} число, при обработке которого автомат выдаст число ${target}.`,
      answer: String(kind === "наименьшее" ? Math.min(...src) : Math.max(...src)),
    }
  }
  return null
}


// ── №04 «Кодирование и декодирование информации» (условие Фано) ──────────────
// Эталон (76 задач) — четыре механики:
//   shortest 30 — дана таблица кодов, для одной буквы код неизвестен: найти кратчайший
//                 (при равной длине — с наименьшим числовым значением);
//   sumlen   23 — известны коды части букв: наименьшая суммарная длина кодов остальных;
//   word     12 — известны коды двух букв: сколько двоичных знаков займёт слово при
//                 минимально возможном кодировании (это Хаффман поверх занятых кодов);
//   colors    4 — та же «shortest», но про цвета растрового рисунка.
// Всё считается на двоичном дереве: код допустим, если ни он не начинается с чужого
// кодового слова, ни чужое — с него (условие Фано = префиксный код).

// Числительные прописью — ФИПИ в условиях пишет «восемь букв», а не «8 букв».
const NUMW = { 2: "две", 3: "три", 4: "четыре", 5: "пять", 6: "шесть", 7: "семь", 8: "восемь", 9: "девять", 10: "десять" }
const NUMW_GEN = { 1: "одной", 2: "двух", 3: "трёх", 4: "четырёх", 5: "пяти", 6: "шести", 7: "семи", 8: "восьми", 9: "девяти", 10: "десяти" }

const T4_FANO_NOTE =
  "Примечание. Условие Фано означает, что никакое кодовое слово не является началом другого кодового слова. " +
  "Это обеспечивает возможность однозначной расшифровки закодированных сообщений."

const prefixFree = (a, b) => !a.startsWith(b) && !b.startsWith(a)
const fitsAll = (code, codes) => codes.every((c) => prefixFree(code, c))

// Случайный префиксный код на n букв: рекурсивно делим двоичное дерево.
function randomPrefixCode(n, prefix = "", depth = 0) {
  if (n === 1) return [prefix]
  if (depth > 5) return null
  const k = randInt(1, n - 1)
  const left = randomPrefixCode(k, prefix + "0", depth + 1)
  const right = randomPrefixCode(n - k, prefix + "1", depth + 1)
  if (!left || !right) return null
  return [...left, ...right]
}

// Кратчайший свободный код; при равной длине — с наименьшим (или наибольшим,
// такая формулировка в банке тоже есть) числовым значением.
function shortestFreeCode(codes, maxLen = 8, largest = false) {
  for (let len = 1; len <= maxLen; len++) {
    const fit = []
    for (let v = 0; v < (1 << len); v++) {
      const w = v.toString(2).padStart(len, "0")
      if (fitsAll(w, codes)) fit.push(w)
    }
    if (fit.length) return largest ? fit[fit.length - 1] : fit[0]
  }
  return null
}

// Минимальная суммарная стоимость Σ freq[i]·len(code[i]) для m новых букв поверх
// занятых кодов. Перебор с отсечением по узлам дерева до глубины maxLen.
function minCodeCost(codes, freqs, maxLen = 7) {
  const nodes = []
  for (let len = 1; len <= maxLen; len++)
    for (let v = 0; v < (1 << len); v++) {
      const w = v.toString(2).padStart(len, "0")
      if (fitsAll(w, codes)) nodes.push(w)
    }
  nodes.sort((a, b) => a.length - b.length)
  const f = [...freqs].sort((a, b) => b - a)          // тяжёлые буквы — первыми
  let best = Infinity
  const rec = (i, used, cost) => {
    if (cost >= best) return
    if (i === f.length) { best = cost; return }
    for (const w of nodes) {
      if (!used.every((u) => prefixFree(u, w))) continue
      used.push(w)
      rec(i + 1, used, cost + f[i] * w.length)
      used.pop()
    }
  }
  rec(0, [], 0)
  return best
}

const T4_RU = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К"]
const T4_LAT = ["A", "B", "C", "D", "E", "F", "S", "X", "Y", "Z"]
const T4_COLORS = ["белый", "жёлтый", "зелёный", "красный", "синий", "чёрный", "оранжевый", "фиолетовый"]

// Типаж «кратчайшее кодовое слово для буквы X». Таблица — двумя колонками, как в банке.
function t4ShortestBase({ items, kindWord, tail }) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const n = items.length
    const codes = randomPrefixCode(n)
    if (!codes) continue
    const hideIdx = randInt(0, n - 1)
    const known = codes.filter((_, i) => i !== hideIdx)
    const largest = Math.random() < 0.35
    const answer = shortestFreeCode(known, 8, largest)
    if (!answer || answer.length > 5) continue
    const rows = items.map((letter, i) => [letter, i === hideIdx ? "" : codes[i]])
    // Двухколоночная вёрстка таблицы (как в оригинале), если букв больше пяти.
    const half = Math.ceil(rows.length / 2)
    const table = rows.length > 5
      ? tableBlock([[kindWord, "Кодовое слово", "", kindWord, "Кодовое слово"],
        ...Array.from({ length: half }, (_, i) => {
          const a = rows[i], b = rows[i + half]
          return [a[0], a[1], "", b ? b[0] : "", b ? b[1] : ""]
        })])
      : tableBlock([[kindWord, "Кодовое слово"], ...rows])
    return { table, hidden: items[hideIdx], answer, tail, largest,
      knownList: items.map((l, i) => [l, codes[i]]).filter((_, i) => i !== hideIdx) }
  }
  return null
}

export function t4FanoShortest() {
  const letters = shuffle(Math.random() < 0.5 ? T4_LAT : T4_RU).slice(0, randInt(5, 8)).sort()
  const built = t4ShortestBase({ items: letters, kindWord: "Буква" })
  if (!built) return null
  // В банке коды подаются двумя способами: таблицей и перечислением прямо в тексте.
  // Перечисление возможно, когда неизвестен код последней буквы — иначе порядок путается.
  const inline = built.knownList.length <= 4 && Math.random() < 0.45
  const head = inline
    ? `Для кодирования некоторой последовательности, состоящей из букв ${letters.join(", ")}, решили использовать ` +
      "неравномерный двоичный код, удовлетворяющий условию Фано. " +
      `Для букв ${built.knownList.map(([l]) => l).join(", ")} использовали кодовые слова ` +
      `${built.knownList.map(([, c]) => c).join(", ")} соответственно.\n`
    : `По каналу связи передаются шифрованные сообщения, содержащие только ${NUMW[letters.length]} букв: ` +
      `${letters.join(", ")}; для передачи используется неравномерный двоичный код. Для кодирования букв используются кодовые слова.\n` +
      built.table + "\n"
  return {
    condition_text: head +
      `Укажите кратчайшее ${inline ? "возможное " : ""}кодовое слово для буквы ${built.hidden}, при котором код ` +
      `${inline ? "будет удовлетворять" : "удовлетворяет"} условию Фано. ` +
      `Если таких кодов несколько, укажите код с ${built.largest ? "наибольшим" : "наименьшим"} числовым значением.\n` + T4_FANO_NOTE,
    answer: built.answer,
  }
}

export function t4FanoColors() {
  const colors = shuffle(T4_COLORS).slice(0, randInt(5, 6))
  const built = t4ShortestBase({ items: colors, kindWord: "Цвет" })
  if (!built) return null
  return {
    condition_text:
      `Для кодирования растрового рисунка, напечатанного с использованием ${NUMW_GEN[colors.length]} красок, применили неравномерный двоичный код. ` +
      "Для кодирования цветов используются кодовые слова.\n" +
      built.table + "\n" +
      `Укажите кратчайшее кодовое слово для ${built.hidden === "белый" ? "белого" : built.hidden.replace(/ый$/, "ого").replace(/ий$/, "его")} цвета, при котором код будет удовлетворять условию Фано. ` +
      "Если таких кодов несколько, укажите код с наименьшим числовым значением.\n" + T4_FANO_NOTE,
    answer: built.answer,
  }
}

// Типаж «наименьшая суммарная длина кодовых слов для оставшихся букв».
export function t4FanoSumLen() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const n = randInt(5, 8)
    const letters = T4_RU.slice(0, n)
    const codes = randomPrefixCode(n)
    if (!codes) continue
    const hideCnt = randInt(2, 3)
    const hide = shuffle(letters.map((_, i) => i)).slice(0, hideCnt).sort((a, b) => a - b)
    const known = letters.map((l, i) => [l, codes[i]]).filter((_, i) => !hide.includes(i))
    if (known.length < 3) continue
    const answer = minCodeCost(known.map(([, c]) => c), hide.map(() => 1))
    if (!isFinite(answer)) continue
    const hidden = hide.map((i) => letters[i])
    return {
      condition_text: (known.length <= 3 && Math.random() < 0.5
        ? `По каналу связи передаются шифрованные сообщения, содержащие только ${NUMW[n]} букв: ${letters.join(", ")}. ` +
          "Для передачи используется неравномерный двоичный код. " +
          `Для букв ${known.map(([l]) => l).join(", ")} используются кодовые слова ${known.map(([, c]) => c).join(", ")} соответственно.\n` +
          `Укажите минимальную сумму длин кодовых слов для букв ${hidden.join(" и ")}, при которых код будет удовлетворять условию Фано.\n`
        : `По каналу связи передаются сообщения, содержащие только ${NUMW[n]} букв: ${letters.join(", ")}. ` +
          "Для передачи используется двоичный код, удовлетворяющий условию Фано. Кодовые слова для некоторых букв известны:\n" +
          tableBlock([["Буква", "Кодовое слово"], ...known.map(([l, c]) => [l, c])]) + "\n" +
          `Какое наименьшее количество двоичных знаков потребуется для кодирования ${NUMW_GEN[hidden.length]} оставшихся букв?\n` +
          `В ответе запишите суммарную длину кодовых слов для букв: ${hidden.join(", ")}.\n`) + T4_FANO_NOTE,
      answer: String(answer),
    }
  }
  return null
}

// Типаж «сколько двоичных знаков займёт слово»: частоты букв берутся из самого слова.
const T4_WORDS = ["БАРАБАН", "КАРАКАТИЦА", "БАНАН", "КАРАВАН", "САРАФАН", "ТАРАКАН", "МАКАКА", "БАРАБАНЩИК"]
export function t4FanoWord() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const word = pick(T4_WORDS)
    const letters = [...new Set([...word])]
    if (letters.length < 4 || letters.length > 6) continue
    const codes = randomPrefixCode(letters.length)
    if (!codes) continue
    const knownCnt = randInt(1, 2)
    const knownIdx = shuffle(letters.map((_, i) => i)).slice(0, knownCnt)
    const known = knownIdx.map((i) => [letters[i], codes[i]])
    if (known.some(([, c]) => c.length > 3)) continue
    const rest = letters.filter((_, i) => !knownIdx.includes(i))
    const freq = (ch) => [...word].filter((c) => c === ch).length
    const knownCost = known.reduce((a, [l, c]) => a + freq(l) * c.length, 0)
    const restCost = minCodeCost(known.map(([, c]) => c), rest.map(freq))
    if (!isFinite(restCost)) continue
    return {
      condition_text:
        `По каналу связи передаются сообщения, содержащие только буквы из набора: ${letters.join(", ")}. ` +
        "Для передачи используется двоичный код, удовлетворяющий условию Фано. " +
        "Это условие обеспечивает возможность однозначной расшифровки закодированных сообщений. " +
        `Кодовые слова для некоторых букв известны: ${known.map(([l, c]) => `${l} – ${c}`).join(", ")}. ` +
        `Для ${NUMW_GEN[rest.length] || "остальных"} оставшихся букв ${rest.join(", ")} кодовые слова неизвестны. ` +
        `Какое количество двоичных знаков потребуется для кодирования слова ${word}, если известно, что оно закодировано минимально возможным количеством двоичных знаков?`,
      answer: String(knownCost + restCost),
    }
  }
  return null
}


// ── №08 «Перебор слов и системы счисления» ──────────────────────────────────
// Эталон (77 задач): все слова длины L из заданного набора букв выписаны в
// АЛФАВИТНОМ порядке и пронумерованы с 1. Спрашивают:
//   index   — под каким номером стоит слово W;
//   letter  — номер первого слова, начинающегося с буквы X;
//   filter  — номер первого/последнего слова с набором ограничений (нет буквы X,
//             ровно одна буква Y, нет двух букв Z подряд);
//   parity  — то же, но среди слов с чётными/нечётными номерами, плюс «сколько таких»;
//   count   — комбинаторика: буква встречается ровно один раз (Вася/Игорь).
// Ответ всегда считается перебором всего списка — как решает ученик, только машинно.

const RUS_ALPHA = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"
const rusCmp = (a, b) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = RUS_ALPHA.indexOf(a[i].toLowerCase()) - RUS_ALPHA.indexOf(b[i].toLowerCase())
    if (d) return d
  }
  return a.length - b.length
}

// Все слова длины len из букв alpha в алфавитном порядке.
function allWords(alpha, len) {
  const sorted = [...alpha].sort(rusCmp)
  let out = [""]
  for (let i = 0; i < len; i++) {
    const next = []
    for (const w of out) for (const c of sorted) next.push(w + c)
    out = next
  }
  return out
}

const T8_SETS = [
  ["УЧЕНИК", 3], ["ГЕПАРД", 3], ["АКЦЕНТ", 5], ["ЛАЙМ", 5], ["ПАРУС", 5], ["БАТЫР", 5],
  ["ЦИТРУС", 5], ["ВОРОТА", 6], ["АЛГОРИТМ", 5], ["НОТКИ", 4], ["ИЗБА", 4], ["СТУЛ", 5],
  ["КРОТ", 5], ["ВЕСНА", 4], ["МОСТ", 5], ["ЗЕБРА", 4],
]
// Набор букв слова-донора (без повторов) + длина слов списка.
function t8Setup() {
  for (let k = 0; k < 40; k++) {
    const [word, len] = pick(T8_SETS)
    const alpha = [...new Set([...word])]
    if (alpha.length < 4 || Math.pow(alpha.length, len) > 300000) continue
    return { alpha, len }
  }
  return null
}

const T8_LEN_WORD = { 3: "3-буквенные", 4: "4-буквенные", 5: "пятибуквенные", 6: "шестибуквенные" }

function t8Head(alpha, len, words) {
  const start = words.slice(0, 6).map((w, i) => `${i + 1}. ${w}`).join("\n")
  return `Все ${T8_LEN_WORD[len]} слова, в составе которых могут быть только русские буквы ${alpha.join(", ")}, ` +
    "записаны в алфавитном порядке и пронумерованы начиная с 1.\nНиже приведено начало списка.\n" +
    start + "\n…\n"
}

export function t8WordIndex() {
  const st = t8Setup()
  if (!st) return null
  const words = allWords(st.alpha, st.len)
  const target = pick(words.slice(Math.floor(words.length / 6)))
  return {
    condition_text: t8Head([...st.alpha].sort(rusCmp), st.len, words) +
      `Под каким номером стоит слово ${target}?`,
    answer: String(words.indexOf(target) + 1),
  }
}

export function t8FirstLetter() {
  const st = t8Setup()
  if (!st) return null
  const sorted = [...st.alpha].sort(rusCmp)
  const words = allWords(st.alpha, st.len)
  const letter = pick(sorted.slice(1))            // не первая буква алфавита — иначе ответ 1
  return {
    condition_text: t8Head(sorted, st.len, words) +
      `Под каким номером в списке идёт первое слово, которое начинается с буквы ${letter}?`,
    answer: String(words.findIndex((w) => w[0] === letter) + 1),
  }
}

// Ограничения, из которых ФИПИ собирает вопрос «первое/последнее слово, которое …».
function t8Constraint(sorted) {
  const [a, b] = shuffle(sorted)
  const kind = randInt(0, 3)
  if (kind === 0) return { text: `не содержит ни одной буквы ${a}`, test: (w) => !w.includes(a) }
  if (kind === 1) return { text: `содержит не более одной буквы ${a}`, test: (w) => [...w].filter((c) => c === a).length <= 1 }
  if (kind === 2) return { text: `содержит ровно одну букву ${a}`, test: (w) => [...w].filter((c) => c === a).length === 1 }
  return { text: `не содержит букв ${b}, стоящих рядом`, test: (w) => !w.includes(b + b) }
}

export function t8Filter() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const st = t8Setup()
    if (!st) continue
    const sorted = [...st.alpha].sort(rusCmp)
    const words = allWords(st.alpha, st.len)
    const c1 = t8Constraint(sorted)
    let c2 = t8Constraint(sorted)
    for (let k = 0; k < 10 && c2.text === c1.text; k++) c2 = t8Constraint(sorted)
    const ok = words.map((w, i) => ({ w, i })).filter(({ w }) => c1.test(w) && c2.test(w))
    if (ok.length < 3) continue
    const last = Math.random() < 0.5
    const hit = last ? ok[ok.length - 1] : ok[0]
    // Слишком близкий к краю ответ («первое» = №3) делает задачу вырожденной:
    // ученик находит его глазами по началу списка, перебор не нужен.
    if (!last && hit.i < 12) continue
    if (last && hit.i > words.length - 12) continue
    return {
      condition_text: t8Head(sorted, st.len, words) +
        `Под каким номером в списке идёт ${last ? "последнее" : "первое"} слово, которое ${c1.text}${c1.text.includes(",") ? "," : ""} и ${c2.text}?`,
      answer: String(hit.i + 1),
    }
  }
  return null
}

export function t8Parity() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const st = t8Setup()
    if (!st) continue
    const sorted = [...st.alpha].sort(rusCmp)
    const words = allWords(st.alpha, st.len)
    const even = Math.random() < 0.5
    const banned = shuffle(sorted).slice(0, randInt(1, 3))
    const c = t8Constraint(sorted)
    const ok = words.map((w, i) => ({ w, n: i + 1 }))
      .filter(({ w, n }) => (n % 2 === 0) === even && !banned.includes(w[0]) && c.test(w))
    if (ok.length < 3) continue
    const askCount = Math.random() < 0.35
    const last = Math.random() < 0.5
    const head = t8Head(sorted, st.len, words)
    const bannedStr = banned.length === 1 ? `буквы ${banned[0]}` : `букв ${banned.slice(0, -1).join(", ")} или ${banned[banned.length - 1]}`
    if (askCount) {
      return {
        condition_text: head +
          `Определите в этом списке количество слов с ${even ? "чётными" : "нечётными"} номерами, которые не начинаются с ${bannedStr} и при этом ${c.text}.`,
        answer: String(ok.length),
      }
    }
    const hit = last ? ok[ok.length - 1] : ok[0]
    return {
      condition_text: head +
        `Определите, под каким номером в этом списке стоит ${last ? "последнее" : "первое"} слово с ${even ? "чётным" : "нечётным"} номером, ` +
        `которое не начинается с ${bannedStr} и при этом ${c.text}.`,
      answer: String(hit.n),
    }
  }
  return null
}

// Комбинаторика: буква X встречается ровно один раз, остальные — сколько угодно.
const T8_NAMES = [
  { who: "Вася", verb: "составляет", noun: "слова", tail: "Сколько существует таких слов, которые может написать Вася?" },
  { who: "Игорь", verb: "составляет", noun: "кодовые слова", tail: "Сколько различных кодовых слов может использовать Игорь?" },
]
export function t8CountOnce() {
  const st = t8Setup()
  if (!st) return null
  const sorted = [...st.alpha].sort(rusCmp)
  const special = pick(sorted)
  const rest = sorted.length - 1
  const n = st.len * Math.pow(rest, st.len - 1)
  const who = pick(T8_NAMES)
  const isCode = who.noun === "кодовые слова"
  return {
    condition_text:
      (isCode
        ? "Игорь составляет таблицу кодовых слов для передачи сообщений, каждому сообщению соответствует своё кодовое слово. " +
          `В качестве кодовых слов Игорь использует ${st.len}-буквенные слова, в которых есть только буквы ${sorted.join(", ")}, ` +
          `причём буква ${special} появляется ровно 1 раз. `
        : `Вася составляет ${st.len}-буквенные слова, в которых есть только буквы ${sorted.join(", ")}, ` +
          `причём буква ${special} используется в каждом слове ровно 1 раз. `) +
      `Каждая из других допустимых букв может встречаться в ${isCode ? "кодовом слове" : "слове"} любое количество раз или не встречаться совсем. ` +
      (isCode ? "" : "Словом считается любая допустимая последовательность букв, не обязательно осмысленная. ") +
      who.tail,
    answer: String(n),
  }
}



// Количество k-ичных n-значных чисел с ограничениями на цифры — перебор по всем
// числам системы счисления (k ≤ 9, n ≤ 6 → не больше 531 441 вариантов).
export function t8CountDigits() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const base = pick([5, 6, 7, 8, 9])
    const len = pick([4, 5, 5, 6])
    if (Math.pow(base, len) > 600000) continue
    const d = randInt(0, base - 1)
    // 0–2 — сколько раз встречается цифра d; 3 — «ровно одна d, и рядом с ней
    // не стоит цифра из запрещённого класса» (в банке — чётные/нечётные или список).
    const kind = randInt(0, 3)
    const oddBan = Math.random() < 0.5
    const tailBan = shuffle([...Array(base).keys()]).slice(0, 2)
    const limit = randInt(1, 2)
    const nearOdd = Math.random() < 0.6           // сосед не может быть нечётным (иначе — чётным)
    const nearList = shuffle([...Array(base).keys()].filter((x) => x !== d)).slice(0, 4).sort((a, b) => a - b)
    const useList = Math.random() < 0.4
    const forbidden = (x) => (useList ? nearList.includes(x) : (nearOdd ? x % 2 === 1 : x % 2 === 0))
    let n = 0
    const total = Math.pow(base, len)
    for (let v = 0; v < total; v++) {
      const digits = []
      let x = v
      for (let i = 0; i < len; i++) { digits.unshift(x % base); x = Math.floor(x / base) }
      if (digits[0] === 0) continue                       // числа без ведущего нуля
      const cnt = digits.filter((y) => y === d).length
      if (kind === 3) {
        if (cnt !== 1) continue
        const i = digits.indexOf(d)
        if (i > 0 && forbidden(digits[i - 1])) continue
        if (i < len - 1 && forbidden(digits[i + 1])) continue
        n++
        continue
      }
      if (kind === 2 && oddBan) {
        if (digits[0] % 2 === 1) continue
        if (tailBan.includes(digits[len - 1])) continue
      }
      const ok = kind === 0 ? cnt <= limit : kind === 1 ? cnt >= limit : cnt === limit
      if (ok) n++
    }
    if (n < 10) continue
    const lenWord = { 4: "четырёхзначных", 5: "пятизначных", 6: "шестизначных" }[len]
    const baseWord = BASE_NAME[base] ? BASE_NAME[base].replace(/ой$/, "ых") : `${base}-ричных`
    if (kind === 3) {
      const near = useList
        ? `никакая из цифр ${nearList.join(", ")} не стоит рядом с цифрой ${d}`
        : `никакая ${nearOdd ? "нечётная" : "чётная"} цифра не стоит рядом с цифрой ${d}`
      return {
        condition_text:
          `Определите количество ${lenWord} чисел, записанных в ${BASE_NAME[base] || `${base}-ричной`} системе счисления, ` +
          `в записи которых ровно одна цифра ${d}, при этом ${near}.`,
        answer: String(n),
      }
    }
    // «…содержат ровно одну цифру 0» (винительный) и «…в записи которых ровно одна цифра 0»
    // (именительный) — падеж зависит от того, какой оборот используется.
    const cntAcc = kind === 0 ? `не более ${NUMW_GEN[limit] || limit} цифр${limit === 1 ? "ы" : ""} ${d}`
      : kind === 1 ? `не менее ${NUMW_GEN[limit] || limit} цифр${limit === 1 ? "ы" : ""} ${d}`
        : `ровно ${limit === 1 ? "одну цифру" : `${NUMW[limit]} цифры`} ${d}`
    const cntNom = kind === 0 ? `не более ${NUMW_GEN[limit] || limit} цифр${limit === 1 ? "ы" : ""} ${d}`
      : kind === 1 ? `не менее ${NUMW_GEN[limit] || limit} цифр${limit === 1 ? "ы" : ""} ${d}`
        : `ровно ${limit === 1 ? "одна цифра" : `${NUMW[limit]} цифры`} ${d}`
    const extra = kind === 2 && oddBan
      ? `которые не начинаются с нечётных цифр, не оканчиваются цифрами ${tailBan[0]} или ${tailBan[1]}, а также содержат в своей записи ${cntAcc}`
      : `в записи которых ${cntNom}`
    return {
      condition_text: `Определите количество ${baseWord} ${lenWord} чисел, ${extra}.`,
      answer: String(n),
    }
  }
  return null
}

// Световое табло: сколько лампочек нужно, чтобы закодировать N различных сигналов.
export function t8Lamps() {
  const need = pick([50, 60, 80, 100, 120, 150, 200, 300, 500, 1000])
  return {
    condition_text:
      "Световое табло состоит из лампочек, каждая из которых может находиться в двух состояниях («включено» или «выключено»). " +
      `Какое наименьшее количество лампочек должно находиться на табло, чтобы с его помощью можно было передать ${need} различных сигналов?`,
    answer: String(bitsFor(need)),
  }
}

// ── №11 «Вычисление количества информации» ──────────────────────────────────
// Эталон (126 задач): посимвольное кодирование, на символ — минимальное целое
// число бит ⌈log₂ M⌉, на запись — минимальное целое число байт. Шесть типажей:
//   extra   43 — пароль + «дополнительные сведения»: найти байты на доп. сведения;
//   volume  25 — объём памяти (в Кбайт/Мбайт) под N идентификаторов;
//   plate   15 — номер из букв и цифр в любом порядке (единый алфавит);
//   split   11 — номер «цифры + буквы»: у групп РАЗНОЕ число бит на символ;
//   power   10 — обратная задача: найти мощность алфавита по объёму памяти;
//   length   7 — обратная задача: найти минимальную длину номера.
const bitsFor = (m) => Math.ceil(Math.log2(m))
const bytesFor = (bits) => Math.ceil(bits / 8)

const T11_LETTERS = [26, 30, 33, 24, 28]
const T11_SPECIAL = [240, 400, 1000, 4070, 60]

export function t11PassExtra() {
  const len = randInt(5, 12)
  const alpha = 10 + pick(T11_LETTERS)
  const perPass = bytesFor(len * bitsFor(alpha))
  const extra = randInt(3, 25)
  const users = pick([10, 20, 25, 30, 40, 50, 100])
  const total = users * (perPass + extra)
  const lenWord = { 5: "пяти", 6: "шести", 7: "семи", 8: "восьми", 9: "девяти", 10: "десяти", 11: "одиннадцати", 12: "двенадцати" }[len]
  return {
    condition_text:
      `При регистрации в компьютерной системе каждому пользователю выдаётся пароль, состоящий из ${lenWord} символов ` +
      `и содержащий только десятичные цифры и символы из ${alpha - 10}-символьного набора прописных латинских букв. ` +
      "В базе данных для хранения сведений о каждом пользователе отведено одинаковое и минимально возможное целое число байт. " +
      "При этом используют посимвольное кодирование паролей, все символы кодируют одинаковым и минимально возможным количеством бит. " +
      "Кроме собственно пароля, для каждого пользователя в системе хранятся дополнительные сведения, для чего выделено целое число байт; " +
      "это число одно и то же для всех пользователей.\n" +
      `Для хранения сведений о ${users} пользователях потребовалось ${total} байт. Сколько байт выделено для хранения дополнительных сведений об одном пользователе? ` +
      "В ответе запишите только целое число — количество байт.",
    answer: String(extra),
  }
}

export function t11Volume() {
  const len = pick([16, 24, 32, 48, 64])
  const alpha = 10 + pick(T11_SPECIAL)
  const per = bytesFor(len * bitsFor(alpha))
  const unit = pick(["Кбайт", "Мбайт"])
  const div = unit === "Кбайт" ? 1024 : 1024 * 1024
  // Количество берём кратным, чтобы ответ был целым числом единиц (как в банке).
  const count = div / Math.max(1, gcd(per, div)) * randInt(1, 4)
  const bytes = per * count
  if (bytes % div !== 0) return null
  return {
    condition_text:
      `При регистрации в компьютерной системе каждому объекту присваивается идентификатор, состоящий из ${len} символов ` +
      `и содержащий только десятичные цифры и символы из ${alpha - 10}-символьного специального алфавита. ` +
      "В базе данных для хранения каждого идентификатора отведено одинаковое и минимально возможное целое число байт. " +
      "При этом используют посимвольное кодирование идентификаторов, все символы кодируют одинаковым и минимально возможным количеством бит.\n" +
      `Определите объём памяти (в ${unit}), необходимый для хранения ${count} идентификаторов.\n` +
      `В ответе запишите только целое число — количество ${unit}.`,
    answer: String(bytes / div),
  }
}

function gcd(a, b) { return b ? gcd(b, a % b) : a }

export function t11Plate() {
  const len = randInt(4, 8)
  const letters = pick(T11_LETTERS)
  const per = bytesFor(len * bitsFor(letters + 10))
  const count = pick([20, 30, 40, 50, 60, 80, 100])
  return {
    condition_text:
      `В некоторой стране автомобильный номер длиной ${len} символов составляют из заглавных букв ` +
      `(используется ${letters} различных букв) и любых десятичных цифр. Буквы с цифрами могут следовать в любом порядке.\n` +
      "Каждый такой номер в компьютерной программе записывается минимально возможным и одинаковым целым количеством байт " +
      "(при этом используют посимвольное кодирование и все символы кодируются одинаковым и минимально возможным количеством бит).\n" +
      `Определите объём памяти (в байтах), отводимый этой программой для записи ${count} номеров.`,
    answer: String(per * count),
  }
}

export function t11Split() {
  const nd = randInt(3, 5), nl = randInt(2, 4)
  const digits = pick([7, 8, 9, 10, 6])
  const letters = pick([6, 12, 16, 20, 26])
  const per = bytesFor(nd * bitsFor(digits) + nl * bitsFor(letters))
  const count = pick([100, 200, 300, 400, 500])
  const digitsNote = digits === 7 ? " (кроме нуля, 6 и 9)" : digits === 10 ? "" : ` (кроме ${10 - digits === 1 ? "нуля" : "некоторых цифр"})`
  const letterList = ["А", "Е", "К", "М", "О", "Т", "Н", "Р", "С", "У", "В", "Х", "Б", "Г", "Д", "Ж", "З", "И", "Л", "П", "Ф", "Ц", "Ч", "Ш", "Э", "Ю"].slice(0, letters)
  return {
    condition_text:
      `Автомобильный номер состоит из ${nd + nl} символов: ${NUMW_GEN[nd]} цифр, за которыми следуют ${nl} ${nl === 2 ? "буквы" : "буквы"}. ` +
      `Допустимыми символами считаются ${digits} цифр${digitsNote} и ${letters} заглавных букв: ${letterList.join(", ")}. ` +
      "Для хранения каждой из цифр используется одинаковое и наименьшее возможное количество бит. " +
      "Аналогично, для хранения каждой из букв используется одинаковое и наименьшее возможное количество бит. " +
      "При этом количество бит, используемых для хранения одной буквы и одной цифры, могут быть разными.\n" +
      "Для хранения каждого номера используется одинаковое и минимально возможное количество байт. " +
      `Сколько байт памяти потребуется для хранения ${count} автомобильных номеров? Номера хранятся без разделителей.`,
    answer: String(per * count),
  }
}

// Обратная задача: по объёму памяти найти минимальную мощность алфавита.
export function t11Power() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const len = pick([98, 130, 196, 248, 320])
    const count = randInt(200000, 900000)
    const bits = randInt(5, 8)                       // истинное число бит на символ
    const per = bytesFor(len * bits)
    const unit = pick(["Мбайт", "Кбайт"])
    const div = unit === "Мбайт" ? 1024 * 1024 : 1024
    const need = Math.floor(per * count / div)       // «потребовалось не менее need единиц»
    if (need < 2) continue
    // Проверяем, что порог различает bits от bits−1 (иначе ответ неоднозначен).
    const perLess = bytesFor(len * (bits - 1))
    if (Math.floor(perLess * count / div) >= need) continue
    return {
      condition_text:
        `На предприятии каждой изготовленной детали присваивают серийный номер, состоящий из ${len} символов. ` +
        "В базе данных каждый серийный номер занимает одинаковое и минимально возможное число байт. " +
        "При этом используется посимвольное кодирование серийных номеров, все символы кодируются одинаковым и минимально возможным числом бит. " +
        `Известно, что для хранения ${count.toLocaleString("ru-RU").replace(/\s/g, "\u00A0")} серийных номеров потребовалось не менее ${need} ${unit} памяти. ` +
        "Определите минимально возможную мощность алфавита, используемого для записи серийных номеров. В ответе запишите только целое число.",
      answer: String(Math.pow(2, bits - 1) + 1),     // минимальная мощность, требующая ровно bits бит
    }
  }
  return null
}

// Обратная задача: по объёму памяти найти минимальную длину номера.
export function t11MinLength() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const special = pick(T11_SPECIAL)
    const alpha = 10 + 26 + special
    const bits = bitsFor(alpha)
    const count = pick([480, 960, 1200, 2400])
    const len = randInt(20, 60)
    const unit = "Кбайт"
    const div = 1024
    const bytesNeeded = bytesFor(len * bits) * count
    const threshold = Math.floor(bytesNeeded / div) - 1   // «отведено более threshold Кбайт»
    if (threshold < 5) continue
    // Минимальная длина, при которой памяти строго больше threshold Кбайт.
    let minLen = null
    for (let L = 1; L <= 400; L++) {
      if (bytesFor(L * bits) * count > threshold * div) { minLen = L; break }
    }
    if (minLen === null) continue
    return {
      condition_text:
        "На предприятии каждой изготовленной детали присваивают серийный номер, содержащий десятичные цифры, " +
        `26 латинских букв (без учёта регистра) и символы из ${special}-символьного специального алфавита. ` +
        "В базе данных для хранения каждого серийного номера отведено одинаковое и минимально возможное число байт. " +
        "При этом используется посимвольное кодирование серийных номеров, все символы кодируются одинаковым и минимально возможным числом бит. " +
        `Известно, что для хранения ${count} серийных номеров отведено более ${threshold} ${unit} памяти. ` +
        "Определите минимально возможную длину серийного номера. В ответе запишите только целое число.",
      answer: String(minLen),
    }
  }
  return null
}



// Секретное сообщение: алфавит M символов, все символы кодируются одинаковым
// минимально возможным числом бит; найти объём сообщения длиной L символов.
export function t11Message() {
  const variants = [
    { alpha: 43, text: "прописных букв кириллицы и цифр" },
    { alpha: 32, text: "прописных букв русского языка (всего используются 32 различные буквы без пробелов)" },
    { alpha: 52, text: "прописных и строчных латинских букв" },
    { alpha: 67, text: "прописных и строчных букв кириллицы, а также пробела" },
    { alpha: 26, text: "прописных латинских букв" },
  ]
  const v = pick(variants)
  const L = pick([80, 100, 120, 140, 160, 200, 256, 320])
  const bits = bitsFor(v.alpha) * L
  const bytes = Math.ceil(bits / 8)
  const inKb = bytes % KB === 0
  return {
    condition_text:
      `Для передачи секретного сообщения используется код, состоящий из ${v.text}` +
      (v.alpha === 32 ? ". " : ` (всего используется ${v.alpha} различных символов). `) +
      "При этом все символы кодируются одним и тем же (минимально возможным) количеством бит. " +
      `Определите информационный объём сообщения длиной в ${L} символов.\n` +
      `В ответе запишите целое число — количество ${inKb ? "Кбайт" : "байт"}.`,
    answer: String(inKb ? bytes / KB : bytes),
  }
}

// ── №12 «Выполнение алгоритмов для исполнителей» (Редактор) ─────────────────
// Эталон (68 задач): исполнитель Редактор с командами заменить(v, w) / нашлось(v)
// и циклом ПОКА. Два основных типажа:
//   minN 53 — на вход строка «1» + n девяток: найти наименьшее n, при котором сумма
//             цифр результата равна S (ответ ищется симуляцией программы);
//   sum   7 — на вход строка с маркером «>» и заданными количествами цифр в
//             ПРОИЗВОЛЬНОМ порядке: найти сумму цифр результата (порядок не влияет —
//             генератор это проверяет, прогоняя несколько случайных перестановок).
// Оставшиеся 8 задач банка — исполнитель МТ и фрагмент на алгоритмическом языке,
// они пока НЕ генерируются (см. отчёт о покрытии).

const T12_PREAMBLE =
  "Исполнитель Редактор получает на вход строку цифр и преобразовывает её. " +
  "Редактор может выполнять две команды, в обеих командах v и w обозначают цепочки цифр.\n" +
  "А) заменить (v, w).\n" +
  "Эта команда заменяет в строке первое слева вхождение цепочки v на цепочку w. Например, выполнение команды\n" +
  "заменить (111, 27)\n" +
  "преобразует строку 05111150 в строку 0527150.\n" +
  "Если в строке нет вхождений цепочки v, то выполнение команды заменить (v, w) не меняет эту строку.\n" +
  "Б) нашлось (v).\n" +
  "Эта команда проверяет, встречается ли цепочка v в строке исполнителя Редактор. Если она встречается, " +
  "то команда возвращает логическое значение «истина», в противном случае возвращает значение «ложь». " +
  "Строка исполнителя при этом не изменяется.\n" +
  "Цикл\nПОКА условие\nпоследовательность команд\nКОНЕЦ ПОКА\nвыполняется, пока условие истинно.\n" +
  "В конструкции\nЕСЛИ условие\nТО команда1\nКОНЕЦ ЕСЛИ\nвыполняется команда1 (если условие истинно).\n"

// Печать программы для Редактора по списку правил [v, w].
function t12Program(rules) {
  return "НАЧАЛО\n" +
    "ПОКА " + rules.map(([v]) => `нашлось (${v})`).join(" ИЛИ ") + "\n" +
    rules.map(([v, w]) => `ЕСЛИ нашлось (${v})\nТО заменить (${v}, ${w})\nКОНЕЦ ЕСЛИ`).join("\n") + "\n" +
    "КОНЕЦ ПОКА\nКОНЕЦ"
}

// Симуляция: на каждом проходе цикла по очереди применяются все сработавшие правила.
// limit защищает от программ, которые не завершаются (такие наборы правил отбрасываем).
function t12Run(str, rules, limit = 200000) {
  let s = str, steps = 0
  while (steps++ < limit) {
    if (!rules.some(([v]) => s.includes(v))) return s
    for (const [v, w] of rules) {
      const i = s.indexOf(v)
      if (i >= 0) s = s.slice(0, i) + w + s.slice(i + v.length)
    }
  }
  return null
}

const digitSum = (s) => [...s].reduce((a, c) => a + (/\d/.test(c) ? Number(c) : 0), 0)

// Наборы правил в духе банка: сокращают цепочки девяток/единиц к короткому остатку.
const T12_RULE_SETS = [
  [["19", "9"], ["399", "91"], ["999", "3"]],
  [["18", "8"], ["288", "81"], ["888", "2"]],
  [["17", "7"], ["477", "71"], ["777", "4"]],
  [["19", "1"], ["99", "3"], ["333", "9"]],
  [["16", "6"], ["566", "61"], ["666", "5"]],
]

export function t12EditorMinN() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const rules = pick(T12_RULE_SETS)
    const head = rules[0][0][0]          // первая цифра строки («1» в «1999…»)
    const body = rules[0][0][1]          // повторяющаяся цифра («9»)
    const NMAX = 600
    const sums = new Map()               // сумма цифр результата → минимальное n
    for (let n = 4; n <= NMAX; n++) {
      const res = t12Run(head + body.repeat(n), rules)
      if (res === null) { sums.clear(); break }
      const d = digitSum(res)
      if (!sums.has(d)) sums.set(d, n)
    }
    if (!sums.size) continue
    // Берём сумму, достигаемую не на самом краю диапазона, — иначе ответ угадывается.
    const cand = [...sums.entries()].filter(([, n]) => n > 8 && n < NMAX - 50)
    if (!cand.length) continue
    const [S, n] = pick(cand)
    return {
      condition_text: T12_PREAMBLE +
        "Дана программа для Редактора:\n" +
        t12Program(rules) + "\n" +
        `На вход приведённой выше программе поступает строка, начинающаяся с цифры «${head}», а затем содержащая n цифр «${body}» (3 < n < ${NMAX}).\n` +
        `Определите наименьшее значение n, при котором сумма цифр в строке, получившейся в результате выполнения программы, равна ${S}.`,
      answer: String(n),
    }
  }
  return null
}

// Маркерные правила: «>» проходит по строке слева направо, преобразуя цифры.
const T12_MARK_SETS = [
  [[">1", "22>"], [">2", "2>"], [">3", "1>"]],
  [[">1", "2>"], [">2", "11>"], [">3", "3>"]],
  [[">1", "1>"], [">2", "33>"], [">3", "2>"]],
]

export function t12EditorSum() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const rules = pick(T12_MARK_SETS)
    const counts = [randInt(8, 15), randInt(8, 15), randInt(20, 35)]
    const digits = ["1", "2", "3"]
    // Строим несколько случайных перестановок: если сумма зависит от порядка,
    // задача некорректна — такой набор правил отбрасываем.
    const sums = new Set()
    for (let k = 0; k < 5; k++) {
      const arr = shuffle(digits.flatMap((d, i) => Array(counts[i]).fill(d)))
      const res = t12Run(">" + arr.join(""), rules)
      if (res === null) { sums.add(NaN); break }
      sums.add(digitSum(res))
    }
    if (sums.size !== 1 || [...sums].some(Number.isNaN)) continue
    const answer = [...sums][0]
    return {
      condition_text: T12_PREAMBLE +
        `На вход приведённой ниже программе поступает строка, начинающаяся с символа «>», а затем содержащая ` +
        `${counts[0]} цифр 1, ${counts[1]} цифр 2 и ${counts[2]} цифр 3, расположенных в произвольном порядке.\n` +
        "Определите сумму числовых значений цифр строки, получившейся в результате выполнения программы.\n" +
        "Так, например, если результат работы программы представлял бы собой строку, состоящую из 50 цифр 4, то верным ответом было бы число 200.\n" +
        t12Program(rules),
      answer: String(answer),
    }
  }
  return null
}


// ── №16 «Рекурсивные алгоритмы» ─────────────────────────────────────────────
// Эталон (74 задачи): четыре типажа.
//   formula 32 — F(n) задана соотношениями (F(n)=2·n·F(n−1) и т. п.), спрашивают
//                значение выражения вида (F(a) − F(b))/F(c) — считаем на BigInt
//                через отношения F(k)/F(k−1), сами значения астрономические;
//   print   22 — рекурсивный алгоритм на нескольких языках: что выведет F(k);
//   stars    6 — две взаимно рекурсивные процедуры: сколько «звёздочек» напечатает;
//   fg       9 — F и G заданы соотношениями друг через друга: найти F(k).
// Листинги на Python / C++ / Паскале строятся из ОДНОГО описания алгоритма, по нему же
// идёт исполнение, — текст задачи и ответ не могут разойтись.

// Соотношения вида F(n) = c·n·F(n−1): выражение (F(a) ± F(b)) / F(c) на BigInt.
export function t16Formula() {
  const c = BigInt(pick([2, 3, 4, 5]))
  const base = randInt(2000, 2030)
  const kind = randInt(0, 2)
  // F(k)/F(k−1) = c·k, поэтому F(x)/F(y) = Π_{i=y+1..x} c·i.
  const ratio = (x, y) => { let r = 1n; for (let i = y + 1; i <= x; i++) r *= c * BigInt(i); return r }
  const a = base, b = base - 1, cc = base - 2
  const val = kind === 0 ? ratio(a, cc) - ratio(b, cc)
    : kind === 1 ? ratio(a, cc) + ratio(b, cc)
      : ratio(a, cc) - ratio(b, cc) * 2n
  const expr = kind === 0 ? `(F(${a}) − F(${b})) / F(${cc})`
    : kind === 1 ? `(F(${a}) + F(${b})) / F(${cc})`
      : `(F(${a}) − 2 · F(${b})) / F(${cc})`
  return {
    condition_text:
      "Алгоритм вычисления значения функции F(n), где n — натуральное число, задан следующими соотношениями:\n" +
      "F(n) = 1 при n = 1;\n" +
      `F(n) = ${c} · n · F(n − 1), если n > 1.\n` +
      `Чему равно значение выражения ${expr}?`,
    answer: val.toString(),
  }
}

// F(n) = k·G(n−d) + m; G задана рекуррентно с шагом d — считаем прямым спуском.
export function t16FG() {
  const d = pick([2, 3, 4])
  const k = randInt(2, 5), m = randInt(1, 9), add = randInt(1, 4), lim = pick([20, 25, 30])
  const G = (n) => (n <= lim ? n + 2 : G(n - d) + add)
  const F = (n) => k * G(n - d) + m
  const arg = lim + d * randInt(20, 200) + randInt(0, d - 1)
  return {
    condition_text:
      "Алгоритм вычисления значения функций F(n) и G(n), где n — целое число, задан следующими соотношениями:\n" +
      `F(n) = ${k} × G(n − ${d}) + ${m};\n` +
      `G(n) = n + 2, если n ≤ ${lim};\n` +
      `G(n) = G(n − ${d}) + ${add}, если n > ${lim}.\n` +
      `Чему равно значение F(${arg})?`,
    answer: String(F(arg)),
  }
}

// Описание рекурсивного алгоритма: печатает n (или звёздочки) и вызывает себя
// на нескольких аргументах. По одному описанию строятся и листинги, и исполнение.
const T16_ARG_TXT = {
  py: { minus: (d) => `n - ${d}`, half: "n // 2", third: "n // 3" },
  cpp: { minus: (d) => `n - ${d}`, half: "n / 2", third: "n / 3" },
  pas: { minus: (d) => `n - ${d}`, half: "n div 2", third: "n div 3" },
}
const T16_ARG_FN = { minus: (d) => (n) => n - d, half: () => (n) => Math.floor(n / 2), third: () => (n) => Math.floor(n / 3) }

function t16Listing(alg) {
  const argTxt = (lang, a) => (a.kind === "minus" ? T16_ARG_TXT[lang].minus(a.d) : T16_ARG_TXT[lang][a.kind])
  const py = `def F(n):\n    if n > ${alg.threshold}:\n        print(${alg.printExpr.py})\n` +
    alg.calls.map((a) => `        F(${argTxt("py", a)})`).join("\n")
  const cpp = `void F(int n) {\n    if (n > ${alg.threshold}) {\n        cout << ${alg.printExpr.cpp};\n` +
    alg.calls.map((a) => `        F(${argTxt("cpp", a)});`).join("\n") + "\n    }\n}"
  const pas = `procedure F(n: integer);\nbegin\n    if n > ${alg.threshold} then begin\n        write(${alg.printExpr.pas});\n` +
    alg.calls.map((a) => `        F(${argTxt("pas", a)})`).join(";\n") + "\n    end\nend;"
  return `Python:\n⟦code:${py}⟧\nС++:\n⟦code:${cpp}⟧\nПаскаль:\n⟦code:${pas}⟧`
}

function t16Exec(alg, n, out) {
  if (n <= alg.threshold) return
  out.push(alg.printValue(n))
  for (const a of alg.calls) t16Exec(alg, T16_ARG_FN[a.kind](a.d)(n), out)
}

export function t16Print() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const threshold = randInt(0, 2)
    const calls = shuffle([
      { kind: "minus", d: randInt(1, 3) },
      Math.random() < 0.5 ? { kind: "half" } : { kind: "minus", d: randInt(2, 4) },
    ])
    const alg = { threshold, calls, printExpr: { py: "n", cpp: "n", pas: "n" }, printValue: (n) => String(n) }
    const start = randInt(5, 9)
    const out = []
    t16Exec(alg, start, out)
    if (out.length < 4 || out.length > 25) continue
    const askShort = Math.random() < 0.4
    return {
      condition_text:
        "Ниже на трёх языках программирования записан рекурсивный алгоритм F.\n" +
        t16Listing(alg) + "\n" +
        (askShort
          ? `Что выведет программа при вызове F(${start})? В ответе запишите последовательность выведенных чисел подряд, без пробелов и разделителей.`
          : `Запишите подряд без пробелов и разделителей все числа, которые будут выведены на экран при выполнении вызова F(${start}). ` +
            "Числа должны быть записаны в том же порядке, в каком они выводятся алгоритмом."),
      answer: out.join(""),
    }
  }
  return null
}

// Две взаимно рекурсивные процедуры, печатающие звёздочки.
export function t16Stars() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const fStars = randInt(1, 2), gStars = randInt(1, 3)
    const fLim = randInt(1, 3), gLim = randInt(0, 2)
    const dFF = randInt(2, 4), dFG = randInt(1, 3), dGF = randInt(1, 3)
    const F = (n) => (n > fLim ? fStars + F(n - dFF) + G(n - dFG) : 0)
    const G = (n) => (n > gLim ? gStars + F(n - dGF) : 0)
    const start = randInt(14, 22)
    const total = F(start)
    if (total < 10 || total > 400) continue
    const star = (k) => "'" + "*".repeat(k) + "'"
    const py = `def F(n):\n    if n > ${fLim}:\n        print(${star(fStars)})\n        F(n - ${dFF})\n        G(n - ${dFG})\n\n` +
      `def G(n):\n    if n > ${gLim}:\n        print(${star(gStars)})\n        F(n - ${dGF})`
    const pas = `procedure G(n: integer); forward;\n\nprocedure F(n: integer);\nbegin\n    if n > ${fLim} then begin\n        write(${star(fStars)});\n        F(n - ${dFF});\n        G(n - ${dFG})\n    end\nend;\n\n` +
      `procedure G(n: integer);\nbegin\n    if n > ${gLim} then begin\n        write(${star(gStars)});\n        F(n - ${dGF})\n    end\nend;`
    return {
      condition_text:
        "Ниже на двух языках программирования записаны две рекурсивные функции (процедуры): F и G.\n" +
        `Python:\n⟦code:${py}⟧\nПаскаль:\n⟦code:${pas}⟧\n` +
        `Сколько символов «звёздочка» будет напечатано на экране при выполнении вызова F(${start})?`,
      answer: String(total),
    }
  }
  return null
}



// Программа с ЕСЛИ/ИНАЧЕ: сокращает длинные цепочки одинаковых цифр. Спрашивают
// саму получившуюся строку, цифры на заданных местах или количество нулей.
const T12_IFELSE_SETS = [
  { rules: [["1111", "888"], ["88888", "888"]], digit: "1" },
  { rules: [["999", "88"], ["8888", "99"]], digit: "9" },
  { rules: [["11111", "22"], ["2222", "111"]], digit: "1" },
]

function t12ProgramIfElse(rules) {
  return "НАЧАЛО\n" +
    "ПОКА " + rules.map(([v]) => `нашлось (${v})`).join(" ИЛИ ") + "\n" +
    `ЕСЛИ нашлось (${rules[0][0]})\nТО заменить (${rules[0][0]}, ${rules[0][1]})\n` +
    `ИНАЧЕ заменить (${rules[1][0]}, ${rules[1][1]})\nКОНЕЦ ЕСЛИ\n` +
    "КОНЕЦ ПОКА\nКОНЕЦ"
}

// Симуляция для программы с ИНАЧЕ: за проход применяется РОВНО ОДНА команда.
function t12RunIfElse(str, rules, limit = 100000) {
  let s = str, steps = 0
  while (steps++ < limit) {
    const [v1, w1] = rules[0], [v2, w2] = rules[1]
    if (s.includes(v1)) { const i = s.indexOf(v1); s = s.slice(0, i) + w1 + s.slice(i + v1.length) }
    else if (s.includes(v2)) { const i = s.indexOf(v2); s = s.slice(0, i) + w2 + s.slice(i + v2.length) }
    else return s
  }
  return null
}

export function t12EditorResult() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const set = pick(T12_IFELSE_SETS)
    const n = randInt(60, 140)
    const res = t12RunIfElse(set.digit.repeat(n), set.rules)
    if (res === null || res.length < 3 || res.length > 30) continue
    const kind = randInt(0, 2)
    const head =
      T12_PREAMBLE +
      "В конструкции\nЕСЛИ условие\nТО команда1\nИНАЧЕ команда2\nКОНЕЦ ЕСЛИ\n" +
      "выполняется команда1 (если условие истинно) или команда2 (если условие ложно).\n"
    if (kind === 0) {
      return {
        condition_text: head +
          `Какая строка получится в результате применения приведённой ниже программы к строке, состоящей из ${n} идущих подряд цифр ${set.digit}? ` +
          "В ответе запишите полученную строку.\n" + t12ProgramIfElse(set.rules),
        answer: res,
      }
    }
    if (kind === 1) {
      return {
        condition_text: head +
          `Определите количество ${res.includes("0") ? "нулей" : `цифр ${set.rules[0][1][0]}`} в строке, получившейся в результате применения ` +
          `приведённой ниже программы к строке, состоящей из ${n} идущих подряд цифр ${set.digit}.\n` + t12ProgramIfElse(set.rules),
        answer: String([...res].filter((c) => c === (res.includes("0") ? "0" : set.rules[0][1][0])).length),
      }
    }
    const positions = shuffle([...Array(res.length).keys()]).slice(0, 3).sort((a, b) => a - b)
    return {
      condition_text: head +
        `Определите, какие цифры будут находиться на ${positions.map((p) => `${p + 1}-м`).join(", ")} местах строки, ` +
        `получившейся в результате применения приведённой ниже программы к строке, состоящей из ${n} идущих подряд цифр ${set.digit}. ` +
        "В ответе запишите найденные цифры подряд, без разделителей.\n" + t12ProgramIfElse(set.rules),
      answer: positions.map((p) => res[p]).join(""),
    }
  }
  return null
}

// ── №13 «Организация компьютерных сетей. Адресация» + схемы дорог ───────────
// Эталон (92 задачи): два независимых семейства.
//   graph 38 — схема дорог (ориентированный граф без циклов): сколько путей из А в М,
//              проходящих через город X (иногда «и не проходящих через Y»);
//   mask  50 — маски сетей TCP/IP: байт маски, адрес сети, наибольший/наименьший
//              адрес узла, число адресов с условием на количество единиц, число
//              единиц/нулей в маске.
// Граф рисуется SVG: слои слева направо, стрелки — как в оригинале.

const CITY_RU = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М"]

// Стрелка от (x1,y1) к (x2,y2) с укорочением у концов (чтобы не влезала в кружок).
function gArrow(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len
  const sx = x1 + ux * 7, sy = y1 + uy * 7
  const ex = x2 - ux * 9, ey = y2 - uy * 9
  const a = Math.atan2(uy, ux)
  const p = (ang, r) => `${(ex - Math.cos(a + ang) * r).toFixed(1)},${(ey - Math.sin(a + ang) * r).toFixed(1)}`
  return `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#111" stroke-width="1.4"/>` +
    `<polygon points="${ex.toFixed(1)},${ey.toFixed(1)} ${p(0.38, 9)} ${p(-0.38, 9)}" fill="#111"/>`
}

export function t13Graph() {
  for (let tries = 0; tries < 400; tries++) {
    const L = pick([5, 6])
    const sizes = [1]
    let rest = 12 - 2
    for (let i = 1; i < L - 1; i++) {
      const take = Math.min(3, Math.max(1, Math.round(rest / (L - 1 - i))))
      sizes.push(take); rest -= take
    }
    if (rest !== 0) continue
    sizes.push(1)
    const layerNodes = [], layerOf = [], rowOf = []
    let idx = 0
    for (let li = 0; li < L; li++) {
      const arr = []
      for (let k = 0; k < sizes[li]; k++) { arr.push(idx); layerOf[idx] = li; rowOf[idx] = k; idx++ }
      layerNodes.push(arr)
    }
    const n = idx
    if (n !== 12) continue
    const end = n - 1
    const adj = Array.from({ length: n }, () => [])
    for (let u = 0; u < n; u++) {
      if (layerOf[u] === L - 1) continue
      const cands = []
      for (let tl = layerOf[u] + 1; tl <= Math.min(layerOf[u] + 2, L - 1); tl++) cands.push(...layerNodes[tl])
      const deg = Math.min(cands.length, pick([1, 2, 2, 3]))
      for (const c of shuffle(cands).slice(0, deg)) if (!adj[u].includes(c)) adj[u].push(c)
      if (!adj[u].length) adj[u].push(cands[0])
    }
    for (let v = 1; v < n; v++) if (!adj.some((a) => a.includes(v))) adj[pick(layerNodes[layerOf[v] - 1])].push(v)
    // Число путей из вершины до М и из А до вершины (DP по слоям).
    const order = [...Array(n).keys()].sort((a, b) => layerOf[a] - layerOf[b])
    const toEnd = Array(n).fill(0); toEnd[end] = 1
    for (const u of [...order].reverse()) if (u !== end) toEnd[u] = adj[u].reduce((s, v) => s + toEnd[v], 0)
    const fromA = Array(n).fill(0); fromA[0] = 1
    for (const u of order) for (const v of adj[u]) fromA[v] += fromA[u]
    if (toEnd.some((w, i) => i !== end && w === 0)) continue     // тупиков быть не должно
    const total = toEnd[0]
    if (total < 8 || total > 400) continue
    const mids = [...Array(n).keys()].filter((u) => u !== 0 && u !== end && fromA[u] * toEnd[u] > 1)
    if (!mids.length) continue
    const via = pick(mids)
    // Вариант «через X и не проходящих через Y»: считаем пути в графе без Y.
    const withBan = Math.random() < 0.3
    let ban = null, count = fromA[via] * toEnd[via]
    if (withBan) {
      const cands = [...Array(n).keys()].filter((u) => u !== 0 && u !== end && u !== via)
      ban = pick(cands)
      const f = Array(n).fill(0); f[0] = 1
      for (const u of order) { if (u === ban) continue; for (const v of adj[u]) if (v !== ban) f[v] += f[u] }
      const g = Array(n).fill(0); g[end] = 1
      for (const u of [...order].reverse()) { if (u === ban || u === end) continue; g[u] = adj[u].reduce((sm, v) => sm + (v === ban ? 0 : g[v]), 0) }
      count = f[via] * g[via]
      if (count < 2) continue
    }
    // Раскладка: слои по X, вершины слоя — по Y.
    const colGap = 110, mx = 52, cy = 130, H = 265
    const off = (c) => (c === 1 ? [0] : c === 2 ? [-52, 52] : [-78, 0, 78])
    const X = (u) => mx + layerOf[u] * colGap
    const Y = (u) => cy + off(sizes[layerOf[u]])[rowOf[u]]
    const W = mx * 2 + (L - 1) * colGap
    let el = ""
    for (let u = 0; u < n; u++) for (const v of adj[u]) el += gArrow(X(u), Y(u), X(v), Y(v))
    for (let u = 0; u < n; u++) {
      el += `<circle cx="${X(u)}" cy="${Y(u)}" r="4.5" fill="#111"/>`
      const lx = u === 0 ? X(u) - 12 : u === end ? X(u) + 12 : X(u)
      const anchor = u === 0 ? "end" : u === end ? "start" : "middle"
      const ly = u === 0 || u === end ? Y(u) + 5 : (Y(u) <= cy ? Y(u) - 12 : Y(u) + 19)
      el += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-size="17" font-family="Arial, sans-serif" font-weight="bold" fill="#111">${CITY_RU[u]}</text>`
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${el}</svg>`
    return {
      condition_text:
        `На рисунке представлена схема дорог, связывающих города ${CITY_RU.join(", ")}.\n` +
        "По каждой дороге можно двигаться только в одном направлении, указанном стрелкой.",
      image_url: svgUrl(svg),
      condition_tail:
        `Сколько существует различных путей из города ${CITY_RU[0]} в город ${CITY_RU[end]}, проходящих через город ${CITY_RU[via]}` +
        (ban === null ? "?" : ` и не проходящих через город ${CITY_RU[ban]}?`),
      answer: String(count),
    }
  }
  return null
}

// ── Маски сетей ──────────────────────────────────────────────────────────────
const T13_MASK_INTRO =
  "В терминологии сетей TCP/IP маской сети называется двоичное число, определяющее, какая часть IP-адреса узла сети " +
  "относится к адресу сети, а какая — к адресу самого узла в этой сети. Обычно маска записывается по тем же правилам, " +
  "что и IP-адрес, — в виде четырёх байтов, причём каждый байт записывается в виде десятичного числа. " +
  "При этом в маске сначала (в старших разрядах) стоят единицы, а затем с некоторого разряда — нули. " +
  "Адрес сети получается в результате применения поразрядной конъюнкции к заданному IP-адресу узла и маске.\n" +
  "Например, если IP-адрес узла равен 231.32.255.131, а маска равна 255.255.240.0, то адрес сети равен 231.32.240.0.\n"

const ipToNum = (ip) => ip.split(".").reduce((a, b) => a * 256 + Number(b), 0)
const numToIp = (n) => [24, 16, 8, 0].map((sh) => (n >>> sh) & 255).join(".")
const maskOf = (bits) => (bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0)
const randIp = () => [randInt(20, 220), randInt(0, 255), randInt(0, 255), randInt(1, 254)].join(".")

// Байт маски по адресу узла и адресу сети (в маске столько единиц, сколько нужно).
export function t13MaskByte() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const byteIdx = pick([2, 3])                       // третий слева или последний
    // Спрашиваемый байт должен быть содержательным: для третьего байта маска
    // длиннее 16 бит, для последнего — длиннее 24, иначе ответ «0» без всякой работы.
    const bits = byteIdx === 2 ? randInt(17, 24) : randInt(25, 31)
    const ip = randIp()
    const net = numToIp((ipToNum(ip) & maskOf(bits)) >>> 0)
    // Ответ однозначен, только если по паре (IP, адрес сети) число единиц маски
    // определяется однозначно: проверяем все длины маски.
    const fits = []
    for (let b = 1; b <= 32; b++) if (numToIp((ipToNum(ip) & maskOf(b)) >>> 0) === net) fits.push(b)
    const bytes = new Set(fits.map((b) => numToIp(maskOf(b)).split(".")[byteIdx]))
    const kind = pick(["наибольшее", "наименьшее"])
    if (bytes.size > 1 && fits.length < 2) continue
    const vals = [...bytes].map(Number).sort((a, b) => a - b)
    const answer = bytes.size === 1 ? vals[0] : (kind === "наибольшее" ? vals[vals.length - 1] : vals[0])
    const ask = bytes.size === 1
      ? `Чему равен ${byteIdx === 2 ? "третий слева" : "последний (самый правый)"} байт маски?`
      : `Каково ${kind} значение ${byteIdx === 2 ? "третьего слева" : "последнего (самого правого)"} байта маски?`
    return {
      condition_text: T13_MASK_INTRO +
        `Для узла с IP-адресом ${ip} адрес сети равен ${net}. ${ask} Ответ запишите в виде десятичного числа.`,
      answer: String(answer),
    }
  }
  return null
}

const T13_BROADCAST_NOTE =
  "Широковещательным адресом называется специализированный адрес, в котором на месте нулей в маске стоят единицы. " +
  "Адрес сети и широковещательный адрес не могут быть использованы для адресации сетевых устройств.\n"

// Наибольший/наименьший адрес, который может быть назначен компьютеру.
export function t13HostAddress() {
  const bits = randInt(10, 28)
  const ip = randIp()
  const netNum = (ipToNum(ip) & maskOf(bits)) >>> 0
  const bcast = (netNum | (~maskOf(bits) >>> 0)) >>> 0
  const largest = Math.random() < 0.5
  const answer = numToIp(largest ? bcast - 1 : netNum + 1).split(".").join("")
  return {
    condition_text:
      "В терминологии сетей TCP/IP маской сети называют двоичное число, которое показывает, какая часть IP-адреса узла сети " +
      "относится к адресу сети, а какая — к адресу узла в этой сети. Адрес сети получается в результате применения поразрядной " +
      "конъюнкции к заданному адресу узла и его маске.\n" + T13_BROADCAST_NOTE +
      `Сеть задана IP-адресом одного из входящих в неё узлов ${ip} и сетевой маской ${numToIp(maskOf(bits))}.\n` +
      `Найдите ${largest ? "наибольший" : "наименьший"} в данной сети IP-адрес, который может быть назначен компьютеру. ` +
      "В ответе укажите найденный IP-адрес без разделителей.\n" +
      "Например, если бы найденный адрес был равен 111.22.3.44, то в ответе следовало бы записать 11122344.",
    answer,
  }
}

// Найти IP-адрес сети по адресу узла и маске.
export function t13NetAddress() {
  const bits = randInt(9, 30)
  const ip = randIp()
  const net = numToIp((ipToNum(ip) & maskOf(bits)) >>> 0)
  return {
    condition_text: T13_MASK_INTRO +
      `Для узла с IP-адресом ${ip} маска сети равна ${numToIp(maskOf(bits))}. Найдите IP-адрес сети. ` +
      "В ответе укажите найденный IP-адрес без разделителей.",
    answer: net.split(".").join(""),
  }
}

// Сколько в сети адресов, у которых количество единиц в двоичной записи кратно k
// (или НЕ кратно k). Перебираем все адреса сети — их не больше 2¹⁴ при маске ≥ 18 бит.
export function t13CountOnes() {
  const bits = randInt(20, 26)
  const ip = randIp()
  const netNum = (ipToNum(ip) & maskOf(bits)) >>> 0
  const hosts = Math.pow(2, 32 - bits)
  const k = pick([2, 3, 4, 5])
  const mult = Math.random() < 0.5
  const netOnes = ((netNum >>> 0).toString(2).match(/1/g) || []).length
  let cnt = 0
  for (let i = 0; i < hosts; i++) {
    const ones = netOnes + ((i.toString(2).match(/1/g) || []).length)
    if ((ones % k === 0) === mult) cnt++
  }
  return {
    condition_text:
      "В терминологии сетей TCP/IP маской сети называют двоичное число, которое показывает, какая часть IP-адреса узла сети " +
      "относится к адресу сети, а какая — к адресу узла в этой сети. Адрес сети получается в результате применения поразрядной " +
      "конъюнкции к заданному адресу узла и его маске.\n" +
      `Сеть задана IP-адресом ${numToIp(netNum)} и маской сети ${numToIp(maskOf(bits))}.\n` +
      `Сколько в этой сети IP-адресов, для которых количество единиц в двоичной записи IP-адреса ${mult ? "" : "не "}кратно ${k}?`,
    answer: String(cnt),
  }
}

// Наибольшее/наименьшее возможное количество единиц (нулей) в разрядах маски.
export function t13MaskBits() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const bits = randInt(9, 30)
    const ip = randIp()
    const net = numToIp((ipToNum(ip) & maskOf(bits)) >>> 0)
    const fits = []
    for (let b = 1; b <= 32; b++) if (numToIp((ipToNum(ip) & maskOf(b)) >>> 0) === net) fits.push(b)
    if (fits.length < 2) continue
    const askOnes = Math.random() < 0.5
    const askMax = Math.random() < 0.5
    const ones = askMax ? Math.max(...fits) : Math.min(...fits)
    const answer = askOnes ? ones : 32 - (askMax ? Math.min(...fits) : Math.max(...fits))
    return {
      condition_text: T13_MASK_INTRO +
        `Для узла с IP-адресом ${ip} адрес сети равен ${net}. ` +
        `Каково ${askMax ? "наибольшее" : "наименьшее"} возможное количество ${askOnes ? "единиц" : "нулей"} в разрядах маски?`,
      answer: String(answer),
    }
  }
  return null
}


// ── №07 «Кодирование и передача графической и звуковой информации» ───────────
// Эталон (130 задач): шесть механик.
//   transfer 50 — два способа передачи документа (архив / без архива): что быстрее и на сколько;
//   colors   20 — максимальная палитра при ограничении на объём файла (в т. ч. со сжатием «на N%»);
//   volume   14 — объём файла изображения по размеру и палитре;
//   packet    8 — сколько снимков влезает в пакет за отведённое время;
//   sound    12 — оцифровка звука: частота × глубина × каналы;
//   modem     5 — сколько секунд модем передаёт изображение.
// Все ответы целые: параметры подбираются степенями двойки, деление проверяется.

const KB = 1024, MB = 1024 * 1024

// Склонение числительных: 21 секунда / 24 секунды / 25 секунд.
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}
const secs = (n) => `${n} ${plural(n, "секунда", "секунды", "секунд")}`
const mins = (n) => `${n} ${plural(n, "минута", "минуты", "минут")}`

export function t7Transfer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const mb = pick([4, 8, 10, 12, 16, 20, 24, 25])
    const speedPow = pick([19, 20, 21, 22, 23])
    const speed = Math.pow(2, speedPow)
    const percent = pick([10, 15, 20, 25, 30, 40, 50, 60, 75, 80])
    const zip = randInt(5, 25), unzip = randInt(2, 12)
    const bits = mb * MB * 8
    const tPlain = bits / speed
    const tArch = bits * percent / 100 / speed + zip + unzip
    if (!Number.isInteger(tPlain) || !Number.isInteger(tArch)) continue
    const diff = Math.abs(tPlain - tArch)
    if (diff === 0 || diff > 400) continue
    const faster = tArch < tPlain ? "А" : "Б"
    return {
      condition_text:
        `Документ объёмом ${mb} Мбайт можно передать с одного компьютера на другой двумя способами.\n` +
        "А. Сжать архиватором, передать архив по каналу связи, распаковать.\n" +
        "Б. Передать по каналу связи без использования архиватора.\n" +
        "Какой способ быстрее и насколько, если:\n" +
        `— средняя скорость передачи данных по каналу связи составляет 2⟦sup:${speedPow}⟧ бит в секунду;\n` +
        `— объём сжатого архиватором документа равен ${percent}% исходного;\n` +
        `— время, требуемое на сжатие документа, — ${secs(zip)}, на распаковку — ${secs(unzip)}?\n` +
        "В ответе напишите букву А, если быстрее способ А, или Б, если быстрее способ Б. " +
        "Сразу после буквы напишите количество секунд, на сколько этот способ быстрее другого, без указания размерности.\n" +
        "Например, запись ответа Б23 означает, что способ Б быстрее на 23 секунды.",
      answer: `${faster}${diff}`,
    }
  }
  return null
}

export function t7Colors() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const w = pick([128, 200, 256, 320, 512, 640, 1024])
    const h = pick([120, 200, 256, 240, 480, 512])
    const bits = pick([2, 4, 8, 12, 16, 24])
    const bytes = w * h * bits / 8
    if (!Number.isInteger(bytes) || bytes % KB !== 0) continue
    const kb = bytes / KB
    if (kb < 8 || kb > 4000) continue
    return {
      condition_text: Math.random() < 0.4
        ? `Для хранения растрового изображения размером ${w} × ${h} пикселей отвели ${bytes} байт памяти без учёта размера заголовка файла. ` +
          "Каково максимально возможное число цветов в палитре изображения?"
        : `Автоматическая камера производит растровые изображения размером ${w}×${h} пикселей. ` +
          "Для кодирования цвета каждого пикселя используется одинаковое количество бит, коды пикселей записываются в файл один за другим без промежутков. " +
          `Объём файла с изображением не может превышать ${kb} Кбайт без учёта размера заголовка файла. ` +
          "Какое максимальное количество цветов можно использовать в палитре?",
      answer: String(Math.pow(2, bits)),
    }
  }
  return null
}

// Тот же вопрос, но объём дан для СЖАТОГО файла, а оригинал больше на N%.
export function t7ColorsCompressed() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const w = pick([256, 512, 1024, 640, 800])
    const h = pick([120, 128, 240, 256, 300])
    const bits = pick([4, 8, 16, 24])
    const orig = w * h * bits / 8
    const percent = pick([25, 50, 55, 60, 75, 80, 100, 120, 125])
    const packed = orig / (1 + percent / 100)
    if (!Number.isInteger(packed) || packed % KB !== 0) continue
    const kb = packed / KB
    if (kb < 5 || kb > 3000) continue
    return {
      condition_text:
        `Для хранения сжатого произвольного растрового изображения размером ${w} на ${h} пикселей отведено ${kb} Кбайт памяти ` +
        `без учёта размера заголовка файла. Файл оригинального изображения больше сжатого на ${percent}%. ` +
        "Для кодирования цвета каждого пикселя используется одинаковое количество бит, коды пикселей записываются в файл один за другим без промежутков. " +
        "Какое максимальное количество цветов можно использовать в изображении?",
      answer: String(Math.pow(2, bits)),
    }
  }
  return null
}

export function t7Volume() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const w = pick([640, 800, 1024, 1280, 1920]), h = pick([480, 600, 768, 1024, 1080])
    const colors = pick([16, 256, 4096, 16384, 65536, 16777216])
    const bits = bitsFor(colors)
    const bytes = w * h * bits / 8
    const unit = bytes % MB === 0 ? "Мбайт" : bytes % KB === 0 ? "Кбайт" : null
    if (!unit) continue
    const div = unit === "Мбайт" ? MB : KB
    return {
      condition_text:
        `Камера делает цветные фотографии размером ${w}×${h} пикселей, используя палитру из ${colors.toLocaleString("ru-RU").replace(/\s/g, "\u00A0")} цветов. ` +
        "Для кодирования цвета каждого пикселя используется одинаковое количество бит, коды пикселей записываются в файл один за другим без промежутков, " +
        "сжатие данных не производится.\n" +
        `Определите размер одного файла с фотографией (в ${unit}) без учёта размера заголовка файла. В ответе запишите целое число.`,
      answer: String(bytes / div),
    }
  }
  return null
}

export function t7Packet() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const w = pick([1024, 1280, 1600]), h = pick([768, 1024, 1200])
    const colors = pick([256, 4096, 16384, 65536])
    const bits = w * h * bitsFor(colors)
    const speed = pick([2, 3, 4, 5, 6, 9]) * Math.pow(2, pick([20, 23, 24]))
    const seconds = pick([64, 100, 128, 150, 200, 256])
    const n = Math.floor(speed * seconds / bits)
    if (n < 3 || n > 200) continue
    return {
      condition_text:
        `Прибор автоматической фиксации нарушений правил дорожного движения делает цветные фотографии размером ${w}×${h} пикселей, ` +
        `используя палитру из ${colors.toLocaleString("ru-RU").replace(/\s/g, "\u00A0")} цветов. ` +
        `Снимки сохраняются в памяти камеры, группируются в пакеты по несколько штук, а затем передаются в центр обработки информации ` +
        `со скоростью передачи данных ${speed.toLocaleString("ru-RU").replace(/\s/g, "\u00A0")} бит/с. ` +
        `Каково максимально возможное число снимков в одном пакете, если на передачу одного пакета отводится не более ${seconds} секунд?\n` +
        "В ответе запишите целое число.",
      answer: String(n),
    }
  }
  return null
}

export function t7Sound() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const freq = pick([8000, 11025, 16000, 22050, 24000, 32000, 44100])
    const depth = pick([8, 16, 24, 32])
    const stereo = Math.random() < 0.6
    const min = randInt(1, 6), sec = randInt(0, 59)
    const total = min * 60 + sec
    const bytes = freq * (depth / 8) * (stereo ? 2 : 1) * total
    const kb = Math.ceil(bytes / KB)
    if (kb < 100 || kb > 60000) continue
    return {
      condition_text:
        "Лена записывает голосовое сообщение для своей подруги. Перед отправкой сообщение оцифровывается " +
        `в формате ${stereo ? "стерео" : "моно"} с частотой дискретизации ${freq.toLocaleString("ru-RU").replace(/\s/g, "\u00A0")} Гц и глубиной кодирования ${depth} ${plural(depth, "бит", "бита", "бит")}. ` +
        `Определите наименьшее количество Кбайт, необходимое для сохранения сообщения в памяти (без учёта заголовка), ` +
        `если его длительность — ${mins(min)} ${secs(sec)}.\n` +
        "В ответе укажите только число.",
      answer: String(kb),
    }
  }
  return null
}

export function t7Modem() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const w = pick([640, 800, 1024]), h = pick([480, 600, 768])
    const colors = pick([256, 65536, 16777216])
    const bits = w * h * bitsFor(colors)
    const speed = pick([12800, 25600, 51200, 128000])
    const sec = bits / speed
    if (!Number.isInteger(sec) || sec < 30 || sec > 4000) continue
    return {
      condition_text:
        `Сколько секунд потребуется обычному модему, передающему сообщения со скоростью ${speed.toLocaleString("ru-RU").replace(/\s/g, "\u00A0")} бит/с, ` +
        `чтобы передать цветное растровое изображение размером ${w} на ${h} пикселей, при условии, что цвет каждого пикселя ` +
        `кодируется ${bitsFor(colors)} битами?`,
      answer: String(sec),
    }
  }
  return null
}


// ── №14 «Кодирование чисел. Системы счисления» ──────────────────────────────
// Эталон (74 задачи): значение выражения из степеней переводится в систему счисления
// и в записи что-то считают. Четыре типажа:
//   powsum 44 — сумма/разность степеней одного основания → сколько значащих нулей,
//               цифр с заданным значением, цифр «больше 9» или сумма цифр;
//   digit  14 — операнды с неизвестной цифрой x: наименьшее x, при котором сумма кратна k,
//               в ответе — частное;
//   minusx 11 — bⁿ + bᵐ − x (x ≤ N): наибольшее x, при котором ровно K нулей в записи;
//   bin     2 — сколько единиц в двоичной записи значения выражения.
// Все вычисления на BigInt: числа в этих задачах — тысячи цифр, обычный Number врёт.

// Названия систем счисления прописью — так они напечатаны в банке.
const BASE_NAME = { 2: "двоичной", 3: "троичной", 4: "четверичной", 5: "пятеричной", 6: "шестеричной",
  7: "семеричной", 8: "восьмеричной", 9: "девятеричной", 11: "одиннадцатеричной", 13: "тринадцатеричной" }

// Запись BigInt в системе счисления base: массив цифр (числовых значений) от старшей.
function digitsInBase(n, base) {
  const B = BigInt(base), out = []
  let v = n
  if (v === 0n) return [0]
  while (v > 0n) { out.push(Number(v % B)); v /= B }
  return out.reverse()
}

export function t14PowerSum() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const root = pick([3, 2, 5, 6])                       // 27 = 3³, 16 = 2⁴, …
    const power = pick([2, 3, 4])
    const base = Math.pow(root, power)                    // основание системы счисления
    if (base < 8 || base > 36) continue
    const k = randInt(4, 6)                               // сколько слагаемых
    const startExp = randInt(60, 120)
    const terms = []
    let value = 0n
    for (let i = 0; i < k; i++) {
      const coef = BigInt(pick([1, 2, 2, 3]))
      const sign = i === 0 ? 1n : BigInt(pick([1, 1, -1]))
      const rootPow = randInt(2, 5)                       // основание слагаемого: root^rootPow
      const exp = startExp - i * randInt(2, 5)
      if (exp < 5) { value = 0n; break }
      // Два одинаковых слагаемых (одно основание и один показатель) в банке не
      // встречаются и выглядят как опечатка — такую попытку отбрасываем.
      if (terms.some((t) => t.b === Math.pow(root, rootPow) && t.exp === exp)) { value = 0n; break }
      const term = BigInt(Math.pow(root, rootPow)) ** BigInt(exp)
      terms.push({ coef, sign, b: Math.pow(root, rootPow), exp })
      value += sign * coef * term
    }
    if (value <= 0n) continue
    const tail = BigInt(randInt(2, 90))
    const tailSign = BigInt(pick([1, -1]))
    value += tailSign * tail
    if (value <= 0n) continue
    terms.sort((p, q) => Math.log(q.b) * q.exp - Math.log(p.b) * p.exp)   // как в банке — по убыванию
    const digits = digitsInBase(value, base)
    const kind = randInt(0, 3)
    let ask, answer
    if (kind === 0) {
      ask = "Сколько значащих нулей содержится в этой записи?"
      answer = digits.filter((d) => d === 0).length
    } else if (kind === 1) {
      const d = randInt(1, Math.min(base - 1, 9))
      ask = `Определите количество цифр ${d} в записи этого числа.`
      answer = digits.filter((x) => x === d).length
    } else if (kind === 2) {
      if (base <= 10) continue
      ask = "Определите количество цифр с числовым значением, превышающим 9, в записи этого числа."
      answer = digits.filter((x) => x > 9).length
    } else {
      ask = "Определите сумму цифр этого числа."
      answer = digits.reduce((a, b) => a + b, 0)
    }
    if (answer < 3) continue                              // ответ «1» — задача ни о чём
    const expr = terms.map(({ coef, sign, b, exp }, i) => {
      const sgn = i === 0 ? "" : sign > 0n ? " + " : " – "
      const c = coef === 1n ? "" : `${coef} ∙ `
      return `${sgn}${c}${b}⟦sup:${exp}⟧`
    }).join("") + `${tailSign > 0n ? " + " : " – "}${tail}`
    return {
      condition_text:
        "Значение арифметического выражения\n" + expr + "\n" +
        `записали в системе счисления с основанием ${base}. ` + ask,
      answer: String(answer),
    }
  }
  return null
}

export function t14UnknownDigit() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const base = pick([9, 11, 12, 13, 14, 15, 16, 17, 18])
    const div = randInt(7, 20)
    const DIG = "0123456789ABCDEFGHIJ"
    // Два числа с одной неизвестной цифрой x в разных позициях.
    const mk = () => {
      const len = randInt(5, 6)
      const pos = randInt(1, len - 1)
      // Цифры держим в пределах 0–9: в банке ФИПИ операнды записаны без буквенных
      // цифр, даже когда основание больше десяти.
      const top = Math.min(base - 1, 9)
      const ds = Array.from({ length: len }, (_, i) => (i === 0 ? randInt(1, top) : randInt(0, top)))
      return { ds, pos }
    }
    const a = mk(), b = mk()
    const valueFor = (x) => {
      const num = ({ ds, pos }) => ds.reduce((acc, d, i) => acc * BigInt(base) + BigInt(i === pos ? x : d), 0n)
      return num(a) + num(b)
    }
    const good = []
    for (let x = 0; x < base; x++) if (valueFor(x) % BigInt(div) === 0n) good.push(x)
    if (!good.length) continue
    const x = Math.min(...good)
    const q = valueFor(x) / BigInt(div)
    const show = ({ ds, pos }) => ds.map((d, i) => (i === pos ? "x" : DIG[d])).join("")
    return {
      condition_text:
        `Операнды арифметического выражения записаны в системе счисления с основанием ${base}.\n` +
        `${show(a)}⟦b:${base}⟧ + ${show(b)}⟦b:${base}⟧\n` +
        `В записи чисел переменной x обозначена неизвестная цифра из алфавита ${base}-ричной системы счисления. ` +
        `Определите наименьшее значение x, при котором значение данного арифметического выражения кратно ${div}. ` +
        `Для найденного значения x вычислите частное от деления значения арифметического выражения на ${div} ` +
        "и укажите его в ответе в десятичной системе счисления. Основание системы счисления указывать не нужно.",
      answer: q.toString(),
    }
  }
  return null
}

export function t14MinusX() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const base = pick([5, 7, 9, 11, 13])
    const e1 = randInt(150, 400), e2 = randInt(60, 140)
    const limit = pick([1000, 1500, 2300, 3000, 5000])
    const B = BigInt(base)
    const val = B ** BigInt(e1) + B ** BigInt(e2)
    const zerosFor = (x) => digitsInBase(val - BigInt(x), base).filter((d) => d === 0).length
    const counts = new Map()
    for (let x = 1; x <= limit; x++) {
      const z = zerosFor(x)
      counts.set(z, Math.max(counts.get(z) || 0, x))
    }
    const cand = [...counts.entries()].filter(([z, x]) => z > 20 && x > 5 && x < limit)
    if (!cand.length) continue
    const [zeros, x] = pick(cand)
    const askMax = true
    return {
      condition_text:
        `Значение арифметического выражения ${base}⟦sup:${e1}⟧ + ${base}⟦sup:${e2}⟧ – x, где x — целое положительное число, ` +
        `не превышающее ${limit}, записали в ${BASE_NAME[base] || `${base}-ричной`} системе счисления. ` +
        `Определите ${askMax ? "наибольшее" : "наименьшее"} значение x, при котором в ${BASE_NAME[base] || `${base}-ричной`} записи числа, ` +
        `являющегося значением данного арифметического выражения, содержится ровно ${zeros} нулей.\n` +
        "В ответе запишите число в десятичной системе счисления.",
      answer: String(x),
    }
  }
  return null
}

export function t14BinOnes() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const a = pick([2, 4, 8, 16]), b = pick([2, 4, 8])
    const ea = randInt(10, 40), eb = randInt(20, 60)
    const sub = pick([2, 4, 8, 16, 32, 64])
    const val = BigInt(a) ** BigInt(ea) + BigInt(b) ** BigInt(eb) - BigInt(sub)
    if (val <= 0n) continue
    const ones = digitsInBase(val, 2).filter((d) => d === 1).length
    const askOnes = Math.random() < 0.6
    const answer = askOnes ? ones : digitsInBase(val, 2).filter((d) => d === 0).length
    if (answer < 3) continue
    return {
      condition_text:
        `Сколько ${askOnes ? "единиц" : "нулей"} содержится в двоичной записи значения выражения:\n` +
        `${a}⟦sup:${ea}⟧ + ${b}⟦sup:${eb}⟧ – ${sub}?`,
      answer: String(answer),
    }
  }
  return null
}


// ── №15 «Преобразование логических выражений» ───────────────────────────────
// Эталон (80 задач): три семейства.
//   ineq  33 — выражение с двумя целыми переменными и параметром A: найти наибольшее
//              (наименьшее) A, при котором оно тождественно истинно;
//   seg   16 — отрезки на числовой прямой: наименьшая длина отрезка A;
//   del   31 — предикат ДЕЛ(n, m) («n делится на m»): наибольшее/наименьшее A.
// Всё проверяется перебором по КОНЕЧНОЙ области, куда обязана попасть контрпримерная
// точка: для неравенств отрицание ограничивает x и y сверху, для ДЕЛ период равен
// НОК модулей, для отрезков достаточно точек с шагом ½ (границы целые).

// Шаблоны неравенств: строка для печати + предикат + верхняя граница перебора.
const T15_INEQ = [
  { text: (A, K) => `(x + 2y > ${A}) \\/ (y < x) \\/ (x < ${K})`,
    f: (x, y, A, K) => x + 2 * y > A || y < x || x < K, dir: "max" },
  { text: (A, K) => `(x + 2y < ${A}) \\/ (y > x) \\/ (x > ${K})`,
    f: (x, y, A, K) => x + 2 * y < A || y > x || x > K, dir: "min" },
  { text: (A, K) => `(x + y ≤ ${K}) \\/ (y ≤ x + 2) \\/ (y ≥ ${A})`,
    f: (x, y, A, K) => x + y <= K || y <= x + 2 || y >= A, dir: "max" },
  { text: (A, K) => `(2x + y > ${A}) \\/ (x > y) \\/ (y < ${K})`,
    f: (x, y, A, K) => 2 * x + y > A || x > y || y < K, dir: "max" },
  { text: (A, K) => `(x > ${A}) \\/ (y > ${A}) \\/ (x + 2y < ${K})`,
    f: (x, y, A, K) => x > A || y > A || x + 2 * y < K, dir: "max" },
  { text: (A, K) => `(2x + y ≠ ${K}) \\/ (x < y) \\/ (${A} < x)`,
    f: (x, y, A, K) => 2 * x + y !== K || x < y || A < x, dir: "max" },
]

export function t15Inequality() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const tpl = pick(T15_INEQ)
    const K = randInt(15, 70)
    const LIM = 400
    const holds = (A) => {
      for (let x = 0; x <= LIM; x++) for (let y = 0; y <= LIM; y++) if (!tpl.f(x, y, A, K)) return false
      return true
    }
    let A = null
    if (tpl.dir === "max") { for (let a = 0; a <= 3 * LIM; a++) { if (!holds(a)) { A = a - 1; break } } }
    else { for (let a = 3 * LIM; a >= 0; a--) { if (!holds(a)) { A = a + 1; break } } }
    if (A === null || A <= 0) continue
    return {
      condition_text:
        `Для какого ${tpl.dir === "max" ? "наибольшего" : "наименьшего"} целого неотрицательного числа A выражение\n` +
        tpl.text("A", K) + "\n" +
        "тождественно истинно, т.е. принимает значение 1 при любых целых неотрицательных x и y?",
      answer: String(A),
    }
  }
  return null
}

// Отрезки: формула с ¬, →, /\ над принадлежностью отрезкам B, C и искомому A.
const T15_SEG = [
  { text: "( ¬ (x ∈ B)) → (((x ∈ C) /\\ ¬(x ∈ A)) → (x ∈ B))",
    f: (inA, inB, inC) => (!inB ? ((inC && !inA) ? inB : true) : true) },
  { text: "(x ∈ A) → ((x ∈ B) \\/ (x ∈ C))",
    f: (inA, inB, inC) => (!inA || inB || inC) },
  { text: "((x ∈ B) /\\ ¬(x ∈ C)) → ¬(x ∈ A)",
    f: (inA, inB, inC) => (!(inB && !inC) || !inA) },
  { text: "¬(x ∈ A) → ((x ∈ B) → (x ∈ C))",
    f: (inA, inB, inC) => (inA || !inB || inC) },
]

export function t15Segments() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const tpl = pick(T15_SEG)
    const b1 = randInt(20, 130), b2 = b1 + randInt(10, 40)
    const c1 = randInt(b1 - 20, b2 + 10), c2 = c1 + randInt(10, 50)
    const lo = Math.min(b1, c1) - 12, hi = Math.max(b2, c2) + 12
    const pts = []
    for (let v = lo; v <= hi; v += 0.5) pts.push(v)
    const inSeg = (v, l, r) => v >= l && v <= r
    const ok = (l, r) => pts.every((v) => tpl.f(inSeg(v, l, r), inSeg(v, b1, b2), inSeg(v, c1, c2)))
    // Минимальная длина отрезка A среди всех целочисленных [l, r] в окрестности.
    let best = null
    for (let l = lo; l <= hi; l++) for (let r = l; r <= hi; r++) {
      if (best !== null && r - l >= best) continue
      if (ok(l, r)) { best = r - l; break }
    }
    if (best === null || best === 0 || best > 90) continue
    return {
      condition_text:
        `На числовой прямой даны два отрезка: B = [${b1}; ${b2}] и C = [${c1}; ${c2}]. ` +
        `Укажите наименьшую возможную длину такого отрезка A, что формула\n${tpl.text}\n` +
        "истинна, т.е. принимает значение 1 при любом значении переменной x.",
      answer: String(best),
    }
  }
  return null
}

// ── ДЕЛ(n, m) ────────────────────────────────────────────────────────────────
const DEL_INTRO = "Обозначим через ДЕЛ(n, m) утверждение «натуральное число n делится без остатка на натуральное число m». "
const lcm = (a, b) => (a / gcd(a, b)) * b

// ДЕЛ(x, A) \/ ((x ∈ B) → ¬ДЕЛ(x, m)) — истинно при всех x: проверять достаточно x ∈ B.
export function t15DelSegment() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const m = pick([6, 10, 12, 14, 15, 18, 21, 20])
    const b1 = randInt(30, 120), b2 = b1 + randInt(10, 40)
    const holds = (A) => {
      for (let x = b1; x <= b2; x++) if (!(x % A === 0 || !(x % m === 0))) return false
      return true
    }
    let best = null
    for (let A = 1; A <= 5000; A++) if (holds(A)) best = A
    if (!best || best === 1) continue
    return {
      condition_text: DEL_INTRO.replace("«натуральное число n делится без остатка на натуральное число m».", "«натуральное число n делится без остатка на натуральное число m»;") +
        `пусть на числовой прямой дан отрезок B = [${b1}; ${b2}].\n` +
        "Для какого наибольшего натурального числа A логическое выражение\n" +
        `ДЕЛ(x, A) \\/ ((x ∈ B) → ¬ДЕЛ(x, ${m}))\n` +
        "истинно (т.е. принимает значение 1) при любом целом положительном значении переменной x?",
      answer: String(best),
    }
  }
  return null
}

// ¬ДЕЛ(x, A) → (ДЕЛ(x, m1) → ¬ДЕЛ(x, m2)) — наибольшее A; период = НОК(A, m1, m2).
export function t15DelMax() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const m1 = pick([14, 15, 21, 12, 18, 20]), m2 = pick([4, 6, 8, 9, 10])
    const holds = (A) => {
      const period = lcm(lcm(A, m1), m2)
      if (period > 200000) return false
      for (let x = 1; x <= period; x++) if (!(x % A === 0 || !(x % m1 === 0) || !(x % m2 === 0))) return false
      return true
    }
    let best = null
    for (let A = 1; A <= 300; A++) if (holds(A)) best = A
    if (!best || best === 1) continue
    return {
      condition_text: DEL_INTRO + "\n" +
        "Для какого наибольшего натурального числа A логическое выражение\n" +
        `¬ДЕЛ(x, A) → (ДЕЛ(x, ${m1}) → ¬ДЕЛ(x, ${m2}))\n` +
        "истинно (т.е. принимает значение 1) при любом целом положительном значении переменной x?",
      answer: String(best),
    }
  }
  return null
}

// (¬ДЕЛ(x, m1) /\ ДЕЛ(x, A)) → (ДЕЛ(x, m2) \/ ¬ДЕЛ(x, A)) — наименьшее A.
export function t15DelMin() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const m1 = pick([35, 21, 33, 26, 15]), m2 = pick([21, 14, 22, 39, 10])
    if (m1 === m2) continue
    const holds = (A) => {
      const period = lcm(lcm(A, m1), m2)
      if (period > 200000) return false
      for (let x = 1; x <= period; x++) {
        const left = !(x % m1 === 0) && x % A === 0
        const right = x % m2 === 0 || !(x % A === 0)
        if (left && !right) return false
      }
      return true
    }
    let best = null
    for (let A = 1; A <= 300; A++) if (holds(A)) { best = A; break }
    if (!best || best === 1) continue
    return {
      condition_text: DEL_INTRO +
        "Для какого наименьшего натурального числа A логическое выражение\n" +
        `(¬ДЕЛ(x, ${m1}) /\\ ДЕЛ(x, A)) → (ДЕЛ(x, ${m2}) \\/ ¬ДЕЛ(x, A))\n` +
        "тождественно истинно (т.е. принимает значение 1 при любом натуральном значении переменной x)?",
      answer: String(best),
    }
  }
  return null
}


// ── №19–21 «Выигрышная стратегия» (одна игра, три вопроса) ──────────────────
// Эталон (45 + 45 + 45 основных задач): две кучи камней, ход — добавить камень
// в одну из куч или удвоить одну из куч; игра кончается, когда суммарно камней
// становится не менее N. Три классических вопроса:
//   №19 — минимальное S, при котором Ваня выигрывает первым ходом при любом ходе Пети;
//   №20 — значения S, при которых Петя выигрывает вторым ходом (но не первым);
//   №21 — минимальное S, при котором Ваня выигрывает первым или вторым ходом.
// Всё считается разбором игры «в глубину по числу ходов» — как на бумаге у ученика,
// только машинно; мемоизация по позиции не нужна, глубина не больше четырёх ходов.

const T19_PREAMBLE = (add, mul, N, first) =>
  "Два игрока, Петя и Ваня, играют в следующую игру. Перед игроками лежат две кучи камней. " +
  "Игроки ходят по очереди, первый ход делает Петя. За один ход игрок может добавить в одну из куч " +
  `(по своему выбору) ${add === 1 ? "один камень" : `${add} камня`} или увеличить количество камней в куче в ${mul} раза. ` +
  `Например, пусть в одной куче 10 камней, а в другой 5 камней, такую позицию в игре будем обозначать (10, 5). ` +
  `Тогда за один ход можно получить любую из четырёх позиций: (${10 + add}, 5), (${10 * mul}, 5), (10, ${5 + add}), (10, ${5 * mul}). ` +
  "Для того чтобы делать ходы, у каждого игрока есть неограниченное количество камней.\n" +
  `Игра завершается в тот момент, когда суммарное количество камней в кучах становится не менее ${N}. ` +
  `Победителем считается игрок, сделавший последний ход, т.е. первым получивший кучу, в которой суммарно будет ${N} или больше камней.\n` +
  `В начальный момент в первой куче было ${first} камней, во второй куче — S камней, 1 ≤ S ≤ ${N - first - 1}.\n` +
  "Будем говорить, что игрок имеет выигрышную стратегию, если он может выиграть при любых ходах противника. " +
  "Описать стратегию игрока — значит описать, какой ход он должен сделать в любой ситуации, которая ему может встретиться " +
  "при различной игре противника. В описание выигрышной стратегии не следует включать ходы играющего по этой стратегии игрока, " +
  "не являющиеся для него безусловно выигрышными, т.е. не являющиеся выигрышными независимо от игры противника.\n"

// Разбор игры: ходы из позиции, победа за k своих ходов.
function t19Game(add, mul, N) {
  const moves = ([a, b]) => [[a + add, b], [a * mul, b], [a, b + add], [a, b * mul]]
  const over = ([a, b]) => a + b >= N
  // win1: ходящий выигрывает первым же ходом
  const win1 = (p) => moves(p).some(over)
  // winIn: ходящий выигрывает не более чем за k своих ходов при любой игре соперника
  const winIn = (p, k) => {
    if (k === 0) return false
    if (win1(p)) return true
    return moves(p).some((q) => !over(q) && moves(q).every((r) => over(r) ? false : winIn(r, k - 1)))
  }
  // Проигрыш ходящего в один ход соперника: любой его ход даёт сопернику победу
  const loseNext = (p) => !win1(p) && moves(p).every((q) => over(q) || win1(q))
  return { moves, over, win1, winIn, loseNext }
}

const T19_PARAMS = () => {
  const add = pick([1, 1, 2])
  const mul = 2
  const N = pick([75, 87, 93, 101, 107, 115, 123, 129])
  const first = pick([7, 9, 11, 13, 15, 17])
  return { add, mul, N, first }
}

export function t19FirstMove() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const { add, mul, N, first } = T19_PARAMS()
    const G = t19Game(add, mul, N)
    const good = []
    for (let S = 1; S <= N - first - 1; S++) if (G.loseNext([first, S])) good.push(S)
    if (!good.length) continue
    const askMin = Math.random() < 0.5
    return {
      condition_text: T19_PREAMBLE(add, mul, N, first) +
        "Известно, что Ваня выиграл своим первым ходом при любом ходе Пети. " +
        `Укажите ${askMin ? "минимальное" : "максимальное"} значение S, когда такая ситуация возможна.`,
      answer: String(askMin ? Math.min(...good) : Math.max(...good)),
    }
  }
  return null
}

export function t20SecondMove() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const { add, mul, N, first } = T19_PARAMS()
    const G = t19Game(add, mul, N)
    const good = []
    for (let S = 1; S <= N - first - 1; S++) {
      const p = [first, S]
      if (!G.win1(p) && G.winIn(p, 2)) good.push(S)
    }
    // Формулировка «найдите ДВА значения» обязывает, чтобы их было ровно два.
    if (good.length !== 2) continue
    return {
      condition_text: T19_PREAMBLE(add, mul, N, first) +
        "Найдите два таких значения S, при которых у Пети есть выигрышная стратегия, причём одновременно выполняются два условия:\n" +
        "— Петя не может выиграть за один ход;\n" +
        "— Петя может выиграть своим вторым ходом независимо от того, как будет ходить Ваня.\n" +
        "Найденные значения запишите в ответе в порядке возрастания без разделителей.",
      answer: good.join(""),
    }
  }
  return null
}

export function t21VanyaSecond() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const { add, mul, N, first } = T19_PARAMS()
    const G = t19Game(add, mul, N)
    const good = []
    for (let S = 1; S <= N - first - 1; S++) {
      const p = [first, S]
      if (G.win1(p) || G.winIn(p, 1)) continue                    // у Пети есть быстрый выигрыш
      // У Вани есть выигрыш первым или вторым ходом при любой игре Пети,
      // но нет гарантии выиграть именно первым ходом.
      const vanyaWinsIn2 = G.moves(p).every((q) => !G.over(q) && G.winIn(q, 2))
      const vanyaWinsIn1 = G.moves(p).every((q) => !G.over(q) && G.win1(q))
      if (vanyaWinsIn2 && !vanyaWinsIn1) good.push(S)
    }
    if (!good.length) continue
    return {
      condition_text: T19_PREAMBLE(add, mul, N, first) +
        "Найдите значение S, при котором одновременно выполняются два условия:\n" +
        "— у Вани есть выигрышная стратегия, позволяющая ему выиграть первым или вторым ходом при любой игре Пети;\n" +
        "— у Вани нет стратегии, которая позволит ему гарантированно выиграть первым ходом.\n" +
        "Если найдено несколько значений S, в ответе запишите минимальное из них.",
      answer: String(Math.min(...good)),
    }
  }
  return null
}


// ── №23 «Перебор вариантов, построение дерева» (исполнитель) ────────────────
// Эталон (74 задачи): исполнитель с двумя-тремя командами (прибавить k, умножить на m);
// считаем ЧИСЛО ПРОГРАММ, переводящих A в B, иногда с условием на траекторию
// («содержит X», «не содержит Y», «содержит X, но не содержит Y»).
// Считается динамикой: f(v) — сколько программ переводит v в B.

const T23_EXECUTORS = [
  { name: "Аллегро", cmds: [["Прибавить 1", (v) => v + 1], ["Прибавить 2", (v) => v + 2], ["Умножить на 3", (v) => v * 3]] },
  { name: "Калькулятор", cmds: [["Прибавить 1", (v) => v + 1], ["Умножить на 2", (v) => v * 2]] },
  { name: "Вычислитель", cmds: [["Прибавить 1", (v) => v + 1], ["Умножить на 3", (v) => v * 3]] },
  { name: "Калькулятор", cmds: [["Прибавить 2", (v) => v + 2], ["Умножить на 3", (v) => v * 3]] },
  { name: "Вычислитель", cmds: [["Прибавить 3", (v) => v + 3], ["Умножить на 2", (v) => v * 2]] },
]

export function t23Programs() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const ex = pick(T23_EXECUTORS)
    const start = randInt(1, 6)
    const target = randInt(25, 90)
    if (target <= start) continue
    const kind = randInt(0, 3)                       // 0 — без условий, 1 — через X, 2 — через X без Y, 3 — через X и Y
    const via = randInt(start + 1, target - 1)
    const ban = randInt(start + 1, target - 1)
    const via2 = randInt(via + 1, target - 1)
    if (kind === 2 && (ban === via || ban <= via)) continue
    if (kind === 3 && via2 <= via) continue
    // f(v, passed) — число программ из v в target; passed — прошли ли через via.
    const memo = new Map()
    const count = (v, passed, passed2) => {
      if (kind >= 1 && v === via) passed = true
      if (kind === 3 && v === via2) passed2 = true
      if (kind === 2 && v === ban) return 0
      if (v === target) return (kind === 0 || (passed && (kind !== 3 || passed2))) ? 1 : 0
      if (v > target) return 0
      const key = `${v}|${passed}|${passed2}`
      if (memo.has(key)) return memo.get(key)
      let n = 0
      for (const [, f] of ex.cmds) n += count(f(v), passed, passed2)
      memo.set(key, n)
      return n
    }
    const answer = count(start, false, false)
    if (answer < 3 || answer > 100000) continue
    const cmdList = ex.cmds.map(([label], i) => `${i + 1}. ${label}`).join("\n")
    const descr = ex.cmds.map(([label]) => {
      const m = /Прибавить (\d+)/.exec(label)
      return m ? `увеличивает число на экране на ${m[1]}` : `умножает его на ${/Умножить на (\d+)/.exec(label)[1]}`
    })
    const trailExample = (() => {
      let v = start + 7
      const prog = "12".slice(0, Math.min(2, ex.cmds.length))
      const steps = []
      for (const c of prog) { v = ex.cmds[Number(c) - 1][1](v); steps.push(v) }
      return { from: start + 7, prog, steps }
    })()
    const ask = kind === 3
      ? `Сколько существует таких программ, которые преобразуют исходное число ${start} в число ${target} и при этом траектория вычислений программы содержит числа ${via} и ${via2}?`
      : kind === 0
      ? `Сколько существует программ, для которых при исходном числе ${start} результатом является число ${target}?`
      : kind === 1
        ? `Сколько существует программ, для которых при исходном числе ${start} результатом является число ${target} и при этом траектория вычислений содержит число ${via}?`
        : `Сколько существует программ, для которых при исходном числе ${start} результатом является число ${target} и при этом траектория вычислений содержит число ${via}, но не содержит число ${ban}?`
    return {
      condition_text:
        `Исполнитель ${ex.name} преобразует число на экране.\n` +
        `У исполнителя есть ${NUMW[ex.cmds.length]} команды, которым присвоены номера:\n` + cmdList + "\n" +
        `Первая команда ${descr[0]}, вторая ${descr[1]}${descr[2] ? `, третья ${descr[2]}` : ""}. ` +
        `Программа для исполнителя ${ex.name} — это последовательность команд.\n` + ask + "\n" +
        "Траектория вычислений программы — это последовательность результатов выполнения всех команд программы. " +
        `Например, для программы ${trailExample.prog} при исходном числе ${trailExample.from} траектория будет состоять из чисел ${trailExample.steps.join(", ")}.`,
      answer: String(answer),
    }
  }
  return null
}

// ── №25 «Обработка целочисленной информации» (маски чисел) ──────────────────
// Эталон (49 основных задач): маска с «?» (одна цифра) и «*» (любая последовательность);
// найти все числа ≤ 10⁸, подходящие под маску и делящиеся на D, вывести их и частные.
// Перебираем кратные D (делитель трёхзначный — это ≈ 400 000 шагов, мгновенно).
export function t25Mask() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const D = randInt(101, 999)
    const LIMIT = 100000000
    const head = String(randInt(10, 99))
    const tail = String(randInt(100, 999))
    const mask = Math.random() < 0.5
      ? `${head}*${tail}`
      : `${head}??${randInt(10, 99)}*${randInt(1, 9)}`
    const re = new RegExp("^" + mask.replace(/\?/g, "\\d").replace(/\*/g, "\\d*") + "$")
    const found = []
    for (let v = D; v <= LIMIT; v += D) {
      if (re.test(String(v))) { found.push(v); if (found.length > 8) break }
    }
    if (found.length < 3 || found.length > 6) continue
    return {
      condition_text:
        "Назовём маской числа последовательность цифр, в которой также могут встречаться следующие символы:\n" +
        "— символ «?» означает ровно одну произвольную цифру;\n" +
        "— символ «*» означает любую последовательность цифр произвольной длины; в том числе «*» может задавать и пустую последовательность.\n" +
        "Например, маске 123*4?5 соответствуют числа 123405 и 12300405.\n" +
        `Среди натуральных чисел, не превышающих 10⟦sup:8⟧, найдите все числа, соответствующие маске ${mask}, делящиеся на ${D} без остатка.\n` +
        `В ответе запишите в первом столбце таблицы все найденные числа в порядке возрастания, ` +
        `а во втором столбце — соответствующие им результаты деления этих чисел на ${D}.`,
      answer: found.map((v) => `${v} — ${v / D}`).join("; "),
    }
  }
  return null
}


// Второй типаж №25 — «напишите программу»: перебор чисел с условием на делители.
// Ответ — первые пять найденных чисел и требуемый множитель для каждого.
const isPrime = (n) => {
  if (n < 2) return false
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false
  return true
}

export function t25Semiprime() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const start = randInt(100000, 900000)
    const found = []
    for (let v = start + 1; found.length < 5 && v < start + 400000; v++) {
      // произведение ровно двух простых множителей (не обязательно различных)
      let p = 0
      for (let d = 2; d * d <= v; d++) if (v % d === 0 && isPrime(d) && isPrime(v / d)) { p = d; break }
      if (p) found.push([v, p])
    }
    if (found.length < 5) continue
    return {
      condition_text:
        `Напишите программу, которая перебирает целые числа, бо́льшие ${start.toLocaleString("ru-RU").replace(/\s/g, "\u00A0")}, в порядке возрастания ` +
        "и ищет среди них числа, представленные в виде произведения ровно двух простых множителей, не обязательно различных.\n" +
        "В ответе в первом столбце таблицы запишите первые 5 найденных чисел в порядке возрастания, " +
        "а во втором столбце — для каждого из них соответствующий наименьший найденный множитель.",
      answer: found.map(([v, p]) => `${v} — ${p}`).join("; "),
    }
  }
  return null
}

export function t25DivisorEnding() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const start = pick([500000, 600000, 700000, 800000])
    const digit = pick([2, 3, 7, 8, 9])
    const found = []
    for (let v = start + 1; found.length < 5 && v < start + 200000; v++) {
      let best = null
      for (let d = 2; d * d <= v; d++) {
        if (v % d) continue
        for (const cand of [d, v / d]) {
          if (cand !== v && cand !== digit && cand % 10 === digit && (best === null || cand < best)) best = cand
        }
      }
      if (best !== null) found.push([v, best])
    }
    if (found.length < 5) continue
    return {
      condition_text:
        `Напишите программу, которая перебирает целые числа, бо́льшие ${start.toLocaleString("ru-RU").replace(/\s/g, "\u00A0")}, в порядке возрастания ` +
        `и ищет среди них такие, у которых есть натуральный делитель, оканчивающийся на цифру ${digit} и не равный ни самому числу, ни числу ${digit}. ` +
        `Выведите первые пять найденных чисел и для каждого наименьший делитель, оканчивающийся на цифру ${digit}, ` +
        `не равный ни самому числу, ни числу ${digit}.\n` +
        "Строки выводятся в порядке возрастания найденных чисел.",
      answer: found.map(([v, p]) => `${v} — ${p}`).join("; "),
    }
  }
  return null
}


// Адрес файла в Интернете по фрагментам, закодированным буквами А–Ж: ученик
// собирает адрес вида протокол://сервер/файл и записывает последовательность букв.
// (В экспорте банка сама таблица фрагментов потерялась, поэтому фрагменты
// разбиты по тем же правилам, что в КИМ: протокол, «://», части сервера, «/», файл.)
const T13_URL_LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж"]
const T13_PROTO = ["http", "ftp"]
const T13_WORDS = ["www", "txt", "net", "org", "com", "ftp", "http", "doc", "edu", "ru"]

export function t13Url() {
  const proto = pick(T13_PROTO)
  const [s1, s2, f1, f2] = shuffle(T13_WORDS).slice(0, 4)
  const server = `${s1}.${s2}`
  const file = `${f1}.${f2}`
  // Фрагменты — ровно семь, как в задании: протокол, «://», две части сервера, «/», две части файла.
  const parts = [proto, "://", `${s1}.`, s2, "/", `${f1}.`, f2]
  const order = shuffle(parts.map((p, i) => ({ p, i })))
  const rows = order.map((o, k) => [`${T13_URL_LETTERS[k]})`, o.p])
  const answer = parts.map((p) => T13_URL_LETTERS[order.findIndex((o) => o.p === p && parts[o.i] === p)]).join("")
  // Соответствие «фрагмент → буква» ищем по позиции в исходном списке, иначе
  // одинаковые фрагменты (например «txt.» и «txt») перепутались бы местами.
  const letterOf = (idx) => T13_URL_LETTERS[order.findIndex((o) => o.i === idx)]
  const exact = parts.map((_, idx) => letterOf(idx)).join("")
  return {
    condition_text:
      `Доступ к файлу ${file}, находящемуся на сервере ${server}, осуществляется по протоколу ${proto}. ` +
      "В таблице фрагменты адреса файла закодированы буквами от А до Ж. " +
      "Запишите последовательность этих букв, кодирующую адрес указанного файла в сети Интернет.\n" +
      tableBlock([["Буква", "Фрагмент"], ...rows]),
    answer: exact || answer,
  }
}

// Перемещение по каталогам: из последовательности посещённых каталогов восстановить,
// откуда пользователь начал (либо где оказался). Спуск/подъём на один уровень.
export function t11Catalogs() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const names = shuffle(["DOC", "USER", "SCHOOL", "LETTER", "INBOX", "WORK", "TEXT", "DATA"])
    const disk = pick(["A:\\", "C:\\", "D:\\"])
    const depth = randInt(2, 3)
    // Строим маршрут: сначала поднимаемся до корня, потом спускаемся в другую ветку.
    const up = names.slice(0, depth)                    // начальный путь (снизу вверх)
    const down = names.slice(depth, depth + depth)      // конечный путь (сверху вниз)
    const visited = [...up, disk, ...down]
    const startPath = disk + [...up].reverse().join("\\")
    const endPath = disk + down.join("\\")
    const askStart = Math.random() < 0.5
    const right = askStart ? startPath : endPath
    const wrong = shuffle([
      disk + up.join("\\"),
      disk + down.slice().reverse().join("\\"),
      askStart ? endPath : startPath,
      disk + names[0],
    ].filter((w) => w !== right)).slice(0, 3)
    const options = shuffle([right, ...wrong])
    return {
      condition_text:
        `Перемещаясь из одного каталога в другой, пользователь последовательно посетил каталоги ${visited.join(", ")}. ` +
        "При каждом перемещении пользователь либо спускался в каталог на уровень ниже, либо поднимался на уровень выше. " +
        `Каково полное имя каталога, ${askStart ? "из которого начал перемещение пользователь" : "в котором оказался пользователь"}?\n` +
        tableBlock([["№", "Вариант"], ...options.map((o, i) => [`${i + 1})`, o])]) + "\n" +
        "В ответе укажите номер варианта.",
      answer: String(options.indexOf(right) + 1),
    }
  }
  return null
}

// Поразрядная конъюнкция: наименьшее A, при котором формула тождественно истинна.
// Достаточно перебрать x до 2^k (k — старший значащий бит участвующих констант):
// старшие биты x на значение формулы не влияют.
export function t15BitAnd() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const m = randInt(5, 120), n = randInt(5, 120)
    if ((m & n) === 0 || m === n) continue
    const BITS = 9, LIM = 1 << BITS
    const kind = randInt(0, 1)
    // kind 0: ((x & m ≠ 0) /\ (x & n = 0)) → ¬(x & A = 0)
    // kind 1: (x & m ≠ 0) → ((x & n ≠ 0) \/ ¬(x & A = 0))
    const holds = (A) => {
      for (let x = 0; x < LIM; x++) {
        const left = kind === 0 ? ((x & m) !== 0 && (x & n) === 0) : ((x & m) !== 0)
        const right = kind === 0 ? ((x & A) !== 0) : ((x & n) !== 0 || (x & A) !== 0)
        if (left && !right) return false
      }
      return true
    }
    let best = null
    for (let A = 0; A < LIM; A++) if (holds(A)) { best = A; break }
    if (best === null || best === 0 || best > 400) continue
    const formula = kind === 0
      ? `((x & ${m} ≠ 0) /\\ (x & ${n} = 0)) → ¬(x & A = 0)`
      : `(x & ${m} ≠ 0) → ((x & ${n} ≠ 0) \\/ ¬(x & A = 0))`
    return {
      condition_text:
        "Обозначим через m & n поразрядную конъюнкцию неотрицательных целых чисел m и n. " +
        "Так, например, 14 & 5 = 1110⟦b:2⟧ & 0101⟦b:2⟧ = 0100⟦b:2⟧ = 4.\n" +
        `Для какого наименьшего неотрицательного целого числа A формула\n${formula}\n` +
        "тождественно истинна (т.е. принимает значение 1) при любом неотрицательном целом значении переменной x?",
      answer: String(best),
    }
  }
  return null
}


// Экономия трафика: снимок пересохраняют в другом разрешении и с другой глубиной
// цвета — сколько Кбайт экономится на партии фотографий (ответ — целая часть).
export function t7Traffic() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const w1 = pick([1024, 1280, 1920, 2560, 3840]), h1 = pick([768, 1024, 1080, 1440, 2160])
    const bits1 = randInt(16, 30)
    const w2 = pick([640, 800, 1024, 1280]), h2 = pick([480, 600, 768, 1024])
    const bits2 = pick([8, 12, 16, 20, 24])
    const one = w1 * h1 * bits1, two = w2 * h2 * bits2
    if (one <= two) continue
    const count = pick([50, 60, 80, 100, 120, 150, 200])
    const kb = Math.floor((one - two) * count / 8 / KB)
    if (kb < 100) continue
    return {
      condition_text:
        "Виталий фотографирует интересные места и события с помощью своего смартфона. " +
        `Каждая фотография представляет собой растровое изображение размером ${w1}×${h1} пикселей, ` +
        `при этом используется палитра из 2⟦sup:${bits1}⟧ цветов. ` +
        "В конце дня Виталий отправляет снимки друзьям с помощью приложения-мессенджера. " +
        `Для экономии трафика приложение оцифровывает снимки повторно, используя размер ${w2}×${h2} пикселей ` +
        `и глубину цвета ${bits2} бит. Сколько Кбайт трафика экономится при передаче ${count} фотографий? ` +
        "В ответе укажите целую часть полученного числа.",
      answer: String(kb),
    }
  }
  return null
}

// Числа, у которых все цифры различны и никакие две чётные (или две нечётные) цифры
// не стоят рядом. Перебор всех чисел системы счисления — не больше 10⁵ вариантов.
export function t8DistinctAlternating() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const base = pick([8, 9, 10, 10])
    const len = pick([4, 5])
    const extra = randInt(0, 2)                     // 0 — без ограничений, 1 — без цифры d, 2 — кратно 5
    const d = randInt(1, base - 1)
    let n = 0
    const total = Math.pow(base, len)
    for (let v = 0; v < total; v++) {
      const digits = []
      let x = v
      for (let i = 0; i < len; i++) { digits.unshift(x % base); x = Math.floor(x / base) }
      if (digits[0] === 0) continue
      if (new Set(digits).size !== len) continue                       // все цифры различны
      let ok = true
      for (let i = 1; i < len; i++) if (digits[i] % 2 === digits[i - 1] % 2) { ok = false; break }
      if (!ok) continue
      if (extra === 1 && digits.includes(d)) continue
      if (extra === 2 && base === 10 && digits[len - 1] !== 5 && digits[len - 1] !== 0) continue
      n++
    }
    if (n < 20) continue
    const baseWord = base === 10 ? "десятичных" : base === 8 ? "восьмеричных" : "девятеричных"
    const lenWord = len === 4 ? "четырёхзначных" : "пятизначных"
    const cond = extra === 1 ? `, не содержащих в своей записи цифру ${d},`
      : extra === 2 && base === 10 ? ", делящихся на 5," : ","
    return {
      condition_text:
        `Сколько существует ${baseWord} ${lenWord} чисел${cond} в которых все цифры различны ` +
        "и никакие две чётные или две нечётные цифры не стоят рядом?",
      answer: String(n),
    }
  }
  return null
}

// M — сумма минимального и максимального собственных делителей (кроме 1 и самого
// числа); у простых чисел M считаем равным нулю. Найти числа с условием на M.
export function t25MinMaxDivisors() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const start = pick([300000, 452021, 500000, 600000, 800000])
    // M = наименьший собственный делитель + наибольший собственный делитель.
    // Наибольший — это v / наименьший (у ФИПИ пример: для 20 M = 2 + 10 = 12),
    // поэтому достаточно найти первый делитель.
    const M = (v) => {
      for (let d = 2; d * d <= v; d++) if (v % d === 0) return d + v / d
      return 0
    }
    const byDigit = Math.random() < 0.5
    const digit = randInt(0, 9)
    const mod = pick([7, 9, 11, 13]), rest = randInt(1, 5)
    const fits = (m) => (m !== 0) && (byDigit ? m % 10 === digit : m % mod === rest)
    const found = []
    for (let v = start + 1; found.length < 5 && v < start + 60000; v++) {
      const m = M(v)
      if (fits(m)) found.push([v, m])
    }
    if (found.length < 5) continue
    return {
      condition_text:
        "Пусть M — сумма минимального и максимального натуральных делителей целого числа, не считая единицы и самого числа. " +
        "Если таких делителей у числа нет, то считаем значение M равным нулю.\n" +
        `Напишите программу, которая перебирает целые числа, бо́льшие ${start.toLocaleString("ru-RU").replace(/\s/g, "\u00A0")}, ` +
        "в порядке возрастания и ищет среди них такие, для которых " +
        (byDigit ? `M оканчивается на ${digit}` : `значение M при делении на ${mod} даёт в остатке ${rest}`) + ". " +
        "Выведите первые пять найденных чисел и соответствующие им значения M.\n" +
        "Например, для числа 20 M = 2 + 10 = 12.",
      answer: found.map(([v, m]) => `${v} — ${m}`).join("; "),
    }
  }
  return null
}


// ── Исполнитель МТ (машина Тьюринга) — типаж №12 ─────────────────────────────
// Программа задаётся таблицей: строки — состояния, столбцы — символы ленты,
// в ячейке «что записать, куда сдвинуться (L/R/S), в какое состояние перейти».
// На ленте — двоичная запись числа; ученик прослеживает работу и переводит
// результат в десятичную систему. Эмулятор ниже исполняет ровно ту таблицу,
// которая напечатана в условии, — разойтись они не могут.
const T12_MT_INTRO =
  "Исполнитель МТ представляет собой читающую и записывающую головку, которая может передвигаться вдоль бесконечной " +
  "горизонтальной ленты, разделённой на равные ячейки. В каждой ячейке находится ровно один символ из алфавита исполнителя, " +
  "включая специальный пустой символ «λ». Время работы исполнителя делится на дискретные такты (шаги). На каждом такте головка " +
  "находится в одном из допустимых состояний; в начальный момент времени головка находится в состоянии q⟦b:0⟧. " +
  "За один такт головка может изменить символ в текущей ячейке и переместиться в соседнюю ячейку слева (L) или справа (R) " +
  "либо остаться на месте (S), после чего переходит в новое состояние. Программа задаётся таблицей: в первой строке — символы " +
  "ленты, в первом столбце — состояния головки; на пересечении — команда «символ, сдвиг, состояние». Пустая ячейка означает, " +
  "что такая ситуация при работе программы не встречается.\n"

// Программы МТ. cells: состояние → символ → [что записать, сдвиг, новое состояние].
// halt — состояние, в котором машина останавливается (команда со сдвигом S).
const T12_MT_PROGRAMS = [
  { title: "приписать единицу слева",
    start: "right",                            // головка справа от числа
    cells: {
      q0: { "λ": ["λ", "L", "q1"], "0": null, "1": null },
      q1: { "λ": ["1", "L", "q2"], "0": ["0", "L", "q1"], "1": ["1", "L", "q1"] },
      q2: { "λ": ["λ", "S", "q2"], "0": null, "1": null },
    } },
  { title: "инвертировать все двоичные цифры",
    start: "right",
    cells: {
      q0: { "λ": ["λ", "L", "q1"], "0": null, "1": null },
      q1: { "λ": ["λ", "S", "q2"], "0": ["1", "L", "q1"], "1": ["0", "L", "q1"] },
      q2: { "λ": ["λ", "S", "q2"], "0": null, "1": null },
    } },
  { title: "прибавить единицу к двоичному числу",
    start: "right",
    cells: {
      q0: { "λ": ["λ", "L", "q1"], "0": null, "1": null },
      q1: { "λ": ["1", "S", "q2"], "0": ["1", "S", "q2"], "1": ["0", "L", "q1"] },
      q2: { "λ": ["λ", "S", "q2"], "0": ["0", "S", "q2"], "1": ["1", "S", "q2"] },
    } },
  { title: "приписать нуль справа",
    start: "right",
    cells: {
      q0: { "λ": ["0", "L", "q1"], "0": null, "1": null },
      q1: { "λ": ["λ", "S", "q1"], "0": ["0", "L", "q1"], "1": ["1", "L", "q1"] },
    } },
]

// Исполнение программы над лентой. tape — объект «позиция → символ», head — позиция.
function t12RunMT(prog, bits) {
  const tape = {}
  bits.split("").forEach((c, i) => { tape[i] = c })
  let head = bits.length                       // ближайшая справа пустая ячейка
  let state = "q0"
  for (let step = 0; step < 10000; step++) {
    const sym = tape[head] || "λ"
    const cmd = prog.cells[state] && prog.cells[state][sym]
    if (!cmd) return null                      // такой ситуации быть не должно
    const [write, move, next] = cmd
    if (write === "λ") delete tape[head]; else tape[head] = write
    if (move === "S" && next === state) {      // остановка
      const keys = Object.keys(tape).map(Number).sort((a, b) => a - b)
      return keys.map((k) => tape[k]).join("")
    }
    head += move === "L" ? -1 : move === "R" ? 1 : 0
    state = next
  }
  return null
}

export function t12Turing() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const prog = pick(T12_MT_PROGRAMS)
    const n = randInt(500, 3000)
    const bits = n.toString(2)
    const res = t12RunMT(prog, bits)
    if (!res || !/^[01]+$/.test(res)) continue
    const states = Object.keys(prog.cells)
    const table = tableBlock([
      ["", "λ", "0", "1"],
      ...states.map((q) => [`q⟦b:${q.slice(1)}⟧`, ...["λ", "0", "1"].map((sym) => {
        const c = prog.cells[q][sym]
        return c ? `${c[0]}, ${c[1]}, q⟦b:${c[2].slice(1)}⟧` : ""
      })]),
    ])
    return {
      condition_text: T12_MT_INTRO +
        `На ленте в соседних ячейках записано двоичное представление числа ${n} без ведущих нулей. ` +
        "Ячейки справа и слева от последовательности заполнены пустыми символами «λ». " +
        "В начальный момент времени головка расположена в ближайшей справа к последовательности ячейке. " +
        "Программа работы исполнителя:\n" + table + "\n" +
        "Определите результат выполнения программы. В ответе запишите получившееся число в десятичной системе счисления.",
      answer: String(parseInt(res, 2)),
    }
  }
  return null
}

// «Наибольшее возможное значение суммы цифр результата» — максимум по всем n
// из диапазона (программа с ЕСЛИ/ИНАЧЕ, вход «d» + n одинаковых цифр).
export function t12EditorMaxSum() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const sets = [
      { rules: [["39", "3"], ["999", "7"], ["7777", "9"]], head: "3", body: "9" },
      { rules: [["28", "2"], ["888", "5"], ["5555", "8"]], head: "2", body: "8" },
      { rules: [["17", "1"], ["777", "4"], ["4444", "7"]], head: "1", body: "7" },
    ]
    const set = pick(sets)
    const NMAX = 400
    let best = 0, ok = true
    for (let n = 4; n <= NMAX; n++) {
      // Первое правило — в отдельном ЕСЛИ, второе и третье — ЕСЛИ/ИНАЧЕ.
      let str = set.head + set.body.repeat(n), guard = 0
      while (guard++ < 200000) {
        const has = set.rules.some(([v]) => str.includes(v))
        if (!has) break
        const [v1, w1] = set.rules[0]
        if (str.includes(v1)) { const i = str.indexOf(v1); str = str.slice(0, i) + w1 + str.slice(i + v1.length) }
        const [v2, w2] = set.rules[1], [v3, w3] = set.rules[2]
        if (str.includes(v2)) { const i = str.indexOf(v2); str = str.slice(0, i) + w2 + str.slice(i + v2.length) }
        else if (str.includes(v3)) { const i = str.indexOf(v3); str = str.slice(0, i) + w3 + str.slice(i + v3.length) }
      }
      if (guard >= 200000) { ok = false; break }
      best = Math.max(best, digitSum(str))
    }
    if (!ok || best === 0) continue
    const program = "НАЧАЛО\n" +
      "ПОКА " + set.rules.map(([v]) => `нашлось (${v})`).join(" ИЛИ ") + "\n" +
      `ЕСЛИ нашлось (${set.rules[0][0]})\nТО заменить (${set.rules[0][0]}, ${set.rules[0][1]})\nКОНЕЦ ЕСЛИ\n` +
      `ЕСЛИ нашлось (${set.rules[1][0]})\nТО заменить (${set.rules[1][0]}, ${set.rules[1][1]})\n` +
      `ИНАЧЕ заменить (${set.rules[2][0]}, ${set.rules[2][1]})\nКОНЕЦ ЕСЛИ\n` +
      "КОНЕЦ ПОКА\nКОНЕЦ"
    return {
      condition_text: T12_PREAMBLE +
        "В конструкции\nЕСЛИ условие\nТО команда1\nИНАЧЕ команда2\nКОНЕЦ ЕСЛИ\n" +
        "выполняется команда1 (если условие истинно) или команда2 (если условие ложно).\n" +
        "Дана программа для Редактора:\n" + program + "\n" +
        `На вход приведённой выше программе поступает строка, начинающаяся с цифры «${set.head}», ` +
        `а затем содержащая n цифр «${set.body}» (3 < n < ${NMAX}).\n` +
        "Определите наибольшее возможное значение суммы числовых значений цифр в строке, которая может быть результатом выполнения программы.",
      answer: String(best),
    }
  }
  return null
}


// Минимальный объём памяти под изображение при заданном числе цветов.
export function t7Reserve() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const w = pick([320, 640, 800, 1024]), h = pick([200, 240, 320, 480, 600])
    const colors = pick([16, 32, 64, 128, 256, 1024, 4096])
    const bytes = w * h * bitsFor(colors) / 8
    if (!Number.isInteger(bytes) || bytes % KB !== 0) continue
    return {
      condition_text:
        `Какой минимальный объём памяти (в Кбайт) нужно зарезервировать, чтобы можно было сохранить любое растровое изображение ` +
        `размером ${w}×${h} пикселей при условии, что в изображении могут использоваться ${colors} различных цветов? ` +
        "Для кодирования цвета каждого пикселя используется одинаковое количество бит, коды пикселей записываются в файл один за другим без промежутков. " +
        "Искомый объём не учитывает размера заголовка файла. В ответе запишите только целое число, единицу измерения писать не нужно.",
      answer: String(bytes / KB),
    }
  }
  return null
}

// Скорость соединения и время передачи → размер файла (в Кбайт).
export function t7Adsl() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const speed = pick([128000, 256000, 512000, 1024000, 64000])
    const minutes = randInt(1, 6)
    const bytes = speed * minutes * 60 / 8
    if (bytes % KB !== 0) continue
    return {
      condition_text:
        `Скорость передачи данных через ADSL-соединение равна ${speed} бит/с. ` +
        `Передача файла через данное соединение заняла ${mins(minutes)}. Определите размер файла в килобайтах.`,
      answer: String(bytes / KB),
    }
  }
  return null
}

// R — сумма делителей числа (всех или без единицы и самого числа).
export function t25SumDivisors() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const start = pick([300000, 500000, 600000, 700000])
    const proper = Math.random() < 0.5                     // без 1 и самого числа
    const digit = randInt(0, 9)
    const R = (v) => {
      let s = proper ? 0 : 1 + v
      for (let d = 2; d * d <= v; d++) {
        if (v % d) continue
        s += d
        if (d !== v / d) s += v / d
      }
      return s
    }
    const found = []
    for (let v = start + 1; found.length < 5 && v < start + 30000; v++) {
      const r = R(v)
      if (r % 10 === digit) found.push([v, r])
    }
    if (found.length < 5) continue
    return {
      condition_text:
        `Пусть R — сумма ${proper ? "различных натуральных делителей целого числа, не считая единицы и самого числа" : "всех различных натуральных делителей целого числа"}.\n` +
        `Напишите программу, которая перебирает целые числа, бо́льшие ${start.toLocaleString("ru-RU").replace(/\s/g, " ")}, ` +
        `в порядке возрастания и ищет среди них такие, для которых значение R оканчивается на цифру ${digit}. ` +
        "Выведите первые пять найденных чисел и соответствующие им значения R.\n" +
        (proper ? "Например, для числа 20 R = 2 + 4 + 5 + 10 = 21." : "Например, для числа 20 R = 1 + 2 + 4 + 5 + 10 + 20 = 42."),
      answer: found.map(([v, r]) => `${v} — ${r}`).join("; "),
    }
  }
  return null
}

// Фрагмент алгоритма со строковыми функциями Длина/Извлечь/Склеить: что окажется
// в переменной b. Исполняется тем же кодом, что напечатан в условии.
const T12_STR_WORDS = ["ПОЕЗД", "КОРАБЛЬ", "МАШИНА", "САМОЛЁТ", "ВЕЛОСИПЕД", "ТРАМВАЙ", "АВТОБУС"]
export function t12StringAlg() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const word = pick(T12_STR_WORDS)
    const step = randInt(1, 3)
    const startLetter = pick(["А", "Б", "К"])
    const endLetter = pick(["Т", "Я", "Ь"])
    const backwards = Math.random() < 0.6
    let b = startLetter
    if (backwards) { for (let i = word.length; i > 0; i -= step) b += word[i - 1] }
    else { for (let i = 1; i <= word.length; i += step) b += word[i - 1] }
    b += endLetter
    const code = backwards
      ? `i := Длина(a)\nk := ${step}\nb := '${startLetter}'\nпока i > 0\n  нц\n    c := Извлечь(a, i)\n    b := Склеить(b, c)\n    i := i – k\n  кц\nb := Склеить(b, '${endLetter}')`
      : `i := 1\nk := ${step}\nb := '${startLetter}'\nпока i <= Длина(a)\n  нц\n    c := Извлечь(a, i)\n    b := Склеить(b, c)\n    i := i + k\n  кц\nb := Склеить(b, '${endLetter}')`
    // Отвлекающие варианты — правдоподобные ошибки: другой шаг, обратный порядок, без хвоста.
    const wrongs = new Set()
    let alt = startLetter
    for (let i = word.length; i > 0; i -= (step === 1 ? 2 : 1)) alt += word[i - 1]
    wrongs.add(alt + endLetter)
    wrongs.add(startLetter + [...b.slice(1, -1)].reverse().join("") + endLetter)
    wrongs.add(b.slice(0, -1))
    const options = shuffle([b, ...[...wrongs].filter((w) => w !== b).slice(0, 3)])
    if (options.length < 4) continue
    return {
      condition_text:
        "В приведённом ниже фрагменте алгоритма, записанном на алгоритмическом языке, переменные a, b, c имеют тип «строка», " +
        "а переменные i, k — тип «целое». Используются следующие функции:\n" +
        "Длина(a) — возвращает количество символов в строке a (тип «целое»).\n" +
        "Извлечь(a, i) — возвращает i-й (слева) символ строки a (тип «строка»).\n" +
        "Склеить(a, b) — возвращает строку, в которой записаны сначала все символы строки a, а затем все символы строки b (тип «строка»).\n" +
        "Значения строк записываются в одинарных кавычках (например, a := 'дом').\n" +
        "Фрагмент алгоритма:\n⟦code:" + code + "⟧\n" +
        `Какое значение будет у переменной b после выполнения этого фрагмента, если значение переменной a было '${word}'?\n` +
        tableBlock([["№", "Вариант"], ...options.map((o, i) => [`${i + 1})`, `'${o}'`])]) + "\n" +
        "В ответе укажите номер варианта.",
      answer: String(options.indexOf(b) + 1),
    }
  }
  return null
}


// Старый формат №4: буквы кодируются последовательными двухразрядными числами,
// последовательность записывают шестнадцатеричным кодом.
export function t4SeqHex() {
  const letters = ["А", "Б", "В", "Г"]
  const word = Array.from({ length: 4 }, () => pick(letters)).join("")
  const bits = [...word].map((c) => letters.indexOf(c).toString(2).padStart(2, "0")).join("")
  const hex = parseInt(bits, 2).toString(16).toUpperCase().padStart(2, "0")
  const wrong = new Set([
    parseInt([...bits].reverse().join(""), 2).toString(16).toUpperCase(),
    [...word].map((c) => letters.indexOf(c)).join(""),
    parseInt(bits, 2).toString(10),
  ])
  const options = shuffle([hex, ...[...wrong].filter((w) => w !== hex).slice(0, 3)])
  return {
    condition_text:
      `Для кодирования букв ${letters.join(", ")} решили использовать двухразрядные последовательные двоичные числа ` +
      "(от 00 до 11 соответственно). Если таким способом закодировать последовательность символов " +
      `${word} и записать результат шестнадцатеричным кодом, то получится:\n` +
      tableBlock([["№", "Вариант"], ...options.map((o, i) => [`${i + 1})`, o])]) + "\n" +
      "В ответе укажите номер варианта.",
    answer: String(options.indexOf(hex) + 1),
  }
}

// Старый формат №4: из четырёх сообщений только одно декодируется однозначно
// в заданной (непрефиксной) кодировке — найти его.
export function t4UniqueDecode() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const letters = shuffle(["В", "К", "А", "Р", "Д", "О", "М", "С"]).slice(0, 5)
    const codes = ["000", "11", "01", "001", "10"]
    const map = Object.fromEntries(letters.map((l, i) => [l, codes[i]]))
    // Декодирование перебором: сколько разборов у строки (0 — нельзя, 1 — однозначно).
    const ways = (str) => {
      const memo = new Map()
      const rec = (i) => {
        if (i === str.length) return 1
        if (memo.has(i)) return memo.get(i)
        let n = 0
        for (const c of codes) if (str.startsWith(c, i)) n += rec(i + c.length)
        memo.set(i, n)
        return n
      }
      return rec(0)
    }
    const word = Array.from({ length: randInt(5, 7) }, () => pick(letters)).join("")
    const right = [...word].map((c) => map[c]).join("")
    if (ways(right) !== 1) continue
    const wrongs = new Set()
    for (let k = 0; k < 200 && wrongs.size < 3; k++) {
      const bits = [...right]
      const i = randInt(0, bits.length - 1)
      bits[i] = bits[i] === "0" ? "1" : "0"
      const cand = bits.join("")
      if (cand !== right && ways(cand) !== 1) wrongs.add(cand)
    }
    if (wrongs.size < 3) continue
    const options = shuffle([right, ...[...wrongs]])
    return {
      condition_text:
        `Для ${letters.length} букв русского алфавита заданы их двоичные коды (для некоторых букв — из двух бит, для некоторых — из трёх). ` +
        "Эти коды представлены в таблице:\n" +
        tableBlock([letters, letters.map((l) => map[l])]) + "\n" +
        "Из четырёх полученных сообщений в этой кодировке только одно прошло без ошибки и может быть корректно декодировано. Найдите его:\n" +
        tableBlock([["№", "Сообщение"], ...options.map((o, i) => [`${i + 1})`, o])]) + "\n" +
        "В ответе укажите номер варианта.",
      answer: String(options.indexOf(right) + 1),
    }
  }
  return null
}

// Составляющие цвета пикселя: сколько бит отвели под зелёную.
export function t7Rgb() {
  const other = pick([4, 5, 6])
  const green = pick([5, 6, 8, 10])
  const w = pick([8, 16, 32]), h = w
  const bytes = w * h * (2 * other + green) / 8
  if (!Number.isInteger(bytes)) return null
  const options = shuffle([...new Set([green, other, green + 2, green * 2])]).slice(0, 4)
  if (!options.includes(green)) options[0] = green
  return {
    condition_text:
      "Цвет пикселя монитора определяется тремя составляющими: зелёной, синей и красной. " +
      `Под красную и синюю составляющие одного пикселя отвели по ${other} бит. ` +
      `Сколько бит отвели под зелёную составляющую одного пикселя, если растровое изображение размером ${w}×${h} пикселей ` +
      `занимает ${bytes} байт памяти?`,
    answer: String(green),
  }
}

// Объём текста в Unicode: каждый символ — два байта.
const T7_SENTENCES = [
  "Один пуд — около 16,4 килограмма.",
  "В одном килобайте 1024 байта.",
  "Скорость света в вакууме — 299 792 458 м/с.",
  "Информатика — наука о способах обработки информации.",
  "Земля делает оборот вокруг Солнца за 365 суток.",
]
export function t7Unicode() {
  const sentence = pick(T7_SENTENCES)
  const chars = [...sentence].length
  const bits = Math.random() < 0.5
  return {
    condition_text:
      "Считая, что каждый символ кодируется двумя байтами, оцените информационный объём следующего предложения " +
      `в кодировке Unicode:\n${sentence}\n` +
      `В ответе запишите целое число — количество ${bits ? "бит" : "байт"}.`,
    answer: String(bits ? chars * 16 : chars * 2),
  }
}

export const GENERATORS_EGE_INF = {
  2: [t2Misha, t2AllRows, t2ChooseExpr],
  4: [t4FanoShortest, t4FanoColors, t4FanoSumLen, t4FanoWord, t4SeqHex, t4UniqueDecode],
  5: [t5Bin, t5Parity, t5Ternary, t5Calc, t5Automat],
  7: [t7Transfer, t7Colors, t7ColorsCompressed, t7Volume, t7Packet, t7Sound, t7Modem, t7Traffic, t7Reserve, t7Adsl, t7Rgb, t7Unicode],
  8: [t8WordIndex, t8FirstLetter, t8Filter, t8Parity, t8CountOnce, t8CountDigits, t8Lamps, t8DistinctAlternating],
  11: [t11PassExtra, t11Volume, t11Plate, t11Split, t11Power, t11MinLength, t11Message, t11Catalogs],
  12: [t12EditorMinN, t12EditorSum, t12EditorResult, t12EditorMaxSum, t12Turing, t12StringAlg],
  13: [t13Graph, t13MaskByte, t13HostAddress, t13NetAddress, t13CountOnes, t13MaskBits, t13Url],
  14: [t14PowerSum, t14UnknownDigit, t14MinusX, t14BinOnes],
  15: [t15Inequality, t15Segments, t15DelSegment, t15DelMax, t15DelMin, t15BitAnd],
  16: [t16Formula, t16FG, t16Print, t16Stars],
  19: [t19FirstMove],
  23: [t23Programs],
  25: [t25Mask, t25Semiprime, t25DivisorEnding, t25MinMaxDivisors, t25SumDivisors],
  20: [t20SecondMove],
  21: [t21VanyaSecond],
}

export const GEN_META_EGE_INF = {
  2: [["Таблицы истинности", [
    ["misha", "Фрагмент из трёх строк с пропусками", t2Misha],
    ["allrows", "Все наборы, где F ложна/истинна", t2AllRows],
    ["choose", "Выбрать выражение по фрагменту", t2ChooseExpr],
  ]]],
  4: [["Условие Фано", [
    ["shortest", "Кратчайшее кодовое слово для буквы", t4FanoShortest],
    ["colors", "Кратчайший код для цвета рисунка", t4FanoColors],
    ["sumlen", "Наименьшая суммарная длина кодов", t4FanoSumLen],
    ["word", "Минимальная длина кодировки слова", t4FanoWord],
  ]],
  ["Кодирование последовательностей", [
    ["seq-hex", "Двухразрядные коды → шестнадцатеричная запись", t4SeqHex],
    ["unique", "Какое сообщение декодируется однозначно", t4UniqueDecode],
  ]]],
  5: [["Алгоритм над записью числа", [
    ["bin", "Дописывание разрядов к двоичной записи", t5Bin],
    ["parity", "Контроль чётности (сумма цифр)", t5Parity],
    ["ternary", "Троичная запись (остаток × 5)", t5Ternary],
  ]],
  ["Исполнители и автоматы", [
    ["calc", "Калькулятор/Квадратор: собрать программу", t5Calc],
    ["automat", "Автомат: произведения цифр", t5Automat],
  ]]],
  7: [["Передача данных", [
    ["transfer", "Архив или без архива: что быстрее", t7Transfer],
    ["modem", "Сколько секунд передаёт модем", t7Modem],
    ["packet", "Снимки в пакете за отведённое время", t7Packet],
  ]],
  ["Растровое изображение", [
    ["colors", "Максимальная палитра по объёму файла", t7Colors],
    ["colors-zip", "Палитра при сжатии «больше на N%»", t7ColorsCompressed],
    ["volume", "Объём файла с фотографией", t7Volume],
    ["rgb", "Составляющие цвета пикселя", t7Rgb],
    ["traffic", "Экономия трафика при пересжатии", t7Traffic],
    ["reserve", "Сколько памяти зарезервировать", t7Reserve],
    ["adsl", "Размер файла по скорости и времени", t7Adsl],
    ["unicode", "Объём предложения в Unicode", t7Unicode],
  ]],
  ["Звук", [
    ["sound", "Оцифровка: частота, глубина, каналы", t7Sound],
  ]]],
  8: [["Список слов в алфавитном порядке", [
    ["index", "Номер заданного слова", t8WordIndex],
    ["letter", "Первое слово на букву", t8FirstLetter],
    ["filter", "Первое/последнее слово с ограничениями", t8Filter],
    ["parity", "Слова с чётными/нечётными номерами", t8Parity],
  ]],
  ["Комбинаторика слов", [
    ["count-once", "Буква ровно один раз (Вася/Игорь)", t8CountOnce],
    ["count-digits", "Числа в системе счисления с условием", t8CountDigits],
    ["lamps", "Световое табло: сколько лампочек", t8Lamps],
    ["distinct", "Все цифры различны, чётность чередуется", t8DistinctAlternating],
  ]]],
  11: [["Объём памяти при посимвольном кодировании", [
    ["extra", "Пароль + дополнительные сведения", t11PassExtra],
    ["volume", "Объём памяти под N идентификаторов", t11Volume],
    ["plate", "Автономер: буквы и цифры вперемешку", t11Plate],
    ["split", "Автономер: цифры и буквы отдельно", t11Split],
  ]],
  ["Обратные задачи", [
    ["power", "Найти мощность алфавита", t11Power],
    ["length", "Найти минимальную длину номера", t11MinLength],
  ]],
  ["Объём сообщения", [
    ["message", "Секретное сообщение из N символов", t11Message],
  ]],
  ["Файловая система", [
    ["catalogs", "Путь по каталогам вверх-вниз", t11Catalogs],
  ]]],
  12: [["Исполнитель Редактор", [
    ["min-n", "Наименьшее n по сумме цифр", t12EditorMinN],
    ["sum", "Сумма цифр результата (маркер «>»)", t12EditorSum],
    ["result", "Какая строка получится (ЕСЛИ/ИНАЧЕ)", t12EditorResult],
    ["max-sum", "Наибольшая сумма цифр результата", t12EditorMaxSum],
  ]],
  ["Исполнитель МТ", [
    ["turing", "Машина Тьюринга над двоичным числом", t12Turing],
  ]],
  ["Строковые функции", [
    ["string", "Длина/Извлечь/Склеить: значение b", t12StringAlg],
  ]]],
  13: [["Схема дорог (граф)", [
    ["graph", "Пути из А в М через город", t13Graph],
  ]],
  ["Маски сетей TCP/IP", [
    ["mask-byte", "Байт маски по адресу сети", t13MaskByte],
    ["host", "Наибольший/наименьший адрес узла", t13HostAddress],
    ["net", "Адрес сети по IP и маске", t13NetAddress],
    ["count-ones", "Адреса с условием на число единиц", t13CountOnes],
    ["mask-bits", "Число единиц/нулей в маске", t13MaskBits],
  ]],
  ["Адрес файла в Интернете", [
    ["url", "Собрать адрес из фрагментов А–Ж", t13Url],
  ]]],
  14: [["Запись значения выражения", [
    ["powsum", "Нули/цифры в записи суммы степеней", t14PowerSum],
    ["minus-x", "bⁿ + bᵐ − x: ровно K нулей", t14MinusX],
    ["bin", "Единицы в двоичной записи", t14BinOnes],
  ]],
  ["Неизвестная цифра", [
    ["digit", "Наименьшее x, кратность и частное", t14UnknownDigit],
  ]]],
  15: [["Неравенства с параметром A", [
    ["ineq", "Наибольшее/наименьшее A (x и y)", t15Inequality],
  ]],
  ["Отрезки на числовой прямой", [
    ["seg", "Наименьшая длина отрезка A", t15Segments],
  ]],
  ["Поразрядная конъюнкция", [
    ["bitand", "Наименьшее A для x & A", t15BitAnd],
  ]],
  ["Предикат ДЕЛ(n, m)", [
    ["del-seg", "ДЕЛ и отрезок B", t15DelSegment],
    ["del-max", "Наибольшее A", t15DelMax],
    ["del-min", "Наименьшее A", t15DelMin],
  ]]],
  23: [["Исполнитель: число программ", [
    ["programs", "Сколько программ переводит A в B", t23Programs],
  ]]],
  25: [["Маски чисел", [
    ["mask", "Числа по маске, делящиеся на D", t25Mask],
  ]],
  ["Перебор чисел программой", [
    ["semiprime", "Произведение двух простых", t25Semiprime],
    ["divisor", "Делитель, оканчивающийся на цифру", t25DivisorEnding],
    ["minmax", "Сумма мин. и макс. делителей (M)", t25MinMaxDivisors],
    ["sum-div", "Сумма делителей (R)", t25SumDivisors],
  ]]],
  19: [["Выигрышная стратегия", [
    ["first", "Ваня выигрывает первым ходом", t19FirstMove],
  ]]],
  20: [["Выигрышная стратегия", [
    ["second", "Петя выигрывает вторым ходом", t20SecondMove],
  ]]],
  21: [["Выигрышная стратегия", [
    ["vanya-2", "Ваня выигрывает первым или вторым", t21VanyaSecond],
  ]]],
  16: [["Рекуррентные соотношения", [
    ["formula", "Выражение (F(a) − F(b))/F(c)", t16Formula],
    ["fg", "Две функции F и G", t16FG],
  ]],
  ["Рекурсивные алгоритмы", [
    ["print", "Какие числа выведет F(k)", t16Print],
    ["stars", "Сколько звёздочек напечатает F(k)", t16Stars],
  ]]],
}
