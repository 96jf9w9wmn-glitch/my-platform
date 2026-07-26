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
    // Масштаб: у показательных/логарифмических выражений слагаемые огромны, а их разность
    // около корня — почти ноль, поэтому относительный допуск берём по ЛОКАЛЬНОЙ величине
    // функции (значения чуть в стороне), иначе float-шум сокращения читается как «не ноль».
    const h = 1e-4 * Math.max(1, Math.abs(x))
    let scale = Math.max(1, Math.abs(L), Math.abs(R))
    for (const y of [x - h, x + h]) {
      const l2 = lhs(y), r2 = rhs(y)
      if (Number.isFinite(l2)) scale = Math.max(scale, Math.abs(l2))
      if (Number.isFinite(r2)) scale = Math.max(scale, Math.abs(r2))
    }
    return Math.abs(d) <= 1e-9 * scale ? 0 : d
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


// ════════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ 2. ПОКАЗАТЕЛЬНЫЕ НЕРАВЕНСТВА
// Общая схема: замена t = b^{±x} (монотонная), неравенство собирается из НУЛЕЙ по t,
// обратный переход x = ±log_b t. Полюс t=0 недостижим, поэтому в x его нет.
// ════════════════════════════════════════════════════════════════════════════

// ── показатели степени ──────────────────────────────────────────────────────
// Степень: вне дроби — ⟦sup⟧; ВНУТРИ дроби/скобок — ⁅…⁆ (тот же надстрочник, но без
// «:» и «⟧», иначе рвётся захват ⟦f⟧). Оба токена разворачивает renderTaskMath.
function pw(base, exp, inFrac = false) {
  const e = String(exp)
  if (e === "1") return String(base)
  return inFrac ? `${base}⁅${e}⁆` : `${base}⟦sup:${e}⟧`
}
// Показатель как многочлен: «x», «x + 3», «2x − 1», «−x», «x + 1/9»
const expPoly = (terms) => polyStr(terms)

// ── концы: x = dir·log_b(t) ─────────────────────────────────────────────────
function powQ(b, k) { return k >= 0 ? Q(Math.round(Math.pow(b, k))) : Q(1, Math.round(Math.pow(b, -k))) }
// bStr — как печатать основание («2», «5/4», «5/√6»); bVal — численное значение
function epLog(bVal, t, dir = 1, bStr = null) {
  const T = toQ(t)
  const v = dir * Math.log(Qnum(T)) / Math.log(bVal)
  if (!bStr) {
    for (let k = -9; k <= 9; k++) { const P = powQ(bVal, k); if (P.p === T.p && P.q === T.q) return epQ(Q(dir * k)) }
  }
  const bs = bStr || String(bVal)
  const arg = T.q === 1 ? String(T.p) : `(${T.p}/${T.q})`
  const body = bs.length === 1 ? `log${subU(bs)}${arg}` : `log_{${bs}}${arg}`
  return EP(v, dir > 0 ? body : MINUS + body)
}

// tCrit: [{t, mult, pole}] — нули/полюса по t (учитываются только t>0: остальные
// недостижимы); leadT — знак приведённой формы при t→+∞; dir=±1 — t = b^{dir·x}.
function buildExpo(o) {
  const pos = o.tCrit.filter((c) => Qnum(toQ(c.t)) > 0)
  if (!pos.length) return null
  const parity = pos.reduce((a, c) => a + c.mult, 0) % 2
  const lead = o.dir > 0 ? o.leadT : (parity ? -o.leadT : o.leadT)
  const crit = pos.map((c) => ({ ep: epLog(o.base, toQ(c.t), o.dir, o.baseStr), mult: c.mult, pole: c.pole }))
  return build({ ...o, crit, lead })
}

// [1] Квадратный трёхчлен по t = b^x: A·B^{x+m} − k·b^{x+q} + c ⋛ 0, B = b²
//     (PDF пок.1: 4ˣ − 3·2^{x+2} + 32 ≥ 0; пок.12: 4^{x−3} − 71·2^{x−6} + 7 ≤ 0)
export function t15ExpQuad() {
  for (let it = 0; it < 2000; it++) {
    const b = pick([2, 3, 5, 7]), B = b * b
    const m = randInt(-3, 1), A = pick([1, 1, 1, 2, 3, 4])
    const a = Qmul(Q(A), powQ(b, 2 * m))                 // коэффициент при t²
    const i1 = randInt(-2, 4), i2 = randInt(-2, 4)
    const useInt = Math.random() < 0.4
    const t1 = powQ(b, i1)
    const t2 = useInt ? Q(randInt(2, 60)) : powQ(b, i2)
    if (Math.abs(Qnum(t1) - Qnum(t2)) < 1e-9) continue
    const sum = Qadd(t1, t2), prod = Qmul(t1, t2)
    const c = Qmul(a, prod)
    if (c.q !== 1 || c.p > 4000) continue
    const q = randInt(0, 3)
    const kq = Qmul(Qmul(a, sum), Q(1, Math.round(Math.pow(b, q))))
    if (kq.q !== 1 || kq.p > 400) continue
    const k = kq.p
    const cmp = pick(["≥", "≤", ">", "<"])
    const sqTerm = (A === 1 ? "" : `${A}·`) + pw(B, expPoly([{ c: 1, k: 1 }, { c: m, k: 0 }]))
    const linTerm = (k === 1 ? "" : `${k}·`) + pw(b, expPoly([{ c: 1, k: 1 }, { c: q, k: 0 }]))
    const text = `${sqTerm} ${MINUS} ${linTerm} + ${c.p} ${cmp} 0`
    const F = (x) => A * Math.pow(B, x + m) - k * Math.pow(b, x + q) + c.p
    const res = buildExpo({
      text, cmp, base: b, dir: 1, leadT: 1,
      lhs: F, rhs: () => 0,
      tCrit: [{ t: t1, mult: 1, pole: false }, { t: t2, mult: 1, pole: false }],
    })
    if (res) return res
  }
  return null
}

// [2] Тот же трёхчлен, но с ОТРИЦАТЕЛЬНЫМ показателем: t = b^{−x} (порядок концов
//     переворачивается) — PDF пок.4: 2·16^{−x} − 17·4^{−x} + 8 ≤ 0
export function t15ExpQuadNeg() {
  for (let it = 0; it < 2000; it++) {
    const b = pick([2, 3, 4, 5]), B = b * b
    const A = pick([1, 2, 3])
    const i1 = randInt(-2, 3), i2 = randInt(-2, 3)
    const t1 = powQ(b, i1), t2 = Math.random() < 0.4 ? Q(randInt(2, 40)) : powQ(b, i2)
    if (Math.abs(Qnum(t1) - Qnum(t2)) < 1e-9) continue
    const a = Q(A)
    const c = Qmul(a, Qmul(t1, t2)), kk = Qmul(a, Qadd(t1, t2))
    if (c.q !== 1 || kk.q !== 1 || c.p > 2000 || kk.p > 300) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const negX = expPoly([{ c: -1, k: 1 }])
    const sqTerm = (A === 1 ? "" : `${A}·`) + pw(B, negX)
    const linTerm = (kk.p === 1 ? "" : `${kk.p}·`) + pw(b, negX)
    const text = `${sqTerm} ${MINUS} ${linTerm} + ${c.p} ${cmp} 0`
    const F = (x) => A * Math.pow(B, -x) - kk.p * Math.pow(b, -x) + c.p
    const res = buildExpo({
      text, cmp, base: b, dir: -1, leadT: 1,
      lhs: F, rhs: () => 0,
      tCrit: [{ t: t1, mult: 1, pole: false }, { t: t2, mult: 1, pole: false }],
    })
    if (res) return res
  }
  return null
}

// [3] Дробный сдвиг в показателе: u = b^{x+f} (PDF пок.11: 9^{x+1/9} − 4·3^{x+10/9} + 27 ≥ 0)
//     Ловушка: замена обязана «съесть» дробь, иначе коэффициенты не сойдутся.
export function t15ExpQuadFracShift() {
  for (let it = 0; it < 1500; it++) {
    const b = pick([2, 3, 5]), B = b * b
    const den = pick([3, 4, 5, 6, 7, 8, 9]), nume = randInt(1, den - 1)
    if (gcd(nume, den) !== 1) continue
    const f = Q(nume, den)
    const i1 = randInt(0, 3), i2 = randInt(0, 4)
    if (i1 === i2) continue
    const t1 = powQ(b, i1), t2 = powQ(b, i2)
    const sum = Qadd(t1, t2), prod = Qmul(t1, t2)
    const kq = Qmul(sum, Q(1, b))
    if (kq.q !== 1 || prod.q !== 1) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const e0 = [{ c: 1, k: 1 }, { c: f, k: 0 }]
    const e1 = [{ c: 1, k: 1 }, { c: Qadd(f, Q(1)), k: 0 }]
    const text = `${pw(B, expPoly(e0))} ${MINUS} ${kq.p === 1 ? "" : `${kq.p}·`}${pw(b, expPoly(e1))} + ${prod.p} ${cmp} 0`
    const fv = Qnum(f)
    const F = (x) => Math.pow(B, x + fv) - kq.p * Math.pow(b, x + fv + 1) + prod.p
    // u = b^{x+f} = t ⟺ x = log_b t − f
    const crit = [t1, t2].map((t) => {
      const e = epLog(b, t, 1)
      return { ep: epQ(Qadd(Q(Math.round(e.v)), Q(-f.p, f.q))), mult: 1, pole: false }
    })
    const res = build({ text, cmp, lhs: F, rhs: () => 0, lead: 1, crit })
    if (res) return res
  }
  return null
}

// [4] Составной показатель φ(x) = ε(x−h)² + d  (PDF пок.15: 9^{4x−x²−1} − 36·3^{4x−x²−1} + 243 ≥ 0)
//     При e = d вершина даёт ИЗОЛИРОВАННУЮ точку ответа.
export function t15ExpQuadComposite() {
  for (let it = 0; it < 1500; it++) {
    const b = pick([2, 3, 5]), B = b * b
    const eps = pick([1, -1]), h = randInt(-3, 3), d = randInt(-4, 4)
    let e1 = randInt(-3, 4), e2 = randInt(-3, 4)
    if (e1 === e2) continue
    if (e1 > e2) [e1, e2] = [e2, e1]
    const t1 = powQ(b, e1), t2 = powQ(b, e2)
    const sum = Qadd(t1, t2), prod = Qmul(t1, t2)
    if (sum.q !== 1 || prod.q !== 1 || prod.p > 3000) continue
    // x-нули: φ(x) = e ⟺ (x−h)² = ε(e−d)
    const crit = []
    let anyReal = false
    for (const e of [e1, e2]) {
      const D = eps * (e - d)
      if (D < 0) continue
      anyReal = true
      if (D === 0) crit.push({ ep: epQ(Q(h)), mult: 2, pole: false })
      else { crit.push({ ep: epSurd(h, D, -1), mult: 1, pole: false }, { ep: epSurd(h, D, +1), mult: 1, pole: false }) }
    }
    if (!anyReal || crit.length < 2) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    // показ φ: εx² − 2εh·x + (εh² + d)
    const phiTerms = [{ c: eps, k: 2 }, { c: -2 * eps * h, k: 1 }, { c: eps * h * h + d, k: 0 }]
    const phi = expPoly(phiTerms)
    const text = `${pw(B, phi)} ${MINUS} ${sum.p === 1 ? "" : `${sum.p}·`}${pw(b, phi)} + ${prod.p} ${cmp} 0`
    const PHI = (x) => eps * (x - h) * (x - h) + d
    const F = (x) => Math.pow(B, PHI(x)) - sum.p * Math.pow(b, PHI(x)) + prod.p
    // знак при x→+∞: φ→ε·∞ ⟹ t→+∞ (ε=+1) либо t→0+ (ε=−1); в обоих случаях (t−t1)(t−t2)>0
    const res = build({ text, cmp, lhs: F, rhs: () => 0, lead: 1, crit })
    if (res) return res
  }
  return null
}

// [5] Двойная замена: w = B^x − 2·b^x, затем квадрат по w
//     (PDF пок.14: (9ˣ−2·3ˣ)² − 62(9ˣ−2·3ˣ) − 63 ≥ 0) — минимум w = −1 даёт изолированную точку.
export function t15ExpNestedQuad() {
  for (let it = 0; it < 600; it++) {
    const b = pick([2, 3, 5]), B = b * b
    const j = randInt(2, 4)
    const t2 = Math.round(Math.pow(b, j))            // второй нуль: t = b^j > 2
    const w2 = t2 * t2 - 2 * t2                       // внешний корень
    if (w2 <= 0 || w2 > 5000) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const w = `(${pw(B, "x")} ${MINUS} 2·${pw(b, "x")})`
    const text = `${w}${SUPD[2]} ${MINUS} ${w2 - 1}${w} ${MINUS} ${w2} ${cmp} 0`
    const W = (x) => Math.pow(B, x) - 2 * Math.pow(b, x)
    const F = (x) => W(x) * W(x) - (w2 - 1) * W(x) - w2
    // F = (w+1)(w−w2); w+1 = (t−1)² ⟹ x=0 кратности 2; w−w2 = (t−t2)(t+t2−2) ⟹ x=j
    const res = build({
      text, cmp, lhs: F, rhs: () => 0, lead: 1,
      crit: [{ ep: epQ(0), mult: 2, pole: false }, { ep: epQ(j), mult: 1, pole: false }],
    })
    if (res) return res
  }
  return null
}

// [6] A·b^{x+m} + B·b^{n−x} ⋛ C  (PDF пок.2: 2ˣ + 3·2^{−x} ≤ 4; пок.7: 2^{x+1} + 0,5^{x−3} ≥ 17)
//     Полюса t=0 нет: t>0, поэтому знак равен знаку квадратного числителя.
export function t15ExpRecip() {
  for (let it = 0; it < 2000; it++) {
    const b = pick([2, 3, 5, 7]), m = randInt(0, 1)
    const i1 = randInt(-1, 3), i2 = randInt(-1, 3)
    if (i1 === i2) continue
    const t1 = powQ(b, i1), t2 = Math.random() < 0.35 ? Q(randInt(2, 30)) : powQ(b, i2)
    if (Math.abs(Qnum(t1) - Qnum(t2)) < 1e-9) continue
    const a = Qmul(Q(1), powQ(b, m))                 // коэффициент при t
    const C = Qmul(a, Qadd(t1, t2))                  // A·b^m·(t1+t2)
    const Bc = Qmul(a, Qmul(t1, t2))                 // свободный член: B·b^n
    if (C.q !== 1 || Bc.q !== 1 || C.p > 400 || Bc.p > 400) continue
    // второй член: Bc/t = Bc·b^{−x}; показываем как b^{n−x} при Bc = b^n, иначе с коэффициентом
    const n = Math.round(Math.log(Bc.p) / Math.log(b))
    const exact = Math.abs(Math.pow(b, n) - Bc.p) < 1e-9
    const invStyle = exact && Math.random() < 0.5 && [2, 4, 5].includes(b)
    const DEC = { 2: "0,5", 4: "0,25", 5: "0,2" }
    const t1Term = pw(b, expPoly([{ c: 1, k: 1 }, { c: m, k: 0 }]))
    const t2Term = invStyle
      ? pw(DEC[b], expPoly([{ c: 1, k: 1 }, { c: -n, k: 0 }]))          // 0,5^{x−3}
      : (exact ? pw(b, expPoly([{ c: -1, k: 1 }, { c: n, k: 0 }]))      // 2^{3−x}
        : `${Bc.p}·${pw(b, expPoly([{ c: -1, k: 1 }]))}`)               // 3·2^{−x}
    const cmp = pick(["≥", "≤", ">", "<"])
    const text = `${t1Term} + ${t2Term} ${cmp} ${C.p}`
    const F = (x) => Math.pow(b, x + m) + Bc.p * Math.pow(b, -x)
    const res = buildExpo({
      text, cmp, base: b, dir: 1, leadT: 1,
      lhs: F, rhs: () => C.p,
      tCrit: [{ t: t1, mult: 1, pole: false }, { t: t2, mult: 1, pole: false }],
    })
    if (res) return res
  }
  return null
}

// [7] Симметричное: B^x + k·b^{x+s} + k·b^{s−x} + 1/B^x ⋛ C   (PDF пок.33: 9ˣ+3^{x+1}+3^{1−x}+1/9ˣ ≤ 8)
//     y = t + 1/t ≥ 2: ответ — отрезок [−j; j] (при q=1 — одна точка {0}).
export function t15ExpSymmetric() {
  for (let it = 0; it < 400; it++) {
    const b = pick([2, 3, 5]), B = b * b
    const s = randInt(0, 1), k = Math.round(Math.pow(b, s))
    const j = randInt(0, 2)
    const qq = Qadd(powQ(b, j), powQ(b, -j))          // y₂ = q + 1/q
    const C = Qadd(Qadd(Qmul(qq, qq), Qmul(Q(k), qq)), Q(-2))
    if (C.q !== 1 || C.p > 3000) continue
    const cmp = pick(["≤", "≥", "<", ">"])
    const text = `${pw(B, "x")} + ${pw(b, expPoly([{ c: 1, k: 1 }, { c: s, k: 0 }]))}` +
      ` + ${pw(b, expPoly([{ c: -1, k: 1 }, { c: s, k: 0 }]))} + ${fT(1, pw(B, "x", true))} ${cmp} ${C.p}`
    const F = (x) => Math.pow(B, x) + Math.pow(b, x + s) + Math.pow(b, s - x) + 1 / Math.pow(B, x)
    const crit = j === 0
      ? [{ ep: epQ(0), mult: 2, pole: false }]
      : [{ ep: epQ(-j), mult: 1, pole: false }, { ep: epQ(j), mult: 1, pole: false }]
    const res = build({ text, cmp, lhs: F, rhs: () => C.p, lead: 1, crit })
    if (res) return res
  }
  return null
}

// [8] Разложение на множители по двум базам: (aˣ−p)(bˣ−q) ⋛ 0 в раскрытом виде
//     (PDF пок.5: 15ˣ − 9·5ˣ − 3ˣ + 9 ≤ 0)
export function t15ExpFactorTwo() {
  for (let it = 0; it < 600; it++) {
    const [a, b] = pick([[5, 3], [3, 2], [7, 2], [5, 2], [3, 5], [2, 3]])
    if (a === b) continue
    const i = randInt(-1, 2), j = randInt(-1, 2)
    const P = powQ(a, i), Qq = powQ(b, j)             // aˣ = P ⟺ x = i;  bˣ = Q ⟺ x = j
    if (i === j) continue
    if (P.q !== 1 || Qq.q !== 1) continue
    const prod = P.p * Qq.p
    if (prod > 2000) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const c1 = Qq.p === 1 ? "" : `${Qq.p}·`, c2 = P.p === 1 ? "" : `${P.p}·`
    const text = `${pw(a * b, "x")} ${MINUS} ${c1}${pw(a, "x")} ${MINUS} ${c2}${pw(b, "x")} + ${prod} ${cmp} 0`
    const F = (x) => Math.pow(a * b, x) - Qq.p * Math.pow(a, x) - P.p * Math.pow(b, x) + prod
    const res = build({
      text, cmp, lhs: F, rhs: () => 0, lead: 1,
      crit: [{ ep: epQ(i), mult: 1, pole: false }, { ep: epQ(j), mult: 1, pole: false }],
    })
    if (res) return res
  }
  return null
}

// [9] Однородное: A·(a²)ˣ − B·(ab)ˣ − C·(b²)ˣ ⋛ 0 → делим на (b²)ˣ, z = (a/b)ˣ
//     (PDF пок.13: 25ˣ − 20ˣ − 2·16ˣ ≤ 0)
export function t15ExpHomogQuad() {
  for (let it = 0; it < 600; it++) {
    const [a, b] = pick([[5, 4], [3, 2], [5, 2], [5, 3], [4, 3], [7, 2]])
    const A = pick([1, 1, 2, 3])
    const z1 = randInt(1, 6)                          // положительный корень z
    const z2 = -randInt(1, 4)                         // отрицательный (недостижим)
    const Bc = A * (z1 + z2), Cc = -A * z1 * z2       // A z² − B z − C
    if (Bc <= 0 || Cc <= 0 || Bc > 60 || Cc > 200) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const text = `${A === 1 ? "" : `${A}·`}${pw(a * a, "x")} ${MINUS} ${Bc === 1 ? "" : `${Bc}·`}${pw(a * b, "x")} ${MINUS} ${Cc === 1 ? "" : `${Cc}·`}${pw(b * b, "x")} ${cmp} 0`
    const F = (x) => A * Math.pow(a * a, x) - Bc * Math.pow(a * b, x) - Cc * Math.pow(b * b, x)
    const res = buildExpo({
      text, cmp, base: a / b, baseStr: `${a}/${b}`, dir: 1, leadT: 1,
      lhs: F, rhs: () => 0,
      tCrit: [{ t: Q(z1), mult: 1, pole: false }],
    })
    if (res) return res
  }
  return null
}

// [10] Вынос общего множителя из суммы степеней (PDF пок.3: 9^{x−3} − 9^{x−2} + 9^{x−1} > 511)
export function t15ExpGeomSum() {
  for (let it = 0; it < 600; it++) {
    const b = pick([2, 3, 5, 9]), k = randInt(1, 3)
    const sgn = [1, pick([-1, 1]), 1]
    const S = sgn[0] + sgn[1] * b + sgn[2] * b * b
    if (S <= 0) continue
    const mQ = Math.random() < 0.5 ? Q(randInt(2, 30)) : powQ(b, randInt(1, 3))
    const C = Qmul(Q(S), mQ)
    if (C.q !== 1 || C.p > 200000) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const term = (i) => pw(b, expPoly([{ c: 1, k: 1 }, { c: -k + i, k: 0 }]))
    const text = `${term(0)} ${sgn[1] < 0 ? MINUS : "+"} ${term(1)} + ${term(2)} ${cmp} ${C.p}`
    const F = (x) => Math.pow(b, x - k) + sgn[1] * Math.pow(b, x - k + 1) + Math.pow(b, x - k + 2)
    // S·b^{x−k} ⋛ C ⟺ b^{x−k} ⋛ m
    const e = epLog(b, mQ, 1)
    const res = build({
      text, cmp, lhs: F, rhs: () => C.p, lead: 1,
      crit: [{ ep: EP(e.v + k, e.s === String(Math.round(e.v)) ? qAns(Q(Math.round(e.v) + k)) : `${k} + ${e.s}`), mult: 1, pole: false }],
    })
    if (res) return res
  }
  return null
}

// [11] Разные основания и x² в показателе: a^{x²}·b^{x−1} ⋛ a  (PDF пок.24: 3^{x²}·5^{x−1} ≥ 3)
//      Логарифмируем: (x−1)((x+1)·ln a + ln b) ⋛ 0 — второй корень иррациональный.
export function t15ExpMixedQuad() {
  for (let it = 0; it < 200; it++) {
    const a = pick([2, 3, 5]), b = pick([2, 3, 5, 7])
    if (a === b) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const text = `${pw(a, "x" + SUPD[2])}·${pw(b, expPoly([{ c: 1, k: 1 }, { c: -1, k: 0 }]))} ${cmp} ${a}`
    const F = (x) => Math.pow(a, x * x) * Math.pow(b, x - 1)
    const r2 = -1 - Math.log(b) / Math.log(a)
    const res = build({
      text, cmp, lhs: F, rhs: () => a, lead: 1,
      crit: [
        { ep: EP(r2, `${MINUS}1 ${MINUS} log${subU(a)}${b}`), mult: 1, pole: false },
        { ep: epQ(1), mult: 1, pole: false },
      ],
    })
    if (res) return res
  }
  return null
}

// [12] Корни от степеней: ⁿ√(A^{px+q}) ⋛ (B^{(rx+s)/x})^{1/2} — сводится к рациональному
//      неравенству с полюсом x=0 (PDF пок.10: ⁵√(32^{4x−3}) < √(16^{(2x+1)/x}))
export function t15ExpRootPower() {
  for (let it = 0; it < 2000; it++) {
    const n = pick([3, 5]), base = 2
    const A = Math.round(Math.pow(base, n))            // 32 = 2⁵, 8 = 2³
    const p = randInt(2, 5), q = randInt(-5, 5)        // левый показатель: (px+q), после корня — px+q
    const mBase = pick([4, 16]), mm = Math.round(Math.log(mBase) / Math.log(base)) // 16 = 2⁴
    const r = randInt(1, 3), sN = randInt(-4, 4)
    // левая часть: 2^{px+q}; правая: 2^{(mm/2)·(rx+s)/x}
    const w = Q(mm, 2)
    // p·x + q ⋛ w·(r x + s)/x  ⟺ (p x² + (q − w r)x − w s)/x ⋛ 0
    const c2 = Q(p), c1 = Qadd(Q(q), Qmul(Q(-1), Qmul(w, Q(r)))), c0 = Qmul(Q(-1), Qmul(w, Q(sN)))
    const disc = Qadd(Qmul(c1, c1), Qmul(Q(-4), Qmul(c2, c0)))
    if (Qnum(disc) <= 0) continue
    const Dnum = Qnum(disc)
    const sq = Math.round(Math.sqrt(Dnum))
    if (Math.abs(sq * sq - Dnum) > 1e-9) continue      // корни рациональные
    const x1 = Q(-c1.p * 2 * c2.q - sq * c1.q * 2 * c2.q, 0) // (заглушка не нужна)
    void x1
    const r1 = Q(Math.round((-Qnum(c1) - sq) * 1e6), Math.round(2 * Qnum(c2) * 1e6))
    const r2 = Q(Math.round((-Qnum(c1) + sq) * 1e6), Math.round(2 * Qnum(c2) * 1e6))
    if (Math.abs(Qnum(r1)) < 1e-9 || Math.abs(Qnum(r2)) < 1e-9) continue
    if (Math.abs(Qnum(r1) - Qnum(r2)) < 1e-9) continue
    if (Math.abs(r1.q) > 12 || Math.abs(r2.q) > 12) continue
    const cmp = pick([">", "<"])
    const left = `${SUPD[n]}√(${pw(A, expPoly([{ c: p, k: 1 }, { c: q, k: 0 }]), true)})`
    const right = `√(${mBase}⟦sup:${fT(expPoly([{ c: r, k: 1 }, { c: sN, k: 0 }]), "x")}⟧)`
    const text = `${left} ${cmp} ${right}`
    const F = (x) => Math.pow(A, (p * x + q) / n)
    const G = (x) => Math.sqrt(Math.pow(mBase, (r * x + sN) / x))
    const res = build({
      text, cmp, lhs: F, rhs: G,
      domainOK: (x) => Math.abs(x) > 1e-12,
      lead: 1,
      crit: [
        { ep: epQ(r1), mult: 1, pole: false },
        { ep: epQ(r2), mult: 1, pole: false },
        { ep: epQ(0), mult: 1, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}


// ── дробно-рациональные по t = b^x ──────────────────────────────────────────
// Степени ВНУТРИ дроби печатаем юникод-надстрочником (pw(..., true)).

// [13] (B^x + βb^x + γ)/(b^x − p) ⋛ C   (PDF пок.8: (9ˣ+2·3ˣ−117)/(3ˣ−27) ≤ 1)
export function t15ExpFracQuadLin() {
  for (let it = 0; it < 1500; it++) {
    const b = pick([2, 3, 5]), B = b * b
    const ip = randInt(1, 4), p = Math.round(Math.pow(b, ip))
    const r1 = powQ(b, randInt(0, 3))                       // достижимый нуль
    const r2 = Q(pick([-1, 1]) * randInt(2, 30))            // второй (часто отрицательный)
    if (Math.abs(Qnum(r1) - Qnum(r2)) < 1e-9 || Math.abs(Qnum(r1) - p) < 1e-9) continue
    if (Math.abs(Qnum(r2) - p) < 1e-9) continue
    const C = randInt(-3, 3)
    const beta = Qadd(Qmul(Q(-1), Qadd(r1, r2)), Q(C))
    const gam = Qadd(Qmul(r1, r2), Q(-C * p))
    if (beta.q !== 1 || gam.q !== 1 || beta.p === 0 || gam.p === 0) continue
    if (Math.abs(beta.p) > 60 || Math.abs(gam.p) > 900) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const num = `${pw(B, "x", true)} ${beta.p < 0 ? MINUS : "+"} ${Math.abs(beta.p) === 1 ? "" : Math.abs(beta.p) + "·"}${pw(b, "x", true)} ${gam.p < 0 ? MINUS : "+"} ${Math.abs(gam.p)}`
    const den = `${pw(b, "x", true)} ${MINUS} ${p}`
    const text = `${fT(num, den)} ${cmp} ${qAns(Q(C))}`
    const F = (x) => (Math.pow(B, x) + beta.p * Math.pow(b, x) + gam.p) / (Math.pow(b, x) - p)
    const res = buildExpo({
      text, cmp, base: b, dir: 1, leadT: 1,
      lhs: F, rhs: () => C,
      domainOK: (x) => Math.abs(Math.pow(b, x) - p) > 1e-12,
      tCrit: [
        { t: r1, mult: 1, pole: false }, { t: r2, mult: 1, pole: false },
        { t: Q(p), mult: 1, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}

// [14] (A − k·b^x)/(B^x + βb^x + γ) ⋛ C   (PDF пок.18: (13−5·3ˣ)/(9ˣ−12·3ˣ+27) ≥ 0,5)
//      Числитель приведения — ПОЛНЫЙ КВАДРАТ −C(t−u)²: знак не меняется.
export function t15ExpFracLinQuad() {
  for (let it = 0; it < 1500; it++) {
    const b = pick([2, 3, 5]), B = b * b
    const p1 = Math.round(Math.pow(b, randInt(1, 3))), p2 = Math.round(Math.pow(b, randInt(1, 3)))
    if (p1 === p2) continue
    const C = pick([Q(1, 2), Q(1), Q(2)])
    const dbl = Math.random() < 0.6
    const u1 = powQ(b, randInt(0, 2)), u2 = dbl ? u1 : powQ(b, randInt(0, 3))
    if (Qnum(u1) === p1 || Qnum(u1) === p2 || Qnum(u2) === p1 || Qnum(u2) === p2) continue
    const k = Qmul(C, Qadd(Q(p1 + p2), Qmul(Q(-1), Qadd(u1, u2))))
    const A = Qmul(C, Qadd(Q(p1 * p2), Qmul(Q(-1), Qmul(u1, u2))))
    if (k.q !== 1 || A.q !== 1 || k.p <= 0 || A.p === 0) continue
    if (Math.abs(A.p) > 400 || k.p > 90) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const num = `${A.p} ${MINUS} ${k.p === 1 ? "" : k.p + "·"}${pw(b, "x", true)}`
    const beta = -(p1 + p2), gam = p1 * p2
    const den = `${pw(B, "x", true)} ${MINUS} ${Math.abs(beta)}·${pw(b, "x", true)} + ${gam}`
    const text = `${fT(num, den)} ${cmp} ${qDec(C)}`
    const F = (x) => (A.p - k.p * Math.pow(b, x)) / (Math.pow(B, x) + beta * Math.pow(b, x) + gam)
    const tC = [{ t: Q(p1), mult: 1, pole: true }, { t: Q(p2), mult: 1, pole: true }]
    if (dbl) tC.push({ t: u1, mult: 2, pole: false })
    else tC.push({ t: u1, mult: 1, pole: false }, { t: u2, mult: 1, pole: false })
    const res = buildExpo({
      text, cmp, base: b, dir: 1, leadT: -1,   // ведущий коэффициент числителя = −C < 0
      lhs: F, rhs: () => Qnum(C),
      domainOK: (x) => Math.abs(Math.pow(b, x) - p1) > 1e-12 && Math.abs(Math.pow(b, x) - p2) > 1e-12,
      tCrit: tC,
    })
    if (res) return res
  }
  return null
}

// [15] A/(b^x − p) ⋛ B/(b^x − q)   (PDF пок.9: 2/(7ˣ−7) ≥ 5/(7ˣ−4))
export function t15ExpFracTwo() {
  for (let it = 0; it < 1500; it++) {
    const b = pick([2, 3, 5, 7])
    const p = Math.round(Math.pow(b, randInt(1, 3))), q = randInt(2, 40)
    if (p === q) continue
    const A = randInt(1, 9), Bc = randInt(1, 9)
    if (A === Bc) continue
    const t0 = Q(A * q - Bc * p, A - Bc)
    if (Qnum(t0) <= 0) continue
    if (Math.abs(Qnum(t0) - p) < 1e-9 || Math.abs(Qnum(t0) - q) < 1e-9) continue
    if (t0.q !== 1 || Math.abs(t0.p) > 400) continue   // ответ вида log_b(целое)
    const cmp = pick(["≥", "≤", ">", "<"])
    const text = `${fT(A, `${pw(b, "x", true)} ${MINUS} ${p}`)} ${cmp} ${fT(Bc, `${pw(b, "x", true)} ${MINUS} ${q}`)}`
    const F = (x) => A / (Math.pow(b, x) - p), G = (x) => Bc / (Math.pow(b, x) - q)
    const res = buildExpo({
      text, cmp, base: b, dir: 1, leadT: A - Bc > 0 ? 1 : -1,
      lhs: F, rhs: G,
      domainOK: (x) => Math.abs(Math.pow(b, x) - p) > 1e-12 && Math.abs(Math.pow(b, x) - q) > 1e-12,
      tCrit: [
        { t: t0, mult: 1, pole: false },
        { t: Q(p), mult: 1, pole: true }, { t: Q(q), mult: 1, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}

// [16] (b^x − a)/(b^x − c) ⋛ 1 + 1/(b^x − d)   (PDF пок.6: (3ˣ−1)/(3ˣ−3) ≤ 1 + 1/(3ˣ−2))
export function t15ExpFracShiftOne() {
  for (let it = 0; it < 1500; it++) {
    const b = pick([2, 3, 5])
    const a = Math.round(Math.pow(b, randInt(0, 2)))
    const c = Math.round(Math.pow(b, randInt(0, 3))), d = randInt(2, 25)
    if (a === c || c === d || a === d) continue
    const L = c - a - 1
    if (L === 0) continue
    const t0 = Q((c - a) * d - c, L)
    if (Qnum(t0) <= 0 || t0.q !== 1 || Math.abs(t0.p) > 300) continue
    if ([c, d].some((v) => Math.abs(Qnum(t0) - v) < 1e-9)) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const text = `${fT(`${pw(b, "x", true)} ${MINUS} ${a}`, `${pw(b, "x", true)} ${MINUS} ${c}`)} ${cmp} 1 + ${fT(1, `${pw(b, "x", true)} ${MINUS} ${d}`)}`
    const F = (x) => (Math.pow(b, x) - a) / (Math.pow(b, x) - c)
    const G = (x) => 1 + 1 / (Math.pow(b, x) - d)
    const res = buildExpo({
      text, cmp, base: b, dir: 1, leadT: L > 0 ? 1 : -1,
      lhs: F, rhs: G,
      domainOK: (x) => Math.abs(Math.pow(b, x) - c) > 1e-12 && Math.abs(Math.pow(b, x) - d) > 1e-12,
      tCrit: [
        { t: t0, mult: 1, pole: false },
        { t: Q(c), mult: 1, pole: true }, { t: Q(d), mult: 1, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}

// [17] 1 + A/(b^x − p) + Bc/(B^x − 2p·b^x + p²) ⋛ 0  — знаменатель второй дроби = (b^x−p)²
//      (PDF пок.17: 1 + 11/(2ˣ−8) + 28/(4ˣ−2^{x+4}+64) ≥ 0)
export function t15ExpFracSqDen() {
  for (let it = 0; it < 1500; it++) {
    const b = pick([2, 3, 5]), B = b * b
    const ip = randInt(1, 4), p = Math.round(Math.pow(b, ip))
    const u1 = -randInt(1, p - 1), u2 = -randInt(1, p - 1)
    if (u1 === u2) continue
    const t1 = p + u1, t2 = p + u2
    if (t1 <= 0 || t2 <= 0) continue
    const A = -(u1 + u2), Bc = u1 * u2
    if (A === 0 || Bc === 0 || A > 200 || Bc > 900) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const twoP = 2 * p
    const lg = Math.round(Math.log(twoP) / Math.log(b))
    const midTerm = Math.abs(Math.pow(b, lg) - twoP) < 1e-9
      ? pw(b, expPoly([{ c: 1, k: 1 }, { c: lg, k: 0 }]), true)
      : `${twoP}·${pw(b, "x", true)}`
    const den2 = `${pw(B, "x", true)} ${MINUS} ${midTerm} + ${p * p}`
    const text = `1 + ${fT(A, `${pw(b, "x", true)} ${MINUS} ${p}`)} + ${fT(Bc, den2)} ${cmp} 0`
    const F = (x) => 1 + A / (Math.pow(b, x) - p) + Bc / Math.pow(Math.pow(b, x) - p, 2)
    const res = buildExpo({
      text, cmp, base: b, dir: 1, leadT: 1,
      lhs: F, rhs: () => 0,
      domainOK: (x) => Math.abs(Math.pow(b, x) - p) > 1e-12,
      tCrit: [
        { t: Q(t1), mult: 1, pole: false }, { t: Q(t2), mult: 1, pole: false },
        { t: Q(p), mult: 2, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}

// [18] A/(b^{φ}−1)² − Bc/(b^{φ}−1) + 1 ⋛ 0 при φ = d − x² (составной показатель)
//      (PDF пок.22: 3/(2^{2−x²}−1)² − 4/(2^{2−x²}−1) + 1 ≥ 0)
export function t15ExpFracRecipComp() {
  for (let it = 0; it < 1500; it++) {
    const b = pick([2, 3, 4]), d = randInt(1, 4)
    let e1 = randInt(1, d), e2 = randInt(1, d)
    if (e1 === e2) continue
    if (e1 > e2) [e1, e2] = [e2, e1]
    const u1 = Math.round(Math.pow(b, e1)) - 1, u2 = Math.round(Math.pow(b, e2)) - 1
    if (u1 <= 0 || u2 <= 0) continue
    const Bc = u1 + u2, A = u1 * u2
    if (A > 900 || Bc > 200) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const phi = expPoly([{ c: d, k: 0 }, { c: -1, k: 2 }])   // как в ФИПИ: «2 − x²»
    const base1 = `${pw(b, phi, true)} ${MINUS} 1`
    const text = `${fT(A, `(${base1})${SUPD[2]}`)} ${MINUS} ${fT(Bc, base1)} + 1 ${cmp} 0`
    const PHI = (x) => d - x * x
    const T = (x) => Math.pow(b, PHI(x)) - 1
    const F = (x) => A / (T(x) * T(x)) - Bc / T(x) + 1
    // нули: φ = e_i ⟺ x² = d − e_i ; полюс: φ = 0 ⟺ x = ±√d
    const crit = []
    for (const e of [e1, e2]) {
      const D = d - e
      if (D < 0) continue
      if (D === 0) crit.push({ ep: epQ(0), mult: 2, pole: false })
      else crit.push({ ep: epSurd(0, D, -1), mult: 1, pole: false }, { ep: epSurd(0, D, +1), mult: 1, pole: false })
    }
    if (crit.length < 2) continue
    // знаменатель — u², поэтому полюс ДВОЙНОЙ: знак в нём не меняется
    crit.push({ ep: epSurd(0, d, -1), mult: 2, pole: true }, { ep: epSurd(0, d, +1), mult: 2, pole: true })
    // при x→+∞: φ→−∞ ⟹ t→0+ ⟹ u = t−1 → −1 ⟹ F → (A + Bc + 1) > 0
    const res = build({
      text, cmp, lhs: F, rhs: () => 0, lead: 1,
      domainOK: (x) => Math.abs(T(x)) > 1e-12,
      crit,
    })
    if (res) return res
  }
  return null
}

// [19] (b^x+a)/(b^x−a) + (b^x−a)/(b^x+a) ⋛ (k·b^{x+s} + c)/(B^x − a²)
//      (PDF пок.19: (3ˣ+9)/(3ˣ−9) + (3ˣ−9)/(3ˣ+9) ≥ (4·3^{x+1}+144)/(9ˣ−81))
export function t15ExpFracConj() {
  for (let it = 0; it < 1500; it++) {
    const b = pick([2, 3, 5]), B = b * b
    const ia = randInt(1, 3), a = Math.round(Math.pow(b, ia))
    const dbl = Math.random() < 0.6
    const u1 = powQ(b, randInt(0, 3)), u2 = dbl ? u1 : powQ(b, randInt(0, 3))
    if (Qnum(u1) === a || Qnum(u2) === a) continue
    const k = Qmul(Q(2), Qadd(u1, u2))                       // коэффициент при t
    const c = Qadd(Q(2 * a * a), Qmul(Q(-2), Qmul(u1, u2)))
    if (k.q !== 1 || c.q !== 1 || k.p <= 0 || c.p === 0) continue
    if (k.p > 300 || Math.abs(c.p) > 3000) continue
    // k·t показываем как K·b^{x+s}
    let s = 0, K = k.p
    while (K % b === 0 && s < 3) { K /= b; s++ }
    const cmp = pick(["≥", "≤", ">", "<"])
    const left = `${fT(`${pw(b, "x", true)} + ${a}`, `${pw(b, "x", true)} ${MINUS} ${a}`)} + ${fT(`${pw(b, "x", true)} ${MINUS} ${a}`, `${pw(b, "x", true)} + ${a}`)}`
    const kTerm = s === 0 ? `${K === 1 ? "" : K + "·"}${pw(b, "x", true)}`
      : `${K === 1 ? "" : K + "·"}${pw(b, expPoly([{ c: 1, k: 1 }, { c: s, k: 0 }]), true)}`
    const right = fT(`${kTerm} ${c.p < 0 ? MINUS : "+"} ${Math.abs(c.p)}`, `${pw(B, "x", true)} ${MINUS} ${a * a}`)
    const text = `${left} ${cmp} ${right}`
    const F = (x) => { const t = Math.pow(b, x); return (t + a) / (t - a) + (t - a) / (t + a) }
    const G = (x) => { const t = Math.pow(b, x); return (k.p * t + c.p) / (t * t - a * a) }
    const tC = [{ t: Q(a), mult: 1, pole: true }]
    if (dbl) tC.push({ t: u1, mult: 2, pole: false })
    else tC.push({ t: u1, mult: 1, pole: false }, { t: u2, mult: 1, pole: false })
    const res = buildExpo({
      text, cmp, base: b, dir: 1, leadT: 1,
      lhs: F, rhs: G,
      domainOK: (x) => Math.abs(Math.pow(b, x) - a) > 1e-12,
      tCrit: tC,
    })
    if (res) return res
  }
  return null
}

// [20] (C − B^{−x})/(D − b^{−x}) ⋛ k   (PDF пок.20: (567−9^{−x})/(81−3^{−x}) ≥ 7)
export function t15ExpFracNeg() {
  for (let it = 0; it < 1500; it++) {
    const b = pick([2, 3, 5]), B = b * b
    const D = Math.round(Math.pow(b, randInt(2, 4)))
    const r1 = 0, r2 = Math.random() < 0.5 ? Math.round(Math.pow(b, randInt(1, 3))) : randInt(2, 30)
    const k = r1 + r2
    const C = k * D - r1 * r2
    if (k <= 0 || C <= 0 || C > 100000 || r2 === D) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const negX = expPoly([{ c: -1, k: 1 }])
    const text = `${fT(`${C} ${MINUS} ${pw(B, negX, true)}`, `${D} ${MINUS} ${pw(b, negX, true)}`)} ${cmp} ${k}`
    const F = (x) => (C - Math.pow(B, -x)) / (D - Math.pow(b, -x))
    const res = buildExpo({
      // после сокращения на положительный множитель t: (t−r₂)/(t−D) ⟹ при t→+∞ знак «+»
      text, cmp, base: b, dir: -1, leadT: 1,
      lhs: F, rhs: () => k,
      domainOK: (x) => Math.abs(D - Math.pow(b, -x)) > 1e-12,
      tCrit: [
        { t: Q(r2), mult: 1, pole: false },
        { t: Q(D), mult: 1, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}

// [21] b^x/(b^x−p) + (b^x+1)/(b^x−q) + A/(B^x −(p+q)b^x + pq) ⋛ 0
//      (PDF пок.21: 2ˣ/(2ˣ−3) + (2ˣ+1)/(2ˣ−2) + 5/(4ˣ−5·2ˣ+6) ≤ 0) — числитель 2(t−u)².
export function t15ExpFracThree() {
  for (let it = 0; it < 1500; it++) {
    const b = pick([2, 3, 5]), B = b * b
    const u = Math.round(Math.pow(b, randInt(0, 2)))
    const p = randInt(2, 4 * u + 1 - 2)
    const q = 4 * u + 1 - p
    if (q <= 1 || p === q || p === u || q === u) continue
    const A = 2 * u * u + p
    if (A > 400) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const t1 = `${fT(pw(b, "x", true), `${pw(b, "x", true)} ${MINUS} ${p}`)}`
    const t2 = `${fT(`${pw(b, "x", true)} + 1`, `${pw(b, "x", true)} ${MINUS} ${q}`)}`
    const t3 = fT(A, `${pw(B, "x", true)} ${MINUS} ${p + q}·${pw(b, "x", true)} + ${p * q}`)
    const text = `${t1} + ${t2} + ${t3} ${cmp} 0`
    const F = (x) => { const t = Math.pow(b, x); return t / (t - p) + (t + 1) / (t - q) + A / ((t - p) * (t - q)) }
    const res = buildExpo({
      text, cmp, base: b, dir: 1, leadT: 1,
      lhs: F, rhs: () => 0,
      domainOK: (x) => { const t = Math.pow(b, x); return Math.abs(t - p) > 1e-12 && Math.abs(t - q) > 1e-12 },
      tCrit: [
        { t: Q(u), mult: 2, pole: false },
        { t: Q(p), mult: 1, pole: true }, { t: Q(q), mult: 1, pole: true },
      ],
    })
    if (res) return res
  }
  return null
}

// [22] b^{3x} + a·B^x + (k·B^x − D)/(b^x − p) ⋛ E   (PDF пок.35: 8ˣ−3·4ˣ+(9·4ˣ−288)/(2ˣ−9) ≤ 32)
export function t15ExpCubicFrac() {
  for (let it = 0; it < 1500; it++) {
    const b = pick([2, 3]), B = b * b
    const p = randInt(2, 30)
    const u = Math.round(Math.pow(b, randInt(0, 2)))
    const v = Math.round(Math.pow(b, randInt(1, 3)))
    if (u === v || u === p || v === p) continue
    // корни приведённого числителя: 0, u, u, v  (t=0 недостижим)
    const n3 = -(2 * u + v), n2 = u * u + 2 * u * v, n1 = -(u * u * v), n0 = 0
    const a = n3 + p, k = n2 + a * p, E = -n1, D = -p * n1 - n0
    if (a === 0 || k <= 0 || Math.abs(a) > 40 || k > 300 || Math.abs(D) > 9000 || Math.abs(E) > 900) continue
    const cmp = pick(["≥", "≤", ">", "<"])
    const head = `${pw(b, expPoly([{ c: 3, k: 1 }]))} ${a < 0 ? MINUS : "+"} ${Math.abs(a) === 1 ? "" : Math.abs(a) + "·"}${pw(B, "x")}`
    const frac = fT(`${k === 1 ? "" : k + "·"}${pw(B, "x", true)} ${D < 0 ? "+" : MINUS} ${Math.abs(D)}`, `${pw(b, "x", true)} ${MINUS} ${p}`)
    const text = `${head} + ${frac} ${cmp} ${E}`
    const F = (x) => { const t = Math.pow(b, x); return t * t * t + a * t * t + (k * t * t - D) / (t - p) }
    const res = buildExpo({
      text, cmp, base: b, dir: 1, leadT: 1,
      lhs: F, rhs: () => E,
      domainOK: (x) => Math.abs(Math.pow(b, x) - p) > 1e-12,
      tCrit: [
        { t: Q(u), mult: 2, pole: false }, { t: Q(v), mult: 1, pole: false },
        { t: Q(p), mult: 1, pole: true },
      ],
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
  ["Показательные: замена t = b^x", [
    ["exp-quad", "A·B^{x+m} − k·b^{x+q} + c ⋛ 0 (B = b²)", t15ExpQuad],
    ["exp-quad-neg", "тот же трёхчлен с показателем −x", t15ExpQuadNeg],
    ["exp-quad-fshift", "дробный сдвиг: u = b^{x+f}", t15ExpQuadFracShift],
    ["exp-quad-comp", "составной показатель φ(x) = ε(x−h)²+d", t15ExpQuadComposite],
    ["exp-nested", "двойная замена w = B^x − 2b^x", t15ExpNestedQuad],
    ["exp-recip", "A·b^{x+m} + B·b^{n−x} ⋛ C", t15ExpRecip],
    ["exp-symm", "B^x + k·b^{x+s} + k·b^{s−x} + 1/B^x ⋛ C (y = t+1/t)", t15ExpSymmetric],
    ["exp-factor2", "(aˣ−p)(bˣ−q) в раскрытом виде", t15ExpFactorTwo],
    ["exp-homog", "однородное A(a²)ˣ − B(ab)ˣ − C(b²)ˣ ⋛ 0", t15ExpHomogQuad],
    ["exp-geom", "вынос общего множителя из суммы степеней", t15ExpGeomSum],
    ["exp-mixed-quad", "a^{x²}·b^{x−1} ⋛ a", t15ExpMixedQuad],
    ["exp-root-pow", "корни от степеней → рациональное с полюсом x=0", t15ExpRootPower],
  ]],
  ["Показательные: дробно-рациональные по t", [
    ["exp-frac-quad-lin", "(B^x+βb^x+γ)/(b^x−p) ⋛ C", t15ExpFracQuadLin],
    ["exp-frac-lin-quad", "(A−k·b^x)/(B^x+βb^x+γ) ⋛ C (полный квадрат сверху)", t15ExpFracLinQuad],
    ["exp-frac-two", "A/(b^x−p) ⋛ B/(b^x−q)", t15ExpFracTwo],
    ["exp-frac-one", "(b^x−a)/(b^x−c) ⋛ 1 + 1/(b^x−d)", t15ExpFracShiftOne],
    ["exp-frac-sqden", "1 + A/(b^x−p) + B/(b^x−p)² (знаменатель раскрыт)", t15ExpFracSqDen],
    ["exp-frac-recip-comp", "A/(b^φ−1)² − B/(b^φ−1) + 1, φ = d−x²", t15ExpFracRecipComp],
    ["exp-frac-conj", "(t+a)/(t−a) + (t−a)/(t+a) ⋛ (kt+c)/(t²−a²)", t15ExpFracConj],
    ["exp-frac-neg", "(C−B^{−x})/(D−b^{−x}) ⋛ k", t15ExpFracNeg],
    ["exp-frac-three", "три дроби: t/(t−p) + (t+1)/(t−q) + A/((t−p)(t−q))", t15ExpFracThree],
    ["exp-cubic-frac", "b^{3x} + a·B^x + (k·B^x−D)/(b^x−p) ⋛ E", t15ExpCubicFrac],
  ]],
]

export const GEN15 = META15.flatMap((g) => g[1].map((t) => t[2]))
