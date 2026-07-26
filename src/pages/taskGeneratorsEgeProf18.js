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
const term = (k, v) => (k === 0 ? "" : ` ${k > 0 ? "+" : MINUS} ${Math.abs(k) === 1 ? "" : Math.abs(k)}${v}`)
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
// Печать рационального числа в УСЛОВИИ: дробь стоячей (⟦f⟧).
// eslint-disable-next-line no-unused-vars -- нужна разделам с дробными коэффициентами условия
function Rcond(a) {
  const s = a.n < 0n ? MINUS : ""
  const n = a.n < 0n ? -a.n : a.n
  return a.d === 1n ? s + n.toString() : s + fT(n.toString(), a.d.toString())
}

// ── многочлены над Q: массив коэффициентов, индекс = степень ─────────────────
const pTrim = (p) => { const q = p.slice(); while (q.length && Rzero(q[q.length - 1])) q.pop(); return q }
const pDeg = (p) => p.length - 1                    // нулевой многочлен → −1
const pLead = (p) => p[p.length - 1]
const pNeg = (p) => p.map(Rneg)
// eslint-disable-next-line no-unused-vars -- нужны разделам, где многочлен собирается по частям
function pAdd(a, b) { const n = Math.max(a.length, b.length), r = []; for (let i = 0; i < n; i++) r.push(Radd(a[i] || R0, b[i] || R0)); return pTrim(r) }
function pSub(a, b) { const n = Math.max(a.length, b.length), r = []; for (let i = 0; i < n; i++) r.push(Rsub(a[i] || R0, b[i] || R0)); return pTrim(r) }
// eslint-disable-next-line no-unused-vars -- нужны разделам, где многочлен собирается по частям
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
const epStr = (e) => (e === "-inf" ? MINUS + "∞" : e === "+inf" ? "+∞" : Rstr(e))
function setToString(set) {
  const parts = set.intervals.map((i) => `${i.incLo ? "[" : "("}${epStr(i.lo)}; ${epStr(i.hi)}${i.incHi ? "]" : ")"}`)
  for (const p of set.points) parts.push(`{${Rstr(p)}}`)
  return parts.join(" ∪ ")
}
// Структура ответа для проверки (числа — обычные, для чтения человеком/машиной).
function setPlain(set) {
  return {
    intervals: set.intervals.map((i) => ({
      lo: i.lo === "-inf" ? -Infinity : Rnum(i.lo), hi: i.hi === "+inf" ? Infinity : Rnum(i.hi),
      lo_included: i.incLo, hi_included: i.incHi,
    })),
    points: set.points.map(Rnum),
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
// eslint-disable-next-line no-unused-vars -- критерий отбора при разовом переборе таблиц (T5–T10)
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
  let lo = Math.floor(Math.min(...b)) - pad, hi = Math.ceil(Math.max(...b)) + pad
  while (hi - lo < 24) { lo -= 1; hi += 1 }
  return [lo, hi]
}

// ── сборка объекта задания ───────────────────────────────────────────────────
function item({ text, set, solution, pieces, solve, raw, predicate, aRange, picture }) {
  return {
    condition_text: text,
    answer: setToString(set),
    answer_set: setPlain(set),
    solution,
    solution_image: svgUrl(planeSvg(picture)),
    _verify: { set, pieces, solve, raw, predicate, aRange },
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
      if (b.d > 24n) return { ok: false, err: `некруглая граница ${Rstr(b)}` }
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
            if (!sols.some((r) => r >= Math.min(prevX, x) - 1e-9 && r <= Math.max(prevX, x) + 1e-9)) {
              return { ok: false, err: `a=${Rstr(a)}: смена знака на (${prevX.toFixed(4)}; ${x.toFixed(4)}) не покрыта ни одним корнем` }
            }
          }
          prev = v; prevX = x
        }
      }
    }

    // 7. строка ответа собрана из того же множества
    if (setToString(set) !== o.answer) return { ok: false, err: "строка ответа не совпала со структурой" }
    return { ok: true }
  } catch (e) {
    return { ok: false, err: "ИСКЛЮЧЕНИЕ " + e.message }
  }
}

// ── общий текст-шапка ────────────────────────────────────────────────────────
const HEAD_PARAM = "Найдите все значения параметра a, при каждом из которых уравнение"
const HEAD_A = "Найдите все значения a, при каждом из которых уравнение"
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
]

export const GEN18 = META18.flatMap((g) => g[1].map((t) => t[2]))
