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
const stones = (n) => `${n} ${plural(n, "камень", "камня", "камней")}`
// Компактная запись длинной суммы одинаковых слагаемых: «11 + … + 11 (9 слагаемых)».
function compactSum(parts, sep = " + ") {
  const groups = []
  for (const v of parts) {
    const g = groups[groups.length - 1]
    if (g && g.v === v) g.c++
    else groups.push({ v, c: 1 })
  }
  return groups.map(({ v, c }) => (c <= 3 ? Array(c).fill(v).join(" + ") : `${v} + … + ${v} (${c} ${plural(c, "слагаемое", "слагаемых", "слагаемых")})`)).join(sep)
}
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
  ["Операции над записью числа", [
    ["swap-digits-max", "Перестановка цифр двузначных → наибольшая новая сумма", t19SwapDigitsMax],
    ["swap-digits-min", "Перестановка цифр двузначных → наименьшая новая сумма", t19SwapDigitsMin],
  ]],
  ["Две школы, средний балл", [
    ["schools-drop-min", "Средние упали на 10 % → наим. исходный средний в №2", t19SchoolsDropMin],
    ["schools-rise-min", "Средние выросли на 10 % → наим. исходный средний в №2", t19SchoolsRiseMin],
  ]],
  ["Игры и операции с инвариантом", [
    ["boxes-three", "Три коробки: ход −1, −1, +1 → наибольшее в третьей", t19BoxesThree],
    ["ones-and-plus", "n единиц и знаки «+» → для скольких n сумма достижима", t19OnesAndPlus],
  ]],
  ["Прогрессии", [
    ["ap-ends-sum", "АП из натуральных: сумма крайних и наибольшее число членов", t19APEndsSum],
    ["ap-count-by-sum", "n различных натуральных в АП: наибольшее n и все n", t19APCountBySum],
    ["gp-three-digit", "ГП из трёхзначных с первым членом F → наибольший член", t19GPThreeDigit],
    ["prod-gp-subset", "Пять чисел с произведением P: пять/четыре/три в ГП", t19ProdGPSubset],
  ]],
  ["Алгебраическая теория чисел", [
    ["quadratic-nat-roots", "x² + px + q = 0 с двумя натуральными корнями", t19QuadraticNatRoots],
    ["discriminant-nat", "Дискриминант при натуральных m, n → наименьший", t19DiscriminantNat],
    ["unit-fractions", "Единичные дроби; все пары 1/m + 1/n = 1/N", t19UnitFractions],
    ["sqrt2-approximation", "Приближение √2 двузначными дробями", t19Sqrt2Approximation],
  ]],
  ["Доска: ограничение на попарные произведения", [
    ["prodwin-min-sum", "Произведение любых двух в (lo; hi) → наим. сумма четырёх", t19ProdWindowMinSum],
    ["prodwin-max-sum", "Произведение любых двух в (lo; hi) → наиб. сумма четырёх", t19ProdWindowMaxSum],
  ]],
  ["Цифры: произведение цифр и цепочки сумм цифр", [
    ["four-prod-vs-digitsum", "Четырёхзначное: произведение цифр в k раз больше суммы", t19FourProdVsDigitSum],
    ["digitsum-chain-3", "Тройка n, S(n), S(S(n)): сумма и количество троек", t19DigitSumChain3],
    ["three-over-digitprod", "Частное трёхзначного без нулей и произведения цифр", t19ThreeOverDigitProd],
  ]],
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

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 5. Цифры: произведение цифр и цепочки сумм цифр (#35, #77, #84)
// ═══════════════════════════════════════════════════════════════════════════

const digProd = (n) => digitsOf(n).reduce((p, d) => p * d, 1)
// Все перестановки мультимножества цифр, дающие число без ведущего нуля.
function permsOf(ds) {
  const out = new Set()
  const rec = (left, acc) => {
    if (!left.length) { if (acc[0] !== 0) out.add(Number(acc.join(""))); return }
    const seen = new Set()
    for (let i = 0; i < left.length; i++) {
      if (seen.has(left[i])) continue
      seen.add(left[i])
      rec([...left.slice(0, i), ...left.slice(i + 1)], [...acc, left[i]])
    }
  }
  rec(ds, [])
  return [...out].sort((a, b) => a - b)
}
// #35: таблица «во сколько раз произведение цифр больше суммы» → список чисел.
// Строится перебором НЕВОЗРАСТАЮЩИХ четвёрок цифр (комбинаторно), тогда как solve()
// идёт по самим числам 1000…9999 — это два разных прохода.
const PROD_VS_SUM4 = (() => {
  const map = new Map()
  for (let a = 9; a >= 1; a--) for (let b = a; b >= 0; b--) for (let c = b; c >= 0; c--) for (let d = c; d >= 0; d--) {
    const P = a * b * c * d, S = a + b + c + d
    if (!S || P === 0 || P % S !== 0) continue
    const k = P / S
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(...permsOf([a, b, c, d]))
  }
  for (const [k, v] of map) map.set(k, [...new Set(v)].sort((x, y) => x - y))
  return map
})()

// #35. Четырёхзначное число: произведение цифр в k раз больше суммы цифр.
export function t19FourProdVsDigitSum() {
  const keys = [...PROD_VS_SUM4.keys()]
  const k1 = pick(keys.filter((k) => PROD_VS_SUM4.get(k).length >= 1))
  const exA = PROD_VS_SUM4.get(k1)[0]
  // б) — «нет»: k2 содержит простой делитель, больший 9, поэтому произведение цифр
  // (каждая цифра ≤ 9) не может на него делиться.
  const bigPrime = pick([11, 13, 17, 19, 23])
  const k2 = bigPrime * randInt(1, Math.floor(300 / bigPrime))
  // в) — «найдите все»: k с небольшим числом решений.
  const k3 = pick(keys.filter((k) => { const n = PROD_VS_SUM4.get(k).length; return n >= 1 && n <= 6 }))
  if (k1 === k2 || k2 === k3 || k1 === k3) return null
  const allC = PROD_VS_SUM4.get(k3)

  const params = { k1, k2, k3 }
  const check = (A, part) => {
    if (!Number.isInteger(A) || A < 1000 || A > 9999) return `${A} не четырёхзначное`
    const target = part === "a" ? k1 : part === "b" ? k2 : k3
    const P = digProd(A), S = digitSum(A)
    if (P !== target * S) return `у ${A} произведение цифр ${P}, а ${target}·${S} = ${target * S}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все четырёхзначные числа 1000…9999.
    const has = (k) => { for (let A = 1000; A <= 9999; A++) if (digProd(A) === k * digitSum(A)) return true; return false }
    const all = []
    for (let A = 1000; A <= 9999; A++) if (digProd(A) === P.k3 * digitSum(A)) all.push(A)
    return { a: has(P.k1), b: has(P.k2), c: all }
  }

  return item({
    preamble: `Для четырёхзначного натурального числа рассматривают произведение его цифр и сумму его цифр.`,
    qa: `Приведите пример четырёхзначного числа, произведение цифр которого в ${k1} раз больше суммы цифр этого числа.`,
    qb: `Существует ли такое четырёхзначное число, произведение цифр которого в ${k2} раз больше суммы цифр этого числа?`,
    qc: `Найдите все четырёхзначные числа, произведение цифр которых в ${k3} раз больше суммы цифр этого числа.`,
    ansA: `${exA}: произведение цифр ${digProd(exA)}, сумма цифр ${digitSum(exA)}, и ${digProd(exA)} = ${k1} · ${digitSum(exA)}`,
    ansB: `нет: произведение цифр равнялось бы ${k2}·S и делилось бы на ${bigPrime}, но произведение четырёх цифр — это произведение чисел, не превосходящих 9, и простого делителя ${bigPrime} у него быть не может`,
    ansC: `${joinRu(allC)}${allC.length === 1 ? "" : " — других нет"}`,
    solution: `Обозначим произведение цифр P, сумму цифр S. Условие P = k·S.\nСразу отметим: P — произведение четырёх цифр, поэтому все простые делители P не превосходят 7. Если k делится на простое число, большее 9 (как ${k2} на ${bigPrime}), то и P делилось бы на него — противоречие, значит такого числа нет.\nДля k = ${k3} перебор наборов цифр (достаточно перебирать невозрастающие четвёрки, а затем брать перестановки без ведущего нуля) даёт ровно ${allC.length === 1 ? "одно число" : `${allC.length} чисел`}: ${joinRu(allC)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: k1 },
        b: { type: "yesno", yes: false, reason: "big-prime", target: k2 },
        c: { type: "all", values: allC, examples: Object.fromEntries(allC.map((v) => [v, v])) },
      },
      mustMention: [k1, k2, k3],
      extra: [],
      phrases: ["четырёхзначного натурального числа", "произведение его цифр", "сумму его цифр"],
    },
  })
}

// #77. Три различных натуральных: второе — сумма цифр первого, третье — сумма цифр второго.
// Инвариант: n ≡ S(n) (mod 9), поэтому все три числа сравнимы по модулю 9,
// а их сумма сравнима с 3n — то есть ВСЕГДА кратна 3.
const CHAIN_COUNT = (() => {                    // сколько трёхзначных n даёт третье число v
  const cnt = new Array(10).fill(0)
  for (let a = 1; a <= 9; a++) for (let b = 0; b <= 9; b++) for (let c = 0; c <= 9; c++) {
    const s = a + b + c
    if (s < 10) continue                        // иначе второе и третье числа совпадут
    cnt[digitSum(s)]++
  }
  return cnt
})()
export function t19DigitSumChain3() {
  const chain = (n) => { const s2 = digitSum(n), s3 = digitSum(s2); return { s2, s3, total: n + s2 + s3 } }
  // а) — «да»: берём конкретное первое число (обязательно с S(n) ≥ 10, иначе числа совпадут).
  let nA = 0
  for (let t = 0; t < 200 && !nA; t++) { const c = randInt(100, 3000); if (digitSum(c) >= 10) nA = c }
  if (!nA) return null
  const T1 = chain(nA).total
  // б) — «нет»: сумма всегда кратна 3, поэтому берём число, не кратное 3.
  const T2 = 3 * randInt(30, 900) + pick([1, 2])
  const v = pick([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => CHAIN_COUNT[x] > 0))
  const count = CHAIN_COUNT[v]

  const params = { T1, T2, v, count }
  const check = (n, part) => {
    if (!Number.isInteger(n) || n < 1) return `${n} не натуральное`
    const { s2, s3, total } = chain(n)
    if (n === s2 || n === s3 || s2 === s3) return `числа ${n}, ${s2}, ${s3} не все различны`
    if (part === "a" && total !== T1) return `сумма ${total}, а не ${T1}`
    if (part === "b" && total !== T2) return `сумма ${total}, а не ${T2}`
    if (part === "c") {
      if (n < 100 || n > 999) return `${n} не трёхзначное`
      if (s3 !== v) return `третье число ${s3}, а не ${v}`
    }
    return null
  }
  const solve = (P) => {
    // Пространство перебора: сумма трёх чисел не меньше первого, поэтому для суммы T
    // достаточно перебрать все n ≤ T; для пункта в) — все трёхзначные n.
    const ok = (n) => { const s2 = digitSum(n), s3 = digitSum(s2); return n !== s2 && s2 !== s3 && n !== s3 }
    const reach = (T) => { for (let n = 1; n <= T; n++) if (ok(n) && n + digitSum(n) + digitSum(digitSum(n)) === T) return true; return false }
    let c = 0
    for (let n = 100; n <= 999; n++) if (ok(n) && digitSum(digitSum(n)) === P.v) c++
    return { a: reach(P.T1), b: reach(P.T2), c }
  }

  const cA = chain(nA)
  return item({
    preamble: `На доске написаны три различных натуральных числа. Второе число равно сумме цифр первого, а третье равно сумме цифр второго.`,
    qa: `Может ли сумма этих чисел быть равна ${T1}?`,
    qb: `Может ли сумма этих чисел быть равна ${T2}?`,
    qc: `В тройке чисел первое число трёхзначное, а третье равно ${v}. Сколько существует таких троек?`,
    ansA: `да, например ${nA}, ${cA.s2} и ${cA.s3}: их сумма равна ${T1}`,
    ansB: `нет: натуральное число и сумма его цифр дают одинаковые остатки при делении на 9, поэтому все три числа сравнимы по модулю 9, а их сумма сравнима с утроенным первым числом — она всегда кратна 3, тогда как ${T2} на 3 не делится`,
    ansC: `${count}`,
    solution: `Для любого натурального n верно n ≡ S(n) (mod 9). Значит все три числа тройки дают один и тот же остаток при делении на 9, а их сумма сравнима с 3n по модулю 9 — в частности, она всегда кратна 3. Это сразу отвечает на пункт б).\nВ пункте в) первое число трёхзначное, поэтому второе — сумма его цифр — лежит между 1 и 27. Чтобы второе и третье числа были различны, вторая сумма обязана быть не меньше 10. Значит нужно сосчитать трёхзначные числа, сумма цифр которых не меньше 10 и сама имеет сумму цифр ${v}; таких чисел ${count}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: nA, target: T1 },
        b: { type: "yesno", yes: false, reason: "mod3", target: T2 },
        c: { type: "count", value: count },
      },
      mustMention: [T1, T2, v],
      extra: [],
      phrases: ["три различных натуральных числа", "Второе число равно сумме цифр первого", "третье равно сумме цифр второго"],
    },
  })
}

// #84. Частное трёхзначного числа без нулей и произведения его цифр.
// Таблица «несократимая дробь A/P» строится по цифрам (a, b, c), solve() идёт по A.
const NOZERO_FRAC = (() => {
  const byDen = new Map()
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let c = 1; c <= 9; c++) {
    const A = 100 * a + 10 * b + c, P = a * b * c
    const f = fr(A, P)
    if (!byDen.has(f.d)) byDen.set(f.d, new Map())
    if (!byDen.get(f.d).has(f.n)) byDen.get(f.d).set(f.n, A)
  }
  return byDen
})()
export function t19ThreeOverDigitProd() {
  // Знаменатели держим «эталонными» (в ФИПИ это 27): небольшие и круглые.
  const NICE = [8, 9, 12, 16, 18, 24, 27, 32, 36]
  const dens = [...NOZERO_FRAC.keys()].filter((q) => NICE.includes(q) && NOZERO_FRAC.get(q).size >= 3)
  if (!dens.length) return null
  const q = pick(dens)
  const nums = [...NOZERO_FRAC.get(q).keys()].sort((a, b) => a - b)
  const m1 = pick(nums.filter((m) => m !== nums[nums.length - 1]))
  const exA = NOZERO_FRAC.get(q).get(m1)
  // б) — «нет»: числитель из того же диапазона, но недостижимый.
  const holes = []
  for (let m = nums[0]; m <= nums[nums.length - 1]; m++) if (!nums.includes(m) && gcdI(m, q) === 1) holes.push(m)
  if (!holes.length) return null
  const m2 = pick(holes)
  const m3 = nums[nums.length - 1]
  const exC = NOZERO_FRAC.get(q).get(m3)
  // все произведения трёх ненулевых цифр, кратные q — именно они дают знаменатель q
  const prods = new Set()
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let c = 1; c <= 9; c++) if ((a * b * c) % q === 0) prods.add(a * b * c)
  const plist = [...prods].sort((x, y) => x - y)

  const params = { q, m1, m2, m3 }
  const check = (A, part) => {
    if (!Number.isInteger(A) || A < 100 || A > 999) return `${A} не трёхзначное`
    if (String(A).includes("0")) return `в записи ${A} есть нуль`
    const f = fr(A, digProd(A))
    const m = part === "a" ? m1 : part === "b" ? m2 : m3
    if (f.n !== m || f.d !== q) return `частное ${A}/${digProd(A)} = ${f.n}/${f.d}, а не ${m}/${q}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все трёхзначные числа без нулей (их 729).
    let best = null, hitA = false, hitB = false
    for (let A = 100; A <= 999; A++) {
      if (String(A).includes("0")) continue
      const f = fr(A, digProd(A))
      if (f.d !== P.q) continue
      if (f.n === P.m1) hitA = true
      if (f.n === P.m2) hitB = true
      if (best === null || f.n > best) best = f.n
    }
    return { a: hitA, b: hitB, c: best }
  }

  return item({
    preamble: `Рассмотрим частное трёхзначного числа, в записи которого нет нулей, и произведения его цифр.`,
    qa: `Приведите пример числа, для которого это частное равно ⟦f:${m1}:${q}⟧.`,
    qb: `Может ли это частное равняться ⟦f:${m2}:${q}⟧?`,
    qc: `Какое наибольшее значение может принимать это частное, если оно равно несократимой дроби со знаменателем ${q}?`,
    ansA: `${exA}: произведение цифр равно ${digProd(exA)}, и ${exA}/${digProd(exA)} = ${m1}/${q}`,
    ansB: `нет: знаменатель ${q} у несократимой дроби означает, что произведение цифр кратно ${q}; таких произведений трёх ненулевых цифр всего ${plist.length}: ${plist.slice(0, 6).join(", ")}${plist.length > 6 ? ", …" : ""}, и для каждого из них число ${m2}·P/${q} либо не трёхзначно, либо имеет другое произведение цифр`,
    ansC: `${m3}/${q}; достигается при числе ${exC}, у которого произведение цифр равно ${digProd(exC)}`,
    solution: `Пусть A — трёхзначное число без нулей, P — произведение его цифр. Несократимая дробь A/P имеет знаменатель ${q} ровно тогда, когда P кратно ${q}, а после сокращения в знаменателе остаётся именно ${q}.\nПроизведений трёх ненулевых цифр, кратных ${q}, всего ${plist.length}: ${plist.slice(0, 6).join(", ")}${plist.length > 6 ? ", …" : ""}. Для каждого такого P числитель равен A·${q}/P, поэтому достаточно перебрать эти P и подходящие A.\nНаибольший числитель равен ${m3} и достигается при A = ${exC}; для ${m2} подходящего числа нет.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: m1 },
        b: { type: "yesno", yes: false, reason: "prod-multiple", target: m2 },
        c: { type: "value", value: m3, example: exC },
      },
      mustMention: [m1, m2, q],
      extra: [],
      phrases: ["трёхзначного числа, в записи которого нет нулей", "произведения его цифр"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 2. Доска: ограничение на попарные произведения (#27, #28)
// ═══════════════════════════════════════════════════════════════════════════

// Различные натуральные, произведение любых двух больше lo и меньше hi.
// Структурные факты (ими и строится задача, БЕЗ перебора):
//   • наименьшее число набора не меньше m₀ = min{a : a(a+1) > lo};
//   • набор из k чисел существует ⟺ (m₀+k−2)(m₀+k−1) < hi
//     (минимальный кандидат {m₀, …, m₀+k−1} — самый «лёгкий» из всех);
//   • наименьшая сумма четырёх равна 4m₀ + 6;
//   • наибольшая сумма четырёх = max по парам (a₃ < a₄) с a₃a₄ < hi и (a₃−2)(a₃−1) > lo
//     от величины a₄ + 3a₃ − 3 (два младших числа выгодно брать максимальными: a₃−1, a₃−2).
// solve() ничего этого не знает и перебирает сами наборы.
function prodWindowFamily(mode) {
  // Структурные факты (ими и строится задача, БЕЗ перебора наборов):
  //   • a₁ ≤ a₂ − 1, поэтому из a₁a₂ > lo следует a₂(a₂ − 1) > lo, то есть a₂ ≥ A,
  //     где A = min{a : a(a − 1) > lo};
  //   • набор из k чисел выгоднее всего брать «плотным»: {a₁, a₂, a₂+1, …, a₂+k−2},
  //     поэтому k чисел существует ⟺ (A + k − 3)(A + k − 2) < hi;
  //   • для наименьшей суммы четырёх перебираем ОДИН параметр a₂ и берём наименьшее
  //     подходящее a₁ = ⌊lo/a₂⌋ + 1, а три старших — подряд;
  //   • для наибольшей суммы, наоборот, два младших выгодно взять как a₃−2 и a₃−1.
  const A = randInt(6, 12)
  const lo = randInt(A * (A - 1) - A + 1, A * (A - 1) - 1)   // ⟹ min{a : a(a−1) > lo} = A
  const hi = randInt((A + 2) * (A + 3) + 1, (A + 3) * (A + 4))
  let chk = 1; while (chk * (chk - 1) <= lo) chk++
  if (chk !== A) return null
  const can = (k) => (A + k - 3) * (A + k - 2) < hi
  if (!can(4) || !can(5) || can(6)) return null           // эталон: 5 — да, 6 — нет

  const minFirst = (a2) => Math.floor(lo / a2) + 1        // наименьшее a₁ с a₁·a₂ > lo
  const packed = (a2, k) => { const f = minFirst(a2); return f >= 1 && f < a2 && (a2 + k - 3) * (a2 + k - 2) < hi ? [f, ...Array.from({ length: k - 1 }, (_, i) => a2 + i)] : null }
  const ex5 = packed(A, 5)
  if (!ex5) return null

  let answer, exC
  if (mode === "min") {
    let best = null
    for (let a2 = A; (a2 + 1) * (a2 + 2) < hi; a2++) {
      const set = packed(a2, 4)
      if (set && (best === null || sum(set) < best.s)) best = { s: sum(set), set }
    }
    if (!best) return null
    answer = best.s; exC = best.set
  } else {
    let best = null
    for (let a3 = A + 1; a3 * (a3 + 1) < hi; a3++) {
      if ((a3 - 2) * (a3 - 1) <= lo || a3 - 2 < 1) continue
      for (let a4 = a3 + 1; a3 * a4 < hi; a4++) {
        const s4 = a4 + 3 * a3 - 3
        if (best === null || s4 > best.s) best = { s: s4, set: [a3 - 2, a3 - 1, a3, a4] }
      }
    }
    if (!best) return null
    answer = best.s; exC = best.set
  }

  const params = { lo, hi, mode, answer }
  const check = (arr, part) => {
    if (!Array.isArray(arr)) return "не набор"
    if (uniq(arr).length !== arr.length) return "числа не различны"
    for (const x of arr) if (!Number.isInteger(x) || x < 1) return `${x} не натуральное`
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const p = arr[i] * arr[j]
      if (p <= lo) return `${arr[i]}·${arr[j]} = ${p} не больше ${lo}`
      if (p >= hi) return `${arr[i]}·${arr[j]} = ${p} не меньше ${hi}`
    }
    if (part === "a" && arr.length !== 5) return `${arr.length} чисел вместо 5`
    if (part === "b" && arr.length !== 6) return `${arr.length} чисел вместо 6`
    if (part === "c") {
      if (arr.length !== 4) return `${arr.length} чисел вместо четырёх`
      if (sum(arr) !== answer) return `сумма ${sum(arr)}, а не ${answer}`
    }
    return null
  }
  const solve = (P) => {
    // Пространство перебора: ВСЕ возрастающие наборы различных натуральных чисел,
    // не превосходящих P.hi (большее число в паре с любым другим даёт произведение
    // не меньше P.hi). Отсечения ускоряют обход, но пространство не сужают.
    const res = { 4: [], 5: false, 6: false }
    const cur = []
    const rec = (start, k) => {
      if (cur.length === k) { if (k === 4) res[4].push(sum(cur)); else res[k] = true; return }
      for (let x = start; x <= P.hi; x++) {
        let ok = true
        for (const y of cur) { const p = y * x; if (p <= P.lo || p >= P.hi) { ok = false; break } }
        if (!ok) { if (cur.length && cur[cur.length - 1] * x >= P.hi) break; continue }
        cur.push(x); rec(x + 1, k); cur.pop()
        if (res[k] === true) return
      }
    }
    rec(1, 5); const a = res[5]
    cur.length = 0; rec(1, 6); const b = res[6]
    cur.length = 0; rec(1, 4)
    const sums = res[4]
    const c = sums.length ? (P.mode === "min" ? Math.min(...sums) : Math.max(...sums)) : null
    const cNext = c === null ? false : sums.some((x) => (P.mode === "min" ? x < c : x > c))
    return { a, b, c, c_next: cNext }
  }

  return item({
    preamble: `На доске написано несколько различных натуральных чисел, произведение любых двух из которых больше ${lo} и меньше ${hi}.`,
    qa: `Может ли на доске быть 5 чисел?`,
    qb: `Может ли на доске быть 6 чисел?`,
    qc: `Какое ${mode === "min" ? "наименьшее" : "наибольшее"} значение может принимать сумма чисел на доске, если их четыре?`,
    ansA: `да, например ${joinRu(ex5)}`,
    ansB: `нет: из a₁ < a₂ и a₁a₂ > ${lo} следует a₂(a₂ − 1) > ${lo}, то есть второе по величине число не меньше ${A}; тогда при шести числах два наибольших не меньше ${A + 3} и ${A + 4}, а их произведение не меньше ${(A + 3) * (A + 4)} > ${hi}`,
    ansC: `${answer}; достигается на наборе ${joinRu(exC)}; ${mode === "min"
      ? `меньше нельзя — второе по величине число не меньше ${A}, поэтому три старших числа не меньше ${A}, ${A + 1}, ${A + 2}, а младшее не меньше ⌊${lo}/a₂⌋ + 1`
      : `больше нельзя — произведение двух наибольших меньше ${hi}, а два младших не превосходят ${exC[2] - 1} и ${exC[2] - 2}`}`,
    solution: `Пусть числа набора a₁ < a₂ < … < a_k. Условие «произведение любых двух больше ${lo}» равносильно a₁a₂ > ${lo}, а «меньше ${hi}» — условию a_{k−1}a_k < ${hi}: остальные пары зажаты между этими двумя.\nИз a₁ ≤ a₂ − 1 следует a₂(a₂ − 1) > ${lo}, то есть a₂ ≥ ${A}. Плотный набор {a₁, a₂, a₂+1, …, a₂+k−2} — самый выгодный, поэтому k чисел существует ровно тогда, когда (a₂ + k − 3)(a₂ + k − 2) < ${hi}.\nДля k = 5 это ${(A + 2) * (A + 3)} < ${hi} — верно; для k = 6 это ${(A + 3) * (A + 4)} < ${hi} — неверно.\n${mode === "min"
      ? `Наименьшую сумму четырёх ищем перебором одного параметра a₂: младшее число тогда равно ⌊${lo}/a₂⌋ + 1, а два старших идут подряд. Минимум ${answer} даёт набор ${joinRu(exC)}.`
      : `Для наибольшей суммы два младших числа выгодно взять максимальными: a₁ = a₃ − 2, a₂ = a₃ − 1, а затем максимизировать a₄ при a₃a₄ < ${hi}. Максимум ${answer} даёт набор ${joinRu(exC)}.`}`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: ex5, target: 5 },
        b: { type: "yesno", yes: false, reason: "two-largest", target: 6 },
        c: { type: "extremum", mode, value: answer, example: exC },
      },
      mustMention: [lo, hi, 5, 6],
      extra: [],
      phrases: ["различных натуральных чисел", "произведение любых двух из которых больше", "если их четыре"],
    },
  })
}
export function t19ProdWindowMinSum() { return prodWindowFamily("min") }
export function t19ProdWindowMaxSum() { return prodWindowFamily("max") }

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 21. Алгебраическая теория чисел (#53, #56, #104, #118)
// ═══════════════════════════════════════════════════════════════════════════

const divisors = (n) => { const d = []; for (let i = 1; i * i <= n; i++) if (n % i === 0) { d.push(i); if (i !== n / i) d.push(n / i) } return d.sort((a, b) => a - b) }

// #53. x² + px + q = 0 с двумя различными натуральными корнями u < v:
//      по теореме Виета p = −(u + v), q = uv. Все три пункта решаются разложениями:
//      q = Q — делители Q; p + q = T — из uv − u − v = T следует (u−1)(v−1) = T + 1;
//      q² − p² = D — таблица пар (u, v), построенная при импорте.
const VIETA_D = (() => {
  const map = new Map()
  // Граница 400 совпадает с границей перебора в solve() и полна: при u ≥ 2 и v > 400
  // уже (uv)² − (u+v)² > 90000, а при u = 1 разность отрицательна.
  for (let u = 1; u <= 400; u++) for (let v = u + 1; v <= 400; v++) {
    const D = (u * v) ** 2 - (u + v) ** 2
    if (D <= 0 || D >= 90000) continue
    if (!map.has(D)) map.set(D, [])
    map.get(D).push([u, v])
  }
  return map
})()
export function t19QuadraticNatRoots() {
  // а) q = Q: пары делителей Q
  const Q = pick([12, 18, 20, 24, 30, 34, 36, 40, 42, 48, 54, 60, 72])
  const pairsA = divisors(Q).filter((d) => d * d < Q).map((d) => [d, Q / d])
  if (!pairsA.length) return null
  const valuesA = [...new Set(pairsA.map(([u, v]) => -(u + v)))].sort((x, y) => x - y)
  const exA = Object.fromEntries(valuesA.map((p) => [p, pairsA.find(([u, v]) => -(u + v) === p)]))
  // б) p + q = T: (u−1)(v−1) = T + 1
  const T = pick([14, 19, 22, 26, 29, 34, 39, 44, 49, 54])
  const pairsB = divisors(T + 1).filter((d) => d * d < T + 1).map((d) => [d + 1, (T + 1) / d + 1])
  if (!pairsB.length) return null
  const valuesB = [...new Set(pairsB.map(([u, v]) => u * v))].sort((x, y) => x - y)
  const exB = Object.fromEntries(valuesB.map((q) => [q, pairsB.find(([u, v]) => u * v === q)]))
  // в) q² − p² = D
  const dKeys = [...VIETA_D.keys()].filter((D) => VIETA_D.get(D).length <= 2 && D < 90000)
  const D = pick(dKeys)
  const pairsC = VIETA_D.get(D)
  const valuesC = [...new Set(pairsC.flat())].sort((x, y) => x - y)
  const exC = Object.fromEntries(valuesC.map((r) => [r, pairsC.find((pr) => pr.includes(r))]))

  const params = { Q, T, D }
  const check = (pair, part) => {
    if (!Array.isArray(pair) || pair.length !== 2) return "не пара корней"
    const [u, v] = pair
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 1 || v < 1) return `${u}, ${v} — не натуральные`
    if (u === v) return "корни не различны"
    const p = -(u + v), q = u * v
    if (part === "a" && q !== Q) return `q = ${q}, а не ${Q}`
    if (part === "b" && p + q !== T) return `p + q = ${p + q}, а не ${T}`
    if (part === "c" && q * q - p * p !== D) return `q² − p² = ${q * q - p * p}, а не ${D}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все пары различных натуральных корней u < v ≤ 100000
    // для а)/б) (там корни делят Q или T+1) и u < v ≤ 400 для в) (уже (uv)² > D).
    const a = [], b = [], c = new Set()
    for (let u = 1; u <= P.Q; u++) for (let v = u + 1; v <= P.Q; v++) if (u * v === P.Q) a.push(-(u + v))
    for (let u = 1; u <= P.T + 2; u++) for (let v = u + 1; v <= P.T + 2; v++) if (u * v - u - v === P.T) b.push(u * v)
    for (let u = 1; u <= 400; u++) for (let v = u + 1; v <= 400; v++) {
      if ((u * v) ** 2 - (u + v) ** 2 === P.D) { c.add(u); c.add(v) }
    }
    return { a: [...new Set(a)].sort((x, y) => x - y), b: [...new Set(b)].sort((x, y) => x - y), c: [...c].sort((x, y) => x - y) }
  }

  const MIN = "−"
  return item({
    preamble: `Квадратное уравнение x² + px + q = 0 имеет два различных натуральных корня.`,
    qa: `Пусть q = ${Q}. Найдите все возможные значения p.`,
    qb: `Пусть p + q = ${T}. Найдите все возможные значения q.`,
    qc: `Пусть q² − p² = ${D}. Найдите все возможные корни исходного уравнения.`,
    ansA: `${joinRu(valuesA.map((p) => String(p).replace("-", MIN)))} — им отвечают корни ${pairsA.map(([u, v]) => `${u} и ${v}`).join("; ")} соответственно`,
    ansB: `${joinRu(valuesB)} — им отвечают корни ${pairsB.map(([u, v]) => `${u} и ${v}`).join("; ")} соответственно`,
    ansC: `${joinRu(valuesC)}; подходит ${pairsC.map(([u, v]) => `уравнение с корнями ${u} и ${v}`).join("; ")}`,
    solution: `По теореме Виета корни u < v связаны с коэффициентами так: p = ${MIN}(u + v), q = uv.\nа) Из q = ${Q} следует uv = ${Q}, то есть u и v — пара взаимно дополняющих делителей числа ${Q}: ${joinRu(pairsA.map(([u, v]) => `${u}·${v}`))}. Значит p принимает значения ${joinRu(valuesA.map((p) => String(p).replace("-", MIN)))}.\nб) Из p + q = ${T} следует uv ${MIN} u ${MIN} v = ${T}, то есть (u ${MIN} 1)(v ${MIN} 1) = ${T + 1}. Разложения числа ${T + 1} дают корни ${joinRu(pairsB.map(([u, v]) => `${u} и ${v}`))}, откуда q равно ${joinRu(valuesB)}.\nв) Из q² ${MIN} p² = ${D} следует (uv)² ${MIN} (u + v)² = ${D}; так как (uv)² > ${D}, произведение uv ограничено, и перебор даёт корни ${joinRu(valuesC)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "all", values: valuesA, examples: exA },
        b: { type: "all", values: valuesB, examples: exB },
        c: { type: "all", values: valuesC, examples: exC },
      },
      mustMention: [Q, T, D],
      extra: [2, 0],
      phrases: ["x² + px + q = 0", "два различных натуральных корня"],
    },
  })
}

// #56. Дискриминант квадратного трёхчлена при натуральных коэффициентах.
// Инвариант: D = m² − 4n ≡ m² (mod 4), а квадрат сравним с 0 или 1 по модулю 4,
// поэтому дискриминант никогда не даёт остатков 2 и 3 при делении на 4.
const DISC_MIN = (() => {                       // минимум D = (km+n)² − 4(kn+m) при натуральных m, n
  const map = new Map()
  for (let k = 2; k <= 5; k++) {
    let best = null
    for (let m = 1; m <= 300; m++) for (let n = 1; n <= 300; n++) {
      const D = (k * m + n) ** 2 - 4 * (k * n + m)
      if (D >= 1 && (best === null || D < best.D)) best = { D, m, n }
    }
    map.set(k, best)
  }
  return map
})()
export function t19DiscriminantNat() {
  const k = randInt(2, 5)
  const best = DISC_MIN.get(k)
  if (!best) return null
  // а) — «да»: любое D ≡ 0 или 1 (mod 4) достижимо; берём наименьшее подходящее m.
  const D1 = 4 * randInt(2, 30) + pick([0, 1])   // остаток 0 или 1 по модулю 4 — достижим
  let m1 = (D1 % 4 === 0) ? 2 : 1
  while (m1 * m1 - D1 < 4) m1 += 2
  const n1 = (m1 * m1 - D1) / 4
  // б) — «нет»: остаток 2 или 3 по модулю 4.
  const D2 = 4 * randInt(2, 40) + pick([2, 3])
  if (D1 === D2) return null

  const params = { D1, D2, k, best: best.D }
  const check = (mn, part) => {
    if (!Array.isArray(mn) || mn.length !== 2) return "не пара (m, n)"
    const [m, n] = mn
    if (!Number.isInteger(m) || !Number.isInteger(n) || m < 1 || n < 1) return `${m}, ${n} — не натуральные`
    if (part === "c") {
      const D = (k * m + n) ** 2 - 4 * (k * n + m)
      if (D !== best.D) return `дискриминант ${D}, а не ${best.D}`
      if (D < 1) return `дискриминант ${D} не натуральный`
    } else {
      const D = m * m - 4 * n
      const target = part === "a" ? D1 : D2
      if (D !== target) return `дискриминант ${D}, а не ${target}`
    }
    return null
  }
  const solve = (P) => {
    // Пространство перебора: m, n от 1 до 400 (при больших m дискриминант m² − 4n
    // растёт быстрее любой из целей, а для пункта в) минимум достигается при малых m).
    const has = (D) => { for (let m = 1; m <= 400; m++) { const t = m * m - D; if (t > 0 && t % 4 === 0) return true } return false }
    let bestD = null
    for (let m = 1; m <= 400; m++) for (let n = 1; n <= 400; n++) {
      const D = (P.k * m + n) ** 2 - 4 * (P.k * n + m)
      if (D >= 1 && (bestD === null || D < bestD)) bestD = D
    }
    return { a: has(P.D1), b: has(P.D2), c: bestD, c_next: false }
  }

  return item({
    preamble: `Рассматриваются квадратные трёхчлены с натуральными коэффициентами.`,
    qa: `Существуют ли натуральные числа m и n, такие, что дискриминант квадратного трёхчлена x² + mx + n равен ${D1}?`,
    qb: `Существуют ли натуральные числа m и n, такие, что дискриминант квадратного трёхчлена x² + mx + n равен ${D2}?`,
    qc: `Какое наименьшее значение принимает дискриминант D квадратного трёхчлена x² + (${k}m + n)x + (${k}n + m), если известно, что числа m, n и D — натуральные?`,
    ansA: `да: например m = ${m1}, n = ${n1}, тогда ${m1}² − 4·${n1} = ${D1}`,
    ansB: `нет: дискриминант равен m² − 4n, поэтому он сравним с m² по модулю 4; квадрат целого числа даёт при делении на 4 остаток 0 или 1, а ${D2} даёт остаток ${D2 % 4}`,
    ansC: `${best.D}; достигается при m = ${best.m}, n = ${best.n}; меньше нельзя — при m = 1 дискриминант равен (n − ${k})² − 4, и чтобы он был натуральным, нужно (n − ${k})² ≥ 5, то есть |n − ${k}| ≥ 3 и D ≥ 5; при m ≥ 2 дискриминант ещё больше`,
    solution: `Дискриминант трёхчлена x² + mx + n равен m² − 4n, поэтому он сравним с m² по модулю 4. Квадраты дают остатки 0 и 1, значит остатки 2 и 3 недостижимы — это ответ на пункт б). Наоборот, для любого D с остатком 0 или 1 подойдёт достаточно большое m нужной чётности и n = (m² − D)/4.\nВ пункте в) D = (${k}m + n)² − 4(${k}n + m). При m = 1 это (${k} + n)² − 4(${k}n + 1) = (n − ${k})² − 4, и натуральность требует (n − ${k})² ≥ 5, откуда D ≥ 5. При m ≥ 2 первое слагаемое растёт быстрее вычитаемого, и дискриминант только увеличивается.\nМинимум D = ${best.D} достигается при m = ${best.m}, n = ${best.n}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: [m1, n1], target: D1 },
        b: { type: "yesno", yes: false, reason: "mod4", target: D2 },
        c: { type: "extremum", mode: "min", value: best.D, example: [best.m, best.n] },
      },
      mustMention: [D1, D2, k],
      extra: [2, 4],
      phrases: ["дискриминант квадратного трёхчлена", "натуральные"],
    },
  })
}

// #104. Единичные дроби. а)/б) — представить дробь суммой дробей 1/d с попарно
// различными натуральными знаменателями; в) — все пары m ≤ n с 1/m + 1/n = 1/N,
// что равносильно (m − N)(n − N) = N² и решается делителями числа N².
export function t19UnitFractions() {
  // а)/б) строим ОТ ОТВЕТА: берём попарно различные знаменатели и складываем.
  const makeTarget = (cnt) => {
    const ds = []
    while (ds.length < cnt) { const d = randInt(2, 30); if (!ds.includes(d)) ds.push(d) }
    ds.sort((a, b) => a - b)
    let f = fr(0)
    for (const d of ds) f = frAdd(f, fr(1, d))
    return { ds, f }
  }
  const A = makeTarget(randInt(2, 3))
  const B = makeTarget(randInt(3, 4))
  if (A.f.d === 1 || B.f.d === 1 || frVal(A.f) === frVal(B.f)) return null
  if (A.f.n > 999 || A.f.d > 9999 || B.f.n > 999 || B.f.d > 9999) return null
  // в) 1/m + 1/n = 1/N
  const N = randInt(6, 30)
  const pairsC = divisors(N * N).filter((d) => d * d <= N * N).map((d) => [N + d, N + N * N / d])
  const valuesC = pairsC.map(([m]) => m).sort((x, y) => x - y)
  const exC = Object.fromEntries(pairsC.map(([m, n]) => [m, [m, n]]))

  const params = { A: { n: A.f.n, d: A.f.d }, B: { n: B.f.n, d: B.f.d }, N }
  const check = (val, part) => {
    if (part === "c") {
      if (!Array.isArray(val) || val.length !== 2) return "не пара (m, n)"
      const [m, n] = val
      if (!Number.isInteger(m) || !Number.isInteger(n) || m < 1 || n < 1) return `${m}, ${n} — не натуральные`
      if (m > n) return `${m} > ${n}, нарушено условие m ≤ n`
      const s = frAdd(fr(1, m), fr(1, n))
      if (s.n !== 1 || s.d !== N) return `1/${m} + 1/${n} = ${s.n}/${s.d}, а не 1/${N}`
      return null
    }
    if (!Array.isArray(val) || val.length < 2) return "нужно несколько дробей"
    if (uniq(val).length !== val.length) return "знаменатели не попарно различны"
    let s = fr(0)
    for (const d of val) { if (!Number.isInteger(d) || d < 1) return `${d} не натуральное`; s = frAdd(s, fr(1, d)) }
    const t = part === "a" ? A.f : B.f
    if (s.n !== t.n || s.d !== t.d) return `сумма ${s.n}/${s.d}, а не ${t.n}/${t.d}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: разложения на не более чем 4 единичные дроби со
    // знаменателями до 4000 (жадный шаг гарантирует, что знаменатели растут).
    const search = (num, den, minD, depth) => {
      if (num === 0) return true
      if (depth === 0) return false
      const start = Math.max(minD, Math.ceil(den / num))
      for (let d = start; d <= 4000 && d <= den * depth / num; d++) {
        const nn = num * d - den, dd = den * d
        if (nn < 0) continue
        const g = gcdI(nn, dd) || 1
        if (search(nn / g, dd / g, d + 1, depth - 1)) return true
      }
      return false
    }
    const cPairs = []
    for (let m = P.N + 1; m <= 2 * P.N; m++) {
      const den = m - P.N
      if ((P.N * P.N) % den !== 0) continue
      cPairs.push(m)
    }
    return {
      a: search(P.A.n, P.A.d, 2, 4),
      b: search(P.B.n, P.B.d, 2, 5),
      c: cPairs.sort((x, y) => x - y),
    }
  }

  return item({
    preamble: `Рассматриваются суммы дробей, у которых все числители равны единице, а знаменатели — попарно различные натуральные числа.`,
    qa: `Представьте число ⟦f:${A.f.n}:${A.f.d}⟧ в виде суммы нескольких дробей, все числители которых — единица, а знаменатели — попарно различные натуральные числа.`,
    qb: `Представьте число ⟦f:${B.f.n}:${B.f.d}⟧ в виде суммы нескольких дробей, все числители которых — единица, а знаменатели — попарно различные натуральные числа.`,
    qc: `Найдите все возможные пары натуральных чисел m и n, для которых m ≤ n и 1/m + 1/n = 1/${N}.`,
    ansA: `${A.ds.map((d) => `1/${d}`).join(" + ")} = ${A.f.n}/${A.f.d}`,
    ansB: `${B.ds.map((d) => `1/${d}`).join(" + ")} = ${B.f.n}/${B.f.d}`,
    ansC: `${pairsC.map(([m, n]) => `(${m}; ${n})`).join(", ")}`,
    solution: `а) и б) Достаточно предъявить разложение: ${A.ds.map((d) => `1/${d}`).join(" + ")} = ${A.f.n}/${A.f.d} и ${B.ds.map((d) => `1/${d}`).join(" + ")} = ${B.f.n}/${B.f.d}. Знаменатели попарно различны, числители равны единице.\nв) Из 1/m + 1/n = 1/${N} следует ${N}(m + n) = mn, то есть mn − ${N}m − ${N}n = 0 и (m − ${N})(n − ${N}) = ${N * N}.\nЗначит m − ${N} и n − ${N} — пара взаимно дополняющих делителей числа ${N * N} = ${N}², причём m ≤ n. Перебирая делители, получаем пары ${pairsC.map(([m, n]) => `(${m}; ${n})`).join(", ")}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: A.ds, target: frVal(A.f) },
        b: { type: "yesno", yes: true, example: B.ds, target: frVal(B.f) },
        c: { type: "all", values: valuesC, examples: exC },
      },
      mustMention: [N],
      extra: [A.f.n, A.f.d, B.f.n, B.f.d, 1],
      phrases: ["все числители которых — единица", "знаменатели — попарно различные натуральные числа"],
    },
  })
}

// #118. Приближение √2 дробями. Ключ: |m² − 2n²| ≥ 1 для натуральных m, n
// (равенство нулю означало бы рациональность √2), поэтому |m²/n² − 2| ≥ 1/n²,
// и при двузначном n это не меньше 1/9801.
export function t19Sqrt2Approximation() {
  const E1 = randInt(50, 5000)                  // |m/n − √2| ≤ 1/E1 — достижимо (99/70)
  const E2 = randInt(9802, 99999)               // |m²/n² − 2| ≤ 1/E2 — недостижимо
  const K = randInt(2, 20)                      // выражение |(n + K)/n − √2|
  // Минимум |K/n − (√2 − 1)| по натуральным n: n ≈ K(√2 + 1); проверяем соседей.
  const target = K * (Math.SQRT2 + 1)
  const cands = [Math.floor(target) - 1, Math.floor(target), Math.floor(target) + 1, Math.floor(target) + 2].filter((x) => x >= 1)
  const dev = (n) => Math.abs((n + K) / n - Math.SQRT2)
  const bestVal = Math.min(...cands.map(dev))
  const bestNs = cands.filter((n) => Math.abs(dev(n) - bestVal) < 1e-15).sort((a, b) => a - b)
  const exA = [99, 70]
  if (Math.abs(99 / 70 - Math.SQRT2) > 1 / E1) return null

  const params = { E1, E2, K, bestNs }
  const check = (val, part) => {
    if (part === "c") {
      if (!Number.isInteger(val) || val < 1) return `${val} не натуральное`
      if (Math.abs(dev(val) - bestVal) > 1e-15) return `при n = ${val} значение выражения не наименьшее`
      return null
    }
    if (!Array.isArray(val) || val.length !== 2) return "не пара (m, n)"
    const [m, n] = val
    if (!Number.isInteger(m) || !Number.isInteger(n) || m < 10 || m > 99 || n < 10 || n > 99) return `${m}, ${n} — не двузначные`
    if (part === "a" && Math.abs(m / n - Math.SQRT2) > 1 / E1) return `|${m}/${n} − √2| больше 1/${E1}`
    if (part === "b" && Math.abs((m * m) / (n * n) - 2) > 1 / E2) return `|${m}²/${n}² − 2| больше 1/${E2}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все пары двузначных m, n (10…99) для а) и б);
    // все натуральные n до 100000 для в) — дальше выражение монотонно стремится
    // к |1 − √2| ≈ 0,414 и минимума дать не может.
    let a = false, b = false
    for (let m = 10; m <= 99; m++) for (let n = 10; n <= 99; n++) {
      if (Math.abs(m / n - Math.SQRT2) <= 1 / P.E1) a = true
      if (Math.abs((m * m) / (n * n) - 2) <= 1 / P.E2) b = true
    }
    let bv = Infinity
    for (let n = 1; n <= 100000; n++) bv = Math.min(bv, Math.abs((n + P.K) / n - Math.SQRT2))
    const ns = []
    for (let n = 1; n <= 100000; n++) if (Math.abs(Math.abs((n + P.K) / n - Math.SQRT2) - bv) < 1e-15) ns.push(n)
    return { a, b, c: ns }
  }

  return item({
    preamble: `Рассматриваются приближения числа √2 обыкновенными дробями.`,
    qa: `Существуют ли двузначные натуральные числа m и n такие, что |m/n − √2| ≤ ⟦f:1:${E1}⟧?`,
    qb: `Существуют ли двузначные натуральные числа m и n такие, что |m²/n² − 2| ≤ ⟦f:1:${E2}⟧?`,
    qc: `Найдите все возможные значения натурального числа n, при каждом из которых значение выражения |(n + ${K})/n − √2| будет наименьшим.`,
    ansA: `да: m = 99, n = 70, так как |99/70 − √2| ≈ 0,00007 ≤ 1/${E1}`,
    ansB: `нет: число m² − 2n² целое и не равно нулю (иначе √2 = m/n было бы рациональным), поэтому |m²/n² − 2| = |m² − 2n²|/n² ≥ 1/n² ≥ 1/99² = 1/9801 > 1/${E2}`,
    ansC: `${joinRu(bestNs)}`,
    solution: `а) Достаточно предъявить пару: 99/70 = 1,4142857…, а √2 = 1,4142135…, поэтому |99/70 − √2| < 0,0001 ≤ 1/${E1}.\nб) Для натуральных m и n число m² − 2n² целое; оно не равно нулю, иначе √2 = m/n было бы рациональным. Значит |m² − 2n²| ≥ 1 и |m²/n² − 2| ≥ 1/n². У двузначного n имеем n ≤ 99, поэтому 1/n² ≥ 1/9801 > 1/${E2} — требуемое неравенство невозможно.\nв) |(n + ${K})/n − √2| = |${K}/n − (√2 − 1)|. Функция ${K}/n убывает, поэтому минимум достигается при n, ближайшем к ${K}/(√2 − 1) = ${K}(√2 + 1) ≈ ${target.toFixed(3)}. Проверка соседних целых даёт n = ${joinRu(bestNs)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: E1 },
        b: { type: "yesno", yes: false, reason: "irrational", target: E2 },
        c: { type: "all", values: bestNs, examples: Object.fromEntries(bestNs.map((n) => [n, n])) },
      },
      mustMention: [E1, E2, K],
      extra: [1, 2],
      phrases: ["двузначные натуральные числа", "√2"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 8. Прогрессии (#8, #40, #92, #109)
// ═══════════════════════════════════════════════════════════════════════════

// #8. Конечная арифметическая прогрессия из натуральных чисел.
// Ключи: сумма крайних членов равна 2a + (k−1)d, поэтому при НЕЧЁТНОМ количестве
// членов она чётна; среднее арифметическое прогрессии равно полусумме крайних.
export function t19APEndsSum() {
  const kA = pick([5, 7, 9])                     // нечётное количество ⟹ сумма крайних чётна
  const T1 = 2 * randInt(20, 90) + 1             // нечётное ⟹ невозможно
  const aB = randInt(1, 5)                       // б): {aB, …, aB+5}, единственная прогрессия
  const kB = 6
  const T2 = 2 * aB + 5
  const setB = Array.from({ length: kB }, (_, i) => aB + i)
  const p = 2 * randInt(5, 30) + 1               // в): среднее = p/2, сумма крайних = p
  const nMax = p - 1
  const meanTxt = `${(p - 1) / 2},5`      // эталон пишет среднее десятичной дробью: «6,5»

  const params = { kA, T1, kB, T2, p, nMax }
  const isAP = (arr) => {
    if (arr.length < 2) return false
    const d = arr[1] - arr[0]
    for (let i = 1; i < arr.length; i++) if (arr[i] - arr[i - 1] !== d) return false
    return true
  }
  const check = (arr, part) => {
    if (!Array.isArray(arr) || arr.length < 2) return "не прогрессия"
    for (const x of arr) if (!Number.isInteger(x) || x < 1) return `${x} не натуральное`
    if (!isAP(arr)) return "числа не образуют арифметическую прогрессию"
    const ends = Math.max(...arr) + Math.min(...arr)
    if (part === "a") { if (arr.length !== kA) return `${arr.length} членов вместо ${kA}`; if (ends !== T1) return `сумма крайних ${ends}, а не ${T1}` }
    if (part === "b") { if (arr.length !== kB) return `${arr.length} членов вместо ${kB}`; if (ends !== T2) return `сумма крайних ${ends}, а не ${T2}` }
    if (part === "c") {
      if (arr.length !== nMax) return `${arr.length} членов вместо ${nMax}`
      if (2 * sum(arr) !== p * arr.length) return `среднее ${sum(arr) / arr.length}, а не ${p}/2`
    }
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все прогрессии из натуральных чисел с первым членом
    // до 1000 и разностью по модулю до 1000 (при больших значениях крайние члены
    // превышают заявленные суммы).
    let a = false
    for (let a1 = 1; a1 <= 1000; a1++) for (let d = -1000; d <= 1000; d++) {
      const last = a1 + (P.kA - 1) * d
      if (last < 1) continue
      if (a1 + last === P.T1) a = true
    }
    const bSets = new Set()
    for (let a1 = 1; a1 <= 1000; a1++) for (let d = -1000; d <= 1000; d++) {
      const arr = Array.from({ length: P.kB }, (_, i) => a1 + i * d)
      if (arr.some((x) => x < 1)) continue
      if (Math.max(...arr) + Math.min(...arr) !== P.T2) continue
      bSets.add([...arr].sort((x, y) => x - y).join(","))
    }
    let best = 0
    for (let n = 2; n <= 2 * P.p; n++) for (let a1 = 1; a1 <= P.p; a1++) {
      const an = P.p - a1
      if (an < 1) continue
      if ((an - a1) % (n - 1) !== 0) continue
      best = Math.max(best, n)
    }
    return { a, b: [...bSets].sort(), c: best, c_next: false }
  }

  return item({
    preamble: `Рассматриваются конечные арифметические прогрессии, состоящие из натуральных чисел.`,
    qa: `Существует ли конечная арифметическая прогрессия, состоящая из ${kA} натуральных чисел, такая, что сумма наибольшего и наименьшего членов этой прогрессии равна ${T1}?`,
    qb: `Конечная арифметическая прогрессия состоит из ${kB} натуральных чисел. Сумма наибольшего и наименьшего членов этой прогрессии равна ${T2}. Найдите все числа, из которых состоит эта прогрессия.`,
    qc: `Среднее арифметическое членов конечной арифметической прогрессии, состоящей из натуральных чисел, равно ${meanTxt}. Какое наибольшее количество членов может быть в этой прогрессии?`,
    ansA: `нет: сумма наибольшего и наименьшего членов равна 2a₁ + (${kA} − 1)d = 2a₁ + ${kA - 1}d, а это чётное число, тогда как ${T1} нечётно`,
    ansB: `${joinRu(setB)}`,
    ansC: `${nMax}; пример: ${runText(1, 1, nMax)}, среднее арифметическое равно ${meanTxt}; больше нельзя — среднее равно полусумме крайних членов, поэтому a₁ + aₙ = ${p}, а разность по модулю не меньше 1, значит n − 1 ≤ |aₙ − a₁| ≤ ${p - 2}`,
    solution: `Сумма наибольшего и наименьшего членов прогрессии из k чисел равна 2a₁ + (k − 1)d.\nа) При нечётном k = ${kA} множитель (k − 1) чётен, поэтому вся сумма чётна и не может равняться нечётному ${T1}.\nб) При k = ${kB} получаем 2a₁ + 5d = ${T2}; перебирая допустимые d (все члены обязаны быть натуральными), находим единственный набор ${joinRu(setB)}.\nв) Среднее арифметическое арифметической прогрессии равно полусумме крайних членов, поэтому a₁ + aₙ = ${p}. Разность целая и ненулевая (иначе все члены равны ${p}/2 — не натуральному числу), значит n − 1 ≤ |aₙ − a₁| ≤ ${p} − 2, откуда n ≤ ${nMax}; равенство даёт прогрессия ${runText(1, 1, nMax)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: false, reason: "parity", target: T1 },
        b: { type: "all", values: [setB.join(",")], examples: { [setB.join(",")]: setB } },
        c: { type: "extremum", mode: "max", value: nMax, example: Array.from({ length: nMax }, (_, i) => i + 1) },
      },
      mustMention: [kA, T1, kB, T2, (p - 1) / 2],
      extra: [5, 2, p],
      phrases: ["арифметическая прогрессия", "натуральных чисел", "сумма наибольшего и наименьшего членов"],
    },
  })
}

// #40. n различных натуральных чисел, составляющих арифметическую прогрессию (n ≥ 3).
// Сумма равна n(2a + (n−1)d)/2 при a ≥ 1 и d ≥ 1, поэтому:
//   • наименьшая сумма при данном n равна n(n+1)/2 — это даёт ответ на пункт б);
//   • сумма S возможна ⟺ n делит 2S и остаток 2S/n − (n−1)d при некотором d ≥ 1
//     чётен и не меньше 2 — это даёт пункт в) без всякого перебора наборов.
export function t19APCountBySum() {
  const nA = randInt(3, 6), aA = randInt(1, 6), dA = randInt(1, 4)
  const S1 = nA * (2 * aA + (nA - 1) * dA) / 2
  const S2 = randInt(200, 1500)
  let nBest = 2; while ((nBest + 1) * (nBest + 2) / 2 < S2) nBest++
  const S3 = pick([111, 141, 159, 213, 219, 249, 267, 141, 123])
  const okN = (S, n) => {
    if (n < 3 || (2 * S) % n !== 0) return false
    const Q = 2 * S / n
    if (n % 2 === 1) return Q % 2 === 0 && (n - 1) <= Q - 2
    return Q % 2 === 0 ? 2 * (n - 1) <= Q - 2 : (n - 1) <= Q - 2
  }
  const valuesC = []
  for (const n of divisors(2 * S3)) if (okN(S3, n)) valuesC.push(n)
  if (!valuesC.length) return null
  const mkAP = (S, n) => {
    const Q = 2 * S / n
    for (let d = 1; d <= Q; d++) {
      const two = Q - (n - 1) * d
      if (two >= 2 && two % 2 === 0) return Array.from({ length: n }, (_, i) => two / 2 + i * d)
    }
    return null
  }
  const exC = Object.fromEntries(valuesC.map((n) => [n, mkAP(S3, n)]))
  const exA = Array.from({ length: nA }, (_, i) => aA + i * dA)
  const exB = Array.from({ length: nBest }, (_, i) => i + 1)

  const params = { S1, S2, S3, nBest, valuesC }
  const check = (arr, part) => {
    if (!Array.isArray(arr) || arr.length < 3) return "меньше трёх чисел"
    if (uniq(arr).length !== arr.length) return "числа не различны"
    for (const x of arr) if (!Number.isInteger(x) || x < 1) return `${x} не натуральное`
    const d = arr[1] - arr[0]
    for (let i = 1; i < arr.length; i++) if (arr[i] - arr[i - 1] !== d) return "не арифметическая прогрессия"
    if (part === "a" && sum(arr) !== S1) return `сумма ${sum(arr)}, а не ${S1}`
    if (part === "b") { if (sum(arr) >= S2) return `сумма ${sum(arr)} не меньше ${S2}`; if (arr.length !== nBest) return `${arr.length} чисел вместо ${nBest}` }
    if (part === "c" && sum(arr) !== S3) return `сумма ${sum(arr)}, а не ${S3}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все прогрессии с n от 3 до 2000, первым членом до 2000
    // и разностью до 2000 — за этими границами сумма превосходит все три цели.
    let a = false, best = 0
    const cs = new Set()
    for (let n = 3; n <= 2000; n++) {
      const minS = n * (n + 1) / 2
      if (minS < P.S2) best = Math.max(best, n)
      if (minS > Math.max(P.S1, P.S3)) continue
      for (let a1 = 1; a1 <= 2000; a1++) for (let d = 1; d <= 2000; d++) {
        const S = n * (2 * a1 + (n - 1) * d) / 2
        if (S > Math.max(P.S1, P.S3)) break
        if (S === P.S1) a = true
        if (S === P.S3) cs.add(n)
      }
    }
    return { a, b: best, c: [...cs].sort((x, y) => x - y), b_next: false }
  }

  return item({
    preamble: `Даны n различных натуральных чисел, составляющих арифметическую прогрессию (n ≥ 3).`,
    qa: `Может ли сумма всех данных чисел быть равной ${S1}?`,
    qb: `Каково наибольшее значение n, если сумма всех данных чисел меньше ${S2}?`,
    qc: `Найдите все возможные значения n, если сумма всех данных чисел равна ${S3}.`,
    ansA: `да, например ${joinRu(exA)}`,
    ansB: `${nBest}; пример: ${runText(1, 1, nBest)} с суммой ${nBest * (nBest + 1) / 2} < ${S2}; больше нельзя — наименьшая сумма n различных натуральных чисел равна n(n+1)/2, а при n = ${nBest + 1} это уже ${(nBest + 1) * (nBest + 2) / 2} ≥ ${S2}`,
    ansC: `${joinRu(valuesC)}${valuesC.map((n) => `; при n = ${n} подходит прогрессия ${joinRu(exC[n])}`).join("")}`,
    solution: `Сумма n членов прогрессии равна n(2a₁ + (n − 1)d)/2, где a₁ ≥ 1 и d ≥ 1 (числа различны и натуральны).\nб) Наименьшая возможная сумма при данном n достигается на прогрессии 1, 2, …, n и равна n(n+1)/2. Наибольшее n, при котором n(n+1)/2 < ${S2}, равно ${nBest}.\nв) Из 2S = n(2a₁ + (n − 1)d) видно, что n — делитель числа 2·${S3} = ${2 * S3}. Далее для каждого такого n нужно, чтобы 2a₁ = ${2 * S3}/n − (n − 1)d было чётным и не меньше 2 при некотором d ≥ 1. Это выполняется ровно при n = ${joinRu(valuesC)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: S1 },
        b: { type: "extremum", mode: "max", value: nBest, example: exB },
        c: { type: "all", values: valuesC, examples: exC },
      },
      mustMention: [S1, S2, S3, 3],
      extra: [],
      phrases: ["различных натуральных чисел, составляющих арифметическую прогрессию"],
    },
  })
}

// #92. Конечная геометрическая прогрессия из трёхзначных натуральных чисел
//      с заданным первым членом и не менее чем тремя членами.
// Конструкция перебирает ЗНАМЕНАТЕЛЬ q = p/s в несократимом виде (s — делитель F),
// solve() же идёт по второму члену прогрессии — это разные проходы.
const GP_TABLE = (() => {
  const map = new Map()
  for (const F of [128, 192, 256, 384, 512, 768]) {
    const members = new Set()
    for (let s = 1; s <= 256; s++) {
      if (F % s !== 0 && s !== 1) { /* знаменатель обязан делить F на каждом шаге — проверим ниже */ }
      for (let pn = 1; pn <= 4 * s; pn++) {
        if (gcdI(pn, s) !== 1 || pn === s) continue
        const seq = [F]
        let cur = F
        for (let step = 0; step < 12; step++) {
          if (cur * pn % s !== 0) break
          cur = cur * pn / s
          if (cur < 100 || cur > 999) break
          seq.push(cur)
        }
        if (seq.length >= 3) for (const x of seq) members.add(x)
      }
    }
    map.set(F, [...members].sort((a, b) => a - b))
  }
  return map
})()
export function t19GPThreeDigit() {
  const F = pick([...GP_TABLE.keys()])
  const list = GP_TABLE.get(F)
  if (!list || list.length < 4) return null
  const best = list[list.length - 1]
  const yesVal = pick(list.filter((x) => x !== F && x !== best))
  const holes = []
  for (let x = 100; x <= 999; x++) if (!list.includes(x)) holes.push(x)
  const noVal = pick(holes)

  const seqFor = (target) => {
    // явная прогрессия, содержащая target (нужна для примера в ответе)
    for (let s = 1; s <= 256; s++) for (let pn = 1; pn <= 4 * s; pn++) {
      if (gcdI(pn, s) !== 1 || pn === s) continue
      const seq = [F]
      let cur = F
      for (let step = 0; step < 12; step++) {
        if (cur * pn % s !== 0) break
        cur = cur * pn / s
        if (cur < 100 || cur > 999) break
        seq.push(cur)
      }
      if (seq.length >= 3 && seq.includes(target)) return { seq, pn, s }
    }
    return null
  }
  const sA = seqFor(yesVal), sC = seqFor(best)
  if (!sA || !sC) return null

  const params = { F, yesVal, noVal, best }
  const check = (seq, part) => {
    if (!Array.isArray(seq) || seq.length < 3) return "в прогрессии меньше трёх чисел"
    for (const x of seq) {
      if (!Number.isInteger(x) || x < 100 || x > 999) return `${x} не трёхзначное натуральное`
    }
    if (seq[0] !== F) return `первый член ${seq[0]}, а не ${F}`
    for (let i = 2; i < seq.length; i++) if (seq[i] * seq[i - 2] !== seq[i - 1] * seq[i - 1]) return "не геометрическая прогрессия"
    const need = part === "a" ? yesVal : part === "b" ? noVal : best
    if (!seq.includes(need)) return `${need} не входит в прогрессию`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все прогрессии задаются вторым членом t (100…999),
    // так как q = t/F; дальше члены определены однозначно.
    const members = new Set()
    for (let t = 100; t <= 999; t++) {
      if (t === P.F) continue
      const g = gcdI(t, P.F), pn = t / g, s = P.F / g
      const seq = [P.F]
      let cur = P.F
      for (let step = 0; step < 12; step++) {
        if (cur * pn % s !== 0) break
        cur = cur * pn / s
        if (cur < 100 || cur > 999) break
        seq.push(cur)
      }
      if (seq.length >= 3) for (const x of seq) members.add(x)
    }
    const arr = [...members]
    return { a: arr.includes(P.yesVal), b: arr.includes(P.noVal), c: Math.max(...arr) }
  }

  return item({
    preamble: `Первый член конечной геометрической прогрессии, состоящей из трёхзначных натуральных чисел, равен ${F}. Известно, что в прогрессии не меньше трёх чисел.`,
    qa: `Может ли число ${yesVal} являться членом такой прогрессии?`,
    qb: `Может ли число ${noVal} являться членом такой прогрессии?`,
    qc: `Какое наибольшее число может являться членом такой прогрессии?`,
    ansA: `да, например прогрессия ${joinRu(sA.seq)} со знаменателем ${sA.pn}/${sA.s}`,
    ansB: `нет: знаменатель прогрессии равен несократимой дроби p/s, и каждый следующий член получается умножением на p и делением на s, поэтому все члены имеют вид ${F}·pᵏ/sᵏ; ни при каком таком знаменателе, дающем не менее трёх трёхзначных членов, число ${noVal} не появляется`,
    ansC: `${best}; достигается в прогрессии ${joinRu(sC.seq)} со знаменателем ${sC.pn}/${sC.s}`,
    solution: `Пусть знаменатель равен несократимой дроби p/s. Тогда k-й член равен ${F}·pᵏ/sᵏ, и чтобы он был целым, sᵏ обязано делить ${F}; значит s — степень двойки, делящая ${F}.\nПеребирая допустимые пары (p, s) и требуя, чтобы все члены оставались трёхзначными, а их было не меньше трёх, получаем полный список возможных членов прогрессии.\nВ нём есть ${yesVal} (прогрессия ${joinRu(sA.seq)}), нет ${noVal}, а наибольшее число равно ${best} (прогрессия ${joinRu(sC.seq)}).`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: sA.seq, target: yesVal },
        b: { type: "yesno", yes: false, reason: "no-quotient", target: noVal },
        c: { type: "value", value: best, example: sC.seq },
      },
      mustMention: [F, yesVal, noVal],
      extra: [],
      phrases: ["геометрической прогрессии, состоящей из трёхзначных натуральных чисел", "не меньше трёх чисел"],
    },
  })
}

// #109. Пять различных натуральных чисел с заданным произведением; могут ли пять,
//       четыре или три из них образовать геометрическую прогрессию.
// Инварианты: произведение пяти членов ГП равно (среднего)⁵ — полная пятая степень;
// произведение четырёх членов ГП равно (b²q³)² — полный квадрат.
const GP_SUBSET = (() => {
  const cache = new Map()
  const build = (P) => {
    const divs = divisors(P)
    const res = { five: null, four: null, three: null }
    const isGP = (arr) => { for (let i = 2; i < arr.length; i++) if (arr[i] * arr[i - 2] !== arr[i - 1] * arr[i - 1]) return false; return true }
    const cur = []
    const rec = (start, prod) => {
      if (cur.length === 5) {
        if (prod !== P) return
        const s = [...cur]
        if (!res.five && isGP(s)) res.five = s
        if (!res.four) for (let skip = 0; skip < 5; skip++) { const t = s.filter((_, i) => i !== skip); if (isGP(t)) { res.four = { set: s, gp: t }; break } }
        if (!res.three) for (let i = 0; i < 5 && !res.three; i++) for (let j = i + 1; j < 5 && !res.three; j++) for (let k = j + 1; k < 5; k++) {
          const t = [s[i], s[j], s[k]]
          if (isGP(t)) { res.three = { set: s, gp: t }; break }
        }
        return
      }
      for (let i = start; i < divs.length; i++) {
        const d = divs[i]
        if (prod * d > P || P % (prod * d) !== 0) continue
        cur.push(d); rec(i + 1, prod * d); cur.pop()
      }
    }
    rec(0, 1)
    return res
  }
  for (const P of [1512, 2520, 3024, 4536, 5040]) cache.set(P, build(P))
  return cache
})()
export function t19ProdGPSubset() {
  const P = pick([...GP_SUBSET.keys()])
  const r = GP_SUBSET.get(P)
  // Эталонная конфигурация ответов: пять — нет, четыре — нет, три — да.
  if (r.five || r.four || !r.three) return null

  const params = { P }
  const check = (val, part) => {
    const set = part === "c" ? val.set : val
    if (!Array.isArray(set) || set.length !== 5) return "не пять чисел"
    if (uniq(set).length !== 5) return "числа не различны"
    for (const x of set) if (!Number.isInteger(x) || x < 1) return `${x} не натуральное`
    if (set.reduce((a, b) => a * b, 1) !== P) return `произведение ${set.reduce((a, b) => a * b, 1)}, а не ${P}`
    if (part === "c") {
      const gp = val.gp
      if (!Array.isArray(gp) || gp.length !== 3) return "не три числа в прогрессии"
      for (const x of gp) if (!set.includes(x)) return `${x} не входит в набор`
      if (gp[2] * gp[0] !== gp[1] * gp[1]) return "три числа не образуют геометрическую прогрессию"
    }
    return null
  }
  const solve = (Pm) => {
    // Пространство перебора: все пятёрки различных делителей числа P с произведением P.
    const divs = divisors(Pm.P)
    const isGP = (arr) => { for (let i = 2; i < arr.length; i++) if (arr[i] * arr[i - 2] !== arr[i - 1] * arr[i - 1]) return false; return true }
    let five = false, four = false, three = false
    const cur = []
    const rec = (start, prod) => {
      if (cur.length === 5) {
        if (prod !== Pm.P) return
        const s = [...cur]
        if (isGP(s)) five = true
        for (let skip = 0; skip < 5; skip++) if (isGP(s.filter((_, i) => i !== skip))) four = true
        for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) for (let k = j + 1; k < 5; k++) {
          if (isGP([s[i], s[j], s[k]])) three = true
        }
        return
      }
      for (let i = start; i < divs.length; i++) {
        const d = divs[i]
        if (prod * d > Pm.P || Pm.P % (prod * d) !== 0) continue
        cur.push(d); rec(i + 1, prod * d); cur.pop()
      }
    }
    rec(0, 1)
    return { a: five, b: four, c: three }
  }

  return item({
    preamble: `Рассматриваются пять различных натуральных чисел, произведение которых равно ${P}.`,
    qa: `Можно ли привести пример таких пяти чисел, если пять из них образуют геометрическую прогрессию?`,
    qb: `Можно ли привести пример таких пяти чисел, если четыре из них образуют геометрическую прогрессию?`,
    qc: `Можно ли привести пример таких пяти чисел, если три из них образуют геометрическую прогрессию?`,
    ansA: `нет: произведение пяти членов геометрической прогрессии равно пятой степени её среднего члена, а ${P} не является пятой степенью натурального числа`,
    ansB: `нет: произведение четырёх членов геометрической прогрессии b, bq, bq², bq³ равно (b²q³)², то есть полному квадрату; значит пятое число c обязано быть таким, что ${P}/c — точный квадрат, а для каждого подходящего c четырёх различных натуральных чисел в геометрической прогрессии с нужным произведением не существует`,
    ansC: `да, например ${joinRu(r.three.set)}: числа ${joinRu(r.three.gp)} образуют геометрическую прогрессию, а произведение всех пяти равно ${P}`,
    solution: `Произведение пяти последовательных членов геометрической прогрессии равно (aq²)⁵ — пятой степени среднего члена. Так как ${P} не является пятой степенью натурального числа, пункт а) невозможен.\nПроизведение четырёх членов равно b·bq·bq²·bq³ = (b²q³)² — полный квадрат. Значит оставшееся пятое число c должно давать точный квадрат ${P}/c; перебор таких c показывает, что подходящей четвёрки различных натуральных чисел нет.\nДля трёх чисел ограничений почти нет: подходит набор ${joinRu(r.three.set)}, где ${joinRu(r.three.gp)} — геометрическая прогрессия.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: false, reason: "fifth-power", target: 5 },
        b: { type: "yesno", yes: false, reason: "square", target: 4 },
        c: { type: "yesno", yes: true, example: r.three, target: 3 },
      },
      mustMention: [P],
      extra: [],
      phrases: ["пять различных натуральных чисел", "геометрическую прогрессию"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 13. Игры и операции с инвариантом (#24, #29)
// ═══════════════════════════════════════════════════════════════════════════

// #24. Три коробки; за ход берут по камню из двух коробок и кладут в оставшуюся.
// Инварианты: (1) чётность всех попарных разностей сохраняется — ход меняет разность
// либо на 0, либо на ±2; (2) общее число камней убывает ровно на 1 за ход, а число
// камней в целевой коробке и число ходов имеют одинаковую чётность, откуда
// a + b ≡ S₀ (mod 2) и c ≤ ⌊S₀/2⌋.
export function t19BoxesThree() {
  const A = randInt(20, 45), B = randInt(20, 45)
  if (A === B) return null
  const S0 = A + B
  // Инвариант: суммы a + c и b + c НЕ ВОЗРАСТАЮТ (ход «в третью» их сохраняет,
  // два других уменьшают на 2), поэтому c ≤ min(A, B), и это достигается.
  const cMax = Math.min(A, B)
  // а) — «нет» по чётности попарных разностей.
  const t = randInt(5, 25)
  const a1 = A - t, b1 = B - t - 1, c1 = S0 - a1 - b1 - randInt(1, 5)
  if (a1 < 0 || b1 < 0 || c1 < 0) return null
  const parityOK = ((a1 - b1) - (A - B)) % 2 === 0 && ((a1 - c1) - (A - 0)) % 2 === 0
  if (parityOK) return null                    // нужен именно «нет» по чётности
  // б) — «нет» по оценке: столько камней в третьей коробке уже не помещается.
  const K = cMax + randInt(1, 30)
  const exC = [A - cMax, B - cMax, cMax]

  const params = { A, B, S0, a1, b1, c1, K, cMax }
  const reach = (P) => {
    // Полный перебор ДОСТИЖИМЫХ состояний: обход в ширину от (A, B, 0).
    // Пространство явно ограничено: a + b + c ≤ A + B, все координаты неотрицательны.
    const seen = new Set([`${P.A},${P.B},0`])
    const q = [[P.A, P.B, 0]]
    while (q.length) {
      const [x, y, z] = q.pop()
      const moves = [[x - 1, y - 1, z + 1], [x - 1, y + 1, z - 1], [x + 1, y - 1, z - 1]]
      for (const m of moves) {
        if (m.some((v) => v < 0)) continue
        const k = m.join(",")
        if (seen.has(k)) continue
        seen.add(k); q.push(m)
      }
    }
    return seen
  }
  const check = (st, part) => {
    if (!Array.isArray(st) || st.length !== 3) return "не тройка коробок"
    for (const x of st) if (!Number.isInteger(x) || x < 0) return `${x} — не число камней`
    if (part === "a" && (st[0] !== a1 || st[1] !== b1 || st[2] !== c1)) return `состояние ${st} не то, о котором спрашивают`
    if (part === "b" && st[2] !== K) return `в третьей коробке ${st[2]}, а не ${K}`
    if (part === "c" && st[2] !== cMax) return `в третьей коробке ${st[2]}, а не ${cMax}`
    return null
  }
  const solve = (P) => {
    const seen = reach(P)
    let best = -1, hitK = false
    for (const k of seen) {
      const z = +k.split(",")[2]
      if (z > best) best = z
      if (z === P.K) hitK = true
    }
    let over = false
    for (const k of seen) if (+k.split(",")[2] === best + 1) { over = true; break }
    return { a: seen.has(`${P.a1},${P.b1},${P.c1}`), b: hitK, c: best, c_next: over }
  }

  return item({
    preamble: `Есть три коробки: в первой коробке ${A} камней, во второй — ${B}, в третьей пусто. За один ход разрешается взять по камню из двух коробок и положить в оставшуюся.`,
    qa: `Могло ли в первой коробке оказаться ${stones(a1)}, во второй — ${b1}, а в третьей — ${c1}?`,
    qb: `Могло ли в третьей коробке оказаться ${stones(K)}?`,
    qc: `Какое наибольшее число камней могло оказаться в третьей коробке?`,
    ansA: `нет: за ход две коробки теряют по камню, а одна получает камень, поэтому каждая попарная разность либо не меняется, либо меняется на 2 — чётности всех попарных разностей сохраняются; у начального набора (${A}; ${B}; 0) и у набора (${a1}; ${b1}; ${c1}) эти чётности разные`,
    ansB: `нет: суммы (первая + третья) и (вторая + третья) при каждом ходе либо не меняются, либо уменьшаются на 2, поэтому в третьей коробке не может оказаться больше min(${A}; ${B}) = ${cMax}, а ${K} больше`,
    ansC: `${cMax}; достигается за ${cMax} ходов, каждый из которых берёт камень из первой и второй коробок: получится (${exC.join("; ")}); больше нельзя — сумма (первая + третья) не возрастает и в начале равна ${A}, а сумма (вторая + третья) не возрастает и в начале равна ${B}, поэтому c ≤ min(${A}; ${B}) = ${cMax}`,
    solution: `Обозначим через x, y, z количество ходов, кладущих камень в первую, вторую и третью коробки, t = x + y + z.\nХод «положить в третью коробку» сохраняет обе суммы a + c и b + c, а два других хода уменьшают одну из них на 2. Значит обе суммы не возрастают: a + c ≤ ${A} и b + c ≤ ${B}.\nОтсюда c ≤ min(${A}; ${B}) = ${cMax}, и это достигается за ${cMax} ходов подряд «из первой и второй в третью».\nКроме того, за ход каждая попарная разность меняется на 0 или на ±2, поэтому чётности попарных разностей — инвариант; он и запрещает набор (${a1}; ${b1}; ${c1}).`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: false, reason: "parity", target: a1 },
        b: { type: "yesno", yes: false, reason: "bound", target: K },
        c: { type: "extremum", mode: "max", value: cMax, example: exC },
      },
      mustMention: [A, B, a1, b1, c1, K],
      extra: [],
      phrases: ["три коробки", "взять по камню из двух коробок и положить в оставшуюся"],
    },
  })
}

// #29. На доске n единиц подряд; между некоторыми ставят «+» и считают сумму.
// Слагаемые — репьюниты 1, 11, 111, …, а R_L ≡ L (mod 9), поэтому сумма сравнима
// с n по модулю 9 — это и есть инвариант для пункта б).
const ONES_TABLE = (() => {
  const map = new Map()
  for (const T of [120, 132, 150, 165, 180, 198, 210, 231, 240, 264]) {
    const rep = []
    for (let L = 1; (10 ** L - 1) / 9 <= T; L++) rep.push({ L, v: (10 ** L - 1) / 9 })
    // reach[s][n] — можно ли получить сумму s из единиц общей длины n
    const reach = Array.from({ length: T + 1 }, () => new Uint8Array(T + 1))
    reach[0][0] = 1
    for (let s = 0; s <= T; s++) for (let n = 0; n <= T; n++) {
      if (!reach[s][n]) continue
      for (const { L, v } of rep) if (s + v <= T && n + L <= T) reach[s + v][n + L] = 1
    }
    const ns = []
    for (let n = 1; n <= T; n++) if (reach[T][n]) ns.push(n)
    map.set(T, ns)
  }
  return map
})()
export function t19OnesAndPlus() {
  const T = pick([...ONES_TABLE.keys()])
  const ns = ONES_TABLE.get(T)
  if (ns.length < 3) return null
  const nYes = pick(ns.filter((n) => n > 20))
  let nNo = 0
  for (let g = 0; g < 100 && !nNo; g++) { const c = randInt(20, T); if ((c - T) % 9 !== 0) nNo = c }
  if (!nNo) return null
  const count = ns.length
  // явное разбиение для примера: жадно набираем репьюниты нужной длины
  // Явная формула вместо перебора: из T = k + 11a + 111b и n = k + 2a + 3b следует
  // (T − n)/9 = a + 12b, поэтому b перебирается по нескольким значениям, а k и a
  // считаются напрямую.
  const buildParts = (n) => {
    if ((T - n) % 9 !== 0) return null
    const q = (T - n) / 9
    for (let b = 0; b <= Math.floor(q / 12); b++) {
      const a = q - 12 * b
      const k = T - 11 * a - 111 * b
      if (k < 0) continue
      if (k + 2 * a + 3 * b !== n) continue
      return [...Array(b).fill(111), ...Array(a).fill(11), ...Array(k).fill(1)]
    }
    return null
  }
  const partsYes = buildParts(nYes)
  if (!partsYes) return null

  const params = { T, nYes, nNo, count }
  const check = (parts, part) => {
    if (!Array.isArray(parts) || !parts.length) return "пустая сумма"
    let len = 0
    for (const v of parts) {
      if (!Number.isInteger(v) || v < 1) return `${v} не натуральное`
      if (!/^1+$/.test(String(v))) return `${v} записано не одними единицами`
      len += String(v).length
    }
    if (sum(parts) !== T) return `сумма ${sum(parts)}, а не ${T}`
    const need = part === "a" ? nYes : nNo
    if (part !== "c" && len !== need) return `использовано ${len} единиц вместо ${need}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все разбиения на репьюниты с суммой P.T; динамика
    // по паре (текущая сумма ≤ P.T, использованное число единиц ≤ P.T).
    const rep = []
    for (let L = 1; (10 ** L - 1) / 9 <= P.T; L++) rep.push({ L, v: (10 ** L - 1) / 9 })
    const reach = Array.from({ length: P.T + 1 }, () => new Uint8Array(P.T + 1))
    reach[0][0] = 1
    for (let s = 0; s <= P.T; s++) for (let n = 0; n <= P.T; n++) {
      if (!reach[s][n]) continue
      for (const { L, v } of rep) if (s + v <= P.T && n + L <= P.T) reach[s + v][n + L] = 1
    }
    let c = 0
    for (let n = 1; n <= P.T; n++) if (reach[P.T][n]) c++
    return { a: !!reach[P.T][P.nYes], b: !!reach[P.T][P.nNo], c }
  }

  return item({
    preamble: `На доске написано n единиц подряд. Между некоторыми из них расставляют знаки «+» и считают получившуюся сумму. Например, если было написано 12 единиц, то можно получить сумму 147: 1+11+11+111+11+1+1+1.`,
    qa: `Можно ли получить сумму ${T}, если n = ${nYes}?`,
    qb: `Можно ли получить сумму ${T}, если n = ${nNo}?`,
    qc: `Для скольких значений n можно получить сумму ${T}?`,
    ansA: `да, например ${compactSum(partsYes)} = ${T}`,
    ansB: `нет: каждое слагаемое состоит из единиц, а число из L единиц даёт при делении на 9 такой же остаток, как L; поэтому сумма сравнима с n по модулю 9, а ${T} и ${nNo} дают разные остатки (${T % 9} и ${nNo % 9})`,
    ansC: `${count}`,
    solution: `Слагаемые — это числа вида 1, 11, 111, …; число из L единиц равно (10^L − 1)/9 и даёт при делении на 9 тот же остаток, что и L. Значит вся сумма сравнима с общим количеством единиц n по модулю 9 — это сразу отвечает на пункт б).\nДалее, если использовано k слагаемых-единиц, a слагаемых «11» и b слагаемых «111», то ${T} = k + 11a + 111b, а n = k + 2a + 3b. Перебирая b и a, получаем все подходящие n; их оказывается ${count}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: partsYes, target: nYes },
        b: { type: "yesno", yes: false, reason: "mod9", target: nNo },
        c: { type: "count", value: count },
      },
      mustMention: [T, nYes, nNo, 12, 147],
      extra: [1, 11, 111],
      phrases: ["единиц подряд", "расставляют знаки «+»"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 19. Две школы, средний балл (#111, #112)
// ═══════════════════════════════════════════════════════════════════════════

// Из школы №1 (n учащихся, целый средний a) в школу №2 (m учащихся, целый средний b)
// переходит учащийся с баллом x, после чего средние в ОБЕИХ школах умножаются на k.
// Из определения средних:
//   x = a·n − k·a·(n − 1)  и  x = k·b·(m + 1) − b·m,
// поэтому при k = 0,9 получаем 10x = a(n + 9) = b(9 − m), а при k = 1,1 — 10x = a(11 − n) = b(m + 11).
// Таблица допустимых троек (n, a, b) считается один раз при импорте.
const SCHOOL_TABLE = (() => {
  // Для каждого допустимого n множество достижимых b — это в точности кратные
  // некоторого b₀(n): из cB | a·cA следует a = (cB/НОД)·t, откуда b = t·cA/НОД,
  // а условие целости x = a·cA/10 задаёт минимальное t. Никаких «обрезаний»
  // перебором здесь нет — множество описано полностью.
  const map = new Map()
  const NS = { drop: [9, 11, 13, 15, 17, 19, 21], rise: [11] }   // при rise только N = 11
  for (const mode of ["drop", "rise"]) {                          // даёт b₀(n) ≥ 2 при всех n
    for (const N of NS[mode]) {
      const rows = []
      for (let m = 2; m <= N - 2; m++) {
        const n = N - m
        const cA = mode === "drop" ? n + 9 : 11 - n
        const cB = mode === "drop" ? 9 - m : m + 11
        if (cA <= 0 || cB <= 0) continue
        const g = gcdI(cA, cB), cBs = cB / g
        // минимальное t, при котором x = a·cA/10 целое (a = cBs·t)
        let t0 = 0
        for (let t = 1; t <= 100 && !t0; t++) if ((cBs * t * cA) % 10 === 0) t0 = t
        if (!t0) continue
        // достижимые b — это кратные step = t₀·cA/g; берём НАИМЕНЬШЕЕ из них,
        // при котором остальным учащимся школы №1 хватает хотя бы по одному баллу
        const step = t0 * cA / g
        if (step < 2) continue
        let row = null
        for (let mul = 1; mul <= 50 && !row; mul++) {
          const a = cBs * t0 * mul, x = a * cA / 10, b = step * mul
          if (x >= 1 && a * n - x >= n - 1) row = { n, m, a, b, x, step }
        }
        if (row) rows.push(row)
      }
      map.set(`${N}:${mode}`, rows)
    }
  }
  return map
})()
// Разложить сумму total на cnt натуральных баллов (как можно ровнее).
function spread(total, cnt) {
  if (cnt <= 0 || total < cnt) return null
  const base = Math.floor(total / cnt), rest = total - base * cnt
  return Array.from({ length: cnt }, (_, i) => base + (i < rest ? 1 : 0))
}
const SMALL_PRIMES = [101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199]
function schoolsFamily(mode) {
  const N = pick(mode === "drop" ? [9, 11, 13, 15, 17, 19, 21] : [11])
  const rows = SCHOOL_TABLE.get(`${N}:${mode}`)
  if (!rows || !rows.length) return null
  const steps = [...new Set(rows.map((r) => r.step))].sort((x, y) => x - y)
  const bMin = Math.min(...rows.map((r) => r.b))
  const rowC = rows.find((r) => r.b === bMin)
  // б) — «нет»: простое число, большее всех b₀, не делится ни на одно из них.
  const B2 = pick(SMALL_PRIMES.filter((q) => q > steps[steps.length - 1]))
  if (!B2) return null
  const pctTxt = mode === "drop" ? "уменьшился на 10 %" : "вырос на 10 %"
  const kTxt = mode === "drop" ? "уменьшиться в 10 раз" : "вырасти в 2 раза"

  const mk = (r) => {
    const rest = spread(r.a * r.n - r.x, r.n - 1)
    if (!rest) return null
    return { s1: [r.x, ...rest], s2: Array(r.m).fill(r.b), x: r.x }
  }
  const exC = mk(rowC)
  if (!exC) return null
  let exA = null
  if (mode === "drop") {
    const nA = 2, mA = N - 2, aA = 10 * randInt(1, 6)
    const xA = aA * (9 * nA + 1) / 10
    const restA = spread(aA * nA - xA, nA - 1)
    if (restA && restA.every((v) => v >= 1)) exA = { s1: [xA, ...restA], s2: Array(mA).fill(randInt(1, 20)), x: xA }
    if (!exA) return null
  }

  const params = { N, mode, bMin, B2 }
  const kNum = mode === "drop" ? 0.9 : 1.1
  const check = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.s1) || !Array.isArray(cfg.s2)) return "нет конфигурации"
    const n = cfg.s1.length, m = cfg.s2.length
    if (n < 2 || m < 2) return "в каждой школе должно быть не менее двух учащихся"
    if (n + m !== N) return `всего ${n + m} учащихся вместо ${N}`
    for (const v of [...cfg.s1, ...cfg.s2]) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное число баллов`
    const S1 = sum(cfg.s1), S2 = sum(cfg.s2)
    if (S1 % n !== 0) return "средний балл в школе №1 не целый"
    if (S2 % m !== 0) return "средний балл в школе №2 не целый"
    if (!cfg.s1.includes(cfg.x)) return `перешедший учащийся с баллом ${cfg.x} не из школы №1`
    const a1 = (S1 - cfg.x) / (n - 1), b1 = (S2 + cfg.x) / (m + 1)
    if (part === "a" && mode === "drop" && Math.abs(a1 * 10 - S1 / n) > 1e-9) return "средний в школе №1 уменьшился не в 10 раз"
    if (part !== "a") {
      if (Math.abs(a1 - kNum * (S1 / n)) > 1e-9) return "средний в школе №1 изменился не на 10 %"
      if (Math.abs(b1 - kNum * (S2 / m)) > 1e-9) return "средний в школе №2 изменился не на 10 %"
    }
    if (part === "b" && S2 / m !== B2) return `исходный средний в школе №2 равен ${S2 / m}, а не ${B2}`
    if (part === "c" && S2 / m !== bMin) return `исходный средний в школе №2 равен ${S2 / m}, а не ${bMin}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: число учащихся в школе №1 от 2 до N−2, средние баллы
    // a и b от 1 до 3000. Балл перешедшего вычисляется из ОПРЕДЕЛЕНИЯ первого
    // среднего, второе среднее проверяется напрямую.
    const k = P.mode === "drop" ? 0.9 : 1.1
    const bs = new Set()
    let aYes = false
    for (let m = 2; m <= P.N - 2; m++) {
      const n = P.N - m
      for (let a = 1; a <= 3000; a++) {
        const x = a * n - k * a * (n - 1)
        if (Math.abs(x - Math.round(x)) > 1e-9) continue
        const xi = Math.round(x)
        if (xi < 1 || a * n - xi < n - 1) continue
        for (let b = 1; b <= 400; b++) if (Math.abs((b * m + xi) - k * b * (m + 1)) < 1e-9) bs.add(b)
      }
      if (P.mode === "drop") {
        for (let a = 1; a <= 3000; a++) {
          const x = a * n - (a / 10) * (n - 1)
          if (Math.abs(x - Math.round(x)) > 1e-9) continue
          const xi = Math.round(x)
          if (xi >= 1 && a * n - xi >= n - 1) aYes = true
        }
      }
    }
    const arr = [...bs].sort((x, y) => x - y)
    return { a: P.mode === "drop" ? aYes : false, b: arr.includes(P.B2), c: arr.length ? arr[0] : -1, c_next: false }
  }

  return item({
    preamble: `В школах №1 и №2 учащиеся писали тест. Из каждой школы тест писали, по крайней мере, 2 учащихся, а суммарно тест писали ${N} учащихся. Каждый учащийся, писавший тест, набрал натуральное количество баллов. Оказалось, что в каждой школе средний балл за тест был целым числом. После этого один из учащихся, писавших тест, перешёл из школы №1 в школу №2, а средние баллы за тест были пересчитаны в обеих школах.`,
    qa: `Мог ли средний балл в школе №1 ${kTxt}?`,
    qb: `Средний балл в школе №1 ${pctTxt}, средний балл в школе №2 также ${pctTxt}. Мог ли первоначальный средний балл в школе №2 равняться ${B2}?`,
    qc: `Средний балл в школе №1 ${pctTxt}, средний балл в школе №2 также ${pctTxt}. Найдите наименьшее значение первоначального среднего балла в школе №2.`,
    ansA: mode === "drop"
      ? `да, например в школе №1 было 2 учащихся с баллами ${joinRu(exA.s1)} (средний ${sum(exA.s1) / 2}); после ухода учащегося с баллом ${exA.x} средний стал ${sum(exA.s1) - exA.x}, то есть уменьшился в 10 раз`
      : `нет: если в школе №1 было n ≥ 2 учащихся со средним a, то после ухода учащегося с баллом x средний равен (an − x)/(n − 1); равенство (an − x)/(n − 1) = 2a даёт x = a(2 − n) ≤ 0, а балл обязан быть натуральным`,
    ansB: `нет: при каждом числе учащихся школы №1 первоначальный средний балл школы №2 обязан быть кратен одному из чисел ${joinRu(steps)}, а ${B2} — простое число, большее любого из них, и ни на одно из них не делится`,
    ansC: `${bMin}; например: в школе №1 было ${rowC.n} ${plural(rowC.n, "учащийся", "учащихся", "учащихся")} с баллами ${joinRu(exC.s1)} (средний ${rowC.a}), в школе №2 — ${rowC.m} ${plural(rowC.m, "учащийся", "учащихся", "учащихся")} с баллами по ${rowC.b}; переходит учащийся с баллом ${rowC.x}`,
    solution: `Пусть в школе №1 было n учащихся со средним баллом a, в школе №2 — m учащихся со средним b, n + m = ${N}, и перешёл учащийся с баллом x.\nИз определения среднего: (an − x)/(n − 1) = ${mode === "drop" ? "0,9" : "1,1"}a и (bm + x)/(m + 1) = ${mode === "drop" ? "0,9" : "1,1"}b. Отсюда 10x = a·${mode === "drop" ? "(n + 9)" : "(11 − n)"} = b·${mode === "drop" ? "(9 − m)" : "(m + 11)"}.\nВторое равенство показывает, что при фиксированном n величина b обязана быть кратна вполне определённому числу — эти числа равны ${joinRu(steps)}. Значит подходят только такие b, а наименьшее из них равно ${bMin}.\nОно достигается при n = ${rowC.n}, m = ${rowC.m}, a = ${rowC.a}, x = ${rowC.x}.`,
    verify: {
      params, check, solve,
      claims: {
        a: mode === "drop"
          ? { type: "yesno", yes: true, example: exA, target: 10 }
          : { type: "yesno", yes: false, reason: "growth-bound", target: 2 },
        b: { type: "yesno", yes: false, reason: "divisibility", target: B2 },
        c: { type: "extremum", mode: "min", value: bMin, example: exC },
      },
      mustMention: [N, B2, 1, 2, 10],
      extra: [],
      phrases: ["по крайней мере, 2 учащихся", "средний балл за тест был целым числом", "перешёл из школы №1 в школу №2"],
    },
  })
}
export function t19SchoolsDropMin() { return schoolsFamily("drop") }
export function t19SchoolsRiseMin() { return schoolsFamily("rise") }

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 6 (частично). Операции над записью числа: перестановка цифр (#102, #103)
// ═══════════════════════════════════════════════════════════════════════════

// Каждое число равно 10a + b, после перестановки — 10b + a. Если A — сумма первых цифр,
// B — сумма вторых, то S = 10A + B и S′ = 10B + A = 10S − 99A. Набор из k чисел
// с такими A и B существует ⟺ k ≤ A ≤ 9k и k ≤ B ≤ 9k (цифры от 1 до 9).
function swapDigitsFamily(mode) {
  const S = pick(mode === "max" ? [363, 462, 561, 594, 660, 693] : [2970, 3168, 3465, 3762, 4059])
  const okPair = (A) => {
    const B = S - 10 * A
    if (A < 1 || B < 1) return null
    const kLo = Math.max(Math.ceil(A / 9), Math.ceil(B / 9)), kHi = Math.min(A, B)
    return kLo <= kHi ? { A, B, k: kLo } : null
  }
  // в) экстремум S′ = 10S − 99A: максимум при наименьшем допустимом A и наоборот.
  let extA = null
  if (mode === "max") { for (let A = 1; A * 10 < S; A++) if (okPair(A)) { extA = A; break } }
  else { for (let A = Math.floor((S - 1) / 10); A >= 1; A--) if (okPair(A)) { extA = A; break } }
  if (extA === null) return null
  const extS = 10 * S - 99 * extA
  // а) «да»: кратность r, при которой A = S(10 − r)/99 допустимо.
  const rList = mode === "max" ? [3, 4, 5, 6] : [2, 3, 4, 5]
  let rYes = null
  for (const r of rList) {
    const num = mode === "max" ? S * (10 - r) : S * (10 * r - 1)
    const den = mode === "max" ? 99 : 99 * r
    if (num % den !== 0) continue
    const A = num / den
    if (okPair(A)) { rYes = r; break }
  }
  if (rYes === null) return null
  // б) «нет»: та же форма вопроса, но набор невозможен.
  let rNo = null, reasonNo = null
  for (const r of rList) {
    if (r === rYes) continue
    const num = mode === "max" ? S * (10 - r) : S * (10 * r - 1)
    const den = mode === "max" ? 99 : 99 * r
    if (num % den !== 0) { rNo = r; reasonNo = "div99"; break }
    if (!okPair(num / den)) { rNo = r; reasonNo = "digit-bound"; break }
  }
  if (rNo === null) return null

  const mk = (A) => {
    const p = okPair(A)
    if (!p) return null
    const { B, k } = p
    const firsts = spread(A, k), seconds = spread(B, k)
    if (!firsts || !seconds) return null
    if (firsts.some((v) => v > 9) || seconds.some((v) => v > 9)) return null
    return firsts.map((f, i) => 10 * f + seconds[i])
  }
  const aA = mode === "max" ? S * (10 - rYes) / 99 : S * (10 * rYes - 1) / (99 * rYes)
  const exA = mk(aA), exC = mk(extA)
  if (!exA || !exC) return null

  const params = { S, mode, rYes, rNo, extS, extA }
  const rev = (v) => 10 * (v % 10) + Math.floor(v / 10)
  const check = (list, part) => {
    if (!Array.isArray(list) || !list.length) return "пустой набор"
    for (const v of list) {
      if (!Number.isInteger(v) || v < 10 || v > 99) return `${v} не двузначное`
      if (String(v).includes("0")) return `в записи ${v} есть нуль`
    }
    if (sum(list) !== S) return `сумма исходных ${sum(list)}, а не ${S}`
    const S2 = sum(list.map(rev))
    if (part === "a") {
      const need = mode === "max" ? rYes * S : S / rYes
      if (S2 !== need) return `сумма получившихся ${S2}, а не ${need}`
    }
    if (part === "c" && S2 !== extS) return `сумма получившихся ${S2}, а не ${extS}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все пары (A, k) — сумма первых цифр и количество чисел;
    // A ≤ S/10, k ≤ S. Каждая допустимая пара отвечает хотя бы одному набору.
    const vals = new Set()
    for (let A = 1; 10 * A < P.S; A++) {
      const B = P.S - 10 * A
      for (let k = 1; k <= P.S; k++) {
        if (k > A || A > 9 * k || k > B || B > 9 * k) continue
        vals.add(10 * B + A); break
      }
    }
    const arr = [...vals]
    const needYes = P.mode === "max" ? P.rYes * P.S : P.S / P.rYes
    const needNo = P.mode === "max" ? P.rNo * P.S : P.S / P.rNo
    return {
      a: arr.includes(needYes),
      b: Number.isInteger(needNo) && arr.includes(needNo),
      c: P.mode === "max" ? Math.max(...arr) : Math.min(...arr),
    }
  }

  const times = (r) => (mode === "max" ? `в ${r} ${plural(r, "раз", "раза", "раз")} больше` : `в ${r} ${plural(r, "раз", "раза", "раз")} меньше`)
  return item({
    preamble: `На доске написали несколько не обязательно различных двузначных натуральных чисел без нулей в десятичной записи. Сумма этих чисел оказалась равной ${S}. Затем в каждом числе поменяли местами первую и вторую цифры (например, число 17 заменили на число 71).`,
    qa: `Приведите пример исходных чисел, для которых сумма получившихся чисел ровно ${times(rYes)}, чем сумма исходных чисел.`,
    qb: `Могла ли сумма получившихся чисел быть ровно ${times(rNo)}, чем сумма исходных чисел?`,
    qc: `Найдите ${mode === "max" ? "наибольшее" : "наименьшее"} возможное значение суммы получившихся чисел.`,
    ansA: `числа ${compactSum(exA, ", ")}: их сумма равна ${S}, а после перестановки цифр получаются ${compactSum(exA.map(rev), ", ")} с суммой ${sum(exA.map(rev))}`,
    ansB: reasonNo === "div99"
      ? `нет: если A — сумма первых цифр, а B — сумма вторых, то S = 10A + B и S′ = 10B + A, откуда S′ = 10S − 99A; требуемое значение S′ даёт для A нецелое число`
      : `нет: из S′ = 10S − 99A получаем A = ${mode === "max" ? S * (10 - rNo) / 99 : S * (10 * rNo - 1) / (99 * rNo)}, а тогда B = ${S - 10 * (mode === "max" ? S * (10 - rNo) / 99 : S * (10 * rNo - 1) / (99 * rNo))}; но каждая из k цифр не больше 9 и не меньше 1, поэтому нужно одновременно k ≥ A/9 и k ≤ B — а это невозможно`,
    ansC: `${extS}; достигается на наборе ${compactSum(exC, ", ")} (сумма ${S}), который после перестановки цифр даёт ${compactSum(exC.map(rev), ", ")} с суммой ${extS}`,
    solution: `Пусть A — сумма первых цифр всех чисел, B — сумма вторых. Тогда сумма исходных чисел равна 10A + B = ${S}, а сумма получившихся равна 10B + A = 10·${S} − 99A.\nЗначит сумма получившихся чисел однозначно определяется величиной A и убывает при её росте.\nЕсли чисел k, то каждая из k первых цифр лежит между 1 и 9, поэтому k ≤ A ≤ 9k, и то же самое верно для B. Эти неравенства и определяют, какие A допустимы.\n${mode === "max" ? "Наименьшее" : "Наибольшее"} допустимое A равно ${extA}, что даёт ответ ${extS}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: rYes },
        b: { type: "yesno", yes: false, reason: reasonNo, target: rNo },
        c: { type: "value", value: extS, example: exC },
      },
      mustMention: [S, rYes, rNo, 17, 71],
      extra: [],
      phrases: ["двузначных натуральных чисел без нулей", "поменяли местами первую и вторую цифры"],
    },
  })
}
export function t19SwapDigitsMax() { return swapDigitsFamily("max") }
export function t19SwapDigitsMin() { return swapDigitsFamily("min") }
