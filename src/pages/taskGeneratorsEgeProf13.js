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
function fmtQuad(a, b, c, sq, lin) {
  let s = ""
  s += a === 1 ? sq : a === -1 ? `${MINUS}${sq}` : `${a < 0 ? MINUS : ""}${Math.abs(a)}${sq}`
  if (b !== 0) {
    const bs = b < 0 ? ` ${MINUS} ` : " + "
    s += `${bs}${Math.abs(b) === 1 ? "" : Math.abs(b)}${lin}`
  }
  if (c !== 0) s += `${c < 0 ? ` ${MINUS} ` : " + "}${Math.abs(c)}`
  return `${s} = 0`
}

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

// ── реестр ──────────────────────────────────────────────────────────────────
export const GEN13 = [
  t13SinQuad, t13CosQuad, t13CosSqSinLin, t13SinSqCosLin,
  t13Cos2xSin, t13Cos2xCos, t13CosSqMinusCos2x,
  t13FactorTgSin2x, t13FactorCtgSin2x, t13FactorSinMinusCos, t13FactorSinPlusCos, t13FactorCosTimesEq1,
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
]

// ── самопроверка (для смоук-теста node) ─────────────────────────────────────
// residual(x)=0 на всех корнях, корни в [L;R], и на сетке нет пропущенных корней.
export function verify13(item) {
  if (!item || !item._verify) return { ok: false, err: "нет объекта/_verify" }
  const { residual, realResidual, domainOK, roots, L, R: Rr } = item._verify
  const EPS = 1e-7
  const okDom = domainOK || (() => true)
  for (const x of roots) {
    // приведённая форма (без полюсов) = 0
    if (Math.abs(residual(x)) > 1e-6) return { ok: false, err: `residual(${x})=${residual(x)}` }
    // фактическое уравнение = 0 (связь приведённой формы с показанным уравнением)
    if (realResidual && Math.abs(realResidual(x)) > 1e-6) return { ok: false, err: `realResidual(${x})=${realResidual(x)}` }
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
