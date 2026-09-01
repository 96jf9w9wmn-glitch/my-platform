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
// Лежат ли четыре точки на одной окружности.
function concyclic(a, b, c, d) {
  const ci = circumcircle(a, b, c)
  return Math.abs(dist(ci.c, d) - ci.r) <= 1e-7 * Math.max(1, ci.r)
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
