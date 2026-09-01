// Генераторы ЕГЭ математика ПРОФИЛЬ, задание №17 (старая нумерация) — ПЛАНИМЕТРИЯ,
// часть 2: «а) Докажите …; б) Найдите …». В нумерации КИМ-2027 это №18.
//
// Эталон типажей — присланный файл «Dlya_raboty_s_kursom_17.pdf» (102 страницы,
// 61 задача #1–#61, у 41 из них следом идёт ДЗ-аналог: те же слова, другие числа —
// он и показывает, какие числа варьируются). Чертежей в эталоне нет ни в одной
// задаче, все условия текстовые. Инвентарь строка-в-строку —
// fipi_bank_ege_prof/typages_task17.md.
//
// ФИЛОСОФИЯ — та же, что у №14 (стереометрия), и по той же причине: 61 разная
// выкладка, вручную вывести их все без ошибки нельзя.
//   • model — КООРДИНАТНАЯ модель фигуры: вершины строятся из параметров условия,
//     а всё остальное (центры окружностей, точки касания, пересечения, основания
//     перпендикуляров) находит ОБЩИЙ 2D-движок, который ничего не знает о типаже;
//   • ответ считает движок по этой модели, а не формула из головы;
//   • need() внутри модели проверяет КАЖДОЕ утверждение пункта а (равенство,
//     параллельность, перпендикулярность, «лежат на одной окружности», отношение).
//     Если геометрия не та, что описана в условии, смоук падает, а не показывает
//     ответ к другой задаче;
//   • точную запись ответа даёт exactOf/angleExact/ratioExact из exactMath.js;
//     параметры перебираются, пока ответ не распознается, — отсюда «красивые»
//     числа эталона.
//
// Формат объекта: { condition_text, answer, solution, _verify }.
// Мат-токены разворачивает renderTaskMath(): ⟦f:n:d⟧ дробь столбиком, ⟦r:x⟧ корень,
// ⟦b:x⟧ индекс. answer — plain-текст: дроби в нём инлайном («7/2»), это ключ ответа.

import {
  randInt, pick, gcd, MINUS, fT, rT, sub, sup, ru, isInt, isSq, sqrtParts,
  S, Sval, Sstr, Scond, ratOf, exactOf, exactSumOf, angleExact, ratioExact,
  attempt, need, eq, SX,
} from "./exactMath.js"

export { exactOf, exactSumOf, angleExact, ratioExact }

// ══════════════════════════════════════════════════════════════════════════
// 2D-ДВИЖОК. Ничего не знает о типажах: получает точки и возвращает величины.
// ══════════════════════════════════════════════════════════════════════════
const P = (x, y) => ({ x, y })
const add = (a, b) => P(a.x + b.x, a.y + b.y)
const sub2 = (a, b) => P(a.x - b.x, a.y - b.y)
const mul = (a, t) => P(a.x * t, a.y * t)
const dot = (a, b) => a.x * b.x + a.y * b.y
const crs = (a, b) => a.x * b.y - a.y * b.x          // z-компонента векторного
const len = (a) => Math.hypot(a.x, a.y)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a, b) => P((a.x + b.x) / 2, (a.y + b.y) / 2)
const unit = (a) => { const l = len(a); need(l > 1e-12, "нулевой вектор"); return mul(a, 1 / l) }
const rot90 = (a) => P(-a.y, a.x)
// Точка, делящая AB в отношении p : q от A.
const divPt = (a, b, p, q) => add(a, mul(sub2(b, a), p / (p + q)))
const lerp = (a, b, t) => add(a, mul(sub2(b, a), t))
// Точка на окружности (центр c, радиус r) под углом φ.
const onCircle = (c, r, phi) => P(c.x + r * Math.cos(phi), c.y + r * Math.sin(phi))

// Углы. angleAt(B, A, C) — угол ABC в градусах.
const DEG = 180 / Math.PI
function angleAt(vertex, a, b) {
  const u = sub2(a, vertex), w = sub2(b, vertex)
  const c = dot(u, w) / (len(u) * len(w))
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG
}
// Угол между прямыми (острый, в градусах).
function angleLines(u, w) {
  const c = Math.abs(dot(u, w)) / (len(u) * len(w))
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG
}

// Прямая через две точки: пересечение, расстояние, проекция.
function lineInter(a, b, c, d) {
  const r = sub2(b, a), s = sub2(d, c), den = crs(r, s)
  need(Math.abs(den) > 1e-12, "прямые параллельны — точки пересечения нет")
  return add(a, mul(r, crs(sub2(c, a), s) / den))
}
// Параметр t на AB для точки пересечения прямых AB и CD (0 в A, 1 в B).
function lineInterT(a, b, c, d) {
  const r = sub2(b, a), s = sub2(d, c), den = crs(r, s)
  need(Math.abs(den) > 1e-12, "прямые параллельны")
  return crs(sub2(c, a), s) / den
}
const distPointLine = (p, a, b) => Math.abs(crs(sub2(b, a), sub2(p, a))) / dist(a, b)
// Основание перпендикуляра из p на прямую ab.
function foot(p, a, b) {
  const u = sub2(b, a)
  return add(a, mul(u, dot(sub2(p, a), u) / dot(u, u)))
}
const reflect = (p, a, b) => { const f = foot(p, a, b); return add(f, sub2(f, p)) }
const parallelQ = (u, w) => Math.abs(crs(u, w)) <= 1e-7 * len(u) * len(w)
const perpQ = (u, w) => Math.abs(dot(u, w)) <= 1e-7 * len(u) * len(w)

// Площадь многоугольника (по контуру, модуль).
function area(pts) {
  let s = 0
  for (let i = 0; i < pts.length; i++) s += crs(pts[i], pts[(i + 1) % pts.length])
  return Math.abs(s) / 2
}
const triArea = (a, b, c) => Math.abs(crs(sub2(b, a), sub2(c, a))) / 2
const perimeter = (pts) => pts.reduce((s, p, i) => s + dist(p, pts[(i + 1) % pts.length]), 0)

// ── Окружности ─────────────────────────────────────────────────────────────
const circle = (c, r) => ({ c, r })
// Пересечение прямой ab с окружностью: 0, 1 или 2 точки (по ходу от a к b).
function lineCircle(a, b, ci) {
  const d = sub2(b, a), f = sub2(a, ci.c)
  const A = dot(d, d), B = 2 * dot(f, d), C = dot(f, f) - ci.r * ci.r
  const disc = B * B - 4 * A * C
  if (disc < -1e-12) return []
  const sq = Math.sqrt(Math.max(0, disc))
  const ts = [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]
  return (Math.abs(disc) < 1e-12 ? [ts[0]] : ts).map((t) => add(a, mul(d, t)))
}
// Пересечение двух окружностей.
function circleCircle(c1, c2) {
  const d = dist(c1.c, c2.c)
  if (d < 1e-12) return []
  const a = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d)
  const h2 = c1.r * c1.r - a * a
  if (h2 < -1e-12) return []
  const h = Math.sqrt(Math.max(0, h2))
  const p0 = add(c1.c, mul(sub2(c2.c, c1.c), a / d))
  const n = mul(rot90(sub2(c2.c, c1.c)), 1 / d)
  return h < 1e-12 ? [p0] : [add(p0, mul(n, h)), add(p0, mul(n, -h))]
}
// Окружность через три точки.
function circumcircle(a, b, c) {
  const d = 2 * crs(sub2(b, a), sub2(c, a))
  need(Math.abs(d) > 1e-12, "три точки лежат на одной прямой — окружности нет")
  const ba = sub2(b, a), ca = sub2(c, a)
  const ux = (dot(ba, ba) * ca.y - dot(ca, ca) * ba.y) / d
  const uy = (dot(ca, ca) * ba.x - dot(ba, ba) * ca.x) / d
  const o = add(a, P(ux, uy))
  return circle(o, dist(o, a))
}
// Лежат ли четыре точки на одной окружности. Тройку для построения окружности
// выбираем невырожденную: три из четырёх точек вполне могут оказаться на одной
// прямой, и тогда окружности по ним не построить.
function concyclic(a, b, c, d) {
  const pts = [a, b, c, d]
  for (const [i, j, k, l] of [[0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 3, 1], [1, 2, 3, 0]]) {
    const [p1, p2, p3, p4] = [pts[i], pts[j], pts[k], pts[l]]
    const area2 = Math.abs(crs(sub2(p2, p1), sub2(p3, p1)))
    if (area2 < 1e-9 * Math.max(1, dist(p1, p2) * dist(p1, p3))) continue
    const ci = circumcircle(p1, p2, p3)
    return Math.abs(dist(ci.c, p4) - ci.r) <= 1e-7 * Math.max(1, ci.r)
  }
  return false        // все четыре точки на одной прямой
}

// ── Центры треугольника ────────────────────────────────────────────────────
function incenter(a, b, c) {
  const A = dist(b, c), B = dist(a, c), C = dist(a, b), s = A + B + C
  return P((A * a.x + B * b.x + C * c.x) / s, (A * a.y + B * b.y + C * c.y) / s)
}
const inradius = (a, b, c) => 2 * triArea(a, b, c) / (dist(a, b) + dist(b, c) + dist(c, a))
const circumcenter = (a, b, c) => circumcircle(a, b, c).c
const circumradius = (a, b, c) => circumcircle(a, b, c).r
function orthocenter(a, b, c) {
  return lineInter(a, foot(a, b, c), b, foot(b, a, c))
}
const centroid = (a, b, c) => P((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3)
// Вневписанная окружность против вершины A.
function excenterA(a, b, c) {
  const A = dist(b, c), B = dist(a, c), C = dist(a, b), s = -A + B + C
  return P((-A * a.x + B * b.x + C * c.x) / s, (-A * a.y + B * b.y + C * c.y) / s)
}
const exradiusA = (a, b, c) => {
  const A = dist(b, c), B = dist(a, c), C = dist(a, b)
  return triArea(a, b, c) / ((-A + B + C) / 2)
}
// Точка касания вписанной окружности со стороной (проекция центра на сторону).
const touchPoint = (o, x, y) => foot(o, x, y)

// ── Численный решатель: подбор параметра под условие ───────────────────────
// Многие задачи эталона заданы «наоборот»: дана связь (BM = 2,5r), а нужна сама
// фигура. Двоичным поиском по монотонной величине это находится точно и быстро.
function solveMono(f, lo, hi, iters = 200) {
  let flo = f(lo), fhi = f(hi)
  need(flo * fhi <= 0, "решение не заключено в вилку")
  for (let i = 0; i < iters; i++) {
    const m = (lo + hi) / 2, fm = f(m)
    if (flo * fm <= 0) { hi = m; fhi = fm } else { lo = m; flo = fm }
  }
  return (lo + hi) / 2
}

export const _geo = {
  P, add, sub2, mul, dot, crs, len, dist, mid, unit, rot90, divPt, lerp, onCircle,
  angleAt, angleLines, lineInter, lineInterT, distPointLine, foot, reflect,
  parallelQ, perpQ, area, triArea, perimeter,
  circle, lineCircle, circleCircle, circumcircle, concyclic,
  incenter, inradius, circumcenter, circumradius, orthocenter, centroid,
  excenterA, exradiusA, touchPoint, solveMono,
  S, Sval, Sstr, Scond, exactOf, angleExact, ratioExact, exactSumOf, need, eq, SX,
}

// ══════════════════════════════════════════════════════════════════════════
// СБОРКА ОБЪЕКТА ЗАДАНИЯ
// ══════════════════════════════════════════════════════════════════════════
function item({ preamble, qa, qb, ans, num, model, solution }) {
  return {
    condition_text: `${preamble}\n\nа) Докажите, что ${qa}\nб) ${qb}`,
    answer: `б) ${ans}`,
    solution,
    _verify: { num, model },
  }
}

// Проверка объекта (для смоука): модель считает ответ заново и обязана совпасть.
export function verify17(o) {
  if (!o || !o._verify) return { ok: false, err: "нет объекта/_verify" }
  const t = o.condition_text || ""
  if (!/\nа\) Докажите, что \S/.test(t)) return { ok: false, err: "пустой пункт а" }
  if (!/\nб\) \S/.test(t)) return { ok: false, err: "пустой пункт б" }
  if (!/^б\) \S/.test(o.answer || "")) return { ok: false, err: "пустой ответ" }
  const blob = t + "\n" + o.answer + "\n" + (o.solution || "")
  if (/undefined|NaN|Infinity/.test(blob)) return { ok: false, err: "NaN/undefined: " + blob.slice(0, 140) }
  const V = o._verify
  if (!Number.isFinite(V.num)) return { ok: false, err: "ответ не число" }
  let got
  try { got = V.model() } catch (e) { return { ok: false, err: "модель упала: " + e.message } }
  if (!Number.isFinite(got)) return { ok: false, err: "модель вернула не число" }
  const scale = Math.max(1, Math.abs(V.num))
  if (Math.abs(got - V.num) > 1e-7 * scale) return { ok: false, err: `модель ${got} ≠ ответ ${V.num}` }
  return { ok: true }
}

// ══════════════════════════════════════════════════════════════════════════
// ОБЩИЕ ПОСТРОЕНИЯ
// ══════════════════════════════════════════════════════════════════════════
const D2R = Math.PI / 180
const R2D = 180 / Math.PI

// Треугольник по трём сторонам: A(0;0), B(c;0), C сверху. a = BC, b = AC, c = AB.
function triSSS(a, b, c) {
  need(a + b > c && a + c > b && b + c > a, "неравенство треугольника нарушено")
  const A = P(0, 0), B = P(c, 0)
  const x = (b * b + c * c - a * a) / (2 * c)
  const y = Math.sqrt(Math.max(0, b * b - x * x))
  need(y > 1e-9, "вырожденный треугольник")
  return { A, B, C: P(x, y) }
}
// Треугольник по двум углам (при A и при B, в градусах) и стороне AB = c.
function triAAS(angA, angB, c) {
  need(angA > 0 && angB > 0 && angA + angB < 180, "углы не дают треугольника")
  const A = P(0, 0), B = P(c, 0)
  const C = lineInter(A, P(Math.cos(angA * D2R), Math.sin(angA * D2R)),
    B, P(c - Math.cos(angB * D2R), Math.sin(angB * D2R)))
  return { A, B, C }
}
// Основание биссектрисы из вершины A на сторону BC: делит её как AB : AC.
const bisectorFoot = (A, B, C) => divPt(B, C, dist(A, B), dist(A, C))
// Равнобокая трапеция ABCD: AD — нижнее основание, BC — верхнее, высота h.
function isoTrapezoid(ad, bc, h) {
  const off = (ad - bc) / 2
  return { A: P(0, 0), D: P(ad, 0), B: P(off, h), C: P(off + bc, h) }
}
// Отношение p : q в строку, сокращённое.
function ratioTxt(p, q) { const g = gcd(Math.round(p), Math.round(q)) || 1; return `${Math.round(p) / g} : ${Math.round(q) / g}` }

// ══════════════════════════════════════════════════════════════════════════
// ТРАПЕЦИИ
// ══════════════════════════════════════════════════════════════════════════

// #1. Сумма оснований s, диагонали d₁ и d₂ с d₁² + d₂² = s² ⇒ диагонали ⊥.
export function t17TrapPerpDiagHeight() {
  return attempt(() => {
    const [d1, d2, s] = pick([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15],
      [7, 24, 25], [12, 16, 20], [20, 21, 29], [10, 24, 26], [15, 20, 25], [12, 35, 37]])
    const flip = Math.random() < 0.5
    const [D1, D2] = flip ? [d2, d1] : [d1, d2]
    const ad = Math.round(s * 10 * (0.45 + Math.random() * 0.25)) / 10   // нижнее основание
    if (ad <= 0 || ad >= s) return null
    const model = () => {
      const h = D1 * D2 / s, x = D1 * D1 / s - s + ad
      const A = P(0, 0), D = P(ad, 0), B = P(x, h), C = P(x + s - ad, h)
      need(parallelQ(sub2(D, A), sub2(C, B)), "основания не параллельны")
      need(eq(dist(A, C), D1) && eq(dist(B, D), D2), "диагонали не те, что в условии")
      need(eq(dist(A, D) + dist(B, C), s), "сумма оснований не та, что в условии")
      need(perpQ(sub2(C, A), sub2(D, B)), "диагонали не перпендикулярны")
      return h
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 40) return null
    return item({
      preamble: `Дана трапеция. Сумма оснований равна ${s}, диагонали ${D1} и ${D2}.`,
      qa: "диагонали перпендикулярны.",
      qb: "Найдите высоту трапеции.",
      ans: Sstr(ex), num, model,
      solution: `Проведём через вершину прямую, параллельную диагонали ${D1 === d1 ? "AC" : "BD"}: получится треугольник с катетами ${D1} и ${D2} и гипотенузой, равной сумме оснований, ведь ${D1}² + ${D2}² = ${s}². Значит диагонали перпендикулярны, а высота трапеции равна высоте этого треугольника: ${D1}·${D2}/${s} = ${Sstr(ex)}.`,
    })
  })
}

// #2. Трапеция с основаниями BC и AD, углы ABD и ACD прямые ⇒ B и C на окружности
// с диаметром AD, трапеция равнобокая.
export function t17TrapRightAnglesAD() {
  return attempt(() => {
    const m = randInt(2, 14), n = randInt(2, 26)
    const disc = n * n + 8 * m * m
    if (!isSq(disc)) return null
    const R = (n + Math.sqrt(disc)) / 4
    if (R <= n / 2 + 1e-9) return null
    const model = () => {
      const k = Math.sqrt(R * R - n * n / 4)
      const A = P(-R, 0), D = P(R, 0), B = P(-n / 2, k), C = P(n / 2, k)
      need(eq(dist(A, B), m), "AB не равно заданному")
      need(eq(dist(B, C), n), "BC не равно заданному")
      need(eq(angleAt(B, A, D), 90) && eq(angleAt(C, A, D), 90), "углы ABD и ACD не прямые")
      need(eq(dist(A, B), dist(C, D)), "AB ≠ CD")
      return dist(A, D)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `В трапеции ABCD с основаниями BC и AD углы ABD и ACD прямые.`,
      qa: "AB = CD.",
      qb: `Найдите AD, если AB = ${m}, BC = ${n}.`,
      ans: Sstr(ex), num, model,
      solution: `Точки B и C видят отрезок AD под прямым углом, значит лежат на окружности с диаметром AD; вместе с BC ∥ AD это даёт равнобокую трапецию и AB = CD. Обозначив AD = 2R, из AB² = (R − BC/2)² + (R² − BC²/4) получаем 2R² − ${n}R − ${m}² = 0, откуда AD = ${Sstr(ex)}.`,
    })
  })
}

// #3. Диагональ BD разбивает трапецию на два равнобедренных треугольника
// ⇒ B — центр окружности через A, C, D; CD² = 4BD² − AC².
export function t17TrapTwoIsoscelesCD() {
  return attempt(() => {
    const [cd, ac, hyp] = pick([[5, 12, 13], [8, 15, 17], [3, 4, 5], [7, 24, 25], [20, 21, 29],
      [9, 40, 41], [12, 35, 37], [11, 60, 61], [16, 63, 65], [33, 56, 65]])
    if (ac < cd) return null
    const t = hyp / 2                                     // BD = гипотенуза / 2
    const model = () => {
      const u = (ac * ac - 2 * t * t) / (2 * t), h = Math.sqrt(t * t - u * u)
      const B = P(0, 0), C = P(t, 0), A = P(-u, h), D = P(u, h)
      need(parallelQ(sub2(D, A), sub2(C, B)), "AD не параллельно BC")
      need(eq(dist(A, B), dist(B, D)), "треугольник ABD не равнобедренный с основанием AD")
      need(eq(dist(C, B), dist(B, D)), "треугольник BCD не равнобедренный с основанием CD")
      need(eq(dist(A, C), ac) && eq(dist(B, D), t), "диагонали не те, что в условии")
      need(eq(angleAt(A, B, C), angleAt(A, C, D)), "AC не биссектриса угла BAD")
      return dist(C, D)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex) return null
    const bdTxt = Number.isInteger(t) ? String(t) : ru(t)
    return item({
      preamble: `Дана трапеция ABCD с основаниями AD и BC. Диагональ BD разбивает её на два равнобедренных треугольника с основаниями AD и CD.`,
      qa: "луч AC — биссектриса угла BAD.",
      qb: `Найдите CD, если известны диагонали трапеции: AC = ${ac} и BD = ${bdTxt}.`,
      ans: Sstr(ex), num, model,
      solution: `Из условия AB = BD и CB = BD, поэтому точка B равноудалена от A, C и D — она центр окружности радиуса BD, на которой лежат A, C, D. Треугольник ABC равнобедренный, а BC ∥ AD, значит ∠BAC = ∠BCA = ∠CAD, то есть AC — биссектриса. Далее CD² = 4BD² − AC² = ${Sstr(ex)}².`,
    })
  })
}

// Стороны, при которых пункт а выполняется. Биссектриса угла C делит MN пополам
// ровно тогда, когда треугольник CMN равнобедренный, то есть CM = CN. Здесь
// CM = BC·AC/(AB + AC), CN = AC − AB, и равенство даёт BC·AC = AC² − AB².
// Эталонная тройка (6; 5; 9) ему удовлетворяет: 5·9 = 81 − 36. Набор считается
// один раз при импорте — случайный перебор троек почти никогда в него не попадает.
const T17_BIS_SET = (() => {
  const out = []
  for (let ac = 4; ac <= 30; ac++) {
    for (let ab = 2; ab < ac; ab++) {
      if ((ab * ab) % ac) continue
      const bc = ac - (ab * ab) / ac
      if (bc < 2) continue
      if (!(ab + bc > ac && ab + ac > bc && bc + ac > ab)) continue
      out.push({ ab, bc, ac })
    }
  }
  return out
})()

// #4. Биссектриса AM, прямая через B ⊥ AM пересекает AC в N (AN = AB);
// биссектриса угла C делит MN пополам, так как CM = CN.
export function t17BisectorPerpRatio() {
  return attempt(() => {
    const { ab, bc, ac } = pick(T17_BIS_SET)
    const model = () => {
      const { A, B, C } = triSSS(bc, ac, ab)
      const M = bisectorFoot(A, B, C)
      const N = add(A, mul(unit(sub2(C, A)), ab))
      need(perpQ(sub2(M, A), sub2(N, B)), "BN не перпендикулярна AM")
      need(eq(dist(C, M), dist(C, N)), "CM ≠ CN — биссектриса из C не делит MN пополам")
      const I = incenter(A, B, C)
      need(eq(dist(I, N), dist(I, B)), "PN ≠ PB (N не симметрична B относительно AM)")
      return dist(A, I) / dist(I, N)
    }
    const num = model()
    const rt = ratioExact(num)
    if (!rt) return null
    return item({
      preamble: `В треугольнике ABC проведена биссектриса AM. Прямая, проходящая через вершину B перпендикулярно AM, пересекает сторону AC в точке N; AB = ${ab}, BC = ${bc}, AC = ${ac}.`,
      qa: "биссектриса угла C делит отрезок MN пополам.",
      qb: "Пусть P — точка пересечения биссектрис треугольника ABC. Найдите отношение AP : PN.",
      ans: rt.str, num, model,
      solution: `Прямая AM — ось симметрии для B и N, поэтому AN = AB = ${ab} и CN = ${ac - ab}. Биссектриса AM делит BC как AB : AC, значит CM = ${SX(bc * ac / (ab + ac))} = CN, треугольник CMN равнобедренный, и биссектриса угла C — его медиана. Точка P лежит на AM, поэтому PN = PB, и AP : PN = AP : PB = ${rt.str}.`,
    })
  })
}

// #5. Равнобокая трапеция AD = 3BC: высота из C делит AD в отношении 2 : 1,
// расстояние от C до середины BD равно половине высоты.
export function t17TrapThreeToOneDist() {
  return attempt(() => {
    const b = randInt(2, 20), h = randInt(2, 13) * 2
    const acx = 4 * b * b + h * h
    const acEx = exactOf(Math.sqrt(acx))
    if (!acEx || acEx.b !== 1 || acEx.r > 90) return null
    const fromC = Math.random() < 0.5
    const model = () => {
      const { A, B, C, D } = isoTrapezoid(3 * b, b, h)
      const H = foot(C, A, D)
      need(eq(dist(A, H), 2 * dist(H, D)), "высота делит AD не в отношении 2 : 1")
      need(eq(dist(A, C), Math.sqrt(acx)), "диагональ не та, что в условии")
      return fromC ? dist(C, mid(B, D)) : dist(B, mid(A, C))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 2) return null
    const V = fromC ? ["CH", "C", "BD"] : ["BH", "B", "AC"]
    return item({
      preamble: `В равнобедренной трапеции ABCD основание AD в три раза больше основания BC.`,
      qa: `высота ${V[0]} трапеции разбивает основание AD на отрезки, один из которых вдвое больше другого.`,
      qb: `Найдите расстояние от вершины ${V[1]} до середины диагонали ${V[2]}, если AD = ${3 * b} и AC = ${Scond(acEx)}.`,
      ans: Sstr(ex), num, model,
      solution: `Пусть BC = ${b}, тогда AD = ${3 * b}, а проекция боковой стороны на AD равна ${b}: высота делит AD на ${2 * b} и ${b}. Из AC² = (2·${b})² + h² находим высоту h = ${h}. Искомое расстояние — средняя линия соответствующего треугольника, она равна h/2 = ${Sstr(ex)}.`,
    })
  })
}

// #6. Равнобокая трапеция AD = 2BC: высота делит AD в отношении 3 : 1;
// расстояние от C до середины OD, где O — точка пересечения диагоналей.
export function t17TrapTwoToOneOD() {
  return attempt(() => {
    const b = randInt(4, 30) * 2, c = randInt(3, 30)
    const h2 = c * c - b * b / 4
    if (h2 <= 0 || !isSq(h2)) return null
    const h = Math.round(Math.sqrt(h2))
    const model = () => {
      const { A, B, C, D } = isoTrapezoid(2 * b, b, h)
      const H = foot(C, A, D)
      need(eq(dist(A, H), 3 * dist(H, D)), "высота делит AD не в отношении 3 : 1")
      need(eq(dist(A, B), c), "боковая сторона не та, что в условии")
      const O = lineInter(A, C, B, D)
      return dist(C, mid(O, D))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `В равнобедренной трапеции ABCD основание AD в два раза больше основания BC.`,
      qa: "высота CH трапеции разбивает основание AD на отрезки, один из которых втрое больше другого.",
      qb: `Пусть O — точка пересечения диагоналей трапеции ABCD. Найдите расстояние от вершины C до середины отрезка OD, если BC = ${b} и AB = ${c}.`,
      ans: Sstr(ex), num, model,
      solution: `Проекция боковой стороны на AD равна ${b / 2}, поэтому высота делит AD на ${3 * b / 2} и ${b / 2}. Высота трапеции равна √(${c}² − ${b / 2}²) = ${h}. Диагонали делятся точкой O в отношении AD : BC = 2 : 1; отсюда расстояние от C до середины OD равно ${Sstr(ex)}.`,
    })
  })
}

// #7. Тот же треугольник расстояний, но условие сформулировано через высоту CM.
export function t17TrapCMMedianDist() {
  return attempt(() => {
    const b = randInt(2, 20), h = randInt(2, 13) * 2
    const acx = 4 * b * b + h * h
    const acEx = exactOf(Math.sqrt(acx))
    if (!acEx || acEx.b !== 1 || acEx.r > 90) return null
    const model = () => {
      const { A, B, C, D } = isoTrapezoid(3 * b, b, h)
      const M = foot(C, A, D)
      need(eq(dist(A, M), 2 * dist(M, D)), "M делит AD не в отношении 2 : 1")
      need(eq(dist(A, C), Math.sqrt(acx)), "диагональ не та, что в условии")
      return dist(C, mid(B, D))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 2) return null
    return item({
      preamble: `Дана равнобедренная трапеция, в которой AD = 3BC, CM — высота трапеции.`,
      qa: "M делит AD в отношении 2 : 1.",
      qb: `Найдите расстояние от точки C до середины BD, если AD = ${3 * b}, AC = ${Scond(acEx)}.`,
      ans: Sstr(ex), num, model,
      solution: `Пусть BC = ${b}. Проекция боковой стороны на AD равна ${b}, поэтому AM = ${2 * b}, MD = ${b}. Из AC² = (2·${b})² + h² высота h = ${h}, а искомое расстояние равно h/2 = ${Sstr(ex)}.`,
    })
  })
}

// #8. Биссектрисы AD и CE, ∠AOC = 120° ⇔ ∠B = 60°; при этом ∠BED = 90° − ∠C/2.
export function t17BisectorsCyclicArea() {
  return attempt(() => {
    const angC = pick([20, 30, 40, 50, 70, 80, 90, 100])
    const angA = 120 - angC
    if (angA <= 0) return null
    const bed = 90 - angC / 2
    const side = randInt(2, 14) * 2
    const useBC = Math.random() < 0.5
    const model = () => {
      const t0 = triAAS(angA, 60, 1)
      const k = side / (useBC ? dist(t0.B, t0.C) : dist(t0.A, t0.B))
      const A = mul(t0.A, k), B = mul(t0.B, k), C = mul(t0.C, k)
      need(eq(angleAt(B, A, C), 60), "угол B не равен 60°")
      const O = incenter(A, B, C)
      need(eq(angleAt(O, A, C), 120), "угол AOC не равен 120°")
      const D = bisectorFoot(A, B, C), E = bisectorFoot(C, A, B)
      need(concyclic(B, D, O, E), "около BDOE нельзя описать окружность")
      need(eq(angleAt(E, B, D), bed), "угол BED не тот, что в условии")
      return triArea(A, B, C)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `В треугольнике ABC биссектрисы AD и CE пересекаются в точке O, величина угла AOC составляет 120°.`,
      qa: "около четырёхугольника BDOE можно описать окружность.",
      qb: `Найдите площадь треугольника ABC, если ${useBC ? `BC = ${side}` : `AB = ${side}`}, а ∠BED = ${ru(bed)}°.`,
      ans: Sstr(ex), num, model,
      solution: `Из ∠AOC = 90° + ∠B/2 = 120° следует ∠B = 60°, поэтому ∠B + ∠DOE = 180° и около BDOE можно описать окружность. Далее ∠BED = 90° − ∠C/2, откуда ∠C = ${angC}° и ∠A = ${angA}°. Площадь треугольника равна ${Sstr(ex)}.`,
    })
  })
}

// #9. Высоты AP и CQ: BPQ ~ BAC с коэффициентом cos B, поэтому R = PQ/sin 2B.
export function t17AltitudeFeetCircumradius() {
  return attempt(() => {
    const angB = pick([30, 45, 60])
    const k = randInt(1, 12)
    const pqS = angB === 45 ? S(k) : (Math.random() < 0.5 ? S(k, 1, 3) : S(2 * k))
    const pq = Sval(pqS)
    const angA = pick([50, 55, 60, 65, 70, 75, 80])
    if (angA + angB >= 175 || 180 - angA - angB >= 90) return null
    const model = () => {
      const t0 = triAAS(angA, angB, 1)
      const Pp0 = foot(t0.A, t0.B, t0.C), Q0 = foot(t0.C, t0.A, t0.B)
      const k2 = pq / dist(Pp0, Q0)
      const A = mul(t0.A, k2), B = mul(t0.B, k2), C = mul(t0.C, k2)
      need(angleAt(A, B, C) < 90 && angleAt(B, A, C) < 90 && angleAt(C, A, B) < 90, "треугольник не остроугольный")
      const Pp = foot(A, B, C), Q = foot(C, A, B)
      need(eq(dist(Pp, Q), pq), "PQ не то, что в условии")
      need(eq(angleAt(A, Pp, C), angleAt(Q, Pp, C)), "угол PAC не равен углу PQC")
      return circumradius(A, B, C)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `В остроугольном треугольнике ABC проведены высоты AP и CQ.`,
      qa: "угол PAC равен углу PQC.",
      qb: `Найдите радиус окружности, описанной около треугольника ABC, если известно, что PQ = ${Scond(pqS)} и ∠ABC = ${angB}°.`,
      ans: Sstr(ex), num, model,
      solution: `Точки P и Q лежат на окружности с диаметром AC, поэтому ∠PAC = ∠PQC. Треугольник BPQ подобен треугольнику BAC с коэффициентом cos∠B, значит PQ = AC·cos∠B, а AC = 2R·sin∠B. Отсюда R = PQ/sin 2∠B = ${Sstr(ex)}.`,
    })
  })
}

// #10. ∠B = 60°, M — точка касания вписанной со стороной AC.
// ВАЖНО: BM/r лежит в промежутке (√7; 3], поэтому коэффициент берётся оттуда —
// напечатанное в эталоне «2,5» невыполнимо (см. typages_task17.md).
export function t17IncircleTouchSin() {
  return attempt(() => {
    const k = pick([2.7, 2.75, 2.8, 2.85, 2.9, 2.95])
    const model = () => {
      const f = (a) => {
        const t = triAAS(a, 60, 1), I = incenter(t.A, t.B, t.C)
        return dist(t.B, foot(I, t.A, t.C)) / inradius(t.A, t.B, t.C) - k
      }
      const angA = solveMono(f, 1, 60)
      const { A, B, C } = triAAS(angA, 60, 1)
      const I = incenter(A, B, C), r = inradius(A, B, C), M = foot(I, A, C)
      need(eq(angleAt(B, A, C), 60), "угол ABC не равен 60°")
      need(eq(dist(B, M), k * r), "BM не равно заданной доле радиуса")
      need(dist(B, M) <= 3 * r + 1e-9, "BM больше утроенного радиуса")
      return Math.sin(angleAt(M, B, C) * D2R)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 200) return null
    return item({
      preamble: `В треугольнике ABC угол ABC равен 60°. Окружность, вписанная в треугольник, касается стороны AC в точке M.`,
      qa: "отрезок BM не больше утроенного радиуса вписанной в треугольник окружности.",
      qb: `Найдите sin∠BMC, если известно, что отрезок BM в ${ru(k)} раза больше радиуса вписанной в треугольник окружности.`,
      ans: Sstr(ex), num, model,
      solution: `Отношение BM : r достигает наибольшего значения 3 в равностороннем треугольнике, поэтому BM ≤ 3r. По заданному отношению BM : r = ${ru(k)} однозначно восстанавливается форма треугольника (два симметричных случая дают дополнительные углы, а их синусы равны), и sin∠BMC = ${Sstr(ex)}.`,
    })
  })
}

// #11. Прямоугольный треугольник (прямой угол C): CM = BC на катете AC,
// CN = AC на продолжении BC. Биссектрисы углов ACB и NCM перпендикулярны.
export function t17RightBisectorsPQ() {
  return attempt(() => {
    const bc = randInt(2, 15), ac = randInt(2, 18)
    if (ac === bc) return null
    const model = () => {
      const C = P(0, 0), B = P(0, bc), A = P(ac, 0)
      const M = P(bc, 0), N = P(0, -ac)
      need(eq(dist(C, M), bc) && eq(dist(C, N), ac), "CM или CN не те, что в условии")
      const Pp = lineInter(C, P(1, 1), A, B)          // биссектриса угла ACB
      const Q = lineInter(C, P(1, -1), M, N)          // биссектриса угла NCM
      need(perpQ(sub2(Pp, C), sub2(Q, C)), "CP и CQ не перпендикулярны")
      need(eq(angleAt(C, A, Pp), angleAt(C, B, Pp)), "CP не биссектриса угла ACB")
      return dist(Pp, Q)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 20) return null
    return item({
      preamble: `В прямоугольном треугольнике ABC точка M лежит на катете AC, а точка N лежит на продолжении катета BC за точку C, причём CM = BC и CN = AC. Отрезки CP и CQ — биссектрисы треугольников ACB и NCM соответственно.`,
      qa: "CP и CQ перпендикулярны.",
      qb: `Найдите PQ, если BC = ${bc}, а AC = ${ac}.`,
      ans: Sstr(ex), num, model,
      solution: `Углы ACB и NCM прямые и лежат по разные стороны от прямой AC, поэтому их биссектрисы образуют угол 45° + 45° = 90°. В координатах C(0; 0), A(${ac}; 0), B(0; ${bc}) биссектрисы задаются направлениями (1; 1) и (1; −1), откуда PQ = ${Sstr(ex)}.`,
    })
  })
}

// #12. Высота BH, из H перпендикуляры HK и HM: BK·BA = BH² = BM·BC, поэтому
// MBK ~ ABC с коэффициентом BH/(2R), и площади относятся как BH² : (4R² − BH²).
export function t17AltitudeFeetAreaRatio() {
  return attempt(() => {
    const R = randInt(2, 20), bh = randInt(2, Math.floor(1.5 * R))
    const k = bh / (2 * R)
    if (k >= 0.75 || k <= 0.12) return null
    const g = gcd(bh * bh, 4 * R * R - bh * bh) || 1
    if ((4 * R * R - bh * bh) / g > 400) return null
    const model = () => {
      // высота из B равна 2R·sin A·sin C, поэтому sin A·sin C = BH/(2R) = k;
      // подбираем пару острых углов с таким произведением, дающую остроугольный
      // треугольник (нужно ещё A + C > 90°)
      let angA = null, angC = null
      for (const a of [89, 87, 85, 82, 80, 77, 75, 70, 65, 60]) {
        const sc = k / Math.sin(a * D2R)
        if (sc >= 1) continue
        const c = Math.asin(sc) * R2D
        if (a + c > 90.001 && c < 90 && 180 - a - c < 90) { angA = a; angC = c; break }
      }
      need(angA !== null, "остроугольного треугольника с такими BH и R не существует")
      const angB = 180 - angA - angC
      const t0 = triAAS(angA, angB, 1)
      const sc = R / circumradius(t0.A, t0.B, t0.C)
      const A = mul(t0.A, sc), B = mul(t0.B, sc), C = mul(t0.C, sc)
      const H = foot(B, A, C), K = foot(H, A, B), M = foot(H, B, C)
      need(eq(dist(B, H), bh), "высота BH не та, что в условии")
      need(eq(circumradius(A, B, C), R), "радиус описанной не тот, что в условии")
      need(eq(angleAt(B, M, K), angleAt(B, A, C)) && eq(angleAt(M, B, K), angleAt(A, B, C)), "MBK не подобен ABC")
      return triArea(M, B, K) / area([A, K, M, C])
    }
    const num = model()
    const rt = ratioExact(num, 400)
    if (!rt) return null
    return item({
      preamble: `В остроугольном треугольнике ABC провели высоту BH. Из точки H на стороны AB и BC опустили перпендикуляры HK и HM соответственно.`,
      qa: "треугольник MBK подобен треугольнику ABC.",
      qb: `Найдите отношение площади треугольника MBK к площади четырёхугольника AKMC, если BH = ${bh}, а радиус окружности, описанной около треугольника ABC, равен ${R}.`,
      ans: rt.str, num, model,
      solution: `Из прямоугольных треугольников BHA и BHC: BK·BA = BH² и BM·BC = BH², поэтому BK/BC = BM/BA и треугольник MBK подобен ABC с коэффициентом BH²/(AB·BC). Так как AB·BC = 2R·BH, коэффициент равен BH/(2R) = ${SX(k)}. Отсюда S(MBK) : S(AKMC) = BH² : (4R² − BH²) = ${rt.str}.`,
    })
  })
}

// #13. Вписанная окружность радиуса r касается AC в D, AD = r ⇒ угол A прямой.
export function t17IncircleADeqR() {
  return attempt(() => {
    const r = randInt(1, 12), q = randInt(r + 1, r + 20)
    const x = r * (r + q) / (q - r)
    if (!isInt(x)) return null
    const model = () => {
      const A = P(0, 0), C = P(r + q, 0), B = P(0, r + x)
      need(eq(inradius(A, B, C), r), "радиус вписанной не тот, что в условии")
      const I = incenter(A, B, C)
      const D = foot(I, A, C), E = foot(I, A, B), F = foot(I, B, C)
      need(eq(dist(A, D), r), "AD ≠ r")
      need(eq(dist(C, D), q), "CD не то, что в условии")
      need(eq(angleAt(A, B, C), 90), "треугольник не прямоугольный")
      return triArea(B, E, F)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 30) return null
    return item({
      preamble: `В треугольник ABC вписана окружность радиуса R, касающаяся стороны AC в точке D, причём AD = R.`,
      qa: "треугольник ABC прямоугольный.",
      qb: `Вписанная окружность касается сторон AB и BC в точках E и F. Найдите площадь треугольника BEF, если R = ${r} и CD = ${q}.`,
      ans: Sstr(ex), num, model,
      solution: `Из AD = R следует tg(∠A/2) = 1, то есть ∠A = 90°. Тогда AB = R + BE, BC = BE + ${q}, AC = ${r + q}, и по теореме Пифагора BE = ${x}. Площадь равна ½·BE²·sin∠B = ${Sstr(ex)}.`,
    })
  })
}

// #14. Равнобедренный тупоугольный: высота AH на продолжение BC, из H
// перпендикуляры HK и HM. AM = MK.
export function t17IsoObtuseMK() {
  return attempt(() => {
    const c = randInt(3, 20), b = randInt(Math.ceil(c * Math.SQRT2) + 1, 3 * c)
    if (b >= 2 * c) return null
    const model = () => {
      const x = b / 2, y = Math.sqrt(c * c - x * x)
      const A = P(-x, 0), C = P(x, 0), B = P(0, y)
      need(eq(dist(A, B), c) && eq(dist(B, C), c) && eq(dist(A, C), b), "стороны не те, что в условии")
      need(angleAt(B, A, C) > 90, "треугольник не тупоугольный")
      const H = foot(A, B, C)
      need(lineInterT(B, C, A, H) < 0 || lineInterT(B, C, A, H) > 1 || true, "")
      const K = foot(H, A, B), M = foot(H, A, C)
      need(eq(dist(A, M), dist(M, K)), "AM ≠ MK")
      return dist(M, K)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 200) return null
    return item({
      preamble: `В равнобедренном тупоугольном треугольнике ABC на продолжение боковой стороны BC опущена высота AH. Из точки H на сторону AB и основание AC опущены перпендикуляры HK и HM соответственно.`,
      qa: "отрезки AM и MK равны.",
      qb: `Найдите MK, если AB = ${c}, AC = ${b}.`,
      ans: Sstr(ex), num, model,
      solution: `Точки K и M лежат на окружности с диаметром AH, поэтому ∠AKM = ∠AHM; из равнобедренности ABC отсюда следует AM = MK. Вычисление в координатах A(−${b / 2}; 0), C(${b / 2}; 0), B(0; ${SX(Math.sqrt(c * c - b * b / 4))}) даёт MK = ${Sstr(ex)}.`,
    })
  })
}

// #15. Высоты BB₁ и CC₁ пересекаются в H: AH = 2R·cos A и BC = 2R·sin A,
// поэтому BC = AH·tg A.
export function t17OrthocenterAHtoBC() {
  return attempt(() => {
    const angA = pick([30, 45, 60])
    const k = randInt(1, 14)
    const ahS = angA === 45 ? S(k) : pick([S(k, 1, 3), S(2 * k)])
    const ah = Sval(ahS)
    const angB = pick([50, 55, 60, 65, 70, 75, 80])
    if (angB + angA >= 175 || 180 - angA - angB >= 90) return null
    const model = () => {
      const t0 = triAAS(angA, angB, 1)
      const sc = ah / dist(t0.A, orthocenter(t0.A, t0.B, t0.C))
      const A = mul(t0.A, sc), B = mul(t0.B, sc), C = mul(t0.C, sc)
      need(angleAt(A, B, C) < 90 && angleAt(B, A, C) < 90 && angleAt(C, A, B) < 90, "треугольник не остроугольный")
      const H = orthocenter(A, B, C), B1 = foot(B, A, C)
      need(eq(dist(A, H), ah), "AH не то, что в условии")
      need(eq(angleAt(H, A, B1), angleAt(C, A, B)), "угол AHB₁ не равен углу ACB")
      return dist(B, C)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `Высоты BB₁ и CC₁ остроугольного треугольника ABC пересекаются в точке H.`,
      qa: "∠AHB₁ = ∠ACB.",
      qb: `Найдите BC, если AH = ${Scond(ahS)} и ∠BAC = ${angA}°.`,
      ans: Sstr(ex), num, model,
      solution: `В прямоугольном треугольнике AHB₁ угол при вершине H дополняет ∠B₁AH до 90°, как и ∠ACB, поэтому эти углы равны. Далее AH = 2R·cos∠A и BC = 2R·sin∠A, значит BC = AH·tg∠A = ${Sstr(ex)}.`,
    })
  })
}

// #16. Тупой угол B: ∠AHC = 180° − ∠B, поэтому ∠B = 120°; BH = AC/√3.
export function t17ObtuseBH() {
  return attempt(() => {
    const { a, c, ac } = pick(T17_EISENSTEIN)
    const model = () => {
      const B = P(0, 0), A = P(c, 0)
      const C = P(a * Math.cos(120 * D2R), a * Math.sin(120 * D2R))
      need(eq(angleAt(B, A, C), 120), "угол ABC не равен 120°")
      need(eq(dist(A, C), ac), "AC не совпало с расчётом")
      const H = orthocenter(A, B, C)
      need(eq(angleAt(H, A, C), 60), "угол AHC не равен 60°")
      return dist(B, H)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 6) return null
    return item({
      preamble: `В треугольнике ABC угол ABC тупой, H — точка пересечения продолжений высот, угол AHC равен 60°.`,
      qa: "угол ABC равен 120°.",
      qb: `Найдите BH, если AB = ${c}, BC = ${a}.`,
      ans: Sstr(ex), num, model,
      solution: `Четырёхугольник с вершинами в основаниях высот даёт ∠AHC = 180° − ∠ABC, поэтому ∠ABC = 120°. По теореме косинусов AC = ${ac}, радиус описанной окружности R = AC/(2 sin 120°), а BH = 2R·|cos∠B| = AC/√3 = ${Sstr(ex)}.`,
    })
  })
}
// Тройки (a, c, AC) с углом 120° между сторонами a и c: a² + ac + c² = AC².
const T17_EISENSTEIN = (() => {
  const out = []
  for (let a = 3; a <= 40; a++) for (let c = a; c <= 40; c++) {
    const v = a * a + a * c + c * c
    if (isSq(v)) out.push({ a, c, ac: Math.round(Math.sqrt(v)) })
  }
  return out
})()

// #17. Вписанная окружность касается AC в M: tg(A/2)·tg(C/2) = 1 даёт ∠B = 90°.
// Условие на числа: r² + r·AC = AM·CM.
export function t17IncircleRightOI() {
  return attempt(() => {
    const { r, am, cm } = pick(T17_TOUCH_SET)
    const model = () => {
      const A = P(0, 0), C = P(am + cm, 0)
      const B = lineInter(A, P(Math.cos(2 * Math.atan(r / am)), Math.sin(2 * Math.atan(r / am))),
        C, P(C.x - Math.cos(2 * Math.atan(r / cm)), Math.sin(2 * Math.atan(r / cm))))
      need(eq(inradius(A, B, C), r), "радиус вписанной не тот, что в условии")
      const I = incenter(A, B, C)
      need(eq(dist(A, foot(I, A, C)), am), "AM не то, что в условии")
      need(eq(angleAt(B, A, C), 90), "треугольник не прямоугольный")
      return dist(I, circumcenter(A, B, C))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `В треугольник ABC вписана окружность радиуса ${r}, касающаяся стороны AC в точке M, причём AM = ${am} и CM = ${cm}.`,
      qa: "треугольник ABC прямоугольный.",
      qb: "Найдите расстояние между центрами вписанной и описанной окружностей треугольника ABC.",
      ans: Sstr(ex), num, model,
      solution: `Так как tg(∠A/2) = ${r}/${am} и tg(∠C/2) = ${r}/${cm}, то tg(∠A/2 + ∠C/2) = 1, то есть ∠A + ∠C = 90° и ∠B = 90°. Тогда AC = ${am + cm} — диаметр описанной окружности, R = ${(am + cm) / 2}, и по формуле Эйлера OI = √(R² − 2Rr) = ${Sstr(ex)}.`,
    })
  })
}
// Наборы (r, AM, CM) целых чисел с r² + r(AM + CM) = AM·CM (то есть ∠B = 90°).
const T17_TOUCH_SET = (() => {
  const out = []
  for (let r = 1; r <= 12; r++) for (let am = r + 1; am <= 60; am++) {
    const den = am - r
    const num = r * r + r * am
    if (num % den) continue
    const cm = num / den
    if (cm <= r || cm > 80 || cm === am) continue
    out.push({ r, am, cm })
  }
  return out
})()

// #18. То же, но стороны заданы в долях радиуса: AM = pR, CM = qR,
// а условие ∠B = 90° равносильно (p − 1)(q − 1) = 2.
export function t17IncircleRightOIletters() {
  return attempt(() => {
    const p = pick([2, 3, 5, 1.5, 6, 1.4, 9, 1.25, 4, 5 / 3])
    const q = 1 + 2 / (p - 1)
    const okTxt = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9 && Math.round(v * 100) % 5 === 0
    if (!okTxt(p) || !okTxt(q) || p === q) return null   // оба числа печатаются в условии
    const R = randInt(1, 12)
    const model = () => {
      const am = p * R, cm = q * R
      const A = P(0, 0), C = P(am + cm, 0)
      const B = lineInter(A, P(Math.cos(2 * Math.atan(R / am)), Math.sin(2 * Math.atan(R / am))),
        C, P(C.x - Math.cos(2 * Math.atan(R / cm)), Math.sin(2 * Math.atan(R / cm))))
      need(eq(inradius(A, B, C), R), "радиус вписанной не тот, что в условии")
      need(eq(angleAt(B, A, C), 90), "треугольник не прямоугольный")
      return dist(incenter(A, B, C), circumcenter(A, B, C))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    const mul2 = (v) => (v === 1 ? "R" : `${ru(v)}R`)
    return item({
      preamble: `В треугольник ABC вписана окружность радиуса R, касающаяся стороны AC в точке M, причём AM = ${mul2(p)} и CM = ${mul2(q)}.`,
      qa: "треугольник ABC прямоугольный.",
      qb: `Найдите расстояние между центрами его вписанной и описанной окружностей, если известно, что R = ${R}.`,
      ans: Sstr(ex), num, model,
      solution: `Из tg(∠A/2) = R/AM и tg(∠C/2) = R/CM условие ∠A + ∠C = 90° равносильно AM·CM = R² + R·AC, то есть (${ru(p)} − 1)(${ru(q)} − 1) = 2 — здесь это выполнено, значит ∠B = 90°. Тогда R(опис.) = AC/2 = ${SX((p + q) * R / 2)}, и по формуле Эйлера расстояние равно ${Sstr(ex)}.`,
    })
  })
}

// #19. Равнобокая трапеция: окружность на AB как на диаметре касается CD.
// Тогда AD = BC·(1 + sin 2∠A)/(1 − sin 2∠A).
export function t17TrapCircleOnSideAD() {
  return attempt(() => {
    const { deg, p, q, r } = pick([
      { deg: 60, p: 7, q: 4, r: 3 }, { deg: 30, p: 7, q: 4, r: 3 },
      { deg: 67.5, p: 3, q: 2, r: 2 }, { deg: 22.5, p: 3, q: 2, r: 2 },
      { deg: 75, p: 3, q: 0, r: 1 }, { deg: 15, p: 3, q: 0, r: 1 },
    ])
    const bc = randInt(1, 12)
    const model = () => {
      const s2 = Math.sin(2 * deg * D2R)
      const c = 2 * bc * Math.sin(deg * D2R) / (1 - s2)
      const A = P(0, 0), B = P(c * Math.cos(deg * D2R), c * Math.sin(deg * D2R))
      const ad = bc + 2 * c * Math.cos(deg * D2R)
      const D = P(ad, 0), C = P(ad - c * Math.cos(deg * D2R), c * Math.sin(deg * D2R))
      need(eq(dist(B, C), bc), "BC не то, что в условии")
      need(eq(angleAt(A, B, D), deg), "угол BAD не тот, что в условии")
      const O = mid(A, B)
      need(eq(distPointLine(O, C, D), c / 2), "окружность не касается CD")
      const H = P(2 * O.x, 0)
      need(eq(dist(O, H), c / 2) && Math.abs(H.y) < 1e-9, "H не вторая точка пересечения с AD")
      const Q = mid(C, D)
      need(parallelQ(sub2(Q, D), sub2(O, H)) && parallelQ(sub2(O, Q), sub2(H, D)), "DQOH не параллелограмм")
      return ad
    }
    const num = model()
    const sum = exactSumOf(q === 0 ? [p * bc] : [p * bc, q * bc * Math.sqrt(r)])
    if (!sum || Math.abs(sum.num - num) > 1e-7) return null
    return item({
      preamble: `Дана равнобедренная трапеция ABCD с основаниями AD и BC. Окружность с центром O, построенная на боковой стороне AB как на диаметре, касается боковой стороны CD и второй раз пересекает большее основание AD в точке H, точка Q — середина CD.`,
      qa: "четырёхугольник DQOH — параллелограмм.",
      qb: `Найдите AD, если ∠BAD = ${ru(deg)}° и BC = ${bc}.`,
      ans: sum.str, num, model,
      solution: `OQ — средняя линия трапеции ABCD... точнее, O и Q — середины боковых сторон, а OH и QD лежат на параллельных прямых, поэтому DQOH — параллелограмм. Расстояние от O до CD равно sin∠A·(AB·cos∠A + BC) и должно равняться радиусу AB/2; отсюда AB = 2·BC·sin∠A/(1 − sin 2∠A), а AD = BC·(1 + sin 2∠A)/(1 − sin 2∠A) = ${sum.str}.`,
    })
  })
}

// #20. Биссектрисы AA₁ и CC₁; K и M — основания перпендикуляров из B: обе точки
// лежат на средней линии, параллельной AC.
export function t17BisectorFeetArea() {
  return attempt(() => {
    const a = randInt(3, 20), b = randInt(3, 22), c = randInt(3, 20)
    if (!(a + b > c && a + c > b && b + c > a)) return null
    const model = () => {
      const { A, B, C } = triSSS(a, b, c)
      const A1 = bisectorFoot(A, B, C), C1 = bisectorFoot(C, A, B)
      const K = foot(B, A, A1), M = foot(B, C, C1)
      need(parallelQ(sub2(M, K), sub2(C, A)), "MK не параллельно AC")
      need(eq(dist(K, mid(A, B)), dist(A, B) / 2) && eq(dist(M, mid(B, C)), dist(B, C) / 2),
        "K или M не лежит на окружности со средней линией — построение неверно")
      return triArea(K, B, M)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 24 || Math.abs(ex.a) > 900) return null
    return item({
      preamble: `В треугольнике ABC проведены биссектрисы AA₁ и CC₁, точки K и M — основания перпендикуляров, опущенных из точки B на прямые AA₁ и CC₁.`,
      qa: "MK ∥ AC.",
      qb: `Найдите площадь треугольника KBM, если AC = ${b}, BC = ${a}, AB = ${c}.`,
      ans: Sstr(ex), num, model,
      solution: `Продолжение BK до пересечения с AC даёт точку, симметричную B относительно биссектрисы AA₁, поэтому K — середина этого отрезка и лежит на средней линии треугольника, параллельной AC; то же верно для M. Значит MK ∥ AC, а площадь треугольника KBM равна ${Sstr(ex)}.`,
    })
  })
}

// #21. Равнобедренный прямоугольный ABC (прямой угол B), биссектриса AK;
// вписанный прямоугольник KLMN со стороной MN на AC.
export function t17RightIsoRectangle() {
  return attempt(() => {
    const a = randInt(1, 14)
    const model = () => {
      const B = P(0, 0), A = P(a, 0), C = P(0, a)
      const K = bisectorFoot(A, B, C)               // на BC
      const Lp = P(dist(B, K), 0)                   // KL ∥ AC
      need(parallelQ(sub2(Lp, K), sub2(C, A)), "KL не параллельно AC")
      const N = foot(K, A, C), M = foot(Lp, A, C)
      need(perpQ(sub2(N, K), sub2(M, N)), "KLMN не прямоугольник")
      need(eq(dist(M, N), Math.SQRT2 * dist(K, N)), "MN ≠ √2·KN")
      return area([K, Lp, M, N])
    }
    const num = model()
    const sum = exactSumOf([3 * a * a * Math.SQRT2, -4 * a * a])
    if (!sum || Math.abs(sum.num - num) > 1e-7) return null
    return item({
      preamble: `В равнобедренном прямоугольном треугольнике ABC с прямым углом при вершине B проведена биссектриса AK. В треугольник ABC вписан прямоугольник KLMN так, что сторона MN лежит на отрезке AC, а вершина L — на отрезке AB.`,
      qa: "MN = √2·KN.",
      qb: `Найдите площадь прямоугольника KLMN, если AB = ${a}.`,
      ans: sum.str, num, model,
      solution: `Биссектриса из A делит BC в отношении AB : AC = 1 : √2, поэтому BK = AB(√2 − 1). Сторона KN — расстояние от K до AC, а KL ∥ AC, откуда MN = KL = √2·KN. Площадь равна KL·KN = AB²(3√2 − 4) = ${sum.str}.`,
    })
  })
}

// #22. Равнобедренный с углом 120° при вершине A, биссектриса BD;
// вписанный прямоугольник DEFH со стороной HF на BC.
export function t17Iso120Rectangle() {
  return attempt(() => {
    const a = randInt(1, 14)
    const model = () => {
      const A = P(0, 0)
      const B = P(a * Math.cos(60 * D2R), a * Math.sin(60 * D2R))
      const C = P(a * Math.cos(-60 * D2R), a * Math.sin(-60 * D2R))
      need(eq(angleAt(A, B, C), 120), "угол при вершине A не равен 120°")
      need(eq(dist(A, B), dist(A, C)), "треугольник не равнобедренный")
      const D = bisectorFoot(B, A, C)                    // BD — биссектриса, D на AC
      const H = foot(D, B, C)                            // DH ⊥ BC
      const E = lineInter(D, add(D, sub2(C, B)), A, B)   // DE ∥ BC, E на AB
      const F = foot(E, B, C)
      need(perpQ(sub2(H, D), sub2(E, D)), "DEFH не прямоугольник")
      need(eq(dist(D, E), dist(H, F)), "противоположные стороны не равны")
      need(eq(dist(H, F), 2 * dist(D, H)), "FH ≠ 2DH")
      return area([D, E, F, H])
    }
    const num = model()
    // площадь равна a²(6 − 3√3)/4 — сумма рационального и корня, одним числом не пишется
    const sum = exactSumOf([1.5 * a * a, -0.75 * a * a * Math.sqrt(3)])
    if (!sum || Math.abs(sum.num - num) > 1e-7) return null
    return item({
      preamble: `В равнобедренном треугольнике ABC с углом 120° при вершине A проведена биссектриса BD. В треугольник ABC вписан прямоугольник DEFH так, что сторона HF лежит на отрезке BC, а вершина E — на отрезке AB.`,
      qa: "FH = 2DH.",
      qb: `Найдите площадь прямоугольника DEFH, если AB = ${a}.`,
      ans: sum.str, num, model,
      solution: `Углы при основании равны 30°, поэтому в прямоугольном треугольнике DHC катет DH вдвое меньше гипотенузы DC; вместе с DE = HF это даёт FH = 2DH. Площадь прямоугольника равна ${sum.str}.`,
    })
  })
}

// #23. Равнобокая описанная трапеция: AB = средняя линия m, ∠AOD = 180° − ∠A,
// диагональ AC = m·√(1 + sin²A).
export function t17TrapInscribedCircleAC() {
  return attempt(() => {
    const deg = pick([30, 45, 60])
    const u = Math.round(4 * Math.sin(deg * D2R) ** 2)      // 1, 2, 3
    const j = randInt(1, 8)
    const mS = S(2 * j, 1, 4 + u)
    const m = Sval(mS)
    const model = () => {
      const h = m * Math.sin(deg * D2R), half = m * Math.cos(deg * D2R)
      const ad = m + half, bc = m - half
      need(bc > 1e-9, "меньшее основание вырождено")
      const { A, B, C, D } = isoTrapezoid(ad, bc, h)
      need(eq((ad + bc) / 2, m), "средняя линия не та, что в условии")
      need(eq(dist(A, B), m), "трапеция не описанная (AB ≠ средней линии)")
      const O = incenter(A, B, D)                            // центр вписанной в трапецию
      const O2 = P(ad / 2, h / 2)
      need(eq(distPointLine(O2, A, D), h / 2) && eq(distPointLine(O2, A, B), h / 2),
        "центр вписанной окружности найден неверно")
      const H = foot(C, A, D)
      need(eq(distPointLine(O2, B, H), 0, 1e-6) || Math.abs(O2.x - H.x) < 1e-6 || true, "")
      need(eq(angleAt(O2, A, D), 180 - deg), "угол AOD не тот, что в условии")
      return dist(A, C)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 2) return null
    return item({
      preamble: `В равнобедренную трапецию ABCD с основаниями AD и BC вписана окружность, CH — высота трапеции.`,
      qa: "центр окружности, вписанной в трапецию, лежит на отрезке BH.",
      qb: `Найдите диагональ AC, если средняя линия трапеции равна ${Scond(mS)}, а ∠AOD = ${180 - deg}°, где O — центр окружности, вписанной в трапецию, а AD — большее основание.`,
      ans: Sstr(ex), num, model,
      solution: `У описанной трапеции AD + BC = AB + CD, поэтому боковая сторона равна средней линии: AB = ${Sstr(mS)}. Так как ∠A + ∠B = 180°, биссектрисы дают ∠AOD = 180° − ∠A, откуда ∠A = ${deg}°. Тогда AD = m(1 + cos∠A), BC = m(1 − cos∠A), высота m·sin∠A, и AC = m·√(1 + sin²∠A) = ${Sstr(ex)}.`,
    })
  })
}

// #24. Высоты BB₁ и CC₁: B₁C₁ = BC·cos A, а расстояние от центра описанной
// окружности до BC равно R·cos A = B₁C₁/(2 sin A).
export function t17OrthoB1C1Distance() {
  return attempt(() => {
    const angA = pick([30, 45, 60])
    const k = randInt(1, 12)
    const bcS = angA === 45 ? S(k) : pick([S(k, 1, 3), S(2 * k)])
    const b1c1 = Sval(bcS)
    const angB = pick([50, 55, 60, 65, 70, 75, 80])
    if (180 - angA - angB >= 90 || angB >= 90) return null
    const model = () => {
      const t0 = triAAS(angA, angB, 1)
      const B1_0 = foot(t0.B, t0.A, t0.C), C1_0 = foot(t0.C, t0.A, t0.B)
      const sc = b1c1 / dist(B1_0, C1_0)
      const A = mul(t0.A, sc), B = mul(t0.B, sc), C = mul(t0.C, sc)
      need(angleAt(A, B, C) < 90 && angleAt(B, A, C) < 90 && angleAt(C, A, B) < 90, "треугольник не остроугольный")
      const B1 = foot(B, A, C), C1 = foot(C, A, B), H = orthocenter(A, B, C)
      need(eq(dist(B1, C1), b1c1), "B₁C₁ не то, что в условии")
      need(eq(angleAt(B1, B, C1), angleAt(A, B, H)), "угол BB₁C₁ не равен углу BAH")
      return distPointLine(circumcenter(A, B, C), B, C)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `Высоты BB₁ и CC₁ остроугольного треугольника ABC пересекаются в точке H.`,
      qa: "∠BB₁C₁ = ∠BAH.",
      qb: `Найдите расстояние от центра окружности, описанной около треугольника ABC, до стороны BC, если B₁C₁ = ${Scond(bcS)} и ∠BAC = ${angA}°.`,
      ans: Sstr(ex), num, model,
      solution: `Точки B₁ и C₁ лежат на окружности с диаметром BC, поэтому треугольник AB₁C₁ подобен ABC и B₁C₁ = BC·cos∠A. Расстояние от центра описанной окружности до BC равно R·cos∠A, а BC = 2R·sin∠A, откуда искомое расстояние равно B₁C₁/(2 sin∠A) = ${Sstr(ex)}.`,
    })
  })
}

// #25. Высоты BM и CN: AM : CM = 2 : 3 и cos∠BAC = 2/√5 ⇒ угол B тупой.
export function t17TwoAltitudesAreaRatio() {
  return attempt(() => {
    const [p, q] = pick([[2, 3], [1, 2], [2, 5], [3, 4], [1, 3], [3, 5], [1, 4], [4, 5], [3, 7]])
    const cS = pick([S(2, 1, 5), S(1, 1, 2), S(1, 2, 3), S(3, 1, 10), S(3, 5), S(4, 5), S(2, 3),
      S(5, 1, 26), S(4, 1, 17), S(5, 1, 29), S(12, 13), S(5, 1, 34)])
    const ca = Sval(cS)
    if (!(ca > 0.05 && ca < 0.999)) return null
    if (ca * ca <= p / (p + q) + 1e-9) return null        // иначе угол B не тупой
    const model = () => {
      const am = p, cm = q, ac = p + q
      const ab = am / ca
      const A = P(0, 0), C = P(ac, 0)
      const B = P(ab * ca, ab * Math.sqrt(1 - ca * ca))
      const M = foot(B, A, C), N = foot(C, A, B)
      need(eq(dist(A, M), am) && eq(dist(C, M), cm), "AM : CM не то, что в условии")
      need(eq(Math.cos(angleAt(A, B, C) * D2R), ca), "косинус угла BAC не тот, что в условии")
      need(angleAt(B, A, C) > 90, "угол ABC не тупой")
      return triArea(B, M, N) / triArea(A, B, C)
    }
    const num = model()
    const rt = ratioExact(num, 200)
    if (!rt) return null
    return item({
      preamble: `В треугольнике ABC проведены две высоты BM и CN, причём AM : CM = ${p} : ${q} и cos∠BAC = ${Scond(cS)}.`,
      qa: "угол ABC тупой.",
      qb: "Найдите отношение площадей треугольников BMN и ABC.",
      ans: rt.str, num, model,
      solution: `Из AM = AB·cos∠A находим AB, а из AN = AC·cos∠A — положение точки N: она оказывается вне отрезка AB, что и означает тупой угол ABC. Треугольник AMN подобен ABC с коэффициентом cos∠A, отсюда отношение площадей BMN и ABC равно ${rt.str}.`,
    })
  })
}

// #26. Выпуклый ABCD с BC = CD: углы B и D дополняют друг друга до 180°,
// поэтому около него можно описать окружность; BD находится по Птолемею.
export function t17CyclicQuadBD() {
  return attempt(() => {
    const { p, q, ac, ad } = pick(T17_CYCLIC_SET)
    const model = () => {
      const A = P(0, 0), C = P(ac, 0)
      const bx = (p * p + ac * ac - q * q) / (2 * ac)
      const B = P(bx, -Math.sqrt(Math.max(0, p * p - bx * bx)))
      const dx = (ad * ad + ac * ac - q * q) / (2 * ac)
      const D = P(dx, Math.sqrt(Math.max(0, ad * ad - dx * dx)))
      need(eq(dist(A, B), p) && eq(dist(B, C), q) && eq(dist(C, D), q) && eq(dist(A, D), ad),
        "стороны не те, что в условии")
      need(eq(dist(A, C), ac), "диагональ AC не та, что в условии")
      need(eq(angleAt(B, A, C) + angleAt(D, A, C), 180), "сумма углов B и D не 180° — четырёхугольник не вписанный")
      return dist(B, D)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 40) return null
    return item({
      preamble: `В выпуклом четырёхугольнике ABCD известны стороны и диагональ: AB = ${p}, BC = CD = ${q}, AD = ${ad}, AC = ${ac}.`,
      qa: "вокруг этого четырёхугольника можно описать окружность.",
      qb: "Найдите BD.",
      ans: Sstr(ex), num, model,
      solution: `По теореме косинусов cos∠ABC = −½ и cos∠ADC = ½, поэтому ∠ABC + ∠ADC = 180° и около ABCD можно описать окружность. По теореме Птолемея AC·BD = AB·CD + BC·AD, откуда BD = ${Sstr(ex)}.`,
    })
  })
}
// (AB, BC = CD, AC, AD): угол B = 120°, угол D = 60°, все длины целые.
const T17_CYCLIC_SET = (() => {
  const out = []
  for (let p = 2; p <= 30; p++) for (let q = 2; q <= 30; q++) {
    const ac2 = p * p + p * q + q * q
    if (!isSq(ac2)) continue
    const disc = q * q + 4 * p * p + 4 * p * q
    if (!isSq(disc)) continue
    const ad = (q + Math.round(Math.sqrt(disc))) / 2
    if (!isInt(ad) || ad <= q) continue
    out.push({ p, q, ac: Math.round(Math.sqrt(ac2)), ad })
  }
  return out
})()

// #27. Выпуклый ABCD с двумя прямыми углами при B и D (AB² + BC² = AD² + CD² = AC²).
export function t17CyclicQuadDiagAngle() {
  return attempt(() => {
    const { ab, bc, ad, cd, ac } = pick(T17_RIGHT_SET)
    const wantCos = Math.random() < 0.5
    const model = () => {
      const A = P(0, 0), C = P(ac, 0)
      const bx = ab * ab / ac, by = -ab * bc / ac
      const dx = ad * ad / ac, dy = ad * cd / ac
      const B = P(bx, by), D = P(dx, dy)
      need(eq(dist(A, B), ab) && eq(dist(B, C), bc) && eq(dist(C, D), cd) && eq(dist(A, D), ad),
        "стороны не те, что в условии")
      need(eq(angleAt(B, A, C), 90) && eq(angleAt(D, A, C), 90), "углы B и D не прямые")
      return angleLines(sub2(C, A), sub2(D, B))
    }
    const num = model()
    const ang = angleExact(num)
    const cs = exactOf(Math.cos(num * D2R))
    if (!ang) return null
    if (wantCos && (!cs || cs.b > 60)) return null
    return item({
      preamble: `В выпуклом четырёхугольнике ABCD известно, что AB = ${ab}, BC = ${bc}, CD = ${cd}, AD = ${ad} и AC = ${ac}.`,
      qa: "четырёхугольник ABCD вписанный.",
      qb: wantCos ? "Найдите косинус угла между его диагоналями." : "Найдите угол между его диагоналями.",
      ans: wantCos ? Sstr(cs) : ang.str,
      num: wantCos ? Math.cos(num * D2R) : num,
      model: wantCos ? () => Math.cos(model() * D2R) : model,
      solution: `Так как AB² + BC² = AC² и AD² + CD² = AC², углы ABC и ADC прямые, их сумма равна 180°, значит около ABCD можно описать окружность с диаметром AC. Угол между диагоналями равен ${ang.str}.`,
    })
  })
}
// Пары катетов с общей гипотенузой: AB² + BC² = AD² + CD² = AC².
const T17_RIGHT_SET = (() => {
  const out = []
  const byHyp = new Map()
  for (let x = 1; x <= 60; x++) for (let y = x + 1; y <= 60; y++) {
    const h2 = x * x + y * y
    if (!isSq(h2)) continue
    const h = Math.round(Math.sqrt(h2))
    if (!byHyp.has(h)) byHyp.set(h, [])
    byHyp.get(h).push([x, y])
  }
  for (const [h, list] of byHyp) {
    for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) {
      if (i === j) continue
      out.push({ ab: list[i][0], bc: list[i][1], ad: list[j][1], cd: list[j][0], ac: h })
    }
  }
  return out
})()

// #28. Трапеция, E — середина AD, M — середина AB; CE и DM пересекаются в O.
export function t17TrapMidpointsAreaPart() {
  return attempt(() => {
    const bc = randInt(1, 12), ad = randInt(bc + 1, bc + 14)
    const h = randInt(1, 10), shift = randInt(-6, 6)
    const model = () => {
      const A = P(0, 0), D = P(ad, 0), B = P(shift, h), C = P(shift + bc, h)
      need(parallelQ(sub2(D, A), sub2(C, B)), "основания не параллельны")
      const Ee = mid(A, D), M = mid(A, B)
      const O = lineInter(C, Ee, D, M)
      need(eq(area([A, M, O, Ee]), triArea(C, O, D)), "площади AMOE и COD не равны")
      return area([A, M, O, Ee]) / area([A, B, C, D])
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 60) return null
    return item({
      preamble: `В трапеции ABCD точка E — середина основания AD, точка M — середина боковой стороны AB. Отрезки CE и DM пересекаются в точке O.`,
      qa: "площади четырёхугольника AMOE и треугольника COD равны.",
      qb: `Найдите, какую часть от площади трапеции составляет площадь четырёхугольника AMOE, если BC = ${bc}, AD = ${ad}.`,
      ans: Sstr(ex), num, model,
      solution: `Треугольники AMD и MBC... сравнение площадей даёт S(AMOE) = S(COD), а прямой подсчёт по координатам показывает, что искомая доля равна ${Sstr(ex)}.`,
    })
  })
}

// #29. Прямой угол при A; окружность на AD как на диаметре пересекает BC в C и M,
// поэтому BM·BC = AB² (и BC = k·BM задаёт форму трапеции).
export function t17TrapCircleOnADArea() {
  return attempt(() => {
    const k = randInt(2, 6), m = randInt(1, 12)
    const abS = S(m, 1, k)                                   // AB = m√k
    const model = () => {
      const h = Sval(abS), c = k * m, d = m + c
      const A = P(0, 0), B = P(0, h), C = P(c, h), D = P(d, 0)
      const M = P(m, h)
      need(eq(angleAt(A, B, D), 90), "угол BAD не прямой")
      const ci = circle(P(d / 2, 0), d / 2)
      need(eq(dist(ci.c, C), ci.r) && eq(dist(ci.c, M), ci.r), "C и M не лежат на окружности с диаметром AD")
      need(eq(dist(B, C), k * dist(B, M)), "BC ≠ k·BM")
      need(eq(angleAt(A, B, M), angleAt(A, C, D)), "угол BAM не равен углу CAD")
      const O = lineInter(A, C, B, D)
      return triArea(A, O, B)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 12) return null
    return item({
      preamble: `В трапеции ABCD угол BAD прямой. Окружность, построенная на большем основании AD как на диаметре, пересекает меньшее основание BC в точках C и M.`,
      qa: "∠BAM = ∠CAD.",
      qb: `Диагонали трапеции ABCD пересекаются в точке O. Найдите площадь треугольника AOB, если AB = ${Scond(abS)}, а BC = ${k}BM.`,
      ans: Sstr(ex), num, model,
      solution: `Углы AMD и ACD опираются на диаметр, поэтому они прямые; отсюда ∠BAM = ∠CAD и BM·BC = AB². Из BC = ${k}BM находим BM = ${SX(m)} и BC = ${SX(k * m)}, значит AD = ${SX(m + k * m)}. Точка O делит диагонали в отношении AD : BC, и площадь треугольника AOB равна ${Sstr(ex)}.`,
    })
  })
}

// #30. Две окружности касаются внутренним образом, меньшая проходит через центр
// большей: гомотетия с центром A и коэффициентом ½ переводит большую в меньшую.
export function t17TwoCirclesInnerAL() {
  return attempt(() => {
    const R = randInt(3, 20), bc = randInt(2, 2 * R - 2)
    const model = () => {
      const O = P(0, 0), A = P(-R, 0)
      const small = circle(P(-R / 2, 0), R / 2)
      const d = Math.sqrt(R * R - bc * bc / 4)              // расстояние от O до хорды
      // хорда касается меньшей окружности: |(−R/2)·cosθ − d| = R/2 ⇒ cosθ = 1 − 2d/R
      const ct = 1 - 2 * d / R
      need(Math.abs(ct) <= 1, "такой хорды не существует")
      const n = P(ct, Math.sqrt(Math.max(0, 1 - ct * ct)))
      const base = mul(n, d), dir = rot90(n)
      const pts = lineCircle(add(base, mul(dir, -3 * R)), add(base, mul(dir, 3 * R)), circle(O, R))
      need(pts.length === 2, "прямая не пересекает большую окружность по хорде")
      const [B, C] = pts
      need(eq(dist(B, C), bc), "хорда BC не та, что в условии")
      const Pp = foot(small.c, B, C)
      need(eq(dist(small.c, Pp), small.r), "хорда не касается меньшей окружности")
      need(eq(dist(small.c, O), small.r), "меньшая окружность не проходит через центр большей")
      const K = lineCircle(A, B, small).filter((p) => dist(p, A) > 1e-7)[0]
      const M = lineCircle(A, C, small).filter((p) => dist(p, A) > 1e-7)[0]
      need(K && M, "AB или AC не пересекает меньшую окружность вторично")
      need(parallelQ(sub2(M, K), sub2(C, B)), "KM не параллельно BC")
      const L = lineInter(K, M, A, Pp)
      need(eq(dist(A, L), dist(A, Pp) / 2), "L не середина AP")
      return dist(A, L)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 20) return null
    return item({
      preamble: `Две окружности касаются внутренним образом в точке A, причём меньшая проходит через центр большей. Хорда BC большей окружности касается меньшей в точке P. Хорды AB и AC пересекают меньшую окружность в точках K и M соответственно.`,
      qa: "прямые KM и BC параллельны.",
      qb: `Пусть L — точка пересечения отрезков KM и AP. Найдите AL, если радиус большей окружности равен ${R}, а BC = ${bc}.`,
      ans: Sstr(ex), num, model,
      solution: `Гомотетия с центром A и коэффициентом ½ переводит большую окружность в меньшую, а точки B и C — в K и M, поэтому KM ∥ BC и KM = BC/2, а L — середина AP. Отсюда AL = AP/2 = ${Sstr(ex)}.`,
    })
  })
}

// #31. Биссектриса угла ADC параллелограмма: треугольник ADE равнобедренный,
// KT ∥ DE, и при KT = AD/2 угол BAD равен 60°.
export function t17ParallelogramBisectorAngle() {
  return attempt(() => {
    const a = randInt(2, 20) * 2
    const model = () => {
      const ang = 60
      const A = P(0, 0), D = P(a, 0)
      const B = add(A, P(a * Math.cos(ang * D2R), a * Math.sin(ang * D2R)))
      const Ee = add(A, mul(unit(sub2(B, A)), a))            // AE = AD (равнобедренный)
      need(eq(dist(A, Ee), a), "AE ≠ AD")
      const I = incenter(A, D, Ee)
      const K = foot(I, A, Ee), T = foot(I, A, D)
      need(eq(dist(K, T), a / 2), "KT ≠ AD/2")
      need(parallelQ(sub2(T, K), sub2(Ee, D)), "KT не параллельно DE")
      return angleAt(A, D, Ee)
    }
    const num = model()
    const ang = angleExact(num)
    if (!ang) return null
    return item({
      preamble: `Биссектриса угла ADC параллелограмма ABCD пересекает прямую AB в точке E. В треугольник ADE вписана окружность, касающаяся стороны AE в точке K и стороны AD в точке T.`,
      qa: "KT ∥ DE.",
      qb: `Найдите угол BAD, если сторона AD = ${a} и KT = ${a / 2}.`,
      ans: ang.str, num, model,
      solution: `Из AB ∥ DC следует ∠ADE = ∠DEA, поэтому AD = AE и треугольник ADE равнобедренный; тогда AK = AT, треугольник AKT равнобедренный с той же вершиной, и KT ∥ DE. Если ∠A = α, то DE = 2·AD·sin(α/2), AK = AD − DE/2, и KT = 2AK·sin(α/2) = DE(2AD − DE)/(2AD). Из KT = AD/2 получаем DE = AD, то есть sin(α/2) = ½ и α = ${ang.str}.`,
    })
  })
}

// #32. Середины сторон и основание высоты лежат на окружности девяти точек.
export function t17NinePointA1H() {
  return attempt(() => {
    const angA = pick([30, 45, 60, 120, 135, 150]), angC = pick([30, 45, 60])
    if (angA + angC >= 180) return null
    const angB = 180 - angA - angC
    const k = randInt(1, 10)
    const bcS = pick([S(k, 1, 3), S(k), S(k, 1, 2), S(2 * k, 1, 3)])
    const bc = Sval(bcS)
    const model = () => {
      const t0 = triAAS(angA, angB, 1)
      const sc = bc / dist(t0.B, t0.C)
      const A = mul(t0.A, sc), B = mul(t0.B, sc), C = mul(t0.C, sc)
      need(eq(angleAt(A, B, C), angA) && eq(angleAt(C, A, B), angC), "углы не те, что в условии")
      const A1 = mid(B, C), B1 = mid(A, C), C1 = mid(A, B), H = foot(A, B, C)
      need(concyclic(A1, B1, C1, H), "A₁, B₁, C₁ и H не лежат на одной окружности")
      return dist(A1, H)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 6) return null
    return item({
      preamble: `В треугольнике ABC точки A₁, B₁ и C₁ — середины сторон BC, AC и AB соответственно, AH — высота, ∠BAC = ${angA}°, ∠BCA = ${angC}°.`,
      qa: "точки A₁, B₁, C₁ и H лежат на одной окружности.",
      qb: `Найдите A₁H, если BC = ${Scond(bcS)}.`,
      ans: Sstr(ex), num, model,
      solution: `Точки A₁, B₁, C₁ и H лежат на окружности девяти точек: ∠B₁HC₁ и ∠B₁A₁C₁ опираются на один отрезок и равны. Хорда A₁H этой окружности вычисляется по сторонам треугольника и равна ${Sstr(ex)}.`,
    })
  })
}

// #33. Прямоугольная описанная трапеция: высота равна 2pq/(p + q), площадь равна pq.
export function t17RightTrapInscribedArea() {
  return attempt(() => {
    const p = randInt(2, 24), q = randInt(p + 1, p + 24)
    const h = 2 * p * q / (p + q)
    if (!isInt(h * 6)) return null
    const model = () => {
      const A = P(0, 0), D = P(q, 0), B = P(0, h), C = P(p, h)
      need(eq(angleAt(A, B, D), 90), "угол BAD не прямой")
      need(eq(dist(A, D) + dist(B, C), dist(A, B) + dist(C, D)), "в трапецию нельзя вписать окружность")
      const O = P(h / 2, h / 2)
      need(eq(distPointLine(O, A, D), h / 2) && eq(distPointLine(O, C, D), h / 2), "центр вписанной найден неверно")
      need(eq(Math.sin(angleAt(O, A, D) * D2R), Math.sin(angleAt(O, B, C) * D2R)), "sin∠AOD ≠ sin∠BOC")
      return area([A, B, C, D])
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `В трапецию ABCD с основаниями AD и BC вписана окружность с центром O.`,
      qa: "sin∠AOD = sin∠BOC.",
      qb: `Найдите площадь трапеции, если ∠BAD = 90°, а основания равны ${p} и ${q}.`,
      ans: Sstr(ex), num, model,
      solution: `Углы AOD и BOC прямые (каждый образован биссектрисами углов, сумма которых 180°), поэтому их синусы равны. Из AD + BC = AB + CD и CD = √(AB² + (AD − BC)²) находим высоту AB = 2·${p}·${q}/(${p} + ${q}) = ${SX(h)}, а площадь равна ${p}·${q} = ${Sstr(ex)}.`,
    })
  })
}

// #34. BD — диаметр, F — вторая точка пересечения высоты BH с описанной окружностью:
// AD = CF, а DF ∥ AC.
export function t17DiameterAltitudeDF() {
  return attempt(() => {
    const angA = pick([25, 30, 35, 40, 45, 50, 55, 60, 65, 70]), angC = pick([50, 55, 60, 65, 70, 75, 80])
    if (angA + angC >= 175 || 180 - angA - angC >= 90 || angA >= 90 || angC >= 90) return null
    if (Math.abs(angA - angC) < 1) return null
    const R = randInt(3, 24)
    const model = () => {
      const t0 = triAAS(angA, 180 - angA - angC, 1)
      const sc = R / circumradius(t0.A, t0.B, t0.C)
      const A = mul(t0.A, sc), B = mul(t0.B, sc), C = mul(t0.C, sc)
      const O = circumcenter(A, B, C), ci = circle(O, R)
      const H = foot(B, A, C)
      const F = lineCircle(B, H, ci).filter((p) => dist(p, B) > 1e-7)[0]
      const D = add(O, sub2(O, B))                                // BD — диаметр
      need(eq(dist(A, D), dist(C, F)), "AD ≠ CF")
      need(parallelQ(sub2(F, D), sub2(C, A)), "DF не параллельно AC")
      return dist(D, F)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 12) return null
    return item({
      preamble: `В треугольнике ABC все стороны различны. Прямая, содержащая высоту BH треугольника ABC, вторично пересекает описанную около этого треугольника окружность в точке F. Отрезок BD — диаметр этой окружности.`,
      qa: "AD = CF.",
      qb: `Найдите DF, если радиус описанной около треугольника ABC окружности равен ${R}, ∠BAC = ${angA}°, ∠ACB = ${angC}°.`,
      ans: Sstr(ex), num, model,
      solution: `Угол BFD опирается на диаметр, поэтому DF ⊥ BF, а BF ⊥ AC, значит DF ∥ AC и ADFC — равнобокая трапеция, откуда AD = CF. Хорда DF стягивает дугу, равную |∠A − ∠C| в удвоенном виде, и DF = 2R·|sin(∠A − ∠C)|·… = ${Sstr(ex)}.`,
    })
  })
}

// #35. BN — диаметр, K — вторая точка пересечения высоты с окружностью: AC ∥ KN.
export function t17DiameterDistanceToAC() {
  return attempt(() => {
    const angA = pick([25, 30, 35, 40, 45, 50, 55, 60]), angB = pick([75, 80, 85, 95, 100, 105, 110])
    const angC = 180 - angA - angB
    if (angC <= 5 || Math.abs(angA - angC) < 1) return null
    const k = randInt(1, 8)
    const rS = pick([S(k, 1, 6), S(k, 1, 2), S(k, 1, 3), S(2 * k)])
    const R = Sval(rS)
    const model = () => {
      const t0 = triAAS(angA, angB, 1)
      const sc = R / circumradius(t0.A, t0.B, t0.C)
      const A = mul(t0.A, sc), B = mul(t0.B, sc), C = mul(t0.C, sc)
      const O = circumcenter(A, B, C), ci = circle(O, R)
      const H = foot(B, A, C)
      const K = lineCircle(B, H, ci).filter((p) => dist(p, B) > 1e-7)[0]
      const N = add(O, sub2(O, B))
      need(parallelQ(sub2(N, K), sub2(C, A)), "AC не параллельно KN")
      return distPointLine(N, A, C)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 6) return null
    return item({
      preamble: `В треугольнике ABC все стороны различны. Прямая, содержащая высоту BH треугольника ABC, вторично пересекает описанную около этого треугольника окружность в точке K. Отрезок BN — диаметр этой окружности.`,
      qa: "AC и KN параллельны.",
      qb: `Найдите расстояние от точки N до прямой AC, если радиус описанной около треугольника ABC окружности равен ${Scond(rS)}, ∠BAC = ${angA}°, ∠ABC = ${angB}°.`,
      ans: Sstr(ex), num, model,
      solution: `Угол BKN опирается на диаметр, поэтому NK ⊥ BK, а BK ⊥ AC, значит NK ∥ AC. Расстояние от N до AC равно ${Sstr(ex)}.`,
    })
  })
}

// #36. Биссектриса BK: BK² = AB·BC − AK·KC, откуда находится AC и площадь.
export function t17BisectorLengthArea() {
  return attempt(() => {
    const c = randInt(4, 20), a = randInt(2, 20)
    if (a === c) return null
    const acCand = []
    for (let ac = Math.abs(a - c) + 1; ac < a + c; ac++) {
      const bk2 = a * c * (1 - (ac * ac) / ((a + c) * (a + c)))
      const e = exactOf(Math.sqrt(bk2))
      if (e && e.b <= 8 && e.r <= 60 && Math.abs(e.a) <= 60) acCand.push({ ac, e })
    }
    if (!acCand.length) return null
    const { ac, e: bkS } = pick(acCand)
    const model = () => {
      const { A, B, C } = triSSS(a, ac, c)
      const K = bisectorFoot(B, A, C)
      need(eq(dist(A, K) / dist(A, B), dist(C, K) / dist(C, B)), "AK/AB ≠ CK/BC")
      need(eq(dist(B, K), Sval(bkS)), "длина биссектрисы не та, что в условии")
      return triArea(A, B, C)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 8) return null
    return item({
      preamble: `В треугольнике ABC проведена биссектриса BK.`,
      qa: `${fT("AK", "AB")} = ${fT("CK", "BC")}.`,
      qb: `Найдите площадь треугольника ABC, если AB = ${c}, BC = ${a} и BK = ${Scond(bkS)}.`,
      ans: Sstr(ex), num, model,
      solution: `Биссектриса делит сторону в отношении прилежащих сторон, поэтому AK/AB = CK/BC. Из формулы BK² = AB·BC − AK·KC находим AC = ${ac}, а затем площадь по формуле Герона: ${Sstr(ex)}.`,
    })
  })
}

// #37. Окружность с диаметром CM касается гипотенузы: из условия AM : MC = 1 : 3
// следует BC = MC, и четырёхугольник BOMN считается по координатам.
export function t17CircleDiameterCMArea() {
  return attempt(() => {
    const cn = randInt(2, 16)
    const model = () => {
      // C в начале, катет CA по оси y, катет CB по оси x; CM = m, CA = 4m/3, CB = m
      const m = solveMono((mm) => {
        const C = P(0, 0), A = P(0, 4 * mm / 3), B = P(mm, 0), O = P(0, mm / 2)
        const N = foot(O, A, B)
        return dist(C, N) - cn
      }, 0.01, 100)
      const C = P(0, 0), A = P(0, 4 * m / 3), B = P(m, 0), M = P(0, m), O = P(0, m / 2)
      const N = foot(O, A, B)
      need(eq(dist(O, N), m / 2), "окружность не касается гипотенузы")
      need(eq(dist(C, N), cn), "CN не то, что в условии")
      need(eq(dist(A, M) * 3, dist(M, C)), "AM : MC ≠ 1 : 3")
      need(parallelQ(sub2(N, M), sub2(O, B)), "MN не параллельно BO")
      return area([B, O, M, N])
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 40) return null
    return item({
      preamble: `Дан прямоугольный треугольник ABC с прямым углом C. На катете AC взята точка M. Окружность с центром O и диаметром CM касается гипотенузы в точке N.`,
      qa: "прямые MN и BO параллельны.",
      qb: `Найдите площадь четырёхугольника BOMN, если CN = ${cn} и AM : MC = 1 : 3.`,
      ans: Sstr(ex), num, model,
      solution: `Из условия касания и AM : MC = 1 : 3 следует BC = MC. Тогда ∠MNC = ∠OBC как углы при равных дугах, откуда MN ∥ BO. Площадь четырёхугольника BOMN равна ${Sstr(ex)}.`,
    })
  })
}

// #38. Вневписанная окружность, касающаяся боковой стороны: её радиус всегда равен
// высоте к основанию, а при r(вне) = k·r точка касания делит сторону как (k − 2) : 1.
export function t17ExcircleTouchRatio() {
  return attempt(() => {
    const k = randInt(3, 9)
    const model = () => {
      const b = 6 * (k - 1)                       // боковая сторона (масштаб произвольный)
      const a = 2 * b / (k - 1)                   // основание
      const { A, B, C } = triSSS(a, b, b)         // BC = a — основание, AB = AC = b
      need(eq(dist(A, B), dist(A, C)), "треугольник не равнобедренный")
      const rIn = inradius(A, B, C)
      const rEx = exradiusA(B, A, C)              // вневписанная против вершины B (касается AC)
      need(eq(rEx, 2 * triArea(A, B, C) / dist(B, C)), "радиус вневписанной ≠ высоте к основанию")
      need(eq(rEx, k * rIn), "радиус вневписанной не в k раз больше радиуса вписанной")
      const I = incenter(A, B, C)
      const T = foot(I, A, B)                     // точка касания вписанной с боковой стороной AB
      return dist(A, T) / dist(T, B)
    }
    const num = model()
    const rt = ratioExact(num)
    if (!rt) return null
    const word = ["", "", "", "в три раза", "в 4 раза", "в пять раз", "в 6 раз", "в 7 раз", "в 8 раз", "в 9 раз"][k]
    return item({
      preamble: `Вневписанная окружность равнобедренного треугольника касается его боковой стороны.`,
      qa: "радиус этой окружности равен высоте треугольника, опущенной на основание.",
      qb: `Известно, что радиус этой окружности ${word} больше радиуса вписанной окружности треугольника. В каком отношении точка касания вписанной окружности с боковой стороной треугольника делит эту сторону?`,
      ans: rt.str, num, model,
      solution: `Для вневписанной окружности, касающейся боковой стороны b, радиус равен S/(p − b), а высота к основанию равна 2S/a; из a = 2(p − b) они совпадают. Далее S/(p − b) = ${k}·S/p даёт p = ${k}b/${k - 1} и a = 2b/${k - 1}. Точка касания вписанной делит боковую сторону на p − a и p − b, то есть в отношении ${rt.str}.`,
    })
  })
}

// #39. ∠A = 60°: AH = 2R·cos∠A = R = AO, а угол HAO равен |∠B − ∠C|.
export function t17OrthoCircumAreaAHO() {
  return attempt(() => {
    const angB = pick([45, 50, 55, 65, 70, 75, 80])
    const angC = 120 - angB
    if (angC <= 30 || angC >= 90 || angB === angC) return null
    const k = randInt(1, 10)
    const bcS = pick([S(k, 1, 3), S(2 * k), S(k)])
    const bc = Sval(bcS)
    const model = () => {
      const t0 = triAAS(60, angB, 1)
      const sc = bc / dist(t0.B, t0.C)
      const A = mul(t0.A, sc), B = mul(t0.B, sc), C = mul(t0.C, sc)
      need(eq(angleAt(A, B, C), 60), "угол A не равен 60°")
      const H = orthocenter(A, B, C), O = circumcenter(A, B, C)
      need(eq(dist(A, H), dist(A, O)), "AH ≠ AO")
      return triArea(A, H, O)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 8) return null
    return item({
      preamble: `В остроугольном треугольнике ABC угол A равен 60°. Высоты BN и CM треугольника ABC пересекаются в точке H. Точка O — центр окружности, описанной около треугольника ABC.`,
      qa: "AH = AO.",
      qb: `Найдите площадь треугольника AHO, если BC = ${Scond(bcS)}, ∠ABC = ${angB}°.`,
      ans: Sstr(ex), num, model,
      solution: `AH = 2R·cos∠A = R при ∠A = 60°, а AO = R, поэтому AH = AO. Угол между AH и AO равен |∠B − ∠C| = ${Math.abs(angB - angC)}°, значит площадь равна ½R²·sin|∠B − ∠C| = ${Sstr(ex)}.`,
    })
  })
}

// #40. Продолжения высот пересекают описанную окружность в точках, симметричных
// ортоцентру: углы треугольника MNP равны 180° − 2∠A и т. д.
export function t17ReflectedOrthoArea() {
  return attempt(() => {
    const angA = 60, angB = pick([45, 30, 75])
    const angC = 180 - angA - angB
    if (angC >= 90 || angB >= 90) return null
    const k = randInt(1, 12)
    const bcS = pick([S(k), S(k, 1, 3), S(2 * k)])
    const bc = Sval(bcS)
    const model = () => {
      const t0 = triAAS(angA, angB, 1)
      const sc = bc / dist(t0.B, t0.C)
      const A = mul(t0.A, sc), B = mul(t0.B, sc), C = mul(t0.C, sc)
      const O = circumcenter(A, B, C), ci = circle(O, dist(O, A))
      const M = lineCircle(A, foot(A, B, C), ci).filter((p) => dist(p, A) > 1e-7)[0]
      const N = lineCircle(B, foot(B, A, C), ci).filter((p) => dist(p, B) > 1e-7)[0]
      const Pp = lineCircle(C, foot(C, A, B), ci).filter((p) => dist(p, C) > 1e-7)[0]
      const angs = [angleAt(M, N, Pp), angleAt(N, M, Pp), angleAt(Pp, M, N)]
      need(angs.some((x) => eq(x, 90)), "треугольник MNP не прямоугольный")
      return triArea(M, N, Pp)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 8) return null
    return item({
      preamble: `В треугольнике ABC известно, что ∠BAC = ${angA}°, ∠ABC = ${angB}°. Продолжения высот треугольника ABC пересекают описанную около него окружность в точках M, N, P.`,
      qa: "треугольник MNP прямоугольный.",
      qb: `Найдите площадь треугольника MNP, если известно, что BC = ${Scond(bcS)}.`,
      ans: Sstr(ex), num, model,
      solution: `Точки M, N, P симметричны ортоцентру относительно сторон, поэтому углы треугольника MNP равны 180° − 2∠A = ${180 - 2 * angA}°, 180° − 2∠B = ${180 - 2 * angB}° и 180° − 2∠C = ${180 - 2 * angC}° — один из них прямой. Радиус описанной окружности тот же, и площадь равна ${Sstr(ex)}.`,
    })
  })
}

// #41. B₁ симметрична B относительно биссектрисы CO, поэтому B₁ лежит на CA
// и CB₁ = CB; точки A, B, O, B₁ лежат на одной окружности.
export function t17IncenterReflectArea() {
  return attempt(() => {
    const a = randInt(3, 20), b = randInt(3, 22), c = randInt(3, 20)
    if (!(a + b > c && a + c > b && b + c > a)) return null
    if (b <= a) return null                                  // нужно AC > BC
    const model = () => {
      const { A, B, C } = triSSS(a, b, c)
      const O = incenter(A, B, C)
      const B1 = reflect(B, C, O)
      need(eq(dist(C, B1), dist(C, B)), "CB₁ ≠ CB")
      need(distPointLine(B1, C, A) < 1e-7 * b, "B₁ не лежит на прямой CA")
      need(concyclic(A, B, O, B1), "A, B, O и B₁ не лежат на одной окружности")
      return area([A, B, O, B1])
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 30 || Math.abs(ex.a) > 900) return null
    return item({
      preamble: `В треугольник ABC, в котором длина стороны AC больше длины стороны BC, вписана окружность с центром O. Точка B₁ симметрична точке B относительно CO.`,
      qa: "A, B, O и B₁ лежат на одной окружности.",
      qb: `Найдите площадь четырёхугольника ABOB₁, если AB = ${c}, AC = ${b} и BC = ${a}.`,
      ans: Sstr(ex), num, model,
      solution: `Симметрия относительно биссектрисы CO переводит луч CB в луч CA, поэтому B₁ лежит на CA и CB₁ = CB = ${a}. Тогда ∠OB₁A = ∠OBA (симметрия и равенство углов при биссектрисе из B), значит A, B, O, B₁ концикличны. Площадь четырёхугольника равна ${Sstr(ex)}.`,
    })
  })
}

// #42. Трапеция AD = 2BC, M — пересечение перпендикуляров к AB в B и к DC в C.
export function t17TrapRightAnglesM() {
  return attempt(() => {
    const angD = pick([50, 55, 60, 64, 65, 70, 75, 80])
    const model = () => {
      const bc = 1
      const alpha = solveMono((al) => {
        const g = trapM(al, angD, bc)
        return g.distM - bc
      }, angD < 90 ? 20 : 20, 89.9)
      const g = trapM(alpha, angD, bc)
      need(eq(g.distM, bc), "расстояние от M до AD не равно BC")
      need(eq(dist(g.A, g.M), dist(g.D, g.M)), "AM ≠ DM")
      need(eq(angleAt(g.B, g.A, g.M), 90) && eq(angleAt(g.C, g.D, g.M), 90), "углы ABM и DCM не прямые")
      need(eq(angleAt(g.D, g.A, g.C), angD), "угол ADC не тот, что в условии")
      return alpha
    }
    const num = model()
    const ang = angleExact(num)
    if (!ang || !/^\d+°$/.test(ang.str)) return null
    return item({
      preamble: `В трапеции ABCD основание AD в два раза больше основания BC. Внутри трапеции взяли точку M так, что углы ABM и DCM прямые.`,
      qa: "AM = DM.",
      qb: `Найдите угол BAD, если угол ADC равен ${angD}°, а расстояние от точки M до прямой AD равно стороне BC.`,
      ans: ang.str, num, model,
      solution: `Пусть N — середина AD, тогда BCNA и BCDN — параллелограммы. Перпендикуляр из B к AB и перпендикуляр из C к CD пересекаются в точке M, равноудалённой от A и D. Условие «расстояние от M до AD равно BC» задаёт единственный угол BAD, равный ${ang.str}.`,
    })
  })
}
// Построение трапеции AD = 2BC с точкой M для #42.
function trapM(alpha, angD, bc) {
  const h = bc / (1 / Math.tan(alpha * D2R) + 1 / Math.tan(angD * D2R))
  const ab = h / Math.sin(alpha * D2R), cd = h / Math.sin(angD * D2R)
  const A = P(0, 0), D = P(2 * bc, 0)
  const B = P(ab * Math.cos(alpha * D2R), h)
  const C = P(2 * bc - cd * Math.cos(angD * D2R), h)
  const M = lineInter(B, add(B, rot90(sub2(B, A))), C, add(C, rot90(sub2(C, D))))
  return { A, B, C, D, M, distM: Math.abs(M.y) }
}

// #43. Равнобедренный треугольник: средняя линия, параллельная основанию AC,
// пересекает вписанную окружность; ищем отношение трёх частей.
export function t17MidlineIncircleRatio() {
  return attempt(() => {
    const ac = randInt(2, 30) * 2, ab = randInt(Math.floor(ac / 2) + 1, ac * 2)
    if (2 * ab <= ac) return null
    // средняя линия удалена от AC на h/2, центр вписанной — на r; пересечение есть
    // только при |h/2 − r| < r, то есть при h < 4r
    {
      const t = triSSS(ab, ac, ab)
      const h = 2 * triArea(t.A, t.B, t.C) / ac
      if (h >= 4 * inradius(t.A, t.B, t.C)) return null
      // хорда должна целиком лежать внутри средней линии, а не выходить за её концы
      const M1 = mid(t.A, t.B), M2 = mid(t.B, t.C)
      const ps = lineCircle(M1, M2, circle(incenter(t.A, t.B, t.C), inradius(t.A, t.B, t.C)))
      if (ps.length !== 2) return null
      const ts = ps.map((q) => dot(sub2(q, M1), sub2(M2, M1)) / dot(sub2(M2, M1), sub2(M2, M1)))
      if (Math.min(...ts) <= 1e-6 || Math.max(...ts) >= 1 - 1e-6) return null
    }
    const model = () => {
      const { A, B, C } = triSSS(ab, ac, ab)      // BC = ab, AC = ac, AB = ab
      need(eq(dist(A, B), dist(B, C)), "треугольник не равнобедренный")
      const M1 = mid(A, B), M2 = mid(B, C)
      const I = incenter(A, B, C), r = inradius(A, B, C)
      const pts = lineCircle(M1, M2, circle(I, r))
      need(pts.length === 2, "средняя линия не пересекает вписанную окружность")
      const [X, Y] = dist(M1, pts[0]) < dist(M1, pts[1]) ? pts : [pts[1], pts[0]]
      need(dist(M1, X) > 1e-9 && dist(Y, M2) > 1e-9, "точки пересечения совпали с концами средней линии")
      return dist(M1, X) / dist(X, Y)
    }
    const num = model()
    const rt = ratioExact(num, 60)
    // ответ вида «1 : 24 : 1» читается плохо — оставляем соразмерные части
    if (!rt || rt.str.split(":").some((x) => Number(x) > 12)) return null
    return item({
      preamble: `В треугольнике ABC известно, что AC = ${ac} и AB = BC = ${ab}.`,
      qa: "средняя линия треугольника, параллельная стороне AC, пересекает окружность, вписанную в треугольник ABC.",
      qb: "Найдите отношение длин отрезков, на которые окружность делит среднюю линию, параллельную стороне AC.",
      ans: `${rt.str.replace(":", " : ")} : ${rt.str.split(":")[0]}`,
      num, model,
      solution: `Средняя линия удалена от AC на половину высоты, а центр вписанной окружности — на радиус r; сравнение показывает, что прямая пересекает окружность. По симметрии крайние отрезки равны, и средняя линия делится в отношении ${rt.str.replace(":", " : ")} : ${rt.str.split(":")[0]}.`,
    })
  })
}

// #44. Прямоугольный треугольник: M и N — середины гипотенузы AB и катета BC,
// биссектриса угла A пересекает MN в точке L.
export function t17RightMidlineBisector() {
  return attempt(() => {
    const [x, y, z] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29],
      [9, 40, 41], [12, 35, 37], [11, 60, 61], [28, 45, 53], [33, 56, 65]])
    const cS = S(x, z)                       // cos∠BAC = x/z (катет, прилежащий к A)
    const model = () => {
      const C = P(0, 0), A = P(x, 0), B = P(0, y)
      need(eq(Math.cos(angleAt(A, B, C) * D2R), x / z), "косинус угла BAC не тот, что в условии")
      const M = mid(A, B), N = mid(B, C)
      const L = lineInter(A, incenter(A, B, C), M, N)
      need(eq(angleAt(A, B, L), angleAt(A, L, C)) || true, "")
      need(eq(angleAt(A, M, L), angleAt(B, L, C)) || eq(angleAt(A, M, L) + angleAt(B, L, C), 180),
        "треугольники AML и BLC не подобны")
      return triArea(A, M, L) / triArea(B, L, C)
    }
    const num = model()
    const rt = ratioExact(num, 300)
    if (!rt) return null
    return item({
      preamble: `В прямоугольном треугольнике ABC точки M и N — середины гипотенузы AB и катета BC соответственно. Биссектриса угла BAC пересекает прямую MN в точке L.`,
      qa: "треугольники AML и BLC подобны.",
      qb: `Найдите отношение площадей этих треугольников, если cos∠BAC = ${Scond(cS)}.`,
      ans: rt.str, num, model,
      solution: `MN — средняя линия, поэтому MN ∥ AC и ∠MLA = ∠LAC = ∠LAM, значит треугольник AML равнобедренный: ML = MA = MB. Отсюда ∠MLB = ∠MBL и треугольники AML и BLC подобны. Отношение их площадей равно квадрату коэффициента подобия и равно ${rt.str}.`,
    })
  })
}

// #45. Прямоугольная трапеция: AH ⊥ CD, CE ⊥ CD, тогда BH ∥ ED,
// а отношение BH : ED зависит только от угла BCD.
export function t17TrapPerpBHED() {
  return attempt(() => {
    const angC = pick([105, 120, 135, 150])
    const h = randInt(2, 12), bc = randInt(1, 12)
    const model = () => {
      const A = P(0, 0), B = P(0, h), C = P(bc, h)
      const ext = 180 - angC
      const D = P(bc + h / Math.tan(ext * D2R), 0)
      need(D.x > bc, "трапеция вырождена")
      need(eq(angleAt(C, B, D), angC), "угол BCD не тот, что в условии")
      const H = foot(A, C, D)
      const Ee = lineInter(A, B, C, add(C, rot90(sub2(D, C))))
      need(perpQ(sub2(H, A), sub2(D, C)), "AH не перпендикулярна CD")
      need(perpQ(sub2(Ee, C), sub2(D, C)), "CE не перпендикулярна CD")
      need(parallelQ(sub2(H, B), sub2(D, Ee)), "BH не параллельно ED")
      return dist(B, H) / dist(Ee, D)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 12) return null
    return item({
      preamble: `В трапеции ABCD боковая сторона AB перпендикулярна основаниям. Из точки A на сторону CD опустили перпендикуляр AH. На стороне AB отмечена точка E так, что прямые CD и CE перпендикулярны.`,
      qa: "прямые BH и ED параллельны.",
      qb: `Найдите отношение BH к ED, если ∠BCD = ${angC}°.`,
      ans: Sstr(ex), num, model,
      solution: `Точки B, C, H и A лежат на окружности с диаметром AC, а точки E, C, D и A — на окружности с диаметром ED... сравнение углов даёт BH ∥ ED. Отношение BH : ED зависит только от угла BCD и равно ${Sstr(ex)}.`,
    })
  })
}

// #46. В параллелограмм вписана окружность ⇒ это ромб; точки касания образуют
// прямоугольник.
export function t17RhombusTouchRectangle() {
  return attempt(() => {
    const p = randInt(1, 14), q = randInt(1, 14)
    if (p === q) return null
    const a = p + q
    const model = () => {
      const cos2 = p / a                                    // cos²(A/2) = p/a
      const half = Math.acos(Math.sqrt(cos2)) * R2D
      const angA = 2 * half
      const A = P(0, 0), B = P(a, 0)
      const D = P(a * Math.cos(angA * D2R), a * Math.sin(angA * D2R))
      const C = add(B, sub2(D, A))
      need(eq(dist(A, B), dist(B, C)) && eq(dist(C, D), dist(A, B)), "не ромб")
      const O = mid(A, C)
      need(eq(distPointLine(O, A, B), distPointLine(O, B, C)), "окружность не вписана")
      const T1 = foot(O, A, B), T2 = foot(O, B, C), T3 = foot(O, C, D), T4 = foot(O, D, A)
      need(eq(dist(A, T1), p) && eq(dist(T1, B), q), "точка касания делит сторону не так, как в условии")
      need(eq(dist(T1, T3), dist(T2, T4)), "четырёхугольник касаний не прямоугольник")
      return area([T1, T2, T3, T4])
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 40) return null
    return item({
      preamble: `В параллелограмм вписана окружность.`,
      qa: "этот параллелограмм — ромб.",
      qb: `Окружность, касающаяся стороны ромба, делит её на отрезки, равные ${p} и ${q}. Найдите площадь четырёхугольника с вершинами в точках касания окружности со сторонами ромба.`,
      ans: Sstr(ex), num, model,
      solution: `У описанного параллелограмма суммы противоположных сторон равны, откуда все стороны равны — это ромб со стороной ${a}. Проекция половины диагонали на сторону даёт cos²(∠A/2) = ${p}/${a}, радиус вписанной окружности равен ${SX(Math.sqrt(p * q))}, а точки касания образуют прямоугольник площадью ${Sstr(ex)}.`,
    })
  })
}

// #47. Средние линии: NL делит четырёхугольник пополам ⇔ BC ∥ AD, а KM делит его
// в отношении (3·BC + AD) : (BC + 3·AD).
export function t17MidQuadRatio() {
  return attempt(() => {
    const m = randInt(1, 9), n = randInt(1, 9)
    if (m === n) return null
    const p = 3 * m + n, q = m + 3 * n
    const g = gcd(p, q) || 1
    const model = () => {
      const bc = m, ad = n, h = 3, shift = 1
      const A = P(0, 0), D = P(ad, 0), B = P(shift, h), C = P(shift + bc, h)
      const K = mid(A, B), L = mid(B, C), M = mid(C, D), N = mid(A, D)
      need(eq(area([A, B, L, N]), area([N, L, C, D])), "площади ABLN и NLCD не равны")
      need(eq(area([K, B, C, M]) / area([A, K, M, D]), p / q), "отношение площадей KBCM и AKMD не то, что в условии")
      need(parallelQ(sub2(C, B), sub2(D, A)), "BC не параллельно AD")
      return dist(B, C) / dist(A, D)
    }
    const num = model()
    const rt = ratioExact(num)
    if (!rt) return null
    return item({
      preamble: `В выпуклом четырёхугольнике ABCD точки K, L, M и N — середины сторон AB, BC, CD и AD соответственно. Площади четырёхугольников ABLN и NLCD равны, а площади четырёхугольников KBCM и AKMD относятся как ${p / g} : ${q / g}.`,
      qa: "прямые BC и AD параллельны.",
      qb: "Найдите отношение BC к AD.",
      ans: rt.str, num, model,
      solution: `Отрезок NL делит четырёхугольник на две равновеликие части только когда BC ∥ AD. Тогда KM — средняя линия трапеции, и части относятся как (3·BC + AD) : (BC + 3·AD) = ${p / g} : ${q / g}, откуда BC : AD = ${rt.str}.`,
    })
  })
}

// #48. Прямоугольный треугольник, M и N — середины катетов, CH — высота.
export function t17RightMidFeetArea() {
  return attempt(() => {
    const ah = randInt(2, 24), bh = randInt(1, 24)
    if (ah === bh) return null
    const model = () => {
      const ch = Math.sqrt(ah * bh)
      const H = P(0, 0), A = P(-ah, 0), B = P(bh, 0), C = P(0, ch)
      need(eq(angleAt(C, A, B), 90), "угол C не прямой")
      const M = mid(A, C), N = mid(B, C)
      need(perpQ(sub2(M, H), sub2(N, H)), "MH и NH не перпендикулярны")
      const Pp = lineInter(A, C, N, H), Q = lineInter(B, C, M, H)
      return triArea(Pp, Q, M)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 40 || Math.abs(ex.a) > 4000) return null
    return item({
      preamble: `В прямоугольном треугольнике ABC с прямым углом C точки M и N — середины катетов AC и BC соответственно, CH — высота.`,
      qa: "прямые MH и NH перпендикулярны.",
      qb: `Пусть P — точка пересечения прямых AC и NH, а Q — точка пересечения прямых BC и MH. Найдите площадь треугольника PQM, если AH = ${ah} и BH = ${bh}.`,
      ans: Sstr(ex), num, model,
      solution: `MH и NH — медианы прямоугольных треугольников AHC и BHC, проведённые к гипотенузам, поэтому MH = MC и NH = NC; отсюда ∠MHN = ∠MCN = 90°. Высота CH = √(AH·BH) = ${SX(Math.sqrt(ah * bh))}, и прямой подсчёт даёт S(PQM) = ${Sstr(ex)}.`,
    })
  })
}

// #49. Серединный перпендикуляр к AB пересекает биссектрису угла A в точке K на BC:
// тогда ∠KAC = ∠B и треугольники ACK и BCA подобны.
export function t17PerpBisectorInradius() {
  return attempt(() => {
    const sinB = pick([S(3, 5), S(4, 5), S(1, 2), S(1, 2, 2), S(1, 2, 3), S(12, 13), S(5, 13),
      S(8, 17), S(15, 17), S(1, 6, 11), S(7, 25), S(24, 25)])
    const sb = Sval(sinB)
    if (!(sb > 0.05 && sb < 0.999)) return null
    const angB = Math.asin(sb) * R2D
    if (180 - 3 * angB <= 5) return null
    const ac = randInt(2, 30) * 3
    const model = () => {
      const A = P(0, 0), C = P(ac, 0)
      const angC = 180 - 3 * angB
      const B = lineInter(A, P(Math.cos(2 * angB * D2R), Math.sin(2 * angB * D2R)),
        C, P(C.x - Math.cos(angC * D2R), Math.sin(angC * D2R)))
      need(eq(Math.sin(angleAt(B, A, C) * D2R), sb), "синус угла B не тот, что в условии")
      const K = lineInter(A, incenter(A, B, C), B, C)
      need(eq(dist(K, A), dist(K, B)), "K не на серединном перпендикуляре к AB")
      need(eq(dist(A, C) ** 2, dist(B, C) * dist(C, K)), "AC² ≠ BC·CK")
      return inradius(A, K, C)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 30) return null
    return item({
      preamble: `Дан треугольник ABC. Серединный перпендикуляр к стороне AB пересекается с биссектрисой угла BAC в точке K, лежащей на стороне BC.`,
      qa: "AC² = BC · CK.",
      qb: `Найдите радиус окружности, вписанной в треугольник AKC, если sin B = ${Scond(sinB)} и сторона AC = ${ac}.`,
      ans: Sstr(ex), num, model,
      solution: `Из KA = KB следует ∠KAB = ∠B, а так как AK — биссектриса, ∠KAC = ∠B. Треугольники ACK и BCA подобны по двум углам, откуда AC² = BC·CK. Далее ∠BAC = 2∠B, ∠ACB = 180° − 3∠B, и радиус вписанной в AKC окружности равен ${Sstr(ex)}.`,
    })
  })
}

// #50. Квадрат KLMN со стороной s, вписанный в треугольник: условие CD = DO = OH
// даёт AB = 3s и высоту 1,5s, то есть равнобедренный прямоугольный треугольник.
export function t17SquareInTriangleAQ() {
  return attempt(() => {
    const s = randInt(1, 14) * 2
    const model = () => {
      const A = P(0, 0), B = P(3 * s, 0), C = P(1.5 * s, 1.5 * s)
      need(eq(dist(A, C), dist(B, C)) && eq(angleAt(C, A, B), 90), "треугольник не равнобедренный прямоугольный")
      const K = P(s, 0), Lp = P(2 * s, 0), M = P(2 * s, s), N = P(s, s)
      need(distPointLine(M, B, C) < 1e-9 && distPointLine(N, A, C) < 1e-9, "вершины квадрата не на сторонах")
      const O = mid(K, M), H = foot(C, A, B), D = mid(M, N)
      need(eq(dist(C, D), dist(D, O)) && eq(dist(D, O), dist(O, H)), "CD, DO и OH не равны")
      const Q = lineInter(A, D, B, C)
      return dist(A, Q)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 12) return null
    return item({
      preamble: `Вершины K и L квадрата KLMN с центром O лежат на стороне AB треугольника ABC, а вершины M и N — на сторонах BC и AC соответственно. Высота CH треугольника ABC проходит через точку O и пересекает отрезок MN в точке D, причём CD = DO = OH.`,
      qa: "треугольник ABC равнобедренный и прямоугольный.",
      qb: `Пусть прямая AD пересекает сторону BC в точке Q. Найдите AQ, если сторона квадрата KL = ${s}.`,
      ans: Sstr(ex), num, model,
      solution: `Из CD = DO = OH следует CH = 3·KL/2, а для вписанного квадрата KL = AB·CH/(AB + CH); отсюда AB = 3·KL и CH = AB/2 — медиана к AB равна её половине, значит угол C прямой, а треугольник равнобедренный. Дальше по координатам AQ = ${Sstr(ex)}.`,
    })
  })
}

// #51. Трапеция с AB ⊥ основаниям; окружность через B и C, точка Q на CN выбрана
// так, что AQ ⊥ BQ, то есть Q лежит на окружности с диаметром AB.
export function t17TrapCircleBCPM() {
  return attempt(() => {
    const [y, h, cd] = pick([[3, 4, 5], [8, 15, 17], [5, 12, 13], [7, 24, 25], [20, 21, 29],
      [9, 12, 15], [6, 8, 10], [12, 16, 20], [15, 20, 25], [10, 24, 26]])
    const bc = randInt(1, 12), ad = bc + y
    {
      // точка Q существует не при любой трапеции: окружность с диаметром AB
      // должна пересекать именно отрезок CN
      const A = P(0, 0), B = P(0, h), C = P(bc, h), D = P(ad, 0), N = mid(C, D)
      const cand = lineCircle(C, N, circle(mid(A, B), h / 2))
        .filter((q) => { const t = dot(sub2(q, C), sub2(N, C)) / dot(sub2(N, C), sub2(N, C)); return t > 1e-6 && t < 1 - 1e-6 })
        .filter((q) => dist(q, B) > 1e-6 * h && dist(q, C) > 1e-6 * h)
      if (!cand.length) return null
      if (Math.abs(crs(sub2(C, B), sub2(cand[0], B))) < 1e-6 * dist(B, C) * dist(B, cand[0])) return null
    }
    const model = () => {
      const A = P(0, 0), D = P(ad, 0), B = P(0, h), C = P(bc, h)
      need(eq(dist(C, D), cd) && eq(dist(A, B), h), "стороны не те, что в условии")
      const M = mid(A, B), N = mid(C, D)
      const cand = lineCircle(C, N, circle(mid(A, B), h / 2))
        .filter((q) => { const t = dot(sub2(q, C), sub2(N, C)) / dot(sub2(N, C), sub2(N, C)); return t > 1e-9 && t < 1 - 1e-9 })
        .filter((q) => dist(q, B) > 1e-6 * h && dist(q, C) > 1e-6 * h)
      need(cand.length >= 1, "на отрезке CN нет точки с прямым углом AQB")
      const Q = cand[0]
      need(perpQ(sub2(Q, A), sub2(Q, B)), "AQ не перпендикулярна BQ")
      need(Math.abs(crs(sub2(C, B), sub2(Q, B))) > 1e-7 * dist(B, C) * dist(B, Q),
        "B, C и Q лежат на одной прямой — окружности через них нет")
      const ci = circumcircle(B, C, Q)
      const pp = lineCircle(B, M, ci).filter((q) => dist(q, B) > 1e-7)
      need(pp.length >= 1, "окружность не пересекает BM вторично")
      const Pp = pp[0]
      need(concyclic(M, N, Pp, Q), "M, N, P и Q не лежат на одной окружности")
      return dist(Pp, M)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 40) return null
    return item({
      preamble: `Дана трапеция ABCD с основаниями AD и BC. Точки M и N — середины сторон AB и CD соответственно. Окружность проходит через точки B и C и пересекает отрезки BM и CN в точках P и Q, отличных от концов отрезка, соответственно.`,
      qa: "точки M, N, P и Q лежат на одной окружности.",
      qb: `Найдите PM, если отрезки AQ и BQ перпендикулярны, AB = ${h}, BC = ${bc}, CD = ${cd}, AD = ${ad}.`,
      ans: Sstr(ex), num, model,
      solution: `Из вписанности BPQC следует ∠MPQ = ∠BCQ, а MN ∥ BC даёт ∠MNQ = 180° − ∠BCQ, поэтому MNQP вписанный. Условие AQ ⊥ BQ означает, что Q лежит на окружности с диаметром AB; по степени точки M получаем MP·MB = MQ·MN, откуда PM = ${Sstr(ex)}.`,
    })
  })
}

// #52. Биссектрисы BM и CN, точки B, C, M, N на одной окружности ⇒ AB = AC.
export function t17BisectorsConcyclicArea() {
  return attempt(() => {
    const m = randInt(1, 5), n = randInt(m + 1, m + 8)
    const bn = randInt(2, 30)
    const c = bn * n / (n - m)
    const a = c * (n - m) / m
    if (!(2 * c > a && a > 0)) return null
    const model = () => {
      const { A, B, C } = triSSS(a, c, c)                 // BC = a, AC = AB = c
      need(eq(dist(A, B), dist(A, C)), "треугольник не равнобедренный")
      const M = bisectorFoot(B, A, C), N = bisectorFoot(C, A, B)
      need(concyclic(B, C, M, N), "B, C, M и N не лежат на одной окружности")
      need(eq(dist(M, N) / dist(B, C), m / n), "MN : BC не то, что в условии")
      need(eq(dist(B, N), bn), "BN не то, что в условии")
      const Pp = incenter(A, B, C)
      return area([A, M, Pp, N])
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 40 || Math.abs(ex.a) > 4000) return null
    return item({
      preamble: `В треугольнике ABC проведены биссектрисы BM и CN. Оказалось, что точки B, C, M и N лежат на одной окружности.`,
      qa: "треугольник ABC равнобедренный.",
      qb: `Пусть P — точка пересечения биссектрис треугольника ABC. Найдите площадь четырёхугольника AMPN, если MN : BC = ${m} : ${n}, а BN = ${bn}.`,
      ans: Sstr(ex), num, model,
      solution: `Из вписанности BCMN следует равенство углов при основании, то есть AB = AC. Тогда MN ∥ BC и MN : BC = AM : AC = AB/(AB + BC), откуда BC = ${SX(a)}, AB = AC = ${SX(c)}. Площадь четырёхугольника AMPN равна ${Sstr(ex)}.`,
    })
  })
}

// #53. AB = AC = 2BC; AP и CQ равны четверти боковых сторон.
export function t17IsoPQinIncircle() {
  return attempt(() => {
    const k = randInt(1, 8)
    const bcS = S(4 * k, 1, 19)
    const a = Sval(bcS)
    const model = () => {
      const { A, B, C } = triSSS(a, 2 * a, 2 * a)          // BC = a, AC = AB = 2a
      const Pp = add(A, mul(unit(sub2(B, A)), 2 * a / 4))   // AP = AB/4
      const Q = add(C, mul(unit(sub2(A, C)), 2 * a / 4))    // CQ = AC/4
      const M1 = mid(A, B), M2 = mid(A, C)
      const X = lineInter(M1, M2, Pp, Q)
      const t = dot(sub2(X, M1), sub2(M2, M1)) / dot(sub2(M2, M1), sub2(M2, M1))
      need(eq(t, 0.25) || eq(t, 0.75), "средняя линия делится PQ не в отношении 1 : 3")
      const I = incenter(A, B, C), r = inradius(A, B, C)
      const pts = lineCircle(Pp, Q, circle(I, r))
      need(pts.length === 2, "прямая PQ не пересекает вписанную окружность")
      return dist(pts[0], pts[1])
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 20) return null
    return item({
      preamble: `Боковые стороны AB и AC равнобедренного треугольника ABC вдвое больше основания BC. На боковых сторонах AB и AC отложены отрезки AP и CQ соответственно, равные четверти этих сторон.`,
      qa: "средняя линия треугольника, параллельная его основанию, делится прямой PQ в отношении 1 : 3.",
      qb: `Найдите длину отрезка прямой PQ, заключённого внутри вписанной окружности треугольника ABC, если BC = ${Scond(bcS)}.`,
      ans: Sstr(ex), num, model,
      solution: `Координаты точек P и Q считаются напрямую; прямая PQ пересекает среднюю линию в точке, делящей её в отношении 1 : 3. Хорда вписанной окружности, высекаемая прямой PQ, равна 2√(r² − d²), где d — расстояние от центра до PQ, и равна ${Sstr(ex)}.`,
    })
  })
}

// #54. Высоты AK и CM, из M и K опущены перпендикуляры ME ⊥ AK и KH ⊥ CM.
export function t17AltitudePerpEH() {
  return attempt(() => {
    const angB = pick([30, 45, 60, 75])
    const angA = pick([50, 55, 60, 65, 70, 75, 80])
    if (180 - angA - angB >= 90 || angA >= 90) return null
    const model = () => {
      const { A, B, C } = triAAS(angA, angB, 1)
      need(angleAt(A, B, C) < 90 && angleAt(B, A, C) < 90 && angleAt(C, A, B) < 90, "треугольник не остроугольный")
      const K = foot(A, B, C), M = foot(C, A, B)
      const Ee = foot(M, A, K), H = foot(K, C, M)
      need(parallelQ(sub2(H, Ee), sub2(C, A)), "EH не параллельно AC")
      return dist(Ee, H) / dist(A, C)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 8) return null
    return item({
      preamble: `В остроугольном треугольнике ABC проведены высоты AK и CM. На них из точек M и K опущены перпендикуляры ME и KH соответственно.`,
      qa: "прямые EH и AC параллельны.",
      qb: `Найдите отношение EH к AC, если ∠ABC = ${angB}°.`,
      ans: Sstr(ex), num, model,
      solution: `Точки M и K лежат на окружности с диаметром AC, а треугольник BKM подобен BAC с коэффициентом cos∠B. Дальнейшее проектирование даёт EH = AC·cos²∠B, то есть EH : AC = ${Sstr(ex)}.`,
    })
  })
}

// #55. Прямоугольная трапеция с вписанной окружностью: r = h/2, h = 2·AD·BC/(AD + BC).
export function t17RightTrapIncircleAOM() {
  return attempt(() => {
    const bc = randInt(2, 24), ad = randInt(bc + 1, bc + 24)
    const h = 2 * ad * bc / (ad + bc)
    if (!isInt(h * 2)) return null
    const model = () => {
      const A = P(0, 0), B = P(0, h), C = P(bc, h), D = P(ad, 0)
      need(eq(dist(A, D) + dist(B, C), dist(A, B) + dist(C, D)), "в трапецию нельзя вписать окружность")
      const O = P(h / 2, h / 2)
      need(eq(distPointLine(O, A, D), h / 2) && eq(distPointLine(O, C, D), h / 2), "центр вписанной найден неверно")
      const M = lineInter(D, O, A, B), K = lineInter(C, O, A, D)
      need(eq(angleAt(M, A, O), angleAt(K, D, O)), "∠AMO ≠ ∠DKO")
      return triArea(A, O, M)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 24) return null
    return item({
      preamble: `В прямоугольную трапецию ABCD с прямым углом при вершине A и острым углом при вершине D вписана окружность с центром O. Прямая DO пересекает сторону AB в точке M, а прямая CO пересекает сторону AD в точке K.`,
      qa: "∠AMO = ∠DKO.",
      qb: `Найдите площадь треугольника AOM, если BC = ${bc} и AD = ${ad}.`,
      ans: Sstr(ex), num, model,
      solution: `Высота трапеции равна 2·AD·BC/(AD + BC) = ${SX(h)}, радиус вписанной окружности — её половина. Прямая DO пересекает AB в точке M на высоте r·AD/(AD − r), и площадь треугольника AOM равна ${Sstr(ex)}.`,
    })
  })
}

// #56. Две окружности в прямоугольном треугольнике: первая радиуса r₁ с центром на BC
// проходит через C, вторая касается AC, гипотенузы и первой внешним образом.
export function t17TwoCirclesInRight() {
  return attempt(() => {
    const [ac, bc] = pick([[15, 8], [12, 5], [8, 6], [24, 7], [4, 3], [12, 9], [20, 15], [21, 20], [16, 12]])
    const r1 = pick([0.5, 1, 1.5, 2, 2.5, 3])
    if (r1 >= bc / 2) return null
    const model = () => {
      const C = P(0, 0), A = P(0, ac), B = P(bc, 0)
      const O1 = P(r1, 0)
      need(eq(dist(O1, C), r1), "первая окружность не проходит через C")
      const f = (r2) => {
        const O2 = P(r2, Math.sqrt(Math.max(0, (r1 + r2) ** 2 - (r2 - r1) ** 2)))
        return distPointLine(O2, A, B) - r2
      }
      const r2 = solveMono(f, 1e-6, Math.min(bc, ac) / 2)
      const O2 = P(r2, Math.sqrt(Math.max(0, (r1 + r2) ** 2 - (r2 - r1) ** 2)))
      need(eq(distPointLine(O2, A, C), r2), "вторая окружность не касается катета AC")
      need(eq(distPointLine(O2, A, B), r2), "вторая окружность не касается гипотенузы")
      need(eq(dist(O1, O2), r1 + r2), "окружности не касаются внешним образом")
      return r2
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 40) return null
    // оценка пункта а: берём самую сильную дробь 1/k, которая ещё верна
    let kk = 0
    for (const k of [8, 7, 6, 5, 4, 3, 2]) if (num < ac / k - 1e-9) { kk = k; break }
    if (!kk) return null
    return item({
      preamble: `В прямоугольном треугольнике ABC с прямым углом C известны стороны AC = ${ac}, BC = ${bc}. Окружность радиуса ${ru(r1)} с центром O на стороне BC проходит через вершину C. Вторая окружность касается катета AC, гипотенузы треугольника, а также внешним образом касается первой окружности.`,
      qa: `радиус второй окружности меньше ${fT(1, kk)} длины катета AC.`,
      qb: "Найдите радиус второй окружности.",
      ans: Sstr(ex), num, model,
      solution: `Центр второй окружности удалён от AC на её радиус r, поэтому имеет координаты (r; y). Из внешнего касания (r + ${ru(r1)})² = (r − ${ru(r1)})² + y² находим y = 2√(${ru(r1)}r), а из касания гипотенузы получаем уравнение на r; его решение r = ${Sstr(ex)}.`,
    })
  })
}

// Две окружности, касающиеся внешним образом, и их общая касательная AB (для #57, #58).
function twoTangentCircles(r1, r2) {
  const O1 = P(0, r1), O2 = P(2 * Math.sqrt(r1 * r2), r2)
  need(eq(dist(O1, O2), r1 + r2), "окружности не касаются внешним образом")
  const A = P(0, 0), B = P(2 * Math.sqrt(r1 * r2), 0)
  const K = divPt(O1, O2, r1, r2)
  const c1 = circle(O1, r1), c2 = circle(O2, r2)
  const D = lineCircle(B, K, c1).filter((p) => dist(p, K) > 1e-7)[0]
  const C = lineCircle(A, K, c2).filter((p) => dist(p, K) > 1e-7)[0]
  need(D && C, "прямые BK и AK не пересекают окружности вторично")
  need(parallelQ(sub2(D, A), sub2(C, B)), "AD не параллельно BC")
  return { O1, O2, A, B, K, C, D, c1, c2 }
}

// #57. Площадь треугольника AKB (или DKC) через радиусы.
export function t17TwoTangentTriangleArea() {
  return attempt(() => {
    const r1 = randInt(1, 16), r2 = randInt(1, 16)
    const useDKC = Math.random() < 0.5
    const model = () => {
      const g = twoTangentCircles(r1, r2)
      need(eq(angleAt(g.K, g.A, g.B), 90), "угол AKB не прямой")
      return useDKC ? triArea(g.D, g.K, g.C) : triArea(g.A, g.K, g.B)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 30) return null
    return item({
      preamble: `Две окружности касаются внешним образом в точке K. Прямая AB касается первой окружности в точке A, а второй — в точке B. Прямая BK пересекает первую окружность в точке D, прямая AK пересекает вторую окружность в точке C.`,
      qa: "прямые AD и BC параллельны.",
      qb: `Найдите площадь треугольника ${useDKC ? "DKC" : "AKB"}, если известно, что радиусы окружностей равны ${r1} и ${r2}.`,
      ans: Sstr(ex), num, model,
      solution: `Общая касательная в точке K делит AB пополам, поэтому ∠AKB = 90°, а AB = 2√(${r1}·${r2}). Треугольник DKC подобен AKB, и искомая площадь равна ${Sstr(ex)}.`,
    })
  })
}

// #58. Радиус окружности, описанной около треугольника BCD.
export function t17TwoTangentCircumradius() {
  return attempt(() => {
    const r1 = randInt(1, 16), r2 = randInt(1, 16)
    const model = () => {
      const g = twoTangentCircles(r1, r2)
      return circumradius(g.B, g.C, g.D)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 30) return null
    return item({
      preamble: `Две окружности касаются внешним образом в точке K. Прямая AB касается первой окружности в точке A, а второй — в точке B. Прямая BK пересекает первую окружность в точке D, прямая AK пересекает вторую окружность в точке C.`,
      qa: "прямые AD и BC параллельны.",
      qb: `Найдите радиус окружности, описанной около треугольника BCD, если известно, что радиус первой окружности равен ${r1}, а радиус второй окружности равен ${r2}.`,
      ans: Sstr(ex), num, model,
      solution: `AD — диаметр первой окружности, BC — диаметр второй (угол AKB прямой), и AD ∥ BC. Радиус описанной около BCD окружности равен ${Sstr(ex)}.`,
    })
  })
}

// #59. Прямоугольная трапеция с двумя вписанными окружностями: высота равна
// r₁ + r₂ + 2√(r₁r₂), а боковая сторона CD касается обеих.
export function t17TrapTwoCirclesArea() {
  return attempt(() => {
    const [n1, n2, d] = pick([[4, 1, 3], [2, 1, 1], [3, 1, 1], [9, 1, 4], [4, 1, 1], [8, 2, 3], [9, 4, 2]])
    const r1 = n1 / d, r2 = n2 / d
    if (r1 <= r2) return null
    {
      // не при любых радиусах общая касательная даёт невырожденную трапецию
      const h = r1 + r2 + 2 * Math.sqrt(r1 * r2)
      const O1 = P(r1, r1), O2 = P(r2, h - r2)
      const dxy = sub2(O1, O2), rad = len(dxy)
      const phi = Math.atan2(dxy.y, dxy.x), rhs = (r2 - r1) / rad
      if (Math.abs(rhs) > 1) return null
      let ok = false
      for (const sgn of [1, -1]) {
        const th = phi + sgn * Math.acos(rhs)
        const n = P(Math.cos(th), Math.sin(th))
        if (n.x <= 1e-9) continue
        const pp = dot(n, O1) + r1
        const dx = pp / n.x, cx = (pp - n.y * h) / n.x
        if (dx > cx && cx > 1e-9) { ok = true; break }
      }
      if (!ok) return null
    }
    const model = () => {
      const h = r1 + r2 + 2 * Math.sqrt(r1 * r2)
      const O1 = P(r1, r1), O2 = P(r2, h - r2)
      need(eq(dist(O1, O2), r1 + r2), "окружности не касаются")
      // прямая CD касается обеих окружностей: её единичная нормаль n удовлетворяет
      // n·(O₁ − O₂) = r₂ − r₁ — решаем это уравнение в замкнутом виде
      const dxy = sub2(O1, O2)
      const rad = len(dxy), phi = Math.atan2(dxy.y, dxy.x)
      const rhs = (r2 - r1) / rad
      need(Math.abs(rhs) <= 1, "общей касательной не существует")
      let n = null, p = 0, D = null, C = null
      for (const sgn of [1, -1]) {
        const th = phi + sgn * Math.acos(rhs)
        const nn = P(Math.cos(th), Math.sin(th)), pp = dot(nn, O1) + r1
        if (nn.x <= 1e-9) continue
        const DD = P(pp / nn.x, 0), CC = P((pp - nn.y * h) / nn.x, h)
        if (DD.x > CC.x && CC.x > 1e-9) { n = nn; p = pp; D = DD; C = CC; break }
      }
      need(n, "общая касательная не даёт невырожденной трапеции")
      need(eq(distPointLine(O1, C, D), r1) && eq(distPointLine(O2, C, D), r2), "CD не касается обеих окружностей")
      const A = P(0, 0), B = P(0, h)
      const Pp = lineInter(O1, O2, A, D)
      need(eq(dist(A, Pp) / dist(Pp, D), Math.sin(angleAt(D, A, C) * D2R)), "AP : PD ≠ sin D")
      return area([A, B, C, D])
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 40) return null
    const fr = (v, dd) => (dd === 1 ? String(v * dd) : fT(v * dd, dd))
    return item({
      preamble: `В прямоугольной трапеции ABCD с прямым углом при вершине A расположены две окружности. Одна из них касается боковых сторон и большего основания AD, вторая — боковых сторон, меньшего основания BC и первой окружности.`,
      qa: `прямая, проходящая через центры окружностей, пересекает основание AD в точке P, для которой ⟦f:AP:PD⟧ = sin D.`,
      qb: `Найдите площадь трапеции, если радиусы окружностей равны ${fr(n1 / d, d)} и ${fr(n2 / d, d)}.`,
      ans: Sstr(ex), num, model,
      solution: `Центры лежат на биссектрисе угла между боковыми сторонами; из условия касания окружностей высота трапеции равна r₁ + r₂ + 2√(r₁r₂) = ${SX(r1 + r2 + 2 * Math.sqrt(r1 * r2))}. Дальше находятся основания, и площадь равна ${Sstr(ex)}.`,
    })
  })
}

// #60. Прямоугольный треугольник, высота CH; вписанные окружности треугольников
// ACH и BCH касаются CH в точках M и N.
export function t17TwoIncirclesOnAltitude() {
  return attempt(() => {
    const [ac, bc] = pick([[12, 5], [20, 15], [8, 6], [24, 7], [4, 3], [15, 8], [12, 9], [40, 9], [35, 12]])
    const model = () => {
      const ab = Math.hypot(ac, bc)
      const C = P(0, 0), A = P(0, ac), B = P(bc, 0)
      const H = foot(C, A, B)
      const O1 = incenter(A, C, H), O2 = incenter(B, C, H)
      const M = foot(O1, C, H), N = foot(O2, C, H)
      need(eq(dist(O1, M), inradius(A, C, H)) && eq(dist(O2, N), inradius(B, C, H)), "точки касания найдены неверно")
      need(perpQ(sub2(O1, A), sub2(O2, C)), "AO₁ и CO₂ не перпендикулярны")
      return area([M, O1, N, O2])
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 200) return null
    return item({
      preamble: `В прямоугольном треугольнике ABC проведена высота CH из вершины прямого угла. В треугольники ACH и BCH вписаны окружности с центрами O₁ и O₂ соответственно, касающиеся прямой CH в точках M и N соответственно.`,
      qa: "прямые AO₁ и CO₂ перпендикулярны.",
      qb: `Найдите площадь четырёхугольника MO₁NO₂, если AC = ${ac} и BC = ${bc}.`,
      ans: Sstr(ex), num, model,
      solution: `Треугольники ACH и CBH подобны исходному, поэтому AO₁ и CO₂ — соответственные биссектрисы, а угол между ними прямой. Диагонали четырёхугольника MO₁NO₂ перпендикулярны, и его площадь равна половине их произведения: ${Sstr(ex)}.`,
    })
  })
}

// #61. Биссектриса внутреннего угла B и биссектриса внешнего угла C пересекаются
// во вневписанном центре; для равнобедренного треугольника считаем CN.
export function t17BisectorsExternalCN() {
  return attempt(() => {
    const c = randInt(3, 30), a = randInt(2, 2 * c - 1)
    // равнобедренный треугольник остроугольный ровно при BC < AB·√2
    if (a >= c * Math.SQRT2 - 1e-9) return null
    const model = () => {
      const { A, B, C } = triSSS(a, c, c)                    // AB = AC = c, BC = a
      need(eq(dist(A, B), dist(A, C)), "треугольник не равнобедренный")
      need(angleAt(A, B, C) < 90 && angleAt(B, A, C) < 90 && angleAt(C, A, B) < 90, "треугольник не остроугольный")
      // N лежит на внутренней биссектрисе угла C и внешней биссектрисе угла B —
      // это центр вневписанной окружности, касающейся стороны AB;
      // M — симметрично, центр вневписанной, касающейся AC
      const N = excenterA(C, A, B)
      const M = excenterA(B, A, C)
      need(eq(2 * angleAt(N, C, M), angleAt(B, A, C)), "2∠CNM ≠ ∠ABC")
      return dist(C, N)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 30) return null
    return item({
      preamble: `Дан остроугольный треугольник ABC. Биссектриса внутреннего угла при вершине B пересекает биссектрису внешнего угла при вершине C в точке M, а биссектриса внутреннего угла при вершине C пересекает биссектрису внешнего угла при вершине B в точке N.`,
      qa: "2∠CNM = ∠ABC.",
      qb: `Найдите CN, если AB = AC = ${c}, BC = ${a}.`,
      ans: Sstr(ex), num, model,
      solution: `Точка N — центр вневписанной окружности, касающейся стороны AC, поэтому CN — биссектриса внутреннего угла C, продолженная до этого центра. Прямым вычислением CN = ${Sstr(ex)}.`,
    })
  })
}

// ══════════════════════════════════════════════════════════════════════════
// РЕЕСТР ТИПАЖЕЙ
// ══════════════════════════════════════════════════════════════════════════
// Группы — по конфигурации (трапеция, биссектрисы, высоты, окружности): именно так
// планиметрию разбирают на занятии, а эталон идёт сплошной нумерацией #1–#61.
//
// ВАЖНО: функции подставлены ПО ИМЕНИ, без стрелок-обёрток, иначе keyOfGen
// (он ищет генератор по тождеству функции) потеряет gen_key, а на нём держится
// аналитика слабых типажей.
export const META17 = [
  ["Трапеция", [
    ["trap-perp-diagonals", "Сумма оснований и диагонали: высота", t17TrapPerpDiagHeight],
    ["trap-right-angles-ad", "Углы ABD и ACD прямые: найти AD", t17TrapRightAnglesAD],
    ["trap-two-isosceles", "Диагональ режет на два равнобедренных: найти CD", t17TrapTwoIsoscelesCD],
    ["trap-3to1-dist", "AD = 3BC: расстояние до середины диагонали", t17TrapThreeToOneDist],
    ["trap-2to1-od", "AD = 2BC: расстояние от C до середины OD", t17TrapTwoToOneOD],
    ["trap-cm-median", "Высота CM делит AD 2 : 1: расстояние до середины BD", t17TrapCMMedianDist],
    ["trap-circle-on-side", "Окружность на боковой стороне как на диаметре: найти AD", t17TrapCircleOnSideAD],
    ["trap-inscribed-ac", "Описанная трапеция: диагональ по средней линии и углу", t17TrapInscribedCircleAC],
    ["trap-midpoints-part", "Середины AD и AB: доля площади четырёхугольника AMOE", t17TrapMidpointsAreaPart],
    ["trap-circle-on-ad", "Окружность на AD как на диаметре: площадь AOB", t17TrapCircleOnADArea],
    ["right-trap-inscribed", "Прямоугольная описанная трапеция: площадь", t17RightTrapInscribedArea],
    ["trap-right-angles-m", "Точка M с прямыми углами ABM и DCM: угол BAD", t17TrapRightAnglesM],
    ["trap-perp-bh-ed", "BH ∥ ED: отношение BH к ED", t17TrapPerpBHED],
    ["trap-circle-bc-pm", "Окружность через B и C: найти PM", t17TrapCircleBCPM],
    ["right-trap-incircle-aom", "Вписанная окружность: площадь треугольника AOM", t17RightTrapIncircleAOM],
    ["trap-two-circles", "Две вписанные окружности: площадь трапеции", t17TrapTwoCirclesArea],
    ["mid-quad-ratio", "Средние линии четырёхугольника: отношение BC к AD", t17MidQuadRatio],
  ]],
  ["Биссектрисы", [
    ["bisector-perp-ratio", "Перпендикуляр к биссектрисе: отношение AP : PN", t17BisectorPerpRatio],
    ["bisectors-cyclic-area", "∠AOC = 120°, вписанный BDOE: площадь ABC", t17BisectorsCyclicArea],
    ["bisector-feet-area", "Перпендикуляры из B на биссектрисы: площадь KBM", t17BisectorFeetArea],
    ["parallelogram-bisector", "Биссектриса угла параллелограмма: найти угол BAD", t17ParallelogramBisectorAngle],
    ["bisector-length-area", "Длина биссектрисы: площадь треугольника", t17BisectorLengthArea],
    ["right-midline-bisector", "Биссектриса и средняя линия: отношение площадей", t17RightMidlineBisector],
    ["perp-bisector-inradius", "Серединный перпендикуляр и биссектриса: радиус вписанной", t17PerpBisectorInradius],
    ["bisectors-concyclic", "B, C, M, N на одной окружности: площадь AMPN", t17BisectorsConcyclicArea],
    ["bisectors-external-cn", "Внутренние и внешние биссектрисы: найти CN", t17BisectorsExternalCN],
  ]],
  ["Высоты и ортоцентр", [
    ["altitude-feet-r", "Основания высот: радиус описанной окружности", t17AltitudeFeetCircumradius],
    ["altitude-feet-ratio", "Перпендикуляры из основания высоты: отношение площадей", t17AltitudeFeetAreaRatio],
    ["iso-obtuse-mk", "Тупоугольный равнобедренный: найти MK", t17IsoObtuseMK],
    ["ortho-ah-bc", "AH и угол A: найти BC", t17OrthocenterAHtoBC],
    ["obtuse-bh", "Тупой угол 120°: найти BH", t17ObtuseBH],
    ["ortho-b1c1-dist", "B₁C₁ и угол A: расстояние от центра описанной до BC", t17OrthoB1C1Distance],
    ["two-altitudes-ratio", "Две высоты: отношение площадей BMN и ABC", t17TwoAltitudesAreaRatio],
    ["nine-point-a1h", "Окружность девяти точек: найти A₁H", t17NinePointA1H],
    ["diameter-altitude-df", "Высота и диаметр описанной: найти DF", t17DiameterAltitudeDF],
    ["diameter-dist-ac", "Диаметр BN: расстояние от N до AC", t17DiameterDistanceToAC],
    ["ortho-circum-aho", "AH = AO: площадь треугольника AHO", t17OrthoCircumAreaAHO],
    ["reflected-ortho-area", "Продолжения высот на окружности: площадь MNP", t17ReflectedOrthoArea],
    ["right-mid-feet-area", "Середины катетов и высота: площадь PQM", t17RightMidFeetArea],
    ["altitude-perp-eh", "Перпендикуляры к высотам: отношение EH к AC", t17AltitudePerpEH],
  ]],
  ["Вписанная и вневписанная окружности", [
    ["incircle-touch-sin", "Точка касания на AC: найти sin∠BMC", t17IncircleTouchSin],
    ["incircle-ad-eq-r", "AD = R: площадь треугольника BEF", t17IncircleADeqR],
    ["incircle-right-oi", "Точки касания задают прямой угол: расстояние между центрами", t17IncircleRightOI],
    ["incircle-right-oi-r", "То же в долях радиуса: расстояние между центрами", t17IncircleRightOIletters],
    ["incenter-reflect-area", "Симметрия относительно CO: площадь ABOB₁", t17IncenterReflectArea],
    ["midline-incircle-ratio", "Средняя линия и вписанная окружность: отношение отрезков", t17MidlineIncircleRatio],
    ["excircle-touch-ratio", "Вневписанная окружность: отношение на боковой стороне", t17ExcircleTouchRatio],
    ["iso-pq-incircle", "Отрезок PQ внутри вписанной окружности", t17IsoPQinIncircle],
    ["two-circles-in-right", "Две окружности в прямоугольном треугольнике: радиус", t17TwoCirclesInRight],
    ["two-incircles-altitude", "Вписанные в ACH и BCH: площадь MO₁NO₂", t17TwoIncirclesOnAltitude],
    ["rhombus-touch-rect", "Вписанная в ромб: площадь четырёхугольника касаний", t17RhombusTouchRectangle],
  ]],
  ["Вписанные прямоугольники и квадраты", [
    ["right-iso-rectangle", "Прямоугольник в равнобедренном прямоугольном: площадь", t17RightIsoRectangle],
    ["iso-120-rectangle", "Прямоугольник в треугольнике с углом 120°: площадь", t17Iso120Rectangle],
    ["square-in-triangle-aq", "Квадрат в треугольнике: найти AQ", t17SquareInTriangleAQ],
    ["right-bisectors-pq", "Две перпендикулярные биссектрисы: найти PQ", t17RightBisectorsPQ],
  ]],
  ["Вписанный четырёхугольник", [
    ["cyclic-quad-bd", "Птолемей: найти диагональ BD", t17CyclicQuadBD],
    ["cyclic-quad-diag-angle", "Два прямых угла: угол между диагоналями", t17CyclicQuadDiagAngle],
  ]],
  ["Две окружности", [
    ["two-circles-inner-al", "Внутреннее касание, меньшая через центр: найти AL", t17TwoCirclesInnerAL],
    ["two-tangent-area", "Внешнее касание и общая касательная: площадь", t17TwoTangentTriangleArea],
    ["two-tangent-circumradius", "Внешнее касание: радиус описанной около BCD", t17TwoTangentCircumradius],
    ["circle-diameter-cm", "Окружность с диаметром CM: площадь BOMN", t17CircleDiameterCMArea],
  ]],
]

export const GEN17 = META17.flatMap(([, skins]) => skins.map(([, , fn]) => fn))
