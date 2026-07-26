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

import { tableBlock } from "../utils.js"

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
// «Ровно рубли или копейки» с поправкой на накопленный шум float: остаток порядка
// 1e−14 от миллионных сумм — это ноль, а не «доля копейки», и наоборот — у больших
// величин допуск в копейках должен расти вместе с ulp.
const isMoney = (x) => {
  if (!Number.isFinite(x)) return false
  if (Math.abs(x) < 1e-4) return true
  const k = x * 100
  return Math.abs(k - Math.round(k)) < Math.max(1e-6, Math.abs(k) * 1e-12)
}
// Суммы модели могут быть выражены в рублях, тысячах или миллионах — множитель
// приводит их к рублям, чтобы «ровно до копейки» проверялось в правильном масштабе.
export const UNIT_MULT = { rub: 1, ths: 1e3, mln: 1e6 }

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
// Перечисление по-русски: [a] → «a», [a,b] → «a и b», [a,b,c] → «a, b и c».
function joinRu(arr) {
  if (arr.length <= 1) return String(arr[0] ?? "")
  return arr.slice(0, -1).join(", ") + " и " + arr[arr.length - 1]
}
const years = (n) => `${n} ${plural(n, "год", "года", "лет")}`
const months = (n) => `${n} ${plural(n, "месяц", "месяца", "месяцев")}`
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
        // model.fractional — схемы, где сам ЭТАЛОН даёт непредставимый в копейках платёж
        // (напр. «долг гасится двумя равными суммами» при кредите в целых миллионах):
        // платёж задан условием как точное число, а спрашивается другая величина.
        const mult = UNIT_MULT[m.unit || "rub"]
        if (!m.fractional && !isMoney(x * mult)) return { ok: false, err: `${k} = ${x} — не целые рубли и не копейки` }
      }
      if (st.opening < -1e-9 || st.closing < -1e-9) return { ok: false, err: "отрицательный долг" }
      if (st.interest < -1e-9) return { ok: false, err: "отрицательные проценты" }
      if (st.payment <= 0) return { ok: false, err: "неположительный платёж" }
      if (st.payment > st.opening * (1 + m.ratePct / 100) + 1e-6) {
        return { ok: false, err: "платёж больше выросшего долга" }
      }
      // Монотонность долга — норма для аннуитета и дифференцированных платежей, но НЕ
      // для графика «каждый следующий платёж втрое больше предыдущего»: там первый
      // платёж законно меньше начисленных процентов и долг за первый год растёт
      // (так и в эталонной задаче 270 200 руб. под 10 %). Такие модели помечены
      // nonMonotone, но обязаны погасить долг в ноль и не уходить в минус.
      if (!m.nonMonotone) {
        if (st.closing > st.opening + 1e-9) return { ok: false, err: "долг не убывает" }
        if (st.closing > prev + 1e-9) return { ok: false, err: "долг не монотонен" }
      }
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
//  РАЗДЕЛ 3. ВКЛАДЫ
// ═══════════════════════════════════════════════════════════════════════════

// Ставки по вкладу, дающие точные степени: q = 1 + p/100.
const DEP_RATES = [10, 20, 25, 15, 12, 8, 5]

// ── 1. Наибольший целый первоначальный вклад (эталон 3.1) ──────────────────
// Вклад S млн (целое), 4 года по p %; в начале 3-го и 4-го годов пополняют на A млн.
// Итог < M млн. Наибольшее S. Итог = S·q⁴ + A·(q² + q).
export function t16DepMaxInitial() {
  const cand = []
  for (const p of DEP_RATES) {
    const q = 1 + p / 100
    const yrs = 4
    const coefA = q * q + q                     // пополнение в начале 3-го и 4-го годов
    for (const A of [1, 2, 3, 4, 5]) {
      for (let S = 2; S <= 20; S++) {
        const fin = (n) => n * Math.pow(q, yrs) + A * coefA
        const lo = fin(S), hi = fin(S + 1)
        // порог M — ЦЕЛОЕ млн строго внутри (lo; hi], с отступом от границ
        for (let M = Math.ceil(lo); M <= Math.floor(hi); M++) {
          if (M - lo < 0.05 || hi - M < 0.05) continue
          if (M <= S) continue
          cand.push({ p, q, A, S, M })
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = {
    type: "deposit", S: c.S, rates: [c.p, c.p, c.p, c.p],
    addBefore: [0, 0, c.A, c.A],
  }
  const fin = (n) => simulateDeposit({ ...model, S: n }).final
  return item({
    text: `Вклад составляет целое число миллионов рублей и открыт на ${years(4)}. Процентная ставка ` +
      `по вкладу — ${pct(c.p)} годовых, то есть в конце каждого года вклад увеличивается на ${pct(c.p)} ` +
      `по сравнению с его размером в начале этого года. В начале третьего и четвёртого годов вклад ` +
      `пополняли на ${c.A} ${plural(c.A, "миллион", "миллиона", "миллионов")} рублей. Каков мог быть ` +
      `наибольший размер первоначального вклада, если через ${years(4)} сумма на вкладе составила ` +
      `менее ${c.M} ${plural(c.M, "миллиона", "миллионов", "миллионов")} рублей?`,
    answer: `${c.S} млн рублей`,
    answerNum: c.S,
    model,
    sim: () => simulateDeposit(model),
    mustMention: [c.p, c.A, c.M, 4],
    extra: [],
    forbid: [],
    checks: [
      () => (fin(c.S) < c.M ? null : `S = ${c.S} не проходит: итог ${fin(c.S)} ≥ ${c.M}`),
      () => (fin(c.S + 1) >= c.M ? null : `S = ${c.S + 1} тоже проходит`),
      () => (Math.min(c.M - fin(c.S), fin(c.S + 1) - c.M) > 0.04 ? null : "порог на границе"),
    ],
  })
}

// ── 2. Наименьшее целое ежегодное пополнение (эталон 3.3) ──────────────────
export function t16DepMinTopUp() {
  const cand = []
  for (const p of DEP_RATES) {
    const q = 1 + p / 100
    const coefA = q * q + q
    for (const S of [5, 8, 10, 12, 15, 20]) {
      for (let A = 1; A <= 12; A++) {
        const fin = (a) => S * Math.pow(q, 4) + a * coefA
        const lo = fin(A - 1), hi = fin(A)
        for (let M = Math.ceil(lo); M <= Math.floor(hi); M++) {
          if (M - lo < 0.05 || hi - M < 0.05) continue
          if (M <= S) continue
          cand.push({ p, q, S, A, M })
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const p0 = pick(NAME_ALL)
  const model = {
    type: "deposit", S: c.S, rates: [c.p, c.p, c.p, c.p],
    addBefore: [0, 0, c.A, c.A],
  }
  const fin = (a) => simulateDeposit({ ...model, addBefore: [0, 0, a, a] }).final
  return item({
    text: `${p0.n} планирует открыть вклад в размере ${c.S} млн рублей на ${years(4)}. В конце каждого ` +
      `года вклад увеличивается на ${pct(c.p)} по сравнению с его размером в начале года. Кроме этого, ` +
      `в начале третьего и четвёртого годов ${p0.n} собирается ежегодно пополнять вклад на одну и ту же ` +
      `фиксированную сумму, равную целому числу миллионов рублей. Найдите наименьший возможный размер ` +
      `такой суммы, при котором через ${years(4)} вклад станет не меньше ${c.M} млн рублей.`,
    answer: `${c.A} млн рублей`,
    answerNum: c.A,
    model,
    sim: () => simulateDeposit(model),
    mustMention: [c.S, c.p, c.M, 4],
    extra: [],
    forbid: [],
    checks: [
      () => (fin(c.A) >= c.M ? null : `пополнение ${c.A} не даёт ${c.M}`),
      () => (fin(c.A - 1) < c.M ? null : `пополнение ${c.A - 1} тоже подходит`),
      () => (Math.min(fin(c.A) - c.M, c.M - fin(c.A - 1)) > 0.04 ? null : "порог на границе"),
    ],
  })
}

// ── 3. Два параметра пополнения, два ограничения (эталон 3.2) ──────────────
// «по n млн сразу после 1-го и 2-го начисления, по m млн после 3-го и 4-го;
//  за 2 года как минимум удвоить, за 4 — утроить». Ответ — ПАРА чисел (как в эталоне).
export function t16DepTwoParams() {
  const cand = []
  for (const p of DEP_RATES) {
    const q = 1 + p / 100
    for (const S of [5, 10, 12, 15, 20]) {
      for (const [k2, k4] of [[2, 3], [2, 4], [3, 4], [2, 5]]) {
        // за 2 года: S·q² + n·(q + 1) ≥ k2·S
        const need2 = (k2 * S - S * q * q) / (q + 1)
        if (need2 <= 0) continue
        const n = Math.ceil(need2 - 1e-9)
        if (Math.abs(n - need2) < 0.02 || n > 20) continue          // не на границе
        const bal2 = S * q * q + n * (q + 1)
        // за 4 года: bal2·q² + m·(q + 1) ≥ k4·S
        const need4 = (k4 * S - bal2 * q * q) / (q + 1)
        if (need4 <= 0) continue
        const m = Math.ceil(need4 - 1e-9)
        if (Math.abs(m - need4) < 0.02 || m > 20) continue
        cand.push({ p, q, S, k2, k4, n, m })
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = {
    type: "deposit", S: c.S, rates: [c.p, c.p, c.p, c.p],
    addAfter: [c.n, c.n, c.m, c.m],
  }
  const at = (i, nn, mm) => simulateDeposit({ ...model, addAfter: [nn, nn, mm, mm] }).steps[i].closing
  const times = (k) => (k === 2 ? "удвоятся" : k === 3 ? "утроятся" : `увеличатся в ${k} раза`)
  return item({
    text: `${c.S} миллионов рублей планируется вложить в проект с доходностью ${pct(c.p)} годовых. ` +
      `Начисленные проценты остаются вложенными в проект. Кроме того, планируется дополнительно внести ` +
      `по целому числу n миллионов рублей сразу после первого и второго начисления процентов, а также ` +
      `по целому числу m миллионов рублей сразу после третьего и четвёртого начисления процентов. ` +
      `При каких наименьших значениях n и m первоначальные вложения за ${years(2)} как минимум ` +
      `${times(c.k2)}, а за ${years(4)} как минимум ${times(c.k4)}?`,
    answer: `n = ${c.n}, m = ${c.m}`,
    answerNum: c.n,
    model,
    sim: () => simulateDeposit(model),
    mustMention: [c.S, c.p, 2, 4],
    extra: [c.k2, c.k4],
    forbid: [],
    checks: [
      () => (at(1, c.n, c.m) >= c.k2 * c.S - 1e-9 ? null : `n = ${c.n} не даёт ×${c.k2} за 2 года`),
      () => (at(1, c.n - 1, c.m) < c.k2 * c.S - 1e-9 ? null : `n = ${c.n - 1} тоже подходит`),
      () => (at(3, c.n, c.m) >= c.k4 * c.S - 1e-9 ? null : `m = ${c.m} не даёт ×${c.k4} за 4 года`),
      () => (at(3, c.n, c.m - 1) < c.k4 * c.S - 1e-9 ? null : `m = ${c.m - 1} тоже подходит`),
    ],
  })
}

// ── 4. Два накопительных вклада: когда суммы сравняются (эталон 3.4) ───────
// Кладут по C каждый год, банк начисляет p %. Второй вклад открыт на G лет позже
// со взносом C·q и ставкой (q²−1)·100 %. Тогда равенство наступает ровно через G−1 лет.
export function t16DepTwoAccounts() {
  const base = pick([{ p: 10, q: 1.1 }, { p: 20, q: 1.2 }])
  const G = randInt(4, 9)
  const C1 = pick([500, 1000, 1500, 2000, 2500, 5000])
  const C2 = Math.round(C1 * (base.q + 1))
  if (Math.abs(C2 - C1 * (base.q + 1)) > 1e-6) return null
  const p2 = Math.round((base.q * base.q - 1) * 10000) / 100
  const t = G - 1
  // накопление: взнос в начале года, начисление в конце; значение сразу ПОСЛЕ очередного взноса
  const accum = (C, p, k) => simulateDeposit({
    type: "deposit", S: 0, rates: Array(k).fill(p), addBefore: Array(k).fill(C),
  }).final + C
  const model = {
    type: "deposit", S: 0, rates: Array(G + t).fill(base.p), addBefore: Array(G + t).fill(C1),
  }
  const pr = pick(NAME_ALL)
  return item({
    text: `${pr.n} ${pr.f ? "открыла" : "открыл"} в банке вклад, на который ${pr.f ? "она" : "он"} ежегодно ` +
      `кладёт ${rub(C1)}. По условиям вклада банк ежегодно начисляет ${pct(base.p)} на сумму, находящуюся ` +
      `на вкладе. Через ${years(G)} ${pr.n} ${pr.f ? "открыла" : "открыл"} в другом банке вклад, на который ` +
      `ежегодно кладёт по ${rub(C2)}, а банк начисляет ${pct(p2)} в год. Через сколько лет после открытия ` +
      `второго вклада после очередного пополнения суммы вкладов сравняются, если деньги со счетов не снимают?`,
    answer: `${years(t)}`,
    answerNum: t,
    model,
    sim: () => simulateDeposit(model),
    mustMention: [C1, base.p, G, C2, p2],
    extra: [],
    forbid: [],
    checks: [
      () => (Math.abs(accum(C1, base.p, G + t) - accum(C2, p2, t)) < 0.01
        ? null : `через ${t} лет суммы не равны`),
      () => (accum(C1, base.p, G + t - 1) > accum(C2, p2, t - 1) + 0.01
        ? null : `равенство наступает раньше, чем через ${t} лет`),
      () => (accum(C1, base.p, G + t + 1) < accum(C2, p2, t + 1) - 0.01
        ? null : `через ${t + 1} лет первый вклад всё ещё не меньше`),
    ],
  })
}

// ── 5. Наименьший целый процент за ПОСЛЕДНИЙ год вклада «Б» (эталон 3.5) ───
// А: три года по a %. Б: b % первые два года и r % за третий. Нужно (1+b)²(1+r) > (1+a)³.
export function t16DepCompareLastYear() {
  const cand = []
  for (let a = 6; a <= 20; a++) {
    for (let b = 4; b <= 20; b++) {
      if (b === a) continue
      const need = Math.pow(1 + a / 100, 3) / Math.pow(1 + b / 100, 2) - 1
      const r = Math.floor(need * 100) + 1
      if (r < 1 || r > 30) continue
      if (Math.abs(need * 100 - Math.round(need * 100)) < 0.02) continue   // не на границе
      if (r === a || r === b) continue          // иначе ответ буквально стоит в условии
      cand.push({ a, b, r })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = { type: "deposit", S: 100000, rates: [c.b, c.b, c.r] }
  const A = Math.pow(1 + c.a / 100, 3)
  const B = (r) => Math.pow(1 + c.b / 100, 2) * (1 + r / 100)
  return item({
    text: `По вкладу «А» банк в течение трёх лет в конце каждого года увеличивает на ${pct(c.a)} сумму, ` +
      `имеющуюся на вкладе в начале года, а по вкладу «Б» — увеличивает на ${pct(c.b)} в течение каждого ` +
      `из первых двух лет. Найдите наименьшее целое число процентов за третий год по вкладу «Б», при ` +
      `котором за все три года этот вклад всё ещё останется выгоднее вклада «А».`,
    answer: `${pct(c.r)}`,
    answerNum: c.r,
    model,
    sim: () => simulateDeposit(model),
    mustMention: [c.a, c.b],
    extra: [],
    forbid: [c.r],
    checks: [
      () => (B(c.r) > A ? null : `${c.r} % не делает «Б» выгоднее`),
      () => (B(c.r - 1) <= A ? null : `${c.r - 1} % тоже подходит`),
      () => (Math.abs(B(c.r - 1) - A) > 1e-6 && Math.abs(B(c.r) - A) > 1e-6 ? null : "равенство вкладов"),
    ],
  })
}

// ── 6. Наименьшее целое r за ДВА одинаковых года вклада «Б» (эталон 3.6) ───
// А: три года по a %. Б: b % первый год и r % за второй и третий: (1+b)(1+r)² > (1+a)³.
export function t16DepCompareTwoYears() {
  const cand = []
  for (let a = 6; a <= 20; a++) {
    for (let b = 3; b <= 20; b++) {
      if (b === a) continue
      const need = Math.sqrt(Math.pow(1 + a / 100, 3) / (1 + b / 100)) - 1
      const r = Math.floor(need * 100) + 1
      if (r < 1 || r > 30) continue
      if (Math.abs(need * 100 - Math.round(need * 100)) < 0.02) continue
      if (r === a || r === b) continue          // иначе ответ буквально стоит в условии
      cand.push({ a, b, r })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = { type: "deposit", S: 100000, rates: [c.b, c.r, c.r] }
  const A = Math.pow(1 + c.a / 100, 3)
  const B = (r) => (1 + c.b / 100) * Math.pow(1 + r / 100, 2)
  return item({
    text: `По вкладу «А» банк в конце каждого года планирует увеличивать на ${pct(c.a)} сумму, имеющуюся ` +
      `на вкладе в начале года, а по вкладу «Б» — увеличивать эту сумму на ${pct(c.b)} в первый год и на ` +
      `одинаковое целое число r процентов и за второй, и за третий годы. Найдите наименьшее значение r, ` +
      `при котором за три года хранения вклад «Б» окажется выгоднее вклада «А» при одинаковых суммах ` +
      `первоначальных взносов.`,
    answer: `${pct(c.r)}`,
    answerNum: c.r,
    model,
    sim: () => simulateDeposit(model),
    mustMention: [c.a, c.b],
    extra: [],
    forbid: [c.r],
    checks: [
      () => (B(c.r) > A ? null : `${c.r} % не делает «Б» выгоднее`),
      () => (B(c.r - 1) <= A ? null : `${c.r - 1} % тоже подходит`),
      () => (Math.abs(B(c.r - 1) - A) > 1e-6 && Math.abs(B(c.r) - A) > 1e-6 ? null : "равенство вкладов"),
    ],
  })
}

// ── 7–9. Чистый сложный процент: найти сумму / срок / ставку ───────────────
// Требование задания сверх эталона. S·qⁿ обязано быть целым рублём — перебираем.
function compoundCandidates() {
  const out = []
  for (const p of [5, 8, 10, 12, 15, 20, 25]) {
    const q = 1 + p / 100
    for (let n = 2; n <= 6; n++) {
      const f = Math.pow(q, n)
      for (let k = 1; k <= 400; k++) {
        const S = k * 25_000
        if (S < 100_000 || S > 8_000_000) continue
        const M = S * f
        if (Math.abs(M - Math.round(M)) > 1e-6) continue
        if (M > 30_000_000) continue
        out.push({ p, q, n, S, M: Math.round(M) })
      }
    }
  }
  return out
}
export function t16CompoundSum() {
  const c = pick(compoundCandidates())
  const model = { type: "deposit", S: c.S, rates: Array(c.n).fill(c.p) }
  return item({
    text: `Вкладчик положил в банк ${rub(c.S)} под ${pct(c.p)} годовых. Проценты начисляются в конце ` +
      `каждого года на всю сумму, находящуюся на вкладе, и остаются на нём. Какая сумма будет на вкладе ` +
      `через ${years(c.n)}, если вкладчик не снимал и не добавлял денег?`,
    answer: `${money(c.M)} рублей`,
    answerNum: c.M,
    model,
    sim: () => simulateDeposit(model),
    mustMention: [c.S, c.p, c.n],
    extra: [],
    forbid: [c.M],
    checks: [() => (Math.abs(simulateDeposit(model).final - c.M) < 0.005 ? null : "симуляция ≠ ответу")],
  })
}
export function t16CompoundTerm() {
  // срок-ответ не должен совпасть со ставкой, иначе он буквально стоит в условии
  const c = pick(compoundCandidates().filter((x) => x.n >= 3 && x.n !== x.p))
  const model = { type: "deposit", S: c.S, rates: Array(c.n).fill(c.p) }
  const at = (k) => c.S * Math.pow(c.q, k)
  return item({
    text: `Вкладчик положил в банк ${rub(c.S)} под ${pct(c.p)} годовых. Проценты начисляются в конце ` +
      `каждого года на всю сумму, находящуюся на вкладе, и остаются на нём. Через некоторое целое число ` +
      `лет на вкладе оказалось ${rub(c.M)}. Сколько лет пролежал вклад?`,
    answer: `${years(c.n)}`,
    answerNum: c.n,
    model,
    sim: () => simulateDeposit(model),
    mustMention: [c.S, c.p, c.M],
    extra: [],
    forbid: [c.n],
    checks: [
      () => (Math.abs(at(c.n) - c.M) < 0.005 ? null : "через n лет сумма ≠ M"),
      // строгая монотонность ⇒ других целых решений нет; проверяем всю сетку сроков
      () => {
        for (let k = 1; k <= 30; k++) {
          if (k === c.n) continue
          if (Math.abs(at(k) - c.M) < 0.5) return `срок ${k} тоже подходит`
        }
        return null
      },
    ],
  })
}
export function t16CompoundRate() {
  // ставка-ответ не должна совпасть со сроком
  const c = pick(compoundCandidates().filter((x) => x.n <= 4 && x.p !== x.n))
  const model = { type: "deposit", S: c.S, rates: Array(c.n).fill(c.p) }
  const grow = (r) => c.S * Math.pow(1 + r / 100, c.n)
  return item({
    text: `Вкладчик положил в банк ${rub(c.S)} под одинаковый процент годовых. Проценты начисляются ` +
      `в конце каждого года на всю сумму, находящуюся на вкладе, и остаются на нём. Через ${years(c.n)} ` +
      `на вкладе оказалось ${rub(c.M)}. Под какой процент годовых был сделан вклад?`,
    answer: `${pct(c.p)}`,
    answerNum: c.p,
    model,
    sim: () => simulateDeposit(model),
    mustMention: [c.S, c.n, c.M],
    extra: [],
    forbid: [c.p],
    checks: [
      () => {
        for (let r = 0.5; r <= 40.0001; r += 0.5) {
          if (Math.abs(r - c.p) < 1e-9) continue
          if (Math.abs(grow(r) - c.M) < 0.5) return `ставка ${r} тоже подходит`
        }
        return Math.abs(grow(c.p) - c.M) < 0.005 ? null : "рост не сходится с M"
      },
    ],
  })
}

// ── 10. Вклад с ежегодным СНЯТИЕМ фиксированной суммы (сверх эталона) ──────
// Остаток = S·qⁿ − A·(qⁿ−1)/(q−1) ≥ R. Ответ — наибольшее A, кратное 1000.
export function t16DepWithdraw() {
  const cand = []
  for (const p of [5, 8, 10, 12, 15, 20]) {
    const q = 1 + p / 100
    for (let n = 3; n <= 6; n++) {
      const f = Math.pow(q, n), s = (f - 1) / (q - 1)
      for (let sk = 4; sk <= 40; sk++) {
        const S = sk * 250_000
        for (let rk = 1; rk <= 20; rk++) {
          const R = rk * 100_000
          const bound = (S * f - R) / s
          if (!(bound > 20_000)) continue
          const A = Math.floor(bound / 1000) * 1000
          if (A < 20_000 || A >= S) continue
          // порог не на границе округления до тысячи
          if (bound - A < 50 || A + 1000 - bound < 50) continue
          if (A === R || A === S) continue        // иначе ответ буквально стоит в условии
          cand.push({ p, q, n, S, R, A })
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = {
    type: "deposit", S: c.S, rates: Array(c.n).fill(c.p), addAfter: Array(c.n).fill(-c.A),
  }
  const left = (a) => simulateDeposit({ ...model, addAfter: Array(c.n).fill(-a) }).final
  return item({
    text: `Вкладчик положил в банк ${rub(c.S)} под ${pct(c.p)} годовых. В конце каждого года банк ` +
      `начисляет проценты на сумму, находящуюся на вкладе, после чего вкладчик снимает со счёта одну ` +
      `и ту же сумму. Какую наибольшую сумму, кратную ${rub(1000)}, он может снимать ежегодно, чтобы ` +
      `через ${years(c.n)} на вкладе осталось не менее ${rub(c.R)}?`,
    answer: `${money(c.A)} рублей`,
    answerNum: c.A,
    model,
    sim: () => simulateDeposit(model),
    mustMention: [c.S, c.p, c.n, c.R, 1000],
    extra: [],
    forbid: [c.A],
    checks: [
      () => (left(c.A) >= c.R - 1e-6 ? null : `снятие ${c.A} оставляет меньше ${c.R}`),
      () => (left(c.A + 1000) < c.R - 1e-6 ? null : `снятие ${c.A + 1000} тоже подходит`),
      () => (Math.min(left(c.A) - c.R, c.R - left(c.A + 1000)) > 1 ? null : "порог на границе"),
    ],
  })
}

// ═══════════════════════════════════════════════════════════════════════════
//  РАЗДЕЛ 4. ДРУГИЕ СХЕМЫ ВЫПЛАТ
// ═══════════════════════════════════════════════════════════════════════════
//
// Схема «k лет только проценты, затем m равных платежей»: первые k лет долг остаётся
// равным S (платится ровно S·x), затем X = S·qᵐ(q−1)/(qᵐ−1).
// Общая сумма = k·S·x + m·X.

function interestOnlyPlan(S, ratePct, k, m) {
  const q = 1 + ratePct / 100
  const X = S * Math.pow(q, m) * (q - 1) / (Math.pow(q, m) - 1)
  return { X, payments: [...Array(k).fill(S * ratePct / 100), ...Array(m).fill(X)], total: k * S * ratePct / 100 + m * X }
}

// ── 1. Наименьший целый кредит при общей сумме > M (эталон 4.1) ────────────
export function t16IntOnlyMinCredit() {
  const cand = []
  for (const p of [10, 15, 20, 25]) {
    for (const k of [2, 3]) {
      for (const m of [2, 3]) {
        for (let S = 2; S <= 25; S++) {
          const lo = interestOnlyPlan(S - 1, p, k, m).total
          const hi = interestOnlyPlan(S, p, k, m).total
          for (let M = Math.ceil(lo); M <= Math.floor(hi); M++) {
            if (M - lo < 0.05 || hi - M < 0.05 || M <= S) continue
            cand.push({ p, k, m, S, M })
          }
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const plan = interestOnlyPlan(c.S, c.p, c.k, c.m)
  const model = {
    type: "credit", S: c.S, ratePct: c.p, payments: plan.payments,
    periodUnit: "year", unit: "mln", fractional: true,
  }
  const pr = pick(NAME_ALL)
  const ord = ["1-го", "2-го", "3-го", "4-го", "5-го"]
  return item({
    text: `${pr.n} планирует взять кредит на целое число миллионов рублей на ${years(c.k + c.m)}. ` +
      `В середине каждого года действия кредита долг возрастает на ${pct(c.p)} по сравнению с началом года. ` +
      `В конце ${joinRu(ord.slice(0, c.k))} годов ${pr.n} выплачивает только проценты по кредиту, оставляя ` +
      `долг неизменно равным первоначальному. В конце ${joinRu(ord.slice(c.k, c.k + c.m))} годов ${pr.n} ` +
      `выплачивает одинаковые суммы, погашая весь долг полностью. Найдите наименьший размер кредита, ` +
      `при котором общая сумма выплат превысит ${c.M} млн рублей.`,
    answer: `${c.S} млн рублей`,
    answerNum: c.S,
    model,
    sim: () => simulateCredit(model),
    mustMention: [c.p],
    extra: [c.k + c.m, c.M, 1, 2, 3, 4, 5],
    forbid: [],
    checks: [
      () => (interestOnlyPlan(c.S, c.p, c.k, c.m).total > c.M ? null : `S = ${c.S} не превышает ${c.M}`),
      () => (interestOnlyPlan(c.S - 1, c.p, c.k, c.m).total <= c.M ? null : `S = ${c.S - 1} тоже подходит`),
      () => (Math.abs(simulateCredit(model).total - plan.total) < 1e-6 ? null : "сумма платежей ≠ плану"),
    ],
  })
}

// ── 2. Ставка по общей сумме выплат в той же схеме (эталон 4.2) ────────────
export function t16IntOnlyRate() {
  const cand = []
  for (const p of [5, 10, 12, 15, 20, 25]) {
    for (const k of [2, 3]) {
      for (const m of [2, 3]) {
        for (let sk = 10; sk <= 100; sk++) {
          const S = sk / 10                                   // млн, с одним знаком
          const T = interestOnlyPlan(S, p, k, m).total
          if (Math.abs(T * 10 - Math.round(T * 10)) > 1e-9) continue   // общая сумма — «круглая»
          if (T <= S) continue
          cand.push({ p, k, m, S, T: Math.round(T * 10) / 10 })
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const plan = interestOnlyPlan(c.S, c.p, c.k, c.m)
  const model = {
    type: "credit", S: c.S, ratePct: c.p, payments: plan.payments,
    periodUnit: "year", unit: "mln", fractional: true,
  }
  const y0 = randInt(2015, 2022)
  const yrsHold = Array.from({ length: c.k }, (_, i) => y0 + 1 + i)
  const yrsPay = Array.from({ length: c.m }, (_, i) => y0 + 1 + c.k + i)
  const pr = pick(NAME_ALL)
  const totalFor = (r) => interestOnlyPlan(c.S, r, c.k, c.m).total
  return item({
    text: `В июле ${y0} года ${pr.n} планирует взять кредит в размере ${dec(c.S)} млн рублей. ` +
      `Условия возврата таковы:\n` +
      `— каждый январь долг возрастает на r % по сравнению с концом предыдущего года;\n` +
      `— с февраля по июнь необходимо выплатить часть долга;\n` +
      `— в июле ${joinRu(yrsHold)} годов долг остаётся равным ${dec(c.S)} млн рублей;\n` +
      `— суммы выплат ${joinRu(yrsPay)} годов равны.\n` +
      `Найдите r, если общая сумма выплат составит ${dec(c.T)} млн рублей.`,
    answer: `${pct(c.p)}`,
    answerNum: c.p,
    model,
    sim: () => simulateCredit(model),
    mustMention: [c.S, c.T],
    extra: [y0, ...yrsHold, ...yrsPay],
    forbid: [c.p],
    checks: [
      () => {
        for (let r = 0.5; r <= 40.0001; r += 0.5) {
          if (Math.abs(r - c.p) < 1e-9) continue
          if (Math.abs(totalFor(r) - c.T) < 0.005) return `ставка ${r} тоже даёт ${c.T}`
        }
        return Math.abs(totalFor(c.p) - c.T) < 1e-6 ? null : "общая сумма не сходится"
      },
    ],
  })
}

// ── 3. Общая сумма выплат по известному равному платежу (эталон 4.3) ───────
export function t16IntOnlyTotal() {
  const cand = []
  for (const rate of RATES.filter((r) => [4, 5, 8, 10, 20, 25].includes(r.b))) {
    const q = rate.m / rate.b
    for (const k of [2, 3]) {
      for (const m of [2, 3]) {
        // X = S·qᵐ(q−1)/(qᵐ−1) ⇒ S = X·(qᵐ−1)/(qᵐ(q−1)); подбираем X кратным 10 тыс.
        for (let xk = 5; xk <= 200; xk++) {
          const X = xk * 10_000
          const S = X * (Math.pow(q, m) - 1) / (Math.pow(q, m) * (q - 1))
          if (!Number.isInteger(S) || S % 10_000 !== 0) continue
          if (S < 200_000 || S > 8_000_000) continue
          const T = k * S * rate.pct / 100 + m * X
          if (!Number.isInteger(T)) continue
          cand.push({ rate, k, m, S, X, T })
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const plan = interestOnlyPlan(c.S, c.rate.pct, c.k, c.m)
  const model = {
    type: "credit", S: c.S, ratePct: c.rate.pct, payments: plan.payments, periodUnit: "year",
  }
  const y0 = randInt(2015, 2022)
  const yrsHold = Array.from({ length: c.k }, (_, i) => y0 + 1 + i)
  const yrsPay = Array.from({ length: c.m }, (_, i) => y0 + 1 + c.k + i)
  return item({
    text: `В июле ${y0} года планируется взять кредит в банке на ${years(c.k + c.m)} в размере S рублей. ` +
      `Условия его возврата таковы:\n` +
      `— каждый январь долг возрастает на ${pct(c.rate.pct)} по сравнению с концом предыдущего года;\n` +
      `— с февраля по июнь каждого года необходимо выплатить часть долга;\n` +
      `— в июле ${joinRu(yrsHold)} годов долг остаётся равным S рублей;\n` +
      `— выплаты в ${joinRu(yrsPay)} годах равны по ${rub(c.X)};\n` +
      `— к июлю ${yrsPay[yrsPay.length - 1]} года долг будет выплачен полностью.\n` +
      `Найдите общую сумму выплат за весь срок кредитования.`,
    answer: `${money(c.T)} рублей`,
    answerNum: c.T,
    model,
    sim: () => simulateCredit(model),
    mustMention: [c.rate.pct, c.X],
    extra: [y0, ...yrsHold, ...yrsPay, c.k + c.m],
    forbid: [c.T, c.S],
    checks: [
      () => (Math.abs(simulateCredit(model).total - c.T) < 0.005 ? null : "симуляция ≠ ответу"),
      () => (Math.abs(plan.X - c.X) < 0.005 ? null : "равный платёж ≠ заявленному"),
    ],
  })
}

// ── 4. Платежи в геометрической прогрессии (эталон 4.4) ────────────────────
// Каждый следующий платёж в g раз больше предыдущего. S·qⁿ = X(qⁿ⁻¹ + g·qⁿ⁻² + … + gⁿ⁻¹).
// Целочисленное построение: X = t·mⁿ, S = t·b·Σ(mⁿ⁻¹⁻ⁱ·gⁱ·bⁱ).
export function t16GeomPayments() {
  const cand = []
  for (const rate of RATES) {
    const { b, m } = rate
    for (const g of [2, 3]) {
      for (const n of [2, 3]) {
        let D = 0
        for (let i = 0; i < n; i++) D += Math.pow(m, n - 1 - i) * Math.pow(g, i) * Math.pow(b, i)
        const base = b * D                                   // S = t·base, X = t·mⁿ
        const mn = Math.pow(m, n)
        if (!Number.isSafeInteger(base) || base > 2_000_000) continue
        for (let t = 1; t <= 2000; t++) {
          const S = t * base, X = t * mn
          if (S > 10_000_000) break
          if (S < 100_000 || X < 1000) continue
          cand.push({ rate, g, n, S, X, t })
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const pays = Array.from({ length: c.n }, (_, i) => c.X * Math.pow(c.g, i))
  const model = {
    type: "credit", S: c.S, ratePct: c.rate.pct, payments: pays,
    periodUnit: "year", nonMonotone: true,
  }
  const pr = pick(NAME_ALL)
  const word = c.g === 2 ? "вдвое" : "втрое"
  return item({
    text: `${pr.n} ${took(pr)} кредит в банке на сумму ${rub(c.S)}. Схема выплаты кредита такова: ` +
      `в конце каждого года банк увеличивает на ${pct(c.rate.pct)} оставшуюся сумму долга, а затем ` +
      `${pr.n} переводит в банк свой очередной платёж. Известно, что ${pr.n} ${p2paid(pr)} кредит ` +
      `за ${years(c.n)}, причём каждый следующий платёж был ровно ${word} больше предыдущего. ` +
      `Какую сумму ${pr.n} ${pr.f ? "заплатила" : "заплатил"} в первый раз?`,
    answer: `${money(c.X)} рублей`,
    answerNum: c.X,
    model,
    mustMention: [c.S, c.rate.pct, c.n],
    extra: [],
    forbid: [c.X],
    checks: [
      () => (Math.abs(simulateCredit(model).finalDebt) < 0.005 ? null : "кредит не погашен"),
      () => {
        for (const d of [-1, 1]) {
          const alt = simulateCredit({ ...model, payments: pays.map((_, i) => (c.X + d) * Math.pow(c.g, i)) })
          if (Math.abs(alt.finalDebt) < 0.005) return `первый платёж ${c.X + d} тоже гасит долг`
        }
        return null
      },
    ],
  })
}
const p2paid = (p) => (p.f ? "погасила" : "погасил")

// ═══════════════════════════════════════════════════════════════════════════
//  РАЗДЕЛ 5. УМЕНЬШЕНИЕ ДОЛГА ПО ТАБЛИЦЕ
// ═══════════════════════════════════════════════════════════════════════════
//
// Долг на контрольные даты задан ТАБЛИЦЕЙ: D₀ = S, D₁, …, Dₙ = 0. В каждом периоде
// долг растёт на r %, затем вносится платёж pₖ = Dₖ₋₁·(1+x) − Dₖ.
// Отсюда общая сумма выплат = S + x·(D₀ + D₁ + … + Dₙ₋₁) — эту формулу и проверяет
// verify16 против пошаговой симуляции.

// Платежи по табличному графику (fr — доли от S, fr[0] = 1, последняя 0).
function tablePayments(S, ratePct, fr) {
  const q = 1 + ratePct / 100
  const out = []
  for (let k = 1; k < fr.length; k++) out.push(S * (q * fr[k - 1] - fr[k]))
  return out
}
// Коэффициенты платежей при S = 1 (для сравнения «наибольшая/наименьшая выплата»).
const tableCoefs = (ratePct, fr) => tablePayments(1, ratePct, fr)

const MONTH_NAMES = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"]
const MONTH_CAP = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]

// Шапка таблицы для помесячного графика: 15.01, 15.02, …
const monthDates = (startMonth, n) =>
  Array.from({ length: n + 1 }, (_, i) => `15.${String(((startMonth - 1 + i) % 12) + 1).padStart(2, "0")}`)
// Шапка для годового графика: «Июль 2017», «Июль 2018», …
const yearDates = (monthIdx, y0, n) =>
  Array.from({ length: n + 1 }, (_, i) => `${MONTH_CAP[monthIdx]} ${y0 + i}`)

// ── 1. Наибольшее целое r при общей сумме < M (эталон 5.1) ─────────────────
export function t16TblMaxRate() {
  const cand = []
  for (const S of [1, 1.2, 1.5, 2, 2.5, 3]) {
    for (let n = 4; n <= 7; n++) {
      // убывающий график с шагом 0,1 млн, последнее значение — 0
      for (let trial = 0; trial < 60; trial++) {
        const vals = [S]
        let ok = true
        for (let k = 1; k < n; k++) {
          const maxV = Math.round((vals[k - 1] - 0.1) * 10) / 10
          if (maxV < 0.1) { ok = false; break }
          vals.push(Math.round(randInt(1, Math.round(maxV * 10)) ) / 10)
        }
        if (!ok || vals.length !== n) continue
        vals.push(0)
        const sig = sum(vals.slice(0, n))
        for (let r0 = 3; r0 <= 20; r0++) {
          const lo = S + r0 * sig / 100, hi = S + (r0 + 1) * sig / 100
          for (let M = Math.ceil(lo * 20) / 20; M <= hi; M = Math.round((M + 0.05) * 100) / 100) {
            if (M - lo < 0.01 || hi - M < 0.01) continue
            cand.push({ S, n, vals, r0, M: Math.round(M * 100) / 100 })
          }
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const startM = randInt(1, 12)
  const dates = monthDates(startM, c.n)
  const tbl = tableBlock([["Дата", ...dates], ["Долг (в млн руб.)", ...c.vals.map(dec)]])
  const model = {
    type: "credit", S: c.S, ratePct: c.r0,
    payments: c.vals.slice(1).map((v, i) => c.vals[i] * (1 + c.r0 / 100) - v),
    periodUnit: "month", unit: "mln",
  }
  const totalFor = (r) => c.S + r * sum(c.vals.slice(0, c.n)) / 100
  return item({
    text: `15-го ${MONTH_NAMES[startM - 1]} планируется взять кредит в банке на ${months(c.n)} в размере ` +
      `${dec(c.S)} млн рублей. Условия его возврата таковы:\n` +
      `— 1-го числа каждого месяца долг увеличивается на r процентов по сравнению с концом предыдущего ` +
      `месяца, где r — целое число;\n` +
      `— со 2-го по 14-е число каждого месяца необходимо выплатить часть долга;\n` +
      `— 15-го числа каждого месяца долг должен составлять некоторую сумму в соответствии со следующей ` +
      `таблицей:\n${tbl}` +
      `Найдите наибольшее значение r, при котором общая сумма выплат будет меньше ${dec(c.M)} млн рублей.`,
    answer: `${pct(c.r0)}`,
    answerNum: c.r0,
    model,
    mustMention: [c.S, c.M],
    extra: [15, 1, 2, 14, c.n, ...numbersIn(tbl)],
    forbid: [],
    checks: [
      () => (totalFor(c.r0) < c.M ? null : `r = ${c.r0} не проходит`),
      () => (totalFor(c.r0 + 1) >= c.M ? null : `r = ${c.r0 + 1} тоже проходит`),
      () => (Math.min(c.M - totalFor(c.r0), totalFor(c.r0 + 1) - c.M) > 0.009 ? null : "порог на границе"),
      () => (Math.abs(simulateCredit(model).total - totalFor(c.r0)) < 1e-6 ? null : "симуляция ≠ формуле"),
    ],
  })
}

// Общий каркас для «долевых» табличных задач (S — целое число млн/тыс.).
function fracScheduleCandidates(ratePcts, fracSets) {
  const out = []
  for (const p of ratePcts) {
    for (const fr of fracSets) {
      const co = tableCoefs(p, fr)
      if (co.some((x) => x <= 0)) continue                      // все выплаты положительны
      out.push({ p, fr, co, sigma: sum(fr.slice(0, fr.length - 1)) })
    }
  }
  return out
}
const FRAC_SETS = [
  [1, 0.75, 0.5, 0], [1, 0.7, 0.4, 0], [1, 0.8, 0.5, 0], [1, 0.6, 0.3, 0],
  [1, 0.7, 0.4, 0.2, 0], [1, 0.75, 0.5, 0.25, 0], [1, 0.8, 0.6, 0.3, 0],
  [1, 0.9, 0.7, 0.4, 0.2, 0], [1, 0.8, 0.6, 0.4, 0.2, 0],
]
const FRAC_RATES = [10, 15, 20, 25, 30]

// Текст «долевой» табличной задачи (годовой график, как в эталоне 5.2/5.3/5.5/5.6).
function fracTableText({ p, fr, y0, unitWord, unitTable, question }) {
  const n = fr.length - 1
  const dates = yearDates(6, y0, n)                              // «Июль 2017…»
  const tbl = tableBlock([
    ["Месяц и год", ...dates],
    [`Долг (в ${unitTable})`, ...fr.map((f) => (f === 1 ? "S" : f === 0 ? "0" : `${dec(f)}S`))],
  ])
  return {
    tbl,
    text: `В июле ${y0} года планируется взять кредит в банке на ${years(n)} в размере S ${unitWord}, ` +
      `где S — целое число. Условия его возврата таковы:\n` +
      `— каждый январь долг увеличивается на ${pct(p)} по сравнению с концом предыдущего года;\n` +
      `— с февраля по июнь каждого года необходимо выплатить часть долга;\n` +
      `— в июле каждого года долг должен составлять часть кредита в соответствии со следующей таблицей:\n` +
      `${tbl}${question}`,
  }
}

// ── 2. Наибольшее целое S при ограничении на КАЖДУЮ выплату (эталон 5.2) ───
export function t16TblMaxSPayment() {
  const cand = []
  for (const b of fracScheduleCandidates(FRAC_RATES, FRAC_SETS)) {
    const cmax = Math.max(...b.co)
    for (let S = 2; S <= 40; S++) {
      const lo = cmax * S, hi = cmax * (S + 1)
      for (let L = Math.ceil(lo); L <= Math.floor(hi); L++) {
        if (L - lo < 0.05 || hi - L < 0.05) continue
        cand.push({ ...b, S, L, cmax })
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const y0 = randInt(2015, 2022)
  const q = fracTableText({
    p: c.p, fr: c.fr, y0, unitWord: "млн рублей", unitTable: "млн руб.",
    question: `Найдите наибольшее значение S, при котором каждая из выплат будет меньше ${c.L} млн рублей.`,
  })
  const model = {
    type: "credit", S: c.S, ratePct: c.p,
    payments: tablePayments(c.S, c.p, c.fr), periodUnit: "year", unit: "mln",
  }
  return item({
    text: q.text,
    answer: `${c.S} млн рублей`,
    answerNum: c.S,
    model,
    mustMention: [c.p, c.L],
    extra: [y0, c.fr.length - 1, ...numbersIn(q.tbl)],
    forbid: [],
    checks: [
      () => (Math.max(...tablePayments(c.S, c.p, c.fr)) < c.L ? null : `S = ${c.S} не проходит`),
      () => (Math.max(...tablePayments(c.S + 1, c.p, c.fr)) >= c.L ? null : `S = ${c.S + 1} тоже проходит`),
      () => (Math.min(c.L - c.cmax * c.S, c.cmax * (c.S + 1) - c.L) > 0.04 ? null : "порог на границе"),
    ],
  })
}

// ── 3. Наименьшее целое S при общей сумме > M (эталон 5.3) ─────────────────
export function t16TblMinSTotal() {
  const cand = []
  for (const b of fracScheduleCandidates(FRAC_RATES, FRAC_SETS)) {
    const k = 1 + b.p * b.sigma / 100                          // общая сумма = k·S
    for (let S = 2; S <= 40; S++) {
      const lo = k * (S - 1), hi = k * S
      for (let M = Math.ceil(lo); M <= Math.floor(hi); M++) {
        if (M - lo < 0.05 || hi - M < 0.05) continue
        cand.push({ ...b, S, M, k })
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const y0 = randInt(2015, 2022)
  const q = fracTableText({
    p: c.p, fr: c.fr, y0, unitWord: "млн рублей", unitTable: "млн руб.",
    question: `Найдите наименьшее значение S, при котором общая сумма выплат будет больше ${c.M} млн рублей.`,
  })
  const model = {
    type: "credit", S: c.S, ratePct: c.p,
    payments: tablePayments(c.S, c.p, c.fr), periodUnit: "year", unit: "mln",
  }
  return item({
    text: q.text,
    answer: `${c.S} млн рублей`,
    answerNum: c.S,
    model,
    mustMention: [c.p, c.M],
    extra: [y0, c.fr.length - 1, ...numbersIn(q.tbl)],
    forbid: [],
    checks: [
      () => (c.k * c.S > c.M ? null : `S = ${c.S} не проходит`),
      () => (c.k * (c.S - 1) <= c.M ? null : `S = ${c.S - 1} тоже проходит`),
      () => (Math.abs(simulateCredit(model).total - c.k * c.S) < 1e-6 ? null : "симуляция ≠ формуле"),
    ],
  })
}

// ── 4. Переплата в процентах по таблице долей (эталон 5.4) ─────────────────
// Таблица в % от кредита; ответ — на сколько процентов общая сумма выплат больше кредита.
export function t16TblOverpayPct() {
  const cand = []
  for (const p of [2, 3, 4, 5, 6, 8, 10]) {
    for (const fr of FRAC_SETS.concat([[1, 0.9, 0.8, 0.7, 0.6, 0.5, 0]])) {
      const co = tableCoefs(p, fr)
      if (co.some((x) => x <= 0)) continue
      const sigma = sum(fr.slice(0, fr.length - 1))
      const over = p * sigma                                    // переплата в % от кредита
      if (Math.abs(over * 10 - Math.round(over * 10)) > 1e-9) continue
      if (over < 3 || over > 60) continue
      cand.push({ p, fr, over: Math.round(over * 10) / 10 })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const n = c.fr.length - 1
  const startM = randInt(1, 12)
  const dates = monthDates(startM, n)
  const tbl = tableBlock([
    ["Дата", ...dates],
    ["Долг (в % от кредита)", ...c.fr.map((f) => `${Math.round(f * 100)} %`)],
  ])
  const S = 1_000_000
  const model = {
    type: "credit", S, ratePct: c.p, payments: tablePayments(S, c.p, c.fr),
    periodUnit: "month",
  }
  return item({
    text: `15-го ${MONTH_NAMES[startM - 1]} был выдан кредит на ${months(n)}. В таблице представлен ` +
      `график его погашения.\n${tbl}` +
      `В конце каждого месяца текущий долг увеличивался на ${pct(c.p)}, а выплаты по погашению кредита ` +
      `происходили в первой половине следующего месяца. На сколько процентов общая сумма выплат ` +
      `при таких условиях больше суммы самого кредита?`,
    answer: `${pct(c.over)}`,
    answerNum: c.over,
    model,
    mustMention: [c.p],
    extra: [15, n, ...numbersIn(tbl)],
    forbid: [],
    checks: [
      () => (Math.abs(simulateCredit(model).total / S - (1 + c.over / 100)) < 1e-9
        ? null : "переплата ≠ ответу"),
    ],
  })
}

// ── 5. Наибольшее S при ограничении на РАЗМАХ выплат (эталон 5.5) ──────────
export function t16TblMaxSSpread() {
  const cand = []
  for (const b of fracScheduleCandidates(FRAC_RATES, FRAC_SETS)) {
    const spread = Math.max(...b.co) - Math.min(...b.co)
    if (spread <= 0.01) continue
    for (let S = 3; S <= 40; S++) {
      const lo = spread * S, hi = spread * (S + 1)
      for (let L = Math.ceil(lo); L <= Math.floor(hi); L++) {
        if (L - lo < 0.05 || hi - L < 0.05 || L < 1) continue
        cand.push({ ...b, S, L, spread })
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const y0 = randInt(2015, 2022)
  const q = fracTableText({
    p: c.p, fr: c.fr, y0, unitWord: "млн рублей", unitTable: "млн рублей",
    question: `Найдите наибольшее значение S, при котором разница между наибольшей и наименьшей ` +
      `выплатами будет меньше ${c.L} млн рублей.`,
  })
  const model = {
    type: "credit", S: c.S, ratePct: c.p,
    payments: tablePayments(c.S, c.p, c.fr), periodUnit: "year", unit: "mln",
  }
  const spreadOf = (S) => {
    const ps = tablePayments(S, c.p, c.fr)
    return Math.max(...ps) - Math.min(...ps)
  }
  return item({
    text: q.text,
    answer: `${c.S} млн рублей`,
    answerNum: c.S,
    model,
    mustMention: [c.p, c.L],
    extra: [y0, c.fr.length - 1, ...numbersIn(q.tbl)],
    forbid: [],
    checks: [
      () => (spreadOf(c.S) < c.L ? null : `S = ${c.S} не проходит`),
      () => (spreadOf(c.S + 1) >= c.L ? null : `S = ${c.S + 1} тоже проходит`),
      () => (Math.min(c.L - spreadOf(c.S), spreadOf(c.S + 1) - c.L) > 0.04 ? null : "порог на границе"),
    ],
  })
}

// ── 6. Наименьшее S, при котором ВСЕ выплаты — целые тысячи (эталон 5.6) ───
// pₖ = (Q·Fₖ₋₁ − 100·Fₖ)/100000 · S, где F — доли ×1000, Q = 100 + p.
// Целое ⟺ S кратно 100000/НОД(числитель, 100000); ответ — НОК по всем k.
export function t16TblMinSInteger() {
  const cand = []
  for (const p of [10, 15, 20, 25, 12, 30]) {
    for (const fr of FRAC_SETS) {
      const co = tableCoefs(p, fr)
      if (co.some((x) => x <= 0)) continue
      const Q = 100 + p
      const F = fr.map((f) => Math.round(f * 1000))
      let need = 1, ok = true
      for (let k = 1; k < F.length; k++) {
        const num = Q * F[k - 1] - 100 * F[k]
        if (num <= 0) { ok = false; break }
        need = lcm(need, 100000 / gcd(num, 100000))
      }
      if (!ok || need < 5 || need > 5000) continue
      cand.push({ p, fr, S: need })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const y0 = randInt(2015, 2022)
  const q = fracTableText({
    p: c.p, fr: c.fr, y0, unitWord: "тыс. рублей", unitTable: "тыс. руб.",
    question: `Найдите наименьшее значение S, при котором каждая из выплат будет составлять целое ` +
      `число тысяч рублей.`,
  })
  const model = {
    type: "credit", S: c.S, ratePct: c.p,
    payments: tablePayments(c.S, c.p, c.fr), periodUnit: "year", unit: "ths",
  }
  const allInt = (S) => tablePayments(S, c.p, c.fr).every((x) => Math.abs(x - Math.round(x)) < 1e-6)
  return item({
    text: q.text,
    answer: `${money(c.S)} тыс. рублей`,
    answerNum: c.S,
    model,
    mustMention: [c.p],
    extra: [y0, c.fr.length - 1, ...numbersIn(q.tbl)],
    forbid: [],
    checks: [
      () => (allInt(c.S) ? null : `S = ${c.S} не даёт целых выплат`),
      // перебор ВСЕХ меньших натуральных S — минимальность доказана, а не заявлена
      () => {
        for (let S = 1; S < c.S; S++) if (allInt(S)) return `S = ${S} тоже подходит и меньше`
        return null
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
  t16DepMaxInitial, t16DepMinTopUp, t16DepTwoParams, t16DepTwoAccounts,
  t16DepCompareLastYear, t16DepCompareTwoYears,
  t16CompoundSum, t16CompoundTerm, t16CompoundRate, t16DepWithdraw,
  t16IntOnlyMinCredit, t16IntOnlyRate, t16IntOnlyTotal, t16GeomPayments,
  t16TblMaxRate, t16TblMaxSPayment, t16TblMinSTotal, t16TblOverpayPct,
  t16TblMaxSSpread, t16TblMinSInteger,
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
  ["Вклады", [
    ["dep-max-initial", "Наибольший целый первоначальный вклад", t16DepMaxInitial],
    ["dep-min-topup", "Наименьшее целое ежегодное пополнение", t16DepMinTopUp],
    ["dep-two-params", "Два пополнения n и m при двух ограничениях", t16DepTwoParams],
    ["dep-two-accounts", "Два накопительных вклада: когда сравняются", t16DepTwoAccounts],
    ["dep-cmp-last", "Наименьший % за последний год вклада «Б»", t16DepCompareLastYear],
    ["dep-cmp-two", "Наименьший % за два года вклада «Б»", t16DepCompareTwoYears],
    ["dep-sum", "Сложный процент: найти сумму", t16CompoundSum],
    ["dep-term", "Сложный процент: найти срок", t16CompoundTerm],
    ["dep-rate", "Сложный процент: найти ставку", t16CompoundRate],
    ["dep-withdraw", "Вклад с ежегодным снятием: наибольшее снятие", t16DepWithdraw],
  ]],
  ["Другие схемы выплат", [
    ["io-min-credit", "Только проценты + равные платежи: наименьший кредит", t16IntOnlyMinCredit],
    ["io-rate", "Только проценты + равные платежи: найти ставку", t16IntOnlyRate],
    ["io-total", "Только проценты + равные платежи: общая сумма", t16IntOnlyTotal],
    ["geom-pay", "Платежи в геометрической прогрессии: первый платёж", t16GeomPayments],
  ]],
  ["Уменьшение долга по таблице", [
    ["tbl-max-rate", "Наибольшее целое r при общей сумме < M", t16TblMaxRate],
    ["tbl-max-s-pay", "Наибольшее S при ограничении на каждую выплату", t16TblMaxSPayment],
    ["tbl-min-s-total", "Наименьшее S при общей сумме > M", t16TblMinSTotal],
    ["tbl-overpay", "Переплата в процентах по таблице долей", t16TblOverpayPct],
    ["tbl-max-s-spread", "Наибольшее S при ограничении на размах выплат", t16TblMaxSSpread],
    ["tbl-min-s-int", "Наименьшее S, при котором все выплаты целые", t16TblMinSInteger],
  ]],
]
