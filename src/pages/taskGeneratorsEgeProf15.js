// Генераторы ЕГЭ математика ПРОФИЛЬ, задание №15 (развёрнутое, часть 2): «Решите неравенство».
//
// Эталон типажей — PDF «Задачи №15» (10 разделов, 113 задач; инвентарь строка-в-строку —
// fipi_bank_ege_prof/typages_task15.md).
//
// ФИЛОСОФИЯ (важно): ни одно неравенство НЕ решается численно. Каждое строится ОТ ОТВЕТА:
//   1) задаём нули и полюса с кратностями (в t-переменной, если есть замена);
//   2) знаки по интервалам получаются методом интервалов (solveSign) — ответ известен
//      по построению;
//   3) буквальные коэффициенты показа выводятся из этих нулей алгебраически (тождество),
//      а не подбором.
// У каждого объекта два независимых представления:
//   • reduced — приведённая форма (произведение (x−r)^m / (x−p)^n): даёт ответ;
//   • literal — БУКВАЛЬНЫЕ lhs(x)/rhs(x) из напечатанного условия: по ним verify15
//     сканирует сетку и сверяет с напечатанным ответом.
// Строки показа собираются из тех же коэффициентов, что и вычислители, — показ не может
// разъехаться с математикой.
//
// Формат объекта: { condition_text, answer, _verify }.
// Мат-токены разворачивает renderTaskMath(): ⟦f:n:d⟧ дробь, ⟦r:x⟧ корень, ⟦b:x⟧ индекс,
// ⟦sup:x⟧ показатель, ⟦pf:n:d⟧ дробь в скобках. answer — plain-текст (моноширинный):
// дроби в нём пишем инлайном («7/2»), это ключ ответа, а не условие.

// ── базовые утилиты ──────────────────────────────────────────────────────────
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b] } return a || 1 }
const MINUS = "−" // U+2212
const SUPD = { 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" }
const SUBD = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" }
// eslint-disable-next-line no-unused-vars -- нужен в разделах с логарифмами (log₂, log₅)
const subU = (n) => String(n).split("").map((c) => SUBD[c] ?? c).join("")
const fT = (n, d) => `⟦f:${n}:${d}⟧`

// ── рациональные числа {p,q}, q>0, дробь сокращена ───────────────────────────
function Q(p, q = 1) { if (q < 0) { p = -p; q = -q } const g = gcd(p, q) || 1; return { p: p / g, q: q / g } }
const toQ = (c) => (typeof c === "number" ? Q(c) : c)
const Qnum = (a) => a.p / a.q
const Qadd = (a, b) => Q(a.p * b.q + b.p * a.q, a.q * b.q)
const Qmul = (a, b) => Q(a.p * b.p, a.q * b.q)

// Число в УСЛОВИИ: целое как есть, дробь — стоячей (⟦f⟧). Минус — U+2212.
function qCond(c) {
  const a = toQ(c)
  if (a.q === 1) return String(a.p).replace(/^-/, MINUS)
  const s = a.p < 0 ? MINUS : ""
  return s + fT(Math.abs(a.p), a.q)
}
// Число в ОТВЕТЕ (plain): дробь инлайном «7/2», десятичные с запятой.
function qAns(c) {
  const a = toQ(c)
  if (a.q === 1) return String(a.p).replace(/^-/, MINUS)
  return `${String(a.p).replace(/^-/, MINUS)}/${a.q}`
}
// Десятичная запись (для показов вида «≥ 0,5»).
const ru = (x) => String(x).replace(".", ",").replace(/^-/, MINUS)

// Число ВНУТРИ дроби: вложенный ⟦f⟧ рендер не разворачивает (⟦f⟧ не вложенный),
// поэтому дробные коэффициенты в числителе/знаменателе печатаем десятичной записью.
function qDec(c) {
  const a = toQ(c)
  if (a.q === 1) return String(a.p).replace(/^-/, MINUS)
  let q = a.q, k2 = 0, k5 = 0
  while (q % 2 === 0) { q /= 2; k2++ }
  while (q % 5 === 0) { q /= 5; k5++ }
  if (q !== 1) return `${String(a.p).replace(/^-/, MINUS)}/${a.q}`   // не десятичная — инлайн
  return ru(String(Number((a.p / a.q).toFixed(Math.max(k2, k5) + 1)).valueOf()))
}

// ── корни: √D с вынесением полного квадрата ──────────────────────────────────
function sqrtParts(D) { // D>0 целое → {k, m}: k√m
  let k = 1, m = D
  for (let d = 2; d * d <= m; d++) { while (m % (d * d) === 0) { m /= d * d; k *= d } }
  return { k, m }
}
function sqrtStrAns(D) { const { k, m } = sqrtParts(D); if (m === 1) return String(k); return k === 1 ? `√${m}` : `${k}√${m}` }
// eslint-disable-next-line no-unused-vars -- нужен в разделах с иррациональностями в УСЛОВИИ
function sqrtStrCond(D) { const { k, m } = sqrtParts(D); if (m === 1) return String(k); return k === 1 ? `⟦r:${m}⟧` : `${k}⟦r:${m}⟧` }

// ── концы промежутков: {v — число, s — как печатать в ответе} ────────────────
const EP = (v, s) => ({ v, s })
const NEG_INF = EP(-Infinity, "−∞")
const POS_INF = EP(Infinity, "+∞")
const epQ = (c) => { const a = toQ(c); return EP(Qnum(a), qAns(a)) }
// a ± √D (D — целое >0): точное значение и красивая печать
function epSurd(a, D, sign) {
  const A = toQ(a), val = Qnum(A) + sign * Math.sqrt(D)
  const { k, m } = sqrtParts(D)
  if (m === 1) return epQ(Qadd(A, Q(sign * k)))   // √D целое — печатаем числом, а не «−1 − 1»
  const rt = sqrtStrAns(D)
  if (A.p === 0) return EP(val, sign > 0 ? rt : MINUS + rt)
  return EP(val, `${qAns(A)} ${sign > 0 ? "+" : MINUS} ${rt}`)
}

// ── многочлен на показ ───────────────────────────────────────────────────────
// terms: [{c, k}] — коэффициент (число или {p,q}) и степень, В ПОРЯДКЕ ПОКАЗА.
function polyStr(terms, v = "x", flat = false) {
  let out = ""
  for (const { c, k } of terms) {
    const a = toQ(c)
    if (a.p === 0) continue
    const neg = a.p < 0
    const abs = Q(Math.abs(a.p), a.q)
    const one = abs.p === 1 && abs.q === 1
    let body = one && k > 0 ? "" : (flat ? qDec(abs) : qCond(abs))
    body += k === 0 ? "" : k === 1 ? v : `${v}${SUPD[k]}`
    out += out === "" ? (neg ? MINUS : "") + body : ` ${neg ? MINUS : "+"} ${body}`
  }
  return out || "0"
}
// «x + 6», «x − 6», «x» — линейный множитель со сдвигом
const linStr = (shift, v = "x") => (shift === 0 ? v : shift > 0 ? `${v} + ${shift}` : `${v} ${MINUS} ${-shift}`)

// ── метод интервалов ─────────────────────────────────────────────────────────
// crit: [{ep, mult, pole}] по возрастанию ep.v; lead — знак выражения при x→+∞ (+1/−1);
// cmp — «≥ | > | ≤ | <». Возвращает массив промежутков {a, b, ai, bi}.
function solveSign(crit, lead, cmp) {
  const strict = cmp === ">" || cmp === "<"
  const want = cmp === ">" || cmp === "≥" ? 1 : -1
  const n = crit.length
  const signs = new Array(n + 1)
  signs[n] = lead
  for (let i = n - 1; i >= 0; i--) signs[i] = crit[i].mult % 2 ? -signs[i + 1] : signs[i + 1]
  const parts = []
  for (let i = 0; i <= n; i++) {
    if (signs[i] !== want) continue
    parts.push({
      a: i === 0 ? NEG_INF : crit[i - 1].ep,
      b: i === n ? POS_INF : crit[i].ep,
      ai: i > 0 && !strict && !crit[i - 1].pole,
      bi: i < n && !strict && !crit[i].pole,
    })
  }
  if (!strict) { // изолированные нули (кратность чётная либо зажаты «не тем» знаком)
    for (const c of crit) {
      if (c.pole) continue
      const inside = parts.some((p) => (c.ep.v > p.a.v && c.ep.v < p.b.v) ||
        (c.ep.v === p.a.v && p.ai) || (c.ep.v === p.b.v && p.bi))
      if (!inside) parts.push({ a: c.ep, b: c.ep, ai: true, bi: true })
    }
  }
  return normalizeSet(parts)
}
// объединение соприкасающихся промежутков, сортировка
function normalizeSet(parts) {
  const ps = parts.slice().sort((x, y) => x.a.v - y.a.v || x.b.v - y.b.v)
  const out = []
  for (const p of ps) {
    const last = out[out.length - 1]
    if (last && (p.a.v < last.b.v || (p.a.v === last.b.v && (last.bi || p.ai)))) {
      if (p.b.v > last.b.v) { last.b = p.b; last.bi = p.bi } else if (p.b.v === last.b.v) last.bi = last.bi || p.bi
      continue
    }
    out.push({ ...p })
  }
  return out
}
// пересечение множества с промежутком {a,b,ai,bi} (для ОДЗ)
function intersectSet(set, dom) {
  const out = []
  for (const p of set) {
    const a = p.a.v > dom.a.v ? p.a : dom.a
    const ai = p.a.v === dom.a.v ? p.ai && dom.ai : p.a.v > dom.a.v ? p.ai : dom.ai
    const b = p.b.v < dom.b.v ? p.b : dom.b
    const bi = p.b.v === dom.b.v ? p.bi && dom.bi : p.b.v < dom.b.v ? p.bi : dom.bi
    if (a.v > b.v) continue
    if (a.v === b.v && !(ai && bi)) continue
    out.push({ a, b, ai, bi })
  }
  return out
}
// выкалывание одной точки из множества
function punctureSet(set, ep) {
  const out = []
  for (const p of set) {
    if (ep.v <= p.a.v || ep.v >= p.b.v) {
      if (ep.v === p.a.v && p.ai) out.push({ ...p, ai: false })
      else if (ep.v === p.b.v && p.bi) out.push({ ...p, bi: false })
      else out.push(p)
      continue
    }
    out.push({ a: p.a, b: ep, ai: p.ai, bi: false })
    out.push({ a: ep, b: p.b, ai: false, bi: p.bi })
  }
  return out.filter((p) => p.a.v < p.b.v || (p.a.v === p.b.v && p.ai && p.bi))
}

// ── печать множества-ответа ──────────────────────────────────────────────────
function fmtSet(set) {
  if (!set.length) return "решений нет"
  return set.map((p) => {
    if (p.a.v === p.b.v) return `{${p.a.s}}`
    return `${p.ai ? "[" : "("}${p.a.s}; ${p.b.s}${p.bi ? "]" : ")"}`
  }).join(" ∪ ")
}

// ── приведённая форма как функция (знак-эквивалент буквальной разности) ──────
const mkReduced = (lead, crit) => (x) => {
  let r = lead
  for (const c of crit) {
    const d = x - c.ep.v
    r *= c.pole ? 1 / Math.pow(d, c.mult) : Math.pow(d, c.mult)
  }
  return r
}

// ── сборка объекта задания ───────────────────────────────────────────────────
// opts: text, lhs, rhs, cmp, crit, lead, domainOK?, domain? (промежуток ОДЗ),
//       puncture? (точки, выколотые ОДЗ), extraX? (доп. особые точки для сетки)
function build(opts) {
  const crit = opts.crit.slice().sort((a, b) => a.ep.v - b.ep.v)
  for (let i = 1; i < crit.length; i++) if (Math.abs(crit[i].ep.v - crit[i - 1].ep.v) < 1e-9) return null
  let ans = solveSign(crit, opts.lead, opts.cmp)
  if (opts.domain) ans = intersectSet(ans, opts.domain)
  for (const ep of opts.puncture || []) ans = punctureSet(ans, ep)
  ans = normalizeSet(ans)
  if (!ans.length) return null
  if (ans.length === 1 && !isFinite(ans[0].a.v) && !isFinite(ans[0].b.v)) return null
  const xs = crit.map((c) => c.ep.v)
    .concat((opts.puncture || []).map((e) => e.v))
    .concat(opts.extraX || [])
    .concat(opts.domain ? [opts.domain.a.v, opts.domain.b.v] : [])
    .filter((v) => isFinite(v))
  const lo = Math.min(...xs) - 3, hi = Math.max(...xs) + 3
  return {
    condition_text: `Решите неравенство\n${opts.text}`,
    answer: fmtSet(ans),
    _verify: {
      lhs: opts.lhs, rhs: opts.rhs, cmp: opts.cmp,
      domainOK: opts.domainOK || (() => true),
      ans, crit: xs, range: [lo, hi], reduced: opts.reduced || mkReduced(opts.lead, crit),
    },
  }
}

// ── самопроверка (используется смоук-тестом) ─────────────────────────────────
// 1) на сетке ~20 000 точек: для каждой x из ОДЗ факт (literalLHS ⋛ literalRHS)
//    совпадает с «x ∈ напечатанный ответ»;
// 2) каждый конец: нестрогий — выполняется, строгий — не выполняется;
// 3) точки вне ОДЗ не входят в ответ;
// 4) ответ не пуст и не равен всей числовой прямой;
// 5) знак приведённой формы совпадает со знаком буквальной разности.
export function verify15(item) {
  if (!item || !item._verify) return { ok: false, err: "нет объекта/_verify" }
  const { lhs, rhs, cmp, domainOK, ans, crit, range, reduced } = item._verify
  if (!ans.length) return { ok: false, err: "пустой ответ" }
  if (ans.length === 1 && !isFinite(ans[0].a.v) && !isFinite(ans[0].b.v)) return { ok: false, err: "ответ = вся прямая" }
  const inAns = (x) => ans.some((I) => (x > I.a.v || (x === I.a.v && I.ai)) && (x < I.b.v || (x === I.b.v && I.bi)))
  // Разность буквальных частей. null — не вычисляется (переполнение/вне ОДЗ);
  // 0 — численно неотличимо от равенства (окрестность нуля/кратного корня).
  const diff = (x) => {
    const L = lhs(x), R = rhs(x)
    if (!Number.isFinite(L) || !Number.isFinite(R)) return null
    const d = L - R
    const tol = 1e-9 * Math.max(1, Math.abs(L), Math.abs(R))
    return Math.abs(d) <= tol ? 0 : d
  }
  const cmpTo = (d) => (cmp === "≥" ? d >= 0 : cmp === ">" ? d > 0 : cmp === "≤" ? d <= 0 : d < 0)
  const near = (x) => crit.some((c) => Math.abs(x - c) < 1e-6)
  const [lo, hi] = range, N = 20000, h = (hi - lo) / N
  for (let i = 0; i <= N; i++) {
    const x = lo + h * i
    if (near(x)) continue
    if (!domainOK(x)) {
      if (inAns(x)) return { ok: false, err: `x=${x.toFixed(6)} вне ОДЗ, но входит в ответ` }
      continue
    }
    const d0 = diff(x)
    if (d0 === null || d0 === 0) continue // численно неразличимо с равенством — не судим
    const H = cmpTo(d0)
    if (H !== inAns(x)) return { ok: false, err: `x=${x.toFixed(6)}: неравенство ${H ? "верно" : "неверно"}, а в ответе ${inAns(x) ? "есть" : "нет"}` }
    if (reduced) {
      const r = reduced(x), d = d0
      if (Number.isFinite(r) && Math.abs(r) > 1e-7 && Math.abs(d) > 1e-7 && Math.sign(r) !== Math.sign(d)) {
        return { ok: false, err: `x=${x.toFixed(6)}: знак приведённой формы ≠ знаку буквальной разности` }
      }
    }
  }
  for (const I of ans) {
    for (const [ep, inc] of [[I.a, I.ai], [I.b, I.bi]]) {
      if (!isFinite(ep.v)) continue
      const dom = domainOK(ep.v)
      const de = dom ? diff(ep.v) : null
      const H = de === null ? false : cmpTo(de)
      if (inc && H !== true) return { ok: false, err: `конец ${ep.s} включён, но неравенство не выполняется` }
      if (!inc && H === true) return { ok: false, err: `конец ${ep.s} исключён, но неравенство выполняется` }
    }
  }
  return { ok: true }
}

// ════════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 1. РАЦИОНАЛЬНЫЕ НЕРАВЕНСТВА
// ════════════════════════════════════════════════════════════════════════════

// [1] x + A/(x+p) ⋛ c    (PDF рац.1: x + 20/(x+6) ≥ 6)
// Приведение: (x−r1)(x−r2)/(x+p) ⋛ 0. Из тождества c = p+r1+r2, A = r1r2+cp.
export function t15RatShift() {
  for (let it = 0; it < 400; it++) {
    const p = randInt(-9, 9)
    let r1 = randInt(-9, 9), r2 = randInt(-9, 9)
    if (r1 === r2) continue
    if (r1 > r2) [r1, r2] = [r2, r1]
    if (r1 === -p || r2 === -p) continue
    const c = p + r1 + r2, A = r1 * r2 + c * p
    if (A === 0 || Math.abs(A) > 60 || Math.abs(c) > 20) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const sgn = A < 0 ? MINUS : "+"
    const text = `x ${sgn} ${fT(Math.abs(A), linStr(p))} ${cmp} ${qAns(c)}`
    const res = build({
      text, cmp,
      lhs: (x) => x + A / (x + p), rhs: () => c,
      domainOK: (x) => Math.abs(x + p) > 1e-12,
      lead: 1,
      crit: [
        { ep: epQ(r1), mult: 1, pole: false },
        { ep: epQ(r2), mult: 1, pole: false },
        { ep: epQ(-p), mult: 1, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}

// [2] (x³+…)/(x²+…) ⋛ x+m   (PDF рац.2: (x³−13x²+44x−30)/(x²−11x+30) ≥ x−1)
// P = s(x−r1)(x−r2) + (x+m)·Q, Q=(x−q1)(x−q2) → приведение даёт s(x−r1)(x−r2)/Q.
export function t15RatCubicOverQuad() {
  for (let it = 0; it < 400; it++) {
    const q1 = randInt(-7, 7), q2 = randInt(-7, 7)
    if (q1 === q2) continue
    const r1 = randInt(-7, 7), r2 = randInt(-7, 7)
    if (r1 === r2 || r1 === q1 || r1 === q2 || r2 === q1 || r2 === q2) continue
    const s = pick([1, -1]), m = randInt(-4, 4)
    // Q = x² + Qb x + Qc ; N = s(x² −(r1+r2)x + r1r2)
    const Qb = -(q1 + q2), Qc = q1 * q2
    const Nb = -s * (r1 + r2), Nc = s * r1 * r2
    // P = N + (x+m)Q = x³ + (Qb+m)x² + (Qc + m·Qb + s)x·? — раскроем аккуратно:
    const P3 = 1
    const P2 = Qb + m + s
    const P1 = Qc + m * Qb + Nb
    const P0 = m * Qc + Nc
    if (Math.abs(P2) > 30 || Math.abs(P1) > 90 || Math.abs(P0) > 120) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const num = polyStr([{ c: P3, k: 3 }, { c: P2, k: 2 }, { c: P1, k: 1 }, { c: P0, k: 0 }])
    const den = polyStr([{ c: 1, k: 2 }, { c: Qb, k: 1 }, { c: Qc, k: 0 }])
    const text = `${fT(num, den)} ${cmp} ${polyStr([{ c: 1, k: 1 }, { c: m, k: 0 }])}`
    const Pf = (x) => ((x + P2) * x + P1) * x + P0
    const Qf = (x) => (x + Qb) * x + Qc
    const res = build({
      text, cmp,
      lhs: (x) => Pf(x) / Qf(x), rhs: (x) => x + m,
      domainOK: (x) => Math.abs(Qf(x)) > 1e-12,
      lead: s,
      crit: [
        { ep: epQ(r1), mult: 1, pole: false },
        { ep: epQ(r2), mult: 1, pole: false },
        { ep: epQ(q1), mult: 1, pole: true },
        { ep: epQ(q2), mult: 1, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}

// [3] (x²+bx+c)/(x−q1) + A/(x−q2) ⋛ x   (PDF рац.3)
// Числитель приведения: (b+q1)x² + (c − b·q2 + A − q1q2)x − (c·q2 + A·q1) = L(x−r1)(x−r2).
export function t15RatTwoFracLinear() {
  for (let it = 0; it < 600; it++) {
    const q1 = randInt(-6, 6), q2 = randInt(-6, 6)
    if (q1 === q2) continue
    const r1 = randInt(-7, 7), r2 = randInt(-7, 7)
    if (r1 === r2 || [q1, q2].includes(r1) || [q1, q2].includes(r2)) continue
    const L = pick([1, -1, 2, -2])
    const b = L - q1
    const S = -L * (r1 + r2) + b * q2 + q1 * q2   // c + A
    const T = -L * r1 * r2                        // c·q2 + A·q1
    const den = q2 - q1
    if ((T - q1 * S) % den !== 0) continue
    const c = (T - q1 * S) / den, A = S - c
    if (A === 0 || Math.abs(A) > 40 || Math.abs(c) > 40 || Math.abs(b) > 12) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const numText = polyStr([{ c: 1, k: 2 }, { c: b, k: 1 }, { c: c, k: 0 }])
    const sgn = A < 0 ? MINUS : "+"
    const text = `${fT(numText, linStr(-q1))} ${sgn} ${fT(Math.abs(A), linStr(-q2))} ${cmp} x`
    const res = build({
      text, cmp,
      lhs: (x) => ((x + b) * x + c) / (x - q1) + A / (x - q2), rhs: (x) => x,
      domainOK: (x) => Math.abs(x - q1) > 1e-12 && Math.abs(x - q2) > 1e-12,
      lead: L > 0 ? 1 : -1,
      crit: [
        { ep: epQ(r1), mult: 1, pole: false },
        { ep: epQ(r2), mult: 1, pole: false },
        { ep: epQ(q1), mult: 1, pole: true },
        { ep: epQ(q2), mult: 1, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}

// [3b] A/(mx−n) + (kx²+qx+r)/(x−s) ⋛ kx   (PDF рац.3дз: 1/(5x−12) + (2x²−6x+1)/(x−3) ≥ 2x)
// Приведение: m(q+ks)x² + (rm − qn + A − kns)x − (As+rn) = L(x−r1)(x−r2) над (mx−n)(x−s).
export function t15RatTwoFracCoef() {
  for (let it = 0; it < 4000; it++) {
    const m = pick([2, 3, 4, 5]), n = randInt(2, 14)
    if (gcd(m, n) !== 1) continue           // знаменатель вида 5x−12 — несократимый, как в ФИПИ
    const s = randInt(-6, 6), k = pick([1, 2, 3])
    const pole1 = n / m
    if (Math.abs(pole1 - s) < 1e-9) continue
    const r1 = randInt(-6, 6), r2 = randInt(-6, 6)
    if (r1 === r2) continue
    if ([r1, r2].includes(s) || Math.abs(r1 - pole1) < 1e-9 || Math.abs(r2 - pole1) < 1e-9) continue
    const L = pick([1, -1, 2, -2, 3, -3])
    if (L % m !== 0) continue
    const q = L / m - k * s
    // A − kns + rm − qn = −L(r1+r2);  −(As + rn) = L·r1·r2
    // → A = −L(r1+r2) + kns + qn − rm ; подставим во второе и найдём r.
    // (−L(r1+r2)+kns+qn−rm)·s + rn = −L r1 r2
    // r(n − ms) = −L r1 r2 − s(−L(r1+r2)+kns+qn)
    const den = n - m * s
    if (den === 0) continue
    const numr = -L * r1 * r2 - s * (-L * (r1 + r2) + k * n * s + q * n)
    if (numr % den !== 0) continue
    const r = numr / den
    const A = -L * (r1 + r2) + k * n * s + q * n - r * m
    if (A <= 0 || A > 40 || Math.abs(q) > 20 || Math.abs(r) > 40) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const numText = polyStr([{ c: k, k: 2 }, { c: q, k: 1 }, { c: r, k: 0 }])
    const denText = polyStr([{ c: m, k: 1 }, { c: -n, k: 0 }])
    const text = `${fT(A, denText)} + ${fT(numText, linStr(-s))} ${cmp} ${polyStr([{ c: k, k: 1 }])}`
    const res = build({
      text, cmp,
      lhs: (x) => A / (m * x - n) + ((k * x + q) * x + r) / (x - s), rhs: (x) => k * x,
      domainOK: (x) => Math.abs(m * x - n) > 1e-12 && Math.abs(x - s) > 1e-12,
      lead: L > 0 ? 1 : -1,
      crit: [
        { ep: epQ(r1), mult: 1, pole: false },
        { ep: epQ(r2), mult: 1, pole: false },
        { ep: epQ(Q(n, m)), mult: 1, pole: true },
        { ep: epQ(s), mult: 1, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}

// [4] x³+bx² + (Ax²+Bx+C)/(x−p) ⋛ c   (PDF рац.4: x³+6x² + (28x²+2x−10)/(x−5) ≤ 2)
// Приведение: (x−u)²(x−r1)(x−r2)/(x−p) ⋛ 0 — с КРАТНЫМ корнем u (знак не меняется).
export function t15RatCubicPlusFrac() {
  for (let it = 0; it < 600; it++) {
    const p = randInt(-7, 7)
    const u = randInt(-5, 5), r1 = randInt(-6, 6), r2 = randInt(-6, 6)
    if (r1 === r2 || u === r1 || u === r2) continue
    if ([u, r1, r2].includes(p)) continue
    // N = (x−u)²(x−r1)(x−r2) = x⁴ + n3x³ + n2x² + n1x + n0
    const e1 = 2 * u + r1 + r2
    const e2 = u * u + 2 * u * (r1 + r2) + r1 * r2
    const e3 = u * u * (r1 + r2) + 2 * u * r1 * r2
    const e4 = u * u * r1 * r2
    const n3 = -e1, n2 = e2, n1 = -e3, n0 = e4
    const b = n3 + p
    const c = randInt(-6, 6)
    const A = n2 + b * p, B = n1 + c, C = n0 - c * p
    if (A <= 0 || Math.abs(b) > 14 || A > 90 || Math.abs(B) > 90 || Math.abs(C) > 200) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const left = polyStr([{ c: 1, k: 3 }, { c: b, k: 2 }])
    const numText = polyStr([{ c: A, k: 2 }, { c: B, k: 1 }, { c: C, k: 0 }])
    const text = `${left} + ${fT(numText, linStr(-p))} ${cmp} ${qAns(c)}`
    const res = build({
      text, cmp,
      lhs: (x) => x * x * x + b * x * x + ((A * x + B) * x + C) / (x - p), rhs: () => c,
      domainOK: (x) => Math.abs(x - p) > 1e-12,
      lead: 1,
      crit: [
        { ep: epQ(u), mult: 2, pole: false },
        { ep: epQ(r1), mult: 1, pole: false },
        { ep: epQ(r2), mult: 1, pole: false },
        { ep: epQ(p), mult: 1, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}

// [5] (ax+b)²/(x−p) ⋛ (тот же квадрат по возрастанию)/(x−p)(x−q)   (PDF рац.5)
// Приведение: (ax+b)²·(x−q−1)/((x−p)(x−q)) ⋛ 0 — ловушка «кратный корень −b/a».
export function t15RatSquareCancel() {
  for (let it = 0; it < 400; it++) {
    const a = randInt(2, 6), b = randInt(1, 9) * pick([1, -1])
    if (gcd(a, Math.abs(b)) !== 1) continue   // (4x+7)², а не (5x−5)²
    const p = randInt(-6, 6), q = randInt(-6, 6)
    if (p === q) continue
    if (p * q <= 0 || p + q === 0) continue   // знаменатель справа: «21 − 10x + x²» (свободный член ≠ 0)
    const w = q + 1                      // нуль множителя (x−q−1)
    const root = Q(-b, a)
    if ([p, q, w].some((t) => Math.abs(t - Qnum(root)) < 1e-9)) continue
    if (w === p || w === q) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const sq = [{ c: b * b, k: 0 }, { c: 2 * a * b, k: 1 }, { c: a * a, k: 2 }] // по возрастанию, как в PDF
    const dq = [{ c: p * q, k: 0 }, { c: -(p + q), k: 1 }, { c: 1, k: 2 }]
    const leftNum = `(${polyStr([{ c: a, k: 1 }, { c: b, k: 0 }])})${SUPD[2]}`
    const text = `${fT(leftNum, linStr(-p))} ${cmp} ${fT(polyStr(sq), polyStr(dq))}`
    const S = (x) => (a * x + b) * (a * x + b)
    const res = build({
      text, cmp,
      lhs: (x) => S(x) / (x - p), rhs: (x) => S(x) / ((x - p) * (x - q)),
      domainOK: (x) => Math.abs(x - p) > 1e-12 && Math.abs(x - q) > 1e-12,
      lead: 1,
      crit: [
        { ep: epQ(root), mult: 2, pole: false },
        { ep: epQ(w), mult: 1, pole: false },
        { ep: epQ(p), mult: 1, pole: true },
        { ep: epQ(q), mult: 1, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}

// [6] x³+bx²+c₀ − (a₃x³+a₂x²)/(k(x−p)) ⋛ ((mx+n)²+w)/(x−p)   (PDF рац.6)
// Всё сводится к одной дроби: k(x−r1)(x−r2)(x−r3)(x−r4)/(k(x−p)).
export function t15RatCommonDen() {
  for (let it = 0; it < 600; it++) {
    const k = pick([1, 2])
    const p = randInt(-7, 7)
    const roots = []
    const u = randInt(-4, 4)
    roots.push(u, u) // кратный корень — знак не меняется
    let ok = true
    for (let i = 0; i < 2; i++) {
      let r = randInt(-6, 6), guard = 0
      while ((roots.includes(r) || r === p) && guard++ < 40) r = randInt(-6, 6)
      if (roots.includes(r) || r === p) { ok = false; break }
      roots.push(r)
    }
    if (!ok || roots.includes(p)) continue
    // N/k = (x−r1)(x−r2)(x−r3)(x−r4) = x⁴ + n3x³ + n2x² + n1x + n0
    const [A1, A2, A3, A4] = roots
    const s1 = A1 + A2 + A3 + A4
    const s2 = A1 * A2 + A1 * A3 + A1 * A4 + A2 * A3 + A2 * A4 + A3 * A4
    const s3 = A1 * A2 * A3 + A1 * A2 * A4 + A1 * A3 * A4 + A2 * A3 * A4
    const s4 = A1 * A2 * A3 * A4
    const n3 = -s1, n2 = s2, n1 = -s3, n0 = s4
    const b = randInt(-9, 9), m = pick([2, 3, 4]), nn = randInt(-5, 5)
    const a3 = k * (b - p - n3)
    const a2 = -k * (b * p + m * m + n2)
    const c0 = n1 + 2 * m * nn
    const w = -c0 * p - nn * nn - n0
    if (a3 <= 0 || a2 === 0) continue   // как в ФИПИ: (8x³ − 73x²), ведущий коэффициент положителен
    if (Math.abs(c0) > 60) continue
    if ([Math.abs(a3), Math.abs(a2), Math.abs(w)].some((v) => v > 200)) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const left = polyStr([{ c: 1, k: 3 }, { c: b, k: 2 }, { c: c0, k: 0 }])
    const fracNum = polyStr([{ c: a3, k: 3 }, { c: a2, k: 2 }])
    const fracDen = k === 1 ? linStr(-p) : `${k}(${linStr(-p)})`
    const rightNum = `(${polyStr([{ c: m, k: 1 }, { c: nn, k: 0 }])})${SUPD[2]} ${w < 0 ? MINUS : "+"} ${Math.abs(w)}`
    const text = `${left} ${MINUS} ${fT(fracNum, fracDen)} ${cmp} ${fT(rightNum, linStr(-p))}`
    const critList = [{ ep: epQ(p), mult: 1, pole: true }]
    const seen = {}
    for (const r of roots) seen[r] = (seen[r] || 0) + 1
    for (const key of Object.keys(seen)) critList.push({ ep: epQ(Number(key)), mult: seen[key], pole: false })
    const res = build({
      text, cmp,
      lhs: (x) => x * x * x + b * x * x + c0 - (a3 * x * x * x + a2 * x * x) / (k * (x - p)),
      rhs: (x) => ((m * x + nn) * (m * x + nn) + w) / (x - p),
      domainOK: (x) => Math.abs(x - p) > 1e-12,
      lead: 1,
      crit: critList,
    })
    if (res) return res
  }
  return null
}

// [7] ((x²+2σx)² + A(x+σ)² + B)/((x+σ)² + tx + s) ⋛ 0   (PDF рац.7)
// Замена u = x²+2σx: числитель = (u−u1)(u−u2); знаменатель — ПОЛНЫЙ КВАДРАТ (x+e)²
// (или −(x−e)²), т.е. ОДЗ выкалывает точку, которая часто лежит ВНУТРИ ответа.
export function t15RatSubstSquare() {
  for (let it = 0; it < 800; it++) {
    const sg = randInt(1, 4)                        // σ в замене u = x² + 2σx
    const eps = Math.random() < 0.4 ? -1 : 1        // знак знаменателя: ε(x−e)²
    const e = pick([Q(2 * randInt(-9, 9) + 1, 2), Q(randInt(-8, 8))])  // корень знаменателя (часто полуцелый)
    const g = randInt(-5, 5)                        // база квадрата В ПОКАЗЕ: (x+g)²
    const u1 = randInt(-9, 9), u2 = randInt(-9, 9)
    if (u1 === u2) continue
    const lo = Math.min(u1, u2), hi = Math.max(u1, u2)
    if (sg * sg + lo <= 0 || sg * sg + hi <= 0) continue // нужны вещественные корни у обеих скобок
    const A = -(u1 + u2), B = u1 * u2 - A * sg * sg     // числитель: (x²+2σx)² + A(x+σ)² + B
    if (A === 0 || B === 0 || Math.abs(A) > 30 || Math.abs(B) > 90) continue
    // знаменатель: ε(x+g)² + t·x + s  ≡  ε(x−e)²   →  t = −2ε(e+g), s = ε(e²−g²)
    const t = Qmul(Q(-2 * eps), Qadd(e, Q(g)))
    const s = Qmul(Q(eps), Qadd(Qmul(e, e), Q(-g * g)))
    if (t.p === 0 || s.p === 0) continue
    if (Math.abs(t.p) > 40 || Math.abs(s.p) > 400) continue
    const eV = Qnum(e)
    const D1 = sg * sg + lo, D2 = sg * sg + hi
    const crit = [
      { ep: epSurd(-sg, D1, -1), mult: 1, pole: false },
      { ep: epSurd(-sg, D1, +1), mult: 1, pole: false },
      { ep: epSurd(-sg, D2, -1), mult: 1, pole: false },
      { ep: epSurd(-sg, D2, +1), mult: 1, pole: false },
    ].sort((a1, b1) => a1.ep.v - b1.ep.v)
    if (crit.some((c) => Math.abs(c.ep.v - eV) < 1e-6)) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const sq = (sh) => (sh === 0 ? `x${SUPD[2]}` : `(${linStr(sh)})${SUPD[2]}`)
    const signed = (c, body) => { // «− 3(x+1)²», «− (x+1)²», «+ 21/4»
      const a = toQ(c), abs = Q(Math.abs(a.p), a.q)
      const num = abs.p === 1 && abs.q === 1 && body ? "" : qDec(abs)
      return ` ${a.p < 0 ? MINUS : "+"} ${num}${body}`
    }
    // (x²+2σx)² + A(x+σ)² + B
    const numText = `(${polyStr([{ c: 1, k: 2 }, { c: 2 * sg, k: 1 }])})${SUPD[2]}${signed(A, sq(sg))}${signed(B, "")}`
    const denText = eps > 0
      ? `${sq(g)}${signed(t, "x")}${signed(s, "")}`
      : `${polyStr([{ c: t, k: 1 }, { c: s, k: 0 }], "x", true)} ${MINUS} ${sq(g)}`
    const text = `${fT(numText, denText)} ${cmp} 0`
    const uOf = (x) => x * x + 2 * sg * x
    const denF = (x) => eps * (x + g) * (x + g) + Qnum(t) * x + Qnum(s)
    const res = build({
      text, cmp,
      lhs: (x) => (uOf(x) * uOf(x) + A * (x + sg) * (x + sg) + B) / denF(x),
      rhs: () => 0,
      domainOK: (x) => Math.abs(x - eV) > 1e-9,
      lead: eps,
      crit,
      puncture: [epQ(e)],
      extraX: [eV],
    })
    if (res) return res
  }
  return null
}

// [8] (A/(x−p) + (x−p)/A)² ≤ C²   (PDF рац.8: (2/(x−4) + (x−4)/2)² ≤ 100/9)
// y=(x−p)/A: (y+1/y)² ≤ C², C = k+1/k → нули y ∈ {±k, ±1/k}, полюс y=0.
export function t15RatSumSquare() {
  for (let it = 0; it < 200; it++) {
    const A = randInt(2, 5), p = randInt(-8, 8), k = randInt(2, 5)
    const C = Q(k * k + 1, k)                 // C = k + 1/k
    const C2 = Qmul(C, C)
    const cmp = pick(["≤", "<"])
    const xOf = (y) => Q(A * y.p + p * y.q, y.q) // x = A·y + p
    const ys = [Q(-k), Q(-1, k), Q(1, k), Q(k)]
    const crit = ys.map((y) => ({ ep: epQ(xOf(y)), mult: 1, pole: false }))
    crit.push({ ep: epQ(p), mult: 2, pole: true })
    const text = `(${fT(A, linStr(-p))} + ${fT(linStr(-p), A)})${SUPD[2]} ${cmp} ${fT(C2.p, C2.q)}`
    const F = (x) => { const v = A / (x - p) + (x - p) / A; return v * v }
    const res = build({
      text, cmp,
      lhs: F, rhs: () => Qnum(C2),
      domainOK: (x) => Math.abs(x - p) > 1e-12,
      lead: 1,
      crit,
    })
    if (res) return res
  }
  return null
}

// ── реестры ─────────────────────────────────────────────────────────────────
export const META15 = [
  ["Рациональные неравенства", [
    ["rat-shift", "x + A/(x+p) ⋛ c", t15RatShift],
    ["rat-cubic-quad", "(куб)/(квадрат) ⋛ x+m", t15RatCubicOverQuad],
    ["rat-two-frac", "(x²+bx+c)/(x−q₁) + A/(x−q₂) ⋛ x", t15RatTwoFracLinear],
    ["rat-two-frac-k", "A/(mx−n) + (kx²+qx+r)/(x−s) ⋛ kx", t15RatTwoFracCoef],
    ["rat-cubic-frac", "x³+bx² + (Ax²+Bx+C)/(x−p) ⋛ c (кратный корень)", t15RatCubicPlusFrac],
    ["rat-sq-cancel", "(ax+b)²/(x−p) ⋛ (ax+b)²/((x−p)(x−q)) — сокращение квадрата", t15RatSquareCancel],
    ["rat-common-den", "куб − дробь ⋛ дробь: общий знаменатель", t15RatCommonDen],
    ["rat-subst-sq", "замена u=x²+2σx, знаменатель — полный квадрат (ОДЗ режет ответ)", t15RatSubstSquare],
    ["rat-sum-sq", "(A/(x−p) + (x−p)/A)² ⋛ C²", t15RatSumSquare],
  ]],
]

export const GEN15 = META15.flatMap((g) => g[1].map((t) => t[2]))
