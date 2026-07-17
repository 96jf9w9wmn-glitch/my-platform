// Генераторы заданий по шаблонам ФИПИ.
//
// Каждый шаблон — это конкретный тип задания из открытого банка ФИПИ (та же тема,
// КЭС и формулировка), но с подставляемыми числами; правильный ответ вычисляется
// кодом, поэтому он гарантированно верный и не заимствует чужую разметку.
//
// Пока покрыт номер 10 ОГЭ (теория вероятностей, КЭС 8.2) — текстовые шаблоны.
// Задания с диаграммой Эйлера и деревом опыта требуют картинки (SVG) и будут
// добавлены отдельно.

import { STATEMENTS_19 } from "./statements19.js"
import { expandSvgMathTokens } from "../utils.js"
import { GENERATORS_INF, GEN_META_INF } from "./taskGeneratorsInf.js"
import { GENERATORS_ENG, GEN_META_ENG } from "./taskGeneratorsEng.js"
import { GENERATORS_RUS, GEN_META_RUS } from "./taskGeneratorsRus.js"
import { GENERATORS_CHEM, GEN_META_CHEM } from "./taskGeneratorsChem.js"
import { GENERATORS_OBSH, GEN_META_OBSH } from "./taskGeneratorsObsh.js"
import { GENERATORS_PHYS, GEN_META_PHYS } from "./taskGeneratorsPhys.js"
import { GENERATORS_HIST, GEN_META_HIST } from "./taskGeneratorsHist.js"
import { GENERATORS_BIO, GEN_META_BIO } from "./taskGeneratorsBio.js"
import { GENERATORS_LIT, GEN_META_LIT } from "./taskGeneratorsLit.js"
import { GENERATORS_GEO, GEN_META_GEO } from "./taskGeneratorsGeo.js"
import { GENERATORS_EGE_BASE, GEN_META_EGE_BASE } from "./taskGeneratorsEgeBase.js"
import { GENERATORS_EGE_PROF, GEN_META_EGE_PROF } from "./taskGeneratorsEgeProf.js"

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i);[a[i], a[j]] = [a[j], a[i]] } return a }
// Мат-токены (⟦f:⟧/⟦r:⟧/⟦b:⟧) в подписях чертежа renderTaskMath() разворачивает только в
// condition_text (HTML); в SVG они попадали сырьём («4[[r:2]]»). expandSvgMathTokens (utils.js)
// разворачивает их прямо в SVG-разметку <text> при кодировании в data-URL.
const svgToDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(expandSvgMathTokens(svg))}`

// Степень надстрочными цифрами (11 → "¹¹"): condition_text рендерится браузером
// (превью + html2canvas в PDF), поэтому Unicode-надстрочные выглядят как настоящие степени.
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻" }
const sup = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("")

// Математические токены в condition_text: дробь СТОЛБИКОМ и корень с чертой (не «в строчку»).
// Разворачиваются в HTML при выводе через renderTaskMath() (src/utils.js).
const fT = (n, d) => `⟦f:${n}:${d}⟧`
const rT = (x) => `⟦r:${x}⟧`
// Корень над дробью: √ с чертой, накрывающей всю дробь. Поля pre¦num¦den¦post.
const rfT = (num, den, post = "", pre = "") => `⟦rf:${pre}¦${num}¦${den}¦${post}⟧`
// Нижний индекс (t_C, t_F): токен ⟦b:x⟧ → <sub>. Unicode-подстрочных букв C/F нет,
// поэтому не символом; цифровые индексы (d₁, d₂) можно и Unicode-подстрочными.
const sub = (x) => `⟦b:${x}⟧`

// Знаменатели, при которых любая доля k/N — конечная десятичная дробь
// (2^a·5^b): удобно для «красивых» вероятностных ответов в стиле ФИПИ.
const CLEAN_N = [10, 20, 25, 40, 50, 100]

// Вероятность в формате ФИПИ: десятичная дробь через запятую, без хвостовых нулей.
function prob(favorable, total) {
  const s = (favorable / total).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
  return s.replace(".", ",")
}

// Согласование существительного/прилагательного с числом (рус.): [1, 2–4, 5+].
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

// Форма прилагательного женского рода по образцу ФИПИ («21 зелёная», «3 жёлтых»):
// оканчивается на 1 (кроме 11) → ед.ч. «-ая», иначе → род. мн. «-ых».
function femColor(n, sg, pl) {
  return (n % 10 === 1 && n % 100 !== 11) ? sg : pl
}

// ── Шаблоны ОГЭ №10 (КЭС 8.2) ───────────────────────────────────────────────

// Доля предмета одного цвета среди всех (чашки/маркеры/карандаши).
function tCups() {
  const N = pick(CLEAN_N)
  const red = randInt(1, N - 1)
  const blue = N - red
  return {
    condition_text:
      `У бабушки ${N} ${plural(N, "чашка", "чашки", "чашек")}: ${red} с красными ` +
      `цветами, остальные с синими. Бабушка наливает чай в случайно выбранную чашку. ` +
      `Найдите вероятность того, что это будет чашка с синими цветами.`,
    answer: prob(blue, N),
  }
}

function tMarkers() {
  const N = pick(CLEAN_N)
  const black = randInt(1, N - 1)
  const blue = N - black
  return {
    condition_text:
      `В коробке ${N} ${plural(N, "маркер", "маркера", "маркеров")}: ` +
      `${black} ${plural(black, "чёрный", "чёрных", "чёрных")}, остальные синие. ` +
      `Из коробки берут случайный маркер. Найдите вероятность того, что он окажется синим.`,
    answer: prob(blue, N),
  }
}

function tPencils() {
  const N = pick(CLEAN_N)
  const yellow = randInt(1, N - 1)
  const green = N - yellow
  return {
    condition_text:
      `В пенале ${N} ${plural(N, "карандаш", "карандаша", "карандашей")}: ` +
      `${yellow} ${plural(yellow, "жёлтый", "жёлтых", "жёлтых")}, остальные зелёные. ` +
      `Из пенала наугад достают один карандаш. Найдите вероятность того, что он окажется зелёным.`,
    answer: prob(green, N),
  }
}

// Выученные билеты.
function tTickets() {
  const N = pick(CLEAN_N)
  const notLearned = randInt(1, N - 1)
  const learned = N - notLearned
  const name = pick(["Оскар", "Яша", "Тимур", "Артём", "Кирилл", "Пётр"])
  return {
    condition_text:
      `На экзамене ${N} ${plural(N, "билет", "билета", "билетов")}, ${name} не выучил ` +
      `${notLearned} из них. Найдите вероятность того, что ему попадётся выученный билет.`,
    answer: prob(learned, N),
  }
}

// Исправные фонарики.
function tFlashlights() {
  const N = pick(CLEAN_N)
  const broken = randInt(1, N - 1)
  const working = N - broken
  return {
    condition_text:
      `В среднем из ${N} карманных фонариков, поступивших в продажу, ${broken} ` +
      `${plural(broken, "неисправный", "неисправных", "неисправных")}. Найдите вероятность ` +
      `того, что выбранный наудачу в магазине фонарик окажется исправным.`,
    answer: prob(working, N),
  }
}

// Ручка «пишет плохо» → вероятность, что пишет хорошо (1 − p).
function tPen() {
  const pBad = pick([0.01, 0.02, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2])
  const item = pick([
    ["новая шариковая ручка пишет плохо (или не пишет)", "эта ручка пишет хорошо"],
    ["купленный аккумулятор неисправен", "аккумулятор исправен"],
    ["новый чайник прослужит меньше года", "чайник прослужит не меньше года"],
  ])
  return {
    condition_text:
      `Вероятность того, что ${item[0]}, равна ${prob(pBad * 100, 100)}. Покупатель в ` +
      `магазине выбирает один такой товар. Найдите вероятность того, что ${item[1]}.`,
    answer: prob(Math.round((1 - pBad) * 100), 100),
  }
}

// Независимость: вероятность исхода при следующем броске монеты.
function tCoin() {
  const throws = pick([10, 20, 30, 40, 50])
  const heads = randInt(2, throws - 2)
  const nth = randInt(2, throws)
  const side = pick(["орёл", "решка"])
  return {
    condition_text:
      `Монету бросили ${throws} раз. Известно, что орёл выпал ${heads} ` +
      `${plural(heads, "раз", "раза", "раз")}. Найдите вероятность того, что при ` +
      `${nth}-м по счёту броске выпал${side === "орёл" ? "" : "а"} ${side}.`,
    answer: "0,5",
  }
}

// Классическое определение: K благоприятствуют из N равновозможных.
function tEqui() {
  const N = pick(CLEAN_N)
  const K = randInt(1, N - 1)
  return {
    condition_text:
      `В случайном опыте ${N} равновозможных элементарных событий, из которых ${K} ` +
      `благоприятствуют событию A. Найдите вероятность события A.`,
    answer: prob(K, N),
  }
}

// Такси: вероятность машины заданного цвета среди трёх цветов.
function tTaxi() {
  const N = pick([20, 25, 40, 50])
  const black = randInt(2, N - 4)
  const yellow = randInt(1, N - black - 2)
  const green = N - black - yellow
  return {
    condition_text:
      `В фирме такси в данный момент свободно ${N} машин: ` +
      `${black} ${femColor(black, "чёрная", "чёрных")}, ` +
      `${yellow} ${femColor(yellow, "жёлтая", "жёлтых")} и ` +
      `${green} ${femColor(green, "зелёная", "зелёных")}. По вызову выехала одна из машин, ` +
      `случайно оказавшаяся ближе всего к заказчику. Найдите вероятность того, что к нему ` +
      `приедет жёлтое такси.`,
    answer: prob(yellow, N),
  }
}

// Подарки распределяются случайно между детьми — доля подарков нужного вида.
function tGifts() {
  const N = pick([10, 20, 25, 50])
  const a = randInt(2, N - 2)                 // с машинами, остальные — с видами городов
  const kid = pick([["Витя", "Вите"], ["Петя", "Пете"], ["Коля", "Коле"], ["Дима", "Диме"], ["Игорь", "Игорю"]])
  return {
    condition_text:
      `Родительский комитет закупил ${N} ${plural(N, "пазл", "пазла", "пазлов")} для подарков детям ` +
      `в связи с окончанием учебного года, из них ${a} с машинами и ${N - a} с видами городов. ` +
      `Подарки распределяются случайным образом между ${N} детьми, среди которых есть ${kid[0]}. ` +
      `Найдите вероятность того, что ${kid[1]} достанется пазл с машиной.`,
    answer: prob(a, N),
  }
}

// Магазин, несколько цветов + «остальные X и Y поровну»: P(цвет1 или один из «остальных»).
function tPensMulti() {
  const N = pick([40, 50, 100, 200])
  let k1, k2, k3, rest
  do {
    k1 = randInt(10, 35); k2 = randInt(5, 25); k3 = randInt(5, 25)
    rest = N - k1 - k2 - k3
  } while (rest < 6 || rest % 2 !== 0)
  const half = rest / 2                        // синие = чёрные = rest/2
  return {
    condition_text:
      `В магазине канцтоваров продаётся ${N} ${plural(N, "ручка", "ручки", "ручек")}: ` +
      `${k1} ${femColor(k1, "красная", "красных")}, ${k2} ${femColor(k2, "зелёная", "зелёных")}, ` +
      `${k3} ${femColor(k3, "фиолетовая", "фиолетовых")}, остальные синие и чёрные, их поровну. ` +
      `Найдите вероятность того, что случайно выбранная в этом магазине ручка будет красной или синей.`,
    answer: prob(k1 + half, N),
  }
}

// Жеребьёвка старта: спортсмены из нескольких стран, P(первым стартует из данной страны).
function tSkiers() {
  const total = pick([10, 20, 25])
  const countries = shuffle([
    "России", "Норвегии", "Швеции", "Финляндии", "Германии", "Италии", "Австрии", "Франции",
  ]).slice(0, 3)
  const cap = Math.round(total * 0.7)          // без перекосов вроде 23/1/1 — как в реальных задачах
  let a, b, c
  do { a = randInt(1, total - 2); b = randInt(1, total - a - 1); c = total - a - b } while (c < 1 || Math.max(a, b, c) > cap)
  const cnt = [a, b, c]
  const sportsmen = (n) => plural(n, "спортсмен", "спортсмена", "спортсменов")
  const chosen = randInt(0, 2)
  return {
    condition_text:
      `В лыжных гонках участвуют ${a} ${sportsmen(a)} из ${countries[0]}, ${b} ${sportsmen(b)} ` +
      `из ${countries[1]} и ${c} ${sportsmen(c)} из ${countries[2]}. Порядок, в котором ` +
      `спортсмены стартуют, определяется жребием. Найдите вероятность того, что первым будет ` +
      `стартовать спортсмен из ${countries[chosen]}.`,
    answer: prob(cnt[chosen], total),
  }
}

// ── Точная рациональная арифметика (для номера 6) ────────────────────────────

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b] } return a || 1 }
function reduceFr(n, d) { if (d < 0) { n = -n; d = -d } const g = gcd(n, d); return [n / g, d / g] }
const rAdd = ([n1, d1], [n2, d2]) => reduceFr(n1 * d2 + n2 * d1, d1 * d2)
const rSub = ([n1, d1], [n2, d2]) => reduceFr(n1 * d2 - n2 * d1, d1 * d2)
const rMul = ([n1, d1], [n2, d2]) => reduceFr(n1 * n2, d1 * d2)
const rDiv = ([n1, d1], [n2, d2]) => reduceFr(n1 * d2, d1 * n2)
function terminating(d) { d = Math.abs(d); while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1 }

// Точное десятичное представление конечной дроби через запятую (без float-ошибок).
function decStr([n, d]) {
  ;[n, d] = reduceFr(n, d)
  const sign = n < 0 ? "-" : ""
  n = Math.abs(n)
  let intPart = Math.floor(n / d), rem = n % d
  if (rem === 0) return sign + intPart
  let frac = "", guard = 0
  while (rem !== 0 && guard < 25) { rem *= 10; frac += Math.floor(rem / d); rem %= d; guard++ }
  return sign + intPart + "," + frac
}

const SMOOTH_DEN = [2, 4, 5, 8, 10, 20, 25, 50]   // знаменатели с делителями только 2 и 5
// Числитель не кратен знаменателю → дробь никогда не выглядит как целое (5/5, 4/2, 100/50).
const randFrac = () => {
  const d = pick(SMOOTH_DEN)
  let n
  do { n = randInt(1, d * 2) } while (n % d === 0)
  return [n, d]
}
// Десятичное с одним знаком после запятой как дробь [n,10].
const randDec1 = (min = 11, max = 99) => [randInt(min, max), 10]
const decLit = ([n, d]) => decStr([n, d])   // "6,9"

// ── Шаблоны ОГЭ №6 (КЭС 1.2 — вычисления) ────────────────────────────────────

// Дробь [n,d] стоячим токеном в тексте условия.
const fFrac = ([n, d]) => fT(n, d)

function tFracAddSub() {
  const a = randFrac(), b = randFrac()
  const plus = Math.random() < 0.5
  const res = plus ? rAdd(a, b) : rSub(a, b)
  return {
    condition_text: `Найдите значение выражения ${fFrac(a)} ${plus ? "+" : "−"} ${fFrac(b)}.`,
    answer: decStr(res).replace(".", ","),
  }
}

function tFracMul() {
  const a = randFrac(), b = randFrac()
  return {
    condition_text: `Найдите значение выражения ${fFrac(a)} · ${fFrac(b)}.`,
    answer: decStr(rMul(a, b)).replace(".", ","),
  }
}

function tFracDiv() {
  let a, b, res
  do { a = randFrac(); b = randFrac(); res = rDiv(a, b) } while (!terminating(res[1]))
  return {
    condition_text: `Найдите значение выражения ${fFrac(a)} : ${fFrac(b)}.`,
    answer: decStr(res).replace(".", ","),
  }
}

function tDecAddSub() {
  const a = randDec1(), b = randDec1()
  const plus = Math.random() < 0.5
  const res = plus ? rAdd(a, b) : rSub(a, b)
  return {
    condition_text: `Найдите значение выражения ${decLit(a)} ${plus ? "+" : "−"} ${decLit(b)}.`,
    answer: decStr(res).replace(".", ","),
  }
}

function tDecMul() {
  const a = randDec1(11, 99), b = randDec1(11, 99)
  return {
    condition_text: `Найдите значение выражения ${decLit(a)} · ${decLit(b)}.`,
    answer: decStr(rMul(a, b)).replace(".", ","),
  }
}

function tDecDiv() {
  // Строим так, чтобы частное было целым: делимое = ответ · делитель.
  const divisor = randDec1(11, 49)          // напр. 1,6
  const q = randInt(2, 9)                    // целый ответ
  const dividend = rMul([q, 1], divisor)     // 1 знак после запятой
  return {
    condition_text: `Найдите значение выражения ${decLit(dividend)} : ${decLit(divisor)}.`,
    answer: String(q),
  }
}

// №6. Вложенная обратная величина 1/(1/a + 1/b) = ab/(a+b). Банк: 1/(1/30+1/42)=17,5. (КЭС 1.2)
function t6Reciprocal() {
  let a, b, res
  do { a = randInt(2, 60); b = randInt(2, 60); res = rDiv([1, 1], rAdd([1, a], [1, b])) } while (a === b || !terminating(res[1]))
  return {
    condition_text: `Найдите значение выражения 1 : (${fT(1, a)} + ${fT(1, b)}).`,
    answer: decStr(res).replace(".", ","),
  }
}

// ── Шаблоны ОГЭ №7 (КЭС 1.3/1.4 — числовая прямая, текстовые с выбором) ──────

// Собирает блок вариантов "1) .. 2) .. 3) .. 4) .." с правильным на случайной позиции.
function mcBlock(correct, distractors) {
  const opts = [correct, ...distractors].slice(0, 4)
  // перемешиваем, запоминая индекс правильного
  for (let i = opts.length - 1; i > 0; i--) { const j = randInt(0, i);[opts[i], opts[j]] = [opts[j], opts[i]] }
  const answerIdx = opts.indexOf(correct)
  const text = opts.map((o, i) => `${i + 1}) ${o}`).join("\n")
  return { text, answer: String(answerIdx + 1) }
}

// Между какими целыми числами заключено число N/M.
function tBetweenIntFrac() {
  const M = pick([7, 11, 13, 14, 15, 17, 19, 23])
  let N; do { N = randInt(M * 2 + 1, M * 13) } while (N % M === 0)
  const lo = Math.floor(N / M)
  const pairs = [[lo, lo + 1], [lo - 1, lo], [lo + 1, lo + 2], [lo + 2, lo + 3]]
  const correct = `${lo} и ${lo + 1}`
  const distractors = pairs.slice(1).map(([a, b]) => `${a} и ${b}`)
  const mc = mcBlock(correct, distractors)
  return {
    condition_text: `Между какими целыми числами заключено число ${fT(N, M)}?\n${mc.text}`,
    answer: mc.answer,
  }
}

// Между какими целыми числами заключено число √n.
function tBetweenIntSqrt() {
  let n; do { n = randInt(5, 150) } while (Number.isInteger(Math.sqrt(n)))
  const lo = Math.floor(Math.sqrt(n))
  const correct = `${lo} и ${lo + 1}`
  const distractors = [[lo - 1, lo], [lo + 1, lo + 2], [lo + 2, lo + 3]].map(([a, b]) => `${a} и ${b}`)
  const mc = mcBlock(correct, distractors)
  return {
    condition_text: `Между какими целыми числами заключено число ${rT(n)}?\n${mc.text}`,
    answer: mc.answer,
  }
}

// Какому из промежутков ширины 0,1 принадлежит число p/q.
function tIntervalFrac() {
  const q = pick([7, 9, 11, 13, 14, 17, 19])
  let p, t
  do {
    p = randInt(1, q - 1)
    t = Math.floor((p / q) * 10)             // номер десятой доли
  } while ((p * 10) % q === 0 || t < 1 || t > 6)   // не на границе и промежутки одноразрядные
  const iv = (k) => `[0,${k} ; 0,${k + 1}]`
  const correct = iv(t)
  const distractors = [iv(t - 1), iv(t + 1), iv(t + 2)]
  const mc = mcBlock(correct, distractors)
  return {
    condition_text: `Какому из данных промежутков принадлежит число ${fT(p, q)}?\n${mc.text}`,
    answer: mc.answer,
  }
}

// Какое из четырёх десятичных чисел заключено между дробями f1 и f2.
function tBetweenFracs() {
  const base = pick([5, 6, 7, 8])            // десятые: варианты base/10 … (base+3)/10
  const optsDec = [0, 1, 2, 3].map((k) => (base + k) / 10)
  const answerVal = pick(optsDec)
  // ищем дроби чуть ниже и чуть выше answerVal (только эта опция попадёт в интервал)
  const fracNear = (lo, hi) => {
    for (const d of [11, 13, 14, 15, 16, 17, 18, 19, 21, 23]) {
      const nn = Math.floor(lo * d) + 1
      if (nn / d > lo && nn / d < hi) return [nn, d]
    }
    return null
  }
  const f1 = fracNear(answerVal - 0.08, answerVal - 0.02)
  const f2 = fracNear(answerVal + 0.02, answerVal + 0.08)
  if (!f1 || !f2) return tBetweenFracs()     // редкий промах поиска — пересобрать
  const correct = decStr([Math.round(answerVal * 10), 10]).replace(".", ",")
  const distractors = optsDec.filter((v) => v !== answerVal)
    .map((v) => decStr([Math.round(v * 10), 10]).replace(".", ","))
  const mc = mcBlock(correct, distractors)
  return {
    condition_text: `Какое из следующих чисел заключено между числами ${fT(f1[0], f1[1])} и ${fT(f2[0], f2[1])}?\n${mc.text}`,
    answer: mc.answer,
  }
}

// ── Шаблоны ОГЭ №8 (КЭС 2.2 — степени и корни) ───────────────────────────────

function t8PowerMulDiv() {
  const v = pick([2, 3, 4, 5, 6, 7, 10])
  let m, n, k, e
  do { m = randInt(2, 20); n = randInt(2, 20); k = randInt(1, 20); e = m + n - k } while (e < 0 || v ** e > 100000)
  return { condition_text: `Найдите значение выражения a${sup(m)} · a${sup(n)} : a${sup(k)} при a = ${v}.`, answer: String(v ** e) }
}

function t8PowerPow() {
  const v = pick([2, 3, 4, 5, 6, 7, 10])
  let m, n, k, e
  do { m = randInt(2, 6); n = randInt(2, 4); k = randInt(1, 20); e = m * n - k } while (e < 0 || v ** e > 100000)
  return { condition_text: `Найдите значение выражения (a${sup(m)})${sup(n)} : a${sup(k)} при a = ${v}.`, answer: String(v ** e) }
}

function t8Roots() {
  const isSq = (x) => Number.isInteger(Math.sqrt(x))
  let s, A, B
  do {
    s = randInt(3, 12); const sq = s * s
    // подкоренные — НЕ полные квадраты (иначе √4·√4 выглядит тривиально, не по-фипишному)
    const divs = []
    for (let dd = 2; dd < sq; dd++) if (sq % dd === 0 && !isSq(dd) && !isSq(sq / dd)) divs.push(dd)
    if (divs.length) { A = pick(divs); B = sq / A }
  } while (!A)
  return { condition_text: `Найдите значение выражения ${rT(A)} · ${rT(B)}.`, answer: String(s) }
}

// №8. Корень из степени: √(bⁿ) = b^(n/2). Банк: √(5⁶)=125. (КЭС 2.2)
function t8RootPow() {
  const b = pick([2, 3, 5, 6, 7, 10, 11, 13])
  let half; do { half = randInt(1, 4) } while (b ** half > 100000)
  return { condition_text: `Найдите значение выражения ${rT(`${b}${sup(2 * half)}`)}.`, answer: String(b ** half) }
}

// №8. Произведение сопряжённых: (√a−k)(√a+k)=a−k² или (√a−√b)(√a+√b)=a−b.
// Банк: (√31−3)(√31+3)=22, (√19−√2)(√19+√2)=17. (КЭС 2.2)
function t8Conjugate() {
  const isSq = (x) => Number.isInteger(Math.sqrt(x))
  if (Math.random() < 0.5) {
    const k = randInt(2, 6)
    let a; do { a = randInt(k * k + 1, k * k + 40) } while (isSq(a))
    const first = pick([`(${rT(a)} − ${k})(${rT(a)} + ${k})`, `(${rT(a)} + ${k})(${rT(a)} − ${k})`])
    return { condition_text: `Найдите значение выражения ${first}.`, answer: String(a - k * k) }
  }
  let a, b; do { a = randInt(3, 60); b = randInt(2, a - 1) } while (isSq(a) || isSq(b) || a === b)
  const expr = pick([`(${rT(a)} − ${rT(b)})(${rT(a)} + ${rT(b)})`, `(${rT(a)} + ${rT(b)})(${rT(a)} − ${rT(b)})`])
  return { condition_text: `Найдите значение выражения ${expr}.`, answer: String(a - b) }
}

// №8. Раскрытие скобки с корнем: (√(m²b) ± √b)·√b = (m±1)·b. Банк: (√27+√3)·√3=12. (КЭС 2.2)
function t8Distrib() {
  const b = pick([2, 3, 5, 6, 7])
  const m = randInt(2, 5)
  const plus = Math.random() < 0.5
  const A = m * m * b
  return {
    condition_text: `Найдите значение выражения (${rT(A)} ${plus ? "+" : "−"} ${rT(b)}) · ${rT(b)}.`,
    answer: String((plus ? m + 1 : m - 1) * b),
  }
}

// №8. Произведение корней с коэффициентами: k√p · m√q · √(pq) = k·m·pq (p,q — простые).
// Банк: 4√17·5√2·√34 = 20·34 = 680. (КЭС 2.2)
function t8CoefRoots() {
  const primes = [2, 3, 5, 7, 11, 13, 17]
  let p, q; do { p = pick(primes); q = pick(primes) } while (p === q || p * q > 60)
  const rads = shuffle([p, q, p * q])
  const coeffs = shuffle([randInt(2, 6), randInt(2, 5), 1])   // одно подкоренное без коэффициента
  const parts = rads.map((r, i) => `${coeffs[i] === 1 ? "" : coeffs[i]}${rT(r)}`)
  return {
    condition_text: `Найдите значение выражения ${parts.join(" · ")}.`,
    answer: String(coeffs[0] * coeffs[1] * coeffs[2] * p * q),
  }
}

// №8. Степени с отрицательным показателем и степень степени: b⁻ᵃ·(bᵇ)ᶜ = b^(bc−a).
// Банк: 2⁻⁹·(2⁷)²=2⁵=32. (КЭС 2.2)
function t8NegPow() {
  const b = pick([2, 3, 5])
  let a, e, c; do { e = randInt(2, 7); c = randInt(2, 3); a = randInt(3, 12) } while (e * c - a < 0 || b ** (e * c - a) > 100000)
  return {
    condition_text: `Найдите значение выражения ${b}${sup(-a)} · (${b}${sup(e)})${sup(c)}.`,
    answer: String(b ** (e * c - a)),
  }
}

// №8. Степенная дробь pᵃ/pᵇ (знаменатель дан числом), стоячей дробью в тексте
// (fT принимает и надстрочные степени в числителе). Банк: 3⁷/81=27. (КЭС 2.2)
function t8PowFrac() {
  const p = pick([2, 3, 5, 7])
  let b, a; do { b = randInt(2, 4); a = b + randInt(1, 4) } while (p ** (a - b) > 100000)
  return {
    condition_text: `Найдите значение выражения ${fT(`${p}${sup(a)}`, p ** b)}.`,
    answer: String(p ** (a - b)),
  }
}

// №7. Какое из чисел √a,√b,√c,√d принадлежит промежутку [n;n+1]. Банк: √6,√7,√35,√42 ∈ [6;7]. (КЭС 2.5)
// Это тип №7 (оценка корня), не №8 — репетитор подтвердил.
function t7SqrtInterval() {
  const isSq = (x) => Number.isInteger(Math.sqrt(x))
  const n = randInt(2, 8)
  let t; do { t = randInt(n * n + 1, (n + 1) * (n + 1) - 1) } while (isSq(t))   // √t ∈ (n, n+1)
  const outs = new Set()
  while (outs.size < 3) {
    const cand = Math.random() < 0.5 ? randInt(2, n * n - 1) : randInt((n + 1) * (n + 1) + 1, (n + 2) * (n + 2))
    if (!isSq(cand) && cand !== t) outs.add(cand)
  }
  const nums = shuffle([t, ...outs])
  const answerIdx = nums.indexOf(t) + 1
  return {
    condition_text:
      `Какое из чисел ${nums.map(rT).join(", ")} принадлежит промежутку [${n}; ${n + 1}]?\n` +
      nums.map((x, i) => `${i + 1}) ${rT(x)}`).join("\n"),
    answer: String(answerIdx),
  }
}

// №8. Квадрат коэффициента-корня (k√a)² = k²a, в трёх раскладках банка:
// «(k√a)²», «N/(k√a)²»=N/(k²a), «(k√a)²/N» (десятичный ответ). Банк: 90/(3√5)²=2. (КЭС 2.2)
function t8CoefSq() {
  const k = randInt(2, 6), a = pick([2, 3, 5, 6, 7, 11, 13])
  const val = k * k * a                              // (k√a)²
  const sqMk = `(${k}√{${a}})${sup(2)}`              // радикал внутри дроби — маркером √{a}
  const layout = pick(["bare", "Ndiv", "divN"])
  if (layout === "bare")
    return { condition_text: `Найдите значение выражения (${k}${rT(a)})${sup(2)}.`, answer: String(val) }
  if (layout === "Ndiv") {
    const m = randInt(2, 9), N = val * m             // N/(k√a)² = m
    return { condition_text: `Найдите значение выражения ${fT(String(N), sqMk)}.`, answer: String(m) }
  }
  const den = pick([2, 4, 5, 8]), N = val * den      // (k√a)²/N = 1/den (десятичная)
  return { condition_text: `Найдите значение выражения ${fT(sqMk, String(N))}.`, answer: decStr([1, den]) }
}

// №8. Частное корней (√a·√b)/√c = √(ab/c), где ab/c — полный квадрат. Банк: √21·√14/√6=7. (КЭС 2.2)
function t8RootQuot() {
  const isSq = (x) => Number.isInteger(Math.sqrt(x))
  const primes = [2, 3, 5, 7, 11, 13]
  let a, b, c, s
  for (let tries = 0; tries < 400; tries++) {
    s = randInt(2, 12)
    const cp = pick(primes), cq = pick(primes)
    c = cp === cq ? cp : cp * cq                     // c — свободное от квадрата
    if (isSq(c)) continue
    const N = s * s * c                              // = a·b
    const divs = []
    for (let dd = 2; dd < N; dd++)
      if (N % dd === 0 && !isSq(dd) && !isSq(N / dd) && dd !== c && N / dd !== c) divs.push(dd)
    if (!divs.length) continue
    a = pick(divs); b = N / a
    if (a >= b) break                                // a ≥ b — чтобы не дублировать
  }
  return {
    condition_text: `Найдите значение выражения ${fT(`√{${a}} · √{${b}}`, `√{${c}}`)}.`,
    answer: String(s),
  }
}

// №8. Квадрат бинома с корнем: (√a ± b)² ∓ 2b√a = a + b² (перекрёстные члены сокращаются).
// Банк: (√17+2)²−4√17 = 21. (КЭС 2.2)
function t8SqBinom() {
  const isSq = (x) => Number.isInteger(Math.sqrt(x))
  let a; do { a = randInt(2, 40) } while (isSq(a))
  const b = randInt(2, 9), plus = Math.random() < 0.5
  const expr = plus
    ? `(${rT(a)} + ${b})${sup(2)} − ${2 * b}${rT(a)}`
    : `(${rT(a)} − ${b})${sup(2)} + ${2 * b}${rT(a)}`
  return { condition_text: `Найдите значение выражения ${expr}.`, answer: String(a + b * b) }
}

// №8. Корень из одночлена «при»: √(N·…), N — полный квадрат, показатели чётные.
// Три раскладки банка: √(N·a^p/a^q), √(N·x^p·y^q), √(N·x^p/y^q). Банк: √(36a²¹/a¹⁵) при a=2 → 48.
function t8RootMono() {
  const N = pick([4, 9, 16, 25, 36, 49, 64, 100]), rN = Math.sqrt(N)
  const layout = pick(["aQuot", "xyProd", "xyQuot"])
  const ok = (val) => Number.isInteger(val) && val <= 100000 && val > 0
  // подкоренное — стоячая дробь под общим знаком корня (rfT: √ с чертой на всю дробь)
  if (layout === "aQuot") {
    const a = pick([2, 3])
    let p, q; do { p = 2 * randInt(3, 11); q = 2 * randInt(1, p / 2 - 1) } while (rN * a ** ((p - q) / 2) > 100000)
    const val = rN * a ** ((p - q) / 2)
    return { condition_text: `Найдите значение выражения ${rfT(`${N}a${sup(p)}`, `a${sup(q)}`)} при a = ${a}.`, answer: String(val) }
  }
  if (layout === "xyProd") {
    const recip = Math.random() < 0.4          // коэффициент 1/N вместо N (банк: √(1/16·x¹⁰y²))
    // при 1/N берём x кратным √N, чтобы x^(px/2)·… делилось на √N (ответ целый)
    const x = recip ? rN * randInt(1, 3) : randInt(2, 8), y = randInt(2, 6)
    let px, py, val
    do {
      px = 2 * randInt(1, 3); py = 2 * randInt(1, 3)
      val = recip ? x ** (px / 2) * y ** (py / 2) / rN : rN * x ** (px / 2) * y ** (py / 2)
    } while (!ok(val))
    // 1/N — как дробь под корнем с суффиксом-одночленом; N·… — целый коэффициент в числителе
    const body = recip
      ? rfT("1", String(N), `·x${sup(px)}y${sup(py)}`)
      : rT(`${N}·x${sup(px)}y${sup(py)}`)
    return { condition_text: `Найдите значение выражения ${body} при x = ${x} и y = ${y}.`, answer: String(val) }
  }
  const y = pick([2, 3, 5]), x = y * randInt(1, 4)   // x/y-часть → целое
  let px, py; do { px = 2 * randInt(1, 3); py = 2 * randInt(1, 2) } while (!ok(rN * x ** (px / 2) / y ** (py / 2)))
  const val = rN * x ** (px / 2) / y ** (py / 2)
  return { condition_text: `Найдите значение выражения ${rfT(`${N}x${sup(px)}`, `y${sup(py)}`)} при x = ${x} и y = ${y}.`, answer: String(val) }
}

// №8. Корень со знаком «минус a»: √(a^p·(−a)^q), p,q чётные ⇒ = a^((p+q)/2). Банк: √(a²·(−a)⁶) при a=2. (КЭС 2.1)
function t8RootSign() {
  const a = randInt(2, 7)
  let p, q; do { p = 2 * randInt(1, 4); q = 2 * randInt(1, 4) } while (a ** ((p + q) / 2) > 100000)
  const inner = Math.random() < 0.5
    ? `a${sup(p)}·(−a)${sup(q)}`
    : `(−a)${sup(p)}·a${sup(q)}`
  return { condition_text: `Найдите значение выражения ${rT(inner)} при a = ${a}.`, answer: String(a ** ((p + q) / 2)) }
}

// №8. Корень из полного квадрата трёхчлена: √((αa±βb)²)=|αa±βb|. Коэффициенты α²,2αβ,β².
// Значения a,b — целые или дроби (банк подбирает так, что ответ целый). Банк: √(a²−4ab+4b²) при a=3,b=4 = 5.
function t8Trinom() {
  const alpha = randInt(1, 6), beta = randInt(1, 6), sg = Math.random() < 0.5 ? 1 : -1
  const c1 = alpha * alpha, cmid = 2 * alpha * beta, c2 = beta * beta
  let da = 1, db = 1, na = randInt(-6, 9), nb = randInt(-6, 9)
  let ans = Math.abs(alpha * na + sg * beta * nb)
  if (ans === 0) { na += 1; ans = Math.abs(alpha * na + sg * beta * nb) || alpha }
  if (Math.random() < 0.35) {
    // дробные a,b (знаменатель den) с целым ответом: α·na + sg·β·nb = T·den.
    const den = pick([5, 9, 11]), T = randInt(2, 25), P = T * den
    const opts = []
    for (let x = 1; x <= P + alpha * den; x++) {
      const y = (P - sg * alpha * x) / (sg * beta)       // sg·β·nb = P − α·na
      if (Number.isInteger(y) && y > 0 && (x % den !== 0 || y % den !== 0)) opts.push([x, y])
    }
    if (opts.length) { const [x, y] = pick(opts); da = db = den; na = x; nb = y; ans = T }
  }
  const fmt = (n, d) => d === 1 ? (n < 0 ? `−${-n}` : String(n)) : (n < 0 ? `−${fT(-n, d)}` : fT(n, d))
  const t1 = `${c1 === 1 ? "" : c1}a${sup(2)}`
  const tm = `${sg > 0 ? "+" : "−"} ${cmid === 1 ? "" : cmid}ab`
  const t2 = `${c2 === 1 ? "" : c2}b${sup(2)}`
  return {
    condition_text: `Найдите значение выражения ${rT(`${t1} ${tm} + ${t2}`)} при a = ${fmt(na, da)} и b = ${fmt(nb, db)}.`,
    answer: String(ans),
  }
}

// №8. Двухпеременная степень при b=√a: a^m·(b^n)^p/(a·b)^q = a^((m−q)+(np−q)/2). Банк: a¹⁴·(b⁶)²/(a·b)¹² при a=6 → 36.
function t8TwoVar() {
  const a = pick([2, 3, 5, 6, 7])
  let m, n, p, q, E
  do {
    m = randInt(10, 22); n = randInt(4, 9); p = 2 + randInt(0, 1); q = randInt(10, 20)
    E = (m - q) + (n * p - q) / 2
  } while (!Number.isInteger(E) || E < 1 || E > 6 || a ** E > 100000)
  return {
    condition_text: `Найдите значение выражения ${fT(`a${sup(m)}·(b${sup(n)})${sup(p)}`, `(a·b)${sup(q)}`)} при a = ${a} и b = ${rT(a)}.`,
    answer: String(a ** E),
  }
}

// №8. Степенной закон «при a=v» — все раскладки банка (умножение/деление/степень степени,
// в т.ч. отрицательные показатели), приводятся к a^E. Обобщает t8PowerMulDiv/t8PowerPow.
function t8PowerVar() {
  const v = pick([2, 3, 5, 6, 7, 10])
  // деление — стоячей дробью (fT); умножение/степень степени без деления — flat
  const layouts = [
    () => { const m = randInt(2, 20), n = randInt(2, 20), k = randInt(1, 20); return { e: m + n - k, num: `a${sup(m)} · a${sup(n)}`, den: `a${sup(k)}` } },
    () => { const m = randInt(2, 6), n = randInt(2, 4), k = randInt(1, 20); return { e: m * n - k, num: `(a${sup(m)})${sup(n)}`, den: `a${sup(k)}` } },
    () => { const m = randInt(3, 12), n = randInt(2, 7), p = randInt(2, 3); return { e: -m + n * p, flat: `a${sup(-m)} · (a${sup(n)})${sup(p)}` } },
    () => { const m = randInt(2, 5), n = randInt(2, 4), k = m * n + randInt(0, 8); return { e: -m * n + k, num: `(a${sup(m)})${sup(-n)}`, den: `a${sup(-k)}` } },
    () => { const m = randInt(6, 20), n = randInt(2, 10), k = randInt(1, 8); return { e: m - n - k, num: `a${sup(m)} · a${sup(-n)}`, den: `a${sup(k)}` } },
    () => { const m = randInt(2, 6), n = randInt(2, 4), p = randInt(2, 10), k = randInt(1, 20); return { e: m * n + p - k, num: `(a${sup(m)})${sup(n)} · a${sup(p)}`, den: `a${sup(k)}` } },
    () => { const m = randInt(2, 6), n = randInt(2, 4), k = randInt(1, 20); return { e: m * n - k, num: `(a${sup(m)})${sup(n)}`, den: `a${sup(k)}` } },
  ]
  let r; do { r = pick(layouts)() } while (r.e < 0 || v ** r.e > 100000)
  const body = r.flat ? r.flat : fT(r.num, r.den)
  return { condition_text: `Найдите значение выражения ${body} при a = ${v}.`, answer: String(v ** r.e) }
}

// №8. Числовые степени одного основания p (три члена / степень степени с минусом) → p^E.
// Банк: 11⁻³·11¹²/11⁸=11, (3⁷)⁻²/3⁻¹⁶=9. (КЭС 2.2)
function t8NumPow() {
  const p = pick([2, 3, 5, 6, 7, 10, 11])
  const layouts = [
    () => { const m = randInt(1, 12), n = randInt(4, 19), k = randInt(1, 12); return { e: -m + n - k, s: fT(`${p}${sup(-m)} · ${p}${sup(n)}`, `${p}${sup(k)}`) } },
    () => { const m = randInt(2, 11), n = randInt(2, 3), k = m * n + randInt(1, 6); return { e: -m * n + k, s: fT(`(${p}${sup(m)})${sup(-n)}`, `${p}${sup(-k)}`) } },
    () => { const m = randInt(2, 12), n = randInt(2, 12), k = randInt(1, 10); return { e: m + n - k, s: fT(`${p}${sup(m)} · ${p}${sup(n)}`, `${p}${sup(k)}`) } },
    () => { const a = randInt(6, 19), b = randInt(1, a - 1); return { e: a - b, s: `${fT(1, `${p}${sup(-a)}`)} · ${fT(1, `${p}${sup(b)}`)}` } },   // 1/p⁻ᵃ·1/p^b = p^(a−b)
  ]
  let r; do { r = pick(layouts)() } while (r.e < 0 || p ** r.e > 100000)
  return { condition_text: `Найдите значение выражения ${r.s}.`, answer: String(p ** r.e) }
}

// №8. Смешанное 10ⁿ/(2ᵃ·5ᵇ) = 2^(n−a)·5^(n−b). Банк: 10⁶/(2⁵·5⁴)=50. (КЭС 2.2)
function t8Mixed10() {
  const n = randInt(4, 7)
  let a, b; do { a = randInt(1, n); b = randInt(1, n) } while (a === n && b === n)
  return {
    condition_text: `Найдите значение выражения ${fT(`10${sup(n)}`, `2${sup(a)} · 5${sup(b)}`)}.`,
    answer: String(2 ** (n - a) * 5 ** (n - b)),
  }
}

// №8. (p·q)ⁿ/(pᵃ·qᵇ) = p^(n−a)·q^(n−b). Банк: (3·10)⁸/(3⁶·10⁷)=90. (КЭС 2.2)
function t8ParenMulPow() {
  const pairs = [[2, 5], [2, 6], [3, 10], [5, 7], [2, 3], [3, 5], [3, 7], [4, 7], [3, 8], [4, 5]]
  const [p, q] = pick(pairs)
  let n, a, b, val
  do { n = randInt(4, 8); a = randInt(1, n - 1); b = randInt(1, n - 1); val = p ** (n - a) * q ** (n - b) } while (val > 100000)
  // банк пишет основание и как «(p·q)ⁿ», и уже перемноженным «(pq)ⁿ»
  const base = Math.random() < 0.5 ? `(${p}·${q})${sup(n)}` : `${p * q}${sup(n)}`
  return {
    condition_text: `Найдите значение выражения ${fT(base, `${p}${sup(a)} · ${q}${sup(b)}`)}.`,
    answer: String(val),
  }
}

// ── Шаблоны ОГЭ №9 (КЭС 3.1 — уравнения) ─────────────────────────────────────

function t9Linear() {
  // a ≠ 0 — иначе получилось бы бессмысленное «k(x − 0)»
  const k = pick([2, 4, 5, 10]), a = pick(Array.from({ length: 22 }, (_, i) => i - 9).filter((v) => v !== 0)), tenths = randInt(1, 9)
  const bStr = decStr([k * tenths, 10]).replace(".", ",")   // b = k·(tenths/10)
  const x = rAdd([a, 1], [tenths, 10])                        // корень: a + tenths/10
  const inner = a >= 0 ? `x − ${a}` : `x + ${-a}`
  return { condition_text: `Найдите корень уравнения ${k}(${inner}) = ${bStr}.`, answer: decStr(x).replace(".", ",") }
}

function t9LinearInt() {
  const a = pick([2, 3, 4, 5, 6, 7, -2, -3, -4]), x = randInt(-9, 12), b = randInt(-20, 20)
  const c = a * x + b
  const bs = b >= 0 ? ` + ${b}` : ` − ${-b}`
  return { condition_text: `Найдите корень уравнения ${a}x${bs} = ${c}.`, answer: String(x) }
}

function t9Quad() {
  let r1 = randInt(-9, 9), r2 = randInt(-9, 9)
  while (r1 === r2) r2 = randInt(-9, 9)
  if (r1 > r2) [r1, r2] = [r2, r1]
  const p = -(r1 + r2), q = r1 * r2
  const term = (coef, sym) => coef === 0 ? "" : `${coef > 0 ? " + " : " − "}${Math.abs(coef) === 1 && sym ? "" : Math.abs(coef)}${sym}`
  const expr = `x²${term(p, "x")}${term(q, "")} = 0`
  const smaller = Math.random() < 0.5
  return {
    condition_text: `Решите уравнение ${expr}. Если уравнение имеет более одного корня, в ответ запишите ${smaller ? "меньший" : "больший"} из корней.`,
    answer: String(smaller ? r1 : r2),
  }
}

// №9. Квадратное со старшим коэффициентом: (ax − s)(x − t) = ax² − (at+s)x + st = 0.
// Корни t и s/a рациональны. Банк: 2x²−3x+1=0 → x=1, x=0,5. (КЭС 3.1)
function t9QuadLead() {
  const a = pick([2, 3])
  let s, t, root2
  do { s = randInt(-6, 6); t = randInt(-6, 6); root2 = s / a } while (s === 0 || root2 === t || Number.isInteger(root2))
  const b = -(a * t + s), c = s * t
  const term = (co, sym) => co === 0 ? "" : `${co > 0 ? " + " : " − "}${Math.abs(co) === 1 && sym ? "" : Math.abs(co)}${sym}`
  const expr = `${a}x²${term(b, "x")}${term(c, "")} = 0`
  const roots = [t, root2].sort((x, y) => x - y)
  const smaller = Math.random() < 0.5
  const ans = smaller ? roots[0] : roots[1]
  return {
    condition_text: `Решите уравнение ${expr}. Если уравнение имеет более одного корня, в ответ запишите ${smaller ? "меньший" : "больший"} из корней.`,
    answer: decStr([Math.round(ans * a), a]).replace(".", ","),
  }
}

// №9. Уравнение ax² = bx → x(ax − b) = 0, корни 0 и b/a. Банк: 9x²=54x → 0 и 6. (КЭС 3.1)
function t9Factor() {
  const a = pick([1, 2, 3, 4, 5, 9])
  let q; do { q = randInt(-9, 9) } while (q === 0)   // второй корень
  const b = a * q                                     // ax² = bx, b кратно a
  const lhs = `${a === 1 ? "" : a}x²`
  const rhs = `${b === 1 ? "" : b === -1 ? "−" : b}x`
  const roots = [0, q].sort((x, y) => x - y)
  const smaller = Math.random() < 0.5
  return {
    condition_text: `Решите уравнение ${lhs} = ${rhs}. Если уравнение имеет более одного корня, в ответ запишите ${smaller ? "меньший" : "больший"} из корней.`,
    answer: String(smaller ? roots[0] : roots[1]),
  }
}

// №9. Линейное с переменной по обе стороны: ax + b = cx + d. Банк: −5x = 3x + 8. (КЭС 3.1)
function t9BothSides() {
  let a, c, x, b, d
  do {
    a = randInt(-6, 6); c = randInt(-6, 6); x = randInt(-9, 9)
    b = randInt(-15, 15); d = (a - c) * x + b        // ax + b = cx + d ⇒ x — корень
  } while (a === c || Math.abs(d) > 30)
  const side = (co, con) => {
    const t1 = co === 0 ? "" : `${co === 1 ? "" : co === -1 ? "−" : co < 0 ? `−${-co}` : co}x`
    const t2 = con === 0 ? "" : (t1 ? (con > 0 ? ` + ${con}` : ` − ${-con}`) : (con < 0 ? `−${-con}` : String(con)))
    return (t1 + t2) || "0"
  }
  return {
    condition_text: `Найдите корень уравнения ${side(a, b)} = ${side(c, d)}.`,
    answer: String(x),
  }
}

// ── Шаблоны ОГЭ №12 (вычисление по формуле) ──────────────────────────────────

function t12Power() {
  const I = randInt(2, 9), R = randInt(2, 20)
  return {
    condition_text: `Мощность постоянного тока (в ваттах) вычисляется по формуле P = I²R, где I — сила тока (в амперах), R — сопротивление (в омах). Пользуясь этой формулой, найдите P (в ваттах), если I = ${I} А и R = ${R} Ом.`,
    answer: String(I * I * R),
  }
}

function t12Kinetic() {
  const m = pick([2, 4, 6, 8, 10]), vv = pick([2, 4, 6, 8, 10])
  return {
    condition_text: `Кинетическая энергия тела (в джоулях) вычисляется по формуле E = mv²/2, где m — масса (в кг), v — скорость (в м/с). Найдите E (в джоулях), если m = ${m} кг и v = ${vv} м/с.`,
    answer: String(m * vv * vv / 2),
  }
}

// Потенциальная энергия E = mgh (g = 9,8) — обратная задача: найти массу по E и h.
// Банк: E=980 Дж, h=5 м → m = 980/(9,8·5) = 20 кг. m·h кратно 5 → E целое.
function t12Potential() {
  let m, h
  do { m = randInt(2, 30); h = randInt(2, 20) } while ((m * h) % 5 !== 0)
  const E = 49 * m * h / 5                        // = 9,8·m·h, целочисленно (m·h кратно 5)
  return {
    condition_text:
      `Если тело массой m кг подвешено на высоте h м над горизонтальной поверхностью земли, то ` +
      `его потенциальная энергия (в джоулях) вычисляется по формуле E = mgh, где g = 9,8 м/с² — ` +
      `ускорение свободного падения. Найдите массу тела (в килограммах), подвешенного на высоте ` +
      `${h} м над поверхностью земли, если его потенциальная энергия равна ${E} джоулям.`,
    answer: String(m),
  }
}

// Центростремительное ускорение a = ω²R — обратная задача: найти R по a и ω.
function t12Centripetal() {
  const w = randInt(2, 7), R = randInt(2, 25)
  return {
    condition_text:
      `Центростремительное ускорение при движении по окружности (в м/с²) вычисляется по формуле ` +
      `a = ω²R, где ω — угловая скорость (в с⁻¹), R — радиус окружности (в метрах). Пользуясь этой ` +
      `формулой, найдите радиус R (в метрах), если угловая скорость равна ${w} с⁻¹, а ` +
      `центростремительное ускорение равно ${w * w * R} м/с².`,
    answer: String(R),
  }
}

// Площадь четырёхугольника S = d₁d₂·sinα/2 — обратная задача: найти d₂.
function t12QuadArea() {
  const sins = [[1, 2], [2, 5], [3, 5], [4, 5], [3, 7], [3, 4], [5, 8], [2, 3], [1, 4], [3, 8]]
  let d1, d2, p, q, S
  do {
    ;[p, q] = pick(sins); d1 = randInt(3, 16); d2 = randInt(3, 20)
    S = (d1 * d2 * p) / (2 * q)
  } while (!Number.isInteger(S))
  return {
    condition_text:
      `Площадь четырёхугольника можно вычислить по формуле S = ½·d₁·d₂·sinα, где d₁ и d₂ — длины ` +
      `диагоналей четырёхугольника, α — угол между диагоналями. Пользуясь этой формулой, найдите ` +
      `длину диагонали d₂, если d₁ = ${d1}, sinα = ${fT(p, q)}, а S = ${S}.`,
    answer: String(d2),
  }
}

// Сила Архимеда F = ρgV (ρ = 1000, g = 9,8) — прямая задача.
function t12Archimedes() {
  const V = pick([0.5, 1, 1.5, 2, 2.5, 3, 4, 5])
  return {
    condition_text:
      `Сила Архимеда, выталкивающая на поверхность погружённое в воду тело, вычисляется по формуле ` +
      `F = ρgV, где ρ = 1000 кг/м³ — плотность воды, g = 9,8 м/с² — ускорение свободного падения, а ` +
      `V — объём тела в кубических метрах. Сила F измеряется в ньютонах. Найдите силу Архимеда, ` +
      `действующую на тело объёмом ${ruNum(V)} м³.`,
    answer: String(Math.round(9800 * V)),
  }
}

// Стоимость колодца из колец C = base + per·n — прямая линейная формула.
function t12Well() {
  const [firm, base, per] = pick([["«Родник»", 6000, 4100], ["«Чистая вода»", 6500, 4000], ["«Ключ»", 5000, 4200]])
  const n = randInt(3, 12)
  return {
    condition_text:
      `В фирме ${firm} стоимость (в рублях) колодца из железобетонных колец рассчитывается по формуле ` +
      `C = ${base} + ${per}·n, где n — число колец, установленных в колодце. Пользуясь этой формулой, ` +
      `рассчитайте стоимость колодца из ${n} колец. Ответ дайте в рублях.`,
    answer: String(base + per * n),
  }
}

// Перевод температуры Фаренгейт → Цельсий: t_C = 5/9·(t_F − 32).
function t12F2C() {
  const tc = `t${sub("C")}`, tf = `t${sub("F")}`
  const k = randInt(-9, 13)
  const tF = 32 + 9 * k
  return {
    condition_text:
      `Перевести значение температуры по шкале Фаренгейта в шкалу Цельсия позволяет формула ` +
      `${tc} = ${fT(5, 9)}·(${tf} − 32), где ${tc} — температура в градусах Цельсия, ${tf} — температура в градусах ` +
      `Фаренгейта. Скольким градусам по шкале Цельсия соответствует ${ruNum(tF)} ` +
      `${plural(Math.abs(tF), "градус", "градуса", "градусов")} по шкале Фаренгейта?`,
    answer: String(5 * k),
  }
}

// Перевод температуры Цельсий → Фаренгейт: t_F = 1,8·t_C + 32.
function t12C2F() {
  const tc = `t${sub("C")}`, tf = `t${sub("F")}`
  const tC = pick([-20, -15, -10, -5, 5, 10, 15, 20, 25, 30, 35])
  return {
    condition_text:
      `Чтобы перевести значение температуры по шкале Цельсия в шкалу Фаренгейта, пользуются формулой ` +
      `${tf} = 1,8·${tc} + 32, где ${tc} — температура в градусах Цельсия, ${tf} — температура в градусах ` +
      `Фаренгейта. Скольким градусам по шкале Фаренгейта соответствует ${ruNum(tC)} ` +
      `${plural(Math.abs(tC), "градус", "градуса", "градусов")} по шкале Цельсия?`,
    answer: String(Math.round(1.8 * tC + 32)),
  }
}

// ── Шаблоны ОГЭ №13 (КЭС 3.2 — неравенства, выбор промежутка) ─────────────────

function t13Quad() {
  const k = randInt(2, 12)
  const rel = pick([">", "<", "≥", "≤"])
  const strict = rel === ">" || rel === "<"
  const great = rel === ">" || rel === "≥"        // «больше» → решение снаружи
  const lb = strict ? "(" : "[", rb = strict ? ")" : "]"
  const outside = `(−∞; −${k}${rb} ∪ ${lb}${k}; +∞)`
  const inside = `${lb}−${k}; ${k}${rb}`
  const correct = great ? outside : inside
  const mc = mcBlock(correct, [great ? inside : outside, `(−∞; +∞)`, `нет решений`])
  // две письменные формы, обе встречаются в банке: «x² − a² ≷ 0» и «x² ≷ a²»
  const expr = Math.random() < 0.5 ? `x² − ${k * k} ${rel} 0` : `x² ${rel} ${k * k}`
  return {
    condition_text: `Укажите решение неравенства ${expr}.\n${mc.text}`,
    answer: mc.answer,
  }
}

const ruNum = (x) => (Number.isInteger(x) ? String(x) : String(x).replace(".", ",")).replace(/^-/, "−")

// №13. Линейное неравенство ax+b ≷ cx+d, ответ — луч (текстовые варианты).
function t13LinearText() {
  let a, c, b, d, k, bn, bd
  do {
    a = randInt(-6, 6); c = randInt(-6, 6); k = a - c
    b = randInt(-9, 9); d = randInt(-9, 9)
    if (k === 0) continue
      ;[bn, bd] = reduceFr(d - b, k)         // граница B = (d−b)/(a−c)
  } while (k === 0 || ![1, 2, 5, 10].includes(bd) || bn === 0)
  const B = bn / bd
  const strictGt = pick([true, false])       // знак исходного неравенства: > или <
  // ax+b (>|<) cx+d  ⇔  kx (>|<) (d−b) ⇔ x (>|<, с флипом при k<0) B
  const xGreater = k > 0 ? strictGt : !strictGt
  const ray = (gt, bound) => gt ? `(${ruNum(bound)}; +∞)` : `(−∞; ${ruNum(bound)})`
  const correct = ray(xGreater, B)
  const distr = [ray(!xGreater, B), `(0; +∞)`, `(−∞; 0)`].filter((o) => o !== correct)
  const mc = mcBlock(correct, distr)
  const side = (aa, bb) => `${aa === 0 ? "" : (aa === 1 ? "x" : aa === -1 ? "−x" : `${ruNum(aa)}x`)}${bb > 0 ? ` + ${bb}` : bb < 0 ? ` − ${-bb}` : (aa === 0 ? "0" : "")}`.trim() || "0"
  return {
    condition_text: `Укажите решение неравенства ${side(a, b)} ${strictGt ? ">" : "<"} ${side(c, d)}.\n${mc.text}`,
    answer: mc.answer,
  }
}

// Отрисовка одного «варианта-ответа» — решение на числовой прямой.
// sol: {t:'ge'|'gt'|'le'|'lt', a} — луч; {t:'seg', a, b, openA?, openB?} — отрезок (можно
// с выколотыми концами); {t:'un', a, b, openA?, openB?} — объединение двух лучей (−∞,a]∪[b,+∞).
// openA/openB=true → выколотая точка (строгое неравенство). Возвращает <g data-role="opt">.
function solRow(sol, idx, valToX, xL, xR, yBase) {
  const dot = (x, closed) => `<circle cx="${x}" cy="${yBase}" r="3.5" fill="${closed ? "#1c1c1e" : "#fff"}" stroke="#1c1c1e" stroke-width="1.3"/>`
  const bold = (x1, x2) => `<line x1="${x1}" y1="${yBase}" x2="${x2}" y2="${yBase}" stroke="#1c1c1e" stroke-width="1.8"/>`
  const lbl = (x, v) => `<text x="${x}" y="${yBase + 19}" font-size="12" text-anchor="middle" fill="#1c1c1e">${ruNum(v)}</text>`
  // Ось — только с ПРАВОЙ стрелкой (обычная числовая прямая по-фипишному). Ось и лучи
  // доходят ровно до ОСНОВАНИЯ стрелки (xE), после стрелки линий нет. Луч к −∞ — жирным
  // до левого края (без стрелки влево). Ось подписана «x» под стрелкой.
  const xE = xR - 8
  const arrowR = `<polygon points="${xR},${yBase} ${xE},${yBase - 3.6} ${xE},${yBase + 3.6}" fill="#1c1c1e"/>`
  const axis = `<line x1="${xL}" y1="${yBase}" x2="${xE}" y2="${yBase}" stroke="#1c1c1e" stroke-width="1"/>`
  const axisLbl = `<text x="${xR}" y="${yBase + 18}" font-size="13" font-style="italic" text-anchor="middle" fill="#1c1c1e">x</text>`
  let bolds, dots, labels, enc
  if (sol.t === "seg") {
    const xa = valToX(sol.a), xb = valToX(sol.b)
    bolds = bold(xa, xb); dots = dot(xa, !sol.openA) + dot(xb, !sol.openB); labels = lbl(xa, sol.a) + lbl(xb, sol.b)
    enc = `seg:${sol.a}:${sol.b}:${sol.openA ? 0 : 1}${sol.openB ? 0 : 1}`
  } else if (sol.t === "un") {
    const xa = valToX(sol.a), xb = valToX(sol.b)
    bolds = bold(xL, xa) + bold(xb, xE); dots = dot(xa, !sol.openA) + dot(xb, !sol.openB); labels = lbl(xa, sol.a) + lbl(xb, sol.b)
    enc = `un:${sol.a}:${sol.b}:${sol.openA ? 0 : 1}${sol.openB ? 0 : 1}`
  } else {
    const x = valToX(sol.a), right = sol.t === "ge" || sol.t === "gt", closed = sol.t === "ge" || sol.t === "le"
    bolds = bold(right ? x : xL, right ? xE : x); dots = dot(x, closed); labels = lbl(x, sol.a)
    enc = `${sol.t}:${sol.a}`
  }
  // порядок слоёв: ось → жирное решение → стрелка (поверх) → точки → метки → подпись «x» → номер
  let s = axis + bolds + arrowR + dots + labels + axisLbl
  if (idx != null) s += `<text x="${xL - 26}" y="${yBase + 4}" font-size="13" fill="#1c1c1e">${idx})</text>`
  return `<g data-role="opt" data-idx="${idx}" data-sol="${enc}">${s}</g>`
}

// Настоящая фигурная скобка «{» слева для системы: путь из квадратичных кривых
// (Arial не содержит крупных brace-глифов U+23A7…, поэтому рисуем сами). Обнимает
// строки справа, остриё смотрит влево.
function leftBrace(x, y0, y1, w = 9) {
  const ym = (y0 + y1) / 2, r = Math.min(10, (y1 - y0) / 4)
  const d = `M ${x + w} ${y0} Q ${x} ${y0} ${x} ${y0 + r} L ${x} ${ym - r} ` +
    `Q ${x} ${ym} ${x - w} ${ym} Q ${x} ${ym} ${x} ${ym + r} L ${x} ${y1 - r} Q ${x} ${y1} ${x + w} ${y1}`
  return `<path d="${d}" fill="none" stroke="#1c1c1e" stroke-width="1.6"/>`
}

// №13. Система двух линейных неравенств; варианты ответа — числовые прямые (SVG).
function t13SystemPic() {
  const mk = () => {
    const c = pick([2, 3, 4, 1.1, 2.7, 0.3, 5, 1.5]) * pick([1, -1])
    const e = pick([-3, -2, -1, 0, 1, 2, 3, 1])
    const ge = pick([true, false])
    return { c, e, ge, bound: +(e - c).toFixed(1) }
  }
  let i1, i2
  do { i1 = mk(); i2 = mk() } while (i1.bound === i2.bound)
  // текст неравенства "x + c ≥ e"
  const ineqText = (q) => `x ${q.c >= 0 ? "+ " + ruNum(q.c) : "− " + ruNum(-q.c)} ${q.ge ? "≥" : "≤"} ${ruNum(q.e)}`

  // истинное решение системы
  let correct
  if (i1.ge && i2.ge) correct = { t: "ge", a: Math.max(i1.bound, i2.bound) }
  else if (!i1.ge && !i2.ge) correct = { t: "le", a: Math.min(i1.bound, i2.bound) }
  else {
    const lo = (i1.ge ? i1 : i2).bound, hi = (i1.ge ? i2 : i1).bound   // ge-нижняя, le-верхняя
    if (lo <= hi) correct = { t: "seg", a: lo, b: hi }
    else return t13SystemPic()                                        // пустое — пересобираем
  }
  // дистракторы
  const B1 = i1.bound, B2 = i2.bound
  const cand = [
    { t: "ge", a: B1 }, { t: "ge", a: B2 }, { t: "le", a: B1 }, { t: "le", a: B2 },
    { t: "seg", a: Math.min(B1, B2), b: Math.max(B1, B2) },
  ]
  const enc = (s) => s.t === "seg" ? `seg:${s.a}:${s.b}` : `${s.t}:${s.a}`
  const seen = new Set([enc(correct)])
  const distr = []
  for (const s of shuffle(cand)) { if (!seen.has(enc(s))) { seen.add(enc(s)); distr.push(s) } if (distr.length === 3) break }
  const options = shuffle([correct, ...distr])
  const answerIdx = options.findIndex((o) => enc(o) === enc(correct)) + 1

  // общий масштаб
  const vals = options.flatMap((o) => o.t === "seg" ? [o.a, o.b] : [o.a])
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo || 2) * 0.6 + 1
  const xL = 46, xR = 300, W = 340, rowH = 50, sysH = 96
  const valToX = (v) => xL + ((v - (lo - pad)) / ((hi + pad) - (lo - pad))) * (xR - xL)
  // блок системы сверху: настоящая фигурная скобка + два неравенства в столбик
  const braceX = 120
  let body = leftBrace(braceX, 24, 78)
  body += `<text x="${braceX + 16}" y="48" font-size="17" fill="#1c1c1e">${ineqText(i1)}</text>`
  body += `<text x="${braceX + 16}" y="72" font-size="17" fill="#1c1c1e">${ineqText(i2)}</text>`
  options.forEach((o, i) => { body += `<g transform="translate(0,${sysH + i * rowH + 22})">${solRow(o, i + 1, valToX, xL, xR, 0)}</g>` })
  const H = sysH + 4 * rowH + 24
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${body}</svg>`

  return {
    condition_text:
      `Укажите решение системы неравенств, приведённой на рисунке. ` +
      `Варианты решения (1–4) даны под ней на числовой прямой.`,
    answer: String(answerIdx),
    image_url: svgToDataUrl(svg),
  }
}

// №13. Неравенство-произведение kx − x² ≷ 0 (корни 0 и k); варианты — числовые прямые.
function t13Product() {
  const k = randInt(3, 12)
  const rel = pick([">", "<", "≥", "≤"])
  const strict = rel === ">" || rel === "<"
  const great = rel === ">" || rel === "≥"     // ≥0 → между корнями (0;k); ≤0 → снаружи
  // 4 варианта-формы на корнях 0 и k: отрезок/объединение × открытые/закрытые концы
  const shapes = [
    { t: "seg", a: 0, b: k, openA: true, openB: true },
    { t: "seg", a: 0, b: k, openA: false, openB: false },
    { t: "un", a: 0, b: k, openA: true, openB: true },
    { t: "un", a: 0, b: k, openA: false, openB: false },
  ]
  const key = (s) => s.t + (s.openA ? "o" : "c")
  const want = (great ? "seg" : "un") + (strict ? "o" : "c")
  const options = shuffle(shapes)
  const answerIdx = options.findIndex((s) => key(s) === want) + 1

  const xL = 46, xR = 300, W = 340, rowH = 50
  const pad = k * 0.35 + 1
  const valToX = (v) => xL + ((v + pad) / (k + 2 * pad)) * (xR - xL)
  let body = ""
  options.forEach((o, i) => { body += `<g transform="translate(0,${i * rowH + 22})">${solRow(o, i + 1, valToX, xL, xR, 0)}</g>` })
  const H = 4 * rowH + 24
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${body}</svg>`
  return {
    condition_text: `Укажите решение неравенства ${k}x − x² ${rel} 0. Варианты решения (1–4) приведены на рисунке.`,
    answer: String(answerIdx),
    image_url: svgToDataUrl(svg),
  }
}

// №13. Неравенство вида ax² ≷ b (a,b — точные квадраты), корни дробные ±√(b/a).
// Банк ФИПИ: 81x²≤16 (±4/9), 25x²>49 (±7/5), 49x²≥36 (±6/7). Ответ — текстовые
// промежутки со стоячими дробями (границы = несократимая дробь rn/rd).
function t13Coef() {
  let rn, rd
  do { rn = randInt(2, 9); rd = randInt(2, 9) } while (gcd(rn, rd) !== 1 || rn === rd)
  const a = rd * rd, b = rn * rn          // ax² ≷ b ⇔ x² ≷ (rn/rd)²  ⇔ |x| ≷ rn/rd
  const rel = pick([">", "<", "≥", "≤"])
  const strict = rel === ">" || rel === "<"
  const great = rel === ">" || rel === "≥"   // «больше» → снаружи корней; «меньше» → внутри
  const lb = strict ? "(" : "[", rb = strict ? ")" : "]"
  const R = fT(rn, rd)                        // граница ±rn/rd стоячей дробью
  const outside = `(−∞; −${R}${rb} ∪ ${lb}${R}; +∞)`
  const inside = `${lb}−${R}; ${R}${rb}`
  const correct = great ? outside : inside
  const mc = mcBlock(correct, [great ? inside : outside, `(−∞; +∞)`, `нет решений`])
  return {
    condition_text: `Укажите решение неравенства ${a}x² ${rel} ${b}.\n${mc.text}`,
    answer: mc.answer,
  }
}

// №13. Обратная задача: на рисунке дано решение неравенства x² − kx ≷ 0 (корни 0 и k),
// нужно выбрать само неравенство. Дистракторы — то же выражение с другими знаками и
// «голое» выражение без знака (как в банке ФИПИ: «1) x²−6x  2) x²−6x>0 …»).
function t13ByPicture() {
  const k = randInt(3, 9)
  const rel = pick([">", "<", "≥", "≤"])
  const strict = rel === ">" || rel === "<"
  const great = rel === ">" || rel === "≥"   // >0 → вне корней (объединение лучей); <0 → между
  const sol = great
    ? { t: "un", a: 0, b: k, openA: strict, openB: strict }
    : { t: "seg", a: 0, b: k, openA: strict, openB: strict }
  const xL = 46, xR = 300, W = 340, H = 60
  const pad = k * 0.35 + 1
  const valToX = (v) => xL + ((v + pad) / (k + 2 * pad)) * (xR - xL)
  const body = `<g transform="translate(0,10)">${solRow(sol, null, valToX, xL, xR, 0)}</g>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${body}</svg>`
  const expr = `x² − ${k}x`
  const correct = `${expr} ${rel} 0`
  const otherRels = shuffle([">", "<", "≥", "≤"].filter((r) => r !== rel)).slice(0, 2)
  const distr = [expr, ...otherRels.map((r) => `${expr} ${r} 0`)]   // «голое» + два др. знака
  const mc = mcBlock(correct, distr)
  return {
    condition_text: `Укажите неравенство, решение которого изображено на рисунке.\n${mc.text}`,
    answer: mc.answer,
    image_url: svgToDataUrl(svg),
  }
}

// ── Шаблоны ОГЭ №14 (КЭС 4.2 — прогрессии) ───────────────────────────────────
// Банк ФИПИ по №14 — только текстовые сценарии-«одёжки» (амфитеатр, торможение,
// поезд, охлаждение, изотоп, бактерии, мячик); абстрактных «дана прогрессия» нет.

const seats = (x) => plural(x, "место", "места", "мест")

// АП: сколько мест в n-м ряду амфитеатра (aₙ = a₁ + (n−1)d).
function t14ArithTerm() {
  const a1 = randInt(15, 25), d = randInt(2, 4), R = randInt(10, 18), n = randInt(6, R)
  return {
    condition_text: `В амфитеатре ${R} рядов. В первом ряду ${a1} ${seats(a1)}, а в каждом следующем на ${d} ${seats(d)} больше, чем в предыдущем. Сколько мест в ${n}-м ряду амфитеатра?`,
    answer: String(a1 + (n - 1) * d),
  }
}

// АП: сколько всего мест в амфитеатре (сумма Sᵣ = R(2a₁+(R−1)d)/2).
function t14ArithSum() {
  const a1 = randInt(14, 25), d = randInt(2, 4), R = randInt(10, 18)
  return {
    condition_text: `В амфитеатре ${R} рядов. В первом ряду ${a1} ${seats(a1)}, а в каждом следующем на ${d} ${seats(d)} больше, чем в предыдущем. Сколько всего мест в амфитеатре?`,
    answer: String(R * (2 * a1 + (R - 1) * d) / 2),
  }
}

// АП: даны два ряда (i-й и j-й), найти число мест в последнем ряду.
function t14TwoRows() {
  const d = randInt(2, 4), i = randInt(3, 6), gap = randInt(3, 5), j = i + gap
  const ai = randInt(20, 32), aj = ai + gap * d, R = randInt(j + 2, j + 7)
  return {
    condition_text:
      `В амфитеатре ${R} рядов, причём в каждом следующем ряду на одно и то же число мест больше, ` +
      `чем в предыдущем. В ${i}-м ряду ${ai} ${seats(ai)}, а в ${j}-м ряду ${aj} ${seats(aj)}. ` +
      `Сколько мест в последнем ряду амфитеатра?`,
    answer: String(ai + (R - i) * d),
  }
}

// АП (убывающая): путь при торможении за первые N секунд (Sₙ, d<0).
function t14Braking() {
  let a1, d, N
  do { a1 = randInt(20, 45); d = randInt(3, 7); N = randInt(4, 6) } while (a1 - (N - 1) * d < 2)
  return {
    condition_text:
      `Водитель автомобиля начал торможение. За первую секунду после начала торможения автомобиль ` +
      `проехал ${a1} м, а за каждую следующую секунду он проезжал на ${d} м меньше, чем за предыдущую. ` +
      `Сколько метров автомобиль прошёл за первые ${N} секунд торможения?`,
    answer: String(N * (2 * a1 - (N - 1) * d) / 2),
  }
}

// АП (десятичная, возрастающая): путь поезда за первые N секунд (ответ — десятичный).
function t14Train() {
  const a1t = randInt(4, 9), dt = randInt(1, 3), N = randInt(6, 9)  // в десятых долях метра
  return {
    condition_text:
      `Поезд начал движение от станции. За первую секунду состав сдвинулся на ${decStr([a1t, 10])} м, ` +
      `а за каждую следующую секунду он проходил на ${decStr([dt, 10])} м больше, чем за предыдущую. ` +
      `Сколько метров состав прошёл за первые ${N} секунд движения?`,
    answer: decStr([N * (2 * a1t + (N - 1) * dt), 20]),
  }
}

// Линейное убывание: температура через N минут равномерного охлаждения (T₀ − N·x).
function t14Cooling() {
  const x = randInt(2, 5), N = randInt(3, 8), T0 = N * x + randInt(3, 25)
  return {
    condition_text:
      `При проведении опыта вещество равномерно охлаждали в течение 10 минут. При этом каждую минуту ` +
      `его температура уменьшалась на ${x} °C. Найдите температуру вещества в градусах Цельсия через ` +
      `${N} минут после начала опыта, если начальная температура вещества составляла ${T0} °C.`,
    answer: String(T0 - N * x),
  }
}

// ГП (убывающая вдвое): масса радиоактивного изотопа через k периодов полураспада.
function t14GeomHalf() {
  const k = randInt(2, 5), base = pick([3, 5, 6, 7, 9, 10, 12, 15]), M = base * 2 ** k, T = pick([5, 7, 8, 10])
  return {
    condition_text:
      `В ходе распада радиоактивного изотопа его масса уменьшается вдвое каждые ${T} минут. ` +
      `В начальный момент масса изотопа составляла ${M} мг. Найдите массу изотопа через ${k * T} минут. ` +
      `Ответ дайте в миллиграммах.`,
    answer: String(base),
  }
}

// ГП (растущая): масса колонии микроорганизмов через k периодов (M·rᵏ).
function t14Bacteria() {
  const M = randInt(2, 25), r = pick([2, 3, 4]), T = pick([20, 30]), k = randInt(2, 3)
  return {
    condition_text:
      `В ходе биологического эксперимента в чашку Петри с питательной средой поместили колонию ` +
      `микроорганизмов массой ${M} мг. За каждые ${T} минут масса колонии увеличивается в ${r} раза. ` +
      `Найдите массу колонии микроорганизмов через ${k * T} минут после начала эксперимента. ` +
      `Ответ дайте в миллиграммах.`,
    answer: String(M * r ** k),
  }
}

// ГП (убывающая в r раз): при каком прыжке мячик впервые не достигнет порога высоты.
function t14Ball() {
  const r = pick([2, 3])
  const h1cm = pick([120, 160, 180, 240, 270, 320, 360, 400, 480, 540, 640, 720, 810])
  let thrcm, k
  do {
    thrcm = pick([5, 10, 15, 20, 25, 30, 40, 45, 50, 60])
    k = 1
    while (!(h1cm < thrcm * r ** (k - 1)) && k <= 12) k++
  } while (thrcm > h1cm || k < 2 || k > 7)
  return {
    condition_text:
      `Каучуковый мячик с силой бросили на асфальт. Отскочив, мячик подпрыгнул на ${decStr([h1cm, 100])} м, ` +
      `а при каждом следующем прыжке он поднимался на высоту в ${r} раза меньше предыдущей. ` +
      `При каком по счёту прыжке мячик в первый раз не достигнет высоты ${thrcm} см?`,
    answer: String(k),
  }
}

// ── Шаблоны с картинкой (SVG) ────────────────────────────────────────────────
//
// Инвариант: на чертеже подписываются ТОЛЬКО данные величины. Искомая величина
// (ответ) никогда не выводится числом на картинке — иначе автопроверка теряет смысл.
// data-* атрибуты не видны на растре/в <img> и служат для самопроверки в тестах.

// №7. Координатная прямая: 4 точки A–D, одна соответствует числу N. Какая?
function t7CoordPoints() {
  const step = pick([5, 10])
  const minor = step === 10 ? 2 : 1
  const S = pick([-10, 0, 10, 20, 30, 40])
  const span = 3 * step
  const zone = span / 4
  // по одной точке-кандидату в каждой из 4 зон (не на подписанных делениях)
  const vals = []
  for (let i = 0; i < 4; i++) {
    const cand = []
    for (let v = Math.ceil((S + i * zone) / minor) * minor; v < S + (i + 1) * zone; v += minor) {
      if (v > S && v < S + span && (v - S) % step !== 0) cand.push(v)
    }
    if (!cand.length) return t7CoordPoints()      // зона без кандидатов — пересобрать
    vals.push(pick(cand))
  }
  const letters = ["A", "B", "C", "D"]
  const targetIdx = randInt(0, 3)
  const N = vals[targetIdx]

  const W = 640, H = 110, axisY = 70, padL = 45, plotW = W - 90
  const xOf = (v) => padL + ((v - S) / span) * plotW
  let el = ""
  el += `<line x1="${xOf(S) - 18}" y1="${axisY}" x2="${xOf(S + span) + 22}" y2="${axisY}" stroke="#1c1c1e" stroke-width="1.5"/>`
  el += `<polygon points="${xOf(S + span) + 22},${axisY} ${xOf(S + span) + 14},${axisY - 4} ${xOf(S + span) + 14},${axisY + 4}" fill="#1c1c1e"/>`
  for (let v = S; v <= S + span; v += minor) {
    const major = (v - S) % step === 0
    el += `<line x1="${xOf(v)}" y1="${axisY - (major ? 7 : 4)}" x2="${xOf(v)}" y2="${axisY + (major ? 7 : 4)}" stroke="#1c1c1e" stroke-width="1"/>`
    if (major) el += `<text data-role="tick" data-val="${v}" x="${xOf(v)}" y="${axisY + 24}" font-size="15" text-anchor="middle" fill="#1c1c1e">${v}</text>`
  }
  vals.forEach((v, i) => {
    el += `<circle data-role="pt" data-letter="${letters[i]}" cx="${xOf(v)}" cy="${axisY}" r="4.5" fill="#1c1c1e"/>`
    el += `<text x="${xOf(v)}" y="${axisY - 14}" font-size="16" text-anchor="middle" fill="#1c1c1e">${letters[i]}</text>`
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${el}</svg>`

  const opts = letters.map((L) => `точка ${L}`)
  return {
    condition_text:
      `На координатной прямой отмечены точки A, B, C и D. Одна из них соответствует числу ` +
      `${N}. Какая это точка?\n${opts.map((o, i) => `${i + 1}) ${o}`).join("\n")}`,
    answer: String(targetIdx + 1),
    image_url: svgToDataUrl(svg),
  }
}

// №7. Число √n на координатной прямой: 4 точки A–D в целочисленных промежутках,
// одна соответствует √n. Какая? (КЭС 1.4)
function t7SqrtPoint() {
  let n; do { n = randInt(2, 90) } while (Number.isInteger(Math.sqrt(n)))
  const root = Math.sqrt(n)
  const k = Math.floor(root)                 // √n ∈ (k, k+1)
  const slot = randInt(0, 3)                 // в каком из 4 промежутков лежит целевая точка
  const S = k - slot
  if (S < 0) return t7SqrtPoint()            // ось начинаем с 0 — так проще читать
  const span = 4                             // 4 единичных промежутка, деления S..S+4
  const letters = ["A", "B", "C", "D"]
  // по точке в каждом промежутке [S+i, S+i+1]; целевая — ровно в √n, прочие — внутри своего
  const vals = [0, 1, 2, 3].map((i) => i === slot ? root : (S + i) + (0.25 + Math.random() * 0.5))

  const W = 640, H = 110, axisY = 70, padL = 45, plotW = W - 90
  const xOf = (v) => padL + ((v - S) / span) * plotW
  let el = ""
  el += `<line x1="${xOf(S) - 18}" y1="${axisY}" x2="${xOf(S + span) + 22}" y2="${axisY}" stroke="#1c1c1e" stroke-width="1.5"/>`
  el += `<polygon points="${xOf(S + span) + 22},${axisY} ${xOf(S + span) + 14},${axisY - 4} ${xOf(S + span) + 14},${axisY + 4}" fill="#1c1c1e"/>`
  for (let v = S; v <= S + span; v++) {
    el += `<line x1="${xOf(v)}" y1="${axisY - 7}" x2="${xOf(v)}" y2="${axisY + 7}" stroke="#1c1c1e" stroke-width="1"/>`
    el += `<text data-role="tick" data-val="${v}" x="${xOf(v)}" y="${axisY + 24}" font-size="15" text-anchor="middle" fill="#1c1c1e">${v}</text>`
  }
  vals.forEach((v, i) => {
    el += `<circle data-role="pt" data-letter="${letters[i]}" data-val="${v}" cx="${xOf(v)}" cy="${axisY}" r="4.5" fill="#1c1c1e"/>`
    el += `<text x="${xOf(v)}" y="${axisY - 14}" font-size="16" text-anchor="middle" fill="#1c1c1e">${letters[i]}</text>`
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${el}</svg>`

  return {
    condition_text:
      `На координатной прямой отмечены точки A, B, C и D. Одна из этих точек соответствует ` +
      `числу ${rT(n)}. Какая это точка?\n` + letters.map((L, i) => `${i + 1}) ${L}`).join("\n"),
    answer: String(slot + 1),
    image_url: svgToDataUrl(svg),
  }
}

// №7. Верное утверждение о числах a и b, отмеченных на прямой. (КЭС 1.3)
function t7Statements() {
  let a, b
  do {
    a = randInt(-38, 30) / 10
    b = randInt(-30, 38) / 10
  } while (!(a < b && Math.abs(a) > 0.4 && Math.abs(b) > 0.4 && Math.abs(a - b) > 0.7 &&
             Math.abs(Math.abs(a) - Math.abs(b)) > 0.4 && Math.abs(a + b) > 0.4))
  // три комплементарные пары: у каждой пары ровно одно утверждение верно
  const pairs = [
    [{ t: "a·b > 0", f: (a, b) => a * b > 0 }, { t: "a·b < 0", f: (a, b) => a * b < 0 }],
    [{ t: "a + b > 0", f: (a, b) => a + b > 0 }, { t: "a + b < 0", f: (a, b) => a + b < 0 }],
    [{ t: "|a| > |b|", f: (a, b) => Math.abs(a) > Math.abs(b) }, { t: "|a| < |b|", f: (a, b) => Math.abs(a) < Math.abs(b) }],
  ]
  const trues = [], falses = []
  for (const [p, q] of pairs) { (p.f(a, b) ? trues : falses).push(p.t); (q.f(a, b) ? trues : falses).push(q.t) }
  falses.push("a − b > 0")                    // всегда ложно (a < b) — дополнительный дистрактор
  const correct = pick(trues)
  const opts = shuffle([correct, ...shuffle(falses).slice(0, 3)])
  const answerIdx = opts.indexOf(correct) + 1

  const W = 520, H = 92, axisY = 54, padL = 30, plotW = W - 60
  const lo = -4.2, hi = 4.2
  const xOf = (v) => padL + ((v - lo) / (hi - lo)) * plotW
  let el = `<line x1="${xOf(lo)}" y1="${axisY}" x2="${xOf(hi) + 10}" y2="${axisY}" stroke="#1c1c1e" stroke-width="1.5"/>`
  el += `<polygon points="${xOf(hi) + 10},${axisY} ${xOf(hi) + 2},${axisY - 4} ${xOf(hi) + 2},${axisY + 4}" fill="#1c1c1e"/>`
  for (let v = -4; v <= 4; v++) {
    el += `<line data-role="tick" data-val="${v}" data-x="${xOf(v)}" x1="${xOf(v)}" y1="${axisY - 6}" x2="${xOf(v)}" y2="${axisY + 6}" stroke="#1c1c1e" stroke-width="1"/>`
    if (v === 0) el += `<text x="${xOf(v)}" y="${axisY + 22}" font-size="14" text-anchor="middle" fill="#1c1c1e">0</text>`
  }
  for (const [name, v] of [["a", a], ["b", b]]) {
    el += `<circle data-role="pt" data-name="${name}" data-val="${v}" cx="${xOf(v)}" cy="${axisY}" r="4.5" fill="#1c1c1e"/>`
    el += `<text x="${xOf(v)}" y="${axisY - 13}" font-size="16" font-style="italic" text-anchor="middle" fill="#1c1c1e">${name}</text>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${el}</svg>`

  return {
    condition_text:
      `На координатной прямой отмечены числа a и b. Какое из следующих утверждений ` +
      `является верным?\n` + opts.map((o, i) => `${i + 1}) ${o}`).join("\n"),
    answer: String(answerIdx),
    image_url: svgToDataUrl(svg),
  }
}

// №7. Какому из чисел (√, дробь, десятичное) соответствует отмеченная точка. (КЭС 1.4)
function t7NumMarked() {
  const S = pick([1, 2]), span = 5           // деления S..S+5, целые
  const ks = shuffle([0, 1, 2, 3, 4]).slice(0, 4).map((i) => S + i)  // 4 разных промежутка
  // для промежутка (k, k+1) собираем «красивое» число внутри него, в одной из форм
  const numFor = (k) => {
    const form = pick(["sqrt", "frac", "dec"])
    if (form === "sqrt") {
      let m; do { m = randInt(k * k + 1, (k + 1) * (k + 1) - 1) } while (Number.isInteger(Math.sqrt(m)) || Math.abs(Math.sqrt(m) - Math.round(Math.sqrt(m))) < 0.12)
      return { label: rT(m), val: Math.sqrt(m) }
    }
    if (form === "frac") {
      const q = pick([3, 4, 5]); const p = k * q + randInt(1, q - 1)
      return { label: fT(p, q), val: p / q }
    }
    const d = randInt(1, 9)
    return { label: decStr([k * 10 + d, 10]).replace(".", ","), val: k + d / 10 }
  }
  const options = ks.map(numFor)
  const correctIdx = randInt(0, 3)
  const marked = options[correctIdx].val

  const W = 620, H = 108, axisY = 66, padL = 45, plotW = W - 90
  const xOf = (v) => padL + ((v - S) / span) * plotW
  let el = `<line x1="${xOf(S) - 16}" y1="${axisY}" x2="${xOf(S + span) + 20}" y2="${axisY}" stroke="#1c1c1e" stroke-width="1.5"/>`
  el += `<polygon points="${xOf(S + span) + 20},${axisY} ${xOf(S + span) + 12},${axisY - 4} ${xOf(S + span) + 12},${axisY + 4}" fill="#1c1c1e"/>`
  for (let v = S; v <= S + span; v++) {
    el += `<line x1="${xOf(v)}" y1="${axisY - 7}" x2="${xOf(v)}" y2="${axisY + 7}" stroke="#1c1c1e" stroke-width="1"/>`
    el += `<text data-role="tick" data-val="${v}" x="${xOf(v)}" y="${axisY + 24}" font-size="15" text-anchor="middle" fill="#1c1c1e">${v}</text>`
  }
  el += `<circle data-role="mk" data-val="${marked}" cx="${xOf(marked)}" cy="${axisY}" r="4.5" fill="#1c1c1e"/>`
  el += `<text x="${xOf(marked)}" y="${axisY - 14}" font-size="16" text-anchor="middle" fill="#1c1c1e">A</text>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${el}</svg>`

  return {
    condition_text:
      `На координатной прямой отмечена точка A. Какому из следующих чисел она соответствует?\n` +
      options.map((o, i) => `${i + 1}) ${o.label}`).join("\n"),
    answer: String(correctIdx + 1),
    image_url: svgToDataUrl(svg),
  }
}

// №7. На прямой отмечено одно число a; выбрать верное утверждение вида a−n>0 / n−a>0.
// Дистракторы — то же выражение без знака (банк: «1) a−5  2) 5−a  3) a−7>0 …»). (КЭС 1.4)
function t7SingleNumber() {
  const t = randInt(3, 7)                          // a ∈ (t, t+1)
  const a = +(t + 0.25 + Math.random() * 0.5).toFixed(2)
  const trueStmt = pick([`a − ${t} > 0`, `${t + 1} − a > 0`])   // a>t и a<t+1 — оба верны
  const falseStmt = pick([`a − ${t + 2} > 0`, `${t - 1} − a > 0`]) // a<t+2 и a>t−1 — оба ложны
  const bare = [`a − ${randInt(t + 1, t + 3)}`, `${randInt(t - 2, t)} − a`]  // без знака → не утверждения
  const opts = shuffle([trueStmt, falseStmt, ...bare])
  const answerIdx = opts.indexOf(trueStmt) + 1

  const lo = t - 2, hi = t + 3
  const W = 560, H = 92, axisY = 54, padL = 34, plotW = W - 68
  const xOf = (v) => padL + ((v - lo) / (hi - lo)) * plotW
  let el = `<line x1="${xOf(lo)}" y1="${axisY}" x2="${xOf(hi) + 10}" y2="${axisY}" stroke="#1c1c1e" stroke-width="1.5"/>`
  el += `<polygon points="${xOf(hi) + 10},${axisY} ${xOf(hi) + 2},${axisY - 4} ${xOf(hi) + 2},${axisY + 4}" fill="#1c1c1e"/>`
  for (let v = lo; v <= hi; v++) {
    el += `<line x1="${xOf(v)}" y1="${axisY - 6}" x2="${xOf(v)}" y2="${axisY + 6}" stroke="#1c1c1e" stroke-width="1"/>`
    el += `<text data-role="tick" data-val="${v}" x="${xOf(v)}" y="${axisY + 22}" font-size="14" text-anchor="middle" fill="#1c1c1e">${v}</text>`
  }
  el += `<circle data-role="pt" data-val="${a}" cx="${xOf(a)}" cy="${axisY}" r="4.5" fill="#1c1c1e"/>`
  el += `<text x="${xOf(a)}" y="${axisY - 13}" font-size="16" font-style="italic" text-anchor="middle" fill="#1c1c1e">a</text>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${el}</svg>`
  return {
    condition_text:
      `На координатной прямой отмечено число a. Какое из утверждений для этого числа ` +
      `является верным?\n` + opts.map((o, i) => `${i + 1}) ${o}`).join("\n"),
    answer: String(answerIdx),
    image_url: svgToDataUrl(svg),
  }
}

// №7. Три числа p,q,r (или x,y,z) на прямой; какая из разностей отрицательна?
// Вариант 4 — «ни одна из них». (КЭС 6.1)
function t7Diffs() {
  const names = pick([["p", "q", "r"], ["x", "y", "z"]])
  let pos
  do { pos = [0, 1, 2].map(() => +(randInt(-40, 40) / 10).toFixed(1)) }
  while (new Set(pos).size < 3 ||
    Math.min(Math.abs(pos[0] - pos[1]), Math.abs(pos[0] - pos[2]), Math.abs(pos[1] - pos[2])) < 0.8)
  // все три пары со случайной ориентацией
  const diffs = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => (Math.random() < 0.5 ? [i, j] : [j, i]))
  const neg = diffs.filter(([i, j]) => pos[i] - pos[j] < 0)
  if (neg.length > 1) return t7Diffs()             // держим единственный ответ, как в банке
  const optDiffs = shuffle(diffs)
  const label = ([i, j]) => `${names[i]} − ${names[j]}`
  const answerIdx = neg.length === 0
    ? 4
    : optDiffs.findIndex(([i, j]) => i === neg[0][0] && j === neg[0][1]) + 1

  const lo = -4.6, hi = 4.6
  const W = 520, H = 92, axisY = 54, padL = 30, plotW = W - 60
  const xOf = (v) => padL + ((v - lo) / (hi - lo)) * plotW
  let el = `<line x1="${xOf(lo)}" y1="${axisY}" x2="${xOf(hi) + 10}" y2="${axisY}" stroke="#1c1c1e" stroke-width="1.5"/>`
  el += `<polygon points="${xOf(hi) + 10},${axisY} ${xOf(hi) + 2},${axisY - 4} ${xOf(hi) + 2},${axisY + 4}" fill="#1c1c1e"/>`
  for (let v = -4; v <= 4; v++) {
    el += `<line x1="${xOf(v)}" y1="${axisY - 6}" x2="${xOf(v)}" y2="${axisY + 6}" stroke="#1c1c1e" stroke-width="1"/>`
    if (v === 0) el += `<text x="${xOf(v)}" y="${axisY + 22}" font-size="14" text-anchor="middle" fill="#1c1c1e">0</text>`
  }
  names.forEach((nm, i) => {
    el += `<circle data-role="pt" data-name="${nm}" data-val="${pos[i]}" cx="${xOf(pos[i])}" cy="${axisY}" r="4.5" fill="#1c1c1e"/>`
    el += `<text x="${xOf(pos[i])}" y="${axisY - 13}" font-size="16" font-style="italic" text-anchor="middle" fill="#1c1c1e">${nm}</text>`
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${el}</svg>`
  const opts = [...optDiffs.map(label), "ни одна из них"]
  return {
    condition_text:
      `На координатной прямой отмечены числа ${names[0]}, ${names[1]} и ${names[2]}. ` +
      `Какая из разностей ${optDiffs.map(label).join(", ")} отрицательна?\n` +
      opts.map((o, i) => `${i + 1}) ${o}`).join("\n"),
    answer: String(answerIdx),
    image_url: svgToDataUrl(svg),
  }
}

// ── №10. Диаграмма Эйлера (КЭС 8.2) ───────────────────────────────────────────
// Банк ФИПИ содержит ЧЕТЫРЕ структурных типажа диаграммы Эйлера (по 10 задач):
//   A — точки-исходы равновозможны:      P = (точек в области) / (всего точек)
//   B — у каждой точки подписана её вер.: P = сумма вероятностей точек области
//   C — в каждой области указано число:   P = (исходов области) / (всего исходов)
//   D — в каждой из 4 областей — вер.:    P = сумма вероятностей областей события
// Внутри каждого типажа ФИПИ спрашивает одно из ДЕСЯТИ событий (A, B, пересечения и
// объединения с дополнениями) — см. EU_EVENTS. Области: oA (только A), ab (A∩B),
// oB (только B), ne (ни то ни другое). Геометрия у ФИПИ — два широких ЭЛЛИПСА без
// заливки в рамке; подписи A и B — по бокам на средней высоте; вынесена в помощники.
// Пара эллипсов отцентрирована в рамке (центр рамки x=180), поля ~19px слева и справа.
const EU = { W: 360, HH: 220, cA: { x: 121, y: 112, rx: 92, ry: 52 }, cB: { x: 239, y: 112, rx: 92, ry: 52 } }
const euInA = (x, y, m = 0) => ((x - EU.cA.x) ** 2) / ((EU.cA.rx - m) ** 2) + ((y - EU.cA.y) ** 2) / ((EU.cA.ry - m) ** 2) < 1
const euInB = (x, y, m = 0) => ((x - EU.cB.x) ** 2) / ((EU.cB.rx - m) ** 2) + ((y - EU.cB.y) ** 2) / ((EU.cB.ry - m) ** 2) < 1
const euRegion = (x, y) => {
  const ia = euInA(x, y, 14), ib = euInB(x, y, 14)   // ≥14px внутрь от контура — точка не на линии
  if (ia && ib) return "ab"
  if (ia && !euInB(x, y, -8)) return "oA"
  if (ib && !euInA(x, y, -8)) return "oB"
  if (!euInA(x, y, -8) && !euInB(x, y, -8)) return "ne"
  return null
}
// Центры четырёх областей — куда печатать числа/вероятности (типажи C и D).
// «ne» (вне обоих) ФИПИ печатает сверху над эллипсами.
const EU_CENTER = { oA: [93, 117], ab: [180, 117], oB: [267, 117], ne: [180, 40] }
// Каркас: рамка, два эллипса БЕЗ заливки (только контур, как у ФИПИ), курсивные
// подписи A и B у левого/правого краёв на средней высоте.
function euFrame() {
  const { cA, cB } = EU
  let el = `<rect x="10" y="12" width="340" height="196" fill="none" stroke="#1c1c1e" stroke-width="1.2"/>`
  el += `<ellipse cx="${cA.x}" cy="${cA.y}" rx="${cA.rx}" ry="${cA.ry}" fill="none" stroke="#1c1c1e" stroke-width="1.4"/>`
  el += `<ellipse cx="${cB.x}" cy="${cB.y}" rx="${cB.rx}" ry="${cB.ry}" fill="none" stroke="#1c1c1e" stroke-width="1.4"/>`
  el += `<text x="43" y="117" font-size="17" font-style="italic" fill="#1c1c1e">A</text>`
  el += `<text x="315" y="117" font-size="17" font-style="italic" fill="#1c1c1e">B</text>`
  return el
}
const euSvg = (el) => `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${EU.W}" height="${EU.HH}" viewBox="0 0 ${EU.W} ${EU.HH}"><rect width="${EU.W}" height="${EU.HH}" fill="#fff"/>${el}</svg>`
// Раскладка точек по областям: {oA:n,…} → {oA:[[x,y]…],…} или null при нехватке позиций.
// minGap — минимальное расстояние между ЛЮБЫМИ двумя точками (по всем областям), чтобы
// точки не кучковались, а подписи вероятностей (типаж B) не наезжали друг на друга.
// labelSafe — сузить области до «безопасных зон», где точка И её боковая подпись гарантированно
// не задевают дуги эллипсов: oA — левее линзы, oB — правее линзы, ab — центр линзы (подпись пойдёт
// под точкой). Границы линзы по высоте центра: e1 справа x≈213, e2 слева x≈147.
function euDots(counts, minGap = 30, labelSafe = false) {
  const buckets = { oA: [], ab: [], oB: [], ne: [] }
  // Зоны курсивных подписей A/B (см. euFrame) — точки туда не ставим, чтобы не налезали.
  const nearLabel = (x, y) => (Math.abs(x - 47) < 22 && Math.abs(y - 112) < 20) || (Math.abs(x - 317) < 22 && Math.abs(y - 112) < 20)
  const inZone = (r, x, y) => {
    if (!labelSafe) return true
    if (r === "oA") return x >= 52 && x <= 108        // подпись справа не дойдёт до линзы (147)
    if (r === "oB") return x >= 252 && x <= 320       // подпись слева не дойдёт до линзы (213)
    if (r === "ab") return x >= 158 && x <= 202 && Math.abs(y - 112) <= 20   // широкая середина линзы
    return true                                        // ne — снаружи, места хватает
  }
  for (let x = 28; x <= 332; x += 15) for (let y = 26; y <= 196; y += 15) {
    const px = x + randInt(-3, 3), py = y + randInt(-3, 3)
    if (nearLabel(px, py)) continue
    const r = euRegion(px, py)
    if (r && inZone(r, px, py)) buckets[r].push([px, py])
  }
  // Жадно набираем точки с соблюдением дистанции; если не хватило — постепенно ослабляем.
  const order = ["oA", "ab", "oB", "ne"]
  for (let attempt = 0; attempt < 14; attempt++) {
    const gap2 = (minGap - attempt * 2) ** 2
    const chosen = []
    const out = {}
    let ok = true
    for (const k of order) {
      const need = counts[k] || 0
      const got = []
      for (const p of shuffle(buckets[k])) {
        if (got.length >= need) break
        if (chosen.every((q) => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 >= gap2)) { got.push(p); chosen.push(p) }
      }
      if (got.length < need) { ok = false; break }
      out[k] = got
    }
    if (ok) return out
  }
  return null
}
// Подпись числа/вероятности в центре области.
const euPut = (reg, txt) => { const [x, y] = EU_CENTER[reg]; return `<text x="${x}" y="${y}" font-size="16" text-anchor="middle" fill="#1c1c1e">${txt}</text>` }

// Десять событий, которые ФИПИ спрашивает по любой из четырёх диаграмм. fav(R) —
// сколько «единиц» (точек / исходов / сотых / десятых) попадает в событие; R —
// {oA,ab,oB,ne}. Надчёркивание (дополнение) — комбинирующим U+0305 над буквой,
// браузер рисует его чертой, как у ФИПИ («Ā ∩ B», «A ∪ B̄»).
const euOv = (s) => s + "̅"
const EU_EVENTS = [
  ["A", (r) => r.oA + r.ab],
  ["B", (r) => r.oB + r.ab],
  ["A ∩ B", (r) => r.ab],
  ["A ∪ B", (r) => r.oA + r.ab + r.oB],
  [`${euOv("A")} ∩ B`, (r) => r.oB],
  [`A ∩ ${euOv("B")}`, (r) => r.oA],
  [`${euOv("A")} ∩ ${euOv("B")}`, (r) => r.ne],
  [`${euOv("A")} ∪ B`, (r) => r.ab + r.oB + r.ne],
  [`A ∪ ${euOv("B")}`, (r) => r.oA + r.ab + r.ne],
  [`${euOv("A")} ∪ ${euOv("B")}`, (r) => r.oA + r.oB + r.ne],
]
const euPickEvent = () => { const [name, fav] = pick(EU_EVENTS); return { name, fav } }

// Типаж A: точки — равновозможные исходы. P = (точек в области)/(всего точек).
function t10Euler() {
  // Как у ФИПИ: ~9–10 точек, из них лишь 1–3 «вне обоих» (не десятки в углах).
  // total = 10 → ответ всегда в десятых.
  const total = 10
  let oA, ab, oB, ne
  do {
    ab = randInt(1, 2)                       // пересечение A∩B
    oA = randInt(2, 4)                        // только A
    oB = randInt(2, 4)                        // только B
    ne = total - oA - oB - ab                 // вне обоих
  } while (ne < 1 || ne > 3)
  const R = { oA, ab, oB, ne }
  const ev = euPickEvent()
  const dots = euDots(R)
  if (!dots) return t10Euler()              // редкая нехватка позиций — пересобрать
  let el = euFrame()
  for (const k of Object.keys(dots)) for (const [x, y] of dots[k]) el += `<circle cx="${x}" cy="${y}" r="3.1" fill="#1c1c1e"/>`
  return {
    condition_text:
      `На рисунке изображена диаграмма Эйлера для случайных событий A и B в некотором ` +
      `случайном опыте. Точками показаны все равновозможные элементарные события опыта. ` +
      `Найдите вероятность события ${ev.name}.`,
    answer: prob(ev.fav(R), total),
    image_url: svgToDataUrl(euSvg(el)),
  }
}

// Типаж B: у каждой точки подписана её вероятность (сумма всех = 1).
// P(события) = сумма вероятностей точек, попавших в область события.
function t10EulerB() {
  const counts = { oA: randInt(2, 3), ab: randInt(1, 2), oB: randInt(2, 3), ne: randInt(1, 2) }
  const dots = euDots(counts, 44, true)    // крупнее зазор + «безопасные зоны»: рядом с точкой ещё и подпись
  if (!dots) return t10EulerB()
  const order = ["oA", "ab", "oB", "ne"]
  const nTotal = order.reduce((s, k) => s + counts[k], 0)
  const base = Array(nTotal).fill(1)        // вероятности в «пятёрках сотых»: у каждой точки ≥5 сотых
  for (let rem = 20 - nTotal; rem > 0; rem--) base[randInt(0, nTotal - 1)]++   // всего 20·5=100 сотых
  const vals = base.map((u) => u * 5)
  let idx = 0
  const R = { oA: 0, ab: 0, oB: 0, ne: 0 }
  const labeled = []
  for (const k of order) for (const [x, y] of dots[k]) { const v = vals[idx++]; R[k] += v; labeled.push([x, y, v]) }
  const ev = euPickEvent()
  let el = euFrame()
  for (const [x, y, v] of labeled) {
    el += `<circle cx="${x}" cy="${y}" r="3" fill="#1c1c1e"/>`
    // Подпись уводим от дуг: левее линзы — вправо, правее линзы — влево, в самой линзе — ВНИЗ
    // под точку (по центру), чтобы не пересекать боковые дуги эллипсов.
    let tx = x, ty = y + 4, anc = "middle"
    if (x <= 147) { tx = x + 6; anc = "start" }
    else if (x >= 213) { tx = x - 6; anc = "end" }
    else { ty = y + 15 }                    // в линзе — подпись под точкой
    el += `<text x="${tx}" y="${ty}" font-size="12" text-anchor="${anc}" fill="#1c1c1e">${prob(v, 100)}</text>`
  }
  return {
    condition_text:
      `На рисунке изображена диаграмма Эйлера для случайных событий A и B в некотором ` +
      `случайном опыте. Точками показаны все элементарные события и около каждого указана ` +
      `его вероятность. Найдите вероятность события ${ev.name}.`,
    answer: prob(ev.fav(R), 100),
    image_url: svgToDataUrl(euSvg(el)),
  }
}

// Типаж C: в каждой области указано число равновозможных исходов.
// P(события) = (исходов в области события)/(всего исходов). Числа = (доли в десятых)×m,
// поэтому итог всегда «круглый» (как у ФИПИ: 18/6/12/24 = 3/1/2/4 × 6).
function t10EulerC() {
  let a, b, c, d                                            // доли в десятых, сумма = 10
  do { a = randInt(1, 4); b = randInt(1, 3); c = randInt(1, 4); d = 10 - a - b - c } while (d < 1)
  const m = pick([3, 4, 5, 6])
  const R = { oA: a * m, ab: b * m, oB: c * m, ne: d * m }
  const total = 10 * m
  const ev = euPickEvent()
  let el = euFrame()
  el += euPut("oA", R.oA) + euPut("ab", R.ab) + euPut("oB", R.oB) + euPut("ne", R.ne)
  return {
    condition_text:
      `На рисунке изображена диаграмма Эйлера для случайных событий A и B в некотором ` +
      `случайном опыте с равновозможными исходами. В каждой области указано, сколько исходов ` +
      `принадлежит этой области. Найдите вероятность события ${ev.name}.`,
    answer: prob(ev.fav(R), total),
    image_url: svgToDataUrl(euSvg(el)),
  }
}

// Типаж D: в каждой из четырёх областей указана вероятность (сумма = 1).
// P(события) = сумма вероятностей областей, входящих в событие.
function t10EulerD() {
  let a, b, c, d                                            // вероятности в десятых, сумма = 10
  do { a = randInt(1, 4); b = randInt(1, 3); c = randInt(1, 4); d = 10 - a - b - c } while (d < 1)
  const R = { oA: a, ab: b, oB: c, ne: d }
  const ev = euPickEvent()
  let el = euFrame()
  el += euPut("oA", prob(a, 10)) + euPut("ab", prob(b, 10)) + euPut("oB", prob(c, 10)) + euPut("ne", prob(d, 10))
  return {
    condition_text:
      `На рисунке изображена диаграмма Эйлера для случайных событий A и B в некотором ` +
      `случайном опыте. В каждой из четырёх областей указана вероятность соответствующего ` +
      `события. Найдите вероятность события ${ev.name}.`,
    answer: prob(ev.fav(R), 10),
    image_url: svgToDataUrl(euSvg(el)),
  }
}

// №10. Дерево случайного опыта (условная вероятность), как в банке ФИПИ.
// Корень S сверху, ветви идут ВНИЗ: 1-й этап S→A, S→Ā; 2-й этап A→B,B̄ и Ā→B,B̄
// со своими (разными для A и Ā) вероятностями. Спрашивается P(B):
//   P(B) = P(A)·P(B|A) + P(Ā)·P(B|Ā).  Все ветви одной толщины, вероятности — с запятой.
function t10Tree() {
  // Всё в сотых, чтобы ответ был точным. Два режима как у ФИПИ:
  //   «четвертями» — P(A) ∈ {0,25; 0,75}, ветви 2-го этапа ∈ {0,2; 0,4; 0,6; 0,8};
  //   «десятыми»   — P(A) в десятых, ветви 2-го этапа в десятых.
  // В обоих итог P(B) = P(A)·P(B|A) + P(Ā)·P(B|Ā) остаётся «круглым».
  let P1, QA, QN                                           // P(A), P(B|A), P(B|Ā) в сотых
  if (pick([true, false])) {
    P1 = pick([25, 75])
    QA = pick([20, 40, 60, 80])
    do { QN = pick([20, 40, 60, 80]) } while (QN === QA)
  } else {
    P1 = randInt(2, 8) * 10
    QA = randInt(1, 9) * 10
    do { QN = randInt(1, 9) * 10 } while (QN === QA)
  }
  const fav = P1 * QA + (100 - P1) * QN                    // P(B)·10000

  // Сотые → десятичная строка с ЗАПЯТОЙ (как у ФИПИ): 25→«0,25», 20→«0,2», 30→«0,3».
  const dec = (h) => (h / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",")
  const bar = (x, y) => `<line x1="${x - 6}" y1="${y - 14}" x2="${x + 6}" y2="${y - 14}" stroke="#1c1c1e" stroke-width="1.2"/>`
  const S = [150, 26], A = [70, 120], N = [230, 120]
  const L = [[28, 210], [108, 210], [192, 210], [272, 210]]     // B  B̄ | B  B̄
  const line = (a, b, w) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#1c1c1e" stroke-width="${w}"/>`
  const mid = (a, b, txt, dx) => `<text x="${(a[0] + b[0]) / 2 + dx}" y="${(a[1] + b[1]) / 2}" font-size="13" text-anchor="middle" fill="#1c1c1e">${txt}</text>`
  let el = ""
  const LW = 1.4                                           // все ветви одной толщины, как в эталоне
  el += line(S, A, LW) + line(S, N, LW)
  el += line(A, L[0], LW) + line(A, L[1], LW) + line(N, L[2], LW) + line(N, L[3], LW)
  el += mid(S, A, dec(P1), -12) + mid(S, N, dec(100 - P1), 12)
  el += mid(A, L[0], dec(QA), -12) + mid(A, L[1], dec(100 - QA), 12)
  el += mid(N, L[2], dec(QN), -12) + mid(N, L[3], dec(100 - QN), 12)
  for (const p of [S, A, N, ...L]) el += `<circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="#1c1c1e"/>`
  el += `<text x="${S[0]}" y="${S[1] - 8}" font-size="15" font-style="italic" text-anchor="middle" fill="#1c1c1e">S</text>`
  el += `<text x="${A[0] - 13}" y="${A[1] + 5}" font-size="15" font-style="italic" text-anchor="middle" fill="#1c1c1e">A</text>`
  el += `<text x="${N[0] + 14}" y="${N[1] + 5}" font-size="15" font-style="italic" text-anchor="middle" fill="#1c1c1e">A</text>` + bar(N[0] + 14, N[1] + 5)
  L.forEach((p, i) => {
    el += `<text x="${p[0]}" y="${p[1] + 20}" font-size="15" font-style="italic" text-anchor="middle" fill="#1c1c1e">B</text>`
    if (i % 2 === 1) el += bar(p[0], p[1] + 20)            // нечётные листья — B̄
  })
  const W = 300, HH = 245
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${HH}" viewBox="0 0 ${W} ${HH}"><rect width="${W}" height="${HH}" fill="#fff"/>${el}</svg>`
  return {
    condition_text: `На рисунке изображено дерево случайного опыта. Найдите вероятность события B.`,
    answer: prob(fav, 10000),
    image_url: svgToDataUrl(svg),
  }
}

// ── Шаблоны ОГЭ №11 (КЭС 5.1 — функции и графики) ─────────────────────────────
// Банк ФИПИ №11 — «установите соответствие»: три графика и три формулы (или знаки
// коэффициентов k, b у y=kx+b). Ответ — трёхзначная последовательность номеров под
// А, Б, В. Графики банк отдаёт картинками (их нет в tasks.json), поэтому рендерим
// свои: координатная плоскость с сеткой + кривая. Ответ считается кодом: каждой
// формуле график строится программно, затем графики перемешиваются, а соответствие
// пересчитывается по перестановке (disp.indexOf) — заимствования чужой разметки нет.

const GW = 150                                  // сторона одной координатной плоскости, px
const GU = 14                                   // пикселей на единицу (видно ~±4,9)

// Рациональное [n, d] (d>0, сокращено) — коэффициенты формул печатаем точно
// (½, ¾), а для графика берём число n/d.
const rv = ([n, d]) => n / d
// Модуль коэффициента токеном: целое → строкой, дробь → стоячей ⟦f⟧.
const absTok = ([n, d]) => d === 1 ? String(Math.abs(n)) : fT(Math.abs(n), d)
const isUnit = ([n, d]) => d === 1 && Math.abs(n) === 1     // ±1 → коэффициент не пишем

// y = kx + b (k=[0,1] → горизонталь y=b).
function fmtLin(k, b) {
  if (k[0] === 0) return `y=${b[0] < 0 ? "−" : ""}${absTok(b)}`
  const slope = `${k[0] < 0 ? "−" : ""}${isUnit(k) ? "" : absTok(k)}x`
  const intr = b[0] === 0 ? "" : ` ${b[0] < 0 ? "−" : "+"} ${absTok(b)}`
  return `y=${slope}${intr}`
}
// y = ax² + bx + c (b, c допускают [0,1] → член опускаем).
function fmtParab(a, b, c) {
  const sq = `${a[0] < 0 ? "−" : ""}${isUnit(a) ? "" : absTok(a)}x²`
  const lin = b[0] === 0 ? "" : ` ${b[0] < 0 ? "−" : "+"} ${isUnit(b) ? "" : absTok(b)}x`
  const cn = c[0] === 0 ? "" : ` ${c[0] < 0 ? "−" : "+"} ${absTok(c)}`
  return `y=${sq}${lin}${cn}`
}
// y = m/x (гипербола) — стоячая дробь со знаменателем x.
function fmtHyper(m) {
  return `y=${m[0] < 0 ? "−" : ""}${fT(Math.abs(m[0]), "x")}`
}

// Значение функции по спеке в точке x (для построения кривой).
function fnAt(spec, x) {
  if (spec.t === "line") return rv(spec.k) * x + rv(spec.b)
  if (spec.t === "parab") return rv(spec.a) * x * x + rv(spec.b) * x + rv(spec.c)
  if (spec.t === "sqrt") return x < 0 ? NaN : Math.sqrt(x)     // y=√x, только x≥0
  return rv(spec.m) / x                                       // hyper
}

// Кривая fn(x) как набор SVG-path: сэмплируем x, переводим в px, разрываем ломаную
// при уходе за край (гипербола у оси, парабола сверху) — вертикальных «стяжек» нет.
function curvePath(spec) {
  const c = GW / 2
  const sx = (x) => c + x * GU
  const sy = (y) => c - y * GU
  const half = (c - 6) / GU
  const M = 5                                                 // допуск за рамку, px
  const segs = []
  const sample = (x0, x1) => {
    let cur = []
    const N = 200
    for (let i = 0; i <= N; i++) {
      const x = x0 + ((x1 - x0) * i) / N
      const py = sy(fnAt(spec, x))
      if (py >= -M && py <= GW + M) cur.push(`${sx(x).toFixed(1)},${py.toFixed(1)}`)
      else if (cur.length) { segs.push(cur); cur = [] }
    }
    if (cur.length) segs.push(cur)
  }
  if (spec.t === "hyper") { sample(-half, -0.12); sample(0.12, half) }
  else sample(-half, half)
  return segs
    .map((s) => `<path d="M${s.join(" L")}" fill="none" stroke="#007AFF" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>`)
    .join("")
}

// Одна координатная плоскость GW×GW (сетка, оси со стрелками, единицы, кривая).
function plotInner(spec, clipId) {
  const c = GW / 2
  const sx = (x) => c + x * GU
  const sy = (y) => c - y * GU
  const half = (c - 6) / GU
  let grid = ""
  for (let i = -Math.floor(half); i <= half; i++) {
    if (i === 0) continue
    grid += `<line x1="${sx(i)}" y1="5" x2="${sx(i)}" y2="${GW - 5}" stroke="#ececf2" stroke-width="1"/>`
    grid += `<line x1="5" y1="${sy(i)}" x2="${GW - 5}" y2="${sy(i)}" stroke="#ececf2" stroke-width="1"/>`
  }
  const axes =
    `<line x1="3" y1="${c}" x2="${GW - 3}" y2="${c}" stroke="#1c1c1e" stroke-width="1.1"/>` +
    `<line x1="${c}" y1="${GW - 3}" x2="${c}" y2="3" stroke="#1c1c1e" stroke-width="1.1"/>` +
    `<path d="M${GW - 3},${c} l-6,-3 l0,6 z" fill="#1c1c1e"/>` +
    `<path d="M${c},3 l-3,6 l6,0 z" fill="#1c1c1e"/>` +
    `<text x="${GW - 9}" y="${c - 5}" font-size="11" font-style="italic" fill="#1c1c1e">x</text>` +
    `<text x="${c + 5}" y="12" font-size="11" font-style="italic" fill="#1c1c1e">y</text>` +
    `<text x="${c + 3}" y="${c + 12}" font-size="9" fill="#8a8a8e">0</text>` +
    `<text x="${sx(1) - 2}" y="${c + 12}" font-size="9" fill="#8a8a8e">1</text>` +
    `<text x="${c + 4}" y="${sy(1) + 3}" font-size="9" fill="#8a8a8e">1</text>`
  const curve = `<g clip-path="url(#${clipId})">${curvePath(spec)}</g>`
  return `<rect x="0.5" y="0.5" width="${GW - 1}" height="${GW - 1}" fill="none" stroke="#e5e5ea"/>${grid}${axes}${curve}`
}

// Три плоскости в ряд с подписями (labels — «1»/«А»/…), одна композитная SVG
// (generateTask отдаёт один image_url).
function plotsRow(specs, labels) {
  const gap = 18, top = 20
  const W = specs.length * GW + (specs.length - 1) * gap
  const H = GW + top
  const clipId = `c${Math.random().toString(36).slice(2, 8)}`
  let inner = `<defs><clipPath id="${clipId}"><rect x="0" y="0" width="${GW}" height="${GW}"/></clipPath></defs>`
  specs.forEach((sp, i) => {
    const ox = i * (GW + gap)
    inner += `<text x="${ox + GW / 2}" y="14" font-size="13" font-weight="600" text-anchor="middle" fill="#1c1c1e">${labels[i]})</text>`
    inner += `<g transform="translate(${ox},${top})">${plotInner(sp, clipId)}</g>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${inner}</svg>`
}

// Общий сборщик «соответствия»: specs[i] описывается формулой formulas[i]. Две
// формы подачи банка — f2g (условия=А,Б,В, графики=1,2,3) и g2f (графики=А,Б,В,
// формулы=1,2,3). Перемешиваем графики (disp), ответ под А,Б,В — где стоит нужный.
function buildMatch(specs, formulas, leadF2G, leadG2F, dir) {
  const disp = shuffle([0, 1, 2])
  const answer = [0, 1, 2].map((i) => disp.indexOf(i) + 1).join("")
  if (dir === "f2g") {
    const list = ["А", "Б", "В"].map((L, i) => `${L}) ${formulas[i]}`).join("\n")
    return {
      condition_text: `${leadF2G}\n${list}\nГрафики 1, 2, 3 изображены на рисунке. В ответе укажите номера графиков, соответствующих буквам А, Б, В.`,
      answer,
      image_url: svgToDataUrl(plotsRow(disp.map((i) => specs[i]), ["1", "2", "3"])),
    }
  }
  const list = disp.map((i, p) => `${p + 1}) ${formulas[i]}`).join("\n")
  return {
    condition_text: `${leadG2F}\n${list}\nГрафики А, Б, В изображены на рисунке. В ответе укажите номера формул, соответствующих буквам А, Б, В.`,
    answer,
    image_url: svgToDataUrl(plotsRow(specs, ["А", "Б", "В"])),
  }
}

// Наклоны и свободные члены для линейных формул (целые и «красивые» дроби банка).
const LIN_SLOPES = [[1, 1], [2, 1], [3, 1], [1, 2], [3, 2], [3, 4], [2, 3]]
const SIGN_SLOPES = [[1, 1], [2, 1], [3, 1], [1, 2], [3, 2]]

// №11. Знаки коэффициентов k и b у прямой y=kx+b (26 «знаковых» задач банка про
// прямые). Три прямые с разными (знак k, знак b); условия А,Б,В — сами знаки,
// графики 1,2,3 — на рисунке.
function t11Signs() {
  const combos = shuffle([[1, 1], [1, -1], [-1, 1], [-1, -1]]).slice(0, 3)  // [sgnK, sgnB]
  const lines = combos.map(([sk, sb]) => {
    const s = pick(SIGN_SLOPES)
    return { t: "line", k: [sk * s[0], s[1]], b: [sb * randInt(1, 3), 1] }
  })
  const cond = ([sk, sb]) => `k ${sk > 0 ? "> 0" : "< 0"}, b ${sb > 0 ? "> 0" : "< 0"}`
  return buildMatch(
    lines,
    combos.map(cond),
    "На рисунках изображены графики функций вида y=kx+b. Установите соответствие между знаками коэффициентов k, b и графиками функций.",
    "",
    "f2g",
  )
}

// №11. Знаки коэффициентов a и c у параболы y=ax²+bx+c (26 «знаковых» задач банка
// про параболы). Читаются по графику: знак a — ветви вверх/вниз, знак c — точка
// пересечения оси y (y(0)=c) выше/ниже нуля (b лишь сдвигает вершину, на a и c не
// влияет). Три параболы с разными (знак a, знак c); условия А,Б,В — сами знаки.
function t11SignsParab() {
  const combos = shuffle([[1, 1], [1, -1], [-1, 1], [-1, -1]]).slice(0, 3)  // [sgnA, sgnC]
  const parabs = combos.map(([sa, sc]) => {
    const am = pick([[1, 1], [1, 2], [2, 1]])
    return { t: "parab", a: [sa * am[0], am[1]], b: [pick([-2, -1, 0, 0, 1, 2]), 1], c: [sc * randInt(1, 3), 1] }
  })
  const cond = ([sa, sc]) => `a ${sa > 0 ? "> 0" : "< 0"}, c ${sc > 0 ? "> 0" : "< 0"}`
  return buildMatch(
    parabs,
    combos.map(cond),
    "На рисунках изображены графики функций вида y=ax²+bx+c. Установите соответствие между знаками коэффициентов a, c и графиками функций.",
    "",
    "f2g",
  )
}

// №11. Три линейные функции — варианты знаков одних и тех же |k|, |b| (банк:
// y=−2x−1 / y=−2x+1 / y=2x+1). Обе формы подачи (формулы↔графики).
function t11Linear() {
  const s = pick(LIN_SLOPES), bb = randInt(1, 4)
  const combos = shuffle([[1, 1], [1, -1], [-1, 1], [-1, -1]]).slice(0, 3)
  const specs = combos.map(([sk, sb]) => ({ t: "line", k: [sk * s[0], s[1]], b: [sb * bb, 1] }))
  const formulas = specs.map((sp) => fmtLin(sp.k, sp.b))
  const dir = pick(["f2g", "g2f"])
  return buildMatch(
    specs, formulas,
    "Установите соответствие между функциями и их графиками.\nФункции:",
    "Установите соответствие между графиками функций и формулами, которые их задают.\nФормулы:",
    dir,
  )
}

// Конструкторы кривых для смешанного №11.
function mkLine() {
  const s = pick(LIN_SLOPES)
  return { t: "line", k: [pick([1, -1]) * s[0], s[1]], b: [pick([-3, -2, -1, 0, 1, 2, 3]), 1] }
}
// Парабола y=ax²+bx+c — вершина может быть сдвинута (в банке есть y=−2x²−6x+1),
// но держим её в кадре, чтобы поворот был виден.
function mkParab() {
  for (let i = 0; i < 40; i++) {
    const aMag = pick([[1, 1], [1, 1], [1, 2], [2, 1]])
    const a = [pick([1, -1]) * aMag[0], aMag[1]]
    const b = Math.random() < 0.5 ? [pick([-4, -3, -2, -1, 1, 2, 3, 4]), 1] : [0, 1]
    const c = [pick([-3, -2, -1, 0, 0, 1, 2, 3]), 1]
    const av = rv(a), bv = rv(b)
    const vx = -bv / (2 * av), vy = rv(c) - (bv * bv) / (4 * av)  // координаты вершины
    if (Math.abs(vx) <= 3.4 && Math.abs(vy) <= 4.4) return { t: "parab", a, b, c }
  }
  return { t: "parab", a: [pick([1, -1]), 1], b: [0, 1], c: [pick([-2, 0, 2]), 1] }
}
const mkHyper = () => ({ t: "hyper", m: [pick([2, 3, 4, 6]) * pick([1, -1]), 1] })
const mkSqrt = () => ({ t: "sqrt" })
const fmtSpec = (sp) =>
  sp.t === "line" ? fmtLin(sp.k, sp.b) : sp.t === "parab" ? fmtParab(sp.a, sp.b, sp.c)
    : sp.t === "hyper" ? fmtHyper(sp.m) : `y=${rT("x")}`      // sqrt

// №11. Три функции разных семейств. Паттерны банка (пропорции ~18:4:4):
// прямая+парабола+гипербола, две прямые+парабола, прямая+парабола+√x.
// Соответствие — по форме и ориентации графика.
function t11Mixed() {
  const pat = pick(["hlp", "hlp", "hlp", "hlp", "hlp", "hlp", "hlp", "hlp", "hlp", "llp", "llp", "lpr", "lpr"])
  let group
  if (pat === "llp") {
    let l1 = mkLine(), l2 = mkLine()
    while (rv(l1.k) === rv(l2.k)) l2 = mkLine()               // прямые с разным наклоном
    group = [l1, l2, mkParab()]
  } else if (pat === "lpr") {
    group = [mkLine(), mkParab(), mkSqrt()]
  } else {
    group = [mkLine(), mkParab(), mkHyper()]
  }
  const specs = shuffle(group)
  const formulas = specs.map(fmtSpec)
  const dir = pick(["f2g", "g2f"])
  return buildMatch(
    specs, formulas,
    "Установите соответствие между функциями и их графиками.\nФункции:",
    "Установите соответствие между графиками функций и формулами, которые их задают.\nФормулы:",
    dir,
  )
}

// №19. Геометрические высказывания: выбрать верное(ые) из трёх. (КЭС 7 «Геометрия»)
// Пул STATEMENTS_19 — все 122 утверждения открытого банка ФИПИ; истинность сверена со
// всеми 150 задачами банка (см. statements19.js). Две формы, как в банке: «Выбор» —
// ровно одно истинное из трёх (ответ — его номер, 88/150 задач банка), «Краткий» —
// ровно два истинных (ответ — два номера подряд, 62/150). Три утверждения берём из
// трёх РАЗНЫХ тем (в банке так 137/150) и следим, чтобы никакие два не делили первые
// 4 слова (в банке таких пар 0 — иначе комплемент/дубликат стал бы подсказкой).
const BY_TOPIC_19 = STATEMENTS_19.reduce((m, s) => {
  (m[s.topic] ??= { t: [], f: [] })[s.ok ? "t" : "f"].push(s)
  return m
}, {})
const TOPICS_19 = Object.keys(BY_TOPIC_19)
const pref4 = (s) => s.t.split(" ").slice(0, 4).join(" ")

function t19() {
  const multi = Math.random() < 62 / 150          // «Краткий» (2 истинных) vs «Выбор» (1)
  const needTrue = multi ? 2 : 1
  const truth = shuffle([...Array(needTrue).fill(true), ...Array(3 - needTrue).fill(false)])
  let chosen
  for (let tries = 0; tries < 300 && !chosen; tries++) {
    const topics = shuffle(TOPICS_19)
    const used = new Set(), picks = []
    for (const need of truth) {
      const key = need ? "t" : "f"
      const topic = topics.find((tp) => !used.has(tp) && BY_TOPIC_19[tp][key].length)
      if (!topic) break
      used.add(topic)
      picks.push(pick(BY_TOPIC_19[topic][key]))
    }
    if (picks.length === 3 && new Set(picks.map(pref4)).size === 3) chosen = picks
  }
  const answer = chosen.map((p, i) => (p.ok ? i + 1 : 0)).filter(Boolean).join("")
  const q = multi
    ? "Какие из следующих утверждений являются истинными высказываниями?"
    : "Какое из следующих утверждений является истинным высказыванием?"
  const tail = multi
    ? "В ответе запишите номера истинных высказываний без пробелов, запятых и других дополнительных символов."
    : "В ответе запишите номер истинного высказывания."
  return {
    condition_text: `${q}\n` + chosen.map((p, i) => `${i + 1}) ${p.t}`).join("\n") + `\n${tail}`,
    answer,
  }
}

// ── №15. Геометрия: треугольник ───────────────────────────────────────────────
// Эталон — банк ФИПИ (КЭС 7.2 «Треугольник» + площади из 7.5) и каталог math100
// (файлы «15-1…15-4»). Чертёж строим сами по образцу ФИПИ: ч/б, вершины подписаны,
// дуги углов со значением, прямой угол — квадратик, чевиана (биссектриса/медиана/
// высота) с подписанным основанием, штрихи равных сторон. Ответ считается кодом.
const G_S = "#1c1c1e"                                   // цвет линий чертежа
const DEG = "°"
const gmid = (P, Q) => [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2]
const decOut = (x) => (Math.round(x * 10000) / 10000).toString().replace(".", ",")
// подпись вершины — сдвиг наружу от центроида
function vLabel(P, cen, name) {
  const dx = P[0] - cen[0], dy = P[1] - cen[1], L = Math.hypot(dx, dy) || 1
  return `<text x="${(P[0] + dx / L * 15).toFixed(1)}" y="${(P[1] + dy / L * 15 + 5).toFixed(1)}" font-size="15" font-style="italic" text-anchor="middle" fill="${G_S}">${name}</text>`
}
// дуга угла в вершине V между лучами на P и Q (меньшая дуга) + текст значения
// count — число концентрических дуг (штрихов): одинаковое количество ⇒ углы равны,
// разное ⇒ углы разные. Помечая на одной фигуре два НЕравных угла, задавай им
// разный count (напр. 1 и 2), иначе одинаковая дуга ложно читается как «углы равны».
function angArc(V, P, Q, r, text, count = 1) {
  const a1 = Math.atan2(P[1] - V[1], P[0] - V[0])
  let d = Math.atan2(Q[1] - V[1], Q[0] - V[0]) - a1
  while (d <= -Math.PI) d += 2 * Math.PI
  while (d > Math.PI) d -= 2 * Math.PI
  let g = ""
  for (let i = 0; i < count; i++) {
    const ri = r - i * 3.5
    const s = [V[0] + ri * Math.cos(a1), V[1] + ri * Math.sin(a1)]
    const e = [V[0] + ri * Math.cos(a1 + d), V[1] + ri * Math.sin(a1 + d)]
    g += `<path d="M ${s[0].toFixed(1)} ${s[1].toFixed(1)} A ${ri.toFixed(1)} ${ri.toFixed(1)} 0 0 ${d > 0 ? 1 : 0} ${e[0].toFixed(1)} ${e[1].toFixed(1)}" fill="none" stroke="${G_S}" stroke-width="1.2"/>`
  }
  if (text != null) {
    const m = a1 + d / 2, tr = r + 15
    g += `<text x="${(V[0] + tr * Math.cos(m)).toFixed(1)}" y="${(V[1] + tr * Math.sin(m) + 4).toFixed(1)}" font-size="13" text-anchor="middle" fill="${G_S}">${text}</text>`
  }
  return g
}
// пара count'ов для двух помечаемых углов: равны ⇒ [1,1] (дуги одинаковы), иначе [1,2]
const arcPair = (v1, v2) => v1 === v2 ? [1, 1] : [1, 2]
// метка прямого угла в вершине V между лучами на P и Q
function rightMark(V, P, Q, sz = 11) {
  const u = (A) => { const dx = A[0] - V[0], dy = A[1] - V[1], L = Math.hypot(dx, dy); return [dx / L, dy / L] }
  const [ux, uy] = u(P), [vx, vy] = u(Q)
  return `<polyline points="${(V[0] + ux * sz).toFixed(1)},${(V[1] + uy * sz).toFixed(1)} ${(V[0] + ux * sz + vx * sz).toFixed(1)},${(V[1] + uy * sz + vy * sz).toFixed(1)} ${(V[0] + vx * sz).toFixed(1)},${(V[1] + vy * sz).toFixed(1)}" fill="none" stroke="${G_S}" stroke-width="1.2"/>`
}
// штрихи равенства на отрезке PQ (count чёрточек поперёк)
function eqTicks(P, Q, count = 1) {
  const [mx, my] = gmid(P, Q), dx = Q[0] - P[0], dy = Q[1] - P[1], L = Math.hypot(dx, dy)
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux
  let g = ""
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * 4, cx = mx + ux * off, cy = my + uy * off
    g += `<line x1="${(cx - nx * 5).toFixed(1)}" y1="${(cy - ny * 5).toFixed(1)}" x2="${(cx + nx * 5).toFixed(1)}" y2="${(cy + ny * 5).toFixed(1)}" stroke="${G_S}" stroke-width="1.2"/>`
  }
  return g
}
// подпись стороны (PQ) — текст у середины со сдвигом наружу от центроида
function sideLabel(P, Q, cen, text) {
  const [mx, my] = gmid(P, Q), dx = mx - cen[0], dy = my - cen[1], L = Math.hypot(dx, dy) || 1
  return `<text x="${(mx + dx / L * 15).toFixed(1)}" y="${(my + dy / L * 15 + 4).toFixed(1)}" font-size="13" text-anchor="middle" fill="${G_S}">${text}</text>`
}
// подпись стороны со сдвигом ВНУТРЬ (к точке G) — для вписанного в окружность треугольника,
// чтобы текст не попадал на дугу описанной окружности снаружи стороны.
function sideLabelInner(P, Q, G, text) {
  const [mx, my] = gmid(P, Q), dx = G[0] - mx, dy = G[1] - my, L = Math.hypot(dx, dy) || 1
  return `<text x="${(mx + dx / L * 15).toFixed(1)}" y="${(my + dy / L * 15 + 4).toFixed(1)}" font-size="13" text-anchor="middle" fill="${G_S}">${text}</text>`
}
// центроид набора вершин
const centro = (V) => { const n = Object.keys(V); return [n.reduce((s, k) => s + V[k][0], 0) / n.length, n.reduce((s, k) => s + V[k][1], 0) / n.length] }
// собрать SVG: вершины (screen-координаты, y вниз) + доп. элементы
function triFrame(V, extra, { W = 240, H = 185, labels } = {}) {
  const names = Object.keys(V), cen = centro(V)
  const lab = labels === undefined ? names : labels
  let g = `<polygon points="${names.map(n => `${V[n][0]},${V[n][1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6" stroke-linejoin="round"/>`
  for (const n of lab) g += vLabel(V[n], cen, n)
  g += extra
  return svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`)
}
// проекция точки B на прямую AC (основание высоты)
function footPerp(A, C, B) {
  const dx = C[0] - A[0], dy = C[1] - A[1], t = ((B[0] - A[0]) * dx + (B[1] - A[1]) * dy) / (dx * dx + dy * dy)
  return [A[0] + t * dx, A[1] + t * dy]
}

// Стандартные формы (screen-координаты, y вниз)
const SCALENE = { A: [30, 155], B: [105, 30], C: [215, 150] }
const RIGHT_C = { A: [55, 28], C: [55, 158], B: [220, 158] }   // прямой угол в C
const ISO_B = { A: [35, 152], B: [125, 26], C: [215, 152] }    // AB=BC, вершина B
const EQUI = { A: [45, 155], B: [125, 26], C: [205, 155] }

// №15 углы: два угла даны → третий (сумма 180)
function t15AngTwo() {
  let a, b
  do { a = randInt(28, 82); b = randInt(28, 82) } while (a + b >= 165 || 180 - a - b < 15)
  const V = SCALENE
  const [ca, cb] = arcPair(a, b)
  const extra = angArc(V.A, V.B, V.C, 26, a + DEG, ca) + angArc(V.C, V.A, V.B, 26, b + DEG, cb)
  return { condition_text: `В треугольнике два угла равны ${a}${DEG} и ${b}${DEG}. Найдите его третий угол. Ответ дайте в градусах.`, answer: String(180 - a - b), image_url: triFrame(V, extra, { labels: [] }) }
}
// №15 углы: прямоугольный, один острый → другой (90−x)
function t15AngRight() {
  const x = randInt(14, 76)
  const V = RIGHT_C
  const extra = rightMark(V.C, V.A, V.B) + angArc(V.A, V.C, V.B, 24, x + DEG)
  return { condition_text: `Один из острых углов прямоугольного треугольника равен ${x}${DEG}. Найдите его другой острый угол. Ответ дайте в градусах.`, answer: String(90 - x), image_url: triFrame(V, extra, { labels: [] }) }
}
// №15 углы: внешний угол при вершине C (180−C)
function t15AngExt() {
  const c = randInt(95, 178)
  // Фигура схематична (как во всех углах и в самом ФИПИ): фиксированный тупой
  // треугольник с ∠C≈115° — умеренно тупой, чтобы C отстоял от стороны AB и
  // осталось место под дугу и подпись (при ∠C≈130° AB прижималась к вершине).
  const C = [110, 110]
  const A = [25, 110]
  const B = [145, 35]
  const V = { A, B, C }
  // пунктирный луч — продолжение BC за вершину C; внешний угол между CA и этим лучом
  const ext = [C[0] + (C[0] - B[0]) * 0.6, C[1] + (C[1] - B[1]) * 0.6]
  // Внутренний ∠C помечаем одной небольшой дугой (r=12, чтобы не перекрывать
  // подпись), внешний — двумя: углы разные, одинаковые дуги ложно читались бы
  // как «углы равны». Метку ставим в верхней части тупого угла у AB — там, где
  // маленькая дуга у вершины её не задевает.
  const extra = `<line x1="${C[0]}" y1="${C[1]}" x2="${ext[0].toFixed(1)}" y2="${ext[1].toFixed(1)}" stroke="${G_S}" stroke-width="1.4" stroke-dasharray="4 3"/>` +
    angArc(C, B, A, 12, null, 1) + angArc(C, A, ext, 15, null, 2) +
    `<text x="90" y="90" font-size="13" text-anchor="middle" fill="${G_S}">${c}${DEG}</text>`
  return { condition_text: `В треугольнике ABC угол C равен ${c}${DEG}. Найдите внешний угол при вершине C. Ответ дайте в градусах.`, answer: String(180 - c), image_url: triFrame(V, extra) }
}
// №15 углы: равнобедренный AB=BC, угол при вершине B → угол при основании (180−B)/2
function t15AngIso() {
  const B = 2 * randInt(11, 74)                        // чётный угол при вершине → целый ответ
  const V = ISO_B
  const extra = angArc(V.B, V.A, V.C, 24, B + DEG) + eqTicks(V.A, V.B, 1) + eqTicks(V.B, V.C, 1)
  return { condition_text: `В треугольнике ABC известно, что AB = BC, ∠ABC = ${B}${DEG}. Найдите угол BCA. Ответ дайте в градусах.`, answer: String((180 - B) / 2), image_url: triFrame(V, extra) }
}
// №15 углы: биссектриса AD, ∠BAC → ∠BAD (÷2)
function t15AngBis() {
  const a = 2 * randInt(12, 44)
  const V = { A: [35, 150], B: [110, 30], C: [215, 150] }
  const D = [V.B[0] + (V.C[0] - V.B[0]) * 0.55, V.B[1] + (V.C[1] - V.B[1]) * 0.55]  // точка на BC
  const extra = `<line x1="${V.A[0]}" y1="${V.A[1]}" x2="${D[0].toFixed(1)}" y2="${D[1].toFixed(1)}" stroke="${G_S}" stroke-width="1.4"/>` +
    angArc(V.A, V.B, D, 22, null) + angArc(V.A, D, V.C, 22, null) +   // AD — биссектриса: обе половины равны ⇒ одинаковые дуги (равный радиус)
    `<text x="${(D[0] + 8).toFixed(1)}" y="${(D[1] + 4).toFixed(1)}" font-size="15" font-style="italic" fill="${G_S}">D</text>`
  return { condition_text: `В треугольнике ABC известно, что ∠BAC = ${a}${DEG}, AD — биссектриса. Найдите угол BAD. Ответ дайте в градусах.`, answer: String(a / 2), image_url: triFrame(V, extra) }
}
// №15 углы: остроугольный, высота BH, ∠BAC → ∠ABH (90−a)
function t15AngHeight() {
  const a = randInt(9, 82)
  const V = { A: [35, 150], B: [120, 35], C: [215, 150] }
  const H = footPerp(V.A, V.C, V.B)
  const extra = `<line x1="${V.B[0]}" y1="${V.B[1]}" x2="${H[0].toFixed(1)}" y2="${H[1].toFixed(1)}" stroke="${G_S}" stroke-width="1.4"/>` +
    rightMark(H, V.B, V.A) + angArc(V.A, V.B, V.C, 24, a + DEG) +
    `<text x="${H[0].toFixed(1)}" y="${(H[1] + 16).toFixed(1)}" font-size="15" font-style="italic" text-anchor="middle" fill="${G_S}">H</text>`
  return { condition_text: `В остроугольном треугольнике ABC проведена высота BH, ∠BAC = ${a}${DEG}. Найдите угол ABH. Ответ дайте в градусах.`, answer: String(90 - a), image_url: triFrame(V, extra) }
}
// №15 углы: биссектриса AK, ∠C, AK=CK → ∠B (180−3C)
function t15AngBisEq() {
  const c = randInt(11, 25)
  const V = { A: [35, 150], B: [120, 32], C: [215, 150] }
  const K = [V.B[0] + (V.C[0] - V.B[0]) * 0.5, V.B[1] + (V.C[1] - V.B[1]) * 0.5]
  const extra = `<line x1="${V.A[0]}" y1="${V.A[1]}" x2="${K[0].toFixed(1)}" y2="${K[1].toFixed(1)}" stroke="${G_S}" stroke-width="1.4"/>` +
    angArc(V.C, V.A, V.B, 20, c + DEG) + eqTicks(V.A, K, 2) + eqTicks(K, V.C, 2) +
    `<text x="${(K[0] + 9).toFixed(1)}" y="${(K[1] - 2).toFixed(1)}" font-size="15" font-style="italic" fill="${G_S}">K</text>`
  return { condition_text: `В треугольнике ABC проведена биссектриса AK. Найдите градусную меру угла B, если ∠C = ${c}${DEG} и AK = CK.`, answer: String(180 - 3 * c), image_url: triFrame(V, extra) }
}
// №15 углы: медиана BM=AM=MC, ∠C → ∠A (90−C)
function t15AngMedEq() {
  const c = randInt(50, 72)
  const V = { A: [35, 152], B: [125, 34], C: [215, 152] }
  const M = gmid(V.A, V.C)
  const extra = `<line x1="${V.B[0]}" y1="${V.B[1]}" x2="${M[0].toFixed(1)}" y2="${M[1].toFixed(1)}" stroke="${G_S}" stroke-width="1.4"/>` +
    angArc(V.C, V.A, V.B, 20, c + DEG) + eqTicks(V.A, M, 1) + eqTicks(M, V.C, 1) + eqTicks(V.B, M, 1) +   // BM=AM=MC равны ⇒ одинаковые засечки
    `<text x="${M[0].toFixed(1)}" y="${(M[1] + 16).toFixed(1)}" font-size="15" font-style="italic" text-anchor="middle" fill="${G_S}">M</text>`
  return { condition_text: `В треугольнике ABC проведена медиана BM. Найдите градусную меру угла A, если ∠C = ${c}${DEG} и BM = AM = MC.`, answer: String(90 - c), image_url: triFrame(V, extra) }
}

// №15 элементы: медиана BM к AC, AC дано → AM = AC/2 (BM — отвлекающая длина)
function t15Median() {
  const ac = 2 * randInt(6, 30), bm = randInt(8, 45)
  const V = SCALENE, M = gmid(V.A, V.C)
  const extra = `<line x1="${V.B[0]}" y1="${V.B[1]}" x2="${M[0].toFixed(1)}" y2="${M[1].toFixed(1)}" stroke="${G_S}" stroke-width="1.4"/>` +
    eqTicks(V.A, M, 1) + eqTicks(M, V.C, 1) +
    `<text x="${M[0].toFixed(1)}" y="${(M[1] + 16).toFixed(1)}" font-size="15" font-style="italic" text-anchor="middle" fill="${G_S}">M</text>`
  return { condition_text: `В треугольнике ABC известно, что AC = ${ac}, BM — медиана, BM = ${bm}. Найдите AM.`, answer: String(ac / 2), image_url: triFrame(V, extra) }
}
// №15 элементы: средняя линия MN (M,N середины AB,BC) → MN = AC/2
function t15Midline() {
  const ac = 2 * randInt(6, 24), ab = randInt(12, 30), bc = randInt(12, 30)
  const V = SCALENE, M = gmid(V.A, V.B), N = gmid(V.B, V.C)
  const extra = `<line x1="${M[0].toFixed(1)}" y1="${M[1].toFixed(1)}" x2="${N[0].toFixed(1)}" y2="${N[1].toFixed(1)}" stroke="${G_S}" stroke-width="1.4"/>` +
    `<circle cx="${M[0].toFixed(1)}" cy="${M[1].toFixed(1)}" r="2.5" fill="${G_S}"/><circle cx="${N[0].toFixed(1)}" cy="${N[1].toFixed(1)}" r="2.5" fill="${G_S}"/>` +
    `<text x="${(M[0] - 12).toFixed(1)}" y="${M[1].toFixed(1)}" font-size="15" font-style="italic" fill="${G_S}">M</text>` +
    `<text x="${(N[0] + 8).toFixed(1)}" y="${N[1].toFixed(1)}" font-size="15" font-style="italic" fill="${G_S}">N</text>`
  return { condition_text: `Точки M и N являются серединами сторон AB и BC треугольника ABC, сторона AB равна ${ab}, сторона BC равна ${bc}, сторона AC равна ${ac}. Найдите MN.`, answer: String(ac / 2), image_url: triFrame(V, extra) }
}
// №15 элементы: катеты → гипотенуза (пифагорова тройка)
function t15Pyth() {
  const [a, b, c] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25], [20, 21, 29]])
  const k = pick([1, 1, 2, 3])
  const V = RIGHT_C, cen = centro(V)
  const extra = rightMark(V.C, V.A, V.B) + sideLabel(V.C, V.A, cen, String(a * k)) + sideLabel(V.C, V.B, cen, String(b * k))
  return { condition_text: `Катеты прямоугольного треугольника равны ${a * k} и ${b * k}. Найдите гипотенузу этого треугольника.`, answer: String(c * k), image_url: triFrame(V, extra, { labels: [] }) }
}
// №15 элементы: катет + гипотенуза → другой катет
function t15PythLeg() {
  const [a, b, c] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25]])
  const k = pick([1, 1, 2, 3])
  const V = RIGHT_C, cen = centro(V)
  const extra = rightMark(V.C, V.A, V.B) + sideLabel(V.C, V.A, cen, String(a * k)) + sideLabel(V.A, V.B, cen, String(c * k))
  return { condition_text: `В прямоугольном треугольнике катет и гипотенуза равны ${a * k} и ${c * k} соответственно. Найдите другой катет этого треугольника.`, answer: String(b * k), image_url: triFrame(V, extra, { labels: [] }) }
}
// №15 элементы: равносторонний — сторона ↔ высота/медиана/биссектриса (все равны s√3/2)
function t15Equi() {
  const elem = pick(["высоту", "медиану", "биссектрису"])
  const elemN = { "высоту": "Высота", "медиану": "Медиана", "биссектрису": "Биссектриса" }[elem]
  const V = EQUI, M = gmid(V.A, V.C)
  const cev = `<line x1="${V.B[0]}" y1="${V.B[1]}" x2="${M[0].toFixed(1)}" y2="${M[1].toFixed(1)}" stroke="${G_S}" stroke-width="1.4"/>`
  if (Math.random() < 0.5) {
    const m = 2 * randInt(2, 10)                       // сторона = m√3, ответ 3m/2
    const extra = cev + eqTicks(V.A, V.B, 1) + eqTicks(V.B, V.C, 1) + eqTicks(V.A, V.C, 1)
    return { condition_text: `Сторона равностороннего треугольника равна ${m}${rT(3)}. Найдите ${elem} этого треугольника.`, answer: String(3 * m / 2), image_url: triFrame(V, extra, { labels: [] }) }
  }
  const k = randInt(3, 14)                             // элемент = k√3, сторона = 2k
  const extra = cev + eqTicks(V.A, V.B, 1) + eqTicks(V.B, V.C, 1) + eqTicks(V.A, V.C, 1)
  return { condition_text: `${elemN} равностороннего треугольника равна ${k}${rT(3)}. Найдите сторону этого треугольника.`, answer: String(2 * k), image_url: triFrame(V, extra, { labels: [] }) }
}

// №15 площадь: сторона · высота к ней / 2
function t15AreaBH() {
  let a, h
  do { a = randInt(6, 30); h = randInt(6, 34) } while ((a * h) % 2 !== 0)
  const V = { A: [40, 150], B: [140, 40], C: [210, 150] }, cen = centro(V)
  const H = footPerp(V.A, V.C, V.B)
  const extra = `<line x1="${V.B[0]}" y1="${V.B[1]}" x2="${H[0].toFixed(1)}" y2="${H[1].toFixed(1)}" stroke="${G_S}" stroke-width="1.3" stroke-dasharray="4 3"/>` +
    rightMark(H, V.B, V.C) + sideLabel(V.A, V.C, cen, String(a)) +
    `<text x="${(H[0] + 8).toFixed(1)}" y="${((V.B[1] + H[1]) / 2).toFixed(1)}" font-size="13" fill="${G_S}">${h}</text>`
  return { condition_text: `Сторона треугольника равна ${a}, а высота, проведённая к этой стороне, равна ${h}. Найдите площадь этого треугольника.`, answer: String(a * h / 2), image_url: triFrame(V, extra, { labels: [] }) }
}
// №15 площадь: два катета / 2
function t15AreaLegs() {
  let a, b
  do { a = randInt(3, 20); b = randInt(3, 20) } while ((a * b) % 2 !== 0)
  const V = RIGHT_C, cen = centro(V)
  const extra = rightMark(V.C, V.A, V.B) + sideLabel(V.C, V.A, cen, String(a)) + sideLabel(V.C, V.B, cen, String(b))
  return { condition_text: `Два катета прямоугольного треугольника равны ${a} и ${b}. Найдите площадь этого треугольника.`, answer: String(a * b / 2), image_url: triFrame(V, extra, { labels: [] }) }
}
// №15 площадь: ½·AB·BC·sin(∠ABC)
function t15AreaSin() {
  const [n, d] = pick([[3, 5], [4, 5], [2, 5], [1, 2], [3, 4], [1, 4], [7, 10], [3, 10]])
  // AB·BC·n/d чётно → площадь целая; подберём стороны, кратные знаменателю
  let ab, bc
  do { ab = d * randInt(1, 4); bc = randInt(4, 14) } while ((ab * bc * n) % (2 * d) !== 0)
  const V = ISO_B
  const extra = angArc(V.B, V.A, V.C, 22, null) + sideLabel(V.B, V.A, centro(V), String(ab)) + sideLabel(V.B, V.C, centro(V), String(bc))
  return { condition_text: `В треугольнике ABC известно, что AB = ${ab}, BC = ${bc}, sin∠ABC = ${fT(n, d)}. Найдите площадь треугольника ABC.`, answer: String(ab * bc * n / (2 * d)), image_url: triFrame(V, extra) }
}

// №15 тригонометрия: прямоугольный ∠C=90 → sinB / cosB / tgB (чистая десятичная)
function t15TrigFind() {
  const kind = pick(["sin", "cos", "tg"])
  // sinB=AC/AB, cosB=BC/AB, tgB=AC/BC; подбираем «красивое» десятичное
  const V = RIGHT_C, cen = centro(V)
  let cond, ans
  if (kind === "sin") {
    const [ac, ab] = pick([[6, 20], [3, 5], [12, 15], [7, 25], [9, 30], [6, 10], [8, 20]])
    cond = `AC = ${ac}, AB = ${ab}. Найдите sin B`; ans = decOut(ac / ab)
    var extra = sideLabel(V.C, V.A, cen, String(ac)) + sideLabel(V.A, V.B, cen, String(ab))
  } else if (kind === "cos") {
    const [bc, ab] = pick([[16, 25], [4, 5], [8, 10], [21, 25], [9, 15], [12, 20], [6, 24]])
    cond = `BC = ${bc}, AB = ${ab}. Найдите cos B`; ans = decOut(bc / ab)
    extra = sideLabel(V.C, V.B, cen, String(bc)) + sideLabel(V.A, V.B, cen, String(ab))
  } else {
    const [ac, bc] = pick([[3, 4], [5, 4], [6, 8], [9, 12], [7, 10], [3, 5], [21, 20]])
    cond = `BC = ${bc}, AC = ${ac}. Найдите tg B`; ans = decOut(ac / bc)
    extra = sideLabel(V.C, V.A, cen, String(ac)) + sideLabel(V.C, V.B, cen, String(bc))
  }
  return { condition_text: `В треугольнике ABC угол C равен 90${DEG}, ${cond}.`, answer: ans, image_url: triFrame(V, rightMark(V.C, V.A, V.B) + extra) }
}
// №15 тригонометрия: дан sin/cos/tg + сторона → другая сторона (ответ целый)
function t15TrigInv() {
  const kind = pick(["sin", "cos", "tg"])
  const V = RIGHT_C, cen = centro(V)
  let cond, ans
  if (kind === "sin") {                    // sinB = AC/AB → AC = AB·sinB
    const [n, d] = pick([[7, 12], [3, 7], [5, 6], [11, 15], [2, 3], [4, 5]])
    const ab = d * randInt(2, 6)
    cond = `sin B = ${fT(n, d)}, AB = ${ab}. Найдите AC`; ans = String(ab * n / d)
    var extra = sideLabel(V.A, V.B, cen, String(ab)) + angArc(V.B, V.A, V.C, 18, null)
  } else if (kind === "cos") {             // cosB = BC/AB → BC = AB·cosB
    const [n, d] = pick([[5, 6], [11, 15], [5, 12], [2, 3], [3, 5], [7, 8]])
    const ab = d * randInt(2, 6)
    cond = `cos B = ${fT(n, d)}, AB = ${ab}. Найдите BC`; ans = String(ab * n / d)
    extra = sideLabel(V.A, V.B, cen, String(ab)) + angArc(V.B, V.A, V.C, 18, null)
  } else {                                 // tgB = AC/BC → AC = BC·tgB
    const [n, d] = pick([[3, 4], [11, 8], [7, 12], [5, 6], [2, 3], [3, 5]])
    const bc = d * randInt(2, 6)
    cond = `tg B = ${fT(n, d)}, BC = ${bc}. Найдите AC`; ans = String(bc * n / d)
    extra = sideLabel(V.C, V.B, cen, String(bc)) + angArc(V.B, V.A, V.C, 18, null)
  }
  return { condition_text: `В треугольнике ABC угол C равен 90${DEG}, ${cond}.`, answer: ans, image_url: triFrame(V, rightMark(V.C, V.A, V.B) + extra) }
}

// ── №16. Геометрия: окружность ────────────────────────────────────────────────
// Эталон — банк ФИПИ (КЭС 7.4 «Окружность и круг» + радиусы квадрата/равностор. из
// 7.2/7.3) и каталог math100 (файлы 16-1…16-3). Формулы сверены с ключами ответов
// math100. Чертёж — своя окружность с вписанными/описанными фигурами, ч/б.
const cPt = (O, r, deg) => [O[0] + r * Math.cos(deg * Math.PI / 180), O[1] - r * Math.sin(deg * Math.PI / 180)]
const cCircle = (O, r) => `<circle cx="${O[0]}" cy="${O[1]}" r="${r}" fill="none" stroke="${G_S}" stroke-width="1.6"/>`
const cSeg = (P, Q) => `<line x1="${P[0].toFixed(1)}" y1="${P[1].toFixed(1)}" x2="${Q[0].toFixed(1)}" y2="${Q[1].toFixed(1)}" stroke="${G_S}" stroke-width="1.4"/>`
const cDot = (P) => `<circle cx="${P[0].toFixed(1)}" cy="${P[1].toFixed(1)}" r="2.4" fill="${G_S}"/>`
// подпись точки наружу от точки C0 (центр окружности/фигуры)
function cLbl(P, C0, name, d = 15) {
  const dx = P[0] - C0[0], dy = P[1] - C0[1], L = Math.hypot(dx, dy) || 1
  return `<text x="${(P[0] + dx / L * d).toFixed(1)}" y="${(P[1] + dy / L * d + 5).toFixed(1)}" font-size="14" font-style="italic" text-anchor="middle" fill="${G_S}">${name}</text>`
}
const cFrame = (g, { W = 250, H = 225 } = {}) => svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`)
// Подпись центра O со сдвигом (dx,dy) в свободный сектор + белое «гало», чтобы буква
// не сливалась с линиями (диаметрами/радиусами), проходящими через центр.
function oLabel(O, dx, dy) {
  const x = O[0] + dx, y = O[1] + dy
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7.5" fill="#fff"/>` +
    `<text x="${x.toFixed(1)}" y="${(y + 4.5).toFixed(1)}" font-size="14" font-style="italic" text-anchor="middle" fill="${G_S}">O</text>`
}
const O16 = [125, 108], R16 = 82

// A1: треугольник вписан, O и C в одной полупл. отн. AB → ∠ACB = ∠AOB/2
function t16InsAngle() {
  const aob = 2 * randInt(10, 86)                          // чётный ⇒ ∠ACB = aob/2 целый
  const A = cPt(O16, R16, 205), B = cPt(O16, R16, 335), C = cPt(O16, R16, 80)
  let g = cCircle(O16, R16) + cSeg(O16, A) + cSeg(O16, B) + cSeg(C, A) + cSeg(C, B)
  g += angArc(O16, A, B, 24, aob + DEG)   // дугой помечаем только данный угол; искомый ∠ACB задан вершинами (равные дуги ⇒ «углы равны»)
  g += cDot(A) + cDot(B) + cDot(C) + cDot(O16) + cLbl(A, O16, "A") + cLbl(B, O16, "B") + cLbl(C, O16, "C") + oLabel(O16, 0, -14)
  return { condition_text: `Треугольник ABC вписан в окружность с центром в точке O. Точки O и C лежат в одной полуплоскости относительно прямой AB. Найдите угол ACB, если угол AOB равен ${aob}${DEG}. Ответ дайте в градусах.`, answer: decOut(aob / 2), image_url: cFrame(g) }
}
// A2: AC, BD диаметры, ∠ACB → ∠AOD = 180 − 2∠ACB
function t16Diam() {
  const x = randInt(12, 78)
  const A = cPt(O16, R16, 150), C = cPt(O16, R16, 330), B = cPt(O16, R16, 205), D = cPt(O16, R16, 25)
  let g = cCircle(O16, R16) + cSeg(A, C) + cSeg(B, D) + cSeg(C, B)
  g += angArc(C, B, A, 22, x + DEG)   // помечаем только данный ∠ACB; искомый ∠AOD не равен ему — без дуги
  g += cDot(A) + cDot(B) + cDot(C) + cDot(D) + cLbl(A, O16, "A") + cLbl(B, O16, "B") + cLbl(C, O16, "C") + cLbl(D, O16, "D") + oLabel(O16, 0, 14)
  return { condition_text: `Отрезки AC и BD — диаметры окружности с центром в точке O. Угол ACB равен ${x}${DEG}. Найдите угол AOD. Ответ дайте в градусах.`, answer: String(180 - 2 * x), image_url: cFrame(g) }
}
// A3: AC, BD диаметры, ∠AOD → ∠ACB = (180 − ∠AOD)/2
function t16DiamInv() {
  const aod = 2 * randInt(10, 78)
  const A = cPt(O16, R16, 150), C = cPt(O16, R16, 330), B = cPt(O16, R16, 205), D = cPt(O16, R16, 25)
  let g = cCircle(O16, R16) + cSeg(A, C) + cSeg(B, D) + cSeg(C, B)
  g += angArc(O16, A, D, 24, aod + DEG)   // помечаем только данный ∠AOD; искомый ∠ACB не равен ему — без дуги
  g += cDot(A) + cDot(B) + cDot(C) + cDot(D) + cLbl(A, O16, "A") + cLbl(B, O16, "B") + cLbl(C, O16, "C") + cLbl(D, O16, "D") + oLabel(O16, 0, 14)
  return { condition_text: `В окружности с центром O AC и BD — диаметры. Центральный угол AOD равен ${aod}${DEG}. Найдите вписанный угол ACB. Ответ дайте в градусах.`, answer: String((180 - aod) / 2), image_url: cFrame(g) }
}
// A4: M,N по разные стороны диаметра AB, ∠NBA → ∠NMB = 90 − ∠NBA
function t16Diameter2() {
  const x = randInt(10, 80)
  const A = cPt(O16, R16, 180), B = cPt(O16, R16, 0), N = cPt(O16, R16, 55), M = cPt(O16, R16, 240)
  let g = cCircle(O16, R16) + cSeg(A, B) + cSeg(N, B) + cSeg(N, A) + cSeg(M, N) + cSeg(M, B)
  g += angArc(B, N, A, 22, x + DEG)   // помечаем только данный ∠NBA; искомый ∠NMB не равен ему — без дуги
  g += cDot(A) + cDot(B) + cDot(M) + cDot(N) + cLbl(A, O16, "A") + cLbl(B, O16, "B") + cLbl(M, O16, "M") + cLbl(N, O16, "N")
  return { condition_text: `На окружности по разные стороны от диаметра AB взяты точки M и N. Известно, что ∠NBA = ${x}${DEG}. Найдите угол NMB. Ответ дайте в градусах.`, answer: String(90 - x), image_url: cFrame(g) }
}
// A5/A6: ABCD вписан. ∠ABD+∠CAD=∠ABC  (или обратный ∠ABC−∠CAD=∠ABD)
function t16CyclicQuad() {
  const A = cPt(O16, R16, 210), B = cPt(O16, R16, 120), C = cPt(O16, R16, 40), D = cPt(O16, R16, 315)
  let g = cCircle(O16, R16) + cSeg(A, B) + cSeg(B, C) + cSeg(C, D) + cSeg(D, A) + cSeg(B, D) + cSeg(A, C)
  const dots = cDot(A) + cDot(B) + cDot(C) + cDot(D) + cLbl(A, O16, "A") + cLbl(B, O16, "B") + cLbl(C, O16, "C") + cLbl(D, O16, "D")
  if (Math.random() < 0.5) {
    const abd = randInt(20, 60), cad = randInt(20, 60)
    const [c1, c2] = arcPair(abd, cad)
    g += angArc(B, A, D, 24, abd + DEG, c1) + angArc(A, C, D, 20, cad + DEG, c2) + dots
    return { condition_text: `Четырёхугольник ABCD вписан в окружность. Угол ABD равен ${abd}${DEG}, угол CAD равен ${cad}${DEG}. Найдите угол ABC. Ответ дайте в градусах.`, answer: String(abd + cad), image_url: cFrame(g) }
  }
  const cad = randInt(20, 45), abc = cad + randInt(20, 70)
  g += angArc(B, A, C, 24, abc + DEG, 2) + angArc(A, C, D, 18, cad + DEG, 1) + dots
  return { condition_text: `Четырёхугольник ABCD вписан в окружность. Угол ABC равен ${abc}${DEG}, угол CAD равен ${cad}${DEG}. Найдите угол ABD. Ответ дайте в градусах.`, answer: String(abc - cad), image_url: cFrame(g) }
}
// A7: четырёхугольник вписан, ∠A → ∠C = 180 − ∠A
function t16CyclicOpp() {
  const a = randInt(50, 130)
  const A = cPt(O16, R16, 210), B = cPt(O16, R16, 120), C = cPt(O16, R16, 40), D = cPt(O16, R16, 315)
  let g = cCircle(O16, R16) + cSeg(A, B) + cSeg(B, C) + cSeg(C, D) + cSeg(D, A)
  g += angArc(A, B, D, 22, a + DEG)   // помечаем только данный ∠A; искомый ∠C не равен ему — без дуги
  g += cDot(A) + cDot(B) + cDot(C) + cDot(D) + cLbl(A, O16, "A") + cLbl(B, O16, "B") + cLbl(C, O16, "C") + cLbl(D, O16, "D")
  return { condition_text: `Угол A четырёхугольника ABCD, вписанного в окружность, равен ${a}${DEG}. Найдите угол C этого четырёхугольника. Ответ дайте в градусах.`, answer: String(180 - a), image_url: cFrame(g) }
}
// A8: трапеция ABCD (осн. AD, BC) вписана → ∠B = ∠C = 180 − ∠A (равнобедренная)
function t16CyclicTrap() {
  const a = randInt(50, 80)
  const ask = pick(["B", "C"])                          // оба смежны с ∠A ⇒ 180 − ∠A
  const A = cPt(O16, R16, 215), D = cPt(O16, R16, 325), B = cPt(O16, R16, 130), C = cPt(O16, R16, 50)
  let g = cCircle(O16, R16) + cSeg(A, B) + cSeg(B, C) + cSeg(C, D) + cSeg(D, A)
  g += angArc(A, D, B, 22, a + DEG)   // помечаем только данный ∠A; искомый угол не равен ему — без дуги
  g += cDot(A) + cDot(B) + cDot(C) + cDot(D) + cLbl(A, O16, "A") + cLbl(B, O16, "B") + cLbl(C, O16, "C") + cLbl(D, O16, "D")
  return { condition_text: `Угол A трапеции ABCD с основаниями AD и BC, вписанной в окружность, равен ${a}${DEG}. Найдите угол ${ask} этой трапеции. Ответ дайте в градусах.`, answer: String(180 - a), image_url: cFrame(g) }
}
// A9: касательные в A,B пересекаются под углом → ∠AOB = 180 − угол
function t16Tangents() {
  const ap = randInt(40, 100)
  // Внешняя точка P слева, окружность справа — весь «воздушный змей» PAOB в кадре.
  // Точки касания A,B считаем ТОЧНО (OA⊥PA), поэтому прямые углы настоящие.
  const O = [168, 112], r = 60, Pp = [40, 112]
  const d = Math.hypot(O[0] - Pp[0], O[1] - Pp[1])
  const base = Math.atan2(-(Pp[1] - O[1]), Pp[0] - O[0]) * 180 / Math.PI   // направление O→P в системе cPt
  const spread = Math.acos(r / d) * 180 / Math.PI                          // ∠AOP
  const A = cPt(O, r, base - spread), B = cPt(O, r, base + spread)
  let g = cCircle(O, r) + cSeg(O, A) + cSeg(O, B) + cSeg(Pp, A) + cSeg(Pp, B)
  g += rightMark(A, O, Pp, 9) + rightMark(B, O, Pp, 9) + angArc(Pp, A, B, 22, ap + DEG)   // помечаем только данный ∠P; искомый ∠AOB не равен ему — без дуги
  g += cDot(A) + cDot(B) + cLbl(A, O, "A") + cLbl(B, O, "B") + `<text x="${(Pp[0] - 14).toFixed(1)}" y="${(Pp[1] + 4).toFixed(1)}" font-size="14" font-style="italic" fill="${G_S}">P</text>` + `<text x="${O[0] + 6}" y="${O[1] + 4}" font-size="14" font-style="italic" fill="${G_S}">O</text>`
  return { condition_text: `Касательные в точках A и B к окружности с центром в точке O пересекаются под углом ${ap}${DEG}. Найдите угол AOB. Ответ дайте в градусах.`, answer: String(180 - ap), image_url: cFrame(g) }
}
// A10: центр описанной на AB (⇒ ∠ACB=90), ∠BAC → ∠ABC = 90 − ∠BAC
function t16CenterOnAB() {
  const a = randInt(15, 75)
  const O = [125, 112], r = 82                            // полная окружность помещается в кадр 250×225
  const A = cPt(O, r, 180), B = cPt(O, r, 0), C = cPt(O, r, 62)
  let g = cCircle(O, r) + cSeg(A, B) + cSeg(A, C) + cSeg(B, C)
  g += rightMark(C, A, B, 10) + angArc(A, B, C, 24, a + DEG)   // помечаем только данный ∠BAC; искомый ∠ABC не равен ему — без дуги
  g += cDot(A) + cDot(B) + cDot(C) + cDot(O) + cLbl(A, O, "A") + cLbl(B, O, "B") + cLbl(C, O, "C") + `<text x="${O[0] - 4}" y="${O[1] + 16}" font-size="14" font-style="italic" fill="${G_S}">O</text>`
  return { condition_text: `Центр окружности, описанной около треугольника ABC, лежит на стороне AB. Найдите угол ABC, если угол BAC равен ${a}${DEG}. Ответ дайте в градусах.`, answer: String(90 - a), image_url: cFrame(g) }
}

// многоугольник по вершинам
const cPoly = (pts) => `<polygon points="${pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6" stroke-linejoin="round"/>`
const cSq = (C, s) => [[C[0] - s / 2, C[1] - s / 2], [C[0] + s / 2, C[1] - s / 2], [C[0] + s / 2, C[1] + s / 2], [C[0] - s / 2, C[1] + s / 2]]
// радиус-отрезок из центра под углом deg с подписью (подпись сдвинута ПЕРПЕНДИКУЛЯРНО
// радиусу, чтобы текст не лежал прямо на линии)
function radLabel(C, r, deg, text) {
  const P = cPt(C, r, deg)
  const mx = (C[0] + P[0]) / 2, my = (C[1] + P[1]) / 2
  const dx = P[0] - C[0], dy = P[1] - C[1], L = Math.hypot(dx, dy) || 1
  const nx = -dy / L, ny = dx / L
  return cSeg(C, P) + `<text x="${(mx + nx * 12).toFixed(1)}" y="${(my + ny * 12 + 4).toFixed(1)}" font-size="12" text-anchor="middle" fill="${G_S}">${text}</text>`
}

// B1: сторона квадрата → r вписанной = a/2
function t16SqInscR() {
  const a = 2 * randInt(3, 16)
  const C = [125, 112], s = 150, P = cSq(C, s)
  const g = cPoly(P) + cCircle(C, s / 2) + sideLabel(P[3], P[2], C, String(a))
  return { condition_text: `Сторона квадрата равна ${a}. Найдите радиус окружности, вписанной в этот квадрат.`, answer: String(a / 2), image_url: cFrame(g) }
}
// B2: квадрат описан около окружности R → площадь = (2R)²
function t16SqAroundR() {
  const r = randInt(3, 20)
  const C = [125, 112], s = 150, P = cSq(C, s)
  const g = cPoly(P) + cCircle(C, s / 2) + radLabel(C, s / 2, 55, String(r))
  return { condition_text: `Найдите площадь квадрата, описанного около окружности радиуса ${r}.`, answer: String(4 * r * r), image_url: cFrame(g) }
}
// B3: r вписанной в квадрат = k√2 → диагональ = 4k
function t16SqInscDiag() {
  const k = randInt(2, 14)
  const C = [125, 112], s = 150, P = cSq(C, s)
  const g = cPoly(P) + cCircle(C, s / 2) + cSeg(P[0], P[2]) + radLabel(C, s / 2, 55, `${k}${rT(2)}`)
  return { condition_text: `Радиус вписанной в квадрат окружности равен ${k}${rT(2)}. Найдите диагональ этого квадрата.`, answer: String(4 * k), image_url: cFrame(g) }
}
// Вершины [A,B,C,D] трапеции, ОПИСАННОЙ около окружности (Cen, r) — касается всех 4 сторон.
// Основания горизонтальны (BC сверху, AD снизу), высота = 2r; боковая касается окружности ⇔
// (полуширина низа)·(полуширина верха) = r². right=true → прямоугольная (левая боковая вертикальна).
function tangTrap(Cen, r, { right = false } = {}) {
  const [cx, cy] = Cen, yT = cy - r, yB = cy + r
  if (right) {
    const bT = r * 0.72, aB = r * r / bT           // левая боковая — вертикаль x=cx−r; правая наклонная, касательная
    return [[cx - r, yB], [cx - r, yT], [cx + bT, yT], [cx + aB, yB]]
  }
  const bT = r * 0.8, aB = r * r / bT              // равнобедренная: a·b = r²
  return [[cx - aB, yB], [cx - bT, yT], [cx + bT, yT], [cx + aB, yB]]
}
// B4: r вписанной в трапецию → высота = 2r
function t16TrapInscR() {
  const r = randInt(6, 40)
  const kind = pick(["равнобедренную", "прямоугольную", ""])
  const Cen = [125, 116], R = 58
  const [A, B, Cc, D] = tangTrap(Cen, R, { right: kind === "прямоугольную" })
  const g = cPoly([A, B, Cc, D]) + cCircle(Cen, R) + radLabel(Cen, R, 90, String(r))
  const txt = kind ? `Радиус окружности, вписанной в ${kind} трапецию, равен ${r}. Найдите высоту этой трапеции.`
    : `Радиус окружности, вписанной в трапецию, равен ${r}. Найдите высоту этой трапеции.`
  return { condition_text: txt, answer: String(2 * r), image_url: cFrame(g) }
}
// B5/6: четырёхугольник/трапеция описан около окружности, 3 стороны → 4-я (AB+CD=BC+AD)
function t16Pitot() {
  const ab = randInt(5, 14), bc = randInt(4, 10), cd = randInt(6, 14)
  const ad = ab + cd - bc
  if (ad <= Math.max(ab, bc, cd)) return t16Pitot()
  const trap = Math.random() < 0.5
  const Cen = [125, 116], R = 58
  const [A, B, Cc, D] = tangTrap(Cen, R)               // трапеция касается окружности всеми 4 сторонами
  const g = cPoly([A, B, Cc, D]) + cCircle(Cen, R) +
    sideLabel(A, B, Cen, String(ab)) + sideLabel(B, Cc, Cen, String(bc)) + sideLabel(Cc, D, Cen, String(cd)) +
    cLbl(A, Cen, "A") + cLbl(B, Cen, "B") + cLbl(Cc, Cen, "C") + cLbl(D, Cen, "D")
  const txt = trap
    ? `Трапеция ABCD с основаниями AD и BC описана около окружности, AB = ${ab}, BC = ${bc}, CD = ${cd}. Найдите AD.`
    : `Четырёхугольник ABCD описан около окружности, AB = ${ab}, BC = ${bc}, CD = ${cd}. Найдите AD.`
  return { condition_text: txt, answer: String(ad), image_url: cFrame(g) }
}
// равносторонний треугольник (вершина сверху) с центром-центроидом
function equiTri(Cen, R) {
  const A = cPt(Cen, R, 210), B = cPt(Cen, R, 330), C = cPt(Cen, R, 90)
  return { A, B, C, r: R / 2 }   // вписанная r = R/2 (для равностороннего)
}
// B7: сторона равностор. = k√3 → r вписанной = k/2 (k чётное)
function t16EquiInscR() {
  const k = 2 * randInt(2, 12)
  const Cen = [125, 122], R = 92, { A, B, C, r } = equiTri(Cen, R)
  const g = cPoly([A, B, C]) + cCircle(Cen, r)
  return { condition_text: `Сторона равностороннего треугольника равна ${k}${rT(3)}. Найдите радиус окружности, вписанной в этот треугольник.`, answer: String(k / 2), image_url: cFrame(g) }
}
// B8: r вписанной в равностор. = k√3 → сторона = 6k
function t16EquiInscSide() {
  const k = randInt(2, 12)
  const Cen = [125, 122], R = 92, { A, B, C, r } = equiTri(Cen, R)
  const g = cPoly([A, B, C]) + cCircle(Cen, r) + radLabel(Cen, r, 250, `${k}${rT(3)}`)
  return { condition_text: `Радиус окружности, вписанной в равносторонний треугольник, равен ${k}${rT(3)}. Найдите длину стороны этого треугольника.`, answer: String(6 * k), image_url: cFrame(g) }
}
// Вписанная окружность треугольника: центр I (по формуле инцентра) и радиус r = 2·S/P —
// касается всех трёх сторон по построению.
function incircleTri(A, B, C) {
  const a = Math.hypot(B[0] - C[0], B[1] - C[1])   // против A
  const b = Math.hypot(A[0] - C[0], A[1] - C[1])   // против B
  const c = Math.hypot(A[0] - B[0], A[1] - B[1])   // против C
  const P = a + b + c
  const I = [(a * A[0] + b * B[0] + c * C[0]) / P, (a * A[1] + b * B[1] + c * C[1]) / P]
  const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2
  return { I, r: 2 * area / P }
}
// B9: периметр P, сторона (отвлекающая), r → площадь = P·r/2
function t16IncircleArea() {
  let P, r
  do { P = randInt(30, 120); r = randInt(2, 12) } while ((P * r) % 2 !== 0)
  const side = randInt(7, Math.floor(P / 2) - 1)
  const A = [40, 175], B = [120, 45], Cc = [212, 172]
  const { I, r: rDraw } = incircleTri(A, B, Cc)      // реальная вписанная — касается всех сторон
  const g = cPoly([A, B, Cc]) + cCircle(I, rDraw)
  return { condition_text: `Периметр треугольника равен ${P}, одна из сторон равна ${side}, а радиус вписанной в него окружности равен ${r}. Найдите площадь этого треугольника.`, answer: String(P * r / 2), image_url: cFrame(g) }
}
// B10: диагональ ромба AC + tg∠BCA=b/a → r вписанной (пифагорова тройка)
// Только тройки с гипотенузой c=5: r = a·b·s/c = 12s/5 всегда конечная десятичная дробь
// (2,4 / 4,8 / 7,2 / 9,6 / 12). Тройки с c=13,17 давали непредставимый ответ вида 120/17.
function t16RhombInscR() {
  const [a, b, c] = pick([[3, 4, 5], [4, 3, 5]])
  const s = pick([1, 2, 3, 4, 5])
  const AC = 2 * a * s, r = decOut(a * b * s / c)  // r = a·b·s/c
  const Cen = [125, 115], p = [[125, 35], [210, 115], [125, 195], [40, 115]]  // ромб (диагонали верт/гориз)
  const hh = (p[1][0] - p[3][0]) / 2, hv = (p[2][1] - p[0][1]) / 2            // полудиагонали
  const rDraw = hh * hv / Math.hypot(hh, hv)                                  // r вписанной = (произв. полудиаг.)/сторона ⇒ касается сторон
  const g = cPoly(p) + cSeg(p[3], p[1]) + cSeg(p[0], p[2]) + cCircle(Cen, rDraw) +
    angArc(p[1], p[0], Cen, 20, null) + cLbl(p[3], Cen, "A") + cLbl(p[0], Cen, "B") + cLbl(p[1], Cen, "C") + cLbl(p[2], Cen, "D")
  return { condition_text: `Диагональ AC ромба ABCD равна ${AC}, а tg∠BCA = ${fT(b, a)}. Найдите радиус окружности, вписанной в ромб.`, answer: r, image_url: cFrame(g) }
}

// C1: сторона квадрата = k√2 → R описанной = k
function t16SqCircR() {
  const k = randInt(3, 20)
  const C = [125, 112], s = 138, P = cSq(C, s)
  const g = cCircle(C, s * Math.SQRT1_2) + cPoly(P) + sideLabel(P[3], P[2], C, `${k}${rT(2)}`)
  return { condition_text: `Сторона квадрата равна ${k}${rT(2)}. Найдите радиус окружности, описанной около этого квадрата.`, answer: String(k), image_url: cFrame(g) }
}
// C2: R описанной около квадрата = k√2 → сторона = 2k
function t16SqCircSide() {
  const k = randInt(3, 16)
  const C = [125, 112], s = 138, P = cSq(C, s), R = s * Math.SQRT1_2
  const g = cCircle(C, R) + cPoly(P) + radLabel(C, R, 45, `${k}${rT(2)}`)   // 45° ⇒ радиус в угол квадрата (на окружности)
  return { condition_text: `Радиус окружности, описанной около квадрата, равен ${k}${rT(2)}. Найдите длину стороны этого квадрата.`, answer: String(2 * k), image_url: cFrame(g) }
}
// C3: сторона равностор. = k√3 → R описанной = k
function t16EquiCircR() {
  const k = randInt(3, 18)
  const Cen = [125, 118], R = 88, { A, B, C } = equiTri(Cen, R)
  const g = cCircle(Cen, R) + cPoly([A, B, C])
  return { condition_text: `Сторона равностороннего треугольника равна ${k}${rT(3)}. Найдите радиус окружности, описанной около этого треугольника.`, answer: String(k), image_url: cFrame(g) }
}
// C4: R описанной около равностор. = k√3 → сторона = 3k
function t16EquiCircSide() {
  const k = randInt(3, 12)
  const Cen = [125, 118], R = 88, { A, B, C } = equiTri(Cen, R)
  const g = cCircle(Cen, R) + cPoly([A, B, C]) + radLabel(Cen, R, 330, `${k}${rT(3)}`)   // 330° ⇒ радиус в вершину B (на окружности)
  return { condition_text: `Радиус окружности, описанной около равностороннего треугольника, равен ${k}${rT(3)}. Найдите длину стороны этого треугольника.`, answer: String(3 * k), image_url: cFrame(g) }
}
// C5: центр на AB (AB=2R), одна из «катет BC/AC» → другая (Пифагор)
function t16CenterOnABLeg() {
  const [a, b, c] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [20, 21, 29], [9, 12, 15]])
  const k = pick([1, 1, 2])
  const R = c * k / 2                                   // AB = 2R = ck
  const findAC = Math.random() < 0.5
  const given = findAC ? b * k : a * k, ans = findAC ? a * k : b * k
  const givenName = findAC ? "BC" : "AC", ansName = findAC ? "AC" : "BC"
  const O = [125, 112], rr = 82                           // полная окружность помещается в кадр 250×225
  const A = cPt(O, rr, 180), B = cPt(O, rr, 0), C = cPt(O, rr, 62)
  const g = cCircle(O, rr) + cSeg(A, B) + cSeg(A, C) + cSeg(B, C) + rightMark(C, A, B, 10) +
    cDot(O) + cLbl(A, O, "A") + cLbl(B, O, "B") + cLbl(C, O, "C") + `<text x="${O[0] - 4}" y="${O[1] + 16}" font-size="14" font-style="italic" fill="${G_S}">O</text>`
  return { condition_text: `Центр окружности, описанной около треугольника ABC, лежит на стороне AB. Радиус окружности равен ${R % 1 ? decOut(R) : R}. Найдите ${ansName}, если ${givenName} = ${given}.`, answer: String(ans), image_url: cFrame(g) }
}
// C6: прямоуг. ∠C=90, катеты → R описанной = гипотенуза/2
function t16RightCircR() {
  const [a, b, c] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25], [10, 24, 26]])
  const k = pick([1, 1, 2])
  const O = [125, 112], rr = 82                          // полный круг помещается в кадр 250×225
  const A = cPt(O, rr, 180), B = cPt(O, rr, 0), C = cPt(O, rr, 62)
  const G = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3]   // центроид: подписи сторон сдвигаем внутрь, не на дугу
  const g = cCircle(O, rr) + cSeg(A, B) + cSeg(A, C) + cSeg(B, C) + rightMark(C, A, B, 10) +
    sideLabelInner(C, A, G, String(b * k)) + sideLabelInner(C, B, G, String(a * k)) +
    cLbl(A, O, "A") + cLbl(B, O, "B") + cLbl(C, O, "C")
  return { condition_text: `В треугольнике ABC известно, что AC = ${b * k}, BC = ${a * k}, угол C равен 90${DEG}. Найдите радиус описанной около этого треугольника окружности.`, answer: String(c * k / 2 % 1 ? decOut(c * k / 2) : c * k / 2), image_url: cFrame(g) }
}
// C8: ∠C=60/120/45/30/150, AB → R описанной (теорема синусов R=AB/(2 sinC))
function t16CircLawSin() {
  const opt = pick([
    { ang: 60, ab: (k) => `${k}${rT(3)}`, R: (k) => k },
    { ang: 120, ab: (k) => `${k}${rT(3)}`, R: (k) => k },
    { ang: 45, ab: (k) => `${k}${rT(2)}`, R: (k) => k },
    { ang: 135, ab: (k) => `${k}${rT(2)}`, R: (k) => k },
    { ang: 30, ab: (k) => String(k), R: (k) => k },
    { ang: 150, ab: (k) => String(k), R: (k) => k },
  ])
  const k = randInt(3, 16)
  const A = cPt(O16, R16, 205), B = cPt(O16, R16, 335), C = cPt(O16, R16, 85)
  const g = cCircle(O16, R16) + cSeg(A, B) + cSeg(A, C) + cSeg(B, C) + angArc(C, A, B, 20, opt.ang + DEG) +
    cLbl(A, O16, "A") + cLbl(B, O16, "B") + cLbl(C, O16, "C")
  return { condition_text: `В треугольнике ABC угол C равен ${opt.ang}${DEG}, AB = ${opt.ab(k)}. Найдите радиус окружности, описанной около этого треугольника.`, answer: String(opt.R(k)), image_url: cFrame(g) }
}
// C9: равностор. вписан, расстояние от O до стороны = k√3 → сторона = 6k
function t16EquiDistSide() {
  const k = randInt(1, 8)
  const Cen = [125, 122], R = 88, { A, B, C } = equiTri(Cen, R)
  const M = gmid(A, B)
  const g = cCircle(Cen, R) + cPoly([A, B, C]) + cSeg(Cen, M) + rightMark(M, Cen, A, 8) +
    `<text x="${Cen[0] + 4}" y="${Cen[1] - 4}" font-size="13" font-style="italic" fill="${G_S}">O</text>` + cDot(Cen)
  return { condition_text: `В окружность с центром в точке O вписан равносторонний треугольник. Расстояние от точки O до сторон треугольника равно ${k}${rT(3)}. Найдите сторону треугольника.`, answer: String(6 * k), image_url: cFrame(g) }
}
// C10: прямоугольник, sin(∠ между стороной и диагональю)=a/c, диаметр опис.=ck → площадь=ab·k²
function t16RectDiag() {
  const [a, b, c] = pick([[7, 24, 25], [24, 7, 25], [3, 4, 5], [4, 3, 5], [8, 15, 17], [15, 8, 17], [20, 21, 29]])
  const k = pick([1, 1, 2])
  const sinv = decOut(a / c)
  const w = 168, h = 108, C = [125, 112]
  const P = [[C[0] - w / 2, C[1] - h / 2], [C[0] + w / 2, C[1] - h / 2], [C[0] + w / 2, C[1] + h / 2], [C[0] - w / 2, C[1] + h / 2]]
  const g = cCircle(C, Math.hypot(w, h) / 2) + cPoly(P) + cSeg(P[0], P[2]) + angArc(P[0], P[1], P[2], 20, null)
  return { condition_text: `Синус угла между стороной и диагональю прямоугольника равен ${sinv}. Диаметр описанной около него окружности равен ${c * k}. Найдите площадь прямоугольника.`, answer: String(a * b * k * k), image_url: cFrame(g) }
}
// C7: O — середина стороны CD квадрата ABCD; окружность с центром O проходит через
// вершину A. R = OA = a√5/2 (a — сторона) ⇒ площадь = a² = 4R²/5. Радиус даётся либо как
// k√5 (тогда ответ 4k² — целый), либо как конечная десятичная (тогда ответ 4R²/5, знам. 5).
function t16SqOMid() {
  let Rtext, area
  if (Math.random() < 0.4) {
    const k = randInt(1, 7)
    Rtext = k === 1 ? rT(5) : `${k}${rT(5)}`
    area = String(4 * k * k)
  } else {
    const r2 = randInt(1, 12) / 2                       // R ∈ {0,5; 1; 1,5; …; 6}
    Rtext = decOut(r2)
    area = decOut(4 * r2 * r2 / 5)
  }
  const s = 68, O = [125, 138]                          // O — середина нижней стороны DC
  const D = [O[0] - s / 2, O[1]], C = [O[0] + s / 2, O[1]]
  const A = [D[0], D[1] - s], B = [C[0], C[1] - s]
  const R = s * Math.sqrt(5) / 2, cen = [O[0], O[1] - s / 2]
  const g = cCircle(O, R) + cSeg([O[0] - R, O[1]], [O[0] + R, O[1]]) + cPoly([A, B, C, D]) + cDot(O) +
    cLbl(A, cen, "A") + cLbl(B, cen, "B") + cLbl(C, cen, "C") + cLbl(D, cen, "D") + oLabel(O, -2, -10)
  return { condition_text: `Точка O является серединой стороны CD квадрата ABCD. Радиус окружности с центром в точке O, проходящей через вершину A, равен ${Rtext}. Найдите площадь квадрата ABCD.`, answer: area, image_url: cFrame(g) }
}

// ── №17. Геометрия: четырёхугольники ──────────────────────────────────────────
// Эталон — банк ФИПИ (КЭС 7.3 «Многоугольники» без окружности/клетчатой + угловые
// ромба из 7.2) и math100 (файлы 17-1…17-3). Формулы сверены с ключами ответов.
const q17 = (g, { W = 256, H = 180 } = {}) => svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`)
// параллелограмм ABCD (A,B низ; C,D верх; sk — наклон верха вправо)
const paraPts = (C0, w, h, sk) => [[C0[0] - w / 2 - sk, C0[1] + h / 2], [C0[0] + w / 2 - sk, C0[1] + h / 2], [C0[0] + w / 2 + sk, C0[1] - h / 2], [C0[0] - w / 2 + sk, C0[1] - h / 2]]
// равнобедренная трапеция ABCD (осн. AD снизу, BC сверху)
const trapPts = (C0, wa, wb, h) => [[C0[0] - wa / 2, C0[1] + h / 2], [C0[0] - wb / 2, C0[1] - h / 2], [C0[0] + wb / 2, C0[1] - h / 2], [C0[0] + wa / 2, C0[1] + h / 2]]
const labelABCD = (P, cen) => P.map((p, i) => cLbl(p, cen, "ABCD"[i])).join("")
const cen4 = (P) => [(P[0][0] + P[1][0] + P[2][0] + P[3][0]) / 4, (P[0][1] + P[1][1] + P[2][1] + P[3][1]) / 4]

// 1. угол параллелограмма → больший/меньший (max/min(x, 180−x))
function t17ParaAngle() {
  const x = randInt(35, 145)
  const big = Math.random() < 0.5
  const P = paraPts([128, 92], 132, 84, 24), cen = cen4(P)
  const g = cPoly(P) + angArc(P[0], P[1], P[3], 20, x + DEG) + labelABCD(P, cen)
  return { condition_text: `Один из углов параллелограмма равен ${x}${DEG}. Найдите ${big ? "больший" : "меньший"} угол этого параллелограмма. Ответ дайте в градусах.`, answer: String(big ? Math.max(x, 180 - x) : Math.min(x, 180 - x)), image_url: q17(g) }
}
// 1б. площадь параллелограмма по чертежу: нарисованы высота h, разбиение основания на p и q
// и боковая сторона s = √(p²+h²) (пифагорова тройка). Площадь = (p+q)·h. Данные — в чертеже.
function t17ParaAreaFig() {
  const [leg1, leg2, s] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 6, 10], [12, 5, 13]])
  const p = leg1, h = leg2                              // p — база под наклонной стороной, h — высота
  const q = randInt(2, 11)                              // второй отрезок основания (свободный)
  const area = (p + q) * h, b = p + q
  const mirror = Math.random() < 0.5                    // наклонная слева или справа
  const Wu = 2 * p + q, sc = Math.min(196 / Wu, 92 / h)
  const ox = (256 - Wu * sc) / 2, oy = 92 + h * sc / 2
  // левый наклон: D низ-лев, C низ-прав, foot F (DF=p), apex над F, top2 верх-прав
  let D = [ox, oy], C = [ox + b * sc, oy], F = [ox + p * sc, oy]
  let apex = [F[0], oy - h * sc], top2 = [ox + (p + b) * sc, oy - h * sc]
  if (mirror) { const rx = (P) => [256 - P[0], P[1]]; D = rx(D); C = rx(C); F = rx(F); apex = rx(apex); top2 = rx(top2) }
  const tx = (x, y, t) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="13" text-anchor="middle" fill="${G_S}">${t}</text>`
  const cen = cen4([D, C, top2, apex])
  const g = cPoly([D, C, top2, apex]) + cSeg(apex, F) + rightMark(F, apex, C, 9) +
    tx((D[0] + F[0]) / 2, oy + 15, String(p)) + tx((F[0] + C[0]) / 2, oy + 15, String(q)) +
    tx((apex[0] + F[0]) / 2 + (mirror ? -9 : 9), (apex[1] + F[1]) / 2 + 4, String(h)) +
    sideLabel(D, apex, cen, String(s))
  return { condition_text: `Найдите площадь параллелограмма, изображённого на рисунке.`, answer: String(area), image_url: q17(g) }
}
// 2. угол ромба → больший/меньший
function t17RhombAngle() {
  const x = pick([randInt(35, 85), randInt(95, 145)])
  const big = Math.random() < 0.5
  const C0 = [120, 92], p = [[C0[0] - 80, C0[1]], [C0[0], C0[1] - 60], [C0[0] + 80, C0[1]], [C0[0], C0[1] + 60]]
  const g = cPoly(p) + angArc(p[0], p[1], p[3], 20, x + DEG) + labelABCD(p, C0)
  return { condition_text: `Один из углов ромба равен ${x}${DEG}. Найдите ${big ? "больший" : "меньший"} угол этого ромба. Ответ дайте в градусах.`, answer: String(big ? Math.max(x, 180 - x) : Math.min(x, 180 - x)), image_url: q17(g) }
}
// 3. равнобедренная трапеция: угол → меньший/больший
function t17TrapAngleIso() {
  const x = pick([randInt(100, 140), randInt(40, 80)])
  const smaller = Math.random() < 0.5
  const P = trapPts([120, 92], 170, 80, 84), cen = cen4(P)
  const g = cPoly(P) + angArc(P[3], P[0], P[2], 20, x + DEG) + labelABCD(P, cen)
  return { condition_text: `Один из углов равнобедренной трапеции равен ${x}${DEG}. Найдите ${smaller ? "меньший" : "больший"} угол этой трапеции. Ответ дайте в градусах.`, answer: String(smaller ? Math.min(x, 180 - x) : Math.max(x, 180 - x)), image_url: q17(g) }
}
// 4. прямоугольная трапеция: угол → меньший/больший (два угла 90, x, 180−x)
function t17TrapAngleRight() {
  const x = pick([randInt(100, 140), randInt(50, 80)])
  const smaller = Math.random() < 0.5
  const P = [[60, 134], [60, 50], [190, 50], [210, 134]], cen = cen4(P)
  const g = cPoly(P) + rightMark(P[1], P[0], P[2], 9) + rightMark(P[0], P[1], P[3], 9) + angArc(P[3], P[0], P[2], 18, x + DEG) + labelABCD(P, cen)
  return { condition_text: `Один из углов прямоугольной трапеции равен ${x}${DEG}. Найдите ${smaller ? "меньший" : "больший"} угол этой трапеции. Ответ дайте в градусах.`, answer: String(smaller ? Math.min(x, 180 - x) : Math.max(x, 180 - x)), image_url: q17(g) }
}
// 5. сумма двух углов равноб. трапеции → меньший/больший
function t17TrapAngleSum() {
  const each = randInt(50, 88), s = 2 * each          // два равных угла
  const smaller = Math.random() < 0.5
  const P = trapPts([120, 92], 170, 80, 84), cen = cen4(P)
  const g = cPoly(P) + labelABCD(P, cen)
  return { condition_text: `Сумма двух углов равнобедренной трапеции равна ${s}${DEG}. Найдите ${smaller ? "меньший" : "больший"} угол этой трапеции. Ответ дайте в градусах.`, answer: String(smaller ? Math.min(each, 180 - each) : Math.max(each, 180 - each)), image_url: q17(g) }
}
// 6. биссектриса ∠A со стороной BC под углом x → острый угол параллелограмма = 2x
function t17ParaBisector() {
  const x = randInt(20, 44)
  const P = paraPts([128, 92], 132, 84, 24), cen = cen4(P)
  const K = [P[2][0] + (P[3][0] - P[2][0]) * 0.5, P[2][1]]  // точка на BC (P[3]-P[2] верх)
  const g = cPoly(P) + cSeg(P[0], K) + angArc(K, P[3], P[0], 18, x + DEG) + labelABCD(P, cen)
  return { condition_text: `Найдите острый угол параллелограмма ABCD, если биссектриса угла A образует со стороной BC угол, равный ${x}${DEG}. Ответ дайте в градусах.`, answer: String(2 * x), image_url: q17(g) }
}
// 7. диагональ образует со сторонами углы x,y → больший/меньший угол = 180−(x+y)/(x+y)
function t17ParaDiag() {
  const x = randInt(20, 55), y = randInt(20, 55)
  const big = Math.random() < 0.5, diag = pick(["AC", "BD"])
  // менее плоский параллелограмм: оба подугла при A ≈ 36° — иначе метки углов
  // (напр. «30°») не помещаются в узкий клин между диагональю и стороной
  const P = paraPts([128, 86], 114, 108, 18), cen = cen4(P)
  const [cx, cy] = arcPair(x, y)
  const g = cPoly(P) + cSeg(P[0], P[2]) + angArc(P[0], P[1], P[2], 22, x + DEG, cx) + angArc(P[0], P[2], P[3], 34, y + DEG, cy) + labelABCD(P, cen)
  return { condition_text: `Диагональ ${diag} параллелограмма ABCD образует с его сторонами углы, равные ${x}${DEG} и ${y}${DEG}. Найдите ${big ? "больший" : "меньший"} угол этого параллелограмма. Ответ дайте в градусах.`, answer: String(big ? Math.max(x + y, 180 - x - y) : Math.min(x + y, 180 - x - y)), image_url: q17(g) }
}
// 8. диагонали параллелограмма в O: AC,BD,AB (отвлек.) → DO = BD/2
function t17ParaDiagO() {
  const bd = 2 * randInt(4, 15), ac = 2 * randInt(4, 15), ab = randInt(4, 20)
  const P = paraPts([128, 92], 132, 84, 22), cen = cen4(P)
  // «O» центрируем в нижнем клине между диагоналями (из-за скоса — чуть левее центра),
  // иначе метка ложится прямо на диагональ BD
  const g = cPoly(P) + cSeg(P[0], P[2]) + cSeg(P[1], P[3]) + cDot(cen) + `<text x="${cen[0] - 6}" y="${cen[1] + 16}" font-size="13" font-style="italic" text-anchor="middle" fill="${G_S}">O</text>` + labelABCD(P, cen)
  return { condition_text: `Диагонали AC и BD параллелограмма ABCD пересекаются в точке O, AC = ${ac}, BD = ${bd}, AB = ${ab}. Найдите DO.`, answer: String(bd / 2), image_url: q17(g) }
}
// 9. диагонали прямоугольника в O: BO,AB(отвлек.) → AC = 2·BO
function t17RectDiagO() {
  const bo = randInt(8, 30), ab = randInt(10, 50)
  const P = [[55, 138], [55, 52], [205, 52], [205, 138]], cen = cen4(P)
  const g = cPoly(P) + cSeg(P[0], P[2]) + cSeg(P[1], P[3]) + cDot(cen) + `<text x="${cen[0]}" y="${cen[1] + 16}" font-size="13" font-style="italic" text-anchor="middle" fill="${G_S}">O</text>` + labelABCD(P, cen)
  return { condition_text: `Диагонали AC и BD прямоугольника ABCD пересекаются в точке O, BO = ${bo}, AB = ${ab}. Найдите AC.`, answer: String(2 * bo), image_url: q17(g) }
}
// 10. диагональ прямоугольника угол x со стороной → острый угол между диагоналями = min(2x,180−2x)
function t17RectDiagAngle() {
  const x = pick([randInt(15, 44), randInt(46, 75)])
  const P = [[55, 138], [55, 52], [205, 52], [205, 138]], cen = cen4(P)
  const g = cPoly(P) + cSeg(P[0], P[2]) + cSeg(P[1], P[3]) + angArc(P[0], P[3], P[2], 26, x + DEG) + labelABCD(P, cen)
  return { condition_text: `Диагональ прямоугольника образует угол ${x}${DEG} с одной из его сторон. Найдите острый угол между диагоналями этого прямоугольника. Ответ дайте в градусах.`, answer: String(Math.min(2 * x, 180 - 2 * x)), image_url: q17(g) }
}
// 11. ромб ∠ABC → ∠ACD = (180 − ∠ABC)/2
function t17RhombACD() {
  const x = 2 * randInt(20, 74)
  const C0 = [120, 92], p = [[C0[0] - 80, C0[1]], [C0[0], C0[1] - 60], [C0[0] + 80, C0[1]], [C0[0], C0[1] + 60]]
  const g = cPoly(p) + cSeg(p[0], p[2]) + angArc(p[1], p[0], p[2], 18, x + DEG) + labelABCD(p, C0)
  return { condition_text: `В ромбе ABCD угол ABC равен ${x}${DEG}. Найдите угол ACD. Ответ дайте в градусах.`, answer: String((180 - x) / 2), image_url: q17(g) }
}
// 12. сторона ромба, угол → высота = a·sin(острый)
function t17RhombHeight() {
  const a = pick([10, 12, 14, 16, 18, 20, 24, 30, 34, 40]), ang = pick([150, 30])
  const h = a * 0.5                                    // sin(30°) = sin(150°) = 1/2 (точно)
  if (h % 1 !== 0) return t17RhombHeight()
  const C0 = [120, 92], p = [[C0[0] - 80, C0[1]], [C0[0], C0[1] - 55], [C0[0] + 80, C0[1]], [C0[0], C0[1] + 55]]
  const g = cPoly(p) + angArc(p[0], p[1], p[3], 18, ang + DEG) + labelABCD(p, C0)
  return { condition_text: `Сторона ромба равна ${a}, а один из углов этого ромба равен ${ang}${DEG}. Найдите высоту этого ромба.`, answer: String(h), image_url: q17(g) }
}
// 13. периметр ромба, угол → площадь = (P/4)²·sin
function t17RhombAreaP() {
  const a = pick([8, 12, 16, 20, 24, 28, 40]), P4 = 4 * a, ang = pick([30, 150])
  const area = a * a * 0.5                             // sin(30°) = 1/2 (точно)
  const C0 = [120, 92], p = [[C0[0] - 80, C0[1]], [C0[0], C0[1] - 55], [C0[0] + 80, C0[1]], [C0[0], C0[1] + 55]]
  const g = cPoly(p) + angArc(p[0], p[1], p[3], 18, ang + DEG)
  return { condition_text: `Периметр ромба равен ${P4}, а один из углов равен ${ang}${DEG}. Найдите площадь этого ромба.`, answer: String(area), image_url: q17(g) }
}
// 14. диагональ AC ромба, tg∠BCA → площадь = ½·AC²·tg
function t17RhombAreaDiag() {
  const t = pick([[1, 5], [2, 5], [1, 4], [3, 4], [1, 10], [3, 10], [2, 3]]), ac = pick([10, 20, 30, 40, 20, 30])
  const bd = ac * t[0] / t[1]
  if (bd % 1 !== 0 || (ac * bd / 2) % 1 !== 0) return t17RhombAreaDiag()
  const C0 = [120, 92], p = [[C0[0] - 80, C0[1]], [C0[0], C0[1] - 55], [C0[0] + 80, C0[1]], [C0[0], C0[1] + 55]]
  const g = cPoly(p) + cSeg(p[0], p[2]) + cSeg(p[1], p[3]) + angArc(p[2], p[1], p[0], 18, null) + labelABCD(p, C0)
  return { condition_text: `Диагональ AC ромба ABCD равна ${ac}, а tg∠BCA = ${decOut(t[0] / t[1])}. Найдите площадь ромба.`, answer: String(ac * bd / 2), image_url: q17(g) }
}
// 15. острый угол ромба → угол между стороной и меньшей диагональю = (180−острый)/2
function t17RhombSmallDiag() {
  const x = 2 * randInt(15, 44)
  const C0 = [120, 92], p = [[C0[0] - 80, C0[1]], [C0[0], C0[1] - 55], [C0[0] + 80, C0[1]], [C0[0], C0[1] + 55]]
  const g = cPoly(p) + cSeg(p[1], p[3]) + angArc(p[0], p[1], p[3], 18, x + DEG)
  return { condition_text: `Острый угол ромба равен ${x}${DEG}. Сколько градусов составляет угол между стороной и меньшей диагональю ромба?`, answer: String((180 - x) / 2), image_url: q17(g) }
}
// 16. угол ромба (тупой) → угол между высотой и большей диагональю = угол/2
function t17RhombHeightDiag() {
  const x = 2 * randInt(46, 80)
  const C0 = [120, 92], p = [[C0[0] - 80, C0[1]], [C0[0], C0[1] - 55], [C0[0] + 80, C0[1]], [C0[0], C0[1] + 55]]
  // угол ромба на рисунке НЕ помечаем: задача про высоту и диагональ, а нарисованный
  // угол при вершине не соответствует данному x — метка вводила бы в заблуждение
  const g = cPoly(p) + cSeg(p[0], p[2])
  return { condition_text: `Один из углов ромба равен ${x}${DEG}. Сколько градусов составляет угол между высотой и большей диагональю ромба?`, answer: String(x / 2), image_url: q17(g) }
}
// 17. перпендикуляр из O к стороне, угол x с диагональю → острый угол ромба = 2x
function t17RhombPerp() {
  const x = randInt(20, 44)
  const C0 = [120, 92], p = [[C0[0] - 80, C0[1]], [C0[0], C0[1] - 55], [C0[0] + 80, C0[1]], [C0[0], C0[1] + 55]]
  const M = footPerp(p[2], p[3], C0)
  const g = cPoly(p) + cSeg(p[0], p[2]) + cSeg(p[1], p[3]) + cSeg(C0, M) + rightMark(M, C0, p[2], 7) + angArc(C0, p[2], M, 16, x + DEG) + cDot(C0)
  return { condition_text: `Перпендикуляр, проведённый из точки пересечения диагоналей ромба к его стороне, образует с одной из его диагоналей угол ${x}${DEG}. Сколько градусов составляет острый угол ромба?`, answer: String(2 * x), image_url: q17(g) }
}
// 18. сторона квадрата = k√2 → диагональ = 2k
function t17SquareDiag() {
  const k = randInt(2, 20)
  const P = cSq([120, 92], 110), cen = [120, 92]
  const g = cPoly(P) + cSeg(P[0], P[2]) + sideLabel(P[3], P[2], cen, `${k}${rT(2)}`)
  return { condition_text: `Сторона квадрата равна ${k}${rT(2)}. Найдите диагональ этого квадрата.`, answer: String(2 * k), image_url: q17(g) }
}
// 19. основания, высота(отвлек.) → средняя линия = (a+b)/2
function t17TrapMidline() {
  const a = randInt(2, 16), b = a + 2 * randInt(1, 8), h = randInt(3, 12)
  const P = trapPts([120, 92], 170, 80, 84), cen = cen4(P)
  const g = cPoly(P) + cSeg(gmid(P[0], P[1]), gmid(P[2], P[3])) + labelABCD(P, cen)
  return { condition_text: `Основания трапеции равны ${a} и ${b}, а высота равна ${h}. Найдите среднюю линию этой трапеции.`, answer: decOut((a + b) / 2), image_url: q17(g) }
}
// 20. основания, высота → площадь = (a+b)/2·h
function t17TrapArea() {
  let a, b, h
  do { a = randInt(3, 16); b = a + 2 * randInt(1, 8); h = randInt(3, 14) } while (((a + b) * h) % 2 !== 0)
  const P = trapPts([120, 92], 170, 80, 84), cen = cen4(P)
  const g = cPoly(P) + labelABCD(P, cen)
  return { condition_text: `Основания трапеции равны ${a} и ${b}, а высота равна ${h}. Найдите площадь этой трапеции.`, answer: String((a + b) * h / 2), image_url: q17(g) }
}
// 21. высота делит основание на p,q → второе основание = q−p (T6/T8)
function t17TrapFoot() {
  const p = randInt(2, 8), q = p + randInt(2, 8)
  const fromC = Math.random() < 0.5
  const P = trapPts([120, 92], 180, 70, 84), cen = cen4(P)
  const H = [P[2][0], P[0][1]]
  const g = cPoly(P) + cSeg(P[2], H) + rightMark(H, P[2], P[3], 8) + labelABCD(P, cen)
  return { condition_text: fromC
    ? `Высота равнобедренной трапеции, проведённая из вершины C, делит основание AD на отрезки длиной ${p} и ${q}. Найдите длину основания BC.`
    : `Высота равнобедренной трапеции, проведённая из конца её меньшего основания, делит большее основание на отрезки длиной ${p} и ${q}. Найдите меньшее основание трапеции.`, answer: String(q - p), image_url: q17(g) }
}
// 22. основания → больший отрезок средней линии от диагонали = maxBase/2
function t17TrapMidDiag() {
  const a = randInt(1, 9), b = a + 2 * randInt(2, 8)
  const P = trapPts([120, 92], 175, 75, 84), cen = cen4(P)
  const g = cPoly(P) + cSeg(gmid(P[0], P[1]), gmid(P[2], P[3])) + cSeg(P[0], P[2]) + labelABCD(P, cen)
  return { condition_text: `Основания трапеции равны ${a} и ${b}. Найдите больший из отрезков, на которые делит среднюю линию этой трапеции одна из её диагоналей.`, answer: decOut(b / 2), image_url: q17(g) }
}
// 23. диагональ равноб. трапеции угол 45° с основанием → высота = (a+b)/2
function t17TrapDiag45() {
  const a = randInt(2, 12), b = a + 2 * randInt(1, 6)
  const P = trapPts([120, 92], 175, 80, 78), cen = cen4(P)
  const g = cPoly(P) + cSeg(P[0], P[2]) + angArc(P[0], P[3], P[2], 20, "45" + DEG) + labelABCD(P, cen)
  return { condition_text: `Диагональ равнобедренной трапеции образует с её основанием угол 45${DEG}. Найдите высоту трапеции, если её основания равны ${a} и ${b}.`, answer: decOut((a + b) / 2), image_url: q17(g) }
}
// 24. равноб. трапеция: высота h, меньшее основание b, угол 45° → большее = b + 2h (и обратный)
function t17TrapFigure() {
  const h = randInt(3, 12), b = randInt(3, 14)
  const findBig = Math.random() < 0.5
  const P = trapPts([120, 92], 180, 80, 80), cen = cen4(P)
  const H = [P[1][0], P[0][1]]
  const g = cPoly(P) + cSeg(P[1], H) + rightMark(H, P[1], P[0], 8) + angArc(P[0], P[3], P[1], 18, "45" + DEG) + labelABCD(P, cen)
  return { condition_text: findBig
    ? `В равнобедренной трапеции меньшее основание равно ${b}, высота равна ${h}, а угол при основании равен 45${DEG}. Найдите большее основание.`
    : `В равнобедренной трапеции большее основание равно ${b + 2 * h}, высота равна ${h}, а угол при основании равен 45${DEG}. Найдите меньшее основание.`, answer: findBig ? String(b + 2 * h) : String(b), image_url: q17(g) }
}
// 25. равноб. трапеция ∠D, диагональ AC угол x с CD → угол AC с меньшим осн. = 180−D−x
function t17TrapDiagBase() {
  const d = randInt(65, 82), x = randInt(40, Math.min(70, 175 - d))
  const P = trapPts([120, 92], 180, 78, 84), cen = cen4(P)
  const [cd, cx] = arcPair(d, x)
  const g = cPoly(P) + cSeg(P[0], P[2]) + angArc(P[3], P[0], P[2], 18, d + DEG, cd) + angArc(P[2], P[0], P[3], 22, x + DEG, cx) + labelABCD(P, cen)
  return { condition_text: `В равнобедренной трапеции с основаниями AD и BC угол D равен ${d}${DEG}. Диагональ AC образует со стороной CD угол ${x}${DEG}. Сколько градусов составляет угол между этой диагональю и меньшим основанием BC?`, answer: String(180 - d - x), image_url: q17(g) }
}
// 26. равноб. трапеция ∠D, AC биссектриса ∠BAD → ∠ACD = 180 − 3D/2
function t17TrapBisector() {
  const d = 2 * randInt(24, 39)
  const P = trapPts([120, 92], 180, 78, 84), cen = cen4(P)
  const g = cPoly(P) + cSeg(P[0], P[2]) + angArc(P[3], P[0], P[2], 18, d + DEG) + labelABCD(P, cen)
  return { condition_text: `В равнобедренной трапеции ABCD угол D равен ${d}${DEG}. Найдите градусную меру угла ACD, если луч AC является биссектрисой угла BAD.`, answer: String(180 - 3 * d / 2), image_url: q17(g) }
}
// 27. диагональ равноб. трапеции углы x,y с боковыми → угол при большем основании = (180−|x−y|)/2
function t17TrapDiagLat() {
  let x, y
  do { x = randInt(25, 60); y = randInt(25, 85) } while (Math.abs(x - y) % 2 !== 0 || x === y)
  // выше трапеция (h=100): клинья диагональ–основание при B и D ≈38° — иначе метки
  // (напр. «83°») зажаты между диагональю BD и стороной
  const P = trapPts([120, 92], 180, 78, 100), cen = cen4(P)
  const g = cPoly(P) + cSeg(P[1], P[3]) + angArc(P[3], P[0], P[1], 18, y + DEG, 2) + angArc(P[1], P[2], P[3], 20, x + DEG, 1) + labelABCD(P, cen)
  return { condition_text: `Диагональ равнобедренной трапеции образует с боковыми сторонами углы ${x}${DEG} и ${y}${DEG}. Сколько градусов составляет угол при большем основании трапеции?`, answer: String((180 - Math.abs(x - y)) / 2), image_url: q17(g) }
}
// 28. площадь параллелограмма, две стороны → большая высота = площадь/меньшую сторону
function t17ParaHeight() {
  const s1 = randInt(4, 12), s2 = s1 + randInt(1, 10), area = s2 * randInt(2, 8)
  const P = paraPts([128, 92], 132, 80, 24), cen = cen4(P)
  const g = cPoly(P) + labelABCD(P, cen)
  return { condition_text: `Площадь параллелограмма равна ${area}, а две его стороны равны ${s1} и ${s2}. Найдите его высоты. В ответе укажите большую высоту.`, answer: decOut(area / s1), image_url: q17(g) }
}
// 29. равноб. трапеция: основания a,b, угол боковой с основанием 45° → площадь = (a+b)(b−a)/4
function t17TrapBaseAngle45() {
  let a, b
  do { a = randInt(2, 12); b = a + 2 * randInt(1, 6) } while (((a + b) * (b - a)) % 4 !== 0)
  const P = trapPts([120, 92], 175, 80, 78), cen = cen4(P)
  const g = cPoly(P) + angArc(P[0], P[3], P[1], 20, "45" + DEG) + labelABCD(P, cen)
  return { condition_text: `В равнобедренной трапеции основания равны ${a} и ${b}, а один из углов между боковой стороной и основанием равен 45${DEG}. Найдите площадь этой трапеции.`, answer: String((a + b) * (b - a) / 4), image_url: q17(g) }
}
// 30. равноб. трапеция ∠D, диагональ AC угол x со стороной AB → угол с меньшим осн. BC = ∠D − x
function t17TrapDiagBaseAB() {
  const d = randInt(58, 84), x = randInt(18, d - 20)
  // шире верхнее основание (106 вместо 78): клин ∠BAC между стороной AB и диагональю
  // становится ~36° — иначе метка «39°» не помещается в узкий (~25°) клин
  const P = trapPts([120, 92], 180, 106, 84), cen = cen4(P)
  const g = cPoly(P) + cSeg(P[0], P[2]) + angArc(P[3], P[0], P[2], 18, d + DEG, 2) + angArc(P[0], P[1], P[2], 24, x + DEG, 1) + labelABCD(P, cen)
  return { condition_text: `В равнобедренной трапеции с основаниями AD и BC угол D равен ${d}${DEG}. Диагональ AC образует со стороной AB угол ${x}${DEG}. Сколько градусов составляет угол между этой диагональю и меньшим основанием BC?`, answer: String(d - x), image_url: q17(g) }
}

// ── №18. Фигуры на клетчатой бумаге ───────────────────────────────────────────
// Эталон — банк ФИПИ (клетчатые задачи из 7.2–7.5) и math100 (18-1…18-3). Данные —
// в чертеже: строим сетку с целочисленными координатами и считаем ответ по ним.
const GS18 = 24
// координаты клеток (c столбец, r строка сверху) → пиксели; сетка авто-размера по bbox
function grid18(pts, draw) {
  const cs = pts.map(p => p[0]), rs = pts.map(p => p[1])
  const minc = Math.min(...cs) - 1, minr = Math.min(...rs) - 1, cols = Math.max(...cs) + 1 - minc, rows = Math.max(...rs) + 1 - minr
  const W = cols * GS18 + 2, H = rows * GS18 + 2, m = (c, r) => [1 + (c - minc) * GS18, 1 + (r - minr) * GS18]
  let g = ""
  for (let i = 0; i <= cols; i++) g += `<line x1="${1 + i * GS18}" y1="1" x2="${1 + i * GS18}" y2="${1 + rows * GS18}" stroke="#cfcfcf" stroke-width="1"/>`
  for (let j = 0; j <= rows; j++) g += `<line x1="1" y1="${1 + j * GS18}" x2="${1 + cols * GS18}" y2="${1 + j * GS18}" stroke="#cfcfcf" stroke-width="1"/>`
  g += draw(m)
  return svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`)
}
const gPolyD = (m, pts) => `<polygon points="${pts.map(p => m(p[0], p[1]).join(",")).join(" ")}" fill="none" stroke="${G_S}" stroke-width="2" stroke-linejoin="round"/>`
const gLineD = (m, P, Q, dash) => { const a = m(P[0], P[1]), b = m(Q[0], Q[1]); return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${G_S}" stroke-width="2"${dash ? ' stroke-dasharray="5 3"' : ""}/>` }
const gDotD = (m, P) => { const a = m(P[0], P[1]); return `<circle cx="${a[0]}" cy="${a[1]}" r="3" fill="${G_S}"/>` }
const gLblD = (m, P, name, dc, dr) => { const a = m(P[0], P[1]); return `<text x="${a[0] + dc * 11}" y="${a[1] + dr * 11 + 4}" font-size="14" font-style="italic" text-anchor="middle" fill="${G_S}">${name}</text>` }
const shoelace = (P) => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1] }, 0)) / 2
// компактные тройки: max катет ≤ 12, чтобы фигуры на сетке не растягивались
// на десятки клеток (без [8,15,17],[12,16,20],[7,24,25] — они дают огромные чертежи)
const PYTH = [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13], [9, 12, 15], [12, 9, 15]]

// две точки → расстояние (пифагоров вектор → целое)
function t18Distance() {
  const [a, b, c] = pick(PYTH), sx = pick([1, -1]), sy = pick([1, -1])
  const A = [1, 6], B = [1 + a * sx, 6 + b * sy]
  return { condition_text: `На клетчатой бумаге с размером клетки 1×1 изображены две точки. Найдите расстояние между ними.`, answer: String(c), image_url: grid18([A, B], (m) => gDotD(m, A) + gDotD(m, B)) }
}
// фигура, длина отрезка AB (треугольник, AB — пифагорова сторона)
function t18Segment() {
  const [a, b, c] = pick(PYTH)
  const A = [1, 1 + b], B = [1 + a, 1], C = [1 + a, 1 + b]
  return { condition_text: `На клетчатой бумаге с размером клетки 1×1 изображена фигура. Найдите длину отрезка AB по данным чертежа.`, answer: String(c), image_url: grid18([A, B, C], (m) => gPolyD(m, [A, B, C]) + gLblD(m, A, "A", -1, 0) + gLblD(m, B, "B", 1, -1)) }
}
// прямоугольный треугольник: больший/меньший катет (оси) или гипотенуза (пифагор)
function t18RightTri() {
  const [a, b, c] = pick(PYTH.filter((t) => t[0] !== t[1]))
  const A = [1, 1 + b], C = [1, 1], B = [1 + a, 1]     // прямой угол в C, катеты a(гор), b(верт)
  const kind = pick(["большего катета", "меньшего катета", "гипотенузы"])
  const ans = kind === "гипотенузы" ? c : kind === "большего катета" ? Math.max(a, b) : Math.min(a, b)
  return { condition_text: `На клетчатой бумаге с размером клетки 1×1 изображён прямоугольный треугольник. Найдите длину его ${kind}.`, answer: String(ans), image_url: grid18([A, B, C], (m) => gPolyD(m, [A, B, C])) }
}
// треугольник, площадь (Гаусс/шнуровка)
function t18TriArea() {
  let A, B, C, area
  do {
    A = [1, randInt(1, 8)]; B = [randInt(3, 9), randInt(1, 8)]; C = [randInt(2, 9), randInt(1, 8)]
    area = shoelace([A, B, C])
  } while (area < 4 || area > 30 || (2 * area) % 1 !== 0)
  return { condition_text: `На клетчатой бумаге с размером клетки 1×1 изображён треугольник. Найдите его площадь.`, answer: decOut(area), image_url: grid18([A, B, C], (m) => gPolyD(m, [A, B, C])) }
}
// треугольник ABC, средняя линия ∥ стороне = половина стороны (сторона чётной длины по оси)
function t18TriMidline() {
  const base = 2 * randInt(2, 5), h = randInt(3, 6), apexShift = randInt(-2, 4)
  const A = [1, 1 + h], C = [1 + base, 1 + h], B = [1 + Math.floor(base / 2) + apexShift, 1]
  const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], N = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2]
  return { condition_text: `На клетчатой бумаге с размером клетки 1×1 изображён треугольник ABC. Найдите длину его средней линии, параллельной стороне AC.`, answer: String(base / 2), image_url: grid18([A, B, C], (m) => gPolyD(m, [A, B, C]) + gLineD(m, M, N) + gLblD(m, A, "A", -1, 1) + gLblD(m, B, "B", 0, -1) + gLblD(m, C, "C", 1, 1)) }
}
// параллелограмм, площадь (шнуровка)
function t18ParaArea() {
  const w = randInt(3, 7), h = randInt(2, 5), sk = randInt(1, 3)
  const A = [1, 1 + h], B = [1 + w, 1 + h], C = [1 + w + sk, 1], D = [1 + sk, 1]
  return { condition_text: `На клетчатой бумаге с размером клетки 1×1 изображён параллелограмм. Найдите его площадь.`, answer: decOut(shoelace([A, B, C, D])), image_url: grid18([A, B, C, D], (m) => gPolyD(m, [A, B, C, D])) }
}
// ромб (диагонали по осям 2p×2q): площадь = 2pq
function t18RhombArea() {
  const p = randInt(2, 5), q = randInt(2, 5)
  const cx = 1 + q, cy = 1 + p, P = [[cx, cy - p], [cx + q, cy], [cx, cy + p], [cx - q, cy]]
  return { condition_text: `На клетчатой бумаге с размером клетки 1×1 изображён ромб. Найдите площадь этого ромба.`, answer: decOut(shoelace(P)), image_url: grid18(P, (m) => gPolyD(m, P)) }
}
// ромб, большая диагональ = max(2p,2q)
function t18RhombDiag() {
  let p, q
  do { p = randInt(2, 6); q = randInt(2, 6) } while (p === q)
  const cx = 1 + q, cy = 1 + p, P = [[cx, cy - p], [cx + q, cy], [cx, cy + p], [cx - q, cy]]
  return { condition_text: `На клетчатой бумаге с размером клетки 1×1 изображён ромб. Найдите длину его большей диагонали.`, answer: String(2 * Math.max(p, q)), image_url: grid18(P, (m) => gPolyD(m, P)) }
}
// трапеция (основания a,b по горизонтали, высота h): площадь = (a+b)/2·h
function t18TrapArea() {
  const a = 2 * randInt(2, 5), b = a - 2 * randInt(1, Math.floor(a / 2 - 0.5) || 1), h = randInt(2, 5), off = randInt(0, 2)
  const A = [1, 1 + h], D = [1 + a, 1 + h], B = [1 + off, 1], C = [1 + off + b, 1]
  return { condition_text: `На клетчатой бумаге с размером клетки 1×1 изображена трапеция. Найдите её площадь.`, answer: decOut((a + b) * h / 2), image_url: grid18([A, B, C, D], (m) => gPolyD(m, [A, B, C, D])) }
}
// трапеция, средняя линия = (a+b)/2
function t18TrapMidline() {
  let a, b
  do { a = randInt(3, 9); b = randInt(2, 8) } while (a === b || (a + b) % 2 !== 0)
  const h = randInt(2, 5), off = randInt(0, 2)
  const A = [1, 1 + h], D = [1 + a, 1 + h], B = [1 + off, 1], C = [1 + off + b, 1]
  return { condition_text: `На клетчатой бумаге с размером клетки 1×1 изображена трапеция. Найдите длину её средней линии.`, answer: String((a + b) / 2), image_url: grid18([A, B, C, D], (m) => gPolyD(m, [A, B, C, D])) }
}
// два круга на решётке: во сколько раз площадь больше = (R/r)²
function t18TwoCircles() {
  const r = randInt(1, 3), k = pick([2, 3]), R = r * k
  return {
    condition_text: `На клетчатой бумаге изображены два круга. Во сколько раз площадь большего круга больше площади меньшего?`,
    answer: String(k * k),
    image_url: grid18([[0, 0], [2 * R + 2 * r + 4, 2 * R + 1]], (m) => {
      const c1 = m(R + 1, R + 1), c2 = m(2 * R + r + 3, R + 1)
      return `<circle cx="${c1[0]}" cy="${c1[1]}" r="${R * GS18}" fill="none" stroke="${G_S}" stroke-width="2"/><circle cx="${c2[0]}" cy="${c2[1]}" r="${r * GS18}" fill="none" stroke="${G_S}" stroke-width="2"/>`
    }),
  }
}
// два круга на решётке с «наклонным» радиусом: центр в узле, но окружность проходит через
// узел со смещением (a,b) ⇒ радиус = √(a²+b²) (по Пифагору, НЕ по клеткам). Ответ = отношение
// площадей = R²/r² = (a₁²+b₁²)/(a₂²+b₂²) (подобраны так, чтобы было целым).
function t18TwoCirclesTilt() {
  const c = pick([
    { R: [1, 3], r: [1, 2] },   // 10 / 5 = 2
    { R: [2, 4], r: [1, 3] },   // 20 / 10 = 2
    { R: [2, 2], r: [1, 1] },   //  8 / 2  = 4
    { R: [2, 4], r: [1, 2] },   // 20 / 5  = 4
    { R: [1, 3], r: [1, 1] },   // 10 / 2  = 5
    { R: [3, 3], r: [1, 1] },   // 18 / 2  = 9
  ])
  const R2 = c.R[0] ** 2 + c.R[1] ** 2, r2 = c.r[0] ** 2 + c.r[1] ** 2
  const Rc = Math.sqrt(R2), rc = Math.sqrt(r2), RcI = Math.ceil(Rc), rcI = Math.ceil(rc)
  const cy = RcI + 1, cL = [RcI + 1, cy], cR = [RcI + 1 + RcI + rcI + 3, cy]
  const draw = (m) => {
    const a = m(cL[0], cL[1]), b = m(cR[0], cR[1])
    return `<circle cx="${a[0]}" cy="${a[1]}" r="${(Rc * GS18).toFixed(1)}" fill="none" stroke="${G_S}" stroke-width="2"/>` +
      `<circle cx="${b[0]}" cy="${b[1]}" r="${(rc * GS18).toFixed(1)}" fill="none" stroke="${G_S}" stroke-width="2"/>`
  }
  return {
    condition_text: `На клетчатой бумаге изображены два круга. Во сколько раз площадь большего круга больше площади меньшего?`,
    answer: String(R2 / r2),
    image_url: grid18([[cL[0] - RcI, cy - RcI], [cR[0] + rcI, cy + RcI]], draw),
  }
}
// треугольник ABC, во сколько раз отрезок AM длиннее/короче BM (оси, целое отношение k)
function t18SegRatio() {
  // Эталон ФИПИ: M — узел решётки НА стороне AC; AC разбита на (k+1) равных шагов вектора d.
  // Сравниваем AM и CM (коллинеарны). AM короче ⇒ AM=1 шаг, CM=k шагов (ответ k); длиннее — наоборот.
  const k = pick([2, 3]), longer = Math.random() < 0.5
  const d = pick([[2, 1], [1, 1], [3, 1], [1, 2], [3, 2]])   // направление AC (вниз-вправо)
  const p = longer ? k : 1                                    // сколько шагов от A до M
  const A = [0, 0], M = [p * d[0], p * d[1]], C = [(k + 1) * d[0], (k + 1) * d[1]]
  const B = [Math.round((A[0] + C[0]) / 2), Math.round((A[1] + C[1]) / 2) - (3 + randInt(1, 2))]  // над серединой AC
  const draw = (m) => gPolyD(m, [A, B, C]) + gDotD(m, M) +
    gLblD(m, A, "A", -1, 0) + gLblD(m, B, "B", 0, -1) + gLblD(m, M, "M", -1, 1) + gLblD(m, C, "C", 1, 1)
  return { condition_text: `На клетчатой бумаге изображён треугольник ABC. Во сколько раз отрезок AM ${longer ? "длиннее" : "короче"} отрезка CM?`, answer: String(k), image_url: grid18([A, B, C, M], draw) }
}

// ── №20 ОГЭ, часть 2 (развёрнутый ответ) — генераторы-аналоги ФИПИ ───────────────
// Эталон: экспорт банка ФИПИ (200 задач №20). Каждый ответ вычисляется кодом и
// проверен независимым решателем (см. историю). Помощники sup/fT/rT/gcd/reduceFr —
// уже объявлены выше.
// ── помощники №20 ─────────────────────────────────────────────────────────────
const X2 = "x" + sup(2), X3 = "x" + sup(3), X4 = "x" + sup(4)
// полином из [[коэф, "перем"], …]: пропускает нули, коэф ±1 при переменной без числа
function polyExpr(terms) {
  let out = ""
  for (const [c, v] of terms) {
    if (c === 0) continue
    const a = Math.abs(c), num = (a === 1 && v) ? "" : String(a)
    out += out === "" ? (c < 0 ? "−" : "") + num + v : (c < 0 ? " − " : " + ") + num + v
  }
  return out === "" ? "0" : out
}
const par = (s) => `(${s})`
// (x − h) / (x + |h|)  (h≠0)
const shift = (h) => `x ${h < 0 ? "+" : "−"} ${Math.abs(h)}`
// список целых корней по возрастанию, без повторов
const rootsInt = (arr) => [...new Set(arr)].sort((a, b) => a - b).join("; ")
// дробь в ответе (в строку): «n/d» или целое; знак у числителя
function fracAns(n, d) { const [p, q] = reduceFr(n, d); return q === 1 ? String(p) : `${p}/${q}` }
const numOfFrac = (n, d) => { const [p, q] = reduceFr(n, d); return p / q }

// ── A. Алгебраические выражения ───────────────────────────────────────────────
function t20Expr() {
  const na = randInt(1, 5); let nbabs = randInt(1, 9); while (nbabs === na) nbabs = randInt(1, 9)
  const nb = -nbabs, c = randInt(2, 9), k = randInt(3, 9)
  const da = nbabs, db = -na
  const ta = k * da - na, tb = k * db - nb
  const ansVal = randInt(1, 20), Rc = ansVal + c * (k - 1)
  const N = polyExpr([[na, "a"], [nb, "b"], [c, ""]])
  const D = polyExpr([[da, "a"], [db, "b"], [c, ""]])
  const T = polyExpr([[ta, "a"], [tb, "b"], [Rc, ""]])
  return { condition_text: `Найдите значение выражения ${T}, если ${fT(N, D)} = ${k}.`, answer: String(ansVal) }
}

// ── B. Уравнения ──────────────────────────────────────────────────────────────
// B1: x³ + a x² = b x + c  (b=квадрат, c=a·b) → корни −a, ±√b
function t20CubicGroup() {
  const a = randInt(2, 7); let m = pick([1, 2, 3, 4, 5]); while (m === a) m = pick([1, 2, 3, 4, 5])
  const b = m * m, c = a * b
  const bx = `${b === 1 ? "" : b}x`
  const lhs = `${X3} + ${a}${X2}`
  const cond = Math.random() < 0.5
    ? `Решите уравнение ${lhs} = ${bx} + ${c}.`
    : `Решите уравнение ${lhs} − ${bx} − ${c} = 0.`
  return { condition_text: cond, answer: rootsInt([-a, -m, m]) }
}
// B2: x⁴ = (p x − q)²
function t20Quartic() {
  let rp, rn, p, q
  do { rp = randInt(1, 5); rn = randInt(-6, -1); p = -(rp + rn); q = -(rp * rn) }
  while (p < 1 || q < 1 || p * p >= 4 * q)
  const inner = `${p === 1 ? "" : p}x − ${q}`
  return { condition_text: `Решите уравнение ${X4} = (${inner})${sup(2)}.`, answer: rootsInt([rp, rn]) }
}
// B3: (x−h)⁴ + B(x−h)² + C = 0 → x = h ± √u0
function t20Biquad() {
  let h = randInt(-5, 5); while (h === 0) h = randInt(-5, 5)
  const u0 = pick([2, 3, 5, 7]); let w = randInt(1, 5); while (w === u0) w = randInt(1, 5)
  const B = w - u0, C = -u0 * w
  const base = par(shift(h))
  const mid = ` ${B < 0 ? "−" : "+"} ${Math.abs(B) === 1 ? "" : Math.abs(B)}${base}${sup(2)}`
  const cond = `Решите уравнение ${base}${sup(4)}${mid} − ${Math.abs(C)} = 0.`
  return { condition_text: cond, answer: `${h} − √${u0}; ${h} + √${u0}` }
}
// B4: (x−p)(x+q)² = r(x+q) → x=−q и два корня квадратного
function t20CubicFactor() {
  let p, q, s1, s2, r
  do {
    p = randInt(0, 3); q = randInt(1, 5); s1 = randInt(-6, 6); s2 = (p - q) - s1
    r = -(s1 * s2) - p * q
  } while (!(s1 !== s2 && r >= 1 && new Set([-q, s1, s2]).size === 3))
  const sq = polyExpr([[1, X2], [2 * q, "x"], [q * q, ""]])
  const left = p === 0 ? "x" : par(`x − ${p}`)
  const cond = `Решите уравнение ${left}(${sq}) = ${r === 1 ? "" : r}(x + ${q}).`
  return { condition_text: cond, answer: rootsInt([-q, s1, s2]) }
}
// B5: x² − a x + √(k−x) = √(k−x) + c  (x≤k) → корень r1
function t20Radical() {
  let r1, r2, a, c, k
  // k>0 всегда (под корнем положительное число, как в ФИПИ); r1<0<k<r2 ⇒ годен только r1
  do { r1 = randInt(-6, -1); r2 = randInt(2, 8); a = r1 + r2; c = -r1 * r2; k = randInt(1, r2 - 1) }
  while (!(a > 0 && c > 0 && k < r2))
  const rt = rT(`${k} − x`)
  const cond = `Решите уравнение ${X2} − ${a === 1 ? "" : a}x + ${rt} = ${rt} + ${c}.`
  return { condition_text: cond, answer: String(r1) }
}
// B6: (x²−A)² + (x²+b x − c)² = 0 → общий корень x0
function t20SumSquares() {
  let x0, s
  do { x0 = randInt(-7, 7); s = randInt(-7, 7) } while (!(x0 !== 0 && s !== 0 && x0 !== s && s !== -x0 && x0 * s < 0))
  const A = x0 * x0, b = -(x0 + s), c = -(x0 * s)
  const q2 = polyExpr([[1, X2], [b, "x"], [-c, ""]])
  const cond = `Решите уравнение (${X2} − ${A})${sup(2)} + (${q2})${sup(2)} = 0.`
  return { condition_text: cond, answer: String(x0) }
}
// B7: 1/x² + P/x − q = 0 → x = 1/u1, 1/u2
function t20RecipX() {
  let u1, u2, P
  do { u1 = randInt(-9, 9); u2 = randInt(-9, 9); P = -(u1 + u2) }
  while (!(u1 !== 0 && u2 !== 0 && u1 !== u2 && u1 * u2 < 0 && P !== 0))
  const q = -(u1 * u2)
  const t1 = fT("1", X2)
  const tP = ` ${P < 0 ? "−" : "+"} ${fT(String(Math.abs(P)), "x")}`
  const cond = `Решите уравнение ${t1}${tP} − ${q} = 0.`
  const a1 = fracAns(1, u1), a2 = fracAns(1, u2)
  const ans = numOfFrac(1, u1) < numOfFrac(1, u2) ? `${a1}; ${a2}` : `${a2}; ${a1}`
  return { condition_text: cond, answer: ans }
}
// B8: 1/(x−K)² + P/(x−K) − q = 0 → x = K + 1/u
function t20RecipShift() {
  const K = randInt(1, 4)
  let u1, u2, P
  do { u1 = randInt(-9, 9); u2 = randInt(-9, 9); P = -(u1 + u2) }
  while (!(u1 !== 0 && u2 !== 0 && u1 !== u2 && u1 * u2 < 0 && P !== 0))
  const q = -(u1 * u2)
  const den1 = par(`x − ${K}`) + sup(2), den2 = par(`x − ${K}`)
  const cond = `Решите уравнение ${fT("1", den1)} ${P < 0 ? "−" : "+"} ${fT(String(Math.abs(P)), den2)} − ${q} = 0.`
  const a1 = fracAns(K * u1 + 1, u1), a2 = fracAns(K * u2 + 1, u2)
  const ans = numOfFrac(K * u1 + 1, u1) < numOfFrac(K * u2 + 1, u2) ? `${a1}; ${a2}` : `${a2}; ${a1}`
  return { condition_text: cond, answer: ans }
}

// ── C. Системы уравнений ──────────────────────────────────────────────────────
// C1: { a x² + y = c ; b x² − y = d } → (±x0, y0)
function t20SysAdd() {
  const a = randInt(1, 7), b = randInt(1, 7), x0 = randInt(1, 4), y0 = randInt(-9, 9)
  const c = a * x0 * x0 + y0, d = b * x0 * x0 - y0
  const e1 = `${a === 1 ? "" : a}${X2} + y = ${c}`
  const e2 = `${b === 1 ? "" : b}${X2} − y = ${d}`
  const ans = `(${-x0}; ${y0}), (${x0}; ${y0})`
  return { condition_text: `Решите систему уравнений ⟦cases:${e1}⁞${e2}⟧`, answer: ans }
}
// C2: { a x² + b y² = c ; m·a x² + m·b y² = c·x } → (m, ±y0)
function t20SysProp() {
  const m = randInt(2, 4), a = randInt(1, 5), b = randInt(1, 4), y0 = randInt(1, 5)
  const c = a * m * m + b * y0 * y0
  const e1 = `${a === 1 ? "" : a}${X2} + ${b === 1 ? "" : b}y${sup(2)} = ${c}`
  const e2 = `${m * a}${X2} + ${m * b}y${sup(2)} = ${c}x`
  const ans = `(${m}; ${-y0}), (${m}; ${y0})`
  return { condition_text: `Решите систему уравнений ⟦cases:${e1}⁞${e2}⟧`, answer: ans }
}
// C3: { a x² + B x = y ; (t·a) x + (t·B) = y } → (t, y1) и (−B/a, 0)
function t20SysParabLine() {
  // t ≠ −B/a — иначе оба решения (t;·) и (−B/a;0) совпадают и ответ дублируется
  let a, B, t
  do { a = randInt(2, 9); B = randInt(-15, -1); t = randInt(1, 2) } while (-B / a === t)
  const e1 = `${a === 1 ? "" : a}${X2} ${B < 0 ? "−" : "+"} ${Math.abs(B) === 1 ? "" : Math.abs(B)}x = y`
  const slope = t * a, inter = t * B
  const e2 = `${slope}x ${inter < 0 ? "−" : "+"} ${Math.abs(inter)} = y`
  const x1 = t, y1 = t * (a * t + B)
  const x2 = fracAns(-B, a), x2v = numOfFrac(-B, a)
  const s1 = `(${x1}; ${y1})`, s2 = `(${x2}; 0)`
  const ans = x1 < x2v ? `${s1}, ${s2}` : `${s2}, ${s1}`
  return { condition_text: `Решите систему уравнений ⟦cases:${e1}⁞${e2}⟧`, answer: ans }
}

// ── D. Неравенства ────────────────────────────────────────────────────────────
// D1: (r − x)(x² −(r+s)x + rs) ≥ 0 → (−∞; s] ∪ {r}
function t20IneqLinQuad() {
  const r = randInt(1, 9), s = randInt(-9, r - 1)
  const quad = polyExpr([[1, X2], [-(r + s), "x"], [r * s, ""]])
  return { condition_text: `Решите неравенство (${r} − x)(${quad}) ≥ 0.`, answer: `x ∈ (−∞; ${s}] ∪ {${r}}` }
}
// D2: (x²+…)(x²+…) op 0 — 4 различных целых корня
function t20IneqQuadQuad() {
  const pool = []; while (pool.length < 4) { const v = randInt(-8, 8); if (!pool.includes(v)) pool.push(v) }
  const [w, x, y, z] = pool.slice().sort((p, q) => p - q)
  const q1 = polyExpr([[1, X2], [-(w + z), "x"], [w * z, ""]])
  const q2 = polyExpr([[1, X2], [-(x + y), "x"], [x * y, ""]])
  const op = pick(["≤", "≥"])
  const ans = op === "≤"
    ? `x ∈ [${w}; ${x}] ∪ [${y}; ${z}]`
    : `x ∈ (−∞; ${w}] ∪ [${x}; ${y}] ∪ [${z}; +∞)`
  return { condition_text: `Решите неравенство (${q1})(${q2}) ${op} 0.`, answer: ans }
}
// D3: дробь ≤ 0 — квадрат числителя ИЛИ сокращение полюса
function t20IneqRational() {
  const K = randInt(-8, 6)
  if (Math.random() < 0.5) {                    // a(x−d)² / (x−K) ≤ 0, d>K
    const d = randInt(K + 1, 8), a = randInt(1, 3)
    const num = polyExpr([[a, X2], [-2 * a * d, "x"], [a * d * d, ""]])
    const cond = `Решите неравенство ${fT(num, par(shift(K)))} ≤ 0.`
    return { condition_text: cond, answer: `x ∈ (−∞; ${K}) ∪ {${d}}` }
  } else {                                       // (x−K)(x−m) / (x−K) ≤ 0, m>K
    const m = randInt(K + 1, 8)
    const num = polyExpr([[1, X2], [-(K + m), "x"], [K * m, ""]])
    const cond = `Решите неравенство ${fT(num, par(shift(K)))} ≤ 0.`
    return { condition_text: cond, answer: `x ∈ (−∞; ${K}) ∪ (${K}; ${m}]` }
  }
}
// D4: x²/(x−K) ≤ x → [0; K)
function t20IneqRatX() {
  const K = randInt(2, 9)
  return { condition_text: `Решите неравенство ${fT(X2, par(shift(K)))} ≤ x.`, answer: `x ∈ [0; ${K})` }
}
// D5: x ≤ N/x, N=m² → (−∞; −m] ∪ (0; m]
function t20IneqNoverX() {
  const m = randInt(2, 9), N = m * m
  return { condition_text: `Решите неравенство x ≤ ${fT(String(N), "x")}.`, answer: `x ∈ (−∞; ${-m}] ∪ (0; ${m}]` }
}
// D6: 1/x ≥ 1/(x−K) → (0; K)
function t20IneqRecipCmp() {
  const K = randInt(2, 9)
  return { condition_text: `Решите неравенство ${fT("1", "x")} ≥ ${fT("1", par(shift(K)))}.`, answer: `x ∈ (0; ${K})` }
}
// D7: (−N)/((x−h)²−k) ≥ 0 → (h−√k; h+√k)
function t20IneqNegFrac() {
  let h = randInt(-5, 5); while (h === 0) h = randInt(-5, 5)
  const N = randInt(10, 19), k = pick([2, 3, 5, 6, 7, 10])
  const den = `${par(shift(h))}${sup(2)} − ${k}`
  const cond = `Решите неравенство ${fT("−" + N, den)} ≥ 0.`
  return { condition_text: cond, answer: `x ∈ (${h} − √${k}; ${h} + √${k})` }
}
// D8: (x−h)² < √k (x−h) → (h; h+√k)
function t20IneqSqRadical() {
  const h = randInt(1, 11), k = pick([2, 3, 5, 6, 7, 10, 11])
  const base = par(`x − ${h}`)
  return { condition_text: `Решите неравенство ${base}${sup(2)} < ${rT(String(k))}${base}.`, answer: `x ∈ (${h}; ${h} + √${k})` }
}

// ── №21 ОГЭ, часть 2 (текстовые задачи, КЭС 3.3) ───────────────────────────────
// Эталон: 190 задач банка ФИПИ (Развёрнутый ∩ 3.3), 16 типажей. Параметры выбираются
// «от ответа» ⇒ ответ всегда аккуратный; проверено независимым решателем.
// randInt/pick/plural — уже объявлены выше.
const hours = (n) => plural(n, "час", "часа", "часов")
const mins = (n) => plural(n, "минуту", "минуты", "минут")
// число в ответе: целое как есть, иначе десятичная дробь через запятую
const numRu = (x) => Number.isInteger(x) ? String(x) : String(Math.round(x * 1000) / 1000).replace(".", ",")
// «красивый» ответ ФИПИ: целое или ровно один знак после запятой (как 94,5 / 61,5)
const oneDec = (x) => Math.abs(x * 10 - Math.round(x * 10)) < 1e-9

// повтор до успеха (limit — страховка от бесконечного цикла)
function until(fn) { for (let i = 0; i < 20000; i++) { const r = fn(); if (r) return r } return null }

// ---------- T1 Пробег ----------
function t21Race() {
  const g = until(() => {
    const bike = Math.random() < 0.5
    const v1 = bike ? randInt(10, 24) : pick([40, 45, 50, 55, 60, 65, 70, 75, 80])
    const dv = bike ? pick([1, 2, 3, 4, 5]) : pick([10, 15, 20, 25, 30])
    const T = bike ? pick([1, 2, 3]) : pick([1, 2, 3, 4])
    const v2 = v1 + dv, L = T * v1 * v2 / dv
    if (!Number.isInteger(L) || L < 80 || L > 700) return null
    return { bike, v1, v2, dv, T, L }
  })
  const { bike, v1, v2, dv, T, L } = g
  const veh = bike ? "велосипедиста" : "автомобиля"
  const fast = Math.random() < 0.5
  const cond = `Два ${bike ? "велосипедиста" : "автомобиля"} одновременно отправляются в ${L}-километровый пробег. Первый едет со скоростью на ${dv} км/ч большей, чем второй, и прибывает к финишу на ${T} ${hours(T)} раньше второго. Найдите скорость ${veh}, ${fast ? "прибывшего первым" : "пришедшего к финишу вторым"}.`
  return { condition_text: cond, answer: String(fast ? v2 : v1) }
}

// ---------- T2 Поезд ----------
function t21Train() {
  const g = until(() => {
    const vp = randInt(60, 160), vped = randInt(2, 6), t = randInt(8, 30), same = Math.random() < 0.5
    const rel = same ? vp - vped : vp + vped
    const len = rel * t * 5 / 18
    if (!Number.isInteger(len) || len < 100 || len > 900) return null
    return { vp, vped, t, same, len }
  })
  const { vp, vped, t, same, len } = g
  const dir = same
    ? `идущего в том же направлении параллельно путям по платформе со скоростью ${vped} км/ч`
    : `идущего по платформе параллельно путям со скоростью ${vped} км/ч навстречу поезду`
  const cond = `Поезд, двигаясь равномерно со скоростью ${vp} км/ч, проезжает мимо пешехода, ${dir}, за ${t} ${plural(t, "секунду", "секунды", "секунд")}. Найдите длину поезда в метрах.`
  return { condition_text: cond, answer: String(len) }
}

// ---------- T3 A→B с остановкой ----------
function t21ThereBackStop() {
  const g = until(() => {
    const v = randInt(9, 24), dv = pick([2, 3, 4, 5, 6, 8]), H = randInt(2, 10)
    const L = v * (v + dv) * H / dv
    if (!Number.isInteger(L) || L < 60 || L > 400) return null
    return { v, dv, H, L }
  })
  const { v, dv, H, L } = g
  const cond = `Велосипедист выехал с постоянной скоростью из города A в город B, расстояние между которыми равно ${L} км. На следующий день он отправился обратно в A, увеличив скорость на ${dv} км/ч. По пути он сделал остановку на ${H} ${hours(H)}, в результате чего затратил на обратный путь столько же времени, сколько на путь из A в B. Найдите скорость велосипедиста на пути из B в A.`
  return { condition_text: cond, answer: String(v + dv) }
}

// ---------- T4 A→B, второй по половинам ----------
function t21HalfSecond() {
  const g = until(() => {
    const V1 = randInt(40, 100), dv = pick([3, 4, 5, 6, 7, 8, 10])
    const num = V1 * (V1 + dv), den = V1 + 2 * dv
    if (num % den !== 0) return null
    const V2 = num / den
    if (V2 < 30 || V2 > 120 || V2 === V1) return null
    return { V1, V2, dv }
  })
  const { V1, V2, dv } = g
  const cond = `Из A в B одновременно выехали два автомобиля. Первый проехал весь путь с постоянной скоростью. Второй проехал первую половину пути со скоростью ${V2} км/ч, а вторую половину пути проехал со скоростью больше скорости первого на ${dv} км/ч, в результате чего прибыл в B одновременно с первым автомобилем. Найдите скорость первого автомобиля.`
  return { condition_text: cond, answer: String(V1) }
}

// ---------- T5 Средняя (две половины) ----------
function t21AvgHalf() {
  const g = until(() => {
    const V1 = randInt(40, 120), V2 = randInt(40, 120)
    if (V1 === V2) return null
    const avg = 2 * V1 * V2 / (V1 + V2)
    if (!oneDec(avg)) return null
    return { V1, V2, avg }
  })
  const { V1, V2, avg } = g
  const cond = `Первую половину пути автомобиль проехал со скоростью ${V1} км/ч, а вторую — со скоростью ${V2} км/ч. Найдите среднюю скорость автомобиля на протяжении всего пути.`
  return { condition_text: cond, answer: numRu(avg) }
}

// ---------- T6 Средняя (три участка) ----------
function t21AvgThree() {
  const SP = [35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110]
  const { V, d, avg } = until(() => {
    const V = [pick(SP), pick(SP), pick(SP)]
    const h = [randInt(1, 6), randInt(1, 6), randInt(1, 6)]
    const d = [V[0] * h[0], V[1] * h[1], V[2] * h[2]]
    const avg = (d[0] + d[1] + d[2]) / (h[0] + h[1] + h[2])
    return oneDec(avg) ? { V, d, avg } : null
  })
  const cond = `Первые ${d[0]} км автомобиль ехал со скоростью ${V[0]} км/ч, следующие ${d[1]} км — со скоростью ${V[1]} км/ч, а последние ${d[2]} км — со скоростью ${V[2]} км/ч. Найдите среднюю скорость автомобиля на протяжении всего пути.`
  return { condition_text: cond, answer: numRu(avg) }
}

// ---------- T7 Навстречу с остановкой ----------
function t21TowardStop() {
  const g = until(() => {
    const V1 = randInt(5, 20), V2 = randInt(15, 40), stop = pick([12, 15, 18, 20, 24, 28, 30, 36, 40]), L = randInt(100, 400)
    const th = stop / 60, Tm = (L + V1 * th) / (V1 + V2)
    const d2 = V2 * Tm, d1 = V1 * (Tm - th)
    if (Tm <= th || Math.abs(d2 - Math.round(d2)) > 1e-9 || Math.abs(d1 - Math.round(d1)) > 1e-9) return null
    return { V1, V2, stop, L, d2: Math.round(d2) }
  })
  const { V1, V2, stop, L, d2 } = g
  const cond = `Из двух городов одновременно навстречу друг другу отправились два велосипедиста. Проехав некоторую часть пути, первый велосипедист сделал остановку на ${stop} ${mins(stop)}, а затем продолжил движение до встречи со вторым велосипедистом. Расстояние между городами составляет ${L} км, скорость первого велосипедиста равна ${V1} км/ч, скорость второго — ${V2} км/ч. Определите расстояние (в километрах) от города, из которого выехал второй велосипедист, до места встречи велосипедистов.`
  return { condition_text: cond, answer: String(d2) }
}

// ---------- B1 Теплоход (найти течение) ----------
function t21ShipCurrent() {
  const g = until(() => {
    const vb = randInt(10, 25), c = randInt(2, 8)
    if (c >= vb) return null
    const tm = randInt(6, 30), L = tm * (vb * vb - c * c) / (2 * vb)
    if (!Number.isInteger(L) || L < 40 || L > 400) return null
    const H = randInt(2, 14)
    return { L, vb, H, T: tm + H, c }
  })
  const { L, vb, H, T, c } = g
  const cond = `Теплоход проходит по течению реки до пункта назначения ${L} км и после стоянки возвращается в пункт отправления. Найдите скорость течения, если скорость теплохода в неподвижной воде равна ${vb} км/ч, стоянка длится ${H} ${hours(H)}, а в пункт отправления теплоход возвращается через ${T} ${hours(T)} после отплытия из него.`
  return { condition_text: cond, answer: String(c) }
}

// ---------- B2 Лодка против течения ----------
function t21BoatUpstream() {
  const g = until(() => {
    const vb = randInt(10, 25), c = randInt(2, 7), T = randInt(1, 8)
    if (c >= vb) return null
    const L = T * (vb * vb - c * c) / (2 * c)
    if (!Number.isInteger(L) || L < 40 || L > 400) return null
    return { L, T, c, vb }
  })
  const { L, T, c, vb } = g
  const cond = `Моторная лодка прошла против течения реки ${L} км и вернулась в пункт отправления, затратив на обратный путь на ${T} ${hours(T)} меньше, чем на путь против течения. Найдите скорость лодки в неподвижной воде, если скорость течения реки равна ${c} км/ч.`
  return { condition_text: cond, answer: String(vb) }
}

// ---------- B3 Плот + лодка ----------
function t21RaftBoat() {
  const g = until(() => {
    const vb = randInt(12, 28), c = randInt(3, 7), L = randInt(40, 120)
    if (c >= vb) return null
    const tb = 2 * L * vb / (vb * vb - c * c), d = c * (tb + 1)
    if (Math.abs(d - Math.round(d)) > 1e-9) return null
    const dd = Math.round(d)
    if (dd <= 0 || dd >= L) return null
    return { L, d: dd, c, vb }
  })
  const { L, d, c, vb } = g
  const cond = `Расстояние между пристанями A и B равно ${L} км. Из A в B по течению реки отправился плот, а через час вслед за ним отправилась моторная лодка, которая, прибыв в пункт B, тотчас повернула обратно и возвратилась в A. К этому времени плот проплыл ${d} км. Найдите скорость лодки в неподвижной воде, если скорость течения реки равна ${c} км/ч.`
  return { condition_text: cond, answer: String(vb) }
}

// ---------- B4 Баржа ----------
function t21Barge() {
  const g = until(() => {
    const vb = randInt(10, 25), c = randInt(3, 7), T = randInt(3, 8), L1 = randInt(15, 60)
    if (c >= vb) return null
    const L2 = (T - L1 / (vb + c)) * (vb - c)
    if (Math.abs(L2 - Math.round(L2)) > 1e-9) return null
    const l2 = Math.round(L2)
    if (l2 < 10 || l2 > 80) return null
    return { L1, L2: l2, T, c, vb }
  })
  const { L1, L2, T, c, vb } = g
  const cond = `Баржа прошла по течению реки ${L1} км и, повернув обратно, прошла ещё ${L2} км, затратив на весь путь ${T} ${hours(T)}. Найдите собственную скорость баржи, если скорость течения реки равна ${c} км/ч.`
  return { condition_text: cond, answer: String(vb) }
}

// ---------- W1 Детали ----------
function t21WorkParts() {
  const g = until(() => {
    const r2 = randInt(5, 25), dv = pick([2, 3, 4, 5, 6, 8, 9]), T = pick([1, 2, 3, 4])
    const N = T * r2 * (r2 + dv) / dv
    if (!Number.isInteger(N) || N < 60 || N > 600) return null
    return { N, dv, T, r2, r1: r2 + dv }
  })
  const { N, dv, T, r2, r1 } = g
  const first = Math.random() < 0.5
  const cond = `Первый рабочий за час делает на ${dv} ${plural(dv, "деталь", "детали", "деталей")} больше, чем второй, и выполняет заказ, состоящий из ${N} деталей, на ${T} ${hours(T)} быстрее, чем второй рабочий, выполняющий такой же заказ. Сколько деталей в час делает ${first ? "первый" : "второй"} рабочий?`
  return { condition_text: cond, answer: String(first ? r1 : r2) }
}

// ---------- W2 Трубы ----------
function t21WorkPipes() {
  const g = until(() => {
    const r2 = randInt(8, 30), dv = pick([3, 4, 5, 6, 9, 12, 15, 16]), T = pick([2, 3, 4, 5, 6])
    if (dv >= r2) return null
    const V = T * r2 * (r2 - dv) / dv
    if (!Number.isInteger(V) || V < 40 || V > 400) return null
    return { V, dv, T, r2, r1: r2 - dv }
  })
  const { V, dv, T, r2, r1 } = g
  const first = Math.random() < 0.5
  const cond = first
    ? `Первая труба пропускает на ${dv} ${plural(dv, "литр", "литра", "литров")} воды в минуту меньше, чем вторая труба. Сколько литров воды в минуту пропускает первая труба, если резервуар объёмом ${V} литров вторая труба заполняет на ${T} ${mins(T)} быстрее, чем первая?`
    : `Первая труба пропускает на ${dv} ${plural(dv, "литр", "литра", "литров")} воды в минуту меньше, чем вторая труба. Сколько литров воды в минуту пропускает вторая труба, если резервуар объёмом ${V} литров она заполняет на ${T} ${mins(T)} быстрее, чем первая труба?`
  return { condition_text: cond, answer: String(first ? r1 : r2) }
}

// ---------- P1 Фрукты ----------
function t21DriedFruit() {
  const g = until(() => {
    const a = randInt(70, 90), b = randInt(12, 30)
    if (b >= a) return null
    const K = randInt(20, 400), fresh = Math.random() < 0.5
    if (fresh) {
      const val = K * (100 - b) / (100 - a)
      if (!Number.isInteger(val) || val < 30 || val > 900) return null
      return { a, b, K, fresh, val }
    } else {
      const val = K * (100 - a) / (100 - b)
      if (!Number.isInteger(val) || val < 5 || val > 300) return null
      return { a, b, K, fresh, val }
    }
  })
  const { a, b, K, fresh, val } = g
  const cond = fresh
    ? `Свежие фрукты содержат ${a} % воды, а высушенные — ${b} %. Сколько требуется свежих фруктов для приготовления ${K} кг высушенных фруктов?`
    : `Свежие фрукты содержат ${a} % воды, а высушенные — ${b} %. Сколько сухих фруктов получится из ${K} кг свежих фруктов?`
  return { condition_text: cond, answer: String(val) }
}

// ---------- M1 Два сосуда ----------
function t21TwoVessels() {
  const g = until(() => {
    const x1 = randInt(30, 90), x2 = randInt(10, 80)
    if (x1 === x2 || (x1 + x2) % 2) return null
    const m1 = randInt(4, 40), m2 = randInt(4, 40)
    if (m1 === m2) return null
    const C1 = (m1 * x1 + m2 * x2) / (m1 + m2), C2 = (x1 + x2) / 2, acid1 = m1 * x1 / 100
    if (!oneDec(C1) || !oneDec(acid1)) return null
    return { x1, x2, m1, m2, C1: Math.round(C1 * 10) / 10, C2, acid1 }
  })
  const { m1, m2, C1, C2, acid1 } = g
  const cond = `Имеются два сосуда, содержащие ${m1} кг и ${m2} кг раствора кислоты различной концентрации. Если их слить вместе, то получится раствор, содержащий ${numRu(C1)} % кислоты. Если же слить равные массы этих растворов, то полученный раствор будет содержать ${numRu(C2)} % кислоты. Сколько килограммов кислоты содержится в первом растворе?`
  return { condition_text: cond, answer: numRu(acid1) }
}

// ---------- C1 Бегуны на круговой ----------
function t21RunnersCircle() {
  const g = until(() => {
    const u = randInt(6, 18), d = randInt(2, 8), S = u + d, dv = randInt(5, 14), w = u + dv
    const tago = 1 - S / w, m = tago * 60
    if (Math.abs(m - Math.round(m)) > 1e-9) return null
    const mm = Math.round(m)
    if (![5, 10, 12, 15, 20, 24, 30, 40].includes(mm) || tago <= 0 || tago >= 1) return null
    return { u, d, dv, mm }
  })
  const { u, d, dv, mm } = g
  const cond = `Два бегуна одновременно стартовали в одном направлении из одного и того же места круговой трассы в беге на несколько кругов. Спустя один час, когда одному из них оставалось ${d} км до окончания первого круга, ему сообщили, что второй бегун пробежал первый круг ${mm} ${mins(mm)} назад. Найдите скорость первого бегуна, если известно, что она на ${dv} км/ч меньше скорости второго.`
  return { condition_text: cond, answer: String(u) }
}

// ── Реестр ───────────────────────────────────────────────────────────────────

// ==========================================================================
// №22 ОГЭ, часть 2 — построение и исследование графиков функций (КЭС 5.1).
// Считаем число общих точек графика y=f(x) с прямой y=m (или y=kx) кодом.
// Модель графика — набор «ветвей» (line|parab|hyper|hyper2) с областью и
// открытыми/закрытыми концами + «дырки» (выколотые точки). Ответ — множество m
// (или k), где число пересечений удовлетворяет условию. Всё сверено брутфорсом.
// ==========================================================================
const G22E = 1e-6
const g22eq = (a, b, e = G22E) => Math.abs(a - b) < e
// line:{k,b} parab:{a,b,c} hyper:{m0} (m0/x) hyper2:{A,B} (A/x+B)
function g22Eval(br, x) {
  if (br.t === "line") return br.k * x + br.b
  if (br.t === "parab") return br.a * x * x + br.b * x + br.c
  if (br.t === "hyper") return br.m0 / x
  return br.A / x + br.B
}
function g22In(br, x) {
  if (x < br.xlo - 1e-9 || x > br.xhi + 1e-9) return false
  if (g22eq(x, br.xlo) && br.lo) return false   // lo=true → открыт слева
  if (g22eq(x, br.xhi) && br.hi) return false
  return true
}
function g22Solve(br, m) {
  const xs = []
  if (br.t === "line") { if (!g22eq(br.k, 0)) xs.push((m - br.b) / br.k) }
  else if (br.t === "parab") {
    const c = br.c - m, D = br.b * br.b - 4 * br.a * c
    if (g22eq(D, 0)) xs.push(-br.b / (2 * br.a))
    else if (D > 0) { const s = Math.sqrt(D); xs.push((-br.b + s) / (2 * br.a), (-br.b - s) / (2 * br.a)) }
  } else if (br.t === "hyper") { if (!g22eq(m, 0)) xs.push(br.m0 / m) }
  else { if (!g22eq(m, br.B)) xs.push(br.A / (m - br.B)) }
  return xs.filter((x) => g22In(br, x))
}
function g22Count(model, m) {
  let xs = []
  for (const br of model.branches) for (const x of g22Solve(br, m)) xs.push(x)
  xs = xs.filter((x) => !(model.holes || []).some((h) => g22eq(x, h.x, 1e-5)))
  xs.sort((a, b) => a - b)
  let n = 0
  for (let i = 0; i < xs.length; i++) if (i === 0 || !g22eq(xs[i], xs[i - 1], 1e-5)) n++
  return n
}
function g22Levels(model) {
  const S = new Set()
  const add = (v) => { if (isFinite(v)) S.add(Math.round(v * 1e6) / 1e6) }
  for (const br of model.branches) {
    if (isFinite(br.xlo)) add(g22Eval(br, br.xlo))
    if (isFinite(br.xhi)) add(g22Eval(br, br.xhi))
    if (br.t === "parab") { const xv = -br.b / (2 * br.a); if (xv > br.xlo - 1e-9 && xv < br.xhi + 1e-9) add(g22Eval(br, xv)) }
    if (br.t === "hyper") add(0)
    if (br.t === "hyper2") add(br.B)
  }
  for (const h of model.holes || []) add(h.y)
  return [...S].sort((a, b) => a - b)
}
function g22Pieces(model) {
  const L = g22Levels(model), BIG = 1000, out = []
  out.push({ kind: "iv", lo: -Infinity, hi: L[0], count: g22Count(model, L[0] - BIG) })
  for (let i = 0; i < L.length; i++) {
    out.push({ kind: "pt", at: L[i], count: g22Count(model, L[i]) })
    const hi = i < L.length - 1 ? L[i + 1] : Infinity
    const mid = i < L.length - 1 ? (L[i] + L[i + 1]) / 2 : L[i] + BIG
    out.push({ kind: "iv", lo: L[i], hi, count: g22Count(model, mid) })
  }
  return out
}
function g22Answer(model, pred, vn = "m") {
  const ranges = []
  let cur = null
  const flush = () => { if (cur) { ranges.push(cur); cur = null } }
  for (const p of g22Pieces(model)) {
    if (pred(p.count)) {
      if (p.kind === "pt") {
        if (!cur) cur = { lo: p.at, loC: true, hi: p.at, hiC: true, loI: false, hiI: false }
        else { cur.hi = p.at; cur.hiC = true; cur.hiI = false }
      } else {
        if (!cur) cur = { lo: p.lo, loC: false, loI: p.lo === -Infinity, hi: p.hi, hiC: false, hiI: p.hi === Infinity }
        else { cur.hi = p.hi; cur.hiC = false; cur.hiI = p.hi === Infinity }
      }
    } else flush()
  }
  flush()
  return ranges.map((r) => g22Range(r, vn)).join("; ")
}
function g22Max(model) { return Math.max(...g22Pieces(model).map((p) => p.count)) }

// ── форматирование чисел и ответа ────────────────────────────────────────
function g22Num(v) {
  let s = String(Math.round(v * 1e6) / 1e6)
  if (s.includes(".")) s = s.replace(".", ",")
  return s.replace("-", "−")
}
function g22Range(r, v) {
  if (r.loI && r.hiI) return "любое " + v
  if (r.lo === r.hi && !r.loI && !r.hiI) return `${v} = ${g22Num(r.lo)}`
  if (r.loI) return `${v} ${r.hiC ? "⩽" : "<"} ${g22Num(r.hi)}`
  if (r.hiI) return `${v} ${r.loC ? "⩾" : ">"} ${g22Num(r.lo)}`
  return `${g22Num(r.lo)} ${r.loC ? "⩽" : "<"} ${v} ${r.hiC ? "⩽" : "<"} ${g22Num(r.hi)}`
}
// многочлен из членов [{c, v}] → "x² − 6x + 10"
function g22Poly(terms) {
  let out = ""
  for (const t of terms) {
    if (Math.abs(t.c) < 1e-9) continue
    const av = Math.abs(t.c), coef = t.v && g22eq(av, 1) ? "" : g22Num(av), piece = coef + t.v
    if (out === "") out += (t.c < 0 ? "−" : "") + piece
    else out += (t.c < 0 ? " − " : " + ") + piece
  }
  return out === "" ? "0" : out
}
const g22Quad = (a, b, c) => g22Poly([{ c: a, v: "x²" }, { c: b, v: "x" }, { c: c, v: "" }])
const g22Lin = (k, b) => g22Poly([{ c: k, v: "x" }, { c: b, v: "" }])
const g22Tail = (d) => d > 0 ? ` + ${g22Num(d)}` : d < 0 ? ` − ${g22Num(-d)}` : ""   // свободный член со знаком
function g22Gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b] } return a || 1 }
// дробь p/q → «49/25», целое, или конечная десятичная («1,96»); отрицат. знак — U+2212
function g22Frac(p, q) {
  if (q < 0) { p = -p; q = -q }
  const g = g22Gcd(p, q); p /= g; q /= g
  if (q === 1) return g22Num(p)
  let t = q; while (t % 2 === 0) t /= 2; while (t % 5 === 0) t /= 5
  if (t === 1) return g22Num(p / q)                       // десятичная конечна
  return `${g22Num(p)}/${q}`
}

// ── рендер координатной плоскости с графиком ─────────────────────────────
function g22Plot(model) {
  const feats = []
  for (const br of model.branches) {
    if (isFinite(br.xlo)) feats.push(br.xlo)
    if (isFinite(br.xhi)) feats.push(br.xhi)
    if (br.t === "parab") { const xv = -br.b / (2 * br.a); if (xv > br.xlo && xv < br.xhi) feats.push(xv) }
  }
  for (const h of model.holes || []) feats.push(h.x)
  const yl = g22Levels(model)
  const HX = Math.max(4, Math.min(11, Math.ceil(Math.max(...feats.map((v) => Math.abs(v)).filter(isFinite), 3)) + 2))
  const HY = Math.max(4, Math.min(11, Math.ceil(Math.max(...yl.map((v) => Math.abs(v)).filter(isFinite), 3)) + 1))
  const U = Math.max(12, Math.min(24, Math.floor(230 / Math.max(HX, HY))))
  const W = 2 * HX * U + 24, H = 2 * HY * U + 24, cx = W / 2, cy = H / 2
  const sx = (x) => cx + x * U, sy = (y) => cy - y * U
  let g = ""
  for (let i = -HX; i <= HX; i++) { if (!i) continue; g += `<line x1="${sx(i)}" y1="6" x2="${sx(i)}" y2="${H - 6}" stroke="#ececf2" stroke-width="1"/>` }
  for (let i = -HY; i <= HY; i++) { if (!i) continue; g += `<line x1="6" y1="${sy(i)}" x2="${W - 6}" y2="${sy(i)}" stroke="#ececf2" stroke-width="1"/>` }
  g += `<line x1="4" y1="${cy}" x2="${W - 4}" y2="${cy}" stroke="#1c1c1e" stroke-width="1.2"/>`
  g += `<line x1="${cx}" y1="${H - 4}" x2="${cx}" y2="4" stroke="#1c1c1e" stroke-width="1.2"/>`
  g += `<path d="M${W - 4},${cy} l-7,-3.5 l0,7 z" fill="#1c1c1e"/><path d="M${cx},4 l-3.5,7 l7,0 z" fill="#1c1c1e"/>`
  g += `<text x="${W - 10}" y="${cy - 6}" font-size="12" font-style="italic" fill="#1c1c1e">x</text>`
  g += `<text x="${cx + 6}" y="14" font-size="12" font-style="italic" fill="#1c1c1e">y</text>`
  g += `<text x="${cx + 4}" y="${cy + 13}" font-size="10" fill="#8a8a8e">0</text>`
  g += `<line x1="${sx(1)}" y1="${cy - 3}" x2="${sx(1)}" y2="${cy + 3}" stroke="#1c1c1e"/><text x="${sx(1) - 3}" y="${cy + 14}" font-size="10" fill="#8a8a8e">1</text>`
  g += `<line x1="${cx - 3}" y1="${sy(1)}" x2="${cx + 3}" y2="${sy(1)}" stroke="#1c1c1e"/><text x="${cx + 5}" y="${sy(1) + 4}" font-size="10" fill="#8a8a8e">1</text>`
  const holes = model.holes || []
  const ends = []                                            // концы ветвей: {x, y, open}
  for (const br of model.branches) {
    const x0 = Math.max(br.xlo, -HX - 0.5), x1 = Math.min(br.xhi, HX + 0.5)
    if (x0 >= x1) continue
    const N = 420, segs = []
    let cur = []
    for (let i = 0; i <= N; i++) {
      const x = x0 + ((x1 - x0) * i) / N
      if (holes.some((h) => g22eq(x, h.x, (x1 - x0) / N + 1e-6))) { if (cur.length) { segs.push(cur); cur = [] } continue }
      const y = g22Eval(br, x)
      if (y >= -HY - 0.4 && y <= HY + 0.4 && g22In(br, x)) cur.push(`${sx(x).toFixed(1)},${sy(y).toFixed(1)}`)
      else if (cur.length) { segs.push(cur); cur = [] }
    }
    if (cur.length) segs.push(cur)
    for (const s of segs) if (s.length > 1) g += `<path d="M${s.join(" L")}" fill="none" stroke="#007AFF" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
    for (const end of [["xlo", br.lo], ["xhi", br.hi]]) {
      const xe = br[end[0]]
      if (!isFinite(xe) || xe < -HX || xe > HX) continue
      const ye = g22Eval(br, xe)
      if (ye < -HY || ye > HY) continue
      ends.push({ x: xe, y: ye, open: end[1] })
    }
  }
  // маркеры концов: одна точка — один кружок; если хоть одна ветвь замкнута в ней
  // (непрерывный стык), точка ПРИНАДЛЕЖИТ графику → закрашенный; иначе (скачок,
  // край) — выколотый. Дубли по совпадающей (x,y) схлопываем.
  const drawn = []
  for (const e of ends) {
    if (drawn.some((p) => g22eq(p.x, e.x, 1e-4) && g22eq(p.y, e.y, 1e-4))) continue
    const closedHere = ends.some((o) => g22eq(o.x, e.x, 1e-4) && g22eq(o.y, e.y, 1e-4) && !o.open)
    drawn.push({ x: e.x, y: e.y })
    g += `<circle cx="${sx(e.x).toFixed(1)}" cy="${sy(e.y).toFixed(1)}" r="3.4" fill="${closedHere ? "#007AFF" : "#fff"}" stroke="#007AFF" stroke-width="1.6"/>`
  }
  for (const h of holes) if (h.x >= -HX && h.x <= HX && h.y >= -HY && h.y <= HY)
    g += `<circle cx="${sx(h.x).toFixed(1)}" cy="${sy(h.y).toFixed(1)}" r="3.4" fill="#fff" stroke="#007AFF" stroke-width="1.6"/>`
  return svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`)
}

// ── тексты условий ───────────────────────────────────────────────────────
const g22Ask = {
  two: "Определите, при каких значениях m прямая y = m имеет с графиком ровно две общие точки.",
  three: "Определите, при каких значениях m прямая y = m имеет с графиком ровно три общие точки.",
  one: "Определите, при каких значениях m прямая y = m имеет с графиком ровно одну общую точку.",
  oneTwo: "Определите, при каких значениях m прямая y = m имеет с графиком одну или две общие точки.",
  m0: "Определите, при каких значениях m прямая y = m не имеет с графиком ни одной общей точки.",
  kOne: "Определите, при каких значениях k прямая y = kx имеет с графиком ровно одну общую точку.",
  k0: "Определите, при каких значениях k прямая y = kx не имеет с графиком общих точек.",
  maxN: "Какое наибольшее число общих точек может иметь график данной функции с прямой, параллельной оси абсцисс?",
}
const g22Cond = (body, ask) => `Постройте график функции\n${body}\n${ask}`

// ========================= ГЕНЕРАТОРЫ =====================================
// A1a — парабола вверх (x≥a) + прямая (x<a), «ровно две».
function t22PieceUp() {
  const a = randInt(-4, 3), xv = a + pick([1, 2]), yv = pick([-2, -1, 1, 2])
  const b = -2 * xv, c = xv * xv + yv
  const gA = a * a + b * a + c, La = gA + pick([2, 3, 4, 5, 6]), e = La - a
  const model = {
    branches: [
      { t: "parab", a: 1, b, c, xlo: a, xhi: Infinity, lo: false, hi: false },
      { t: "line", k: 1, b: e, xlo: -Infinity, xhi: a, lo: false, hi: true },
    ], holes: [],
  }
  const body = `y = ⟦cases:${g22Quad(1, b, c)} при x ≥ ${g22Num(a)}⁞${g22Lin(1, e)} при x < ${g22Num(a)}⟧`
  return { condition_text: g22Cond(body, g22Ask.two), answer: g22Answer(model, (n) => n === 2), image_url: null, solution_image: g22Plot(model) }
}
// A1b — парабола вниз (x≥a) + прямая (x<a), «ровно две».
function t22PieceDown() {
  const a = randInt(-3, 4), xv = a + pick([1, 2]), yv = pick([-2, -1, 1, 2])
  const b = 2 * xv, c = -xv * xv + yv
  const gA = -a * a + b * a + c, La = gA - pick([2, 3, 4, 5, 6]), e = La + a
  const model = {
    branches: [
      { t: "parab", a: -1, b, c, xlo: a, xhi: Infinity, lo: false, hi: false },
      { t: "line", k: -1, b: e, xlo: -Infinity, xhi: a, lo: false, hi: true },
    ], holes: [],
  }
  const body = `y = ⟦cases:${g22Quad(-1, b, c)} при x ≥ ${g22Num(a)}⁞${g22Lin(-1, e)} при x < ${g22Num(a)}⟧`
  return { condition_text: g22Cond(body, g22Ask.two), answer: g22Answer(model, (n) => n === 2), image_url: null, solution_image: g22Plot(model) }
}
// A2 — парабола-квадрат (x≥a) + гипербола −K/x (x<a), непрерывно, «одну или две».
function t22PieceHyper() {
  const xv = pick([-2, -1, 0, 1, 2]), a = randInt(xv - 4, Math.min(-1, xv - 2))   // a<0; конец параболы (a−xv)²≤16
  const b = -2 * xv, c = xv * xv                                     // (x−xv)²
  const gA = a * a + b * a + c, K = -a * gA                          // гипербола сходится к концу параболы
  const model = {
    branches: [
      { t: "parab", a: 1, b, c, xlo: a, xhi: Infinity, lo: false, hi: false },
      { t: "hyper", m0: -K, xlo: -Infinity, xhi: a, lo: false, hi: true },
    ], holes: [],
  }
  const body = `y = ⟦cases:${g22Quad(1, b, c)} при x ≥ ${g22Num(a)}⁞−${fT(K, "x")} при x < ${g22Num(a)}⟧`
  return { condition_text: g22Cond(body, g22Ask.oneTwo), answer: g22Answer(model, (n) => n === 1 || n === 2), image_url: null, solution_image: g22Plot(model) }
}
// A2′ — парабола x²+q (x≥a) + гипербола −K/x (x<a), с разрывом, «ровно одну».
function t22PieceHyperOne() {
  const q = pick([1, 2, 3]), a = randInt(-3, -1), V = q + pick([2, 3, 4]), K = -a * V
  const model = {
    branches: [
      { t: "parab", a: 1, b: 0, c: q, xlo: a, xhi: Infinity, lo: false, hi: false },
      { t: "hyper", m0: -K, xlo: -Infinity, xhi: a, lo: false, hi: true },
    ], holes: [],
  }
  const body = `y = ⟦cases:${g22Quad(1, 0, q)} при x ≥ ${g22Num(a)}⁞−${fT(K, "x")} при x < ${g22Num(a)}⟧`
  return { condition_text: g22Cond(body, g22Ask.one), answer: g22Answer(model, (n) => n === 1), image_url: null, solution_image: g22Plot(model) }
}
// A3 — три линейных куска (непрерывная зигзаг-ломаная), «ровно две».
function t22PieceLin3() {
  const p1 = pick([1, 2]), p2 = p1 + pick([1, 2])
  const V2 = pick([-1, 0, 1, 2]), drop = pick([2, 3, 4]), V1 = V2 + drop     // пик V1 > впадина V2
  const k1 = pick([1, 1.5, 2, 2.5]), k3 = pick([1, 1.5, 2])
  const k2 = -(V1 - V2) / (p2 - p1)
  const sh = randInt(-2, 2)                                                    // вертикальный сдвиг
  const w1 = V1 + sh, w2 = V2 + sh
  const e1 = w1 - k1 * p1, e2 = w1 - k2 * p1, e3 = w2 - k3 * p2
  const model = {
    branches: [
      { t: "line", k: k1, b: e1, xlo: -Infinity, xhi: p1, lo: false, hi: true },
      { t: "line", k: k2, b: e2, xlo: p1, xhi: p2, lo: false, hi: false },
      { t: "line", k: k3, b: e3, xlo: p2, xhi: Infinity, lo: true, hi: false },
    ], holes: [],
  }
  const body = `y = ⟦cases:${g22Lin(k1, e1)} при x < ${g22Num(p1)}⁞${g22Lin(k2, e2)} при ${g22Num(p1)} ≤ x ≤ ${g22Num(p2)}⁞${g22Lin(k3, e3)} при x > ${g22Num(p2)}⟧`
  return { condition_text: g22Cond(body, g22Ask.two), answer: g22Answer(model, (n) => n === 2), image_url: null, solution_image: g22Plot(model) }
}
// B1 — y=x²+bx − a|x+c| + d ; обе параболы проходят через угол (корень), «ровно три».
function t22ModWup() {
  let t; do { t = randInt(-6, 4) } while (t === 0)             // угол в x=t (=−c), не в нуле
  const dR = pick([2, 3, 4, 5, 6]), dL = pick([2, 3, 4, 5, 6])
  const rR = t + dR, rL = t - dL
  const a = (rR - rL) / 2, b = -(t + (rR + rL) / 2), c = -t, d = t * (rR + rL) / 2
  const model = {
    branches: [
      { t: "parab", a: 1, b: b + a, c: d + a * c, xlo: -Infinity, xhi: -c, lo: false, hi: false },
      { t: "parab", a: 1, b: b - a, c: d - a * c, xlo: -c, xhi: Infinity, lo: true, hi: false },
    ], holes: [],
  }
  const modTerm = `${g22eq(a, 1) ? "" : g22Num(a)}|${g22Lin(1, c)}|`
  const body = `y = ${g22Quad(1, b, 0)} − ${modTerm}${g22Tail(d)}`
  return { condition_text: g22Cond(body, g22Ask.three), answer: g22Answer(model, (n) => n === 3), image_url: null, solution_image: g22Plot(model) }
}
// B2 — y=a|x−c| − x² + bx + d ; обе параболы вниз через угол, «ровно три».
function t22ModMdown() {
  let tc; do { tc = randInt(-4, 6) } while (tc === 0)
  const dR = pick([2, 3, 4, 5, 6]), dL = pick([2, 3, 4, 5, 6])
  const rR = tc + dR, rL = tc - dL
  const a = (rR - rL) / 2, b = tc + (rR + rL) / 2, c = tc, d = -tc * (rR + rL) / 2
  const model = {
    branches: [
      { t: "parab", a: -1, b: b - a, c: d + a * c, xlo: -Infinity, xhi: c, lo: false, hi: false },
      { t: "parab", a: -1, b: b + a, c: d - a * c, xlo: c, xhi: Infinity, lo: true, hi: false },
    ], holes: [],
  }
  const modTerm = `${g22eq(a, 1) ? "" : g22Num(a)}|${g22Lin(1, -c)}|`
  const rest = g22Quad(-1, b, d).replace(/^−x²/, "− x²")      // «− x² + 8x − 15»
  return { condition_text: g22Cond(`y = ${modTerm} ${rest}`, g22Ask.three), answer: g22Answer(model, (n) => n === 3), image_url: null, solution_image: g22Plot(model) }
}
// B3 — y=|x|·(x+cc) − d·x, «ровно две».
function t22ModCubic() {
  const cc = pick([-1, 1, 2, 3]), d = pick([2, 3, 4, 5, 6])
  const model = {
    branches: [
      { t: "parab", a: 1, b: cc - d, c: 0, xlo: 0, xhi: Infinity, lo: false, hi: false },
      { t: "parab", a: -1, b: -cc - d, c: 0, xlo: -Infinity, xhi: 0, lo: false, hi: true },
    ], holes: [],
  }
  const absCoef = g22eq(Math.abs(cc), 1) ? "" : g22Num(Math.abs(cc))       // 1|x| → |x|
  const notation = pick([0, 1])
  const body = notation
    ? `y = |x| · (${g22Lin(1, cc)}) − ${g22Num(d)}x`
    : `y = x|x| ${cc < 0 ? "− " + absCoef : "+ " + absCoef}|x| − ${g22Num(d)}x`
  return { condition_text: g22Cond(body, g22Ask.two), answer: g22Answer(model, (n) => n === 2), image_url: null, solution_image: g22Plot(model) }
}
// B4 — y=|x²+bx+c| (два различных корня), «наибольшее число общих точек».
function t22ModAbsParab() {
  let b, c, D
  do { const r1 = randInt(-5, 3), r2 = r1 + pick([2, 3, 4, 5, 6]); b = -(r1 + r2); c = r1 * r2; D = b * b - 4 * c } while (D <= 0)
  const s = Math.sqrt(D), r1 = (-b - s) / 2, r2 = (-b + s) / 2
  const model = {
    branches: [
      { t: "parab", a: 1, b, c, xlo: -Infinity, xhi: r1, lo: false, hi: false },
      { t: "parab", a: -1, b: -b, c: -c, xlo: r1, xhi: r2, lo: false, hi: false },
      { t: "parab", a: 1, b, c, xlo: r2, xhi: Infinity, lo: false, hi: false },
    ], holes: [],
  }
  return { condition_text: g22Cond(`y = |${g22Quad(1, b, c)}|`, g22Ask.maxN), answer: String(g22Max(model)), image_url: null, solution_image: g22Plot(model) }
}
// C1 — ((a·x²+b·x)|x|)/(x+c0) = a·x|x| с дыркой, «ни одной».
function t22RatParabHole() {
  const a = pick([0.5, 0.75, 0.25, 1]), c0 = pick([-4, -3, -2, 2, 3, 4])
  const X0 = -c0, Y0 = a * X0 * Math.abs(X0)
  const model = {
    branches: [
      { t: "parab", a, b: 0, c: 0, xlo: 0, xhi: Infinity, lo: false, hi: false },
      { t: "parab", a: -a, b: 0, c: 0, xlo: -Infinity, xhi: 0, lo: false, hi: true },
    ], holes: [{ x: X0, y: Y0 }],
  }
  const num = g22Poly([{ c: a, v: "x²" }, { c: a * c0, v: "x" }])          // a x² + a·c0 x = a x (x+c0)
  return { condition_text: g22Cond(`y = ${fT(`(${num}) · |x|`, g22Lin(1, c0))}`, g22Ask.m0), answer: g22Answer(model, (n) => n === 0), image_url: null, solution_image: g22Plot(model) }
}
// C4 — c0 − (x+a)/(x²+ax) = c0 − 1/x с дыркой при x=−a, «ни одной».
function t22RatShiftHyp() {
  const c0 = pick([-5, -4, -3, -2, -1, 1, 2, 3, 5]), a = pick([1, 2, 4, 5])   // 1/a конечная дробь
  const model = {
    branches: [
      { t: "hyper2", A: -1, B: c0, xlo: -Infinity, xhi: 0, lo: false, hi: true },
      { t: "hyper2", A: -1, B: c0, xlo: 0, xhi: Infinity, lo: true, hi: false },
    ], holes: [{ x: -a, y: c0 + 1 / a }],
  }
  const body = `y = ${g22Num(c0)} − ${fT(g22Lin(1, a), g22Quad(1, a, 0))}`
  return { condition_text: g22Cond(body, g22Ask.m0), answer: g22Answer(model, (n) => n === 0), image_url: null, solution_image: g22Plot(model) }
}
// C6 — y=½(|x/a − a/x| + x/a + a/x) = max(x/a, a/x), «ровно одну».
function t22RatMax() {
  const a = pick([1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5.5, 6])
  const model = {
    branches: [
      { t: "hyper", m0: a, xlo: -Infinity, xhi: -a, lo: false, hi: false },
      { t: "line", k: 1 / a, b: 0, xlo: -a, xhi: 0, lo: false, hi: true },
      { t: "hyper", m0: a, xlo: 0, xhi: a, lo: true, hi: false },
      { t: "line", k: 1 / a, b: 0, xlo: a, xhi: Infinity, lo: false, hi: false },
    ], holes: [],
  }
  const A = g22Num(a)
  const body = `y = ${fT(1, 2)}·(|${fT("x", A)} − ${fT(A, "x")}| + ${fT("x", A)} + ${fT(A, "x")})`
  return { condition_text: g22Cond(body, g22Ask.one), answer: g22Answer(model, (n) => n === 1), image_url: null, solution_image: g22Plot(model) }
}
// C2 — ((x²+c)(x−d))/(d−x) = −(x²+c) с дыркой ; y=kx «ровно одна» (замкнутая формула).
function t22RatNegParab() {
  const c = pick([0.25, 1, 2.25, 4, 6.25]), d = pick([-2, -1, 1, 2])
  const ks = [...new Set([2 * Math.sqrt(c), -2 * Math.sqrt(c), -(d * d + c) / d].map((x) => Math.round(x * 1e6) / 1e6))].sort((a, b) => a - b)
  const sgn = d > 0 ? `${g22Num(d)} − x` : `− ${g22Num(-d)} − x`
  const body = `y = ${fT(`(x² + ${g22Num(c)})(${g22Lin(1, -d)})`, sgn)}`
  return { condition_text: g22Cond(body, g22Ask.kOne), answer: ks.map((k) => `k = ${g22Num(k)}`).join("; "), image_url: null, solution_image: g22PlotNegParab(c, d) }
}
// C3 — (a|x|−1)/(|x|−a·x²) = −1/|x| с дырками ; y=kx «нет общих точек».
function t22RatAbs() {
  const a = pick([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5])
  const ks = [-a * a, 0, a * a].sort((x, y) => x - y)
  const body = `y = ${fT(`${g22Num(a)}|x| − 1`, `|x| − ${g22Num(a)}x²`)}`
  return { condition_text: g22Cond(body, g22Ask.k0), answer: ks.map((k) => `k = ${g22Num(k)}`).join("; "), image_url: null, solution_image: g22PlotAbsRecip(a) }
}
// C5 — (a·x+b)/(a·x²+b·x) = 1/x с дыркой ; y=kx «ровно одна».
function t22RatHyp() {
  const a = pick([2, 3, 4, 5, 6, 7, 9]), bb = pick([-10, -8, -6, -5, 1, 5, 7])
  const body = `y = ${fT(g22Lin(a, bb), g22Quad(a, bb, 0))}`
  return { condition_text: g22Cond(body, g22Ask.kOne), answer: `k = ${g22Frac(a * a, bb * bb)}`, image_url: null, solution_image: g22PlotHyp(-bb / a) }
}
// упрощённые рендеры для y=kx семейств (график = базовая кривая с выколотой точкой)
function g22PlotNegParab(c, d) { return g22Plot({ branches: [{ t: "parab", a: -1, b: 0, c: -c, xlo: -Infinity, xhi: Infinity, lo: false, hi: false }], holes: [{ x: d, y: -(d * d + c) }] }) }
function g22PlotAbsRecip(a) { return g22Plot({ branches: [{ t: "hyper", m0: -1, xlo: 0, xhi: Infinity, lo: true, hi: false }, { t: "hyper2", A: 1, B: 0, xlo: -Infinity, xhi: 0, lo: false, hi: true }], holes: [{ x: 1 / a, y: -a }, { x: -1 / a, y: -a }] }) }
function g22PlotHyp(hole) { return g22Plot({ branches: [{ t: "hyper", m0: 1, xlo: 0, xhi: Infinity, lo: true, hi: false }, { t: "hyper", m0: 1, xlo: -Infinity, xhi: 0, lo: false, hi: true }], holes: [{ x: hole, y: 1 / hole }] }) }

// ── Шаблоны ОГЭ №24 (КЭС 7.2/7.3/7.4, часть 2 — задачи на доказательство) ─────────
// Номер развёрнутый: числового ответа нет, поэтому в поле answer кладём полный текст
// ДОКАЗАТЕЛЬСТВА (репетитору), а ученику в условие идёт только чертёж (image_url) —
// как и во всех геометрических номерах.
// Многие задачи банка отличаются лишь буквенной разметкой одной и той же схемы: пишем
// каноническую формулировку и доказательство один раз, затем переставляем буквы (relabel).
// Доказательство при этом остаётся верным — та же схема, другие имена вершин.
const sub1 = (x) => `${x}₁`
// Замена одиночных латинских заглавных по карте; callback читает исходную букву, поэтому
// взаимные замены (A↔B) корректны. Индекс ₁ остаётся при своей букве.
const relabel = (s, map) => s.replace(/[A-Z]/g, (c) => (map && map[c]) || c)
const mapABCD = (o) => ({ A: o[0], B: o[1], C: o[2], D: o[3] })
// Именованный четырёхугольник ABCD оставляем в канонической разметке (так пишет ФИПИ;
// переставлять буквы в имени — «CBAD», «стороны DC и BA» — неестественно). Разнообразие
// даём нейтральной буквой доп. точки и числами; типаж всё равно один (метод доказательства).
const relMap4 = () => mapABCD("ABCD")
const namesABCD = (m) => ["A", "B", "C", "D"].map((c) => m[c])
const q24 = (g, { W = 280, H = 200 } = {}) => svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`)
const dseg = (P, Q) => `<line x1="${P[0].toFixed(1)}" y1="${P[1].toFixed(1)}" x2="${Q[0].toFixed(1)}" y2="${Q[1].toFixed(1)}" stroke="${G_S}" stroke-width="1.2" stroke-dasharray="4 3"/>`
const ptAt = (P, dx, dy, name) => `<text x="${(P[0] + dx).toFixed(1)}" y="${(P[1] + dy).toFixed(1)}" font-size="14" font-style="italic" text-anchor="middle" fill="${G_S}">${name}</text>`
const quadLabels = (pts, names) => { const cen = cen4(pts); return pts.map((p, i) => vLabel(p, cen, names[i])).join("") }
// пересечение прямых AB и CD
function segInt(A, B, C, D) {
  const a1 = B[1] - A[1], b1 = A[0] - B[0], c1 = a1 * A[0] + b1 * A[1]
  const a2 = D[1] - C[1], b2 = C[0] - D[0], c2 = a2 * C[0] + b2 * C[1]
  const det = a1 * b2 - a2 * b1
  return [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det]
}

// T1 — остроугольный треугольник, две высоты; равенство двух углов (через вписанность).
function t24TriAltAngle() {
  const [U, V] = shuffle(["A", "B", "C"]).slice(0, 2)              // упорядоченная пара вершин с высотами
  const Wt = ["A", "B", "C"].find((x) => x !== U && x !== V)
  const U1 = sub1(U), V1 = sub1(V)
  const pr = [U, V].sort()                                          // в условии высоты по алфавиту
  const cond = `В остроугольном треугольнике ABC проведены высоты ${pr[0]}${sub1(pr[0])} и ${pr[1]}${sub1(pr[1])}. Докажите, что углы ${V}${V1}${U1} и ${V}${U}${U1} равны.`
  const proof =
`Высоты ${U}${U1} и ${V}${V1} перпендикулярны сторонам, лежащим против вершин ${U} и ${V}, поэтому ∠${U}${U1}${V} = ∠${V}${V1}${U} = 90°.
Из точек ${U1} и ${V1} отрезок ${U}${V} виден под прямым углом, значит они лежат на окружности с диаметром ${U}${V}. Тем самым точки ${U}, ${V}, ${U1}, ${V1} лежат на одной окружности.
Вписанные углы ${V}${V1}${U1} и ${V}${U}${U1} опираются на одну и ту же дугу ${V}${U1}, поэтому они равны.`
  const P = { A: [40, 165], B: [135, 34], C: [235, 165] }
  const fU = footPerp(P[V], P[Wt], P[U]), fV = footPerp(P[U], P[Wt], P[V])
  const cen = [(P.A[0] + P.B[0] + P.C[0]) / 3, (P.A[1] + P.B[1] + P.C[1]) / 3]
  const lf = (F, nm) => { const dx = F[0] - cen[0], dy = F[1] - cen[1], L = Math.hypot(dx, dy) || 1; return ptAt(F, dx / L * 13, dy / L * 13 + 4, nm) }
  let g = `<polygon points="${["A", "B", "C"].map((n) => `${P[n][0]},${P[n][1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6" stroke-linejoin="round"/>`
  g += ["A", "B", "C"].map((n) => vLabel(P[n], cen, n)).join("")
  g += cSeg(P[U], fU) + cSeg(P[V], fV) + cSeg(fU, fV)
  g += cDot(fU) + cDot(fV) + rightMark(fU, P[U], P[Wt], 8) + rightMark(fV, P[V], P[Wt], 8)
  g += angArc(fV, P[V], fU, 15, null, 1) + angArc(P[U], P[V], fU, 19, null, 1)
  g += lf(fU, U1) + lf(fV, V1)
  return { condition_text: cond, answer: proof, image_url: q24(g) }
}

// T2 — тупоугольный треугольник, две высоты; подобие двух треугольников.
const T2_VARIANTS = [
  { obt: "B", u: "A", v: "C", ang: "ABC", tri: "A₁BC₁", ref: "ABC" },
  { obt: "A", u: "B", v: "C", ang: "BAC", tri: "AB₁C₁", ref: "ABC" },
  { obt: "C", u: "A", v: "B", ang: "ACB", tri: "A₁CB₁", ref: "ACB" },
]
function t24TriAltSim() {
  const V = pick(T2_VARIANTS), O = V.obt, U = V.u, Vv = V.v
  const U1 = sub1(U), V1 = sub1(Vv)
  const cond = `В треугольнике ABC с тупым углом ${V.ang} проведены высоты ${U}${U1} и ${Vv}${V1}. Докажите, что треугольники ${V.tri} и ${V.ref} подобны.`
  const proof =
`Высоты ${U}${U1} и ${Vv}${V1} перпендикулярны прямым ${O}${Vv} и ${O}${U}, поэтому ∠${O}${U1}${U} = ∠${O}${V1}${Vv} = 90°.
Так как угол ${V.ang} тупой, основания высот ${U1} и ${V1} лежат на продолжениях сторон за вершину ${O}, поэтому ∠${U1}${O}${V1} = ∠${U}${O}${Vv} как вертикальные углы.
Прямоугольные треугольники ${O}${U1}${U} и ${O}${V1}${Vv} имеют равные углы при вершине ${O} (∠${U1}${O}${U} = ∠${V1}${O}${Vv} = 180° − ∠${U}${O}${Vv}), значит подобны, откуда ${O}${U1} : ${O}${U} = ${O}${V1} : ${O}${Vv}.
У треугольников ${V.tri} и ${V.ref} угол при вершине ${O} общий (∠${U1}${O}${V1} = ∠${U}${O}${Vv}), а заключающие его стороны пропорциональны (${O}${U1} : ${O}${U} = ${O}${V1} : ${O}${Vv}), поэтому треугольники подобны.`
  const PO = [150, 96], PU = [42, 158], PV = [244, 158]
  const fU = footPerp(PO, PV, PU), fV = footPerp(PO, PU, PV)
  const cen = [(PO[0] + PU[0] + PV[0]) / 3, (PO[1] + PU[1] + PV[1]) / 3]
  const lf = (F, nm) => { const dx = F[0] - cen[0], dy = F[1] - cen[1], L = Math.hypot(dx, dy) || 1; return ptAt(F, dx / L * 13, dy / L * 13 + 4, nm) }
  let g = `<polygon points="${[PU, PO, PV].map((p) => `${p[0]},${p[1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6" stroke-linejoin="round"/>`
  g += vLabel(PO, cen, O) + vLabel(PU, cen, U) + vLabel(PV, cen, Vv)
  g += dseg(PO, fU) + dseg(PO, fV) + cSeg(PU, fU) + cSeg(PV, fV)
  g += cDot(fU) + cDot(fV) + rightMark(fU, PU, PO, 8) + rightMark(fV, PV, PO, 8)
  g += lf(fU, U1) + lf(fV, V1)
  return { condition_text: cond, answer: proof, image_url: q24(g) }
}

// Q1 — параллелограмм, сторона вдвое больше смежной, середина; отрезок — биссектриса.
function t24ParaMidBis() {
  const m = relMap4(), N = namesABCD(m), ex = pick(["K", "M", "N", "L", "P"])
  const S = (s) => relabel(s, m).replace(/K/g, ex)
  const cond = S(`Сторона BC параллелограмма ABCD вдвое больше стороны CD. Точка K — середина стороны BC. Докажите, что DK — биссектриса угла ADC.`)
  const proof = S(
`В параллелограмме BC = AD и CD = AB. Так как BC = 2·CD и K — середина BC, то CK = BC/2 = CD, поэтому треугольник CDK равнобедренный и ∠CDK = ∠CKD.
Поскольку BC ∥ AD, при секущей DK накрест лежащие углы равны: ∠CKD = ∠KDA.
Значит, ∠CDK = ∠KDA, то есть DK делит угол ADC пополам — DK является биссектрисой угла ADC.`)
  const A = [45, 155], B = [75, 75.5], C = [245, 75.5], D = [215, 155], pts = [A, B, C, D]
  const K = gmid(B, C)
  let g = cPoly(pts) + quadLabels(pts, N) + cSeg(D, K) + cDot(K)
  g += eqTicks(C, K, 1) + eqTicks(C, D, 1)
  g += angArc(D, A, K, 17, null, 1) + angArc(D, K, C, 17, null, 1)
  g += ptAt(K, 0, -7, ex)
  return { condition_text: cond, answer: proof, image_url: q24(g) }
}

// Q6 — параллелограмм, биссектрисы двух углов пересекаются на стороне; точка — середина.
function t24ParaBisMid() {
  const m = relMap4(), N = namesABCD(m), ex = pick(["M", "N", "K", "L", "P"])
  const S = (s) => relabel(s, m).replace(/M/g, ex)
  const cond = S(`Биссектрисы углов B и C параллелограмма ABCD пересекаются в точке M, лежащей на стороне AD. Докажите, что M — середина AD.`)
  const proof = S(
`Пусть BM — биссектриса угла B, тогда ∠ABM = ∠MBC. Так как AD ∥ BC, накрест лежащие при секущей BM углы равны: ∠MBC = ∠AMB. Значит ∠ABM = ∠AMB, треугольник ABM равнобедренный и AM = AB.
Аналогично для биссектрисы угла C получаем DM = DC. В параллелограмме AB = DC, поэтому AM = DM, то есть M — середина AD.`)
  const A = [48, 152], B = [80, 82], C = [234, 82], D = [202, 152], pts = [A, B, C, D]
  const M = gmid(A, D)
  let g = cPoly(pts) + quadLabels(pts, N) + cSeg(B, M) + cSeg(C, M) + cDot(M)
  g += eqTicks(A, M, 1) + eqTicks(M, D, 1)
  g += angArc(B, A, M, 14, null, 1) + angArc(B, M, C, 14, null, 1)
  g += angArc(C, B, M, 14, null, 1) + angArc(C, M, D, 14, null, 1)
  g += ptAt(M, 0, 15, ex)
  return { condition_text: cond, answer: proof, image_url: q24(g) }
}

// Q8 — четырёхугольник, биссектрисы двух углов пересекаются на стороне; равноудалённость.
function t24QuadBisEquid() {
  const m = relMap4(), N = namesABCD(m), ex = pick(["O", "K", "M", "P", "N"])
  const S = (s) => relabel(s, m).replace(/O/g, ex)
  const cond = S(`Биссектрисы углов B и C четырёхугольника ABCD пересекаются в точке O, лежащей на стороне AD. Докажите, что точка O равноудалена от прямых AB, BC и CD.`)
  const proof = S(
`Точка O лежит на биссектрисе угла B (угла ABC), поэтому она равноудалена от прямых, содержащих его стороны, — от AB и BC.
Точка O лежит на биссектрисе угла C (угла BCD), поэтому она равноудалена от прямых BC и CD.
Следовательно, расстояния от O до прямых AB, BC и CD равны — точка O равноудалена от всех трёх прямых.`)
  const A = [42, 158], B = [74, 58], C = [214, 52], D = [256, 158], pts = [A, B, C, D]
  const O = [150, 158]
  let g = cPoly(pts) + quadLabels(pts, N) + cSeg(B, O) + cSeg(C, O) + cDot(O)
  g += angArc(B, A, O, 14, null, 1) + angArc(B, O, C, 14, null, 1)
  g += angArc(C, B, O, 14, null, 1) + angArc(C, O, D, 14, null, 1)
  g += ptAt(O, 0, 16, ex)
  return { condition_text: cond, answer: proof, image_url: q24(g) }
}

// Q9 — прямая через точку пересечения диагоналей параллелограмма; равные отрезки.
function t24ParaCenterSeg() {
  const m = relMap4(), N = namesABCD(m)
  const [e1, e2] = shuffle(["E", "F", "K", "M", "N", "P", "Q"]).slice(0, 2)
  const S = (s) => relabel(s, m).replace(/[EF]/g, (c) => (c === "E" ? e1 : e2))
  const cond = S(`Через точку O пересечения диагоналей параллелограмма ABCD проведена прямая, пересекающая стороны AB и CD в точках E и F соответственно. Докажите, что отрезки AE и CF равны.`)
  const proof = S(
`Точка O — точка пересечения диагоналей параллелограмма, поэтому OA = OC (диагонали параллелограмма делятся точкой пересечения пополам).
Рассмотрим треугольники AOE и COF: OA = OC; ∠AOE = ∠COF как вертикальные; ∠OAE = ∠OCF как накрест лежащие при AB ∥ CD и секущей AC.
Значит, треугольники AOE и COF равны по стороне и двум прилежащим углам, откуда AE = CF.`)
  const A = [50, 155], B = [220, 155], C = [255, 60], D = [85, 60], pts = [A, B, C, D]
  const O = cen4(pts), E = [110, 155], F = [O[0] * 2 - E[0], O[1] * 2 - E[1]]
  let g = cPoly(pts) + quadLabels(pts, N) + dseg(A, C) + dseg(B, D) + cSeg(E, F)
  g += cDot(O) + cDot(E) + cDot(F) + eqTicks(A, E, 1) + eqTicks(C, F, 1)
  g += ptAt(O, 10, -4, "O") + ptAt(E, -2, 15, S("E")) + ptAt(F, 2, -8, S("F"))
  return { condition_text: cond, answer: proof, image_url: q24(g) }
}

// Q2 — трапеция, основания и диагональ; подобие треугольников CBD и BDA.
function t24TrapDiagSim() {
  const r = pick([2, 3, 4]), b = pick([2, 3, 4, 4.5, 5, 6, 7, 8, 9])
  const bc = b, bd = b * r, ad = b * r * r
  const num = (x) => Number.isInteger(x) ? String(x) : decOut(x)
  const cond = `Основания BC и AD трапеции ABCD равны соответственно ${num(bc)} и ${num(ad)}, BD=${num(bd)}. Докажите, что треугольники CBD и BDA подобны.`
  const proof =
`BC = ${num(bc)}, BD = ${num(bd)}, AD = ${num(ad)}, поэтому BC : BD = BD : AD (обе части равны 1 : ${r}, так как BD² = ${num(bd * bd)} = BC·AD).
BC ∥ AD, поэтому ∠CBD = ∠BDA как накрест лежащие углы при секущей BD.
В треугольниках CBD и BDA этот угол заключён между пропорциональными сторонами: CB : DB = BD : DA. Значит, треугольники CBD и BDA подобны по двум сторонам и углу между ними.`
  const pts = trapPts([140, 105], 210, 70, 86), A = pts[0], B = pts[1], C = pts[2], D = pts[3], cen = cen4(pts)
  let g = cPoly(pts) + quadLabels(pts, N4(A, B, C, D)) + cSeg(B, D)
  g += angArc(B, C, D, 15, null, 1) + angArc(D, B, A, 15, null, 1)
  g += sideLabel(B, C, cen, num(bc)) + sideLabel(A, D, cen, num(ad))
  return { condition_text: cond, answer: proof, image_url: q24(g) }
}
// метки ABCD для фигур без переразметки
function N4() { return ["A", "B", "C", "D"] }

// Q3 — произвольная точка внутри параллелограмма; сумма площадей = половина.
function t24ParaInnerArea() {
  const e = pick(["E", "F", "M", "K", "P"])
  const cond = `Внутри параллелограмма ABCD выбрали произвольную точку ${e}. Докажите, что сумма площадей треугольников B${e}C и A${e}D равна половине площади параллелограмма.`
  const proof =
`Обозначим через a длину стороны BC (она равна AD) и через h — расстояние между прямыми BC и AD; тогда площадь параллелограмма S = a·h.
Пусть h₁ и h₂ — расстояния от точки ${e} до прямых BC и AD. Так как ${e} лежит между этими прямыми, h₁ + h₂ = h.
Тогда S(B${e}C) + S(A${e}D) = ½·a·h₁ + ½·a·h₂ = ½·a·(h₁ + h₂) = ½·a·h = ½·S.`
  const A = [50, 155], B = [80, 60], C = [250, 60], D = [220, 155], pts = [A, B, C, D]
  const E = [168, 118]
  let g = cPoly(pts) + quadLabels(pts, N4()) + cSeg(E, A) + cSeg(E, B) + cSeg(E, C) + cSeg(E, D) + cDot(E)
  g += ptAt(E, 8, 4, e)
  return { condition_text: cond, answer: proof, image_url: q24(g) }
}

// Q5 — точка на средней линии трапеции; сумма площадей = половина.
function t24TrapMidlineArea() {
  const f = pick(["F", "K", "E", "M", "P"])
  const cond = `На средней линии трапеции ABCD с основаниями AD и BC выбрали произвольную точку ${f}. Докажите, что сумма площадей треугольников B${f}C и A${f}D равна половине площади трапеции.`
  const proof =
`Пусть h — высота трапеции. Средняя линия параллельна основаниям и удалена от каждого из них на h/2, поэтому расстояние от точки ${f} до BC равно h/2 и расстояние от ${f} до AD равно h/2.
Тогда S(B${f}C) = ½·BC·(h/2), S(A${f}D) = ½·AD·(h/2), и их сумма равна
½·(h/2)·(BC + AD) = ½·(½·(AD + BC)·h) = ½·S(трапеции).`
  const pts = trapPts([140, 105], 210, 90, 88), A = pts[0], B = pts[1], C = pts[2], D = pts[3]
  const mAB = gmid(A, B), mCD = gmid(C, D), F = [mAB[0] + (mCD[0] - mAB[0]) * 0.58, mAB[1] + (mCD[1] - mAB[1]) * 0.58]
  let g = cPoly(pts) + quadLabels(pts, N4()) + dseg(mAB, mCD)
  g += cSeg(F, A) + cSeg(F, B) + cSeg(F, C) + cSeg(F, D) + cDot(F)
  g += ptAt(F, 0, -8, f)
  return { condition_text: cond, answer: proof, image_url: q24(g) }
}

// Q7 — середина боковой стороны трапеции; площадь треугольника = половина трапеции.
function t24TrapLatMidArea() {
  const m = mapABCD("ABCD"), N = namesABCD(m), ex = pick(["K", "E", "M", "P", "N"])
  const S = (s) => relabel(s, m).replace(/K/g, ex)
  const cond = S(`Точка K — середина боковой стороны CD трапеции ABCD. Докажите, что площадь треугольника KAB равна половине площади трапеции.`)
  const proof = S(
`Пусть h — высота трапеции (расстояние между основаниями AD и BC). Так как K — середина боковой стороны CD, расстояние от K до основания AD равно h/2 и до основания BC равно h/2.
Тогда S(AKD) = ½·AD·(h/2), S(BKC) = ½·BC·(h/2), и их сумма равна ½·(h/2)·(AD + BC) = ½·S(трапеции).
Так как S(KAB) = S(трапеции) − S(AKD) − S(BKC), получаем S(KAB) = S − ½·S = ½·S(трапеции).`)
  const pts = trapPts([140, 105], 210, 90, 88), A = pts[0], B = pts[1], C = pts[2], D = pts[3]
  const K = gmid(C, D)
  let g = cPoly(pts) + quadLabels(pts, N) + cSeg(K, A) + cSeg(K, B) + cDot(K)
  g += eqTicks(C, K, 1) + eqTicks(K, D, 1) + ptAt(K, 12, 4, ex)
  return { condition_text: cond, answer: proof, image_url: q24(g) }
}

// Q10 — диагонали трапеции; равновеликость боковых треугольников.
function t24TrapDiagArea() {
  const p = pick(["P", "O", "K", "M"])
  const S = (s) => s.replace(/P/g, p)
  const cond = S(`В трапеции ABCD с основаниями AD и BC диагонали пересекаются в точке P. Докажите, что площади треугольников APB и CPD равны.`)
  const proof = S(
`Основания BC и AD параллельны, поэтому вершины B и C равноудалены от прямой AD. Значит, треугольники ABD и ACD, имеющие общее основание AD, равновелики: S(ABD) = S(ACD).
Диагонали пересекаются в точке P, поэтому S(ABD) = S(APB) + S(APD) и S(ACD) = S(CPD) + S(APD).
Вычитая общую площадь S(APD), получаем S(APB) = S(CPD).`)
  const pts = trapPts([140, 105], 210, 90, 88), A = pts[0], B = pts[1], C = pts[2], D = pts[3]
  const P = segInt(A, C, B, D)
  let g = cPoly(pts) + quadLabels(pts, N4()) + cSeg(A, C) + cSeg(B, D) + cDot(P)
  g += ptAt(P, 0, 15, p)
  return { condition_text: cond, answer: proof, image_url: q24(g) }
}

// Q4 — выпуклый четырёхугольник, равные углы на общий отрезок ⇒ вписан ⇒ другие равны.
function t24CyclicAngles() {
  const m = relMap4(), N = namesABCD(m)
  const S = (s) => relabel(s, m)
  const cond = S(`В выпуклом четырёхугольнике ABCD углы CDB и CAB равны. Докажите, что углы BCA и BDA также равны.`)
  const proof = S(
`Углы CAB и CDB опираются на отрезок CB и равны, причём точки A и D лежат по одну сторону от прямой CB. Значит, точки A и D лежат на окружности, проходящей через C и B, то есть четырёхугольник ABCD вписан в окружность.
Тогда углы BCA и BDA вписаны в эту окружность и опираются на одну и ту же дугу AB, поэтому они равны.`)
  const A = [45, 155], B = [65, 55], C = [235, 58], D = [258, 155], pts = [A, B, C, D]
  let g = cPoly(pts) + quadLabels(pts, N) + cSeg(A, C) + cSeg(B, D)
  g += angArc(A, C, B, 16, null, 1) + angArc(D, C, B, 16, null, 1)
  g += angArc(C, B, A, 16, null, 2) + angArc(D, B, A, 22, null, 2)
  return { condition_text: cond, answer: proof, image_url: q24(g) }
}

// C1 — вписанный четырёхугольник, продолжения сторон в точке K; подобие треугольников.
function t24CyclicExtSim() {
  const m = relMap4(), N = namesABCD(m), k = pick(["K", "M", "P", "N", "O"])
  const S = (s) => relabel(s, m).replace(/K/g, k)
  const cond = S(`Известно, что около четырёхугольника ABCD можно описать окружность и что продолжения сторон AD и BC четырёхугольника пересекаются в точке K. Докажите, что треугольники KAB и KCD подобны.`)
  const proof = S(
`Четырёхугольник ABCD вписан в окружность, поэтому ∠DAB + ∠BCD = 180° (сумма противоположных углов).
Точки K, A, D лежат на одной прямой, поэтому ∠KAB = 180° − ∠DAB = ∠BCD.
Точки K, B, C лежат на одной прямой, поэтому луч CK совпадает с лучом CB, откуда ∠KCD = ∠BCD. Значит, ∠KAB = ∠KCD.
У треугольников KAB и KCD угол при вершине K общий и ∠KAB = ∠KCD, поэтому эти треугольники подобны по двум углам.`)
  const A = [84, 146.5], B = [196, 146.5], C = [157.3, 60.5], D = [122.7, 60.5], K = [140, 22], pts = [A, B, C, D]
  let g = cCircle([140, 120], 62) + cPoly(pts) + quadLabels(pts, N)
  g += cSeg(A, K) + cSeg(B, K) + cDot(K) + ptAt(K, 0, -7, k)
  return { condition_text: cond, answer: proof, image_url: q24(g, { W: 280, H: 210 }) }
}

// C2 — внутренняя общая касательная делит линию центров; отношение диаметров.
function t24TangentRatio() {
  const [Pc, Qc] = shuffle(["P", "Q", "M", "N", "I", "J", "E", "F"]).slice(0, 2)
  const [aa, bb] = pick([["a", "b"], ["m", "n"], ["p", "q"], ["k", "l"]])
  const T = pick(["T", "S", "L", "O"])
  const cond = `Окружности с центрами в точках ${Pc} и ${Qc} не имеют общих точек, и ни одна из них не лежит внутри другой. Внутренняя общая касательная к этим окружностям делит отрезок, соединяющий их центры, в отношении ${aa}:${bb}. Докажите, что диаметры этих окружностей относятся как ${aa}:${bb}.`
  const proof =
`Пусть касательная касается окружностей в точках X и Y и пересекает отрезок ${Pc}${Qc} в точке ${T}, причём ${Pc}${T} : ${T}${Qc} = ${aa} : ${bb}.
Радиусы ${Pc}X и ${Qc}Y перпендикулярны касательной, поэтому ∠${Pc}X${T} = ∠${Qc}Y${T} = 90°. Углы ${Pc}${T}X и ${Qc}${T}Y равны как вертикальные.
Значит, прямоугольные треугольники ${Pc}X${T} и ${Qc}Y${T} подобны, откуда ${Pc}X : ${Qc}Y = ${Pc}${T} : ${T}${Qc} = ${aa} : ${bb}.
${Pc}X и ${Qc}Y — радиусы окружностей, а диаметры вдвое больше радиусов, поэтому диаметры относятся так же, как радиусы, то есть как ${aa} : ${bb}.`
  const cP = [82, 108], rP = 34, cQ = [204, 108], rQ = 22, T0 = [82 + 122 * rP / (rP + rQ), 108]
  const nrm = (v) => { const L = Math.hypot(v[0], v[1]); return [v[0] / L, v[1] / L] }
  const sinf = rP / (T0[0] - cP[0]), cosf = Math.sqrt(1 - sinf * sinf)
  const n = [-sinf, cosf]                                   // единичная нормаль к касательной
  const X = [cP[0] - rP * n[0], cP[1] - rP * n[1]]          // точка касания на P (снизу)
  const Y = [cQ[0] + rQ * n[0], cQ[1] + rQ * n[1]]          // на Q (сверху)
  const dir = nrm([Y[0] - X[0], Y[1] - X[1]])
  const t1 = [X[0] - dir[0] * 22, X[1] - dir[1] * 22], t2 = [Y[0] + dir[0] * 22, Y[1] + dir[1] * 22]
  let g = cCircle(cP, rP) + cCircle(cQ, rQ) + cSeg(t1, t2)
  g += dseg(cP, cQ) + cSeg(cP, X) + cSeg(cQ, Y)
  g += cDot(cP) + cDot(cQ) + cDot(T0) + cDot(X) + cDot(Y)
  g += rightMark(X, cP, t2, 7) + rightMark(Y, cQ, t1, 7)
  g += ptAt(cP, -12, 4, Pc) + ptAt(cQ, 12, 4, Qc) + ptAt(T0, 2, 15, T) + ptAt(X, -8, 2, "X") + ptAt(Y, 9, 2, "Y")
  return { condition_text: cond, answer: proof, image_url: q24(g, { W: 280, H: 200 }) }
}

// C3 — две пересекающиеся окружности; линия центров ⟂ общей хорде.
function t24RadicalPerp() {
  const [M, Nn] = shuffle(["M", "N", "P", "Q", "E", "F", "I", "J"]).slice(0, 2)
  const [Sp, Tp] = shuffle(["S", "T", "C", "D", "A", "B", "K", "L"]).slice(0, 2)
  const cond = `Окружности с центрами в точках ${M} и ${Nn} пересекаются в точках ${Sp} и ${Tp}, причём точки ${M} и ${Nn} лежат по одну сторону от прямой ${Sp}${Tp}. Докажите, что прямые ${M}${Nn} и ${Sp}${Tp} перпендикулярны.`
  const proof =
`${M}${Sp} = ${M}${Tp} как радиусы первой окружности, поэтому точка ${M} равноудалена от концов отрезка ${Sp}${Tp} и лежит на его серединном перпендикуляре.
Точно так же ${Nn}${Sp} = ${Nn}${Tp} как радиусы второй окружности, поэтому точка ${Nn} тоже лежит на серединном перпендикуляре к ${Sp}${Tp}.
Через две точки проходит единственная прямая, поэтому прямая ${M}${Nn} совпадает с серединным перпендикуляром к отрезку ${Sp}${Tp} и, значит, перпендикулярна прямой ${Sp}${Tp}.`
  const cM = [90, 105], rM = 85.9, cN = [135, 105], rN = 48.8
  const xc = 168, S0 = [xc, 69], T0 = [xc, 141], Fp = [xc, 105]
  let g = cCircle(cM, rM) + cCircle(cN, rN) + cSeg(S0, T0) + cSeg(cM, Fp)
  g += cDot(cM) + cDot(cN) + cDot(S0) + cDot(T0) + rightMark(Fp, cM, S0, 8)
  g += ptAt(cM, -12, 4, M) + ptAt(cN, 0, 15, Nn) + ptAt(S0, 4, -6, Sp) + ptAt(T0, 4, 13, Tp)
  return { condition_text: cond, answer: proof, image_url: q24(g, { W: 250, H: 200 }) }
}

// ── Шаблоны ОГЭ №23 (часть 2 — геометрическая задача на вычисление) ──────────────
// Как и №24: чертёж строит сам ученик, поэтому в условие он не идёт (generateTask прячет
// его в solution_image); ответ — ЧИСЛО, а полное решение — в поле solution (для будущего
// разбора). Числа подбираются так, чтобы ответ был «красивым» (целое / конечная дробь /
// несократимая дробь / k√m). Каждый ответ сверен с примером из банка ФИПИ.
// Формат рационального ответа: целое, конечная десятичная или несократимая дробь p/q.
function fmtRat(n, d) {
  const [rn, rd] = reduceFr(n, d)
  if (rd === 1) return String(rn)
  return terminating(rd) ? decStr([rn, rd]) : `${rn}/${rd}`
}
const q23 = q24   // тот же размерный враппер SVG

// T1 — высота из вершины прямого угла к гипотенузе: AB² = AH·AC.
function t23RightProj() {
  const ah = pick([3, 4, 5, 6, 7, 8, 9, 10]), k = pick([2, 3]), ac = ah * k * k, ab = ah * k
  const cond = `Точка H является основанием высоты, проведённой из вершины прямого угла B треугольника ABC к гипотенузе AC. Найдите AB, если AH=${ah}, AC=${ac}.`
  const sol = `AB — катет, AH — его проекция на гипотенузу AC. По свойству высоты, проведённой из прямого угла: AB² = AH·AC = ${ah}·${ac} = ${ah * ac}. Значит, AB = ${ab}.`
  const P = { A: [30, 158], C: [258, 158] }, B = [90, 44]
  const H = footPerp(P.A, P.C, B), cen = [(P.A[0] + P.C[0] + B[0]) / 3, (P.A[1] + P.C[1] + B[1]) / 3]
  let g = `<polygon points="${[P.A, B, P.C].map((p) => `${p[0]},${p[1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6" stroke-linejoin="round"/>`
  g += cSeg(B, H) + cDot(H) + rightMark(B, P.A, P.C, 10) + rightMark(H, B, P.A, 8)
  g += vLabel(P.A, cen, "A") + vLabel(B, cen, "B") + vLabel(P.C, cen, "C") + ptAt(H, -2, 14, "H")
  return { condition_text: cond, answer: String(ab), image_url: q23(g), solution: sol }
}

// T2 — прямая, параллельная AC, отсекает подобный треугольник: BN = MN·NC/(AC−MN).
function t23ParaLine() {
  let a, b
  do { a = randInt(2, 6); b = randInt(a + 1, 9) } while (gcd(a, b) !== 1)
  const s = randInt(3, 8), u = randInt(3, 7)
  const mn = a * s, ac = b * s, bn = a * u, nc = (b - a) * u
  const cond = `Прямая, параллельная стороне AC треугольника ABC, пересекает стороны AB и BC в точках M и N соответственно. Найдите BN, если MN=${mn}, AC=${ac}, NC=${nc}.`
  const sol = `Так как MN ∥ AC, треугольники BMN и BAC подобны, поэтому MN : AC = BN : BC. Пусть BN = x, тогда BC = x + NC = x + ${nc}, и ${mn}/${ac} = x/(x+${nc}). Отсюда x = MN·NC/(AC−MN) = ${mn}·${nc}/(${ac}−${mn}) = ${bn}. BN = ${bn}.`
  const A = [30, 158], B = [120, 30], C = [250, 158]
  const fN = (Q, R, f) => [Q[0] + (R[0] - Q[0]) * f, Q[1] + (R[1] - Q[1]) * f]
  const fr = bn / (bn + nc), M = fN(B, A, fr), N = fN(B, C, fr), cen = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3]
  let g = `<polygon points="${[A, B, C].map((p) => `${p[0]},${p[1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6" stroke-linejoin="round"/>`
  g += cSeg(M, N) + cDot(M) + cDot(N)
  g += vLabel(A, cen, "A") + vLabel(B, cen, "B") + vLabel(C, cen, "C") + ptAt(M, -12, 2, "M") + ptAt(N, 12, 2, "N")
  return { condition_text: cond, answer: String(bn), image_url: q23(g), solution: sol }
}

// T3 — два катета → высота к гипотенузе: h = p·q/√(p²+q²).
const PYTH23 = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [6, 8, 10], [9, 12, 15]]
function t23LegsHeight() {
  const [m, n, r] = pick(PYTH23), t = pick([1, 2, 3]), p = m * t, q = n * t, hyp = r * t
  const cond = `Катеты прямоугольного треугольника равны ${p} и ${q}. Найдите высоту, проведённую к гипотенузе.`
  const sol = `Гипотенуза равна √(${p}²+${q}²) = ${hyp}. Площадь треугольника ½·${p}·${q} равна ½·(гипотенуза)·(высота), поэтому высота = ${p}·${q}/${hyp} = ${fmtRat(p * q, hyp)}.`
  const A = [30, 158], C = [258, 158], B = [96, 44], H = footPerp(A, C, B), cen = [(A[0] + C[0] + B[0]) / 3, (A[1] + C[1] + B[1]) / 3]
  let g = `<polygon points="${[A, B, C].map((p2) => `${p2[0]},${p2[1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6" stroke-linejoin="round"/>`
  g += cSeg(B, H) + rightMark(B, A, C, 10) + vLabel(A, cen, "A") + vLabel(B, cen, "B") + vLabel(C, cen, "C")
  return { condition_text: cond, answer: fmtRat(p * q, hyp), image_url: q23(g), solution: sol }
}

// T4 — катет и гипотенуза → высота к гипотенузе: второй катет = √(c²−a²), h = a·b/c.
function t23LegHypHeight() {
  const [m, n, r] = pick(PYTH23), t = pick([1, 2, 3]), a = m * t, c = r * t, b = n * t
  const cond = `Катет и гипотенуза прямоугольного треугольника равны ${a} и ${c}. Найдите высоту, проведённую к гипотенузе.`
  const sol = `Второй катет равен √(${c}²−${a}²) = ${b}. Высота к гипотенузе равна произведению катетов, делённому на гипотенузу: ${a}·${b}/${c} = ${fmtRat(a * b, c)}.`
  const A = [30, 158], C = [258, 158], B = [96, 44], H = footPerp(A, C, B), cen = [(A[0] + C[0] + B[0]) / 3, (A[1] + C[1] + B[1]) / 3]
  let g = `<polygon points="${[A, B, C].map((p2) => `${p2[0]},${p2[1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6" stroke-linejoin="round"/>`
  g += cSeg(B, H) + rightMark(B, A, C, 10) + vLabel(A, cen, "A") + vLabel(B, cen, "B") + vLabel(C, cen, "C")
  return { condition_text: cond, answer: fmtRat(a * b, c), image_url: q23(g), solution: sol }
}

// Q1 — высота ромба делит сторону: сторона = гипотенуза, высота = второй катет.
function t23RhombHeight() {
  const [m, n, r] = pick(PYTH23), t = pick([1, 2]), h = m * t, dh = n * t, s = r * t, ch = s - dh
  const cond = `Высота AH ромба ABCD делит сторону CD на отрезки DH=${dh} и CH=${ch}. Найдите высоту ромба.`
  const sol = `Сторона ромба CD = DH + CH = ${dh} + ${ch} = ${s}. AD = CD = ${s} (стороны ромба равны). В прямоугольном треугольнике ADH (∠AHD = 90°): AH = √(AD²−DH²) = √(${s}²−${dh}²) = ${h}.`
  // AB ∥ CD — противоположные стороны; CD — нижняя горизонтальная, высота AH ⊥ CD, H на CD.
  const k = Math.min(215 / (s + dh), 92 / h)         // горизонтальный размах = (s+dh)·k
  const D0 = [30, 150], C0 = [30 + s * k, 150], H0 = [30 + dh * k, 150], A0 = [30 + dh * k, 150 - h * k], B0 = [A0[0] + s * k, A0[1]]
  const pts = [A0, B0, C0, D0]                       // A(верх-слева) B(верх-справа) C(низ-справа) D(низ-слева)
  let g = cPoly(pts) + quadLabels(pts, N4()) + cSeg(A0, H0) + cDot(H0) + rightMark(H0, A0, D0, 8) + ptAt(H0, -8, 15, "H")
  return { condition_text: cond, answer: String(h), image_url: q23(g), solution: sol }
}

// Q2 — биссектрисы углов при боковой стороне трапеции ⟂ → AB = √(AF²+BF²).
function t23TrapBisLat() {
  const [m, n, r] = pick(PYTH23), t = pick([1, 2, 3]), af = m * t, bf = n * t, ab = r * t
  const cond = `Биссектрисы углов A и B при боковой стороне AB трапеции ABCD пересекаются в точке F. Найдите AB, если AF=${af}, BF=${bf}.`
  const sol = `Углы A и B при боковой стороне AB в сумме дают 180° (односторонние при AD ∥ BC), поэтому их половины дают 90°, и ∠AFB = 90°. В прямоугольном треугольнике AFB: AB = √(AF²+BF²) = √(${af}²+${bf}²) = ${ab}.`
  const A = [40, 150], B = [70, 45], C = [225, 45], D = [252, 150], pts = [A, B, C, D]
  const F2 = [110, 92]
  let g = cPoly(pts) + quadLabels(pts, N4()) + cSeg(A, F2) + cSeg(B, F2) + cDot(F2) + rightMark(F2, A, B, 8) + ptAt(F2, 12, 4, "F")
  return { condition_text: cond, answer: String(ab), image_url: q23(g), solution: sol }
}

// Q3 — прямая, параллельная основаниям: EF = (BC·DF + AD·CF)/(CF+DF).
function t23TrapParLine() {
  const c = randInt(2, 7), d = randInt(1, c - 1 < 1 ? 1 : c), rr = randInt(3, 9)
  const bc = (randInt(2, 6)) * (c + d), ad = bc + rr * (c + d)   // делится на (c+d) → EF целое
  const ef = (bc * d + ad * c) / (c + d)
  const cond = `Прямая, параллельная основаниям трапеции ABCD, пересекает её боковые стороны AB и CD в точках E и F соответственно. Найдите длину отрезка EF, если AD=${ad}, BC=${bc}, CF:DF=${c}:${d}.`
  const sol = `Отрезок EF параллелен основаниям и делит боковые стороны в отношении CF:DF = ${c}:${d}. Тогда EF = (BC·DF + AD·CF)/(CF+DF) = (${bc}·${d} + ${ad}·${c})/(${c}+${d}) = ${ef}.`
  const pts = trapPts([140, 100], 210, 80, 96), A = pts[0], B = pts[1], C = pts[2], D = pts[3]
  const F = [C[0] + (D[0] - C[0]) * (c / (c + d)), C[1] + (D[1] - C[1]) * (c / (c + d))]
  const E = [B[0] + (A[0] - B[0]) * (c / (c + d)), B[1] + (A[1] - B[1]) * (c / (c + d))]
  let g = cPoly(pts) + quadLabels(pts, N4()) + cSeg(E, F) + cDot(E) + cDot(F) + ptAt(E, -12, 2, "E") + ptAt(F, 12, 2, "F")
  return { condition_text: cond, answer: String(ef), image_url: q23(g), solution: sol }
}

// Q4 — биссектриса угла параллелограмма → периметр: AB=BK, AD=BK+CK, P=2(2BK+CK).
function t23ParaBisPerim() {
  const bk = randInt(3, 12), ck = randInt(bk + 1, 20), P = 2 * (2 * bk + ck)
  const cond = `Биссектриса угла A параллелограмма ABCD пересекает сторону BC в точке K. Найдите периметр параллелограмма, если BK=${bk}, CK=${ck}.`
  const sol = `∠BAK = ∠KAD (биссектриса) и ∠KAD = ∠AKB (накрест лежащие при AD ∥ BC), поэтому ∠BAK = ∠AKB и треугольник ABK равнобедренный: AB = BK = ${bk}. Сторона BC = BK + CK = ${bk} + ${ck} = ${bk + ck} = AD. Периметр = 2(AB + AD) = 2(${bk} + ${bk + ck}) = ${P}.`
  const A = [45, 150], B = [80, 55], C = [255, 55], D = [220, 150], pts = [A, B, C, D]
  const K = [B[0] + (C[0] - B[0]) * (bk / (bk + ck)), B[1]]
  let g = cPoly(pts) + quadLabels(pts, N4()) + cSeg(A, K) + cDot(K)
  g += angArc(A, B, K, 16, null, 1) + angArc(A, K, D, 16, null, 1) + ptAt(K, 0, -8, "K")
  return { condition_text: cond, answer: String(P), image_url: q23(g), solution: sol }
}

// Q5 — боковая сторона трапеции по двум углам при основании: AB = CD·sin β/sin α.
// sin(x) = √r/2, r: 30/150→1, 45/135→2, 60/120→3. Ответ = (CD/rα)·√(rα·rβ).
const SINR = { 30: 1, 150: 1, 45: 2, 135: 2, 60: 3, 120: 3 }
const Q5_PAIRS = [[30, 120], [60, 135], [45, 150], [45, 120], [30, 135], [60, 150], [30, 150], [45, 135]]
function t23TrapLatAngles() {
  const [al, be] = pick(Q5_PAIRS), ra = SINR[al], rb = SINR[be], R = ra * rb
  const cd = pick([3, 6, 9, 12]) * ra + (ra === 1 ? pick([0, 5, 8, 11, 14, 17]) : 0)   // делится на ra (ra=1 → любое)
  const coef = cd / ra
  const rootPart = R === 1 ? "" : `√${R}`
  const ans = R === 1 ? String(coef) : (coef === 1 ? rootPart : `${coef}${rootPart}`)
  const cond = `Найдите боковую сторону AB трапеции ABCD, если углы ABC и BCD равны соответственно ${al}° и ${be}°, а CD=${cd}.`
  const sol = `Проведём высоты из вершин меньшего основания. Высота трапеции h = AB·sin${al}° = CD·sin${be}°, поэтому AB = CD·sin${be}°/sin${al}° = ${cd}·(√${rb}/2)/(√${ra}/2) = ${ans}.`
  const pts = trapPts([140, 100], 200, 70, 92), A = pts[0], B = pts[1], C = pts[2], D = pts[3]
  let g = cPoly(pts) + quadLabels(pts, N4()) + angArc(B, A, C, 15, `${al}°`, 1) + angArc(C, B, D, 15, `${be}°`, 1)
  return { condition_text: cond, answer: ans, image_url: q23(g), solution: sol }
}

// Q6 — расстояние от центра ромба до стороны и диагональ → углы (в банке всегда 60°/120°).
function t23RhombAngles() {
  const dd = pick([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]), diag = 4 * dd
  const cond = `Расстояние от точки пересечения диагоналей ромба до одной из его сторон равно ${dd}, а одна из диагоналей ромба равна ${diag}. Найдите углы ромба.`
  const sol = `Пусть O — центр ромба, OP ⊥ AB, OP = ${dd}. Половина данной диагонали OA = ${diag}/2 = ${diag / 2}. В прямоугольном треугольнике OPA: sin∠OAP = OP/OA = ${dd}/${diag / 2} = 1/2, поэтому ∠OAP = 30°. Диагональ ромба — биссектриса угла, значит угол при вершине A равен 60°, а соседний угол равен 120°.`
  const O = [140, 100], a = 108, b = 42                            //半-диагонали (произвольно, для чертежа)
  const V = [[O[0] - a, O[1]], [O[0], O[1] - b], [O[0] + a, O[1]], [O[0], O[1] + b]]
  const P = footPerp(V[0], V[1], O)
  let g = cPoly(V) + quadLabels(V, ["A", "B", "C", "D"]) + cSeg(V[0], V[2]) + cSeg(V[1], V[3])
  g += cDot(O) + cSeg(O, P) + rightMark(P, O, V[0], 7) + ptAt(O, 8, 12, "O")
  return { condition_text: cond, answer: "60° и 120°", image_url: q23(g), solution: sol }
}

// C1 — окружность с диаметром BH пересекает катеты; PBKH — прямоугольник, PK = BH.
function t23CircDiam() {
  const v = randInt(11, 15), askPK = pick([true, false])
  const cond = askPK
    ? `Точка H является основанием высоты BH, проведённой из вершины прямого угла B прямоугольного треугольника ABC. Окружность с диаметром BH пересекает стороны AB и CB в точках P и K соответственно. Найдите PK, если BH=${v}.`
    : `Точка H является основанием высоты BH, проведённой из вершины прямого угла B прямоугольного треугольника ABC. Окружность с диаметром BH пересекает стороны AB и CB в точках P и K соответственно. Найдите BH, если PK=${v}.`
  const sol = `∠BPH и ∠BKH опираются на диаметр BH, поэтому равны 90°: HP ⊥ AB, HK ⊥ CB. В четырёхугольнике PBKH три прямых угла (при P, B, K), значит это прямоугольник, а его диагонали равны: PK = BH. ${askPK ? `PK = ${v}.` : `BH = ${v}.`}`
  const A = [30, 158], C = [258, 158], B = [96, 44], H = footPerp(A, C, B)
  const P = footPerp(A, B, H), K = footPerp(C, B, H), cen = [(A[0] + C[0] + B[0]) / 3, (A[1] + C[1] + B[1]) / 3]
  let g = `<polygon points="${[A, B, C].map((p2) => `${p2[0]},${p2[1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6" stroke-linejoin="round"/>`
  g += cSeg(B, H) + cCircle(gmid(B, H), Math.hypot(B[0] - H[0], B[1] - H[1]) / 2) + cSeg(P, K)
  g += cDot(H) + cDot(P) + cDot(K) + rightMark(B, A, C, 9)
  g += vLabel(A, cen, "A") + vLabel(B, cen, "B") + vLabel(C, cen, "C") + ptAt(H, 0, 14, "H") + ptAt(P, -10, 0, "P") + ptAt(K, 8, 8, "K")
  return { condition_text: cond, answer: String(v), image_url: q23(g), solution: sol }
}

// C2 — две хорды и расстояния до них; общий R связывает их: R² = (хорда/2)² + расстояние².
function t23TwoChords() {
  const [p, q, R] = pick([[15, 20, 25], [7, 24, 25], [5, 12, 13], [8, 15, 17], [20, 21, 29], [12, 16, 20], [9, 12, 15]])
  const ab = 2 * p, dAB = q, cd = 2 * q, dCD = p
  const askLen = pick([true, false])
  const cond = askLen
    ? `Отрезки AB и CD являются хордами окружности. Найдите длину хорды CD, если AB=${ab}, а расстояния от центра окружности до хорд AB и CD равны соответственно ${dAB} и ${dCD}.`
    : `Отрезки AB и CD являются хордами окружности. Найдите расстояние от центра окружности до хорды CD, если AB=${ab}, CD=${cd}, а расстояние от центра окружности до хорды AB равно ${dAB}.`
  const sol = askLen
    ? `Радиус: R² = (AB/2)² + ${dAB}² = ${p}² + ${dAB}² = ${R}², R = ${R}. Тогда полухорда CD/2 = √(R²−${dCD}²) = √(${R}²−${dCD}²) = ${q}, поэтому CD = ${cd}.`
    : `Радиус: R² = (AB/2)² + ${dAB}² = ${p}² + ${dAB}² = ${R}², R = ${R}. Расстояние до CD = √(R²−(CD/2)²) = √(${R}²−${q}²) = ${p}.`
  const O = [140, 105]
  let g = cCircle(O, 78) + cDot(O) + ptAt(O, 0, -8, "O")
  const yAB = O[1] - 78 * (dAB / R), yCD = O[1] + 78 * (dCD / R)
  const chord = (y, half) => { const dx = 78 * (half / R); return [[O[0] - dx, y], [O[0] + dx, y]] }
  const [a1, a2] = chord(yAB, p), [c1, c2] = chord(yCD, q)
  g += cSeg(a1, a2) + cSeg(c1, c2) + cSeg(O, gmid(a1, a2)) + cSeg(O, gmid(c1, c2))
  g += rightMark(gmid(a1, a2), O, a1, 6) + rightMark(gmid(c1, c2), O, c1, 6)
  g += ptAt(a1, -8, 0, "A") + ptAt(a2, 8, 0, "B") + ptAt(c1, -8, 4, "C") + ptAt(c2, 8, 4, "D")
  return { condition_text: cond, answer: askLen ? String(cd) : String(dCD), image_url: q23(g), solution: sol }
}

// P1 — отрезки на параллельных прямых, «бабочка»: MC = AC·DC/(AB+DC).
function t23ParallelX() {
  const ab = randInt(10, 18), t = pick([2, 3, 4, 5]), dc = ab * t
  // AC берём кратным (AB+DC)/НОД, чтобы MC = AC·DC/(AB+DC) было целым
  const g0 = gcd(dc, ab + dc), step = (ab + dc) / g0
  const acFinal = step * pick([2, 3, 4, 5, 6])
  const mc = acFinal * dc / (ab + dc)
  const cond = `Отрезки AB и DC лежат на параллельных прямых, а отрезки AC и BD пересекаются в точке M. Найдите MC, если AB=${ab}, DC=${dc}, AC=${acFinal}.`
  const sol = `Так как AB ∥ DC, треугольники ABM и CDM подобны (накрест лежащие углы при секущих AC и BD равны). Значит, MC : MA = DC : AB, откуда MC = AC·DC/(AB+DC) = ${acFinal}·${dc}/(${ab}+${dc}) = ${mc}.`
  const A = [40, 45], B = [210, 45], Cc = [255, 165], Dd = [70, 165]
  const M = segInt(A, Cc, B, Dd)
  let g = cSeg(A, B) + cSeg(Dd, Cc) + cSeg(A, Cc) + cSeg(B, Dd) + cDot(M)
  g += ptAt(A, -8, 0, "A") + ptAt(B, 8, 0, "B") + ptAt(Cc, 8, 4, "C") + ptAt(Dd, -8, 4, "D") + ptAt(M, 6, 12, "M")
  return { condition_text: cond, answer: String(mc), image_url: q23(g), solution: sol }
}

// ── Шаблоны ОГЭ №25 (часть 2 — геометрическая задача повышенной сложности) ────────
// Тот же принцип, что и №23/№24 (чертёж прячем в solution_image, решение — в solution).
// Ответ — число или точное выражение (дробь / радикал `k√m` / список сторон / «a и b»).
// КАЖДАЯ формула выведена и сверена с числовыми наборами банка ФИПИ.
const q25 = q24
function simpRoot(n) { let c = 1, r = n, d = 2; while (d * d <= r) { while (r % (d * d) === 0) { r /= d * d; c *= d } d++ } return [c, r] }
function rootStr(n) { const [c, r] = simpRoot(n); return r === 1 ? String(c) : (c === 1 ? `√${r}` : `${c}√${r}`) }
const PT25 = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [6, 8, 10], [12, 16, 20], [10, 24, 26], [15, 20, 25]]

// Т1 — биссектрисы углов A и B параллелограмма → площадь = 2·BC·d.
function t25ParaBisArea() {
  const bc = randInt(2, 16), d = randInt(1, 10)
  const cond = `Биссектрисы углов A и B параллелограмма ABCD пересекаются в точке K. Найдите площадь параллелограмма, если BC=${bc}, а расстояние от точки K до стороны AB равно ${d}.`
  const sol = `∠A+∠B=180°, поэтому их половины дают 90° и ∠AKB=90°. K лежит на биссектрисе ∠A (равноудалена от AB и AD) и ∠B (равноудалена от AB и BC), значит K равноудалена от AD и BC, а расстояние между этими сторонами равно 2·${d}. Площадь = BC·(2·${d}) = 2·${bc}·${d} = ${2 * bc * d}.`
  const A = [45, 150], B = [95, 55], C = [255, 55], D = [205, 150], pts = [A, B, C, D], K = [120, 110]
  let g = cPoly(pts) + quadLabels(pts, N4()) + cSeg(A, K) + cSeg(B, K) + cDot(K) + ptAt(K, 8, 4, "K")
  g += angArc(A, B, K, 14, null, 1) + angArc(A, K, D, 14, null, 1) + angArc(B, A, K, 14, null, 1) + angArc(B, K, C, 14, null, 1)
  return { condition_text: cond, answer: String(2 * bc * d), image_url: q25(g), solution: sol }
}

// Т2 — углы при основании α+β=90; отрезки середин m>n → основания m+n и m−n.
function t25TrapAnglesMid() {
  const al = randInt(20, 70), be = 90 - al, n = randInt(2, 12), m = n + randInt(2, 14)
  const cond = `Углы при одном из оснований трапеции равны ${al}° и ${be}°, а отрезки, соединяющие середины противоположных сторон трапеции, равны ${m} и ${n}. Найдите основания трапеции.`
  const sol = `Так как углы при основании в сумме дают 90°, продолжения боковых сторон пересекаются под прямым углом в точке P. Отрезок, соединяющий середины боковых сторон, равен полусумме оснований, а отрезок между серединами оснований равен их полуразности. Значит (a+b)/2=${m}, (a−b)/2=${n}, откуда основания равны ${m + n} и ${m - n}.`
  const pts = trapPts([140, 100], 210, 90, 92), A = pts[0], B = pts[1], C = pts[2], D = pts[3]
  let g = cPoly(pts) + quadLabels(pts, N4()) + dseg(gmid(A, B), gmid(C, D)) + dseg(gmid(B, C), gmid(A, D))
  g += angArc(A, B, C, 15, `${al}°`, 1) + angArc(D, A, C, 15, `${be}°`, 1)
  return { condition_text: cond, answer: `${m + n} и ${m - n}`, image_url: q25(g), solution: sol }
}

// Т3 — прямоугольная трапеция, биссектриса ∠ADC через середину AB → площадь = ½·AB·CD.
function t25TrapBisMidArea() {
  const t = randInt(3, 12)
  const divs = []; for (let r = 1; r < t; r++) if ((t * t) % r === 0 && t * t / r !== r) divs.push(r)
  const r = pick(divs), a = t * t / r, ab = 2 * t, cd = a + r
  const cond = `Боковые стороны AB и CD трапеции ABCD равны соответственно ${ab} и ${cd}, а основание BC равно ${r}. Биссектриса угла ADC проходит через середину стороны AB. Найдите площадь трапеции.`
  const sol = `Условие выполняется для прямоугольной трапеции (AB ⊥ основаниям): AD = CD − BC = ${a}, высота равна AB = ${ab}. Площадь = ½·(BC+AD)·AB = ½·(${r}+${a})·${ab} = ½·${cd}·${ab} = ${ab * cd / 2}.`
  const B0 = [55, 55], A0 = [55, 155], D0 = [245, 155], C0 = [55 + (r / cd) * 190, 55]
  const pts = [A0, B0, C0, D0], M = gmid(A0, B0)
  let g = cPoly(pts) + quadLabels(pts, N4()) + cSeg(D0, M) + cDot(M) + rightMark(B0, A0, C0, 8) + ptAt(M, -10, 4, "M")
  return { condition_text: cond, answer: String(ab * cd / 2), image_url: q25(g), solution: sol }
}

// Т4 — середина AD равноудалена от вершин → ABCD вписан (диаметр AD); AD = 2·BC/|cos(∠B+∠C)|.
function t25MidEquidist() {
  const m = pick([3, 2, 1]), sum = m === 3 ? 210 : (m === 2 ? 225 : 240)
  const be = randInt(93, sum - 93), ga = sum - be
  const bc = m === 3 ? 3 * randInt(2, 8) : (m === 2 ? 2 * randInt(3, 12) : randInt(4, 16))
  const coef = 2 * bc / m
  const ans = m === 1 ? String(2 * bc) : (coef === 1 ? `√${m}` : `${coef}√${m}`)
  const cond = `Середина M стороны AD выпуклого четырёхугольника ABCD равноудалена от всех его вершин. Найдите AD, если BC=${bc}, а углы B и C четырёхугольника равны соответственно ${be}° и ${ga}°.`
  const sol = `MA=MB=MC=MD, поэтому все вершины лежат на окружности с центром M и диаметром AD. В этой окружности BC = AD·|cos(∠B+∠C)|, откуда AD = BC/|cos(${be}°+${ga}°)| = ${bc}/(√${m}/2) = ${ans}.`
  const O = [140, 118], R = 66
  const B1 = cPt(O, R, 150), C1 = cPt(O, R, 30), A1 = [O[0] - R, O[1]], D1 = [O[0] + R, O[1]]
  let g = cCircle(O, R) + cPoly([A1, B1, C1, D1]) + cDot(O)
  g += ptAt(A1, -10, 4, "A") + ptAt(B1, -4, -6, "B") + ptAt(C1, 6, -6, "C") + ptAt(D1, 10, 4, "D") + ptAt(O, 0, 14, "M")
  return { condition_text: cond, answer: ans, image_url: q25(g), solution: sol }
}

// Т5 — углы B,C (сумма 150 → ∠A=30) и R → BC = 2R·sin30 = R.
function t25AnglesR() {
  const be = randInt(50, 100), ga = 150 - be, R = randInt(6, 20)
  const cond = `Углы B и C треугольника ABC равны соответственно ${be}° и ${ga}°. Найдите BC, если радиус окружности, описанной около треугольника ABC, равен ${R}.`
  const sol = `∠A = 180°−${be}°−${ga}° = 30°. По теореме синусов BC = 2R·sin∠A = 2·${R}·sin30° = ${R}.`
  const V = { A: [140, 30], B: [40, 165], C: [245, 165] }, O = [142, 118]
  let g = cCircle(O, 92) + `<polygon points="${["A", "B", "C"].map((n) => `${V[n][0]},${V[n][1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6"/>`
  g += vLabel(V.A, O, "A") + vLabel(V.B, O, "B") + vLabel(V.C, O, "C") + cDot(O) + ptAt(O, 8, 4, "O")
  return { condition_text: cond, answer: String(R), image_url: q25(g), solution: sol }
}

// Т6 — полуокружность на BC, ортоцентр: AH = (AD²−MD²)/AD.
function t25SemicircleOrtho() {
  const ad = randInt(8, 40), md = randInt(2, ad - 2)
  const cond = `На стороне BC остроугольного треугольника ABC как на диаметре построена полуокружность, пересекающая высоту AD в точке M, AD=${ad}, MD=${md}, H — точка пересечения высот треугольника ABC. Найдите AH.`
  const sol = `M на окружности с диаметром BC ⇒ ∠BMC=90°, и MD²=BD·DC. Для ортоцентра DH·DA=BD·DC, поэтому DH=MD²/AD. Тогда AH = AD−DH = (AD²−MD²)/AD = (${ad}²−${md}²)/${ad} = ${fmtRat(ad * ad - md * md, ad)}.`
  const A = [120, 30], B = [40, 160], C = [235, 160], D = footPerp(B, C, A), cen = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3]
  const M = [D[0], D[1] - (ad - md) / ad * (D[1] - A[1])]
  let g = `<polygon points="${[A, B, C].map((p) => `${p[0]},${p[1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6"/>`
  g += cSeg(A, D) + cCircle(gmid(B, C), Math.hypot(B[0] - C[0], B[1] - C[1]) / 2) + cDot(M) + cDot(D)
  g += vLabel(A, cen, "A") + vLabel(B, cen, "B") + vLabel(C, cen, "C") + ptAt(D, 0, 14, "D") + ptAt(M, 10, 2, "M")
  return { condition_text: cond, answer: fmtRat(ad * ad - md * md, ad), image_url: q25(g), solution: sol }
}

// Т7 — прямоуг. трапеция, окружность через C,D касается AB в E → расст(E,CD)=√(AD·BC).
function t25RightTrapTangent() {
  const bc = randInt(2, 12), ad = bc + randInt(2, 12)
  const cond = `В трапеции ABCD боковая сторона AB перпендикулярна основанию BC. Окружность проходит через точки C и D и касается прямой AB в точке E. Найдите расстояние от точки E до прямой CD, если AD=${ad}, BC=${bc}.`
  const sol = `Пусть d — расстояние от E до CD. Используя касание окружности к AB в точке E и проекции на AB, получаем d² = AD·BC = ${ad}·${bc} = ${ad * bc}. Значит d = √${ad * bc} = ${rootStr(ad * bc)}.`
  const B0 = [60, 155], A0 = [60, 45], C0 = [60 + bc * 12, 155], D0 = [60 + ad * 12, 45], E0 = [60, 100]
  let g = cPoly([A0, B0, C0, D0]) + quadLabels([A0, B0, C0, D0], N4()) + cDot(E0) + cSeg(C0, D0) + ptAt(E0, -10, 4, "E") + rightMark(B0, A0, C0, 8)
  return { condition_text: cond, answer: rootStr(ad * bc), image_url: q25(g), solution: sol }
}

// Т8 — равноб. трапеция со вписанной окр.: c=P/4, h=4S/P, hd=√(c²−h²) → расст = h·(c−hd)/(2c).
function t25IsoTrapIncircle() {
  const [h, hd, c] = pick(PT25.filter((t) => t[0] < t[2] && t[1] < t[2])), k = pick([2, 3, 4, 5])
  const H = h * k, HD = hd * k, C = c * k, P = 4 * C, S = C * H, b = C - HD
  const cond = `В равнобедренную трапецию, периметр которой равен ${P}, а площадь равна ${S}, можно вписать окружность. Найдите расстояние от точки пересечения диагоналей трапеции до её меньшего основания.`
  const sol = `Для вписанной окружности сумма оснований равна сумме боковых, поэтому боковая = P/4 = ${C}, высота h = 4S/P = ${H}. Полуразность оснований = √(${C}²−${H}²) = ${HD}, меньшее основание b = ${C}−${HD} = ${b}. Точка пересечения диагоналей делит высоту в отношении оснований, расстояние до меньшего основания = h·b/(a+b) = ${H}·${b}/${2 * C} = ${fmtRat(H * b, 2 * C)}.`
  const pts = trapPts([140, 105], 60 + HD * 3, 60, 84)
  let g = cPoly(pts) + quadLabels(pts, N4()) + cSeg(pts[0], pts[2]) + cSeg(pts[1], pts[3]) + cCircle([140, 105], 42)
  return { condition_text: cond, answer: fmtRat(H * b, 2 * C), image_url: q25(g), solution: sol }
}

// Т9 — биссектриса A делит высоту из B в отношении p:q → cos∠A=q/p; R = BC·p/(2·s), s=√(p²−q²).
function t25BisAltR() {
  // только примитивные тройки → отношение p:q несократимо (как в банке ФИПИ)
  const tri = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]])
  const p = tri[2], q = pick([tri[0], tri[1]]), s = q === tri[0] ? tri[1] : tri[0]
  const k = pick([1, 2, 3]), bc = 2 * s * k, R = p * k
  const cond = `В треугольнике ABC биссектриса угла A делит высоту, проведённую из вершины B, в отношении ${p}:${q}, считая от точки B. Найдите радиус окружности, описанной около треугольника ABC, если BC=${bc}.`
  const sol = `Пусть высота из B — BK, а биссектриса ∠A пересекает её в точке L. Тогда BL:LK = 1:cos∠A, поэтому cos∠A = ${q}/${p}, sin∠A = ${s}/${p}. По теореме синусов R = BC/(2·sin∠A) = ${bc}/(2·${s}/${p}) = ${R}.`
  const V = { A: [40, 160], B: [120, 30], C: [250, 160] }, cen = [136, 116], K = footPerp(V.A, V.C, V.B)
  let g = `<polygon points="${["A", "B", "C"].map((n) => `${V[n][0]},${V[n][1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6"/>`
  g += cSeg(V.B, K) + cSeg(V.A, [V.A[0] + 120, V.A[1] - 30]) + cDot(K) + vLabel(V.A, cen, "A") + vLabel(V.B, cen, "B") + vLabel(V.C, cen, "C")
  return { condition_text: cond, answer: String(R), image_url: q25(g), solution: sol }
}

// Т10 — две внешне касающиеся окружности, общие касательные → расст = 2(r1²+r2²)/(r1+r2).
function t25TwoTangentCircles() {
  let r1, r2
  do { r1 = randInt(3, 60); r2 = randInt(3, 60) } while (r1 === r2 || (2 * (r1 * r1 + r2 * r2)) % (r1 + r2) !== 0)
  const ans = 2 * (r1 * r1 + r2 * r2) / (r1 + r2)
  const cond = `Окружности радиусов ${r1} и ${r2} касаются внешним образом. Точки A и B лежат на первой окружности, точки C и D — на второй. При этом AC и BD — общие касательные окружностей. Найдите расстояние между прямыми AB и CD.`
  const sol = `AB и CD — хорды, соединяющие точки касания на каждой окружности; обе перпендикулярны линии центров. Вычисляя положения точек касания вдоль линии центров, получаем расстояние = 2(r1²+r2²)/(r1+r2) = 2(${r1}²+${r2}²)/(${r1}+${r2}) = ${ans}.`
  const s = Math.min(1, 70 / (r1 + r2)), c1 = [70, 110], R1 = r1 * s * 1.4, c2 = [70 + (r1 + r2) * s * 1.4, 110], R2 = r2 * s * 1.4
  let g = cCircle(c1, R1) + cCircle(c2, R2) + cSeg(c1, c2) + cDot(c1) + cDot(c2)
  return { condition_text: cond, answer: String(ans), image_url: q25(g), solution: sol }
}

// Т11 — вписанный 4-угольник, ∠AKB=60° → R = √((AB²+CD²+AB·CD)/3).
function t25CyclicDiagR() {
  let p, q, N
  do { p = randInt(4, 45); q = randInt(4, 45); N = (p * p + q * q + p * q) } while (p === q || N % 3 !== 0 || (simpRoot(N / 3)[0] === 1 && simpRoot(N / 3)[1] !== 1))
  const R = rootStr(N / 3)
  const cond = `Четырёхугольник ABCD со сторонами AB=${p} и CD=${q} вписан в окружность. Диагонали AC и BD пересекаются в точке K, причём ∠AKB=60°. Найдите радиус окружности, описанной около этого четырёхугольника.`
  const sol = `Угол между диагоналями равен полусумме дуг AB и CD: если AB=2R·sinβ, CD=2R·sinδ, то β+δ=60°. Исключая углы, получаем R² = (AB²+CD²+AB·CD)/3 = (${p}²+${q}²+${p}·${q})/3 = ${N / 3}, R = ${R}.`
  const O = [140, 115], R0 = 78
  const A1 = cPt(O, R0, 160), B1 = cPt(O, R0, 60), C1 = cPt(O, R0, -20), D1 = cPt(O, R0, 235)
  let g = cCircle(O, R0) + cPoly([A1, B1, C1, D1]) + cSeg(A1, C1) + cSeg(B1, D1) + cDot(O)
  g += ptAt(A1, -8, 2, "A") + ptAt(B1, 6, -4, "B") + ptAt(C1, 8, 4, "C") + ptAt(D1, -6, 8, "D")
  return { condition_text: cond, answer: R, image_url: q25(g), solution: sol }
}

// Т12 — центр описанной O, BD⊥AO, D на AC → CD = (AC²−AB²)/AC.
function t25CircumPerpCD() {
  let ab, ac
  do { ab = randInt(6, 40); ac = randInt(ab + 2, 100) } while ((ab * ab) % ac !== 0)
  const cd = (ac * ac - ab * ab) / ac
  const cond = `В треугольнике ABC известны длины сторон AB=${ab}, AC=${ac}, точка O — центр окружности, описанной около треугольника ABC. Прямая BD, перпендикулярная прямой AO, пересекает сторону AC в точке D. Найдите CD.`
  const sol = `BD ⊥ AO, а AO ⊥ касательной в точке A, поэтому BD параллельна касательной в A. Тогда ∠ADB = ∠ABC, и △ABD ∼ △ACB (общий угол A). Отсюда AD = AB²/AC = ${ab * ab}/${ac} = ${ab * ab / ac}, и CD = AC−AD = ${ac}−${ab * ab / ac} = ${cd}.`
  const V = { A: [40, 160], B: [110, 40], C: [250, 160] }, cen = [133, 120]
  const D = [V.A[0] + (V.C[0] - V.A[0]) * (ab * ab / ac) / ac, V.A[1]]
  let g = `<polygon points="${["A", "B", "C"].map((n) => `${V[n][0]},${V[n][1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6"/>`
  g += cSeg(V.B, D) + cDot(D) + vLabel(V.A, cen, "A") + vLabel(V.B, cen, "B") + vLabel(V.C, cen, "C") + ptAt(D, 0, 14, "D")
  return { condition_text: cond, answer: String(cd), image_url: q25(g), solution: sol }
}

// Т13 — трапеция, сумма углов при AD =90° → R = AB·(AD+BC)/(2(AD−BC)).
function t25TrapSum90R() {
  const bc = randInt(4, 20), ad = bc + 2 * randInt(2, 14), ab = randInt(7, 24)
  const cond = `В трапеции ABCD основания AD и BC равны соответственно ${ad} и ${bc}, а сумма углов при основании AD равна 90°. Найдите радиус окружности, проходящей через точки A и B и касающейся прямой CD, если AB=${ab}.`
  const sol = `Продолжения боковых сторон пересекаются под прямым углом в точке P (сумма углов при AD равна 90°). В прямоугольной системе с вершиной P прямая CD оказывается касательной, а окружность через A и B её касается; её радиус R = AB·(AD+BC)/(2(AD−BC)) = ${ab}·(${ad}+${bc})/(2·(${ad}−${bc})) = ${fmtRat(ab * (ad + bc), 2 * (ad - bc))}.`
  const pts = trapPts([140, 110], 210, 70, 90)
  let g = cPoly(pts) + quadLabels(pts, N4())
  return { condition_text: cond, answer: fmtRat(ab * (ad + bc), 2 * (ad - bc)), image_url: q25(g), solution: sol }
}

// Т14 — параллелограмм, O — центр вписанной в ABC окр.; расст. до A, AD, AC → площадь.
function t25ParaIncircleArea() {
  const [d2, w, dA] = pick(PT25.filter((t) => t[0] < t[2])), d1 = d2 + pick([1, 2, 3, 4, 6])
  const areaNum = 2 * d2 * w * (d1 + d2), denom = d1 - d2
  const cond = `В параллелограмме ABCD проведена диагональ AC. Точка O является центром окружности, вписанной в треугольник ABC. Расстояния от точки O до точки A и прямых AD и AC соответственно равны ${dA}, ${d1} и ${d2}. Найдите площадь параллелограмма ABCD.`
  const sol = `Радиус вписанной окружности r = ${d2} (расстояние до AC). Расстояния до AD и до BC (=r) дают высоту треугольника из вершины A: h = ${d1}+${d2} = ${d1 + d2}. Из AO и r находим сторону BC = 2·r·√(AO²−r²)/(${d1}−${d2}) = ${2 * d2 * w}/${denom}, а площадь параллелограмма = BC·h = ${fmtRat(areaNum, denom)}.`
  const A = [45, 150], B = [95, 55], C = [255, 55], D = [205, 150], pts = [A, B, C, D]
  let g = cPoly(pts) + quadLabels(pts, N4()) + cSeg(A, C) + cDot([110, 108]) + ptAt([110, 108], 6, 8, "O")
  return { condition_text: cond, answer: fmtRat(areaNum, denom), image_url: q25(g), solution: sol }
}

// Т15 — M,N на AC, окружность через M,N касается луча AB → r = (p(m+n)/2 − √(mnk))/√(p²−k).
function t25MNradius() {
  let m, n, k, p, j, root
  for (; ;) {
    p = randInt(3, 9); j = randInt(1, p - 1); k = p * p - j * j
    m = randInt(3, 20); n = m + randInt(1, 30)
    const mnk = m * n * k; root = Math.round(Math.sqrt(mnk))
    if (root * root === mnk && p * (m + n) - 2 * root > 0) break
  }
  const rNum = p * (m + n) - 2 * root, rDen = 2 * j, cosStr = `${rootStr(k)}/${p}`
  const cond = `Точки M и N лежат на стороне AC треугольника ABC на расстояниях соответственно ${m} и ${n} от вершины A. Найдите радиус окружности, проходящей через точки M и N и касающейся луча AB, если cos∠BAC=${cosStr}.`
  const sol = `Пусть окружность касается AB в точке T; тогда AT²=AM·AN=${m * n} (степень точки A). Центр проецируется в середину MN (на расстоянии ${(m + n) / 2} от A), а расстояние от центра до AB равно радиусу. Отсюда r = (${p}·${(m + n) / 2} − √(${m}·${n}·${k}))/√(${p}²−${k}) = ${fmtRat(rNum, rDen)}.`
  const A = [40, 150], Cc = [250, 150], Mp = [40 + (m / (n + 4)) * 200, 150], Np = [40 + (n / (n + 4)) * 200, 150], Bp = [150, 45]
  let g = cSeg(A, Cc) + cSeg(A, Bp) + cDot(Mp) + cDot(Np) + ptAt(A, -8, 4, "A") + ptAt(Cc, 8, 4, "C") + ptAt(Bp, 0, -6, "B") + ptAt(Mp, 0, 14, "M") + ptAt(Np, 0, 14, "N")
  return { condition_text: cond, answer: fmtRat(rNum, rDen), image_url: q25(g), solution: sol }
}

// Т16 — биссектриса BE ⊥ медиане AD, равны L → стороны √13·L/4, √13·L/2, 3√5·L/4.
function t25BisMedian() {
  const L = 4 * randInt(2, 12)
  const cond = `В треугольнике ABC биссектриса BE и медиана AD перпендикулярны и имеют одинаковую длину, равную ${L}. Найдите стороны треугольника ABC.`
  const sol = `Из перпендикулярности биссектрисы BE и медианы AD следует BC = 2·AB. Обозначив ∠B=2β, из равенства длин BE и AD получаем tg β = 2/3. Тогда AB = ${L / 4}√13, BC = ${L / 2}√13, AC = ${3 * L / 4}√5.`
  const V = { A: [40, 160], B: [120, 40], C: [250, 150] }, cen = [136, 116], D = gmid(V.B, V.C)
  let g = `<polygon points="${["A", "B", "C"].map((n) => `${V[n][0]},${V[n][1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6"/>`
  g += cSeg(V.A, D) + cDot(D) + vLabel(V.A, cen, "A") + vLabel(V.B, cen, "B") + vLabel(V.C, cen, "C") + ptAt(D, 8, 4, "D")
  return { condition_text: cond, answer: `AB = ${L / 4}√13, BC = ${L / 2}√13, AC = ${3 * L / 4}√5`, image_url: q25(g), solution: sol }
}

// Т17/18 — окружность через B,C пересекает AB,AC в K,P → KP = данный отрезок / отношение.
function t25CircBCkp() {
  const ratios = [["1,2", 6, 5], ["1,4", 7, 5], ["1,5", 3, 2], ["1,6", 8, 5], ["1,8", 9, 5], ["2", 2, 1], ["3", 3, 1]]
  const [rs, rn, rd] = pick(ratios), kp = rd * randInt(2, 9), seg = kp * rn / rd, form = pick([1, 2])
  const cond = form === 1
    ? `Окружность пересекает стороны AB и AC треугольника ABC в точках K и P соответственно и проходит через вершины B и C. Найдите длину отрезка KP, если AK=${seg}, а сторона AC в ${rs} раза больше стороны BC.`
    : `Окружность пересекает стороны AB и AC треугольника ABC в точках K и P соответственно и проходит через вершины B и C. Найдите длину отрезка KP, если AP=${seg}, а сторона AB в ${rs} раза больше стороны BC.`
  const sol = `Точки B, K, P, C лежат на одной окружности, поэтому ∠AKP=∠ACB и △AKP ∼ △ACB. Значит KP/CB = ${form === 1 ? "AK/AC" : "AP/AB"} = 1/${rs}, откуда KP = ${seg}/${rs} = ${kp}.`
  const V = { A: [140, 30], B: [40, 165], C: [245, 165] }, cen = [142, 120]
  const K = [V.A[0] + (V.B[0] - V.A[0]) * 0.45, V.A[1] + (V.B[1] - V.A[1]) * 0.45], P = [V.A[0] + (V.C[0] - V.A[0]) * 0.45, V.A[1] + (V.C[1] - V.A[1]) * 0.45]
  let g = `<polygon points="${["A", "B", "C"].map((n) => `${V[n][0]},${V[n][1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6"/>`
  g += cSeg(K, P) + cDot(K) + cDot(P) + vLabel(V.A, cen, "A") + vLabel(V.B, cen, "B") + vLabel(V.C, cen, "C") + ptAt(K, -10, 2, "K") + ptAt(P, 10, 2, "P")
  return { condition_text: cond, answer: String(kp), image_url: q25(g), solution: sol }
}

// Т19/20 — окружность с центром на AC через C касается AB в B → диаметр=(AC²−AB²)/AC (или найти AC).
function t25CircCenterAC() {
  let ab, ac
  do { ab = randInt(1, 15); ac = randInt(ab + 1, 20) } while (ac * ac - ab * ab <= 0)
  const diam = fmtRat(ac * ac - ab * ab, ac), form = pick([1, 2])
  const cond = form === 1
    ? `Окружность с центром на стороне AC треугольника ABC проходит через вершину C и касается прямой AB в точке B. Найдите диаметр окружности, если AB=${ab}, AC=${ac}.`
    : `Окружность с центром на стороне AC треугольника ABC проходит через вершину C и касается прямой AB в точке B. Найдите AC, если диаметр окружности равен ${diam}, а AB=${ab}.`
  const sol = form === 1
    ? `Центр O лежит на AC, OB⊥AB (касание), OB=OC=R. В прямоугольном △ABO: AB²+R²=(AC−R)², откуда диаметр 2R = (AC²−AB²)/AC = (${ac}²−${ab}²)/${ac} = ${diam}.`
    : `Центр O лежит на AC, OB⊥AB, OB=OC=R. Из AB²+R²=(AC−R)² следует AC²−(2R)·AC−AB²=0. Подставляя 2R=${diam}, AB=${ab}, получаем AC=${ac}.`
  const ans = form === 1 ? diam : String(ac)
  const V = { A: [30, 160], B: [110, 60], C: [250, 160] }, cen = [130, 127], O = [155, 160]
  let g = `<polygon points="${["A", "B", "C"].map((n) => `${V[n][0]},${V[n][1]}`).join(" ")}" fill="none" stroke="${G_S}" stroke-width="1.6"/>`
  g += cCircle(O, Math.hypot(O[0] - V.C[0], O[1] - V.C[1])) + cSeg(O, V.B) + cDot(O) + rightMark(V.B, V.A, O, 7)
  g += vLabel(V.A, cen, "A") + vLabel(V.B, cen, "B") + vLabel(V.C, cen, "C") + ptAt(O, 0, 14, "O")
  return { condition_text: cond, answer: ans, image_url: q25(g), solution: sol }
}

const GENERATORS = {
  "ОГЭ": {
    6: [tFracAddSub, tFracMul, tFracDiv, tDecAddSub, tDecMul, tDecDiv, t6Reciprocal],
    7: [tBetweenIntFrac, tBetweenIntSqrt, tIntervalFrac, tBetweenFracs, t7CoordPoints, t7SqrtPoint, t7Statements, t7NumMarked, t7SingleNumber, t7Diffs, t7SqrtInterval],
    8: [t8PowerMulDiv, t8PowerPow, t8Roots, t8RootPow, t8Conjugate, t8Distrib, t8CoefRoots, t8NegPow, t8PowFrac,
      t8CoefSq, t8RootQuot, t8SqBinom, t8RootMono, t8RootSign, t8Trinom, t8TwoVar, t8PowerVar, t8NumPow, t8Mixed10, t8ParenMulPow],
    9: [t9Linear, t9LinearInt, t9Quad, t9QuadLead, t9Factor, t9BothSides],
    12: [t12Power, t12Kinetic, t12Potential, t12Centripetal, t12QuadArea, t12Archimedes, t12Well, t12F2C, t12C2F],
    11: [t11Signs, t11SignsParab, t11Linear, t11Mixed],
    13: [t13Quad, t13LinearText, t13SystemPic, t13Product, t13Coef, t13ByPicture],
    14: [t14ArithTerm, t14ArithSum, t14TwoRows, t14Braking, t14Train, t14Cooling, t14GeomHalf, t14Bacteria, t14Ball],
    10: [tCups, tMarkers, tPencils, tTickets, tFlashlights, tPen, tCoin, tEqui, tTaxi, tGifts, tPensMulti, tSkiers, t10Euler, t10EulerB, t10EulerC, t10EulerD, t10Tree],
    15: [t15AngTwo, t15AngRight, t15AngExt, t15AngIso, t15AngBis, t15AngHeight, t15AngBisEq, t15AngMedEq, t15Median, t15Midline, t15Pyth, t15PythLeg, t15Equi, t15AreaBH, t15AreaLegs, t15AreaSin, t15TrigFind, t15TrigInv],
    16: [t16InsAngle, t16Diam, t16DiamInv, t16Diameter2, t16CyclicQuad, t16CyclicOpp, t16CyclicTrap, t16Tangents, t16CenterOnAB,
      t16SqInscR, t16SqAroundR, t16SqInscDiag, t16TrapInscR, t16Pitot, t16EquiInscR, t16EquiInscSide, t16IncircleArea, t16RhombInscR,
      t16SqCircR, t16SqCircSide, t16EquiCircR, t16EquiCircSide, t16CenterOnABLeg, t16RightCircR, t16CircLawSin, t16EquiDistSide, t16RectDiag, t16SqOMid],
    17: [t17ParaAngle, t17ParaAreaFig, t17RhombAngle, t17TrapAngleIso, t17TrapAngleRight, t17TrapAngleSum, t17ParaBisector, t17ParaDiag, t17ParaDiagO, t17RectDiagO, t17RectDiagAngle,
      t17RhombACD, t17RhombHeight, t17RhombAreaP, t17RhombAreaDiag, t17RhombSmallDiag, t17RhombHeightDiag, t17RhombPerp, t17SquareDiag,
      t17TrapMidline, t17TrapArea, t17TrapFoot, t17TrapMidDiag, t17TrapDiag45, t17TrapFigure, t17TrapDiagBase, t17TrapDiagBaseAB, t17TrapBisector, t17TrapDiagLat, t17TrapBaseAngle45, t17ParaHeight],
    18: [t18Distance, t18Segment, t18RightTri, t18TriArea, t18TriMidline, t18ParaArea, t18RhombArea, t18RhombDiag, t18TrapArea, t18TrapMidline, t18TwoCircles, t18TwoCirclesTilt, t18SegRatio],
    19: [t19],
    20: [t20Expr, t20CubicGroup, t20Quartic, t20Biquad, t20CubicFactor, t20Radical, t20SumSquares, t20RecipX, t20RecipShift,
      t20SysAdd, t20SysProp, t20SysParabLine,
      t20IneqLinQuad, t20IneqQuadQuad, t20IneqRational, t20IneqRatX, t20IneqNoverX, t20IneqRecipCmp, t20IneqNegFrac, t20IneqSqRadical],
    21: [t21Race, t21Train, t21ThereBackStop, t21HalfSecond, t21AvgHalf, t21AvgThree, t21TowardStop,
      t21ShipCurrent, t21BoatUpstream, t21RaftBoat, t21Barge, t21WorkParts, t21WorkPipes,
      t21DriedFruit, t21TwoVessels, t21RunnersCircle],
    22: [t22PieceUp, t22PieceDown, t22PieceHyper, t22PieceHyperOne, t22PieceLin3,
      t22ModWup, t22ModMdown, t22ModCubic, t22ModAbsParab,
      t22RatParabHole, t22RatNegParab, t22RatAbs, t22RatShiftHyp, t22RatHyp, t22RatMax],
    23: [t23RightProj, t23ParaLine, t23LegsHeight, t23LegHypHeight,
      t23RhombHeight, t23TrapBisLat, t23TrapParLine, t23ParaBisPerim, t23TrapLatAngles, t23RhombAngles,
      t23CircDiam, t23TwoChords, t23ParallelX],
    24: [t24TriAltAngle, t24TriAltSim,
      t24ParaMidBis, t24TrapDiagSim, t24ParaInnerArea, t24CyclicAngles, t24TrapMidlineArea,
      t24ParaBisMid, t24TrapLatMidArea, t24QuadBisEquid, t24ParaCenterSeg, t24TrapDiagArea,
      t24CyclicExtSim, t24TangentRatio, t24RadicalPerp],
    25: [t25ParaBisArea, t25TrapAnglesMid, t25TrapBisMidArea, t25MidEquidist, t25AnglesR,
      t25SemicircleOrtho, t25RightTrapTangent, t25IsoTrapIncircle, t25BisAltR, t25TwoTangentCircles,
      t25CyclicDiagR, t25CircumPerpCD, t25TrapSum90R, t25ParaIncircleArea, t25MNradius,
      t25BisMedian, t25CircBCkp, t25CircCenterAC],
  },
}

// ОГЭ по информатике — отдельный предмет (генераторы в taskGeneratorsInf.js).
GENERATORS["ОГЭ Информатика"] = GENERATORS_INF
// ОГЭ по английскому языку — отдельный предмет (генераторы в taskGeneratorsEng.js).
GENERATORS["ОГЭ Английский"] = GENERATORS_ENG
// ОГЭ по русскому языку — отдельный предмет (генераторы в taskGeneratorsRus.js).
GENERATORS["ОГЭ Русский"] = GENERATORS_RUS
// ОГЭ по химии — отдельный предмет (генераторы в taskGeneratorsChem.js).
GENERATORS["ОГЭ Химия"] = GENERATORS_CHEM
// ОГЭ по обществознанию — отдельный предмет (генераторы в taskGeneratorsObsh.js).
GENERATORS["ОГЭ Обществознание"] = GENERATORS_OBSH
// ОГЭ по физике — отдельный предмет (генераторы в taskGeneratorsPhys.js).
GENERATORS["ОГЭ Физика"] = GENERATORS_PHYS
// ОГЭ по истории — отдельный предмет (генераторы в taskGeneratorsHist.js).
GENERATORS["ОГЭ История"] = GENERATORS_HIST
// ОГЭ по биологии — отдельный предмет (генераторы в taskGeneratorsBio.js).
GENERATORS["ОГЭ Биология"] = GENERATORS_BIO
// ОГЭ по литературе — банк реальных формулировок ФИПИ (taskGeneratorsLit.js).
GENERATORS["ОГЭ Литература"] = GENERATORS_LIT
// ОГЭ по географии — отдельный предмет (генераторы в taskGeneratorsGeo.js).
GENERATORS["ОГЭ География"] = GENERATORS_GEO
// ЕГЭ математика (базовый уровень) — отдельный предмет (taskGeneratorsEgeBase.js).
GENERATORS["ЕГЭ"] = GENERATORS_EGE_BASE
// ЕГЭ математика (профильный уровень) — отдельный предмет (taskGeneratorsEgeProf.js).
GENERATORS["ЕГЭ Профиль"] = GENERATORS_EGE_PROF

export function hasGenerators(examType, number) {
  return !!GENERATORS[examType]?.[number]?.length
}

// Разбиение генераторов номера на темы/типажи — для превью «Банк заданий»: репетитор
// листает и обновляет каждую тему отдельно. Элемент — [ключ, подпись, функция] (ссылка
// на функцию, а не .name — устойчиво к минификации). Тема — [название, [элементы…]].
const GEN_META = {
  "ОГЭ": {
    6: [["Обыкновенные дроби", [["frac-pm", "Сложение и вычитание", tFracAddSub], ["frac-mul", "Умножение", tFracMul], ["frac-div", "Деление", tFracDiv], ["reciprocal", "Обратная величина", t6Reciprocal]]],
      ["Десятичные дроби", [["dec-pm", "Сложение и вычитание", tDecAddSub], ["dec-mul", "Умножение", tDecMul], ["dec-div", "Деление", tDecDiv]]]],
    7: [["Оценка и сравнение", [["btw-int-frac", "Между целыми (дробь)", tBetweenIntFrac], ["btw-int-sqrt", "Между целыми (корень)", tBetweenIntSqrt], ["interval-frac", "В каком промежутке дробь", tIntervalFrac], ["btw-fracs", "Между дробями", tBetweenFracs]]],
      ["Точки на прямой", [["coord-points", "Соответствие точек", t7CoordPoints], ["sqrt-point", "Точка ↔ корень", t7SqrtPoint], ["num-marked", "Какому числу соответствует", t7NumMarked], ["sqrt-interval", "Корень в промежутке", t7SqrtInterval]]],
      ["Верные утверждения о числах", [["statements", "Числа a и b", t7Statements], ["single", "Одно число a", t7SingleNumber], ["diffs", "Знак разности", t7Diffs]]]],
    8: [["Степени", [["pow-muldiv", "Умножение/деление", t8PowerMulDiv], ["pow-pow", "Степень степени", t8PowerPow], ["neg-pow", "Отрицательная степень", t8NegPow], ["pow-frac", "Дробь степеней", t8PowFrac], ["distrib", "Раскрытие скобок", t8Distrib],
      ["power-var", "Степенной закон (при a=)", t8PowerVar], ["num-pow", "Числовые степени", t8NumPow], ["mixed-10", "10ⁿ/(2ᵃ5ᵇ)", t8Mixed10], ["paren-mul-pow", "(p·q)ⁿ/(pᵃqᵇ)", t8ParenMulPow], ["two-var", "Две переменные (b=√a)", t8TwoVar]]],
      ["Корни", [["roots", "Произведение корней", t8Roots], ["root-pow", "Корень степени", t8RootPow], ["conjugate", "Сопряжённые", t8Conjugate], ["coef-roots", "Внесение/вынесение", t8CoefRoots],
      ["coef-sq", "Квадрат k√a", t8CoefSq], ["root-quot", "Частное корней", t8RootQuot], ["sq-binom", "Квадрат бинома с корнем", t8SqBinom], ["root-mono", "Корень из одночлена", t8RootMono], ["root-sign", "Корень со знаком", t8RootSign], ["trinom", "Корень из трёхчлена", t8Trinom]]]],
    9: [["Уравнения", [["linear", "Линейное", t9Linear], ["linear-int", "Линейное (целые)", t9LinearInt], ["both-sides", "Линейное (x с двух сторон)", t9BothSides], ["quad", "Квадратное", t9Quad], ["quad-lead", "Квадратное (старший коэф.)", t9QuadLead], ["factor", "ax² = bx", t9Factor]]]],
    10: [["Классическая вероятность", [["cups", "Чашки", tCups], ["markers", "Маркеры", tMarkers], ["pencils", "Карандаши", tPencils], ["tickets", "Билеты", tTickets], ["flashlights", "Фонарики", tFlashlights], ["pen", "Ручка", tPen], ["coin", "Монета", tCoin], ["equi", "Равновозможные", tEqui], ["taxi", "Такси", tTaxi], ["gifts", "Подарки", tGifts], ["pens-multi", "Ручки (несколько)", tPensMulti], ["skiers", "Лыжники", tSkiers]]],
      ["Диаграммы и дерево", [["euler", "Эйлер: точки-исходы", t10Euler], ["euler-prob", "Эйлер: вероятности точек", t10EulerB], ["euler-count", "Эйлер: число исходов", t10EulerC], ["euler-region", "Эйлер: вероятности областей", t10EulerD], ["tree", "Дерево (условная вероятность)", t10Tree]]]],
    11: [["Графики функций", [["signs-lin", "Знаки прямой", t11Signs], ["signs-parab", "Знаки параболы", t11SignsParab], ["linear", "Три линейные", t11Linear], ["mixed", "Смешанные семейства", t11Mixed]]]],
    12: [["Расчёт по формуле", [["power", "Степенная", t12Power], ["kinetic", "Кинетическая энергия", t12Kinetic], ["potential", "Потенциальная энергия", t12Potential], ["centripetal", "Центростремит. ускорение", t12Centripetal], ["quad-area", "Площадь по диагоналям", t12QuadArea], ["archimedes", "Сила Архимеда", t12Archimedes], ["well", "Колодец", t12Well], ["f2c", "Фаренгейт → Цельсий", t12F2C], ["c2f", "Цельсий → Фаренгейт", t12C2F]]]],
    13: [["Неравенства", [["quad", "Квадратное", t13Quad], ["linear-text", "Линейное (луч)", t13LinearText], ["system-pic", "Система (рисунок)", t13SystemPic], ["product", "Произведение", t13Product], ["coef", "ax²≷b", t13Coef], ["by-picture", "По рисунку", t13ByPicture]]]],
    14: [["Прогрессии и последовательности", [["arith-term", "Арифм.: n-й член", t14ArithTerm], ["arith-sum", "Арифм.: сумма", t14ArithSum], ["two-rows", "Два ряда", t14TwoRows], ["braking", "Торможение", t14Braking], ["train", "Поезд", t14Train], ["cooling", "Охлаждение", t14Cooling], ["geom-half", "Геом.: половина", t14GeomHalf], ["bacteria", "Бактерии", t14Bacteria], ["ball", "Мячик", t14Ball]]]],
    15: [["Углы", [["ang-two", "Два угла → третий", t15AngTwo], ["ang-right", "Прямоуг.: острый → острый", t15AngRight], ["ang-ext", "Внешний угол", t15AngExt], ["ang-iso", "Равноб. AB=BC → основание", t15AngIso], ["ang-bis", "Биссектриса AD → ∠BAD", t15AngBis], ["ang-height", "Высота BH → ∠ABH", t15AngHeight], ["ang-bis-eq", "Биссектриса AK=CK → ∠B", t15AngBisEq], ["ang-med-eq", "Медиана BM=AM=MC → ∠A", t15AngMedEq]]],
      ["Элементы", [["median", "Медиана → AM", t15Median], ["midline", "Средняя линия", t15Midline], ["pyth", "Катеты → гипотенуза", t15Pyth], ["pyth-leg", "Катет + гипотенуза → катет", t15PythLeg], ["equi", "Равносторонний ↔ выс/мед/бисс", t15Equi]]],
      ["Площадь", [["area-bh", "Сторона · высота", t15AreaBH], ["area-legs", "Два катета", t15AreaLegs], ["area-sin", "½·ab·sinC", t15AreaSin]]],
      ["Тригонометрия", [["trig-find", "90° → sin/cos/tg", t15TrigFind], ["trig-inv", "Дано sin/cos/tg → сторона", t15TrigInv]]]],
    16: [["Углы в окружности", [["ins", "Вписанный ∠ACB", t16InsAngle], ["diam", "Диаметры → ∠AOD", t16Diam], ["diam-inv", "Диаметры → ∠ACB", t16DiamInv], ["diam2", "Точки у диаметра", t16Diameter2], ["cyclic-quad", "Вписанный 4-угольник", t16CyclicQuad], ["cyclic-opp", "∠A → ∠C", t16CyclicOpp], ["cyclic-trap", "Трапеция вписана", t16CyclicTrap], ["tangents", "Касательные", t16Tangents], ["center-ab", "Центр на AB → ∠ABC", t16CenterOnAB]]],
      ["Вписанная окружность", [["sq-in", "Сторона квадрата → r", t16SqInscR], ["sq-around", "Квадрат около окр. → S", t16SqAroundR], ["sq-in-diag", "r в квадрат → диагональ", t16SqInscDiag], ["trap-in", "r в трапецию → высота", t16TrapInscR], ["pitot", "Описан 4-угольник → сторона", t16Pitot], ["equi-in-r", "Равностор. → r", t16EquiInscR], ["equi-in-side", "r в равностор. → сторона", t16EquiInscSide], ["incircle-area", "Периметр + r → S", t16IncircleArea], ["rhomb-in", "Ромб: диаг. + tg → r", t16RhombInscR]]],
      ["Описанная окружность", [["sq-circ-r", "Сторона квадрата → R", t16SqCircR], ["sq-circ-side", "R квадрата → сторона", t16SqCircSide], ["equi-circ-r", "Сторона равностор. → R", t16EquiCircR], ["equi-circ-side", "R равностор. → сторона", t16EquiCircSide], ["center-ab-leg", "Центр на AB, R → катет", t16CenterOnABLeg], ["right-circ", "Прямоуг. → R", t16RightCircR], ["law-sin", "∠C, AB → R", t16CircLawSin], ["equi-dist", "Расст. O → сторона", t16EquiDistSide], ["rect-diag", "Прямоугольник: sin + диаметр", t16RectDiag], ["sq-o-mid", "O сер. CD, окр. через A → S", t16SqOMid]]]],
    17: [["Параллелограмм", [["para-angle", "Больший/меньший угол", t17ParaAngle], ["para-area-fig", "Площадь по чертежу", t17ParaAreaFig], ["para-bis", "Биссектриса ∠A ‖ BC", t17ParaBisector], ["para-diag", "Диагональ + углы", t17ParaDiag], ["para-diag-o", "Диагонали → DO", t17ParaDiagO], ["para-height", "Площадь → высота", t17ParaHeight]]],
      ["Прямоугольник", [["rect-diag-o", "Диагонали → AC", t17RectDiagO], ["rect-diag-ang", "Угол диагонали", t17RectDiagAngle]]],
      ["Ромб", [["rhomb-angle", "Больший/меньший угол", t17RhombAngle], ["rhomb-acd", "∠ABC → ∠ACD", t17RhombACD], ["rhomb-height", "Сторона + угол → высота", t17RhombHeight], ["rhomb-area-p", "Периметр + угол → S", t17RhombAreaP], ["rhomb-area-diag", "Диагональ + tg → S", t17RhombAreaDiag], ["rhomb-small", "Угол со стороной/меньшей диаг.", t17RhombSmallDiag], ["rhomb-height-diag", "Высота/большая диагональ", t17RhombHeightDiag], ["rhomb-perp", "Перпендикуляр из O", t17RhombPerp]]],
      ["Квадрат", [["sq-diag", "Сторона → диагональ", t17SquareDiag]]],
      ["Трапеция", [["trap-angle-iso", "Угол равноб.", t17TrapAngleIso], ["trap-angle-right", "Угол прямоуг.", t17TrapAngleRight], ["trap-angle-sum", "Сумма углов", t17TrapAngleSum], ["trap-midline", "Средняя линия", t17TrapMidline], ["trap-area", "Площадь", t17TrapArea], ["trap-foot", "Высота делит основание", t17TrapFoot], ["trap-mid-diag", "Отрезок средней линии", t17TrapMidDiag], ["trap-diag-45", "Диагональ 45° → высота", t17TrapDiag45], ["trap-figure", "По рисунку → основание", t17TrapFigure], ["trap-diag-base", "∠D + диагональ (сторона CD)", t17TrapDiagBase], ["trap-diag-base-ab", "∠D + диагональ (сторона AB)", t17TrapDiagBaseAB], ["trap-bisector", "Биссектриса → ∠ACD", t17TrapBisector], ["trap-diag-lat", "Диагональ + боковые", t17TrapDiagLat], ["trap-base-45", "Основания + угол 45° → S", t17TrapBaseAngle45]]]],
    18: [["Длины и отрезки", [["dist", "Расстояние между точками", t18Distance], ["segment", "Длина отрезка AB", t18Segment], ["right", "Прямоуг.: катет/гипотенуза", t18RightTri], ["rhomb-diag", "Большая диагональ ромба", t18RhombDiag], ["tri-midline", "Средняя линия треугольника", t18TriMidline], ["trap-midline", "Средняя линия трапеции", t18TrapMidline], ["seg-ratio", "Отношение AM/CM (M на AC)", t18SegRatio]]],
      ["Круги", [["two-circles", "Два круга (радиус по клеткам)", t18TwoCircles], ["two-circles-tilt", "Два круга (радиус по Пифагору)", t18TwoCirclesTilt]]],
      ["Площади", [["tri-area", "Треугольник", t18TriArea], ["para-area", "Параллелограмм", t18ParaArea], ["rhomb-area", "Ромб", t18RhombArea], ["trap-area", "Трапеция", t18TrapArea]]]],
    19: [["Верные утверждения", [["statements", "Геометрические высказывания", t19]]]],
    20: [["Алгебраические выражения", [["expr", "Симметричная дробь", t20Expr]]],
      ["Уравнения", [["cubic-group", "Кубическое группировкой", t20CubicGroup], ["quartic-sq", "x⁴=(линейное)²", t20Quartic], ["biquad", "Биквадратное (x−k)", t20Biquad], ["cubic-factor", "Кубическое общим множителем", t20CubicFactor], ["radical", "С корнем", t20Radical], ["sum-squares", "Сумма квадратов", t20SumSquares], ["recip-x", "Дробно-рациональное 1/x", t20RecipX], ["recip-shift", "Дробно-рациональное 1/(x−k)", t20RecipShift]]],
      ["Системы уравнений", [["sys-add", "Сложением", t20SysAdd], ["sys-prop", "Кратные (=c·x)", t20SysProp], ["sys-parab-line", "Парабола = прямая", t20SysParabLine]]],
      ["Неравенства", [["ineq-lin-quad", "Линейн.×квадрат", t20IneqLinQuad], ["ineq-quad-quad", "Квадрат×квадрат", t20IneqQuadQuad], ["ineq-rational", "Дробь квадрат/линейн", t20IneqRational], ["ineq-rat-x", "x²/(x−k)≤x", t20IneqRatX], ["ineq-n-over-x", "x≤N/x", t20IneqNoverX], ["ineq-recip-cmp", "1/x≥1/(x−k)", t20IneqRecipCmp], ["ineq-neg-frac", "−N/((x−h)²−k)≥0", t20IneqNegFrac], ["ineq-sq-radical", "(x−h)²<√k(x−h)", t20IneqSqRadical]]]],
    21: [["Движение по прямой", [["race", "Пробег (кто быстрее)", t21Race], ["train", "Поезд мимо пешехода", t21Train], ["there-back-stop", "A→B с остановкой", t21ThereBackStop], ["half-second", "A→B по половинам", t21HalfSecond], ["avg-half", "Средняя (две половины)", t21AvgHalf], ["avg-three", "Средняя (три участка)", t21AvgThree], ["toward-stop", "Навстречу с остановкой", t21TowardStop]]],
      ["Движение по воде", [["ship-current", "Теплоход (найти течение)", t21ShipCurrent], ["boat-upstream", "Лодка против течения", t21BoatUpstream], ["raft-boat", "Плот и лодка", t21RaftBoat], ["barge", "Баржа туда-обратно", t21Barge]]],
      ["Работа", [["work-parts", "Рабочие / детали", t21WorkParts], ["work-pipes", "Трубы / резервуар", t21WorkPipes]]],
      ["Проценты и смеси", [["dried-fruit", "Свежие / сухие фрукты", t21DriedFruit], ["two-vessels", "Два сосуда с кислотой", t21TwoVessels]]],
      ["Движение по окружности", [["runners", "Два бегуна на трассе", t21RunnersCircle]]]],
    22: [["Кусочно-заданные функции", [["piece-up", "Парабола ↑ + прямая (две)", t22PieceUp], ["piece-down", "Парабола ↓ + прямая (две)", t22PieceDown], ["piece-hyper", "Парабола + гипербола (одну/две)", t22PieceHyper], ["piece-hyper-one", "Парабола + гипербола (одну)", t22PieceHyperOne], ["piece-lin3", "Три линейных куска (две)", t22PieceLin3]]],
      ["Функции с модулем", [["mod-wup", "x²+bx−a|x+c|+d (три)", t22ModWup], ["mod-mdown", "a|x−c|−x²+bx+d (три)", t22ModMdown], ["mod-cubic", "|x|·(x±c)−dx (две)", t22ModCubic], ["mod-abs-parab", "|x²+bx+c| (макс. точек)", t22ModAbsParab]]],
      ["Дробно-рациональные функции", [["rat-parab-hole", "(ax²+bx)|x|/(x+c) (ни одной)", t22RatParabHole], ["rat-neg-parab", "(x²+c)(x−d)/(d−x), y=kx", t22RatNegParab], ["rat-abs", "(a|x|−1)/(|x|−ax²), y=kx", t22RatAbs], ["rat-shift-hyp", "c−(x+a)/(x²+ax) (ни одной)", t22RatShiftHyp], ["rat-hyp", "(ax+b)/(ax²+bx), y=kx", t22RatHyp], ["rat-max", "½(|x/a−a/x|+x/a+a/x) (одну)", t22RatMax]]]],
    23: [["Треугольники", [["right-proj", "Высота из прямого угла (AB²=AH·AC)", t23RightProj], ["para-line", "Прямая ∥ стороне → BN", t23ParaLine], ["legs-height", "Два катета → высота", t23LegsHeight], ["leg-hyp-height", "Катет+гипотенуза → высота", t23LegHypHeight]]],
      ["Четырёхугольники", [["rhomb-height", "Высота ромба делит сторону", t23RhombHeight], ["trap-bis-lat", "Биссектрисы при боковой → AB", t23TrapBisLat], ["trap-par-line", "Прямая ∥ основаниям → EF", t23TrapParLine], ["para-bis-perim", "Биссектриса → периметр", t23ParaBisPerim], ["trap-lat-angles", "Боковая по двум углам", t23TrapLatAngles], ["rhomb-angles", "Расст. до стороны + диагональ → углы", t23RhombAngles]]],
      ["Окружность и её элементы", [["circ-diam", "Окружность на высоте BH → PK", t23CircDiam], ["two-chords", "Две хорды и расстояния", t23TwoChords]]],
      ["Прочее", [["parallel-x", "Отрезки на параллельных → MC", t23ParallelX]]]],
    24: [["Треугольники", [["tri-alt-angle", "Высоты → равные углы", t24TriAltAngle], ["tri-alt-sim", "Высоты (тупой) → подобие", t24TriAltSim]]],
      ["Четырёхугольники", [["para-mid-bis", "Сторона ×2, середина → биссектриса", t24ParaMidBis], ["trap-diag-sim", "Основания + диагональ → подобие", t24TrapDiagSim], ["para-inner-area", "Точка внутри → ½ площади", t24ParaInnerArea], ["cyclic-angles", "Равные углы → вписан → равные", t24CyclicAngles], ["trap-mid-area", "Точка на средней линии → ½", t24TrapMidlineArea], ["para-bis-mid", "Биссектрисы на стороне → середина", t24ParaBisMid], ["trap-lat-mid-area", "Середина боковой → ½ трапеции", t24TrapLatMidArea], ["quad-bis-equid", "Биссектрисы → равноудалённость", t24QuadBisEquid], ["para-center-seg", "Прямая через центр → равные отрезки", t24ParaCenterSeg], ["trap-diag-area", "Диагонали трапеции → равновелики", t24TrapDiagArea]]],
      ["Окружность и её элементы", [["cyclic-ext-sim", "Продолжения сторон → подобие", t24CyclicExtSim], ["tangent-ratio", "Внутренняя касательная → диаметры", t24TangentRatio], ["radical-perp", "Две окружности → ⟂ хорде", t24RadicalPerp]]]],
    25: [["Треугольники", [["angles-r", "Углы + R → BC", t25AnglesR], ["semicircle-ortho", "Полуокружность + ортоцентр → AH", t25SemicircleOrtho], ["bis-alt-r", "Биссектриса делит высоту → R", t25BisAltR], ["circum-perp", "Центр описанной, BD⊥AO → CD", t25CircumPerpCD], ["mn-radius", "M,N на AC, касательная → радиус", t25MNradius], ["bis-median", "Биссектриса ⊥ медиане → стороны", t25BisMedian], ["circ-bc-kp", "Окружность через B,C → KP", t25CircBCkp], ["circ-center-ac", "Окружность (центр на AC) касается AB", t25CircCenterAC]]],
      ["Четырёхугольники", [["para-bis-area", "Биссектрисы параллелограмма → площадь", t25ParaBisArea], ["trap-angles-mid", "Углы + средние линии → основания", t25TrapAnglesMid], ["trap-bis-mid", "Биссектриса через середину → площадь", t25TrapBisMidArea], ["mid-equidist", "Середина равноудалена → AD", t25MidEquidist], ["iso-trap-incircle", "Вписанная окр. в трапецию → расст", t25IsoTrapIncircle], ["trap-sum90-r", "Сумма углов 90° → радиус", t25TrapSum90R], ["para-incircle", "Вписанная в ABC → площадь", t25ParaIncircleArea]]],
      ["Окружность и её элементы", [["right-trap-tangent", "Касательная окр. в трапеции → расст", t25RightTrapTangent], ["two-tangent-circles", "Две касающиеся окружности → расст", t25TwoTangentCircles], ["cyclic-diag-r", "Вписанный 4-угольник, ∠диаг → R", t25CyclicDiagR]]]],
  },
}

GEN_META["ОГЭ Информатика"] = GEN_META_INF
GEN_META["ОГЭ Английский"] = GEN_META_ENG
GEN_META["ОГЭ Русский"] = GEN_META_RUS
GEN_META["ОГЭ Химия"] = GEN_META_CHEM
GEN_META["ОГЭ Обществознание"] = GEN_META_OBSH
GEN_META["ОГЭ Физика"] = GEN_META_PHYS
GEN_META["ОГЭ История"] = GEN_META_HIST
GEN_META["ОГЭ Биология"] = GEN_META_BIO
GEN_META["ОГЭ Литература"] = GEN_META_LIT
GEN_META["ОГЭ География"] = GEN_META_GEO
GEN_META["ЕГЭ"] = GEN_META_EGE_BASE
GEN_META["ЕГЭ Профиль"] = GEN_META_EGE_PROF

// Темы номера для UI: [{ theme, items: [{ key, label }] }] (без ссылок на функции).
export function taskThemes(examType, number) {
  const m = GEN_META[examType]?.[number]
  if (!m) return null
  return m.map(([theme, items]) => ({ theme, items: items.map(([key, label]) => ({ key, label })) }))
}
function findGen(examType, number, key) {
  const m = GEN_META[examType]?.[number]
  if (!m) return null
  for (const [, items] of m) for (const [k, , fn] of items) if (k === key) return fn
  return null
}

// Собирает одно задание указанного номера: случайный шаблон (или конкретный типаж по
// genKey) + свежие числа. Форма объекта совпадает со строкой банка `tasks`.
export function generateTask(examType, number, genKey) {
  const fn = genKey ? findGen(examType, number, genKey) : pick(GENERATORS[examType]?.[number] || [])
  if (!fn) return null
  const { condition_text, condition_tail, answer, image_url, solution_image, solution, program, archive, spreadsheet, answerProgram, source_text, source_title } = fn()
  const id = `gen-${number}-${Math.random().toString(36).slice(2, 10)}`
  // №23/№24 (часть 2, геометрия): чертёж строит сам ученик, поэтому в условие он не идёт —
  // прячем его в solution_image (пригодится для будущего разбора решения). Полное решение
  // складываем в solution. №24 — доказательство (answer = «Доказано.»), №23 — вычисление
  // (answer = число). ЭТО ТОЛЬКО ДЛЯ МАТЕМАТИКИ (ОГЭ ч.2): у английского те же номера значат
  // другое (грамматика), поэтому ветки гейтируются по examType.
  if (examType === "ОГЭ" && number === 24) {
    return {
      id, number, exam_type: examType, condition_text,
      image_url: null,
      solution_image: image_url ?? null,
      solution: answer ?? null,
      answer: "Доказано.",
      generated: true,
    }
  }
  if (examType === "ОГЭ" && (number === 23 || number === 25)) {
    return {
      id, number, exam_type: examType, condition_text,
      image_url: null,
      solution_image: image_url ?? null,
      solution: solution ?? null,
      answer,
      generated: true,
    }
  }
  // №20 (часть 2): показываем «настоящий» математический минус U+2212 и в отрицательных
  // числах (в остальных номерах ответы — String(число) с ASCII-дефисом, не трогаем).
  const dash = (s) => examType === "ОГЭ" && number === 20 && s != null ? String(s).replace(/-/g, "−") : s
  return {
    id,
    number,
    exam_type: examType,
    condition_text: dash(condition_text),
    condition_tail: condition_tail ?? null,   // текст ПОД картинкой (напр. вопрос ниже таблицы/программы)
    program: program ?? null,                 // блоки кода на 5 языках (интерактивный вывод с копированием)
    archive: archive ?? null,                 // №11/№12: дерево файлов { name, files } для скачивания .zip
    spreadsheet: spreadsheet ?? null,         // №14: данные таблицы { name, sheetName, rows } для .xlsx
    answerProgram: answerProgram ?? null,     // №16: эталонное решение [{name,code}] — под «Ответ»
    image_url: image_url ?? null,
    // график РЕШЕНИЯ (строит ученик, поэтому в условие не идёт) — прячем до реализации
    // пошаговых решений; см. №22, где generateTask его не показывает, но сохраняет.
    solution_image: solution_image ?? null,
    source_text: source_text ?? null,         // ОГЭ русский №10–13: общий прочитанный текст (раскрывается в UI)
    source_title: source_title ?? null,
    answer: dash(answer),
    generated: true,
  }
}
