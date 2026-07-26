// Генераторы ЕГЭ математика ПРОФИЛЬ, задание №16 — экономическая задача (часть 2).
//
// Эталон типажей: fipi_bank_ege_prof/typages_task16.md (два docx из ~/Desktop/Реп-во/ЕГЭ/Задачи:
// «Задачи №16.docx» — 7 разделов, 45 задач; «Задачи № 16 (Оптимизация).docx» — 13 задач
// картинками). Открытый банк ФИПИ часть 2 не публикует, машинной сверки coverage.py нет.
//
// ФИЛОСОФИЯ (как в №13): задача строится ОТ ОТВЕТА. Сначала фиксируем ставку/срок/платёж,
// затем подбираем входные данные так, чтобы все промежуточные суммы были целыми рублями,
// а ответ — точным. Ничего не ищем численно.
//
// ДВА НЕЗАВИСИМЫХ ПРЕДСТАВЛЕНИЯ у каждого объекта:
//   • model  — параметры схемы (долг, ставка, платежи период за периодом), ровно те,
//              из которых собран ТЕКСТ условия;
//   • simulate(model) — пошаговая симуляция буквально по тексту условия:
//              начисление процентов на текущий долг → платёж → новый долг.
// Формула, по которой задача строилась, и simulate — РАЗНЫЕ реализации; verify16 требует,
// чтобы они совпали. Ошибка в формуле не пройдёт незамеченной.

// ── базовые утилиты ────────────────────────────────────────────────────────
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) {[a, b] = [b, a % b] } return a || 1 }
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b)
const MINUS = "−"        // U+2212
const NBSP = " "    // неразрывный пробел: разряды денег и пробел перед «%»
const sum = (a) => a.reduce((s, x) => s + x, 0)
// Округление до копейки — используется только для сравнения, не для построения.
const r2 = (x) => Math.round(x * 100) / 100
const isMoney = (x) => Number.isFinite(x) && Math.abs(x * 100 - Math.round(x * 100)) < 1e-6

// ── форматирование ─────────────────────────────────────────────────────────
// Деньги: разряды неразрывными пробелами, десятичная часть — запятой. Разделитель
// ОБЯЗАТЕЛЬНО NBSP: по нему verify16 вычленяет числа из условия (см. NUM_RE).
function money(v) {
  const neg = v < 0
  const a = Math.abs(v)
  const whole = Math.floor(r2(a))
  const cents = Math.round((r2(a) - whole) * 100)
  let s = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  if (cents) s += "," + String(cents).padStart(2, "0")
  return (neg ? MINUS : "") + s
}
// Десятичное число «по-русски»: 12.5 → «12,5»; целое остаётся целым.
function dec(v) {
  const s = String(Math.round(v * 1e6) / 1e6).replace(".", ",")
  return s.replace(/^-/, MINUS)
}
// Процент — «12,5 %» (неразрывный пробел перед знаком).
const pct = (v) => dec(v) + NBSP + "%"
// Склонение: plural(3, "год","года","лет") → «года».
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}
const years = (n) => `${n} ${plural(n, "год", "года", "лет")}`
const rub = (n) => `${money(n)} ${plural(Math.round(n), "рубль", "рубля", "рублей")}`
const payments = (n) => `${n} ${plural(n, "равным платежом", "равными платежами", "равными платежами")}`

const NAMES_M = ["Андрей", "Руслан", "Родион", "Влад", "Клавдий", "Яков", "Герман", "Добрыня",
  "Захар", "Емельян", "Ипполит", "Борис", "Григорий", "Геннадий", "Владимир", "Святослав",
  "Тимофей", "Игнат", "Никита", "Пётр", "Семён", "Фёдор", "Матвей", "Аркадий"]
const NAMES_F = ["Анна", "Мария", "Ольга", "Дарья", "Полина", "Ксения", "Вера", "Алиса"]
const NAME_ALL = [...NAMES_M.map((n) => ({ n, f: false })), ...NAMES_F.map((n) => ({ n, f: true }))]
const took = (p) => (p.f ? "взяла" : "взял")
const paid = (p) => (p.f ? "выплатила" : "выплатил")

// ── симуляция кредита ──────────────────────────────────────────────────────
// БУКВАЛЬНО по тексту условия: в каждом периоде сначала банк начисляет процент на
// текущий долг, затем клиент вносит платёж. Возвращает пошаговый журнал.
// model = { S, ratePct, payments: [...] }  (payments — в порядке периодов)
export function simulateCredit(model) {
  const steps = []
  let debt = model.S
  for (const p of model.payments) {
    const opening = debt
    const interest = opening * model.ratePct / 100
    debt = opening + interest - p
    steps.push({ opening, interest, payment: p, closing: debt })
  }
  return { steps, finalDebt: debt, total: sum(model.payments) }
}

// Симуляция вклада: за каждый год — пополнение В НАЧАЛЕ года (до начисления),
// затем начисление процента, затем пополнение/снятие СРАЗУ ПОСЛЕ начисления.
// model = { S, rates: [...], addBefore: [...], addAfter: [...] }
export function simulateDeposit(model) {
  const steps = []
  let bal = model.S
  for (let i = 0; i < model.rates.length; i++) {
    const before = (model.addBefore || [])[i] || 0
    const after = (model.addAfter || [])[i] || 0
    const opening = bal + before
    const interest = opening * model.rates[i] / 100
    bal = opening + interest + after
    steps.push({ opening, interest, after, closing: bal })
  }
  return { steps, final: bal }
}

// ── сборка объекта задания ─────────────────────────────────────────────────
// mustMention — числа, которые ОБЯЗАНЫ быть напечатаны в условии (их читает simulate);
// extra       — служебные числа условия (год, номер платежа, порог и т.п.);
// вместе они образуют белый список: любое ДРУГОЕ число в тексте — ошибка (лишнее число).
// checks      — задачезависимые проверки (единственность, соседние значения, границы).
function item({ text, answer, answerNum, model, sim, mustMention, extra = [], forbid = [], checks = [] }) {
  return {
    condition_text: text,
    answer,
    model,
    _verify: {
      sim: sim || (() => simulateCredit(model)),
      answerNum,
      mustMention,
      allowed: [...mustMention, ...extra],
      forbid,
      checks,
    },
  }
}

// Числа в условии: разряды разделены ТОЛЬКО неразрывным пробелом, десятичная — запятой.
const NUM_RE = /\d+(?:\u00A0\d{3})*(?:,\d+)?/g
function numbersIn(text) {
  return (text.match(NUM_RE) || []).map((s) => Number(s.replace(/\u00A0/g, "").replace(",", ".")))
}

// ── verify16 ───────────────────────────────────────────────────────────────
// Универсальная проверка. Возвращает { ok } либо { ok:false, err }.
export function verify16(it) {
  if (!it || !it._verify) return { ok: false, err: "нет объекта/_verify" }
  const v = it._verify
  const m = it.model

  // 1) числа условия: все объявленные присутствуют, лишних нет, ответ не выдан
  const inText = numbersIn(it.condition_text)
  const near = (a, b) => Math.abs(a - b) < 1e-9
  for (const need of v.mustMention) {
    if (!inText.some((x) => near(x, need))) return { ok: false, err: `параметр ${need} не упомянут в условии` }
  }
  for (const got of inText) {
    if (!v.allowed.some((x) => near(x, got))) return { ok: false, err: `лишнее число в условии: ${got}` }
  }
  for (const bad of v.forbid) {
    if (inText.some((x) => near(x, bad))) return { ok: false, err: `ответ ${bad} раскрыт в условии` }
  }

  // 2) симуляция «период за периодом» и её согласие с ответом
  let s
  try { s = v.sim() } catch (e) { return { ok: false, err: "simulate упал: " + e.message } }

  if (m && m.type === "credit") {
    const rem = m.remainder || 0
    if (Math.abs(s.finalDebt - rem) > 0.005) {
      return { ok: false, err: `долг в конце срока ${s.finalDebt}, ожидался ${rem}` }
    }
    let prev = Infinity
    for (const st of s.steps) {
      for (const [k, x] of Object.entries(st)) {
        if (!Number.isFinite(x)) return { ok: false, err: `${k} = ${x}` }
        if (!isMoney(x)) return { ok: false, err: `${k} = ${x} — не целые рубли и не копейки` }
      }
      if (st.opening < -1e-9 || st.closing < -1e-9) return { ok: false, err: "отрицательный долг" }
      if (st.interest < -1e-9) return { ok: false, err: "отрицательные проценты" }
      if (st.payment <= 0) return { ok: false, err: "неположительный платёж" }
      if (st.payment > m.S + 1e-9) return { ok: false, err: "платёж больше всего долга" }
      if (st.closing > st.opening + 1e-9) return { ok: false, err: "долг не убывает" }
      if (st.closing > prev + 1e-9) return { ok: false, err: "долг не монотонен" }
      prev = st.closing
    }
    // реалистичность
    if (!(m.ratePct >= 1 && m.ratePct <= 30)) return { ok: false, err: `нереальная ставка ${m.ratePct}` }
    const n = m.payments.length
    const limit = m.periodUnit === "month" ? 360 : 30
    if (!(n >= 1 && n <= limit)) return { ok: false, err: `нереальный срок ${n}` }
  }

  if (m && m.type === "deposit") {
    for (const st of s.steps) {
      for (const [k, x] of Object.entries(st)) {
        if (!Number.isFinite(x)) return { ok: false, err: `вклад: ${k} = ${x}` }
      }
      if (st.opening < -1e-9 || st.closing < -1e-9) return { ok: false, err: "отрицательный баланс вклада" }
    }
    for (const rr of m.rates) if (!(rr >= 1 && rr <= 60)) return { ok: false, err: `нереальная ставка вклада ${rr}` }
  }

  // 3) ответ: конечен, не «хвостатый», совпадает с числом в тексте ответа
  const A = v.answerNum
  if (!Number.isFinite(A)) return { ok: false, err: `ответ = ${A}` }
  if (Math.abs(A * 1000 - Math.round(A * 1000)) > 1e-6) return { ok: false, err: `ответ ${A} с длинным хвостом` }
  if (!/\d/.test(it.answer)) return { ok: false, err: "в ответе нет числа" }

  // 4) задачезависимые проверки (единственность, соседние целые, границы округления)
  for (const c of v.checks) {
    const e = c()
    if (e) return { ok: false, err: e }
  }
  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
//  РАЗДЕЛЫ 1–2. РАВНЫЕ (АННУИТЕТНЫЕ) ПЛАТЕЖИ
// ═══════════════════════════════════════════════════════════════════════════
//
// Схема: 31 декабря банк увеличивает долг на r%, затем клиент вносит X.
//   D_k = D_{k−1}·q − X,   q = 1 + r/100,   D_n = 0.
// Построение от ответа. Пусть q = m/b (несократимая), a = m − b. Тогда
//   c = (mⁿ − bⁿ)/a  — ЦЕЛОЕ (m ≡ b mod a), и при
//   S = t·b·c   получаем   X = t·mⁿ,
// причём КАЖДЫЙ промежуточный долг D_k = t·b·m^k·(m^{n−k} − b^{n−k})/a тоже целый.
// Проверка: 13,5 % (q=227/200), n=2 → c=427, S=10·200·427=854 000, X=10·227²=515 290
// — ровно задача №2 из раздела «Равные выплаты» эталона.

const RATES = [
  { pct: 5, b: 20, m: 21 }, { pct: 8, b: 25, m: 27 }, { pct: 10, b: 10, m: 11 },
  { pct: 11, b: 100, m: 111 }, { pct: 12, b: 25, m: 28 }, { pct: 12.5, b: 8, m: 9 },
  { pct: 13.5, b: 200, m: 227 }, { pct: 15, b: 20, m: 23 }, { pct: 20, b: 5, m: 6 },
  { pct: 25, b: 4, m: 5 }, { pct: 30, b: 10, m: 13 },
]

// Параметры аннуитета для ставки rate и срока n: S = t·base, X = t·mn.
function annuity(rate, n) {
  const { b, m } = rate
  const a = m - b
  const mn = Math.pow(m, n), bn = Math.pow(b, n)
  const c = Math.round((mn - bn) / a)
  return { b, m, a, n, mn, bn, c, base: b * c, ratePct: rate.pct }
}

// Подбор «человеческой» комбинации: S кратно 1000 и лежит в 100 тыс…10 млн,
// платёж не мельче 1000 рублей. Перебор, а не численный поиск.
function pickAnnuity(nMin, nMax, opts = {}) {
  const cand = []
  for (const rate of RATES) {
    for (let n = nMin; n <= nMax; n++) {
      const A = annuity(rate, n)
      if (!Number.isSafeInteger(A.mn) || A.base > 4_000_000) continue
      for (let t = 1; t <= 400; t++) {
        const S = t * A.base, X = t * A.mn
        if (S < 100_000 || S > 10_000_000) continue
        if (S % 1000 !== 0 || X < 1000) continue
        if (opts.filter && !opts.filter({ A, t, S, X })) continue
        // приоритет: платёж тоже «круглый»
        cand.push({ A, t, S, X, score: X % 100 === 0 ? 2 : X % 10 === 0 ? 1 : 0 })
      }
    }
  }
  if (!cand.length) return null
  const best = Math.max(...cand.map((c) => c.score))
  const top = cand.filter((c) => c.score >= Math.min(best, 1))
  return pick(top)
}

// Текст-преамбула схемы «равные платежи» (формулировка эталона, раздел 1 №2).
function annPreamble(p, year, S, ratePct, verb = "переводит в банк") {
  return `31 декабря ${year} года ${p.n} ${took(p)} в кредит ${rub(S)} под ${pct(ratePct)} годовых. ` +
    `Схема выплаты кредита следующая: 31 декабря каждого следующего года банк начисляет проценты ` +
    `на оставшуюся сумму долга (то есть увеличивает долг на ${pct(ratePct)}), затем ${p.n} ${verb}`
}

// ── 1. Найти размер равного платежа (эталон 1.2, 2.1) ──────────────────────
export function t16AnnPayment() {
  const c = pickAnnuity(2, 5)
  if (!c) return null
  const p = pick(NAME_ALL), year = randInt(2015, 2024)
  const pays = Array.from({ length: c.A.n }, () => c.X)
  const model = { type: "credit", S: c.S, ratePct: c.A.ratePct, payments: pays, periodUnit: "year" }
  return item({
    text: `${annPreamble(p, year, c.S, c.A.ratePct)} X рублей. ` +
      `Какой должна быть сумма X, чтобы ${p.n} ${paid(p)} долг ${payments(c.A.n)} ` +
      `(то есть за ${years(c.A.n)})?`,
    answer: `${money(c.X)} рублей`,
    answerNum: c.X,
    model,
    mustMention: [c.S, c.A.ratePct],
    extra: [31, year, c.A.n],
    forbid: [c.X],
    checks: [
      // платёж на рубль меньше/больше не гасит долг ровно в ноль
      () => {
        for (const d of [-1, 1]) {
          const alt = simulateCredit({ ...model, payments: pays.map((x) => x + d) })
          if (Math.abs(alt.finalDebt) < 0.005) return `платёж ${c.X + d} тоже гасит долг`
        }
        return null
      },
    ],
  })
}

// ── 2. Найти сумму кредита по платежу (эталон 1.3, 2.2) ────────────────────
export function t16AnnPrincipal() {
  const c = pickAnnuity(2, 5)
  if (!c) return null
  const p = pick(NAME_ALL), year = randInt(2015, 2024)
  const pays = Array.from({ length: c.A.n }, () => c.X)
  const model = { type: "credit", S: c.S, ratePct: c.A.ratePct, payments: pays, periodUnit: "year" }
  return item({
    text: `31 декабря ${year} года ${p.n} ${took(p)} в кредит некоторую сумму под ${pct(c.A.ratePct)} годовых. ` +
      `Схема выплаты кредита следующая: 31 декабря каждого следующего года банк начисляет проценты ` +
      `на оставшуюся сумму долга (то есть увеличивает долг на ${pct(c.A.ratePct)}), затем ${p.n} ` +
      `переводит в банк ${rub(c.X)}. Какую сумму ${took(p)} ${p.n} в кредит, если ${paid(p)} долг ` +
      `${payments(c.A.n)} (то есть за ${years(c.A.n)})?`,
    answer: `${money(c.S)} рублей`,
    answerNum: c.S,
    model,
    mustMention: [c.X, c.A.ratePct],
    extra: [31, year, c.A.n],
    forbid: [c.S],
    checks: [
      () => {
        for (const d of [-1000, 1000]) {
          const alt = simulateCredit({ ...model, S: c.S + d })
          if (Math.abs(alt.finalDebt) < 0.005) return `сумма ${c.S + d} тоже подходит`
        }
        return null
      },
    ],
  })
}

// ── 3. Найти общую сумму выплат (требование задания сверх эталона) ─────────
export function t16AnnTotal() {
  const c = pickAnnuity(2, 5)
  if (!c) return null
  const p = pick(NAME_ALL), year = randInt(2015, 2024)
  const pays = Array.from({ length: c.A.n }, () => c.X)
  const total = c.X * c.A.n
  const model = { type: "credit", S: c.S, ratePct: c.A.ratePct, payments: pays, periodUnit: "year" }
  return item({
    text: `${annPreamble(p, year, c.S, c.A.ratePct)} одну и ту же сумму. ` +
      `Известно, что весь долг ${p.n} ${paid(p)} за ${years(c.A.n)}. ` +
      `Какую сумму ${p.n} вернёт банку за весь срок кредитования?`,
    answer: `${money(total)} рублей`,
    answerNum: total,
    model,
    mustMention: [c.S, c.A.ratePct],
    extra: [31, year, c.A.n],
    forbid: [total],
    checks: [() => (Math.abs(simulateCredit(model).total - total) > 0.005 ? "сумма платежей ≠ ответу" : null)],
  })
}

// ── 4. Наименьший срок при ограничении на платёж (эталон 1.1) ──────────────
// Ответ n: платёж за n лет ≤ лимита, а за (n−1) — уже больше. Лимит выбираем
// СТРОГО внутри промежутка (не на границе), поэтому ответ однозначен.
// Схема буквально по эталону: каждый год вносится ровно L (лимит), последний платёж
// гасит остаток. Тогда минимальный срок n = число платежей, и одновременно
// A(n) ≤ L < A(n−1), где A(k) — аннуитетный платёж за k лет. Перебираем (ставка, S, L)
// и оставляем только те, где ВЕСЬ график остаётся в целых рублях/копейках.
export function t16AnnMinYears() {
  const cand = []
  for (const rate of RATES.filter((r) => [4, 5, 10, 20].includes(r.b))) {
    const q = rate.m / rate.b
    const payFor = (S, n) => S * Math.pow(q, n) * (q - 1) / (Math.pow(q, n) - 1)
    for (let sk = 5; sk <= 50; sk++) {
      const S = sk * 100_000
      for (let lk = 1; lk <= 60; lk++) {
        const L = lk * 10_000
        if (L <= S * (q - 1)) continue                      // долг не убывает вовсе
        // фактический график: по L в год, последний платёж — остаток
        const pays = []
        let debt = S, okMoney = true
        while (debt > 0 && pays.length <= 30) {
          const inter = debt * rate.pct / 100
          const grown = debt + inter
          if (!isMoney(inter) || !isMoney(grown)) { okMoney = false; break }
          const pay = grown > L ? L : grown
          pays.push(pay)
          debt = grown - pay
        }
        if (!okMoney || debt > 1e-9 || pays.length < 4 || pays.length > 9) continue
        const n = pays.length
        // ответ обязан быть строго внутри: A(n) ≤ L < A(n−1), не на границе
        const lo = payFor(S, n), hi = payFor(S, n - 1)
        if (!(L >= lo && L < hi)) continue
        if (Math.min(Math.abs(L - lo), Math.abs(L - hi)) < 100) continue
        cand.push({ rate, S, L, n, pays, lo, hi })
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const q = c.rate.m / c.rate.b
  const payFor = (n) => c.S * Math.pow(q, n) * (q - 1) / (Math.pow(q, n) - 1)
  const model = { type: "credit", S: c.S, ratePct: c.rate.pct, payments: c.pays, periodUnit: "year" }
  const p = pick(NAME_ALL)
  return item({
    text: `${p.n} хочет взять в кредит ${rub(c.S)} под ${pct(c.rate.pct)} годовых. Выплаты по кредиту нужно ` +
      `проводить раз в год равными суммами (кроме, может быть, последней) после начисления процентов. ` +
      `На какое минимальное количество лет ${p.n} может взять кредит, чтобы ежегодные ` +
      `выплаты не превышали ${rub(c.L)}?`,
    answer: `${years(c.n)}`,
    answerNum: c.n,
    model,
    mustMention: [c.S, c.rate.pct, c.L],
    extra: [],
    forbid: [],
    checks: [
      () => (payFor(c.n) <= c.L ? null : `за ${c.n} лет платёж ${payFor(c.n)} > лимита ${c.L}`),
      () => (payFor(c.n - 1) > c.L ? null : `срок ${c.n - 1} тоже подходит`),
      () => (payFor(c.n + 1) <= c.L ? null : `срок ${c.n + 1} должен подходить (монотонность нарушена)`),
      // лимит не лежит на границе — ответ однозначен
      () => (Math.min(Math.abs(c.L - c.lo), Math.abs(c.L - c.hi)) >= 100 ? null : "лимит на границе"),
    ],
  })
}

// ── 5. На сколько меньше отдал бы за n₂ платежей (эталон 1.4) ──────────────
// Нужны ЦЕЛЫЕ платежи при обоих сроках: S кратно НОК(base(n₁), base(n₂)).
export function t16AnnDiffTotal() {
  const cand = []
  for (const rate of RATES) {
    for (let n1 = 3; n1 <= 4; n1++) {
      for (let n2 = 2; n2 < n1; n2++) {
        const A1 = annuity(rate, n1), A2 = annuity(rate, n2)
        if (!Number.isSafeInteger(A1.mn)) continue
        const L = lcm(A1.base, A2.base)
        if (!Number.isSafeInteger(L) || L > 6_000_000) continue
        for (let t = 1; t <= 3000; t++) {
          const S = t * L
          if (S > 10_000_000) break
          if (S < 300_000 || S % 1000 !== 0) continue
          const X1 = S * A1.mn / A1.base, X2 = S * A2.mn / A2.base
          if (!Number.isInteger(X1) || !Number.isInteger(X2)) continue
          // за меньший срок общая переплата МЕНЬШЕ: diff = total(n₁) − total(n₂) > 0
          const diff = X1 * n1 - X2 * n2
          if (diff <= 0 || diff % 10 !== 0) continue
          cand.push({ rate, n1, n2, S, X1, X2, diff })
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const p = pick(NAME_ALL), year = randInt(2015, 2024)
  const model = {
    type: "credit", S: c.S, ratePct: c.rate.pct,
    payments: Array.from({ length: c.n1 }, () => c.X1), periodUnit: "year",
  }
  const alt = { ...model, payments: Array.from({ length: c.n2 }, () => c.X2) }
  return item({
    text: `31 декабря ${year} года ${p.n} ${took(p)} в банке ${rub(c.S)} в кредит под ${pct(c.rate.pct)} годовых. ` +
      `Схема выплаты кредита следующая: 31 декабря каждого следующего года банк начисляет проценты ` +
      `на оставшуюся сумму долга (то есть увеличивает долг на ${pct(c.rate.pct)}), затем ${p.n} ` +
      `переводит в банк платёж. Весь долг ${p.n} ${paid(p)} за ${c.n1} ${plural(c.n1, "равный платёж", "равных платежа", "равных платежей")}. ` +
      `На сколько рублей меньше ${p.n} ${p.f ? "отдала" : "отдал"} бы банку, если бы ${p.f ? "смогла" : "смог"} ` +
      `выплатить долг за ${c.n2} ${plural(c.n2, "равный платёж", "равных платежа", "равных платежей")}?`,
    answer: `${money(c.diff)} рублей`,
    answerNum: c.diff,
    model,
    mustMention: [c.S, c.rate.pct],
    extra: [31, year, c.n1, c.n2],
    forbid: [c.diff],
    checks: [
      () => (Math.abs(simulateCredit(alt).finalDebt) < 0.005 ? null : "короткий график не гасит долг"),
      () => (Math.abs((simulateCredit(alt).total - simulateCredit(model).total) + c.diff) < 0.005
        ? null : "разница общих сумм ≠ ответу"),
    ],
  })
}

// ── 6. Найти ставку при n равных платежах (сверх эталона) ──────────────────
// X(r) строго возрастает по r ⇒ корень единственный; проверяем сканированием сетки.
export function t16AnnRate() {
  const c = pickAnnuity(2, 4)
  if (!c) return null
  const p = pick(NAME_ALL), year = randInt(2015, 2024)
  const n = c.A.n, S = c.S, X = c.X, R = c.A.ratePct
  const pays = Array.from({ length: n }, () => X)
  const model = { type: "credit", S, ratePct: R, payments: pays, periodUnit: "year" }
  const payFor = (r) => { const q = 1 + r / 100; return S * Math.pow(q, n) * (q - 1) / (Math.pow(q, n) - 1) }
  return item({
    text: `31 декабря ${year} года ${p.n} ${took(p)} в банке ${rub(S)} в кредит под r % годовых. ` +
      `Схема выплаты кредита следующая: 31 декабря каждого следующего года банк начисляет проценты ` +
      `на оставшуюся сумму долга (то есть увеличивает долг на r %), затем ${p.n} переводит в банк ` +
      `очередной платёж. Весь долг ${p.n} ${paid(p)} ${payments(n)} по ${rub(X)}. Найдите r.`,
    answer: `${pct(R)}`,
    answerNum: R,
    model,
    mustMention: [S, X],
    extra: [31, year, n],
    forbid: [R],
    checks: [
      // единственность: на всей допустимой сетке ставок платёж равен X только при r = R
      () => {
        for (let r = 0.5; r <= 40.0001; r += 0.5) {
          if (Math.abs(r - R) < 1e-9) continue
          if (Math.abs(payFor(r) - X) < 0.5) return `ставка ${r} тоже даёт платёж ${X}`
        }
        return Math.abs(payFor(R) - X) < 0.005 ? null : "формула платежа не сходится с X"
      },
    ],
  })
}

// ── 7. Ставка по двум НЕравным платежам за два года (эталон 1.5) ───────────
// S·q² − P₁·q − P₂ = 0. Произведение корней = −P₂/S < 0 ⇒ положительный корень один.
export function t16RateTwoUnequal() {
  const cand = []
  for (const rate of RATES) {
    const q = rate.m / rate.b
    for (const Sk of [1, 1.5, 2, 2.5, 3, 4, 5]) {
      const S = Sk * 1_000_000
      for (let p1 = 100; p1 <= 4000; p1 += 10) {
        const P1 = p1 * 1000
        const P2 = S * q * q - P1 * q
        if (!Number.isInteger(P2) || P2 % 1000 !== 0) continue
        if (P2 <= 0 || P1 <= 0 || Math.abs(P1 - P2) < 1000) continue
        if (S * q - P1 <= 0) continue                       // долг после 1-го года положителен
        if (P1 > S || P2 > S) continue
        cand.push({ rate, S, P1, P2 })
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const p = pick(NAME_ALL), year = randInt(2015, 2024)
  const model = { type: "credit", S: c.S, ratePct: c.rate.pct, payments: [c.P1, c.P2], periodUnit: "year" }
  const rootFor = (r) => { const q = 1 + r / 100; return c.S * q * q - c.P1 * q - c.P2 }
  return item({
    text: `31 декабря ${year} года ${p.n} ${took(p)} в банке ${rub(c.S)} в кредит под r % годовых. ` +
      `Схема выплаты кредита следующая: 31 декабря каждого следующего года банк начисляет проценты ` +
      `на оставшуюся сумму долга (то есть увеличивает долг на r %), затем ${p.n} переводит в банк ` +
      `очередной платёж. ${p.n} ${paid(p)} кредит за два платежа, переведя ` +
      `в первый раз ${rub(c.P1)}, а во второй — ${rub(c.P2)}. Найдите r.`,
    answer: `${pct(c.rate.pct)}`,
    answerNum: c.rate.pct,
    model,
    mustMention: [c.S, c.P1, c.P2],
    extra: [31, year],
    forbid: [c.rate.pct],
    checks: [
      () => {
        for (let r = 0.5; r <= 40.0001; r += 0.5) {
          if (Math.abs(r - c.rate.pct) < 1e-9) continue
          if (Math.abs(rootFor(r)) < 1) return `ставка ${r} тоже подходит`
        }
        return Math.abs(rootFor(c.rate.pct)) < 0.005 ? null : "квадратное уравнение не выполняется"
      },
    ],
  })
}

// ── 8. Ставка по двум сценариям «платёж → срок» (эталон 2.3) ───────────────
// «по A рублей → n₁ лет, по B рублей → n₂ лет». Одна и та же сумма кредита.
export function t16RateTwoScenarios() {
  const cand = []
  for (const rate of RATES) {
    for (let n1 = 3; n1 <= 5; n1++) {
      for (let n2 = 2; n2 < n1; n2++) {
        const A1 = annuity(rate, n1), A2 = annuity(rate, n2)
        if (!Number.isSafeInteger(A1.mn)) continue
        const L = lcm(A1.base, A2.base)
        if (!Number.isSafeInteger(L) || L > 6_000_000) continue
        for (let t = 1; t <= 300; t++) {
          const S = t * L
          if (S < 200_000 || S > 10_000_000) continue
          const X1 = S * A1.mn / A1.base, X2 = S * A2.mn / A2.base
          if (!Number.isInteger(X1) || !Number.isInteger(X2)) continue
          if (X1 < 1000 || X2 < 1000) continue
          cand.push({ rate, n1, n2, S, X1, X2 })
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const p = pick(NAME_ALL), year = randInt(2015, 2024)
  const model = {
    type: "credit", S: c.S, ratePct: c.rate.pct,
    payments: Array.from({ length: c.n1 }, () => c.X1), periodUnit: "year",
  }
  const alt = { ...model, payments: Array.from({ length: c.n2 }, () => c.X2) }
  // S(r, n) — сумма кредита, гасимая n платежами по X при ставке r
  const princ = (r, n, X) => { const q = 1 + r / 100; return X * (Math.pow(q, n) - 1) / (Math.pow(q, n) * (q - 1)) }
  return item({
    text: `31 декабря ${year} года ${p.n} ${took(p)} в банке некоторую сумму в кредит под r % годовых. ` +
      `Схема выплаты кредита следующая: 31 декабря каждого следующего года банк начисляет проценты ` +
      `на оставшуюся сумму долга (то есть увеличивает долг на r %), затем ${p.n} переводит очередной ` +
      `платёж. Если ${p.n} будет платить каждый год по ${rub(c.X1)}, то ` +
      `долг за ${years(c.n1)}. Если по ${rub(c.X2)}, то за ${years(c.n2)}. Найдите r.`,
    answer: `${pct(c.rate.pct)}`,
    answerNum: c.rate.pct,
    model,
    mustMention: [c.X1, c.X2, c.n1, c.n2],
    extra: [31, year],
    forbid: [c.rate.pct],
    checks: [
      () => (Math.abs(simulateCredit(alt).finalDebt) < 0.005 ? null : "второй сценарий не гасит долг"),
      () => {
        for (let r = 0.5; r <= 40.0001; r += 0.5) {
          if (Math.abs(r - c.rate.pct) < 1e-9) continue
          if (Math.abs(princ(r, c.n1, c.X1) - princ(r, c.n2, c.X2)) < 1) return `ставка ${r} тоже подходит`
        }
        return Math.abs(princ(c.rate.pct, c.n1, c.X1) - princ(c.rate.pct, c.n2, c.X2)) < 0.01
          ? null : "сценарии не сходятся"
      },
    ],
  })
}

// ═══════════════════════════════════════════════════════════════════════════
//  РЕЕСТР
// ═══════════════════════════════════════════════════════════════════════════
export const GEN16 = [
  t16AnnPayment, t16AnnPrincipal, t16AnnTotal, t16AnnMinYears,
  t16AnnDiffTotal, t16AnnRate, t16RateTwoUnequal, t16RateTwoScenarios,
]

export const META16 = [
  ["Кредит равными (аннуитетными) платежами", [
    ["ann-payment", "Найти размер равного платежа", t16AnnPayment],
    ["ann-principal", "Найти сумму кредита по платежу", t16AnnPrincipal],
    ["ann-total", "Найти общую сумму выплат", t16AnnTotal],
    ["ann-min-years", "Наименьший срок при лимите платежа", t16AnnMinYears],
    ["ann-diff-total", "На сколько меньше отдал бы за меньший срок", t16AnnDiffTotal],
    ["ann-rate", "Найти ставку при n равных платежах", t16AnnRate],
    ["ann-rate-2pay", "Ставка по двум неравным платежам", t16RateTwoUnequal],
    ["ann-rate-2scen", "Ставка по двум сценариям «платёж → срок»", t16RateTwoScenarios],
  ]],
]
