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
// подстрочник для нецелого основания логарифма: 1.5 → «₁,₅»
const subDec = (v) => subU(String(v).replace(".", ","))

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
function assemble(equationText, fn, coeffs, vals, realResidual = null) {
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
    _verify: { residual, realResidual, roots: roots.map(Rnum), L: Rnum(L), R: Rnum(Rr) },
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
// Дисплей: A=a, B=−b, C=−(a+c).  И квадрат, и линейный член маскируются приведением
// (как в ФИПИ: 6cos²(x−π/2)+11sin(3π/2+x)−10=0) — буквальная запись проверяется realResidual.
function t13CosSqSinLin() { return retryGen(t13CosSqSinLinOnce) }
function t13CosSqSinLinOnce() {
  const { vals, roots } = pickTargets()          // цели в sin
  const q = buildQuadFromRoots(roots)            // приведённый sin-квадрат (a,b,c)
  if (q.b === 0) return null                     // без линейного члена задача вырождается
  const A = q.a, B = -q.b, C = -(q.a + q.c)      // дисплей: A·cos²x + B·sinx + C
  const [sqStr, sqEv] = redSq("cos")
  const sg = pick([1, -1])
  const [linStr, linEv] = redLin("sin", sg)
  const eq = fmtQuad(A, B * sg, C, sqStr, linStr)
  return assemble(eq, "sin", q, vals, (x) => A * sqEv(x) + B * sg * linEv(x) + C)
}

// A·sin²x + B·cosx + C = 0  (sin²=1−cos²).  Цели в cos.
function t13SinSqCosLin() { return retryGen(t13SinSqCosLinOnce) }
function t13SinSqCosLinOnce() {
  const { vals, roots } = pickTargets()          // цели в cos
  const q = buildQuadFromRoots(roots)            // приведённый cos-квадрат
  if (q.b === 0) return null
  const A = q.a, B = -q.b, C = -(q.a + q.c)
  const [sqStr, sqEv] = redSq("sin")
  const sg = pick([1, -1])
  const [linStr, linEv] = redLin("cos", sg)
  const eq = fmtQuad(A, B * sg, C, sqStr, linStr)
  return assemble(eq, "cos", q, vals, (x) => A * sqEv(x) + B * sg * linEv(x) + C)
}

// P·cos2x + Q·sinx + R = 0  (cos2x = 1 − 2sin²x).  Цели в sin; приведённый a·sin²+…, a чётное.
function t13Cos2xSin() { return retryGen(t13Cos2xSinOnce) }
function t13Cos2xSinOnce() {
  const { vals, roots } = pickTargets()
  let q = buildQuadFromRoots(roots)
  if (q.b === 0) return null
  if (q.a % 2 !== 0) q = { a: q.a * 2, b: q.b * 2, c: q.c * 2 }
  // t=−1: P=a/2, Q=−b, Rr=−c−a/2
  const P = q.a / 2, Q = -q.b, Rc = -q.c - q.a / 2
  const sg = pick([1, -1])
  const [linStr, linEv] = redLin("sin", sg)
  const eq = fmtQuad(P, Q * sg, Rc, "cos 2x", linStr)
  return assemble(eq, "sin", q, vals, (x) => P * Math.cos(2 * x) + Q * sg * linEv(x) + Rc)
}

// P·cos2x + Q·cosx + R = 0  (cos2x = 2cos²x − 1).  Цели в cos.
function t13Cos2xCos() { return retryGen(t13Cos2xCosOnce) }
function t13Cos2xCosOnce() {
  const { vals, roots } = pickTargets()
  let q = buildQuadFromRoots(roots)
  if (q.b === 0) return null
  if (q.a % 2 !== 0) q = { a: q.a * 2, b: q.b * 2, c: q.c * 2 }
  // t=1: P=a/2, Q=b, Rr=c+a/2
  const P = q.a / 2, Q = q.b, Rc = q.c + q.a / 2
  const sg = pick([1, -1])
  const [linStr, linEv] = redLin("cos", sg)
  const eq = fmtQuad(P, Q * sg, Rc, "cos 2x", linStr)
  return assemble(eq, "cos", q, vals, (x) => P * Math.cos(2 * x) + Q * sg * linEv(x) + Rc)
}

// cos²x − cos2x = C  ⟺  sin²x = C   и   sin²x + cos2x = C  ⟺  cos²x = C.
// C ∈ {0,25; 0,5; 0,75} → вторая функция² = 1−C → её значение ±√(1−C) → x = ±α + πn.
// (объявлено ниже по файлу: sqSolution/finishGen — hoisting функций это позволяет)
const CSQ_C = [{ txt: "0,25", u: R(3, 4) }, { txt: "0,5", u: R(1, 2) }, { txt: "0,75", u: R(1, 4) }]
function t13CosSqMinusCos2x() {
  const { txt, u } = pick(CSQ_C)
  const minus = Math.random() < 0.5                      // cos²x − cos2x = C  /  sin²x + cos2x = C
  const fn = minus ? "cos" : "sin"                       // функция, значение которой ищем
  const eq = minus ? `cos²x ${MINUS} cos 2x = ${txt}` : `sin²x + cos 2x = ${txt}`
  const Ff = minus ? Math.cos : Math.sin
  const C = u.p / u.q                                    // = 1 − Cчисло
  const residual = (x) => Ff(x) ** 2 - C
  const realResidual = minus
    ? (x) => Math.cos(x) ** 2 - Math.cos(2 * x) - (1 - C)
    : (x) => Math.sin(x) ** 2 + Math.cos(2 * x) - (1 - C)
  const entry = SQ_T.find((e) => Rkey(e.u) === Rkey(u))
  const sol = sqSolution(fn, entry, 1)
  return finishGen(eq, sol.series, residual, { realResidual, text: sol.text })
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
function assembleReal(eq, allRoots, residual, aBase = null, realResidual = null) {
  const sorted = allRoots.slice().sort((r1, r2) => r1.num - r2.num)
  const iv = pickRealInterval(sorted.map((r) => r.num), aBase)
  if (!iv) return null
  const inside = sorted.filter((r) => r.num >= iv.L.num - 1e-9 && r.num <= iv.R.num + 1e-9)
  return {
    condition_text: `а) Решите уравнение\n${eq}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${iv.L.text}; ${iv.R.text}].`,
    answer: `а) ${sorted.map((r) => "x = " + r.text).join(";  ")}\nб) ${inside.map((r) => r.text).join(";  ")}`,
    _verify: {
      residual, realResidual: realResidual || residual, roots: inside.map((r) => r.num),
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
function finishTrig(eq, targets, residual, domainOK = null, realResidual = null) {
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
    _verify: { residual, realResidual: realResidual || residual, domainOK, roots: roots.map(Rnum), L: Rnum(L), R: Rnum(Rr) },
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
function finishArc(eq, rSeries, arcSeries, genParts, residual, domainOK = null, realResidual = null) {
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
        _verify: { residual, realResidual: realResidual || residual, domainOK, roots: ded.map((r) => r.num), L: Ln, R: Rn },
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

// ============================================================================
// СЕМЕЙСТВО «ФОРМУЛЫ ПРИВЕДЕНИЯ (составные аргументы)» — tg(π+x), cos(2x−π/2)…
// Верификация — по БУКВАЛЬНОМУ выражению (Math.tan(π+x) и т.п.), чтобы поймать
// ошибку в тождестве приведения (не только в производной).
// ============================================================================

// [строка, численный вычислитель, знак относительно tg x / sin 2x]
const RED_LEFT = [
  ["tg(π + x)", (x) => Math.tan(Math.PI + x), 1], ["tg(x − π)", (x) => Math.tan(x - Math.PI), 1],
  ["tg(2π − x)", (x) => Math.tan(2 * Math.PI - x), -1], ["tg(π − x)", (x) => Math.tan(Math.PI - x), -1],
]
const RED_MID = [
  ["cos(2x − ⟦f:π:2⟧)", (x) => Math.cos(2 * x - Math.PI / 2), 1], ["cos(⟦f:3π:2⟧ + 2x)", (x) => Math.cos(3 * Math.PI / 2 + 2 * x), 1],
  ["cos(⟦f:π:2⟧ − 2x)", (x) => Math.cos(Math.PI / 2 - 2 * x), 1], ["cos(⟦f:π:2⟧ + 2x)", (x) => Math.cos(Math.PI / 2 + 2 * x), -1],
]
const RED_RHS = { "0.5": ["cos(−⟦f:π:3⟧)", "sin(⟦f:π:6⟧)"], "-0.5": ["cos(⟦f:2π:3⟧)", "sin(−⟦f:π:6⟧)"], "1": ["sin(⟦f:π:2⟧)"], "-1": ["sin(−⟦f:π:2⟧)", "cos(π)"] }
// A — tg(shift x)·cos(shift 2x) = const → σ·tgx·sin2x = C → σ·2sin²x = C → sin²=|C|/2.
function t13ReductProd() {
  const s2 = pick([{ v: 0.25, keys: ["half", "neghalf"] }, { v: 0.5, keys: ["r2half", "negr2half"] }])
  const sigma = pick([1, -1])
  const C = sigma * 2 * s2.v                                 // ∈ {±0.5, ±1}
  // подобрать left,mid так, чтобы sL·sM = sigma
  const L = pick(RED_LEFT), M = pick(RED_MID.filter((m) => m[2] * L[2] === sigma))
  if (!M) return null
  const rhs = pick(RED_RHS[String(C)])
  const eq = `${L[0]}·${M[0]} = ${rhs}`
  const residual = (x) => sigma * 2 * Math.sin(x) ** 2 - C   // приведённая (без полюсов)
  const real = (x) => L[1](x) * M[1](x) - C                  // буквальная (с полюсами tg)
  const domainOK = (x) => Math.abs(Math.cos(x)) > 1e-9
  return finishTrig(eq, s2.keys.map((key) => ({ fn: "sin", key })), residual, domainOK, real)
}
// B — [tg/ctg x] + cos(shift 2x) = 0, где cos(shift)=−sin2x → факторизация.
const RED_MIDB = [["cos(⟦f:π:2⟧ + 2x)", (x) => Math.cos(Math.PI / 2 + 2 * x)], ["cos(⟦f:3π:2⟧ − 2x)", (x) => Math.cos(3 * Math.PI / 2 - 2 * x)]]
function t13ReductFactor() {
  const isTg = Math.random() < 0.5
  const M = pick(RED_MIDB)
  if (isTg) {
    const eq = `tg x + ${M[0]} = 0`                          // tgx − sin2x=0 → sinx=0 ∪ cos²=½
    const residual = (x) => Math.sin(x) * (1 - 2 * Math.cos(x) ** 2)   // = −sinx·cos2x
    const real = (x) => Math.tan(x) + M[1](x)
    const domainOK = (x) => Math.abs(Math.cos(x)) > 1e-9
    return finishTrig(eq, [{ fn: "sin", key: "zero" }, { fn: "cos", key: "r2half" }, { fn: "cos", key: "negr2half" }], residual, domainOK, real)
  }
  const eq = `ctg x + ${M[0]} = 0`                           // ctgx − sin2x=0 → cosx=0 ∪ sin²=½
  const residual = (x) => Math.cos(x) * (1 - 2 * Math.sin(x) ** 2)
  const real = (x) => Math.cos(x) / Math.sin(x) + M[1](x)
  const domainOK = (x) => Math.abs(Math.sin(x)) > 1e-9
  return finishTrig(eq, [{ fn: "cos", key: "zero" }, { fn: "sin", key: "r2half" }, { fn: "sin", key: "negr2half" }], residual, domainOK, real)
}

// ============================================================================
// ОБЩИЕ УТИЛИТЫ ДЛЯ СЕМЕЙСТВ С КРАТНЫМ АРГУМЕНТОМ (2x, 4x, x/2)
// ============================================================================

// f(kx)=v → серии по x: делим базу и период на k (k может быть дробным ½ — тогда умножаем)
function scaleArg(series, k) { return series.map(({ base, T }) => ({ base: R(base.p, base.q * k), T: R(T.p, T.q * k) })) }
// умножение аргумента (полуугол): f(x/2)=v → серии ×2
function doubleArg(series) { return series.map(({ base, T }) => ({ base: Rmuln(base, 2), T: Rmuln(T, 2) })) }
// убрать серии, целиком вложенные в другие
function dedupeSeries(list) {
  return list.filter((si, i) => !list.some((sj, j) => j !== i && seriesSubset(si, sj) && (!seriesSubset(sj, si) || j < i)))
}
// текст набора серий; пара баз ±a с общим периодом сливается в «x = ±a + …»
function seriesListText(list) {
  const kept = dedupeSeries(list)
  const used = new Array(kept.length).fill(false)
  const parts = []
  for (let i = 0; i < kept.length; i++) {
    if (used[i]) continue
    let j = -1
    for (let m = i + 1; m < kept.length; m++) {
      if (used[m]) continue
      if (Rkey(kept[m].T) === Rkey(kept[i].T) && kept[m].base.p === -kept[i].base.p && kept[m].base.q === kept[i].base.q) { j = m; break }
    }
    if (j >= 0 && kept[i].base.p !== 0) {
      used[i] = true; used[j] = true
      const pos = kept[i].base.p > 0 ? kept[i].base : kept[j].base
      parts.push(`x = ±${fmtPi(pos)} + ${periodText(kept[i].T)}`)
    } else { used[i] = true; parts.push(seriesTextGen(kept[i])) }
  }
  return parts.join(",  ")
}
// универсальный выбор отрезка [L;R] (концы кратны π/2): 1..maxRoots корней
function chooseIntervalAny(series, domainOK = null, maxRoots = 3, lens = [2, 3, 3, 4, 4]) {
  for (let tries = 0; tries < 800; tries++) {
    const len = pick(lens), k = randInt(-12, 8)
    const L = R(k, 2), Rr = R(k + len, 2)
    const roots = rootsInInterval(series, L, Rr, domainOK)
    if (roots.length >= 1 && roots.length <= maxRoots) return { L, R: Rr, roots }
  }
  for (const len of [4, 6, 8]) for (let k = -14; k <= 12; k++) {
    const L = R(k, 2), Rr = R(k + len, 2)
    const roots = rootsInInterval(series, L, Rr, domainOK)
    if (roots.length && roots.length <= maxRoots + 2) return { L, R: Rr, roots }
  }
  return null
}
// универсальный финишер: серии + приведённый residual (+ буквальный realResidual)
function finishGen(eq, series, residual, opts = {}) {
  const kept = dedupeSeries(series)
  const iv = chooseIntervalAny(kept, opts.domainOK || null, opts.maxRoots || 3, opts.lens)
  if (!iv) return null
  const { L, R: Rr, roots } = iv
  return {
    condition_text: `а) Решите уравнение\n${eq}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${fmtPiCond(L)}; ${fmtPiCond(Rr)}].`,
    answer: `а) ${opts.text || seriesListText(kept)}, n ∈ ℤ\nб) ${roots.map(fmtPi).join(";  ")}`,
    _verify: {
      residual, realResidual: opts.realResidual || residual, domainOK: opts.domainOK || null,
      roots: roots.map(Rnum), L: Rnum(L), R: Rnum(Rr),
    },
  }
}
// повтор попытки: часть комбинаций параметров не даёт годного отрезка/целых коэффициентов
const retryGen = (f, n = 30) => { for (let i = 0; i < n; i++) { const o = f(); if (o) return o } return null }
// ведущее слагаемое левой части — положительное (меняем знаки всего уравнения, если
// это не портит правую часть)
function normalizeSides(lhs, rhs) {
  if (lhs.length && lhs[0].neg && (!rhs.length || rhs.every((t) => t.neg)))
    return [lhs.map((t) => ({ ...t, neg: !t.neg })), rhs.map((t) => ({ ...t, neg: !t.neg }))]
  return [lhs, rhs]
}
// сумма слагаемых [{neg,str}] с правильными знаками («−a + b − c»)
function sumStr(parts) {
  return parts.filter((p) => p && p.str).map((p, i) =>
    (i === 0 ? (p.neg ? MINUS : "") : (p.neg ? ` ${MINUS} ` : " + ")) + p.str).join("")
}

// ============================================================================
// СЕМЕЙСТВО «БИКВАДРАТНЫЕ (4-я степень)» — A·f⁴(kx) + B·f²(kx) + C = 0
// f²(kx)=u ⇒ f(kx)=±√u ⇒ kx = ±α + πn. Показ: чистый, через cos2kx, монический с дробью.
// ============================================================================

const SQ_T = [
  { u: R(1, 4), cos: R(1, 3), sin: R(1, 6) },
  { u: R(1, 2), cos: R(1, 4), sin: R(1, 4) },
  { u: R(3, 4), cos: R(1, 6), sin: R(1, 3) },
  { u: R(1), cos: R(0), sin: R(1, 2) },
]
const SQ_EXTRA = [R(2), R(3), R(4), R(-1), R(-2), R(3, 2), R(-1, 2), R(5, 4)]
// серии + текст для f²(kx)=u (α — четвертьугол из таблицы)
function sqSolution(fn, entry, k) {
  const alpha = fn === "cos" ? entry.cos : entry.sin
  const T = R(1, k)
  const b1 = R(alpha.p, alpha.q * k)
  if (alpha.p === 0 || alpha.p * 2 === alpha.q) {           // α=0 или π/2 → ± совпадают
    const s = { base: b1, T }
    return { series: [s], text: seriesTextGen(s) }
  }
  const b2 = R(-alpha.p, alpha.q * k)
  return { series: [{ base: b1, T }, { base: b2, T }], text: `x = ±${fmtPi(b1)} + ${periodText(T)}` }
}

function t13Biquart() { return retryGen(t13BiquartOnce) }
function t13BiquartOnce() {
  const fn = pick(["sin", "cos"])
  const k = Math.random() < 0.25 ? 2 : 1
  const e1 = pick(SQ_T)
  const twoValid = Math.random() < 0.4
  const e2 = twoValid ? pick(SQ_T.filter((e) => Rkey(e.u) !== Rkey(e1.u))) : null
  const u2 = e2 ? e2.u : pick(SQ_EXTRA)
  const { a, b, c } = buildQuadFromRoots([e1.u, u2])
  const argS = k === 1 ? "x" : "2x", arg2S = k === 1 ? "2x" : "4x"
  const F = fn
  const Ff = fn === "sin" ? Math.sin : Math.cos
  const t4 = (x) => { const t = Ff(k * x); return a * t ** 4 + b * t * t + c }
  const modes = ["pure", "pure", "double"]
  if (a > 1 && c % a === 0 && b % a !== 0) modes.push("monic")
  const mode = pick(modes)
  let eq, realResidual
  if (mode === "pure") {
    eq = fmtQuad(a, b, c, `${F}⁴${argS}`, `${F}²${argS}`)
    realResidual = t4
  } else if (mode === "monic") {
    const parts = [{ neg: false, str: `${F}⁴${argS}` }, { neg: b < 0, str: `⟦f:${Math.abs(b)}:${a}⟧${F}²${argS}` }]
    if (c !== 0) parts.push({ neg: c < 0, str: String(Math.abs(c / a)) })
    eq = sumStr(parts) + " = 0"
    realResidual = (x) => { const t = Ff(k * x); return t ** 4 + (b / a) * t * t + c / a }
  } else {
    // B·f² → через cos 2kx:  sin²=(1−cos2kx)/2, cos²=(1+cos2kx)/2
    let A = a, B = b, C = c
    if (B % 2 !== 0) { A *= 2; B *= 2; C *= 2 }
    const Pc = (fn === "sin" ? -1 : 1) * B / 2, Cc = C + B / 2
    if (Pc === 0) return null
    eq = fmtQuad(A, Pc, Cc, `${F}⁴${argS}`, `cos ${arg2S}`)
    realResidual = (x) => { const t = Ff(k * x); return A * t ** 4 + Pc * Math.cos(2 * k * x) + Cc }
  }
  const sols = [sqSolution(fn, e1, k), ...(e2 ? [sqSolution(fn, e2, k)] : [])]
  const series = sols.flatMap((s) => s.series)
  return finishGen(eq, series, t4, {
    realResidual, text: sols.map((s) => s.text).join(",  "), maxRoots: k === 1 ? 3 : 4,
    lens: k === 1 ? [2, 3, 3, 4] : [1, 2, 2],
  })
}

// ============================================================================
// СЕМЕЙСТВО «КВАДРАТ ПО ДВОЙНОМУ АРГУМЕНТУ» — P·cos4x + Q·f(2x) + R = 0
// (cos4x = 1−2sin²2x = 2cos²2x−1) и «P·cos4x + Q·sin²x + R = 0» (квадрат по cos2x).
// ============================================================================

function t13Cos4xQuad() { return retryGen(t13Cos4xQuadOnce) }
function t13Cos4xQuadOnce() {
  const fnLin = pick(["sin", "cos"])
  const { vals, roots } = pickTargets()
  let q = buildQuadFromRoots(roots)
  const pure = Math.random() < 0.35
  if (!pure && q.a % 2 !== 0) q = { a: q.a * 2, b: q.b * 2, c: q.c * 2 }
  const Ff = fnLin === "sin" ? Math.sin : Math.cos
  const reduced = (x) => { const t = Ff(2 * x); return q.a * t * t + q.b * t + q.c }
  let eq, realResidual
  if (pure) {
    eq = fmtQuad(q.a, q.b, q.c, `${fnLin}²2x`, `${fnLin} 2x`)
    realResidual = reduced
  } else {
    const P = q.a / 2
    const Q = fnLin === "sin" ? -q.b : q.b
    const Rc = fnLin === "sin" ? -q.c - q.a / 2 : q.c + q.a / 2
    if (Q === 0) return null
    eq = fmtQuad(P, Q, Rc, "cos 4x", `${fnLin} 2x`)
    realResidual = (x) => P * Math.cos(4 * x) + Q * Ff(2 * x) + Rc
  }
  const series = vals.flatMap((v) => scaleArg(seriesFor(fnLin, v), 2))
  return finishGen(eq, series, reduced, { realResidual, maxRoots: 4, lens: [1, 2, 2, 3] })
}

// P·cos4x + Q·sin²x + R = 0 → квадрат по cos2x (cos4x=2cos²2x−1, sin²x=(1−cos2x)/2).
function pickTargetsZ() {
  const pool = ["zero", "half", "neghalf", "one", "negone"]
  if (Math.random() < 0.6) { const v = pick(pool); return { vals: [v], roots: [AS_R[v], pick(EXTRAN)] } }
  const v1 = pick(pool); let v2 = pick(pool), g = 0
  while (v2 === v1 && g++ < 10) v2 = pick(pool)
  return { vals: [v1, v2], roots: [AS_R[v1], AS_R[v2]] }
}
function t13Cos4xSqLow() { return retryGen(t13Cos4xSqLowOnce) }
function t13Cos4xSqLowOnce() {
  const useSin = Math.random() < 0.5
  const { vals, roots } = pickTargetsZ()
  let q = buildQuadFromRoots(roots)
  if (q.a % 2 !== 0) q = { a: q.a * 2, b: q.b * 2, c: q.c * 2 }
  const P = q.a / 2
  const Q = useSin ? -2 * q.b : 2 * q.b
  if (Q === 0) return null
  const Rc = useSin ? q.c + q.a / 2 + q.b : q.c + q.a / 2 - q.b
  const eq = fmtQuad(P, Q, Rc, "cos 4x", useSin ? "sin²x" : "cos²x")
  const reduced = (x) => { const t = Math.cos(2 * x); return q.a * t * t + q.b * t + q.c }
  const realResidual = (x) => P * Math.cos(4 * x) + Q * (useSin ? Math.sin(x) ** 2 : Math.cos(x) ** 2) + Rc
  const series = vals.flatMap((v) => scaleArg(cosSeries(v), 2))
  return finishGen(eq, series, reduced, { realResidual, maxRoots: 4, lens: [1, 2, 2, 3] })
}

// ============================================================================
// СЕМЕЙСТВО «КУБИЧЕСКИЕ» — вынос общего множителя и группировка
// ============================================================================

// тождественные записи (строка + буквальный вычислитель): значение = указанной функции
const RED_P_SIN = [
  ["sin x", (x) => Math.sin(x)], ["sin(π − x)", (x) => Math.sin(Math.PI - x)],
  ["cos(x − ⟦f:π:2⟧)", (x) => Math.cos(x - Math.PI / 2)], ["cos(⟦f:π:2⟧ − x)", (x) => Math.cos(Math.PI / 2 - x)],
  ["cos(⟦f:3π:2⟧ + x)", (x) => Math.cos(3 * Math.PI / 2 + x)],
]
const RED_M_SIN = [
  ["sin(x − π)", (x) => Math.sin(x - Math.PI)], ["cos(x + ⟦f:π:2⟧)", (x) => Math.cos(x + Math.PI / 2)],
  ["cos(⟦f:3π:2⟧ − x)", (x) => Math.cos(3 * Math.PI / 2 - x)], ["cos(x − ⟦f:3π:2⟧)", (x) => Math.cos(x - 3 * Math.PI / 2)],
  ["cos(x + ⟦f:5π:2⟧)", (x) => Math.cos(x + 5 * Math.PI / 2)],
]
const RED_P_COS = [
  ["cos x", (x) => Math.cos(x)], ["cos(−x)", (x) => Math.cos(-x)],
  ["sin(⟦f:π:2⟧ − x)", (x) => Math.sin(Math.PI / 2 - x)], ["sin(⟦f:π:2⟧ + x)", (x) => Math.sin(Math.PI / 2 + x)],
  ["sin(x − ⟦f:3π:2⟧)", (x) => Math.sin(x - 3 * Math.PI / 2)],
]
const RED_M_COS = [
  ["cos(π − x)", (x) => Math.cos(Math.PI - x)], ["cos(π + x)", (x) => Math.cos(Math.PI + x)],
  ["sin(x − ⟦f:π:2⟧)", (x) => Math.sin(x - Math.PI / 2)], ["sin(⟦f:3π:2⟧ + x)", (x) => Math.sin(3 * Math.PI / 2 + x)],
]
// маска ±f: sign=+1 → строка равна f(x), sign=−1 → равна −f(x)
function redLin(fn, sign) {
  const tab = fn === "sin" ? (sign > 0 ? RED_P_SIN : RED_M_SIN) : (sign > 0 ? RED_P_COS : RED_M_COS)
  return pick(tab)
}
// квадраты (значение = sin²x либо cos²x)
const RED_SIN_SQ = [
  ["sin²x", (x) => Math.sin(x) ** 2], ["cos²(x − ⟦f:π:2⟧)", (x) => Math.cos(x - Math.PI / 2) ** 2],
  ["cos²(x + ⟦f:π:2⟧)", (x) => Math.cos(x + Math.PI / 2) ** 2], ["sin²(π − x)", (x) => Math.sin(Math.PI - x) ** 2],
]
const RED_COS_SQ = [
  ["cos²x", (x) => Math.cos(x) ** 2], ["sin²(x + ⟦f:π:2⟧)", (x) => Math.sin(x + Math.PI / 2) ** 2],
  ["sin²(x + ⟦f:3π:2⟧)", (x) => Math.sin(x + 3 * Math.PI / 2) ** 2], ["cos²(π − x)", (x) => Math.cos(Math.PI - x) ** 2],
]
const redSq = (fn) => pick(fn === "sin" ? RED_SIN_SQ : RED_COS_SQ)

// C1 — вынос: a·f³x = b·f x  ⇒ f=0 ∪ f²=b/a.  Линейный член показываем приведением.
const CUB_AB = [[4, 1, R(1, 4)], [2, 1, R(1, 2)], [4, 3, R(3, 4)]]
function t13CubicFactor() {
  const fn = pick(["sin", "cos"])
  const [a, b, u] = pick(CUB_AB)
  const entry = SQ_T.find((e) => Rkey(e.u) === Rkey(u))
  const rhs = Math.random() < 0.5
  const [linStr, linEv] = redLin(fn, rhs ? 1 : -1)
  const eq = rhs
    ? `${a}${fn}³x = ${b === 1 ? "" : b}${linStr}`
    : `${a}${fn}³x + ${b === 1 ? "" : b}${linStr} = 0`
  const Ff = fn === "sin" ? Math.sin : Math.cos
  const reduced = (x) => a * Ff(x) ** 3 - b * Ff(x)
  const realResidual = rhs ? (x) => a * Ff(x) ** 3 - b * linEv(x) : (x) => a * Ff(x) ** 3 + b * linEv(x)
  const zero = fn === "sin" ? { series: seriesFor("sin", "zero"), text: sinText("zero") } : { series: seriesFor("cos", "zero"), text: cosText("zero") }
  const sq = sqSolution(fn, entry, 1)
  return finishGen(eq, [...zero.series, ...sq.series], reduced, {
    realResidual, text: `${zero.text},  ${sq.text}`, maxRoots: 3,
  })
}

// C2 — группировка: (2f + p)(f² + m) = 0 ⇒ f = −p/2 (p = ±1, ±√2, ±√3).
const CUB_P = [
  { n: 1, r: 1, key: "neghalf" }, { n: -1, r: 1, key: "half" },
  { n: 1, r: 2, key: "negr2half" }, { n: -1, r: 2, key: "r2half" },
  { n: 1, r: 3, key: "negr3half" }, { n: -1, r: 3, key: "r3half" },
]
function t13CubicGroup() {
  const fn = pick(["sin", "cos"])
  const P = pick(CUB_P), m = pick([1, 2, 3])
  const pn = P.n * (P.r === 1 ? 1 : Math.sqrt(P.r))
  // 2f³ + p·f² + 2m·f + p·m
  const coefStr = (n, r, func) => r === 1
    ? { neg: n < 0, str: `${Math.abs(n) === 1 && func ? "" : Math.abs(n)}${func}` }
    : { neg: n < 0, str: `${Math.abs(n) === 1 ? "" : Math.abs(n)}⟦r:${r}⟧${func ? " " + func : ""}` }
  const eq = sumStr([
    { neg: false, str: `2${fn}³x` },
    coefStr(P.n, P.r, `${fn}²x`),
    { neg: false, str: `${2 * m}${fn} x` },
    coefStr(P.n * m, P.r, ""),
  ]) + " = 0"
  const Ff = fn === "sin" ? Math.sin : Math.cos
  const residual = (x) => { const t = Ff(x); return 2 * t ** 3 + pn * t * t + 2 * m * t + pn * m }
  return finishGen(eq, seriesFor(fn, P.key), residual, { text: textFor(fn, P.key) })
}

// C3 — группировка через основное тождество: A·f³x − A·f x ± ḡ²x = 0, A>0.
//   A f(f²−1) ± ḡ² = −A f·ḡ² ± ḡ² = ∓ḡ²(A f ∓ 1)  ⇒  ḡ=0 ∪ f = ±1/A.
const CUB_PYTH = [
  { r: 1, A: 2, sg: 1, key: "half" }, { r: 1, A: 2, sg: -1, key: "neghalf" },
  { r: 2, A: Math.sqrt(2), sg: 1, key: "r2half" }, { r: 2, A: Math.sqrt(2), sg: -1, key: "negr2half" },
]
function t13CubicPyth() {
  const fn = pick(["sin", "cos"])
  const co = fn === "sin" ? "cos" : "sin"
  const V = pick(CUB_PYTH)
  const mag = V.r === 1 ? "2" : `⟦r:${V.r}⟧`
  const [sqStr, sqEv] = redSq(co)
  const eq = sumStr([
    { neg: false, str: `${mag}${fn}³x` },
    { neg: true, str: `${mag}${fn} x` },
    { neg: V.sg < 0, str: sqStr },
  ]) + " = 0"
  const Ff = fn === "sin" ? Math.sin : Math.cos
  const Gf = co === "sin" ? Math.sin : Math.cos
  const residual = (x) => V.A * Ff(x) ** 3 - V.A * Ff(x) + V.sg * Gf(x) ** 2
  const realResidual = (x) => V.A * Ff(x) ** 3 - V.A * Ff(x) + V.sg * sqEv(x)
  return finishGen(eq, [...seriesFor(co, "zero"), ...seriesFor(fn, V.key)], residual, {
    realResidual, text: `${textFor(co, "zero")},  ${textFor(fn, V.key)}`,
  })
}

// ============================================================================
// СЕМЕЙСТВО «ВЫНОС ОБЩЕГО МНОЖИТЕЛЯ (смешанные члены)»
//   f(x)·(Csin·sin x + Ccos·cos x + S) = 0,  f ∈ {sin, cos}
// В показе: f² (можно с приведением), член sin x·cos x (как ½·sin 2x, как приведение
// cos(3π/2+2x), либо как произведение двух приведений), линейный член (с приведением).
// ============================================================================

// слагаемое n·√r·func (r=1 → без радикала); n=0 → нет слагаемого
function radTermRC(n, r, func) {
  if (n === 0) return null
  const mag = Math.abs(n)
  if (r === 1) return { neg: n < 0, str: `${mag === 1 && func ? "" : mag}${func}` }
  return { neg: n < 0, str: `${mag === 1 ? "" : mag}⟦r:${r}⟧${func ? " " + func : ""}` }
}
// записи, тождественно равные ±sin 2x
const RED_P_SIN2 = [
  ["sin 2x", (x) => Math.sin(2 * x)], ["cos(2x − ⟦f:π:2⟧)", (x) => Math.cos(2 * x - Math.PI / 2)],
  ["cos(⟦f:π:2⟧ − 2x)", (x) => Math.cos(Math.PI / 2 - 2 * x)], ["cos(⟦f:3π:2⟧ + 2x)", (x) => Math.cos(3 * Math.PI / 2 + 2 * x)],
]
const RED_M_SIN2 = [
  ["cos(⟦f:π:2⟧ + 2x)", (x) => Math.cos(Math.PI / 2 + 2 * x)], ["cos(⟦f:3π:2⟧ − 2x)", (x) => Math.cos(3 * Math.PI / 2 - 2 * x)],
  ["sin(−2x)", (x) => Math.sin(-2 * x)],
]
// записи, тождественно равные ±cos 2x
const RED_P_COS2 = [
  ["cos 2x", (x) => Math.cos(2 * x)], ["sin(⟦f:π:2⟧ − 2x)", (x) => Math.sin(Math.PI / 2 - 2 * x)],
  ["sin(⟦f:π:2⟧ + 2x)", (x) => Math.sin(Math.PI / 2 + 2 * x)], ["cos(−2x)", (x) => Math.cos(-2 * x)],
]
const RED_M_COS2 = [
  ["cos(π − 2x)", (x) => Math.cos(Math.PI - 2 * x)], ["cos(π + 2x)", (x) => Math.cos(Math.PI + 2 * x)],
  ["sin(2x − ⟦f:π:2⟧)", (x) => Math.sin(2 * x - Math.PI / 2)], ["sin(⟦f:3π:2⟧ + 2x)", (x) => Math.sin(3 * Math.PI / 2 + 2 * x)],
]
// внутри числителя/знаменателя ⟦f⟧ вложенная дробь невозможна — пишем π/2 в строку
const inlineFrac = (t) => t.replace(/⟦f:([^:⟧]+):([^:⟧]+)⟧/g, "$1/$2")
// цели второго множителя: значение = n·√r / 2
const MIX_V = [
  { n: 1, r: 1 }, { n: -1, r: 1 }, { n: 2, r: 1 }, { n: -2, r: 1 },
  { n: 1, r: 2 }, { n: -1, r: 2 }, { n: 1, r: 3 }, { n: -1, r: 3 },
]
// tg x = −Ccos/Csin
const MIX_TG = [
  { cs: { n: 2, r: 1 }, cc: { n: -2, r: 1 }, key: "one" }, { cs: { n: 2, r: 1 }, cc: { n: 2, r: 1 }, key: "negone" },
  { cs: { n: 2, r: 1 }, cc: { n: -2, r: 3 }, key: "r3" }, { cs: { n: 2, r: 1 }, cc: { n: 2, r: 3 }, key: "negr3" },
  { cs: { n: 2, r: 3 }, cc: { n: -2, r: 1 }, key: "invr3" }, { cs: { n: 2, r: 3 }, cc: { n: 2, r: 1 }, key: "neginvr3" },
]
const numOf = (c) => c.n * (c.r === 1 ? 1 : Math.sqrt(c.r))

function t13FactorMixed() { return retryGen(t13FactorMixedOnce) }
function t13FactorMixedOnce() {
  const f = pick(["sin", "cos"])
  const co = f === "sin" ? "cos" : "sin"
  const shape = pick(["same", "other", "tg", "tg"])
  let cs, cc, S, targetFn, targetKey
  if (shape === "tg") {
    const o = pick(MIX_TG)
    cs = o.cs; cc = o.cc; S = { n: 0, r: 1 }; targetFn = "tan"; targetKey = o.key
  } else {
    const g = shape === "same" ? f : co
    const V = pick(MIX_V)
    cs = g === "sin" ? { n: 2, r: 1 } : { n: 0, r: 1 }
    cc = g === "cos" ? { n: 2, r: 1 } : { n: 0, r: 1 }
    S = { n: -V.n, r: V.r }
    targetFn = g
    targetKey = numToTrigKey(V.n * (V.r === 1 ? 1 : Math.sqrt(V.r)) / 2)
    if (!targetKey) return null
  }
  // раскладка по членам показа
  const sq = f === "sin" ? cs : cc            // коэффициент при f²x
  const M = f === "sin" ? cc : cs             // коэффициент при sin x·cos x
  // слагаемое: строка + |коэффициент| + вычислитель (вклад = ±|coef|·val)
  const mkTerm = (n, r, func, ev) => {
    const t = radTermRC(n, r, func)
    return t && { ...t, mag: Math.abs(n) * (r === 1 ? 1 : Math.sqrt(r)), val: ev }
  }
  const terms = []
  if (sq.n !== 0) {
    const [sqStr, sqEv] = redSq(f)
    terms.push(mkTerm(sq.n, sq.r, sqStr, sqEv))
  }
  if (M.n !== 0) {
    if (M.n % 2 === 0 && Math.random() < 0.65) {                 // ½·M·sin 2x
      const sgn = pick([1, -1])
      const [s2Str, s2Ev] = pick(sgn > 0 ? RED_P_SIN2 : RED_M_SIN2)
      terms.push(mkTerm((M.n / 2) * sgn, M.r, s2Str, s2Ev))
    } else {                                                     // M·[±sin]·[±cos]
      const s1 = pick([1, -1]), s2 = pick([1, -1])
      const [aStr, aEv] = redLin("sin", s1), [bStr, bEv] = redLin("cos", s2)
      terms.push(mkTerm(M.n * s1 * s2, M.r, `${aStr}·${bStr}`, (x) => aEv(x) * bEv(x)))
    }
  }
  if (S.n !== 0) {
    const sgn = pick([1, -1])
    const [linStr, linEv] = redLin(f, sgn)
    terms.push(mkTerm(S.n * sgn, S.r, linStr, linEv))
  }
  if (terms.length < 2) return null
  // первым ставим положительное слагаемое (если есть)
  const posIdx = terms.findIndex((t) => !t.neg)
  if (posIdx > 0) terms.unshift(terms.splice(posIdx, 1)[0])
  // иногда переносим одно слагаемое в правую часть
  let lhs = terms, rhs = []
  if (terms.length >= 2 && Math.random() < 0.4) {
    const i = randInt(1, terms.length - 1)
    const t = terms[i]
    lhs = terms.filter((_, j) => j !== i)
    rhs = [{ ...t, neg: !t.neg }]
  }
  ;[lhs, rhs] = normalizeSides(lhs, rhs)
  const eq = `${sumStr(lhs)} = ${rhs.length ? sumStr(rhs) : "0"}`
  const contrib = (list) => (x) => list.reduce((s, t) => s + (t.neg ? -1 : 1) * t.mag * t.val(x), 0)
  const lf = contrib(lhs), rf = contrib(rhs)
  const csN = numOf(cs), ccN = numOf(cc), sN = numOf(S)
  const Ff = f === "sin" ? Math.sin : Math.cos
  const residual = (x) => Ff(x) * (csN * Math.sin(x) + ccN * Math.cos(x) + sN)
  const realResidual = (x) => lf(x) - rf(x)
  const series = [...seriesFor(f, "zero"), ...seriesFor(targetFn, targetKey)]
  return finishGen(eq, series, residual, {
    realResidual, text: `${textFor(f, "zero")},  ${textFor(targetFn, targetKey)}`,
  })
}

// ============================================================================
// СЕМЕЙСТВО «КВАДРАТНЫЕ С ИРРАЦИОНАЛЬНЫМИ КОЭФФИЦИЕНТАМИ»
// Корни: σ√r/2 (валидный) и рациональный v2 либо t√r (посторонний).
// Коэффициенты вида m + n√r; показ — прямой, «косквадратный» или через cos2x.
// ============================================================================

// коэффициент (m + n√r) при функции func → слагаемое {neg,str}
function radCoefTerm(m, n, r, func) {
  if (m === 0 && n === 0) return null
  if (n === 0) return { neg: m < 0, str: `${Math.abs(m) === 1 && func ? "" : Math.abs(m)}${func}` }
  if (m === 0) return { neg: n < 0, str: `${Math.abs(n) === 1 ? "" : Math.abs(n)}⟦r:${r}⟧${func ? " " + func : ""}` }
  // биномиальный коэффициент: минус выносим за скобку, положительную часть вперёд
  const rad0 = { neg: n < 0, str: `${Math.abs(n) === 1 ? "" : Math.abs(n)}⟦r:${r}⟧` }
  const num0 = { neg: m < 0, str: String(Math.abs(m)) }
  if (!func) return { pair: [num0, rad0] }                    // константа — двумя слагаемыми
  const bothNeg = m < 0 && n < 0
  const M = bothNeg ? -m : m, N = bothNeg ? -n : n
  const rad = { neg: N < 0, str: rad0.str }, num = { neg: M < 0, str: num0.str }
  const inner = N > 0 ? sumStr([rad, num]) : sumStr([num, rad])
  return { neg: bothNeg, str: `(${inner})${func}` }
}
// развернуть результат radCoefTerm в список слагаемых
const expandTerm = (t) => (t ? (t.pair ? t.pair : [t]) : [])

const RAD_V2_RAT = [R(1), R(-1), R(2), R(-2), R(3, 2), R(-3, 2)]
function t13QuadRad() { return retryGen(t13QuadRadOnce) }
function t13QuadRadOnce() {
  const r = pick([2, 3])
  const sg = pick([1, -1])
  const rt = Math.sqrt(r)
  const v1n = sg * rt / 2
  const v1key = numToTrigKey(v1n)
  if (!v1key) return null
  const ratMode = Math.random() < 0.5
  let v2n, v2key = null, mb, nb, mc, nc
  if (ratMode) {
    const v2 = pick(RAD_V2_RAT); v2n = v2.p / v2.q
    if (Math.abs(v2n) === 1) v2key = v2n > 0 ? "one" : "negone"
    else if (Math.abs(v2n) < 1) return null
    // a=2: b = −2(v1+v2) = −2v2 − sg√r ; c = 2·v1·v2 = sg·v2·√r
    if (!Number.isInteger(2 * v2n)) return null
    mb = -2 * v2n; nb = -sg; mc = 0; nc = sg * v2n
    if (!Number.isInteger(nc)) return null
  } else {
    const t = pick([R(3, 2), R(-3, 2), R(1), R(-1), R(2), R(-2)])
    const tn = t.p / t.q
    v2n = tn * rt
    if (Math.abs(v2n) <= 1) return null
    // b = −2(v1+v2) = −√r(sg + 2t) ; c = 2·v1·v2 = sg·t·r
    const nB = -(sg + 2 * tn)
    if (!Number.isInteger(nB)) return null
    const cC = sg * tn * r
    if (!Number.isInteger(cC)) return null
    mb = 0; nb = nB; mc = cC; nc = 0
  }
  const a = 2
  const bNum = mb + nb * rt, cNum = mc + nc * rt
  const fn = pick(["sin", "cos"])
  const Ff = fn === "sin" ? Math.sin : Math.cos
  const reduced = (x) => { const t = Ff(x); return a * t * t + bNum * t + cNum }
  const co = fn === "sin" ? "cos" : "sin"
  const mode = pick(["direct", "cosq", "cosq", "double"])
  let eq, realResidual
  if (mode === "direct") {
    eq = sumStr([{ neg: false, str: `${a}${fn}²x` }, ...expandTerm(radCoefTerm(mb, nb, r, `${fn} x`)), ...expandTerm(radCoefTerm(mc, nc, r, ""))]) + " = 0"
    realResidual = reduced
  } else if (mode === "cosq") {
    // A·ḡ²x + B·f x + C = 0, где ḡ²=1−f²: A=a, B=−b, C=−(a+c)
    const [sqStr, sqEv] = redSq(co)
    const [linStr, linEv] = redLin(fn, 1)
    eq = sumStr([{ neg: false, str: `${a}${sqStr}` }, ...expandTerm(radCoefTerm(-mb, -nb, r, linStr)), ...expandTerm(radCoefTerm(-(a + mc), -nc, r, ""))]) + " = 0"
    realResidual = (x) => a * sqEv(x) + (-bNum) * linEv(x) + (-(a + cNum))
  } else {
    // P·cos2x + Q·f x + R = 0, P=a/2, Q=±b, R=±c ± a/2
    const P = a / 2
    const qm = fn === "sin" ? -mb : mb, qn = fn === "sin" ? -nb : nb
    const rm = fn === "sin" ? -mc - P : mc + P, rn = fn === "sin" ? -nc : nc
    const [linStr, linEv] = redLin(fn, 1)
    eq = sumStr([{ neg: false, str: `${P === 1 ? "" : P}cos 2x` }, ...expandTerm(radCoefTerm(qm, qn, r, linStr)), ...expandTerm(radCoefTerm(rm, rn, r, ""))]) + " = 0"
    const qNum = qm + qn * rt, rNum = rm + rn * rt
    realResidual = (x) => P * Math.cos(2 * x) + qNum * linEv(x) + rNum
  }
  const vals = [v1key, ...(v2key ? [v2key] : [])]
  const series = vals.flatMap((v) => seriesFor(fn, v))
  return finishGen(eq, series, reduced, { realResidual, text: vals.map((v) => textFor(fn, v)).join(",  ") })
}

// ============================================================================
// СЕМЕЙСТВО «ПОЛУУГОЛ» — квадрат по f(x/2), спрятанный за cos x
//   cos x = 1 − 2sin²(x/2) = 2cos²(x/2) − 1.
//   a·s² + B·s + C = 0, s=f(x/2); показ: (a/2+C) ∓ (a/2)·cos x + B·f(x/2) = 0.
// ============================================================================

// посторонние корни s₂: рациональные (|s₂|>1) либо t·√r
const HALF_RAT = [R(3, 2), R(-3, 2), R(2), R(-2), R(5, 2), R(-5, 2)]
const HALF_T = { 2: [R(1), R(-1), R(3, 2), R(-3, 2), R(2), R(-2)], 3: [R(1), R(-1), R(2), R(-2)] }
function t13HalfAngle() { return retryGen(t13HalfAngleOnce) }
function t13HalfAngleOnce() {
  const f = pick(["sin", "cos"])
  const radMode = Math.random() < 0.6
  const a = pick([2, 4])
  let vNum, key, Bn, Br, C
  if (radMode) {
    const r = pick([2, 3]), sg = pick([1, -1])
    vNum = sg * Math.sqrt(r) / 2
    const t = pick(HALF_T[r]), tn = t.p / t.q
    const s2 = tn * Math.sqrt(r)
    if (Math.abs(s2) <= 1.0001) return null
    // B = −a(v+s₂) = −a√r(sg/2 + t) ; C = a·v·s₂ = a·sg·t·r/2
    const bn = -a * (sg / 2 + tn)
    C = a * sg * tn * r / 2
    if (!Number.isInteger(bn) || !Number.isInteger(C)) return null
    Bn = bn; Br = r
  } else {
    const sg = pick([1, -1]), n = pick([1, 2])
    vNum = sg * n / 2
    const s2 = pick(HALF_RAT), s2n = s2.p / s2.q
    if (Math.abs(s2n) <= 1.0001 || Math.abs(s2n - vNum) < 1e-9) return null
    const bn = -a * (vNum + s2n)
    C = a * vNum * s2n
    if (!Number.isInteger(bn) || !Number.isInteger(C)) return null
    Bn = bn; Br = 1
  }
  key = numToTrigKey(vNum)
  if (!key || Bn === 0) return null
  const Bnum = Bn * (Br === 1 ? 1 : Math.sqrt(Br))
  const Ff = f === "sin" ? Math.sin : Math.cos
  const residual = (x) => { const s = Ff(x / 2); return a * s * s + Bnum * s + C }
  // показ: константа + cos x + член с f(x/2)
  const cosCoef = (f === "sin" ? -1 : 1) * a / 2
  const constT = C + a / 2
  const half = `⟦f:x:2⟧`
  const terms = []
  if (constT !== 0) terms.push({ neg: constT < 0, str: String(Math.abs(constT)), mag: Math.abs(constT), val: () => 1 })
  terms.push({ ...radTermRC(cosCoef, 1, "cos x"), mag: Math.abs(cosCoef), val: (x) => Math.cos(x) })
  const bTerm = radTermRC(Bn, Br, `${f} ${half}`)
  terms.push({ ...bTerm, mag: Math.abs(Bn) * (Br === 1 ? 1 : Math.sqrt(Br)), val: (x) => Ff(x / 2) })
  // ФИПИ-показ: член с полууглом переносим вправо («5 − 2cos x = 5√2 sin(x/2)»),
  // если после переноса он положителен
  let lhs = terms.slice(), rhs = []
  const hi = terms.findIndex((t) => t.str.includes(half))
  if (terms[hi].neg && Math.random() < 0.85) {
    lhs = terms.filter((_, j) => j !== hi); rhs = [{ ...terms[hi], neg: false }]
  }
  const pi = lhs.findIndex((t) => !t.neg)
  if (pi > 0) lhs.unshift(lhs.splice(pi, 1)[0])
  ;[lhs, rhs] = normalizeSides(lhs, rhs)
  const eq = `${sumStr(lhs)} = ${rhs.length ? sumStr(rhs) : "0"}`
  const contrib = (list) => (x) => list.reduce((s, t) => s + (t.neg ? -1 : 1) * t.mag * t.val(x), 0)
  const lf = contrib(lhs), rf = contrib(rhs)
  const series = doubleArg(seriesFor(f, key))
  const genText = seriesListText(series)
  return finishGen(eq, series, residual, {
    realResidual: (x) => lf(x) - rf(x), text: genText, maxRoots: 2, lens: [2, 3, 3, 4],
  })
}

// ============================================================================
// СЕМЕЙСТВО «ФОРМУЛЫ СЛОЖЕНИЯ» — часть уравнения спрятана в составной аргумент
//   c·A(θ) + c·k·B(θ) = c·M·G(θ ⊕ φ);  «лишнее» слагаемое c·k·B(θ) уходит вправо.
// ============================================================================

// A — спрятанная функция; dk — коэффициент подсадного слагаемого (при co-функции);
// M — множитель перед составным аргументом; forms — записи составного аргумента.
const FOLD = [
  { A: "cos", dk: { n: 1, r: 3 }, M: { n: 2, r: 1 }, forms: [["cos(θ − ⟦f:π:3⟧)", (t) => Math.cos(t - Math.PI / 3)], ["sin(θ + ⟦f:π:6⟧)", (t) => Math.sin(t + Math.PI / 6)], ["cos(⟦f:π:3⟧ − θ)", (t) => Math.cos(Math.PI / 3 - t)]] },
  { A: "cos", dk: { n: -1, r: 3 }, M: { n: 2, r: 1 }, forms: [["cos(θ + ⟦f:π:3⟧)", (t) => Math.cos(t + Math.PI / 3)], ["sin(⟦f:π:6⟧ − θ)", (t) => Math.sin(Math.PI / 6 - t)]] },
  { A: "cos", dk: { n: 1, r: 1 }, M: { n: 1, r: 2 }, forms: [["cos(θ − ⟦f:π:4⟧)", (t) => Math.cos(t - Math.PI / 4)], ["sin(θ + ⟦f:π:4⟧)", (t) => Math.sin(t + Math.PI / 4)]] },
  { A: "cos", dk: { n: -1, r: 1 }, M: { n: 1, r: 2 }, forms: [["cos(θ + ⟦f:π:4⟧)", (t) => Math.cos(t + Math.PI / 4)], ["sin(⟦f:π:4⟧ − θ)", (t) => Math.sin(Math.PI / 4 - t)]] },
  { A: "sin", dk: { n: 1, r: 3 }, M: { n: 2, r: 1 }, forms: [["sin(θ + ⟦f:π:3⟧)", (t) => Math.sin(t + Math.PI / 3)], ["sin(⟦f:2π:3⟧ − θ)", (t) => Math.sin(2 * Math.PI / 3 - t)], ["cos(θ − ⟦f:π:6⟧)", (t) => Math.cos(t - Math.PI / 6)]] },
  { A: "sin", dk: { n: -1, r: 3 }, M: { n: 2, r: 1 }, forms: [["sin(θ − ⟦f:π:3⟧)", (t) => Math.sin(t - Math.PI / 3)]] },
  { A: "sin", dk: { n: 1, r: 1 }, M: { n: 1, r: 2 }, forms: [["sin(θ + ⟦f:π:4⟧)", (t) => Math.sin(t + Math.PI / 4)], ["cos(θ − ⟦f:π:4⟧)", (t) => Math.cos(t - Math.PI / 4)]] },
  { A: "sin", dk: { n: -1, r: 1 }, M: { n: 1, r: 2 }, forms: [["sin(θ − ⟦f:π:4⟧)", (t) => Math.sin(t - Math.PI / 4)]] },
]
const TH = { x: ["x", (x) => x], "2x": ["2x", (x) => 2 * x] }

function t13AddFormula() { return retryGen(t13AddFormulaOnce) }
function t13AddFormulaOnce() {
  const w = pick(["sin", "cos"])
  const { vals, roots } = pickTargets()
  let q = buildQuadFromRoots(roots)
  if (q.b === 0) return null
  const Wf = w === "sin" ? Math.sin : Math.cos
  const residual = (x) => { const t = Wf(x); return q.a * t * t + q.b * t + q.c }
  const hideLin = Math.random() < 0.5
  // квадратичная часть: как w²x либо как cos 2x
  const useCos2x = !hideLin || Math.random() < 0.5
  if (useCos2x && q.a % 2 !== 0) q = { a: q.a * 2, b: q.b * 2, c: q.c * 2 }
  const mk = (n, r, str, val) => { const t = radTermRC(n, r, str); return t && { ...t, mag: Math.abs(n) * (r === 1 ? 1 : Math.sqrt(r)), val } }
  const rest = []
  let hidC, hidTheta, hidA
  if (useCos2x) {
    const pc = (w === "sin" ? -1 : 1) * q.a / 2
    const konst = q.c + q.a / 2
    if (hideLin) {
      rest.push(mk(pc, 1, "cos 2x", (x) => Math.cos(2 * x)))
      hidC = q.b; hidTheta = "x"; hidA = w
    } else {
      rest.push(mk(q.b, 1, `${w} x`, Wf))
      hidC = pc; hidTheta = "2x"; hidA = "cos"
    }
    if (konst !== 0) rest.push(mk(konst, 1, "", () => 1))
  } else {
    rest.push(mk(q.a, 1, `${w}²x`, (x) => Wf(x) ** 2))
    if (q.c !== 0) rest.push(mk(q.c, 1, "", () => 1))
    hidC = q.b; hidTheta = "x"; hidA = w
  }
  if (hidC === 0) return null
  const fold = pick(FOLD.filter((F) => F.A === hidA))
  const [thStr, thEv] = TH[hidTheta]
  const [formStr, formEv] = pick(fold.forms)
  const Bfn = hidA === "cos" ? "sin" : "cos"
  const Bstr = `${Bfn} ${thStr}`
  const Bev = (x) => (Bfn === "sin" ? Math.sin : Math.cos)(thEv(x))
  const mTerm = mk(hidC * fold.M.n, fold.M.r, formStr.replace("θ", thStr), (x) => formEv(thEv(x)))
  const dTerm = mk(hidC * fold.dk.n, fold.dk.r, Bstr, Bev)
  if (!mTerm || !dTerm) return null
  let lhs = [mTerm, ...rest.filter(Boolean)]
  let rhs = [dTerm]
  // константу часто переносят вправо (как в ФИПИ: «= √3 sin 2x − 1»)
  const ci = lhs.findIndex((t) => t.str === "" || /^\d+$/.test(t.str))
  if (ci > 0 && Math.random() < 0.7) { rhs.push({ ...lhs[ci], neg: !lhs[ci].neg }); lhs.splice(ci, 1) }
  const pi = lhs.findIndex((t) => !t.neg)
  if (pi > 0) lhs.unshift(lhs.splice(pi, 1)[0])
  const pr = rhs.findIndex((t) => !t.neg)
  if (pr > 0) rhs.unshift(rhs.splice(pr, 1)[0])
  const [lh, rh] = normalizeSides(lhs, rhs)
  lhs = lh; rhs = rh
  const eq = `${sumStr(lhs)} = ${sumStr(rhs)}`
  const contrib = (list) => (x) => list.reduce((s, t) => s + (t.neg ? -1 : 1) * t.mag * t.val(x), 0)
  const lf = contrib(lhs), rf = contrib(rhs)
  const series = vals.flatMap((v) => seriesFor(w, v))
  return finishGen(eq, series, residual, {
    realResidual: (x) => lf(x) - rf(x), text: vals.map((v) => textFor(w, v)).join(",  "),
  })
}

// ============================================================================
// СЕМЕЙСТВО «ОДНОРОДНЫЕ» — A·sin²x + B·sinx·cosx + C·cos²x = 0 (÷cos²x → tg-квадрат)
// Показ можно «замаскировать», добавив тождественные нули α(sin²+cos²−1)+β(cos²−sin²−cos2x).
// ============================================================================

const TAN_KEY = (v) => {
  const n = (b) => Math.abs(v - b) < 1e-9
  if (n(0)) return "zero"
  if (n(1)) return "one"; if (n(-1)) return "negone"
  if (n(Math.sqrt(3))) return "r3"; if (n(-Math.sqrt(3))) return "negr3"
  if (n(1 / Math.sqrt(3))) return "invr3"; if (n(-1 / Math.sqrt(3))) return "neginvr3"
  return null
}
// цели по tg: [{num, R?}] → рациональные π-серии + арк-серии + текст общего решения
function tanSolutions(list) {
  const rSeries = [], arcSeries = [], genParts = []
  for (const t of list) {
    const k = TAN_KEY(t.num)
    if (k) { rSeries.push(...tanSeries(k)); genParts.push(tanText(k)) }
    else {
      if (!t.R) return null
      const a = makeArcSeries("tg", t.R)
      arcSeries.push(...a); genParts.push(...a.map((s) => s.genText).filter(Boolean))
    }
  }
  return { rSeries, arcSeries, genParts }
}
const HOM_RAT = [R(1), R(-1), R(2), R(-2), R(3), R(-3), R(1, 2), R(-1, 2), R(1, 3), R(-1, 3), R(2, 3), R(-2, 3), R(3, 2), R(-3, 2)]
const mkT = (n, str, val) => { const t = radTermRC(n, 1, str); return t && { ...t, mag: Math.abs(n), val } }
const sumOf = (list) => (x) => list.reduce((s, t) => s + (t.neg ? -1 : 1) * t.mag * t.val(x), 0)

function t13Homogeneous() { return retryGen(t13HomogeneousOnce) }
function t13HomogeneousOnce() {
  let A, B, C, targets
  if (Math.random() < 0.2) {                       // tg = ±√3 либо ±1/√3
    const sp = pick([{ a: 1, c: -3, v: Math.sqrt(3) }, { a: 3, c: -1, v: 1 / Math.sqrt(3) }])
    A = sp.a; B = 0; C = sp.c
    targets = [{ num: sp.v }, { num: -sp.v }]
  } else {
    const r1 = pick(HOM_RAT); let r2 = pick(HOM_RAT), g = 0
    while (Rkey(r1) === Rkey(r2) && g++ < 20) r2 = pick(HOM_RAT)
    if (Rkey(r1) === Rkey(r2)) return null
    const q = buildQuadFromRoots([r1, r2])
    A = q.a; B = q.b; C = q.c
    targets = [{ num: r1.p / r1.q, R: r1 }, { num: r2.p / r2.q, R: r2 }]
  }
  if (A === 0) return null
  const plain = Math.random() < 0.55
  const al = plain ? 0 : pick([1, 2, 3, 4, -1, -2]), be = plain ? 0 : pick([0, 1, 2, 3, -1, -2])
  const A2 = A + al - be, C2 = C + al + be
  if (A2 === C2) return null                       // sin²+cos² схлопнется в константу
  const terms = []
  if (A2) terms.push(mkT(A2, "sin²x", (x) => Math.sin(x) ** 2))
  if (B) {
    if (B % 2 === 0 && Math.random() < 0.6) terms.push(mkT(B / 2, "sin 2x", (x) => Math.sin(2 * x)))
    else terms.push(mkT(B, "sin x cos x", (x) => Math.sin(x) * Math.cos(x)))
  }
  if (C2) terms.push(mkT(C2, "cos²x", (x) => Math.cos(x) ** 2))
  if (be) terms.push(mkT(-be, "cos 2x", (x) => Math.cos(2 * x)))
  if (al) terms.push(mkT(-al, "", () => 1))
  if (terms.length < 2) return null
  let lhs = terms, rhs = []
  // отрицательные «хвосты» (константа/cos2x) часто уносят вправо
  if (terms.length >= 3 && Math.random() < 0.6) {
    const i = terms.findIndex((t, j) => j > 0 && t.neg)
    if (i > 0) { lhs = terms.filter((_, j) => j !== i); rhs = [{ ...terms[i], neg: false }] }
  }
  ;[lhs, rhs] = normalizeSides(lhs, rhs)
  const eq = `${sumStr(lhs)} = ${rhs.length ? sumStr(rhs) : "0"}`
  const sol = tanSolutions(targets)
  if (!sol) return null
  const lf = sumOf(lhs), rf = sumOf(rhs)
  return finishArc(eq, sol.rSeries, sol.arcSeries, sol.genParts, makeResidualTan(A, B, C), null, (x) => lf(x) - rf(x))
}

// ── обратные по tg: A/tg²x + B/tgx + C = 0 (квадрат по ctg x; ОДЗ sinx≠0, cosx≠0) ──
function t13ReciprocalTg() { return retryGen(t13ReciprocalTgOnce) }
function t13ReciprocalTgOnce() {
  const r1 = pick(HOM_RAT); let r2 = pick(HOM_RAT), g = 0
  while (Rkey(r1) === Rkey(r2) && g++ < 20) r2 = pick(HOM_RAT)
  if (Rkey(r1) === Rkey(r2)) return null
  const q = buildQuadFromRoots([r1, r2])          // по u = ctg x
  const eq = recipEq(q.a, q.b, q.c, "tg²x", "tg x")
  const inv = (r) => R(r.q, r.p)                  // tg = 1/ctg
  const t1 = inv(r1), t2 = inv(r2)
  const sol = tanSolutions([{ num: t1.p / t1.q, R: t1 }, { num: t2.p / t2.q, R: t2 }])
  if (!sol) return null
  const domainOK = (x) => Math.abs(Math.sin(x)) > 1e-6 && Math.abs(Math.cos(x)) > 1e-6
  const real = (x) => { const t = Math.tan(x); return q.a / (t * t) + q.b / t + q.c }
  return finishArc(eq, sol.rSeries, sol.arcSeries, sol.genParts, makeResidualTan(q.c, q.b, q.a), domainOK, real)
}

// ── алгебро-тригонометрическая группировка: (x−m)(2f x + s)=0 в раскрытом виде ──
function t13GroupAlgTrig() { return retryGen(t13GroupAlgTrigOnce) }
function t13GroupAlgTrigOnce() {
  let m = randInt(-6, 6)
  if (m === 0) return null
  const tr = pick(TRIG_LIN)                       // «2cos x + 1» и т.п.
  const s = tr.str.includes("+") ? 1 : -1
  const fStr = tr.fn === "cos" ? "cos x" : "sin x"
  const Ff = tr.fn === "cos" ? Math.cos : Math.sin
  const terms = [
    mkT(2, `x ${fStr}`, (x) => x * Ff(x)),
    mkT(-2 * m, fStr, Ff),
    mkT(s, "x", (x) => x),
    mkT(-s * m, "", () => 1),
  ].filter(Boolean)
  const [lhs] = normalizeSides(terms, [])
  const eq = `${sumStr(lhs)} = 0`
  const residual = (x) => (x - m) * (2 * Ff(x) + s)
  const trigSeries = seriesFor(tr.fn, tr.val)
  const iv = chooseIntervalMixed(trigSeries, [{ p: m, q: 1 }])
  if (!iv) return null
  const { L, R: Rr, roots } = iv
  return {
    condition_text: `а) Решите уравнение\n${eq}`,
    condition_tail: `б) Найдите корни, принадлежащие отрезку [${fmtPiCond(L)}; ${fmtPiCond(Rr)}].`,
    answer: `а) x = ${intT(m)};  ${textFor(tr.fn, tr.val)}, n ∈ ℤ\nб) ${roots.map((r) => r.text).join(";  ")}`,
    _verify: { residual, realResidual: residual, roots: roots.map((r) => r.num), L: Rnum(L), R: Rnum(Rr) },
  }
}

// ============================================================================
// СЕМЕЙСТВО «ДРОБЬ = 0 / ОДЗ» — числитель обнуляется, знаменатель под запретом
// ============================================================================

// знаменатели-«линейные»: [строка, вычислитель]
const DEN_LIN = [
  ["2sin x − 1", (x) => 2 * Math.sin(x) - 1], ["2sin x + 1", (x) => 2 * Math.sin(x) + 1],
  ["2cos x − 1", (x) => 2 * Math.cos(x) - 1], ["2cos x + 1", (x) => 2 * Math.cos(x) + 1],
  ["2cos x − √{3}", (x) => 2 * Math.cos(x) - Math.sqrt(3)], ["2cos x + √{3}", (x) => 2 * Math.cos(x) + Math.sqrt(3)],
  ["2sin x − √{2}", (x) => 2 * Math.sin(x) - Math.sqrt(2)], ["tg x − 1", (x) => Math.tan(x) - 1],
  ["tg x + 1", (x) => Math.tan(x) + 1], ["tg x − √{3}", (x) => Math.tan(x) - Math.sqrt(3)],
]
// числители «tg x = v»: [строка, p, q] — эквивалент p·sin x + q·cos x, v = −q/p
const NUM_TG = [
  ["tg x − 1", 1, -1], ["tg x + 1", 1, 1],
  ["tg x − √{3}", 1, -Math.sqrt(3)], ["tg x + √{3}", 1, Math.sqrt(3)],
  ["√{3}tg x − 1", Math.sqrt(3), -1], ["√{3}tg x + 1", Math.sqrt(3), 1],
]
function t13FracTgOverLin() { return retryGen(t13FracTgOverLinOnce) }
function t13FracTgOverLinOnce() {
  const [numStr, p, q] = pick(NUM_TG)
  const [denStr, denEv] = pick(DEN_LIN)
  const key = TAN_KEY(-q / p)
  if (!key) return null
  const eq = `⟦f:${numStr}:${denStr}⟧ = 0`
  const domainOK = (x) => Math.abs(Math.cos(x)) > 1e-6 && Math.abs(denEv(x)) > 0.05
  const residual = (x) => p * Math.sin(x) + q * Math.cos(x)
  const real = (x) => (p * Math.tan(x) + q) / denEv(x)
  const refined = refineSeries(tanSeries(key), domainOK)
  if (!refined.length) return null
  return finishGen(eq, refined, residual, { realResidual: real, domainOK, text: seriesListText(refined) })
}

// числитель a·f x − b (f=значение), знаменатель √(k·g x) → ОДЗ g x > 0 (строго)
function t13FracSqrtDen() { return retryGen(t13FracSqrtDenOnce) }
function t13FracSqrtDenOnce() {
  const f = pick(["sin", "cos"]), g = f === "sin" ? "cos" : "sin"
  const V = pick([{ n: 1, r: 1 }, { n: -1, r: 1 }, { n: 1, r: 2 }, { n: -1, r: 2 }, { n: 1, r: 3 }, { n: -1, r: 3 }])
  const key = numToTrigKey(V.n * (V.r === 1 ? 1 : Math.sqrt(V.r)) / 2)
  if (!key) return null
  const k = pick([5, 7, 11, 13])
  const gSign = pick([1, -1])
  const fStr = `${f} x`, gStr = `${g} x`
  const numStr = `2${fStr} ${V.n < 0 ? "+" : "−"} ${V.r === 1 ? Math.abs(V.n) : `${Math.abs(V.n) === 1 ? "" : Math.abs(V.n)}√{${V.r}}`}`
  const eq = `⟦f:${numStr}:√{${gSign > 0 ? k : MINUS + k}${gStr}}⟧ = 0`
  const Ff = f === "sin" ? Math.sin : Math.cos, Gf = g === "sin" ? Math.sin : Math.cos
  const vNum = V.n * (V.r === 1 ? 1 : Math.sqrt(V.r)) / 2
  const domainOK = (x) => k * gSign * Gf(x) > 1e-6
  const residual = (x) => 2 * Ff(x) - 2 * vNum
  const real = (x) => { const d = k * gSign * Gf(x); return d <= 0 ? NaN : (2 * Ff(x) - 2 * vNum) / Math.sqrt(d) }
  const refined = refineSeries(seriesFor(f, key), domainOK)
  if (!refined.length) return null
  return finishGen(eq, refined, residual, { realResidual: real, domainOK, text: seriesListText(refined) })
}

// (1+tg²x)·[приведение к ±sin2x / ±cos2x] = C  →  2tg x = ±C  либо  1−tg²x = ±C
function t13TgSqIdentity() { return retryGen(t13TgSqIdentityOnce) }
function t13TgSqIdentityOnce() {
  const domainOK = (x) => Math.abs(Math.cos(x)) > 1e-6
  const sec2 = (x) => 1 + Math.tan(x) ** 2
  if (Math.random() < 0.5) {                                   // sin-ветвь: tg x = ±C/2
    const V = pick([{ n: 2, r: 1, key: "one" }, { n: -2, r: 1, key: "negone" }, { n: 2, r: 3, key: "r3" }, { n: -2, r: 3, key: "negr3" }])
    const sgn = pick([1, -1])
    const [fStr, fEv] = pick(sgn > 0 ? RED_P_SIN2 : RED_M_SIN2)
    const Cn = V.n * sgn, Cnum = Cn * (V.r === 1 ? 1 : Math.sqrt(V.r))
    const cTerm = radTermRC(Cn, V.r, "")
    const eq = `(1 + tg²x)·${fStr} = ${cTerm.neg ? MINUS : ""}${cTerm.str}`
    const vNum = V.n * (V.r === 1 ? 1 : Math.sqrt(V.r)) / 2
    const residual = (x) => 2 * Math.sin(x) - 2 * vNum * Math.cos(x)
    const real = (x) => sec2(x) * fEv(x) - Cnum
    return finishGen(eq, tanSeries(V.key), residual, { realResidual: real, domainOK, text: tanText(V.key) })
  }
  // cos-ветвь: 1 − tg²x = ±C
  const V = pick([
    { C: { n: 1, r: 1, d: 1 }, keys: ["zero"] }, { C: { n: 0, r: 1, d: 1 }, keys: ["one", "negone"] },
    { C: { n: -2, r: 1, d: 1 }, keys: ["r3", "negr3"] }, { C: { n: 2, r: 1, d: 3 }, keys: ["invr3", "neginvr3"] },
  ])
  const sgn = pick([1, -1])
  const [fStr, fEv] = pick(sgn > 0 ? RED_P_COS2 : RED_M_COS2)
  const cc = V.C.n / V.C.d                                      // 1 − tg²x = cc
  const disp = sgn * cc                                         // показанная правая часть
  const cStr = V.C.d === 1 ? `${disp < 0 ? MINUS : ""}${Math.abs(disp)}`
    : `${disp < 0 ? MINUS : ""}⟦f:${Math.abs(V.C.n)}:${V.C.d}⟧`
  const eq = `(1 + tg²x)·${fStr} = ${cStr}`
  const residual = (x) => (1 - cc) * Math.cos(x) ** 2 - Math.sin(x) ** 2
  const real = (x) => sec2(x) * fEv(x) - disp
  const series = V.keys.flatMap((k) => tanSeries(k))
  return finishGen(eq, series, residual, { realResidual: real, domainOK, text: V.keys.map(tanText).join(",  ") })
}

// sin 2x / [приведение к ±sin x или ±cos x] = C  →  2·(другая функция) = ±C
function t13FracSin2x() { return retryGen(t13FracSin2xOnce) }
function t13FracSin2xOnce() {
  const den = pick(["sin", "cos"]), other = den === "sin" ? "cos" : "sin"
  const V = pick([{ n: 1, r: 1 }, { n: -1, r: 1 }, { n: 1, r: 2 }, { n: -1, r: 2 }, { n: 1, r: 3 }, { n: -1, r: 3 }])
  const vNum = V.n * (V.r === 1 ? 1 : Math.sqrt(V.r)) / 2
  const key = numToTrigKey(vNum)
  if (!key) return null
  const sgn = pick([1, -1])
  const [dStr, dEv] = redLin(den, sgn)
  const Cnum = 2 * vNum * sgn                                  // правая часть = 2·v·sgn
  const cs = radTermRC(V.n * sgn, V.r, "")
  const eq = `⟦f:sin 2x:${inlineFrac(dStr)}⟧ = ${cs.neg ? MINUS : ""}${cs.str}`
  const Of = other === "sin" ? Math.sin : Math.cos
  const domainOK = (x) => Math.abs(dEv(x)) > 1e-6
  const residual = (x) => 2 * Of(x) - 2 * vNum
  const real = (x) => Math.sin(2 * x) / dEv(x) - Cnum
  const refined = refineSeries(seriesFor(other, key), domainOK)
  if (!refined.length) return null
  return finishGen(eq, refined, residual, { realResidual: real, domainOK, text: seriesListText(refined) })
}

// A·[±sin x] = B·tg x  →  sin x=0 ∪ cos x=B/A;   A·sin²x = B·tg x  →  sin x=0 ∪ sin 2x=2B/A
function t13SinTgFactor() { return retryGen(t13SinTgFactorOnce) }
function t13SinTgFactorOnce() {
  const domainOK = (x) => Math.abs(Math.cos(x)) > 1e-6
  const sq = Math.random() < 0.5
  const V = pick([{ n: 1, r: 1 }, { n: -1, r: 1 }, { n: 1, r: 2 }, { n: -1, r: 2 }, { n: 1, r: 3 }, { n: -1, r: 3 }])
  const A = sq ? 4 : 2
  const Bn = V.n, Br = V.r                                     // B = Bn·√Br
  const Bnum = Bn * (Br === 1 ? 1 : Math.sqrt(Br))
  const bTerm = radTermRC(Bn, Br, "tg x")
  if (sq) {
    const vNum = V.n * (V.r === 1 ? 1 : Math.sqrt(V.r)) / 2    // sin 2x = 2B/A = v
    const key = numToTrigKey(vNum)
    if (!key) return null
    const [sqStr, sqEv] = redSq("sin")
    const eq = `${A}${sqStr} = ${bTerm.neg ? MINUS : ""}${bTerm.str}`
    const residual = (x) => Math.sin(x) * (A * Math.sin(x) * Math.cos(x) - Bnum)
    const real = (x) => A * sqEv(x) - Bnum * Math.tan(x)
    const series = [...seriesFor("sin", "zero"), ...scaleArg(seriesFor("sin", key), 2)]
    const refined = refineSeries(series, domainOK)
    return finishGen(eq, refined, residual, { realResidual: real, domainOK, text: seriesListText(refined) })
  }
  const vNum = V.n * (V.r === 1 ? 1 : Math.sqrt(V.r)) / 2      // cos x = B/A = v
  const key = numToTrigKey(vNum)
  if (!key) return null
  // слева всегда «+A·[запись]»; знак записи (σ) уводим в коэффициент справа: B = A·v·σ
  const sgn = pick([1, -1])
  const [lStr, lEv] = redLin("sin", sgn)
  const bT = radTermRC(Bn * sgn, Br, "tg x")
  const eq = `${A}${lStr} = ${bT.neg ? MINUS : ""}${bT.str}`
  const Bs = Bnum * sgn
  const residual = (x) => Math.sin(x) * (A * sgn * Math.cos(x) - Bs)
  const real = (x) => A * lEv(x) - Bs * Math.tan(x)
  const series = [...seriesFor("sin", "zero"), ...seriesFor("cos", key)]
  const refined = refineSeries(series, domainOK)
  return finishGen(eq, refined, residual, { realResidual: real, domainOK, text: seriesListText(refined) })
}

// ── произведение / дробь с ЛОГАРИФМОМ ───────────────────────────────────────
// g — аргумент логарифма: ОДЗ g>0; log_a g = 0 ⟺ g = 1.
// zf — гладкий (без полюсов) эквивалент «g − 1»: нужен для сканера полноты,
// иначе полюс tg x даёт ложную смену знака.
const LOG_G = [
  { str: "sin x", ev: Math.sin, zf: (x) => Math.sin(x) - 1, one: { fn: "sin", key: "one" } },
  { str: "cos x", ev: Math.cos, zf: (x) => Math.cos(x) - 1, one: { fn: "cos", key: "one" } },
  { str: `${MINUS}cos x`, ev: (x) => -Math.cos(x), zf: (x) => -Math.cos(x) - 1, one: { fn: "cos", key: "negone" } },
  { str: "tg x", ev: Math.tan, zf: (x) => Math.sin(x) - Math.cos(x), one: { fn: "tan", key: "one" } },
  { str: `${MINUS}tg x`, ev: (x) => -Math.tan(x), zf: (x) => Math.sin(x) + Math.cos(x), one: { fn: "tan", key: "negone" } },
  { str: `${MINUS}0,5cos x`, ev: (x) => -0.5 * Math.cos(x), zf: (x) => -0.5 * Math.cos(x) - 1, one: null },
  { str: "2sin x", ev: (x) => 2 * Math.sin(x), zf: (x) => 2 * Math.sin(x) - 1, one: { fn: "sin", key: "half" } },
  { str: `⟦r:2⟧cos x`, ev: (x) => Math.sqrt(2) * Math.cos(x), zf: (x) => Math.sqrt(2) * Math.cos(x) - 1, one: { fn: "cos", key: "r2half" } },
]
const LOG_BASE = [
  { s: "₂", n: 2 }, { s: "₄", n: 4 }, { s: "₅", n: 5 }, { s: "₆", n: 6 },
  { s: "₇", n: 7 }, { s: "₁₂", n: 12 }, { s: "₂₉", n: 29 }, { s: "₀,₅", n: 0.5 },
]
function t13ProdLog() { return retryGen(t13ProdLogOnce) }
function t13ProdLogOnce() {
  const frac = Math.random() < 0.4
  const G = pick(LOG_G)
  const base = pick(LOG_BASE)
  const baseNum = base.n
  const logStr = `log${base.s}`
  const fP = pick(["cos", "sin"])
  const { vals, roots } = pickTargets()
  const q = buildQuadFromRoots(roots)
  const Pexpr = fmtQuadExpr(q.a, q.b, q.c, `${fP}²x`, `${fP} x`)
  const Presid = makeResidual(fP, q.a, q.b, q.c)
  const domainOK = frac
    ? (x) => G.ev(x) > 1e-6 && Math.abs(G.ev(x) - 1) > 0.02
    : (x) => G.ev(x) > 1e-6
  const logPart = `${logStr}(${G.str})`
  const eq = frac ? `⟦f:${Pexpr}:${logPart.replace(/⟦r:2⟧/g, "√{2}")}⟧ = 0`
    : `(${Pexpr})·${logPart} = 0`
  const zeroSeries = vals.flatMap((v) => seriesFor(fP, v))
  const oneSeries = (!frac && G.one) ? seriesFor(G.one.fn, G.one.key) : []
  const refined = refineSeries([...zeroSeries, ...oneSeries], domainOK)
  if (!refined.length) return null
  // приведённая форма без полюсов: нули P (в ОДЗ) и, для произведения, нуль логарифма (g=1)
  const residual = frac ? Presid : (x) => Presid(x) * G.zf(x)
  const real = (x) => {
    const g = G.ev(x)
    if (!(g > 0)) return NaN
    const lg = Math.log(g) / Math.log(baseNum)
    if (frac) return Math.abs(lg) < 1e-9 ? NaN : Presid(x) / lg
    return Presid(x) * lg
  }
  return finishGen(eq, refined, residual, { realResidual: real, domainOK, text: seriesListText(refined) })
}

// ============================================================================
// ПОКАЗАТЕЛЬНЫЕ — оставшиеся типажи PDF: кубическая группировка, дробный показатель,
// a^(m−x), однородное по x, уравнение с модулем.
// ============================================================================

// E1 — (a³)ˣ − p·(a²)ˣ − q²·aˣ + p·q² = 0 ⟺ (t−p)(t²−q²)=0, t=aˣ (q=aᵐ; t=−q отпадает)
function t13ExpCubicGroup() { return retryGen(t13ExpCubicGroupOnce) }
function t13ExpCubicGroupOnce() {
  const a = pick([2, 3])
  const m = pick([2, 3])
  const q = a ** m, q2 = q * q
  const pool = []
  for (let v = 2; v <= 30; v++) if (v !== q && !isPow(v, a)) pool.push(v)
  const p = pick(pool)
  const eq = `${powE(a ** 3, "x")} ${MINUS} ${p}·${powE(a * a, "x")} ${MINUS} ${powE(a, `x+${2 * m}`)} + ${p * q2} = 0`
  const residual = (x) => { const t = a ** x; return t ** 3 - p * t * t - q2 * t + p * q2 }
  const roots = [{ num: logNumV(a, p), text: logT(a, p) }, { num: m, text: intT(m) }]
  return assembleReal(eq, roots, residual, a)
}

// E2 — (a²)^(x−½) − c·a^(x−1) + d = 0 ⟺ t² − c·t + a·d = 0, t=aˣ
function t13ExpHalfPow() { return retryGen(t13ExpHalfPowOnce) }
function t13ExpHalfPowOnce() {
  const a = pick([2, 3])
  const t1 = pick([2, 3, 4, 5, 6, 8, 9]), t2 = pick([2, 3, 4, 5, 6, 8, 9])
  if (t1 === t2) return null
  if ((t1 * t2) % a !== 0) return null
  const c = t1 + t2, d = t1 * t2 / a
  const eq = `${powE(a * a, `x ${MINUS} ⟦f:1:2⟧`)} ${MINUS} ${c}·${powE(a, "x" + MINUS + "1")} + ${d} = 0`
  const residual = (x) => { const t = a ** x; return t * t / a - c * t / a + d }
  const mk = (v) => isPow(v, a) ? { num: logNumV(a, v), text: intT(Math.round(logNumV(a, v))) } : { num: logNumV(a, v), text: logT(a, v) }
  return assembleReal(eq, [mk(t1), mk(t2)], residual, a)
}

// E3 — (a³)ˣ − c·a^(x+s) + a^(m−x) = 0; ×aˣ ⟹ t⁴ − c·aˢ·t² + aᵐ = 0 (биквадрат по t=aˣ)
function t13ExpNegPow() { return retryGen(t13ExpNegPowOnce) }
function t13ExpNegPowOnce() {
  const a = pick([2, 3])
  const u = pick([1, 2, 3, 4]), v = pick([1, 2, 3, 4])
  if (u === v) return null
  const s = Math.min(u, v), m = u + v
  const c = a ** (u - s) + a ** (v - s)
  const eq = `${powE(a ** 3, "x")} ${MINUS} ${c === 1 ? "" : c + "·"}${powE(a, `x+${s}`)} + ${powE(a, `${m}${MINUS}x`)} = 0`
  const residual = (x) => { const t = a ** x; return t ** 3 - c * a ** s * t + a ** m / t }
  const half = (n) => n % 2 === 0 ? intT(n / 2) : ru2(n / 2)
  const roots = [{ num: u / 2, text: half(u) }, { num: v / 2, text: half(v) }]
  return assembleReal(eq, roots, residual, null)
}

// E4 — однородное: P·(a²)ˣ + Q·(ab)ˣ + R·(b²)ˣ = 0, s=(a/b)ˣ → квадрат по s
function t13ExpHomogLin() { return retryGen(t13ExpHomogLinOnce) }
function t13ExpHomogLinOnce() {
  const [a, b] = pick([[3, 2], [5, 2], [5, 3], [4, 3]])
  const n1 = pick([0, 1, 2]); let n2 = pick([0, 1, 2])
  if (n1 === n2) return null
  const s1 = R(a ** n1, b ** n1)
  const logOne = b === 2 && Math.random() < 0.4        // иначе основание a/b не десятичное
  const extra = pick([2, 3, 4, 5, 6])
  const s2 = logOne ? R(extra, 1) : R(a ** n2, b ** n2)
  if (Rkey(s1) === Rkey(s2)) return null
  if (logOne && Math.abs(Math.log(extra) / Math.log(a / b) - Math.round(Math.log(extra) / Math.log(a / b))) < 1e-9) return null
  const { a: P, b: Q, c: Rc } = buildQuadFromRoots([s1, s2])
  if (Q === 0 || Rc === 0) return null
  // R·(b²)ˣ показываем как (R/b²)·(b²)^(x+1), если делится
  const b2 = b * b
  const lastStr = (Rc % b2 === 0 && Math.abs(Rc) !== b2)
    ? `${Math.abs(Rc) / b2}·${powE(b2, "x+1")}`
    : `${Math.abs(Rc) === 1 ? "" : Math.abs(Rc) + "·"}${powE(b2, "x")}`
  const eq = `${P === 1 ? "" : P + "·"}${powE(a * a, "x")} ${Q < 0 ? MINUS : "+"} ${Math.abs(Q) === 1 ? "" : Math.abs(Q) + "·"}${powE(a * b, "x")} ${Rc < 0 ? MINUS : "+"} ${lastStr} = 0`
  const residual = (x) => P * (a * a) ** x + Q * (a * b) ** x + Rc * (b * b) ** x
  const lb = Math.log(a / b)
  const rootOf = (s) => {
    const val = s.p / s.q
    const e = Math.log(val) / lb
    const er = Math.round(e)
    if (Math.abs(e - er) < 1e-9) return { num: er, text: intT(er) }
    return { num: e, text: `log${subDec(a / b)}${val}` }          // напр. log₁,₅4
  }
  const roots = [rootOf(s1), rootOf(s2)]
  if (Math.abs(roots[0].num - roots[1].num) < 1e-9) return null
  return assembleReal(eq, roots, residual, null)
}

// E5 — с модулем: (aˣ − c)² + λ·aˣ + μ = k·|aˣ − c|
//   w=|aˣ−c|, ветвь aˣ≥c: w²+(λ−k)w+(λc+μ)=0; ветвь aˣ<c: w²−(λ+k)w+(λc+μ)=0.
function t13ExpAbs() { return retryGen(t13ExpAbsOnce, 300) }
function t13ExpAbsOnce() {
  const a = pick([2, 3, 4])
  const c = pick([4, 5, 6, 7, 8, 9, 10])
  const lam = pick([1, 2, 3, 4, 6])
  const r1 = randInt(1, 8), r2 = randInt(1, 8)
  if (r1 === r2) return null
  const A = r1 * r2, k = lam + r1 + r2
  const mu = A - lam * c
  // ветвь aˣ<c: w² − (r1+r2+2λ)w + A = 0
  const S2 = r1 + r2 + 2 * lam
  const disc = S2 * S2 - 4 * A
  if (disc < 0) return null
  const sq = Math.round(Math.sqrt(disc))
  if (sq * sq !== disc) return null
  const w3 = (S2 - sq) / 2, w4 = (S2 + sq) / 2
  const us = new Set()
  for (const w of [r1, r2]) us.add(c + w)
  for (const w of [w3, w4]) { const u = c - w; if (u > 0 && w > 0) us.add(u) }
  const roots = []
  for (const u of us) {
    const e = logNumV(a, u)
    roots.push(isPow(u, a) ? { num: e, text: intT(Math.round(e)) } : { num: e, text: logT(a, u) })
  }
  if (roots.length < 2 || roots.length > 3) return null
  const uStr = `(${powE(a, "x")} ${MINUS} ${c})²`
  const absStr = `${k}|${powE(a, "x")} ${MINUS} ${c}|`
  // λ·aˣ показываем как a^(x+s), если λ — степень a
  const lamStr = isPow(lam, a) && lam > 1
    ? powE(a, `x+${Math.round(logNumV(a, lam))}`)
    : `${lam === 1 ? "" : lam + "·"}${powE(a, "x")}`
  const absEv = (x) => Math.abs(a ** x - c)
  const sqEv = (x) => (a ** x - c) ** 2
  const lamEv = (x) => a ** x
  let eq, realResidual
  if (mu < 0) {
    // (aˣ−c)² − k|aˣ−c| = −μ − λ·aˣ   (правая часть начинается с положительного −μ)
    eq = `${uStr} ${MINUS} ${absStr} = ${sumStr([{ neg: false, str: String(-mu) }, { neg: true, str: lamStr }])}`
    realResidual = (x) => sqEv(x) - k * absEv(x) - (-mu - lam * lamEv(x))
  } else {
    // (aˣ−c)² + λ·aˣ + μ = k|aˣ−c|
    const lhs = [{ neg: false, str: uStr }, { neg: false, str: lamStr }]
    if (mu !== 0) lhs.push({ neg: false, str: String(mu) })
    eq = `${sumStr(lhs)} = ${absStr}`
    realResidual = (x) => sqEv(x) + lam * lamEv(x) + mu - k * absEv(x)
  }
  const residual = (x) => { const u = a ** x; return (u - c) ** 2 + lam * u + mu - k * Math.abs(u - c) }
  return assembleReal(eq, roots, residual, a, realResidual)
}

// ============================================================================
// ЛОГАРИФМИЧЕСКИЕ — оставшиеся типажи PDF: разные основания, переменное основание,
// основание-корень.
// ============================================================================

// L3 — logₐ(b − x) = log_{a²}(x⁴)  ⟺  b − x = x²  (ОДЗ: b−x>0, x≠0)
// Корни целые с суммой −1: x²+x−b=0.
function t13LogTwoBases() { return retryGen(t13LogTwoBasesOnce) }
function t13LogTwoBasesOnce() {
  const a = pick([2, 3, 5])
  const [x1, x2] = pick([[1, -2], [2, -3], [3, -4], [4, -5], [5, -6]])
  const b = -x1 * x2
  const eq = `log${subU(a)}(${b} ${MINUS} x) = log${subU(a * a)}x⁴`
  const residual = (x) => x * x + x - b                      // гладкая форма (без логарифмов)
  const domainOK = (x) => b - x > 1e-9 && Math.abs(x) > 1e-9
  const real = (x) => domainOK(x)
    ? Math.log(b - x) / Math.log(a) - Math.log(x ** 4) / Math.log(a * a) : NaN
  const roots = [{ num: x1, text: intT(x1) }, { num: x2, text: intT(x2) }]
  const iv = pickIntInterval(roots.map((r) => r.num))
  if (!iv) return null
  const o = finish(eq, roots, residual, iv, domainOK)
  if (o) o._verify.realResidual = real
  return o
}

// L6 — log_{q(x)}(P(x)) = 0 ⟺ P(x)=1 при q>0, q≠1. Кубический P−1 даёт 3 корня,
// один из них отсекается основанием (демонстрация ОДЗ).
function t13LogVarBase() { return retryGen(t13LogVarBaseOnce, 80) }
function t13LogVarBaseOnce() {
  const rs = []
  while (rs.length < 3) { const r = randInt(-4, 4); if (!rs.includes(r)) rs.push(r) }
  const [r1, r2, r3] = rs
  // (x−r1)(x−r2)(x−r3) = x³ + Ax² + Bx + C
  const A = -(r1 + r2 + r3), B = r1 * r2 + r1 * r3 + r2 * r3, C = -r1 * r2 * r3
  const cubic = (x) => x ** 3 + A * x * x + B * x + C
  const beta = randInt(-5, 5), gamma = randInt(-6, 6)
  const base = (x) => x * x + beta * x + gamma
  const okAt = (x) => base(x) > 1e-9 && Math.abs(base(x) - 1) > 1e-9
  const kept = rs.filter(okAt)
  if (kept.length !== 2) return null                          // ровно один корень отсекается
  const argStr = `x³${A ? ` ${A < 0 ? MINUS : "+"} ${Math.abs(A) === 1 ? "" : Math.abs(A)}x²` : ""}` +
    `${B ? ` ${B < 0 ? MINUS : "+"} ${Math.abs(B) === 1 ? "" : Math.abs(B)}x` : ""}` +
    `${C + 1 ? ` ${C + 1 < 0 ? MINUS : "+"} ${Math.abs(C + 1)}` : ""}`
  const eq = `log⟦b:${qPoly(1, beta, gamma)}⟧(${argStr}) = 0`
  const domainOK = (x) => okAt(x) && cubic(x) + 1 > 1e-12
  const real = (x) => domainOK(x) ? Math.log(cubic(x) + 1) / Math.log(base(x)) : NaN
  const roots = kept.sort((p, q) => p - q).map((r) => ({ num: r, text: intT(r) }))
  const iv = pickIntInterval(roots.map((r) => r.num))
  if (!iv) return null
  const o = finish(eq, roots, cubic, iv, domainOK)
  if (o) o._verify.realResidual = real
  return o
}

// L7 — 1 + logₐ(x⁴ + m) = log_{√a}√(p·x² + q)  ⟺  a(x⁴+m) = p·x²+q  (биквадрат)
function t13LogSqrtBase() { return retryGen(t13LogSqrtBaseOnce) }
function t13LogSqrtBaseOnce() {
  const a = pick([2, 3, 5])
  const u1 = pick([2, 3, 5, 6, 7]), u2 = pick([2, 3, 5, 6, 7, 8])
  if (u1 === u2) return null
  const d = pick([1, 2, 3, 4])
  const m = u1 * u2 + d, p = a * (u1 + u2), q = a * d
  const eq = `1 + log${subU(a)}(x⁴ + ${m}) = log⟦b:⟦r:${a}⟧⟧⟦r:${p}x² + ${q}⟧`
  const residual = (x) => a * (x ** 4 + m) - (p * x * x + q)
  const real = (x) => 1 + Math.log(x ** 4 + m) / Math.log(a) - Math.log(Math.sqrt(p * x * x + q)) / Math.log(Math.sqrt(a))
  const rootTxt = (u, sg) => {
    const s = Math.sqrt(u)
    const t = Math.abs(s - Math.round(s)) < 1e-9 ? intT(Math.round(s)) : `√${u}`
    return { num: sg * s, text: sg < 0 ? MINUS + t : t }
  }
  const roots = [rootTxt(u1, -1), rootTxt(u1, 1), rootTxt(u2, -1), rootTxt(u2, 1)]
  return assembleReal(eq, roots, residual, null, real)
}

// ============================================================================
// ЛОГАРИФМИЧЕСКИЕ × ТРИГОНОМЕТРИЯ — квадрат внутри логарифма и группировка внутри
// ============================================================================

// LT1 — log_A(cos2x + Q·cos x + R) = 0 ⟺ 2cos²x + Q·cos x + (R−1) = 0.
// Q — иррациональный (как в ФИПИ: cos2x − 9√2 cosx − 8 = 0 → cos x = −√2/2).
function t13LogTrigQuadIn() { return retryGen(t13LogTrigQuadInOnce) }
function t13LogTrigQuadInOnce() {
  const A = pick([2, 3, 5, 7, 17, 29])
  const r = pick([2, 3]), sg = pick([1, -1]), rt = Math.sqrt(r)
  const v1 = sg * rt / 2
  const key = numToTrigKey(v1)
  if (!key) return null
  const t = pick([2, 3, 4, 5, -2, -3, -4, -5])
  const v2 = t * rt
  if (Math.abs(v2) <= 1.0001) return null
  // 2c² + b·c + cc = 0, b = −√r(sg + 2t), cc = r·sg·t
  const bn = -(sg + 2 * t), cc = r * sg * t
  if (!Number.isInteger(cc)) return null
  const bNum = bn * rt
  const fn = pick(["sin", "cos"])
  const Ff = fn === "sin" ? Math.sin : Math.cos
  // показ: cos 2x + b·f x + (cc + 2) для f=cos; для f=sin cos2x = 1−2sin²x → знак меняется
  // cos: cos2x=2c²−1 → Q=b, R=cc+2 ; sin: cos2x=1−2s² → Q=−b, R=−cc (в обоих случаях arg=1 в корне)
  const sgQ = fn === "cos" ? 1 : -1
  const Rc = fn === "cos" ? cc + 2 : -cc
  const Qnum = sgQ * bNum
  const parts = [{ neg: false, str: "cos 2x" }, ...expandTerm(radCoefTerm(0, sgQ * bn, r, `${fn} x`))]
  if (Rc !== 0) parts.push({ neg: Rc < 0, str: String(Math.abs(Rc)) })
  const eq = `log${subU(A)}(${sumStr(parts)}) = 0`
  const residual = (x) => { const c = Ff(x); return 2 * c * c + bNum * c + cc }
  const arg = (x) => Math.cos(2 * x) + Qnum * Ff(x) + Rc
  const domainOK = (x) => arg(x) > 1e-12
  const real = (x) => domainOK(x) ? Math.log(arg(x)) / Math.log(A) : NaN
  return finishGen(eq, seriesFor(fn, key), residual, { realResidual: real, domainOK, text: textFor(fn, key) })
}

// LT8 — logₐ((pq/2)·sin2x − q·sin x − p·cos x + 1 + aᵏ) = k
//   внутреннее = (p·cos x − 1)(q·sin x − 1) → cos x = 1/p, sin x = 1/q (арккосинус/арксинус)
function t13LogTrigGroup() { return retryGen(t13LogTrigGroupOnce) }
function t13LogTrigGroupOnce() {
  const [a, k] = pick([[2, 1], [2, 2], [3, 1], [3, 2], [5, 1]])
  const Ak = a ** k
  const pairs = []
  for (let p = 2; p <= 5; p++) for (let q = 2; q <= 5; q++) if ((p * q) % 2 === 0) pairs.push([p, q])
  const [p, q] = pick(pairs)
  const inner = (x) => (p * Math.cos(x) - 1) * (q * Math.sin(x) - 1)
  const parts = [
    { neg: false, str: `${p * q / 2 === 1 ? "" : p * q / 2}sin 2x` },
    { neg: true, str: `${q === 1 ? "" : q}sin x` },
    { neg: true, str: `${p === 1 ? "" : p}cos x` },
    { neg: false, str: String(1 + Ak) },
  ]
  const eq = `log${subU(a)}(${sumStr(parts)}) = ${k}`
  const domainOK = (x) => inner(x) + Ak > 1e-12
  const real = (x) => domainOK(x) ? Math.log(inner(x) + Ak) / Math.log(a) - k : NaN
  const cs = trigSolution("cos", R(1, p)), ss = trigSolution("sin", R(1, q))
  if (!cs || !ss) return null
  return finishArc(eq, [...cs.rSeries, ...ss.rSeries], [...cs.arcSeries, ...ss.arcSeries],
    [...cs.genParts, ...ss.genParts], inner, domainOK, real)
}
// решение f(x) = значение: «круглое» → π-серии, иначе арк-серии
function trigSolution(fn, vR) {
  const v = vR.p / vR.q
  const key = fn === "tan" ? TAN_KEY(v) : numToTrigKey(v)   // у tg свой набор «круглых» значений
  if (key) return { rSeries: seriesFor(fn, key), arcSeries: [], genParts: [textFor(fn, key)] }
  const arcS = makeArcSeries(fn === "tan" ? "tg" : fn, vR)   // makeArcSeries знает «tg», не «tan»
  return { rSeries: [], arcSeries: arcS, genParts: arcS.map((s) => s.genText).filter(Boolean) }
}

// ============================================================================
// ПОКАЗАТЕЛЬНЫЕ × ТРИГОНОМЕТРИЯ — оставшиеся типажи PDF
// ============================================================================

// ET5 — a^(sin²x) + a^(cos²x) = k.  u=a^(sin²x) ⟹ u + a/u = k.
//   k=a+1 → u=1,a → sin²x=0 ∪ 1 → x=πn/2 ;  k=2√a → u=√a (двойной) → sin²x=½ → x=π/4+πn/2
function t13ExpTrigSumSq() { return retryGen(t13ExpTrigSumSqOnce) }
function t13ExpTrigSumSqOnce() {
  const sqBase = pick([4, 9, 16, 25])
  const dbl = Math.random() < 0.4
  const a = dbl ? sqBase : pick([2, 3, 5, 6, 7])
  const k = dbl ? 2 * Math.sqrt(a) : a + 1
  const first = pick(["sin", "cos"]), second = first === "sin" ? "cos" : "sin"
  const eq = `${a}⟦sup:${first}²x⟧ + ${a}⟦sup:${second}²x⟧ = ${k}`
  const Ff = first === "sin" ? Math.sin : Math.cos
  const residual = (x) => { const u = a ** (Ff(x) ** 2); return u + a / u - k }
  const series = dbl ? [{ base: R(1, 4), T: R(1, 2) }] : [{ base: R(0), T: R(1, 2) }]
  return finishGen(eq, series, residual, { maxRoots: 4, lens: [1, 2, 2, 3] })
}

// ET6 — (aᴬ)^(f²x) = (1/aᴮ)^(sin 2x)·aᶜ  (С=±A) ⟹ множитель выносится: f=0 ∪ tg x = A/(2B)
function t13ExpTrigTgRatio() { return retryGen(t13ExpTrigTgRatioOnce) }
function t13ExpTrigTgRatioOnce() {
  const p = pick([2, 3, 5, 6])
  const cap = (n) => p ** n <= 100                       // основания вида 1/1296 не показываем
  const As = [1, 2, 3, 4].filter(cap), Bs = [1, 2, 3].filter(cap)
  if (!As.length || !Bs.length) return null
  const A = pick(As), B = pick(Bs)
  const useSin = Math.random() < 0.5
  const powA = p ** A, powB = p ** B
  // sin-вариант:  (p^A)^{sin²x} = (1/p^B)^{sin2x} · p^A  ⟹ cos x=0 ∪ tg x = A/(2B)
  // cos-вариант:  (1/p^A)^{cos²x} = (p^B)^{sin2x} · (1/p^A) ⟹ sin x=0 ∪ tg x = 2B/A
  const eq = useSin
    ? `${powA}⟦sup:sin²x⟧ = ⟦pf:1:${powB}⟧⟦sup:sin 2x⟧ · ${powA}`
    : `⟦pf:1:${powA}⟧⟦sup:cos²x⟧ = ${powB}⟦sup:sin 2x⟧ · ⟦pf:1:${powA}⟧`
  const tgR = useSin ? R(A, 2 * B) : R(2 * B, A)
  const zeroFn = useSin ? "cos" : "sin"
  const residual = useSin
    ? (x) => Math.cos(x) * (A * Math.cos(x) - 2 * B * Math.sin(x))
    : (x) => Math.sin(x) * (A * Math.sin(x) - 2 * B * Math.cos(x))
  const real = useSin
    ? (x) => powA ** (Math.sin(x) ** 2) - (1 / powB) ** Math.sin(2 * x) * powA
    : (x) => (1 / powA) ** (Math.cos(x) ** 2) - powB ** Math.sin(2 * x) / powA
  const sol = trigSolution("tan", tgR)
  if (!sol) return null
  return finishArc(eq, [...seriesFor(zeroFn, "zero"), ...sol.rSeries], sol.arcSeries,
    [textFor(zeroFn, "zero"), ...sol.genParts], residual, null, real)
}

// ET7 — P^(sin x) + c·P^(приведение к −sin x) = k.  u=P^(sin x) ⟹ u² − k·u + c = 0.
//   корни u=P^{t₁}, P^{t₂} (t ∈ {0, ±½, ±1}) → sin x = t
const ET7_T = [1, -1, 0.5, -0.5, 0]
function t13ExpTrigSym2() { return retryGen(t13ExpTrigSym2Once) }
function t13ExpTrigSym2Once() {
  const P = pick([4, 9, 16, 25, 36])
  const t1 = pick(ET7_T), t2 = pick(ET7_T)
  if (t1 === t2 || t1 + t2 < 0) return null
  const k1 = numToTrigKey(t1), k2 = numToTrigKey(t2)
  if (!k1 || !k2) return null
  const c = Math.round(P ** (t1 + t2))
  if (!Number.isInteger(c) || Math.abs(P ** (t1 + t2) - c) > 1e-9) return null
  const kv = P ** t1 + P ** t2
  // k как целое либо стоячая дробь
  let kStr
  if (Math.abs(kv - Math.round(kv)) < 1e-9) kStr = String(Math.round(kv))
  else {
    const den = Math.round(Math.sqrt(P)) ** 2 === P ? Math.round(1 / (P ** Math.min(t1, t2))) : 0
    if (!den || Math.abs(kv * den - Math.round(kv * den)) > 1e-9) return null
    kStr = `⟦f:${Math.round(kv * den)}:${den}⟧`
  }
  const [redStr, redEv] = redLin("sin", -1)
  const eq = `${P}⟦sup:sin x⟧ + ${c === 1 ? "" : c + "·"}${P}⟦sup:${redStr}⟧ = ${kStr}`
  const residual = (x) => { const u = P ** Math.sin(x); return u * u - kv * u + c }
  const real = (x) => P ** Math.sin(x) + c * P ** redEv(x) - kv
  const series = [...seriesFor("sin", k1), ...seriesFor("sin", k2)]
  return finishGen(eq, series, residual, {
    realResidual: real, text: `${sinText(k1)},  ${sinText(k2)}`,
  })
}

// ============================================================================
// ИРРАЦИОНАЛЬНЫЕ — оставшиеся типажи PDF
// ============================================================================

// I1 — √(x³+Ax²+Bx+C) = b − x.  Радиканд = (b−x)² + (x−r₁)(x−r₂)(x−r₃):
//   уравнение ⟺ произведение = 0 И b−x ≥ 0 (один корень отсекается).
function t13IrrCubic() { return retryGen(t13IrrCubicOnce, 80) }
function t13IrrCubicOnce() {
  const b = pick([2, 3, 4, 5])
  const rs = []
  while (rs.length < 3) { const r = randInt(-4, 6); if (!rs.includes(r)) rs.push(r) }
  const kept = rs.filter((r) => r <= b).sort((p, q) => p - q)
  if (kept.length !== 2) return null                       // ровно один отсекается по ОДЗ
  const [r1, r2, r3] = rs
  const A0 = -(r1 + r2 + r3), B0 = r1 * r2 + r1 * r3 + r2 * r3, C0 = -r1 * r2 * r3
  const A = A0 + 1, B = B0 - 2 * b, C = C0 + b * b
  const prod = (x) => (x - r1) * (x - r2) * (x - r3)
  const rad = (x) => x ** 3 + A * x * x + B * x + C
  const radStr = `x³${A ? ` ${A < 0 ? MINUS : "+"} ${Math.abs(A) === 1 ? "" : Math.abs(A)}x²` : ""}` +
    `${B ? ` ${B < 0 ? MINUS : "+"} ${Math.abs(B) === 1 ? "" : Math.abs(B)}x` : ""}` +
    `${C ? ` ${C < 0 ? MINUS : "+"} ${Math.abs(C)}` : ""}`
  const eq = `⟦r:${radStr}⟧ = ${b} ${MINUS} x`
  const domainOK = (x) => b - x >= -1e-9 && rad(x) >= -1e-9
  const real = (x) => (rad(x) < 0 ? NaN : Math.sqrt(rad(x)) - (b - x))
  const roots = kept.map((r) => ({ num: r, text: intT(r) }))
  const iv = pickIntInterval(roots.map((r) => r.num))
  if (!iv) return null
  const o = finish(eq, roots, prod, iv, domainOK)
  if (o) o._verify.realResidual = real
  return o
}

// I2 — √(C + sin²x + cos 2x) = k ⟺ cos²x = k² − C  (sin²x+cos2x = cos²x)
//   и √(C + cos²x − cos 2x) = k ⟺ sin²x = k² − C
function t13IrrConstTrig() { return retryGen(t13IrrConstTrigOnce) }
function t13IrrConstTrigOnce() {
  const k = pick([2, 3])
  const e = pick(SQ_T.filter((t) => Rkey(t.u) !== Rkey(R(1))))   // u ∈ {¼, ½, ¾}
  const u = e.u.p / e.u.q
  const C = k * k - u
  const plus = Math.random() < 0.5                              // sin²+cos2x = cos²x
  const fn = plus ? "cos" : "sin"
  const inner = plus ? `sin²x + cos 2x` : `cos²x ${MINUS} cos 2x`
  const order = Math.random() < 0.5
  const radStr = order ? `${ru2(C)} + ${inner}` : `${inner} + ${ru2(C)}`
  const eq = `⟦r:${radStr}⟧ = ${k}`
  const Ff = fn === "cos" ? Math.cos : Math.sin
  const residual = (x) => Ff(x) ** 2 - u
  const innerEv = plus
    ? (x) => Math.sin(x) ** 2 + Math.cos(2 * x)
    : (x) => Math.cos(x) ** 2 - Math.cos(2 * x)
  const real = (x) => Math.sqrt(C + innerEv(x)) - k
  const sol = sqSolution(fn, e, 1)
  return finishGen(eq, sol.series, residual, { realResidual: real, text: sol.text })
}

// I3 — f x = √((1 ± g x)/2).  Возводим в квадрат → квадрат по g; ОДЗ: f x ≥ 0.
function t13IrrHalfSum() { return retryGen(t13IrrHalfSumOnce) }
function t13IrrHalfSumOnce() {
  const f = pick(["cos", "sin"]), g = f === "cos" ? "sin" : "cos"
  const sg = pick([1, -1])
  const Ff = f === "cos" ? Math.cos : Math.sin
  const Gf = g === "cos" ? Math.cos : Math.sin
  // f² = (1+sg·g)/2 ⟺ 1−g² = (1+sg·g)/2 ⟺ 2g² + sg·g − 1 = 0 → g = sg·½ ... −sg
  const v1 = sg * 0.5, v2 = -sg
  const k1 = numToTrigKey(v1), k2 = numToTrigKey(v2)
  if (!k1 || !k2) return null
  const eq = `${f} x = ⟦rf:¦1 ${sg < 0 ? MINUS : "+"} ${g} x¦2¦⟧`
  const residual = (x) => 2 * Gf(x) ** 2 + sg * Gf(x) - 1
  const domainOK = (x) => Ff(x) >= -1e-9
  const real = (x) => Ff(x) - Math.sqrt(Math.max((1 + sg * Gf(x)) / 2, 0))
  const refined = refineSeries([...seriesFor(g, k1), ...seriesFor(g, k2)], domainOK)
  if (!refined.length) return null
  return finishGen(eq, refined, residual, { realResidual: real, domainOK, text: seriesListText(refined) })
}

// ── реестр ──────────────────────────────────────────────────────────────────
export const GEN13 = [
  t13SinQuad, t13CosQuad, t13CosSqSinLin, t13SinSqCosLin,
  t13Cos2xSin, t13Cos2xCos, t13CosSqMinusCos2x, t13QuadRad,
  t13Biquart, t13Cos4xQuad, t13Cos4xSqLow,
  t13CubicFactor, t13CubicGroup, t13CubicPyth,
  t13FactorMixed, t13FactorTgSin2x, t13FactorCtgSin2x, t13FactorSinMinusCos, t13FactorSinPlusCos, t13FactorCosTimesEq1,
  t13ExpSumPow, t13ExpQuadInAx, t13ExpHomogQuad,
  t13ExpCubicGroup, t13ExpHalfPow, t13ExpNegPow, t13ExpHomogLin, t13ExpAbs,
  t13LogQuad, t13LogDiff, t13LogTwoBases, t13LogVarBase, t13LogSqrtBase,
  t13ProductAlgTrig, t13ProductSqrt,
  t13IrrSin, t13IrrCos, t13IrrCubic, t13IrrConstTrig, t13IrrHalfSum,
  t13ExpTrigProduct, t13ExpTrigSym, t13ExpTrigQuad, t13ExpTrigTower,
  t13ExpTrigSumSq, t13ExpTrigTgRatio, t13ExpTrigSym2,
  t13LogTrigProd, t13LogTrigQuad, t13LogTrigQuadIn, t13LogTrigGroup,
  t13BiquadSin, t13BiquadCos, t13BiquadCtgSin, t13BiquadTgCos,
  t13Rational,
  t13Grouping,
  t13SumDiff, t13AddFormula, t13HalfAngle,
  t13ArcSin, t13ArcCos, t13ArcTan, t13Homogeneous, t13ReciprocalTg,
  t13GroupAlgTrig,
  t13FracTgOverLin, t13FracSqrtDen, t13TgSqIdentity, t13FracSin2x, t13SinTgFactor, t13ProdLog,
  t13FracArcCosTg, t13FracArcSinCos,
  t13ReductProd, t13ReductFactor,
]

export const META13 = [
  ["Тригонометрические: квадратные уравнения", [
    ["sin-quad", "a·sin²x+b·sinx+c=0", t13SinQuad],
    ["cos-quad", "a·cos²x+b·cosx+c=0", t13CosQuad],
    ["cossq-sinlin", "A·cos²x+B·sinx+C=0 (cos²=1−sin²)", t13CosSqSinLin],
    ["sinsq-coslin", "A·sin²x+B·cosx+C=0 (sin²=1−cos²)", t13SinSqCosLin],
    ["cos2x-sin", "P·cos2x+Q·sinx+R=0", t13Cos2xSin],
    ["cos2x-cos", "P·cos2x+Q·cosx+R=0", t13Cos2xCos],
    ["cossq-cos2x", "cos²x−cos2x=C / sin²x+cos2x=C", t13CosSqMinusCos2x],
    ["quad-rad", "квадрат с √-коэффициентами: 2cos²x+(√3−2)sinx−2+√3=0", t13QuadRad],
  ]],
  ["Тригонометрические: биквадратные (4-я степень)", [
    ["biquart", "A·f⁴x+B·f²x+C=0 (в т.ч. через cos2x и с аргументом 2x)", t13Biquart],
    ["cos4x-quad", "P·cos4x+Q·f(2x)+R=0 (квадрат по f(2x))", t13Cos4xQuad],
    ["cos4x-sq", "P·cos4x+Q·sin²x+R=0 (квадрат по cos2x)", t13Cos4xSqLow],
  ]],
  ["Тригонометрические: кубические", [
    ["cubic-factor", "a·f³x = b·f x (вынос f, приведение в показе)", t13CubicFactor],
    ["cubic-group", "(2f+p)(f²+m)=0 — группировка", t13CubicGroup],
    ["cubic-pyth", "A·f³x−A·f x+ḡ²x=0 → ḡ=0 ∪ f=1/A", t13CubicPyth],
  ]],
  ["Тригонометрические: вынос общего множителя (ОДЗ)", [
    ["factor-mixed", "f·(a·sinx+b·cosx+c)=0 — sin2x/произведение приведений", t13FactorMixed],
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
    ["exp-cubic-group", "27ˣ−p·9ˣ−a^(x+2m)+p·q²=0 (кубическая группировка)", t13ExpCubicGroup],
    ["exp-half-pow", "(a²)^(x−½)−c·a^(x−1)+d=0 (дробный показатель)", t13ExpHalfPow],
    ["exp-neg-pow", "(a³)ˣ−c·a^(x+s)+a^(m−x)=0 (биквадрат по aˣ)", t13ExpNegPow],
    ["exp-homog-lin", "P·(a²)ˣ+Q·(ab)ˣ+R·(b²)ˣ=0 (однородное по x)", t13ExpHomogLin],
    ["exp-abs", "(aˣ−c)²+λ·aˣ+μ=k|aˣ−c| (с модулем)", t13ExpAbs],
  ]],
  ["Логарифмические", [
    ["log-quad", "A·log²ₐx+B·logₐx+C=0 (корни aⁿ)", t13LogQuad],
    ["log-diff", "logₐf=logₐg, f,g квадратные (ОДЗ f,g>0)", t13LogDiff],
    ["log-two-bases", "logₐ(b−x)=log_{a²}x⁴ (разные основания)", t13LogTwoBases],
    ["log-var-base", "log_{x²+bx+c}(куб.)=0 (переменное основание, отсев по ОДЗ)", t13LogVarBase],
    ["log-sqrt-base", "1+logₐ(x⁴+m)=log_{√a}√(px²+q)", t13LogSqrtBase],
  ]],
  ["Произведение / дробь = 0", [
    ["prod-alg-trig", "(алгебр. квадрат)(2cosx±1)=0 (десятич.+π)", t13ProductAlgTrig],
    ["prod-sqrt", "P(триг)·√(k·триг)=0 (знаковая ОДЗ, √=0)", t13ProductSqrt],
  ]],
  ["Иррациональные (тригонометрия под корнем)", [
    ["irr-sin", "sinx+√(C(1−cosx))=0 (ОДЗ sinx≤0)", t13IrrSin],
    ["irr-cos", "cosx+√(C(sinx+1))=0 (ОДЗ cosx≤0)", t13IrrCos],
    ["irr-cubic", "√(x³+Ax²+Bx+C)=b−x (отсев по ОДЗ b−x≥0)", t13IrrCubic],
    ["irr-const", "√(C+sin²x+cos2x)=k → cos²x=k²−C", t13IrrConstTrig],
    ["irr-half", "f x=√((1±g x)/2) (ОДЗ f x≥0)", t13IrrHalfSum],
  ]],
  ["Показательные × тригонометрия", [
    ["et-product", "(ab)^E=a^E·b^F → tgx=±1", t13ExpTrigProduct],
    ["et-sym", "p^T+p^{−T}=k → trig=±v / 0", t13ExpTrigSym],
    ["et-quad", "a·(p²)^T+b·p^T+c=0 → trig=значения", t13ExpTrigQuad],
    ["et-tower", "((q²)^sinx)^cosx=q^{r·sinx} → sinx=0∪cos=r/2", t13ExpTrigTower],
    ["et-sumsq", "a^(sin²x)+a^(cos²x)=k → x=πn/2 либо π/4+πn/2", t13ExpTrigSumSq],
    ["et-tg-ratio", "(aᴬ)^(f²x)=(1/aᴮ)^(sin2x)·aᴬ → f=0 ∪ tgx=A/(2B)", t13ExpTrigTgRatio],
    ["et-sym2", "P^sinx+c·P^(приведение к −sinx)=k", t13ExpTrigSym2],
  ]],
  ["Логарифмические × тригонометрия", [
    ["lt-prod", "logₐ(T±sin2x+aᵏ)=k → T=0∪other=∓1/2", t13LogTrigProd],
    ["lt-quad", "A·log²₂(2·триг)+B·log₂(2·триг)+C=0", t13LogTrigQuad],
    ["lt-quad-in", "log_A(cos2x+Q·f x+R)=0 (квадрат внутри логарифма)", t13LogTrigQuadIn],
    ["lt-group", "logₐ(группировка+aᵏ)=k → arccos(1/p) ∪ arcsin(1/q)", t13LogTrigGroup],
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
    ["add-formula", "составной аргумент cos(2x−π/3) → раскрытие и сокращение", t13AddFormula],
  ]],
  ["Полуугол", [
    ["half-angle", "квадрат по f(x/2), спрятанный за cos x", t13HalfAngle],
  ]],
  ["Арксинусы / арккосинусы / арктангенсы", [
    ["arcsin", "a·sin²x+b·sinx+c=0 → arcsin(«некруглое»)", t13ArcSin],
    ["arccos", "a·cos²x+b·cosx+c=0 → arccos(«некруглое»)", t13ArcCos],
    ["arctg", "a·tg²x+b·tgx+c=0 → arctg(«некруглое»)", t13ArcTan],
    ["homogen", "A·sin²x+B·sinxcosx+C·cos²x=0 (однородное → tg)", t13Homogeneous],
    ["recip-tg", "A/tg²x+B/tgx+C=0 (квадрат по ctg)", t13ReciprocalTg],
  ]],
  ["Группировка (алгебра × тригонометрия)", [
    ["group-alg-trig", "2x·cosx−2m·cosx+x−m=0 → (x−m)(2cosx+1)=0", t13GroupAlgTrig],
  ]],
  ["Дробь = 0 / ОДЗ", [
    ["frac-tg-lin", "(k·tgx+m)/(a·f x+b)=0 — отсев ветви знаменателем", t13FracTgOverLin],
    ["frac-sqrt-den", "(2f x−v)/√(k·g x)=0 — строгая ОДЗ g>0", t13FracSqrtDen],
    ["tgsq-ident", "(1+tg²x)·[±sin2x/±cos2x]=C", t13TgSqIdentity],
    ["frac-sin2x", "sin2x/[приведение]=C → 2·другая=±C", t13FracSin2x],
    ["sin-tg-factor", "A·sinx=B·tgx и A·sin²x=B·tgx", t13SinTgFactor],
    ["prod-log", "P(триг)·logₐ(g)=0 и P/logₐ(g)=0", t13ProdLog],
  ]],
  ["Арки в одних точках (дробь = 0)", [
    ["frac-cos-tg", "(c·cosx−a)/(a·tgx+b)=0 → одна ветвь arccos", t13FracArcCosTg],
    ["frac-sin-cos", "(c·sin²x−a·sinx)/(c·cosx+b)=0 → sinx=0∪одна ветвь arcsin", t13FracArcSinCos],
  ]],
  ["Формулы приведения (составные аргументы)", [
    ["red-prod", "tg(π+x)·cos(2x−π/2)=cos(−π/3) → sin=±v", t13ReductProd],
    ["red-factor", "tg/ctg x + cos(π/2+2x)=0 → факторизация", t13ReductFactor],
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
