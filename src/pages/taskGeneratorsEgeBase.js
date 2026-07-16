// Генераторы ЕГЭ математика (БАЗОВЫЙ уровень) — предмет «ЕГЭ».
//
// Эталон типажей — открытый банк ФИПИ (fipi_bank_ege_base/tasks.json). Каждый шаблон
// воспроизводит реальный тип задания банка (та же формулировка, свои числа); правильный
// ответ считается кодом, поэтому гарантированно верен и не заимствует чужую разметку.
//
// Этап 1 — только задания БЕЗ чертежей/схем. Формат объекта генератора:
//   { condition_text, answer }  — как у остальных предметов (см. taskGenerators.js).
// Мат-токены дробей ⟦f:n:d⟧, корней ⟦r:x⟧ и индексов ⟦b:x⟧ разворачивает renderTaskMath().

import { matchBlock } from "../utils.js"

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i);[a[i], a[j]] = [a[j], a[i]] } return a }
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b] } return a || 1 }
const clean = (x) => Math.round(x * 1e9) / 1e9   // гасит float-шум

// Мат-токены condition_text.
const fT = (n, d) => `⟦f:${n}:${d}⟧`
const rT = (x) => `⟦r:${x}⟧`
const sub = (x) => `⟦b:${x}⟧`
const supT = (x) => `⟦sup:${x}⟧`   // надстрочник с переменным показателем (2^(1−4x))
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻" }
const sup = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("")

// Число «по-русски»: десятичная запятая, без хвостовых нулей, минус — U+2212.
function ru(x) {
  if (typeof x !== "number") return String(x)
  let s = Number.isInteger(x) ? String(x) : String(clean(x))
  return s.replace(".", ",").replace(/^-/, "−")
}
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
// Вероятность в формате ФИПИ: десятичная через запятую, без хвостовых нулей.
const prob = (fav, total) => ru(clean(fav / total))

// ── Рациональная арифметика (точные ответы) ─────────────────────────────────
// Frac = [num, den], den>0, сокращённая.
function fr(n, d = 1) { if (d < 0) { n = -n; d = -d } const g = gcd(n, d); return [n / g, d / g] }
const fAdd = ([a, b], [c, d]) => fr(a * d + c * b, b * d)
const fSub = ([a, b], [c, d]) => fr(a * d - c * b, b * d)
const fMul = ([a, b], [c, d]) => fr(a * c, b * d)
const fDiv = ([a, b], [c, d]) => fr(a * d, b * c)
const fVal = ([n, d]) => n / d
// Конечная десятичная? (знаменатель = 2^a·5^b)
function isTerminating([, d]) { d = Math.abs(d); while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1 }
// Короткая десятичная (≤3 знаков после запятой) — у ЕГЭ базы №14 ответы короткие.
function shortDec([n, d]) { return (1000 * n) % d === 0 }
// десятичная k/10^p → Frac
const decFr = (val, p = 1) => fr(Math.round(val * 10 ** p), 10 ** p)
// Frac → строка ответа (целое / конечная десятичная).
function fracToAnswer([n, d]) { return d === 1 ? ru(n) : ru(n / d) }
// Отобразить Frac в условии столбиком (смешанное / обыкновенное).
function frShow([n, d]) {
  if (d === 1) return ru(n)
  const sign = n < 0 ? "−" : ""
  n = Math.abs(n)
  if (n > d) { const whole = Math.floor(n / d), rem = n - whole * d; return `${sign}${whole}${fT(rem, d)}` }
  return `${sign}${fT(n, d)}`
}
const dec = (x) => ru(x)
// Дробь столбиком: renderTaskMath разворачивает ⟦f:num:den⟧ в <span> с чертой. Числитель и
// знаменатель — любой текст без «:» и «⟧» (поэтому НЕ вкладывать ⟦f⟧/⟦r⟧ внутрь). Корень
// внутри дроби пишем маркером √{x} (rIn), а не токеном ⟦r⟧ (в нём есть «⟧», рвёт захват).
const FF = (num, den) => `⟦f:${num}:${den}⟧`
const rIn = (x) => `√{${x}}`

// =====================================================================================
// №14 — Вычисления (арифметика дробей и десятичных). Ответ всегда конечная десятичная.
// =====================================================================================

// (a/b ± c/b) : e/g — цепочка обыкновенных дробей.
function t14FracChain() {
  for (let t = 0; t < 300; t++) {
    const b = pick([6, 9, 12, 5, 7, 14, 11, 45])
    const f1 = fr(randInt(2, 3 * b), b), f2 = fr(randInt(1, 2 * b), b)
    const op = pick(["sub", "add"])
    const inner = op === "sub" ? fSub(f1, f2) : fAdd(f1, f2)
    if (inner[0] <= 0) continue
    const div = fr(randInt(1, 9), pick([90, 27, 18, 9, 3]))
    if (div[0] === 0) continue
    const res = fDiv(inner, div)
    if (!shortDec(res) || Math.abs(fVal(res)) > 1000) continue
    return {
      condition_text: `Найдите значение выражения (${frShow(f1)} ${op === "sub" ? "−" : "+"} ${frShow(f2)}) : ${frShow(div)}.`,
      answer: fracToAnswer(res),
    }
  }
  return t14MixDecFrac()
}

// num : (a/b − c/d) — деление на скобку.
function t14DivBracket() {
  for (let t = 0; t < 400; t++) {
    const d1 = pick([7, 9, 5, 35, 11, 12]), d2 = pick([9, 5, 3, 7, 35])
    const f1 = fr(randInt(2, 3 * d1), d1), f2 = fr(randInt(1, d2), d2)
    const inner = fSub(f1, f2)
    if (inner[0] <= 0) continue
    const num = pick([fr(7, 3), decFr(randInt(6, 90) / 10), fr(6, 7), fr(randInt(2, 9), 1)])
    const res = fDiv(num, inner)
    if (!shortDec(res) || Math.abs(fVal(res)) > 1000) continue
    return {
      condition_text: `Найдите значение выражения ${frShow(num)} : (${frShow(f1)} − ${frShow(f2)}).`,
      answer: fracToAnswer(res),
    }
  }
  return t14MixDecFrac()
}

// (1/b)·D ∓ k,  k + (1/b)·D,  1 − (1/b)·D — дробь × десятичная.
function t14MixDecFrac() {
  for (let t = 0; t < 300; t++) {
    const b = pick([3, 4, 5, 6, 9, 25, 20])
    const D = randInt(5, 96) / 10
    const term = fMul(fr(1, b), decFr(D))
    const k = randInt(1, 3)   // без нуля, чтобы не было «0 + …» / «… − 0»
    const shape = pick(["mulSub", "addMul", "oneSub"])
    let res, text
    if (shape === "mulSub") { res = fSub(term, fr(k, 1)); text = `${fT(1, b)} ⋅ ${dec(D)} − ${k}` }
    else if (shape === "addMul") { res = fAdd(fr(k, 1), term); text = `${k} + ${fT(1, b)} ⋅ ${dec(D)}` }
    else { res = fSub(fr(1, 1), term); text = `1 − ${fT(1, b)} ⋅ ${dec(D)}` }
    if (!shortDec(res) || Math.abs(fVal(res)) > 1000) continue
    return { condition_text: `Найдите значение выражения ${text}.`, answer: fracToAnswer(res) }
  }
  return { condition_text: `Найдите значение выражения ${fT(1, 4)} ⋅ 4,8 − 1.`, answer: "0,2" }
}

// Многоэтажная дробь D/(1 + 1/n) отложена: renderTaskMath не поддерживает вложенные ⟦f⟧
// (числитель/знаменатель не должны содержать «:»/«⟧»). Нужен вложенный рендер дроби.

// Десятичные: a:c − e;  a·b:c;  (a+b)/c;  a/(c−d). Всё через точные дроби.
function t14Decimals() {
  const shape = pick(["divSub", "mulDiv", "sumDiv", "fracLine"])
  for (let t = 0; t < 400; t++) {
    if (shape === "divSub") {
      const c = randInt(11, 30) / 10, q = randInt(2, 9)
      const a = clean(c * q)                    // a:c = q ровно
      const e = randInt(1, 9) / 10
      const res = clean(q - e)
      return { condition_text: `Найдите значение выражения ${dec(a)} : ${dec(c)} − ${dec(e)}.`, answer: ru(res) }
    }
    if (shape === "mulDiv") {
      const c = randInt(2, 9) / 10, q = randInt(11, 40) / 10
      const a = clean(c * q)                    // a:c = q
      const b = randInt(21, 60) / 10
      const res = clean(q * b)
      return { condition_text: `Найдите значение выражения ${dec(a)} ⋅ ${dec(b)} : ${dec(c)}.`, answer: ru(res) }
    }
    if (shape === "sumDiv") {
      const c = randInt(21, 60) / 10, q = randInt(1, 5)
      const a = randInt(1, Math.round(c * q * 10) - 1) / 10
      const b = clean(c * q - a)
      if (b <= 0) continue
      return { condition_text: `Найдите значение выражения ${FF(`${dec(a)} + ${dec(b)}`, dec(c))}.`, answer: ru(q) }
    }
    // fracLine: num / (c − d)  где c−d<0
    const bottom = -randInt(11, 40) / 10
    const q = randInt(1, 6)
    const num = clean(bottom * q)               // num/bottom = q
    const c = randInt(11, 90) / 10
    const d = clean(c - bottom)
    return { condition_text: `Найдите значение выражения ${FF(dec(num), `${dec(c)} − ${dec(d)}`)}.`, answer: ru(q) }
  }
  return { condition_text: `Найдите значение выражения 4,2 ⋅ 4,5 : 0,7.`, answer: "27" }
}

// =====================================================================================
// №16 — Вычисления и преобразования (степени, корни, логарифмы, тригонометрия).
// =====================================================================================

// a^m / (a^k)^n = a^(m−kn).
function t16PowerQuotient() {
  const a = pick([2, 3, 4, 5, 7])
  const k = pick([2, 3])
  const p = randInt(1, 4)
  const n = randInt(1, 3)
  const m = p + k * n
  if (m > 13) return t16PowerQuotient()
  return {
    condition_text: `Найдите значение выражения ${FF(`${a}${sup(m)}`, `${a ** k}${sup(n)}`)}.`,
    answer: ru(a ** p),
  }
}

// ((a^p)^2)/(a^q) = a^(2p−q)  или  (a^-x·a^y)/(a^-z) = a^(-x+y+z).
function t16PowerNested() {
  const a = pick([2, 3, 5, 7])
  if (Math.random() < 0.5) {
    const p = pick([-3, -4, -5]), q = pick([-8, -9, -10, -12])
    if (2 * p - q < 0) return t16PowerNested()   // ответ должен быть целой степенью (≥0)
    return { condition_text: `Найдите значение выражения ${FF(`(${a}${sup(p)})${sup(2)}`, `${a}${sup(q)}`)}.`, answer: ru(a ** (2 * p - q)) }
  }
  const x = pick([6, 7, 4]), y = pick([2, 3]), z = pick([7, 9, 8])
  return { condition_text: `Найдите значение выражения ${FF(`${a}${sup(-x)} ⋅ ${a}${sup(y)}`, `${a}${sup(-z)}`)}.`, answer: ru(a ** (-x + y + z)) }
}

// √a·√b, ab — точный квадрат.
function t16RootProduct() {
  const r = randInt(3, 12)
  const sq = r * r
  const divs = []
  for (let d = 2; d < sq; d++) if (sq % d === 0) divs.push(d)
  const a = divs.length ? pick(divs) : sq, b = sq / a
  return { condition_text: `Найдите значение выражения ${rT(a)} ⋅ ${rT(b)}.`, answer: ru(r) }
}

// √a/√b = √(a/b) и (k√a)/√b.
function t16RootQuotient() {
  const q = randInt(2, 8), b = pick([2, 3, 5, 7]), a = q * q * b
  if (Math.random() < 0.5) return { condition_text: `Найдите значение выражения ${FF(rIn(a), rIn(b))}.`, answer: ru(q) }
  const k = randInt(2, 5)
  return { condition_text: `Найдите значение выражения ${FF(`${k}${rIn(a)}`, rIn(b))}.`, answer: ru(k * q) }
}

// (√a − √b)(√a + √b) = a − b.
function t16Conjugate() {
  const a = pick([11, 13, 7, 17, 19, 23]), b = pick([2, 3, 5])
  return { condition_text: `Найдите значение выражения (${rT(a)} − ${rT(b)})(${rT(a)} + ${rT(b)}).`, answer: ru(a - b) }
}

// Стандартный вид: сложение/деление/умножение a·10^m.
function t16StandardForm() {
  const shape = pick(["add", "div", "mul"])
  if (shape === "add") {
    const m = randInt(2, 3), n = randInt(1, m)
    const a = randInt(11, 98) / 10, b = randInt(11, 98) / 10
    return { condition_text: `Найдите значение выражения ${dec(a)} ⋅ 10${sup(m)} + ${dec(b)} ⋅ 10${sup(n)}.`, answer: ru(clean(a * 10 ** m + b * 10 ** n)) }
  }
  if (shape === "div") {
    // a·10^m / (b·10^n) — подберём так, чтобы делилось нацело
    const b = pick([1.2, 2, 3, 4, 6]), R = randInt(2, 90) * 10, n = pick([-2, -3]), m = randInt(1, 2)
    const a = clean(R * b * 10 ** n / 10 ** m)
    if (!(a >= 1 && a < 10 && clean(a * 10) === Math.round(a * 10))) return t16StandardForm()
    return { condition_text: `Найдите значение выражения ${FF(`${dec(a)} ⋅ 10${sup(m)}`, `${dec(b)} ⋅ 10${sup(n)}`)}.`, answer: ru(R) }
  }
  const a = randInt(11, 40) / 10, b = randInt(11, 40) / 10, m = randInt(2, 4), n = randInt(-3, -1)
  return { condition_text: `Найдите значение выражения (${dec(a)} ⋅ 10${sup(m)}) ⋅ (${dec(b)} ⋅ 10${sup(n)}).`, answer: ru(clean(a * 10 ** m * b * 10 ** n)) }
}

// Разложение по разрядам.
function t16PlaceValue() {
  const parts = shuffle([[randInt(1, 9), randInt(2, 3)], [randInt(1, 9), 1], [randInt(1, 9), -1]])
  let val = 0
  const terms = parts.map(([d, e]) => { val += d * 10 ** e; return `${d} ⋅ 10${sup(e)}` })
  return { condition_text: `Найдите значение выражения ${terms.join(" + ")}.`, answer: ru(clean(val)) }
}

// log_a x − log_a y, x/y = a^k.
function t16LogDiff() {
  const a = pick([2, 3, 5, 6, 7]), k = randInt(1, 3), y = randInt(2, 9), x = y * a ** k
  return { condition_text: `Найдите значение выражения log${sub(a)} ${x} − log${sub(a)} ${y}.`, answer: ru(k) }
}

// tg α · ctg α = 1.
function t16TrigProduct() {
  const ang = randInt(2, 88)
  return { condition_text: `Найдите значение выражения tg ${ang}° ⋅ ctg ${ang}°.`, answer: "1" }
}

// k·tg(45° + 360°·n) = k.
function t16TrigReduction() {
  const n = randInt(1, 3), ang = 45 + 360 * n, k = randInt(2, 20), sgn = pick([1, -1])
  return { condition_text: `Найдите значение выражения ${sgn < 0 ? "−" : ""}${k} tg ${ang}°.`, answer: ru(sgn * k) }
}

// sin ↔ cos по данному значению и четверти.
const QUARTER = {
  "0° < α < 90°": { sin: 1, cos: 1 },
  "90° < α < 180°": { sin: 1, cos: -1 },
  "180° < α < 270°": { sin: -1, cos: -1 },
  "270° < α < 360°": { sin: -1, cos: 1 },
}
const isSquareFree = (m) => { for (let k = 2; k * k <= m; k++) if (m % (k * k) === 0) return false; return true }
function t16TrigPythag() {
  let den, num, inside
  for (let t = 0; t < 200; t++) {
    den = pick([4, 5, 10]); num = randInt(1, den - 1); inside = den * den - num * num
    // как у ФИПИ: √inside (известное) без квадратного множителя, дробь несократима,
    // а ОТВЕТ num/den — конечная десятичная (den∈{4,5,10}, поэтому den=3 исключён).
    if (gcd(num, den) === 1 && inside > 1 && isSquareFree(inside) && isTerminating(fr(num, den))) break
    inside = 0
  }
  if (!inside) { den = 4; num = 1; inside = 15 }
  const known = pick(["sin", "cos"]), find = known === "sin" ? "cos" : "sin"
  const qName = pick(Object.keys(QUARTER))
  const q = QUARTER[qName]
  const knownSign = q[known] < 0 ? "− " : ""
  const knownStr = `${knownSign}${FF(rIn(inside), String(den))}`
  const ansSign = q[find] < 0 ? "−" : ""
  const g = gcd(num, den), an = num / g, ad = den / g
  const ansMag = ad === 1 ? String(an) : ru(an / ad)
  return {
    condition_text: `Найдите ${find} α, если ${known} α = ${knownStr} и ${qName}.`,
    answer: ansSign + ansMag,
  }
}

// --- Недостающие типажи №16 (сверка с эталоном ФИПИ, 2026-07-17) ---------------
const SUBD = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" }
const subUni = (n) => String(n).split("").map((c) => SUBD[c] ?? c).join("")
const divisorsOf = (n) => { const d = []; for (let i = 2; i < n; i++) if (n % i === 0) d.push(i); return d }

// Сумма логарифмов: log_a x + log_a y = log_a(xy), xy = a^k → ответ k.
// Иногда один аргумент — десятичная дробь (log_7 0,5 + log_7 98 = log_7 49 = 2).
function t16LogSum() {
  const a = pick([2, 3, 5, 6, 7]), k = randInt(2, 4), total = a ** k
  if (Math.random() < 0.4) {                 // десятичный аргумент
    for (let t = 0; t < 60; t++) {
      const y = randInt(2, total * 4), x = fr(total, y)
      if (isTerminating(x) && x[0] / x[1] < 1 && x[0] / x[1] > 0.05) {
        return { condition_text: `Найдите значение выражения log${sub(a)} ${ru(x[0] / x[1])} + log${sub(a)} ${y}.`, answer: ru(k) }
      }
    }
  }
  const divs = divisorsOf(total)
  if (!divs.length) return t16LogSum()
  const x = pick(divs), y = total / x
  return { condition_text: `Найдите значение выражения log${sub(a)} ${x} + log${sub(a)} ${y}.`, answer: ru(k) }
}

// (p/q)·√A·√B, где A·B — точный квадрат S², S кратно q → ответ p·S/q.
function t16CoefRootProduct() {
  const q = pick([2, 3, 4, 5]), t2 = randInt(1, 4), S = q * t2, total = S * S
  const divs = divisorsOf(total)
  if (!divs.length) return t16CoefRootProduct()
  const A = pick(divs), B = total / A, p = randInt(2, 9)
  return { condition_text: `Найдите значение выражения ${FF(String(p), String(q))}${rT(A)} ⋅ ${rT(B)}.`, answer: ru(p * t2) }
}

// Сумма степенных слагаемых: c₁·b^m + c₂·b^k (+ c₃·b^j). Основание (−1)/(−2) или
// положительное с ОТРИЦАТЕЛЬНЫМ показателем (c·b^−e, b∈{2,5,10} → конечная десятичная).
function t16PowerTermsSum() {
  const neg = Math.random() < 0.4                      // отрицательные показатели
  const b = neg ? pick([2, 5, 10]) : pick([2, 3, -1, -2])
  const n = pick([2, 3])
  let sum = 0, parts = []
  const bStr = b < 0 ? `(${ru(b)})` : String(b)
  for (let i = 0; i < n; i++) {
    const c = neg ? pick([randInt(2, 9), randInt(11, 40) / 10]) : randInt(2, 7)
    const e = neg ? -randInt(1, 3) : randInt(1, b < 0 ? 6 : 5)
    sum += c * b ** e
    parts.push(`${dec(c)} ⋅ ${bStr}${sup(e)}`)
  }
  if (neg && !isTerminating(decFr(sum, 4))) return t16PowerTermsSum()
  return { condition_text: `Найдите значение выражения ${parts.join(" + ")}.`, answer: ru(clean(sum)) }
}

// Логарифм в показателе: a^(m·log_a b)=b^m  и  a^(k+log_a b)=a^k·b.
function t16LogInExp() {
  const a = pick([2, 3, 5, 6])
  if (Math.random() < 0.5) {
    const m = 2, b = randInt(2, 7)
    return { condition_text: `Найдите значение выражения ${a}${supT(`${m} log${subUni(a)} ${b}`)}.`, answer: ru(b ** m) }
  }
  const k = randInt(1, 2), b = randInt(2, 8)
  return { condition_text: `Найдите значение выражения ${a}${supT(`${k} + log${subUni(a)} ${b}`)}.`, answer: ru(a ** k * b) }
}

// Сопряжённые с коэффициентами: (p√a ± q√b)(p√a ∓ q√b) = p²a − q²b.
function t16ConjugateCoef() {
  for (let t = 0; t < 100; t++) {
    const a = pick([2, 3, 5, 7, 11, 13]), b = pick([2, 3, 5]), p = randInt(2, 4), q = randInt(1, 3)
    const ans = p * p * a - q * q * b
    if (ans <= 0) continue
    const left = q === 1 ? `${p}${rT(a)} − ${rT(b)}` : `${p}${rT(a)} − ${q}${rT(b)}`
    const right = q === 1 ? `${p}${rT(a)} + ${rT(b)}` : `${p}${rT(a)} + ${q}${rT(b)}`
    return { condition_text: `Найдите значение выражения (${left})(${right}).`, answer: ru(ans) }
  }
  return { condition_text: `Найдите значение выражения (2${rT(5)} − ${rT(3)})(2${rT(5)} + ${rT(3)}).`, answer: "17" }
}

// Корень из произведения степеней: √(a^m·b^k), m,k чётные → a^(m/2)·b^(k/2).
function t16RootOfPowerProduct() {
  const a = pick([2, 3, 5])
  const bb = pick([3, 5, 7].filter((x) => x !== a))
  const m = 2 * randInt(1, 3), k = 2 * randInt(1, 2)
  return {
    condition_text: `Найдите значение выражения ${rT(`${a}${sup(m)} ⋅ ${bb}${sup(k)}`)}.`,
    answer: ru(a ** (m / 2) * bb ** (k / 2)),
  }
}

// Раскрытие: (√A − √B)·√c = √(Ac) − √(Bc), A=c·s₁², B=c·s₂² → c(s₁−s₂).
function t16DistributeRoot() {
  const c = pick([2, 3, 5, 6, 7]), s1 = randInt(2, 4), s2 = randInt(1, s1 - 1)
  const A = c * s1 * s1, B = c * s2 * s2
  return {
    condition_text: `Найдите значение выражения (${rT(A)} − ${rT(B)}) ⋅ ${rT(c)}.`,
    answer: ru(c * (s1 - s2)),
  }
}

// Квадрат коэффициента-корня: ((k√a)²)/N = k²a/N (может быть …,5).
function t16SquareCoefRoot() {
  for (let t = 0; t < 200; t++) {
    const k = randInt(2, 7), a = pick([2, 3, 5, 6, 7]), val = k * k * a
    const N = pick([...divisorsOf(val), ...divisorsOf(2 * val).map((d) => d)])
    if (!N) continue
    const res = fr(val, N)
    if (!isTerminating(res) || res[0] / res[1] < 1) continue
    return {
      condition_text: `Найдите значение выражения ${FF(`(${k}√{${a}})${sup(2)}`, String(N))}.`,
      answer: fracToAnswer(res),
    }
  }
  return { condition_text: `Найдите значение выражения ${FF(`(6√{5})${sup(2)}`, "24")}.`, answer: "7,5" }
}

// Вложенный логарифм: log_a(log_b c), c=b^(a^w) → ответ w.
function t16NestedLog() {
  const a = pick([2, 3]), w = randInt(1, 2), v = a ** w, c = a ** v
  return { condition_text: `Найдите значение выражения log${sub(a)}(log${sub(a)} ${c}).`, answer: ru(w) }
}

// Логарифм по основанию корня: log_(√a)(a^k) = 2k.
function t16LogBaseSqrt() {
  const a = pick([2, 3, 5]), k = randInt(2, 4)
  return { condition_text: `Найдите значение выражения log${sub(`√(${a})`)}(${a}${sup(k)}).`, answer: ru(2 * k) }
}

// Приведение тригонометрии со значением: коэффициент × функция(угол) с «красивым» значением.
function t16TrigValue() {
  const combos = [
    { f: "sin", ang: 30, v: [1, 2] }, { f: "sin", ang: 150, v: [1, 2] }, { f: "sin", ang: 90, v: [1, 1] },
    { f: "sin", ang: 270, v: [-1, 1] }, { f: "cos", ang: 60, v: [1, 2] }, { f: "cos", ang: 120, v: [-1, 2] },
    { f: "cos", ang: 180, v: [-1, 1] }, { f: "cos", ang: 0, v: [1, 1] }, { f: "tg", ang: 45, v: [1, 1] },
    { f: "tg", ang: 135, v: [-1, 1] }, { f: "tg", ang: 180, v: [0, 1] },
  ]
  const c = pick(combos), turns = randInt(0, 3) * 360, ang = c.ang + turns
  // коэффициент кратен знаменателю значения → целый ответ
  const kmag = c.v[1] * randInt(1, 8), sgn = pick([1, -1]), k = sgn * kmag
  const ans = (k * c.v[0]) / c.v[1]
  const kStr = k === 1 ? "" : k === -1 ? "−" : ru(k) + " "
  return {
    condition_text: `Найдите значение выражения ${kStr}${c.f} ${ang}°.`,
    answer: ru(ans),
  }
}

// tg по данному sin/cos и четверти: sin α = a/√b, b=a²+leg² → tg = ±a/leg.
function t16TrigPythagTg() {
  // [a, leg] с b=a²+leg² НЕ полным квадратом (√b иррационально, как у ФИПИ)
  const trip = pick([[1, 2], [2, 3], [2, 5], [3, 5], [4, 5], [1, 3], [3, 7], [1, 4], [2, 7]])
  const [a, leg] = trip, b = a * a + leg * leg
  const known = pick(["sin", "cos"])
  // если дано sin=a/√b → cos=leg/√b, tg=a/leg; если дано cos=a/√b → tg=leg/a
  const tgMag = known === "sin" ? fr(a, leg) : fr(leg, a)
  const givenNum = a
  const qName = pick(Object.keys(QUARTER)), q = QUARTER[qName]
  const knownSign = q[known] < 0 ? "− " : ""
  // tg знак = sin·cos знаки
  const tgSign = q.sin * q.cos < 0 ? "−" : ""
  const knownStr = `${knownSign}${FF(String(givenNum), rIn(b))}`
  const mag = tgMag[1] === 1 ? String(tgMag[0]) : ru(tgMag[0] / tgMag[1])
  if (!isTerminating(tgMag)) return t16TrigPythagTg()
  return {
    condition_text: `Найдите tg α, если ${known} α = ${knownStr} и ${qName}.`,
    answer: tgSign + mag,
  }
}

// Обобщённое частное/произведение степеней одного основания (много форм → одна степень).
function t16PowerExpr() {
  const a = pick([2, 3, 5, 7])
  const P = (e) => sup(e)                              // показатель (в т.ч. отрицательный)
  const posOnly = Math.random() < 0.4                  // иногда только положительные показатели
  const E = () => posOnly ? pick([2, 3, 4, 5, 6, 7, 8]) : pick([-9, -8, -7, -6, -4, -3, -2, 2, 3, 4, 5, 6])
  const shapes = [
    () => { const p = E(), q = E(), r = E(); return { s: FF(`${a}${P(p)} ⋅ ${a}${P(q)}`, `${a}${P(r)}`), net: p + q - r } },
    () => { const p = E(), q = E(), r = E(); return { s: FF(`${a}${P(p)}`, `${a}${P(q)} ⋅ ${a}${P(r)}`), net: p - q - r } },
    () => { const p = E(), q = E(), r = E(); return { s: `${FF(`${a}${P(p)}`, `${a}${P(q)}`)} : ${a}${P(r)}`, net: p - q - r } },
    () => { const p = E(), q = E(), r = E(); return { s: `${a}${P(p)} ⋅ ${FF(`${a}${P(q)}`, `${a}${P(r)}`)}`, net: p + q - r } },
    () => { const p = E(), q = E(); return { s: FF(`${a}${P(-Math.abs(p))}`, `(${a}${P(q)})${P(-1)}`), net: -Math.abs(p) + q } },
    () => { const p = E(), q = E(); return { s: `${a}${P(p)} ⋅ ${a}${P(q)} : ${a}${P(E())}`, net: 0 } },
  ]
  for (let t = 0; t < 80; t++) {
    const sh = shapes[randInt(0, shapes.length - 2)]()   // последняя форма — только как основа
    if (sh.net >= 1 && sh.net <= 6) return { condition_text: `Найдите значение выражения ${sh.s}.`, answer: ru(a ** sh.net) }
  }
  return t16PowerQuotient()
}

// Обобщённые сопряжённые: (c₁√a ± c₂√b)(c₁√a ∓ c₂√b) и (c√a ± m)(c√a ∓ m).
function t16ConjugateGen() {
  for (let t = 0; t < 100; t++) {
    const withRoot = Math.random() < 0.6
    const a = pick([2, 3, 5, 7, 11, 13]), c1 = pick([1, 2, 3])
    if (withRoot) {
      const b = pick([2, 3, 5]), c2 = pick([1, 2, 3])
      const ans = c1 * c1 * a - c2 * c2 * b
      if (ans <= 0) continue
      const t1 = c1 === 1 ? rT(a) : `${c1}${rT(a)}`, t2 = c2 === 1 ? rT(b) : `${c2}${rT(b)}`
      const [f, g] = Math.random() < 0.5 ? [`${t1} − ${t2}`, `${t1} + ${t2}`] : [`${t1} + ${t2}`, `${t1} − ${t2}`]
      return { condition_text: `Найдите значение выражения (${f})(${g}).`, answer: ru(ans) }
    }
    const m = randInt(2, 9), ans = c1 * c1 * a - m * m
    if (ans <= 0) continue
    const t1 = c1 === 1 ? rT(a) : `${c1}${rT(a)}`
    const [f, g] = Math.random() < 0.5 ? [`${t1} − ${m}`, `${t1} + ${m}`] : [`${t1} + ${m}`, `${t1} − ${m}`]
    return { condition_text: `Найдите значение выражения (${f})(${g}).`, answer: ru(ans) }
  }
  return { condition_text: `Найдите значение выражения (${rT(5)} − 2)(${rT(5)} + 2).`, answer: "1" }
}

// Обобщённое частное корней: √a/(k√b), √(a·b)/√(c·d), с коэффициентами.
function t16RootQuotientGen() {
  for (let t = 0; t < 100; t++) {
    const q = randInt(2, 8), b = pick([2, 3, 5, 7]), a = q * q * b
    const shape = pick(["denCoef", "prodInside", "numCoef"])
    if (shape === "denCoef") {                        // √(k²·a)/(k√a) = 1 … делаем √A/(k√B)=q/k целым при k|q
      const k = pick([2, 3, 4]); if (q % k) continue
      return { condition_text: `Найдите значение выражения ${FF(rIn(a), `${k}${rIn(b)}`)}.`, answer: ru(q / k) }
    }
    if (shape === "prodInside") {                     // √(x·y)/√(u·v) = q
      const x = randInt(2, 9), y = a / x
      if (!Number.isInteger(y)) continue
      const u = randInt(2, 6), v = b / u
      if (!Number.isInteger(v) || v < 1) continue
      return { condition_text: `Найдите значение выражения ${FF(`√{${x} ⋅ ${y}}`, `√{${u} ⋅ ${v}}`)}.`, answer: ru(q) }
    }
    const k = randInt(2, 5)                            // (k√A)/√B
    return { condition_text: `Найдите значение выражения ${FF(`${k}${rIn(a)}`, rIn(b))}.`, answer: ru(k * q) }
  }
  return t16RootQuotient()
}

// Произведение корней с десятичным операндом: √a · √(d) = √(целый квадрат).
function t16RootProductDec() {
  for (let t = 0; t < 100; t++) {
    const r = randInt(3, 9), sq = r * r
    // sq = a · d, где d — «красивая» десятичная (×0,5)
    const half = pick([0.5, 1.5, 2.5, 3.5])
    const a = sq / half
    if (!Number.isInteger(a)) continue
    const [f1, f2] = Math.random() < 0.5 ? [rT(a), rT(ru(half))] : [rT(ru(half)), rT(a)]
    return { condition_text: `Найдите значение выражения ${f1} ⋅ ${f2}.`, answer: ru(r) }
  }
  return { condition_text: `Найдите значение выражения ${rT(14)} ⋅ ${rT("3,5")}.`, answer: "7" }
}

// Число, делённое на квадрат коэф.-корня: N/((k√a)^m). Часто m=2 → N/(k²·a).
function t16PowerOverRoot() {
  for (let t = 0; t < 100; t++) {
    const k = randInt(2, 5), a = pick([2, 3, 5]), denom = k * k * a
    const ans = randInt(2, 12), N = ans * denom
    if (N > 4000) continue
    return { condition_text: `Найдите значение выражения ${FF(String(N), `(${k}√{${a}})${sup(2)}`)}.`, answer: ru(ans) }
  }
  return { condition_text: `Найдите значение выражения ${FF("120", `(2√{5})${sup(2)}`)}.`, answer: "6" }
}

// (log_a b^k)/(m·log_a b) = k/m.
function t16LogPowerRatio() {
  const a = pick([2, 3, 5, 7]), b = randInt(2, 8), m = randInt(2, 4), k = m * randInt(1, 3)
  return {
    condition_text: `Найдите значение выражения ${FF(`log${subUni(a)}(${b}${sup(k)})`, `${m} log${subUni(a)} ${b}`)}.`,
    answer: ru(k / m),
  }
}

// a^(log_a b) − c = b − c.
function t16PowLogMinus() {
  const a = pick([2, 3, 5, 7]), b = randInt(3, 20), c = randInt(1, b - 1)
  return {
    condition_text: `Найдите значение выражения ${a}${supT(`log${subUni(a)} ${b}`)} − ${c}.`,
    answer: ru(b - c),
  }
}

// Тригонометрия с √-коэффициентом: k√p · f(θ), где f(θ) содержит √p → рационально.
function t16TrigSqrtCoef() {
  const combos = [
    { f: "sin", ang: 60, p: 3, val: [1, 2] }, { f: "sin", ang: 120, p: 3, val: [1, 2] },
    { f: "cos", ang: 30, p: 3, val: [1, 2] }, { f: "cos", ang: 150, p: 3, val: [-1, 2] },
    { f: "tg", ang: 30, p: 3, val: [1, 3] }, { f: "tg", ang: 60, p: 3, val: [1, 1] },
    { f: "sin", ang: 45, p: 2, val: [1, 2] }, { f: "cos", ang: 45, p: 2, val: [1, 2] },
  ]
  const c = pick(combos), turns = randInt(0, 3) * 360
  // множитель k·√p; значение f = (val0/val1)·√p → k·√p·(val0/val1)·√p = k·val0·p/val1
  const kmag = c.val[1] * randInt(1, 6), sgn = pick([1, -1]), k = sgn * kmag
  const ans = (k * c.val[0] * c.p) / c.val[1]
  const kStr = kmag === 1 ? "" : `${kmag} `
  return {
    condition_text: `Найдите значение выражения ${sgn < 0 ? "−" : ""}${kStr}${rT(c.p)} ${c.f} ${c.ang + turns}°.`,
    answer: ru(ans),
  }
}

// Логарифм по основанию √a: log_(√a) N = 2·log_a N (берём N — степень a).
function t16LogBaseSqrtN() {
  const a = pick([2, 3, 5]), k = randInt(1, 4), N = a ** k
  return { condition_text: `Найдите значение выражения log${sub(`√(${a})`)} ${N}.`, answer: ru(2 * k) }
}

// Сумма степеней отрицательного основания без коэффициента: (−k)^m + (−k)^n + …
function t16NegPowerSum() {
  const b = pick([-1, -2, -3])
  const n = pick([2, 3])
  let sum = 0, parts = []
  for (let i = 0; i < n; i++) { const e = randInt(1, 6); sum += b ** e; parts.push(`(${ru(b)})${sup(e)}`) }
  return { condition_text: `Найдите значение выражения ${parts.join(" + ")}.`, answer: ru(sum) }
}

// =====================================================================================
// №17 — Простейшие уравнения.
// =====================================================================================

// Линейное со скобкой: A(x − B) + C = D·x + E, целый корень x0.
function t17Linear() {
  const x0 = randInt(-9, 9)
  let A = randInt(2, 7), D = randInt(-5, 5)
  if (A === D) D += 1
  const B = randInt(-6, 6), C = randInt(-9, 9)
  const E = (A - D) * x0 - A * B + C
  const bSign = B < 0 ? `+ ${-B}` : `− ${B}`
  const cSign = C < 0 ? `− ${-C}` : `+ ${C}`
  const dx = D === 1 ? "x" : D === -1 ? "−x" : `${ru(D)}x`
  const rhs = `${dx}${E === 0 ? "" : E < 0 ? ` − ${-E}` : ` + ${E}`}`
  return {
    condition_text: `Найдите корень уравнения ${A}(x ${bSign}) ${cSign} = ${rhs}.`,
    answer: ru(x0),
  }
}

// Квадратное: x²=c, x²=kx, x²=−kx, x²+bx+c=0 — с указанием большего/меньшего корня.
function t17Quadratic() {
  const kind = pick(["square", "prop", "propNeg", "full"])
  let roots, body
  if (kind === "square") { const r = randInt(2, 12); roots = [-r, r]; body = `x² = ${r * r}` }
  else if (kind === "prop") { const k = randInt(2, 12); roots = [0, k]; body = `x² = ${k}x` }
  else if (kind === "propNeg") { const k = randInt(2, 12); roots = [-k, 0]; body = `x² = −${k}x` }
  else {
    let r1 = randInt(-9, 9), r2 = randInt(-9, 9)
    while (r1 === r2) r2 = randInt(-9, 9)
    roots = [Math.min(r1, r2), Math.max(r1, r2)]
    const b = -(r1 + r2), c = r1 * r2
    const bStr = b === 0 ? "" : ` ${b > 0 ? "+" : "−"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}x`
    const cStr = c === 0 ? "" : c > 0 ? ` + ${c}` : ` − ${-c}`
    body = `x²${bStr}${cStr} = 0`
  }
  const larger = Math.random() < 0.5
  const ans = larger ? Math.max(...roots) : Math.min(...roots)
  return {
    condition_text: `Решите уравнение ${body}. Если уравнение имеет больше одного корня, ` +
      `в ответе запишите ${larger ? "больший" : "меньший"} из них.`,
    answer: ru(ans),
  }
}

// Логарифм: log_a(px + q) = k → px + q = a^k.
function t17Logarithm() {
  for (let t = 0; t < 200; t++) {
    const a = pick([2, 3, 5, 7]), k = randInt(1, 3), p = pick([1, 2, 4, 5])
    const q = randInt(-9, 9)
    const rhs = a ** k
    const x = (rhs - q) / p
    if (!Number.isInteger(x * 2) || p * x + q <= 0) continue
    const qStr = q < 0 ? `− ${-q}` : `+ ${q}`
    return {
      condition_text: `Найдите корень уравнения log${sub(a)}(${p === 1 ? "" : p}x ${qStr}) = ${k}.`,
      answer: ru(clean(x)),
    }
  }
  return { condition_text: `Найдите корень уравнения log${sub(5)}(4x + 7) = 2.`, answer: "4,5" }
}

// Показательное: b^(px+q) = value (value — степень b). При основании 1/b — база дробью.
function t17Exponential() {
  for (let t = 0; t < 200; t++) {
    const b = pick([2, 3, 4, 5, 6, 7])
    const x0 = randInt(-4, 5), p = pick([1, -1, 2, -2, 3, 4]), q = randInt(-6, 6)
    const E0 = p * x0 + q                 // показатель при решении x0
    if (E0 < -3 || E0 > 6) continue
    const recip = Math.random() < 0.4     // основание 1/b
    const effExp = recip ? -E0 : E0       // value = b^effExp
    if (effExp < -3 || effExp > 8) continue
    // линейный показатель px+q
    const px = p === 1 ? "x" : p === -1 ? "−x" : `${ru(p)}x`
    const lin = `${px}${q === 0 ? "" : q < 0 ? ` − ${-q}` : ` + ${q}`}`
    const base = recip ? FF("1", String(b)) : String(b)
    // правая часть: целое или дробь 1/b^k
    const val = effExp >= 0 ? String(b ** effExp) : FF("1", String(b ** (-effExp)))
    return {
      condition_text: `Найдите корень уравнения ${base}${supT(lin)} = ${val}.`,
      answer: ru(x0),
    }
  }
  return { condition_text: `Найдите корень уравнения 2${supT("1 − 4x")} = 32.`, answer: "−1" }
}

// Квадратный корень: √(px + q) = r → px + q = r².
function t17SquareRoot() {
  const r = randInt(3, 12), p = pick([1, 2, 3, 6, 7]), q = randInt(1, 20)
  const x = (r * r - q) / p
  if (!Number.isInteger(x * 2)) return t17SquareRoot()
  return {
    condition_text: `Решите уравнение ${rT(`${p === 1 ? "" : p}x + ${q}`)} = ${r}.`,
    answer: ru(clean(x)),
  }
}

// =====================================================================================
// №05 — Начала теории вероятностей.
// =====================================================================================

// Выученные билеты: (N − k)/N.
function t05Tickets() {
  const N = pick([20, 25, 40, 50])
  const notLearned = randInt(1, N / 2)
  const name = pick(["Оскар", "Саша", "Сеня", "Тимур", "Артём", "Кирилл"])
  return {
    condition_text: `На экзамене будет ${N} ${plural(N, "билет", "билета", "билетов")}, ` +
      `${name} не выучил ${notLearned} из них. Найдите вероятность того, что ему попадётся выученный билет.`,
    answer: prob(N - notLearned, N),
  }
}

// Редкий брак: k из N бракованных → k/N.
function t05Defective() {
  const item = pick([
    { obj: "садовых насосов", verb: "подтекают", one: "насос" },
    { obj: "чайников", verb: "бракованные", one: "чайник" },
    { obj: "аккумуляторов", verb: "неисправны", one: "аккумулятор" },
  ])
  const N = pick([500, 1000, 2000]), k = randInt(3, 20)   // N = 2^a·5^b → (N−k)/N конечна
  return {
    condition_text: `В среднем из ${N} ${item.obj}, поступивших в продажу, ${k} ${item.verb}. ` +
      `Найдите вероятность того, что один случайно выбранный ${item.one} исправен.`,
    answer: prob(N - k, N),
  }
}

// Симметричная монета дважды: заданный исход.
function t05CoinTwice() {
  const q = pick([
    { txt: "орёл не выпадет ни разу", p: 0.25 },
    { txt: "орёл выпадет ровно один раз", p: 0.5 },
    { txt: "орёл выпадет два раза", p: 0.25 },
  ])
  return {
    condition_text: `В случайном эксперименте симметричную монету бросают дважды. ` +
      `Найдите вероятность того, что ${q.txt}.`,
    answer: prob(q.p, 1),
  }
}

// «Больше в k раз»: P одного вида = 1/(k+1) или k/(k+1).
function t05Ratio() {
  const k = pick([3, 4, 9])   // 1/(k+1) конечна: 1/4,1/5,1/10
  const s = pick([
    { many: "кур", few: "гусей", askFew: "гусь", unit: "птица" },
    { many: "яблонь", few: "груш", askFew: "груша", unit: "дерево" },
    { many: "карпов", few: "щук", askFew: "щука", unit: "рыба" },
  ])
  return {
    condition_text: `На ферме есть только ${s.many} и ${s.few}, причём ${s.many} в ${k} ` +
      `${plural(k, "раз", "раза", "раз")} больше, чем ${s.few}. Найдите вероятность того, ` +
      `что случайно выбранная ${s.unit} — ${s.askFew}.`,
    answer: prob(1, k + 1),
  }
}

// Два независимых прибора: оба выйдут из строя = p², хотя бы один работает = 1−p².
function t05TwoDevices() {
  const p = pick([0.1, 0.15, 0.2, 0.06, 0.05])
  const both = Math.random() < 0.5
  return {
    condition_text: `Помещение освещается фонарём с двумя лампами. Вероятность перегорания ` +
      `одной лампы в течение года равна ${ru(p)}. Найдите вероятность того, что за год ` +
      `${both ? "перегорят обе лампы" : "не перегорит ни одна лампа"}.`,
    answer: both ? prob(p * p, 1) : prob((1 - p) * (1 - p), 1),
  }
}

// =====================================================================================
// №15 — Проценты и простейшие текстовые (проценты).
// =====================================================================================

// Скидка d% от цены A → сколько заплатит.
function t15Discount() {
  const d = pick([5, 10, 15, 20, 25])
  const A = randInt(2, 40) * pick([50, 100])
  return {
    condition_text: `Держатели дисконтной карты получают скидку ${d} %. Товар стоит ${A} ` +
      `${plural(A, "рубль", "рубля", "рублей")}. Сколько рублей заплатит держатель карты за этот товар?`,
    answer: ru(clean(A * (1 - d / 100))),
  }
}

// На сколько % изменилась цена: было A, стало B.
function t15PercentChange() {
  const up = Math.random() < 0.5
  const A = randInt(2, 20) * 100
  const p = pick([10, 15, 20, 25, 30, 40])
  const B = clean(A * (up ? 1 + p / 100 : 1 - p / 100))
  return {
    condition_text: `Товар стоил ${A} рублей. После ${up ? "повышения" : "снижения"} цены он стал ` +
      `стоить ${B} ${plural(B, "рубль", "рубля", "рублей")}. На сколько процентов ` +
      `${up ? "повысилась" : "снизилась"} цена товара?`,
    answer: ru(p),
  }
}

// X составляет p% от целого → найти целое.
function t15PercentOfWhole() {
  const whole = randInt(3, 12) * pick([50, 100, 150])
  const p = pick([20, 25, 26, 38, 40])
  const X = clean(whole * p / 100)
  if (!Number.isInteger(X)) return t15PercentOfWhole()
  return {
    condition_text: `В школе иностранный язык изучают ${X} ${plural(X, "учащийся", "учащихся", "учащихся")}, ` +
      `что составляет ${p} % от числа всех учащихся школы. Сколько учащихся в школе?`,
    answer: ru(whole),
  }
}

// Налог 13%: дана зарплата → на руки, или на руки → зарплата.
function t15Tax() {
  const salary = randInt(80, 400) * 100
  const after = clean(salary * 0.87)
  const forward = Math.random() < 0.5
  if (forward) {
    return {
      condition_text: `Налог на доходы составляет 13 % от заработной платы. Заработная плата ` +
        `работника равна ${salary} рублей. Сколько рублей он получит после уплаты налога?`,
      answer: ru(after),
    }
  }
  return {
    condition_text: `Налог на доходы составляет 13 % от заработной платы. После удержания налога ` +
      `работник получил ${after} рублей. Какова его заработная плата (в рублях)?`,
    answer: ru(salary),
  }
}

// Банковский вклад r% годовых на год.
function t15Interest() {
  const P = randInt(5, 90) * 1000, r = pick([6, 8, 10, 12, 14])
  return {
    condition_text: `Банк начисляет на срочный вклад ${r} % годовых. Вкладчик положил на счёт ` +
      `${P} рублей. Сколько рублей будет на счёте через год?`,
    answer: ru(clean(P * (1 + r / 100))),
  }
}

// Наценка m% на оптовую цену C.
function t15Markup() {
  const C = randInt(4, 60) * pick([10, 20, 50])
  const m = pick([15, 20, 25, 30, 40])
  return {
    condition_text: `Магазин закупает товар по оптовой цене ${C} рублей за штуку и продаёт с ` +
      `наценкой ${m} %. Сколько рублей стоит одна штука в розницу?`,
    answer: ru(clean(C * (1 + m / 100))),
  }
}

// Максимальное количество на бюджет: floor(B/c).
function t15MaxCount() {
  const c = randInt(11, 45), B = randInt(80, 300)
  const item = pick([
    { nom: "Сырок", gen: "сырков" }, { nom: "Пирожок", gen: "пирожков" },
    { nom: "Маркер", gen: "маркеров" }, { nom: "Блокнот", gen: "блокнотов" },
  ])
  return {
    condition_text: `${item.nom} стоит ${c} ${plural(c, "рубль", "рубля", "рублей")}. ` +
      `Какое наибольшее число таких ${item.gen} можно купить на ${B} рублей?`,
    answer: ru(Math.floor(B / c)),
  }
}

// =====================================================================================
// №20 — Текстовые задачи (растворы/сплавы, работа, движение). Ответ — целое число.
// =====================================================================================

// Смешивание растворов: (m1·p1 + m2·p2)/(m1+m2) %.
function t20MixSolutions() {
  for (let t = 0; t < 500; t++) {
    const m1 = randInt(2, 12), m2 = randInt(2, 12)
    const p1 = pick([5, 10, 15, 20, 30]), p2 = pick([25, 35, 40, 45, 50])
    const res = (m1 * p1 + m2 * p2) / (m1 + m2)
    if (!Number.isInteger(res)) continue
    return {
      condition_text: `Смешали ${m1} кг ${p1}-процентного раствора вещества с ${m2} кг ` +
        `${p2}-процентного раствора этого же вещества. Сколько процентов составляет ` +
        `концентрация получившегося раствора?`,
      answer: ru(res),
    }
  }
  return { condition_text: `Смешали 6 кг 35-процентного раствора вещества с 9 кг 30-процентного раствора этого же вещества. Сколько процентов составляет концентрация получившегося раствора?`, answer: "32" }
}

// Добавили воду: m·p/(m+w) %.
function t20AddWater() {
  for (let t = 0; t < 500; t++) {
    const m = randInt(4, 20), p = pick([10, 15, 20, 25, 30, 40]), w = randInt(2, 16)
    const res = (m * p) / (m + w)
    if (!Number.isInteger(res)) continue
    return {
      condition_text: `В сосуд, содержащий ${m} кг ${p}-процентного водного раствора вещества, ` +
        `добавили ${w} кг воды. Сколько процентов составляет концентрация получившегося раствора?`,
      answer: ru(res),
    }
  }
  return { condition_text: `В сосуд, содержащий 9 кг 10-процентного водного раствора вещества, добавили 6 кг воды. Сколько процентов составляет концентрация получившегося раствора?`, answer: "6" }
}

// Совместная работа: два исполнителя a и b часов → ab/(a+b).
function t20WorkTogether() {
  for (let t = 0; t < 500; t++) {
    const a = randInt(6, 40), b = randInt(6, 40)
    if (a === b) continue
    const res = (a * b) / (a + b)
    if (!Number.isInteger(res)) continue
    const who = pick([
      { s: "мастер", act: "выполнят этот заказ оба мастера", one: "мастер" },
      { s: "насос", act: "наполнят бак два насоса", one: "насос" },
    ])
    return {
      condition_text: `Один ${who.one} может выполнить работу за ${a} ч, а другой — за ${b} ч. ` +
        `За сколько часов ${who.act}, работая вместе?`,
      answer: ru(res),
    }
  }
  return { condition_text: `Один мастер может выполнить заказ за 15 часов, а другой — за 10 часов. За сколько часов выполнят этот заказ оба мастера, работая вместе?`, answer: "6" }
}

// Средняя скорость по трети пути: 3/(1/v1+1/v2+1/v3).
function t20AvgThirds() {
  for (let t = 0; t < 800; t++) {
    const v1 = pick([30, 40, 60, 20]), v2 = pick([120, 130, 90, 100, 60]), v3 = pick([40, 60, 30, 50])
    const res = (3 * v1 * v2 * v3) / (v2 * v3 + v1 * v3 + v1 * v2)
    if (!Number.isInteger(res)) continue
    return {
      condition_text: `Первую треть пути автомобиль ехал со скоростью ${v1} км/ч, вторую треть — ` +
        `со скоростью ${v2} км/ч, а последнюю — со скоростью ${v3} км/ч. Найдите среднюю ` +
        `скорость автомобиля на протяжении всего пути. Ответ дайте в км/ч.`,
      answer: ru(res),
    }
  }
  return { condition_text: `Первую треть пути автомобиль ехал со скоростью 30 км/ч, вторую треть — со скоростью 120 км/ч, а последнюю — со скоростью 40 км/ч. Найдите среднюю скорость автомобиля на протяжении всего пути. Ответ дайте в км/ч.`, answer: "45" }
}

// Средняя скорость туда-обратно: 2·v1·v2/(v1+v2).
function t20AvgThereBack() {
  for (let t = 0; t < 800; t++) {
    const v1 = pick([20, 30, 40, 12, 15]), v2 = pick([380, 180, 60, 120, 84])
    const res = (2 * v1 * v2) / (v1 + v2)
    if (!Number.isInteger(res)) continue
    return {
      condition_text: `Путешественник переплыл море на яхте со средней скоростью ${v1} км/ч. ` +
        `Обратно тем же путём он летел на самолёте со скоростью ${v2} км/ч. Найдите среднюю ` +
        `скорость путешественника на протяжении всего пути. Ответ дайте в км/ч.`,
      answer: ru(res),
    }
  }
  return { condition_text: `Путешественник переплыл море на яхте со средней скоростью 20 км/ч. Обратно он летел на спортивном самолёте со скоростью 380 км/ч. Найдите среднюю скорость путешественника на протяжении всего пути. Ответ дайте в км/ч.`, answer: "38" }
}

// Встречное движение с задержкой: (D − v1·t)/(v1+v2).
function t20Meeting() {
  for (let t = 0; t < 800; t++) {
    const v1 = pick([50, 60, 40, 70]), v2 = pick([60, 80, 90, 100]), delay = randInt(1, 3)
    const D = (v1 + v2) * randInt(2, 6) + v1 * delay
    const res = (D - v1 * delay) / (v1 + v2)
    if (!Number.isInteger(res) || res < 1) continue
    return {
      condition_text: `Расстояние между городами A и B равно ${D} км. Из города A в город B со ` +
        `скоростью ${v1} км/ч выехал первый автомобиль, а через ${delay} ` +
        `${plural(delay, "час", "часа", "часов")} после этого навстречу ему из города B со ` +
        `скоростью ${v2} км/ч выехал второй. Через сколько часов после своего выезда второй ` +
        `автомобиль встретит первый?`,
      answer: ru(res),
    }
  }
  return { condition_text: `Расстояние между городами A и B равно 470 км. Из города A в город B со скоростью 60 км/ч выехал первый автомобиль, а через 3 часа после этого навстречу ему из города B со скоростью 100 км/ч выехал второй. Через сколько часов после своего выезда второй автомобиль встретит первый?`, answer: "2" }
}

// =====================================================================================
// №04 — Расчёт по формуле (подстановка чисел в данную формулу).
// =====================================================================================

// A = U²·t/R (работа тока).
function t04Current() {
  const R = pick([10, 11, 20, 25, 50, 110]), U = R * randInt(2, 8), t = randInt(2, 12)
  return {
    condition_text: `Работа постоянного тока (в джоулях) вычисляется по формуле A = ${FF("U²·t", "R")}, ` +
      `где U — напряжение (в вольтах), R — сопротивление (в омах), t — время (в секундах). ` +
      `Найдите работу тока (в джоулях) при U = ${U} В, R = ${R} Ом и t = ${t} с.`,
    answer: ru((U * U * t) / R),
  }
}

// s = n·l (шаги).
function t04Steps() {
  const n = randInt(500, 3000), l = randInt(4, 9) / 10
  return {
    condition_text: `Зная длину своего шага, человек может приближённо подсчитать пройденное ` +
      `расстояние s (в метрах) по формуле s = nl, где n — число шагов, l — длина шага (в метрах). ` +
      `Какое расстояние (в метрах) пройдёт человек, сделав ${n} ${plural(n, "шаг", "шага", "шагов")}, если длина его шага ${ru(l)} м?`,
    answer: ru(clean(n * l)),
  }
}

// t_F = 1,8·t_C + 32 (Цельсий → Фаренгейт).
function t04Fahrenheit() {
  const tc = randInt(1, 20) * 5
  return {
    condition_text: `Чтобы перевести температуру из шкалы Цельсия в шкалу Фаренгейта, пользуются ` +
      `формулой t${sub("F")} = 1,8·t${sub("C")} + 32, где t${sub("C")} — температура в градусах ` +
      `Цельсия, t${sub("F")} — температура в градусах Фаренгейта. Сколько градусов по шкале ` +
      `Фаренгейта составляет ${tc}°C?`,
    answer: ru(clean(1.8 * tc + 32)),
  }
}

// a = ω²·R (центростремительное ускорение).
function t04Centripetal() {
  const w = randInt(2, 9), R = randInt(2, 40)
  return {
    condition_text: `Ускорение (в м/с²) при равномерном движении по окружности вычисляется по ` +
      `формуле a = ω²R, где ω — угловая скорость (в с⁻¹), R — радиус окружности (в метрах). ` +
      `Найдите ускорение (в м/с²), если ω = ${w} с⁻¹ и R = ${R} м.`,
    answer: ru(w * w * R),
  }
}

// r = (a+b−c)/2 (радиус вписанной в прямоугольный треугольник).
function t04InRadius() {
  const tri = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]), k = randInt(1, 6)
  const [a, b, c] = tri.map((x) => x * k)
  return {
    condition_text: `Радиус вписанной в прямоугольный треугольник окружности вычисляется по ` +
      `формуле r = ${FF("a + b − c", "2")}, где a и b — катеты, c — гипотенуза. Найдите радиус, ` +
      `если катеты равны ${a} и ${b}, а гипотенуза равна ${c}.`,
    answer: ru((a + b - c) / 2),
  }
}

// g = ³√(abc) (среднее геометрическое трёх чисел).
function t04GeoMean() {
  const g = pick([4, 6, 8, 10, 12]), a = g / 2, b = g, c = 2 * g
  return {
    condition_text: `Среднее геометрическое чисел a, b и c вычисляется по формуле g = ${sup(3)}${rT("abc")}. ` +
      `Вычислите среднее геометрическое чисел ${a}, ${b} и ${c}.`,
    answer: ru(g),
  }
}

// Сумма делителей p1·p2·p3 = (p1+1)(p2+1)(p3+1).
function t04Divisors() {
  const primes = shuffle([2, 3, 5, 7, 11, 13]).slice(0, 3)
  const [p1, p2, p3] = primes
  return {
    condition_text: `Если p₁, p₂ и p₃ — различные простые числа, то сумма всех делителей числа ` +
      `p₁·p₂·p₃ равна (p₁+1)(p₂+1)(p₃+1). Найдите сумму всех делителей числа ${p1 * p2 * p3}, ` +
      `если известно, что оно равно произведению простых чисел ${p1}, ${p2} и ${p3}.`,
    answer: ru((p1 + 1) * (p2 + 1) * (p3 + 1)),
  }
}

// Теорема синусов: b = a·sinβ/sinα (углы из {30,150→½; 90→1}).
function t04LawSines() {
  const S = { 30: 0.5, 150: 0.5, 90: 1 }
  const angs = shuffle([30, 150, 90])
  const alpha = angs[0], beta = angs[1]
  const a = randInt(2, 20) * 2
  const b = (a * S[beta]) / S[alpha]
  if (!Number.isInteger(b)) return t04LawSines()
  return {
    condition_text: `Теорему синусов можно записать в виде ${FF("a", "sin α")} = ${FF("b", "sin β")}, ` +
      `где a и b — стороны треугольника, α и β — противолежащие им углы. Найдите сторону b, если ` +
      `a = ${a}, α = ${alpha}°, β = ${beta}°.`,
    answer: ru(b),
  }
}

// =====================================================================================
// №19 — Числа и их свойства.
// =====================================================================================

// Наибольшее/наименьшее k-значное число, кратное d.
function t19Divisible() {
  const digits = pick([3, 4]), d = pick([9, 12, 15, 18, 20, 45, 55, 75])
  const largest = Math.random() < 0.5
  const lo = 10 ** (digits - 1), hi = 10 ** digits - 1
  const ans = largest ? Math.floor(hi / d) * d : Math.ceil(lo / d) * d
  const dw = digits === 3 ? "трёхзначное" : "четырёхзначное"
  return {
    condition_text: `Найдите ${largest ? "наибольшее" : "наименьшее"} ${dw} число, которое ` +
      `нацело делится на ${d}.`,
    answer: ru(ans),
  }
}

// Число в интервале (a,b), кратное d, с заданной суммой цифр. (ответ — одно из подходящих)
function t19RangeDigitSum() {
  for (let t = 0; t < 3000; t++) {
    const d = pick([9, 18, 45]), s = pick([9, 18])
    const lo = randInt(11, 60) * 100, hi = lo + 300
    const cands = []
    for (let n = Math.ceil(lo / d) * d; n < hi; n += d) {
      const ds = String(n).split("").reduce((a, c) => a + +c, 0)
      if (ds === s) cands.push(n)
    }
    if (cands.length) {
      const ans = pick(cands)
      return {
        condition_text: `Найдите натуральное число, большее ${lo}, но меньшее ${hi}, которое ` +
          `делится на ${d} и сумма цифр которого равна ${s}. В ответе запишите какое-нибудь ` +
          `одно такое число.`,
        answer: ru(ans),
      }
    }
  }
  return t19Divisible()
}

// =====================================================================================
// №21 — Задачи на смекалку.
// =====================================================================================

// Улитка на дереве: днём +a, ночью −b, высота H → число дней.
function t21Snail() {
  const a = randInt(3, 6), b = randInt(1, a - 1), H = randInt(a + 4, 20)
  const days = Math.ceil((H - a) / (a - b)) + 1
  return {
    condition_text: `Улитка за день заползает вверх по дереву на ${a} м, а за ночь сползает ` +
      `на ${b} ${plural(b, "метр", "метра", "метров")}. Высота дерева ${H} м. За сколько дней ` +
      `улитка доползёт до вершины?`,
    answer: ru(days),
  }
}

// Колодец: 1-й метр c₀ руб., каждый следующий на step руб. дороже; всего n метров.
function t21Well() {
  const c0 = randInt(30, 45) * 100, step = randInt(2, 6) * 100, n = randInt(5, 12)
  const total = (n / 2) * (2 * c0 + (n - 1) * step)
  return {
    condition_text: `Хозяин договорился с рабочими, что они выкопают ему колодец: за первый метр ` +
      `он заплатит ${c0} рублей, а за каждый следующий — на ${step} рублей больше, чем за ` +
      `предыдущий. Сколько рублей заплатит хозяин за колодец глубиной ${n} метров?`,
    answer: ru(total),
  }
}

// Среднее пятого числа: avg4 = m, avg5 = M → x5 = 5M − 4m.
function t21AvgFifth() {
  const m = randInt(5, 15), M = m + randInt(1, 6)
  const x5 = 5 * M - 4 * m
  return {
    condition_text: `Среднее арифметическое четырёх чисел равно ${m}. Среднее арифметическое ` +
      `этих четырёх чисел и пятого числа равно ${M}. Чему равно пятое число?`,
    answer: ru(x5),
  }
}

// =====================================================================================
// №03 / №07 — Чтение и анализ графиков. SVG-график строится кодом, ответ считается по
// тем же данным (гарантированно совпадает с картинкой).
// =====================================================================================

const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

// «Красивые» границы и шаг оси Y (5–8 линий сетки).
function niceAxis(min, max) {
  const range = Math.max(max - min, 1)
  const raw = range / 6
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => s >= raw) || 200
  return { ymin: Math.floor(min / step) * step, ymax: Math.ceil(max / step) * step, ystep: step }
}

// Точечный график по дням: значения arr[i] при x = dayStart+i, точки соединены линией.
function lineChartSvg(arr, dayStart, ytitle) {
  const { ymin, ymax, ystep } = niceAxis(Math.min(...arr), Math.max(...arr))
  const W = 580, H = 360, ml = 46, mr = 14, mt = 16, mb = 34
  const pw = W - ml - mr, ph = H - mt - mb, n = arr.length
  const X = (i) => ml + (pw * i) / (n - 1)
  const Y = (v) => mt + ph * (1 - (v - ymin) / (ymax - ymin))
  let g = ""
  for (let v = ymin; v <= ymax + 1e-9; v += ystep) {
    const y = Y(v)
    g += `<line x1="${ml}" y1="${y}" x2="${W - mr}" y2="${y}" stroke="#e2e5ea" stroke-width="1"/>`
    g += `<text x="${ml - 6}" y="${y + 4}" font-size="12" fill="#555" text-anchor="end">${v}</text>`
  }
  for (let i = 0; i < n; i++) {
    const x = X(i)
    g += `<line x1="${x}" y1="${mt}" x2="${x}" y2="${H - mb}" stroke="#eef0f3" stroke-width="1"/>`
    g += `<text x="${x}" y="${H - mb + 16}" font-size="11" fill="#555" text-anchor="middle">${dayStart + i}</text>`
  }
  g += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${H - mb}" stroke="#888" stroke-width="1.2"/>`
  g += `<line x1="${ml}" y1="${H - mb}" x2="${W - mr}" y2="${H - mb}" stroke="#888" stroke-width="1.2"/>`
  g += `<polyline points="${arr.map((v, i) => `${X(i)},${Y(v)}`).join(" ")}" fill="none" stroke="#2b6cff" stroke-width="1.6"/>`
  arr.forEach((v, i) => (g += `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="#2b6cff"/>`))
  g += `<text x="12" y="${mt + ph / 2}" font-size="11" fill="#333" text-anchor="middle" transform="rotate(-90 12 ${mt + ph / 2})">${ytitle}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`
}

// Ряд значений с УНИКАЛЬНЫМИ максимумом и минимумом (для однозначных вопросов).
function chartSeries(lo, hi, spread) {
  for (let t = 0; t < 500; t++) {
    const n = randInt(11, 14)
    const arr = [randInt(lo, hi)]
    for (let i = 1; i < n; i++) arr.push(Math.max(lo - 2, Math.min(hi + 2, arr[i - 1] + randInt(-spread, spread))))
    const mx = Math.max(...arr), mn = Math.min(...arr)
    if (arr.filter((v) => v === mx).length === 1 && arr.filter((v) => v === mn).length === 1 && mx - mn >= 6)
      return arr
  }
  return [1, 5, 3, 8, 2, 9, 4, 7, 6, 10, 0]
}

// Контекст графика (что показано): температура / цена акции.
function chartContext() {
  return pick([
    { noun: "среднесуточная температура воздуха", city: pick(["Москве", "Казани", "Самаре", "Перми"]),
      unit: "°C", ytitle: "t, °C", xdesc: "числа месяца", vdesc: "температура (в градусах Цельсия)",
      lo: -12, hi: 22, spread: 5, sup: "наибольшую", sub: "наименьшую", what: "температуру", whatWas: "температура" },
    { noun: "цена одной акции компании на момент закрытия торгов", city: null,
      unit: "руб.", ytitle: "цена, руб.", xdesc: "числа месяца", vdesc: "цена акции (в рублях)",
      lo: 40, hi: 120, spread: 8, sup: "наибольшую", sub: "наименьшую", what: "цену акции", whatWas: "цена акции" },
  ])
}

function chartIntro(ctx, dayStart, n) {
  const place = ctx.city ? ` в ${ctx.city}` : ""
  return `На рисунке жирными точками показана ${ctx.noun}${place} в течение ${n} дней. ` +
    `По горизонтали указаны ${ctx.xdesc}, по вертикали — ${ctx.vdesc}. Для наглядности точки ` +
    `соединены линией. `
}

function makeChart(ctx) {
  const arr = chartSeries(ctx.lo, ctx.hi, ctx.spread)
  const dayStart = randInt(1, 16)
  return { arr, dayStart, image_url: svgUrl(lineChartSvg(arr, dayStart, ctx.ytitle)) }
}

// №3 — наибольшее / наименьшее значение по графику.
function t03Extreme() {
  const ctx = chartContext(), { arr, dayStart, image_url } = makeChart(ctx)
  const hi = Math.random() < 0.5
  return {
    condition_text: chartIntro(ctx, dayStart, arr.length) +
      `Определите по рисунку ${hi ? ctx.sup : ctx.sub} ${ctx.what}. Ответ дайте в ${ctx.unit === "°C" ? "градусах Цельсия" : "рублях"}.`,
    image_url,
    answer: ru(hi ? Math.max(...arr) : Math.min(...arr)),
  }
}

// №3 — значение в конкретный день.
function t03ValueOnDay() {
  const ctx = chartContext(), { arr, dayStart, image_url } = makeChart(ctx)
  const idx = randInt(0, arr.length - 1), day = dayStart + idx
  return {
    condition_text: chartIntro(ctx, dayStart, arr.length) +
      `Определите по рисунку, какова была ${ctx.whatWas} ${day}-го числа. Ответ дайте в ${ctx.unit === "°C" ? "градусах Цельсия" : "рублях"}.`,
    image_url,
    answer: ru(arr[idx]),
  }
}

// №3 — сколько дней значение было выше порога.
function t03CountAbove() {
  for (let t = 0; t < 100; t++) {
    const ctx = chartContext(), { arr, dayStart, image_url } = makeChart(ctx)
    const mn = Math.min(...arr), mx = Math.max(...arr)
    const thr = randInt(mn + 1, mx - 1)
    const cnt = arr.filter((v) => v > thr).length
    if (cnt < 2 || cnt > arr.length - 2) continue
    return {
      condition_text: chartIntro(ctx, dayStart, arr.length) +
        `Определите по рисунку, сколько дней ${ctx.whatWas} была выше ${thr} ${ctx.unit}.`,
      image_url,
      answer: ru(cnt),
    }
  }
  return t03Extreme()
}

// №7 — разность между наибольшим и наименьшим значениями.
function t07Range() {
  const ctx = chartContext(), { arr, dayStart, image_url } = makeChart(ctx)
  return {
    condition_text: chartIntro(ctx, dayStart, arr.length) +
      `Определите по рисунку разность между наибольшим и наименьшим значениями ${ctx.what === "температуру" ? "температуры" : "цены акции"}. ` +
      `Ответ дайте в ${ctx.unit === "°C" ? "градусах Цельсия" : "рублях"}.`,
    image_url,
    answer: ru(Math.max(...arr) - Math.min(...arr)),
  }
}

// №7 — сколько дней значение понижалось относительно предыдущего.
function t07FallDays() {
  const ctx = chartContext(), { arr, dayStart, image_url } = makeChart(ctx)
  let cnt = 0
  for (let i = 1; i < arr.length; i++) if (arr[i] < arr[i - 1]) cnt++
  return {
    condition_text: chartIntro(ctx, dayStart, arr.length) +
      `Определите по рисунку, в течение скольких дней ${ctx.whatWas} была ниже, чем в предыдущий день.`,
    image_url,
    answer: ru(cnt),
  }
}

// =====================================================================================
// №12 — Планиметрия. Незакартиночные задачи банка поставлены словесно (без чертежа) и
// решаются точно: диагонали ромба/прямоугольника через пифагоровы тройки, площадь
// трапеции, внешний угол прямоугольного треугольника. Ответы — целые.
// =====================================================================================

// Пифагоровы тройки (a<b — катеты/полудиагонали, c — гипотенуза/сторона), масштаб ×k.
const PYTHAG = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [12, 35, 37], [11, 60, 61]]
function scaledTriple(maxK = 4) {
  const [a, b, c] = pick(PYTHAG), k = randInt(1, maxK)
  return [a * k, b * k, c * k]
}

// Параллелограмм, диагонали — биссектрисы углов (⇒ ромб): сторона + одна диагональ → другая.
function t12RhombusBisector() {
  const [a, b, c] = scaledTriple()          // полудиагонали a,b; сторона c
  const givenHalf = pick([a, b]), otherHalf = givenHalf === a ? b : a
  return {
    condition_text: `В параллелограмме ABCD диагонали являются биссектрисами его углов, ` +
      `AB=${c}, AC=${2 * givenHalf}. Найдите BD.`,
    answer: ru(2 * otherHalf),
  }
}

// Ромб (диагонали — биссектрисы) по двум диагоналям → периметр.
function t12RhombusPerimeter() {
  const [a, b, c] = scaledTriple()
  return {
    condition_text: `В параллелограмме диагонали являются биссектрисами его углов и равны ` +
      `${2 * a} и ${2 * b}. Найдите периметр параллелограмма.`,
    answer: ru(4 * c),
  }
}

// Параллелограмм с перпендикулярными диагоналями (⇒ ромб), ∠A+∠C=120° ⇒ ∠A=60° ⇒ BD=AB.
function t12ParallelogramPerp() {
  const ab = randInt(7, 50)
  return {
    condition_text: `В параллелограмме ABCD диагонали перпендикулярны. Сумма углов A и C ` +
      `равна 120°, AB=${ab}. Найдите BD.`,
    answer: ru(ab),
  }
}

// Обе диагонали равны (⇒ прямоугольник): диагональ + сторона → другая сторона.
function t12RectangleSide() {
  const [a, b, c] = scaledTriple()
  const givenSide = pick([a, b]), other = givenSide === a ? b : a
  return {
    condition_text: `Обе диагонали параллелограмма равны ${c}. Одна из сторон параллелограмма ` +
      `равна ${givenSide}. Найдите другую сторону параллелограмма.`,
    answer: ru(other),
  }
}

// Прямоугольник (равные диагонали): сторона + диагональ → площадь.
function t12RectangleArea() {
  const [a, b, c] = scaledTriple()
  return {
    condition_text: `В параллелограмме ABCD известно, что AB=${a}, AC=BD=${c}. Найдите площадь ` +
      `параллелограмма.`,
    answer: ru(a * b),
  }
}

// Ромб: сумма двух углов 240° ⇒ углы 120° и 60°; меньшая диагональ = сторона = P/4.
function t12RhombusSmallDiag() {
  const s = randInt(3, 20)
  return {
    condition_text: `Сумма двух углов ромба равна 240°, а его периметр равен ${4 * s}. ` +
      `Найдите длину меньшей диагонали ромба.`,
    answer: ru(s),
  }
}

// Прямоугольный треугольник, внешний угол при A =150° ⇒ ∠A=30° ⇒ BC=AB·sin30=AB/2.
function t12RightTriangleExt() {
  const bc = randInt(4, 35), ab = 2 * bc
  return {
    condition_text: `В прямоугольном треугольнике ABC внешний угол при вершине A равен 150°. ` +
      `Гипотенуза AB=${ab}. Найдите длину катета BC.`,
    answer: ru(bc),
  }
}

// Трапеция: основания + боковая под углом 150° (h = l·sin30 = l/2) → площадь.
function t12TrapezoidLateral() {
  for (let t = 0; t < 200; t++) {
    const l = 2 * randInt(2, 12), h = l / 2
    const a = randInt(3, 12), b = a + 2 * randInt(1, 6)
    const area = ((a + b) * h) / 2
    if (!Number.isInteger(area)) continue
    return {
      condition_text: `Основания трапеции равны ${a} и ${b}, боковая сторона, равная ${l}, ` +
        `образует с одним из оснований трапеции угол 150°. Найдите площадь трапеции.`,
      answer: ru(area),
    }
  }
  return { condition_text: `Основания трапеции равны 5 и 13, боковая сторона, равная 10, образует с одним из оснований трапеции угол 150°. Найдите площадь трапеции.`, answer: "45" }
}

// Площадь трапеции по формуле S=(a+b)/2·h (подстановка).
function t12TrapezoidFormula() {
  const a = randInt(3, 15), b = randInt(3, 15), h = 2 * randInt(2, 12)
  return {
    condition_text: `Площадь трапеции вычисляется по формуле S = ${FF("a + b", "2")}·h, где a и b — ` +
      `длины оснований трапеции, h — её высота. Пользуясь этой формулой, найдите площадь ` +
      `трапеции, у которой основания равны ${a} и ${b}, а высота равна ${h}.`,
    answer: ru(((a + b) * h) / 2),
  }
}

// =====================================================================================
// №09 — Задачи на квадратной решётке (клетка 1×1). Фигура рисуется в SVG, площадь/длина
// считаются по тем же вершинам (гарантированно совпадают с картинкой). Навык ОГЭ-сетки.
// =====================================================================================

// Площадь простого многоугольника по формуле Гаусса (шнуровки).
function shoelace(pts) {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s) / 2
}

// SVG клетчатой бумаги с многоугольником (вершины — целые точки).
function gridSvg(poly) {
  const maxX = Math.max(...poly.map((p) => p[0])) + 1, maxY = Math.max(...poly.map((p) => p[1])) + 1
  const cell = 34, pad = 14
  const W = maxX * cell + 2 * pad, H = maxY * cell + 2 * pad
  const X = (x) => pad + x * cell, Y = (y) => H - pad - y * cell
  let g = ""
  for (let i = 0; i <= maxX; i++) g += `<line x1="${X(i)}" y1="${Y(0)}" x2="${X(i)}" y2="${Y(maxY)}" stroke="#cfd4da" stroke-width="1"/>`
  for (let j = 0; j <= maxY; j++) g += `<line x1="${X(0)}" y1="${Y(j)}" x2="${X(maxX)}" y2="${Y(j)}" stroke="#cfd4da" stroke-width="1"/>`
  g += `<polygon points="${poly.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}" fill="#2b6cff22" stroke="#2b6cff" stroke-width="2.2"/>`
  poly.forEach(([x, y]) => (g += `<circle cx="${X(x)}" cy="${Y(y)}" r="3.5" fill="#2b6cff"/>`))
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`
}

// Упорядочить точки по углу вокруг центроида → простой (несамопересекающийся) многоугольник.
function orderByAngle(pts) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return pts.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx))
}

const uniqPts = (pts) => pts.length === new Set(pts.map((p) => p.join(","))).size

// №9 — площадь треугольника на решётке.
function t09TriangleArea() {
  for (let t = 0; t < 300; t++) {
    const box = randInt(4, 6)
    const poly = [[randInt(0, box), randInt(0, box)], [randInt(0, box), randInt(0, box)], [randInt(0, box), randInt(0, box)]]
    if (!uniqPts(poly)) continue
    const area = shoelace(poly)
    if (area < 3 || !Number.isInteger(area * 2)) continue
    return {
      condition_text: `Найдите площадь треугольника, изображённого на клетчатой бумаге с размером ` +
        `клетки 1 см × 1 см. Ответ дайте в квадратных сантиметрах.`,
      image_url: svgUrl(gridSvg(poly)),
      answer: ru(area),
    }
  }
  return t09QuadArea()
}

// №9 — площадь четырёхугольника на решётке.
function t09QuadArea() {
  for (let t = 0; t < 400; t++) {
    const box = randInt(4, 6)
    const raw = Array.from({ length: 4 }, () => [randInt(0, box), randInt(0, box)])
    if (!uniqPts(raw)) continue
    const poly = orderByAngle(raw)
    const area = shoelace(poly)
    if (area < 5 || !Number.isInteger(area * 2)) continue
    return {
      condition_text: `Найдите площадь четырёхугольника, изображённого на клетчатой бумаге с ` +
        `размером клетки 1 см × 1 см. Ответ дайте в квадратных сантиметрах.`,
      image_url: svgUrl(gridSvg(poly)),
      answer: ru(area),
    }
  }
  return t09TriangleArea()
}

// №9 — длина отрезка на решётке (целая: пифагорова пара dx,dy).
function t09Length() {
  const tri = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10], [4, 3, 5]])
  const [dx, dy, d] = tri
  const x0 = randInt(0, 1), y0 = randInt(0, 1)
  const poly = [[x0, y0], [x0 + dx, y0 + dy]]  // отрезок как «многоугольник» из 2 точек
  return {
    condition_text: `На клетчатой бумаге с размером клетки 1 см × 1 см изображён отрезок. Найдите ` +
      `его длину. Ответ дайте в сантиметрах.`,
    image_url: svgUrl(gridSvg(poly)),
    answer: ru(d),
  }
}

// =====================================================================================
// №13 — Стереометрия (словесные задачи, целые ответы).
// =====================================================================================

// Площадь поверхности прямоугольного параллелепипеда S = 2(ab+ac+bc).
function t13BoxSurface() {
  const a = randInt(2, 12), b = randInt(2, 12), c = randInt(2, 12)
  return {
    condition_text: `Площадь поверхности прямоугольного параллелепипеда с рёбрами a, b и c ` +
      `вычисляется по формуле S = 2(ab + ac + bc). Найдите площадь поверхности параллелепипеда, ` +
      `рёбра которого равны ${a}, ${b} и ${c}.`,
    answer: ru(2 * (a * b + a * c + b * c)),
  }
}

// Два шара: во сколько раз площадь поверхности больше = (R/r)².
function t13SphereRatio() {
  const r = randInt(2, 6), m = randInt(2, 5), R = r * m
  return {
    condition_text: `Даны два шара с радиусами ${R} и ${r}. Во сколько раз площадь поверхности ` +
      `большего шара больше площади поверхности меньшего шара?`,
    answer: ru(m * m),
  }
}

// Прямая призма, в основании прямоугольный треугольник (катет + гипотенуза), высота → объём.
function t13PrismVolume() {
  for (let t = 0; t < 200; t++) {
    const l1 = randInt(2, 8), l2 = randInt(2, 12)
    if (l1 >= l2) continue
    const H = l1 * l1 + l2 * l2              // гипотенуза = √H
    if (Number.isInteger(Math.sqrt(H))) continue  // хотим √ иррациональной (как в банке)
    const ht = randInt(3, 12)
    const V = (l1 * l2 * ht) / 2
    if (!Number.isInteger(V)) continue
    return {
      condition_text: `В основании прямой призмы лежит прямоугольный треугольник, один из ` +
        `катетов которого равен ${l1}, а гипотенуза равна ${rT(H)}. Высота призмы равна ${ht}. ` +
        `Найдите объём призмы.`,
      answer: ru(V),
    }
  }
  return { condition_text: `В основании прямой призмы лежит прямоугольный треугольник, один из катетов которого равен 2, а гипотенуза равна ${rT(40)}. Высота призмы равна 5. Найдите объём призмы.`, answer: "30" }
}

// Правильная шестиугольная пирамида: сторона a, боковое ребро b → S_бок = 3·a·апофема грани.
function t13HexPyramidLateral() {
  const [leg1, leg2, hyp] = pick(PYTHAG)      // a/2 = leg1, апофема = leg2, ребро = hyp
  const a = 2 * leg1, edge = hyp, slant = leg2
  return {
    condition_text: `Сторона основания правильной шестиугольной пирамиды равна ${a}, боковое ребро ` +
      `равно ${edge}. Найдите площадь боковой поверхности этой пирамиды.`,
    answer: ru(3 * a * slant),
  }
}

// Четырёхугольная пирамида, основание — прямоугольник a×b, объём V → высота = 3V/(ab).
function t13RectPyramidHeight() {
  const a = randInt(3, 12), b = randInt(3, 12), h = randInt(2, 12)
  const V = (a * b * h) / 3 * 1   // может быть дробным
  if (!Number.isInteger(V)) return t13RectPyramidHeight()
  return {
    condition_text: `Основанием четырёхугольной пирамиды является прямоугольник со сторонами ` +
      `${a} и ${b}. Найдите высоту этой пирамиды, если её объём равен ${V}.`,
    answer: ru(h),
  }
}

// Правильная треугольная пирамида: сторона a, высота k√3 → V = a²·k/4.
function t13TriPyramidVolume() {
  const a = 2 * randInt(1, 5), k = randInt(2, 9)   // a чётное → a²·k/4 целое
  const V = (a * a * k) / 4
  return {
    condition_text: `Сторона основания правильной треугольной пирамиды равна ${a}, а высота ` +
      `пирамиды равна ${k}${rT(3)}. Найдите объём этой пирамиды.`,
    answer: ru(V),
  }
}

// =====================================================================================
// №10 — Прикладная геометрия (словесные задачи, целые ответы).
// =====================================================================================

// Колесо: N спиц (равные углы) → угол между соседними = 360/N.
function t10Spokes() {
  const N = pick([10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72])
  return {
    condition_text: `Колесо имеет ${N} спиц. Углы между соседними спицами равны. Найдите ` +
      `величину угла (в градусах), который образуют две соседние спицы.`,
    answer: ru(360 / N),
  }
}

// Забор с трёх сторон прямоугольника (бо́льшая сторона вдоль воды не огораживается).
function t10Fence() {
  const small = randInt(2, 8) * 100, big = small + randInt(1, 6) * 100
  return {
    condition_text: `Участок земли для строительства санатория имеет форму прямоугольника, ` +
      `стороны которого равны ${big} м и ${small} м. Одна из бо́льших сторон участка идёт вдоль ` +
      `моря, а три остальные стороны нужно огородить забором. Найдите длину забора (в метрах).`,
    answer: ru(2 * small + big),
  }
}

// Облицовка квадратными плитками: (W·H)/(сторона²) в одних единицах.
function t10Tiles() {
  for (let t = 0; t < 200; t++) {
    const side = pick([10, 20, 25, 50]), W = randInt(2, 6), H = randInt(2, 6)
    const cnt = (W * 100 * H * 100) / (side * side)
    if (!Number.isInteger(cnt)) continue
    return {
      condition_text: `Сколько потребуется кафельных плиток квадратной формы со стороной ${side} см, ` +
        `чтобы облицевать ими стену, имеющую форму прямоугольника со сторонами ${W} м и ${H} м?`,
      answer: ru(cnt),
    }
  }
  return { condition_text: `Сколько потребуется кафельных плиток квадратной формы со стороной 20 см, чтобы облицевать ими стену, имеющую форму прямоугольника со сторонами 3 м и 4 м?`, answer: "300" }
}

// Столб посередине горки: по подобию высота столба = половина высоты горки.
function t10Slide() {
  const hh = randInt(20, 60) / 10 * 2 / 2   // высота горки 2.0..6.0 (кратна 0,2)
  return {
    condition_text: `Вертикальный столб подпирает детскую горку посередине. Найдите высоту ` +
      `этого столба, если высота горки равна ${ru(hh)} м. Ответ дайте в метрах.`,
    answer: ru(hh / 2),
  }
}

// =====================================================================================
// №11 — Прикладная стереометрия (масштаб объёма ~ куб линейного размера и т.п.).
// =====================================================================================

// Шар: масса ~ объём ~ d³. Масса шара d2 = W·(d2/d1)³.
function t11Ball() {
  for (let t = 0; t < 200; t++) {
    const d1 = randInt(2, 6), d2 = randInt(2, 6)
    if (d1 === d2) continue
    const k = randInt(1, 6), W = k * d1 ** 3, W2 = k * d2 ** 3
    if (W > 2000 || W2 > 2000) continue
    return {
      condition_text: `Однородный шар диаметром ${d1} см весит ${W} граммов. Сколько граммов ` +
        `весит шар диаметром ${d2} см, изготовленный из того же материала?`,
      answer: ru(W2),
    }
  }
  return { condition_text: `Однородный шар диаметром 3 см весит 81 грамм. Сколько граммов весит шар диаметром 2 см, изготовленный из того же материала?`, answer: "24" }
}

// Открытый ящик-куб (без одной грани), покрасить снаружи со всех сторон → 5·a².
function t11OpenCube() {
  const a = pick([10, 20, 30, 40, 50, 15, 25])
  return {
    condition_text: `Ящик, имеющий форму куба с ребром ${a} см без одной грани, нужно покрасить ` +
      `снаружи со всех сторон. Найдите площадь поверхности, которую нужно покрасить. Ответ дайте ` +
      `в квадратных сантиметрах.`,
    answer: ru(5 * a * a),
  }
}

// Конус вершиной вниз: жидкость до доли k высоты → объём = V·k³.
function t11Cone() {
  const [p, q] = pick([[1, 2], [1, 3], [1, 4]])
  const V = q ** 3 * randInt(2, 12)          // объём кратен q³ → целый ответ
  const ans = (V * p ** 3) / q ** 3
  return {
    condition_text: `В сосуде, имеющем форму конуса с вершиной внизу, уровень жидкости достигает ` +
      `${FF(String(p), String(q))} высоты. Объём сосуда равен ${V}. Найдите объём жидкости.`,
    answer: ru(ans),
  }
}

// =====================================================================================
// №01 — Простейшие текстовые задачи (округление вверх/вниз, сравнение, скорость).
// =====================================================================================

// Перевозка: ceil(людей / вместимость).
function t01Transport() {
  const kids = randInt(120, 400), adults = randInt(10, 40), cap = pick([40, 42, 45, 50])
  const total = kids + adults
  return {
    condition_text: `В летнем лагере ${kids} ${plural(kids, "ребёнок", "ребёнка", "детей")} и ` +
      `${adults} ${plural(adults, "воспитатель", "воспитателя", "воспитателей")}. В одном ` +
      `автобусе можно перевозить не более ${cap} пассажиров. Какое наименьшее количество ` +
      `автобусов понадобится, чтобы перевезти всех из лагеря в город?`,
    answer: ru(Math.ceil(total / cap)),
  }
}

// Палатки: ceil(людей / мест).
function t01Tents() {
  const k = pick([2, 3, 4]), people = randInt(13, 40)
  return {
    condition_text: `В школе есть ${k === 2 ? "двухместные" : k === 3 ? "трёхместные" : "четырёхместные"} ` +
      `туристические палатки. Какое наименьшее число таких палаток нужно взять в поход, в котором ` +
      `участвует ${people} ${plural(people, "человек", "человека", "человек")}?`,
    answer: ru(Math.ceil(people / k)),
  }
}

// Пачки чая: ceil(расход·дней / в пачке).
function t01TeaPacks() {
  const perDay = pick([40, 50, 60, 70, 80]), days = randInt(3, 12), pack = pick([25, 50])
  return {
    condition_text: `Каждый день во время конференции расходуется ${perDay} ` +
      `${plural(perDay, "пакетик", "пакетика", "пакетиков")} чая. Конференция длится ${days} ` +
      `${plural(days, "день", "дня", "дней")}. В пачке чая ${pack} пакетиков. Какого наименьшего ` +
      `количества пачек чая хватит на все дни конференции?`,
    answer: ru(Math.ceil((perDay * days) / pack)),
  }
}

// Принтер: floor(время·60 / сек на страницу).
function t01Printer() {
  const sec = pick([6, 8, 9, 12, 15]), min = randInt(8, 20)
  return {
    condition_text: `Принтер печатает одну страницу за ${sec} ${plural(sec, "секунду", "секунды", "секунд")}. ` +
      `Какое наибольшее количество страниц можно напечатать на этом принтере за ${min} минут?`,
    answer: ru(Math.floor((min * 60) / sec)),
  }
}

// Букет из нечётного числа цветов: наибольшее нечётное ≤ floor(бюджет/цена).
function t01Bouquet() {
  const flower = pick([
    { nom: "Тюльпаны", gen: "тюльпанов" }, { nom: "Розы", gen: "роз" },
    { nom: "Пионы", gen: "пионов" }, { nom: "Гвоздики", gen: "гвоздик" },
  ])
  const price = pick([30, 40, 50, 60, 80]), budget = randInt(200, 600)
  let cnt = Math.floor(budget / price)
  if (cnt % 2 === 0) cnt -= 1
  return {
    condition_text: `На день рождения полагается дарить букет из нечётного числа цветов. ` +
      `${flower.nom} стоят ${price} рублей за штуку. У Вани есть ${budget} ` +
      `${plural(budget, "рубль", "рубля", "рублей")}. Из какого ` +
      `наибольшего числа ${flower.gen} он может купить букет?`,
    answer: ru(Math.max(cnt, 1)),
  }
}

// Экономия на проездном: перевес разовых билетов над стоимостью проездного.
function t01PassSavings() {
  for (let t = 0; t < 200; t++) {
    const pass = randInt(6, 12) * 100, ride = pick([26, 30, 35, 40]), trips = randInt(25, 45)
    const save = ride * trips - pass
    if (save <= 0) continue
    return {
      condition_text: `Стоимость проездного билета на месяц составляет ${pass} рублей, а стоимость ` +
        `билета на одну поездку — ${ride} рублей. Аня купила проездной и сделала за месяц ${trips} ` +
        `${plural(trips, "поездку", "поездки", "поездок")}. На сколько рублей больше она потратила ` +
        `бы, если бы покупала билеты на каждую поездку?`,
      answer: ru(save),
    }
  }
  return { condition_text: `Стоимость проездного билета на месяц составляет 1150 рублей, а стоимость билета на одну поездку — 40 рублей. Аня купила проездной и сделала за месяц 37 поездок. На сколько рублей больше она потратила бы, если бы покупала билеты на каждую поездку?`, answer: "330" }
}

// Средняя скорость (м за с) → км/ч.
function t01AvgSpeedKmh() {
  for (let t = 0; t < 300; t++) {
    const time = pick([36, 30, 40, 45, 60, 72]), speed = pick([25, 30, 35, 40, 45, 50])
    const dist = (speed * time) / 3.6
    if (!Number.isInteger(dist)) continue
    return {
      condition_text: `Бегун пробежал ${dist} метров за ${time} секунд. Найдите среднюю скорость ` +
        `бегуна на дистанции. Ответ дайте в километрах в час.`,
      answer: ru(speed),
    }
  }
  return { condition_text: `Бегун пробежал 350 метров за 36 секунд. Найдите среднюю скорость бегуна на дистанции. Ответ дайте в километрах в час.`, answer: "35" }
}

// Покраска: ceil(площадь·г/м² / граммов в банке).
function t01Paint() {
  const perM2 = pick([120, 140, 160, 200, 210]), canKg = 3, area = randInt(8, 30)
  return {
    condition_text: `Для покраски 1 кв. м потолка требуется ${perM2} г краски. Краска продаётся в ` +
      `банках по ${canKg} кг. Какое наименьшее количество банок краски нужно купить для покраски ` +
      `потолка площадью ${area} кв. м?`,
    answer: ru(Math.ceil((area * perM2) / (canKg * 1000))),
  }
}

// Пачки бумаги: ceil(расход / в пачке).
function t01Paper() {
  const pack = 250, use = randInt(3, 12) * 100
  return {
    condition_text: `В пачке ${pack} листов бумаги формата А4. За неделю в офисе расходуется ${use} ` +
      `листов. Какого наименьшего количества пачек бумаги хватит на 4 недели?`,
    answer: ru(Math.ceil((use * 4) / pack)),
  }
}

// Перевод футов в метры (1 фут = 0,3048 м).
function t01Feet() {
  const feet = randInt(2, 41) * 1000
  return {
    condition_text: `Система навигации самолёта информирует пассажира о том, что полёт проходит на ` +
      `высоте ${feet} футов. Выразите высоту полёта в метрах. Считайте, что 1 фут равен 0,3048 м. ` +
      `Ответ округлите до целого числа метров.`,
    answer: ru(Math.round(feet * 0.3048)),
  }
}

// =====================================================================================
// №18 — Неравенства (соответствие «неравенство ↔ решение»). Решения известны точно
// по построению; каждое проверяется численной подстановкой в тесте.
// =====================================================================================

function t18Matching() {
  const p = randInt(2, 5), q = p + randInt(1, 3)      // 2 ≤ p < q
  const aq = 2 ** q                                    // показательное с основанием 2
  const items = [
    { ineq: `${FF(`x − ${p}`, `x − ${q}`)} < 0`, sol: `${p} < x < ${q}` },
    { ineq: `(x − ${p})(x − ${q}) > 0`, sol: `x < ${p} или x > ${q}` },
    { ineq: `2${supT("x")} > ${aq}`, sol: `x > ${q}` },
    { ineq: `log${sub(2)} x < 0`, sol: `0 < x < 1` },
  ]
  const order = shuffle([0, 1, 2, 3])
  const left = items.map((it) => it.ineq)
  const right = order.map((i) => items[i].sol)
  const answer = left.map((_, li) => order.indexOf(li) + 1).join("")
  return {
    condition_text: `Каждому неравенству соответствует его решение. Установите соответствие между ` +
      `неравенствами в левом столбце и их решениями в правом.\n` +
      matchBlock({ leftHdr: "НЕРАВЕНСТВА", rightHdr: "РЕШЕНИЯ", left, right }),
    answer,
  }
}

// =====================================================================================
// №02 — Размеры и единицы измерения (соответствие «величина ↔ значение»).
// Величины берём из РАЗНЫХ размерностей → каждое значение подходит ровно одной величине
// (соответствие однозначно по построению, без риска двусмысленности).
// =====================================================================================

const UNIT_BANK = {
  mass: [{ q: "Масса взрослого человека", v: "70 кг" }, { q: "Масса легкового автомобиля", v: "1 200 кг" }, { q: "Масса гружёного самосвала", v: "30 т" }],
  length: [{ q: "Длина карандаша", v: "15 см" }, { q: "Высота одноэтажного дома", v: "3 м" }, { q: "Расстояние от Москвы до Твери", v: "170 км" }],
  volume: [{ q: "Объём стакана", v: "200 мл" }, { q: "Объём ведра", v: "10 л" }, { q: "Объём бака легкового автомобиля", v: "50 л" }],
  time: [{ q: "Продолжительность школьного урока", v: "45 мин" }, { q: "Продолжительность футбольного матча", v: "90 мин" }],
  speed: [{ q: "Скорость пешехода", v: "5 км/ч" }, { q: "Скорость автомобиля по трассе", v: "90 км/ч" }],
  area: [{ q: "Площадь классной доски", v: "3 м²" }, { q: "Площадь двухкомнатной квартиры", v: "60 м²" }],
  temp: [{ q: "Температура кипения воды", v: "100 °C" }, { q: "Температура тела здорового человека", v: "36,6 °C" }],
}

function t02Units() {
  const dims = shuffle(Object.keys(UNIT_BANK)).slice(0, 3)
  const chosen = dims.map((d) => pick(UNIT_BANK[d]))
  const left = chosen.map((c) => c.q)
  const order = shuffle([0, 1, 2])
  const right = order.map((i) => chosen[i].v)
  // позиция значения величины left[li] в перемешанном правом столбце (1-based)
  const answer = left.map((_, li) => order.indexOf(li) + 1).join("")
  return {
    condition_text: `Установите соответствие между величинами и их возможными значениями: ` +
      `к каждому элементу первого столбца подберите соответствующий элемент из второго столбца.\n` +
      matchBlock({ leftHdr: "ВЕЛИЧИНЫ", rightHdr: "ВОЗМОЖНЫЕ ЗНАЧЕНИЯ", left, right }),
    answer,
  }
}

// =====================================================================================
// №06 — Выбор оптимального варианта (посчитать все варианты, взять выгоднейший).
// =====================================================================================

// Тарифные планы: абонплата + плата за единицу. Ответ — минимальная стоимость.
function t06Tariff() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const usage = pick([300, 400, 500, 600])       // минут в месяц
    const plans = ["А", "Б", "В"].map((name) => ({
      name, fee: randInt(0, 8) * 100, rate: randInt(1, 6),
    }))
    const costs = plans.map((p) => p.fee + p.rate * usage)
    const minC = Math.min(...costs)
    if (costs.filter((c) => c === minC).length !== 1) continue   // единственный выгодный
    const lines = plans.map((p) => `План «${p.name}»: абонентская плата ${p.fee} руб. в месяц ` +
      `и ${p.rate} руб. за 1 минуту разговора.`).join("\n")
    return {
      condition_text: `Телефонная компания предоставляет на выбор три тарифных плана.\n${lines}\n` +
        `Абонент выбирает наиболее дешёвый план, исходя из предположения, что общая ` +
        `длительность разговоров составит ${usage} минут в месяц. Какую сумму (в рублях) он ` +
        `должен заплатить за месяц?`,
      answer: ru(minC),
    }
  }
  return { condition_text: `Телефонная компания предоставляет три тарифных плана.\nПлан «А»: 0 руб. в месяц и 3 руб. за минуту.\nПлан «Б»: 300 руб. в месяц и 1 руб. за минуту.\nПлан «В»: 540 руб. в месяц и 0 руб. за минуту.\nАбонент выбирает наиболее дешёвый план при 500 минутах в месяц. Какую сумму он должен заплатить?`, answer: "540" }
}

// Закупка материала: нужно G единиц; продаётся упаковками у нескольких продавцов. Мин. стоимость.
function t06Material() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const need = pick([400, 600, 800, 1000])       // граммов пряжи
    const sellers = [1, 2, 3].map((i) => ({ i, per: pick([50, 100, 150, 200]), price: randInt(6, 20) * 10 }))
    const costs = sellers.map((s) => Math.ceil(need / s.per) * s.price)
    const minC = Math.min(...costs)
    if (costs.filter((c) => c === minC).length !== 1) continue
    const lines = sellers.map((s) => `у продавца №${s.i} — по ${s.price} руб. за моток массой ${s.per} г`).join(";\n")
    return {
      condition_text: `Для того чтобы связать свитер, хозяйке нужно ${need} г пряжи. Пряжу можно ` +
        `купить в трёх местах:\n${lines}.\nМотки нельзя распечатывать и продавать по частям. ` +
        `Сколько рублей заплатит хозяйка, если купит пряжу наиболее дёшево?`,
      answer: ru(minC),
    }
  }
  return { condition_text: `Хозяйке нужно 600 г пряжи. Моток 100 г стоит 80 руб. у одного продавца и 90 руб. у другого. Сколько рублей она заплатит, купив дешевле?`, answer: "480" }
}

// =====================================================================================
// №08 — Анализ утверждений. Истинность утверждения = «верно при указанных условиях»,
// т.е. следует из условий (истинно во ВСЕХ согласованных с условиями порядках), а не в
// одном тайном. Поэтому перебираем все перестановки рангов и проверяем следование.
// =====================================================================================

function permute4(a) {
  if (a.length <= 1) return [a]
  const out = []
  a.forEach((x, i) => { for (const p of permute4([...a.slice(0, i), ...a.slice(i + 1)])) out.push([x, ...p]) })
  return out
}

// Упорядочивание по возрасту/росту: цепочка из трёх + четвёртый по «не старше» (ambiguity).
function t08Ordering() {
  const dim = pick([
    { verbHi: "старше", verbLo: "младше", top: "самый старший", bot: "самый младший", intro: "по возрасту" },
    { verbHi: "выше", verbLo: "ниже", top: "самый высокий", bot: "самый низкий", intro: "по росту" },
  ])
  for (let attempt = 0; attempt < 50; attempt++) {
    const names = shuffle(["Виктор", "Денис", "Егор", "Андрей", "Борис", "Глеб", "Игорь", "Павел"]).slice(0, 4)
    // тайный порядок (для вывода истинных условий), asc = от меньшего к большему
    const secret = shuffle([0, 1, 2, 3])
    const sr = {}; names.forEach((n, i) => (sr[n] = secret[i]))
    const asc = [...names].sort((a, b) => sr[a] - sr[b])
    const [s, p, q, rr] = asc   // s — «свободный» младший, p<q<rr — цепочка
    // условия (истинны при secret, оставляют неоднозначность позиции s относительно p)
    const conds = [
      { text: `${q} ${dim.verbHi}, чем ${p}, но ${dim.verbLo}, чем ${rr}.`, ok: (o) => o[q] > o[p] && o[q] < o[rr] },
      { text: `${s} не ${dim.verbHi}, чем ${q}.`, ok: (o) => o[s] < o[q] },
    ]
    // все согласованные с условиями назначения рангов
    const worlds = permute4([0, 1, 2, 3])
      .map((perm) => { const o = {}; names.forEach((n, i) => (o[n] = perm[i])); return o })
      .filter((o) => conds.every((c) => c.ok(o)))
    if (worlds.length < 2) continue   // нужна неоднозначность, иначе задача тривиальна
    // пул кандидатов-утверждений
    const cand = []
    for (const X of names) {
      cand.push({ text: `${X} — ${dim.top} из всех четверых.`, ok: (o) => o[X] === 3 })
      cand.push({ text: `${X} — ${dim.bot} из всех четверых.`, ok: (o) => o[X] === 0 })
      for (const Y of names) if (X !== Y) cand.push({ text: `${X} ${dim.verbHi}, чем ${Y}.`, ok: (o) => o[X] > o[Y] })
    }
    // следование: истинно во ВСЕХ мирах; «ложно» = существует мир-опровержение
    for (const c of cand) c.entailed = worlds.every((o) => c.ok(o))
    const yes = shuffle(cand.filter((c) => c.entailed))
    const no = shuffle(cand.filter((c) => !c.entailed))
    if (yes.length < 1 || no.length < 1) continue
    // берём 4 утверждения: 1–2 верных + остальные неверные, вперемешку
    const nYes = Math.min(yes.length, randInt(1, 2))
    const chosen = shuffle([...yes.slice(0, nYes), ...no.slice(0, 4 - nYes)])
    if (chosen.length < 4) continue
    const answer = chosen.map((c, i) => (c.entailed ? i + 1 : null)).filter(Boolean).join("")
    const list = chosen.map((c, i) => `${i + 1}) ${c.text}`).join("\n")
    return {
      condition_text: `Известно, что ${conds.map((c) => c.text).join(" ")} Выберите все утверждения, ` +
        `которые верны при указанных условиях, и запишите в ответе их номера.\n${list}`,
      answer,
    }
  }
  return { condition_text: `Известно, что Егор старше, чем Денис, но младше, чем Виктор. Андрей не старше, чем Егор. Выберите все утверждения, которые верны при указанных условиях, и запишите в ответе их номера.\n1) Виктор — самый старший из всех четверых.\n2) Андрей — самый младший из всех четверых.\n3) Егор старше, чем Денис.`, answer: "13" }
}

// =====================================================================================
// Реестр и мета-темы
// =====================================================================================

export const GENERATORS_EGE_BASE = {
  1: [t01Transport, t01Tents, t01TeaPacks, t01Printer, t01Bouquet, t01PassSavings, t01AvgSpeedKmh, t01Paint, t01Paper, t01Feet],
  2: [t02Units],
  3: [t03Extreme, t03ValueOnDay, t03CountAbove],
  4: [t04Current, t04Steps, t04Fahrenheit, t04Centripetal, t04InRadius, t04GeoMean, t04Divisors, t04LawSines],
  5: [t05Tickets, t05Defective, t05CoinTwice, t05Ratio, t05TwoDevices],
  6: [t06Tariff, t06Material],
  7: [t07Range, t07FallDays],
  8: [t08Ordering],
  9: [t09TriangleArea, t09QuadArea, t09Length],
  10: [t10Spokes, t10Fence, t10Tiles, t10Slide],
  11: [t11Ball, t11OpenCube, t11Cone],
  12: [t12RhombusBisector, t12RhombusPerimeter, t12ParallelogramPerp, t12RectangleSide,
    t12RectangleArea, t12RhombusSmallDiag, t12RightTriangleExt, t12TrapezoidLateral, t12TrapezoidFormula],
  13: [t13BoxSurface, t13SphereRatio, t13PrismVolume, t13HexPyramidLateral, t13RectPyramidHeight, t13TriPyramidVolume],
  14: [t14FracChain, t14DivBracket, t14MixDecFrac, t14Decimals],
  15: [t15Discount, t15PercentChange, t15PercentOfWhole, t15Tax, t15Interest, t15Markup, t15MaxCount],
  16: [t16PowerQuotient, t16PowerNested, t16RootProduct, t16RootQuotient, t16Conjugate,
    t16StandardForm, t16PlaceValue, t16LogDiff, t16TrigProduct, t16TrigReduction, t16TrigPythag,
    t16LogSum, t16CoefRootProduct, t16PowerTermsSum, t16LogInExp, t16ConjugateCoef,
    t16RootOfPowerProduct, t16DistributeRoot, t16SquareCoefRoot, t16NestedLog, t16LogBaseSqrt, t16TrigValue,
    t16PowerExpr, t16ConjugateGen, t16RootQuotientGen, t16RootProductDec, t16PowerOverRoot,
    t16LogPowerRatio, t16PowLogMinus, t16TrigSqrtCoef, t16LogBaseSqrtN, t16NegPowerSum, t16TrigPythagTg],
  17: [t17Linear, t17Quadratic, t17Exponential, t17Logarithm, t17SquareRoot],
  18: [t18Matching],
  19: [t19Divisible, t19RangeDigitSum],
  20: [t20MixSolutions, t20AddWater, t20WorkTogether, t20AvgThirds, t20AvgThereBack, t20Meeting],
  21: [t21Snail, t21Well, t21AvgFifth],
}

export const GEN_META_EGE_BASE = {
  1: [["Округление вверх (сколько нужно)", [
    ["transport", "Перевозка автобусами", t01Transport],
    ["tents", "Палатки", t01Tents],
    ["tea-packs", "Пачки чая", t01TeaPacks],
    ["paint", "Банки краски", t01Paint],
    ["paper", "Пачки бумаги", t01Paper],
  ]],
    ["Округление вниз (сколько можно)", [
      ["printer", "Страницы на принтере", t01Printer],
      ["bouquet", "Букет (нечётное число)", t01Bouquet],
    ]],
    ["Сравнение и перевод", [
      ["pass-savings", "Экономия на проездном", t01PassSavings],
      ["avg-speed", "Средняя скорость (км/ч)", t01AvgSpeedKmh],
      ["feet", "Футы → метры", t01Feet],
    ]]],
  4: [["Физические формулы", [
    ["current", "Работа тока A=U²t/R", t04Current],
    ["steps", "Пройденное расстояние s=nl", t04Steps],
    ["fahrenheit", "Цельсий → Фаренгейт", t04Fahrenheit],
    ["centripetal", "Ускорение a=ω²R", t04Centripetal],
  ]],
    ["Геометрические формулы", [
      ["inradius", "Радиус вписанной r=(a+b−c)/2", t04InRadius],
      ["law-sines", "Теорема синусов", t04LawSines],
    ]],
    ["Числовые формулы", [
      ["geo-mean", "Среднее геометрическое", t04GeoMean],
      ["divisors", "Сумма делителей", t04Divisors],
    ]]],
  2: [["Соответствие", [["units", "Величины и значения", t02Units]]]],
  3: [["Чтение графика", [
    ["extreme", "Наибольшее/наименьшее значение", t03Extreme],
    ["value-day", "Значение в заданный день", t03ValueOnDay],
    ["count-above", "Сколько дней выше порога", t03CountAbove],
  ]]],
  5: [["Классическая вероятность", [
    ["tickets", "Выученные билеты", t05Tickets],
    ["defective", "Доля брака", t05Defective],
    ["ratio", "«Больше в k раз»", t05Ratio],
  ]],
    ["События и исходы", [
      ["coin-twice", "Монета дважды", t05CoinTwice],
      ["two-devices", "Два независимых прибора", t05TwoDevices],
    ]]],
  6: [["Оптимальный выбор", [
    ["tariff", "Тарифные планы", t06Tariff],
    ["material", "Закупка материала", t06Material],
  ]]],
  7: [["Анализ графика", [
    ["range", "Разность max − min", t07Range],
    ["fall-days", "Сколько дней понижалось", t07FallDays],
  ]]],
  8: [["Логика утверждений", [["ordering", "Упорядочивание (возраст/рост)", t08Ordering]]]],
  9: [["Квадратная решётка", [
    ["tri-area", "Площадь треугольника", t09TriangleArea],
    ["quad-area", "Площадь четырёхугольника", t09QuadArea],
    ["length", "Длина отрезка", t09Length],
  ]]],
  10: [["Прикладная геометрия", [
    ["spokes", "Спицы колеса (угол)", t10Spokes],
    ["fence", "Забор с трёх сторон", t10Fence],
    ["tiles", "Облицовка плиткой", t10Tiles],
    ["slide", "Столб посередине горки", t10Slide],
  ]]],
  11: [["Прикладная стереометрия", [
    ["ball", "Масса шара (~d³)", t11Ball],
    ["open-cube", "Открытый куб (5a²)", t11OpenCube],
    ["cone", "Конус: доля высоты", t11Cone],
  ]]],
  12: [["Параллелограмм и ромб", [
    ["rhomb-bisector", "Диагонали-биссектрисы → диагональ", t12RhombusBisector],
    ["rhomb-perimeter", "Диагонали-биссектрисы → периметр", t12RhombusPerimeter],
    ["para-perp", "⊥ диагонали, ∠A+∠C=120°", t12ParallelogramPerp],
    ["rhomb-small-diag", "Сумма углов 240° → меньшая диагональ", t12RhombusSmallDiag],
  ]],
    ["Прямоугольник", [
      ["rect-side", "Равные диагонали → сторона", t12RectangleSide],
      ["rect-area", "Равные диагонали → площадь", t12RectangleArea],
    ]],
    ["Треугольник и трапеция", [
      ["right-ext", "Внешний угол 150° → катет", t12RightTriangleExt],
      ["trap-lateral", "Боковая под 150° → площадь", t12TrapezoidLateral],
      ["trap-formula", "Площадь по формуле", t12TrapezoidFormula],
    ]]],
  13: [["Многогранники", [
    ["box-surface", "Поверхность параллелепипеда", t13BoxSurface],
    ["prism-volume", "Объём призмы (прям. треуг.)", t13PrismVolume],
    ["rect-pyr-height", "Высота пирамиды по объёму", t13RectPyramidHeight],
    ["hex-pyr-lateral", "Боковая пов-сть 6-уг. пирамиды", t13HexPyramidLateral],
    ["tri-pyr-volume", "Объём треуг. пирамиды", t13TriPyramidVolume],
  ]],
    ["Тела вращения", [["sphere-ratio", "Отношение площадей шаров", t13SphereRatio]]]],
  14: [["Обыкновенные дроби", [
    ["frac-chain", "Цепочка дробей", t14FracChain],
    ["div-bracket", "Деление на скобку", t14DivBracket],
    ["mix-dec-frac", "Дробь × десятичная", t14MixDecFrac],
  ]],
    ["Десятичные дроби", [["decimals", "Десятичные", t14Decimals]]]],
  15: [["Проценты", [
    ["discount", "Скидка", t15Discount],
    ["percent-change", "На сколько % изменилась цена", t15PercentChange],
    ["percent-whole", "Часть — p% от целого", t15PercentOfWhole],
    ["tax", "Налог 13 %", t15Tax],
    ["interest", "Банковский вклад", t15Interest],
    ["markup", "Наценка", t15Markup],
  ]],
    ["Целочисленные", [["max-count", "Наибольшее число покупок", t15MaxCount]]]],
  16: [["Степени", [
    ["pow-quot", "Частное степеней", t16PowerQuotient],
    ["pow-nested", "Вложенные степени", t16PowerNested],
  ]],
    ["Корни", [
      ["root-prod", "Произведение корней", t16RootProduct],
      ["root-quot", "Частное корней", t16RootQuotient],
      ["conjugate", "Сопряжённые", t16Conjugate],
    ]],
    ["Стандартный вид", [
      ["std-form", "Действия со степенями 10", t16StandardForm],
      ["place-value", "Разложение по разрядам", t16PlaceValue],
    ]],
    ["Корни (продолжение)", [
      ["coef-root-prod", "(p/q)√A·√B", t16CoefRootProduct],
      ["conj-coef", "Сопряжённые с коэффициентами", t16ConjugateCoef],
      ["root-pow-prod", "√ произведения степеней", t16RootOfPowerProduct],
      ["distribute-root", "(√A−√B)·√c", t16DistributeRoot],
      ["sq-coef-root", "((k√a)²)/N", t16SquareCoefRoot],
    ]],
    ["Степени (продолжение)", [
      ["power-terms-sum", "Сумма c·b^m", t16PowerTermsSum],
    ]],
    ["Логарифмы", [
      ["log-diff", "Разность логарифмов", t16LogDiff],
      ["log-sum", "Сумма логарифмов", t16LogSum],
      ["log-in-exp", "Логарифм в показателе", t16LogInExp],
      ["nested-log", "Вложенный логарифм", t16NestedLog],
      ["log-base-sqrt", "Логарифм по основанию √a", t16LogBaseSqrt],
    ]],
    ["Тригонометрия", [
      ["trig-prod", "tg·ctg", t16TrigProduct],
      ["trig-reduction", "Приведение углов (tg 45)", t16TrigReduction],
      ["trig-value", "Приведение со значением", t16TrigValue],
      ["trig-pythag", "sin ↔ cos по четверти", t16TrigPythag],
    ]]],
  17: [["Линейные и квадратные", [
    ["linear", "Линейное со скобкой", t17Linear],
    ["quadratic", "Квадратное (больший/меньший корень)", t17Quadratic],
  ]],
    ["Показательные", [["exponential", "b^(px+q)=value", t17Exponential]]],
    ["Логарифм и корень", [
      ["logarithm", "Логарифмическое", t17Logarithm],
      ["sqrt", "С квадратным корнем", t17SquareRoot],
    ]]],
  18: [["Соответствие", [["matching", "Неравенство ↔ решение", t18Matching]]]],
  19: [["Делимость", [
    ["divisible", "Наиб./наим. кратное", t19Divisible],
    ["range-digitsum", "В интервале, сумма цифр", t19RangeDigitSum],
  ]]],
  20: [["Растворы и сплавы", [
    ["mix", "Смешивание растворов", t20MixSolutions],
    ["add-water", "Добавили воду", t20AddWater],
  ]],
    ["Работа", [["work", "Совместная работа", t20WorkTogether]]],
    ["Движение", [
      ["avg-thirds", "Средняя скорость (трети пути)", t20AvgThirds],
      ["avg-there-back", "Средняя скорость (туда-обратно)", t20AvgThereBack],
      ["meeting", "Встречное движение", t20Meeting],
    ]]],
  21: [["Логика и последовательности", [
    ["snail", "Улитка на дереве", t21Snail],
    ["well", "Колодец (прогрессия)", t21Well],
    ["avg-fifth", "Среднее пятого числа", t21AvgFifth],
  ]]],
}
