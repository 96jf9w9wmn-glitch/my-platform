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
// Дательный падеж имени: «Владимиру нужно производить…» (формулировка эталона).
function dative(name) {
  if (name === "Пётр") return "Петру"
  if (name.endsWith("ия")) return name.slice(0, -1) + "и"
  if (name.endsWith("й")) return name.slice(0, -1) + "ю"
  if (name.endsWith("а") || name.endsWith("я")) return name.slice(0, -1) + "е"
  return name + "у"
}
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
    if (v.mustMention.some((x) => near(x, bad))) return { ok: false, err: `ответ ${bad} раскрыт в условии` }
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
  if (Math.abs(A * 1000 - Math.round(A * 1000)) > Math.max(1e-6, Math.abs(A) * 1e-9)) {
    return { ok: false, err: `ответ ${A} с длинным хвостом` }
  }
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
//  РАЗДЕЛ 6. ДИФФЕРЕНЦИРОВАННЫЕ ПЛАТЕЖИ
// ═══════════════════════════════════════════════════════════════════════════
//
// Долг на контрольную дату убывает на одну и ту же величину d = S/n:
//   Dₖ = S(1 − k/n),  платёж pₖ = Dₖ₋₁·x + d,  x = r/100.
// Платежи образуют убывающую арифметическую прогрессию с шагом −d·x, поэтому
//   общая сумма = S·(1 + x·(n+1)/2),
//   сумма первых K платежей = K·d + x·S·(K − K(K−1)/(2n)).
// Эти формулы — «вторая реализация»; verify16 сверяет их с пошаговой симуляцией.

const diffPayments = (S, ratePct, n) => {
  const x = ratePct / 100, d = S / n
  return Array.from({ length: n }, (_, i) => (S - i * d) * x + d)
}
const diffTotal = (S, ratePct, n) => S * (1 + (ratePct / 100) * (n + 1) / 2)
const diffFirstK = (S, ratePct, n, K) =>
  K * (S / n) + (ratePct / 100) * S * (K - K * (K - 1) / (2 * n))
const diffLastK = (S, ratePct, n, K) =>
  diffTotal(S, ratePct, n) - diffFirstK(S, ratePct, n, n - K)

// Модель дифференцированного кредита; все платежи обязаны быть целыми рублями,
// поэтому кандидаты фильтруются условием S % (n·100) = 0 (при целой ставке).
function diffModel(S, ratePct, n, periodUnit, unit) {
  return { type: "credit", S, ratePct, payments: diffPayments(S, ratePct, n), periodUnit, unit }
}
const diffExact = (S, ratePct, n) => diffPayments(S, ratePct, n).every(isMoney)

// Преамбула помесячной схемы (формулировка эталона, раздел 6).
function diffMonthPreamble(startMonth, n, rateText, sizeText) {
  return `15-го ${MONTH_NAMES[startMonth - 1]} планируется взять кредит в банке на ${months(n)}` +
    `${sizeText}. Условия его возврата таковы:\n` +
    `— 1-го числа каждого месяца долг возрастает на ${rateText} по сравнению с концом ` +
    `предыдущего месяца;\n` +
    `— со 2-го по 14-е число каждого месяца необходимо выплатить часть долга;\n` +
    `— 15-го числа каждого месяца долг должен быть на одну и ту же сумму меньше долга ` +
    `на 15-е число предыдущего месяца.\n`
}
// Преамбула годовой схемы (эталон 6.7–6.10).
function diffYearPreamble(n, rateText, sizeText) {
  return `В июле планируется взять кредит в банке${sizeText}${n ? ` на срок ${years(n)}` : " на некоторый срок (целое число лет)"}. ` +
    `Условия его возврата таковы:\n` +
    `— каждый январь долг возрастает на ${rateText} по сравнению с концом предыдущего года;\n` +
    `— с февраля по июнь каждого года необходимо выплатить часть долга;\n` +
    `— в июле каждого года долг должен быть на одну и ту же сумму меньше долга на июль ` +
    `предыдущего года.\n`
}
const MONTH_EXTRA = [15, 1, 2, 14]

// ── 1. Ставка по переплате в процентах (эталон 6.1) ────────────────────────
// Общая сумма на P % больше кредита ⇒ x·(n+1)/2 = P/100 ⇒ r = 200P/(n+1).
export function t16DiffRateByOverpay() {
  const cand = []
  for (let n = 8; n <= 36; n++) {
    for (let P = 5; P <= 60; P++) {
      const r = 2 * P / (n + 1)
      if (Math.abs(r * 2 - Math.round(r * 2)) > 1e-9) continue     // ставка кратна 0,5
      if (r < 1 || r > 30) continue
      cand.push({ n, P, r: Math.round(r * 2) / 2 })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  // сумма кредита в условии не дана, но график симуляции должен быть в целых рублях
  const S = lcm(c.n * 200, 1000) * 5
  const model = diffModel(S, c.r, c.n, "month")
  const startM = randInt(1, 12)
  const overFor = (r) => 100 * ((1 + (r / 100) * (c.n + 1) / 2) - 1)
  return item({
    text: diffMonthPreamble(startM, c.n, "r %", "") +
      `Известно, что общая сумма выплат после полного погашения кредита на ${pct(c.P)} больше суммы, ` +
      `взятой в кредит. Найдите r.`,
    answer: `${pct(c.r)}`,
    answerNum: c.r,
    model,
    mustMention: [c.P],
    extra: [...MONTH_EXTRA, c.n],
    forbid: [],
    checks: [
      () => (Math.abs(overFor(c.r) - c.P) < 1e-9 ? null : "переплата ≠ заданной"),
      () => {
        for (let r = 0.5; r <= 40.0001; r += 0.5) {
          if (Math.abs(r - c.r) < 1e-9) continue
          if (Math.abs(overFor(r) - c.P) < 1e-6) return `ставка ${r} тоже подходит`
        }
        return null
      },
    ],
  })
}

// ── 2. Сколько процентов общая сумма от кредита (эталон 6.2) ───────────────
export function t16DiffTotalPct() {
  const cand = []
  for (let n = 8; n <= 36; n++) {
    for (const r of [1, 1.5, 2, 2.5, 3]) {
      const P = 100 + r * (n + 1) / 2
      if (Math.abs(P * 10 - Math.round(P * 10)) > 1e-9) continue
      cand.push({ n, r, P: Math.round(P * 10) / 10 })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const S = lcm(c.n * 200, 1000) * 5
  const model = diffModel(S, c.r, c.n, "month")
  const startM = randInt(1, 12)
  return item({
    text: diffMonthPreamble(startM, c.n, pct(c.r), "") +
      `Сколько процентов будет составлять общая сумма выплат от суммы, взятой в кредит?`,
    answer: `${pct(c.P)}`,
    answerNum: c.P,
    model,
    mustMention: [c.r],
    extra: [...MONTH_EXTRA, c.n],
    forbid: [],
    checks: [
      () => (Math.abs(simulateCredit(model).total / S * 100 - c.P) < 1e-6 ? null : "симуляция ≠ ответу"),
    ],
  })
}

// Подбор помесячного дифференцированного кредита с ЦЕЛЫМИ платежами.
const DIFF_CACHE = new Map()
function diffMonthlyCandidates(rates = [1, 1.5, 2, 2.5, 3], nList = null) {
  const key = rates.join(",") + "|" + (nList || []).join(",")
  if (DIFF_CACHE.has(key)) return DIFF_CACHE.get(key)
  const out = []
  const ns = nList || [12, 15, 16, 18, 20, 21, 24, 25, 30, 36]
  for (const n of ns) {
    for (const r of rates) {
      const step = lcm(n * 200, 1000)                    // целые платежи + «человеческая» сумма
      for (let S = step; S <= 10_000_000; S += step) {
        if (S < 300_000) continue
        if (!diffExact(S, r, n)) continue
        out.push({ n, r, S })
      }
    }
  }
  DIFF_CACHE.set(key, out)
  return out
}

// ── 3. Сумма выплат за первые K месяцев (эталон 6.3) ───────────────────────
export function t16DiffFirstK() {
  const base = diffMonthlyCandidates()
  const cand = []
  for (const b of base) {
    for (const K of [6, 12, 18]) {
      if (K >= b.n) continue
      const V = diffFirstK(b.S, b.r, b.n, K)
      if (!isMoney(V) || V % 100 !== 0) continue
      cand.push({ ...b, K, V })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = diffModel(c.S, c.r, c.n, "month")
  const startM = randInt(1, 12)
  return item({
    text: diffMonthPreamble(startM, c.n, pct(c.r), ` на сумму ${rub(c.S)}`) +
      `Какую сумму нужно выплатить банку за первые ${months(c.K)}?`,
    answer: `${money(c.V)} рублей`,
    answerNum: c.V,
    model,
    mustMention: [c.S, c.r, c.K],
    extra: [...MONTH_EXTRA, c.n],
    forbid: [c.V],
    checks: [
      () => (Math.abs(sum(simulateCredit(model).steps.slice(0, c.K).map((s) => s.payment)) - c.V) < 0.005
        ? null : "симуляция ≠ ответу"),
    ],
  })
}

// ── 4. Общая сумма по известной k-й выплате (эталон 6.4) ───────────────────
export function t16DiffTotalByKth() {
  const base = diffMonthlyCandidates()
  const cand = []
  for (const b of base) {
    for (const k of [5, 8, 10, 12]) {
      if (k > b.n) continue
      const V = diffPayments(b.S, b.r, b.n)[k - 1]
      if (!isMoney(V) || V % 1000 !== 0) continue
      const T = Math.round(diffTotal(b.S, b.r, b.n) * 100) / 100
      if (!isMoney(T)) continue
      cand.push({ ...b, k, V, T })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = diffModel(c.S, c.r, c.n, "month")
  const startM = randInt(1, 12)
  const ORD = { 5: "пятая", 8: "восьмая", 10: "десятая", 12: "двенадцатая" }
  return item({
    text: diffMonthPreamble(startM, c.n, pct(c.r), "") +
      `Известно, что ${ORD[c.k]} выплата составила ${rub(c.V)}. Какую сумму нужно вернуть банку ` +
      `в течение всего срока кредитования?`,
    answer: `${money(c.T)} рублей`,
    answerNum: c.T,
    model,
    mustMention: [c.r, c.V],
    extra: [...MONTH_EXTRA, c.n],
    forbid: [c.T],
    checks: [
      () => (Math.abs(simulateCredit(model).steps[c.k - 1].payment - c.V) < 0.005 ? null : "k-я выплата ≠ данной"),
      () => (Math.abs(simulateCredit(model).total - c.T) < 0.005 ? null : "симуляция ≠ ответу"),
      // S определяется однозначно: k-я выплата линейна и строго возрастает по S
      () => {
        const coef = c.V / c.S
        return Math.abs(coef) > 1e-9 ? null : "вырожденный коэффициент"
      },
    ],
  })
}

// ── 5. Кредит по сумме ПЕРВЫХ K выплат (эталон 6.5) ────────────────────────
export function t16DiffPrincipalByFirst() {
  const base = diffMonthlyCandidates()
  const cand = []
  for (const b of base) {
    for (const K of [6, 12]) {
      if (K >= b.n) continue
      const V = diffFirstK(b.S, b.r, b.n, K)
      if (!isMoney(V) || V % 100 !== 0) continue
      cand.push({ ...b, K, V })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = diffModel(c.S, c.r, c.n, "month")
  const startM = randInt(1, 12)
  const yearWord = c.K === 12 ? "за первый год" : `за первые ${months(c.K)}`
  return item({
    text: diffMonthPreamble(startM, c.n, pct(c.r), "") +
      `Известно, что ${yearWord} нужно выплатить банку ${rub(c.V)}. Какую сумму планируется ` +
      `взять в кредит?`,
    answer: `${money(c.S)} рублей`,
    answerNum: c.S,
    model,
    mustMention: [c.r, c.V],
    extra: [...MONTH_EXTRA, c.n, ...(c.K === 12 ? [] : [c.K])],
    forbid: [c.S],
    checks: [
      () => (Math.abs(sum(simulateCredit(model).steps.slice(0, c.K).map((s) => s.payment)) - c.V) < 0.005
        ? null : "симуляция ≠ данной сумме"),
    ],
  })
}

// ── 6. Кредит по сумме ПОСЛЕДНИХ K выплат (эталон 6.6) ─────────────────────
export function t16DiffPrincipalByLast() {
  const base = diffMonthlyCandidates()
  const cand = []
  for (const b of base) {
    for (const K of [6, 12]) {
      if (K >= b.n) continue
      const V = diffLastK(b.S, b.r, b.n, K)
      if (!isMoney(V) || V % 100 !== 0) continue
      cand.push({ ...b, K, V })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = diffModel(c.S, c.r, c.n, "month")
  const startM = randInt(1, 12)
  return item({
    text: diffMonthPreamble(startM, c.n, pct(c.r), "") +
      `Известно, что за последние ${months(c.K)} нужно выплатить банку ${rub(c.V)}. Какую сумму ` +
      `планируется взять в кредит?`,
    answer: `${money(c.S)} рублей`,
    answerNum: c.S,
    model,
    mustMention: [c.r, c.V, c.K],
    extra: [...MONTH_EXTRA, c.n],
    forbid: [c.S],
    checks: [
      () => (Math.abs(sum(simulateCredit(model).steps.slice(c.n - c.K).map((s) => s.payment)) - c.V) < 0.005
        ? null : "симуляция ≠ данной сумме"),
    ],
  })
}

// ── 7. Ставка по границам наибольшего и наименьшего платежа (эталон 6.7) ───
// p₁ ≤ A и pₙ ≥ B при A = d + xS и B = d(1+x): обе границы достигаются РОВНО
// при одном x, поэтому ответ единственный (проверяем сканированием сетки).
export function t16DiffRateByBounds() {
  const cand = []
  for (const r of [5, 10, 12, 15, 20, 25]) {
    const x = r / 100
    for (let n = 5; n <= 15; n++) {
      for (let sk = 10; sk <= 100; sk++) {
        const S = sk / 10                                  // млн, один знак после запятой
        const d = S / n
        const A = d + x * S, B = d * (1 + x)
        if (Math.abs(A * 10 - Math.round(A * 10)) > 1e-9) continue
        if (Math.abs(B * 10 - Math.round(B * 10)) > 1e-9) continue
        if (B < 0.2 || A > 20 || A <= B) continue
        if (r === S || r === n || r === A || r === B) continue   // ответ не должен стоять в условии
        if (!diffExact(S * 1e6, r, n)) continue
        cand.push({ r, n, S, A: Math.round(A * 10) / 10, B: Math.round(B * 10) / 10 })
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = diffModel(c.S, c.r, c.n, "year", "mln")
  const first = (r) => c.S / c.n + (r / 100) * c.S
  const last = (r) => (c.S / c.n) * (1 + r / 100)
  return item({
    text: diffYearPreamble(c.n, "r %", ` на сумму ${dec(c.S)} млн рублей`) +
      `Найдите r, если известно, что наибольший годовой платёж по кредиту составит не более ` +
      `${dec(c.A)} млн рублей, а наименьший — не менее ${dec(c.B)} млн рублей.`,
    answer: `${pct(c.r)}`,
    answerNum: c.r,
    model,
    mustMention: [c.S, c.A, c.B],
    extra: [c.n],
    forbid: [c.r],
    checks: [
      () => (first(c.r) <= c.A + 1e-9 && last(c.r) >= c.B - 1e-9 ? null : "ставка не удовлетворяет границам"),
      () => {
        for (let r = 0.5; r <= 40.0001; r += 0.5) {
          if (Math.abs(r - c.r) < 1e-9) continue
          if (first(r) <= c.A + 1e-9 && last(r) >= c.B - 1e-9) return `ставка ${r} тоже подходит`
        }
        return null
      },
    ],
  })
}

// Годовые дифференцированные кандидаты (суммы в млн, платежи — целые рубли).
const diffYearCandidates = once(() => {
  const out = []
  for (const r of [10, 12, 15, 20, 25]) {
    for (let n = 4; n <= 20; n++) {
      for (let sk = 2; sk <= 60; sk++) {
        const S = sk                                        // целое число млн
        if (!diffExact(S * 1e6, r, n)) continue
        out.push({ r, n, S })
      }
    }
  }
  return out
})

// ── 8. Общая сумма по НАИБОЛЬШЕМУ годовому платежу (эталон 6.8) ────────────
export function t16DiffTotalByMax() {
  const cand = []
  for (const b of diffYearCandidates()) {
    const A = b.S / b.n + (b.r / 100) * b.S
    const T = diffTotal(b.S, b.r, b.n)
    if (Math.abs(A * 100 - Math.round(A * 100)) > 1e-9) continue
    if (Math.abs(T * 100 - Math.round(T * 100)) > 1e-9) continue
    if (A < 0.5 || A > 20 || T > 200) continue
    const Tr = Math.round(T * 100) / 100, Ar = Math.round(A * 100) / 100
    if (Tr === b.S || Tr === b.r || Tr === Ar) continue    // ответ не должен стоять в условии
    cand.push({ ...b, A: Ar, T: Tr })
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = diffModel(c.S, c.r, c.n, "year", "mln")
  const maxFor = (n) => c.S / n + (c.r / 100) * c.S
  return item({
    text: diffYearPreamble(0, pct(c.r), ` на сумму ${dec(c.S)} млн рублей`) +
      `Чему будет равна общая сумма выплат после полного погашения кредита, если наибольший ` +
      `годовой платёж составит ${dec(c.A)} млн рублей?`,
    answer: `${dec(c.T)} млн рублей`,
    answerNum: c.T,
    model,
    mustMention: [c.S, c.r, c.A],
    extra: [],
    forbid: [c.T],
    checks: [
      () => (Math.abs(simulateCredit(model).total - c.T) < 1e-6 ? null : "симуляция ≠ ответу"),
      () => {
        for (let n = 1; n <= 40; n++) {
          if (n === c.n) continue
          if (Math.abs(maxFor(n) - c.A) < 1e-9) return `срок ${n} тоже даёт платёж ${c.A}`
        }
        return null
      },
    ],
  })
}

// ── 9. Общая сумма по НАИМЕНЬШЕМУ годовому платежу (эталон 6.9) ────────────
export function t16DiffTotalByMin() {
  const cand = []
  for (const b of diffYearCandidates()) {
    const B = (b.S / b.n) * (1 + b.r / 100)
    const T = diffTotal(b.S, b.r, b.n)
    if (Math.abs(B * 100 - Math.round(B * 100)) > 1e-9) continue
    if (Math.abs(T * 100 - Math.round(T * 100)) > 1e-9) continue
    if (B < 0.2 || B > 10 || T > 200) continue
    const Tr = Math.round(T * 100) / 100, Br = Math.round(B * 100) / 100
    if (Tr === b.S || Tr === b.r || Tr === Br) continue    // ответ не должен стоять в условии
    cand.push({ ...b, B: Br, T: Tr })
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = diffModel(c.S, c.r, c.n, "year", "mln")
  const minFor = (n) => (c.S / n) * (1 + c.r / 100)
  return item({
    text: diffYearPreamble(0, pct(c.r), ` на сумму ${dec(c.S)} млн рублей`) +
      `Чему будет равна общая сумма выплат после полного погашения кредита, если наименьший ` +
      `годовой платёж составит ${dec(c.B)} млн рублей?`,
    answer: `${dec(c.T)} млн рублей`,
    answerNum: c.T,
    model,
    mustMention: [c.S, c.r, c.B],
    extra: [],
    forbid: [c.T],
    checks: [
      () => (Math.abs(simulateCredit(model).total - c.T) < 1e-6 ? null : "симуляция ≠ ответу"),
      () => {
        for (let n = 1; n <= 40; n++) {
          if (n === c.n) continue
          if (Math.abs(minFor(n) - c.B) < 1e-9) return `срок ${n} тоже даёт платёж ${c.B}`
        }
        return null
      },
    ],
  })
}

// ── 10. Срок по общей сумме выплат (эталон 6.10) ───────────────────────────
export function t16DiffTermByTotal() {
  const cand = []
  for (const b of diffYearCandidates()) {
    const T = diffTotal(b.S, b.r, b.n)
    if (Math.abs(T * 100 - Math.round(T * 100)) > 1e-9) continue
    // срок-ответ не должен совпасть ни с одним числом условия (ставка, сумма, итог)
    if (T > 200 || b.n === b.r || b.n === b.S || Math.abs(b.n - T) < 1e-9) continue
    cand.push({ ...b, T: Math.round(T * 100) / 100 })
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = diffModel(c.S, c.r, c.n, "year", "mln")
  const totalFor = (n) => diffTotal(c.S, c.r, n)
  return item({
    text: diffYearPreamble(0, pct(c.r), ` на сумму ${dec(c.S)} млн рублей`) +
      `На сколько лет планируется взять кредит, если известно, что общая сумма выплат после его ` +
      `полного погашения составит ${dec(c.T)} млн рублей?`,
    answer: `${years(c.n)}`,
    answerNum: c.n,
    model,
    mustMention: [c.S, c.r, c.T],
    extra: [],
    forbid: [c.n],
    checks: [
      () => (Math.abs(totalFor(c.n) - c.T) < 1e-6 ? null : "срок не даёт заявленную сумму"),
      () => {
        for (let n = 1; n <= 40; n++) {
          if (n === c.n) continue
          if (Math.abs(totalFor(n) - c.T) < 1e-6) return `срок ${n} тоже подходит`
        }
        return null
      },
    ],
  })
}

// ── 11. Кредит по общей сумме выплат (эталон 6.11) ─────────────────────────
export function t16DiffPrincipalByTotal() {
  const base = diffMonthlyCandidates()
  const cand = []
  for (const b of base) {
    const T = diffTotal(b.S, b.r, b.n)
    if (!isMoney(T) || T % 1000 !== 0 || T === b.S) continue
    cand.push({ ...b, T })
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = diffModel(c.S, c.r, c.n, "month")
  const startM = randInt(1, 12)
  const totalFor = (S) => diffTotal(S, c.r, c.n)
  return item({
    text: diffMonthPreamble(startM, c.n, pct(c.r), "") +
      `Какую сумму следует взять в кредит, чтобы общая сумма выплат после полного его погашения ` +
      `равнялась ${rub(c.T)}?`,
    answer: `${money(c.S)} рублей`,
    answerNum: c.S,
    model,
    mustMention: [c.r, c.T],
    extra: [...MONTH_EXTRA, c.n],
    forbid: [c.S],
    checks: [
      () => (Math.abs(simulateCredit(model).total - c.T) < 0.005 ? null : "симуляция ≠ данной сумме"),
      () => (Math.abs(totalFor(c.S + 1000) - c.T) > 1 ? null : "соседняя сумма тоже подходит"),
    ],
  })
}

// ── 12. Сумма за ВТОРОЙ год по сумме за первый (эталон 6.12) ───────────────
export function t16DiffSecondYear() {
  const base = diffMonthlyCandidates([1, 1.5, 2, 2.5, 3], [24])
  const cand = []
  for (const b of base) {
    const V1 = diffFirstK(b.S, b.r, 24, 12)
    const V2 = diffTotal(b.S, b.r, 24) - V1
    if (!isMoney(V1) || !isMoney(V2)) continue
    if (V1 % 100 !== 0 || V2 % 100 !== 0 || V1 === V2) continue
    cand.push({ ...b, V1, V2 })
  }
  if (!cand.length) return null
  const c = pick(cand)
  const model = diffModel(c.S, c.r, 24, "month")
  const startM = randInt(1, 12)
  return item({
    text: diffMonthPreamble(startM, 24, pct(c.r), "") +
      `Какую сумму надо вернуть банку за второй год, если за первые ${months(12)} нужно вернуть ` +
      `банку ${rub(c.V1)}?`,
    answer: `${money(c.V2)} рублей`,
    answerNum: c.V2,
    model,
    mustMention: [c.r, c.V1, 12],
    extra: [...MONTH_EXTRA, 24],
    forbid: [c.V2],
    checks: [
      () => {
        const st = simulateCredit(model).steps.map((s) => s.payment)
        if (Math.abs(sum(st.slice(0, 12)) - c.V1) > 0.005) return "первый год ≠ данной сумме"
        if (Math.abs(sum(st.slice(12)) - c.V2) > 0.005) return "второй год ≠ ответу"
        return null
      },
    ],
  })
}

// ═══════════════════════════════════════════════════════════════════════════
//  РАЗДЕЛ 7. ДИФФ. ПЛАТЕЖИ С ДОПОЛНИТЕЛЬНЫМ УСЛОВИЕМ
// ═══════════════════════════════════════════════════════════════════════════
//
// Схема: n месяцев долг падает на одинаковый шаг d = (S − R)/n, на 15-е число
// n-го месяца долг равен R, а к 15-му числу (n+1)-го месяца гасится ХВОСТОВЫМ
// платежом R·(1+x). Итого n+1 выплат.
//   pₖ = d + x·Dₖ₋₁ (k = 1…n),   p₍ₙ₊₁₎ = R·(1 + x),
//   общая сумма = S + x·[n·S − (S − R)(n−1)/2 + R].

function tailPayments(S, ratePct, n, R) {
  const d = (S - R) / n, x = ratePct / 100
  const pays = []
  for (let k = 1; k <= n; k++) pays.push(d + x * (S - (k - 1) * d))
  pays.push(R * (1 + x))
  return pays
}
const tailTotal = (S, ratePct, n, R) =>
  S + (ratePct / 100) * (n * S - (S - R) * (n - 1) / 2 + R)

const tailModel = (S, ratePct, n, R) => ({
  type: "credit", S, ratePct, payments: tailPayments(S, ratePct, n, R), periodUnit: "month",
})

// Тяжёлые переборы кандидатов считаем один раз на модуль.
function once(fn) { let v; return () => (v === undefined ? (v = fn()) : v) }

const tailCandidates = once(() => {
  const out = []
  for (const r of [1, 1.5, 2, 2.5, 3]) {
    for (let n = 10; n <= 30; n++) {
      for (let sk = 3; sk <= 30; sk++) {
        const S = sk * 100_000
        for (let rk = 1; rk <= 8; rk++) {
          const R = rk * 100_000
          if (R >= S * 0.6) continue
          if ((S - R) % n !== 0) continue
          const pays = tailPayments(S, r, n, R)
          if (!pays.every(isMoney)) continue
          const T = tailTotal(S, r, n, R)
          if (!isMoney(T)) continue
          out.push({ r, n, S, R, T: Math.round(T * 100) / 100, d: (S - R) / n, pays })
        }
      }
    }
  }
  return out
})

// Преамбула схемы «равный шаг + хвостовой платёж» (формулировка эталона, раздел 7).
function tailPreamble(startMonth, n, sizeText, rateText, stepText, tailText) {
  return `15-го ${MONTH_NAMES[startMonth - 1]} в банке был взят кредит${sizeText} на ${months(n + 1)}. ` +
    `Условия его возврата таковы:\n` +
    `— 1-го числа каждого месяца долг возрастает на ${rateText} по сравнению с концом ` +
    `предыдущего месяца;\n` +
    `— со 2-го по 14-е число каждого месяца необходимо выплатить часть долга;\n` +
    `— 15-го числа каждого месяца с 1-го по ${n}-й долг должен быть ${stepText} меньше долга ` +
    `на 15-е число предыдущего месяца;\n${tailText}` +
    `— к 15-му числу ${n + 1}-го месяца кредит должен быть полностью погашен.\n`
}
const tailRemainderLine = (n, R) =>
  `— 15-го числа ${n}-го месяца долг составит ${rub(R)};\n`

// ── 1. Сумма кредита по общей сумме выплат (эталон 7.1, 7.5) ───────────────
export function t16TailPrincipal() {
  const pool = tailCandidates().filter((c) => c.T % 1000 === 0 && c.T !== c.S)
  if (!pool.length) return null
  const c = pick(pool)
  const model = tailModel(c.S, c.r, c.n, c.R)
  const startM = randInt(1, 12)
  // шаг задан либо числом (как в эталоне 7.1), либо словами «на одну и ту же сумму» (7.5)
  const stepByValue = Math.random() < 0.5
  const stepText = stepByValue ? `на ${rub(c.d)}` : "на одну и ту же сумму"
  const tailText = stepByValue ? "" : tailRemainderLine(c.n, c.R)
  return item({
    text: tailPreamble(startM, c.n, "", pct(c.r), stepText, tailText) +
      `Какую сумму планируется взять в кредит, если общая сумма выплат после его погашения ` +
      `составила ${rub(c.T)}?`,
    answer: `${money(c.S)} рублей`,
    answerNum: c.S,
    model,
    mustMention: [c.r, c.T, ...(stepByValue ? [c.d] : [c.R])],
    extra: [...MONTH_EXTRA, c.n, c.n + 1],
    forbid: [c.S],
    checks: [
      () => (Math.abs(simulateCredit(model).total - c.T) < 0.005 ? null : "симуляция ≠ данной сумме"),
      () => (Math.abs(tailTotal(c.S + 1000, c.r, c.n, c.R) - c.T) > 1 ? null : "соседняя сумма тоже подходит"),
    ],
  })
}

// ── 2. Ставка по общей сумме выплат (эталон 7.2, 7.3) ──────────────────────
export function t16TailRate() {
  const pool = tailCandidates().filter((c) => c.T % 1000 === 0 && c.S % 100_000 === 0 && c.r !== c.n)
  if (!pool.length) return null
  const c = pick(pool)
  const model = tailModel(c.S, c.r, c.n, c.R)
  const startM = randInt(1, 12)
  const stepByValue = Math.random() < 0.5
  const stepText = stepByValue ? `на ${rub(c.d)}` : "на одну и ту же сумму"
  const totalFor = (r) => tailTotal(c.S, r, c.n, c.R)
  return item({
    text: tailPreamble(startM, c.n, ` на ${rub(c.S)}`, "r %", stepText, tailRemainderLine(c.n, c.R)) +
      `Найдите r, если общая сумма выплат после его погашения составила ${rub(c.T)}.`,
    answer: `${pct(c.r)}`,
    answerNum: c.r,
    model,
    mustMention: [c.S, c.R, c.T, ...(stepByValue ? [c.d] : [])],
    extra: [...MONTH_EXTRA, c.n, c.n + 1],
    forbid: [c.r],
    checks: [
      () => {
        for (let r = 0.5; r <= 40.0001; r += 0.5) {
          if (Math.abs(r - c.r) < 1e-9) continue
          if (Math.abs(totalFor(r) - c.T) < 0.5) return `ставка ${r} тоже подходит`
        }
        return Math.abs(totalFor(c.r) - c.T) < 0.005 ? null : "общая сумма не сходится"
      },
    ],
  })
}

// ── 3. Число месяцев n по общей сумме выплат (эталон 7.4) ──────────────────
export function t16TailMonths() {
  const pool = tailCandidates().filter((c) =>
    c.T % 1000 === 0 && c.S % 100_000 === 0 && c.n !== c.r && Math.abs(c.n - c.R) > 1e-9)
  if (!pool.length) return null
  const c = pick(pool)
  const model = tailModel(c.S, c.r, c.n, c.R)
  const startM = randInt(1, 12)
  const totalFor = (n) => tailTotal(c.S, c.r, n, c.R)
  return item({
    text: `15-го ${MONTH_NAMES[startM - 1]} в банке был взят кредит на ${rub(c.S)} на (n + 1) месяц. ` +
      `Условия его возврата таковы:\n` +
      `— 1-го числа каждого месяца долг возрастает на ${pct(c.r)} по сравнению с концом ` +
      `предыдущего месяца;\n` +
      `— со 2-го по 14-е число каждого месяца необходимо выплатить часть долга;\n` +
      `— 15-го числа каждого месяца с 1-го по n-й долг должен быть на одну и ту же сумму меньше ` +
      `долга на 15-е число предыдущего месяца;\n` +
      `— 15-го числа n-го месяца долг составит ${rub(c.R)};\n` +
      `— к 15-му числу (n + 1)-го месяца кредит должен быть полностью погашен.\n` +
      `Найдите n, если общая сумма выплат после погашения кредита составила ${rub(c.T)}.`,
    answer: `${months(c.n)}`,
    answerNum: c.n,
    model,
    mustMention: [c.S, c.r, c.R, c.T],
    extra: [...MONTH_EXTRA],
    forbid: [c.n],
    checks: [
      () => (Math.abs(totalFor(c.n) - c.T) < 0.005 ? null : "n не даёт заявленную сумму"),
      () => {
        for (let n = 2; n <= 60; n++) {
          if (n === c.n) continue
          if (Math.abs(totalFor(n) - c.T) < 0.5) return `n = ${n} тоже подходит`
        }
        return null
      },
    ],
  })
}

// ── 4. На сколько общая сумма превысит кредит (эталон 7.6) ─────────────────
export function t16TailOverpay() {
  const pool = tailCandidates().filter((c) => {
    const over = c.T - c.S
    return over > 0 && isMoney(over) && over % 1000 === 0 && c.S % 100_000 === 0
      && over !== c.R && over !== c.S && over !== c.T
  })
  if (!pool.length) return null
  const c = pick(pool)
  const over = Math.round((c.T - c.S) * 100) / 100
  const model = tailModel(c.S, c.r, c.n, c.R)
  const startM = randInt(1, 12)
  return item({
    text: tailPreamble(startM, c.n, ` на ${rub(c.S)}`, pct(c.r), "на одну и ту же сумму",
      tailRemainderLine(c.n, c.R)) +
      `На сколько рублей общая сумма выплат превысит сумму, взятую в кредит?`,
    answer: `${money(over)} рублей`,
    answerNum: over,
    model,
    mustMention: [c.S, c.r, c.R],
    extra: [...MONTH_EXTRA, c.n, c.n + 1],
    forbid: [over],
    checks: [
      () => (Math.abs(simulateCredit(model).total - c.S - over) < 0.005 ? null : "переплата ≠ ответу"),
    ],
  })
}

// ── 5. Размер k-го платежа по общей сумме (эталон 7.7) ─────────────────────
export function t16TailKthPayment() {
  const pool = tailCandidates().filter((c) => c.T % 1000 === 0 && c.n >= 14 && c.S % 100_000 === 0)
  if (!pool.length) return null
  const c = pick(pool)
  const k = randInt(5, c.n - 2)
  const V = c.pays[k - 1]
  if (!isMoney(V) || V % 100 !== 0 || V === c.R || V === c.S) return null
  const model = tailModel(c.S, c.r, c.n, c.R)
  const startM = randInt(1, 12)
  return item({
    text: tailPreamble(startM, c.n, ` на ${rub(c.S)}`, pct(c.r), "на одну и ту же сумму", "") +
      `Найдите размер ${k}-го платежа по кредиту, если общая сумма выплат равна ${rub(c.T)}.`,
    answer: `${money(V)} рублей`,
    answerNum: V,
    model,
    mustMention: [c.S, c.r, c.T, k],
    extra: [...MONTH_EXTRA, c.n, c.n + 1],
    forbid: [V],
    checks: [
      () => (Math.abs(simulateCredit(model).steps[k - 1].payment - V) < 0.005 ? null : "k-й платёж ≠ ответу"),
      () => (Math.abs(simulateCredit(model).total - c.T) < 0.005 ? null : "общая сумма ≠ данной"),
      // остаток R (а с ним и шаг) восстанавливается по общей сумме однозначно
      () => {
        for (let rk = 0; rk <= 20; rk++) {
          const R2 = rk * 50_000
          if (Math.abs(R2 - c.R) < 1e-9) continue
          if (Math.abs(tailTotal(c.S, c.r, c.n, R2) - c.T) < 0.5) return `остаток ${R2} тоже подходит`
        }
        return null
      },
    ],
  })
}

// ── 6. Величина ПОСЛЕДНЕЙ выплаты по общей сумме (эталон 7.8) ──────────────
export function t16TailLastPayment() {
  const pool = tailCandidates().filter((c) => {
    const last = c.R * (1 + c.r / 100)
    return c.T % 1000 === 0 && c.S % 100_000 === 0 && isMoney(last) && last % 100 === 0 && last !== c.S
  })
  if (!pool.length) return null
  const c = pick(pool)
  const last = Math.round(c.R * (1 + c.r / 100) * 100) / 100
  const model = tailModel(c.S, c.r, c.n, c.R)
  const startM = randInt(1, 12)
  return item({
    text: tailPreamble(startM, c.n, ` на ${rub(c.S)}`, pct(c.r), "на одну и ту же сумму", "") +
      `Найдите величину последней выплаты, если общая сумма выплат составила ${rub(c.T)}.`,
    answer: `${money(last)} рублей`,
    answerNum: last,
    model,
    mustMention: [c.S, c.r, c.T],
    extra: [...MONTH_EXTRA, c.n, c.n + 1],
    forbid: [last],
    checks: [
      () => (Math.abs(simulateCredit(model).steps[c.n].payment - last) < 0.005 ? null : "последняя выплата ≠ ответу"),
      () => (Math.abs(simulateCredit(model).total - c.T) < 0.005 ? null : "общая сумма ≠ данной"),
      () => {
        for (let rk = 0; rk <= 20; rk++) {
          const R2 = rk * 50_000
          if (Math.abs(R2 - c.R) < 1e-9) continue
          if (Math.abs(tailTotal(c.S, c.r, c.n, R2) - c.T) < 0.5) return `остаток ${R2} тоже подходит`
        }
        return null
      },
    ],
  })
}

// ── 7. Таблица с нерегулярным началом и равномерным хвостом (эталон 7.9) ───
// Долг задан таблицей: S, S−a₁, …, S−a_L (нерегулярно), далее равномерно вниз с шагом h
// до нуля. Общая сумма = S + x·(Σ голова + Σ хвост), где Σ хвост = T(T+h)/(2h), T = S−a_L.
// Уравнение на S КВАДРАТНОЕ — ответ находим перебором допустимой сетки, а не формулой.
export function t16TailTableQuadratic() {
  const HEADS = [
    [0, 0.3, 0.5, 1, 1.4, 1.7, 1.8],
    [0, 0.2, 0.5, 0.9, 1.2, 1.5],
    [0, 0.4, 0.6, 1, 1.5, 1.9, 2],
    [0, 0.3, 0.7, 1, 1.3],
  ]
  const cand = []
  for (const head of HEADS) {
    for (const p of [10, 20, 25]) {
      const x = p / 100, h = 0.1
      const L = head[head.length - 1]
      const totalFor = (S) => {
        const T = S - L
        if (T <= 0) return NaN
        const sumHead = sum(head.slice(0, -1).map((a) => S - a))
        return S + x * (sumHead + T * (T + h) / (2 * h))
      }
      const maxS = L + (30 - head.length) * h        // весь график должен уложиться в 30 лет
      for (let sk = Math.round((L + 0.3) * 10); sk <= Math.round(maxS * 10); sk++) {
        const S = sk / 10
        const T = totalFor(S)
        if (!Number.isFinite(T) || T > 30) continue
        if (Math.abs(T * 100 - Math.round(T * 100)) > 1e-9) continue
        cand.push({ head, p, h, S, T: Math.round(T * 100) / 100, totalFor })
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const L = c.head[c.head.length - 1]
  const y0 = randInt(2015, 2020)
  const yrs = c.head.map((_, i) => y0 + i)
  const debts = c.head.map((a) => (a === 0 ? "S" : `S ${MINUS} ${dec(a)}`))
  const tbl = tableBlock([
    ["Год", ...yrs, "…", "…", "…"],
    ["Долг (млн руб.)", ...debts, "…", dec(c.h), "0"],
  ])
  // полный график долга для симуляции: голова + равномерный хвост до нуля
  const debtsNum = c.head.map((a) => Math.round((c.S - a) / c.h))   // в целых шагах h
  for (let v = debtsNum[debtsNum.length - 1] - 1; v >= 0; v--) debtsNum.push(v)
  const debtsMln = debtsNum.map((v) => Math.round(v * c.h * 100) / 100)
  const model = {
    type: "credit", S: c.S, ratePct: c.p, unit: "mln", periodUnit: "year",
    payments: debtsMln.slice(1).map((v, i) => debtsMln[i] + debtsMln[i] * c.p / 100 - v),
  }
  const pr = pick(NAME_ALL)
  return item({
    text: `${pr.n} ${took(pr)} кредит 1 марта ${y0} года на сумму S млн рублей. Условия возврата таковы:\n` +
      `— 15 апреля каждого года долг увеличивается на ${pct(c.p)} по сравнению с началом года;\n` +
      `— с 1 июня по 1 июля необходимо выплатить часть долга;\n` +
      `— 1 апреля каждого года долг должен составлять часть кредита в соответствии со следующей ` +
      `таблицей:\n${tbl}\n` +
      `Начиная с ${yrs[yrs.length - 1]} года долг равномерно уменьшается на ${rub(c.h * 1e6)} в год. ` +
      `Определите сумму кредита, если сумма выплат равна ${dec(c.T)} млн рублей.`,
    answer: `${dec(c.S)} млн рублей`,
    answerNum: c.S,
    model,
    sim: () => simulateCredit(model),
    mustMention: [c.p, c.T],
    extra: [1, 15, y0, ...yrs, ...c.head.filter((a) => a > 0), c.h, c.h * 1e6, 0, 6, 7, 4],
    forbid: [c.S],
    checks: [
      () => (Math.abs(simulateCredit(model).total - c.T) < 1e-6 ? null : "симуляция ≠ заявленной сумме"),
      // единственность: перебираем ВСЮ допустимую сетку значений S (шаг 0,1 млн)
      () => {
        for (let sk = Math.round((L + 0.1) * 10); sk <= 600; sk++) {
          const S2 = sk / 10
          if (Math.abs(S2 - c.S) < 1e-9) continue
          if (Math.abs(c.totalFor(S2) - c.T) < 1e-6) return `S = ${S2} тоже подходит`
        }
        return null
      },
    ],
  })
}

// Ответ не должен совпадать ни с одним числом-данным условия — иначе решение
// «угадывается» из текста и verify16 (forbid) справедливо это забракует.
const noClash = (ans, data) => !data.some((x) => Math.abs(x - ans) < 1e-9)

// ═══════════════════════════════════════════════════════════════════════════
//  РАЗДЕЛ 8. ОПТИМИЗАЦИЯ (файл «Задачи № 16 (Оптимизация).docx»)
// ═══════════════════════════════════════════════════════════════════════════
//
// Здесь нет периодов, поэтому вместо симуляции долга «вторая реализация» — ПОЛНЫЙ
// перебор допустимой сетки: verify16 требует, чтобы максимум/минимум достигался
// ровно в заявленной точке и больше нигде.

// ── 1. Два завода, разные технологии, одна ставка → МИНИМУМ затрат ─────────
// Завод i: t² часов → aᵢ·t единиц ⇒ на xᵢ единиц нужно xᵢ²/aᵢ² часов.
// min w(x₁²/a² + x₂²/b²) при x₁+x₂ = N достигается при xᵢ ∝ aᵢ², минимум = w·N²/(a²+b²).
// При N = k(a²+b²) оптимум x₁ = k·a², x₂ = k·b², часы k·a и k·b — всё целое.
export function t16OptTwoPlantsMinCost() {
  const PAIRS = [[2, 5], [3, 4], [2, 3], [1, 2], [3, 5], [4, 5], [2, 7], [1, 3]]
  const cand = []
  for (const [a, b] of PAIRS) {
    const s2 = a * a + b * b
    for (const w of [200, 250, 300, 400, 500]) {
      for (let k = 2; k <= 40; k++) {
        const N = k * s2, cost = w * k * k * s2
        if (N < 30 || N > 3000 || cost > 60_000_000) continue
        if (!noClash(cost, [a, b, w, N])) continue
        cand.push({ a, b, w, k, N, cost })
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const pr = pick(NAME_ALL)
  const costOf = (x1) => c.w * (x1 * x1 / (c.a * c.a) + (c.N - x1) * (c.N - x1) / (c.b * c.b))
  return item({
    text: `${pr.n} является ${pr.f ? "владелицей" : "владельцем"} двух заводов в разных городах. ` +
      `На заводах производятся абсолютно одинаковые товары, но на заводе, расположенном во втором ` +
      `городе, используется более совершенное оборудование. В результате, если рабочие на заводе, ` +
      `расположенном в первом городе, трудятся суммарно t² часов в неделю, то за эту неделю они ` +
      `производят ${c.a === 1 ? "" : c.a}t единиц товара; если рабочие на заводе, расположенном во втором городе, ` +
      `трудятся суммарно t² часов в неделю, то за эту неделю они производят ${c.b}t единиц товара. ` +
      `За каждый час работы (на каждом из заводов) ${pr.n} платит рабочему ${rub(c.w)}. ` +
      `${dative(pr.n)} нужно каждую неделю производить ${c.N} единиц товара. Какую наименьшую сумму придётся ` +
      `тратить еженедельно на оплату труда рабочих?`,
    answer: `${money(c.cost)} рублей`,
    answerNum: c.cost,
    model: { type: "optimize", a: c.a, b: c.b, w: c.w, N: c.N },
    sim: () => ({ steps: [], value: c.cost }),
    // при коэффициенте 1 в тексте стоит просто «t» — единица становится служебным числом
    mustMention: [c.w, c.N, ...(c.a === 1 ? [] : [c.a]), ...(c.b === 1 ? [] : [c.b])],
    extra: [1],
    forbid: [c.cost],
    checks: [
      // перебор ВСЕЙ допустимой сетки: минимум достигается только в заявленной точке
      () => {
        const opt = c.k * c.a * c.a
        for (let x1 = 0; x1 <= c.N; x1++) {
          if (x1 === opt) continue
          if (costOf(x1) < c.cost - 1e-6) return `дешевле при x₁ = ${x1}: ${costOf(x1)}`
        }
        return Math.abs(costOf(opt) - c.cost) < 1e-6 ? null : "минимум ≠ ответу"
      },
    ],
  })
}

// ── 2. Два завода, одинаковая технология, разные ставки → МИНИМУМ затрат ───
// На x единиц нужно x² часов. min(w₁x₁² + w₂x₂²) при x₁+x₂ = N равен N²·w₁w₂/(w₁+w₂).
export function t16OptTwoRatesMinCost() {
  const cand = []
  const WS = [[500, 200], [250, 200], [300, 200], [400, 100], [600, 300], [500, 300], [800, 200]]
  for (const [w1, w2] of WS) {
    const W = w1 + w2
    for (let N = 20; N <= 400; N += 10) {
      const x1 = N * w2 / W, x2 = N * w1 / W
      if (!Number.isInteger(x1) || !Number.isInteger(x2)) continue
      const cost = w1 * x1 * x1 + w2 * x2 * x2
      if (!Number.isInteger(cost) || cost > 60_000_000 || cost < 100_000) continue
      if (!noClash(cost, [w1, w2, N])) continue
      cand.push({ w1, w2, N, x1, cost })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const pr = pick(NAME_ALL)
  const costOf = (x1) => c.w1 * x1 * x1 + c.w2 * (c.N - x1) * (c.N - x1)
  return item({
    text: `${pr.n} является ${pr.f ? "владелицей" : "владельцем"} двух заводов в разных городах. ` +
      `На заводах производятся абсолютно одинаковые товары при использовании одинаковых технологий. ` +
      `Если рабочие на одном из заводов трудятся суммарно t² часов в неделю, то за эту неделю они ` +
      `производят t единиц товара. За каждый час работы на заводе, расположенном в первом городе, ` +
      `${pr.n} платит рабочему ${rub(c.w1)}, а на заводе, расположенном во втором городе, — ` +
      `${rub(c.w2)}. ${pr.n} нужно каждую неделю производить ${c.N} единиц товара. Какую наименьшую ` +
      `сумму придётся тратить еженедельно на оплату труда рабочих?`,
    answer: `${money(c.cost)} рублей`,
    answerNum: c.cost,
    model: { type: "optimize", w1: c.w1, w2: c.w2, N: c.N },
    sim: () => ({ steps: [], value: c.cost }),
    mustMention: [c.w1, c.w2, c.N],
    extra: [],
    forbid: [c.cost],
    checks: [
      () => {
        for (let x1 = 0; x1 <= c.N; x1++) {
          if (x1 === c.x1) continue
          if (costOf(x1) < c.cost - 1e-6) return `дешевле при x₁ = ${x1}`
        }
        return Math.abs(costOf(c.x1) - c.cost) < 1e-6 ? null : "минимум ≠ ответу"
      },
    ],
  })
}

// ── 3. Два завода, разные технологии, бюджет → МАКСИМУМ выпуска ────────────
// Часов всего H = B/w; max(x₁+x₂) при x₁²/a² + x₂²/b² = H равен √((a²+b²)H).
// При H = (a²+b²)k² оптимум x₁ = a²k, x₂ = b²k, ответ (a²+b²)k — всё целое.
export function t16OptTwoPlantsMaxOutput() {
  const PAIRS = [[2, 5], [3, 4], [2, 3], [1, 2], [3, 5], [4, 5], [1, 3]]
  const cand = []
  for (const [a, b] of PAIRS) {
    const s2 = a * a + b * b
    for (const w of [200, 250, 300, 400, 500]) {
      for (let k = 2; k <= 40; k++) {
        const B = w * s2 * k * k, out = s2 * k
        if (B < 200_000 || B > 60_000_000 || B % 10_000 !== 0) continue
        if (out < 30 || out > 3000) continue
        if (!noClash(out, [a, b, w, B])) continue
        cand.push({ a, b, w, k, B, out })
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const pr = pick(NAME_ALL)
  const hours = c.B / c.w
  const feasible = (x1, x2) => x1 * x1 / (c.a * c.a) + x2 * x2 / (c.b * c.b) <= hours + 1e-9
  return item({
    text: `${pr.n} является ${pr.f ? "владелицей" : "владельцем"} двух заводов в разных городах. ` +
      `На заводах производятся абсолютно одинаковые товары, но на заводе, расположенном во втором ` +
      `городе, используется более совершенное оборудование. В результате, если рабочие на заводе, ` +
      `расположенном в первом городе, трудятся суммарно t² часов в неделю, то за эту неделю они ` +
      `производят ${c.a === 1 ? "" : c.a}t единиц товара; если рабочие на заводе, расположенном во втором городе, ` +
      `трудятся суммарно t² часов в неделю, то за эту неделю они производят ${c.b}t единиц товара. ` +
      `За каждый час работы (на каждом из заводов) ${pr.n} платит рабочему ${rub(c.w)}. ` +
      `${pr.n} ${pr.f ? "готова" : "готов"} выделять ${rub(c.B)} в неделю на оплату труда рабочих. ` +
      `Какое наибольшее количество единиц товара можно произвести за неделю на этих двух заводах?`,
    answer: `${money(c.out)} единиц товара`,
    answerNum: c.out,
    model: { type: "optimize", a: c.a, b: c.b, w: c.w, B: c.B },
    sim: () => ({ steps: [], value: c.out }),
    mustMention: [c.w, c.B, ...(c.a === 1 ? [] : [c.a]), ...(c.b === 1 ? [] : [c.b])],
    extra: [1],
    forbid: [c.out],
    checks: [
      // ответ достижим и превзойти его нельзя ни при каком целом делении выпуска
      () => (feasible(c.a * c.a * c.k, c.b * c.b * c.k) ? null : "заявленный выпуск недостижим"),
      () => {
        for (let x1 = 0; x1 <= c.out + 1; x1++) {
          const x2 = c.out + 1 - x1
          if (x2 < 0) break
          if (feasible(x1, x2)) return `достижим выпуск ${c.out + 1} при x₁ = ${x1}`
        }
        return null
      },
    ],
  })
}

// ── 4. Одинаковая технология, разные ставки, бюджет → МАКСИМУМ выпуска ─────
// w₁x₁² + w₂x₂² = B; оптимум x₁ = w₂t, x₂ = w₁t, где t = √(B/(w₁w₂(w₁+w₂))).
export function t16OptTwoRatesMaxOutput() {
  const cand = []
  const WS = [[250, 200], [500, 200], [300, 200], [400, 100], [600, 300], [500, 300]]
  for (const [w1, w2] of WS) {
    const W = w1 + w2
    for (let d = 1; d <= 50; d++) {
      const t = d / 10
      const x1 = w2 * t, x2 = w1 * t
      if (!Number.isInteger(x1) || !Number.isInteger(x2)) continue
      const B = w1 * x1 * x1 + w2 * x2 * x2
      if (!Number.isInteger(B) || B < 100_000 || B > 60_000_000 || B % 10_000 !== 0) continue
      const out = Math.round(W * t)
      if (out < 20 || out > 2000) continue
      if (!noClash(out, [w1, w2, B])) continue
      cand.push({ w1, w2, B, out, x1 })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const pr = pick(NAME_ALL)
  const feasible = (x1, x2) => c.w1 * x1 * x1 + c.w2 * x2 * x2 <= c.B + 1e-9
  return item({
    text: `${pr.n} является ${pr.f ? "владелицей" : "владельцем"} двух заводов в разных городах. ` +
      `На заводах производятся абсолютно одинаковые товары при использовании одинаковых технологий. ` +
      `Если рабочие на одном из заводов трудятся суммарно t² часов в неделю, то за эту неделю они ` +
      `производят t единиц товара. За каждый час работы на заводе, расположенном в первом городе, ` +
      `${pr.n} платит рабочему ${rub(c.w1)}, а на заводе, расположенном во втором городе, — ` +
      `${rub(c.w2)}. ${pr.n} ${pr.f ? "готова" : "готов"} выделять ${rub(c.B)} в неделю на оплату ` +
      `труда рабочих. Какое наибольшее количество единиц товара можно произвести за неделю ` +
      `на этих двух заводах?`,
    answer: `${money(c.out)} единиц товара`,
    answerNum: c.out,
    model: { type: "optimize", w1: c.w1, w2: c.w2, B: c.B },
    sim: () => ({ steps: [], value: c.out }),
    mustMention: [c.w1, c.w2, c.B],
    extra: [],
    forbid: [c.out],
    checks: [
      () => (feasible(c.x1, c.out - c.x1) ? null : "заявленный выпуск недостижим"),
      () => {
        for (let x1 = 0; x1 <= c.out + 1; x1++) {
          const x2 = c.out + 1 - x1
          if (x2 < 0) break
          if (feasible(x1, x2)) return `достижим выпуск ${c.out + 1} при x₁ = ${x1}`
        }
        return null
      },
    ],
  })
}

// ── 5. Наименьшая цена p, при которой завод окупится за Y лет ──────────────
// Прибыль за год = px − (0,5x² + bx + c); максимум по x равен (p−b)²/2 − c.
// Условие Y·[(p−b)²/2 − c] ≥ C ⇒ наименьшее целое p.
export function t16OptFactoryMinPrice() {
  const cand = []
  for (let b = 1; b <= 4; b++) {
    for (let cc = 4; cc <= 12; cc++) {
      for (const Y of [3, 4, 5, 6]) {
        for (let p = b + 4; p <= b + 20; p++) {
          const lo = Y * (Math.pow(p - 1 - b, 2) / 2 - cc)
          const hi = Y * (Math.pow(p - b, 2) / 2 - cc)
          if (lo <= 0) continue
          for (let C = Math.ceil(lo); C <= Math.floor(hi); C++) {
            if (C - lo < 0.4 || hi - C < 0.4) continue
            if (C < 20 || C > 400) continue
            if (!noClash(p, [C, b, cc, Y, 0.5])) continue
            cand.push({ b, c: cc, Y, p, C })
          }
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const profit = (p) => Math.pow(p - c.b, 2) / 2 - c.c
  const bTerm = c.b === 1 ? "x" : `${c.b}x`
  return item({
    text: `Строительство нового завода стоит ${c.C} млн рублей. Затраты на производство x тыс. единиц ` +
      `продукции на таком заводе равны 0,5x² + ${bTerm} + ${c.c} млн рублей в год. Если продукцию ` +
      `завода продать по цене p тыс. рублей за единицу, то прибыль фирмы (в млн рублей) за один год ` +
      `составит px − (0,5x² + ${bTerm} + ${c.c}). Когда завод будет построен, фирма будет выпускать ` +
      `продукцию в таком количестве, чтобы прибыль была наибольшей. При каком наименьшем значении p ` +
      `строительство завода окупится не более чем за ${years(c.Y)}?`,
    answer: `${c.p} тыс. рублей за единицу`,
    answerNum: c.p,
    model: { type: "optimize", C: c.C, b: c.b, c: c.c, Y: c.Y },
    sim: () => ({ steps: [], value: c.p }),
    mustMention: [c.C, c.c, c.Y, ...(c.b === 1 ? [] : [c.b])],
    extra: [0.5, ...(c.b === 1 ? [1] : [])],
    forbid: [c.p],
    checks: [
      () => (c.Y * profit(c.p) >= c.C ? null : `p = ${c.p} не окупает завод`),
      () => (c.Y * profit(c.p - 1) < c.C ? null : `p = ${c.p - 1} тоже подходит`),
      // максимум годовой прибыли действительно равен (p−b)²/2 − c — проверяем сеткой по x
      () => {
        const best = profit(c.p)
        for (let x = 0; x <= 400; x += 0.05) {
          const v = c.p * x - (0.5 * x * x + c.b * x + c.c)
          if (v > best + 1e-6) return `при x = ${x} прибыль больше максимума`
        }
        return null
      },
    ],
  })
}

// ── 6. За сколько лет окупится при растущей цене ───────────────────────────
// Цена в год j равна p₀ + (j−1); годовая прибыль (p−b)²/2 − c; ищем наименьшее k.
export function t16OptFactoryPaybackYears() {
  const cand = []
  for (let b = 1; b <= 4; b++) {
    for (let cc = 4; cc <= 12; cc++) {
      for (let p0 = b + 5; p0 <= b + 14; p0++) {
        let acc = 0
        for (let k = 1; k <= 8; k++) {
          acc += Math.pow(p0 + k - 1 - b, 2) / 2 - cc
          if (k < 3) continue
          if (Math.abs(acc * 2 - Math.round(acc * 2)) > 1e-9) continue
          const C = Math.round(acc * 2) / 2
          if (C < 40 || C > 500 || !Number.isInteger(C)) continue
          if (!noClash(k, [C, b, cc, p0, 0.5, 1])) continue
          cand.push({ b, c: cc, p0, k, C })
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const cum = (k) => {
    let s = 0
    for (let j = 0; j < k; j++) s += Math.pow(c.p0 + j - c.b, 2) / 2 - c.c
    return s
  }
  const bTerm = c.b === 1 ? "x" : `${c.b}x`
  return item({
    text: `Строительство нового завода стоит ${c.C} млн рублей. Затраты на производство x тыс. единиц ` +
      `продукции на таком заводе равны 0,5x² + ${bTerm} + ${c.c} млн рублей в год. Если продукцию ` +
      `завода продать по цене p тыс. рублей за единицу, то прибыль фирмы (в млн рублей) за один год ` +
      `составит px − (0,5x² + ${bTerm} + ${c.c}). Когда завод будет построен, фирма будет выпускать ` +
      `продукцию в таком количестве, чтобы прибыль была наибольшей. При этом в первый год p = ${c.p0}, ` +
      `а далее каждый год возрастает на 1. За сколько лет окупится строительство?`,
    answer: `${years(c.k)}`,
    answerNum: c.k,
    model: { type: "optimize", C: c.C, b: c.b, c: c.c, p0: c.p0 },
    sim: () => ({ steps: [], value: c.k }),
    mustMention: [c.C, c.c, c.p0, ...(c.b === 1 ? [] : [c.b])],
    extra: [0.5, 1],
    forbid: [c.k],
    checks: [
      () => (cum(c.k) >= c.C - 1e-9 ? null : `за ${c.k} лет не окупается`),
      () => (cum(c.k - 1) < c.C - 1e-9 ? null : `окупается уже за ${c.k - 1} лет`),
    ],
  })
}

// ── 7. Цену снизили, прибыль не изменилась → на сколько % поднять цену ─────
// Прибыль (P−c)(Qmax−P) − F симметрична относительно P* = (c+Qmax)/2. Если P и (1−d)P
// дают равную прибыль, то P(2−d) = c + Qmax, и ответ d/(2(1−d)) — не зависит от F.
export function t16OptPriceRaise() {
  const cand = []
  for (const d of [0.2, 0.5, 0.6]) {
    const ans = 100 * d / (2 * (1 - d))
    if (Math.abs(ans * 10 - Math.round(ans * 10)) > 1e-9) continue
    for (const Qmax of [10_000, 12_000, 15_000, 18_000, 20_000, 24_000]) {
      for (const cost of [2000, 2400, 3000, 3600, 4000, 5000, 6000]) {
        const P = (cost + Qmax) / (2 - d)
        if (!Number.isInteger(P) || P % 100 !== 0) continue
        if (P >= Qmax || P <= cost) continue
        const Pmin = Math.round(Qmax / 15 / 100) * 100
        if (P * (1 - d) <= Pmin) continue
        const ansR = Math.round(ans * 10) / 10
        if (!noClash(ansR, [Qmax, cost, Pmin, d * 100])) continue
        for (const F of [4_000_000, 5_000_000, 6_000_000, 8_000_000]) {
          cand.push({ d, Qmax, cost, F, P, Pmin, ans: ansR })
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const profit = (P) => P * (c.Qmax - P) - c.cost * (c.Qmax - P) - c.F
  const opt = (c.cost + c.Qmax) / 2
  return item({
    text: `Зависимость объёма Q (в шт.) купленного у фирмы товара от цены P (в руб. за шт.) ` +
      `выражается формулой Q = ${money(c.Qmax)} − P, где ${money(c.Pmin)} ≤ P ≤ ${money(c.Qmax)}. ` +
      `Доход от продажи товара составляет PQ рублей. Затраты на производство Q единиц товара ` +
      `составляют ${money(c.cost)}Q + ${money(c.F)} рублей. Прибыль равна разности дохода от продажи ` +
      `товара и затрат на его производство. Стремясь привлечь внимание покупателей, фирма уменьшила ` +
      `цену товара на ${pct(c.d * 100)}, однако её прибыль не изменилась. На сколько процентов следует ` +
      `увеличить сниженную цену, чтобы добиться наибольшей прибыли?`,
    answer: `${pct(c.ans)}`,
    answerNum: c.ans,
    model: { type: "optimize", Qmax: c.Qmax, cost: c.cost, F: c.F, P: c.P },
    sim: () => ({ steps: [], value: c.ans }),
    mustMention: [c.Qmax, c.Pmin, c.cost, c.F, c.d * 100],
    extra: [],
    forbid: [c.ans],
    checks: [
      () => (Math.abs(profit(c.P) - profit(c.P * (1 - c.d))) < 1e-6 ? null : "прибыль изменилась после скидки"),
      // максимум прибыли — перебор всей допустимой сетки цен
      () => {
        let best = -Infinity, arg = null
        for (let P = c.Pmin; P <= c.Qmax; P++) {
          const v = profit(P)
          if (v > best + 1e-9) { best = v; arg = P }
        }
        if (arg !== opt) return `максимум прибыли при P = ${arg}, а не ${opt}`
        const raise = 100 * (opt - c.P * (1 - c.d)) / (c.P * (1 - c.d))
        return Math.abs(raise - c.ans) < 1e-6 ? null : `подъём цены ${raise} ≠ ответу`
      },
    ],
  })
}

// ── 8. При каком налоге t сборы государства максимальны ────────────────────
// Прибыль (P − cost − t)(Qmax − P) − F ⇒ Q* = (Qmax − cost − t)/2;
// сборы t·Q* максимальны при t = (Qmax − cost)/2.
export function t16OptTaxMax() {
  const cand = []
  for (const Qmax of [16_000, 18_000, 20_000, 24_000, 30_000]) {
    for (const cost of [4000, 5000, 6000, 8000, 10_000]) {
      if (cost >= Qmax) continue
      const t = (Qmax - cost) / 2
      if (!Number.isInteger(t) || t % 500 !== 0) continue
      const cap = Math.ceil((t + 1000) / 1000) * 1000
      if (cap <= t) continue
      if (!noClash(t, [Qmax, cost, cap, 0])) continue
      for (const F of [3_000_000, 4_000_000, 5_000_000]) cand.push({ Qmax, cost, F, t, cap })
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const taxes = (t) => t * Math.max(0, (c.Qmax - c.cost - t) / 2)
  return item({
    text: `Зависимость количества Q (в шт., 0 ≤ Q ≤ ${money(c.Qmax)}) купленного у фирмы товара ` +
      `от цены P (в руб. за шт.) выражается формулой Q = ${money(c.Qmax)} − P. Затраты на производство ` +
      `Q единиц товара составляют ${money(c.cost)}Q + ${money(c.F)} рублей. Кроме затрат на ` +
      `производство, фирма должна платить налог t рублей (0 < t < ${money(c.cap)}) с каждой ` +
      `произведённой единицы товара. Таким образом, прибыль фирмы составляет ` +
      `PQ − ${money(c.cost)}Q − ${money(c.F)} − tQ рублей, а общая сумма налогов, собранных ` +
      `государством, равна tQ рублей. Фирма производит такое количество товара, при котором её ` +
      `прибыль максимальна. При каком значении t общая сумма налогов, собранных государством, ` +
      `будет максимальной?`,
    answer: `${money(c.t)} рублей`,
    answerNum: c.t,
    model: { type: "optimize", Qmax: c.Qmax, cost: c.cost, F: c.F },
    sim: () => ({ steps: [], value: c.t }),
    mustMention: [c.Qmax, c.cost, c.F, c.cap, 0],
    extra: [],
    forbid: [c.t],
    checks: [
      () => {
        let best = -Infinity, arg = null
        for (let t = 1; t < c.cap; t++) {
          const v = taxes(t)
          if (v > best + 1e-9) { best = v; arg = t }
        }
        return arg === c.t ? null : `максимум налогов при t = ${arg}, а не ${c.t}`
      },
    ],
  })
}

// ── 9. Два региона: доходы на душу сравнялись → найти k ────────────────────
// D₁(1+p)³ = D₂·((1+q)/(1+k))³. Строим от ответа: D₁ = D₂·m³, тогда
// (1+q)/(1+k) = m(1+p), и k подбирается вместе с q так, чтобы оба были целыми %.
export function t16OptRegionsGrowth() {
  const cand = []
  for (const m of [0.8, 0.9, 1.1, 1.2, 0.75, 1.25]) {
    for (const D2 of [40_000, 50_000, 60_000, 80_000, 100_000]) {
      const D1 = D2 * m * m * m
      if (!Number.isInteger(D1) || D1 < 10_000) continue
      for (let p = 10; p <= 30; p++) {
        for (let k = 2; k <= 12; k++) {
          const q = (1 + k / 100) * m * (1 + p / 100) - 1
          const qp = q * 100
          if (Math.abs(qp - Math.round(qp)) > 1e-9) continue
          if (qp < 5 || qp > 40 || Math.round(qp) === p || Math.round(qp) === k) continue
          cand.push({ D1, D2, p, k, q: Math.round(qp) })
        }
      }
    }
  }
  if (!cand.length) return null
  const c = pick(cand)
  const y0 = randInt(2012, 2020)
  const perCap1 = c.D1 * Math.pow(1 + c.p / 100, 3)
  const perCap2 = (k) => c.D2 * Math.pow((1 + c.q / 100) / (1 + k / 100), 3)
  return item({
    text: `В первом регионе среднемесячный доход на душу населения в ${y0} г. составлял ${rub(c.D1)} ` +
      `и ежегодно увеличивался на ${pct(c.p)}. Во втором регионе среднемесячный доход на душу ` +
      `населения в ${y0} г. составлял ${rub(c.D2)}. В течение трёх лет суммарный доход жителей ` +
      `второго региона увеличивался на ${pct(c.q)} ежегодно, а население увеличивалось на k % ` +
      `ежегодно. В ${y0 + 3} г. среднемесячные доходы на душу населения в первом и втором регионах ` +
      `сравнялись. Найдите k.`,
    answer: `${pct(c.k)}`,
    answerNum: c.k,
    model: { type: "optimize", D1: c.D1, D2: c.D2, p: c.p, q: c.q },
    sim: () => ({ steps: [], value: c.k }),
    mustMention: [c.D1, c.D2, c.p, c.q],
    extra: [y0, y0 + 3],
    forbid: [c.k],
    checks: [
      () => (Math.abs(perCap1 - perCap2(c.k)) < 1e-6 ? null : "доходы не сравнялись"),
      () => {
        for (let k = 1; k <= 60; k++) {
          if (k === c.k) continue
          if (Math.abs(perCap1 - perCap2(k)) < 1e-4) return `k = ${k} тоже подходит`
        }
        return null
      },
    ],
  })
}

// ── 10–11. Пенсионный фонд: при каких r продавать надо ровно в конце года t₀ ──
// Сумма к концу года T равна f(t)·(1+r)^(T−t); максимум ровно в t₀ ⟺
//   f(t₀)/f(t₀−1) > 1+r > f(t₀+1)/f(t₀)   (отношение f(t+1)/f(t) убывает ⇒ унимодальность).
// Ответ — ПРОМЕЖУТОК; границы выписываем точными дробями, как в эталоне.
function t16FundRate(kind) {
  const T = randInt(18, 25)
  const t0 = randInt(kind === "sq" ? 9 : 5, T - 2)
  const f = kind === "sq" ? (t) => t * t : (t) => 10 * t
  const lowNum = kind === "sq" ? 2 * t0 + 1 : 1               // f(t₀+1)/f(t₀) − 1
  const lowDen = kind === "sq" ? t0 * t0 : t0
  const hiNum = kind === "sq" ? 2 * t0 - 1 : 1                // f(t₀)/f(t₀−1) − 1
  const hiDen = kind === "sq" ? (t0 - 1) * (t0 - 1) : t0 - 1
  const gL = gcd(lowNum, lowDen), gH = gcd(hiNum, hiDen)
  const lo = lowNum / lowDen, hi = hiNum / hiDen
  if (!(lo < hi) || hi > 0.25 || lo < 0.02) return null       // ставка должна быть реалистичной
  const priceText = kind === "sq" ? "t² тыс. рублей" : "10t тыс. рублей"
  const ordT = `${T}-го`, ordT0 = `${t0}-го`
  const frac = (n, d, g) => (d / g === 1 ? String(n / g) : `${n / g}/${d / g}`)
  return item({
    text: `Пенсионный фонд владеет ценными бумагами, которые стоят ${priceText} в конце года t ` +
      `(t = 1; 2; …). В конце любого года пенсионный фонд может продать ценные бумаги и положить ` +
      `деньги на счёт в банке, при этом в конце каждого следующего года сумма на счёте будет ` +
      `увеличиваться в 1 + r раз. Пенсионный фонд хочет продать ценные бумаги в конце такого года, ` +
      `чтобы в конце ${ordT} года сумма на его счёте была наибольшей. Расчёты показали, что для этого ` +
      `ценные бумаги нужно продавать строго в конце ${ordT0} года. При каких положительных значениях r ` +
      `это возможно?`,
    answer: `${frac(lowNum, lowDen, gL)} < r < ${frac(hiNum, hiDen, gH)}`,
    // ответ здесь — ПРОМЕЖУТОК (как в эталоне); числом для универсальных проверок
    // служит год продажи, а сам промежуток проверяют checks ниже.
    answerNum: t0,
    model: { type: "optimize", kind, t0, T },
    sim: () => ({ steps: [], value: lo }),
    mustMention: [1, 2],
    extra: [t0, T, 10],
    forbid: [],
    checks: [
      // внутри промежутка максимум ровно в t₀, вне — нет: перебор всей сетки лет
      () => {
        for (const r of [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1]) {
          let best = -Infinity, arg = null
          for (let t = 1; t <= T; t++) {
            const v = f(t) * Math.pow(1 + r, T - t)
            if (v > best * (1 + 1e-12)) { best = v; arg = t }
          }
          if (arg !== t0) return `при r = ${r} максимум в ${arg}, а не в ${t0}`
        }
        return null
      },
      () => {
        for (const r of [lo - 1e-4, hi + 1e-4]) {
          if (r <= 0) continue
          let best = -Infinity, arg = null
          for (let t = 1; t <= T; t++) {
            const v = f(t) * Math.pow(1 + r, T - t)
            if (v > best * (1 + 1e-12)) { best = v; arg = t }
          }
          if (arg === t0) return `вне промежутка (r = ${r}) максимум всё ещё в ${t0}`
        }
        return null
      },
    ],
  })
}
export const t16FundRateSquare = () => t16FundRate("sq")
export const t16FundRateLinear = () => t16FundRate("lin")

// ── 12–13. Пенсионный фонд: в конце какого года продавать при известном r ──
function t16FundYear(kind) {
  const r = pick(kind === "sq" ? [5, 8, 10, 12, 15] : [12, 15, 18, 24, 30])
  const f = kind === "sq" ? (t) => t * t : (t) => 10 * t
  const q = 1 + r / 100
  // argmax f(t)·q^(T−t) не зависит от T (пока t ≤ T), поэтому оптимум ищем один раз
  // на широком горизонте, а горизонт задачи выбираем ЗАВЕДОМО правее оптимума.
  let best = -Infinity, arg = null, ties = 0
  for (let t = 1; t <= 200; t++) {
    const v = f(t) * Math.pow(q, -t)
    if (v > best * (1 + 1e-12)) { best = v; arg = t; ties = 0 }
    else if (Math.abs(v - best) <= Math.abs(best) * 1e-12) ties++
  }
  if (ties || arg === 1 || arg > 40) return null
  const T = arg + randInt(1, 4)
  best = f(arg) * Math.pow(q, T - arg)
  const priceText = kind === "sq" ? "t² тыс. рублей" : "10t тыс. рублей"
  const ordT = `${T}-го`
  return item({
    text: `Пенсионный фонд владеет ценными бумагами, которые стоят ${priceText} в конце года t ` +
      `(t = 1; 2; …). В конце любого года пенсионный фонд может продать ценные бумаги и положить ` +
      `деньги на счёт в банке, при этом в конце каждого следующего года сумма на счёте будет ` +
      `увеличиваться на ${pct(r)}. В конце какого года пенсионному фонду следует продать ценные ` +
      `бумаги, чтобы в конце ${ordT} года сумма на его счёте была наибольшей?`,
    answer: `в конце ${arg}-го года`,
    answerNum: arg,
    model: { type: "optimize", kind, r, T },
    sim: () => ({ steps: [], value: arg }),
    mustMention: [r, 1, 2],
    extra: [T, 10],
    forbid: [],
    checks: [
      // перебор ВСЕЙ сетки лет: максимум единственный и достигается в arg
      () => {
        for (let t = 1; t <= T; t++) {
          if (t === arg) continue
          const v = f(t) * Math.pow(q, T - t)
          if (v >= best * (1 - 1e-12)) return `год ${t} даёт не меньшую сумму`
        }
        return null
      },
    ],
  })
}
export const t16FundYearSquare = () => t16FundYear("sq")
export const t16FundYearLinear = () => t16FundYear("lin")

// ═══════════════════════════════════════════════════════════════════════════
//  РЕЕСТР
// ═══════════════════════════════════════════════════════════════════════════
export const GEN16 = [
  t16AnnPayment, t16AnnPrincipal, t16AnnMinYears,
  t16AnnDiffTotal, t16RateTwoUnequal, t16RateTwoScenarios,
  t16DepMaxInitial, t16DepMinTopUp, t16DepTwoParams, t16DepTwoAccounts,
  t16DepCompareLastYear, t16DepCompareTwoYears,
  t16IntOnlyMinCredit, t16IntOnlyRate, t16IntOnlyTotal, t16GeomPayments,
  t16TblMaxRate, t16TblMaxSPayment, t16TblMinSTotal, t16TblOverpayPct,
  t16TblMaxSSpread, t16TblMinSInteger,
  t16DiffRateByOverpay, t16DiffTotalPct, t16DiffFirstK, t16DiffTotalByKth,
  t16DiffPrincipalByFirst, t16DiffPrincipalByLast, t16DiffRateByBounds,
  t16DiffTotalByMax, t16DiffTotalByMin, t16DiffTermByTotal,
  t16DiffPrincipalByTotal, t16DiffSecondYear,
  t16TailPrincipal, t16TailRate, t16TailMonths, t16TailOverpay,
  t16TailKthPayment, t16TailLastPayment, t16TailTableQuadratic,
  t16OptTwoPlantsMinCost, t16OptTwoRatesMinCost, t16OptTwoPlantsMaxOutput, t16OptTwoRatesMaxOutput,
  t16OptFactoryMinPrice, t16OptFactoryPaybackYears, t16OptPriceRaise, t16OptTaxMax,
  t16OptRegionsGrowth, t16FundRateSquare, t16FundRateLinear, t16FundYearSquare, t16FundYearLinear,
]

export const META16 = [
  ["Кредит равными (аннуитетными) платежами", [
    ["ann-payment", "Найти размер равного платежа", t16AnnPayment],
    ["ann-principal", "Найти сумму кредита по платежу", t16AnnPrincipal],
    ["ann-min-years", "Наименьший срок при лимите платежа", t16AnnMinYears],
    ["ann-diff-total", "На сколько меньше отдал бы за меньший срок", t16AnnDiffTotal],
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
  ["Дифференцированные платежи (долг убывает равномерно)", [
    ["dif-rate-overpay", "Ставка по переплате в процентах", t16DiffRateByOverpay],
    ["dif-total-pct", "Сколько процентов общая сумма от кредита", t16DiffTotalPct],
    ["dif-first-k", "Сумма выплат за первые K месяцев", t16DiffFirstK],
    ["dif-total-by-kth", "Общая сумма по известной k-й выплате", t16DiffTotalByKth],
    ["dif-s-by-first", "Кредит по сумме первых K выплат", t16DiffPrincipalByFirst],
    ["dif-s-by-last", "Кредит по сумме последних K выплат", t16DiffPrincipalByLast],
    ["dif-rate-bounds", "Ставка по границам наиб./наим. платежа", t16DiffRateByBounds],
    ["dif-total-by-max", "Общая сумма по наибольшему платежу", t16DiffTotalByMax],
    ["dif-total-by-min", "Общая сумма по наименьшему платежу", t16DiffTotalByMin],
    ["dif-term-by-total", "Срок по общей сумме выплат", t16DiffTermByTotal],
    ["dif-s-by-total", "Кредит по общей сумме выплат", t16DiffPrincipalByTotal],
    ["dif-second-year", "Сумма за второй год по сумме за первый", t16DiffSecondYear],
  ]],
  ["Дифференцированные платежи с дополнительным условием", [
    ["dtl-principal", "Кредит по общей сумме (шаг + хвостовой платёж)", t16TailPrincipal],
    ["dtl-rate", "Ставка по общей сумме (шаг + хвост)", t16TailRate],
    ["dtl-months", "Число месяцев n по общей сумме", t16TailMonths],
    ["dtl-overpay", "На сколько общая сумма превысит кредит", t16TailOverpay],
    ["dtl-kth", "Размер k-го платежа по общей сумме", t16TailKthPayment],
    ["dtl-last", "Величина последней выплаты по общей сумме", t16TailLastPayment],
    ["dtl-table", "Таблица: нерегулярное начало + равномерный хвост → S", t16TailTableQuadratic],
  ]],
  ["Оптимизация", [
    ["opt-plants-cost", "Два завода (разные технологии) → минимум затрат", t16OptTwoPlantsMinCost],
    ["opt-rates-cost", "Два завода (разные ставки) → минимум затрат", t16OptTwoRatesMinCost],
    ["opt-plants-out", "Два завода (разные технологии) → максимум выпуска", t16OptTwoPlantsMaxOutput],
    ["opt-rates-out", "Два завода (разные ставки) → максимум выпуска", t16OptTwoRatesMaxOutput],
    ["opt-min-price", "Наименьшая цена p для окупаемости за Y лет", t16OptFactoryMinPrice],
    ["opt-payback", "За сколько лет окупится при растущей цене", t16OptFactoryPaybackYears],
    ["opt-price-raise", "Цену снизили, прибыль та же → на сколько % поднять", t16OptPriceRaise],
    ["opt-tax", "При каком налоге t сборы максимальны", t16OptTaxMax],
    ["opt-regions", "Два региона: доходы сравнялись → найти k", t16OptRegionsGrowth],
    ["opt-fund-rate-sq", "Фонд, бумаги t²: при каких r продавать в конце t₀", t16FundRateSquare],
    ["opt-fund-rate-lin", "Фонд, бумаги 10t: при каких r продавать в конце t₀", t16FundRateLinear],
    ["opt-fund-year-sq", "Фонд, бумаги t², ставка дана → год продажи", t16FundYearSquare],
    ["opt-fund-year-lin", "Фонд, бумаги 10t, ставка дана → год продажи", t16FundYearLinear],
  ]],
]
