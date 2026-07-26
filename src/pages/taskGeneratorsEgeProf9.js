// Генераторы ЕГЭ математика ПРОФИЛЬ, задание №9 — задачи с прикладным содержанием.
//
// Эталон типажей: fipi_bank_ege_prof/typages_task09.md (PDF «Задачи №9» из
// ~/Desktop/Реп-во/ЕГЭ/Задачи — 71 страница, 142 строки #N/#N_ДЗ; docx-выгрузка ФИПИ
// «new/ЕГЭ_Профиль_Задание9_Прикладные_задачи.docx» — её подмножество, 84 строки).
//
// ФИЛОСОФИЯ: каждая задача строится ОТ ОТВЕТА. Сначала фиксируется «красивый» ответ
// (целое или короткая десятичная), затем под него подбираются параметры формулы так,
// чтобы он получался ТОЧНО: дискриминант — полный квадрат по построению, аргумент
// логарифма — точная степень основания, подкоренное — точный квадрат/куб. Внутри
// генератора ничего не решается численно и не округляется.
//
// ДВА НЕЗАВИСИМЫХ ПРЕДСТАВЛЕНИЯ у каждого объекта:
//   • строка условия, собранная из чисел параметров;
//   • verify.f — БУКВАЛЬНЫЙ вычислитель формулы РОВНО в том виде, как она напечатана
//     в условии (те же коэффициенты и те же единицы), плюс постановка вопроса
//     (rel/opt/dom/k). verify09() требует, чтобы ответ удовлетворял букве условия.
// Показ и математика собираются из ОДНИХ И ТЕХ ЖЕ чисел, поэтому разъехаться не могут.
//
// Формат ответа: число (целое или короткая десятичная с запятой), без единиц.

// ── базовые утилиты ────────────────────────────────────────────────────────
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const clean = (x) => Math.round(x * 1e9) / 1e9
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b] } return a || 1 }

// Русская запись числа: десятичная запятая, минус — U+2212.
function ru(x) {
  if (typeof x !== "number") return String(x)
  const s = Number.isInteger(x) ? String(x) : String(clean(x))
  return s.replace(".", ",").replace(/^-/, "−")
}
// Мат-токены рендера (см. renderTaskMath в src/utils.js).
const fT = (n, d) => `⟦f:${n}:${d}⟧`      // дробь столбиком
const rT = (x) => `⟦r:${x}⟧`               // корень
const supT = (x) => `⟦sup:${x}⟧`           // надстрочник
const supIn = (x) => `⁅${x}⁆`              // надстрочник ВНУТРИ дроби/корня
const subIn = (x) => `⦉${x}⦊`              // нижний индекс ВНУТРИ дроби/корня
const fIn = (n, d) => `⦃${n}¦${d}⦄`        // вложенная дробь
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻", "−": "⁻" }
const sup = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("")
const SUBD = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" }
const subU = (n) => String(n).split("").map((c) => SUBD[c] ?? c).join("")
// Дробь-коэффициент: 0,8 → 4/5 (несократимая, для показа столбиком).
function fracOf(x, maxDen = 1000) {
  for (let d = 1; d <= maxDen; d++) {
    const n = x * d
    if (Math.abs(n - Math.round(n)) < 1e-9) { const g = gcd(Math.round(n), d); return [Math.round(n) / g, d / g] }
  }
  return [x, 1]
}
// Склонение минут/секунд для «Период его полураспада составляет 3 минуты».
const minPlural = (n) => (n % 10 === 1 && n % 100 !== 11 ? "минуту"
  : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "минуты" : "минут")

// ============================================================================
// verify09 — независимая проверка задачи по БУКВЕ условия
// ============================================================================
// Блок verify объекта:
//   kind   "solve"  — неизвестная стоит внутри формулы;
//          "value"  — ответ и есть значение формулы;
//          "span"   — ответ — длина промежутка, где выполнено неравенство;
//          "pair"   — ответ — разность двух аргументов/значений;
//          "measure"— ответ — доля (или процент) времени, где выполнено неравенство.
//   f      буквальный вычислитель формулы в ЕДИНИЦАХ ФОРМУЛЫ;
//   rel    "eq" | "ge" | "le"  — требуемое соотношение f(x) с target;
//   target правая часть;
//   opt    "min" | "max" | null — «наименьшее/наибольшее» значение неизвестной;
//   dom    [lo, hi] — физически допустимый диапазон неизвестной (в единицах формулы);
//   k      ответ = x·k (перевод единиц: часы→минуты k=60, м→см k=100 и т.п.);
//   step   шаг сетки ответа (по умолчанию 10^−(число знаков после запятой));
//   unit   подстрока условия, задающая единицу/предмет вопроса — обязана в нём быть.
const relOk = (y, rel, target) => {
  const eps = Math.max(1e-9, Math.abs(target) * 1e-9)
  if (rel === "eq") return Math.abs(y - target) <= eps
  if (rel === "ge") return y >= target - eps
  if (rel === "le") return y <= target + eps
  return false
}
// Корни g на [lo;hi]: смена знака (уточняется делением пополам) + касание (локальный
// минимум |g|, лежащий на нуле) — иначе двойной корень был бы не найден.
function findRoots(g, lo, hi, N = 20000) {
  const roots = []
  const xs = [], ys = []
  for (let i = 0; i <= N; i++) {
    const x = lo + (hi - lo) * i / N
    let y
    try { y = g(x) } catch { y = NaN }
    xs.push(x); ys.push(y)
  }
  const scale = Math.max(1, ...ys.filter(Number.isFinite).map(Math.abs))
  for (let i = 0; i < N; i++) {
    const a = ys[i], b = ys[i + 1]
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    if (a === 0) { roots.push(xs[i]); continue }
    if (a * b < 0) {
      let l = xs[i], r = xs[i + 1]
      for (let s = 0; s < 60; s++) { const m = (l + r) / 2; const v = g(m); if (!Number.isFinite(v)) break; if (v * g(l) <= 0) r = m; else l = m }
      roots.push((l + r) / 2)
    } else if (i > 0 && Math.abs(a) < Math.abs(ys[i - 1]) && Math.abs(a) < Math.abs(b) && Math.abs(a) < 1e-7 * scale) {
      roots.push(xs[i])
    }
  }
  return roots
}

export function verify09(o) {
  const v = o && o.verify
  if (!v) return "нет блока verify"
  if (!o.condition_text || typeof o.condition_text !== "string") return "нет условия"
  if (typeof o.answer !== "string" || !o.answer.trim()) return "нет ответа"
  if (o.answer.includes(".")) return `в ответе точка вместо запятой: «${o.answer}»`
  if (o.answer.includes("-")) return `в ответе ASCII-дефис вместо U+2212: «${o.answer}»`
  if (!/^−?\d+(,\d+)?$/.test(o.answer)) return `ответ не число: «${o.answer}»`
  const dec = (o.answer.split(",")[1] || "").length
  if (dec > 3) return `ответ — длинная десятичная: «${o.answer}»`
  const ansNum = Number(o.answer.replace("−", "-").replace(",", "."))
  if (!Number.isFinite(ansNum)) return `ответ не число: «${o.answer}»`
  if (Math.abs(ansNum - v.ans) > 1e-9) return `ответ «${o.answer}» ≠ verify.ans=${v.ans}`
  if (v.pos !== false && ansNum <= 0) return `ответ не положителен: ${ansNum}`
  if (!v.unit || !o.condition_text.includes(v.unit)) return `в условии нет спрошенной единицы «${v.unit}»`
  const step = v.step ?? Math.pow(10, -dec)
  const k = v.k ?? 1
  const N = 20000

  if (v.kind === "value") {
    const y = v.f()
    if (!Number.isFinite(y)) return "формула не считается"
    if (Math.abs(y * k - ansNum) > 1e-9 * Math.max(1, Math.abs(ansNum))) return `формула даёт ${y * k}, а в ответе ${ansNum}`
    return null
  }

  if (v.kind === "pair") {
    for (const [x, y] of v.pts) {
      const got = v.f(x)
      if (!Number.isFinite(got)) return "формула не считается"
      if (Math.abs(got - y) > 1e-9 * Math.max(1, Math.abs(y))) return `f(${x}) = ${got} ≠ ${y}`
    }
    const d = v.combine === "dx"
      ? Math.abs(v.pts[1][0] - v.pts[0][0])
      : Math.abs(v.pts[1][1] - v.pts[0][1])
    if (Math.abs(d * k - ansNum) > 1e-9 * Math.max(1, Math.abs(ansNum))) return `разность ${d * k} ≠ ответу ${ansNum}`
    return null
  }

  if (v.kind === "measure") {
    const T = v.T, M = 200000
    let cnt = 0
    for (let i = 0; i < M; i++) {
      const t = T * (i + 0.5) / M
      if (v.cond(t)) cnt++
    }
    const share = cnt / M * (v.scale ?? 1)
    if (Math.abs(share - ansNum) > 3e-3 * (v.scale ?? 1)) return `доля по сетке ${clean(share)} ≠ ответу ${ansNum}`
    return null
  }

  // ── kind "solve" и "span" ────────────────────────────────────────────────
  const [lo, hi] = v.dom
  if (!(hi > lo)) return "пустая ОДЗ"
  if (lo < 0 && !v.allowNeg) return "ОДЗ допускает физически невозможные значения"

  if (v.kind === "span") {
    const [t1, t2] = v.pts
    for (const t of [t1, t2]) {
      const y = v.f(t)
      if (!relOk(y, "eq", v.target)) return `конец промежутка ${t}: f=${y} ≠ ${v.target}`
    }
    if (Math.abs((t2 - t1) * k - ansNum) > 1e-9 * Math.max(1, ansNum)) return `длина промежутка ${(t2 - t1) * k} ≠ ответу`
    let blocks = 0, prev = false, first = null, last = null
    for (let i = 0; i <= N; i++) {
      const x = lo + (hi - lo) * i / N
      let y
      try { y = v.f(x) } catch { y = NaN }
      const ok = Number.isFinite(y) && relOk(y, v.rel, v.target)
      if (ok && !prev) blocks++
      if (ok) { if (first === null) first = x; last = x }
      prev = ok
    }
    if (blocks !== 1) return `множество распалось на ${blocks} промежутков`
    const gridStep = (hi - lo) / N
    if (Math.abs(first - t1) > 2 * gridStep || Math.abs(last - t2) > 2 * gridStep) return `промежуток по сетке [${clean(first)};${clean(last)}] ≠ [${t1};${t2}]`
    return null
  }

  const x = ansNum / k
  if (!(x > lo - 1e-9 && x < hi + 1e-9)) return `ответ ${ansNum} вне ОДЗ [${lo};${hi}]`
  const y = v.f(x)
  if (!Number.isFinite(y)) return "формула не считается в точке ответа"
  if (!relOk(y, v.rel, v.target)) return `подстановка ответа: f=${clean(y)}, требуется ${v.rel} ${v.target}`

  // соседи по сетке ответа
  for (const s of [-step, step]) {
    const xn = (ansNum + s) / k
    const inDom = xn > lo - 1e-12 && xn < hi + 1e-12
    let yn = NaN
    if (inDom) { try { yn = v.f(xn) } catch { yn = NaN } }
    const ok = inDom && Number.isFinite(yn) && relOk(yn, v.rel, v.target)
    // при «наибольшее/наименьшее» второй корень с нужной стороны допустим — его отсекает opt
    const badSide = !v.opt || (v.opt === "max" && s > 0) || (v.opt === "min" && s < 0)
    if (v.rel === "eq" && ok && badSide) return `соседнее значение ${clean(ansNum + s)} тоже даёт равенство`
    if (v.opt === "min" && s < 0 && ok) return `${clean(ansNum + s)} тоже подходит — ответ не наименьший`
    if (v.opt === "max" && s > 0 && ok) return `${clean(ansNum + s)} тоже подходит — ответ не наибольший`
    if (v.rel !== "eq" && inDom && ((v.opt === "min" && s > 0) || (v.opt === "max" && s < 0)) && !ok) {
      return `${clean(ansNum + s)} не подходит — множество решений не примыкает к ответу`
    }
  }

  // скан по сетке: меньшего/большего подходящего значения нет
  const eps = Math.max(step / (2 * Math.abs(k)), (hi - lo) / N)
  if (v.opt && v.rel !== "eq") {
    for (let i = 0; i <= N; i++) {
      const xg = lo + (hi - lo) * i / N
      let yg
      try { yg = v.f(xg) } catch { continue }
      if (!Number.isFinite(yg) || !relOk(yg, v.rel, v.target)) continue
      if (v.opt === "min" && xg < x - eps) return `на сетке подходит меньшее ${clean(xg * k)}`
      if (v.opt === "max" && xg > x + eps) return `на сетке подходит большее ${clean(xg * k)}`
    }
  }
  // единственность корня (лишний корень обязан быть отсечён ОДЗ)
  if (v.rel === "eq") {
    const roots = findRoots((t) => v.f(t) - v.target, lo, hi, N)
    const foreign = roots.filter((r) => Math.abs(r - x) > Math.max(eps, 1e-6 * Math.max(1, Math.abs(x))))
    if (v.opt === "max" && foreign.some((r) => r > x)) return `в ОДЗ есть больший корень ${clean(foreign.find((r) => r > x) * k)}`
    if (v.opt === "min" && foreign.some((r) => r < x)) return `в ОДЗ есть меньший корень ${clean(foreign.find((r) => r < x) * k)}`
    if (!v.opt && foreign.length) return `в ОДЗ ещё один корень ${clean(foreign[0] * k)} — лишний корень не отсечён`
  }
  return null
}

// ============================================================================
// РАЗДЕЛ 1. Экономика и рейтинги (#1, #57–#60, #70, #71)
// ============================================================================

// #1 π(q)=q(p−ν)−f: найти объём производства по заданной прибыли.
export function t09Profit() {
  let nu = 0, margin = 0, q = 0, profit = 0, fix = 0
  for (let g = 0; g < 400; g++) {
    nu = pick([200, 250, 300, 400, 500])
    margin = pick([100, 150, 200, 250, 300, 400])
    q = 500 * randInt(2, 14)
    profit = 50000 * randInt(4, 18)
    fix = q * margin - profit
    if (fix >= 100000 && fix % 50000 === 0) break
    fix = 0
  }
  if (!fix) { nu = 400; margin = 200; q = 5500; profit = 500000; fix = 600000 }
  const p = nu + margin
  return {
    condition_text: `Некоторая компания продаёт свою продукцию по цене p=${p} руб. за единицу, переменные затраты на производство одной единицы продукции составляют ν=${nu} руб., постоянные расходы предприятия f=${fix} руб. в месяц. Месячная операционная прибыль предприятия (в рублях) вычисляется по формуле π(q)=q(p−ν)−f. Определите месячный объём производства q (единиц продукции), при котором месячная операционная прибыль предприятия будет равна ${profit} руб.`,
    answer: ru(q),
    verify: {
      kind: "solve", rel: "eq", target: profit, dom: [1, 1e6], ans: q, unit: "(единиц продукции)",
      f: (x) => x * (p - nu) - fix,
    },
  }
}

const MULT = { 2: "вдвое", 3: "втрое", 4: "вчетверо", 5: "впятеро" }

// #57 R=(aIn+Op+bTr)/A: найти A по рейтингу издания с наибольшими показателями.
export function t09Rating3() {
  const cIn = pick([3, 4, 5])
  const cTr = pick([2, 3, 4].filter((c) => c !== cIn))
  const M = pick([5, 6, 10])
  const S = (cIn + 1 + cTr) * M
  const cand = []
  for (let R = 1; R <= 60; R++) {
    const A = S / R
    if (Math.abs(A * 100 - Math.round(A * 100)) < 1e-9 && A >= 0.5 && A <= 100) cand.push([R, clean(A)])
  }
  const [R, A] = pick(cand)
  return {
    condition_text: `Независимое агентство намерено ввести рейтинг R новостных изданий на основе показателей информативности In, оперативности Op и объективности Tr публикаций. Каждый отдельный показатель — целое число от 1 до ${M}. Составители рейтинга считают, что информативность публикаций ценится ${MULT[cIn]}, а объективность — ${MULT[cTr]} дороже, чем оперативность, то есть R=${fT(`${cIn}In+Op+${cTr}Tr`, "A")}. Найдите, каким должно быть число A, чтобы издание, у которого все показатели наибольшие, получило рейтинг ${R}.`,
    answer: ru(A),
    verify: {
      kind: "solve", rel: "eq", target: R, dom: [0.01, 200], ans: A, unit: "число A",
      f: (a) => (cIn * M + M + cTr * M) / a,
    },
  }
}

// #58 R=(aIn+Op+bTr+Q)/A: при равных оценках рейтинг равен оценке → A = сумма коэффициентов.
export function t09Rating4() {
  const cIn = pick([3, 4, 5])
  const cTr = pick([2, 3, 4, 5].filter((c) => c !== cIn))
  const [lo, hi] = pick([[0, 4], [1, 5], [-2, 2], [0, 5]])
  const A = cIn + 1 + cTr + 1
  const z = hi
  return {
    condition_text: `Независимое агентство намерено ввести рейтинг новостных интернет-изданий на основе оценок информативности In, оперативности Op, объективности Tr публикаций, а также качества Q сайта. Каждый отдельный показатель — целое число от ${ru(lo)} до ${hi}. Составители рейтинга считают, что объективность ценится ${MULT[cTr]}, а информативность публикаций — ${MULT[cIn]} дороже, чем оперативность и качество сайта. Таким образом, формула приняла вид R=${fT(`${cIn}In+Op+${cTr}Tr+Q`, "A")}. Если по всем четырём показателям какое-то издание получило одну и ту же оценку, то рейтинг должен совпадать с этой оценкой. Найдите число A, при котором это условие будет выполняться.`,
    answer: ru(A),
    verify: {
      kind: "solve", rel: "eq", target: z, dom: [0.01, 200], ans: A, unit: "Найдите число A",
      f: (a) => (cIn * z + z + cTr * z + z) / a,
    },
  }
}

// #59 q=N−Bp, r=pq: наибольшая цена, при которой выручка РАВНА заданной.
export function t09DemandEq() {
  const B = pick([2, 4, 5, 10])
  const p2 = randInt(2, 10)
  const p1 = p2 + randInt(2, 10)
  const N = B * (p1 + p2)
  const R0 = B * p1 * p2
  return {
    condition_text: `Зависимость объёма спроса q (единиц в месяц) на продукцию предприятия-монополиста от цены p (тыс. руб.) задаётся формулой q=${N}−${B}p. Выручка предприятия за месяц r (тыс. руб.) вычисляется по формуле r(p)=pq. Определите наибольшую цену p, при которой месячная выручка r(p) составит ${R0} тыс. руб. Ответ приведите в тыс. руб.`,
    answer: ru(p1),
    verify: {
      kind: "solve", rel: "eq", target: R0, opt: "max", dom: [0, N / B], ans: p1, unit: "в тыс. руб.",
      f: (p) => p * (N - B * p),
    },
  }
}

// #60 q=N−Bp, r=pq: наибольшая цена при выручке НЕ МЕНЕЕ заданной (нестрогое).
export function t09DemandGe() {
  const B = pick([2, 4, 5, 10])
  const p2 = randInt(2, 10)
  const p1 = p2 + randInt(2, 10)
  const N = B * (p1 + p2)
  const R0 = B * p1 * p2
  return {
    condition_text: `Зависимость объёма спроса q (единиц в месяц) на продукцию предприятия-монополиста от цены p (тыс. руб.) задаётся формулой q=${N}−${B}p. Выручка предприятия за месяц r (в тыс. руб.) вычисляется по формуле r(p)=q·p. Определите наибольшую цену p, при которой месячная выручка r(p) составит не менее ${R0} тыс. руб. Ответ приведите в тыс. руб.`,
    answer: ru(p1),
    verify: {
      kind: "solve", rel: "ge", target: R0, opt: "max", dom: [0, N / B], ans: p1, unit: "в тыс. руб.",
      f: (p) => p * (N - B * p),
    },
  }
}

// #70/#71 R=rпок−(rпок−rэкс)/(K+1)^m, m=0,02K/(rпок+0,1) — вычислить рейтинг.
// Семейства подобраны так, что (K+1)^m — целое: показатель равен 1/2, 1/3 или 1.
const SHOP = [
  { K: 24, rp: 0.86, d: 5 },   // m = 0,5 → 25^0,5 = 5
  { K: 15, rp: 0.5, d: 4 },    // m = 0,5 → 16^0,5 = 4
  { K: 8, rp: 0.22, d: 3 },    // m = 0,5 → 9^0,5  = 3
  { K: 7, rp: 0.32, d: 2 },    // m = 1/3 → 8^(1/3)= 2
  { K: 19, rp: 0.28, d: 20 },  // m = 1   → 20
  { K: 24, rp: 0.38, d: 25 },  // m = 1   → 25
  { K: 29, rp: 0.48, d: 30 },  // m = 1   → 30
  { K: 35, rp: 0.6, d: 36 },   // m = 1   → 36
]
export function t09ShopRating() {
  let s = null, qv = 0, re = 0, R = 0
  for (let g = 0; g < 300; g++) {
    s = pick(SHOP)
    qv = pick([0.01, 0.02, 0.03, 0.05, 0.07, 0.1, -0.01, -0.02, -0.03, -0.05])
    const diff = clean(qv * s.d)
    re = clean(s.rp - diff)
    R = clean(s.rp - qv)
    if (re >= 0 && re <= 0.7 && R > 0 && R <= 1 && Math.abs(re * 100 - Math.round(re * 100)) < 1e-9) break
    s = null
  }
  if (!s) { s = SHOP[0]; qv = 0.07; re = 0.51; R = 0.79 }
  const { K, rp } = s
  const inline = Math.random() < 0.5
  const mFrac = fIn("0,02K", `r${subIn("пок")}+0,1`)
  const den = inline
    ? `(K+1)${supIn(mFrac)}`
    : `(K+1)${supIn("m")}`
  const formula = `R=r${subIn("пок")}−${fT(`r${subIn("пок")}−r${subIn("экс")}`, den)}`
  const mDef = inline
    ? ", где"
    : `, где m=${fT("0,02K", `r${subIn("пок")}+0,1`)},`
  return {
    condition_text: `Рейтинг R интернет-магазина вычисляется по формуле ${formula}${mDef} r${subIn("пок")} — средняя оценка магазина покупателями (от 0 до 1), r${subIn("экс")} — оценка магазина, данная экспертами (от 0 до 0,7), K — число покупателей, оценивших магазин. Найдите рейтинг интернет-магазина, если число покупателей, оценивших магазин, равно ${K}, их средняя оценка равна ${ru(rp)}, а оценка экспертов равна ${ru(re)}.`,
    answer: ru(R),
    verify: {
      kind: "value", ans: R, unit: "Найдите рейтинг интернет-магазина",
      f: () => rp - (rp - re) / Math.pow(K + 1, 0.02 * K / (rp + 0.1)),
    },
  }
}

// ============================================================================
// РАЗДЕЛ 2. Кинематика и квадратные уравнения (#2, #3, #5, #6, #8–#10, #23, #66)
// ============================================================================

// #2 φ=ωt+βt²/2 = φ₀ → время (квадратное уравнение, отрицательный корень отсечён).
export function t09Winding() {
  const w = pick([15, 20, 30, 40, 50])
  const b = pick([2, 4, 6, 8])
  const t = randInt(10, 40)
  const phi = w * t + b * t * t / 2
  return {
    condition_text: `Для сматывания кабеля на заводе используют лебёдку, которая равноускоренно наматывает кабель на катушку. Угол, на который поворачивается катушка, изменяется со временем по закону φ=ωt+${fT("βt²", 2)}, где t — время в минутах, прошедшее после начала работы лебёдки, ω=${w} град./мин — начальная угловая скорость вращения катушки, а β=${b} град./мин² — угловое ускорение, с которым наматывается кабель. Определите время, прошедшее после начала работы лебёдки, если известно, что за это время угол намотки φ достиг ${phi}°. Ответ дайте в минутах.`,
    answer: ru(t),
    verify: {
      kind: "solve", rel: "eq", target: phi, dom: [0, 500], ans: t, unit: "в минутах",
      f: (x) => w * x + b * x * x / 2,
    },
  }
}

// #2_ДЗ то же, но постановка нестрогая: «не позже того момента, когда φ достигнет φ₀».
export function t09WindingLe() {
  const w = pick([15, 20, 30, 40, 50])
  const b = pick([2, 4, 6, 8])
  const t = randInt(10, 40)
  const phi = w * t + b * t * t / 2
  return {
    condition_text: `Для сматывания кабеля на заводе используют лебедку, которая равноускоренно наматывает кабель на катушку. Угол, на который поворачивается катушка, изменяется со временем по закону φ=ωt+${fT("βt²", 2)}, где t — время в минутах, ω=${w}°/мин — начальная угловая скорость вращения катушки, а β=${b}°/мин² — угловое ускорение, с которым наматывается кабель. Рабочий должен проверить ход его намотки не позже того момента, когда угол намотки φ достигнет ${phi}°. Определите время после начала работы лебедки, не позже которого рабочий должен проверить её работу. Ответ выразите в минутах.`,
    answer: ru(t),
    verify: {
      kind: "solve", rel: "le", target: phi, opt: "max", dom: [0, 500], ans: t, unit: "в минутах",
      f: (x) => w * x + b * x * x / 2,
    },
  }
}

// #3 S=v₀t−at²/2 = S₀ → время торможения (второй корень — уже после остановки, отсечён ОДЗ).
export function t09Brake() {
  let v0 = 0, a = 0, t = 0, S = 0
  for (let g = 0; g < 400; g++) {
    a = pick([2, 3, 4, 5, 6])
    v0 = pick([20, 24, 30, 36, 40, 48])
    const stop = v0 / a
    if (stop < 4) continue
    t = randInt(2, Math.floor(stop) - 1)
    S = v0 * t - a * t * t / 2
    if (Number.isInteger(S) && S > 0) break
    S = 0
  }
  if (!S) { v0 = 24; a = 3; t = 6; S = 90 }
  return {
    condition_text: `Автомобиль, движущийся со скоростью v₀=${v0} м/с, начал торможение с постоянным ускорением a=${a} м/с². За t секунд после начала торможения он прошёл путь S=v₀t−${fT("at²", 2)} (м). Определите время, прошедшее с момента начала торможения, если известно, что за это время автомобиль проехал ${S} метров. Ответ дайте в секундах.`,
    answer: ru(t),
    verify: {
      kind: "solve", rel: "eq", target: S, dom: [0, v0 / a], ans: t, unit: "в секундах",
      f: (x) => v0 * x - a * x * x / 2,
    },
  }
}

// #3_ДЗ S=v₀t+at²/2 (км, км/ч) → время в МИНУТАХ (перевод единиц).
export function t09AccelMin() {
  let v0 = 0, a = 0, th = 0, S = 0
  for (let g = 0; g < 400; g++) {
    v0 = pick([50, 60, 70, 80, 90])
    a = pick([12, 16, 18, 24, 32, 40, 64])
    th = pick([0.25, 0.5, 0.75, 1, 1.25, 1.5])
    S = clean(v0 * th + a * th * th / 2)
    if (Number.isInteger(S)) break
    S = 0
  }
  if (!S) { v0 = 60; a = 18; th = 0.25; S = 15.5625; S = 0 }
  if (!S) { v0 = 60; a = 32; th = 0.5; S = 34 }
  return {
    condition_text: `Мотоциклист, движущийся по городу со скоростью v₀=${v0} км/ч, выезжает из него и сразу после выезда начинает разгоняться с постоянным ускорением a=${a} км/ч². Расстояние (в км) от мотоциклиста до города вычисляется по формуле S=v₀t+${fT("at²", 2)}, где t — время в часах, прошедшее после выезда из города. Определите время, прошедшее после выезда мотоциклиста из города, если известно, что за это время он удалился от города на ${S} км. Ответ дайте в минутах.`,
    answer: ru(clean(th * 60)),
    verify: {
      kind: "solve", rel: "eq", target: S, dom: [0, 24], ans: clean(th * 60), k: 60, unit: "в минутах",
      f: (x) => v0 * x + a * x * x / 2,
    },
  }
}

// #5 H(t)=at²+bt+H₀ = 0 → сколько времени вытекает вода (парабола касается нуля).
export function t09TankDrain() {
  const H0 = pick([3, 4, 5])
  const m = pick([6, 7, 8, 9, 10, 12])
  const T = 2 * H0 * m
  const n = 4 * H0 * m * m
  return {
    condition_text: `В боковой стенке высокого цилиндрического бака у самого дна закреплён кран. После его открытия вода начинает вытекать из бака, при этом высота столба воды в нём, выраженная в метрах, меняется по закону H(t)=at²+bt+H₀, где H₀=${H0} м — начальный уровень воды, a=${fT(1, n)} м/мин² и b=−${fT(1, m)} м/мин — постоянные, t — время в минутах, прошедшее с момента открытия крана. В течение какого времени вода будет вытекать из бака? Ответ приведите в минутах.`,
    answer: ru(T),
    verify: {
      kind: "solve", rel: "eq", target: 0, dom: [0, 3 * T], ans: T, unit: "в минутах",
      f: (t) => t * t / n - t / m + H0,
    },
  }
}

// #6 H=H₀−√(2gH₀)kt+(g/2)k²t² = H₀/4 → через сколько секунд останется четверть объёма.
export function t09TankQuarter() {
  let mm = 0, K = 0, t = 0
  for (let g = 0; g < 200; g++) {
    mm = pick([1, 2, 3, 4])
    K = pick([100, 200, 300, 400, 500, 600])
    t = mm * K / 2
    if (Number.isInteger(t)) break
    t = 0
  }
  if (!t) { mm = 1; K = 200; t = 100 }
  const H0 = 5 * mm * mm
  const tEmpty = Math.sqrt(2 * H0 / 10) * K
  return {
    condition_text: `В боковой стенке высокого цилиндрического бака у самого дна закреплён кран. После его открытия вода начинает вытекать из бака, при этом высота столба воды в нём, выраженная в метрах, меняется по закону H(t)=H₀−${rT("2gH₀")}kt+${fT("g", 2)}k²t², где t — время в секундах, прошедшее с момента открытия крана, H₀=${H0} м — начальная высота столба воды, k=${fT(1, K)} — отношение площадей поперечных сечений крана и бака, а g — ускорение свободного падения (считайте g=10 м/с²). Через сколько секунд после открытия крана в баке останется четверть первоначального объёма воды?`,
    answer: ru(t),
    verify: {
      kind: "solve", rel: "eq", target: H0 / 4, dom: [0, tEmpty], ans: t, unit: "Через сколько секунд",
      f: (x) => H0 - Math.sqrt(2 * 10 * H0) * (1 / K) * x + (10 / 2) * (1 / K) * (1 / K) * x * x,
    },
  }
}

// #8 S=v₀t+at²/2 ≤ S₀ → наибольшее время в зоне покрытия, ответ в МИНУТАХ.
export function t09CoverMax() {
  let v0 = 0, a = 0, th = 0, S = 0
  for (let g = 0; g < 400; g++) {
    v0 = pick([40, 45, 50, 57, 60, 72])
    a = pick([12, 16, 24, 32, 48, 64])
    th = pick([0.25, 0.5, 0.75, 1])
    S = clean(v0 * th + a * th * th / 2)
    if (Number.isInteger(S)) break
    S = 0
  }
  if (!S) { v0 = 57; a = 12; th = 0.5; S = 30 }
  return {
    condition_text: `Мотоциклист, движущийся по городу со скоростью v₀=${v0} км/ч, выезжает из него и сразу после выезда начинает разгоняться с постоянным ускорением a=${a} км/ч². Расстояние от мотоциклиста до города, измеряемое в километрах, определяется выражением S=v₀t+${fT("at²", 2)}. Определите наибольшее время, в течение которого мотоциклист будет находиться в зоне функционирования сотовой связи, если оператор гарантирует покрытие на расстоянии не далее чем в ${S} км от города. Ответ дайте в минутах.`,
    answer: ru(clean(th * 60)),
    verify: {
      kind: "solve", rel: "le", target: S, opt: "max", dom: [0, 10], ans: clean(th * 60), k: 60, unit: "в минутах",
      f: (x) => v0 * x + a * x * x / 2,
    },
  }
}

// #9 h=h₀+v₀t−5t² ≥ H → сколько секунд мяч выше H (длина промежутка).
export function t09BallSpan() {
  let h0 = 0, v0 = 0, H = 0, t1 = 0, t2 = 0
  for (let g = 0; g < 500; g++) {
    t1 = randInt(2, 12) / 10
    const D = randInt(4, 20) / 10
    t2 = clean(t1 + D)
    h0 = pick([1.2, 1.4, 1.6, 2, 2.5])
    v0 = clean(5 * (t1 + t2))
    H = clean(h0 + 5 * t1 * t2)
    if (Number.isInteger(v0) && Number.isInteger(H) && H > h0) break
    H = 0
  }
  if (!H) { h0 = 2; v0 = 13; H = 8; t1 = 0.6; t2 = 2 }
  const land = (v0 + Math.sqrt(v0 * v0 + 20 * h0)) / 10
  return {
    condition_text: `Высота над землёй подброшенного вверх мяча меняется по закону h(t)=${ru(h0)}+${v0}t−5t², где h — высота в метрах, t — время в секундах, прошедшее с момента броска. Сколько секунд мяч будет находиться на высоте не менее ${H} метров?`,
    answer: ru(clean(t2 - t1)),
    verify: {
      kind: "span", rel: "ge", target: H, dom: [0, land], pts: [t1, t2], ans: clean(t2 - t1),
      unit: "Сколько секунд", f: (t) => h0 + v0 * t - 5 * t * t,
    },
  }
}

// #10 y=ax²+bx: наибольшее расстояние от стены, чтобы камень прошёл над ней с запасом 1 м.
const CATAPULT = [[10, 30], [20, 30], [10, 40], [20, 40], [25, 40], [10, 50], [20, 50], [25, 60], [30, 50], [30, 60], [40, 50], [20, 60], [25, 80], [50, 60], [40, 70]]
export function t09Catapult() {
  let x1 = 0, x2 = 0, T = 0, b = 0
  for (let g = 0; g < 200; g++) {
    ;[x1, x2] = pick(CATAPULT)
    T = (x1 * x2) / 100
    b = (x1 + x2) / 100
    if (Number.isInteger(T) && T >= 3 && Math.abs(b - 1) > 1e-9) break
    T = 0
  }
  if (!T) { x1 = 30; x2 = 50; T = 15; b = 0.8 }
  const [bn, bd] = fracOf(b)
  const H = T - 1
  return {
    condition_text: `Камнемётательная машина выстреливает камни под некоторым острым углом к горизонту. Траектория полёта камня описывается формулой y=ax²+bx, где a=−${fT(1, 100)} м⁻¹, b=${fT(bn, bd)} — постоянные параметры, x (м) — смещение камня по горизонтали, y (м) — высота камня над землёй. На каком наибольшем расстоянии (в метрах) от крепостной стены высотой ${H} м нужно расположить машину, чтобы камни пролетали над стеной на высоте не менее 1 метра?`,
    answer: ru(x2),
    verify: {
      kind: "solve", rel: "ge", target: T, opt: "max", dom: [0, 300], ans: x2, unit: "(в метрах)",
      f: (x) => -x * x / 100 + (bn / bd) * x,
    },
  }
}

// #23 F=2mS/t² ≥ F₀ → наибольшее время (неизвестное в знаменателе, под квадратом).
export function t09ForceTime() {
  let m = 0, S = 0, t = 0, F0 = 0
  for (let g = 0; g < 400; g++) {
    m = pick([1000, 1200, 1500, 2000, 2500, 3000])
    S = pick([600, 750, 900, 1000, 1200])
    t = pick([20, 30, 40, 50, 60])
    F0 = clean(2 * m * S / (t * t))
    if (Number.isInteger(F0) && F0 % 50 === 0 && F0 >= 500 && F0 <= 20000) break
    F0 = 0
  }
  if (!F0) { m = 2000; S = 600; t = 40; F0 = 1500 }
  return {
    condition_text: `Автомобиль, масса которого равна m=${m} кг, начинает двигаться с ускорением, которое в течение t секунд остаётся неизменным, и проходит за это время путь S=${S} метров. Значение силы (в ньютонах), приложенной в это время к автомобилю, равно F=${fT("2mS", "t²")}. Определите наибольшее время после начала движения автомобиля, за которое он пройдёт указанный путь, если известно, что сила F, приложенная к автомобилю, не меньше ${F0} Н. Ответ выразите в секундах.`,
    answer: ru(t),
    verify: {
      kind: "solve", rel: "ge", target: F0, opt: "max", dom: [0.5, 500], ans: t, unit: "в секундах",
      f: (x) => 2 * m * S / (x * x),
    },
  }
}

// #66 h=5t²: время падения камешка изменилось на Δt → на сколько поднялась вода.
export function t09WellRise() {
  const t1 = pick([1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4])
  const dt = pick([0.1, 0.2, 0.3, 0.4])
  const t2 = clean(t1 - dt)
  const h1 = clean(5 * t1 * t1)
  const h2 = clean(5 * t2 * t2)
  return {
    condition_text: `После дождя уровень воды в колодце может повыситься. Мальчик измеряет время t падения небольших камешков в колодец и рассчитывает расстояние до воды по формуле h=5t², где h — расстояние в метрах, t — время падения в секундах. До дождя время падения камешков составляло ${ru(t1)} с. На сколько должен подняться уровень воды после дождя, чтобы измеряемое время изменилось на ${ru(dt)} с? Ответ выразите в метрах.`,
    answer: ru(clean(h1 - h2)),
    verify: {
      kind: "pair", combine: "dy", pts: [[t1, h1], [t2, h2]], ans: clean(h1 - h2),
      unit: "в метрах", f: (t) => 5 * t * t,
    },
  }
}

// ============================================================================
// Реестры
// ============================================================================
export const META9 = [
  ["Экономика и рейтинги", [
    ["profit", "Операционная прибыль → объём", t09Profit],
    ["rate-3", "Рейтинг издания (3 показателя) → A", t09Rating3],
    ["rate-4", "Рейтинг издания (4 показателя) → A", t09Rating4],
    ["demand-eq", "Спрос и выручка: цена (равно)", t09DemandEq],
    ["demand-ge", "Спрос и выручка: цена (не менее)", t09DemandGe],
    ["shop-rating", "Рейтинг интернет-магазина", t09ShopRating],
  ]],
  ["Кинематика и квадратные уравнения", [
    ["winding", "Намотка кабеля: угол достиг φ", t09Winding],
    ["winding-le", "Намотка кабеля: «не позже»", t09WindingLe],
    ["brake", "Торможение: путь S → время", t09Brake],
    ["accel-min", "Разгон (км/ч) → ответ в минутах", t09AccelMin],
    ["tank-drain", "Бак: сколько времени вытекает", t09TankDrain],
    ["tank-quarter", "Бак: четверть объёма (√2gH₀)", t09TankQuarter],
    ["cover-max", "Зона связи: наибольшее время", t09CoverMax],
    ["ball-span", "Мяч: сколько секунд выше H", t09BallSpan],
    ["catapult", "Камнемёт: расстояние до стены", t09Catapult],
    ["force-time", "F=2mS/t²: наибольшее время", t09ForceTime],
    ["well-rise", "Колодец: на сколько поднялась вода", t09WellRise],
  ]],
]

export const GEN9 = META9.flatMap(([, skins]) => skins.map(([, , fn]) => fn))
