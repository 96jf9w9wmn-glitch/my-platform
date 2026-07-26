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
const smallest = (n) => `${n} ${plural(n, "наименьшее число", "наименьших числа", "наименьших чисел")}`
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
        if (!Array.isArray(cl.example) || !cl.example.length) return { ok: false, err: `пункт ${part}: «да» без примера` }
        const e = V.check(cl.example, part)
        if (e) return { ok: false, err: `пункт ${part}: пример не проходит check — ${e}` }
      } else if (!cl.reason) return { ok: false, err: `пункт ${part}: «нет» без инварианта` }
    } else if (cl.type === "extremum") {
      if (cl.value !== S[part]) return { ok: false, err: `пункт ${part}: заявлено ${cl.value}, перебор даёт ${S[part]}` }
      const e = V.check(cl.example, part)
      if (e) return { ok: false, err: `пункт ${part}: пример на ${cl.value} не проходит check — ${e}` }
      const step = cl.mode === "max" ? 1 : -1
      if (S[part + "_next"] !== false) return { ok: false, err: `пункт ${part}: перебор не подтвердил, что ${cl.value + step} невозможно` }
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
  ["Доска: набор чисел с ограничением на сумму", [
    ["board-even-or-tail3", "N чисел: чётные или на 3, сумма S → наим. кол-во на 3", t19BoardEvenOrTail3],
    ["board-tail2-tail6", "N чисел на c₁ или c₂, сумма S → наим. кол-во на c₂", t19BoardTail2Tail6],
    ["board-div3-tail4", "Делятся на p и оканчиваются на c → наиб. кол-во при сумме", t19BoardDivTail],
    ["board-digits-1-6", "Запись только из цифр d и d+5 → наим. кол-во при сумме", t19BoardTwoDigits],
    ["board-100-sum", "N различных, сумма S → наим. кол-во кратных d", t19BoardDistinctSum],
  ]],
]

export const GEN19 = META19.flatMap(([, skins]) => skins.map(([, , fn]) => fn))
