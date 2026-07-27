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
]

export const GEN18 = META18.flatMap((g) => g[1].map((t) => t[2]))
