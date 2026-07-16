// Генераторы ЕГЭ математика (БАЗОВЫЙ уровень) — предмет «ЕГЭ».
//
// Эталон типажей — открытый банк ФИПИ (fipi_bank_ege_base/tasks.json). Каждый шаблон
// воспроизводит реальный тип задания банка (та же формулировка, свои числа); правильный
// ответ считается кодом, поэтому гарантированно верен и не заимствует чужую разметку.
//
// Этап 1 — только задания БЕЗ чертежей/схем. Формат объекта генератора:
//   { condition_text, answer }  — как у остальных предметов (см. taskGenerators.js).
// Мат-токены дробей ⟦f:n:d⟧, корней ⟦r:x⟧ и индексов ⟦b:x⟧ разворачивает renderTaskMath().

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i);[a[i], a[j]] = [a[j], a[i]] } return a }
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b] } return a || 1 }
const clean = (x) => Math.round(x * 1e9) / 1e9   // гасит float-шум

// Мат-токены condition_text.
const fT = (n, d) => `⟦f:${n}:${d}⟧`
const rT = (x) => `⟦r:${x}⟧`
const sub = (x) => `⟦b:${x}⟧`
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

// =====================================================================================
// №17 — Простейшие уравнения. Экспоненциальные (переменная в показателе) отложены:
// нужен токен надстрочника (renderTaskMath его пока не умеет).
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
// Реестр и мета-темы
// =====================================================================================

export const GENERATORS_EGE_BASE = {
  5: [t05Tickets, t05Defective, t05CoinTwice, t05Ratio, t05TwoDevices],
  14: [t14FracChain, t14DivBracket, t14MixDecFrac, t14Decimals],
  15: [t15Discount, t15PercentChange, t15PercentOfWhole, t15Tax, t15Interest, t15Markup, t15MaxCount],
  16: [t16PowerQuotient, t16PowerNested, t16RootProduct, t16RootQuotient, t16Conjugate,
    t16StandardForm, t16PlaceValue, t16LogDiff, t16TrigProduct, t16TrigReduction, t16TrigPythag],
  17: [t17Linear, t17Quadratic, t17Logarithm, t17SquareRoot],
}

export const GEN_META_EGE_BASE = {
  5: [["Классическая вероятность", [
    ["tickets", "Выученные билеты", t05Tickets],
    ["defective", "Доля брака", t05Defective],
    ["ratio", "«Больше в k раз»", t05Ratio],
  ]],
    ["События и исходы", [
      ["coin-twice", "Монета дважды", t05CoinTwice],
      ["two-devices", "Два независимых прибора", t05TwoDevices],
    ]]],
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
    ["Логарифмы", [
      ["log-diff", "Разность логарифмов", t16LogDiff],
    ]],
    ["Тригонометрия", [
      ["trig-prod", "tg·ctg", t16TrigProduct],
      ["trig-reduction", "Приведение углов", t16TrigReduction],
      ["trig-pythag", "sin ↔ cos по четверти", t16TrigPythag],
    ]]],
  17: [["Линейные и квадратные", [
    ["linear", "Линейное со скобкой", t17Linear],
    ["quadratic", "Квадратное (больший/меньший корень)", t17Quadratic],
  ]],
    ["Логарифм и корень", [
      ["logarithm", "Логарифмическое", t17Logarithm],
      ["sqrt", "С квадратным корнем", t17SquareRoot],
    ]]],
}
