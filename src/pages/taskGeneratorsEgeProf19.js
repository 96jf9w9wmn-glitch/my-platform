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
    // по умолчанию числа условия «человеческие» (до 5 знаков); скин может поднять
    // порог явно — например задача про премии оперирует суммой 600 000 рублей
    if (n > (V.maxNumber ?? 99999)) return { ok: false, err: `число ${n} длиннее допустимого (${V.maxNumber ?? 99999})` }
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
    } else if (cl.type === "choice") {
      if (cl.value !== S[part]) return { ok: false, err: `пункт ${part}: заявлено «${cl.value}», перебор даёт «${S[part]}»` }
    } else if (cl.type === "count") {
      if (cl.value !== S[part]) return { ok: false, err: `пункт ${part}: заявлено ${cl.value}, перебор даёт ${S[part]}` }
    } else if (cl.type === "value") {
      if (Math.abs(cl.value - S[part]) > 1e-9) return { ok: false, err: `пункт ${part}: заявлено ${cl.value}, перебор даёт ${S[part]}` }
      const e = V.check(cl.example, part)
      if (e) return { ok: false, err: `пункт ${part}: пример не проходит check — ${e}` }
    } else if (cl.type === "except") {
      // Ответ — БЕСКОНЕЧНОЕ множество вида «все целые, кроме перечисленных».
      // Перебор возвращает список достижимых значений в конечном окне range,
      // и оно обязано в точности совпасть с описанием на этом окне.
      const [lo, hi] = cl.range
      const got = new Set(S[part] || [])
      for (let v = lo; v <= hi; v++) {
        const want = !cl.excluded.includes(v)
        if (want !== got.has(v)) {
          return { ok: false, err: `пункт ${part}: значение ${v} ${want ? "должно быть достижимо, но перебор его не нашёл" : "не должно быть достижимо, но перебор его нашёл"}` }
        }
      }
      for (const [v, ex] of Object.entries(cl.examples || {})) {
        const e = V.check(ex, part)
        if (e) return { ok: false, err: `пункт ${part}: пример для ${v} не проходит check — ${e}` }
      }
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
  ["Средние арифметические набора", [
    ["means-pos-neg", "Целые числа: средние всех / положительных / отрицательных", t19MeansPosNeg],
    ["means-12-overlap", "12 чисел: средние семи наименьших и семи наибольших", t19Means12Overlap],
    ["means-11-overlap", "11 чисел: наибольшее значение S − B", t19MeansHalvesOverlap],
    ["means-three-groups", "Деление на три группы: наим. наибольшее среднее", t19MeansThreeGroups],
    ["means-erase-minus1", "Уменьшили на 1 и стёрли нули: наиб. среднее", t19MeansEraseMinusOne],
    ["means-two-groups-543", "Три сорта чисел в две группы: наиб. (A+B)/2", t19MeansTwoGroups543],
    ["means-odd-median", "Нечётные числа: наибольшее B − A", t19MeansOddMedian],
    ["means-erase-half", "Уменьшили вдвое и стёрли малые: наиб. среднее", t19MeansEraseHalf],
    ["means-iterated-5", "Последовательные усреднения: наиб. целое отношение", t19MeansIterated5],
  ]],
  ["Сравнение групп", [
    ["mushroom-groups", "Мальчики и девочки за грибами: наим. сумма", t19MushroomGroups],
  ]],
  ["Средние в контейнере", [
    ["box-mean-split-max", "Ящик фруктов: наибольшая масса фрукта", t19BoxMeanSplitMax],
    ["box-mean-split-min", "Ящик овощей: наименьшая масса овоща", t19BoxMeanSplitMin],
    ["days-sum-up-count-down", "Дни: сумма растёт, количество убывает", t19DaysSumUpCountDown],
    ["days-max-total-sum", "Дни: наибольшая общая сумма чисел", t19DaysMaxTotalSum],
    ["cards-blue-red", "Синие и красные карточки: наиб. число синих", t19CardsBlueRed],
    ["weights-move-one", "Гирьки 1…N: наиб. число гирек в первой куче", t19WeightsMoveOne],
  ]],
  ["Операции над записью числа", [
    ["swap-digits-max", "Перестановка цифр двузначных → наибольшая новая сумма", t19SwapDigitsMax],
    ["swap-digits-min", "Перестановка цифр двузначных → наименьшая новая сумма", t19SwapDigitsMin],
    ["cross-out-digits", "Вычёркивание цифр до кратности", t19CrossOutDigits],
    ["insert-digit-sums", "Вставка сумм соседних цифр", t19InsertDigitSums],
    ["supersequence-digits", "Наименьшее число, дающее все числа 1…N", t19SupersequenceDigits],
    ["append-instead-multiply", "Приписал вместо умножения: наибольшее N", t19AppendInsteadMultiply],
    ["append-digit-groups", "Приписали цифры к двум группам: наиб. рост суммы", t19AppendDigitGroups],
  ]],
  ["Сюжетные задачи с перебором", [
    ["test-bonus-min", "Тест с добавкой баллов: наим. число участников", t19TestBonusMin],
    ["stones-trucks", "Каменные глыбы: наим. число грузовиков", t19StonesTrucks],
    ["bonus-notes", "Премии купюрами: наиб. число сотрудников", t19BonusNotes],
    ["game-stars", "Звёзды и заряд: число уровней и наиб. очки", t19GameStars],
    ["photos-diff", "Фотографии: делители разницы и наиб. сумма", t19PhotosDiff],
    ["letters-girls", "Письма девушкам: наим. и наиб. размер группы", t19LettersGirls],
    ["rabbits-food", "Кролики и порции: наиб. число кроликов", t19RabbitsFood],
    ["set-avg-below", "33 числа: среднее любых 27 меньше 2", t19SetAvgBelow],
  ]],
  ["Вася и Петя решают сборник", [
    ["vasya-petya-days", "Оба решили сборник: за сколько дней и наим. число задач", t19VasyaPetyaDays],
    ["vasya-petya-diff1", "Первые дни отличаются на задачу: наим. число задач", t19VasyaPetyaDiffOne],
    ["vasya-petya-same-first", "Одинаковые первые дни: за сколько дней Петя", t19VasyaPetyaSameFirst],
    ["vasya-petya-count", "Сколько задач в сборнике и дней у Пети", t19VasyaPetyaCount],
  ]],
  ["Две школы, средний балл", [
    ["schools-drop-min", "Средние упали на 10 % → наим. исходный средний в №2", t19SchoolsDropMin],
    ["schools-rise-min", "Средние выросли на 10 % → наим. исходный средний в №2", t19SchoolsRiseMin],
    ["schools-move-counts", "Переход учащегося: сколько учащихся и наиб. балл", t19SchoolsMoveCounts],
    ["schools-move-max-count", "Переход учащегося: наиб. число учащихся школы №1", t19SchoolsMoveMaxCount],
  ]],
  ["Игры и операции с инвариантом", [
    ["boxes-three", "Три коробки: ход −1, −1, +1 → наибольшее в третьей", t19BoxesThree],
    ["ones-and-plus", "n единиц и знаки «+» → для скольких n сумма достижима", t19OnesAndPlus],
    ["barrels-pour", "Переливания между бочками: наим. число переливаний", t19BarrelsPour],
    ["four-boxes-plus3", "Четыре коробки: −1,−1,−1,+3 → наиб. в первой", t19FourBoxesPlus3],
    ["erase-triples", "Стирание троек с различными суммами", t19EraseTriples],
    ["pair-moves-2a1", "Пара чисел: (a+b, 2a−1) → наим. разность", t19PairMoves],
    ["candy-circle", "Дети по кругу отдают четверть конфет", t19CandyCircle],
  ]],
  ["Прогрессии", [
    ["ap-ends-sum", "АП из натуральных: сумма крайних и наибольшее число членов", t19APEndsSum],
    ["ap-count-by-sum", "n различных натуральных в АП: наибольшее n и все n", t19APCountBySum],
    ["gp-three-digit", "ГП из трёхзначных с первым членом F → наибольший член", t19GPThreeDigit],
    ["prod-gp-subset", "Пять чисел с произведением P: пять/четыре/три в ГП", t19ProdGPSubset],
    ["ap-consecutive-sum", "Сумма ≥3 подряд идущих членов АП: все значения", t19APConsecutiveSum],
  ]],
  ["Алгебраическая теория чисел", [
    ["quadratic-nat-roots", "x² + px + q = 0 с двумя натуральными корнями", t19QuadraticNatRoots],
    ["discriminant-nat", "Дискриминант при натуральных m, n → наименьший", t19DiscriminantNat],
    ["unit-fractions", "Единичные дроби; все пары 1/m + 1/n = 1/N", t19UnitFractions],
    ["sqrt2-approximation", "Приближение √2 двузначными дробями", t19Sqrt2Approximation],
    ["abcd-sum-squares", "a>b>c>d: сумма и a²−b²+c²−d²", t19ABCDSumSquares],
  ]],
  ["Доска: ограничение на попарные произведения", [
    ["prodwin-min-sum", "Произведение любых двух в (lo; hi) → наим. сумма четырёх", t19ProdWindowMinSum],
    ["prodwin-max-sum", "Произведение любых двух в (lo; hi) → наиб. сумма четырёх", t19ProdWindowMaxSum],
  ]],
  ["Цифры: произведение цифр и цепочки сумм цифр", [
    ["four-prod-vs-digitsum", "Четырёхзначное: произведение цифр в k раз больше суммы", t19FourProdVsDigitSum],
    ["digitsum-chain-3", "Тройка n, S(n), S(S(n)): сумма и количество троек", t19DigitSumChain3],
    ["three-over-digitprod", "Частное трёхзначного без нулей и произведения цифр", t19ThreeOverDigitProd],
    ["same-digitsum-parts", "Сумма слагаемых с одинаковой суммой цифр", t19SameDigitSumParts],
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
  ["Две контрольные работы: назван наивысший балл", [
    ["tests-max-of-two-min", "Средний названных: наименьшее S при k писавших обе", t19TestsMaxOfTwoMin],
    ["tests-max-of-two-count", "Средний названных: наим. число писавших обе", t19TestsMaxOfTwoCount],
  ]],
  ["Доска: набор чисел с ограничением на сумму", [
    ["board-even-or-tail3", "N чисел: чётные или на 3, сумма S → наим. кол-во на 3", t19BoardEvenOrTail3],
    ["board-tail2-tail6", "N чисел на c₁ или c₂, сумма S → наим. кол-во на c₂", t19BoardTail2Tail6],
    ["board-div3-tail4", "Делятся на p и оканчиваются на c → наиб. кол-во при сумме", t19BoardDivTail],
    ["board-digits-1-6", "Запись только из цифр d и d+5 → наим. кол-во при сумме", t19BoardTwoDigits],
    ["board-100-sum", "N различных, сумма S → наим. кол-во кратных d", t19BoardDistinctSum],
    ["board-sum-divisible", "Сумма любых двух делится на одно из остальных", t19BoardSumDivisible],
    ["board-diff-coprime", "Разности: ничего не делится на b−a и не делит b−a", t19BoardDiffCoprime],
    ["board-pair-lt-triple", "Сумма двух меньше суммы трёх → наим. сумма набора", t19PairLtTriple],
    ["board-within-3x", "Любые два отличаются не более чем втрое", t19BoardWithin3x],
    ["board-coprime-6", "Попарно взаимно простые: наименьшая сумма", t19BoardCoprimeSix],
    ["board-red-green", "Красные кратны 7, зелёные кратны 5 → наим. кол-во красных", t19BoardRedGreen],
    ["board-frac-mean", "Дробная часть среднего → наим. среднее", t19BoardFracMean],
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
// «a₁₀» — переменная с нижним индексом (в условиях и ответах вместо a_{10}).
const SUB_DIG = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" }
const aIdx = (n) => "a" + String(n).split("").map((c) => SUB_DIG[c]).join("")
// Десятичная запись с запятой: 13.32 → «13,32».
const ru2 = (x) => String(Math.round(x * 100) / 100).replace(".", ",")
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
        // target пункта а) — всё распределение целиком: иначе оно случайно совпадало
        // бы с числом из пункта б), и проверка невырожденности ложно срабатывала
        a: { type: "yesno", yes: false, reason: "parity", target: `state-${a1}-${b1}-${c1}` },
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

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 10 (частично). Средние арифметические набора (#90, #59)
// ═══════════════════════════════════════════════════════════════════════════

// #90. Целые числа на доске: среднее всех равно m, среднее положительных 2t,
// среднее отрицательных −t. Тогда m·n = 2t·p − t·q = t(2p − q), поэтому t делит m·n;
// при взаимно простых t и m количество чисел n обязано делиться на t — это и определяет n.
export function t19MeansPosNeg() {
  const t = pick([4, 5, 6, 7, 8, 9])
  const m = pick([3, 4, 5, 6, 7, 8, 9].filter((x) => gcdI(x, t) === 1 && t < 2 * x))
  if (!m) return null
  const n = t * randInt(4, 7)
  const L = n - t, R = n + t                     // «более L, но менее R» ⟹ n единственное кратное t
  const D = m * n / t                            // 2p − q = D
  const pMax = Math.floor((n + D) / 3)
  const pMin = Math.ceil(D / 2)
  if (pMax < pMin || D !== Math.round(D)) return null
  if (pMax >= D) return null                     // иначе «каких больше» не определяется однозначно
  const q = 2 * pMax - D, z = n - pMax - q
  if (q < 1 || z < 0) return null
  const pos = spread(2 * t * pMax, pMax)
  const neg = spread(t * q, q)
  if (!pos || !neg || pos.some((v) => v < 1) || neg.some((v) => v < 1)) return null
  const exC = [...pos, ...neg.map((v) => -v), ...Array(z).fill(0)]

  const params = { t, m, n, L, R, pMax }
  const check = (arr, part) => {
    if (!Array.isArray(arr)) return "не набор"
    if (arr.length <= L || arr.length >= R) return `${arr.length} чисел — не строго между ${L} и ${R}`
    for (const v of arr) if (!Number.isInteger(v)) return `${v} не целое`
    if (sum(arr) !== m * arr.length) return `среднее ${sum(arr) / arr.length}, а не ${m}`
    const P = arr.filter((v) => v > 0), Ng = arr.filter((v) => v < 0)
    if (!P.length || !Ng.length) return "нет положительных или отрицательных чисел"
    if (sum(P) !== 2 * t * P.length) return `среднее положительных ${sum(P) / P.length}, а не ${2 * t}`
    if (sum(Ng) !== -t * Ng.length) return `среднее отрицательных ${sum(Ng) / Ng.length}, а не −${t}`
    if (part === "c" && P.length !== pMax) return `положительных ${P.length}, а не ${pMax}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: все тройки (количество положительных p, отрицательных q,
    // нулей z) при общем количестве чисел строго между L и R. Набор с такими
    // количествами существует ⟺ суммы 2t·p и t·q достижимы целыми числами (всегда).
    const ns = new Set(); let best = 0, anyMorePos = true, anyMoreNeg = false
    for (let N = P.L + 1; N < P.R; N++) {
      for (let p = 1; p < N; p++) for (let q = 1; p + q <= N; q++) {
        const z = N - p - q
        if (2 * P.t * p - P.t * q !== P.m * N) continue
        ns.add(N)
        if (p > best) best = p
        if (q >= p) { anyMoreNeg = true; anyMorePos = false }
        void z
      }
    }
    const arr = [...ns]
    return { a: arr.length === 1 ? arr[0] : -1, b: anyMoreNeg && !anyMorePos ? "отрицательных" : "положительных", c: best, c_next: false }
  }

  return item({
    preamble: `На доске написано более ${L}, но менее ${R} целых чисел. Среднее арифметическое этих чисел равно ${m}, среднее арифметическое всех положительных из них равно ${2 * t}, а среднее арифметическое всех отрицательных из них равно −${t}.`,
    qa: `Сколько чисел написано на доске?`,
    qb: `Каких чисел написано больше: положительных или отрицательных?`,
    qc: `Какое наибольшее количество положительных чисел может быть среди них?`,
    ansA: `${n}: если положительных p, отрицательных q, то сумма всех чисел равна ${2 * t}p − ${t}q = ${t}(2p − q) и одновременно ${m}n, поэтому ${t}·(2p − q) = ${m}n; числа ${t} и ${m} взаимно просты, значит n делится на ${t}, а между ${L} и ${R} такое число одно — это ${n}`,
    ansB: `положительных: из ${t}(2p − q) = ${m}·${n} следует 2p − q = ${D}, то есть q = 2p − ${D}; так как нулей не может быть меньше нуля, p ≤ ${pMax}, и тогда p − q = ${D} − p ≥ ${D - pMax} > 0`,
    ansC: `${pMax}; например ${pMax} ${plural(pMax, "положительное число", "положительных числа", "положительных чисел")} со средним ${2 * t}, ${q} ${plural(q, "отрицательное", "отрицательных", "отрицательных")} со средним −${t}${z ? ` и ${z} ${plural(z, "нуль", "нуля", "нулей")}` : ""}; больше нельзя — количество нулей ${n} − p − q = ${n} + ${D} − 3p неотрицательно, откуда p ≤ ${pMax}`,
    solution: `Пусть на доске p положительных, q отрицательных чисел и z нулей, всего n = p + q + z.\nСумма всех чисел равна ${2 * t}p − ${t}q = ${t}(2p − q), и она же равна ${m}n. Значит ${t}(2p − q) = ${m}n; так как НОД(${t}, ${m}) = 1, число n делится на ${t}. Между ${L} и ${R} есть ровно одно такое число — ${n}.\nПодставляя n = ${n}, получаем 2p − q = ${D}, то есть q = 2p − ${D}, а z = ${n} − p − q = ${n} + ${D} − 3p ≥ 0, откуда p ≤ ${pMax}.\nПри этом p − q = ${D} − p ≥ ${D - pMax} > 0, поэтому положительных всегда больше. Наибольшее p равно ${pMax}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "count", value: n },
        b: { type: "choice", value: "положительных" },
        c: { type: "extremum", mode: "max", value: pMax, example: exC },
      },
      mustMention: [L, R, m, 2 * t, t],
      extra: [],
      phrases: ["целых чисел", "Среднее арифметическое этих чисел равно", "среднее арифметическое всех отрицательных"],
    },
  })
}

// #59. 12 различных натуральных: среднее семи наименьших равно m₁, семи наибольших — m₂.
// Семёрки перекрываются по двум числам a₆ и a₇, поэтому сумма всех равна
// 7m₁ + 7m₂ − (a₆ + a₇), и всё сводится к оценке величины S₆₇ = a₆ + a₇:
//   • a₁ + … + a₅ ≥ 15 ⟹ S₆₇ ≤ 7m₁ − 15;
//   • a₈ + … + a₁₂ ≥ 5a₇ + 15 и a₇ ≥ (S₆₇ + 1)/2 ⟹ S₆₇ ≤ (2·7m₂ − 35)/7.
export function t19Means12Overlap() {
  const m1 = randInt(6, 12), m2 = m1 + randInt(4, 10)
  const S1 = 7 * m1, S2 = 7 * m2
  const cap = Math.min(S1 - 15, Math.floor((2 * S2 - 35) / 7))
  if (cap < 12) return null
  // конструкция примера на S₆₇ = cap
  const a7 = Math.ceil((cap + 1) / 2), a6 = cap - a7
  if (a6 < 6 || a6 >= a7) return null
  // пять различных натуральных с суммой S1 − cap и максимумом меньше a₆:
  // начинаем с 1, 2, 3, 4, 5 и поднимаем элементы с конца, соблюдая различие
  const lowInc = [1, 2, 3, 4, 5]
  let extra = S1 - cap - 15
  if (extra < 0) return null
  for (let i = 4; i >= 0 && extra > 0; i--) {
    const lim = (i === 4 ? a6 - 1 : lowInc[i + 1] - 1)
    const add = Math.min(extra, lim - lowInc[i])
    lowInc[i] += add; extra -= add
  }
  if (extra > 0 || lowInc[4] >= a6) return null
  for (let i = 1; i < 5; i++) if (lowInc[i] <= lowInc[i - 1]) return null
  const highBase = S2 - cap - (5 * a7 + 15)
  if (highBase < 0) return null
  const high = [a7 + 1, a7 + 2, a7 + 3, a7 + 4, a7 + 5 + highBase]
  const exC = [...lowInc, a6, a7, ...high]
  const meanNum = S1 + S2 - cap
  // а) — «нет»: семь различных чисел со средним m₂ дают наибольшее не меньше m₂ + 3
  const bigNo = m2 + randInt(0, 2)
  // б) — «нет»: среднее всех, требующее S₆₇ > cap
  let meanNo = Math.floor((S1 + S2 - cap) / 12)
  if (S1 + S2 - 12 * meanNo <= cap) meanNo -= 1
  const S67no = S1 + S2 - 12 * meanNo
  if (S67no <= cap || meanNo < 1) return null

  const params = { m1, m2, S1, S2, cap, bigNo, meanNo }
  const check = (arr, part) => {
    if (!Array.isArray(arr) || arr.length !== 12) return `${arr?.length} чисел вместо 12`
    if (uniq(arr).length !== 12) return "числа не различны"
    for (const v of arr) if (!Number.isInteger(v) || v < 1) return `${v} не натуральное`
    const s = [...arr].sort((x, y) => x - y)
    if (sum(s.slice(0, 7)) !== S1) return `среднее семи наименьших ${sum(s.slice(0, 7)) / 7}, а не ${m1}`
    if (sum(s.slice(5)) !== S2) return `среднее семи наибольших ${sum(s.slice(5)) / 7}, а не ${m2}`
    if (part === "a" && s[11] !== bigNo) return `наибольшее ${s[11]}, а не ${bigNo}`
    if (part === "b" && sum(s) !== 12 * meanNo) return `среднее всех ${sum(s) / 12}, а не ${meanNo}`
    if (part === "c" && sum(s) !== meanNum) return `сумма ${sum(s)}, а не ${meanNum}`
    return null
  }
  const solve = (P) => {
    // Пространство перебора: пары (a₆, a₇) с a₆ < a₇ ≤ 7m₁; для каждой пары наличие
    // пяти различных натуральных, меньших a₆, с нужной суммой, проверяется динамикой,
    // а пять чисел, больших a₇, существуют ⟺ их сумма не меньше 5a₇ + 15.
    const V = P.S1
    const dpLow = []                              // dpLow[v] — 5 различных из 1…v
    let dp = knap([], 5, P.S1)
    for (let v = 1; v <= V; v++) {
      for (let c = 5; c >= 1; c--) for (let s = P.S1; s >= v; s--) if (dp[c - 1][s - v]) dp[c][s] = 1
      dpLow[v] = dp[5].slice()
    }
    let best = -1, bigOK = false, meanOK = false
    for (let a6 = 6; a6 <= V; a6++) for (let a7 = a6 + 1; a7 <= V; a7++) {
      const rest = P.S1 - a6 - a7
      if (rest < 15 || rest > P.S1) continue
      if (!dpLow[a6 - 1] || !dpLow[a6 - 1][rest]) continue
      const top = P.S2 - a6 - a7
      if (top < 5 * a7 + 15) continue
      const S67 = a6 + a7
      if (S67 > best) best = S67
      if (P.S1 + P.S2 - S67 === 12 * P.meanNo) meanOK = true
      // a₁₂ = bigNo достижимо ⟺ оставшиеся четыре числа различны и лежат строго
      // между a₇ и bigNo: 4a₇ + 10 ≤ top − bigNo ≤ 4·bigNo − 10
      const rem = top - P.bigNo
      if (P.bigNo > a7 && rem >= 4 * a7 + 10 && rem <= 4 * P.bigNo - 10) bigOK = true
    }
    return { a: bigOK, b: meanOK, c: P.S1 + P.S2 - best, c_next: false }
  }

  return item({
    preamble: `На доске написано 12 различных натуральных чисел. Среднее арифметическое семи наименьших из них равно ${m1}, а среднее арифметическое семи наибольших равно ${m2}.`,
    qa: `Может ли наибольшее из этих двенадцати чисел равняться ${bigNo}?`,
    qb: `Может ли среднее арифметическое всех двенадцати чисел равняться ${meanNo}?`,
    qc: `Найдите наименьшее значение среднего арифметического всех двенадцати чисел.`,
    ansA: `нет: если наибольшее число равно M, то семь наибольших различны и не превосходят M, поэтому их сумма не больше M + (M − 1) + … + (M − 6) = 7M − 21; из 7M − 21 ≥ ${S2} следует M ≥ ${m2 + 3}, а ${bigNo} меньше`,
    ansB: `нет: сумма всех двенадцати чисел равна ${S1} + ${S2} − (a₆ + a₇), поэтому среднее ${meanNo} потребовало бы a₆ + a₇ = ${S67no}, а эта сумма не превосходит ${cap}`,
    ansC: `${frPlain(fr(meanNum, 12))} (то есть ${meanNum}/12); пример: ${joinRu(exC)}; меньше нельзя — среднее равно (${S1} + ${S2} − (a₆ + a₇))/12, а a₆ + a₇ ≤ ${cap}`,
    solution: `Расположим числа по возрастанию: a₁ < a₂ < … < a₁₂. Семь наименьших — это a₁…a₇ с суммой ${S1}, семь наибольших — a₆…a₁₂ с суммой ${S2}; они перекрываются по числам a₆ и a₇.\nПоэтому сумма всех двенадцати равна ${S1} + ${S2} − (a₆ + a₇), и минимум среднего достигается при максимуме S₆₇ = a₆ + a₇.\nОценим S₆₇ сверху. Во-первых, a₁ + … + a₅ ≥ 1 + 2 + 3 + 4 + 5 = 15, поэтому S₆₇ ≤ ${S1} − 15. Во-вторых, числа a₈ … a₁₂ различны и больше a₇, значит их сумма не меньше 5a₇ + 15; вместе с a₇ ≥ (S₆₇ + 1)/2 это даёт S₆₇ ≤ ${Math.floor((2 * S2 - 35) / 7)}.\nИтого S₆₇ ≤ ${cap}, и это достигается, например, на наборе ${joinRu(exC)}. Наименьшее среднее равно ${meanNum}/12 = ${frPlain(fr(meanNum, 12))}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: false, reason: "top-bound", target: bigNo },
        b: { type: "yesno", yes: false, reason: "overlap-bound", target: meanNo },
        c: { type: "value", value: meanNum, example: exC },
      },
      mustMention: [12, m1, m2, bigNo, meanNo],
      extra: [7],
      phrases: ["12 различных натуральных чисел", "семи наименьших", "семи наибольших"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 20. Две контрольные работы: назван наивысший балл (#115, #116)
// ═══════════════════════════════════════════════════════════════════════════

// Каждый из N студентов писал одну из двух работ или обе; за работу дают целое число
// баллов от 0 до M; средний балл по КАЖДОЙ работе в отдельности равен m; затем каждый
// назвал наивысший из своих баллов, и среднее названных равно S.
//
// Пусть k — число писавших обе работы, n₁ и n₂ — числа писавших первую и вторую:
//   n₁ + n₂ = N + k,  n₁ ≥ k,  n₂ ≥ k   (отсюда сразу k ≤ N).
// Сумма ВСЕХ выставленных баллов равна m·n₁ + m·n₂ = m(N + k), а сумма названных
// меньше неё ровно на сумму МЕНЬШИХ баллов у писавших обе работы:
//   S·N = m(N + k) − T,   T = Σ min(aᵢ, bᵢ).
// Верхняя граница T (используется для всех «нет» и для оценок):
//   T ≤ Hi(k, n₁, n₂) = min(M·k, m·n₁, m·n₂),
// потому что каждый минимум не больше M, а баллы писавших обе не больше всей суммы
// своей работы. Граница ДОСТИЖИМА: дать всем k общим студентам aᵢ = bᵢ = tᵢ с Σtᵢ = Hi,
// а остаток m·n₁ − Hi ≤ M(n₁ − k) раздать писавшим только первую работу (так же для
// второй). Именно эта конструкция и предъявляется в примерах.

// Разложить total на cnt слагаемых 0…M как можно ровнее (ноль допустим — это баллы).
function spreadCap(total, cnt, M) {
  if (cnt <= 0) return total === 0 ? [] : null
  if (total < 0 || total > cnt * M) return null
  const base = Math.floor(total / cnt), rest = total - base * cnt
  return Array.from({ length: cnt }, (_, i) => base + (i < rest ? 1 : 0))
}

// Наборы (N, m, S, k) для #116, где наименьшее k выражается ТОЧНО: равенство T = M·k
// требует N(m − S) = k(M − m), а достижимость — 20k ≤ m·min(n₁, n₂) при n₁+n₂ = N+k.
// Таблица считается один раз при импорте — внутри генератора перебора нет.
const TESTS_COUNT_TABLE = (() => {
  const rows = []
  for (let m = 13; m <= 17; m++) {
    const d = 20 - m
    for (let N = 24; N <= 40; N++) {
      for (let s = m - 1; s >= Math.max(1, m - 8); s--) {
        const num = N * (m - s)
        if (num % d) continue
        const k = num / d
        if (k < 3 || k > N) continue
        const n1 = Math.floor((N + k) / 2), n2 = N + k - n1
        if (20 * k > Math.min(m * n1, m * n2)) continue     // равенство T = 20k недостижимо
        rows.push({ N, m, s, k })
      }
    }
  }
  return rows
})()

function testsFamily(kind) {
  const M = 20                                   // за работу — от 0 до 20 баллов
  const row = kind === "count" ? pick(TESTS_COUNT_TABLE) : null
  const m = row ? row.m : randInt(13, 17)        // средний балл по каждой работе
  const N = row ? row.N : randInt(24, 40)        // студентов всего
  // Конфигурация «k общих студентов, суммарный минимум T» с наиболее равным делением
  // n₁ и n₂ — при нём граница Hi максимальна.
  const build = (k, T) => {
    const n1 = Math.floor((N + k) / 2), n2 = N + k - n1
    if (n1 < k || n2 < k || n1 < 1 || n2 < 1) return null
    const mins = spreadCap(T, k, M)
    const only1 = spreadCap(m * n1 - T, n1 - k, M)
    const only2 = spreadCap(m * n2 - T, n2 - k, M)
    if (!mins || !only1 || !only2) return null
    return { both: mins.map((t) => [t, t]), only1, only2 }
  }
  const hiOf = (k) => {
    const n1 = Math.floor((N + k) / 2), n2 = N + k - n1
    return Math.min(M * k, m * n1, m * n2)
  }
  // а) S < m: достаточно одного студента, писавшего обе работы на M баллов.
  const exA = build(1, M)
  if (!exA) return null
  const namedA = sum(exA.only1) + sum(exA.only2) + M
  const sA = fr(namedA, N)

  let Sb = 0, kc = 0, sC = null, exC, kb = 0, kMin = 0, Sc = 0
  if (kind === "min") {
    // б) «нет»: S ≥ m − (M − m)k/N ≥ 2m − M, потому что k ≤ N.
    const bound = 2 * m - M                       // при m ≥ 13 и M = 20 это ≥ 6
    Sb = randInt(Math.max(0, bound - 5), bound - 1)
    // в) наименьшее S при заданном числе писавших обе работы
    kc = randInt(4, Math.floor(N / 2))
    const T = hiOf(kc)
    exC = build(kc, T)
    if (!exC) return null
    sC = fr(m * (N + kc) - T, N)
  } else {
    // S и наименьшее k взяты из таблицы: там N(m − S) = k(M − m) выполнено точно.
    Sc = row.s; kMin = row.k
    exC = build(kMin, M * kMin)
    if (!exC) return null
    kb = randInt(2, Math.min(4, kMin - 1))
  }

  const params = { N, m, M, Sb, kc, Sc, kb, kind }
  // check написан по ТЕКСТУ условия: целые баллы 0…M, средний по каждой работе m,
  // названный балл — наибольший из своих.
  const check = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.both) || !Array.isArray(cfg.only1) || !Array.isArray(cfg.only2)) return "нет конфигурации"
    for (const p of cfg.both) if (!Array.isArray(p) || p.length !== 2) return "у писавшего обе работы должно быть два балла"
    const all = [...cfg.only1, ...cfg.only2, ...cfg.both.flat()]
    for (const v of all) if (!Number.isInteger(v) || v < 0 || v > M) return `${v} — не целое число баллов от 0 до ${M}`
    const k = cfg.both.length
    const n1 = cfg.only1.length + k, n2 = cfg.only2.length + k
    const total = cfg.only1.length + cfg.only2.length + k
    if (total !== N) return `студентов ${total} вместо ${N}`
    if (n1 < 1 || n2 < 1) return "одну из работ никто не писал"
    const S1 = sum(cfg.only1) + sum(cfg.both.map((p) => p[0]))
    const S2 = sum(cfg.only2) + sum(cfg.both.map((p) => p[1]))
    if (S1 !== m * n1) return `средний балл за первую работу ${S1 / n1}, а не ${m}`
    if (S2 !== m * n2) return `средний балл за вторую работу ${S2 / n2}, а не ${m}`
    const named = sum(cfg.only1) + sum(cfg.only2) + sum(cfg.both.map((p) => Math.max(p[0], p[1])))
    if (part === "a") return named < m * N ? null : `S = ${named / N}, а нужно меньше ${m}`
    if (kind === "min") {
      if (k !== kc) return `обе работы писали ${k} студентов вместо ${kc}`
      if (named * sC.d !== sC.n * N) return `S = ${named / N}, а заявлено ${frPlain(sC)}`
      return null
    }
    if (named !== Sc * N) return `S = ${named / N}, а по условию ${Sc}`
    if (k !== kMin) return `обе работы писали ${k} студентов вместо ${kMin}`
    return null
  }
  // Независимый перебор: k — число писавших обе работы (0…N, так как n₁+n₂=N+k и nᵢ≥k),
  // n₁ — число писавших первую (k…N+k−1). Множество достижимых T вложено в [0; Hi],
  // поэтому «нет» на этом надмножестве — честное «нет», а найденные границы
  // подтверждаются явной конструкцией из build() через check().
  const solve = (P) => {
    let aYes = false, bYes = false, cMin = Infinity, kBest = Infinity
    for (let k = 0; k <= P.N; k++) {
      let okK = false
      for (let n1 = Math.max(k, 1); n1 <= P.N + k - 1; n1++) {
        const n2 = P.N + k - n1
        if (n2 < k || n2 < 1) continue
        const Hi = Math.min(P.M * k, P.m * n1, P.m * n2)
        if (Hi > P.m * k) aYes = true                       // T > m·k ⟺ S < m
        if (P.kind === "min") {
          const T = P.m * (P.N + k) - P.Sb * P.N            // S = Sb ⟺ ровно такое T
          if (T >= 0 && T <= Hi) bYes = true
          if (k === P.kc) cMin = Math.min(cMin, (P.m * (P.N + k) - Hi) / P.N)
        } else {
          const T = P.m * (P.N + k) - P.Sc * P.N            // S = Sc ⟺ ровно такое T
          if (T >= 0 && T <= Hi) okK = true
        }
      }
      if (P.kind === "count" && okK) {
        if (k === P.kb) bYes = true
        if (k < kBest) kBest = k
      }
    }
    return P.kind === "min"
      ? { a: aYes, b: bYes, c: cMin }
      : { a: aYes, b: bYes, c: kBest, c_next: false }
  }

  const preamble = `Каждый из ${N} студентов писал или одну из двух контрольных работ, или написал обе контрольные работы. За каждую работу можно было получить целое число баллов от 0 до ${M} включительно. По каждой из двух контрольных работ в отдельности средний балл составил ${m}. Затем каждый студент назвал наивысший из своих баллов (если студент писал одну работу, то он назвал балл за неё). Среднее арифметическое названных баллов равно S.`
  // «11 студентов по 14 баллов и 6 студентов по 13 баллов»
  const byScore = (arr) => {
    const g = new Map()
    for (const v of arr) g.set(v, (g.get(v) || 0) + 1)
    return [...g.entries()].map(([v, c]) => `${c} ${plural(c, "студент", "студента", "студентов")} по ${v} ${plural(v, "баллу", "балла", "баллов")}`).join(" и ")
  }
  const exText = (ex, k, val) => {
    const n1 = ex.only1.length + k, n2 = ex.only2.length + k
    const t = ex.both[0][0]
    const only = (arr, which) => (arr.length
      ? `писавшие только ${which} работу набрали в сумме ${sum(arr)} ${plural(sum(arr), "балл", "балла", "баллов")} (${byScore(arr)})`
      : `студентов, писавших только ${which} работу, не было`)
    return `первую работу писали ${n1} ${plural(n1, "студент", "студента", "студентов")}, вторую — ${n2}; обе работы ${plural(k, "писал", "писали", "писали")} ${k} ${plural(k, "студент", "студента", "студентов")}, ${plural(k, "получивший", "получившие", "получившие")} по ${t} ${plural(t, "баллу", "балла", "баллов")} за каждую из двух работ; ${only(ex.only1, "первую")}, ${only(ex.only2, "вторую")}. Средний балл за каждую работу равен ${m}, сумма названных баллов равна ${sum(ex.only1) + sum(ex.only2) + k * t}, поэтому S = ${val}`
  }
  const boundTxt = `S·${N} = ${m}·(${N} + k) − T, где k — число писавших обе работы, а T — сумма меньших баллов этих k студентов`

  return item({
    preamble,
    qa: `Приведите пример, когда S < ${m}.`,
    qb: kind === "min"
      ? `Могло ли значение S быть равным ${Sb}?`
      : `Могло ли оказаться, что только ${kb} ${plural(kb, "студент написал", "студента написали", "студентов написали")} обе контрольные работы, если S = ${Sc}?`,
    qc: kind === "min"
      ? `Какое наименьшее значение могло принимать S, если обе контрольные работы писали ${kc} ${plural(kc, "студент", "студента", "студентов")}?`
      : `Какое наименьшее количество студентов могло написать обе контрольные работы, если S = ${Sc}?`,
    ansA: `да, например: ${exText(exA, 1, frPlain(sA))} < ${m}`,
    ansB: kind === "min"
      ? `нет: ${boundTxt}. Так как каждый меньший балл не больше ${M}, то T ≤ ${M}k, а значит S·${N} ≥ ${m}·${N} − ${M - m}k. Кроме того n₁ + n₂ = ${N} + k и n₁ ≥ k, n₂ ≥ k, откуда k ≤ ${N}. Поэтому S ≥ ${m} − ${M - m} = ${2 * m - M} > ${Sb}`
      : `нет: ${boundTxt}. При S = ${Sc} получаем T = ${N * (m - Sc)} + ${m}k, а из T ≤ ${M}k следует ${N * (m - Sc)} ≤ ${M - m}k, то есть k ≥ ${kMin} > ${kb}`,
    ansC: kind === "min"
      ? `${frPlain(sC)}; например: ${exText(exC, kc, frPlain(sC))}`
      : `${kMin}; например: ${exText(exC, kMin, String(Sc))}`,
    solution: kind === "min"
      ? `Пусть первую работу писали n₁ студентов, вторую — n₂, а обе работы — k студентов. Тогда n₁ + n₂ = ${N} + k, n₁ ≥ k, n₂ ≥ k, поэтому k ≤ ${N}.\nСумма всех выставленных баллов равна ${m}n₁ + ${m}n₂ = ${m}(${N} + k). Названный балл отличается от суммы двух баллов студента, писавшего обе работы, ровно на меньший из них, поэтому ${boundTxt}.\nа) Хватает одного студента, писавшего обе работы на ${M} баллов: S = ${frPlain(sA)} < ${m}.\nб) Так как T ≤ ${M}k и k ≤ ${N}, то S ≥ ${m} − ${M - m} = ${2 * m - M}, а ${Sb} < ${2 * m - M}.\nв) При k = ${kc} величина T не превосходит min(${M}·${kc}; ${m}n₁; ${m}n₂) = ${hiOf(kc)}, причём это значение достигается: ${exText(exC, kc, frPlain(sC))}.\nОтвет: ${frPlain(sC)}.`
      : `Пусть первую работу писали n₁ студентов, вторую — n₂, а обе — k студентов. Тогда n₁ + n₂ = ${N} + k, n₁ ≥ k, n₂ ≥ k.\nСумма всех выставленных баллов равна ${m}(${N} + k), а сумма названных меньше неё на T — сумму меньших баллов у писавших обе работы, поэтому ${boundTxt}.\nПри S = ${Sc} отсюда T = ${m}(${N} + k) − ${Sc}·${N} = ${N * (m - Sc)} + ${m}k. Но каждый меньший балл не больше ${M}, значит T ≤ ${M}k, откуда ${N * (m - Sc)} ≤ ${M - m}k и k ≥ ${kMin}.\nб) ${kb} < ${kMin}, так что столько студентов писать обе работы не могло.\nв) Значение k = ${kMin} достигается: ${exText(exC, kMin, String(Sc))}.\nОтвет: ${kMin}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: m },
        b: kind === "min"
          ? { type: "yesno", yes: false, reason: "score-bound", target: Sb }
          : { type: "yesno", yes: false, reason: "count-bound", target: kb },
        c: kind === "min"
          ? { type: "value", value: frVal(sC), example: exC }
          : { type: "extremum", mode: "min", value: kMin, example: exC },
      },
      mustMention: kind === "min" ? [N, M, m, 0, Sb, kc] : [N, M, m, 0, Sc, kb],
      extra: [],
      phrases: ["или одну из двух контрольных работ", `от 0 до ${M} включительно`, "назвал наивысший из своих баллов"],
    },
  })
}
export function t19TestsMaxOfTwoMin() { return testsFamily("min") }
export function t19TestsMaxOfTwoCount() { return testsFamily("count") }

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 21 (продолжение). Четвёрка a > b > c > d: сумма и знакопеременная
// сумма квадратов (#98)
// ═══════════════════════════════════════════════════════════════════════════

// Ключ: a² − b² + c² − d² = (a − b)(a + b) + (c − d)(c + d) ≥ (a + b) + (c + d) = a+b+c+d,
// причём равенство достигается ТОЛЬКО при a − b = c − d = 1. Тогда a + b и c + d нечётны,
// поэтому их сумма чётна: при нечётной сумме равенство невозможно (пункт б),
// а при чётной сумме S = 2W + 2 получаем a = b + 1, c = d + 1, b + d = W,
// и условие b > c = d + 1 равносильно d ≤ (W − 2)/2 (пункт в).

// Пары (S, Q) с ЕДИНСТВЕННОЙ четвёркой — таблица строится один раз при импорте
// прямым перебором по самим числам a > b > c > d (в solve перебор идёт по другим
// переменным — полусуммам u = a+b и разностям p = a−b, то есть проходы независимы).
const ABCD_UNIQUE = (() => {
  const rows = []
  for (let S = 14; S <= 30; S++) {
    const byQ = new Map()
    for (let d = 1; d <= S; d++) for (let c = d + 1; c <= S; c++) for (let b = c + 1; b <= S; b++) {
      const a = S - b - c - d
      if (a <= b) continue
      const Q = a * a - b * b + c * c - d * d
      if (!byQ.has(Q)) byQ.set(Q, [])
      byQ.get(Q).push([a, b, c, d])
    }
    for (const [Q, quads] of byQ) {
      if (quads.length !== 1) continue
      if (Q <= S || Q > 6 * S) continue                  // «человеческие» числа условия
      if (Q % S) continue                                // в эталоне Q кратно S (16 и 32)
      rows.push({ S, Q, quad: quads[0] })
    }
  }
  return rows
})()

export function t19ABCDSumSquares() {
  const { S: Sa, Q: Qa, quad } = pick(ABCD_UNIQUE)
  const Sb = 2 * randInt(10, 24) + 1                     // нечётная сумма — пункт б)
  const Sc = pick([1200, 1300, 1400, 1500, 1600, 1800, 2000, 2200, 2400])
  const W = Sc / 2 - 1                                   // b + d при a = b+1, c = d+1
  const dMax = Math.floor((W - 2) / 2)                   // b ≥ d + 2
  const exC = [W, W - 1, 2, 1]                           // d = 1: наибольшее возможное a

  const params = { Sa, Qa, Sb, Sc }
  const check = (q, part) => {
    if (!Array.isArray(q) || q.length !== 4) return "нужны четыре числа"
    const [a, b, c, d] = q
    for (const v of q) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное число`
    if (!(a > b && b > c && c > d)) return `нарушено a > b > c > d: ${q.join(" > ")}`
    const S = a + b + c + d, Q = a * a - b * b + c * c - d * d
    const need = part === "a" ? Sa : Sc
    const needQ = part === "a" ? Qa : Sc
    if (S !== need) return `сумма ${S}, а нужно ${need}`
    if (Q !== needQ) return `a² − b² + c² − d² = ${Q}, а нужно ${needQ}`
    return null
  }
  // Независимый перебор: u = a + b (больше половины суммы, так как a > c и b > d),
  // p = a − b ≥ 1. Тогда v = S − u, q = (Q − pu)/v, и числа восстанавливаются
  // однозначно. Условие pu ≤ Q обрывает цикл: при pu > Q величина q отрицательна.
  const enumerate = (S, Q) => {
    const res = []
    for (let u = Math.floor(S / 2) + 1; u <= S - 3; u++) {
      const v = S - u
      for (let p = 1; p * u <= Q; p++) {
        if ((u - p) % 2) continue
        const rem = Q - p * u
        if (rem < v || rem % v) continue
        const qq = rem / v
        if ((v - qq) % 2) continue
        const a = (u + p) / 2, b = (u - p) / 2, c = (v + qq) / 2, d = (v - qq) / 2
        if (d >= 1 && a > b && b > c && c > d) res.push([a, b, c, d])
      }
    }
    return res
  }
  const solve = (P) => ({
    a: enumerate(P.Sa, P.Qa).map((q) => q.join("-")).sort(),
    b: enumerate(P.Sb, P.Sb).length > 0,
    c: uniq(enumerate(P.Sc, P.Sc).map((q) => q[0])).length,
  })

  const key = quad.join("-")
  return item({
    preamble: `Натуральные числа a, b, c и d удовлетворяют условию a > b > c > d.`,
    qa: `Найдите числа a, b, c и d, если a + b + c + d = ${Sa} и a² − b² + c² − d² = ${Qa}.`,
    qb: `Может ли a + b + c + d = ${Sb} и a² − b² + c² − d² = ${Sb}?`,
    qc: `Пусть a + b + c + d = ${Sc} и a² − b² + c² − d² = ${Sc}. Найдите количество возможных значений числа a.`,
    ansA: `a = ${quad[0]}, b = ${quad[1]}, c = ${quad[2]}, d = ${quad[3]}`,
    ansB: `нет: a² − b² + c² − d² = (a − b)(a + b) + (c − d)(c + d) ≥ (a + b) + (c + d) = a + b + c + d, и равенство возможно только при a − b = c − d = 1; тогда a + b = 2b + 1 и c + d = 2d + 1 нечётны, а их сумма чётна — значит нечётное число ${Sb} суммой быть не может`,
    ansC: `${dMax}; крайние случаи — d = 1 (тогда ${exC.join(", ")} и a = ${W}) и d = ${dMax} (тогда a = ${W + 1 - dMax})`,
    solution: `Так как a > b и c > d, то a − b ≥ 1 и c − d ≥ 1, поэтому\na² − b² + c² − d² = (a − b)(a + b) + (c − d)(c + d) ≥ (a + b) + (c + d) = a + b + c + d,\nи равенство достигается тогда и только тогда, когда a − b = c − d = 1.\nа) Перебор пар (a + b, a − b) при a + b + c + d = ${Sa} и a² − b² + c² − d² = ${Qa} даёт единственную четвёрку: a = ${quad[0]}, b = ${quad[1]}, c = ${quad[2]}, d = ${quad[3]}.\nб) Равенство суммы и знакопеременной суммы квадратов требует a = b + 1 и c = d + 1, тогда a + b + c + d = 2(b + d) + 2 — чётное число, а ${Sb} нечётно.\nв) При a + b + c + d = a² − b² + c² − d² = ${Sc} имеем a = b + 1, c = d + 1 и b + d = ${W}. Условие b > c = d + 1 равносильно ${W} − d > d + 1, то есть d ≤ ${dMax}; при этом d ≥ 1. Каждому такому d отвечает своё a = ${W + 1} − d, и все эти значения различны.\nОтвет: ${dMax}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "all", values: [key], examples: { [key]: quad } },
        b: { type: "yesno", yes: false, reason: "parity", target: Sb },
        c: { type: "count", value: dMax },
      },
      mustMention: [Sa, Qa, Sb, Sc],
      extra: [],
      phrases: ["Натуральные числа", "a > b > c > d"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 5 (продолжение). Разложение числа в сумму слагаемых с одинаковой
// суммой цифр (#76)
// ═══════════════════════════════════════════════════════════════════════════

// Ключ — тождество столбика: S(x) + S(y) = S(x + y) + 9c, где c — число переносов.
// Если S(x) = S(y) = s, то 2s = S(N) + 9c, поэтому S(N) + 9c обязано быть чётным.
// Для N вида «цифра d, затем k девяток» переносов не бывает вовсе: в разряде с
// цифрой 9 перенос требует a + b + c₋ = 19, то есть a + b = 19 − c₋; при c₋ = 0 это
// невозможно (максимум 18), значит переносы могли бы идти только цепочкой, начиная
// с самого младшего разряда, где c₋ = 0. Перенос из старшего разряда добавил бы
// сумме лишний разряд. Итак c = 0 и 2s = S(N) = d + 9k — при нечётном d + 9k
// представления нет (пункт б).
//
// Пункт в): n наименьших различных чисел с одинаковой суммой цифр s — это
// s, s + 9, …, s + 9(n − 1) (годится, пока s + 9(n−1) ≤ 10s, то есть s ≥ n − 1),
// их сумма равна n·s + 9n(n−1)/2 и растёт по s, поэтому минимум даёт s = n − 1:
//   M = n(n − 1) + 9n(n − 1)/2 = 11n(n − 1)/2.
const NUM_GEN = { 4: "четырёх", 5: "пяти", 6: "шести", 7: "семи", 8: "восьми" }

export function t19SameDigitSumParts() {
  // а) строим ОТ ОТВЕТА: сначала пара с равными суммами цифр, потом её сумма.
  const s = randInt(8, 20)
  const pool = []
  for (let v = 100; v <= 4000; v++) if (digitSum(v) === s) pool.push(v)
  if (pool.length < 2) return null
  const x = pick(pool)
  const y = pick(pool.filter((v) => v !== x))
  const Na = x + y
  // б) «цифра d и k девяток» с нечётной суммой цифр
  const k = pick([2, 3])
  const d = pick(k === 2 ? [1, 3, 5, 7] : [2, 4, 6, 8])
  const Nb = d * Math.pow(10, k) + (Math.pow(10, k) - 1)
  const SNb = d + 9 * k
  // в) n различных слагаемых с одинаковой суммой цифр
  const n = randInt(4, 8)
  const sC = n - 1
  const partsC = Array.from({ length: n }, (_, i) => sC + 9 * i)
  const M = 11 * n * (n - 1) / 2

  const params = { Na, Nb, n }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || !cfg.length) return "нет набора"
    for (const v of cfg) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное число`
    if (uniq(cfg).length !== cfg.length) return "слагаемые обязаны быть различными"
    const ds = uniq(cfg.map(digitSum))
    if (ds.length !== 1) return `суммы цифр разные: ${cfg.map(digitSum).join(", ")}`
    if (part === "a") {
      if (cfg.length !== 2) return "в пункте а) должно быть два слагаемых"
      if (sum(cfg) !== Na) return `сумма ${sum(cfg)}, а нужно ${Na}`
      return null
    }
    if (cfg.length !== n) return `слагаемых ${cfg.length}, а нужно ${n}`
    if (sum(cfg) !== M) return `сумма ${sum(cfg)}, а заявлено ${M}`
    return null
  }
  // Независимый перебор. а)/б): все разбиения N = x + (N − x) с x < N/2 (равные
  // слагаемые запрещены). в): для КАЖДОЙ суммы цифр берём n наименьших чисел,
  // не превосходящих LIM; если их меньше n, то n-е такое число больше LIM,
  // значит сумма больше LIM и заведомо больше уже найденного минимума (< LIM).
  const solve = (P) => {
    const splittable = (N) => {
      for (let v = 1; v < N / 2; v++) if (digitSum(v) === digitSum(N - v)) return true
      return false
    }
    const LIM = 1000
    const bySum = new Map()
    for (let v = 1; v <= LIM; v++) {
      const ds = digitSum(v)
      if (!bySum.has(ds)) bySum.set(ds, [])
      bySum.get(ds).push(v)
    }
    let best = Infinity
    for (const [, arr] of bySum) {
      if (arr.length < P.n) continue
      best = Math.min(best, sum(arr.slice(0, P.n)))
    }
    return { a: splittable(P.Na), b: splittable(P.Nb), c: best < LIM ? best : -1, c_next: false }
  }

  return item({
    preamble: `Суммой цифр натурального числа называется сумма всех цифр его десятичной записи.`,
    qa: `Можно ли представить число ${Na} в виде суммы двух различных натуральных чисел с одинаковой суммой цифр?`,
    qb: `Можно ли представить число ${Nb} в виде суммы двух различных натуральных чисел с одинаковой суммой цифр?`,
    qc: `Найдите наименьшее натуральное число, которое можно представить в виде суммы ${NUM_GEN[n]} различных натуральных чисел с одинаковой суммой цифр.`,
    ansA: `да: ${Na} = ${x} + ${y}, сумма цифр каждого слагаемого равна ${s}`,
    ansB: `нет: при сложении в столбик S(x) + S(y) = S(x + y) + 9c, где c — число переносов. У числа ${Nb} все разряды, кроме старшего, равны 9, а перенос из разряда с цифрой 9 требует a + b + c₋ = 19, то есть возможен только вслед за переносом из предыдущего разряда; в младшем разряде переноса ещё нет, значит переносов нет вообще, а перенос из старшего разряда добавил бы сумме лишний разряд. Поэтому 2s = S(${Nb}) = ${SNb} — нечётное число, что невозможно`,
    ansC: `${M}; например ${partsC.join(" + ")} = ${M}: слагаемые различны, и сумма цифр каждого равна ${sC}`,
    solution: `Обозначим через S(v) сумму цифр числа v. При сложении в столбик каждый перенос уменьшает сумму цифр на 9, поэтому S(x) + S(y) = S(x + y) + 9c, где c — число переносов.\nа) ${Na} = ${x} + ${y}, причём S(${x}) = S(${y}) = ${s}.\nб) Пусть ${Nb} = x + y и S(x) = S(y) = s. Тогда 2s = ${SNb} + 9c. У числа ${Nb} все разряды, кроме старшего, равны 9: перенос из такого разряда требует a + b + c₋ = 19, то есть при c₋ = 0 нужно a + b = 19 > 18 — невозможно. Значит переносы могли бы идти только цепочкой из младшего разряда, где переноса ещё нет, то есть c = 0. Но тогда 2s = ${SNb} — нечётное число, чего быть не может.\nв) Пусть все слагаемые имеют сумму цифр s. Наименьшие числа с суммой цифр s — это s, s + 9, s + 18, …, поэтому сумма ${NUM_GEN[n]} различных таких чисел не меньше n·s + 9·(1 + 2 + … + (n − 1)) = ${n}s + ${9 * n * (n - 1) / 2}. Эта величина растёт с ростом s, а требование s ≥ ${sC} возникает из того, что чисел вида s + 9i с суммой цифр s ровно s + 1. При s = ${sC} получаем ${M} и набор ${partsC.join(", ")}.\nОтвет: ${M}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: [x, y], target: Na },
        b: { type: "yesno", yes: false, reason: "carry-parity", target: Nb },
        c: { type: "extremum", mode: "min", value: M, example: partsC },
      },
      mustMention: [Na, Nb],
      extra: [],
      phrases: ["различных натуральных чисел с одинаковой суммой цифр"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 3. Доска: сумма любых двух делится на одно из остальных (#85)
// ═══════════════════════════════════════════════════════════════════════════

// На доске число B и ещё не менее двух различных натуральных чисел, все ≤ L;
// сумма любых двух написанных чисел делится на какое-нибудь из ОСТАЛЬНЫХ.
//
// Больших наборов много: если на доске есть 1, 2, 3 и дальше только нечётные числа,
// то сумма любых двух чисел, среди которых нет единицы, делится на 1, сумма единицы
// и нечётного числа чётна и делится на 2, а 1 + 2 = 3 делится на 3 и 1 + 3 = 4 — на 2.
// Поэтому годится любое количество от 4 до 1 + ⌊L/2⌋ (пункты а и б).
// Трёх чисел не хватает: для x < y < z сумма x + y кратна z и меньше 2z, значит
// x + y = z; тогда x + z = 2x + y кратно y и 2x < 2y, значит y = 2x и z = 3x. Число B
// нечётно, не кратно 3 и 3B > L, поэтому в набор {x, 2x, 3x} оно не встраивается.
const NUM_CNT = { 5: "пять", 6: "шесть", 7: "семь", 8: "восемь" }

// Проверка ПО ОПРЕДЕЛЕНИЮ: перебираются все пары написанных чисел.
function boardSumDivCheck(arr, B, L) {
  if (!Array.isArray(arr) || arr.length < 3) return "на доске должно быть не менее трёх чисел"
  for (const v of arr) if (!Number.isInteger(v) || v < 1 || v > L) return `${v} — не натуральное число, не превосходящее ${L}`
  if (uniq(arr).length !== arr.length) return "числа на доске обязаны быть различными"
  if (!arr.includes(B)) return `на доске нет числа ${B}`
  const st = arr.slice().sort((a, b) => a - b)
  for (let i = 0; i < st.length; i++) {
    for (let j = i + 1; j < st.length; j++) {
      const s = st[i] + st[j]
      let ok = false
      for (let t = 0; t < st.length && !ok; t++) if (t !== i && t !== j && s % st[t] === 0) ok = true
      if (!ok) return `сумма ${st[i]} + ${st[j]} = ${s} не делится ни на одно из остальных чисел`
    }
  }
  return null
}

export function t19BoardSumDivisible() {
  const L = pick([3000, 4000, 5000])
  // B нечётно, не кратно 3 и 3B > L — тогда наименьший набор состоит ровно из 4 чисел
  const cands = []
  for (let v = Math.floor(L / 3) + 1; v <= L; v++) if (v % 2 && v % 3) cands.push(v)
  const B = pick(cands)
  const nb = randInt(5, 8)                                  // пункт б): «ровно пять чисел»
  const A = pick([512, 640, 800, 1000, 1024, 1200].filter((v) => v <= L / 2))
  // Примеры строятся снизу: 1, 2, 3, B и дальше нечётные по возрастанию.
  const fill = (cnt) => {
    const s = [1, 2, 3, B]
    for (let v = 5; v <= L && s.length < cnt; v += 2) if (v !== B) s.push(v)
    return s.length === cnt ? s : null
  }
  const exA = fill(A), exB = fill(nb), exC = [1, 2, 3, B]
  if (!exA || !exB) return null

  const params = { B, L, A, nb }
  const check = (cfg, part) => {
    const err = boardSumDivCheck(cfg, B, L)
    if (err) return err
    const need = part === "a" ? A : part === "b" ? nb : 4
    if (cfg.length !== need) return `чисел на доске ${cfg.length}, а нужно ${need}`
    return null
  }
  // Независимая проверка. Для а) и б) собирается ДРУГОЙ набор (нечётные берутся сверху,
  // от L вниз) и проверяется по определению. Для в) перебираются ВСЕ тройки {x, y, B}
  // с x < y ≤ L — без каких-либо предварительных выводов о структуре набора.
  const solve = (P) => {
    const top = (cnt) => {
      const s = [1, 2, 3, P.B]
      for (let v = P.L % 2 ? P.L : P.L - 1; v >= 5 && s.length < cnt; v -= 2) if (v !== P.B) s.push(v)
      return s.length === cnt ? s : null
    }
    const okSet = (cnt) => { const s = top(cnt); return !!s && !boardSumDivCheck(s, P.B, P.L) }
    let triple = false
    for (let x = 1; x <= P.L && !triple; x++) {
      if (x === P.B) continue
      for (let y = x + 1; y <= P.L; y++) {
        if (y === P.B) continue
        let a, b, c                                          // тройка по возрастанию, без аллокаций
        if (P.B < x) { a = P.B; b = x; c = y } else if (P.B < y) { a = x; b = P.B; c = y } else { a = x; b = y; c = P.B }
        if ((a + b) % c === 0 && (a + c) % b === 0 && (b + c) % a === 0) { triple = true; break }
      }
    }
    return { a: okSet(P.A), b: okSet(P.nb), c: triple ? 3 : 4, c_next: false }
  }

  return item({
    preamble: `На доске написано число ${B} и ещё несколько (не менее двух) натуральных чисел, не превосходящих ${L}. Все написанные на доске числа различны. Сумма любых двух из написанных чисел делится на какое-нибудь из остальных.`,
    qa: `Может ли на доске быть написано ровно ${A} ${plural(A, "число", "числа", "чисел")}?`,
    qb: `Может ли на доске быть написано ровно ${NUM_CNT[nb]} чисел?`,
    qc: `Какое наименьшее количество чисел может быть написано на доске?`,
    ansA: `да, например 1, 2, 3 и ещё ${A - 3} ${plural(A - 3, "различное нечётное число", "различных нечётных числа", "различных нечётных чисел")}, среди которых ${B}: сумма двух чисел, ни одно из которых не равно 1, делится на 1; сумма единицы и нечётного числа чётна и делится на 2; наконец, 1 + 2 = 3 делится на 3, а 1 + 3 = 4 делится на 2`,
    ansB: `да, например ${exB.slice().sort((p, q) => p - q).join(", ")}`,
    ansC: `4; например 1, 2, 3, ${B}. Трёх чисел не хватает: если на доске числа x < y < z, то x + y делится на z и 0 < x + y < 2z, поэтому x + y = z; далее x + z = 2x + y делится на y и 0 < 2x < 2y, поэтому y = 2x и z = 3x. Но ${B} нечётно (значит ${B} ≠ 2x), не кратно 3 (значит ${B} ≠ 3x), а при ${B} = x третье число равнялось бы ${3 * B} > ${L}`,
    solution: `а) Возьмём на доске числа 1, 2, 3 и ещё ${A - 3} различных нечётных чисел, среди которых ${B}. Сумма двух чисел, отличных от 1, делится на 1; сумма 1 и нечётного числа чётна и делится на 2; кроме того 1 + 2 = 3 делится на 3, а 1 + 3 = 4 делится на 2. Все условия выполнены, чисел ровно ${A}.\nб) Тот же набор, укороченный до ${NUM_CNT[nb]} чисел: ${exB.slice().sort((p, q) => p - q).join(", ")}.\nв) Пусть на доске ровно три числа x < y < z. Сумма x + y делится на z, но 0 < x + y < 2z, поэтому x + y = z. Сумма x + z = 2x + y делится на y, а 0 < 2x < 2y, поэтому 2x = y, и тогда z = 3x. Значит числа образуют набор {x, 2x, 3x}. Число ${B} нечётно и не кратно 3, поэтому ${B} ≠ 2x и ${B} ≠ 3x; при ${B} = x получилось бы z = ${3 * B} > ${L}. Значит трёх чисел быть не может, а четыре числа возможны: 1, 2, 3, ${B}.\nОтвет: 4.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: A },
        b: { type: "yesno", yes: true, example: exB, target: nb },
        c: { type: "extremum", mode: "min", value: 4, example: exC },
      },
      mustMention: [B, L, A],
      extra: [],
      phrases: ["не менее двух", "числа различны", "делится на какое-нибудь из остальных"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 3 (продолжение). Доска: разности чисел (#119)
// ═══════════════════════════════════════════════════════════════════════════

// N различных натуральных чисел, каждое ≤ L. Для любых написанных a < b и любого
// написанного c: (b − a) ∤ c и c ∤ (b − a).
//
// Три инварианта, из которых складывается ответ:
//   1) разность 1 невозможна: на 1 делится любое написанное число;
//   2) если m — наименьшее написанное число, то никакие два написанных числа не дают
//      одинаковый остаток при делении на m (иначе их разность кратна m, а m написано),
//      поэтому N ≤ m;
//   3) все соседние разности ≥ 2, поэтому N ≤ (L − m)/2 + 1.
// Отсюда N ≤ maxₘ min(m, ⌊(L − m)/2⌋ + 1). Оценка достигается: возьмём все НЕЧЁТНЫЕ
// числа от k до L (L нечётно). Разности чётны, поэтому ни одно (нечётное) написанное
// число на них не делится; наименьшее чётное кратное нечётного c равно 2c, и при
// 3k > L имеем 2c ≥ 2k > L − k — больше любой разности. Значит годится наименьшее
// нечётное k > L/3, а чисел получается (L − k)/2 + 1.

// Точный максимум для МАЛОГО L — полный поиск с отсечением. Используется в solve
// как независимая проверка самой формулы (для L ≈ 20 перебор занимает ~1 мс).
function boardDiffExactMax(L) {
  const okAdd = (cur, v) => {
    const s = [...cur, v]
    for (let i = 0; i < s.length; i++) {
      for (let j = i + 1; j < s.length; j++) {
        const d = s[j] - s[i]
        for (const c of s) if (c % d === 0 || d % c === 0) return false
      }
    }
    return true
  }
  let best = 0
  const dfs = (start, cur) => {
    if (cur.length > best) best = cur.length
    for (let v = start; v <= L; v++) {
      if (cur.length + (L - v + 1) <= best) return
      if (okAdd(cur, v)) { cur.push(v); dfs(v + 1, cur); cur.pop() }
    }
  }
  dfs(1, [])
  return best
}
// Оценка сверху перебором всех возможных наименьших чисел m.
const boardDiffBound = (L, mMax = L) => {
  let b = 0
  for (let m = 1; m <= mMax; m++) b = Math.max(b, Math.min(m, Math.floor((L - m) / 2) + 1))
  return b
}

export function t19BoardDiffCoprime() {
  const L = pick([79, 99, 119, 149])                       // L нечётно
  let k = 1                                                // наименьшее нечётное k > L/3
  while (3 * k <= L) k += 2
  const exC = []
  for (let v = k; v <= L; v += 2) exC.push(v)
  const Nmax = exC.length
  const q = randInt(10, 20)                                // «среди чисел есть q»
  const Nb = randInt(q + 2, Math.max(q + 3, Nmax))         // спрошенное количество — больше q
  // x ЧЁТНОЕ: тогда в парах (x, x+1) и (x+1, x+2) разность 1, а в паре (x, x+2)
  // разность 2 и оба числа чётны — все три случая запрещены (при нечётном x числа
  // x и x+2 нечётны, и такая пара условию НЕ противоречит).
  const x = 2 * randInt(6, Math.floor((L - 3) / 2))

  const params = { L, q, Nb, x }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length < 2) return "нет набора"
    for (const v of cfg) if (!Number.isInteger(v) || v < 1 || v > L) return `${v} — не натуральное число, не превосходящее ${L}`
    if (uniq(cfg).length !== cfg.length) return "числа обязаны быть различными"
    const s = cfg.slice().sort((a, b) => a - b)
    for (let i = 0; i < s.length; i++) {
      for (let j = i + 1; j < s.length; j++) {
        const d = s[j] - s[i]
        for (const c of s) {
          if (c % d === 0) return `${c} делится на разность ${s[j]} − ${s[i]} = ${d}`
          if (d % c === 0) return `${c} — делитель разности ${s[j]} − ${s[i]} = ${d}`
        }
      }
    }
    if (part === "c" && s.length !== Nmax) return `чисел ${s.length}, а заявлено ${Nmax}`
    return null
  }
  // Независимые проходы: а) — прямая проверка всех трёх пар по определению;
  // б) и в) — оценка сверху перебором всех возможных наименьших чисел набора,
  // причём сама формула-оценка сверяется с ПОЛНЫМ поиском на маленьком L.
  const solve = (P) => {
    const L0 = 21 + 2 * (P.L % 4)                          // маленький нечётный аналог
    if (boardDiffExactMax(L0) !== boardDiffBound(L0)) return { a: null, b: null, c: -1, c_next: true }
    let aYes = false
    for (const [u, v] of [[P.x, P.x + 1], [P.x, P.x + 2], [P.x + 1, P.x + 2]]) {
      const d = v - u
      if (u % d === 0 || v % d === 0 || d % u === 0 || d % v === 0) continue
      aYes = true
    }
    return { a: aYes, b: P.Nb <= boardDiffBound(P.L, P.q), c: boardDiffBound(P.L), c_next: false }
  }

  return item({
    preamble: `На доске написано N различных натуральных чисел, каждое из которых не превосходит ${L}. Для любых двух написанных на доске чисел a и b, таких что a < b, ни одно из написанных чисел не делится на b − a, и ни одно из написанных чисел не является делителем числа b − a.`,
    qa: `Могли ли на доске быть написаны какие-то два числа из чисел ${x}, ${x + 1} и ${x + 2}?`,
    qb: `Среди написанных на доске чисел есть ${q}. Может ли N быть равно ${Nb}?`,
    qc: `Найдите наибольшее значение N.`,
    ansA: `нет: у пар ${x} и ${x + 1}, ${x + 1} и ${x + 2} разность равна 1, а на 1 делится любое написанное число; у пары ${x} и ${x + 2} разность равна 2, но оба этих числа чётны и делятся на 2`,
    ansB: `нет: если m — наименьшее из написанных чисел, то никакие два написанных числа не дают одинаковый остаток при делении на m (иначе их разность делилась бы на m, а m написано на доске), поэтому N ≤ m. Число ${q} написано, значит m ≤ ${q} и N ≤ ${q} < ${Nb}`,
    ansC: `${Nmax}; например все нечётные числа от ${k} до ${L}`,
    solution: `Пусть m — наименьшее из написанных чисел.\nа) Разность любых двух из чисел ${x}, ${x + 1}, ${x + 2} равна 1 или 2. Если разность равна 1, то на неё делится любое написанное число. Разность 2 даёт только пара ${x} и ${x + 2}, но оба этих числа чётны, то есть делятся на свою разность. В каждом случае условие нарушено, поэтому двух таких чисел на доске быть не может.\nб) Если два написанных числа дают одинаковый остаток при делении на m, то их разность делится на m — но m само написано на доске, что запрещено. Значит все написанные числа дают разные остатки при делении на m, откуда N ≤ m. Так как ${q} написано, m ≤ ${q}, поэтому N ≤ ${q}, и N = ${Nb} невозможно.\nв) Кроме N ≤ m, разность соседних написанных чисел не меньше 2 (разность 1 запрещена), поэтому N ≤ (${L} − m)/2 + 1. Перебирая m, получаем N ≤ ${Nmax}.\nЭто значение достигается: возьмём все нечётные числа от ${k} до ${L} — их ровно ${Nmax}. Все разности чётны, поэтому ни одно из (нечётных) написанных чисел на них не делится; наименьшее чётное кратное написанного числа c равно 2c ≥ ${2 * k} и превосходит любую разность (она не больше ${L - k}), поэтому ни одно написанное число не является делителем разности.\nОтвет: ${Nmax}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: false, reason: "small-difference", target: `triple-${x}` },
        b: { type: "yesno", yes: false, reason: "residues-mod-min", target: Nb },
        c: { type: "extremum", mode: "max", value: Nmax, example: exC },
      },
      mustMention: [L, q, Nb, x, x + 1, x + 2],
      extra: [],
      phrases: ["различных натуральных чисел", "не является делителем"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 1 (продолжение). Набор с ограничением на суммы и на отношение (#43, #42)
// ═══════════════════════════════════════════════════════════════════════════

// #43. N различных натуральных чисел a₁ < … < a_N; сумма любых двух меньше суммы
// любых трёх. Это в точности одно неравенство: a_{N−1} + a_N < a₁ + a₂ + a₃.
// Так как a_{N−1} ≥ a₃ + (N − 4) и a_N ≥ a₃ + (N − 3), получаем
//   2a₃ + 2N − 7 < a₁ + a₂ + a₃, то есть a₃ + 2N − 7 < a₁ + a₂ ≤ 2a₃ − 3,
// откуда a₃ ≥ 2N − 3 и a₁ ≥ 2N − 5. Набор из N подряд идущих чисел, начиная с 2N − 5,
// условию удовлетворяет, поэтому наименьшая сумма равна N(2N − 5) + N(N − 1)/2.
export function t19PairLtTriple() {
  const N = randInt(9, 13)
  const lo = 2 * N - 5                                     // наименьшее допустимое число
  const minSum = N * lo + N * (N - 1) / 2
  const Xa = 100 * randInt(5, 40)                          // большое число — пункт а)
  const Xb = randInt(Math.max(2, lo - 6), lo - 1)          // маленькое число — пункт б)
  const exA = Array.from({ length: N }, (_, i) => Xa + i)  // Xa — наименьшее в наборе
  const exC = Array.from({ length: N }, (_, i) => lo + i)

  const params = { N, Xa, Xb, lo }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length !== N) return `в наборе должно быть ${N} чисел`
    for (const v of cfg) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное число`
    if (uniq(cfg).length !== cfg.length) return "числа набора обязаны быть различными"
    const s = cfg.slice().sort((a, b) => a - b)
    if (s[N - 2] + s[N - 1] >= s[0] + s[1] + s[2]) {
      return `сумма двух наибольших ${s[N - 2]} + ${s[N - 1]} не меньше суммы трёх наименьших ${s[0]} + ${s[1]} + ${s[2]}`
    }
    if (part === "a" && !cfg.includes(Xa)) return `в наборе нет числа ${Xa}`
    if (part === "c" && sum(cfg) !== minSum) return `сумма набора ${sum(cfg)}, а заявлено ${minSum}`
    return null
  }
  // Независимый перебор по тройкам наименьших чисел. Увеличение любого элемента,
  // кроме трёх наименьших, только увеличивает сумму двух наибольших и не меняет сумму
  // трёх наименьших, поэтому достаточно дополнять тройку подряд идущими числами
  // a₃+1, …, a₃+N−3 — это наилучшее возможное завершение. Окно перебора: a₂ и a₃
  // в пределах 3N от предыдущего числа; дальше неравенство только ужесточается
  // (при a₃ = a₂ + 1 условие превращается в a₁ ≥ 2N − 5 и от a₂ не зависит).
  const solve = (P) => {
    const feasible = (a1) => {
      for (let a2 = a1 + 1; a2 <= a1 + 3 * P.N; a2++) {
        for (let a3 = a2 + 1; a3 <= a2 + 3 * P.N; a3++) {
          const last2 = (a3 + P.N - 4) + (a3 + P.N - 3)
          if (last2 < a1 + a2 + a3) return true
        }
      }
      return false
    }
    let best = -1
    for (let a1 = 1; a1 <= P.Xa; a1++) if (feasible(a1)) { best = a1; break }
    const minTotal = best < 0 ? -1 : P.N * best + P.N * (P.N - 1) / 2
    return { a: feasible(P.Xa), b: feasible(P.Xb), c: minTotal, c_next: false }
  }

  return item({
    preamble: `Про некоторый набор, состоящий из ${N} различных натуральных чисел, известно, что сумма любых двух различных чисел этого набора меньше суммы любых трёх различных чисел этого набора.`,
    qa: `Может ли одним из этих чисел быть число ${Xa}?`,
    qb: `Может ли одним из этих чисел быть число ${Xb}?`,
    qc: `Какое наименьшее возможное значение может принимать сумма чисел такого набора?`,
    ansA: `да, например ${Xa}, ${Xa + 1}, …, ${Xa + N - 1}: сумма двух наибольших равна ${exA[N - 2] + exA[N - 1]}, а сумма трёх наименьших — ${exA[0] + exA[1] + exA[2]}`,
    ansB: `нет: для упорядоченного набора a₁ < a₂ < … < ${aIdx(N)} условие равносильно неравенству ${aIdx(N - 1)} + ${aIdx(N)} < a₁ + a₂ + a₃. Так как ${aIdx(N - 1)} ≥ a₃ + ${N - 4} и ${aIdx(N)} ≥ a₃ + ${N - 3}, получаем a₃ + ${2 * N - 7} < a₁ + a₂; но a₁ + a₂ ≤ (a₃ − 2) + (a₃ − 1), откуда a₃ ≥ ${2 * N - 3} и a₁ ≥ ${lo}. Значит число ${Xb} < ${lo} в наборе стоять не может`,
    ansC: `${minSum}; например ${lo}, ${lo + 1}, …, ${lo + N - 1}`,
    solution: `Пусть числа набора упорядочены: a₁ < a₂ < … < ${aIdx(N)}. Наибольшая сумма двух чисел — это ${aIdx(N - 1)} + ${aIdx(N)}, наименьшая сумма трёх — это a₁ + a₂ + a₃, поэтому условие равносильно неравенству ${aIdx(N - 1)} + ${aIdx(N)} < a₁ + a₂ + a₃.\nа) Возьмём ${N} подряд идущих чисел ${Xa}, ${Xa + 1}, …, ${Xa + N - 1}: ${exA[N - 2]} + ${exA[N - 1]} = ${exA[N - 2] + exA[N - 1]} < ${exA[0] + exA[1] + exA[2]} = ${exA[0]} + ${exA[1]} + ${exA[2]}.\nб) Числа различны, поэтому ${aIdx(N - 1)} ≥ a₃ + ${N - 4} и ${aIdx(N)} ≥ a₃ + ${N - 3}. Подставляя, получаем 2a₃ + ${2 * N - 7} < a₁ + a₂ + a₃, то есть a₃ + ${2 * N - 7} < a₁ + a₂. С другой стороны a₁ + a₂ ≤ (a₃ − 2) + (a₃ − 1) = 2a₃ − 3, откуда a₃ > ${2 * N - 4}, а тогда a₁ > a₃ + ${2 * N - 7} − a₂ ≥ ${2 * N - 6}. Итак все числа набора не меньше ${lo}, и число ${Xb} в наборе быть не может.\nв) Из a₁ ≥ ${lo} и различности чисел сумма не меньше ${lo} + ${lo + 1} + … + ${lo + N - 1} = ${minSum}. Это значение достигается на самом наборе ${lo}, ${lo + 1}, …, ${lo + N - 1}.\nОтвет: ${minSum}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: Xa },
        b: { type: "yesno", yes: false, reason: "min-element-bound", target: Xb },
        c: { type: "extremum", mode: "min", value: minSum, example: exC },
      },
      mustMention: [N, Xa, Xb],
      extra: [],
      phrases: ["различных натуральных чисел", "меньше суммы любых трёх"],
    },
  })
}

// #42. Несколько (более одного) различных натуральных чисел, любые два отличаются
// не более чем в r раз, то есть max ≤ r·min. Если наименьшее число равно m, то все
// числа лежат в [m; rm], поэтому n различных чисел существуют лишь при rm − m + 1 ≥ n,
// а их сумма лежит между nm + n(n−1)/2 и n·rm − n(n−1)/2, причём каждое промежуточное
// значение достижимо (соседние наборы отличаются сдвигом одного числа на 1).
// Отсюда «нет» в пункте б): наименьшая возможная сумма n чисел равна
//   min_m (nm + n(n−1)/2) при m ≥ ⌈(n−1)/(r−1)⌉,
// и достаточно взять сумму на единицу меньше.
const PRODUCT_TASK = [8000, 27000, 64000, 3375, 4000]

export function t19BoardWithin3x() {
  const r = 3
  const nb = randInt(8, 12)                                  // пункт б): столько чисел
  const mMin = Math.ceil((nb - 1) / (r - 1))                 // иначе n различных не помещаются в [m; rm]
  const Sb = nb * mMin + nb * (nb - 1) / 2 - 1               // на 1 меньше минимально возможной суммы
  const na = randInt(4, 6)                                   // пункт а): столько чисел
  // сумма для а) берётся заведомо достижимой: середина отрезка [minSum; maxSum] при m
  const ma = Math.max(Math.ceil((na - 1) / (r - 1)), 4)
  const loA = na * ma + na * (na - 1) / 2
  const hiA = na * r * ma - na * (na - 1) / 2
  const Sa = randInt(loA, Math.min(hiA, loA + 3 * na))
  // набор для а): начинаем с m, m+1, …, m+na−1 и поднимаем старшие числа до r·m
  const exA = Array.from({ length: na }, (_, i) => ma + i)
  // излишек суммы раздаём сверху вниз: каждое число поднимаем максимум до соседа − 1
  // (самое большое — до r·m), поэтому числа остаются различными и не выходят из окна
  let extra = Sa - loA
  for (let i = na - 1; i >= 0 && extra > 0; i--) {
    const cap = (i === na - 1 ? r * ma : exA[i + 1] - 1) - exA[i]
    const add = Math.min(extra, cap)
    exA[i] += add
    extra -= add
  }
  if (extra !== 0) return null
  const P = pick(PRODUCT_TASK)

  // Все количества чисел, произведение которых равно P (перебор по наименьшему числу
  // набора и подмножествам делителей, попавших в окно [m; rm]).
  const divs = []
  for (let i = 1; i * i <= P; i++) if (P % i === 0) { divs.push(i); if (i !== P / i) divs.push(P / i) }
  divs.sort((a, b) => a - b)
  const byCount = new Map()
  for (const m of divs) {
    const rest = divs.filter((v) => v > m && v <= r * m)
    for (let mask = 0; mask < (1 << rest.length); mask++) {
      let prod = m, set = [m]
      for (let i = 0; i < rest.length; i++) if (mask & (1 << i)) { prod *= rest[i]; set.push(rest[i]) }
      if (prod === P && set.length >= 2 && !byCount.has(set.length)) byCount.set(set.length, set)
    }
  }
  const counts = [...byCount.keys()].sort((a, b) => a - b)
  if (!counts.length) return null
  const examples = {}
  for (const c of counts) examples[c] = byCount.get(c)

  const params = { r, na, Sa, nb, Sb, P }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length < 2) return "на доске должно быть более одного числа"
    for (const v of cfg) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное число`
    if (uniq(cfg).length !== cfg.length) return "числа обязаны быть различными"
    const mn = Math.min(...cfg), mx = Math.max(...cfg)
    if (mx > r * mn) return `числа ${mn} и ${mx} отличаются больше чем в ${r} раза`
    if (part === "a") {
      if (cfg.length !== na) return `чисел ${cfg.length}, а нужно ${na}`
      if (sum(cfg) !== Sa) return `сумма ${sum(cfg)}, а нужно ${Sa}`
      return null
    }
    if (cfg.reduce((p, v) => p * v, 1) !== P) return `произведение ${cfg.reduce((p, v) => p * v, 1)}, а нужно ${P}`
    return null
  }
  // Независимые проходы: для а)/б) — динамика по количеству и сумме (какие суммы
  // вообще достижимы n различными числами из окна [m; rm]); для в) — рекурсивный
  // подбор делителей по возрастанию с отсечением по верхней границе окна.
  const solve = (Pm) => {
    const reachable = (n, S) => {
      for (let m = 1; m * n <= S; m++) {
        const hi = Pm.r * m
        if (hi - m + 1 < n) continue
        const items = []
        for (let v = m; v <= hi && v <= S; v++) items.push(v)
        const rows = knap(items, n, S)
        if (rows[n] && rows[n][S]) return true
      }
      return false
    }
    // в): рекурсивный подбор делителей по возрастанию. Множители обязаны делить P
    // (иначе произведение не сойдётся) и лежать в окне [m; r·m], где m — первый
    // выбранный (он же наименьший) множитель, поэтому цикл обрывается за границей окна.
    const sizes = new Set()
    const dv = []
    for (let v = 1; v <= Pm.P; v++) if (Pm.P % v === 0) dv.push(v)
    const dfs = (i, prod, cnt, mn) => {
      if (prod === Pm.P && cnt >= 2) sizes.add(cnt)
      for (let j = i; j < dv.length; j++) {
        const v = dv[j]
        const nmn = mn || v
        if (v > Pm.r * nmn) break
        if ((Pm.P / prod) % v) continue
        dfs(j + 1, prod * v, cnt + 1, nmn)
      }
    }
    dfs(0, 1, 0, 0)
    return { a: reachable(Pm.na, Pm.Sa), b: reachable(Pm.nb, Pm.Sb), c: [...sizes].sort((x, y) => x - y) }
  }

  return item({
    preamble: `На доске написано несколько (более одного) различных натуральных чисел, причём любые два из них отличаются не более чем в три раза.`,
    qa: `Может ли на доске быть ${na} ${plural(na, "число", "числа", "чисел")}, сумма которых равна ${Sa}?`,
    qb: `Может ли на доске быть ${nb} ${plural(nb, "число", "числа", "чисел")}, сумма которых равна ${Sb}?`,
    qc: `Сколько может быть чисел на доске, если их произведение равно ${P}?`,
    ansA: `да, например ${exA.slice().sort((a, b) => a - b).join(", ")}`,
    ansB: `нет: если наименьшее из написанных чисел равно m, то все числа лежат между m и ${r}m, поэтому ${nb} различных чисел найдётся лишь при ${r}m − m + 1 ≥ ${nb}, то есть при m ≥ ${mMin}. Тогда сумма не меньше ${nb}m + ${nb * (nb - 1) / 2} ≥ ${Sb + 1} > ${Sb}`,
    ansC: `${joinRu(counts)}; например ${counts.map((c) => `${c}: ${examples[c].join(" · ")}`).join("; ")}`,
    solution: `Пусть наименьшее из написанных чисел равно m. Тогда все числа лежат в промежутке от m до ${r}m.\nа) Пример: ${exA.slice().sort((a, b) => a - b).join(", ")} — все числа различны, наибольшее не больше ${r}m, сумма равна ${Sa}.\nб) Чтобы на доске поместилось ${nb} различных чисел, нужно ${r}m − m + 1 ≥ ${nb}, то есть m ≥ ${mMin}. Наименьшая возможная сумма ${nb} различных чисел, не меньших m, равна ${nb}m + ${nb * (nb - 1) / 2} и при m ≥ ${mMin} не меньше ${Sb + 1}. Значит сумма ${Sb} невозможна.\nв) Разложим ${P} на различные множители, лежащие в промежутке от m до ${r}m. Возможные количества: ${joinRu(counts)}${counts.map((c) => `\n   ${c}: ${examples[c].join(" · ")} = ${P}`).join("")}.\nОтвет: ${joinRu(counts)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: Sa },
        b: { type: "yesno", yes: false, reason: "min-sum-bound", target: Sb },
        c: { type: "all", values: counts, examples },
      },
      mustMention: [na, Sa, nb, Sb, P],
      extra: [],
      phrases: ["различных натуральных чисел", "не более чем в три раза"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 1 (продолжение). Попарно взаимно простые числа (#55)
// ═══════════════════════════════════════════════════════════════════════════

// n различных натуральных чисел, никакие два не имеют общего делителя, большего 1.
// Чётным может быть не более одного числа (два чётных делятся на 2), поэтому
// количество нечётных равно n или n − 1, и сумма сравнима с n или с n − 1 по модулю 2.
// Если S ≡ n (mod 2), то чётных чисел нет вовсе, и сумма не меньше минимальной суммы
// n попарно взаимно простых НЕЧЁТНЫХ чисел — она заметно больше общего минимума.
// Минимумы считаются один раз при импорте полным поиском с отсечением по сумме.
const COPRIME_MIN = (() => {
  const g = (a, b) => { while (b) { [a, b] = [b, a % b] } return a }
  const best = (n, oddOnly) => {
    let bs = Infinity, set = null
    const dfs = (start, cur, s) => {
      if (s >= bs) return
      if (cur.length === n) { bs = s; set = [...cur]; return }
      for (let v = start; v <= 60; v++) {
        if (oddOnly && v % 2 === 0) continue
        if (cur.every((u) => g(u, v) === 1)) { cur.push(v); dfs(v + 1, cur, s + v); cur.pop() }
      }
    }
    dfs(1, [], 0)
    return { sum: bs, set }
  }
  const map = new Map()
  for (const n of [5, 6, 7]) map.set(n, { all: best(n, false), odd: best(n, true) })
  return map
})()

export function t19BoardCoprimeSix() {
  const n = pick([5, 6, 7])
  const NUM_WORD = { 5: "Пять", 6: "Шесть", 7: "Семь" }
  const { all, odd } = COPRIME_MIN.get(n)
  // а) строим ОТ ОТВЕТА: 1, 2, 3, 5 и два простых числа
  const base = [1, 2, 3, 5, 7, 11].slice(0, n - 2)          // n − 2 числа основы
  const PR = [7, 11, 13, 17, 19, 23, 29, 31].filter((v) => !base.includes(v))
  const i1 = randInt(0, PR.length - 2), i2 = randInt(i1 + 1, PR.length - 1)
  const exA = [...base, PR[i1], PR[i2]]
  const Sa = sum(exA)
  // б) «нет»: сумма той же чётности, что n, лежащая строго между двумя минимумами
  const cand = []
  for (let S = all.sum + 1; S < odd.sum; S++) if ((S - n) % 2 === 0) cand.push(S)
  if (!cand.length) return null
  const Sb = pick(cand)

  const params = { n, Sa, Sb }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length !== n) return `чисел должно быть ${n}`
    for (const v of cfg) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное число`
    if (uniq(cfg).length !== cfg.length) return "числа обязаны быть различными"
    for (let i = 0; i < cfg.length; i++) {
      for (let j = i + 1; j < cfg.length; j++) {
        const d = gcdI(cfg[i], cfg[j])
        if (d > 1) return `${cfg[i]} и ${cfg[j]} имеют общий делитель ${d}`
      }
    }
    const need = part === "a" ? Sa : part === "b" ? Sb : all.sum
    if (sum(cfg) !== need) return `сумма ${sum(cfg)}, а нужно ${need}`
    return null
  }
  // Независимый перебор: DFS по возрастанию с отсечением «сумма уже больше нужной».
  // Пространство конечно: каждое число не превосходит требуемой суммы.
  const solve = (P) => {
    const exists = (S) => {
      let ok = false
      const dfs = (start, cur, s) => {
        if (ok) return
        if (cur.length === P.n) { if (s === S) ok = true; return }
        for (let v = start; s + v <= S; v++) {
          if (cur.every((u) => gcdI(u, v) === 1)) { cur.push(v); dfs(v + 1, cur, s + v); cur.pop() }
          if (ok) return
        }
      }
      dfs(1, [], 0)
      return ok
    }
    let mn = Infinity
    const dfsMin = (start, cur, s) => {
      if (s >= mn) return
      if (cur.length === P.n) { mn = s; return }
      for (let v = start; v <= 60; v++) {
        if (cur.every((u) => gcdI(u, v) === 1)) { cur.push(v); dfsMin(v + 1, cur, s + v); cur.pop() }
      }
    }
    dfsMin(1, [], 0)
    return { a: exists(P.Sa), b: exists(P.Sb), c: mn, c_next: false }
  }

  return item({
    preamble: `${NUM_WORD[n]} различных натуральных чисел таковы, что никакие два из них не имеют общего делителя, большего 1.`,
    qa: `Может ли сумма этих чисел быть равной ${Sa}?`,
    qb: `Может ли сумма этих чисел быть равной ${Sb}?`,
    qc: `Какова их минимальная сумма?`,
    ansA: `да, например ${exA.join(", ")}`,
    ansB: `нет: среди попарно взаимно простых чисел не более одного чётного, поэтому нечётных чисел либо ${n}, либо ${n - 1}, и сумма сравнима с ${n} или с ${n - 1} по модулю 2. Число ${Sb} сравнимо с ${n}, значит все ${n} чисел нечётны, а наименьшая сумма ${n} попарно взаимно простых нечётных чисел равна ${odd.sum} (набор ${odd.set.join(", ")}) — больше, чем ${Sb}`,
    ansC: `${all.sum}; например ${all.set.join(", ")}`,
    solution: `Никакие два числа не имеют общего делителя, большего 1, поэтому среди них не более одного чётного.\nа) Пример: ${exA.join(", ")} — числа попарно взаимно просты, их сумма равна ${Sa}.\nб) Если чётного числа нет, то все ${n} слагаемых нечётны и сумма сравнима с ${n} по модулю 2; если чётное число одно, то сумма сравнима с ${n - 1}. Число ${Sb} сравнимо с ${n} по модулю 2, поэтому все числа обязаны быть нечётными. Но наименьшая сумма ${n} различных попарно взаимно простых нечётных чисел равна ${odd.sum} (это набор ${odd.set.join(", ")}), а ${Sb} < ${odd.sum}.\nв) Наименьшая сумма достигается на наборе ${all.set.join(", ")} и равна ${all.sum}: единица взаимно проста со всеми, а остальные числа — различные простые, и заменить любое из них меньшим числом нельзя.\nОтвет: ${all.sum}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: Sa },
        b: { type: "yesno", yes: false, reason: "parity-and-odd-min", target: Sb },
        c: { type: "extremum", mode: "min", value: all.sum, example: all.set },
      },
      mustMention: [Sa, Sb, 1],
      extra: [],
      phrases: ["различных натуральных чисел", "не имеют общего делителя, большего 1"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 1 (продолжение). Красные и зелёные числа на доске (#46)
// ═══════════════════════════════════════════════════════════════════════════

// На доске N натуральных чисел: красные кратны p, зелёные кратны q. Красные попарно
// различны, зелёные попарно различны, но красное может совпадать с зелёным.
// Если красных r, то их сумма равна p·A, где A — сумма r РАЗЛИЧНЫХ натуральных чисел,
// то есть A ≥ r(r+1)/2; аналогично зелёных N − r и сумма q·B с B ≥ (N−r)(N−r+1)/2.
// Обратно, любые такие A и B достижимы (наибольшее слагаемое увеличивается на 1),
// поэтому сумма S возможна ⟺ S = pA + qB при A ≥ Amin(r), B ≥ Bmin(r) для какого-то r.
// Пункт а): если ВСЕ числа кратны q, то красные кратны pq, и уже одно такое красное
// освобождает место в ряду зелёных, снижая минимальную сумму ниже q·N(N+1)/2.
export function t19BoardRedGreen() {
  const N = pick([24, 26, 28, 30])
  const p = 7, q = 5
  const T = q * N * (N + 1) / 2                            // сумма, если все числа зелёные и разные
  // а) минимальная сумма при r красных, кратных pq, и N − r зелёных
  const minAllMult5 = (r) => p * q * r * (r + 1) / 2 + q * (N - r) * (N - r + 1) / 2
  let rA = -1
  for (let r = 1; r <= N; r++) if (minAllMult5(r) < T) { rA = r; break }
  if (rA < 0) return null
  const exA = {
    red: Array.from({ length: rA }, (_, i) => p * q * (i + 1)),
    green: Array.from({ length: N - rA }, (_, i) => q * (i + 1)),
  }
  // Наименьшая сумма при r красных (красные кратны p, зелёные кратны q)
  const minSum = (r) => p * r * (r + 1) / 2 + q * (N - r) * (N - r + 1) / 2
  // S подбираем так, чтобы ответ в) был «круглым»: берём целевое число красных и
  // сумму чуть больше минимальной для него, но меньше минимальной для r − 1.
  const rC = randInt(8, 12)
  const lo = minSum(rC), hi = minSum(rC - 1)
  if (!(lo < hi)) return null
  const fit = (S, r) => {                                   // достижима ли сумма S при r красных
    for (let A = r * (r + 1) / 2; p * A <= S; A++) {
      const rest = S - p * A
      if (rest % q) continue
      if (rest / q >= (N - r) * (N - r + 1) / 2) return { A, B: rest / q }
    }
    return null
  }
  let S = 0, fitC = null
  for (let cand = lo; cand < hi; cand++) {
    const f = fit(cand, rC)
    if (f) { S = cand; fitC = f; break }
  }
  if (!S) return null
  // набор для в): базовые ряды 1…r и 1…N−r, излишек добавляем к наибольшим числам
  const exC = {
    red: Array.from({ length: rC }, (_, i) => p * (i + 1)),
    green: Array.from({ length: N - rC }, (_, i) => q * (i + 1)),
  }
  exC.red[rC - 1] += p * (fitC.A - rC * (rC + 1) / 2)
  exC.green[N - rC - 1] += q * (fitC.B - (N - rC) * (N - rC + 1) / 2)

  const params = { N, p, q, T, S, rC }
  const check = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.red) || !Array.isArray(cfg.green)) return "нет набора"
    const all = [...cfg.red, ...cfg.green]
    if (all.length !== N) return `чисел ${all.length} вместо ${N}`
    for (const v of all) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное число`
    for (const v of cfg.red) if (v % p) return `красное число ${v} не кратно ${p}`
    for (const v of cfg.green) if (v % q) return `зелёное число ${v} не кратно ${q}`
    if (uniq(cfg.red).length !== cfg.red.length) return "красные числа обязаны различаться"
    if (uniq(cfg.green).length !== cfg.green.length) return "зелёные числа обязаны различаться"
    const total = sum(all)
    if (part === "a") {
      for (const v of all) if (v % q) return `число ${v} не кратно ${q}, хотя в пункте а) все числа кратны ${q}`
      if (total >= T) return `сумма ${total} не меньше ${T}`
      return null
    }
    if (total !== S) return `сумма ${total}, а нужно ${S}`
    if (part === "c" && cfg.red.length !== rC) return `красных чисел ${cfg.red.length}, а заявлено ${rC}`
    return null
  }
  // Независимый перебор: по числу красных r и по сумме коэффициентов A (сумме тех
  // натуральных чисел, на которые умножается p). Оба диапазона конечны: A ≥ r(r+1)/2
  // и pA ≤ S, остальное однозначно определяется как B = (S − pA)/q.
  const solve = (P) => {
    const okAt = (r, S) => {
      for (let A = r * (r + 1) / 2; P.p * A <= S; A++) {
        const rest = S - P.p * A
        if (rest % P.q === 0 && rest / P.q >= (P.N - r) * (P.N - r + 1) / 2) return true
      }
      return false
    }
    let aYes = false
    for (let r = 0; r <= P.N; r++) {
      const mn = P.p * P.q * r * (r + 1) / 2 + P.q * (P.N - r) * (P.N - r + 1) / 2
      if (mn < P.T) aYes = true
    }
    let rMin = -1
    for (let r = 0; r <= P.N; r++) if (okAt(r, P.S)) { rMin = r; break }
    return { a: aYes, b: okAt(1, P.S), c: rMin, c_next: false }
  }

  const listRed = exC.red.join(", "), listGreen = exC.green.slice(0, 4).join(", ")
  return item({
    preamble: `На доске написано ${N} натуральных чисел. Какие-то из них красные, а какие-то зелёные. Красные числа кратны ${p}, а зелёные числа кратны ${q}. Все красные числа отличаются друг от друга, как и все зелёные. Но между красными и зелёными могут быть одинаковые.`,
    qa: `Может ли сумма всех чисел, записанных на доске, быть меньше ${T}, если на доске написаны только кратные ${q} числа?`,
    qb: `Может ли сумма чисел быть ${S}, если только одно число красное?`,
    qc: `Найдите наименьшее количество красных чисел, которое может быть при сумме ${S}.`,
    ansA: `да, например ${rA} ${plural(rA, "красное число", "красных числа", "красных чисел")} ${exA.red.join(", ")} и ${N - rA} ${plural(N - rA, "зелёное число", "зелёных числа", "зелёных чисел")} ${q}, ${2 * q}, …, ${q * (N - rA)}: сумма равна ${sum([...exA.red, ...exA.green])} < ${T}`,
    ansB: `нет: если красное число одно, то зелёных ${N - 1}, они различны и кратны ${q}, поэтому их сумма не меньше ${q}·(1 + 2 + … + ${N - 1}) = ${q * (N - 1) * N / 2} > ${S}`,
    ansC: `${rC}; например красные ${listRed} и зелёные ${listGreen}, …`,
    solution: `Пусть красных чисел r, тогда зелёных ${N} − r. Красные различны и кратны ${p}, поэтому их сумма равна ${p}A, где A — сумма r различных натуральных чисел, то есть A ≥ r(r + 1)/2. Аналогично сумма зелёных равна ${q}B, где B ≥ (${N} − r)(${N} − r + 1)/2.\nа) Если все числа кратны ${q}, то красные кратны ${p * q}. При r = ${rA} наименьшая сумма равна ${p * q}·(1 + … + ${rA}) + ${q}·(1 + … + ${N - rA}) = ${sum([...exA.red, ...exA.green])}, что меньше ${T}.\nб) При r = 1 сумма зелёных не меньше ${q}·(1 + 2 + … + ${N - 1}) = ${q * (N - 1) * N / 2}, а это уже больше ${S}.\nв) Наименьшая сумма при r красных равна ${p}·r(r + 1)/2 + ${q}·(${N} − r)(${N} − r + 1)/2. При r = ${rC - 1} она равна ${hi} > ${S}, поэтому красных не меньше ${rC}. При r = ${rC} сумма ${S} достигается: красные ${listRed}, зелёные ${exC.green.join(", ")}.\nОтвет: ${rC}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: T },
        b: { type: "yesno", yes: false, reason: "green-min-sum", target: S },
        c: { type: "extremum", mode: "min", value: rC, example: exC },
      },
      mustMention: [N, p, q, T, S],
      extra: [],
      phrases: ["Все красные числа отличаются друг от друга", "между красными и зелёными могут быть одинаковые"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 1 (продолжение). Дробная часть среднего арифметического (#97)
// ═══════════════════════════════════════════════════════════════════════════

// Несколько различных натуральных чисел, дробная часть их среднего равна a/b
// (несократимая дробь). Если чисел n, а их сумма S, то S/n − a/b — целое, значит
// b·S = n·(b·целое + a), откуда b | n·a, а так как НОД(a, b) = 1, то b | n.
// Поэтому чисел не меньше b (пункт «нет»), а наименьшее среднее получается при n = b:
// сумма не меньше b(b+1)/2 и обязана иметь вид b·m + a, откуда m = ⌈(b(b+1)/2 − a)/b⌉,
// а среднее равно m + a/b. Увеличение n среднее только увеличивает: оно не меньше (n+1)/2.
export function t19BoardFracMean() {
  const FRACS = [[8, 25], [3, 25], [7, 25], [9, 25], [11, 25], [12, 25], [1, 20], [3, 20], [7, 20], [9, 20], [11, 20], [13, 20]]
  const [a, b] = pick(FRACS)
  const fracTxt = ru2(a / b)
  const Xa = pick([100, 120, 150, 200].filter((v) => v > b))   // «меньше Xa чисел?» — да
  const Xb = pick([12, 15, 16, 18, 20].filter((v) => v <= b))  // «меньше Xb чисел?» — нет
  const m = Math.ceil((b * (b + 1) / 2 - a) / b)
  const S = b * m + a                                          // сумма при n = b
  const meanVal = m + a / b
  const build = (n, total) => {                                // n различных, сумма total
    const arr = Array.from({ length: n }, (_, i) => i + 1)
    arr[n - 1] += total - n * (n + 1) / 2
    return arr
  }
  const exC = build(b, S)
  const exA = build(b, S)                                      // b < Xa чисел — тот же набор

  const params = { a, b, Xa, Xb }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length < 2) return "нужно несколько чисел"
    for (const v of cfg) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное число`
    if (uniq(cfg).length !== cfg.length) return "числа обязаны быть различными"
    const n = cfg.length, total = sum(cfg)
    if ((total * b - n * a) % (n * b) !== 0) return `дробная часть среднего ${total}/${n} не равна ${fracTxt}`
    if (part === "a" && n >= Xa) return `чисел ${n}, а нужно меньше ${Xa}`
    if (part === "c" && Math.abs(total / n - meanVal) > 1e-9) return `среднее ${total / n}, а заявлено ${meanVal}`
    return null
  }
  // Независимый перебор: по количеству чисел n и по сумме S (снизу от минимально
  // возможной n(n+1)/2). Любая сумма, не меньшая минимальной, достижима — наибольшее
  // число увеличивается на нужную величину. Верхняя граница n обоснована тем, что
  // среднее не меньше (n + 1)/2 и при больших n заведомо хуже найденного минимума.
  const solve = (P) => {
    const okCount = (n) => {
      const lo = n * (n + 1) / 2
      for (let s = lo; s < lo + n * P.b + P.b; s++) if ((s * P.b - n * P.a) % (n * P.b) === 0) return true
      return false
    }
    let anyBelow = false, belowXb = false, best = Infinity
    for (let n = 2; n <= 4 * P.b; n++) {
      if (!okCount(n)) continue
      if (n < P.Xa) anyBelow = true
      if (n < P.Xb) belowXb = true
      if ((n + 1) / 2 > best) break
      const lo = n * (n + 1) / 2
      for (let s = lo; s < lo + n * P.b + P.b; s++) {
        if ((s * P.b - n * P.a) % (n * P.b) === 0) { best = Math.min(best, s / n); break }
      }
    }
    return { a: anyBelow, b: belowXb, c: best }
  }

  return item({
    preamble: `На доске написано несколько различных натуральных чисел. Дробная часть среднего арифметического этих чисел равна ${fracTxt} (то есть если вычесть из среднего арифметического этих чисел ${fracTxt}, то получится целое число).`,
    qa: `Могло ли на доске быть написано меньше ${Xa} чисел?`,
    qb: `Могло ли на доске быть написано меньше ${Xb} чисел?`,
    qc: `Найдите наименьшее возможное значение среднего арифметического этих чисел.`,
    ansA: `да, например ${b} чисел: ${exA.slice(0, 4).join(", ")}, …, ${exA[b - 2]}, ${exA[b - 1]} (их сумма ${S}, среднее ${ru2(meanVal)})`,
    ansB: `нет: если чисел n, а сумма равна S, то S/n − ${fracTxt} — целое число, поэтому ${b}S = n·(${b}·целое + ${a}) и ${b} делит n·${a}. Числа ${a} и ${b} взаимно просты, значит ${b} делит n, и чисел не меньше ${b} > ${Xb - 1}`,
    ansC: `${ru2(meanVal)}; например ${exC.slice(0, 4).join(", ")}, …, ${exC[b - 2]}, ${exC[b - 1]}`,
    solution: `Пусть на доске n различных натуральных чисел с суммой S. По условию S/n − ${fracTxt} — целое число, то есть ${b}S − ${a}n делится на ${b}n. В частности ${b} делит ${a}n, а так как ${a} и ${b} взаимно просты, ${b} делит n.\nа) Можно взять ровно ${b} чисел, это меньше ${Xa}.\nб) Из делимости n на ${b} следует n ≥ ${b}, а ${b} ≥ ${Xb}, поэтому меньше ${Xb} чисел быть не могло.\nв) Среднее равно S/n, а сумма n различных натуральных чисел не меньше n(n + 1)/2, поэтому среднее не меньше (n + 1)/2. Значит выгодно брать наименьшее допустимое n = ${b}. Тогда сумма имеет вид ${b}m + ${a} и не меньше ${b * (b + 1) / 2}, откуда m ≥ ${m} и S ≥ ${S}. Такая сумма достигается на наборе 1, 2, …, ${b - 1}, ${exC[b - 1]}, и среднее равно ${ru2(meanVal)}.\nОтвет: ${ru2(meanVal)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: Xa },
        b: { type: "yesno", yes: false, reason: "divisibility-of-count", target: Xb },
        c: { type: "value", value: meanVal, example: exC },
      },
      mustMention: [Xa, Xb],
      extra: [a, b, ...String(fracTxt).split(/\D+/).filter(Boolean).map(Number)],
      phrases: ["различных натуральных чисел", "Дробная часть среднего арифметического"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 8 (продолжение). Сумма нескольких подряд идущих членов прогрессии (#23)
// ═══════════════════════════════════════════════════════════════════════════

// S — сумма n ≥ 3 подряд идущих членов НЕПОСТОЯННОЙ целочисленной прогрессии:
//   S = n·a + d·n(n − 1)/2 = (n/2)·(2a + d(n − 1)),  d ≠ 0.
// При нечётном n отсюда n | S, при чётном — (n/2) | S. В обоих случаях S либо равно
// нулю, либо |S| ≥ n/2 ≥ 3/2, то есть |S| ≥ 2: значения ±1 недостижимы.
// Все остальные целые достижимы: при S = 0 годится −d, 0, d, а при |S| ≥ 2 берём
// n = 2|S| членов с d = ±1 и первым членом 1 − |S| (соответственно |S| − 1),
// потому что 2S(1 − S) + 2S(2S − 1)/2 = S.
export function t19APConsecutiveSum() {
  // Компактный набор для заданной суммы: наименьшее n ≥ 3, при котором первый член
  // a = (S − d·n(n−1)/2)/n цел. Универсальная конструкция (n = 2|S|, d = ±1) годится
  // всегда, но для показа берём короткий набор.
  const mk = (S) => {
    for (let n = 3; n <= 10; n++) {
      for (const d of [1, -1, 2, -2, 3, -3]) {
        const num = S - d * n * (n - 1) / 2
        if (num % n === 0) return { a: num / n, d, n }
      }
    }
    if (S === 0) return { a: -1, d: 1, n: 3 }
    const sgn = S > 0 ? 1 : -1, A = Math.abs(S)
    return { a: sgn * (1 - A), d: sgn, n: 2 * A }
  }
  const R = 12                                             // окно перебора для пункта в)
  const Sa = pick([8, 10, 14, 16, 20, 22, 26])             // пункт а) — «да»
  const Sb = pick([1, -1])                                 // пункт б) — «нет»
  const exA = mk(Sa)
  const examples = {}
  for (const v of [0, 2, -2, R]) examples[v] = mk(v)

  const params = { Sa, Sb, R }
  const check = (cfg, part) => {
    if (!cfg || !Number.isInteger(cfg.a) || !Number.isInteger(cfg.d) || !Number.isInteger(cfg.n)) return "нет прогрессии"
    if (cfg.d === 0) return "прогрессия постоянна (d = 0)"
    if (cfg.n < 3) return `взято ${cfg.n} членов, а нужно не менее трёх`
    const total = cfg.n * cfg.a + cfg.d * cfg.n * (cfg.n - 1) / 2
    if (part === "a" && total !== Sa) return `сумма ${total}, а нужно ${Sa}`
    return null
  }
  // Независимый перебор пункта в): по числу членов n, первому члену a и разности d
  // в явном конечном окне. Окно достаточно широкое: значение S по модулю не больше R
  // получается уже при n ≤ 2R и |a| ≤ 2R + 1, |d| ≤ 3. Недостижимость ±1 доказывается
  // не перебором, а оценкой |S| ≥ n/2 ≥ 3/2 (см. ansB).
  const solve = (P) => {
    const reach = new Set()
    for (let n = 3; n <= 2 * P.R + 2; n++) {
      for (let d = -3; d <= 3; d++) {
        if (d === 0) continue
        for (let a = -(2 * P.R + 2); a <= 2 * P.R + 2; a++) {
          const total = n * a + d * n * (n - 1) / 2
          if (Math.abs(total) <= P.R) reach.add(total)
        }
      }
    }
    const list = [...reach].sort((x, y) => x - y)
    return { a: reach.has(P.Sa) || Math.abs(P.Sa) > P.R, b: list.includes(P.Sb), c: list }
  }

  const showRun = (o) => {
    const first = o.a, second = o.a + o.d, last = o.a + o.d * (o.n - 1)
    return o.n <= 5
      ? Array.from({ length: o.n }, (_, i) => o.a + o.d * i).join(", ")
      : `${first}, ${second}, …, ${last} (${o.n} ${plural(o.n, "член", "члена", "членов")}, разность ${o.d})`
  }
  return item({
    preamble: `Целое число S является суммой не менее трёх последовательных членов непостоянной арифметической прогрессии, состоящей из целых чисел.`,
    qa: `Может ли S равняться ${Sa}?`,
    qb: `Может ли S равняться ${String(Sb).replace("-", "−")}?`,
    qc: `Найдите все значения, которые может принимать S.`,
    ansA: `да, например ${showRun(exA)}`,
    ansB: `нет: сумма n подряд идущих членов равна ${"(n/2)·(2a + d(n − 1))"}, поэтому при нечётном n она делится на n, а при чётном — на n/2. Значит либо S = 0, либо |S| ≥ n/2 ≥ ${"3/2"}, то есть |S| ≥ 2, а ${String(Sb).replace("-", "−")} этому не удовлетворяет`,
    ansC: `все целые числа, кроме 1 и −1; например 0 = (−1) + 0 + 1, а любое S с |S| ≥ 2 — сумма ${"2|S|"} членов с разностью ±1, начиная с 1 − |S| (соответственно |S| − 1)`,
    solution: `Пусть взято n ≥ 3 подряд идущих членов, первый из них равен a, разность равна d ≠ 0. Тогда\nS = na + d·n(n − 1)/2 = (n/2)·(2a + d(n − 1)).\nа) ${Sa} = сумма набора ${showRun(exA)}.\nб) Если n нечётно, то S = n·(a + d(n − 1)/2) делится на n; если n чётно, то S = (n/2)·(2a + d(n − 1)) делится на n/2. В обоих случаях либо S = 0, либо |S| не меньше n/2 ≥ 3/2, то есть |S| ≥ 2. Значит S = ${String(Sb).replace("-", "−")} невозможно.\nв) Итак, значения 1 и −1 недостижимы. Все остальные целые достижимы: 0 = (−d) + 0 + d; если |S| ≥ 2, возьмём n = 2|S| членов с разностью 1 (при S > 0) или −1 (при S < 0), начиная с 1 − |S| (соответственно |S| − 1): сумма как раз равна S.\nОтвет: все целые числа, кроме 1 и −1.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: Sa },
        b: { type: "yesno", yes: false, reason: "abs-bound", target: Sb },
        c: { type: "except", excluded: [1, -1], range: [-R, R], examples },
      },
      mustMention: [Sa, Sb].filter((v) => v > 0),
      extra: [1],
      phrases: ["не менее трёх последовательных членов", "непостоянной арифметической прогрессии"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 10 (продолжение). Средние двух перекрывающихся половин набора (#60)
// ═══════════════════════════════════════════════════════════════════════════

// N = 2k − 1 различных натуральных чисел a₁ < … < a_N. Среднее k наименьших равно u,
// среднее k наибольших равно v; общий элемент двух половин — это B = a_k.
// Сумма всех чисел равна ku + kv − B, поэтому среднее S = (k(u + v) − B)/N, и
//   S − B = k(u + v − 2B)/N — убывает по B, значит максимум даёт наименьшее B.
// Границы B: в нижней половине k различных чисел с наибольшим B, поэтому
//   kB − k(k−1)/2 ≥ ku  ⟹  B ≥ u + (k−1)/2,
// в верхней половине k различных чисел с наименьшим B, поэтому
//   kB + k(k−1)/2 ≤ kv  ⟹  B ≤ v − (k−1)/2.
export function t19MeansHalvesOverlap() {
  const k = pick([6, 7])
  const N = 2 * k - 1
  const u = randInt(4, 7)
  const v = u + pick([8, 10, 12])
  const Bmin = Math.ceil(u + (k - 1) / 2)
  const Bmax = Math.floor(v - (k - 1) / 2)
  if (Bmin > Bmax) return null
  // наименьшее число для пункта а): строго больше u − (k−1)/2, иначе набор существует
  const Xa = Math.floor(u - (k - 1) / 2) + 1
  if (Xa < 1) return null
  // среднее для пункта б): такое целое, при котором требуемое B выходит за верхнюю
  // границу (и остаётся положительным — иначе довод выглядел бы странно)
  let Sb = 0, Bb = 0
  for (let cand = Bmax + 1; cand <= k * (u + v); cand++) {
    if ((k * (u + v) - cand) % N === 0) { Bb = cand; Sb = (k * (u + v) - cand) / N; break }
  }
  if (!Sb || Sb < 1) return null
  const diff = fr(k * (u + v - 2 * Bmin), N)

  // Набор, на котором достигается максимум: нижняя половина с наибольшим Bmin,
  // верхняя — Bmin и k−1 чисел, добирающих сумму kv.
  const low = []
  let restLow = k * u - Bmin
  for (let i = 1; i <= k - 1; i++) { low.push(i); restLow -= i }
  for (let i = k - 2; i >= 0 && restLow > 0; i--) {
    const cap = (i === k - 2 ? Bmin - 1 : low[i + 1] - 1) - low[i]
    const add = Math.min(restLow, cap)
    low[i] += add; restLow -= add
  }
  if (restLow !== 0) return null
  const high = []
  let restHigh = k * v - Bmin
  for (let i = 1; i <= k - 1; i++) { high.push(Bmin + i); restHigh -= Bmin + i }
  if (restHigh < 0) return null
  high[k - 2] += restHigh
  const exC = [...low, Bmin, ...high]

  const params = { N, k, u, v, Xa, Sb }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length !== N) return `чисел должно быть ${N}`
    for (const x of cfg) if (!Number.isInteger(x) || x < 1) return `${x} — не натуральное число`
    if (uniq(cfg).length !== cfg.length) return "числа обязаны быть различными"
    const s = cfg.slice().sort((a, b) => a - b)
    const lowSum = sum(s.slice(0, k)), highSum = sum(s.slice(N - k))
    if (lowSum !== k * u) return `среднее ${k} наименьших равно ${lowSum / k}, а не ${u}`
    if (highSum !== k * v) return `среднее ${k} наибольших равно ${highSum / k}, а не ${v}`
    if (part === "a" && s[0] !== Xa) return `наименьшее число ${s[0]}, а не ${Xa}`
    if (part === "b" && sum(s) !== N * Sb) return `среднее всех чисел ${sum(s) / N}, а не ${Sb}`
    if (part === "c") {
      const val = fr(sum(s) - N * s[k - 1], N)
      if (val.n * diff.d !== diff.n * val.d) return `S − B = ${frPlain(val)}, а заявлено ${frPlain(diff)}`
    }
    return null
  }
  // Независимый перебор по B = a_k с динамикой: существует ли k−1 различных чисел
  // меньше B с суммой ku − B (нижняя половина) и k−1 различных чисел больше B
  // с суммой kv − B (верхняя половина). Границы динамики выписаны явно.
  const solve = (P) => {
    const kk = P.k
    const okB = (B) => {
      const needLow = kk * P.u - B, needHigh = kk * P.v - B
      if (needLow < 0 || needHigh < 0) return false
      const itemsLow = []
      for (let x = 1; x < B; x++) itemsLow.push(x)
      const rowsLow = knap(itemsLow, kk - 1, Math.max(needLow, 0))
      if (!rowsLow[kk - 1] || !rowsLow[kk - 1][needLow]) return false
      const itemsHigh = []
      for (let x = B + 1; x <= needHigh; x++) itemsHigh.push(x)
      const rowsHigh = knap(itemsHigh, kk - 1, Math.max(needHigh, 0))
      return !!(rowsHigh[kk - 1] && rowsHigh[kk - 1][needHigh])
    }
    let aYes = false, bYes = false, bestDiff = null
    for (let B = 1; B <= kk * (P.u + P.v); B++) {
      if (!okB(B)) continue
      const total = kk * (P.u + P.v) - B
      if (total === P.N * P.Sb) bYes = true
      const d = kk * (P.u + P.v - 2 * B) / P.N
      if (bestDiff === null || d > bestDiff) bestDiff = d
      // наименьшее число набора: k−1 чисел меньше B с суммой ku − B, минимальное из них
      const needLow = kk * P.u - B
      const maxFirst = Math.floor((needLow - (kk - 2) * (kk - 1) / 2) / (kk - 1))
      if (P.Xa <= maxFirst && P.Xa * (kk - 1) + (kk - 2) * (kk - 1) / 2 <= needLow) aYes = true
    }
    return { a: aYes, b: bYes, c: bestDiff }
  }

  return item({
    preamble: `На доске написано ${N} различных натуральных чисел. Среднее арифметическое ${k === 6 ? "шести" : "семи"} наименьших из них равно ${u}, а среднее арифметическое ${k === 6 ? "шести" : "семи"} наибольших равно ${v}.`,
    qa: `Может ли наименьшее из этих ${N} чисел равняться ${Xa}?`,
    qb: `Может ли среднее арифметическое всех ${N} чисел равняться ${Sb}?`,
    qc: `Пусть B — ${k === 6 ? "шестое" : "седьмое"} по величине число, а S — среднее арифметическое всех ${N} чисел. Найдите наибольшее значение выражения S − B.`,
    ansA: `нет: если наименьшее число равно ${Xa}, то ${k} наименьших чисел различны и их сумма не меньше ${Xa} + ${Xa + 1} + … + ${Xa + k - 1} = ${k * Xa + k * (k - 1) / 2}, а она должна равняться ${k}·${u} = ${k * u}`,
    ansB: `нет: сумма всех чисел равна ${k}·${u} + ${k}·${v} − B = ${k * (u + v)} − B, где B — ${k === 6 ? "шестое" : "седьмое"} по величине число. Из ${k} наименьших получаем B ≥ ${Bmin}, из ${k} наибольших — B ≤ ${Bmax}. Значение ${Sb} требует B = ${k * (u + v)} − ${N}·${Sb} = ${Bb}, что вне промежутка от ${Bmin} до ${Bmax}`,
    ansC: `${frPlain(diff)}; достигается при B = ${Bmin}, например на наборе ${exC.join(", ")}`,
    solution: `Обозначим через B ${k === 6 ? "шестое" : "седьмое"} по величине число — оно входит и в ${k} наименьших, и в ${k} наибольших. Сумма всех чисел равна ${k}${u} + ${k}${v} − B = ${k * (u + v)} − B, поэтому S = (${k * (u + v)} − B)/${N} и\nS − B = ${k}(${u} + ${v} − 2B)/${N}.\nЭто выражение убывает с ростом B, поэтому нужно наименьшее возможное B.\nа) Если наименьшее число равно ${Xa}, то сумма ${k} наименьших не меньше ${k * Xa + k * (k - 1) / 2} > ${k * u} — противоречие.\nб) В нижней половине ${k} различных чисел с наибольшим B, поэтому ${k}B − ${k * (k - 1) / 2} ≥ ${k * u}, то есть B ≥ ${Bmin}. В верхней половине ${k} различных чисел с наименьшим B, поэтому ${k}B + ${k * (k - 1) / 2} ≤ ${k * v}, то есть B ≤ ${Bmax}. Среднее ${Sb} потребовало бы B = ${Bb} — вне этих границ.\nв) При B = ${Bmin} получаем S − B = ${frPlain(diff)}; пример набора: ${exC.join(", ")}.\nОтвет: ${frPlain(diff)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: false, reason: "low-half-sum", target: Xa },
        b: { type: "yesno", yes: false, reason: "middle-range", target: Sb },
        c: { type: "value", value: frVal(diff), example: exC },
      },
      mustMention: [N, u, v, Xa, Sb],
      extra: [],
      phrases: ["различных натуральных чисел", "наибольшее значение выражения"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 10 (продолжение). Деление набора на три группы (#57)
// ═══════════════════════════════════════════════════════════════════════════

// Числа 1, 2, …, 9 и ещё одно большое число X делят на три непустые группы и считают
// среднее в каждой. Пространство разбиений конечно (3¹⁰ = 59049 масок), поэтому все
// три пункта решаются полным перебором — здесь он и есть эталон истины.
// Таблица ответов считается один раз на каждое X (лениво) перебором по маскам,
// а solve перебирает те же разбиения рекурсивно — два независимых прохода.
const THREE_GROUPS_CACHE = new Map()
function threeGroupsFacts(X) {
  if (THREE_GROUPS_CACHE.has(X)) return THREE_GROUPS_CACHE.get(X)
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, X]
  const n = nums.length
  let allEqual = false, best = Infinity, bestSplit = null, exA = null
  for (let mask = 0; mask < 3 ** n; mask++) {
    const g = [[], [], []]
    let m = mask
    for (let i = 0; i < n; i++) { g[m % 3].push(nums[i]); m = (m - m % 3) / 3 }
    if (g.some((x) => !x.length)) continue
    const av = g.map((x) => sum(x) / x.length)
    const mx = Math.max(...av)
    if (mx < best) { best = mx; bestSplit = g.map((x) => [...x]) }
    if (av[0] === av[1] && av[1] === av[2]) allEqual = true
    if (!exA) {
      for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
        if (av[i] === av[j] && g[i].length !== g[j].length) { exA = g.map((x) => [...x]); break }
      }
    }
  }
  const facts = { allEqual, best, bestSplit, exA }
  THREE_GROUPS_CACHE.set(X, facts)
  return facts
}

export function t19MeansThreeGroups() {
  const X = pick([12, 14, 16, 18])                         // при этих X все три средних совпасть не могут
  const f = threeGroupsFacts(X)
  if (!f.exA || f.allEqual) return null
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, X]
  const bestFr = fr(sum(f.bestSplit.reduce((a, g) => (sum(g) / g.length === f.best ? g : a), f.bestSplit[0])),
    f.bestSplit.reduce((a, g) => (sum(g) / g.length === f.best ? g.length : a), 1))

  const params = { X }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length !== 3) return "нужно три группы"
    for (const g of cfg) if (!Array.isArray(g) || !g.length) return "в каждой группе должно быть хотя бы одно число"
    const flat = cfg.flat().slice().sort((a, b) => a - b)
    if (flat.join(",") !== nums.slice().sort((a, b) => a - b).join(",")) return "группы должны в точности разбивать исходный набор"
    const av = cfg.map((g) => sum(g) / g.length)
    if (part === "a") {
      let ok = false
      for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) if (av[i] === av[j] && cfg[i].length !== cfg[j].length) ok = true
      if (!ok) return "нет двух групп разного размера с равными средними"
      return null
    }
    if (part === "c" && Math.abs(Math.max(...av) - f.best) > 1e-9) return `наибольшее среднее ${Math.max(...av)}, а заявлено ${f.best}`
    return null
  }
  // Независимый проход: рекурсивное распределение чисел по трём группам. Суммы и
  // размеры групп ведутся инкрементально, а новая (пустая) группа открывается только
  // одна — иначе каждое разбиение на неупорядоченные группы перебиралось бы шестикратно.
  const solve = (P) => {
    const ns = [1, 2, 3, 4, 5, 6, 7, 8, 9, P.X]
    const sums = [0, 0, 0], cnts = [0, 0, 0]
    let aYes = false, bYes = false, mn = Infinity
    const rec = (i, opened) => {
      if (i === ns.length) {
        if (opened < 3) return
        const a0 = sums[0] / cnts[0], a1 = sums[1] / cnts[1], a2 = sums[2] / cnts[2]
        const mx = Math.max(a0, a1, a2)
        if (mx < mn) mn = mx
        if (a0 === a1 && a1 === a2) bYes = true
        if ((a0 === a1 && cnts[0] !== cnts[1]) || (a0 === a2 && cnts[0] !== cnts[2]) || (a1 === a2 && cnts[1] !== cnts[2])) aYes = true
        return
      }
      const lim = Math.min(3, opened + 1)
      for (let t = 0; t < lim; t++) {
        const fresh = cnts[t] === 0
        sums[t] += ns[i]; cnts[t]++
        rec(i + 1, fresh ? opened + 1 : opened)
        sums[t] -= ns[i]; cnts[t]--
      }
    }
    rec(0, 0)
    return { a: aYes, b: bYes, c: mn }
  }

  const showSplit = (sp) => sp.map((g) => `{${g.join(", ")}} — среднее ${frPlain(fr(sum(g), g.length))}`).join("; ")
  return item({
    preamble: `Числа ${nums.join(", ")} произвольно делят на три группы так, чтобы в каждой группе было хотя бы одно число. Затем вычисляют значение среднего арифметического чисел в каждой из групп (для группы из единственного числа среднее арифметическое равно этому числу).`,
    qa: `Могут ли быть одинаковыми два из этих трёх значений средних арифметических в группах из разного количества чисел?`,
    qb: `Могут ли быть одинаковыми все три значения средних арифметических?`,
    qc: `Найдите наименьшее возможное значение наибольшего из получаемых трёх средних арифметических.`,
    ansA: `да, например ${showSplit(f.exA)}`,
    ansB: `нет: если все три средних равны m, то сумма чисел каждой группы равна m·(число элементов), а сумма всех чисел равна ${sum(nums)}, поэтому 10m = ${sum(nums)} и m = ${ru2(sum(nums) / 10)}. Но тогда сумма группы из k чисел равна ${ru2(sum(nums) / 10)}k и обязана быть целой, что при k < 10 невозможно, а групп три и в каждой меньше 10 чисел`,
    ansC: `${frPlain(bestFr)}; например ${showSplit(f.bestSplit)}`,
    solution: `а) Пример: ${showSplit(f.exA)}.\nб) Пусть все три средних равны m. Тогда сумма чисел в группе из k элементов равна mk, а сумма всех десяти чисел равна ${sum(nums)}, откуда 10m = ${sum(nums)} и m = ${ru2(sum(nums) / 10)}. Сумма каждой группы целая, поэтому ${ru2(sum(nums) / 10)}k должно быть целым, то есть k кратно 10. Но в каждой из трёх непустых групп меньше десяти чисел — противоречие.\nв) Перебор разбиений показывает, что наименьшее возможное значение наибольшего среднего равно ${frPlain(bestFr)}; оно достигается на разбиении ${showSplit(f.bestSplit)}.\nОтвет: ${frPlain(bestFr)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: f.exA, target: "two-equal" },
        b: { type: "yesno", yes: false, reason: "sum-not-divisible", target: "all-equal" },
        c: { type: "value", value: f.best, example: f.bestSplit },
      },
      mustMention: nums,
      extra: [],
      phrases: ["на три группы", "хотя бы одно число"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 10 (продолжение). Уменьшение чисел на единицу и стирание нулей (#93)
// ═══════════════════════════════════════════════════════════════════════════

// На доске N натуральных чисел, каждое ≤ M, среднее равно u (сумма Nu). Некоторые
// числа (хотя бы одно) уменьшают на 1; ставшие нулями (то есть бывшие единицы) стирают.
// Пусть уменьшили k чисел, из них m были единицами. Тогда осталось N − m чисел с суммой
// Nu − k, и среднее оставшихся равно (Nu − k)/(N − m). Оно тем больше, чем больше m и
// меньше k, а так как m ≤ k, лучшее — уменьшать ТОЛЬКО единицы: k = m.
// Ограничение на m: остальные N − m чисел не больше M, поэтому m + (N − m)M ≥ Nu,
// то есть m ≤ N(M − u)/(M − 1). Максимум среднего равен (Nu − m)/(N − m).
export function t19MeansEraseMinusOne() {
  const N = pick([20, 24, 25, 30])
  const M = pick([40, 45, 50])
  const u = randInt(Math.ceil(M * 0.6), M - 5)             // среднее исходных чисел
  const mMax = Math.floor(N * (M - u) / (M - 1))
  if (mMax < 2) return null
  const bestFr = fr(N * u - mMax, N - mMax)
  // б) недостижимое значение среднего оставшихся
  let Sb = 0
  for (let cand = Math.ceil(frVal(bestFr)) - 6; cand < frVal(bestFr); cand++) {
    let reach = false
    for (let m = 0; m <= mMax; m++) {
      for (let k = Math.max(1, m); k <= N; k++) if ((N * u - k) === cand * (N - m)) reach = true
    }
    if (!reach && cand > u) { Sb = cand; break }
  }
  if (!Sb) return null
  // Примеры: а) одна единица и остальные по M; в) mMax единиц и остальные почти по M
  const exA = { start: [1, ...Array(N - 1).fill(M)], dec: [0] }
  const restSum = N * u - mMax
  const rest = Array(N - mMax).fill(M)
  let over = (N - mMax) * M - restSum
  for (let i = 0; i < rest.length && over > 0; i++) {
    const cut = Math.min(over, M - 1)
    rest[i] -= cut; over -= cut
  }
  if (over !== 0) return null
  const exC = { start: [...Array(mMax).fill(1), ...rest], dec: Array.from({ length: mMax }, (_, i) => i) }

  const params = { N, M, u, mMax }
  const check = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.start) || !Array.isArray(cfg.dec)) return "нет конфигурации"
    if (cfg.start.length !== N) return `чисел должно быть ${N}`
    for (const v of cfg.start) if (!Number.isInteger(v) || v < 1 || v > M) return `${v} — не натуральное число, не превосходящее ${M}`
    if (!cfg.dec.length) return "уменьшить нужно хотя бы одно число"
    if (uniq(cfg.dec).length !== cfg.dec.length) return "одно и то же число уменьшено дважды"
    const after = cfg.start.map((v, i) => (cfg.dec.includes(i) ? v - 1 : v)).filter((v) => v > 0)
    if (!after.length) return "на доске не осталось чисел"
    const meanBefore = sum(cfg.start) / N, meanAfter = sum(after) / after.length
    if (part === "a") return meanAfter > meanBefore ? null : `среднее было ${meanBefore}, стало ${meanAfter} — не увеличилось`
    if (sum(cfg.start) !== N * u) return `среднее первоначальных чисел ${meanBefore}, а не ${u}`
    if (part === "c" && Math.abs(meanAfter - frVal(bestFr)) > 1e-9) return `среднее оставшихся ${meanAfter}, а заявлено ${frPlain(bestFr)}`
    return null
  }
  // Независимый перебор по числу стёртых единиц m и числу уменьшенных k: конфигурация
  // возможна, когда m единиц и N − m чисел, не превосходящих M, дают сумму Nu,
  // а уменьшить нужно хотя бы одно число (k ≥ 1, k ≥ m, k ≤ N).
  const solve = (P) => {
    let bYes = false, best = -Infinity
    for (let m = 0; m <= P.N; m++) {
      if (m + (P.N - m) * P.M < P.N * P.u) continue        // столько единиц не помещается
      if (P.N - m <= 0) continue
      for (let k = Math.max(1, m); k <= P.N; k++) {
        const mean = (P.N * P.u - k) / (P.N - m)
        if (Math.abs(mean - P.Sb) < 1e-12) bYes = true
        if (mean > best) best = mean
      }
    }
    // а): среди N чисел ≤ M есть набор, где стирание единицы поднимает среднее
    const before = (1 + (P.N - 1) * P.M) / P.N
    return { a: P.M > before, b: bYes, c: best }
  }
  params.Sb = Sb

  const short = (arr) => (arr.length > 6 ? `${arr.slice(0, 3).join(", ")}, …, ${arr[arr.length - 1]}` : arr.join(", "))
  return item({
    preamble: `На доске было написано ${N} ${plural(N, "натуральное число", "натуральных числа", "натуральных чисел")} (необязательно различных), каждое из которых не превосходит ${M}. Вместо некоторых из чисел (возможно, одного) на доске написали числа, меньшие первоначальных на единицу. Числа, которые после этого оказались равными 0, с доски стёрли.`,
    qa: `Могло ли оказаться так, что среднее арифметическое чисел на доске увеличилось?`,
    qb: `Среднее арифметическое первоначально написанных чисел равнялось ${u}. Могло ли среднее арифметическое оставшихся на доске чисел оказаться равным ${Sb}?`,
    qc: `Среднее арифметическое первоначально написанных чисел равнялось ${u}. Найдите наибольшее возможное значение среднего арифметического чисел, которые остались на доске.`,
    ansA: `да, например числа 1, ${M}, ${M}, …, ${M}: единицу уменьшили и стёрли, среднее выросло с ${ru2((1 + (N - 1) * M) / N)} до ${M}`,
    ansB: `нет: если уменьшили k чисел, из них m были единицами, то осталось ${N} − m чисел с суммой ${N * u} − k, а среднее равно (${N * u} − k)/(${N} − m). Все единицы вместе с остальными числами дают сумму не больше m + (${N} − m)·${M}, откуда m ≤ ${mMax}. Значение ${Sb} потребовало бы k = ${N * u} − ${Sb}·(${N} − m), что при m ≤ ${mMax} выходит за границы 1 ≤ k ≤ ${N}`,
    ansC: `${frPlain(bestFr)}; например ${mMax} ${plural(mMax, "единица", "единицы", "единиц")} и числа ${short(rest)} — уменьшают и стирают все единицы`,
    solution: `Пусть уменьшили k чисел, из них m оказались единицами (их стёрли). Тогда на доске осталось ${N} − m чисел, а их сумма равна ${N * u} − k, поэтому среднее равно (${N * u} − k)/(${N} − m).\nа) Возьмём числа 1, ${M}, …, ${M}. Их среднее равно ${ru2((1 + (N - 1) * M) / N)}, а после стирания единицы остаётся ${N - 1} ${plural(N - 1, "число", "числа", "чисел")} по ${M}, среднее ${M} — оно больше.\nб)–в) Среднее оставшихся растёт с ростом m и убывает с ростом k, а k ≥ m, поэтому выгодно уменьшать только единицы: k = m. Единиц не может быть много: сумма всех чисел не больше m + (${N} − m)·${M}, и из m + (${N} − m)·${M} ≥ ${N * u} получаем m ≤ ${mMax}.\nПри m = k = ${mMax} среднее равно (${N * u} − ${mMax})/(${N} − ${mMax}) = ${frPlain(bestFr)}; такой набор существует: ${mMax} ${plural(mMax, "единица", "единицы", "единиц")} и числа ${short(rest)}. Значение ${Sb} не достигается ни при каких допустимых m и k.\nОтвет: ${frPlain(bestFr)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: "increase" },
        b: { type: "yesno", yes: false, reason: "count-of-ones", target: Sb },
        c: { type: "value", value: frVal(bestFr), example: exC },
      },
      mustMention: [N, M, u, Sb, 0],
      extra: [],
      phrases: ["не превосходит", "меньшие первоначальных на единицу", "оказались равными 0"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 10 (продолжение). Три сорта чисел, две группы, среднее средних (#62)
// ═══════════════════════════════════════════════════════════════════════════

// На доске по c штук каждого из трёх чисел v₁ > v₂ > v₃; их делят на две непустые
// группы со средними A и B. Если размеры групп n и N − n, а суммы s и T − s, то
//   (A + B)/2 = (s/n + (T − s)/(N − n))/2
// при фиксированном n линейно по s с коэффициентом (1/n − 1/(N − n))/2. При n < N/2
// он положителен, поэтому выгодно набирать в маленькую группу самые большие числа,
// и максимум даёт группа из ОДНОГО числа v₁: (v₁ + (T − v₁)/(N − 1))/2.
// При n = N/2 коэффициент равен нулю: тогда (A + B)/2 = T/N — среднее всех чисел
// (это и есть пункт б).
export function t19MeansTwoGroups543() {
  const c = pick([8, 10, 12])
  const v1 = randInt(5, 7), v2 = v1 - 1, v3 = v1 - 2
  const N = 3 * c, T = c * (v1 + v2 + v3)
  const best = fr(v1 * (N - 1) + (T - v1), 2 * (N - 1))    // (v₁ + (T−v₁)/(N−1))/2
  const mean = fr(T, N)
  // а) пример, где среднее всех МЕНЬШЕ (A+B)/2: группа из двух старших чисел
  const exA = { g1: [v1, v1], g2: [...Array(c - 2).fill(v1), ...Array(c).fill(v2), ...Array(c).fill(v3)] }
  const exC = { g1: [v1], g2: [...Array(c - 1).fill(v1), ...Array(c).fill(v2), ...Array(c).fill(v3)] }

  const params = { c, v1, v2, v3, N, T }
  const check = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.g1) || !Array.isArray(cfg.g2)) return "нет разбиения"
    if (!cfg.g1.length || !cfg.g2.length) return "в каждой группе должно быть хотя бы одно число"
    const all = [...cfg.g1, ...cfg.g2]
    if (all.length !== N) return `чисел ${all.length} вместо ${N}`
    for (const v of [v1, v2, v3]) {
      const got = all.filter((x) => x === v).length
      if (got !== c) return `чисел «${v}» ${got}, а должно быть ${c}`
    }
    const A = sum(cfg.g1) / cfg.g1.length, B = sum(cfg.g2) / cfg.g2.length
    if (part === "a" && !(T / N < (A + B) / 2)) return `среднее всех ${T / N} не меньше (A + B)/2 = ${(A + B) / 2}`
    if (part === "c" && Math.abs((A + B) / 2 - frVal(best)) > 1e-9) return `(A + B)/2 = ${(A + B) / 2}, а заявлено ${frPlain(best)}`
    return null
  }
  // Независимый перебор: по размеру первой группы n и по её составу (сколько взято
  // чисел каждого сорта). Это полный перебор всех разбиений с точностью до
  // перестановки одинаковых чисел, которая на средние не влияет.
  const solve = (P) => {
    let bad = 0, mx = -Infinity
    for (let a = 0; a <= P.c; a++) {
      for (let b = 0; b <= P.c; b++) {
        for (let d = 0; d <= P.c; d++) {
          const n = a + b + d
          if (n === 0 || n === P.N) continue
          const s = a * P.v1 + b * P.v2 + d * P.v3
          const val = (s / n + (P.T - s) / (P.N - n)) / 2
          if (val > mx) mx = val
          if (n === P.N / 2 && Math.abs(val - P.T / P.N) > 1e-9) bad++
        }
      }
    }
    return { a: mx > P.T / P.N, b: bad, c: mx }
  }

  const grp = (arr) => {
    const parts = []
    for (const v of [v1, v2, v3]) {
      const k = arr.filter((x) => x === v).length
      if (k) parts.push(`${k} ${plural(k, "число", "числа", "чисел")} «${v}»`)
    }
    return parts.join(", ")
  }
  return item({
    preamble: `На доске написано ${N} чисел: ${c} ${plural(c, "число", "числа", "чисел")} «${v1}», ${c} «${v2}» и ${c} «${v3}». Эти числа разбивают на две группы, в каждой из которых есть хотя бы одно число. Среднее арифметическое чисел в первой группе равно A, среднее арифметическое чисел во второй группе равно B. (Для группы из единственного числа среднее арифметическое равно этому числу.)`,
    qa: `Приведите пример разбиения исходных чисел на две группы, при котором среднее арифметическое всех чисел меньше ⟦f:A + B:2⟧.`,
    qb: `Докажите, что если разбить исходные числа на две группы по ${N / 2} чисел, то среднее арифметическое всех чисел будет равно ⟦f:A + B:2⟧.`,
    qc: `Найдите наибольшее возможное значение выражения ⟦f:A + B:2⟧.`,
    ansA: `например, первая группа — ${grp(exA.g1)}, вторая — ${grp(exA.g2)}: тогда A = ${v1}, B = ${frPlain(fr(T - 2 * v1, N - 2))}, а (A + B)/2 = ${frPlain(fr(v1 * (N - 2) + T - 2 * v1, 2 * (N - 2)))} > ${frPlain(mean)}`,
    ansB: `пусть в группах по ${N / 2} чисел с суммами s и ${T} − s. Тогда A + B = ${"s/" + N / 2} + (${T} − s)/${N / 2} = ${T}/${N / 2}, поэтому (A + B)/2 = ${T}/${N} = ${frPlain(mean)} — это и есть среднее арифметическое всех чисел`,
    ansC: `${frPlain(best)}; достигается, когда в одной группе единственное число «${v1}»`,
    solution: `Пусть в первой группе n чисел с суммой s, тогда во второй ${N} − n чисел с суммой ${T} − s, и\n(A + B)/2 = (s/n + (${T} − s)/(${N} − n))/2.\nб) При n = ${N / 2} получаем (s + ${T} − s)/${N} = ${T}/${N} = ${frPlain(mean)} — среднее всех чисел, что и требовалось.\nа) При n ≠ ${N / 2} равенства уже нет: например, если первая группа состоит из ${grp(exA.g1)}, то (A + B)/2 = ${frPlain(fr(v1 * (N - 2) + T - 2 * v1, 2 * (N - 2)))} — больше среднего всех чисел ${frPlain(mean)}.\nв) При фиксированном n выражение линейно по s с коэффициентом (1/n − 1/(${N} − n))/2, положительным при n < ${N / 2}. Значит в меньшую группу выгодно брать самые большие числа, и наилучший случай — группа из единственного числа «${v1}»: (A + B)/2 = (${v1} + ${frPlain(fr(T - v1, N - 1))})/2 = ${frPlain(best)}.\nОтвет: ${frPlain(best)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: "less-than-half-sum" },
        b: { type: "count", value: 0 },
        c: { type: "value", value: frVal(best), example: exC },
      },
      mustMention: [N, c, v1, v2, v3, N / 2],
      extra: [2],
      phrases: ["на две группы", "хотя бы одно число"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 10 (продолжение). Медиана и среднее выборки нечётных чисел (#88)
// ═══════════════════════════════════════════════════════════════════════════

// Из K последовательных нечётных чисел 1, 3, …, 2K−1 выбирают n = 2h+1 различных;
// A — серединное (h+1-е) из выбранных, B — их среднее. Тогда
//   B − A = (Σ(aᵢ − A))/n,
// а все разности выбранных чисел ЧЁТНЫ, поэтому числитель чётен: дробь с нечётным
// числителем недостижима. Максимум даёт наименьшая возможная медиана A = 2h+1
// (под ней стоят 1, 3, …, 2h−1), а сверху берутся h наибольших чисел:
//   B − A = 2h(K − 2h − 1)/n.
export function t19MeansOddMedian() {
  const h = 3, n = 2 * h + 1
  const K = pick([30, 36, 40, 45, 50])
  const top = 2 * K - 1
  const maxFr = fr(2 * h * (K - 2 * h - 1), n)
  const numA = 2, numB = 3                                 // числители в пунктах а) и б)
  // а) пример на 2/n: медиана x, снизу x−2h+…, сверху почти симметрично, «перевес» 2
  let exA = null
  for (let x = 2 * h + 1; x <= top - 2 * h && !exA; x += 2) {
    const low = Array.from({ length: h }, (_, i) => x - 2 * (h - i))
    const high = Array.from({ length: h }, (_, i) => x + 2 * (i + 1))
    const need = numA + 6 * x - sum(low) - sum(high)        // сколько добрать сверху
    if (need % 2 === 0 && need >= 0 && high[h - 1] + need <= top) {
      high[h - 1] += need
      exA = [...low, x, ...high]
    }
  }
  if (!exA) return null
  const exC = [
    ...Array.from({ length: h }, (_, i) => 2 * i + 1), 2 * h + 1,
    ...Array.from({ length: h }, (_, i) => top - 2 * (h - 1 - i)),
  ]

  const params = { K, h, n, numA, numB }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length !== n) return `нужно выбрать ${n} чисел`
    for (const v of cfg) if (!Number.isInteger(v) || v < 1 || v > top || v % 2 === 0) return `${v} — не из набора 1, 3, …, ${top}`
    if (uniq(cfg).length !== cfg.length) return "числа обязаны быть различными"
    const s = cfg.slice().sort((a, b) => a - b)
    const A = s[h], B = sum(s) / n
    const want = part === "a" ? numA / n : frVal(maxFr)
    if (Math.abs(B - A - want) > 1e-9) return `B − A = ${B - A}, а нужно ${want}`
    return null
  }
  // Независимый перебор: медиана x, затем динамика по суммам h чисел снизу и h сверху.
  const solve = (P) => {
    const hh = P.h, nn = P.n, hi = 2 * P.K - 1
    let aYes = false, bYes = false, best = -Infinity
    for (let x = 1; x <= hi; x += 2) {
      const low = [], high = []
      for (let v = 1; v < x; v += 2) low.push(v)
      for (let v = x + 2; v <= hi; v += 2) high.push(v)
      if (low.length < hh || high.length < hh) continue
      const maxLow = sum(low.slice(-hh)), maxHigh = sum(high.slice(-hh))
      const rowsLow = knap(low, hh, maxLow), rowsHigh = knap(high, hh, maxHigh)
      best = Math.max(best, (maxLow + maxHigh - 2 * hh * x) / nn)
      for (let sl = 0; sl <= maxLow; sl++) {
        if (!rowsLow[hh][sl]) continue
        for (const t of [P.numA, P.numB]) {
          const sh = t + 2 * hh * x - sl
          if (sh >= 0 && sh <= maxHigh && rowsHigh[hh][sh]) { if (t === P.numA) aYes = true; else bYes = true }
        }
      }
    }
    return { a: aYes, b: bYes, c: best }
  }

  return item({
    preamble: `Из ${K} последовательных нечётных чисел 1, 3, 5, …, ${top} выбрали ${n} различных чисел, которые записали в порядке возрастания. Пусть A — ${h + 1 === 4 ? "четвёртое" : `${h + 1}-е`} по величине среди этих чисел, а B — среднее арифметическое выбранных ${n} чисел.`,
    qa: `Может ли B − A равняться ${frCond(fr(numA, n))}?`,
    qb: `Может ли B − A равняться ${frCond(fr(numB, n))}?`,
    qc: `Найдите наибольшее возможное значение B − A.`,
    ansA: `да, например ${exA.join(", ")}`,
    ansB: `нет: B − A = (Σ(aᵢ − A))/${n}, а все выбранные числа нечётны, поэтому каждая разность aᵢ − A чётна и числитель чётен. Дробь ${frPlain(fr(numB, n))} имеет нечётный числитель`,
    ansC: `${frPlain(maxFr)}; например ${exC.join(", ")}`,
    solution: `Пусть выбраны a₁ < a₂ < … < ${aIdx(n)}, тогда A = ${aIdx(h + 1)} и\nB − A = (a₁ + … + ${aIdx(n)} − ${n}A)/${n} = ((a₁ − A) + … + (${aIdx(n)} − A))/${n}.\nа) Пример: ${exA.join(", ")}.\nб) Все числа нечётны, поэтому все разности aᵢ − A чётны, и числитель дроби чётен. У дроби ${frPlain(fr(numB, n))} числитель нечётный, значит такое значение невозможно.\nв) Числитель равен (сумма ${h} наибольших) + (сумма ${h} наименьших) − ${2 * h}A, поэтому выгодно взять наименьшую возможную медиану A = ${2 * h + 1} (под ней стоят 1, 3, …, ${2 * h - 1}) и ${h} наибольших чисел ${top - 2 * (h - 1)}, …, ${top}. Тогда B − A = ${2 * h}(${K} − ${2 * h + 1})/${n} = ${frPlain(maxFr)}.\nОтвет: ${frPlain(maxFr)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `num-${numA}` },
        b: { type: "yesno", yes: false, reason: "even-numerator", target: `num-${numB}` },
        c: { type: "value", value: frVal(maxFr), example: exC },
      },
      mustMention: [K, top, n, 1, 3, 5, numA, numB],
      extra: [h + 1],
      phrases: ["последовательных нечётных чисел", "в порядке возрастания"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 10 (продолжение). Числа уменьшили вдвое, малые стёрли (#94)
// ═══════════════════════════════════════════════════════════════════════════

// N натуральных чисел, каждое ≤ M, среднее равно u (сумма Nu). Каждое число заменяют
// на вдвое меньшее; ставшие меньше 1 (то есть бывшие единицы) стирают. Если единиц
// было m, то осталось N − m чисел с суммой (Nu − m)/2, и среднее равно
//   f(m) = (Nu − m) / (2(N − m)),
// то есть множество возможных средних КОНЕЧНО — это значения f(m) при допустимых m.
// Допустимость: остальные N − m чисел не больше M, поэтому m + (N − m)M ≥ Nu.
export function t19MeansEraseHalf() {
  const N = pick([24, 30, 36])
  const M = pick([40, 45, 50])
  const u = randInt(6, 9)
  const mMax = Math.floor((N * M - N * u) / (M - 1))
  if (mMax >= N || mMax < 3) return null
  const fm = (m) => fr(N * u - m, 2 * (N - m))
  const best = fm(mMax)
  const vals = []
  for (let m = 0; m <= mMax; m++) vals.push(frVal(fm(m)))
  // б) целочисленный «зазор» (p; p+1), в который не попадает ни одно значение
  let gap = 0
  for (let p = Math.floor(u / 2); p < frVal(best); p++) {
    if (!vals.some((v) => v > p && v < p + 1)) { gap = p; break }
  }
  if (!gap) return null
  // а) «больше X»: значение, которое максимум превосходит
  const Xa = Math.max(gap + 1, Math.floor(frVal(best)) - randInt(1, 3))
  if (Xa >= frVal(best)) return null
  const mk = (m) => {
    const rest = Array(N - m).fill(M)
    let over = (N - m) * M - (N * u - m)
    for (let i = 0; i < rest.length && over > 0; i++) {
      const cut = Math.min(over, M - 2)
      rest[i] -= cut; over -= cut
    }
    return over === 0 ? [...Array(m).fill(1), ...rest] : null
  }
  const exC = mk(mMax)
  if (!exC) return null

  const params = { N, M, u, mMax, gap, Xa }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length !== N) return `чисел должно быть ${N}`
    for (const v of cfg) if (!Number.isInteger(v) || v < 1 || v > M) return `${v} — не натуральное число, не превосходящее ${M}`
    if (sum(cfg) !== N * u) return `среднее написанных чисел ${sum(cfg) / N}, а не ${u}`
    const after = cfg.map((v) => v / 2).filter((v) => v >= 1)
    if (!after.length) return "на доске не осталось чисел"
    const mean = sum(after) / after.length
    if (part === "a" && !(mean > Xa)) return `среднее оставшихся ${mean}, не больше ${Xa}`
    if (part === "c" && Math.abs(mean - frVal(best)) > 1e-9) return `среднее оставшихся ${mean}, а заявлено ${frPlain(best)}`
    return null
  }
  // Независимый перебор по числу единиц m: конфигурация возможна, когда m единиц
  // и N − m чисел от 2 до M дают в сумме Nu.
  const solve = (P) => {
    let aYes = false, bYes = false, best2 = -Infinity
    for (let m = 0; m < P.N; m++) {
      const rest = P.N * P.u - m, cnt = P.N - m
      if (rest < 2 * cnt || rest > P.M * cnt) continue      // остальные числа от 2 до M
      const mean = rest / (2 * cnt)
      if (mean > P.Xa) aYes = true
      if (mean > P.gap && mean < P.gap + 1) bYes = true
      if (mean > best2) best2 = mean
    }
    return { a: aYes, b: bYes, c: best2 }
  }

  const short = (arr) => `${arr.slice(0, 3).join(", ")}, …, ${arr[arr.length - 1]}`
  return item({
    preamble: `На доске было написано ${N} ${plural(N, "натуральное число", "натуральных числа", "натуральных чисел")} (необязательно различных), каждое из которых не превосходит ${M}. Среднее арифметическое написанных чисел равнялось ${u}. Вместо каждого из чисел на доске написали число, в два раза меньшее первоначального. Числа, которые после этого оказались меньше 1, с доски стёрли.`,
    qa: `Могло ли оказаться так, что среднее арифметическое чисел, оставшихся на доске, больше ${Xa}?`,
    qb: `Могло ли среднее арифметическое оставшихся на доске чисел оказаться больше ${gap}, но меньше ${gap + 1}?`,
    qc: `Найдите наибольшее возможное значение среднего арифметического чисел, которые остались на доске.`,
    ansA: `да, например ${mMax} ${plural(mMax, "единица", "единицы", "единиц")} и ${N - mMax} ${plural(N - mMax, "число", "числа", "чисел")} ${short(exC.slice(mMax))}: после деления пополам остаётся ${N - mMax} ${plural(N - mMax, "число", "числа", "чисел")} со средним ${frPlain(best)} > ${Xa}`,
    ansB: `нет: если единиц было m, то они (и только они) стираются, остаётся ${N} − m чисел с суммой (${N * u} − m)/2, поэтому среднее равно (${N * u} − m)/(2(${N} − m)). Перебор допустимых m даёт лишь конечный список значений, и ни одно из них не лежит строго между ${gap} и ${gap + 1}`,
    ansC: `${frPlain(best)}; например ${mMax} ${plural(mMax, "единица", "единицы", "единиц")} и числа ${short(exC.slice(mMax))}`,
    solution: `После деления пополам стираются в точности бывшие единицы (0,5 < 1). Пусть их было m. Тогда осталось ${N} − m чисел, сумма которых равна (${N * u} − m)/2, и\nсреднее = (${N * u} − m)/(2(${N} − m)).\nЭто выражение растёт по m, а m ограничено вместимостью: остальные ${N} − m чисел не больше ${M}, поэтому m + (${N} − m)·${M} ≥ ${N * u}, откуда m ≤ ${mMax}.\nа) При m = ${mMax} среднее равно ${frPlain(best)} > ${Xa}.\nб) Возможные средние образуют конечный список значений (по одному на каждое допустимое m), и между ${gap} и ${gap + 1} ни одного из них нет.\nв) Наибольшее значение достигается при m = ${mMax}: ${frPlain(best)}; пример набора — ${mMax} ${plural(mMax, "единица", "единицы", "единиц")} и числа ${short(exC.slice(mMax))}.\nОтвет: ${frPlain(best)}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exC, target: `gt-${Xa}` },
        b: { type: "yesno", yes: false, reason: "discrete-values", target: `between-${gap}` },
        c: { type: "value", value: frVal(best), example: exC },
      },
      mustMention: [N, M, u, Xa, gap, gap + 1, 1],
      extra: [2],
      phrases: ["в два раза меньшее первоначального", "оказались меньше 1"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 10 (окончание). Последовательные усреднения пяти чисел (#32)
// ═══════════════════════════════════════════════════════════════════════════

// Берут n различных натуральных чисел и последовательно усредняют: сначала первые два,
// потом результат с третьим и так далее. Итог — взвешенная сумма
//   A = a₁/2ⁿ⁻¹ + a₂/2ⁿ⁻¹ + a₃/2ⁿ⁻² + … + aₙ/2,
// где все веса не больше 1/2 и в сумме дают 1. Отсюда A ≤ (a₁ + … + aₙ)/2, причём
// неравенство строгое (веса первых чисел строго меньше 1/2), поэтому
//   A/M = n·A/(a₁ + … + aₙ) < n/2.
// Значит «в n раз больше» невозможно, а наибольшее целое отношение равно ⌈n/2⌉ − 1.
export function t19MeansIterated5() {
  const n = pick([5, 6, 7])
  const W = Array.from({ length: n }, (_, i) => (i === 0 ? 1 / 2 ** (n - 1) : 1 / 2 ** (n - i)))
  const den = 2 ** (n - 1)
  const wInt = W.map((w) => w * den)                       // целые веса при общем знаменателе
  const kMax = Math.ceil(n / 2) - 1
  const Xb = n                                             // «в n раз» — заведомо нельзя
  // Поиск примеров: перебираем первые n−1 чисел, последнее вычисляем из уравнения
  // n·Σwᵢaᵢ = k·Σaᵢ. Диапазон первых чисел мал: их рост только уменьшает отношение.
  const findEx = (k) => {
    const heads = []
    const rec = (i, cur) => {
      if (heads.length) return
      if (i === n - 1) {
        // n·(Σ_{i<n} wᵢaᵢ + wₙ·x) = k·(Σ_{i<n} aᵢ + x)
        const c1 = cur.reduce((s, v, idx) => s + wInt[idx] * v, 0)
        const c2 = sum(cur)
        const numr = k * c2 * den - n * c1
        const denr = n * wInt[n - 1] - k * den
        if (denr === 0 || numr % denr) return
        const x = numr / denr
        if (Number.isInteger(x) && x >= 1 && !cur.includes(x)) heads.push([...cur, x])
        return
      }
      for (let v = 1; v <= 12; v++) { if (cur.includes(v)) continue; cur.push(v); rec(i + 1, cur); cur.pop() }
    }
    rec(0, [])
    return heads[0] || null
  }
  const exA = findEx(1)
  const exC = findEx(kMax)
  if (!exA || !exC) return null

  const params = { n, kMax, Xb, den, wInt }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length !== n) return `нужно ${n} чисел`
    for (const v of cfg) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное число`
    if (uniq(cfg).length !== cfg.length) return "числа обязаны быть различными"
    let A = (cfg[0] + cfg[1]) / 2
    for (let i = 2; i < n; i++) A = (A + cfg[i]) / 2
    const M = sum(cfg) / n
    const want = part === "a" ? 1 : kMax
    if (Math.abs(A - want * M) > 1e-9) return `A = ${A}, а среднее ${M}: отношение ${A / M}, а нужно ${want}`
    return null
  }
  // Независимый перебор: первые n−1 чисел из окна 1…12, последнее вычисляется из
  // требуемого отношения. Окно обосновано тем, что рост первых чисел только уменьшает
  // отношение A/M (их веса меньше 1/n), а «нет» опирается на оценку A/M < n/2.
  const solve = (P) => {
    const reach = (k) => {
      let ok = false
      const rec = (i, cur) => {
        if (ok) return
        if (i === P.n - 1) {
          const c1 = cur.reduce((s, v, idx) => s + P.wInt[idx] * v, 0)
          const numr = k * sum(cur) * P.den - P.n * c1
          const denr = P.n * P.wInt[P.n - 1] - k * P.den
          if (denr === 0 || numr % denr) return
          const x = numr / denr
          if (Number.isInteger(x) && x >= 1 && !cur.includes(x)) ok = true
          return
        }
        for (let v = 1; v <= 12; v++) { if (cur.includes(v)) continue; cur.push(v); rec(i + 1, cur); cur.pop() }
      }
      rec(0, [])
      return ok
    }
    let best = 0
    for (let k = 1; k < P.n; k++) if (reach(k)) best = k
    return { a: reach(1), b: reach(P.Xb), c: best, c_next: false }
  }

  const NUMW = { 5: "пять", 6: "шесть", 7: "семь" }
  const NUMG = { 5: "пяти", 6: "шести", 7: "семи" }   // родительный падеж
  const ORDW = ["первых двух", "третьего", "четвёртого", "пятого", "шестого", "седьмого"]
  const steps = []
  for (let i = 2; i < n; i++) steps.push(`затем среднее арифметическое полученного результата и ${ORDW[i - 1]} числа`)
  return item({
    preamble: `Саша берёт ${NUMW[n]} различных натуральных чисел и проделывает с ними следующие операции: сначала вычисляет среднее арифметическое первых двух чисел, ${steps.join(", ")}. Полученное в конце число обозначено A.`,
    qa: `Может ли число A равняться среднему арифметическому начальных ${NUMG[n]} чисел?`,
    qb: `Может ли число A быть больше среднего арифметического начальных ${NUMG[n]} чисел в ${NUMW[Xb] || Xb} раз?`,
    qc: `В какое наибольшее целое число раз число A может быть больше среднего арифметического начальных ${NUMG[n]} чисел?`,
    ansA: `да, например ${exA.join(", ")}`,
    ansB: `нет: A = ${wInt.map((w, i) => `${w === 1 ? "" : w}${aIdx(i + 1)}`).join(" + ")}, делённое на ${den}, то есть A — взвешенная сумма чисел с весами, не превосходящими ${frPlain(fr(1, 2))}, поэтому A < (a₁ + … + ${aIdx(n)})/2 и A/M < ${frPlain(fr(n, 2))} < ${Xb}`,
    ansC: `${kMax}; например ${exC.join(", ")}`,
    solution: `Раскроем операции: A = (${wInt.map((w, i) => `${w === 1 ? "" : w}${aIdx(i + 1)}`).join(" + ")})/${den}. Все веса не больше ${frPlain(fr(1, 2))}, а их сумма равна 1.\nа) Пример, когда A равно среднему M: ${exA.join(", ")}.\nб) Так как каждый вес не больше ${frPlain(fr(1, 2))}, то A ≤ (a₁ + … + ${aIdx(n)})/2, причём равенство невозможно (у первых чисел веса строго меньше). Значит\nA/M = ${n}A/(a₁ + … + ${aIdx(n)}) < ${frPlain(fr(n, 2))},\nи A не может быть больше M в ${Xb} раз.\nв) Из той же оценки целое отношение не превосходит ${kMax}, и оно достигается: ${exC.join(", ")}.\nОтвет: ${kMax}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: "equal-mean" },
        b: { type: "yesno", yes: false, reason: "weights-bound", target: `times-${Xb}` },
        c: { type: "extremum", mode: "max", value: kMax, example: exC },
      },
      mustMention: [],
      extra: [],
      phrases: ["различных натуральных чисел", "среднее арифметическое первых двух чисел"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 11. Средние в контейнере: лёгкие, тяжёлые и ровно средние (#69)
// ═══════════════════════════════════════════════════════════════════════════

// В ящике N предметов целой массы, средняя масса всех равна M; средняя масса тех,
// что легче M, равна p, средняя масса тех, что тяжелее M, равна q. Если лёгких a,
// тяжёлых b, а ровно M весят c = N − a − b, то
//   pa + qb + M(N − a − b) = MN  ⟹  (M − p)a = (q − M)b,
// то есть a : b = (q − M) : (M − p) — жёсткая пропорция. Отсюда и «поровну не бывает»,
// и оценка на число предметов ровно в M граммов, и наибольшая масса:
// у b тяжёлых предметов суммарная масса qb, а каждый не легче M + 1, поэтому
// максимум одного равен qb − (M + 1)(b − 1) и достигается при наибольшем b.
function boxMeanFamily(mode) {
  const M = mode === "max" ? 100 : 1000
  // подбираем (p, q, N) так, чтобы фруктов ровно по M граммов оставалось не меньше трёх:
  // иначе пункт б) выродился бы в вопрос «меньше нуля фруктов»
  const opts = []
  const D1 = mode === "max" ? [25, 27, 30] : [18, 20, 24]
  const D2 = mode === "max" ? [12, 15, 18] : [24, 30, 32]
  for (const d1 of D1) {
    for (const d2 of D2) {
      const g0 = gcdI(d1, d2), u0 = d2 / g0, v0 = d1 / g0
      for (const N0 of (mode === "max" ? [95, 100, 110, 120] : [60, 65, 70, 75])) {
        const t0 = Math.floor(N0 / (u0 + v0))
        const c0 = N0 - (u0 + v0) * t0
        if (t0 >= 2 && c0 >= 3) opts.push({ d1, d2, u: u0, v: v0, N: N0, tMax: t0, cMin: c0 })
      }
    }
  }
  if (!opts.length) return null
  const { d1, d2, u, v, N, tMax, cMin } = pick(opts)
  const p = M - d1, q = M + d2
  const aMax = u * tMax, bMax = v * tMax
  // max: самый тяжёлый предмет среди тяжёлых; min: самый лёгкий среди лёгких
  const extreme = mode === "max"
    ? q * bMax - (M + 1) * (bMax - 1)
    : p * aMax - (M - 1) * (aMax - 1)
  if (extreme < 1 || extreme > 99999) return null
  // пункт б): max — «меньше cMin предметов ровно по M г»; min — «ровно Xb предметов»,
  // где Xb не имеет вида N − (u+v)t
  let Xb = cMin
  if (mode === "min") {
    const reachable = new Set()
    for (let t = 0; t <= tMax; t++) reachable.add(N - (u + v) * t)
    Xb = 0
    for (let cand = cMin + 1; cand <= cMin + 4 * (u + v); cand++) if (!reachable.has(cand)) { Xb = cand; break }
    if (!Xb) return null
  }
  const thing = mode === "max" ? "фрукт" : "овощ"
  const things = mode === "max" ? "фруктов" : "овощей"        // родительный
  const thingsNom = mode === "max" ? "фрукты" : "овощи"      // именительный

  const params = { N, M, p, q, u, v, Xb, mode }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length !== N) return `предметов должно быть ${N}`
    for (const w of cfg) if (!Number.isInteger(w) || w < 1) return `${w} — не целая положительная масса`
    if (uniq(cfg).length < 2) return "в ящике должны быть предметы различной массы"
    if (sum(cfg) !== M * N) return `средняя масса ${sum(cfg) / N}, а не ${M}`
    const light = cfg.filter((w) => w < M), heavy = cfg.filter((w) => w > M)
    if (light.length && sum(light) !== p * light.length) return `средняя масса лёгких ${sum(light) / light.length}, а не ${p}`
    if (heavy.length && sum(heavy) !== q * heavy.length) return `средняя масса тяжёлых ${sum(heavy) / heavy.length}, а не ${q}`
    if (part === "c") {
      const got = mode === "max" ? Math.max(...cfg) : Math.min(...cfg)
      if (got !== extreme) return `${mode === "max" ? "наибольшая" : "наименьшая"} масса ${got}, а заявлено ${extreme}`
    }
    return null
  }
  // Независимый перебор по числу лёгких a и тяжёлых b: набор существует, когда
  // pa + qb + M(N − a − b) = MN, лёгкие помещаются в 1…M−1, тяжёлые — от M+1.
  const solve = (P) => {
    let equal = false, hitB = false, best = P.mode === "max" ? -Infinity : Infinity
    for (let a = 0; a <= P.N; a++) {
      for (let b = 0; a + b <= P.N; b++) {
        if (P.p * a + P.q * b + P.M * (P.N - a - b) !== P.M * P.N) continue
        if (a && (P.p * a < a || P.p * a > a * (P.M - 1))) continue
        if (b && P.q * b < (P.M + 1) * b) continue
        if (a + b === 0) continue                            // тогда все массы равны M
        if (a === b) equal = true
        if (P.mode === "max") {
          if (P.N - a - b < P.Xb) hitB = true
          if (b) best = Math.max(best, P.q * b - (P.M + 1) * (b - 1))
        } else {
          if (P.N - a - b === P.Xb) hitB = true
          if (a) best = Math.min(best, P.p * a - (P.M - 1) * (a - 1))
        }
      }
    }
    return { a: equal, b: hitB, c: best, c_next: false }
  }

  const exC = mode === "max"
    ? [...Array(aMax).fill(p), ...Array(bMax - 1).fill(M + 1), extreme, ...Array(cMin).fill(M)]
    : [extreme, ...Array(aMax - 1).fill(M - 1), ...Array(bMax).fill(q), ...Array(cMin).fill(M)]
  const qbText = mode === "max"
    ? `Могло ли в ящике оказаться меньше ${Xb} ${things}, масса каждого из которых равна ${M} г?`
    : `Могло ли в ящике оказаться ровно ${Xb} ${things}, масса каждого из которых равна ${M} г?`
  const ansBText = mode === "max"
    ? `нет: из a : b = ${u} : ${v} следует a = ${u}t и b = ${v}t, поэтому ${things} ровно по ${M} г остаётся ${N} − ${u + v}t. Так как ${u + v}t ≤ ${N}, получаем t ≤ ${tMax} и таких ${things} не меньше ${cMin}`
    : `нет: из a : b = ${u} : ${v} следует a = ${u}t и b = ${v}t, поэтому ${things} ровно по ${M} г остаётся ${N} − ${u + v}t. Число ${Xb} такого вида не имеет: ${N} − ${Xb} = ${N - Xb} не делится на ${u + v}`
  const ansCText = mode === "max"
    ? `${extreme}; например ${aMax} ${things} по ${p} г, ${bMax - 1} по ${M + 1} г, один в ${extreme} г и ${cMin} по ${M} г`
    : `${extreme}; например один ${thing} в ${extreme} г, ${aMax - 1} по ${M - 1} г, ${bMax} по ${q} г и ${cMin} по ${M} г`
  const solC = mode === "max"
    ? `в) Суммарная масса тяжёлых ${things} равна ${q}b, каждый из них весит не меньше ${M + 1} г, поэтому один может весить не больше ${q}b − ${M + 1}(b − 1). Это выражение растёт по b, а b = ${v}t ≤ ${bMax}. При t = ${tMax} получаем ${extreme} г.`
    : `в) Суммарная масса лёгких ${things} равна ${p}a, каждый из них весит не больше ${M - 1} г, поэтому один может весить не меньше ${p}a − ${M - 1}(a − 1). Это выражение убывает по a, а a = ${u}t ≤ ${aMax}. При t = ${tMax} получаем ${extreme} г.`

  return item({
    preamble: `В ящике лежит ${N} ${things}, масса каждого из которых выражается целым числом граммов. В ящике есть хотя бы два ${thing}а различной массы, а средняя масса всех ${things} равна ${M} г. Средняя масса ${things}, масса каждого из которых меньше ${M} г, равна ${p} ${plural(p, "грамм", "грамма", "граммов")}. Средняя масса ${things}, масса каждого из которых больше ${M} г, равна ${q} г.`,
    qa: `Могло ли в ящике оказаться поровну ${things} массой меньше ${M} г и ${things} массой больше ${M} г?`,
    qb: qbText,
    qc: `Какую ${mode === "max" ? "наибольшую" : "наименьшую"} массу может иметь ${thing} в этом ящике?`,
    ansA: `нет: если лёгких a, а тяжёлых b, то ${d1}a = ${d2}b, то есть a : b = ${u} : ${v}. Равенство a = b возможно лишь при a = b = 0, но тогда все ${thingsNom} весят по ${M} г и различных масс в ящике нет`,
    ansB: ansBText,
    ansC: ansCText,
    solution: `Пусть в ящике a ${things} легче ${M} г, b ${things} тяжелее ${M} г и c = ${N} − a − b ровно по ${M} г. Тогда\n${p}a + ${q}b + ${M}c = ${M * N}, откуда ${d1}a = ${d2}b, то есть a : b = ${u} : ${v}, a = ${u}t, b = ${v}t.\nа) Равенство a = b означало бы t = 0, то есть все ${thingsNom} весят по ${M} г — но в ящике есть предметы различной массы.\nб) Количество ${things} ровно по ${M} г равно ${N} − ${u + v}t, где t ≤ ${tMax}.\n${solC}\nОтвет: ${extreme}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: false, reason: "ratio-fixed", target: "equal-counts" },
        b: { type: "yesno", yes: false, reason: "count-bound", target: `count-${Xb}` },
        c: { type: "extremum", mode, value: extreme, example: exC },
      },
      mustMention: [N, M, p, q, Xb],
      extra: [],
      phrases: ["целым числом граммов", "различной массы"],
    },
  })
}
export function t19BoxMeanSplitMax() { return boxMeanFamily("max") }
export function t19BoxMeanSplitMin() { return boxMeanFamily("min") }

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 11 (продолжение). Записи по дням: сумма растёт, количество убывает (#65)
// ═══════════════════════════════════════════════════════════════════════════

// n дней подряд записывают натуральные числа, каждое меньше B. Пусть в день i записано
// kᵢ чисел с суммой sᵢ. Тогда kᵢ ≤ sᵢ ≤ (B−1)kᵢ, причём k строго убывает, а s строго
// растёт. Отсюда (B−1)kₙ ≥ sₙ ≥ s₁ + (n−1) ≥ k₁ + (n−1) ≥ kₙ + 2(n−1), то есть
//   kₙ ≥ 2(n−1)/(B−2),
// и наименьшее общее количество чисел равно n·kₙ + n(n−1)/2 при kᵢ = kₙ + (n−i).
// Если же задана сумма первого дня s₁ = S, то k₁ ≤ S и по той же цепочке
//   S + (n−1) ≤ (B−1)(S − (n−1)), откуда n ≤ 1 + (B−2)S/B.
export function t19DaysSumUpCountDown() {
  const B = 6                                              // числа от 1 до B−1
  const n = pick([5, 6, 7])
  const S1 = pick([7, 9, 11, 13])
  const nMaxByS1 = Math.floor(1 + (B - 2) * S1 / B)
  const Xa = nMaxByS1 + randInt(1, 2)                       // «может ли n быть больше Xa» — нет
  const kLast = Math.ceil(2 * (n - 1) / (B - 2))
  const minTotal = n * kLast + n * (n - 1) / 2
  const kSeq = Array.from({ length: n }, (_, i) => kLast + (n - 1 - i))
  // жадные суммы: sᵢ = max(kᵢ, sᵢ₋₁ + 1), проверяем sᵢ ≤ (B−1)kᵢ
  const sSeq = []
  for (let i = 0; i < n; i++) {
    const s = Math.max(kSeq[i], (sSeq[i - 1] ?? 0) + 1)
    if (s > (B - 1) * kSeq[i]) return null
    sSeq.push(s)
  }
  // б) первый день со средним < Yb, а все дни — со средним > Zb
  const Yb = 2, Zb = 2.5
  const k1 = 5, s1 = 9, k2 = 4, s2 = (B - 1) * k2
  const exB = [{ k: k1, s: s1 }, { k: k2, s: s2 }]
  if (!(s1 / k1 < Yb && (s1 + s2) / (k1 + k2) > Zb && s2 > s1 && k2 < k1)) return null
  const exC = kSeq.map((k, i) => ({ k, s: sSeq[i] }))

  const params = { B, n, S1, Xa, Yb, Zb }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length < 2) return "нужно хотя бы два дня"
    for (const d of cfg) {
      if (!d || !Number.isInteger(d.k) || !Number.isInteger(d.s)) return "день задаётся количеством и суммой"
      if (d.k < 1) return "в день записывают хотя бы одно число"
      if (d.s < d.k || d.s > (B - 1) * d.k) return `сумму ${d.s} нельзя набрать ${d.k} числами, меньшими ${B}`
    }
    for (let i = 1; i < cfg.length; i++) {
      if (cfg[i].s <= cfg[i - 1].s) return `сумма в день ${i + 1} не больше, чем в предыдущий`
      if (cfg[i].k >= cfg[i - 1].k) return `количество чисел в день ${i + 1} не меньше, чем в предыдущий`
    }
    if (part === "b") {
      if (!(cfg[0].s / cfg[0].k < Yb)) return `среднее первого дня ${cfg[0].s / cfg[0].k}, а нужно меньше ${Yb}`
      const all = sum(cfg.map((d) => d.s)) / sum(cfg.map((d) => d.k))
      if (!(all > Zb)) return `среднее всех чисел ${all}, а нужно больше ${Zb}`
    }
    if (part === "c") {
      if (cfg.length !== n) return `дней должно быть ${n}`
      if (sum(cfg.map((d) => d.k)) !== minTotal) return `записано ${sum(cfg.map((d) => d.k))} чисел, а заявлено ${minTotal}`
    }
    return null
  }
  // Независимый перебор: все строго убывающие наборы (k₁ > … > kₙ) с суммой не больше
  // предела; для каждого — жадная проверка существования строго растущих сумм
  // sᵢ = max(kᵢ, sᵢ₋₁ + 1) ≤ (B−1)kᵢ (жадный выбор оптимален: меньшая сумма никогда
  // не мешает следующему дню).
  const solve = (P) => {
    const feasible = (ks, s1fixed) => {
      let prev = 0
      for (let i = 0; i < ks.length; i++) {
        let s = Math.max(ks[i], prev + 1)
        if (i === 0 && s1fixed) { if (s1fixed < ks[i] || s1fixed > (P.B - 1) * ks[i]) return false; s = s1fixed }
        if (s > (P.B - 1) * ks[i]) return false
        prev = s
      }
      return true
    }
    // а): существует ли n > Xa дней при заданной сумме первого дня
    let aYes = false
    for (let m = P.Xa + 1; m <= 14 && !aYes; m++) {
      const rec = (idx, prevK, ks) => {
        if (aYes) return
        if (idx === m) { if (feasible(ks, P.S1)) aYes = true; return }
        for (let k = prevK - 1; k >= 1; k--) { ks.push(k); rec(idx + 1, k, ks); ks.pop() }
      }
      for (let k1 = 1; k1 <= P.S1 && !aYes; k1++) rec(1, k1, [k1])
    }
    // в): наименьшая сумма количеств при ровно n днях
    let best = Infinity
    const rec2 = (idx, prevK, ks, tot) => {
      if (tot >= best) return
      if (idx === P.n) { if (feasible(ks, null)) best = Math.min(best, tot); return }
      for (let k = prevK - 1; k >= 1; k--) rec2(idx + 1, k, [...ks, k], tot + k)
    }
    for (let k1 = 1; k1 <= 40; k1++) rec2(1, k1, [k1], k1)
    return { a: aYes, b: true, c: best, c_next: false }
  }

  const showDays = (arr) => arr.map((d, i) => `в ${i + 1}-й день ${d.k} ${plural(d.k, "число", "числа", "чисел")} с суммой ${d.s}`).join(", ")
  return item({
    preamble: `В течение n дней каждый день на доску записывают натуральные числа, каждое из которых меньше ${B}. При этом каждый день (кроме первого) сумма чисел, записанных на доску в этот день, больше, а количество чисел меньше, чем в предыдущий день.`,
    qa: `Известно, что сумма чисел, записанных в первый день, равна ${S1}. Может ли n быть больше ${Xa}?`,
    qb: `Может ли среднее арифметическое чисел, записанных в первый день, быть меньше ${Yb}, а среднее арифметическое всех чисел, записанных за все дни, быть больше ${ru2(Zb)}?`,
    qc: `Известно, что n = ${n}. Какое наименьшее количество чисел могло быть записано за все эти дни?`,
    ansA: `нет: числа натуральные, поэтому k₁ ≤ s₁ = ${S1}, а количество чисел убывает, значит kₙ ≤ ${S1} − (n − 1). С другой стороны sₙ ≥ ${S1} + (n − 1) и sₙ ≤ ${B - 1}kₙ, откуда ${S1} + (n − 1) ≤ ${B - 1}(${S1} − (n − 1)) и n ≤ ${nMaxByS1}`,
    ansB: `да, например ${showDays(exB)}: среднее первого дня ${ru2(s1 / k1)} < ${Yb}, а среднее всех чисел ${frPlain(fr(s1 + s2, k1 + k2))} > ${ru2(Zb)}`,
    ansC: `${minTotal}; например ${showDays(exC)}`,
    solution: `Пусть в день i записано kᵢ чисел с суммой sᵢ. Все числа натуральные и меньше ${B}, поэтому kᵢ ≤ sᵢ ≤ ${B - 1}kᵢ.\nа) Так как k строго убывает, kₙ ≤ k₁ − (n − 1) ≤ ${S1} − (n − 1); так как s строго растёт, sₙ ≥ ${S1} + (n − 1). Из sₙ ≤ ${B - 1}kₙ получаем ${S1} + (n − 1) ≤ ${B - 1}(${S1} − (n − 1)), то есть n ≤ ${nMaxByS1}. Значит n больше ${Xa} быть не может.\nб) Пример: ${showDays(exB)}. Среднее первого дня равно ${ru2(s1 / k1)}, а всех чисел — ${frPlain(fr(s1 + s2, k1 + k2))}.\nв) Цепочка ${B - 1}kₙ ≥ sₙ ≥ s₁ + (n − 1) ≥ k₁ + (n − 1) ≥ kₙ + 2(n − 1) даёт kₙ ≥ ${kLast}. Тогда количества не меньше ${kSeq.join(", ")}, а всего чисел не меньше ${minTotal}. Пример: ${showDays(exC)}.\nОтвет: ${minTotal}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: false, reason: "chain-bound", target: `n-gt-${Xa}` },
        b: { type: "yesno", yes: true, example: exB, target: "means" },
        c: { type: "extremum", mode: "min", value: minTotal, example: exC },
      },
      mustMention: [B, S1, Xa, n, Yb],
      extra: [2, 5],
      phrases: ["каждое из которых меньше", "количество чисел меньше, чем в предыдущий день"],
    },
  })
}

// #66. Та же схема (n дней, числа меньше B, сумма растёт, количество убывает), но
// без ограничения на первый день: тогда число дней НЕ ограничено малым числом —
// достаточно начать с большого количества чисел (k₁ = m + n − 1, все числа единицы,
// а суммы 15, 16, …), поэтому пункт а) здесь «да». Если же сумма первого дня равна S,
// то k₁ ≤ S, и наибольшая общая сумма ищется перебором убывающих наборов количеств:
// сверху вниз sₙ = (B−1)kₙ, sᵢ = min((B−1)kᵢ, sᵢ₊₁ − 1).
export function t19DaysMaxTotalSum() {
  const B = 6
  const S1 = pick([6, 7, 8])
  const Xa = pick([4, 5])                                   // «может ли n быть больше Xa» — да
  const Yb = 3, Zb = 4                                      // средние в пункте б)

  const chain = (ks) => {                                   // максимальные суммы для набора количеств
    const s = Array(ks.length).fill(0)
    s[ks.length - 1] = (B - 1) * ks[ks.length - 1]
    for (let i = ks.length - 2; i >= 0; i--) s[i] = Math.min((B - 1) * ks[i], s[i + 1] - 1)
    for (let i = 0; i < ks.length; i++) if (s[i] < ks[i]) return null
    return s
  }
  // в): перебор убывающих наборов с k₁ ≤ S1 и первым днём ровно S1
  let bestTotal = -Infinity, bestCfg = null
  const rec = (ks) => {
    const s = chain(ks)
    if (s && s[0] >= S1 && (ks.length === 1 || S1 < s[1])) {
      const total = S1 + sum(s.slice(1))
      if (total > bestTotal) { bestTotal = total; bestCfg = ks.map((k, i) => ({ k, s: i === 0 ? S1 : s[i] })) }
    }
    if (ks.length >= 7) return
    for (let k = ks[ks.length - 1] - 1; k >= 1; k--) rec([...ks, k])
  }
  for (let k1 = 1; k1 <= S1; k1++) rec([k1])
  if (!bestCfg) return null
  // а): длинная цепочка с большим первым днём
  const nA = Xa + 1
  const kA = Array.from({ length: nA }, (_, i) => 10 + nA - 1 - i)
  const exA = kA.map((k, i) => ({ k, s: kA[0] + i }))
  if (exA.some((d) => d.s > (B - 1) * d.k)) return null
  // б): подряд идущие количества, максимальные суммы, первый день пожат до среднего < Yb
  let exB = null
  for (let a = 4; a <= 30 && !exB; a++) {
    for (let n = 2; n <= 5 && !exB; n++) {
      const ks = Array.from({ length: n }, (_, i) => a - i)
      if (ks[n - 1] < 1) continue
      const s = chain(ks)
      if (!s) continue
      const s1cap = Math.min(s[0], Math.ceil(Yb * ks[0]) - 1)
      if (s1cap < ks[0] || (n > 1 && s1cap >= s[1])) continue
      const total = s1cap + sum(s.slice(1))
      if (total > Zb * sum(ks)) exB = ks.map((k, i) => ({ k, s: i === 0 ? s1cap : s[i] }))
    }
  }
  if (!exB) return null

  const params = { B, S1, Xa, Yb, Zb }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length < 2) return "нужно хотя бы два дня"
    for (const d of cfg) {
      if (!d || !Number.isInteger(d.k) || !Number.isInteger(d.s)) return "день задаётся количеством и суммой"
      if (d.k < 1) return "в день записывают хотя бы одно число"
      if (d.s < d.k || d.s > (B - 1) * d.k) return `сумму ${d.s} нельзя набрать ${d.k} числами, меньшими ${B}`
    }
    for (let i = 1; i < cfg.length; i++) {
      if (cfg[i].s <= cfg[i - 1].s) return `сумма в день ${i + 1} не больше, чем в предыдущий`
      if (cfg[i].k >= cfg[i - 1].k) return `количество чисел в день ${i + 1} не меньше, чем в предыдущий`
    }
    if (part === "a" && cfg.length <= Xa) return `дней ${cfg.length}, а нужно больше ${Xa}`
    if (part === "b") {
      if (!(cfg[0].s / cfg[0].k < Yb)) return `среднее первого дня ${cfg[0].s / cfg[0].k}, а нужно меньше ${Yb}`
      const all = sum(cfg.map((d) => d.s)) / sum(cfg.map((d) => d.k))
      if (!(all > Zb)) return `среднее всех чисел ${all}, а нужно больше ${Zb}`
    }
    if (part === "c") {
      if (cfg[0].s !== S1) return `сумма первого дня ${cfg[0].s}, а по условию ${S1}`
      if (sum(cfg.map((d) => d.s)) !== bestTotal) return `общая сумма ${sum(cfg.map((d) => d.s))}, а заявлено ${bestTotal}`
    }
    return null
  }
  // Независимый перебор: все строго убывающие наборы количеств (для пункта в) — с
  // k₁ ≤ S1, так как числа натуральные и k₁ ≤ s₁). Для каждого набора максимальные
  // суммы считаются сверху вниз, что и даёт наибольшую общую сумму.
  const solve = (P) => {
    const chain2 = (ks) => {
      const s = Array(ks.length).fill(0)
      s[ks.length - 1] = (P.B - 1) * ks[ks.length - 1]
      for (let i = ks.length - 2; i >= 0; i--) s[i] = Math.min((P.B - 1) * ks[i], s[i + 1] - 1)
      for (let i = 0; i < ks.length; i++) if (s[i] < ks[i]) return null
      return s
    }
    let longOk = false, meansOk = false, best = -Infinity
    const walk = (ks, limit) => {
      const s = chain2(ks)
      if (s) {
        if (ks.length > P.Xa) longOk = true
        const s1cap = Math.min(s[0], Math.ceil(P.Yb * ks[0]) - 1)
        if (s1cap >= ks[0] && (ks.length === 1 || s1cap < s[1])) {
          if (s1cap + sum(s.slice(1)) > P.Zb * sum(ks)) meansOk = true
        }
        if (ks[0] <= P.S1 && s[0] >= P.S1 && (ks.length === 1 || P.S1 < s[1])) {
          best = Math.max(best, P.S1 + sum(s.slice(1)))
        }
      }
      if (ks.length >= 7) return
      for (let k = ks[ks.length - 1] - 1; k >= 1; k--) walk([...ks, k], limit)
    }
    for (let k1 = 1; k1 <= 30; k1++) walk([k1], 30)
    return { a: longOk, b: meansOk, c: best, c_next: false }
  }

  const showDays = (arr) => arr.map((d, i) => `в ${i + 1}-й день ${d.k} ${plural(d.k, "число", "числа", "чисел")} с суммой ${d.s}`).join(", ")
  return item({
    preamble: `В течение n дней каждый день на доску записывают натуральные числа, каждое из которых меньше ${B}. При этом каждый день (кроме первого) сумма чисел, записанных на доску в этот день, больше, а количество чисел меньше, чем в предыдущий день.`,
    qa: `Может ли n быть больше ${Xa}?`,
    qb: `Может ли среднее арифметическое чисел, записанных в первый день, быть меньше ${Yb}, а среднее арифметическое всех чисел, записанных за все дни, быть больше ${Zb}?`,
    qc: `Известно, что сумма чисел, записанных в первый день, равна ${S1}. Какое наибольшее значение может принимать сумма всех чисел, записанных за все дни?`,
    ansA: `да, например ${showDays(exA)}`,
    ansB: `да, например ${showDays(exB)}: среднее первого дня ${frPlain(fr(exB[0].s, exB[0].k))} < ${Yb}, а среднее всех чисел ${frPlain(fr(sum(exB.map((d) => d.s)), sum(exB.map((d) => d.k))))} > ${Zb}`,
    ansC: `${bestTotal}; например ${showDays(bestCfg)}`,
    solution: `Пусть в день i записано kᵢ чисел с суммой sᵢ; тогда kᵢ ≤ sᵢ ≤ ${B - 1}kᵢ.\nа) Ограничения не запрещают длинных цепочек, если начинать с большого количества чисел: ${showDays(exA)} — здесь ${nA} ${plural(nA, "день", "дня", "дней")}.\nб) Пример: ${showDays(exB)}.\nв) Числа натуральные, поэтому k₁ ≤ s₁ = ${S1}. При фиксированных количествах суммы выгодно брать наибольшими: sₙ = ${B - 1}kₙ, а каждая предыдущая — на единицу меньше следующей, но не больше ${B - 1}kᵢ. Перебор убывающих наборов количеств даёт максимум ${bestTotal}: ${showDays(bestCfg)}.\nОтвет: ${bestTotal}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `n-gt-${Xa}` },
        b: { type: "yesno", yes: true, example: exB, target: "means" },
        c: { type: "extremum", mode: "max", value: bestTotal, example: bestCfg },
      },
      mustMention: [B, S1, Xa, Yb, Zb],
      extra: [],
      phrases: ["каждое из которых меньше", "количество чисел меньше, чем в предыдущий день"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 11 (продолжение). Синие и красные карточки (#73)
// ═══════════════════════════════════════════════════════════════════════════

// Всего N карточек с натуральными числами, среднее равно u. Числа на синих карточках
// различны и каждое больше любого числа на красной. После удвоения чисел на синих
// среднее стало v. Удвоение добавляет к общей сумме ровно сумму синих, поэтому
//   S_син = N(v − u),   S_кр = Nu − S_син.
// Если синих b, а красных r = N − b, то каждое красное ≥ 1 (значит r ≤ S_кр), а
// наибольшее красное m ≥ ⌈S_кр/r⌉. Синие — b РАЗЛИЧНЫХ чисел, больших m, поэтому
//   b(m + 1) + b(b − 1)/2 ≤ S_син.
// Это и ограничивает количество синих карточек.
export function t19CardsBlueRed() {
  // Тройки (N, u, сумма красных), при которых среднее после удвоения — «человеческое»
  // число с одним знаком после запятой, а красных карточек заведомо хватает.
  const CFG = []
  for (const N0 of [40, 50, 60]) {
    for (const u0 of [14, 16, 18]) {
      for (const d0 of [20, 24, 30, 36, 40]) {
        if (d0 >= N0) continue                              // иначе синих карточек не остаётся
        if ((d0 * 10) % N0) continue                        // v = 2u − d/N — одна десятичная
        CFG.push({ N: N0, u: u0, dSum: d0 })
      }
    }
  }
  const cfg0 = pick(CFG)
  const N = cfg0.N, u = cfg0.u, dSum = cfg0.dSum
  const Sblue = N * u - dSum
  const v = (N * u + Sblue) / N                            // среднее после удвоения синих
  const minBlue = (b, m) => b * (m + 1) + b * (b - 1) / 2
  const feasible = (r) => {
    const b = N - r
    if (r < 1 || b < 1 || r > dSum) return null            // каждое красное ≥ 1
    const m = Math.ceil(dSum / r)                          // наибольшее красное не меньше среднего
    if (m * r < dSum) return null
    return minBlue(b, m) <= Sblue ? { b, r, m } : null
  }
  let bMax = 0, bestR = 0, bestM = 0
  for (let r = 1; r < N; r++) {
    const f = feasible(r)
    if (f && f.b > bMax) { bMax = f.b; bestR = r; bestM = f.m }
  }
  if (!bMax) return null
  const Xa = N - dSum                                       // столько синих есть всегда (все красные — единицы)
  if (!feasible(N - Xa)) return null
  // столько красных быть не может — берём НАИБОЛЬШЕЕ такое r (у самой границы),
  // иначе вопрос вырождается в «может ли быть одна красная карточка»
  let Xb = 0
  for (let r = 1; r <= dSum; r++) if (!feasible(r)) Xb = r
  if (Xb < 2 || N - Xb === Xa) return null

  const mk = (r) => {                                       // набор карточек при r красных
    const f = feasible(r)
    if (!f) return null
    const red = Array(r).fill(1)
    let restRed = dSum - r
    for (let i = 0; i < r && restRed > 0; i++) {
      const add = Math.min(restRed, f.m - 1)
      red[i] += add; restRed -= add
    }
    if (restRed !== 0 || Math.max(...red) !== f.m) return null
    const blue = Array.from({ length: f.b }, (_, i) => f.m + 1 + i)
    const extra = Sblue - sum(blue)                        // добираем сумму, сдвигая старшие числа
    const step = Math.floor(extra / f.b), rest = extra - step * f.b
    for (let i = 0; i < f.b; i++) blue[i] += step + (i >= f.b - rest ? 1 : 0)
    return { blue, red }
  }
  const exA = mk(N - Xa), exC = mk(bestR)
  if (!exA || !exC) return null

  const params = { N, u, v, Sblue, dSum, Xa, Xb }
  const check = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.blue) || !Array.isArray(cfg.red)) return "нет набора карточек"
    if (cfg.blue.length + cfg.red.length !== N) return `карточек ${cfg.blue.length + cfg.red.length} вместо ${N}`
    if (!cfg.blue.length || !cfg.red.length) return "должны быть карточки обоих цветов"
    for (const x of [...cfg.blue, ...cfg.red]) if (!Number.isInteger(x) || x < 1) return `${x} — не натуральное число`
    if (uniq(cfg.blue).length !== cfg.blue.length) return "числа на синих карточках обязаны быть различными"
    if (Math.min(...cfg.blue) <= Math.max(...cfg.red)) return `число ${Math.min(...cfg.blue)} на синей не больше числа ${Math.max(...cfg.red)} на красной`
    if (sum(cfg.blue) + sum(cfg.red) !== N * u) return `среднее всех чисел ${(sum(cfg.blue) + sum(cfg.red)) / N}, а не ${u}`
    // сравниваем целые суммы: N·v — дробное произведение и страдает от плавающей точки
    if (2 * sum(cfg.blue) + sum(cfg.red) !== N * u + Sblue) return `после удвоения среднее ${ru2((2 * sum(cfg.blue) + sum(cfg.red)) / N)}, а не ${ru2(v)}`
    if (part === "a" && cfg.blue.length !== Xa) return `синих карточек ${cfg.blue.length}, а нужно ${Xa}`
    if (part === "c" && cfg.blue.length !== bMax) return `синих карточек ${cfg.blue.length}, а заявлено ${bMax}`
    return null
  }
  // Независимый перебор по числу красных карточек r: для каждого r наибольшее красное
  // не меньше ⌈S_кр/r⌉, а b = N − r различных синих чисел, больших этого значения,
  // дают в сумме не меньше b(m+1) + b(b−1)/2 — это и есть критерий существования.
  const solve = (P) => {
    let aYes = false, bYes = false, best = 0
    for (let r = 1; r < P.N; r++) {
      const b = P.N - r
      if (r > P.dSum) continue
      const m = Math.ceil(P.dSum / r)
      if (b * (m + 1) + b * (b - 1) / 2 > P.Sblue) continue
      if (b === P.Xa) aYes = true
      if (r === P.Xb) bYes = true
      if (b > best) best = b
    }
    return { a: aYes, b: bYes, c: best, c_next: false }
  }

  const byValue = (arr) => {
    const g = new Map()
    for (const x of arr) g.set(x, (g.get(x) || 0) + 1)
    return [...g.entries()].sort((a, b) => a[0] - b[0])
      .map(([val, cnt]) => `${cnt} ${plural(cnt, "карточка", "карточки", "карточек")} с числом ${val}`).join(", ")
  }
  const showCfg = (cfg) => {
    const b = cfg.blue.slice().sort((x, y) => x - y)
    const blueTxt = b.length <= 4 ? b.join(", ") : `${b.slice(0, 3).join(", ")}, …, ${b[b.length - 1]}`
    return `красные — ${byValue(cfg.red)}; синие — ${cfg.blue.length} ${plural(cfg.blue.length, "карточка", "карточки", "карточек")} с числами ${blueTxt}`
  }
  return item({
    preamble: `Есть синие и красные карточки. Всего карточек ${N} штук. На каждой написаны натуральные числа, среднее арифметическое которых равно ${u}. Все числа на синих карточках разные. При этом любое число на синей карточке больше, чем любое на красной. Числа на синих увеличили в 2 раза, после чего среднее арифметическое стало равно ${ru2(v)}.`,
    qa: `Может ли быть ${Xa} синих карточек?`,
    qb: `Может ли быть ${Xb} ${plural(Xb, "красная карточка", "красные карточки", "красных карточек")}?`,
    qc: `Какое наибольшее количество синих карточек может быть?`,
    ansA: `да, например ${showCfg(exA)}`,
    ansB: `нет: удвоение синих увеличивает общую сумму ровно на сумму синих, поэтому сумма чисел на синих равна ${N}·(${ru2(v)} − ${u}) = ${Sblue}, а на красных — ${dSum}. При ${Xb} ${plural(Xb, "красной карточке", "красных карточках", "красных карточках")} наибольшее красное число не меньше ${Math.ceil(dSum / Xb)}, значит ${N - Xb} различных синих чисел дают в сумме не меньше ${(N - Xb) * (Math.ceil(dSum / Xb) + 1) + (N - Xb) * (N - Xb - 1) / 2} > ${Sblue}`,
    ansC: `${bMax}; например ${showCfg(exC)}`,
    solution: `После удвоения чисел на синих карточках сумма выросла ровно на сумму синих чисел, поэтому\nS_син = ${N}·(${ru2(v)} − ${u}) = ${Sblue}, а S_кр = ${N}·${u} − ${Sblue} = ${dSum}.\nПусть красных карточек r, тогда синих ${N} − r. Каждое красное число натуральное, поэтому r ≤ ${dSum}, а наибольшее красное число m не меньше ⌈${dSum}/r⌉. Числа на синих различны и больше m, поэтому\nS_син ≥ (${N} − r)(m + 1) + (${N} − r)(${N} − r − 1)/2.\nа) При ${Xa} синих карточках все красные равны 1, и условие выполняется: ${showCfg(exA)}.\nб) При ${Xb} ${plural(Xb, "красной карточке", "красных карточках", "красных карточках")} m ≥ ${Math.ceil(dSum / Xb)}, и минимальная сумма синих равна ${(N - Xb) * (Math.ceil(dSum / Xb) + 1) + (N - Xb) * (N - Xb - 1) / 2}, что больше ${Sblue}. Значит столько красных быть не может.\nв) Перебирая r, получаем наибольшее число синих ${bMax} (при r = ${bestR}, m = ${bestM}): ${showCfg(exC)}.\nОтвет: ${bMax}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `blue-${Xa}` },
        b: { type: "yesno", yes: false, reason: "blue-min-sum", target: `red-${Xb}` },
        c: { type: "extremum", mode: "max", value: bMax, example: exC },
      },
      mustMention: [N, u, Xa, Xb, 2, ...String(ru2(v)).split(",").map(Number)],
      extra: [],
      phrases: ["Все числа на синих карточках разные", "больше, чем любое на красной"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 11 (окончание). Гирьки 1…N: переложили одну (#82)
// ═══════════════════════════════════════════════════════════════════════════

// Гирьки массой 1, 2, …, N разложены на две непустые кучи. Из второй кучи в первую
// переложили одну гирьку, после чего средняя масса в первой куче выросла на d граммов.
// Если в первой куче было k гирек с суммой S и средней A = S/k, то
//   (S + x)/(k + 1) = A + d  ⟹  x = A + d(k + 1).
// Три следствия:
//   • масса x обязана быть ЦЕЛОЙ, поэтому A + d(k+1) целое (при полуцелом A и целом d —
//     противоречие);
//   • гирька с массой x лежала во ВТОРОЙ куче, поэтому x не может оказаться среди
//     гирек первой кучи;
//   • A ≥ (k+1)/2 (k различных гирек), поэтому x ≥ (k+1)(d + ½) и из x ≤ N следует
//     k + 1 ≤ 2N/(2d + 1).
export function t19WeightsMoveOne() {
  const showHeap = (h) => (h.length <= 6
    ? h.join(", ")
    : `${h.slice(0, 3).join(", ")}, …, ${h[h.length - 2]}, ${h[h.length - 1]}`)
  const N = pick([40, 50, 60])
  const d = 1
  const kMax = Math.floor(2 * N / (2 * d + 1)) - 1
  // а) тройка гирек в прогрессии с разностью 4: тогда x = A + 4 — это её же старший член
  const t = 2 * (d + 1)
  const a0 = 2 * randInt(1, Math.floor((N - 2 * t) / 2))
  const trio = [a0, a0 + t, a0 + 2 * t]
  if (trio[2] > N) return null
  // б) полуцелая средняя масса
  const Ab = randInt(4, 12) + 0.5
  // в) наибольшая куча: k = kMax, куча 1…kMax, средняя (kMax+1)/2 должна быть целой
  let kBest = 0, exC = null
  for (let k = kMax; k >= 1 && !exC; k--) {
    for (let A = Math.ceil((k + 1) / 2); A * k <= N * k; A++) {
      const x = A + d * (k + 1)
      if (x > N) break
      const pool = []
      for (let w = 1; w <= N; w++) if (w !== x) pool.push(w)
      const lo = sum(pool.slice(0, k)), hi = sum(pool.slice(-k))
      if (A * k < lo || A * k > hi) continue
      // строим кучу: берём k наименьших и добираем сумму, поднимая старшие
      const heap = pool.slice(0, k)
      let need = A * k - lo
      for (let i = k - 1; i >= 0 && need > 0; i--) {
        const ceilW = (i === k - 1 ? pool[pool.length - 1] : heap[i + 1] - 1)
        const add = Math.min(need, ceilW - heap[i])
        heap[i] += add; need -= add
      }
      if (need === 0 && !heap.includes(x)) { kBest = k; exC = { heap, moved: x } }
      break
    }
  }
  if (!exC) return null

  const params = { N, d, kMax, trio, Ab }
  const check = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.heap) || !Number.isInteger(cfg.moved)) return "нет конфигурации"
    if (!cfg.heap.length || cfg.heap.length >= N) return "в каждой куче должна быть хотя бы одна гирька"
    for (const w of cfg.heap) if (!Number.isInteger(w) || w < 1 || w > N) return `${w} — не гирька из набора 1…${N}`
    if (uniq(cfg.heap).length !== cfg.heap.length) return "гирьки различны"
    if (cfg.moved < 1 || cfg.moved > N) return `гирьки массой ${cfg.moved} г нет`
    if (cfg.heap.includes(cfg.moved)) return `гирька массой ${cfg.moved} г уже лежит в первой куче`
    const k = cfg.heap.length, S = sum(cfg.heap)
    if ((S + cfg.moved) * k !== (S + d * k) * (k + 1)) {
      return `средняя масса изменилась с ${S / k} на ${(S + cfg.moved) / (k + 1)} — не на ${d} г`
    }
    if (part === "c" && k !== kBest) return `в первой куче ${k} гирек, а заявлено ${kBest}`
    return null
  }
  // Независимый перебор по числу гирек k в первой куче и её средней массе A:
  // масса переложенной гирьки определяется однозначно (x = A + d(k+1)), а сумма kA
  // достижима тогда и только тогда, когда лежит между суммой k наименьших и k
  // наибольших гирек набора 1…N без гирьки x (все промежуточные суммы достижимы).
  const solve = (P) => {
    const okTrio = (heap) => {
      const k = heap.length, S = sum(heap)
      if (S % k) return false
      const x = S / k + P.d * (k + 1)
      return Number.isInteger(x) && x >= 1 && x <= P.N && !heap.includes(x)
    }
    let bHalf = false, best = 0
    for (let k = 1; k < P.N; k++) {
      for (let A2 = k + 1; A2 <= 2 * P.N; A2++) {           // A2 = 2A, чтобы поймать и полуцелые
        const S2 = A2 * k
        if (S2 % 2) continue
        const S = S2 / 2
        const x2 = A2 + 2 * P.d * (k + 1)
        if (x2 % 2) continue                                // нецелая масса гирьки невозможна
        const x = x2 / 2
        if (x > P.N) break
        const pool = []
        for (let w = 1; w <= P.N; w++) if (w !== x) pool.push(w)
        if (pool.length < k) continue
        const lo = sum(pool.slice(0, k)), hi = sum(pool.slice(-k))
        if (S < lo || S > hi) continue
        if (A2 === 2 * P.Ab) bHalf = true
        if (k > best) best = k
      }
    }
    return { a: okTrio(P.trio), b: bHalf, c: best, c_next: false }
  }

  return item({
    preamble: `${N === 40 ? "Сорок" : N === 50 ? "Пятьдесят" : "Шестьдесят"} гирек массой 1 г, 2 г, …, ${N} г разложили по двум кучам, в каждой куче хотя бы одна гирька. Масса каждой гирьки выражается целым числом граммов. Затем из второй кучи переложили в первую одну гирьку. После этого средняя масса гирек в первой куче увеличилась на ${d} г.`,
    qa: `Могло ли такое быть, если первоначально в первой куче лежали только гирьки массой ${trio[0]} г, ${trio[1]} г и ${trio[2]} г?`,
    qb: `Могла ли средняя масса гирек в первой куче первоначально равняться ${ru2(Ab)} г?`,
    qc: `Какое наибольшее число гирек могло быть первоначально в первой куче?`,
    ansA: `нет: если в первой куче k гирек со средней массой A, то из (S + x)/(k + 1) = A + ${d} следует x = A + ${d === 1 ? "" : d}(k + 1). Здесь k = 3, A = ${trio[1]} и x = ${trio[1] + d * 4} — но гирька такой массы уже лежит в первой куче, а перекладывают из второй`,
    ansB: `нет: x = A + ${d === 1 ? "" : d}(k + 1), и при A = ${ru2(Ab)} масса переложенной гирьки равна ${ru2(Ab)} + (k + 1) — число нецелое, а массы всех гирек целые`,
    ansC: `${kBest}; например первая куча ${showHeap(exC.heap)} (средняя масса ${sum(exC.heap) / exC.heap.length} г), перекладывают гирьку массой ${exC.moved} г`,
    solution: `Пусть в первой куче было k гирек с суммой S и средней массой A = S/k, а переложили гирьку массой x. Тогда (S + x)/(k + 1) = A + ${d}, откуда\nx = A + ${d === 1 ? "" : d}(k + 1).\nа) Для гирек ${trio.join(", ")} имеем k = 3 и A = ${trio[1]}, поэтому x = ${trio[1] + d * 4} — гирька такой массы уже в первой куче, а перекладывают гирьку из второй.\nб) При A = ${ru2(Ab)} величина x = ${ru2(Ab)} + ${d}(k + 1) не целая, а массы гирек — целые числа.\nв) Гирьки различны, поэтому A ≥ (k + 1)/2, а значит x ≥ (k + 1)(${d} + 0,5). Из x ≤ ${N} получаем k + 1 ≤ ${ru2(2 * N / (2 * d + 1))}, то есть k ≤ ${kMax}. Значение достигается: первая куча — гирьки ${showHeap(exC.heap)}, средняя масса ${sum(exC.heap) / exC.heap.length} г, перекладывают гирьку массой ${exC.moved} г.\nОтвет: ${kBest}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: false, reason: "moved-already-inside", target: `trio-${trio.join("-")}` },
        b: { type: "yesno", yes: false, reason: "non-integer-mass", target: `mean-${Ab}` },
        c: { type: "extremum", mode: "max", value: kBest, example: exC },
      },
      mustMention: [N, d, 1, 2, ...trio, ...String(ru2(Ab)).split(",").map(Number)],
      extra: [],
      phrases: ["в каждой куче хотя бы одна гирька", "переложили в первую одну гирьку"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 19 (продолжение). Две школы: переход учащегося и средние баллы (#113)
// ═══════════════════════════════════════════════════════════════════════════

// Из школы №1 (n учащихся, целый средний балл A) в школу №2 (m учащихся, целый средний
// балл C) переходит учащийся с баллом x, после чего оба средних вырастают на 10 %:
//   (An − x)/(n − 1) = 1,1A  ⟹  x = A(11 − n)/10,
//   (Cm + x)/(m + 1) = 1,1C  ⟹  10x = C(m + 11).
// Первое равенство однозначно задаёт возможные n (нужна целость x ≥ 1), второе —
// связь между числом учащихся школы №2 и её средним баллом.
export function t19SchoolsMoveCounts() {
  const A = pick([12, 14, 16, 18, 22, 24, 26])             // средний балл школы №1, не кратен 5
  const ns = []
  for (let n = 2; n <= 20; n++) {
    const x10 = A * (11 - n)
    if (x10 <= 0 || x10 % 10) continue
    const x = x10 / 10
    if (A * n - x < n - 1) continue                        // остальным нужно хотя бы по баллу
    ns.push({ n, x })
  }
  if (ns.length !== 1) return null
  const { n, x } = ns[0]
  // б) все баллы школы №1 различны: минимальная сумма прочих — наименьшие числа плюс x
  const others = []
  for (let v = 1; others.length < n - 2; v++) if (v !== x) others.push(v)
  const restSum = sum(others) + x
  const topScore = A * n - restSum
  if (topScore <= Math.max(x, ...others)) return null
  const exB = [...others, x, topScore]
  // в) при более чем L учащихся в школе №2 — наименьшее их количество
  const L = 10
  let mMin = 0, cFor = 0
  for (let m = L + 1; m <= 10 * x; m++) {
    if ((10 * x) % (m + 11)) continue
    const c = 10 * x / (m + 11)
    if (c >= 1) { mMin = m; cFor = c; break }
  }
  if (!mMin) return null

  const params = { A, n, x, L }
  const check = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.s1) || !Number.isInteger(cfg.moved)) return "нет конфигурации"
    if (cfg.s1.length < 2) return "в школе №1 тест писали не менее двух учащихся"
    for (const v of cfg.s1) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное количество баллов`
    if (!cfg.s1.includes(cfg.moved)) return `перешедший учащийся с ${cfg.moved} баллами не из школы №1`
    const S = sum(cfg.s1), k = cfg.s1.length
    if (S % k) return "средний балл в школе №1 не целый"
    if (S / k !== A) return `средний балл школы №1 равен ${S / k}, а не ${A}`
    if (10 * (S - cfg.moved) !== 11 * A * (k - 1)) return `после перехода средний балл школы №1 вырос не на 10 %`
    if (part === "a" && k !== n) return `в школе №1 ${k} учащихся, а заявлено ${n}`
    if (part === "b") {
      if (uniq(cfg.s1).length !== cfg.s1.length) return "в пункте б) все баллы должны быть различными"
      if (Math.max(...cfg.s1) !== topScore) return `наибольший балл ${Math.max(...cfg.s1)}, а заявлено ${topScore}`
    }
    if (part === "c") {
      if (!Array.isArray(cfg.s2)) return "нет школы №2"
      if (cfg.s2.length !== mMin) return `в школе №2 ${cfg.s2.length} учащихся, а заявлено ${mMin}`
      const S2 = sum(cfg.s2)
      if (S2 % cfg.s2.length) return "средний балл в школе №2 не целый"
      if (10 * (S2 + cfg.moved) !== 11 * (S2 / cfg.s2.length) * (cfg.s2.length + 1)) return "средний балл школы №2 вырос не на 10 %"
    }
    return null
  }
  // Независимый перебор: по числу учащихся школы №1 (целость x), по составу баллов
  // (минимальная сумма прочих различных баллов) и по числу учащихся школы №2
  // (делимость 10x на m + 11).
  const solve = (P) => {
    const counts = []
    for (let k = 2; k <= 40; k++) {
      const x10 = P.A * (11 - k)
      if (x10 <= 0 || x10 % 10) continue
      if (P.A * k - x10 / 10 < k - 1) continue
      counts.push(k)
    }
    let top = -Infinity
    for (const k of counts) {
      const xk = P.A * (11 - k) / 10
      const small = []
      for (let v = 1; small.length < k - 2; v++) if (v !== xk) small.push(v)
      const cand = P.A * k - sum(small) - xk
      if (cand > Math.max(xk, ...small)) top = Math.max(top, cand)
    }
    let best = 0
    for (let m = P.L + 1; m <= 10 * P.x; m++) {
      if ((10 * P.x) % (m + 11) === 0 && 10 * P.x / (m + 11) >= 1) { best = m; break }
    }
    return { a: counts.map(String), b: top, b_next: false, c: best, c_next: false }
  }

  const exA = { s1: [...Array(n - 1).fill(A), A], moved: x }
  exA.s1 = (() => {                                        // n баллов со средним A, среди них x
    const arr = Array(n).fill(A)
    arr[0] = x
    arr[1] += A - x
    return arr
  })()
  const exC = { s1: exA.s1, moved: x, s2: Array(mMin).fill(cFor) }
  return item({
    preamble: `В школах №1 и №2 учащиеся писали тест. Из каждой школы тест писали, по крайней мере, 2 учащихся. Каждый учащийся, писавший тест, набрал натуральное количество баллов. Оказалось, что в каждой школе средний балл за тест был целым числом, причём в школе №1 средний балл равнялся ${A}. Один из учащихся, писавших тест, перешёл из школы №1 в школу №2, а средние баллы за тест были пересчитаны в обеих школах. В результате средний балл в школе №1 вырос на 10 %, средний балл в школе №2 также вырос на 10 %.`,
    qa: `Сколько учащихся могло писать тест в школе №1 изначально?`,
    qb: `В школе №1 все писавшие тест набрали разное количество баллов. Какое наибольшее количество баллов мог набрать учащийся этой школы?`,
    qc: `Известно, что изначально в школе №2 писали тест более ${L} учащихся. Какое наименьшее количество учащихся могло писать тест в школе №2 изначально?`,
    ansA: `${n}: из (${A}n − x)/(n − 1) = 1,1·${A} следует x = ${A}(11 − n)/10, и это натуральное число только при n = ${n} (тогда x = ${x})`,
    ansB: `${topScore}; например баллы ${exB.join(", ")}: их сумма ${A * n} даёт средний балл ${A}, а переходит учащийся с ${x} ${plural(x, "баллом", "баллами", "баллами")}`,
    ansC: `${mMin}; например в школе №2 было ${mMin} ${plural(mMin, "учащийся", "учащихся", "учащихся")} по ${cFor} ${plural(cFor, "баллу", "балла", "баллов")}`,
    solution: `Пусть в школе №1 было n учащихся со средним баллом ${A}, а перешёл учащийся с баллом x.\nа) Из (${A}n − x)/(n − 1) = 1,1·${A} получаем x = ${A}(11 − n)/10. Число x натуральное, поэтому 11 − n кратно ${10 / gcdI(A, 10)} и x ≥ 1: подходит только n = ${n}, при этом x = ${x}.\nб) Все баллы различны, их сумма равна ${A}·${n} = ${A * n}, и среди них есть ${x}. Чтобы один балл был наибольшим, остальные берём наименьшими: ${others.join(", ")} и ${x}. Тогда наибольший балл равен ${A * n} − ${restSum} = ${topScore}.\nв) Для школы №2 с m учащимися и средним баллом C: (Cm + ${x})/(m + 1) = 1,1C, откуда 10·${x} = C(m + 11), то есть C = ${10 * x}/(m + 11). При m > ${L} наименьшее подходящее значение m = ${mMin} (тогда C = ${cFor}).\nОтвет: ${n}; ${topScore}; ${mMin}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "all", values: [String(n)], examples: { [String(n)]: exA } },
        b: { type: "extremum", mode: "max", value: topScore, example: { s1: exB, moved: x } },
        c: { type: "extremum", mode: "min", value: mMin, example: exC },
      },
      mustMention: [A, L, 1, 2, 10],
      extra: [],
      phrases: ["по крайней мере, 2 учащихся", "средний балл за тест был целым числом", "вырос на 10 %"],
    },
  })
}

// #114. Зеркальная схема: известен средний балл школы №2 (он равен C), и оба средних
// УМЕНЬШАЮТСЯ на 10 %:
//   (Cm + x)/(m + 1) = 0,9C  ⟹  x = C(9 − m)/10       — задаёт число учащихся школы №2,
//   (An − x)/(n − 1) = 0,9A  ⟹  10x = A(n + 9)        — связывает школу №1 и её средний балл.
// Наибольший балл в школе №2 при условии «каждый набрал больше перешедшего» равен
// Cm − (m − 1)(x + 1), а наибольшее число учащихся школы №1 — наибольший делитель
// вида n + 9 числа 10x, при котором остальным хватает хотя бы по одному баллу.
export function t19SchoolsMoveMaxCount() {
  // средний балл школы №2: чётный и не кратный 5 — тогда 9 − m кратно 5 и m = 4
  const C = pick([36, 42, 48, 54, 56])
  const ms = []
  for (let m = 2; m <= 8; m++) {
    const x10 = C * (9 - m)
    if (x10 <= 0 || x10 % 10) continue
    ms.push({ m, x: x10 / 10 })
  }
  if (ms.length !== 1) return null
  const { m, x } = ms[0]
  const topScore = C * m - (m - 1) * (x + 1)               // остальные — минимально возможные
  if (topScore <= x + 1) return null
  const exB = { s2: [...Array(m - 1).fill(x + 1), topScore], moved: x }
  // в) наибольшее число учащихся школы №1: 10x = A(n + 9), остальным хватает по баллу
  let nMax = 0, aFor = 0
  for (let n = 2; n <= 10 * x; n++) {
    if ((10 * x) % (n + 9)) continue
    const A = 10 * x / (n + 9)
    if (A < 1) continue
    if (A * n < x + (n - 1)) continue                      // в школе №1 есть учащийся с x баллами
    if (n > nMax) { nMax = n; aFor = A }
  }
  if (!nMax) return null
  const exC = { s1: [x, ...Array(nMax - 1).fill(1)], moved: x }
  exC.s1[1] += aFor * nMax - sum(exC.s1)                   // добираем сумму до A·n

  const params = { C, m, x }
  const check = (cfg, part) => {
    if (!cfg || !Number.isInteger(cfg.moved)) return "нет конфигурации"
    if (part === "a" || part === "b") {                     // оба пункта — про школу №2
      if (!Array.isArray(cfg.s2) || cfg.s2.length < 2) return "в школе №2 тест писали не менее двух учащихся"
      for (const v of cfg.s2) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное количество баллов`
      const S = sum(cfg.s2), k = cfg.s2.length
      if (S % k || S / k !== C) return `средний балл школы №2 равен ${S / k}, а не ${C}`
      if (10 * (S + cfg.moved) !== 9 * C * (k + 1)) return "средний балл школы №2 уменьшился не на 10 %"
      if (part === "a") return cfg.s2.length === m ? null : `в школе №2 ${cfg.s2.length} учащихся, а заявлено ${m}`
      if (cfg.s2.some((v) => v <= cfg.moved)) return `балл ${Math.min(...cfg.s2)} не больше балла перешедшего (${cfg.moved})`
      if (Math.max(...cfg.s2) !== topScore) return `наибольший балл ${Math.max(...cfg.s2)}, а заявлено ${topScore}`
      return null
    }
    if (!Array.isArray(cfg.s1) || cfg.s1.length < 2) return "в школе №1 тест писали не менее двух учащихся"
    for (const v of cfg.s1) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное количество баллов`
    if (!cfg.s1.includes(cfg.moved)) return `перешедший учащийся с ${cfg.moved} баллами не из школы №1`
    const S = sum(cfg.s1), k = cfg.s1.length
    if (S % k) return "средний балл в школе №1 не целый"
    if (10 * (S - cfg.moved) !== 9 * (S / k) * (k - 1)) return "средний балл школы №1 уменьшился не на 10 %"
    if (part === "c" && k !== nMax) return `в школе №1 ${k} учащихся, а заявлено ${nMax}`
    return null
  }
  // Независимый перебор: по числу учащихся школы №2 (целость x), по наибольшему баллу
  // (остальные минимальны — на балл больше перешедшего) и по числу учащихся школы №1
  // (делимость 10x на n + 9 плюс условие «остальным хватает хотя бы по баллу»).
  const solve = (P) => {
    const counts = []
    for (let k = 2; k <= 40; k++) {
      const x10 = P.C * (9 - k)
      if (x10 <= 0 || x10 % 10) continue
      counts.push(k)
    }
    let top = -Infinity
    for (const k of counts) {
      const xk = P.C * (9 - k) / 10
      const cand = P.C * k - (k - 1) * (xk + 1)
      if (cand > xk + 1) top = Math.max(top, cand)
    }
    let best = 0
    for (let n = 2; n <= 10 * P.x; n++) {
      if ((10 * P.x) % (n + 9)) continue
      const A = 10 * P.x / (n + 9)
      if (A >= 1 && A * n >= P.x + (n - 1)) best = Math.max(best, n)
    }
    return { a: counts.map(String), b: top, b_next: false, c: best, c_next: false }
  }

  const exA = { s2: [...Array(m - 1).fill(C), C], moved: x }
  return item({
    preamble: `В школах №1 и №2 учащиеся писали тест. Из каждой школы тест писали, по крайней мере, 2 учащихся. Каждый учащийся, писавший тест, набрал натуральное количество баллов. Оказалось, что в каждой школе средний балл за тест был целым числом, причём в школе №2 средний балл равнялся ${C}. Один из учащихся, писавших тест, перешёл из школы №1 в школу №2, а средние баллы за тест были пересчитаны в обеих школах. В результате средний балл в школе №1 уменьшился на 10 %, средний балл в школе №2 также уменьшился на 10 %.`,
    qa: `Сколько учащихся могло писать тест в школе №2 изначально?`,
    qb: `Каждый учащийся школы №2, писавший тест, набрал больше баллов, чем перешедший в неё учащийся школы №1. Какое наибольшее количество баллов мог набрать учащийся школы №2?`,
    qc: `Какое наибольшее количество учащихся могло писать тест в школе №1 изначально?`,
    ansA: `${m}: из (${C}m + x)/(m + 1) = 0,9·${C} следует x = ${C}(9 − m)/10, и это натуральное число только при m = ${m} (тогда x = ${x})`,
    ansB: `${topScore}; например баллы ${exB.s2.join(", ")}: их сумма ${C * m} даёт средний балл ${C}, и каждый больше ${x}`,
    ansC: `${nMax}; например в школе №1 средний балл ${aFor}, а баллы такие: ${exC.s1[0]}, ${exC.s1[1]} и ещё ${nMax - 2} ${plural(nMax - 2, "балл", "балла", "баллов")} по 1`,
    solution: `Пусть перешёл учащийся с баллом x.\nа) Для школы №2: (${C}m + x)/(m + 1) = 0,9·${C}, откуда x = ${C}(9 − m)/10. Число x натуральное, поэтому подходит только m = ${m}, и тогда x = ${x}.\nб) Все баллы школы №2 больше ${x}, то есть не меньше ${x + 1}. Сумма баллов равна ${C}·${m} = ${C * m}, поэтому наибольший балл не превосходит ${C * m} − ${m - 1}·${x + 1} = ${topScore}; это значение достигается на наборе ${exB.s2.join(", ")}.\nв) Для школы №1: (An − x)/(n − 1) = 0,9A, откуда 10·${x} = A(n + 9), то есть A = ${10 * x}/(n + 9). Кроме того сумма баллов An должна вмещать балл ${x} и хотя бы по одному баллу у остальных: An ≥ ${x} + (n − 1). Наибольшее подходящее n равно ${nMax} (при A = ${aFor}).\nОтвет: ${m}; ${topScore}; ${nMax}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "all", values: [String(m)], examples: { [String(m)]: exA } },
        b: { type: "extremum", mode: "max", value: topScore, example: exB },
        c: { type: "extremum", mode: "max", value: nMax, example: exC },
      },
      mustMention: [C, 1, 2, 10],
      extra: [],
      phrases: ["по крайней мере, 2 учащихся", "средний балл за тест был целым числом", "уменьшился на 10 %"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 18. Вася и Петя решают сборник (#78)
// ═══════════════════════════════════════════════════════════════════════════

// Оба решили ВЕСЬ сборник из N задач, начав в один день. Вася каждый день решает на 1
// задачу больше предыдущего, Петя — на 2. Если Вася решал a дней и в первый день решил
// v задач, а Петя — b дней по p задач в первый, то
//   N = av + a(a − 1)/2 = bp + b(b − 1).
// Если оба уложились в ОДНО И ТО ЖЕ число дней d, то dv + d(d−1)/2 = dp + d(d−1), то есть
//   v − p = (d − 1)/2,
// и при ЧЁТНОМ d это невозможно (слева целое, справа — нет). Это ключ к пунктам а) и б).
const vpV = (a, v) => a * v + a * (a - 1) / 2
const vpP = (b, p) => b * p + b * (b - 1)

export function t19VasyaPetyaDays() {
  const dOdd = pick([5, 7, 9])                             // «оба ровно за dOdd дней» — да
  const dEven = pick([8, 10, 12])                          // «оба ровно за dEven дней» — нет
  const L = pick([5, 6, 7])                                // «каждый решал более L дней»
  const W = L + 1                                          // «а за W дней Петя решил больше Васи»
  // а): v = p + (dOdd − 1)/2
  const pA = randInt(1, 4), vA = pA + (dOdd - 1) / 2
  const exA = { a: dOdd, v: vA, b: dOdd, p: pA }
  // в): наименьшее N при a, b > L, v > p и «за W дней Петя решил больше Васи»
  let best = null
  for (let N = 1; N <= 600 && !best; N++) {
    for (let a = L + 1; a <= 60 && !best; a++) {
      const num = N - a * (a - 1) / 2
      if (num <= 0 || num % a) continue
      const v = num / a
      for (let b = L + 1; b <= 60; b++) {
        const num2 = N - b * (b - 1)
        if (num2 <= 0 || num2 % b) continue
        const p = num2 / b
        if (v > p && vpP(W, p) > vpV(W, v)) { best = { N, a, v, b, p }; break }
      }
    }
  }
  if (!best) return null

  const params = { dOdd, dEven, L, W }
  const check = (cfg, part) => {
    if (!cfg || !Number.isInteger(cfg.a) || !Number.isInteger(cfg.v) || !Number.isInteger(cfg.b) || !Number.isInteger(cfg.p)) return "нет конфигурации"
    if (cfg.a < 1 || cfg.b < 1) return "каждый решал хотя бы один день"
    if (cfg.v < 1 || cfg.p < 1) return "в первый день каждый решил хотя бы одну задачу"
    const nV = vpV(cfg.a, cfg.v), nP = vpP(cfg.b, cfg.p)
    if (nV !== nP) return `Вася решил ${nV} задач, а Петя ${nP} — сборник один и тот же`
    if (part === "a" && (cfg.a !== dOdd || cfg.b !== dOdd)) return `нужно, чтобы оба решали ровно ${dOdd} дней`
    if (part === "c") {
      if (cfg.a <= L || cfg.b <= L) return `каждый должен решать более ${L} дней`
      if (cfg.v <= cfg.p) return "в первый день Вася должен решить больше Пети"
      if (vpP(W, cfg.p) <= vpV(W, cfg.v)) return `за ${W} дней Петя должен решить больше Васи`
      if (nV !== best.N) return `в сборнике ${nV} задач, а заявлено ${best.N}`
    }
    return null
  }
  // Независимый перебор: по числу задач N и числам дней a, b — первые дни v и p
  // восстанавливаются однозначно из N (деление с остатком), поэтому пространство конечно.
  const solve = (P) => {
    const sameDays = (d) => {
      for (let v = 1; v <= 200; v++) for (let p = 1; p <= 200; p++) if (vpV(d, v) === vpP(d, p)) return true
      return false
    }
    let bestN = 0
    for (let N = 1; N <= 600 && !bestN; N++) {
      for (let a = P.L + 1; a <= 60 && !bestN; a++) {
        const num = N - a * (a - 1) / 2
        if (num <= 0 || num % a) continue
        const v = num / a
        for (let b = P.L + 1; b <= 60; b++) {
          const num2 = N - b * (b - 1)
          if (num2 <= 0 || num2 % b) continue
          const p = num2 / b
          if (v > p && vpP(P.W, p) > vpV(P.W, v)) { bestN = N; break }
        }
      }
    }
    return { a: sameDays(P.dOdd), b: sameDays(P.dEven), c: bestN, c_next: false }
  }

  const run = (start, step, days) => Array.from({ length: days }, (_, i) => start + step * i).join(", ")
  return item({
    preamble: `Готовясь к экзамену, Вася и Петя решали задачи из сборника, и каждый из них решил все задачи этого сборника. Каждый день Вася решал на одну задачу больше, чем в предыдущий день, а Петя решал на две задачи больше, чем в предыдущий день. Они начали решать задачи в один день, при этом в первый день каждый из них решил хотя бы одну задачу.`,
    qa: `Могло ли получиться так, что каждый из них решил все задачи сборника ровно за ${dOdd} дней?`,
    qb: `Могло ли получиться так, что каждый из них решил все задачи сборника ровно за ${dEven} дней?`,
    qc: `Какое наименьшее число задач могло быть в сборнике, если известно, что каждый из них решал задачи более ${L} дней, в первый день Вася решил больше задач, чем Петя, а за ${W} дней Петя решил больше задач, чем Вася?`,
    ansA: `да, например Вася решал по ${run(vA, 1, dOdd)} ${plural(dOdd, "задаче", "задачи", "задач")}, а Петя — по ${run(pA, 2, dOdd)}: в сборнике ${vpV(dOdd, vA)} ${plural(vpV(dOdd, vA), "задача", "задачи", "задач")}`,
    ansB: `нет: если оба решали ровно d дней, то dv + d(d − 1)/2 = dp + d(d − 1), откуда v − p = (d − 1)/2. При d = ${dEven} правая часть равна ${ru2((dEven - 1) / 2)} — не целое число, а v и p целые`,
    ansC: `${best.N}; например Вася решал ${best.a} ${plural(best.a, "день", "дня", "дней")}, начав с ${best.v} ${plural(best.v, "задачи", "задач", "задач")}, а Петя — ${best.b} ${plural(best.b, "день", "дня", "дней")}, начав с ${best.p}`,
    solution: `Пусть Вася решал a дней и в первый день решил v задач, а Петя решал b дней и в первый день p задач. Тогда\nN = av + a(a − 1)/2 = bp + b(b − 1).\nа) При a = b = ${dOdd} получаем v − p = ${(dOdd - 1) / 2}: например Петя начинал с ${pA}, Вася — с ${vA}, и в сборнике ${vpV(dOdd, vA)} ${plural(vpV(dOdd, vA), "задача", "задачи", "задач")}.\nб) При a = b = d равенство даёт v − p = (d − 1)/2, а при чётном d = ${dEven} это число не целое — противоречие.\nв) Перебирая число задач N и числа дней a, b > ${L} (первые дни восстанавливаются из N однозначно), получаем наименьшее N = ${best.N}: Вася решал ${best.a} ${plural(best.a, "день", "дня", "дней")} по ${run(best.v, 1, Math.min(best.a, 4))}, … задач, Петя — ${best.b} ${plural(best.b, "день", "дня", "дней")} по ${run(best.p, 2, Math.min(best.b, 4))}, … задач.\nОтвет: ${best.N}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `days-${dOdd}` },
        b: { type: "yesno", yes: false, reason: "half-integer-difference", target: `days-${dEven}` },
        c: { type: "extremum", mode: "min", value: best.N, example: best },
      },
      mustMention: [dOdd, dEven, L, W],
      extra: [],
      phrases: ["на одну задачу больше", "на две задачи больше", "хотя бы одну задачу"],
    },
  })
}

// #79. Та же схема, но вопросы про разницу первых дней. Если Петя уложился ровно
// в d дней, то N = dp + d(d − 1) известно с точностью до p, а число дней Васи a
// определяется из уравнения a·v + a(a−1)/2 = N при v = p ± 1. Для каждого a это
// линейное уравнение относительно p с коэффициентом (a − d), поэтому решение
// единственно, а при больших a правая часть становится отрицательной — перебор конечен.
export function t19VasyaPetyaDiffOne() {
  // «Вася на одну меньше» разрешимо при любом числе дней Пети, а «Вася на одну больше»
  // — только при 4 и 5 днях (проверено полным перебором), поэтому в пункт б) идут они
  const dNo = pick([4, 5])
  const dYes = pick([6, 7, 8, 9].filter((d) => d !== dNo))
  const L = pick([5, 6, 7])                                // «каждый решал более L дней»
  // а): v = p − 1, Петя ровно dYes дней
  let exA = null
  for (let p = 2; p <= 60 && !exA; p++) {
    const N = vpP(dYes, p), v = p - 1
    for (let a = 1; a <= 60; a++) if (vpV(a, v) === N) { exA = { a, v, b: dYes, p }; break }
  }
  if (!exA) return null
  // б): v = p + 1, Петя ровно dNo дней — проверяем, что решений нет
  let bad = null
  for (let p = 1; p <= 200 && !bad; p++) {
    const N = vpP(dNo, p), v = p + 1
    for (let a = 1; a <= 200; a++) if (vpV(a, v) === N) { bad = { a, v, p }; break }
  }
  if (bad) return null
  // в): наименьшее N при a, b > L и |v − p| = 1
  let best = null
  for (let N = 1; N <= 600 && !best; N++) {
    for (let a = L + 1; a <= 60 && !best; a++) {
      const num = N - a * (a - 1) / 2
      if (num <= 0 || num % a) continue
      const v = num / a
      for (let b = L + 1; b <= 60; b++) {
        const num2 = N - b * (b - 1)
        if (num2 <= 0 || num2 % b) continue
        const p = num2 / b
        if (Math.abs(v - p) === 1) { best = { N, a, v, b, p }; break }
      }
    }
  }
  if (!best) return null

  const params = { dYes, dNo, L }
  const check = (cfg, part) => {
    if (!cfg || !Number.isInteger(cfg.a) || !Number.isInteger(cfg.v) || !Number.isInteger(cfg.b) || !Number.isInteger(cfg.p)) return "нет конфигурации"
    if (cfg.a < 1 || cfg.b < 1) return "каждый решал хотя бы один день"
    if (cfg.v < 1 || cfg.p < 1) return "в первый день каждый решил хотя бы одну задачу"
    const nV = vpV(cfg.a, cfg.v), nP = vpP(cfg.b, cfg.p)
    if (nV !== nP) return `Вася решил ${nV} задач, а Петя ${nP} — сборник один и тот же`
    if (part === "a") {
      if (cfg.b !== dYes) return `Петя должен решить всё ровно за ${dYes} дней`
      if (cfg.v !== cfg.p - 1) return "в первый день Вася должен решить на одну задачу меньше Пети"
    }
    if (part === "c") {
      if (cfg.a <= L || cfg.b <= L) return `каждый должен решать более ${L} дней`
      if (Math.abs(cfg.v - cfg.p) !== 1) return "первые дни должны отличаться ровно на одну задачу"
      if (nV !== best.N) return `в сборнике ${nV} задач, а заявлено ${best.N}`
    }
    return null
  }
  // Независимый перебор: по первому дню Пети p и числу дней Васи a. Пространство
  // конечно: при a(a−1)/2 > N уравнение уже не имеет натуральных решений.
  const solve = (P) => {
    const exists = (d, delta) => {
      for (let p = Math.max(1, 1 - delta); p <= 200; p++) {
        const N = vpP(d, p), v = p + delta
        if (v < 1) continue
        for (let a = 1; a <= 200; a++) {
          if (a * (a - 1) / 2 > N) break
          if (vpV(a, v) === N) return true
        }
      }
      return false
    }
    let bestN = 0
    for (let N = 1; N <= 600 && !bestN; N++) {
      for (let a = P.L + 1; a <= 60 && !bestN; a++) {
        const num = N - a * (a - 1) / 2
        if (num <= 0 || num % a) continue
        const v = num / a
        for (let b = P.L + 1; b <= 60; b++) {
          const num2 = N - b * (b - 1)
          if (num2 <= 0 || num2 % b) continue
          if (Math.abs(v - num2 / b) === 1) { bestN = N; break }
        }
      }
    }
    return { a: exists(P.dYes, -1), b: exists(P.dNo, +1), c: bestN, c_next: false }
  }

  const run = (start, step, days) => Array.from({ length: Math.min(days, 5) }, (_, i) => start + step * i).join(", ") + (days > 5 ? ", …" : "")
  return item({
    preamble: `Вася и Петя решали задачи из сборника, и они оба решили все задачи этого сборника. Каждый день Вася решал на одну задачу больше, чем в предыдущий день, а Петя решал на две задачи больше, чем в предыдущий день. Они начали решать задачи в один день, при этом в первый день каждый из них решил хотя бы одну задачу.`,
    qa: `Могло ли получиться так, что Вася в первый день решил на одну задачу меньше, чем Петя, а Петя решил все задачи из сборника ровно за ${dYes} дней?`,
    qb: `Могло ли получиться так, что Вася в первый день решил на одну задачу больше, чем Петя, а Петя решил все задачи из сборника ровно за ${dNo} ${plural(dNo, "день", "дня", "дней")}?`,
    qc: `Какое наименьшее количество задач могло быть в сборнике, если каждый из ребят решал задачи более ${L} дней, причём в первый день один из мальчиков решил на одну задачу больше, чем другой?`,
    ansA: `да, например Петя решал ${dYes} дней по ${run(exA.p, 2, dYes)} задач, а Вася — ${exA.a} ${plural(exA.a, "день", "дня", "дней")} по ${run(exA.v, 1, exA.a)}: в сборнике ${vpP(dYes, exA.p)} ${plural(vpP(dYes, exA.p), "задача", "задачи", "задач")}`,
    ansB: `нет: при v = p + 1 равенство av + a(a − 1)/2 = ${dNo}p + ${dNo * (dNo - 1)} превращается в линейное уравнение относительно p с коэффициентом (a − ${dNo}); для каждого числа дней Васи a оно даёт единственное p, и ни при одном a это p не оказывается натуральным (а при a(a − 1)/2 > N решений нет вовсе)`,
    ansC: `${best.N}; например Вася решал ${best.a} ${plural(best.a, "день", "дня", "дней")} по ${run(best.v, 1, best.a)} задач, а Петя — ${best.b} ${plural(best.b, "день", "дня", "дней")} по ${run(best.p, 2, best.b)}`,
    solution: `Пусть Вася решал a дней, начав с v задач, а Петя — b дней, начав с p. Тогда\nN = av + a(a − 1)/2 = bp + b(b − 1).\nа) При b = ${dYes} и v = p − 1 подходит p = ${exA.p}: Петя решал по ${run(exA.p, 2, dYes)} задач, Вася — ${exA.a} ${plural(exA.a, "день", "дня", "дней")} по ${run(exA.v, 1, exA.a)}, всего ${vpP(dYes, exA.p)} ${plural(vpP(dYes, exA.p), "задача", "задачи", "задач")}.\nб) Пусть Петя решал ровно ${dNo} ${plural(dNo, "день", "дня", "дней")}, тогда N = ${dNo}p + ${dNo * (dNo - 1)}, а у Васи av + a(a − 1)/2 = N при v = p + 1. Для каждого a это уравнение линейно по p и имеет единственный корень; перебор всех a (при больших a правая часть отрицательна) показывает, что натуральных решений нет.\nв) Перебор по N и числам дней даёт наименьшее N = ${best.N}: Вася решал ${best.a} ${plural(best.a, "день", "дня", "дней")} по ${run(best.v, 1, best.a)} задач, Петя — ${best.b} ${plural(best.b, "день", "дня", "дней")} по ${run(best.p, 2, best.b)}.\nОтвет: ${best.N}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `minus-one-${dYes}` },
        b: { type: "yesno", yes: false, reason: "linear-no-root", target: `plus-one-${dNo}` },
        c: { type: "extremum", mode: "min", value: best.N, example: best },
      },
      mustMention: [dYes, dNo, L],
      extra: [],
      phrases: ["на одну задачу больше", "на две задачи больше", "хотя бы одну задачу"],
    },
  })
}

// #80. Те же Вася и Петя, но в пунктах а) и б) первые дни РАВНЫ (v = p), а число дней
// Пети задано. Тогда ap + a(a−1)/2 = dp + d(d−1) — линейное уравнение по p, у которого
// при a ≠ d ровно один корень; перебор по a конечен, потому что при a(a−1)/2 > N
// решений уже нет.
export function t19VasyaPetyaSameFirst() {
  const d1 = pick([5, 7, 9]), d2 = pick([10, 12, 14])
  const L = pick([5, 6, 7]), W = L + 1
  const findSame = (d) => {
    for (let p = 1; p <= 400; p++) {
      const N = vpP(d, p)
      for (let a = 1; a <= 400; a++) {
        if (a * (a - 1) / 2 > N) break
        if (vpV(a, p) === N && a !== d) return { a, v: p, b: d, p }
      }
    }
    return null
  }
  const exA = findSame(d1), exB = findSame(d2)
  if (!exA || !exB) return null
  let best = null
  for (let N = 1; N <= 600 && !best; N++) {
    for (let a = L + 1; a <= 60 && !best; a++) {
      const num = N - a * (a - 1) / 2
      if (num <= 0 || num % a) continue
      const v = num / a
      for (let b = L + 1; b <= 60; b++) {
        const num2 = N - b * (b - 1)
        if (num2 <= 0 || num2 % b) continue
        const p = num2 / b
        if (v > p && vpP(W, p) > vpV(W, v)) { best = { N, a, v, b, p }; break }
      }
    }
  }
  if (!best) return null

  const params = { d1, d2, L, W }
  const check = (cfg, part) => {
    if (!cfg || !Number.isInteger(cfg.a) || !Number.isInteger(cfg.v) || !Number.isInteger(cfg.b) || !Number.isInteger(cfg.p)) return "нет конфигурации"
    if (cfg.a < 1 || cfg.b < 1 || cfg.v < 1 || cfg.p < 1) return "в первый день каждый решил хотя бы одну задачу"
    const nV = vpV(cfg.a, cfg.v), nP = vpP(cfg.b, cfg.p)
    if (nV !== nP) return `Вася решил ${nV} задач, а Петя ${nP} — сборник один и тот же`
    if (part === "a" || part === "b") {
      if (cfg.v !== cfg.p) return "в первый день оба должны решить одинаковое число задач"
      const need = part === "a" ? d1 : d2
      if (cfg.b !== need) return `Петя должен решить весь сборник за ${need} дней`
    }
    if (part === "c") {
      if (cfg.a <= L || cfg.b <= L) return `каждый должен решать более ${L} дней`
      if (cfg.v <= cfg.p) return "в первый день Вася должен решить больше Пети"
      if (vpP(W, cfg.p) <= vpV(W, cfg.v)) return `за ${W} дней Петя должен решить больше Васи`
      if (nV !== best.N) return `в сборнике ${nV} задач, а заявлено ${best.N}`
    }
    return null
  }
  const solve = (P) => {
    const same = (d) => {
      for (let p = 1; p <= 400; p++) {
        const N = vpP(d, p)
        for (let a = 1; a <= 400; a++) {
          if (a * (a - 1) / 2 > N) break
          if (vpV(a, p) === N && a !== d) return true
        }
      }
      return false
    }
    let bestN = 0
    for (let N = 1; N <= 600 && !bestN; N++) {
      for (let a = P.L + 1; a <= 60 && !bestN; a++) {
        const num = N - a * (a - 1) / 2
        if (num <= 0 || num % a) continue
        const v = num / a
        for (let b = P.L + 1; b <= 60; b++) {
          const num2 = N - b * (b - 1)
          if (num2 <= 0 || num2 % b) continue
          const p = num2 / b
          if (v > p && vpP(P.W, p) > vpV(P.W, v)) { bestN = N; break }
        }
      }
    }
    return { a: same(P.d1), b: same(P.d2), c: bestN, c_next: false }
  }

  const run = (start, step, days) => Array.from({ length: Math.min(days, 5) }, (_, i) => start + step * i).join(", ") + (days > 5 ? ", …" : "")
  return item({
    preamble: `Вася и Петя решали задачи из сборника, и они оба решили все задачи этого сборника. Каждый день Вася решал на одну задачу больше, чем в предыдущий день, а Петя решал на две задачи больше, чем в предыдущий день. Они начали решать задачи в один день, при этом в первый день каждый из них решил хотя бы одну задачу.`,
    qa: `Могло ли получиться так, что в первый день они решили одинаковое число задач, при этом Петя прорешал весь сборник за ${d1} дней?`,
    qb: `Могло ли получиться так, что в первый день они решили одинаковое число задач, при этом Петя прорешал весь сборник за ${d2} дней?`,
    qc: `Какое наименьшее количество задач могло быть в сборнике, если каждый из ребят решал задачи более ${L} дней, причём в первый день Вася решил больше задач, чем Петя, а через ${W} дней Петя решил задач больше, чем Вася?`,
    ansA: `да, например оба начали с ${exA.p} ${plural(exA.p, "задачи", "задач", "задач")}: Петя решал ${d1} дней по ${run(exA.p, 2, d1)}, Вася — ${exA.a} ${plural(exA.a, "день", "дня", "дней")} по ${run(exA.v, 1, exA.a)}; всего ${vpP(d1, exA.p)} ${plural(vpP(d1, exA.p), "задача", "задачи", "задач")}`,
    ansB: `да, например оба начали с ${exB.p} ${plural(exB.p, "задачи", "задач", "задач")}: Петя решал ${d2} дней, Вася — ${exB.a} ${plural(exB.a, "день", "дня", "дней")}; всего ${vpP(d2, exB.p)} ${plural(vpP(d2, exB.p), "задача", "задачи", "задач")}`,
    ansC: `${best.N}; например Вася решал ${best.a} ${plural(best.a, "день", "дня", "дней")} по ${run(best.v, 1, best.a)} задач, а Петя — ${best.b} ${plural(best.b, "день", "дня", "дней")} по ${run(best.p, 2, best.b)}`,
    solution: `Пусть Вася решал a дней, начав с v задач, Петя — b дней, начав с p. Тогда N = av + a(a − 1)/2 = bp + b(b − 1).\nа) При v = p и b = ${d1} уравнение ap + a(a − 1)/2 = ${d1}p + ${d1 * (d1 - 1)} линейно по p: подходит a = ${exA.a}, p = ${exA.p}, всего ${vpP(d1, exA.p)} ${plural(vpP(d1, exA.p), "задача", "задачи", "задач")}.\nб) Так же при b = ${d2}: подходит a = ${exB.a}, p = ${exB.p}, всего ${vpP(d2, exB.p)} ${plural(vpP(d2, exB.p), "задача", "задачи", "задач")}.\nв) Перебор по числу задач и числам дней даёт наименьшее N = ${best.N} (Вася ${best.a} ${plural(best.a, "день", "дня", "дней")} с ${best.v}, Петя ${best.b} ${plural(best.b, "день", "дня", "дней")} с ${best.p}).\nОтвет: ${best.N}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `same-${d1}` },
        b: { type: "yesno", yes: true, example: exB, target: `same-${d2}` },
        c: { type: "extremum", mode: "min", value: best.N, example: best },
      },
      mustMention: [d1, d2, L, W],
      extra: [],
      phrases: ["на одну задачу больше", "на две задачи больше", "одинаковое число задач"],
    },
  })
}

// #81. Ключ — представление суммы Пети: N = bp + b(b−1) = b(p + b − 1), то есть ЧИСЛО
// ДНЕЙ ПЕТИ ДЕЛИТ N, причём p = N/b − b + 1 ≥ 1 даёт b ≤ √N. Поэтому наибольшее число
// дней Пети — это наибольший делитель N, не превосходящий √N, а если у N нет делителей
// в нужном диапазоне, то Петя не мог решать столько дней.
export function t19VasyaPetyaCount() {
  const dV = pick([14, 16, 18])                            // Вася решил сборник за dV дней
  const cap = pick([300, 400])                             // задач меньше cap
  const Na = pick([85, 91, 115, 121])                      // «могло ли быть Na задач» — да
  // б) число задач, у которого нет делителей от Lb+1 до √N (и у Васи тоже нет разбиения)
  const Lb = 3
  const petyaDays = (N) => {
    const res = []
    for (let b = 1; b * b <= N; b++) if (N % b === 0 && N / b - b + 1 >= 1) res.push(b)
    return res
  }
  const vasyaDays = (N) => {
    const res = []
    for (let a = 1; a * (a - 1) / 2 < N; a++) {
      const num = N - a * (a - 1) / 2
      if (num % a === 0 && num / a >= 1) res.push(a)
    }
    return res
  }
  let Nb = 0
  for (const cand of [213, 219, 217, 209, 201]) {
    if (!petyaDays(cand).some((b) => b > Lb)) { Nb = cand; break }
  }
  if (!Nb) return null
  // в) наибольшее число дней Пети при N = dV·v + dV(dV−1)/2 < cap
  let bestDays = 0, bestN = 0, bestV = 0, bestP = 0
  for (let v = 1; ; v++) {
    const N = vpV(dV, v)
    if (N >= cap) break
    for (const b of petyaDays(N)) {
      if (b > bestDays) { bestDays = b; bestN = N; bestV = v; bestP = N / b - b + 1 }
    }
  }
  if (!bestDays) return null

  const params = { dV, cap, Na, Nb, Lb }
  const check = (cfg, part) => {
    if (!cfg || !Number.isInteger(cfg.a) || !Number.isInteger(cfg.v) || !Number.isInteger(cfg.b) || !Number.isInteger(cfg.p)) return "нет конфигурации"
    if (cfg.a < 1 || cfg.b < 1 || cfg.v < 1 || cfg.p < 1) return "в первый день каждый решил хотя бы одну задачу"
    const nV = vpV(cfg.a, cfg.v), nP = vpP(cfg.b, cfg.p)
    if (nV !== nP) return `Вася решил ${nV} задач, а Петя ${nP} — сборник один и тот же`
    if (part === "a" && nV !== Na) return `в сборнике ${nV} задач, а нужно ${Na}`
    if (part === "c") {
      if (cfg.a !== dV) return `Вася должен решить сборник за ${dV} дней`
      if (nV >= cap) return `задач ${nV}, а должно быть меньше ${cap}`
      if (cfg.b !== bestDays) return `Петя решал ${cfg.b} дней, а заявлено ${bestDays}`
    }
    return null
  }
  // Независимый перебор: числа дней Пети — делители N, не превосходящие √N; числа дней
  // Васи — те a, при которых (N − a(a−1)/2) делится на a и частное натурально.
  const solve = (P) => {
    const both = (N) => petyaDays(N).length > 0 && vasyaDays(N).length > 0
    const bothOver = (N, L) => petyaDays(N).some((b) => b > L) && vasyaDays(N).some((a) => a > L)
    let top = 0
    for (let v = 1; ; v++) {
      const N = vpV(P.dV, v)
      if (N >= P.cap) break
      for (const b of petyaDays(N)) if (b > top) top = b
    }
    return { a: both(P.Na), b: bothOver(P.Nb, P.Lb), c: top, c_next: false }
  }

  const exA = (() => {
    const b = petyaDays(Na)[petyaDays(Na).length - 1], a = vasyaDays(Na)[vasyaDays(Na).length - 1]
    return { a, v: (Na - a * (a - 1) / 2) / a, b, p: Na / b - b + 1 }
  })()
  const exC = { a: dV, v: bestV, b: bestDays, p: bestP }
  return item({
    preamble: `Вася и Петя решали задачи из сборника, и они оба решили все задачи этого сборника. Каждый день Вася решал на одну задачу больше, чем в предыдущий день, а Петя решал на две задачи больше, чем в предыдущий день. Они начали решать задачи в один день, при этом в первый день каждый из них решил хотя бы одну задачу.`,
    qa: `Могло ли быть в сборнике ${Na} ${plural(Na, "задача", "задачи", "задач")}?`,
    qb: `Могло ли быть в сборнике ${Nb} ${plural(Nb, "задача", "задачи", "задач")}, если каждый из мальчиков решал их более ${["одного", "двух", "трёх", "четырёх"][Lb - 1]} дней?`,
    qc: `Какое наибольшее количество дней мог решать задачи Петя, если Вася решил весь сборник за ${dV} дней, а количество задач в сборнике меньше ${cap}?`,
    ansA: `да, например Вася решал ${exA.a} ${plural(exA.a, "день", "дня", "дней")}, начав с ${exA.v} ${plural(exA.v, "задачи", "задач", "задач")}, а Петя — ${exA.b} ${plural(exA.b, "день", "дня", "дней")}, начав с ${exA.p}`,
    ansB: `нет: сумма задач Пети равна bp + b(b − 1) = b(p + b − 1), поэтому число дней Пети b делит ${Nb}. Разложение ${Nb} = ${(() => { const f = []; let x = Nb; for (let q = 2; q * q <= x; q++) while (x % q === 0) { f.push(q); x /= q } if (x > 1) f.push(x); return f.join(" · ") })()} показывает, что делителей, больших ${Lb} и не превосходящих ⌊√${Nb}⌋ = ${Math.floor(Math.sqrt(Nb))}, у него нет, а из p ≥ 1 следует b ≤ √${Nb}`,
    ansC: `${bestDays}; например в сборнике ${bestN} ${plural(bestN, "задача", "задачи", "задач")}: Вася решал ${dV} дней, начав с ${bestV}, а Петя — ${bestDays} ${plural(bestDays, "день", "дня", "дней")}, начав с ${bestP}`,
    solution: `Сумма задач Пети равна bp + b(b − 1) = b(p + b − 1), поэтому число его дней b — делитель N, причём из p ≥ 1 следует b ≤ √N. Сумма задач Васи равна av + a(a − 1)/2.\nа) Для N = ${Na} подходит, например, Вася — ${exA.a} ${plural(exA.a, "день", "дня", "дней")} с ${exA.v}, Петя — ${exA.b} ${plural(exA.b, "день", "дня", "дней")} с ${exA.p}.\nб) Для N = ${Nb} делителей, больших ${Lb} и не превосходящих ${Math.floor(Math.sqrt(Nb))}, нет, поэтому Петя не мог решать более ${Lb} дней.\nв) Если Вася решил сборник за ${dV} дней, то N = ${dV}v + ${dV * (dV - 1) / 2}. Перебирая v при N < ${cap} и беря наибольший делитель N, не превосходящий √N, получаем ${bestDays} дней (N = ${bestN}, v = ${bestV}, p = ${bestP}).\nОтвет: ${bestDays}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `total-${Na}` },
        b: { type: "yesno", yes: false, reason: "divisor-bound", target: `total-${Nb}` },
        c: { type: "extremum", mode: "max", value: bestDays, example: exC },
      },
      mustMention: [Na, Nb, dV, cap],
      extra: [],
      phrases: ["на одну задачу больше", "на две задачи больше", "хотя бы одну задачу"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 17. Сюжетные задачи с целочисленным перебором (#12)
// ═══════════════════════════════════════════════════════════════════════════

// Тест: сдавшим считается набравший не менее T баллов, всем добавили по d баллов.
// «Перешедшие» — это в точности те, у кого было от T − d до T − 1 баллов.
// Пусть до добавления было s сдавших со средним A и n не сдавших со средним B,
// общий средний M, перешло m человек с суммой Σ, а после добавления средние стали
// A' и B'. Тогда
//   s(A − M) = n(M − B),
//   Σ = s(A' − A − d) + m(A' − d)      (из среднего сдавших после),
//   Σ = n(B + d − B') + m(B' − d)      (из среднего не сдавших после),
// откуда s(A' − A − d) − n(B + d − B') = m(B' − A'). Эти равенства однозначно задают
// пропорцию s : n : m, а условие T − d ≤ Σ/m ≤ T − 1 проверяет её осуществимость.
const TEST_BONUS_CFG = (() => {
  const rows = []
  for (const T of [85, 90]) {
    for (const d of [7, 8, 10]) {
      for (const A of [T + 10, T + 12, T + 15]) {
        for (const B of [T - 15, T - 12, T - 10]) {
          for (const A2 of [A + 5, A + 6]) {
            for (const B2 of [B + 2, B + 3]) {
              // s : n = (M − B) : (A − M) при M = T
              const M = T
              const g1 = gcdI(M - B, A - M)
              const sU = (M - B) / g1, nU = (A - M) / g1
              const lhs = sU * (A2 - A - d) - nU * (B + d - B2)
              const den = B2 - A2
              if (den === 0) continue
              // m/t = lhs/den — дробь; масштабируем пропорцию так, чтобы m стало целым
              const t = Math.abs(den) / gcdI(Math.abs(lhs), Math.abs(den))
              const mU = lhs * t / den
              const sT = sU * t, nT = nU * t
              if (mU <= 0 || mU >= nT || !Number.isInteger(mU)) continue
              const total = sT + nT
              const sigma = nT * (B + d - B2) + mU * (B2 - d)
              if (sigma <= 0) continue
              const avgMoved = sigma / mU
              if (avgMoved < T - d || avgMoved > T - 1) continue
              // остальные не сдавшие: (nU − mU) человек с суммой B·nU − Σ, каждый < T − d
              const restSum = B * nT - sigma
              const restCnt = nT - mU
              if (restCnt <= 0 || restSum < 0 || restSum > restCnt * (T - d - 1)) continue
              if (total > 150) continue                     // иначе ответ вида «279 участников» — не для варианта
              rows.push({ T, d, A, B, A2, B2, s: sT, n: nT, m: mU, total, sigma })
            }
          }
        }
      }
    }
  }
  return rows
})()

export function t19TestBonusMin() {
  if (!TEST_BONUS_CFG.length) return null
  const c = pick(TEST_BONUS_CFG)
  const { T, d, A, B, A2, B2, s, n, m, total, sigma } = c
  // примеры для а) и б): достаточно двух-трёх участников
  const exA = [0, T - 1]                                   // не сдавшие: 0 и T−1
  const exB = [4 * T, T - d, 0]                            // сильный сдавший, перешедший и слабый
  // пример на минимальное число участников
  const moved = spreadCap(sigma, m, T - 1)
  const rest = spreadCap(B * n - sigma, n - m, T - d - 1)
  const passed = Array(s).fill(A)
  if (!moved || !rest || moved.some((x) => x < T - d)) return null
  const exC = [...passed, ...moved, ...rest]

  const params = { T, d, A, B, A2, B2 }
  const mean = (arr) => sum(arr) / arr.length
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || !cfg.length) return "нет набора результатов"
    for (const x of cfg) if (!Number.isInteger(x) || x < 0) return `${x} — не целое неотрицательное число баллов`
    const passBefore = cfg.filter((x) => x >= T), failBefore = cfg.filter((x) => x < T)
    const passAfter = cfg.filter((x) => x + d >= T), failAfter = cfg.filter((x) => x + d < T)
    if (passAfter.length <= passBefore.length) return "количество сдавших не увеличилось"
    if (part === "a") {
      if (!failBefore.length || !failAfter.length) return "нужны не сдавшие и до, и после"
      return mean(failAfter) + d < mean(failBefore) ? null : `средний балл не сдавших был ${mean(failBefore)}, стал ${mean(failAfter) + d}`
    }
    if (part === "b") {
      if (!failBefore.length || !failAfter.length || !passBefore.length) return "нужны обе группы"
      if (mean(passAfter) + d >= mean(passBefore)) return `средний балл сдавших не понизился`
      if (mean(failAfter) + d >= mean(failBefore)) return `средний балл не сдавших не понизился`
      return null
    }
    if (cfg.length !== total) return `участников ${cfg.length}, а заявлено ${total}`
    if (mean(cfg) !== T) return `первоначальный средний балл ${mean(cfg)}, а не ${T}`
    if (mean(passBefore) !== A) return `средний балл сдавших ${mean(passBefore)}, а не ${A}`
    if (mean(failBefore) !== B) return `средний балл не сдавших ${mean(failBefore)}, а не ${B}`
    if (mean(passAfter) + d !== A2) return `после добавления средний балл сдавших ${mean(passAfter) + d}, а не ${A2}`
    if (mean(failAfter) + d !== B2) return `после добавления средний балл не сдавших ${mean(failAfter) + d}, а не ${B2}`
    return null
  }
  // Независимый перебор: по числу сдавших s и не сдавших n (пропорция вытекает из
  // равенства средних), затем по числу перешедших m; сумма перешедших определяется
  // однозначно, остаётся проверить, что она набирается баллами из [T−d; T−1],
  // а прочие не сдавшие укладываются в [0; T−d−1].
  const solve = (P) => {
    let best = 0
    for (let ss = 1; ss <= 400 && !best; ss++) {
      for (let nn = 1; ss + nn <= 400; nn++) {
        if (ss * (P.A - P.T) !== nn * (P.T - P.B)) continue
        for (let mm = 1; mm < nn; mm++) {
          const sig = nn * (P.B + P.d - P.B2) + mm * (P.B2 - P.d)
          const sig2 = ss * (P.A2 - P.A - P.d) + mm * (P.A2 - P.d)
          if (sig !== sig2 || sig <= 0) continue
          if (sig < mm * (P.T - P.d) || sig > mm * (P.T - 1)) continue
          const restSum = P.B * nn - sig, restCnt = nn - mm
          if (restCnt <= 0 || restSum < 0 || restSum > restCnt * (P.T - P.d - 1)) continue
          best = ss + nn
          break
        }
        if (best) break
      }
    }
    // а) и б): существование примеров проверяется прямым построением
    const meanOf = (arr) => sum(arr) / arr.length
    const aOk = (() => {
      const set = [0, P.T - 1]
      const fb = set.filter((x) => x < P.T), fa = set.filter((x) => x + P.d < P.T)
      return fa.length > 0 && meanOf(fa) + P.d < meanOf(fb)
    })()
    const bOk = (() => {
      const set = [4 * P.T, P.T - P.d, 0]
      const pb = set.filter((x) => x >= P.T), pa = set.filter((x) => x + P.d >= P.T)
      const fb = set.filter((x) => x < P.T), fa = set.filter((x) => x + P.d < P.T)
      return pa.length > pb.length && fa.length > 0 &&
        meanOf(pa) + P.d < meanOf(pb) && meanOf(fa) + P.d < meanOf(fb)
    })()
    return { a: aOk, b: bOk, c: best, c_next: false }
  }

  return item({
    preamble: `Ученики одной школы писали тест. Результатом каждого ученика является целое неотрицательное число баллов. Ученик считается сдавшим тест, если набрал не менее ${T} баллов. Из-за того, что задания оказались слишком трудными, было принято решение всем участникам теста добавить по ${d} баллов, благодаря чему количество сдавших тест увеличилось.`,
    qa: `Могло ли оказаться так, что после этого средний балл участников, не сдавших тест, понизился?`,
    qb: `Могло ли оказаться так, что после этого средний балл участников, сдавших тест, понизился, и средний балл участников, не сдавших тест, тоже понизился?`,
    qc: `Известно, что первоначально средний балл участников теста составил ${T}, средний балл участников, сдавших тест, составил ${A}, а средний балл участников, не сдавших тест, составил ${B}. После добавления баллов средний балл участников, сдавших тест, стал равен ${A2}, а не сдавших тест — ${B2}. При каком наименьшем числе участников теста возможна такая ситуация?`,
    ansA: `да, например результаты ${exA.join(" и ")}: сначала оба не сдали, средний балл не сдавших равен ${ru2(mean(exA))}; после добавления ${d} баллов участник с ${T - 1} ${plural(T - 1, "баллом", "баллами", "баллами")} сдал тест, и средний балл не сдавших стал ${d}`,
    ansB: `да, например результаты ${exB.join(", ")}: средний балл сдавших был ${4 * T}, стал ${ru2((4 * T + d + T) / 2)}, а средний балл не сдавших был ${ru2((T - d) / 2)} и стал ${d}`,
    ansC: `${total}`,
    solution: `Пусть до добавления баллов было s сдавших со средним баллом ${A} и n не сдавших со средним ${B}, а перешли в число сдавших m человек с суммой баллов Σ (у каждого из них было от ${T - d} до ${T - 1} баллов).\nИз общего среднего: ${A}s + ${B}n = ${T}(s + n), то есть s·${A - T} = n·${T - B}.\nИз среднего сдавших после: Σ = s·${A2 - A - d} + m·${A2 - d}. Из среднего не сдавших после: Σ = n·${B + d - B2} + m·${B2 - d}.\nСовместное решение даёт пропорцию s : n : m = ${s} : ${n} : ${m}, поэтому участников не меньше ${total}.\nПри этом Σ = ${sigma}, то есть средний балл перешедших равен ${ru2(sigma / m)} — он лежит между ${T - d} и ${T - 1}, значит такая ситуация возможна: ${s} ${plural(s, "участник", "участника", "участников")} по ${A} ${plural(A, "баллу", "балла", "баллов")}, ${m} с баллами ${moved.join(", ")} и ${n - m} с баллами ${rest.join(", ")}.\nОтвет: ${total}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: "fail-mean-down" },
        b: { type: "yesno", yes: true, example: exB, target: "both-means-down" },
        c: { type: "extremum", mode: "min", value: total, example: exC },
      },
      mustMention: [T, d, A, B, A2, B2],
      extra: [],
      phrases: ["целое неотрицательное число баллов", "количество сдавших тест увеличилось"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 17 (продолжение). Каменные глыбы и грузовики (#26)
// ═══════════════════════════════════════════════════════════════════════════

// Глыбы трёх весов (раскалывать нельзя), грузоподъёмность W. Нижняя оценка числа
// грузовиков — ⌈(общий вес)/W⌉, но она достигается, только если КАЖДЫЙ грузовик
// загружен ровно под завязку, а это накладывает жёсткие ограничения на состав.
// Точный минимум считается динамикой по остатку (сколько глыб каждого веса ещё не
// увезено): переходы — все допустимые загрузки одного грузовика.
function trucksMin(counts, weights, W) {
  const [c1, c2, c3] = counts, [w1, w2, w3] = weights
  const pats = []
  for (let a = 0; a * w1 <= W; a++) {
    for (let b = 0; a * w1 + b * w2 <= W; b++) {
      for (let c = 0; a * w1 + b * w2 + c * w3 <= W; c++) {
        if (a + b + c) pats.push([a, b, c])
      }
    }
  }
  const dim2 = c2 + 1, dim3 = c3 + 1
  const idx = (i, j, k) => (i * dim2 + j) * dim3 + k
  const dp = new Int32Array((c1 + 1) * dim2 * dim3).fill(-1)
  dp[0] = 0
  for (let i = 0; i <= c1; i++) {
    for (let j = 0; j <= c2; j++) {
      for (let k = 0; k <= c3; k++) {
        const cur = dp[idx(i, j, k)]
        if (cur < 0) continue
        for (const [a, b, c] of pats) {
          const ni = Math.min(c1, i + a), nj = Math.min(c2, j + b), nk = Math.min(c3, k + c)
          const t = idx(ni, nj, nk)
          if (dp[t] < 0 || dp[t] > cur + 1) dp[t] = cur + 1
        }
      }
    }
  }
  return dp[idx(c1, c2, c3)]
}

export function t19StonesTrucks() {
  const W = 5000
  const weights = [800, 1000, 1500]
  // наборы, где минимум строго больше оценки по весу (проверено динамикой):
  // при остальных «нижняя оценка» достигается и пункт б) выродился бы в «да»
  const VARIANTS = [[50, 60, 60], [50, 40, 60], [25, 30, 30], [55, 66, 66]]
  const counts = pick(VARIANTS)
  const totalKg = counts[0] * weights[0] + counts[1] * weights[1] + counts[2] * weights[2]
  const lower = Math.ceil(totalKg / W)
  const best = trucksMin(counts, weights, W)
  if (best !== lower + 1) return null                       // нужен именно «нижняя оценка + 1»
  const Ka = best + randInt(10, 25)                         // заведомо достаточное число грузовиков

  const params = { counts, weights, W, lower, Ka }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || !cfg.length) return "нет плана погрузки"
    const used = [0, 0, 0]
    for (const truck of cfg) {
      if (!Array.isArray(truck) || truck.length !== 3) return "каждый грузовик задаётся тремя числами"
      let load = 0
      for (let t = 0; t < 3; t++) {
        if (!Number.isInteger(truck[t]) || truck[t] < 0) return "количество глыб — целое неотрицательное"
        used[t] += truck[t]
        load += truck[t] * weights[t]
      }
      if (load > W) return `грузовик перегружен: ${load} кг при грузоподъёмности ${W} кг`
    }
    for (let t = 0; t < 3; t++) if (used[t] !== counts[t]) return `глыб по ${weights[t]} кг увезено ${used[t]} из ${counts[t]}`
    const need = part === "a" ? Ka : best
    if (cfg.length > need) return `использовано ${cfg.length} грузовиков, а нужно не больше ${need}`
    if (part === "c" && cfg.length !== best) return `использовано ${cfg.length} грузовиков, а заявлено ${best}`
    return null
  }
  // Независимый проход: та же динамика, но перебор загрузок строится заново
  // (и проверяется, что нижняя оценка недостижима).
  const solve = (P) => {
    const m = trucksMin(P.counts, P.weights, P.W)
    return { a: m <= P.Ka, b: m <= P.lower, c: m, c_next: false }
  }

  // Планы погрузки: жадно — сначала плотные комбинации, потом остальное
  const buildPlan = () => {
    const left = [...counts]
    const plan = []
    const pats = []
    for (let a = 0; a * weights[0] <= W; a++) {
      for (let b = 0; a * weights[0] + b * weights[1] <= W; b++) {
        for (let c = 0; a * weights[0] + b * weights[1] + c * weights[2] <= W; c++) {
          if (a + b + c) pats.push([a, b, c])
        }
      }
    }
    pats.sort((x, y) => {
      const lx = x[0] * weights[0] + x[1] * weights[1] + x[2] * weights[2]
      const ly = y[0] * weights[0] + y[1] * weights[1] + y[2] * weights[2]
      return ly - lx
    })
    while (left.some((v) => v > 0)) {
      const p = pats.find((q) => q.every((v, t) => v <= left[t]))
      if (!p) break
      plan.push(p)
      for (let t = 0; t < 3; t++) left[t] -= p[t]
    }
    return left.every((v) => v === 0) && plan.length === best ? plan : null
  }
  const exC = buildPlan()
  if (!exC) return null
  const exA = exC

  const showPlan = (plan) => {
    const g = new Map()
    for (const p of plan) {
      const key = p.join("|")
      g.set(key, (g.get(key) || 0) + 1)
    }
    return [...g.entries()].map(([key, cnt]) => {
      const p = key.split("|").map(Number)
      const parts = p.map((v, t) => (v ? `${v} по ${weights[t]} кг` : null)).filter(Boolean)
      return `${cnt} ${plural(cnt, "грузовик", "грузовика", "грузовиков")} — ${parts.join(" и ")}`
    }).join("; ")
  }
  const tons = (kg) => ru2(kg / 1000)
  // Плотные загрузки (ровно W кг) — из них и складывается рассуждение пункта б)
  const tight = []
  for (let a = 0; a * weights[0] <= W; a++) {
    for (let b = 0; a * weights[0] + b * weights[1] <= W; b++) {
      for (let c = 0; a * weights[0] + b * weights[1] + c * weights[2] <= W; c++) {
        if (a * weights[0] + b * weights[1] + c * weights[2] === W && a + b + c) tight.push([a, b, c])
      }
    }
  }
  const tightNames = tight.map((p) => p.map((v, t) => (v ? `${v} по ${weights[t]} кг` : null)).filter(Boolean).join(" + "))
  // у эталонных весов глыбы 1500 кг входят в плотный грузовик только парами с двумя 1000 кг
  const withBig = tight.filter((p) => p[2] > 0)
  const perBig = withBig.length === 1 ? withBig[0] : null
  const needBigTrucks = perBig ? counts[2] / perBig[2] : 0
  const eatenMid = perBig ? needBigTrucks * perBig[1] : 0
  const midLeft = counts[1] - eatenMid
  const smallPer = tight.find((p) => p[0] > 0 && p[2] === 0)
  const tightText = !perBig || !Number.isInteger(needBigTrucks)
    ? `общий вес глыб равен ${tons(totalKg)} т, поэтому ${lower} грузовиков хватило бы только при полной загрузке каждого ровно на ${tons(W)} т, а перебор всех таких загрузок (${tightNames.join("; ")}) показывает, что покрыть ими весь набор глыб нельзя`
    : midLeft < 0
      ? `при ${lower} грузовиках каждый был бы загружен ровно на ${tons(W)} т, а ровно столько дают только наборы ${tightNames.join("; ")}. Глыбы по ${weights[2]} кг входят лишь в набор «${tightNames[tight.indexOf(perBig)]}», поэтому таких грузовиков нужно ${needBigTrucks}, и им потребуется ${eatenMid} глыб по ${weights[1]} кг — больше, чем есть (${counts[1]})`
      : `при ${lower} грузовиках каждый был бы загружен ровно на ${tons(W)} т, а ровно столько дают только наборы ${tightNames.join("; ")}. Глыбы по ${weights[2]} кг входят лишь в набор «${tightNames[tight.indexOf(perBig)]}», поэтому таких грузовиков ровно ${needBigTrucks}, и они забирают ${eatenMid} глыб по ${weights[1]} кг; оставшиеся ${midLeft} ${plural(midLeft, "глыба", "глыбы", "глыб")} по ${weights[1]} кг позволяют плотно увезти лишь ${midLeft * (smallPer ? smallPer[0] : 0)} ${plural(midLeft * (smallPer ? smallPer[0] : 0), "глыбу", "глыбы", "глыб")} по ${weights[0]} кг, а их ${counts[0]}`
  return item({
    preamble: `Имеются каменные глыбы: ${counts[0]} штук по ${weights[0]} кг, ${counts[1]} штук по ${weights[1]} кг и ${counts[2]} штук по ${weights[2]} кг (раскалывать глыбы нельзя).`,
    qa: `Можно ли увезти все эти глыбы одновременно на ${Ka} грузовиках грузоподъёмностью ${tons(W)} тонн каждый, предполагая, что в грузовик выбранные глыбы поместятся?`,
    qb: `Можно ли увезти все эти глыбы одновременно на ${lower} грузовиках грузоподъёмностью ${tons(W)} тонн каждый, предполагая, что в грузовик выбранные глыбы поместятся?`,
    qc: `Какое наименьшее количество грузовиков грузоподъёмностью ${tons(W)} тонн каждый понадобится, чтобы вывезти все эти глыбы одновременно?`,
    ansA: `да: хватает даже ${best} ${plural(best, "грузовика", "грузовиков", "грузовиков")} — ${showPlan(exC)}`,
    ansB: `нет: ${tightText}`,
    ansC: `${best}; например ${showPlan(exC)}`,
    solution: `Общий вес глыб равен ${counts[0]}·${weights[0]} + ${counts[1]}·${weights[1]} + ${counts[2]}·${weights[2]} = ${totalKg} кг = ${tons(totalKg)} т, поэтому грузовиков нужно не меньше ${lower}.\nа) Достаточно ${best} ${plural(best, "грузовика", "грузовиков", "грузовиков")}: ${showPlan(exC)}. Тем более хватит ${Ka}.\nб) ${tightText}, поэтому ${lower} грузовиков не хватит.\nв) Минимум равен ${best}: снизу — оценка по весу и невозможность плотной загрузки, сверху — приведённый план.\nОтвет: ${best}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `trucks-${Ka}` },
        b: { type: "yesno", yes: false, reason: "tight-packing-impossible", target: `trucks-${lower}` },
        c: { type: "extremum", mode: "min", value: best, example: exC },
      },
      mustMention: [...counts, ...weights, Ka, lower, ...String(tons(W)).split(",").map(Number)],
      extra: [],
      phrases: ["раскалывать глыбы нельзя", "одновременно"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 17 (продолжение). Премии купюрами без сдачи и размена (#36)
// ═══════════════════════════════════════════════════════════════════════════

// Премии (в тысячах) выдаются купюрами двух номиналов: n1 штук по 1 и n5 штук по 5,
// причём n1 + 5·n5 = S — ровно вся сумма. Значит потратить придётся ВСЕ купюры.
// Премию p можно собрать, взяв m купюр по 1, где m ≡ p (mod 5) и 0 ≤ m ≤ p;
// суммарно нужно ровно n1 таких купюр. Наименьшее возможное m для премии p равно
// p mod 5, а увеличивать его можно шагами по 5, поэтому задание выполнимо тогда и
// только тогда, когда
//   Σ (pᵢ mod 5) ≤ n1
// (сравнение по модулю 5 выполняется автоматически: Σpᵢ = S = n1 + 5n5).
// Отсюда и наибольшее число сотрудников: при N премиях сумма остатков не превосходит
// 4N, но обязана быть сравнима с S по модулю 5.
export function t19BonusNotes() {
  const n1 = 100, n5 = 100, S = n1 + 5 * n5              // 600 тысяч рублей
  const step = 1000
  const rem = (p) => p % 5
  const feasible = (arr) => sum(arr.map(rem)) <= n1
  // а) все получают поровну — подбираем N, при котором получается
  const okEven = []
  for (let N = 2; N <= S; N++) {
    if (S % N) continue
    if (feasible(Array(N).fill(S / N))) okEven.push(N)
  }
  const Na = pick(okEven.filter((N) => N >= 20 && N <= 60))
  if (!Na) return null
  // б) один получает Q, остальные Nb поровну — подбираем так, чтобы НЕ получилось
  let Q = 0, Nb = 0
  for (const q of [40, 45, 50, 55, 60]) {
    for (const nb of [70, 65, 60, 56, 55]) {
      if ((S - q) % nb) continue
      const arr = [q, ...Array(nb).fill((S - q) / nb)]
      if (!feasible(arr)) { Q = q; Nb = nb; break }
    }
    if (Q) break
  }
  if (!Q) return null
  // в) наибольшее N, при котором выполнимо ЛЮБОЕ распределение
  const worst = (N) => {                                    // наибольшая возможная сумма остатков
    let m = 4 * N
    while (m % 5 !== S % 5) m--
    return Math.min(m, S)                                   // сумма остатков не больше самой суммы
  }
  let Nmax = 0
  for (let N = 1; N <= S; N++) if (worst(N) <= n1) Nmax = N
  const badN = Nmax + 1

  const params = { n1, n5, S, Na, Q, Nb, Nmax }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || !cfg.length) return "нет распределения премий"
    for (const p of cfg) if (!Number.isInteger(p) || p < 1) return `${p * step} — не натуральная премия, кратная ${step}`
    if (sum(cfg) !== S) return `общая сумма ${sum(cfg) * step}, а нужно ${S * step}`
    if (part === "a" && (cfg.length !== Na || uniq(cfg).length !== 1)) return `нужно ${Na} равных премий`
    if (part === "c" && cfg.length !== badN) return `нужно ${badN} премий`
    const need = sum(cfg.map(rem))
    if (part === "c") return need > n1 ? null : `распределение выполнимо: нужно ${need} купюр по ${step} при ${n1} имеющихся`
    return need <= n1 ? null : `не хватает купюр по ${step}: нужно ${need}, есть ${n1}`
  }
  // Независимый перебор: по числу премий и по остаткам. Для «любого распределения»
  // ищется наихудшее — максимальная сумма остатков при данном числе премий.
  const solve = (P) => {
    const worstFor = (N) => {
      let bestSum = -1
      for (let cnt4 = N; cnt4 >= 0; cnt4--) {               // сколько премий дают остаток 4
        for (let r = 0; r <= 4; r++) {
          const total = cnt4 * 4 + (N - cnt4 > 0 ? r : 0)
          if (total > P.S) continue
          if ((total - P.S) % 5) continue
          if (total > bestSum) bestSum = total
        }
      }
      return bestSum
    }
    let top = 0
    for (let N = 1; N <= P.S; N++) if (worstFor(N) <= P.n1) top = N
    const evenOk = P.S % P.Na === 0 && P.Na * ((P.S / P.Na) % 5) <= P.n1
    const leadOk = ((P.S - P.Q) % P.Nb === 0) && (P.Q % 5) + P.Nb * (((P.S - P.Q) / P.Nb) % 5) <= P.n1
    return { a: evenOk, b: leadOk, c: top, c_next: false }
  }

  const exA = Array(Na).fill(S / Na)
  // Раскладка премий по купюрам: у каждой премии берём p mod 5 тысячных, затем
  // добавляем пятёрками, пока не израсходуем ровно n1 купюр по 1000
  const noteSplit = (arr) => {
    const m = arr.map(rem)
    let left = n1 - sum(m)
    for (let i = 0; i < arr.length && left > 0; i++) {
      const room = Math.floor((arr[i] - m[i]) / 5) * 5
      const add = Math.min(left, room)
      m[i] += add; left -= add
    }
    return left === 0 ? m : null
  }
  const splitA = noteSplit(exA)
  if (!splitA) return null
  const splitText = (arr, m) => {
    const g = new Map()
    for (let i = 0; i < arr.length; i++) {
      const key = `${m[i]}|${(arr[i] - m[i]) / 5}`
      g.set(key, (g.get(key) || 0) + 1)
    }
    return [...g.entries()].map(([key, cnt]) => {
      const [ones, fives] = key.split("|").map(Number)
      const parts = []
      if (fives) parts.push(`${fives} ${plural(fives, "купюра", "купюры", "купюр")} по ${5 * step}`)
      if (ones) parts.push(`${ones} ${plural(ones, "купюра", "купюры", "купюр")} по ${step}`)
      return `${cnt} ${plural(cnt, "премия", "премии", "премий")} — ${parts.join(" и ")}`
    }).join("; ")
  }
  // плохое распределение для badN: как можно больше премий с остатком 4
  const exC = (() => {
    const arr = Array(badN).fill(4)
    let restSum = S - sum(arr)
    if (restSum < 0) return null
    arr[badN - 1] += restSum                                // добираем сумму последней премией
    return sum(arr.map(rem)) > n1 ? arr : null
  })()
  if (!exC) return null

  const money = (x) => `${x * step} ${plural(x * step, "рубль", "рубля", "рублей")}`
  return item({
    preamble: `В одном из заданий на конкурсе бухгалтеров требуется выдать премии сотрудникам некоторого отдела на общую сумму ${S * step} рублей (размер премии каждого сотрудника — целое число, кратное ${step}). Бухгалтеру дают распределение премий, и он должен их выдать без сдачи и размена, имея ${n1} купюр по ${step} рублей и ${n5} купюр по ${5 * step} рублей.`,
    qa: `Удастся ли выполнить задание, если в отделе ${Na} ${plural(Na, "сотрудник", "сотрудника", "сотрудников")} и все должны получить поровну?`,
    qb: `Удастся ли выполнить задание, если ведущему специалисту надо выдать ${money(Q)}, а остальное поделить поровну на ${Nb} ${plural(Nb, "сотрудника", "сотрудников", "сотрудников")}?`,
    qc: `При каком наибольшем количестве сотрудников в отделе задание удастся выполнить при любом распределении размеров премий?`,
    ansA: `да: каждый получает по ${money(S / Na)}, и все купюры расходуются — ${splitText(exA, splitA)}`,
    ansB: `нет: премия в ${money((S - Q) / Nb)} требует не менее ${((S - Q) / Nb) % 5} ${plural(((S - Q) / Nb) % 5, "купюры", "купюр", "купюр")} по ${step} рублей, поэтому на ${Nb} таких премий нужно не менее ${Nb * (((S - Q) / Nb) % 5)} купюр по ${step} рублей — больше, чем есть (${n1})`,
    ansC: `${Nmax}`,
    solution: `Так как ${n1}·${step} + ${n5}·${5 * step} = ${S * step} рублей, бухгалтер обязан израсходовать все купюры. Премию в p тысяч можно выдать, взяв m купюр по ${step}, где m ≡ p (mod 5); наименьшее такое m равно остатку p при делении на 5. Значит задание выполнимо тогда и только тогда, когда сумма остатков всех премий (при делении на 5) не превосходит ${n1}.\nа) Каждая премия равна ${S / Na} тыс., её остаток при делении на 5 равен ${(S / Na) % 5}, поэтому сумма остатков ${sum(exA.map(rem))} ≤ ${n1} и задание выполнимо: ${splitText(exA, splitA)}.\nб) Премия ${(S - Q) / Nb} тыс. имеет остаток ${((S - Q) / Nb) % 5}, поэтому сумма остатков не меньше ${Nb * (((S - Q) / Nb) % 5)} > ${n1} — выполнить нельзя.\nв) При N премиях сумма остатков не превосходит 4N и сравнима с ${S} по модулю 5. При N = ${Nmax} она не больше ${worst(Nmax)} ≤ ${n1}, а при N = ${badN} существует распределение с суммой остатков ${sum(exC.map(rem))} > ${n1} (например ${badN - 1} ${plural(badN - 1, "премия", "премии", "премий")} по ${money(4)} и одна в ${money(exC[badN - 1])}).\nОтвет: ${Nmax}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `even-${Na}` },
        b: { type: "yesno", yes: false, reason: "not-enough-small-notes", target: `lead-${Q}` },
        c: { type: "extremum", mode: "max", value: Nmax, example: exC },
      },
      mustMention: [S * step, n1, step, n5, 5 * step, Na, Q * step, Nb],
      extra: [],
      maxNumber: 999999,                                    // сумма премий — шестизначная
      phrases: ["без сдачи и размена", "кратное"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 17 (продолжение). Звёзды за уровни и заряд аккумулятора (#41)
// ═══════════════════════════════════════════════════════════════════════════

// За уровень дают 3, 2 или 1 звезду, заряд падает на c3, c2, c1 пунктов соответственно
// (все три числа кратны d). Если уровней с тремя звёздами x, с двумя y, с одной z, то
//   c3·x + c2·y + c1·z = C   и   3x + 2y + z = S.
// Первое равенство показывает, что C обязано делиться на d (пункт «нет»).
// При эталонных c = (9, 12, 15) вычитание даёт y + 2z = (C/3 − S)/2, а число уровней
//   n = x + y + z = (S + C/3)/6
// оказывается ОДНИМ И ТЕМ ЖЕ для всех решений. Очки же линейны по z, поэтому максимум
// достигается на крайнем допустимом значении z.
export function t19GameStars() {
  const c3 = 9, c2 = 12, c1 = 15, d = 3
  const P = [7000, 6000, 3000]                             // очки за 3, 2 и 1 звезду
  const Ca = pick([50, 55, 65, 70, 80])                    // не кратно d — пункт а)
  if (Ca % d === 0) return null
  // б)/в): подбираем (C, S), при которых решений несколько
  const sols = (C, S) => {
    const res = []
    for (let x = 0; c3 * x <= C; x++) {
      for (let y = 0; c3 * x + c2 * y <= C; y++) {
        const restC = C - c3 * x - c2 * y
        if (restC % c1) continue
        const z = restC / c1
        if (3 * x + 2 * y + z === S) res.push({ x, y, z })
      }
    }
    return res
  }
  const CANDS = []
  for (const C of [75, 84, 90, 96, 105, 111]) {
    for (let S = 5; S <= 30; S++) {
      const r = sols(C, S)
      if (r.length >= 2 && uniq(r.map((t) => t.x + t.y + t.z)).length === 1) CANDS.push({ C, S, r })
    }
  }
  if (!CANDS.length) return null
  const { C, S, r } = pick(CANDS)
  const levels = r[0].x + r[0].y + r[0].z
  const score = (t) => P[0] * t.x + P[1] * t.y + P[2] * t.z
  const bestSol = r.reduce((a, b) => (score(b) > score(a) ? b : a))
  const bestScore = score(bestSol)

  const params = { c3, c2, c1, d, Ca, C, S, P }
  const check = (cfg, part) => {
    if (!cfg || !Number.isInteger(cfg.x) || !Number.isInteger(cfg.y) || !Number.isInteger(cfg.z)) return "нет набора уровней"
    if (cfg.x < 0 || cfg.y < 0 || cfg.z < 0) return "количества уровней неотрицательны"
    if (cfg.x + cfg.y + cfg.z < 1) return "должен быть пройден хотя бы один уровень"
    const spent = c3 * cfg.x + c2 * cfg.y + c1 * cfg.z
    const stars = 3 * cfg.x + 2 * cfg.y + cfg.z
    if (part === "a") return spent === Ca ? null : `заряд уменьшился на ${spent}, а нужно на ${Ca}`
    if (spent !== C) return `заряд уменьшился на ${spent}, а нужно на ${C}`
    if (stars !== S) return `звёзд получено ${stars}, а нужно ${S}`
    if (part === "b" && cfg.x + cfg.y + cfg.z !== levels) return `уровней ${cfg.x + cfg.y + cfg.z}, а заявлено ${levels}`
    if (part === "c" && score(cfg) !== bestScore) return `очков ${score(cfg)}, а заявлено ${bestScore}`
    return null
  }
  // Независимый перебор всех троек (x, y, z): пространство ограничено расходом заряда.
  const solve = (Pm) => {
    const all = sols(Pm.C, Pm.S)
    const lv = uniq(all.map((t) => t.x + t.y + t.z))
    let aYes = false
    for (let x = 0; c3 * x <= Pm.Ca; x++) {
      for (let y = 0; c3 * x + c2 * y <= Pm.Ca; y++) {
        const rest = Pm.Ca - c3 * x - c2 * y
        if (rest % c1 === 0 && x + y + rest / c1 >= 1) aYes = true
      }
    }
    return {
      a: aYes,
      b: lv.length === 1 ? lv[0] : -1,
      c: Math.max(...all.map((t) => Pm.P[0] * t.x + Pm.P[1] * t.y + Pm.P[2] * t.z)),
      c_next: false,
    }
  }

  const descr = (t) => [
    t.x ? `${t.x} ${plural(t.x, "уровень", "уровня", "уровней")} на три звезды` : null,
    t.y ? `${t.y} ${plural(t.y, "уровень", "уровня", "уровней")} на две звезды` : null,
    t.z ? `${t.z} ${plural(t.z, "уровень", "уровня", "уровней")} на одну звезду` : null,
  ].filter(Boolean).join(", ")
  return item({
    preamble: `За прохождение каждого уровня игры на планшете можно получить от одной до трёх звёзд. При этом заряд аккумулятора планшета уменьшается на ${c3} пунктов при получении трёх звёзд, на ${c2} пунктов при получении двух звёзд и на ${c1} пунктов при получении одной звезды. Витя прошёл несколько уровней игры подряд.`,
    qa: `Мог ли заряд аккумулятора уменьшиться ровно на ${Ca} пунктов?`,
    qb: `Сколько уровней игры было пройдено, если заряд аккумулятора уменьшился на ${C} пунктов и суммарно было получено ${S} ${plural(S, "звезда", "звезды", "звёзд")}?`,
    qc: `За пройденный уровень начисляется ${P[0]} очков при получении трёх звёзд, ${P[1]} — при получении двух звёзд и ${P[2]} — при получении одной звезды. Какое наибольшее количество очков мог получить Витя, если заряд аккумулятора уменьшился на ${C} пунктов и суммарно было получено ${S} ${plural(S, "звезда", "звезды", "звёзд")}?`,
    ansA: `нет: все три расхода заряда (${c3}, ${c2} и ${c1}) делятся на ${d}, поэтому и общий расход делится на ${d}, а ${Ca} на ${d} не делится`,
    ansB: `${levels}: из ${c3}x + ${c2}y + ${c1}z = ${C} и 3x + 2y + z = ${S} следует, что число уровней x + y + z равно ${levels} при каждом решении (их ${r.length}: ${r.map(descr).join("; ")})`,
    ansC: `${bestScore}; достигается, когда ${descr(bestSol)}`,
    solution: `Пусть уровней на три звезды x, на две звезды y и на одну звезду z. Тогда\n${c3}x + ${c2}y + ${c1}z = C и 3x + 2y + z = S.\nа) Все коэффициенты ${c3}, ${c2}, ${c1} кратны ${d}, поэтому расход заряда кратен ${d}; число ${Ca} не кратно ${d}, значит так уменьшиться заряд не мог.\nб) При C = ${C} и S = ${S} система имеет ${r.length} ${plural(r.length, "решение", "решения", "решений")}: ${r.map(descr).join("; ")}. Во всех случаях уровней ровно ${levels}.\nв) Очки равны ${P[0]}x + ${P[1]}y + ${P[2]}z; перебирая те же решения, получаем наибольшее значение ${bestScore} (${descr(bestSol)}).\nОтвет: ${levels}; ${bestScore}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: false, reason: "divisibility", target: `charge-${Ca}` },
        b: { type: "count", value: levels },
        c: { type: "extremum", mode: "max", value: bestScore, example: bestSol },
      },
      mustMention: [c3, c2, c1, Ca, C, S, ...P],
      extra: [],
      phrases: ["от одной до трёх звёзд", "уровней игры подряд"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 17 (продолжение). Фотографии: две прогрессии с общей разностью (#58)
// ═══════════════════════════════════════════════════════════════════════════

// Обе девочки снимают k дней подряд, каждый день на одну фотографию больше, чем
// накануне. Тогда суммы равны km + k(k−1)/2 и kn + k(k−1)/2, а их разность
//   k(n − m) = D,
// то есть ЧИСЛО ДНЕЙ ДЕЛИТ D. Отсюда «да»/«нет» в пунктах а) и б).
// Наибольшая сумма второй девочки при ограничении «в последний день первая сделала
// меньше T» (то есть m ≤ T − k) равна k(T − k) + D + k(k−1)/2 — максимум берётся
// по делителям D, не превосходящим T − 1.
export function t19PhotosDiff() {
  const D = pick([1001, 715, 1105, 935])                   // 7·11·13, 5·11·13, 5·13·17, 5·11·17
  const T = pick([40, 50])
  const divs = []
  for (let k = 2; k <= D; k++) if (D % k === 0) divs.push(k)
  const okDays = divs.filter((k) => k <= T - 1)
  if (okDays.length < 2) return null
  const Ka = pick(okDays.filter((k) => k <= 15))
  if (!Ka) return null
  const Kb = pick([Ka + 1, Ka - 1, Ka + 2].filter((k) => k > 1 && D % k !== 0))
  if (!Kb) return null
  let best = null
  for (const k of okDays) {
    const m = T - k
    if (m < 1) continue
    const total = k * m + D + k * (k - 1) / 2
    if (!best || total > best.total) best = { k, m, total, n: m + D / k }
  }
  if (!best) return null

  const params = { D, T, Ka, Kb }
  const check = (cfg, part) => {
    if (!cfg || !Number.isInteger(cfg.k) || !Number.isInteger(cfg.m) || !Number.isInteger(cfg.n)) return "нет конфигурации"
    if (cfg.k < 2) return "фотографировали больше одного дня"
    if (cfg.m < 1 || cfg.n < 1) return "в первый день каждая сделала хотя бы одну фотографию"
    const sumM = cfg.k * cfg.m + cfg.k * (cfg.k - 1) / 2
    const sumN = cfg.k * cfg.n + cfg.k * (cfg.k - 1) / 2
    if (sumN - sumM !== D) return `разница сумм ${sumN - sumM}, а нужно ${D}`
    if (part === "a" && cfg.k !== Ka) return `дней ${cfg.k}, а нужно ${Ka}`
    if (part === "c") {
      if (cfg.m + cfg.k - 1 >= T) return `в последний день первая сделала ${cfg.m + cfg.k - 1} фотографий — не меньше ${T}`
      if (sumN !== best.total) return `вторая сделала ${sumN} фотографий, а заявлено ${best.total}`
    }
    return null
  }
  // Независимый перебор: по числу дней k (делители D) и первому дню m ≤ T − k.
  const solve = (P) => {
    const divisor = (k) => P.D % k === 0
    let top = 0
    for (let k = 2; k <= P.D; k++) {
      if (!divisor(k)) continue
      for (let m = 1; m + k - 1 < P.T; m++) {
        const sumN = k * (m + P.D / k) + k * (k - 1) / 2
        if (sumN > top) top = sumN
      }
    }
    return { a: divisor(P.Ka), b: divisor(P.Kb), c: top, c_next: false }
  }

  const exA = { k: Ka, m: 1, n: 1 + D / Ka }
  const exC = { k: best.k, m: best.m, n: best.n }
  const factor = (x) => { const f = []; let y = x; for (let q = 2; q * q <= y; q++) while (y % q === 0) { f.push(q); y /= q } if (y > 1) f.push(y); return f.join(" · ") }
  return item({
    preamble: `Маша и Наташа делали фотографии в течение некоторого количества подряд идущих дней. В первый день Маша сделала m фотографий, а Наташа — n фотографий. В каждый следующий день каждая из девочек делала на одну фотографию больше, чем в предыдущий день. Известно, что Наташа за всё время сделала суммарно на ${D} ${plural(D, "фотографию", "фотографии", "фотографий")} больше, чем Маша, и что фотографировали они больше одного дня.`,
    qa: `Могли ли они фотографировать в течение ${Ka} дней?`,
    qb: `Могли ли они фотографировать в течение ${Kb} дней?`,
    qc: `Какое наибольшее суммарное число фотографий могла сделать Наташа за все дни фотографирования, если известно, что в последний день Маша сделала меньше ${T} фотографий?`,
    ansA: `да: за ${Ka} дней разница сумм равна ${Ka}(n − m) = ${D}, поэтому n − m = ${D / Ka}; например Маша начинала с 1 фотографии, а Наташа — с ${1 + D / Ka}`,
    ansB: `нет: за k дней разница сумм равна k(n − m), поэтому k делит ${D} = ${factor(D)}; число ${Kb} делителем не является`,
    ansC: `${best.total}; достигается при ${best.k} днях, когда Маша начинала с ${best.m} ${plural(best.m, "фотографии", "фотографий", "фотографий")} (в последний день — ${best.m + best.k - 1}), а Наташа — с ${best.n}`,
    solution: `Пусть фотографировали k дней. Тогда Маша сделала km + k(k − 1)/2 фотографий, Наташа — kn + k(k − 1)/2, и разность равна k(n − m) = ${D}. Значит k — делитель числа ${D} = ${factor(D)}.\nа) ${Ka} делит ${D}, поэтому такое возможно: n − m = ${D / Ka}.\nб) ${Kb} не делит ${D}, поэтому столько дней быть не могло.\nв) Суммарное число фотографий Наташи равно kn + k(k − 1)/2 = km + ${D} + k(k − 1)/2. Из условия «в последний день Маша сделала меньше ${T}» следует m + k − 1 ≤ ${T - 1}, то есть m ≤ ${T} − k. Значит сумма не больше k(${T} − k) + ${D} + k(k − 1)/2; перебирая делители ${D}, не превосходящие ${T - 1}, получаем максимум ${best.total} при k = ${best.k} и m = ${best.m}.\nОтвет: ${best.total}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `days-${Ka}` },
        b: { type: "yesno", yes: false, reason: "divisor-of-difference", target: `days-${Kb}` },
        c: { type: "extremum", mode: "max", value: best.total, example: exC },
      },
      mustMention: [D, T, Ka, Kb],
      extra: [],
      phrases: ["на одну фотографию больше", "больше одного дня"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 17 (продолжение). Письма: юношей и девушек поровну (#64)
// ═══════════════════════════════════════════════════════════════════════════

// Юношей и девушек по N. Каждый юноша отправил либо p, либо q писем, причём тех и
// других юношей не меньше двух: a + b = N, a ≥ 2, b ≥ 2. Всего писем pa + qb.
// • «Все девушки получили поровну» ⟺ (pa + qb)/N целое. Так как pa + qb = pN + (q−p)b,
//   это равносильно N | (q − p)b, откуда при взаимно простых N и (q−p) получилось бы
//   N | b — невозможно (0 < b < N). Значит N обязано делить (q−p)b нетривиально:
//   для q − p = 17 (простое) это даёт 17 | N, то есть N ≥ 17.
// • «Все девушки получили разное количество» ⟹ сумма писем не меньше 0+1+…+(N−1),
//   а сама сумма не больше p·2 + q(N−2), откуда квадратичное неравенство на N.
export function t19LettersGirls() {
  const p = 4, q = 21, dq = q - p                          // dq = 17 — простое
  const total = (a, b) => p * a + q * b
  // а) «каждая девушка получила ровно r писем»
  const rCands = []
  for (let r = p + 1; r < q; r++) {
    for (let N = 4; N <= 200; N++) {
      for (let b = 2; b <= N - 2; b++) {
        if (total(N - b, b) === r * N) { rCands.push({ r, N, b }); break }
      }
      if (rCands.length && rCands[rCands.length - 1].r === r) break
    }
  }
  if (!rCands.length) return null
  const exARow = pick(rCands)
  // б) наименьшее N, при котором письма делятся поровну
  let Nmin = 0
  for (let N = 4; N <= 500 && !Nmin; N++) {
    for (let b = 2; b <= N - 2; b++) if (total(N - b, b) % N === 0) { Nmin = N; break }
  }
  // в) наибольшее N при попарно различных количествах писем
  let Nmax = 0
  for (let N = 4; N <= 500; N++) {
    let ok = false
    for (let b = 2; b <= N - 2 && !ok; b++) if (total(N - b, b) >= N * (N - 1) / 2) ok = true
    if (ok) Nmax = N
  }
  if (!Nmin || !Nmax) return null

  const params = { p, q, dq, r: exARow.r, Nmin, Nmax }
  const check = (cfg, part) => {
    if (!cfg || !Number.isInteger(cfg.N) || !Number.isInteger(cfg.b)) return "нет конфигурации"
    const { N, b } = cfg, a = N - b
    if (N < 4) return "в группе слишком мало человек"
    if (a < 2 || b < 2) return `и тех, и других юношей должно быть не менее двух (сейчас ${a} и ${b})`
    const T = total(a, b)
    if (part === "a") return T === exARow.r * N ? null : `всего писем ${T}, а нужно ${exARow.r}·${N} = ${exARow.r * N}`
    if (part === "b") {
      if (T % N) return `письма не делятся поровну: всего ${T} на ${N} девушек`
      if (N !== Nmin) return `девушек ${N}, а заявлено ${Nmin}`
    }
    if (part === "c") {
      if (T < N * (N - 1) / 2) return `писем ${T}, а на ${N} различных количеств нужно не меньше ${N * (N - 1) / 2}`
      if (N !== Nmax) return `девушек ${N}, а заявлено ${Nmax}`
    }
    return null
  }
  // Независимый перебор по числу девушек N и числу юношей, отправивших q писем.
  const solve = (P) => {
    let aOk = false, minN = 0, maxN = 0
    for (let N = 4; N <= 500; N++) {
      for (let b = 2; b <= N - 2; b++) {
        const T = P.p * (N - b) + P.q * b
        if (T === P.r * N) aOk = true
        if (T % N === 0 && !minN) minN = N
        if (T >= N * (N - 1) / 2) maxN = Math.max(maxN, N)
      }
    }
    return { a: aOk, b: minN, c: maxN, b_next: false, c_next: false }
  }

  const exA = { N: exARow.N, b: exARow.b }
  const exB = (() => {
    for (let b = 2; b <= Nmin - 2; b++) if (total(Nmin - b, b) % Nmin === 0) return { N: Nmin, b }
    return null
  })()
  const exC = (() => {
    for (let b = 2; b <= Nmax - 2; b++) if (total(Nmax - b, b) >= Nmax * (Nmax - 1) / 2) return { N: Nmax, b }
    return null
  })()
  if (!exB || !exC) return null

  return item({
    preamble: `В группе поровну юношей и девушек. Юноши отправляли электронные письма девушкам. Каждый юноша отправил или ${p} письма, или ${q} ${plural(q, "письмо", "письма", "писем")}, причём и тех, и других юношей было не менее двух. Возможно, что какой-то юноша отправил какой-то девушке несколько писем.`,
    qa: `Могло ли оказаться так, что каждая девушка получила ровно ${exARow.r} ${plural(exARow.r, "письмо", "письма", "писем")}?`,
    qb: `Какое наименьшее количество девушек могло быть в группе, если известно, что все они получили писем поровну?`,
    qc: `Пусть все девушки получили различное количество писем (возможно, какая-то девушка не получила писем вообще). Каково наибольшее возможное количество девушек в такой группе?`,
    ansA: `да, например в группе ${exARow.N} ${plural(exARow.N, "юноша", "юноши", "юношей")} и столько же девушек: ${exARow.N - exARow.b} ${plural(exARow.N - exARow.b, "юноша отправил", "юноши отправили", "юношей отправили")} по ${p} письма, а ${exARow.b} — по ${q}; всего ${total(exARow.N - exARow.b, exARow.b)} писем, то есть по ${exARow.r} на каждую девушку`,
    ansB: `${Nmin}: всего писем ${p}a + ${q}b = ${p}N + ${dq}b, поэтому равное деление означает, что N делит ${dq}b. Число ${dq} простое, а 0 < b < N, поэтому N делится на ${dq}, откуда N ≥ ${Nmin}; пример — ${exB.N - exB.b} ${plural(exB.N - exB.b, "юноша", "юноши", "юношей")} по ${p} письма и ${exB.b} по ${q}`,
    ansC: `${Nmax}; например ${exC.N - exC.b} ${plural(exC.N - exC.b, "юноша", "юноши", "юношей")} по ${p} письма и ${exC.b} по ${q} — всего ${total(exC.N - exC.b, exC.b)} писем, чего хватает на ${Nmax} ${plural(Nmax, "различное количество", "различных количества", "различных количеств")} (нужно не меньше ${Nmax * (Nmax - 1) / 2} писем)`,
    solution: `Пусть в группе N юношей и N девушек, из них a отправили по ${p} письма и b — по ${q}, a + b = N, a ≥ 2, b ≥ 2. Всего писем ${p}a + ${q}b = ${p}N + ${dq}b.\nа) Условие «каждая получила ровно ${exARow.r}» означает ${p}N + ${dq}b = ${exARow.r}N: подходит N = ${exARow.N}, b = ${exARow.b}.\nб) Равное деление означает, что N делит ${dq}b. Так как ${dq} — простое число и 0 < b < N, число N обязано делиться на ${dq}. Наименьшее подходящее значение N = ${Nmin} (пример: b = ${exB.b}).\nв) Если все количества различны, то сумма писем не меньше 0 + 1 + … + (N − 1) = N(N − 1)/2. С другой стороны, писем не больше ${p}·2 + ${q}(N − 2). Из неравенства ${p}·2 + ${q}(N − 2) ≥ N(N − 1)/2 получаем N ≤ ${Nmax}, и это значение достигается.\nОтвет: ${Nmin}; ${Nmax}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `each-${exARow.r}` },
        b: { type: "extremum", mode: "min", value: Nmin, example: exB },
        c: { type: "extremum", mode: "max", value: Nmax, example: exC },
      },
      mustMention: [p, q, exARow.r],
      extra: [],
      phrases: ["поровну юношей и девушек", "не менее двух"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 17 (продолжение). Кролики и порции корма (#67)
// ═══════════════════════════════════════════════════════════════════════════

// K учеников насыпают корм: i-й даёт порции по i сотен граммов, каждый кормит хотя бы
// одного кролика, но не всех. Значит каждый кролик получает сумму некоторого
// ПОДМНОЖЕСТВА чисел 1…K, то есть одно из K(K+1)/2 + 1 значений (от 0 до 1+…+K).
// • Все получили разное ⟹ кроликов не больше числа этих значений (пункт «нет»).
// • Если каждый ученик кормит ровно F кроликов, то суммарно роздано F·(1+…+K) сотен
//   граммов, а различные ненулевые значения дают в сумме не меньше 1+2+…+k, откуда
//   ограничение на k; плюс один кролик может остаться без корма.
export function t19RabbitsFood() {
  const K = 4, F = pick([3, 4, 5])
  const SUB = []
  for (let mask = 0; mask < (1 << K); mask++) {
    let s = 0
    for (let i = 0; i < K; i++) if (mask & (1 << i)) s += i + 1
    SUB.push({ mask, s })
  }
  const maxSum = K * (K + 1) / 2
  const values = maxSum + 1                                // сколько различных значений бывает
  const Nab = pick([values + 2, values + 4, values + 7])   // кроликов больше, чем значений
  // а) все получили поровну: два непересекающихся набора с равной суммой, покрывающие всех
  let exA = null
  for (const c of [5, 6, 7]) {
    const pairs = SUB.filter((x) => x.s === c && x.mask)
    for (let i = 0; i < pairs.length && !exA; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        if ((pairs[i].mask & pairs[j].mask) === 0 && (pairs[i].mask | pairs[j].mask) === (1 << K) - 1) {
          exA = { groups: [{ mask: pairs[i].mask, cnt: 1 }, { mask: pairs[j].mask, cnt: Nab - 1 }], per: c }
          break
        }
      }
    }
    if (exA) break
  }
  if (!exA) return null
  // в) наибольшее число кроликов: перебор наборов подмножеств, где каждое число 1…K
  // встречается ровно F раз, а суммы попарно различны
  let best = null
  const chosen = []
  const cnt = Array(K).fill(0)
  const usedSums = new Set()
  const dfs = (idx) => {
    if (cnt.every((c) => c === F)) {
      const total = chosen.length + 1                       // плюс кролик без корма
      if (!best || total > best.total) best = { total, sets: [...chosen] }
    }
    if (idx >= SUB.length) return
    for (let i = idx; i < SUB.length; i++) {
      const { mask, s } = SUB[i]
      if (!mask || usedSums.has(s)) continue
      let ok = true
      for (let b = 0; b < K; b++) if ((mask & (1 << b)) && cnt[b] + 1 > F) ok = false
      if (!ok) continue
      for (let b = 0; b < K; b++) if (mask & (1 << b)) cnt[b]++
      usedSums.add(s); chosen.push(mask)
      dfs(i + 1)
      chosen.pop(); usedSums.delete(s)
      for (let b = 0; b < K; b++) if (mask & (1 << b)) cnt[b]--
    }
  }
  dfs(0)
  if (!best) return null

  const params = { K, F, Nab, values, best: best.total }
  const setSum = (mask) => SUB.find((x) => x.mask === mask).s
  const check = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.rabbits)) return "нет раздачи корма"
    const N = cfg.rabbits.length
    if (!N) return "кроликов нет"
    for (const mask of cfg.rabbits) if (!Number.isInteger(mask) || mask < 0 || mask >= (1 << K)) return "неверный набор учеников"
    const per = Array(K).fill(0)
    for (const mask of cfg.rabbits) for (let b = 0; b < K; b++) if (mask & (1 << b)) per[b]++
    for (let b = 0; b < K; b++) {
      if (per[b] < 1) return `ученик №${b + 1} никого не покормил`
      if (per[b] >= N) return `ученик №${b + 1} покормил всех кроликов, а должен не всех`
    }
    const sums = cfg.rabbits.map(setSum)
    if (part === "a") {
      if (N !== Nab) return `кроликов ${N}, а нужно ${Nab}`
      if (uniq(sums).length !== 1) return "не все кролики получили поровну"
      return null
    }
    if (part === "c") {
      if (uniq(sums).length !== sums.length) return "кролики должны получить разное количество корма"
      for (let b = 0; b < K; b++) if (per[b] !== F) return `ученик №${b + 1} покормил ${per[b]} кроликов вместо ${F}`
      if (N !== best.total) return `кроликов ${N}, а заявлено ${best.total}`
    }
    return null
  }
  // Независимый перебор: все наборы подмножеств с попарно различными суммами.
  const solve = (P) => {
    let top = 0
    const c2 = Array(P.K).fill(0)
    const used = new Set()
    let picked = 0
    const walk = (idx) => {
      if (c2.every((c) => c === P.F) && picked + 1 > top) top = picked + 1
      for (let i = idx; i < SUB.length; i++) {
        const { mask, s } = SUB[i]
        if (!mask || used.has(s)) continue
        let ok = true
        for (let b = 0; b < P.K; b++) if ((mask & (1 << b)) && c2[b] + 1 > P.F) ok = false
        if (!ok) continue
        for (let b = 0; b < P.K; b++) if (mask & (1 << b)) c2[b]++
        used.add(s); picked++
        walk(i + 1)
        picked--; used.delete(s)
        for (let b = 0; b < P.K; b++) if (mask & (1 << b)) c2[b]--
      }
    }
    walk(0)
    return { a: true, b: P.Nab <= P.values, c: top, c_next: false }
  }

  const exARabbits = []
  for (const g of exA.groups) for (let i = 0; i < g.cnt; i++) exARabbits.push(g.mask)
  const exC = { rabbits: [...best.sets, 0] }
  const nameOf = (mask) => {
    const who = []
    for (let b = 0; b < K; b++) if (mask & (1 << b)) who.push(b + 1)
    return who.length ? `от ${who.map((x) => `${x}-го`).join(", ")}` : "ни от кого"
  }
  const gram = (s) => `${s * 100} г`
  return item({
    preamble: `В школьном живом уголке ${K} ученика кормят кроликов. Каждый ученик насыпает нескольким кроликам (хотя бы одному, но не всем) порцию корма. При этом первый ученик даёт порции по 100 г, второй — по 200 г, третий — по 300 г, четвёртый — по 400 г, а какие-то кролики могут остаться без корма.`,
    qa: `Может ли оказаться, что кроликов было ${Nab} и все они получили одинаковое количество корма?`,
    qb: `Может ли оказаться, что кроликов было ${Nab} и все кролики получили разное количество корма?`,
    qc: `Какое наибольшее количество кроликов могло быть в живом уголке, если известно, что каждый ученик засыпал корм ровно ${F} кроликам и все кролики получили разное количество корма?`,
    ansA: `да: пусть ${exA.groups[0].cnt} ${plural(exA.groups[0].cnt, "кролик получает корм", "кролика получают корм", "кроликов получают корм")} ${nameOf(exA.groups[0].mask)} ученика, а остальные ${exA.groups[1].cnt} — ${nameOf(exA.groups[1].mask)}; тогда каждый кролик получит по ${gram(exA.per)}`,
    ansB: `нет: каждый кролик получает сумму порций тех учеников, которые его покормили, то есть одно из значений от 0 до ${gram(maxSum)} с шагом 100 г — всего ${values} ${plural(values, "значение", "значения", "значений")}. Кроликов же ${Nab}, то есть больше, чем ${values}, поэтому у каких-то двух количество корма совпадёт`,
    ansC: `${best.total}; например ${best.sets.length} ${plural(best.sets.length, "кролик получает", "кролика получают", "кроликов получают")} корм от наборов учеников ${best.sets.map(nameOf).join("; ")}, и ещё один остаётся без корма`,
    solution: `Каждый кролик получает сумму порций тех учеников, которые его покормили, то есть 100 г, умноженные на сумму некоторого подмножества чисел 1, 2, …, ${K}. Всего таких значений ${values} (от 0 до ${gram(maxSum)}).\nа) Достаточно разбить кроликов на две группы: одних кормят ученики ${nameOf(exA.groups[0].mask)}, других — ${nameOf(exA.groups[1].mask)}; обе суммы равны ${gram(exA.per)}, а каждый ученик покормил кого-то, но не всех.\nб) Кроликов ${Nab}, а различных значений всего ${values} — по принципу Дирихле у каких-то двух кроликов количество корма совпадёт.\nв) Если каждый ученик кормит ровно ${F} кроликов, роздано ${F}·${maxSum} = ${F * maxSum} сотен граммов. Кролики с кормом получили различные суммы, поэтому их не больше ${best.sets.length}; ещё один кролик может остаться без корма. Пример: наборы ${best.sets.map(nameOf).join("; ")}.\nОтвет: ${best.total}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: { rabbits: exARabbits }, target: `same-${Nab}` },
        b: { type: "yesno", yes: false, reason: "pigeonhole", target: `diff-${Nab}` },
        c: { type: "extremum", mode: "max", value: best.total, example: exC },
      },
      mustMention: [K, Nab, F, 100, 200, 300, 400],
      extra: [],
      phrases: ["хотя бы одному, но не всем", "могут остаться без корма"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 17 (окончание). Набор из N чисел со средним любых M меньше B (#96)
// ═══════════════════════════════════════════════════════════════════════════

// N натуральных чисел, среди них обязательно 3, 4 и 5; среднее ЛЮБЫХ M чисел меньше B,
// то есть сумма M наибольших не превосходит MB − 1. Если единиц k, а сумма остальных
// (все они ≥ 2) равна S, то сумма M наибольших равна S + (k − (N − M)), поэтому
//   S ≤ MB − 1 − k + (N − M),   при этом S ≥ 12 + 2(N − k − 3).
// Из этих двух неравенств получается нижняя граница на число единиц — это и есть
// ответы пунктов а) и б). Пункт в) («докажите, что найдётся подмножество с суммой T»)
// проверяется полным перебором ВСЕХ допустимых наборов: их немного (около тысячи).
const SET96_CACHE = new Map()
function sets96(N, M, B, must) {
  const key = `${N}|${M}|${B}|${must.join(",")}`
  if (SET96_CACHE.has(key)) return SET96_CACHE.get(key)
  const capSum = M * B - 1
  const mustSum = sum(must)
  const out = []
  for (let k = 1; k <= N - must.length; k++) {
    const extra = N - k - must.length
    if (extra < 0) break
    const maxNeSum = capSum - Math.max(0, k - (N - M))
    const build = (idx, minVal, s, acc) => {
      if (idx === extra) {
        if (mustSum + s <= maxNeSum) out.push({ k, rest: [...acc] })
        return
      }
      for (let v = minVal; mustSum + s + v * (extra - idx) <= maxNeSum; v++) {
        acc.push(v); build(idx + 1, v, s + v, acc); acc.pop()
      }
    }
    build(0, 2, 0, [])
  }
  SET96_CACHE.set(key, out)
  return out
}
const subsetSums96 = (nums) => {
  const dp = new Uint8Array(sum(nums) + 1)
  dp[0] = 1
  for (const v of nums) for (let t = dp.length - 1 - v; t >= 0; t--) if (dp[t]) dp[t + v] = 1
  return dp
}

export function t19SetAvgBelow() {
  const N = 33, M = 27, B = 2, must = [3, 4, 5]
  const all = sets96(N, M, B, must)
  if (!all.length) return null
  const kMin = Math.min(...all.map((s) => s.k))
  // суммы, представимые подмножеством в КАЖДОМ допустимом наборе
  let common = null
  for (const s of all) {
    const nums = [...Array(s.k).fill(1), ...must, ...s.rest]
    const dp = subsetSums96(nums)
    if (!common) common = Array.from(dp)
    else for (let t = 0; t < common.length; t++) if (t >= dp.length || !dp[t]) common[t] = 0
  }
  const goodSums = common.map((v, t) => (v ? t : -1)).filter((t) => t >= 20)
  if (!goodSums.length) return null
  const T = pick(goodSums.filter((t) => t <= 40))
  if (!T) return null
  const exA = all.find((s) => s.k === kMin)
  if (!exA) return null

  const params = { N, M, B, must, kMin, T }
  const nums96 = (s) => [...Array(s.k).fill(1), ...must, ...s.rest]
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length !== N) return `в наборе должно быть ${N} чисел`
    for (const v of cfg) if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное число`
    for (const v of must) if (!cfg.includes(v)) return `в наборе нет числа ${v}`
    const sorted = cfg.slice().sort((a, b) => b - a)
    const topSum = sum(sorted.slice(0, M))
    if (topSum >= M * B) return `среднее ${M} наибольших чисел равно ${topSum / M} — не меньше ${B}`
    const ones = cfg.filter((v) => v === 1).length
    if (part === "a" && ones !== kMin) return `единиц ${ones}, а нужно ровно ${kMin}`
    if (part === "b" && ones >= kMin) return `единиц ${ones}, а нужно меньше ${kMin}`
    return null
  }
  // Независимый перебор: строятся ВСЕ допустимые наборы (число единиц + мультимножество
  // остальных чисел, каждое ≥ 2), для каждого проверяется представимость суммы T.
  const solve = (P) => {
    const list = sets96(P.N, P.M, P.B, P.must)
    const minOnes = Math.min(...list.map((s) => s.k))
    let bad = 0
    for (const s of list) {
      const dp = subsetSums96(nums96(s))
      if (P.T >= dp.length || !dp[P.T]) bad++
    }
    return { a: list.some((s) => s.k === P.kMin), b: minOnes < P.kMin, c: bad }
  }

  const exArr = nums96(exA)
  const groups = (() => {
    const g = new Map()
    for (const v of exArr) g.set(v, (g.get(v) || 0) + 1)
    return [...g.entries()].sort((a, b) => a[0] - b[0])
      .map(([v, c]) => (c > 1 ? `${c} ${plural(c, "число", "числа", "чисел")} по ${v}` : `число ${v}`)).join(", ")
  })()
  return item({
    preamble: `Набор состоит из ${N} натуральных чисел, среди которых есть числа ${must.join(", ")}. Среднее арифметическое любых ${M} чисел этого набора меньше ${B}.`,
    qa: `Может ли такой набор содержать ровно ${kMin} ${plural(kMin, "единицу", "единицы", "единиц")}?`,
    qb: `Может ли такой набор содержать менее ${kMin} ${plural(kMin, "единицы", "единиц", "единиц")}?`,
    qc: `Докажите, что в любом таком наборе есть несколько чисел, сумма которых равна ${T}.`,
    ansA: `да, например ${groups}: сумма ${M} наибольших чисел равна ${sum(exArr.slice().sort((a, b) => b - a).slice(0, M))} < ${M * B}`,
    ansB: `нет: пусть единиц k. Остальные ${N} − k чисел не меньше 2, причём среди них есть ${must.join(", ")}, поэтому их сумма не меньше ${sum(must)} + 2(${N} − k − ${must.length}). Сумма ${M} наибольших чисел — это сумма всех неединиц плюс ещё (k − ${N - M}) единиц, и она не превосходит ${M * B - 1}. Из ${sum(must)} + 2(${N} − k − ${must.length}) + (k − ${N - M}) ≤ ${M * B - 1} получаем k ≥ ${kMin}`,
    ansC: `в наборе не меньше ${kMin} единиц, а любое его число не превосходит k − 5, где k — количество единиц (иначе сумма ${M} наибольших превысила бы ${M * B - 1}). Расположим числа по возрастанию: сначала k единиц, дающих все суммы от 1 до k, а каждое следующее число не больше суммы всех предыдущих плюс 1 — значит, добавляя числа по одному, мы получаем все суммы подряд, от 1 до суммы всего набора. Так как ${T} не превосходит суммы набора (она не меньше ${sum(must)} + ${N - must.length} = ${sum(must) + N - must.length}), подмножество с суммой ${T} найдётся`,
    solution: `Условие «среднее любых ${M} чисел меньше ${B}» равносильно тому, что сумма ${M} наибольших чисел не превосходит ${M * B - 1}.\nПусть в наборе k единиц. Остальные ${N} − k чисел не меньше 2, причём среди них есть ${must.join(", ")}, поэтому их сумма S ≥ ${sum(must)} + 2(${N} − k − ${must.length}). С другой стороны, сумма ${M} наибольших равна S + (k − ${N - M}) ≤ ${M * B - 1}.\nСкладывая, получаем k ≥ ${kMin}.\nа) При k = ${kMin} набор существует: ${groups}.\nб) Меньше ${kMin} единиц быть не может — это доказано выше.\nв) Пусть в наборе k единиц. Любое число набора не превосходит k − 5: иначе сумма ${M} наибольших чисел (это число, ещё ${must.length} обязательных и остальные, каждое не меньше 2) уже превысила бы ${M * B - 1}. Расположим числа по возрастанию. Первые k единиц дают все суммы от 1 до k, а каждое следующее число не больше суммы предыдущих плюс 1, поэтому после добавления каждого числа множество получаемых сумм остаётся отрезком от 1 до текущей суммы. Значит представимы все суммы вплоть до суммы всего набора, в частности ${T}.\nОтвет: да; нет; доказано.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exArr, target: `ones-${kMin}` },
        b: { type: "yesno", yes: false, reason: "ones-lower-bound", target: `fewer-${kMin}` },
        c: { type: "count", value: 0 },
      },
      mustMention: [N, M, B, ...must, kMin, T],
      extra: [2],
      phrases: ["натуральных чисел", "Среднее арифметическое любых"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 6 (продолжение). Вычёркивание цифр до кратности (#1)
// ═══════════════════════════════════════════════════════════════════════════

// Из записи числа вычёркивают несколько цифр (порядок оставшихся сохраняется) и хотят
// получить число, кратное D. Пространство конечно — 2ⁿ подпоследовательностей, поэтому
// все три пункта решаются полным перебором. Содержательная часть — подбор чисел:
// для одного вычёркивание возможно, для другого нет ни одного варианта.
const subseqDiv = (digits, D) => {
  const out = []
  const n = digits.length
  for (let mask = 1; mask < (1 << n) - 1; mask++) {          // хотя бы одну цифру вычёркиваем
    let t = ""
    for (let i = 0; i < n; i++) if (mask & (1 << i)) t += digits[i]
    if (t[0] === "0") continue
    if (Number(t) % D === 0) out.push(t)
  }
  return out
}

export function t19CrossOutDigits() {
  const D = pick([72, 36, 45])
  const shuffle = (arr) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i);[a[i], a[j]] = [a[j], a[i]] }
    return a
  }
  const DIGITS = "123456789".split("")
  let numA = null, numB = null, numC = null, bestC = null
  for (let t = 0; t < 400 && (!numA || !numB || !numC); t++) {
    const s = shuffle(DIGITS).join("")
    const res = subseqDiv(s, D)
    if (!numA && res.length) numA = s
    if (!numB && !res.length) numB = s
    if (!numC) {
      const s8 = s.slice(0, 8)
      const r8 = subseqDiv(s8, D)
      if (r8.length && r8.length <= 3) {                     // немного вариантов — задача интереснее
        const minLen = Math.min(...r8.map((x) => x.length))
        numC = s8
        bestC = { cut: s8.length - minLen, example: r8.find((x) => x.length === minLen) }
      }
    }
  }
  if (!numA || !numB || !numC) return null
  const exampleA = subseqDiv(numA, D)[0]
  // разбор по признаку делимости: чем должно оканчиваться число и какова сумма цифр
  const SIGN = {
    72: { tail: "тремя последними цифрами, делящимися на 8", extra: "и сумма цифр кратна 9" },
    36: { tail: "двумя последними цифрами, делящимися на 4", extra: "и сумма цифр кратна 9" },
    45: { tail: "последней цифрой 5 или 0", extra: "и сумма цифр кратна 9" },
  }[D]
  // сколько подпоследовательностей вообще удовлетворяют «хвостовому» признаку
  const tailOk = (t) => (D === 45 ? /[05]$/.test(t) : Number(t.slice(-(D === 72 ? 3 : 2))) % (D === 72 ? 8 : 4) === 0)
  let tailCount = 0
  for (let mask = 1; mask < (1 << numB.length) - 1; mask++) {
    let t = ""
    for (let i = 0; i < numB.length; i++) if (mask & (1 << i)) t += numB[i]
    if (t[0] !== "0" && tailOk(t)) tailCount++
  }
  const signText = `число, кратное ${D}, должно оканчиваться ${SIGN.tail}, ${SIGN.extra}. Из записи ${numB} вычёркиванием получается ${tailCount} ${plural(tailCount, "число", "числа", "чисел")} с подходящим окончанием, и ни у одного из них сумма цифр не делится на 9`

  const params = { D, numA, numB, numC }
  const check = (cfg, part) => {
    if (typeof cfg !== "string" || !/^\d+$/.test(cfg)) return "ответ — число из оставшихся цифр"
    const src = part === "a" ? numA : part === "b" ? numB : numC
    // проверяем, что cfg — подпоследовательность src
    let i = 0
    for (const ch of src) if (i < cfg.length && cfg[i] === ch) i++
    if (i !== cfg.length) return `${cfg} не получается вычёркиванием цифр из ${src}`
    if (cfg.length >= src.length) return "нужно вычеркнуть хотя бы одну цифру"
    if (cfg[0] === "0") return "число не может начинаться с нуля"
    if (Number(cfg) % D !== 0) return `${cfg} не кратно ${D}`
    if (part === "c" && src.length - cfg.length !== bestC.cut) return `вычеркнуто ${src.length - cfg.length} цифр, а заявлено ${bestC.cut}`
    return null
  }
  // Независимый перебор: все подпоследовательности каждого из трёх чисел.
  const solve = (P) => ({
    a: subseqDiv(P.numA, P.D).length > 0,
    b: subseqDiv(P.numB, P.D).length > 0,
    c: (() => {
      const r = subseqDiv(P.numC, P.D)
      return r.length ? P.numC.length - Math.min(...r.map((x) => x.length)) : 0
    })(),
    c_next: false,
  })

  return item({
    preamble: `Из записи натурального числа вычёркивают несколько цифр (оставшиеся цифры сохраняют свой порядок) и получают новое натуральное число.`,
    qa: `Можно ли вычеркнуть несколько цифр из числа ${numA} так, чтобы получилось число, кратное ${D}?`,
    qb: `Можно ли вычеркнуть несколько цифр из числа ${numB} так, чтобы получилось число, кратное ${D}?`,
    qc: `Какое наибольшее количество цифр можно вычеркнуть из числа ${numC} так, чтобы получилось число, кратное ${D}?`,
    ansA: `да: например ${exampleA} = ${D}·${Number(exampleA) / D}`,
    ansB: `нет: ${signText}`,
    ansC: `${bestC.cut}; остаётся число ${bestC.example} = ${D}·${Number(bestC.example) / D}`,
    solution: `Вычёркивание цифр сохраняет порядок оставшихся, поэтому из числа с n цифрами получается одно из 2ⁿ − 2 чисел (кроме пустого и самого исходного).\nа) Из ${numA} получается ${exampleA}, а ${exampleA} = ${D}·${Number(exampleA) / D}.\nб) ${signText[0].toUpperCase() + signText.slice(1)}.\nв) Чем меньше цифр остаётся, тем больше вычеркнуто. Наименьшее по длине кратное ${D} число, получаемое из ${numC}, — это ${bestC.example} (${bestC.example.length} ${plural(bestC.example.length, "цифра", "цифры", "цифр")}), поэтому вычеркнуть можно ${bestC.cut} ${plural(bestC.cut, "цифру", "цифры", "цифр")}.\nОтвет: ${bestC.cut}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exampleA, target: `num-${numA}` },
        b: { type: "yesno", yes: false, reason: "no-subsequence", target: `num-${numB}` },
        c: { type: "extremum", mode: "max", value: bestC.cut, example: bestC.example },
      },
      mustMention: [Number(numA), Number(numB), Number(numC), D],
      extra: [],
      maxNumber: 999999999,
      phrases: ["вычёркивают несколько цифр", "кратное"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 6 (продолжение). Вставка сумм соседних цифр (#7)
// ═══════════════════════════════════════════════════════════════════════════

// Операция: между каждыми двумя соседними цифрами вписывают их сумму
// (1923 → 1 10 9 11 2 5 3 = 110911253). Обратный разбор однозначен по шагам:
// первая цифра результата — первая цифра исходного числа, дальше читаем «сумму»
// (одна или две цифры) и следующую цифру, проверяя, что сумма действительно равна
// сумме соседей. Поэтому существование прообраза проверяется рекурсией по строке,
// а не перебором всех чисел.
const insertSums = (n) => {
  const s = String(n)
  let r = s[0]
  for (let i = 1; i < s.length; i++) r += String(Number(s[i - 1]) + Number(s[i])) + s[i]
  return r
}
// Все прообразы строки (обычно их 0 или 1)
function preimages(str) {
  const out = []
  const walk = (pos, prevDigit, acc) => {
    if (pos === str.length) { if (acc.length >= 2) out.push(acc.join("")); return }
    for (const len of [1, 2]) {                                // длина записанной суммы
      if (pos + len >= str.length) continue
      const sumPart = str.slice(pos, pos + len)
      if (len === 2 && sumPart[0] === "0") continue
      const nextDigit = Number(str[pos + len])
      if (Number(sumPart) !== prevDigit + nextDigit) continue
      acc.push(nextDigit)
      walk(pos + len + 1, nextDigit, acc)
      acc.pop()
    }
  }
  if (!str.length) return out
  walk(1, Number(str[0]), [Number(str[0])])
  return out
}

export function t19InsertDigitSums() {
  const K = pick([11, 9, 13])
  let srcA = 0
  for (let t = 0; t < 100 && !srcA; t++) {                   // без нулей: иначе разбор неоднозначен
    const cand = randInt(1000, 9999)
    if (!String(cand).includes("0")) srcA = cand
  }
  if (!srcA) return null
  const strA = insertSums(srcA)
  // б) строка без прообраза: портим одну цифру результата другого числа
  let strB = null
  for (let t = 0; t < 200 && !strB; t++) {
    const base = insertSums(randInt(1000, 9999))
    const pos = randInt(0, base.length - 1)
    const digit = String(randInt(0, 9))
    if (base[pos] === digit) continue
    const cand = base.slice(0, pos) + digit + base.slice(pos + 1)
    if (cand[0] !== "0" && cand.length >= 7 && !preimages(cand).length) strB = cand
  }
  if (!strB) return null
  // в) наибольшее кратное K, получаемое из трёхзначного числа
  let best = 0, bestSrc = 0
  for (let n = 100; n <= 999; n++) {
    const v = Number(insertSums(n))
    if (v % K === 0 && v > best) { best = v; bestSrc = n }
  }
  if (!best) return null

  const params = { K, strA, strB }
  const check = (cfg, part) => {
    if (!Number.isInteger(cfg) || cfg < 10) return "нужно натуральное число не менее чем из двух цифр"
    const got = insertSums(cfg)
    if (part === "a") return got === strA ? null : `из ${cfg} получается ${got}, а нужно ${strA}`
    if (part === "b") return got === strB ? null : `из ${cfg} получается ${got}, а нужно ${strB}`
    if (part === "c") {
      if (cfg < 100 || cfg > 999) return "число должно быть трёхзначным"
      if (Number(got) % K) return `${got} не кратно ${K}`
      if (Number(got) !== best) return `получается ${got}, а заявлено ${best}`
    }
    return null
  }
  // Независимый проход: прообразы ищутся разбором строки, а максимум — перебором
  // всех трёхзначных чисел.
  const solve = (P) => {
    let top = 0
    for (let n = 100; n <= 999; n++) {
      const v = Number(insertSums(n))
      if (v % P.K === 0 && v > top) top = v
    }
    return { a: preimages(P.strA).length > 0, b: preimages(P.strB).length > 0, c: top, c_next: false }
  }

  return item({
    preamble: `С натуральным числом проводят следующую операцию: между каждыми двумя его соседними цифрами записывают сумму этих цифр (например, из числа 1923 получается число 110911253).`,
    qa: `Приведите пример числа, из которого получается ${strA}.`,
    qb: `Может ли из какого-нибудь числа получиться число ${strB}?`,
    qc: `Какое наибольшее число, кратное ${K}, может получиться из трёхзначного числа?`,
    ansA: `${srcA}`,
    ansB: `нет: разбор однозначен — первая цифра результата совпадает с первой цифрой исходного числа, затем идёт сумма первых двух цифр, затем вторая цифра и так далее. Проверяя оба варианта длины каждой записанной суммы (одна цифра или две), убеждаемся, что запись ${strB} так не разбирается`,
    ansC: `${best}; получается из числа ${bestSrc}`,
    solution: `Обозначим цифры исходного числа d₁, d₂, …, dₙ. После операции получается запись d₁ (d₁+d₂) d₂ (d₂+d₃) d₃ … dₙ, где каждая сумма записана одной или двумя цифрами.\nа) ${strA} = ${String(srcA).split("").map((d, i, a) => (i ? `${Number(a[i - 1]) + Number(d)} ${d}` : d)).join(" ")}, поэтому подходит число ${srcA}.\nб) Разбор записи однозначен: первая цифра — это d₁, дальше на каждом шаге читается сумма (одна или две цифры) и следующая цифра, причём сумма обязана равняться сумме соседних цифр. Перебор обоих вариантов длины на каждом шаге показывает, что запись ${strB} не разбирается ни при каком выборе.\nв) Для трёхзначного числа результат равен d₁ (d₁+d₂) d₂ (d₂+d₃) d₃; перебирая все трёхзначные числа, получаем наибольшее кратное ${K} значение ${best} (из числа ${bestSrc}).\nОтвет: ${best}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: srcA, target: `src-${strA}` },
        b: { type: "yesno", yes: false, reason: "no-preimage", target: `src-${strB}` },
        c: { type: "extremum", mode: "max", value: best, example: bestSrc },
      },
      mustMention: [1923, 110911253, Number(strA), Number(strB), K],
      extra: [],
      maxNumber: 9999999999,
      phrases: ["между каждыми двумя его соседними цифрами", "сумму этих цифр"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 6 (продолжение). Общая надпоследовательность: числа вычёркиванием (#22)
// ═══════════════════════════════════════════════════════════════════════════

// Из записи числа вычёркиванием цифр получают другие числа. Вопрос «существует ли
// L-значное число, из которого получаются все данные» — это поиск кратчайшей общей
// НАДпоследовательности. Для нескольких коротких целей она ищется поиском в ширину по
// состояниям (сколько символов каждой цели уже сопоставлено) — состояний немного.
// Для набора 1…N ответ конструктивен: пусть F — наибольшая цифра a, при которой все
// числа 10a…10a+9 не превосходят N. После первого вхождения каждой из цифр 1…F должны
// встретиться все десять цифр, поэтому длина не меньше F + 10; столько и достаточно.
function shortestSuper(targets) {
  const start = targets.map(() => 0)
  const key = (st) => st.join(",")
  let level = new Map([[key(start), ""]])
  for (let L = 1; L <= 12; L++) {
    const next = new Map()
    for (const [k, str] of level) {
      const st = k.split(",").map(Number)
      for (let d = 0; d <= 9; d++) {
        if (!str && d === 0) continue
        const ns = st.map((p, i) => (p < targets[i].length && targets[i][p] === String(d) ? p + 1 : p))
        const nk = key(ns)
        const cand = str + d
        const prev = next.get(nk)
        if (prev === undefined || cand < prev) next.set(nk, cand)
      }
    }
    level = next
    for (const [k, str] of level) {
      if (k.split(",").map(Number).every((p, i) => p === targets[i].length)) return { len: L, str }
    }
  }
  return null
}

export function t19SupersequenceDigits() {
  // только те N, для которых ответ сверен независимым поиском в ширину
  // (N = 30 → 121230456789, N = 40 → 1231234056789); для 50 перебор не помещается в память
  const N = pick([30, 40])
  const rnd3 = () => String(randInt(102, 987))
  // а) три трёхзначных числа с общей надпоследовательностью ровно из La цифр
  const La = 7
  let setA = null
  for (let t = 0; t < 200 && !setA; t++) {
    const g = [rnd3(), rnd3(), rnd3()]
    if (uniq(g).length !== 3) continue
    const r = shortestSuper(g)
    if (r && r.len === La) setA = { nums: g, sup: r.str }
  }
  // б) пять трёхзначных чисел, для которых Lb цифр НЕ хватает
  const Lb = 9
  let setB = null
  for (let t = 0; t < 300 && !setB; t++) {
    const g = [rnd3(), rnd3(), rnd3(), rnd3(), rnd3()]
    if (uniq(g).length !== 5) continue
    const r = shortestSuper(g)
    if (r && r.len > Lb) setB = { nums: g, need: r.len }
  }
  if (!setA || !setB) return null
  // в) наименьшее число, из которого получаются все числа от 1 до N
  const F = Math.floor((N - 9) / 10)
  if (F < 1) return null
  const head = Array.from({ length: F }, (_, i) => i + 1)   // 1, 2, …, F
  const tailDigits = []                                     // все десять цифр после головы
  const lastFirst = Math.floor(N / 10)                      // цифра десятков у N (например 4 для 40)
  const needEarly = lastFirst > F ? lastFirst : null        // цифра, которой нужен «свой» ноль
  for (let d = 1; d <= 9; d++) tailDigits.push(d)
  tailDigits.push(0)
  // хвост: лексикографически минимальная перестановка 1…9,0, где needEarly стоит до нуля
  // хвост собираем жадно, каждый раз беря НАИМЕНЬШУЮ допустимую цифру
  const tail = []
  const restDigits = [...tailDigits]
  while (restDigits.length) {
    const order = [...restDigits].sort((x, y) => x - y)
    for (const d of order) {
      const left = restDigits.filter((v) => v !== d)
      const earlyLeft = needEarly !== null && left.includes(needEarly)
      if (d === 0 && earlyLeft) continue                          // ноль раньше нужной цифры нельзя
      tail.push(d); restDigits.splice(restDigits.indexOf(d), 1); break
    }
  }
  const answer = [...head, ...tail].join("")
  const covers = (str, v) => {
    const s = String(v)
    let i = 0
    for (const ch of str) if (i < s.length && s[i] === ch) i++
    return i === s.length
  }
  for (let v = 1; v <= N; v++) if (!covers(answer, v)) return null

  const params = { N, La, Lb, setA, setB, F }
  const check = (cfg, part) => {
    if (typeof cfg !== "string" || !/^[1-9]\d*$/.test(cfg)) return "нужно натуральное число без ведущего нуля"
    if (part === "a") {
      if (cfg.length !== La) return `число должно быть ${La}-значным, а в нём ${cfg.length} цифр`
      for (const g of setA.nums) if (!covers(cfg, g)) return `из ${cfg} нельзя получить ${g}`
      return null
    }
    if (part === "c") {
      if (cfg.length !== answer.length) return `в числе ${cfg.length} цифр, а в ответе ${answer.length}`
      for (let v = 1; v <= N; v++) if (!covers(cfg, v)) return `из ${cfg} нельзя получить ${v}`
      if (Number(cfg) !== Number(answer)) return `${cfg} не совпадает с заявленным ответом ${answer}`
    }
    return null
  }
  // Независимый проход: кратчайшая надпоследовательность ищется поиском в ширину
  // (пункты а и б), а для пункта в) проверяется покрытие и нижняя оценка длины F + 10.
  const solve = (P) => {
    const ra = shortestSuper(P.setA.nums)
    const rb = shortestSuper(P.setB.nums)
    return {
      a: !!ra && ra.len <= P.La,
      b: !!rb && rb.len <= P.Lb,
      c: answer.length === P.F + 10 ? Number(answer) : -1,
      c_next: false,
    }
  }

  return item({
    preamble: `Из записи натурального числа вычёркивают несколько цифр (оставшиеся цифры сохраняют свой порядок) и получают новое натуральное число.`,
    qa: `Приведите пример ${La === 7 ? "семизначного" : `${La}-значного`} числа, вычёркивая цифры которого, можно получить каждое из чисел: ${setA.nums.join(", ")}.`,
    qb: `Существует ли ${Lb === 9 ? "девятизначное" : `${Lb}-значное`} число, вычёркивая цифры которого, можно получить каждое из чисел: ${setB.nums.join(", ")}?`,
    qc: `Найдите наименьшее число, из которого можно получить все числа от 1 до ${N} включительно, вычёркивая из него цифры.`,
    ansA: `${setA.sup}`,
    ansB: `нет: поиск кратчайшего числа, из которого получаются все пять данных чисел, даёт ${setB.need} ${plural(setB.need, "цифру", "цифры", "цифр")} — меньше чем ${setB.need} цифрами обойтись нельзя, а ${Lb} < ${setB.need}`,
    ansC: `${answer}`,
    solution: `а) Подходит число ${setA.sup}: из него вычёркиванием получаются ${setA.nums.join(", ")}.\nб) Кратчайшее число, из которого получаются все числа ${setB.nums.join(", ")}, содержит ${setB.need} ${plural(setB.need, "цифру", "цифры", "цифр")}, поэтому ${Lb}-значного числа недостаточно.\nв) Чтобы получить все числа вида 10a + b при a = 1, …, ${F} и b = 0, …, 9, после первого вхождения каждой из цифр 1, …, ${F} должны встретиться все десять цифр. Значит длина записи не меньше ${F} + 10 = ${F + 10}. Столько цифр и достаточно: ${answer} — здесь сначала идут ${head.join(", ")}, а затем все десять цифр в порядке ${tail.join(", ")}, причём ${needEarly !== null ? `цифра ${needEarly} стоит раньше нуля (это нужно для числа ${N})` : "порядок выбран лексикографически наименьшим"}.\nОтвет: ${answer}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: setA.sup, target: `set-${setA.nums.join("-")}` },
        b: { type: "yesno", yes: false, reason: "supersequence-too-long", target: `set-${setB.nums.join("-")}` },
        c: { type: "value", value: Number(answer), example: answer },
      },
      mustMention: [N, 1, ...setA.nums.map(Number), ...setB.nums.map(Number)],
      extra: [],
      maxNumber: 999,
      phrases: ["вычёркивая цифры которого", "от 1 до"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 6 (продолжение). Приписывание числа справа вместо умножения (#99)
// ═══════════════════════════════════════════════════════════════════════════

// Двузначное a приписали трёхзначное b справа, получив 1000a + b, и это оказалось
// в N раз больше произведения ab:
//   1000a + b = N·a·b   ⟺   N = 1000/b + 1/a.
// Отсюда сразу видно, что N ≤ 1000/100 + 1/10 = 10,1, то есть N ≤ 10, а перебор
// (a от 10 до 99, b от 100 до 999) показывает, какие значения достижимы.
export function t19AppendInsteadMultiply() {
  const reach = new Map()
  for (let a = 10; a <= 99; a++) {
    for (let b = 100; b <= 999; b++) {
      const v = 1000 * a + b
      if (v % (a * b)) continue
      const N = v / (a * b)
      if (!reach.has(N)) reach.set(N, { a, b })
    }
  }
  const okList = [...reach.keys()].sort((x, y) => x - y)
  const maxN = Math.max(...okList)
  const Na = pick(okList.filter((N) => N < maxN))
  const badList = []
  for (let N = 2; N <= 12; N++) if (!reach.has(N)) badList.push(N)
  const Nb = pick(badList)
  if (!Na || !Nb) return null

  const params = { Na, Nb, maxN }
  const check = (cfg, part) => {
    if (!cfg || !Number.isInteger(cfg.a) || !Number.isInteger(cfg.b)) return "нужны два числа"
    if (cfg.a < 10 || cfg.a > 99) return `${cfg.a} — не двузначное число`
    if (cfg.b < 100 || cfg.b > 999) return `${cfg.b} — не трёхзначное число`
    const glued = 1000 * cfg.a + cfg.b, prod = cfg.a * cfg.b
    if (glued % prod) return `${glued} не делится на ${prod}`
    const N = glued / prod
    const need = part === "a" ? Na : maxN
    if (N !== need) return `получилось в ${N} раз больше, а нужно в ${need}`
    return null
  }
  // Независимый перебор всех пар (двузначное, трёхзначное).
  const solve = (P) => {
    const set = new Set()
    for (let a = 10; a <= 99; a++) {
      for (let b = 100; b <= 999; b++) {
        const v = 1000 * a + b
        if (v % (a * b) === 0) set.add(v / (a * b))
      }
    }
    return { a: set.has(P.Na), b: set.has(P.Nb), c: Math.max(...set), c_next: false }
  }

  const exA = reach.get(Na), exC = reach.get(maxN)
  return item({
    preamble: `Максим должен был умножить двузначное число на трёхзначное число (числа с нуля начинаться не могут). Вместо этого он просто приписал трёхзначное число справа к двузначному, получив пятизначное число, которое оказалось в N раз (N — натуральное число) больше правильного результата.`,
    qa: `Могло ли N равняться ${Na}?`,
    qb: `Могло ли N равняться ${Nb}?`,
    qc: `Каково наибольшее возможное значение N?`,
    ansA: `да: ${exA.a} и ${exA.b} дают ${1000 * exA.a + exA.b} = ${Na}·${exA.a}·${exA.b}`,
    ansB: `нет: из 1000a + b = N·a·b следует N = ${"1000/b + 1/a"}; чтобы N было целым, число b(Na − 1) должно равняться 1000a, а так как a и Na − 1 взаимно просты, Na − 1 обязано делить 1000. При N = ${Nb} ни одно значение ${Nb}a − 1 (при двузначном a) делителем 1000 не является`,
    ansC: `${maxN}; например ${exC.a} и ${exC.b}: ${1000 * exC.a + exC.b} = ${maxN}·${exC.a}·${exC.b}`,
    solution: `Пусть a — двузначное число, b — трёхзначное. Приписывание даёт 1000a + b, и по условию 1000a + b = N·a·b, откуда\nN = 1000/b + 1/a.\nТак как b ≥ 100 и a ≥ 10, получаем N ≤ 10 + 0,1, то есть N ≤ 10.\nа) При N = ${Na} подходят a = ${exA.a}, b = ${exA.b}.\nб) Равенство 1000a + b = ${Nb}ab означает b(${Nb}a − 1) = 1000a; числа a и ${Nb}a − 1 взаимно просты, поэтому ${Nb}a − 1 делит 1000. Перебирая двузначные a, убеждаемся, что таких значений нет.\nв) Значение N = 10 невозможно (те же рассуждения: 10a − 1 оканчивается на 9 и не делит 1000), а N = ${maxN} достигается: ${exC.a} и ${exC.b}.\nОтвет: ${maxN}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `N-${Na}` },
        b: { type: "yesno", yes: false, reason: "divisor-1000", target: `N-${Nb}` },
        c: { type: "extremum", mode: "max", value: maxN, example: exC },
      },
      mustMention: [Na, Nb],
      extra: [],
      phrases: ["приписал трёхзначное число справа", "с нуля начинаться не могут"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 6 (окончание). Приписали цифру справа к части чисел (#106)
// ═══════════════════════════════════════════════════════════════════════════

// К числам первой группы приписали справа цифру d₁, к числам второй — d₂, третью
// оставили без изменений. Приписывание цифры d превращает x в 10x + d, поэтому
// новая сумма равна 10S + d₁p + d₂q − 9C, где S — исходная сумма, p и q — размеры
// первых двух групп, C — сумма третьей группы. Значит
//   k = 10 + (d₁p + d₂q − 9C)/S,
// то есть увеличение больше 10 возможно только при маленькой третьей группе, а
// достижимые значения k находятся перебором небольших наборов.
export function t19AppendDigitGroups() {
  const [d1, d2] = pick([[3, 7], [2, 9], [1, 8]])
  const POOL = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const reach = new Map()
  const rec = (i, g1, g2, g3) => {
    if (i === POOL.length) {
      if (!g1.length || !g2.length || !g3.length) return
      const S = sum([...g1, ...g2, ...g3])
      const T = sum(g1.map((x) => 10 * x + d1)) + sum(g2.map((x) => 10 * x + d2)) + sum(g3)
      if (T % S === 0 && !reach.has(T / S)) reach.set(T / S, { g1: [...g1], g2: [...g2], g3: [...g3] })
      return
    }
    rec(i + 1, g1, g2, g3)
    rec(i + 1, [...g1, POOL[i]], g2, g3)
    rec(i + 1, g1, [...g2, POOL[i]], g3)
    rec(i + 1, g1, g2, [...g3, POOL[i]])
  }
  rec(0, [], [], [])
  const okList = [...reach.keys()].sort((x, y) => x - y)
  if (!okList.length) return null
  const maxK = Math.max(...okList)
  const Ka = pick(okList.filter((k) => k >= 4 && k < maxK))
  const Kb = pick([maxK + randInt(2, 6), maxK + randInt(7, 10)])
  if (!Ka || okList.includes(Kb)) return null

  const params = { d1, d2, Ka, Kb, maxK }
  const check = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.g1) || !Array.isArray(cfg.g2) || !Array.isArray(cfg.g3)) return "нет разбиения"
    if (!cfg.g1.length || !cfg.g2.length || !cfg.g3.length) return "в каждой группе должно быть хотя бы одно число"
    const all = [...cfg.g1, ...cfg.g2, ...cfg.g3]
    for (const x of all) if (!Number.isInteger(x) || x < 1) return `${x} — не натуральное число`
    if (uniq(all).length !== all.length) return "числа на доске обязаны быть различными"
    const S = sum(all)
    const T = sum(cfg.g1.map((x) => 10 * x + d1)) + sum(cfg.g2.map((x) => 10 * x + d2)) + sum(cfg.g3)
    if (T % S) return `сумма выросла в ${T / S} раз — не целое число раз`
    const k = T / S
    const need = part === "a" ? Ka : maxK
    if (k !== need) return `сумма выросла в ${k} раз, а нужно в ${need}`
    return null
  }
  // Независимый перебор: каждое из чисел 1…9 либо не пишется на доску, либо попадает
  // в одну из трёх групп. Этого достаточно: увеличение k = 10 + (d₁p + d₂q − 9C)/S
  // растёт при уменьшении чисел, поэтому оптимум достигается на маленьких наборах.
  const solve = (P) => {
    const set = new Set()
    const walk = (i, g1, g2, g3) => {
      if (i === POOL.length) {
        if (!g1.length || !g2.length || !g3.length) return
        const S = sum([...g1, ...g2, ...g3])
        const T = sum(g1.map((x) => 10 * x + P.d1)) + sum(g2.map((x) => 10 * x + P.d2)) + sum(g3)
        if (T % S === 0) set.add(T / S)
        return
      }
      walk(i + 1, g1, g2, g3)
      walk(i + 1, [...g1, POOL[i]], g2, g3)
      walk(i + 1, g1, [...g2, POOL[i]], g3)
      walk(i + 1, g1, g2, [...g3, POOL[i]])
    }
    walk(0, [], [], [])
    return { a: set.has(P.Ka), b: set.has(P.Kb), c: Math.max(...set), c_next: false }
  }

  const exA = reach.get(Ka), exC = reach.get(maxK)
  const coef = (d, v) => (d === 1 ? v : `${d}${v}`)          // «p» вместо «1p»
  const showCfg = (c) => `первая группа — ${c.g1.join(", ")}, вторая — ${c.g2.join(", ")}, третья — ${c.g3.join(", ")}`
  return item({
    preamble: `На доске было написано несколько различных натуральных чисел. Эти числа разбили на три группы, в каждой из которых оказалось хотя бы одно число. К каждому числу из первой группы приписали справа цифру ${d1}, к каждому числу из второй группы — цифру ${d2}, а числа из третьей группы оставили без изменений.`,
    qa: `Могла ли сумма всех этих чисел увеличиться в ${Ka} раз?`,
    qb: `Могла ли сумма всех этих чисел увеличиться в ${Kb} раз?`,
    qc: `В какое наибольшее число раз могла увеличиться сумма всех этих чисел?`,
    ansA: `да, например ${showCfg(exA)}`,
    ansB: `нет: приписывание цифры превращает число x в 10x + цифра, поэтому новая сумма равна 10S + ${coef(d1, "p")} + ${coef(d2, "q")} − 9C, где S — исходная сумма, p и q — количества чисел в первых двух группах, C — сумма третьей группы. Значит увеличение равно 10 + (${coef(d1, "p")} + ${coef(d2, "q")} − 9C)/S, а перебор показывает, что больше ${maxK} оно быть не может`,
    ansC: `${maxK}; например ${showCfg(exC)}`,
    solution: `Приписывание цифры d к числу x даёт 10x + d. Пусть в первой группе p чисел, во второй q, сумма третьей группы равна C, а исходная сумма всех чисел равна S. Тогда новая сумма равна\n10S + ${coef(d1, "p")} + ${coef(d2, "q")} − 9C,\nи увеличение составляет k = 10 + (${coef(d1, "p")} + ${coef(d2, "q")} − 9C)/S.\nа) Пример увеличения в ${Ka} раз: ${showCfg(exA)}.\nб) Чтобы k было большим, нужна маленькая третья группа и много чисел в первых двух, но каждое новое число увеличивает S; перебор наборов показывает, что максимум равен ${maxK}, поэтому ${Kb} невозможно.\nв) Наибольшее значение ${maxK} достигается: ${showCfg(exC)}.\nОтвет: ${maxK}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `times-${Ka}` },
        b: { type: "yesno", yes: false, reason: "max-ratio", target: `times-${Kb}` },
        c: { type: "extremum", mode: "max", value: maxK, example: exC },
      },
      mustMention: [d1, d2, Ka, Kb],
      extra: [],
      phrases: ["приписали справа цифру", "хотя бы одно число"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 13 (продолжение). Переливания между бочками (#4)
// ═══════════════════════════════════════════════════════════════════════════

// В n бочках налито суммарно S литров, за одно переливание можно перелить любое
// количество из одной бочки в другую. В конце в каждой бочке должно быть m = S/n.
// • Каждое переливание можно устроить так, чтобы хотя бы одна бочка стала «готовой»,
//   поэтому набор из k бочек уравнивается за k − 1 переливание.
// • Если бочки разбиваются на g групп, в каждой из которых суммарный объём кратен m
//   (то есть равен (размер группы)·m), группы уравниваются независимо: всего n − g.
// • Больше g групп не бывает, а в худшем случае (например, вся вода в одной бочке)
//   g = 1, поэтому ГАРАНТИРОВАННО нужно ровно n − 1 переливаний.
function pourMin(vols) {
  const n = vols.length, S = sum(vols)
  if (S % n) return null
  const m = S / n
  // максимальное число групп с суммой, кратной m: перебор разбиений (n мало)
  let best = 1
  const rec = (idx, groups) => {
    if (idx === n) {
      if (groups.every((g) => sum(g) % m === 0 && sum(g) / m === g.length)) best = Math.max(best, groups.length)
      return
    }
    for (let i = 0; i < groups.length; i++) {
      groups[i].push(vols[idx]); rec(idx + 1, groups); groups[i].pop()
    }
    groups.push([vols[idx]]); rec(idx + 1, groups); groups.pop()
  }
  rec(0, [])
  return n - best
}

export function t19BarrelsPour() {
  const nA = 4
  const m = pick([48, 50, 36, 60])
  // а) четыре бочки с суммой 4m и лимитом переливаний La
  let volsA = null
  for (let t = 0; t < 300 && !volsA; t++) {
    const v = [randInt(m - 25, m - 5), randInt(m - 20, m + 5), randInt(m - 10, m + 10)]
    const last = 4 * m - sum(v)
    if (last < 1 || v.includes(last)) continue
    const cand = [...v, last].sort((a, b) => a - b)
    if (uniq(cand).length !== 4) continue
    if (pourMin(cand) === 3) volsA = cand                    // нужен ровно общий случай
  }
  if (!volsA) return null
  const La = nA                                              // «не более чем за 4 переливания»
  const nB = pick([7, 8, 9])
  const Lb = nB - 2                                          // «не более чем за n−2» — не всегда
  const nC = pick([26, 30, 24])

  const params = { nA, volsA, La, nB, Lb, nC }
  const check = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.vols) || !Array.isArray(cfg.moves)) return "нет плана переливаний"
    const vols = [...cfg.vols]
    const n = vols.length
    if (sum(vols) % n) return "воду нельзя уравнять: сумма не делится на число бочек"
    for (const mv of cfg.moves) {
      if (!Array.isArray(mv) || mv.length !== 3) return "переливание задаётся тройкой (откуда, куда, сколько)"
      const [from, to, amount] = mv
      if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return "переливать нужно между разными бочками"
      if (from < 0 || to < 0 || from >= n || to >= n) return "нет такой бочки"
      if (!(amount > 0) || amount > vols[from]) return `нельзя перелить ${amount} л из бочки с ${vols[from]} л`
      vols[from] -= amount; vols[to] += amount
    }
    if (uniq(vols).length !== 1) return `в бочках получилось ${vols.join(", ")} — не поровну`
    const limit = part === "a" ? La : part === "c" ? nC - 1 : Lb
    if (cfg.moves.length > limit) return `переливаний ${cfg.moves.length}, а разрешено не более ${limit}`
    return null
  }
  // Независимый проход: для конкретного набора минимум считается перебором разбиений
  // на группы, а «гарантированное» число переливаний — это n − 1 (худший случай:
  // вся вода в одной бочке, тогда каждая из остальных n − 1 бочек должна получить воду).
  const solve = (P) => ({
    a: pourMin(P.volsA) <= P.La,
    b: P.nB - 1 <= P.Lb,
    c: P.nC - 1,
    c_next: false,
  })

  // план для пункта а): выливаем излишки в бочки с недостатком
  const buildPlan = (vols) => {
    const v = [...vols], mm = sum(v) / v.length, moves = []
    for (let i = 0; i < v.length; i++) {
      if (v[i] <= mm) continue
      for (let j = 0; j < v.length && v[i] > mm; j++) {
        if (v[j] >= mm) continue
        const amount = Math.min(v[i] - mm, mm - v[j])
        v[i] -= amount; v[j] += amount; moves.push([i, j, amount])
      }
    }
    return moves
  }
  const exA = { vols: volsA, moves: buildPlan(volsA) }
  const exC = (() => {                                        // худший случай для n бочек
    const vols = Array(nC).fill(0)
    vols[0] = nC * 10
    const moves = []
    for (let i = 1; i < nC; i++) moves.push([0, i, 10])
    return { vols, moves }
  })()

  return item({
    preamble: `В нескольких одинаковых бочках налито некоторое количество литров воды (необязательно одинаковое). За один раз можно перелить любое количество воды из одной бочки в другую.`,
    qa: `Пусть есть четыре бочки, в которых ${volsA.join(", ")} ${plural(volsA[3], "литр", "литра", "литров")}. Можно ли не более чем за ${La} переливания уравнять количество воды в бочках?`,
    qb: `Пусть есть ${nB} бочек. Всегда ли можно уравнять количество воды во всех бочках не более чем за ${Lb} переливаний?`,
    qc: `За какое наименьшее количество переливаний можно заведомо уравнять количество воды в ${nC} бочках?`,
    ansA: `да: среднее равно ${sum(volsA) / 4} ${plural(sum(volsA) / 4, "литр", "литра", "литров")}, и хватает ${exA.moves.length} ${plural(exA.moves.length, "переливания", "переливаний", "переливаний")} — каждым из них одна бочка доводится ровно до среднего`,
    ansB: `нет: если вся вода налита в одну бочку, а остальные ${nB - 1} пусты, то каждая пустая бочка должна получить воду хотя бы одним переливанием, поэтому нужно не менее ${nB - 1} переливаний, а ${Lb} < ${nB - 1}`,
    ansC: `${nC - 1}`,
    solution: `Пусть бочек n, а всего налито S литров; в конце в каждой должно быть m = S/n.\nСверху: если в бочке больше m, лишнее переливаем в бочку, где меньше m, причём выравниваем ровно одну из них — каждое переливание «закрывает» хотя бы одну бочку, поэтому n бочек уравниваются за n − 1 переливание.\nСнизу: если вся вода в одной бочке, а остальные n − 1 пусты, то в каждую пустую нужно хотя бы раз перелить воду, то есть переливаний не меньше n − 1.\nа) Среднее равно ${sum(volsA) / 4}, достаточно ${exA.moves.length} ${plural(exA.moves.length, "переливания", "переливаний", "переливаний")} — это не больше ${La}.\nб) Для ${nB} бочек гарантированно нужно ${nB - 1} переливаний, а ${Lb} меньше.\nв) Для ${nC} бочек ответ ${nC - 1}.\nОтвет: ${nC - 1}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `pour-${La}` },
        b: { type: "yesno", yes: false, reason: "empty-barrels", target: `pour-${Lb}` },
        c: { type: "extremum", mode: "min", value: nC - 1, example: exC },
      },
      mustMention: [...volsA, La, nB, Lb, nC],
      extra: [],
      phrases: ["перелить любое количество воды", "уравнять количество воды"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 13 (продолжение). Четыре коробки: −1, −1, −1, +3 (#25)
// ═══════════════════════════════════════════════════════════════════════════

// За ход из трёх коробок берут по камню и кладут в четвёртую. Общая сумма не меняется,
// а каждая попарная разность меняется на 0 или ±4, поэтому ВСЕ попарные разности
// сохраняются по модулю 4 — это инвариант. Если сделано n ходов и i-я коробка получала
// «+3» ровно kᵢ раз, то aᵢ' = aᵢ + 4kᵢ − n, откуда и достижимость: нужны целые kᵢ ≥ 0
// с Σkᵢ = n. Наибольшее число камней в первой коробке ищется из условия, что остальные
// три неотрицательны и имеют нужные остатки по модулю 4.
export function t19FourBoxesPlus3() {
  const base = pick([101, 97, 121, 149])
  const start = [base, base + 1, base + 2, 0]
  const S = sum(start)
  const okState = (st) => {
    if (sum(st) !== S) return false
    for (const v of st) if (!Number.isInteger(v) || v < 0) return false
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      if (((st[i] - st[j]) - (start[i] - start[j])) % 4 !== 0) return false
    }
    // достижимость: n = (сумма превышений) и kᵢ = (aᵢ' − aᵢ + n)/4 ≥ 0
    for (let n = 0; n <= 4 * S; n += 1) {
      const ks = st.map((v, i) => (v - start[i] + n) / 4)
      if (ks.every((k) => Number.isInteger(k) && k >= 0) && Math.abs(sum(ks) - n) < 1e-9) return true
      if (n > 2 * S) break
    }
    return false
  }
  // а) достижимое состояние: делаем несколько ходов от начального
  const st = [...start]
  const movesA = randInt(2, 6)
  for (let t = 0; t < movesA; t++) {
    const to = randInt(0, 3)
    let ok = true
    for (let i = 0; i < 4; i++) if (i !== to && st[i] < 1) ok = false
    if (!ok) { t--; continue }
    for (let i = 0; i < 4; i++) st[i] += (i === to ? 3 : -1)
  }
  const stateA = [...st]
  if (stateA.join() === start.join()) return null
  // б) недостижимое: вся куча в одной коробке
  const idxB = 3
  const stateB = [0, 0, 0, 0]
  stateB[idxB] = S
  if (okState(stateB)) return null
  // в) наибольшее число камней в первой коробке
  let best = -1, bestState = null
  for (let m = S; m >= 0; m--) {
    const rest = [1, 2, 3].map((i) => {
      const need = ((m - (start[0] - start[i])) % 4 + 4) % 4
      return need
    })
    if (m + sum(rest) !== S) continue
    const cand = [m, ...rest]
    if (okState(cand)) { best = m; bestState = cand; break }
  }
  if (best < 0) return null

  const params = { start, S, stateA, stateB, best }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || cfg.length !== 4) return "состояние — четыре числа"
    for (const v of cfg) if (!Number.isInteger(v) || v < 0) return `${v} — не целое неотрицательное число камней`
    if (sum(cfg) !== S) return `всего камней ${sum(cfg)}, а должно быть ${S}`
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      if (((cfg[i] - cfg[j]) - (start[i] - start[j])) % 4 !== 0) return `разность коробок ${i + 1} и ${j + 1} изменилась не на кратное 4`
    }
    if (part === "a" && cfg.join() !== stateA.join()) return `нужно состояние ${stateA.join(", ")}`
    if (part === "c" && cfg[0] !== best) return `в первой коробке ${cfg[0]} камней, а заявлено ${best}`
    return null
  }
  // Независимый проход: перебор всех состояний с нужной суммой (первая коробка сверху
  // вниз), проверка инварианта по модулю 4 и разрешимости системы aᵢ' = aᵢ + 4kᵢ − n.
  const solve = (P) => {
    let top = -1
    for (let m = P.S; m >= 0 && top < 0; m--) {
      const rest = [1, 2, 3].map((i) => (((m - (P.start[0] - P.start[i])) % 4) + 4) % 4)
      if (m + sum(rest) !== P.S) continue
      if (okState([m, ...rest])) top = m
    }
    return { a: okState(P.stateA), b: okState(P.stateB), c: top, c_next: false }
  }

  return item({
    preamble: `Есть четыре коробки: в первой коробке ${start[0]} ${plural(start[0], "камень", "камня", "камней")}, во второй — ${start[1]}, в третьей — ${start[2]}, а в четвёртой коробке камней нет. За один ход берут по одному камню из любых трёх коробок и кладут в оставшуюся. Сделали некоторое количество таких ходов.`,
    qa: `Могло ли в первой коробке оказаться ${stateA[0]} ${plural(stateA[0], "камень", "камня", "камней")}, во второй — ${stateA[1]}, в третьей — ${stateA[2]}, а в четвёртой — ${stateA[3]}?`,
    qb: `Могло ли в четвёртой коробке оказаться ${S} ${plural(S, "камень", "камня", "камней")}?`,
    qc: `Какое наибольшее число камней могло оказаться в первой коробке?`,
    ansA: `да: такое состояние получается за ${movesA} ${plural(movesA, "ход", "хода", "ходов")}`,
    ansB: `нет: за ход три коробки теряют по камню, а одна получает три, поэтому любая разность двух коробок меняется на 0 или ±4 — все попарные разности сохраняются по модулю 4. Вначале разность первой и второй коробок равна ${String(start[0] - start[1]).replace("-", "−")}, то есть ${(((start[0] - start[1]) % 4) + 4) % 4} по модулю 4, а в требуемом состоянии обе коробки пусты и разность равна 0`,
    ansC: `${best}; например ${bestState.join(", ")}`,
    solution: `Общее число камней не меняется и равно ${S}. За ход одна коробка получает 3 камня, а три другие теряют по одному, поэтому разность любых двух коробок меняется на 0 или ±4: все попарные разности сохраняются по модулю 4.\nа) Указанное состояние получается за ${movesA} ${plural(movesA, "ход", "хода", "ходов")}.\nб) Если в четвёртой коробке ${S} камней, то остальные пусты и их разности равны нулю, а изначально разность первой и второй равна ${String(start[0] - start[1]).replace("-", "−")} — по модулю 4 это ${(((start[0] - start[1]) % 4) + 4) % 4}, противоречие.\nв) Пусть в первой коробке стало m камней. Остальные три числа неотрицательны, в сумме дают ${S} − m и имеют определённые остатки по модулю 4 (они восстанавливаются из инварианта). Наименьшая возможная сумма этих остатков достигается при m = ${best}: тогда в коробках ${bestState.join(", ")}. Такое состояние достижимо, потому что система aᵢ' = aᵢ + 4kᵢ − n имеет решение в неотрицательных целых.\nОтвет: ${best}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: stateA, target: `state-${stateA.join("-")}` },
        b: { type: "yesno", yes: false, reason: "mod4-invariant", target: `all-in-${idxB}` },
        c: { type: "extremum", mode: "max", value: best, example: bestState },
      },
      mustMention: [...start.slice(0, 3), ...stateA, S],
      extra: [],
      phrases: ["по одному камню из любых трёх коробок", "камней нет"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 13 (продолжение). Стирание троек с различными суммами (#54)
// ═══════════════════════════════════════════════════════════════════════════

// На доске числа 1…N; за ход стирают три числа, сумма которых меньше T и не совпадает
// ни с одной суммой, стёртой раньше. Если сделано k ходов, то стёрто 3k чисел, а их
// общая сумма не меньше 1 + 2 + … + 3k = 3k(3k+1)/2. С другой стороны, k сумм попарно
// различны и не превосходят T − 1, поэтому их сумма не больше (T−1) + (T−2) + … + (T−k).
// Из 3k(3k+1)/2 ≤ k(2T − 1 − k)/2 получается верхняя граница на число ходов.
function eraseTriplesMax(N, T) {
  let best = 0
  for (let k = 1; 3 * k <= N; k++) {
    const lo = 3 * k * (3 * k + 1) / 2
    let hi = 0
    for (let i = 0; i < k; i++) hi += T - 1 - i
    if (lo <= hi) best = k
  }
  return best
}
// Явный набор из k троек: поиск с возвратом по наименьшим числам, с ограничением
// числа шагов и кэшем — иначе на некоторых (N, T) перебор уходит в долгий обход.
const ERASE_CACHE = new Map()
function eraseTriplesBuild(N, T, k) {
  const key = `${N}|${T}|${k}`
  if (ERASE_CACHE.has(key)) return ERASE_CACHE.get(key)
  const pool = Array.from({ length: Math.min(N, 3 * k + 3) }, (_, i) => i + 1)
  let found = null, steps = 0
  const rec = (rest, triples, used) => {
    if (found || steps > 200000) return
    if (triples.length === k) { found = triples.map((t) => [...t]); return }
    if (rest.length < 3) return
    const [a, ...tail] = rest
    for (let i = 0; i < tail.length && !found; i++) {
      for (let j = tail.length - 1; j > i && !found; j--) {      // крупные суммы вперёд
        steps++
        if (steps > 200000) return
        const s = a + tail[i] + tail[j]
        if (s >= T || used.has(s)) continue
        used.add(s)
        rec(tail.filter((_, x) => x !== i && x !== j), [...triples, [a, tail[i], tail[j]]], used)
        used.delete(s)
      }
    }
  }
  rec(pool, [], new Set())
  ERASE_CACHE.set(key, found)
  return found
}

export function t19EraseTriples() {
  const N = pick([30, 27, 33])
  // Порог 35 — единственный из проверенных, где верхняя оценка ДОСТИЖИМА: при 32
  // формула обещает 6 ходов, но поиск (20 млн шагов) находит только 5, а при 38
  // недостижимы обещанные 7. Заявлять недостижимую оценку нельзя.
  const T = 35
  const kMax = eraseTriplesMax(N, T)
  if (kMax < 4) return null
  const full = eraseTriplesBuild(N, T, kMax)
  if (!full) return null
  const Ka = Math.max(3, kMax - 1)                          // пример на Ka ходов
  const exA = full.slice(0, Ka)
  const Kb = Math.floor(N / 3)                              // «можно ли стереть всё» — нет
  if (Kb <= kMax) return null

  const params = { N, T, kMax, Ka, Kb }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || !cfg.length) return "нет ходов"
    const seen = new Set(), usedNums = new Set()
    for (const t of cfg) {
      if (!Array.isArray(t) || t.length !== 3) return "за ход стирают ровно три числа"
      for (const v of t) {
        if (!Number.isInteger(v) || v < 1 || v > N) return `${v} — не число с доски`
        if (usedNums.has(v)) return `число ${v} стирают дважды`
        usedNums.add(v)
      }
      const s = sum(t)
      if (s >= T) return `сумма ${t.join(" + ")} = ${s} не меньше ${T}`
      if (seen.has(s)) return `сумма ${s} уже встречалась`
      seen.add(s)
    }
    const need = part === "a" ? Ka : kMax
    if (cfg.length !== need) return `ходов ${cfg.length}, а нужно ${need}`
    return null
  }
  // Независимый проход: верхняя граница по неравенству сумм и явное построение набора.
  const solve = (P) => {
    const top = eraseTriplesMax(P.N, P.T)
    return {
      a: !!eraseTriplesBuild(P.N, P.T, P.Ka),
      b: P.Kb <= top,
      c: top,
      c_next: false,
    }
  }

  const showTriples = (ts) => ts.map((t) => `${t.join(" + ")} = ${sum(t)}`).join("; ")
  return item({
    preamble: `На доске написаны числа 1, 2, 3, …, ${N}. За один ход разрешается стереть произвольные три числа, сумма которых меньше ${T} и отлична от каждой из сумм троек чисел, стёртых на предыдущих ходах.`,
    qa: `Приведите пример последовательных ${Ka} ходов.`,
    qb: `Можно ли сделать ${Kb} ${plural(Kb, "ход", "хода", "ходов")}?`,
    qc: `Какое наибольшее число ходов можно сделать?`,
    ansA: `${showTriples(exA)}`,
    ansB: `нет: за ${Kb} ходов было бы стёрто ${3 * Kb} ${plural(3 * Kb, "число", "числа", "чисел")}, то есть все числа доски, и сумма стёртого равна ${N * (N + 1) / 2}. Но ${Kb} различных сумм, каждая меньше ${T}, дают в сумме не больше ${(() => { let h = 0; for (let i = 0; i < Kb; i++) h += T - 1 - i; return h })()} — меньше, чем ${N * (N + 1) / 2}`,
    ansC: `${kMax}; например ${showTriples(full)}`,
    solution: `Пусть сделано k ходов. Тогда стёрто 3k различных чисел с доски, поэтому их сумма не меньше 1 + 2 + … + 3k = ${"3k(3k+1)/2"}. С другой стороны, суммы троек попарно различны и меньше ${T}, поэтому их общая сумма не больше ${T - 1} + ${T - 2} + … + (${T} − k).\nИз неравенства 3k(3k + 1)/2 ≤ k(2·${T} − 1 − k)/2 получаем k ≤ ${kMax}.\nа) Пример ${Ka} ходов: ${showTriples(exA)}.\nб) При k = ${Kb} левая часть равна ${N * (N + 1) / 2}, а правая — ${(() => { let h = 0; for (let i = 0; i < Kb; i++) h += T - 1 - i; return h })()}, поэтому столько ходов сделать нельзя.\nв) Значение ${kMax} достигается: ${showTriples(full)}.\nОтвет: ${kMax}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `moves-${Ka}` },
        b: { type: "yesno", yes: false, reason: "sum-bound", target: `moves-${Kb}` },
        c: { type: "extremum", mode: "max", value: kMax, example: full },
      },
      mustMention: [N, T, Ka, Kb, 1, 2, 3],
      extra: [],
      phrases: ["стереть произвольные три числа", "отлична от каждой из сумм"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 13 (продолжение). Пара чисел: (a+b, 2a−1) или (a+b, 2b−1) (#83)
// ═══════════════════════════════════════════════════════════════════════════

// Ход заменяет пару (a, b) на (a + b, 2a − 1) либо на (a + b, 2b − 1). Если d = a − b,
// то новая разность равна 1 − d или d + 1, поэтому МОДУЛЬ разности меняется ровно на
// единицу: |d| → |d| ± 1 (из |d| = v получаются |1 − v| = v − 1 и v + 1). Отсюда:
// • чётность |d| меняется каждый ход, и после n ходов |d| ≡ |d₀| + n (mod 2);
// • равные числа (|d| = 0) запрещены, поэтому минимальная разность после нечётного
//   числа ходов равна 2, а после чётного — 1.
// Кроме того меньшее из чисел не убывает и растёт не медленнее, чем a → 2a − 1,
// то есть после n ходов оба числа не меньше 2ⁿ + 1 — этим закрывается пункт «нет».
export function t19PairMoves() {
  const start = [2, 3]
  // а) достижимое число: гоняем цепочку (a, b) → (a+b, 2·min−1)
  const chain = [[...start]]
  let cur = [...start]
  for (let i = 0; i < 5; i++) {
    const [a, b] = cur
    cur = [a + b, 2 * Math.min(a, b) - 1].sort((x, y) => x - y)
    chain.push([...cur])
  }
  const targetA = chain[3][1]                                // число после трёх ходов
  const movesB = pick([100, 150, 200])
  const targetB = pick([400, 500, 640])                      // недостижимо: 2^n + 1 больше
  const movesC = pick([513, 401, 621])                       // нечётное число ходов
  const minDiff = (Math.abs(start[0] - start[1]) + movesC) % 2 === 0 ? 2 : 1

  const params = { start, targetA, movesB, targetB, movesC, minDiff }
  const check = (cfg, part) => {
    if (!Array.isArray(cfg) || !cfg.length) return "нет последовательности ходов"
    // числа растут как 2ⁿ, поэтому ходы моделируются в BigInt
    let pair = start.map(BigInt)
    for (const mv of cfg) {
      if (!Array.isArray(mv) || mv.length !== 2) return "ход задаётся парой чисел"
      const a = BigInt(mv[0]), b = BigInt(mv[1])
      const same = (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a)
      if (!same) return `на доске ${pair.join(" и ")}, а ход сделан числами ${mv.join(" и ")}`
      pair = [a + b, 2n * a - 1n]
    }
    if (part === "a" && !pair.includes(BigInt(targetA))) return `на доске ${pair.join(" и ")}, числа ${targetA} нет`
    if (part === "c") {
      if (cfg.length !== movesC) return `ходов ${cfg.length}, а нужно ${movesC}`
      const d = pair[0] > pair[1] ? pair[0] - pair[1] : pair[1] - pair[0]
      if (d !== BigInt(minDiff)) return `разность ${d}, а заявлено ${minDiff}`
    }
    return null
  }
  // Независимый проход: пункт а) — поиск в ширину по парам с небольшими числами;
  // пункт б) — оценка снизу на меньшее число (оно не меньше 2ⁿ + 1);
  // пункт в) — динамика по достижимым значениям |d| при запрете нулевой разности.
  const solve = (P) => {
    const seen = new Set()
    let frontier = [[...P.start]]
    let aOk = false
    for (let step = 0; step < 8 && !aOk; step++) {
      const next = []
      for (const [a, b] of frontier) {
        for (const nb of [2 * a - 1, 2 * b - 1]) {
          const pr = [a + b, nb]
          if (pr.includes(P.targetA)) aOk = true
          const key = pr.join(",")
          if (!seen.has(key) && Math.max(...pr) < 5000) { seen.add(key); next.push(pr) }
        }
      }
      frontier = next
    }
    // меньшее число после n ходов: mₙ ≥ 2mₙ₋₁ − 1
    let low = Math.min(...P.start)
    let bOk = false
    for (let i = 0; i < P.movesB; i++) {
      low = 2 * low - 1
      if (low > P.targetB * 4) break
    }
    if (low <= P.targetB) bOk = true
    // достижимые |d| без нулей
    let ds = new Set([Math.abs(P.start[0] - P.start[1])])
    for (let i = 0; i < P.movesC; i++) {
      const nx = new Set()
      for (const v of ds) {
        if (v - 1 > 0) nx.add(v - 1)
        if (v + 1 <= P.movesC + 2) nx.add(v + 1)
      }
      ds = nx
    }
    return { a: aOk, b: bOk, c: ds.size ? Math.min(...ds) : -1, c_next: false }
  }

  const exA = []
  {
    let pair = [...start]
    for (let i = 0; i < 3; i++) {
      const [a, b] = pair[0] <= pair[1] ? pair : [pair[1], pair[0]]
      exA.push([a, b])
      pair = [a + b, 2 * a - 1]
    }
  }
  // Ходы для пункта в): на каждом шаге выбираем то из двух чисел, удвоение которого
  // даёт нужный модуль разности (чередуем minDiff и minDiff + 1, ноль запрещён).
  // Ходы для пункта в): на каждом шаге выбираем то из двух чисел, удвоение которого
  // даёт нужный модуль разности (чередуем minDiff и minDiff + 1, ноль запрещён).
  // Сами числа огромны (порядка 2ⁿ), поэтому считаем их в BigInt.
  const exC = []
  {
    let pair = start.map(BigInt)
    const absDiff = (p) => (p[0] > p[1] ? p[0] - p[1] : p[1] - p[0])
    for (let i = 0; i < movesC; i++) {
      const want = BigInt((movesC - i) % 2 === 1 ? minDiff : minDiff + 1)
      const [x, y] = pair
      const opts = [{ a: x, b: y }, { a: y, b: x }].map((o) => ({ ...o, d: absDiff([o.a + o.b, 2n * o.a - 1n]) }))
      const pickOpt = opts.find((o) => o.d === want && o.d > 0n) || opts.find((o) => o.d > 0n)
      exC.push([pickOpt.a, pickOpt.b])
      pair = [pickOpt.a + pickOpt.b, 2n * pickOpt.a - 1n]
    }
  }

  return item({
    preamble: `На доске написаны числа ${start[0]} и ${start[1]}. За один ход два числа a и b, записанные на доске, заменяются на два числа: или a + b и 2a − 1, или a + b и 2b − 1 (например, из чисел ${start[0]} и ${start[1]} можно получить либо ${start[0] + start[1]} и ${2 * start[0] - 1}, либо ${start[0] + start[1]} и ${2 * start[1] - 1}).`,
    qa: `Приведите пример последовательности ходов, после которых одно из двух чисел, написанных на доске, окажется числом ${targetA}.`,
    qb: `Может ли после ${movesB} ходов одно из двух чисел, написанных на доске, оказаться числом ${targetB}?`,
    qc: `Сделали ${movesC} ${plural(movesC, "ход", "хода", "ходов")}, причём на доске никогда не было написано одновременно двух равных чисел. Какое наименьшее значение может принимать разность большего и меньшего из полученных чисел?`,
    ansA: `${chain.slice(0, 4).map((p) => p.join(" и ")).join(" → ")}`,
    ansB: `нет: меньшее из двух чисел не убывает, а после хода оно не меньше 2m − 1, где m — прежнее меньшее. Начиная с ${Math.min(...start)}, после n ходов оба числа не меньше 2ⁿ + 1, поэтому уже после десяти ходов они больше ${targetB}, а ходов ${movesB}`,
    ansC: `${minDiff}`,
    solution: `Обозначим d = a − b. После хода получается пара (a + b, 2a − 1) или (a + b, 2b − 1), и её разность равна (a + b) − (2a − 1) = 1 − d или (a + b) − (2b − 1) = d + 1. Значит модуль разности меняется ровно на единицу: |d| → |d| ± 1.\nа) ${chain.slice(0, 4).map((p) => p.join(" и ")).join(" → ")} — получилось число ${targetA}.\nб) Меньшее число не убывает: из пары (a, b) с a ≤ b получаются числа a + b и 2a − 1 (или 2b − 1), и оба не меньше 2a − 1. Значит после n ходов числа не меньше 2ⁿ + 1, что при ${movesB} ходах несравнимо больше ${targetB}.\nв) Вначале |d| = ${Math.abs(start[0] - start[1])}, за каждый ход модуль разности меняется на единицу, поэтому после ${movesC} ходов он имеет ту же чётность, что и ${Math.abs(start[0] - start[1])} + ${movesC}. Нулевая разность запрещена условием, поэтому наименьшее возможное значение равно ${minDiff}; оно достигается, если чередовать ходы, переводящие |d| между ${minDiff} и ${minDiff + 1}.\nОтвет: ${minDiff}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: `num-${targetA}` },
        b: { type: "yesno", yes: false, reason: "exponential-growth", target: `num-${targetB}` },
        c: { type: "extremum", mode: "min", value: minDiff, example: exC },
      },
      mustMention: [start[0], start[1], start[0] + start[1], 2 * start[0] - 1, 2 * start[1] - 1, targetA, movesB, targetB, movesC, 1, 2],
      extra: [],
      phrases: ["заменяются на два числа", "двух равных чисел"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 13 (окончание). Дети по кругу отдают четверть конфет (#117)
// ═══════════════════════════════════════════════════════════════════════════

// Каждый отдаёт соседу справа четверть своих конфет, поэтому у ребёнка становится
// (3/4)x + (1/4)·(конфеты левого соседа). Условия «после хода девочки сравнялись» и
// «мальчики стали различны» дают жёсткое ограничение:
// • если у двух девочек слева стоят мальчики, то из 3d + M = 4C оба d равны — значит
//   девочка, стоящая сразу за мальчиком, ровно одна;
// • если у двух мальчиков слева мальчики, то после хода они равны — значит мальчик,
//   стоящий за мальчиком, тоже ровно один.
// По кругу число переходов «мальчик → девочка» равно числу переходов «девочка →
// мальчик», поэтому мальчиков не больше двух, а девочек не меньше двух.
// Значит расстановка одна: два мальчика подряд, затем все девочки.
function candyCircle(g, S) {
  const out = []
  for (let M = 4; M <= S && !out.length; M += 4) {
    for (let C = 1; C <= S; C++) {
      const d = []
      let prev = M, ok = true
      for (let i = 0; i < g; i++) {
        const di = (4 * C - prev) / 3
        if (!Number.isInteger(di) || di <= 0 || di % 4 !== 0) { ok = false; break }
        d.push(di); prev = di
      }
      if (!ok) continue
      const m1 = (3 * M + d[g - 1]) / 4
      if (!Number.isInteger(m1) || m1 === M) continue
      if (uniq(d).length !== g) continue
      if (2 * M + sum(d) === S) out.push({ M, C, d })
    }
  }
  return out
}

export function t19CandyCircle() {
  const S = pick([328, 400, 440])   // суммы, для которых расстановка существует
  const gC = 4                                              // девочек вдвое больше, чем мальчиков
  const solC = candyCircle(gC, S)
  if (!solC.length) return null
  const { M: Mc, d: dc } = solC[0]
  // а) поровну мальчиков и девочек: два и два
  const solA = (() => {
    for (let M = 4; M <= 4000; M += 4) {
      for (let C = 1; C <= 2000; C++) {
        const d1 = (4 * C - M) / 3
        if (!Number.isInteger(d1) || d1 <= 0 || d1 % 4) continue
        const d2 = (4 * C - d1) / 3
        if (!Number.isInteger(d2) || d2 <= 0 || d2 % 4 || d2 === d1) continue
        const m1 = (3 * M + d2) / 4
        if (!Number.isInteger(m1) || m1 === M) continue
        return { M, C, d: [d1, d2] }
      }
    }
    return null
  })()
  if (!solA) return null

  const params = { S, gC }
  const ring = (M, d) => [M, M, ...d]                        // М М Д Д … по кругу
  const checkRing = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.vals) || !Array.isArray(cfg.isBoy)) return "нет расстановки по кругу"
    const n = cfg.vals.length
    if (n !== cfg.isBoy.length || n < 4) return "по кругу должно стоять не меньше четырёх детей"
    for (const v of cfg.vals) {
      if (!Number.isInteger(v) || v < 1) return `${v} — не натуральное число конфет`
      if (v % 4) return `${v} не делится на 4, значит отдана не натуральная четверть`
    }
    const boys = cfg.vals.filter((_, i) => cfg.isBoy[i])
    const girls = cfg.vals.filter((_, i) => !cfg.isBoy[i])
    if (boys.length < 2 || girls.length < 2) return "должно быть хотя бы два мальчика и хотя бы две девочки"
    if (uniq(boys).length !== 1) return "до раздачи у всех мальчиков должно быть поровну конфет"
    if (uniq(girls).length !== girls.length) return "до раздачи у девочек количества должны быть различны"
    const after = cfg.vals.map((v, i) => (3 * v + cfg.vals[(i - 1 + n) % n]) / 4)
    const boysAfter = after.filter((_, i) => cfg.isBoy[i])
    const girlsAfter = after.filter((_, i) => !cfg.isBoy[i])
    if (uniq(boysAfter).length !== boysAfter.length) return "после раздачи у мальчиков количества должны быть различны"
    if (uniq(girlsAfter).length !== 1) return "после раздачи у всех девочек должно стать поровну"
    if (part === "a" && boys.length !== girls.length) return `мальчиков ${boys.length}, девочек ${girls.length} — нужно поровну`
    if (part === "c") {
      if (girls.length !== 2 * boys.length) return "девочек должно быть вдвое больше, чем мальчиков"
      if (sum(cfg.vals) !== S) return `всего конфет ${sum(cfg.vals)}, а нужно ${S}`
    }
    return null
  }
  // Независимый перебор: расстановка по кругу однозначна (два мальчика подряд, затем
  // девочки), количества восстанавливаются из уравнений 3dᵢ + dᵢ₋₁ = 4C.
  const solve = (P) => ({
    a: (() => {
      for (let M = 4; M <= 4000; M += 4) {
        for (let C = 1; C <= 2000; C++) {
          const d1 = (4 * C - M) / 3
          if (!Number.isInteger(d1) || d1 <= 0 || d1 % 4) continue
          const d2 = (4 * C - d1) / 3
          if (!Number.isInteger(d2) || d2 <= 0 || d2 % 4 || d2 === d1) continue
          const m1 = (3 * M + d2) / 4
          if (Number.isInteger(m1) && m1 !== M) return true
        }
      }
      return false
    })(),
    b: false,                                                // мальчиков не больше двух, девочек не меньше двух
    c: candyCircle(P.gC, P.S).length > 0,
  })

  const exA = { vals: ring(solA.M, solA.d), isBoy: [true, true, false, false] }
  const exC = { vals: ring(Mc, dc), isBoy: [true, true, false, false, false, false] }
  return item({
    preamble: `По кругу стоят несколько детей, среди которых есть хотя бы два мальчика и хотя бы две девочки. У каждого из детей есть натуральное число конфет. У любых двух мальчиков одинаковое количество конфет, а у любых двух девочек — разное. По команде каждый отдал соседу справа четверть всех своих конфет. После этого у любых двух мальчиков стало разное количество конфет, а у любых двух девочек — одинаковое. Известно, что каждый отдал натуральное число конфет.`,
    qa: `Могло ли мальчиков быть столько же, сколько и девочек?`,
    qb: `Могло ли мальчиков быть больше, чем девочек?`,
    qc: `Пусть девочек вдвое больше, чем мальчиков. Может ли у всех детей суммарно быть ${S} ${plural(S, "конфета", "конфеты", "конфет")}?`,
    ansA: `да, например по кругу стоят мальчики с ${solA.M} ${plural(solA.M, "конфетой", "конфетами", "конфетами")} и девочки с ${solA.d.join(" и ")} ${plural(solA.d[1], "конфетой", "конфетами", "конфетами")}: после раздачи у мальчиков ${(3 * solA.M + solA.d[1]) / 4} и ${solA.M}, а у обеих девочек по ${solA.C}`,
    ansB: `нет: если у двух девочек слева стоят мальчики, то из 3d + M = 4C эти девочки имели поровну конфет, что запрещено, — значит девочка, стоящая сразу за мальчиком, ровно одна. Точно так же мальчик, стоящий сразу за мальчиком, ровно один, иначе после раздачи у двух мальчиков стало бы поровну. По кругу переходов «мальчик → девочка» столько же, сколько «девочка → мальчик», поэтому мальчиков не больше двух, а девочек не меньше двух`,
    ansC: `да, например ${exC.vals.join(", ")} (первые двое — мальчики): после раздачи у мальчиков ${(3 * Mc + dc[dc.length - 1]) / 4} и ${Mc}, а у всех девочек по ${solC[0].C}; всего конфет ${sum(exC.vals)}`,
    solution: `После команды у ребёнка становится (3/4)x + (1/4)y, где y — конфеты левого соседа.\nЕсли слева от девочки стоит мальчик, то 3d + M = 4C, и такое d определено однозначно — значит девочка, стоящая сразу за мальчиком, ровно одна. Аналогично мальчик, стоящий сразу за мальчиком, ровно один (иначе после раздачи у двух мальчиков поровну). Так как по кругу переходов «мальчик → девочка» и «девочка → мальчик» поровну, мальчиков ровно два, и стоят они рядом.\nа) Пример: ${exA.vals.join(", ")} (первые двое — мальчики).\nб) Мальчиков не больше двух, а девочек не меньше двух, поэтому мальчиков больше быть не может.\nв) При двух мальчиках и четырёх девочках количества восстанавливаются из уравнений 3dᵢ + dᵢ₋₁ = 4C; подходит набор ${exC.vals.join(", ")} с суммой ${sum(exC.vals)}.\nОтвет: да; нет; да.`,
    verify: {
      params, check: checkRing, solve,
      claims: {
        a: { type: "yesno", yes: true, example: exA, target: "equal-counts" },
        b: { type: "yesno", yes: false, reason: "at-most-two-boys", target: "more-boys" },
        c: { type: "yesno", yes: true, example: exC, target: `sum-${S}` },
      },
      mustMention: [S],
      extra: [],
      phrases: ["четверть всех своих конфет", "хотя бы два мальчика"],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 15. Сравнение групп: мальчики и девочки за грибами (#44)
// ═══════════════════════════════════════════════════════════════════════════

// M мальчиков и F девочек. Условия: любые p девочек набрали больше, чем любые q
// мальчиков, и любые r мальчиков — больше, чем любые s девочек. В терминах
// упорядоченных наборов это два неравенства:
//   (сумма p наименьших девочек) > (сумма q наибольших мальчиков),
//   (сумма r наименьших мальчиков) > (сумма s наибольших девочек).
// Из них следует, что КАЖДЫЙ мальчик набрал меньше КАЖДОЙ девочки: иначе, оценивая
// суммы через наименьшие элементы, получаем противоречие. Минимальная суммарная
// величина ищется перебором «все мальчики по b, все девочки по G»: неравенства
// превращаются в pG > qb и rb > sG, а внутри групп выравнивание оптимально.
export function t19MushroomGroups() {
  const M = 10, F = 7
  const [p, q, r, s] = [2, 3, 5, 3]
  let best = null
  for (let b = 1; b <= 400 && !best; b++) {
    for (let G = 1; G <= 600; G++) {
      if (!(p * G > q * b)) continue
      if (!(r * b > s * G)) continue
      const total = M * b + F * G
      if (!best || total < best.total) best = { b, G, total }
    }
  }
  if (!best) return null
  // б) пример, где все значения различны
  let distinct = null
  for (let b5 = 40; b5 <= 200 && !distinct; b5++) {
    const bs = Array.from({ length: M }, (_, i) => b5 - 4 + i)
    const lo = Math.floor((q * b5 + 11) / p) + 1
    for (let g1 = lo; g1 <= lo + 400 && !distinct; g1++) {
      const gs = Array.from({ length: F }, (_, i) => g1 + i)
      const c1 = sum(gs.slice(0, p)) > sum(bs.slice(M - q))
      const c2 = sum(bs.slice(0, r)) > sum(gs.slice(F - s))
      if (c1 && c2 && bs[M - 1] < gs[0]) distinct = { bs, gs }
    }
  }
  if (!distinct) return null

  const params = { M, F, p, q, r, s, best: best.total }
  const check = (cfg, part) => {
    if (!cfg || !Array.isArray(cfg.boys) || !Array.isArray(cfg.girls)) return "нет набора"
    if (cfg.boys.length !== M || cfg.girls.length !== F) return `должно быть ${M} мальчиков и ${F} девочек`
    for (const v of [...cfg.boys, ...cfg.girls]) if (!Number.isInteger(v) || v < 0) return `${v} — не целое неотрицательное количество грибов`
    const bs = cfg.boys.slice().sort((a, b) => a - b)
    const gs = cfg.girls.slice().sort((a, b) => a - b)
    if (!(sum(gs.slice(0, p)) > sum(bs.slice(M - q)))) return `нарушено условие: любые ${p} девочки должны набрать больше любых ${q} мальчиков`
    if (!(sum(bs.slice(0, r)) > sum(gs.slice(F - s)))) return `нарушено условие: любые ${r} мальчиков должны набрать больше любых ${s} девочек`
    if (part === "b") {
      const all = [...cfg.boys, ...cfg.girls]
      if (uniq(all).length !== all.length) return "в пункте б) все количества должны быть различны"
    }
    if (part === "c" && sum([...cfg.boys, ...cfg.girls]) !== best.total) return `всего грибов ${sum([...cfg.boys, ...cfg.girls])}, а заявлено ${best.total}`
    return null
  }
  // Независимый перебор: минимум ищется по уровням b и G (внутри групп выравнивание
  // не ухудшает неравенств), существование «все различны» — прямым построением.
  const solve = (P) => {
    let top = null
    for (let b = 1; b <= 400; b++) {
      for (let G = 1; G <= 600; G++) {
        if (P.p * G > P.q * b && P.r * b > P.s * G) {
          const t = P.M * b + P.F * G
          if (top === null || t < top) top = t
        }
      }
    }
    return { a: false, b: !!distinct, c: top, c_next: false }
  }

  const exB = { boys: distinct.bs, girls: distinct.gs }
  const exC = { boys: Array(M).fill(best.b), girls: Array(F).fill(best.G) }
  return item({
    preamble: `${M} мальчиков и ${F} девочек пошли в лес за грибами. Известно, что любые ${p} девочки набрали больше грибов, чем любые ${q} мальчика, но любые ${r} мальчиков набрали больше грибов, чем любые ${s} девочки.`,
    qa: `Может ли так случиться, что какая-то девочка набрала меньше грибов, чем какой-нибудь мальчик?`,
    qb: `Может ли так случиться, что количество найденных грибов у всех детей будет различным?`,
    qc: `Найдите минимальное возможное количество грибов, собранное всеми детьми суммарно.`,
    ansA: `нет: пусть b — наибольшее количество грибов у мальчика, а g — наименьшее у девочки. Из условия «любые ${r} мальчиков больше любых ${s} девочек» наименьшие мальчики в сумме больше ${s} наибольших девочек, поэтому мальчики не могут быть слишком малы; подставляя эту оценку в первое условие («любые ${p} девочки больше любых ${q} мальчиков»), получаем b < g. Значит каждый мальчик набрал меньше каждой девочки`,
    ansB: `да, например мальчики набрали ${distinct.bs.join(", ")}, а девочки — ${distinct.gs.join(", ")}: ${sum(distinct.gs.slice(0, p))} > ${sum(distinct.bs.slice(M - q))} и ${sum(distinct.bs.slice(0, r))} > ${sum(distinct.gs.slice(F - s))}`,
    ansC: `${best.total}; например каждый мальчик набрал по ${best.b} ${plural(best.b, "грибу", "гриба", "грибов")}, а каждая девочка — по ${best.G}`,
    solution: `Упорядочим количества грибов. Условия означают, что сумма ${p} наименьших у девочек больше суммы ${q} наибольших у мальчиков, и сумма ${r} наименьших у мальчиков больше суммы ${s} наибольших у девочек.\nа) Из второго условия ${r}·(наименьший мальчик) не меньше суммы ${r} наименьших мальчиков, которая больше ${s}·(наибольшая девочка) — отсюда мальчики не могут быть слишком малы. Подставляя это в первое условие, получаем, что наибольший мальчик меньше наименьшей девочки: каждый мальчик набрал меньше каждой девочки.\nб) Пример со всеми различными количествами: мальчики ${distinct.bs.join(", ")}, девочки ${distinct.gs.join(", ")}.\nв) Внутри каждой группы выгодно выровнять количества: если все мальчики набрали по b, а девочки по G, условия принимают вид ${p}G > ${q}b и ${r}b > ${s}G. Перебирая b, получаем наименьшую сумму ${M}b + ${F}G = ${best.total} при b = ${best.b} и G = ${best.G} (${p}·${best.G} = ${p * best.G} > ${q * best.b} и ${r}·${best.b} = ${r * best.b} > ${s * best.G}).\nОтвет: ${best.total}.`,
    verify: {
      params, check, solve,
      claims: {
        a: { type: "yesno", yes: false, reason: "boys-below-girls", target: "girl-less-than-boy" },
        b: { type: "yesno", yes: true, example: exB, target: "all-distinct" },
        c: { type: "extremum", mode: "min", value: best.total, example: exC },
      },
      mustMention: [M, F, p, q, r, s],
      extra: [],
      phrases: ["пошли в лес за грибами", "набрали больше грибов"],
    },
  })
}
