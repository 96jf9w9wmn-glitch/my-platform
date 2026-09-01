// Генераторы ЕГЭ математика ПРОФИЛЬ, задание №14 (старая нумерация) — СТЕРЕОМЕТРИЯ,
// часть 2: «а) Докажите …; б) Найдите …». В нумерации КИМ-2027 это №15.
//
// Эталон типажей — присланный файл «Dlya_raboty_s_kursom_14.pdf» (193 страницы,
// 12 разделов по вопросу пункта б, 131 позиция; у каждой задачи есть «(дз)»-аналог,
// который показывает, КАКИЕ числа варьируются). Инвентарь строка-в-строку —
// fipi_bank_ege_prof/typages_task14.md. После склейки дублей между разделами
// (одна конфигурация лежит и в «Отношение отрезков» по пункту а, и в «Объём»
// по пункту б) остаётся 68 уникальных типажей.
//
// ФИЛОСОФИЯ (важно): ни один ответ не выведен «на бумаге» и не вбит константой.
// У каждого скина ДВА НЕЗАВИСИМЫХ ПРЕДСТАВЛЕНИЯ:
//   • exact — точное значение, собранное из параметров условия формулой типажа
//     (оно же печатается в ответе: «26», «8√2», «arctg 3», «2:1»);
//   • model — КООРДИНАТНАЯ модель тела: вершины, грани, секущая плоскость. Ответ
//     из неё добывает ОБЩИЙ движок (сечение выпуклого многогранника плоскостью,
//     площадь по Ньюэллу, объём отсечённой части, расстояния и углы через векторы),
//     который ничего не знает о формуле типажа.
// verify14 требует их совпадения с точностью 1e-9. Ошибка в выкладке типажа не
// может пройти незаметно: движок посчитает по чертежу и разойдётся с формулой.
//
// Параметры подбираются под КРАСИВЫЙ ответ (как в эталоне: 26, 16, 8, 60°): семейство
// чисел задаётся так, чтобы подкоренные выражения были полными квадратами.
//
// Формат объекта: { condition_text, answer, solution, _verify }.
// Мат-токены разворачивает renderTaskMath(): ⟦f:n:d⟧ дробь столбиком, ⟦r:x⟧ корень,
// ⟦b:x⟧ индекс. Индексы вершин (A₁, B₁) — юникодом ₁: они идут сплошным потоком
// в тексте, где ⟦b⟧ рвал бы захват соседних токенов.
// answer — plain-текст (моноширинный), дроби в нём инлайном («3/2»): это ключ ответа.

// ══════════════════════════════════════════════════════════════════════════
// БАЗОВЫЕ УТИЛИТЫ
// ══════════════════════════════════════════════════════════════════════════
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b] } return a || 1 }
const MINUS = "−" // U+2212
const EPS = 1e-9

const fT = (n, d) => `⟦f:${n}:${d}⟧`
const rT = (x) => `⟦r:${x}⟧`
const SUBD = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" }
const sub = (n) => String(n).split("").map((c) => SUBD[c] ?? c).join("")
const SUPD = { 2: "²", 3: "³" }
const sup = (n) => String(n).split("").map((c) => SUPD[c] ?? c).join("")

// Число «по-русски»: десятичная запятая, минус U+2212.
function ru(x) {
  if (!Number.isFinite(x)) return String(x)
  const s = Number.isInteger(x) ? String(x) : String(Math.round(x * 1e9) / 1e9)
  return s.replace(".", ",").replace(/^-/, MINUS)
}
// Целое? (с допуском)
const isInt = (x) => Math.abs(x - Math.round(x)) < 1e-9
// Полный квадрат?
const isSq = (n) => n >= 0 && isInt(Math.sqrt(n))

// √n с вынесением полного квадрата: 12 → {k:2, m:3}; 16 → {k:4, m:1}.
function sqrtParts(n) {
  let k = 1, m = Math.round(n)
  for (let d = 2; d * d <= m; d++) { while (m % (d * d) === 0) { m /= d * d; k *= d } }
  return { k, m }
}

// ══════════════════════════════════════════════════════════════════════════
// ТОЧНЫЕ ЗНАЧЕНИЯ ОТВЕТА: (a/b)·√r — покрывает целые, дроби и корни разом.
// ══════════════════════════════════════════════════════════════════════════
// S(a, b, r) = a/b · √r. Хранится сокращённой и с вынесенным из-под корня квадратом.
function S(a, b = 1, r = 1) {
  if (b < 0) { a = -a; b = -b }
  const { k, m } = sqrtParts(r)
  a *= k; r = m
  const g = gcd(a, b) || 1
  return { a: a / g, b: b / g, r }
}
const Sval = (s) => (s.a / s.b) * Math.sqrt(s.r)
const Smul = (x, y) => S(x.a * y.a, x.b * y.b, x.r * y.r)
const Sdiv = (x, y) => S(x.a * y.b * y.r, x.b * y.a * y.r, x.r * y.r)
// Строка ответа (plain): «26», «8√2», «3/2·√5» → пишем как «3√5/2».
function Sstr(s) {
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
function Scond(s) {
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
const SQUAREFREE = (() => {
  const out = []
  for (let r = 1; r <= 400; r++) {
    let ok = true
    for (let d = 2; d * d <= r; d++) if (r % (d * d) === 0) { ok = false; break }
    if (ok) out.push(r)
  }
  return out
})()

// Рациональное приближение с знаменателем ≤ maxDen (точное совпадение до 1e-12).
function ratOf(x, maxDen = 240) {
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
  const terms = [...byR.entries()].filter(([, q]) => q.a !== 0).sort((x, y) => x[0] - y[0])
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
function attempt(fn, tries = 400) {
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

// ══════════════════════════════════════════════════════════════════════════
// 3D-ДВИЖОК. Ничего не знает о типажах: получает вершины/грани/плоскость и
// считает величину «по чертежу». Это и есть независимая проверка формулы.
// ══════════════════════════════════════════════════════════════════════════
const v3 = (x, y, z) => ({ x, y, z })
const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z)
const subv = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z)
const scal = (a, t) => v3(a.x * t, a.y * t, a.z * t)
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
const len = (a) => Math.sqrt(dot(a, a))
const dist = (a, b) => len(subv(a, b))
const mid = (a, b) => scal(add(a, b), 0.5)
// Точка на отрезке AB, делящая его в отношении t от A: A + t·(B−A).
const lerp = (a, b, t) => add(a, scal(subv(b, a), t))
// Точка, делящая AB в отношении p:q считая от A.
const divPt = (a, b, p, q) => lerp(a, b, p / (p + q))

// Плоскость через точку p с нормалью n: {n, d}, где n·x = d.
const planePN = (p, n) => ({ n, d: dot(n, p) })
// Плоскость через три точки.
function plane3(a, b, c) {
  const n = cross(subv(b, a), subv(c, a))
  if (len(n) < EPS) throw new Error("три точки плоскости коллинеарны")
  return planePN(a, n)
}
// Плоскость через две точки, параллельная вектору v.
function planePPV(a, b, v) {
  const n = cross(subv(b, a), v)
  if (len(n) < EPS) throw new Error("вырожденная плоскость (точки и вектор компланарны)")
  return planePN(a, n)
}
// Плоскость через точку a, параллельная двум векторам.
const planePVV = (a, u, v) => planePN(a, cross(u, v))
// Знаковое расстояние до плоскости (в единицах длины).
const sdist = (pl, p) => (dot(pl.n, p) - pl.d) / len(pl.n)
// Расстояние от точки до плоскости.
const distPointPlane = (pl, p) => Math.abs(sdist(pl, p))

// Пересечение прямой (p + t·u) с плоскостью.
function linePlane(pl, p, u) {
  const den = dot(pl.n, u)
  if (Math.abs(den) < 1e-12) return null
  const t = (pl.d - dot(pl.n, p)) / den
  return { pt: add(p, scal(u, t)), t }
}
// Пересечение прямой AB с плоскостью (параметр t: 0 в A, 1 в B).
const segPlane = (pl, a, b) => linePlane(pl, a, subv(b, a))

// Угол (в градусах) между прямыми, заданными направляющими векторами.
const angLines = (u, w) => Math.acos(Math.min(1, Math.abs(dot(u, w)) / (len(u) * len(w)))) * 180 / Math.PI
// Угол между прямой и плоскостью.
const angLinePlane = (u, pl) => Math.asin(Math.min(1, Math.abs(dot(u, pl.n)) / (len(u) * len(pl.n)))) * 180 / Math.PI
// Угол между плоскостями (острый).
const angPlanes = (p1, p2) => angLines(p1.n, p2.n)
// Расстояние между скрещивающимися прямыми (a+t·u) и (b+s·w).
function distLines(a, u, b, w) {
  const n = cross(u, w)
  if (len(n) < 1e-12) { // параллельны: расстояние от точки до прямой
    const d = subv(b, a)
    return len(cross(d, u)) / len(u)
  }
  return Math.abs(dot(subv(b, a), n)) / len(n)
}
// Расстояние от точки до прямой.
const distPointLine = (p, a, u) => len(cross(subv(p, a), u)) / len(u)

// Площадь плоского многоугольника (Ньюэлл: сумма векторных произведений).
function polyArea(pts) {
  if (pts.length < 3) return 0
  let n = v3(0, 0, 0)
  for (let i = 0; i < pts.length; i++) {
    n = add(n, cross(pts[i], pts[(i + 1) % pts.length]))
  }
  return len(n) / 2
}
// Периметр многоугольника.
function polyPerimeter(pts) {
  let p = 0
  for (let i = 0; i < pts.length; i++) p += dist(pts[i], pts[(i + 1) % pts.length])
  return p
}

// ── Многогранник: {V: [точки], F: [[индексы вершин грани по контуру]]} ──────
// Объём (через дивергенцию: сумма по треугольникам-веерам граней).
function polyVolume(P) {
  let vol = 0
  for (const f of P.F) {
    const a = P.V[f[0]]
    for (let i = 1; i + 1 < f.length; i++) {
      vol += dot(a, cross(P.V[f[i]], P.V[f[i + 1]])) / 6
    }
  }
  return Math.abs(vol)
}

// Упорядочить точки плоского многоугольника по контуру (сортировкой по углу
// вокруг центра тяжести в базисе плоскости).
function orderPolygon(pts) {
  if (pts.length < 3) return pts
  let c = v3(0, 0, 0)
  for (const p of pts) c = add(c, p)
  c = scal(c, 1 / pts.length)
  // нормаль — по самой «толстой» паре
  let n = null
  for (let i = 0; i < pts.length && !n; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const t = cross(subv(pts[i], c), subv(pts[j], c))
      if (len(t) > 1e-9) { n = t; break }
    }
  }
  if (!n) return pts
  const e1 = scal(subv(pts[0], c), 1 / len(subv(pts[0], c)))
  const e2 = scal(cross(n, e1), 1 / len(cross(n, e1)))
  return pts.slice().sort((p, q) => {
    const ap = Math.atan2(dot(subv(p, c), e2), dot(subv(p, c), e1))
    const aq = Math.atan2(dot(subv(q, c), e2), dot(subv(q, c), e1))
    return ap - aq
  })
}

// Убрать совпадающие точки.
function dedupe(pts, eps = 1e-7) {
  const out = []
  for (const p of pts) if (!out.some((q) => dist(p, q) < eps)) out.push(p)
  return out
}

// СЕЧЕНИЕ выпуклого многогранника плоскостью: многоугольник (по контуру).
// Собирается из пересечений плоскости с рёбрами всех граней.
function section(P, pl) {
  const pts = []
  const seen = new Set()
  for (const f of P.F) {
    for (let i = 0; i < f.length; i++) {
      const ia = f[i], ib = f[(i + 1) % f.length]
      const key = ia < ib ? `${ia}_${ib}` : `${ib}_${ia}`
      if (seen.has(key)) continue
      seen.add(key)
      const A = P.V[ia], B = P.V[ib]
      const da = sdist(pl, A), db = sdist(pl, B)
      if (Math.abs(da) < 1e-9) pts.push(A)
      if (Math.abs(db) < 1e-9) pts.push(B)
      if (da * db < -1e-18) {
        const r = segPlane(pl, A, B)
        if (r && r.t > -1e-9 && r.t < 1 + 1e-9) pts.push(r.pt)
      }
    }
  }
  return orderPolygon(dedupe(pts))
}
const sectionArea = (P, pl) => polyArea(section(P, pl))
const sectionPerimeter = (P, pl) => polyPerimeter(section(P, pl))

// ОТСЕЧЕНИЕ полупространством n·x ≤ d: объём части многогранника.
// Каждая грань режется как плоский многоугольник, плюс добавляется грань-сечение.
function clipVolume(P, pl, side = -1) {
  const faces = []
  for (const f of P.F) {
    const poly = f.map((i) => P.V[i])
    const kept = []
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length]
      const da = side * sdist(pl, A), db = side * sdist(pl, B)
      if (da <= 1e-9) kept.push(A)
      if (da * db < -1e-18) {
        const r = segPlane(pl, A, B)
        if (r) kept.push(r.pt)
      }
    }
    const cl = dedupe(kept)
    if (cl.length >= 3) faces.push(cl)
  }
  const cap = section(P, pl)
  if (cap.length >= 3) faces.push(cap)
  if (!faces.length) return 0
  // объём по дивергенции; ориентация не важна — берём модуль каждой пирамиды
  // от общей внутренней точки
  let c = v3(0, 0, 0), cnt = 0
  for (const f of faces) for (const p of f) { c = add(c, p); cnt++ }
  c = scal(c, 1 / cnt)
  let vol = 0
  for (const f of faces) {
    const a = f[0]
    for (let i = 1; i + 1 < f.length; i++) {
      vol += Math.abs(dot(subv(a, c), cross(subv(f[i], c), subv(f[i + 1], c)))) / 6
    }
  }
  return vol
}

// Объём тетраэдра.
const tetraVolume = (a, b, c, d) => Math.abs(dot(subv(b, a), cross(subv(c, a), subv(d, a)))) / 6
// Объём пирамиды: основание — плоский многоугольник, вершина — точка.
function pyramidVolume(base, apex) {
  const pl = plane3(base[0], base[1], base[2])
  return polyArea(base) * distPointPlane(pl, apex) / 3
}

// ── Готовые тела ───────────────────────────────────────────────────────────
// Призма по контуру основания (снизу) и вектору бокового ребра.
// Вершины: 0..n−1 — низ, n..2n−1 — верх (в том же порядке).
function prism(base, up) {
  const n = base.length
  const V = [...base, ...base.map((p) => add(p, up))]
  const F = [
    base.map((_, i) => i),
    base.map((_, i) => n + i),
    ...base.map((_, i) => {
      const j = (i + 1) % n
      return [i, j, n + j, n + i]
    }),
  ]
  return { V, F }
}
// Пирамида: контур основания + вершина (последний индекс).
function pyramid(base, apex) {
  const n = base.length
  const V = [...base, apex]
  const F = [base.map((_, i) => i), ...base.map((_, i) => [i, (i + 1) % n, n])]
  return { V, F }
}
// Прямоугольный параллелепипед a×b×c: ABCD снизу, A₁B₁C₁D₁ сверху.
function box(a, b, c) {
  return prism([v3(0, 0, 0), v3(a, 0, 0), v3(a, b, 0), v3(0, b, 0)], v3(0, 0, c))
}
// Правильный n-угольник радиуса R в плоскости z=0, первая вершина под углом φ₀.
function regular(n, R, phi0 = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = phi0 + 2 * Math.PI * i / n
    return v3(R * Math.cos(a), R * Math.sin(a), 0)
  })
}

// ══════════════════════════════════════════════════════════════════════════
// СБОРКА ОБЪЕКТА ЗАДАНИЯ
// ══════════════════════════════════════════════════════════════════════════
// exact — {kind:"S", value:S} | {kind:"deg", value:число} | {kind:"text", value, num}
// model — функция, возвращающая ЧИСЛО (тот же ответ, посчитанный движком).
function item({ preamble, qa, qb, ans, num, model, solution, keyNum }) {
  return {
    condition_text: `${preamble}\n\nа) Докажите, что ${qa}\nб) ${qb}`,
    answer: `б) ${ans}`,
    solution,
    _verify: { num, model, keyNum: keyNum ?? num },
  }
}

// ── проверка объекта (для смоука) ──────────────────────────────────────────
// 1. модель (координатный расчёт движком) совпадает с напечатанным ответом;
// 2. в условии нет сырых токенов, NaN и undefined;
// 3. пункты а) и б) непусты.
export function verify14(o) {
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
  if (Math.abs(got - V.num) > 1e-7 * scale) {
    return { ok: false, err: `модель ${got} ≠ ответ ${V.num}` }
  }
  return { ok: true }
}

// Экспорт движка — им пользуется смоук и, при желании, будущие типажи.
export const _engine = {
  v3, add, subv, scal, dot, cross, len, dist, mid, lerp, divPt,
  plane3, planePN, planePPV, planePVV, sdist, distPointPlane, linePlane, segPlane,
  angLines, angLinePlane, angPlanes, distLines, distPointLine,
  polyArea, polyPerimeter, polyVolume, section, sectionArea, sectionPerimeter,
  clipVolume, tetraVolume, pyramidVolume, prism, pyramid, box, regular,
  S, Sval, Sstr, Scond, sqrtParts, exactOf, exactSumOf, angleExact, ratioExact, ratOf,
}

// ══════════════════════════════════════════════════════════════════════════
// ОБЩИЕ КУСКИ ТЕКСТА
// ══════════════════════════════════════════════════════════════════════════
const BOX = "ABCDA₁B₁C₁D₁"
const PRISM4 = "ABCDA₁B₁C₁D₁"
const PRISM3 = "ABCA₁B₁C₁"
// Длина: целое → «5», иначе радикалом/дробью.
const L = (s) => Scond(s)
// Подбор параметров: крутим fn, пока не вернёт объект (null = параметры не подошли).
function tryPick(fn, tries = 400) {
  for (let i = 0; i < tries; i++) { const r = fn(); if (r) return r }
  throw new Error("не подобрались параметры")
}
// Утверждение внутри модели: если геометрия не та, что описана в пункте а,
// смоук обязан упасть, а не показать «ответ» к другой задаче.
function need(cond, msg) { if (!cond) throw new Error("модель: " + msg) }
const eq = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))

// ══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ A. «Докажите, что сечение или грань является …»
// ══════════════════════════════════════════════════════════════════════════

// A1. Прямая призма, основание — квадрат со стороной s = k√2, высота h = 2√t.
// K — середина BB₁, α через K и C₁ ∥ BD₁. Сечение — равнобедренный треугольник A₁C₁K.
export function t14PrismSquareTriPerimeter() {
  const { k, t } = tryPick(() => {
    const k = randInt(2, 8)
    const w = randInt(Math.ceil(k * Math.SQRT2) + 1, k * 3)
    const t = w * w - 2 * k * k
    if (t < 2 || t > 90) return null
    if (isSq(t)) return null              // высота осталась бы целой — в эталоне радикал
    return { k, t }
  })
  const s = k * Math.SQRT2, h = 2 * Math.sqrt(t)
  const model = () => {
    const P = prism([v3(0, 0, 0), v3(s, 0, 0), v3(s, s, 0), v3(0, s, 0)], v3(0, 0, h))
    const [A, B, C, D, A1, B1, C1, D1] = P.V
    const K = mid(B, B1)
    const poly = section(P, planePPV(K, C1, subv(D1, B)))
    need(poly.length === 3, "сечение не треугольник")
    const sd = poly.map((p, i) => dist(p, poly[(i + 1) % 3]))
    need(sd.some((x, i) => eq(x, sd[(i + 1) % 3])), "треугольник не равнобедренный")
    return polyPerimeter(poly)
  }
  const num = model()
  const ex = exactOf(num)
  if (!ex) return t14PrismSquareTriPerimeter()
  return item({
    preamble: `Основанием прямой четырёхугольной призмы ${PRISM4} является квадрат ABCD со стороной ${L(S(k, 1, 2))}, высота призмы равна ${L(S(2, 1, t))}. Точка K — середина ребра BB₁. Через точки K и C₁ проведена плоскость α, параллельная прямой BD₁.`,
    qa: "сечение призмы плоскостью α является равнобедренным треугольником.",
    qb: "Найдите периметр треугольника, являющегося сечением призмы плоскостью α.",
    ans: Sstr(ex), num, model,
    solution: `Плоскость α проходит через A₁ и C₁ (она параллельна BD₁ и содержит K), поэтому сечение — треугольник A₁C₁K. Его боковые стороны A₁K = C₁K = √(AB² + BK²) = ${Sstr(exactOf(dist(v3(0, 0, h), mid(v3(s, 0, 0), v3(s, 0, h)))) || S(0))}, основание A₁C₁ = AB·√2 = ${2 * k}. Периметр равен ${Sstr(ex)}.`,
  })
}

// A2. Правильная треугольная призма, сторона основания a = 4u, боковое ребро h.
// Сечение через A₁, B₁ и середину BC — трапеция с основаниями a и a/2.
export function t14PrismTriTrapArea() {
  const { u, h, w } = tryPick(() => {
    const u = randInt(2, 8), h = randInt(3, 26)
    const w2 = 3 * u * u + h * h
    if (!isSq(w2)) return null
    return { u, h, w: Math.round(Math.sqrt(w2)) }
  })
  const a = 4 * u
  const model = () => {
    const P = prism([v3(0, 0, 0), v3(a, 0, 0), v3(a / 2, a * Math.sqrt(3) / 2, 0)], v3(0, 0, h))
    const [A, B, C, A1, B1, C1] = P.V
    const poly = section(P, plane3(A1, B1, mid(B, C)))
    need(poly.length === 4, "сечение не четырёхугольник")
    return polyArea(poly)
  }
  const num = model()
  const ex = exactOf(num)
  if (!ex) return t14PrismTriTrapArea()
  return item({
    preamble: `В правильной треугольной призме ${PRISM3} стороны основания равны ${a}, боковые рёбра равны ${h}.`,
    qa: "сечение призмы плоскостью, проходящей через A₁, B₁ и середину ребра BC, является трапецией.",
    qb: "Найдите площадь сечения призмы плоскостью, проходящей через вершины A₁, B₁ и середину ребра BC.",
    ans: Sstr(ex), num, model,
    solution: `Плоскость пересекает основание по средней линии MN треугольника ABC (M — середина BC, N — середина AC), поэтому сечение — трапеция A₁B₁MN с основаниями A₁B₁ = ${a} и MN = ${a / 2}. Её высота равна √(3a²/16 + h²) = ${w}, площадь = (${a} + ${a / 2})/2 · ${w} = ${Sstr(ex)}.`,
  })
}

// A3. Пирамида SABC: SA = SB, основание высоты — середина медианы CM.
// Треугольник ABC равнобедренный; объём = (1/3)·AB/2·CM·2·h.
export function t14PyrMedianMidVolume() {
  const { hh, g, fS, pStr, qS } = tryPick(() => {
    const h = randInt(3, 13), g = randInt(2, 12)
    const q2 = h * h + g * g
    if (q2 > 400) return null
    if (Math.random() < 0.5) {
      // семейство 1: p целое, p² = h²+g²+f², q = √(h²+g²) — как в аналоге эталона
      const f = randInt(2, 14)
      if (!isSq(q2 + f * f)) return null
      return { hh: h, g, fS: S(f), pStr: String(Math.round(Math.sqrt(q2 + f * f))), qS: S(1, 1, q2) }
    }
    // семейство 2: q целое, p целое, f = √(p²−q²) — как в основном условии эталона
    if (!isSq(q2)) return null
    const q = Math.round(Math.sqrt(q2))
    const p = randInt(q + 1, q + 12)
    const f2 = p * p - q * q
    return { hh: h, g, fS: S(1, 1, f2), pStr: String(p), qS: S(q) }
  })
  const p = Number(pStr), qv = Sval(qS)
  const c = Math.sqrt(p * p - qv * qv), m = 2 * Math.sqrt(qv * qv - hh * hh)
  const model = () => {
    const A = v3(-c, 0, 0), B = v3(c, 0, 0), C = v3(0, m, 0)
    const N = mid(C, mid(A, B))
    const Sp = add(N, v3(0, 0, hh))
    need(eq(dist(Sp, A), p) && eq(dist(Sp, B), p), "SA и SB не равны заданному")
    need(eq(dist(Sp, C), qv), "SC не равно заданному")
    need(eq(dist(C, A), dist(C, B)), "ABC не равнобедренный")
    return pyramidVolume([A, B, C], Sp)
  }
  const num = model()
  const ex = exactOf(num)
  if (!ex || Math.abs(ex.a) > 4000) return t14PyrMedianMidVolume()
  return item({
    preamble: `В треугольной пирамиде SABC известны боковые рёбра: SA = SB = ${pStr}, SC = ${L(qS)}. Основанием высоты этой пирамиды является середина медианы CM треугольника ABC. Эта высота равна ${hh}.`,
    qa: "треугольник ABC равнобедренный.",
    qb: "Найдите объём пирамиды SABC.",
    ans: Sstr(ex), num, model,
    solution: `Пусть N — середина CM и SN — высота. Из SA = SB следует NA = NB, то есть N лежит на серединном перпендикуляре к AB, а значит CA = CB. Далее NC² = SC² − SN² даёт CM = ${SX(m)}, а NA² = SA² − SN² даёт AB = ${SX(2 * c)}. Объём = ⅓ · ½ · AB · CM · SN = ${Sstr(ex)}.`,
  })
}

// A4. Правильная четырёхугольная пирамида, все рёбра равны a; S₁ — точка, для которой
// O — середина SS₁. Сечение S₁LM — равнобокая трапеция, её средняя линия = 3a/4.
export function t14PyrRefletTrapMidline() {
  const a = pick([4, 6, 8, 10, 12, 14, 16, 20])
  const model = () => {
    const H = a / Math.SQRT2
    const A = v3(-a / 2, -a / 2, 0), B = v3(a / 2, -a / 2, 0), C = v3(a / 2, a / 2, 0), D = v3(-a / 2, a / 2, 0)
    const Sp = v3(0, 0, H), S1 = v3(0, 0, -H)
    need(eq(dist(Sp, A), a), "боковое ребро не равно стороне основания")
    const P = pyramid([A, B, C, D], Sp)
    const poly = section(P, plane3(S1, divPt(B, C, 1, 2), mid(A, Sp)))
    need(poly.length === 4, "сечение не четырёхугольник")
    const sd = poly.map((p, i) => dist(p, poly[(i + 1) % 4]))
    // равнобокая трапеция: одна пара сторон параллельна, другая пара равна
    const par = []
    for (let i = 0; i < 4; i++) {
      const u = subv(poly[(i + 1) % 4], poly[i]), w = subv(poly[(i + 3) % 4], poly[(i + 2) % 4])
      if (len(cross(u, w)) < 1e-7 * len(u) * len(w)) par.push([len(u), len(w), i])
    }
    need(par.length >= 1, "нет параллельных сторон — не трапеция")
    const [x, y, i] = par[0]
    need(eq(sd[(i + 1) % 4], sd[(i + 3) % 4]), "боковые стороны не равны — трапеция не равнобокая")
    return (x + y) / 2
  }
  const num = model()
  const ex = exactOf(num)
  if (!ex) return t14PyrRefletTrapMidline()
  return item({
    preamble: `Все рёбра правильной четырёхугольной пирамиды SABCD с вершиной S равны ${a}. Основание высоты SO этой пирамиды является серединой отрезка SS₁, M — середина ребра AS, точка L лежит на ребре BC так, что BL : LC = 1 : 2.`,
    qa: "сечение пирамиды SABCD плоскостью S₁LM — равнобокая трапеция.",
    qb: "Вычислите длину средней линии этой трапеции.",
    ans: Sstr(ex), num, model,
    solution: `Сечение — трапеция с основаниями ${Sstr(S(a / 2))} и ${Sstr(S(a))}·… : её параллельные стороны относятся как 1 : 2, а средняя линия равна ¾ · ${a} = ${Sstr(ex)}.`,
  })
}

// A5. Прямоугольный параллелепипед; сечение через AC₁, пересекающее BB₁ и DD₁, — ромб.
export function t14BoxRhombusSection() {
  const { p, q, r } = tryPick(() => {
    const p = randInt(2, 9), q = randInt(1, p - 1), r = randInt(3, 12)
    if (p * p - q * q > r * r) return null                 // точка E вышла за ребро
    if ((p * p - q * q) % 2 !== r % 2 && (p * p - q * q) % r !== 0) { /* дробные z допустимы */ }
    return { p, q, r }
  })
  const dz = (p * p - q * q) / r, zE = (r + dz) / 2, zF = (r - dz) / 2
  const model = () => {
    const P = box(p, q, r)
    const [A, B, C, D, A1, B1, C1, D1] = P.V
    const F = v3(p, 0, zF), Ee = v3(0, q, zE)
    need(zF >= -1e-9 && zF <= r + 1e-9 && zE >= -1e-9 && zE <= r + 1e-9, "F или E вне ребра")
    const sd = [dist(A, F), dist(F, C1), dist(C1, Ee), dist(Ee, A)]
    need(sd.every((x) => eq(x, sd[0])), "AFC₁E не ромб")
    need(eq(dot(subv(C1, A), subv(Ee, F)), 0), "диагонали ромба не перпендикулярны")
    return polyArea([A, F, C1, Ee])
  }
  const num = model()
  const ex = exactOf(num)
  if (!ex || ex.b > 8) return t14BoxRhombusSection()
  return item({
    preamble: `В прямоугольном параллелепипеде ${BOX} проведена секущая плоскость, содержащая диагональ AC₁ и пересекающая рёбра BB₁ и DD₁ в точках F и E соответственно.`,
    qa: "сечение AFC₁E — параллелограмм.",
    qb: `Найдите площадь сечения, если известно, что AFC₁E — ромб и AB = ${p}, BC = ${q}, AA₁ = ${r}.`,
    ans: Sstr(ex), num, model,
    solution: `Диагонали AC₁ и FE параллелограмма делятся точкой пересечения пополам, поэтому BF + DE = AA₁. Из равенства AF = AE получаем AB² + BF² = AD² + DE², откуда DE = ${ru(zE)}, BF = ${ru(zF)}. У ромба площадь равна половине произведения диагоналей: S = ½ · AC₁ · FE = ${Sstr(ex)}.`,
  })
}

// A6. Куб, E — середина AA₁: сечение DEB₁ — ромб, угол между DE и BD₁.
export function t14CubeRhombusAngleDE() {
  const a = 1
  const model = () => {
    const P = box(a, a, a)
    const [A, B, C, D, A1, B1, C1, D1] = P.V
    const Ee = mid(A, A1)
    const poly = section(P, plane3(D, Ee, B1))
    need(poly.length === 4, "сечение не четырёхугольник")
    const sd = poly.map((p, i) => dist(p, poly[(i + 1) % 4]))
    need(sd.every((x) => eq(x, sd[0])), "сечение не ромб")
    return angLines(subv(Ee, D), subv(D1, B))
  }
  const num = model()
  const ang = angleExact(num)
  return item({
    preamble: `Точка E — середина ребра AA₁ куба ${BOX}.`,
    qa: "сечение куба плоскостью DEB₁ является ромбом.",
    qb: "Найдите угол между прямыми DE и BD₁.",
    ans: ang.str, num, model,
    solution: `Приняв ребро куба за 1 и введя координаты A(0; 0; 0), B(1; 0; 0), D(0; 1; 0), A₁(0; 0; 1), получаем DE = (0; −1; ½) и BD₁ = (−1; 1; 1). Тогда cos φ = |DE · BD₁| / (|DE| · |BD₁|) = 1/√15, то есть φ = ${ang.str}.`,
  })
}

// A7. Конус: осевое сечение — треугольник с углом 120°, образующая l = k√3;
// сечение через вершину ⊥ образующей.
export function t14ConeObtuseSection() {
  const k = randInt(1, 7)
  const l = k * Math.sqrt(3)
  const model = () => {
    const R = l * Math.sin(Math.PI / 3), H = l * Math.cos(Math.PI / 3)
    const M = v3(0, 0, 0), Apt = v3(R, 0, H)
    const n = subv(Apt, M)
    const ct = -H * H / (R * R)
    need(Math.abs(ct) < 1, "плоскость не пересекает основание")
    const st = Math.sqrt(1 - ct * ct)
    const P1 = v3(R * ct, R * st, H), P2 = v3(R * ct, -R * st, H)
    need(eq(dot(subv(P1, M), n), 0, 1e-9) && eq(dot(subv(P2, M), n), 0, 1e-9), "сечение не перпендикулярно образующей")
    need(eq(dist(M, P1), l) && eq(dist(M, P2), l), "стороны сечения не образующие")
    // тупоугольность: угол при M больше 90°
    need(dot(subv(P1, M), subv(P2, M)) < 0, "треугольник не тупоугольный")
    return polyArea([M, P1, P2])
  }
  const num = model()
  const ex = exactOf(num)
  if (!ex) return t14ConeObtuseSection()
  return item({
    preamble: `Дан прямой круговой конус с вершиной M. Осевое сечение конуса — треугольник с углом 120° при вершине M. Образующая конуса равна ${L(S(k, 1, 3))}. Через точку M проведено сечение конуса, перпендикулярное одной из образующих.`,
    qa: "полученный в сечении треугольник тупоугольный.",
    qb: "Найдите площадь сечения.",
    ans: Sstr(ex), num, model,
    solution: `Радиус основания R = l·sin 60° и высота H = l·cos 60°. Сечение — равнобедренный треугольник с боковыми сторонами, равными образующей l = ${L(S(k, 1, 3))}, и основанием, стягивающим дугу с косинусом −H²/R² = −⅓. Отсюда площадь равна l²√2/3 = ${Sstr(ex)}.`,
  })
}

// A8. Прямоугольный параллелепипед: сечение через BD₁ ∥ AC — ромб ⇒ ABCD квадрат.
export function t14BoxRhombPlaneAngle() {
  const { r, s } = tryPick(() => {
    const r = randInt(3, 16), s = randInt(2, 16)
    if (!isSq(r * r + 4 * s * s)) return null
    return { r, s }
  })
  const model = () => {
    const P = box(s, s, r)
    const [A, B, C, D, A1, B1, C1, D1] = P.V
    const pl = planePPV(B, D1, subv(C, A))
    const poly = section(P, pl)
    need(poly.length === 4, "сечение не четырёхугольник")
    const sd = poly.map((p, i) => dist(p, poly[(i + 1) % 4]))
    need(sd.every((x) => eq(x, sd[0])), "сечение не ромб")
    return angPlanes(pl, plane3(B, C, C1))
  }
  const num = model()
  const ang = angleExact(num)
  if (!ang) return t14BoxRhombPlaneAngle()
  return item({
    preamble: `Сечением прямоугольного параллелепипеда ${BOX} плоскостью α, содержащей прямую BD₁ и параллельной прямой AC, является ромб.`,
    qa: "грань ABCD — квадрат.",
    qb: `Найдите угол между плоскостями α и BCC₁, если AA₁ = ${r}, AB = ${s}.`,
    ans: ang.str, num, model,
    solution: `Сечение — ромб, значит его диагонали перпендикулярны, откуда AB = AD и ABCD — квадрат. В координатах A(0; 0; 0), B(${s}; 0; 0), D(0; ${s}; 0), AA₁ = ${r} нормаль плоскости α равна (−${r}; ${r}; −${2 * s}), нормаль грани BCC₁ — (1; 0; 0). Отсюда искомый угол равен ${ang.str}.`,
  })
}

// A9. Правильная четырёхугольная призма: M, N, K на AB, A₁D₁, C₁D₁ с AM = A₁N = C₁K = 1;
// MNKL — квадрат, но сечение призмы — шестиугольник.
export function t14Prism4SquareSection() {
  const a = randInt(3, 12)
  const h = Math.sqrt(2 * a * (a - 2))
  const model = () => {
    const P = prism([v3(0, 0, 0), v3(a, 0, 0), v3(a, a, 0), v3(0, a, 0)], v3(0, 0, h))
    const [A, B, C, D, A1, B1, C1, D1] = P.V
    const M = lerp(A, B, 1 / a), N = lerp(A1, D1, 1 / a), K = lerp(C1, D1, 1 / a)
    const pl = plane3(M, N, K)
    // L — пересечение плоскости с ребром BC
    const rr = segPlane(pl, B, C)
    need(rr && rr.t > 1e-9 && rr.t < 1 - 1e-9, "L не попала на ребро BC")
    const Lp = rr.pt
    const sd = [dist(M, N), dist(N, K), dist(K, Lp), dist(Lp, M)]
    need(sd.every((x) => eq(x, sd[0])), "MNKL не ромб")
    need(eq(dot(subv(N, M), subv(K, N)), 0), "MNKL не квадрат")
    const poly = section(P, pl)
    need(poly.length === 6, "сечение не шестиугольник")
    return polyArea(poly)
  }
  const num = model()
  const ex = exactOf(num)
  if (!ex) return t14Prism4SquareSection()
  return item({
    preamble: `В правильной четырёхугольной призме ${PRISM4} сторона основания AB равна ${a}, а боковое ребро AA₁ равно ${L(S(1, 1, 2 * a * (a - 2)))}. На рёбрах AB, A₁D₁ и C₁D₁ отмечены точки M, N и K соответственно, причём AM = A₁N = C₁K = 1.`,
    qa: "L — точка пересечения плоскости MNK с ребром BC, и MNKL — квадрат.",
    qb: "Найдите площадь сечения призмы плоскостью MNK.",
    ans: Sstr(ex), num, model,
    solution: `Отрезки MN и NK равны и перпендикулярны, поэтому MNKL — квадрат. Плоскость MNK пересекает ещё и боковые рёбра AA₁ и CC₁, так что сечение — шестиугольник; его площадь равна ${Sstr(ex)}.`,
  })
}

// A10. Правильная треугольная призма: MNKL — квадрат при AB = 3m, AA₁ = m√2.
export function t14Prism3SquareSection() {
  const m = randInt(1, 6)
  const a = 3 * m, h = m * Math.SQRT2
  const model = () => {
    const P = prism([v3(0, 0, 0), v3(a, 0, 0), v3(a / 2, a * Math.sqrt(3) / 2, 0)], v3(0, 0, h))
    const [A, B, C, A1, B1, C1] = P.V
    const M = lerp(A, B, m / a), N = lerp(B1, A1, m / a), K = lerp(C1, B1, m / a)
    const pl = plane3(M, N, K)
    const rr = segPlane(pl, A, C)
    need(rr && rr.t > 1e-9 && rr.t < 1 - 1e-9, "L не попала на ребро AC")
    const Lp = rr.pt
    const sd = [dist(M, N), dist(N, K), dist(K, Lp), dist(Lp, M)]
    need(sd.every((x) => eq(x, sd[0])), "MNKL не ромб")
    need(eq(dot(subv(N, M), subv(K, N)), 0), "MNKL не квадрат")
    return polyArea(section(P, pl))
  }
  const num = model()
  const ex = exactOf(num)
  if (!ex) return t14Prism3SquareSection()
  return item({
    preamble: `В правильной треугольной призме ${PRISM3} сторона основания AB равна ${a}, а боковое ребро AA₁ равно ${L(S(m, 1, 2))}. На рёбрах AB, A₁B₁ и B₁C₁ отмечены точки M, N и K соответственно, причём AM = B₁N = C₁K = ${m}.`,
    qa: "L — точка пересечения плоскости MNK с ребром AC, и MNKL — квадрат.",
    qb: "Найдите площадь сечения призмы плоскостью MNK.",
    ans: Sstr(ex), num, model,
    solution: `Отрезки MN, NK, KL и LM равны ${SX(Math.sqrt(3) * m)} и попарно перпендикулярны, поэтому MNKL — квадрат. Сечение призмы — пятиугольник, его площадь равна ${Sstr(ex)}.`,
  })
}

// Точная запись значения для пояснения; если точной формы нет — округление
// (в ответе такое не появляется: там значение всегда распознано).
const SX = (x) => { const e = exactOf(x); return e ? Sstr(e) : ru(Math.round(x * 1000) / 1000) }

// Ответ с π: «6√17π».
// π ставится сразу после числового множителя: «50π√2», а не «50√2π».
function piStr(x) {
  const e = exactOf(x / Math.PI)
  if (!e) return null
  const sign = e.a < 0 ? MINUS : ""
  const a = Math.abs(e.a)
  const head = a === 1 ? "π" : `${a}π`
  const body = e.r === 1 ? head : `${head}√${e.r}`
  return sign + (e.b === 1 ? body : `${body}/${e.b}`)
}

// ══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ B. «Докажите, что плоскость проходит через конкретную точку»
// ══════════════════════════════════════════════════════════════════════════

// Общая конструкция: E на AA₁, F на BB₁, T на B₁C₁; плоскость EFT проходит через D₁.
// Условие прохождения через D₁ (вывод в solution): (1 − e)(1 − t) = f − e,
// где e = AE/AA₁, f = BF/BB₁, t = B₁T/B₁C₁.
function boxEFT(p, q, r, e, f, t) {
  const P = box(p, q, r)
  const [A, B, C, D, A1, B1, C1, D1] = P.V
  const Ee = v3(0, 0, r * e), F = v3(p, 0, r * f), T = lerp(B1, C1, t)
  const pl = plane3(Ee, F, T)
  need(distPointPlane(pl, D1) < 1e-7 * Math.max(1, p, q, r), "плоскость EFT не проходит через D₁")
  return { P, pl, A, B, C, D, A1, B1, C1, D1 }
}
// «6 : 1» из дроби долей.
const ratioStr = (x, y) => { const g = gcd(x, y) || 1; return `${x / g} : ${y / g}` }

// B1. T — середина B₁C₁ (t = ½ ⇒ f − e = (1 − e)/2). Ответ — площадь сечения.
export function t14BoxEFTArea() {
  return attempt(() => {
    const u = randInt(1, 6), w = randInt(u + 1, u + 12)
    const f = w / (u + w), e = 2 * f - 1
    if (e <= 0 || e >= 1) return null
    const eNum = w - u, eDen = u + w                 // AE : AA₁
    const k = randInt(2, 7), q = randInt(6, 30), r = (u + w) * randInt(1, 3)
    const p = k * Math.SQRT2
    const num = (() => {
      const { P, pl } = boxEFT(p, q, r, e, f, 0.5)
      const poly = section(P, pl)
      need(poly.length >= 3, "пустое сечение")
      return polyArea(poly)
    })()
    const ex = exactOf(num)
    if (!ex || ex.b > 4 || Math.abs(ex.a) > 5000) return null
    const model = () => { const { P, pl } = boxEFT(p, q, r, e, f, 0.5); return polyArea(section(P, pl)) }
    return item({
      preamble: `На ребре AA₁ прямоугольного параллелепипеда ${BOX} взята точка E так, что A₁E : EA = ${ratioStr(eDen - eNum, eNum)}, на ребре BB₁ — точка F так, что B₁F : FB = ${ratioStr(u, w)}, а точка T — середина ребра B₁C₁. Известно, что AB = ${L(S(k, 1, 2))}, AD = ${q}, AA₁ = ${r}.`,
      qa: "плоскость EFT проходит через вершину D₁.",
      qb: "Найдите площадь сечения параллелепипеда плоскостью EFT.",
      ans: Sstr(ex), num, model,
      solution: `Введём координаты A(0; 0; 0), B(AB; 0; 0), D(0; AD; 0), AA₁ вверх. Тогда E, F и T компланарны с D₁ ровно при (1 − e)(1 − t) = f − e, где e = AE/AA₁, f = BF/BB₁, t = B₁T/B₁C₁; здесь t = ½, и равенство выполняется. Сечение — четырёхугольник EFTD₁… его площадь равна ${Sstr(ex)}.`,
    })
  })
}

// B2. T делит B₁C₁ в отношении t : (1−t). Ответ — угол между EFT и BB₁C₁.
export function t14BoxEFTAngle() {
  return attempt(() => {
    const en = randInt(1, 4), ed = en + randInt(1, 5)        // e = en/ed
    const tn = randInt(1, 4), td = tn + randInt(1, 4)        // t = tn/td
    const e = en / ed, t = tn / td
    const f = e + (1 - e) * (1 - t)
    if (f <= e || f >= 1) return null
    const p = randInt(2, 9), q = randInt(2, 9), r = ed * randInt(1, 3)
    const num = (() => {
      const { pl, B, B1, C1 } = boxEFT(p, q, r, e, f, t)
      return angPlanes(pl, plane3(B, B1, C1))
    })()
    const ang = angleExact(num)
    if (!ang) return null
    const model = () => { const { pl, B, B1, C1 } = boxEFT(p, q, r, e, f, t); return angPlanes(pl, plane3(B, B1, C1)) }
    const fr = ratOf(f, 400)
    if (!fr) return null
    return item({
      preamble: `На ребре AA₁ прямоугольного параллелепипеда ${BOX} взята точка E так, что A₁E : EA = ${ratioStr(ed - en, en)}, на ребре BB₁ — точка F так, что B₁F : FB = ${ratioStr(fr.b - fr.a, fr.a)}, а на ребре B₁C₁ — точка T так, что B₁T : TC₁ = ${ratioStr(tn, td - tn)}. Известно, что AB = ${p}, AD = ${q}, AA₁ = ${r}.`,
      qa: "плоскость EFT проходит через вершину D₁.",
      qb: "Найдите угол между плоскостью EFT и плоскостью BB₁C₁.",
      ans: ang.str, num, model,
      solution: `В координатах A(0; 0; 0), B(${p}; 0; 0), D(0; ${q}; 0), AA₁ = ${r} точки E, F, T и D₁ компланарны: выполнено (1 − e)(1 − t) = f − e. Плоскость BB₁C₁ задаётся уравнением x = ${p}; отсюда искомый угол равен ${ang.str}.`,
    })
  })
}

// ══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ C. «Правильный тетраэдр / правильная пирамида»
// ══════════════════════════════════════════════════════════════════════════

// C1. Куб с диагональю d; P на луче A₁C с A₁P = 4d/3 — отражение A₁ в плоскости BDC₁.
export function t14CubeRegularTetraAP() {
  const n = randInt(1, 6)
  const withRoot = Math.random() < 0.5                    // d = 3n√11 (ответ целый) либо d = 3n
  const dS = withRoot ? S(3 * n, 1, 11) : S(3 * n)
  const qS = withRoot ? S(4 * n, 1, 11) : S(4 * n)
  const d = Sval(dS)
  const model = () => {
    const a = d / Math.sqrt(3)
    const P = box(a, a, a)
    const [A, B, C, D, A1, B1, C1, D1] = P.V
    const dir = scal(subv(C, A1), 1 / len(subv(C, A1)))
    const Pp = add(A1, scal(dir, Sval(qS)))
    const sd = [dist(Pp, B), dist(Pp, D), dist(Pp, C1), dist(B, D), dist(B, C1), dist(D, C1)]
    need(sd.every((x) => eq(x, sd[0])), "PBDC₁ не правильный тетраэдр")
    return dist(A, Pp)
  }
  const num = model()
  const ex = exactOf(num)
  if (!ex) throw new Error("не подобрались параметры")
  return item({
    preamble: `Длина диагонали куба ${BOX} равна ${L(dS)}. На луче A₁C отмечена точка P так, что A₁P = ${L(qS)}.`,
    qa: "PBDC₁ — правильный тетраэдр.",
    qb: "Найдите длину отрезка AP.",
    ans: Sstr(ex), num, model,
    solution: `Треугольник BDC₁ равносторонний со стороной a√2, где a — ребро куба, а прямая A₁C перпендикулярна его плоскости и проходит через её центр. Точка A₁ удалена от плоскости BDC₁ на 2a/√3, поэтому точка P, симметричная A₁ относительно этой плоскости, лежит на луче A₁C и A₁P = 4a/√3 = ${L(qS)}. Тогда PBDC₁ — правильный тетраэдр, а AP = ${Sstr(ex)}.`,
  })
}

// C2. Куб с ребром a; K, L, M — центры трёх граней; B₁KLM — правильная пирамида.
export function t14CubeCentersPyramidVolume() {
  return attempt(() => {
    const a = randInt(2, 14)
    const model = () => {
      const P = box(a, a, a)
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      const K = scal(add(add(A, B), add(C, D)), 0.25)
      const Lp = scal(add(add(A, A1), add(D1, D)), 0.25)
      const Mp = scal(add(add(C, C1), add(D1, D)), 0.25)
      const base = [dist(K, Lp), dist(Lp, Mp), dist(Mp, K)]
      const side = [dist(B1, K), dist(B1, Lp), dist(B1, Mp)]
      need(base.every((x) => eq(x, base[0])), "основание KLM не равносторонний треугольник")
      need(side.every((x) => eq(x, side[0])), "боковые рёбра B₁KLM не равны")
      return tetraVolume(B1, K, Lp, Mp)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 3) return null
    return item({
      preamble: `Ребро куба ${BOX} равно ${a}. Точки K, L и M — центры граней ABCD, AA₁D₁D и CC₁D₁D соответственно.`,
      qa: "B₁KLM — правильная пирамида.",
      qb: "Найдите объём B₁KLM.",
      ans: Sstr(ex), num, model,
      solution: `Стороны треугольника KLM — средние линии соответствующих диагональных сечений, все они равны ${SX(a * Math.SQRT2 / 2)}, а расстояния от B₁ до K, L и M равны между собой, поэтому пирамида правильная. Её объём равен a³/12 = ${Sstr(ex)}.`,
    })
  })
}

// ══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ D. «Отношение отрезков» (пункт а — отношение, пункт б — величина)
// ══════════════════════════════════════════════════════════════════════════

// D1. Правильная четырёхугольная пирамида: окружность, описанная около основания,
// и конус на ней с вершиной пирамиды.
export function t14PyrCircumConeLateral() {
  return attempt(() => {
    const a = randInt(2, 14) * 2
    const hS = Math.random() < 0.5 ? S(randInt(2, 14)) : S(randInt(1, 8), 1, 2)
    const h = Sval(hS)
    const model = () => {
      const R = a * Math.SQRT2 / 2
      need(eq(2 * Math.PI * R / a, Math.PI * Math.SQRT2), "отношение длины окружности к стороне не π√2")
      return Math.PI * R * Math.sqrt(R * R + h * h)
    }
    const num = model()
    const str = piStr(num)
    if (!str || str.length > 12) return null
    return item({
      preamble: `Высота правильной четырёхугольной пирамиды равна ${L(hS)}, а сторона основания равна ${a}. Около основания пирамиды описана окружность.`,
      qa: "отношение длины этой окружности к стороне основания равно π√2.",
      qb: "Найдите площадь боковой поверхности конуса, основанием которого служит эта окружность, а вершина совпадает с вершиной пирамиды.",
      ans: str, num, model,
      solution: `Радиус описанной окружности равен половине диагонали квадрата: R = a√2/2 = ${SX(a * Math.SQRT2 / 2)}, поэтому 2πR : a = π√2. Образующая конуса l = √(R² + h²) = ${SX(Math.sqrt(a * a / 2 + h * h))}, а S = πRl = ${str}.`,
    })
  })
}

// D2. Треугольная призма: α через BC₁ ∥ AB₁ проходит через середину AC.
export function t14PrismPlaneMidAC() {
  return attempt(() => {
    const k = randInt(1, 6), h = randInt(1, 9)
    const a = k * Math.sqrt(3)
    const model = () => {
      const P = prism([v3(0, 0, 0), v3(a, 0, 0), v3(a / 2, a * Math.sqrt(3) / 2, 0)], v3(0, 0, h))
      const [A, B, C, A1, B1, C1] = P.V
      const pl = planePPV(B, C1, subv(B1, A))
      const rr = segPlane(pl, A, C)
      need(rr && eq(rr.t, 0.5), "плоскость не проходит через середину AC")
      return polyArea(section(P, pl))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `Дана треугольная призма ${PRISM3}. Плоскость α проходит через прямую BC₁ параллельно прямой AB₁.`,
      qa: "плоскость α проходит через середину ребра AC.",
      qb: `Найдите площадь сечения призмы плоскостью α, если призма правильная, сторона её основания равна ${L(S(k, 1, 3))}, а боковое ребро равно ${h}.`,
      ans: Sstr(ex), num, model,
      solution: `Пусть M — середина AC. В плоскости BB₁C₁C прямая BC₁ и средняя линия дают AB₁ ∥ MB..., поэтому α = (BC₁M) и сечение — треугольник BC₁M. Его площадь равна ${Sstr(ex)}.`,
    })
  })
}

// D3. Прямоугольный параллелепипед: высоты треугольников ABD и A₁BD к BD имеют общее
// основание, а угол между ABC и A₁DB равен arctg(CC₁·√(AB²+AD²)/(AB·AD)).
export function t14BoxDihedralA1DB() {
  return attempt(() => {
    const m = randInt(2, 7), n = randInt(1, m - 1)
    const ab = m * m - n * n, ad = 2 * m * n, cc = randInt(3, 40)
    if (ab > 90 || ad > 90) return null
    const model = () => {
      const P = box(ab, ad, cc)
      const [A, B, C, D, A1] = P.V
      const foot = add(D, scal(subv(B, D), dot(subv(A, D), subv(B, D)) / dot(subv(B, D), subv(B, D))))
      need(eq(dot(subv(A, foot), subv(B, D)), 0, 1e-6), "высота ABD не перпендикулярна BD")
      need(eq(dot(subv(A1, foot), subv(B, D)), 0, 1e-6), "высота A₁BD не перпендикулярна BD")
      return angPlanes(plane3(A, B, C), plane3(A1, D, B))
    }
    const num = model()
    const ang = angleExact(num)
    if (!ang || !/arctg/.test(ang.str)) return null
    return item({
      preamble: `В прямоугольном параллелепипеде ${BOX} известны рёбра AB = ${ab}, AD = ${ad}, CC₁ = ${cc}.`,
      qa: "высоты треугольников ABD и A₁BD, проведённые к стороне BD, имеют общее основание.",
      qb: "Найдите угол между плоскостями ABC и A₁DB.",
      ans: ang.str, num, model,
      solution: `Так как AA₁ ⊥ (ABC), по теореме о трёх перпендикулярах A₁H ⊥ BD ровно тогда, когда AH ⊥ BD, — основание H общее. Тогда искомый угол равен ∠A₁HA, а tg ∠A₁HA = AA₁ : AH = ${cc} · √(${ab}² + ${ad}²) / (${ab} · ${ad}), то есть угол равен ${ang.str}.`,
    })
  })
}

// D4. Прямоугольный параллелепипед: K и L — центры граней BB₁C₁C и A₁B₁C₁D₁,
// M — середина CD; при AB = 2AA₁ котангенс угла между MD₁ и KL равен 3 (не зависит от AD).
export function t14BoxCentersCotangent() {
  const ad = randInt(2, 12), aa = randInt(2, 9), ab = 2 * aa
  const model = () => {
    const P = box(ab, ad, aa)
    const [A, B, C, D, A1, B1, C1, D1] = P.V
    const K = scal(add(add(B, B1), add(C1, C)), 0.25)
    const Lp = scal(add(add(A1, B1), add(C1, D1)), 0.25)
    const X = linePlane(plane3(A, B, C), K, subv(Lp, K))
    need(X && eq(dist(X.pt, B), dist(X.pt, C)), "точка пересечения KL с основанием не равноудалена от B и C")
    const ang = angLines(subv(D1, mid(C, D)), subv(Lp, K))
    return 1 / Math.tan(ang * Math.PI / 180)
  }
  const num = model()
  const ex = exactOf(num)
  return item({
    preamble: `Дан прямоугольный параллелепипед ${BOX}. Точки K и L — центры граней BB₁C₁C и A₁B₁C₁D₁ соответственно.`,
    qa: "точка пересечения прямой KL с плоскостью основания ABCD равноудалена от вершин B и C.",
    qb: "Пусть M — середина ребра CD. Найдите котангенс угла между прямыми MD₁ и KL, если известно, что AB = 2AA₁.",
    ans: Sstr(ex), num, model,
    solution: `Введём координаты A(0; 0; 0), B(2t; 0; 0), D(0; d; 0), AA₁ = t. Тогда KL и MD₁ имеют направляющие векторы, дающие cos φ = 3/√10 и sin φ = 1/√10 при любом d, поэтому ctg φ = 3.`,
  })
}

// D5. Прямоугольный параллелепипед: E на AA₁ (A₁E = k·EA), T — середина B₁C₁;
// плоскость ETD₁ делит BB₁ в отношении (k+2) : k.
export function t14BoxETD1Area() {
  return attempt(() => {
    const k = pick([2, 4, 6, 8])
    const j = randInt(2, 6), q = randInt(6, 30), r = (k + 1) * randInt(1, 3)
    const p = j * Math.SQRT2
    const geom = () => {
      const P = box(p, q, r)
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      const Ee = v3(0, 0, r / (k + 1))
      const pl = plane3(Ee, mid(B1, C1), D1)
      const rr = segPlane(pl, B, B1)
      need(rr && eq(rr.t, (k + 2) / (2 * (k + 1))), `плоскость делит BB₁ не в отношении ${k + 2}:${k}`)
      return polyArea(section(P, pl))
    }
    const num = geom()
    const ex = exactOf(num)
    if (!ex || ex.b > 4 || Math.abs(ex.a) > 5000) return null
    return item({
      preamble: `На ребре AA₁ прямоугольного параллелепипеда ${BOX} взята точка E так, что A₁E = ${k}EA. Точка T — середина ребра B₁C₁. Известно, что AB = ${L(S(j, 1, 2))}, AD = ${q}, AA₁ = ${r}.`,
      qa: `плоскость ETD₁ делит ребро BB₁ в отношении ${(k + 2) / 2}:${k / 2}.`,
      qb: "Найдите площадь сечения параллелепипеда плоскостью ETD₁.",
      ans: Sstr(ex), num, model: geom,
      solution: `В координатах A(0; 0; 0), B(AB; 0; 0), D(0; AD; 0) точка E делит AA₁ так, что AE = AA₁/${k + 1}. Сечение — четырёхугольник, пересекающий BB₁ в точке, делящей ребро в отношении ${(k + 2) / 2}:${k / 2}; площадь сечения равна ${Sstr(ex)}.`,
    })
  })
}

// D6. Правильная треугольная призма со всеми рёбрами a: α через AB и середину B₁C₁;
// C₁ — середина CM. Ответ буквенный.
export function t14PrismTriLetterArea() {
  const model = () => {
    const a = 1
    const P = prism([v3(0, 0, 0), v3(a, 0, 0), v3(a / 2, a * Math.sqrt(3) / 2, 0)], v3(0, 0, a))
    const [A, B, C, A1, B1, C1] = P.V
    const pl = plane3(A, B, mid(B1, C1))
    const M = linePlane(pl, C, v3(0, 0, 1))
    need(M && eq(M.pt.z, 2 * a), "C₁ не середина CM")
    return polyArea(section(P, pl))
  }
  const num = model()
  return item({
    preamble: `Плоскость α проходит через сторону AB основания ABC правильной треугольной призмы ${PRISM3} и середину ребра B₁C₁.`,
    qa: "если M — точка пересечения плоскости α с прямой CC₁, то C₁ — середина отрезка CM.",
    qb: "Найдите площадь сечения призмы плоскостью α, если все рёбра призмы равны a.",
    ans: `3a²√19/16`, num, model,
    solution: `Сечение — трапеция ABPQ, где P и Q — середины B₁C₁ и A₁C₁: её основания равны a и a/2, а высота равна √(3a²/16 + a²) = a√19/4. Площадь равна (a + a/2)/2 · a√19/4 = 3a²√19/16. Прямая CM пересекает α в точке на высоте 2a, поэтому C₁ — середина CM.`,
  })
}

// D7. Правильная четырёхугольная призма KLMN: E на KK₁ (KE:EK₁ = 1:3),
// α через L и E ∥ KM делит NN₁ пополам.
export function t14Prism4PlaneNNangle() {
  return attempt(() => {
    const a = randInt(2, 14), h = randInt(2, 16)
    const model = () => {
      const P = prism([v3(0, 0, 0), v3(a, 0, 0), v3(a, a, 0), v3(0, a, 0)], v3(0, 0, h))
      const [K, Lp, Mp, N, K1, L1, M1, N1] = P.V
      const Ee = v3(0, 0, h / 4)
      const pl = planePPV(Lp, Ee, subv(Mp, K))
      const rr = segPlane(pl, N, N1)
      need(rr && eq(rr.t, 0.5), "плоскость не делит NN₁ пополам")
      return angPlanes(pl, plane3(K, Lp, Mp))
    }
    const num = model()
    const ang = angleExact(num)
    if (!ang) return null
    return item({
      preamble: `В правильной четырёхугольной призме KLMNK₁L₁M₁N₁ точка E делит боковое ребро KK₁ в отношении KE : EK₁ = 1 : 3. Через точки L и E проведена плоскость α, параллельная прямой KM и пересекающая ребро NN₁ в точке F.`,
      qa: "плоскость α делит ребро NN₁ пополам.",
      qb: `Найдите угол между плоскостью α и плоскостью грани KLMN, если известно, что KL = ${a}, KK₁ = ${h}.`,
      ans: ang.str, num, model,
      solution: `В координатах K(0; 0; 0), L(${a}; 0; 0), N(0; ${a}; 0) нормаль плоскости α пропорциональна (−h/4; h/4; −KL), поэтому tg искомого угла равен KK₁·√2/(4·KL), то есть угол равен ${ang.str}.`,
    })
  })
}

// D8. Правильная треугольная пирамида: α ⊃ MN ⊥ основанию делит медиану CE в 5:1;
// расстояние от A до α равно AB·√3/12 (от бокового ребра не зависит).
export function t14Pyr3PlaneDistA() {
  return attempt(() => {
    const a = randInt(2, 20) * 6, b = randInt(Math.ceil(a / Math.sqrt(3)) + 1, a * 2)
    const model = () => {
      const A = v3(0, 0, 0), B = v3(a, 0, 0), C = v3(a / 2, a * Math.sqrt(3) / 2, 0)
      const O = scal(add(add(A, B), C), 1 / 3)
      const H = Math.sqrt(b * b - dot(subv(A, O), subv(A, O)))
      const Sp = add(O, v3(0, 0, H))
      const pl = planePVV(mid(Sp, A), subv(mid(Sp, B), mid(Sp, A)), v3(0, 0, 1))
      const rr = segPlane(pl, C, mid(A, B))
      need(rr && eq(rr.t, 5 / 6), "плоскость делит медиану CE не в отношении 5:1")
      return distPointPlane(pl, A)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `В правильной треугольной пирамиде SABC сторона основания AB равна ${a}, а боковое ребро SA равно ${b}. Точки M и N — середины рёбер SA и SB соответственно. Плоскость α содержит прямую MN и перпендикулярна плоскости основания пирамиды.`,
      qa: "плоскость α делит медиану CE основания в отношении 5 : 1, считая от точки C.",
      qb: "Найдите расстояние от вершины A до плоскости α.",
      ans: Sstr(ex), num, model,
      solution: `MN — средняя линия треугольника SAB, поэтому MN ∥ AB, а проекция MN на основание — прямая, параллельная AB и проходящая через точку, делящую CE в отношении 5 : 1. Так как α ⊥ (ABC), расстояние от A до α равно расстоянию в основании от A до этой прямой, то есть CE/6 = AB·√3/12 = ${Sstr(ex)}.`,
    })
  })
}

// D9. Куб: K на BB₁ с KB = k, α через K и C₁ ∥ BD₁; A₁P : PB₁ = (2k−c) : (c−k).
export function t14CubePlaneBiggerPart() {
  return attempt(() => {
    const c = randInt(3, 14), k = randInt(Math.floor(c / 2) + 1, c - 1)
    const g = gcd(2 * k - c, c - k)
    if ((2 * k - c) / g > 6 || (c - k) / g > 6) return null
    const model = () => {
      const P = box(c, c, c)
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      const pl = planePPV(v3(c, 0, k), C1, subv(D1, B))
      const rr = segPlane(pl, A1, B1)
      need(rr && eq(rr.t, (2 * k - c) / k), "A₁P : PB₁ не то, что заявлено")
      const v1 = clipVolume(P, pl, -1), v2 = clipVolume(P, pl, 1)
      need(eq(v1 + v2, c * c * c), "части не дают объём куба")
      return Math.max(v1, v2)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 12) return null
    return item({
      preamble: `В кубе ${BOX} все рёбра равны ${c}. На его ребре BB₁ отмечена точка K так, что KB = ${k}. Через точки K и C₁ проведена плоскость α, параллельная прямой BD₁.`,
      qa: `A₁P : PB₁ = ${(2 * k - c) / g} : ${(c - k) / g}, где P — точка пересечения плоскости α с ребром A₁B₁.`,
      qb: "Найдите объём большей из двух частей куба, на которые он делится плоскостью α.",
      ans: Sstr(ex), num, model,
      solution: `Нормаль плоскости α равна (${k}; ${k - c}; ${c}), и она пересекает A₁B₁ в точке с абсциссой ${c}·(2·${k} − ${c})/${k}. Объём куба ${c * c * c} делится на части, большая из которых равна ${Sstr(ex)}.`,
    })
  })
}

// D10. Прямая призма, основание — прямоугольник; расстояние между AC и B₁D₁ равно
// высоте. Плоскость через D ⊥ BD₁ делит BD₁ в отношении 1:7 при AB² + AD² = 7h².
export function t14PrismPerpPlaneCos() {
  return attempt(() => {
    const h = randInt(2, 12), ab = randInt(2, Math.floor(Math.sqrt(7) * h))
    const ad2 = 7 * h * h - ab * ab
    if (ad2 <= 0) return null
    const adS = S(1, 1, ad2)
    const ad = Sval(adS)
    const model = () => {
      const P = prism([v3(0, 0, 0), v3(ab, 0, 0), v3(ab, ad, 0), v3(0, ad, 0)], v3(0, 0, h))
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      need(eq(distLines(A, subv(C, A), B1, subv(D1, B1)), h), "расстояние между AC и B₁D₁ не равно высоте")
      const pl = planePN(D, subv(D1, B))
      const rr = segPlane(pl, B, D1)
      need(rr && eq(rr.t, 7 / 8), "плоскость делит BD₁ не в отношении 1:7")
      return Math.cos(angPlanes(pl, plane3(A, B, C)) * Math.PI / 180)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex) return null
    return item({
      preamble: `Основание прямой четырёхугольной призмы ${PRISM4} — прямоугольник ABCD, в котором AB = ${ab}, AD = ${L(adS)}. Расстояние между прямыми AC и B₁D₁ равно ${h}.`,
      qa: "плоскость, проходящая через точку D перпендикулярно прямой BD₁, делит BD₁ в отношении 1 : 7, считая от вершины D₁.",
      qb: "Найдите косинус угла между плоскостью, проходящей через точку D перпендикулярно прямой BD₁, и плоскостью основания призмы.",
      ans: Sstr(ex), num, model,
      solution: `Прямые AC и B₁D₁ лежат в параллельных плоскостях оснований, поэтому расстояние между ними равно высоте призмы: AA₁ = ${h}. Нормаль секущей плоскости — вектор BD₁, косинус её угла с основанием равен AA₁/BD₁ = ${h}/√(${ab}² + ${ad2} + ${h * h}) = ${Sstr(ex)}.`,
    })
  })
}

// D11. Тот же куб, что в D9, но спрашивается угол наклона α к грани BB₁C₁C.
export function t14CubePlaneTiltAngle() {
  return attempt(() => {
    const c = randInt(3, 14), k = randInt(Math.floor(c / 2) + 1, c - 1)
    const g = gcd(2 * k - c, c - k)
    if ((2 * k - c) / g > 6 || (c - k) / g > 6) return null
    const model = () => {
      const P = box(c, c, c)
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      const pl = planePPV(v3(c, 0, k), C1, subv(D1, B))
      const rr = segPlane(pl, A1, B1)
      need(rr && eq(rr.t, (2 * k - c) / k), "A₁P : PB₁ не то, что заявлено")
      return angPlanes(pl, plane3(B, B1, C1))
    }
    const num = model()
    const ang = angleExact(num)
    if (!ang) return null
    return item({
      preamble: `В кубе ${BOX} все рёбра равны ${c}. На его ребре BB₁ отмечена точка K так, что KB = ${k}. Через точки K и C₁ проведена плоскость α, параллельная прямой BD₁.`,
      qa: `A₁P : PB₁ = ${(2 * k - c) / g} : ${(c - k) / g}, где P — точка пересечения плоскости α с ребром A₁B₁.`,
      qb: "Найдите угол наклона плоскости α к плоскости грани BB₁C₁C.",
      ans: ang.str, num, model,
      solution: `Нормаль α равна (${k}; ${k - c}; ${c}), нормаль грани BB₁C₁C — (1; 0; 0). Отсюда tg искомого угла равен √((${k} − ${c})² + ${c}²)/${k}, то есть угол равен ${ang.str}.`,
    })
  })
}

// D12. Правильная четырёхугольная призма: K на AA₁ (AK : KA₁ = 1 : q),
// α через K и B ∥ AC делит DD₁ в отношении 2 : (q−1).
export function t14Prism4PlaneDDArea() {
  return attempt(() => {
    const q = pick([2, 3, 4, 5]), a = randInt(2, 12), h = randInt(2, 12)
    const model = () => {
      const P = prism([v3(0, 0, 0), v3(a, 0, 0), v3(a, a, 0), v3(0, a, 0)], v3(0, 0, h))
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      const K = v3(0, 0, h / (1 + q))
      const pl = planePPV(K, B, subv(C, A))
      const rr = segPlane(pl, D, D1)
      need(rr && eq(rr.t, 2 / (1 + q)), "DM : MD₁ не то, что заявлено")
      return polyArea(section(P, pl))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    const g = gcd(2, q - 1)
    const claim = q === 3
      ? "точка M — середина ребра DD₁."
      : `плоскость α делит ребро DD₁ в отношении DM : MD₁ = ${2 / g} : ${(q - 1) / g}.`
    return item({
      preamble: `В правильной четырёхугольной призме ${PRISM4} на ребре AA₁ отмечена точка K, причём AK : KA₁ = 1 : ${q}. Через точки K и B проведена плоскость α, параллельная прямой AC и пересекающая ребро DD₁ в точке M.`,
      qa: claim,
      qb: `Найдите площадь сечения призмы плоскостью α, если AB = ${a}, AA₁ = ${h}.`,
      ans: Sstr(ex), num, model,
      solution: `В координатах A(0; 0; 0), B(${a}; 0; 0), D(0; ${a}; 0) плоскость α пересекает DD₁ на высоте 2·AA₁/${1 + q}. Сечение — четырёхугольник, его площадь равна ${Sstr(ex)}.`,
    })
  })
}

// D13. Куб: P на DD₁ (DP = p), Q на BB₁ (B₁Q = q); плоскость A₁PQ пересекает CC₁
// в середине ровно при p − q = c/2.
export function t14CubeA1PQDistance() {
  return attempt(() => {
    const c = randInt(4, 16)
    if (c % 2) return null
    const q = randInt(1, c / 2 - 1), p = q + c / 2
    if (p >= c) return null
    const model = () => {
      const P = box(c, c, c)
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      const pl = plane3(A1, v3(0, c, p), v3(c, 0, c - q))
      const rr = segPlane(pl, C, C1)
      need(rr && eq(rr.t, 0.5), "плоскость пересекает CC₁ не в середине")
      return distPointPlane(pl, C1)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex) return null
    return item({
      preamble: `На рёбрах DD₁ и BB₁ куба ${BOX} с ребром ${c} отмечены точки P и Q соответственно, причём DP = ${p}, а B₁Q = ${q}. Плоскость A₁PQ пересекает ребро CC₁ в точке M.`,
      qa: "точка M является серединой ребра CC₁.",
      qb: "Найдите расстояние от точки C₁ до плоскости A₁PQ.",
      ans: Sstr(ex), num, model,
      solution: `В координатах A(0; 0; 0), B(${c}; 0; 0), D(0; ${c}; 0) нормаль плоскости A₁PQ равна (−${q}; ${p - c}; −${c}), а точка пересечения с CC₁ имеет аппликату DP − B₁Q = ${p - q} = ${c}/2. Расстояние от C₁ до плоскости равно ${Sstr(ex)}.`,
    })
  })
}

// D14. Параллелепипед: α через BA₁ ∥ CB₁ делит AC₁ в отношении 2 : 1 от C₁.
export function t14ParallelepipedBA1Area() {
  return attempt(() => {
    const p = randInt(3, 15) * 2, q = randInt(3, 15) * 2, h = randInt(2, 14)
    const model = () => {
      const P = prism([v3(-p / 2, 0, 0), v3(0, -q / 2, 0), v3(p / 2, 0, 0), v3(0, q / 2, 0)], v3(0, 0, h))
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      const pl = planePPV(B, A1, subv(B1, C))
      const rr = linePlane(pl, A, subv(C1, A))
      need(rr && eq(rr.t, 1 / 3), "плоскость делит AC₁ не в отношении 2 : 1 от C₁")
      return polyArea(section(P, pl))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `Дан параллелепипед ${BOX}. Плоскость α проходит через прямую BA₁ параллельно прямой CB₁.`,
      qa: "плоскость α делит диагональ AC₁ параллелепипеда в отношении 2 : 1, считая от вершины C₁.",
      qb: `Найдите площадь сечения параллелепипеда плоскостью α, если он прямой, его основание ABCD — ромб с диагоналями AC = ${p} и BD = ${q}, а боковое ребро параллелепипеда равно ${h}.`,
      ans: Sstr(ex), num, model,
      solution: `Плоскость α проходит через B, A₁ и D (так как BD ∥ … ), сечение — треугольник A₁BD. Его площадь равна ${Sstr(ex)}.`,
    })
  })
}

// D15. Правильная четырёхугольная пирамида с AB = SA: медианы SBC пересекаются в M,
// AM = AD; N — середина AM.
export function t14PyrCentroidSN() {
  return attempt(() => {
    const a = randInt(2, 18)
    const model = () => {
      const H = a / Math.SQRT2
      const A = v3(-a / 2, -a / 2, 0), B = v3(a / 2, -a / 2, 0), C = v3(a / 2, a / 2, 0), D = v3(-a / 2, a / 2, 0)
      const Sp = v3(0, 0, H)
      need(eq(dist(Sp, A), a), "боковое ребро не равно стороне основания")
      const M = scal(add(add(Sp, B), C), 1 / 3)
      need(eq(dist(A, M), dist(A, D)), "AM ≠ AD")
      return dist(Sp, mid(A, M))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 6) return null
    return item({
      preamble: `В правильной четырёхугольной пирамиде SABCD сторона основания AB равна боковому ребру SA. Медианы треугольника SBC пересекаются в точке M.`,
      qa: "AM = AD.",
      qb: `Точка N — середина AM. Найдите SN, если AD = ${a}.`,
      ans: Sstr(ex), num, model,
      solution: `Все рёбра пирамиды равны ${a}. Точка M — центр тяжести грани SBC; прямым вычислением в координатах получаем AM = ${a} = AD, а SN = ${Sstr(ex)}.`,
    })
  })
}

// D16. Куб: γ через BD грани ABCD делит площадь боковой поверхности 2 : 1;
// тогда она делит B₁C₁ в отношении 2 : 1 от B₁, а объём — в отношении 13 : 41.
export function t14CubeGammaVolumeRatio() {
  const c = 1
  const model = () => {
    const P = box(c, c, c)
    const [A, B, C, D, A1, B1, C1, D1] = P.V
    const X = lerp(B1, C1, 2 / 3)
    const pl = plane3(B, D, X)
    // доля боковой поверхности со стороны C
    let s = 0
    for (const f4 of [[1, 5, 4, 0], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) {
      const poly = f4.map((i) => P.V[i])
      const side = Math.sign(dot(pl.n, C) - pl.d)
      const kept = []
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length]
        const da = side * (dot(pl.n, a) - pl.d), db = side * (dot(pl.n, b) - pl.d)
        if (da >= -1e-9) kept.push(a)
        if (da * db < -1e-18) { const r = segPlane(pl, a, b); if (r) kept.push(r.pt) }
      }
      if (kept.length >= 3) s += polyArea(kept)
    }
    need(eq(s / (4 * c * c), 1 / 3), "боковая поверхность делится не в отношении 2 : 1")
    const v1 = clipVolume(P, pl, -1), v2 = clipVolume(P, pl, 1)
    need(eq(v1 + v2, c * c * c), "части не дают объём куба")
    return Math.min(v1, v2) / Math.max(v1, v2)
  }
  const num = model()
  const rt = ratioExact(num)
  return item({
    preamble: `Плоскость γ, содержащая диагональ BD грани куба ${BOX} с основаниями ABCD и A₁B₁C₁D₁, пересекает ребро B₁C₁ и делит площадь боковой поверхности куба в отношении 2 : 1.`,
    qa: "плоскость γ делит ребро B₁C₁ в отношении 2 : 1, считая от вершины B₁.",
    qb: "В каком отношении плоскость γ делит объём куба?",
    ans: rt.str, num, model,
    solution: `Пусть ребро куба равно 1 и γ пересекает B₁C₁ в точке X с B₁X = t. Площадь части боковой поверхности, содержащей C, равна (2 − t)/4 от полной... при t = 2/3 она составляет треть, что и требуется. Объём куба при этом делится в отношении ${rt.str}: меньшая часть — та, что содержит вершину A, большая — та, что содержит вершину C.`,
  })
}

// Сечение правильной треугольной пирамиды плоскостью α ⊃ MN ⊥ основанию (D17, D21).
function pyr3AlphaSection(a, b) {
  const A = v3(0, 0, 0), B = v3(a, 0, 0), C = v3(a / 2, a * Math.sqrt(3) / 2, 0)
  const O = scal(add(add(A, B), C), 1 / 3)
  const H = Math.sqrt(b * b - dot(subv(A, O), subv(A, O)))
  const Sp = add(O, v3(0, 0, H))
  const P = pyramid([A, B, C], Sp)
  const M = mid(Sp, A), N = mid(Sp, B)
  const pl = planePVV(M, subv(N, M), v3(0, 0, 1))
  const rr = segPlane(pl, C, mid(A, B))
  need(rr && eq(rr.t, 5 / 6), "плоскость делит медиану CE не в отношении 5:1")
  return { poly: section(P, pl), C, P }
}

// D17. Объём пирамиды с вершиной C и основанием — сечением.
export function t14Pyr3SectionVolumeC() {
  return attempt(() => {
    const a = randInt(2, 12) * 3, b = randInt(Math.ceil(a / Math.sqrt(3)) + 1, a * 2)
    const model = () => { const { poly, C } = pyr3AlphaSection(a, b); return pyramidVolume(poly, C) }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 6 || Math.abs(ex.a) > 20000) return null
    return item({
      preamble: `В правильной треугольной пирамиде SABC сторона основания AB равна ${a}, а боковое ребро SA равно ${b}. Точки M и N — середины рёбер SA и SB соответственно. Плоскость α содержит прямую MN и перпендикулярна плоскости основания пирамиды.`,
      qa: "плоскость α делит медиану CE основания в отношении 5 : 1, считая от точки C.",
      qb: "Найдите объём пирамиды, вершиной которой является точка C, а основанием — сечение пирамиды SABC плоскостью α.",
      ans: Sstr(ex), num, model,
      solution: `Сечение — четырёхугольник с вершинами M, N и двумя точками на рёбрах основания; расстояние от C до плоскости α равно AB·√3·5/12·… Объём равен ${Sstr(ex)}.`,
    })
  })
}

// D21. Периметр того же сечения (ответ вида «8 + 2√2»).
export function t14Pyr3SectionPerimeter() {
  return attempt(() => {
    const a = randInt(2, 12) * 3, b = randInt(Math.ceil(a / Math.sqrt(3)) + 1, a * 2)
    const sides = (() => {
      const { poly } = pyr3AlphaSection(a, b)
      return poly.map((p, i) => dist(p, poly[(i + 1) % poly.length]))
    })()
    const sum = exactSumOf(sides)
    if (!sum || sum.terms > 2) return null
    if (sides.some((x) => !exactOf(x) || exactOf(x).b > 4)) return null
    const model = () => {
      const { poly } = pyr3AlphaSection(a, b)
      return polyPerimeter(poly)
    }
    const num = model()
    if (Math.abs(num - sum.num) > 1e-9) return null
    return item({
      preamble: `В правильной треугольной пирамиде SABC сторона основания AB равна ${a}, а боковое ребро SA равно ${b}. Точки M и N — середины рёбер SA и SB соответственно. Плоскость α содержит прямую MN и перпендикулярна плоскости основания пирамиды.`,
      qa: "плоскость α делит медиану CE основания в отношении 5 : 1, считая от точки C.",
      qb: "Найдите периметр многоугольника, являющегося сечением пирамиды SABC плоскостью α.",
      ans: sum.str, num, model,
      solution: `Сечение — трапеция: MN = AB/2 = ${a / 2}, нижнее основание лежит в плоскости ABC, боковые стороны равны между собой. Сумма сторон равна ${sum.str}.`,
    })
  })
}

// D18. Правильная шестиугольная пирамида, боковое ребро вдвое больше стороны основания:
// плоскость через середины SA, SD и вершину C делит SF в отношении 1 : 2 от S.
export function t14Pyr6RatioSF() {
  const model = () => {
    const a = 1
    const base = regular(6, a, 0)
    const [A, B, C, D, Ee, F] = base
    const Sp = v3(0, 0, Math.sqrt(4 * a * a - a * a))
    const pl = plane3(mid(Sp, A), mid(Sp, D), C)
    const apo = segPlane(pl, Sp, mid(A, B))
    need(apo && eq(apo.t, 2 / 3), "апофема грани ASB делится не в отношении 1 : 2")
    const rr = segPlane(pl, Sp, F)
    need(rr, "плоскость не пересекает ребро SF")
    return rr.t / (1 - rr.t)
  }
  const num = model()
  const rt = ratioExact(num)
  return item({
    preamble: `В правильной шестиугольной пирамиде SABCDEF с вершиной S боковое ребро вдвое больше стороны основания.`,
    qa: "плоскость, проходящая через середины рёбер SA и SD и вершину C, делит апофему грани ASB в отношении 1 : 2, считая от вершины S.",
    qb: "Найдите отношение, в котором плоскость, проходящая через середины рёбер SA и SD и вершину C, делит ребро SF, считая от вершины S.",
    ans: rt.str, num, model,
    solution: `Примем сторону основания за 1, тогда боковое ребро равно 2, а высота пирамиды равна √3. Плоскость сечения пересекает SF в точке, делящей ребро в отношении ${rt.str} от вершины S.`,
  })
}

// D19. Прямоугольный параллелепипед: P, Q — середины A₁B₁ и CC₁;
// плоскость APQ делит B₁C₁ в отношении 2 : 1 (при любых рёбрах).
export function t14BoxAPQArea() {
  return attempt(() => {
    const ab = randInt(2, 12), bc = randInt(2, 12), aa = randInt(2, 12)
    const model = () => {
      const P = box(ab, bc, aa)
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      const pl = plane3(A, mid(A1, B1), mid(C, C1))
      const rr = segPlane(pl, B1, C1)
      need(rr && eq(rr.t, 2 / 3), "B₁U : UC₁ ≠ 2 : 1")
      return polyArea(section(P, pl))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `В прямоугольном параллелепипеде ${BOX} известны длины рёбер: AB = ${ab}, BC = ${bc}, AA₁ = ${aa}. Точки P и Q — середины рёбер A₁B₁ и CC₁ соответственно. Плоскость APQ пересекает ребро B₁C₁ в точке U.`,
      qa: "B₁U : UC₁ = 2 : 1.",
      qb: `Найдите площадь сечения параллелепипеда ${BOX} плоскостью APQ.`,
      ans: Sstr(ex), num, model,
      solution: `В координатах A(0; 0; 0), B(${ab}; 0; 0), D(0; ${bc}; 0) нормаль плоскости APQ пропорциональна (−4·BC; 3·AA₁·…), и она пересекает B₁C₁ в точке с ординатой ⅔·BC при любых рёбрах. Площадь сечения равна ${Sstr(ex)}.`,
    })
  })
}

// D20. Куб: P на CD (DP = p), Q на BB₁ (B₁Q = q); плоскость APQ проходит через середину
// CC₁ ровно при 2(c − p)(c − q) = c².
export function t14CubeAPQDistanceC() {
  return attempt(() => {
    const c = randInt(4, 18) & ~1                      // c чётное: нужно c²/2 ∈ ℤ
    if (c < 4) return null
    const target = c * c / 2
    const ok = []
    for (let dp = 1; dp < c; dp++) {
      const d = c - dp
      if (target % d) continue
      const q = c - target / d
      if (q >= 1 && q <= c - 1) ok.push([dp, q])
    }
    if (!ok.length) return null
    const [dp, qi] = pick(ok)
    const model = () => {
      const P = box(c, c, c)
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      const pl = plane3(A, lerp(D, C, dp / c), v3(c, 0, c - qi))
      const rr = segPlane(pl, C, C1)
      need(rr && eq(rr.t, 0.5), "плоскость пересекает CC₁ не в середине")
      return distPointPlane(pl, C)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex) return null
    return item({
      preamble: `На рёбрах CD и BB₁ куба ${BOX} с ребром ${c} отмечены точки P и Q соответственно, причём DP = ${dp}, а B₁Q = ${qi}. Плоскость APQ пересекает ребро CC₁ в точке M.`,
      qa: "точка M является серединой ребра CC₁.",
      qb: "Найдите расстояние от точки C до плоскости APQ.",
      ans: Sstr(ex), num, model,
      solution: `В координатах A(0; 0; 0), B(${c}; 0; 0), D(0; ${c}; 0) точка пересечения плоскости APQ с CC₁ имеет аппликату (${c} − ${dp})(${c} − ${qi})/${c} = ${c / 2}. Расстояние от C до этой плоскости равно ${Sstr(ex)}.`,
    })
  })
}

// D22. Правильная призма: M — середина AC, T на AA₁ (AT = t); плоскость BB₁M делит C₁T
// пополам, а плоскость BTC₁ делит MB₁ на две части.
export function t14PrismBTC1Segment() {
  return attempt(() => {
    const a = randInt(2, 12), h = randInt(4, 16), t = randInt(1, h - 1)
    const model = () => {
      const base = [v3(0, 0, 0), v3(a, 0, 0), v3(a / 2, a * Math.sqrt(3) / 2, 0)]
      const P = prism(base, v3(0, 0, h))
      const [A, B, C, A1, B1, C1] = P.V
      const M = mid(A, C), T = v3(0, 0, t)
      const rr1 = segPlane(plane3(B, add(B, v3(0, 0, 1)), M), C1, T)
      need(rr1 && eq(rr1.t, 0.5), "плоскость BB₁M не делит C₁T пополам")
      const rr2 = segPlane(plane3(B, T, C1), M, B1)
      need(rr2 && rr2.t > 1e-9 && rr2.t < 1 - 1e-9, "плоскость BTC₁ не пересекает MB₁")
      return Math.min(rr2.t, 1 - rr2.t) * dist(M, B1)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 20) return null
    return item({
      preamble: `Дана правильная призма ${PRISM3}, у которой стороны основания AB = ${a}, а боковое ребро AA₁ = ${h}. Точка M — середина ребра AC, а на ребре AA₁ взята точка T так, что AT = ${t}.`,
      qa: "плоскость BB₁M делит отрезок C₁T пополам.",
      qb: "Плоскость BTC₁ делит отрезок MB₁ на две части. Найдите длину меньшей из них.",
      ans: Sstr(ex), num, model,
      solution: `Плоскость BB₁M проходит через середину AC и вертикальна, а середина C₁T проецируется как раз в середину AC, поэтому отрезок C₁T делится пополам. Плоскость BTC₁ пересекает MB₁ (длина MB₁ = ${SX(Math.sqrt(3 * a * a / 4 + h * h))}); меньшая из частей равна ${Sstr(ex)}.`,
    })
  })
}

// D23. Куб: M — середина C₁D₁, K на AA₁ (AK : KA₁ = 1 : 3); α через K и M ∥ BD
// делит A₁C в отношении 3 : 5.
export function t14CubeAlphaBDAngle() {
  const model = () => {
    const a = 1
    const P = prism([v3(0, 0, 0), v3(a, 0, 0), v3(a, a, 0), v3(0, a, 0)], v3(0, 0, a))
    const [A, B, C, D, A1, B1, C1, D1] = P.V
    const pl = planePPV(v3(0, 0, a / 4), mid(C1, D1), subv(D, B))
    const rr = linePlane(pl, A1, subv(C, A1))
    need(rr && eq(rr.t, 3 / 8), "A₁O : OC ≠ 3 : 5")
    return angPlanes(pl, plane3(A, B, C))
  }
  const num = model()
  const ang = angleExact(num)
  return item({
    preamble: `В параллелепипеде ${BOX} точка M — середина ребра C₁D₁, а точка K делит ребро AA₁ в отношении AK : KA₁ = 1 : 3. Через точки K и M проведена плоскость α, параллельная прямой BD и пересекающая диагональ A₁C в точке O.`,
    qa: "плоскость α делит диагональ A₁C в отношении A₁O : OC = 3 : 5.",
    qb: "Найдите угол между плоскостью α и плоскостью (ABC), если дополнительно известно, что ${BOX} — куб.".replace("${BOX}", BOX),
    ans: ang.str, num, model,
    solution: `Примем ребро куба за 1 и введём координаты A(0; 0; 0), B(1; 0; 0), D(0; 1; 0). Тогда нормаль плоскости α пропорциональна (1; 1; 2)/…, а угол с основанием равен ${ang.str}.`,
  })
}

// D23′ (дз-аналог D23). Правильная четырёхугольная призма: F — середина AB,
// E на DD₁ (DE : ED₁ = 6 : 1); α через F и E ∥ AC делит B₁D в отношении 2 : 3.
export function t14PrismAlphaACAngle() {
  return attempt(() => {
    const a = randInt(2, 14), h = randInt(1, 6) * 7
    const model = () => {
      const P = prism([v3(0, 0, 0), v3(a, 0, 0), v3(a, a, 0), v3(0, a, 0)], v3(0, 0, h))
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      const pl = planePPV(mid(A, B), v3(0, a, h * 6 / 7), subv(C, A))
      const rr = linePlane(pl, D, subv(B1, D))
      need(rr && eq(rr.t, 0.4), "DO : OB₁ ≠ 2 : 3")
      return angPlanes(pl, plane3(A, B, C))
    }
    const num = model()
    const ang = angleExact(num)
    if (!ang) return null
    return item({
      preamble: `В параллелепипеде ${BOX} точка F — середина ребра AB, а точка E делит ребро DD₁ в отношении DE : ED₁ = 6 : 1. Через точки F и E проведена плоскость α, параллельная прямой AC и пересекающая диагональ B₁D в точке O.`,
      qa: "плоскость α делит диагональ DB₁ в отношении DO : OB₁ = 2 : 3.",
      qb: `Найдите угол между плоскостью α и плоскостью (ABC), если дополнительно известно, что ${BOX} — правильная четырёхугольная призма, сторона основания которой равна ${a}, а высота равна ${h}.`,
      ans: ang.str, num, model,
      solution: `В координатах A(0; 0; 0), B(${a}; 0; 0), D(0; ${a}; 0) нормаль плоскости α пропорциональна (−6h/7; 6h/7; −3a/2), поэтому тангенс угла с основанием равен 4√2·${h}/(7·${a}), то есть угол равен ${ang.str}.`,
    })
  })
}

// D24. Призма, основание — равнобедренная трапеция: боковые стороны равны меньшему
// основанию, продолжения пересекаются под 60°; при AA₁ : AD = √3 : 2 угол равен 45°.
export function t14PrismTrapAngle() {
  const model = () => {
    const cd = 4
    const ab = 2 * cd
    const A = v3(0, 0, 0), B = v3(ab, 0, 0)
    const D = v3(cd * Math.cos(Math.PI / 3), cd * Math.sin(Math.PI / 3), 0)
    const C = v3(ab - cd * Math.cos(Math.PI / 3), cd * Math.sin(Math.PI / 3), 0)
    const h = dist(A, D) * Math.sqrt(3) / 2
    const P = prism([A, B, C, D], v3(0, 0, h))
    const [a, b, c, d, A1, B1, C1, D1] = P.V
    need(eq(dist(a, d), cd) && eq(dist(b, c), cd) && eq(dist(c, d), cd), "боковые стороны не равны меньшему основанию")
    const pl = plane3(c, A1, D1)
    const rr = segPlane(pl, a, b)
    need(rr, "плоскость CA₁D₁ не пересекает AB")
    need(len(cross(subv(rr.pt, D1), subv(mid(A1, c), D1))) < 1e-7, "D₁M не проходит через середину A₁C")
    return angLinePlane(v3(0, 0, 1), pl)
  }
  const num = model()
  const ang = angleExact(num)
  return item({
    preamble: `Основание ABCD призмы ${PRISM4} — равнобедренная трапеция с основаниями AB и CD. Боковые стороны равны меньшему основанию CD, а их продолжения пересекаются под углом 60°.`,
    qa: "если плоскость CA₁D₁ пересекает ребро AB в точке M, то прямая D₁M проходит через середину диагонали A₁C.",
    qb: "Найдите угол между боковым ребром BB₁ и плоскостью CA₁D₁, если призма прямая, а AA₁ : AD = √3 : 2.",
    ans: ang.str, num, model,
    solution: `Из условия следует AB = 2CD и AD = CD, то есть M — середина AB, а CD ∥ AM и CD = AM: значит AMCD — параллелограмм, и D₁M проходит через середину A₁C. При AA₁ : AD = √3 : 2 синус угла между BB₁ и плоскостью CA₁D₁ равен √2/2, то есть угол равен ${ang.str}.`,
  })
}

// ══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ E. «Угол между прямыми» (пункт а — угол/перпендикулярность)
// ══════════════════════════════════════════════════════════════════════════

// E1. Куб: AC ⊥ BD₁, расстояние между ними.
export function t14CubeDistACBD1() {
  return attempt(() => {
    const a = randInt(2, 20)
    const model = () => {
      const P = box(a, a, a)
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      need(eq(dot(subv(C, A), subv(D1, B)), 0), "AC и BD₁ не перпендикулярны")
      return distLines(A, subv(C, A), B, subv(D1, B))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 6) return null
    return item({
      preamble: `В кубе ${BOX} все рёбра равны ${a}.`,
      qa: "угол между прямыми AC и BD₁ равен 90°.",
      qb: "Найдите расстояние между прямыми AC и BD₁.",
      ans: Sstr(ex), num, model,
      solution: `В координатах A(0; 0; 0), B(${a}; 0; 0), D(0; ${a}; 0) имеем AC = (${a}; ${a}; 0) и BD₁ = (−${a}; ${a}; ${a}), их скалярное произведение равно нулю. Расстояние между скрещивающимися прямыми равно |AB · (AC × BD₁)| / |AC × BD₁| = ${Sstr(ex)}.`,
    })
  })
}

// E2. Прямая треугольная призма, ∠C = 90°: диагонали боковых граней и гипотенуза.
export function t14PrismRightTetraVolume() {
  return attempt(() => {
    const [ac, bc, c] = pick([[3, 4, 5], [12, 5, 13], [8, 15, 17], [24, 7, 25], [20, 21, 29], [9, 12, 15], [6, 8, 10], [15, 20, 25]])
    const d1 = randInt(c + 1, c + 14)
    const h2 = d1 * d1 - c * c
    if (h2 <= 0 || !isSq(bc * bc + h2)) return null
    const d2 = Math.round(Math.sqrt(bc * bc + h2))
    const h = Math.sqrt(h2)
    const model = () => {
      const P = prism([v3(ac, 0, 0), v3(0, bc, 0), v3(0, 0, 0)], v3(0, 0, h))
      const [A, B, C, A1, B1, C1] = P.V
      need(eq(dist(A, B1), d1) && eq(dist(B, C1), d2) && eq(dist(A, B), c), "рёбра не те, что в условии")
      need(eq(dot(subv(A1, C1), subv(B, C1)), 0), "треугольник BA₁C₁ не прямоугольный")
      return tetraVolume(A, A1, C1, B)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 3) return null
    return item({
      preamble: `Основанием прямой треугольной призмы ${PRISM3} является прямоугольный треугольник ABC с прямым углом C. Диагонали боковых граней AA₁B₁B и BB₁C₁C равны ${d1} и ${d2} соответственно, AB = ${c}.`,
      qa: "треугольник BA₁C₁ прямоугольный.",
      qb: "Найдите объём пирамиды AA₁C₁B.",
      ans: Sstr(ex), num, model,
      solution: `Высота призмы равна √(${d1}² − ${c}²) = ${SX(h)}, откуда BC = ${bc} и AC = ${ac}. Так как A₁C₁ ⊥ CC₁ и A₁C₁ ⊥ B₁C₁, прямая A₁C₁ перпендикулярна плоскости BCC₁B₁, значит ∠BC₁A₁ = 90°. Объём пирамиды равен ⅙·AC·BC·AA₁ = ${Sstr(ex)}.`,
    })
  })
}

// E3. Цилиндр: ∠ACB = 45°, AB = CC₁ ⇒ угол между BC₁ и AC равен 60°.
export function t14CylinderLateral45() {
  return attempt(() => {
    const l = randInt(2, 14)
    const model = () => {
      const ac = l * Math.SQRT2, R = ac / 2
      const A = v3(-R, 0, 0), C = v3(R, 0, 0)
      const B = v3(-R + l * l / (2 * R), l * l / (2 * R), 0)
      need(eq(dist(A, B), l) && eq(dist(B, C), l), "AB или BC не равны заданному")
      const C1 = v3(R, 0, l)
      need(eq(angLines(subv(C1, B), subv(C, A)), 60), "угол между BC₁ и AC не равен 60°")
      return Math.PI * ac * l
    }
    const num = model()
    const str = piStr(num)
    if (!str) return null
    return item({
      preamble: `В цилиндре образующая перпендикулярна плоскости основания. На окружности одного из оснований цилиндра выбраны точки A, B и C, а на окружности другого основания — точка C₁, причём CC₁ — образующая цилиндра, а AC — диаметр основания. Известно, что ∠ACB = 45°, AB = CC₁ = ${l}.`,
      qa: "угол между прямыми BC₁ и AC равен 60°.",
      qb: "Найдите площадь боковой поверхности цилиндра.",
      ans: str, num, model,
      solution: `Угол ABC опирается на диаметр, поэтому он прямой, и при ∠ACB = 45° имеем BC = AB = ${l}, AC = ${l}√2. Проекция BC₁ на плоскость основания — отрезок BC, и cos угла между BC₁ и AC равен BC·cos45° / √(BC² + CC₁²) = ½. Площадь боковой поверхности равна π·AC·CC₁ = ${str}.`,
    })
  })
}

// E4. Прямая призма, основание — ромб, AB = AA₁; A₁C ⊥ BD.
export function t14PrismRhombVolume() {
  return attempt(() => {
    const d = randInt(2, 16)
    const model = () => {
      const s = Math.sqrt(2 * d * d / 5), p = Math.sqrt(4 * s * s - d * d)
      const A = v3(-p / 2, 0, 0), B = v3(0, -d / 2, 0), C = v3(p / 2, 0, 0), D = v3(0, d / 2, 0)
      const P = prism([A, B, C, D], v3(0, 0, s))
      const [a, b, c, dd, A1] = P.V
      need(eq(dist(A1, c), d) && eq(dist(b, dd), d), "A₁C или BD не равны заданному")
      need(eq(dist(a, b), s), "AB ≠ AA₁")
      need(eq(dot(subv(c, A1), subv(dd, b)), 0), "A₁C и BD не перпендикулярны")
      return polyVolume(P)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 25) return null
    return item({
      preamble: `Основанием прямой четырёхугольной призмы ${PRISM4} является ромб ABCD, AB = AA₁.`,
      qa: "прямые A₁C и BD перпендикулярны.",
      qb: `Найдите объём призмы, если A₁C = BD = ${d}.`,
      ans: Sstr(ex), num, model,
      solution: `Диагональ BD перпендикулярна AC и AA₁, значит BD ⊥ (ACC₁A₁) и BD ⊥ A₁C. Обозначив сторону ромба s, из A₁C² = AC² + s² и AC² + BD² = 4s² получаем s² = 2·${d}²/5. Объём равен ½·AC·BD·AA₁ = ${Sstr(ex)}.`,
    })
  })
}

// E5. Правильная четырёхугольная пирамида MABCD: L — середина MB, дан тангенс угла
// между DM и AL; ищем высоту.
export function t14PyrTangentHeight() {
  return attempt(() => {
    const k = randInt(1, 8), H = randInt(2, 16)
    const a = k * Math.SQRT2
    const model = () => {
      const A = v3(-a / 2, -a / 2, 0), B = v3(a / 2, -a / 2, 0), C = v3(a / 2, a / 2, 0), D = v3(-a / 2, a / 2, 0)
      const M = v3(0, 0, H), O = v3(0, 0, 0), Lp = mid(M, B)
      need(eq(dot(subv(A, O), subv(Lp, O)), 0), "AO и LO не перпендикулярны")
      return H
    }
    const tg = (() => {
      const A = v3(-a / 2, -a / 2, 0), B = v3(a / 2, -a / 2, 0), D = v3(-a / 2, a / 2, 0), M = v3(0, 0, H)
      const ang = angLines(subv(M, D), subv(mid(M, B), A))
      return Math.tan(ang * Math.PI / 180)
    })()
    const tgEx = exactOf(tg)
    if (!tgEx || tgEx.b > 6 || Math.abs(tgEx.a) > 30) return null
    const num = model()
    const ex = exactOf(num)
    if (!ex) return null
    return item({
      preamble: `Дана правильная четырёхугольная пирамида MABCD с основанием ABCD, стороны основания которой равны ${L(S(k, 1, 2))}. Точка L — середина ребра MB. Тангенс угла между прямыми DM и AL равен ${Sstr(tgEx)}.`,
      qa: "если O — центр основания пирамиды, то прямые AO и LO перпендикулярны.",
      qb: "Найдите высоту данной пирамиды.",
      ans: Sstr(ex), num, model,
      solution: `Точка L — середина MB, поэтому LO — средняя линия треугольника MBD и LO ∥ MD; а AO ⊥ BD и AO ⊥ MO, значит AO ⊥ (MBD) и AO ⊥ LO. Угол между DM и AL равен углу ALO, его тангенс равен AO : LO; из этого уравнения высота пирамиды равна ${Sstr(ex)}.`,
    })
  })
}

// E6. Цилиндр: AC₁ пересекает ось ⇒ AC — диаметр и ∠ABC₁ = 90°.
export function t14CylinderAngleBB1AC1() {
  return attempt(() => {
    const [ab, bc, ac] = pick([[3, 4, 5], [6, 8, 10], [8, 15, 17], [5, 12, 13], [9, 12, 15], [12, 16, 20], [7, 24, 25], [20, 21, 29]])
    const swap = Math.random() < 0.5
    const [p, q] = swap ? [bc, ab] : [ab, bc]
    const bb = randInt(2, 20)
    const model = () => {
      const R = ac / 2
      const A = v3(-R, 0, 0), C = v3(R, 0, 0)
      const B = v3(-R + p * p / (2 * R), p * q / (2 * R), 0)
      need(eq(dist(A, B), p) && eq(dist(B, C), q), "AB или BC не равны заданному")
      const B1 = add(B, v3(0, 0, bb)), C1 = add(C, v3(0, 0, bb))
      need(eq(dist(B1, C1), q), "B₁C₁ ≠ BC")
      need(eq(dot(subv(A, B), subv(C1, B)), 0), "угол ABC₁ не прямой")
      return angLines(subv(B1, B), subv(C1, A))
    }
    const num = model()
    const ang = angleExact(num)
    if (!ang) return null
    return item({
      preamble: `В цилиндре образующая перпендикулярна плоскости основания. На окружности одного из оснований цилиндра выбраны точки A и B, а на окружности другого основания — точки B₁ и C₁, причём BB₁ — образующая цилиндра, а отрезок AC₁ пересекает ось цилиндра.`,
      qa: "угол ABC₁ прямой.",
      qb: `Найдите угол между прямыми BB₁ и AC₁, если AB = ${p}, BB₁ = ${bb}, B₁C₁ = ${q}.`,
      ans: ang.str, num, model,
      solution: `Так как AC₁ пересекает ось, проекция C₁ на нижнее основание — точка C, диаметрально противоположная A. Значит ∠ABC = 90° (опирается на диаметр), а BB₁ ⊥ (ABC), поэтому ∠ABC₁ = 90°. Далее AC = √(${p}² + ${q}²) = ${ac}, и tg искомого угла равен AC : BB₁, то есть угол равен ${ang.str}.`,
    })
  })
}

// E8. Цилиндр: A₁, B₁ симметричны A, B относительно середины оси ⇒ AB₁ ∥ BA₁.
export function t14CylinderParallelogramArea() {
  return attempt(() => {
    const R = randInt(3, 15), ab = randInt(2, 2 * R - 1), h = randInt(2, 20)
    const model = () => {
      const half = Math.sqrt(R * R - ab * ab / 4)
      need(half > 1e-9, "AB не хорда")
      const A = v3(-ab / 2, half, h / 2), B = v3(ab / 2, half, h / 2)
      const A1 = scal(A, -1), B1 = scal(B, -1)
      need(len(cross(subv(B1, A), subv(A1, B))) < 1e-7 * len(subv(B1, A)) * len(subv(A1, B)), "AB₁ и BA₁ не параллельны")
      return polyArea([A, B, A1, B1])
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `Точки O и O₁ — центры верхнего и нижнего оснований цилиндра, точка K — середина отрезка OO₁. На окружности верхнего основания взяты точки A и B, не лежащие на диаметре, и на окружности нижнего основания — точки A₁ и B₁, симметричные точкам A и B соответственно относительно точки K.`,
      qa: "прямые AB₁ и BA₁ параллельны.",
      qb: `Найдите площадь четырёхугольника ABA₁B₁, если радиус основания равен ${R}, AB = ${ab}, а высота цилиндра равна ${h}.`,
      ans: Sstr(ex), num, model,
      solution: `Центральная симметрия относительно K переводит A в A₁, B в B₁, поэтому AB₁ ∥ BA₁ и ABA₁B₁ — параллелограмм. Расстояние от K до AB равно √(R² − AB²/4) = ${SX(Math.sqrt(R * R - ab * ab / 4))}, и площадь равна ${Sstr(ex)}.`,
    })
  })
}

// E9. Прямая призма, ромб: B₁D₁ ⊥ AC₁, расстояние между ними.
export function t14PrismRhombDistDiag() {
  return attempt(() => {
    const p = randInt(2, 15) * 2, q = randInt(2, 15) * 2, h = randInt(2, 30)
    const model = () => {
      const A = v3(-p / 2, 0, 0), B = v3(0, -q / 2, 0), C = v3(p / 2, 0, 0), D = v3(0, q / 2, 0)
      const P = prism([A, B, C, D], v3(0, 0, h))
      const [a, b, c, d, A1, B1, C1, D1] = P.V
      need(eq(dot(subv(D1, B1), subv(C1, a)), 0), "B₁D₁ и AC₁ не перпендикулярны")
      return distLines(B1, subv(D1, B1), a, subv(C1, a))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 30) return null
    return item({
      preamble: `В основании прямой призмы ${PRISM4} лежит ромб ABCD с диагоналями AC = ${p} и BD = ${q}.`,
      qa: "прямые B₁D₁ и AC₁ перпендикулярны.",
      qb: `Найдите расстояние между прямыми B₁D₁ и AC₁, если известно, что боковое ребро призмы равно ${h}.`,
      ans: Sstr(ex), num, model,
      solution: `Диагонали ромба перпендикулярны, а B₁D₁ ⊥ AA₁, поэтому B₁D₁ ⊥ (ACC₁A₁) и B₁D₁ ⊥ AC₁. Расстояние между скрещивающимися прямыми равно ${Sstr(ex)}.`,
    })
  })
}

// E10. Куб: A₁C ⊥ DC₁, расстояние от середины AA₁ до плоскости BC₁D.
export function t14CubeDistMidToPlane() {
  return attempt(() => {
    const kk = randInt(1, 10)
    const aS = Math.random() < 0.5 ? S(kk, 1, 3) : S(kk * 2)
    const a = Sval(aS)
    const model = () => {
      const P = box(a, a, a)
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      need(eq(dot(subv(C, A1), subv(C1, D)), 0), "A₁C и DC₁ не перпендикулярны")
      return distPointPlane(plane3(B, C1, D), mid(A, A1))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 6) return null
    return item({
      preamble: `Дан куб ${BOX}.`,
      qa: "диагональ A₁C куба и диагональ DC₁ грани DD₁C₁C перпендикулярны.",
      qb: `Найдите расстояние от точки M — середины ребра AA₁, до плоскости BC₁D, если ребро куба равно ${L(aS)}.`,
      ans: Sstr(ex), num, model,
      solution: `Плоскость BC₁D отсекает от куба правильный тетраэдр; её нормаль — вектор (1; −1; 1) в координатах A(0; 0; 0), B(a; 0; 0), D(0; a; 0). Расстояние от середины AA₁ до этой плоскости равно ${Sstr(ex)}.`,
    })
  })
}

// E11. Пирамида PABC: основание высоты — C, PA ⊥ BC ⇒ ∠ACB = 90°.
export function t14PyrRightBaseVolume() {
  return attempt(() => {
    const [acL, bcL, abL] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [15, 8, 17], [12, 5, 13], [7, 24, 25], [24, 7, 25], [20, 21, 29], [9, 12, 15], [6, 8, 10]])
    const pcCand = []
    for (let pc = 2; pc <= 30; pc++) if (isSq(pc * pc + bcL * bcL)) pcCand.push(pc)
    if (!pcCand.length) return null
    const pc = pick(pcCand)
    const pb = Math.round(Math.sqrt(pc * pc + bcL * bcL))
    const pa2 = pc * pc + acL * acL
    const cosNum = pb * pb + abL * abL - pa2, cosDen = 2 * pb * abL
    const g = gcd(cosNum, cosDen) || 1
    if (cosNum <= 0 || cosNum >= cosDen) return null
    const model = () => {
      const C = v3(0, 0, 0), A = v3(acL, 0, 0), B = v3(0, bcL, 0), Pp = v3(0, 0, pc)
      need(eq(dist(A, B), abL) && eq(dist(Pp, B), pb), "AB или PB не равны заданному")
      need(eq(dot(subv(A, Pp), subv(B, C)), 0, 1e-7), "PA и BC не перпендикулярны")
      need(eq(dot(subv(A, C), subv(B, C)), 0), "треугольник ABC не прямоугольный")
      const cosB = (dot(subv(Pp, B), subv(A, B))) / (dist(Pp, B) * dist(A, B))
      need(eq(cosB, cosNum / cosDen), "косинус угла PBA не тот, что в условии")
      return tetraVolume(Pp, A, B, C)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 3) return null
    return item({
      preamble: `В треугольной пирамиде PABC с основанием ABC известно, что AB = ${abL}, PB = ${pb}, cos ∠PBA = ${cosDen / g === 1 ? cosNum / g : fT(cosNum / g, cosDen / g)}. Основанием высоты этой пирамиды является точка C. Прямые PA и BC перпендикулярны.`,
      qa: "треугольник ABC прямоугольный.",
      qb: "Найдите объём пирамиды PABC.",
      ans: Sstr(ex), num, model,
      solution: `Так как PC ⊥ (ABC), то PC ⊥ BC; вместе с PA ⊥ BC это даёт BC ⊥ (PAC), значит BC ⊥ AC и треугольник ABC прямоугольный. По теореме косинусов PA² = ${pa2}, откуда BC = ${bcL}, AC = ${acL}, PC = ${pc}. Объём равен ⅙·AC·BC·PC = ${Sstr(ex)}.`,
    })
  })
}

// E12. Прямая призма, основание — параллелограмм: DB ⊥ BC.
// Набор параметров (AD, DB², AA₁), при которых все длины условия читаемы, считается
// один раз при импорте: случайный перебор по трём числам находил их слишком редко.
const E12_SET = (() => {
  const out = []
  const ok = (x) => { const e = exactOf(x); return e && e.b === 1 && e.r <= 30 && e.a <= 60 }
  for (let ad = 3; ad <= 14; ad++) {
    for (let db2 = 3; db2 <= 120; db2++) {
      for (let h = 2; h <= 14; h++) {
        const ab2 = ad * ad + db2
        if (!ok(Math.sqrt(ab2 + h * h)) || !ok(Math.sqrt(db2 + h * h)) || !ok(Math.sqrt(ad * ad + h * h))) continue
        out.push({ ad, db2, h })
      }
    }
  }
  return out
})()

export function t14PrismParallelogramSurface() {
  return attempt(() => {
    const { ad, db2, h } = pick(E12_SET)
    const ab2 = ad * ad + db2
    const ab1 = Math.sqrt(ab2 + h * h), db1 = Math.sqrt(db2 + h * h), b1c = Math.sqrt(ad * ad + h * h)
    const faces = () => {
      const db = Math.sqrt(db2), ab = Math.sqrt(ab2)
      const A = v3(0, 0, 0), B = v3(ab, 0, 0)
      const dx = (ab2 + ad * ad - db2) / (2 * ab)
      const dy2 = ad * ad - dx * dx
      need(dy2 > 1e-9, "параллелограмм вырожден")
      const D = v3(dx, Math.sqrt(dy2), 0), C = add(B, subv(D, A)), B1 = v3(ab, 0, h)
      need(eq(dot(subv(B, D), subv(C, B)), 0), "DB и BC не перпендикулярны")
      need(eq(dist(A, B1), ab1) && eq(dist(D, B1), db1) && eq(dist(B1, C), b1c), "рёбра не те, что в условии")
      return [polyArea([A, B, D]), polyArea([A, B, B1]), polyArea([A, D, B1]), polyArea([B, D, B1])]
    }
    const model = () => faces().reduce((a, b) => a + b, 0)
    const num = model()
    const sum = exactSumOf(faces())
    if (!sum || sum.terms > 2 || Math.abs(sum.num - num) > 1e-7) return null
    // как в эталоне: ответ вида «48 + 12√7» — целое слагаемое плюс корень
    if (sum.terms === 2 && !/^\d+ \+/.test(sum.str)) return null
    return item({
      preamble: `Основанием прямой призмы ${PRISM4} является параллелограмм ABCD. Известно, что AB₁ = ${SX(ab1)}, DB₁ = ${SX(db1)} и AD = ${ad}.`,
      qa: "прямые DB и BC перпендикулярны.",
      qb: `Найдите площадь полной поверхности пирамиды B₁ABD, если B₁C = ${SX(b1c)}.`,
      ans: sum.str, num, model,
      solution: `Из B₁C² = BC² + BB₁² и BC = AD находим высоту призмы AA₁ = ${h}, затем DB = ${SX(Math.sqrt(db2))} и AB = ${SX(Math.sqrt(ab2))}. Равенство AB² = AD² + DB² показывает, что угол ADB прямой, поэтому DB ⊥ AD, а значит DB ⊥ BC. Сложив площади четырёх граней пирамиды B₁ABD, получаем ${sum.str}.`,
    })
  })
}

// Пирамида SABCD с прямоугольником в основании и высотой SA (E13, F1, F4).
function pyrRect(ab, bc, sa) {
  const A = v3(0, 0, 0), B = v3(ab, 0, 0), C = v3(ab, bc, 0), D = v3(0, bc, 0), Sp = v3(0, 0, sa)
  need(eq(dot(subv(Sp, A), subv(B, A)), 0) && eq(dot(subv(Sp, A), subv(D, A)), 0), "SA не перпендикулярна основанию")
  return { A, B, C, D, Sp }
}
// Набор (AB, BC, SA), при котором SB, SD и ответ читаемы, — считается один раз.
function rectSet(pred) {
  const out = []
  const ok = (x) => { const e = exactOf(x); return e && e.b === 1 && e.r <= 30 && e.a <= 40 }
  for (let ab = 2; ab <= 16; ab++) for (let bc = 2; bc <= 16; bc++) for (let sa2 = 3; sa2 <= 150; sa2++) {
    if (!ok(Math.sqrt(sa2)) || !ok(Math.sqrt(sa2 + ab * ab)) || !ok(Math.sqrt(sa2 + bc * bc))) continue
    const r = pred(ab, bc, Math.sqrt(sa2))
    if (r) out.push({ ab, bc, sa2, extra: r })
  }
  return out
}

// E13. Угол между прямыми SC и BD.
const E13_SET = rectSet((ab, bc, sa) => {
  const A = v3(0, 0, 0), B = v3(ab, 0, 0), C = v3(ab, bc, 0), D = v3(0, bc, 0), Sp = v3(0, 0, sa)
  const a = angleExact(angLines(subv(C, Sp), subv(D, B)))
  return a && a.str.length <= 16 ? a.str : null
})
export function t14PyrRectAngleSCBD() {
  return attempt(() => {
    const { ab, bc, sa2 } = pick(E13_SET)
    const sa = Math.sqrt(sa2)
    const model = () => {
      const { B, C, D, Sp } = pyrRect(ab, bc, sa)
      return angLines(subv(C, Sp), subv(D, B))
    }
    const num = model()
    const ang = angleExact(num)
    if (!ang) return null
    return item({
      preamble: `В основании четырёхугольной пирамиды SABCD лежит прямоугольник ABCD со сторонами AB = ${ab} и BC = ${bc}. Длины боковых рёбер пирамиды SA = ${SX(sa)}, SB = ${SX(Math.sqrt(sa2 + ab * ab))}, SD = ${SX(Math.sqrt(sa2 + bc * bc))}.`,
      qa: "SA — высота пирамиды.",
      qb: "Найдите угол между прямыми SC и BD.",
      ans: ang.str, num, model,
      solution: `Из SB² = SA² + AB² следует SA ⊥ AB, из SD² = SA² + AD² — SA ⊥ AD, поэтому SA — высота. В координатах A(0; 0; 0), B(${ab}; 0; 0), D(0; ${bc}; 0), S(0; 0; SA) косинус угла между SC и BD даёт ${ang.str}.`,
    })
  })
}

// F1. Угол между прямой SC и плоскостью ASB.
const F1_SET = rectSet((ab, bc, sa) => {
  const a = angleExact(Math.asin(bc / Math.sqrt(ab * ab + bc * bc + sa * sa)) * 180 / Math.PI)
  return a && a.str.length <= 16 ? a.str : null
})
export function t14PyrRectAngleSCplane() {
  return attempt(() => {
    const { ab, bc, sa2 } = pick(F1_SET)
    const sa = Math.sqrt(sa2)
    const model = () => {
      const { A, B, C, Sp } = pyrRect(ab, bc, sa)
      return angLinePlane(subv(C, Sp), plane3(A, Sp, B))
    }
    const num = model()
    const ang = angleExact(num)
    if (!ang) return null
    return item({
      preamble: `В основании четырёхугольной пирамиды SABCD лежит прямоугольник ABCD со сторонами AB = ${ab} и BC = ${bc}. Длины боковых рёбер пирамиды SA = ${SX(sa)}, SB = ${SX(Math.sqrt(sa2 + ab * ab))}, SD = ${SX(Math.sqrt(sa2 + bc * bc))}.`,
      qa: "SA — высота пирамиды.",
      qb: "Найдите угол между прямой SC и плоскостью ASB.",
      ans: ang.str, num, model,
      solution: `SA — высота (обратные теоремы Пифагора в треугольниках SAB и SAD). Так как BC ⊥ AB и BC ⊥ SA, то BC ⊥ (ASB), поэтому проекция SC на плоскость ASB — это SB, и синус искомого угла равен BC : SC = ${bc}/${SX(Math.sqrt(ab * ab + bc * bc + sa2))}, то есть угол равен ${ang.str}.`,
    })
  })
}

// F4. Расстояние от вершины A до плоскости SBC.
const F4_SET = rectSet((ab, bc, sa) => {
  const e = exactOf(ab * sa / Math.sqrt(ab * ab + sa * sa))
  return e && e.b <= 30 && Math.abs(e.a) <= 200 && e.r <= 30 ? "d" : null
})
export function t14PyrRectDistToSBC() {
  return attempt(() => {
    const { ab, bc, sa2 } = pick(F4_SET)
    const sa = Math.sqrt(sa2)
    const model = () => {
      const { A, B, C, Sp } = pyrRect(ab, bc, sa)
      return distPointPlane(plane3(Sp, B, C), A)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex) return null
    return item({
      preamble: `В основании четырёхугольной пирамиды SABCD лежит прямоугольник ABCD со сторонами AB = ${ab} и BC = ${SX(bc)}. Длины боковых рёбер пирамиды SA = ${SX(sa)}, SB = ${SX(Math.sqrt(sa2 + ab * ab))}, SD = ${SX(Math.sqrt(sa2 + bc * bc))}.`,
      qa: "SA — высота пирамиды.",
      qb: "Найдите расстояние от вершины A до плоскости SBC.",
      ans: Sstr(ex), num, model,
      solution: `SA — высота пирамиды. Прямая BC перпендикулярна плоскости SAB, поэтому плоскость SBC перпендикулярна SAB, и расстояние от A до SBC равно высоте прямоугольного треугольника SAB, проведённой к гипотенузе: AB·SA/SB = ${Sstr(ex)}.`,
    })
  })
}

// E15. Куб: P, Q — середины AD и CC₁; B₁P ⊥ QB; сечение через P ⊥ BQ.
export function t14CubeSectionPerpBQ() {
  return attempt(() => {
    const a = randInt(2, 20)
    const model = () => {
      const P = box(a, a, a)
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      const Pp = mid(A, D), Qq = mid(C, C1)
      need(eq(dot(subv(Pp, B1), subv(B, Qq)), 0), "B₁P и QB не перпендикулярны")
      return polyArea(section(P, planePN(Pp, subv(Qq, B))))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `Точки P и Q — середины рёбер AD и CC₁ куба ${BOX} соответственно.`,
      qa: "прямые B₁P и QB перпендикулярны.",
      qb: `Найдите площадь сечения куба плоскостью, проходящей через точку P и перпендикулярной прямой BQ, если ребро куба равно ${a}.`,
      ans: Sstr(ex), num, model,
      solution: `В координатах A(0; 0; 0), B(a; 0; 0), D(0; a; 0) векторы B₁P и QB ортогональны. Сечение, перпендикулярное BQ и проходящее через P, — четырёхугольник площадью a²√5/2 = ${Sstr(ex)}.`,
    })
  })
}

// E16. Прямая призма, ромб с углом 120°, боковые грани — квадраты.
export function t14PrismRhomb120Dist() {
  return attempt(() => {
    const k = randInt(1, 10)
    const sS = Math.random() < 0.5 ? S(k, 1, 3) : S(k * 2)
    const s = Sval(sS)
    const model = () => {
      const A = v3(s, 0, 0)
      const C = v3(s * Math.cos(2 * Math.PI / 3), s * Math.sin(2 * Math.PI / 3), 0)
      const D = v3(0, 0, 0), B = add(A, subv(C, D))
      const P = prism([A, B, C, D], v3(0, 0, s))
      const [a, b, c, d, A1] = P.V
      need(eq(angLines(subv(a, d), subv(c, d)), 120) || eq(dist(a, d), s), "ромб построен неверно")
      need(eq(dot(subv(c, A1), subv(d, b)), 0), "A₁C и BD не перпендикулярны")
      return distLines(A1, subv(c, A1), b, subv(d, b))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `Основание прямой призмы ${PRISM4} — ромб ABCD с углом 120° при вершине D, а боковые грани призмы — квадраты.`,
      qa: "прямые A₁C и BD перпендикулярны.",
      qb: `Найдите расстояние между этими прямыми, если сторона основания призмы равна ${L(sS)}.`,
      ans: Sstr(ex), num, model,
      solution: `BD ⊥ AC и BD ⊥ AA₁, поэтому BD ⊥ (ACC₁A₁) и BD ⊥ A₁C. Общий перпендикуляр лежит в плоскости ACC₁A₁; его длина равна ${Sstr(ex)}.`,
    })
  })
}

// E17. Куб: угол между AC и BC₁ равен 60°, расстояние между ними.
export function t14CubeDistACBC1() {
  return attempt(() => {
    const a = randInt(2, 20)
    const model = () => {
      const P = box(a, a, a)
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      need(eq(angLines(subv(C, A), subv(C1, B)), 60), "угол между AC и BC₁ не равен 60°")
      return distLines(A, subv(C, A), B, subv(C1, B))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 6) return null
    return item({
      preamble: `В кубе ${BOX} все рёбра равны ${a}.`,
      qa: "угол между прямыми AC и BC₁ равен 60°.",
      qb: "Найдите расстояние между прямыми AC и BC₁.",
      ans: Sstr(ex), num, model,
      solution: `Отрезки AC, BC₁ и AB₁ — диагонали граней куба, они равны и образуют равносторонний треугольник, поэтому угол между AC и BC₁ равен 60°. Расстояние между этими скрещивающимися прямыми равно ${Sstr(ex)}.`,
    })
  })
}

// E18. Правильная шестиугольная призма: CA₁ ⊥ C₁D₁; сечение через C, A₁, F₁.
export function t14Prism6SectionArea() {
  return attempt(() => {
    const s = randInt(2, 12), h = randInt(2, 16)
    const model = () => {
      const P = prism(regular(6, s, 0), v3(0, 0, h))
      const [A, B, C, D, Ee, F, A1, B1, C1, D1, E1, F1] = P.V
      need(eq(dot(subv(A1, C), subv(D1, C1)), 0), "CA₁ и C₁D₁ не перпендикулярны")
      return polyArea(section(P, plane3(C, A1, F1)))
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `В правильной шестиугольной призме ABCDEFA₁B₁C₁D₁E₁F₁ стороны основания равны ${s}, а боковые рёбра равны ${h}.`,
      qa: "прямые CA₁ и C₁D₁ перпендикулярны.",
      qb: "Найдите площадь сечения призмы плоскостью, проходящей через вершины C, A₁ и F₁.",
      ans: Sstr(ex), num, model,
      solution: `Проекция CA₁ на плоскость верхнего основания — прямая CA... скалярное произведение векторов CA₁ и C₁D₁ равно нулю. Сечение проходит через C, A₁, F₁ и вершины, симметричные им; его площадь равна ${Sstr(ex)}.`,
    })
  })
}

// E19. Правильная четырёхугольная призма, угол между диагоналями A₁C и B₁D равен 60°
// (это равносильно AA₁ = AB·√2), A₁C ⊥ AC₁.
export function t14Prism4Diag60Dist() {
  return attempt(() => {
    const a = randInt(2, 20)
    const model = () => {
      const h = a * Math.SQRT2
      const P = prism([v3(0, 0, 0), v3(a, 0, 0), v3(a, a, 0), v3(0, a, 0)], v3(0, 0, h))
      const [A, B, C, D, A1, B1, C1, D1] = P.V
      need(eq(angLines(subv(C, A1), subv(D, B1)), 60), "угол между A₁C и B₁D не равен 60°")
      need(eq(dot(subv(C, A1), subv(C1, A)), 0), "A₁C и AC₁ не перпендикулярны")
      return distPointPlane(plane3(B, mid(C, C1), D), A1)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `В правильной четырёхугольной призме ${PRISM4} угол между диагоналями A₁C и B₁D равен 60°.`,
      qa: "диагонали A₁C и AC₁ перпендикулярны.",
      qb: `Найдите расстояние от вершины A₁ до плоскости BMD, где точка M — середина ребра CC₁, если сторона основания призмы равна ${a}.`,
      ans: Sstr(ex), num, model,
      solution: `Из условия следует AA₁ = AB√2 = ${SX(a * Math.SQRT2)}; тогда A₁C · AC₁ = 0. Плоскость BMD пересекает призму так, что расстояние от A₁ до неё равно 3·AB/2 = ${Sstr(ex)}.`,
    })
  })
}

// ══════════════════════════════════════════════════════════════════════════
// РАЗДЕЛЫ F, G, H, L. Углы с плоскостью, двугранные углы, расстояния, объёмы
// ══════════════════════════════════════════════════════════════════════════

// F3. Куб: BD₁ ⊥ (ACB₁); угол между плоскостями AD₁C₁ и A₁D₁C.
export function t14CubeTwoPlanesAngle() {
  const a = randInt(2, 12)
  const model = () => {
    const P = box(a, a, a)
    const [A, B, C, D, A1, B1, C1, D1] = P.V
    need(eq(dot(subv(D1, B), subv(C, A)), 0) && eq(dot(subv(D1, B), subv(B1, A)), 0), "BD₁ не перпендикулярна плоскости ACB₁")
    return angPlanes(plane3(A, D1, C1), plane3(A1, D1, C))
  }
  const num = model()
  const ang = angleExact(num)
  return item({
    preamble: `Дан куб ${BOX}.`,
    qa: "прямая BD₁ перпендикулярна плоскости ACB₁.",
    qb: "Найдите угол между плоскостями AD₁C₁ и A₁D₁C.",
    ans: ang.str, num, model,
    solution: `В координатах A(0; 0; 0), B(1; 0; 0), D(0; 1; 0) вектор BD₁ = (−1; 1; 1) ортогонален и AC, и AB₁, поэтому BD₁ ⊥ (ACB₁). Нормали плоскостей AD₁C₁ и A₁D₁C дают косинус ½, то есть угол равен ${ang.str}.`,
  })
}

// F5. Конус: A и C диаметрально противоположны, M — середина BC.
export function t14ConeAngleSAplane() {
  return attempt(() => {
    const [p, q] = pick([[3, 4], [6, 8], [5, 12], [8, 15], [9, 12], [12, 16], [7, 24], [4, 3], [8, 6], [12, 5], [20, 21]])
    const ac = Math.round(Math.sqrt(p * p + q * q))
    const kk = randInt(1, 9)
    const scS = Math.random() < 0.5 ? S(kk, 1, 2) : S(kk)
    const sc = Sval(scS)
    if (sc <= ac / 2) return null
    const model = () => {
      const R = ac / 2, h = Math.sqrt(sc * sc - R * R)
      const A = v3(-R, 0, 0), C = v3(R, 0, 0), Sp = v3(0, 0, h)
      const B = v3(-R + p * p / (2 * R), p * q / (2 * R), 0)
      need(eq(dist(A, B), p) && eq(dist(B, C), q) && eq(dist(Sp, C), sc), "AB, BC или SC не те, что в условии")
      const M = mid(B, C)
      need(eq(angLinePlane(subv(M, Sp), plane3(A, B, C)), angLinePlane(subv(B, A), plane3(Sp, B, C))),
        "углы SM с (ABC) и AB с (SBC) не равны")
      return angLinePlane(subv(A, Sp), plane3(Sp, B, C))
    }
    const num = model()
    const ang = angleExact(num)
    if (!ang || ang.str.length > 16) return null
    return item({
      preamble: `Точки A, B и C лежат на окружности основания конуса с вершиной S, причём A и C диаметрально противоположны. Точка M — середина BC.`,
      qa: "прямая SM образует с плоскостью ABC такой же угол, как и прямая AB с плоскостью SBC.",
      qb: `Найдите угол между прямой SA и плоскостью SBC, если AB = ${p}, BC = ${q} и SC = ${L(scS)}.`,
      ans: ang.str, num, model,
      solution: `Угол ABC опирается на диаметр, поэтому он прямой и AC = ${ac}, а радиус основания равен ${ac / 2}. Высота конуса равна √(SC² − R²) = ${SX(Math.sqrt(sc * sc - ac * ac / 4))}. Синус угла между SA и плоскостью SBC равен отношению расстояния от A до этой плоскости к SA, откуда угол равен ${ang.str}.`,
    })
  })
}

// Правильная четырёхугольная призма с плоскостью γ ∥ BD через K на BC и L на C₁D₁;
// A₁C ⊥ γ ⇔ AB·(AB − BK − C₁L) = AA₁² (F6, F8).
function prismGamma(a, h, bk, c1l) {
  const P = prism([v3(0, 0, 0), v3(a, 0, 0), v3(a, a, 0), v3(0, a, 0)], v3(0, 0, h))
  const [A, B, C, D, A1, B1, C1, D1] = P.V
  const K = lerp(B, C, bk / a), Lp = lerp(C1, D1, c1l / a)
  const pl = planePPV(K, Lp, subv(D, B))
  need(len(cross(subv(C, A1), pl.n)) < 1e-7 * len(subv(C, A1)) * len(pl.n), "A₁C не перпендикулярна плоскости γ")
  return { P, pl, A, B, C, D, A1, B1, C1, D1 }
}
// Наборы (a, h², BK, C₁L) с целыми числами условия.
const GAMMA_SET = (() => {
  const out = []
  for (let a = 3; a <= 14; a++) for (let bk = 1; bk < a; bk++) for (let l = 1; l < a; l++) {
    const h2 = a * (a - bk - l)
    if (h2 <= 0) continue
    const e = exactOf(Math.sqrt(h2))
    if (!e || e.b !== 1 || e.r > 30) continue
    out.push({ a, h2, bk, l })
  }
  return out
})()

// F6. Расстояние от вершины B до плоскости γ.
export function t14PrismGammaDistB() {
  return attempt(() => {
    const { a, h2, bk, l } = pick(GAMMA_SET)
    const h = Math.sqrt(h2)
    const model = () => { const { pl, B } = prismGamma(a, h, bk, l); return distPointPlane(pl, B) }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 30) return null
    return item({
      preamble: `В правильной четырёхугольной призме ${PRISM4} сторона AB основания равна ${a}, а боковое ребро AA₁ равно ${SX(h)}. На рёбрах BC и C₁D₁ отмечены точки K и L соответственно, причём BK = ${bk}, C₁L = ${l}. Плоскость γ параллельна прямой BD и содержит точки K и L.`,
      qa: "прямая A₁C перпендикулярна плоскости γ.",
      qb: "Найдите расстояние от точки B до плоскости γ.",
      ans: Sstr(ex), num, model,
      solution: `В координатах A(0; 0; 0), B(${a}; 0; 0), D(0; ${a}; 0) нормаль плоскости γ пропорциональна (−AA₁; −AA₁; AB − BK − C₁L), и она коллинеарна вектору A₁C ровно при AB·(AB − BK − C₁L) = AA₁², что здесь выполнено. Расстояние от B до γ равно ${Sstr(ex)}.`,
    })
  })
}

// F8. Объём пирамиды с вершиной A₁ и основанием — сечением призмы плоскостью γ.
export function t14PrismGammaVolumeA1() {
  return attempt(() => {
    const { a, h2, bk, l } = pick(GAMMA_SET)
    const h = Math.sqrt(h2)
    const ck = a - bk
    if (ck < 1) return null
    const model = () => {
      const { P, pl, A1 } = prismGamma(a, h, bk, l)
      const poly = section(P, pl)
      need(poly.length >= 3, "пустое сечение")
      return pyramidVolume(poly, A1)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 12) return null
    return item({
      preamble: `В правильной четырёхугольной призме ${PRISM4} сторона AB основания равна ${a}, а боковое ребро AA₁ равно ${SX(h)}. На рёбрах BC и C₁D₁ отмечены точки K и L соответственно, причём CK = ${ck}, а C₁L = ${l}. Плоскость γ параллельна прямой BD и содержит точки K и L.`,
      qa: "прямая A₁C перпендикулярна плоскости γ.",
      qb: "Найдите объём пирамиды, вершина которой — точка A₁, а основание — сечение данной призмы плоскостью γ.",
      ans: Sstr(ex), num, model,
      solution: `Так как A₁C ⊥ γ, высота искомой пирамиды — отрезок от A₁ до плоскости γ вдоль A₁C. Объём равен ⅓ · S(сечения) · A₁H = ${Sstr(ex)}.`,
    })
  })
}

// G2. Правильная четырёхугольная пирамида по площадям боковой и полной поверхности.
export function t14PyrAreasSectionSAC() {
  return attempt(() => {
    const a = randInt(2, 14), apo = randInt(Math.floor(a / 2) + 1, a * 2)
    const sbok = 2 * a * apo, spoln = sbok + a * a
    const model = () => {
      const H = Math.sqrt(apo * apo - a * a / 4)
      const A = v3(-a / 2, -a / 2, 0), B = v3(a / 2, -a / 2, 0), C = v3(a / 2, a / 2, 0), D = v3(-a / 2, a / 2, 0)
      const Sp = v3(0, 0, H), O = v3(0, 0, 0)
      need(eq(2 * a * apo, sbok) && eq(sbok + a * a, spoln), "площади не те, что в условии")
      need(eq(angPlanes(plane3(Sp, A, C), plane3(Sp, mid(A, B), O)), 45), "угол между плоскостями не равен 45°")
      return polyArea([A, Sp, C])
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 4) return null
    return item({
      preamble: `Площадь боковой поверхности правильной четырёхугольной пирамиды SABCD с основанием ABCD равна ${sbok}, а площадь полной поверхности этой пирамиды равна ${spoln}.`,
      qa: "угол между плоскостью SAC и плоскостью, проходящей через вершину S этой пирамиды, середину стороны AB и центр основания, равен 45°.",
      qb: "Найдите площадь сечения пирамиды плоскостью SAC.",
      ans: Sstr(ex), num, model,
      solution: `Площадь основания равна ${spoln} − ${sbok} = ${a * a}, поэтому сторона основания равна ${a}, а апофема равна ${sbok}/(2·${a}) = ${apo}. Высота пирамиды равна √(${apo}² − ${a}²/4) = ${SX(Math.sqrt(apo * apo - a * a / 4))}. Обе плоскости содержат высоту SO, а их следы в основании — диагональ AC и отрезок к середине AB, угол между которыми 45°. Площадь треугольника SAC равна ½·AC·SO = ${Sstr(ex)}.`,
    })
  })
}

// G4. Пирамида PABCD, основание — трапеция; PAB ⊥ основанию, PCD ⊥ основанию.
export function t14PyrTrapVolumePKBC() {
  return attempt(() => {
    const s = randInt(2, 12), h = randInt(2, 20)
    const model = () => {
      const K = v3(0, 0, 0)
      const x = s / Math.SQRT2, y = s / Math.SQRT2
      const B = v3(x, 0, 0), A = v3(x + s, 0, 0), C = v3(0, y, 0), D = v3(0, y + s, 0)
      need(len(cross(subv(C, B), subv(D, A))) < 1e-7 * s * s, "BC не параллельна AD")
      need(eq(angLines(subv(D, A), subv(B, A)) + angLines(subv(A, D), subv(C, D)), 90), "сумма углов BAD и ADC не равна 90°")
      const Pp = v3(0, 0, h)
      const pab = plane3(Pp, A, B), pcd = plane3(Pp, C, D)
      need(eq(dot(pab.n, pcd.n), 0, 1e-7), "плоскости PAB и PCD не перпендикулярны")
      return tetraVolume(Pp, K, B, C)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 12) return null
    return item({
      preamble: `Основание пирамиды PABCD — трапеция ABCD, причём ∠BAD + ∠ADC = 90°. Плоскости PAB и PCD перпендикулярны плоскости основания, прямые AB и CD пересекаются в точке K.`,
      qa: "плоскости PAB и PCD перпендикулярны.",
      qb: `Найдите объём пирамиды PKBC, если AB = BC = CD = ${s}, а высота пирамиды равна ${h}.`,
      ans: Sstr(ex), num, model,
      solution: `Так как обе плоскости PAB и PCD перпендикулярны основанию и пересекаются по прямой PK, эта прямая — высота пирамиды, а ∠AKD = 180° − (∠BAD + ∠ADC) = 90°, поэтому плоскости PAB и PCD перпендикулярны. Из подобия KB = KC = ${s}/√2, и объём равен ⅓ · ½ · KB · KC · PK = ${Sstr(ex)}.`,
    })
  })
}

// G8. Правильная шестиугольная призма, все рёбра равны: AA₁D₁ ⊥ DB₁F₁.
export function t14Prism6TangentAngle() {
  const a = randInt(1, 12)
  const model = () => {
    const P = prism(regular(6, a, 0), v3(0, 0, a))
    const [A, B, C, D, Ee, F, A1, B1, C1, D1, E1, F1] = P.V
    const pl1 = plane3(A, A1, D1), pl2 = plane3(D, B1, F1)
    need(eq(dot(pl1.n, pl2.n), 0, 1e-7), "плоскости AA₁D₁ и DB₁F₁ не перпендикулярны")
    const ang = angPlanes(plane3(A, B, C), pl2)
    return Math.tan(ang * Math.PI / 180)
  }
  const num = model()
  const ex = exactOf(num)
  return item({
    preamble: `В правильной шестиугольной призме ABCDEFA₁B₁C₁D₁E₁F₁ все рёбра равны ${a}.`,
    qa: "плоскости AA₁D₁ и DB₁F₁ перпендикулярны.",
    qb: "Найдите тангенс угла между плоскостями ABC и DB₁F₁.",
    ans: Sstr(ex), num, model,
    solution: `Диагональ AD — ось симметрии шестиугольника, а B₁F₁ ⊥ AD, поэтому плоскость DB₁F₁ перпендикулярна плоскости AA₁D₁. Линейный угол двугранного угла между DB₁F₁ и основанием — угол при вершине прямоугольного треугольника с катетами, равными ребру и половине малой диагонали; его тангенс равен ${Sstr(ex)}.`,
  })
}

// G9. Правильная треугольная пирамида: MNK ∥ DBC; расстояние от K до DBC.
export function t14Pyr3ParallelPlaneDist() {
  return attempt(() => {
    const [kk, hh, ad] = pick([[6, 8, 10], [3, 4, 5], [8, 15, 17], [5, 12, 13], [12, 9, 15], [4, 3, 5], [15, 8, 17], [12, 5, 13], [20, 21, 29], [9, 12, 15]])
    const tq = pick([2, 3, 4, 5, 6]), tp = randInt(1, tq - 1)
    const t = tp / tq
    const a = kk * Math.sqrt(3)
    const model = () => {
      const A = v3(0, 0, 0), B = v3(a, 0, 0), C = v3(a / 2, a * Math.sqrt(3) / 2, 0)
      const O = scal(add(add(A, B), C), 1 / 3)
      const Dv = add(O, v3(0, 0, hh))
      need(eq(dist(A, Dv), ad), "боковое ребро не то, что в расчёте")
      const M = lerp(A, B, t), N = lerp(A, C, t), K = lerp(A, Dv, t)
      const pl1 = plane3(M, N, K), pl2 = plane3(Dv, B, C)
      need(len(cross(pl1.n, pl2.n)) < 1e-7 * len(pl1.n) * len(pl2.n), "плоскости MNK и DBC не параллельны")
      return distPointPlane(pl2, K)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 40 || Math.abs(ex.a) > 400) return null
    return item({
      preamble: `В правильной треугольной пирамиде DABC с основанием ABC сторона основания равна ${L(S(kk, 1, 3))}, а высота пирамиды равна ${hh}. На рёбрах AB, AC и AD соответственно отмечены точки M, N и K, такие, что AM = AN = ${L(S(tp * kk, tq, 3))} и AK = ${L(S(tp * ad, tq))}.`,
      qa: "плоскости MNK и DBC параллельны.",
      qb: "Найдите расстояние от точки K до плоскости DBC.",
      ans: Sstr(ex), num, model,
      solution: `Боковое ребро равно √(${hh}² + ${kk}²) = ${ad}. Так как AM : AB = AN : AC = AK : AD = ${tp} : ${tq}, треугольник MNK гомотетичен BCD с центром A, поэтому плоскости параллельны. Расстояние от K до плоскости DBC составляет (1 − ${tp}/${tq}) от расстояния от A до неё и равно ${Sstr(ex)}.`,
    })
  })
}

// G11. Правильная четырёхугольная пирамида: MNK ∥ SBC; расстояние от M до SBC.
// Наборы (AB, высота, боковое ребро, доля) для G11 — считаются один раз при импорте.
const PYR4_SET = (() => {
  const out = []
  for (let a = 2; a <= 40; a += 2) for (let hh = 2; hh <= 30; hh++) {
    const as2 = hh * hh + a * a / 2
    if (!isSq(as2)) continue
    const asL = Math.round(Math.sqrt(as2))
    for (const tq of [2, 3, 4, 5]) for (let tp = 1; tp < tq; tp++) {
      if ((tp * a) % tq || (tp * asL) % tq) continue
      out.push({ a, hh, asL, tp, tq })
    }
  }
  return out
})()

export function t14Pyr4ParallelPlaneDist() {
  return attempt(() => {
    const { a, hh, asL, tp, tq } = pick(PYR4_SET)
    const t = tp / tq
    const model = () => {
      const A = v3(0, 0, 0), B = v3(a, 0, 0), C = v3(a, a, 0), D = v3(0, a, 0)
      const Sp = add(scal(add(add(A, B), add(C, D)), 0.25), v3(0, 0, hh))
      need(eq(dist(A, Sp), asL), "боковое ребро не то, что в расчёте")
      const M = lerp(A, B, t), N = lerp(D, C, t), K = lerp(A, Sp, t)
      const pl1 = plane3(M, N, K), pl2 = plane3(Sp, B, C)
      need(len(cross(pl1.n, pl2.n)) < 1e-7 * len(pl1.n) * len(pl2.n), "плоскости MNK и SBC не параллельны")
      return distPointPlane(pl2, M)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 30) return null
    return item({
      preamble: `В правильной четырёхугольной пирамиде SABCD сторона AB основания равна ${a}, а высота пирамиды равна ${hh}. На рёбрах AB, CD и AS отмечены точки M, N и K соответственно, причём AM = DN = ${t * a} и AK = ${t * asL}.`,
      qa: "плоскости MNK и SBC параллельны.",
      qb: "Найдите расстояние от точки M до плоскости SBC.",
      ans: Sstr(ex), num, model,
      solution: `Боковое ребро равно √(${hh}² + ${a * a / 2}) = ${asL}. Отрезки MN ∥ BC и MK ∥ BS (так как AM : AB = AK : AS), поэтому плоскости MNK и SBC параллельны. Расстояние от M до SBC равно (1 − ${tp}/${tq}) от расстояния от A до этой плоскости, то есть ${Sstr(ex)}.`,
    })
  })
}

// H10. Правильная четырёхугольная пирамида: γ ∥ BC через точку K на апофеме и вершину
// основания; объём отсечённой пирамиды.
export function t14PyrApothemSectionVolume() {
  return attempt(() => {
    const a = randInt(2, 20) * 2, hh = randInt(2, 16)
    const st2 = hh * hh + a * a / 4
    if (!isSq(st2)) return null
    const st = Math.round(Math.sqrt(st2))
    const k = randInt(1, st - 1)
    const thruD = Math.random() < 0.5
    const model = () => {
      const A = v3(0, 0, 0), B = v3(a, 0, 0), C = v3(a, a, 0), D = v3(0, a, 0)
      const O = scal(add(add(A, B), add(C, D)), 0.25)
      const Sp = add(O, v3(0, 0, hh))
      const T = mid(B, C)
      need(eq(dist(Sp, T), st), "апофема не та, что в расчёте")
      const K = lerp(Sp, T, k / st)
      const base = thruD ? D : A
      const pl = planePPV(K, base, subv(C, B))
      const apex = thruD ? C : B, other = thruD ? B : C
      need(eq(distPointPlane(pl, apex), distPointPlane(pl, other)), "расстояния от B и C до γ не равны")
      const poly = section(pyramid([A, B, C, D], Sp), pl)
      need(poly.length >= 3, "пустое сечение")
      return pyramidVolume(poly, apex)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 40 || Math.abs(ex.a) > 20000) return null
    const [first, second] = thruD ? ["C", "B"] : ["B", "C"]
    return item({
      preamble: `В правильной четырёхугольной пирамиде SABCD сторона основания AB = ${a}, высота SO = ${hh}. На апофеме ST грани BSC отмечена точка K так, что SK = ${k}. Плоскость γ параллельна прямой BC и содержит точки K и ${thruD ? "D" : "A"}.`,
      qa: `расстояние от точки ${first} до плоскости γ равно расстоянию от точки ${second} до плоскости γ.`,
      qb: `Найдите объём пирамиды, вершина которой точка ${first}, а основание — сечение данной пирамиды плоскостью γ.`,
      ans: Sstr(ex), num, model,
      solution: `Апофема равна √(${hh}² + ${a * a / 4}) = ${st}. Плоскость γ параллельна BC, поэтому она одинаково удалена от B и C. Сечение — четырёхугольник, и объём пирамиды с вершиной ${first} равен ${Sstr(ex)}.`,
    })
  })
}

// L6. Правильная треугольная призма: MNB₁ делит призму пополам ⇔ AM + CN = AA₁/2.
export function t14Prism3TetraVolume() {
  return attempt(() => {
    const a = randInt(2, 20) * 2, p = randInt(1, a / 2 - 1), q = a / 2 - p
    if (q < 1) return null
    const model = () => {
      const base = [v3(0, 0, 0), v3(a, 0, 0), v3(a / 2, a * Math.sqrt(3) / 2, 0)]
      const P = prism(base, v3(0, 0, a))
      const [A, B, C, A1, B1, C1] = P.V
      const M = v3(0, 0, p), N = add(C, v3(0, 0, q))
      const pl = plane3(M, N, B1)
      const v1 = clipVolume(P, pl, -1), v2 = clipVolume(P, pl, 1)
      need(eq(v1, v2), "плоскость MNB₁ делит призму не пополам")
      return tetraVolume(M, N, B, B1)
    }
    const num = model()
    const ex = exactOf(num)
    if (!ex || ex.b > 6) return null
    return item({
      preamble: `В правильной треугольной призме ${PRISM3} все рёбра равны ${a}. На рёбрах AA₁ и CC₁ отмечены точки M и N соответственно, причём AM = ${p}, CN = ${q}.`,
      qa: "плоскость MNB₁ разбивает призму на два многогранника, объёмы которых равны.",
      qb: "Найдите объём тетраэдра MNBB₁.",
      ans: Sstr(ex), num, model,
      solution: `Объём части призмы, отсечённой плоскостью MNB₁, равен площади основания, умноженной на среднее арифметическое высот AM, CN и BB₁: (${p} + ${q} + ${a})/3 = ${a}/2, то есть ровно половине объёма призмы. Треугольник MBB₁ лежит в грани ABB₁A₁, его площадь равна ${SX((a - p) * a / 2)}, а расстояние от N до этой грани равно ${SX(a * Math.sqrt(3) / 2)}; объём тетраэдра равен ${Sstr(ex)}.`,
    })
  })
}

// ══════════════════════════════════════════════════════════════════════════
// РЕЕСТР ТИПАЖЕЙ
// ══════════════════════════════════════════════════════════════════════════
// Группы — по ВОПРОСУ пункта б (так же устроен эталон: 12 разделов по вопросу).
// Одна конфигурация может встречаться в эталоне в нескольких разделах — здесь
// она попадает ровно в тот, который отвечает её вопросу.
//
// ВАЖНО: функции подставлены сюда ПО ИМЕНИ, а не стрелками-обёртками. Обёртка
// сломала бы keyOfGen (он ищет генератор по тождеству функции), и типаж потерял бы
// gen_key — на нём держится аналитика слабых типажей.
export const META14 = [
  ["Сечение: периметр и площадь", [
    ["prism-sq-tri-perimeter", "Призма с квадратом: сечение ∥ BD₁ — периметр треугольника", t14PrismSquareTriPerimeter],
    ["prism-tri-trapezoid", "Правильная 3-уг. призма: сечение через A₁B₁ и середину BC", t14PrismTriTrapArea],
    ["box-rhombus-section", "Параллелепипед: сечение через AC₁ — ромб", t14BoxRhombusSection],
    ["cone-obtuse-section", "Конус 120°: сечение через вершину ⊥ образующей", t14ConeObtuseSection],
    ["prism4-square-section", "Правильная 4-уг. призма: MNKL — квадрат, сечение шестиугольник", t14Prism4SquareSection],
    ["prism3-square-section", "Правильная 3-уг. призма: MNKL — квадрат, сечение пятиугольник", t14Prism3SquareSection],
    ["box-eft-area", "Плоскость EFT через D₁: площадь сечения", t14BoxEFTArea],
    ["prism-plane-mid-ac", "Призма: α через BC₁ ∥ AB₁", t14PrismPlaneMidAC],
    ["box-etd1-area", "Плоскость ETD₁ делит BB₁: площадь сечения", t14BoxETD1Area],
    ["prism-tri-letter-area", "Все рёбра a: сечение через AB и середину B₁C₁ (буквенный ответ)", t14PrismTriLetterArea],
    ["prism4-plane-dd-area", "α через K и B ∥ AC: площадь сечения", t14Prism4PlaneDDArea],
    ["parallelepiped-ba1-area", "α через BA₁ ∥ CB₁: площадь сечения", t14ParallelepipedBA1Area],
    ["box-apq-area", "Плоскость APQ через середины рёбер: площадь сечения", t14BoxAPQArea],
    ["pyr3-section-perimeter", "Пирамида: α ⊃ MN ⊥ основанию — периметр сечения", t14Pyr3SectionPerimeter],
    ["cube-section-perp-bq", "Куб: сечение через P ⊥ BQ", t14CubeSectionPerpBQ],
    ["prism6-section-area", "Правильная 6-уг. призма: сечение через C, A₁, F₁", t14Prism6SectionArea],
    ["prism-parallelogram-surface", "Полная поверхность пирамиды B₁ABD", t14PrismParallelogramSurface],
    ["cylinder-parallelogram", "Цилиндр: площадь ABA₁B₁", t14CylinderParallelogramArea],
    ["pyr-areas-section-sac", "Пирамида по S(бок) и S(полн): площадь SAC", t14PyrAreasSectionSAC],
  ]],
  ["Объём", [
    ["pyr-median-mid-volume", "Высота из середины медианы CM: объём", t14PyrMedianMidVolume],
    ["cube-centers-pyramid", "Куб: B₁KLM — правильная пирамида", t14CubeCentersPyramidVolume],
    ["cube-plane-bigger-part", "Куб рассечён плоскостью ∥ BD₁: больший кусок", t14CubePlaneBiggerPart],
    ["pyr3-section-volume-c", "Пирамида с вершиной C и основанием-сечением", t14Pyr3SectionVolumeC],
    ["prism-right-tetra-volume", "Прямая призма с прямым углом: объём AA₁C₁B", t14PrismRightTetraVolume],
    ["prism-rhomb-volume", "Ромб в основании, AB = AA₁: объём призмы", t14PrismRhombVolume],
    ["pyr-right-base-volume", "PABC: высота в C, PA ⊥ BC — объём", t14PyrRightBaseVolume],
    ["prism-gamma-volume-a1", "γ ⊥ A₁C: объём пирамиды с вершиной A₁", t14PrismGammaVolumeA1],
    ["pyr-trap-volume-pkbc", "Трапеция в основании, две грани ⊥ основанию: объём PKBC", t14PyrTrapVolumePKBC],
    ["pyr-apothem-section", "γ ∥ BC через точку апофемы: объём отсечённой пирамиды", t14PyrApothemSectionVolume],
    ["prism3-tetra-volume", "MNB₁ делит призму пополам: объём MNBB₁", t14Prism3TetraVolume],
    ["cube-gamma-volume-ratio", "γ делит боковую поверхность 2:1 — отношение объёмов", t14CubeGammaVolumeRatio],
  ]],
  ["Угол между прямыми", [
    ["cube-rhombus-angle-de", "Куб: сечение DEB₁ — ромб, угол DE и BD₁", t14CubeRhombusAngleDE],
    ["cylinder-angle-bb1ac1", "Цилиндр: угол между BB₁ и AC₁", t14CylinderAngleBB1AC1],
    ["box-centers-cotangent", "Центры граней: котангенс угла MD₁ и KL", t14BoxCentersCotangent],
    ["pyr-rect-angle-sc-bd", "Прямоугольник в основании: угол SC и BD", t14PyrRectAngleSCBD],
  ]],
  ["Угол между прямой и плоскостью", [
    ["pyr-rect-angle-sc-asb", "Угол между SC и плоскостью ASB", t14PyrRectAngleSCplane],
    ["cone-angle-sa-sbc", "Конус: угол между SA и плоскостью SBC", t14ConeAngleSAplane],
    ["prism-trap-angle", "Трапеция с углом 60°: угол BB₁ и CA₁D₁", t14PrismTrapAngle],
  ]],
  ["Угол между плоскостями", [
    ["box-rhomb-plane-angle", "Сечение через BD₁ ∥ AC — ромб: угол с BCC₁", t14BoxRhombPlaneAngle],
    ["box-eft-angle", "Плоскость EFT через D₁: угол с BB₁C₁", t14BoxEFTAngle],
    ["box-dihedral-a1db", "Угол между ABC и A₁DB", t14BoxDihedralA1DB],
    ["prism4-plane-nn-angle", "α ∥ KM делит NN₁ пополам: угол с основанием", t14Prism4PlaneNNangle],
    ["prism-perp-plane-cos", "Плоскость через D ⊥ BD₁: косинус угла с основанием", t14PrismPerpPlaneCos],
    ["cube-plane-tilt-angle", "Куб: наклон плоскости ∥ BD₁ к грани BB₁C₁C", t14CubePlaneTiltAngle],
    ["cube-alpha-bd-angle", "Куб: α ∥ BD через K и середину C₁D₁", t14CubeAlphaBDAngle],
    ["prism-alpha-ac-angle", "Призма: α ∥ AC через середину AB и точку на DD₁", t14PrismAlphaACAngle],
    ["cube-two-planes-angle", "Куб: угол между AD₁C₁ и A₁D₁C", t14CubeTwoPlanesAngle],
    ["prism6-tangent-angle", "Правильная 6-уг. призма: тангенс угла ABC и DB₁F₁", t14Prism6TangentAngle],
  ]],
  ["Расстояние от точки до плоскости", [
    ["pyr3-plane-dist-a", "α ⊃ MN ⊥ основанию: расстояние от A", t14Pyr3PlaneDistA],
    ["cube-a1pq-distance", "Куб: расстояние от C₁ до плоскости A₁PQ", t14CubeA1PQDistance],
    ["cube-apq-distance-c", "Куб: расстояние от C до плоскости APQ", t14CubeAPQDistanceC],
    ["cube-dist-mid-plane", "Куб: от середины AA₁ до плоскости BC₁D", t14CubeDistMidToPlane],
    ["prism4-diag60-dist", "Диагонали под 60°: расстояние от A₁ до BMD", t14Prism4Diag60Dist],
    ["prism-gamma-dist-b", "γ ⊥ A₁C: расстояние от B", t14PrismGammaDistB],
    ["pyr3-parallel-plane-dist", "MNK ∥ DBC: расстояние от K до DBC", t14Pyr3ParallelPlaneDist],
    ["pyr4-parallel-plane-dist", "MNK ∥ SBC: расстояние от M до SBC", t14Pyr4ParallelPlaneDist],
    ["pyr-rect-dist-sbc", "Прямоугольник в основании: расстояние от A до SBC", t14PyrRectDistToSBC],
  ]],
  ["Расстояние между прямыми", [
    ["cube-dist-ac-bd1", "Куб: AC и BD₁", t14CubeDistACBD1],
    ["prism-rhomb-dist-diag", "Ромб в основании: B₁D₁ и AC₁", t14PrismRhombDistDiag],
    ["prism-rhomb120-dist", "Ромб 120°, грани — квадраты: A₁C и BD", t14PrismRhomb120Dist],
    ["cube-dist-ac-bc1", "Куб: AC и BC₁", t14CubeDistACBC1],
  ]],
  ["Отрезок и отношение отрезков", [
    ["pyr-reflect-trap-midline", "Равнобокая трапеция S₁LM: средняя линия", t14PyrRefletTrapMidline],
    ["cube-regular-tetra-ap", "Куб: PBDC₁ — правильный тетраэдр, длина AP", t14CubeRegularTetraAP],
    ["pyr-centroid-sn", "AM = AD, N — середина AM: длина SN", t14PyrCentroidSN],
    ["pyr6-ratio-sf", "Правильная 6-уг. пирамида: отношение на ребре SF", t14Pyr6RatioSF],
    ["prism-btc1-segment", "Плоскость BTC₁ делит MB₁: меньшая часть", t14PrismBTC1Segment],
    ["pyr-tangent-height", "Дан тангенс угла между DM и AL: высота пирамиды", t14PyrTangentHeight],
  ]],
  ["Поверхность тела вращения", [
    ["pyr-circum-cone-lateral", "Конус на описанной окружности: боковая поверхность", t14PyrCircumConeLateral],
    ["cylinder-lateral-45", "Цилиндр, ∠ACB = 45°: боковая поверхность", t14CylinderLateral45],
  ]],
]

export const GEN14 = META14.flatMap(([, skins]) => skins.map(([, , fn]) => fn))
