// Точная арифметика ответов и общая обвязка генераторов части 2.
//
// Вынесено из taskGeneratorsEgeProf14.js, когда тот же аппарат понадобился №17
// (планиметрия): распознавание точной формы числа, запись ответа с корнем и
// дробью, углы, отношения и перебор параметров. Держать две копии нельзя —
// они разойдутся, и «красивый ответ» в одном банке перестанет быть красивым
// в другом.
//
// Ключевая идея: движок (координатная модель) считает ответ ЧИСЛОМ, а печатать
// в ключе «6,928203230…» нельзя — на экзамене ответ пишут точно. exactOf()
// возвращает точное представление (a/b)·√r, если оно существует с малыми a, b, r,
// и null иначе. Скин, у которого ответ не распознался, ПЕРЕБИРАЕТ параметры
// заново — так и получаются «красивые» числа эталона, без ручного вывода формул.

export const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b] } return a || 1 }
export const MINUS = "−" // U+2212
export const EPS = 1e-9

export const fT = (n, d) => `⟦f:${n}:${d}⟧`
export const rT = (x) => `⟦r:${x}⟧`
export const SUBD = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" }
export const sub = (n) => String(n).split("").map((c) => SUBD[c] ?? c).join("")
export const SUPD = { 2: "²", 3: "³" }
export const sup = (n) => String(n).split("").map((c) => SUPD[c] ?? c).join("")

// Число «по-русски»: десятичная запятая, минус U+2212.
export function ru(x) {
  if (!Number.isFinite(x)) return String(x)
  const s = Number.isInteger(x) ? String(x) : String(Math.round(x * 1e9) / 1e9)
  return s.replace(".", ",").replace(/^-/, MINUS)
}
// Целое? (с допуском)
export const isInt = (x) => Math.abs(x - Math.round(x)) < 1e-9
// Полный квадрат?
export const isSq = (n) => n >= 0 && isInt(Math.sqrt(n))

// √n с вынесением полного квадрата: 12 → {k:2, m:3}; 16 → {k:4, m:1}.
export function sqrtParts(n) {
  let k = 1, m = Math.round(n)
  for (let d = 2; d * d <= m; d++) { while (m % (d * d) === 0) { m /= d * d; k *= d } }
  return { k, m }
}

// ══════════════════════════════════════════════════════════════════════════
// ТОЧНЫЕ ЗНАЧЕНИЯ ОТВЕТА: (a/b)·√r — покрывает целые, дроби и корни разом.
// ══════════════════════════════════════════════════════════════════════════
// S(a, b, r) = a/b · √r. Хранится сокращённой и с вынесенным из-под корня квадратом.
export function S(a, b = 1, r = 1) {
  if (b < 0) { a = -a; b = -b }
  const { k, m } = sqrtParts(r)
  a *= k; r = m
  const g = gcd(a, b) || 1
  return { a: a / g, b: b / g, r }
}
export const Sval = (s) => (s.a / s.b) * Math.sqrt(s.r)
export const Smul = (x, y) => S(x.a * y.a, x.b * y.b, x.r * y.r)
export const Sdiv = (x, y) => S(x.a * y.b * y.r, x.b * y.a * y.r, x.r * y.r)
// Строка ответа (plain): «26», «8√2», «3/2·√5» → пишем как «3√5/2».
export function Sstr(s) {
  const sign = s.a < 0 ? MINUS : ""
  const a = Math.abs(s.a)
  const root = s.r === 1 ? "" : `√${s.r}`
  let num
  if (s.r === 1) num = String(a)
  else if (a === 1) num = root
  else num = `${a}${root}`
  return sign + (s.b === 1 ? num : `${num}/${s.b}`)
}
// Строка УСЛОВИЯ (с токенами): дробь столбиком, корень радикалом.
export function Scond(s) {
  const sign = s.a < 0 ? MINUS : ""
  const a = Math.abs(s.a)
  const root = s.r === 1 ? "" : rT(s.r)
  const num = s.r === 1 ? String(a) : (a === 1 ? root : `${a}${root}`)
  if (s.b === 1) return sign + num
  // дробь: корень внутри числителя пишется через √{…}, а не ⟦r⟧
  const numF = s.r === 1 ? String(a) : (a === 1 ? `√{${s.r}}` : `${a}√{${s.r}}`)
  return sign + fT(numF, s.b)
}

// ══════════════════════════════════════════════════════════════════════════
// РАСПОЗНАВАНИЕ ТОЧНОЙ ФОРМЫ ЧИСЛА
// ══════════════════════════════════════════════════════════════════════════
// Движок считает ответ ЧИСЛОМ. Печатать в ключе «6,928203230…» нельзя — на
// экзамене ответ пишут точно (4√3). exactOf() возвращает точное представление
// (a/b)·√r, если оно существует с малыми a, b, r, и null иначе. Скин, у которого
// ответ не распознался, ПЕРЕБИРАЕТ параметры заново — так и получается «красивый»
// ответ эталона, без ручного вывода формулы.
//
// Ложное срабатывание практически исключено: сетка (b ≤ 240, r ≤ 400 без квадратов)
// редкая, а совпадение требуется до 1e-12 относительной точности.
export const SQUAREFREE = (() => {
  const out = []
  for (let r = 1; r <= 400; r++) {
    let ok = true
    for (let d = 2; d * d <= r; d++) if (r % (d * d) === 0) { ok = false; break }
    if (ok) out.push(r)
  }
  return out
})()

// Рациональное приближение с знаменателем ≤ maxDen (точное совпадение до 1e-12).
export function ratOf(x, maxDen = 240) {
  if (!Number.isFinite(x)) return null
  for (let b = 1; b <= maxDen; b++) {
    const a = x * b
    if (Math.abs(a - Math.round(a)) < 1e-11 * Math.max(1, Math.abs(a))) {
      const g = gcd(Math.round(a), b) || 1
      return { a: Math.round(a) / g, b: b / g }
    }
  }
  return null
}

// Точная форма (a/b)·√r. Возвращает объект S или null.
export function exactOf(x, { maxDen = 240 } = {}) {
  if (!Number.isFinite(x)) return null
  if (Math.abs(x) < 1e-12) return S(0, 1, 1)
  for (const r of SQUAREFREE) {
    const q = ratOf(x / Math.sqrt(r), maxDen)
    if (q) {
      const s = S(q.a, q.b, r)
      if (Math.abs(Sval(s) - x) < 1e-11 * Math.max(1, Math.abs(x))) return s
    }
  }
  return null
}

// Сумма точных значений: периметр многоугольника со сторонами разной природы
// печатается как «48 + 12√7», а не десятичной дробью.
export function exactSumOf(values) {
  const byR = new Map()
  for (const v of values) {
    const e = exactOf(v)
    if (!e) return null
    const cur = byR.get(e.r) || { a: 0, b: 1 }
    let a = cur.a * e.b + e.a * cur.b, b = cur.b * e.b
    const g = gcd(a, b) || 1
    byR.set(e.r, { a: a / g, b: b / g })
  }
  // Положительные слагаемые печатаем первыми: «75√2 − 100», а не «−100 + 75√2».
  const terms = [...byR.entries()].filter(([, q]) => q.a !== 0)
    .sort((x, y) => (x[1].a < 0) - (y[1].a < 0) || x[0] - y[0])
  if (!terms.length) return { str: "0", num: 0, terms: 0 }
  let str = ""
  for (let i = 0; i < terms.length; i++) {
    const [r, q] = terms[i]
    const body = Sstr(S(Math.abs(q.a), q.b, r))
    if (i === 0) str += (q.a < 0 ? MINUS : "") + body
    else str += (q.a < 0 ? " − " : " + ") + body
  }
  const num = terms.reduce((acc, [r, q]) => acc + Sval(S(q.a, q.b, r)), 0)
  return { str, num, terms: terms.length }
}

// Перебор параметров: fn(i) возвращает готовый объект либо null («числа не подошли»).
export function attempt(fn, tries = 400) {
  for (let i = 0; i < tries; i++) { const r = fn(i); if (r) return r }
  throw new Error("не подобрались параметры")
}

// ── Углы ───────────────────────────────────────────────────────────────────
// Ответ-угол пишут либо «60°», либо «arctg 2», либо «arccos (√7/4)» — как в ФИПИ.
// Ищем в этом порядке: круглые градусы → arctg → arcsin → arccos.
const NICE_DEG = [15, 30, 36, 45, 60, 72, 75, 90, 120, 135, 150]
export function angleExact(deg) {
  if (!Number.isFinite(deg)) return null
  for (const d of NICE_DEG) if (Math.abs(deg - d) < 1e-9) return { str: `${d}°`, num: deg }
  if (Math.abs(deg - Math.round(deg)) < 1e-9 && Math.round(deg) % 5 === 0) {
    return { str: `${Math.round(deg)}°`, num: deg }
  }
  const rad = deg * Math.PI / 180
  const tries = [
    ["arctg", Math.tan(rad)],
    ["arcsin", Math.sin(rad)],
    ["arccos", Math.cos(rad)],
  ]
  for (const [name, v] of tries) {
    const e = exactOf(v, { maxDen: 60 })
    if (e && Math.abs(e.a) <= 60 && e.b <= 60 && e.r <= 200) {
      const body = Sstr(e)
      return { str: `${name} ${/[/]/.test(body) ? `(${body})` : body}`, num: deg }
    }
  }
  return null
}

// Отношение p:q из числа x = p/q.
export function ratioExact(x, maxDen = 80) {
  const q = ratOf(x, maxDen)
  if (!q || q.a <= 0) return null
  if (q.a > 80 || q.b > 80) return null
  return { str: `${q.a}:${q.b}`, num: x }
}

// Утверждение внутри модели: если геометрия не та, что описана в пункте а,
// смоук обязан упасть, а не показать «ответ» к другой задаче.
export function need(cond, msg) { if (!cond) throw new Error("модель: " + msg) }
export const eq = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))

// Точная запись значения для пояснения; если точной формы нет — округление
// (в ответе такое не появляется: там значение всегда распознано).
export const SX = (x) => { const e = exactOf(x); return e ? Sstr(e) : ru(Math.round(x * 1000) / 1000) }

// π ставится сразу после числового множителя: «50π√2», а не «50√2π».
export function piStr(x) {
  const e = exactOf(x / Math.PI)
  if (!e) return null
  const sign = e.a < 0 ? MINUS : ""
  const a = Math.abs(e.a)
  const head = a === 1 ? "π" : `${a}π`
  const body = e.r === 1 ? head : `${head}√${e.r}`
  return sign + (e.b === 1 ? body : `${body}/${e.b}`)
}

