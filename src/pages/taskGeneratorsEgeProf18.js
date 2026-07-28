// Генераторы ЕГЭ математика ПРОФИЛЬ, задание №18 (часть 2): «задачи с параметром».
//
// Эталон типажей — PDF «Задача №18» (187 задач, 20 разделов; инвентарь строка-в-строку —
// fipi_bank_ege_prof/typages_task18.md).
//
// ФИЛОСОФИЯ (важно):
//   1) Каждая задача строится ОТ ОТВЕТА: сначала фиксируется конфигурация и границы по
//      параметру (целые или простые дроби), потом под них подбираются коэффициенты условия
//      алгебраически — не перебором.
//   2) У объекта ДВА независимых представления:
//      • construct — множество значений параметра (структурой `set`), выведенное из
//        конструкции; из него же печатается строка ответа;
//      • pieces(a) — НЕЗАВИСИМЫЙ решатель: для конкретного a отдаёт кусочно-заданное
//        уравнение (числитель/знаменатель — многочлены по x на явных промежутках), по
//        которому verify18 ЗАНОВО считает число решений.
//   3) Число решений считается ТОЧНО: рациональная арифметика на BigInt + теорема Штурма
//      (число РАЗЛИЧНЫХ вещественных корней на промежутке). Никаких ε, никаких порогов,
//      кратные корни и касания не теряются в принципе. Поэтому сеточная проверка по a
//      совпадает с ответом побитово, а не «в пределах точности».
//   4) В generateTask нет перебора: только арифметика и чтение таблиц, посчитанных один раз.
//
// Формат объекта: { condition_text, answer, answer_set, solution, solution_image, _verify }.
// Мат-токены разворачивает renderTaskMath(): ⟦f:n:d⟧ дробь, ⟦r:x⟧ корень, ⟦sup:x⟧ показатель.
// В УСЛОВИИ картинок нет: чертёж (плоскость (x; a)) лежит в solution_image.

// ── базовые утилиты показа ───────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const MINUS = "−" // U+2212
const SUP = { 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶" }
const fT = (n, d) => `⟦f:${n}:${d}⟧`
// Целое число в тексте: минус — типографский U+2212 (ASCII-дефис в условиях запрещён).
const nS = (n) => String(n).replace("-", MINUS)
// Слагаемое «± kx» в цепочке (k может быть отрицательным или нулём).
// Слагаемое «+ 3x», «− y», «+ 1». ВАЖНО: при пустой переменной (свободный член) единицу
// печатать обязательно — иначе «x² + 1» превращалось в «x² +» и слагаемое пропадало.
const term = (k, v) => (k === 0 ? "" : ` ${k > 0 ? "+" : MINUS} ${Math.abs(k) === 1 && v ? "" : Math.abs(k)}${v}`)
const EPS = 1e-9
const sqrtSafe = (v) => Math.sqrt(Math.max(0, v))     // подкоренное, равное нулю с точностью до float
const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

// ── рациональные числа на BigInt ─────────────────────────────────────────────
const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { const t = a % b; a = b; b = t } return a || 1n }
function R(n, d = 1n) {
  n = BigInt(n); d = BigInt(d)
  if (d === 0n) throw new Error("R: деление на 0")
  if (d < 0n) { n = -n; d = -d }
  const g = bgcd(n, d)
  return { n: n / g, d: d / g }
}
const R0 = R(0), R1 = R(1)
const Radd = (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d)
const Rsub = (a, b) => R(a.n * b.d - b.n * a.d, a.d * b.d)
const Rmul = (a, b) => R(a.n * b.n, a.d * b.d)
const Rdiv = (a, b) => R(a.n * b.d, a.d * b.n)
const Rneg = (a) => R(-a.n, a.d)
const Rsign = (a) => (a.n > 0n ? 1 : a.n < 0n ? -1 : 0)
const Rcmp = (a, b) => Rsign(Rsub(a, b))
const Rzero = (a) => a.n === 0n
const Rnum = (a) => Number(a.n) / Number(a.d)
// Печать рационального числа в ОТВЕТЕ (plain-текст): «7/2», «−3».
function Rstr(a) {
  const s = a.n < 0n ? MINUS : ""
  const n = a.n < 0n ? -a.n : a.n
  return a.d === 1n ? s + n.toString() : `${s}${n}/${a.d}`
}
// ── многочлены над Q: массив коэффициентов, индекс = степень ─────────────────
const pTrim = (p) => { const q = p.slice(); while (q.length && Rzero(q[q.length - 1])) q.pop(); return q }
const pDeg = (p) => p.length - 1                    // нулевой многочлен → −1
const pLead = (p) => p[p.length - 1]
const pNeg = (p) => p.map(Rneg)
function pAdd(a, b) { const n = Math.max(a.length, b.length), r = []; for (let i = 0; i < n; i++) r.push(Radd(a[i] || R0, b[i] || R0)); return pTrim(r) }
function pSub(a, b) { const n = Math.max(a.length, b.length), r = []; for (let i = 0; i < n; i++) r.push(Rsub(a[i] || R0, b[i] || R0)); return pTrim(r) }
function pMul(a, b) {
  if (!a.length || !b.length) return []
  const r = new Array(a.length + b.length - 1).fill(R0)
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) r[i + j] = Radd(r[i + j], Rmul(a[i], b[j]))
  return pTrim(r)
}
const pDeriv = (p) => pTrim(p.slice(1).map((c, i) => Rmul(c, R(i + 1))))
function pMod(a, b) { // остаток от деления a на b (b ≠ 0)
  let r = a.slice()
  const db = pDeg(b), lb = pLead(b)
  while (pTrim(r).length && pDeg(pTrim(r)) >= db) {
    r = pTrim(r)
    const k = Rdiv(pLead(r), lb), sh = pDeg(r) - db
    const sub = new Array(sh).fill(R0).concat(b.map((c) => Rmul(c, k)))
    r = pSub(r, sub)
  }
  return pTrim(r)
}
function pDivExact(a, b) { // частное (используется только когда делится нацело)
  let r = a.slice(); const q = new Array(Math.max(0, pDeg(a) - pDeg(b) + 1)).fill(R0)
  const db = pDeg(b), lb = pLead(b)
  while (pTrim(r).length && pDeg(pTrim(r)) >= db) {
    r = pTrim(r)
    const k = Rdiv(pLead(r), lb), sh = pDeg(r) - db
    q[sh] = k
    r = pSub(r, new Array(sh).fill(R0).concat(b.map((c) => Rmul(c, k))))
  }
  return pTrim(q)
}
function pGcd(a, b) {
  a = pTrim(a); b = pTrim(b)
  while (b.length) { const r = pMod(a, b); a = b; b = r }
  if (!a.length) return []
  const l = pLead(a)
  return a.map((c) => Rdiv(c, l))
}
const pEval = (p, x) => p.reduceRight((acc, c) => Radd(Rmul(acc, x), c), R0)

// Знак многочлена в точке; x может быть "-inf"/"+inf".
function pSignAt(p, x) {
  if (!p.length) return 0
  if (x === "+inf") return Rsign(pLead(p))
  if (x === "-inf") return Rsign(pLead(p)) * (pDeg(p) % 2 === 0 ? 1 : -1)
  return Rsign(pEval(p, x))
}
// Цепь Штурма для многочлена без кратных корней.
function sturmChain(p) {
  const ch = [p, pDeriv(p)]
  while (pDeg(ch[ch.length - 1]) > 0) {
    const r = pNeg(pMod(ch[ch.length - 2], ch[ch.length - 1]))
    if (!r.length) break
    ch.push(r)
  }
  return ch
}
const sturmV = (ch, x) => {
  let v = 0, prev = 0
  for (const p of ch) { const s = pSignAt(p, x); if (s === 0) continue; if (prev !== 0 && s !== prev) v++; prev = s }
  return v
}
// ЧИСЛО РАЗЛИЧНЫХ вещественных корней p на промежутке с указанным включением концов.
// Точно, без приближений: Штурм даёт число корней на (l; r], концы правим явно.
function countRoots(p, lo, hi, incLo, incHi) {
  p = pTrim(p)
  if (!p.length) throw new Error("countRoots: тождественный ноль")
  if (pDeg(p) === 0) return 0
  const sq = pDivExact(p, pGcd(p, pDeriv(p)))   // бесквадратная часть: только различные корни
  if (pDeg(sq) === 0) return 0
  const ch = sturmChain(sq)
  let n = sturmV(ch, lo) - sturmV(ch, hi)        // корни на (lo; hi]
  if (incLo && lo !== "-inf" && Rzero(pEval(sq, lo))) n++
  if (!incHi && hi !== "+inf" && Rzero(pEval(sq, hi))) n--
  return n
}

// ── множество значений параметра: промежутки + изолированные точки ───────────
// Конец промежутка: рациональное число или "-inf"/"+inf".
const IV = (lo, hi, incLo = false, incHi = false) => ({ lo, hi, incLo, incHi })
const SET = (intervals, points = []) => ({ intervals, points })
// Всё ℝ без перечисленных точек (точки — массив рациональных, порядок любой).
function uniqSorted(points) {                       // без повторов: иначе в ответе пустой «(−1; −1)»
  const out = []
  for (const p of points.slice().sort(Rcmp)) if (!out.length || Rcmp(out[out.length - 1], p) !== 0) out.push(p)
  return out
}
function realsExcept(points) {
  const pts = uniqSorted(points)
  const iv = []
  let prev = "-inf"
  for (const p of pts) { iv.push(IV(prev, p)); prev = p }
  iv.push(IV(prev, "+inf"))
  return SET(iv)
}
// Промежуток (lo; hi) без перечисленных внутренних точек.
function gapExcept(lo, hi, points, incLo = false, incHi = false) {
  const pts = uniqSorted(points.filter((p) => (lo === "-inf" || Rcmp(p, lo) > 0) && (hi === "+inf" || Rcmp(p, hi) < 0)))
  const iv = []
  let prev = lo, inc = incLo
  for (const p of pts) { iv.push(IV(prev, p, inc, false)); prev = p; inc = false }
  iv.push(IV(prev, hi, inc, incHi))
  return SET(iv)
}
// Печать значения в ответе. unit === "pi" — число хранится в единицах π (тригонометрия),
// печатается как «π/2», «−3π/4», «2π»; иначе обычная рациональная запись.
function valStr(a, unit) {
  if (unit !== "pi") return Rstr(a)
  if (Rzero(a)) return "0"
  const sg = a.n < 0n ? MINUS : ""
  const n = a.n < 0n ? -a.n : a.n
  const head = n === 1n ? "π" : `${n}π`
  return a.d === 1n ? sg + head : `${sg}${head}/${a.d}`
}
const epStr = (e, unit) => (e === "-inf" ? MINUS + "∞" : e === "+inf" ? "+∞" : valStr(e, unit))
function setToString(set, unit) {
  // части ответа печатаются слева направо по числовой оси (изолированные точки — на своём месте)
  const parts = set.intervals.map((i) => ({
    at: i.lo === "-inf" ? -Infinity : Rnum(i.lo),
    s: `${i.incLo ? "[" : "("}${epStr(i.lo, unit)}; ${epStr(i.hi, unit)}${i.incHi ? "]" : ")"}`,
  }))
  for (const p of set.points) parts.push({ at: Rnum(p), s: `{${valStr(p, unit)}}` })
  return parts.sort((x, y) => x.at - y.at).map((x) => x.s).join(" ∪ ")
}
// Структура ответа для проверки (числа — обычные, для чтения человеком/машиной).
function setPlain(set, unit) {
  const k = unit === "pi" ? Math.PI : 1
  return {
    unit: unit === "pi" ? "pi" : null,
    intervals: set.intervals.map((i) => ({
      lo: i.lo === "-inf" ? -Infinity : Rnum(i.lo) * k, hi: i.hi === "+inf" ? Infinity : Rnum(i.hi) * k,
      lo_included: i.incLo, hi_included: i.incHi,
    })),
    points: set.points.map((p) => Rnum(p) * k),
  }
}
function inSet(set, a) {
  for (const p of set.points) if (Rcmp(a, p) === 0) return true
  for (const i of set.intervals) {
    const okLo = i.lo === "-inf" || (i.incLo ? Rcmp(a, i.lo) >= 0 : Rcmp(a, i.lo) > 0)
    const okHi = i.hi === "+inf" || (i.incHi ? Rcmp(a, i.hi) <= 0 : Rcmp(a, i.hi) < 0)
    if (okLo && okHi) return true
  }
  return false
}
// Все конечные границы множества (для отдельной проверки каждой границы).
function setBounds(set) {
  const out = []
  for (const i of set.intervals) { if (i.lo !== "-inf") out.push(i.lo); if (i.hi !== "+inf") out.push(i.hi) }
  for (const p of set.points) out.push(p)
  const uniq = []
  for (const b of out.sort(Rcmp)) if (!uniq.length || Rcmp(uniq[uniq.length - 1], b) !== 0) uniq.push(b)
  return uniq
}

// ── чертёж: плоскость (x; a) ─────────────────────────────────────────────────
// curves: [{ f: (a) => x | null, dash?: bool, label?: string }] — ветви кривых, x как функция a;
// marks: [{ x, a }] — выколотые точки; hlines: [a] — пунктирные горизонтали (границы ответа).
function planeSvg({ curves = [], marks = [], hlines = [], xMin = -6, xMax = 6, aMin = -6, aMax = 6 }) {
  const W = 460, H = 420, PAD = 34
  const X = (x) => PAD + ((x - xMin) / (xMax - xMin)) * (W - 2 * PAD)
  const Y = (a) => H - PAD - ((a - aMin) / (aMax - aMin)) * (H - 2 * PAD)
  const g = []
  g.push(`<rect width="${W}" height="${H}" fill="#fff"/>`)
  // сетка по целым
  for (let x = Math.ceil(xMin); x <= xMax; x++) g.push(`<line x1="${X(x).toFixed(1)}" y1="${PAD}" x2="${X(x).toFixed(1)}" y2="${H - PAD}" stroke="#eef1f5"/>`)
  for (let a = Math.ceil(aMin); a <= aMax; a++) g.push(`<line x1="${PAD}" y1="${Y(a).toFixed(1)}" x2="${W - PAD}" y2="${Y(a).toFixed(1)}" stroke="#eef1f5"/>`)
  // оси
  g.push(`<line x1="${PAD}" y1="${Y(0).toFixed(1)}" x2="${W - PAD}" y2="${Y(0).toFixed(1)}" stroke="#111" stroke-width="1.2"/>`)
  g.push(`<line x1="${X(0).toFixed(1)}" y1="${H - PAD}" x2="${X(0).toFixed(1)}" y2="${PAD}" stroke="#111" stroke-width="1.2"/>`)
  g.push(`<text x="${W - PAD + 6}" y="${(Y(0) + 4).toFixed(1)}" font-family="Georgia,serif" font-size="15" font-style="italic">x</text>`)
  g.push(`<text x="${(X(0) - 14).toFixed(1)}" y="${PAD - 8}" font-family="Georgia,serif" font-size="15" font-style="italic">a</text>`)
  for (const h of hlines) {
    if (h < aMin || h > aMax) continue
    g.push(`<line x1="${PAD}" y1="${Y(h).toFixed(1)}" x2="${W - PAD}" y2="${Y(h).toFixed(1)}" stroke="#9aa3ad" stroke-width="1" stroke-dasharray="4 4"/>`)
    g.push(`<text x="${(X(0) - 8).toFixed(1)}" y="${(Y(h) - 4).toFixed(1)}" text-anchor="end" font-family="Georgia,serif" font-size="12">${String(h).replace("-", MINUS).replace(".", ",")}</text>`)
  }
  const COL = ["#0a58ca", "#c1121f", "#2a9d38", "#7b2cbf"]
  curves.forEach((c, k) => {
    const N = 420, segs = []
    let cur = []
    for (let i = 0; i <= N; i++) {
      const a = aMin + ((aMax - aMin) * i) / N
      const x = c.f(a)
      if (x === null || !Number.isFinite(x) || x < xMin - 2 || x > xMax + 2) { if (cur.length > 1) segs.push(cur); cur = []; continue }
      cur.push(`${X(x).toFixed(1)},${Y(a).toFixed(1)}`)
    }
    if (cur.length > 1) segs.push(cur)
    for (const s of segs) {
      g.push(`<polyline points="${s.join(" ")}" fill="none" stroke="${COL[k % COL.length]}" stroke-width="2"${c.dash ? ' stroke-dasharray="6 4"' : ""}/>`)
    }
    if (c.label) g.push(`<text x="${W - PAD - 6}" y="${PAD + 16 + 17 * k}" text-anchor="end" font-family="Georgia,serif" font-size="13" fill="${COL[k % COL.length]}">${c.label}</text>`)
  })
  for (const m of marks) {
    if (m.x < xMin || m.x > xMax || m.a < aMin || m.a > aMax) continue
    g.push(`<circle cx="${X(m.x).toFixed(1)}" cy="${Y(m.a).toFixed(1)}" r="4.2" fill="#fff" stroke="#111" stroke-width="1.6"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g.join("")}</svg>`
}

// ── точная алгебра по параметру a (нужна разделам, где выкалывания — корни резольвенты) ──
// Коэффициенты уравнения — многочлены ПО ПАРАМЕТРУ a (те же массивы R, что и по x).
// Всё считается точно, поэтому в ответ не может «просочиться» невыписанное выкалывание.

// Делители натурального числа (BigInt) — для теоремы о рациональных корнях.
function divisorsBig(n) {
  n = n < 0n ? -n : n
  const out = []
  for (let d = 1n; d * d <= n; d++) if (n % d === 0n) { out.push(d); if (d * d !== n) out.push(n / d) }
  return out
}
// ВСЕ рациональные корни многочлена (кратность не учитываем) + признак «иррациональных нет».
// Иррациональные ловятся сравнением с точным числом вещественных корней (Штурм).
function ratRoots(E) {
  E = pTrim(E)
  if (pDeg(E) <= 0) return { roots: [], allRational: pDeg(E) === 0 }
  // приводим к целым коэффициентам
  let L = 1n
  for (const c of E) L = (L * c.d) / bgcd(L, c.d)
  const ints = E.map((c) => (c.n * L) / c.d)
  let k = 0
  while (k < ints.length && ints[k] === 0n) k++             // x = 0 — корень кратности k
  const roots = k > 0 ? [R0] : []
  const tail = ints.slice(k)
  if (tail.length > 1) {
    const a0 = tail[0], an = tail[tail.length - 1]
    for (const pn of divisorsBig(a0)) for (const qd of divisorsBig(an)) for (const sg of [1n, -1n]) {
      const r = R(sg * pn, qd)
      if (roots.some((x) => Rcmp(x, r) === 0)) continue
      if (Rzero(pEval(E, r))) roots.push(r)
    }
  }
  const real = countRoots(E, "-inf", "+inf", false, false)
  return { roots: roots.sort(Rcmp), allRational: roots.length === real }
}
// Множество {a : P(a) > 0} для многочлена степени ≤ 2 с рациональными корнями.
function positiveSet(P) {
  P = pTrim(P)
  const deg = pDeg(P)
  if (deg <= 0) return Rsign(P[0] || R0) > 0 ? SET([IV("-inf", "+inf")]) : null
  const { roots, allRational } = ratRoots(P)
  if (!allRational) return null
  const lead = Rsign(pLead(P))
  if (deg === 1) return roots.length !== 1 ? null
    : SET([lead > 0 ? IV(roots[0], "+inf") : IV("-inf", roots[0])])
  if (deg !== 2) return null
  if (roots.length !== 2) return null                        // касание/нет корней — вырождено
  const [r1, r2] = roots
  return lead > 0 ? SET([IV("-inf", r1), IV(r2, "+inf")]) : SET([IV(r1, r2)])
}
// Выколоть точки из множества (промежутки режутся, точки-совпадения выбрасываются).
function minusPoints(set, pts) {
  const iv = []
  for (const i of set.intervals) {
    const inside = uniqSorted(pts.filter((p) => (i.lo === "-inf" || Rcmp(p, i.lo) > 0) && (i.hi === "+inf" || Rcmp(p, i.hi) < 0)))
    let prev = i.lo, inc = i.incLo
    for (const p of inside) { iv.push(IV(prev, p, inc, false)); prev = p; inc = false }
    iv.push(IV(prev, i.hi, inc, i.incHi))
  }
  const points = set.points.filter((q) => !pts.some((p) => Rcmp(p, q) === 0))
  return SET(iv, points)
}
// Значения a, при которых у монических (по x) квадратных N и D есть общий корень:
// из N − D = Δ₁x + Δ₀ = 0 получаем x = −Δ₀/Δ₁, подстановка в D даёт
// E(a) = Δ₀² − d₁·Δ₀·Δ₁ + d₀·Δ₁². Коэффициенты n₁,n₀,d₁,d₀ — многочлены по a.
function commonRootPoly(n1, n0, d1, d0) {
  const D1 = pSub(n1, d1), D0 = pSub(n0, d0)
  return pAdd(pSub(pMul(D0, D0), pMul(d1, pMul(D0, D1))), pMul(d0, pMul(D1, D1)))
}
// Ответ для «дробь = 0, ровно два различных решения» с монической квадратичной N по x:
// {a : disc(N) > 0} без значений, где корень числителя совпал с полюсом.
// Возвращает null, если хоть что-то получилось иррациональным (такой набор параметров
// генератор просто не берёт — границы обязаны быть круглыми).
function twoRootsSet(n1, n0, d1, d0) {
  const disc = pSub(pMul(n1, n1), pMul([R(4)], n0))          // n₁² − 4n₀
  const dom = positiveSet(disc)
  if (!dom) return null
  const E = commonRootPoly(n1, n0, d1, d0)
  const { roots, allRational } = ratRoots(E)
  if (!allRational) return null
  return { set: minusPoints(dom, roots), dom, excl: roots }
}
// «Круглый» ли ответ: все границы — целые или простые дроби, промежутков немного.
function niceSet(set, maxDen = 8n, maxNum = 60n, minIv = 3, maxIv = 6) {
  const b = setBounds(set)
  if (!b.length || set.intervals.length < minIv || set.intervals.length > maxIv) return false
  return b.every((x) => x.d <= maxDen && (x.n < 0n ? -x.n : x.n) <= maxNum)
}
const domStr = (dom) => dom.intervals.map((i) => `${i.incLo ? "[" : "("}${epStr(i.lo)}; ${epStr(i.hi)}${i.incHi ? "]" : ")"}`).join(" ∪ ")

// Сборка ответа ПО КРИТИЧЕСКИМ ЗНАЧЕНИЯМ. Предикат задачи меняется только в точках, где
// меняется конфигурация (корень входит/выходит из отрезка, корень совпадает с границей ОДЗ,
// дискриминант обращается в нуль и т. п.) — все они выписываются в самом скине как ТОЧНЫЕ
// рациональные числа. Между соседними критическими значениями предикат постоянен, поэтому
// достаточно вычислить его в одной внутренней точке каждого промежутка и в самих точках.
// Полнота списка критических значений не принимается на веру: verify18 всё равно проходит
// сетку ≥ 2000 значений a и ловит любое пропущенное изменение.
function assembleSet(test, criticals) {
  const cs = uniqSorted(criticals)
  const atoms = []
  for (let i = 0; i <= cs.length; i++) {
    const lo = i === 0 ? "-inf" : cs[i - 1], hi = i === cs.length ? "+inf" : cs[i]
    const mid = lo === "-inf" ? Rsub(hi, R1) : hi === "+inf" ? Radd(lo, R1) : Rdiv(Radd(lo, hi), R(2))
    atoms.push({ kind: "iv", lo, hi, ok: test(mid) })
    if (i < cs.length) atoms.push({ kind: "pt", v: cs[i], ok: test(cs[i]) })
  }
  const intervals = [], points = []
  let i = 0
  while (i < atoms.length) {
    if (!atoms[i].ok) { i++; continue }
    let j = i
    while (j + 1 < atoms.length && atoms[j + 1].ok) j++
    const run = atoms.slice(i, j + 1)
    if (run.length === 1 && run[0].kind === "pt") points.push(run[0].v)
    else {
      const first = run[0], last = run[run.length - 1]
      intervals.push(IV(
        first.kind === "pt" ? first.v : first.lo,
        last.kind === "pt" ? last.v : last.hi,
        first.kind === "pt", last.kind === "pt",
      ))
    }
    i = j + 1
  }
  return SET(intervals, points)
}
// Пересечение промежутка [lo; hi] (концы — R или ±inf, с флагами включения) с другим.
function ivCut(A, B) {
  const cmpLo = (x, y) => (x === "-inf" ? -1 : y === "-inf" ? 1 : Rcmp(x, y))
  const cmpHi = (x, y) => (x === "+inf" ? 1 : y === "+inf" ? -1 : Rcmp(x, y))
  const lo = cmpLo(A.lo, B.lo) >= 0 ? A : B, hi = cmpHi(A.hi, B.hi) <= 0 ? A : B
  const eqLo = cmpLo(A.lo, B.lo) === 0, eqHi = cmpHi(A.hi, B.hi) === 0
  return {
    lo: lo.lo, hi: hi.hi,
    incLo: eqLo ? A.incLo && B.incLo : lo.incLo,
    incHi: eqHi ? A.incHi && B.incHi : hi.incHi,
  }
}
// Пуст ли промежуток (с учётом включения концов).
function ivEmpty(I) {
  if (I.lo === "-inf" || I.hi === "+inf") return false
  const c = Rcmp(I.lo, I.hi)
  return c > 0 || (c === 0 && !(I.incLo && I.incHi))
}

// Диапазон сетки по a: покрывает все границы ответа с запасом и не уже 24 единиц
// (при шаге 1/100 это ≥ 2400 узлов — требование verify18).
function spanRange(set, pad = 6) {
  const b = setBounds(set).map(Rnum)
  // защита от вырожденного набора параметров: пустой ответ ловим сразу, а не зависаем на сетке
  if (!b.length) throw new Error("spanRange: у множества нет границ (пустой или полный ответ)")
  let lo = Math.floor(Math.min(...b)) - pad, hi = Math.ceil(Math.max(...b)) + pad
  while (hi - lo < 24) { lo -= 1; hi += 1 }
  return [lo, hi]
}

// ── сборка объекта задания ───────────────────────────────────────────────────
function item({ text, set, solution, pieces, solve, raw, predicate, aRange, picture, unit }) {
  return {
    condition_text: text,
    answer: setToString(set, unit),
    answer_set: setPlain(set, unit),
    solution,
    solution_image: svgUrl(planeSvg(picture)),
    _verify: { set, pieces, solve, raw, predicate, aRange, unit },
  }
}

// ── verify18 ─────────────────────────────────────────────────────────────────
// pieces(a) → [{ N, D, lo, hi, incLo, incHi }]: на каждом промежутке решения — это корни N,
// не являющиеся корнями D (ОДЗ). Число решений считается ТОЧНО (Штурм над Q).
function solveCount(pieces, a) {
  let n = 0
  for (const pc of pieces(a)) {
    const N = pTrim(pc.N)
    if (!N.length) throw new Error("verify18: числитель тождественно ноль")
    let k = countRoots(N, pc.lo, pc.hi, pc.incLo, pc.incHi)
    if (pc.D) {
      const D = pTrim(pc.D)
      if (!D.length) throw new Error("verify18: знаменатель тождественно ноль")
      const g = pGcd(N, D)
      if (pDeg(g) > 0) k -= countRoots(g, pc.lo, pc.hi, pc.incLo, pc.incHi)  // ОДЗ: полюсы не решения
    }
    n += k
  }
  return n
}
function holds(pred, cnt) {
  switch (pred.type) {
    case "count": return cnt === pred.n
    case "atLeast": return cnt >= pred.n
    case "exists": return cnt >= 1
    case "none": return cnt === 0
    case "countIn": return pred.values.includes(cnt)
    default: throw new Error("verify18: неизвестный предикат " + pred.type)
  }
}
export function verify18(o, opts = {}) {
  try {
    if (!o || !o.condition_text || !o.answer) return { ok: false, err: "нет условия/ответа" }
    const { set, pieces, solve, predicate, aRange } = o._verify || {}
    if (!set || (!pieces && !solve) || !predicate || !aRange) return { ok: false, err: "нет _verify" }
    const count = (a) => (pieces ? solveCount(pieces, a) : solve(a))

    // 1. ответ не пуст, не вся прямая, есть хотя бы одна граница
    const bounds = setBounds(set)
    if (!set.intervals.length && !set.points.length) return { ok: false, err: "ответ пуст" }
    if (!bounds.length) return { ok: false, err: "ответ = вся прямая (вырождено)" }

    // 2. человеческие числа: знаменатели границ ≤ 24, числители ≤ 4 знаков
    for (const b of bounds) {
      if (b.d > 24n) return { ok: false, err: `некруглая граница ${valStr(b, o._verify.unit)}` }
      if ((b.n < 0n ? -b.n : b.n) > 9999n) return { ok: false, err: `слишком большая граница ${Rstr(b)}` }
    }

    // 3. сетка по a: предикат ⟺ принадлежность множеству (точная арифметика, без ε)
    const [aLo, aHi] = aRange
    const Q = opts.grid || 100                      // шаг 1/Q
    const from = Math.ceil(aLo * Q), to = Math.floor(aHi * Q)
    if (to - from + 1 < 2000) return { ok: false, err: "сетка меньше 2000 точек" }
    for (let k = from; k <= to; k++) {
      const a = R(k, Q)
      const want = inSet(set, a)
      const got = holds(predicate, count(a))
      if (want !== got) return { ok: false, err: `a=${Rstr(a)}: в ответе ${want}, по решателю ${got}` }
    }

    // 4. каждая граница отдельно: сама точка и её окрестность a±ε (ε = 1/1000 и 1/10⁶)
    for (const b of bounds) {
      for (const eps of [R(1, 1000), R(1, 1000000)]) {
        for (const s of [-1, 1]) {
          const a = Radd(b, Rmul(R(s), eps))
          const want = inSet(set, a)
          const got = holds(predicate, count(a))
          if (want !== got) return { ok: false, err: `окрестность границы ${Rstr(b)}: a=${Rstr(a)} ответ ${want}, решатель ${got}` }
        }
      }
      const wantB = inSet(set, b)
      const gotB = holds(predicate, count(b))
      if (wantB !== gotB) return { ok: false, err: `в самой границе ${Rstr(b)}: ответ ${wantB}, решатель ${gotB}` }
      // граница обязана что-то менять: слева и справа от неё принадлежность различается
      const l = inSet(set, Rsub(b, R(1, 1000000))), r = inSet(set, Radd(b, R(1, 1000000)))
      if (l === r && l === wantB) return { ok: false, err: `граница ${Rstr(b)} ничего не разделяет` }
    }

    // 5. изолированные точки: в точке предикат выполняется, в проколотой окрестности — нет
    for (const p of set.points) {
      if (!holds(predicate, count(p))) return { ok: false, err: `изолированная точка ${Rstr(p)} не выполняет предикат` }
      for (const eps of [R(1, 1000), R(1, 1000000)]) for (const s of [-1, 1]) {
        const a = Radd(p, Rmul(R(s), eps))
        if (holds(predicate, count(a))) return { ok: false, err: `около точки ${Rstr(p)} предикат тоже выполняется` }
      }
    }

    // 6. НЕЗАВИСИМАЯ ЧИСЛОВАЯ СВЕРКА С ИСХОДНЫМ ВЫРАЖЕНИЕМ (для разделов, где точный решатель
    // опирается на алгебраическое преобразование условия — разложение, возведение в квадрат).
    // Проверяем две вещи: каждый заявленный корень действительно обнуляет НАПЕЧАТАННОЕ
    // выражение, и ни одна смена знака на отрезке не осталась без корня.
    const raw = o._verify.raw
    if (raw) {
      const [sL, sR] = raw.seg
      for (let k = 0; k < 24; k++) {
        const a = R(Math.round((aLo + ((aHi - aLo) * k) / 23) * 12), 12)
        const F = raw.F(Rnum(a)), sols = raw.sols(Rnum(a))
        if (sols.length !== count(a)) return { ok: false, err: `a=${Rstr(a)}: точный решатель даёт ${count(a)} корней, числовой список — ${sols.length}` }
        for (const x of sols) {
          const v = F(x)
          if (v === null || !Number.isFinite(v) || Math.abs(v) > 1e-7) {
            return { ok: false, err: `a=${Rstr(a)}: x=${x} объявлен корнем, но исходное выражение даёт ${v}` }
          }
        }
        const N = 2000
        let prev = null, prevX = null
        for (let i = 0; i <= N; i++) {
          const x = sL + ((sR - sL) * i) / N
          const v = F(x)
          if (v === null || !Number.isFinite(v)) { prev = null; continue }
          if (prev !== null && Math.sign(v) !== Math.sign(prev) && v !== 0 && prev !== 0) {
            // через полюс (например, тангенс) знак меняется без корня — такие «скачки» пропускаем
            const poles = raw.poles ? raw.poles(Rnum(a)) : []
            const overPole = poles.some((pp) => pp > Math.min(prevX, x) - 1e-9 && pp < Math.max(prevX, x) + 1e-9)
            if (!overPole && !sols.some((r) => r >= Math.min(prevX, x) - 1e-9 && r <= Math.max(prevX, x) + 1e-9)) {
              return { ok: false, err: `a=${Rstr(a)}: смена знака на (${prevX.toFixed(4)}; ${x.toFixed(4)}) не покрыта ни одним корнем` }
            }
          }
          prev = v; prevX = x
        }
      }
    }

    // 7. строка ответа собрана из того же множества
    if (setToString(set, o._verify.unit) !== o.answer) return { ok: false, err: "строка ответа не совпала со структурой" }
    return { ok: true }
  } catch (e) {
    return { ok: false, err: "ИСКЛЮЧЕНИЕ " + e.message }
  }
}

// ── общий текст-шапка ────────────────────────────────────────────────────────
const HEAD_PARAM = "Найдите все значения параметра a, при каждом из которых уравнение"
const HEAD_A = "Найдите все значения a, при каждом из которых уравнение"
// Для систем нужна СВОЯ шапка: HEAD_A кончается словом «уравнение», и приписанное
// следом «система уравнений» давало в условии «…уравнение система уравнений».
const HEAD_SYS = "Найдите все значения a, при каждом из которых система"
const TWO_ROOTS = "имеет ровно два различных корня."
const TWO_SOL = "имеет ровно два различных решения."

// =============================================================================
// РАЗДЕЛ A. Дробь = 0, «ровно два различных решения» (эталон #1–#11)
// =============================================================================

// #1. (k²x² − a²)/(px − q − ra) = 0.
// Числитель даёт x = ±a/k (различны при a ≠ 0), знаменатель — полюс x = (q+ra)/p.
// ОТ ОТВЕТА: ответ = ℝ без трёх точек — 0 и двух значений a, при которых полюс совпадает
// с корнем: a(p−kr) = kq и −a(p+kr) = kq. Коэффициенты берём так, чтобы обе точки были целыми.
const T1 = []
for (const k of [2, 3, 4, 5]) for (const p of [1, 2, 3, 4, 5]) for (const r of [1, 2, 3, 4]) for (const q of [3, 4, 6, 8, 9, 12, 15, 18, 20, 24]) {
  if (p === k * r) continue
  const A1 = R(k * q, p - k * r), A2 = R(-k * q, p + k * r)
  if (A1.d !== 1n || A2.d !== 1n) continue
  if (Rcmp(A1, A2) === 0 || Rzero(A1) || Rzero(A2)) continue
  if ((A1.n < 0n ? -A1.n : A1.n) > 15n || (A2.n < 0n ? -A2.n : A2.n) > 15n) continue
  T1.push({ k, p, q, r, A1, A2 })
}
export function t18RatQuadLin() {
  const { k, p, q, r } = pick(T1)
  const A1 = R(k * q, p - k * r), A2 = R(-k * q, p + k * r)
  const set = realsExcept([R0, A1, A2])
  const num = `${k * k}x${SUP[2]} ${MINUS} a${SUP[2]}`
  const den = `${p === 1 ? "" : p}x ${MINUS} ${q} ${MINUS} ${r === 1 ? "" : r}a`
  return item({
    text: `${HEAD_PARAM}\n\n${fT(num, den)} = 0\n\n${TWO_SOL}`,
    set,
    solution: `Дробь равна нулю, когда числитель равен нулю, а знаменатель — нет.\n`
      + `${k * k}x${SUP[2]} = a${SUP[2]} ⟺ x = a/${k} или x = ${MINUS}a/${k}; эти корни различны ровно при a ≠ 0.\n`
      + `Знаменатель обращается в нуль при x = (${q} + ${r}a)/${p}. Корень теряется, когда он совпадает с полюсом:\n`
      + `a/${k} = (${q} + ${r}a)/${p} ⟺ a(${p} ${MINUS} ${k * r}) = ${k * q} ⟺ a = ${Rstr(A1)};\n`
      + `${MINUS}a/${k} = (${q} + ${r}a)/${p} ⟺ ${MINUS}a(${p} + ${k * r}) = ${k * q} ⟺ a = ${Rstr(A2)}.\n`
      + `При этих a остаётся один корень, при a = 0 — тоже один (двойной x = 0).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    // Решатель: один промежуток (вся прямая); корней вне |x| ≤ (|a|+|q|)·C нет, но Штурм
    // работает сразу на (−∞; +∞), поэтому границы по x не нужны вовсе.
    pieces: (a) => [{
      N: [Rneg(Rmul(a, a)), R0, R(k * k)],
      D: [Rsub(R(-q), Rmul(R(r), a)), R(p)],
      lo: "-inf", hi: "+inf", incLo: false, incHi: false,
    }],
    aRange: [-14, 14],
    picture: {
      curves: [
        { f: (a) => a / k, label: `x = a/${k}` },
        { f: (a) => -a / k, label: `x = ${MINUS}a/${k}` },
        { f: (a) => (q + r * a) / p, dash: true, label: "полюс" },
      ],
      marks: [{ x: Rnum(A1) / k, a: Rnum(A1) }, { x: -Rnum(A2) / k, a: Rnum(A2) }, { x: 0, a: 0 }],
      hlines: [Rnum(A1), Rnum(A2), 0],
      xMin: -8, xMax: 8, aMin: -14, aMax: 14,
    },
  })
}

// #2. (k²x² − a²)/(x² + 2mx + m² − a²) = 0.
// Знаменатель = (x+m)² − a², полюсы x = −m ± a. Ответ = ℝ без 0 и четырёх точек
// ±mk/(k−1), ±mk/(k+1) — берём (k, m) так, чтобы все четыре были целыми.
const T2 = []
for (const k of [2, 3, 4, 5]) for (const m of [2, 3, 4, 5, 6, 8, 9, 10, 12, 15]) {
  const B1 = R(m * k, k - 1), B2 = R(m * k, k + 1)
  if (B1.d !== 1n || B2.d !== 1n) continue
  if (Rcmp(B1, B2) === 0) continue
  if (B1.n > 20n) continue
  T2.push({ k, m })
}
export function t18RatQuadSqDiff() {
  const { k, m } = pick(T2)
  const B1 = R(m * k, k - 1), B2 = R(m * k, k + 1)
  const set = realsExcept([R0, B1, Rneg(B1), B2, Rneg(B2)])
  const num = `${k * k}x${SUP[2]} ${MINUS} a${SUP[2]}`
  const den = `x${SUP[2]} + ${2 * m}x + ${m * m} ${MINUS} a${SUP[2]}`
  return item({
    text: `${HEAD_A}\n\n${fT(num, den)} = 0\n\n${TWO_ROOTS}`,
    set,
    solution: `Числитель обнуляется при x = ±a/${k} — два различных корня ровно при a ≠ 0.\n`
      + `Знаменатель равен (x + ${m})${SUP[2]} ${MINUS} a${SUP[2]}, то есть обращается в нуль при x = ${MINUS}${m} + a и x = ${MINUS}${m} ${MINUS} a.\n`
      + `Совпадение корня с полюсом даёт четыре значения: a = ±${Rstr(B1)} и a = ±${Rstr(B2)}; при каждом из них остаётся один корень.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    pieces: (a) => [{
      N: [Rneg(Rmul(a, a)), R0, R(k * k)],
      D: [Rsub(R(m * m), Rmul(a, a)), R(2 * m), R1],
      lo: "-inf", hi: "+inf", incLo: false, incHi: false,
    }],
    aRange: [-16, 16],
    picture: {
      curves: [
        { f: (a) => a / k, label: `x = a/${k}` },
        { f: (a) => -a / k, label: `x = ${MINUS}a/${k}` },
        { f: (a) => -m + a, dash: true, label: "полюсы" },
        { f: (a) => -m - a, dash: true },
      ],
      marks: [{ x: Rnum(B1) / k, a: Rnum(B1) }, { x: -Rnum(B1) / k, a: -Rnum(B1) },
        { x: Rnum(B2) / k, a: Rnum(B2) }, { x: -Rnum(B2) / k, a: -Rnum(B2) }, { x: 0, a: 0 }],
      hlines: [Rnum(B1), -Rnum(B1), Rnum(B2), -Rnum(B2), 0],
      xMin: -14, xMax: 14, aMin: -16, aMax: 16,
    },
  })
}

// #3. (x² − 2mx + a)/(kx² − (k+1)ax + a²) = 0.
// Знаменатель = (kx − a)(x − a). Числитель имеет два различных корня ровно при a < m².
// Полюсы съедают корень при a ∈ {0, 2m−1, 2mk−k²} (подстановка x = a и x = a/k).
const T3 = []
for (const m of [2, 3, 4, 5, 6]) for (const k of [2, 3, 4, 5, 6, 7]) {
  const e1 = 2 * m - 1, e2 = 2 * m * k - k * k
  if (e1 >= m * m || e2 >= m * m) continue
  if (e1 === e2 || e1 === 0 || e2 === 0) continue
  if (Math.abs(e2) > 24) continue
  T3.push({ m, k })
}
export function t18RatNumConst() {
  const { m, k } = pick(T3)
  const e1 = R(2 * m - 1), e2 = R(2 * m * k - k * k)
  const set = gapExcept("-inf", R(m * m), [R0, e1, e2])
  const num = `x${SUP[2]} ${MINUS} ${2 * m}x + a`
  const den = `${k}x${SUP[2]} ${MINUS} ${k + 1}ax + a${SUP[2]}`
  return item({
    text: `${HEAD_PARAM}\n\n${fT(num, den)} = 0\n\n${TWO_SOL}`,
    set,
    solution: `Знаменатель раскладывается: ${k}x${SUP[2]} ${MINUS} ${k + 1}ax + a${SUP[2]} = (${k}x ${MINUS} a)(x ${MINUS} a), полюсы x = a/${k} и x = a.\n`
      + `Числитель x${SUP[2]} ${MINUS} ${2 * m}x + a имеет два различных корня ⟺ D/4 = ${m * m} ${MINUS} a > 0 ⟺ a < ${m * m}.\n`
      + `Корень пропадает, если он полюс: подстановка x = a даёт a(a ${MINUS} ${2 * m - 1}) = 0, подстановка x = a/${k} даёт a(a ${MINUS} ${2 * m * k - k * k}) = 0.\n`
      + `Значит из промежутка a < ${m * m} выкалываем a = 0, a = ${Rstr(e1)}, a = ${Rstr(e2)}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    pieces: (a) => [{
      N: [a, R(-2 * m), R1],
      D: [Rmul(a, a), Rmul(R(-(k + 1)), a), R(k)],
      lo: "-inf", hi: "+inf", incLo: false, incHi: false,
    }],
    aRange: [-14, 14],
    picture: {
      curves: [
        { f: (a) => (a < m * m ? m + Math.sqrt(m * m - a) : null), label: "корни числителя" },
        { f: (a) => (a < m * m ? m - Math.sqrt(m * m - a) : null) },
        { f: (a) => a, dash: true, label: "полюсы" },
        { f: (a) => a / k, dash: true },
      ],
      marks: [{ x: Rnum(e1), a: Rnum(e1) }, { x: Rnum(e2) / k, a: Rnum(e2) }, { x: 0, a: 0 }],
      hlines: [m * m, 0, Rnum(e1), Rnum(e2)],
      xMin: -14, xMax: 14, aMin: -14, aMax: 14,
    },
  })
}

// #4. (ca − x² + bx)/(x − a²) = 0, где b = −(uv+uw+vw), c = uvw для целых u+v+w = 0.
// Числитель: x² − bx − ca = 0, два различных корня ⟺ b² + 4ca > 0.
// Полюс x = a² съедает корень при a⁴ − ba² − ca = 0 ⟺ a(a−u)(a−v)(a−w) = 0.
const T4 = []
for (let u = -6; u <= -1; u++) for (let v = u; v <= -1; v++) for (const k of [1, 2, 3]) {
  const w = -(u + v)                                  // u + v + w = 0 — тогда в кубике нет a²
  const b = k * (w * w - u * v), c = k * k * u * v * w
  if (b <= 0 || c <= 0 || b > 40 || c > 60) continue
  const lo = R(-b * b, 4 * c)                         // граница области: a > −b²/(4c)
  if (lo.d > 24n) continue
  const roots = [...new Set([u, v, w])]
  if (!roots.every((t) => Rcmp(R(t), lo) > 0)) continue      // все выкалывания внутри области
  T4.push({ b, c, k, u, v, w })
}
export function t18RatCubicExcl() {
  const { b, c, k, u, v, w } = pick(T4)
  const lo = R(-b * b, 4 * c)
  const pts = [R0, R(u), R(v), R(w)]
  const set = gapExcept(lo, "+inf", pts)
  const num = `${c === 1 ? "" : c}a ${MINUS} x${SUP[2]} + ${b === 1 ? "" : b}x`
  const den = `x ${MINUS} ${k === 1 ? "" : k}a${SUP[2]}`
  const uniqRoots = [u, v, w].filter((t, i, arr) => arr.indexOf(t) === i).sort((p, q) => p - q)
  return item({
    text: `${HEAD_A}\n\n${fT(num, den)} = 0\n\n${TWO_ROOTS}`,
    set,
    solution: `Числитель равен нулю ⟺ x${SUP[2]} ${MINUS} ${b}x ${MINUS} ${c}a = 0; два различных корня ⟺ D = ${b * b} + ${4 * c}a > 0 ⟺ a > ${Rstr(lo)}.\n`
      + `Полюс x = ${k === 1 ? "" : k}a${SUP[2]}. Он совпадает с корнем ⟺ ${k === 1 ? "" : k * k}a⁴ ${MINUS} ${b * k}a${SUP[2]} ${MINUS} ${c}a = 0 ⟺ a(a ${MINUS} (${nS(u)}))(a ${MINUS} (${nS(v)}))(a ${MINUS} (${nS(w)})) = 0, `
      + `то есть при a = 0 и a ∈ {${uniqRoots.map(nS).join("; ")}} (записи со знаком ${MINUS} читаются как отрицательные числа).\n`
      + `Из промежутка a > ${Rstr(lo)} выкалываем эти значения.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    pieces: (a) => [{
      N: [Rmul(R(c), a), R(b), R(-1)],
      D: [Rneg(Rmul(R(k), Rmul(a, a))), R1],
      lo: "-inf", hi: "+inf", incLo: false, incHi: false,
    }],
    aRange: [-10, 10],
    picture: {
      curves: [
        { f: (a) => (b * b + 4 * c * a > 0 ? (b + Math.sqrt(b * b + 4 * c * a)) / 2 : null), label: "корни числителя" },
        { f: (a) => (b * b + 4 * c * a > 0 ? (b - Math.sqrt(b * b + 4 * c * a)) / 2 : null) },
        { f: (a) => k * a * a, dash: true, label: `полюс x = ${k === 1 ? "" : k}a²` },
      ],
      marks: [{ x: 0, a: 0 }, { x: k * u * u, a: u }, { x: k * v * v, a: v }, { x: k * w * w, a: w }],
      hlines: [Rnum(lo), 0, u, v, w],
      xMin: -6, xMax: 18, aMin: -6, aMax: 6,
    },
  })
}

// #8. (x² − 2mx + a² − 2ta)/(x² − a) = 0.
// Числитель: два различных корня ⟺ a² − 2ta − m² < 0 ⟺ a ∈ (t−√(t²+m²); t+√(t²+m²));
// пару (t, m) берём пифагоровой, чтобы границы были целыми.
// Полюсы x = ±√a (только при a > 0). Совпадение корня с полюсом: s = √a — корень кубики
// s³ + (1−2t)s ∓ 2m = 0; берём только те (t, m), где эти кубики имеют целые корни.
// Таблица строится ОТ ОТВЕТА: задаём целые s₁, s₂ (это √a в точках выкалывания) и старший
// коэффициент α. Подстановка x = ±√a даёт s(s³ + (α−2t)s ∓ 2m) = 0, откуда линейно
// t = (α + s₁² − s₁s₂ + s₂²)/2 и m = s₁s₂(s₁ − s₂)/2. Оставляем тройки, где t, m целые,
// t² + m²/α — точный квадрат (границы области рациональные и круглые) и у обеих кубик НЕТ
// иррациональных положительных корней (иначе появилось бы невыписанное выкалывание) —
// последнее проверяется Штурмом, а не «на глаз».
const isSq = (n) => { const r = Math.round(Math.sqrt(n)); return r * r === n ? r : null }
const T8 = []
for (let s1 = 1; s1 <= 9; s1++) for (let s2 = 1; s2 <= 9; s2++) for (const al of [1, 2, 3, 4, 5, 6, 8, 9]) {
  if (s1 === s2) continue
  const U = -(s1 * s1 - s1 * s2 + s2 * s2)
  if ((al - U) % 2 !== 0 || (s1 * s2 * (s1 - s2)) % 2 !== 0) continue
  const t = (al - U) / 2, m = (s1 * s2 * (s1 - s2)) / 2
  if (t <= 0 || m <= 0 || t > 30 || m > 30 || 2 * m > 60) continue
  const V = Radd(R(t * t), R(m * m, al))              // t² + m²/α
  const sn = isSq(Number(V.n)), sd = isSq(Number(V.d))
  if (sn === null || sd === null) continue
  const h = R(sn, sd)                                  // √(t² + m²/α) — рациональное
  const lo = Rsub(R(t), h), hi = Radd(R(t), h)
  if (lo.d > 24n || hi.d > 24n) continue
  let ok = true
  const roots = []
  for (const sgn of [-1, 1]) {
    const cub = [R(sgn * 2 * m), R(al - 2 * t), R0, R1]      // s³ + (α−2t)s ± 2m
    const tot = countRoots(cub, R0, "+inf", false, false)    // все положительные корни
    const ints = []
    for (let s = 1; s <= 80; s++) if (Rzero(pEval(cub, R(s)))) ints.push(s)
    if (ints.length !== tot) { ok = false; break }
    roots.push(...ints)
  }
  if (!ok) continue
  const excl = [...new Set(roots.map((s) => s * s))].filter((a) => a > 0 && Rcmp(R(a), hi) < 0).sort((p, q) => p - q)
  if (!excl.length || excl.some((e) => e > 200)) continue
  T8.push({ t, m, al, excl, lo, hi })
}
export function t18RatDenSqrtA() {
  const { t, m, al, excl, lo, hi } = pick(T8)
  const pts = [R0, ...excl.map((e) => R(e))]
  const set = gapExcept(lo, hi, pts)
  const num = `${al === 1 ? "" : al}x${SUP[2]} ${MINUS} ${2 * m}x + a${SUP[2]} ${MINUS} ${2 * t}a`
  const den = `x${SUP[2]} ${MINUS} a`
  return item({
    text: `При каких значениях параметра a уравнение\n\n${fT(num, den)} = 0\n\nимеет ровно 2 различных решения?`,
    set,
    solution: `Два различных корня у числителя ⟺ D/4 = ${m * m} ${MINUS} ${al === 1 ? "" : al + "·"}(a${SUP[2]} ${MINUS} ${2 * t}a) > 0 ⟺ a${SUP[2]} ${MINUS} ${2 * t}a ${MINUS} ${Rstr(R(m * m, al))} < 0 ⟺ ${Rstr(lo)} < a < ${Rstr(hi)}.\n`
      + `Знаменатель обнуляется при x${SUP[2]} = a: при a > 0 это полюсы x = ±√a, при a ≤ 0 полюсов нет.\n`
      + `Подстановка x = ±√a (обозначим s = √a) даёт s(s${SUP[3]} ${MINUS} ${2 * t - al}s ∓ ${2 * m}) = 0, откуда выкалываются a = ${excl.join(", a = ")}. `
      + `Кроме того a = 0: там числитель равен x(${al === 1 ? "" : al}x ${MINUS} ${2 * m}), а x = 0 — полюс, остаётся один корень.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    pieces: (a) => [{
      N: [Rsub(Rmul(a, a), Rmul(R(2 * t), a)), R(-2 * m), R(al)],
      D: [Rneg(a), R0, R1],
      lo: "-inf", hi: "+inf", incLo: false, incHi: false,
    }],
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => { const d = m * m - al * (a * a - 2 * t * a); return d > 0 ? (m + Math.sqrt(d)) / al : null }, label: "корни числителя" },
        { f: (a) => { const d = m * m - al * (a * a - 2 * t * a); return d > 0 ? (m - Math.sqrt(d)) / al : null } },
        { f: (a) => (a > 0 ? Math.sqrt(a) : null), dash: true, label: "полюсы x = ±√a" },
        { f: (a) => (a > 0 ? -Math.sqrt(a) : null), dash: true },
      ],
      marks: [{ x: 0, a: 0 }, ...excl.map((e) => ({ x: Math.sqrt(e), a: e })), ...excl.map((e) => ({ x: -Math.sqrt(e), a: e }))],
      hlines: [Rnum(lo), Rnum(hi), 0, ...excl],
      xMin: -8, xMax: 14, aMin: Rnum(lo) - 2, aMax: Rnum(hi) + 2,
    },
  })
}

// #5. (x² − 2mx + a² + 2ta)/(kx² − (k−1)ax − a²) = 0. Знаменатель = (kx + a)(x − a).
// Таблица строится проверкой ТОЧНОГО ответа: берём набор (m, t, k), считаем множество
// twoRootsSet (условие «два различных корня» + выкалывания через резольвенту) и оставляем
// набор, только если все границы круглые — иррациональные наборы просто не попадают в банк.
// Наборы (m, t, k) найдены разовым перебором ЭТИМ ЖЕ движком (условие: twoRootsSet
// возвращает множество с круглыми границами) и зафиксированы литералом, чтобы импорт модуля
// был мгновенным; корректность каждого набора всё равно перепроверяет verify18 в смоуке.
const T5 = [[3, 4, 2], [3, 4, 3], [4, 3, 2], [4, 3, 3], [5, 12, 5], [6, 8, 3],
  [8, 6, 2], [8, 15, 4], [9, 12, 3], [12, 9, 2], [12, 16, 3], [16, 12, 2]].map(([m, t, k]) => ({ m, t, k }))
export function t18RatFactorDen() {
  const { m, t, k } = pick(T5)
  const n1 = [R(-2 * m)], n0 = [R0, R(2 * t), R1]
  const d1 = [R0, R(-(k - 1), k)], d0 = [R0, R0, R(-1, k)]
  const { set, dom, excl } = twoRootsSet(n1, n0, d1, d0)
  const num = `x${SUP[2]} ${MINUS} ${2 * m}x + a${SUP[2]} + ${2 * t}a`
  const den = `${k}x${SUP[2]} ${MINUS} ${k - 1 === 1 ? "" : k - 1}ax ${MINUS} a${SUP[2]}`
  return item({
    text: `${HEAD_PARAM}\n\n${fT(num, den)} = 0\n\n${TWO_SOL}`,
    set,
    solution: `Знаменатель раскладывается: ${k}x${SUP[2]} ${MINUS} ${k - 1}ax ${MINUS} a${SUP[2]} = (${k}x + a)(x ${MINUS} a), полюсы x = ${MINUS}a/${k} и x = a.\n`
      + `У числителя два различных корня ⟺ D/4 = ${m * m} ${MINUS} (a${SUP[2]} + ${2 * t}a) > 0 ⟺ a ∈ ${domStr(dom)}.\n`
      + `Корень пропадает, когда совпадает с полюсом: подстановка x = a даёт a(a + ${t - m > 0 ? t - m : ""}${t - m <= 0 ? MINUS + String(m - t) : ""}) = 0, `
      + `подстановка x = ${MINUS}a/${k} — ещё одно значение; всего выкалываются a = ${excl.map(Rstr).join(", a = ")}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    pieces: (a) => [{
      N: [Radd(Rmul(a, a), Rmul(R(2 * t), a)), R(-2 * m), R1],
      D: [Rneg(Rmul(a, a)), Rmul(R(-(k - 1)), a), R(k)],
      lo: "-inf", hi: "+inf", incLo: false, incHi: false,
    }],
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => { const d = m * m - (a * a + 2 * t * a); return d > 0 ? m + Math.sqrt(d) : null }, label: "корни числителя" },
        { f: (a) => { const d = m * m - (a * a + 2 * t * a); return d > 0 ? m - Math.sqrt(d) : null } },
        { f: (a) => a, dash: true, label: "полюсы" },
        { f: (a) => -a / k, dash: true },
      ],
      marks: excl.map((e) => ({ x: Rnum(e), a: Rnum(e) })).concat(excl.map((e) => ({ x: -Rnum(e) / k, a: Rnum(e) }))),
      hlines: setBounds(set).map(Rnum),
      xMin: -14, xMax: 14, aMin: Rnum(setBounds(set)[0]) - 3, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #6. (x² − 2mx + a² − 2ta)/(x² + px − qa) = 0 — знаменатель НЕ раскладывается по a,
// поэтому выкалывания ищутся резольвентой (общий корень двух квадратных трёхчленов).
// Наборы (m, t, p, q) — тем же разовым перебором (см. комментарий к T5).
const T6 = [[3, 4, 1, 8], [3, 4, 2, 6], [4, 3, 1, 8], [4, 3, 6, 1], [5, 12, 2, 5], [5, 12, 5, 2],
  [8, 6, 5, 1], [8, 15, 4, 3], [12, 9, 4, 1], [16, 12, 3, 1]].map(([m, t, p, q]) => ({ m, t, p, q }))
export function t18RatQuadDenParam() {
  const { m, t, p, q } = pick(T6)
  const n1 = [R(-2 * m)], n0 = [R0, R(-2 * t), R1]
  const d1 = [R(p)], d0 = [R0, R(-q)]
  const { set, dom, excl } = twoRootsSet(n1, n0, d1, d0)
  const num = `x${SUP[2]} ${MINUS} ${2 * m}x + a${SUP[2]} ${MINUS} ${2 * t}a`
  const den = `x${SUP[2]} + ${p === 1 ? "" : p}x ${MINUS} ${q === 1 ? "" : q}a`
  return item({
    text: `${HEAD_PARAM}\n\n${fT(num, den)} = 0\n\n${TWO_SOL}`,
    set,
    solution: `У числителя два различных корня ⟺ D/4 = ${m * m} ${MINUS} (a${SUP[2]} ${MINUS} ${2 * t}a) > 0 ⟺ a ∈ ${domStr(dom)}.\n`
      + `Если корень числителя совпал с полюсом, он не годится. Вычитая знаменатель из числителя, получаем `
      + `${MINUS}${2 * m + p}x + a${SUP[2]} ${MINUS} ${2 * t - q}a = 0, то есть общий корень равен x = (a${SUP[2]} ${MINUS} ${2 * t - q}a)/${2 * m + p}; `
      + `подстановка его в знаменатель даёт уравнение на a с корнями a = ${excl.map(Rstr).join(", a = ")} — эти значения выкалываем.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    pieces: (a) => [{
      N: [Rsub(Rmul(a, a), Rmul(R(2 * t), a)), R(-2 * m), R1],
      D: [Rmul(R(-q), a), R(p), R1],
      lo: "-inf", hi: "+inf", incLo: false, incHi: false,
    }],
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => { const d = m * m - (a * a - 2 * t * a); return d > 0 ? m + Math.sqrt(d) : null }, label: "корни числителя" },
        { f: (a) => { const d = m * m - (a * a - 2 * t * a); return d > 0 ? m - Math.sqrt(d) : null } },
        { f: (a) => { const d = p * p + 4 * q * a; return d > 0 ? (-p + Math.sqrt(d)) / 2 : null }, dash: true, label: "полюсы" },
        { f: (a) => { const d = p * p + 4 * q * a; return d > 0 ? (-p - Math.sqrt(d)) / 2 : null }, dash: true },
      ],
      marks: excl.map((e) => { const a = Rnum(e); return { x: (a * a - (2 * t - q) * a) / (2 * m + p), a } }),
      hlines: setBounds(set).map(Rnum),
      xMin: -12, xMax: 12, aMin: Rnum(setBounds(set)[0]) - 3, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #7. (x² + 2ux − ca)/(x² − 2vx + a² − 2wa) = 0 — параметр и в числителе, и в знаменателе.
// Область — луч (дискриминант числителя линеен по a), выкалывания — снова резольвента.
// Наборы (u, c, v, w) — тем же разовым перебором (см. комментарий к T5).
const T7 = [
  [1, 1, 1, 4], [1, 1, 2, 1], [1, 1, 4, 7], [1, 1, 5, 3], [1, 2, 1, 2], [1, 2, 2, 6], [1, 2, 3, 1], [1, 2, 5, 5],
  [1, 3, 2, 4], [1, 3, 3, 8], [1, 3, 4, 1], [1, 3, 4, 3], [1, 3, 6, 2], [1, 4, 1, 1], [1, 4, 1, 7], [1, 4, 2, 3],
  [1, 4, 3, 6], [1, 4, 5, 1], [1, 4, 5, 5], [1, 6, 1, 3], [1, 6, 2, 2], [1, 6, 3, 1], [1, 6, 3, 4], [1, 8, 1, 5],
  [1, 8, 2, 4], [1, 8, 3, 3], [1, 8, 4, 2], [1, 8, 4, 5], [1, 8, 5, 1], [2, 1, 1, 6], [2, 1, 3, 2], [2, 2, 1, 3],
  [2, 2, 2, 8], [2, 2, 4, 2], [2, 2, 6, 7], [2, 3, 1, 2], [2, 3, 1, 8], [2, 3, 3, 1], [2, 3, 4, 7], [2, 3, 5, 2],
  [2, 4, 2, 4], [2, 4, 4, 3], [2, 4, 6, 2], [2, 6, 1, 1], [2, 6, 3, 5], [2, 6, 4, 8], [2, 6, 6, 7], [2, 8, 1, 3],
  [2, 8, 1, 8], [2, 8, 2, 2], [2, 8, 3, 1], [2, 8, 4, 6], [3, 1, 1, 8], [3, 1, 4, 3], [3, 2, 1, 4], [3, 2, 5, 3],
  [3, 3, 3, 4], [3, 3, 6, 3], [3, 4, 1, 2], [3, 4, 2, 5], [3, 4, 3, 1], [3, 4, 6, 8], [3, 6, 1, 7], [3, 6, 3, 6],
  [3, 6, 5, 5], [3, 8, 1, 1], [3, 8, 4, 7], [4, 1, 5, 4], [4, 2, 1, 5], [4, 2, 6, 4], [4, 3, 2, 1], [4, 3, 2, 8],
  [4, 3, 6, 7], [4, 4, 2, 6], [4, 4, 5, 5], [4, 6, 2, 4], [4, 6, 3, 7], [4, 6, 4, 3], [4, 6, 6, 2], [4, 8, 2, 3],
  [4, 8, 4, 8], [4, 8, 5, 1], [4, 8, 6, 7], [5, 1, 6, 5], [5, 2, 1, 6], [5, 3, 1, 4], [5, 3, 5, 3], [5, 4, 1, 3],
  [5, 4, 2, 7], [5, 4, 4, 2], [5, 6, 1, 2], [5, 6, 3, 1], [5, 6, 3, 8], [5, 8, 1, 7], [5, 8, 3, 6], [5, 8, 5, 5],
  [6, 2, 1, 7], [6, 3, 4, 7], [6, 4, 2, 8], [6, 4, 6, 7], [6, 6, 6, 8], [6, 8, 2, 4], [6, 8, 4, 3], [6, 8, 6, 2]
].map(([u, c, v, w]) => ({ u, c, v, w }))
export function t18RatParamBoth() {
  const { u, c, v, w } = pick(T7)
  const n1 = [R(2 * u)], n0 = [R0, R(-c)]
  const d1 = [R(-2 * v)], d0 = [R0, R(-2 * w), R1]
  const { set, dom, excl } = twoRootsSet(n1, n0, d1, d0)
  const num = `x${SUP[2]} + ${2 * u === 1 ? "" : 2 * u}x ${MINUS} ${c === 1 ? "" : c}a`
  const den = `x${SUP[2]} ${MINUS} ${2 * v === 1 ? "" : 2 * v}x + a${SUP[2]} ${MINUS} ${2 * w}a`
  return item({
    text: `${HEAD_PARAM}\n\n${fT(num, den)} = 0\n\n${TWO_SOL}`,
    set,
    solution: `У числителя два различных корня ⟺ D/4 = ${u * u} + ${c}a > 0 ⟺ a ∈ ${domStr(dom)}.\n`
      + `Совпадение корня с полюсом: вычитая знаменатель из числителя, получаем ${2 * u + 2 * v}x ${MINUS} ${c}a ${MINUS} a${SUP[2]} + ${2 * w}a = 0, `
      + `то есть x = (a${SUP[2]} + ${c - 2 * w > 0 ? c - 2 * w : MINUS + String(2 * w - c)}a)/${2 * u + 2 * v}; подстановка в знаменатель даёт a = ${excl.map(Rstr).join(", a = ")}.\n`
      + `Эти значения выкалываем.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    pieces: (a) => [{
      N: [Rmul(R(-c), a), R(2 * u), R1],
      D: [Rsub(Rmul(a, a), Rmul(R(2 * w), a)), R(-2 * v), R1],
      lo: "-inf", hi: "+inf", incLo: false, incHi: false,
    }],
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => { const d = u * u + c * a; return d > 0 ? -u + Math.sqrt(d) : null }, label: "корни числителя" },
        { f: (a) => { const d = u * u + c * a; return d > 0 ? -u - Math.sqrt(d) : null } },
        { f: (a) => { const d = v * v - (a * a - 2 * w * a); return d > 0 ? v + Math.sqrt(d) : null }, dash: true, label: "полюсы" },
        { f: (a) => { const d = v * v - (a * a - 2 * w * a); return d > 0 ? v - Math.sqrt(d) : null }, dash: true },
      ],
      marks: excl.map((e) => { const a = Rnum(e); return { x: (a * a + (c - 2 * w) * a) / (2 * u + 2 * v), a } }),
      hlines: setBounds(set).map(Rnum),
      xMin: -12, xMax: 12, aMin: Rnum(setBounds(set)[0]) - 3, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 6,
    },
  })
}

// #9. (|kx| − x − c − a)/(x² − px − qa) = 0 — модуль в числителе.
// Числитель: при x ≥ 0 это (k−1)x = c + a, при x < 0 это −(k+1)x = c + a. Значит два корня
// x₁ = (c+a)/(k−1) > 0 и x₂ = −(c+a)/(k+1) < 0 существуют ровно при a > −c (при a = −c оба
// сливаются в x = 0). Выкалываются те a > −c, при которых x₁ или x₂ — полюс: подстановка в
// знаменатель даёт два квадратных уравнения на a; берём наборы, где все их корни рациональны.
function excl9(k, c, p, q) {
  const out = []
  for (const [sh, sg] of [[k - 1, 1], [k + 1, -1]]) {
    // (c+a)² + sg·p·sh·(c+a) − q·sh²·a = 0  (для x₁ знак «−p», для x₂ знак «+p»)
    const ca = [R(c), R1]                                    // c + a как многочлен по a
    const E = pAdd(pSub(pMul(ca, ca), pMul([R(sg * p * sh)], ca)), [R0, R(-q * sh * sh)])
    const { roots, allRational } = ratRoots(E)
    if (!allRational) return null
    for (const r of roots) if (Rcmp(r, R(-c)) > 0) out.push(r)
  }
  return uniqSorted(out)
}
// Наборы (k, c, p, q) найдены разовым перебором функцией excl9 (все выкалывания рациональны,
// границы круглые) и зафиксированы литералом — импорт модуля должен быть мгновенным.
const T9 = [
  [2, 1, 1, 1], [2, 2, 1, 2], [2, 2, 2, 1], [2, 2, 2, 2], [2, 2, 2, 3], [2, 2, 3, 2], [2, 2, 4, 3], [2, 3, 1, 2],
  [2, 3, 3, 1], [2, 3, 3, 2], [2, 3, 3, 3], [2, 3, 4, 4], [2, 4, 1, 3], [2, 4, 2, 3], [2, 4, 2, 4], [2, 4, 4, 1],
  [2, 4, 4, 2], [2, 4, 4, 3], [2, 4, 4, 4], [2, 5, 1, 3], [2, 5, 3, 4], [2, 6, 1, 4], [2, 6, 2, 4], [2, 6, 4, 1],
  [2, 7, 1, 4], [3, 2, 1, 1], [3, 3, 1, 2], [3, 3, 2, 1], [3, 3, 3, 2], [3, 4, 2, 2], [3, 4, 3, 1], [3, 5, 1, 2],
  [3, 5, 3, 2], [3, 5, 4, 1], [3, 5, 4, 4], [3, 6, 1, 2], [3, 6, 1, 3], [3, 6, 3, 1], [3, 6, 3, 2], [3, 6, 3, 3],
  [3, 6, 4, 2], [3, 7, 2, 3], [3, 7, 4, 3], [3, 8, 1, 3], [3, 8, 2, 3], [3, 8, 4, 1], [3, 8, 4, 3], [3, 8, 4, 4],
  [3, 9, 1, 4], [3, 9, 3, 4], [3, 9, 4, 4], [4, 3, 1, 1], [4, 4, 1, 1], [4, 4, 2, 1], [4, 5, 3, 1], [4, 6, 2, 1],
  [4, 6, 2, 2], [4, 6, 4, 1], [4, 7, 1, 2], [4, 7, 3, 2], [4, 8, 2, 2], [4, 8, 3, 1], [4, 8, 4, 2], [4, 9, 1, 2],
  [4, 9, 3, 2], [4, 9, 3, 3], [5, 4, 1, 1], [5, 5, 2, 1], [5, 6, 1, 1], [5, 6, 3, 1], [5, 7, 4, 1], [5, 8, 2, 1],
  [5, 8, 2, 2], [5, 9, 3, 2], [6, 5, 1, 1], [6, 6, 2, 1], [6, 7, 3, 1], [6, 8, 1, 1], [6, 8, 4, 1], [6, 9, 1, 1]
].map(([k, c, p, q]) => ({ k, c, p, q }))
export function t18RatAbsNum() {
  const { k, c, p, q } = pick(T9)
  const ex = excl9(k, c, p, q)
  const set = minusPoints(SET([IV(R(-c), "+inf")]), ex)
  const num = `|${k === 1 ? "" : k}x| ${MINUS} x ${MINUS} ${c} ${MINUS} a`
  const den = `x${SUP[2]} ${MINUS} ${p === 1 ? "" : p}x ${MINUS} ${q === 1 ? "" : q}a`
  return item({
    text: `При каких значениях параметра a уравнение\n\n${fT(num, den)} = 0\n\nимеет ровно 2 различных решения?`,
    set,
    solution: `Числитель равен нулю: при x ≥ 0 получаем ${k - 1}x = ${c} + a, то есть x = (${c} + a)/${k - 1}; `
      + `при x < 0 получаем ${MINUS}${k + 1}x = ${c} + a, то есть x = ${MINUS}(${c} + a)/${k + 1}.\n`
      + `Первый корень неотрицателен, второй отрицателен ровно при a > ${MINUS}${c}; при a = ${MINUS}${c} оба равны нулю (один корень), при a < ${MINUS}${c} корней нет.\n`
      + `Осталось выколотьa, при которых корень попал в полюс: подстановка каждого корня в знаменатель даёт квадратные уравнения на a с корнями a = ${ex.map(Rstr).join(", a = ")}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    // Два куска: x ≥ 0 (|kx| = kx) и x < 0 (|kx| = −kx); точка x = 0 принадлежит первому,
    // поэтому не считается дважды.
    pieces: (a) => {
      const D = [Rmul(R(-q), a), R(-p), R1]
      return [
        { N: [Rneg(Radd(R(c), a)), R(k - 1)], D, lo: R0, hi: "+inf", incLo: true, incHi: false },
        { N: [Rneg(Radd(R(c), a)), R(-(k + 1))], D, lo: "-inf", hi: R0, incLo: false, incHi: false },
      ]
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a > -c ? (c + a) / (k - 1) : null), label: "корни числителя" },
        { f: (a) => (a > -c ? -(c + a) / (k + 1) : null) },
        { f: (a) => { const d = p * p + 4 * q * a; return d > 0 ? (p + Math.sqrt(d)) / 2 : null }, dash: true, label: "полюсы" },
        { f: (a) => { const d = p * p + 4 * q * a; return d > 0 ? (p - Math.sqrt(d)) / 2 : null }, dash: true },
      ],
      marks: ex.map((e) => { const a = Rnum(e); return { x: (c + a) / (k - 1), a } })
        .concat(ex.map((e) => { const a = Rnum(e); return { x: -(c + a) / (k + 1), a } })),
      hlines: setBounds(set).map(Rnum),
      xMin: -10, xMax: 16, aMin: -c - 2, aMax: Rnum(ex[ex.length - 1]) + 4,
    },
  })
}

// #10. (|kx − b| + ra − b)/(x² − 2mx + a²) = 0 — модуль в числителе, a² в знаменателе.
// |kx − b| = b − ra: два корня x = (2b − ra)/k и x = ra/k существуют ровно при a < b/r.
// Выкалывания — снова подстановка каждого корня в знаменатель (квадратные уравнения на a).
function excl10(k, b, r, m) {
  const out = []
  for (const X of [[R(2 * b, k), R(-r, k)], [R0, R(r, k)]]) {           // x как многочлен по a
    const E = pAdd(pSub(pMul(X, X), pMul([R(2 * m)], X)), [R0, R0, R1]) // x² − 2mx + a²
    const { roots, allRational } = ratRoots(E)
    if (!allRational) return null
    for (const t of roots) if (Rcmp(t, R(b, r)) < 0) out.push(t)
  }
  return uniqSorted(out)
}
// Наборы (k, b, r, m) — тем же разовым перебором функцией excl10.
const T10 = [
  [2, 12, 2, 5], [2, 15, 1, 10], [2, 24, 2, 10], [3, 5, 1, 5], [3, 10, 1, 5],
  [3, 10, 1, 10], [3, 18, 3, 5], [3, 20, 1, 10], [4, 15, 2, 5]
].map(([k, b, r, m]) => ({ k, b, r, m }))
export function t18RatAbsNumSq() {
  const { k, b, r, m } = pick(T10)
  const ex = excl10(k, b, r, m)
  const set = minusPoints(SET([IV("-inf", R(b, r))]), ex)
  const num = `|${k}x ${MINUS} ${b}| + ${r === 1 ? "" : r}a ${MINUS} ${b}`
  const den = `x${SUP[2]} ${MINUS} ${2 * m}x + a${SUP[2]}`
  return item({
    text: `${HEAD_A}\n\n${fT(num, den)} = 0\n\n${TWO_SOL}`,
    set,
    solution: `Уравнение числителя: |${k}x ${MINUS} ${b}| = ${b} ${MINUS} ${r === 1 ? "" : r}a. Оно имеет два различных корня ровно при ${b} ${MINUS} ${r === 1 ? "" : r}a > 0, то есть при a < ${Rstr(R(b, r))}; `
      + `корни x = ${Rstr(R(2 * b, k))} ${MINUS} ${Rstr(R(r, k))}a и x = ${Rstr(R(r, k))}a.\n`
      + `Знаменатель x${SUP[2]} ${MINUS} ${2 * m}x + a${SUP[2]} обнуляется в полюсах; подстановка каждого корня даёт квадратные уравнения на a с корнями a = ${ex.map(Rstr).join(", a = ")} — их выкалываем.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    pieces: (a) => {
      const D = [Rmul(a, a), R(-2 * m), R1]
      return [
        { N: [Rsub(Rmul(R(r), a), R(2 * b)), R(k)], D, lo: R(b, k), hi: "+inf", incLo: true, incHi: false },
        { N: [Rmul(R(r), a), R(-k)], D, lo: "-inf", hi: R(b, k), incLo: false, incHi: false },
      ]
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a < b / r ? (2 * b - r * a) / k : null), label: "корни числителя" },
        { f: (a) => (a < b / r ? (r * a) / k : null) },
        { f: (a) => { const d = m * m - a * a; return d >= 0 ? m + Math.sqrt(d) : null }, dash: true, label: "полюсы" },
        { f: (a) => { const d = m * m - a * a; return d >= 0 ? m - Math.sqrt(d) : null }, dash: true },
      ],
      marks: ex.map((e) => { const a = Rnum(e); return { x: (r * a) / k, a } })
        .concat(ex.map((e) => { const a = Rnum(e); return { x: (2 * b - r * a) / k, a } })),
      hlines: setBounds(set).map(Rnum),
      xMin: -6, xMax: 2 * m + 6, aMin: Rnum(ex[0]) - 3, aMax: b / r + 3,
    },
  })
}

// #11. (x² − a(a−1)x − a³)/√(подкоренной квадратный) = 0 — знаменатель корень,
// ОДЗ — открытый промежуток (p; q). Числитель = (x − a²)(x + a).
// ОТ ОТВЕТА: оба корня обязаны лежать в ОДЗ и не совпадать, отсюда
// a² ∈ (p; q) ⟺ |a| < √q (p < 0) и −a ∈ (p; q) ⟺ −q < a < −p; совпадают при a = 0 и a = −1.
const T11 = []
for (const q of [4, 9, 16]) for (const p of [-1, -2, -3, -4, -5]) {
  const sq = Math.sqrt(q)
  const lo = -sq, hi = Math.min(sq, -p)
  if (!(lo < -1 && hi > 0)) continue                  // чтобы выкалывались обе точки 0 и −1
  T11.push({ p, q })
}
export function t18RatSqrtDenOdz() {
  const { p, q } = pick(T11)
  const sq = Math.round(Math.sqrt(q))
  const lo = R(-sq), hi = R(Math.min(sq, -p))
  const set = gapExcept(lo, hi, [R0, R(-1)])
  const sum = p + q, prod = -p * q                    // (x−p)(q−x) = −x² + (p+q)x − pq
  // корень ВНУТРИ дроби пишется маркером √{X}: токен ⟦r⟧ содержит «⟧» и рвал бы захват дроби
  const under = `${prod}${term(sum, "x")} ${MINUS} x${SUP[2]}`
  const den = `√{${under}}`
  const num = `x${SUP[2]} ${MINUS} a(a ${MINUS} 1)x ${MINUS} a${SUP[3]}`
  return item({
    text: `${HEAD_A}\n\n${fT(num, den)} = 0\n\n${TWO_ROOTS}`,
    set,
    solution: `ОДЗ: ${under} > 0 ⟺ x ∈ (${nS(p)}; ${q}).\n`
      + `Числитель раскладывается: x${SUP[2]} ${MINUS} a(a ${MINUS} 1)x ${MINUS} a${SUP[3]} = (x ${MINUS} a${SUP[2]})(x + a), корни x = a${SUP[2]} и x = ${MINUS}a.\n`
      + `Нужны два различных корня, оба в ОДЗ: a${SUP[2]} ∈ (${nS(p)}; ${q}) ⟺ |a| < ${sq}; ${MINUS}a ∈ (${nS(p)}; ${q}) ⟺ ${MINUS}${q} < a < ${nS(-p)}. Вместе ${Rstr(lo)} < a < ${Rstr(hi)}.\n`
      + `Совпадают корни при a${SUP[2]} = ${MINUS}a, то есть при a = 0 и a = ${MINUS}1 — эти значения выкалываем.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    // ОДЗ — открытый промежуток (p; q): корни вне него решениями не являются.
    pieces: (a) => [{
      N: [Rneg(Rmul(Rmul(a, a), a)), Rneg(Rsub(Rmul(a, a), a)), R1],
      D: null, lo: R(p), hi: R(q), incLo: false, incHi: false,
    }],
    aRange: [-10, 10],
    picture: {
      curves: [
        { f: (a) => a * a, label: "x = a²" },
        { f: (a) => -a, label: `x = ${MINUS}a` },
      ],
      marks: [{ x: 0, a: 0 }, { x: 1, a: -1 }],
      hlines: [Rnum(lo), Rnum(hi), 0, -1],
      xMin: p - 2, xMax: q + 2, aMin: -6, aMax: 6,
    },
  })
}

// =============================================================================
// РАЗДЕЛ B. «Ровно один корень на отрезке» (эталон #12, #20, #21, #22, #24, #28)
// =============================================================================
// Общий приём раздела: множество решений — это корни многочлена, отфильтрованные ОДЗ и
// отрезком. Ответ собирается функцией assembleSet по ТОЧНОМУ списку критических значений a
// (корень попал на конец отрезка / на границу ОДЗ, дискриминант обнулился, ОДЗ выродилось).
// Наборы параметров подобраны разовым перебором так, чтобы все критические значения были
// рациональными и круглыми; verify18 проверяет результат сеткой независимо.

const ONE_ROOT_SEG = (L, R) => `имеет ровно один корень на отрезке [${nS(L)}; ${nS(R)}].`

// #12. (x² − 2mx + a²)/√((a + b − x)(a − c + x)) = 0 — ОДЗ строгое, между корнями (a+b) и (c−a).
function build12({ m, b, c, L, R: Rr }) {
  const N = (a) => [Rmul(a, a), R(-2 * m), R1]
  const odz = (a) => {                                   // (a+b; c−a) или (c−a; a+b) — строго
    const u = Radd(a, R(b)), v = Rsub(R(c), a)
    return Rcmp(u, v) <= 0 ? { lo: u, hi: v, incLo: false, incHi: false } : { lo: v, hi: u, incLo: false, incHi: false }
  }
  const seg = { lo: R(L), hi: R(Rr), incLo: true, incHi: true }
  const solve = (a) => {
    const I = ivCut(odz(a), seg)
    if (ivEmpty(I)) return 0
    return countRoots(N(a), I.lo, I.hi, I.incLo, I.incHi)
  }
  // критические значения: двойной корень, корень на конце отрезка, корень на границе ОДЗ,
  // граница ОДЗ на конце отрезка, вырождение ОДЗ
  const crit = [R(m), R(-m), R(c - b, 2), R(L - b), R(Rr - b), R(c - L), R(c - Rr)]
  for (const X of [R(2 * m * L - L * L), R(2 * m * Rr - Rr * Rr)]) {       // a² = 2mX − X²
    if (X.n < 0n) continue
    const r = isSq(Number(X.n))
    if (r === null) return null
    crit.push(R(r), R(-r))
  }
  for (const P of [[R(b), R1], [R(c), R(-1)]]) {          // x = a+b и x = c−a как многочлены по a
    const E = pAdd(pSub(pMul(P, P), pMul([R(2 * m)], P)), [R0, R0, R1])
    const { roots, allRational } = ratRoots(E)
    if (!allRational) return null
    crit.push(...roots)
  }
  const set = assembleSet((a) => solve(a) === 1, crit)
  return { set, solve, N }
}
// Наборы (m, b, c, L, R) отобраны разовым перебором: все критические значения рациональны
// (у оригинала ФИПИ, например, они содержат √24 — такие наборы генератор не берёт).
const T12 = [[3, 6, 6, 0, 6], [4, 8, 8, 4, 8], [5, 4, 4, 0, 5], [5, 4, 4, 2, 5], [5, 4, 6, 0, 5],
  [5, 4, 6, 2, 5], [5, 6, 4, 0, 5], [5, 6, 4, 2, 5], [5, 6, 6, 0, 5]].map(([m, b, c, L, R]) => ({ m, b, c, L, R }))
export function t18SegSqrtOdz() {
  const par = pick(T12), { m, b, c, L, R: Rr } = par
  const { set, solve } = build12(par)
  const num = `x${SUP[2]} ${MINUS} ${2 * m}x + a${SUP[2]}`
  const den = `√{(a ${MINUS} x + ${b})(a + x ${MINUS} ${c})}`
  return item({
    text: `${HEAD_A}\n\n${fT(num, den)} = 0\n\n${ONE_ROOT_SEG(L, Rr)}`,
    set,
    solution: `ОДЗ: (a ${MINUS} x + ${b})(a + x ${MINUS} ${c}) > 0. Это парабола по x ветвями вниз с корнями x = a + ${b} и x = ${c} ${MINUS} a, `
      + `поэтому ОДЗ — интервал между ними.\n`
      + `Числитель: x${SUP[2]} ${MINUS} ${2 * m}x + a${SUP[2]} = 0, корни x = ${m} ± √(${m * m} ${MINUS} a${SUP[2]}) — существуют при |a| ≤ ${m}.\n`
      + `Нужно, чтобы РОВНО ОДИН из корней попал в пересечение ОДЗ с отрезком [${nS(L)}; ${Rr}]. Конфигурация меняется только когда корень `
      + `совпадает с концом отрезка, с границей ОДЗ, когда корни сливаются (a = ±${m}) или когда ОДЗ вырождается.\n`
      + `Ответ: ${setToString(set)}.`,
    // числовая сверка идёт по НАПЕЧАТАННОМУ выражению, а не по разложению
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => { const d = (a - x + b) * (a + x - c); return d > 0 ? (x * x - 2 * m * x + a * a) / Math.sqrt(d) : null },
      sols: (a) => {
        if (Math.abs(a) > m) return []
        const d = Math.sqrt(m * m - a * a)
        return [m - d, m + d].filter((x, i, arr) => (i === 0 || Math.abs(x - arr[0]) > 1e-12))
          .filter((x) => x >= L - 1e-12 && x <= Rr + 1e-12 && (a - x + b) * (a + x - c) > 1e-12)
      },
    },
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (Math.abs(a) <= m ? m + Math.sqrt(m * m - a * a) : null), label: "корни числителя" },
        { f: (a) => (Math.abs(a) <= m ? m - Math.sqrt(m * m - a * a) : null) },
        { f: (a) => a + b, dash: true, label: "границы ОДЗ" },
        { f: (a) => c - a, dash: true },
        { f: () => L, dash: true, label: "отрезок" },
        { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: Math.min(L, 0) - 4, xMax: Rr + 6, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #20. ((x − a − p)(x + a − q))/√(2mx − x² − a²) = 0 — корни линейны по a, ОДЗ квадратичное.
function build20({ p, q, m, L, R: Rr }) {
  const Q = (a, x) => Rsub(Rsub(Rmul(R(2 * m), x), Rmul(x, x)), Rmul(a, a))   // 2mx − x² − a²
  const inSeg = (x) => Rcmp(x, R(L)) >= 0 && Rcmp(x, R(Rr)) <= 0
  const solve = (a) => {
    const xs = [Radd(a, R(p)), Rsub(R(q), a)]
    const good = []
    for (const x of xs) if (inSeg(x) && Rsign(Q(a, x)) > 0 && !good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    return good.length
  }
  const crit = [R(L - p), R(Rr - p), R(q - L), R(q - Rr), R(q - p, 2)]
  for (const X of [[R(p), R1], [R(q), R(-1)]]) {          // подстановка корня в ОДЗ: 2mx − x² − a² = 0
    const E = pSub(pSub(pMul([R(2 * m)], X), pMul(X, X)), [R0, R0, R1])
    const { roots, allRational } = ratRoots(E)
    if (!allRational) return null
    crit.push(...roots)
  }
  const set = assembleSet((a) => solve(a) === 1, crit)
  return { set, solve }
}
// Наборы (p, q, m, L, R) — тем же отбором.
const T20 = [[4, 4, 5, 0, 3], [4, 4, 5, 0, 5], [4, 4, 5, 0, 6], [4, 4, 5, 2, 5], [4, 4, 5, 2, 7],
  [4, 4, 5, 2, 8], [4, 4, 5, 3, 7], [4, 4, 5, 3, 8], [4, 6, 5, 0, 3], [4, 6, 5, 0, 4]].map(([p, q, m, L, R]) => ({ p, q, m, L, R }))
export function t18SegTwoLinRoots() {
  const par = pick(T20), { p, q, m, L, R: Rr } = par
  const { set, solve } = build20(par)
  const num = `(x ${MINUS} a ${MINUS} ${p})(x + a ${MINUS} ${q})`
  const den = `√{${2 * m}x ${MINUS} x${SUP[2]} ${MINUS} a${SUP[2]}}`
  return item({
    text: `${HEAD_A}\n\n${fT(num, den)} = 0\n\n${ONE_ROOT_SEG(L, Rr)}`,
    set,
    solution: `Числитель обнуляется при x = a + ${p} и x = ${q} ${MINUS} a (они совпадают при a = ${Rstr(R(q - p, 2))}).\n`
      + `ОДЗ: ${2 * m}x ${MINUS} x${SUP[2]} ${MINUS} a${SUP[2]} > 0, то есть точка обязана лежать строго внутри окружности-условия; подстановка каждого корня даёт квадратное неравенство на a.\n`
      + `Требуется, чтобы ровно один из корней одновременно лежал на отрезке [${nS(L)}; ${Rr}] и удовлетворял ОДЗ.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => { const d = 2 * m * x - x * x - a * a; return d > 0 ? ((x - a - p) * (x + a - q)) / Math.sqrt(d) : null },
      sols: (a) => [a + p, q - a].filter((x, i, arr) => i === 0 || Math.abs(x - arr[0]) > 1e-12)
        .filter((x) => x >= L - 1e-12 && x <= Rr + 1e-12 && 2 * m * x - x * x - a * a > 1e-12),
    },
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a + p, label: `x = a + ${p}` },
        { f: (a) => q - a, label: `x = ${q} ${MINUS} a` },
        { f: (a) => (Math.abs(a) <= m ? m + Math.sqrt(m * m - a * a) : null), dash: true, label: "границы ОДЗ" },
        { f: (a) => (Math.abs(a) <= m ? m - Math.sqrt(m * m - a * a) : null), dash: true },
        { f: () => L, dash: true, label: "отрезок" },
        { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2, xMax: Rr + 6, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #28. ln(kx − 1)·√(x² − 2mx + 2ta − a²) = 0 — произведение логарифма и корня.
function build28({ k, m, t, L, R: Rr }) {
  const Q = (a) => [Rsub(Rmul(R(2 * t), a), Rmul(a, a)), R(-2 * m), R1]   // x² − 2mx + 2ta − a²
  const x0 = R(2, k)                                     // ln(kx−1) = 0 ⟺ kx − 1 = 1
  const solve = (a) => {
    // корни подкоренного, попавшие в (1/k; Rr] ∩ [L; Rr] — там логарифм определён
    const I = ivCut({ lo: R(1, k), hi: "+inf", incLo: false, incHi: false }, { lo: R(L), hi: R(Rr), incLo: true, incHi: true })
    let n = ivEmpty(I) ? 0 : countRoots(Q(a), I.lo, I.hi, I.incLo, I.incHi)
    // x = 2/k годится, если подкоренное там неотрицательно (и это не тот же корень)
    const v = pEval(Q(a), x0)
    if (Rcmp(x0, R(L)) >= 0 && Rcmp(x0, R(Rr)) <= 0 && Rsign(v) > 0) n++
    return n
  }
  const crit = []
  for (const X of [x0, R(L), R(Rr), R(1, k)]) {           // подкоренное обнуляется в фиксированной точке
    const E = [Rsub(Rmul(X, X), Rmul(R(2 * m), X)), R(2 * t), R(-1)]     // как многочлен по a
    const { roots, allRational } = ratRoots(E)
    if (!allRational) return null
    crit.push(...roots)
  }
  const dsq = t * t - m * m                               // дискриминант подкоренного: a² − 2ta + m² = 0
  if (dsq >= 0) { const r = isSq(dsq); if (r === null) return null; crit.push(R(t + r), R(t - r)) }
  const set = assembleSet((a) => solve(a) === 1, crit)
  return { set, solve }
}
// Наборы (k, m, t, L, R) — тем же отбором; набор [4, 3, 3, 0, 3] совпадает с оригиналом ФИПИ.
const T28 = [[4, 3, 3, 0, 3], [2, 2, 2, 0, 3], [2, 2, 2, 0, 4], [2, 2, 2, 0, 5], [2, 2, 2, 0, 6],
  [2, 2, 2, 1, 4], [2, 2, 2, 1, 5], [2, 3, 3, 0, 3], [2, 3, 3, 0, 5]].map(([k, m, t, L, R]) => ({ k, m, t, L, R }))
export function t18SegLnTimesSqrt() {
  const par = pick(T28), { k, m, t, L, R: Rr } = par
  const { set, solve } = build28(par)
  const text = `ln(${k}x ${MINUS} 1) · √{x${SUP[2]} ${MINUS} ${2 * m}x + ${2 * t}a ${MINUS} a${SUP[2]}} = 0`
  return item({
    text: `${HEAD_A}\n\n${text}\n\n${ONE_ROOT_SEG(L, Rr)}`,
    set,
    solution: `Произведение равно нулю, когда равен нулю один из множителей И определён второй.\n`
      + `ln(${k}x ${MINUS} 1) = 0 ⟺ ${k}x ${MINUS} 1 = 1 ⟺ x = ${Rstr(R(2, k))}; этот корень годится, если подкоренное там положительно.\n`
      + `√(x${SUP[2]} ${MINUS} ${2 * m}x + ${2 * t}a ${MINUS} a${SUP[2]}) = 0 ⟺ x${SUP[2]} ${MINUS} ${2 * m}x + ${2 * t}a ${MINUS} a${SUP[2]} = 0, и нужен ${k}x ${MINUS} 1 > 0, то есть x > ${Rstr(R(1, k))}.\n`
      + `Считаем, при каких a на отрезке [${nS(L)}; ${Rr}] остаётся ровно один такой x.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => {
        const q = x * x - 2 * m * x + 2 * t * a - a * a
        return k * x - 1 > 0 && q >= -EPS ? Math.log(k * x - 1) * sqrtSafe(q) : null
      },
      sols: (a) => {
        const out = [], D = m * m - (2 * t * a - a * a)
        if (D >= 0) for (const x of [m - Math.sqrt(D), m + Math.sqrt(D)]) {
          if (k * x - 1 > 1e-12 && x >= L - 1e-12 && x <= Rr + 1e-12 && !out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
        }
        const x0 = 2 / k
        if (x0 >= L - 1e-12 && x0 <= Rr + 1e-12 && x0 * x0 - 2 * m * x0 + 2 * t * a - a * a > 1e-12
          && !out.some((y) => Math.abs(y - x0) < 1e-9)) out.push(x0)
        return out
      },
    },
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => 2 / k, label: `x = ${nS(2 / k)}` },
        { f: (a) => { const d = m * m - (2 * t * a - a * a); return d >= 0 ? m + Math.sqrt(d) : null }, label: "корни подкоренного" },
        { f: (a) => { const d = m * m - (2 * t * a - a * a); return d >= 0 ? m - Math.sqrt(d) : null } },
        { f: () => 1 / k, dash: true, label: "ОДЗ логарифма" },
        { f: () => Rr, dash: true, label: "отрезок" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2, xMax: Rr + 6, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #21. √(x² − a²) = √(3x² − ((p+2)a + q)x + (p−1)a² + qa) — равенство двух корней.
// Разность подкоренных тождественно равна ${MINUS}2(x − a)(x − (pa+q)/2), поэтому кандидаты —
// x = a и x = (pa+q)/2; годится тот, у которого x² ≥ a² (тогда оба подкоренных неотрицательны).
function build21({ p, q, L, R: Rr }) {
  const x2 = (a) => Rdiv(Radd(Rmul(R(p), a), R(q)), R(2))
  const okVal = (a, x) => Rcmp(Rmul(x, x), Rmul(a, a)) >= 0
  const inSeg = (x) => Rcmp(x, R(L)) >= 0 && Rcmp(x, R(Rr)) <= 0
  const solve = (a) => {
    const cand = [a, x2(a)], good = []
    for (const x of cand) if (inSeg(x) && okVal(a, x) && !good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    return good.length
  }
  const crit = [R(L), R(Rr)]
  if (p !== 0) { crit.push(R(2 * L - q, p), R(2 * Rr - q, p)) }
  if (p !== 2) crit.push(R(q, 2 - p))
  if (p !== 2) crit.push(R(-q, p - 2))
  if (p !== -2) crit.push(R(-q, p + 2))
  const set = assembleSet((a) => solve(a) === 1, crit)
  return { set, solve }
}
const T21 = [[1, 1, 0, 1], [1, 2, 0, 2], [1, 1, 0, 2], [3, 1, 0, 1], [1, 3, 0, 3], [3, 2, 0, 2], [1, 4, 0, 4], [3, 4, 0, 2]]
  .map(([p, q, L, R]) => ({ p, q, L, R }))
export function t18SegTwoSqrtEq() {
  const par = pick(T21), { p, q, L, R: Rr } = par
  const { set, solve } = build21(par)
  const c1 = `(${p + 2 === 1 ? "" : p + 2}a + ${q})`
  const c0 = p === 1 ? `${q === 1 ? "" : q}a` : `${p - 1 === 1 ? "" : p - 1}a${SUP[2]} + ${q === 1 ? "" : q}a`
  return item({
    text: `${HEAD_A}\n\n⟦r:x${SUP[2]} ${MINUS} a${SUP[2]}⟧ = ⟦r:3x${SUP[2]} ${MINUS} ${c1}x + ${c0}⟧\n\n${ONE_ROOT_SEG(L, Rr)}`,
    set,
    solution: `Оба корня определены и равны ⟺ подкоренные равны и неотрицательны.\n`
      + `Разность подкоренных: (x${SUP[2]} ${MINUS} a${SUP[2]}) ${MINUS} (3x${SUP[2]} ${MINUS} ${c1}x + ${c0}) = ${MINUS}2(x ${MINUS} a)(x ${MINUS} ${Rstr(R(p, 2))}a ${MINUS} ${Rstr(R(q, 2))}), `
      + `значит кандидаты — x = a и x = ${Rstr(R(p, 2))}a + ${Rstr(R(q, 2))}.\n`
      + `Кандидат годится, когда x${SUP[2]} ${MINUS} a${SUP[2]} ≥ 0 (для x = a это верно всегда) и когда он попал на отрезок [${nS(L)}; ${Rr}].\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => {
        const A = x * x - a * a, B = 3 * x * x - ((p + 2) * a + q) * x + (p - 1) * a * a + q * a
        return A >= -EPS && B >= -EPS ? sqrtSafe(A) - sqrtSafe(B) : null
      },
      sols: (a) => [a, (p * a + q) / 2].filter((x, i, arr) => i === 0 || Math.abs(x - arr[0]) > 1e-12)
        .filter((x) => x >= L - 1e-12 && x <= Rr + 1e-12 && x * x - a * a >= -1e-12),
    },
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a, label: "x = a" },
        { f: (a) => (p * a + q) / 2, label: `x = (${p === 1 ? "" : p}a + ${q})/2` },
        { f: () => L, dash: true, label: "отрезок" },
        { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 4, xMax: Rr + 4, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #22. x² + (x − p)·√(kx − a) = px ⟺ (x − p)(x + √(kx − a)) = 0.
// Значит либо x = p (нужно kp − a ≥ 0), либо √(kx − a) = −x, что требует x ≤ 0 и x² = kx − a.
function build22({ k, p, L, R: Rr }) {
  const solve = (a) => {
    let n = 0
    if (Rcmp(R(k * p), a) >= 0 && Rcmp(R(p), R(L)) >= 0 && Rcmp(R(p), R(Rr)) <= 0) n++
    // корни x² − kx + a = 0 при x ≤ 0, попавшие на отрезок (x = p сюда не попадает, p > 0)
    const I = ivCut({ lo: "-inf", hi: R0, incLo: false, incHi: true }, { lo: R(L), hi: R(Rr), incLo: true, incHi: true })
    if (!ivEmpty(I)) n += countRoots([a, R(-k), R1], I.lo, I.hi, I.incLo, I.incHi)
    return n
  }
  const crit = [R(k * p), R0, R(k * L - L * L), R(k * k, 4)]
  const set = assembleSet((a) => solve(a) === 1, crit)
  return { set, solve }
}
const T22 = [[3, 1, 0, 1], [4, 1, 0, 1], [3, 1, -1, 1], [4, 2, 0, 2], [5, 1, -1, 1], [2, 1, 0, 1], [6, 2, -1, 2], [4, 1, -2, 1]]
  .map(([k, p, L, R]) => ({ k, p, L, R }))
export function t18SegRootTimesLin() {
  const par = pick(T22), { k, p, L, R: Rr } = par
  const { set, solve } = build22(par)
  return item({
    text: `${HEAD_A}\n\nx${SUP[2]} + (x ${MINUS} ${p})·⟦r:${k}x ${MINUS} a⟧ = ${p === 1 ? "" : p}x\n\n${ONE_ROOT_SEG(L, Rr)}`,
    set,
    solution: `Перенесём ${p === 1 ? "" : p}x влево: x${SUP[2]} ${MINUS} ${p === 1 ? "" : p}x + (x ${MINUS} ${p})√(${k}x ${MINUS} a) = 0 ⟺ (x ${MINUS} ${p})(x + √(${k}x ${MINUS} a)) = 0.\n`
      + `Первый множитель даёт x = ${p} — годится, если подкоренное неотрицательно: ${k * p} ${MINUS} a ≥ 0, то есть a ≤ ${k * p}.\n`
      + `Второй даёт √(${k}x ${MINUS} a) = ${MINUS}x, что возможно лишь при x ≤ 0 и x${SUP[2]} = ${k}x ${MINUS} a, то есть x${SUP[2]} ${MINUS} ${k}x + a = 0.\n`
      + `Считаем, сколько таких x лежит на отрезке [${nS(L)}; ${Rr}].\nОтвет: ${setToString(set)}.`,
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => (k * x - a >= -EPS ? x * x + (x - p) * sqrtSafe(k * x - a) - p * x : null),
      sols: (a) => {
        const out = []
        if (k * p - a >= -1e-12 && p >= L - 1e-12 && p <= Rr + 1e-12) out.push(p)
        const D = k * k - 4 * a
        if (D >= 0) for (const x of [(k - Math.sqrt(D)) / 2, (k + Math.sqrt(D)) / 2]) {
          if (x <= 1e-12 && x >= L - 1e-12 && x <= Rr + 1e-12 && !out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
        }
        return out
      },
    },
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => p, label: `x = ${p}` },
        { f: (a) => { const d = k * k - 4 * a; return d >= 0 ? (k - Math.sqrt(d)) / 2 : null }, label: "корень x ≤ 0" },
        { f: () => L, dash: true, label: "отрезок" },
        { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 4, xMax: Rr + 4, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #24. x·√(x − a) = √((u+v)x² − (uv + (u+v)a)x + uv·a).
// Подкоренное справа = (x − a)((u+v)x − uv), возведение в квадрат даёт (x − a)(x − u)(x − v) = 0;
// условия: x ≥ 0 (левая часть неотрицательна) и x ≥ a (ОДЗ). Кандидаты: a, u, v.
function build24({ u, v, L, R: Rr }) {
  const inSeg = (x) => Rcmp(x, R(L)) >= 0 && Rcmp(x, R(Rr)) <= 0
  const solve = (a) => {
    const cand = [a, R(u), R(v)], good = []
    for (const x of cand) {
      if (Rsign(x) < 0 || Rcmp(x, a) < 0 || !inSeg(x)) continue
      if (!good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    }
    return good.length
  }
  const crit = [R0, R(L), R(Rr), R(u), R(v)]
  const set = assembleSet((a) => solve(a) === 1, crit)
  return { set, solve }
}
const T24 = [[1, 4, 0, 1], [1, 3, 0, 2], [2, 5, 0, 3], [1, 5, 0, 1], [2, 3, 0, 2], [1, 6, 0, 4], [3, 4, 0, 3], [2, 6, 0, 5]]
  .map(([u, v, L, R]) => ({ u, v, L, R }))
export function t18SegXTimesSqrt() {
  const par = pick(T24), { u, v, L, R: Rr } = par
  const { set, solve } = build24(par)
  const S = u + v, P = u * v
  const rad = `${S}x${SUP[2]} ${MINUS} (${P} + ${S}a)x + ${P}a`
  return item({
    text: `${HEAD_A}\n\nx⟦r:x ${MINUS} a⟧ = ⟦r:${rad}⟧\n\n${ONE_ROOT_SEG(L, Rr)}`,
    set,
    solution: `Правое подкоренное раскладывается: ${rad} = (x ${MINUS} a)(${S}x ${MINUS} ${P}).\n`
      + `Левая часть неотрицательна, поэтому нужно x ≥ 0; ОДЗ даёт x ≥ a. Возводя в квадрат, получаем `
      + `x${SUP[2]}(x ${MINUS} a) = (x ${MINUS} a)(${S}x ${MINUS} ${P}) ⟺ (x ${MINUS} a)(x ${MINUS} ${u})(x ${MINUS} ${v}) = 0.\n`
      + `Кандидаты x = a, x = ${u}, x = ${v}; каждый годится при x ≥ 0 и x ≥ a. Считаем попавшие на отрезок [${nS(L)}; ${Rr}].\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => {
        const rad = (u + v) * x * x - (u * v + (u + v) * a) * x + u * v * a
        return x - a >= -EPS && rad >= -EPS ? x * sqrtSafe(x - a) - sqrtSafe(rad) : null
      },
      sols: (a) => [a, u, v].filter((x) => x >= -1e-12 && x >= a - 1e-12 && x >= L - 1e-12 && x <= Rr + 1e-12)
        .filter((x, i, arr) => arr.findIndex((y) => Math.abs(y - x) < 1e-9) === i),
    },
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a, label: "x = a" },
        { f: () => u, label: `x = ${u}` },
        { f: () => v, label: `x = ${v}` },
        { f: () => Rr, dash: true, label: "отрезок" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 3, xMax: Math.max(v, Rr) + 3, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// =============================================================================
// РАЗДЕЛ C. «A² = B²» → произведение множителей = 0, единственное решение на отрезке
// (эталон #13, #14, #15, #16, #19, #23)
// =============================================================================
const ONE_SOL_SEG = (L, R) => `имеет единственное решение на отрезке [${nS(L)}; ${nS(R)}].`
const ONE_SOL_INT = (L, R) => `имеет единственное решение на интервале (${nS(L)}; ${nS(R)}).`

// #13. (x² + kx + ka)² = (k²+1)x⁴ + (k²+1)(x + a)².
// Обозначив A = x², B = x + a, получаем (A + kB)² = (k²+1)(A² + B²) ⟺ (kA − B)² = 0,
// то есть уравнение равносильно kx² − x − a = 0. Ответ — значения a, при которых у этого
// квадратного уравнения ровно один корень на отрезке.
function build13({ k, L, R: Rr }) {
  const solve = (a) => countRoots([Rneg(a), R(-1), R(k)], R(L), R(Rr), true, true)
  const crit = [R(k * L * L - L), R(k * Rr * Rr - Rr), R(-1, 4 * k)]   // значения на концах и в вершине
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T13 = [[2, 0, 2], [2, 0, 1], [3, 0, 2], [2, 1, 3], [3, 0, 1], [4, 0, 2], [2, 0, 3], [3, 1, 2]]
  .map(([k, L, R]) => ({ k, L, R }))
export function t18SqEqPoly() {
  const par = pick(T13), { k, L, R: Rr } = par
  const { set, solve } = build13(par)
  const m = k * k + 1
  return item({
    text: `Найдите все значения a, при которых уравнение\n\n(x${SUP[2]} + ${k}x + ${k}a)${SUP[2]} = ${m}x⁴ + ${m}(x + a)${SUP[2]}\n\n${ONE_SOL_SEG(L, Rr)}`,
    set,
    solution: `Обозначим A = x${SUP[2]}, B = x + a. Тогда уравнение принимает вид (A + ${k}B)${SUP[2]} = ${m}(A${SUP[2]} + B${SUP[2]}).\n`
      + `Раскрывая, получаем ${k * k}A${SUP[2]} ${MINUS} ${2 * k}AB + B${SUP[2]} = 0, то есть (${k}A ${MINUS} B)${SUP[2]} = 0 ⟺ ${k}x${SUP[2]} ${MINUS} x ${MINUS} a = 0.\n`
      + `Значит нужно, чтобы у уравнения a = ${k}x${SUP[2]} ${MINUS} x был ровно один корень на [${nS(L)}; ${Rr}]. Парабола ${k}x${SUP[2]} ${MINUS} x имеет вершину в x = ${Rstr(R(1, 2 * k))} со значением ${Rstr(R(-1, 4 * k))}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => Math.pow(x * x + k * x + k * a, 2) - m * Math.pow(x, 4) - m * Math.pow(x + a, 2),
      sols: (a) => {
        const D = 1 + 4 * k * a
        if (D < 0) return []
        const r = [(1 - Math.sqrt(D)) / (2 * k), (1 + Math.sqrt(D)) / (2 * k)]
        return r.filter((x, i) => (i === 0 || Math.abs(x - r[0]) > 1e-12)).filter((x) => x >= L - 1e-12 && x <= Rr + 1e-12)
      },
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => { const D = 1 + 4 * k * a; return D >= 0 ? (1 + Math.sqrt(D)) / (2 * k) : null }, label: `корни ${k}x² − x = a` },
        { f: (a) => { const D = 1 + 4 * k * a; return D >= 0 ? (1 - Math.sqrt(D)) / (2 * k) : null } },
        { f: () => L, dash: true, label: "отрезок" }, { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 2, xMax: Rr + 2, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #15. (k|x| + x − a)² = 2k²x² + 2(x − a)² ⟺ (k|x| − (x − a))² = 0 ⟺ a = x − k|x|.
// Кандидаты: x = −a/(k−1) (ветвь x ≥ 0, годится при a ≤ 0) и x = a/(k+1) (ветвь x < 0, при a < 0).
function build15({ k, L, R: Rr }) {
  const inInt = (x) => Rcmp(x, R(L)) > 0 && Rcmp(x, R(Rr)) < 0     // интервал открытый
  const solve = (a) => {
    const good = []
    if (Rsign(a) <= 0) { const x = Rdiv(Rneg(a), R(k - 1)); if (inInt(x)) good.push(x) }
    if (Rsign(a) < 0) { const x = Rdiv(a, R(k + 1)); if (inInt(x) && !good.some((y) => Rcmp(y, x) === 0)) good.push(x) }
    return good.length
  }
  const crit = [R0, R(-(k - 1) * L), R(-(k - 1) * Rr), R((k + 1) * L), R((k + 1) * Rr)]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T15 = [[3, -1, 1], [2, -1, 1], [4, -1, 1], [3, -2, 2], [2, -2, 1], [5, -1, 1], [3, -1, 2], [4, -2, 2]]
  .map(([k, L, R]) => ({ k, L, R }))
export function t18SqEqAbs() {
  const par = pick(T15), { k, L, R: Rr } = par
  const { set, solve } = build15(par)
  return item({
    text: `Найдите все значения a, при каждом из которых уравнение\n\n(${k}|x| + x ${MINUS} a)${SUP[2]} = ${2 * k * k}x${SUP[2]} + 2(x ${MINUS} a)${SUP[2]}\n\n${ONE_SOL_INT(L, Rr)}`,
    set,
    solution: `Пусть A = ${k}|x|, B = x ${MINUS} a. Так как A${SUP[2]} = ${k * k}x${SUP[2]}, правая часть равна 2A${SUP[2]} + 2B${SUP[2]}, и уравнение (A + B)${SUP[2]} = 2A${SUP[2]} + 2B${SUP[2]} равносильно (A ${MINUS} B)${SUP[2]} = 0.\n`
      + `Значит ${k}|x| = x ${MINUS} a, то есть a = x ${MINUS} ${k}|x|: при x ≥ 0 это a = ${MINUS}${k - 1}x, при x < 0 это a = ${k + 1}x.\n`
      + `Считаем, сколько таких x попадает в интервал (${nS(L)}; ${Rr}).\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => Math.pow(k * Math.abs(x) + x - a, 2) - 2 * k * k * x * x - 2 * Math.pow(x - a, 2),
      sols: (a) => {
        const out = []
        if (a <= 1e-12) { const x = -a / (k - 1); if (x > L + 1e-12 && x < Rr - 1e-12) out.push(x) }
        if (a < -1e-12) { const x = a / (k + 1); if (x > L + 1e-12 && x < Rr - 1e-12 && !out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x) }
        return out
      },
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a <= 0 ? -a / (k - 1) : null), label: "ветвь x ≥ 0" },
        { f: (a) => (a < 0 ? a / (k + 1) : null), label: "ветвь x < 0" },
        { f: () => L, dash: true, label: "интервал" }, { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 2, xMax: Rr + 2, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #16. (kx + ln(x + ca))² = (kx − ln(x + ca))² ⟺ 4·kx·ln(x + ca) = 0.
// Значит x = 0 (нужно ОДЗ: ca > 0) или x + ca = 1, то есть x = 1 − ca (ОДЗ выполняется само).
function build16({ c, L, R: Rr }) {   // k на ответ не влияет: множитель kx обнуляется там же, где x
  const inSeg = (x) => Rcmp(x, R(L)) >= 0 && Rcmp(x, R(Rr)) <= 0
  const solve = (a) => {
    const good = []
    if (Rsign(Rmul(R(c), a)) > 0 && inSeg(R0)) good.push(R0)
    const x = Rsub(R1, Rmul(R(c), a))
    if (inSeg(x) && !good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    return good.length
  }
  const crit = [R0, R(1 - L, c), R(1 - Rr, c), R(1, c)]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T16 = [[2, 2, 0, 1], [2, 1, 0, 1], [3, 2, 0, 1], [2, 2, 0, 2], [1, 2, 0, 1], [2, 3, 0, 1], [3, 1, 0, 2], [2, 4, 0, 2]]
  .map(([k, c, L, R]) => ({ k, c, L, R }))
export function t18SqEqLog() {
  const par = pick(T16), { k, c, L, R: Rr } = par
  const { set, solve } = build16(par)
  const arg = `x + ${c === 1 ? "" : c}a`
  return item({
    text: `Найдите все значения a, при которых уравнение\n\n(${k === 1 ? "" : k}x + ln(${arg}))${SUP[2]} = (${k === 1 ? "" : k}x ${MINUS} ln(${arg}))${SUP[2]}\n\nимеет единственный корень на отрезке [${nS(L)}; ${Rr}].`,
    set,
    solution: `Раскрывая квадраты, получаем 4·${k === 1 ? "" : k}x·ln(${arg}) = 0, то есть x = 0 или ln(${arg}) = 0.\n`
      + `Первый корень x = 0 годится только при выполнении ОДЗ: ${c === 1 ? "" : c}a > 0.\n`
      + `Второй: ${arg} = 1, то есть x = 1 ${MINUS} ${c === 1 ? "" : c}a; ОДЗ там выполняется автоматически.\n`
      + `Нужно, чтобы ровно один из них лежал на отрезке [${nS(L)}; ${Rr}] (при ${c === 1 ? "" : c}a = 1 они совпадают).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => {
        const t = x + c * a
        if (t <= 0) return null
        return Math.pow(k * x + Math.log(t), 2) - Math.pow(k * x - Math.log(t), 2)
      },
      sols: (a) => {
        const out = []
        if (c * a > 1e-12 && 0 >= L - 1e-12 && 0 <= Rr + 1e-12) out.push(0)
        const x = 1 - c * a
        if (x >= L - 1e-12 && x <= Rr + 1e-12 && !out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
        return out
      },
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (c * a > 0 ? 0 : null), label: "x = 0 (при ОДЗ)" },
        { f: (a) => 1 - c * a, label: `x = 1 ${MINUS} ${c === 1 ? "" : c}a` },
        { f: () => L, dash: true, label: "отрезок" }, { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 2, xMax: Rr + 2, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #19. (x² − t² + √(kx − a))² = (x² − t²)² + kx − a.
// Раскрывая: 2(x² − t²)√(kx − a) = 0, то есть x = ±t (при ОДЗ kx − a ≥ 0) или kx − a = 0.
function build19({ t, k, L, R: Rr }) {
  const inSeg = (x) => Rcmp(x, R(L)) >= 0 && Rcmp(x, R(Rr)) <= 0
  const solve = (a) => {
    const good = []
    for (const x of [R(t), R(-t)]) if (inSeg(x) && Rcmp(Rmul(R(k), x), a) >= 0) good.push(x)
    const x0 = Rdiv(a, R(k))
    if (inSeg(x0) && !good.some((y) => Rcmp(y, x0) === 0)) good.push(x0)
    return good.length
  }
  const crit = [R(k * t), R(-k * t), R(k * L), R(k * Rr)]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T19 = [[2, 2, 0, 3], [2, 1, 0, 3], [3, 2, 0, 4], [1, 2, 0, 2], [2, 3, 0, 3], [3, 1, 0, 4], [2, 2, -1, 3], [1, 3, 0, 2]]
  .map(([t, k, L, R]) => ({ t, k, L, R }))
export function t18SqEqSqrt() {
  const par = pick(T19), { t, k, L, R: Rr } = par
  const { set, solve } = build19(par)
  const A = `x${SUP[2]} ${MINUS} ${t * t}`
  return item({
    text: `Найдите все значения a, при которых уравнение\n\n(${A} + ⟦r:${k === 1 ? "" : k}x ${MINUS} a⟧)${SUP[2]} = (${A})${SUP[2]} + ${k === 1 ? "" : k}x ${MINUS} a\n\n${ONE_SOL_SEG(L, Rr)}`,
    set,
    solution: `Слева (${A})${SUP[2]} + 2(${A})√(${k === 1 ? "" : k}x ${MINUS} a) + (${k === 1 ? "" : k}x ${MINUS} a). Сокращая, получаем 2(${A})√(${k === 1 ? "" : k}x ${MINUS} a) = 0.\n`
      + `Отсюда x = ${t} или x = ${MINUS}${t} (каждый годится при ОДЗ ${k === 1 ? "" : k}x ${MINUS} a ≥ 0), либо ${k === 1 ? "" : k}x ${MINUS} a = 0, то есть x = ${Rstr(R(1, k))}a.\n`
      + `Нужно ровно одно такое решение на отрезке [${nS(L)}; ${Rr}].\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => {
        const b = k * x - a
        if (b < -EPS) return null
        const A2 = x * x - t * t
        return Math.pow(A2 + sqrtSafe(b), 2) - A2 * A2 - b
      },
      sols: (a) => {
        const out = []
        for (const x of [t, -t]) if (x >= L - 1e-12 && x <= Rr + 1e-12 && k * x - a >= -1e-12) out.push(x)
        const x0 = a / k
        if (x0 >= L - 1e-12 && x0 <= Rr + 1e-12 && !out.some((y) => Math.abs(y - x0) < 1e-9)) out.push(x0)
        return out
      },
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => t, label: `x = ${t}` }, { f: () => -t, label: `x = ${MINUS}${t}` },
        { f: (a) => a / k, label: `x = a/${k}` },
        { f: () => Rr, dash: true, label: "отрезок" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: Math.min(L, -t) - 2, xMax: Rr + 2, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #14. (kx + a + 1 + tg x)² = (kx + a − 1 − tg x)² ⟺ 4(1 + tg x)(kx + a) = 0.
// Значит tg x = −1 (на (−π/2; π/2) это единственная точка x = −π/4) или a = −kx.
// Всё считается В ЕДИНИЦАХ π: x = πs, a = πu — тогда арифметика снова рациональная,
// а ответ печатается как «−π», «π/2» и т. п. (unit: "pi").
function build14({ k }) {
  const inInt = (sv) => Rcmp(sv, R(-1, 2)) > 0 && Rcmp(sv, R(1, 2)) < 0     // ОДЗ тангенса
  const s0 = R(-1, 4)                                                       // tg x = −1
  const solve = (u) => {
    const good = [s0]
    const s1 = Rdiv(Rneg(u), R(k))
    if (inInt(s1) && Rcmp(s1, s0) !== 0) good.push(s1)
    return good.length
  }
  const crit = [R(k, 2), R(-k, 2), R(k, 4)]
  return { set: assembleSet((u) => solve(u) === 1, crit), solve }
}
const T14 = [[2], [3], [4], [1], [6]].map(([k]) => ({ k }))
export function t18SqEqTan() {
  const par = pick(T14), { k } = par
  const { set, solve } = build14(par)
  const kx = `${k === 1 ? "" : k}x`
  return item({
    text: `Найдите все значения a, при которых уравнение\n\n(${kx} + a + 1 + tg x)${SUP[2]} = (${kx} + a ${MINUS} 1 ${MINUS} tg x)${SUP[2]}\n\nимеет единственное решение на отрезке [${MINUS}⟦f:π:2⟧; ⟦f:π:2⟧].`,
    set,
    unit: "pi",
    solution: `Разность квадратов: (A ${MINUS} B)(A + B) = 0, где A ${MINUS} B = 2(1 + tg x), A + B = 2(${kx} + a).\n`
      + `Первый множитель даёт tg x = ${MINUS}1; на промежутке (${MINUS}π/2; π/2) это ровно один корень x = ${MINUS}π/4 (концы отрезка не входят в ОДЗ тангенса).\n`
      + `Второй даёт x = ${MINUS}a/${k}; он попадает в промежуток при ${MINUS}${Rstr(R(k, 2))}π < a < ${Rstr(R(k, 2))}π и совпадает с ${MINUS}π/4 при a = ${Rstr(R(k, 4))}π.\n`
      + `Значит решение единственно, когда второй корень либо вне промежутка, либо совпал с первым.\nОтвет: ${setToString(set, "pi")}.`,
    predicate: { type: "count", n: 1 },
    solve: (u) => solve(u),
    raw: {
      seg: [-Math.PI / 2 + 1e-6, Math.PI / 2 - 1e-6],
      F: (u) => (x) => {
        const a = u * Math.PI, t = Math.tan(x)
        return Math.pow(k * x + a + 1 + t, 2) - Math.pow(k * x + a - 1 - t, 2)
      },
      sols: (u) => {
        const a = u * Math.PI, out = [-Math.PI / 4]
        const x1 = -a / k
        if (x1 > -Math.PI / 2 + 1e-9 && x1 < Math.PI / 2 - 1e-9 && Math.abs(x1 + Math.PI / 4) > 1e-9) out.push(x1)
        return out
      },
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => -0.25, label: "x = −π/4 (в единицах π)" },
        { f: (u) => -u / k, label: `x = −a/${k}` },
        { f: () => -0.5, dash: true, label: "ОДЗ тангенса" }, { f: () => 0.5, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1.2, xMax: 1.2, aMin: Rnum(setBounds(set)[0]) - 1.5,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 1.5,
    },
  })
}

// #23. (x² + √(a − x))² = (px + q + √(a − x))² ⟺ (A − B)(A + B) = 0.
// A − B = x² − px − q — берём (p, q) так, чтобы корни были целыми (r₁, r₂), а второй множитель
// A + B = x² + px + q + 2√(a − x) НЕ обращался в нуль: при r₁² + 6r₁r₂ + r₂² < 0 трёхчлен
// x² + px + q положителен при всех x, и вторая ветвь пуста. Остаются x = r₁, r₂ при ОДЗ x ≤ a.
function build23({ r1, r2, L, R: Rr }) {
  const inSeg = (x) => Rcmp(x, R(L)) >= 0 && Rcmp(x, R(Rr)) <= 0
  const solve = (a) => {
    let n = 0
    for (const r of [R(r1), R(r2)]) if (inSeg(r) && Rcmp(r, a) <= 0) n++
    return n
  }
  const crit = [R(r1), R(r2)]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T23 = [[2, -1, -1, 1], [1, -1, -1, 1], [3, -1, -1, 3], [1, -2, -2, 1], [2, -1, 0, 2], [3, -2, -2, 3], [1, -3, -3, 1], [4, -1, -1, 4]]
  .filter(([r1, r2]) => r1 * r1 + 6 * r1 * r2 + r2 * r2 < 0)
  .map(([r1, r2, L, R]) => ({ r1, r2, L, R }))
export function t18SqEqSqrtBoth() {
  const par = pick(T23), { r1, r2, L, R: Rr } = par
  const { set, solve } = build23(par)
  const p = r1 + r2, q = -r1 * r2
  const lin = `${p === 0 ? "" : p === 1 ? "x + " : p === -1 ? MINUS + "x + " : `${nS(p)}x + `}${q}`
  return item({
    text: `Найдите все значения a, при каждом из которых уравнение\n\n(x${SUP[2]} + ⟦r:a ${MINUS} x⟧)${SUP[2]} = (${lin} + ⟦r:a ${MINUS} x⟧)${SUP[2]}\n\nимеет единственный корень на отрезке [${nS(L)}; ${nS(Rr)}].`,
    set,
    solution: `Разность квадратов: (A ${MINUS} B)(A + B) = 0, где A ${MINUS} B = x${SUP[2]} ${MINUS} ${p === 0 ? "" : `${nS(p)}x ${MINUS} `}${q}, `
      + `A + B = x${SUP[2]} + ${p === 0 ? "" : `${nS(p)}x + `}${q} + 2√(a ${MINUS} x).\n`
      + `Второй множитель положителен при всех x (дискриминант трёхчлена x${SUP[2]} + ${p === 0 ? "" : `${nS(p)}x + `}${q} отрицателен, а корень неотрицателен), поэтому решения даёт только первый: x = ${r1} и x = ${nS(r2)}.\n`
      + `Каждый годится при ОДЗ a ${MINUS} x ≥ 0, то есть x ≤ a, и при попадании на отрезок [${nS(L)}; ${nS(Rr)}].\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => {
        if (a - x < -EPS) return null
        const r = sqrtSafe(a - x)
        return Math.pow(x * x + r, 2) - Math.pow(p * x + q + r, 2)
      },
      sols: (a) => [r1, r2].filter((x) => x >= L - 1e-12 && x <= Rr + 1e-12 && x <= a + 1e-12),
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => r1, label: `x = ${r1}` }, { f: () => r2, label: `x = ${nS(r2)}` },
        { f: (a) => a, dash: true, label: "ОДЗ: x ≤ a" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 2, xMax: Rr + 2, aMin: Rnum(setBounds(set)[0]) - 4,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// =============================================================================
// РАЗДЕЛ D. f·ln g = f·ln h — «ровно один корень» (эталон #17, #18, #25–#27, #29–#32)
// =============================================================================
// Общий приём: уравнение равносильно f(x)·(ln g − ln h) = 0 при ОДЗ, где ВСЕ участвующие
// выражения определены. Кандидаты — нуль множителя f и решение g = h; каждый проверяется
// на ОДЗ и попадание в отрезок. Все кандидаты рациональны, поэтому счёт точный.
const ONE_ROOT_SEG_T = (L, R) => `имеет ровно один корень на отрезке [${nS(L)}; ${nS(R)}].`

// #17. (kx − c)·ln(x + a) = (kx − c)·ln(px − a). ОДЗ: x + a > 0 и px − a > 0.
// Кандидаты: x = c/k (нуль множителя) и x + a = px − a, то есть x = 2a/(p − 1).
function build17({ k, c, p, L, R: Rr }) {
  const inSeg = (x) => Rcmp(x, R(L)) >= 0 && Rcmp(x, R(Rr)) <= 0
  const odz = (a, x) => Rsign(Radd(x, a)) > 0 && Rsign(Rsub(Rmul(R(p), x), a)) > 0
  const solve = (a) => {
    const good = []
    const x1 = R(c, k), x2 = Rdiv(Rmul(R(2), a), R(p - 1))
    for (const x of [x1, x2]) if (inSeg(x) && odz(a, x) && !good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    return good.length
  }
  const crit = [R(-c, k), R(p * c, k), R(L * (p - 1), 2), R(Rr * (p - 1), 2), R0, R(c * (p - 1), 2 * k)]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T17 = [[5, 2, 2, 0, 1], [3, 1, 2, 0, 1], [4, 3, 3, 0, 2], [5, 2, 3, 0, 1], [2, 1, 2, 0, 2], [6, 3, 2, 0, 1], [4, 1, 3, 0, 1], [3, 2, 4, 0, 2]]
  .map(([k, c, p, L, R]) => ({ k, c, p, L, R }))
export function t18LogFactorLin() {
  const par = pick(T17), { k, c, p, L, R: Rr } = par
  const { set, solve } = build17(par)
  const f = `(${k}x ${MINUS} ${c})`
  return item({
    text: `${HEAD_A}\n\n${f} · ln(x + a) = ${f} · ln(${p}x ${MINUS} a)\n\n${ONE_ROOT_SEG_T(L, Rr)}`,
    set,
    solution: `ОДЗ: x + a > 0 и ${p}x ${MINUS} a > 0. Уравнение равносильно ${f}(ln(x + a) ${MINUS} ln(${p}x ${MINUS} a)) = 0.\n`
      + `Первый множитель даёт x = ${Rstr(R(c, k))}, второй — равенство аргументов x + a = ${p}x ${MINUS} a, то есть x = ${Rstr(R(2, p - 1))}a.\n`
      + `Каждый кандидат годится, только если попадает на отрезок [${nS(L)}; ${Rr}] и удовлетворяет ОДЗ; при a = ${Rstr(R(c * (p - 1), 2 * k))} они совпадают.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => (x + a > 0 && p * x - a > 0 ? (k * x - c) * (Math.log(x + a) - Math.log(p * x - a)) : null),
      sols: (a) => [c / k, (2 * a) / (p - 1)]
        .filter((x, i, arr) => arr.findIndex((y) => Math.abs(y - x) < 1e-9) === i)
        .filter((x) => x >= L - 1e-12 && x <= Rr + 1e-12 && x + a > 1e-12 && p * x - a > 1e-12),
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => c / k, label: `x = ${Rstr(R(c, k))}` },
        { f: (a) => (2 * a) / (p - 1), label: `x = ${Rstr(R(2, p - 1))}a` },
        { f: (a) => -a, dash: true, label: "границы ОДЗ" }, { f: (a) => a / p, dash: true },
        { f: () => L, dash: true }, { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 3, xMax: Rr + 3, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #18. ln(qa − x)·ln(2x + ra − r) = ln(qa − x)·ln(x − a). ОДЗ: все три аргумента положительны.
// Кандидаты: qa − x = 1 (нуль первого логарифма) и 2x + ra − r = x − a, то есть x = r − (r+1)a.
function build18({ q, r, L, R: Rr }) {
  const inSeg = (x) => Rcmp(x, R(L)) >= 0 && Rcmp(x, R(Rr)) <= 0
  const A = (a, x) => Rsub(Rmul(R(q), a), x)
  const B = (a, x) => Rsub(Radd(Rmul(R(2), x), Rmul(R(r), a)), R(r))
  const C = (a, x) => Rsub(x, a)
  const okAll = (a, x) => Rsign(A(a, x)) > 0 && Rsign(B(a, x)) > 0 && Rsign(C(a, x)) > 0
  const solve = (a) => {
    const good = []
    const x1 = Rsub(Rmul(R(q), a), R1)                 // ln(qa − x) = 0
    const x2 = Rsub(R(r), Rmul(R(r + 1), a))           // 2x + ra − r = x − a
    for (const x of [x1, x2]) if (inSeg(x) && okAll(a, x) && !good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    return good.length
  }
  // критические значения: концы отрезка для обоих кандидатов, коэффициенты обращения ОДЗ
  // в нуль для каждого кандидата (B и C при x₁, A, B и C при x₂) и совпадение кандидатов
  const crit = [
    R(L + 1, q), R(Rr + 1, q),                 // x₁ = qa − 1 на концах отрезка
    R(r - Rr, r + 1), R(r - L, r + 1),         // x₂ = r − (r+1)a на концах отрезка
    R(2 + r, 2 * q + r), R(1, q - 1),          // ОДЗ при x₁: B > 0 и C > 0
    R(r, q + r + 1), R(r, r + 2),              // ОДЗ при x₂: A > 0 и B = C > 0
    R(r + 1, q + r + 1),                       // x₁ = x₂
  ]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T18 = [[6, 2, 0, 1], [4, 2, 0, 1], [6, 1, 0, 1], [5, 2, 0, 2], [8, 3, 0, 1], [6, 3, 0, 2], [4, 1, 0, 1], [10, 2, 0, 2]]
  .map(([q, r, L, R]) => ({ q, r, L, R }))
export function t18LogFactorLog() {
  const par = pick(T18), { q, r, L, R: Rr } = par
  const { set, solve } = build18(par)
  const f = `ln(${q}a ${MINUS} x)`
  return item({
    text: `${HEAD_A}\n\n${f}·ln(2x + ${r === 1 ? "" : r}a ${MINUS} ${r}) = ${f}·ln(x ${MINUS} a)\n\n${ONE_ROOT_SEG_T(L, Rr)}`,
    set,
    solution: `ОДЗ: ${q}a ${MINUS} x > 0, 2x + ${r === 1 ? "" : r}a ${MINUS} ${r} > 0 и x ${MINUS} a > 0.\n`
      + `Уравнение равносильно ${f}·(ln(2x + ${r === 1 ? "" : r}a ${MINUS} ${r}) ${MINUS} ln(x ${MINUS} a)) = 0.\n`
      + `Первый множитель обнуляется при ${q}a ${MINUS} x = 1, то есть x = ${q}a ${MINUS} 1; второй — при равенстве аргументов, то есть x = ${r} ${MINUS} ${r + 1}a.\n`
      + `Считаем, сколько кандидатов одновременно лежат на отрезке [${nS(L)}; ${Rr}] и удовлетворяют ОДЗ.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => {
        const A1 = q * a - x, B1 = 2 * x + r * a - r, C1 = x - a
        if (A1 <= 0 || B1 <= 0 || C1 <= 0) return null
        return Math.log(A1) * (Math.log(B1) - Math.log(C1))
      },
      sols: (a) => [q * a - 1, r - (r + 1) * a]
        .filter((x, i, arr) => arr.findIndex((y) => Math.abs(y - x) < 1e-9) === i)
        .filter((x) => x >= L - 1e-12 && x <= Rr + 1e-12 && q * a - x > 1e-12 && 2 * x + r * a - r > 1e-12 && x - a > 1e-12),
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => q * a - 1, label: `x = ${q}a ${MINUS} 1` },
        { f: (a) => r - (r + 1) * a, label: `x = ${r} ${MINUS} ${r + 1}a` },
        { f: (a) => a, dash: true, label: "ОДЗ: x > a" },
        { f: () => L, dash: true }, { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 3, xMax: Rr + 3, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #26. √(kx − c)·ln(px − a) = √(kx − c)·ln(qx + a). ОДЗ: kx − c ≥ 0, px − a > 0, qx + a > 0.
// Кандидаты: x = c/k (нуль корня) и px − a = qx + a, то есть x = 2a/(p − q).
function build26({ k, c, p, q, L, R: Rr }) {
  const inSeg = (x) => Rcmp(x, R(L)) >= 0 && Rcmp(x, R(Rr)) <= 0
  const okLogs = (a, x) => Rsign(Rsub(Rmul(R(p), x), a)) > 0 && Rsign(Radd(Rmul(R(q), x), a)) > 0
  const okRoot = (a, x) => Rsign(Rsub(Rmul(R(k), x), R(c))) >= 0
  const solve = (aa) => {
    const good = []
    const x1 = R(c, k), x2 = Rdiv(Rmul(R(2), aa), R(p - q))
    for (const x of [x1, x2]) if (inSeg(x) && okRoot(aa, x) && okLogs(aa, x) && !good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    return good.length
  }
  const crit = [R(p * c, k), R(-q * c, k), R(L * (p - q), 2), R(Rr * (p - q), 2), R(c * (p - q), 2 * k),
    R(0), R(c * (p - q), 2 * k)]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T26 = [[2, 1, 4, 5, 0, 1], [2, 1, 5, 4, 0, 1], [3, 1, 4, 2, 0, 1], [2, 1, 3, 5, 0, 2], [4, 1, 5, 3, 0, 1], [2, 3, 4, 2, 0, 3], [3, 2, 5, 3, 0, 2], [2, 1, 6, 4, 0, 1]]
  .map(([k, c, p, q, L, R]) => ({ k, c, p, q, L, R }))
export function t18LogFactorSqrt() {
  const par = pick(T26), { k, c, p, q, L, R: Rr } = par
  const { set, solve } = build26(par)
  const f = `⟦r:${k === 1 ? "" : k}x ${MINUS} ${c}⟧`
  return item({
    text: `${HEAD_A}\n\n${f} · ln(${p}x ${MINUS} a) = ${f} · ln(${q}x + a)\n\n${ONE_ROOT_SEG_T(L, Rr)}`,
    set,
    solution: `ОДЗ: ${k === 1 ? "" : k}x ${MINUS} ${c} ≥ 0, ${p}x ${MINUS} a > 0 и ${q}x + a > 0.\n`
      + `Уравнение равносильно √(${k === 1 ? "" : k}x ${MINUS} ${c})·(ln(${p}x ${MINUS} a) ${MINUS} ln(${q}x + a)) = 0.\n`
      + `Корень обнуляется при x = ${Rstr(R(c, k))} (там оба логарифма обязаны быть определены), равенство аргументов даёт x = ${Rstr(R(2, p - q))}a.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => {
        const r0 = k * x - c, u = p * x - a, v = q * x + a
        if (r0 < -EPS || u <= 0 || v <= 0) return null
        return sqrtSafe(r0) * (Math.log(u) - Math.log(v))
      },
      sols: (a) => [c / k, (2 * a) / (p - q)]
        .filter((x, i, arr) => arr.findIndex((y) => Math.abs(y - x) < 1e-9) === i)
        .filter((x) => x >= L - 1e-12 && x <= Rr + 1e-12 && k * x - c >= -1e-12 && p * x - a > 1e-12 && q * x + a > 1e-12),
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => c / k, label: `x = ${Rstr(R(c, k))}` },
        { f: (a) => (2 * a) / (p - q), label: `x = ${Rstr(R(2, p - q))}a` },
        { f: (a) => a / p, dash: true, label: "границы ОДЗ" }, { f: (a) => -a / q, dash: true },
        { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 3, xMax: Rr + 3, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #25 / #29. √(c − kx)·ln(m²x² − a²) = √(c − kx)·ln(mx + a).
// ln((mx−a)(mx+a)) = ln(mx+a) при mx + a > 0 даёт mx − a = 1. Кандидаты: x = c/k и x = (a+1)/m.
// #25 — без ограничения на отрезок, #29 — тот же типаж с отрезком.
function build25({ c, k, m, seg }) {
  const inSeg = (x) => !seg || (Rcmp(x, R(seg[0])) >= 0 && Rcmp(x, R(seg[1])) <= 0)
  const okAll = (a, x) => Rsign(Rsub(R(c), Rmul(R(k), x))) >= 0
    && Rsign(Rsub(Rmul(Rmul(R(m), x), Rmul(R(m), x)), Rmul(a, a))) > 0
    && Rsign(Radd(Rmul(R(m), x), a)) > 0
  const solve = (a) => {
    const good = []
    for (const x of [R(c, k), Rdiv(Radd(a, R1), R(m))]) {
      if (inSeg(x) && okAll(a, x) && !good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    }
    return good.length
  }
  const crit = [R(m * c, k), R(-m * c, k), R(-1, 2), R(m * c - k, k)]
  if (seg) crit.push(R(m * seg[0] - 1), R(m * seg[1] - 1))
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
function item25(par, seg) {
  const { c, k, m } = par
  const { set, solve } = build25({ ...par, seg })
  const f = `⟦r:${c} ${MINUS} ${k === 1 ? "" : k}x⟧`
  const tail = seg ? `\n\n${ONE_ROOT_SEG_T(seg[0], seg[1])}` : "\n\nимеет ровно один корень."
  return item({
    text: `${HEAD_A}\n\n${f}·ln(${m * m}x${SUP[2]} ${MINUS} a${SUP[2]}) = ${f}·ln(${m}x + a)${tail}`,
    set,
    solution: `ОДЗ: ${c} ${MINUS} ${k === 1 ? "" : k}x ≥ 0, ${m * m}x${SUP[2]} ${MINUS} a${SUP[2]} > 0 и ${m}x + a > 0.\n`
      + `Так как ${m * m}x${SUP[2]} ${MINUS} a${SUP[2]} = (${m}x ${MINUS} a)(${m}x + a), равенство логарифмов при ${m}x + a > 0 равносильно ${m}x ${MINUS} a = 1, то есть x = ${Rstr(R(1, m))}(a + 1).\n`
      + `Второй кандидат — нуль корня x = ${Rstr(R(c, k))}, он годится, когда оба логарифма там определены.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: seg || [-6, c / k],
      F: (a) => (x) => {
        const r0 = c - k * x, u = m * m * x * x - a * a, v = m * x + a
        if (r0 < -EPS || u <= 0 || v <= 0) return null
        return sqrtSafe(r0) * (Math.log(u) - Math.log(v))
      },
      sols: (a) => [c / k, (a + 1) / m]
        .filter((x, i, arr) => arr.findIndex((y) => Math.abs(y - x) < 1e-9) === i)
        .filter((x) => (!seg || (x >= seg[0] - 1e-12 && x <= seg[1] + 1e-12))
          && c - k * x >= -1e-12 && m * m * x * x - a * a > 1e-12 && m * x + a > 1e-12),
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => c / k, label: `x = ${Rstr(R(c, k))}` },
        { f: (a) => (a + 1) / m, label: `x = (a + 1)/${m}` },
        { f: (a) => -a / m, dash: true, label: "границы ОДЗ" }, { f: (a) => a / m, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -3, xMax: c / k + 4, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}
const T25 = [[2, 3, 4], [3, 2, 4], [5, 2, 3], [4, 1, 2], [3, 1, 3], [6, 4, 2], [5, 3, 4], [4, 3, 5]]
  .map(([c, k, m]) => ({ c, k, m }))
export function t18LogSqrtNoSeg() { return item25(pick(T25), null) }
export function t18LogSqrtSeg() { return item25(pick(T25), [0, 1]) }

// #30. √(kx − c)·ln((x − m)² + 1 − a²) = 0 — произведение корня и логарифма равно нулю.
// Кандидаты: x = c/k (нужно, чтобы аргумент логарифма был положителен) и (x − m)² = a², то есть x = m ± a.
function build30({ k, c, m, L, R: Rr, v }) {
  const inSeg = (x) => Rcmp(x, R(L)) >= 0 && Rcmp(x, R(Rr)) <= 0
  const arg = (a, x) => Radd(Rsub(Rmul(Rsub(x, R(m)), Rsub(x, R(m))), Rmul(a, a)), R1)
  const solve = (a) => {
    const good = []
    const x0 = R(c, k)
    if (inSeg(x0) && Rsign(arg(a, x0)) > 0) good.push(x0)
    for (const x of [Radd(R(m), a), Rsub(R(m), a)]) {
      if (inSeg(x) && Rsign(Rsub(Rmul(R(k), x), R(c))) >= 0 && !good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    }
    return good.length
  }
  const crit = [v, Rneg(v), R0, R(L - m), R(Rr - m), R(m - L), R(m - Rr),
    Rsub(R(c, k), R(m)), Rsub(R(m), R(c, k))]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
// (c/k − m)² + 1 должно быть точным квадратом рационального: берём c/k = m − u из пар (u, v)
const UV30 = [[R(3, 4), R(5, 4)], [R(4, 3), R(5, 3)], [R(5, 12), R(13, 12)], [R(12, 5), R(13, 5)], [R(8, 15), R(17, 15)]]
const T30 = []
for (const [u, v] of UV30) for (const m of [1, 2, 3]) for (const [L, Rr] of [[0, 1], [0, 2], [0, 3], [0, 4]]) {
  const ck = Rsub(R(m), u)                                  // c/k
  if (ck.n <= 0n || ck.d > 12n) continue
  const par = { k: Number(ck.d), c: Number(ck.n), m, L, R: Rr, v }
  const res = build30(par)                                 // отбрасываем вырожденные наборы
  if (!setBounds(res.set).length || !niceSet(res.set, 12n, 40n, 1, 5)) continue
  T30.push(par)
}
export function t18SqrtTimesLog() {
  const par = pick(T30), { k, c, m, L, R: Rr } = par
  const { set, solve } = build30(par)
  return item({
    text: `${HEAD_A}\n\n⟦r:${k === 1 ? "" : k}x ${MINUS} ${c}⟧·ln(x${SUP[2]} ${MINUS} ${2 * m === 1 ? "" : 2 * m}x + ${m * m + 1} ${MINUS} a${SUP[2]}) = 0\n\n${ONE_ROOT_SEG_T(L, Rr)}`,
    set,
    solution: `Аргумент логарифма равен (x ${MINUS} ${m})${SUP[2]} + 1 ${MINUS} a${SUP[2]}.\n`
      + `Произведение равно нулю, если ${k === 1 ? "" : k}x ${MINUS} ${c} = 0, то есть x = ${Rstr(R(c, k))} (логарифм там должен быть определён), `
      + `либо логарифм равен нулю: (x ${MINUS} ${m})${SUP[2]} + 1 ${MINUS} a${SUP[2]} = 1 ⟺ x = ${m} ± a (и тогда нужно ${k === 1 ? "" : k}x ${MINUS} ${c} ≥ 0).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => {
        const r0 = k * x - c, u = (x - m) * (x - m) + 1 - a * a
        if (r0 < -EPS || u <= 0) return null
        return sqrtSafe(r0) * Math.log(u)
      },
      sols: (a) => {
        const out = []
        const x0 = c / k
        if (x0 >= L - 1e-12 && x0 <= Rr + 1e-12 && (x0 - m) * (x0 - m) + 1 - a * a > 1e-12) out.push(x0)
        for (const x of [m + a, m - a]) {
          if (x >= L - 1e-12 && x <= Rr + 1e-12 && k * x - c >= -1e-12 && !out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
        }
        return out
      },
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => c / k, label: `x = ${Rstr(R(c, k))}` },
        { f: (a) => m + a, label: `x = ${m} + a` }, { f: (a) => m - a, label: `x = ${m} ${MINUS} a` },
        { f: () => Rr, dash: true, label: "отрезок" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 3, xMax: Rr + 3, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #31. √(x − a)·sin x = √(x − a)·cos x на [0; Qπ] — считаем В ЕДИНИЦАХ π.
// Кандидаты: x = a (нуль корня, если попал на отрезок) и tg x = 1, то есть x = π/4 + πn при x ≥ a.
function build31({ Q }) {
  const roots = []
  for (let n = 0; R(1 + 4 * n, 4).n <= BigInt(4 * Q); n++) roots.push(R(1 + 4 * n, 4))   // π/4 + πn ≤ Qπ
  const solve = (u) => {
    let cnt = 0
    if (Rsign(u) >= 0 && Rcmp(u, R(Q)) <= 0) cnt++                    // x = a
    for (const s of roots) if (Rcmp(s, u) >= 0 && Rcmp(s, u) !== 0) cnt++
    for (const s of roots) if (Rcmp(s, u) === 0) cnt++                // совпал с x = a — считаем один раз
    return cnt
  }
  const crit = [R0, R(Q), ...roots]
  return { set: assembleSet((u) => solve(u) === 1, crit), solve, roots }
}
const T31 = [[1], [2], [3]].map(([Q]) => ({ Q }))
export function t18SqrtTrigFactor() {
  const par = pick(T31), { Q } = par
  const { set, solve } = build31(par)
  const right = Q === 1 ? "π" : `${Q}π`
  return item({
    text: `${HEAD_A}\n\n⟦r:x ${MINUS} a⟧·sin x = ⟦r:x ${MINUS} a⟧·cos x\n\nимеет ровно один корень на отрезке [0; ${right}].`,
    set,
    unit: "pi",
    solution: `ОДЗ: x ≥ a. Уравнение равносильно √(x ${MINUS} a)(sin x ${MINUS} cos x) = 0.\n`
      + `Первый множитель даёт x = a — он годится, если a ∈ [0; ${right}].\n`
      + `Второй: tg x = 1, то есть x = π/4 + πn; на [0; ${right}] это ${roots31(Q)} — каждый годится при x ≥ a.\n`
      + `Ответ: ${setToString(set, "pi")}.`,
    predicate: { type: "count", n: 1 },
    solve: (u) => solve(u),
    raw: {
      seg: [0, Q * Math.PI],
      F: (u) => (x) => (x - u * Math.PI < -EPS ? null : sqrtSafe(x - u * Math.PI) * (Math.sin(x) - Math.cos(x))),
      sols: (u) => {
        const a = u * Math.PI, out = []
        if (a >= -1e-12 && a <= Q * Math.PI + 1e-12) out.push(a)
        for (let n = 0; Math.PI / 4 + Math.PI * n <= Q * Math.PI + 1e-12; n++) {
          const x = Math.PI / 4 + Math.PI * n
          if (x >= a - 1e-12 && !out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
        }
        return out
      },
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (u) => u, label: "x = a (в единицах π)" },
        { f: () => 0.25, dash: true, label: "tg x = 1" }, { f: () => 1.25, dash: true },
        { f: () => Q, dash: true, label: "правый конец" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: Q + 1, aMin: Rnum(setBounds(set)[0]) - 1.5,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 1.5,
    },
  })
}
const roots31 = (Q) => {
  const out = []
  for (let n = 0; 1 / 4 + n <= Q; n++) out.push(n === 0 ? "π/4" : `${4 * n + 1}π/4`)
  return out.join(", ")
}

// #32. tg(πx)·ln(x + a) = ln(x + a) ⟺ ln(x + a)(tg(πx) − 1) = 0.
// Кандидаты: x = 1 − a (нуль логарифма; в точках x = 1/2 + n тангенс не определён)
// и x = 1/4 + n (tg(πx) = 1) при ОДЗ x + a > 0. Здесь x рационален, единицы π не нужны.
function build32({ L, R: Rr }) {
  const tanRoots = []
  for (let n = Math.ceil(L - 1); n <= Rr + 1; n++) { const x = R(4 * n + 1, 4); if (Rcmp(x, R(L)) >= 0 && Rcmp(x, R(Rr)) <= 0) tanRoots.push(x) }
  const undef = (x) => { const t = Rsub(Rmul(x, R(2)), R1); return t.d === 2n ? false : (Rmul(Rsub(x, R(1, 2)), R1).d === 1n) }
  const solve = (a) => {
    const good = []
    const x1 = Rsub(R1, a)
    if (Rcmp(x1, R(L)) >= 0 && Rcmp(x1, R(Rr)) <= 0 && !undef(x1)) good.push(x1)
    for (const x of tanRoots) if (Rsign(Radd(x, a)) > 0 && !good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    return good.length
  }
  const crit = [R(1 - L), R(1 - Rr)]
  for (const x of tanRoots) { crit.push(Rneg(x)); crit.push(Rsub(R1, x)) }
  for (let n = Math.ceil(L - 2); n <= Rr + 2; n++) crit.push(Rsub(R1, R(2 * n + 1, 2)))   // 1 − a = 1/2 + n
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T32 = [[0, 1], [0, 2], [-1, 1], [0, 3], [-1, 2]].map(([L, R]) => ({ L, R }))
export function t18TanTimesLog() {
  const par = pick(T32), { L, R: Rr } = par
  const { set, solve } = build32(par)
  return item({
    text: `${HEAD_A}\n\ntg(πx)·ln(x + a) = ln(x + a)\n\n${ONE_ROOT_SEG_T(L, Rr)}`,
    set,
    solution: `Перенесём всё влево: ln(x + a)(tg(πx) ${MINUS} 1) = 0. ОДЗ: x + a > 0 и x ≠ ${Rstr(R(1, 2))} + n (там тангенс не определён).\n`
      + `Логарифм равен нулю при x + a = 1, то есть x = 1 ${MINUS} a; тангенс равен 1 при πx = π/4 + πn, то есть x = ${Rstr(R(1, 4))} + n.\n`
      + `Считаем, сколько таких x лежит на отрезке [${nS(L)}; ${Rr}] с учётом ОДЗ.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => {
        if (x + a <= 0) return null
        const d = x - Math.floor(x)
        if (Math.abs(d - 0.5) < 1e-12) return null      // полюс тангенса — точка вне ОДЗ
        return Math.log(x + a) * (Math.tan(Math.PI * x) - 1)
      },
      poles: () => { const out = []; for (let n = -6; n <= 8; n++) out.push(0.5 + n); return out },
      sols: (a) => {
        const out = []
        const x1 = 1 - a
        const frac = x1 - Math.floor(x1)
        if (x1 >= L - 1e-12 && x1 <= Rr + 1e-12 && Math.abs(frac - 0.5) > 1e-9) out.push(x1)
        for (let n = Math.ceil(L - 1); n <= Rr + 1; n++) {
          const x = 0.25 + n
          if (x >= L - 1e-12 && x <= Rr + 1e-12 && x + a > 1e-12 && !out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
        }
        return out
      },
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => 1 - a, label: `x = 1 ${MINUS} a` },
        { f: () => 0.25, dash: true, label: "tg(πx) = 1" }, { f: () => 1.25, dash: true },
        { f: (a) => -a, dash: true, label: "ОДЗ: x > −a" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 2, xMax: Rr + 2, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #27. √(x + ca)·ln(x − a) = (x − p)·ln(x − a) ⟺ ln(x − a)·(√(x + ca) − (x − p)) = 0.
// ОДЗ: x − a > 0 и x + ca ≥ 0. Кандидаты: x = a + 1 (нуль логарифма) и решения
// √(x + ca) = x − p, то есть x ≥ p и x² − (2p+1)x + p² − ca = 0.
function build27({ c, p, L, R: Rr }) {
  const quad = (a) => [Rsub(R(p * p), Rmul(R(c), a)), R(-(2 * p + 1)), R1]
  const solve = (a) => {
    let n = 0
    // ветвь 2: корни квадратного уравнения при x ≥ p и x > a на отрезке
    const I = ivCut(ivCut({ lo: R(p), hi: "+inf", incLo: true, incHi: false },
      { lo: a, hi: "+inf", incLo: false, incHi: false }), { lo: R(L), hi: R(Rr), incLo: true, incHi: true })
    if (!ivEmpty(I)) n += countRoots(quad(a), I.lo, I.hi, I.incLo, I.incHi)
    // ветвь 1: x = a + 1 (логарифм равен нулю) — при ОДЗ корня и попадании на отрезок
    const x1 = Radd(a, R1)
    if (Rcmp(x1, R(L)) >= 0 && Rcmp(x1, R(Rr)) <= 0 && Rsign(Radd(x1, Rmul(R(c), a))) >= 0) {
      const alsoBranch2 = Rzero(pEval(quad(a), x1)) && Rcmp(x1, R(p)) >= 0
      if (!alsoBranch2) n++
    }
    return n
  }
  const crit = [R(-1, c + 1), R(L - 1), R(Rr - 1), R(-p, c), R(-(4 * p + 1), 4 * c),
    R(L * L - (2 * p + 1) * L + p * p, c), R(Rr * Rr - (2 * p + 1) * Rr + p * p, c)]
  // корень ветви 2 попал на границу ОДЗ (x = a) и совпадение ветвей (x = a + 1):
  // берём рациональные корни; иррациональные (если они вообще влияют) отсеются проверкой сетки
  for (const E of [[R(p * p), R(-(2 * p + 1 + c)), R1], [R(p * p - 2 * p), R(1 - 2 * p - c), R1]]) {
    crit.push(...ratRoots(E).roots)
  }
  const set = assembleSet((a) => solve(a) === 1, crit)
  return { set, solve }
}
// Быстрая сеточная сверка при ОТБОРЕ наборов: набор берём в банк только если множество,
// собранное по критическим значениям, совпадает с предикатом на сетке (шаг 1/24).
function gridOk(set, solve, want = 1) {
  const b = setBounds(set).map(Rnum)
  if (!b.length) return false
  const lo = Math.floor(Math.min(...b)) - 4, hi = Math.ceil(Math.max(...b)) + 4
  for (let k = lo * 24; k <= hi * 24; k++) {
    const a = R(k, 24)
    if (inSet(set, a) !== (solve(a) === want)) return false
  }
  return true
}
// Наборы (c, p, L, R) отобраны разовым перебором: ответ круглый И совпал с предикатом на
// сетке (шаг 1/24) — то есть список критических значений полон. Зафиксированы литералом,
// чтобы импорт модуля оставался мгновенным; verify18 в смоуке проверяет каждый набор заново.
const T27 = [
  [1, 1, 0, 1], [1, 1, 0, 2], [1, 1, 0, 3], [1, 1, 1, 3], [1, 2, 0, 1], [1, 2, 0, 2], [1, 2, 0, 3], [1, 2, 1, 3], [1, 2, 0, 4],
  [1, 3, 0, 1], [1, 3, 0, 2], [1, 3, 0, 3], [1, 3, 1, 3], [1, 3, 0, 4], [1, 4, 0, 1], [1, 4, 0, 2], [1, 4, 0, 3], [1, 4, 1, 3],
  [1, 4, 0, 4], [1, 5, 0, 1], [1, 5, 0, 2], [1, 5, 0, 3], [1, 5, 1, 3], [1, 5, 0, 4], [2, 1, 0, 1], [2, 1, 0, 2], [2, 1, 0, 3],
  [2, 1, 1, 3], [2, 1, 0, 4], [2, 2, 0, 1], [2, 2, 0, 2], [2, 2, 0, 3], [2, 2, 1, 3], [2, 2, 0, 4], [2, 3, 0, 1], [2, 3, 0, 2],
  [2, 3, 0, 3], [2, 3, 1, 3], [2, 3, 0, 4], [2, 4, 0, 1], [2, 4, 0, 2], [2, 4, 0, 3], [2, 4, 1, 3], [2, 4, 0, 4], [2, 5, 0, 1],
  [2, 5, 0, 2], [2, 5, 0, 3], [2, 5, 1, 3], [2, 5, 0, 4], [3, 1, 0, 1], [3, 1, 0, 2], [3, 1, 0, 3], [3, 1, 1, 3], [3, 1, 0, 4],
  [3, 2, 0, 1], [3, 2, 0, 2], [3, 2, 0, 3], [3, 2, 1, 3], [3, 2, 0, 4], [3, 3, 0, 1], [3, 3, 0, 2], [3, 3, 0, 3], [3, 3, 1, 3],
  [3, 3, 0, 4], [3, 4, 0, 1], [3, 4, 0, 2], [3, 4, 0, 3], [3, 4, 1, 3], [3, 4, 0, 4], [3, 5, 0, 1], [3, 5, 0, 2], [3, 5, 0, 3],
  [3, 5, 1, 3], [3, 5, 0, 4], [4, 1, 0, 1], [4, 2, 0, 1], [4, 2, 0, 2], [4, 3, 0, 1], [4, 3, 0, 2], [4, 3, 0, 3], [4, 3, 1, 3],
  [4, 4, 0, 1], [4, 4, 0, 2], [4, 4, 0, 3], [4, 4, 1, 3], [4, 4, 0, 4], [4, 5, 0, 1], [4, 5, 0, 2], [4, 5, 0, 3], [4, 5, 1, 3],
  [4, 5, 0, 4], [6, 1, 0, 1], [6, 2, 0, 1], [6, 2, 0, 2], [6, 2, 0, 3], [6, 2, 1, 3], [6, 2, 0, 4], [6, 3, 0, 1], [6, 3, 0, 2],
  [6, 3, 0, 3], [6, 3, 1, 3], [6, 4, 0, 1], [6, 4, 0, 2], [6, 4, 0, 3], [6, 4, 1, 3], [6, 4, 0, 4], [6, 5, 0, 1], [6, 5, 0, 2],
  [6, 5, 0, 3], [6, 5, 1, 3], [6, 5, 0, 4]
].map(([c, p, L, R]) => ({ c, p, L, R }))
export function t18LogSqrtVsLin() {
  const par = pick(T27), { c, p, L, R: Rr } = par
  const { set, solve } = build27(par)
  return item({
    text: `${HEAD_A}\n\n⟦r:x + ${c === 1 ? "" : c}a⟧·ln(x ${MINUS} a) = (x ${MINUS} ${p})·ln(x ${MINUS} a)\n\n${ONE_ROOT_SEG_T(L, Rr)}`,
    set,
    solution: `ОДЗ: x ${MINUS} a > 0 и x + ${c === 1 ? "" : c}a ≥ 0. Перенесём всё влево: ln(x ${MINUS} a)·(√(x + ${c === 1 ? "" : c}a) ${MINUS} (x ${MINUS} ${p})) = 0.\n`
      + `Логарифм равен нулю при x ${MINUS} a = 1, то есть x = a + 1 (нужно, чтобы корень там был определён).\n`
      + `Второй множитель: √(x + ${c === 1 ? "" : c}a) = x ${MINUS} ${p}; это возможно лишь при x ≥ ${p}, и тогда x${SUP[2]} ${MINUS} ${2 * p + 1}x + ${p * p} ${MINUS} ${c === 1 ? "" : c}a = 0.\n`
      + `Считаем, сколько таких x лежит на отрезке [${nS(L)}; ${Rr}].\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: [L, Rr],
      F: (a) => (x) => {
        if (x - a <= 0 || x + c * a < -EPS) return null
        return Math.log(x - a) * (sqrtSafe(x + c * a) - (x - p))
      },
      sols: (a) => {
        const out = []
        const D = (2 * p + 1) * (2 * p + 1) - 4 * (p * p - c * a)
        if (D >= 0) for (const x of [(2 * p + 1 - Math.sqrt(D)) / 2, (2 * p + 1 + Math.sqrt(D)) / 2]) {
          if (x >= p - 1e-12 && x > a + 1e-12 && x >= L - 1e-12 && x <= Rr + 1e-12
            && !out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
        }
        const x1 = a + 1
        if (x1 >= L - 1e-12 && x1 <= Rr + 1e-12 && x1 + c * a >= -1e-12
          && !out.some((y) => Math.abs(y - x1) < 1e-9)) out.push(x1)
        return out
      },
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a + 1, label: "x = a + 1" },
        { f: (a) => { const D = (2 * p + 1) * (2 * p + 1) - 4 * (p * p - c * a); return D >= 0 ? (2 * p + 1 + Math.sqrt(D)) / 2 : null }, label: "√(x+ca) = x−p" },
        { f: (a) => a, dash: true, label: "ОДЗ: x > a" }, { f: () => p, dash: true, label: `x ≥ ${p}` },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 2, xMax: Rr + 3, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// =============================================================================
// РАЗДЕЛ E. Системы «лог/корень + кривая» — «ровно N решений» (эталон #33–#38)
// =============================================================================
// Логарифм (или корень) от одинаковых выражений даёт y² = k²x² плюс ОДЗ, вторая строка —
// окружность или пара прямых. Все решения системы — конечный набор точек, которые
// выписываются явно; счёт снова точный, без численного поиска.
const SUB = { 2: "₂", 3: "₃", 4: "₄", 5: "₅" }

// #33 / #35. {log_b(a − x²) = log_b(a − y²) | √(a − y²) = √(a − x²); x² + y² = 2px + 2qy}.
// Первая строка ⟺ y² = x² и a > x² (для логарифма) или a ≥ x² (для корня).
// Подстановка y = ±x в окружность даёт три точки: (0; 0), (p+q; p+q) и (p−q; −(p−q)).
function build33({ p, q, strict }) {
  const A = (p + q) * (p + q), B = (p - q) * (p - q)
  const ok = (a, v) => (strict ? Rcmp(a, R(v)) > 0 : Rcmp(a, R(v)) >= 0)
  const solve = (a) => [0, A, B].filter((v) => ok(a, v)).length
  const crit = [R0, R(A), R(B)]
  return { set: assembleSet((a) => solve(a) === 2, crit), solve, A, B }
}
function item33(par, kind) {
  const { p, q } = par
  const { set, solve, A, B } = build33(par)
  const b = kind === "log" ? pick([2, 3, 4, 5]) : null
  const left = kind === "log"
    ? `log${SUB[b]}(a ${MINUS} x${SUP[2]}) = log${SUB[b]}(a ${MINUS} y${SUP[2]})`
    : `⟦r:a ${MINUS} y${SUP[2]}⟧ = ⟦r:a ${MINUS} x${SUP[2]}⟧`
  const circle = `x${SUP[2]} + y${SUP[2]} = ${2 * p === 1 ? "" : 2 * p}x + ${2 * q === 1 ? "" : 2 * q}y`
  return item({
    text: `${HEAD_SYS} уравнений\n⟦cases:${left}¦${circle}⟧\n\nимеет ровно два различных решения.`,
    set,
    solution: `Первое уравнение равносильно y${SUP[2]} = x${SUP[2]} при ${kind === "log" ? "a > x" + SUP[2] : "a ≥ x" + SUP[2]} (аргументы должны быть ${kind === "log" ? "положительны" : "неотрицательны"}).\n`
      + `Подставляя y = x в окружность, получаем 2x${SUP[2]} = ${2 * (p + q)}x, то есть x = 0 или x = ${p + q}; при y = ${MINUS}x — x = 0 или x = ${nS(p - q)}.\n`
      + `Итого три точки: (0; 0), (${p + q}; ${p + q}) и (${nS(p - q)}; ${nS(-(p - q))}); они годятся при ${kind === "log" ? "a > 0, a > " + A + ", a > " + B : "a ≥ 0, a ≥ " + A + ", a ≥ " + B} соответственно.\n`
      + `Ровно два решения — когда выполняются ровно два из этих условий.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a >= 0 ? Math.sqrt(a) : null), label: "|x| = √a — граница ОДЗ" },
        { f: (a) => (a >= 0 ? -Math.sqrt(a) : null) },
        { f: () => p + q, dash: true, label: "точки системы" }, { f: () => p - q, dash: true }, { f: () => 0, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: Math.min(0, p - q) - 3, xMax: Math.max(0, p + q) + 3,
      aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}
const T33 = []
for (let p = 1; p <= 6; p++) for (let q = 1; q <= 6; q++) {
  if (p === q) continue                                  // иначе точка (p−q) сливается с началом
  const A = (p + q) * (p + q), B = (p - q) * (p - q)
  if (A === B || A > 60 || B === 0) continue
  T33.push({ p, q })
}
export function t18SysLogCircle() { return item33({ ...pick(T33), strict: true }, "log") }
export function t18SysSqrtCircle() { return item33({ ...pick(T33), strict: false }, "sqrt") }

// #34 / #37. {log_b(c² − y²) = log_b(c² − a²x²) | корень; x² + y² = 2px + 2qy}.
// Первая строка ⟺ y = ±ax при |y| < c (логарифм) или |y| ≤ c (корень).
// Подстановка в окружность даёт начало координат и по точке на каждой прямой.
function build34({ p, q, c, strict }) {
  const pts = (a) => {                                   // [x, y] всех решений, кроме проверки ОДЗ
    const d = Radd(R1, Rmul(a, a))
    const x1 = Rdiv(Rmul(R(2), Radd(R(p), Rmul(R(q), a))), d)
    const x2 = Rdiv(Rmul(R(2), Rsub(R(p), Rmul(R(q), a))), d)
    return [[R0, R0], [x1, Rmul(a, x1)], [x2, Rneg(Rmul(a, x2))]]
  }
  const okY = (y) => (strict ? Rcmp(Rmul(y, y), R(c * c)) < 0 : Rcmp(Rmul(y, y), R(c * c)) <= 0)
  const solve = (a) => {
    const good = []
    for (const [x, y] of pts(a)) {
      if (!okY(y)) continue
      if (!good.some(([u, v]) => Rcmp(u, x) === 0 && Rcmp(v, y) === 0)) good.push([x, y])
    }
    return good.length
  }
  const crit = [R0, R(p, q), R(-p, q)]
  // |a·x| = c для каждой из двух прямых: квадратные уравнения по a
  for (const sg of [1, -1]) for (const side of [1, -1]) {
    // a·2(p + sg·q·a) = side·c·(1 + a²)
    const E = [Rsub(R0, R(side * c)), Rsub(R(2 * p), R0), Rsub(R(2 * sg * q), R(side * c))]
    const { roots, allRational } = ratRoots(E)
    if (!allRational) return null
    crit.push(...roots)
  }
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
const T34 = []
for (let p = 1; p <= 5; p++) for (let q = 1; q <= 5; q++) for (const c of [2, 3, 4, 5, 6]) for (const strict of [true, false]) {
  const res = build34({ p, q, c, strict })
  if (!res || !niceSet(res.set, 12n, 40n, 1, 5)) continue
  if (!gridOk(res.set, res.solve, 2)) continue
  T34.push({ p, q, c, strict })
}
function item34(strict) {
  const cand = T34.filter((t) => t.strict === strict)
  const par = pick(cand), { p, q, c } = par
  const { set, solve } = build34(par)
  const b = strict ? pick([2, 3, 5]) : null
  const left = strict
    ? `log${SUB[b]}(${c * c} ${MINUS} y${SUP[2]}) = log${SUB[b]}(${c * c} ${MINUS} a${SUP[2]}x${SUP[2]})`
    : `⟦r:${c * c} ${MINUS} y${SUP[2]}⟧ = ⟦r:${c * c} ${MINUS} a${SUP[2]}x${SUP[2]}⟧`
  const circle = `x${SUP[2]} + y${SUP[2]} = ${2 * p === 1 ? "" : 2 * p}x + ${2 * q === 1 ? "" : 2 * q}y`
  return item({
    text: `${HEAD_SYS} уравнений\n⟦cases:${left}¦${circle}⟧\n\nимеет ровно два ${strict ? "решения" : "различных решения"}.`,
    set,
    solution: `Первое уравнение равносильно y${SUP[2]} = a${SUP[2]}x${SUP[2]} при ${strict ? "|y| < " + c : "|y| ≤ " + c}, то есть y = ax или y = ${MINUS}ax.\n`
      + `Подстановка y = ax в окружность даёт x(1 + a${SUP[2]}) = ${2 * p} + ${2 * q}a, то есть точку с x = (${2 * p} + ${2 * q}a)/(1 + a${SUP[2]}); аналогично для y = ${MINUS}ax.\n`
      + `Начало координат — решение всегда. Каждая из двух точек годится, если её ордината по модулю ${strict ? "меньше" : "не больше"} ${c}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (2 * (p + q * a)) / (1 + a * a), label: "x на прямой y = ax" },
        { f: (a) => (2 * (p - q * a)) / (1 + a * a), label: `x на прямой y = ${MINUS}ax` },
        { f: () => 0, dash: true, label: "начало координат" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2, xMax: 2 * p + 4, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}
export function t18SysLogSlope() { return item34(true) }
export function t18SysSqrtSlope() { return item34(false) }

// #36. {√(c² − y²) = √(c² − k²x²); xy + a² = ax + ay}.
// Вторая строка распадается: (x − a)(y − a) = 0. Первая даёт y = ±kx при |x| ≤ c/k.
function build36({ c, k }) {
  const solve = (a) => {
    const good = []
    const add = (x, y) => { if (!good.some(([u, v]) => Rcmp(u, x) === 0 && Rcmp(v, y) === 0)) good.push([x, y]) }
    const okX = (x) => Rcmp(Rmul(Rmul(R(k), x), Rmul(R(k), x)), R(c * c)) <= 0
    if (okX(a)) { add(a, Rmul(R(k), a)); add(a, Rneg(Rmul(R(k), a))) }      // прямая x = a
    for (const sg of [1, -1]) {                                             // прямая y = a
      const x = Rdiv(a, R(sg * k))
      if (okX(x)) add(x, a)
    }
    return good.length
  }
  const crit = [R0, R(c, k), R(-c, k), R(c), R(-c)]
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
// вырожденные наборы (пустой ответ) отсеиваем сразу, а полноту критических значений
// подтверждаем сеточной сверкой — как и в остальных таблицах
const T36 = [[2, 2], [2, 1], [3, 2], [4, 2], [3, 1], [6, 3], [4, 3], [5, 2], [6, 2], [8, 4], [9, 3], [10, 5], [6, 4], [8, 3]]
  .map(([c, k]) => ({ c, k }))
  .filter((par) => {
    const res = build36(par)
    return setBounds(res.set).length > 0 && niceSet(res.set, 12n, 40n, 1, 5) && gridOk(res.set, res.solve, 2)
  })
export function t18SysCrossLines() {
  const par = pick(T36), { c, k } = par
  const { set, solve } = build36(par)
  return item({
    text: `Найдите все значения параметра a, при которых система\n⟦cases:⟦r:${c * c} ${MINUS} y${SUP[2]}⟧ = ⟦r:${c * c} ${MINUS} ${k * k === 1 ? "" : k * k}x${SUP[2]}⟧¦xy + a${SUP[2]} = ax + ay⟧\n\nимеет ровно 2 решения.`,
    set,
    solution: `Второе уравнение: xy ${MINUS} ax ${MINUS} ay + a${SUP[2]} = (x ${MINUS} a)(y ${MINUS} a) = 0, то есть x = a или y = a.\n`
      + `Первое: ${c * c} ${MINUS} y${SUP[2]} = ${c * c} ${MINUS} ${k * k === 1 ? "" : k * k}x${SUP[2]} ≥ 0 ⟺ y = ±${k === 1 ? "" : k}x и |x| ≤ ${Rstr(R(c, k))}.\n`
      + `На прямой x = a получаем точки (a; ±${k === 1 ? "" : k}a) — они существуют при |a| ≤ ${Rstr(R(c, k))}; на прямой y = a — точки (±a/${k}; a) при |a| ≤ ${c}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a, label: "x = a" }, { f: (a) => a / k, label: `x = a/${k}` }, { f: (a) => -a / k },
        { f: () => c / k, dash: true, label: "|x| ≤ c/k" }, { f: () => -c / k, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -c - 2, xMax: c + 2, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #38. {√(2mx − x²) = √(2may − a²y²); y = x²} — слева и справа одна и та же функция
// f(t) = 2mt − t² от t = x и t = ay. Значит ax² = x или ax² = 2m − x, плюс ОДЗ 0 ≤ x ≤ 2m.
function build38({ m }) {
  const solve = (a) => {
    if (Rsign(a) <= 0) return 0                             // рассматриваем только a > 0
    const good = [R0]                                       // x = 0 всегда в ОДЗ
    const add = (x) => {
      if (Rsign(x) < 0 || Rcmp(x, R(2 * m)) > 0) return
      if (!good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    }
    add(Rdiv(R1, a))                                        // ax² = x
    // ax² + x − 2m = 0: считаем корни на [0; 2m] точно
    const n = countRoots([R(-2 * m), R1, a], R0, R(2 * m), true, true)
    // корни этого трёхчлена на [0; 2m] различны между собой; совпасть могут только с 1/a
    const dup = Rzero(pEval([R(-2 * m), R1, a], Rdiv(R1, a))) && Rcmp(Rdiv(R1, a), R(2 * m)) <= 0 ? 1 : 0
    return good.length + n - dup
  }
  const crit = [R0, R(1, 2 * m), R(1, m)]
  const set = minusPoints(assembleSet((a) => solve(a) === 3, crit), [])
  return { set, solve }
}
const T38 = [[1], [2], [3], [4]].map(([m]) => ({ m }))
export function t18SysParabola() {
  const par = pick(T38), { m } = par
  const { set, solve } = build38(par)
  return item({
    text: `Найдите все положительные значения параметра a, при каждом из которых система\n`
      + `⟦cases:⟦r:${2 * m === 1 ? "" : 2 * m}x ${MINUS} x${SUP[2]}⟧ = ⟦r:${2 * m === 1 ? "" : 2 * m}ay ${MINUS} a${SUP[2]}y${SUP[2]}⟧¦y = x${SUP[2]}⟧\n\nимеет ровно 3 решения.`,
    set,
    solution: `Обе части — значения одной функции f(t) = ${2 * m === 1 ? "" : 2 * m}t ${MINUS} t${SUP[2]} при t = x и t = ay. Из f(x) = f(ay) следует ay = x или ay = ${2 * m} ${MINUS} x, `
      + `а ОДЗ даёт 0 ≤ x ≤ ${2 * m}.\n`
      + `Подставляя y = x${SUP[2]}: ax${SUP[2]} = x ⟺ x = 0 или x = 1/a; ax${SUP[2]} + x ${MINUS} ${2 * m} = 0 — ещё до двух корней.\n`
      + `Считаем, при каких a > 0 различных подходящих x ровно три (y определяется однозначно).\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 3 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a > 0 ? 1 / a : null), label: "x = 1/a" },
        { f: (a) => (a > 0 ? (-1 + Math.sqrt(1 + 8 * a * m)) / (2 * a) : null), label: `ax² + x = ${2 * m}` },
        { f: () => 2 * m, dash: true, label: "ОДЗ: x ≤ 2m" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: 2 * m + 2, aMin: 0, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// =============================================================================
// РАЗДЕЛ F. Рациональные, четвёртой степени, кусочные (эталон #39–#48)
// =============================================================================

// #39. (x³ + x² − k²a²x − 2mx + a)/(x³ − k²a²x) = 1 ⟺ x² − 2mx + a = 0 при x ∉ {0, ±ka}.
function build39({ k, m }) {
  const solve = (a) => {
    const N = [a, R(-2 * m), R1]
    let n = countRoots(N, "-inf", "+inf", false, false)
    // выколотые точки знаменателя x(x − ka)(x + ka); при a = 0 все три сливаются в одну
    for (const bad of uniqSorted([R0, Rmul(R(k), a), Rmul(R(-k), a)])) {
      if (Rzero(pEval(N, bad))) n--
    }
    return n
  }
  const crit = [R(m * m), R0, R(2 * m * k - 1, k * k), R(-(2 * m * k + 1), k * k)]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
// k ≤ 4: знаменатели границ равны k², а verify18 требует «человеческих» чисел (≤ 24)
const T39 = [[3, 1], [2, 1], [3, 2], [4, 1], [2, 2], [4, 3], [3, 3], [2, 3], [4, 2], [3, 4]].map(([k, m]) => ({ k, m }))
export function t18RatEqOne() {
  const par = pick(T39), { k, m } = par
  const { set, solve } = build39(par)
  const num = `x${SUP[3]} + x${SUP[2]} ${MINUS} ${k * k}a${SUP[2]}x ${MINUS} ${2 * m === 1 ? "" : 2 * m}x + a`
  const den = `x${SUP[3]} ${MINUS} ${k * k}a${SUP[2]}x`
  return item({
    text: `${HEAD_A}\n\n${fT(num, den)} = 1\n\nимеет ровно один корень.`,
    set,
    solution: `Дробь равна единице, когда числитель минус знаменатель равен нулю, а знаменатель — нет.\n`
      + `Разность даёт x${SUP[2]} ${MINUS} ${2 * m === 1 ? "" : 2 * m}x + a = 0, а знаменатель x(x ${MINUS} ${k}a)(x + ${k}a) обращается в нуль при x = 0 и x = ±${k}a — эти корни надо выколоть.\n`
      + `Ровно один корень получается, когда либо дискриминант равен нулю (a = ${m * m}), либо один из двух корней совпал с выколотой точкой.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (m * m - a >= 0 ? m + Math.sqrt(m * m - a) : null), label: "корни x² − 2mx + a" },
        { f: (a) => (m * m - a >= 0 ? m - Math.sqrt(m * m - a) : null) },
        { f: (a) => k * a, dash: true, label: "выколотые x = ±ka" }, { f: (a) => -k * a, dash: true },
        { f: () => 0, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 10, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #40. x⁴ − rx³ − tx² + rax + ta − a² = 0 — квадратное ОТНОСИТЕЛЬНО a: a = x² или a = −x² + rx + t.
// «Не менее трёх корней» ⟺ a между вершиной первой параболы (0) и вершиной второй (t + r²/4).
function build40({ r, t }) {
  const solve = (a) => countRoots([Rsub(Rmul(R(t), a), Rmul(a, a)), Rmul(R(r), a), R(-t), R(-r), R1],
    "-inf", "+inf", false, false)
  const crit = [R0, R(4 * t + r * r, 4)]
  return { set: assembleSet((a) => solve(a) >= 3, crit), solve }
}
const T40 = [[4, 6], [2, 4], [4, 2], [6, 3], [2, 8], [6, 7], [4, 8], [8, 4]].map(([r, t]) => ({ r, t }))
export function t18QuarticParam() {
  const par = pick(T40), { r, t } = par
  const { set, solve } = build40(par)
  return item({
    text: `${HEAD_A}\n\nx⁴ ${MINUS} ${r}x${SUP[3]} ${MINUS} ${t}x${SUP[2]} + ${r}ax + ${t}a ${MINUS} a${SUP[2]} = 0\n\nимеет не менее трёх корней.`,
    set,
    solution: `Посмотрим на уравнение как на квадратное относительно a: a${SUP[2]} ${MINUS} (${r}x + ${t})a + (x⁴ ${MINUS} ${r}x${SUP[3]} ${MINUS} ${t}x${SUP[2]}) = 0.\n`
      + `Его дискриминант равен (x${SUP[2]} + ${r}x + ${t})${SUP[2]}... точнее, корни равны a = x${SUP[2]} и a = ${MINUS}x${SUP[2]} + ${r}x + ${t}.\n`
      + `Значит уравнение равносильно совокупности a = x${SUP[2]} (парабола ветвями вверх, наименьшее значение 0) и a = ${MINUS}x${SUP[2]} + ${r}x + ${t} (ветви вниз, наибольшее значение ${Rstr(R(4 * t + r * r, 4))}).\n`
      + `Первая даёт два корня при a > 0, вторая — два корня при a < ${Rstr(R(4 * t + r * r, 4))}; не менее трёх корней получается ровно на отрезке между этими значениями.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "atLeast", n: 3 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a >= 0 ? Math.sqrt(a) : null), label: "a = x²" }, { f: (a) => (a >= 0 ? -Math.sqrt(a) : null) },
        { f: (a) => { const d = r * r / 4 + t - a; return d >= 0 ? r / 2 + Math.sqrt(d) : null }, label: `a = ${MINUS}x² + ${r}x + ${t}` },
        { f: (a) => { const d = r * r / 4 + t - a; return d >= 0 ? r / 2 - Math.sqrt(d) : null } },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -6, xMax: r + 6, aMin: -4, aMax: t + r * r / 4 + 4,
    },
  })
}

// #41. log_{c−x}(d − a − x) = 2 ⟺ (c − x)² = d − a − x при c − x > 0, c − x ≠ 1.
// Получается x² − (2c−1)x + c² − d + a = 0 с выколотой точкой x = c − 1.
function build41({ c, d, L, Rr }) {
  const quad = (a) => [Radd(R(c * c - d), a), R(-(2 * c - 1)), R1]
  const solve = (a) => {
    const I = ivCut({ lo: "-inf", hi: R(c), incLo: false, incHi: false }, { lo: R(L), hi: R(Rr), incLo: true, incHi: false })
    if (ivEmpty(I)) return 0
    let n = countRoots(quad(a), I.lo, I.hi, I.incLo, I.incHi)
    const hole = R(c - 1)                                   // основание логарифма равно 1
    if (Rzero(pEval(quad(a), hole)) && Rcmp(hole, I.lo) >= 0 && Rcmp(hole, I.hi) < 0) n--
    return n
  }
  const crit = [R(d - c * c + (2 * c - 1) * L - L * L), R(d - c * c + (2 * c - 1) * Rr - Rr * Rr),
    R(d - c * c + (2 * c - 1) * (c - 1) - (c - 1) * (c - 1)), R(4 * (d - c * c) + (2 * c - 1) * (2 * c - 1), 4)]
  return { set: assembleSet((a) => solve(a) >= 1, crit), solve }
}
const T41 = [[1, 3, -2, 1], [1, 4, -3, 1], [2, 5, -1, 2], [1, 5, -4, 1], [2, 6, -2, 2], [3, 8, -1, 3]]
  .map(([c, d, L, R]) => ({ c, d, L, Rr: R }))
export function t18LogVarBase() {
  const par = pick(T41), { c, d, L, Rr } = par
  const { set, solve } = build41(par)
  return item({
    text: `${HEAD_A}\n\nlog⟦b:${c} ${MINUS} x⟧(${d} ${MINUS} a ${MINUS} x) = 2\n\nимеет хотя бы один корень, принадлежащий промежутку [${nS(L)}; ${Rr}).`,
    set,
    solution: `ОДЗ: ${c} ${MINUS} x > 0, ${c} ${MINUS} x ≠ 1 (то есть x ≠ ${c - 1}) и ${d} ${MINUS} a ${MINUS} x > 0.\n`
      + `По определению логарифма (${c} ${MINUS} x)${SUP[2]} = ${d} ${MINUS} a ${MINUS} x, то есть x${SUP[2]} ${MINUS} ${2 * c - 1}x + ${c * c - d} + a = 0 `
      + `(правая часть тогда положительна автоматически).\n`
      + `Нужно, чтобы хотя бы один такой корень попал в [${nS(L)}; ${Rr}) и не равнялся ${c - 1}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => { const D = (2 * c - 1) * (2 * c - 1) / 4 - (c * c - d + a); return D >= 0 ? (2 * c - 1) / 2 + Math.sqrt(D) : null }, label: "корни квадратного" },
        { f: (a) => { const D = (2 * c - 1) * (2 * c - 1) / 4 - (c * c - d + a); return D >= 0 ? (2 * c - 1) / 2 - Math.sqrt(D) : null } },
        { f: () => c - 1, dash: true, label: "выколото: основание = 1" },
        { f: () => L, dash: true }, { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 2, xMax: c + 2, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// Сеточная сверка с мелким шагом 1/60 — для наборов, где критические значения могут иметь
// «неудобные» знаменатели (шага 1/24 не хватает, чтобы их поймать).
function gridOk60(set, test) {
  const b = setBounds(set).map(Rnum)
  if (!b.length) return false
  const lo = Math.floor(Math.min(...b)) - 3, hi = Math.ceil(Math.max(...b)) + 3
  for (let k = lo * 60; k <= hi * 60; k++) { const a = R(k, 60); if (inSet(set, a) !== test(a)) return false }
  return true
}

// То же, что gridOk, но для произвольного предиката (не «ровно N»).
// eslint-disable-next-line no-unused-vars -- нужна при разовом отборе таблиц (T42, T44)
function gridOk2(set, test) {
  const b = setBounds(set).map(Rnum)
  if (!b.length) return false
  const lo = Math.floor(Math.min(...b)) - 4, hi = Math.ceil(Math.max(...b)) + 4
  for (let k = lo * 24; k <= hi * 24; k++) { const a = R(k, 24); if (inSet(set, a) !== test(a)) return false }
  return true
}

// #42. |px² + qx + r| = a − (px² + sx). Слева и справа одинаковый старший коэффициент, поэтому
// на промежутке, где трёхчлен отрицателен, уравнение становится ЛИНЕЙНЫМ.
// Ответ — значения a, при которых решений нет или оно единственное.
function build42({ p, q, r, s, r1, r2 }) {
  const up = (a) => [Rsub(R(r), a), R(q + s), R(2 * p)]        // ветвь P ≥ 0: 2px² + (q+s)x + r = a
  const lin = (a) => [Rsub(R(-r), a), R(s - q)]                // ветвь P < 0: (s−q)x − r = a
  const solve = (a) => countRoots(up(a), "-inf", R(r1), false, true)
    + countRoots(lin(a), R(r1), R(r2), false, false)
    + countRoots(up(a), R(r2), "+inf", true, false)
  const gUp = (x) => R(2 * p * x * x + (q + s) * x + r)
  const xv = R(-(q + s), 4 * p)
  const crit = [gUp(r1), gUp(r2)]
  if (Rcmp(xv, R(r1)) <= 0 || Rcmp(xv, R(r2)) >= 0) {          // вершина параболы внутри своей ветви
    crit.push(Rsub(Rsub(R(r), Rdiv(Rmul(R(q + s), R(q + s)), R(8 * p))), Rdiv(Rmul(R(q + s), R(q + s)), R(8 * p))))
  }
  return { set: assembleSet((a) => solve(a) <= 1, crit), solve }
}
// Наборы (p, q, r, s, r₁, r₂) отобраны разовым перебором: корни трёхчлена целые, ответ круглый,
// и собранное множество совпало с предикатом на сетке (шаг 1/24).
const T42 = [
  [1, -1, -6, 4, -2, 3], [1, -1, -6, 6, -2, 3], [1, -1, -6, 8, -2, 3], [1, 1, -6, 4, -3, 2],
  [1, 1, -6, 6, -3, 2], [1, 1, -6, 8, -3, 2], [1, 1, -6, 10, -3, 2], [1, 3, -10, 4, -5, 2],
  [1, 3, -10, 6, -5, 2], [1, 3, -10, 8, -5, 2], [1, 3, -10, 10, -5, 2], [1, 3, -10, 12, -5, 2],
  [2, -2, -12, 4, -2, 3], [2, -2, -12, 6, -2, 3], [2, -2, -12, 8, -2, 3], [2, -2, -12, 10, -2, 3],
  [2, -2, -12, 12, -2, 3], [2, 2, -12, 4, -3, 2], [2, 2, -12, 6, -3, 2], [2, 2, -12, 8, -3, 2],
  [2, 2, -12, 10, -3, 2], [2, 2, -12, 12, -3, 2], [2, -10, 12, 10, 2, 3], [2, 6, -20, 4, -5, 2],
  [2, 6, -20, 8, -5, 2], [2, 6, -20, 10, -5, 2], [2, 6, -20, 12, -5, 2], [3, -3, -18, 4, -2, 3],
  [3, -3, -18, 6, -2, 3], [3, -3, -18, 8, -2, 3], [3, -3, -18, 10, -2, 3], [3, -3, -18, 12, -2, 3],
  [3, 3, -18, 4, -3, 2], [3, 3, -18, 6, -3, 2], [3, 3, -18, 8, -3, 2], [3, 3, -18, 10, -3, 2],
  [3, 3, -18, 12, -3, 2], [3, 9, -30, 4, -5, 2], [3, 9, -30, 6, -5, 2], [3, 9, -30, 8, -5, 2],
  [3, 9, -30, 10, -5, 2], [3, 9, -30, 12, -5, 2]
].map(([p, q, r, s, r1, r2]) => ({ p, q, r, s, r1, r2 }))
export function t18AbsQuadEq() {
  const par = pick(T42), { p, q, r, s } = par
  const { set, solve } = build42(par)
  const P = `${p === 1 ? "" : p}x${SUP[2]}${term(q, "x")}${term(r, "")}`
  return item({
    text: `${HEAD_A}\n\n|${P}| = a ${MINUS} ${p === 1 ? "" : p}x${SUP[2]} ${MINUS} ${s}x\n\nлибо не имеет решений, либо имеет единственное решение.`,
    set,
    solution: `Перепишем: a = |${P}| + ${p === 1 ? "" : p}x${SUP[2]} + ${s}x.\n`
      + `Там, где ${P} ≥ 0 (то есть x ≤ ${par.r1} или x ≥ ${par.r2}), правая часть равна ${2 * p}x${SUP[2]}${term(q + s, "x")}${term(r, "")}, `
      + `а между корнями — линейной функции ${s - q === 1 ? "" : s - q}x${term(-r, "")} (квадраты сокращаются).\n`
      + `Значит надо найти те a, при которых горизонтальная прямая пересекает этот график не более одного раза.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "countIn", values: [0, 1] },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => { const D = (q + s) * (q + s) - 8 * p * (r - a); return D >= 0 ? (-(q + s) + Math.sqrt(D)) / (4 * p) : null }, label: "ветви |·| ≥ 0" },
        { f: (a) => { const D = (q + s) * (q + s) - 8 * p * (r - a); return D >= 0 ? (-(q + s) - Math.sqrt(D)) / (4 * p) : null } },
        { f: (a) => (a + r) / (s - q), label: "линейная ветвь" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: par.r1 - 4, xMax: par.r2 + 4, aMin: Rnum(setBounds(set)[0]) - 5,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 5,
    },
  })
}

// #43. a|x − p| = c/(x + q) на [0; +∞) — ровно два корня.
// При a ≠ 0 равносильно a|x − p|(x + q) = c; левая часть — «галочка», умноженная на прямую.
function build43({ p, q, c }) {
  const solve = (a) => {
    if (Rzero(a)) return 0                                    // 0 = c невозможно
    const left = [Rsub(Rmul(Rmul(a, R(p)), R(q)), R(c)), Rmul(a, R(p - q)), Rneg(a)]   // a(p−x)(x+q) − c
    const right = [Rsub(Rmul(Rmul(Rneg(a), R(p)), R(q)), R(c)), Rmul(a, R(q - p)), a]  // a(x−p)(x+q) − c
    return countRoots(left, R0, R(p), true, true) + countRoots(right, R(p), "+inf", false, false)
  }
  const crit = [R0, R(c, p * q), R(4 * c, (p + q) * (p + q))]
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
// Наборы (p, q, c) — тем же отбором.
const T43 = [
  [2, 1, 4], [2, 1, 5], [2, 1, 6], [2, 1, 8], [2, 1, 9], [2, 1, 10], [2, 1, 12],
  [2, 2, 4], [2, 2, 5], [2, 2, 6], [2, 2, 8], [2, 2, 9], [2, 2, 10], [2, 2, 12],
  [2, 3, 4], [2, 3, 5], [2, 3, 6], [2, 3, 8], [2, 3, 9], [2, 3, 10], [2, 3, 12],
  [2, 4, 4], [2, 4, 5], [2, 4, 6], [2, 4, 8], [2, 4, 9], [2, 4, 10], [2, 4, 12],
  [3, 1, 4], [3, 1, 5], [3, 1, 6], [3, 1, 8], [3, 1, 9], [3, 1, 10], [3, 1, 12],
  [3, 2, 5], [3, 2, 10], [3, 3, 4], [3, 3, 5], [3, 3, 6], [3, 3, 8], [3, 3, 9],
  [3, 3, 10], [3, 3, 12], [3, 4, 4], [3, 4, 5], [3, 4, 6], [3, 4, 8], [3, 4, 9],
  [3, 4, 10], [3, 4, 12], [4, 1, 5], [4, 1, 10], [4, 2, 4], [4, 2, 5], [4, 2, 6],
  [4, 2, 8], [4, 2, 9], [4, 2, 10], [4, 2, 12], [4, 4, 4], [4, 4, 5], [4, 4, 6],
  [4, 4, 8], [4, 4, 9], [4, 4, 10], [4, 4, 12], [5, 1, 4], [5, 1, 5], [5, 1, 6],
  [5, 1, 8], [5, 1, 9], [5, 1, 10], [5, 1, 12], [5, 3, 4], [5, 3, 5], [5, 3, 6],
  [5, 3, 8], [5, 3, 9], [5, 3, 10], [5, 3, 12], [5, 4, 9]
].map(([p, q, c]) => ({ p, q, c }))
export function t18AbsHyperbola() {
  const par = pick(T43), { p, q, c } = par
  const { set, solve } = build43(par)
  return item({
    text: `${HEAD_A}\n\na|x ${MINUS} ${p}| = ${fT(String(c), `x + ${q}`)}\n\nна промежутке [0; +∞) имеет ровно два корня.`,
    set,
    solution: `На [0; +∞) знаменатель положителен, поэтому уравнение равносильно a|x ${MINUS} ${p}|(x + ${q}) = ${c}.\n`
      + `При a = 0 решений нет. При a ≠ 0 обозначим h(x) = |x ${MINUS} ${p}|(x + ${q}): на [0; ${p}] это парабола ветвями вниз со значением ${p * q} в нуле `
      + `и наибольшим значением ${Rstr(R((p + q) * (p + q), 4))} в точке x = ${Rstr(R(p - q, 2))}, дальше — возрастающая ветвь от нуля.\n`
      + `Число корней уравнения h(x) = ${c}/a и даёт ответ.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => { if (!a) return null; const D = (p + q) * (p + q) / 4 - (p * q - c / a); return D >= 0 ? (p - q) / 2 + Math.sqrt(D) : null }, label: "ветвь [0; p]" },
        { f: (a) => { if (!a) return null; const D = (p + q) * (p + q) / 4 + c / a; return D >= 0 ? (p - q) / 2 + Math.sqrt(D) : null }, label: "ветвь x ≥ p" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: p + 6, aMin: Rnum(setBounds(set)[0]) - 2,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #44. |c/x − k| = ax − 1 на (0; +∞) — более двух корней.
// Умножая на x > 0: |c − kx| = ax² − x. Два куска: до c/k и после.
function build44({ c, k }) {
  const solve = (a) => {
    const p1 = [R(-c), R(k - 1), a]                         // ax² + (k−1)x − c = 0 при 0 < x ≤ c/k
    const p2 = [R(c), R(-(k + 1)), a]                       // ax² − (k+1)x + c = 0 при x > c/k
    return countRoots(p1, R0, R(c, k), false, true) + countRoots(p2, R(c, k), "+inf", false, false)
  }
  const crit = [R0, R(k, c), R(-(k - 1) * (k - 1), 4 * c), R((k + 1) * (k + 1), 4 * c)]
  return { set: assembleSet((a) => solve(a) >= 3, crit), solve }
}
// Наборы (c, k) — тем же отбором.
const T44 = [
  [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [6, 3], [6, 4], [6, 5],
  [6, 6], [6, 7], [8, 3], [8, 5], [8, 7], [9, 3], [9, 5], [9, 7],
  [10, 3], [10, 4], [10, 5], [10, 7], [12, 3], [12, 5], [12, 7]
].map(([c, k]) => ({ c, k }))
export function t18AbsRecipMoreTwo() {
  const par = pick(T44), { c, k } = par
  const { set, solve } = build44(par)
  return item({
    text: `${HEAD_A}\n\n|${fT(String(c), "x")} ${MINUS} ${k}| = ax ${MINUS} 1\n\nна промежутке (0; +∞) имеет более двух корней.`,
    set,
    solution: `Умножим обе части на x > 0: |${c} ${MINUS} ${k}x| = ax${SUP[2]} ${MINUS} x.\n`
      + `При 0 < x ≤ ${Rstr(R(c, k))} получаем ax${SUP[2]} + ${k - 1}x ${MINUS} ${c} = 0, при x > ${Rstr(R(c, k))} — ax${SUP[2]} ${MINUS} ${k + 1}x + ${c} = 0.\n`
      + `Считаем суммарное число корней на своих промежутках и берём те a, при которых их больше двух.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "atLeast", n: 3 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => { const D = (k - 1) * (k - 1) + 4 * a * c; return a !== 0 && D >= 0 ? (-(k - 1) + Math.sqrt(D)) / (2 * a) : null }, label: "первый кусок" },
        { f: (a) => { const D = (k + 1) * (k + 1) - 4 * a * c; return a !== 0 && D >= 0 ? ((k + 1) - Math.sqrt(D)) / (2 * a) : null }, label: "второй кусок" },
        { f: () => c / k, dash: true, label: "стык кусков" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: 0, xMax: c + 4, aMin: Rnum(setBounds(set)[0]) - 2,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 2,
    },
  })
}

// #46. |x² − px − q| − ka = |x − a| − c — два модуля, «ровно три различных корня».
// Точки смены знака: корни трёхчлена (целые r₁ < r₂) и точка x = a. На каждом куске уравнение
// квадратное, число корней считается точно; критические значения a — это обнуление дискриминанта
// куска, попадание корня на стык и совпадение стыков.
function build46({ p, q, k, c, r1, r2 }) {
  // на куске: s₁(x² − px − q) − ka = s₂(x − a) − c
  const poly = (a, s1, s2) => [Rsub(Radd(Rsub(Rmul(R(-s1 * q), R1), Rmul(R(k), a)), Rmul(R(s2), a)), R(-c)),
    R(-(s1 * p + s2)), R(s1)]
  const solve = (a) => {
    const bp = uniqSorted([R(r1), R(r2), a])
    const edges = ["-inf", ...bp, "+inf"]
    let n = 0
    for (let i = 0; i < edges.length - 1; i++) {
      const lo = edges[i], hi = edges[i + 1]
      const mid = lo === "-inf" ? Rsub(hi, R1) : hi === "+inf" ? Radd(lo, R1) : Rdiv(Radd(lo, hi), R(2))
      const s1 = Rsign(pEval([R(-q), R(-p), R1], mid)) >= 0 ? 1 : -1
      const s2 = Rcmp(mid, a) >= 0 ? 1 : -1
      n += countRoots(poly(a, s1, s2), lo, hi, false, true)      // концы: левый открыт, правый закрыт
    }
    // самый правый кусок закрыт справа «на бесконечности» — правая граница не считается дважды
    return n
  }
  const crit = [R(r1), R(r2)]
  for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
    // дискриминант куска равен нулю
    const A = R(s1), B = R(-(s1 * p + s2))
    const C0 = [Rsub(R(-s1 * q), R(-c)), Rsub(R(s2), R(k))]      // свободный член как многочлен по a
    const disc = pSub([Rmul(B, B)], pMul([Rmul(R(4), A)], C0))
    crit.push(...ratRoots(disc).roots)
    // корень попал на стык x = r₁, x = r₂ или x = a
    for (const e of [R(r1), R(r2)]) {
      const E = [Radd(Rsub(Radd(Rmul(A, Rmul(e, e)), Rmul(B, e)), R(s1 * q)), R(c)), Rsub(R(s2), R(k))]
      crit.push(...ratRoots(E).roots)
    }
    const Ex = [R(c - s1 * q), Rsub(Rsub(R(s2), R(k)), R(s1 * p + s2)), R(s1)]   // подстановка x = a
    crit.push(...ratRoots(Ex).roots)
  }
  return { set: assembleSet((a) => solve(a) === 3, crit), solve }
}
// Наборы (r₁, r₂, k, c) отобраны разовым перебором: ответ круглый и совпал с предикатом
// на сетке (шаг 1/24). Конфигураций с тремя корнями и круглым ответом мало — отсюда две штуки.
const T46 = [
  [-1, 3, 1, 3], [-3, 1, 1, 1]
].map(([r1, r2, k, c]) => ({ r1, r2, k, c, p: r1 + r2, q: -r1 * r2 }))
export function t18TwoAbsThree() {
  const par = pick(T46), { p, q, k, c } = par
  const { set, solve } = build46(par)
  const Q = `x${SUP[2]}${term(-p, "x")}${term(-q, "")}`
  return item({
    text: `${HEAD_A}\n\n|${Q}| ${MINUS} ${k === 1 ? "" : k}a = |x ${MINUS} a| ${MINUS} ${c}\n\nимеет ровно три различных корня.`,
    set,
    solution: `Модули раскрываются на промежутках, границами которых служат корни трёхчлена (x = ${par.r1} и x = ${par.r2}) и точка x = a.\n`
      + `На каждом таком промежутке уравнение становится квадратным: ±(${Q}) ${MINUS} ${k === 1 ? "" : k}a = ±(x ${MINUS} a) ${MINUS} ${c}.\n`
      + `Число корней меняется только там, где дискриминант куска обращается в нуль, где корень попадает на границу промежутка `
      + `или где сама точка a проходит через ${par.r1} или ${par.r2}. Между такими значениями ответ постоянен.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 3 },
    solve: (a) => solve(a),
    raw: {
      seg: [par.r1 - 8, par.r2 + 8],
      F: (a) => (x) => Math.abs(x * x - p * x - q) - k * a - Math.abs(x - a) + c,
      sols: (a) => {
        const out = []
        for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
          const A = s1, B = -(s1 * p + s2), C = -s1 * q - k * a + s2 * a + c
          const D = B * B - 4 * A * C
          if (D < 0) continue
          for (const x of [(-B - Math.sqrt(D)) / (2 * A), (-B + Math.sqrt(D)) / (2 * A)]) {
            const okQ = s1 * (x * x - p * x - q) >= -1e-9, okA = s2 * (x - a) >= -1e-9
            if (okQ && okA && !out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
          }
        }
        return out
      },
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a, dash: true, label: "x = a" },
        { f: () => par.r1, dash: true, label: "корни трёхчлена" }, { f: () => par.r2, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: par.r1 - 5, xMax: par.r2 + 5, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #48. ax + √(r² − (x + m)²) = ap + q — прямая пучка с центром (p; q) и верхняя полуокружность
// с центром (−m; 0) радиуса r. «Единственный корень» — ровно одна общая точка.
function build48({ m, r, p, q }) {
  const solve = (a) => {
    // √(r² − (x+m)²) = a(p − x) + q; нужно (правая часть) ≥ 0 и x ∈ [−m−r; −m+r]
    const A = Radd(R1, Rmul(a, a))
    const B = Rsub(Rmul(R(2), R(m)), Rmul(R(2), Rmul(a, Radd(Rmul(a, R(p)), R(q)))))
    const C = Rsub(Radd(Rmul(R(m), R(m)), Rmul(Radd(Rmul(a, R(p)), R(q)), Radd(Rmul(a, R(p)), R(q)))), Rmul(R(r), R(r)))
    const quad = [C, B, A]                                          // (1+a²)x² + … = 0
    // область: [−m−r; −m+r] ∩ {a(p−x)+q ≥ 0}
    let I = { lo: R(-m - r), hi: R(-m + r), incLo: true, incHi: true }
    if (!Rzero(a)) {
      const xb = Radd(R(p), Rdiv(R(q), a))                           // a(p−x)+q = 0 ⟺ x = p + q/a
      I = Rsign(a) > 0 ? ivCut(I, { lo: "-inf", hi: xb, incLo: false, incHi: true })
        : ivCut(I, { lo: xb, hi: "+inf", incLo: true, incHi: false })
    } else if (Rsign(R(q)) < 0) return 0
    if (ivEmpty(I)) return 0
    return countRoots(quad, I.lo, I.hi, I.incLo, I.incHi)
  }
  // критические значения: касание (расстояние от центра до прямой = r) и прохождение через концы
  // касание: расстояние от центра (−m; 0) до прямой ax + y − (ap + q) = 0 равно r
  // ⟺ a²((m+p)² − r²) + 2q(m+p)·a + (q² − r²) = 0
  const tang = [R(q * q - r * r), R(2 * q * (m + p)), R((m + p) * (m + p) - r * r)]
  const tr = ratRoots(tang)
  if (!tr.allRational) return null                      // иррациональное касание — набор не берём
  const crit = [R0, ...tr.roots]
  for (const e of [-m - r, -m + r]) crit.push(...ratRoots([R(q), R(p - e)]).roots)   // прямая через конец ОДЗ
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
// Наборы (m, r, p, q) — тем же отбором (плюс требование рационального касания).
const T48 = [
  [2, 2, 1, 2], [2, 2, 2, 2], [2, 2, 3, 2], [2, 3, 1, 1], [2, 3, 1, 2], [2, 3, 1, 3], [2, 3, 1, 4],
  [2, 3, 2, 3], [2, 3, 3, 3], [2, 4, 1, 1], [2, 4, 1, 2], [2, 4, 1, 4], [2, 4, 2, 1], [2, 4, 2, 2],
  [2, 4, 2, 3], [2, 4, 2, 4], [2, 4, 3, 4], [2, 5, 1, 1], [2, 5, 1, 2], [2, 5, 1, 3], [2, 5, 1, 4],
  [2, 5, 2, 1], [2, 5, 2, 2], [2, 5, 2, 3], [2, 5, 3, 1], [2, 5, 3, 2], [2, 5, 3, 3], [3, 2, 1, 2],
  [3, 2, 2, 2], [3, 2, 3, 2], [3, 3, 1, 3], [3, 3, 2, 3], [3, 3, 3, 3], [3, 4, 1, 1], [3, 4, 1, 2],
  [3, 4, 1, 3], [3, 4, 1, 4], [3, 4, 2, 4], [3, 4, 3, 4], [3, 5, 1, 1], [3, 5, 1, 2], [3, 5, 1, 3],
  [3, 5, 2, 1], [3, 5, 2, 2], [3, 5, 2, 3], [4, 2, 1, 2], [4, 2, 2, 2], [4, 2, 3, 2], [4, 3, 1, 3],
  [4, 3, 2, 3], [4, 3, 3, 3], [4, 4, 1, 4], [4, 4, 2, 4], [4, 4, 3, 4], [4, 5, 1, 1], [4, 5, 1, 2],
  [4, 5, 1, 3], [4, 5, 3, 1], [5, 2, 1, 2], [5, 2, 2, 2], [5, 2, 3, 2], [5, 3, 1, 3], [5, 3, 2, 3],
  [5, 3, 3, 3], [5, 4, 1, 4], [5, 4, 2, 4], [5, 4, 3, 1], [5, 4, 3, 4], [5, 5, 2, 1]
].map(([m, r, p, q]) => ({ m, r, p, q }))
export function t18LinePencilSemicircle() {
  const par = pick(T48), { m, r, p, q } = par
  const { set, solve } = build48(par)
  const under = `${nS(r * r - m * m)} ${MINUS} ${2 * m === 1 ? "" : 2 * m}x ${MINUS} x${SUP[2]}`
  return item({
    text: `${HEAD_A}\n\nax + ⟦r:${under}⟧ = ${p === 1 ? "" : p}a + ${q}\n\nимеет единственный корень.`,
    set,
    solution: `Подкоренное выражение равно ${r * r} ${MINUS} (x + ${m})${SUP[2]}, поэтому ОДЗ — отрезок [${nS(-m - r)}; ${nS(-m + r)}], `
      + `а график левой части — верхняя полуокружность с центром (${nS(-m)}; 0) радиуса ${r}.\n`
      + `Уравнение равносильно √(${r * r} ${MINUS} (x + ${m})${SUP[2]}) = a(${p} ${MINUS} x) + ${q} — справа семейство прямых, проходящих через точку (${p}; ${q}).\n`
      + `Единственный корень — когда прямая пересекает полуокружность ровно один раз (в том числе касание).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    raw: {
      seg: [-m - r, -m + r],
      F: (a) => (x) => {
        const u = r * r - (x + m) * (x + m)
        if (u < -EPS) return null
        return a * x + sqrtSafe(u) - (a * p + q)
      },
      sols: (a) => {
        const A = 1 + a * a, B = 2 * m - 2 * a * (a * p + q), C = m * m + (a * p + q) * (a * p + q) - r * r
        const D = B * B - 4 * A * C
        if (D < 0) return []
        const out = []
        for (const x of [(-B - Math.sqrt(D)) / (2 * A), (-B + Math.sqrt(D)) / (2 * A)]) {
          if (x >= -m - r - 1e-12 && x <= -m + r + 1e-12 && a * (p - x) + q >= -1e-9
            && !out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
        }
        return out
      },
    },
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => { const A = 1 + a * a, B = 2 * m - 2 * a * (a * p + q), C = m * m + (a * p + q) * (a * p + q) - r * r; const D = B * B - 4 * A * C; return D >= 0 ? (-B + Math.sqrt(D)) / (2 * A) : null }, label: "точки пересечения" },
        { f: (a) => { const A = 1 + a * a, B = 2 * m - 2 * a * (a * p + q), C = m * m + (a * p + q) * (a * p + q) - r * r; const D = B * B - 4 * A * C; return D >= 0 ? (-B - Math.sqrt(D)) / (2 * A) : null } },
        { f: () => -m - r, dash: true, label: "ОДЗ" }, { f: () => -m + r, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -m - r - 2, xMax: Math.max(p, -m + r) + 2, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// =============================================================================
// РАЗДЕЛ G. Системы неравенств с параметром (эталон #49–#54)
// =============================================================================

// #49. {ka ≤ x; 2mx > x² + a²; x + a ≤ s} — хотя бы одно решение на [L; R].
// Допустимые x — рациональный промежуток [max(ka; L); min(s−a; R)], внутри которого должно
// найтись x с x² − 2mx + a² < 0. Парабола ветвями вверх: минимум либо в вершине x = m,
// либо на ближайшем конце промежутка — проверяется точно.
function build49({ k, m, s, L, Rr }) {
  const q = (a, x) => Radd(Rsub(Rmul(x, x), Rmul(R(2 * m), x)), Rmul(a, a))
  const solve = (a) => {
    const lo = Rcmp(Rmul(R(k), a), R(L)) > 0 ? Rmul(R(k), a) : R(L)
    const hi = Rcmp(Rsub(R(s), a), R(Rr)) < 0 ? Rsub(R(s), a) : R(Rr)
    if (Rcmp(lo, hi) > 0) return 0
    const at = Rcmp(R(m), lo) < 0 ? lo : Rcmp(R(m), hi) > 0 ? hi : R(m)   // точка минимума на промежутке
    return Rsign(q(a, at)) < 0 ? 1 : 0
  }
  const crit = [R0, R(2 * m * k, k * k + 1), R(m), R(-m), R(s, k + 1), R(L, k), R(Rr, k), R(s - L), R(s - Rr)]
  for (const E of [[R(L * L - 2 * m * L), R0, R1], [R(Rr * Rr - 2 * m * Rr), R0, R1],
    [R(s * s - 2 * m * s), R(2 * m - 2 * s), R(2)]]) {          // q(L)=0, q(R)=0, q(s−a)=0
    crit.push(...ratRoots(E).roots)
  }
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
// Наборы (k, m, s, L, R) отобраны разовым перебором с двойной сеточной сверкой (шаги 1/24 и 1/60).
const T49 = [
  [1, 3, 5, 3, 4], [1, 3, 5, 2, 4], [1, 3, 5, 3, 5], [1, 3, 6, 3, 4], [1, 3, 6, 2, 4], [1, 3, 6, 3, 5],
  [1, 3, 7, 3, 4], [1, 3, 7, 2, 4], [1, 3, 7, 3, 5], [1, 3, 8, 3, 4], [1, 3, 8, 2, 4], [1, 3, 8, 3, 5],
  [1, 4, 5, 3, 4], [1, 4, 5, 4, 5], [1, 4, 5, 2, 4], [1, 4, 5, 3, 5], [1, 4, 6, 3, 4], [1, 4, 6, 4, 5],
  [1, 4, 6, 2, 4], [1, 4, 6, 3, 5], [1, 4, 7, 3, 4], [1, 4, 7, 4, 5], [1, 4, 7, 2, 4], [1, 4, 7, 3, 5],
  [1, 4, 8, 3, 4], [1, 4, 8, 4, 5], [1, 4, 8, 2, 4], [1, 4, 8, 3, 5], [1, 5, 5, 4, 5], [1, 5, 5, 3, 5],
  [1, 5, 6, 4, 5], [1, 5, 6, 3, 5], [1, 5, 7, 4, 5], [1, 5, 7, 3, 5], [1, 5, 8, 4, 5], [1, 5, 8, 3, 5],
  [2, 3, 5, 3, 4], [2, 3, 5, 2, 4], [2, 3, 5, 3, 5], [2, 3, 6, 3, 4], [2, 3, 6, 2, 4], [2, 3, 6, 3, 5],
  [2, 3, 7, 3, 4], [2, 3, 7, 2, 4], [2, 3, 7, 3, 5], [2, 3, 8, 3, 4], [2, 3, 8, 2, 4], [2, 3, 8, 3, 5],
  [2, 4, 5, 3, 4], [2, 4, 5, 4, 5], [2, 4, 5, 2, 4], [2, 4, 5, 3, 5], [2, 4, 6, 3, 4], [2, 4, 6, 4, 5],
  [2, 4, 6, 2, 4], [2, 4, 6, 3, 5], [2, 4, 7, 3, 4], [2, 4, 7, 4, 5], [2, 4, 7, 2, 4], [2, 4, 7, 3, 5],
  [2, 4, 8, 3, 4], [2, 4, 8, 4, 5], [2, 4, 8, 2, 4], [2, 4, 8, 3, 5], [2, 5, 5, 4, 5], [2, 5, 5, 3, 5],
  [2, 5, 6, 4, 5], [2, 5, 6, 3, 5], [2, 5, 7, 4, 5], [2, 5, 7, 3, 5], [2, 5, 8, 4, 5], [2, 5, 8, 3, 5],
  [3, 3, 5, 3, 4], [3, 3, 5, 2, 4], [3, 3, 5, 3, 5], [3, 3, 6, 3, 4], [3, 3, 6, 2, 4], [3, 3, 6, 3, 5],
  [3, 3, 7, 3, 4], [3, 3, 7, 2, 4], [3, 3, 7, 3, 5], [3, 3, 8, 3, 4], [3, 3, 8, 2, 4], [3, 3, 8, 3, 5],
  [3, 4, 5, 3, 4], [3, 4, 5, 4, 5], [3, 4, 5, 2, 4], [3, 4, 5, 3, 5], [3, 4, 6, 3, 4], [3, 4, 6, 4, 5],
  [3, 4, 6, 2, 4], [3, 4, 6, 3, 5], [3, 4, 7, 3, 4], [3, 4, 7, 4, 5], [3, 4, 7, 2, 4], [3, 4, 7, 3, 5],
  [3, 4, 8, 3, 4], [3, 4, 8, 4, 5], [3, 4, 8, 2, 4], [3, 4, 8, 3, 5], [3, 5, 5, 4, 5], [3, 5, 5, 3, 5],
  [3, 5, 6, 4, 5], [3, 5, 6, 3, 5], [3, 5, 7, 4, 5], [3, 5, 7, 3, 5], [3, 5, 8, 4, 5], [3, 5, 8, 3, 5]
].map(([k, m, s, L, Rr]) => ({ k, m, s, L, Rr }))
export function t18SysThreeIneq() {
  const par = pick(T49), { k, m, s, L, Rr } = par
  const { set, solve } = build49(par)
  return item({
    text: `${HEAD_SYS} неравенств\n⟦cases:${k === 1 ? "" : k}a ≤ x¦${2 * m}x > x${SUP[2]} + a${SUP[2]}¦x + a ≤ ${s}⟧\n\nимеет хотя бы одно решение на отрезке [${nS(L)}; ${Rr}].`,
    set,
    solution: `Первое и третье неравенства задают промежуток ${k === 1 ? "" : k}a ≤ x ≤ ${s} ${MINUS} a; вместе с отрезком [${nS(L)}; ${Rr}] получаем `
      + `x ∈ [max(${k === 1 ? "" : k}a; ${L}); min(${s} ${MINUS} a; ${Rr})].\n`
      + `Второе неравенство равносильно x${SUP[2]} ${MINUS} ${2 * m}x + a${SUP[2]} < 0. Парабола ветвями вверх с вершиной x = ${m}, `
      + `поэтому достаточно проверить её наименьшее значение на найденном промежутке.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => k * a, dash: true, label: `x ≥ ${k === 1 ? "" : k}a` },
        { f: (a) => s - a, dash: true, label: `x ≤ ${s} ${MINUS} a` },
        { f: (a) => (m * m - a * a >= 0 ? m - Math.sqrt(m * m - a * a) : null), label: "полоса второго неравенства" },
        { f: (a) => (m * m - a * a >= 0 ? m + Math.sqrt(m * m - a * a) : null) },
        { f: () => L, dash: true }, { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 3, xMax: Rr + 3, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #50. {y(y−c) = xy − b(x + d); x ≤ p; (a(x − p) − e)/(y − e) = 1} — единственное решение.
// Первое уравнение распадается: (y − b)(y − e − x) = 0 при подходящих b, c, d, e
// (в эталоне: y = 5 и y = x + 2). Третье — пучок прямых y = a(x − p) с выколотой прямой y = e.
function build50({ b, e, p }) {
  const solve = (a) => {
    const good = []
    const add = (x, y) => {
      if (Rcmp(x, R(p)) > 0 || Rcmp(y, R(e)) === 0) return
      if (!good.some(([u, v]) => Rcmp(u, x) === 0 && Rcmp(v, y) === 0)) good.push([x, y])
    }
    if (!Rzero(a)) add(Radd(R(p), Rdiv(R(b), a)), R(b))                    // пересечение с y = b
    if (Rcmp(a, R1) !== 0) {                                               // пересечение с y = x + e
      const x = Rdiv(Radd(Rmul(a, R(p)), R(e)), Rsub(a, R1))
      add(x, Radd(x, R(e)))
    }
    return good.length
  }
  // критические значения: a = 0 и a = 1 (точки уходят за x = p / пучок вырождается),
  // a = −e/p (вторая точка попадает на выколотую прямую y = e) и совпадение двух точек:
  // p + b/a = (ap + e)/(a − 1) ⟺ a(b − p − e) = b
  const crit = [R0, R1, R(-e, p)]
  if (b - p - e !== 0) crit.push(R(b, b - p - e))
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
// Наборы (b, e, p) — тем же отбором.
const T50 = [
  [3, 1, 4], [3, 1, 5], [3, 1, 6], [3, 1, 7], [3, 2, 4], [3, 2, 5], [3, 2, 6], [3, 2, 7],
  [4, 1, 4], [4, 1, 5], [4, 1, 6], [4, 1, 7], [4, 2, 4], [4, 2, 5], [4, 2, 6], [4, 2, 7],
  [4, 3, 4], [4, 3, 5], [4, 3, 6], [4, 3, 7], [5, 1, 4], [5, 1, 5], [5, 1, 6], [5, 1, 7],
  [5, 2, 4], [5, 2, 5], [5, 2, 6], [5, 2, 7], [5, 3, 4], [5, 3, 5], [5, 3, 6], [5, 3, 7],
  [6, 1, 4], [6, 1, 5], [6, 1, 6], [6, 1, 7], [6, 2, 4], [6, 2, 5], [6, 2, 6], [6, 2, 7],
  [6, 3, 4], [6, 3, 5], [6, 3, 6], [6, 3, 7]
].map(([b, e, p]) => ({ b, e, p }))
export function t18SysSplitPencil() {
  const par = pick(T50), { b, e, p } = par
  const { set, solve } = build50(par)
  // y(y − (b+e)) = xy − b(x + e) ⟺ (y − b)(y − e − x) = 0
  const c = b + e
  return item({
    text: `Найдите все значения параметра a, при каждом из которых система\n`
      + `⟦cases:y(y ${MINUS} ${c}) = xy ${MINUS} ${b}(x + ${e})¦x ≤ ${p}¦${fT(`a(x ${MINUS} ${p}) ${MINUS} ${e}`, `y ${MINUS} ${e}`)} = 1⟧\n\nимеет единственное решение.`,
    set,
    solution: `Первое уравнение: y${SUP[2]} ${MINUS} ${c}y ${MINUS} xy + ${b}x + ${b * e} = 0 ⟺ (y ${MINUS} ${b})(y ${MINUS} x ${MINUS} ${e}) = 0, то есть y = ${b} или y = x + ${e}.\n`
      + `Третье уравнение при y ≠ ${e} равносильно a(x ${MINUS} ${p}) = y, то есть это пучок прямых с центром (${p}; 0).\n`
      + `Прямая пересекает y = ${b} в точке x = ${p} + ${b}/a и прямую y = x + ${e} в точке x = (${p}a + ${e})/(a ${MINUS} 1); годятся лишь точки с x ≤ ${p} и y ≠ ${e}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a !== 0 ? p + b / a : null), label: `точка на y = ${b}` },
        { f: (a) => (a !== 1 ? (a * p + e) / (a - 1) : null), label: `точка на y = x + ${e}` },
        { f: () => p, dash: true, label: `x ≤ ${p}` },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: p - 12, xMax: p + 6, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #51. {((x−u)² + (y−v)² − r²)((x−w)² + (y−z)²) ≤ 0; y = a(x − h) + g} — система НЕ имеет решений.
// Второй множитель неотрицателен, поэтому решения — это круг радиуса r с центром (u; v)
// (кроме точки (w; z), если она внутри) плюс сама точка (w; z).
// Прямая пучка с центром (h; g) не должна ни задевать круг, ни проходить через точку.
function build51({ u, v, r, w, z, h, g }) {
  const solve = (a) => {
    // расстояние от центра круга до прямой ax − y + (g − ah) = 0
    const num = Rsub(Radd(Rmul(a, R(u)), R(g - 0)), Radd(R(v), Rmul(a, R(h))))   // a·u − v + g − a·h
    const lhs = Rmul(num, num)
    const rhs = Rmul(R(r * r), Radd(Rmul(a, a), R1))
    const hitsCircle = Rcmp(lhs, rhs) <= 0
    const throughPoint = Rzero(Rsub(R(z), Radd(Rmul(a, Rsub(R(w), R(h))), R(g))))
    return hitsCircle || throughPoint ? 1 : 0
  }
  const tang = [R((g - v) * (g - v) - r * r), R(2 * (u - h) * (g - v)), R((u - h) * (u - h) - r * r)]
  const tr = ratRoots(tang)
  if (!tr.allRational) return null
  const crit = [...tr.roots, ...ratRoots([R(g - z), R(w - h)]).roots]
  return { set: assembleSet((a) => solve(a) === 0, crit), solve }
}
// Наборы (u, r, w, z): центр круга (u; 3), центр пучка (0; 3), особая точка (w; z);
// расстояние между центрами и радиус образуют пифагорову пару — тогда касание рационально.
const T51 = [
  [5, 3, 1, -2], [5, 3, 1, -1], [5, 3, 1, 1], [5, 3, 2, -2], [5, 3, 2, -1], [5, 3, 2, 1],
  [5, 3, 3, -2], [5, 3, 3, -1], [5, 3, 3, 1], [5, 4, 1, -2], [5, 4, 1, -1], [5, 4, 1, 1],
  [5, 4, 2, -2], [5, 4, 2, -1], [5, 4, 2, 1], [5, 4, 3, -2], [5, 4, 3, -1], [5, 4, 3, 1]
].map(([u, r, w, z]) => ({ u, v: 3, r, w, z, h: 0, g: 3 }))
export function t18SysDiskNoSol() {
  const par = pick(T51), { u, v, r, w, z, h, g } = par
  const { set, solve } = build51(par)
  const lineTxt = h === 0 ? `y = ax + ${g}` : `y = a(x ${MINUS} ${h}) + ${g}`
  return item({
    text: `Найдите все значения параметра a, при каждом из которых система\n`
      + `⟦cases:((x ${MINUS} ${u})${SUP[2]} + (y ${MINUS} ${v})${SUP[2]} ${MINUS} ${r * r})((x ${MINUS} ${w})${SUP[2]} + (y${term(-z, "")})${SUP[2]}) ≤ 0¦${lineTxt}⟧\n\nне имеет решений.`,
    set,
    solution: `Второй множитель неотрицателен, поэтому произведение ≤ 0 только если первый множитель ≤ 0 (это круг с центром (${u}; ${v}) радиуса ${r}) `
      + `или второй множитель равен нулю (это точка (${w}; ${nS(z)})).\n`
      + `Прямые ${lineTxt} образуют пучок с центром (${h}; ${g}). Система не имеет решений, когда прямая и круг не пересекаются `
      + `(расстояние от центра до прямой больше ${r}) и прямая не проходит через точку (${w}; ${nS(z)}).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "none" },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => u, dash: true, label: "центр круга" },
        { f: () => w, dash: true, label: "особая точка" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2, xMax: u + r + 3, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #52. {(x + k₁a + m₁)(x + k₂a + m₂) < 0; x² + a² = c²} — хотя бы одно решение.
// Вторая строка даёт x = ±√(c² − a²). Подставляя, получаем (c² − a² + P) + S·x < 0, где
// S и P рациональны. Сравнение иррационального выражения с нулём делается ТОЧНО:
// неравенство base + t√D < 0 сводится к сравнению квадратов с учётом знака t.
function ltZero(base, t, D) {
  if (Rzero(t)) return Rsign(base) < 0
  if (Rsign(t) > 0) return Rsign(base) < 0 && Rcmp(Rmul(Rmul(t, t), D), Rmul(base, base)) < 0
  const u = Rdiv(Rneg(base), t)                       // √D > u
  return Rsign(u) < 0 || Rcmp(D, Rmul(u, u)) > 0
}
function build52({ k1, m1, k2, m2, c }) {
  const solve = (a) => {
    const D = Rsub(R(c * c), Rmul(a, a))
    if (Rsign(D) < 0) return 0
    const S = Radd(Rmul(R(k1 + k2), a), R(m1 + m2))
    const P = Rmul(Radd(Rmul(R(k1), a), R(m1)), Radd(Rmul(R(k2), a), R(m2)))
    const base = Radd(D, P)
    let n = 0
    for (const eps of [1, -1]) {
      if (eps === -1 && Rzero(D)) break                 // x = 0 — одна точка
      if (ltZero(base, Rmul(R(eps), S), D)) n++
    }
    return n
  }
  // критические значения: обращение произведения в нуль (base² = S²D) и |a| = c
  const A = [R(c * c), R0, R(-1)]                       // D = c² − a² как многочлен по a
  const Spoly = [R(m1 + m2), R(k1 + k2)]
  const Ppoly = pMul([R(m1), R(k1)], [R(m2), R(k2)])
  const basePoly = pAdd(A, Ppoly)
  const E = pSub(pMul(basePoly, basePoly), pMul(pMul(Spoly, Spoly), A))
  const er = ratRoots(E)
  if (!er.allRational) return null
  return { set: assembleSet((a) => solve(a) >= 1, [R(c), R(-c), ...er.roots]), solve }
}
// Наборы (k₁, m₁, k₂, m₂, c) — тем же отбором.
const T52 = [
  [1, 2, 2, 2, 2], [1, 2, 3, 2, 2], [1, 2, 4, 2, 2], [2, 2, 3, 2, 2], [2, 2, 4, 2, 2], [1, 1, 2, 2, 5]
].map(([k1, m1, k2, m2, c]) => ({ k1, m1, k2, m2, c }))
export function t18SysCircleStrip() {
  const par = pick(T52), { k1, m1, k2, m2, c } = par
  const { set, solve } = build52(par)
  const S = k1 + k2, P1 = k1 * m2 + k2 * m1, P0 = m1 * m2
  const quad = `x${SUP[2]} + (${S === 1 ? "" : S}a${term(m1 + m2, "")})x${P1 === 0 && P0 === 0 ? "" : ` + ${k1 * k2 === 1 ? "" : k1 * k2}a${SUP[2]}${term(P1, "a")}${term(P0, "")}`}`
  return item({
    text: `${HEAD_SYS}\n⟦cases:${quad} < 0¦x${SUP[2]} + a${SUP[2]} = ${c * c}⟧\n\nимеет хотя бы одно решение.`,
    set,
    solution: `Трёхчлен слева раскладывается: (x + ${k1 === 1 ? "" : k1}a${term(m1, "")})(x + ${k2 === 1 ? "" : k2}a${term(m2, "")}) < 0, `
      + `то есть x лежит строго между числами ${MINUS}${k1 === 1 ? "" : k1}a${term(-m1, "")} и ${MINUS}${k2 === 1 ? "" : k2}a${term(-m2, "")}.\n`
      + `Второе уравнение задаёт окружность радиуса ${c} в плоскости (x; a): x = ±√(${c * c} ${MINUS} a${SUP[2]}), причём |a| ≤ ${c}.\n`
      + `Подставляя каждое из двух значений x, получаем условие на a; система разрешима, когда хотя бы одно из них выполнено.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (c * c - a * a >= 0 ? Math.sqrt(c * c - a * a) : null), label: "окружность" },
        { f: (a) => (c * c - a * a >= 0 ? -Math.sqrt(c * c - a * a) : null) },
        { f: (a) => -k1 * a - m1, dash: true, label: "границы полосы" },
        { f: (a) => -k2 * a - m2, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -c - 3, xMax: c + 3, aMin: -c - 2, aMax: c + 2,
    },
  })
}

// #54. {a(x − 1) ≥ 4; 2√(x − c) ≥ a; kx < a + d} — хотя бы одно решение на [L; R].
// При a ≤ 0 первое неравенство на [L; R] невозможно (x − 1 > 0). При a > 0 все три условия
// дают промежуток по x с РАЦИОНАЛЬНЫМИ границами: x ≥ 1 + 4/a, x ≥ c + a²/4, x < (a + d)/k.
function build54({ c, k, d, L, Rr }) {
  const solve = (a) => {
    if (Rsign(a) <= 0) return 0
    let lo = R(L)
    for (const cand of [Radd(R1, Rdiv(R(4), a)), Radd(R(c), Rdiv(Rmul(a, a), R(4)))]) {
      if (Rcmp(cand, lo) > 0) lo = cand
    }
    const hiOpen = Rdiv(Radd(a, R(d)), R(k))
    const hi = Rcmp(hiOpen, R(Rr)) < 0 ? hiOpen : R(Rr)
    const hiIncl = Rcmp(hiOpen, R(Rr)) < 0 ? false : true
    if (Rcmp(lo, hi) > 0 || (Rcmp(lo, hi) === 0 && !hiIncl)) return 0
    return 1
  }
  const crit = [R0, R(4, Rr - 1), R(4, L - 1), R(k * L - d), R(k * Rr - d)]
  for (const E of [[R(-4 * k), R(d - k), R1],                     // 1 + 4/a = (a+d)/k
    [R(4 * c * k - 4 * d), R(-4), R(k)],                          // c + a²/4 = (a+d)/k
    [R(-16), R(4 * (1 - c)), R0, R1]]) {                          // 1 + 4/a = c + a²/4
    crit.push(...ratRoots(E).roots)
  }
  for (const val of [4 * (L - c), 4 * (Rr - c)]) {                // c + a²/4 = L и = R
    if (val < 0) continue
    const r = isSq(val)
    if (r === null) return null
    crit.push(R(r), R(-r))
  }
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
// Наборы (c, k, d, L, R): L − c и R − c — точные квадраты, иначе границы ответа иррациональны.
const T54 = [
  [3, 2, 10, 3, 4], [3, 2, 12, 3, 4], [3, 2, 14, 4, 7], [3, 2, 14, 3, 4], [3, 2, 16, 4, 7], [3, 2, 16, 3, 4],
  [3, 3, 12, 3, 4], [3, 3, 14, 4, 7], [3, 3, 14, 3, 4], [3, 3, 16, 3, 4], [3, 4, 16, 3, 4]
].map(([c, k, d, L, Rr]) => ({ c, k, d, L, Rr }))
export function t18SysTripleSqrt() {
  const par = pick(T54), { c, k, d, L, Rr } = par
  const { set, solve } = build54(par)
  return item({
    text: `${HEAD_SYS} неравенств\n⟦cases:a(x ${MINUS} 1) ≥ 4¦2⟦r:x ${MINUS} ${c}⟧ ≥ a¦${k === 1 ? "" : k}x < a + ${d}⟧\n\nимеет хотя бы одно решение на отрезке [${L}; ${Rr}].`,
    set,
    solution: `На отрезке [${L}; ${Rr}] выражение x ${MINUS} 1 положительно, поэтому первое неравенство при a ≤ 0 невыполнимо, а при a > 0 равносильно x ≥ 1 + 4/a.\n`
      + `Второе (при a > 0) равносильно x ${MINUS} ${c} ≥ a${SUP[2]}/4, то есть x ≥ ${c} + a${SUP[2]}/4; третье — x < (a + ${d})/${k}.\n`
      + `Значит подходящие x образуют промежуток [max(${L}; 1 + 4/a; ${c} + a${SUP[2]}/4); min(${Rr}; (a + ${d})/${k})), и надо, чтобы он был непуст.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a > 0 ? 1 + 4 / a : null), label: "x ≥ 1 + 4/a" },
        { f: (a) => c + (a * a) / 4, label: `x ≥ ${c} + a²/4` },
        { f: (a) => (a + d) / k, dash: true, label: `x < (a + ${d})/${k}` },
        { f: () => L, dash: true }, { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 3, xMax: Rr + 3, aMin: 0, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// =============================================================================
// РАЗДЕЛ H. Распадающаяся кривая + прямая (эталон #55–#65)
// =============================================================================
// Числитель раскладывается на множители: (y − h)(xy − k) или (y − h)(y − x − b), а корень-
// множитель добавляет вертикальную прямую x = v (либо горизонталь y = w). Вторая строка —
// прямая с фиксированным наклоном и параметром-сдвигом. Все точки пересечения рациональны.

// #55. {(xy² − xy − ky + k)/√(x − v) = 0; y = x + a} — ровно два различных решения.
// Числитель = (y − 1)(xy − k); ОДЗ x > v (знаменатель — корень).
function build55({ k, v }) {
  const solve = (a) => {
    const quad = [R(-k), a, R1]                               // x² + ax − k = 0 (гипербола xy = k)
    let n = countRoots(quad, R(v), "+inf", false, false)
    const x1 = Rsub(R1, a)                                    // точка на прямой y = 1
    if (Rcmp(x1, R(v)) > 0 && !Rzero(pEval(quad, x1))) n++    // совпавшую с гиперболой считаем один раз
    else if (Rcmp(x1, R(v)) > 0) { /* точка уже учтена как корень гиперболы */ }
    return n
  }
  // критические значения: точка y = 1 уходит за ОДЗ (a = 1 − v), отрицательный корень гиперболы
  // проходит через x = v (v² + av − k = 0) и совпадение точки с корнем гиперболы (a = 1 − k)
  const crit = [R(1 - v), R(k - v * v, v), R(1 - k)]
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
const T55 = []
for (const k of [3, 4, 5, 6, 8, 9]) for (const v of [-1, -2, -3, -4]) {
  const par = { k, v }
  const res = build55(par)
  if (!setBounds(res.set).length || !niceSet(res.set, 24n, 60n, 1, 4)) continue
  if (!gridOk(res.set, res.solve, 2) || !gridOk60(res.set, (a) => res.solve(a) === 2)) continue
  T55.push(par)
}
export function t18SysHyperLine() {
  const par = pick(T55), { k, v } = par
  const { set, solve } = build55(par)
  const num = `xy${SUP[2]} ${MINUS} xy ${MINUS} ${k}y + ${k}`
  return item({
    text: `${HEAD_SYS} уравнений\n⟦cases:${fT(num, `√{x${term(-v, "")}}`)} = 0¦y = x + a⟧\n\nимеет ровно два различных решения.`,
    set,
    solution: `Числитель раскладывается: ${num} = (y ${MINUS} 1)(xy ${MINUS} ${k}), а ОДЗ (знаменатель — корень) даёт x > ${nS(v)}.\n`
      + `Значит первая строка задаёт прямую y = 1 и гиперболу xy = ${k} при x > ${nS(v)}.\n`
      + `Прямая y = x + a пересекает y = 1 в точке x = 1 ${MINUS} a, а гиперболу — в корнях уравнения x${SUP[2]} + ax ${MINUS} ${k} = 0.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => 1 - a, label: "точка на y = 1" },
        { f: (a) => (-a + Math.sqrt(a * a + 4 * k)) / 2, label: "точки на гиперболе" },
        { f: (a) => (-a - Math.sqrt(a * a + 4 * k)) / 2 },
        { f: () => v, dash: true, label: `ОДЗ: x > ${nS(v)}` },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: v - 3, xMax: k + 3, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #56–#59. {(y − h)(y − x − b)·(корень-множитель) = 0; x + y = a} — кривая распадается на
// горизонталь y = h, прямую y = x + b и вертикаль x = v (нуль корня-множителя).
// ОДЗ: v ≤ x < xHi (правый конец — из корня в знаменателе), иногда ещё y < yHi.
function buildH2({ h, b, v, xHi, yHi, n }) {
  const okX = (x) => Rcmp(x, R(v)) >= 0 && (xHi === null || Rcmp(x, R(xHi)) < 0)
  const okY = (y) => yHi === null || Rcmp(y, R(yHi)) < 0
  const solve = (a) => {
    const good = []
    const add = (x, y) => {
      if (!okX(x) || !okY(y)) return
      if (!good.some(([u, w]) => Rcmp(u, x) === 0 && Rcmp(w, y) === 0)) good.push([x, y])
    }
    add(Rsub(a, R(h)), R(h))                                  // y = h
    const x2 = Rdiv(Rsub(a, R(b)), R(2))
    add(x2, Radd(x2, R(b)))                                   // y = x + b
    add(R(v), Rsub(a, R(v)))                                  // x = v
    return good.length
  }
  const crit = [R(h + v), R(2 * v + b), R(2 * h - b), R(h + v)]
  if (xHi !== null) crit.push(R(h + xHi), R(2 * xHi + b))
  if (yHi !== null) crit.push(R(yHi + v), R(2 * yHi - b))
  return { set: assembleSet((a) => solve(a) === n, crit), solve }
}
function itemH2(par, txt) {
  const { h, b, v, xHi, n } = par
  const { set, solve } = buildH2(par)
  return item({
    text: `${HEAD_SYS} уравнений\n⟦cases:${txt.num}¦${txt.line}⟧\n\nимеет ${n === 1 ? "единственное решение" : "ровно два различных решения"}.`,
    set,
    solution: `Первое уравнение распадается: ${txt.split}. ОДЗ: ${txt.odz}.\n`
      + `Значит кривая — это горизонталь y = ${h}, прямая y = x${term(b, "")} и вертикаль x = ${nS(v)}.\n`
      + `Прямая x + y = a пересекает их в точках (a ${MINUS} ${h}; ${h}), ((a ${MINUS} ${nS(b)})/2; (a + ${nS(b)})/2) и (${nS(v)}; a ${MINUS} ${nS(v)}) — считаем те, что удовлетворяют ОДЗ, и убираем совпавшие.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a - h, label: `точка на y = ${h}` },
        { f: (a) => (a - b) / 2, label: `точка на y = x${term(b, "")}` },
        { f: () => v, dash: true, label: `вертикаль x = ${nS(v)}` },
        ...(xHi !== null ? [{ f: () => xHi, dash: true, label: "ОДЗ справа" }] : []),
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: v - 3, xMax: (xHi === null ? v + 10 : xHi) + 3, aMin: Rnum(setBounds(set)[0]) - 3,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}
const T56 = [[1, 2, -3, null, null], [2, 3, -4, null, null], [1, 3, -2, null, null], [3, 2, -5, null, null]]
  .map(([h, b, v, xHi, yHi]) => ({ h, b, v, xHi, yHi, n: 2 }))
  .filter((par) => {                                          // вырожденные наборы не берём
    const res = buildH2(par)
    return setBounds(res.set).length > 0 && niceSet(res.set, 24n, 60n, 1, 4)
      && gridOk(res.set, res.solve, 2) && gridOk60(res.set, (a) => res.solve(a) === 2)
  })
  .filter((par) => {                                          // вырожденные наборы не берём
    const res = buildH2(par)
    return setBounds(res.set).length > 0 && niceSet(res.set, 24n, 60n, 1, 4)
      && gridOk(res.set, res.solve, 2) && gridOk60(res.set, (a) => res.solve(a) === 2)
  })
  .filter((par) => {                                          // вырожденные наборы не берём
    const res = buildH2(par)
    return setBounds(res.set).length > 0 && niceSet(res.set, 24n, 60n, 1, 4)
      && gridOk(res.set, res.solve, 2) && gridOk60(res.set, (a) => res.solve(a) === 2)
  })
export function t18SysCurveVert() {
  const par = pick(T56)
  const { h, b, v } = par
  return itemH2(par, {
    num: `(y${SUP[2]} ${MINUS} xy${term(h, "x")}${term(-(h + b), "y")}${term(h * b, "")})√{x${term(-v, "")}} = 0`,
    line: `a ${MINUS} x ${MINUS} y = 0`,
    split: `(y ${MINUS} ${h})(y ${MINUS} x${term(-b, "")}) · √(x${term(-v, "")}) = 0`,
    odz: `x ≥ ${nS(v)} (в точке x = ${nS(v)} корень обращается в нуль, поэтому подходит вся вертикаль)`,
  })
}
const T57 = [[1, 0, -4, 3, null], [1, 0, -3, 4, null], [2, 0, -4, 3, null], [1, 0, -5, 3, null]]
  .map(([h, b, v, xHi, yHi]) => ({ h, b, v, xHi, yHi, n: 2 }))
  .filter((par) => {                                          // вырожденные наборы не берём
    const res = buildH2(par)
    return setBounds(res.set).length > 0 && niceSet(res.set, 24n, 60n, 1, 4)
      && gridOk(res.set, res.solve, 2) && gridOk60(res.set, (a) => res.solve(a) === 2)
  })
  .filter((par) => {                                          // вырожденные наборы не берём
    const res = buildH2(par)
    return setBounds(res.set).length > 0 && niceSet(res.set, 24n, 60n, 1, 4)
      && gridOk(res.set, res.solve, 2) && gridOk60(res.set, (a) => res.solve(a) === 2)
  })
  .filter((par) => {                                          // вырожденные наборы не берём
    const res = buildH2(par)
    return setBounds(res.set).length > 0 && niceSet(res.set, 24n, 60n, 1, 4)
      && gridOk(res.set, res.solve, 2) && gridOk60(res.set, (a) => res.solve(a) === 2)
  })
export function t18SysCurveTwoSqrt() {
  const par = pick(T57)
  const { h, b, v, xHi } = par
  return itemH2(par, {
    num: `${fT(`(y${SUP[2]} ${MINUS} xy${term(h, "x")}${term(-(h + b), "y")}${term(h * b, "")})√{x${term(-v, "")}}`, `√{${xHi} ${MINUS} x}`)} = 0`,
    line: `a = x + y`,
    split: `(y ${MINUS} ${h})(y ${MINUS} x${term(-b, "")}) · √(x${term(-v, "")}) = 0`,
    odz: `${nS(v)} ≤ x < ${xHi} (корень в числителе даёт вертикаль x = ${nS(v)}, корень в знаменателе — строгую границу справа)`,
  })
}
const T58 = [[5, 4, -5, null, 7], [4, 3, -4, null, 6], [5, 3, -6, null, 8], [6, 4, -5, null, 9]]
  .map(([h, b, v, xHi, yHi]) => ({ h, b, v, xHi, yHi, n: 1 }))
  .filter((par) => {                                          // вырожденные наборы не берём
    const res = buildH2(par)
    return setBounds(res.set).length > 0 && niceSet(res.set, 24n, 60n, 1, 4)
      && gridOk(res.set, res.solve, 1) && gridOk60(res.set, (a) => res.solve(a) === 1)
  })
export function t18SysCurveYBound() {
  const par = pick(T58)
  const { h, b, v, yHi } = par
  return itemH2(par, {
    num: `${fT(`(y${SUP[2]} ${MINUS} xy${term(h, "x")}${term(-(h + b), "y")}${term(h * b, "")})√{x${term(-v, "")}}`, `√{${yHi} ${MINUS} y}`)} = 0`,
    line: `a = x + y`,
    split: `(y ${MINUS} ${h})(y ${MINUS} x${term(-b, "")}) · √(x${term(-v, "")}) = 0`,
    odz: `x ≥ ${nS(v)} и y < ${yHi}`,
  })
}
const T59 = [[3, -2, -2, 6, null], [2, -3, -3, 5, null], [4, -2, -2, 7, null], [3, -1, -4, 6, null]]
  .map(([h, b, v, xHi, yHi]) => ({ h, b, v, xHi, yHi, n: 2 }))
  .filter((par) => {                                          // вырожденные наборы не берём
    const res = buildH2(par)
    return setBounds(res.set).length > 0 && niceSet(res.set, 24n, 60n, 1, 4)
      && gridOk(res.set, res.solve, 2) && gridOk60(res.set, (a) => res.solve(a) === 2)
  })
  .filter((par) => {                                          // вырожденные наборы не берём
    const res = buildH2(par)
    return setBounds(res.set).length > 0 && niceSet(res.set, 24n, 60n, 1, 4)
      && gridOk(res.set, res.solve, 2) && gridOk60(res.set, (a) => res.solve(a) === 2)
  })
  .filter((par) => {                                          // вырожденные наборы не берём
    const res = buildH2(par)
    return setBounds(res.set).length > 0 && niceSet(res.set, 24n, 60n, 1, 4)
      && gridOk(res.set, res.solve, 2) && gridOk60(res.set, (a) => res.solve(a) === 2)
  })
export function t18SysCurveNegShift() {
  const par = pick(T59)
  const { h, b, v, xHi } = par
  return itemH2(par, {
    num: `${fT(`(y${SUP[2]} ${MINUS} xy${term(h, "x")}${term(-(h + b), "y")}${term(h * b, "")})√{x${term(-v, "")}}`, `√{${xHi} ${MINUS} x}`)} = 0`,
    line: `x + y ${MINUS} a = 0`,
    split: `(y ${MINUS} ${h})(y ${MINUS} x${term(-b, "")}) · √(x${term(-v, "")}) = 0`,
    odz: `${nS(v)} ≤ x < ${xHi}`,
  })
}

// #60–#63. {(y − h)(xy − k)·(корень-множитель) = 0; y = ax} — прямая ПУЧКА через начало.
// Точки на гиперболе имеют иррациональные координаты (x = ±√(k/a)), но все ограничения
// проверяются точно возведением в квадрат с учётом знака.
function buildPencil({ h, k, xLo, xHi, yLo, yHi, extraV, extraH, n }) {
  const okX = (x) => (xLo === null || Rcmp(x, R(xLo)) > 0) && (xHi === null || Rcmp(x, R(xHi)) <= 0)
  const okY = (y) => (yLo === null || Rcmp(y, R(yLo)) >= 0) && (yHi === null || Rcmp(y, R(yHi)) < 0)
  const solve = (a) => {
    const pts = []                                          // рациональные точки
    const addPt = (x, y) => {
      if (!okX(x) || !okY(y)) return
      if (!pts.some(([u, w]) => Rcmp(u, x) === 0 && Rcmp(w, y) === 0)) pts.push([x, y])
    }
    if (!Rzero(a)) addPt(Rdiv(R(h), a), R(h))               // прямая y = h
    if (extraV !== null && !Rzero(a)) addPt(R(extraV), Rmul(a, R(extraV)))          // вертикаль x = v
    if (extraH !== null && !Rzero(a)) addPt(Rdiv(R(extraH), a), R(extraH))          // горизонталь y = w
    let n2 = 0
    if (Rsign(a) > 0) {                                     // гипербола: a·x² = k, k > 0
      const ka = Rmul(R(k), a), koa = Rdiv(R(k), a)         // ka = y², k/a = x²
      // корень «плюс»: x = √(k/a) > 0, y = √(ka) > 0
      let ok = true
      if (xHi !== null) ok = ok && Rcmp(koa, R(xHi * xHi)) <= 0 && xHi > 0
      if (yHi !== null) ok = ok && (yHi <= 0 ? false : Rcmp(ka, R(yHi * yHi)) < 0)
      if (ok) n2++
      // корень «минус»: x = −√(k/a) < 0, y = −√(ka) < 0
      let ok2 = true
      if (xLo !== null) ok2 = ok2 && (xLo >= 0 ? false : Rcmp(koa, R(xLo * xLo)) < 0)
      if (yLo !== null) ok2 = ok2 && (yLo > 0 ? false : Rcmp(ka, R(yLo * yLo)) <= 0)
      if (xHi !== null && xHi < 0) ok2 = false
      if (ok2) n2++
      // рациональная точка могла попасть на гиперболу — тогда она уже посчитана
      for (const [x, y] of pts) if (Rcmp(Rmul(x, y), R(k)) === 0) n2--
    }
    return pts.length + n2
  }
  const crit = [R0]
  if (xLo !== null) { crit.push(R(h, xLo), R(k, xLo * xLo)); if (extraH !== null) crit.push(R(extraH, xLo)) }
  if (xHi !== null) { crit.push(R(h, xHi), R(k, xHi * xHi)); if (extraH !== null) crit.push(R(extraH, xHi)) }
  if (yLo !== null) { crit.push(R(yLo * yLo, k)); if (extraV !== null) crit.push(R(yLo, extraV)) }
  if (yHi !== null) { crit.push(R(yHi * yHi, k)); if (extraV !== null) crit.push(R(yHi, extraV)) }
  crit.push(R(h * h, k))                                    // точка (h/a; h) попала на гиперболу
  if (extraV !== null) { crit.push(R(h, extraV), R(k, extraV * extraV)) }
  if (extraH !== null) { crit.push(R(extraH * extraH, k)) }
  return { set: assembleSet((a) => solve(a) === n, crit), solve }
}
function itemPencil(par, txt) {
  const { h, k, n } = par
  const { set, solve } = buildPencil(par)
  return item({
    text: `${HEAD_SYS} уравнений\n⟦cases:${txt.num}¦y = ax⟧\n\nимеет ровно ${n === 2 ? "два различных решения" : "три различных решения"}.`,
    set,
    solution: `Числитель раскладывается: (y ${MINUS} ${h})(xy ${MINUS} ${k}), поэтому кривая — это прямая y = ${h} и гипербола xy = ${k}${txt.extra}. ОДЗ: ${txt.odz}.\n`
      + `Прямая y = ax проходит через начало координат: с прямой y = ${h} она пересекается в точке x = ${h}/a, а с гиперболой — там, где ax${SUP[2]} = ${k}, `
      + `то есть при a > 0 в двух точках x = ±√(${k}/a).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a !== 0 ? h / a : null), label: `точка на y = ${h}` },
        { f: (a) => (a > 0 ? Math.sqrt(k / a) : null), label: "точки на гиперболе" },
        { f: (a) => (a > 0 ? -Math.sqrt(k / a) : null) },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 10, aMin: Rnum(setBounds(set)[0]) - 2,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 2,
    },
  })
}
const mkPencil = (rows, n) => rows
  .map(([h, k, xLo, xHi, yLo, yHi, extraV, extraH]) => ({ h, k, xLo, xHi, yLo, yHi, extraV, extraH, n }))
  .filter((par) => {
    const res = buildPencil(par)
    return setBounds(res.set).length > 0 && niceSet(res.set, 24n, 60n, 1, 4)
      && gridOk(res.set, res.solve, n) && gridOk60(res.set, (a) => res.solve(a) === n)
  })
// #60: ОДЗ x > v (корень в знаменателе), ровно два решения
const T60 = mkPencil([[3, 3, -3, null, null, null, null, null], [2, 4, -2, null, null, null, null, null],
  [3, 6, -3, null, null, null, null, null], [1, 4, -4, null, null, null, null, null],
  [2, 6, -3, null, null, null, null, null], [4, 4, -2, null, null, null, null, null]], 2)
export function t18SysPencilHyper() {
  const par = pick(T60), { h, k, xLo } = par
  return itemPencil(par, {
    num: `${fT(`xy${SUP[2]}${term(-h, "xy")}${term(-k, "y")}${term(h * k, "")}`, `√{x${term(-xLo, "")}}`)} = 0`,
    extra: "", odz: `x > ${nS(xLo)}`,
  })
}
// #61: множитель √(xHi − x) добавляет вертикаль x = xHi; ровно три решения
const T61 = mkPencil([[1, 3, null, 6, null, null, 6, null], [1, 4, null, 8, null, null, 8, null],
  [1, 6, null, 6, null, null, 6, null], [2, 3, null, 6, null, null, 6, null],
  [1, 3, null, 4, null, null, 4, null], [1, 8, null, 8, null, null, 8, null]], 3)
export function t18SysPencilVert() {
  const par = pick(T61), { h, k, xHi } = par
  return itemPencil(par, {
    num: `(xy${SUP[2]}${term(-h, "xy")}${term(-k, "y")}${term(h * k, "")})√{${xHi} ${MINUS} x} = 0`,
    extra: `, а множитель √(${xHi} ${MINUS} x) добавляет вертикаль x = ${xHi}`, odz: `x ≤ ${xHi}`,
  })
}
// #62: ОДЗ y < yHi (корень в знаменателе), ровно три решения
const T62 = mkPencil([[1, 5, null, null, null, 5, null, null], [1, 6, null, null, null, 6, null, null],
  [1, 4, null, null, null, 4, null, null], [2, 6, null, null, null, 6, null, null],
  [1, 8, null, null, null, 8, null, null], [1, 5, null, null, null, 6, null, null]], 3)
export function t18SysPencilYBound() {
  const par = pick(T62), { h, k, yHi } = par
  return itemPencil(par, {
    num: `${fT(`xy${SUP[2]}${term(-h, "xy")}${term(-k, "y")}${term(h * k, "")}`, `√{${yHi} ${MINUS} y}`)} = 0`,
    extra: "", odz: `y < ${yHi}`,
  })
}
// #63: множитель √(y − yLo) добавляет горизонталь y = yLo; ровно три решения
const T63 = mkPencil([[1, 6, null, null, -2, null, null, -2], [1, 4, null, null, -2, null, null, -2],
  [1, 8, null, null, -2, null, null, -2], [2, 6, null, null, -3, null, null, -3],
  [1, 6, null, null, -3, null, null, -3], [1, 12, null, null, -3, null, null, -3]], 3)
export function t18SysPencilHoriz() {
  const par = pick(T63), { h, k, yLo } = par
  return itemPencil(par, {
    num: `(xy${SUP[2]}${term(-h, "xy")}${term(-k, "y")}${term(h * k, "")})√{y${term(-yLo, "")}} = 0`,
    extra: `, а множитель √(y${term(-yLo, "")}) добавляет горизонталь y = ${nS(yLo)}`, odz: `y ≥ ${nS(yLo)}`,
  })
}

// #65. {((√(A − x²) − y)(x² + py − q))/(d − x²) = 0; y = 1 − 2a} — горизонталь и две кривые:
// верхняя полуокружность y = √(A − x²) и парабола y = (q − x²)/p; точки с x² = d выколоты.
// В эталоне A = 12 (иррациональная вершина), в аналоге берём A и A − d точными квадратами.
function build65({ A, p, q, d }) {
  const solve = (a) => {
    const t = Rsub(R1, Rmul(R(2), a))                       // высота горизонтали
    let n = 0
    // полуокружность: x² = A − t² при t ≥ 0
    if (Rsign(t) >= 0) {
      const x2 = Rsub(R(A), Rmul(t, t))
      if (Rsign(x2) >= 0 && Rcmp(x2, R(d)) !== 0) n += Rzero(x2) ? 1 : 2
    }
    // парабола: x² = q − pt, нужно ещё x² ≤ A (ОДЗ корня)
    const x2p = Rsub(R(q), Rmul(R(p), t))
    if (Rsign(x2p) >= 0 && Rcmp(x2p, R(A)) <= 0 && Rcmp(x2p, R(d)) !== 0) {
      // совпадение с точками полуокружности: тогда та же пара точек уже посчитана
      const same = Rsign(t) >= 0 && Rcmp(x2p, Rsub(R(A), Rmul(t, t))) === 0
      if (!same) n += Rzero(x2p) ? 1 : 2
    }
    return n
  }
  const tCrit = [R0, R(isSq(A)), R(q, p), R((q - A), p), R((q - d), p)]
  const s1 = isSq(A - d)
  if (s1 !== null) tCrit.push(R(s1), R(-s1))
  const crit = tCrit.map((t) => Rdiv(Rsub(R1, t), R(2)))     // a = (1 − t)/2
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
const T65 = []
for (const A of [9, 16, 25]) for (const d of [1, 4, 9, 16]) for (const p of [2, 3, 4]) for (const q of [6, 8, 9, 12, 16]) {
  if (d >= A || isSq(A - d) === null) continue
  const par = { A, p, q, d }
  const res = build65(par)
  if (!setBounds(res.set).length || !niceSet(res.set, 24n, 60n, 1, 4)) continue
  if (!gridOk(res.set, res.solve, 2) || !gridOk60(res.set, (a) => res.solve(a) === 2)) continue
  T65.push(par)
}
export function t18SysSemiParab() {
  const par = pick(T65), { A, p, q, d } = par
  const { set, solve } = build65(par)
  const num = `(√{${A} ${MINUS} x${SUP[2]}} ${MINUS} y)(x${SUP[2]} + ${p === 1 ? "" : p}y ${MINUS} ${q})`
  return item({
    text: `Найдите все значения параметра a, при которых система уравнений\n`
      + `⟦cases:${fT(num, `${d} ${MINUS} x${SUP[2]}`)} = 0¦y = 1 ${MINUS} 2a⟧\n\nимеет ровно два решения.`,
    set,
    solution: `Дробь равна нулю, когда числитель равен нулю, а знаменатель — нет: значит x${SUP[2]} ≠ ${d}.\n`
      + `Первый множитель даёт верхнюю полуокружность y = √(${A} ${MINUS} x${SUP[2]}) (ОДЗ: |x| ≤ ${isSq(A)}), второй — параболу y = (${q} ${MINUS} x${SUP[2]})/${p}.\n`
      + `Горизонталь y = 1 ${MINUS} 2a пересекает полуокружность в точках с x${SUP[2]} = ${A} ${MINUS} (1 ${MINUS} 2a)${SUP[2]} (при 1 ${MINUS} 2a ≥ 0), `
      + `а параболу — в точках с x${SUP[2]} = ${q} ${MINUS} ${p}(1 ${MINUS} 2a); выколотые точки с x${SUP[2]} = ${d} не считаются.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => { const t = 1 - 2 * a, x2 = A - t * t; return t >= 0 && x2 >= 0 ? Math.sqrt(x2) : null }, label: "на полуокружности" },
        { f: (a) => { const t = 1 - 2 * a, x2 = A - t * t; return t >= 0 && x2 >= 0 ? -Math.sqrt(x2) : null } },
        { f: (a) => { const x2 = q - p * (1 - 2 * a); return x2 >= 0 && x2 <= A ? Math.sqrt(x2) : null }, label: "на параболе" },
        { f: (a) => { const x2 = q - p * (1 - 2 * a); return x2 >= 0 && x2 <= A ? -Math.sqrt(x2) : null } },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -isSq(A) - 2, xMax: isSq(A) + 2, aMin: Rnum(setBounds(set)[0]) - 2,
      aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 2,
    },
  })
}

// =============================================================================
// РАЗДЕЛ T. Системы «две кривые» — «ровно N решений» (эталон #162–#187)
// =============================================================================
// Каждая строка системы — кривая в плоскости (x; y): точка, пара прямых, окружность,
// гипербола, полоса. Вопрос — о числе ОБЩИХ точек. Счёт остаётся точным: сравнения
// расстояний и радиусов сводятся к сравнению квадратов рациональных чисел, число корней
// квадратных уравнений считает Штурм, поэтому иррациональные радиусы в сравнения не попадают.

// Число общих точек двух окружностей по КВАДРАТАМ расстояния между центрами и радиусов.
// Ключ к точности: |r₁ − r₂| < d < r₁ + r₂ ⟺ (d² − r₁² − r₂²)² < 4r₁²r₂², а касание —
// равенство; корни извлекать не нужно. 99 — окружности совпали (бесконечно много решений).
function circleHits(d2, r12, r22) {
  if (Rsign(r12) < 0 || Rsign(r22) < 0) return 0
  if (Rzero(d2) && Rcmp(r12, r22) === 0) return Rzero(r12) ? 1 : 99
  const A = Rsub(Rsub(d2, r12), r22)
  const c = Rcmp(Rmul(A, A), Rmul(R(4), Rmul(r12, r22)))
  return c < 0 ? 2 : c === 0 ? 1 : 0
}
// «(a − r)» с человеческим знаком: при отрицательном r печатаем «(a + |r|)»
const facA = (r) => (Rsign(r) >= 0 ? `(a ${MINUS} ${Rstr(r)})` : `(a + ${Rstr(Rneg(r))})`)

// #162. {x² + y² + (p² + q²) = 2(px + qy); a² + ax + may = K} — «имеет решение».
// Первая строка — (x − p)² + (y − q)² = 0, то есть РОВНО ОДНА точка (p; q). Подстановка
// её во вторую строку превращает систему в квадратное уравнение по параметру.
function build162({ p, q, m, r1 }) {
  const S = p + m * q, r2 = -S - r1, K = -r1 * r2       // a² + Sa − K = (a − r1)(a − r2)
  const P = [R(-K), R(S), R1]
  return { set: SET([], uniqSorted([R(r1), R(r2)])), solve: (a) => (Rzero(pEval(P, a)) ? 1 : 0), S, K, r2 }
}
const T162 = []
for (const p of [1, 2, 3]) for (const q of [1, 2, 3]) for (const m of [1, 2, 3]) for (const r1 of [1, 2, 3]) T162.push({ p, q, m, r1 })
export function t18SysPointLine() {
  const par = pick(T162), { p, q, m, r1 } = par
  const { set, solve, S, K, r2 } = build162(par)
  return item({
    text: `${HEAD_SYS}\n⟦cases:x${SUP[2]} + y${SUP[2]} + ${p * p + q * q} = 2(${p === 1 ? "" : p}x + ${q === 1 ? "" : q}y)`
      + `¦a${SUP[2]} + ax + ${m === 1 ? "" : m}ay = ${K}⟧\n\nимеет решение.`,
    set,
    solution: `Первое уравнение: x${SUP[2]} ${MINUS} ${2 * p}x + ${p * p} + y${SUP[2]} ${MINUS} ${2 * q}y + ${q * q} = 0, то есть (x ${MINUS} ${p})${SUP[2]} + (y ${MINUS} ${q})${SUP[2]} = 0.\n`
      + `Сумма двух квадратов равна нулю только когда каждый равен нулю, поэтому первая строка задаёт единственную точку (${p}; ${q}).\n`
      + `Система имеет решение ровно тогда, когда эта точка подходит и ко второму уравнению: a${SUP[2]} + ${p}a + ${m * q}a = ${K}, то есть a${SUP[2]} + ${S}a ${MINUS} ${K} = 0.\n`
      + `Корни: a = ${nS(r1)} и a = ${nS(r2)}.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: () => p, dash: true, label: `точка (${p}; ${q})` }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2, xMax: p + 4, aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// #163. {((x − u₁)² + (y − v₁)²)((x − u₂)² + (y − v₂)²) ≤ 0; (x − a)² + (y − 2a)² ≤ 4a²}.
// Первый множитель — произведение двух неотрицательных выражений: произведение ≤ 0 только
// если один из множителей равен нулю, то есть решения первой строки — ДВЕ точки.
// Точка (u; v) лежит в круге ⟺ a² − 2(u + 2v)a + u² + v² ≤ 0 (коэффициент 1 + 4 − 4 = 1),
// то есть a лежит на отрезке между корнями (u + 2v) ± √(v(4u + 3v)).
const disk163 = (u, v, a) => Rsign(Radd(Rsub(Rmul(a, a), Rmul(R(2 * (u + 2 * v)), a)), R(u * u + v * v))) <= 0
const roots163 = (u, v) => {
  const g = Math.round(Math.sqrt(v * (4 * u + 3 * v)))
  return g * g === v * (4 * u + 3 * v) ? [R(u + 2 * v - g), R(u + 2 * v + g)] : null
}
function build163({ u1, v1, u2, v2 }) {
  const r1 = roots163(u1, v1), r2 = roots163(u2, v2)
  if (!r1 || !r2) return null
  const solve = (a) => (disk163(u1, v1, a) ? 1 : 0) + (disk163(u2, v2, a) ? 1 : 0)
  return { set: assembleSet((a) => solve(a) === 1, [...r1, ...r2]), solve, r1, r2 }
}
const T163 = [
  [1, 4, 6, 4], [3, 2, 11, 2], [3, 2, 1, 4], [11, 2, 13, 4], [6, 4, 9, 6],
  [2, 8, 12, 8], [1, 4, 11, 2], [3, 2, 6, 4], [9, 6, 13, 4], [1, 4, 13, 4],
].map(([u1, v1, u2, v2]) => ({ u1, v1, u2, v2 }))
export function t18SysTwoPointsDisk() {
  const par = pick(T163), { u1, v1, u2, v2 } = par
  const { set, solve, r1, r2 } = build163(par)
  const pt = (u, v) => `(x ${MINUS} ${u})${SUP[2]} + (y ${MINUS} ${v})${SUP[2]}`
  return item({
    text: `${HEAD_SYS}\n⟦cases:(${pt(u1, v1)})(${pt(u2, v2)}) ≤ 0¦(x ${MINUS} a)${SUP[2]} + (y ${MINUS} 2a)${SUP[2]} ≤ 4a${SUP[2]}⟧\n\nимеет ровно одно решение.`,
    set,
    solution: `Оба множителя в первой строке неотрицательны, поэтому произведение ≤ 0 только если один из них равен нулю: `
      + `решения первой строки — две точки A(${u1}; ${v1}) и B(${u2}; ${v2}).\n`
      + `Вторая строка — круг с центром (a; 2a) радиуса 2|a|: центр бежит по прямой y = 2x, радиус растёт вместе с |a|.\n`
      + `Точка (u; v) лежит в круге ⟺ (u ${MINUS} a)${SUP[2]} + (v ${MINUS} 2a)${SUP[2]} ≤ 4a${SUP[2]} ⟺ a${SUP[2]} ${MINUS} 2(u + 2v)a + u${SUP[2]} + v${SUP[2]} ≤ 0.\n`
      + `Для A это a ∈ [${Rstr(r1[0])}; ${Rstr(r1[1])}], для B — a ∈ [${Rstr(r2[0])}; ${Rstr(r2[1])}]. Ровно одно решение — когда a попадает ровно в один из этих отрезков.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => a, label: "центр круга: x = a" }, { f: (a) => 3 * a, dash: true, label: "правый край круга" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2, xMax: Math.max(u1, u2) + 4,
      aMin: Rnum(setBounds(set)[0]) - 3, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #167. {(x + ay − c)(x + ay − ca) = 0; x² + y² = R²} — «ровно четыре различных решения».
// Первая строка — две ПАРАЛЛЕЛЬНЫЕ прямые x + ay = c и x + ay = ca (общая нормаль (1; a)).
// Прямая x + ay = d пересекает окружность в двух точках ⟺ d² < R²(1 + a²).
// При a = 1 прямые совпадают, и решений остаётся вдвое меньше.
function build167({ c, rad, g }) {                       // g² = c² − rad², g < rad
  const solve = (a) => {
    const hits = (d) => {
      const cc = Rcmp(Rmul(d, d), Rmul(R(rad * rad), Radd(R1, Rmul(a, a))))
      return cc < 0 ? 2 : cc === 0 ? 1 : 0
    }
    const n1 = hits(R(c))
    return Rcmp(a, R1) === 0 ? n1 : n1 + hits(Rmul(R(c), a))
  }
  const crit = [R1, R(g, rad), R(-g, rad), R(rad, g), R(-rad, g)]
  return { set: assembleSet((a) => solve(a) === 4, crit), solve }
}
const T167 = [[5, 4, 3], [10, 8, 6], [13, 12, 5], [17, 15, 8], [25, 24, 7], [29, 21, 20]]
  .map(([c, rad, g]) => ({ c, rad, g }))
export function t18SysParallelCircle() {
  const par = pick(T167), { c, rad, g } = par
  const { set, solve } = build167(par)
  return item({
    text: `${HEAD_SYS}\n⟦cases:(x + ay ${MINUS} ${c})(x + ay ${MINUS} ${c}a) = 0¦x${SUP[2]} + y${SUP[2]} = ${rad * rad}⟧\n\nимеет ровно четыре различных решения.`,
    set,
    solution: `Первая строка — две параллельные прямые x + ay = ${c} и x + ay = ${c}a: у них общий вектор нормали (1; a), а при a = 1 они совпадают.\n`
      + `Расстояние от начала координат до прямой x + ay = d равно |d| : ⟦r:1 + a${SUP[2]}⟧, поэтому такая прямая пересекает окружность радиуса ${rad} в двух точках ⟺ d${SUP[2]} < ${rad * rad}(1 + a${SUP[2]}).\n`
      + `Четыре различных решения — когда каждая из прямых даёт по две точки и прямые не совпали:\n`
      + `${c * c} < ${rad * rad}(1 + a${SUP[2]}) ⟺ |a| > ${Rstr(R(g, rad))}; ${c * c}a${SUP[2]} < ${rad * rad}(1 + a${SUP[2]}) ⟺ |a| < ${Rstr(R(rad, g))};   a ≠ 1.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 4 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => rad, dash: true, label: "края окружности" }, { f: () => -rad, dash: true },
        { f: () => c, label: "первая прямая при y = 0" }, { f: (a) => c * a, label: "вторая прямая при y = 0" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -rad - 2, xMax: rad + 2, aMin: -3, aMax: 3,
    },
  })
}

// #170. {y = (a + p)x² + 2ax + a − p; y² = k²x²} — «ровно четыре различных решения».
// Вторая строка — пара прямых y = ±kx. Подстановка даёт два квадратных уравнения
// (a + p)x² + (2a ∓ k)x + (a − p) = 0 с дискриминантами ∓4ka + k² + 4p².
// Ненулевые корни двух уравнений различны всегда; совпасть может только x = 0 (при a = p).
function build170({ p, k }) {
  const quads = (a) => [
    [Rsub(a, R(p)), Rsub(Rmul(R(2), a), R(k)), Radd(a, R(p))],
    [Rsub(a, R(p)), Radd(Rmul(R(2), a), R(k)), Radd(a, R(p))],
  ]
  const solve = (a) => {
    let n = 0
    for (const q of quads(a)) n += countRoots(q, "-inf", "+inf", false, false)
    if (Rcmp(a, R(p)) === 0) n -= 1                      // начало координат посчитано дважды
    return n
  }
  const B = R(k * k + 4 * p * p, 4 * k)
  return { set: assembleSet((a) => solve(a) === 4, [B, Rneg(B), R(p), R(-p)]), solve, B }
}
const T170 = []
for (const p of [1, 2, 3, 4]) for (const k of [1, 2, 3]) if (k !== 2 * p) T170.push({ p, k })
export function t18SysParabolaCross() {
  const par = pick(T170), { p, k } = par
  const { set, solve, B } = build170(par)
  const kx = k === 1 ? "x" : `${k}x`
  return item({
    text: `${HEAD_SYS}\n⟦cases:y = (a + ${p})x${SUP[2]} + 2ax + a ${MINUS} ${p}¦y${SUP[2]} = ${k * k === 1 ? "" : k * k}x${SUP[2]}⟧\n\nимеет ровно четыре различных решения.`,
    set,
    solution: `Вторая строка ⟺ y = ${kx} или y = ${MINUS}${kx}.\n`
      + `Подстановка y = ${kx}: (a + ${p})x${SUP[2]} + (2a ${MINUS} ${k})x + a ${MINUS} ${p} = 0, дискриминант равен ${MINUS}${4 * k}a + ${k * k + 4 * p * p}.\n`
      + `Подстановка y = ${MINUS}${kx}: (a + ${p})x${SUP[2]} + (2a + ${k})x + a ${MINUS} ${p} = 0, дискриминант равен ${4 * k}a + ${k * k + 4 * p * p}.\n`
      + `Оба положительны ⟺ |a| < ${Rstr(B)}. При a = ${MINUS}${p} обнуляется старший коэффициент (каждое уравнение даёт по одному корню — всего два решения), `
      + `а при a = ${p} у обоих уравнений появляется общий корень x = 0, и различных решений три.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 4 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (Math.abs(a + p) < 1e-9 ? null : (k - 2 * a + Math.sqrt(Math.max(0, -4 * k * a + k * k + 4 * p * p))) / (2 * (a + p))), label: `x на прямой y = ${kx}` },
        { f: (a) => (Math.abs(a + p) < 1e-9 ? null : (-k - 2 * a + Math.sqrt(Math.max(0, 4 * k * a + k * k + 4 * p * p))) / (2 * (a + p))), label: `x на прямой y = ${MINUS}${kx}` },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -6, xMax: 6, aMin: Rnum(setBounds(set)[0]) - 2, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 2,
    },
  })
}

// #172. {x² + y² = a²; xy = a² − ka} — «ровно два различных решения».
// Через s = x + y и p = xy: s² = x² + y² + 2xy = 3a² − 2ka, а сами x, y — корни
// t² − st + p = 0 с дискриминантом s² − 4p = 2ka − a². Число решений — произведение
// «сколько значений s» × «сколько корней t при каждом s».
function build172({ k }) {
  const solve = (a) => {
    const S = Rmul(a, Rsub(Rmul(R(3), a), R(2 * k)))
    const D = Rmul(a, Rsub(R(2 * k), a))
    if (Rsign(S) < 0 || Rsign(D) < 0) return 0
    return (Rsign(S) > 0 ? 2 : 1) * (Rsign(D) > 0 ? 2 : 1)
  }
  return { set: assembleSet((a) => solve(a) === 2, [R0, R(2 * k, 3), R(2 * k)]), solve }
}
const T172 = [1, 2, 3, 4, 5, 6, 9, 12].map((k) => ({ k }))
export function t18SysCircleHyperbola() {
  const par = pick(T172), { k } = par
  const { set, solve } = build172(par)
  const ka = k === 1 ? "a" : `${k}a`
  return item({
    text: `${HEAD_SYS}\n⟦cases:x${SUP[2]} + y${SUP[2]} = a${SUP[2]}¦xy = a${SUP[2]} ${MINUS} ${ka}⟧\n\nимеет ровно два различных решения.`,
    set,
    solution: `Обозначим s = x + y и p = xy = a${SUP[2]} ${MINUS} ${ka}. Тогда s${SUP[2]} = x${SUP[2]} + y${SUP[2]} + 2xy = a${SUP[2]} + 2(a${SUP[2]} ${MINUS} ${ka}) = 3a${SUP[2]} ${MINUS} ${2 * k}a.\n`
      + `Сами x и y — корни уравнения t${SUP[2]} ${MINUS} st + p = 0 с дискриминантом s${SUP[2]} ${MINUS} 4p = ${2 * k}a ${MINUS} a${SUP[2]}.\n`
      + `Если 3a${SUP[2]} ${MINUS} ${2 * k}a > 0, значений s два, при равенстве нулю — одно (s = 0), при отрицательном решений нет. `
      + `Каждое s даёт две пары (x; y) при положительном дискриминанте и одну при нулевом.\n`
      + `Значит ровно две пары получаются в двух случаях: 3a${SUP[2]} = ${2 * k}a, то есть a = ${Rstr(R(2 * k, 3))} (дискриминант ещё положителен), и ${2 * k}a = a${SUP[2]}, то есть a = ${2 * k}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (3 * a * a - 2 * k * a >= 0 ? Math.sqrt(3 * a * a - 2 * k * a) : null), label: "s = x + y" },
        { f: (a) => (3 * a * a - 2 * k * a >= 0 ? -Math.sqrt(3 * a * a - 2 * k * a) : null) },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2 * k - 2, xMax: 2 * k + 2, aMin: -2, aMax: 2 * k + 4,
    },
  })
}

// #174. {x² + y² = 2px + 2qy; x² + y² = 2(p + tqa)x + 2(q − tpa)y − t²(p² + q²)a²}.
// Обе строки — окружности ОДНОГО радиуса √(p² + q²): свободный член второй подобран так,
// что квадрат радиуса не зависит от a. Центры (p; q) и (p + tqa; q − tpa), расстояние
// между ними d = t√(p² + q²)·|a|. Две точки пересечения ⟺ 0 < d < 2r.
function build174({ p, q, t, sg }) {
  const rho = p * p + q * q
  const solve = (a) => circleHits(Rmul(R(t * t * rho), Rmul(a, a)), R(rho), R(rho))
  return { set: assembleSet((a) => solve(a) === 2, [R0, R(2, t), R(-2, t)]), solve, rho, A: sg * t * q, B: sg * t * p }
}
const T174 = []
for (const [p, q] of [[1, 1], [2, 1], [1, 2], [3, 1], [1, 3], [3, 2], [2, 3]]) for (const t of [1, 2, 3]) for (const sg of [1, -1]) T174.push({ p, q, t, sg })
export function t18SysTwoCircles() {
  const par = pick(T174), { p, q, t } = par
  const { set, solve, rho, A, B } = build174(par)
  const c1 = `${p}${term(A, "a")}`, c2 = `${q}${term(-B, "a")}`
  return item({
    text: `${HEAD_SYS}\n⟦cases:x${SUP[2]} + y${SUP[2]} = ${2 * p === 1 ? "" : 2 * p}x + ${2 * q === 1 ? "" : 2 * q}y`
      + `¦x${SUP[2]} + y${SUP[2]} = 2(${c1})x + 2(${c2})y ${MINUS} ${t * t * rho}a${SUP[2]}⟧\n\nимеет ровно два различных решения.`,
    set,
    solution: `Первая строка: (x ${MINUS} ${p})${SUP[2]} + (y ${MINUS} ${q})${SUP[2]} = ${rho} — окружность с центром (${p}; ${q}) и радиусом ⟦r:${rho}⟧.\n`
      + `Вторая: (x ${MINUS} (${c1}))${SUP[2]} + (y ${MINUS} (${c2}))${SUP[2]} = ${rho} — радиус тот же, а центр с ростом a бежит по прямой.\n`
      + `Квадрат расстояния между центрами d${SUP[2]} = ${A * A + B * B}a${SUP[2]}. У двух окружностей равного радиуса ровно две общие точки ⟺ 0 < d < 2⟦r:${rho}⟧, `
      + `то есть 0 < ${A * A + B * B}a${SUP[2]} < ${4 * rho} (при a = 0 окружности совпадают, и решений бесконечно много).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: () => p, dash: true, label: "центр первой" }, { f: (a) => p + A * a, label: "центр второй" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -6, xMax: 6, aMin: -4, aMax: 4,
    },
  })
}

// #175. {(x − ka + m)² + (y − a)² = r²; (x + m)² + (y − a)² = (a + c)²} при a > 0 —
// «единственное решение». Центры (ka − m; a) и (−m; a) лежат на одной горизонтали,
// поэтому d = ka. Единственная общая точка — касание: d = r + (a + c) или d = |r − (a + c)|.
function build175({ k, r, c }) {                         // m — только сдвиг по x, на ответ не влияет
  const solve = (a) => {
    if (Rsign(a) <= 0) return 0                          // ищем только положительные a
    const rr = Radd(a, R(c))
    return circleHits(Rmul(R(k * k), Rmul(a, a)), R(r * r), Rmul(rr, rr))
  }
  const crit = [R0]
  for (const s of [1, -1]) {
    const base = [Radd(R(r), R(s * c)), R(s)]            // r + s(a + c)
    const { roots, allRational } = ratRoots(pSub([R0, R0, R(k * k)], pMul(base, base)))
    if (!allRational) return null
    crit.push(...roots)
  }
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
// Все наборы с c ≠ r дают ровно две точки касания с круглыми координатами
// ((r + c)/(k − 1) и (c − r)/(k − 1) либо (r − c)/(k + 1)) — отбирать нечего.
const T175 = []
for (const k of [2, 3]) for (const m of [1, 2, 3]) for (const r of [1, 2, 3, 4]) for (const c of [1, 2, 3, 4, 5]) {
  if (c !== r) T175.push({ k, m, r, c })
}
export function t18SysCirclesTangent() {
  const par = pick(T175), { k, m, r, c } = par
  const { set, solve } = build175(par)
  const ka = k === 1 ? "a" : `${k}a`
  return item({
    text: `Найдите все положительные значения a, при каждом из которых система\n`
      + `⟦cases:(x ${MINUS} ${ka} + ${m})${SUP[2]} + (y ${MINUS} a)${SUP[2]} = ${r * r}`
      + `¦(x + ${m})${SUP[2]} + (y ${MINUS} a)${SUP[2]} = a${SUP[2]} + ${2 * c === 1 ? "" : 2 * c}a + ${c * c}⟧\n\nимеет единственное решение.`,
    set,
    solution: `Первая строка — окружность с центром O₁(${ka} ${MINUS} ${m}; a) и радиусом ${r}.\n`
      + `Во второй строке a${SUP[2]} + ${2 * c === 1 ? "" : 2 * c}a + ${c * c} = (a + ${c})${SUP[2]}, то есть это окружность с центром O₂(${MINUS}${m}; a) и радиусом a + ${c} (он положителен при a > 0).\n`
      + `Ординаты центров совпадают, поэтому расстояние между ними d = ${ka}.\n`
      + `Общая точка ровно одна ⟺ окружности касаются: ${ka} = ${r} + a + ${c} (внешнее касание) или ${ka} = |${r} ${MINUS} a ${MINUS} ${c}| (внутреннее).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => k * a - m, label: "центр O₁" }, { f: () => -m, dash: true, label: "центр O₂" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -m - 3, xMax: m + 8, aMin: -2, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// #176. {x² + y² − 2(α₁x + β₁y)a = u² − 2ua + (1 − α₁² − β₁²)a²; то же со (α₂, β₂, v)}
// — «НЕ имеет решений». Каждая строка — окружность с центром (α·a; β·a) и радиусом |a − u|.
// Расстояние между центрами d = k|a|, где k² = (α₁ − α₂)² + (β₁ − β₂)². Решений нет ⟺
// d > r₁ + r₂ или d < |r₁ − r₂|, а это в обоих случаях равносильно
// (k²a² − (2a − u − v)²)(k²a² − (u − v)²) > 0 — сюда не входят сами модули.
function build176({ a1, b1, a2, b2, u, v }) {
  const Q = (a1 - a2) ** 2 + (b1 - b2) ** 2
  const kk = Math.round(Math.sqrt(Q))
  if (kk * kk !== Q || kk === 2 || u === v || u === -v) return null
  const solve = (a) => {
    const du = Rsub(a, R(u)), dv = Rsub(a, R(v))
    return circleHits(Rmul(R(Q), Rmul(a, a)), Rmul(du, du), Rmul(dv, dv))
  }
  const crit = [R(u + v, 2 - kk), R(u + v, kk + 2), R(u - v, kk), R(v - u, kk)]
  return { set: assembleSet((a) => solve(a) === 0, crit), solve, kk }
}
// Пары (α₁ − α₂; β₁ − β₂) — пифагоровы (расстояние между центрами k|a| рационально),
// поэтому все наборы проходят: границы ответа — (u + v)/(2 ∓ k) и ±(u − v)/k.
const T176 = []
for (const c of [[1, -1, -3, -4], [2, 1, -2, -2], [1, 1, -3, -2], [1, -1, 4, 3], [1, 2, -2, -2], [3, 1, -1, -2], [1, 1, -2, 1], [2, -1, -1, 3]]) {
  for (const [u, v] of [[3, 1], [4, 2], [2, 5], [5, 1], [1, 4], [6, 2], [2, 7]]) {
    T176.push({ a1: c[0], b1: c[1], a2: c[2], b2: c[3], u, v })
  }
}
// «x² + y² − 2(αx + βy)a»: при α < 0 выносим знак наружу, чтобы запись выглядела как в ФИПИ
function centerTxt176(al, be) {
  const flip = al < 0
  const g = (x, y) => (y ? g(y, x % y) : Math.abs(x))
  const t = g(al, be)                                    // общий множитель выносим за скобку
  const A = (flip ? -al : al) / t, B = (flip ? -be : be) / t
  return `x${SUP[2]} + y${SUP[2]} ${flip ? "+" : MINUS} ${2 * t === 1 ? "" : 2 * t}(${A === 1 ? "" : A}x${term(B, "y")})a`
}
export function t18SysCirclesNoSol() {
  const par = pick(T176), { a1, b1, a2, b2, u, v } = par
  const { set, solve, kk } = build176(par)
  const rhs = (w, al, be) => `${w * w}${term(-2 * w, "a")}${term(1 - al * al - be * be, `a${SUP[2]}`)}`
  const ca = (c) => `${c < 0 ? MINUS : ""}${Math.abs(c) === 1 ? "" : Math.abs(c)}a`   // «−a», «3a»
  const sq = (v, c) => `(${v}${term(-c, "a")})${SUP[2]}`                              // «(x − 2a)²», «(y + a)²»
  const cen = (al, be) => `(${ca(al)}; ${ca(be)})`
  return item({
    text: `${HEAD_SYS}\n⟦cases:${centerTxt176(a1, b1)} = ${rhs(u, a1, b1)}¦${centerTxt176(a2, b2)} = ${rhs(v, a2, b2)}⟧\n\nне имеет решений.`,
    set,
    solution: `Соберём полные квадраты. Первая строка: ${sq("x", a1)} + ${sq("y", b1)} = (a ${MINUS} ${u})${SUP[2]} — `
      + `окружность с центром ${cen(a1, b1)} и радиусом |a ${MINUS} ${u}|.\n`
      + `Вторая: ${sq("x", a2)} + ${sq("y", b2)} = (a ${MINUS} ${v})${SUP[2]} — центр ${cen(a2, b2)}, радиус |a ${MINUS} ${v}|.\n`
      + `Расстояние между центрами d = ${kk}|a|. Общих точек нет ⟺ d > r₁ + r₂ или d < |r₁ ${MINUS} r₂|; `
      + `после возведения в квадрат оба случая складываются в одно неравенство\n`
      + `(${kk * kk}a${SUP[2]} ${MINUS} (2a ${MINUS} ${u + v})${SUP[2]})(${kk * kk}a${SUP[2]} ${MINUS} ${(u - v) * (u - v)}) > 0.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "none" },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => a1 * a, label: "центр первой" }, { f: (a) => a2 * a, label: "центр второй" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 8, aMin: Rnum(setBounds(set)[0]) - 3, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #177. {px² + py² = kxy; (x − a)² + (y − a)² = ρa⁴} — «ровно два решения».
// Первая строка распадается на пару прямых y = λx и y = x/λ (p = λ, k = 1 + λ²).
// Подстановка в окружность даёт квадратные уравнения, у которых четверть дискриминанта
// равна a²[ρ(1 + λ²)a² − (λ − 1)²] — для обеих прямых знак один и тот же.
function build177({ lam, rho }) {
  const w = Math.round(Math.sqrt(rho * (1 + lam * lam)))
  const solve = (a) => {
    if (Rzero(a)) return 1                               // окружность выродилась в точку (0; 0)
    const D = Rsub(Rmul(R(rho * (1 + lam * lam)), Rmul(a, a)), R((lam - 1) * (lam - 1)))
    const s = Rsign(D)
    if (s < 0) return 0
    if (s === 0) return 2                                // по одной точке касания на каждой прямой
    const a2 = Rmul(a, a)
    const onO = Rzero(Rsub(Rmul(R(2), a2), Rmul(R(rho), Rmul(a2, a2))))
    return onO ? 3 : 4                                   // начало координат лежит на обеих прямых
  }
  return { set: assembleSet((a) => solve(a) === 2, [R0, R(lam - 1, w), R(-(lam - 1), w)]), solve, w }
}
const T177 = [[2, 5], [2, 20], [2, 45], [3, 10], [3, 40], [4, 17], [5, 26]].map(([lam, rho]) => ({ lam, rho }))
export function t18SysLinesCircle() {
  const par = pick(T177), { lam, rho } = par
  const { set, solve, w } = build177(par)
  const p = lam, k = 1 + lam * lam
  return item({
    text: `${HEAD_SYS}\n⟦cases:${p}x${SUP[2]} + ${p}y${SUP[2]} = ${k}xy¦(x ${MINUS} a)${SUP[2]} + (y ${MINUS} a)${SUP[2]} = ${rho}a${SUP[4]}⟧\n\nимеет ровно два решения.`,
    set,
    solution: `Первая строка: ${p}x${SUP[2]} ${MINUS} ${k}xy + ${p}y${SUP[2]} = 0 ⟺ (y ${MINUS} ${lam}x)(${lam}y ${MINUS} x) = 0, то есть y = ${lam}x или ${lam}y = x.\n`
      + `Вторая — окружность с центром (a; a) и радиусом ⟦r:${rho}⟧·a${SUP[2]}.\n`
      + `Подстановка y = ${lam}x даёт ${1 + lam * lam}x${SUP[2]} ${MINUS} ${2 * (1 + lam)}ax + 2a${SUP[2]} ${MINUS} ${rho}a${SUP[4]} = 0; четверть дискриминанта равна a${SUP[2]}(${rho * (1 + lam * lam)}a${SUP[2]} ${MINUS} ${(lam - 1) * (lam - 1)}), `
      + `и для второй прямой знак дискриминанта тот же.\n`
      + `При |a| > ${Rstr(R(lam - 1, w))} каждая прямая даёт по две точки (всего четыре), при 0 < |a| < ${Rstr(R(lam - 1, w))} — ни одной, при a = 0 окружность вырождается в точку (0; 0) (одно решение). `
      + `Ровно две точки — когда обе прямые касательные.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a, dash: true, label: "центр окружности" },
        { f: (a) => (a * (1 + lam)) / (1 + lam * lam), label: "точка касания" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -4, xMax: 4, aMin: -4, aMax: 4,
    },
  })
}

// #178. {(x − b)(x + g) ≤ 0; f·x² + f·y² − 2fa(x − y) − 2fh·y + (2f − 1)a² − (2fh + e)a + fh² = 0}
// — «единственное решение». Первая строка — вертикальная полоса −g ≤ x ≤ b. Вторая после
// сборки квадратов: (x − a)² + (y + a − h)² = a(a + e)/f — ОКРУЖНОСТЬ (кривая, не круг!),
// центр которой движется по прямой, а радиус зависит от a. У полосы и окружности ровно одна
// общая точка либо когда радиус равен нулю и центр внутри полосы, либо при касании края
// полосы снаружи; во всех остальных непустых случаях общая часть — дуга.
function build178({ e, f, b, g }) {
  const solve = (a) => {
    const r2 = Rdiv(Rmul(a, Radd(a, R(e))), R(f))
    if (Rsign(r2) < 0) return 0
    if (Rzero(r2)) return Rcmp(a, R(-g)) >= 0 && Rcmp(a, R(b)) <= 0 ? 1 : 0
    const cmpR = (t) => (Rsign(t) < 0 ? 1 : Rcmp(r2, Rmul(t, t)))   // сравнение радиуса с t
    const dr = cmpR(Rsub(a, R(b))), dl = cmpR(Rsub(R(-g), a))
    if (dr < 0 || dl < 0) return 0                       // окружность целиком вне полосы
    if (dr === 0 || dl === 0) return 1                   // касание края полосы
    return 99                                            // дуга внутри полосы
  }
  const crit = [R0, R(-e)]
  for (const [A, B, C] of [[f - 1, -(2 * f * b + e), f * b * b], [f - 1, 2 * f * g - e, f * g * g]]) {
    const { roots, allRational } = ratRoots([R(C), R(B), R(A)])
    if (!allRational) return null
    crit.push(...roots)
  }
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
// Наборы (e, f, b, g) найдены разовым перебором e ≤ 6, f ≤ 12, b, g ≤ 3 этим же движком:
// оба уравнения касания ((f−1)a² − (2fb+e)a + fb² = 0 и (f−1)a² + (2fg−e)a + fg² = 0)
// обязаны иметь рациональные корни, а ответ — не меньше трёх круглых точек.
const T178 = [
  [1, 2, 2, 1], [1, 2, 2, 3], [1, 3, 1, 1], [1, 3, 1, 2], [1, 5, 2, 1], [1, 5, 2, 3], [1, 6, 1, 1], [1, 6, 1, 2],
  [1, 6, 3, 1], [1, 6, 3, 2], [1, 7, 2, 1], [1, 7, 2, 3], [1, 10, 1, 1], [1, 10, 1, 2], [1, 12, 2, 1], [1, 12, 2, 3],
  [2, 3, 2, 2], [2, 5, 1, 2], [2, 5, 1, 3], [2, 6, 2, 2], [2, 8, 1, 2], [2, 8, 1, 3], [2, 8, 3, 2], [2, 8, 3, 3],
  [2, 10, 2, 2], [3, 3, 3, 3], [3, 4, 2, 3], [3, 6, 3, 3], [3, 7, 1, 3], [3, 7, 2, 3], [3, 10, 1, 3], [3, 10, 3, 3],
].map(([e, f, b, g]) => ({ e, f, b, g }))
export function t18SysStripCircle() {
  const par = pick(T178), { e, f, b, g } = par
  const h = pick([2, 3, 4])
  const { set, solve } = build178(par)
  return item({
    text: `${HEAD_SYS}\n⟦cases:(x ${MINUS} ${b})(x + ${g}) ≤ 0`
      + `¦${f}x${SUP[2]} + ${f}y${SUP[2]} ${MINUS} ${2 * f}a(x ${MINUS} y) ${MINUS} ${2 * f * h}y + ${2 * f - 1}a${SUP[2]} ${MINUS} ${2 * f * h + e}a + ${f * h * h} = 0⟧\n\nимеет единственное решение.`,
    set,
    solution: `Первая строка задаёт полосу ${MINUS}${g} ≤ x ≤ ${b}.\n`
      + `Во второй разделим всё на ${f} и соберём полные квадраты: (x ${MINUS} a)${SUP[2]} + (y + a ${MINUS} ${h})${SUP[2]} = ${fT(`a(a + ${e})`, `${f}`)}. `
      + `Это окружность с центром (a; ${h} ${MINUS} a) и квадратом радиуса r${SUP[2]} = a(a + ${e})/${f}; она существует при a(a + ${e}) ≥ 0.\n`
      + `Полоса и окружность имеют ровно одну общую точку в двух случаях: r = 0 и центр лежит в полосе (a = 0 или a = ${MINUS}${e}), `
      + `либо окружность касается края полосы снаружи — a ${MINUS} r = ${b} при a > ${b} или a + r = ${MINUS}${g} при a < ${MINUS}${g}. `
      + `Во всех остальных случаях общая часть либо пуста, либо содержит целую дугу.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => b, dash: true, label: "края полосы" }, { f: () => -g, dash: true },
        { f: (a) => a - Math.sqrt(Math.max(0, (a * (a + e)) / f)), label: "левый край окружности" },
        { f: (a) => a + Math.sqrt(Math.max(0, (a * (a + e)) / f)), label: "правый край" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -g - 5, xMax: b + 5, aMin: Rnum(setBounds(set)[0]) - 3, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #165. {x⁴ − y⁴ = pa − q; x² + y² = a} — «ровно четыре различных решения».
// Замена u = x² ≥ 0, v = y² ≥ 0: u + v = a и a(u − v) = pa − q, откуда при a ≠ 0
// u = (a² + pa − q)/(2a), v = (a² − pa + q)/(2a). Четыре решения ⟺ u > 0 и v > 0
// (каждое даёт по два значения x и y). Коэффициенты подобраны так, чтобы ОБА трёхчлена
// раскладывались над Q: p² + 4q и p² − 4q — полные квадраты (то есть 2p² = s² + t²).
function build165({ p, q }) {
  const num = (sg) => [R(sg > 0 ? -q : q), R(sg * p), R1]          // a² ± pa ∓ q
  const solve = (a) => {
    if (Rzero(a)) return 0
    const u = Rdiv(pEval(num(1), a), Rmul(R(2), a)), v = Rdiv(pEval(num(-1), a), Rmul(R(2), a))
    if (Rsign(u) < 0 || Rsign(v) < 0) return 0
    return (Rsign(u) > 0 ? 2 : 1) * (Rsign(v) > 0 ? 2 : 1)
  }
  const crit = [R0]
  const fac = []
  for (const sg of [1, -1]) {
    const { roots, allRational } = ratRoots(num(sg))
    if (!allRational || roots.length !== 2) return null
    crit.push(...roots)
    fac.push(roots)
  }
  return { set: assembleSet((a) => solve(a) === 4, crit), solve, fac }
}
const T165 = [[5, 6], [10, 24], [13, 30], [15, 54], [17, 60], [20, 96], [25, 84]].map(([p, q]) => ({ p, q }))
export function t18SysQuarticDiff() {
  const par = pick(T165), { p, q } = par
  const { set, solve, fac } = build165(par)
  return item({
    text: `${HEAD_SYS}\n⟦cases:x${SUP[4]} ${MINUS} y${SUP[4]} = ${p}a ${MINUS} ${q}¦x${SUP[2]} + y${SUP[2]} = a⟧\n\nимеет ровно четыре различных решения.`,
    set,
    solution: `Обозначим u = x${SUP[2]} ≥ 0 и v = y${SUP[2]} ≥ 0. Тогда u + v = a, а x${SUP[4]} ${MINUS} y${SUP[4]} = (u ${MINUS} v)(u + v) = a(u ${MINUS} v) = ${p}a ${MINUS} ${q}.\n`
      + `При a = 0 первая строка даёт ${MINUS}${q} = 0 — решений нет. При a ≠ 0 получаем u ${MINUS} v = (${p}a ${MINUS} ${q})/a, откуда\n`
      + `u = ${fT(`a${SUP[2]} + ${p}a ${MINUS} ${q}`, "2a")} = ${fT(`${facA(fac[0][0])}${facA(fac[0][1])}`, "2a")}, `
      + `v = ${fT(`a${SUP[2]} ${MINUS} ${p}a + ${q}`, "2a")} = ${fT(`${facA(fac[1][0])}${facA(fac[1][1])}`, "2a")}.\n`
      + `Каждое из условий u > 0 и v > 0 даёт по два значения (x = ±⟦r:u⟧, y = ±⟦r:v⟧), значит четыре различных решения получаются ровно тогда, когда u > 0 и v > 0 одновременно.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 4 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a !== 0 ? (a * a + p * a - q) / (2 * a) : null), label: "u = x²" },
        { f: (a) => (a !== 0 ? (a * a - p * a + q) / (2 * a) : null), label: "v = y²" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -4, xMax: 12, aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 6,
    },
  })
}


// #173. {(x + αa + β)² + (y + γa + δ)² = ma + n; Ax + By = ea + f} — «более одного решения».
// Окружность с бегущим центром и радиусом, зависящим от a, плюс тоже бегущая прямая.
// Расстояние от центра до прямой равно |−Ka + L| : √(A² + B²), где K = Aα + Bγ + e,
// L = −(Aβ + Bδ + f). Наборы подобраны так, что K² = A² + B² и L/K = t, где ma + n = m(a − t):
// тогда условие «две точки» превращается в m(a − t) > (a − t)², то есть t < a < t + m.
function build173({ A, B, al, be, ga, de, e, f, m, t }) {
  const AB = A * A + B * B
  const solve = (a) => {
    const r2 = Radd(Rmul(R(m), a), R(-m * t))
    if (Rsign(r2) < 0) return 0
    // числитель: A·xц + B·yц − (ea + f), центр (−αa − β; −γa − δ)
    const xc = Rsub(Rmul(R(-al), a), R(be)), yc = Rsub(Rmul(R(-ga), a), R(de))
    const num = Rsub(Radd(Rmul(R(A), xc), Rmul(R(B), yc)), Radd(Rmul(R(e), a), R(f)))
    const c = Rcmp(Rmul(num, num), Rmul(R(AB), r2))
    return c < 0 ? 2 : c === 0 ? 1 : 0
  }
  return { set: assembleSet((a) => solve(a) >= 2, [R(t), R(t + m)]), solve }
}
const T173 = []
for (const [A, B] of [[3, -4], [3, 4], [4, 3], [4, -3]]) for (const al of [1, 2, 3]) for (const ga of [1, 2, 3]) {
  for (const e of [1, 2]) {
    if (Math.abs(A * al + B * ga + e) !== 5) continue        // K² = A² + B² = 25
    const K = A * al + B * ga + e
    for (const be of [-1, 0, 1]) for (const de of [-1, 0, 1]) for (const m of [1, 2]) for (const t of [-2, -1, 1, 2]) {
      const f = -K * t - A * be - B * de
      if (Math.abs(f) > 12 || Math.abs(m * t) > 12) continue
      T173.push({ A, B, al, be, ga, de, e, f, m, t })
    }
  }
}
export function t18SysCircleLineMore() {
  const par = pick(T173), { A, B, al, be, ga, de, e, f, m, t } = par
  const { set, solve } = build173(par)
  const cir = `(x + ${al === 1 ? "" : al}a${term(be, "")})${SUP[2]} + (y + ${ga === 1 ? "" : ga}a${term(de, "")})${SUP[2]} = ${m === 1 ? "" : m}a${term(-m * t, "")}`
  const line = `${A === 1 ? "" : A}x${term(B, "y")} = ${e === 1 ? "" : e}a${term(f, "")}`
  return item({
    text: `${HEAD_SYS}\n⟦cases:${cir}¦${line}⟧\n\nимеет более одного решения.`,
    set,
    solution: `Первая строка — окружность с центром (${MINUS}${al === 1 ? "" : al}a${term(-be, "")}; ${MINUS}${ga === 1 ? "" : ga}a${term(-de, "")}) и квадратом радиуса ${m === 1 ? "" : m}a${term(-m * t, "")} = ${m === 1 ? "" : m}(a ${MINUS} ${nS(t)}); она существует при a ≥ ${nS(t)}.\n`
      + `Больше одного решения — значит прямая пересекает окружность в двух точках, то есть расстояние от центра до прямой меньше радиуса.\n`
      + `Подставляя центр в левую часть уравнения прямой и деля на ⟦r:${A * A + B * B}⟧, получаем расстояние |a ${MINUS} ${nS(t)}|: числитель оказался ровно в ${Math.abs(A * al + B * ga + e)} раз больше ⟦r:${A * A + B * B}⟧.\n`
      + `Условие (a ${MINUS} ${nS(t)})${SUP[2]} < ${m === 1 ? "" : m}(a ${MINUS} ${nS(t)}) при a > ${nS(t)} даёт a ${MINUS} ${nS(t)} < ${m}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "atLeast", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => -al * a - be, label: "центр окружности" },
        { f: (a) => (a >= t ? -al * a - be + Math.sqrt(Math.max(0, m * (a - t))) : null), dash: true, label: "край окружности" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 8, aMin: t - 4, aMax: t + m + 4,
    },
  })
}

// #181. {(ay + ax + c)(y + x − ka) = 0; |xy| = a} — «ровно шесть решений».
// Первая строка — две ПАРАЛЛЕЛЬНЫЕ прямые x + y = −c/a и x + y = ka. Вторая при a > 0 —
// две гиперболы xy = ±a. Прямая x + y = s даёт: с xy = −a всегда две точки (дискриминант
// s² + 4a > 0), а с xy = a — две при s² > 4a, одну при равенстве и ни одной при s² < 4a.
// Значит каждая прямая даёт 2, 3 или 4 точки, и шесть получается как 4 + 2.
// Чтобы граница s² = 4a для первой прямой была рациональной, берём c = 2w³: тогда a = w².
function build181({ w, k }) {
  const c = 2 * w * w * w
  const solve = (a) => {
    if (Rsign(a) < 0) return 0
    if (Rzero(a)) return 1                                 // остаётся x + y = 0 и оси: только (0; 0)
    const per = (s) => {
      const cc = Rcmp(Rmul(s, s), Rmul(R(4), a))
      return 2 + (cc > 0 ? 2 : cc === 0 ? 1 : 0)
    }
    return per(Rdiv(R(-c), a)) + per(Rmul(R(k), a))
  }
  return { set: assembleSet((a) => solve(a) === 6, [R0, R(w * w), R(4, k * k)]), solve, c }
}
const T181 = []
for (const w of [1, 2, 3]) for (const k of [1, 2, 3]) if (w * w !== 4 / (k * k)) T181.push({ w, k })
export function t18SysTwoLinesAbsHyper() {
  const par = pick(T181), { w, k } = par
  const { set, solve, c } = build181(par)
  return item({
    text: `${HEAD_SYS}\n⟦cases:(ay + ax + ${c})(y + x ${MINUS} ${k === 1 ? "" : k}a) = 0¦|xy| = a⟧\n\nимеет ровно шесть различных решений.`,
    set,
    solution: `При a ≠ 0 первая строка задаёт две параллельные прямые: x + y = ${MINUS}${c}/a и x + y = ${k === 1 ? "" : k}a.\n`
      + `Вторая при a > 0 — две гиперболы xy = a и xy = ${MINUS}a (при a < 0 решений нет, при a = 0 остаётся только точка (0; 0)).\n`
      + `Подстановка y = s ${MINUS} x даёт x${SUP[2]} ${MINUS} sx + a = 0 и x${SUP[2]} ${MINUS} sx ${MINUS} a = 0. Второе всегда имеет два корня, первое — два при s${SUP[2]} > 4a, `
      + `один при s${SUP[2]} = 4a и ни одного при s${SUP[2]} < 4a. Значит каждая прямая даёт 2, 3 или 4 точки.\n`
      + `Шесть точек — это 4 + 2, то есть ровно для ОДНОЙ из прямых выполнено s${SUP[2]} > 4a: для первой это ${c * c}/a${SUP[2]} > 4a ⟺ a < ${w * w}, для второй — ${k * k}a${SUP[2]} > 4a ⟺ a > ${Rstr(R(4, k * k))}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 6 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a !== 0 ? -c / a : null), label: "x + y на первой прямой" },
        { f: (a) => k * a, label: "x + y на второй прямой" },
        { f: (a) => (a >= 0 ? 2 * Math.sqrt(a) : null), dash: true, label: "граница s² = 4a" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -12, xMax: 12, aMin: -2, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 6,
    },
  })
}

// #182. {|x − a| + m|y − a| = c; (x − u)(y − u) = 0} — «ровно три различных решения».
// Первая строка — «ромб» с центром (a; a) и полудиагоналями c и c/m; вторая — пара прямых
// x = u и y = u. Прямая x = u режет ромб в двух точках при |u − a| < c и в одной при равенстве;
// прямая y = u — при m|u − a| < c. Точка (u; u) принадлежит ромбу при (1 + m)|u − a| = c
// и тогда посчитана дважды. Отсюда три решения — ровно четыре значения a.
function build182({ u, m, c }) {
  const solve = (a) => {
    const d = Rsub(R(u), a)
    const hit = (lhs) => { const cc = Rcmp(lhs, R(c)); return cc < 0 ? 2 : cc === 0 ? 1 : 0 }
    const ad = Rsign(d) < 0 ? Rneg(d) : d
    const n1 = hit(ad), n2 = hit(Rmul(R(m), ad))
    const both = Rcmp(Rmul(R(1 + m), ad), R(c)) === 0 ? 1 : 0
    return n1 + n2 - both
  }
  const crit = [R(u * m - c, m), R(u * m + c, m), R(u * (1 + m) - c, 1 + m), R(u * (1 + m) + c, 1 + m), R(u - c), R(u + c)]
  return { set: assembleSet((a) => solve(a) === 3, crit), solve }
}
const T182 = []
for (const u of [1, 2, 3]) for (const m of [2, 3, 4]) for (const c of [4, 5, 6, 7, 8, 9, 10]) T182.push({ u, m, c })
export function t18SysRhombCross() {
  const par = pick(T182), { u, m, c } = par
  const { set, solve } = build182(par)
  const uu = u === 1 ? "" : u
  return item({
    text: `${HEAD_SYS}\n⟦cases:|x ${MINUS} a| + ${m}|y ${MINUS} a| = ${c}¦xy ${MINUS} ${uu}x ${MINUS} ${uu}y + ${u * u} = 0⟧\n\nимеет ровно три различных решения.`,
    set,
    solution: `Вторая строка: xy ${MINUS} ${uu}x ${MINUS} ${uu}y + ${u * u} = (x ${MINUS} ${u})(y ${MINUS} ${u}) = 0, то есть x = ${u} или y = ${u}.\n`
      + `Первая строка — «ромб» с центром (a; a), полудиагональ по x равна ${c}, по y — ${Rstr(R(c, m))}.\n`
      + `Прямая x = ${u} пересекает ромб в двух точках при |${u} ${MINUS} a| < ${c} и в одной при равенстве; прямая y = ${u} — в двух при ${m}|${u} ${MINUS} a| < ${c}.\n`
      + `Точка (${u}; ${u}) лежит на ромбе при ${1 + m}|${u} ${MINUS} a| = ${c} — тогда она посчитана дважды и различных решений три.\n`
      + `Итого три решения дают ровно четыре значения a: |${u} ${MINUS} a| = ${Rstr(R(c, m))} и |${u} ${MINUS} a| = ${Rstr(R(c, 1 + m))}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 3 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a, label: "центр ромба" }, { f: () => u, dash: true, label: `прямая x = ${u}` },
        { f: (a) => a + c, dash: true, label: "вершина ромба" }, { f: (a) => a - c, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: u - c - 3, xMax: u + c + 3, aMin: u - c - 3, aMax: u + c + 3,
    },
  })
}

// #184. {((x + p)² + y² − a²)·ln(9 − x² − y²) = 0; ((x + p)² + y² − a²)(x + y − a + p) = 0}
// — «ровно два различных решения». Общий множитель C = (x + p)² + y² − a² обращает в нуль
// обе строки, но ОДЗ логарифма — ОТКРЫТЫЙ круг x² + y² < 9. Окружность C = 0 (центр (−p; 0),
// радиус |a|) заходит внутрь этого круга ⟺ p − 3 < |a| < p + 3 — тогда решений бесконечно
// много (целая дуга); при касании общая точка лежит НА границе и в ОДЗ не попадает.
// Иначе остаются пересечения окружности x² + y² = 8 с прямой x + y = a − p.
function build184({ p }) {
  const solve = (a) => {
    const aa = Rsign(a) < 0 ? Rneg(a) : a
    if (Rcmp(aa, R(p - 3)) > 0 && Rcmp(aa, R(p + 3)) < 0) return 99
    const t = Rsub(a, R(p))
    const c = Rcmp(Rmul(t, t), R(16))                      // (a − p)²/2 < 8
    return c < 0 ? 2 : c === 0 ? 1 : 0
  }
  const crit = [R(p - 3), R(-(p - 3)), R(p + 3), R(-(p + 3)), R(p - 4), R(p + 4)]
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
const T184 = [4, 5, 6, 7].map((p) => ({ p }))
export function t18SysCircleLogDisk() {
  const par = pick(T184), { p } = par
  const { set, solve } = build184(par)
  const C = `(x + ${p})${SUP[2]} + y${SUP[2]} ${MINUS} a${SUP[2]}`
  return item({
    text: `${HEAD_SYS}\n⟦cases:(${C})·ln(9 ${MINUS} x${SUP[2]} ${MINUS} y${SUP[2]}) = 0¦(${C})(x + y ${MINUS} a + ${p}) = 0⟧\n\nимеет ровно два различных решения.`,
    set,
    solution: `Общий множитель ${C} обращает в нуль обе строки сразу, но логарифм требует x${SUP[2]} + y${SUP[2]} < 9 — ОТКРЫТЫЙ круг радиуса 3.\n`
      + `Окружность ${C} = 0 имеет центр (${MINUS}${p}; 0) и радиус |a|; расстояние между центрами равно ${p}, поэтому внутрь открытого круга она заходит ровно при ${p} ${MINUS} 3 < |a| < ${p} + 3 — `
      + `и тогда решений бесконечно много (целая дуга). При |a| = ${p - 3} и |a| = ${p + 3} касание происходит НА границе круга, а она в ОДЗ не входит.\n`
      + `Значит при |a| ≤ ${p - 3} или |a| ≥ ${p + 3} решения — только пересечения ln(9 ${MINUS} x${SUP[2]} ${MINUS} y${SUP[2]}) = 0, то есть x${SUP[2]} + y${SUP[2]} = 8, с прямой x + y = a ${MINUS} ${p}.\n`
      + `Их два ⟺ расстояние от начала координат до прямой меньше ⟦r:8⟧: |a ${MINUS} ${p}| < 4.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a - p, label: "x + y на прямой" },
        { f: () => p - 3, dash: true, label: "границы дуги" }, { f: () => p + 3, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -6, xMax: p + 6, aMin: -2, aMax: p + 6,
    },
  })
}

// #185. {(x² + y² + 2px)·ln((3x + 4y + a)/c) = 0; (x² + y² + 2px)(x² + y² − 2qx) = 0}
// — «ровно два различных решения». Общий множитель U = x² + y² + 2px обращает в нуль обе
// строки, но ОДЗ логарифма — ПОЛУПЛОСКОСТЬ 3x + 4y + a > 0. На окружности U = 0 (центр
// (−p; 0), радиус p) максимум 3x + 4y + a равен a + 2p, поэтому дуга решений пуста ⟺ a ≤ −2p.
// Тогда остаются пересечения прямой 3x + 4y = c − a с окружностью x² + y² = 2qx.
function build185({ p, q, c }) {
  const solve = (a) => {
    if (Rcmp(a, R(-2 * p)) > 0) return 99                  // на окружности U = 0 есть дуга в ОДЗ
    const t = Radd(Rsub(R(3 * q), R(c)), a)                // 3q − (c − a)
    const cc = Rcmp(Rmul(t, t), R(25 * q * q))
    return cc < 0 ? 2 : cc === 0 ? 1 : 0
  }
  const crit = [R(-2 * p), R(c - 8 * q), R(c + 2 * q)]
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
const T185 = []
for (const p of [2, 3, 4]) for (const q of [4, 5, 6, 8]) for (const c of [10, 15, 20, 25, 40]) {
  if (c < 8 * q - 2 * p) T185.push({ p, q, c })
}
export function t18SysTwoCirclesLog() {
  const par = pick(T185), { p, q, c } = par
  const { set, solve } = build185(par)
  const U = `x${SUP[2]} + y${SUP[2]} + ${2 * p}x`
  return item({
    text: `${HEAD_SYS}\n⟦cases:(${U})·ln(${fT("3x + 4y + a", `${c}`)}) = 0¦(${U})(x${SUP[2]} + y${SUP[2]} ${MINUS} ${2 * q}x) = 0⟧\n\nимеет ровно два различных решения.`,
    set,
    solution: `Множитель ${U} = 0 — это окружность с центром (${MINUS}${p}; 0) и радиусом ${p}; он обращает в нуль обе строки сразу, `
      + `но логарифм требует 3x + 4y + a > 0 — открытую полуплоскость.\n`
      + `На этой окружности 3x + 4y + a изменяется от a ${MINUS} ${8 * p} до a + ${2 * p} (в центре значение a ${MINUS} ${3 * p}, размах — 5·${p}). Значит дуга решений пуста ровно при a ≤ ${MINUS}${2 * p}.\n`
      + `Тогда первая строка даёт ln(...) = 0, то есть прямую 3x + 4y = ${c} ${MINUS} a, а вторая — окружность x${SUP[2]} + y${SUP[2]} = ${2 * q}x с центром (${q}; 0) и радиусом ${q}.\n`
      + `Двух общих точек требует |3·${q} ${MINUS} (${c} ${MINUS} a)| < 5·${q}, то есть ${c - 8 * q} < a < ${c + 2 * q}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (c - a) / 3, label: "прямая при y = 0" },
        { f: () => 2 * q, dash: true, label: "край окружности" }, { f: () => -2 * p, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2 * p - 4, xMax: 2 * q + 4, aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// #186. {√((x − a)² + y²) + √(x² + (y + ma)²) = |a|√(1 + m²); x² + y² ≤ N} —
// «единственное решение». Сумма расстояний до точек F₁(a; 0) и F₂(0; −ma) равна |F₁F₂|,
// поэтому первая строка задаёт ОТРЕЗОК F₁F₂. Угол при начале координат прямой, значит
// расстояние от начала до отрезка равно произведению катетов на гипотенузу: m|a|/√(1 + m²),
// и основание перпендикуляра лежит внутри отрезка. Единственная общая точка с кругом —
// касание; наборы (m, N) взяты так, чтобы граница была рациональной.
function build186({ m, N }) {
  const solve = (a) => {
    if (Rzero(a)) return 1                                 // отрезок стянулся в точку (0; 0)
    const d2 = Rdiv(Rmul(R(m * m), Rmul(a, a)), R(1 + m * m))
    const c = Rcmp(d2, R(N))
    return c < 0 ? 99 : c === 0 ? 1 : 0
  }
  const W = Math.round(Math.sqrt(N * (1 + m * m)))        // по построению N(1 + m²) — полный квадрат
  if (W * W !== N * (1 + m * m)) return null
  const gr = R(W, m)                                       // |a| = √(N(1 + m²))/m
  return { set: assembleSet((a) => solve(a) === 1, [R0, gr, Rneg(gr)]), solve, gr }
}
const T186 = [[1, 2], [1, 8], [1, 18], [1, 32], [1, 50], [2, 5], [2, 20], [2, 45], [3, 10], [3, 90]]
  .map(([m, N]) => ({ m, N }))
export function t18SysSegmentDisk() {
  const par = pick(T186), { m, N } = par
  const { set, solve, gr } = build186(par)
  const ma = m === 1 ? "a" : `${m}a`
  return item({
    text: `${HEAD_SYS}\n⟦cases:⟦r:(x ${MINUS} a)${SUP[2]} + y${SUP[2]}⟧ + ⟦r:x${SUP[2]} + (y + ${ma})${SUP[2]}⟧ = |a⟦r:${1 + m * m}⟧|`
      + `¦x${SUP[2]} + y${SUP[2]} ≤ ${N}⟧\n\nимеет единственное решение.`,
    set,
    solution: `Обозначим F₁(a; 0) и F₂(0; ${MINUS}${ma}). Тогда |F₁F₂| = ⟦r:a${SUP[2]} + ${m * m}a${SUP[2]}⟧ = |a⟦r:${1 + m * m}⟧| — ровно правая часть.\n`
      + `Сумма расстояний до двух точек равна расстоянию между ними только для точек ОТРЕЗКА F₁F₂, значит первая строка задаёт этот отрезок.\n`
      + `Угол F₁OF₂ прямой, поэтому расстояние от начала координат до отрезка равно |a|·${ma} : |F₁F₂| = ${m === 1 ? "" : m}|a| : ⟦r:${1 + m * m}⟧, а основание перпендикуляра лежит внутри отрезка.\n`
      + `Вторая строка — круг радиуса ⟦r:${N}⟧. Общая точка ровно одна в двух случаях: a = 0 (отрезок стянулся в точку (0; 0), она в круге) и касание — когда это расстояние равно ⟦r:${N}⟧, то есть |a| = ${Rstr(gr)}.\n`
      + `При меньшем расстоянии внутрь круга попадает целый кусок отрезка (решений бесконечно много), при большем — ни одной точки.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a, label: "F₁: x = a" }, { f: (a) => a / 2, dash: true, label: "середина отрезка" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -Rnum(gr) - 4, xMax: Rnum(gr) + 4, aMin: -Rnum(gr) - 4, aMax: Rnum(gr) + 4,
    },
  })
}

// #187. {√((x + p)² + y²) + √(x² + (y − a)²) = √(p² + a²); ky = |c − a²|} —
// «единственное решение», a ≥ 0. Снова сумма расстояний равна расстоянию между точками
// F₁(−p; 0) и F₂(0; a), то есть первая строка — ОТРЕЗОК F₁F₂. При a > 0 он не горизонтален,
// поэтому горизонтальная прямая y = |c − a²|/k пересекает его ровно в одной точке тогда и
// только тогда, когда её высота лежит в [0; a]: |c − a²| ≤ ka.
function build187({ k, c }) {                             // p — сдвиг F₁ по x, на ответ не влияет
  const solve = (a) => {
    if (Rsign(a) <= 0) return 0                            // при a = 0 отрезок горизонтален, а высота > 0
    const d = Rsub(R(c), Rmul(a, a))
    const ad = Rsign(d) < 0 ? Rneg(d) : d
    return Rcmp(ad, Rmul(R(k), a)) <= 0 ? 1 : 0
  }
  const crit = [R0]
  for (const sg of [1, -1]) {
    const { roots, allRational } = ratRoots([R(-c), R(sg * k), R1])
    if (!allRational) return null
    crit.push(...roots)
  }
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T187 = []
for (const p of [1, 2, 3, 4]) for (const k of [2, 3, 4, 5, 6, 8]) for (const c of [3, 4, 5, 6, 9, 10, 12, 16, 21, 24, 40]) {
  const s = Math.round(Math.sqrt(k * k + 4 * c))
  if (s * s === k * k + 4 * c && (s - k) / 2 >= 1) T187.push({ p, k, c })
}
export function t18SysSegmentLine() {
  const par = pick(T187), { p, k, c } = par
  const { set, solve } = build187(par)
  const b = setBounds(set)
  return item({
    text: `Найдите все неотрицательные значения a, при каждом из которых система\n`
      + `⟦cases:⟦r:(x + ${p})${SUP[2]} + y${SUP[2]}⟧ + ⟦r:x${SUP[2]} + (y ${MINUS} a)${SUP[2]}⟧ = ⟦r:${p * p} + a${SUP[2]}⟧`
      + `¦${k}y = |${c} ${MINUS} a${SUP[2]}|⟧\n\nимеет единственное решение.`,
    set,
    solution: `Обозначим F₁(${MINUS}${p}; 0) и F₂(0; a). Тогда |F₁F₂| = ⟦r:${p * p} + a${SUP[2]}⟧ — ровно правая часть первого уравнения, `
      + `а сумма расстояний до двух точек равна расстоянию между ними только на ОТРЕЗКЕ F₁F₂.\n`
      + `Вторая строка — горизонтальная прямая y = |${c} ${MINUS} a${SUP[2]}| : ${k}, её высота неотрицательна.\n`
      + `При a > 0 отрезок не горизонтален, и его ординаты пробегают [0; a] по одному разу, поэтому общая точка ровно одна ⟺ |${c} ${MINUS} a${SUP[2]}| ≤ ${k}a.\n`
      + `Раскрывая модуль: a${SUP[2]} ${MINUS} ${k}a ${MINUS} ${c} ≤ 0 и a${SUP[2]} + ${k}a ${MINUS} ${c} ≥ 0, то есть ${Rstr(b[0])} ≤ a ≤ ${Rstr(b[b.length - 1])}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: () => -p, dash: true, label: "F₁" }, { f: () => 0, dash: true, label: "F₂ на оси y" },
        { f: (a) => Math.abs(c - a * a) / k, label: "высота прямой" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -p - 3, xMax: Rnum(b[b.length - 1]) + 4, aMin: -2, aMax: Rnum(b[b.length - 1]) + 4,
    },
  })
}


// #168 и #169. {(x − (αa + β))² + (y − (γa + δ))² = 2k²; y² = x²} — «ровно четыре решения».
// Это одна и та же геометрия в двух записях эталона: #168 — с готовыми квадратами,
// #169 — в раскрытом виде x² + y² − 2Px − 2Qy + (P² + Q² − 2k²) = 0.
// Пара прямых y = ±x, подстановка даёт 2x² − 2(P ± Q)x + P² + Q² − 2k² = 0 с четвертью
// дискриминанта 4k² − (P ∓ Q)². Четыре точки ⟺ окружность пересекает КАЖДУЮ прямую дважды,
// то есть расстояния от центра до обеих прямых меньше радиуса: |P − Q| < 2k и |P + Q| < 2k.
// Радиус берём вида k√2 — тогда границы рациональны (у оригинала радиус 1 и границы ±√2).
// Набор дополнительно подобран так, что 2k²(α² + γ²) < (αδ − βγ)²: тогда начало координат
// НИКОГДА не лежит на окружности и случай «три решения» (склейка в (0; 0)) не возникает.
function build168({ al, be, ga, de, k }) {
  const solve = (a) => {
    const P = Radd(Rmul(R(al), a), R(be)), Q = Radd(Rmul(R(ga), a), R(de))
    const free = Rsub(Radd(Rmul(P, P), Rmul(Q, Q)), R(2 * k * k))
    let n = 0
    for (const s of [1, -1]) {
      n += countRoots([free, Rmul(R(-2), s > 0 ? Radd(P, Q) : Rsub(P, Q)), R(2)], "-inf", "+inf", false, false)
    }
    if (Rzero(free)) n -= 1                                // начало координат — общая точка прямых
    return n
  }
  const crit = []
  for (const [A, B] of [[al - ga, be - de], [al + ga, be + de]]) {
    for (const s of [1, -1]) crit.push(R(s * 2 * k - B, A))
  }
  return { set: assembleSet((a) => solve(a) === 4, crit), solve }
}
// Наборы (α, β, γ, δ, k) найдены перебором: интервалы |(α−γ)a + (β−δ)| < 2k и
// |(α+γ)a + (β+δ)| < 2k пересекаются, границы — дроби со знаменателем ≤ 5,
// и 2k²(α² + γ²) < (αδ − βγ)² (начало координат вне окружности при любом a).
const T168 = [
  [1, 4, 2, 1, 2], [1, 5, 2, 0, 3], [1, 5, 2, 3, 2], [1, 6, 2, 2, 3], [1, 6, 2, 5, 2],
  [1, 3, 3, 0, 2], [1, 4, 3, 2, 2], [1, 4, 3, 3, 2], [1, 5, 3, 1, 3], [1, 6, 3, 4, 3],
  [1, 3, 4, 0, 2], [1, 4, 4, 3, 2],
].map(([al, be, ga, de, k]) => ({ al, be, ga, de, k }))
const cen168 = (v, co, sh) => (sh === 0 ? `(${v} ${MINUS} ${co === 1 ? "" : co}a)` : `(${v} ${MINUS} (${co === 1 ? "" : co}a + ${sh}))`)
function item168(par, expanded) {
  const { al, be, ga, de, k } = par
  const { set, solve } = build168(par)
  const A = al * al + ga * ga, B = 2 * (al * be + ga * de), C = be * be + de * de - 2 * k * k
  // «−2Px»: если сдвиг делится на коэффициент, выносим множитель как в эталоне («−4(a+1)x»)
  const mul = (co, sh) => (sh === 0 ? `${2 * co === 1 ? "" : 2 * co}a`
    : sh % co === 0 ? `${2 * co === 1 ? "" : 2 * co}(a + ${sh / co})` : `(${2 * co}a + ${2 * sh})`)
  const first = expanded
    ? `x${SUP[2]} + y${SUP[2]} ${MINUS} ${mul(al, be)}x ${MINUS} ${mul(ga, de)}y + ${A}a${SUP[2]}${term(B, "a")}${term(C, "")} = 0`
    : `${cen168("x", al, be)}${SUP[2]} + ${cen168("y", ga, de)}${SUP[2]} = ${2 * k * k}`
  return item({
    text: `${HEAD_SYS}\n⟦cases:${first}¦y${SUP[2]} = x${SUP[2]}⟧\n\nимеет ровно четыре различных решения.`,
    set,
    solution: (expanded
      ? `Соберём в первой строке полные квадраты: ${cen168("x", al, be)}${SUP[2]} + ${cen168("y", ga, de)}${SUP[2]} = ${2 * k * k}. `
      : "")
      + `Это окружность с центром P(${al === 1 ? "" : al}a${term(be, "")}; ${ga === 1 ? "" : ga}a${term(de, "")}) и радиусом ${k === 1 ? "" : k}⟦r:2⟧.\n`
      + `Вторая строка ⟺ y = x или y = ${MINUS}x — пара перпендикулярных прямых, пересекающихся в начале координат.\n`
      + `Расстояние от точки (p; q) до прямой y = x равно |p ${MINUS} q| : ⟦r:2⟧, до прямой y = ${MINUS}x — |p + q| : ⟦r:2⟧. Каждая прямая даёт две точки, когда расстояние меньше радиуса.\n`
      + `Отсюда система из двух условий: |${al - ga === 1 ? "" : nS(al - ga)}a${term(be - de, "")}| < ${2 * k} и |${al + ga === 1 ? "" : al + ga}a${term(be + de, "")}| < ${2 * k}.\n`
      + `(Случай «три решения», когда обе точки склеиваются в начале координат, здесь невозможен: ${A}a${SUP[2]}${term(B, "a")}${term(C, "")} = 0 не имеет корней.)\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 4 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => al * a + be, label: "абсцисса центра" },
        { f: (a) => ga * a + de, dash: true, label: "ордината центра" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 12, aMin: Rnum(setBounds(set)[0]) - 3, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}
export function t18SysCircleCross() { return item168(pick(T168), false) }
export function t18SysCircleCrossExpanded() { return item168(pick(T168), true) }

// #171. {a(x² + y² + 2ux + cy + w) + ey + f = 0; xy + 1 = x + y} — «ровно четыре решения».
// Вторая строка ⟺ (x − 1)(y − 1) = 0, то есть x = 1 или y = 1. Первая — пучок окружностей.
// Подстановка x = 1 даёт ay² + (ca + e)y + (a(1 + 2u + w) + f) = 0, подстановка y = 1 —
// ax² + 2uax + (a(1 + c + w) + e + f) = 0; общей у них может быть только точка (1; 1).
// Дискриминант второго уравнения делится на a, поэтому его корни рациональны всегда;
// набор (u, c, w, e, f) подобран так, чтобы и у первого дискриминанта корни были рациональны.
function build171({ u, c, w, e, f }) {
  const s1 = 1 + 2 * u + w, s2 = 1 + c + w
  const solve = (a) => {
    if (Rzero(a)) return 1                                 // остаётся прямая ey + f = 0: точка (1; −f/e)
    const q1 = [Radd(Rmul(a, R(s1)), R(f)), Radd(Rmul(a, R(c)), R(e)), a]
    const q2 = [Radd(Rmul(a, R(s2)), R(e + f)), Rmul(a, R(2 * u)), a]
    let n = countRoots(q1, "-inf", "+inf", false, false) + countRoots(q2, "-inf", "+inf", false, false)
    if (Rzero(Radd(Rmul(a, R(2 + 2 * u + c + w)), R(e + f)))) n -= 1        // точка (1; 1) посчитана дважды
    return n
  }
  const crit = [R0]
  const polys = [
    [R(e * e), R(2 * (c * e - 2 * f)), R(c * c - 4 * s1)],                  // дискриминант по y
    [R0, R(-4 * (e + f)), R(4 * (u * u - s2))],                            // дискриминант по x
    [R(e + f), R(2 + 2 * u + c + w)],                                      // точка (1; 1) на кривой
  ]
  for (const P of polys) {
    if (!pTrim(P).length) return null
    const { roots, allRational } = ratRoots(P)
    if (!allRational) return null
    crit.push(...roots)
  }
  return { set: assembleSet((a) => solve(a) === 4, crit), solve }
}
// Наборы (u, c, w, e, f) отобраны разовым перебором ЭТИМ ЖЕ движком: дискриминант по y
// (c² − 4(1 + 2u + w))a² + 2(ce − 2f)a + e² обязан иметь рациональные корни, ответ — не более
// трёх промежутков с круглыми границами. Из 1594 подходящих наборов взяты 36 с попарно
// различными ответами и наименьшими коэффициентами.
const T171 = [
  [-1, -1, 0, 1, 1], [-1, 1, 0, 1, 1], [-1, -1, -1, 1, 1], [-2, -1, 0, 1, 1], [-1, -1, 0, 2, 1],
  [-2, 1, 0, 1, 1], [-1, -1, 0, 1, -2], [-1, 1, 0, 2, -1], [-1, 1, -1, 1, 1], [-1, 1, 0, 1, 2],
  [1, 1, 1, 1, 1], [1, 1, 0, 1, -2], [-2, -2, 0, 1, 1], [-2, -1, 0, 1, -2], [-2, -1, 0, 2, -1],
  [-2, -1, 0, 2, 1], [-2, -1, 1, 1, 1], [-2, 1, 0, 2, -1], [-2, 1, 0, 1, 2], [-1, -1, 0, 2, 2],
  [-1, -2, 0, 1, -2], [-1, 2, 0, 2, -1], [1, -1, 0, 3, -1], [1, -2, 0, 2, -1], [1, 1, -1, 1, 2],
  [-1, -2, 0, 2, -1], [-1, -2, -1, 1, 1], [-1, -2, 0, 2, 1], [-1, 1, -1, 1, -2], [-1, 1, 0, 2, 2],
  [-1, 1, 1, 2, 1], [-1, 1, 2, 1, 1], [2, 2, 0, 1, 1], [1, -1, -1, 1, -2], [1, 2, -1, 1, 1], [1, 1, 0, 1, 3],
].map(([u, c, w, e, f]) => ({ u, c, w, e, f }))
export function t18SysPencilCross() {
  const par = pick(T171), { u, c, w, e, f } = par
  const { set, solve } = build171(par)
  // скобку при y пишем так, чтобы не получалось «(−a + 1)»: при отрицательном c ставим число вперёд
  const yTxt = c > 0 ? `${c === 1 ? "" : c}a${term(e, "")}` : `${e}${term(c, "a")}`
  const first = `ax${SUP[2]} + ay${SUP[2]}${term(2 * u, "ax")} + (${yTxt})y${w === 0 ? "" : term(w, "a")}${term(f, "")} = 0`
  return item({
    text: `${HEAD_SYS}\n⟦cases:${first}¦xy + 1 = x + y⟧\n\nимеет ровно четыре различных решения.`,
    set,
    solution: `Вторая строка: xy ${MINUS} x ${MINUS} y + 1 = (x ${MINUS} 1)(y ${MINUS} 1) = 0, то есть x = 1 или y = 1.\n`
      + `Подставим x = 1 в первую строку: ay${SUP[2]} + (${yTxt})y + ${s1txt(u, w)}a${term(f, "")} = 0 — квадратное по y при a ≠ 0.\n`
      + `Подставим y = 1: ax${SUP[2]}${term(2 * u, "ax")} + ${1 + c + w === 1 ? "" : 1 + c + w}a${term(e + f, "")} = 0 — квадратное по x.\n`
      + `Четыре различных решения — это по два корня у каждого уравнения, причём точка (1; 1) не должна попасть на кривую `
      + `(иначе она посчитана дважды и различных решений три). При a = 0 первая строка превращается в прямую ${e === 1 ? "" : e}y${term(f, "")} = 0 и решение единственное.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 4 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a !== 0 ? -u : null), dash: true, label: "центр пучка по x" },
        { f: () => 1, dash: true, label: "прямая x = 1" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 8, aMin: Rnum(setBounds(set)[0]) - 3, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}
const s1txt = (u, w) => (1 + 2 * u + w === 1 ? "" : 1 + 2 * u + w === -1 ? MINUS : nS(1 + 2 * u + w))


// =============================================================================
// РАЗДЕЛ I. Окружность/фигура + семейство (эталон #66, #76, #81)
// =============================================================================

// #66. {(|x| − q)² + (y − h)² = ρ²; (x + p)² + y² = a²}, a > 0, «единственное решение».
// Модуль в первой строке даёт ДВЕ окружности — с центрами (q; h) и (−q; h) (при ρ < q каждая
// целиком лежит в своей полуплоскости). Вторая строка — окружность с центром (−p; 0) и
// радиусом a. Расстояния от него до двух центров равны √((q−p)² + h²) и √((q+p)² + h²);
// наборы взяты так, что ОБА расстояния целые — тогда все касания происходят при целых a.
function build66({ q, p, h, rho }) {
  const B2 = (q - p) * (q - p) + h * h, A2 = (q + p) * (q + p) + h * h
  const A = Math.round(Math.sqrt(A2)), B = Math.round(Math.sqrt(B2))
  if (A * A !== A2 || B * B !== B2 || rho >= q || rho >= B) return null
  const solve = (a) => {
    if (Rsign(a) <= 0) return 0                            // ищем только положительные a
    const a2 = Rmul(a, a), r2 = R(rho * rho)
    return circleHits(R(B2), r2, a2) + circleHits(R(A2), r2, a2)
  }
  const crit = [R0, R(B - rho), R(B + rho), R(A - rho), R(A + rho)]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve, A, B }
}
const T66 = []
for (const [q, p, h] of [[7, 2, 12], [4, 4, 6], [3, 3, 8], [14, 6, 15], [22, 14, 15], [28, 8, 15], [26, 14, 9], [18, 3, 20], [20, 15, 12]]) {
  for (const rho of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const res = build66({ q, p, h, rho })
    if (!res || res.set.intervals.length || res.set.points.length < 2) continue
    if (setBounds(res.set).some((x) => x.d > 1n)) continue  // ответ — только целые точки
    T66.push({ q, p, h, rho })
  }
}
export function t18SysAbsTwoCircles() {
  const par = pick(T66), { q, p, h, rho } = par
  const { set, solve, A, B } = build66(par)
  return item({
    text: `Найдите все положительные значения a, при каждом из которых система\n`
      + `⟦cases:(|x| ${MINUS} ${q})${SUP[2]} + (y ${MINUS} ${h})${SUP[2]} = ${rho * rho}¦(x + ${p})${SUP[2]} + y${SUP[2]} = a${SUP[2]}⟧\n\nимеет единственное решение.`,
    set,
    solution: `При x ≥ 0 первая строка — окружность с центром O₁(${q}; ${h}) и радиусом ${rho}, при x ≤ 0 — окружность с центром O₂(${MINUS}${q}; ${h}) и тем же радиусом; `
      + `так как ${rho} < ${q}, каждая целиком лежит в своей полуплоскости, то есть первая строка задаёт ровно эти две окружности.\n`
      + `Вторая строка — окружность с центром C(${MINUS}${p}; 0) и радиусом a.\n`
      + `Расстояния от C до центров: CO₂ = ⟦r:${(q - p) * (q - p)} + ${h * h}⟧ = ${B} и CO₁ = ⟦r:${(q + p) * (q + p)} + ${h * h}⟧ = ${A}.\n`
      + `С каждой из окружностей радиуса ${rho} окружность радиуса a имеет две общие точки при |d ${MINUS} a| < ${rho} < d + a и одну при касании (a = d ± ${rho}).\n`
      + `Единственное решение всей системы — когда касание есть с одной окружностью, а со второй общих точек нет.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: () => q, dash: true, label: "центры O₁, O₂" }, { f: () => -q, dash: true }, { f: (a) => -p + a, label: "правый край C-окружности" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -q - 4, xMax: q + 4, aMin: 0, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// #76. {(x − u)² + (y − v)² = 2m²; y = |x − a| + w} — «ровно три различных решения».
// Вторая строка — «галочка» с вершиной (a; w) и наклонами ±1. Подстановка ветвей даёт
// квадратные уравнения, а ограничения x ≥ a и x ≤ a учитываются ТОЧНО: число корней на
// нужном луче считает Штурм. Радиус берём вида m√2 (правая часть 2m²) — тогда условия
// касания рациональны, а |v − w| подобрано так, чтобы и «вершина на окружности» давала
// рациональное a: (a − u)² = 2m² − (v − w)².
function build76({ u, v, w, m }) {
  const g2 = 2 * m * m - (v - w) * (v - w)
  const g = Math.round(Math.sqrt(g2))
  if (g * g !== g2) return null
  const solve = (a) => {
    // правая ветвь y = x − a + w: (x − u)² + (x − s)² = 2m², s = a − w + v
    const s = Radd(Rsub(a, R(w)), R(v)), t = Radd(Rsub(a, R(v)), R(w))
    const q1 = [Rsub(Radd(Rmul(R(u), R(u)), Rmul(s, s)), R(2 * m * m)), Rmul(R(-2), Radd(R(u), s)), R(2)]
    const q2 = [Rsub(Radd(Rmul(R(u), R(u)), Rmul(t, t)), R(2 * m * m)), Rmul(R(-2), Radd(R(u), t)), R(2)]
    let n = countRoots(q1, a, "+inf", true, false) + countRoots(q2, "-inf", a, false, true)
    const du = Rsub(a, R(u))
    if (Rzero(Rsub(Radd(Rmul(du, du), R((v - w) * (v - w))), R(2 * m * m)))) n -= 1   // вершина на окружности
    return n
  }
  const crit = [R(u + w - v - 2 * m), R(u + w - v + 2 * m), R(u - w + v - 2 * m), R(u - w + v + 2 * m), R(u - g), R(u + g)]
  return { set: assembleSet((a) => solve(a) === 3, crit), solve }
}
// Три решения возможны только когда вершина «галочки» может сесть на НИЖНЮЮ часть окружности
// так, чтобы оба луча уходили внутрь: для этого нужно m < v − w < m⟦r:2⟧, то есть
// 2m² = (v − w)² + g² с g < m < v − w. Такие тройки редки: (m; v−w; g) = (5;7;1), (10;14;2), (15;21;3), …
const T76 = []
for (const [m, d] of [[5, 7], [10, 14]]) for (const u of [2, 3, 4, 5, 6]) for (const w of [0, 1, 2]) {
  const par = { u, v: w + d, w, m }
  const res = build76(par)
  if (!res || res.set.intervals.length || res.set.points.length < 3) continue
  if (setBounds(res.set).some((x) => x.d > 1n)) continue
  T76.push(par)
}
export function t18SysCircleVee() {
  const par = pick(T76), { u, v, w, m } = par
  const { set, solve } = build76(par)
  return item({
    text: `${HEAD_SYS}\n⟦cases:(x ${MINUS} ${u})${SUP[2]} + (y ${MINUS} ${v})${SUP[2]} = ${2 * m * m}¦y = |x ${MINUS} a|${w === 0 ? "" : ` + ${w}`}⟧\n\nимеет ровно три различных решения.`,
    set,
    solution: `Вторая строка — «галочка» с вершиной (a; ${w}) и наклонами ±1: при x ≥ a это y = x ${MINUS} a + ${w}, при x ≤ a — y = ${MINUS}x + a + ${w}.\n`
      + `Первая строка — окружность с центром (${u}; ${v}) и радиусом ${m}⟦r:2⟧.\n`
      + `Подставляя каждую ветвь, получаем квадратное уравнение; важно, что корни годятся только на своём луче (x ≥ a или x ≤ a), `
      + `а вершина (a; ${w}) при (a ${MINUS} ${u})${SUP[2]} = ${2 * m * m} ${MINUS} ${(v - w) * (v - w)} лежит на окружности и считается дважды.\n`
      + `Три различных точки получаются, когда одна ветвь даёт две точки, а другая — одну (либо когда четыре точки склеиваются в три из-за вершины).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 3 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a, label: "вершина галочки" }, { f: () => u, dash: true, label: "центр окружности" },
        { f: () => u - m * Math.SQRT2, dash: true }, { f: () => u + m * Math.SQRT2, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: u - 2 * m - 3, xMax: u + 2 * m + 3,
      aMin: Rnum(setBounds(set)[0]) - 3, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #81. {((|y| − x − c)(x² − 2dx + y² + e))/(x + c) = 0; y = √(a − f)·x} — «ровно два решения».
// Первый множитель — «галочка» |y| = x + c с вершиной (−c; 0), которая ВЫКОЛОТА знаменателем.
// Второй — окружность (x − d)² + y² = d² − e. Прямая y = kx с k = √(a − f) ≥ 0 существует
// при a ≥ f, и все условия зависят только от k² = a − f, то есть рациональны.
function build81({ d, e, f }) {                          // c — сдвиг «галочки», на ответ не влияет
  const R2 = d * d - e                                     // квадрат радиуса окружности
  const solve = (a) => {
    const K = Rsub(a, R(f))                                // K = k² = a − f
    if (Rsign(K) < 0) return 0
    // «галочка»: при x < 0 всегда одна точка (кроме k = 0, там она попадает в выколотую вершину),
    // при x > 0 точка есть только если k > 1
    let n = (Rsign(K) > 0 ? 1 : 0) + (Rcmp(K, R1) > 0 ? 1 : 0)
    // окружность: (1 + k²)x² − 2dx + e = 0, четверть дискриминанта d² − e(1 + k²)
    const disc = Rsub(R(d * d), Rmul(R(e), Radd(R1, K)))
    n += Rsign(disc) > 0 ? 2 : Rsign(disc) === 0 ? 1 : 0
    return n
  }
  const crit = [R(f), Radd(R(f), R1), Radd(R(f), R(R2, e))]
  return { set: assembleSet((a) => solve(a) === 2, crit), solve, R2 }
}
const T81 = []
for (const d of [2, 3, 4, 5]) for (const e of [1, 2, 3, 4, 6]) for (const c of [1, 2, 3]) for (const f of [1, 2, 3, 4]) {
  if (d * d - e <= 0) continue
  const res = build81({ c, d, e, f })
  if (!res) continue
  const b = setBounds(res.set)
  if (!b.length || b.some((x) => x.d > 8n)) continue
  T81.push({ c, d, e, f })
}
export function t18SysVeeCircleSlope() {
  const par = pick(T81), { c, d, e, f } = par
  const { set, solve, R2 } = build81(par)
  const num = `(|y| ${MINUS} x ${MINUS} ${c})(x${SUP[2]} ${MINUS} ${2 * d}x + y${SUP[2]} + ${e})`
  return item({
    text: `${HEAD_SYS}\n⟦cases:${fT(num, `x + ${c}`)} = 0¦y = ⟦r:a ${MINUS} ${f}⟧·x⟧\n\nимеет ровно два различных решения.`,
    set,
    solution: `Дробь равна нулю, когда числитель равен нулю, а знаменатель — нет: значит x ≠ ${MINUS}${c}.\n`
      + `Первый множитель: |y| = x + ${c} — «галочка» с вершиной (${MINUS}${c}; 0), но сама вершина выколота.\n`
      + `Второй: (x ${MINUS} ${d})${SUP[2]} + y${SUP[2]} = ${R2} — окружность с центром (${d}; 0) и радиусом ⟦r:${R2}⟧.\n`
      + `Вторая строка системы — прямая y = kx с k = ⟦r:a ${MINUS} ${f}⟧ ≥ 0 (она есть только при a ≥ ${f}), и все условия зависят лишь от k${SUP[2]} = a ${MINUS} ${f}.\n`
      + `С «галочкой»: при x < 0 всегда одна точка (при k = 0 она совпадает с выколотой вершиной), при x > 0 точка появляется только если k > 1.\n`
      + `С окружностью: (1 + k${SUP[2]})x${SUP[2]} ${MINUS} ${2 * d}x + ${e} = 0, четверть дискриминанта равна ${d * d} ${MINUS} ${e}(1 + k${SUP[2]}), поэтому две точки при k${SUP[2]} < ${Rstr(R(R2, e))} и ни одной при k${SUP[2]} > ${Rstr(R(R2, e))}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a >= f ? -c / (1 + Math.sqrt(a - f)) : null), label: "точка галочки при x < 0" },
        { f: (a) => (a > f + 1 ? c / (Math.sqrt(a - f) - 1) : null), label: "точка галочки при x > 0" },
        { f: () => d, dash: true, label: "центр окружности" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -c - 3, xMax: d + 6, aMin: f - 2, aMax: f + R2 / e + 6,
    },
  })
}

// =============================================================================
// РАЗДЕЛ J (начало). Уравнения с двумя модулями: |x − t| + |x + t| = 2·max(|x|, |t|)
// (эталон #82, #83, #85)
// =============================================================================
// Все три задачи — одно наблюдение: сумма |x − t| + |x + t| равна 2·max(|x|; |t|). После
// замены u = |x| ≥ 0, v = |t| ≥ 0 уравнение распадается на две ветви (u ≤ v и u > v), в каждой
// из которых остаётся МНОГОЧЛЕН с рациональными коэффициентами: корни на нужном промежутке
// считает Штурм, а ветвь u ≤ v даёт не больше одного значения u. Каждое u > 0 даёт два x, u = 0 — один.
function buildMaxAbs({ shape, p, k }) {
  const solve = (a) => {
    const t = Rsub(a, R(p)), v = Rsign(t) < 0 ? Rneg(t) : t
    const v2 = Rmul(v, v), v4 = Rmul(v2, v2)
    // ветвь u ≤ v: max = v
    const c = shape === "root" ? Rsub(Rmul(R(4 * k * k), v2), v4) : Rsub(Rmul(R(2 * k), v), v2)
    const cap = shape === "sq" ? v2 : v4                   // u ≤ v ⟺ u^deg ≤ v^deg
    let zero = false, pos = 0
    if (Rzero(c)) zero = true
    else if (Rsign(c) > 0 && Rcmp(c, cap) <= 0) pos++
    // ветвь u > v: многочлен от u
    const poly = shape === "sq" ? [v2, R(-2 * k), R1]
      : shape === "quart" ? [v2, R(-2 * k), R0, R0, R1]
      : [v4, R0, R(-4 * k * k), R0, R1]
    pos += countRoots(poly, v, "+inf", false, false)
    return 2 * pos + (zero ? 1 : 0)
  }
  const crit = [R(p), R(p - k), R(p + k), R(p - 2 * k), R(p + 2 * k), R(p - 3 * k), R(p + 3 * k)]
  const want = shape === "quart" ? (n) => n <= 1 : (n) => n === 1
  return { set: assembleSet((a) => want(solve(a)), crit), solve }
}
const absSum = (p, k) => {
  const co = k === 1 ? "" : `${k}`
  return `${co}|x ${MINUS} a + ${p}| + ${co}|x + a ${MINUS} ${p}|`
}
const T82 = []
for (const p of [1, 2, 3, 4, 5]) for (const k of [1, 2, 3]) T82.push({ p, k })
export function t18AbsSumSquare() {
  const par = pick(T82), { p, k } = par
  const { set, solve } = buildMaxAbs({ ...par, shape: "sq" })
  return item({
    text: `${HEAD_A}\n\nx${SUP[2]} + (${p} ${MINUS} a)${SUP[2]} = ${absSum(p, k)}\n\nимеет единственный корень.`,
    set,
    solution: `Обозначим t = a ${MINUS} ${p}. Правая часть равна ${k === 1 ? "" : k}(|x ${MINUS} t| + |x + t|) = ${2 * k}·max(|x|; |t|), а левая — x${SUP[2]} + t${SUP[2]}.\n`
      + `Уравнение чётно и по x, и по t, поэтому положим u = |x| ≥ 0, v = |t| ≥ 0: u${SUP[2]} + v${SUP[2]} = ${2 * k}·max(u; v). Каждое u > 0 даёт два корня x = ±u, а u = 0 — один.\n`
      + `При u ≤ v получаем u${SUP[2]} = ${2 * k}v ${MINUS} v${SUP[2]} (годится, если правая часть неотрицательна и не больше v${SUP[2]}), при u > v — u${SUP[2]} ${MINUS} ${2 * k}u + v${SUP[2]} = 0.\n`
      + `Единственный корень возможен только когда корень — это x = 0 и других нет: ${2 * k}v = v${SUP[2]}, то есть v = ${2 * k} (при v = 0 добавляются ещё x = ±${2 * k}).\n`
      + `Значит |a ${MINUS} ${p}| = ${2 * k}.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => Math.abs(a - p), label: "v = |a − p|" }, { f: () => 2 * k, dash: true, label: `v = ${2 * k}` }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: 4 * k + 4, aMin: p - 4 * k - 4, aMax: p + 4 * k + 4,
    },
  })
}
export function t18AbsSumQuartic() {
  const par = pick(T82), { p, k } = par
  const { set, solve } = buildMaxAbs({ ...par, shape: "quart" })
  return item({
    text: `${HEAD_A}\n\nx${SUP[4]} + (a ${MINUS} ${p})${SUP[2]} = ${absSum(p, k)}\n\nлибо имеет единственное решение, либо не имеет решений.`,
    set,
    solution: `Обозначим t = a ${MINUS} ${p}. Правая часть равна ${2 * k}·max(|x|; |t|), поэтому после замены u = |x| ≥ 0, v = |t| ≥ 0 уравнение принимает вид u${SUP[4]} + v${SUP[2]} = ${2 * k}·max(u; v).\n`
      + `Каждое u > 0 даёт два корня x = ±u, а u = 0 — один. Значит «не больше одного решения» ⟺ положительных u нет вовсе.\n`
      + `При u ≤ v: u${SUP[4]} = ${2 * k}v ${MINUS} v${SUP[2]} — положительное u есть только при 0 < v < ${2 * k}. При u > v: u${SUP[4]} ${MINUS} ${2 * k}u + v${SUP[2]} = 0, `
      + `и при v ≥ ${2 * k} левая часть строго положительна (u${SUP[4]} > ${2 * k}u уже при u > ${2 * k}).\n`
      + `Итого положительных u нет ровно при v ≥ ${2 * k}, то есть |a ${MINUS} ${p}| ≥ ${2 * k} (при v = ${2 * k} остаётся один корень x = 0, при v > ${2 * k} корней нет).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "countIn", values: [0, 1] },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => Math.abs(a - p), label: "v = |a − p|" }, { f: () => 2 * k, dash: true, label: `v = ${2 * k}` }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: 4 * k + 4, aMin: p - 4 * k - 4, aMax: p + 4 * k + 4,
    },
  })
}
export function t18AbsSumRoot() {
  const par = pick(T82), { p, k } = par
  const { set, solve } = buildMaxAbs({ ...par, shape: "root" })
  return item({
    text: `${HEAD_A}\n\n⟦r:x${SUP[4]} + (a ${MINUS} ${p})${SUP[4]}⟧ = ${absSum(p, k)}\n\nимеет единственное решение.`,
    set,
    solution: `Обозначим t = a ${MINUS} ${p}. Правая часть равна ${2 * k}·max(|x|; |t|) и неотрицательна, поэтому можно возвести в квадрат: x${SUP[4]} + t${SUP[4]} = ${4 * k * k}·max(|x|; |t|)${SUP[2]}.\n`
      + `После замены u = |x| ≥ 0, v = |t| ≥ 0: при u ≤ v получаем u${SUP[4]} = ${4 * k * k}v${SUP[2]} ${MINUS} v${SUP[4]}, при u > v — u${SUP[4]} ${MINUS} ${4 * k * k}u${SUP[2]} + v${SUP[4]} = 0.\n`
      + `Каждое u > 0 даёт два корня x = ±u, значит единственный корень — это x = 0 и никаких других: ${4 * k * k}v${SUP[2]} = v${SUP[4]}, то есть v${SUP[2]} = ${4 * k * k}.\n`
      + `При v = 0 кроме нуля появляются ещё x = ±${2 * k}, поэтому годится только v = ${2 * k}, то есть |a ${MINUS} ${p}| = ${2 * k}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => Math.abs(a - p), label: "v = |a − p|" }, { f: () => 2 * k, dash: true, label: `v = ${2 * k}` }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: 4 * k + 4, aMin: p - 4 * k - 4, aMax: p + 4 * k + 4,
    },
  })
}


// #68. {x² + px + y² + qy + r = |x² + y² − R²|; px + qy = a} — «более одного решения».
// Модуль раскрывается по кругу x² + y² ≤ R²:
//   снаружи остаётся ПРЯМАЯ px + qy = L, где L = −(r + R²);
//   внутри — окружность C: x² + y² + (p/2)x + (q/2)y + (r − R²)/2 = 0.
// Ключ: для точки НА C разность x² + y² − R² равна −(px + qy − L)/2, поэтому «внутри круга»
// на C равносильно px + qy > L. Значит вторая строка (прямая, параллельная первой ветви!)
// либо совпадает с ветвью-прямой (тогда решений бесконечно много), либо при a > L даёт
// пересечения с C, либо при a < L не даёт ничего. Наборы взяты так, что (p; q) — пифагорова
// пара, а радиус C рационален: тогда все границы круглые.
function build68({ p, q, R2, r }) {
  const k2 = p * p + q * q
  const k = Math.round(Math.sqrt(k2))
  const L = -(r + R2)
  const c0 = -k2 / 4                                       // значение px + qy в центре C
  const rho2 = k2 / 16 + (R2 - r) / 2                      // квадрат радиуса C
  const rho = Math.sqrt(rho2)
  if (k * k !== k2 || rho2 <= 0 || !Number.isInteger(2 * rho) || Math.abs(L - c0) >= k * rho) return null
  const solve = (a) => {
    if (Rcmp(a, R(L)) === 0) return 99                     // прямая совпала с ветвью-прямой
    if (Rcmp(a, R(L)) < 0) return 0
    const d = Rsub(a, R(c0, 1))
    const cc = Rcmp(Rmul(d, d), Rmul(R(k2), R(Math.round(4 * rho2), 4)))
    return cc < 0 ? 2 : cc === 0 ? 1 : 0
  }
  const crit = [R(L), R(Math.round(4 * (c0 - k * rho)), 4), R(Math.round(4 * (c0 + k * rho)), 4)]
  return { set: assembleSet((a) => solve(a) >= 2, crit), solve, L, c0, rho }
}
const T68 = []
for (const [p, q] of [[6, 8], [8, 6], [6, -8], [-6, 8], [3, 4], [4, 3], [4, -3], [-3, 4]]) {
  for (const R2 of [9, 16, 25, 36]) for (const dd of [3, 7, 12, 24, 48]) {
    const par = { p, q, R2, r: R2 - dd }
    const res = build68(par)
    if (!res || !res.set.intervals.length) continue
    const b = setBounds(res.set)
    if (!b.length || b.some((x) => x.d > 4n || (x.n < 0n ? -x.n : x.n) > 200n)) continue
    T68.push(par)
  }
}
export function t18SysAbsCircleLine() {
  const par = pick(T68), { p, q, R2, r } = par
  const { set, solve, L, rho } = build68(par)
  const lin = `${p === 1 ? "" : nS(p)}x${term(q, "y")}`
  return item({
    text: `${HEAD_SYS}\n⟦cases:x${SUP[2]}${term(p, "x")} + y${SUP[2]}${term(q, "y")}${term(r, "")} = |x${SUP[2]} + y${SUP[2]} ${MINUS} ${R2}|¦${lin} = a⟧\n\nимеет более одного решения.`,
    set,
    solution: `Раскроем модуль. Если x${SUP[2]} + y${SUP[2]} ≥ ${R2}, всё сокращается до прямой ${lin} = ${nS(L)}. `
      + `Если x${SUP[2]} + y${SUP[2]} < ${R2}, получаем окружность C: 2x${SUP[2]} + 2y${SUP[2]}${term(p, "x")}${term(q, "y")}${term(r - R2, "")} = 0 радиуса ${Rstr(R(Math.round(2 * rho), 2))}.\n`
      + `Заметим, что для точки НА C выполнено x${SUP[2]} + y${SUP[2]} ${MINUS} ${R2} = ${MINUS}(${lin} ${MINUS} ${nS(L)})/2, поэтому условие «внутри круга» на C равносильно ${lin} > ${nS(L)}.\n`
      + `Вторая строка — прямая, ПАРАЛЛЕЛЬНАЯ первой ветви. При a = ${nS(L)} она с ней совпадает и решений бесконечно много; при a < ${nS(L)} решений нет вовсе; `
      + `при a > ${nS(L)} решения — это пересечения с C, и их два, пока расстояние от центра C до прямой меньше её радиуса.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "atLeast", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: () => L, dash: true, label: "ветвь-прямая" }, { f: (a) => a, label: "вторая прямая" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: Rnum(setBounds(set)[0]) - 6, xMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 6,
      aMin: Rnum(setBounds(set)[0]) - 6, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 6,
    },
  })
}

// #78 и #79. {f(x) = f(y); x + y = a} — «более двух решений».
// Обе задачи об одном: кусочно-квадратичная f (из-за модуля) и симметричное условие
// f(x) = f(a − x). Решения считаются ТОЧНО: точки склейки — это разрывы кусков и их
// отражения a − b; между ними разность f(x) − f(a − x) есть многочлен над Q (композиция
// многочлена с a − x считается явно), и его корни на промежутке даёт Штурм.
// Отдельно проверяется, не обратилась ли разность в ТОЖДЕСТВЕННЫЙ нуль — тогда решений
// бесконечно много (так бывает ровно при одном значении a, когда «параболы» совпадают).
function pCompLin(P, al, be) {                             // P(al + be·x)
  let res = [], pw = [R1]
  for (let i = 0; i < P.length; i++) { res = pAdd(res, pMul([P[i]], pw)); pw = pMul(pw, [al, be]) }
  return pTrim(res)
}
function countSymEq({ cuts, polys }, a) {
  const pieceAt = (x) => { for (let i = 0; i < cuts.length; i++) if (Rcmp(x, cuts[i]) <= 0) return i; return cuts.length }
  const fVal = (x) => pEval(polys[pieceAt(x)], x)
  const marks = uniqSorted([...cuts, ...cuts.map((c) => Rsub(a, c))])
  let n = 0
  for (const c of marks) if (Rcmp(fVal(c), fVal(Rsub(a, c))) === 0) n++
  for (let i = 0; i <= marks.length; i++) {
    const lo = i === 0 ? "-inf" : marks[i - 1], hi = i === marks.length ? "+inf" : marks[i]
    const mid = lo === "-inf" ? Rsub(hi, R1) : hi === "+inf" ? Radd(lo, R1) : Rdiv(Radd(lo, hi), R(2))
    const g = pSub(polys[pieceAt(mid)], pCompLin(polys[pieceAt(Rsub(a, mid))], a, R(-1)))
    if (!pTrim(g).length) return 99                        // тождественное совпадение
    n += countRoots(g, lo, hi, false, false)
  }
  return n
}

// #78. f(s) = |s² − c²| + 2ks − s²: снаружи полосы |s| ≥ c это ЛИНЕЙНАЯ 2ks − c²,
// внутри — парабола −2s² + 2ks + c². Критические значения a рациональны: ±2c (корень
// выходит на границу |y| = c), k (разность обращается в тождественный нуль) и (k² + c²)/k
// (дискриминант «смешанного» случая равен нулю).
function build78({ c, k }) {
  const pw = { cuts: [R(-c), R(c)], polys: [[R(-c * c), R(2 * k)], [R(c * c), R(2 * k), R(-2)], [R(-c * c), R(2 * k)]] }
  const solve = (a) => countSymEq(pw, a)
  const crit = [R(2 * c), R(-2 * c), R(k), R(k * k + c * c, k)]
  return { set: assembleSet((a) => solve(a) >= 3, crit), solve }
}
const T78 = []
for (const c of [1, 2, 3, 4]) for (const k of [1, 2, 3, 4, 6]) {
  const res = build78({ c, k })
  const b = setBounds(res.set)
  if (!b.length || b.some((x) => x.d > 12n)) continue
  T78.push({ c, k })
}
export function t18SymAbsQuadPair() {
  const par = pick(T78), { c, k } = par
  const { set, solve } = build78(par)
  const side = (v) => `|${v}${SUP[2]} ${MINUS} ${c * c}| + ${2 * k === 1 ? "" : 2 * k}${v} ${MINUS} ${v}${SUP[2]}`
  return item({
    text: `${HEAD_SYS}\n⟦cases:${side("x")} = ${side("y")}¦x + y = a⟧\n\nимеет более двух решений.`,
    set,
    solution: `Обозначим f(s) = |s${SUP[2]} ${MINUS} ${c * c}| + ${2 * k === 1 ? "" : 2 * k}s ${MINUS} s${SUP[2]}. При |s| ≥ ${c} модуль раскрывается со знаком плюс и квадраты сокращаются: f(s) = ${2 * k === 1 ? "" : 2 * k}s ${MINUS} ${c * c} — ЛИНЕЙНАЯ функция.\n`
      + `При |s| < ${c} получаем f(s) = ${MINUS}2s${SUP[2]} + ${2 * k === 1 ? "" : 2 * k}s + ${c * c} — параболу.\n`
      + `Система означает f(x) = f(a ${MINUS} x). Решение x = a/2 есть всегда, поэтому «более двух решений» — это «есть решение с x ≠ a ${MINUS} x».\n`
      + `Если оба числа вне полосы, из линейности сразу x = a ${MINUS} x. Если оба внутри, разность равна (${k} ${MINUS} a)(4x ${MINUS} 2a): при a = ${k} подходит целый отрезок.\n`
      + `Остаётся смешанный случай (одно внутри, другое вне): подстановка даёт u${SUP[2]} ${MINUS} ${2 * k}u + ${k}a ${MINUS} ${c * c} = 0, то есть u = ${k} ± ⟦r:${k * k + c * c} ${MINUS} ${k}a⟧, и нужно, чтобы такое u попало в полосу, а a ${MINUS} u — вне неё.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "atLeast", n: 3 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => a / 2, label: "решение x = a/2" }, { f: () => c, dash: true, label: "границы полосы" }, { f: () => -c, dash: true }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2 * c - 4, xMax: 2 * c + 4,
      aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// #79. f(s) = s² + |s² − 2ds|: на [0; 2d] это ЛИНЕЙНАЯ 2ds, вне — 2s² − 2ds.
// Критические значения: 0, d (разность обращается в тождественный нуль) и 4d.
function build79({ d }) {
  const pw = { cuts: [R0, R(2 * d)], polys: [[R0, R(-2 * d), R(2)], [R0, R(2 * d)], [R0, R(-2 * d), R(2)]] }
  const solve = (a) => countSymEq(pw, a)
  return { set: assembleSet((a) => solve(a) >= 3, [R0, R(d), R(4 * d)]), solve }
}
const T79 = [1, 2, 3, 4, 5].map((d) => ({ d }))
export function t18SymAbsShiftPair() {
  const par = pick(T79), { d } = par
  const { set, solve } = build79(par)
  const side = (v) => `${v}${SUP[2]} + |${v}${SUP[2]} ${MINUS} ${2 * d === 1 ? "" : 2 * d}${v}|`
  return item({
    text: `${HEAD_SYS}\n⟦cases:${side("x")} = ${side("y")}¦x + y = a⟧\n\nимеет более двух решений.`,
    set,
    solution: `Обозначим f(s) = s${SUP[2]} + |s${SUP[2]} ${MINUS} ${2 * d === 1 ? "" : 2 * d}s|. При 0 ≤ s ≤ ${2 * d} модуль раскрывается со знаком минус и квадраты сокращаются: f(s) = ${2 * d === 1 ? "" : 2 * d}s — ЛИНЕЙНАЯ функция.\n`
      + `При s ≤ 0 и при s ≥ ${2 * d} получаем f(s) = 2s${SUP[2]} ${MINUS} ${2 * d === 1 ? "" : 2 * d}s.\n`
      + `Система означает f(x) = f(a ${MINUS} x); решение x = a/2 есть всегда, значит «более двух решений» — это «есть решение с x ≠ a ${MINUS} x».\n`
      + `Если оба числа вне отрезка [0; ${2 * d}], разность равна 2(x ${MINUS} y)(x + y ${MINUS} ${d}), то есть при a = ${d} подходит бесконечно много точек. `
      + `Если оба внутри, линейность сразу даёт x = a ${MINUS} x.\n`
      + `В смешанном случае 2x${SUP[2]} ${MINUS} ${2 * d}x = ${2 * d}(a ${MINUS} x) даёт x${SUP[2]} = ${d}a, то есть x = ±⟦r:${d}a⟧ — и нужно, чтобы такое x было вне отрезка, а a ${MINUS} x — внутри.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "atLeast", n: 3 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a / 2, label: "решение x = a/2" },
        { f: (a) => (a * d >= 0 ? Math.sqrt(a * d) : null), label: "x = √(da)" },
        { f: () => 2 * d, dash: true, label: "границы отрезка" }, { f: () => 0, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2 * d - 4, xMax: 4 * d + 4,
      aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}


// =============================================================================
// РАЗДЕЛ M. Квадрат по замене, расстояние между корнями (эталон #102–#115)
// =============================================================================

// #102. (x² + kx + m + 2a²)² = 8a²(x² + kx + m) — «ровно один корень».
// Обозначив s = x² + kx + m, получаем (s + 2a²)² = 8a²s ⟺ s² − 4a²s + 4a⁴ = 0 ⟺ (s − 2a²)² = 0.
// Значит всё сводится к x² + kx + m − 2a² = 0 с дискриминантом k² − 4m + 8a².
// Наборы взяты так, что 4m − k² = 8w²: тогда единственный корень ровно при a = ±w.
function build102({ k, m }) {
  const w2 = (4 * m - k * k) / 8
  const w = Math.round(Math.sqrt(w2))
  if (w * w !== w2 || w === 0) return null
  const solve = (a) => countRoots([Rsub(R(m), Rmul(R(2), Rmul(a, a))), R(k), R1], "-inf", "+inf", false, false)
  return { set: assembleSet((a) => solve(a) === 1, [R0, R(w), R(-w)]), solve, w }
}
const T102 = []
for (const j of [0, 1, 2, 3]) for (const w of [1, 2, 3]) T102.push({ k: 2 * j, m: j * j + 2 * w * w })
export function t18SubstSquareOne() {
  const par = pick(T102), { k, m } = par
  const { set, solve, w } = build102(par)
  const S = `x${SUP[2]}${term(k, "x")} + ${m}`
  return item({
    text: `${HEAD_A}\n\n(${S} + 2a${SUP[2]})${SUP[2]} = 8a${SUP[2]}(${S})\n\nимеет ровно один корень.`,
    set,
    solution: `Обозначим s = ${S}. Уравнение принимает вид (s + 2a${SUP[2]})${SUP[2]} = 8a${SUP[2]}s, то есть s${SUP[2]} ${MINUS} 4a${SUP[2]}s + 4a${SUP[4]} = 0, или (s ${MINUS} 2a${SUP[2]})${SUP[2]} = 0.\n`
      + `Значит s = 2a${SUP[2]}, то есть ${S} ${MINUS} 2a${SUP[2]} = 0 — квадратное уравнение с дискриминантом ${k * k} ${MINUS} ${4 * m} + 8a${SUP[2]} = 8a${SUP[2]} ${MINUS} ${4 * m - k * k}.\n`
      + `Ровно один корень — когда дискриминант равен нулю: a${SUP[2]} = ${w * w}.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: () => -k / 2, dash: true, label: "вершина параболы" }, { f: (a) => (8 * a * a - (4 * m - k * k) >= 0 ? -k / 2 + Math.sqrt(8 * a * a - (4 * m - k * k)) / 2 : null), label: "корни" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -k - 6, xMax: 6, aMin: -w - 4, aMax: w + 4,
    },
  })
}

// #103. x² − 2px + (p² + m) + a² − 2ka = 0 — «модуль разности корней наибольший».
// Дискриминант равен −(a² − 2ka + m) = (k² − m) − (a − k)², то есть |x₁ − x₂| = 2√D
// максимален ровно при a = k. Решатель сравнивает 4D с квадратом заявленного максимума —
// это независимая проверка: если бы максимум был назван неверно, множество не совпало бы.
function build103({ k, m }) {                             // p — сдвиг по x, на ответ не влияет
  if (k * k - m <= 0) return null
  const M2 = 4 * (k * k - m)                               // квадрат наибольшего значения |x₁ − x₂|
  const D = (a) => Rneg(Radd(Rsub(Rmul(a, a), Rmul(R(2 * k), a)), R(m)))
  const solve = (a) => (Rsign(D(a)) >= 0 && Rcmp(Rmul(R(4), D(a)), R(M2)) >= 0 ? 1 : 0)
  return { set: assembleSet((a) => solve(a) === 1, [R(k)]), solve, M2 }
}
const T103 = []
for (const p of [2, 3, 4, 5]) for (const k of [1, 2, 3, 4]) for (const m of [-3, -2, 0, 3]) {
  if (k * k - m <= 0 || p * p + m <= 0) continue
  T103.push({ p, k, m })
}
export function t18RootGapMax() {
  const par = pick(T103), { p, k, m } = par
  const { set, solve, M2 } = build103(par)
  const mx = Math.round(Math.sqrt(M2)) ** 2 === M2 ? `${Math.round(Math.sqrt(M2))}` : `2⟦r:${k * k - m}⟧`
  return item({
    text: `Найдите все значения a, при каждом из которых модуль разности корней уравнения\n\n`
      + `x${SUP[2]} ${MINUS} ${2 * p}x + ${p * p + m} + a${SUP[2]} ${MINUS} ${2 * k}a = 0\n\nпринимает наибольшее значение.`,
    set,
    solution: `Дискриминант уравнения равен ${p * p} ${MINUS} (${p * p + m} + a${SUP[2]} ${MINUS} ${2 * k}a) = ${MINUS}(a${SUP[2]}${term(-2 * k, "a")}${term(m, "")}) = ${k * k - m} ${MINUS} (a ${MINUS} ${k})${SUP[2]}.\n`
      + `Корни существуют, когда он неотрицателен, а |x₁ ${MINUS} x₂| = ⟦r:D⟧, поэтому модуль разности тем больше, чем больше D.\n`
      + `Наибольшее значение D равно ${k * k - m} и достигается ровно при a = ${k}; тогда |x₁ ${MINUS} x₂| = ${mx}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: () => p, dash: true, label: "середина между корнями" },
        { f: (a) => (k * k - m - (a - k) * (a - k) >= 0 ? p + Math.sqrt(k * k - m - (a - k) * (a - k)) : null), label: "корни" },
        { f: (a) => (k * k - m - (a - k) * (a - k) >= 0 ? p - Math.sqrt(k * k - m - (a - k) * (a - k)) : null) }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: p - 6, xMax: p + 6, aMin: k - 8, aMax: k + 8,
    },
  })
}

// #104. w²(ax − kx²) + 1/(ax − kx²) + 2w = 0 — «ровно два корня на [L; R)».
// Обозначив t = ax − kx², получаем w²t² + 2wt + 1 = 0 ⟺ (wt + 1)² = 0, то есть t = −1/w.
// Остаётся wkx² − wax − 1 = 0; произведение корней отрицательно, значит один корень
// отрицателен, другой положителен. Число корней на полуинтервале Штурм считает точно.
function build104({ w, kk, L, Rr }) {
  const solve = (a) => countRoots([R(-1), Rmul(R(-w), a), R(w * kk)], R(L), R(Rr), true, false)
  const crit = [R(w * kk * L * L - 1, w * L), R(w * kk * Rr * Rr - 1, w * Rr)]
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
const T104 = []
for (const w of [1, 2, 3]) for (const kk of [1, 2]) for (const [L, Rr] of [[-1, 1], [-1, 2], [-2, 1], [-2, 2]]) {
  const res = build104({ w, kk, L, Rr })
  const b = setBounds(res.set)
  if (!b.length || b.some((x) => x.d > 12n)) continue
  T104.push({ w, kk, L, Rr })
}
export function t18SubstReciprocalSeg() {
  const par = pick(T104), { w, kk, L, Rr } = par
  const { set, solve } = build104(par)
  const T = `ax ${MINUS} ${kk === 1 ? "" : kk}x${SUP[2]}`
  return item({
    text: `${HEAD_A}\n\n${w * w === 1 ? "" : w * w}(${T}) + ${fT("1", T)} + ${2 * w} = 0\n\nимеет ровно два различных корня на промежутке [${nS(L)}; ${Rr}).`,
    set,
    solution: `Обозначим t = ${T} (он не равен нулю). Умножив на t, получаем ${w * w === 1 ? "" : w * w}t${SUP[2]} + ${2 * w}t + 1 = 0, то есть (${w === 1 ? "" : w}t + 1)${SUP[2]} = 0 и t = ${MINUS}${Rstr(R(1, w))}.\n`
      + `Значит ${T} = ${MINUS}${Rstr(R(1, w))}, то есть ${w * kk === 1 ? "" : w * kk}x${SUP[2]} ${MINUS} ${w === 1 ? "" : w}ax ${MINUS} 1 = 0.\n`
      + `Произведение корней равно ${MINUS}${Rstr(R(1, w * kk))} < 0, поэтому корни всегда существуют, различны и лежат по разные стороны от нуля.\n`
      + `Оба корня попадают на [${nS(L)}; ${Rr}) ровно тогда, когда значения левой части на концах имеют нужные знаки: отсюда границы по a.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (w * a + Math.sqrt(w * w * a * a + 4 * w * kk)) / (2 * w * kk), label: "больший корень" },
        { f: (a) => (w * a - Math.sqrt(w * w * a * a + 4 * w * kk)) / (2 * w * kk), label: "меньший корень" },
        { f: () => L, dash: true, label: "концы промежутка" }, { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: L - 2, xMax: Rr + 2, aMin: -6, aMax: 6,
    },
  })
}

// #106. ax² + 2(a + p)x + (a + q) = 0 — «два корня, расстояние между ними больше d».
// Четверть дискриминанта равна (a + p)² − a(a + q) = (2p − q)a + p², а квадрат расстояния
// между корнями — 4·(четверть дискриминанта)/a². Наборы подобраны так, что (2p − q)² + d²p²
// — полный квадрат: тогда границы ответа рациональны.
function build106({ p, q, d }) {
  const solve = (a) => {
    if (Rzero(a)) return 0
    const D = Radd(Rmul(R(2 * p - q), a), R(p * p))
    if (Rsign(D) <= 0) return 0
    return Rcmp(Rmul(R(4), D), Rmul(R(d * d), Rmul(a, a))) > 0 ? 1 : 0
  }
  const crit = [R0]
  const { roots, allRational } = ratRoots([R(4 * p * p), R(4 * (2 * p - q)), R(-d * d)])
  if (!allRational) return null
  crit.push(...roots)
  if (2 * p - q !== 0) crit.push(R(-p * p, 2 * p - q))
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T106 = []
for (const [p, q, d] of [[3, 2, 1], [4, 5, 1], [6, 4, 1], [8, 10, 1], [12, 19, 1], [3, 6, 2], [3, -2, 2], [4, 8, 2], [4, 2, 2], [6, 12, 2], [6, 4, 3]]) {
  const res = build106({ p, q, d })
  if (!res || !res.set.intervals.length) continue
  const b = setBounds(res.set)
  if (!b.length || b.some((x) => x.d > 12n || (x.n < 0n ? -x.n : x.n) > 99n)) continue
  T106.push({ p, q, d })
}
export function t18RootGapGreater() {
  const par = pick(T106), { p, q, d } = par
  const { set, solve } = build106(par)
  return item({
    text: `${HEAD_A}\n\nax${SUP[2]} + 2(a + ${p})x + a + ${nS(q)} = 0\n\nимеет два различных корня, расстояние между которыми больше ${d}.`,
    set,
    solution: `При a = 0 уравнение линейное, поэтому a ≠ 0. Четверть дискриминанта равна (a + ${p})${SUP[2]} ${MINUS} a(a + ${nS(q)}) = ${nS(2 * p - q)}a + ${p * p}.\n`
      + `Квадрат расстояния между корнями равен ${fT(`4(${nS(2 * p - q)}a + ${p * p})`, `a${SUP[2]}`)}, и условие «больше ${d}» превращается в 4(${nS(2 * p - q)}a + ${p * p}) > ${d * d === 1 ? "" : d * d}a${SUP[2]} `
      + `(она же автоматически даёт положительность дискриминанта).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => (a !== 0 ? -(a + p) / a : null), label: "середина между корнями" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 8, aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// #107. (ax² − 2x)² + (ca² − a + c₀)(ax² − 2x) − ca²(a − c₀) = 0 — «ровно два решения».
// Левая часть — квадратный трёхчлен по t = ax² − 2x, который РАСКЛАДЫВАЕТСЯ:
// (t + ca²)(t − a + c₀) = 0. Значит ax² − 2x + ca² = 0 или ax² − 2x − a + c₀ = 0.
// Число различных корней объединения считается точно: n₁ + n₂ − (число общих корней),
// а общие корни — это корни НОД двух многочленов.
function build107({ c, c0 }) {
  const solve = (a) => {
    const P1 = [Rmul(R(c), Rmul(a, a)), R(-2), a]
    const P2 = [Rsub(R(c0), a), R(-2), a]
    const cnt = (P) => countRoots(P, "-inf", "+inf", false, false)
    const g = pGcd(pTrim(P1), pTrim(P2))
    return cnt(P1) + cnt(P2) - (pDeg(g) > 0 ? cnt(g) : 0)
  }
  const crit = [R0, R(c0 > 0 ? 1 : -1)]
  const w = Math.round(Math.cbrt(c))
  if (w * w * w !== c) return null
  crit.push(R(1, w))
  const { roots, allRational } = ratRoots([R(-c0), R1, R(c)])   // ca² + a − c₀ = 0: уравнения совпали
  if (!allRational) return null
  crit.push(...roots)
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
const T107 = []
for (const c of [1, 8, 27]) for (const c0 of [2, -2]) {
  const res = build107({ c, c0 })
  if (!res || !res.set.intervals.length) continue
  T107.push({ c, c0 })
}
export function t18SubstFactorTwo() {
  const par = pick(T107), { c, c0 } = par
  const { set, solve } = build107(par)
  const T = `ax${SUP[2]} ${MINUS} 2x`
  return item({
    text: `${HEAD_A}\n\n(${T})${SUP[2]} + (${c === 1 ? "" : c}a${SUP[2]} ${MINUS} a${term(c0, "")})(${T}) ${MINUS} ${c === 1 ? "" : c}a${SUP[2]}(a${term(-c0, "")}) = 0\n\nимеет ровно два различных решения.`,
    set,
    solution: `Обозначим t = ${T}. Тогда левая часть — квадратный трёхчлен по t, который раскладывается на множители:\n`
      + `t${SUP[2]} + (${c === 1 ? "" : c}a${SUP[2]} ${MINUS} a${term(c0, "")})t ${MINUS} ${c === 1 ? "" : c}a${SUP[2]}(a${term(-c0, "")}) = (t + ${c === 1 ? "" : c}a${SUP[2]})(t ${MINUS} a${term(c0, "")}) = 0.\n`
      + `Значит ${T} = ${MINUS}${c === 1 ? "" : c}a${SUP[2]} или ${T} = a${term(-c0, "")}, то есть\n`
      + `ax${SUP[2]} ${MINUS} 2x + ${c === 1 ? "" : c}a${SUP[2]} = 0 и ax${SUP[2]} ${MINUS} 2x ${MINUS} a${term(c0, "")} = 0.\n`
      + `У первого четверть дискриминанта равна 1 ${MINUS} ${c === 1 ? "" : c}a${SUP[3]}, у второго — (a${term(-c0 / 2, "")})${SUP[2]} ≥ 0, то есть второе уравнение корни имеет всегда. `
      + `Ровно два различных корня получаются, когда первое уравнение корней не имеет либо когда оба уравнения совпадают.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => (a !== 0 ? 1 / a : null), dash: true, label: "вершина парабол" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -6, xMax: 6, aMin: -4, aMax: 4,
    },
  })
}

// #108. (x + 1/(x − a))² − (a + w)(x + 1/(x − a)) + 2a(w − a) = 0 — «ровно четыре решения».
// Трёхчлен по u = x + 1/(x − a) раскладывается: (u − 2a)(u − (w − a)) = 0.
// Равенство x + 1/(x − a) = c равносильно (x − a)(x − c) + 1 = 0, то есть
// x² − (a + c)x + ac + 1 = 0 (x = a корнем быть не может — подстановка даёт 1 = 0).
function build108({ w }) {
  const quad = (c, a) => [Radd(Rmul(a, c), R1), Rneg(Radd(a, c)), R1]
  const solve = (a) => {
    const P1 = quad(Rmul(R(2), a), a), P2 = quad(Rsub(R(w), a), a)
    const cnt = (P) => countRoots(P, "-inf", "+inf", false, false)
    const g = pGcd(P1, P2)
    return cnt(P1) + cnt(P2) - (pDeg(g) > 0 ? cnt(g) : 0)
  }
  const crit = [R(2), R(-2), R(w - 2, 2), R(w + 2, 2), R(w, 3)]
  return { set: assembleSet((a) => solve(a) === 4, crit), solve }
}
const T108 = [6, 7, 8, 9, 10, 11, 12].map((w) => ({ w }))
export function t18SubstReciprocalFour() {
  const par = pick(T108), { w } = par
  const { set, solve } = build108(par)
  const U = `x + ${fT("1", `x ${MINUS} a`)}`
  return item({
    text: `${HEAD_A}\n\n(${U})${SUP[2]} ${MINUS} (a + ${w})(${U}) + 2a(${w} ${MINUS} a) = 0\n\nимеет ровно четыре различных решения.`,
    set,
    solution: `Обозначим u = ${U}. Трёхчлен по u раскладывается: u${SUP[2]} ${MINUS} (a + ${w})u + 2a(${w} ${MINUS} a) = (u ${MINUS} 2a)(u ${MINUS} ${w} + a) = 0.\n`
      + `Равенство ${U} = c равносильно (x ${MINUS} a)(x ${MINUS} c) + 1 = 0, то есть x${SUP[2]} ${MINUS} (a + c)x + ac + 1 = 0 (значение x = a корнем быть не может: подстановка даёт 1 = 0).\n`
      + `При c = 2a получаем x${SUP[2]} ${MINUS} 3ax + 2a${SUP[2]} + 1 = 0 с дискриминантом a${SUP[2]} ${MINUS} 4, при c = ${w} ${MINUS} a — x${SUP[2]} ${MINUS} ${w}x + a(${w} ${MINUS} a) + 1 = 0 с дискриминантом (2a ${MINUS} ${w})${SUP[2]} ${MINUS} 4.\n`
      + `Четыре различных решения — когда оба дискриминанта положительны и уравнения не совпали (совпадение происходит при a = ${Rstr(R(w, 3))}).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 4 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => a, dash: true, label: "выколотое x = a" }, { f: (a) => 1.5 * a, label: "середина первой пары" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 12, aMin: -6, aMax: w + 4,
    },
  })
}

// #109. ((a − 1)x² + bx)² − 2((a − 1)x² + bx) + 1 − a² = 0 — «ровно два решения».
// По t = (a − 1)x² + bx: (t − 1)² = a², то есть t = 1 + a или t = 1 − a.
// Дискриминанты получившихся уравнений равны b² + 4a² − 4 и b² − 4(a − 1)².
function build109({ b }) {
  const solve = (a) => {
    const A = Rsub(a, R1)
    const P1 = [Rneg(Radd(R1, a)), R(b), A], P2 = [Rsub(a, R1), R(b), A]
    const cnt = (P) => countRoots(P, "-inf", "+inf", false, false)
    const g = pGcd(pTrim(P1), pTrim(P2))
    return cnt(P1) + cnt(P2) - (pDeg(g) > 0 ? cnt(g) : 0)
  }
  const crit = [R0, R1, R(2 - b, 2), R(2 + b, 2)]
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
const T109 = [2, 3, 4, 5, 6].map((b) => ({ b }))
export function t18SubstShiftTwo() {
  const par = pick(T109), { b } = par
  const { set, solve } = build109(par)
  const T = `(a ${MINUS} 1)x${SUP[2]} + ${b === 1 ? "" : b}x`
  return item({
    text: `${HEAD_A}\n\n(${T})${SUP[2]} ${MINUS} 2(${T}) + 1 ${MINUS} a${SUP[2]} = 0\n\nимеет ровно два различных решения.`,
    set,
    solution: `Обозначим t = ${T}. Тогда t${SUP[2]} ${MINUS} 2t + 1 = a${SUP[2]}, то есть (t ${MINUS} 1)${SUP[2]} = a${SUP[2]} и t = 1 + a или t = 1 ${MINUS} a.\n`
      + `Первое даёт (a ${MINUS} 1)x${SUP[2]} + ${b === 1 ? "" : b}x ${MINUS} 1 ${MINUS} a = 0 с дискриминантом ${b * b} + 4(a ${MINUS} 1)(a + 1) = ${b * b} + 4a${SUP[2]} ${MINUS} 4, `
      + `второе — (a ${MINUS} 1)x${SUP[2]} + ${b === 1 ? "" : b}x + a ${MINUS} 1 = 0 с дискриминантом ${b * b} ${MINUS} 4(a ${MINUS} 1)${SUP[2]}.\n`
      + `При a = 1 оба уравнения линейные и дают ровно два корня; при a = 0 они совпадают.\n`
      + `Ровно два различных решения — когда второе уравнение корней не имеет, то есть |a ${MINUS} 1| > ${Rstr(R(b, 2))}, плюс отдельные значения a = 0 и a = 1.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => (a !== 1 ? -b / (2 * (a - 1)) : null), label: "вершина парабол" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 8, aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// #114. |x² − 2ax + c| = |ka − x² − 2bx − d| — «более двух различных корней».
// Равенство модулей распадается: A = B даёт x² + (b − a)x + (c + d − ka)/2 = 0,
// а A = −B — линейное уравнение, которое при c − d = kb превращается в x = k/2
// (не зависит от a!), а при a = −b становится тождеством: тогда решений бесконечно много.
// Условие «k² + 4d — полный квадрат» делает границы ответа рациональными.
function build114({ b, k, d }) {
  const c = d + k * b
  const P = (a) => [Rdiv(Rsub(R(c + d), Rmul(R(k), a)), R(2)), Rsub(R(b), a), R1]
  const solve = (a) => {
    if (Rcmp(a, R(-b)) === 0) return 99                    // A ≡ −B: подходит любое x
    let n = countRoots(P(a), "-inf", "+inf", false, false) + 1
    if (Rzero(pEval(P(a), R(k, 2)))) n -= 1                // x = k/2 уже среди корней
    return n
  }
  const crit = [R(-b), R(k * k + 2 * k * b + 2 * c + 2 * d, 4 * k)]
  const { roots, allRational } = ratRoots([R(b * b - 2 * c - 2 * d), R(2 * k - 2 * b), R1])
  if (!allRational) return null
  crit.push(...roots)
  return { set: assembleSet((a) => solve(a) >= 3, crit), solve, c }
}
const T114 = []
for (const [k, d] of [[2, 3], [2, 8], [2, 15], [4, 5], [4, 12], [4, 21], [6, 7], [6, 16], [6, 27], [8, 9], [8, 20]]) {
  for (const b of [1, 2, 3]) {
    const res = build114({ b, k, d })
    if (!res || res.set.intervals.length < 2) continue
    const bd = setBounds(res.set)
    if (!bd.length || bd.some((x) => x.d > 12n || (x.n < 0n ? -x.n : x.n) > 99n)) continue
    T114.push({ b, k, d })
  }
}
export function t18AbsEqAbsMoreTwo() {
  const par = pick(T114), { b, k, d } = par
  const { set, solve, c } = build114(par)
  return item({
    text: `${HEAD_A}\n\n|x${SUP[2]} ${MINUS} 2ax + ${c}| = |${k}a ${MINUS} x${SUP[2]} ${MINUS} ${2 * b === 1 ? "" : 2 * b}x ${MINUS} ${d}|\n\nимеет более двух различных корней.`,
    set,
    solution: `Обозначим A = x${SUP[2]} ${MINUS} 2ax + ${c} и B = ${k}a ${MINUS} x${SUP[2]} ${MINUS} ${2 * b === 1 ? "" : 2 * b}x ${MINUS} ${d}. Равенство |A| = |B| означает A = B или A = ${MINUS}B.\n`
      + `Случай A = ${MINUS}B: квадраты сокращаются, остаётся ${MINUS}2ax + ${c} = ${2 * b === 1 ? "" : 2 * b}x ${MINUS} ${k}a + ${d}, то есть 2(a + ${b})x = ${k}(a + ${b}). При a ≠ ${MINUS}${b} отсюда x = ${Rstr(R(k, 2))} — один и тот же корень при всех a, а при a = ${MINUS}${b} равенство выполняется тождественно (решений бесконечно много).\n`
      + `Случай A = B: 2x${SUP[2]} + ${2 * b === 1 ? "2" : 2 * b}x ${MINUS} 2ax + ${c} + ${d} ${MINUS} ${k}a = 0, то есть x${SUP[2]} + (${b} ${MINUS} a)x + ${fT(`${c + d} ${MINUS} ${k}a`, "2")} = 0.\n`
      + `Больше двух корней — значит это квадратное уравнение должно давать два корня, отличных от ${Rstr(R(k, 2))}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "atLeast", n: 3 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: () => k / 2, dash: true, label: `корень x = ${Rstr(R(k, 2))}` }, { f: (a) => (a - b) / 2, label: "вершина параболы" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -10, xMax: 10, aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}


// =============================================================================
// РАЗДЕЛ P. Тригонометрия с параметром (эталон #130–#137, #155–#161)
// =============================================================================

// #134. (p·cos x − c − a)·cos x − q·cos 2x + r = 0 — «хотя бы один корень».
// Замена u = cos x ∈ [−1; 1] и cos 2x = 2u² − 1: коэффициенты подобраны так (2q = p + 1),
// что квадрат по u сворачивается в u² + (c + a)u − d = 0, где d = q + r > 0.
// Свободный член отрицателен ⟹ корни лежат по разные стороны от нуля, поэтому корень
// попадает на [−1; 1] ровно тогда, когда f(−1) ≥ 0 или f(1) ≥ 0.
function build134({ p, c, d }) {
  const solve = (a) => countRoots([R(-d), Radd(R(c), a), R1], R(-1), R1, true, true)
  return { set: assembleSet((a) => solve(a) >= 1, [R(1 - c - d), R(d - c - 1)]), solve, q: (p + 1) / 2, r: d - (p + 1) / 2 }
}
const T134 = []
for (const p of [3, 5, 7]) for (const c of [1, 2, 3, 4, 5]) for (const d of [2, 3, 4, 6]) T134.push({ p, c, d })
export function t18TrigCosSubstExists() {
  const par = pick(T134), { p, c, d } = par
  const { set, solve, q, r } = build134(par)
  return item({
    text: `${HEAD_A}\n\n(${p}cos x ${MINUS} ${c} ${MINUS} a)·cos x ${MINUS} ${q === 1 ? "" : q}cos 2x${term(r, "")} = 0\n\nимеет хотя бы один корень.`,
    set,
    solution: `Обозначим u = cos x ∈ [${MINUS}1; 1] и воспользуемся cos 2x = 2u${SUP[2]} ${MINUS} 1:\n`
      + `(${p}u ${MINUS} ${c} ${MINUS} a)u ${MINUS} ${q === 1 ? "" : q}(2u${SUP[2]} ${MINUS} 1)${term(r, "")} = ${MINUS}u${SUP[2]} ${MINUS} (${c} + a)u + ${d} = 0, то есть u${SUP[2]} + (${c} + a)u ${MINUS} ${d} = 0.\n`
      + `Свободный член равен ${MINUS}${d} < 0, поэтому корни всегда есть и лежат по разные стороны от нуля; в частности f(0) = ${MINUS}${d} < 0.\n`
      + `Тогда корень попадает на [${MINUS}1; 1] ровно тогда, когда f(${MINUS}1) ≥ 0 или f(1) ≥ 0, то есть ${MINUS}${d - 1} ${MINUS} ${c} ${MINUS} a ≥ 0 или a + ${c} ${MINUS} ${d - 1} ≥ 0.\n`
      + `Каждое подходящее u даёт хотя бы один x.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (-(c + a) + Math.sqrt((c + a) * (c + a) + 4 * d)) / 2, label: "положительный корень u" },
        { f: (a) => (-(c + a) - Math.sqrt((c + a) * (c + a) + 4 * d)) / 2, label: "отрицательный корень u" },
        { f: () => 1, dash: true, label: "|u| ≤ 1" }, { f: () => -1, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -3, xMax: 3, aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// #135. k·sin x = m·cos x + a — «единственное решение» на [0; π] или на [0; π/2].
// k sin x − m cos x = c·sin(x − φ), где c = √(k² + m²), cos φ = k/c, sin φ = m/c;
// набор — пифагорова тройка, поэтому c рационально. Функция возрастает от −m до c
// (максимум достигается внутри (0; π/2)), а затем убывает до m (или до k на половинном отрезке).
function build135({ k, m, c, half }) {
  const endR = half ? k : m
  const solve = (a) => {
    if (Rcmp(a, R(-m)) < 0 || Rcmp(a, R(c)) > 0) return 0
    if (Rcmp(a, R(c)) === 0) return 1
    return Rcmp(a, R(endR)) >= 0 ? 2 : 1
  }
  return { set: assembleSet((a) => solve(a) === 1, [R(-m), R(endR), R(c)]), solve, endR }
}
const T135 = []
for (const [k, m, c] of [[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17], [7, 24, 25], [24, 7, 25], [20, 21, 29], [21, 20, 29]]) {
  for (const half of [false, true]) T135.push({ k, m, c, half })
}
export function t18TrigLinCombOne() {
  const par = pick(T135), { k, m, c, half } = par
  const { set, solve, endR } = build135(par)
  const seg = half ? `[0; ⟦f:π:2⟧]` : `[0; π]`
  return item({
    text: `${HEAD_A}\n\n${k}sin x = ${m === 1 ? "" : m}cos x + a\n\nимеет единственное решение на отрезке ${seg}.`,
    set,
    solution: `Перепишем: ${k}sin x ${MINUS} ${m === 1 ? "" : m}cos x = a. Так как ${k}${SUP[2]} + ${m}${SUP[2]} = ${c}${SUP[2]}, левая часть равна ${c}sin(x ${MINUS} φ), где cos φ = ${Rstr(R(k, c))}, sin φ = ${Rstr(R(m, c))} и φ ∈ (0; π/2).\n`
      + `На отрезке ${seg} функция сначала возрастает от значения ${MINUS}${m} (при x = 0) до ${c} (в точке x = φ), а затем убывает до ${endR}.\n`
      + `Поэтому при a < ${MINUS}${m} и при a > ${c} решений нет; при ${MINUS}${m} ≤ a < ${endR} решение одно (только на возрастающей ветви); при ${endR} ≤ a < ${c} их два; при a = ${c} — снова одно (вершина).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: () => c, dash: true, label: "наибольшее значение" }, { f: () => -m, dash: true, label: "значение в нуле" }, { f: (a) => a, label: "a" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -m - 3, xMax: c + 3, aMin: -m - 4, aMax: c + 4,
    },
  })
}

// #136. (tg x + b)² − (a² + ka + m + b)(tg x + b) + a²(ka + m + b) = 0 —
// «ровно два решения на [0; 3π/2]». Трёхчлен по t = tg x + b раскладывается:
// (t − a²)(t − (ka + m + b)) = 0, то есть tg x = a² − b или tg x = ka + m.
// На [0; 3π/2] уравнение tg x = v имеет один корень на (π/2; 3π/2) при ЛЮБОМ v
// (там тангенс непрерывно возрастает от −∞ до +∞) и ещё один на [0; π/2) при v ≥ 0.
// Набор подобран так, что b — полный квадрат (граница a² = b рациональна) и
// уравнение a² − ka − (m + b) = 0 «склейки двух ветвей» тоже имеет рациональные корни.
function build136({ b, k, m }) {
  const w = Math.round(Math.sqrt(b))
  if (w * w !== b) return null
  const solve = (a) => {
    const vs = uniqSorted([Rsub(Rmul(a, a), R(b)), Radd(Rmul(R(k), a), R(m))])
    return vs.reduce((n, v) => n + 1 + (Rsign(v) >= 0 ? 1 : 0), 0)
  }
  const crit = [R(w), R(-w), R(-m, k)]
  const { roots, allRational } = ratRoots([R(-(m + b)), R(-k), R1])
  if (!allRational) return null
  crit.push(...roots)
  return { set: assembleSet((a) => solve(a) === 2, crit), solve, w }
}
const T136 = [[9, 4, 3], [4, 4, 1], [16, 6, 11]].map(([b, k, m]) => ({ b, k, m }))
export function t18TrigTanSubstTwo() {
  const par = pick(T136), { b, k, m } = par
  const { set, solve, w } = build136(par)
  const S = m + b
  return item({
    text: `${HEAD_A}\n\n(tg x + ${b})${SUP[2]} ${MINUS} (a${SUP[2]} + ${k}a + ${S})(tg x + ${b}) + a${SUP[2]}(${k}a + ${S}) = 0\n\nимеет ровно два решения на отрезке [0; ⟦f:3π:2⟧].`,
    set,
    solution: `Обозначим t = tg x + ${b}. Трёхчлен раскладывается: t${SUP[2]} ${MINUS} (a${SUP[2]} + ${k}a + ${S})t + a${SUP[2]}(${k}a + ${S}) = (t ${MINUS} a${SUP[2]})(t ${MINUS} ${k}a ${MINUS} ${S}) = 0.\n`
      + `Значит tg x = a${SUP[2]} ${MINUS} ${b} или tg x = ${k}a + ${m}.\n`
      + `На отрезке [0; 3π/2] тангенс не определён в точках π/2 и 3π/2. На интервале (π/2; 3π/2) он непрерывно возрастает от ${MINUS}∞ до +∞, поэтому уравнение tg x = v имеет там ровно один корень при любом v; `
      + `на [0; π/2) добавляется ещё один корень, но только если v ≥ 0.\n`
      + `Значит ровно два решения — это либо два разных отрицательных значения v, либо один общий корень с v ≥ 0 (ветви склеиваются при a${SUP[2]} ${MINUS} ${b} = ${k}a + ${m}).\n`
      + `Первое v отрицательно при |a| < ${w}, второе — при a < ${Rstr(R(-m, k))}.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => a * a - b, label: "tg x первой ветви" }, { f: (a) => k * a + m, label: "tg x второй ветви" }, { f: () => 0, dash: true, label: "знак v" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -10, xMax: 10, aMin: -w - 4, aMax: w + 8,
    },
  })
}

// #155. |sin²x + k·cos x + a| = sin²x + m·cos x − a — «единственный корень на (π/2; π]».
// На (π/2; π] косинус строго убывает, поэтому u = cos x пробегает [−1; 0) и каждому u
// отвечает РОВНО ОДИН x. Равенство |A| = B требует B ≥ 0 и A = ±B.
// A = B даёт (k − m)u = −2a; A = −B даёт 2u² − (k + m)u − 2 = 0, и при k + m = 3
// это u = 2 (не подходит) или u = −1/2. Условие B ≥ 0 для первого корня — квадратное
// неравенство по a с рациональными корнями (за счёт того же k + m = 3).
function build155({ k, m }) {
  const g = k - m
  const solve = (a) => {
    const B = (u) => Rsub(Radd(Rsub(R1, Rmul(u, u)), Rmul(R(m), u)), a)
    const good = []
    const add = (u) => {
      if (Rcmp(u, R(-1)) < 0 || Rsign(u) >= 0) return       // u = cos x ∈ [−1; 0)
      if (Rsign(B(u)) < 0) return
      if (!good.some((v) => Rcmp(v, u) === 0)) good.push(u)
    }
    add(Rdiv(Rmul(R(-2), a), R(g)))
    add(R(-1, 2))
    return good.length
  }
  const crit = [R0, R(g, 2), R(g, 4), R(-g), Rsub(R(3, 4), R(m, 2))]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T155 = [[2, 1], [3, 0], [4, -1], [5, -2]].map(([k, m]) => ({ k, m }))
export function t18TrigAbsCosOne() {
  const par = pick(T155), { k, m } = par
  const { set, solve } = build155(par)
  const g = k - m
  return item({
    text: `${HEAD_A}\n\n|sin${SUP[2]}x${term(k, "cos x")} + a| = sin${SUP[2]}x${term(m, "cos x")} ${MINUS} a\n\nимеет единственный корень на промежутке (⟦f:π:2⟧; π].`,
    set,
    solution: `На промежутке (π/2; π] косинус строго убывает, поэтому u = cos x пробегает [${MINUS}1; 0) и каждому такому u отвечает ровно один x.\n`
      + `Заменим sin${SUP[2]}x = 1 ${MINUS} u${SUP[2]} и обозначим A = 1 ${MINUS} u${SUP[2]}${term(k, "u")} + a, B = 1 ${MINUS} u${SUP[2]}${term(m, "u")} ${MINUS} a. Равенство |A| = B требует B ≥ 0 и A = B либо A = ${MINUS}B.\n`
      + `Из A = B получаем ${g === 1 ? "" : g}u = ${MINUS}2a, то есть u = ${MINUS}${Rstr(R(2, g))}a.\n`
      + `Из A = ${MINUS}B получаем 2u${SUP[2]} ${MINUS} ${k + m}u ${MINUS} 2 = 0, то есть u = 2 (не подходит) или u = ${MINUS}0,5.\n`
      + `Осталось потребовать B ≥ 0 для каждого из кандидатов и не забыть, что при a = ${Rstr(R(g, 4))} они совпадают.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => (-2 * a) / g, label: "u = −2a/(k−m)" }, { f: () => -0.5, dash: true, label: "u = −0,5" }, { f: () => -1, dash: true, label: "|u| ≤ 1" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2, xMax: 1, aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// #158. p·ⁿ√(cx − d) + q·log_b(kx + t) + ra = 0 при НЕЧЁТНОМ n — «любой корень
// принадлежит [L; R]». Нечётный корень определён при всех x, поэтому область определения
// задаёт только логарифм: на её левом краю логарифм уходит в −∞, а на +∞ сумма растёт.
// Значит строго возрастающая сумма пробегает ВСЮ прямую, корень существует и единственен,
// и условие равносильно g(L) ≤ −ra ≤ g(R). Числа подобраны так, что в концах подкоренное
// равно 1 и 2ⁿ, а аргумент логарифма — b и b²: тогда g(L) = p + q, g(R) = 2p + 2q.
function build158({ p, q, r, L, n, b }) {
  const c = 2 ** n - 1, k = b * b - b
  const solve = (a) => {
    const v = Rmul(R(-r), a)
    return Rcmp(v, R(p + q)) >= 0 && Rcmp(v, R(2 * p + 2 * q)) <= 0 ? 1 : 0
  }
  const crit = [R(-(p + q), r), R(-(2 * p + 2 * q), r)]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve, c, k, d: c * L - 1, t: b - k * L }
}
const T158 = []
for (const n of [3, 5]) for (const b of [2, 3, 5]) for (const L of [1, 2, 3]) for (const p of [2, 3, 4]) for (const q of [3, 4, 5]) for (const r of [1, 2, 5]) {
  const res = build158({ p, q, r, L, n, b })
  if (setBounds(res.set).some((x) => x.d > 12n)) continue
  T158.push({ p, q, r, L, n, b })
}
export function t18MonoRootInSeg() {
  const par = pick(T158), { p, q, r, L, n, b } = par
  const { set, solve, c, k, d, t } = build158(par)
  const lhs = `${p === 1 ? "" : p}⟦rn:${n}:${c}x ${MINUS} ${d}⟧ + ${q === 1 ? "" : q}log${SUB[b]}(${k}x${term(t, "")}) + ${r === 1 ? "" : r}a`
  return item({
    text: `Найдите все значения a, при каждом из которых любой корень уравнения\n\n${lhs} = 0\n\nпринадлежит отрезку [${L}; ${L + 1}].`,
    set,
    solution: `Корень ${n}-й степени — нечётный, он определён при всех x, поэтому область определения задаёт только логарифм: x > ${Rstr(R(k * L - b, k))}.\n`
      + `Обе функции строго возрастают, значит и сумма g(x) строго возрастает; у левого края области определения логарифм уходит в ${MINUS}∞, а при x → +∞ сумма неограниченно растёт. `
      + `Поэтому g пробегает ВСЮ прямую: корень существует и он единственный, и условие «любой корень лежит на [${L}; ${L + 1}]» равносильно g(${L}) ≤ ${MINUS}${r === 1 ? "" : r}a ≤ g(${L + 1}).\n`
      + `Числа подобраны так, что в концах всё считается точно: при x = ${L} подкоренное равно 1, а аргумент логарифма — ${b}, поэтому g(${L}) = ${p} + ${q} = ${p + q}; `
      + `при x = ${L + 1} подкоренное равно ${2 ** n}, аргумент логарифма — ${b * b}, поэтому g(${L + 1}) = ${2 * p} + ${2 * q} = ${2 * p + 2 * q}.\n`
      + `Остаётся ${p + q} ≤ ${MINUS}${r === 1 ? "" : r}a ≤ ${2 * p + 2 * q}.\nОтвет: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: () => L, dash: true, label: "концы отрезка" }, { f: () => L + 1, dash: true }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: 0, xMax: L + 4, aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// #159 и #160. sin√(ax − kx²) + cos 2√(ax − kx²) = 0 и cos√(ax − kx²) + cos 2√(ax − kx²) = 0
// — «ровно два решения». Обозначим u = √(ax − kx²) ≥ 0.
// Для синуса: cos 2u = 1 − 2sin²u ⟹ 2sin²u − sin u − 1 = 0 ⟹ sin u = 1 или sin u = −1/2.
// Для косинуса: cos 2u = 2cos²u − 1 ⟹ 2cos²u + cos u − 1 = 0 ⟹ cos u = 1/2 или cos u = −1.
// В обоих случаях допустимые u — арифметические прогрессии с шагом 2π (u = 0 не подходит).
// Далее u² = ax − kx², то есть kx² − ax + u² = 0 с дискриминантом a² − 4ku²: два корня при
// |a| > 2√k·u, один при равенстве, ни одного при |a| < 2√k·u. Ответ выражается в π.
function buildTrigSqrt({ kind, k }) {
  const w = Math.round(Math.sqrt(k))
  if (w * w !== k) return null
  const base = kind === "sin" ? [R(1, 2), R(7, 6), R(11, 6)] : [R(1, 3), R1, R(5, 3)]
  const thresholds = (lim) => {                            // 2√k·u в единицах π, по возрастанию
    const out = []
    for (let n = 0; n <= lim + 2; n++) for (const b of base) {
      const th = Rmul(R(2 * w), Radd(b, R(2 * n)))
      if (Rcmp(th, R(lim)) <= 0) out.push(th)
    }
    return uniqSorted(out)
  }
  const solve = (u) => {
    const au = Rsign(u) < 0 ? Rneg(u) : u
    const lim = Math.ceil(Rnum(au)) + 1
    return thresholds(lim).reduce((n, th) => {
      const c = Rcmp(au, th)
      return n + (c > 0 ? 2 : c === 0 ? 1 : 0)
    }, 0)
  }
  const th = thresholds(40)
  const crit = [R0, ...th, ...th.map(Rneg)]
  return { set: assembleSet((u) => solve(u) === 2, crit), solve, th }
}
const T159 = []
for (const kind of ["sin", "cos"]) for (const k of [1, 4, 9]) T159.push({ kind, k })
function item159(kind) {
  const par = pick(T159.filter((t) => t.kind === kind)), { k } = par
  const { set, solve, th } = buildTrigSqrt(par)
  const rad = `⟦r:ax ${MINUS} ${k === 1 ? "" : k}x${SUP[2]}⟧`
  const first = kind === "sin" ? `sin ${rad}` : `cos ${rad}`
  const w = Math.round(Math.sqrt(k))
  return item({
    text: `${HEAD_A}\n\n${first} + cos 2${rad} = 0\n\nимеет ровно два различных решения.`,
    set,
    unit: "pi",
    solution: `Обозначим u = ${rad} ≥ 0.\n`
      + (kind === "sin"
        ? `Так как cos 2u = 1 ${MINUS} 2sin${SUP[2]}u, уравнение принимает вид 2sin${SUP[2]}u ${MINUS} sin u ${MINUS} 1 = 0, то есть (2sin u + 1)(sin u ${MINUS} 1) = 0 и sin u = 1 или sin u = ${MINUS}0,5.\n`
          + `При u ≥ 0 это u = π/2 + 2πn, u = 7π/6 + 2πn, u = 11π/6 + 2πn (значение u = 0 не подходит).\n`
        : `Так как cos 2u = 2cos${SUP[2]}u ${MINUS} 1, уравнение принимает вид 2cos${SUP[2]}u + cos u ${MINUS} 1 = 0, то есть (2cos u ${MINUS} 1)(cos u + 1) = 0 и cos u = 0,5 или cos u = ${MINUS}1.\n`
          + `При u ≥ 0 это u = π/3 + 2πn, u = 5π/3 + 2πn, u = π + 2πn (значение u = 0 не подходит).\n`)
      + `Далее u${SUP[2]} = ax ${MINUS} ${k === 1 ? "" : k}x${SUP[2]}, то есть ${k === 1 ? "" : k}x${SUP[2]} ${MINUS} ax + u${SUP[2]} = 0 с дискриминантом a${SUP[2]} ${MINUS} ${4 * k}u${SUP[2]}.\n`
      + `Каждое допустимое u даёт два корня x при |a| > ${2 * w === 1 ? "" : 2 * w}u, один при равенстве и ни одного при |a| < ${2 * w === 1 ? "" : 2 * w}u (разным u отвечают разные x).\n`
      + `Ровно два решения — когда «работает» только наименьшее допустимое u: ${valStr(th[0], "pi")} < |a| < ${valStr(th[1], "pi")}.\n`
      + `Ответ: ${setToString(set, "pi")}.`,
    predicate: { type: "count", n: 2 },
    solve: (u) => solve(u),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (u) => Math.abs(u) / (2 * k), label: "x = a/(2k)" }, { f: () => 0, dash: true, label: "ОДЗ: 0 ≤ x ≤ a/k" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: 6, aMin: Rnum(setBounds(set)[0]) - 2, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 2,
    },
  })
}
export function t18TrigSqrtSin() { return item159("sin") }
export function t18TrigSqrtCos() { return item159("cos") }


// =============================================================================
// РАЗДЕЛ O. Показательные и модульные уравнения (эталон #119–#129)
// =============================================================================
const supT = (x) => `⟦sup:${x}⟧`                           // надстрочник: b^|x|, 2ˣ и т. п.

// #119. (pa/(a − q))·b^|x| = (b²)^|x| + (ra + s)/(a − q) — «ровно два различных корня».
// Замена t = b^|x| ≥ 1: каждое t > 1 даёт ДВА корня x = ±log_b t, а t = 1 — ровно один (x = 0).
// После умножения на (a − q) остаётся (a − q)t² − pa·t + (ra + s) = 0; значение a = q
// запрещено ОДЗ. Наборы подобраны так, что дискриминант по a имеет рациональные корни.
function build119({ p, q, r, s }) {
  const solve = (a) => {
    if (Rcmp(a, R(q)) === 0) return 0                      // выражение не определено
    const P = [Radd(Rmul(R(r), a), R(s)), Rmul(R(-p), a), Rsub(a, R(q))]
    return 2 * countRoots(P, R1, "+inf", false, false) + (Rzero(pEval(P, R1)) ? 1 : 0)
  }
  const crit = [R(q)]
  if (1 - p + r !== 0) crit.push(R(q - s, 1 - p + r))       // корень t = 1
  const { roots, allRational } = ratRoots([R(4 * q * s), R(4 * q * r - 4 * s), R(p * p - 4 * r)])
  if (!allRational) return null
  crit.push(...roots)
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
// Наборы (p, q, r, s) отобраны разовым перебором ЭТИМ ЖЕ движком: дискриминант по a
// обязан иметь рациональные корни, ответ — непустое объединение промежутков с круглыми
// границами. Из 94 подходящих взяты 20 с попарно различными ответами.
const T119 = [
  [3, 2, 2, 3], [3, 3, 2, 5], [3, 3, 4, 3], [3, 4, 2, 5], [4, 2, 2, 3], [4, 2, 2, 5], [4, 2, 2, 7],
  [4, 2, 2, 9], [4, 2, 4, 3], [4, 2, 4, 5], [4, 2, 4, 7], [4, 2, 4, 9], [4, 3, 2, 3], [4, 3, 2, 7],
  [4, 3, 2, 9], [4, 3, 4, 3], [4, 3, 4, 5], [4, 3, 4, 7], [4, 3, 4, 9], [4, 3, 6, 5],
].map(([p, q, r, s]) => ({ p, q, r, s }))
export function t18ExpFracTwoRoots() {
  const par = pick(T119), { p, q, r, s } = par
  const b = pick([2, 3, 5, 7])
  const { set, solve } = build119(par)
  const bx = `${b}${supT("|x|")}`
  return item({
    text: `${HEAD_A}\n\n${fT(`${p}a`, `a ${MINUS} ${q}`)}·${bx} = ${b * b}${supT("|x|")} + ${fT(`${r}a + ${s}`, `a ${MINUS} ${q}`)}\n\nимеет ровно два различных корня.`,
    set,
    solution: `Значение a = ${q} невозможно (знаменатели обращаются в нуль). Обозначим t = ${bx} ≥ 1: каждому t > 1 отвечают ДВА корня x = ±log${SUB[b] || ""}t, а t = 1 даёт ровно один корень x = 0.\n`
      + `Так как ${b * b}${supT("|x|")} = t${SUP[2]}, после умножения на (a ${MINUS} ${q}) уравнение принимает вид (a ${MINUS} ${q})t${SUP[2]} ${MINUS} ${p}a·t + ${r}a + ${s} = 0.\n`
      + `Значение t = 1 является корнем при ${1 - p + r === 0 ? "никаком a" : `a = ${Rstr(R(q - s, 1 - p + r))}`}, а дискриминант равен ${p * p - 4 * r === 0 ? "" : `${p * p - 4 * r}a${SUP[2]}`}${term(4 * q * r - 4 * s, "a")}${term(4 * q * s, "")}.\n`
      + `Ровно два корня — это ровно одно значение t > 1 и при этом t = 1 корнем не является.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: () => 1, dash: true, label: "t = 1" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: 8, aMin: Rnum(setBounds(set)[0]) - 4, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 4,
    },
  })
}

// #120. |kx + a²/x + c| + |kx + a²/x − d| = c + d — «хотя бы один корень».
// Сумма |u + c| + |u − d| равна c + d ровно на отрезке u ∈ [−c; d] (вне него она больше).
// При a ≠ 0 выражение u = kx + a²/x при x > 0 не меньше 2|a|√k, а при x < 0 не больше
// −2|a|√k (неравенство о среднем), поэтому решение есть ⟺ 2|a|√k ≤ max(c; d).
// Коэффициент k берём полным квадратом, чтобы граница была рациональной.
function build120({ k, c, d }) {
  const w = Math.round(Math.sqrt(k))
  if (w * w !== k) return null
  const M = Math.max(c, d)
  const solve = (a) => {
    const aa = Rsign(a) < 0 ? Rneg(a) : a
    return Rcmp(Rmul(R(2 * w), aa), R(M)) <= 0 ? 1 : 0
  }
  return { set: assembleSet((a) => solve(a) === 1, [R(M, 2 * w), R(-M, 2 * w)]), solve, w, M }
}
const T120 = []
for (const k of [1, 4, 9]) for (const c of [1, 2, 3, 4, 6]) for (const d of [1, 2, 3, 4, 6]) T120.push({ k, c, d })
export function t18AbsSumRecipExists() {
  const par = pick(T120), { k, c, d } = par
  const { set, solve, w, M } = build120(par)
  const U = `${k === 1 ? "" : k}x + ${fT(`a${SUP[2]}`, "x")}`
  return item({
    text: `${HEAD_A}\n\n|${U} + ${c}| + |${U} ${MINUS} ${d}| = ${c + d}\n\nимеет хотя бы один корень.`,
    set,
    solution: `Обозначим u = ${k === 1 ? "" : k}x + a${SUP[2]}/x. Сумма |u + ${c}| + |u ${MINUS} ${d}| равна расстоянию между точками ${MINUS}${c} и ${d}, то есть ${c + d}, ровно тогда, когда u лежит НА отрезке [${MINUS}${c}; ${d}] (вне него сумма больше).\n`
      + `При a ≠ 0 и x > 0 по неравенству о среднем ${k === 1 ? "" : k}x + a${SUP[2]}/x ≥ 2|a|${w === 1 ? "" : `·${w}`} (равенство при x = |a|/${w}), а при x < 0 симметрично u ≤ ${MINUS}2|a|${w === 1 ? "" : `·${w}`}.\n`
      + `Значит подходящее u существует ⟺ 2|a|${w === 1 ? "" : `·${w}`} ≤ ${M} (наибольший из концов отрезка).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => 2 * w * Math.abs(a), label: "наименьшее |u|" }, { f: () => M, dash: true, label: `граница ${M}` }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: M + 4, aMin: -M, aMax: M,
    },
  })
}

// #123. (|x + p| + |x − a|)² − 2q(|x + p| + |x − a|) + q² − (ka − m)² = 0 — «ровно два решения».
// По u = |x + p| + |x − a| это (u − q)² = (ka − m)², то есть u = q + |ka − m| или u = q − |ka − m|.
// Функция u(x) равна |a + p| на отрезке между −p и a и растёт вне него, поэтому уравнение
// u = v имеет: ни одного решения при v < |a + p|; бесконечно много при v = |a + p| ≠ 0;
// одно при v = |a + p| = 0; два при v > |a + p|.
function build123({ p, q, k, m }) {
  const solve = (a) => {
    const s = Radd(a, R(p)), mn = Rsign(s) < 0 ? Rneg(s) : s
    const t = Rsub(Rmul(R(k), a), R(m)), ad = Rsign(t) < 0 ? Rneg(t) : t
    let n = 0
    for (const v of uniqSorted([Radd(R(q), ad), Rsub(R(q), ad)])) {
      const c = Rcmp(v, mn)
      if (c > 0) n += 2
      else if (c === 0) n += Rzero(mn) ? 1 : 99
    }
    return n
  }
  const crit = [R(-p), R(m, k)]
  for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
    const A = s1 * k - s2, B = s2 * p + s1 * m - q         // A·a = B
    if (A !== 0) crit.push(R(B, A))
  }
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
const T123 = []
for (const p of [1, 2, 3]) for (const q of [1, 2, 3]) for (const k of [2, 3]) for (const m of [1, 2, 3]) T123.push({ p, q, k, m })
export function t18AbsSumSubstTwo() {
  const par = pick(T123), { p, q, k, m } = par
  const { set, solve } = build123(par)
  const U = `|x + ${p}| + |x ${MINUS} a|`
  return item({
    text: `${HEAD_A}\n\n(${U})${SUP[2]} ${MINUS} ${2 * q === 1 ? "" : 2 * q}(${U})${term(-k * k, `a${SUP[2]}`)}${term(2 * k * m, "a")}${term(q * q - m * m, "")} = 0\n\nимеет ровно два различных решения.`,
    set,
    solution: `Обозначим u = ${U} ≥ 0. Уравнение принимает вид u${SUP[2]} ${MINUS} ${2 * q === 1 ? "" : 2 * q}u + ${q * q} ${MINUS} (${k}a ${MINUS} ${m})${SUP[2]} = 0, то есть (u ${MINUS} ${q})${SUP[2]} = (${k}a ${MINUS} ${m})${SUP[2]}.\n`
      + `Значит u = ${q} + |${k}a ${MINUS} ${m}| или u = ${q} ${MINUS} |${k}a ${MINUS} ${m}|.\n`
      + `Сумма расстояний от x до точек ${MINUS}${p} и a равна |a + ${p}| на всём отрезке между ними и растёт вне него. Поэтому уравнение u = v `
      + `не имеет решений при v < |a + ${p}|, имеет бесконечно много при v = |a + ${p}| ≠ 0 (весь отрезок) и ровно два при v > |a + ${p}|.\n`
      + `Ровно два решения — когда одно из значений v даёт два корня, а другое не даёт ни одного.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => q + Math.abs(k * a - m), label: "u = q + |ka − m|" },
        { f: (a) => q - Math.abs(k * a - m), label: "u = q − |ka − m|" },
        { f: (a) => Math.abs(a + p), dash: true, label: "наименьшее значение u" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: q + 6, aMin: Rnum(setBounds(set)[0]) - 3, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #125. 4ˣ + (a − c)2ˣ = (m + k|a|)2ˣ + (a − c)(k|a| + m) — «единственное решение».
// По t = 2ˣ > 0 левая часть минус правая раскладывается: (t − (k|a| + m))(t + a − c) = 0.
// Первый корень t = k|a| + m положителен всегда и даёт один x; второй t = c − a годится
// только при a < c. Единственное решение — когда второй корень не годится либо совпал с первым.
function build125({ c, k, m }) {
  const solve = (a) => {
    const aa = Rsign(a) < 0 ? Rneg(a) : a
    const t1 = Radd(Rmul(R(k), aa), R(m)), t2 = Rsub(R(c), a)
    const good = [t1]
    if (Rsign(t2) > 0 && Rcmp(t2, t1) !== 0) good.push(t2)
    return good.length
  }
  const crit = [R0, R(c), R(c - m, k + 1), R(c - m, 1 - k)]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T125 = []
for (const c of [4, 5, 6, 8]) for (const k of [2, 3, 4]) for (const m of [1, 2, 3]) T125.push({ c, k, m })
export function t18ExpFactorOne() {
  const par = pick(T125), { c, k, m } = par
  const { set, solve } = build125(par)
  const two = `2${supT("x")}`
  return item({
    text: `${HEAD_A}\n\n4${supT("x")} + (a ${MINUS} ${c})${two} = (${m} + ${k}|a|)${two} + (a ${MINUS} ${c})(${k}|a| + ${m})\n\nимеет единственное решение.`,
    set,
    solution: `Обозначим t = ${two} > 0; тогда 4${supT("x")} = t${SUP[2]}. Перенесём всё влево и разложим:\n`
      + `t${SUP[2]} + (a ${MINUS} ${c})t ${MINUS} (${m} + ${k}|a|)t ${MINUS} (a ${MINUS} ${c})(${k}|a| + ${m}) = (t ${MINUS} ${k}|a| ${MINUS} ${m})(t + a ${MINUS} ${c}) = 0.\n`
      + `Первый множитель даёт t = ${k}|a| + ${m} > 0 — это всегда ровно один корень x. Второй даёт t = ${c} ${MINUS} a, что годится лишь при a < ${c}.\n`
      + `Единственное решение — когда второй корень не подходит (a ≥ ${c}) либо совпал с первым: ${k}|a| + ${m} = ${c} ${MINUS} a.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => k * Math.abs(a) + m, label: "t = k|a| + m" }, { f: (a) => c - a, label: "t = c − a" }, { f: () => 0, dash: true, label: "t > 0" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: c + 6, aMin: -c - 2, aMax: c + 6,
    },
  })
}

// #126. |x − A| + |x − B| = A − B, где A = a² + αa + β, B = a² + γa + δ (α > γ) —
// «корни есть, но ни один не принадлежит (L; Rr)».
// Сумма расстояний до двух точек равна расстоянию между ними РОВНО на отрезке между ними,
// поэтому решения есть ⟺ A ≥ B, и тогда множество решений — весь отрезок [B; A].
// Условие «ни один корень не попал в (L; Rr)» ⟺ A ≤ L или B ≥ Rr.
function build126({ al, be, ga, de, L, Rr }) {
  const A = (a) => Radd(Radd(Rmul(a, a), Rmul(R(al), a)), R(be))
  const B = (a) => Radd(Radd(Rmul(a, a), Rmul(R(ga), a)), R(de))
  const solve = (a) => {
    if (Rcmp(A(a), B(a)) < 0) return 0                     // правая часть отрицательна — решений нет
    return Rcmp(A(a), R(L)) <= 0 || Rcmp(B(a), R(Rr)) >= 0 ? 1 : 0
  }
  const crit = [R(de - be, al - ga)]
  for (const P of [[R(be - L), R(al), R1], [R(de - Rr), R(ga), R1]]) {
    const { roots, allRational } = ratRoots(P)
    if (!allRational) return null
    crit.push(...roots)
  }
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
// Наборы (α, β, γ, δ, L, Rr) отобраны перебором: оба уравнения A = L и B = Rr обязаны иметь
// рациональные корни, ответ — не меньше двух промежутков с круглыми границами. Взяты 14 наборов
// с попарно различными ответами; среди них (−1, −2, −3, 1, 4, 19) — коэффициенты эталона.
const T126 = [
  [1, -2, -1, -1, 4, 19], [1, 2, -1, -1, 4, 19], [2, 1, -1, -1, 4, 19], [2, 1, 1, -1, 4, 19],
  [2, -2, -1, -1, 6, 19], [2, -2, 1, -1, 6, 19], [-2, 1, -3, 1, 4, 19], [-1, -2, -3, 1, 4, 19],
  [-1, 2, -3, 1, 4, 19], [4, -1, -1, -1, 4, 19], [2, 1, -3, 1, 4, 19], [4, -1, 1, -1, 4, 19],
  [1, -2, -3, 1, 4, 19], [1, 4, -1, -1, 6, 19],
].map(([al, be, ga, de, L, Rr]) => ({ al, be, ga, de, L, Rr }))
export function t18AbsSumOutside() {
  const par = pick(T126), { al, be, ga, de, L, Rr } = par
  const { set, solve } = build126(par)
  const Atxt = `x ${MINUS} a${SUP[2]}${term(-al, "a")}${term(-be, "")}`
  const Btxt = `x ${MINUS} a${SUP[2]}${term(-ga, "a")}${term(-de, "")}`
  const Ctxt = `${al - ga === 1 ? "" : al - ga}a${term(be - de, "")}`
  return item({
    text: `${HEAD_A}\n\n|${Atxt}| + |${Btxt}| = ${Ctxt}\n\nимеет корни, но ни один из них не принадлежит интервалу (${L}; ${Rr}).`,
    set,
    solution: `Обозначим A = a${SUP[2]}${term(al, "a")}${term(be, "")} и B = a${SUP[2]}${term(ga, "a")}${term(de, "")}; тогда уравнение — это |x ${MINUS} A| + |x ${MINUS} B| = A ${MINUS} B.\n`
      + `Сумма расстояний от x до A и до B не меньше |A ${MINUS} B| и равна ей РОВНО на отрезке между A и B. Значит корни есть ⟺ A ${MINUS} B ≥ 0, и тогда множество корней — весь отрезок [B; A].\n`
      + `Остаётся потребовать, чтобы этот отрезок не пересекал интервал (${L}; ${Rr}): A ≤ ${L} или B ≥ ${Rr}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => a * a + al * a + be, label: "правый конец A" },
        { f: (a) => a * a + ga * a + de, label: "левый конец B" },
        { f: () => L, dash: true, label: "запретный интервал" }, { f: () => Rr, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -4, xMax: Rr + 6, aMin: Rnum(setBounds(set)[0]) - 3, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// #127. |x − a − p| + |x + a + q| = 2a + p + q — «любое x из [L; Rr] является решением».
// Точки A = a + p и B = −a − q, а правая часть равна |A − B| при 2a + p + q ≥ 0,
// поэтому множество решений — весь отрезок [B; A]. Условие: [L; Rr] ⊆ [B; A].
function build127({ p, q, L, Rr }) {
  const solve = (a) => {
    if (Rsign(Radd(Rmul(R(2), a), R(p + q))) < 0) return 0
    const A = Radd(a, R(p)), B = Rneg(Radd(a, R(q)))
    return Rcmp(B, R(L)) <= 0 && Rcmp(A, R(Rr)) >= 0 ? 1 : 0
  }
  const crit = [R(-(p + q), 2), R(-q - L), R(Rr - p)]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T127 = []
for (const p of [1, 2, 3]) for (const q of [2, 3, 4]) for (const [L, Rr] of [[2, 3], [1, 4], [3, 5], [2, 6]]) T127.push({ p, q, L, Rr })
export function t18AbsSumWholeSeg() {
  const par = pick(T127), { p, q, L, Rr } = par
  const { set, solve } = build127(par)
  return item({
    text: `Найдите все значения a, при каждом из которых любое число из отрезка [${L}; ${Rr}] является решением уравнения\n\n`
      + `|x ${MINUS} a ${MINUS} ${p}| + |x + a + ${q}| = 2a + ${p + q}.`,
    set,
    solution: `Обозначим A = a + ${p} и B = ${MINUS}a ${MINUS} ${q}. Тогда |A ${MINUS} B| = |2a + ${p + q}|, и при 2a + ${p + q} ≥ 0 правая часть уравнения равна ровно |A ${MINUS} B|.\n`
      + `Сумма расстояний от x до A и до B равна |A ${MINUS} B| РОВНО на отрезке между A и B, поэтому множество решений — отрезок [${MINUS}a ${MINUS} ${q}; a + ${p}] (при 2a + ${p + q} < 0 решений нет вовсе).\n`
      + `Чтобы каждое число из [${L}; ${Rr}] было решением, нужно ${MINUS}a ${MINUS} ${q} ≤ ${L} и a + ${p} ≥ ${Rr}, то есть a ≥ ${nS(-q - L)} и a ≥ ${nS(Rr - p)}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [{ f: (a) => a + p, label: "правый конец" }, { f: (a) => -a - q, label: "левый конец" },
        { f: () => L, dash: true, label: "нужный отрезок" }, { f: () => Rr, dash: true }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -Rr - 4, xMax: Rr + 6, aMin: Rnum(setBounds(set)[0]) - 6, aMax: Rnum(setBounds(set)[0]) + 10,
    },
  })
}

// #128. (|x − h| − |x − a|)² − ka(|x − h| − |x − a|) + Q(a) = 0, где Q подобрано так, что
// дискриминант равен (pa − q)²: тогда v = ((k + p)a − q)/2 или v = ((k − p)a + q)/2.
// Функция v(x) = |x − h| − |x − a| постоянна вне отрезка между h и a (значения ±(h − a))
// и линейна внутри, поэтому уравнение v = w имеет ровно ОДНО решение при |w| < |h − a|
// и бесконечно много при |w| = |h − a| ≠ 0.
function build128({ h, k, p, q }) {
  const solve = (a) => {
    const d = Rsub(R(h), a), ad = Rsign(d) < 0 ? Rneg(d) : d
    const v1 = Rdiv(Rsub(Rmul(R(k + p), a), R(q)), R(2))
    const v2 = Rdiv(Radd(Rmul(R(k - p), a), R(q)), R(2))
    let n = 0
    for (const v of uniqSorted([v1, v2])) {
      const av = Rsign(v) < 0 ? Rneg(v) : v
      const c = Rcmp(av, ad)
      if (c < 0) n += 1
      else if (c === 0) n += Rzero(ad) ? 0 : 99
    }
    return n
  }
  const crit = [R(h), R(q, p)]
  for (const [A, B] of [[k + p, -q], [k - p, q]]) for (const sg of [1, -1]) {
    // (A·a + B)/2 = sg·(h − a) ⟹ a(A + 2sg) = 2sg·h − B
    if (A + 2 * sg !== 0) crit.push(R(2 * sg * h - B, A + 2 * sg))
  }
  return { set: assembleSet((a) => solve(a) === 2, crit), solve }
}
const T128 = []
for (const [k, p, q] of [[9, 7, 8], [7, 5, 4], [11, 9, 6], [5, 3, 4], [8, 4, 2], [6, 4, 2]]) {
  for (const h of [5, 7, 9, 11]) T128.push({ h, k, p, q })
}
export function t18AbsDiffSubstTwo() {
  const par = pick(T128), { h, k, p, q } = par
  const { set, solve } = build128(par)
  const V = `|x ${MINUS} ${h}| ${MINUS} |x ${MINUS} a|`
  const q2 = (k * k - p * p) / 4, q1 = (2 * p * q) / 4, q0 = -(q * q) / 4
  return item({
    text: `${HEAD_A}\n\n(${V})${SUP[2]} ${MINUS} ${k}a(${V})${term(q2, `a${SUP[2]}`)}${term(q1, "a")}${term(q0, "")} = 0\n\nимеет ровно два различных решения.`,
    set,
    solution: `Обозначим v = ${V}. Уравнение квадратное по v, и его дискриминант равен ${k * k}a${SUP[2]} ${MINUS} 4(${q2}a${SUP[2]}${term(q1, "a")}${term(q0, "")}) = (${p}a ${MINUS} ${q})${SUP[2]} — полный квадрат.\n`
      + `Поэтому v = ${fT(`${k + p}a ${MINUS} ${q}`, "2")} или v = ${fT(`${k - p === 1 ? "" : k - p}a + ${q}`, "2")}.\n`
      + `Функция v(x) постоянна вне отрезка между ${h} и a (там она равна ${h} ${MINUS} a или a ${MINUS} ${h}) и линейна внутри него. Значит уравнение v = w имеет ровно один корень при |w| < |${h} ${MINUS} a| `
      + `и бесконечно много корней при |w| = |${h} ${MINUS} a| ≠ 0.\n`
      + `Ровно два решения — когда ОБА значения v различны и по модулю строго меньше |${h} ${MINUS} a|.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => ((k + p) * a - q) / 2, label: "первое значение v" },
        { f: (a) => ((k - p) * a + q) / 2, label: "второе значение v" },
        { f: (a) => Math.abs(h - a), dash: true, label: "|h − a|" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -h - 2, xMax: h + 2, aMin: Rnum(setBounds(set)[0]) - 3, aMax: Rnum(setBounds(set)[setBounds(set).length - 1]) + 3,
    },
  })
}

// =============================================================================
// РАЗДЕЛ Q. Иррациональные уравнения (эталон #138–#144, #147, #148)
// =============================================================================
// Общий приём раздела: обе части возводятся в квадрат, а лишние корни отсекает ЗНАКОВОЕ
// условие «правая часть ≥ 0» — именно оно, а не ОДЗ подкоренного выражения, делает ответ
// нетривиальным (там, где равенство выполнено, подкоренное автоматически равно квадрату
// правой части, то есть неотрицательно). Всюду, где счёт корней опирается на моё
// алгебраическое преобразование, включена независимая числовая сверка raw
// с НАПЕЧАТАННЫМ выражением: каждый заявленный корень обязан обнулять исходную запись,
// и ни одна смена знака на отрезке не может остаться без корня.
const Rabs = (a) => (Rsign(a) < 0 ? Rneg(a) : a)
const supIn = (x) => `⁅${x}⁆`                      // надстрочник ВНУТРИ √{…} и дробей
const HEAD_POS = "Найдите все положительные значения a, при каждом из которых уравнение"

// «Круглый» ли ответ (для отбора наборов параметров перебором).
function tidySet(set, maxIv = 4, maxDen = 12n, maxNum = 400n) {
  const b = setBounds(set)
  if (!b.length || b.length > 6) return false
  if (set.intervals.length + set.points.length > maxIv) return false
  return b.every((x) => x.d <= maxDen && Rabs(x).n <= maxNum)
}
// Корни Ax² + Bx + C как обычные числа (кратный корень — один раз). Только для сверки raw.
function numQuad(A, B, C) {
  const d = B * B - 4 * A * C
  if (d < 0) return []
  const s = Math.sqrt(d)
  const r1 = (-B - s) / (2 * A), r2 = (-B + s) / (2 * A)
  return Math.abs(r1 - r2) < 1e-9 ? [(r1 + r2) / 2] : [Math.min(r1, r2), Math.max(r1, r2)]
}

// #138. √(x⁴ − k²x² + a²) = x² + kx + sa (s = ±1) — «ровно три различных корня».
// При возведении в квадрат x⁴ и a² сокращаются и остаётся 2x(kx + sa)(x + k) = 0,
// то есть ровно три кандидата: x = 0, x = −sa/k, x = −k. Корнем является тот из них,
// у которого правая часть неотрицательна.
function build138({ k, s }) {
  const rhs = (a, x) => Radd(Radd(Rmul(x, x), Rmul(R(k), x)), Rmul(R(s), a))
  const solve = (a) => {
    const good = []
    for (const x of [R0, Rdiv(Rmul(R(-s), a), R(k)), R(-k)]) {
      if (Rsign(rhs(a, x)) >= 0 && !good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    }
    return good.length
  }
  // конфигурация меняется только там, где −sa/k совпадает с 0 или с −k и где меняется знак
  // правой части в точках x = 0 и x = −k (обе дают одно и то же условие sa ≤ 0)
  return { set: assembleSet((a) => solve(a) === 3, [R0, R(s * k * k)]), solve }
}
const T138 = []
for (const k of [1, 2, 3, 4]) for (const s of [1, -1]) T138.push({ k, s })
export function t18SqrtQuarticThree() {
  const par = pick(T138), { k, s } = par
  const { set, solve } = build138(par)
  const aRange = spanRange(set)
  const kx = k === 1 ? "x" : `${k}x`
  const rad = `x⁴ ${MINUS} ${k === 1 ? "" : k * k}x${SUP[2]} + a${SUP[2]}`
  const rt = `x${SUP[2]} + ${kx} ${s > 0 ? "+" : MINUS} a`
  return item({
    text: `${HEAD_A}\n\n√{${rad}} = ${rt}\n\nимеет ровно три различных корня.`,
    set,
    solution: `Обе части неотрицательны только при ${rt} ≥ 0 — это обязательное условие; при нём возведение в квадрат равносильно.\n`
      + `После возведения x⁴ и a${SUP[2]} сокращаются: 0 = 2x(${kx === "x" ? "" : k}x${SUP[2]} + (${k * k} ${s > 0 ? "+" : MINUS} a)x ${s > 0 ? "+" : MINUS} ${k}a) = 2x(${k === 1 ? "" : k}x ${s > 0 ? "+" : MINUS} a)(x + ${k}).\n`
      + `Значит кандидаты — x = 0, x = ${s > 0 ? MINUS : ""}${fT("a", String(k))} и x = ${MINUS}${k}.\n`
      + `Проверка знака правой части: при x = 0 и при x = ${MINUS}${k} она равна ${s > 0 ? "" : MINUS}a, при x = ${s > 0 ? MINUS : ""}a/${k} — равна a${SUP[2]}/${k * k} ≥ 0 (годится всегда).\n`
      + `Три РАЗЛИЧНЫХ корня получаются, когда ${s > 0 ? "a > 0" : "a < 0"} и при этом ${s > 0 ? MINUS : ""}a/${k} не совпадает ни с 0, ни с ${MINUS}${k}, то есть a ≠ 0 и a ≠ ${nS(s * k * k)}.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [-k - 12, k + 12],
      F: (a) => (x) => {
        const v = x ** 4 - k * k * x * x + a * a
        return v < 0 ? null : Math.sqrt(v) - (x * x + k * x + s * a)
      },
      sols: (a) => {
        const out = []
        for (const x of [0, (-s * a) / k, -k]) {
          if (x * x + k * x + s * a < -1e-9) continue
          if (!out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
        }
        return out
      },
    },
    predicate: { type: "count", n: 3 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => (-s * a) / k, label: `x = ${s > 0 ? MINUS : ""}a/${k}` },
        { f: () => 0, dash: true, label: "x = 0" },
        { f: () => -k, dash: true, label: `x = ${MINUS}${k}` },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -k - 6, xMax: k + 6, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #139. √((w²+2)x² + 2ax + 1) = x² + ax + 1 — «ровно три различных корня».
// Свободный член и коэффициент при x подобраны так, что после возведения в квадрат
// остаётся x²(x² + 2ax + a² − w²) = 0: корень x = 0 (двойной, считается один раз)
// и x = −a ± w. Знак правой части в этих точках равен w² + 1 ∓ aw.
function build139({ w }) {
  const rhs = (a, x) => Radd(Radd(Rmul(x, x), Rmul(a, x)), R1)
  const solve = (a) => {
    const good = []
    for (const x of [R0, Radd(Rneg(a), R(w)), Rsub(Rneg(a), R(w))]) {
      if (Rsign(rhs(a, x)) >= 0 && !good.some((y) => Rcmp(y, x) === 0)) good.push(x)
    }
    return good.length
  }
  const B = R(w * w + 1, w)
  return { set: assembleSet((a) => solve(a) === 3, [R(w), R(-w), B, Rneg(B)]), solve }
}
const T139 = [1, 2, 3, 4].map((w) => ({ w }))
export function t18SqrtQuadThree() {
  const par = pick(T139), { w } = par
  const p = w * w + 2
  const { set, solve } = build139(par)
  const aRange = spanRange(set)
  return item({
    text: `${HEAD_A}\n\n√{${p}x${SUP[2]} + 2ax + 1} = x${SUP[2]} + ax + 1\n\nимеет ровно три различных корня.`,
    set,
    solution: `Возведение в квадрат равносильно при x${SUP[2]} + ax + 1 ≥ 0. Свободные члены и слагаемые с x сокращаются:\n`
      + `${p}x${SUP[2]} + 2ax + 1 = x⁴ + a${SUP[2]}x${SUP[2]} + 1 + 2ax³ + 2x${SUP[2]} + 2ax ⟹ x⁴ + 2ax³ + (a${SUP[2]} ${MINUS} ${w * w})x${SUP[2]} = 0, то есть x${SUP[2]}(x + a ${MINUS} ${w})(x + a + ${w}) = 0.\n`
      + `Кандидаты: x = 0 (в нём правая часть равна 1 — корень всегда) и x = ${MINUS}a ± ${w}.\n`
      + `Правая часть в точке x = ${MINUS}a + ${w} равна ${w * w + 1} ${MINUS} ${w === 1 ? "" : w}a, а в точке x = ${MINUS}a ${MINUS} ${w} равна ${w * w + 1} + ${w === 1 ? "" : w}a, поэтому оба этих корня годятся ровно при |a| ≤ ${Rstr(R(w * w + 1, w))}.\n`
      + `Осталось потребовать, чтобы ни один из них не совпал с нулём: a ≠ ±${w}.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [-w - 24, w + 24],
      F: (a) => (x) => {
        const v = p * x * x + 2 * a * x + 1
        return v < 0 ? null : Math.sqrt(v) - (x * x + a * x + 1)
      },
      sols: (a) => {
        const out = []
        for (const x of [0, -a + w, -a - w]) {
          if (x * x + a * x + 1 < -1e-9) continue
          if (!out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
        }
        return out
      },
    },
    predicate: { type: "count", n: 3 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => -a + w, label: `x = ${MINUS}a + ${w}` },
        { f: (a) => -a - w, label: `x = ${MINUS}a ${MINUS} ${w}` },
        { f: () => 0, dash: true, label: "x = 0" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -w - 8, xMax: w + 8, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #140. √(x + pa + c) + √(x − a) = m — «хотя бы один корень».
// Замена u = √(x − a) ≥ 0 превращает первое подкоренное в u² + (p+1)a + c, поэтому
// уравнение равносильно √(u² + K) = m − u при K = (p+1)a + c. Возведение в квадрат
// убирает u² целиком: K = m² − 2mu, то есть u определяется ОДНОЗНАЧНО: u = (m² − K)/(2m).
// Корень существует ⟺ этот u лежит на отрезке [0; m].
function build140({ p, c, m }) {
  const K = (a) => Radd(Rmul(R(p + 1), a), R(c))
  const solve = (a) => (Rcmp(K(a), R(-m * m)) >= 0 && Rcmp(K(a), R(m * m)) <= 0 ? 1 : 0)
  const crit = [R(-m * m - c, p + 1), R(m * m - c, p + 1)]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T140 = []
for (const p of [2, 3, 4, 5]) for (const c of [-2, -1, 0, 1, 2]) for (const m of [1, 2, 3]) T140.push({ p, c, m })
export function t18SqrtSumExists() {
  const par = pick(T140), { p, c, m } = par
  const { set, solve } = build140(par)
  const aRange = spanRange(set)
  const rad1 = `x + ${p}a${term(c, "")}`
  return item({
    text: `${HEAD_A}\n\n√{${rad1}} + √{x ${MINUS} a} = ${m}\n\nимеет хотя бы один корень.`,
    set,
    solution: `Обозначим u = √(x ${MINUS} a) ≥ 0. Тогда x + ${p}a${term(c, "")} = u${SUP[2]} + ${p + 1}a${term(c, "")}, и уравнение принимает вид √(u${SUP[2]} + K) = ${m} ${MINUS} u, где K = ${p + 1}a${term(c, "")}.\n`
      + `Отсюда сразу u ≤ ${m}, а после возведения в квадрат u${SUP[2]} сокращается: K = ${m * m} ${MINUS} ${2 * m}u, то есть u = ${fT(`${m * m} ${MINUS} K`, String(2 * m))} — значение ЕДИНСТВЕННОЕ.\n`
      + `Корень x = u${SUP[2]} + a существует ровно тогда, когда 0 ≤ u ≤ ${m}, то есть ${MINUS}${m * m} ≤ K ≤ ${m * m}.\n`
      + `Решая ${MINUS}${m * m} ≤ ${p + 1}a${term(c, "")} ≤ ${m * m}, получаем ответ.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [-2 - Math.abs(aRange[0]), m * m + 2 + Math.abs(aRange[1])],
      F: (a) => (x) => {
        const r1 = x + p * a + c, r2 = x - a
        return r1 < 0 || r2 < 0 ? null : Math.sqrt(r1) + Math.sqrt(r2) - m
      },
      sols: (a) => {
        const K = (p + 1) * a + c
        const u = (m * m - K) / (2 * m)
        return u < -1e-12 || u > m + 1e-12 ? [] : [u * u + a]
      },
    },
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => ((m * m - ((p + 1) * a + c)) / (2 * m)) ** 2 + a, label: "корень x(a)" },
        { f: (a) => a, dash: true, label: "x = a (левый конец ОДЗ)" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -6, xMax: m * m + 6, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #141. bˣ − a = √(b²ˣ − ka + m) — «единственный корень».
// Замена t = bˣ > 0. Левая часть обязана быть неотрицательной, а после возведения в квадрат
// t² сокращается: 2at = a² + ka − m. При a ≠ 0 отсюда t = (a² + ka − m)/(2a) — ЕДИНСТВЕННОЕ
// значение; при a = 0 остаётся m = 0, что при m ≠ 0 невозможно. Наборы (k, m) подобраны так,
// что оба условия t > 0 и t ≥ a разлагаются на рациональные множители:
// t = (a − p₁)(a − p₂)/(2a), t − a = −(a − r₁)(a − r₂)/(2a).
function build141({ k, m }) {
  const num = (a) => Rsub(Radd(Rmul(a, a), Rmul(R(k), a)), R(m))       // a² + ka − m
  const solve = (a) => {
    if (Rzero(a)) return 0
    const t = Rdiv(num(a), Rmul(R(2), a))
    if (Rsign(t) <= 0) return 0                                        // t = bˣ должно быть > 0
    if (Rcmp(t, a) < 0) return 0                                       // левая часть t − a ≥ 0
    return 1
  }
  const c1 = ratRoots([R(-m), R(k), R1])                               // t = 0
  const c2 = ratRoots([R(m), R(-k), R1])                               // t = a
  if (!c1.allRational || !c2.allRational) return null
  const set = assembleSet((a) => solve(a) === 1, [R0, ...c1.roots, ...c2.roots])
  return { set, solve }
}
const T141 = []
// Оба условия раскладываются на рациональные множители ровно тогда, когда k² + 4m и k² − 4m —
// точные квадраты (это редкость: на k ≤ 26 таких пар всего десяток).
for (let k = 1; k <= 26; k++) for (let m = -170; m <= 170; m++) {
  if (m === 0 || isSq(k * k + 4 * m) === null || isSq(k * k - 4 * m) === null) continue
  const r = build141({ k, m })
  if (r && tidySet(r.set)) T141.push({ k, m })
}
export function t18ExpSqrtOne() {
  const par = pick(T141), { k, m } = par
  const b = pick([2, 3, 5])
  const { set, solve } = build141(par)
  const aRange = spanRange(set)
  const bx = `${b}${supT("x")}`
  const rad = `${b * b}${supIn("x")} ${MINUS} ${k === 1 ? "" : k}a${term(m, "")}`
  return item({
    text: `${HEAD_A}\n\n${bx} ${MINUS} a = √{${rad}}\n\nимеет единственный корень.`,
    set,
    solution: `Обозначим t = ${bx} > 0; каждому t > 0 отвечает ровно один x = log${SUB[b] || ""}t. Левая часть t ${MINUS} a обязана быть неотрицательной.\n`
      + `После возведения в квадрат t${SUP[2]} сокращается: ${MINUS}${k === 1 ? "" : k}a${term(m, "")} = ${MINUS}2at + a${SUP[2]}, то есть 2at = a${SUP[2]} + ${k === 1 ? "" : k}a ${MINUS} ${nS(m)}.\n`
      + `При a = 0 это даёт ${MINUS}${nS(m)} = 0 — неверно, значит a ≠ 0 и t = ${fT(`a${SUP[2]} + ${k === 1 ? "" : k}a ${MINUS} ${nS(m)}`, "2a")}.\n`
      + `Осталось два условия: t > 0 и t ${MINUS} a = ${fT(`${MINUS}(a${SUP[2]} ${MINUS} ${k === 1 ? "" : k}a + ${nS(m)})`, "2a")} ≥ 0. Оба числителя раскладываются на линейные множители, и метод интервалов даёт ответ.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [-8, 8],
      F: (a) => (x) => {
        const t = b ** x
        const v = t * t - k * a + m
        return v < 0 ? null : t - a - Math.sqrt(v)
      },
      sols: (a) => {
        if (Math.abs(a) < 1e-12) return []
        const t = (a * a + k * a - m) / (2 * a)
        return t <= 1e-12 || t - a < -1e-9 ? [] : [Math.log(t) / Math.log(b)]
      },
    },
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => (Math.abs(a) < 1e-9 ? null : (a * a + k * a - m) / (2 * a)), label: "t(a)" },
        { f: (a) => a, dash: true, label: "t = a" },
        { f: () => 0, dash: true, label: "t = 0" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 8, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #142. √(bˣ − a) + (a − c)/√(bˣ − a) = m — «ровно два различных корня».
// Замена u = √(bˣ − a) > 0 даёт u² − mu + (a − c) = 0. Каждому положительному u отвечает
// ровно один x (bˣ = u² + a = mu + c > 0 при c ≥ 1), поэтому корней столько же,
// сколько положительных различных u: два ⟺ произведение a − c > 0 и дискриминант m² − 4(a − c) > 0.
function build142({ c, m }) {
  const solve = (a) => {
    const q = Rsub(a, R(c))                                  // произведение корней
    const d = Rsub(R(m * m), Rmul(R(4), q))                  // дискриминант
    if (Rsign(q) <= 0) return 1                              // один положительный корень (второй ≤ 0)
    return Rsign(d) > 0 ? 2 : Rsign(d) === 0 ? 1 : 0
  }
  return { set: assembleSet((a) => solve(a) === 2, [R(c), R(4 * c + m * m, 4)]), solve }
}
const T142 = []
for (const c of [1, 2, 3, 4]) for (const m of [1, 2, 3]) T142.push({ c, m })
export function t18ExpSqrtRecipTwo() {
  const par = pick(T142), { c, m } = par
  const b = pick([2, 3, 5])
  const { set, solve } = build142(par)
  const aRange = spanRange(set)
  const rt = `√{${b}${supIn("x")} ${MINUS} a}`
  return item({
    text: `${HEAD_A}\n\n${rt} + ${fT(`a ${MINUS} ${c}`, rt)} = ${m}\n\nимеет ровно два различных корня.`,
    set,
    solution: `Обозначим u = √(${b}${supT("x")} ${MINUS} a) > 0 (нуль запрещён знаменателем). Умножая на u, получаем u${SUP[2]} ${MINUS} ${m === 1 ? "" : m}u + a ${MINUS} ${c} = 0.\n`
      + `По каждому положительному u восстанавливается ровно один x: ${b}${supT("x")} = u${SUP[2]} + a = ${m === 1 ? "" : m}u + ${c} > 0.\n`
      + `Значит нужно ровно два различных положительных корня квадратного уравнения: их сумма ${m} > 0 уже положительна, поэтому остаётся `
      + `произведение a ${MINUS} ${c} > 0 и дискриминант ${m * m} ${MINUS} 4(a ${MINUS} ${c}) > 0.\n`
      + `Отсюда ${c} < a < ${Rstr(R(4 * c + m * m, 4))}.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [-6, 8],
      F: (a) => (x) => {
        const v = b ** x - a
        return v <= 0 ? null : Math.sqrt(v) + (a - c) / Math.sqrt(v) - m
      },
      sols: (a) => numQuad(1, -m, a - c).filter((u) => u > 1e-12).map((u) => Math.log(m * u + c) / Math.log(b)),
    },
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => (m * m - 4 * (a - c) >= 0 ? (m + Math.sqrt(m * m - 4 * (a - c))) / 2 : null), label: "u(a)" },
        { f: (a) => (m * m - 4 * (a - c) >= 0 ? (m - Math.sqrt(m * m - 4 * (a - c))) / 2 : null) },
        { f: () => 0, dash: true, label: "u = 0" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2, xMax: m + 4, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #143. (px − x²)² − c√(px − x²) = a² − qa — «хотя бы один корень».
// Замена u = √(px − x²) ∈ [0; p/2] (подкоренное — парабола с максимумом p²/4).
// Левая часть равна g(u) = u⁴ − cu, и при c ≥ 4(p/2)³ функция g на этом отрезке убывает,
// поэтому её множество значений — отрезок [g(p/2); 0], а каждому значению отвечает ОДНО u.
// По u восстанавливаются два x (или один, если u = p/2).
function build143({ p, c, q }) {
  const h = p / 2
  if (!Number.isInteger(h) || c < 4 * h * h * h) return null
  const G = R(h ** 4 - c * h)
  const solve = (a) => {
    const V = Rsub(Rmul(a, a), Rmul(R(q), a))
    if (Rsign(V) > 0 || Rcmp(V, G) < 0) return 0
    return Rcmp(V, G) === 0 ? 1 : 2
  }
  const e = ratRoots([Rneg(G), R(-q), R1])                    // a² − qa − G = 0
  if (!e.allRational) return null
  const set = assembleSet((a) => solve(a) >= 1, [R0, R(q), ...e.roots])
  return { set, solve, G, h }
}
const T143 = []
for (const p of [2, 4]) for (let c = 4; c <= 40; c++) for (let q = -16; q <= 16; q++) {
  if (q === 0) continue
  const r = build143({ p, c, q })
  if (r && tidySet(r.set, 3) && r.set.intervals.length >= 2) T143.push({ p, c, q })
}
export function t18SqrtRangeQuartic() {
  const par = pick(T143), { p, c, q } = par
  const { set, solve, G, h } = build143(par)
  const aRange = spanRange(set)
  const w = `${p}x ${MINUS} x${SUP[2]}`
  return item({
    text: `${HEAD_A}\n\n(${w})${SUP[2]} ${MINUS} ${c === 1 ? "" : c}√{${w}} = a${SUP[2]}${term(-q, "a")}\n\nимеет хотя бы один корень.`,
    set,
    solution: `Обозначим u = √(${w}) ≥ 0. Выражение ${w} = ${h * h} ${MINUS} (x ${MINUS} ${h})${SUP[2]} не превосходит ${h * h}, поэтому u пробегает отрезок [0; ${h}], причём каждому u ∈ (0; ${h}) отвечают ДВА значения x, а u = ${h} — одно (x = ${h}).\n`
      + `Левая часть равна g(u) = u⁴ ${MINUS} ${c === 1 ? "" : c}u. Её производная 4u³ ${MINUS} ${c} на отрезке [0; ${h}] не положительна (${c} ≥ ${4 * h * h * h}), значит g убывает от g(0) = 0 до g(${h}) = ${Rstr(G)}.\n`
      + `Поэтому корень существует ⟺ ${Rstr(G)} ≤ a${SUP[2]}${term(-q, "a")} ≤ 0.\n`
      + `Неравенство a${SUP[2]}${term(-q, "a")} ≤ 0 даёт отрезок между 0 и ${q}, а a${SUP[2]}${term(-q, "a")} ≥ ${Rstr(G)} выкалывает из него середину.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [0, p],
      F: (a) => (x) => {
        const v = p * x - x * x
        return v < 0 ? null : v * v - c * Math.sqrt(v) - (a * a - q * a)
      },
      sols: (a) => {
        const V = a * a - q * a
        const g = (u) => u ** 4 - c * u
        if (V > 1e-12 || V < g(h) - 1e-12) return []
        let lo = 0, hi = h
        for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (g(mid) > V) lo = mid; else hi = mid }
        const ww = ((lo + hi) / 2) ** 2
        const d = p * p - 4 * ww
        if (d <= 1e-9) return [h]
        const s = Math.sqrt(d)
        return [(p - s) / 2, (p + s) / 2]
      },
    },
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => a * a - q * a, label: "правая часть a² − qa" },
        { f: () => 0, dash: true, label: "0 — наибольшее значение" },
        { f: () => Rnum(G), dash: true, label: `${Rstr(G)} — наименьшее` },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: Rnum(G) - 2, xMax: 4, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #144. √x + √(pa − x) = ca — «ровно два различных корня».
// После возведения в квадрат pa + 2√(x(pa − x)) = c²a², то есть 2√(x(pa − x)) = a(c²a − p);
// правая часть обязана быть неотрицательной. Ещё одно возведение даёт
// 4x² − 4pax + a²(c²a − p)² = 0 — оба корня автоматически лежат на отрезке [0; pa]
// (их сумма pa, произведение неотрицательно), поэтому всё решает дискриминант
// a²(p² − (c²a − p)²) > 0, равносильный 0 < c²a < 2p.
function build144({ p, c }) {
  const lo = R(p, c * c), hi = R(2 * p, c * c)
  const solve = (a) => {
    if (Rsign(a) < 0) return 0
    if (Rzero(a)) return 1                                    // x = 0
    if (Rcmp(a, lo) < 0 || Rcmp(a, hi) > 0) return 0
    return Rcmp(a, hi) === 0 ? 1 : 2
  }
  return { set: assembleSet((a) => solve(a) === 2, [R0, lo, hi]), solve }
}
const T144 = []
for (const p of [1, 2, 3, 4, 5, 6, 8]) for (const c of [1, 2, 3]) T144.push({ p, c })
export function t18SqrtTwoTermsTwo() {
  const par = pick(T144), { p, c } = par
  const { set, solve } = build144(par)
  const aRange = spanRange(set)
  return item({
    text: `${HEAD_A}\n\n√{x} + √{${p === 1 ? "" : p}a ${MINUS} x} = ${c === 1 ? "a" : `${c}a`}\n\nимеет ровно два различных корня.`,
    set,
    solution: `ОДЗ: 0 ≤ x ≤ ${p === 1 ? "" : p}a (значит a ≥ 0). Возводим в квадрат: ${p === 1 ? "" : p}a + 2√(x(${p === 1 ? "" : p}a ${MINUS} x)) = ${c * c === 1 ? "" : c * c}a${SUP[2]}, откуда 2√(x(${p === 1 ? "" : p}a ${MINUS} x)) = a(${c * c === 1 ? "" : c * c}a ${MINUS} ${p}) — правая часть обязана быть неотрицательной.\n`
      + `Ещё одно возведение даёт 4x${SUP[2]} ${MINUS} ${4 * p === 1 ? "" : 4 * p}ax + a${SUP[2]}(${c * c === 1 ? "" : c * c}a ${MINUS} ${p})${SUP[2]} = 0. Сумма корней ${p === 1 ? "" : p}a ≥ 0, произведение ≥ 0, поэтому оба корня сами собой попадают в ОДЗ.\n`
      + `Остаётся дискриминант: ${4 * p * p}a${SUP[2]} ${MINUS} 4a${SUP[2]}(${c * c === 1 ? "" : c * c}a ${MINUS} ${p})${SUP[2]} > 0 ⟺ |${c * c === 1 ? "" : c * c}a ${MINUS} ${p}| < ${p} ⟺ 0 < ${c * c === 1 ? "" : c * c}a < ${2 * p}.\n`
      + `Вместе с условием a(${c * c === 1 ? "" : c * c}a ${MINUS} ${p}) ≥ 0 это даёт ${Rstr(R(p, c * c))} ≤ a < ${Rstr(R(2 * p, c * c))}.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [0, Math.max(2, p * aRange[1])],
      F: (a) => (x) => (x < 0 || p * a - x < 0 ? null : Math.sqrt(x) + Math.sqrt(p * a - x) - c * a),
      sols: (a) => {
        if (a < 0) return []
        const d = p * p - (c * c * a - p) ** 2
        if (a * (c * c * a - p) < -1e-12 || d < -1e-12) return []
        const s = Math.sqrt(Math.max(0, d))
        const x1 = (a * (p - s)) / 2, x2 = (a * (p + s)) / 2
        return Math.abs(x1 - x2) < 1e-9 ? [(x1 + x2) / 2] : [x1, x2]
      },
    },
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => (a >= 0 && p * p - (c * c * a - p) ** 2 >= 0 ? (a * (p + Math.sqrt(p * p - (c * c * a - p) ** 2))) / 2 : null), label: "корни x(a)" },
        { f: (a) => (a >= 0 && p * p - (c * c * a - p) ** 2 >= 0 ? (a * (p - Math.sqrt(p * p - (c * c * a - p) ** 2))) / 2 : null) },
        { f: (a) => p * a, dash: true, label: "x = pa (правый конец ОДЗ)" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2, xMax: 2 * p * Rnum(R(2 * p, c * c)), aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #147. |1 − k√x| = m(x + a) — «ровно два корня» среди ПОЛОЖИТЕЛЬНЫХ a.
// Замена u = √x ≥ 0 взаимно однозначна (x = u²), а модуль раскрывается на двух промежутках:
// при u ≤ 1/k получаем mu² + ku + ma − 1 = 0, при u > 1/k — mu² − ku + ma + 1 = 0.
// Число корней на каждом промежутке считается точно (Штурм) через механизм pieces.
function build147({ k, m }) {
  const pieces = (a) => [
    { N: [Rsub(Rmul(R(m), a), R1), R(k), R(m)], lo: R0, hi: R(1, k), incLo: true, incHi: true },
    { N: [Radd(Rmul(R(m), a), R1), R(-k), R(m)], lo: R(1, k), hi: "+inf", incLo: false, incHi: false },
  ]
  const solve = (a) => solveCount(pieces, a)
  const crit = [R0, R(k * k + 4 * m, 4 * m * m), R(k * k - 4 * m, 4 * m * m), R(1, m), R(-1, m), R(-1, k * k)]
  const set = assembleSet((a) => Rsign(a) > 0 && solve(a) === 2, crit)
  const b = setBounds(set)
  if (!b.length || solve(R0) === 2) return null                // a = 0 обязано выпадать из ответа
  const hi = Math.max(24, Math.ceil(Rnum(b[b.length - 1])) + 6)
  return { set, pieces, solve, aRange: [0, hi] }
}
const T147 = []
for (let k = 1; k <= 9; k++) for (const m of [1, 2, 3, 4]) {
  const r = build147({ k, m })
  // изолированную точку в ответе не берём: она возникает при вырождении (корень u = 0
  // появляется ровно тогда же, когда вторая ветвь даёт двойной корень) и выглядит как брак
  if (r && tidySet(r.set, 2) && r.set.intervals.length >= 1) T147.push({ k, m })
}
export function t18AbsSqrtLineTwo() {
  const par = pick(T147), { k, m } = par
  const { set, pieces, aRange } = build147(par)
  return item({
    text: `${HEAD_POS}\n\n|1 ${MINUS} ${k === 1 ? "" : k}√{x}| = ${m === 1 ? "x + a" : `${m}(x + a)`}\n\nимеет ровно два корня.`,
    set,
    solution: `Обозначим u = √x ≥ 0, тогда x = u${SUP[2]} и разным u ≥ 0 отвечают разные x. Уравнение принимает вид |1 ${MINUS} ${k === 1 ? "" : k}u| = ${m === 1 ? `u${SUP[2]} + a` : `${m}(u${SUP[2]} + a)`}.\n`
      + `При u ≤ ${Rstr(R(1, k))} модуль раскрывается со знаком «+»: ${m === 1 ? "" : m}u${SUP[2]} + ${k === 1 ? "" : k}u + ${m === 1 ? "" : m}a ${MINUS} 1 = 0.\n`
      + `При u > ${Rstr(R(1, k))} — со знаком «−»: ${m === 1 ? "" : m}u${SUP[2]} ${MINUS} ${k === 1 ? "" : k}u + ${m === 1 ? "" : m}a + 1 = 0.\n`
      + `Дискриминанты равны ${k * k} ${MINUS} ${4 * m === 1 ? "" : 4 * m}(${m === 1 ? "" : m}a ${MINUS} 1) и ${k * k} ${MINUS} ${4 * m === 1 ? "" : 4 * m}(${m === 1 ? "" : m}a + 1), а конфигурация меняется ещё и когда корень попадает на границу u = ${Rstr(R(1, k))} или в u = 0.\n`
      + `Перебирая промежутки между этими критическими значениями и оставляя только положительные a, получаем ответ.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [0, (k / m) ** 2 + 3],
      F: (a) => (x) => (x < 0 ? null : Math.abs(1 - k * Math.sqrt(x)) - m * (x + a)),
      sols: (a) => {
        const out = []
        for (const u of numQuad(m, k, m * a - 1)) if (u >= -1e-12 && u <= 1 / k + 1e-12) out.push(u)
        for (const u of numQuad(m, -k, m * a + 1)) if (u > 1 / k + 1e-12) out.push(u)
        return out.map((u) => u * u)
      },
    },
    predicate: { type: "count", n: 2 },
    pieces,
    aRange,
    picture: {
      curves: [
        { f: (a) => (k * k - 4 * m * (m * a - 1) >= 0 ? (-k + Math.sqrt(k * k - 4 * m * (m * a - 1))) / (2 * m) : null), label: "u из первой ветви" },
        { f: (a) => (k * k - 4 * m * (m * a + 1) >= 0 ? (k - Math.sqrt(k * k - 4 * m * (m * a + 1))) / (2 * m) : null), label: "u из второй ветви" },
        { f: (a) => (k * k - 4 * m * (m * a + 1) >= 0 ? (k + Math.sqrt(k * k - 4 * m * (m * a + 1))) / (2 * m) : null) },
        { f: () => 1 / k, dash: true, label: `u = 1/${k}` },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: k / m + 2, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #148. √(1 − px) = a − k|x| — «более двух корней».
// Правая часть обязана быть неотрицательной, поэтому |x| ≤ a/k (в частности a ≥ 0),
// а ОДЗ даёт x ≤ 1/p. На каждом из двух промежутков (x ≥ 0 и x < 0) после возведения
// в квадрат получается квадратный трёхчлен, и корни считаются точно через pieces.
function build148({ p, k }) {
  const pieces = (a) => {
    if (Rsign(a) < 0) return []
    const cap = Rcmp(R(1, p), Rdiv(a, R(k))) <= 0 ? R(1, p) : Rdiv(a, R(k))
    const out = [{
      N: [Rsub(Rmul(a, a), R1), Rsub(R(p), Rmul(R(2 * k), a)), R(k * k)],
      lo: R0, hi: cap, incLo: true, incHi: true,
    }]
    if (Rsign(a) > 0) out.push({
      N: [Rsub(Rmul(a, a), R1), Radd(R(p), Rmul(R(2 * k), a)), R(k * k)],
      lo: Rdiv(Rneg(a), R(k)), hi: R0, incLo: true, incHi: false,
    })
    return out
  }
  const solve = (a) => solveCount(pieces, a)
  const crit = [R0, R1, R(-1), R(k, p), R(-k, p), R(p * p + 4 * k * k, 4 * p * k), R(-(p * p + 4 * k * k), 4 * p * k)]
  return { set: assembleSet((a) => solve(a) >= 3, crit), pieces, solve }
}
const T148 = []
for (const p of [1, 2, 3, 4]) for (const k of [1, 2, 3, 4, 5]) {
  const r = build148({ p, k })
  if (r && tidySet(r.set, 2)) T148.push({ p, k })
}
export function t18SqrtVeeMore() {
  const par = pick(T148), { p, k } = par
  const { set, pieces } = build148(par)
  const aRange = spanRange(set)
  return item({
    text: `${HEAD_A}\n\n√{1 ${MINUS} ${p === 1 ? "" : p}x} = a ${MINUS} ${k === 1 ? "" : k}|x|\n\nимеет более двух корней.`,
    set,
    solution: `ОДЗ: x ≤ ${Rstr(R(1, p))}. Правая часть обязана быть неотрицательной: ${k === 1 ? "" : k}|x| ≤ a, откуда сразу a ≥ 0 и ${MINUS}${fT("a", String(k))} ≤ x ≤ ${fT("a", String(k))}.\n`
      + `При x ≥ 0 возведение в квадрат даёт ${k * k === 1 ? "" : k * k}x${SUP[2]} ${MINUS} ${2 * k === 1 ? "" : 2 * k}ax + ${p === 1 ? "" : p}x + a${SUP[2]} ${MINUS} 1 = 0, при x < 0 — ${k * k === 1 ? "" : k * k}x${SUP[2]} + ${2 * k === 1 ? "" : 2 * k}ax + ${p === 1 ? "" : p}x + a${SUP[2]} ${MINUS} 1 = 0.\n`
      + `Оба дискриминанта равны ${p * p} ∓ ${4 * p * k}a + ${4 * k * k}, корень попадает в нуль при a${SUP[2]} = 1, а на правый конец промежутка — при a = ${Rstr(R(k, p))}.\n`
      + `Между соседними критическими значениями число корней постоянно; больше двух их оказывается только на ${setToString(set)}.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [-Math.abs(aRange[1]) / k - 1, 1 / p],
      F: (a) => (x) => {
        const v = 1 - p * x
        return v < 0 ? null : Math.sqrt(v) - (a - k * Math.abs(x))
      },
      sols: (a) => {
        if (a < 0) return []
        const cap = Math.min(1 / p, a / k)
        const out = []
        for (const x of numQuad(k * k, p - 2 * k * a, a * a - 1)) if (x >= -1e-12 && x <= cap + 1e-12) out.push(x)
        for (const x of numQuad(k * k, p + 2 * k * a, a * a - 1)) if (x < -1e-12 && x >= -a / k - 1e-12) out.push(x)
        return out
      },
    },
    predicate: { type: "atLeast", n: 3 },
    pieces,
    aRange,
    picture: {
      curves: [
        { f: (a) => (a >= 0 ? a / k : null), dash: true, label: "x = a/k" },
        { f: (a) => (a >= 0 ? -a / k : null), dash: true },
        { f: () => 1 / p, dash: true, label: `x = 1/${p}` },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -4, xMax: 2, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// =============================================================================
// РАЗДЕЛ L. Монотонная замена φ(t) = tⁿ + ct (эталон #99–#101)
// =============================================================================
// Во всех задачах раздела уравнение — это замаскированное равенство φ(A) = φ(B) для
// НЕЧЁТНОЙ строго возрастающей функции φ(t) = tⁿ + ct (n нечётно). Такая φ инъективна,
// поэтому уравнение равносильно A = B — обычному квадратному уравнению, и дальше всё
// решается точно. Главное для генератора — напечатать РАЗВЁРНУТУЮ запись (именно в таком
// виде задача стоит в эталоне), а не свёрнутую.
const SUPD = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" }
const supNum = (n) => String(n).split("").map((d) => SUPD[d]).join("")
const coef = (k) => (k === 1 ? "" : String(k))

// #99. k³x⁶ + (pa − qx)³ + ckx² + cpa = cqx — «не имеет корней».
// Слева стоит φ(kx²) + φ(pa − qx) при φ(t) = t³ + ct, поэтому уравнение равносильно
// kx² = qx − pa, то есть kx² − qx + pa = 0. Корней нет ⟺ q² − 4kpa < 0.
function build99({ k, p, q }) {   // c влияет только на печать
  const solve = (a) => countRoots([Rmul(R(p), a), R(-q), R(k)], "-inf", "+inf", false, false)
  return { set: assembleSet((a) => solve(a) === 0, [R(q * q, 4 * k * p)]), solve }
}
const T99 = []
for (const k of [1, 2, 3]) for (const c of [1, 2, 3]) for (const p of [2, 3, 4, 5, 6]) for (const q of [1, 2, 3, 4]) {
  const r = build99({ k, c, p, q })                  // круглость границы q²/(4kp) проверит tidySet
  if (r && tidySet(r.set, 2)) T99.push({ k, c, p, q })
}
export function t18MonoCubeNoRoots() {
  const par = pick(T99), { k, c, p, q } = par
  const { set, solve } = build99(par)
  const aRange = spanRange(set)
  const inner = `${coef(p)}a ${MINUS} ${coef(q)}x`
  return item({
    text: `${HEAD_A}\n\n${coef(k ** 3)}x⁶ + (${inner})${SUP[3]} + ${coef(c * k)}x${SUP[2]} + ${coef(c * p)}a = ${coef(c * q)}x\n\nне имеет корней.`,
    set,
    solution: `Соберём слагаемые в две одинаковые конструкции: ${coef(k ** 3)}x⁶ + ${coef(c * k)}x${SUP[2]} = (${coef(k)}x${SUP[2]})${SUP[3]} + ${coef(c)}·${coef(k)}x${SUP[2]}, `
      + `а (${inner})${SUP[3]} + ${coef(c * p)}a ${MINUS} ${coef(c * q)}x = (${inner})${SUP[3]} + ${coef(c)}(${inner}).\n`
      + `Значит уравнение имеет вид φ(${coef(k)}x${SUP[2]}) + φ(${inner}) = 0, где φ(t) = t${SUP[3]} + ${coef(c)}t.\n`
      + `Функция φ возрастает (её производная 3t${SUP[2]} + ${c} положительна) и нечётна, поэтому равенство φ(A) = ${MINUS}φ(B) = φ(${MINUS}B) равносильно A = ${MINUS}B.\n`
      + `Получаем ${coef(k)}x${SUP[2]} = ${coef(q)}x ${MINUS} ${coef(p)}a, то есть ${coef(k)}x${SUP[2]} ${MINUS} ${coef(q)}x + ${coef(p)}a = 0. Корней нет ⟺ дискриминант ${q * q} ${MINUS} ${4 * k * p}a < 0.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [-10, 10],
      // делим на общий положительный множитель: корни и смены знака те же, но величина
      // остаётся порядка единицы (иначе x⁶ на краю отрезка съедает точность double)
      F: (a) => (x) => (k ** 3 * x ** 6 + (p * a - q * x) ** 3 + c * k * x * x + c * p * a - c * q * x) / (1 + Math.abs(x) ** 6),
      sols: (a) => numQuad(k, -q, p * a),
    },
    predicate: { type: "none" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => (q * q - 4 * k * p * a >= 0 ? (q + Math.sqrt(q * q - 4 * k * p * a)) / (2 * k) : null), label: "корни kx²−qx+pa" },
        { f: (a) => (q * q - 4 * k * p * a >= 0 ? (q - Math.sqrt(q * q - 4 * k * p * a)) / (2 * k) : null) },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -6, xMax: 6, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #100. x²ⁿ + (a − k|x|)ⁿ + x² − k|x| + a = 0 — «более трёх различных решений».
// Слева φ(x²) + φ(a − k|x|) при φ(t) = tⁿ + t, значит x² = k|x| − a. Замена u = |x| ≥ 0
// даёт u² − ku + a = 0; каждому корню u > 0 отвечают ДВА значения x, корню u = 0 — одно.
function build100({ k }) {          // n влияет только на печать
  const solve = (a) => {
    const d = Rsub(R(k * k), Rmul(R(4), a))               // дискриминант по u
    if (Rsign(d) < 0) return 0
    if (Rsign(d) === 0) return 2                          // u = k/2 > 0 — два значения x
    if (Rsign(a) > 0) return 4                            // оба корня положительны
    return Rzero(a) ? 3 : 2                               // u = 0 даёт одно x, отрицательный корень отбрасываем
  }
  return { set: assembleSet((a) => solve(a) >= 4, [R0, R(k * k, 4)]), solve }
}
const T100 = []
for (const n of [3, 5]) for (const k of [1, 2, 3, 4, 5, 6]) T100.push({ n, k })
export function t18MonoAbsMore() {
  const par = pick(T100), { n, k } = par
  const { set, solve } = build100(par)
  const aRange = spanRange(set)
  const inner = `a ${MINUS} ${coef(k)}|x|`
  return item({
    text: `${HEAD_A}\n\nx${supNum(2 * n)} + (${inner})${supNum(n)} + x${SUP[2]} ${MINUS} ${coef(k)}|x| + a = 0\n\nимеет более трёх различных решений.`,
    set,
    solution: `Заметим, что x${supNum(2 * n)} = (x${SUP[2]})${supNum(n)}, а x${SUP[2]} ${MINUS} ${coef(k)}|x| + a = x${SUP[2]} + (${inner}).\n`
      + `Поэтому уравнение имеет вид φ(x${SUP[2]}) + φ(${inner}) = 0, где φ(t) = t${supNum(n)} + t — нечётная возрастающая функция.\n`
      + `Отсюда x${SUP[2]} = ${MINUS}(${inner}) = ${coef(k)}|x| ${MINUS} a. Обозначим u = |x| ≥ 0: u${SUP[2]} ${MINUS} ${coef(k)}u + a = 0.\n`
      + `Каждому корню u > 0 отвечают два значения x = ±u, корню u = 0 — одно. Значит решений больше трёх ⟺ оба корня положительны и различны: `
      + `дискриминант ${k * k} ${MINUS} 4a > 0 и произведение a > 0.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [-k - 8, k + 8],
      F: (a) => (x) => (x ** (2 * n) + (a - k * Math.abs(x)) ** n + x * x - k * Math.abs(x) + a) / (1 + Math.abs(x) ** (2 * n)),
      sols: (a) => {
        const out = []
        for (const u of numQuad(1, -k, a)) {
          if (u < -1e-12) continue
          if (u < 1e-12) out.push(0)
          else { out.push(-u); out.push(u) }
        }
        return out
      },
    },
    predicate: { type: "atLeast", n: 4 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => (k * k - 4 * a >= 0 ? (k + Math.sqrt(k * k - 4 * a)) / 2 : null), label: "u = |x|" },
        { f: (a) => (k * k - 4 * a >= 0 ? (k - Math.sqrt(k * k - 4 * a)) / 2 : null) },
        { f: () => 0, dash: true, label: "u = 0" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -1, xMax: k + 2, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #101. cos²ⁿx + (k·cos x − a)ⁿ + cos²x + k·cos x = a — «хотя бы один корень».
// Слева φ(cos²x) + φ(k·cos x − a) при φ(t) = tⁿ + t, поэтому cos²x = a − k·cos x.
// Обозначив c = cos x ∈ [−1; 1], получаем c² + kc − a = 0: корень по x существует ровно
// тогда, когда у этого уравнения есть корень на отрезке [−1; 1].
function build101({ k }) {          // n влияет только на печать
  const solve = (a) => countRoots([Rneg(a), R(k), R1], R(-1), R1, true, true)
  const crit = [R(1 - k), R(1 + k), R(-k * k, 4)]
  return { set: assembleSet((a) => solve(a) >= 1, crit), solve }
}
const T101 = []
for (const n of [3, 5, 9]) for (const k of [1, 2, 3, 4, 5, 6]) T101.push({ n, k })
export function t18MonoCosExists() {
  const par = pick(T101), { n, k } = par
  const { set, solve } = build101(par)
  const aRange = spanRange(set)
  const inner = `${coef(k)}cos x ${MINUS} a`
  return item({
    text: `${HEAD_A}\n\ncos${supNum(2 * n)}x + (${inner})${supNum(n)} + cos${SUP[2]}x + ${coef(k)}cos x = a\n\nимеет хотя бы один корень.`,
    set,
    solution: `Так как cos${supNum(2 * n)}x = (cos${SUP[2]}x)${supNum(n)}, а ${coef(k)}cos x ${MINUS} a — это ровно то выражение, что стоит в скобках, уравнение имеет вид `
      + `φ(cos${SUP[2]}x) + φ(${inner}) = 0, где φ(t) = t${supNum(n)} + t.\n`
      + `Функция φ возрастает и нечётна, поэтому cos${SUP[2]}x = a ${MINUS} ${coef(k)}cos x.\n`
      + `Обозначим c = cos x ∈ [${MINUS}1; 1]: уравнение принимает вид c${SUP[2]} + ${coef(k)}c = a. Функция c${SUP[2]} + ${coef(k)}c ${k >= 2 ? `на отрезке [${MINUS}1; 1] возрастает (вершина параболы c = ${MINUS}${Rstr(R(k, 2))} лежит левее)` : `имеет минимум в вершине c = ${MINUS}${Rstr(R(k, 2))}`}.\n`
      + `Её множество значений на этом отрезке — ${setToString(set)}; при таких a корень есть, при остальных — нет.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [0, Math.PI],
      F: (a) => (x) => Math.cos(x) ** (2 * n) + (k * Math.cos(x) - a) ** n + Math.cos(x) ** 2 + k * Math.cos(x) - a,
      sols: (a) => numQuad(1, k, -a).filter((c) => c >= -1 - 1e-12 && c <= 1 + 1e-12)
        .map((c) => Math.acos(Math.min(1, Math.max(-1, c)))),
    },
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => (k * k + 4 * a >= 0 ? (-k + Math.sqrt(k * k + 4 * a)) / 2 : null), label: "c = cos x" },
        { f: (a) => (k * k + 4 * a >= 0 ? (-k - Math.sqrt(k * k + 4 * a)) / 2 : null) },
        { f: () => 1, dash: true, label: "c = ±1" },
        { f: () => -1, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -3, xMax: 3, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// =============================================================================
// РАЗДЕЛ R. Логарифмические уравнения (эталон #145, #146)
// =============================================================================
// Десятичная запись рационального числа с одним знаком после запятой (у ФИПИ основание
// логарифма пишется как «a − 3,5», а не «a − 7/2»).
const decStr = (r) => (r.d === 1n ? nS(Number(r.n)) : r.d === 2n
  ? `${r.n < 0n ? MINUS : ""}${(Number(r.n < 0n ? -r.n : r.n) - 1) / 2},5` : Rstr(r))

// #145. log_{a−p}(kx² + c) = log_{a−p}(k(a−q)x + d) — «ровно два различных корня».
// Логарифмы с одним основанием равны ⟺ равны аргументы (и положительны). Левый аргумент
// положителен всегда, значит и правый — автоматически. Остаётся kx² − k(a−q)x + c − d = 0
// с дискриминантом k²(a−q)² + 4k(d−c) > 0 (при d > c он положителен ВСЕГДА), то есть корней
// всегда ровно два, и весь ответ определяется условиями на основание: a − p > 0 и a − p ≠ 1.
function build145({ p, k, q, c, d }) {
  const solve = (a) => {
    const b = Rsub(a, p)
    if (Rsign(b) <= 0 || Rcmp(b, R1) === 0) return 0
    return countRoots([R(c - d), Rmul(R(-k), Rsub(a, R(q))), R(k)], "-inf", "+inf", false, false)
  }
  return { set: assembleSet((a) => solve(a) === 2, [p, Radd(p, R1)]), solve }
}
const T145 = []
for (const pn of [2, 3, 4, 5, 7, 9]) for (const k of [1, 2, 3, 4]) for (const q of [1, 2, 3]) {
  for (const [c, d] of [[8, 9], [1, 2], [2, 5], [3, 4], [5, 9], [4, 13]]) T145.push({ p: R(pn, 2), k, q, c, d })
}
export function t18LogSameBaseTwo() {
  const par = pick(T145), { p, k, q, c, d } = par
  const { set, solve } = build145(par)
  const base = `⟦b:a ${MINUS} ${decStr(p)}⟧`
  const left = `${k === 1 ? "" : k}x${SUP[2]} + ${c}`
  const right = `${k === 1 ? "" : k}(a ${MINUS} ${q})x + ${d}`
  return item({
    text: `${HEAD_A}\n\nlog${base}(${left}) = log${base}(${right})\n\nимеет ровно два различных корня.`,
    set,
    solution: `Основание логарифма обязано быть положительным и не равным единице: a ${MINUS} ${decStr(p)} > 0 и a ${MINUS} ${decStr(p)} ≠ 1, то есть a > ${decStr(p)} и a ≠ ${decStr(Radd(p, R1))}.\n`
      + `При таком основании равенство логарифмов равносильно равенству аргументов: ${left} = ${right}. Левая часть положительна всегда, значит и правая при этом положительна автоматически — отдельного условия ОДЗ не возникает.\n`
      + `Получаем ${k === 1 ? "" : k}x${SUP[2]} ${MINUS} ${k === 1 ? "" : k}(a ${MINUS} ${q})x + ${c - d === 0 ? "0" : nS(c - d)} = 0. Его дискриминант ${k * k === 1 ? "" : k * k}(a ${MINUS} ${q})${SUP[2]} + ${4 * k * (d - c)} положителен при ЛЮБОМ a, поэтому различных корней всегда ровно два.\n`
      + `Значит ответ определяется только условиями на основание.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange: spanRange(set),
    picture: {
      curves: [
        { f: (a) => (a - Rnum(p) > 0 ? (k * (a - q) + Math.sqrt(k * k * (a - q) ** 2 + 4 * k * (d - c))) / (2 * k) : null), label: "корни" },
        { f: (a) => (a - Rnum(p) > 0 ? (k * (a - q) - Math.sqrt(k * k * (a - q) ** 2 + 4 * k * (d - c))) / (2 * k) : null) },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 8, aMin: spanRange(set)[0], aMax: spanRange(set)[1],
    },
  })
}

// #146. (log₂(x+a) − log₂(x−a))² − S(a)·(log₂(x+a) − log₂(x−a)) + P(a) = 0 — «ровно два решения».
// Обозначим t = log₂((x + a)/(x − a)); ОДЗ x > |a|. При a > 0 отношение (x+a)/(x−a) убывает
// от +∞ до 1, поэтому t пробегает (0; +∞) ВЗАИМНО ОДНОЗНАЧНО; при a < 0 оно растёт от 0 до 1,
// и t пробегает (−∞; 0). При a = 0 всегда t = 0.
// Коэффициенты подобраны так, что квадратное уравнение по t раскладывается: t = αa + β и
// t = γa + δ. Решений столько, сколько РАЗЛИЧНЫХ значений t попало в нужную полупрямую.
// Печатаемые коэффициенты S и P берутся не «на глаз», а СИМВОЛЬНО из этих же корней
// (pAdd/pMul над Q), поэтому напечатанное уравнение заведомо равносильно разложению.
function build146({ al, be, ga, de }) {
  const t1 = [R(be), R(al)], t2 = [R(de), R(ga)]              // корни как многочлены по a
  const Sc = pAdd(t1, t2).map((c) => Number(c.n))             // сумма корней
  const Pc = pMul(t1, t2).map((c) => Number(c.n))             // произведение корней
  const solve = (a) => {
    if (Rzero(a)) return 0                                    // t = 0, а свободный член βδ ≠ 0
    const want = Rsign(a) > 0 ? 1 : -1
    const ts = uniqSorted([Radd(Rmul(R(al), a), R(be)), Radd(Rmul(R(ga), a), R(de))])
    return ts.filter((t) => Rsign(t) === want).length
  }
  const crit = [R0]
  if (al !== 0) crit.push(R(-be, al))
  if (ga !== 0) crit.push(R(-de, ga))
  if (ga !== al) crit.push(R(be - de, ga - al))
  return { set: assembleSet((a) => solve(a) === 2, crit), solve, Sc, Pc }
}
// Одноразовая ЧИСЛОВАЯ сверка набора с напечатанным видом уравнения: при нескольких
// значениях a (взяты небольшие, чтобы |t| было умеренным и логарифмы считались точно)
// сканируем x по ОДЗ и сравниваем число смен знака ИСХОДНОГО выражения с ответом решателя.
// Аналог `raw` из других разделов; в самом verify18 он здесь не годится, потому что при
// больших |a| корень x подходит к границе ОДЗ на 10⁻⁷ и double теряет точность.
export function check146(solve, Sc, Pc) {   // экспортирован, чтобы перебор можно было повторить
  const val = (a, x) => {
    const t = Math.log((x + a) / (x - a)) / Math.LN2
    return t * t - (Sc[1] * a + Sc[0]) * t + (Pc[2] * a * a + Pc[1] * a + Pc[0])
  }
  for (const a of [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5]) {
    const lo = Math.abs(a) + 1e-6, hi = Math.abs(a) + 400
    let prev = val(a, lo), n = 0
    for (let i = 1; i <= 200000; i++) {
      const x = lo + ((hi - lo) * i) / 200000
      const v = val(a, x)
      if (Math.sign(v) !== Math.sign(prev) && v !== 0 && prev !== 0) n++
      prev = v
    }
    if (n !== solve(R(Math.round(a * 2), 2))) return false
  }
  return true
}
// Наборы (α, β, γ, δ) отобраны разовым перебором: ответ круглый И одноразовая числовая
// сверка check146 подтвердила, что напечатанное уравнение имеет ровно те корни,
// что даёт разложение (сам перебор в код не входит — он занимал секунду при импорте).
const T146 = [
  [1, -2, 1, -1], [1, -2, 1, 1], [1, -2, 1, 2], [1, -2, 2, -2], [1, -2, 2, -1], [1, -2, 2, 1], [1, -2, 2, 2], [1, -2, 3, -2],
  [1, -2, 3, 2], [1, -1, 1, -2], [1, -1, 1, 1], [1, -1, 1, 2], [1, -1, 2, -2], [1, -1, 2, -1], [1, -1, 2, 1], [1, -1, 2, 2],
  [1, -1, 3, -2], [1, -1, 3, -1], [1, -1, 3, 1], [1, 1, 1, -2], [1, 1, 1, -1], [1, 1, 1, 2], [1, 1, 2, -2], [1, 1, 2, -1],
  [1, 1, 2, 1], [1, 1, 2, 2], [1, 1, 3, -1], [1, 1, 3, 1], [1, 1, 3, 2], [1, 2, 1, -2], [1, 2, 1, -1], [1, 2, 1, 1],
  [1, 2, 2, -2], [1, 2, 2, -1], [1, 2, 2, 1], [1, 2, 2, 2], [1, 2, 3, -2], [1, 2, 3, 2], [2, -2, 1, -2], [2, -2, 1, -1],
  [2, -2, 1, 1], [2, -2, 1, 2], [2, -2, 2, -1], [2, -2, 2, 1], [2, -2, 2, 2], [2, -2, 3, -2], [2, -2, 3, -1], [2, -2, 3, 1],
  [2, -2, 3, 2], [2, -1, 1, -2], [2, -1, 1, -1], [2, -1, 1, 1], [2, -1, 1, 2], [2, -1, 2, -2], [2, -1, 2, 1], [2, -1, 2, 2],
  [2, -1, 3, -2], [2, -1, 3, -1], [2, -1, 3, 1], [2, -1, 3, 2], [2, 1, 1, -2], [2, 1, 1, -1], [2, 1, 1, 1], [2, 1, 1, 2],
  [2, 1, 2, -2], [2, 1, 2, -1], [2, 1, 2, 2], [2, 1, 3, -2], [2, 1, 3, -1], [2, 1, 3, 1], [2, 1, 3, 2], [2, 2, 1, -2],
  [2, 2, 1, -1], [2, 2, 1, 1], [2, 2, 1, 2], [2, 2, 2, -2], [2, 2, 2, -1], [2, 2, 2, 1], [2, 2, 3, -2], [2, 2, 3, -1],
  [2, 2, 3, 1], [2, 2, 3, 2], [3, -2, 1, -2], [3, -2, 1, -1], [3, -2, 1, 2], [3, -2, 2, -2], [3, -2, 2, -1], [3, -2, 2, 1],
  [3, -2, 2, 2], [3, -2, 3, -1], [3, -2, 3, 1], [3, -2, 3, 2], [3, -1, 1, -1], [3, -1, 1, 1], [3, -1, 2, -2], [3, -1, 2, -1],
  [3, -1, 2, 1], [3, -1, 2, 2], [3, -1, 3, -2], [3, -1, 3, 1], [3, -1, 3, 2], [3, 1, 1, -1], [3, 1, 1, 1], [3, 1, 2, -2],
  [3, 1, 2, -1], [3, 1, 2, 1], [3, 1, 2, 2], [3, 1, 3, -2], [3, 1, 3, -1], [3, 1, 3, 2], [3, 2, 1, -2], [3, 2, 1, 1],
  [3, 2, 1, 2], [3, 2, 2, -2], [3, 2, 2, -1], [3, 2, 2, 1], [3, 2, 2, 2], [3, 2, 3, -2], [3, 2, 3, -1], [3, 2, 3, 1],
].map(([al, be, ga, de]) => ({ al, be, ga, de }))

export function t18LogDiffSubstTwo() {
  const par = pick(T146), { al, be, ga, de } = par
  const { set, solve, Sc, Pc } = build146(par)
  const aRange = spanRange(set)
  const L = `log⟦b:2⟧(x + a) ${MINUS} log⟦b:2⟧(x ${MINUS} a)`
  const S = `${Sc[1] === 1 ? "" : Sc[1]}a${term(Sc[0], "")}`
  const P = `${term(Pc[2], `a${SUP[2]}`)}${term(Pc[1], "a")}${term(Pc[0], "")}`.trim()
  return item({
    text: `${HEAD_A}\n\n(${L})${SUP[2]} ${MINUS} (${S})(${L}) ${P} = 0\n\nимеет ровно два различных решения.`,
    set,
    solution: `ОДЗ: x + a > 0 и x ${MINUS} a > 0, то есть x > |a|. Обозначим t = ${L} = log⟦b:2⟧${fT("x + a", `x ${MINUS} a`)}.\n`
      + `При a > 0 дробь (x + a)/(x ${MINUS} a) убывает от +∞ до 1, поэтому t пробегает всю полупрямую (0; +∞), причём каждому t отвечает ровно один x. `
      + `При a < 0 та же дробь растёт от 0 до 1, и t пробегает (${MINUS}∞; 0). При a = 0 всегда t = 0, а свободный член ${nS(be * de)} ≠ 0 — решений нет.\n`
      + `Квадратное уравнение по t раскладывается: t = ${al === 1 ? "" : al}a${term(be, "")} или t = ${ga === 1 ? "" : ga}a${term(de, "")}.\n`
      + `Значит решений ровно два ⟺ эти значения различны и оба лежат в нужной полупрямой (положительны при a > 0, отрицательны при a < 0).\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 2 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => al * a + be, label: `t = ${al === 1 ? "" : al}a${term(be, "")}` },
        { f: (a) => ga * a + de, label: `t = ${ga === 1 ? "" : ga}a${term(de, "")}` },
        { f: () => 0, dash: true, label: "t = 0" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 8, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// =============================================================================
// РАЗДЕЛ O/R (продолжение). |kt − a| − |t + ma| = t² на полупрямой (эталон #121, #154)
// =============================================================================
// Обе задачи — одно и то же уравнение в разных «одеждах»: показательной (#121, t = bˣ)
// и логарифмической (#154, t = log₀,₅x). Модули режут полупрямую точками t = a/k и t = −ma,
// а на каждом куске остаётся обычный квадратный трёхчлен — ровно то, для чего есть механизм
// pieces (число корней считается Штурмом, точно).
function absAbsPieces({ k, m, lo, incLo }) {
  return (a) => {
    const cuts = uniqSorted([Rdiv(a, R(k)), Rmul(R(-m), a)]).filter((b) => Rcmp(b, lo) > 0)
    const ivs = []
    let prev = lo, prevInc = incLo
    for (const c of cuts) { ivs.push({ lo: prev, hi: c, incLo: prevInc, incHi: false }); prev = c; prevInc = true }
    ivs.push({ lo: prev, hi: "+inf", incLo: prevInc, incHi: false })
    return ivs.map((iv) => {
      const mid = iv.hi === "+inf" ? Radd(iv.lo, R1) : Rdiv(Radd(iv.lo, iv.hi), R(2))
      const s1 = Rsign(Rsub(Rmul(R(k), mid), a)) >= 0 ? 1 : -1      // знак kt − a
      const s2 = Rsign(Radd(mid, Rmul(R(m), a))) >= 0 ? 1 : -1      // знак t + ma
      // s₁(kt − a) − s₂(t + ma) − t² = 0
      return { N: [Rmul(Rneg(a), R(s1 + s2 * m)), R(s1 * k - s2), R(-1)], ...iv }
    })
  }
}
// Критические значения: концы кусков наезжают на начало полупрямой, точки излома сливаются,
// корень попадает на излом или на начало, дискриминант куска обращается в нуль.
function absAbsCrit({ k, m, lo }) {
  const crit = [R0, Rmul(R(k), lo), Rdiv(Rneg(lo), R(m))]
  for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
    const A = -(s1 + s2 * m), B = s1 * k - s2
    // корень на конце полупрямой: −a(s₁ + s₂m) + (s₁k − s₂)·lo − lo² = 0
    if (A !== 0) crit.push(Rdiv(Rsub(Rmul(Rmul(lo, lo), R1), Rmul(R(B), lo)), R(A)))
    // нулевой дискриминант: B² − 4a(s₁ + s₂m) = 0
    if (s1 + s2 * m !== 0) crit.push(R(B * B, 4 * (s1 + s2 * m)))
    // корень в самой точке излома t = a/k и t = −ma
    for (const [pn, pd] of [[1, k], [-m, 1]]) {
      // N(pa) = −a(s₁+s₂m) + B·(p·a) − (p·a)² = 0 → a(−(s₁+s₂m) + Bp − p²a) = 0
      const p = R(pn, pd)
      const c1 = Radd(R(A), Rmul(R(B), p))
      if (!Rzero(p)) crit.push(Rdiv(c1, Rmul(p, p)))
    }
  }
  return crit
}
const DEC = { 2: ["0,5", "0,25"], 5: ["0,2", "0,04"], 10: ["0,1", "0,01"] }

// #121. |k·b·(1/b)^{1−x} − a| − |bˣ + ma| = (1/b²)^{−x} — «ровно два неотрицательных решения».
// Замена t = bˣ; неотрицательные x — это в точности t ≥ 1, а (1/b²)^{−x} = t².
function build121({ k, m, b }) {
  const lo = R1
  const pieces = absAbsPieces({ k, m, lo, incLo: true })
  const solve = (a) => solveCount(pieces, a)
  return { set: assembleSet((a) => solve(a) === 2, absAbsCrit({ k, m, lo })), pieces, solve, b }
}
const T121 = []
for (const k of [1, 2, 3]) for (const m of [1, 2, 3]) for (const b of [2, 5, 10]) {
  const r = build121({ k, m, b })
  if (r && tidySet(r.set, 3)) T121.push({ k, m, b })
}
export function t18ExpAbsAbsTwo() {
  const par = pick(T121), { k, m, b } = par
  const { set, pieces } = build121(par)
  const aRange = spanRange(set)
  const [d1, d2] = DEC[b]
  return item({
    text: `${HEAD_A}\n\n|${k * b}·${d1}${supT(`1 ${MINUS} x`)} ${MINUS} a| ${MINUS} |${b}${supT("x")} + ${m === 1 ? "" : m}a| = ${d2}${supT(`${MINUS}x`)}\n\n`
      + `имеет ровно два неотрицательных решения.`,
    set,
    solution: `Заметим, что ${d1}${supT(`1 ${MINUS} x`)} = ${b}${supT(`x ${MINUS} 1`)}, поэтому ${k * b}·${d1}${supT(`1 ${MINUS} x`)} = ${k === 1 ? "" : k}·${b}${supT("x")}, а ${d2}${supT(`${MINUS}x`)} = ${b * b}${supT("x")} = (${b}${supT("x")})${SUP[2]}.\n`
      + `Обозначим t = ${b}${supT("x")}; неотрицательные x — это в точности t ≥ 1. Уравнение принимает вид |${k === 1 ? "" : k}t ${MINUS} a| ${MINUS} |t + ${m === 1 ? "" : m}a| = t${SUP[2]}.\n`
      + `Модули меняют знак в точках t = ${fT("a", String(k))} и t = ${MINUS}${m === 1 ? "" : m}a, между ними уравнение — обычное квадратное.\n`
      + `Разбирая куски полупрямой [1; +∞) и следя, когда корень заходит на излом или на её начало, получаем ответ.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [0, 6],
      F: (a) => (x) => {
        const t = b ** x
        return Math.abs(k * t - a) - Math.abs(t + m * a) - t * t
      },
      sols: (a) => {
        const out = []
        for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
          for (const t of numQuad(-1, s1 * k - s2, -a * (s1 + s2 * m))) {
            if (t < 1 - 1e-12) continue
            if (Math.sign(k * t - a || s1) !== s1 && Math.abs(k * t - a) > 1e-9) continue
            if (Math.sign(t + m * a || s2) !== s2 && Math.abs(t + m * a) > 1e-9) continue
            const x = Math.log(t) / Math.log(b)
            if (!out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
          }
        }
        return out
      },
    },
    predicate: { type: "count", n: 2 },
    pieces,
    aRange,
    picture: {
      curves: [
        { f: (a) => a / k, dash: true, label: "t = a/k" },
        { f: (a) => -m * a, dash: true, label: "t = −ma" },
        { f: () => 1, dash: true, label: "t = 1" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2, xMax: 8, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #154. |log₀,₅(x²) − a| − |log₀,₅x + ma| = (log₀,₅x)² — «есть решение, меньшее C».
// Замена t = log₀,₅x (ОДЗ x > 0): log₀,₅(x²) = 2t, а условие x < C равносильно t > log₀,₅C.
function build154({ m, lo }) {
  const pieces = absAbsPieces({ k: 2, m, lo: R(lo), incLo: false })
  const solve = (a) => solveCount(pieces, a)
  return { set: assembleSet((a) => solve(a) >= 1, absAbsCrit({ k: 2, m, lo: R(lo) })), pieces, solve }
}
const T154 = []
for (const m of [1, 2, 3]) for (const lo of [-2, -1, 0, 1]) {
  const r = build154({ m, lo })
  if (r && tidySet(r.set, 3)) T154.push({ m, lo })
}
export function t18LogAbsAbsExists() {
  const par = pick(T154), { m, lo } = par
  const { set, pieces } = build154(par)
  const aRange = spanRange(set)
  const C = 2 ** -lo
  const Cs = Number.isInteger(C) ? String(C) : String(C).replace(".", ",")
  const lg = "log⟦b:0,5⟧"
  return item({
    text: `${HEAD_A}\n\n|${lg}(x${SUP[2]}) ${MINUS} a| ${MINUS} |${lg}x + ${m === 1 ? "" : m}a| = (${lg}x)${SUP[2]}\n\n`
      + `имеет хотя бы одно решение, меньшее ${Cs}.`,
    set,
    solution: `ОДЗ: x > 0. Обозначим t = ${lg}x; тогда ${lg}(x${SUP[2]}) = 2t, а условие x < ${Cs} равносильно t > ${nS(lo)} (логарифм по основанию 0,5 убывает).\n`
      + `Уравнение принимает вид |2t ${MINUS} a| ${MINUS} |t + ${m === 1 ? "" : m}a| = t${SUP[2]}.\n`
      + `Модули меняют знак в точках t = ${fT("a", "2")} и t = ${MINUS}${m === 1 ? "" : m}a; между ними уравнение квадратное, поэтому достаточно на каждом куске полупрямой (${nS(lo)}; +∞) посчитать корни и проверить, остался ли хоть один.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [1e-6, C],
      F: (a) => (x) => {
        if (x <= 0) return null
        const t = Math.log(x) / Math.log(0.5)
        return Math.abs(2 * t - a) - Math.abs(t + m * a) - t * t
      },
      sols: (a) => {
        const out = []
        for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
          for (const t of numQuad(-1, 2 * s1 - s2, -a * (s1 + s2 * m))) {
            if (t <= lo + 1e-12) continue
            if (Math.abs(2 * t - a) > 1e-9 && Math.sign(2 * t - a) !== s1) continue
            if (Math.abs(t + m * a) > 1e-9 && Math.sign(t + m * a) !== s2) continue
            const x = 0.5 ** t
            if (!out.some((y) => Math.abs(y - x) < 1e-12)) out.push(x)
          }
        }
        return out
      },
    },
    predicate: { type: "exists" },
    pieces,
    aRange,
    picture: {
      curves: [
        { f: (a) => a / 2, dash: true, label: "t = a/2" },
        { f: (a) => -m * a, dash: true, label: "t = −ma" },
        { f: () => lo, dash: true, label: `t = ${nS(lo)}` },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: lo - 4, xMax: lo + 10, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #124. (c + |x + a|)³ − (c + |x + a|)² = (d − x² − 2ax − ka²)³ − (d − x² − 2ax − ka²)²
// — «хотя бы один корень». Функция φ(u) = u³ − u² возрастает при u ≥ 2/3, а слева u ≥ c ≥ 2,
// значит φ(u) ≥ 4 > 0; но φ(v) ≤ 0 при v ≤ 1, поэтому из равенства сразу следует v > 1 и,
// по инъективности φ на [2/3; +∞), u = v.
// Осталось c + y = d − y² − (k−1)a², где y = |x + a| ≥ 0, то есть y² + y + c − d + (k−1)a² = 0.
function build124({ c, k, r }) {
  const d = c + (k - 1) * r * r
  const solve = (a) => {
    const q = Radd(R(c - d), Rmul(R(k - 1), Rmul(a, a)))      // свободный член по y
    const s = Rsign(q)
    return s > 0 ? 0 : s === 0 ? 1 : 2
  }
  return { set: assembleSet((a) => solve(a) >= 1, [R(r), R(-r)]), solve, d }
}
const T124 = []
for (const c of [2, 3, 4]) for (const k of [2, 3, 4, 5]) for (const r of [1, 2, 3]) T124.push({ c, k, r })
export function t18MonoCubeSquareExists() {
  const par = pick(T124), { c, k, r } = par
  const { set, solve, d } = build124(par)
  const aRange = spanRange(set)
  const U = `${c} + |x + a|`
  const V = `${d} ${MINUS} x${SUP[2]} ${MINUS} 2ax ${MINUS} ${k === 1 ? "" : k}a${SUP[2]}`
  return item({
    text: `${HEAD_A}\n\n(${U})${SUP[3]} ${MINUS} (${U})${SUP[2]} = (${V})${SUP[3]} ${MINUS} (${V})${SUP[2]}\n\nимеет хотя бы один корень.`,
    set,
    solution: `Обе части — значения функции φ(u) = u${SUP[3]} ${MINUS} u${SUP[2]}. Она возрастает при u ≥ ${fT("2", "3")} (φ′(u) = u(3u ${MINUS} 2)) и неположительна при u ≤ 1.\n`
      + `Слева u = ${U} ≥ ${c}, поэтому φ(u) ≥ ${c * c * c - c * c} > 0. Значит и правая часть положительна, откуда v = ${V} > 1, а на промежутке [${fT("2", "3")}; +∞) функция φ обратима — остаётся u = v.\n`
      + `Заметим, что ${MINUS}x${SUP[2]} ${MINUS} 2ax ${MINUS} ${k === 1 ? "" : k}a${SUP[2]} = ${MINUS}(x + a)${SUP[2]} ${MINUS} ${k - 1 === 1 ? "" : k - 1}a${SUP[2]}. Обозначим y = |x + a| ≥ 0: ${c} + y = ${d} ${MINUS} y${SUP[2]} ${MINUS} ${k - 1 === 1 ? "" : k - 1}a${SUP[2]}, то есть y${SUP[2]} + y + ${k - 1 === 1 ? "" : k - 1}a${SUP[2]} ${MINUS} ${d - c} = 0.\n`
      + `Функция y${SUP[2]} + y возрастает при y ≥ 0 и равна нулю в нуле, поэтому подходящий y ≥ 0 существует ⟺ ${d - c} ${MINUS} ${k - 1 === 1 ? "" : k - 1}a${SUP[2]} ≥ 0 ⟺ |a| ≤ ${r}.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [-Math.abs(aRange[0]) - r - 2, Math.abs(aRange[1]) + r + 2],
      F: (a) => (x) => {
        const u = c + Math.abs(x + a), v = d - x * x - 2 * a * x - k * a * a
        return (u * u * u - u * u - (v * v * v - v * v)) / (1 + Math.abs(v) ** 3)
      },
      sols: (a) => {
        const q = c - d + (k - 1) * a * a
        if (q > 1e-12) return []
        const y = (-1 + Math.sqrt(1 - 4 * q)) / 2
        return y < 1e-9 ? [-a] : [-a - y, -a + y]
      },
    },
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => -a + (-1 + Math.sqrt(Math.max(0, 1 - 4 * (c - d + (k - 1) * a * a)))) / 2, label: "корни x(a)" },
        { f: (a) => -a - (-1 + Math.sqrt(Math.max(0, 1 - 4 * (c - d + (k - 1) * a * a)))) / 2 },
        { f: (a) => -a, dash: true, label: "x = −a" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -r - 6, xMax: r + 6, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// =============================================================================
// РАЗДЕЛ L (продолжение). Симметричные системы (эталон #86, #87, #89)
// =============================================================================

// #86. {x² + y² = ρ² + 2ax − a²; p²x² = q²y²} — «ровно четыре решения».
// Первое уравнение — окружность (x − a)² + y² = ρ² с бегущим по оси абсцисс центром,
// второе — пара прямых py = ±px/q, то есть px − qy = 0 и px + qy = 0.
// Расстояние от центра (a; 0) до каждой прямой равно |pa|/√(p² + q²); чтобы граница была
// рациональной, (p; q; h) берётся ПИФАГОРОВОЙ тройкой (h² = p² + q²), и тогда прямая
// пересекает окружность по двум точкам ровно при |a| < ρh/p.
// Единственная общая точка прямых — начало координат; если оно лежит на окружности
// (то есть |a| = ρ), четыре точки склеиваются в три.
function build86({ rho, p, q, h }) {
  if (p * p + q * q !== h * h) return null
  const bound = R(rho * h, p)
  const solve = (a) => {
    const aa = Rabs(a)
    const c = Rcmp(aa, bound)
    const perLine = c < 0 ? 2 : c === 0 ? 1 : 0
    const originOnCircle = Rcmp(aa, R(rho)) === 0 ? 1 : 0
    return 2 * perLine - originOnCircle
  }
  return { set: assembleSet((a) => solve(a) === 4, [bound, Rneg(bound), R(rho), R(-rho)]), solve, bound }
}
const T86 = []
for (const rho of [1, 2, 3, 4, 6]) for (const [p, q, h] of [[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17]]) {
  const r = build86({ rho, p, q, h })
  if (r && tidySet(r.set, 3)) T86.push({ rho, p, q, h })
}
export function t18SysCircleTwoLines() {
  const par = pick(T86), { rho, p, q, h } = par
  const { set, solve, bound } = build86(par)
  const aRange = spanRange(set)
  return item({
    text: `${HEAD_SYS}\n⟦cases:x${SUP[2]} + y${SUP[2]} = ${rho * rho} + 2ax ${MINUS} a${SUP[2]}¦${p * p === 1 ? "" : p * p}x${SUP[2]} = ${q * q === 1 ? "" : q * q}y${SUP[2]}⟧\n\nимеет ровно четыре различных решения.`,
    set,
    solution: `Первое уравнение — это (x ${MINUS} a)${SUP[2]} + y${SUP[2]} = ${rho * rho}: окружность радиуса ${rho} с центром (a; 0), бегущим по оси абсцисс.\n`
      + `Второе распадается на две прямые ${p === 1 ? "" : p}x ${MINUS} ${q === 1 ? "" : q}y = 0 и ${p === 1 ? "" : p}x + ${q === 1 ? "" : q}y = 0, пересекающиеся в начале координат.\n`
      + `Расстояние от центра до каждой прямой равно ${fT(`${p === 1 ? "" : p}|a|`, String(h))} (так как ${p}${SUP[2]} + ${q}${SUP[2]} = ${h}${SUP[2]}), поэтому каждая прямая даёт две точки ровно при |a| < ${Rstr(bound)}, одну при равенстве и ни одной дальше.\n`
      + `Итого четыре точки — когда обе прямые секущие и при этом начало координат НЕ лежит на окружности (иначе две пары точек склеиваются в три различные): |a| ≠ ${rho}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 4 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => a + rho, label: "окружность" },
        { f: (a) => a - rho },
        { f: () => 0, dash: true, label: "прямые пересекаются в O" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -rho - 6, xMax: rho + 6, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #87. {a(x⁴ + 1) = y + c − |x|; x² + y² = ρ²} — «единственное решение».
// Система ЧЁТНА по x, поэтому решения идут парами (x; y), (−x; y): единственное решение
// обязано иметь x = 0, а тогда y = a − c и y = ±ρ, то есть a = c ± ρ — всего два кандидата.
// Число решений считается точно: подстановка y = ax⁴ + a − c + |x| в окружность даёт
// многочлен восьмой степени по u = |x| ≥ 0, и корни считаются Штурмом (u = 0 — одно решение,
// каждый корень u > 0 — два).
function build87({ c, rho }) {
  const poly = (a) => {                                   // u² + (a u⁴ + (a − c) + u)² − ρ²
    const g = [Rsub(a, R(c)), R1, R0, R0, a]              // a u⁴ + u + (a − c)
    return pSub(pAdd([R0, R0, R1], pMul(g, g)), [R(rho * rho)])
  }
  const solve = (a) => {
    const P = pTrim(poly(a))
    if (!P.length) return 99                              // вырождение: годится любой x
    return (Rzero(pEval(P, R0)) ? 1 : 0) + 2 * countRoots(P, R0, "+inf", false, false)
  }
  return { set: assembleSet((a) => solve(a) === 1, [R(c + rho), R(c - rho)]), solve }
}
const T87 = []
for (const c of [1, 2, 3, 4, 5]) for (const rho of [1, 2, 3, 4]) {
  const r = build87({ c, rho })
  if (r && tidySet(r.set, 2)) T87.push({ c, rho })
}
export function t18SysQuarticCircleOne() {
  const par = pick(T87), { c, rho } = par
  const { set, solve } = build87(par)
  const aRange = spanRange(set)
  return item({
    text: `${HEAD_SYS}\n⟦cases:a(x⁴ + 1) = y + ${c} ${MINUS} |x|¦x${SUP[2]} + y${SUP[2]} = ${rho * rho}⟧\n\nимеет единственное решение.`,
    set,
    solution: `Обе строки не меняются при замене x на ${MINUS}x (входят только x⁴, |x| и x${SUP[2]}), поэтому вместе с (x; y) решением будет и (${MINUS}x; y). Значит единственное решение обязано иметь x = 0.\n`
      + `При x = 0 первое уравнение даёт a = y + ${c}, второе — y = ±${rho}. Отсюда только два кандидата: a = ${c + rho} и a = ${nS(c - rho)}.\n`
      + `Проверка. При a = ${c + rho} из первой строки y = ${c + rho}x⁴ + |x| + ${rho} ≥ ${rho}, а из окружности y ≤ ${rho}; равенство возможно лишь при x = 0, y = ${rho} — решение единственное.\n`
      + `При a = ${nS(c - rho)} кривая y = ${nS(c - rho)}x⁴ + |x| ${MINUS} ${rho} выходит из точки (0; ${MINUS}${rho}) круче, чем окружность, и пересекает её ещё в двух точках — решений три.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: () => 0, dash: true, label: "x = 0 (ось симметрии)" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -rho - 3, xMax: rho + 3, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #89. {y = (a+k)x² + 2ax + a+m; x = (a+k)y² + 2ay + a+m} — «ровно одно решение».
// Система симметрична относительно перестановки x ↔ y. Вычитая строки, получаем
// (y − x)·(1 + (a+k)(x+y) + 2a) = 0: решения либо на диагонали y = x, либо на прямой
// x + y = −(1+2a)/(a+k), причём вторые идут ПАРАМИ (x; y) и (y; x).
// Значит «ровно одно решение» — это ровно один корень диагонального уравнения
// (a+k)x² + (2a−1)x + (a+m) = 0 И отсутствие внедиагональных пар.
function build89({ k, m }) {
  const diag = (a) => [Radd(a, R(m)), Rsub(Rmul(R(2), a), R1), Radd(a, R(k))]
  const offDisc = (a) => Rsub(Rsub(Rmul(R(-4 * (1 + k + m)), a), R(3)), R(4 * k * m))
  const solve = (a) => {
    const D = countRoots(diag(a), "-inf", "+inf", false, false)
    if (Rcmp(a, R(-k)) === 0) return D                    // множитель 1 + 2a = 1 − 2k ≠ 0: вне диагонали решений нет
    return D + (Rsign(offDisc(a)) > 0 ? 2 : 0)
  }
  const crit = [R(-k), R(1 - 4 * k * m, 4 * (1 + k + m)), R(-3 - 4 * k * m, 4 * (1 + k + m))]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T89 = []
for (const k of [1, 2, 3, 4]) for (const m of [-3, -2, -1, 1, 2, 3]) {
  if (1 + k + m === 0) continue
  const r = build89({ k, m })
  if (r && tidySet(r.set, 3)) T89.push({ k, m })
}
export function t18SysSymmetricOne() {
  const par = pick(T89), { k, m } = par
  const { set, solve } = build89(par)
  const aRange = spanRange(set)
  const row = (u, v) => `${u} = (a + ${k})${v}${SUP[2]} + 2a${v} + a${term(m, "")}`
  return item({
    text: `${HEAD_SYS}\n⟦cases:${row("y", "x")}¦${row("x", "y")}⟧\n\nимеет ровно одно решение.`,
    set,
    solution: `Система симметрична: если (x; y) — решение, то и (y; x). Вычтем строки: y ${MINUS} x = (a + ${k})(x${SUP[2]} ${MINUS} y${SUP[2]}) + 2a(x ${MINUS} y), то есть (y ${MINUS} x)(1 + (a + ${k})(x + y) + 2a) = 0.\n`
      + `Значит либо y = x, либо x + y = ${MINUS}${fT("1 + 2a", `a + ${k}`)}; во втором случае решения идут парами (x; y) и (y; x), поэтому их всегда чётное число.\n`
      + `На диагонали: (a + ${k})x${SUP[2]} + (2a ${MINUS} 1)x + a${term(m, "")} = 0. Внедиагональные решения существуют, когда ${MINUS}${4 * (1 + k + m) === 1 ? "" : 4 * (1 + k + m)}a ${MINUS} ${3 + 4 * k * m} > 0.\n`
      + `Ровно одно решение — когда диагональное уравнение даёт ровно один корень (при a = ${MINUS}${k} оно линейное, а при a = ${Rstr(R(1 - 4 * k * m, 4 * (1 + k + m)))} его дискриминант равен нулю) и при этом внедиагональных пар нет.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => (a + k === 0 ? null : -(1 + 2 * a) / (2 * (a + k))), dash: true, label: "середина внедиагональной пары" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 8, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// =============================================================================
// РАЗДЕЛ K. Наибольшее/наименьшее значение функции (эталон #92, #93, #95, #97)
// =============================================================================
// Новый кирпич движка: ТОЧНЫЙ минимум (максимум) кусочно-квадратичной функции.
// Все функции раздела — это квадратный трёхчлен плюс модули многочленов с РАЦИОНАЛЬНЫМИ
// корнями, поэтому после разбиения оси точками излома на каждом куске стоит обычный
// квадратный трёхчлен над Q: экстремум ищется среди концов куска и вершины, а все
// сравнения — точные сравнения рациональных чисел (никаких ε).
// Предикат «наименьшее значение ⋚ C» подаётся в verify18 как индикатор (solve = 1/0)
// с типом exists — сетка по a всё равно проверяет его независимо.

// Минимум квадратного трёхчлена [c0, c1, c2] на промежутке (концы — R или ±inf).
// null означает −∞ (функция не ограничена снизу).
function quadMin(P, lo, hi) {
  const c0 = P[0] || R0, c1 = P[1] || R0, c2 = P[2] || R0
  const at = (x) => Radd(Radd(c0, Rmul(c1, x)), Rmul(c2, Rmul(x, x)))
  if (Rsign(c2) < 0 && (lo === "-inf" || hi === "+inf")) return null
  if (Rzero(c2)) {
    if (Rsign(c1) > 0 && lo === "-inf") return null
    if (Rsign(c1) < 0 && hi === "+inf") return null
    if (Rzero(c1) && lo === "-inf" && hi === "+inf") return c0
  }
  const cands = []
  if (lo !== "-inf") cands.push(at(lo))
  if (hi !== "+inf") cands.push(at(hi))
  if (Rsign(c2) > 0) {
    const v = Rdiv(Rneg(c1), Rmul(R(2), c2))
    if ((lo === "-inf" || Rcmp(v, lo) >= 0) && (hi === "+inf" || Rcmp(v, hi) <= 0)) cands.push(at(v))
  }
  if (!cands.length) return null
  return cands.reduce((m, x) => (Rcmp(x, m) < 0 ? x : m))
}
const quadMax = (P, lo, hi) => {
  const m = quadMin(P.map(Rneg), lo, hi)
  return m === null ? null : Rneg(m)
}
// Экстремум кусочно-квадратичной функции: pieces = [{ P, lo, hi }] (куски замкнутые,
// функция непрерывна, поэтому дублирование концов безвредно). null = не ограничена.
function pwExtreme(pieces, kind) {
  let best = null
  for (const pc of pieces) {
    const v = kind === "min" ? quadMin(pc.P, pc.lo, pc.hi) : quadMax(pc.P, pc.lo, pc.hi)
    if (v === null) return null
    if (best === null || (kind === "min" ? Rcmp(v, best) < 0 : Rcmp(v, best) > 0)) best = v
  }
  return best
}
const HEAD_MAX = "Найдите все значения a, при каждом из которых наибольшее значение функции"
const HEAD_MIN = "Найдите все значения a, при каждом из которых наименьшее значение функции"
const cmpStr = { ge: "не меньше", gt: "больше", le: "не больше", lt: "меньше" }
const cmpOk = (v, C, how) => {
  if (v === null) return how === "gt" || how === "ge" ? false : true   // −∞ меньше любого числа
  const c = Rcmp(v, C)
  return how === "ge" ? c >= 0 : how === "gt" ? c > 0 : how === "le" ? c <= 0 : c < 0
}

// #92. f(x) = |x − a| − kx² — «наибольшее значение не меньше C».
// Точка излома одна (x = a), на каждом куске — парабола ветвями вниз, поэтому максимум
// достигается в вершине (если она попала на кусок) или в точке излома.
function build92({ k, C }) {
  const pieces = (a) => [
    { P: [a, R(-1), R(-k)], lo: "-inf", hi: a },        // x ≤ a: (a − x) − kx²
    { P: [Rneg(a), R1, R(-k)], lo: a, hi: "+inf" },     // x ≥ a: (x − a) − kx²
  ]
  const solve = (a) => (cmpOk(pwExtreme(pieces(a), "max"), C, "ge") ? 1 : 0)
  // критические значения: вершина ±1/(2k) уходит со своего куска; значение в вершине
  // 1/(4k) ± a равно C; значение в самой точке излома −ka² равно C
  const crit = [R(1, 2 * k), R(-1, 2 * k), Rsub(C, R(1, 4 * k)), Rneg(Rsub(C, R(1, 4 * k)))]
  const sq = ratRoots([Rneg(C), R0, R(-k)])
  if (!sq.allRational) return null
  crit.push(...sq.roots)
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T92 = []
for (const k of [1, 2, 3, 4]) for (const Cn of [-2, -1, 1, 2, 3, 4]) {
  const r = build92({ k, C: R(Cn) })
  if (r && tidySet(r.set, 3)) T92.push({ k, C: R(Cn) })
}
export function t18MaxAbsMinusSquare() {
  const par = pick(T92), { k, C } = par
  const { set, solve } = build92(par)
  const aRange = spanRange(set)
  return item({
    text: `${HEAD_MAX}\n\nf(x) = |x ${MINUS} a| ${MINUS} ${k === 1 ? "" : k}x${SUP[2]}\n\n${cmpStr.ge} ${Rstr(C)}.`,
    set,
    solution: `Точка излома одна — x = a. При x ≥ a получаем f(x) = ${MINUS}${k === 1 ? "" : k}x${SUP[2]} + x ${MINUS} a (парабола ветвями вниз с вершиной x = ${Rstr(R(1, 2 * k))}), при x ≤ a — f(x) = ${MINUS}${k === 1 ? "" : k}x${SUP[2]} ${MINUS} x + a (вершина x = ${Rstr(R(-1, 2 * k))}).\n`
      + `Если вершина попадает на свой кусок, значение в ней равно ${Rstr(R(1, 4 * k))} ${MINUS} a (правая ветвь) или ${Rstr(R(1, 4 * k))} + a (левая); иначе максимум куска достигается в точке излома, где f(a) = ${MINUS}${k === 1 ? "" : k}a${SUP[2]}.\n`
      + `Хотя бы одна из вершин всегда «своя», поэтому наибольшее значение равно ${Rstr(R(1, 4 * k))} + |a|.\n`
      + `Условие ${Rstr(R(1, 4 * k))} + |a| ≥ ${Rstr(C)} даёт ответ.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => a, dash: true, label: "x = a (излом)" },
        { f: () => 1 / (2 * k), dash: true, label: "вершины ±1/(2k)" },
        { f: () => -1 / (2 * k), dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -6, xMax: 6, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #93. f(x) = (kx − a)² + pa + q на множестве |x| ≥ r — «наименьшее значение ⋚ C».
// Модулей нет: два замкнутых луча, на каждом — парабола ветвями вверх с общей вершиной x = a/k.
function build93({ k, p, q, r, C, how }) {
  const P = (a) => [Radd(Radd(Rmul(a, a), Rmul(R(p), a)), R(q)), Rmul(R(-2 * k), a), R(k * k)]
  const pieces = (a) => [
    { P: P(a), lo: "-inf", hi: R(-r) },
    { P: P(a), lo: R(r), hi: "+inf" },
  ]
  const solve = (a) => (cmpOk(pwExtreme(pieces(a), "min"), C, how) ? 1 : 0)
  const crit = [R(k * r), R(-k * r)]                        // вершина a/k выходит за |x| ≥ r
  if (p !== 0) crit.push(R(C.n - BigInt(q) * C.d, C.d * BigInt(p)))   // pa + q = C
  for (const s of [1, -1]) {                                 // (kr ∓ a)² + pa + q = C
    const e = ratRoots([Rsub(Radd(R(k * k * r * r + q), R0), C), R(p + 2 * s * k * r), R1])
    if (!e.allRational) return null
    crit.push(...e.roots)
  }
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T93 = []
for (const k of [1, 2]) for (const p of [1, 2]) for (const q of [1, 2, 3]) for (const r of [1, 2]) {
  for (const Cn of [2, 4, 6, 8]) for (const how of ["ge", "lt"]) {
    const r2 = build93({ k, p, q, r, C: R(Cn), how })
    if (r2 && tidySet(r2.set, 3)) T93.push({ k, p, q, r, C: R(Cn), how })
  }
}
export function t18MinQuadOutside() {
  const par = pick(T93), { k, p, q, r, C, how } = par
  const { set, solve } = build93(par)
  const aRange = spanRange(set)
  const f = `${k * k === 1 ? "" : k * k}x${SUP[2]} ${MINUS} ${2 * k === 1 ? "" : 2 * k}ax + a${SUP[2]}${term(p, "a")}${term(q, "")}`
  return item({
    text: `${HEAD_MIN}\n\nf(x) = ${f}\n\nна множестве |x| ≥ ${r} ${cmpStr[how]} ${Rstr(C)}.`,
    set,
    solution: `Соберём полный квадрат: f(x) = (${k === 1 ? "" : k}x ${MINUS} a)${SUP[2]}${term(p, "a")}${term(q, "")}. Это парабола ветвями вверх с вершиной x = ${fT("a", String(k))} и наименьшим значением ${p === 1 ? "" : p}a${term(q, "")}.\n`
      + `Если вершина принадлежит множеству |x| ≥ ${r} (то есть |a| ≥ ${k * r}), наименьшее значение и равно ${p === 1 ? "" : p}a${term(q, "")}.\n`
      + `Иначе минимум достигается на ближайшем конце x = ±${r} и равен (${k * r} ${MINUS} a)${SUP[2]}${term(p, "a")}${term(q, "")} или (${k * r} + a)${SUP[2]}${term(p, "a")}${term(q, "")} — меньшем из двух.\n`
      + `Остаётся сравнить полученное значение с ${Rstr(C)}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => a / k, label: "вершина x = a/k" },
        { f: () => r, dash: true, label: `|x| ≥ ${r}` },
        { f: () => -r, dash: true },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -r - 5, xMax: r + 5, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #95 и #97. f(x) = (αa + β)x + γa + δ + |x² − px + q| — «наименьшее значение ⋚ C».
// Квадратный трёхчлен под модулем имеет РАЦИОНАЛЬНЫЕ корни r₁ < r₂, поэтому ось делится
// на три куска. На крайних кусках парабола ветвями вверх (минимум — вершина или конец),
// на среднем — ветвями вниз (минимум на конце). В обеих точках излома модуль равен нулю,
// поэтому f(rᵢ) — линейная функция a: именно она обычно и даёт минимум.
function build9597({ al, be, ga, de, r1, r2, C, how }) {
  const p = r1 + r2, q = r1 * r2
  const lin = (a) => Radd(Rmul(R(al), a), R(be))                   // коэффициент при x
  const con = (a) => Radd(Rmul(R(ga), a), R(de))                   // свободный член
  const pieces = (a) => {
    const L = lin(a), K = con(a)
    const up = [Radd(K, R(q)), Rsub(L, R(p)), R1]                  // x² − px + q ≥ 0
    const dn = [Rsub(K, R(q)), Radd(L, R(p)), R(-1)]               // x² − px + q ≤ 0
    return [
      { P: up, lo: "-inf", hi: R(r1) },
      { P: dn, lo: R(r1), hi: R(r2) },
      { P: up, lo: R(r2), hi: "+inf" },
    ]
  }
  const solve = (a) => (cmpOk(pwExtreme(pieces(a), "min"), C, how) ? 1 : 0)
  const crit = []
  for (const r of [r1, r2]) {                                      // f(r) = C — линейно по a
    const A = al * r + ga, B = be * r + de
    if (A !== 0) crit.push(Rdiv(Rsub(C, R(B)), R(A)))
    if (al !== 0) crit.push(R(p - 2 * r - be, al))                 // вершина крайнего куска в точке r
  }
  // значение в вершине крайнего куска: (q + γa + δ) − (αa + β − p)²/4 = C
  const B0 = [Rsub(R(be - p), R0), R(al)]                          // αa + (β − p)
  const V = pSub([Radd(R(q + de), R0), R(ga)], pMul([R(1, 4)], pMul(B0, B0)))
  const e = ratRoots(pSub(V, [C]))
  if (!e.allRational) return null
  crit.push(...e.roots)
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T9597 = []
for (const [r1, r2] of [[-1, 2], [1, 5], [-2, 1], [0, 3], [-3, -1], [2, 4]]) {
  for (const al of [1, 2, 4]) for (const be of [0]) for (const ga of [-2, 0, 2]) for (const de of [-1, 0, 1]) {
    for (const Cn of [-24, -8, -4, -2, 0, 2]) for (const how of ["gt", "lt"]) {
      const r = build9597({ al, be, ga, de, r1, r2, C: R(Cn), how })
      if (r && tidySet(r.set, 3)) T9597.push({ al, be, ga, de, r1, r2, C: R(Cn), how })
    }
  }
}
export function t18MinLinPlusAbsQuad() {
  const par = pick(T9597), { al, be, ga, de, r1, r2, C, how } = par
  const { set, solve } = build9597(par)
  const aRange = spanRange(set)
  const p = r1 + r2, q = r1 * r2
  const linTxt = `${al === 1 ? "" : al}a${be === 0 ? "" : term(be, "")}x`
  const conTxt = `${ga === 0 ? "" : term(ga, "a")}${de === 0 ? "" : term(de, "")}`
  const quad = `x${SUP[2]}${term(-p, "x")}${term(q, "")}`
  return item({
    text: `${HEAD_MIN}\n\nf(x) = ${linTxt}${conTxt} + |${quad}|\n\n${cmpStr[how]} ${Rstr(C)}.`,
    set,
    solution: `Трёхчлен под модулем раскладывается: ${quad} = (x ${MINUS} ${nS(r1)})(x ${MINUS} ${nS(r2)}), поэтому точки излома — x = ${nS(r1)} и x = ${nS(r2)}.\n`
      + `Вне отрезка [${nS(r1)}; ${nS(r2)}] функция равна x${SUP[2]} + (${linTxt.replace("x", "")} ${MINUS} ${p === 1 ? "" : nS(p)})x + ${nS(q)}${conTxt} — парабола ветвями ВВЕРХ; внутри отрезка знак модуля меняется, и парабола идёт ветвями ВНИЗ, значит там минимум достигается на конце.\n`
      + `В самих точках излома модуль равен нулю: f(${nS(r1)}) и f(${nS(r2)}) — линейные функции a.\n`
      + `Значит наименьшее значение — это меньшее из f(${nS(r1)}), f(${nS(r2)}) и значения в вершине крайнего куска (если вершина действительно лежит вне отрезка).\n`
      + `Сравнивая его с ${Rstr(C)}, получаем ответ.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: () => r1, dash: true, label: `x = ${nS(r1)}` },
        { f: () => r2, dash: true, label: `x = ${nS(r2)}` },
        { f: (a) => (p - (al * a + be)) / 2, label: "вершина крайнего куска" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: Math.min(r1, 0) - 5, xMax: r2 + 5, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// ── Точки экстремума кусочно-квадратичной функции (эталон #90, #91) ──────────
// Второй кирпич к quadMin/pwExtreme: локальные экстремумы непрерывной кусочно-квадратичной
// функции бывают только двух сортов — вершина параболы СТРОГО внутри своего куска и точка
// стыка, в которой производная меняет знак. Всё считается точно: знак односторонней
// производной в точке стыка — это знак 2c₂x₀ + c₁, а если он нулевой, то знак определяется
// направлением ветвей (слева от стыка производная ведёт себя как −2c₂ε).
function countExtrema(pieces) {
  let total = 0, maxima = 0
  for (const pc of pieces) {
    const c2 = pc.P[2] || R0, c1 = pc.P[1] || R0
    if (Rzero(c2)) continue
    const v = Rdiv(Rneg(c1), Rmul(R(2), c2))
    const inLo = pc.lo === "-inf" || Rcmp(v, pc.lo) > 0
    const inHi = pc.hi === "+inf" || Rcmp(v, pc.hi) < 0
    if (inLo && inHi) { total++; if (Rsign(c2) < 0) maxima++ }
  }
  for (let i = 0; i + 1 < pieces.length; i++) {
    const x0 = pieces[i].hi
    const sgn = (P, side) => {
      const c2 = P[2] || R0, c1 = P[1] || R0
      const d = Radd(Rmul(Rmul(R(2), c2), x0), c1)
      return Rzero(d) ? (side === "left" ? -Rsign(c2) : Rsign(c2)) : Rsign(d)
    }
    const sL = sgn(pieces[i].P, "left"), sR = sgn(pieces[i + 1].P, "right")
    if (sL !== 0 && sR !== 0 && sL !== sR) { total++; if (sL > 0) maxima++ }
  }
  return { total, maxima }
}

// #90 и #91. f(x) = x² − c|x − a²| − kx — «более двух точек экстремума» / «есть точка максимума».
// Справа от излома f = x² − (k+c)x + ca² (вершина (k+c)/2), слева f = x² − (k−c)x − ca²
// (вершина (k−c)/2). Обе параболы ветвями вверх, поэтому ЕДИНСТВЕННЫЙ возможный максимум —
// сама точка излома x = a², и она же добавляет третий экстремум. Чтобы границы ответа были
// рациональными, берём (k−c)/2 = u² и (k+c)/2 = w², то есть k = u² + w², c = w² − u².
function build90({ u, w }) {
  const k = u * u + w * w, c = w * w - u * u
  const pieces = (a) => {
    const s = Rmul(a, a)
    return [
      { P: [Rneg(Rmul(R(c), s)), R(-(k - c)), R1], lo: "-inf", hi: s },
      { P: [Rmul(R(c), s), R(-(k + c)), R1], lo: s, hi: "+inf" },
    ]
  }
  const total = (a) => countExtrema(pieces(a)).total
  const maxima = (a) => countExtrema(pieces(a)).maxima
  const crit = [R0, R(u), R(-u), R(w), R(-w)]
  return {
    setTotal: assembleSet((a) => total(a) >= 3, crit),
    setMax: assembleSet((a) => maxima(a) >= 1, crit),
    total, maxima, k, c,
  }
}
const T90 = []
for (const u of [0, 1, 2, 3]) for (const w of [1, 2, 3, 4, 5]) {
  if (w <= u) continue
  const r = build90({ u, w })
  if (r && tidySet(r.setTotal, 3) && tidySet(r.setMax, 3)) T90.push({ u, w })
}
function item90(par, kind) {
  const { u, w } = par
  const { setTotal, setMax, total, maxima, k, c } = build90(par)
  const set = kind === "total" ? setTotal : setMax
  const aRange = spanRange(set)
  const f = `x${SUP[2]} ${MINUS} ${c === 1 ? "" : c}|x ${MINUS} a${SUP[2]}| ${MINUS} ${k === 1 ? "" : k}x`
  return item({
    text: `Найдите все значения a, при каждом из которых функция\n\nf(x) = ${f}\n\n`
      + (kind === "total" ? "имеет более двух точек экстремума." : "имеет хотя бы одну точку максимума."),
    set,
    solution: `При x ≥ a${SUP[2]} модуль раскрывается со знаком «+»: f(x) = x${SUP[2]} ${MINUS} ${k + c}x + ${c === 1 ? "" : c}a${SUP[2]} — парабола ветвями вверх с вершиной x = ${w * w}.\n`
      + `При x ≤ a${SUP[2]} получаем f(x) = x${SUP[2]} ${MINUS} ${k - c === 1 ? "" : k - c}x ${MINUS} ${c === 1 ? "" : c}a${SUP[2]} — вершина x = ${u * u}.\n`
      + `Вершина считается точкой экстремума, только если лежит СТРОГО внутри своего куска: ${u * u} < a${SUP[2]} для левой и ${w * w} > a${SUP[2]} для правой.\n`
      + `В самой точке излома x = a${SUP[2]} производная слева равна 2a${SUP[2]} ${MINUS} ${k - c}, справа — 2a${SUP[2]} ${MINUS} ${k + c}; знак меняется (с «+» на «−», то есть это МАКСИМУМ) ровно при ${u * u} < a${SUP[2]} < ${w * w}.\n`
      + `Обе параболы направлены ветвями вверх, поэтому других максимумов быть не может, а третий экстремум появляется вместе с изломом: ${u} < |a| < ${w}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: kind === "total" ? { type: "atLeast", n: 3 } : { type: "exists" },
    solve: (a) => (kind === "total" ? total(a) : maxima(a)),
    aRange,
    picture: {
      curves: [
        { f: (a) => a * a, label: "излом x = a²" },
        { f: () => u * u, dash: true, label: `вершина ${u * u}` },
        { f: () => w * w, dash: true, label: `вершина ${w * w}` },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -2, xMax: w * w + 4, aMin: aRange[0], aMax: aRange[1],
    },
  })
}
export function t18ExtremaCountAbs() { return item90(pick(T90), "total") }
export function t18MaxPointAbs() { return item90(pick(T90), "max") }

// =============================================================================
// РАЗДЕЛ N. Неравенства «при всех x» (эталон #116, #117, #118)
// =============================================================================
// Предикат «для всех x» сводится к точным сравнениям: для неравенства с положительным
// знаменателем — к отрицательности дискриминантов двух квадратных трёхчленов, а для
// неравенства на отрезке — к сравнению ТОЧНЫХ минимума и максимума (кирпич quadMin/quadMax)
// с границами. Ни один шаг не использует приближений.

// #116. |(x² + ax + c)/(px² + qx + r)| < M при всех x (знаменатель положительно определён).
// Неравенство равносильно паре «трёхчлен > 0 при всех x»:
// (Mp + 1)x² + (Mq + a)x + (Mr + c) > 0 и (Mp − 1)x² + (Mq − a)x + (Mr − c) > 0.
function build116({ M, p, q, r, c }) {
  if (q * q >= 4 * p * r) return null                  // знаменатель обязан быть положительным
  if (M * p <= 1) return null
  const D1 = 4 * (M * p + 1) * (M * r + c), D2 = 4 * (M * p - 1) * (M * r - c)
  if (D1 <= 0 || D2 <= 0 || isSq(D1) === null || isSq(D2) === null) return null
  const solve = (a) => {
    const t1 = Radd(a, R(M * q)), t2 = Rsub(a, R(M * q))
    const ok1 = Rcmp(Rmul(t1, t1), R(D1)) < 0
    const ok2 = Rcmp(Rmul(t2, t2), R(D2)) < 0
    return ok1 && ok2 ? 1 : 0
  }
  const crit = [R(-M * q + isSq(D1)), R(-M * q - isSq(D1)), R(M * q + isSq(D2)), R(M * q - isSq(D2))]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T116 = []
for (const M of [2, 3, 4, 5]) for (const p of [1, 2]) for (const q of [0, 1, 2]) for (const r of [1, 2, 3]) {
  for (const c of [1, 2, 3, 4]) {
    const res = build116({ M, p, q, r, c })
    if (res && tidySet(res.set, 2)) T116.push({ M, p, q, r, c })
  }
}
export function t18AllXFraction() {
  const par = pick(T116), { M, p, q, r, c } = par
  const { set, solve } = build116(par)
  const aRange = spanRange(set)
  const num = `x${SUP[2]} + ax${term(c, "")}`
  const den = `${p === 1 ? "" : p}x${SUP[2]}${q === 0 ? "" : term(q, "x")}${term(r, "")}`
  return item({
    text: `Найдите все значения a, при каждом из которых неравенство\n\n|${fT(num, den)}| < ${M}\n\nвыполняется при всех значениях x.`,
    set,
    solution: `Знаменатель положителен при всех x (его дискриминант ${q * q - 4 * p * r} < 0), поэтому неравенство равносильно двойному: ${MINUS}${M}(${den}) < ${num} < ${M}(${den}).\n`
      + `Правая часть даёт (${M * p - 1 === 1 ? "" : M * p - 1})x${SUP[2]} + (${M * q === 0 ? "" : `${M * q} ${MINUS} `}a)x${term(M * r - c, "")} > 0, левая — (${M * p + 1})x${SUP[2]} + (${M * q === 0 ? "" : `${M * q} + `}a)x${term(M * r + c, "")} > 0.\n`
      + `Оба трёхчлена имеют положительный старший коэффициент, поэтому каждое неравенство выполняется при всех x ровно тогда, когда его дискриминант отрицателен:\n`
      + `(a${term(M * q, "")})${SUP[2]} < ${4 * (M * p + 1) * (M * r + c)} и (a ${MINUS} ${M * q})${SUP[2]} < ${4 * (M * p - 1) * (M * r - c)}.\n`
      + `Пересекая полученные промежутки, получаем ответ.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [{ f: () => 0, dash: true, label: "дискриминанты < 0" }],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -4, xMax: 4, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #117 и #118. |x² − px + a + c| ≤ M на отрезке [a − L; a] (у #118 то же самое сказано как
// «неравенство |…| > M не имеет решений на отрезке»). Условие — это одновременно
// min ≥ −M и max ≤ M для квадратного трёхчлена на отрезке; оба считаются точно.
function build117({ p, c, L, M }, check = false) {
  const g = (a) => [Radd(a, R(c)), R(-p), R1]
  const solve = (a) => {
    const lo = Rsub(a, R(L)), hi = a
    const mn = quadMin(g(a), lo, hi), mx = quadMax(g(a), lo, hi)
    return Rcmp(mn, R(-M)) >= 0 && Rcmp(mx, R(M)) <= 0 ? 1 : 0
  }
  const crit = [R(p, 2), R(p + 2 * L, 2), R(p * p - 4 * c - 4 * M, 4)]     // вершина на концах; значение в вершине = −M
  for (const sh of [0, L]) for (const s of [1, -1]) {
    // (a − sh)² − p(a − sh) + a + c = sM  →  квадратное по a
    crit.push(...ratRoots([Radd(Rsub(R(sh * sh + c), R(s * M)), R(p * sh)), Radd(R(-2 * sh - p), R1), R1]).roots)
  }
  const set = assembleSet((a) => solve(a) === 1, crit)
  // Мини-сверка на месте: если у какого-то из четырёх уравнений корни иррациональны И
  // этот переход действительно работает, собранное множество разойдётся с предикатом.
  // Ловим это сразу сеткой шага 1/6 (полную сетку 1/100 потом прогоняет verify18).
  if (!set.intervals.length && !set.points.length) return null
  if (!setBounds(set).length) return null                  // «вся прямая» — вырождение
  if (!check) return { set, solve }
  const [lo, hi] = spanRange(set)          // тот же диапазон, что потом возьмёт verify18
  for (let k = lo * 6; k <= hi * 6; k++) {
    const a = R(k, 6)
    if (inSet(set, a) !== (solve(a) === 1)) return null
  }
  return { set, solve }
}
// Наборы (p, c, L, M) отобраны разовым перебором ЭТИМ ЖЕ движком: собранное множество
// совпало с предикатом на ТОЙ ЖЕ сетке шага 1/100, что потом гоняет verify18 (грубая
// сетка 1/6 пропускала переходы в иррациональных точках — у самого оригинала #117
// граница как раз иррациональна, (3 ± √69)/2).
const T117 = [
  [2, -10, 4, 10], [2, -6, 3, 6], [4, -14, 4, 14], [4, -14, 5, 14], [4, -14, 6, 14],
  [4, -14, 7, 14], [4, -8, 4, 10], [4, -4, 3, 6], [6, -10, 4, 14], [6, -10, 5, 14],
  [6, -10, 6, 14], [6, -10, 7, 14], [6, -4, 4, 10], [6, 0, 3, 6], [8, -12, 4, 18],
  [8, -10, 5, 20], [2, -12, 4, 8], [2, -12, 5, 8], [2, -12, 6, 8], [2, -12, 7, 8],
].map(([p, c, L, M]) => ({ p, c, L, M }))

function item117(par, kind) {
  const { p, c, L, M } = par
  const { set, solve } = build117(par)
  const aRange = spanRange(set)
  const g = `x${SUP[2]} ${MINUS} ${p === 1 ? "" : p}x + a${term(c, "")}`
  const seg = `[a ${MINUS} ${L}; a]`
  return item({
    text: `Найдите все значения a, при каждом из которых неравенство\n\n|${g}| ${kind === "all" ? "≤" : ">"} ${M}\n\n`
      + (kind === "all" ? `выполняется для всех x из отрезка ${seg}.` : `не имеет решений на отрезке ${seg}.`),
    set,
    solution: `Условие означает одно и то же: на всём отрезке ${seg} должно быть ${MINUS}${M} ≤ ${g} ≤ ${M}.\n`
      + `Функция g(x) = ${g} — парабола ветвями вверх с вершиной x = ${Rstr(R(p, 2))} и значением в вершине a${term(c, "")} ${MINUS} ${Rstr(R(p * p, 4))}.\n`
      + `Наибольшее значение на отрезке достигается на одном из его концов, наименьшее — в вершине, если она попала на отрезок (то есть при ${Rstr(R(p, 2))} ≤ a ≤ ${Rstr(R(p + 2 * L, 2))}), иначе тоже на ближайшем конце.\n`
      + `Остаётся потребовать, чтобы наименьшее значение было не меньше ${MINUS}${M}, а наибольшее — не больше ${M}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => a, dash: true, label: "правый конец x = a" },
        { f: (a) => a - L, dash: true, label: `левый конец x = a ${MINUS} ${L}` },
        { f: () => p / 2, label: "вершина" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -L - 4, xMax: L + 6, aMin: aRange[0], aMax: aRange[1],
    },
  })
}
export function t18AllXSegment() { return item117(pick(T117), "all") }
export function t18NoSolSegment() { return item117(pick(T117), "none") }

// ── Два модуля сразу: k|x + a| + |x² − px + q| и x − 2|x| + |(x−a)(x−a−2)| (эталон #94, #96) ──
// Точки излома здесь ЗАВИСЯТ от a, поэтому куски собираются заново при каждом a, а знаки
// модулей определяются подстановкой середины куска. Дальше — тот же quadMin.

// #94. f(x) = k|x + a| + |x² − px + q| — «наименьшее значение ⋚ C».
function pieces94(a, { k, r1, r2 }) {
  const p = r1 + r2, q = r1 * r2
  const cuts = uniqSorted([Rneg(a), R(r1), R(r2)])
  const bs = ["-inf", ...cuts, "+inf"]
  const out = []
  for (let i = 0; i + 1 < bs.length; i++) {
    const lo = bs[i], hi = bs[i + 1]
    const mid = lo === "-inf" ? Rsub(hi, R1) : hi === "+inf" ? Radd(lo, R1) : Rdiv(Radd(lo, hi), R(2))
    const s1 = Rsign(Radd(mid, a)) >= 0 ? 1 : -1
    const s2 = Rsign(Radd(Rsub(Rmul(mid, mid), Rmul(R(p), mid)), R(q))) >= 0 ? 1 : -1
    out.push({ P: [Radd(R(s2 * q), Rmul(R(k * s1), a)), R(-s2 * p + k * s1), R(s2)], lo, hi })
  }
  return out
}
function build94({ k, r1, r2, C, how }) {
  const p = r1 + r2, q = r1 * r2
  const solve = (a) => (cmpOk(pwExtreme(pieces94(a, { k, r1, r2 }), "min"), C, how) ? 1 : 0)
  const crit = [R(-r1), R(-r2)]
  // f(−a) = |a² + pa + q| = C — уравнение имеет смысл только при C ≥ 0
  if (Rsign(C) >= 0) for (const s of [1, -1]) {
    const e = ratRoots([Rsub(R(q), Rmul(R(s), C)), R(p), R1])
    if (!e.allRational) return null
    crit.push(...e.roots)
  }
  for (const r of [r1, r2]) for (const s of [1, -1]) crit.push(Radd(R(-r), Rmul(R(s), Rdiv(C, R(k)))))
  for (const s1 of [1, -1]) {                                  // вершина куска с ветвями вверх
    const c1 = k * s1 - p
    crit.push(R(-c1, 2))                                       // −a = вершина
    crit.push(Rdiv(Rsub(Radd(C, R(c1 * c1, 4)), R(q)), R(k * s1)))
  }
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T94 = []
for (const k of [1, 2, 3, 4]) for (const [r1, r2] of [[-1, 2], [1, 5], [-2, 1], [0, 3], [-3, 1], [2, 4]]) {
  for (const Cn of [-4, -2, 0, 1, 2, 3, 4, 6]) for (const how of ["lt", "gt"]) {
    const r = build94({ k, r1, r2, C: R(Cn), how })
    if (r && tidySet(r.set, 3)) T94.push({ k, r1, r2, C: R(Cn), how })
  }
}
export function t18MinTwoAbs() {
  const par = pick(T94), { k, r1, r2, C, how } = par
  const { set, solve } = build94(par)
  const aRange = spanRange(set)
  const p = r1 + r2, q = r1 * r2
  const quad = `x${SUP[2]}${term(-p, "x")}${term(q, "")}`
  return item({
    text: `${HEAD_MIN}\n\nf(x) = ${k === 1 ? "" : k}|x + a| + |${quad}|\n\n${cmpStr[how]} ${Rstr(C)}.`,
    set,
    solution: `Точки излома: x = ${MINUS}a (первый модуль) и корни второго трёхчлена x = ${nS(r1)}, x = ${nS(r2)} (${quad} = (x ${MINUS} ${nS(r1)})(x ${MINUS} ${nS(r2)})).\n`
      + `Между соседними изломами f — обычный квадратный трёхчлен, поэтому её наименьшее значение достигается либо в точке излома, либо в вершине куска, направленного ветвями вверх.\n`
      + `В изломах: f(${MINUS}a) = |a${SUP[2]}${term(p, "a")}${term(q, "")}|, f(${nS(r1)}) = ${k === 1 ? "" : k}|a${term(r1, "")}|, f(${nS(r2)}) = ${k === 1 ? "" : k}|a${term(r2, "")}|.\n`
      + `Вершина куска, где оба модуля раскрыты со знаком «+» или «−», стоит в точке x = ${Rstr(R(p - k, 2))} либо x = ${Rstr(R(p + k, 2))}, и значение в ней линейно по a.\n`
      + `Сравнивая наименьшее из этих значений с ${Rstr(C)}, получаем ответ.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => -a, label: "x = −a" },
        { f: () => r1, dash: true, label: `x = ${nS(r1)}` },
        { f: () => r2, dash: true, label: `x = ${nS(r2)}` },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: Math.min(r1, 0) - 5, xMax: r2 + 5, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #96. f(x) = x − k|x| + |x² − 2(a+w)x + a² + 2wa| — «наименьшее значение ⋚ C».
// Второй модуль — это |(x − a)(x − a − 2w)|, поэтому изломы стоят в 0, a и a + 2w.
function pieces96(a, { k, w }) {
  const cuts = uniqSorted([R0, a, Radd(a, R(2 * w))])
  const bs = ["-inf", ...cuts, "+inf"]
  const out = []
  for (let i = 0; i + 1 < bs.length; i++) {
    const lo = bs[i], hi = bs[i + 1]
    const mid = lo === "-inf" ? Rsub(hi, R1) : hi === "+inf" ? Radd(lo, R1) : Rdiv(Radd(lo, hi), R(2))
    const s0 = Rsign(mid) >= 0 ? 1 : -1
    const s2 = Rsign(Rmul(Rsub(mid, a), Rsub(mid, Radd(a, R(2 * w))))) >= 0 ? 1 : -1
    const A2 = Radd(Rmul(a, a), Rmul(R(2 * w), a))                      // a² + 2wa
    out.push({
      P: [Rmul(R(s2), A2), Rsub(R(1 - k * s0), Rmul(R(s2), Radd(Rmul(R(2), a), R(2 * w)))), R(s2)],
      lo, hi,
    })
  }
  return out
}
function build96({ k, w, C, how }) {
  const solve = (a) => (cmpOk(pwExtreme(pieces96(a, { k, w }), "min"), C, how) ? 1 : 0)
  const crit = [R0, R(-2 * w)]
  // f(0) = |a² + 2wa| = C — только при C ≥ 0 (модуль отрицательным не бывает)
  if (Rsign(C) >= 0) for (const s of [1, -1]) {
    const e = ratRoots([Rneg(Rmul(R(s), C)), R(2 * w), R1])
    if (!e.allRational) return null
    crit.push(...e.roots)
  }
  // f(a) = a − k|a| = C и f(a + 2w) = (a + 2w) − k|a + 2w| = C
  for (const [sh, s] of [[0, 1], [0, -1], [2 * w, 1], [2 * w, -1]]) {
    const A = 1 - k * s
    if (A !== 0) crit.push(Rdiv(Rsub(Radd(C, R(k * s * sh)), R(sh)), R(A)))
  }
  for (const s0 of [1, -1]) {                                           // вершина куска (s₂ = +1)
    // c₁ = (1 − k·s₀) − (2a + 2w), вершина x = a + w − (1 − k·s₀)/2, значение = (a² + 2wa) − c₁²/4
    const t = 1 - k * s0, u = t - 2 * w
    crit.push(R(u, 2))                                                  // вершина совпала с нулём
    // значение в вершине равно a(2w + u) − u²/4 — оно ЛИНЕЙНО по a
    if (2 * w + u !== 0) crit.push(Rdiv(Radd(C, R(u * u, 4)), R(2 * w + u)))
  }
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T96 = []
for (const k of [2, 3, 4]) for (const w of [1, 2, 3]) for (const Cn of [-10, -8, -6, -5, -4, -3, -2, -1, 0, 2]) for (const how of ["gt", "lt"]) {
  const r = build96({ k, w, C: R(Cn), how })
  if (r && tidySet(r.set, 3)) T96.push({ k, w, C: R(Cn), how })
}
export function t18MinAbsPlusShifted() {
  const par = pick(T96), { k, w, C, how } = par
  const { set, solve } = build96(par)
  const aRange = spanRange(set)
  const quad = `x${SUP[2]} ${MINUS} 2(a${term(w, "")})x + a${SUP[2]}${term(2 * w, "a")}`
  return item({
    text: `${HEAD_MIN}\n\nf(x) = x ${MINUS} ${k === 1 ? "" : k}|x| + |${quad}|\n\n${cmpStr[how]} ${Rstr(C)}.`,
    set,
    solution: `Трёхчлен под вторым модулем раскладывается: ${quad} = (x ${MINUS} a)(x ${MINUS} a ${MINUS} ${2 * w}), поэтому изломы стоят в точках x = 0, x = a и x = a + ${2 * w}.\n`
      + `На каждом куске f — квадратный трёхчлен, значит минимум достигается либо в изломе, либо в вершине куска с ветвями вверх.\n`
      + `В изломах: f(0) = |a${SUP[2]}${term(2 * w, "a")}|, f(a) = a ${MINUS} ${k === 1 ? "" : k}|a|, f(a + ${2 * w}) = a + ${2 * w} ${MINUS} ${k === 1 ? "" : k}|a + ${2 * w}|.\n`
      + `Сравнивая наименьшее из значений с ${Rstr(C)}, получаем ответ.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => a, label: "x = a" },
        { f: (a) => a + 2 * w, label: `x = a + ${2 * w}` },
        { f: () => 0, dash: true, label: "x = 0" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 8, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// =============================================================================
// РАЗДЕЛ S. Оценочные «хотя бы один корень» (эталон #149, #150, #151)
// =============================================================================
// Общий приём: левая часть оценивается СНИЗУ, правая — СВЕРХУ, и обе оценки достигаются
// в одной и той же точке (x = 0 или x = u). Разность левой и правой части не меньше
// D(a) + (положительное)·|x|, поэтому корень существует ⟺ D(a) ≤ 0 — и это уже
// обычное неравенство с модулем по a, решаемое точно.

// #149. p|x − u| + q|x + a| ≤ √(ρ² − y²) − c — «существует хотя бы одна пара (x; y)».
// Правая часть не больше ρ − c (максимум при y = 0), левая — кусочно-линейная функция,
// её наименьшее значение считается точно тем же quadMin (трёхчлен с нулевым старшим членом).
function build149({ p, q, u, rho, c }) {
  if (rho <= c) return null
  const pieces = (a) => {
    const bs = uniqSorted([R(u), Rneg(a)])
    const out = []
    let prev = "-inf"
    for (const b of bs) { out.push({ lo: prev, hi: b }); prev = b }
    out.push({ lo: prev, hi: "+inf" })
    return out.map((iv) => {
      const mid = iv.lo === "-inf" ? Rsub(iv.hi, R1) : iv.hi === "+inf" ? Radd(iv.lo, R1) : Rdiv(Radd(iv.lo, iv.hi), R(2))
      const s1 = Rcmp(mid, R(u)) >= 0 ? 1 : -1                    // знак x − u
      const s2 = Rcmp(mid, Rneg(a)) >= 0 ? 1 : -1                 // знак x + a
      // p·s₁(x − u) + q·s₂(x + a)
      return { P: [Radd(R(-p * s1 * u), Rmul(R(q * s2), a)), R(p * s1 + q * s2), R0], lo: iv.lo, hi: iv.hi }
    })
  }
  const solve = (a) => {
    const m = pwExtreme(pieces(a), "min")
    return m !== null && Rcmp(m, R(rho - c)) <= 0 ? 1 : 0
  }
  const crit = []
  for (const s of [1, -1]) {                                       // q|u + a| = ρ − c и p|u + a| = ρ − c
    crit.push(Rsub(R(s * (rho - c), q), R(u)))
    crit.push(Rsub(R(s * (rho - c), p), R(u)))
  }
  crit.push(R(-u))
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T149 = []
for (const p of [3, 4, 5, 6]) for (const q of [1, 2, 3]) for (const u of [-2, -1, 1, 2, 3]) {
  for (const rho of [5, 10, 13]) for (const c of [1, 3, 5]) {
    if (q >= p) continue
    const r = build149({ p, q, u, rho, c })
    if (r && tidySet(r.set, 2)) T149.push({ p, q, u, rho, c })
  }
}
export function t18SumAbsUnderDisk() {
  const par = pick(T149), { p, q, u, rho, c } = par
  const { set, solve } = build149(par)
  const aRange = spanRange(set)
  return item({
    text: `Найдите все значения a, при каждом из которых существует хотя бы одна пара чисел (x; y), удовлетворяющая неравенству\n\n`
      + `${p === 1 ? "" : p}|x${term(-u, "")}| + ${q === 1 ? "" : q}|x + a| ≤ √{${rho * rho} ${MINUS} y${SUP[2]}} ${MINUS} ${c}.`,
    set,
    solution: `Правая часть определена при |y| ≤ ${rho} и не превосходит ${rho} ${MINUS} ${c} = ${rho - c} (наибольшее значение — при y = 0).\n`
      + `Левая часть — кусочно-линейная функция от x с изломами в точках x = ${nS(u)} и x = ${MINUS}a. Так как ${p} > ${q}, её наименьшее значение достигается в точке x = ${nS(u)} и равно ${q === 1 ? "" : q}|a${term(u, "")}|.\n`
      + `Значит пара (x; y) существует ⟺ ${q === 1 ? "" : q}|a${term(u, "")}| ≤ ${rho - c}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: () => u, dash: true, label: `x = ${nS(u)}` },
        { f: (a) => -a, dash: true, label: "x = −a" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: u - 6, xMax: u + 6, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #150 и #151. a² − pa + k√(αx² + β²) = u|x − va| − w|x| (и та же задача в «сдвинутой» записи).
// Слева √(αx² + β²) ≥ β, справа u|x − va| − w|x| ≤ uv|a| − (w − u)|x| (неравенство треугольника).
// Значит (левая − правая) ≥ D(a) + (w − u)|x|, где D(a) = a² − pa + kβ − uv|a|, причём при x = 0
// достигается равенство. Поэтому корень есть ⟺ D(a) ≤ 0: при D > 0 разность всюду положительна,
// а при D ≤ 0 она равна D в нуле и стремится к +∞ — по непрерывности корень найдётся.
function build150({ p, k, be, u, v, w }) {
  if (w <= u) return null
  const K = k * be, M = u * v
  const D = (a) => Rsub(Radd(Rsub(Rmul(a, a), Rmul(R(p), a)), R(K)), Rmul(R(M), Rabs(a)))
  const solve = (a) => (Rsign(D(a)) <= 0 ? 1 : 0)
  const e1 = ratRoots([R(K), R(-(p + M)), R1])                     // ветвь a ≥ 0
  const e2 = ratRoots([R(K), R(-(p - M)), R1])                     // ветвь a < 0
  if (!e1.allRational || !e2.allRational) return null
  const set = assembleSet((a) => solve(a) === 1, [R0, ...e1.roots, ...e2.roots])
  return { set, solve, K, M }
}
// Наборы (p, k, β, u, v, w) отобраны РАЗОВЫМ перебором: обе ветви неравенства
// a² − (p ± uv)a + kβ ≤ 0 обязаны иметь рациональные корни, ответ — круглый, и, главное,
// индикатор «D(a) ≤ 0» сверен ЧИСЛЕННО с обеими напечатанными записями уравнения
// (скан по x на [−400; 400] при 24 значениях a: наличие смены знака разности частей
// обязано совпасть с индикатором). Результат перебора зафиксирован литералом,
// чтобы импорт модуля оставался мгновенным.
const T150 = [
  [1, 1, 2, 1, 2, 4], [1, 1, 2, 1, 2, 6], [1, 1, 2, 1, 2, 8], [1, 1, 3, 1, 3, 4], [1, 1, 3, 1, 3, 6], [1, 1, 3, 1, 3, 8], [1, 1, 4, 1, 3, 4], [1, 1, 4, 1, 3, 6], [1, 1, 4, 1, 3, 8],
  [1, 1, 4, 1, 4, 4], [1, 1, 4, 1, 4, 6], [1, 1, 4, 1, 4, 8], [1, 1, 4, 2, 2, 4], [1, 1, 4, 2, 2, 6], [1, 1, 4, 2, 2, 8], [1, 1, 5, 1, 5, 4], [1, 1, 5, 1, 5, 6], [1, 1, 5, 1, 5, 8],
  [1, 2, 2, 1, 3, 4], [1, 2, 2, 1, 3, 6], [1, 2, 2, 1, 3, 8], [1, 2, 2, 1, 4, 4], [1, 2, 2, 1, 4, 6], [1, 2, 2, 1, 4, 8], [1, 2, 2, 2, 2, 4], [1, 2, 2, 2, 2, 6], [1, 2, 2, 2, 2, 8],
  [1, 2, 3, 1, 4, 4], [1, 2, 3, 1, 4, 6], [1, 2, 3, 1, 4, 8], [1, 2, 3, 2, 2, 4], [1, 2, 3, 2, 2, 6], [1, 2, 3, 2, 2, 8], [1, 2, 3, 2, 3, 4], [1, 2, 3, 2, 3, 6], [1, 2, 3, 2, 3, 8],
  [1, 2, 3, 3, 2, 4], [1, 2, 3, 3, 2, 6], [1, 2, 3, 3, 2, 8], [1, 2, 4, 1, 5, 4], [1, 2, 4, 1, 5, 6], [1, 2, 4, 1, 5, 8], [1, 2, 5, 2, 3, 4], [1, 2, 5, 2, 3, 6], [1, 2, 5, 2, 3, 8],
  [1, 2, 5, 3, 2, 4], [1, 2, 5, 3, 2, 6], [1, 2, 5, 3, 2, 8], [1, 3, 2, 1, 4, 4], [1, 3, 2, 1, 4, 6], [1, 3, 2, 1, 4, 8], [1, 3, 2, 2, 2, 4], [1, 3, 2, 2, 2, 6], [1, 3, 2, 2, 2, 8],
  [1, 3, 2, 2, 3, 4], [1, 3, 2, 2, 3, 6], [1, 3, 2, 2, 3, 8], [1, 3, 2, 3, 2, 4], [1, 3, 2, 3, 2, 6], [1, 3, 2, 3, 2, 8], [1, 3, 3, 1, 5, 4], [1, 3, 3, 1, 5, 6], [1, 3, 3, 1, 5, 8],
  [1, 3, 4, 2, 3, 4], [1, 3, 4, 2, 3, 6], [1, 3, 4, 2, 3, 8], [1, 3, 4, 3, 2, 4], [1, 3, 4, 3, 2, 6], [1, 3, 4, 3, 2, 8], [1, 5, 2, 2, 3, 4], [1, 5, 2, 2, 3, 6], [1, 5, 2, 2, 3, 8],
  [1, 5, 2, 3, 2, 4], [1, 5, 2, 3, 2, 6], [1, 5, 2, 3, 2, 8], [1, 5, 4, 2, 4, 4], [1, 5, 4, 2, 4, 6], [1, 5, 4, 2, 4, 8], [1, 5, 5, 3, 3, 4], [1, 5, 5, 3, 3, 6], [1, 5, 5, 3, 3, 8],
  [2, 1, 3, 1, 2, 4], [2, 1, 3, 1, 2, 6], [2, 1, 3, 1, 2, 8], [2, 1, 4, 1, 2, 4], [2, 1, 4, 1, 2, 6], [2, 1, 4, 1, 2, 8], [2, 1, 4, 1, 3, 4], [2, 1, 4, 1, 3, 6], [2, 1, 4, 1, 3, 8],
  [2, 1, 5, 1, 4, 4], [2, 1, 5, 1, 4, 6], [2, 1, 5, 1, 4, 8], [2, 1, 5, 2, 2, 4], [2, 1, 5, 2, 2, 6], [2, 1, 5, 2, 2, 8], [2, 2, 2, 1, 2, 4], [2, 2, 2, 1, 2, 6], [2, 2, 2, 1, 2, 8],
  [2, 2, 2, 1, 3, 4], [2, 2, 2, 1, 3, 6], [2, 2, 2, 1, 3, 8], [2, 2, 3, 1, 3, 4], [2, 2, 3, 1, 3, 6], [2, 2, 3, 1, 3, 8], [2, 2, 3, 1, 5, 4], [2, 2, 3, 1, 5, 6], [2, 2, 3, 1, 5, 8],
  [2, 2, 4, 1, 4, 4], [2, 2, 4, 1, 4, 6], [2, 2, 4, 1, 4, 8], [2, 2, 4, 2, 2, 4], [2, 2, 4, 2, 2, 6], [2, 2, 4, 2, 2, 8], [2, 2, 5, 1, 5, 4], [2, 2, 5, 1, 5, 6], [2, 2, 5, 1, 5, 8],
  [2, 2, 5, 3, 3, 4], [2, 2, 5, 3, 3, 6], [2, 2, 5, 3, 3, 8], [2, 3, 2, 1, 3, 4], [2, 3, 2, 1, 3, 6], [2, 3, 2, 1, 3, 8], [2, 3, 2, 1, 5, 4], [2, 3, 2, 1, 5, 6], [2, 3, 2, 1, 5, 8],
  [2, 3, 3, 1, 4, 4], [2, 3, 3, 1, 4, 6], [2, 3, 3, 1, 4, 8], [2, 3, 3, 2, 2, 4], [2, 3, 3, 2, 2, 6], [2, 3, 3, 2, 2, 8], [2, 3, 3, 2, 4, 4], [2, 3, 3, 2, 4, 6], [2, 3, 3, 2, 4, 8],
  [2, 3, 4, 1, 5, 4], [2, 3, 4, 1, 5, 6], [2, 3, 4, 1, 5, 8], [2, 3, 4, 2, 3, 4], [2, 3, 4, 2, 3, 6], [2, 3, 4, 2, 3, 8], [2, 3, 4, 3, 2, 4], [2, 3, 4, 3, 2, 6], [2, 3, 4, 3, 2, 8],
  [2, 3, 5, 2, 3, 4], [2, 3, 5, 2, 3, 6], [2, 3, 5, 2, 3, 8], [2, 3, 5, 3, 2, 4], [2, 3, 5, 3, 2, 6], [2, 3, 5, 3, 2, 8], [2, 5, 2, 1, 5, 4], [2, 5, 2, 1, 5, 6], [2, 5, 2, 1, 5, 8],
  [2, 5, 2, 3, 3, 4], [2, 5, 2, 3, 3, 6], [2, 5, 2, 3, 3, 8], [2, 5, 3, 2, 3, 4], [2, 5, 3, 2, 3, 6], [2, 5, 3, 2, 3, 8], [2, 5, 3, 3, 2, 4], [2, 5, 3, 3, 2, 6], [2, 5, 3, 3, 2, 8],
  [2, 5, 4, 2, 5, 4], [2, 5, 4, 2, 5, 6], [2, 5, 4, 2, 5, 8], [2, 5, 5, 2, 4, 4], [2, 5, 5, 2, 4, 6], [2, 5, 5, 2, 4, 8], [3, 1, 4, 1, 2, 4], [3, 1, 4, 1, 2, 6], [3, 1, 4, 1, 2, 8],
  [3, 1, 5, 1, 3, 4], [3, 1, 5, 1, 3, 6], [3, 1, 5, 1, 3, 8], [3, 2, 2, 1, 2, 4], [3, 2, 2, 1, 2, 6], [3, 2, 2, 1, 2, 8], [3, 2, 3, 1, 2, 4], [3, 2, 3, 1, 2, 6], [3, 2, 3, 1, 2, 8],
  [3, 2, 3, 1, 4, 4], [3, 2, 3, 1, 4, 6], [3, 2, 3, 1, 4, 8], [3, 2, 3, 2, 2, 4], [3, 2, 3, 2, 2, 6], [3, 2, 3, 2, 2, 8], [3, 2, 4, 1, 3, 4], [3, 2, 4, 1, 3, 6], [3, 2, 4, 1, 3, 8],
  [3, 2, 4, 2, 3, 4], [3, 2, 4, 2, 3, 6], [3, 2, 4, 2, 3, 8], [3, 2, 4, 3, 2, 4], [3, 2, 4, 3, 2, 6], [3, 2, 4, 3, 2, 8], [3, 2, 5, 1, 4, 4], [3, 2, 5, 1, 4, 6], [3, 2, 5, 1, 4, 8],
  [3, 2, 5, 2, 2, 4], [3, 2, 5, 2, 2, 6], [3, 2, 5, 2, 2, 8], [3, 2, 5, 2, 4, 4], [3, 2, 5, 2, 4, 6], [3, 2, 5, 2, 4, 8], [3, 3, 2, 1, 2, 4], [3, 3, 2, 1, 2, 6], [3, 3, 2, 1, 2, 8],
  [3, 3, 2, 1, 4, 4], [3, 3, 2, 1, 4, 6], [3, 3, 2, 1, 4, 8], [3, 3, 2, 2, 2, 4], [3, 3, 2, 2, 2, 6], [3, 3, 2, 2, 2, 8], [3, 3, 3, 1, 3, 4], [3, 3, 3, 1, 3, 6], [3, 3, 3, 1, 3, 8],
  [3, 3, 4, 1, 4, 4], [3, 3, 4, 1, 4, 6], [3, 3, 4, 1, 4, 8], [3, 3, 4, 1, 5, 4], [3, 3, 4, 1, 5, 6], [3, 3, 4, 1, 5, 8], [3, 3, 4, 2, 2, 4], [3, 3, 4, 2, 2, 6], [3, 3, 4, 2, 2, 8],
  [3, 3, 4, 2, 5, 4], [3, 3, 4, 2, 5, 6], [3, 3, 4, 2, 5, 8], [3, 3, 5, 1, 5, 4], [3, 3, 5, 1, 5, 6], [3, 3, 5, 1, 5, 8], [3, 5, 2, 1, 4, 4], [3, 5, 2, 1, 4, 6], [3, 5, 2, 1, 4, 8],
  [3, 5, 2, 2, 2, 4], [3, 5, 2, 2, 2, 6], [3, 5, 2, 2, 2, 8], [3, 5, 2, 2, 4, 4], [3, 5, 2, 2, 4, 6], [3, 5, 2, 2, 4, 8], [3, 5, 3, 1, 5, 4], [3, 5, 3, 1, 5, 6], [3, 5, 3, 1, 5, 8],
  [3, 5, 4, 2, 3, 4], [3, 5, 4, 2, 3, 6], [3, 5, 4, 2, 3, 8], [3, 5, 4, 3, 2, 4], [3, 5, 4, 3, 2, 6], [3, 5, 4, 3, 2, 8], [3, 5, 4, 3, 3, 4], [3, 5, 4, 3, 3, 6], [3, 5, 4, 3, 3, 8],
  [4, 1, 5, 1, 2, 4], [4, 1, 5, 1, 2, 6], [4, 1, 5, 1, 2, 8], [4, 2, 3, 1, 3, 4], [4, 2, 3, 1, 3, 6], [4, 2, 3, 1, 3, 8], [4, 2, 4, 1, 2, 4], [4, 2, 4, 1, 2, 6], [4, 2, 4, 1, 2, 8],
  [4, 2, 4, 1, 5, 4], [4, 2, 4, 1, 5, 6], [4, 2, 4, 1, 5, 8], [4, 2, 5, 1, 3, 4], [4, 2, 5, 1, 3, 6], [4, 2, 5, 1, 3, 8], [4, 3, 2, 1, 3, 4], [4, 3, 2, 1, 3, 6], [4, 3, 2, 1, 3, 8],
  [4, 3, 3, 1, 2, 4], [4, 3, 3, 1, 2, 6], [4, 3, 3, 1, 2, 8], [4, 3, 3, 2, 3, 4], [4, 3, 3, 2, 3, 6], [4, 3, 3, 2, 3, 8], [4, 3, 3, 3, 2, 4], [4, 3, 3, 3, 2, 6], [4, 3, 3, 3, 2, 8],
  [4, 3, 4, 1, 3, 4], [4, 3, 4, 1, 3, 6], [4, 3, 4, 1, 3, 8], [4, 3, 4, 1, 4, 4], [4, 3, 4, 1, 4, 6], [4, 3, 4, 1, 4, 8], [4, 3, 4, 2, 2, 4], [4, 3, 4, 2, 2, 6], [4, 3, 4, 2, 2, 8],
  [4, 3, 4, 3, 3, 4], [4, 3, 4, 3, 3, 6], [4, 3, 4, 3, 3, 8], [4, 3, 5, 1, 4, 4], [4, 3, 5, 1, 4, 6], [4, 3, 5, 1, 4, 8], [4, 3, 5, 2, 2, 4], [4, 3, 5, 2, 2, 6], [4, 3, 5, 2, 2, 8],
  [4, 3, 5, 3, 4, 4], [4, 3, 5, 3, 4, 6], [4, 3, 5, 3, 4, 8], [4, 5, 2, 1, 3, 4], [4, 5, 2, 1, 3, 6], [4, 5, 2, 1, 3, 8], [4, 5, 3, 1, 4, 4], [4, 5, 3, 1, 4, 6], [4, 5, 3, 1, 4, 8],
  [4, 5, 3, 2, 2, 4], [4, 5, 3, 2, 2, 6], [4, 5, 3, 2, 2, 8], [4, 5, 3, 3, 4, 4], [4, 5, 3, 3, 4, 6], [4, 5, 3, 3, 4, 8], [4, 5, 4, 1, 5, 4], [4, 5, 4, 1, 5, 6], [4, 5, 4, 1, 5, 8],
  [4, 5, 4, 2, 4, 4], [4, 5, 4, 2, 4, 6], [4, 5, 4, 2, 4, 8], [4, 5, 5, 2, 3, 4], [4, 5, 5, 2, 3, 6], [4, 5, 5, 2, 3, 8], [4, 5, 5, 3, 2, 4], [4, 5, 5, 3, 2, 6], [4, 5, 5, 3, 2, 8],
  [5, 2, 3, 1, 2, 4], [5, 2, 3, 1, 2, 6], [5, 2, 3, 1, 2, 8], [5, 2, 4, 1, 4, 4], [5, 2, 4, 1, 4, 6], [5, 2, 4, 1, 4, 8], [5, 2, 4, 2, 2, 4], [5, 2, 4, 2, 2, 6], [5, 2, 4, 2, 2, 8],
  [5, 2, 5, 1, 2, 4], [5, 2, 5, 1, 2, 6], [5, 2, 5, 1, 2, 8], [5, 2, 5, 2, 3, 4], [5, 2, 5, 2, 3, 6], [5, 2, 5, 2, 3, 8], [5, 2, 5, 3, 2, 4], [5, 2, 5, 3, 2, 6], [5, 2, 5, 3, 2, 8],
  [5, 3, 2, 1, 2, 4], [5, 3, 2, 1, 2, 6], [5, 3, 2, 1, 2, 8], [5, 3, 3, 1, 5, 4], [5, 3, 3, 1, 5, 6], [5, 3, 3, 1, 5, 8], [5, 3, 4, 1, 2, 4], [5, 3, 4, 1, 2, 6], [5, 3, 4, 1, 2, 8],
  [5, 3, 4, 1, 3, 4], [5, 3, 4, 1, 3, 6], [5, 3, 4, 1, 3, 8], [5, 3, 4, 2, 4, 4], [5, 3, 4, 2, 4, 6], [5, 3, 4, 2, 4, 8], [5, 3, 5, 1, 3, 4], [5, 3, 5, 1, 3, 6], [5, 3, 5, 1, 3, 8],
  [5, 5, 2, 1, 2, 4], [5, 5, 2, 1, 2, 6], [5, 5, 2, 1, 2, 8], [5, 5, 2, 2, 3, 4], [5, 5, 2, 2, 3, 6], [5, 5, 2, 2, 3, 8], [5, 5, 2, 3, 2, 4], [5, 5, 2, 3, 2, 6], [5, 5, 2, 3, 2, 8],
  [5, 5, 3, 1, 3, 4], [5, 5, 3, 1, 3, 6], [5, 5, 3, 1, 3, 8], [5, 5, 4, 1, 4, 4], [5, 5, 4, 1, 4, 6], [5, 5, 4, 1, 4, 8], [5, 5, 4, 2, 2, 4], [5, 5, 4, 2, 2, 6], [5, 5, 4, 2, 2, 8],
  [5, 5, 5, 1, 5, 4], [5, 5, 5, 1, 5, 6], [5, 5, 5, 1, 5, 8],
].map(([p, k, be, u, v, w]) => ({ p, k, be, u, v, w }))

function item150(par, kind) {
  const { p, k, be, u, v, w } = par
  const { set, solve, K, M } = build150(par)
  const aRange = spanRange(set)
  const root = kind === "plain"
    ? `√{${be * be} + x${SUP[2]}}`
    : `√{x${SUP[2]} + 2x + ${be * be + 1}}`
  const left = kind === "plain"
    ? `a${SUP[2]} ${MINUS} ${p === 1 ? "" : p}a + ${k === 1 ? "" : k}${root}`
    : `a${SUP[2]} + ${w === 1 ? "" : w}|x + 1| + ${k === 1 ? "" : k}${root}`
  const right = kind === "plain"
    ? `${u === 1 ? "" : u}|x ${MINUS} ${v === 1 ? "" : v}a| ${MINUS} ${w === 1 ? "" : w}|x|`
    : `${p === 1 ? "" : p}a + ${u === 1 ? "" : u}|x ${MINUS} ${v === 1 ? "" : v}a + 1|`
  const T = kind === "plain" ? "x" : "x + 1"
  return item({
    text: `${HEAD_A}\n\n${left} = ${right}\n\nимеет хотя бы один корень.`,
    set,
    solution: `${kind === "plain" ? "" : `Обозначим t = x + 1; тогда ${root} = √(t${SUP[2]} + ${be * be}), а все модули записываются через t.\n`}`
      + `Оценим части. Слева ${k === 1 ? "" : k}√(${kind === "plain" ? "x" : "t"}${SUP[2]} + ${be * be}) ≥ ${K}, причём равенство только при ${T} = 0.\n`
      + `Справа по неравенству треугольника ${u === 1 ? "" : u}|${T} ${MINUS} ${v === 1 ? "" : v}a| ≤ ${u === 1 ? "" : u}|${T}| + ${M}|a|, поэтому правая часть не превосходит ${MINUS}${w - u === 1 ? "" : w - u}|${T}| + ${M}|a| плюс слагаемые с a.\n`
      + `Значит разность левой и правой частей не меньше D(a) + ${w - u === 1 ? "" : w - u}|${T}|, где D(a) = a${SUP[2]} ${MINUS} ${p === 1 ? "" : p}a + ${K} ${MINUS} ${M}|a|, и при ${T} = 0 достигается равенство.\n`
      + `При D(a) > 0 разность всюду положительна — корней нет; при D(a) ≤ 0 она равна D(a) ≤ 0 в нуле и стремится к +∞ при больших |${T}|, поэтому корень есть.\n`
      + `Остаётся решить a${SUP[2]} ${MINUS} ${p === 1 ? "" : p}a + ${K} ≤ ${M}|a|.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "exists" },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: (a) => a * a - p * a + K - M * Math.abs(a), label: "D(a)" },
        { f: () => 0, dash: true, label: "D = 0" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -8, xMax: 8, aMin: aRange[0], aMax: aRange[1],
    },
  })
}
export function t18EstimateRootPlain() { return item150(pick(T150), "plain") }
export function t18EstimateRootShift() { return item150(pick(T150), "shift") }

// ── #113. (x − pa)/(x + c) + (x − d)/(x − a) = 1 — «ровно один корень» ───────
// После приведения к общему знаменателю дробные части сокращаются полностью и остаётся
// квадратное уравнение x² − (pa + d)x + pa² + ac − dc = 0, но с ОДЗ x ≠ −c и x ≠ a.
// Ровно один корень получается двумя способами: либо дискриминант равен нулю (и двойной
// корень разрешён ОДЗ), либо корней два, но ровно один из них запрещён.
// Наборы (p, c, d) отбираются так, чтобы дискриминант по a имел рациональные корни
// (у оригинала ФИПИ они содержат √10 — такие наборы генератор не берёт).
function build113({ p, c, d }) {
  const P = (a) => [Radd(Rsub(Rmul(R(p), Rmul(a, a)), R(d * c)), Rmul(R(c), a)), Rneg(Radd(Rmul(R(p), a), R(d))), R1]
  const solve = (a) => {
    const Pa = P(a)
    let n = countRoots(Pa, "-inf", "+inf", false, false)
    const bad = uniqSorted([R(-c), a])
    for (const x of bad) if (Rzero(pEval(Pa, x))) n -= 1
    return n
  }
  const disc = ratRoots([R(d * d + 4 * d * c), R(2 * p * d - 4 * c), R(p * p - 4 * p)])
  const atMc = ratRoots([R(c * c), R((p + 1) * c), R(p)])           // корень совпал с x = −c
  if (!disc.allRational || !atMc.allRational) return null
  const crit = [R(-c), R(d), ...disc.roots, ...atMc.roots]
  return { set: assembleSet((a) => solve(a) === 1, crit), solve }
}
const T113 = []
for (const p of [1, 2, 3, 4, 5]) for (const c of [1, 2, 3, 4]) for (const d of [-3, -2, -1, 1, 2, 3]) {
  const r = build113({ p, c, d })
  if (r && tidySet(r.set, 4)) T113.push({ p, c, d })
}
export function t18TwoFractionsOne() {
  const par = pick(T113), { p, c, d } = par
  const { set, solve } = build113(par)
  const aRange = spanRange(set)
  return item({
    text: `${HEAD_A}\n\n${fT(`x ${MINUS} ${p === 1 ? "" : p}a`, `x + ${c}`)} + ${fT(`x${term(-d, "")}`, `x ${MINUS} a`)} = 1\n\nимеет ровно один корень.`,
    set,
    solution: `ОДЗ: x ≠ ${MINUS}${c} и x ≠ a. Приведём к общему знаменателю и раскроем скобки — квадратичные слагаемые частично сокращаются, и остаётся\n`
      + `x${SUP[2]} ${MINUS} (${p === 1 ? "" : p}a${term(d, "")})x + ${p === 1 ? "" : p}a${SUP[2]}${term(c, "a")}${term(-d * c, "")} = 0.\n`
      + `Значение x = ${MINUS}${c} обращает левую часть в ${p === 1 ? "" : p}a${SUP[2]} + ${(p + 1) * c === 1 ? "" : (p + 1) * c}a + ${c * c}, а x = a — в (a + ${c})(a${term(-d, "")}), поэтому запрещённые корни появляются лишь при отдельных значениях a.\n`
      + `Ровно один корень — это либо нулевой дискриминант (${p * p - 4 * p === 0 ? "" : `${p * p - 4 * p}a${SUP[2]}`}${term(2 * p * d - 4 * c, "a")}${term(d * d + 4 * d * c, "")} = 0), либо два различных корня, из которых ровно один выброшен ОДЗ.\n`
      + `Ответ: ${setToString(set)}.`,
    raw: {
      seg: [-14, 14],
      F: (a) => (x) => {
        if (Math.abs(x + c) < 1e-12 || Math.abs(x - a) < 1e-12) return null
        return (x - p * a) / (x + c) + (x - d) / (x - a) - 1
      },
      poles: (a) => [-c, a],
      sols: (a) => numQuad(1, -(p * a + d), p * a * a + a * c - d * c)
        .filter((x) => Math.abs(x + c) > 1e-9 && Math.abs(x - a) > 1e-9),
    },
    predicate: { type: "count", n: 1 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: () => -c, dash: true, label: `x = ${MINUS}${c}` },
        { f: (a) => a, dash: true, label: "x = a" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -10, xMax: 10, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// =============================================================================
// РАЗДЕЛ J (продолжение). Кривая с модулем + прямая (эталон #73, #74)
// =============================================================================
// В обеих задачах первая строка ПОСЛЕ раскрытия модуля распадается на вертикальную прямую
// x = h (на ней равенство выполняется тождественно) и две «половинки» кривой — по одной
// в каждой полуплоскости. Прямая всегда пересекает вертикаль ровно в одной точке, а на
// половинках число точек считается точно: подстановка даёт квадратный трёхчлен, и корни
// на нужном луче считает Штурм.

// #73. {(x − h)(y + kx − kh) = |x − h|³; y = mx + a} — «ровно четыре различных решения».
// При t = x − h ≠ 0 равенство равносильно y = t² − kt при t > 0 и y = −t² − kt при t < 0,
// а t = 0 (вертикаль x = h) годится при любом y. Подставляя прямую y = mt + b (b = mh + a),
// получаем t² − st − b = 0 на t > 0 и t² + st + b = 0 на t < 0, где s = k + m.
function build73({ h, k, m }) {
  const s = k + m
  if (s <= 0) return null
  const bOf = (a) => Radd(Rmul(R(m), R(h)), a)
  const solve = (a) => {
    const b = bOf(a)
    const n1 = countRoots([Rneg(b), R(-s), R1], R0, "+inf", false, false)
    const n2 = countRoots([b, R(s), R1], "-inf", R0, false, false)
    return 1 + n1 + n2
  }
  const crit = [R(-m * h), R(-s * s - 4 * m * h, 4), R(s * s - 4 * m * h, 4)]
  return { set: assembleSet((a) => solve(a) === 4, crit), solve, s }
}
const T73 = []
for (const h of [-2, -1, 0, 1, 2, 3]) for (const k of [1, 2, 3, 4]) for (const m of [1, 2, 3]) {
  const r = build73({ h, k, m })
  if (r && tidySet(r.set, 3)) T73.push({ h, k, m })
}
export function t18SysCubicAbsLine() {
  const par = pick(T73), { h, k, m } = par
  const { set, solve, s } = build73(par)
  const aRange = spanRange(set)
  const inner = `y${term(k, "x")}${term(-k * h, "")}`
  const absPart = `|x${term(-h, "")}|${SUP[3]}`
  return item({
    text: `${HEAD_SYS}\n⟦cases:(x${term(-h, "")})(${inner}) = ${absPart}¦y = ${m === 1 ? "" : m}x + a⟧\n\nимеет ровно четыре различных решения.`,
    set,
    solution: `Обозначим t = x${term(-h, "")}. Первая строка принимает вид t(y + ${k === 1 ? "" : k}t) = |t|${SUP[3]}.\n`
      + `При t = 0 (то есть на всей вертикальной прямой x = ${nS(h)}) она выполняется тождественно — это целая прямая точек кривой.\n`
      + `При t > 0 делим на t: y = t${SUP[2]} ${MINUS} ${k === 1 ? "" : k}t; при t < 0 получаем y = ${MINUS}t${SUP[2]} ${MINUS} ${k === 1 ? "" : k}t.\n`
      + `Прямая y = ${m === 1 ? "" : m}x + a в координате t записывается как y = ${m === 1 ? "" : m}t + b, где b = a${term(m * h, "")}; вертикаль она пересекает ровно один раз при любом a.\n`
      + `Остаётся t${SUP[2]} ${MINUS} ${s === 1 ? "" : s}t ${MINUS} b = 0 на луче t > 0 и t${SUP[2]} + ${s === 1 ? "" : s}t + b = 0 на луче t < 0. Первое даёт два корня при ${MINUS}${Rstr(R(s * s, 4))} < b < 0 и один при b > 0, второе — два при 0 < b < ${Rstr(R(s * s, 4))} и один при b < 0.\n`
      + `Итого четыре точки ⟺ b ≠ 0 и |b| < ${Rstr(R(s * s, 4))}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 4 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: () => h, dash: true, label: `x = ${nS(h)} (вертикаль кривой)` },
        { f: (a) => h + (s + Math.sqrt(Math.max(0, s * s + 4 * (m * h + a)))) / 2, label: "точки на правой ветви" },
        { f: (a) => h - (s + Math.sqrt(Math.max(0, s * s - 4 * (m * h + a)))) / 2, label: "точки на левой ветви" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: h - 6, xMax: h + 6, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// #74. {x(x² + y² + αy + β) = |x|(γy + δ); 4y = 3x + a} — «ровно три различных решения».
// При x > 0 сокращаем на x: x² + y² + (α−γ)y + (β−δ) = 0 — окружность с центром на оси Oy;
// при x < 0 знак модуля меняется и получается ДРУГАЯ окружность; x = 0 подходит при любом y.
// Прямая взята с «пифагоровым» угловым коэффициентом 3/4: тогда и касание (a = 4c ± 5ρ),
// и прохождение через точки окружности на оси Oy (a = 4(c ± ρ)) — рациональные значения a
// (при прямой y = x + a, как у оригинала, они содержали бы √2).
function build74({ c1, r1, c2, r2 }) {
  if ((c1 * c1 - r1 * r1) % 2 !== (c2 * c2 - r2 * r2) % 2) return null
  const al = -(c1 + c2), ga = c1 - c2
  const be = (c1 * c1 - r1 * r1 + c2 * c2 - r2 * r2) / 2
  const de = (c2 * c2 - r2 * r2 - c1 * c1 + r1 * r1) / 2
  if (!Number.isInteger(be) || !Number.isInteger(de)) return null
  // 25x² + 6(a − 4c)x + (a − 4c)² − 16ρ² = 0 — подстановка прямой в окружность
  const poly = (a, c, r) => {
    const u = Rsub(a, R(4 * c))
    return [Rsub(Rmul(u, u), R(16 * r * r)), Rmul(R(6), u), R(25)]
  }
  const solve = (a) => 1
    + countRoots(poly(a, c1, r1), R0, "+inf", false, false)
    + countRoots(poly(a, c2, r2), "-inf", R0, false, false)
  const crit = []
  for (const [c, r] of [[c1, r1], [c2, r2]]) {
    crit.push(R(4 * c + 5 * r), R(4 * c - 5 * r), R(4 * (c + r)), R(4 * (c - r)))
  }
  return { set: assembleSet((a) => solve(a) === 3, crit), solve, al, be, ga, de }
}
const T74 = []
for (const c1 of [0, 1, 2]) for (const r1 of [1, 2, 3]) for (const c2 of [-2, -1, 0, 1]) for (const r2 of [1, 2, 3]) {
  if (c1 === c2 && r1 === r2) continue
  const r = build74({ c1, r1, c2, r2 })
  if (r && tidySet(r.set, 4)) T74.push({ c1, r1, c2, r2 })
}
export function t18SysTwoHalfCircles() {
  const par = pick(T74), { c1, r1, c2, r2 } = par
  const { set, solve, al, be, ga, de } = build74(par)
  const aRange = spanRange(set)
  return item({
    text: `${HEAD_SYS}\n⟦cases:x(x${SUP[2]} + y${SUP[2]}${term(al, "y")}${term(be, "")}) = |x|(${ga === 1 ? "" : ga === -1 ? MINUS : nS(ga)}y${term(de, "")})¦4y = 3x + a⟧\n\nимеет ровно три различных решения.`,
    set,
    solution: `При x = 0 первая строка обращается в 0 = 0, то есть ВСЯ ось Oy принадлежит кривой; прямая 4y = 3x + a пересекает её ровно в одной точке (0; ${fT("a", "4")}).\n`
      + `При x > 0 сокращаем на x: x${SUP[2]} + y${SUP[2]}${term(al - ga, "y")}${term(be - de, "")} = 0, то есть x${SUP[2]} + (y ${MINUS} ${nS(c1)})${SUP[2]} = ${r1 * r1} — правая половина окружности с центром (0; ${nS(c1)}) радиуса ${r1}.\n`
      + `При x < 0 модуль меняет знак: x${SUP[2]} + (y ${MINUS} ${nS(c2)})${SUP[2]} = ${r2 * r2} — левая половина окружности с центром (0; ${nS(c2)}) радиуса ${r2}.\n`
      + `Подставляя прямую, получаем 25x${SUP[2]} + 6(a ${MINUS} ${4 * c1})x + (a ${MINUS} ${4 * c1})${SUP[2]} ${MINUS} ${16 * r1 * r1} = 0 (и аналогично для второй окружности); нужны корни строго нужного знака.\n`
      + `Три решения — это точка на оси Oy плюс ровно две точки на полуокружностях. Касание происходит при a = ${4 * c1} ± ${5 * r1} и a = ${4 * c2} ± ${5 * r2}, а точка пересечения переходит через ось Oy при a = ${4 * (c1 + r1)}, ${4 * (c1 - r1)}, ${4 * (c2 + r2)}, ${4 * (c2 - r2)}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "count", n: 3 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: () => 0, dash: true, label: "ось Oy — часть кривой" },
        { f: (a) => (25 * 16 * r1 * r1 - 16 * (a - 4 * c1) ** 2 >= 0 ? (-6 * (a - 4 * c1) + Math.sqrt(Math.max(0, 36 * (a - 4 * c1) ** 2 - 100 * ((a - 4 * c1) ** 2 - 16 * r1 * r1)))) / 50 : null), label: "правая полуокружность" },
        { f: (a) => (25 * 16 * r2 * r2 - 16 * (a - 4 * c2) ** 2 >= 0 ? (-6 * (a - 4 * c2) - Math.sqrt(Math.max(0, 36 * (a - 4 * c2) ** 2 - 100 * ((a - 4 * c2) ** 2 - 16 * r2 * r2)))) / 50 : null), label: "левая полуокружность" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: -6, xMax: 6, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// ── #69. {y² − αx − c = |x² − px − q|; x − 2y = a} — «более двух решений» ────
// Вне отрезка между корнями подмодульного трёхчлена модуль раскрывается со знаком «+»,
// и правая часть даёт y² = (x + w)² — ДВЕ прямые y = ±(x + w); внутри отрезка знак меняется
// и остаётся окружность (x − x₀)² + y² = ρ². Коэффициенты подобраны так, что обе картинки
// стыкуются (α = p + 2w, c = q + w²), корни трёхчлена рациональны, а 5ρ² — точный квадрат:
// тогда касание прямой x − 2y = a с окружностью происходит при рациональном a
// (у оригинала прямая x − y = a, и касание было бы иррациональным).
function build69({ p, q, w }) {
  const dsc = p * p + 4 * q
  const sq = isSq(dsc)
  if (sq === null || (p + sq) % 2 !== 0) return null
  const xm = R(p - sq, 2), xp = R(p + sq, 2)                    // корни x² − px − q
  const x0 = p + w, rho2 = 2 * q + w * w + (p + w) * (p + w)
  const t = isSq(5 * rho2)
  if (t === null || rho2 <= 0) return null
  const arc = (a) => [Radd(Rsub(Rmul(a, a), R(4 * rho2)), R(4 * x0 * x0)), Rneg(Radd(R(8 * x0), Rmul(R(2), a))), R(5)]
  const outside = (x) => Rcmp(x, xm) <= 0 || Rcmp(x, xp) >= 0
  const solve = (a) => {
    let n = countRoots(arc(a), xm, xp, false, false)            // дуга — открытый промежуток
    if (outside(Rsub(Rneg(a), R(2 * w)))) n++                   // прямая y = x + w
    if (outside(Rdiv(Rsub(a, R(2 * w)), R(3)))) n++             // прямая y = −(x + w)
    return n
  }
  const crit = [R(x0 + t), R(x0 - t)]                           // касание
  for (const x of [xm, xp]) {
    crit.push(Rsub(Rneg(x), R(2 * w)), Radd(Rmul(R(3), x), R(2 * w)))
    const e = ratRoots([Radd(Rsub(Rmul(R(5), Rmul(x, x)), Rmul(R(8 * x0), x)), R(4 * x0 * x0 - 4 * rho2)), Rmul(R(-2), x), R1])
    if (!e.allRational) return null
    crit.push(...e.roots)
  }
  return { set: assembleSet((a) => solve(a) >= 3, crit), solve, x0, rho2, xm, xp }
}
const T69 = []
for (const p of [-3, -2, -1, 0, 1, 2, 3]) for (const q of [1, 2, 3, 4, 5, 6, 8, 10, 12]) for (const w of [-2, -1, 0, 1, 2]) {
  const r = build69({ p, q, w })
  if (r && tidySet(r.set, 4)) T69.push({ p, q, w })
}
export function t18SysTwoLinesArc() {
  const par = pick(T69), { p, q, w } = par
  const { set, solve, x0, rho2, xm, xp } = build69(par)
  const aRange = spanRange(set)
  const al = p + 2 * w, c = q + w * w
  return item({
    text: `${HEAD_SYS}\n⟦cases:y${SUP[2]}${term(-al, "x")}${term(-c, "")} = |x${SUP[2]}${term(-p, "x")}${term(-q, "")}|¦x ${MINUS} 2y = a⟧\n\nимеет более двух различных решений.`,
    set,
    solution: `Корни подмодульного трёхчлена — x = ${Rstr(xm)} и x = ${Rstr(xp)}.\n`
      + `Вне отрезка [${Rstr(xm)}; ${Rstr(xp)}] модуль раскрывается со знаком «+», и первая строка даёт y${SUP[2]} = x${SUP[2]}${term(2 * w, "x")}${term(w * w, "")} = (x${term(w, "")})${SUP[2]}, то есть ДВЕ прямые y = ±(x${term(w, "")}).\n`
      + `Внутри отрезка знак противоположный: y${SUP[2]} = ${MINUS}x${SUP[2]}${term(al + p, "x")}${term(c + q, "")}, то есть дуга окружности (x ${MINUS} ${nS(x0)})${SUP[2]} + y${SUP[2]} = ${rho2}. В концах отрезка обе записи дают одно и то же — кривая непрерывна.\n`
      + `Прямая x ${MINUS} 2y = a пересекает прямую y = x${term(w, "")} в точке x = ${MINUS}a${term(-2 * w, "")}, прямую y = ${MINUS}(x${term(w, "")}) — в точке x = ${fT(`a${term(-2 * w, "")}`, "3")}; засчитываются они только если попали ВНЕ отрезка.\n`
      + `Точки на дуге ищутся из 5x${SUP[2]} ${MINUS} (${8 * x0} + 2a)x + ${4 * x0 * x0 - 4 * rho2} + a${SUP[2]} = 0; касание происходит при a = ${nS(x0)} ± ${isSq(5 * rho2)}.\n`
      + `Ответ: ${setToString(set)}.`,
    predicate: { type: "atLeast", n: 3 },
    solve: (a) => solve(a),
    aRange,
    picture: {
      curves: [
        { f: () => Rnum(xm), dash: true, label: "концы отрезка" },
        { f: () => Rnum(xp), dash: true },
        { f: (a) => -a - 2 * w, label: "точка на прямой y = x + w" },
        { f: (a) => (a - 2 * w) / 3, label: "точка на прямой y = −(x + w)" },
      ],
      marks: [], hlines: setBounds(set).map(Rnum),
      xMin: Rnum(xm) - 6, xMax: Rnum(xp) + 6, aMin: aRange[0], aMax: aRange[1],
    },
  })
}

// =============================================================================
export const META18 = [
  ["Дробь = 0, «ровно два различных решения»", [
    ["rat-quad-lin", "(k²x²−a²)/(px−q−ra) = 0 — линейный знаменатель", t18RatQuadLin],
    ["rat-quad-sqdiff", "(k²x²−a²)/((x+m)²−a²) = 0 — разность квадратов внизу", t18RatQuadSqDiff],
    ["rat-num-const", "(x²−2mx+a)/((kx−a)(x−a)) = 0 — параметр в свободном члене", t18RatNumConst],
    ["rat-cubic-excl", "(ca−x²+bx)/(x−a²) = 0 — полюс x = a², кубика выкалываний", t18RatCubicExcl],
    ["rat-den-sqrt-a", "(x²−2mx+a²−2ta)/(x²−a) = 0 — полюсы ±√a", t18RatDenSqrtA],
    ["rat-factor-den", "(x²−2mx+a²+2ta)/((kx+a)(x−a)) = 0 — раскладывающийся знаменатель", t18RatFactorDen],
    ["rat-quad-den-param", "(x²−2mx+a²−2ta)/(x²+px−qa) = 0 — выкалывания через резольвенту", t18RatQuadDenParam],
    ["rat-param-both", "(x²+2ux−ca)/(x²−2vx+a²−2wa) = 0 — параметр в обеих частях", t18RatParamBoth],
    ["rat-abs-num", "(|kx|−x−c−a)/(x²−px−qa) = 0 — модуль в числителе", t18RatAbsNum],
    ["rat-abs-num-sq", "(|kx−b|+ra−b)/(x²−2mx+a²) = 0 — модуль и a² внизу", t18RatAbsNumSq],
    ["rat-sqrt-odz", "(x²−a(a−1)x−a³)/√(квадратный) = 0 — ОДЗ-промежуток", t18RatSqrtDenOdz],
  ]],
  ["«Ровно один корень на отрезке»", [
    ["seg-sqrt-odz", "(x²−2mx+a²)/√((a+b−x)(a−c+x)) = 0 на отрезке", t18SegSqrtOdz],
    ["seg-two-lin", "((x−a−p)(x+a−q))/√(2mx−x²−a²) = 0 на отрезке", t18SegTwoLinRoots],
    ["seg-ln-sqrt", "ln(kx−1)·√(x²−2mx+2ta−a²) = 0 на отрезке", t18SegLnTimesSqrt],
    ["seg-two-sqrt", "√(x²−a²) = √(3x²−…) — равенство двух корней", t18SegTwoSqrtEq],
    ["seg-root-lin", "x²+(x−p)√(kx−a) = px — множитель при корне", t18SegRootTimesLin],
    ["seg-x-sqrt", "x√(x−a) = √((x−a)((u+v)x−uv)) — корень слева умножен на x", t18SegXTimesSqrt],
  ]],
  ["«A² = B²» — единственное решение на отрезке", [
    ["sq-eq-poly", "(x²+kx+ka)² = (k²+1)x⁴+(k²+1)(x+a)² → kx²−x−a = 0", t18SqEqPoly],
    ["sq-eq-abs", "(k|x|+x−a)² = 2k²x²+2(x−a)² → a = x−k|x|", t18SqEqAbs],
    ["sq-eq-log", "(kx+ln(x+ca))² = (kx−ln(x+ca))² → x = 0 или x+ca = 1", t18SqEqLog],
    ["sq-eq-sqrt", "(x²−t²+√(kx−a))² = (x²−t²)²+kx−a", t18SqEqSqrt],
    ["sq-eq-tan", "(kx+a+1+tg x)² = (kx+a−1−tg x)² — ответ в π", t18SqEqTan],
    ["sq-eq-sqrt-both", "(x²+√(a−x))² = (px+q+√(a−x))² — корень с обеих сторон", t18SqEqSqrtBoth],
  ]],
  ["Произведение с логарифмом: f·ln g = f·ln h", [
    ["log-factor-lin", "(kx−c)·ln(x+a) = (kx−c)·ln(px−a)", t18LogFactorLin],
    ["log-factor-log", "ln(qa−x)·ln(2x+ra−r) = ln(qa−x)·ln(x−a)", t18LogFactorLog],
    ["log-factor-sqrt", "√(kx−c)·ln(px−a) = √(kx−c)·ln(qx+a)", t18LogFactorSqrt],
    ["log-sqrt-noseg", "√(c−kx)·ln(m²x²−a²) = √(c−kx)·ln(mx+a) — без отрезка", t18LogSqrtNoSeg],
    ["log-sqrt-seg", "тот же типаж с отрезком [0; 1]", t18LogSqrtSeg],
    ["sqrt-times-log", "√(kx−c)·ln((x−m)²+1−a²) = 0", t18SqrtTimesLog],
    ["sqrt-trig", "√(x−a)·sin x = √(x−a)·cos x на [0; Qπ]", t18SqrtTrigFactor],
    ["tan-times-log", "tg(πx)·ln(x+a) = ln(x+a)", t18TanTimesLog],
    ["log-sqrt-vs-lin", "√(x+ca)·ln(x−a) = (x−p)·ln(x−a)", t18LogSqrtVsLin],
  ]],
  ["Системы «лог/корень + кривая»", [
    ["sys-log-circle", "{log(a−x²)=log(a−y²); окружность} — ровно два решения", t18SysLogCircle],
    ["sys-sqrt-circle", "{√(a−y²)=√(a−x²); окружность} — нестрогое ОДЗ", t18SysSqrtCircle],
    ["sys-log-slope", "{log(c²−y²)=log(c²−a²x²); окружность}", t18SysLogSlope],
    ["sys-sqrt-slope", "{√(c²−y²)=√(c²−a²x²); окружность}", t18SysSqrtSlope],
    ["sys-cross", "{√(c²−y²)=√(c²−k²x²); (x−a)(y−a)=0}", t18SysCrossLines],
    ["sys-parabola", "{√(2mx−x²)=√(2may−a²y²); y=x²} — ровно 3 решения", t18SysParabola],
  ]],
  ["Рациональные, четвёртой степени, кусочные", [
    ["rat-eq-one", "(x³+x²−k²a²x−2mx+a)/(x³−k²a²x) = 1", t18RatEqOne],
    ["quartic-param", "x⁴−rx³−tx²+rax+ta−a² = 0 — не менее трёх корней", t18QuarticParam],
    ["log-var-base", "log_{c−x}(d−a−x) = 2 — хотя бы один корень на промежутке", t18LogVarBase],
    ["abs-quad-eq", "|px²+qx+r| = a−px²−sx — нет решений или единственное", t18AbsQuadEq],
    ["abs-hyperbola", "a|x−p| = c/(x+q) на [0;+∞) — ровно два корня", t18AbsHyperbola],
    ["abs-recip", "|c/x−k| = ax−1 на (0;+∞) — более двух корней", t18AbsRecipMoreTwo],
    ["two-abs-three", "|x²−px−q|−ka = |x−a|−c — ровно три корня", t18TwoAbsThree],
    ["line-semicircle", "ax+√(r²−(x+m)²) = ap+q — пучок прямых и полуокружность", t18LinePencilSemicircle],
  ]],
  ["Системы неравенств с параметром", [
    ["sys-three-ineq", "{ka≤x; 2mx>x²+a²; x+a≤s} — хотя бы одно решение на отрезке", t18SysThreeIneq],
    ["sys-split-pencil", "распадающаяся кривая + пучок прямых — единственное решение", t18SysSplitPencil],
    ["sys-disk-nosol", "круг ∪ точка и пучок прямых — НЕ имеет решений", t18SysDiskNoSol],
    ["sys-circle-strip", "{(x+k₁a+m₁)(x+k₂a+m₂)<0; x²+a²=c²} — хотя бы одно решение", t18SysCircleStrip],
    ["sys-triple-sqrt", "{a(x−1)≥4; 2√(x−c)≥a; kx<a+d} — хотя бы одно решение", t18SysTripleSqrt],
  ]],
  ["Распадающаяся кривая + прямая", [
    ["sys-hyper-line", "{(y−1)(xy−k)/√(x−v) = 0; y = x + a}", t18SysHyperLine],
    ["sys-curve-vert", "{(y−h)(y−x−b)√(x−v) = 0; x + y = a}", t18SysCurveVert],
    ["sys-curve-2sqrt", "корень в числителе и в знаменателе", t18SysCurveTwoSqrt],
    ["sys-curve-ybound", "ограничение по y, единственное решение", t18SysCurveYBound],
    ["sys-curve-negshift", "сдвиг прямой отрицательный", t18SysCurveNegShift],
    ["sys-pencil-hyper", "{(y−h)(xy−k)/√(x−v) = 0; y = ax}", t18SysPencilHyper],
    ["sys-pencil-vert", "множитель √(xHi−x) добавляет вертикаль", t18SysPencilVert],
    ["sys-pencil-ybound", "ОДЗ по y, ровно три решения", t18SysPencilYBound],
    ["sys-pencil-horiz", "множитель √(y−yLo) добавляет горизонталь", t18SysPencilHoriz],
    ["sys-semi-parab", "{((√(A−x²)−y)(x²+py−q))/(d−x²) = 0; y = 1−2a}", t18SysSemiParab],
  ]],
  ["Показательные и модульные уравнения", [
    ["exp-frac-two", "(pa/(a−q))·b^|x| = b²^|x| + (ra+s)/(a−q) — ровно два корня", t18ExpFracTwoRoots],
    ["abs-sum-recip", "|kx+a²/x+c| + |kx+a²/x−d| = c+d — хотя бы один корень", t18AbsSumRecipExists],
    ["abs-sum-subst", "(|x+p|+|x−a|)² − 2q(…) + q²−(ka−m)² = 0 — ровно два", t18AbsSumSubstTwo],
    ["exp-factor-one", "4ˣ + (a−c)2ˣ = (m+k|a|)2ˣ + … — единственное решение", t18ExpFactorOne],
    ["abs-sum-outside", "сумма модулей = A−B: корни есть, но не в интервале", t18AbsSumOutside],
    ["abs-sum-whole-seg", "весь отрезок [L;R] — решения уравнения с модулями", t18AbsSumWholeSeg],
    ["abs-diff-subst", "(|x−h|−|x−a|)² − ka(…) + Q(a) = 0 — ровно два решения", t18AbsDiffSubstTwo],
  ]],
  ["Тригонометрия с параметром", [
    ["trig-cos-subst", "(p·cos x−c−a)cos x − q·cos2x + r = 0 — хотя бы один корень", t18TrigCosSubstExists],
    ["trig-lin-comb", "k·sin x = m·cos x + a — единственное решение на отрезке", t18TrigLinCombOne],
    ["trig-tan-subst", "(tg x+b)² − … = 0 — ровно два решения на [0; 3π/2]", t18TrigTanSubstTwo],
    ["trig-abs-cos", "|sin²x+k·cos x+a| = sin²x+m·cos x−a — единственный корень", t18TrigAbsCosOne],
    ["mono-root-seg", "ⁿ√ + log + ra = 0 — любой корень принадлежит отрезку", t18MonoRootInSeg],
    ["trig-sqrt-sin", "sin√(ax−kx²) + cos2√(ax−kx²) = 0 — ровно два решения", t18TrigSqrtSin],
    ["trig-sqrt-cos", "cos√(ax−kx²) + cos2√(ax−kx²) = 0 — ровно два решения", t18TrigSqrtCos],
  ]],
  ["Квадрат по замене, расстояние между корнями", [
    ["subst-square-one", "(x²+kx+m+2a²)² = 8a²(x²+kx+m) — ровно один корень", t18SubstSquareOne],
    ["root-gap-max", "модуль разности корней наибольший", t18RootGapMax],
    ["subst-recip-seg", "w²t + 1/t + 2w = 0, t = ax−kx² — два корня на [L;R)", t18SubstReciprocalSeg],
    ["root-gap-greater", "ax²+2(a+p)x+a+q = 0 — расстояние между корнями больше d", t18RootGapGreater],
    ["subst-factor-two", "(ax²−2x)² + … = 0 — трёхчлен по t раскладывается", t18SubstFactorTwo],
    ["subst-recip-four", "(x+1/(x−a))² − (a+w)(…) + 2a(w−a) = 0 — ровно четыре", t18SubstReciprocalFour],
    ["subst-shift-two", "((a−1)x²+bx)² − 2(…) + 1 − a² = 0 — ровно два", t18SubstShiftTwo],
    ["abs-eq-abs-more", "|x²−2ax+c| = |ka−x²−2bx−d| — более двух корней", t18AbsEqAbsMoreTwo],
  ]],
  ["Окружность/фигура + семейство; два модуля", [
    ["sys-abs-2circles", "{(|x|−q)²+(y−h)²=ρ²; окружность радиуса a} — единственное", t18SysAbsTwoCircles],
    ["sys-circle-vee", "{окружность радиуса m√2; y=|x−a|+w} — ровно три", t18SysCircleVee],
    ["sys-vee-circle-slope", "{(|y|−x−c)(окружность)/(x+c)=0; y=√(a−f)·x} — ровно два", t18SysVeeCircleSlope],
    ["abs-sum-square", "x²+(p−a)² = |x−a+p|+|x+a−p| — единственный корень", t18AbsSumSquare],
    ["abs-sum-quartic", "x⁴+(a−p)² = сумма модулей — одно решение или ни одного", t18AbsSumQuartic],
    ["abs-sum-root", "√(x⁴+(a−p)⁴) = сумма модулей — единственное решение", t18AbsSumRoot],
    ["sys-abs-circle-line", "{|x²+y²−R²| справа; прямая px+qy=a} — более одного решения", t18SysAbsCircleLine],
    ["sym-abs-quad-pair", "{f(x)=f(y) с |x²−c²|; x+y=a} — более двух решений", t18SymAbsQuadPair],
    ["sym-abs-shift-pair", "{f(x)=f(y) с |x²−2dx|; x+y=a} — более двух решений", t18SymAbsShiftPair],
  ]],
  ["Системы «две кривые»: точки, прямые, окружности", [
    ["sys-point-line", "{(x−p)²+(y−q)²=0; a²+ax+may=K} — имеет решение", t18SysPointLine],
    ["sys-2points-disk", "{две точки; круг с центром (a; 2a)} — ровно одно решение", t18SysTwoPointsDisk],
    ["sys-parallel-circle", "{(x+ay−c)(x+ay−ca)=0; окружность} — ровно четыре", t18SysParallelCircle],
    ["sys-parab-cross", "{y=(a+p)x²+2ax+a−p; y²=k²x²} — ровно четыре", t18SysParabolaCross],
    ["sys-circle-hyper", "{x²+y²=a²; xy=a²−ka} — ровно два решения", t18SysCircleHyperbola],
    ["sys-two-circles", "две окружности равного радиуса — ровно два решения", t18SysTwoCircles],
    ["sys-circles-tangent", "две окружности, касание — единственное решение", t18SysCirclesTangent],
    ["sys-circles-nosol", "две окружности с бегущими центрами — нет решений", t18SysCirclesNoSol],
    ["sys-lines-circle", "{px²+py²=kxy; (x−a)²+(y−a)²=ρa⁴} — ровно два", t18SysLinesCircle],
    ["sys-strip-circle", "{полоса; окружность} — единственное решение", t18SysStripCircle],
    ["sys-quartic-diff", "{x⁴−y⁴=pa−q; x²+y²=a} — ровно четыре", t18SysQuarticDiff],
    ["sys-circle-line-more", "окружность и прямая, обе бегут по a — более одного решения", t18SysCircleLineMore],
    ["sys-lines-abshyper", "{две прямые; |xy|=a} — ровно шесть решений", t18SysTwoLinesAbsHyper],
    ["sys-rhomb-cross", "{|x−a|+m|y−a|=c; (x−u)(y−u)=0} — ровно три", t18SysRhombCross],
    ["sys-circle-logdisk", "общий множитель + ОДЗ-круг логарифма — ровно два", t18SysCircleLogDisk],
    ["sys-2circles-log", "общий множитель + полуплоскость логарифма — ровно два", t18SysTwoCirclesLog],
    ["sys-segment-disk", "сумма расстояний = |F₁F₂| (отрезок) и круг — единственное", t18SysSegmentDisk],
    ["sys-segment-line", "отрезок F₁F₂ и горизонталь — единственное решение", t18SysSegmentLine],
    ["sys-circle-cross", "{окружность радиуса k√2; y²=x²} — ровно четыре", t18SysCircleCross],
    ["sys-circle-cross-exp", "та же окружность в раскрытом виде — ровно четыре", t18SysCircleCrossExpanded],
    ["sys-pencil-cross", "{пучок окружностей; (x−1)(y−1)=0} — ровно четыре", t18SysPencilCross],
  ]],
  ["Иррациональные уравнения", [
    ["sqrt-quartic-three", "√(x⁴−k²x²+a²) = x²+kx±a — ровно три различных корня", t18SqrtQuarticThree],
    ["sqrt-quad-three", "√((w²+2)x²+2ax+1) = x²+ax+1 — ровно три различных корня", t18SqrtQuadThree],
    ["sqrt-sum-exists", "√(x+pa+c) + √(x−a) = m — хотя бы один корень", t18SqrtSumExists],
    ["exp-sqrt-one", "bˣ − a = √(b²ˣ−ka+m) — единственный корень", t18ExpSqrtOne],
    ["exp-sqrt-recip", "√(bˣ−a) + (a−c)/√(bˣ−a) = m — ровно два корня", t18ExpSqrtRecipTwo],
    ["sqrt-range-quartic", "(px−x²)² − c√(px−x²) = a²−qa — хотя бы один корень", t18SqrtRangeQuartic],
    ["sqrt-two-terms", "√x + √(pa−x) = ca — ровно два различных корня", t18SqrtTwoTermsTwo],
    ["abs-sqrt-line", "|1−k√x| = m(x+a) — ровно два корня при a > 0", t18AbsSqrtLineTwo],
    ["sqrt-vee-more", "√(1−px) = a−k|x| — более двух корней", t18SqrtVeeMore],
  ]],
  ["Монотонная замена φ(t) = tⁿ + ct", [
    ["mono-cube-none", "k³x⁶+(pa−qx)³+ckx²+cpa = cqx — не имеет корней", t18MonoCubeNoRoots],
    ["mono-abs-more", "x²ⁿ+(a−k|x|)ⁿ+x²−k|x|+a = 0 — более трёх решений", t18MonoAbsMore],
    ["mono-cos-exists", "cos²ⁿx+(k cos x−a)ⁿ+cos²x+k cos x = a — хотя бы один корень", t18MonoCosExists],
  ]],
  ["Логарифмические с параметром", [
    ["log-same-base", "log_{a−p}(kx²+c) = log_{a−p}(k(a−q)x+d) — ровно два корня", t18LogSameBaseTwo],
    ["log-diff-subst", "(log₂(x+a)−log₂(x−a))² − S·(…) + P = 0 — ровно два решения", t18LogDiffSubstTwo],
  ]],
  ["Модули на полупрямой: |kt−a|−|t+ma| = t²", [
    ["exp-abs-abs", "|k·bˣ−a| − |bˣ+ma| = b²ˣ — ровно два неотрицательных решения", t18ExpAbsAbsTwo],
    ["log-abs-abs", "|log₀,₅(x²)−a| − |log₀,₅x+ma| = (log₀,₅x)² — есть решение < C", t18LogAbsAbsExists],
    ["mono-cube-square", "(c+|x+a|)³−(…)² = (d−x²−2ax−ka²)³−(…)² — хотя бы один корень", t18MonoCubeSquareExists],
  ]],
  ["Симметричные системы", [
    ["sys-circle-2lines", "{окружность с центром (a;0); p²x² = q²y²} — ровно четыре решения", t18SysCircleTwoLines],
    ["sys-quartic-circle", "{a(x⁴+1) = y+c−|x|; окружность} — единственное решение", t18SysQuarticCircleOne],
    ["sys-symmetric", "{y = f(x); x = f(y)} — ровно одно решение", t18SysSymmetricOne],
  ]],
  ["Наибольшее/наименьшее значение функции", [
    ["max-abs-square", "наибольшее значение |x−a| − kx² не меньше C", t18MaxAbsMinusSquare],
    ["min-quad-outside", "наименьшее значение (kx−a)²+pa+q на |x| ≥ r", t18MinQuadOutside],
    ["min-lin-absquad", "наименьшее значение (αa+β)x + γa+δ + |x²−px+q|", t18MinLinPlusAbsQuad],
    ["extrema-count", "f(x) = x² − c|x−a²| − kx — более двух точек экстремума", t18ExtremaCountAbs],
    ["max-point-abs", "тот же типаж: есть хотя бы одна точка максимума", t18MaxPointAbs],
    ["min-two-abs", "наименьшее значение k|x+a| + |x²−px+q|", t18MinTwoAbs],
    ["min-abs-shifted", "наименьшее значение x − k|x| + |(x−a)(x−a−2w)|", t18MinAbsPlusShifted],
  ]],
  ["Неравенства «при всех x»", [
    ["all-x-fraction", "|(x²+ax+c)/(px²+qx+r)| < M при всех x", t18AllXFraction],
    ["all-x-segment", "|x²−px+a+c| ≤ M для всех x из [a−L; a]", t18AllXSegment],
    ["no-sol-segment", "тот же типаж: |…| > M не имеет решений на отрезке", t18NoSolSegment],
  ]],
  ["Кривая с модулем + прямая", [
    ["sys-cubic-abs-line", "{(x−h)(y+kx−kh) = |x−h|³; y = mx+a} — ровно четыре решения", t18SysCubicAbsLine],
    ["sys-two-halfcircles", "{x(x²+y²+αy+β) = |x|(γy+δ); 4y = 3x+a} — ровно три решения", t18SysTwoHalfCircles],
    ["sys-two-lines-arc", "{y²−αx−c = |x²−px−q|; x−2y = a} — более двух решений", t18SysTwoLinesArc],
  ]],
  ["Дроби и замены (остаток раздела M)", [
    ["two-fractions-one", "(x−pa)/(x+c) + (x−d)/(x−a) = 1 — ровно один корень", t18TwoFractionsOne],
  ]],
  ["Оценочные «хотя бы один корень»", [
    ["sum-abs-disk", "p|x−u| + q|x+a| ≤ √(ρ²−y²) − c — существует пара (x; y)", t18SumAbsUnderDisk],
    ["estimate-root", "a²−pa+k√(x²+β²) = u|x−va| − w|x| — хотя бы один корень", t18EstimateRootPlain],
    ["estimate-root-shift", "тот же приём в сдвинутой записи (модуль слева)", t18EstimateRootShift],
  ]],
]

export const GEN18 = META18.flatMap((g) => g[1].map((t) => t[2]))
