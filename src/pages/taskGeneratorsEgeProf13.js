// Генераторы ЕГЭ математика ПРОФИЛЬ, задание №13 (развёрнутое, часть 2):
//   а) Решите уравнение   б) Найдите корни, принадлежащие отрезку [L; R].
//
// Эталон типажей — PDF «Задачи №13» (16 семейств уравнений). Философия та же, что у
// части 1: строим уравнение из ЗАРАНЕЕ известного набора корней, поэтому ответ гарантированно
// верен; сверх того — численно проверяем каждый сгенерированный объект (verify13).
//
// Формат объекта: { condition_text (часть а), condition_tail (часть б), answer (многострочный:
// «а) …» + «б) …»), _verify (служебное для смоук-теста) }.
// Мат-токены разворачивает renderTaskMath(): дробь ⟦f:n:d⟧. answer — plain-текст (моноширинный),
// поэтому в нём дроби пишем инлайном «π/2» (это ключ ответа, не условие).

// ── базовые утилиты ────────────────────────────────────────────────────────
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) {[a, b] = [b, a % b] } return a || 1 }
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b)
const MINUS = "−" // U+2212
// Юникод-подстрочные цифры — для основания логарифма (log₂, log₃…).
const SUBD = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" }
const subU = (n) => String(n).split("").map((c) => SUBD[c] ?? c).join("")

// ── рациональная π-арифметика: значение = p·π/q, всегда q>0, дробь сокращена ──
function R(p, q = 1) { if (q < 0) { p = -p; q = -q } const g = gcd(p, q) || 1; return { p: p / g, q: q / g } }
const Radd = (a, b) => R(a.p * b.q + b.p * a.q, a.q * b.q)
const Rsub = (a, b) => R(a.p * b.q - b.p * a.q, a.q * b.q)
const Rmuln = (a, n) => R(a.p * n, a.q)            // умножение на целое n
const Rnum = (a) => Math.PI * a.p / a.q            // численное значение
const Rkey = (a) => `${a.p}/${a.q}`               // ключ для дедупликации
const PI = R(1), TWO_PI = R(2), HALF_PI = R(1, 2)

// floor/ceil для рационала p/q (q>0)
const rFloor = (a) => Math.floor(a.p / a.q)
const rCeil = (a) => Math.ceil(a.p / a.q)

// ── форматирование π-значений ───────────────────────────────────────────────
// Для ОТВЕТА (plain, инлайн): «−7π/2», «π/3», «π», «0».
function fmtPi(a) {
  if (a.p === 0) return "0"
  const s = a.p < 0 ? MINUS : ""
  const n = Math.abs(a.p), q = a.q
  const num = n === 1 ? "π" : `${n}π`
  return q === 1 ? `${s}${num}` : `${s}${num}/${q}`
}
// Для УСЛОВИЯ (рендер через ⟦f⟧, дробь стоячей): «−⟦f:7π:2⟧», «π», «0».
function fmtPiCond(a) {
  if (a.p === 0) return "0"
  const s = a.p < 0 ? MINUS : ""
  const n = Math.abs(a.p), q = a.q
  const num = n === 1 ? "π" : `${n}π`
  return q === 1 ? `${s}${num}` : `${s}⟦f:${num}:${q}⟧`
}

// ── серии решений: {base, T} → x = base + T·n ───────────────────────────────
// Перечислить корни серий на [L; R] (включительно), дедупнуть, отсортировать.
function rootsInInterval(series, L, R, domainOK = null) {
  const map = new Map()
  for (const { base, T } of series) {
    // n: L ≤ base + n·T ≤ R  →  (L-base)/T ≤ n ≤ (R-base)/T
    const lo = Rdiv(Rsub(L, base), T)
    const hi = Rdiv(Rsub(R, base), T)
    for (let n = rCeil(lo); n <= rFloor(hi); n++) {
      const root = Radd(base, Rmuln(T, n))
      if (domainOK && !domainOK(Rnum(root))) continue
      map.set(Rkey(root), root)
    }
  }
  return [...map.values()].sort((a, b) => Rnum(a) - Rnum(b))
}
// деление рационалов a/b (b>0 по построению T>0)
function Rdiv(a, b) { return R(a.p * b.q, a.q * b.p) }

// ── целевые значения sin/cos (рациональные) → серии + текст общего решения ───
// value передаём как строковый ключ: 'one','negone','zero','half','neghalf'.
function cosSeries(v) {
  switch (v) {
    case "one": return [{ base: R(0), T: TWO_PI }]
    case "negone": return [{ base: PI, T: TWO_PI }]
    case "zero": return [{ base: HALF_PI, T: PI }]
    case "half": return [{ base: R(1, 3), T: TWO_PI }, { base: R(-1, 3), T: TWO_PI }]
    case "neghalf": return [{ base: R(2, 3), T: TWO_PI }, { base: R(-2, 3), T: TWO_PI }]
    case "r3half": return [{ base: R(1, 6), T: TWO_PI }, { base: R(-1, 6), T: TWO_PI }]     // cos=√3/2
    case "negr3half": return [{ base: R(5, 6), T: TWO_PI }, { base: R(-5, 6), T: TWO_PI }]  // cos=−√3/2
    case "r2half": return [{ base: R(1, 4), T: TWO_PI }, { base: R(-1, 4), T: TWO_PI }]     // cos=√2/2
    case "negr2half": return [{ base: R(3, 4), T: TWO_PI }, { base: R(-3, 4), T: TWO_PI }]  // cos=−√2/2
    default: throw new Error("cosSeries " + v)
  }
}
function sinSeries(v) {
  switch (v) {
    case "one": return [{ base: HALF_PI, T: TWO_PI }]
    case "negone": return [{ base: R(-1, 2), T: TWO_PI }]
    case "zero": return [{ base: R(0), T: PI }]
    case "half": return [{ base: R(1, 6), T: TWO_PI }, { base: R(5, 6), T: TWO_PI }]
    case "neghalf": return [{ base: R(-1, 6), T: TWO_PI }, { base: R(7, 6), T: TWO_PI }]
    case "r3half": return [{ base: R(1, 3), T: TWO_PI }, { base: R(2, 3), T: TWO_PI }]      // sin=√3/2
    case "negr3half": return [{ base: R(-1, 3), T: TWO_PI }, { base: R(4, 3), T: TWO_PI }]  // sin=−√3/2
    case "r2half": return [{ base: R(1, 4), T: TWO_PI }, { base: R(3, 4), T: TWO_PI }]      // sin=√2/2
    case "negr2half": return [{ base: R(-1, 4), T: TWO_PI }, { base: R(5, 4), T: TWO_PI }]  // sin=−√2/2
    default: throw new Error("sinSeries " + v)
  }
}
// tg x = t (период π): база + πn.
function tanSeries(v) {
  switch (v) {
    case "zero": return [{ base: R(0), T: PI }]
    case "one": return [{ base: R(1, 4), T: PI }]        // tg=1
    case "negone": return [{ base: R(-1, 4), T: PI }]    // tg=−1
    case "r3": return [{ base: R(1, 3), T: PI }]         // tg=√3
    case "negr3": return [{ base: R(-1, 3), T: PI }]     // tg=−√3
    case "invr3": return [{ base: R(1, 6), T: PI }]      // tg=1/√3
    case "neginvr3": return [{ base: R(-1, 6), T: PI }]  // tg=−1/√3
    default: throw new Error("tanSeries " + v)
  }
}
function cosText(v) {
  return {
    one: "x = 2πn", negone: "x = π + 2πn", zero: "x = π/2 + πn",
    half: "x = ±π/3 + 2πn", neghalf: "x = ±2π/3 + 2πn",
    r3half: "x = ±π/6 + 2πn", negr3half: "x = ±5π/6 + 2πn",
    r2half: "x = ±π/4 + 2πn", negr2half: "x = ±3π/4 + 2πn",
  }[v]
}
function sinText(v) {
  return {
    one: "x = π/2 + 2πn", negone: "x = −π/2 + 2πn", zero: "x = πn",
    half: "x = π/6 + 2πn, x = 5π/6 + 2πn", neghalf: "x = −π/6 + 2πn, x = 7π/6 + 2πn",
    r3half: "x = π/3 + 2πn, x = 2π/3 + 2πn", negr3half: "x = −π/3 + 2πn, x = 4π/3 + 2πn",
    r2half: "x = π/4 + 2πn, x = 3π/4 + 2πn", negr2half: "x = −π/4 + 2πn, x = 5π/4 + 2πn",
  }[v]
}
function tanText(v) {
  return {
    zero: "x = πn", one: "x = π/4 + πn", negone: "x = −π/4 + πn",
    r3: "x = π/3 + πn", negr3: "x = −π/3 + πn", invr3: "x = π/6 + πn", neginvr3: "x = −π/6 + πn",
  }[v]
}

// Собрать всё решение по базовой функции ('sin'|'cos') и списку валидных ключей.
function solveTrig(fn, vals) {
  const seriesFn = fn === "sin" ? sinSeries : cosSeries
  const textFn = fn === "sin" ? sinText : cosText
  const series = vals.flatMap(seriesFn)
  const genText = vals.map(textFn).join(",  ")
  return { series, genText }
}

// ── построение квадратного уравнения по корням (в базовой функции u) ─────────
// roots — массив рационалов u (обычные JS-объекты {p,q}); возвращает целые a·u²+b·u+c, a>0.
function buildQuadFromRoots(roots) {
  // (u-r1)(u-r2) = u² − (r1+r2)u + r1r2
  const [r1, r2] = roots
  const S = Radd(r1, r2)               // сумма корней
  const P = Rmul(r1, r2)               // произведение
  const b0 = R(-S.p, S.q)              // −S  (коэф. при u, монический вид)
  const M = lcm(b0.q, P.q)             // общий знаменатель → целые коэффициенты
  let a = M
  let b = (M * b0.p) / b0.q            // M·(−S)
  let c = (M * P.p) / P.q              // M·P
  const g = gcd(gcd(a, b), c)
  a /= g; b /= g; c /= g
  if (a < 0) { a = -a; b = -b; c = -c }
  return { a, b, c }
}
// умножение рационалов
function Rmul(a, b) { return R(a.p * b.p, a.q * b.q) }

// рациональное представление числовых целей для построения квадрата
const AS_R = { one: R(1), negone: R(-1), zero: R(0), half: R(1, 2), neghalf: R(-1, 2) }
// лишние (отсекаемые) корни |u|>1
const EXTRAN = [R(3, 2), R(-3, 2), R(4, 3), R(-4, 3), R(2), R(-2), R(5, 3), R(-5, 3), R(5, 4), R(-5, 4)]

// ── residual для верификатора: f∈{sin,cos}, a·f²+b·f+c ──────────────────────
function makeResidual(fn, a, b, c) {
  const F = fn === "sin" ? Math.sin : Math.cos
  return (x) => { const t = F(x); return a * t * t + b * t + c }
}

// ── выбор отрезка [L;R] так, чтобы на нём было 1–3 корня ─────────────────────
function chooseInterval(series, domainOK = null) {
  const lens = [2, 3, 3, 4, 4] // длина в шагах π/2 (π, 3π/2 или 2π)
  for (let tries = 0; tries < 500; tries++) {
    const len = pick(lens)
    const k = randInt(-12, 8)
    const L = R(k, 2), Rr = R(k + len, 2)
    const roots = rootsInInterval(series, L, Rr, domainOK)
    if (roots.length >= 1 && roots.length <= 3) return { L, R: Rr, roots }
  }
  // запас: любой непустой
  for (let k = -12; k <= 12; k++) {
    const L = R(k, 2), Rr = R(k + 4, 2)
    const roots = rootsInInterval(series, L, Rr, domainOK)
    if (roots.length) return { L, R: Rr, roots }
  }
  return null
}

// ── сборка финального объекта задания ───────────────────────────────────────
// equationText — строка части а) (уравнение). fn/coeffs — приведённый квадрат для residual.
function assemble(equationText, fn, coeffs, vals) {
  const { series, genText } = solveTrig(fn, vals)
  const iv = chooseInterval(series)
  if (!iv) return null
  const { L, R: Rr, roots } = iv
  const rootsPlain = roots.map(fmtPi).join(";  ")
  const residual = makeResidual(fn, coeffs.a, coeffs.b, coeffs.c)
  return {
    condition_text: `а) Решите уравнение\n${equationText}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${fmtPiCond(L)}; ${fmtPiCond(Rr)}].`,
    answer: `а) ${genText}, n ∈ ℤ\nб) ${rootsPlain}`,
    _verify: { residual, roots: roots.map(Rnum), L: Rnum(L), R: Rnum(Rr) },
  }
}

// ── мульти-цель + ОДЗ: цели вида {fn:'sin'|'cos'|'tan', val} ─────────────────
function seriesFor(fn, val) { return (fn === "sin" ? sinSeries : fn === "cos" ? cosSeries : tanSeries)(val) }
function textFor(fn, val) { return (fn === "sin" ? sinText : fn === "cos" ? cosText : tanText)(val) }
// предикат ОДЗ: 'cos' — cosx≠0; 'sin' — sinx≠0; 'none' — без ограничений.
function makeDomainOK(domain) {
  if (domain === "cos") return (x) => Math.abs(Math.cos(x)) > 1e-9
  if (domain === "sin") return (x) => Math.abs(Math.sin(x)) > 1e-9
  return () => true
}
// цель целиком нарушает ОДЗ? (для наших целей нарушение всё-или-ничего: проверяем базу)
function targetExcluded(fn, val, domainOK) {
  return seriesFor(fn, val).every((s) => !domainOK(Rnum(s.base)))
}

// Сборка развёрнутого задания из списка целей (union) с учётом ОДЗ.
// opts: { targets:[{fn,val}], domain, reducedResidual(x), realResidual(x) }.
function assembleMulti(equationText, opts) {
  const domainOK = makeDomainOK(opts.domain)
  const kept = opts.targets.filter((t) => !targetExcluded(t.fn, t.val, domainOK))
  if (!kept.length) return null
  const rawSeries = kept.flatMap((t) => seriesFor(t.fn, t.val))
  // серии для перечисления: те же, но корни ещё раз фильтруем по ОДЗ (страховка)
  const iv = chooseInterval(rawSeries, domainOK)
  if (!iv) return null
  const { L, R: Rr, roots } = iv
  const genText = kept.map((t) => textFor(t.fn, t.val)).join(",  ")
  const rootsPlain = roots.map(fmtPi).join(";  ")
  return {
    condition_text: `а) Решите уравнение\n${equationText}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${fmtPiCond(L)}; ${fmtPiCond(Rr)}].`,
    answer: `а) ${genText}, n ∈ ℤ\nб) ${rootsPlain}`,
    _verify: {
      residual: opts.reducedResidual, realResidual: opts.realResidual,
      domainOK, roots: roots.map(Rnum), L: Rnum(L), R: Rnum(Rr),
    },
  }
}

// ── форматирование квадратного трёхчлена a·SQ + b·LIN + c = 0 ────────────────
function fmtQuadExpr(a, b, c, sq, lin) {
  let s = ""
  s += a === 1 ? sq : a === -1 ? `${MINUS}${sq}` : `${a < 0 ? MINUS : ""}${Math.abs(a)}${sq}`
  if (b !== 0) {
    const bs = b < 0 ? ` ${MINUS} ` : " + "
    s += `${bs}${Math.abs(b) === 1 ? "" : Math.abs(b)}${lin}`
  }
  if (c !== 0) s += `${c < 0 ? ` ${MINUS} ` : " + "}${Math.abs(c)}`
  return s
}
function fmtQuad(a, b, c, sq, lin) { return `${fmtQuadExpr(a, b, c, sq, lin)} = 0` }

// выбрать валидные цели: 1 валидная (+лишний корень) ЛИБО 2 валидные.
function pickTargets() {
  const pool = ["half", "neghalf", "one", "negone"]
  if (Math.random() < 0.65) {
    const v = pick(pool)
    return { vals: [v], roots: [AS_R[v], pick(EXTRAN)] }
  }
  // две различные валидные
  const v1 = pick(pool)
  let v2 = pick(pool); let g = 0
  while (v2 === v1 && g++ < 10) v2 = pick(pool)
  return { vals: [v1, v2], roots: [AS_R[v1], AS_R[v2]] }
}

// ============================================================================
// СЕМЕЙСТВО 1 — тригонометрические квадратные уравнения
// ============================================================================

// прямой квадрат по sin
function t13SinQuad() {
  const { vals, roots } = pickTargets()
  const { a, b, c } = buildQuadFromRoots(roots)
  const eq = fmtQuad(a, b, c, "sin²x", "sin x")
  return assemble(eq, "sin", { a, b, c }, vals)
}
// прямой квадрат по cos
function t13CosQuad() {
  const { vals, roots } = pickTargets()
  const { a, b, c } = buildQuadFromRoots(roots)
  const eq = fmtQuad(a, b, c, "cos²x", "cos x")
  return assemble(eq, "cos", { a, b, c }, vals)
}

// A·cos²x + B·sinx + C = 0  (cos²=1−sin²).  Приведённый sin-квадрат (a,b,c).
// Дисплей: A=a, B=−b, C=−(a+c).  Линейную функцию можно замаскировать сдвигом.
// Записи, тождественно равные +sin x (без ведущего минуса — знак несёт коэффициент B).
function disguiseSin() {
  return pick([["sin x"], ["sin(π − x)"]])
}
// Записи, тождественно равные +cos x.
function disguiseCosAsLin() {
  return pick([["cos x"], ["sin(π/2 − x)"], ["sin(π/2 + x)"], ["cos(−x)"]])
}

function t13CosSqSinLin() {
  const { vals, roots } = pickTargets()          // цели в sin
  const q = buildQuadFromRoots(roots)            // приведённый sin-квадрат (a,b,c)
  const A = q.a, B = -q.b, C = -(q.a + q.c)      // дисплей: A·cos²x + B·sinx + C
  // маскируем линейный член (все варианты эквивалентны +sin x)
  const [linStr] = disguiseSin()
  const eq = fmtQuad(A, B, C, "cos²x", linStr)
  return assemble(eq, "sin", q, vals)
}

// A·sin²x + B·cosx + C = 0  (sin²=1−cos²).  Цели в cos.
function t13SinSqCosLin() {
  const { vals, roots } = pickTargets()          // цели в cos
  const q = buildQuadFromRoots(roots)            // приведённый cos-квадрат
  const A = q.a, B = -q.b, C = -(q.a + q.c)
  const [linStr] = disguiseCosAsLin()
  const eq = fmtQuad(A, B, C, "sin²x", linStr)
  return assemble(eq, "cos", q, vals)
}

// P·cos2x + Q·sinx + R = 0  (cos2x = 1 − 2sin²x).  Цели в sin; приведённый a·sin²+…, a чётное.
function t13Cos2xSin() {
  const { vals, roots } = pickTargets()
  let q = buildQuadFromRoots(roots)
  if (q.a % 2 !== 0) q = { a: q.a * 2, b: q.b * 2, c: q.c * 2 }
  // t=−1: P=a/2, Q=−b, Rr=−c−a/2
  const P = q.a / 2, Q = -q.b, Rc = -q.c - q.a / 2
  const eq = fmtQuad(P, Q, Rc, "cos2x", "sin x")
  return assemble(eq, "sin", q, vals)
}

// P·cos2x + Q·cosx + R = 0  (cos2x = 2cos²x − 1).  Цели в cos.
function t13Cos2xCos() {
  const { vals, roots } = pickTargets()
  let q = buildQuadFromRoots(roots)
  if (q.a % 2 !== 0) q = { a: q.a * 2, b: q.b * 2, c: q.c * 2 }
  // t=1: P=a/2, Q=b, Rr=c+a/2
  const P = q.a / 2, Q = q.b, Rc = q.c + q.a / 2
  const eq = fmtQuad(P, Q, Rc, "cos2x", "cos x")
  return assemble(eq, "cos", q, vals)
}

// cos²x − cos2x = 3/4  →  cos²x = 1/4  →  cos x = ±1/2.
function t13CosSqMinusCos2x() {
  const vals = ["half", "neghalf"]
  // приведённый cos-квадрат: cos² = 1/4 → 4cos² − 1 = 0
  const q = { a: 4, b: 0, c: -1 }
  const eq = `cos²x ${MINUS} cos2x = 0,75`
  return assemble(eq, "cos", q, vals)
}

// ============================================================================
// СЕМЕЙСТВО 2 — вынос общего множителя (сведение к произведению = 0), с ОДЗ
// ============================================================================

// значение cos²/sin² → ключ цели (±√·) для «tg−sin2x» / «ctg−sin2x»
const SQ_TO_TARGET = { "1/4": ["half", "neghalf"], "1/2": ["r2half", "negr2half"], "3/4": ["r3half", "negr3half"] }
// (A,B) для A·tgx − B·sin2x=0 → cos²=A/(2B). Даёт cos²∈{1/4,1/2,3/4}.
const AB_SIN2X = [[1, 2, "1/4"], [1, 1, "1/2"], [3, 2, "3/4"]]

// A·tg x − B·sin 2x = 0  →  sin x·(A − 2B·cos²x)=0  →  x=πn ∪ cos²=A/(2B). ОДЗ: cosx≠0.
function t13FactorTgSin2x() {
  const [A, B, key] = pick(AB_SIN2X)
  const [v1, v2] = SQ_TO_TARGET[key]
  const eq = `${A === 1 ? "" : A}tg x ${MINUS} ${B === 1 ? "" : B}sin 2x = 0`
  return assembleMulti(eq, {
    targets: [{ fn: "tan", val: "zero" }, { fn: "cos", val: v1 }, { fn: "cos", val: v2 }],
    domain: "cos",
    reducedResidual: (x) => Math.sin(x) * (A - 2 * B * Math.cos(x) ** 2),
    realResidual: (x) => A * Math.tan(x) - B * Math.sin(2 * x),
  })
}

// A·ctg x − B·sin 2x = 0  →  cos x·(A − 2B·sin²x)=0  →  cosx=0 ∪ sin²=A/(2B). ОДЗ: sinx≠0.
function t13FactorCtgSin2x() {
  const [A, B, key] = pick(AB_SIN2X)
  const [v1, v2] = SQ_TO_TARGET[key]
  const eq = `${A === 1 ? "" : A}ctg x ${MINUS} ${B === 1 ? "" : B}sin 2x = 0`
  return assembleMulti(eq, {
    targets: [{ fn: "cos", val: "zero" }, { fn: "sin", val: v1 }, { fn: "sin", val: v2 }],
    domain: "sin",
    reducedResidual: (x) => Math.cos(x) * (A - 2 * B * Math.sin(x) ** 2),
    realResidual: (x) => A * (Math.cos(x) / Math.sin(x)) - B * Math.sin(2 * x),
  })
}

// 2(sin x − cos x) = tg x − 1  →  (sin x − cos x)(2cos x − 1)=0  →  tgx=1 ∪ cosx=1/2. ОДЗ: cosx≠0.
function t13FactorSinMinusCos() {
  const eq = `2(sin x ${MINUS} cos x) = tg x ${MINUS} 1`
  return assembleMulti(eq, {
    targets: [{ fn: "tan", val: "one" }, { fn: "cos", val: "half" }],
    domain: "cos",
    reducedResidual: (x) => (Math.sin(x) - Math.cos(x)) * (2 * Math.cos(x) - 1),
    realResidual: (x) => 2 * (Math.sin(x) - Math.cos(x)) - (Math.tan(x) - 1),
  })
}

// 2(sin x + cos x) = ctg x + 1  →  (sin x + cos x)(2sin x − 1)=0  →  tgx=−1 ∪ sinx=1/2. ОДЗ: sinx≠0.
function t13FactorSinPlusCos() {
  const eq = `2(sin x + cos x) = ctg x + 1`
  return assembleMulti(eq, {
    targets: [{ fn: "tan", val: "negone" }, { fn: "sin", val: "half" }],
    domain: "sin",
    reducedResidual: (x) => (Math.sin(x) + Math.cos(x)) * (2 * Math.sin(x) - 1),
    realResidual: (x) => 2 * (Math.sin(x) + Math.cos(x)) - (Math.cos(x) / Math.sin(x) + 1),
  })
}

// cos x·(2cos x + tg x) = 1  →  2cos²x + sin x = 1  →  sinx=1(искл. ОДЗ cosx≠0) ∪ sinx=−1/2.
// Демонстрирует отсечение корня по ОДЗ.
function t13FactorCosTimesEq1() {
  const eq = `cos x·(2cos x + tg x) = 1`
  return assembleMulti(eq, {
    targets: [{ fn: "sin", val: "one" }, { fn: "sin", val: "neghalf" }],
    domain: "cos",
    reducedResidual: (x) => 2 * Math.cos(x) ** 2 + Math.sin(x) - 1,
    realResidual: (x) => Math.cos(x) * (2 * Math.cos(x) + Math.tan(x)) - 1,
  })
}

// ============================================================================
// СЕМЕЙСТВО «ПОКАЗАТЕЛЬНЫЕ» — алгебраический под-движок (без тригонометрии)
// Строим уравнение из известных корней (t = a^…): ответ верен по построению.
// Корни — целые, log_a(v) или h±√M; интервал в вещественных числах.
// ============================================================================

const supE = (s) => `⟦sup:${s}⟧`                    // показатель степени в условии
const powE = (base, exp) => `${base}${supE(exp)}`   // base^exp
const intT = (n) => (n < 0 ? MINUS + Math.abs(n) : String(n))
const logNumV = (a, v) => Math.log(v) / Math.log(a)
const logT = (a, v, neg = false) => `${neg ? MINUS : ""}log${subU(a)}${v}`
// квадратичный показатель x²+px+q как строка условия
function quadExp(p, q) {
  let s = "x²"
  if (p) s += ` ${p < 0 ? MINUS : "+"} ${Math.abs(p) === 1 ? "" : Math.abs(p)}x`
  if (q) s += ` ${q < 0 ? MINUS : "+"} ${Math.abs(q)}`
  return s
}
const isPow = (v, a) => { const l = Math.log(v) / Math.log(a); return Math.abs(l - Math.round(l)) < 1e-9 }

// Отрезок [L;R] с РОВНО одним корнем; концы — целые или log_a(целое) (если задан aBase).
function pickRealInterval(rootsNum, aBase = null) {
  const cand = []
  for (let i = -6; i <= 6; i++) cand.push({ num: i, text: intT(i) })
  if (aBase) for (let m = 2; m <= 40; m++) if (!isPow(m, aBase)) cand.push({ num: logNumV(aBase, m), text: logT(aBase, m) })
  const opts = []
  for (const L of cand) for (const Rr of cand) {
    const w = Rr.num - L.num
    if (w < 0.2 || w > 4.5) continue
    const inside = rootsNum.filter((x) => x >= L.num - 1e-9 && x <= Rr.num + 1e-9)
    if (inside.length === 1) opts.push({ L, R: Rr, w, isLog: /log/.test(L.text) || /log/.test(Rr.text) })
  }
  if (!opts.length) return null
  opts.sort((x, y) => (x.isLog - y.isLog) || (x.w - y.w))
  const best = opts[0]
  return { L: best.L, R: best.R }
}

// Сборка показательного/алгебраического задания. allRoots: [{num,text}] (все корни, часть а);
// residual(x) — фактическое уравнение LHS−RHS (без полюсов).
function assembleReal(eq, allRoots, residual, aBase = null) {
  const sorted = allRoots.slice().sort((r1, r2) => r1.num - r2.num)
  const iv = pickRealInterval(sorted.map((r) => r.num), aBase)
  if (!iv) return null
  const inside = sorted.filter((r) => r.num >= iv.L.num - 1e-9 && r.num <= iv.R.num + 1e-9)
  return {
    condition_text: `а) Решите уравнение\n${eq}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${iv.L.text}; ${iv.R.text}].`,
    answer: `а) ${sorted.map((r) => "x = " + r.text).join(";  ")}\nб) ${inside.map((r) => r.text).join(";  ")}`,
    _verify: {
      residual, realResidual: residual, roots: inside.map((r) => r.num),
      L: iv.L.num, R: iv.R.num, allRoots: sorted.map((r) => r.num),
    },
  }
}

// A — сумма двух степеней с квадратичным показателем: a^(u+k1)+a^(u+k2)=N, u=x²+px+q.
// a^u·(a^k1+a^k2)=N → a^u=a^m → u=m → x²+px+(q−m)=0 → корни h±√M.
function t13ExpSumPow() {
  const a = pick([2, 3, 5, 6])
  const k1 = 1, k2 = 0
  const F = a ** k1 + a ** k2
  const m = pick([0, 1, 2])
  const N = F * a ** m
  const h = pick([1, 2, 3])
  const M = pick([2, 3, 5, 6, 7, 8, 10, 11, 12].filter((x) => Math.abs(Math.sqrt(x) - Math.round(Math.sqrt(x))) > 1e-9))
  const p = -2 * h
  const q = m + (h * h - M)            // q−m = h²−M
  const e1 = quadExp(p, q + k1), e2 = quadExp(p, q + k2)
  const eq = `${powE(a, e1)} + ${powE(a, e2)} = ${N}`
  const rt = Math.sqrt(M)
  const roots = [
    { num: h - rt, text: `${h} ${MINUS} √${M}` },
    { num: h + rt, text: `${h} + √${M}` },
  ]
  const u = (x) => x * x + p * x + q
  const residual = (x) => a ** (u(x) + k1) + a ** (u(x) + k2) - N
  return assembleReal(eq, roots, residual, null)
}

// B — квадрат по t=a^x: b^x − a^(x+s) + C = 0, b=a², t1+t2=a^s. Корни: n (целое) и log_a(t2).
function t13ExpQuadInAx() {
  const a = pick([2, 3, 5])
  const b = a * a
  const combos = []
  for (let s = 2; s <= 3; s++) {
    const ps = a ** s
    for (let n = 1; a ** n < ps; n++) {
      const t1 = a ** n, t2 = ps - t1
      if (t2 <= 1 || t2 === t1 || isPow(t2, a)) continue
      combos.push({ s, n, t1, t2 })
    }
  }
  if (!combos.length) return null
  const { s, n, t1, t2 } = pick(combos)
  const C = t1 * t2
  const eq = `${powE(b, "x")} ${MINUS} ${powE(a, `x+${s}`)} + ${C} = 0`
  const roots = [
    { num: n, text: intT(n) },
    { num: logNumV(a, t2), text: logT(a, t2) },
  ]
  const residual = (x) => b ** x - a ** (x + s) + C
  return assembleReal(eq, roots, residual, a)
}

// D — однородное с квадратичным показателем: P·(a²)^u + Q·(ab)^u + R·(b²)^u = 0, u=x²+px.
// s=(a/b)^u, корни s: 1 (→u=0→x=0,−p) и отрицательный (отсекается).
function t13ExpHomogQuad() {
  const [a, b] = pick([[3, 2], [5, 2], [5, 3]])
  const k = pick([2, 3, 4])
  const c = pick([1, 2, 3])
  // s²+(k−1)s−k=(s−1)(s+k): (P,Q,R)=(1,k−1,−k)·c
  const P = c, Q = c * (k - 1), Rc = -c * k
  const h = pick([2, 3, 4, 6])
  const p = -h                          // u=x²−hx → корни 0 и h
  const uStr = quadExp(p, 0)
  // слагаемое coef·base^u со знаком; first — ведущее (без ведущего «+»); «·» между коэф. и степенью
  const term = (coef, base, first) => {
    const sign = coef < 0 ? ` ${MINUS} ` : first ? "" : " + "
    const mag = Math.abs(coef)
    return sign + (mag === 1 ? powE(base, uStr) : `${mag}·${powE(base, uStr)}`)
  }
  const eq = `${term(P, a * a, true)}${term(Q, a * b, false)}${term(Rc, b * b, false)} = 0`
  const u = (x) => x * x + p * x
  const residual = (x) => P * (a * a) ** u(x) + Q * (a * b) ** u(x) + Rc * (b * b) ** u(x)
  const roots = [{ num: 0, text: "0" }, { num: h, text: intT(h) }]
  return assembleReal(eq, roots, residual, null)
}

// ============================================================================
// СЕМЕЙСТВО «ЛОГАРИФМИЧЕСКИЕ» — алгебраический под-движок
// ============================================================================

// многочлен Ax²+bx+c как строка условия
function qPoly(A, b, c) {
  let s = A === 1 ? "x²" : `${A}x²`
  if (b) s += ` ${b < 0 ? MINUS : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}x`
  if (c) s += ` ${c < 0 ? MINUS : "+"} ${Math.abs(c)}`
  return s
}
// финишер: собрать объект по готовому интервалу iv={L,R} (концы {num,text}).
function finish(eq, allRoots, residual, iv, domainOK = null) {
  const sorted = allRoots.slice().sort((p, q) => p.num - q.num)
  const inside = sorted.filter((r) => r.num >= iv.L.num - 1e-9 && r.num <= iv.R.num + 1e-9)
  return {
    condition_text: `а) Решите уравнение\n${eq}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${iv.L.text}; ${iv.R.text}].`,
    answer: `а) ${sorted.map((r) => "x = " + r.text).join(";  ")}\nб) ${inside.map((r) => r.text).join(";  ")}`,
    _verify: {
      residual, realResidual: residual, domainOK, roots: inside.map((r) => r.num),
      L: iv.L.num, R: iv.R.num, allRoots: sorted.map((r) => r.num),
    },
  }
}
// положительный отрезок (концы целые/√целое), ровно один корень
function pickPosInterval(rootsNum) {
  const cand = []
  for (let i = 1; i <= 70; i++) cand.push({ num: i, text: intT(i) })
  for (let k = 2; k <= 300; k++) { const s = Math.sqrt(k); if (Math.abs(s - Math.round(s)) > 1e-9) cand.push({ num: s, text: `√${k}` }) }
  const opts = []
  for (const L of cand) for (const Rr of cand) {
    const w = Rr.num - L.num
    if (w < 0.5 || w > 22) continue
    if (rootsNum.filter((x) => x >= L.num - 1e-9 && x <= Rr.num + 1e-9).length === 1)
      opts.push({ L, R: Rr, w, isSqrt: /√/.test(L.text) || /√/.test(Rr.text) })
  }
  if (!opts.length) return null
  opts.sort((x, y) => (x.isSqrt - y.isSqrt) || (x.w - y.w))
  return { L: opts[0].L, R: opts[0].R }
}
// целочисленный отрезок, ровно один корень
function pickIntInterval(rootsNum) {
  const cand = []
  for (let i = -10; i <= 10; i++) cand.push({ num: i, text: intT(i) })
  const opts = []
  for (const L of cand) for (const Rr of cand) {
    const w = Rr.num - L.num
    if (w < 0.5 || w > 12) continue
    if (rootsNum.filter((x) => x >= L.num - 1e-9 && x <= Rr.num + 1e-9).length === 1)
      opts.push({ L, R: Rr, w })
  }
  if (!opts.length) return null
  opts.sort((x, y) => x.w - y.w)
  return { L: opts[0].L, R: opts[0].R }
}

// L1 — квадрат по t=log_a(x): A·log²_a x + B·log_a x + C = 0. Корни x=a^n (n целое >0).
function t13LogQuad() {
  for (let tries = 0; tries < 12; tries++) {
    const a = pick([2, 3, 5])
    const pool = a === 5 ? [1, 2] : [1, 2, 3]
    let n1 = pick(pool), n2 = pick(pool), g = 0
    while (n2 === n1 && g++ < 10) n2 = pick(pool)
    let A = 1, B = -(n1 + n2), C = n1 * n2
    const gg = gcd(gcd(A, B), C) || 1; A /= gg; B /= gg; C /= gg
    const eq = fmtQuad(A, B, C, `log²${subU(a)}x`, `log${subU(a)}x`)
    const roots = [{ num: a ** n1, text: intT(a ** n1) }, { num: a ** n2, text: intT(a ** n2) }]
    const residual = (x) => { const t = Math.log(x) / Math.log(a); return A * t * t + B * t + C }
    const iv = pickPosInterval(roots.map((r) => r.num))
    if (iv) return finish(eq, roots, residual, iv)
  }
  return null
}

// L2 — log_a f = log_a g, f,g — квадратные многочлены (g положительно определён, f=g+T).
// Уравнение ⟺ f=g ⟺ T=x²−Sx+P=0 → x=r1,r2. ОДЗ: f>0 и g>0 (в корнях выполнено, f=g>0).
const BASE_INV = { 2: "0,5", 4: "0,25", 5: "0,2" }
function t13LogDiff() {
  const a = pick([2, 3, 4, 5])
  let r1 = randInt(-5, 5), r2 = randInt(-5, 5), g = 0
  while (r2 === r1 && g++ < 10) r2 = randInt(-5, 5)
  const S = r1 + r2, P = r1 * r2
  const beta = randInt(-4, 4)
  const gamma = Math.floor(beta * beta / 4) + pick([1, 2, 3, 4])   // g положительно определён
  const fB = beta - S, fC = gamma + P
  const gStr = qPoly(1, beta, gamma), fStr = qPoly(2, fB, fC)
  const lg = `log${subU(a)}`
  const useSum = BASE_INV[a] && Math.random() < 0.5
  const eq = useSum
    ? `${lg}(${fStr}) + log${subU(BASE_INV[a])}(${gStr}) = 0`
    : `${lg}(${fStr}) = ${lg}(${gStr})`
  const gf = (x) => x * x + beta * x + gamma
  const ff = (x) => 2 * x * x + fB * x + fC
  const domainOK = (x) => ff(x) > 0 && gf(x) > 0
  const residual = (x) => domainOK(x) ? Math.log(ff(x)) / Math.log(a) - Math.log(gf(x)) / Math.log(a) : NaN
  const roots = [{ num: r1, text: intT(r1) }, { num: r2, text: intT(r2) }]
  const iv = pickIntInterval(roots.map((r) => r.num))
  if (!iv) return null
  return finish(eq, roots, residual, iv, domainOK)
}

// ============================================================================
// СЕМЕЙСТВО «ПРОИЗВЕДЕНИЕ / ДРОБЬ = 0» — множители-нули под знаковой ОДЗ
// ============================================================================

// Текст серии {base,T} → «x = base + Tn».
function seriesText(s) {
  const Ttext = (s.T.p === 1 && s.T.q === 1) ? "πn" : (s.T.p === 2 && s.T.q === 1) ? "2πn" : `${fmtPi(s.T)}n`
  return s.base.p === 0 ? `x = ${Ttext}` : `x = ${fmtPi(s.base)} + ${Ttext}`
}
// Отфильтровать серии по знаковой ОДЗ: 2π-серия (постоянный знак) целиком; π-серия при
// необходимости расщепляется на две 2π-серии (в base и base+π), выживают удовлетворяющие.
function refineSeries(series, domainOK) {
  const out = [], seen = new Set()
  const push = (base, T) => { const k = Rkey(base) + "|" + Rkey(T); if (!seen.has(k)) { seen.add(k); out.push({ base, T }) } }
  for (const { base, T } of series) {
    if (T.p === 1 && T.q === 1) {                       // период π
      const b2 = Radd(base, PI)
      const s1 = domainOK(Rnum(base)), s2 = domainOK(Rnum(b2))
      if (s1 && s2) push(base, PI)
      else if (s1) push(base, TWO_PI)
      else if (s2) push(b2, TWO_PI)
    } else {                                            // 2π или π/2 — знак постоянен на серии
      if (domainOK(Rnum(base))) push(base, T)
    }
  }
  return out
}

// P1 — (алгебраический квадрат)·(линейный тригонометрический) = 0. Смешанные корни:
// десятичные (алгебра) + π-кратные (триг). ОДЗ нет (оба множителя определены везде).
const DEC = (p, q) => { const v = p / q; return Number.isInteger(v) ? intT(v) : ru2(v) }
function ru2(v) { return (v < 0 ? MINUS : "") + Math.abs(v).toString().replace(".", ",") }
const TRIG_LIN = [
  { str: "2cos x + 1", fn: "cos", val: "neghalf" }, { str: "2cos x − 1", fn: "cos", val: "half" },
  { str: "2sin x − 1", fn: "sin", val: "half" }, { str: "2sin x + 1", fn: "sin", val: "neghalf" },
]
function t13ProductAlgTrig() {
  // алгебраические корни: два рациональных (знаменатель 1 или 2)
  const mkRoot = () => pick([1, 1, 2]) === 2 ? { p: 2 * randInt(-3, 3) + 1, q: 2 } : { p: randInt(-6, 6), q: 1 }
  let a1 = mkRoot(), a2 = mkRoot(), g = 0
  while (a1.p * a2.q === a2.p * a1.q && g++ < 10) a2 = mkRoot()
  // многочлен (q1 x − p1)(q2 x − p2) = q1q2 x² − (q1p2+q2p1) x + p1p2
  const A = a1.q * a2.q, B = -(a1.q * a2.p + a2.q * a1.p), C = a1.p * a2.p
  const gg = gcd(gcd(A, B), C) || 1
  const algStr = qPoly(A / gg, B / gg, C / gg)
  const tr = pick(TRIG_LIN)
  const eq = `(${algStr})(${tr.str}) = 0`
  const trigSeries = seriesFor(tr.fn, tr.val)
  // численно
  const trFn = tr.fn === "sin" ? Math.sin : Math.cos
  const trTarget = VAL_TO_NUM[tr.val]
  const residual = (x) => ((A / gg) * x * x + (B / gg) * x + (C / gg)) * (trFn(x) - trTarget)
  const iv = chooseIntervalMixed(trigSeries, [a1, a2])
  if (!iv) return null
  const { L, R, roots } = iv
  const algText = [a1, a2].sort((p, q) => p.p / p.q - q.p / q.q).map((r) => "x = " + DEC(r.p, r.q)).join(";  ")
  const trigTextAll = trigSeries.map(seriesText).join(",  ")
  return {
    condition_text: `а) Решите уравнение\n${eq}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${fmtPiCond(L)}; ${fmtPiCond(R)}].`,
    answer: `а) ${algText};  ${trigTextAll}, n ∈ ℤ\nб) ${roots.map((r) => r.text).join(";  ")}`,
    _verify: { residual, realResidual: residual, roots: roots.map((r) => r.num), L: Rnum(L), R: Rnum(R) },
  }
}
// Значение цели по ключу (для residual линейного триг-множителя).
const VAL_TO_NUM = {
  half: 0.5, neghalf: -0.5, one: 1, negone: -1, zero: 0,
  r3half: Math.sqrt(3) / 2, negr3half: -Math.sqrt(3) / 2, r2half: Math.sqrt(2) / 2, negr2half: -Math.sqrt(2) / 2,
}
// Отрезок с π-концами: перечисляем и триг π-корни, и алгебраические (десятичные) корни.
function chooseIntervalMixed(trigSeries, algRoots) {
  const algNum = algRoots.map((r) => ({ num: r.p / r.q, text: DEC(r.p, r.q) }))
  for (let tries = 0; tries < 500; tries++) {
    const len = pick([2, 3, 4])
    const k = randInt(-8, 6)
    const L = R(k, 2), Rr = R(k + len, 2)
    const Ln = Rnum(L), Rn = Rnum(Rr)
    const trigRoots = rootsInInterval(trigSeries, L, Rr).map((rr) => ({ num: Rnum(rr), text: fmtPi(rr) }))
    const inAlg = algNum.filter((r) => r.num >= Ln - 1e-9 && r.num <= Rn + 1e-9)
    const all = [...trigRoots, ...inAlg].sort((p, q) => p.num - q.num)
    if (all.length >= 1 && all.length <= 3) return { L, R: Rr, roots: all }
  }
  return null
}

// P2 — P(триг)·√(k·триг) = 0. ОДЗ: k·(подкоренная функция) ≥ 0. Корни: нули P (в ОДЗ) и
// нуль подкоренной функции (√=0). P — квадрат по cos ИЛИ sin; √ — по ДРУГОЙ функции.
function t13ProductSqrt() {
  const fP = pick(["cos", "sin"])
  const fS = fP === "cos" ? "sin" : "cos"
  const { vals, roots } = pickTargets()               // цели для P (в fP)
  const q = buildQuadFromRoots(roots)
  const Pexpr = fmtQuadExpr(q.a, q.b, q.c, fP === "cos" ? "cos²x" : "sin²x", fP === "cos" ? "cos x" : "sin x")
  const kPos = Math.random() < 0.7
  const k = kPos ? pick([5, 7, 11, 13]) : -1
  const fSstr = fS === "cos" ? "cos x" : "sin x"
  const kInner = k === -1 ? `${MINUS}${fSstr}` : `${k} ${fSstr}`
  const eq = `(${Pexpr})·⟦r:${kInner}⟧ = 0`
  const fSfn = fS === "sin" ? Math.sin : Math.cos
  const domainOK = (x) => k * fSfn(x) >= -1e-9
  const allSeries = [...vals.flatMap((v) => seriesFor(fP, v)), ...seriesFor(fS, "zero")]
  const refined = refineSeries(allSeries, domainOK)
  const iv = chooseInterval(refined)
  if (!iv) return null
  const { L, R: Rr, roots: rr } = iv
  const residualP = makeResidual(fP, q.a, q.b, q.c)
  const residual = (x) => { const inside = k * fSfn(x); return inside < -1e-12 ? NaN : residualP(x) * Math.sqrt(Math.max(inside, 0)) }
  return {
    condition_text: `а) Решите уравнение\n${eq}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${fmtPiCond(L)}; ${fmtPiCond(Rr)}].`,
    answer: `а) ${refined.map(seriesText).join(",  ")}, n ∈ ℤ\nб) ${rr.map(fmtPi).join(";  ")}`,
    _verify: { residual, realResidual: residual, domainOK, roots: rr.map(Rnum), L: Rnum(L), R: Rnum(Rr) },
  }
}

// ============================================================================
// СЕМЕЙСТВО «ИРРАЦИОНАЛЬНЫЕ» — тригонометрия под радикалом
// T1(x) + √(C·(1∓T2)) = 0 → √=−T1 (ОДЗ T1≤0), возводим в квадрат → T2=значение + граница.
// Радиканд C·(1∓·)≥0 всегда, поэтому residual определён везде (нет NaN).
// ============================================================================

const S3H = Math.sqrt(3) / 2, S2H = Math.sqrt(2) / 2
function numToTrigKey(v) {
  const n = (b) => Math.abs(v - b) < 1e-9
  if (n(1)) return "one"; if (n(-1)) return "negone"; if (n(0)) return "zero"
  if (n(0.5)) return "half"; if (n(-0.5)) return "neghalf"
  if (n(S3H)) return "r3half"; if (n(-S3H)) return "negr3half"
  if (n(S2H)) return "r2half"; if (n(-S2H)) return "negr2half"
  return null
}
const IRR_C = [
  { Cnum: 0.5, num: "1", den: "2" }, { Cnum: 1, num: null }, { Cnum: 1.5, num: "3", den: "2" },
  { Cnum: (2 - Math.sqrt(3)) / 2, num: "2 − √3", den: "2" }, { Cnum: (2 + Math.sqrt(3)) / 2, num: "2 + √3", den: "2" },
  { Cnum: (2 - Math.sqrt(2)) / 2, num: "2 − √2", den: "2" }, { Cnum: (2 + Math.sqrt(2)) / 2, num: "2 + √2", den: "2" },
]
// kind: 'sin' → sin x + √(C(1−cos x))=0 (ОДЗ sinx≤0, cos=C−1 или cos=1);
//       'cos' → cos x + √(C(sin x+1))=0 (ОДЗ cosx≤0, sin=1−C или sin=−1).
function irrTrigGen(kind) {
  const C = pick(IRR_C)
  const targetVal = kind === "sin" ? C.Cnum - 1 : 1 - C.Cnum
  const tkey = numToTrigKey(targetVal)
  if (!tkey) return null
  const innerFn = kind === "sin" ? "cos" : "sin"
  const boundaryKey = kind === "sin" ? "one" : "negone"     // cos=1 / sin=−1
  const outerStr = kind === "sin" ? "sin x" : "cos x"
  const radInner = kind === "sin" ? "1 − cos x" : "sin x + 1"
  const radTok = C.num === null ? `⟦r:${radInner}⟧` : `⟦rf:¦${C.num}¦${C.den}¦·(${radInner})⟧`
  const eq = `${outerStr} + ${radTok} = 0`
  const outerFn = kind === "sin" ? Math.sin : Math.cos
  const domainOK = (x) => outerFn(x) <= 1e-9
  const allSeries = [...seriesFor(innerFn, boundaryKey), ...seriesFor(innerFn, tkey)]
  const refined = refineSeries(allSeries, domainOK)
  const iv = chooseInterval(refined)
  if (!iv) return null
  const { L, R: Rr, roots } = iv
  const Cn = C.Cnum
  const residual = kind === "sin"
    ? (x) => Math.sin(x) + Math.sqrt(Cn * (1 - Math.cos(x)))
    : (x) => Math.cos(x) + Math.sqrt(Cn * (1 + Math.sin(x)))
  return {
    condition_text: `а) Решите уравнение\n${eq}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${fmtPiCond(L)}; ${fmtPiCond(Rr)}].`,
    answer: `а) ${refined.map(seriesText).join(",  ")}, n ∈ ℤ\nб) ${roots.map(fmtPi).join(";  ")}`,
    _verify: { residual, realResidual: residual, domainOK, roots: roots.map(Rnum), L: Rnum(L), R: Rnum(Rr) },
  }
}
function t13IrrSin() { return irrTrigGen("sin") }
function t13IrrCos() { return irrTrigGen("cos") }

// ============================================================================
// СЕМЕЙСТВО «ПОКАЗАТЕЛЬНЫЕ × ТРИГОНОМЕТРИЯ» — сводятся к триг-уравнению (без ОДЗ)
// ============================================================================

// Общий финишер для триг-решения (targets = [{fn,key}]); residual — фактическое уравнение.
function finishTrig(eq, targets, residual, domainOK = null) {
  const series = targets.flatMap((t) => seriesFor(t.fn, t.key))
  const refined = domainOK ? refineSeries(series, domainOK) : series
  const iv = chooseInterval(refined, domainOK)
  if (!iv) return null
  const { L, R: Rr, roots } = iv
  const genText = domainOK ? refined.map(seriesText).join(",  ") : targets.map((t) => textFor(t.fn, t.key)).join(",  ")
  return {
    condition_text: `а) Решите уравнение\n${eq}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${fmtPiCond(L)}; ${fmtPiCond(Rr)}].`,
    answer: `а) ${genText}, n ∈ ℤ\nб) ${roots.map(fmtPi).join(";  ")}`,
    _verify: { residual, realResidual: residual, domainOK, roots: roots.map(Rnum), L: Rnum(L), R: Rnum(Rr) },
  }
}

// ET1 — произведение степеней: (ab)^E = a^E · b^F → E=F (на базе b) → tg x = ±1.
function t13ExpTrigProduct() {
  const [a, b] = pick([[3, 5], [2, 5], [2, 3], [3, 7]])
  const E = pick(["cos", "sin"]), other = E === "cos" ? "sin" : "cos"
  const sgn = pick([1, -1])                                   // F = sgn·other
  const tgOne = sgn === 1 ? "one" : "negone"                  // E=sgn·other → tg x = sgn (cos=±sin ⟺ tg=±1)
  const Estr = E === "cos" ? "cos x" : "sin x"
  const Fstr = `${sgn < 0 ? MINUS : ""}${other === "cos" ? "cos x" : "sin x"}`
  const eq = `${a * b}⟦sup:${Estr}⟧ = ${a}⟦sup:${Estr}⟧ · ${b}⟦sup:${Fstr}⟧`
  const Ef = E === "cos" ? Math.cos : Math.sin, Of = other === "cos" ? Math.cos : Math.sin
  const residual = (x) => (a * b) ** Ef(x) - (a ** Ef(x)) * (b ** (sgn * Of(x)))
  return finishTrig(eq, [{ fn: "tan", key: tgOne }], residual)
}

// ET2 — симметричное p^T + p^{−T} = k. Дробное основание k=2 → T=0; квадратное p, k=(p+1)/√p → T=±1/2.
function t13ExpTrigSym() {
  const T = pick(["sin", "cos"]), Tstr = T === "sin" ? "sin x" : "cos x"
  const Tf = T === "sin" ? Math.sin : Math.cos
  if (Math.random() < 0.4) {                                  // T=0, дробное основание
    const [n, d] = pick([[4, 5], [2, 5], [2, 3], [3, 4]])
    const eq = `⟦pf:${n}:${d}⟧⟦sup:${Tstr}⟧ + ⟦pf:${d}:${n}⟧⟦sup:${Tstr}⟧ = 2`
    const residual = (x) => (n / d) ** Tf(x) + (d / n) ** Tf(x) - 2
    return finishTrig(eq, [{ fn: T, key: "zero" }], residual)
  }
  const p = pick([4, 9, 16, 25]), rt = Math.sqrt(p)          // p^{1/2}=rt (целое)
  const kN = rt * rt + 1, kD = rt                            // k=(p+1)/√p
  const eq = `${p}⟦sup:${Tstr}⟧ + ${p}⟦sup:${MINUS}${Tstr}⟧ = ⟦f:${kN}:${kD}⟧`
  const residual = (x) => p ** Tf(x) + p ** (-Tf(x)) - kN / kD
  return finishTrig(eq, [{ fn: T, key: "half" }, { fn: T, key: "neghalf" }], residual)
}

// ET3 — квадрат по t=p^T: a·(p²)^T + b·p^T + c = 0 → p^T=p^{v} → T=v (v∈{0,±1/2,±1}).
const ET3_V = [
  { key: "half", tv: (p) => R(Math.round(Math.sqrt(p)), 1) }, { key: "neghalf", tv: (p) => R(1, Math.round(Math.sqrt(p))) },
  { key: "one", tv: (p) => R(p, 1) }, { key: "negone", tv: (p) => R(1, p) },
  { key: "zero", tv: () => R(1, 1) },
]
function t13ExpTrigQuad() {
  const T = pick(["sin", "cos"]), Tstr = T === "sin" ? "sin x" : "cos x"
  const p = pick([4, 9, 16, 25])
  const opts = shuffleA(ET3_V.slice()).slice(0, 2)
  const t1 = opts[0].tv(p), t2 = opts[1].tv(p)
  if (t1.p * t2.q === t2.p * t1.q) return null                // совпали
  const q = buildQuadFromRoots([t1, t2])
  const powHi = `${p * p}⟦sup:${Tstr}⟧`, powLo = `${p}⟦sup:${Tstr}⟧`
  let s = q.a === 1 ? powHi : `${q.a}·${powHi}`
  if (q.b) s += ` ${q.b < 0 ? MINUS : "+"} ${Math.abs(q.b) === 1 ? "" : Math.abs(q.b) + "·"}${powLo}`
  if (q.c) s += ` ${q.c < 0 ? MINUS : "+"} ${Math.abs(q.c)}`
  const eq = `${s} = 0`
  const Tf = T === "sin" ? Math.sin : Math.cos
  const residual = (x) => { const u = p ** Tf(x); return q.a * u * u + q.b * u + q.c }
  return finishTrig(eq, opts.map((o) => ({ fn: T, key: o.key })), residual)
}
const shuffleA = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = randInt(0, i);[arr[i], arr[j]] = [arr[j], arr[i]] } return arr }

// ET4 — степенная башня: ((q²)^{sin x})^{cos x} = q^{r·sin x} → sin x·(2cos x − r)=0 →
// sin x=0 или cos x = r/2 (r=±1,±√2,±√3 → cos=±1/2,±√2/2,±√3/2).
const ET4_R = [
  { r: "", rn: 1 }, { r: `${MINUS}`, rn: -1 }, { r: "√2 ", rn: Math.sqrt(2) }, { r: `${MINUS}√2 `, rn: -Math.sqrt(2) },
  { r: "√3 ", rn: Math.sqrt(3) }, { r: `${MINUS}√3 `, rn: -Math.sqrt(3) },
]
function t13ExpTrigTower() {
  const q = pick([2, 3, 5, 7])
  const opt = pick(ET4_R)
  const cosKey = numToTrigKey(opt.rn / 2)
  if (!cosKey) return null
  const eq = `(${q * q}⟦sup:sin x⟧)⟦sup:cos x⟧ = ${q}⟦sup:${opt.r}sin x⟧`
  const residual = (x) => (q * q) ** (Math.sin(x) * Math.cos(x)) - q ** (opt.rn * Math.sin(x))
  return finishTrig(eq, [{ fn: "sin", key: "zero" }, { fn: "cos", key: cosKey }], residual)
}

// ============================================================================
// СЕМЕЙСТВО «ЛОГАРИФМИЧЕСКИЕ × ТРИГОНОМЕТРИЯ» — log(триг)=число / квадрат по log(триг)
// ============================================================================

// LT1 — log_a(T1 ± sin2x + a^k) = k → T1 ± sin2x = 0 → T1=0 ∪ other=∓1/2 (T1·(1±2·other)).
function t13LogTrigProd() {
  const [a, k] = pick([[2, 2], [2, 3], [2, 4], [3, 2]])
  const Ak = a ** k
  const outer = pick(["cos", "sin"]), other = outer === "cos" ? "sin" : "cos"
  const sg = pick([1, -1])
  const otherKey = sg === 1 ? "neghalf" : "half"             // 1+2·other=0→−1/2 ; 1−2·other=0→+1/2
  const outerStr = outer === "cos" ? "cos x" : "sin x"
  const eq = `log${subU(a)}(${outerStr} ${sg < 0 ? MINUS : "+"} sin 2x + ${Ak}) = ${k}`
  const of = outer === "cos" ? Math.cos : Math.sin
  const EXPR = (x) => of(x) + sg * Math.sin(2 * x) + Ak
  const domainOK = (x) => EXPR(x) > 1e-12
  const residual = (x) => domainOK(x) ? Math.log(EXPR(x)) / Math.log(a) - k : NaN
  return finishTrig(eq, [{ fn: outer, key: "zero" }, { fn: other, key: otherKey }], residual, domainOK)
}

// LT2 — A·log²_a(g) + B·log_a(g) + C = 0, g=2sin x или 2cos x, t=log₂(g) → g=2^t → trig=2^{t−1}.
const LT2_T = [{ t: 0, key: "half" }, { t: 1, key: "one" }, { t: 0.5, key: "r2half" }]
function t13LogTrigQuad() {
  const g = pick(["sin", "cos"]), gStr = g === "sin" ? "2sin x" : "2cos x", a = 2
  const opts = shuffleA(LT2_T.slice()).slice(0, 2)
  const t1 = opts[0].t, t2 = opts[1].t
  const mul = (t1 === 0.5 || t2 === 0.5) ? 2 : 1
  const A = mul, B = -mul * (t1 + t2), C = mul * t1 * t2
  const eq = fmtQuad(A, B, C, `log²${subU(a)}(${gStr})`, `log${subU(a)}(${gStr})`)
  const gf = (x) => g === "sin" ? 2 * Math.sin(x) : 2 * Math.cos(x)
  const domainOK = (x) => gf(x) > 1e-12
  const residual = (x) => { if (!domainOK(x)) return NaN; const t = Math.log(gf(x)) / Math.log(a); return A * t * t + B * t + C }
  return finishTrig(eq, opts.map((o) => ({ fn: g, key: o.key })), residual, domainOK)
}

// ============================================================================
// СЕМЕЙСТВО «БИКВАДРАТНЫЕ» — дробно-квадратные по 1/sinx или 1/cosx (ОДЗ f≠0)
// A/f² + B/f + C = 0 ⟺ (×f²) C·f² + B·f + A = 0 → f=нужное значение (не 0).
// Приведённая (без полюсов) форма для полноты + фактическая для per-root.
// ============================================================================

// два различных валидных ненулевых значения (для дисгизов 1/tg², tg² → коэф. 1)
function pickTwoValid() {
  const pool = ["half", "neghalf", "one", "negone"]
  const v1 = pick(pool); let v2 = pick(pool), g = 0
  while (v2 === v1 && g++ < 10) v2 = pick(pool)
  return { vals: [v1, v2], roots: [AS_R[v1], AS_R[v2]] }
}
// A/sqDen + B/linDen + C = 0 (дроби ⟦f⟧)
function recipEq(A, B, C, sqDen, linDen) {
  let s = (A < 0 ? MINUS : "") + `⟦f:${Math.abs(A)}:${sqDen}⟧`
  if (B) s += ` ${B < 0 ? MINUS : "+"} ⟦f:${Math.abs(B)}:${linDen}⟧`
  if (C) s += ` ${C < 0 ? MINUS : "+"} ${Math.abs(C)}`
  return s + " = 0"
}
// сборка биквадратного: reduced (pole-free) для полноты, real для per-root.
function bqAssemble(fn, dispA, dispB, dispC, q0, vals, eqStr) {
  const ff = fn === "sin" ? Math.sin : Math.cos
  const reduced = makeResidual(fn, q0.a, q0.b, q0.c)         // q0.a·f²+q0.b·f+q0.c (нули = целевые f)
  const real = (x) => { const f = ff(x); return Math.abs(f) < 1e-9 ? NaN : dispA / (f * f) + dispB / f + dispC }
  const domainOK = (x) => Math.abs(ff(x)) > 1e-9
  const series = vals.flatMap((v) => seriesFor(fn, v))
  const iv = chooseInterval(series, domainOK)
  if (!iv) return null
  const { L, R: Rr, roots } = iv
  return {
    condition_text: `а) Решите уравнение\n${eqStr}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${fmtPiCond(L)}; ${fmtPiCond(Rr)}].`,
    answer: `а) ${vals.map((v) => textFor(fn, v)).join(",  ")}, n ∈ ℤ\nб) ${roots.map(fmtPi).join(";  ")}`,
    _verify: { residual: reduced, realResidual: real, domainOK, roots: roots.map(Rnum), L: Rnum(L), R: Rnum(Rr) },
  }
}
// приведённая recip-тройка (A/f²+B/f+C) из валидных целей + нормировка A>0
function recipCoeffs(roots) {
  const q0 = buildQuadFromRoots(roots)                       // s-поли: q0.a f²+q0.b f+q0.c, нули = цели
  let A = q0.c, B = q0.b, C = q0.a
  if (A < 0) { A = -A; B = -B; C = -C }
  return { A, B, C, q0 }
}

function t13BiquadSin() {
  const { vals, roots } = pickTargets()
  const { A, B, C, q0 } = recipCoeffs(roots)
  return bqAssemble("sin", A, B, C, q0, vals, recipEq(A, B, C, "sin²x", "sin x"))
}
function t13BiquadCos() {
  const { vals, roots } = pickTargets()
  const { A, B, C, q0 } = recipCoeffs(roots)
  return bqAssemble("cos", A, B, C, q0, vals, recipEq(A, B, C, "cos²x", "cos x"))
}
// 1/tg²x + B/sinx + C = 0  (1/tg²x = 1/sin²−1 → приведённая sin: A=1, конст = C−1).
function t13BiquadCtgSin() {
  const { vals, roots } = pickTwoValid()                     // A=1
  const { A, B, C, q0 } = recipCoeffs(roots)
  const eqStr = recipEq(A, B, C + A, "tg²x", "sin x")        // A/tg²x + B/sinx + (C+A)
  return bqAssemble("sin", A, B, C, q0, vals, eqStr)
}
// A·tg²x + B/cosx + C = 0  (tg²x = 1/cos²−1 → приведённая cos: конст = C−A).
function t13BiquadTgCos() {
  const { vals, roots } = pickTwoValid()                     // A=1
  const { A, B, C, q0 } = recipCoeffs(roots)
  let s = A === 1 ? "tg²x" : `${A}tg²x`
  if (B) s += ` ${B < 0 ? MINUS : "+"} ⟦f:${Math.abs(B)}:cos x⟧`
  const C2 = C + A
  if (C2) s += ` ${C2 < 0 ? MINUS : "+"} ${Math.abs(C2)}`
  return bqAssemble("cos", A, B, C, q0, vals, s + " = 0")
}

// ============================================================================
// СЕМЕЙСТВО «РАЦИОНАЛЬНЫЕ» — симметричная подстановка t = y/b − c/y (y = x+m)
// (x+m)²/D + M/(x+m)² = P·((x+m)/b − c/(x+m)) + Q, M=K·c², D=b²/K.
// LHS = K·t² + 2Kc/b, RHS = P·t + Q → K·t² − P·t + (2Kc/b−Q)=0 → t₁,t₂ → y²−b·t·y−bc=0.
// Обе факторизации −bc дают ЦЕЛЫЕ y-корни → все 4 корня x целые.
// ============================================================================

// целый отрезок, 1–2 корня из списка, концы не в полюсе `avoid`
function pickIntIntervalMulti(rootsNum, avoid) {
  const opts = []
  for (let L = -12; L <= 12; L++) for (let Rr = L + 1; Rr <= 12; Rr++) {
    if (Rr - L > 10 || L === avoid || Rr === avoid) continue
    const inside = rootsNum.filter((x) => x >= L - 1e-9 && x <= Rr + 1e-9)
    if (inside.length >= 1 && inside.length <= 2) opts.push({ L, R: Rr, w: Rr - L, cnt: inside.length })
  }
  if (!opts.length) return null
  opts.sort((a, b) => a.cnt - b.cnt || a.w - b.w)
  return pick(opts.slice(0, Math.min(10, opts.length)))
}
function t13Rational() {
  for (let tries = 0; tries < 400; tries++) {
    const b = pick([3, 4, 5, 6]), c = pick([2, 3, 4]), b2 = b * b
    const Ks = []; for (let K = 1; K <= b2; K++) if (b2 % K === 0 && b2 / K >= 2) Ks.push(K)
    const K = pick(Ks), D = b2 / K, M = K * c * c, N = b * c
    const pairs = []; for (let d = 1; d <= N; d++) if (N % d === 0) { pairs.push([d, -N / d]); pairs.push([-d, N / d]) }
    const sh = pick([-2, -1, 1, 2, 3])
    const shuf = shuffleA(pairs.slice())
    for (let i = 0; i < shuf.length; i++) for (let j = i + 1; j < shuf.length; j++) {
      const [y1, y2] = shuf[i], [y3, y4] = shuf[j], ys = [y1, y2, y3, y4]
      if (new Set(ys).size < 4) continue
      const s1 = y1 + y2, s2 = y3 + y4; if (s1 === s2) continue
      const P = K * (s1 + s2) / b, Q = 2 * K * c / b - K * s1 * s2 / b2
      if (!Number.isInteger(P) || !Number.isInteger(Q) || P === 0) continue
      const xr = ys.map((y) => y - sh)
      const iv = pickIntIntervalMulti(xr, -sh)
      if (!iv) continue
      const shTxt = sh > 0 ? `x + ${sh}` : `x ${MINUS} ${-sh}`
      const eq = `⟦f:(${shTxt})²:${D}⟧ + ⟦f:${M}:(${shTxt})²⟧ = ${P < 0 ? MINUS : ""}${Math.abs(P)}(⟦f:${shTxt}:${b}⟧ ${MINUS} ⟦f:${c}:${shTxt}⟧) ${Q < 0 ? MINUS : "+"} ${Math.abs(Q)}`
      const residual = (x) => { const y = x + sh; if (Math.abs(y) < 1e-6) return NaN; return y * y / D + M / (y * y) - (P * (y / b - c / y) + Q) }
      const domainOK = (x) => Math.abs(x + sh) > 1e-6
      const sorted = xr.slice().sort((a, z) => a - z)
      const inside = sorted.filter((x) => x >= iv.L - 1e-9 && x <= iv.R + 1e-9)
      return {
        condition_text: `а) Решите уравнение\n${eq}`,
        condition_tail: `б) Найдите корни, принадлежащие отрезку [${intT(iv.L)}; ${intT(iv.R)}].`,
        answer: `а) ${sorted.map((x) => "x = " + intT(x)).join(";  ")}\nб) ${inside.map(intT).join(";  ")}`,
        _verify: { residual, realResidual: residual, domainOK, roots: inside, L: iv.L, R: iv.R, allRoots: sorted },
      }
    }
  }
  return null
}

// ============================================================================
// СЕМЕЙСТВО «ГРУППИРОВКА» — A·sin2x + B·sinx + C·cosx + D = 0
// = (2A·cosx + B)(sinx + C/(2A)),  D = BC/(2A) → cosx = −B/(2A), sinx = −C/(2A).
// Цели рациональные и √3/2, √2/2 (коэф. с √3/√2 через ⟦r:⟧).
// ============================================================================

const radOf = (k) => k.includes("r3") ? 3 : k.includes("r2") ? 2 : 1
// слагаемое n·(√rad)·func со знаком; func="" → константа
function radTerm(n, rad, func, first) {
  const sign = first ? (n < 0 ? MINUS : "") : (n < 0 ? ` ${MINUS} ` : " + ")
  const mag = Math.abs(n)
  const body = rad === 1
    ? ((mag === 1 && func) ? func : `${mag}${func}`)
    : `${mag === 1 ? "" : mag}⟦r:${rad}⟧${func ? " " + func : ""}`
  return sign + body
}
const GROUP_V = ["half", "neghalf", "one", "negone", "r3half", "negr3half", "r2half", "negr2half"]
function t13Grouping() {
  for (let tries = 0; tries < 60; tries++) {
    const vcK = pick(GROUP_V), vsK = pick(GROUP_V)
    const rvc = radOf(vcK), rvs = radOf(vsK)
    if (rvc !== 1 && rvs !== 1 && rvc !== rvs) continue      // избегаем √6 в D
    const radD = rvc === 1 ? rvs : rvs === 1 ? rvc : 1        // оба одинаковых √ → рационально
    const vc = VAL_TO_NUM[vcK], vs = VAL_TO_NUM[vsK]
    for (const A of [1, 2, 3, 4]) {
      const nB = -2 * A * vc / (rvc === 1 ? 1 : Math.sqrt(rvc))
      const nC = -2 * A * vs / (rvs === 1 ? 1 : Math.sqrt(rvs))
      const nD = 2 * A * vc * vs / (radD === 1 ? 1 : Math.sqrt(radD))
      const int = (v) => Math.abs(v - Math.round(v)) < 1e-9
      if (!int(nB) || !int(nC) || !int(nD)) continue
      const bN = Math.round(nB), cN = Math.round(nC), dN = Math.round(nD)
      if (bN === 0 || cN === 0 || dN === 0) continue
      const eq = radTerm(A, 1, "sin 2x", true) + radTerm(bN, rvc, "sin x", false) +
        radTerm(cN, rvs, "cos x", false) + radTerm(dN, radD, "", false) + " = 0"
      const residual = (x) => A * Math.sin(2 * x) + (-2 * A * vc) * Math.sin(x) + (-2 * A * vs) * Math.cos(x) + 2 * A * vc * vs
      return finishTrig(eq, [{ fn: "cos", key: vcK }, { fn: "sin", key: vsK }], residual)
    }
  }
  return null
}

// ============================================================================
// СЕМЕЙСТВО «СУММА/РАЗНОСТЬ SIN·COS» — sin px ± sin qx = 0 (→ произведение)
// sin p ± sin q, cos p ± cos q → 2·factor(s·x)·factor(d·x)=0, s=(p+q)/2, d=(p−q)/2.
// Каждый множитель → серия с периодом π/m; вложенные серии дедуплицируются.
// ============================================================================

// текст периода T·n: T = a·π/b → «2πn», «πn», «πn/2», «πn/3»…
function periodText(T) {
  const a = Math.abs(T.p), b = T.q, num = a === 1 ? "π" : `${a}π`
  return b === 1 ? `${num}n` : `${num}n/${b}`
}
function seriesTextGen(s) {
  return s.base.p === 0 ? `x = ${periodText(s.T)}` : `x = ${fmtPi(s.base)} + ${periodText(s.T)}`
}
// серия s1 ⊆ s2 ? (T1 кратно T2 и base1−base2 кратно T2)
function seriesSubset(s1, s2) {
  const ratio = Rdiv(s1.T, s2.T)
  if (ratio.q !== 1 || ratio.p <= 0) return false
  return Rdiv(Rsub(s1.base, s2.base), s2.T).q === 1
}
// отрезок для плотных серий (период π/m): 1–4 корня
function chooseIntervalSD(series) {
  for (let tries = 0; tries < 600; tries++) {
    const len = pick([1, 2, 2, 3]), k = randInt(-8, 6)
    const L = R(k, 2), Rr = R(k + len, 2)
    const roots = rootsInInterval(series, L, Rr)
    if (roots.length >= 1 && roots.length <= 4) return { L, R: Rr, roots }
  }
  for (let k = -8; k <= 8; k++) { const L = R(k, 2), Rr = R(k + 2, 2); const roots = rootsInInterval(series, L, Rr); if (roots.length) return { L, R: Rr, roots } }
  return null
}
function finishSeries(eq, seriesList, residual) {
  const kept = seriesList.filter((si, i) =>
    !seriesList.some((sj, j) => j !== i && seriesSubset(si, sj) && (!seriesSubset(sj, si) || j < i)))
  const iv = chooseIntervalSD(kept)
  if (!iv) return null
  const { L, R: Rr, roots } = iv
  return {
    condition_text: `а) Решите уравнение\n${eq}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${fmtPiCond(L)}; ${fmtPiCond(Rr)}].`,
    answer: `а) ${kept.map(seriesTextGen).join(",  ")}, n ∈ ℤ\nб) ${roots.map(fmtPi).join(";  ")}`,
    _verify: { residual, realResidual: residual, roots: roots.map(Rnum), L: Rnum(L), R: Rnum(Rr) },
  }
}
function t13SumDiff() {
  const [p, q] = pick([[3, 1], [5, 1], [5, 3]])
  const s = (p + q) / 2, d = (p - q) / 2
  const type = pick(["sinsum", "sindiff", "cossum", "cosdiff"])
  const zSin = (m) => ({ base: R(0), T: R(1, m) })           // sin(mx)=0 → x=πk/m
  const zCos = (m) => ({ base: R(1, 2 * m), T: R(1, m) })    // cos(mx)=0 → x=π/(2m)+πk/m
  const pStr = `${p}x`, qStr = q === 1 ? "x" : `${q}x`
  let eq, series
  if (type === "sinsum") { eq = `sin ${pStr} + sin ${qStr} = 0`; series = [zSin(s), zCos(d)] }
  else if (type === "sindiff") { eq = `sin ${pStr} ${MINUS} sin ${qStr} = 0`; series = [zCos(s), zSin(d)] }
  else if (type === "cossum") { eq = `cos ${pStr} + cos ${qStr} = 0`; series = [zCos(s), zCos(d)] }
  else { eq = `cos ${pStr} ${MINUS} cos ${qStr} = 0`; series = [zSin(s), zSin(d)] }
  const residual = (x) => {
    const P = type[0] === "s" ? Math.sin(p * x) : Math.cos(p * x)
    const Q = type[0] === "s" ? Math.sin(q * x) : Math.cos(q * x)
    return type.endsWith("sum") ? P + Q : P - Q
  }
  return finishSeries(eq, series, residual)
}

// ============================================================================
// СЕМЕЙСТВО «АРКСИНУСЫ / АРККОСИНУСЫ / АРКТАНГЕНСЫ» — «некруглые» значения.
// Квадрат по sin/cos/tg → корень = arcsin(a)/arccos(a)/arctg(a). Арк-серии несут
// символьный угол; перечисление корней на отрезке — численно.
// ============================================================================

// «некруглая» дробь: |p/q|<1, q∈{3..7}, взаимно проста (не ½,0,±1)
function makeUglyFrac() {
  const q = pick([3, 4, 5, 6, 7]); let p = randInt(1, q - 1) * pick([1, -1]), g = 0
  while (gcd(Math.abs(p), q) !== 1 && g++ < 20) p = randInt(1, q - 1) * pick([1, -1])
  return R(p, q)
}
const fracA = (aR) => aR.q === 1 ? intT(aR.p) : `${aR.p < 0 ? MINUS : ""}${Math.abs(aR.p)}/${aR.q}`
// арк-серии для fn=sin/cos/tg = aR (aR — R). Возвращают {basePi,sign,alpha,alphaText,Tpi,genText}.
function makeArcSeries(fn, aR) {
  const a = aR.p / aR.q, aStr = fracA(aR)
  if (fn === "tg") return [{ arc: 1, basePi: R(0), sign: 1, alpha: Math.atan(a), alphaText: `arctg(${aStr})`, Tpi: PI, genText: `x = arctg(${aStr}) + πn` }]
  if (fn === "sin") {
    const al = Math.asin(a)
    return [
      { arc: 1, basePi: R(0), sign: 1, alpha: al, alphaText: `arcsin(${aStr})`, Tpi: TWO_PI, genText: `x = arcsin(${aStr}) + 2πn` },
      { arc: 1, basePi: PI, sign: -1, alpha: al, alphaText: `arcsin(${aStr})`, Tpi: TWO_PI, genText: `x = π ${MINUS} arcsin(${aStr}) + 2πn` },
    ]
  }
  const ac = Math.acos(a)                                    // cos
  return [
    { arc: 1, basePi: R(0), sign: 1, alpha: ac, alphaText: `arccos(${aStr})`, Tpi: TWO_PI, genText: `x = ±arccos(${aStr}) + 2πn` },
    { arc: 1, basePi: R(0), sign: -1, alpha: ac, alphaText: `arccos(${aStr})`, Tpi: TWO_PI, genText: "" },
  ]
}
// перечислить арк-корни на [Ln;Rn] (численно) → [{num,text}]; domainOK фильтрует
function enumArc(arcSeries, Ln, Rn, domainOK = null) {
  const out = []
  for (const s of arcSeries) {
    const T = Rnum(s.Tpi), base = Rnum(s.basePi) + s.sign * s.alpha
    for (let n = Math.ceil((Ln - base) / T - 1e-9); n <= Math.floor((Rn - base) / T + 1e-9); n++) {
      const num = base + T * n
      if (domainOK && !domainOK(num)) continue
      const piPart = Radd(s.basePi, Rmuln(s.Tpi, n))
      const text = piPart.p === 0 ? `${s.sign > 0 ? "" : MINUS}${s.alphaText}` : `${fmtPi(piPart)} ${s.sign > 0 ? "+" : MINUS} ${s.alphaText}`
      out.push({ num, text })
    }
  }
  return out
}
const dedupSort = (arr) => {
  const m = new Map()
  for (const r of arr) { const k = Math.round(r.num * 1e6); if (!m.has(k)) m.set(k, r) }
  return [...m.values()].sort((a, b) => a.num - b.num)
}
// сборка: rSeries (рациональные π-серии), arcSeries; genParts — тексты общего решения.
function finishArc(eq, rSeries, arcSeries, genParts, residual, domainOK = null) {
  for (let tries = 0; tries < 500; tries++) {
    const len = pick([2, 3, 4]), k = randInt(-10, 8)
    const L = R(k, 2), Rr = R(k + len, 2), Ln = Rnum(L), Rn = Rnum(Rr)
    const rr = [...rootsInInterval(rSeries, L, Rr, domainOK).map((r) => ({ num: Rnum(r), text: fmtPi(r) })), ...enumArc(arcSeries, Ln, Rn, domainOK)]
    const ded = dedupSort(rr)
    if (ded.length >= 1 && ded.length <= 3) {
      return {
        condition_text: `а) Решите уравнение\n${eq}`,
        condition_tail: `б) Найдите корни, принадлежащие отрезку [${fmtPiCond(L)}; ${fmtPiCond(Rr)}].`,
        answer: `а) ${genParts.join(",  ")}, n ∈ ℤ\nб) ${ded.map((r) => r.text).join(";  ")}`,
        _verify: { residual, realResidual: residual, domainOK, roots: ded.map((r) => r.num), L: Ln, R: Rn },
      }
    }
  }
  return null
}
// приведённая (без полюсов) форма для tg-квадрата: a·sin²+b·sin·cos+c·cos² (нули = tg=корни)
function makeResidualTan(a, b, c) {
  return (x) => { const s = Math.sin(x), co = Math.cos(x); return a * s * s + b * s * co + c * co * co }
}

function t13ArcSin() {
  const uR = makeUglyFrac()
  const nice = Math.random() < 0.5
  const v2key = nice ? pick(["half", "neghalf", "one", "negone"]) : null
  const v2R = nice ? AS_R[v2key] : pick(EXTRAN)
  const q0 = buildQuadFromRoots([uR, v2R])
  const eq = fmtQuad(q0.a, q0.b, q0.c, "sin²x", "sin x")
  const arcS = makeArcSeries("sin", uR)
  const rSeries = nice ? seriesFor("sin", v2key) : []
  const genParts = [...arcS.filter((s) => s.genText).map((s) => s.genText), ...(nice ? [textFor("sin", v2key)] : [])]
  return finishArc(eq, rSeries, arcS, genParts, makeResidual("sin", q0.a, q0.b, q0.c))
}
function t13ArcCos() {
  const uR = makeUglyFrac()
  const nice = Math.random() < 0.5
  const v2key = nice ? pick(["half", "neghalf", "one", "negone"]) : null
  const v2R = nice ? AS_R[v2key] : pick(EXTRAN)
  const q0 = buildQuadFromRoots([uR, v2R])
  const eq = fmtQuad(q0.a, q0.b, q0.c, "cos²x", "cos x")
  const arcS = makeArcSeries("cos", uR)
  const rSeries = nice ? seriesFor("cos", v2key) : []
  const genParts = [...arcS.filter((s) => s.genText).map((s) => s.genText), ...(nice ? [textFor("cos", v2key)] : [])]
  return finishArc(eq, rSeries, arcS, genParts, makeResidual("cos", q0.a, q0.b, q0.c))
}
const TAN_UGLY = [R(2), R(3), R(-2), R(-3), R(1, 3), R(-1, 3), R(2, 3), R(3, 2), R(-3, 2)]
function t13ArcTan() {
  const u1 = pick(TAN_UGLY)
  let u2 = pick(TAN_UGLY), g = 0
  while ((u2.p * u1.q === u1.p * u2.q) && g++ < 20) u2 = pick(TAN_UGLY)
  const q0 = buildQuadFromRoots([u1, u2])
  const eq = fmtQuad(q0.a, q0.b, q0.c, "tg²x", "tg x")
  const arcS = [...makeArcSeries("tg", u1), ...makeArcSeries("tg", u2)]
  const genParts = arcS.map((s) => s.genText)
  return finishArc(eq, [], arcS, genParts, makeResidualTan(q0.a, q0.b, q0.c), (x) => Math.abs(Math.cos(x)) > 1e-9)
}

// ============================================================================
// СЕМЕЙСТВО «АРКИ В ОДНИХ ТОЧКАХ» — (триг)/(триг) = 0: знаменатель обнуляется ровно
// на ОДНОЙ арк-ветви числителя (пифагорова тройка) → её исключаем.
// ============================================================================

const PYTH13 = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]]
// (c·cosx − a)/(a·tgx + b) = 0 → cosx=a/c; ветвь −arccos (sinx=−b/c, tgx=−b/a) даёт знам.=0 → искл.
function t13FracArcCosTg() {
  let [a, b, c] = pick(PYTH13); if (Math.random() < 0.5)[a, b] = [b, a]   // любой катет — «cos»
  const aR = R(a, c), ac = Math.acos(a / c), aStr = fracA(aR)
  const eq = `⟦f:${c}cos x ${MINUS} ${a}:${a}tg x + ${b}⟧ = 0`
  const arcS = [{ arc: 1, basePi: R(0), sign: 1, alpha: ac, alphaText: `arccos(${aStr})`, Tpi: TWO_PI, genText: `x = arccos(${aStr}) + 2πn` }]
  const residual = (x) => c * Math.cos(x) - a
  // порог знаменателя 0,05 (не 1e−9): исключённая ветвь −arccos совпадает с нулём знаменателя,
  // и сетка полноты не попадает в него точно; легальные корни имеют |знам.| ≫ 0,05.
  const domainOK = (x) => Math.abs(Math.cos(x)) > 1e-9 && Math.abs(a * Math.tan(x) + b) > 0.05
  return finishArc(eq, [], arcS, [arcS[0].genText], residual, domainOK)
}
// (c·sin²x − a·sinx)/(c·cosx + b) = 0 → sinx=0 ∪ sinx=a/c; ветвь π−arcsin (cosx=−b/c) → знам.=0, искл.
function t13FracArcSinCos() {
  let [a, b, c] = pick(PYTH13); if (Math.random() < 0.5)[a, b] = [b, a]
  const aR = R(a, c), asn = Math.asin(a / c), aStr = fracA(aR)
  const eq = `⟦f:${c}sin²x ${MINUS} ${a}sin x:${c}cos x + ${b}⟧ = 0`
  const arcS = [{ arc: 1, basePi: R(0), sign: 1, alpha: asn, alphaText: `arcsin(${aStr})`, Tpi: TWO_PI, genText: `x = arcsin(${aStr}) + 2πn` }]
  const rSeries = seriesFor("sin", "zero")
  const residual = (x) => Math.sin(x) * (c * Math.sin(x) - a)
  const domainOK = (x) => Math.abs(c * Math.cos(x) + b) > 0.05   // см. пояснение в t13FracArcCosTg
  return finishArc(eq, rSeries, arcS, ["x = πn", arcS[0].genText], residual, domainOK)
}

// ── реестр ──────────────────────────────────────────────────────────────────
export const GEN13 = [
  t13SinQuad, t13CosQuad, t13CosSqSinLin, t13SinSqCosLin,
  t13Cos2xSin, t13Cos2xCos, t13CosSqMinusCos2x,
  t13FactorTgSin2x, t13FactorCtgSin2x, t13FactorSinMinusCos, t13FactorSinPlusCos, t13FactorCosTimesEq1,
  t13ExpSumPow, t13ExpQuadInAx, t13ExpHomogQuad,
  t13LogQuad, t13LogDiff,
  t13ProductAlgTrig, t13ProductSqrt,
  t13IrrSin, t13IrrCos,
  t13ExpTrigProduct, t13ExpTrigSym, t13ExpTrigQuad, t13ExpTrigTower,
  t13LogTrigProd, t13LogTrigQuad,
  t13BiquadSin, t13BiquadCos, t13BiquadCtgSin, t13BiquadTgCos,
  t13Rational,
  t13Grouping,
  t13SumDiff,
  t13ArcSin, t13ArcCos, t13ArcTan,
  t13FracArcCosTg, t13FracArcSinCos,
]

export const META13 = [
  ["Тригонометрические: квадратные уравнения", [
    ["sin-quad", "a·sin²x+b·sinx+c=0", t13SinQuad],
    ["cos-quad", "a·cos²x+b·cosx+c=0", t13CosQuad],
    ["cossq-sinlin", "A·cos²x+B·sinx+C=0 (cos²=1−sin²)", t13CosSqSinLin],
    ["sinsq-coslin", "A·sin²x+B·cosx+C=0 (sin²=1−cos²)", t13SinSqCosLin],
    ["cos2x-sin", "P·cos2x+Q·sinx+R=0", t13Cos2xSin],
    ["cos2x-cos", "P·cos2x+Q·cosx+R=0", t13Cos2xCos],
    ["cossq-cos2x", "cos²x−cos2x=0,75", t13CosSqMinusCos2x],
  ]],
  ["Тригонометрические: вынос общего множителя (ОДЗ)", [
    ["tg-sin2x", "A·tgx−B·sin2x=0 (cosx≠0)", t13FactorTgSin2x],
    ["ctg-sin2x", "A·ctgx−B·sin2x=0 (sinx≠0)", t13FactorCtgSin2x],
    ["sinmcos-tg", "2(sinx−cosx)=tgx−1", t13FactorSinMinusCos],
    ["sinpcos-ctg", "2(sinx+cosx)=ctgx+1", t13FactorSinPlusCos],
    ["cos-times-eq1", "cosx(2cosx+tgx)=1 (отсев по ОДЗ)", t13FactorCosTimesEq1],
  ]],
  ["Показательные", [
    ["exp-sumpow", "a^(u+k)+a^u=N, u=x²+px (корни h±√M)", t13ExpSumPow],
    ["exp-quad-ax", "b^x−a^(x+s)+C=0 (t=aˣ → n и logₐ)", t13ExpQuadInAx],
    ["exp-homog", "P·(a²)^u+Q·(ab)^u+R·(b²)^u=0 (однородное)", t13ExpHomogQuad],
  ]],
  ["Логарифмические", [
    ["log-quad", "A·log²ₐx+B·logₐx+C=0 (корни aⁿ)", t13LogQuad],
    ["log-diff", "logₐf=logₐg, f,g квадратные (ОДЗ f,g>0)", t13LogDiff],
  ]],
  ["Произведение / дробь = 0", [
    ["prod-alg-trig", "(алгебр. квадрат)(2cosx±1)=0 (десятич.+π)", t13ProductAlgTrig],
    ["prod-sqrt", "P(триг)·√(k·триг)=0 (знаковая ОДЗ, √=0)", t13ProductSqrt],
  ]],
  ["Иррациональные (тригонометрия под корнем)", [
    ["irr-sin", "sinx+√(C(1−cosx))=0 (ОДЗ sinx≤0)", t13IrrSin],
    ["irr-cos", "cosx+√(C(sinx+1))=0 (ОДЗ cosx≤0)", t13IrrCos],
  ]],
  ["Показательные × тригонометрия", [
    ["et-product", "(ab)^E=a^E·b^F → tgx=±1", t13ExpTrigProduct],
    ["et-sym", "p^T+p^{−T}=k → trig=±v / 0", t13ExpTrigSym],
    ["et-quad", "a·(p²)^T+b·p^T+c=0 → trig=значения", t13ExpTrigQuad],
    ["et-tower", "((q²)^sinx)^cosx=q^{r·sinx} → sinx=0∪cos=r/2", t13ExpTrigTower],
  ]],
  ["Логарифмические × тригонометрия", [
    ["lt-prod", "logₐ(T±sin2x+aᵏ)=k → T=0∪other=∓1/2", t13LogTrigProd],
    ["lt-quad", "A·log²₂(2·триг)+B·log₂(2·триг)+C=0", t13LogTrigQuad],
  ]],
  ["Биквадратные (дробно-квадратные по 1/sin, 1/cos)", [
    ["bq-sin", "A/sin²x+B/sinx+C=0 (ОДЗ sinx≠0)", t13BiquadSin],
    ["bq-cos", "A/cos²x+B/cosx+C=0 (ОДЗ cosx≠0)", t13BiquadCos],
    ["bq-ctg-sin", "1/tg²x+B/sinx+C=0", t13BiquadCtgSin],
    ["bq-tg-cos", "tg²x+B/cosx+C=0", t13BiquadTgCos],
  ]],
  ["Рациональные (симметричная подстановка)", [
    ["rational", "(x+m)²/D+M/(x+m)²=P(…)+Q → 4 целых корня", t13Rational],
  ]],
  ["Группировка", [
    ["grouping", "A·sin2x+B·sinx+C·cosx+D=0 → cos=vc∪sin=vs", t13Grouping],
  ]],
  ["Сумма / разность sin, cos", [
    ["sum-diff", "sin px ± sin qx = 0 → произведение", t13SumDiff],
  ]],
  ["Арксинусы / арккосинусы / арктангенсы", [
    ["arcsin", "a·sin²x+b·sinx+c=0 → arcsin(«некруглое»)", t13ArcSin],
    ["arccos", "a·cos²x+b·cosx+c=0 → arccos(«некруглое»)", t13ArcCos],
    ["arctg", "a·tg²x+b·tgx+c=0 → arctg(«некруглое»)", t13ArcTan],
  ]],
  ["Арки в одних точках (дробь = 0)", [
    ["frac-cos-tg", "(c·cosx−a)/(a·tgx+b)=0 → одна ветвь arccos", t13FracArcCosTg],
    ["frac-sin-cos", "(c·sin²x−a·sinx)/(c·cosx+b)=0 → sinx=0∪одна ветвь arcsin", t13FracArcSinCos],
  ]],
]

// ── самопроверка (для смоук-теста node) ─────────────────────────────────────
// residual(x)=0 на всех корнях, корни в [L;R], и на сетке нет пропущенных корней.
export function verify13(item) {
  if (!item || !item._verify) return { ok: false, err: "нет объекта/_verify" }
  const { residual, realResidual, domainOK, roots, L, R: Rr } = item._verify
  const EPS = 1e-7
  const okDom = domainOK || (() => true)
  // порог 1e−5: √-множитель усиливает float-шум у √=0-корней (√(k·1e−15)); реальная
  // ошибка даёт residual ~O(1), поэтому не маскируется.
  for (const x of roots) {
    // приведённая форма (без полюсов) = 0
    if (Math.abs(residual(x)) > 1e-5) return { ok: false, err: `residual(${x})=${residual(x)}` }
    // фактическое уравнение = 0 (связь приведённой формы с показанным уравнением)
    if (realResidual && Math.abs(realResidual(x)) > 1e-5) return { ok: false, err: `realResidual(${x})=${realResidual(x)}` }
    // ОДЗ и попадание в отрезок
    if (!okDom(x)) return { ok: false, err: `корень ${x} вне ОДЗ` }
    if (x < L - EPS || x > Rr + EPS) return { ok: false, err: `корень ${x} вне [${L};${Rr}]` }
  }
  // полнота: смены знака приведённой формы (без полюсов); каждый кандидат либо в списке,
  // либо отсечён по ОДЗ.
  const N = 20000
  const h = (Rr - L) / N
  let prev = residual(L)
  for (let i = 1; i <= N; i++) {
    const x = L + h * i
    const cur = residual(x)
    if (prev === 0 || (prev < 0) !== (cur < 0)) {
      const inList = roots.some((r) => Math.abs(r - x) < h * 3)
      const domViolated = !okDom(x - h / 2) || !okDom(x)
      if (!inList && !domViolated && Math.abs(cur) > 1e-3 && Math.abs(prev) > 1e-3) {
        return { ok: false, err: `пропущен корень около ${x}` }
      }
    }
    prev = cur
  }
  return { ok: true }
}
