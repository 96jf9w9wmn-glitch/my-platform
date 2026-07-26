// Генераторы ЕГЭ математика ПРОФИЛЬ, задание №19 — теория чисел (часть 2).
//
// Эталон типажей: fipi_bank_ege_prof/typages_task19.md (PDF «Задачи №19» из
// ~/Desktop/Реп-во/ЕГЭ/Задачи — 119 задач, по одной на страницу). Открытый банк ФИПИ
// часть 2 не публикует, машинной сверки coverage.py для №19 нет: полнота доказывается
// инвентарём + smoke19.mjs.
//
// ФОРМАТ ЗАДАНИЯ: общая преамбула + три подпункта а)/б)/в); ответ многострочный.
// В ответе на «да» — предъявленный ПРИМЕР, на «нет» — короткий инвариант,
// на «наибольшее/наименьшее k» — само k, пример на k и фраза, почему k±1 невозможно.
// Развёрнутое обоснование для репетитора — в поле solution.
//
// ФИЛОСОФИЯ (как в №13/№15/№16): задача строится ОТ ОТВЕТА. Сначала фиксируем ответ
// (число k, пример, инвариант), затем подбираем параметры условия под него. Внутри
// generateTask никакого перебора нет — только арифметика, поэтому в проде мгновенно.
//
// ДВА НЕЗАВИСИМЫХ ПРЕДСТАВЛЕНИЯ у каждого объекта:
//   • construct — параметры условия + заявленные ответы и примеры (то, из чего собран текст);
//   • solve(params) — НЕЗАВИСИМЫЙ полный перебор явно ограниченного пространства
//     (динамика по наборам различных чисел), который заново находит ответы а), б), в).
// verify19 требует, чтобы они совпали, и отдельно проверяет каждый пример функцией
// check(), написанной ПО ТЕКСТУ УСЛОВИЯ, а не по конструкции. Перебор запускается
// только в смоуке (smoke19.mjs), в проде он не вызывается.

// ── базовые утилиты ────────────────────────────────────────────────────────
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const sum = (a) => a.reduce((s, x) => s + x, 0)
const uniq = (a) => [...new Set(a)]

// Перечисление по-русски: [a] → «a», [a,b] → «a и b», [a,b,c] → «a, b и c».
function joinRu(arr) {
  if (arr.length <= 1) return String(arr[0] ?? "")
  return arr.slice(0, -1).join(", ") + " и " + arr[arr.length - 1]
}
// Склонение: plural(3, "число","числа","чисел") → «числа».
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}
const nums = (n) => `${n} ${plural(n, "число", "числа", "чисел")}`
// Согласование числительного с «различных натуральных чисел» / «чётных чисел».
const distNat = (n) => `${n} ${plural(n, "различное натуральное число", "различных натуральных числа", "различных натуральных чисел")}`
const evenNums = (n) => `${n} ${plural(n, "чётное число", "чётных числа", "чётных чисел")}`
const distEven = (n) => `${n} ${plural(n, "различное чётное число", "различных чётных числа", "различных чётных чисел")}`
const distNums = (n) => `${n} ${plural(n, "различное число", "различных числа", "различных чисел")}`
// «Может ли …» для единственного числа, «Могут ли …» для остальных.
const canBe = (n) => (plural(n, 1, 0, 0) ? "Может ли" : "Могут ли")

// Печать набора: короткий — целиком, длинная арифметическая серия — с многоточием.
// Серия задаётся первым элементом и шагом; «хвост» (изменённый последний элемент)
// печатается отдельно, чтобы многоточие оставалось однозначным.
function runText(start, step, count) {
  if (count <= 0) return ""
  if (count <= 5) {
    const a = []
    for (let i = 0; i < count; i++) a.push(start + step * i)
    return a.join(", ")
  }
  return `${start}, ${start + step}, ${start + 2 * step}, …, ${start + step * (count - 1)}`
}
// Набор «серия из count чисел, у последнего добавлено add».
function runPlusTail(start, step, count, add) {
  if (add === 0) return runText(start, step, count)
  if (count === 1) return String(start + add)
  return `${runText(start, step, count - 1)}, ${start + step * (count - 1) + add}`
}
function setArr(start, step, count, add = 0) {
  const a = []
  for (let i = 0; i < count; i++) a.push(start + step * i)
  if (a.length) a[a.length - 1] += add
  return a
}

// ── перебор: наборы РАЗЛИЧНЫХ чисел из явного списка ────────────────────────
// reach[c][s] = 1, если из items можно выбрать c различных чисел с суммой s.
// Пространство перебора задаётся списком items и границей maxSum — обе явные.
function knap(items, maxCount, maxSum) {
  const rows = []
  for (let c = 0; c <= maxCount; c++) rows.push(new Uint8Array(maxSum + 1))
  rows[0][0] = 1
  for (const v of items) {
    if (v > maxSum) continue
    for (let c = maxCount; c >= 1; c--) {
      const cur = rows[c], prev = rows[c - 1]
      for (let s = maxSum; s >= v; s--) if (prev[s - v]) cur[s] = 1
    }
  }
  return rows
}
// Тот же перебор, но с минимизацией числа «помеченных» элементов (isMark).
// rows[c][s] = минимальное количество помеченных среди c чисел с суммой s (127 = нельзя).
function knapMinMark(items, isMark, maxCount, maxSum) {
  const INF = 127
  const rows = []
  for (let c = 0; c <= maxCount; c++) { const r = new Int8Array(maxSum + 1).fill(INF); rows.push(r) }
  rows[0][0] = 0
  for (const v of items) {
    if (v > maxSum) continue
    const w = isMark(v) ? 1 : 0
    for (let c = maxCount; c >= 1; c--) {
      const cur = rows[c], prev = rows[c - 1]
      for (let s = maxSum; s >= v; s--) {
        const p = prev[s - v]
        if (p < INF && p + w < cur[s]) cur[s] = p + w
      }
    }
  }
  return rows
}
// Два независимых класса чисел: существует ли набор из a чисел класса A и b чисел
// класса B с общей суммой S.
function pairFeasible(dpA, a, dpB, b, S) {
  if (a < 0 || b < 0 || a >= dpA.length || b >= dpB.length) return false
  const ra = dpA[a], rb = dpB[b]
  for (let s = 0; s <= S; s++) if (ra[s] && rb[S - s]) return true
  return false
}

// ── сборка объекта задания ─────────────────────────────────────────────────
// preamble — общая часть условия; qa/qb/qc — три вопроса; ansA/ansB/ansC — строки ответа.
// verify: { params, check, solve, claims, mustMention, extra, phrases }
function item({ preamble, qa, qb, qc, ansA, ansB, ansC, solution, verify }) {
  return {
    condition_text: `${preamble}\n\nа) ${qa}\nб) ${qb}\nв) ${qc}`,
    answer: `а) ${ansA}\nб) ${ansB}\nв) ${ansC}`,
    solution,
    _verify: verify,
  }
}

// ── проверка объекта (только для смоука) ───────────────────────────────────
// 1. каждый предъявленный пример проходит check(), написанный по ТЕКСТУ условия;
// 2. для «нет» независимый перебор пуст;
// 3. для «наибольшее/наименьшее k» перебор даёт ровно k;
// 4. а) и б) не вырождены (разные вопросы, а при двух «нет» — разные инварианты);
// 5. числа в условии «человеческие» и белый список соблюдён;
// 6. все ограничения, которые использует check, названы в тексте условия.
export function verify19(o) {
  if (!o || !o._verify) return { ok: false, err: "нет объекта/_verify" }
  const V = o._verify
  const text = o.condition_text

  // 5. белый список чисел условия
  const found = (text.match(/\d+/g) || []).map(Number)
  for (const n of V.mustMention) {
    if (!found.includes(n)) return { ok: false, err: `в условии нет обязательного числа ${n}` }
  }
  const allowed = new Set([...V.mustMention, ...(V.extra || [])])
  for (const n of found) {
    if (!allowed.has(n)) return { ok: false, err: `лишнее число ${n} в условии` }
    if (n > 99999) return { ok: false, err: `число ${n} длиннее 5 знаков` }
  }
  // 6. ограничения названы в тексте
  for (const p of V.phrases) {
    if (!text.includes(p)) return { ok: false, err: `в условии не названо ограничение «${p}»` }
  }
  // ответ не должен содержать пустых пунктов
  for (const line of o.answer.split("\n")) {
    if (/^[абв]\)\s*$/.test(line)) return { ok: false, err: `пустой пункт ответа: «${line}»` }
  }

  // 1–3. сверка конструкции с независимым перебором
  let S
  try { S = V.solve(V.params) } catch (e) { return { ok: false, err: "solve упал: " + e.message } }

  for (const part of ["a", "b", "c"]) {
    const cl = V.claims[part]
    if (!cl) return { ok: false, err: `нет claim для пункта ${part}` }
    if (cl.type === "yesno") {
      if (cl.yes !== S[part]) return { ok: false, err: `пункт ${part}: заявлено ${cl.yes ? "да" : "нет"}, перебор говорит ${S[part] ? "да" : "нет"}` }
      if (cl.yes) {
        const bad = cl.example === null || cl.example === undefined || (Array.isArray(cl.example) && !cl.example.length)
        if (bad) return { ok: false, err: `пункт ${part}: «да» без примера` }
        const e = V.check(cl.example, part)
        if (e) return { ok: false, err: `пункт ${part}: пример не проходит check — ${e}` }
      } else if (!cl.reason) return { ok: false, err: `пункт ${part}: «нет» без инварианта` }
    } else if (cl.type === "extremum") {
      if (cl.value !== S[part]) return { ok: false, err: `пункт ${part}: заявлено ${cl.value}, перебор даёт ${S[part]}` }
      const e = V.check(cl.example, part)
      if (e) return { ok: false, err: `пункт ${part}: пример на ${cl.value} не проходит check — ${e}` }
      const step = cl.mode === "max" ? 1 : -1
      if (S[part + "_next"] !== false) return { ok: false, err: `пункт ${part}: перебор не подтвердил, что ${cl.value + step} невозможно` }
    } else if (cl.type === "count") {
      if (cl.value !== S[part]) return { ok: false, err: `пункт ${part}: заявлено ${cl.value}, перебор даёт ${S[part]}` }
    } else if (cl.type === "value") {
      if (Math.abs(cl.value - S[part]) > 1e-9) return { ok: false, err: `пункт ${part}: заявлено ${cl.value}, перебор даёт ${S[part]}` }
      const e = V.check(cl.example, part)
      if (e) return { ok: false, err: `пункт ${part}: пример не проходит check — ${e}` }
    } else if (cl.type === "all") {
      const got = (S[part] || []).join(",")
      if (got !== cl.values.join(",")) return { ok: false, err: `пункт ${part}: заявлено {${cl.values}}, перебор даёт {${got}}` }
      for (const v of cl.values) {
        const e = V.check(cl.examples[v], part)
        if (e) return { ok: false, err: `пункт ${part}: пример для ${v} не проходит check — ${e}` }
      }
    } else return { ok: false, err: `неизвестный тип claim ${cl.type}` }
  }

  // 4. невырожденность а) и б)
  const A = V.claims.a, B = V.claims.b
  if (A.type === "yesno" && B.type === "yesno") {
    if (A.target !== undefined && A.target === B.target) return { ok: false, err: "а) и б) спрашивают об одном и том же" }
    if (A.yes === B.yes && !A.yes && A.reason === B.reason) {
      return { ok: false, err: "а) и б) — два «нет» с одним и тем же инвариантом" }
    }
  }
  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 1. Доска: набор чисел с ограничением на сумму
// ═══════════════════════════════════════════════════════════════════════════

// #2. N различных натуральных: каждое чётное ЛИБО оканчивается на цифру 3, сумма S.
//     а) может ли быть ровно qa чётных? б) могут ли ровно qb оканчиваться на 3?
//     в) наименьшее количество чисел, оканчивающихся на 3.
// Конструкция: класс «оканчивается на 3» — это 3, 13, 23, … (наименьшая сумма m таких
// чисел равна 5m²−2m), класс чётных — 2, 4, …, 2n (наименьшая сумма n(n+1)).
// Все числа классов различны между собой (одно нечётно, другое чётно), поэтому
// минимальная сумма набора с m «тройками» равна minTotal(m) = 5m²−2m + (N−m)(N−m+1),
// а любая сумма той же чётности, что и minTotal(m), и не меньшая её, достижима
// (наибольшее чётное число увеличиваем на нужное чётное число).
export function t19BoardEvenOrTail3() {
  const N = randInt(24, 34)
  const minTotal = (m) => 5 * m * m - 2 * m + (N - m) * (N - m + 1)
  // minTotal убывает до m* ≈ (2N+3)/12 и дальше растёт — берём kMin на убывающей ветви.
  const mStar = Math.floor((2 * N + 3) / 12)
  const kMin = randInt(3, Math.max(3, mStar))
  const lo = minTotal(kMin), hi = minTotal(kMin - 2) - 1
  if (lo > hi) return null
  // Хвостовой избыток кладём в наибольшее чётное число, поэтому ограничиваем его,
  // чтобы пример не превращался в «2, 4, …, 54, 933».
  const S = lo + 2 * randInt(0, Math.min(N, Math.floor((hi - lo) / 2)))

  // а) — «да»: берём m_a ≥ kMin той же чётности, для которого минимальная сумма ещё влезает.
  const ma = minTotal(kMin + 2) <= S ? kMin + 2 : kMin
  const qa = N - ma
  const exA = [...setArr(3, 10, ma), ...setArr(2, 2, N - ma, S - minTotal(ma))]
  // в) — пример на kMin.
  const exC = [...setArr(3, 10, kMin), ...setArr(2, 2, N - kMin, S - minTotal(kMin))]
  // б) — «нет»: либо неверная чётность, либо слишком большая минимальная сумма.
  const parityBad = kMin >= 3 ? kMin - 1 : kMin + 1     // чётность не та, что у S
  const tooSmall = kMin - 2                              // та же чётность, но сумма не влезает
  const useParity = Math.random() < 0.5
  const qb = useParity ? parityBad : tooSmall
  if (qb < 0 || qb === ma || qb === kMin) return null

  const params = { N, S, qa, qb, kMin }
  const check = (arr, part) => {
    if (!Array.isArray(arr) || arr.length !== N) return `в наборе ${arr?.length} чисел вместо ${N}`
    if (uniq(arr).length !== N) return "числа не различны"
    for (const x of arr) {
      if (!Number.isInteger(x) || x < 1) return `${x} не натуральное`
      if (x % 2 !== 0 && x % 10 !== 3) return `${x} не чётное и не оканчивается на 3`
    }
    if (sum(arr) !== S) return `сумма ${sum(arr)} вместо ${S}`
    const t3 = arr.filter((x) => x % 10 === 3).length
    if (part === "a" && arr.length - t3 !== qa) return `чётных ${arr.length - t3} вместо ${qa}`
    if (part === "b" && t3 !== qb) return `на 3 оканчивается ${t3} вместо ${qb}`
    if (part === "c" && t3 !== kMin) return `на 3 оканчивается ${t3} вместо ${kMin}`
    return null
  }
  const solve = (p) => {
    // Пространство перебора: ВСЕ наборы из p.N различных натуральных чисел ≤ p.S,
    // каждое чётное или оканчивающееся на 3 (число больше p.S в наборе с суммой p.S
    // невозможно). Динамика раздельно по двум классам, затем свёртка по сумме.
    const evens = [], tail3 = []
    for (let x = 2; x <= p.S; x += 2) evens.push(x)
    for (let x = 3; x <= p.S; x += 10) tail3.push(x)
    const dpE = knap(evens, p.N, p.S), dpT = knap(tail3, p.N, p.S)
    const feas = (m) => pairFeasible(dpT, m, dpE, p.N - m, p.S)
    let best = -1
    for (let m = 0; m <= p.N; m++) if (feas(m)) { best = m; break }
    return { a: feas(p.N - p.qa), b: feas(p.qb), c: best, c_next: best > 0 ? feas(best - 1) : false }
  }

  const evTextA = runPlusTail(2, 2, N - ma, S - minTotal(ma))
  const evTextC = runPlusTail(2, 2, N - kMin, S - minTotal(kMin))
  const reasonB = useParity
    ? `нет: числа, оканчивающиеся на 3, нечётны, поэтому сумма всех чисел имеет ту же чётность, что и их количество, а ${S} и ${qb} разной чётности`
    : `нет: ${nums(qb)}, ${plural(qb, "оканчивающееся", "оканчивающихся", "оканчивающихся")} на 3, ${plural(qb, "даёт", "дают", "дают")} не менее ${5 * qb * qb - 2 * qb}, а ${distEven(N - qb)} — не менее ${(N - qb) * (N - qb + 1)}; вместе это ${minTotal(qb)} > ${S}`

  return item({
    preamble: `На доске написано ${distNat(N)}, каждое из которых либо чётное, либо его десятичная запись оканчивается на цифру 3. Сумма написанных чисел равна ${S}.`,
    qa: `Может ли на доске быть ровно ${evenNums(qa)}?`,
    qb: `${canBe(qb)} ровно ${nums(qb)} на доске оканчиваться на 3?`,
    qc: `Какое наименьшее количество чисел, оканчивающихся на 3, может быть на доске?`,
    ansA: `да, например ${runText(3, 10, ma)} и ${evTextA}`,
    ansB: reasonB,
    ansC: `${kMin}; пример: ${runText(3, 10, kMin)} и ${evTextC}; меньше нельзя — при ${nums(kMin - 2)}, оканчивающихся на 3, минимальная сумма равна ${minTotal(kMin - 2)} > ${S}, а количество чисел на 3 обязано быть той же чётности, что и ${S}`,
    solution: `Числа, оканчивающиеся на 3, нечётны, остальные чётны. Если таких чисел m, то сумма всех чисел имеет ту же чётность, что и m, значит m ≡ ${S % 2} (mod 2).\nНаименьшая сумма m различных чисел, оканчивающихся на 3, равна 3+13+…+(10m−7) = 5m²−2m; наименьшая сумма (${N}−m) различных чётных равна 2+4+…+2(${N}−m) = (${N}−m)(${N}−m+1). Итого минимальная сумма набора равна f(m) = 5m²−2m + (${N}−m)(${N}−m+1).\nf(${kMin - 2}) = ${minTotal(kMin - 2)} > ${S}, f(${kMin}) = ${minTotal(kMin)} ≤ ${S}, а разность ${S} − ${minTotal(kMin)} = ${S - minTotal(kMin)} чётна, поэтому её можно добавить к наибольшему чётному числу. Значит наименьшее количество равно ${kMin}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: qa },
        b: { type: "yesno", yes: false, reason: useParity ? "parity" : "minsum", target: qb },
        c: { type: "extremum", mode: "min", value: kMin, example: exC },
      },
      mustMention: [N, S, qa, qb, 3],
      extra: [2],
      phrases: ["различн", "натуральн", "либо чётное, либо его десятичная запись оканчивается на цифру 3", "Сумма написанных чисел равна"],
    },
  })
}

// #33. N различных натуральных, каждое оканчивается на цифру c1 или c2, сумма S.
//      а) может ли быть поровну тех и других? б) могут ли ровно qb оканчиваться на c2?
//      в) наименьшее количество чисел, оканчивающихся на c2.
// Инвариант: сумма ≡ a·c1 + b·c2 (mod 10), где a + b = N, поэтому b определено по модулю
// 10/НОД(c2−c1, 10) = 5 (цифры одной чётности). Минимальная сумма при данном b —
// b·c2 + 5b(b−1) + a·c1 + 5a(a−1); она убывает до b ≈ N/2, поэтому наименьшее
// допустимое b ищется на убывающей ветви.
export function t19BoardTail2Tail6() {
  const parityEven = Math.random() < 0.5
  const digits = parityEven ? [2, 4, 6, 8] : [1, 3, 7, 9]
  const c1 = pick(digits)
  const c2 = pick(digits.filter((d) => d !== c1))
  const N = 2 * randInt(8, 15)
  const minA = (a) => a * c1 + 5 * a * (a - 1)
  const minB = (b) => b * c2 + 5 * b * (b - 1)
  const minTotal = (b) => minA(N - b) + minB(b)
  const bMin = randInt(5, Math.max(5, Math.floor(N / 2) - 1))
  if (bMin >= Math.floor(N / 2)) return null
  const lo = minTotal(bMin), hi = minTotal(bMin - 5) - 1
  if (lo > hi) return null
  // Избыток уходит в наибольшее число — ограничиваем его десятком шагов.
  const S = lo + 10 * randInt(0, Math.min(12, Math.floor((hi - lo) / 10)))
  // а) «поровну» = по N/2 каждого: возможно только если N/2 ≡ bMin (mod 5).
  const half = N / 2
  const halfOK = (half - bMin) % 5 === 0 && minTotal(half) <= S
  if (halfOK) return null                    // нужен эталонный «нет» с инвариантом остатка
  // б) «ровно qb на c2»: та же серия остатков, но сумма не влезает.
  const qb = bMin - 5
  if (qb < 0 || qb === half) return null

  const exC = [...setArr(c2, 10, bMin), ...setArr(c1, 10, N - bMin, S - minTotal(bMin))]
  const params = { N, S, c1, c2, qb, bMin, half }
  const check = (arr, part) => {
    if (!Array.isArray(arr) || arr.length !== N) return `в наборе ${arr?.length} чисел вместо ${N}`
    if (uniq(arr).length !== N) return "числа не различны"
    for (const x of arr) {
      if (!Number.isInteger(x) || x < 1) return `${x} не натуральное`
      if (x % 10 !== c1 && x % 10 !== c2) return `${x} не оканчивается ни на ${c1}, ни на ${c2}`
    }
    if (sum(arr) !== S) return `сумма ${sum(arr)} вместо ${S}`
    const b = arr.filter((x) => x % 10 === c2).length
    if (part === "a" && b !== half) return `на ${c2} оканчивается ${b} вместо ${half}`
    if (part === "b" && b !== qb) return `на ${c2} оканчивается ${b} вместо ${qb}`
    if (part === "c" && b !== bMin) return `на ${c2} оканчивается ${b} вместо ${bMin}`
    return null
  }
  const solve = (p) => {
    // Пространство: все наборы из p.N различных натуральных ≤ p.S, оканчивающихся
    // на p.c1 или p.c2. Динамика раздельно по двум классам.
    const A = [], B = []
    for (let x = p.c1; x <= p.S; x += 10) A.push(x)
    for (let x = p.c2; x <= p.S; x += 10) B.push(x)
    const dpA = knap(A, p.N, p.S), dpB = knap(B, p.N, p.S)
    const feas = (b) => pairFeasible(dpB, b, dpA, p.N - b, p.S)
    let best = -1
    for (let b = 0; b <= p.N; b++) if (feas(b)) { best = b; break }
    return { a: feas(p.half), b: feas(p.qb), c: best, c_next: best > 0 ? feas(best - 1) : false }
  }

  return item({
    preamble: `На доске написано ${distNat(N)}, десятичная запись каждого из которых оканчивается или на цифру ${c1}, или на цифру ${c2}. Сумма написанных чисел равна ${S}.`,
    qa: `Может ли на доске быть поровну чисел, оканчивающихся на ${c1} и на ${c2}?`,
    qb: `${canBe(qb)} ровно ${nums(qb)} на доске оканчиваться на ${c2}?`,
    qc: `Какое наименьшее количество чисел, оканчивающихся на ${c2}, может быть на доске?`,
    ansA: `нет: если на ${c2} оканчивается b чисел, то сумма всех чисел сравнима с ${N}·${c1} + b·(${c2}−${c1}) по модулю 10, откуда b даёт остаток ${bMin % 5} при делении на 5, а ${half} такого остатка не даёт`,
    ansB: `нет: ${nums(qb)}, ${plural(qb, "оканчивающееся", "оканчивающихся", "оканчивающихся")} на ${c2}, ${plural(qb, "даёт", "дают", "дают")} не менее ${minB(qb)}, а ${distNums(N - qb)}, оканчивающихся на ${c1}, — не менее ${minA(N - qb)}; вместе ${minTotal(qb)} > ${S}`,
    ansC: `${bMin}; пример: ${runText(c2, 10, bMin)} и ${runPlusTail(c1, 10, N - bMin, S - minTotal(bMin))}; меньше нельзя — ближайшее меньшее допустимое количество ${qb} даёт сумму не меньше ${minTotal(qb)} > ${S}`,
    solution: `Пусть на ${c2} оканчивается b чисел, тогда на ${c1} — (${N}−b). Сумма всех чисел по модулю 10 равна (${N}−b)·${c1} + b·${c2}, поэтому остаток b по модулю 5 определён однозначно: b ≡ ${bMin % 5} (mod 5).\nНаименьшая сумма b различных чисел, оканчивающихся на ${c2}, равна ${c2} + (${c2}+10) + … = b·${c2} + 5b(b−1); аналогично для второго класса. Минимальная сумма набора f(b) = (${N}−b)·${c1} + 5(${N}−b)(${N}−b−1) + b·${c2} + 5b(b−1).\nf(${qb}) = ${minTotal(qb)} > ${S}, f(${bMin}) = ${minTotal(bMin)} ≤ ${S}, а разность ${S} − ${minTotal(bMin)} = ${S - minTotal(bMin)} кратна 10, поэтому её добавляем к наибольшему числу. Ответ: ${bMin}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: false, reason: "residue", target: half },
        b: { type: "yesno", yes: false, reason: "minsum", target: qb },
        c: { type: "extremum", mode: "min", value: bMin, example: exC },
      },
      mustMention: [N, S, c1, c2, qb],
      extra: [10],
      phrases: ["различн", "натуральн", "оканчивается или на цифру", "Сумма написанных чисел равна"],
    },
  })
}

// #6. Различные натуральные, которые делятся на p и оканчиваются на цифру c.
//     а) может ли их сумма составлять Sa? б) Sb? в) наибольшее количество при сумме Sc.
// Класс — арифметическая прогрессия x ≡ r0 (mod 10p); сумма k таких чисел сравнима
// с k·r0 по модулю 10p, а наименьшая равна k·r0 + 10p·k(k−1)/2.
export function t19BoardDivTail() {
  const p = pick([3, 7, 9, 11, 13])
  const c = pick([2, 3, 4, 6, 7, 8])
  const m = 10 * p
  let r0 = 0
  for (let x = c; x <= m; x += 10) if (x % p === 0) { r0 = x; break }
  if (!r0) return null
  const minSum = (k) => k * r0 + m * k * (k - 1) / 2
  // Сумма k таких чисел сравнима с k·r0 по модулю m, поэтому количество слагаемых
  // определено по модулю T = m / НОД(r0, m): допустимые количества идут через T.
  const g = (a, b) => (b ? g(b, a % b) : a)
  const T = m / g(r0, m)

  const kMax = randInt(3, 8)
  // Sc = minSum(kMax) + m·t, но строго меньше minSum(kMax+T) — тогда kMax максимально.
  const room = Math.floor((minSum(kMax + T) - 1 - minSum(kMax)) / m)
  if (room < 0) return null
  const Sc = minSum(kMax) + m * randInt(0, Math.min(room, kMax + 3))
  if (Sc > 99999) return null

  // а) «да»: сумма ja наименьших чисел класса, сдвинутая на кратное m.
  const ja = randInt(2, 4)
  const shiftA = m * randInt(0, 3)
  const Sa = minSum(ja) + shiftA
  // б) «нет»: остаток требует kb ≤ T слагаемых (меньшего допустимого количества нет,
  // так как kb − T ≤ 0), а минимальная сумма kb чисел уже больше Sb.
  const kb = randInt(1, T)
  const jMax = Math.floor((minSum(kb) - 1) / m)
  if (jMax < 1) return null
  const Sb = minSum(kb) - m * randInt(1, jMax)
  if (Sb <= 0 || Sb === Sa || Sb === Sc || Sa === Sc) return null

  const exA = setArr(r0, m, ja, shiftA)
  const exC = setArr(r0, m, kMax, Sc - minSum(kMax))
  const params = { p, c, r0, m, Sa, Sb, Sc, kMax, ja }
  const check = (arr, part) => {
    if (!Array.isArray(arr) || arr.length < 1) return "пустой набор"
    if (uniq(arr).length !== arr.length) return "числа не различны"
    for (const x of arr) {
      if (!Number.isInteger(x) || x < 1) return `${x} не натуральное`
      if (x % p !== 0) return `${x} не делится на ${p}`
      if (x % 10 !== c) return `${x} не оканчивается на ${c}`
    }
    const target = part === "a" ? Sa : part === "b" ? Sb : Sc
    if (sum(arr) !== target) return `сумма ${sum(arr)} вместо ${target}`
    if (part === "c" && arr.length !== kMax) return `${arr.length} чисел вместо ${kMax}`
    return null
  }
  const solve = (P) => {
    // Пространство: все наборы различных чисел вида x ≡ r0 (mod 10p), x ≤ максимальной
    // из трёх сумм (число больше суммы в наборе невозможно).
    const cap = Math.max(P.Sa, P.Sb, P.Sc)
    const items = []
    for (let x = P.r0; x <= cap; x += P.m) items.push(x)
    const maxK = items.length
    const dp = knap(items, maxK, cap)
    const reach = (S) => { for (let k = 0; k <= maxK; k++) if (dp[k][S]) return true; return false }
    let best = -1
    for (let k = maxK; k >= 1; k--) if (dp[k][P.Sc]) { best = k; break }
    return {
      a: reach(P.Sa), b: reach(P.Sb), c: best,
      c_next: best >= 0 && best + 1 <= maxK ? !!dp[best + 1][P.Sc] : false,
    }
  }

  return item({
    preamble: `На доске написано несколько различных натуральных чисел, которые делятся на ${p} и оканчиваются на ${c}.`,
    qa: `Может ли их сумма составлять ${Sa}?`,
    qb: `Может ли их сумма составлять ${Sb}?`,
    qc: `Какое наибольшее количество чисел могло быть на доске, если их сумма равна ${Sc}?`,
    ansA: `да, например ${joinRu(exA)}`,
    ansB: `нет: каждое такое число сравнимо с ${r0} по модулю ${m}, поэтому подходит только ${kb} ${plural(kb, "слагаемое", "слагаемых", "слагаемых")} (или ${kb + T}, ${kb + 2 * T}, …), а сумма ${kb} наименьших таких чисел равна уже ${minSum(kb)} > ${Sb}`,
    ansC: `${kMax}; пример: ${joinRu(exC)}; больше нельзя — следующее допустимое количество ${kMax + T} даёт сумму не меньше ${minSum(kMax + T)} > ${Sc}, а количество чисел определено остатком суммы по модулю ${m}`,
    solution: `Числа, делящиеся на ${p} и оканчивающиеся на ${c}, — это в точности числа вида ${r0} + ${m}·t, t ≥ 0.\nСумма k таких чисел сравнима с k·${r0} по модулю ${m}, поэтому количество слагаемых определено остатком суммы; наименьшая сумма k чисел равна k·${r0} + ${m}·k(k−1)/2.\nДля суммы ${Sc}: минимальная сумма ${kMax} чисел равна ${minSum(kMax)} ≤ ${Sc}, а разность ${Sc} − ${minSum(kMax)} = ${Sc - minSum(kMax)} кратна ${m} — добавляем её к наибольшему числу. Следующее допустимое количество ${kMax + 5} даёт уже ${minSum(kMax + 5)} > ${Sc}. Ответ: ${kMax}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: Sa },
        b: { type: "yesno", yes: false, reason: "minsum-residue", target: Sb },
        c: { type: "extremum", mode: "max", value: kMax, example: exC },
      },
      mustMention: [p, c, Sa, Sb, Sc],
      extra: [],
      phrases: ["различных натуральных чисел", `делятся на ${p}`, `оканчиваются на ${c}`],
    },
  })
}

// #5. Различные натуральные, запись которых содержит цифры d1 и d2, либо только одну
//     из этих цифр (то есть в записи нет других цифр).
//     а) может ли сумма быть Sa? б) Sb? в) наименьшее количество чисел при сумме Sc.
// Цифры выбираем отличающимися на 5 — тогда обе дают остаток d1 mod 5, каждое число
// сравнимо с d1 по модулю 5, а сумма k чисел — с k·d1. Это определяет k по модулю 5.
export function t19BoardTwoDigits() {
  const d1 = randInt(1, 4), d2 = d1 + 5
  // все числа длины ≤ 4 из цифр d1, d2 — явно перечислимое пространство
  const items = []
  for (let len = 1; len <= 4; len++) {
    for (let mask = 0; mask < (1 << len); mask++) {
      let v = 0
      for (let i = 0; i < len; i++) v = v * 10 + (((mask >> i) & 1) ? d2 : d1)
      items.push(v)
    }
  }
  items.sort((a, b) => a - b)
  const minSum = (k) => sum(items.slice(0, k))

  const k = randInt(3, 5)
  const chosen = []
  const poolC = items.slice(0, 10)
  while (chosen.length < k) { const v = pick(poolC); if (!chosen.includes(v)) chosen.push(v) }
  chosen.sort((a, b) => a - b)
  const Sc = sum(chosen)

  const ja = randInt(2, 4)
  const exA = []
  const poolA = items.slice(0, 9)
  while (exA.length < ja) { const v = pick(poolA); if (!exA.includes(v)) exA.push(v) }
  exA.sort((a, b) => a - b)
  const Sa = sum(exA)

  const kb = randInt(2, 4)
  const cap = minSum(kb) - 1
  const need = ((kb * d1) % 5 + 5) % 5
  const cands = []
  for (let x = 1; x <= cap; x++) if (x % 5 === need) cands.push(x)
  if (!cands.length) return null
  const Sb = pick(cands)
  if (Sa === Sb || Sa === Sc || Sb === Sc) return null

  const params = { d1, d2, Sa, Sb, Sc, k }
  const check = (arr, part) => {
    if (!Array.isArray(arr) || !arr.length) return "пустой набор"
    if (uniq(arr).length !== arr.length) return "числа не различны"
    for (const x of arr) {
      if (!Number.isInteger(x) || x < 1) return `${x} не натуральное`
      for (const ch of String(x)) if (+ch !== d1 && +ch !== d2) return `в записи ${x} есть цифра ${ch}`
    }
    const target = part === "a" ? Sa : part === "b" ? Sb : Sc
    if (sum(arr) !== target) return `сумма ${sum(arr)} вместо ${target}`
    if (part === "c" && arr.length !== k) return `${arr.length} чисел вместо ${k}`
    return null
  }
  const solve = (P) => {
    // Пространство: все числа, записанные только цифрами d1/d2 и не превосходящие
    // наибольшей из трёх сумм (длиннее пяти знаков такие суммы не бывают).
    const capS = Math.max(P.Sa, P.Sb, P.Sc)
    const list = items.filter((v) => v <= capS)
    const maxK = list.length
    const dp = knap(list, maxK, capS)
    const reach = (S) => { for (let c = 1; c <= maxK; c++) if (dp[c][S]) return true; return false }
    let best = -1
    for (let c = 1; c <= maxK; c++) if (dp[c][P.Sc]) { best = c; break }
    return { a: reach(P.Sa), b: reach(P.Sb), c: best, c_next: best > 1 ? !!dp[best - 1][P.Sc] : false }
  }

  return item({
    preamble: `Даны различные натуральные числа, запись которых содержит цифры ${d1} и ${d2}, либо только одну из этих цифр.`,
    qa: `Может ли сумма всех чисел быть равной ${Sa}?`,
    qb: `Может ли сумма всех чисел быть равной ${Sb}?`,
    qc: `Какое наименьшее количество чисел могло быть, сумма которых равна ${Sc}?`,
    ansA: `да, например ${joinRu(exA)}`,
    ansB: `нет: каждое такое число даёт остаток ${d1 % 5} при делении на 5, поэтому сумма k чисел сравнима с ${d1}k по модулю 5; для суммы ${Sb} это даёт k ≡ ${kb} (mod 5), а сумма ${kb} наименьших подходящих чисел равна уже ${minSum(kb)} > ${Sb}`,
    ansC: `${k}; пример: ${joinRu(chosen)}; меньше нельзя — сумма k чисел сравнима с k·${d1} по модулю 5, поэтому количество слагаемых сравнимо с ${k} по модулю 5, а ${k} — наименьшее натуральное с таким остатком`,
    solution: `Каждое число, записанное только цифрами ${d1} и ${d2}, оканчивается на ${d1} или ${d2}; обе цифры дают остаток ${d1 % 5} при делении на 5, а десятки, сотни и т. д. кратны 5. Значит каждое такое число сравнимо с ${d1} по модулю 5, а сумма k чисел — с k·${d1}.\nОтсюда количество слагаемых определено по модулю 5. Для суммы ${Sc} это даёт k ≡ ${k % 5} (mod 5); наименьшее натуральное с таким остатком равно ${k}, и оно достигается: ${joinRu(chosen)}.\nДля суммы ${Sb} требуется ${kb} слагаемых, но ${kb} наименьших подходящих числа дают уже ${minSum(kb)} > ${Sb}, а ${kb + 5} и подавно.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: Sa },
        b: { type: "yesno", yes: false, reason: "residue-minsum", target: Sb },
        c: { type: "extremum", mode: "min", value: k, example: chosen },
      },
      mustMention: [d1, d2, Sa, Sb, Sc],
      extra: [],
      phrases: ["различные натуральные числа", "запись которых содержит цифры", "либо только одну из этих цифр"],
    },
  })
}

// #3. N различных натуральных, сумма которых равна S.
//     а) может ли на доске быть число X? б) может ли не быть числа Y?
//     в) наименьшее количество чисел, кратных d.
// Наименьшая сумма N различных натуральных равна N(N+1)/2, «запас» = S − N(N+1)/2.
// Максимально возможное число на доске равно B = S − (N−1)N/2.
export function t19BoardDistinctSum() {
  const N = randInt(14, 26)
  const d = pick([6, 7, 8, 9, 11, 12, 13, 14])
  const M = Math.floor(N / d)                 // кратных d среди 1…N
  if (M < 2) return null
  const base = N * (N + 1) / 2
  // Замены: наибольшие кратные d меняем на наименьшие свободные числа > N, не кратные d.
  const mults = []
  for (let i = M; i >= 1; i--) mults.push(i * d)
  const pool = []
  for (let x = N + 1; pool.length < M + 2; x++) if (x % d !== 0) pool.push(x)
  const costs = mults.map((v, i) => pool[i] - v)
  // Убираем r кратных; суммарная стоимость замен обязана уместиться в запас ≤ N−2.
  let rMax = 0
  while (rMax < M - 1 && sum(costs.slice(0, rMax + 1)) <= N - 2) rMax++
  if (rMax < 1) return null
  const r = randInt(1, rMax)
  const usedC = sum(costs.slice(0, r))
  const nextC = costs[r]
  if (nextC === undefined) return null
  // Запас суммы должен, во-первых, не дотягивать до (r+1)-й замены, во-вторых, быть
  // меньше N — иначе пункт б) (число Y, без которого сумма уже не набирается) исчезает.
  const eCap = Math.min(nextC - 1, N - 2 - usedC)
  if (eCap < 0) return null
  // остаток e добавляем к наибольшему числу набора — оно не должно стать кратным d
  const setC = []
  for (let x = 1; x <= N; x++) setC.push(x)
  for (let i = 0; i < r; i++) setC[setC.indexOf(mults[i])] = pool[i]
  setC.sort((a, b) => a - b)
  const top = setC[setC.length - 1]
  let e = randInt(0, eCap)
  if ((top + e) % d === 0) e = e > 0 ? e - 1 : (e + 1 <= eCap ? e + 1 : -1)
  if (e < 0 || (top + e) % d === 0) return null
  setC[setC.length - 1] = top + e
  if (uniq(setC).length !== N) return null

  const removedTxt = mults.slice(0, r)
  const addedTxt = pool.slice(0, r).map((v, i) => (i === r - 1 ? v + e : v))
  const slack = usedC + e
  const S = base + slack
  const B = S - (N - 1) * N / 2
  const answerC = M - r

  // а) число X: «да» при X = B (пример {1…N−1, B}), «нет» при X > B.
  const yesA = Math.random() < 0.5
  const X = yesA ? B : B + randInt(1, 40)
  const exA = []
  for (let x = 1; x <= N - 1; x++) exA.push(x)
  exA.push(B)
  // б) число Y: «нет», если без него минимальная сумма уже больше S.
  // Без Y минимальная сумма равна 1+2+…+(N+1) − Y, условие Y < N + 1 − slack.
  if (N - slack < 1) return null
  const Y = randInt(1, N - slack)
  const minWithoutY = (N + 1) * (N + 2) / 2 - Y
  if (minWithoutY <= S || X === Y) return null

  const params = { N, S, X, Y, d, answerC, yesA }
  const check = (arr, part) => {
    if (!Array.isArray(arr) || arr.length !== N) return `в наборе ${arr?.length} чисел вместо ${N}`
    if (uniq(arr).length !== N) return "числа не различны"
    for (const x of arr) if (!Number.isInteger(x) || x < 1) return `${x} не натуральное`
    if (sum(arr) !== S) return `сумма ${sum(arr)} вместо ${S}`
    if (part === "a" && !arr.includes(X)) return `в наборе нет числа ${X}`
    if (part === "b" && arr.includes(Y)) return `в наборе есть число ${Y}`
    if (part === "c" && arr.filter((x) => x % d === 0).length !== answerC) {
      return `кратных ${d} ровно ${arr.filter((x) => x % d === 0).length} вместо ${answerC}`
    }
    return null
  }
  const solve = (P) => {
    // Пространство: все наборы из P.N различных натуральных чисел, не превосходящих
    // B = P.S − (P.N−1)P.N/2 (больше в наборе с суммой P.S быть не может).
    const Bmax = P.S - (P.N - 1) * P.N / 2
    const all = []
    for (let x = 1; x <= Bmax; x++) all.push(x)
    const dpMin = knapMinMark(all, (v) => v % P.d === 0, P.N, P.S)
    const best = dpMin[P.N][P.S] < 127 ? dpMin[P.N][P.S] : -1
    // а): существует ли набор, содержащий X
    let a = false
    if (P.X <= Bmax) {
      const rest = all.filter((v) => v !== P.X)
      const dp = knap(rest, P.N - 1, P.S - P.X)
      a = !!dp[P.N - 1][P.S - P.X]
    }
    // б): существует ли набор, не содержащий Y
    const without = all.filter((v) => v !== P.Y)
    const dpW = knap(without, P.N, P.S)
    const b = !!dpW[P.N][P.S]
    // в): dpMin — это минимум по всему пространству, поэтому «best − 1» недостижимо
    // ровно тогда, когда dpMin[N][S] === best (проверяем явно, а не постулируем).
    const cNext = best > 0 ? dpMin[P.N][P.S] < best : false
    return { a, b, c: best, c_next: cNext }
  }

  return item({
    preamble: `На доске написано ${distNat(N)}, сумма которых равна ${S}.`,
    qa: `Может ли оказаться, что на доске написано число ${X}?`,
    qb: `Может ли оказаться, что на доске нет числа ${Y}?`,
    qc: `Какое наименьшее количество чисел, кратных ${d}, может быть на доске?`,
    ansA: yesA
      ? `да, например ${runText(1, 1, N - 1)} и ${B}`
      : `нет: остальные ${N - 1} различных натуральных числа дают не менее ${(N - 1) * N / 2}, поэтому наибольшее число на доске не превосходит ${B} < ${X}`,
    ansB: `нет: ${distNat(N)} без числа ${Y} дают в сумме не менее ${minWithoutY} > ${S}`,
    ansC: `${answerC}; пример: числа ${runText(1, 1, N)}, в которых ${joinRu(removedTxt)} ${plural(r, "заменено", "заменены", "заменены")} на ${joinRu(addedTxt)}; меньше нельзя — каждая следующая замена кратного ${d} стоит не меньше ${nextC}, а запас суммы равен всего ${slack}`,
    solution: `Наименьшая возможная сумма ${N} различных натуральных чисел равна 1+2+…+${N} = ${base}, поэтому «запас» равен ${S} − ${base} = ${slack}.\nЛюбой набор получается из {1, 2, …, ${N}} увеличением чисел суммарно на ${slack}. Среди 1…${N} ровно ${M} ${plural(M, "число кратно", "числа кратны", "чисел кратны")} ${d}. Чтобы избавиться от кратного, его нужно заменить на некратное число, большее ${N}; дешевле всего менять наибольшие кратные на наименьшие свободные: стоимости замен равны ${joinRu(costs.slice(0, Math.min(costs.length, 4)))}…\nНа запас ${slack} хватает ровно ${r} ${plural(r, "замены", "замен", "замен")}, поэтому кратных остаётся ${answerC}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: yesA, example: yesA ? exA : null, reason: yesA ? null : "maxelem", target: X },
        b: { type: "yesno", yes: false, reason: "minsum-without", target: Y },
        c: { type: "extremum", mode: "min", value: answerC, example: setC },
      },
      mustMention: [N, S, X, Y, d],
      extra: [],
      phrases: ["различн", "натуральн", "сумма которых равна"],
    },
  })
}

// ── реестр ─────────────────────────────────────────────────────────────────
export const META19 = [
  ["Четыре последовательных числа, делённые на цифру", [
    ["four-consec-last-digit", "Делят на последнюю цифру → наибольшее целое S", t19FourConsecLastDigit],
    ["four-consec-first-digit", "Делят на первую цифру → наибольшее целое S на отрезке", t19FourConsecFirstDigit],
    ["four-consec-any-digit", "Делят на любую ненулевую цифру → наибольшая целая сумма", t19FourConsecAnyDigit],
  ]],
  ["Трёхзначное число и сумма его цифр", [
    ["three-quot-max", "Не кратное 100 → наибольшее частное A : S(A)", t19ThreeQuotMax],
    ["three-quot-min", "Трёхзначное → наименьшее частное A : S(A)", t19ThreeQuotMin],
    ["three-ratio-max-lead", "Отношение целое, первая цифра d → наибольшее", t19ThreeRatioMaxLead],
    ["three-ratio-min-lead", "Отношение целое, первая цифра d → наименьшее", t19ThreeRatioMinLead],
    ["three-minus-digits-div3", "(A − S(A))/3: сколько различных значений на отрезке", t19ThreeMinusDigitsDiv3],
    ["three-add-tens-ratio", "A + 10·(цифра десятков) + k → наибольшее отношение", t19ThreeAddTensRatio],
    ["three-AS-max", "A·S(A): наибольшее произведение, меньшее K", t19ThreeASMax],
    ["three-AS-min", "A·S(A): наименьшее произведение, большее K", t19ThreeASMin],
  ]],
  ["Доска: набор чисел с ограничением на сумму", [
    ["board-even-or-tail3", "N чисел: чётные или на 3, сумма S → наим. кол-во на 3", t19BoardEvenOrTail3],
    ["board-tail2-tail6", "N чисел на c₁ или c₂, сумма S → наим. кол-во на c₂", t19BoardTail2Tail6],
    ["board-div3-tail4", "Делятся на p и оканчиваются на c → наиб. кол-во при сумме", t19BoardDivTail],
    ["board-digits-1-6", "Запись только из цифр d и d+5 → наим. кол-во при сумме", t19BoardTwoDigits],
    ["board-100-sum", "N различных, сумма S → наим. кол-во кратных d", t19BoardDistinctSum],
  ]],
]

export const GEN19 = META19.flatMap(([, skins]) => skins.map(([, , fn]) => fn))

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 4. Трёхзначное число и сумма его цифр (#13, #14, #15, #16, #17, #18, #19, #20, #21)
// ═══════════════════════════════════════════════════════════════════════════

const digitSum = (n) => { let s = 0, x = n; while (x) { s += x % 10; x = (x - x % 10) / 10 } return s }

// Таблица частных: все трёхзначные A, у которых сумма цифр делит A.
// Строится ОДИН раз при импорте перебором по паре (сумма цифр s, частное q) —
// то есть принципиально иначе, чем solve(), который идёт по самому A.
// Это и есть «два независимых представления» для семейства #13–#16.
const QUOT_TABLE = (() => {
  const out = []
  for (let s = 1; s <= 27; s++) {
    for (let q = 1; q * s <= 999; q++) {
      const A = q * s
      if (A < 100) continue
      if (digitSum(A) === s) out.push({ A, s, q })
    }
  }
  return out
})()
// Все трёхзначные числа с заданной суммой цифр — рекурсией по цифрам (для #19/#20).
const BY_DIGIT_SUM = (() => {
  const map = new Map()
  for (let x = 1; x <= 9; x++) for (let y = 0; y <= 9; y++) for (let z = 0; z <= 9; z++) {
    const s = x + y + z
    if (!map.has(s)) map.set(s, [])
    map.get(s).push(100 * x + 10 * y + z)
  }
  return map
})()

// Общий генератор для семейства «частное/отношение трёхзначного числа и суммы его цифр».
// mode: "max" | "min"; lead — обязательная первая цифра (0 = без ограничения);
// noHundred — запрет чисел, кратных 100; ratioWord — формулировка эталона.
function quotientFamily({ mode, lead, noHundred, style }) {
  // Пункт в) эталона несёт свои ограничения (не кратно 100 / первая цифра d);
  // пункты а) и б) спрашивают про то же частное БЕЗ них (в стиле «quot» запрет
  // кратности 100 стоит в преамбуле, поэтому действует везде).
  const fitsC = (r) => (!noHundred || r.A % 100 !== 0) && (!lead || Math.floor(r.A / 100) === lead)
  const fitsAB = (r) => (style !== "quot" || !noHundred || r.A % 100 !== 0)
  const rowsC = QUOT_TABLE.filter(fitsC)
  const rowsAB = QUOT_TABLE.filter(fitsAB)
  if (rowsC.length < 3 || rowsAB.length < 3) return null
  const qsC = [...new Set(rowsC.map((r) => r.q))].sort((a, b) => a - b)
  const qsAB = [...new Set(rowsAB.map((r) => r.q))].sort((a, b) => a - b)
  const answer = mode === "max" ? qsC[qsC.length - 1] : qsC[0]
  const exC = rowsC.filter((r) => r.q === answer)[0].A
  // а) — достижимое частное (кроме крайнего, чтобы не дублировать пункт в).
  const inner = qsAB.filter((q) => q !== answer)
  if (!inner.length) return null
  const q1 = pick(inner)
  const exA = rowsAB.filter((r) => r.q === q1)[0].A
  // б) — недостижимое частное рядом с достижимыми.
  const holes = []
  for (let q = qsAB[0]; q <= qsAB[qsAB.length - 1]; q++) if (!qsAB.includes(q)) holes.push(q)
  if (!holes.length) return null
  const q2 = pick(holes)
  // допустимые суммы цифр для q2: A ≡ S (mod 9) ⇒ (q2−1)·S кратно 9
  // Ограничения «не кратно 100» и «первая цифра» в формулировке эталона #15/#16
  // относятся ТОЛЬКО к пункту в); в пунктах а)/б) их нет.
  const admissible = []
  for (let s = 1; s <= 27; s++) {
    const A = q2 * s
    if (A < 100 || A > 999) continue
    if (((q2 - 1) * s) % 9 !== 0) continue
    if (style === "quot" && noHundred && A % 100 === 0) continue
    admissible.push(s)
  }

  // Текст обоснования пункта б): перечисляем допустимые S и показываем, что ни одно
  // из чисел q2·S не имеет нужной суммы цифр.
  const holeReason = admissible.length === 0
    ? `ни одно такое S не даёт трёхзначного числа`
    : admissible.length === 1
      ? `подходит только S = ${admissible[0]}, но сумма цифр числа ${q2 * admissible[0]} равна ${digitSum(q2 * admissible[0])}, а не ${admissible[0]}`
      : `подходят только S = ${joinRu(admissible)}; суммы цифр чисел ${joinRu(admissible.map((v) => q2 * v))} равны ${joinRu(admissible.map((v) => digitSum(q2 * v)))} — ни одна не совпала с нужной`

  const cond = []
  if (style === "quot") {
    cond.push(`Дано трёхзначное натуральное число (число не может начинаться с нуля)${noHundred ? ", не кратное 100" : ""}.`)
  } else {
    cond.push("Отношение трёхзначного натурального числа к сумме его цифр — целое число.")
  }
  const tailC = style === "quot"
    ? `Какое ${mode === "max" ? "наибольшее" : "наименьшее"} натуральное значение может иметь частное данного числа и суммы его цифр?`
    : `Какое ${mode === "max" ? "наибольшее" : "наименьшее"} значение может принимать это отношение, если ${noHundred ? "число не делится на 100 и " : ""}первая цифра трёхзначного числа равна ${lead}?`
  const qWord = style === "quot" ? "частное этого числа и суммы его цифр" : "это отношение"

  const params = { mode, lead, noHundred, style, q1, q2, answer }
  const check = (A, part) => {
    if (!Number.isInteger(A) || A < 100 || A > 999) return `${A} не трёхзначное`
    if (style === "ratio" && A % digitSum(A) !== 0) return `отношение ${A} к сумме цифр не целое`
    if (part === "c") {
      if (noHundred && A % 100 === 0) return `${A} кратно 100`
      if (lead && Math.floor(A / 100) !== lead) return `первая цифра ${A} не ${lead}`
    } else if (style === "quot" && noHundred && A % 100 === 0) return `${A} кратно 100`
    const target = part === "a" ? q1 : part === "b" ? q2 : answer
    if (A !== target * digitSum(A)) return `${A} / ${digitSum(A)} ≠ ${target}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: ВСЕ трёхзначные числа 100…999 (иных в условии нет).
    const ok = (A) => {
      if (A % digitSum(A) !== 0) return false
      if (P.style === "quot" && P.noHundred && A % 100 === 0) return false
      return true
    }
    const okC = (A) => ok(A) && (!P.noHundred || A % 100 !== 0) && (!P.lead || Math.floor(A / 100) === P.lead)
    // а) и б) — ограничение «первая цифра» относится ТОЛЬКО к пункту в) эталона
    const reach = (q) => { for (let A = 100; A <= 999; A++) if (ok(A) && A / digitSum(A) === q) return true; return false }
    let best = null
    for (let A = 100; A <= 999; A++) {
      if (!okC(A)) continue
      const q = A / digitSum(A)
      if (best === null || (P.mode === "max" ? q > best : q < best)) best = q
    }
    const nextQ = P.mode === "max" ? best + 1 : best - 1
    let nextReach = false
    for (let A = 100; A <= 999; A++) if (okC(A) && A / digitSum(A) === nextQ) nextReach = true
    return { a: reach(P.q1), b: reach(P.q2), c: best, c_next: nextReach }
  }

  const bound = mode === "max" ? `при частном q > ${answer} сумма цифр S = A/q не превосходит ${Math.floor(999 / (answer + 1))}` :
    `при частном q < ${answer} из A = q·S и S ≤ 27 следует A ≤ ${(answer - 1) * 27}`
  return item({
    preamble: cond.join(" "),
    qa: `Может ли ${qWord} быть равным ${q1}?`,
    qb: `Может ли ${qWord} быть равным ${q2}?`,
    qc: tailC,
    ansA: `да, например ${exA} (сумма цифр ${digitSum(exA)}, ${exA} : ${digitSum(exA)} = ${q1})`,
    ansB: `нет: из A = ${q2}·S и A ≡ S (mod 9) следует, что ${q2 - 1}·S кратно 9; ${holeReason}`,
    ansC: `${answer}; пример: ${exC} (сумма цифр ${digitSum(exC)}, ${exC} : ${digitSum(exC)} = ${answer}); ${mode === "max" ? "больше" : "меньше"} нельзя — ${bound}, и прямая проверка всех оставшихся пар (q, S) трёхзначных чисел не даёт`,
    solution: `Обозначим число A, сумму его цифр S. Всегда A ≡ S (mod 9), поэтому из A = q·S следует, что (q − 1)·S кратно 9 — это отсекает большинство значений q.\nДля q = ${q2}: ${holeReason}, значит ${q2} невозможно.\nДля q = ${q1} подходит число ${exA}. ${mode === "max" ? "Наибольшее" : "Наименьшее"} значение равно ${answer} и достигается на ${exC}: ${bound}, а оставшиеся пары (q, S) проверяются напрямую.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: q1 },
        b: { type: "yesno", yes: false, reason: "mod9", target: q2 },
        c: { type: "extremum", mode, value: answer, example: exC },
      },
      mustMention: [q1, q2, ...(lead ? [lead] : [])],
      extra: [100, 0],
      phrases: style === "quot" ? ["трёхзначное натуральное число"] : ["Отношение трёхзначного натурального числа к сумме его цифр — целое число"],
    },
  })
}

// #13. Трёхзначное, не кратное 100 → наибольшее натуральное частное A : S(A).
export function t19ThreeQuotMax() { return quotientFamily({ mode: "max", lead: 0, noHundred: true, style: "quot" }) }
// #14. Трёхзначное → наименьшее натуральное частное A : S(A).
export function t19ThreeQuotMin() { return quotientFamily({ mode: "min", lead: 0, noHundred: false, style: "quot" }) }
// #15. Отношение целое → наибольшее, если число не делится на 100 и первая цифра равна d.
export function t19ThreeRatioMaxLead() { return quotientFamily({ mode: "max", lead: randInt(1, 9), noHundred: true, style: "ratio" }) }
// #16. Отношение целое → наименьшее, если первая цифра равна d.
export function t19ThreeRatioMinLead() { return quotientFamily({ mode: "min", lead: randInt(1, 9), noHundred: false, style: "ratio" }) }

// #17. С трёхзначным числом: вычитают сумму его цифр, разность делят на 3.
//      а) могло ли получиться v1? б) v2? в) сколько различных чисел получается из [L; R].
// A − S(A) = 99a + 9b = 9(11a + b), поэтому результат равен 3(11a + b) — он не зависит
// от последней цифры и всегда кратен 3. Отображение «десяток числа → результат» инъективно,
// значит различных результатов ровно столько, сколько десятков пересекает [L; R].
export function t19ThreeMinusDigitsDiv3() {
  const a1 = randInt(1, 9), b1 = randInt(0, 9)
  const v1 = 3 * (11 * a1 + b1)
  const exA = 100 * a1 + 10 * b1 + randInt(0, 9)
  // б) — «нет»: либо результат не кратен 3, либо t = v2/3 не представим как 11a + b, b ≤ 9.
  const badMod3 = Math.random() < 0.5
  let v2, reasonB
  if (badMod3) {
    v2 = 3 * randInt(11, 108) + pick([1, 2])
    reasonB = "not-div3"
  } else {
    const a2 = randInt(1, 9)
    v2 = 3 * (11 * a2 + 10)                 // остаток 10 при делении на 11 недостижим
    reasonB = "not-representable"
  }
  if (v2 === v1) return null
  const L = 100 * randInt(1, 4), R = 100 * randInt(5, 9) + (Math.random() < 0.5 ? 0 : 99)
  const count = Math.floor(R / 10) - Math.floor(L / 10) + 1

  const params = { v1, v2, L, R, count }
  const check = (A, part) => {
    if (!Number.isInteger(A) || A < 100 || A > 999) return `${A} не трёхзначное`
    const res = (A - digitSum(A)) / 3
    const target = part === "a" ? v1 : v2
    if (part !== "c" && res !== target) return `из ${A} получается ${res}, а не ${target}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все трёхзначные числа 100…999 (для а/б) и все числа
    // отрезка [P.L; P.R] (для в) — иных чисел в условии нет.
    const res = (A) => (A - digitSum(A)) / 3
    const reach = (v) => { for (let A = 100; A <= 999; A++) if (res(A) === v) return true; return false }
    const set = new Set()
    for (let A = P.L; A <= P.R; A++) set.add(res(A))
    return { a: reach(P.v1), b: reach(P.v2), c: set.size }
  }

  return item({
    preamble: `С трёхзначным числом производят следующую операцию: вычитают из него сумму его цифр, а затем получившуюся разность делят на 3.`,
    qa: `Могло ли в результате такой операции получиться число ${v1}?`,
    qb: `Могло ли в результате такой операции получиться число ${v2}?`,
    qc: `Сколько различных чисел может получиться в результате такой операции из чисел от ${L} до ${R} включительно?`,
    ansA: `да, например из числа ${exA}: ${exA} − ${digitSum(exA)} = ${exA - digitSum(exA)}, и ${exA - digitSum(exA)} : 3 = ${v1}`,
    ansB: badMod3
      ? `нет: A − S(A) = 99a + 9b кратно 9, поэтому результат всегда кратен 3, а ${v2} на 3 не делится`
      : `нет: результат равен 3(11a + b), где a — цифра сотен, b — цифра десятков; из ${v2} : 3 = ${v2 / 3} следует 11a + b = ${v2 / 3}, что даёт b = 10 — не цифра`,
    ansC: `${count}: результат равен 3(11a + b) и не зависит от последней цифры, а разным парам (a, b) отвечают разные результаты, поэтому различных чисел столько же, сколько десятков пересекает отрезок [${L}; ${R}], то есть ${Math.floor(R / 10)} − ${Math.floor(L / 10)} + 1 = ${count}`,
    solution: `Пусть A = 100a + 10b + c. Тогда A − S(A) = 99a + 9b = 9(11a + b), и после деления на 3 получается 3(11a + b).\nОтсюда сразу: результат всегда кратен 3 и не зависит от последней цифры c. Разным парам (a, b) отвечают разные значения 11a + b (если 11a₁ + b₁ = 11a₂ + b₂, то 11(a₁ − a₂) = b₂ − b₁, а |b₂ − b₁| ≤ 9, значит a₁ = a₂ и b₁ = b₂).\nПоэтому на отрезке [${L}; ${R}] различных результатов ровно столько, сколько там десятков: ${Math.floor(R / 10)} − ${Math.floor(L / 10)} + 1 = ${count}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: v1 },
        b: { type: "yesno", yes: false, reason: reasonB, target: v2 },
        c: { type: "count", value: count },
      },
      mustMention: [v1, v2, L, R],
      extra: [3],
      phrases: ["трёхзначным числом", "вычитают из него сумму его цифр", "делят на 3"],
    },
  })
}

// #18. С трёхзначным числом: прибавляют цифру десятков, умноженную на 10, затем прибавляют k.
//      а) могло ли получиться v1? б) v2? в) наибольшее отношение полученного к исходному.
// B = 100a + 20b + c + k, поэтому B − k внутри своей сотни даёт при делении на 20 остаток ≤ 9.
// Отношение B/A = 1 + (10b + k)/A растёт с b и убывает с A, поэтому максимум — при b = 9
// и наименьшем таком числе, то есть при A = 190.
export function t19ThreeAddTensRatio() {
  const k = randInt(1, 9)
  const a1 = randInt(1, 9), b1 = randInt(0, 9), c1 = randInt(0, 9)
  const exA = 100 * a1 + 10 * b1 + c1
  const v1 = exA + 10 * b1 + k
  // б) — «нет»: B − k = 100a₀ + r, r ∈ [10; 19] недостижимо ни при одной первой цифре.
  const a2 = randInt(2, 9), r2 = randInt(10, 19)
  const v2 = 100 * a2 + r2 + k
  if (v1 === v2) return null
  const bestA = 190, bestB = 190 + 90 + k
  const g = (x, y) => (y ? g(y, x % y) : x)
  const gg = g(bestB, bestA)
  const ratio = bestB / bestA

  const params = { k, v1, v2, ratio }
  const check = (A, part) => {
    if (!Number.isInteger(A) || A < 100 || A > 999) return `${A} не трёхзначное`
    const tens = Math.floor(A / 10) % 10
    const B = A + 10 * tens + k
    if (part === "a" && B !== v1) return `из ${A} получается ${B}, а не ${v1}`
    if (part === "b" && B !== v2) return `из ${A} получается ${B}, а не ${v2}`
    if (part === "c" && Math.abs(B / A - ratio) > 1e-12) return `отношение ${B}/${A} не равно максимальному`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все трёхзначные числа 100…999.
    const B = (A) => A + 10 * (Math.floor(A / 10) % 10) + P.k
    const reach = (v) => { for (let A = 100; A <= 999; A++) if (B(A) === v) return true; return false }
    let best = 0
    for (let A = 100; A <= 999; A++) best = Math.max(best, B(A) / A)
    return { a: reach(P.v1), b: reach(P.v2), c: best }
  }

  return item({
    preamble: `С трёхзначным числом производят следующую операцию: к нему прибавляют цифру десятков, умноженную на 10, а затем к получившейся сумме прибавляют ${k}.`,
    qa: `Могло ли в результате такой операции получиться число ${v1}?`,
    qb: `Могло ли в результате такой операции получиться число ${v2}?`,
    qc: `Найдите наибольшее отношение получившегося числа к исходному.`,
    ansA: `да, например из числа ${exA}: ${exA} + 10·${b1} + ${k} = ${v1}`,
    ansB: `нет: полученное число равно 100a + 20b + c + ${k}, поэтому ${v2} − ${k} = ${v2 - k} после вычитания 100a должно давать при делении на 20 остаток не больше 9. При a = ${a2} остаётся ${r2}, при a = ${a2 - 1} остаётся ${100 + r2}; оба дают остаток ${r2} > 9, а при меньших a остаётся больше 189 = 20·9 + 9`,
    ansC: `${bestB / gg}/${bestA / gg} (при исходном числе 190: ${bestA} → ${bestB})`,
    solution: `Пусть A = 100a + 10b + c. Полученное число равно B = A + 10b + ${k} = 100a + 20b + c + ${k}.\nОтношение B/A = 1 + (10b + ${k})/A растёт при увеличении b и убывает при увеличении A, поэтому нужно взять наибольшую цифру десятков b = 9 и наименьшее такое число A = 190.\nТогда B = 190 + 90 + ${k} = ${bestB}, и наибольшее отношение равно ${bestB}/${bestA} = ${bestB / gg}/${bestA / gg}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: v1 },
        b: { type: "yesno", yes: false, reason: "mod20", target: v2 },
        c: { type: "value", value: ratio, example: bestA },
      },
      mustMention: [k, v1, v2],
      extra: [10],
      phrases: ["трёхзначным числом", "прибавляют цифру десятков, умноженную на 10"],
    },
  })
}

// Произведения A·S(A) для всех трёхзначных A — строим по суммам цифр (BY_DIGIT_SUM),
// то есть иначе, чем solve(), который идёт по A и считает сумму цифр делением.
const AS_PRODUCTS = (() => {
  const map = new Map()
  for (const [s, list] of BY_DIGIT_SUM) for (const A of list) if (!map.has(A * s)) map.set(A * s, A)
  return map
})()
const AS_SORTED = [...AS_PRODUCTS.keys()].sort((a, b) => a - b)
const AS_MAX = AS_SORTED[AS_SORTED.length - 1]
// Простые до 27000 — нужны для «нет» в пункте б) (простое произведение невозможно).
const PRIMES = (() => {
  const n = 27000, sieve = new Uint8Array(n + 1), out = []
  for (let i = 2; i <= n; i++) { if (!sieve[i]) { out.push(i); for (let j = i * i; j <= n; j += i) sieve[j] = 1 } }
  return out.filter((p) => p > 1500)
})()

// #19/#21 (max) и #20 (min). Дано трёхзначное число A, сумма цифр которого равна S.
function asFamily(mode) {
  const K3 = randInt(1500, 24000)
  let answer = null
  if (mode === "max") {
    for (let i = AS_SORTED.length - 1; i >= 0; i--) if (AS_SORTED[i] < K3) { answer = AS_SORTED[i]; break }
  } else {
    for (let i = 0; i < AS_SORTED.length; i++) if (AS_SORTED[i] > K3) { answer = AS_SORTED[i]; break }
  }
  if (answer === null) return null
  const exC = AS_PRODUCTS.get(answer)
  // а) — «да» (достижимое произведение) или «нет» по оценке A·S ≤ 999·27.
  const yesA = Math.random() < 0.5
  const K1 = yesA ? pick(AS_SORTED) : randInt(AS_MAX + 1, 40000)
  const exA = yesA ? AS_PRODUCTS.get(K1) : null
  // б) — «нет»: простое произведение (S — делитель, но S ≤ 27 и A трёхзначно).
  const K2 = pick(PRIMES)
  if (K1 === K2 || K2 === K3 || K1 === K3 || K2 === answer) return null

  const params = { mode, K1, K2, K3, answer, yesA }
  const check = (A, part) => {
    if (!Number.isInteger(A) || A < 100 || A > 999) return `${A} не трёхзначное`
    const p = A * digitSum(A)
    const target = part === "a" ? K1 : part === "b" ? K2 : answer
    if (p !== target) return `${A}·${digitSum(A)} = ${p}, а не ${target}`
    if (part === "c" && (mode === "max" ? p >= K3 : p <= K3)) return `${p} не ${mode === "max" ? "меньше" : "больше"} ${K3}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все трёхзначные числа 100…999.
    const prod = (A) => A * digitSum(A)
    const reach = (v) => { for (let A = 100; A <= 999; A++) if (prod(A) === v) return true; return false }
    let best = null
    for (let A = 100; A <= 999; A++) {
      const p = prod(A)
      if (P.mode === "max") { if (p < P.K3 && (best === null || p > best)) best = p }
      else if (p > P.K3 && (best === null || p < best)) best = p
    }
    return { a: reach(P.K1), b: reach(P.K2), c: best }
  }

  return item({
    preamble: `Дано трёхзначное число A, сумма цифр которого равна S.`,
    qa: `Может ли выполняться равенство A · S = ${K1}?`,
    qb: `Может ли выполняться равенство A · S = ${K2}?`,
    qc: mode === "max"
      ? `Найдите наибольшее произведение A · S, меньшее ${K3}.`
      : `Какое наименьшее значение может принимать произведение A · S, если оно больше ${K3}?`,
    ansA: yesA
      ? `да, например A = ${exA}: сумма цифр равна ${digitSum(exA)} и ${exA} · ${digitSum(exA)} = ${K1}`
      : `нет: A ≤ 999 и S ≤ 27, поэтому A · S ≤ 999 · 27 = ${AS_MAX} < ${K1}`,
    ansB: `нет: S — делитель произведения, а ${K2} простое, поэтому S = 1 или S = ${K2}; при S = 1 получаем A = ${K2}, что не трёхзначно, а S = ${K2} больше максимальной суммы цифр 27`,
    ansC: `${answer}; достигается при A = ${exC} (сумма цифр ${digitSum(exC)}, ${exC} · ${digitSum(exC)} = ${answer}); ${mode === "max" ? `больших произведений, меньших ${K3}, нет` : `меньших произведений, больших ${K3}, нет`}`,
    solution: `Для трёхзначного A сумма цифр S не превосходит 27, поэтому A · S ≤ 999 · 27 = 26973 — это сразу отсекает слишком большие значения.\nЕсли A · S = p, то S — делитель p, не превосходящий 27, а A = p/S обязано быть трёхзначным с суммой цифр ровно S. Для простого p = ${K2} остаются только S = 1 и S = ${K2}, и оба не подходят.\nПеребирая S от 1 до 27 и A = p/S, находим ${mode === "max" ? "наибольшее" : "наименьшее"} подходящее произведение ${mode === "max" ? "меньше" : "больше"} ${K3}: это ${answer} при A = ${exC}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: yesA, example: exA, reason: yesA ? null : "upper-bound", target: K1 },
        b: { type: "yesno", yes: false, reason: "prime", target: K2 },
        c: { type: "value", value: answer, example: exC },
      },
      mustMention: [K1, K2, K3],
      extra: [999, 27, 26973, 1],
      phrases: ["трёхзначное число A, сумма цифр которого равна S"],
    },
  })
}
export function t19ThreeASMax() { return asFamily("max") }
export function t19ThreeASMin() { return asFamily("min") }

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 7. Четыре последовательных числа, делённые на цифру (#70, #71, #72)
// ═══════════════════════════════════════════════════════════════════════════

// Точная дробная арифметика (числа маленькие, переполнения нет).
const gcdI = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) {[a, b] = [b, a % b] } return a || 1 }
const fr = (n, d = 1) => { const g = gcdI(n, d); return { n: n / g, d: d / g } }
const frAdd = (a, b) => fr(a.n * b.d + b.n * a.d, a.d * b.d)
const frVal = (a) => a.n / a.d
// «16 5/6» для ответа (plain) и «16 ⟦f:5:6⟧» для условия (дробь стоячей).
function frPlain(a) {
  if (a.d === 1) return String(a.n)
  const w = Math.floor(a.n / a.d), r = a.n - w * a.d
  return w ? `${w} ${r}/${a.d}` : `${r}/${a.d}`
}
function frCond(a) {
  if (a.d === 1) return String(a.n)
  const w = Math.floor(a.n / a.d), r = a.n - w * a.d
  return w ? `${w} ⟦f:${r}:${a.d}⟧` : `⟦f:${r}:${a.d}⟧`
}
const frNums = (a) => (a.d === 1 ? [a.n] : [Math.floor(a.n / a.d), a.n - Math.floor(a.n / a.d) * a.d, a.d].filter((x) => x))
const digitsOf = (n) => String(n).split("").map(Number)
// Числитель, взаимно простой со знаменателем: иначе дробь сократится и довод про НОК падает.
const coprimeTo = (q) => { const c = []; for (let r = 1; r < q; r++) if (gcdI(r, q) === 1) c.push(r); return pick(c) }

// #71. Четыре последовательных числа с ненулевыми последними цифрами делят на последнюю цифру.
// Ключ: если n = 10m + d, то (n + i)/(d + i) = 10m/(d + i) + 1, поэтому
//   S = 4 + 10m·H,  H = 1/d + 1/(d+1) + 1/(d+2) + 1/(d+3),
// то есть S линейно растёт по m, а целость S — чисто арифметическое условие на m.
const LCM4 = [...new Set([1, 2, 3, 4, 5, 6].map((d) => [d, d + 1, d + 2, d + 3].reduce((L, x) => L * x / gcdI(L, x), 1)))].sort((a, b) => a - b)
const H4 = [1, 2, 3, 4, 5, 6].map((d) => [0, 1, 2, 3].reduce((a, i) => frAdd(a, fr(1, d + i)), fr(0)))
export function t19FourConsecLastDigit() {
  // а) — «да»: берём конкретную четвёрку и считаем её сумму.
  const dA = randInt(1, 6), mA = randInt(10, 99)
  const nA = 10 * mA + dA
  const SA = frAdd(fr(4), fr(10 * mA * H4[dA - 1].n, H4[dA - 1].d))
  // б) — «нет»: знаменатель несократимой дроби S делит НОК четырёх подряд идущих цифр,
  // то есть одно из чисел LCM4; берём знаменатель, не делящий ни одного из них.
  const badQ = pick([11, 13, 16, 17, 19, 23, 25, 27, 29, 31, 32].filter((q) => LCM4.every((L) => L % q !== 0)))
  const SB = fr(randInt(20, 400) * badQ + coprimeTo(badQ), badQ)
  if (frVal(SA) === frVal(SB)) return null
  // в) — наибольшее целое S для трёхзначных чисел: m ∈ [10; (996 − d)/10],
  // 10m·H целое ⟺ m кратно q/НОД(q,10), где H = p/q.
  let best = null
  for (let d = 1; d <= 6; d++) {
    const H = H4[d - 1]
    const M = H.d / gcdI(H.d, 10)
    const mMax = Math.floor((996 - d) / 10)
    const mStar = Math.floor(mMax / M) * M
    if (mStar < 10) continue
    const S = 4 + 10 * mStar * H.n / H.d
    if (!best || S > best.S) best = { S, d, m: mStar, n: 10 * mStar + d, M }
  }
  if (!best) return null

  const params = { SA: frVal(SA), SB: frVal(SB), best: best.S }
  const check = (n, part) => {
    if (!Number.isInteger(n) || n < 1) return `${n} не натуральное`
    let s = fr(0)
    for (let i = 0; i < 4; i++) {
      const last = (n + i) % 10
      if (last === 0) return `последняя цифра числа ${n + i} равна нулю`
      s = frAdd(s, fr(n + i, last))
    }
    if (part === "c") {
      for (let i = 0; i < 4; i++) if (n + i < 100 || n + i > 999) return `${n + i} не трёхзначное`
      if (s.d !== 1) return `сумма ${frPlain(s)} не целая`
      if (s.n !== best.S) return `сумма ${s.n}, а не ${best.S}`
    } else {
      const target = part === "a" ? SA : SB
      if (s.n * target.d !== target.n * s.d) return `сумма ${frPlain(s)}, а не ${frPlain(target)}`
    }
    return null
  }
  const solve = (P) => {
    // Пространство перебора для а)/б): S = 4 + 10m·H ≥ 4 + 10m/9·4, поэтому
    // m ≤ 9·S/4; перебираем все m до этой границы и все последние цифры 1…6.
    const sumFor = (n) => { let s = fr(0); for (let i = 0; i < 4; i++) { const L = (n + i) % 10; if (!L) return null; s = frAdd(s, fr(n + i, L)) } return s }
    const reach = (v) => {
      const nMax = Math.ceil(9 * v / 4) + 12
      for (let n = 1; n <= nMax; n++) { const s = sumFor(n); if (s && Math.abs(frVal(s) - v) < 1e-9) return true }
      return false
    }
    // в): все трёхзначные четвёрки 100…996
    let bestS = null
    for (let n = 100; n <= 996; n++) {
      if (n + 3 > 999) break
      const s = sumFor(n)
      if (!s || s.d !== 1) continue
      if (bestS === null || s.n > bestS) bestS = s.n
    }
    return { a: reach(P.SA), b: reach(P.SB), c: bestS }
  }

  return item({
    preamble: `Каждое из четырёх последовательных натуральных чисел, последние цифры которых не равны нулю, поделили на его последнюю цифру. Сумма получившихся чисел равна S.`,
    qa: `Может ли S быть равной ${frCond(SA)}?`,
    qb: `Может ли S быть равной ${frCond(SB)}?`,
    qc: `Найдите наибольшее целое значение S, если каждое из исходных чисел было трёхзначным.`,
    ansA: `да, например для чисел ${nA}, ${nA + 1}, ${nA + 2}, ${nA + 3}: сумма равна ${frPlain(SA)}`,
    ansB: `нет: если первое число равно 10m + d, то S = 4 + 10m·(1/d + 1/(d+1) + 1/(d+2) + 1/(d+3)), поэтому знаменатель несократимой дроби S делит НОК четырёх подряд идущих цифр — одно из чисел ${joinRu(LCM4)}; число ${badQ} не делит ни одно из них`,
    ansC: `${best.S}; достигается на числах ${best.n}, ${best.n + 1}, ${best.n + 2}, ${best.n + 3}; больше нельзя — S = 4 + 10m·H растёт с m, целость требует, чтобы m делилось на ${best.M}, а наибольшее такое m для трёхзначных чисел равно ${best.m}`,
    solution: `Пусть первое число равно n = 10m + d, где d — его последняя цифра (d ≠ 0, и d + 3 ≤ 9, иначе одно из чисел оканчивается нулём, поэтому d ≤ 6).\nТогда (n + i) : (d + i) = (10m + d + i) : (d + i) = 10m/(d + i) + 1, и S = 4 + 10m·H, где H = 1/d + 1/(d+1) + 1/(d+2) + 1/(d+3).\nОтсюда сразу два следствия: знаменатель S делит НОК(d, d+1, d+2, d+3) — одно из чисел ${joinRu(LCM4)}; и S строго растёт с m.\nДля трёхзначных чисел m ≤ ${best.m + best.M - 1}, а из целости S следует, что m кратно ${best.M}. Наибольшее подходящее m равно ${best.m}, что даёт S = ${best.S} на числах ${best.n}—${best.n + 3}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: nA, target: frVal(SA) },
        b: { type: "yesno", yes: false, reason: "denominator", target: frVal(SB) },
        c: { type: "value", value: best.S, example: best.n },
      },
      mustMention: [],
      extra: [...frNums(SA), ...frNums(SB)],
      phrases: ["четырёх последовательных натуральных чисел", "последние цифры которых не равны нулю", "поделили на его последнюю цифру"],
    },
  })
}

// #72. Четыре последовательных числа делят на свою ПЕРВУЮ цифру.
// Внутри «сотни» первая цифра a одна и та же, поэтому S = (4n + 6)/a; при переходе
// через границу сотни часть слагаемых делится на большую цифру, и сумма только падает.
const FIRST_TABLE = (() => {
  const arr = new Array(1000).fill(null)
  for (let n = 100; n + 3 <= 999; n++) {
    let s = fr(0)
    for (let i = 0; i < 4; i++) s = frAdd(s, fr(n + i, digitsOf(n + i)[0]))
    arr[n] = s
  }
  return arr
})()
export function t19FourConsecFirstDigit() {
  const L = 100 * randInt(1, 5), R = 100 * randInt(6, 9) + 99
  // а) — «да»: конкретная четвёрка внутри отрезка.
  const nA = randInt(L, R - 3)
  const SA = FIRST_TABLE[nA]
  // б) — «нет»: знаменатель не делит НОК(1…9) = 2520 (первая цифра — от 1 до 9).
  const badQ = pick([11, 13, 16, 17, 19, 23, 25, 27, 29, 31, 32].filter((q) => 2520 % q !== 0))
  const SB = fr(randInt(20, 500) * badQ + coprimeTo(badQ), badQ)
  if (!SA || frVal(SA) === frVal(SB)) return null
  // в) — наибольшее целое S на отрезке: внутри сотни S = (4n + 6)/a растёт по n,
  // поэтому достаточно для каждой первой цифры взять наибольшее подходящее n.
  let best = null
  for (let a = 1; a <= 9; a++) {
    const lo = Math.max(L, 100 * a), hi = Math.min(R - 3, 100 * a + 96)
    if (lo > hi) continue
    for (let n = hi; n >= lo; n--) {
      if ((4 * n + 6) % a !== 0) continue
      const S = (4 * n + 6) / a
      if (!best || S > best.S) best = { S, n, a }
      break
    }
  }
  if (!best) return null

  const params = { SA: frVal(SA), SB: frVal(SB), L, R, best: best.S }
  const check = (n, part) => {
    if (!Number.isInteger(n) || n < 1) return `${n} не натуральное`
    let s = fr(0)
    for (let i = 0; i < 4; i++) s = frAdd(s, fr(n + i, digitsOf(n + i)[0]))
    if (part === "c") {
      for (let i = 0; i < 4; i++) if (n + i < L || n + i > R) return `${n + i} вне отрезка [${L}; ${R}]`
      if (s.d !== 1) return `сумма ${frPlain(s)} не целая`
      if (s.n !== best.S) return `сумма ${s.n}, а не ${best.S}`
    } else {
      const target = part === "a" ? SA : SB
      if (s.n * target.d !== target.n * s.d) return `сумма ${frPlain(s)}, а не ${frPlain(target)}`
    }
    return null
  }
  const solve = (P) => {
    // Пространство: для а)/б) — все n, при которых сумма не превосходит цели
    // (S ≥ (4n + 6)/9 ⇒ n ≤ 9S/4); для в) — все четвёрки внутри [L; R].
    const sumFor = (n) => { let s = fr(0); for (let i = 0; i < 4; i++) s = frAdd(s, fr(n + i, digitsOf(n + i)[0])); return s }
    const reach = (v) => {
      const nMax = Math.ceil(9 * v / 4) + 12
      for (let n = 1; n <= nMax; n++) if (Math.abs(frVal(sumFor(n)) - v) < 1e-9) return true
      return false
    }
    let bestS = null
    for (let n = P.L; n + 3 <= P.R; n++) {
      const s = sumFor(n)
      if (s.d !== 1) continue
      if (bestS === null || s.n > bestS) bestS = s.n
    }
    return { a: reach(P.SA), b: reach(P.SB), c: bestS }
  }

  return item({
    preamble: `Каждое из четырёх последовательных натуральных чисел разделили на свою первую цифру. Пусть S — сумма четырёх получившихся чисел.`,
    qa: `Может ли S быть равной ${frCond(SA)}?`,
    qb: `Может ли S быть равной ${frCond(SB)}?`,
    qc: `Какое наибольшее целое значение может принимать S, если известно, что 4 исходных числа не меньше ${L} и не больше ${R}?`,
    ansA: `да, например для чисел ${nA}, ${nA + 1}, ${nA + 2}, ${nA + 3}: сумма равна ${frPlain(SA)}`,
    ansB: `нет: каждое слагаемое имеет знаменателем первую цифру, то есть одно из чисел 1…9, поэтому знаменатель несократимой дроби S делит НОК(1, 2, …, 9) = 2520; число ${badQ} его не делит`,
    ansC: `${best.S}; достигается на числах ${best.n}, ${best.n + 1}, ${best.n + 2}, ${best.n + 3}; больше нельзя — внутри одной сотни S = (4n + 6)/a растёт с n и убывает с ростом первой цифры a, а переход через границу сотни только уменьшает сумму`,
    solution: `Если все четыре числа начинаются с одной цифры a, то S = (n + (n+1) + (n+2) + (n+3))/a = (4n + 6)/a. При переходе через границу сотни часть чисел делится на бо́льшую первую цифру, поэтому сумма только уменьшается.\nВнутри сотни S растёт вместе с n, а целость S равносильна делимости 4n + 6 на a. Перебирая первые цифры на отрезке [${L}; ${R}] и беря наибольшее подходящее n для каждой, получаем максимум S = ${best.S} при n = ${best.n} (первая цифра ${best.a}).\nЗнаменатель S всегда делит НОК(1, …, 9) = 2520 — это сразу отсекает «неправильные» дроби.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: nA, target: frVal(SA) },
        b: { type: "yesno", yes: false, reason: "denominator", target: frVal(SB) },
        c: { type: "value", value: best.S, example: best.n },
      },
      mustMention: [L, R],
      extra: [...frNums(SA), ...frNums(SB), 4],
      phrases: ["четырёх последовательных натуральных чисел", "разделили на свою первую цифру"],
    },
  })
}

// #70. Каждое из четырёх последовательных чисел делят на ОДНУ ИЗ его ненулевых цифр
//      (цифру выбирают для каждого числа свою), результаты складывают.
// Таблица «наибольшая ЦЕЛАЯ сумма для четвёрки, начинающейся с n» считается один раз
// при импорте перебором вариантов выбора цифр; в проде — только чтение таблицы.
const ANYDIG_BEST_INT = (() => {
  const arr = new Int32Array(1000).fill(-1)
  for (let n = 100; n + 3 <= 999; n++) {
    const opts = []
    for (let i = 0; i < 4; i++) opts.push([...new Set(digitsOf(n + i).filter((x) => x))])
    let best = -1
    for (const a of opts[0]) for (const b of opts[1]) for (const c of opts[2]) for (const d of opts[3]) {
      let s = fr(0)
      s = frAdd(s, fr(n, a)); s = frAdd(s, fr(n + 1, b)); s = frAdd(s, fr(n + 2, c)); s = frAdd(s, fr(n + 3, d))
      if (s.d === 1 && s.n > best) best = s.n
    }
    arr[n] = best
  }
  return arr
})()
// Префиксные максимумы по фиксированным отрезкам — чтобы в проде не было цикла.
const ANYDIG_RANGES = (() => {
  const map = new Map()
  for (const L of [100, 200, 300, 400, 500, 600]) {
    for (const R of [399, 499, 599, 699, 799, 899, 999]) {
      if (R - 3 < L) continue
      let best = -1, at = -1
      for (let n = L; n + 3 <= R; n++) if (ANYDIG_BEST_INT[n] > best) { best = ANYDIG_BEST_INT[n]; at = n }
      map.set(L + ":" + R, { best, at })
    }
  }
  return map
})()
export function t19FourConsecAnyDigit() {
  const L = pick([100, 200, 300, 400, 500, 600])
  const R = pick([399, 499, 599, 699, 799, 899, 999].filter((r) => r - 3 >= L))
  const rng = ANYDIG_RANGES.get(L + ":" + R)
  if (!rng || rng.best < 0) return null
  // а) — «да»: четвёрка, у каждого числа которой есть цифра 1, тогда сумма равна 4n + 6.
  const nA = 100 * randInt(1, 9) + 10 + randInt(0, 6)
  const v1 = 4 * nA + 6
  // б) — «нет»: знаменатель несократимой дроби делит НОК(1…9) = 2520.
  const badQ = pick([11, 13, 16, 17, 19, 23, 25, 27, 29, 31, 32].filter((q) => 2520 % q !== 0))
  const SB = fr(randInt(5, 200) * badQ + coprimeTo(badQ), badQ)

  const params = { v1, SB: frVal(SB), L, R, best: rng.best }
  const check = (n, part) => {
    if (!Number.isInteger(n) || n < 1) return `${n} не натуральное`
    // сумма зависит от выбора цифр — проверяем, что НУЖНОЕ значение достижимо
    const opts = []
    for (let i = 0; i < 4; i++) {
      const ds = [...new Set(digitsOf(n + i).filter((x) => x))]
      if (!ds.length) return `у числа ${n + i} нет ненулевых цифр`
      opts.push(ds)
    }
    const target = part === "a" ? fr(v1) : part === "b" ? SB : fr(rng.best)
    if (part === "c") for (let i = 0; i < 4; i++) if (n + i < L || n + i > R) return `${n + i} вне отрезка [${L}; ${R}]`
    for (const a of opts[0]) for (const b of opts[1]) for (const c of opts[2]) for (const d of opts[3]) {
      let s = fr(0)
      s = frAdd(s, fr(n, a)); s = frAdd(s, fr(n + 1, b)); s = frAdd(s, fr(n + 2, c)); s = frAdd(s, fr(n + 3, d))
      if (s.n * target.d === target.n * s.d) return null
    }
    return `для четвёрки ${n}…${n + 3} сумма ${frPlain(target)} не получается ни при каком выборе цифр`
  }
  const solve = (P) => {
    // Пространство: сумма не меньше (4n + 6)/9, поэтому для значения v достаточно
    // проверить n ≤ 9v/4; для каждого n перебираем все выборы цифр.
    const hits = (n, v) => {
      const opts = []
      for (let i = 0; i < 4; i++) { const ds = [...new Set(digitsOf(n + i).filter((x) => x))]; if (!ds.length) return false; opts.push(ds) }
      for (const a of opts[0]) for (const b of opts[1]) for (const c of opts[2]) for (const d of opts[3]) {
        let s = fr(0)
        s = frAdd(s, fr(n, a)); s = frAdd(s, fr(n + 1, b)); s = frAdd(s, fr(n + 2, c)); s = frAdd(s, fr(n + 3, d))
        if (Math.abs(frVal(s) - v) < 1e-9) return true
      }
      return false
    }
    const reach = (v) => { const nMax = Math.ceil(9 * v / 4) + 12; for (let n = 1; n <= nMax; n++) if (hits(n, v)) return true; return false }
    let bestS = -1
    for (let n = P.L; n + 3 <= P.R; n++) {
      const opts = []
      for (let i = 0; i < 4; i++) opts.push([...new Set(digitsOf(n + i).filter((x) => x))])
      for (const a of opts[0]) for (const b of opts[1]) for (const c of opts[2]) for (const d of opts[3]) {
        let s = fr(0)
        s = frAdd(s, fr(n, a)); s = frAdd(s, fr(n + 1, b)); s = frAdd(s, fr(n + 2, c)); s = frAdd(s, fr(n + 3, d))
        if (s.d === 1 && s.n > bestS) bestS = s.n
      }
    }
    return { a: reach(P.v1), b: reach(P.SB), c: bestS }
  }

  return item({
    preamble: `Даны четыре последовательных натуральных числа. Каждое из чисел поделили на одну из его цифр, не равную нулю, а затем четыре полученных результата сложили.`,
    qa: `Может ли полученная сумма равняться ${v1}?`,
    qb: `Может ли полученная сумма равняться ${frCond(SB)}?`,
    qc: `Какое наибольшее целое значение может принимать полученная сумма, если известно, что каждое из исходных чисел не меньше ${L} и не больше ${R}?`,
    ansA: `да, например для чисел ${nA}, ${nA + 1}, ${nA + 2}, ${nA + 3}: каждое из них содержит цифру 1, поэтому все четыре можно поделить на 1, и сумма равна ${nA} + ${nA + 1} + ${nA + 2} + ${nA + 3} = ${v1}`,
    ansB: `нет: каждое слагаемое — дробь со знаменателем от 1 до 9, поэтому знаменатель несократимой дроби суммы делит НОК(1, 2, …, 9) = 2520; число ${badQ} его не делит`,
    ansC: `${rng.best}; достигается на числах ${rng.at}, ${rng.at + 1}, ${rng.at + 2}, ${rng.at + 3}; больше нельзя — каждое слагаемое не превосходит самого числа (делитель не меньше 1), а сумма четырёх чисел отрезка [${L}; ${R}] максимальна у наибольшей четвёрки, каждое число которой можно делить на 1`,
    solution: `Каждое слагаемое равно (n + i) : d, где d — ненулевая цифра числа n + i, поэтому слагаемое не превосходит самого числа, а равенство достигается ровно тогда, когда среди цифр есть 1.\nОтсюда сумма не превосходит 4n + 6, и максимум набирается на самой правой четвёрке отрезка, у каждого числа которой есть цифра 1; если такой четвёрки нет, приходится делить хотя бы одно число на цифру ≥ 2, что заметно уменьшает сумму. Перебор по отрезку [${L}; ${R}] даёт максимум ${rng.best} при числах ${rng.at}—${rng.at + 3}.\nЗнаменатель суммы всегда делит НОК(1, …, 9) = 2520 — это отсекает «неправильные» дробные значения.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: nA, target: v1 },
        b: { type: "yesno", yes: false, reason: "denominator", target: frVal(SB) },
        c: { type: "value", value: rng.best, example: rng.at },
      },
      mustMention: [L, R, v1],
      extra: [...frNums(SB)],
      phrases: ["четыре последовательных натуральных числа", "поделили на одну из его цифр, не равную нулю"],
    },
  })
}
