// Генераторы ЕГЭ математика (ПРОФИЛЬНЫЙ уровень) — предмет «ЕГЭ Профиль».
//
// Эталон типажей — открытый банк ФИПИ (fipi_bank_ege_prof/tasks.json). Каждый шаблон
// воспроизводит реальный тип задания банка (та же формулировка, свои числа); правильный
// ответ считается кодом (или РЕШАЕТСЯ из показанных чисел), поэтому гарантированно верен.
//
// НУМЕРАЦИЯ — по проекту КИМ-2027 (перенумеровано 29.08.2026): старые 6→7,
// 7→8, 8→9, 9→10, 10→11, 11→12, 13→14, 15→16, 16→13 (экономическая
// теперь часть 1), 18→19, 19→20. Аналитическое исследование функции (старое
// №12) в №9 не входит — снято 31.08.2026. Имена функций (t06*, t07*…), gen_key и файлы
// модулей хранят СТАРЫЕ номера: на gen_key держится аналитика task_attempts,
// а эталоны в fipi_bank_ege_prof лежат под старыми именами.
//
// Формат объекта генератора: { condition_text, answer }.
// Мат-токены: дробь ⟦f:n:d⟧, корень ⟦r:x⟧, индекс ⟦b:x⟧, надстрочник ⟦sup:x⟧ — разворачивает
// renderTaskMath(). Юникод-степени ² ³ — через sup().
//
// №14 (развёрнутое, часть 2: а) решить уравнение, б) корни на отрезке) — в отдельном модуле
// taskGeneratorsEgeProf13.js (свой решатель тригонометрии + численная самопроверка).

import { GEN13, META13 } from "./taskGeneratorsEgeProf13"
// №16 (экономическая задача) — свой симулятор кредита/вклада + verify16.
import { GEN16, META16 } from "./taskGeneratorsEgeProf16"
// №15 («Решите неравенство») — свой движок метода интервалов + verify15 в отдельном модуле
import { GEN15, META15 } from "./taskGeneratorsEgeProf15"
// №18 (задачи с параметром, часть 2) — отдельный файл: конструкция от ответа + точный
// решатель (рациональная арифметика + Штурм) в verify18.
import { GEN18, META18 } from "./taskGeneratorsEgeProf18"
// №19 (теория чисел, часть 2) — отдельный файл: конструкция от ответа + независимый перебор.
import { GEN19, META19 } from "./taskGeneratorsEgeProf19"
// №9 («задачи с прикладным содержанием») — отдельный модуль: буквальный вычислитель
// каждой формулы + verify09 (подстановка ответа, соседи по сетке, скан экстремума).
import { GEN9, META9 } from "./taskGeneratorsEgeProf9"

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i);[a[i], a[j]] = [a[j], a[i]] } return a }
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b] } return a || 1 }
const clean = (x) => Math.round(x * 1e9) / 1e9

// Мат-токены.
const fT = (n, d) => `⟦f:${n}:${d}⟧`
const rT = (x) => `⟦r:${x}⟧`
const subB = (x) => `⟦b:${x}⟧`
const supT = (x) => `⟦sup:${x}⟧`
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻" }
const sup = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("")
// Юникод-подстрочные цифры — для индекса основания ВНУТРИ дроби (⟦b⟧ рвёт захват ⟦f⟧).
const SUBD = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" }
const subU = (n) => String(n).split("").map((c) => SUBD[c] ?? c).join("")

// Число «по-русски»: десятичная запятая, минус U+2212, без хвостовых нулей.
function ru(x) {
  if (typeof x !== "number") return String(x)
  let s = Number.isInteger(x) ? String(x) : String(clean(x))
  return s.replace(".", ",").replace(/^-/, "−")
}
// Вероятность в формате ФИПИ: десятичная через запятую.
const prob = (fav, total) => ru(clean(fav / total))
// Терминальная десятичная (знаменатель = 2^a·5^b)?
function isTerm(n, d) { d = Math.abs(d / gcd(n, d)); while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1 }
// Число знаков после запятой у дроби n/d (Infinity, если бесконечная). Ответ части 1
// не должен быть длинным хвостом вроде 0,454545455 или 0,234375.
function decLen(n, d) { const g = gcd(n, d); d = Math.abs(d / g); let a = 0, b = 0; while (d % 2 === 0) { d /= 2; a++ } while (d % 5 === 0) { d /= 5; b++ } return d === 1 ? Math.max(a, b) : Infinity }
// Знак «+n» / «−n» для константы в выражении (n со своим знаком).
const signed = (n) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`)
// ============================================================================
// №2 — ВЕКТОРЫ (скалярное произведение, длина линейной комбинации)
// ============================================================================

// Скалярное произведение по координатам: a(x1;y1)·b(x2;y2)=x1x2+y1y2.
function t02DotCoord() {
  const x1 = randInt(-13, 14), y1 = randInt(-9, 9)
  const x2 = randInt(-9, 14), y2 = randInt(-9, 9)
  const ans = x1 * x2 + y1 * y2
  return {
    condition_text: `Даны векторы a(${ru(x1)}; ${ru(y1)}) и b(${ru(x2)}; ${ru(y2)}). Найдите скалярное произведение a·b.`,
    answer: ru(ans),
  }
}

// Скалярное произведение по длинам и углу 60°: |a||b|cos60°=|a||b|/2.
function t02DotLenAngle() {
  let p, q
  do { p = randInt(2, 9); q = randInt(2, 9) } while ((p * q) % 2 !== 0)
  return {
    condition_text: `Длины векторов a и b равны ${p} и ${q}, а угол между ними равен 60°. Найдите скалярное произведение a·b.`,
    answer: ru(p * q / 2),
  }
}

// Длина линейной комбинации |a±k·b| — подбираем так, чтобы вышел пифагоров катет.
const TRIPLES = [[3, 4], [5, 12], [8, 15], [7, 24], [20, 21], [9, 40], [12, 35], [28, 45], [33, 56], [16, 63], [48, 55]]
function t02LenCombo() {
  const [lx, ly] = pick(TRIPLES)
  const dx = pick([lx, ly, -lx, -ly]), dy = (Math.abs(dx) === lx ? (dx < 0 ? -ly : ly) : (dx < 0 ? -lx : lx)) * pick([1, -1])
  const k = randInt(2, 6)
  const bx = randInt(-6, 6), by = randInt(-6, 6)
  const plus = Math.random() < 0.5
  // итоговый вектор = (dx,dy); a = итог ∓ k·b (чтобы op дал итог)
  const ax = dx + (plus ? -k * bx : k * bx)
  const ay = dy + (plus ? -k * by : k * by)
  const len = Math.round(Math.hypot(dx, dy))
  const op = plus ? `a+${k}b` : `a−${k}b`
  return {
    condition_text: `Даны векторы a(${ru(ax)}; ${ru(ay)}) и b(${ru(bx)}; ${ru(by)}). Найдите длину вектора ${op}.`,
    answer: ru(len),
  }
}

// Скалярное произведение двух комбинаций: (m1·a+m2·b)·(m3·a+m4·b).
function t02DotOfCombos() {
  const ax = randInt(1, 6), ay = randInt(-4, 5)
  const bx = randInt(1, 6), by = randInt(-6, -1)
  const m1 = 1, m2 = 1, m3 = randInt(2, 7), m4 = -1
  const ux = m1 * ax + m2 * bx, uy = m1 * ay + m2 * by
  const vx = m3 * ax + m4 * bx, vy = m3 * ay + m4 * by
  const ans = ux * vx + uy * vy
  const fmt = (p, q) => `${p === 1 ? "" : p === -1 ? "−" : ru(p)}a${q < 0 ? "−" : "+"}${Math.abs(q) === 1 ? "" : Math.abs(q)}b`
  return {
    condition_text: `Даны векторы a(${ru(ax)}; ${ru(ay)}) и b(${ru(bx)}; ${ru(by)}). Найдите скалярное произведение векторов ${fmt(m1, m2)} и ${fmt(m3, m4)}.`,
    answer: ru(ans),
  }
}

// ── Чертёж векторов на координатной сетке (типаж «прочитать координаты с рисунка») ──
const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

// Стрелка-вектор: линия + треугольный наконечник (пиксельные координаты, y — вниз).
function vecArrow(x1, y1, x2, y2, color, width = 2.2) {
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const h = 10, w = 4.6
  const bx = x2 - h * Math.cos(ang), by = y2 - h * Math.sin(ang)
  const p1 = `${clean(bx - w * Math.sin(ang))},${clean(by + w * Math.cos(ang))}`
  const p2 = `${clean(bx + w * Math.sin(ang))},${clean(by - w * Math.cos(ang))}`
  return `<line x1="${clean(x1)}" y1="${clean(y1)}" x2="${clean(bx)}" y2="${clean(by)}" stroke="${color}" stroke-width="${width}"/>` +
    `<polygon points="${clean(x2)},${clean(y2)} ${p1} ${p2}" fill="${color}"/>`
}

// Подпись вектора (буква + стрелка над ней) у середины, сдвинута ПЕРПЕНДИКУЛЯРНО линии.
// dx,dy — пиксельные дельты вектора (y вниз). Нормаль берём в пиксельных координатах
// (раньше считалась не-перпендикулярно из грид-компонент y-вверх — подпись со своей
// стрелкой ложилась на сам вектор). Прижимаем подпись выше линии (ny<0), тогда стрелка
// над буквой уходит ОТ вектора, а не пересекает его.
function vecLabel(letter, mx, my, dx, dy) {
  const L = Math.hypot(dx, dy) || 1
  const ux = dx / L, uy = dy / L
  let nx = -uy, ny = ux
  if (ny > 1e-6) { nx = -nx; ny = -ny }
  else if (Math.abs(ny) < 1e-6) { nx = -Math.abs(nx) }   // вертикальный вектор — подпись слева
  const off = 17
  const lx = clean(mx + nx * off), ly = clean(my + ny * off), ay = clean(ly - 15)
  return `<text x="${lx}" y="${ly}" ${HALO} font-size="17" font-style="italic" font-weight="bold" fill="#1c1c1e" text-anchor="middle">${letter}</text>` +
    `<line x1="${lx - 5}" y1="${ay}" x2="${lx + 6}" y2="${ay}" stroke="#1c1c1e" stroke-width="1.3"/>` +
    `<polygon points="${lx + 7},${ay} ${lx + 2},${ay - 2.4} ${lx + 2},${ay + 2.4}" fill="#1c1c1e"/>`
}

// Координатная сетка с двумя векторами a и b (целочисленные компоненты).
function vecGridSvg({ ax, ay, bx, by, atx, aty, btx, bty, gx0, gx1, gy0, gy1 }) {
  const cell = 28, ml = 14, mt = 14, mr = 14, mb = 14
  const W = ml + mr + (gx1 - gx0) * cell, H = mt + mb + (gy1 - gy0) * cell
  const X = (u) => ml + (u - gx0) * cell
  const Y = (v) => H - mb - (v - gy0) * cell
  let g = ""
  for (let i = gx0; i <= gx1; i++) g += `<line x1="${X(i)}" y1="${Y(gy0)}" x2="${X(i)}" y2="${Y(gy1)}" stroke="#d7dbe0" stroke-width="1"/>`
  for (let j = gy0; j <= gy1; j++) g += `<line x1="${X(gx0)}" y1="${Y(j)}" x2="${X(gx1)}" y2="${Y(j)}" stroke="#d7dbe0" stroke-width="1"/>`
  // оси через (0,0) со стрелками и подписями x, y
  g += vecArrow(X(gx0), Y(0), X(gx1), Y(0), "#1c1c1e", 1.4)
  g += vecArrow(X(0), Y(gy0), X(0), Y(gy1), "#1c1c1e", 1.4)
  g += `<text x="${X(gx1) - 3}" y="${Y(0) + 17}" ${HALO} font-size="15" font-style="italic" font-weight="bold" fill="#1c1c1e" text-anchor="end">x</text>`
  g += `<text x="${X(0) + 7}" y="${Y(gy1) + 13}" ${HALO} font-size="15" font-style="italic" font-weight="bold" fill="#1c1c1e">y</text>`
  g += `<text x="${X(0) - 5}" y="${Y(0) + 16}" ${HALO} font-size="13" font-weight="bold" fill="#1c1c1e" text-anchor="end">0</text>`
  g += `<text x="${X(1)}" y="${Y(0) + 16}" ${HALO} font-size="12" fill="#1c1c1e" text-anchor="middle">1</text>`
  g += `<text x="${X(0) - 6}" y="${Y(1) + 4}" ${HALO} font-size="12" fill="#1c1c1e" text-anchor="end">1</text>`
  // векторы
  g += vecArrow(X(atx), Y(aty), X(atx + ax), Y(aty + ay), "#1c1c1e")
  g += vecArrow(X(btx), Y(bty), X(btx + bx), Y(bty + by), "#1c1c1e")
  g += vecLabel("a", (X(atx) + X(atx + ax)) / 2, (Y(aty) + Y(aty + ay)) / 2, X(atx + ax) - X(atx), Y(aty + ay) - Y(aty))
  g += vecLabel("b", (X(btx) + X(btx + bx)) / 2, (Y(bty) + Y(bty + by)) / 2, X(btx + bx) - X(btx), Y(bty + by) - Y(bty))
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`
}

// Векторы нарисованы на сетке — прочитать целые координаты и найти длину m·a+n·b.
const VEC_COMBOS = [
  [1, 4, "a+4b"], [1, -4, "a−4b"], [1, 2, "a+2b"], [1, -2, "a−2b"],
  [1, 3, "a+3b"], [1, -3, "a−3b"], [2, 1, "2a+b"], [2, -1, "2a−b"],
]
function t02GraphLenCombo() {
  let m, n, op, ax, ay, bx, by, len, solved = false
  for (let tries = 0; tries < 3000 && !solved; tries++) {
    [m, n, op] = pick(VEC_COMBOS)
    ax = randInt(-4, 4); ay = randInt(-4, 4)
    bx = randInt(-3, 3); by = randInt(-3, 3)
    if ((ax === 0 && ay === 0) || (bx === 0 && by === 0)) continue
    if (ax * by - ay * bx === 0) continue                 // не коллинеарны
    if (Math.hypot(ax, ay) < 2 || Math.hypot(bx, by) < 1.4) continue
    const rx = m * ax + n * bx, ry = m * ay + n * by
    if (rx === 0 && ry === 0) continue
    const L2 = rx * rx + ry * ry, L = Math.round(Math.sqrt(L2))
    if (L * L === L2 && L >= 4 && L <= 60) { len = L; solved = true }
  }
  // страховка: гарантированно согласованный случай (a+4b, r=(4;3), |r|=5)
  if (!solved) { op = "a+4b"; ax = 0; ay = 3; bx = 1; by = 0; len = 5 }
  // хвосты: a в нижне-левой части, b правее — стрелки не накладываются; всё в положительной зоне
  const atx = 1 + Math.max(0, -ax), aty = 1 + Math.max(0, -ay)
  const btx = atx + Math.max(0, ax) + 1 + Math.max(0, -bx), bty = 1 + Math.max(0, -by)
  const xs = [0, atx, atx + ax, btx, btx + bx], ys = [0, aty, aty + ay, bty, bty + by]
  const gx0 = Math.min(...xs) - 1, gx1 = Math.max(...xs) + 1
  const gy0 = Math.min(...ys) - 1, gy1 = Math.max(...ys) + 1
  const svg = vecGridSvg({ ax, ay, bx, by, atx, aty, btx, bty, gx0, gx1, gy0, gy1 })
  return {
    condition_text: `На координатной плоскости изображены векторы a и b, координатами которых являются целые числа. Найдите длину вектора ${op}.`,
    image_url: svgUrl(svg),
    answer: ru(len),
  }
}

// ============================================================================
// №4 — ВЕРОЯТНОСТЬ (простейшие задачи)
// ============================================================================

const COUNTRIES = ["Аргентины", "Бразилии", "Парагвая", "Уругвая", "Германии", "Франции", "Италии", "Испании", "Швеции", "Дании", "Норвегии", "Финляндии", "Чехии", "Словакии", "Австрии", "Польши", "Латвии", "Литвы", "Эстонии"]

// Спортсмен, выступающий первым, — из страны X (4 страны). P = c/total.
function t04ShotPut() {
  const cs = shuffle(COUNTRIES).slice(0, 4)
  let n, total
  do {
    n = [randInt(3, 11), randInt(3, 11), randInt(3, 11), randInt(3, 11)]
    total = n[0] + n[1] + n[2] + n[3]
  } while (![0, 1, 2, 3].some((j) => decLen(n[j], total) <= 4))
  const i = pick([0, 1, 2, 3].filter((j) => decLen(n[j], total) <= 4))
  return {
    condition_text: `В соревнованиях по толканию ядра участвуют спортсмены из четырёх стран: ${n[0]} из ${cs[0]}, ${n[1]} из ${cs[1]}, ${n[2]} из ${cs[2]} и ${n[3]} из ${cs[3]}. Порядок, в котором выступают спортсмены, определяется жребием. Найдите вероятность того, что спортсмен, выступающий первым, окажется из ${cs[i]}.`,
    answer: prob(n[i], total),
  }
}

// Гимнастика: N спортсменок, две группы заданы, «остальные из X». P(первая из остальных).
function t04Gymnastics() {
  const cs = shuffle(COUNTRIES).slice(0, 3)
  let total, a, b, rest
  do {
    total = randInt(20, 55); a = randInt(5, 20); b = randInt(5, 20); rest = total - a - b
  } while (rest < 3 || decLen(rest, total) > 4)
  return {
    condition_text: `В чемпионате по гимнастике участвуют ${total} спортсменок: ${a} из ${cs[0]}, ${b} из ${cs[1]}, остальные — из ${cs[2]}. Порядок, в котором выступают гимнастки, определяется жребием. Найдите вероятность того, что спортсменка, выступающая первой, окажется из ${cs[2]}.`,
    answer: prob(rest, total),
  }
}

// Прыжки в воду: n-й спортсмен из группы. P = c/total.
function t04Diving() {
  const cs = shuffle(COUNTRIES).slice(0, 2)
  const ords = ["четвёртым", "одиннадцатым", "тринадцатым", "двенадцатым", "седьмым", "десятым"]
  let total, c1, c2
  do { total = randInt(20, 75); c1 = randInt(3, 24); c2 = randInt(3, 24) } while (c1 + c2 >= total || decLen(c1, total) > 3)
  const ord = pick(ords)
  return {
    condition_text: `На чемпионате по прыжкам в воду выступают ${total} спортсменов, среди них ${c1} спортсменов из ${cs[0]} и ${c2} спортсменов из ${cs[1]}. Порядок выступлений определяется жеребьёвкой. Найдите вероятность того, что ${ord} будет выступать спортсмен из ${cs[0]}.`,
    answer: prob(c1, total),
  }
}

// Билеты по теме: k из N. P(достанется) или P(не достанется).
const TICKET_THEMES = [["математике", "«Логарифмы»"], ["химии", "«Щёлочи»"], ["географии", "«Страны Африки»"], ["истории", "«Великая Отечественная война»"], ["географии", "«Ресурсообеспеченность»"]]
function t04Tickets() {
  const [subj, theme] = pick(TICKET_THEMES)
  let n, k; do { n = randInt(20, 60); k = randInt(3, n - 3) } while (decLen(k, n) > 4)
  const not = Math.random() < 0.5
  const fav = not ? n - k : k
  return {
    condition_text: `В сборнике билетов по ${subj} всего ${n} билетов, в ${k} из них встречается вопрос по теме ${theme}. Найдите вероятность того, что в случайно выбранном на экзамене билете школьнику ${not ? "не достанется" : "достанется"} вопрос по теме ${theme}.`,
    answer: prob(fav, n),
  }
}

// Фломастеры: один синий и один красный из двух. P = b·r / C(n,2).
function t04Markers() {
  let b, r, g, n, c2
  do {
    b = randInt(4, 12); r = randInt(3, 12); g = randInt(6, 12)
    n = b + r + g; c2 = n * (n - 1) / 2
  } while (!isTerm(b * r, c2))
  return {
    condition_text: `В коробке ${b} синих, ${r} красных и ${g} зелёных фломастеров. Случайным образом выбирают два фломастера. Найдите вероятность того, что окажутся выбраны один синий и один красный фломастеры.`,
    answer: prob(b * r, c2),
  }
}

// Дефект / брак: k из N с дефектом. P(без дефекта)=(N−k)/N.
function t04Defect() {
  const kind = Math.random() < 0.5
  if (kind) {
    let n, k; do { n = pick([50, 75, 100, 25]); k = randInt(2, 8) } while (!isTerm(n - k, n))
    return {
      condition_text: `Фабрика выпускает сумки. В среднем ${k} сумки из ${n} имеют скрытые дефекты. Найдите вероятность того, что купленная сумка окажется без скрытых дефектов.`,
      answer: prob(n - k, n),
    }
  }
  let n, k; do { n = pick([2000, 3000, 2500, 1500]); k = randInt(6, 18) } while (!isTerm(n - k, n))
  return {
    condition_text: `В среднем из ${n} садовых насосов, поступивших в продажу, ${k} подтекают. Найдите вероятность того, что один случайно выбранный для контроля насос не подтекает.`,
    answer: prob(n - k, n),
  }
}

// Жребий/вертолёт: выбирают k из n; конкретный участник попадёт. P=k/n.
function t04Lottery() {
  const kind = Math.random() < 0.5
  if (kind) {
    let n, k; do { n = randInt(5, 30); k = randInt(3, n - 1) } while (!isTerm(k, n))
    return {
      condition_text: `В группе туристов ${n} человек. С помощью жребия они выбирают ${ru(k)} человек, которые должны идти в село в магазин за продуктами. Какова вероятность того, что турист Д., входящий в состав группы, пойдёт в магазин?`,
      answer: prob(k, n),
    }
  }
  let n, m; do { n = pick([20, 30, 50, 300]); m = pick([4, 5, 6, 15]) } while (n % m !== 0 || !isTerm(m, n))
  return {
    condition_text: `В группе туристов ${n} человек. Их вертолётом доставляют в труднодоступный район, перевозя по ${m} человек за рейс. Порядок, в котором вертолёт перевозит туристов, случаен. Найдите вероятность того, что турист В., входящий в состав группы, полетит первым рейсом вертолёта.`,
    answer: prob(m, n),
  }
}

// Монета дважды.
function t04CoinTwice() {
  const v = pick([
    ["решка выпадет ровно один раз", 2], ["орёл не выпадет ни разу", 1],
    ["орёл выпадет ровно один раз", 2], ["решка выпадет хотя бы один раз", 3],
    ["орёл выпадет хотя бы один раз", 3],
  ])
  return {
    condition_text: `В случайном эксперименте симметричную монету бросают дважды. Найдите вероятность того, что ${v[0]}.`,
    answer: prob(v[1], 4),
  }
}

// Олимпиада: N участников, первые (k) аудиторий по m, остаток в запасной.
function t04Rooms() {
  const subj = Math.random() < 0.5 ? "математике" : "химии"
  let filled, per, rest, total
  do {
    filled = randInt(2, 3)
    per = pick([110, 120, 100, 90, 80])
    rest = pick([110, 120, 140, 150, 160, 180, 200, 220, 100])
    total = per * filled + rest
  } while (!isTerm(rest, total))
  const word = filled + 1 === 4 ? "четырёх" : "трёх"
  const firstWord = filled === 3 ? "трёх" : "двух"
  return {
    condition_text: `На олимпиаде по ${subj} ${total} участников разместили в ${word} аудиториях. В первых ${firstWord} удалось разместить по ${per} человек, оставшихся перевели в запасную аудиторию в другом корпусе. Найдите вероятность того, что случайно выбранный участник писал олимпиаду в запасной аудитории.`,
    answer: prob(rest, total),
  }
}

// Футбольная монетка: T матчей, событие (не более одного / все / только k-й).
function t04FootballCoin() {
  const team = pick(["«Сапфир»", "«Биолог»", "«Изумруд»", "«Ротор»", "«Статор»"])
  const variants = [
    { t: 3, txt: "начнёт игру с мячом не более одного раза", fav: 4 },
    { t: 3, txt: "начнёт игру с мячом все три раза", fav: 1 },
    { t: 2, txt: "начнёт игру с мячом не больше одного раза", fav: 3 },
  ]
  const v = pick(variants)
  const total = 2 ** v.t
  const nMatch = v.t === 3 ? "три матча" : "два матча"
  return {
    condition_text: `Перед началом футбольного матча судья бросает монетку, чтобы определить, какая из команд начнёт игру с мячом. Команда ${team} играет ${nMatch} с разными командами. Найдите вероятность того, что в этих матчах команда ${team} ${v.txt}.`,
    answer: prob(v.fav, total),
  }
}

// ============================================================================
// №5 — ВЕРОЯТНОСТЬ (сложные задачи)
// ============================================================================

// Три лампы: P(хотя бы одна не перегорит)=1−p³.
function t05Lamps() {
  const p = pick([0.2, 0.4, 0.5, 0.7, 0.8, 0.9])
  return {
    condition_text: `Помещение освещается тремя лампами. Вероятность перегорания каждой лампы в течение года равна ${ru(p)}. Лампы перегорают независимо друг от друга. Найдите вероятность того, что в течение года хотя бы одна лампа не перегорит.`,
    answer: ru(clean(1 - p ** 3)),
  }
}

// Буханка/автобус: P(a<X<b)=P(X<b)+P(X>a)−1.
function t05Between() {
  const kind = Math.random() < 0.5
  const pLess = clean(0.9 + randInt(1, 9) / 100)   // P(<810)
  const pMore = clean(0.8 + randInt(0, 9) / 100)   // P(>790)
  const ans = clean(pLess + pMore - 1)
  if (ans <= 0) return t05Between()
  if (kind) {
    return {
      condition_text: `При выпечке хлеба производится контрольное взвешивание свежей буханки. Известно, что вероятность того, что её масса окажется меньше 810 г, равна ${ru(pLess)}. Вероятность того, что масса буханки окажется больше 790 г, равна ${ru(pMore)}. Найдите вероятность того, что масса буханки окажется больше 790 г, но меньше 810 г.`,
      answer: ru(ans),
    }
  }
  return {
    condition_text: `Из районного центра в деревню ежедневно ходит автобус. Вероятность того, что в понедельник в автобусе окажется меньше 23 пассажиров, равна ${ru(pLess)}. Вероятность того, что окажется меньше 14 пассажиров, равна ${ru(clean(1 - pMore))}. Найдите вероятность того, что число пассажиров будет от 14 до 22 включительно.`,
    answer: ru(ans),
  }
}

// Стрелок, 4 мишени: попадёт в первые k и не в последние (4−k). p^k·(1−p)^(4−k).
function t05Shooter4() {
  const p = pick([0.6, 0.7, 0.8, 0.9])
  const k = pick([1, 2, 3])
  const ans = clean(p ** k * (1 - p) ** (4 - k))
  const firstTxt = k === 1 ? "в первую мишень" : k === 2 ? "в две первые мишени" : "в три первые мишени"
  const lastTxt = k === 1 ? "в три последние" : k === 2 ? "в две последние" : "в последнюю"
  return {
    condition_text: `Стрелок стреляет по одному разу в каждую из четырёх мишеней. Вероятность попадания в мишень при каждом отдельном выстреле равна ${ru(p)}. Найдите вероятность того, что стрелок попадёт ${firstTxt} и не попадёт ${lastTxt}.`,
    answer: ru(ans),
  }
}

// Два автомата кофе: P(каждый закончится)=a, P(оба)=b. P(останется в обоих)=1−2a+b.
function t05Coffee() {
  const a = pick([0.1, 0.2])
  let b; do { b = clean(randInt(3, 18) / 100) } while (b >= a || b <= 0)
  const ans = clean(1 - 2 * a + b)
  return {
    condition_text: `В торговом центре два одинаковых автомата продают кофе. Вероятность того, что к концу дня в первом автомате закончится кофе, равна ${ru(a)}. Вероятность того, что кофе закончится во втором автомате, такая же. Вероятность того, что кофе закончится в двух автоматах, равна ${ru(b)}. Найдите вероятность того, что к концу дня кофе останется в двух автоматах.`,
    answer: ru(ans),
  }
}

// Батарейки: P(забракована)=d·q+(1−d)·r.
function t05Battery() {
  const d = clean(randInt(1, 6) / 100)
  const q = clean(randInt(91, 99) / 100)
  const r = clean(randInt(1, 6) / 100)
  const ans = clean(d * q + (1 - d) * r)
  return {
    condition_text: `Автоматическая линия изготавливает батарейки. Вероятность того, что готовая батарейка неисправна, равна ${ru(d)}. Перед упаковкой каждая батарейка проходит систему контроля качества. Вероятность того, что система забракует неисправную батарейку, равна ${ru(q)}. Вероятность того, что система по ошибке забракует исправную батарейку, равна ${ru(r)}. Найдите вероятность того, что случайно выбранная изготовленная батарейка будет забракована системой контроля.`,
    answer: ru(ans),
  }
}

// Стрелок до поражения, p=0.5: наименьшее n, чтобы 1−0.5^n ≥ thr.
function t05ShooterN() {
  const thr = pick([0.7, 0.8, 0.9, 0.95])
  let n = 1; while (1 - 0.5 ** n < thr - 1e-9) n++
  return {
    condition_text: `Стрелок в тире стреляет по мишени до тех пор, пока не поразит её. Известно, что он попадает в цель с вероятностью 0,5 при каждом отдельном выстреле. Какое наименьшее количество патронов нужно дать стрелку, чтобы он поразил цель с вероятностью не меньше ${ru(thr)}?`,
    answer: ru(n),
  }
}

// Кость дважды, грань e не выпала; P(сумма=S | условие). 25 исходов.
function t05DiceCond() {
  const e = pick([5, 6])
  const allowed = [1, 2, 3, 4, 5, 6].filter((x) => x !== e)
  let S, cnt
  do {
    S = randInt(4, 10)
    cnt = 0
    for (const i of allowed) for (const j of allowed) if (i + j === S) cnt++
  } while (cnt === 0)
  const faceWord = e === 6 ? "шесть очков" : "пять очков"
  return {
    condition_text: `Игральную кость бросили два раза. Известно, что ${faceWord} не выпало ни разу. Найдите при этом условии вероятность события «сумма очков равна ${S}».`,
    answer: prob(cnt, 25),
  }
}

// Экзамен, две несовместные темы: P(одной из двух)=a+b.
function t05TwoThemes() {
  const a = clean(randInt(10, 25) / 100)
  const b = clean(randInt(8, 20) / 100)
  return {
    condition_text: `На экзамене по геометрии школьник должен ответить на один вопрос из списка экзаменационных вопросов. Вероятность того, что это вопрос по теме «Вписанная окружность», равна ${ru(a)}. Вероятность того, что это вопрос по теме «Тригонометрия», равна ${ru(b)}. Вопросов, которые одновременно относятся к этим двум темам, нет. Найдите вероятность того, что на экзамене школьнику достанется вопрос по одной из этих двух тем.`,
    answer: ru(clean(a + b)),
  }
}

// Тестирование: P(>k)=A, P(>k−1)=B; P(ровно k)=B−A.
function t05Exact() {
  const A = clean(randInt(60, 80) / 100)
  let B; do { B = clean(randInt(81, 92) / 100) } while (B <= A)
  return {
    condition_text: `Вероятность того, что на тестировании по математике учащийся А. верно решит больше четырёх задач, равна ${ru(A)}. Вероятность того, что А. верно решит больше трёх задач, равна ${ru(B)}. Найдите вероятность того, что А. верно решит ровно 4 задачи.`,
    answer: ru(clean(B - A)),
  }
}

// ============================================================================
// №6 — ПРОСТЕЙШИЕ УРАВНЕНИЯ
// ============================================================================

// Показательное, свести к общему основанию: base^(cx+q) = base^t (или 1/base^m).
function t06ExpReduce() {
  const b = pick([2, 3, 4, 5, 6, 7])
  const frac = Math.random() < 0.35            // основание 1/b
  const baseSign = frac ? -1 : 1               // (1/b)^E = b^(−E)
  // c — коэффициент при x: 1 → «x+q», −1 → «q−x», 2/3/5 → «kx+q» (эталон 3^(2x−16)=1/81)
  let c, x0, q, e0, bexp
  let guard = 0
  do {
    c = pick([1, 1, -1, -1, 2, 3, 5]); x0 = randInt(-6, 6); q = randInt(-16, 16)
    e0 = c * x0 + q                            // значение показателя при x0
    bexp = baseSign * e0                       // степень основания b в правой части
    guard++
  } while ((bexp === 0 || Math.abs(bexp) > 4 || b ** Math.abs(bexp) > 999 || Math.abs(q) > 6 + 2 * Math.abs(c)) && guard < 400)
  const expr = c === 1
    ? `x${signed(q)}`.replace("+0", "").replace("−0", "")
    : c === -1
      ? `${ru(q)}−x`                              // c=−1 → «q−x» (вид ФИПИ: 2−x, −4−x)
      : `${c}x${signed(q)}`.replace("+0", "").replace("−0", "")
  const baseStr = frac ? `⟦pf:1:${b}⟧` : String(b)   // дробь-основание в степени — в скобках по высоте дроби
  const rhs = bexp > 0 ? String(b ** bexp) : fT(1, b ** -bexp)
  return {
    condition_text: `Найдите корень уравнения ${baseStr}${supT(expr)}=${rhs}.`,
    answer: ru(x0),
  }
}

// Показательное, обе части — степени общего основания.
function t06ExpBothSides() {
  const b = pick([2, 3, 4, 5, 6])
  let sL, qL, sR, cR, x0, guard = 0
  do {
    sL = pick([1, -1]); qL = randInt(-6, 6)
    sR = pick([1, 2, 3]); cR = pick([1, 2, 3])
    // left exponent(base b) = sL·(x+qL);  right = sR·cR·x
    const denom = sL - sR * cR
    if (denom === 0) { guard++; continue }
    x0 = (-sL * qL) / denom
    guard++
  } while ((!Number.isInteger(x0) || Math.abs(x0) > 8 || x0 === 0) && guard < 300)
  if (!Number.isInteger(x0)) return t06ExpBothSides()
  const leftBase = sL === -1 ? `⟦pf:1:${b}⟧` : String(b)   // дробь-основание в степени — в скобках по высоте дроби
  const leftExpr = `x${signed(qL)}`.replace("+0", "").replace("−0", "")
  const rightBaseNum = b ** sR
  const rightExpr = cR === 1 ? "x" : `${cR}x`
  return {
    condition_text: `Найдите корень уравнения ${leftBase}${supT(leftExpr)}=${rightBaseNum}${supT(rightExpr)}.`,
    answer: ru(x0),
  }
}

// log_a(f)=log_a(C), f линейно.
function t06LogEqLog() {
  const a = pick([2, 3, 5, 7])
  const C = randInt(2, 15)
  const flip = Math.random() < 0.4            // f = s − x  вместо  x + s
  let s, x0, arg
  if (flip) { s = randInt(C + 1, C + 12); x0 = s - C; arg = `${s}−x` }
  else { s = randInt(-8, 8); x0 = C - s; arg = `x${signed(s)}`.replace("+0", "") }
  return {
    condition_text: `Найдите корень уравнения log${subB(a)}(${arg})=log${subB(a)}${C}.`,
    answer: ru(x0),
  }
}

// log_a(f)=k → f=a^k.
function t06LogEqNum() {
  const a = pick([2, 3, 4, 5])
  const k = pick([2, 3])
  const val = a ** k
  const flip = Math.random() < 0.4
  let s, x0, arg
  if (flip) { s = randInt(val + 1, val + 15); x0 = s - val; arg = `${s}−x` }
  else { s = randInt(-8, 8); x0 = val - s; arg = `x${signed(s)}`.replace("+0", "") }
  return {
    condition_text: `Найдите корень уравнения log${subB(a)}(${arg})=${k}.`,
    answer: ru(x0),
  }
}

// Дробно-рациональное: 1/(a·x+b)=c.
function t06Rational() {
  let a, b, c, x0
  do {
    a = pick([2, 4, 5, 8, 10]); b = randInt(-9, 9)
    c = pick([2, 4, 5, 10])
    x0 = (1 / c - b) / a
  } while (!Number.isInteger(clean(x0 * 100)) || Math.abs(x0) > 20 || x0 === 0)
  const denom = `${a}x${signed(b)}`.replace("+0", "").replace("−0", "")
  return {
    condition_text: `Найдите корень уравнения ${fT(1, denom)}=${c}.`,
    answer: ru(clean(x0)),
  }
}

// (x+s)ⁿ = ±mⁿ, n нечётное (эталон #7: n=9 и n=3).
function t06Cube() {
  const [n, ms] = pick([[3, [2, 3, 4, 5, 6, 7, 8, 9]], [5, [2, 3, 4, 5]], [7, [2, 3]], [9, [2]]])
  const s = randInt(-9, 9)
  const m = pick(ms)
  const neg = Math.random() < 0.5
  const V = neg ? -(m ** n) : m ** n
  const x0 = -s + (neg ? -m : m)
  return {
    condition_text: `Найдите корень уравнения (x${signed(s)})${sup(n)}=${ru(V)}.`.replace("(x+0)", "(x)"),
    answer: ru(x0),
  }
}

// Квадратный корень: √(a·x+b)=c.
function t06Sqrt() {
  const a = randInt(2, 9) * pick([1, -1])
  const c = randInt(2, 10)
  const x0 = randInt(1, 9)
  const b = c * c - a * x0
  const inner = a < 0 ? `${b}−${Math.abs(a)}x` : `${Math.abs(a)}x${signed(b)}`.replace("+0", "").replace("−0", "")
  return {
    condition_text: `Найдите корень уравнения ${rT(inner)}=${c}.`,
    answer: ru(x0),
  }
}

// Кубический корень: ∛(x+b)=c.
function t06CubeRoot() {
  const c = randInt(2, 4)
  const b = randInt(-6, 6)
  const x0 = c ** 3 - b
  // Индекс степени 3 сидит В КРЮЧКЕ радикала (токен ⟦rn:3:…⟧, как у ФИПИ), а не висит
  // высоким надстрочником слева; сырой юникод ∛ рвёт согласованность и не тянет черту.
  const inner = `x${signed(b)}`.replace("+0", "").replace("−0", "")
  return {
    condition_text: `Найдите корень уравнения ⟦rn:3:${inner}⟧=${c}.`,
    answer: ru(x0),
  }
}

// ── Типажи №6, добавленные по построчному эталону new/ (typages_task06_uravneniya.md) ──

// (p/q)x = −(N r/q): справа СМЕШАННОЕ число с тем же знаменателем (#1).
function t06LinMixed() {
  let p, q, x0, M, whole, rem, guard = 0
  do {
    q = pick([3, 4, 5, 6, 7, 8, 9, 11, 13])
    p = randInt(2, q - 1)
    x0 = randInt(4, 40) * pick([1, -1, -1])     // чаще отрицательный корень, как в ФИПИ
    M = p * Math.abs(x0); whole = Math.floor(M / q); rem = M - whole * q
    guard++
  } while ((gcd(p, q) !== 1 || rem === 0 || whole < 1 || whole > 40) && guard < 500)
  if (gcd(p, q) !== 1 || rem === 0 || whole < 1) return t06LinMixed()
  const sign = x0 < 0 ? "−" : ""
  return {
    condition_text: `Найдите корень уравнения ${fT(p, q)}x = ${sign}${whole}${fT(rem, q)}.`,
    answer: ru(x0),
  }
}

// (ax−b)² = (ax−c)² → ax−b = −(ax−c) → x = (b+c)/(2a)  (#3).
function t06SqEqSq() {
  let a, b, c, x0, guard = 0
  do {
    a = randInt(2, 9); b = randInt(2, 20); c = randInt(2, 20)
    x0 = (b + c) / (2 * a); guard++
  } while ((b === c || decLen(b + c, 2 * a) > 1 || x0 < 0.5 || x0 > 20) && guard < 500)
  if (b === c || decLen(b + c, 2 * a) > 1) return t06SqEqSq()   // b=c дало бы тождество
  return {
    condition_text: `Найдите корень уравнения (${a}x−${b})${sup(2)}=(${a}x−${c})${sup(2)}.`,
    answer: ru(clean(x0)),
  }
}

// (x+a)² = 4a·x → (x−a)² = 0 → x = a  (#5).
function t06SqEqLin() {
  const a = randInt(2, 30)
  return { condition_text: `Найдите корень уравнения (x+${a})${sup(2)}=${4 * a}x.`, answer: ru(a) }
}

// 1/(ax+b) = 1/(cx+d) → ax+b = cx+d  (#8_ДЗ).
function t06RecipRecip() {
  let a, b, c, d, x0, guard = 0
  do {
    a = randInt(2, 9); c = randInt(2, 9); b = randInt(-15, 15); d = randInt(-15, 15)
    x0 = a === c ? NaN : (d - b) / (a - c); guard++
  } while ((!Number.isFinite(x0) || decLen(d - b, a - c) > 1 || Math.abs(x0) > 20
    || x0 === 0 || a * x0 + b === 0) && guard < 600)
  const L = `${a}x${signed(b)}`.replace("+0", "").replace("−0", "")
  const R = `${c}x${signed(d)}`.replace("+0", "").replace("−0", "")
  return {
    condition_text: `Найдите корень уравнения ${fT(1, L)}=${fT(1, R)}.`,
    answer: ru(clean(x0)),
  }
}

// √(b+ax) = x → x² − ax − b = 0; годится только неотрицательный корень  (#15).
function t06SqrtEqX() {
  let x0, a, b, guard = 0
  do { x0 = randInt(3, 15); a = randInt(1, x0 - 1); b = x0 * x0 - a * x0; guard++ }
  while ((b < 2 || b > 220) && guard < 400)
  const inner = `${b}+${a === 1 ? "" : a}x`
  return {
    condition_text: `Решите уравнение ${rT(inner)}=x. Если уравнение имеет более одного корня, укажите меньший из них.`,
    answer: ru(x0),
  }
}

// lg(f) = k → f = 10ᵏ  (#19).
function t06LgEqNum() {
  const k = pick([1, 2, 3]), V = 10 ** k
  if (Math.random() < 0.45) {
    const s = randInt(2, 14), x0 = s - V
    return { condition_text: `Найдите корень уравнения lg(${s}−x)=${k}.`, answer: ru(x0) }
  }
  const s = randInt(-20, 20), x0 = V - s
  return {
    condition_text: `Найдите корень уравнения lg(x${signed(s)})=${k}.`.replace("(x+0)", "(x)"),
    answer: ru(x0),
  }
}

// logₓ N = k → x = ᵏ√N  (#20).
function t06LogBaseX() {
  let m, k, guard = 0
  do { m = randInt(2, 7); k = randInt(2, 6); guard++ } while (m ** k > 4000 && guard < 300)
  return { condition_text: `Решите уравнение log${subB("x")}${m ** k}=${k}.`, answer: ru(m) }
}

// log_{aᵐ}(a^(px+q)) = k → px+q = k·m  (#24).
function t06LogOfPow() {
  let a, m, k, p, q, x0, guard = 0
  do {
    a = pick([2, 3, 5]); m = randInt(2, 4); k = randInt(2, 3)
    p = randInt(2, 6); q = randInt(-10, 10)
    x0 = (k * m - q) / p; guard++
  } while ((a ** m > 300 || decLen(k * m - q, p) > 1 || Math.abs(x0) > 15 || x0 === 0) && guard < 700)
  const inner = `${p}x${signed(q)}`.replace("+0", "").replace("−0", "")
  return {
    condition_text: `Найдите корень уравнения log${subB(a ** m)}${a}⁅${inner}⁆=${k}.`,
    answer: ru(clean(x0)),
  }
}

// log_{x−s} N = 2 → x−s = √N (основание положительно и ≠ 1)  (#25).
function t06LogBaseLin() {
  const r = randInt(2, 12), s = randInt(1, 9)
  return {
    condition_text: `Решите уравнение log${subB(`x−${s}`)}${r * r}=2. Если уравнение имеет более одного корня, укажите меньший из них.`,
    answer: ru(s + r),
  }
}

// (bᵐ)^(x−s) = 1/bᵗ → m(x−s) = −t; ответ дробный  (#28).
function t06ExpSqBase() {
  let b, m, t, s, x0, guard = 0
  do {
    b = pick([2, 3, 5, 6, 7, 10]); m = pick([2, 2, 2, 4]); t = randInt(1, 3)
    s = randInt(2, 12); x0 = s - t / m; guard++
  } while ((b ** m > 1000 || b ** t > 1000 || decLen(t, m) > 2 || t % m === 0) && guard < 500)
  return {
    condition_text: `Найдите корень уравнения ${b ** m}${supT(`x−${s}`)}=${fT(1, b ** t)}.`,
    answer: ru(clean(x0)),
  }
}

// a^(log_{aᵏ}(px+q)) = m → (px+q)^(1/k) = m → px+q = mᵏ  (#30, #31).
function t06PowLog() {
  let a, k, m, p, q, V, x0, guard = 0
  do {
    a = pick([2, 3, 5]); k = pick([2, 3]); m = randInt(2, 9)
    p = randInt(2, 6); q = randInt(-12, 12)
    V = m ** k; x0 = (V - q) / p; guard++
  } while ((a ** k > 130 || V > 400 || decLen(V - q, p) > 1 || x0 <= 0 || x0 > 60) && guard < 800)
  const inner = `${p}x${signed(q)}`.replace("+0", "").replace("−0", "")
  return {
    condition_text: `Найдите корень уравнения ${a}⁅log${subB(a ** k)}(${inner})⁆=${m}.`,
    answer: ru(clean(x0)),
  }
}

// ============================================================================
// №10 — ТЕКСТОВЫЕ ЗАДАЧИ (движение, работа, смеси)
// ============================================================================
const num2word = { 1: "один", 2: "два", 3: "три", 4: "четыре", 5: "пять", 6: "шесть", 7: "семь", 8: "восемь" }
function hourWord(n) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return "час"; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "часа"; return "часов" }

// Теплоход по течению и обратно, стоянка — найти скорость в неподвижной воде.
function t10SteamboatSpeed() {
  const w = randInt(1, 4), v = randInt(w + 3, 27), q = randInt(1, 3)
  const d = (v * v - w * w) * q, s = randInt(1, 6), T = 2 * v * q + s
  return {
    condition_text: `Теплоход проходит по течению реки до пункта назначения ${d} км и после стоянки возвращается в пункт отправления. Найдите скорость теплохода в неподвижной воде, если скорость течения равна ${w} км/ч, стоянка длится ${s} ${hourWord(s)}, а в пункт отправления теплоход возвращается через ${T} ${hourWord(T)}. Ответ дайте в км/ч.`,
    answer: ru(v),
  }
}
// Тот же сюжет — найти скорость течения.
function t10SteamboatCurrent() {
  const w = randInt(1, 4), v = randInt(w + 3, 27), q = randInt(1, 3)
  const d = (v * v - w * w) * q, s = randInt(1, 6), T = 2 * v * q + s
  return {
    condition_text: `Теплоход проходит по течению реки до пункта назначения ${d} км и после стоянки возвращается в пункт отправления. Найдите скорость течения, если скорость теплохода в неподвижной воде равна ${v} км/ч, стоянка длится ${s} ${hourWord(s)}, а в пункт отправления теплоход возвращается через ${T} ${hourWord(T)}. Ответ дайте в км/ч.`,
    answer: ru(w),
  }
}
// Теплоход туда-обратно — сколько км за весь рейс (2·d).
function t10SteamboatDist() {
  const w = randInt(1, 4), v = randInt(w + 5, 30), q = randInt(1, 2)
  const d = (v * v - w * w) * q, s = randInt(1, 6), T = 2 * v * q + s
  return {
    condition_text: `Теплоход, скорость которого в неподвижной воде равна ${v} км/ч, проходит некоторое расстояние по реке и после стоянки возвращается в исходный пункт. Скорость течения равна ${w} км/ч, стоянка длится ${s} ${hourWord(s)}, а в исходный пункт теплоход возвращается через ${T} ${hourWord(T)} после отправления из него. Сколько километров проходит теплоход за весь рейс?`,
    answer: ru(2 * d),
  }
}
// Средняя скорость по участкам ВРЕМЕНИ.
function t10AvgTime() {
  let v1, v2, v3, t2, t3, sum, dist
  do {
    v1 = randInt(9, 24) * 5; v2 = randInt(8, 22) * 5; v3 = randInt(8, 22) * 5
    t2 = randInt(2, 3); t3 = randInt(2, 3)
    dist = v1 * 1 + v2 * t2 + v3 * t3; sum = 1 + t2 + t3
  } while (dist % sum !== 0)
  return {
    condition_text: `Первый час автомобиль ехал со скоростью ${v1} км/ч, следующие ${num2word[t2]} ${hourWord(t2)} — со скоростью ${v2} км/ч, а затем ${num2word[t3]} ${hourWord(t3)} — со скоростью ${v3} км/ч. Найдите среднюю скорость автомобиля на протяжении всего пути. Ответ дайте в км/ч.`,
    answer: ru(dist / sum),
  }
}
// Средняя скорость по участкам РАССТОЯНИЯ.
function t10AvgDist() {
  let v = [60, 90, 100, 120, 80, 150], d, t, sum, tt
  let g = 0
  do {
    const a = shuffle(v).slice(0, 3)
    d = a.map((vi) => vi * randInt(1, 4))
    tt = d.map((di, i) => di / a[i])
    sum = tt.reduce((x, y) => x + y, 0)
    t = d.reduce((x, y) => x + y, 0)
    g++
    if (Number.isInteger(t / sum) && t / sum > 0) return {
      condition_text: `Первые ${d[0]} км автомобиль ехал со скоростью ${a[0]} км/ч, следующие ${d[1]} км — со скоростью ${a[1]} км/ч, а затем ${d[2]} км — со скоростью ${a[2]} км/ч. Найдите среднюю скорость автомобиля на протяжении всего пути. Ответ дайте в км/ч.`,
      answer: ru(t / sum),
    }
  } while (g < 400)
  return t10AvgTime()
}
// Два велосипедиста: D=u(u+k), разница k — найти первого (u+k) или второго (u).
function t10TwoCyclists() {
  const k = randInt(2, 9), u = randInt(6, 22), D = u * (u + k)
  const first = Math.random() < 0.5
  return {
    condition_text: `Два велосипедиста одновременно отправились в ${D}-километровый пробег. Первый ехал со скоростью на ${k} км/ч большей, чем скорость второго, и прибыл к финишу на ${k} ${hourWord(k)} раньше второго. Найдите скорость велосипедиста, прибывшего к финишу ${first ? "первым" : "вторым"}. Ответ дайте в км/ч.`,
    answer: ru(first ? u + k : u),
  }
}
// Баржа: обратно на 1 км/ч больше, стоянка s, время туда=время обратно.
function t10Barge() {
  const v = randInt(6, 24), s = randInt(1, 5), d = s * v * (v + 1)
  return {
    condition_text: `Пристани A и B расположены на озере, расстояние между ними равно ${d} км. Баржа отправилась с постоянной скоростью из A в B. На следующий день после прибытия она отправилась обратно со скоростью на 1 км/ч больше прежней, сделав по пути остановку на ${s} ${hourWord(s)}. В результате она затратила на обратный путь столько же времени, сколько на путь из A в B. Найдите скорость баржи на пути из A в B. Ответ дайте в км/ч.`,
    answer: ru(v),
  }
}
// Моторная лодка против течения и обратно, разница времени — найти течение.
function t10BoatCurrent() {
  const w = randInt(1, 4), v = randInt(w + 4, 16), q = randInt(1, 2)
  const d = (v * v - w * w) * q, delta = 2 * w * q
  return {
    condition_text: `Моторная лодка прошла против течения реки ${d} км и вернулась в пункт отправления, затратив на обратный путь на ${delta} ${hourWord(delta)} меньше. Найдите скорость течения, если скорость лодки в неподвижной воде равна ${v} км/ч. Ответ дайте в км/ч.`,
    answer: ru(w),
  }
}
// Тот же сюжет — найти скорость лодки в неподвижной воде.
function t10BoatSpeed() {
  const w = randInt(1, 3), v = randInt(w + 4, 16), q = randInt(1, 2)
  const d = (v * v - w * w) * q, delta = 2 * w * q
  return {
    condition_text: `Моторная лодка прошла против течения реки ${d} км и вернулась в пункт отправления, затратив на обратный путь на ${delta} ${hourWord(delta)} меньше. Найдите скорость лодки в неподвижной воде, если скорость течения равна ${w} км/ч. Ответ дайте в км/ч.`,
    answer: ru(v),
  }
}
// Встречное движение: второй выехал на 1 ч позже, встреча на заданном расстоянии.
function t10Meeting() {
  const v1 = randInt(40, 90), t = randInt(2, 5), v2 = randInt(40, 90)
  const meetA = v1 * t, D = meetA + v2 * (t - 1)
  return {
    condition_text: `Расстояние между городами A и B равно ${D} км. Из города A в город B выехал первый автомобиль, а через час после этого навстречу ему из города B выехал со скоростью ${v2} км/ч второй автомобиль. Найдите скорость первого автомобиля, если автомобили встретились на расстоянии ${meetA} км от города A. Ответ дайте в км/ч.`,
    answer: ru(v1),
  }
}
// Два теплохода из A в B: второй через t ч, на k км/ч больше, прибыли одновременно.
function t10TwoBoats() {
  const v = randInt(10, 25), k = randInt(2, 5), t = k, D = v * (v + k)
  const first = Math.random() < 0.5
  return {
    condition_text: `От пристани A к пристани B, расстояние между которыми равно ${D} км, отправился с постоянной скоростью первый теплоход, а через ${t} ${hourWord(t)} после этого следом за ним со скоростью на ${k} км/ч больше отправился второй. Найдите скорость ${first ? "первого" : "второго"} теплохода, если в пункт B оба теплохода прибыли одновременно. Ответ дайте в км/ч.`,
    answer: ru(first ? v : v + k),
  }
}
// Сплавы: два сплава меди, масса одного больше на m, третий заданный % — найти массу третьего.
function t10Alloy() {
  let p1, p2, p3, m, x, third, g = 0
  do {
    p1 = pick([60, 40, 45, 55, 30]); p2 = pick([10, 25, 20, 15])
    p3 = randInt(Math.min(p1, p2) + 3, Math.max(p1, p2) - 3)
    m = randInt(1, 12) * 10
    // масса первого = x, второго = x+m (второй больше). медь: p1·x+p2·(x+m)=p3·(2x+m)
    // x·(p1+p2−2p3)=m·(p3−p2) → x = m(p3−p2)/(p1+p2−2p3)
    const den = p1 + p2 - 2 * p3
    if (den === 0) { g++; continue }
    x = m * (p3 - p2) / den
    third = 2 * x + m
    g++
  } while ((!Number.isInteger(x) || x <= 0 || third <= 0 || !Number.isInteger(third)) && g < 400)
  if (!Number.isInteger(third) || third <= 0) { p1 = 60; p2 = 10; p3 = 20; m = 90; third = 150 }
  return {
    condition_text: `Имеется два сплава. Первый сплав содержит ${p1} % меди, второй — ${p2} % меди. Масса второго сплава больше массы первого на ${m} кг. Из этих двух сплавов получили третий сплав, содержащий ${p3} % меди. Найдите массу третьего сплава. Ответ дайте в килограммах.`,
    answer: ru(third),
  }
}
// Рабочие: заказ N деталей, первый на t ч быстрее, изготавливает на k больше в час.
function t10Workers() {
  const k = randInt(2, 9), r = randInt(6, 22), N = r * (r + k), t = k
  const first = Math.random() < 0.5
  return {
    condition_text: `Заказ на изготовление ${N} деталей первый рабочий выполняет на ${t} ${hourWord(t)} быстрее, чем второй. Сколько деталей за час изготавливает ${first ? "первый" : "второй"} рабочий, если известно, что ${first ? "он" : "первый"} за час изготавливает на ${k} ${plurDet(k)} больше${first ? " второго" : ""}?`,
    answer: ru(first ? r + k : r),
  }
}
function plurDet(n) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return "деталь"; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "детали"; return "деталей" }
// Трубы: первая на k л/мин меньше, резервуар V, заполняет на k мин быстрее/дольше.
function t10Pipes() {
  const k = randInt(2, 8), r = randInt(4, 20), V = r * (r + k)
  const askSecond = Math.random() < 0.5
  return {
    condition_text: `Первая труба пропускает на ${k} ${plurL(k)} воды в минуту меньше, чем вторая. Сколько литров воды в минуту пропускает ${askSecond ? "вторая" : "первая"} труба, если резервуар объёмом ${V} ${plurL(V)} она заполняет на ${k} ${minWord(k)} ${askSecond ? "быстрее, чем первая" : "дольше, чем вторая"} труба?`,
    answer: ru(askSecond ? r + k : r),
  }
}
function plurL(n) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return "литр"; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "литра"; return "литров" }
function minWord(n) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return "минуту"; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "минуты"; return "минут" }
// Совместная работа двух мастеров: вместе за ab/(a+b).
function t10JointWork() {
  let a, b, g = 0
  do { a = randInt(12, 60); b = randInt(12, 60) } while ((a === b || (a * b) % (a + b) !== 0) && ++g < 400)
  if ((a * b) % (a + b) !== 0) { a = 40; b = 24 }
  return {
    condition_text: `Один мастер может выполнить заказ за ${a} ${hourWord(a)}, а другой — за ${b} ${hourWord(b)}. За сколько часов выполнят этот заказ оба мастера, работая вместе?`,
    answer: ru(a * b / (a + b)),
  }
}
// Прополка грядки: вместе за t, одна за b, найти вторую.
function t10Weed() {
  const names = shuffle([["Катя", "Настя"], ["Юля", "Уля"], ["Аня", "Таня"]])[0]
  let tab, b, g = 0
  do { tab = randInt(12, 30); b = randInt(tab + 6, 130) } while ((tab * b) % (b - tab) !== 0 && ++g < 400)
  if ((tab * b) % (b - tab) !== 0) { tab = 24; b = 42 }
  return {
    condition_text: `${names[0]} и ${names[1]}, работая вместе, пропалывают грядку за ${tab} ${minWord(tab)}, а одна ${names[1]} — за ${b} ${minWord(b)}. За сколько минут пропалывает эту грядку одна ${names[0]}?`,
    answer: ru(tab * b / (b - tab)),
  }
}
// Поезда встречные — найти длину скорого по времени прохождения мимо пассажирского.
function t10TrainLength() {
  let v1, v2, len2, tau, rel, len1, g = 0
  do {
    v1 = randInt(60, 100); v2 = randInt(30, 55); len2 = randInt(15, 40) * 10
    tau = pick([20, 30, 36, 40, 45])
    rel = (v1 + v2) * 1000 / 3600
    len1 = rel * tau - len2
    g++
  } while ((!Number.isInteger(len1) || len1 <= 0) && g < 500)
  if (!Number.isInteger(len1) || len1 <= 0) { v1 = 85; v2 = 35; len2 = 250; tau = 30; len1 = 750 }
  return {
    condition_text: `По двум параллельным железнодорожным путям навстречу друг другу следуют скорый и пассажирский поезда, скорости которых равны соответственно ${v1} км/ч и ${v2} км/ч. Длина пассажирского поезда равна ${len2} метрам. Найдите длину скорого поезда, если время, за которое он прошёл мимо пассажирского, равно ${tau} секундам. Ответ дайте в метрах.`,
    answer: ru(len1),
  }
}

// №9 (прикладные задачи) — в отдельном модуле taskGeneratorsEgeProf9.js:
// 71 скин на все 142 строки эталона + verify09 (проверка ответа по букве условия).

// СНЯТО (31.08.2026): исследование функции аналитически (точка экстремума и
// наибольшее/наименьшее значение — бывшее №12) из банка убрано по решению
// владельца: в №9 КИМ-2027 остаётся только производная по ГРАФИКУ (бывшее №8).
// Генераторы t12* (26 типажей) удалены вместе со своими помощниками; если
// задание вернётся в экзамен, брать их из истории git этого файла.

// ============================================================================
// №7 — ВЫЧИСЛЕНИЯ И ПРЕОБРАЗОВАНИЯ (степени, корни, логарифмы, тригонометрия)
// Реализованы чистые алгебраические типажи; тригонометрия с приведением углов — отложена.
// ============================================================================

// (B^a)^b : (C^c)^d — всё сводится к простому основанию p, ответ = p^diff.
function t07PowPowDiv() {
  const p = pick([2, 3])
  const pows = p === 2 ? [[2, 1], [4, 2], [8, 3], [16, 4], [64, 6]] : [[3, 1], [9, 2], [27, 3], [81, 4]]
  const nested = Math.random() < 0.5
  let base1, k1, base2, k2, a, b, c, d, e, lExp, rExp, diff, g = 0
  do {
    [base1, k1] = pick(pows);[base2, k2] = pick(pows)
    a = randInt(2, 16); b = randInt(2, 8)
    lExp = k1 * a * b                              // показатель ЛЕВОЙ части по основанию p
    if (nested) { c = randInt(2, 10); d = randInt(2, 12); rExp = k2 * c * d }
    else { e = randInt(2, 80); rExp = k2 * e }     // ПРАВАЯ: base2^e = p^(k2·e)
    diff = lExp - rExp
    g++
  } while ((diff < 1 || diff > 5 || p ** diff > 3000) && g < 600)
  if (diff < 1 || diff > 5) return t07PowPowDiv()      // цикл вышел по счётчику — пересобрать
  const rhs = nested ? `(${base2}${sup(c)})${sup(d)}` : `${base2}${sup(e)}`
  return {
    condition_text: `Найдите значение выражения ${fT(`(${base1}${sup(a)})${sup(b)}`, rhs)}.`,
    answer: ru(p ** diff),
  }
}
// B^p·(B^m)^q, показатели — десятичные; сумма даёт целую степень.
function t07PowFracExp() {
  const B = pick([2, 3, 5])
  const m = pick([2, 3])
  const T = pick([2, 3])
  let q, pexp, g = 0
  do { q = clean(randInt(1, 99) / 100); pexp = clean(T - m * q); g++ } while ((pexp <= 0 || !Number.isInteger(clean(pexp * 100))) && g < 200)
  return {
    condition_text: `Найдите значение выражения ${B}${supT(ru(pexp))}·${B ** m}${supT(ru(q))}.`,
    answer: ru(B ** T),
  }
}
// ((k√A)²)/D = k²A/D.
function t07SqCoefRoot() {
  let k, A, D, g = 0
  do { k = randInt(2, 6); A = pick([2, 3, 5, 6, 7, 8, 10]); D = randInt(2, 12) } while ((k * k * A) % D !== 0 && ++g < 300)
  if ((k * k * A) % D !== 0) { k = 5; A = 6; D = 10 }
  return {
    condition_text: `Найдите значение выражения ${fT(`(${k}√{${A}})${sup(2)}`, D)}.`,
    answer: ru(k * k * A / D),
  }
}
// (√A−√B)·√c, где A=m²c, B=n²c → c(m−n).
function t07DistribRoot() {
  const c = pick([2, 3, 5, 6, 7]), m = randInt(3, 7), n = randInt(1, m - 1)
  const A = m * m * c, B = n * n * c
  return {
    condition_text: `Найдите значение выражения (${rT(A)}−${rT(B)})·${rT(c)}.`,
    answer: ru(c * (m - n)),
  }
}
// log_b x + log_b y = log_b(xy)=k, произведение = b^k.
function t07LogSum() {
  const b = pick([2, 3, 5]), k = randInt(2, 6)
  const prod = b ** k
  let y, x, g = 0
  do { y = pick([5, 10, 8, 4, 2, 25, 6]); x = clean(prod / y); g++ } while ((x <= 0 || !isTerm(prod, y) || x === 1 || y === 1) && g < 200)
  if (x <= 0 || !isTerm(prod, y)) { y = 10; x = clean(prod / 10) }
  return {
    condition_text: `Найдите значение выражения log${subB(b)}${ru(x)}+log${subB(b)}${ru(y)}.`,
    answer: ru(k),
  }
}
// log_b x − log_b y = log_b(x/y)=k, x=y·b^k.
function t07LogDiff() {
  const b = pick([2, 3, 5]), k = randInt(2, 4)
  const y = pick([2, 3, 4, 5, 6, 7])
  const x = y * b ** k
  return {
    condition_text: `Найдите значение выражения log${subB(b)}${x}−log${subB(b)}${y}.`,
    answer: ru(k),
  }
}
// (log_c a)/(log_c b) = log_b a = k, a=b^k.
function t07LogRatio() {
  const c = pick([7, 3, 9, 6, 5]), b = pick([2, 3, 5]), k = randInt(2, 5)
  const a = b ** k
  return {
    condition_text: `Найдите значение выражения ${fT(`log${subU(c)}${a}`, `log${subU(c)}${b}`)}.`,
    answer: ru(k),
  }
}
// k·cos2α по sinα или cosα: cos2α=1−2sin²α=2cos²α−1.
function t07TrigDouble() {
  const k = pick([3, 6])
  const useSin = Math.random() < 0.5
  const val = pick([0.2, 0.4, 0.6, 0.8]) * pick([1, -1])
  const cos2 = useSin ? clean(1 - 2 * val * val) : clean(2 * val * val - 1)
  return {
    condition_text: `Найдите значение выражения ${k}cos2α, если ${useSin ? "sin" : "cos"}α=${ru(val)}.`,
    answer: ru(clean(k * cos2)),
  }
}

// ── Типажи №7 по построчному эталону new/ (typages_task07_vychisleniya.md) ───
// Маркеры, которые МОЖНО класть внутрь ⟦f⟧ (нет «:» и «⟧»):
//   ⁅x⁆ — степень, ⦃n¦d⦄ — вложенная дробь, ⦉x⦊ — индекс, √{x} / √[i]{x} — корень.
const supX = (x) => `⁅${x}⁆`
const fIn = (n, d) => `⦃${n}¦${d}⦄`
const rIn = (x, i) => (i ? `√[${i}]{${x}}` : `√{${x}}`)
const subIn = (x) => `⦉${x}⦊`
const D2R = (d) => d * Math.PI / 180
// свободно от квадратов: иначе в условии появится неупрощённый корень (√24 вместо 2√6)
const sqFree = (n) => { for (let k = 2; k * k <= n; k++) if (n % (k * k) === 0) return false; return true }
// значение «красиво» (конечная десятичная ≤ p знаков) — иначе null
const exact = (x, p = 2) => { const r = Math.round(x * 10 ** p) / 10 ** p; return Math.abs(r - x) < 1e-9 ? r : null }
// коэффициент вида c√m: «3√2», «√2», «6», либо одним корнем «√72»
function coefTxt(c, m, single) {
  if (m === 1) return ru(c)
  if (single) return rT(c * c * m)
  return `${c === 1 ? "" : ru(c)}${rT(m)}`
}
const piTxt = (p, q) => (q === 1 ? (p === 1 ? "π" : `${p}π`) : fT(p === 1 ? "π" : `${p}π`, q))

// ── Степени ─────────────────────────────────────────────────────────────────
// #24: 81^2,6 / 9^3,7 — основания степени одного числа, дробные показатели.
function t07PowRatioBase() {
  let p, k1, k2, a, b, T, g = 0
  do {
    p = pick([2, 3, 5]); k1 = pick([2, 3, 4, 6]); k2 = pick([2, 3, 4, 6])
    T = randInt(1, 7); a = randInt(11, 99) / 10
    b = clean((k1 * a - T) / k2); g++
  } while ((k1 === k2 || b <= 0.5 || b > 12 || !Number.isInteger(clean(b * 10)) ||
    p ** T > 3000 || p ** k1 > 300 || p ** k2 > 300) && g < 900)
  return {
    condition_text: `Найдите значение выражения ${fT(`${p ** k1}${supX(ru(a))}`, `${p ** k2}${supX(ru(b))}`)}.`,
    answer: ru(p ** T),
  }
}

// #31: (A^(p/q) · B^(r/s))^N / (AB)^M.
function t07PowProdPow() {
  let A, B, p, q, r, s, N, M, t, g = 0
  do {
    q = pick([3, 5, 7]); s = pick([3, 5, 7])
    p = randInt(1, q - 1); r = randInt(1, s - 1)
    A = pick([2, 3, 4, 5, 7, 11]); B = pick([2, 3, 5, 7, 11, 13])
    N = q * s; M = s * p; t = q * r - s * p; g++
  } while ((q === s || A === B || t < 1 || t > 3 || B ** t > 1500 || A * B > 200 || M > 30) && g < 900)
  if (q === s || A === B || t < 1 || t > 3) return t07PowProdPow()
  const num = `(${A}${supX(fIn(p, q))}·${B}${supX(fIn(r, s))})${supX(N)}`
  return {
    condition_text: `Найдите значение выражения ${fT(num, `${A * B}${supX(M)}`)}.`,
    answer: ru(B ** t),
  }
}

// #32: A^a · B^b / (AB)^c — разложение составного основания на множители.
function t07PowFactorize() {
  let A, B, u, v, c, a, b, num, den, g = 0
  do {
    A = pick([2, 3, 5]); B = pick([2, 3, 5, 7, 11])
    u = randInt(-2, 2); v = randInt(-2, 2)
    c = randInt(11, 90) / 10
    a = clean(c + u); b = clean(c + v)
    num = A ** Math.max(u, 0) * B ** Math.max(v, 0)
    den = A ** Math.max(-u, 0) * B ** Math.max(-v, 0)
    g++
  } while ((A === B || gcd(A, B) !== 1 || a <= 0 || b <= 0 || (u === 0 && v === 0)
    || decLen(num, den) > 2 || num / den > 2000 || num / den < 0.05 || A * B > 60) && g < 900)
  return {
    condition_text: `Найдите значение выражения ${fT(`${A}${supX(ru(a))}·${B}${supX(ru(b))}`, `${A * B}${supX(ru(c))}`)}.`,
    answer: ru(clean(num / den)),
  }
}

// #35: (AB)^x · P^y : Q^z — три основания, деление знаком «:».
function t07PowThreeBases() {
  let A, B, u, v, x, y, z, num, den, midOnA, g = 0
  do {
    A = pick([4, 5, 3, 2]); B = pick([5, 3, 7, 2])
    u = pick([-1, 1]); v = pick([-1, 1])
    x = clean(randInt(-90, 90) / 10)
    midOnA = Math.random() < 0.5
    // (AB)^x даёт A^x·B^x; далее умножаем на одно основание и делим на другое
    y = clean((midOnA ? u : v) - x)          // показатель среднего множителя
    z = clean(x - (midOnA ? v : u))          // показатель делителя
    num = A ** Math.max(u, 0) * B ** Math.max(v, 0)
    den = A ** Math.max(-u, 0) * B ** Math.max(-v, 0)
    g++
  } while ((A === B || gcd(A, B) !== 1 || x === 0 || y === 0 || z === 0 || A * B > 60
    || Math.abs(y) > 9 || Math.abs(z) > 9 || decLen(num, den) > 2) && g < 900)
  const mid = midOnA ? A : B, div = midOnA ? B : A
  return {
    condition_text: `Найдите значение выражения ${A * B}${supT(ru(x))}·${mid}${supT(ru(y))}:${div}${supT(ru(z))}.`,
    answer: ru(clean(num / den)),
  }
}

// #36: (A/B)^(1/n) · B^(2/n) · (AB)^((n−1)/n) = A·B.
function t07PowDecFrac() {
  const opts = [[3, 4, "0,75"], [4, 5, "0,8"], [1, 2, "0,5"], [2, 5, "0,4"], [1, 4, "0,25"],
  [3, 5, "0,6"], [1, 5, "0,2"], [5, 8, "0,625"], [3, 8, "0,375"], [7, 10, "0,7"]]
  const [A, B, dec] = pick(opts)
  const n = pick([5, 7, 8, 9, 11, 13])
  const g2 = gcd(2, n), g3 = gcd(n - 1, n)
  return {
    condition_text: `Найдите значение выражения ${dec}${supT(fT(1, n))}·${B}${supT(fT(2 / g2, n / g2))}·${A * B}${supT(fT((n - 1) / g3, n / g3))}.`,
    answer: ru(A * B),
  }
}

// #52: a^p/(a^q·a^r) при a = число или дробь.
function t07PowLetter() {
  const t = pick([1, -1, 2, -2])
  const asFrac = Math.random() < 0.4
  let A, B, val, num, den
  if (asFrac) {
    A = pick([2, 3, 4, 5]); B = pick([5, 7, 9, 10])
    if (A >= B || gcd(A, B) !== 1) { A = 2; B = 7 }        // дробь несократимая, как в ФИПИ
    num = t > 0 ? A ** t : B ** -t; den = t > 0 ? B ** t : A ** -t
    val = fT(A, B)
  } else {
    A = pick([2, 3, 5, 6, 7, 10]); num = t > 0 ? A ** t : 1; den = t > 0 ? 1 : A ** -t
    val = ru(A)
  }
  if (decLen(num, den) > 3) return t07PowLetter()
  const q = clean(randInt(101, 899) / 100), r = clean(randInt(101, 899) / 100)
  if (Math.random() < 0.5) {                       // a^p / (a^q · a^r)
    const p = clean(q + r + t)
    if (p <= 0) return t07PowLetter()
    return {
      condition_text: `Найдите значение выражения ${fT(`a${supX(ru(p))}`, `a${supX(ru(q))}·a${supX(ru(r))}`)} при a = ${val}.`,
      answer: ru(clean(num / den)),
    }
  }
  const p = clean(q + r - t)                        // (a^q · a^r) / a^p
  if (p <= 0) return t07PowLetter()
  return {
    condition_text: `Найдите значение выражения ${fT(`a${supX(ru(q))}·a${supX(ru(r))}`, `a${supX(ru(p))}`)} при a = ${val}.`,
    answer: ru(clean(num / den)),
  }
}

// ── Корни ───────────────────────────────────────────────────────────────────
// #62: √x·√y/√z = √(xy/z).
function t07RootProdDiv() {
  let x, y, r, z, g = 0
  do {
    r = randInt(2, 9); x = clean(randInt(11, 90) / 10); y = clean(randInt(11, 90) / 10)
    z = clean(x * y / (r * r)); g++
  } while ((!Number.isInteger(clean(z * 100)) || z < 0.01 || z >= 10
    || Number.isInteger(x) || Number.isInteger(y) || Number.isInteger(z)) && g < 900)
  if (!Number.isInteger(clean(z * 100)) || z < 0.01 || Number.isInteger(x) || Number.isInteger(y)) return t07RootProdDiv()
  return {
    condition_text: `Найдите значение выражения ${fT(`${rIn(ru(x))}·${rIn(ru(y))}`, rIn(ru(z)))}.`,
    answer: ru(r),
  }
}

// #63: (√a+√b)²/(λ(a+b) + 2λ√(ab)) = 1/λ.
function t07RootSqSum() {
  const LAM = [[1, 2], [1, 1], [2, 1], [4, 1], [5, 1], [8, 1], [10, 1]]   // λ = n/d
  let a, b, ln, ld, s, m, g = 0
  do {
    a = pick([2, 3, 5, 6, 7, 10, 11, 13]); b = pick([2, 3, 5, 6, 7, 10, 11, 13]);
    [ln, ld] = pick(LAM)
    s = (a + b) * ln / ld; m = 2 * ln / ld; g++
  } while ((a === b || !sqFree(a * b) || !Number.isInteger(s)
    || !Number.isInteger(m) || decLen(ld, ln) > 3) && g < 900)
  if (a === b || !sqFree(a * b) || !Number.isInteger(s) || !Number.isInteger(m)) return t07RootSqSum()
  const denTail = m === 1 ? rIn(a * b) : `${m}${rIn(a * b)}`
  return {
    condition_text: `Найдите значение выражения ${fT(`(${rIn(a)}+${rIn(b)})${sup(2)}`, `${s}+${denTail}`)}.`,
    answer: ru(clean(ld / ln)),
  }
}

// #64: √(m² − n²) — под корнем разность квадратов (пифагорова тройка).
function t07RootDiffSq() {
  const [p, q, c] = pick(PYTH), k = randInt(2, 14)
  const legs = Math.random() < 0.5 ? [p, q] : [q, p]
  return {
    condition_text: `Найдите значение выражения ${rT(`${c * k}${sup(2)}−${legs[0] * k}${sup(2)}`)}.`,
    answer: ru(legs[1] * k),
  }
}

// #67: корни РАЗНЫХ степеней одного числа: (ⁿ√a · a^e · ᵐ√a)/ᵏ√a.
function t07RootDegrees() {
  // t = 1/n + e + 1/m − 1/k — подбираем n, k и РЕШАЕМ уравнение относительно m,
  // а не угадываем тройку (иначе цикл выходил по счётчику с негодными числами
  // и генератор выдавал неверный ответ).
  const BASES = [[2, [1]], [3, [1]], [5, [1]], [6, [1]], [7, [1]], [10, [1]],
  [4, [0.5, 1]], [9, [0.5, 1]], [36, [0.5, 1]], [25, [0.5, 1]], [100, [0.5, 1]]]
  for (let i = 0; i < 800; i++) {
    const [a, ts] = pick(BASES), t = pick(ts), e = pick([0, 1])
    const n = randInt(3, 20), k = randInt(2, 30)
    const inv = t - e - 1 / n + 1 / k                  // = 1/m
    if (inv <= 0) continue
    const m = Math.round(1 / inv)
    if (m < 2 || m > 30 || Math.abs(1 / m - inv) > 1e-12) continue
    if (n === m || n === k || m === k) continue
    const ans = Math.round(a ** t)
    if (Math.abs(a ** t - ans) > 1e-9 || ans < 2 || ans > 400) continue
    const mid = e === 1 ? `·${a}` : ""
    return {
      condition_text: `Найдите значение выражения ${fT(`${rIn(a, n)}${mid}·${rIn(a, m)}`, rIn(a, k))}.`,
      answer: ru(ans),
    }
  }
  // гарантированный запасной вариант (эталон ФИПИ #67): 1/15 + 1 + 1/10 − 1/6 = 1
  return {
    condition_text: `Найдите значение выражения ${fT(`${rIn(5, 15)}·5·${rIn(5, 10)}`, rIn(5, 6))}.`,
    answer: "5",
  }
}

// #68: корни ОДНОЙ степени разных чисел: (ⁿ√x · ⁿ√y)/ⁿ√z = ⁿ√(xy/z).
function t07RootSameDeg() {
  let n, r, x, y, z, g = 0
  do {
    n = pick([3, 4, 5]); r = randInt(2, 6)
    x = randInt(2, 60); y = randInt(2, 60)
    z = clean(x * y / r ** n); g++
  } while ((!Number.isInteger(z) || z < 2 || z > 400 || x * y > 4000) && g < 1500)
  if (!Number.isInteger(z) || z < 2) return t07RootSameDeg()
  return {
    condition_text: `Найдите значение выражения ${fT(`${rIn(x, n)}·${rIn(y, n)}`, rIn(z, n))}.`,
    answer: ru(r),
  }
}

// ── Тригонометрия ───────────────────────────────────────────────────────────
const SIN_HALF = [30, 150, 210, 330], SIN_ONE = [90, 270]
const COS_HALF = [60, 120, 240, 300], COS_ONE = [0, 180]
// #80: k·sin A · cos B (табличные углы, значения ±½ и ±1).
function t07TrigTableProd() {
  const A = pick([...SIN_HALF, ...SIN_ONE]), B = pick([...COS_HALF, ...COS_ONE])
  const k = randInt(2, 30) * pick([1, 1, -1])
  const v = exact(k * Math.sin(D2R(A)) * Math.cos(D2R(B)), 2)
  if (v === null || v === 0) return t07TrigTableProd()
  return { condition_text: `Найдите значение выражения ${ru(k)}sin${deg(A)}·cos${deg(B)}.`, answer: ru(v) }
}

// #82: k√m · tg(π/a) · sin(π/b) — табличные углы в радианах.
function t07TrigTablePi() {
  const FN = [["sin", Math.sin], ["cos", Math.cos], ["tg", Math.tan]]
  const QS = [[1, 6], [1, 4], [1, 3]]
  const [n1, f1] = pick(FN), [n2, f2] = pick(FN)
  const [p1, q1] = pick(QS), [p2, q2] = pick(QS)
  const m = pick([1, 2, 3, 6]), c = randInt(m === 1 ? 2 : 1, 30)
  const v = exact(c * Math.sqrt(m) * f1(Math.PI * p1 / q1) * f2(Math.PI * p2 / q2), 2)
  if (v === null || v === 0 || Math.abs(v) > 200) return t07TrigTablePi()
  return {
    condition_text: `Найдите значение выражения ${coefTxt(c, m)}${n1}${piTxt(p1, q1)}${n2}${piTxt(p2, q2)}.`,
    answer: ru(v),
  }
}

// #84: k√m · cos(−225°) — одна функция от «неудобного» угла.
function t07TrigTableNeg() {
  const ANG = [120, 135, 150, 210, 225, 240, 300, 315, 330]
  const [nm, f] = pick([["sin", Math.sin], ["cos", Math.cos]])
  const A = pick(ANG) * pick([1, -1])
  const m = pick([1, 2, 3]), c = randInt(m === 1 ? 2 : 1, 24)
  const v = exact(c * Math.sqrt(m) * f(D2R(A)), 2)
  if (v === null || v === 0) return t07TrigTableNeg()
  const angTxt = A < 0 ? `(−${Math.abs(A)}°)` : `${A}°`
  return { condition_text: `Найдите значение выражения ${coefTxt(c, m)}${nm}${angTxt}.`, answer: ru(v) }
}

// #87: cos α по sin α (или наоборот) и промежутку.
const QUARTERS = [
  ["(0; ⟦f:π:2⟧)", 1, 1], ["(⟦f:π:2⟧; π)", -1, 1], ["(π; ⟦f:3π:2⟧)", -1, -1], ["(⟦f:3π:2⟧; 2π)", 1, -1],
]
function t07TrigQuarter() {
  let d, k, m, g = 0
  do { d = pick([5, 10, 13, 25, 4, 20]); k = randInt(1, d - 1); m = d * d - k * k; g++ }
  while ((!sqFree(m) || decLen(k, d) > 2) && g < 400)
  if (!sqFree(m) || decLen(k, d) > 2) return t07TrigQuarter()
  const [qTxt, cs, sn] = pick(QUARTERS)
  const giveSin = Math.random() < 0.5
  // известная функция — иррациональная (√m/d), искомая — рациональная (k/d)
  const knownTxt = `${(giveSin ? sn : cs) < 0 ? "−" : ""}${fT(rIn(m), d)}`
  const ans = clean((giveSin ? cs : sn) * k / d)
  return {
    condition_text: `Найдите ${giveSin ? "cos" : "sin"}α, если ${giveSin ? "sin" : "cos"}α = ${knownTxt} и α∈${qTxt}.`,
    answer: ru(ans),
  }
}

// #89: tg α по sin α или cos α (вида a√N/N) и промежутку.
function t07TrigQuarterTg() {
  let a, b, N, g = 0
  do { a = randInt(1, 12); b = randInt(1, 12); N = a * a + b * b; g++ }
  while ((!sqFree(N) || decLen(a, b) > 2 || N > 200) && g < 400)
  if (!sqFree(N) || decLen(a, b) > 2) return t07TrigQuarterTg()
  const [qTxt, cs, sn] = pick(QUARTERS)
  const giveSin = Math.random() < 0.5
  const numer = giveSin ? a : b
  const sign = giveSin ? sn : cs
  const knownTxt = `${sign < 0 ? "−" : ""}${fT(`${numer === 1 ? "" : numer}${rIn(N)}`, N)}`
  return {
    condition_text: `Найдите tgα, если ${giveSin ? "sin" : "cos"}α = ${knownTxt} и α∈${qTxt}.`,
    answer: ru(clean(sn * cs * a / b)),
  }
}

// #90: k·sinA·cosA / sin2A = k/2.
function t07TrigSin2Frac() {
  const A = randInt(4, 89), kk = randInt(3, 40)
  return {
    condition_text: `Найдите значение выражения ${fT(`${2 * kk}sin${deg(A)}·cos${deg(A)}`, `sin${deg(2 * A)}`)}.`,
    answer: ru(kk),
  }
}

// #91: k(sin²A − cos²A)/cos2A = −k.
function t07TrigCos2Frac() {
  const k = randInt(3, 40)
  let A; do { A = randInt(4, 88) } while (A === 45)   // при A=45 знаменатель cos90°=0
  return {
    condition_text: `Найдите значение выражения ${fT(`${k}(sin${sup(2)}${deg(A)}−cos${sup(2)}${deg(A)})`, `cos${deg(2 * A)}`)}.`,
    answer: ru(-k),
  }
}

// #94: sin2α по cosα (или sinα) и промежутку π < α < 2π.
function t07TrigSin2FromCos() {
  const [p, q, c] = pick(PYTH)
  const swap = Math.random() < 0.5
  const cosA = clean((swap ? q : p) / c), sinAbs = clean((swap ? p : q) / c)
  if (decLen(swap ? q : p, c) > 2 || decLen(swap ? p : q, c) > 2) return t07TrigSin2FromCos()
  // Даём именно cosα: по sinα знак косинуса на (π; 2π) не определён — задача была бы
  // неоднозначной. В эталоне ФИПИ (#94) тоже дан косинус.
  const sinA = -sinAbs
  const ans = exact(2 * sinA * cosA, 2)
  if (ans === null) return t07TrigSin2FromCos()
  const sign = Math.random() < 0.5 ? 1 : -1
  return {
    condition_text: `Найдите sin2α, если cosα = ${ru(clean(sign * cosA))} и π < α < 2π.`,
    answer: ru(clean(sign * ans)),
  }
}

// общий помощник для #95/#96/#97: угол x = pπ/q, у которого cos2x «табличный»
function pickCos2() {
  for (let i = 0; i < 400; i++) {
    const q = pick([8, 12, 6, 4, 3]), p = randInt(1, 2 * q - 1)
    const c = exact(Math.cos(2 * Math.PI * p / q), 6)
    if (c === null || c === 0) continue
    if (gcd(p, q) !== 1) continue
    return { p, q, c }
  }
  return { p: 9, q: 8, c: Math.SQRT1_2 }
}
// #95: k·cos²x − k·sin²x = k·cos2x.
function t07TrigCos2Diff() {
  const { p, q, c } = pickCos2()
  const m = pick([1, 2, 3, 6]), cf = randInt(m === 1 ? 2 : 1, 12), single = Math.random() < 0.4
  const v = exact(cf * Math.sqrt(m) * c, 2)
  if (v === null || v === 0) return t07TrigCos2Diff()
  const K = coefTxt(cf, m, single)
  return {
    condition_text: `Найдите значение выражения ${K}cos${sup(2)}${piTxt(p, q)}−${K}sin${sup(2)}${piTxt(p, q)}.`,
    answer: ru(v),
  }
}
// #96: 2B·cos²x − B = B·cos2x.
function t07TrigCos2Half() {
  const { p, q, c } = pickCos2()
  const cf = randInt(1, 9), m = pick([1, 2, 3, 6]), single = Math.random() < 0.5
  const v = exact(cf * Math.sqrt(m) * c, 2)
  if (v === null || v === 0) return t07TrigCos2Half()
  return {
    condition_text: `Найдите значение выражения ${coefTxt(2 * cf, m, single)}cos${sup(2)}${piTxt(p, q)}−${coefTxt(cf, m, single)}.`,
    answer: ru(v),
  }
}
// #97: B − 2B·sin²x = B·cos2x.
function t07TrigCos2Minus() {
  const { p, q, c } = pickCos2()
  const cf = randInt(1, 9), m = pick([1, 2, 3, 6]), single = Math.random() < 0.5
  const v = exact(cf * Math.sqrt(m) * c, 2)
  if (v === null || v === 0) return t07TrigCos2Minus()
  return {
    condition_text: `Найдите значение выражения ${coefTxt(cf, m, single)}−${coefTxt(2 * cf, m, single)}sin${sup(2)}${piTxt(p, q)}.`,
    answer: ru(v),
  }
}
// #98/#99: k·sin x·cos x = (k/2)·sin2x.
function t07TrigSin2Prod() {
  for (let i = 0; i < 400; i++) {
    const q = pick([8, 12, 6, 4, 3]), p = randInt(1, 2 * q - 1)
    if (gcd(p, q) !== 1) continue
    const s = exact(Math.sin(2 * Math.PI * p / q), 6)
    if (s === null || s === 0) continue
    const m = pick([1, 2, 3]), cf = randInt(m === 1 ? 2 : 1, 12)
    const v = exact(cf * Math.sqrt(m) * s / 2, 2)
    if (v === null || v === 0) continue
    return {
      condition_text: `Найдите значение выражения ${coefTxt(cf, m)}sin${piTxt(p, q)}·cos${piTxt(p, q)}.`,
      answer: ru(v),
    }
  }
  return { condition_text: `Найдите значение выражения ${rT(2)}sin${fT("7π", 8)}·cos${fT("7π", 8)}.`, answer: "−0,5" }
}

// #103: формулы приведения — (k·f₁ + f₂)/f₃ = k − 1.
function t07TrigReduction() {
  const k = randInt(2, 9), odd = pick([1, 3, 5, 7, 9])
  const oddTxt = odd === 1 ? "π" : `${odd}π`
  if (Math.random() < 0.5) {
    const num = `${k}sin(α−${oddTxt})+cos(${fIn("3π", 2)}+α)`
    return { condition_text: `Найдите значение выражения ${fT(num, "sin(α+π)")}.`, answer: ru(k - 1) }
  }
  const num = `${k}cos(π−β)+sin(${fIn("π", 2)}+β)`
  return { condition_text: `Найдите значение выражения ${fT(num, `cos(β+${oddTxt})`)}.`, answer: ru(k - 1) }
}

// #105: k·sin(A+360°)/sin A = k (период).
function t07TrigPeriod() {
  const k = randInt(2, 40) * pick([1, -1]), A = randInt(3, 80)
  const [nm] = pick([["sin"], ["cos"]])
  return {
    condition_text: `Найдите значение выражения ${fT(`${ru(k)}${nm}${deg(A + 360)}`, `${nm}${deg(A)}`)}.`,
    answer: ru(k),
  }
}

// #106: k·cosA/sin(90°−A) ± c = k ± c (дополнительные углы).
function t07TrigCofunc() {
  const k = randInt(3, 60), A = randInt(2, 88), c = randInt(2, 40) * pick([1, -1])
  const flip = Math.random() < 0.5
  const top = flip ? `${k}sin${deg(A)}` : `${k}cos${deg(A)}`
  const bot = flip ? `cos${deg(90 - A)}` : `sin${deg(90 - A)}`
  return {
    condition_text: `Найдите значение выражения ${fT(top, bot)}${c < 0 ? "−" : "+"}${Math.abs(c)}.`,
    answer: ru(k + c),
  }
}

// #107: k·tgA·tg(90°−A) + c = k + c.
function t07TrigTgTg() {
  const k = randInt(3, 60) * pick([1, -1]), A = randInt(2, 88), c = randInt(2, 50) * pick([1, -1])
  return {
    condition_text: `Найдите значение выражения ${ru(k)}tg${deg(A)}·tg${deg(90 - A)}${c < 0 ? "−" : "+"}${Math.abs(c)}.`,
    answer: ru(k + c),
  }
}

// #108: k·sin2A/(cosA·cos(90°−A)) = 2k.
function t07TrigSin2Cofunc() {
  const k = randInt(3, 40), A = randInt(10, 80)
  return {
    condition_text: `Найдите значение выражения ${fT(`${k}sin${deg(2 * A)}`, `cos${deg(A)}·cos${deg(90 - A)}`)}.`,
    answer: ru(2 * k),
  }
}

// #109: N/(sin²A + c + sin²(A+90°)) = N/(1+c).
function t07TrigSinSqSum() {
  const useCos = Math.random() < 0.5
  let N, c, A, g = 0
  // у cos-варианта угол дополнительный (90°−A), поэтому A ≤ 88 — иначе вышел бы
  // отрицательный угол «cos²−31°», какого в ФИПИ не бывает
  do { c = randInt(1, 9); N = randInt(2, 60); A = useCos ? randInt(2, 88) : randInt(5, 175); g++ }
  while (decLen(N, 1 + c) > 2 && g < 300)
  const B = useCos ? 90 - A : A + 90
  const fn = useCos ? "cos" : "sin"
  return {
    condition_text: `Найдите значение выражения ${fT(N, `${fn}${sup(2)}${deg(A)}+${c}+${fn}${sup(2)}${deg(B)}`)}.`,
    answer: ru(clean(N / (1 + c))),
  }
}

// ── Логарифмы ───────────────────────────────────────────────────────────────
// #124: a^(log_a m) + (a²)^(log_a √n) = m + n.
function t07LogAPowLog() {
  const a = pick([2, 3, 5, 7]), m = randInt(2, 30), n = randInt(2, 40)
  return {
    condition_text: `Найдите значение выражения ${a}${supX(`log${subIn(a)}${m}`)}+${a * a}${supX(`log${subIn(a)}${rIn(n)}`)}.`,
    answer: ru(m + n),
  }
}

// #132: log_{a^p}N / log_{a^q}N = q/p.
function t07LogRatioPowBase() {
  let a, p, q, g = 0
  do { a = pick([2, 3, 5]); p = randInt(1, 4); q = randInt(1, 6); g++ }
  while ((p === q || decLen(q, p) > 2 || a ** p > 300 || a ** q > 300) && g < 400)
  if (p === q || decLen(q, p) > 2) return t07LogRatioPowBase()  // p=q — вырожденное задание
  const N = randInt(2, 40)
  return {
    condition_text: `Найдите значение выражения ${fT(`log${subU(a ** p)}${N}`, `log${subU(a ** q)}${N}`)}.`,
    answer: ru(clean(q / p)),
  }
}

// #133: log_c A/log_c B + log_B(1/D) = log_B(A/D).
function t07LogRecipSum() {
  let B, t, D, A, c, g = 0
  do {
    B = pick([2, 3, 5, 7, 8, 13]); t = randInt(0, 3); D = pick([2, 4, 5, 8, 10])
    A = D * B ** t; c = pick([3, 5, 7, 11]); g++
  } while ((A > 500 || A === 1 || c === B) && g < 400)
  if (A === 1 || c === B) return t07LogRecipSum()
  const inv = clean(1 / D)
  return {
    condition_text: `Найдите значение выражения ${fT(`log${subU(c)}${A}`, `log${subU(c)}${B}`)}+log${subB(B)}${ru(inv)}.`,
    answer: ru(t),
  }
}

// #135: log_{ⁿ√a} a = n.
function t07LogRootBase() {
  const a = pick([3, 5, 7, 10, 11, 13, 17, 2]), n = randInt(2, 12)
  return {
    condition_text: `Найдите значение выражения log${subIn(rIn(a, n === 2 ? "" : n))}${a}.`,
    answer: ru(n),
  }
}

// #136: log_a b · log_b c = log_a c.
function t07LogChain() {
  const a = pick([2, 3, 5, 7]), k = randInt(2, 4), b = pick([5, 7, 11, 13, 6])
  return {
    condition_text: `Найдите значение выражения log${subB(a)}${b}·log${subB(b)}${a ** k}.`,
    answer: ru(k),
  }
}

// #137: k·log_a(ⁿ√a) = k/n.
function t07LogKRoot() {
  let a, n, k, g = 0
  do { a = pick([2, 3, 5, 7, 11]); n = randInt(2, 12); k = randInt(2, 120); g++ }
  while (decLen(k, n) > 2 && g < 400)
  return {
    condition_text: `Найдите значение выражения ${k}log${subB(a)}${rIn(a, n === 2 ? "" : n)}.`,
    answer: ru(clean(k / n)),
  }
}

// #141: log_{1/a} √a = −0,5.
function t07LogFracBaseRoot() {
  const a = pick([3, 5, 7, 11, 13, 17, 18, 6, 10, 12, 15])
  return {
    condition_text: `Найдите значение выражения log${subIn(fIn(1, a))}${rIn(a)}.`,
    answer: "−0,5",
  }
}

// #143: k·log_b A · log_A(1/b) = −k.
function t07LogRecipProd() {
  const pairs = [["1,25", "0,8"], ["0,5", "2"], ["0,2", "5"], ["2", "0,5"], ["4", "0,25"], ["0,25", "4"]]
  const [b, invB] = pick(pairs)
  const A = pick([5, 7, 3, 11, 13])
  const k = randInt(2, 30)
  return {
    condition_text: `Найдите значение выражения ${k}log${subB(b)}${A}·log${subB(A)}${invB}.`,
    answer: ru(-k),
  }
}

// ============================================================================
// №12 — ГРАФИКИ ФУНКЦИЙ (чтение графика элементарной функции, короткий ответ)
// ============================================================================
// Эталон — «ЕГЭ_Профиль_Задание11_Графики_функций» (открытый банк ФИПИ; 26
// заданий = 13 типажей, каждый в двух вариантах). Старый номер задания — 11,
// поэтому имена функций и gen_key оставлены t11* (на gen_key держится аналитика
// task_attempts). Разбор эталона — типаж за типажом:
//   #1  f(x)=kx+b          → f(7)    прямая; отмечены (0;b) и ещё один узел
//   #3  f(x)=ax²+bx+c      → f(−2)   парабола; отмечены (0;c) и оба корня
//   #5  «a, b, c — целые»  → f(−12)  парабола БЕЗ точек, вершина в узле сетки
//   #12 f(x)=k/x, k>0      → f(10)   гипербола; отмечен один узел
//   #13 f(x)=k/x, k<0      → f(10)
//   #22 f(x)=aˣ, a>1       → f(3)    отмечены (0;1) и (1;a)
//   #23 f(x)=aˣ, 0<a<1     → f(−4)   отмечены (0;1) и (−1;1/a)
//   #28 f(x)=logₐx, 0<a<1  → f(8)    отмечены (1;0) и (1/a;−1)
//   #29 f(x)=logₐx, a>1    → f(16)   отмечены (1;0) и (a;1)
//   #40 две прямые         → абсцисса A
//   #46 ax²+bx+c и g=kx    → абсцисса B
//   #49 k/x и g=ax+b       → абсцисса B
//   #51 a√x и g=kx         → абсцисса B
// Правила бланка, воспроизведённые здесь буквально:
//   • параметры функции читаются по ОТМЕЧЕННЫМ точкам-узлам сетки;
//   • подписаны только нужные деления — единица и координаты этих точек
//     (правило `gTicks`, оно даёт ровно тот набор подписей, что и на бланке);
//   • искомая точка ВСЕГДА вне окна чертежа: её нельзя «считать» с картинки,
//     ответ получают вычислением;
//   • «y = f(x)» подписывают там, где функция одна; в заданиях на пересечение
//     подписи нет, зато у общей точки стоит буква A;
//   • у демо-типажа #5 точек и подписи «y = f(x)» нет вовсе — коэффициенты
//     читают по вершине (она в узле) и по ходу кривой.
// Ответ считается кодом по построению — гарантированно верен.

const G_AX = "#1c1c1e", G_GRID = "#d7dbe0", G_CURVE = "#1c1c1e", G_DASH = "#8a9099"
// Белый ореол за подписями — цифры осей и метки читаются, даже если сквозь них идёт кривая.
const HALO = 'paint-order="stroke" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"'

// Путь кривой: сэмплирует fn на [xa,xb], рвёт линию на разрывах и выходе за окно.
function fnPath(fn, xa, xb, X, Y, ylo, yhi, step) {
  step = step || (xb - xa) / 500
  let d = "", pen = false, prevY = null
  for (let x = xa; x <= xb + 1e-9; x += step) {
    const y = fn(x)
    if (!isFinite(y) || y < ylo || y > yhi) { pen = false; prevY = null; continue }
    // разрыв через асимптоту: резкий скачок знака/величины
    if (prevY !== null && Math.abs(y - prevY) > (yhi - ylo)) { pen = false }
    d += (pen ? "L" : "M") + clean(X(x)) + " " + clean(Y(y)) + " "
    pen = true; prevY = y
  }
  return d
}

// Координатная сетка с графиком(-ами) функции. Возвращает SVG-строку.
// plots: [{fn, xa, xb, dash?}]; vdash/hdash — пунктирные асимптоты (x= / y=);
// dots: [[x,y]] — жирные точки; labels: [{x,y,text,anchor?,italic?,size?}];
// xticks/yticks — подписанные деления ([{x,text}] / [{y,text}]); по умолчанию
// подписана только единица (unitX — её подпись по оси x).
function fnGridSvg({ gx0, gx1, gy0, gy1, plots = [], vdash = [], hdash = [], dots = [], labels = [], unitX = "1", xticks = null, yticks = null }) {
  const cell = 24, m = 15
  const W = 2 * m + (gx1 - gx0) * cell, H = 2 * m + (gy1 - gy0) * cell
  const X = (u) => m + (u - gx0) * cell
  const Y = (v) => H - m - (v - gy0) * cell
  let g = ""
  for (let i = gx0; i <= gx1; i++) g += `<line x1="${X(i)}" y1="${Y(gy0)}" x2="${X(i)}" y2="${Y(gy1)}" stroke="${G_GRID}" stroke-width="1"/>`
  for (let j = gy0; j <= gy1; j++) g += `<line x1="${X(gx0)}" y1="${Y(j)}" x2="${X(gx1)}" y2="${Y(j)}" stroke="${G_GRID}" stroke-width="1"/>`
  for (const x of vdash) g += `<line x1="${X(x)}" y1="${Y(gy0)}" x2="${X(x)}" y2="${Y(gy1)}" stroke="${G_DASH}" stroke-width="1.3" stroke-dasharray="5 4"/>`
  for (const y of hdash) g += `<line x1="${X(gx0)}" y1="${Y(y)}" x2="${X(gx1)}" y2="${Y(y)}" stroke="${G_DASH}" stroke-width="1.3" stroke-dasharray="5 4"/>`
  // кривые
  for (const p of plots) g += `<path d="${fnPath(p.fn, p.xa, p.xb, X, Y, gy0, gy1, p.step)}" fill="none" stroke="${G_CURVE}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${p.dash ? ` stroke-dasharray="${p.dash}"` : ""}/>`
  // оси со стрелками
  g += vecArrow(X(gx0), Y(0), X(gx1), Y(0), G_AX, 1.4)
  g += vecArrow(X(0), Y(gy0), X(0), Y(gy1), G_AX, 1.4)
  g += `<text x="${X(gx1) - 3}" y="${Y(0) + 17}" ${HALO} font-size="15" font-style="italic" font-weight="bold" fill="${G_AX}" text-anchor="end">x</text>`
  g += `<text x="${X(0) + 7}" y="${Y(gy1) + 13}" ${HALO} font-size="15" font-style="italic" font-weight="bold" fill="${G_AX}">y</text>`
  g += `<text x="${X(0) - 5}" y="${Y(0) + 16}" ${HALO} font-size="13" font-weight="bold" fill="${G_AX}" text-anchor="end">0</text>`
  // подписанные деления: штрих на оси + число (как на бланке ФИПИ)
  for (const t of xticks || [{ x: 1, text: unitX }]) {
    if (!(t.x >= gx0 && t.x <= gx1) || t.x === 0) continue
    g += `<line x1="${X(t.x)}" y1="${Y(0) - 4}" x2="${X(t.x)}" y2="${Y(0) + 4}" stroke="${G_AX}" stroke-width="1.4"/>`
    g += `<text x="${X(t.x)}" y="${Y(0) + 16}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="middle">${t.text}</text>`
  }
  for (const t of yticks || [{ y: 1, text: "1" }]) {
    if (!(t.y >= gy0 && t.y <= gy1) || t.y === 0) continue
    g += `<line x1="${X(0) - 4}" y1="${Y(t.y)}" x2="${X(0) + 4}" y2="${Y(t.y)}" stroke="${G_AX}" stroke-width="1.4"/>`
    g += `<text x="${X(0) - 7}" y="${Y(t.y) + 4}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="end">${t.text}</text>`
  }
  // жирные точки
  for (const [x, y] of dots) g += `<circle cx="${X(x)}" cy="${Y(y)}" r="2.8" fill="${G_AX}"/>`
  // произвольные подписи
  for (const L of labels) g += `<text x="${X(L.x)}" y="${Y(L.y)}" ${HALO} font-size="${L.size || 13}" ${L.italic ? 'font-style="italic" ' : ""}fill="${G_AX}" text-anchor="${L.anchor || "start"}">${L.text}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`
}

// Подписи делений ровно как на бланке: единица плюс координаты отмеченных точек.
// (Сверено по всем 26 заданиям эталона: набор подписей совпадает буква в букву.)
function gTicks(dots) {
  const xs = new Set([1]), ys = new Set([1])
  for (const [x, y] of dots) { if (x && Number.isInteger(x)) xs.add(x); if (y && Number.isInteger(y)) ys.add(y) }
  return {
    xticks: [...xs].map((x) => ({ x, text: ru(x) })),
    yticks: [...ys].map((y) => ({ y, text: ru(y) })),
  }
}

// Подпись графика «y = f(x)»: выбираем место с максимальным ЗНАКОВЫМ зазором от
// кривой (бокс подписи асимметричен — глифы идут вверх от базовой линии). Никогда
// не налезает на график: если кривая всюду близко, берём наименее занятое место.
function fLabelAt(fn, gx0, gx1, gy0, gy1, opts = {}) {
  const { preferRight = true, avoidX = [0], avoidY = [0] } = opts
  const hw = 1.5, hUp = 0.62, hDn = 0.18 // полу-бокс (клетки): «y = f(x)», вверх больше
  const pts = []
  for (let x = gx0; x <= gx1; x += 0.06) { const y = fn(x); if (isFinite(y) && y >= gy0 - 1 && y <= gy1 + 1) pts.push([x, y]) }
  let best = { x: (gx0 + gx1) / 2, y: gy1 - hUp - 0.3 }, bestScore = -Infinity
  for (let cx = gx0 + hw + 0.2; cx <= gx1 - hw - 0.2; cx += 0.4) {
    for (let cy = gy0 + hDn + 0.3; cy <= gy1 - hUp - 0.3; cy += 0.4) {
      let clr = Infinity
      for (const [px, py] of pts) {
        const ox = Math.abs(px - cx) - hw
        const oy = Math.max(py - (cy + hUp), (cy - hDn) - py)
        clr = Math.min(clr, ox <= 0 && oy <= 0 ? Math.max(ox, oy) : Math.hypot(Math.max(0, ox), Math.max(0, oy)))
      }
      // цель — стоять ВОЗЛЕ кривой (≈1,5 клетки), но не налезать на неё и не
      // убегать в дальний пустой угол, как это делают на бланке ФИПИ
      let s = clr < 0.8 ? (clr - 0.8) * 6 : -Math.max(0, clr - 1.7) * 0.9
      s += Math.min(cx - gx0, gx1 - cx, cy - gy0, gy1 - cy) * 0.12 + (preferRight ? 1 : -1) * cx * 0.03
      // цифры делений: у оси y стоят СЛЕВА от неё, у оси x — СНИЗУ, зона обхода асимметрична
      for (const ax of avoidX) s -= (cx < ax ? Math.max(0, 3.4 - (ax - cx)) : Math.max(0, 1.9 - (cx - ax))) * 2.5
      for (const ay of avoidY) s -= (cy < ay ? Math.max(0, 1.55 - (ay - cy)) : Math.max(0, 0.85 - (cy - ay))) * 2.5
      // буквы осей: «y» — у верха оси ординат, «x» — у правого конца оси абсцисс
      if (Math.abs(cx) < 2.2 && cy > gy1 - 1.6) s -= 4
      if (cx > gx1 - 2.6 && Math.abs(cy) < 1.2) s -= 4
      if (s > bestScore) { bestScore = s; best = { x: clean(cx), y: clean(cy) } }
    }
  }
  return { x: best.x, y: best.y, text: "y = f(x)", italic: true, size: 12, anchor: "middle" }
}

// Буква у общей точки («A» на бланке). На бланке её ставят по диагонали от точки
// в свободную сторону (у ФИПИ она бывает и справа сверху, и слева снизу), поэтому
// выбираем ту из четырёх диагоналей, где дальше всего до кривых; слева от оси y и
// под осью x стоят подписи делений — эти стороны штрафуем.
function markLabelAt(x, y, t, fns, win) {
  const pts = []
  for (const f of fns) {
    for (let px = win.gx0; px <= win.gx1; px += 0.05) {
      const py = f(px)
      if (isFinite(py) && py >= win.gy0 - 1 && py <= win.gy1 + 1) pts.push([px, py])
    }
  }
  let best = [0.55, 0.55], bs = -Infinity
  for (const [dx, dy] of [[0.55, 0.55], [0.55, -0.55], [-0.55, 0.55], [-0.55, -0.55]]) {
    const cx = x + dx, cy = y + dy
    if (cx < win.gx0 + 0.7 || cx > win.gx1 - 0.7 || cy < win.gy0 + 0.6 || cy > win.gy1 - 0.6) continue
    let clr = Infinity
    for (const [px, py] of pts) clr = Math.min(clr, Math.hypot(px - cx, py - cy))
    let sc = Math.min(clr, 1.2)
    if (dx < 0 && Math.abs(x) < 1e-9) sc -= 1.5
    if (dy < 0 && Math.abs(y) < 1e-9) sc -= 1.5
    if (sc > bs) { bs = sc; best = [dx, dy] }
  }
  return { x: x + best[0], y: y + best[1] + 0.18, text: t, italic: true, size: 14, anchor: "middle" }
}

// ---- #1. Линейная f(x)=kx+b ------------------------------------------------
// Отмечены (0;b) и ещё один узел ⇒ k и b читаются однозначно. Спрашивают f(x₀)
// при |x₀| ≥ 6 — точка заведомо вне окна [−5;5]×[−6;6].
function t11LinValue() {
  const gx0 = -5, gx1 = 5, gy0 = -6, gy1 = 6
  for (; ;) {
    const k = pick([1, 2, 3, -1, -2, -3]), b = pick([-4, -3, -2, -1, 1, 2, 3, 4])
    const fn = (x) => k * x + b
    const cand = []
    for (let x = -3; x <= 3; x++) { if (!x) continue; const y = fn(x); if (y >= gy0 + 1 && y <= gy1 - 1) cand.push(x) }
    if (!cand.length) continue
    const x1 = pick(cand), x0 = pick([-9, -8, -7, -6, 6, 7, 8, 9])
    const dots = [[0, b], [x1, fn(x1)]]
    const svg = fnGridSvg({
      gx0, gx1, gy0, gy1, plots: [{ fn, xa: gx0, xb: gx1 }], dots, ...gTicks(dots),
      labels: [fLabelAt(fn, gx0, gx1, gy0, gy1, { preferRight: k > 0 })],
    })
    return {
      condition_text: `На рисунке изображён график функции вида f(x) = kx + b. Найдите значение f(${ru(x0)}).`,
      image_url: svgUrl(svg), answer: ru(fn(x0)),
    }
  }
}

// ---- #3. Парабола f(x)=ax²+bx+c по корням ----------------------------------
// Как на бланке: отмечены точка пересечения с осью y и оба корня, поэтому
// a, b, c восстанавливаются однозначно. Спрашивают f(x₀) за краем окна.
function t11QuadRoots() {
  for (; ;) {
    const a = pick([1, -1])
    const p = randInt(-3, 2), q = p + randInt(1, 4)
    if (!p || !q) continue
    const fn = (x) => a * (x - p) * (x - q)
    const c = fn(0)
    if (Math.abs(c) > 6) continue
    const vy = fn((p + q) / 2)
    const gx0 = Math.min(p, 0) - 2, gx1 = Math.max(q, 0) + 2
    if (gx1 - gx0 > 11) continue
    let gy0, gy1
    if (a > 0) { gy0 = Math.floor(vy) - 1; gy1 = gy0 + 10 } else { gy1 = Math.ceil(vy) + 1; gy0 = gy1 - 10 }
    if (c < gy0 + 1 || c > gy1 - 1) continue
    const x0 = pick([gx0 - 1, gx0 - 2, gx1 + 1, gx1 + 2])
    if (Math.abs(fn(x0)) > 200) continue
    const dots = [[0, c], [p, 0], [q, 0]]
    const svg = fnGridSvg({
      gx0, gx1, gy0, gy1, plots: [{ fn, xa: gx0, xb: gx1 }], dots, ...gTicks(dots),
      labels: [fLabelAt(fn, gx0, gx1, gy0, gy1, { preferRight: true })],
    })
    return {
      condition_text: `На рисунке изображён график функции вида f(x) = ax² + bx + c. Найдите значение f(${ru(x0)}).`,
      image_url: svgUrl(svg), answer: ru(fn(x0)),
    }
  }
}

// ---- #5. Парабола с ЦЕЛЫМИ a, b, c (демоверсия) ----------------------------
// Отличие от #3 — иная формулировка и иной способ чтения: точек нет, «y = f(x)»
// не подписан, зато вершина стоит в узле сетки (эталон: y=x²+8x+13, вершина
// (−4;−3), спрашивают f(−12); и y=−x²−8x−13, вершина (−4;3), f(−8)).
function t11QuadInt() {
  for (; ;) {
    const a = pick([1, -1])
    const h = randInt(-5, 3), kv = randInt(-4, 4)
    const fn = (x) => a * (x - h) * (x - h) + kv
    const gx0 = Math.min(h - 3, -2), gx1 = Math.max(h + 3, 2)
    if (gx1 - gx0 > 11) continue
    let gy0, gy1
    if (a > 0) { gy0 = kv - 2; gy1 = gy0 + 10 } else { gy1 = kv + 2; gy0 = gy1 - 10 }
    if (gy0 > -2 || gy1 < 2) continue // ось x проходит по чертежу
    const far = [-12, -10, -8, -6, 6, 8, 10, 12].filter((x) => x < gx0 - 1 || x > gx1 + 1)
    if (!far.length) continue
    const x0 = pick(far)
    if (Math.abs(fn(x0)) > 260) continue
    const svg = fnGridSvg({ gx0, gx1, gy0, gy1, plots: [{ fn, xa: gx0, xb: gx1 }] })
    return {
      condition_text: `На рисунке изображён график функции вида f(x) = ax² + bx + c, где числа a, b и c — целые. Найдите значение f(${ru(x0)}).`,
      image_url: svgUrl(svg), answer: ru(fn(x0)),
    }
  }
}

// ---- #12/#13. Гипербола f(x)=k/x -------------------------------------------
// Отмечен один узел (x₁; k/x₁) ⇒ k = x₁·y₁. Спрашивают f(10) — как на бланке.
// sign = +1 (ветви в I и III четвертях) или −1 (во II и IV).
function t11HypValue(sign) {
  const gx0 = -5, gx1 = 5, gy0 = -5, gy1 = 5
  for (; ;) {
    const k = sign * pick([1, 2, 3, 4, 6])
    const nodes = []
    for (let d = -4; d <= 4; d++) {
      if (!d || k % d) continue
      const y = k / d
      if (Math.abs(y) >= 1 && Math.abs(y) <= 4) nodes.push([d, y])
    }
    if (!nodes.length) continue
    const dot = pick(nodes), fn = (x) => k / x
    const svg = fnGridSvg({
      gx0, gx1, gy0, gy1,
      plots: [{ fn, xa: gx0, xb: -0.02, step: 0.01 }, { fn, xa: 0.02, xb: gx1, step: 0.01 }],
      dots: [dot], ...gTicks([dot]),
      labels: [fLabelAt(fn, gx0, gx1, gy0, gy1, { preferRight: true })],
    })
    return {
      condition_text: `На рисунке изображён график функции вида f(x) = ⟦f:k:x⟧. Найдите значение f(10).`,
      image_url: svgUrl(svg), answer: ru(clean(k / 10)),
    }
  }
}

// ---- #22/#23. Показательная f(x)=aˣ ----------------------------------------
// Отмечены (0;1) и соседний узел: (1;a) при a>1, (−1;1/a) при 0<a<1 ⇒ основание
// читается. Спрашивают f(±n), n ≥ 3 — точка за краем окна.
function t11ExpValue(up) {
  const B = pick([2, 3])
  const a = up ? B : 1 / B
  // окно: 2 клетки запаса со стороны роста (иначе подпись оси налезает на деление)
  const gx0 = up ? -7 : -2, gx1 = up ? 2 : 7
  const gy0 = -1, gy1 = B === 2 ? 7 : 6
  const fn = (x) => Math.pow(a, x)
  const n = pick(B === 2 ? [3, 4, 5] : [3, 4])
  const x0 = up ? n : -n
  const dots = up ? [[0, 1], [1, B]] : [[0, 1], [-1, B]]
  const svg = fnGridSvg({
    gx0, gx1, gy0, gy1, plots: [{ fn, xa: gx0, xb: gx1 }], dots, ...gTicks(dots),
    labels: [fLabelAt(fn, gx0, gx1, gy0, gy1, { preferRight: !up })],
  })
  return {
    condition_text: `На рисунке изображён график функции вида f(x) = a${supT("x")}. Найдите значение f(${ru(x0)}).`,
    image_url: svgUrl(svg), answer: ru(B ** n),
  }
}

// ---- #28/#29. Логарифм f(x)=logₐx ------------------------------------------
// Отмечены (1;0) и (a;1) при a>1 либо (1/a;−1) при 0<a<1. Спрашивают f(aⁿ) /
// f((1/a)ⁿ) при n ≥ 2 — аргумент за правым краем окна.
function t11LogValue(up) {
  const B = pick([2, 3, 4])
  const gx0 = -2, gx1 = 7, gy0 = -4, gy1 = 4
  const s = up ? 1 : -1
  const fn = (x) => (x <= 0 ? NaN : s * Math.log(x) / Math.log(B))
  const n = pick(B === 2 ? [3, 4, 5] : B === 3 ? [2, 3, 4] : [2, 3])
  const dots = [[1, 0], [B, s]]
  const svg = fnGridSvg({
    gx0, gx1, gy0, gy1, plots: [{ fn, xa: 0.02, xb: gx1, step: 0.01 }], dots, ...gTicks(dots),
    labels: [fLabelAt(fn, gx0, gx1, gy0, gy1, { preferRight: true })],
  })
  return {
    condition_text: `На рисунке изображён график функции вида f(x) = log${subB("a")}x. Найдите значение f(${ru(B ** n)}).`,
    image_url: svgUrl(svg), answer: ru(s * n),
  }
}

// ---- #40. Две прямые: абсцисса точки пересечения ---------------------------
// Каждая прямая задана двумя отмеченными узлами; сама точка A лежит ЗА окном
// (как на бланке — прямые сходятся уже за краем чертежа), поэтому её абсциссу
// находят решением k₁x + b₁ = k₂x + b₂, а не считыванием с сетки.
function t11TwoLines() {
  const gx0 = -5, gx1 = 5, gy0 = -5, gy1 = 5
  for (; ;) {
    const ks = shuffle([-3, -2, -1, 1, 2, 3])
    const k1 = ks[0], k2 = ks[1]
    const b1 = randInt(-4, 4), b2 = randInt(-4, 4)
    if (b1 === b2) continue
    const xA = (b2 - b1) / (k1 - k2)
    if (!Number.isInteger(xA) || !xA || Math.abs(xA) > 12) continue
    const yA = k1 * xA + b1
    if (Math.abs(xA) <= gx1 && Math.abs(yA) <= gy1) continue // A обязана быть вне окна
    const f1 = (x) => k1 * x + b1, f2 = (x) => k2 * x + b2
    const node = (f) => {
      const c = []
      for (let x = -3; x <= 3; x++) { if (!x) continue; const y = f(x); if (y >= gy0 + 1 && y <= gy1 - 1) c.push([x, y]) }
      return c.length ? pick(c) : null
    }
    const n1 = node(f1), n2 = node(f2)
    if (!n1 || !n2) continue
    const dots = [[0, b1], n1, [0, b2], n2]
    const svg = fnGridSvg({
      gx0, gx1, gy0, gy1,
      plots: [{ fn: f1, xa: gx0, xb: gx1 }, { fn: f2, xa: gx0, xb: gx1 }],
      dots, ...gTicks(dots),
    })
    return {
      condition_text: `На рисунке изображены графики двух линейных функций, пересекающиеся в точке A. Найдите абсциссу точки A.`,
      image_url: svgUrl(svg), answer: ru(xA),
    }
  }
}

// ---- #46. Парабола и g(x)=kx: абсцисса точки B -----------------------------
// A — начало координат (значит c = 0), поэтому f(x) = ax² + bx и вторая общая
// точка имеет абсциссу xB = (k − b)/a. На чертеже отмечены A, один узел на
// параболе и один на прямой; B лежит за правым (левым) краем окна.
function t11ParabLineK() {
  for (; ;) {
    const a = pick([1, 1, 2]), b = pick([-3, -2, -1, 1, 2, 3])
    const xB = pick([-7, -6, -5, -4, 4, 5, 6, 7])
    const k = a * xB + b
    if (!k || Math.abs(k) > 6) continue
    const fn = (x) => a * x * x + b * x, gF = (x) => k * x
    const lim = xB > 0 ? { gx0: -4, gx1: 3 } : { gx0: -3, gx1: 4 }
    const pnode = [], lnode = []
    for (let x = lim.gx0 + 1; x <= lim.gx1 - 1; x++) {
      if (!x) continue
      if (Math.abs(fn(x)) <= 6 && fn(x) !== gF(x)) pnode.push([x, fn(x)])
      if (Math.abs(gF(x)) <= 6 && fn(x) !== gF(x)) lnode.push([x, gF(x)])
    }
    if (!pnode.length || !lnode.length) continue
    const dp = pick(pnode), dl = pick(lnode)
    const vy = -b * b / (4 * a)
    const ys = [0, dp[1], dl[1], vy]
    let gy0 = Math.floor(Math.min(...ys)) - 2, gy1 = Math.ceil(Math.max(...ys)) + 2
    let t = 0
    while (gy1 - gy0 < 9) { (t++ % 2 ? gy0-- : gy1++) }
    if (gy1 - gy0 > 12) continue
    const dots = [[0, 0], dp, dl]
    const svg = fnGridSvg({
      ...lim, gy0, gy1,
      plots: [{ fn, xa: lim.gx0, xb: lim.gx1 }, { fn: gF, xa: lim.gx0, xb: lim.gx1 }],
      dots, ...gTicks(dots), labels: [markLabelAt(0, 0, "A", [fn, gF], { ...lim, gy0, gy1 })],
    })
    return {
      condition_text: `На рисунке изображены графики функций видов f(x) = ax² + bx + c и g(x) = kx, пересекающиеся в точках A и B. Найдите абсциссу точки B.`,
      image_url: svgUrl(svg), answer: ru(xB),
    }
  }
}

// ---- #49. Гипербола и g(x)=ax+b: абсцисса точки B --------------------------
// Абсциссы общих точек — корни ax² + bx − k = 0, поэтому по выбранным xA и xB
// однозначно восстанавливаются a = −k/(xA·xB) и b = −a(xA + xB). На чертеже
// отмечены A (в узле, с буквой) и точка (0; b) прямой; B — за краем окна.
function t11HypLine() {
  for (; ;) {
    const k = pick([-12, -10, -8, -6, -4, -3, -2, 2, 3, 4, 6, 8, 10, 12])
    const divs = []
    for (let d = -6; d <= 6; d++) { if (!d || k % d) continue; if (Math.abs(k / d) <= 5) divs.push(d) }
    if (!divs.length) continue
    const xA = pick(divs), yA = k / xA
    const xB = pick([-9, -8, -7, -6, 6, 7, 8, 9])
    if ((xA > 0) === (xB > 0)) continue
    const a = -k / (xA * xB)
    // a должно быть «читаемым»: целое либо половина/треть/четверть
    if (!a || Math.abs(a) > 3) continue
    if (![1, 2, 3, 4].some((d) => Number.isInteger(a * d))) continue
    const b = -a * (xA + xB)
    if (!Number.isInteger(b) || !b || Math.abs(b) > 5) continue
    const gx0 = Math.min(xA - 2, -3), gx1 = Math.max(xA + 2, 3)
    if (gx1 - gx0 > 12 || xB >= gx0 && xB <= gx1) continue
    let gy0 = Math.min(yA, b, -2) - 2, gy1 = Math.max(yA, b, 2) + 2
    let t = 0
    while (gy1 - gy0 < 9) { (t++ % 2 ? gy0-- : gy1++) }
    if (gy1 - gy0 > 13) continue
    const fF = (x) => k / x, gF = (x) => a * x + b
    const dots = [[xA, yA], [0, b]]
    const svg = fnGridSvg({
      gx0, gx1, gy0, gy1,
      plots: [{ fn: fF, xa: gx0, xb: -0.02, step: 0.01 }, { fn: fF, xa: 0.02, xb: gx1, step: 0.01 }, { fn: gF, xa: gx0, xb: gx1 }],
      dots, ...gTicks(dots), labels: [markLabelAt(xA, yA, "A", [fF, gF], { gx0, gx1, gy0, gy1 })],
    })
    return {
      condition_text: `На рисунке изображены графики функций видов f(x) = ⟦f:k:x⟧ и g(x) = ax + b, пересекающиеся в точках A и B. Найдите абсциссу точки B.`,
      image_url: svgUrl(svg), answer: ru(xB),
    }
  }
}

// ---- #51. Корень и g(x)=kx: абсцисса точки B -------------------------------
// A — начало координат, вторая общая точка a√x = kx даёт xB = (a/k)². Берём
// k = 1/m, поэтому на прямой есть узел (m; 1), а на кривой — (1; a); xB = (am)²
// заведомо за правым краем окна.
function t11RootLineK() {
  const a = pick([2, 3]), m = pick([2, 3, 4])
  const k = 1 / m, xB = (a * m) ** 2
  const gx0 = -4, gx1 = Math.max(m + 2, 6), gy0 = -4, gy1 = Math.max(a + 3, 5)
  const fF = (x) => (x < 0 ? NaN : a * Math.sqrt(x)), gF = (x) => k * x
  const dots = [[0, 0], [1, a], [m, 1]]
  const svg = fnGridSvg({
    gx0, gx1, gy0, gy1,
    plots: [{ fn: fF, xa: 0, xb: gx1, step: 0.01 }, { fn: gF, xa: gx0, xb: gx1 }],
    dots, ...gTicks(dots), labels: [markLabelAt(0, 0, "A", [fF, gF], { gx0, gx1, gy0, gy1 })],
  })
  return {
    condition_text: `На рисунке изображены графики функций видов f(x) = a${rT("x")} и g(x) = kx, пересекающиеся в точках A и B. Найдите абсциссу точки B.`,
    image_url: svgUrl(svg), answer: ru(xB),
  }
}

// Типажи с параметром: ОДИН И ТОТ ЖЕ экземпляр функции должен стоять и в
// GENERATORS, и в GEN_META — gen_key ищется по ТОЖДЕСТВУ функции (keyOfGen),
// а две одинаковые стрелки это разные объекты. Иначе ключ не проставится и по
// этим типажам не заработают «такая же задача с другими числами», тренировка
// листом и аналитика слабых типажей.
const t11HypPos = () => t11HypValue(1)
const t11HypNeg = () => t11HypValue(-1)
const t11ExpUp = () => t11ExpValue(true)
const t11ExpDown = () => t11ExpValue(false)
const t11LogUp = () => t11LogValue(true)
const t11LogDown = () => t11LogValue(false)

// ============================================================================
// №8 — ПРОИЗВОДНАЯ И ПЕРВООБРАЗНАЯ (чтение графиков, физ. смысл, касательная)
// ============================================================================
// Эталон — открытый банк ФИПИ. В банк взяты ТОЛЬКО типажи, встречавшиеся на
// реальных экзаменах (досрочная / основная / резервная волна); чисто «MATHEGE»-
// и «пробные» варианты (сумма точек экстремума, длина промежутка возрастания,
// подбор коэффициента параболы по касательной) исключены как не входящие в КИМ.
//
// Кривые строятся так, что знак производной, нули и экстремумы читаются
// однозначно, а ответ вычисляется кодом по построению — гарантированно верен.

const NUMW = { 1: "одна", 2: "две", 3: "три", 4: "четыре", 5: "пять", 6: "шесть", 7: "семь", 8: "восемь", 9: "девять", 10: "десять", 11: "одиннадцать" }
const ptsWord = (n) => `${NUMW[n]} точек`

// ── Рендер волнистого графика на координатной сетке ─────────────────────────
// fn — кривая; marks — [{x,label}] штрихи-точки на оси; tangent — {k,x0,y0};
// shade — {a,b} закрасить между кривой и осью; tickXvals — подписи делений оси x.
function wave8Svg({ gx0, gx1, gy0, gy1, fn, xa, xb, label = null, marks = [], markBelow = true, markItalic = true,
  dashX = [], shade = null, tangent = null, dots = [], openEnds = true, showUnit = true, tickXvals = null,
  guides = [], showUnitX = null, showUnitY = null, cell = 22, unitYRight = false }) {
  const m = 16, axOv = 13 // axOv — вынос оси x за крайние точки (px): стрелка и открытые концы не впритык
  const padX = m + cell              // +1 клетка-поле слева/справа: сетка обрамляет вынос оси, а не пустое поле
  const W = 2 * padX + (gx1 - gx0) * cell, H = 2 * m + (gy1 - gy0) * cell
  const X = (u) => padX + (u - gx0) * cell
  const Y = (v) => H - m - (v - gy0) * cell
  let g = ""
  for (let i = gx0 - 1; i <= gx1 + 1; i++) g += `<line x1="${X(i)}" y1="${Y(gy0)}" x2="${X(i)}" y2="${Y(gy1)}" stroke="${G_GRID}" stroke-width="1"/>`
  for (let j = gy0; j <= gy1; j++) g += `<line x1="${X(gx0 - 1)}" y1="${Y(j)}" x2="${X(gx1 + 1)}" y2="${Y(j)}" stroke="${G_GRID}" stroke-width="1"/>`
  if (shade) {
    let d = `M ${clean(X(shade.a))} ${clean(Y(0))} `
    const st = (shade.b - shade.a) / 160
    for (let x = shade.a; x <= shade.b + 1e-9; x += st) d += `L ${clean(X(x))} ${clean(Y(fn(x)))} `
    d += `L ${clean(X(shade.b))} ${clean(Y(0))} Z`
    g += `<path d="${d}" fill="#c9ced6" stroke="none"/>`
  }
  for (const x of dashX) g += `<line x1="${X(x)}" y1="${Y(0)}" x2="${X(x)}" y2="${clean(Y(fn(x)))}" stroke="${G_DASH}" stroke-width="1.2" stroke-dasharray="4 3"/>`
  // guides — узлы сетки на касательной: пунктирные сноски к делениям обеих осей.
  for (const p of guides) {
    if (p.x !== 0) g += `<line x1="${clean(X(p.x))}" y1="${clean(Y(p.y))}" x2="${clean(X(p.x))}" y2="${Y(0)}" stroke="${G_DASH}" stroke-width="1.2" stroke-dasharray="4 3"/>`
    if (p.y !== 0) g += `<line x1="${clean(X(p.x))}" y1="${clean(Y(p.y))}" x2="${X(0)}" y2="${clean(Y(p.y))}" stroke="${G_DASH}" stroke-width="1.2" stroke-dasharray="4 3"/>`
  }
  if (tangent) {
    const { k, x0, y0 } = tangent
    const ln = (x) => k * (x - x0) + y0
    let xl = null, xr = null
    for (let x = gx0; x <= gx1 + 1e-9; x += 0.02) { const y = ln(x); if (y >= gy0 && y <= gy1) { if (xl === null) xl = x; xr = x } }
    if (xl !== null) g += `<line x1="${clean(X(xl))}" y1="${clean(Y(ln(xl)))}" x2="${clean(X(xr))}" y2="${clean(Y(ln(xr)))}" stroke="${G_AX}" stroke-width="1.7"/>`
  }
  g += `<path d="${fnPath(fn, xa, xb, X, Y, gy0, gy1, (xb - xa) / 600)}" fill="none" stroke="${G_CURVE}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
  g += vecArrow(X(gx0) - axOv, Y(0), X(gx1) + axOv, Y(0), G_AX, 1.4)
  g += vecArrow(X(0), Y(gy0), X(0), Y(gy1), G_AX, 1.4)
  // «x» — над осью у стрелки, чтобы не сталкиваться с подписью крайнего деления снизу
  g += `<text x="${X(gx1) + axOv - 4}" y="${Y(0) - 6}" ${HALO} font-size="15" font-style="italic" font-weight="bold" fill="${G_AX}" text-anchor="end">x</text>`
  g += `<text x="${X(0) + 7}" y="${Y(gy1) + 13}" ${HALO} font-size="15" font-style="italic" font-weight="bold" fill="${G_AX}">y</text>`
  g += `<text x="${X(0) - 5}" y="${Y(0) + 16}" ${HALO} font-size="12" font-weight="bold" fill="${G_AX}" text-anchor="end">0</text>`
  const unitY = showUnitY === null ? showUnit : showUnitY
  const unitX = showUnitX === null ? showUnit : showUnitX
  // подпись единичного деления по y: слева от оси, а если там кривая — справа
  if (unitY && gy0 <= 1 && gy1 >= 1) g += `<text x="${X(0) + (unitYRight ? 6 : -6)}" y="${Y(1) + 4}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="${unitYRight ? "start" : "end"}">1</text>`
  if (unitX && !tickXvals && gx0 <= 1 && gx1 >= 1) g += `<text x="${X(1)}" y="${Y(0) + 16}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="middle">1</text>`
  if (tickXvals) for (const t of tickXvals) if (t.x >= gx0 && t.x <= gx1 && t.x !== 0) g += `<text x="${X(t.x)}" y="${Y(0) + 16}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="middle">${t.text}</text>`
  if (openEnds) for (const xe of [xa, xb]) { const ye = fn(xe); if (ye >= gy0 - 0.4 && ye <= gy1 + 0.4) g += `<circle cx="${X(xe)}" cy="${clean(Y(ye))}" r="3" fill="#fff" stroke="${G_CURVE}" stroke-width="1.6"/>` }
  for (const [x, y] of dots) g += `<circle cx="${X(x)}" cy="${clean(Y(y))}" r="3" fill="${G_AX}"/>`
  for (const mk of marks) {
    // подпись — на той стороне оси, где рядом нет кривой (иначе чёрная кривая перечёркивает xᵢ)
    const below = mk.below !== undefined ? mk.below : (fn ? fn(mk.x) >= 0 : markBelow)
    g += `<line x1="${X(mk.x)}" y1="${Y(0) - 4}" x2="${X(mk.x)}" y2="${Y(0) + 4}" stroke="${G_AX}" stroke-width="1.4"/>`
    g += `<text x="${X(mk.x)}" y="${below ? Y(0) + 16 : Y(0) - 8}" ${HALO} font-size="12"${markItalic ? ' font-style="italic"' : ""} fill="${G_AX}" text-anchor="middle">${mk.label}</text>`
  }
  for (const p of guides) {
    // подпись деления — по ДРУГУЮ сторону оси от узла: иначе её перечёркивает пунктир
    if (p.x !== 0) {
      g += `<line x1="${clean(X(p.x))}" y1="${Y(0) - 4}" x2="${clean(X(p.x))}" y2="${Y(0) + 4}" stroke="${G_AX}" stroke-width="1.4"/>`
      g += `<text x="${clean(X(p.x))}" y="${p.y >= 0 ? Y(0) + 16 : Y(0) - 8}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="middle">${ru(p.x)}</text>`
    }
    if (p.y !== 0) {
      const left = p.x >= 0                       // узел справа от оси y ⇒ подпись слева от неё
      g += `<line x1="${X(0) - 4}" y1="${clean(Y(p.y))}" x2="${X(0) + 4}" y2="${clean(Y(p.y))}" stroke="${G_AX}" stroke-width="1.4"/>`
      g += `<text x="${X(0) + (left ? -6 : 6)}" y="${clean(Y(p.y)) + 4}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="${left ? "end" : "start"}">${ru(p.y)}</text>`
    }
    g += `<circle cx="${clean(X(p.x))}" cy="${clean(Y(p.y))}" r="3" fill="${G_AX}"/>`
  }
  if (label) g += `<text x="${X(label.x)}" y="${Y(label.y)}" ${HALO} font-size="13" font-style="italic" fill="${G_AX}" text-anchor="${label.anchor || "middle"}">${label.text}</text>`
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`)
}

// Место для подписи «y = f(x)»: угол с максимальным вертикальным зазором до кривой.
// Центр подписи держим на halfW+margin от оси y (x=0), чтобы текст не наезжал на
// вертикальную ось и её стрелку; по горизонтали подпись целиком внутри поля.
function label8(fn, gx0, gx1, gy0, gy1, text, avoid = []) {
  const fns = Array.isArray(fn) ? fn : [fn]   // подпись обходит и кривую, и касательную
  const halfW = 1.25, gap = 0.4
  // допустимые центры слева/справа от оси y (пусто, если ось у самого края)
  const cxs = []
  const loL = gx0 + halfW + 0.3, hiL = -gap - halfW
  if (loL <= hiL) cxs.push((loL + hiL) / 2)
  const loR = gap + halfW, hiR = gx1 - halfW - 0.3
  if (loR <= hiR) cxs.push((loR + hiR) / 2)
  if (!cxs.length) cxs.push((gx0 + gx1) / 2)         // страховка: узкое поле
  const ys = [gy1 - 0.6, gy0 + 0.7]
  let best = { x: cxs[0], y: ys[0] }, bs = -1
  for (const cx of cxs) for (const cy of ys) {
    let clr = Infinity
    for (let x = cx - halfW; x <= cx + halfW; x += 0.1) {
      const xx = Math.min(gx1, Math.max(gx0, x))
      for (const f of fns) { const y = f(xx); if (isFinite(y)) clr = Math.min(clr, Math.abs(y - cy)) }
    }
    for (const [px, py] of avoid) if (Math.abs(px - cx) <= halfW + 0.5) clr = Math.min(clr, Math.abs(py - cy))
    if (clr > bs) { bs = clr; best = { x: cx, y: cy } }
  }
  return { ...best, text, anchor: "middle" }
}

// ── Движок 1: кривая-экстремумы (рисуемая кривая = f) ───────────────────────
// anchors=[[x,y]…] — точки с горизонтальной касательной; между ними косинусное
// сглаживание (монотонно). Внутренние якоря — экстремумы f.
function mkWaveExtrema(anchors) {
  const xs = anchors.map((a) => a[0]), ys = anchors.map((a) => a[1])
  const fn = (x) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1]
    let i = 0; while (i < xs.length - 1 && x > xs[i + 1]) i++
    const t = (x - xs[i]) / (xs[i + 1] - xs[i])
    return ys[i] + (ys[i + 1] - ys[i]) * (1 - Math.cos(Math.PI * t)) / 2
  }
  const ext = []
  for (let i = 1; i < anchors.length - 1; i++) ext.push({ x: xs[i], type: ys[i] > ys[i - 1] ? "max" : "min" })
  return { fn, ext, xs, ys }
}

// Собрать кривую-экстремумы по заданным абсциссам внутренних экстремумов.
// Крайние якоря вынесены за окно (концы кривой наклонные, как в ФИПИ).
function buildExtremaWaveAt(gx0, gx1, gy0, gy1, interiorXs, startDir) {
  const px = [gx0 - 1, ...interiorXs, gx1 + 1]
  const hi = gy1 - 0.7, lo = gy0 + 0.7
  let level = startDir > 0 ? "lo" : "hi"
  const anchors = px.map((x) => {
    const y = level === "lo" ? clean(lo + Math.random() * 0.8) : clean(hi - Math.random() * 0.8)
    level = level === "lo" ? "hi" : "lo"
    return [x, y]
  })
  return mkWaveExtrema(anchors)
}

// Случайные абсциссы внутренних экстремумов (не целые, разнесены по окну).
function buildExtremaWave(gx0, gx1, gy0, gy1, nInt, startDir) {
  const xs = []
  for (let t = 0; t < nInt; t++) xs.push(clean(gx0 + (gx1 - gx0) * (t + 1) / (nInt + 1) + (Math.random() - 0.5) * 0.7))
  return buildExtremaWaveAt(gx0, gx1, gy0, gy1, xs, startDir)
}

// Знак f′ в точке x для кривой-экстремумы (по направлению своего сегмента).
function dfSignExtrema(w, x) {
  let i = 0; while (i < w.xs.length - 1 && x > w.xs[i + 1]) i++
  if (i >= w.xs.length - 1) i = w.xs.length - 2
  return Math.sign(w.ys[i + 1] - w.ys[i])
}

// Отмеченные точки в интерьере монотонных участков (вдали от якорей).
function pickMarksExtrema(w, gx0, gx1, N) {
  const near = (x) => w.xs.some((a) => Math.abs(a - x) < 0.5)
  const cands = []
  // |f|≥0.45 — точка не на пересечении с осью, чтобы кривая не наезжала на подпись xᵢ
  // |x|>0.9 — подпись xᵢ не наезжает на «0» у начала координат (нуль сидит слева-снизу оси)
  for (let x = gx0 + 0.7; x <= gx1 - 0.7; x += 0.25) if (!near(x) && Math.abs(x) > 0.9 && Math.abs(w.fn(x)) >= 0.45) cands.push(clean(x))
  const chosen = []
  for (let k = 0; k < N && cands.length; k++) chosen.push(cands[Math.round((k + 0.5) / N * (cands.length - 1))])
  const uniq = []
  for (const x of chosen) if (!uniq.some((u) => Math.abs(u - x) < 0.7)) uniq.push(x)
  uniq.sort((a, b) => a - b)
  return uniq.map((x, i) => ({ x, label: "x" + subU(i + 1) }))
}

// ── Движок 2: кривая-производная (рисуемая кривая = f′), нули в целых roots ──
// Гладкая волна из полусинусов, меняющая знак в каждом корне; знак на интервале i
// = firstSign·(−1)^i; amps[i] — высота горба. Вне [roots0,rootsN] — хвосты того же
// интервала (без лишних нулей, если окно не выходит за один горб).
function mkDeriv(roots, amps, firstSign) {
  const n = roots.length
  const sgn = (i) => firstSign * (i % 2 === 0 ? 1 : -1)
  const fn = (x) => {
    let i
    if (x <= roots[0]) i = 0
    else if (x >= roots[n - 1]) i = n - 2
    else { i = 0; while (i < n - 1 && x > roots[i + 1]) i++ }
    const rL = roots[i], w = roots[i + 1] - roots[i]
    return sgn(i) * amps[i] * Math.sin(Math.PI * (x - rL) / w)
  }
  const typeAt = (r) => (fn(r - 0.05) > 0 ? "max" : "min") // f′: +→− ⇒ максимум f
  return { fn, roots, amps, firstSign, sgn, typeAt }
}

// Собрать f′ с корнями в целых точках. rootXs заданы; amps подобраны в окно.
function buildDeriv(gx0, gx1, gy1, rootXs, firstSign) {
  const amps = []
  for (let i = 0; i < rootXs.length - 1; i++) amps.push(clean(pick([1.6, 1.9, 2.2, 2.5, 2.8]).valueOf()))
  const b = mkDeriv(rootXs, amps, firstSign)
  return b
}

// Численный интеграл f′ от gx0 до x (для f = первообразной).
function integ(fn, x0, x1) { let s = 0; const K = 400, h = (x1 - x0) / K; for (let i = 0; i < K; i++) { const a = x0 + i * h; s += (fn(a) + fn(a + h)) / 2 * h } return s }

// Отмеченные точки на кривой-производной, где |f′|≥0.55 и вдали от корней.
function pickMarksDeriv(b, gx0, gx1, N) {
  const near = (x) => b.roots.some((r) => Math.abs(r - x) < 0.6)
  const cands = []
  // |x|>0.9 — подпись xᵢ не наезжает на «0» у начала координат (нуль сидит слева-снизу оси)
  for (let x = gx0 + 0.7; x <= gx1 - 0.7; x += 0.25) if (!near(x) && Math.abs(x) > 0.9 && Math.abs(b.fn(x)) >= 0.55) cands.push(clean(x))
  const chosen = []
  for (let k = 0; k < N && cands.length; k++) chosen.push(cands[Math.round((k + 0.5) / N * (cands.length - 1))])
  const uniq = []
  for (const x of chosen) if (!uniq.some((u) => Math.abs(u - x) < 0.7)) uniq.push(x)
  uniq.sort((a, b2) => a - b2)
  return uniq.map((x, i) => ({ x, label: "x" + subU(i + 1) }))
}

// ── Движок 3: сплайн Catmull–Rom через узлы (монотонные S-кривые) ────────────
function mkSpline(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  return (x) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1]
    let i = 0; while (i < xs.length - 1 && x > xs[i + 1]) i++
    const t = (x - xs[i]) / (xs[i + 1] - xs[i])
    const y0 = ys[i], y1 = ys[i + 1]
    const yp = i > 0 ? ys[i - 1] : y0 - (y1 - y0)
    const yn = i + 2 < ys.length ? ys[i + 2] : y1 + (y1 - y0)
    const m0 = (y1 - yp) / 2, m1 = (yn - y0) / 2, t2 = t * t, t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1
  }
}

// ============================================================================
// Группа A — дан график y=f(x), спрашивают про f′
// ============================================================================

// #1/#2 — сколько из отмеченных точек производная f′ положительна / отрицательна.
function t8fSignCount(positive) {
  const gx0 = -8, gx1 = 8, gy0 = -5, gy1 = 5
  let w, marks, want, tries = 0
  do {
    w = buildExtremaWave(gx0, gx1, gy0, gy1, randInt(3, 5), pick([1, -1]))
    marks = pickMarksExtrema(w, gx0, gx1, randInt(6, 8))
    want = marks.filter((m) => (dfSignExtrema(w, m.x) > 0) === positive).length
  } while ((marks.length < 6 || want < 1 || want > marks.length - 1) && ++tries < 60)
  return {
    condition_text: `На рисунке изображён график функции y = f(x). На оси абсцисс отмечены ${ptsWord(marks.length)}: ${marks.map((m) => m.label).join(", ")}. В скольких из этих точек производная функции f(x) ${positive ? "положительна" : "отрицательна"}?`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: w.fn, xa: gx0, xb: gx1, marks, showUnit: false, label: label8(w.fn, gx0, gx1, gy0, gy1, "y = f(x)") }),
    answer: ru(want),
  }
}

// #3 — количество точек, в которых f′(x)=0 (= число экстремумов f).
function t8fZeroCountAll() {
  const gx0 = -9, gx1 = 5, gy0 = -4, gy1 = 4
  const nInt = randInt(3, 6)
  const w = buildExtremaWave(gx0, gx1, gy0, gy1, nInt, pick([1, -1]))
  const cnt = w.ext.filter((e) => e.x > gx0 && e.x < gx1).length
  return {
    condition_text: `На рисунке изображён график функции y = f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). Найдите количество точек, в которых производная функции f(x) равна 0.`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: w.fn, xa: gx0, xb: gx1, tickXvals: [{ x: gx0, text: ru(gx0) }, { x: gx1, text: ru(gx1) }], label: label8(w.fn, gx0, gx1, gy0, gy1, "y = f(x)") }),
    answer: ru(cnt),
  }
}

// #4 — точка из отрезка [a;b], в которой f′(x)=0 (ровно один экстремум в отрезке).
function t8fZeroPointSeg() {
  const gx0 = -3, gx1 = 8, gy0 = -4, gy1 = 4
  // внутренние экстремумы — в ЦЕЛЫХ точках, чтобы ответ был точным.
  let exs, tries = 0
  do {
    exs = []
    let x = gx0 + randInt(2, 3)
    while (x <= gx1 - 2) { exs.push(x); x += randInt(2, 3) }
  } while (exs.length < 2 && ++tries < 20)
  const w = buildExtremaWaveAt(gx0, gx1, gy0, gy1, exs, pick([1, -1]))
  // отрезок [a;b] ровно с одним экстремумом
  const target = pick(exs)
  let a = Math.max(target - randInt(1, 2), gx0 + 1), b = Math.min(target + randInt(1, 2), gx1 - 1)
  // сузить, если попал ещё один экстремум
  while (exs.some((e) => e !== target && e >= a && e <= b)) { if (exs.some((e) => e !== target && e <= target && e >= a)) a++; else b-- }
  return {
    condition_text: `На рисунке изображён график дифференцируемой функции y = f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). Найдите точку из отрезка [${ru(a)}; ${ru(b)}], в которой производная функции f(x) равна 0.`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: w.fn, xa: gx0, xb: gx1, dashX: [target], tickXvals: [{ x: gx0, text: ru(gx0) }, { x: gx1, text: ru(gx1) }], label: label8(w.fn, gx0, gx1, gy0, gy1, "y = f(x)") }),
    answer: ru(target),
  }
}

// #5 — количество решений уравнения f′(x)=0 на отрезке [a;b].
function t8fZeroCountSeg() {
  const gx0 = -6, gx1 = 6, gy0 = -4, gy1 = 5
  const w = buildExtremaWave(gx0, gx1, gy0, gy1, randInt(4, 6), pick([1, -1]))
  const exs = w.ext.map((e) => e.x).filter((x) => x > gx0 && x < gx1)
  const a = -4.5, b = 2.5
  const cnt = exs.filter((x) => x >= a && x <= b).length
  return {
    condition_text: `На рисунке изображён график функции y = f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). Найдите количество решений уравнения f′(x) = 0 на отрезке [${ru(a)}; ${ru(b)}].`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: w.fn, xa: gx0, xb: gx1, tickXvals: [{ x: gx0, text: ru(gx0) }, { x: gx1, text: ru(gx1) }], label: label8(w.fn, gx0, gx1, gy0, gy1, "y = f(x)") }),
    answer: ru(cnt),
  }
}

// #6 — количество целых точек, в которых f′ положительна / отрицательна.
function t8fIntSign(positive) {
  const gx0 = -7, gx1 = 7, gy0 = -4, gy1 = 4
  let w, cnt, tries = 0
  do {
    // экстремумы в ПОЛУцелых точках ⇒ на всех целых x производная заведомо ≠ 0.
    const nInt = randInt(3, 5), xs = []
    for (let t = 0; t < nInt; t++) { const p = Math.round(gx0 + (gx1 - gx0) * (t + 1) / (nInt + 1) - 0.5) + 0.5; if (!xs.includes(p)) xs.push(p) }
    w = buildExtremaWaveAt(gx0, gx1, gy0, gy1, xs, pick([1, -1]))
    cnt = 0
    for (let x = gx0 + 1; x <= gx1 - 1; x++) if ((dfSignExtrema(w, x) > 0) === positive) cnt++
  } while ((cnt < 2 || cnt > (gx1 - gx0 - 3)) && ++tries < 60)
  return {
    condition_text: `На рисунке изображён график функции y = f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). Определите количество целых точек, в которых производная функции ${positive ? "положительна" : "отрицательна"}.`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: w.fn, xa: gx0, xb: gx1, tickXvals: [{ x: gx0, text: ru(gx0) }, { x: gx1, text: ru(gx1) }], label: label8(w.fn, gx0, gx1, gy0, gy1, "y = f(x)") }),
    answer: ru(cnt),
  }
}

// ── Волна «как на бланке»: горбы РАЗНОЙ высоты вокруг общей базовой линии ────
// Экстремумы стоят через клетку, но НЕ в серединах между отмеченными целыми
// точками (фаза сдвинута): иначе кривая пересекала бы ось ровно в отмеченной
// точке и перечёркивала её подпись, чего на бланке ФИПИ не бывает.
function buildWiggleWave(gx0, gx1, gy0, gy1, c) {
  const lo = gy0 + 0.4, hi = gy1 - 0.4
  const upA = hi - c, dnA = c - lo
  const share = [0.35, 0.5, 0.65, 0.8, 1]                        // высота горба — своя у каждого
  const ph = pick([0.25, 0.3, 0.7, 0.75])                        // сдвиг фазы: экстремумы не в серединах
  const xs = []
  for (let x = gx0 - 1 + ph; x <= gx1 + 1; x += pick([1, 1, 1, 1.5])) xs.push(clean(x))
  let dir = pick([1, -1])
  const anchors = xs.map((x) => {
    const amp = Math.max(0.4, (dir > 0 ? upA : dnA) * pick(share))
    const y = clean(c + dir * amp)
    dir = -dir
    return [x, y]
  })
  return mkWaveExtrema(anchors)
}

// Сторона оси, на которой подпись отметки не перечёркивается кривой.
// Цифра при cell = 32 занимает полосу 0,12…0,62 клетки под осью (и 0,12…0,72 над
// ней), в ширину — ±0,2 клетки; по умолчанию подпись под осью, как на бланке ФИПИ.
function markSide8(fn, x) {
  let okDn = true, okUp = true
  for (let t = x - 0.2; t <= x + 0.2 + 1e-9; t += 0.04) {
    const y = fn(t)
    if (y > -0.62 && y < -0.12) okDn = false
    if (y > 0.12 && y < 0.72) okUp = false
  }
  return { below: okDn || !okUp, ok: okDn || okUp }
}

// Зазор между подписью «y = f(x)» и кривой (в клетках): подпись не должна
// ложиться на график — на бланке она всегда стоит в свободном месте поля.
function labelClear8(fn, lab, gx0, gx1) {
  let clr = Infinity
  for (let x = lab.x - 1.3; x <= lab.x + 1.3; x += 0.1) {     // «y = f(x)» — ≈2,6 клетки при cell = 32
    const y = fn(Math.min(gx1, Math.max(gx0, x)))
    if (isFinite(y)) clr = Math.min(clr, Math.abs(y - lab.y))
  }
  return clr
}

// #28/#29 — в какой из отмеченных точек значение f′ наибольшее / наименьшее.
// Рисунок строго по образцу ФИПИ: окно в шесть клеток по x, ЧЕТЫРЕ отмеченные
// целые точки, подписанные своими значениями ПОД осью прямым шрифтом (курсив на
// бланке только у xᵢ), единичное деление — лишь на оси y (подпись «1» у оси x
// столкнулась бы с подписью самой отметки), концы кривой без белых кружков.
function t8fDerivExtreme(greatest) {
  const gx0 = pick([-2, -2, -1]), gx1 = gx0 + 6   // уже — и подписи «y = f(x)» негде встать
  const [gy0, gy1] = pick([[-3, 2], [-2, 3], [-3, 3]])
  const sgn = greatest ? 1 : -1
  const slope = (fn, x) => clean((fn(x + 0.02) - fn(x - 0.02)) / 0.04)
  // базовая линия колебаний — ЧУТЬ ВЫШЕ оси, как на бланке: если вести её по самой
  // оси, кривая всё время идёт по подписям отметок и рисунок не собрать
  const c = clean(Math.min(gy1 - 1.5, 0.35 + Math.random() * 0.5))
  let w = null, lab = null, marksX = null, best = null, unitRight = false
  for (let tries = 0; tries < 400 && best === null; tries++) {
    // на бланке ФИПИ ВСЕ подписи отметок стоят под осью; наверх пускаем точку,
    // только если четырёх «нижних» не нашлось за первые 300 попыток
    const strictBelow = tries < 300
    w = buildWiggleWave(gx0, gx1, gy0, gy1, c)
    // подпись «1» у оси y не должна оказаться под кривой: если слева занято —
    // ставим её справа от оси (отбраковывать кривую нельзя, это перекашивает ответы)
    const busy = (a, b) => { for (let x = a; x <= b + 1e-9; x += 0.04) if (w.fn(x) > 0.7 && w.fn(x) < 1.15) return true; return false }
    unitRight = busy(-0.5, -0.12)
    if (unitRight && busy(0.12, 0.5)) continue
    // кандидаты — целые точки окна, кроме нуля (там подпись «0») и правого края;
    // берём только те, у которых кривая не ложится на подпись отметки
    const cands = []
    for (let x = gx0; x <= gx1 - 1; x++) {
      if (x === 0) continue
      const side = markSide8(w.fn, x)
      if (side.ok && (side.below || !strictBelow)) cands.push({ x, d: slope(w.fn, x), below: side.below })
    }
    if (cands.length < 4) continue
    const top = cands.slice().sort((p, q) => sgn * (q.d - p.d))[0]
    // остальные три — с запасом в 1,5 клетки наклона: ответ виден, а не угадывается
    const rest = cands.filter((c2) => c2.x !== top.x && sgn * (top.d - c2.d) >= 1.5)
    if (Math.abs(top.d) < 2 || rest.length < 3) continue
    const three = []
    while (three.length < 3) three.push(rest.splice(randInt(0, rest.length - 1), 1)[0].x)
    const xs = [top.x, ...three].sort((a, b) => a - b)
    if (xs[3] - xs[0] < 3) continue          // точки по всему окну, а не кучкой
    // «y = f(x)» ставим туда, где кривой нет: перебираем оба ряда и всю полосу
    // справа от оси y (левее подпись при таком окне не помещается)
    lab = null
    let bestClr = 0.6
    for (const ly of [gy1 - 0.6, gy0 + 0.7]) {
      for (let lx = 1.55; lx <= gx1 - 1.45 + 1e-9; lx += 0.1) {
        const cand = { x: clean(lx), y: ly, text: "y = f(x)", anchor: "middle" }
        const clr = labelClear8(w.fn, cand, gx0, gx1)
        if (clr > bestClr) { bestClr = clr; lab = cand }
      }
    }
    if (!lab) continue
    marksX = xs; best = top.x
  }
  const fn = w.fn
  if (best === null) {                       // страховка от вечного цикла: берём максимальный отрыв
    const cands = []
    for (let x = gx0; x <= gx1 - 1; x++) if (x !== 0) cands.push({ x, d: slope(fn, x) })
    cands.sort((p, q) => sgn * (q.d - p.d))
    best = cands[0].x
    marksX = [cands[0].x, ...cands.slice(-3).map((c) => c.x)].sort((a, b) => a - b)
  }
  const marks = marksX.map((x) => ({ x, label: ru(x), below: markSide8(fn, x).below }))
  return {
    condition_text: `На рисунке изображён график функции y = f(x). На оси абсцисс отмечены точки ${marksX.map(ru).join(", ")}. В какой из этих точек значение производной функции ${greatest ? "наибольшее" : "наименьшее"}? В ответе укажите эту точку.`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn, xa: gx0, xb: gx1, marks, markItalic: false, openEnds: false, tickXvals: [], label: lab, cell: 32, unitYRight: unitRight }),
    answer: ru(best),
  }
}

// #30 — количество точек, где касательная параллельна горизонтали (= экстремумы f).
function t8fHorizTangent() {
  const gx0 = -4, gx1 = 13, gy0 = -7, gy1 = 3
  const nInt = randInt(4, 6)
  const w = buildExtremaWave(gx0, gx1, gy0, gy1, nInt, pick([1, -1]))
  const cnt = w.ext.filter((e) => e.x > gx0 && e.x < gx1).length
  return {
    condition_text: `На рисунке изображён график функции y = f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). Определите количество точек, в которых касательная к графику функции y = f(x) параллельна прямой y = ${ru(randInt(6, 20))}.`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: w.fn, xa: gx0, xb: gx1, tickXvals: [{ x: gx0, text: ru(gx0) }, { x: gx1, text: ru(gx1) }], label: label8(w.fn, gx0, gx1, gy0, gy1, "y = f(x)") }),
    answer: ru(cnt),
  }
}

// ============================================================================
// Группа B — дан график y=f′(x), спрашивают про f
// ============================================================================

// #8/#9 — сколько из отмеченных точек лежат на промежутках возрастания / убывания f.
function t8dIncDec(increasing) {
  const gx0 = -9, gx1 = 8, gy1 = 4, gy0 = -4
  let b, marks, want = 0, tries = 0
  do {
    const nr = randInt(3, 5)
    const roots = []
    let x = gx0 + randInt(1, 2)
    for (let i = 0; i < nr; i++) { roots.push(x); x += randInt(2, 3) }
    if (roots[roots.length - 1] >= gx1 - 1) { tries++; continue }
    b = buildDeriv(gx0, gx1, gy1, roots, pick([1, -1]))
    marks = pickMarksDeriv(b, gx0, gx1, randInt(6, 8))
    want = marks.filter((m) => (b.fn(m.x) > 0) === increasing).length
  } while ((!marks || marks.length < 6 || want < 1 || want > marks.length - 1) && ++tries < 80)
  return {
    condition_text: `На рисунке изображён график y = f′(x) — производной функции f(x). На оси абсцисс отмечены ${ptsWord(marks.length)}: ${marks.map((m) => m.label).join(", ")}. Сколько из этих точек лежат на промежутках ${increasing ? "возрастания" : "убывания"} функции f(x)?`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: b.fn, xa: gx0, xb: gx1, marks, showUnit: false, label: label8(b.fn, gx0, gx1, gy0, gy1, "y = f′(x)") }),
    answer: ru(want),
  }
}

// Собрать f′ с целыми корнями внутри окна; вернуть {b, roots}.
function makeDerivRoots(gx0, gx1, gy1, nr, firstSign) {
  const roots = []
  let x = gx0 + randInt(1, 2)
  for (let i = 0; i < nr; i++) { roots.push(x); x += randInt(2, 3) }
  if (roots[roots.length - 1] > gx1 - 1) return null
  return buildDeriv(gx0, gx1, gy1, roots, firstSign)
}

// #10/#14/#15 — количество точек экстремума / максимума / минимума f на отрезке [a;b].
function t8dExtremaCount(kind) {
  const gx0 = -9, gx1 = 8, gy0 = -4, gy1 = 4
  let b, tries = 0
  do { b = makeDerivRoots(gx0, gx1, gy1, randInt(4, 6), pick([1, -1])) } while (!b && ++tries < 40)
  const a = gx0 + 2, bb = gx1 - 1
  const inseg = b.roots.filter((r) => r >= a && r <= bb)
  const cnt = kind === "any" ? inseg.length : inseg.filter((r) => b.typeAt(r) === kind).length
  const word = kind === "any" ? "экстремума" : kind === "max" ? "максимума" : "минимума"
  return {
    condition_text: `На рисунке изображён график y = f′(x) — производной функции f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). Найдите количество точек ${word} функции f(x), принадлежащих отрезку [${ru(a)}; ${ru(bb)}].`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: b.fn, xa: gx0, xb: gx1, tickXvals: [{ x: gx0, text: ru(gx0) }, { x: gx1, text: ru(gx1) }], label: label8(b.fn, gx0, gx1, gy0, gy1, "y = f′(x)") }),
    answer: ru(cnt),
  }
}

// #11 — точка экстремума f на отрезке [a;b] (ровно один корень f′ в отрезке).
function t8dExtremumPoint() {
  const gx0 = -9, gx1 = 8, gy0 = -4, gy1 = 4
  let b, a, bb, inseg, tries = 0
  do {
    b = makeDerivRoots(gx0, gx1, gy1, randInt(3, 5), pick([1, -1]))
    if (!b) continue
    const r = pick(b.roots)
    a = r - randInt(1, 2); bb = r + randInt(1, 2)
    a = Math.max(a, gx0 + 1); bb = Math.min(bb, gx1 - 1)
    inseg = b.roots.filter((x) => x >= a && x <= bb)
  } while ((!b || inseg.length !== 1) && ++tries < 80)
  return {
    condition_text: `На рисунке изображён график y = f′(x) — производной функции f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). Найдите точку экстремума функции f(x) на отрезке [${ru(a)}; ${ru(bb)}].`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: b.fn, xa: gx0, xb: gx1, dashX: [inseg[0]], tickXvals: [{ x: gx0, text: ru(gx0) }, { x: gx1, text: ru(gx1) }], label: label8(b.fn, gx0, gx1, gy0, gy1, "y = f′(x)") }),
    answer: ru(inseg[0]),
  }
}

// #12/#13 — точка максимума / минимума f (ровно одна нужного типа во всём окне).
function t8dOptPoint(kind) {
  const gx0 = -3, gx1 = 8, gy0 = -4, gy1 = 4
  let b, want, tries = 0
  do {
    b = makeDerivRoots(gx0, gx1, gy1, randInt(2, 4), pick([1, -1]))
    if (!b) continue
    want = b.roots.filter((r) => b.typeAt(r) === kind)
  } while ((!b || want.length !== 1) && ++tries < 100)
  return {
    condition_text: `На рисунке изображён график функции y = f′(x) — производной функции f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). Найдите точку ${kind === "max" ? "максимума" : "минимума"} функции f(x).`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: b.fn, xa: gx0, xb: gx1, dashX: [want[0]], tickXvals: [{ x: gx0, text: ru(gx0) }, { x: gx1, text: ru(gx1) }], label: label8(b.fn, gx0, gx1, gy0, gy1, "y = f′(x)") }),
    answer: ru(want[0]),
  }
}

// #18–#21 — точка отрезка [a;b], в которой f принимает наиб. / наим. значение.
function t8dArgOpt(greatest) {
  const gx0 = -9, gx1 = 6, gy0 = -4, gy1 = 4
  let b, a, bb, best, tries = 0
  do {
    b = makeDerivRoots(gx0, gx1, gy1, randInt(3, 5), pick([1, -1]))
    if (!b) continue
    a = gx0 + randInt(1, 2); bb = a + randInt(3, 5); bb = Math.min(bb, gx1 - 1)
    const cand = [a, bb, ...b.roots.filter((r) => r > a && r < bb)]
    const Fv = cand.map((x) => ({ x, F: integ(b.fn, gx0, x) }))
    Fv.sort((p, q) => greatest ? q.F - p.F : p.F - q.F)
    best = (Math.abs(Fv[0].F - Fv[1].F) > 0.25) ? Fv[0].x : null
  } while ((best === null) && ++tries < 100)
  return {
    condition_text: `На рисунке изображён график y = f′(x) — производной функции f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). В какой точке отрезка [${ru(a)}; ${ru(bb)}] функция f(x) принимает ${greatest ? "наибольшее" : "наименьшее"} значение?`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: b.fn, xa: gx0, xb: gx1, tickXvals: [{ x: gx0, text: ru(gx0) }, { x: gx1, text: ru(gx1) }], label: label8(b.fn, gx0, gx1, gy0, gy1, "y = f′(x)") }),
    answer: ru(best),
  }
}

// #31/#33 — абсцисса точки, где касательная к f параллельна y=kx (f′=k), единственная.
// k=0 ⇒ параллельна оси абсцисс (#33). Строим монотонную S-кривую f′ через узел (x0,k).
function t8dDerivEqPoint(k) {
  const gx0 = -4, gx1 = 6, gy0 = -4, gy1 = 4
  const lo = gy0 + 0.5, hi = gy1 - 0.5
  // возрастающая последовательность из cnt случайных положительных шагов: from→to.
  const ramp = (from, to, cnt) => {
    if (cnt <= 0) return [from]
    const inc = []; let acc = 0
    for (let i = 0; i < cnt; i++) { const v = 0.5 + Math.random(); inc.push(v); acc += v }
    const sc = (to - from) / acc, out = [from]
    for (let i = 0; i < cnt; i++) out.push(clean(out[i] + inc[i] * sc))
    return out
  }
  let fn, x0, tries = 0
  do {
    x0 = randInt(gx0 + 2, gx1 - 2)
    // две возрастающие ветви: lo→k слева, k→hi справа; узел x0 = ровно k
    const left = ramp(lo, k, x0 - gx0), right = ramp(k, hi, gx1 - x0)
    const nodes = [...left.slice(0, left.length - 1), ...right].map((y, i) => [gx0 + i, y])
    fn = mkSpline(nodes)
    let mono = true; for (let x = gx0; x < gx1 - 0.05; x += 0.1) if (fn(x + 0.1) <= fn(x)) { mono = false; break }
    let cr = 0; for (let x = gx0 + 0.017; x < gx1; x += 0.05) if ((fn(x) - k) * (fn(x + 0.05) - k) < 0) cr++
    if (mono && cr === 1) break
  } while (++tries < 150)
  const cond = k === 0
    ? `На рисунке изображён график y = f′(x) — производной функции f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). Найдите абсциссу точки, в которой касательная к графику функции y = f(x) параллельна оси абсцисс или совпадает с ней.`
    : `На рисунке изображён график y = f′(x) — производной функции f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). Найдите абсциссу точки, в которой касательная к графику функции y = f(x) параллельна прямой y = ${ru(k)}x или совпадает с ней.`
  return {
    condition_text: cond,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn, xa: gx0, xb: gx1, dashX: [x0], tickXvals: [{ x: gx0, text: ru(gx0) }, { x: gx1, text: ru(gx1) }], label: label8(fn, gx0, gx1, gy0, gy1, "y = f′(x)") }),
    answer: ru(x0),
  }
}

// #32 — количество точек, где касательная к f параллельна прямой y=kx+b (f′=k).
function t8dDerivEqCount() {
  const gx0 = -4, gx1 = 13, gy0 = -6, gy1 = 3
  const k = pick([-2, -1, 1, 2])
  let w, cnt, tries = 0
  do {
    w = buildExtremaWave(gx0, gx1, gy0, gy1, randInt(4, 6), pick([1, -1]))
    cnt = 0
    for (let x = gx0 + 0.517; x < gx1 - 0.5; x += 0.05) if ((w.fn(x) - k) * (w.fn(x + 0.05) - k) < 0) cnt++
  } while ((cnt < 2 || cnt > 6) && ++tries < 60)
  const b0 = randInt(3, 12) * (k < 0 ? 1 : -1)
  return {
    condition_text: `На рисунке изображён график y = f′(x) — производной функции f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). Найдите количество точек, в которых касательная к графику функции y = f(x) параллельна прямой y = ${k === 1 ? "" : k === -1 ? "−" : ru(k)}x ${signed(b0)} или совпадает с ней.`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: w.fn, xa: gx0, xb: gx1, tickXvals: [{ x: gx0, text: ru(gx0) }, { x: gx1, text: ru(gx1) }], label: label8(w.fn, gx0, gx1, gy0, gy1, "y = f′(x)") }),
    answer: ru(cnt),
  }
}

// ============================================================================
// Группа C — касательная на графике f(x): значение f′(x₀) = угловой коэффициент
// ============================================================================
// Строго по виду ФИПИ: наклон снимается по ДВУМ узлам сетки, лежащим на
// касательной, — у каждого свой пунктир к подписанному делению оси (точка на самой
// оси подписывается без пунктира). Точка касания отмечена своим пунктиром и
// подписью x₀, её абсцисса НЕцелая: по ней наклон не снимешь, читать надо узлы.
// k = Δy/Δx строится кодом — ответ гарантированно совпадает с чертежом.

// Наклоны из реальных заданий: ответ — короткая десятичная запись.
const TAN_SLOPES = [0.2, 0.25, 0.4, 0.5, 0.6, 0.75, 0.8, 1, 1.25, 1.5, 2, 3]
// Три формулировки открытого банка — различаются только вводным оборотом.
const TAN_TEXTS = [
  "На рисунке изображены график функции y = f(x) и касательная к нему в точке с абсциссой x₀. Найдите значение производной функции f(x) в точке x₀.",
  "На рисунке изображены график функции y = f(x) и касательная к этому графику, проведённая в точке с абсциссой x₀. Найдите значение производной функции f(x) в точке x₀.",
  "На рисунке изображены график дифференцируемой функции y = f(x) и касательная к нему в точке с абсциссой x₀. Найдите значение производной функции f(x) в точке x₀.",
]

function t8tangentSlope() {
  for (let att = 0; att < 400; att++) {
    const k = clean(pick(TAN_SLOPES) * pick([1, -1]))
    let dx = 1
    while (!Number.isInteger(clean(k * dx))) dx++          // Δx, при котором Δy целое: оба узла — на сетке
    dx *= pick(dx >= 5 ? [1] : dx >= 3 ? [1, 2] : dx === 2 ? [1, 2, 3] : [2, 3, 4])
    const dy = clean(k * dx)                               // узлы разнесены минимум на 2 клетки: наклон снимается точно
    if (dx > 10 || Math.abs(dy) > 12) continue
    const x1 = randInt(-6, 2), x2 = x1 + dx
    const y1 = randInt(-5, 4), y2 = clean(y1 + dy)
    // Абсцисса касания — нецелая и в стороне от узлов, от нуля и от единичного
    // деления (иначе подписи наезжают). Держим её там, где касательная ещё не ушла
    // из окна по вертикали: у крутых наклонов это узкая полоса вокруг узлов.
    const span = Math.max(1.7, 1 / Math.abs(k))
    const x0 = clean(randInt(Math.ceil(x1 - span), Math.floor(x2 + span)) + pick([-0.6, -0.5, -0.4, 0.4, 0.5, 0.6]))
    if ([x1, x2].some((t) => Math.abs(x0 - t) < 1.2) || Math.abs(x0) < 1.2 || Math.abs(x0 - 1) < 1.2) continue
    const y0 = clean(y1 + k * (x0 - x1))
    // окно: целые границы (иначе сетка съедет с решётки), обе оси внутри с полем
    const gx0 = Math.min(x1, 0, Math.floor(x0)) - randInt(1, 2)
    const gx1 = Math.max(x2, 0, Math.ceil(x0)) + randInt(1, 2)
    const gy0 = Math.min(y1, y2, 0, Math.floor(y0)) - randInt(1, 2)
    const gy1 = Math.max(y1, y2, 0, Math.ceil(y0)) + randInt(1, 2)
    if (gx1 - gx0 < 8 || gx1 - gx0 > 13 || gy1 - gy0 < 8 || gy1 - gy0 > 15) continue

    // Кривая = касательная + отклонение с двойным нулём в x₀: касание там и только
    // там (отклонение обращается в ноль лишь при u=0). Нечётное отклонение даёт
    // перегиб (кривая переходит на другую сторону касательной), чётное — касание
    // с одной стороны. Множитель-волна (всегда > 0) добавляет горбы, как в ФИПИ,
    // и лишнего касания создать не может.
    const sgn = pick([1, -1]), inflect = Math.random() < 0.5
    const L = 2.4 + Math.random() * 1.4                    // где отклонение переходит от параболы к росту
    // у крутой касательной кривая видна лишь пару клеток — там отклонение должно
    // расти быстрее, иначе кривая неотличима от прямой (и типаж k=±3 не собирается)
    const D = (inflect ? 0.16 + Math.random() * 0.1 : 0.28 + Math.random() * 0.18) * Math.max(1, Math.abs(k))
    const ph = Math.random() * 2 * Math.PI, wq = 0.5 + Math.random() * 0.35
    const line = (x) => y0 + k * (x - x0)
    const fn = (x) => {
      const u = x - x0
      const dev = (inflect ? u * u * u : u * u) / (1 + Math.abs(u) / L) * (1 + 0.3 * Math.sin(wq * u + ph))
      return line(x) + sgn * D * dev
    }
    // у точки касания кривая должна идти в окне сплошным куском, а узлы — не залипать на ней
    // Крутая касательная сама уходит из окна за три-четыре клетки, поэтому нужный
    // кусок кривой считаем от наклона: иначе крутые типажи (k = ±2, ±3) отсеются целиком.
    const need = Math.min(5.5, 0.8 * (gy1 - gy0) / Math.max(1, Math.abs(k)))
    let lo = x0, hi = x0
    while (lo > gx0 && fn(lo - 0.1) > gy0 + 0.3 && fn(lo - 0.1) < gy1 - 0.3) lo -= 0.1
    while (hi < gx1 && fn(hi + 0.1) > gy0 + 0.3 && fn(hi + 0.1) < gy1 - 0.3) hi += 0.1
    if (hi - lo < need || x0 - lo < need / 2.8 || hi - x0 < need / 2.8) continue
    let near = Infinity, apart = 0
    for (let x = gx0; x <= gx1 + 1e-9; x += 0.05) {
      const y = fn(x)
      if (y >= gy0 && y <= gy1) apart = Math.max(apart, Math.abs(y - line(x)))
      for (const [px, py] of [[x1, y1], [x2, y2]]) near = Math.min(near, Math.hypot(x - px, y - py))
    }
    if (apart < Math.min(1.6, 0.4 * need) || near < 0.6) continue  // кривая слипается с касательной или с узлом

    // подпись «y = f(x)»: обходит обе линии, узлы и подписи делений у обеих осей
    const tag = label8([fn, line], gx0, gx1, gy0, gy1, "y = f(x)",
      [[x1, y1], [x2, y2], [x0, y0], [0, y1], [0, y2], ...Array.from({ length: gx1 - gx0 + 1 }, (_, i) => [gx0 + i, 0])])
    if (Math.abs(tag.y) < 1.3) continue                    // подпись легла бы в строку подписей оси x
    // …или в подпись деления у оси y (она стоит с той стороны оси, где нет узла)
    if ([[y1, x1 >= 0], [y2, x2 >= 0]].some(([yy, left]) =>
      Math.abs(tag.y - yy) < 0.8 && left === (tag.x < 0) && Math.abs(tag.x) < 2.6)) continue

    return {
      condition_text: pick(TAN_TEXTS),
      image_url: wave8Svg({
        gx0, gx1, gy0, gy1, fn, xa: gx0, xb: gx1,
        tangent: { k, x0, y0 }, dashX: [x0], dots: [[x0, y0]],
        marks: [{ x: x0, label: "x" + subU(0), below: y0 >= 0 }],
        guides: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
        openEnds: false,
        showUnitX: x1 !== 1 && x2 !== 1,
        showUnitY: y1 !== 1 && y2 !== 1,
        label: tag,
      }),
      answer: ru(k),
    }
  }
  return t8tangentSlope()
}

// ============================================================================
// Группа D — физический смысл производной (прямолинейное движение)
// ============================================================================

// #26 — x(t)=a·t²+b·t+c, найти скорость v(t₀)=2a·t₀+b.
function t8kinVelocityAt() {
  const [an, ad] = pick([[1, 2], [1, 6], [1, 4], [1, 3], [1, 1]])
  let b, c, t0, tries = 0
  do { b = randInt(2, 9); c = randInt(5, 40); t0 = ad === 1 ? randInt(2, 9) : randInt(1, 4) * ad } while (!Number.isInteger(2 * an / ad * t0) && ++tries < 40)
  const v = clean(2 * an / ad * t0 + b)
  const aStr = an === ad ? "t²" : `${fT(an, ad)}t²`
  return {
    condition_text: `Материальная точка движется прямолинейно по закону x(t) = ${aStr} ${signed(b)}t ${signed(c)}, где x — расстояние от точки отсчёта в метрах, t — время в секундах, измеренное с момента начала движения. Найдите её скорость (в метрах в секунду) в момент времени t = ${ru(t0)} с.`,
    answer: ru(v),
  }
}

// #27 — x(t)=⅙t³+b·t²+c·t+d, найти момент, когда скорость v=V. v=½t²+2b·t+c.
function t8kinTimeForVelocity() {
  let b, c, d, T, V, tries = 0
  do {
    T = pick([4, 6, 8, 10, 12, 14, 16, 18])   // чётное T ⇒ V целое
    b = pick([-4, -3, -2, -1, 1, 2]); c = randInt(-9, 9); d = randInt(100, 300)
    V = clean(T * T / 2 + 2 * b * T + c)
  } while ((V <= 0 || !Number.isInteger(V) || (c - V) >= 0) && ++tries < 80)
  // v=½t²+2b·t+c=V ⇒ ½t²+2b·t+(c−V)=0; произведение корней 2(c−V)<0 ⇒ ровно один t>0=T
  const bStr = `${signed(b)}t²`
  const cStr = `${signed(c)}t`
  return {
    condition_text: `Материальная точка движется прямолинейно по закону x(t) = ${fT(1, 6)}t³ ${bStr} ${cStr} ${signed(d)}, где x — расстояние от точки отсчёта в метрах, t — время в секундах, измеренное с момента начала движения. В какой момент времени (в секундах) её скорость была равна ${ru(V)} м/с?`,
    answer: ru(T),
  }
}

// ============================================================================
// Группа E — касательная (аналитически): прямая касается параболы, найти c
// ============================================================================
function t8tangentParabC() {
  const a = pick([1, 4])
  // касание: y=kx+b ∥ y=a·x²+p·x+c ⇒ a·x²+(p−k)x+(c−b)=0, D=0 ⇒ c=b+(p−k)²/(4a).
  // Берём p−k=δ, кратное 2a ⇒ δ²/(4a) — целое ⇒ c целый. Всегда корректно.
  const delta = a === 1 ? pick([2, -2, 4, -4]) : pick([8, -8])
  let k, p, tries = 0
  do { k = randInt(-8, 8); p = k + delta } while (Math.abs(p) > 8 && ++tries < 40)
  if (Math.abs(p) > 8) { k = delta > 0 ? -8 : 8; p = k + delta }
  const b = randInt(-9, 9), c = b + delta * delta / (4 * a)
  const aStr = a === 1 ? "" : ru(a)
  return {
    condition_text: `Прямая y = ${k === 1 ? "" : k === -1 ? "−" : ru(k)}x ${signed(b)} является касательной к графику функции y = ${aStr}x² ${signed(p)}x + c. Найдите c.`,
    answer: ru(c),
  }
}

// ============================================================================
// Группа F — график первообразной F(x) и площадь
// ============================================================================

// #39/#40 — сколько из отмеченных точек функция f=F′ положительна / отрицательна
// (F возрастает ⇔ f>0).
function t8Fsign(positive) {
  const gx0 = -8, gx1 = 8, gy0 = -4, gy1 = 4
  let w, marks, want, tries = 0
  do {
    w = buildExtremaWave(gx0, gx1, gy0, gy1, randInt(3, 5), pick([1, -1]))
    marks = pickMarksExtrema(w, gx0, gx1, randInt(7, 9))
    want = marks.filter((m) => (dfSignExtrema(w, m.x) > 0) === positive).length
  } while ((marks.length < 7 || want < 1 || want > marks.length - 1) && ++tries < 60)
  return {
    condition_text: `На рисунке изображён график y = F(x) одной из первообразных некоторой функции f(x) и отмечены ${ptsWord(marks.length)} на оси абсцисс: ${marks.map((m) => m.label).join(", ")}. В скольких из этих точек функция f(x) ${positive ? "положительна" : "отрицательна"}?`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: w.fn, xa: gx0, xb: gx1, marks, showUnit: false, label: label8(w.fn, gx0, gx1, gy0, gy1, "y = F(x)") }),
    answer: ru(want),
  }
}

// #41 — количество решений f(x)=0 на отрезке [a;b] (= экстремумы первообразной F).
function t8FzeroCountSeg() {
  const gx0 = -7, gx1 = 5, gy0 = -4, gy1 = 4
  const w = buildExtremaWave(gx0, gx1, gy0, gy1, randInt(3, 5), pick([1, -1]))
  const a = -5, b = 2
  const cnt = w.ext.filter((e) => e.x >= a && e.x <= b).length
  return {
    condition_text: `На рисунке изображён график y = F(x) одной из первообразных некоторой функции f(x), определённой на интервале (${ru(gx0)}; ${ru(gx1)}). Пользуясь рисунком, определите количество решений уравнения f(x) = 0 на отрезке [${ru(a)}; ${ru(b)}].`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: w.fn, xa: gx0, xb: gx1, tickXvals: [{ x: gx0, text: ru(gx0) }, { x: gx1, text: ru(gx1) }], label: label8(w.fn, gx0, gx1, gy0, gy1, "y = F(x)") }),
    answer: ru(cnt),
  }
}

// #42 — f(x) — два луча (ломаная); вычислить F(β)−F(α)=∫f (площадь со знаком).
function t8integralTwoRays() {
  const xv = randInt(-5, -2)                 // абсцисса вершины
  const yv = randInt(1, 4)                     // значение в вершине
  const mL = pick([1, 2])                       // наклон левого луча
  const fn = (x) => x <= xv ? yv + mL * (x - xv) : yv
  const a = xv - pick([2, 4]), b = pick([-1, 0])  // pick([2,4]) ⇒ целый ответ
  // ∫_a^b f = ∫_a^xv (yv+mL(x−xv)) + ∫_xv^b yv
  const i1 = yv * (xv - a) + mL * (-(a - xv) * (a - xv)) / 2
  const i2 = yv * (b - xv)
  const val = clean(i1 + i2)
  const gx0 = a - 1, gx1 = 2, gy0 = -4, gy1 = 5
  return {
    condition_text: `На рисунке изображён график некоторой функции y = f(x) (два луча с общей начальной точкой). Пользуясь рисунком, вычислите F(${ru(b)}) − F(${ru(a)}), где F(x) — одна из первообразных функции f(x).`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn, xa: gx0, xb: gx1, tickXvals: [{ x: a, text: ru(a) }, { x: xv, text: ru(xv) }], openEnds: false, label: label8(fn, gx0, gx1, gy0, gy1, "y = f(x)") }),
    answer: ru(val),
  }
}

// Рендер знакового члена многочлена по рациональному коэффициенту numer/denom.
function coefTerm(numer, denom, tail, first) {
  const g = gcd(numer, denom) || 1; let n = numer / g, d = denom / g
  if (d < 0) { d = -d; n = -n }
  if (n === 0) return ""
  const neg = n < 0; n = Math.abs(n)
  const sign = neg ? (first ? "−" : " − ") : (first ? "" : " + ")
  const mag = d === 1 ? (n === 1 && tail ? "" : ru(n)) : fT(n, d)
  return sign + mag + tail
}

// #43/#44 — f(x)=L(x−r₁)(x−r₂) (арка на [r₁;r₂]), дана первообразная F; площадь=|F(r₂)−F(r₁)|.
function t8areaGivenF() {
  let r1, r2, d, Ln, Ld, Ls, area, peak, tries = 0
  do {
    r1 = randInt(-9, 2); d = pick([3, 4, 5, 6]); r2 = r1 + d
    ;[Ln, Ld] = pick([[1, 2], [1, 1], [3, 2], [2, 1]]); Ls = pick([1, -1])
    area = clean(Ln * d * d * d / (Ld * 6))
    peak = Ln / Ld * d * d / 4
  } while ((!isTerm(Ln * d * d * d, Ld * 6) || peak > 6.5) && ++tries < 200)
  const L = Ls * Ln / Ld, s = r1 + r2, pr = r1 * r2
  const fn = (x) => L * (x - r1) * (x - r2)
  // F = L·x³/3 − L·s·x²/2 + L·pr·x (+C) — рациональные коэффициенты, дроби стоячими.
  // Свободный член C произволен (любая первообразная), на площадь F(r₂)−F(r₁) не влияет.
  const C = randInt(-15, 15)
  const Fstr = coefTerm(Ls * Ln, Ld * 3, "x³", true) + coefTerm(-Ls * Ln * s, Ld * 2, "x²", false) + coefTerm(Ls * Ln * pr, Ld, "x", false) + coefTerm(C, 1, "", false)
  const above = L < 0                                  // арка выше оси, если L<0
  const gx0 = r1 - 1, gx1 = r2 + 1
  const gy1 = above ? Math.ceil(peak) + 1 : 2, gy0 = above ? -2 : -(Math.ceil(peak) + 1)
  return {
    condition_text: `На рисунке изображён график некоторой функции y = f(x). Функция F(x) = ${Fstr} — одна из первообразных функции f(x). Найдите площадь закрашенной фигуры.`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn, xa: gx0, xb: gx1, shade: { a: r1, b: r2 }, tickXvals: [{ x: r1, text: ru(r1) }, { x: r2, text: ru(r2) }], openEnds: false, label: label8(fn, gx0, gx1, gy0, gy1, "y = f(x)") }),
    answer: ru(area),
  }
}

// SVG-обёртка (используется чертежами планиметрии №1)
function stWrap(W, H, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${body}</svg>`
}

// ============================================================================
// №1 — ПЛАНИМЕТРИЯ (КЭС 7.1; чертёж обязателен). Эталон — 50 задач банка ФИПИ +
// 110 «Доп.» (реальные экзамены/демо/пробники). Ответ считается кодом. Чертежи —
// свои SVG, схематичные «как ФИПИ» (не в масштабе): меняются числа и подписи.
// Инвентарь типажей — fipi_bank_ege_prof/typages_task01_planimetria.md.
// ============================================================================

const P_INK = "#1c1c1e", P_HI = "#007AFF", P_RED = "#d0021b"
const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L] }
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const onC = (O, R, deg) => { const t = deg * Math.PI / 180; return [O[0] + R * Math.cos(t), O[1] - R * Math.sin(t)] }
// истинная точка касания касательной из внешней точки C к окружности (O,R):
// угол точки касания = направление O→C ± arccos(R/|OC|). side=+1 верхняя, −1 нижняя.
const tangPt = (O, R, C, side) => {
  const d = Math.hypot(C[0] - O[0], C[1] - O[1])
  const base = Math.atan2(-(C[1] - O[1]), C[0] - O[0]) * 180 / Math.PI
  const off = Math.acos(Math.max(-1, Math.min(1, R / d))) * 180 / Math.PI
  return onC(O, R, base + side * off)
}
function pSeg(a, b, o = {}) { const c = o.red ? P_RED : o.hi ? P_HI : P_INK; return `<line x1="${clean(a[0])}" y1="${clean(a[1])}" x2="${clean(b[0])}" y2="${clean(b[1])}" stroke="${c}" stroke-width="${o.w || 1.7}"${o.d ? ' stroke-dasharray="5 4"' : ""}/>` }
function pPolygon(pts, o = {}) { const c = o.hi ? P_HI : P_INK; return `<polygon points="${pts.map(p => clean(p[0]) + "," + clean(p[1])).join(" ")}" fill="${o.fill || "none"}" stroke="${c}" stroke-width="${o.w || 1.7}" stroke-linejoin="round"/>` }
function pCircle(O, R, o = {}) { const c = o.hi ? P_HI : o.red ? P_RED : P_INK; return `<circle cx="${clean(O[0])}" cy="${clean(O[1])}" r="${clean(R)}" fill="${o.fill || "none"}" stroke="${c}" stroke-width="${o.w || 1.6}"${o.d ? ' stroke-dasharray="5 4"' : ""}/>` }
function pDot(p, r = 2.4) { return `<circle cx="${clean(p[0])}" cy="${clean(p[1])}" r="${r}" fill="${P_INK}"/>` }
const VDIR = { tl: [-11, -5], tr: [12, -5], bl: [-12, 15], br: [12, 15], t: [0, -11], b: [0, 18], l: [-14, 5], r: [14, 5] }
function pV(p, dir, t) { const o = VDIR[dir] || [0, 0]; return `<text x="${clean(p[0] + o[0])}" y="${clean(p[1] + o[1])}" ${HALO} font-size="15" font-style="italic" font-weight="bold" fill="${P_INK}" text-anchor="middle">${t}</text>` }
// дуга-метка угла a-v-b радиуса r (double — двойная дуга для «равных» углов)
function pArc(v, a, b, r, o = {}) {
  const an = p => Math.atan2(p[1] - v[1], p[0] - v[0]); let a1 = an(a), a2 = an(b)
  let df = a2 - a1; while (df <= -Math.PI) df += 2 * Math.PI; while (df > Math.PI) df -= 2 * Math.PI
  const sw = df > 0 ? 1 : 0, P = (ang, rr) => [v[0] + rr * Math.cos(ang), v[1] + rr * Math.sin(ang)], c = o.hi ? P_HI : P_INK
  let g = `<path d="M${clean(P(a1, r)[0])} ${clean(P(a1, r)[1])} A${r} ${r} 0 0 ${sw} ${clean(P(a2, r)[0])} ${clean(P(a2, r)[1])}" fill="none" stroke="${c}" stroke-width="1.4"/>`
  if (o.double) { const r2 = r + 3.6; g += `<path d="M${clean(P(a1, r2)[0])} ${clean(P(a1, r2)[1])} A${r2} ${r2} 0 0 ${sw} ${clean(P(a2, r2)[0])} ${clean(P(a2, r2)[1])}" fill="none" stroke="${c}" stroke-width="1.4"/>` }
  return g
}
// прямой угол в вершине v (маленький квадрат к сторонам a,b)
function pRight(v, a, b, s = 10) { const u = unit(v, a), w = unit(v, b), p1 = [v[0] + u[0] * s, v[1] + u[1] * s], p3 = [v[0] + w[0] * s, v[1] + w[1] * s], p2 = [v[0] + (u[0] + w[0]) * s, v[1] + (u[1] + w[1]) * s]; return `<polyline points="${clean(p1[0])},${clean(p1[1])} ${clean(p2[0])},${clean(p2[1])} ${clean(p3[0])},${clean(p3[1])}" fill="none" stroke="${P_INK}" stroke-width="1.3"/>` }
// n штрихов «равные отрезки» на середине ab
function pTick(a, b, n = 1) { const m = mid(a, b), u = unit(a, b), pp = [-u[1], u[0]]; let g = ""; for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * 4.2, c = [m[0] + u[0] * off, m[1] + u[1] * off]; g += `<line x1="${clean(c[0] - pp[0] * 5)}" y1="${clean(c[1] - pp[1] * 5)}" x2="${clean(c[0] + pp[0] * 5)}" y2="${clean(c[1] + pp[1] * 5)}" stroke="${P_INK}" stroke-width="1.4"/>` } return g }
const deg = (n) => `${ru(n)}°`

// ── Треугольник — углы ──────────────────────────────────────────────────────
// Равнобедренный: apex C сверху, база AB, равные боковые CA=CB (тик-метки).
function figIso({ topLbl = "C", blLbl = "A", brLbl = "B", ext } = {}) {
  const A = [45, 172], B = [205, 172], C = [125, 48]
  let g = pPolygon([A, B, C]) + pTick(C, A, 2) + pTick(C, B, 2)
  // равные/заданные УГЛЫ дугами НЕ помечаем — минимум подсказок: значения в условии,
  // равенство углов при основании ученик выводит сам. Дуга остаётся только у ВНЕШНЕГО
  // угла (ext), т.к. без неё непонятно, какой именно угол (внешний, а не внутренний).
  if (ext) { const D = [B[0] + (B[0] - A[0]) * 0.28, B[1]]; g += pSeg(B, D, { d: true }); g += pArc(B, C, D, 15); g += pV(D, "br", "D") }
  g += pV(A, "bl", blLbl) + pV(B, ext ? "b" : "br", brLbl) + pV(C, "t", topLbl)
  return stWrap(270, 200, g)
}

// Равнобедр. AC=BC: дан один угол, найти другой. base A=B=(180−C)/2.
function t01IsoAngle() {
  if (Math.random() < 0.5) {                       // дан угол при вершине C → угол при основании
    const C = randInt(10, 80) * 2                   // чётный, чтобы (180−C)/2 целое
    return { condition_text: `В треугольнике ABC AC = BC, угол C равен ${deg(C)}. Найдите угол A. Ответ дайте в градусах.`, image_url: svgUrl(figIso({ angTop: deg(C) })), answer: ru((180 - C) / 2) }
  }
  const A = randInt(15, 80)                          // дан угол при основании → угол при вершине
  return { condition_text: `В треугольнике ABC AC = BC, угол A равен ${deg(A)}. Найдите угол C. Ответ дайте в градусах.`, image_url: svgUrl(figIso({ angBl: deg(A) })), answer: ru(180 - 2 * A) }
}

// Равнобедр., внешний угол. Варианты: внешний при основании / при вершине.
function t01IsoExt() {
  const v = pick(["baseFromApex", "apexFromExt", "baseFromExtApex"])
  if (v === "baseFromApex") {                        // дан угол при вершине C → внешний CBD при основании B
    const C = randInt(10, 80) * 2, base = (180 - C) / 2  // base = внутр. угол B
    return { condition_text: `В треугольнике ABC AC = BC, угол C равен ${deg(C)}, угол CBD внешний. Найдите величину угла CBD. Ответ дайте в градусах.`, image_url: svgUrl(figIso({ angTop: deg(C), ext: "?" })), answer: ru(180 - base) }
  }
  if (v === "apexFromExt") {                          // дан внешний при основании B → угол C(вершина)
    const base = randInt(46, 87), ext = 180 - base    // base = внутр. угол B; C = 180−2·B
    return { condition_text: `В треугольнике ABC AC = BC. Внешний угол при вершине B равен ${deg(ext)}. Найдите угол C. Ответ дайте в градусах.`, image_url: svgUrl(figIso({ ext: deg(ext) })), answer: ru(180 - 2 * base) }
  }
  // AB=BC (вершина B): внешний при вершине B = сумма углов при основании = 2·C → C = внеш/2
  const C = randInt(20, 85), ext = 2 * C
  return { condition_text: `В треугольнике ABC AB = BC. Внешний угол при вершине B равен ${deg(ext)}. Найдите угол C. Ответ дайте в градусах.`, image_url: svgUrl(figIsoApexB()), answer: ru(C) }
}
// равнобедр. с вершиной B (AB=BC): внешний угол при B — луч BD есть ПРОДОЛЖЕНИЕ AB за B
// (A–B–D на одной прямой), поэтому ∠DBC смежен с внутренним ∠ABC.
function figIsoApexB() {
  const A = [45, 178], C = [205, 178], B = [125, 60]
  let g = pPolygon([A, C, B]) + pTick(B, A, 2) + pTick(B, C, 2)
  const u = unit(A, B), D = [B[0] + u[0] * 54, B[1] + u[1] * 54]
  g += pSeg(B, D, { d: true }) + pArc(B, C, D, 15) + pV(D, "tr", "D")
  g += pV(A, "bl", "A") + pV(C, "br", "C") + pV(B, "tl", "B")
  return stWrap(270, 200, g)
}

// Биссектриса AD (D на BC): дан угол C и угол CAD (=½A). Найти B или ADB.
function figBisector() {
  const A = [40, 176], B = [242, 176], C = [120, 46], D = mid(B, C)
  let g = pPolygon([A, B, C]) + pSeg(A, D)
  // без дуг: равные половины биссектрисы и заданный ∠C не помечаем — это в условии,
  // ученик выводит сам (минимум подсказок на чертеже)
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "t", "C") + pV(D, "r", "D")
  return stWrap(270, 205, g)
}
function t01Bisector() {
  const C = randInt(40, 110), half = randInt(15, Math.floor((178 - C) / 2))
  const A = 2 * half, B = 180 - C - A
  if (Math.random() < 0.5)
    return { condition_text: `В треугольнике ABC AD — биссектриса, угол C равен ${deg(C)}, угол CAD равен ${deg(half)}. Найдите угол B. Ответ дайте в градусах.`, image_url: svgUrl(figBisector()), answer: ru(B) }
  const ADB = 180 - half - B
  return { condition_text: `В треугольнике ABC AD — биссектриса, угол C равен ${deg(C)}, угол BAD равен ${deg(half)}. Найдите угол ADB. Ответ дайте в градусах.`, image_url: svgUrl(figBisector()), answer: ru(ADB) }
}

// Две высоты BD, CE пересекаются в O: угол DOE = 180 − A.
function t01TwoAltitudes() {
  const A = randInt(35, 80)
  const P = [128, 40], Aa = [40, 178], Bb = [232, 178]  // C=P(top), A,B основание
  // ноги высот строим как проекции — чтобы картинка была корректной
  const foot = (X, Y, Z) => { const dx = Z[0] - Y[0], dy = Z[1] - Y[1], t = ((X[0] - Y[0]) * dx + (X[1] - Y[1]) * dy) / (dx * dx + dy * dy); return [Y[0] + t * dx, Y[1] + t * dy] }
  const Dh = foot(Bb, Aa, P), Eh = foot(P, Aa, Bb)
  // ортоцентр
  const inter = (p1, p2, p3, p4) => { const a1 = p2[1] - p1[1], b1 = p1[0] - p2[0], c1 = a1 * p1[0] + b1 * p1[1], a2 = p4[1] - p3[1], b2 = p3[0] - p4[0], c2 = a2 * p3[0] + b2 * p3[1], d = a1 * b2 - a2 * b1; return [(b2 * c1 - b1 * c2) / d, (a1 * c2 - a2 * c1) / d] }
  const O = inter(Bb, Dh, P, Eh)
  let g = pPolygon([Aa, Bb, P]) + pSeg(Bb, Dh) + pSeg(P, Eh)
  g += pRight(Dh, Aa, Bb, 8) + pRight(Eh, P, Bb, 8)   // прямой угол у E — между высотой EC и основанием (а не вдоль основания)
  g += pArc(O, Dh, Eh, 13) + pDot(O)
  g += pV(Aa, "bl", "A") + pV(Bb, "br", "B") + pV(P, "t", "C") + pV(Dh, "r", "D") + pV(Eh, "l", "E") + pV(O, "b", "O")
  // две формулировки ФИПИ (#10 и #10_ДЗ) — одна с «углы B и C острые», вторая «в остроугольном»
  const txt = Math.random() < 0.5
    ? `В треугольнике ABC угол A равен ${deg(A)}, углы B и C острые, высоты BD и CE пересекаются в точке O. Найдите угол DOE. Ответ дайте в градусах.`
    : `В остроугольном треугольнике ABC угол A равен ${deg(A)}, BD и CE — высоты, пересекающиеся в точке O. Найдите угол DOE. Ответ дайте в градусах.`
  return { condition_text: txt, image_url: svgUrl(stWrap(270, 205, g)), answer: ru(180 - A) }
}

// Две биссектрисы AD и BE пересекаются в O: ∠AOB = 90 + C/2.
// (в треугольнике AOB углы при A и B — половины ∠A и ∠B, их сумма = (180−C)/2)
function figTwoBisectors() {
  const A = [55, 178], B = [235, 178], C = [150, 46]
  const D = mid(B, C), E = mid(A, C)
  const inter = (p1, p2, p3, p4) => { const a1 = p2[1] - p1[1], b1 = p1[0] - p2[0], c1 = a1 * p1[0] + b1 * p1[1], a2 = p4[1] - p3[1], b2 = p3[0] - p4[0], c2 = a2 * p3[0] + b2 * p3[1], d = a1 * b2 - a2 * b1; return [(b2 * c1 - b1 * c2) / d, (a1 * c2 - a2 * c1) / d] }
  const O = inter(A, D, B, E)
  let g = pPolygon([A, B, C]) + pSeg(A, D) + pSeg(B, E)
  // равные половины у A помечаем одиночной дугой, у B — двойной: ∠A и ∠B в общем
  // случае РАЗНЫЕ, одинаковым числом дуг их метить нельзя
  g += pArc(A, B, O, 20) + pArc(A, O, C, 20)
  g += pArc(B, O, A, 20, { double: true }) + pArc(B, C, O, 20, { double: true })
  g += pArc(O, A, B, 13) + pDot(O)
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "t", "C") + pV(D, "r", "D") + pV(E, "l", "E") + pV(O, "t", "O")
  return stWrap(285, 205, g)
}
function t01TwoBisectors() {
  const C = randInt(10, 85) * 2                        // чётный → ∠AOB целый
  return { condition_text: `В треугольнике ABC угол C равен ${deg(C)}, биссектрисы AD и BE пересекаются в точке O. Найдите угол AOB. Ответ дайте в градусах.`, image_url: svgUrl(figTwoBisectors()), answer: ru(90 + C / 2) }
}

// Теорема синусов: R = a/(2 sin α). Углы с «хорошим» синусом.
function t01SineTheorem() {
  const variants = [
    { ang: 30, k: 1 }, { ang: 150, k: 1 },            // sin=1/2 → R = a
    { ang: 45, k: rT(2) }, { ang: 135, k: rT(2) },    // sin=√2/2 → a = k√2, R = k
    { ang: 60, k: rT(3) }, { ang: 120, k: rT(3) },    // sin=√3/2 → a = k√3, R = k
  ]
  const v = pick(variants), k = randInt(2, 9)
  // сторона a: при 30/150 → a=число, R=a/... = a? нет: R=a/(2·0.5)=a. при 45→ a=k√2, R=k. при 60→ a=k√3, R=k.
  let sideTxt, R
  if (v.ang === 30 || v.ang === 150) { const a = randInt(3, 18); sideTxt = ru(a); R = a }
  else { sideTxt = `${k}${v.k}`; R = k }
  // Вершины строим РЕАЛЬНО на окружности; угол C задаёт дугу AB (не содержащую C) = 2·C:
  // C — сверху, A,B симметричны. При тупом C (120/135/150) A,B уходят вверх к C, а центр
  // оказывается ВНЕ треугольника — как и должно быть у тупоугольного (иначе картинка врала).
  const cx = 140, cy = 108, Rf = 78, rad = v.ang * Math.PI / 180
  const C = [cx, cy - Rf]
  const A = [cx - Rf * Math.sin(rad), cy + Rf * Math.cos(rad)]
  const B = [cx + Rf * Math.sin(rad), cy + Rf * Math.cos(rad)]
  // значение стороны на чертёж не наносим (оно в условии; иначе в SVG протёк бы сырой токен ⟦r⟧)
  let g = pCircle([cx, cy], Rf) + pPolygon([A, B, C], { w: 1.8 })
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "t", "C")
  return { condition_text: `В треугольнике ABC сторона AB равна ${sideTxt}, угол C равен ${deg(v.ang)}. Найдите радиус описанной около этого треугольника окружности.`, image_url: svgUrl(stWrap(280, 215, g)), answer: ru(R) }
}

// ── Прямоугольный треугольник: медиана/высота/биссектриса из прямого угла ────
// база «прямой угол C сверху, гипотенуза AB снизу» (точка C — на окружности Фалеса)
const RT_A = [40, 182], RT_B = [250, 182]
function figRightCevians(feet) {
  const C = [96, 78]                                  // ≈ на окружности Фалеса над AB
  let g = pPolygon([RT_A, RT_B, C]) + pRight(C, RT_A, RT_B, 11)
  const M = mid(RT_A, RT_B)                            // середина (медиана)
  const H = (() => { const dx = RT_B[0] - RT_A[0], dy = RT_B[1] - RT_A[1], t = ((C[0] - RT_A[0]) * dx + (C[1] - RT_A[1]) * dy) / (dx * dx + dy * dy); return [RT_A[0] + t * dx, RT_A[1] + t * dy] })()
  const D = mid(H, M)                                  // биссектриса — между H и M (схематично)
  const pts = { H, M, D }
  for (const f of feet) g += pSeg(C, pts[f])
  if (feet.includes("H")) g += pRight(H, C, RT_A, 8)
  const lo = pts[feet[0]], hi = pts[feet[1]]
  if (feet.length === 2) g += pArc(C, lo, hi, 30)   // радиус заметно больше квадратика прямого угла (11) — дуга сидит ниже и не налезает на него; число — в условии
  g += pV(RT_A, "bl", "A") + pV(RT_B, "br", "B") + pV(C, "t", "C")
  for (const f of feet) g += pV(pts[f], "b", f)
  return stWrap(280, 210, g)
}
// медиана CD из прямого угла: угол B → ACD = 90 − B
function t01RightMedian() {
  const B = randInt(4, 80)
  const C = [96, 78], M = mid(RT_A, RT_B)
  let g = pPolygon([RT_A, RT_B, C]) + pRight(C, RT_A, RT_B, 11) + pSeg(C, M)
  // дугой помечаем ТОЛЬКО искомый ∠ACD; ∠B не дублируем одиночной дугой —
  // иначе разные углы (ACD≠B) выглядели бы равными (равное число дуг = равные углы)
  g += pArc(C, RT_A, M, 16)
  g += pV(RT_A, "bl", "A") + pV(RT_B, "br", "B") + pV(C, "t", "C") + pV(M, "b", "D")
  return { condition_text: `В треугольнике ABC CD — медиана, угол C равен 90°, угол B равен ${deg(B)}. Найдите угол ACD. Ответ дайте в градусах.`, image_url: svgUrl(stWrap(280, 210, g)), answer: ru(90 - B) }
}
// угол между двумя чевианами из прямого угла (высота/медиана/биссектриса)
function t01RightCevians() {
  const pairs = [
    { feet: ["H", "M"], t1: "высотой CH", t2: "медианой CM", between: (a, b) => Math.abs(a - b) },
    { feet: ["H", "D"], t1: "высотой CH", t2: "биссектрисой CD", between: (a, b) => Math.abs(a - b) / 2 },
    { feet: ["D", "M"], t1: "биссектрисой CD", t2: "медианой CM", between: (a, b) => Math.abs(a - b) / 2 },
  ]
  const p = pick(pairs), reverse = Math.random() < 0.45
  if (!reverse) {
    let B = randInt(50, 80), A = 90 - B                 // острый угол B (больший)
    const ans = p.between(A, B)
    // формулировка «острые углы равны X и Y» (эталон #71): только для высоты и медианы
    if (p.feet[0] === "H" && p.feet[1] === "M" && Math.random() < 0.5)
      return { condition_text: `Острые углы прямоугольного треугольника равны ${deg(B)} и ${deg(A)}. Найдите угол между высотой и медианой, проведёнными из вершины прямого угла. Ответ дайте в градусах.`, image_url: svgUrl(figRightCevians(p.feet)), answer: ru(ans) }
    return { condition_text: `Острый угол B прямоугольного треугольника ABC равен ${deg(B)}. Найдите величину угла между ${p.t1} и ${p.t2}, проведёнными из вершины прямого угла C. Ответ дайте в градусах.`, image_url: svgUrl(figRightCevians(p.feet)), answer: ru(ans) }
  }
  // обратная: дан угол между чевианами → меньший острый угол
  const half = p.feet.includes("M") && p.feet.includes("H")
  if (half) { const d = randInt(6, 40) * 2; return { condition_text: `Угол между высотой и медианой прямоугольного треугольника, проведёнными из вершины прямого угла, равен ${deg(d)}. Найдите меньший угол прямоугольного треугольника. Ответ дайте в градусах.`, image_url: svgUrl(figRightCevians(["H", "M"])), answer: ru((90 - d) / 2) } }
  // формулировки ФИПИ различаются: у «бисс.+медиана» (#69) и у «высота+бисс.» (#70)
  const d = randInt(3, 40)
  if (p.feet.includes("H"))
    return { condition_text: `В прямоугольном треугольнике угол между высотой и биссектрисой, проведёнными из вершины прямого угла, равен ${deg(d)}. Найдите меньший угол прямоугольного треугольника. Ответ дайте в градусах.`, image_url: svgUrl(figRightCevians(p.feet)), answer: ru(45 - d) }
  return { condition_text: `Угол между биссектрисой и медианой прямоугольного треугольника, проведёнными из вершины прямого угла, равен ${deg(d)}. Найдите меньший угол прямоугольного треугольника. Ответ дайте в градусах.`, image_url: svgUrl(figRightCevians(p.feet)), answer: ru(45 - d) }
}

// ── Треугольник: две стороны и высоты (S постоянна) ─────────────────────────
function figTriHeight() {
  const A = [40, 178], B = [250, 178], C = [130, 48]
  const H = (() => { const dx = B[0] - A[0], dy = B[1] - A[1], t = ((C[0] - A[0]) * dx + (C[1] - A[1]) * dy) / (dx * dx + dy * dy); return [A[0] + t * dx, A[1] + t * dy] })()
  let g = pPolygon([A, B, C]) + pSeg(C, H, { d: false }) + pRight(H, A, C, 8)
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "t", "C")
  return stWrap(280, 205, g)
}
function t01TwoSidesHeight() {
  // h_small = s_big·h_big / s_small — целое при (s_small/gcd) | h_big
  let sSmall, sBig, hBig, hSmall
  for (let g = 0; g < 300; g++) {
    let a = randInt(6, 24), b = randInt(6, 24); if (a === b) continue
    sSmall = Math.min(a, b); sBig = Math.max(a, b)
    const need = sSmall / gcd(sSmall, sBig); if (need > 18) continue
    hBig = need * randInt(1, Math.floor(18 / need))
    hSmall = sBig * hBig / sSmall
    if (hSmall <= 40) break
  }
  return { condition_text: `Две стороны треугольника равны ${sSmall} и ${sBig}. Высота, опущенная на бо́льшую из этих сторон, равна ${hBig}. Найдите высоту, опущенную на меньшую из этих сторон треугольника.`, image_url: svgUrl(figTriHeight()), answer: ru(hSmall) }
}

// ── Средняя линия треугольника: S(CDE)=¼S(ABC); трапеция=¾S ─────────────────
// kind "cde"/"trap" — средняя линия DE отсекает треугольник у вершины C;
// kind "bef" — средняя линия EF (E на CB, F на AB) отсекает треугольник у вершины B.
function figMidline(kind = "cde") {
  const A = [40, 178], B = [235, 178], C = [150, 44]
  // без заливки: искомая область (CDE / трапеция ABED / BEF) названа в условии
  if (kind === "bef") {
    const E = mid(C, B), F = mid(A, B)
    let g = pPolygon([A, B, C]) + pSeg(E, F)
    g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "t", "C") + pV(E, "r", "E") + pV(F, "b", "F")
    return stWrap(280, 205, g)
  }
  const D = mid(A, C), E = mid(B, C)
  let g = pPolygon([A, B, C]) + pSeg(D, E)
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "t", "C") + pV(D, "l", "D") + pV(E, "r", "E")
  return stWrap(280, 205, g)
}
function t01Midline() {
  const mode = pick(["cde-from-abc", "abc-from-cde", "abc-from-bef", "trap-from-abc"])
  if (mode === "cde-from-abc") { const S = randInt(2, 30) * 4; return { condition_text: `В треугольнике ABC DE — средняя линия, параллельная стороне AB. Площадь треугольника ABC равна ${S}. Найдите площадь треугольника CDE.`, image_url: svgUrl(figMidline("cde")), answer: ru(S / 4) } }
  if (mode === "abc-from-cde") { const s = randInt(2, 40); return { condition_text: `В треугольнике ABC DE — средняя линия. Площадь треугольника CDE равна ${s}. Найдите площадь треугольника ABC.`, image_url: svgUrl(figMidline("cde")), answer: ru(4 * s) } }
  if (mode === "abc-from-bef") { const s = randInt(2, 40); return { condition_text: `В треугольнике ABC EF — средняя линия. Площадь треугольника BEF равна ${s}. Найдите площадь треугольника ABC.`, image_url: svgUrl(figMidline("bef")), answer: ru(4 * s) } }
  const S = randInt(2, 40) * 4; return { condition_text: `Площадь треугольника ABC равна ${S}, DE — средняя линия, параллельная стороне AB. Найдите площадь трапеции ABED.`, image_url: svgUrl(figMidline("trap")), answer: ru(3 * S / 4) }
}

// ── Равнобедренный: угол при вершине + боковая → площадь (½L²sin v) ──────────
function t01IsoApexArea() {
  const v = pick([30, 150]), L = randInt(2, 14)
  return { condition_text: `Угол при вершине, противолежащей основанию равнобедренного треугольника, равен ${deg(v)}. Боковая сторона треугольника равна ${L}. Найдите площадь этого треугольника.`, image_url: svgUrl(figIso({ angTop: deg(v) })), answer: ru(clean(L * L * 0.5 / 2)) }
}

// ── Равносторонний: высота k√3 → сторона 2k ─────────────────────────────────
function t01EquilHeight() {
  const k = randInt(3, 60)
  const A = [55, 180], B = [225, 180], C = [140, 40], H = mid(A, B)
  let g = pPolygon([A, B, C]) + pSeg(C, H) + pRight(H, A, C, 8)   // без штрихов равных сторон: «равносторонний» — в условии, а штрихи на AB налезали на высоту
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "t", "C") + pV(H, "b", "H")
  return { condition_text: `В равностороннем треугольнике ABC высота CH равна ${k}${rT(3)}. Найдите AB.`, image_url: svgUrl(stWrap(280, 205, g)), answer: ru(2 * k) }
}

// ── Прямоугольный треугольник: тригонометрия (C = 90°) ──────────────────────
// база: прямой угол C — левый-нижний; A сверху, B справа-снизу (как ФИПИ Д39/Д40)
function figRightTrig(labels, showRight = true) {
  const C = [55, 182], A = [55, 55], B = [252, 182]
  let g = pPolygon([C, A, B])
  if (showRight) g += pRight(C, A, B, 11)
  g += pV(A, "tl", labels.A || "A") + pV(B, "br", labels.B || "B") + pV(C, "bl", labels.C || "C")
  return stWrap(285, 210, g)
}
// [BC, AC, AB]; гипотенуза только 5·2^k — иначе sin/cos не конечная десятичная
const RT_TRIP = [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [9, 12, 15], [12, 9, 15],
  [12, 16, 20], [16, 12, 20], [15, 20, 25], [20, 15, 25], [7, 24, 25], [24, 7, 25]]
// sin A = √m/n (m не полный квадрат) → sin B = cos A = k/n; m = n²−k²
// (n — только 4/5/8/10: иначе k/n не конечная десятичная дробь)
const RT_IRR_SIN = [[7, 3, 4], [15, 1, 4], [21, 2, 5], [15, 7, 8], [39, 5, 8], [55, 3, 8],
  [19, 9, 10], [91, 3, 10], [51, 7, 10]]
// tg A = √m/n → AB = k·h, AC = k·n, BC = k·√m (m + n² = h²)
const RT_IRR_TG = [[3, 1, 2], [5, 2, 3], [7, 3, 4], [11, 5, 6], [15, 1, 4], [13, 6, 7], [21, 10, 11]]
function t01RightTrig() {
  const mode = pick(["legHypToTrig", "cosFindHyp", "tgFindHyp", "tgIrr", "tgScaled",
    "sinAToSinB", "sinIrrToSinB", "sqrtLeg"])
  const fig = svgUrl(figRightTrig({}))
  if (mode === "legHypToTrig") {                       // даны катет и гипотенуза → sin/cos
    const [a, b, c] = pick(RT_TRIP)                     // a=BC, b=AC, c=AB
    // sin B = AC/AB и cos A = AC/AB — оба равны b/c
    if (Math.random() < 0.5) return { condition_text: `В треугольнике ABC угол C равен 90°, BC = ${a}, AB = ${c}. Найдите sin B.`, image_url: fig, answer: ru(clean(b / c)) }
    return { condition_text: `В треугольнике ABC угол C равен 90°, AC = ${b}, AB = ${c}. Найдите cos A.`, image_url: fig, answer: ru(clean(b / c)) }
  }
  if (mode === "cosFindHyp") {                          // катет + cos B → гипотенуза
    const [a, , c] = pick([[3, 4, 5], [4, 3, 5]]), k = randInt(2, 6)
    const BC = a * k, AB = c * k
    return { condition_text: `В треугольнике ABC угол C равен 90°, BC = ${BC}, cos B = ${fT(a, c)}. Найдите AB.`, image_url: fig, answer: ru(AB) }
  }
  if (mode === "tgFindHyp") {                           // катет AC + tg A (рацион.) → гипотенуза AB
    const [a, b, c] = pick(RT_TRIP), AC = b, g = gcd(a, b), tg = fT(a / g, b / g)
    return { condition_text: `В треугольнике ABC угол C равен 90°, AC = ${AC}, tg A = ${tg}. Найдите AB.`, image_url: fig, answer: ru(c) }
  }
  if (mode === "tgIrr") {                               // катет AC + tg A = √m/n → AB
    const [m, n, h] = pick(RT_IRR_TG), k = randInt(2, 7)
    return { condition_text: `В треугольнике ABC угол C равен 90°, AC = ${k * n}, tg A = ${fT(`√{${m}}`, n)}. Найдите AB.`, image_url: fig, answer: ru(k * h) }
  }
  if (mode === "tgScaled") {                            // AC не кратен катету тройки: AB = AC·c/b
    let a, b, c, AC
    do { [a, b, c] = pick(PYTH); AC = randInt(2, 40) } while (decLen(AC * c, b) > 2)
    const g = gcd(a, b)
    return { condition_text: `В треугольнике ABC угол C равен 90°, AC = ${AC}, tg A = ${fT(a / g, b / g)}. Найдите AB.`, image_url: fig, answer: ru(clean(AC * c / b)) }
  }
  if (mode === "sinAToSinB") {                          // sin A → sin B (= cos A)
    const [a, b, c] = pick(RT_TRIP)
    return { condition_text: `В треугольнике ABC угол C равен 90°, sin A = ${ru(clean(a / c))}. Найдите sin B.`, image_url: fig, answer: ru(clean(b / c)) }
  }
  if (mode === "sinIrrToSinB") {                        // sin A = √m/n → sin B = k/n
    const [m, k, n] = pick(RT_IRR_SIN)
    return { condition_text: `В треугольнике ABC угол C равен 90°, sin A = ${fT(`√{${m}}`, n)}. Найдите sin B.`, image_url: fig, answer: ru(clean(k / n)) }
  }
  // sqrtLeg: гип c и катет BC=√(c²−m²) → AC=m, cos A = AC/AB = m/c (c=5,10 → терминир. дробь)
  const c = pick([5, 10]), m = randInt(2, c - 1), other = c * c - m * m
  const o = Math.sqrt(other), bcTxt = Number.isInteger(o) ? ru(o) : rT(other)
  return { condition_text: `В треугольнике ABC угол C равен 90°, AB = ${c}, BC = ${bcTxt}. Найдите cos A.`, image_url: fig, answer: ru(clean(m / c)) }
}

// Два катета (один с корнем) → sin B / cos B. 30-60-90: катеты k и k√3, гипотенуза 2k.
function t01RightTwoLegsTrig() {
  const k = randInt(1, 9), swap = Math.random() < 0.5
  // swap=false: BC = k√3, AC = k → sin B = AC/AB = 1/2
  // swap=true:  BC = k,   AC = k√3 → cos B = BC/AB = 1/2 (и sin B = √3/2 — не даём)
  const legRoot = `${k === 1 ? "" : k}${rT(3)}`, legPlain = ru(k)
  if (!swap) return { condition_text: `В треугольнике ABC угол C равен 90°, BC = ${legRoot}, AC = ${legPlain}. Найдите sin B.`, image_url: svgUrl(figRightTrig({})), answer: ru(clean(0.5)) }
  return { condition_text: `В треугольнике ABC угол C равен 90°, BC = ${legPlain}, AC = ${legRoot}. Найдите cos B.`, image_url: svgUrl(figRightTrig({})), answer: ru(clean(0.5)) }
}

// Гипотенуза AB + tg острого угла A → катет BC (или AC).
function t01RightHypTgLeg() {
  let a, b, c, AB, BC, AC
  do {
    [a, b, c] = pick(PYTH)                              // a=BC, b=AC, c=AB (пропорции)
    AB = randInt(2, 40); BC = AB * a / c; AC = AB * b / c
  } while (decLen(AB * a, c) > 2 || decLen(AB * b, c) > 2)
  const g = gcd(a, b), tg = a / g === 3 && b / g === 4 ? "0,75" : fT(a / g, b / g)
  if (Math.random() < 0.5) return { condition_text: `В прямоугольном треугольнике ABC угол C равен 90°, AB = ${AB}, tg A = ${tg}. Найдите BC.`, image_url: svgUrl(figRightTrig({})), answer: ru(clean(BC)) }
  return { condition_text: `В прямоугольном треугольнике ABC угол C равен 90°, AB = ${AB}, tg A = ${tg}. Найдите AC.`, image_url: svgUrl(figRightTrig({})), answer: ru(clean(AC)) }
}

// ── Равнобедренный + высота → sin/cos угла или сторона ───────────────────────
function figIsoBase(baseLbl, apexLbl, showAlt) {
  const A = [50, 172], B = [220, 172], C = [135, 50], H = mid(A, B)
  let g = pPolygon([A, B, C]) + pTick(C, A, 2) + pTick(C, B, 2)
  if (showAlt) g += pSeg(C, H) + pRight(H, A, C, 8)
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "t", "C")
  if (showAlt) g += pV(H, "b", "H")
  return stWrap(280, 200, g)
}
function t01IsoHeightTrig() {
  const mode = pick(["cosFromSides", "sinACB", "sinBAC", "cosBAC", "acFromCos"])
  if (mode === "cosFromSides") {                        // AC=BC=L, AB=2m → cos A = m/L
    let L, m; do { L = randInt(10, 30); m = randInt(3, L - 2) } while (decLen(m, L) > 2)
    return { condition_text: `В треугольнике ABC AC = BC = ${L}, AB = ${2 * m}. Найдите cos A.`, image_url: svgUrl(figIsoBase()), answer: ru(clean(m / L)) }
  }
  if (mode === "sinACB") {                              // AB=BC, AC=b, высота CH=h → sin ACB = h/b
    let b, h; do { b = randInt(8, 24); h = randInt(2, b - 1) } while (decLen(h, b) > 2)
    return { condition_text: `В треугольнике ABC AB = BC, AC = ${b}, высота CH равна ${h}. Найдите синус угла ACB.`, image_url: svgUrl(figIsoBase()), answer: ru(clean(h / b)) }
  }
  if (mode === "sinBAC") {                              // AC=BC, AB=c, высота AH=h → sin BAC = h/c
    let c, h; do { c = randInt(8, 24); h = randInt(2, c - 1) } while (decLen(h, c) > 2)
    return { condition_text: `В треугольнике ABC AC = BC, AB = ${c}, высота AH равна ${h}. Найдите синус угла BAC.`, image_url: svgUrl(figIsoBase()), answer: ru(clean(h / c)) }
  }
  if (mode === "cosBAC") {                              // AC=BC, AB=c, BH=x → cos BAC = x/c
    let c, x; do { c = randInt(8, 24); x = randInt(2, c - 1) } while (decLen(x, c) > 2)
    return { condition_text: `В треугольнике ABC AC = BC, AB = ${c}, AH — высота, BH = ${x}. Найдите косинус угла BAC.`, image_url: svgUrl(figIsoBase()), answer: ru(clean(x / c)) }
  }
  // acFromCos: AC=BC, высота CH=h, cos A=cosT → AC = h/sin A
  const trip = pick([[3, 4, 5], [4, 3, 5], [7, 24, 25], [24, 7, 25], [8, 15, 17]])  // [cosNum, sinNum, den]
  const cosN = trip[0], sinN = trip[1], den = trip[2], AC = randInt(2, 6) * den, CH = AC * sinN / den
  return { condition_text: `В треугольнике ABC AC = BC, высота CH равна ${ru(clean(CH))}, cos A = ${fT(cosN, den)}. Найдите AC.`, image_url: svgUrl(figIsoBase("", "", true)), answer: ru(AC) }
}

// ── Окружность: вписанные / центральные углы, дуги ───────────────────────────
const CO = [140, 108], CR = 82                          // центр и радиус для круговых фигур
// вписанный угол при вершине C, опирающийся на дугу AB (снизу)
function figInscribed() {
  const A = onC(CO, CR, 210), B = onC(CO, CR, 330), C = onC(CO, CR, 80)
  let g = pCircle(CO, CR) + pSeg(C, A) + pSeg(C, B) + pArc(C, A, B, 15)
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "t", "C")
  return stWrap(280, 220, g)
}
// вписанный угол = ½ дуги; дуга задана долей окружности
function t01InscribedArc() {
  const fracs = [[1, 5], [7, 18], [1, 4], [1, 6], [1, 3], [2, 9], [5, 18], [1, 10], [1, 12], [1, 9]]
  const [p, q] = pick(fracs.filter(([p, q]) => (360 * p / q) % 1 === 0))
  const arc = 360 * p / q
  return { condition_text: `Найдите вписанный угол, опирающийся на дугу, равную ${fT(p, q)} окружности. Ответ дайте в градусах.`, image_url: svgUrl(figInscribed()), answer: ru(arc / 2) }
}
// центральный угол на N больше острого вписанного на ту же дугу → x=N
function figCentralInsc(showC = true) {
  const A = onC(CO, CR, 205), B = onC(CO, CR, 335), C = onC(CO, CR, 75)
  // центральный ∠AOB = 2·вписанного ∠ACB — НЕ равны: центральный двойной дугой, вписанный одной
  let g = pCircle(CO, CR) + pSeg(CO, A) + pSeg(CO, B) + pArc(CO, A, B, 16, { double: true })
  if (showC) g += pSeg(C, A) + pSeg(C, B) + pArc(C, A, B, 14) + pV(C, "t", "")
  g += pDot(CO) + pV(A, "bl", "A") + pV(B, "br", "B")
  return stWrap(280, 220, g)
}
function t01CentralVsInscribed() {
  const N = randInt(10, 60)
  if (Math.random() < 0.5) return { condition_text: `Найдите центральный угол, если он на ${deg(N)} больше острого вписанного угла, опирающегося на ту же дугу. Ответ дайте в градусах.`, image_url: svgUrl(figCentralInsc()), answer: ru(2 * N) }
  return { condition_text: `Центральный угол на ${deg(N)} больше острого вписанного угла, опирающегося на ту же дугу окружности. Найдите вписанный угол. Ответ дайте в градусах.`, image_url: svgUrl(figCentralInsc()), answer: ru(N) }
}
// треугольник вписан, центр O: BOC = 2·BAC
function t01CentralTri() {
  const a = randInt(20, 75)
  // B, C опущены ближе к низу, чтобы центр O не оказывался на хорде BC
  const A = onC(CO, CR, 90), B = onC(CO, CR, 210), C = onC(CO, CR, 330)
  let g = pCircle(CO, CR) + pPolygon([A, B, C]) + pSeg(CO, B) + pSeg(CO, C)
  // ∠BOC = 2·∠BAC — углы НЕ равны: вписанный одной дугой, центральный двойной
  g += pArc(A, B, C, 15) + pArc(CO, B, C, 16, { double: true }) + pDot(CO)
  g += pV(A, "t", "A") + pV(B, "bl", "B") + pV(C, "br", "C") + pV(CO, "tl", "O")
  return { condition_text: `Треугольник ABC вписан в окружность с центром O. Угол BAC равен ${deg(a)}. Найдите угол BOC. Ответ дайте в градусах.`, image_url: svgUrl(stWrap(280, 220, g)), answer: ru(2 * a) }
}
// даны дуги AC и BC → вписанный ACB = ½(360 − AC − BC)
function t01ArcsToACB() {
  let ac, bc; do { ac = randInt(60, 240); bc = randInt(40, 160) } while (360 - ac - bc < 20 || (360 - ac - bc) % 2 !== 0)
  const A = onC(CO, CR, 250), B = onC(CO, CR, 310), C = onC(CO, CR, 70)
  let g = pCircle(CO, CR) + pSeg(A, C) + pSeg(B, C) + pArc(C, A, B, 14)
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "t", "C")
  return { condition_text: `На окружности отмечены точки A, B и C. Дуга окружности AC, не содержащая точку B, составляет ${deg(ac)}. Дуга окружности BC, не содержащая точку A, составляет ${deg(bc)}. Найдите вписанный угол ACB. Ответ дайте в градусах.`, image_url: svgUrl(stWrap(280, 220, g)), answer: ru((360 - ac - bc) / 2) }
}

// ── Вписанный четырёхугольник ───────────────────────────────────────────────
// ABCD на окружности (по часовой), опц. диагонали
function figCircleQuad(diags = []) {
  const A = onC(CO, CR, 172), B = onC(CO, CR, 92), C = onC(CO, CR, 18), D = onC(CO, CR, 290)
  const P = { A, B, C, D }
  let g = pCircle(CO, CR) + pPolygon([A, B, C, D])
  for (const [x, y] of diags) g += pSeg(P[x], P[y])
  g += pV(A, "l", "A") + pV(B, "t", "B") + pV(C, "r", "C") + pV(D, "b", "D")
  return stWrap(280, 220, g)
}
// противоположные углы вписанного ⬜ = 180
function t01InscQuadOpp() {
  if (Math.random() < 0.5) { const bad = randInt(40, 140); return { condition_text: `Четырёхугольник ABCD вписан в окружность. Угол BAD равен ${deg(bad)}. Найдите угол BCD. Ответ дайте в градусах.`, image_url: svgUrl(figCircleQuad()), answer: ru(180 - bad) } }
  let x = randInt(40, 130), y = randInt(40, 130)
  const bigger = Math.random() < 0.5
  const rem = [180 - x, 180 - y]
  return { condition_text: `Два угла вписанного в окружность четырёхугольника равны ${deg(x)} и ${deg(y)}. Найдите ${bigger ? "бо́льший" : "меньший"} из оставшихся углов. Ответ дайте в градусах.`, image_url: svgUrl(figCircleQuad()), answer: ru(bigger ? Math.max(...rem) : Math.min(...rem)) }
}
// вписанный ⬜: углы через дуги (ABD, CAD → ABC / CAD / ABD)
function t01InscQuadArc() {
  const abd = randInt(30, 65), cad = randInt(25, 55)
  const mode = pick(["abc", "cad", "abd"])
  if (mode === "abc") return { condition_text: `Четырёхугольник ABCD вписан в окружность. Угол ABD равен ${deg(abd)}, угол CAD равен ${deg(cad)}. Найдите угол ABC. Ответ дайте в градусах.`, image_url: svgUrl(figCircleQuad([["B", "D"], ["A", "C"]])), answer: ru(abd + cad) }
  const abc = randInt(80, 140)
  if (mode === "cad") return { condition_text: `Четырёхугольник ABCD вписан в окружность. Угол ABC равен ${deg(abc)}, угол ABD равен ${deg(abd)}. Найдите угол CAD. Ответ дайте в градусах.`, image_url: svgUrl(figCircleQuad([["B", "D"], ["A", "C"]])), answer: ru(abc - abd) }
  return { condition_text: `Четырёхугольник ABCD вписан в окружность. Угол ABC равен ${deg(abc)}, угол CAD равен ${deg(cad)}. Найдите угол ABD. Ответ дайте в градусах.`, image_url: svgUrl(figCircleQuad([["B", "D"], ["A", "C"]])), answer: ru(abc - cad) }
}
// два вписанных угла ABD и BCA → BCD = ABD + BCA
function t01InscTriTwo() {
  const abd = randInt(30, 70), bca = randInt(25, 55)
  return { condition_text: `Угол ABD равен ${deg(abd)}. Угол BCA равен ${deg(bca)}. Найдите вписанный угол BCD. Ответ дайте в градусах.`, image_url: svgUrl(figCircleQuad([["A", "D"], ["B", "D"], ["A", "C"]])), answer: ru(abd + bca) }
}
// диаметры AC, BD: ACB ↔ AOD (AOD = 180 − 2·ACB)
function figDiameters() {
  const A = onC(CO, CR, 200), C = onC(CO, CR, 20), B = onC(CO, CR, 140), D = onC(CO, CR, 320)
  let g = pCircle(CO, CR) + pSeg(A, C) + pSeg(B, D) + pSeg(A, B) + pSeg(B, C)
  // ∠AOD (центральный) ≠ ∠ACB (вписанный): AOD = 180 − 2·ACB — помечаем разным числом дуг
  g += pArc(C, A, B, 16) + pArc(CO, A, D, 16, { double: true }) + pDot(CO)
  g += pV(A, "bl", "A") + pV(B, "tl", "B") + pV(C, "tr", "C") + pV(D, "br", "D") + pV(CO, "r", "O")
  return stWrap(280, 220, g)
}
function t01Diameters() {
  if (Math.random() < 0.5) { const acb = randInt(20, 75); return { condition_text: `Отрезки AC и BD — диаметры окружности с центром O. Угол ACB равен ${deg(acb)}. Найдите угол AOD. Ответ дайте в градусах.`, image_url: svgUrl(figDiameters()), answer: ru(180 - 2 * acb) }
  }
  const aod = randInt(20, 150) * 1; const aodv = aod % 2 === 0 ? aod : aod + 1
  return { condition_text: `Отрезки AC и BD — диаметры окружности с центром O. Угол AOD равен ${deg(aodv)}. Найдите вписанный угол ACB. Ответ дайте в градусах.`, image_url: svgUrl(figDiameters()), answer: ru((180 - aodv) / 2) }
}

// ── Касательные и секущие ───────────────────────────────────────────────────
// CA касается в A; CO — секущая через B (и, опц., через центр в D)
function figTangentRadius(throughCenter = false) {
  const O = [110, 120], R = 62, C = [252, 150]
  const A = tangPt(O, R, C, 1)                         // истинная точка касания (CA ⟂ OA)
  let g = pCircle(O, R) + pSeg(C, A) + pSeg(C, O, {})  // касательная и секущая
  g += pSeg(O, A) + pDot(O)                            // прямой угол OA⟂CA НЕ помечаем: это и есть то, до чего ученик должен додуматься
  // точка B — пересечение отрезка CO с окружностью (ближняя к C, на стороне C)
  const dOC = unit(O, C), B = [O[0] + dOC[0] * R, O[1] + dOC[1] * R]
  g += pV(B, "br", "B")
  if (throughCenter) { const D = [O[0] - dOC[0] * R, O[1] - dOC[1] * R]; g += pV(D, "bl", "D") }
  g += pArc(C, A, O, 15) + pV(A, "t", "A") + pV(C, "r", "C") + pV(O, "bl", "O")
  return stWrap(285, 210, g)
}
// CA касается, CO секущая через B: дуга AB = 90 − ACO
function t01TangentRadius() {
  if (Math.random() < 0.5) { const arc = randInt(10, 80); return { condition_text: `Найдите угол ACO, если его сторона CA касается окружности с центром O, отрезок CO пересекает окружность в точке B (см. рис.), а дуга AB окружности, заключённая внутри этого угла, равна ${deg(arc)}. Ответ дайте в градусах.`, image_url: svgUrl(figTangentRadius()), answer: ru(90 - arc) }
  }
  const aco = randInt(10, 80)
  return { condition_text: `Угол ACO равен ${deg(aco)}. Его сторона CA касается окружности с центром в точке O. Отрезок CO пересекает окружность в точке B (см. рис.). Найдите градусную меру дуги AB окружности, заключённой внутри этого угла. Ответ дайте в градусах.`, image_url: svgUrl(figTangentRadius()), answer: ru(90 - aco) }
}
// CA касается, CO через центр (B ближняя, D дальняя): дуга AD = 90 + ACO
function t01TangentSecantDiam() {
  const aco = randInt(20, 60)
  return { condition_text: `Угол ACO равен ${deg(aco)}. Его сторона CA касается окружности с центром в точке O. Сторона CO пересекает окружность в точках B и D (см. рис.). Найдите градусную меру дуги AD окружности, заключённой внутри этого угла. Ответ дайте в градусах.`, image_url: svgUrl(figTangentRadius(true)), answer: ru(90 + aco) }
}
// две касательные из C (точки касания A, B): угол ACB = 180 − дуга(мин)
function figTwoTangents() {
  const O = [105, 115], R = 60, C = [255, 115]
  const A = tangPt(O, R, C, 1), B = tangPt(O, R, C, -1)   // ИСТИННЫЕ точки касания: CA и CB реально касаются окружности
  let g = pCircle(O, R) + pSeg(C, A) + pSeg(C, B) + pArc(C, A, B, 16) + pDot(O)
  g += pV(A, "tr", "A") + pV(B, "br", "B") + pV(C, "r", "C") + pV(O, "l", "O")
  return stWrap(285, 205, g)
}
function t01TwoTangents() {
  const arc = randInt(30, 120)
  return { condition_text: `Через концы A и B дуги окружности с центром O проведены касательные AC и BC. Меньшая дуга AB равна ${deg(arc)}. Найдите угол ACB. Ответ дайте в градусах.`, image_url: svgUrl(figTwoTangents()), answer: ru(180 - arc) }
}
// две секущие из внешней точки C: C–D–B и C–E–A (D,E — ближние к C, B,A — дальние)
// угол DAE = ½ дуги DE = ½(дуга AB − 2·ACB)
function figTwoSecants() {
  const O = [140, 120], R = 72, C = [294, 120]
  const B = onC(O, R, 154), A = onC(O, R, 232)          // дальние точки — левая часть окружности
  const nearHit = (P) => {                              // ближнее к C пересечение прямой C–P с окружностью
    const d = [P[0] - C[0], P[1] - C[1]], f = [C[0] - O[0], C[1] - O[1]]
    const dd = d[0] * d[0] + d[1] * d[1], fd = f[0] * d[0] + f[1] * d[1], ff = f[0] * f[0] + f[1] * f[1] - R * R
    const t = (-fd - Math.sqrt(Math.max(0, fd * fd - dd * ff))) / dd   // меньший корень = ближе к C
    return [C[0] + t * d[0], C[1] + t * d[1]]
  }
  const D = nearHit(B), E = nearHit(A)                  // ближние точки на правой части, рядом с C
  let g = pCircle(O, R) + pSeg(C, B) + pSeg(C, A) + pSeg(A, D) + pArc(A, D, E, 20)
  g += pV(A, "bl", "A") + pV(B, "tl", "B") + pV(C, "r", "C") + pV(D, "tr", "D") + pV(E, "br", "E")
  return stWrap(330, 210, g)
}
function t01TwoSecants() {
  let acb, arcAB; do { acb = randInt(40, 60); arcAB = randInt(120, 160) } while ((arcAB - 2 * acb) % 2 !== 0 || arcAB - 2 * acb < 10)
  return { condition_text: `Угол ACB равен ${deg(acb)}. Градусная мера дуги AB окружности, не содержащей точек D и E, равна ${deg(arcAB)}. Найдите угол DAE. Ответ дайте в градусах.`, image_url: svgUrl(figTwoSecants()), answer: ru((arcAB - 2 * acb) / 2) }
}
// касательная + хорда: угол = ½ дуги
function figTangentChord() {
  const O = [120, 130], R = 78
  const B = onC(O, R, 90), A = onC(O, R, 330)
  const tang = [B[0] + 95, B[1]]
  let g = pCircle(O, R) + pSeg([B[0] - 80, B[1]], tang) + pSeg(B, A) + pArc(B, tang, A, 16) + pDot(O)
  g += pV(B, "tl", "B") + pV(tang, "tr", "C") + pV(A, "r", "A") + pV(O, "l", "O")
  return stWrap(250, 230, g)
}
function t01TangentChord() {
  const arc = randInt(20, 140)
  return { condition_text: `Хорда AB стягивает дугу окружности в ${deg(arc)}. Найдите угол ABC между этой хордой и касательной к окружности, проведённой через точку B. Ответ дайте в градусах.`, image_url: svgUrl(figTangentChord()), answer: ru(arc / 2) }
}

// ── Вписанная / описанная окружность в многоугольник ────────────────────────
// четырёхугольник с вписанной окружностью (Pitot: AB+CD=BC+AD)
// Вершина описанного многоугольника = пересечение касательных к окружности
// (центр O, радиус r) в точках касания под углами d1, d2 (градусы, SVG y-вниз).
// Гарантирует, что построенные стороны реально касаются окружности.
function tangVertex(O, r, d1, d2) {
  const t1 = d1 * Math.PI / 180, t2 = d2 * Math.PI / 180
  const u1 = [Math.cos(t1), Math.sin(t1)], u2 = [Math.cos(t2), Math.sin(t2)]
  const c1 = r + u1[0] * O[0] + u1[1] * O[1], c2 = r + u2[0] * O[0] + u2[1] * O[1]
  const det = u1[0] * u2[1] - u1[1] * u2[0]
  return [(c1 * u2[1] - c2 * u1[1]) / det, (u1[0] * c2 - u2[0] * c1) / det]
}
function figTangentialQuad() {
  // Строим от окружности: углы точек касания (низ, право, верх, лево) → описанный ABCD.
  const O = [148, 118], r = 46
  const A = tangVertex(O, r, 205, 95), B = tangVertex(O, r, 95, 352)
  const C = tangVertex(O, r, 352, 272), D = tangVertex(O, r, 272, 205)
  let g = pPolygon([A, B, C, D]) + pCircle(O, r) + pDot(O)
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "tr", "C") + pV(D, "tl", "D")
  return stWrap(285, 205, g)
}
function t01TangentialQuad() {
  const mode = pick(["fourth", "perimeter"])
  if (mode === "perimeter") { const ab = randInt(10, 40), cd = randInt(10, 80); return { condition_text: `В четырёхугольник ABCD вписана окружность, AB = ${ab}, CD = ${cd}. Найдите периметр четырёхугольника ABCD.`, image_url: svgUrl(figTangentialQuad()), answer: ru(2 * (ab + cd)) } }
  // 4-я сторона: AB+CD=BC+AD
  if (Math.random() < 0.5) { const ab = randInt(8, 20), bc = randInt(5, 15), ad = randInt(5, 15); const cd = bc + ad - ab; if (cd < 1) return t01TangentialQuad(); return { condition_text: `В четырёхугольник ABCD вписана окружность, AB = ${ab}, BC = ${bc} и AD = ${ad}. Найдите четвёртую сторону четырёхугольника.`, image_url: svgUrl(figTangentialQuad()), answer: ru(cd) } }
  const ab = randInt(15, 30), bc = randInt(5, 12), cd = randInt(3, 10); const ad = ab + cd - bc
  return { condition_text: `В четырёхугольник ABCD вписана окружность, AB = ${ab}, BC = ${bc} и CD = ${cd}. Найдите четвёртую сторону четырёхугольника.`, image_url: svgUrl(figTangentialQuad()), answer: ru(ad) }
}
// трапеция, описанная около окружности: средняя линия = (сумма боковых)/2
function figTangentialTrap() {
  // Основания горизонтальны (касание сверху/снизу), боковые — симметричные касательные.
  const O = [146, 120], r = 56
  const A = tangVertex(O, r, 205, 90), B = tangVertex(O, r, 90, 335)
  const C = tangVertex(O, r, 335, 270), D = tangVertex(O, r, 270, 205)
  let g = pPolygon([A, B, C, D]) + pCircle(O, r) + pDot(O)
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "tr", "C") + pV(D, "tl", "D")
  return stWrap(290, 205, g)
}
function t01TangTrapMidline() {
  const c = randInt(5, 30), d = randInt(5, 30)
  return { condition_text: `Боковые стороны трапеции, описанной около окружности, равны ${c} и ${d}. Найдите среднюю линию трапеции.`, image_url: svgUrl(figTangentialTrap()), answer: ru(clean((c + d) / 2)) }
}
// прямоугольная трапеция, описанная около окружности: r = (P/2 − больш.бок)/2
function figRightTrap() {
  // Основания AB (низ) и DC (верх) горизонтальны и параллельны; левая AD вертикальна
  // (высота = 2r) → прямые углы при A и D; правая BC — наклонная (большая боковая).
  const O = [122, 120], r = 46
  const A = tangVertex(O, r, 180, 90), B = tangVertex(O, r, 90, 345)
  const C = tangVertex(O, r, 345, 270), D = tangVertex(O, r, 270, 180)
  let g = pPolygon([A, B, C, D]) + pCircle(O, r) + pRight(A, D, B, 10) + pRight(D, A, C, 10) + pDot(O)
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "tr", "C") + pV(D, "tl", "D")
  return stWrap(285, 210, g)
}
function t01RightTrapInradius() {
  // сумма боковых = P/2; меньшая боковая (высота) = 2r; P/2 = L + 2r → P = 2(L + 2r)
  const L = randInt(6, 15), r = randInt(3, 9), smaller = 2 * r, perimeter = 2 * (L + smaller)
  return { condition_text: `Периметр прямоугольной трапеции, описанной около окружности, равен ${perimeter}, её большая боковая сторона равна ${L}. Найдите радиус окружности.`, image_url: svgUrl(figRightTrap()), answer: ru(r) }
}
// равнобедренный треугольник: боковые + основание → радиус вписанной r = S/p
function figIncircleIso() {
  // Основание горизонтально, боковые — симметричные касательные, вершина сверху.
  const O = [135, 135], r = 45
  const A = tangVertex(O, r, 208, 90), B = tangVertex(O, r, 90, 332), C = tangVertex(O, r, 332, 208)
  let g = pPolygon([A, B, C]) + pCircle(O, r) + pTick(C, A, 2) + pTick(C, B, 2) + pDot(O)
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "t", "C")
  return stWrap(280, 210, g)
}
const PYTH = [[3, 4, 5], [8, 15, 17], [7, 24, 25], [20, 21, 29], [5, 12, 13], [9, 40, 41]]
function t01IncircleIsoRadius() {
  // r = p·q·t / (k+p): для части троек/t это бесконечная дробь (60t/7, 10t/3 → 25,714…).
  // Перебираем, пока радиус не станет короткой конечной десятичной.
  let p, q, k, t
  do { [p, q, k] = pick(PYTH); t = pick([1, 2, 3]) } while (decLen(p * q * t, k + p) > 2)
  const half = p * t, height = q * t, L = k * t, base = 2 * half
  const S = half * height, per = (2 * L + base) / 2, r = S / per
  return { condition_text: `Боковые стороны равнобедренного треугольника равны ${L}, основание равно ${base}. Найдите радиус вписанной окружности.`, image_url: svgUrl(figIncircleIso()), answer: ru(clean(r)) }
}
// вписанная делит боковую: отрезки от вершины (a) и от основания (b) → периметр = 2a + 4b
function t01IncircleIsoPerimeter() {
  const a = randInt(5, 15), b = randInt(1, 8)
  return { condition_text: `Окружность, вписанная в равнобедренный треугольник, делит в точке касания одну из боковых сторон на два отрезка, длины которых равны ${a} и ${b}, считая от вершины, противолежащей основанию. Найдите периметр треугольника.`, image_url: svgUrl(figIncircleIso()), answer: ru(2 * a + 4 * b) }
}
// прямоугольный треугольник: r = (a + b − c)/2
function figIncircleRight() {
  const A = [48, 182], C = [220, 182], B = [220, 66]
  const ac = C[0] - A[0], bc = C[1] - B[1], r = (ac + bc - Math.hypot(ac, bc)) / 2
  const O = [C[0] - r, C[1] - r]                       // центр вписанной: на r от обоих катетов
  let g = pPolygon([A, C, B]) + pCircle(O, r) + pRight(C, A, B, 11) + pDot(O)
  g += pV(A, "bl", "A") + pV(B, "tr", "B") + pV(C, "br", "C")
  return stWrap(285, 210, g)
}
function t01IncircleRight() {
  const [p, q, k] = pick(PYTH), t = pick([0.5, 1, 1.5, 2, 2.5])
  const a = clean(p * t), b = clean(q * t), c = clean(k * t), r = clean((a + b - c) / 2)
  return { condition_text: `В треугольнике ABC AC = ${ru(b)}, BC = ${ru(a)}, угол C равен 90°. Найдите радиус вписанной окружности.`, image_url: svgUrl(figIncircleRight()), answer: ru(r) }
}

// ── Параллелограмм / ромб / трапеция ────────────────────────────────────────
// параллелограмм ABCD (+ опц. точка E — середина AD, диагональ/заливка)
// midOn: "AD" → E(сер. AD) и отрезок BE; "CD" → G(сер. CD) и BG; "BC" → F(сер. BC) и AF
function figParallelogram({ midOn = null } = {}) {
  const A = [55, 180], B = [215, 180], C = [262, 68], D = [102, 68]
  // без заливки: область названа в условии
  let g = pPolygon([A, B, C, D])
  if (midOn === "AD") { const E = mid(A, D); g += pSeg(B, E) + pV(E, "l", "E") }
  if (midOn === "CD") { const G = mid(C, D); g += pSeg(B, G) + pV(G, "t", "G") }
  if (midOn === "BC") { const F = mid(B, C); g += pSeg(A, F) + pV(F, "r", "F") }
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "tr", "C") + pV(D, "tl", "D")
  return stWrap(290, 205, g)
}
function t01ParMidpoint() {
  const S = randInt(2, 40) * 4
  const mode = pick(["abe", "bcde", "abgd", "afcd"])
  if (mode === "abe") return { condition_text: `Площадь параллелограмма ABCD равна ${S}. Точка E — середина стороны AD. Найдите площадь треугольника ABE.`, image_url: svgUrl(figParallelogram({ midOn: "AD" })), answer: ru(S / 4) }
  if (mode === "bcde") return { condition_text: `Площадь параллелограмма ABCD равна ${S}. Точка E — середина стороны AD. Найдите площадь трапеции BCDE.`, image_url: svgUrl(figParallelogram({ midOn: "AD" })), answer: ru(3 * S / 4) }
  if (mode === "abgd") return { condition_text: `Площадь параллелограмма ABCD равна ${S}. Точка G — середина стороны CD. Найдите площадь трапеции ABGD.`, image_url: svgUrl(figParallelogram({ midOn: "CD" })), answer: ru(3 * S / 4) }
  return { condition_text: `Площадь параллелограмма ABCD равна ${S}. Точка F — середина стороны BC. Найдите площадь трапеции AFCD.`, image_url: svgUrl(figParallelogram({ midOn: "BC" })), answer: ru(3 * S / 4) }
}
// один угол параллелограмма больше другого на d
function t01ParAngle() {
  const d = randInt(10, 80) * 2                          // чётный → целые
  if (Math.random() < 0.5) return { condition_text: `Один угол параллелограмма больше другого на ${deg(d)}. Найдите меньший угол. Ответ дайте в градусах.`, image_url: svgUrl(figParallelogram()), answer: ru((180 - d) / 2) }
  return { condition_text: `Один угол параллелограмма больше другого на ${deg(d)}. Найдите больший угол. Ответ дайте в градусах.`, image_url: svgUrl(figParallelogram()), answer: ru((180 + d) / 2) }
}
// стороны a<b + высота на одну → высота на другую (S = a·hₐ = b·h_b)
function t01ParHeights() {
  // h_big = s_small·h_small / s_big — целое при (s_big/gcd) | h_small
  let sSmall, sBig, hSmall, hBig
  for (let g = 0; g < 300; g++) {
    let a = randInt(5, 25), b = randInt(5, 25); if (a === b) continue
    sSmall = Math.min(a, b); sBig = Math.max(a, b)
    const need = sBig / gcd(sSmall, sBig); if (need > 18) continue
    hSmall = need * randInt(1, Math.floor(18 / need))
    hBig = sSmall * hSmall / sBig
    if (hBig >= 1) break
  }
  return { condition_text: `Стороны параллелограмма равны ${sSmall} и ${sBig}. Высота, опущенная на меньшую из этих сторон, равна ${hSmall}. Найдите высоту, опущенную на бо́льшую сторону параллелограмма.`, image_url: svgUrl(figParallelogram()), answer: ru(clean(hBig)) }
}
// ромб (+ диагональ)
function figRhombus(diag) {
  const B = [70, 60], C = [220, 60], D = [255, 172], A = [105, 172]
  const P = { A, B, C, D }
  let g = pPolygon([B, C, D, A])
  if (diag) g += pSeg(P[diag[0]], P[diag[1]])
  g += pV(B, "tl", "B") + pV(C, "tr", "C") + pV(D, "br", "D") + pV(A, "bl", "A")
  return stWrap(290, 205, g)
}
// угол между стороной и диагональю ромба → острый угол = 180 − 2φ
function t01RhombusSideDiag() {
  const phi = randInt(46, 75)
  return { condition_text: `Угол между стороной и диагональю ромба равен ${deg(phi)}. Найдите острый угол ромба. Ответ дайте в градусах.`, image_url: svgUrl(figRhombus(["A", "C"])), answer: ru(180 - 2 * phi) }
}
// ромб: угол → ACB / BDC (диагональ делит угол пополам)
function t01RhombusAngle() {
  if (Math.random() < 0.5) { const cda = randInt(15, 75) * 2; return { condition_text: `В ромбе ABCD угол CDA равен ${deg(cda)}. Найдите угол ACB. Ответ дайте в градусах.`, image_url: svgUrl(figRhombus(["A", "C"])), answer: ru((180 - cda) / 2) } }
  const dab = randInt(15, 80) * 2
  return { condition_text: `В ромбе ABCD угол DAB равен ${deg(dab)}. Найдите угол BDC. Ответ дайте в градусах.`, image_url: svgUrl(figRhombus(["B", "D"])), answer: ru((180 - dab) / 2) }
}
// трапеция: основания → больший отрезок средней линии, отсекаемый диагональю = max/2
function figTrapDiag() {
  const A = [40, 176], B = [252, 176], C = [200, 62], D = [92, 62]
  const E = mid(A, D), F = mid(B, C)
  let g = pPolygon([A, B, C, D]) + pSeg(E, F) + pSeg(D, B)
  g += pV(A, "bl", "A") + pV(B, "br", "B") + pV(C, "tr", "C") + pV(D, "tl", "D") + pV(E, "l", "E") + pV(F, "r", "F")
  return stWrap(290, 205, g)
}
function t01TrapMidDiag() {
  let a, b; do { a = randInt(2, 12), b = randInt(2, 12) } while (a === b)
  return { condition_text: `Основания трапеции равны ${a} и ${b}. Найдите больший из отрезков, на которые делит среднюю линию этой трапеции одна из её диагоналей.`, image_url: svgUrl(figTrapDiag()), answer: ru(clean(Math.max(a, b) / 2)) }
}

// ============================================================================
// №3 — СТЕРЕОМЕТРИЯ (КЭС 7.3 Многогранники). Чертёж обязателен, схематичный
// «как ФИПИ» (не в масштабе): меняются только числа в условии, размеры на
// рисунок не наносятся. Ответ считается кодом.
// ============================================================================

// Прямоугольный параллелепипед ABCDA₁B₁C₁D₁ с выделенным тетраэдром A, B, C, B₁.
function boxTetraSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 360" width="460" height="360" font-family="Arial, sans-serif">` +
    `<rect width="460" height="360" fill="#fff"/>` +
    // скрытые рёбра (вершина D в глубине)
    `<line x1="70" y1="250" x2="220" y2="200" stroke="#000" stroke-width="1.2" stroke-dasharray="5 4"/>` +
    `<line x1="220" y1="200" x2="395" y2="250" stroke="#000" stroke-width="1.2" stroke-dasharray="5 4"/>` +
    `<line x1="220" y1="200" x2="220" y2="50" stroke="#000" stroke-width="1.2" stroke-dasharray="5 4"/>` +
    // рёбра параллелепипеда
    `<line x1="70" y1="250" x2="70" y2="100" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="395" y1="250" x2="395" y2="100" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="70" y1="100" x2="245" y2="150" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="245" y1="150" x2="395" y2="100" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="395" y1="100" x2="220" y2="50" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="220" y1="50" x2="70" y2="100" stroke="#000" stroke-width="1.3"/>` +
    // тетраэдр A,B,C,B₁ (жирные рёбра)
    `<line x1="70" y1="250" x2="245" y2="300" stroke="#000" stroke-width="2.7"/>` +
    `<line x1="245" y1="300" x2="395" y2="250" stroke="#000" stroke-width="2.7"/>` +
    `<line x1="245" y1="300" x2="245" y2="150" stroke="#000" stroke-width="2.7"/>` +
    `<line x1="70" y1="250" x2="245" y2="150" stroke="#000" stroke-width="2.7"/>` +
    `<line x1="395" y1="250" x2="245" y2="150" stroke="#000" stroke-width="2.7"/>` +
    `<line x1="70" y1="250" x2="395" y2="250" stroke="#000" stroke-width="2.2" stroke-dasharray="6 4"/>` +
    // вершины
    `<g font-size="17" font-style="italic" fill="#000" text-anchor="middle">` +
    `<text x="63" y="270">A</text>` +
    `<text x="245" y="322">B</text>` +
    `<text x="405" y="268">C</text>` +
    `<text x="205" y="216">D</text>` +
    `<text x="55" y="98">A₁</text>` +
    `<text x="232" y="142">B₁</text>` +
    `<text x="410" y="98">C₁</text>` +
    `<text x="214" y="40">D₁</text>` +
    `</g></svg>`
}

function t03BoxTetra() {
  let a, b, c
  do { a = randInt(3, 9); b = randInt(3, 9); c = randInt(3, 9) } while ((a * b * c) % 6 !== 0)
  return {
    condition_text: `В прямоугольном параллелепипеде ABCDA₁B₁C₁D₁ известно, что AB = ${a}, BC = ${b}, AA₁ = ${c}. Найдите объём многогранника, вершинами которого являются точки A, B, C, B₁.`,
    image_url: svgUrl(boxTetraSvg()),
    answer: ru(a * b * c / 6),
  }
}

// Стоящая наклонённая треугольная призма; секущая плоскость через среднюю линию
// основания у левой вершины (параллельно боковому ребру) отсекает малый «нос».
// Прямая треугольная призма с секущей плоскостью через среднюю линию основания
// (параллельна боковому ребру). Сечение — прямоугольник: верхняя средняя линия и
// передняя вертикаль сплошные, задняя вертикаль и нижняя средняя линия штрихом.
function prismMidlineSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 265 330" width="265" height="330" font-family="Arial, sans-serif">` +
    `<rect width="265" height="330" fill="#fff"/>` +
    // скрытые: заднее нижнее ребро и задняя часть сечения
    `<line x1="40" y1="225" x2="225" y2="253" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="187"/>` +
    `<line x1="132.5" y1="59" x2="132.5" y2="239" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="180"/>` +
    `<line x1="132.5" y1="239" x2="151" y2="269" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="35"/>` +
    // верхнее основание
    `<line x1="40" y1="45" x2="225" y2="73" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="40" y1="45" x2="77" y2="105" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="77" y1="105" x2="225" y2="73" stroke="#000" stroke-width="1.5"/>` +
    // нижнее основание
    `<line x1="40" y1="225" x2="77" y2="285" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="77" y1="285" x2="225" y2="253" stroke="#000" stroke-width="1.5"/>` +
    // боковые рёбра
    `<line x1="40" y1="45" x2="40" y2="225" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="77" y1="105" x2="77" y2="285" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="225" y1="73" x2="225" y2="253" stroke="#000" stroke-width="1.5"/>` +
    // сечение (видимая часть)
    `<line x1="132.5" y1="59" x2="151" y2="89" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="151" y1="89" x2="151" y2="269" stroke="#000" stroke-width="1.5"/>` +
    `</svg>`
}

function t03PrismMidline() {
  const v0 = randInt(2, 40)
  return {
    condition_text: `Через среднюю линию основания треугольной призмы проведена плоскость, параллельная боковому ребру. Найдите объём этой призмы, если объём отсечённой треугольной призмы равен ${v0}.`,
    image_url: svgUrl(prismMidlineSvg()),
    answer: ru(4 * v0),
  }
}

// Прямая правильная треугольная призма (вертикальные боковые рёбра) с сечением
// через среднюю линию основания у левой вершины.
function prismUprightSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 420" width="340" height="420" font-family="Arial, sans-serif">` +
    `<rect width="340" height="420" fill="#fff"/>` +
    // скрытые рёбра (задняя вершина)
    `<line x1="90" y1="360" x2="200" y2="300" stroke="#000" stroke-width="1.4" stroke-dasharray="5 4"/>` +
    `<line x1="250" y1="360" x2="200" y2="300" stroke="#000" stroke-width="1.4" stroke-dasharray="5 4"/>` +
    `<line x1="200" y1="300" x2="200" y2="70" stroke="#000" stroke-width="1.4" stroke-dasharray="5 4"/>` +
    // рёбра призмы
    `<line x1="90" y1="360" x2="250" y2="360" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="90" y1="360" x2="90" y2="130" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="250" y1="360" x2="250" y2="130" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="90" y1="130" x2="250" y2="130" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="90" y1="130" x2="200" y2="70" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="250" y1="130" x2="200" y2="70" stroke="#000" stroke-width="1.7"/>` +
    // секущая плоскость через среднюю линию основания
    `<line x1="170" y1="360" x2="170" y2="130" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="170" y1="130" x2="145" y2="100" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="170" y1="360" x2="145" y2="330" stroke="#000" stroke-width="1.4" stroke-dasharray="5 4"/>` +
    `<line x1="145" y1="330" x2="145" y2="100" stroke="#000" stroke-width="1.4" stroke-dasharray="5 4"/>` +
    `</svg>`
}

// То же, что t03PrismCut, но призма правильная (и чертёж прямостоящий).
function t03PrismCutRegular() {
  const v = 4 * randInt(2, 40)
  return {
    condition_text: `Через среднюю линию основания правильной треугольной призмы, объём которой равен ${v}, проведена плоскость, параллельная боковому ребру. Найдите объём отсечённой треугольной призмы.`,
    image_url: svgUrl(prismUprightSvg()),
    answer: ru(v / 4),
  }
}

// Обратная задача: дан объём призмы → отсечённая = ¼ (все стороны малого треуг. ×½).
function t03PrismCut() {
  const v = 4 * randInt(2, 40)
  return {
    condition_text: `Через среднюю линию основания треугольной призмы, объём которой равен ${v}, проведена плоскость, параллельная боковому ребру. Найдите объём отсечённой треугольной призмы.`,
    image_url: svgUrl(prismMidlineSvg()),
    answer: ru(v / 4),
  }
}

// Правильная треугольная призма ABCA₁B₁C₁; выделен тетраэдр A, B, C, C₁.
function prismTetraC1Svg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 360" width="380" height="360" font-family="Arial, sans-serif">` +
    `<rect width="380" height="360" fill="#fff"/>` +
    // рёбра призмы (тонкие)
    `<line x1="110" y1="110" x2="310" y2="110" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="310" y1="110" x2="215" y2="58" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="215" y1="58" x2="110" y2="110" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="310" y1="300" x2="310" y2="110" stroke="#000" stroke-width="1.3"/>` +
    // скрытое заднее боковое ребро B–B₁
    `<line x1="215" y1="248" x2="215" y2="58" stroke="#000" stroke-width="1.2" stroke-dasharray="5 4"/>` +
    // тетраэдр A,B,C,C₁: видимые рёбра жирные
    `<line x1="110" y1="300" x2="310" y2="300" stroke="#000" stroke-width="2.7"/>` +
    `<line x1="110" y1="300" x2="110" y2="110" stroke="#000" stroke-width="2.7"/>` +
    `<line x1="110" y1="110" x2="310" y2="300" stroke="#000" stroke-width="2.7"/>` +
    // тетраэдр: скрытые рёбра к вершине B
    `<line x1="110" y1="300" x2="215" y2="248" stroke="#000" stroke-width="1.4" stroke-dasharray="5 4"/>` +
    `<line x1="310" y1="300" x2="215" y2="248" stroke="#000" stroke-width="1.4" stroke-dasharray="5 4"/>` +
    `<line x1="110" y1="110" x2="215" y2="248" stroke="#000" stroke-width="1.4" stroke-dasharray="5 4"/>` +
    // подписи
    `<g font-size="17" font-style="italic" fill="#000" text-anchor="middle">` +
    `<text x="98" y="320">C</text><text x="322" y="320">A</text><text x="204" y="242">B</text>` +
    `<text x="92" y="108">C₁</text><text x="324" y="106">A₁</text><text x="215" y="48">B₁</text>` +
    `</g></svg>`
}

function t03PrismTetraC1() {
  let s, l
  do { s = randInt(3, 12); l = randInt(3, 12) } while ((s * l) % 3 !== 0)
  return {
    condition_text: `Найдите объём многогранника, вершинами которого являются вершины A, B, C, C₁ правильной треугольной призмы ABCA₁B₁C₁, площадь основания которой равна ${s}, а боковое ребро равно ${l}.`,
    image_url: svgUrl(prismTetraC1Svg()),
    answer: ru(s * l / 3),
  }
}

// Прямоугольный параллелепипед в три четверти; выделена пирамида A, B, C, D, B₁
// (основание ABCD — нижняя грань, апекс B₁). Боковые рёбра к B₁ — внутренние (штрих).
function boxPyramidSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 470 420" width="470" height="420" font-family="Arial, sans-serif">` +
    `<rect width="470" height="420" fill="#fff"/>` +
    // верхняя грань
    `<line x1="405" y1="145" x2="195" y2="95" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="195" y1="95" x2="120" y2="145" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="120" y1="145" x2="330" y2="195" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="330" y1="195" x2="405" y2="145" stroke="#000" stroke-width="1.3"/>` +
    // вертикальные рёбра
    `<line x1="330" y1="380" x2="330" y2="195" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="120" y1="330" x2="120" y2="145" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="405" y1="330" x2="405" y2="145" stroke="#000" stroke-width="1.3"/>` +
    // скрытое заднее вертикальное ребро B–B₁
    `<line x1="195" y1="280" x2="195" y2="95" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    // основание ABCD: передние рёбра
    `<line x1="120" y1="330" x2="330" y2="380" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="330" y1="380" x2="405" y2="330" stroke="#000" stroke-width="1.3"/>` +
    // задние рёбра основания
    `<line x1="405" y1="330" x2="195" y2="280" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    `<line x1="195" y1="280" x2="120" y2="330" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    // боковые рёбра пирамиды к апексу B₁
    `<line x1="195" y1="95" x2="405" y2="330" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    `<line x1="195" y1="95" x2="120" y2="330" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    `<line x1="195" y1="95" x2="330" y2="380" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    // подписи
    `<g font-size="17" font-style="italic" fill="#000" text-anchor="middle">` +
    `<text x="421" y="332">A</text><text x="180" y="276">B</text><text x="104" y="332">C</text><text x="332" y="400">D</text>` +
    `<text x="421" y="146">A₁</text><text x="195" y="82">B₁</text><text x="104" y="143">C₁</text><text x="346" y="196">D₁</text>` +
    `</g></svg>`
}

function t03BoxPyramid() {
  let a, b, c
  do { a = randInt(3, 12); b = randInt(2, 9); c = randInt(3, 12) } while ((a * b * c) % 3 !== 0)
  return {
    condition_text: `Найдите объём многогранника, вершинами которого являются вершины A, B, C, D, B₁ прямоугольного параллелепипеда ABCDA₁B₁C₁D₁, у которого AB = ${a}, BC = ${b}, BB₁ = ${c}.`,
    image_url: svgUrl(boxPyramidSvg()),
    answer: ru(a * b * c / 3),
  }
}

// Прямоугольный параллелепипед; выделена пирамида A, B, C, D, C₁ (основание ABCD,
// апекс C₁ над задней вершиной C). Боковые рёбра к C₁ — внутренние (штрих).
function boxPyramidC1Svg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 420" width="460" height="420" font-family="Arial, sans-serif">` +
    `<rect width="460" height="420" fill="#fff"/>` +
    // верхняя грань
    `<line x1="200" y1="185" x2="400" y2="145" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="400" y1="145" x2="295" y2="90" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="295" y1="90" x2="95" y2="130" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="95" y1="130" x2="200" y2="185" stroke="#000" stroke-width="1.3"/>` +
    // вертикальные рёбра
    `<line x1="200" y1="375" x2="200" y2="185" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="400" y1="335" x2="400" y2="145" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="95" y1="320" x2="95" y2="130" stroke="#000" stroke-width="1.3"/>` +
    // скрытое заднее вертикальное ребро C–C₁
    `<line x1="295" y1="280" x2="295" y2="90" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    // основание ABCD: передние рёбра
    `<line x1="200" y1="375" x2="400" y2="335" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="200" y1="375" x2="95" y2="320" stroke="#000" stroke-width="1.3"/>` +
    // задние рёбра основания
    `<line x1="400" y1="335" x2="295" y2="280" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    `<line x1="295" y1="280" x2="95" y2="320" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    // боковые рёбра пирамиды к апексу C₁
    `<line x1="295" y1="90" x2="200" y2="375" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    `<line x1="295" y1="90" x2="400" y2="335" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    `<line x1="295" y1="90" x2="95" y2="320" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    // подписи
    `<g font-size="17" font-style="italic" fill="#000" text-anchor="middle">` +
    `<text x="200" y="396">A</text><text x="416" y="338">B</text><text x="280" y="282">C</text><text x="79" y="324">D</text>` +
    `<text x="216" y="192">A₁</text><text x="416" y="140">B₁</text><text x="295" y="78">C₁</text><text x="79" y="128">D₁</text>` +
    `</g></svg>`
}

function t03BoxPyramidC1() {
  let a, b, c
  do { a = randInt(3, 12); b = randInt(2, 9); c = randInt(3, 12) } while ((a * b * c) % 3 !== 0)
  return {
    condition_text: `В прямоугольном параллелепипеде ABCDA₁B₁C₁D₁ известно, что BC = ${a}, CD = ${b}, CC₁ = ${c}. Найдите объём многогранника, вершинами которого являются точки A, B, C, D, C₁.`,
    image_url: svgUrl(boxPyramidC1Svg()),
    answer: ru(a * b * c / 3),
  }
}

// Правильная треугольная призма; выделен многогранник B, C, A₁, B₁, C₁

// Призма без тетраэдра «третья нижняя вершина + верхнее основание»: две любые нижние
// вершины плюс всё верхнее основание ⟹ V = S·L − S·L/3 = 2S·L/3.
const PRISM_PENTA_PAIRS = [["B", "C"], ["A", "C"], ["A", "B"]]
function t03PrismPenta() {
  let s, l
  do { s = randInt(2, 12); l = randInt(3, 12) } while ((s * l) % 3 !== 0)
  const names = `${pick(PRISM_PENTA_PAIRS).join(", ")}, A₁, B₁, C₁`
  const text = Math.random() < 0.5
    ? `Дана правильная треугольная призма ABCA₁B₁C₁, площадь основания которой равна ${s}, а боковое ребро равно ${l}. Найдите объём многогранника, вершинами которого являются точки ${names}.`
    : `Найдите объём многогранника, вершинами которого являются вершины ${names} правильной треугольной призмы ABCA₁B₁C₁. Площадь основания призмы равна ${s}, а боковое ребро равно ${l}.`
  return { condition_text: text, image_url: svgUrl(triPrismSvg()), answer: ru(2 * s * l / 3) }
}

// Чистый параллелепипед ABCDA₁B₁C₁D₁ (тело A,B,C,D,A₁,B₁ ученик достраивает сам).
// Приземистый параллелепипед в ориентации ФИПИ (image6): передняя грань ABB₁A₁ —
// прямоугольник, задняя смещена вверх-вправо; скрытая вершина — задняя нижняя D.
function boxPlainSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 310" width="350" height="310" font-family="Arial, sans-serif">` +
    `<rect width="350" height="310" fill="#fff"/>` +
    // скрытые рёбра (вершина D)
    `<line x1="105" y1="230" x2="45" y2="275" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="75"/>` +
    `<line x1="105" y1="230" x2="305" y2="230" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="200"/>` +
    `<line x1="105" y1="230" x2="105" y2="135" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="95"/>` +
    // видимые рёбра
    `<line x1="45" y1="275" x2="245" y2="275" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="245" y1="275" x2="305" y2="230" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="45" y1="275" x2="45" y2="180" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="245" y1="275" x2="245" y2="180" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="305" y1="230" x2="305" y2="135" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="45" y1="180" x2="245" y2="180" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="245" y1="180" x2="305" y2="135" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="45" y1="180" x2="105" y2="135" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="105" y1="135" x2="305" y2="135" stroke="#000" stroke-width="1.5"/>` +
    // подписи (B₁ — внутри верхней грани, чтобы не легла на ребро B₁C₁)
    `<g font-size="17" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="34" y="297">A</text><text x="248" y="297">B</text><text x="318" y="251">C</text><text x="118" y="248">D</text>` +
    `<text x="29" y="172">A₁</text><text x="227" y="167">B₁</text><text x="103" y="126">D₁</text><text x="320" y="127">C₁</text>` +
    `</g></svg>`
}

// ── КЭС 7.4 Тела вращения ────────────────────────────────────────────────────
// Цилиндр с вписанным конусом (общие основание и высота, h = R).
function cylConeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 380" width="500" height="380" font-family="Arial, sans-serif">` +
    `<rect width="500" height="380" fill="#fff"/>` +
    `<ellipse cx="250" cy="110" rx="145" ry="40" fill="none" stroke="#000" stroke-width="2.2"/>` +
    `<line x1="105" y1="110" x2="105" y2="280" stroke="#000" stroke-width="2.2"/>` +
    `<line x1="395" y1="110" x2="395" y2="280" stroke="#000" stroke-width="2.2"/>` +
    `<path d="M105,280 A145,40 0 0,0 395,280" fill="none" stroke="#000" stroke-width="2.2"/>` +
    `<path d="M105,280 A145,40 0 0,1 395,280" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="7 5"/>` +
    // конус: образующие, высота, радиус
    `<line x1="250" y1="110" x2="105" y2="280" stroke="#000" stroke-width="1.5" stroke-dasharray="7 5"/>` +
    `<line x1="250" y1="110" x2="395" y2="280" stroke="#000" stroke-width="1.5" stroke-dasharray="7 5"/>` +
    `<line x1="250" y1="110" x2="250" y2="280" stroke="#000" stroke-width="1.5" stroke-dasharray="7 5"/>` +
    `<line x1="250" y1="280" x2="395" y2="280" stroke="#000" stroke-width="1.5" stroke-dasharray="7 5"/>` +
    `<polyline points="250,266 264,266 264,280" fill="none" stroke="#000" stroke-width="1.4"/>` +
    `</svg>`
}

// h=R → l=R√2; S_кон=πRl=πR²√2=k√2 ⟹ πR²=k; S_цил=2πRh=2πR²=2k.
function t03CylConeLateral() {
  const k = randInt(2, 30)
  return {
    condition_text: `Цилиндр и конус имеют общие основание и высоту. Высота цилиндра равна радиусу основания. Площадь боковой поверхности конуса равна ${k}${rT(2)}. Найдите площадь боковой поверхности цилиндра.`,
    image_url: svgUrl(cylConeSvg()),
    answer: ru(2 * k),
  }
}

// Конус, вписанный в шар: радиус основания конуса равен радиусу шара
// (основание — большой круг, высота = R). Образующие идут на заднюю дугу.
function coneInSphereSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" font-family="Arial, sans-serif">` +
    `<rect width="500" height="500" fill="#fff"/>` +
    `<circle cx="250" cy="290" r="170" fill="none" stroke="#000" stroke-width="1.8"/>` +
    `<path d="M80,290 A170,62 0 0,0 420,290" fill="none" stroke="#000" stroke-width="1.8"/>` +
    `<path d="M80,290 A170,62 0 0,1 420,290" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="386"/>` +
    `<line x1="250" y1="120" x2="85" y2="274" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="230"/>` +
    `<line x1="250" y1="120" x2="415" y2="274" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="230"/>` +
    `</svg>`
}

// Тот же чертёж с отмеченным центром сферы (для задач «сфера описана около конуса»,
// где по условию центр сферы совпадает с центром основания конуса).
function coneCircumSphereSvg() {
  return coneInSphereSvg().replace("</svg>", `<circle cx="250" cy="290" r="4" fill="#000"/></svg>`)
}

// V_кон = πR³/3, V_шара = 4πR³/3 = 4·V_кон.
function t03ConeInSphere() {
  const v = randInt(2, 40)
  return {
    condition_text: `Конус вписан в шар. Радиус основания конуса равен радиусу шара. Объём конуса равен ${v}. Найдите объём шара.`,
    image_url: svgUrl(coneInSphereSvg()),
    answer: ru(4 * v),
  }
}

// Цилиндр и конус с общими основанием и высотой; образующие конуса — сплошные.
function cylConeVolSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 540" width="500" height="540" font-family="Arial, sans-serif">` +
    `<rect width="500" height="540" fill="#fff"/>` +
    `<ellipse cx="250" cy="110" rx="150" ry="28" fill="none" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="100" y1="110" x2="100" y2="430" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="400" y1="110" x2="400" y2="430" stroke="#000" stroke-width="1.5"/>` +
    `<path d="M100,430 A150,28 0 0,0 400,430" fill="none" stroke="#000" stroke-width="2"/>` +
    `<path d="M100,430 A150,28 0 0,1 400,430" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="316"/>` +
    // конус
    `<line x1="250" y1="110" x2="100" y2="430" stroke="#000" stroke-width="2"/>` +
    `<line x1="250" y1="110" x2="400" y2="430" stroke="#000" stroke-width="2"/>` +
    `<line x1="250" y1="110" x2="250" y2="430" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="316"/>` +
    `<line x1="250" y1="430" x2="400" y2="430" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="148"/>` +
    `<polyline points="250,414 266,414 266,430" fill="none" stroke="#000" stroke-width="1.4"/>` +
    `</svg>`
}

// Общие основание и высота → V_конуса = V_цилиндра/3.
function t03CylConeVolume() {
  const v = 3 * randInt(2, 30)
  return {
    condition_text: `Цилиндр и конус имеют общие основание и высоту. Объём цилиндра равен ${v}. Найдите объём конуса.`,
    image_url: svgUrl(cylConeVolSvg()),
    answer: ru(v / 3),
  }
}

// Цилиндр и конус, h = R; образующие конуса сплошные, высота/радиус пунктиром.
function cylConeEqSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 400" width="500" height="400" font-family="Arial, sans-serif">` +
    `<rect width="500" height="400" fill="#fff"/>` +
    `<ellipse cx="250" cy="110" rx="150" ry="30" fill="none" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="100" y1="110" x2="100" y2="290" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="400" y1="110" x2="400" y2="290" stroke="#000" stroke-width="1.5"/>` +
    `<path d="M100,290 A150,30 0 0,0 400,290" fill="none" stroke="#000" stroke-width="2"/>` +
    `<path d="M100,290 A150,30 0 0,1 400,290" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="316"/>` +
    `<line x1="250" y1="110" x2="100" y2="290" stroke="#000" stroke-width="2"/>` +
    `<line x1="250" y1="110" x2="400" y2="290" stroke="#000" stroke-width="2"/>` +
    `<line x1="250" y1="110" x2="250" y2="290" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="176"/>` +
    `<line x1="250" y1="290" x2="400" y2="290" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="148"/>` +
    `<polyline points="250,274 266,274 266,290" fill="none" stroke="#000" stroke-width="1.4"/>` +
    `</svg>`
}

// Обратная к t03CylConeLateral: S_цил=2πR²=k√2 ⟹ S_кон=πR²√2 = k.
function t03CylConeLatInverse() {
  const k = randInt(2, 30)
  return {
    condition_text: `Цилиндр и конус имеют общие основание и высоту. Высота цилиндра равна радиусу основания. Площадь боковой поверхности цилиндра равна ${k}${rT(2)}. Найдите площадь боковой поверхности конуса.`,
    image_url: svgUrl(cylConeEqSvg()),
    answer: ru(k),
  }
}

// «в 2 раза», но «в 5 раз» / «в 12 раз».
const razWord = (n) => {
  const t = n % 100, u = n % 10
  return t >= 11 && t <= 14 ? "раз" : u >= 2 && u <= 4 ? "раза" : "раз"
}

// V = ⅓πR²h: радиус ×k → объём ×k² (высота не меняется).
function t03ConeScale() {
  const k = randInt(2, 15)
  return {
    condition_text: `Во сколько раз увеличится объём конуса, если радиус его основания увеличится в ${k} ${razWord(k)}, а высота останется прежней?`,
    answer: ru(k * k),
  }
}

// Одиночный цилиндр (ФИПИ): верхнее основание — полный эллипс, у нижнего задняя
// дуга штрихом; штрихом же ось и диаметр нижнего основания.
function cylPlainSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 390" width="280" height="390" font-family="Arial, sans-serif">` +
    `<rect width="280" height="390" fill="#fff"/>` +
    `<path d="M30,320 A110,26 0 0,1 250,320" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="8 6" pathLength="228"/>` +
    `<line x1="140" y1="70" x2="140" y2="320" stroke="#000" stroke-width="1.5" stroke-dasharray="8 6" pathLength="250"/>` +
    `<line x1="30" y1="320" x2="250" y2="320" stroke="#000" stroke-width="1.5" stroke-dasharray="8 6" pathLength="220"/>` +
    `<ellipse cx="140" cy="70" rx="110" ry="26" fill="none" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="30" y1="70" x2="30" y2="320" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="250" y1="70" x2="250" y2="320" stroke="#000" stroke-width="1.8"/>` +
    `<path d="M30,320 A110,26 0 0,0 250,320" fill="none" stroke="#000" stroke-width="1.8"/>` +
    `</svg>`
}

// S_бок = 2πRh = πdh ⟹ по S и диаметру находится высота.
function t03CylLatHeight() {
  const d = randInt(2, 14), h = randInt(2, 14)
  return {
    condition_text: `Площадь боковой поверхности цилиндра равна ${d * h}π, а диаметр основания равен ${d}. Найдите высоту цилиндра.`,
    image_url: svgUrl(cylPlainSvg()),
    answer: ru(h),
  }
}

// Обратная: по S и высоте находится диаметр основания.
function t03CylLatDiameter() {
  const d = randInt(2, 14), h = randInt(2, 14)
  return {
    condition_text: `Площадь боковой поверхности цилиндра равна ${d * h}π, а высота равна ${h}. Найдите диаметр основания цилиндра.`,
    image_url: svgUrl(cylPlainSvg()),
    answer: ru(d),
  }
}

// Обратная к «шар вписан в цилиндр»: V_цил = 1,5·V_шара ⟹ V_шара = 2·V_цил/3.
function t03CylSphereVolInv() {
  const v = 3 * randInt(2, 30)
  return {
    condition_text: `Цилиндр, объём которого равен ${v}, описан около шара. Найдите объём шара.`,
    image_url: svgUrl(sphereInCylSvg()),
    answer: ru(2 * v / 3),
  }
}

// Две цилиндрические кружки с ручками: первая узкая и высокая, вторая шире и ниже.
function mugsSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 320" width="450" height="320" font-family="Arial, sans-serif">` +
    `<rect width="450" height="320" fill="#fff"/>` +
    // задние дуги днищ
    `<path d="M32,275 A58,16 0 0,1 148,275" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="120"/>` +
    `<path d="M205,275 A95,25 0 0,1 395,275" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="197"/>` +
    // ручки (двойной контур)
    `<path d="M148,100 C218,100 218,215 148,215" fill="none" stroke="#000" stroke-width="2.4"/>` +
    `<path d="M148,120 C193,120 193,195 148,195" fill="none" stroke="#000" stroke-width="2.4"/>` +
    `<path d="M395,190 C443,190 443,252 395,252" fill="none" stroke="#000" stroke-width="2.4"/>` +
    `<path d="M395,202 C425,202 425,240 395,240" fill="none" stroke="#000" stroke-width="2.4"/>` +
    // первая кружка
    `<ellipse cx="90" cy="55" rx="58" ry="16" fill="#fff" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="32" y1="55" x2="32" y2="275" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="148" y1="55" x2="148" y2="275" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M32,275 A58,16 0 0,0 148,275" fill="none" stroke="#000" stroke-width="1.6"/>` +
    // вторая кружка
    `<ellipse cx="300" cy="165" rx="95" ry="25" fill="#fff" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="205" y1="165" x2="205" y2="275" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="395" y1="165" x2="395" y2="275" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M205,275 A95,25 0 0,0 395,275" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `</svg>`
}

// V = πR²h: первая вдвое выше, вторая в k раз шире ⟹ V₂/V₁ = k²/2.
const MUG_WIDER = [[1.5, "1,5"], [2, "два"], [2.5, "2,5"], [3, "три"], [4, "четыре"]]
function t03MugRatio() {
  const [k, word] = pick(MUG_WIDER)
  return {
    condition_text: `Первая цилиндрическая кружка вдвое выше второй, зато вторая в ${word} раза шире. Найдите отношение объёма второй кружки к объёму первой.`,
    image_url: svgUrl(mugsSvg()),
    answer: ru(clean(k * k / 2)),
  }
}

// Перелив жидкости: объём тот же, S основания ×k² ⟹ уровень ÷k² (чертежа в ФИПИ нет).
function t03LiquidWider() {
  const k = randInt(2, 7), h = k * k * randInt(1, 12)
  return {
    condition_text: `В цилиндрическом сосуде уровень жидкости достигает ${h} см. На какой высоте будет находиться уровень жидкости, если её перелить во второй цилиндрический сосуд, диаметр которого в ${k} ${razWord(k)} больше диаметра первого? Ответ выразите в см.`,
    answer: ru(h / (k * k)),
  }
}

// Обратный перелив: диаметр в k раз меньше ⟹ уровень ×k².
function t03LiquidNarrower() {
  const k = randInt(2, 6), h = randInt(1, 8)
  return {
    condition_text: `В цилиндрическом сосуде уровень жидкости достигает ${h} см. На какой высоте будет находиться уровень жидкости, если её перелить во второй цилиндрический сосуд, диаметр которого в ${k} ${razWord(k)} меньше диаметра первого? Ответ выразите в сантиметрах.`,
    answer: ru(h * k * k),
  }
}

// Погружение детали: уровень (а значит и объём) вырос в k раз ⟹ V_детали = V·(k−1).
const SUBMERGE_K = [[1.2, "1,2"], [1.25, "1,25"], [1.4, "1,4"], [1.5, "1,5"], [1.75, "1,75"], [2, "2"]]
function t03Submerge() {
  const [k, word] = pick(SUBMERGE_K)
  const unitDm = Math.random() < 0.5          // в банке встречаются и куб. см, и дм³
  let v
  do { v = randInt(1, 40) * 100 } while (!Number.isInteger(clean(v * (k - 1))) ||
    (unitDm && !Number.isInteger(clean(v * (k - 1) / 100))))
  return {
    condition_text: unitDm
      ? `В цилиндрический сосуд налили ${clean(v / 100)} дм³ воды. В воду полностью погрузили деталь. При этом уровень жидкости в сосуде увеличился в ${word} раза. Найдите объём детали. Ответ выразите в дм³.`
      : `В цилиндрический сосуд налили ${v} куб. см воды. В воду полностью погрузили деталь. При этом уровень жидкости в сосуде увеличился в ${word} раза. Найдите объём детали. Ответ выразите в куб. см.`,
    answer: ru(clean(v * (k - 1) / (unitDm ? 100 : 1))),
  }
}

// Цилиндрический сосуд с водой: поверхность жидкости и дно — задние дуги штрихом,
// вода залита светло-голубым.
function vesselWaterSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 390" width="280" height="390" font-family="Arial, sans-serif">` +
    `<rect width="280" height="390" fill="#fff"/>` +
    `<path d="M35,190 A105,25 0 0,1 245,190 L245,330 A105,25 0 0,1 35,330 Z" fill="#cfe8f7" stroke="none"/>` +
    `<path d="M35,330 A105,25 0 0,1 245,330" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="224"/>` +
    `<path d="M35,190 A105,25 0 0,1 245,190" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="224"/>` +
    `<ellipse cx="140" cy="60" rx="105" ry="25" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="35" y1="60" x2="35" y2="330" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="245" y1="60" x2="245" y2="330" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M35,330 A105,25 0 0,0 245,330" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M35,190 A105,25 0 0,0 245,190" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `</svg>`
}

// Уровень поднялся НА Δh: площадь основания S = V/h ⟹ V_детали = S·Δh.
function t03SubmergeAbs() {
  const S = pick([100, 125, 150, 175, 200]), h = randInt(6, 20), dh = randInt(2, 15)
  return {
    condition_text: `В цилиндрический сосуд налили ${S * h} см³ воды. Уровень жидкости оказался равным ${h} см. В воду полностью погрузили деталь. При этом уровень жидкости в сосуде поднялся на ${dh} см. Найдите объём детали. Ответ выразите в куб. см.`,
    image_url: svgUrl(vesselWaterSvg()),
    answer: ru(S * dh),
  }
}

// Конус (ФИПИ): образующие и передняя дуга основания сплошные; задняя дуга,
// высота и диаметр — штрихом.
function coneHLSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 350" width="280" height="350" font-family="Arial, sans-serif">` +
    `<rect width="280" height="350" fill="#fff"/>` +
    `<path d="M30,280 A110,26 0 0,1 250,280" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="228"/>` +
    `<line x1="30" y1="280" x2="250" y2="280" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="220"/>` +
    `<line x1="140" y1="55" x2="140" y2="280" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="225"/>` +
    `<line x1="140" y1="55" x2="30" y2="280" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="140" y1="55" x2="250" y2="280" stroke="#000" stroke-width="1.7"/>` +
    `<path d="M30,280 A110,26 0 0,0 250,280" fill="none" stroke="#000" stroke-width="1.7"/>` +
    `</svg>`
}

// Расширенный список пифагоровых троек для стереометрии: (12,35,37) встречается
// в банке и у конуса (диаметр 140, образующая 74 — это ×2), и у пирамиды (SO=35, SD=37).
const PYTH_WIDE = [...PYTH, [12, 35, 37]]
function coneTriple() {
  const [p, q, k] = pick(PYTH_WIDE), t = randInt(1, 3)
  const [R, h] = Math.random() < 0.5 ? [p * t, q * t] : [q * t, p * t]
  return { R, h, l: k * t }
}

// По диаметру основания и образующей — высота.
function t03ConeHeight() {
  const { R, h, l } = coneTriple()
  return {
    condition_text: `Диаметр основания конуса равен ${2 * R}, а длина образующей – ${l}. Найдите высоту конуса.`,
    image_url: svgUrl(coneHLSvg()),
    answer: ru(h),
  }
}

// Обратная: по высоте и образующей — диаметр основания.
function t03ConeDiameter() {
  const { R, h, l } = coneTriple()
  return {
    condition_text: `Высота конуса равна ${h}, а длина образующей – ${l}. Найдите диаметр основания конуса.`,
    image_url: svgUrl(coneHLSvg()),
    answer: ru(2 * R),
  }
}

// Конус с осевым сечением (ФИПИ): сечение — наклонный треугольник, одна
// образующая жирная сплошная, вторая образующая и диаметр — штрихом.
function coneAxialSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 350" width="280" height="350" font-family="Arial, sans-serif">` +
    `<rect width="280" height="350" fill="#fff"/>` +
    `<path d="M30,280 A110,26 0 0,1 250,280" fill="none" stroke="#000" stroke-width="1.3" stroke-dasharray="8 6" pathLength="228"/>` +
    `<line x1="140" y1="55" x2="140" y2="280" stroke="#000" stroke-width="1.3" stroke-dasharray="8 6" pathLength="225"/>` +
    `<line x1="140" y1="55" x2="100.6" y2="255.7" stroke="#000" stroke-width="1.3" stroke-dasharray="8 6" pathLength="205"/>` +
    `<line x1="100.6" y1="255.7" x2="179.4" y2="304.3" stroke="#000" stroke-width="1.3" stroke-dasharray="8 6" pathLength="93"/>` +
    `<line x1="140" y1="55" x2="30" y2="280" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="140" y1="55" x2="250" y2="280" stroke="#000" stroke-width="1.4"/>` +
    `<path d="M30,280 A110,26 0 0,0 250,280" fill="none" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="140" y1="55" x2="179.4" y2="304.3" stroke="#000" stroke-width="2.2"/>` +
    `</svg>`
}

// Осевое сечение — треугольник с основанием 2R и высотой h ⟹ S = R·h.
// Дана площадь основания πR² и высота.
function t03ConeAxialFromBase() {
  const R = randInt(2, 14), h = randInt(2, 20)
  return {
    condition_text: `Площадь основания конуса равна ${R * R}π, высота — ${h}. Найдите площадь осевого сечения этого конуса.`,
    image_url: svgUrl(coneAxialSvg()),
    answer: ru(R * h),
  }
}

// Даны высота и образующая (пифагорова тройка) ⟹ R = √(l²−h²), S = R·h.
function t03ConeAxialFromSlant() {
  const { R, h, l } = coneTriple()
  return {
    condition_text: Math.random() < 0.5
      ? `Высота конуса равна ${h}, а длина образующей — ${l}. Найдите площадь осевого сечения этого конуса.`
      : `Диаметр основания конуса равен ${2 * R}, а длина образующей — ${l}. Найдите площадь осевого сечения этого конуса.`,
    image_url: svgUrl(coneAxialSvg()),
    answer: ru(R * h),
  }
}

// S_бок = πRl: образующая ×k ⟹ S_бок ×k (радиус не меняется).
function t03ConeLatScale() {
  const k = randInt(2, 12)
  return {
    condition_text: `Во сколько раз увеличится площадь боковой поверхности конуса, если его образующая увеличится в ${k} ${razWord(k)}, а радиус основания останется прежним?`,
    image_url: svgUrl(coneSvg()),
    answer: ru(k),
  }
}

// Радиус ÷k ⟹ S_бок ÷k (образующая не меняется).
const CONE_DOWN_K = [[1.5, "1,5"], [2, "2"], [2.5, "2,5"], [3, "3"], [4, "4"], [5, "5"]]
function t03ConeLatScaleDown() {
  const [k, word] = pick(CONE_DOWN_K)
  // дробное — всегда «раза» (в 1,5 раза), целое — по общему правилу (в 5 раз)
  const raz = Number.isInteger(k) ? razWord(k) : "раза"
  return {
    condition_text: `Во сколько раз уменьшится площадь боковой поверхности конуса, если радиус его основания уменьшить в ${word} ${raz}, а образующую оставить прежней?`,
    image_url: svgUrl(coneSvg()),
    answer: ru(k),
  }
}

// Конус с сечением, параллельным основанию (сечение — небольшой эллипс ближе к
// вершине: передняя дуга сплошная, задняя штрихом).
function coneParSectSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 350" width="280" height="350" font-family="Arial, sans-serif">` +
    `<rect width="280" height="350" fill="#fff"/>` +
    `<path d="M30,280 A110,26 0 0,1 250,280" fill="none" stroke="#000" stroke-width="1.3" stroke-dasharray="8 6" pathLength="228"/>` +
    `<line x1="140" y1="55" x2="140" y2="280" stroke="#000" stroke-width="1.3" stroke-dasharray="8 6" pathLength="225"/>` +
    `<path d="M99,138 A41,10 0 0,1 181,138" fill="none" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="88"/>` +
    `<line x1="140" y1="55" x2="30" y2="280" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="140" y1="55" x2="250" y2="280" stroke="#000" stroke-width="1.5"/>` +
    `<path d="M30,280 A110,26 0 0,0 250,280" fill="none" stroke="#000" stroke-width="1.5"/>` +
    `<path d="M99,138 A41,10 0 0,0 181,138" fill="none" stroke="#000" stroke-width="1.5"/>` +
    `</svg>`
}

// Сечение ∥ основанию делит высоту на a (от вершины) и b ⟹ подобие k = a/(a+b),
// площадь сечения = S_осн·k². Числа подобраны так, чтобы k = 1/n.
function t03ConeParSect() {
  const n = randInt(2, 5), t = randInt(1, 5), S = n * n * randInt(1, 8)
  return {
    condition_text: `Площадь основания конуса равна ${S}. Плоскость, параллельная плоскости основания конуса, делит его высоту на отрезки длиной ${t} и ${t * (n - 1)}, считая от вершины. Найдите площадь сечения конуса этой плоскостью.`,
    image_url: svgUrl(coneParSectSvg()),
    answer: ru(S / (n * n)),
  }
}

// Конус с сечением ∥ основанию ближе к основанию; отсечённый конус выделен жирным
// (его образующие и передняя дуга сечения), нижняя часть — тонкими линиями.
function coneSectSurfSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 350" width="280" height="350" font-family="Arial, sans-serif">` +
    `<rect width="280" height="350" fill="#fff"/>` +
    `<path d="M30,280 A110,26 0 0,1 250,280" fill="none" stroke="#000" stroke-width="1.3" stroke-dasharray="8 6" pathLength="228"/>` +
    `<path d="M61,217 A79,19 0 0,1 219,217" fill="none" stroke="#000" stroke-width="1.3" stroke-dasharray="8 6" pathLength="169"/>` +
    `<line x1="140" y1="55" x2="140" y2="280" stroke="#000" stroke-width="1.3" stroke-dasharray="8 6" pathLength="225"/>` +
    `<line x1="61" y1="217" x2="30" y2="280" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="219" y1="217" x2="250" y2="280" stroke="#000" stroke-width="1.3"/>` +
    `<path d="M30,280 A110,26 0 0,0 250,280" fill="none" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="140" y1="55" x2="61" y2="217" stroke="#000" stroke-width="2.2"/>` +
    `<line x1="140" y1="55" x2="219" y2="217" stroke="#000" stroke-width="2.2"/>` +
    `<path d="M61,217 A79,19 0 0,0 219,217" fill="none" stroke="#000" stroke-width="2.2"/>` +
    `</svg>`
}

// Сечение делит высоту в отношении m : n от вершины ⟹ отсечённый конус подобен
// исходному с k = m/(m+n), полная поверхность ×k². S кратна 2,5 ⟹ ответ с одним знаком.
function t03ConeFullSurfSect() {
  const m = randInt(1, 4), n = 5 - m
  const S = clean(2.5 * randInt(2, 20))
  return {
    condition_text: `Площадь полной поверхности конуса равна ${ru(S)}. Параллельно основанию конуса проведено сечение, делящее высоту в отношении ${m} : ${n}, считая от вершины конуса. Найдите площадь полной поверхности отсечённого конуса.`,
    image_url: svgUrl(coneSectSurfSvg()),
    answer: ru(clean(S * m * m / 25)),
  }
}

// Сосуд в форме конуса вершиной вниз; жидкость залита светло-голубым, её
// поверхность — передняя дуга сплошная, задняя штрихом.
function coneVesselSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 340" width="280" height="340" font-family="Arial, sans-serif">` +
    `<rect width="280" height="340" fill="#fff"/>` +
    `<path d="M77,156 A63,15 0 0,1 203,156 L140,300 Z" fill="#cfe8f7" stroke="none"/>` +
    `<path d="M77,156 A63,15 0 0,1 203,156" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="7 5" pathLength="134"/>` +
    `<ellipse cx="140" cy="60" rx="105" ry="25" fill="none" stroke="#000" stroke-width="2.2"/>` +
    `<line x1="35" y1="60" x2="140" y2="300" stroke="#000" stroke-width="2.2"/>` +
    `<line x1="245" y1="60" x2="140" y2="300" stroke="#000" stroke-width="2.2"/>` +
    `<path d="M77,156 A63,15 0 0,0 203,156" fill="none" stroke="#000" stroke-width="1.8"/>` +
    `</svg>`
}

// Жидкость заполняет подобный конус с k = p/q ⟹ V_жидк = V·k³, долить = V_жидк·(q³−p³)/p³.
const VESSEL_FRACS = [[1, 2], [1, 3], [1, 4], [2, 3], [2, 5], [2, 7], [3, 4]]
function t03ConeVessel() {
  const [p, q] = pick(VESSEL_FRACS)
  const v = p * p * p * randInt(1, p === 1 ? 60 : 20)
  return {
    condition_text: `В сосуде, имеющем форму конуса, уровень жидкости достигает ${fT(p, q)} высоты. Объём жидкости равен ${v} мл. Сколько миллилитров жидкости нужно долить, чтобы полностью наполнить сосуд?`,
    image_url: svgUrl(coneVesselSvg()),
    answer: ru(v * (q * q * q - p * p * p) / (p * p * p)),
  }
}

// Шар, вписанный в цилиндр (R общий, высота цилиндра = 2R).
function sphereInCylSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" font-family="Arial, sans-serif">` +
    `<rect width="500" height="500" fill="#fff"/>` +
    `<ellipse cx="250" cy="110" rx="150" ry="24" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="100" y1="110" x2="100" y2="410" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="400" y1="110" x2="400" y2="410" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M100,410 A150,24 0 0,0 400,410" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M100,410 A150,24 0 0,1 400,410" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="316"/>` +
    `<circle cx="250" cy="260" r="150" fill="none" stroke="#000" stroke-width="2"/>` +
    `<path d="M100,260 A150,24 0 0,0 400,260" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M100,260 A150,24 0 0,1 400,260" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="316"/>` +
    `<circle cx="250" cy="260" r="2.6" fill="#000"/>` +
    `</svg>`
}

// S_цил.полн = 2πR²+2πR·2R = 6πR², S_шара = 4πR² = ⅔·S_цил.
function t03SphereInCyl() {
  const s = 3 * randInt(2, 30)
  return {
    condition_text: `Шар вписан в цилиндр. Площадь полной поверхности цилиндра равна ${s}. Найдите площадь поверхности шара.`,
    image_url: svgUrl(sphereInCylSvg()),
    answer: ru(2 * s / 3),
  }
}

// Ступенчатый многогранник (все двугранные углы прямые). Размеры наносятся на
// чертёж: ширина w, глубина d, полная высота H, уступ h2 (высота) × dd (глубина).
// V = w·(d·H − dd·h2).
function stepSolidSvg(w, d, H, h2, dd) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 440" width="450" height="440" font-family="Arial, sans-serif">` +
    `<rect width="450" height="440" fill="#fff"/>` +
    // скрытые рёбра
    `<line x1="123" y1="300" x2="10" y2="385" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="138"/>` +
    `<line x1="123" y1="300" x2="387" y2="300" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="267"/>` +
    `<line x1="123" y1="300" x2="123" y2="42" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="257"/>` +
    // нижний блок
    `<line x1="10" y1="385" x2="274" y2="385" stroke="#000" stroke-width="2"/>` +
    `<line x1="10" y1="385" x2="10" y2="213" stroke="#000" stroke-width="2"/>` +
    `<line x1="274" y1="385" x2="274" y2="213" stroke="#000" stroke-width="2"/>` +
    `<line x1="10" y1="213" x2="274" y2="213" stroke="#000" stroke-width="2"/>` +
    `<line x1="274" y1="385" x2="387" y2="300" stroke="#000" stroke-width="2"/>` +
    `<line x1="274" y1="213" x2="330.5" y2="170.5" stroke="#000" stroke-width="2"/>` +
    // уступ
    `<line x1="10" y1="213" x2="66.5" y2="170.5" stroke="#000" stroke-width="2"/>` +
    `<line x1="66.5" y1="170.5" x2="330.5" y2="170.5" stroke="#000" stroke-width="2"/>` +
    `<line x1="66.5" y1="170.5" x2="66.5" y2="84.5" stroke="#000" stroke-width="2"/>` +
    `<line x1="330.5" y1="170.5" x2="330.5" y2="84.5" stroke="#000" stroke-width="2"/>` +
    `<line x1="66.5" y1="84.5" x2="330.5" y2="84.5" stroke="#000" stroke-width="2"/>` +
    // верхняя задняя площадка
    `<line x1="66.5" y1="84.5" x2="123" y2="42" stroke="#000" stroke-width="2"/>` +
    `<line x1="123" y1="42" x2="387" y2="42" stroke="#000" stroke-width="2"/>` +
    `<line x1="330.5" y1="84.5" x2="387" y2="42" stroke="#000" stroke-width="2"/>` +
    `<line x1="387" y1="42" x2="387" y2="300" stroke="#000" stroke-width="2"/>` +
    // размеры
    `<g font-size="21" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="142" y="416">${w}</text><text x="352" y="362">${d}</text><text x="412" y="178">${H}</text>` +
    `<text x="44" y="132">${h2}</text><text x="18" y="188">${dd}</text>` +
    `</g></svg>`
}

function t03StepSolid() {
  const w = randInt(2, 6), d = randInt(2, 5), H = randInt(3, 6)
  const h2 = randInt(1, H - 1), dd = randInt(1, d - 1)
  return {
    condition_text: `Найдите объём многогранника, изображённого на рисунке (все двугранные углы — прямые).`,
    image_url: svgUrl(stepSolidSvg(w, d, H, h2, dd)),
    answer: ru(w * (d * H - dd * h2)),
  }
}

// Тот же ступенчатый брус, но спрашивается площадь поверхности:
// низ и верх дают 2wd, передняя + задняя + стенка уступа — 2wH, два бока — 2(dH − dd·h2).
function t03StepSolidSurface() {
  const w = randInt(2, 6), d = randInt(2, 5), H = randInt(3, 6)
  const h2 = randInt(1, H - 1), dd = randInt(1, d - 1)
  return {
    condition_text: `Найдите площадь поверхности многогранника, изображённого на рисунке (все двугранные углы — прямые).`,
    image_url: svgUrl(stepSolidSvg(w, d, H, h2, dd)),
    answer: ru(2 * w * d + 2 * w * H + 2 * (d * H - dd * h2)),
  }
}

// Прямоугольный параллелепипед с диагональю AC₁ (ребро AD и диагональ разведены
// по направлению, чтобы не сливались).
function boxDiagonalSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 10 450 350" width="450" height="350" font-family="Arial, sans-serif">` +
    `<rect x="-10" y="10" width="450" height="350" fill="#fff"/>` +
    // скрытые рёбра
    `<line x1="30" y1="300" x2="90" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="104"/>` +
    `<line x1="370" y1="215" x2="90" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="280"/>` +
    `<line x1="90" y1="215" x2="90" y2="45" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="172"/>` +
    // видимые рёбра
    `<line x1="30" y1="300" x2="310" y2="300" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="310" y1="300" x2="370" y2="215" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="30" y1="300" x2="30" y2="130" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="310" y1="300" x2="310" y2="130" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="370" y1="215" x2="370" y2="45" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="30" y1="130" x2="310" y2="130" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="310" y1="130" x2="370" y2="45" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="30" y1="130" x2="90" y2="45" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="90" y1="45" x2="370" y2="45" stroke="#000" stroke-width="1.7"/>` +
    // диагональ
    `<line x1="30" y1="300" x2="370" y2="45" stroke="#000" stroke-width="1.9" stroke-dasharray="8 6" pathLength="421"/>` +
    // подписи
    `<g font-size="17" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="22" y="326">A</text><text x="312" y="326">B</text><text x="392" y="235">C</text><text x="70" y="205">D</text>` +
    `<text x="12" y="120">A₁</text><text x="332" y="152">B₁</text><text x="68" y="35">D₁</text><text x="392" y="37">C₁</text>` +
    `</g></svg>`
}

// Тот же параллелепипед без диагонали (прямые ученик достраивает сам).
function boxPlainLabeledSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 10 450 350" width="450" height="350" font-family="Arial, sans-serif">` +
    `<rect x="-10" y="10" width="450" height="350" fill="#fff"/>` +
    `<line x1="30" y1="300" x2="90" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="104"/>` +
    `<line x1="370" y1="215" x2="90" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="280"/>` +
    `<line x1="90" y1="215" x2="90" y2="45" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="172"/>` +
    `<line x1="30" y1="300" x2="310" y2="300" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="310" y1="300" x2="370" y2="215" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="30" y1="300" x2="30" y2="130" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="310" y1="300" x2="310" y2="130" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="370" y1="215" x2="370" y2="45" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="30" y1="130" x2="310" y2="130" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="310" y1="130" x2="370" y2="45" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="30" y1="130" x2="90" y2="45" stroke="#000" stroke-width="1.7"/>` +
    `<line x1="90" y1="45" x2="370" y2="45" stroke="#000" stroke-width="1.7"/>` +
    `<g font-size="17" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="22" y="326">A</text><text x="312" y="326">B</text><text x="392" y="235">C</text><text x="70" y="205">D</text>` +
    `<text x="12" y="120">A₁</text><text x="332" y="152">B₁</text><text x="68" y="35">D₁</text><text x="392" y="37">C₁</text>` +
    `</g></svg>`
}

// Тот же параллелепипед с сечением ABC₁D₁ (плоскость через A, B, C₁).
function boxSectionSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 10 450 350" width="450" height="350" font-family="Arial, sans-serif">` +
    `<rect x="-10" y="10" width="450" height="350" fill="#fff"/>` +
    // скрытые рёбра
    `<line x1="30" y1="300" x2="90" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="104"/>` +
    `<line x1="370" y1="215" x2="90" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="280"/>` +
    `<line x1="90" y1="215" x2="90" y2="45" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="172"/>` +
    // рёбра параллелепипеда
    `<line x1="310" y1="300" x2="370" y2="215" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="30" y1="300" x2="30" y2="130" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="310" y1="300" x2="310" y2="130" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="370" y1="215" x2="370" y2="45" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="30" y1="130" x2="310" y2="130" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="310" y1="130" x2="370" y2="45" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="30" y1="130" x2="90" y2="45" stroke="#000" stroke-width="1.5"/>` +
    // сечение ABC₁D₁
    `<line x1="30" y1="300" x2="310" y2="300" stroke="#000" stroke-width="2.6"/>` +
    `<line x1="310" y1="300" x2="370" y2="45" stroke="#000" stroke-width="2.6"/>` +
    `<line x1="90" y1="45" x2="370" y2="45" stroke="#000" stroke-width="2.6"/>` +
    `<line x1="30" y1="300" x2="90" y2="45" stroke="#000" stroke-width="2.6" stroke-dasharray="9 6" pathLength="264"/>` +
    // подписи
    `<g font-size="17" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="22" y="326">A</text><text x="312" y="326">B</text><text x="392" y="235">C</text><text x="70" y="205">D</text>` +
    `<text x="12" y="120">A₁</text><text x="332" y="152">B₁</text><text x="68" y="35">D₁</text><text x="392" y="37">C₁</text>` +
    `</g></svg>`
}

// Сечение через A, B, C₁ — прямоугольник ABC₁D₁: S = AB·√(AD²+AA₁²).
function t03BoxSection() {
  const [b, c, h] = pick(SIN_TRIPLES)
  const a = randInt(2, 30)
  return {
    condition_text: `В прямоугольном параллелепипеде ABCDA₁B₁C₁D₁ известны длины рёбер: AB = ${a}, AD = ${b}, AA₁ = ${c}. Найдите площадь сечения параллелепипеда плоскостью, проходящей через точки A, B и C₁.`,
    image_url: svgUrl(boxSectionSvg()),
    answer: ru(a * h),
  }
}

// Сечение через B, B₁, D — прямоугольник BDD₁B₁: S = AA₁·√(AB²+AD²).
function t03BoxDiagSection() {
  const [a, b, h] = pick(SIN_TRIPLES)
  const c = randInt(2, 30)
  return {
    condition_text: `В прямоугольном параллелепипеде ABCDA₁B₁C₁D₁ известны длины рёбер: AB = ${a}, AD = ${b}, AA₁ = ${c}. Найдите площадь сечения, проходящего через вершины B, B₁ и D.`,
    image_url: svgUrl(boxPlainLabeledSvg()),
    answer: ru(c * h),
  }
}

// DD₁=(0,0,c), B₁C=(0,b,−c) ⟹ cos = c/√(b²+c²), sin = b/√(b²+c²).
// (b,c,h) — пифагоровы тройки, чтобы синус был коротким числом.
const SIN_TRIPLES = [
  [3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [9, 12, 15], [12, 9, 15],
  [16, 12, 20], [12, 16, 20], [15, 20, 25], [20, 15, 25], [7, 24, 25], [24, 7, 25],
]

function t03BoxLineSin() {
  const [b, c, h] = pick(SIN_TRIPLES)
  const a = randInt(2, 30)
  return {
    condition_text: `В прямоугольном параллелепипеде ABCDA₁B₁C₁D₁ известны длины рёбер: AB = ${a}, AD = ${b}, AA₁ = ${c}. Найдите синус угла между прямыми DD₁ и B₁C.`,
    image_url: svgUrl(boxPlainLabeledSvg()),
    answer: ru(clean(b / h)),
  }
}

// Тройки (a,b,c), у которых a²+b²+c² — полный квадрат (целая диагональ).
const BOX_DIAG_TRIPLES = [
  [1, 2, 2], [1, 4, 8], [1, 12, 12], [2, 3, 6], [2, 4, 4], [2, 5, 14], [2, 6, 9],
  [2, 8, 16], [2, 10, 11], [3, 4, 12], [3, 6, 6], [4, 4, 7], [4, 8, 19], [4, 13, 16],
  [5, 6, 30], [6, 6, 7], [6, 10, 15], [8, 9, 12], [9, 12, 20], [12, 15, 16],
]

function t03BoxDiagonal() {
  const [x, y, z] = pick(BOX_DIAG_TRIPLES)
  const [a, b] = Math.random() < 0.5 ? [x, y] : [y, x]
  return {
    condition_text: `В прямоугольном параллелепипеде ABCDA₁B₁C₁D₁ известно, что BB₁ = ${z}, A₁B₁ = ${a}, A₁D₁ = ${b}. Найдите длину диагонали AC₁.`,
    image_url: svgUrl(boxDiagonalSvg()),
    answer: ru(Math.sqrt(a * a + b * b + z * z)),
  }
}

// Куб ABCDA₁B₁C₁D₁ для задач на угол между прямыми (D — скрытая вершина).
function cubeAngleSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 380" width="390" height="380" font-family="Arial, sans-serif">` +
    `<rect width="390" height="380" fill="#fff"/>` +
    // скрытые рёбра
    `<line x1="50" y1="275" x2="173" y2="196" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="146"/>` +
    `<line x1="331" y1="258" x2="173" y2="196" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="170"/>` +
    `<line x1="173" y1="196" x2="173" y2="23" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="173"/>` +
    // видимые рёбра
    `<line x1="50" y1="275" x2="208" y2="337" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="208" y1="337" x2="331" y2="258" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="50" y1="275" x2="50" y2="102" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="208" y1="337" x2="208" y2="163" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="331" y1="258" x2="331" y2="85" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="50" y1="102" x2="208" y2="163" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="208" y1="163" x2="331" y2="85" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="50" y1="102" x2="173" y2="23" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="173" y1="23" x2="331" y2="85" stroke="#000" stroke-width="1.6"/>` +
    // подписи
    `<g font-size="17" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="36" y="296">A</text><text x="208" y="360">B</text><text x="349" y="276">C</text><text x="156" y="190">D</text>` +
    `<text x="32" y="98">A₁</text><text x="228" y="183">B₁</text><text x="157" y="14">D₁</text><text x="349" y="80">C₁</text>` +
    `</g></svg>`
}

// Координаты вершин единичного куба — угол считается кодом, не таблицей.
const CUBE_V = {
  A: [0, 0, 0], B: [1, 0, 0], C: [1, 1, 0], D: [0, 1, 0],
  A1: [0, 0, 1], B1: [1, 0, 1], C1: [1, 1, 1], D1: [0, 1, 1],
}
// Имя вершины в тексте: A1 → A₁.
const vertName = (v) => v.replace("1", "₁")

// Пары прямых из открытого банка ФИПИ.
const CUBE_ANGLE_PAIRS = [
  ["A", "C", "B", "B1"], ["B", "A1", "D1", "C1"], ["A1", "D", "B1", "D1"], ["C", "D1", "A", "D"],
  ["A", "B1", "B", "C1"], ["A", "C", "B1", "D1"], ["A", "D1", "B1", "C"], ["A1", "B", "C1", "D"],
]

function t03CubeAngle() {
  const [p, q, r, s] = pick(CUBE_ANGLE_PAIRS)
  return {
    condition_text: `В кубе ABCDA₁B₁C₁D₁ найдите угол между прямыми ${vertName(p)}${vertName(q)} и ${vertName(r)}${vertName(s)}. Ответ дайте в градусах.`,
    image_url: svgUrl(cubeAngleSvg()),
    answer: ru(linesAngleDeg(CUBE_V, p, q, r, s)),
  }
}

// Куб с пространственной диагональю (d = a√3).
function cubeDiagSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 330" width="340" height="330" font-family="Arial, sans-serif">` +
    `<rect width="340" height="330" fill="#fff"/>` +
    // скрытые рёбра
    `<line x1="120" y1="248" x2="40" y2="290" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="89"/>` +
    `<line x1="120" y1="248" x2="300" y2="248" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="181"/>` +
    `<line x1="120" y1="248" x2="120" y2="68" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="180"/>` +
    // передняя грань
    `<line x1="40" y1="290" x2="220" y2="290" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="220" y1="290" x2="220" y2="110" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="220" y1="110" x2="40" y2="110" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="40" y1="110" x2="40" y2="290" stroke="#000" stroke-width="1.5"/>` +
    // глубина и задняя грань
    `<line x1="220" y1="290" x2="300" y2="248" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="220" y1="110" x2="300" y2="68" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="40" y1="110" x2="120" y2="68" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="300" y1="248" x2="300" y2="68" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="120" y1="68" x2="300" y2="68" stroke="#000" stroke-width="1.5"/>` +
    // диагональ
    `<line x1="40" y1="290" x2="300" y2="68" stroke="#000" stroke-width="2.2" stroke-dasharray="9 6" pathLength="345"/>` +
    `</svg>`
}

// Диагональ куба d = a√3 ⟹ дано d = √(3a²), объём a³.
function t03CubeDiagonal() {
  const a = randInt(2, 9)
  return {
    condition_text: `Диагональ куба равна ${rT(3 * a * a)}. Найдите его объём.`,
    image_url: svgUrl(cubeDiagSvg()),
    answer: ru(a * a * a),
  }
}

// Т-образный многогранник: нижний блок W×D×H1 + верхний блок a×a×H2 по центру.
// S = 2WD + 2H1(W+D) + 4aH2 (площадки склейки взаимно сокращаются).
function tSolidSvg(W, D, H1, a, H2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 580 430" width="580" height="430" font-family="Arial, sans-serif">` +
    `<rect x="0" y="40" width="580" height="430" fill="#fff"/>` +
    // скрытые рёбра плиты
    `<line x1="115" y1="330" x2="10" y2="415" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="134"/>` +
    `<line x1="115" y1="330" x2="520" y2="330" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="404"/>` +
    `<line x1="115" y1="330" x2="115" y2="210" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="120"/>` +
    // задняя левая вертикаль блока, ребро KN, скрытая часть HN
    `<line x1="250" y1="210" x2="250" y2="90" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="120"/>` +
    `<line x1="145" y1="295" x2="250" y2="210" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="134"/>` +
    `<line x1="145" y1="210" x2="250" y2="210" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="106"/>` +
    // плита
    `<line x1="10" y1="415" x2="415" y2="415" stroke="#000" stroke-width="2"/>` +
    `<line x1="415" y1="415" x2="520" y2="330" stroke="#000" stroke-width="2"/>` +
    `<line x1="10" y1="415" x2="10" y2="295" stroke="#000" stroke-width="2"/>` +
    `<line x1="415" y1="415" x2="415" y2="295" stroke="#000" stroke-width="2"/>` +
    `<line x1="520" y1="330" x2="520" y2="210" stroke="#000" stroke-width="2"/>` +
    `<line x1="415" y1="295" x2="520" y2="210" stroke="#000" stroke-width="2"/>` +
    `<line x1="10" y1="295" x2="115" y2="210" stroke="#000" stroke-width="2"/>` +
    `<line x1="10" y1="295" x2="145" y2="295" stroke="#000" stroke-width="2"/>` +
    `<line x1="280" y1="295" x2="415" y2="295" stroke="#000" stroke-width="2"/>` +
    `<line x1="115" y1="210" x2="145" y2="210" stroke="#000" stroke-width="2"/>` +
    `<line x1="385" y1="210" x2="520" y2="210" stroke="#000" stroke-width="2"/>` +
    // блок (сросся с плитой спереди и сзади)
    `<line x1="145" y1="295" x2="145" y2="175" stroke="#000" stroke-width="2"/>` +
    `<line x1="280" y1="295" x2="280" y2="175" stroke="#000" stroke-width="2"/>` +
    `<line x1="385" y1="210" x2="385" y2="90" stroke="#000" stroke-width="2"/>` +
    `<line x1="280" y1="295" x2="385" y2="210" stroke="#000" stroke-width="2"/>` +
    `<line x1="145" y1="175" x2="280" y2="175" stroke="#000" stroke-width="2"/>` +
    `<line x1="280" y1="175" x2="385" y2="90" stroke="#000" stroke-width="2"/>` +
    `<line x1="385" y1="90" x2="250" y2="90" stroke="#000" stroke-width="2"/>` +
    `<line x1="250" y1="90" x2="145" y2="175" stroke="#000" stroke-width="2"/>` +
    // размеры
    `<g font-size="22" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="212" y="445">${W}</text><text x="492" y="398">${D}</text><text x="548" y="278">${H1}</text>` +
    `<text x="317" y="72">${a}</text><text x="410" y="158">${H2}</text>` +
    `</g></svg>`
}

// Блок a×D×H2 стоит на плите W×D×H1 и сросся с ней спереди и сзади.
// S = 2WD + 2H1(W+D) + 2H2(a+D).
function t03TSolidSurface() {
  const W = randInt(4, 8), D = randInt(2, 6), H1 = randInt(1, 4)
  const a = randInt(1, W - 2), H2 = randInt(1, 4)
  return {
    condition_text: `Найдите площадь поверхности многогранника, изображённого на рисунке (все двугранные углы — прямые).`,
    image_url: svgUrl(tSolidSvg(W, D, H1, a, H2)),
    answer: ru(2 * W * D + 2 * H1 * (W + D) + 2 * H2 * (a + D)),
  }
}

// Обратная к t03CubeCut: V_куба = 8·V_призмы.
function t03CubeCutInverse() {
  const vc = 4 * randInt(1, 25)
  return {
    condition_text: `Объём треугольной призмы, отсекаемой от куба плоскостью, проходящей через середины двух рёбер, выходящих из одной вершины, и параллельной третьему ребру, выходящему из этой же вершины, равен ${ru(vc / 8)}. Найдите объём куба.`,
    image_url: svgUrl(cubeCutSvg()),
    answer: ru(vc),
  }
}

// Г-образный многогранник: передняя грань — прямоугольник w×H с вырезом
// (ширина wc, высота H−h2) в правом верхнем углу; глубина d. V = (w·H − wc·(H−h2))·d.
function lSolidSvg(w, H, d, wc, h2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 440" width="420" height="440" font-family="Arial, sans-serif">` +
    `<rect width="420" height="440" fill="#fff"/>` +
    // скрытые рёбра
    `<line x1="130" y1="340" x2="85" y2="375" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="57"/>` +
    `<line x1="130" y1="340" x2="335" y2="340" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="204"/>` +
    `<line x1="130" y1="340" x2="130" y2="25" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="315"/>` +
    // передняя Г-образная грань
    `<line x1="85" y1="375" x2="290" y2="375" stroke="#000" stroke-width="2"/>` +
    `<line x1="290" y1="375" x2="290" y2="249" stroke="#000" stroke-width="2"/>` +
    `<line x1="290" y1="249" x2="222" y2="249" stroke="#000" stroke-width="2"/>` +
    `<line x1="222" y1="249" x2="222" y2="60" stroke="#000" stroke-width="2"/>` +
    `<line x1="222" y1="60" x2="85" y2="60" stroke="#000" stroke-width="2"/>` +
    `<line x1="85" y1="60" x2="85" y2="375" stroke="#000" stroke-width="2"/>` +
    // рёбра глубины
    `<line x1="290" y1="375" x2="335" y2="340" stroke="#000" stroke-width="2"/>` +
    `<line x1="290" y1="249" x2="335" y2="214" stroke="#000" stroke-width="2"/>` +
    `<line x1="222" y1="249" x2="267" y2="214" stroke="#000" stroke-width="2"/>` +
    `<line x1="222" y1="60" x2="267" y2="25" stroke="#000" stroke-width="2"/>` +
    `<line x1="85" y1="60" x2="130" y2="25" stroke="#000" stroke-width="2"/>` +
    // задний контур
    `<line x1="335" y1="340" x2="335" y2="214" stroke="#000" stroke-width="2"/>` +
    `<line x1="335" y1="214" x2="267" y2="214" stroke="#000" stroke-width="2"/>` +
    `<line x1="267" y1="214" x2="267" y2="25" stroke="#000" stroke-width="2"/>` +
    `<line x1="267" y1="25" x2="130" y2="25" stroke="#000" stroke-width="2"/>` +
    // размеры
    `<g font-size="21" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="58" y="225">${H}</text><text x="187" y="406">${w}</text><text x="327" y="384">${d}</text>` +
    `<text x="360" y="287">${h2}</text><text x="301" y="196">${wc}</text>` +
    `</g></svg>`
}

function t03LSolid() {
  const w = randInt(3, 7), H = randInt(3, 7), d = randInt(1, 4)
  const wc = randInt(1, w - 1), h2 = randInt(1, H - 1)
  return {
    condition_text: `Найдите объём многогранника, изображённого на рисунке (все двугранные углы многогранника — прямые).`,
    image_url: svgUrl(lSolidSvg(w, H, d, wc, h2)),
    answer: ru((w * H - wc * (H - h2)) * d),
  }
}

// Куб с отсекаемой треугольной призмой: сечение через середины двух рёбер,
// выходящих из вершины, параллельно третьему ребру ⟹ V = a³/8 = V_куба/8.
function cubeCutSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 360" width="380" height="360" font-family="Arial, sans-serif">` +
    `<rect width="380" height="360" fill="#fff"/>` +
    // скрытые рёбра куба
    `<line x1="50" y1="300" x2="120" y2="240" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="89"/>` +
    `<line x1="120" y1="240" x2="320" y2="240" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="203"/>` +
    `<line x1="120" y1="240" x2="120" y2="80" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="160"/>` +
    // видимые рёбра куба
    `<line x1="50" y1="300" x2="250" y2="300" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="50" y1="300" x2="50" y2="140" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="250" y1="300" x2="250" y2="140" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="50" y1="140" x2="250" y2="140" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="50" y1="140" x2="120" y2="80" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="120" y1="80" x2="320" y2="80" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="250" y1="140" x2="320" y2="80" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="320" y1="80" x2="320" y2="240" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="250" y1="300" x2="320" y2="240" stroke="#000" stroke-width="1.4"/>` +
    // отсекаемая призма
    `<line x1="320" y1="80" x2="285" y2="110" stroke="#000" stroke-width="2.4"/>` +
    `<line x1="320" y1="80" x2="220" y2="80" stroke="#000" stroke-width="2.4"/>` +
    `<line x1="285" y1="110" x2="220" y2="80" stroke="#000" stroke-width="2.4"/>` +
    `<line x1="320" y1="80" x2="320" y2="240" stroke="#000" stroke-width="2.4"/>` +
    `<line x1="285" y1="110" x2="285" y2="270" stroke="#000" stroke-width="2.4"/>` +
    `<line x1="220" y1="80" x2="220" y2="240" stroke="#000" stroke-width="2.4" stroke-dasharray="8 6" pathLength="162"/>` +
    `<line x1="320" y1="240" x2="285" y2="270" stroke="#000" stroke-width="2.4"/>` +
    `<line x1="320" y1="240" x2="220" y2="240" stroke="#000" stroke-width="2.4" stroke-dasharray="8 6" pathLength="106"/>` +
    `<line x1="285" y1="270" x2="220" y2="240" stroke="#000" stroke-width="2.4" stroke-dasharray="8 6" pathLength="76"/>` +
    `</svg>`
}

function t03CubeCut() {
  const v = 8 * randInt(2, 25)
  return {
    condition_text: `Объём куба равен ${v}. Найдите объём треугольной призмы, отсекаемой от куба плоскостью, проходящей через середины двух рёбер, выходящих из одной вершины, и параллельной третьему ребру, выходящему из этой же вершины.`,
    image_url: svgUrl(cubeCutSvg()),
    answer: ru(v / 8),
  }
}

// Одиночный конус (высота, радиус, прямой угол — пунктиром).
function coneSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 340" width="300" height="340" font-family="Arial, sans-serif">` +
    `<rect width="300" height="340" fill="#fff"/>` +
    `<line x1="150" y1="40" x2="40" y2="270" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="150" y1="40" x2="260" y2="270" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M40,270 A110,30 0 0,0 260,270" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M40,270 A110,30 0 0,1 260,270" fill="none" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="232"/>` +
    `<line x1="150" y1="40" x2="150" y2="270" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="235"/>` +
    `<line x1="150" y1="270" x2="260" y2="270" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="115"/>` +
    `<polyline points="150,256 164,256 164,270" fill="none" stroke="#000" stroke-width="1.3"/>` +
    `</svg>`
}

// V = ⅓πR²h линейно по h: высота ÷k ⟹ объём ÷k.
function t03ConeHeightScale() {
  const k = randInt(2, 15)
  return {
    condition_text: `Во сколько раз уменьшится объём конуса, если его высота уменьшится в ${k} ${razWord(k)}, а радиус основания останется прежним?`,
    image_url: svgUrl(coneSvg()),
    answer: ru(k),
  }
}

// Шар с сечением через центр (большой круг).
function sphereSectionSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320" font-family="Arial, sans-serif">` +
    `<rect width="320" height="320" fill="#fff"/>` +
    `<circle cx="160" cy="160" r="130" fill="none" stroke="#000" stroke-width="2"/>` +
    `<path d="M30,160 A130,32 0 0,0 290,160" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M30,160 A130,32 0 0,1 290,160" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="283"/>` +
    `<circle cx="160" cy="160" r="2.6" fill="#000"/>` +
    `</svg>`
}

// Сечение через центр — большой круг πR² = S; поверхность шара 4πR² = 4S.
function t03SphereSection() {
  const s = randInt(2, 40)
  return {
    condition_text: `Площадь сечения шара плоскостью, проходящей через центр шара, равна ${s}. Найдите площадь поверхности шара.`,
    image_url: svgUrl(sphereSectionSvg()),
    answer: ru(4 * s),
  }
}

// Сфера описана около конуса, центр — в центре основания ⟹ R_осн = h = R_сф,
// образующая l = R√2. Чертёж — та же конфигурация, что «конус в шаре».
function t03ConeSphereRadius() {
  const k = randInt(2, 30)
  return {
    condition_text: `Около конуса описана сфера (сфера содержит окружность основания конуса и его вершину). Центр сферы ${pick(["находится в центре", "совпадает с центром"])} основания конуса. Образующая конуса равна ${k}${rT(2)}. Найдите радиус сферы.`,
    image_url: svgUrl(coneCircumSphereSvg()),
    answer: ru(k),
  }
}

// Обратная: R_сф = k√2 ⟹ l = R√2 = 2k.
function t03ConeSphereSlant() {
  const k = randInt(2, 90)
  return {
    condition_text: `Около конуса описана сфера (сфера содержит окружность основания конуса и его вершину). Центр сферы ${pick(["находится в центре", "совпадает с центром"])} основания конуса. Радиус сферы равен ${k}${rT(2)}. Найдите длину образующей конуса.`,
    image_url: svgUrl(coneCircumSphereSvg()),
    answer: ru(2 * k),
  }
}

// Правильная треугольная призма (наклонённая, как в ФИПИ); тетраэдр A, B, C, B₁.
function prismTetraB1Svg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="95 30 240 300" width="288" height="360" font-family="Arial, sans-serif">` +
    `<rect x="95" y="30" width="240" height="300" fill="#fff"/>` +
    // рёбра призмы
    `<line x1="150" y1="60" x2="130" y2="135" stroke="#000" stroke-width="1.2"/>` +
    `<line x1="150" y1="60" x2="290" y2="105" stroke="#000" stroke-width="1.2"/>` +
    `<line x1="130" y1="135" x2="290" y2="105" stroke="#000" stroke-width="1.2"/>` +
    `<line x1="290" y1="105" x2="290" y2="255" stroke="#000" stroke-width="1.2"/>` +
    `<line x1="150" y1="60" x2="150" y2="210" stroke="#000" stroke-width="1.2"/>` +
    // тетраэдр: видимые рёбра
    `<line x1="130" y1="135" x2="130" y2="285" stroke="#000" stroke-width="2.6"/>` +
    `<line x1="130" y1="285" x2="290" y2="255" stroke="#000" stroke-width="2.6"/>` +
    `<line x1="130" y1="135" x2="290" y2="255" stroke="#000" stroke-width="2.6"/>` +
    // тетраэдр: скрытые рёбра к A — жирный пунктир
    `<line x1="130" y1="285" x2="150" y2="210" stroke="#000" stroke-width="2.6" stroke-dasharray="7 5" pathLength="79"/>` +
    `<line x1="290" y1="255" x2="150" y2="210" stroke="#000" stroke-width="2.6" stroke-dasharray="7 5" pathLength="151"/>` +
    `<line x1="130" y1="135" x2="150" y2="210" stroke="#000" stroke-width="2.6" stroke-dasharray="7 5" pathLength="79"/>` +
    // подписи
    `<g font-size="16" font-style="italic" fill="#000" text-anchor="middle">` +
    `<text x="150" y="48">A₁</text><text x="309" y="100">C₁</text><text x="112" y="133">B₁</text>` +
    `<text x="165" y="205">A</text><text x="307" y="262">C</text><text x="120" y="303">B</text>` +
    `</g></svg>`
}

function t03PrismTetraB1() {
  let s, l
  do { s = randInt(3, 12); l = randInt(3, 12) } while ((s * l) % 3 !== 0)
  return {
    condition_text: `Найдите объём многогранника, вершинами которого являются вершины A, B, C, B₁ правильной треугольной призмы ABCA₁B₁C₁, площадь основания которой равна ${s}, а боковое ребро равно ${l}.`,
    image_url: svgUrl(prismTetraB1Svg()),
    answer: ru(s * l / 3),
  }
}

function cylInBoxSvg() {
  // Эллипс вписан в верхнюю грань строго: rx = √(w² − dx²)/2 — из условия касания
  // наклонных рёбер (w = 200 — ширина грани, dx = 60 — сдвиг по глубине).
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 300" width="340" height="300" font-family="Arial, sans-serif">` +
    `<rect width="340" height="300" fill="#fff"/>` +
    `<line x1="115" y1="204" x2="55" y2="250" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="76"/>` +
    `<line x1="115" y1="204" x2="315" y2="204" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="200"/>` +
    `<line x1="115" y1="204" x2="115" y2="84" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="120"/>` +
    `<ellipse cx="185" cy="227" rx="95.4" ry="23" fill="none" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="380"/>` +
    `<line x1="55" y1="250" x2="255" y2="250" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="255" y1="250" x2="315" y2="204" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="55" y1="250" x2="55" y2="130" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="255" y1="250" x2="255" y2="130" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="315" y1="204" x2="315" y2="84" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="55" y1="130" x2="255" y2="130" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="255" y1="130" x2="315" y2="84" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="55" y1="130" x2="115" y2="84" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="115" y1="84" x2="315" y2="84" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="89.6" y1="107" x2="89.6" y2="227" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="280.4" y1="107" x2="280.4" y2="227" stroke="#000" stroke-width="1.5"/>` +
    `<ellipse cx="185" cy="107" rx="95.4" ry="23" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `</svg>`
}

// Основание параллелепипеда — квадрат со стороной 2R, высота = h ⟹ V = 4R²h.
function t03CylInBox() {
  const r = randInt(1, 9), h = randInt(1, 9)
  return {
    condition_text: Math.random() < 0.5
      ? `Цилиндр вписан в прямоугольный параллелепипед. Радиус основания и высота цилиндра равны ${r === h ? r : `${r} и ${h}`}. Найдите объём параллелепипеда.`
      : `Прямоугольный параллелепипед описан около цилиндра, радиус основания и высота которого равны ${r === h ? r : `${r} и ${h}`}. Найдите объём параллелепипеда.`,
    image_url: svgUrl(cylInBoxSvg()),
    answer: ru(4 * r * r * h),
  }
}

// Цилиндр и конус: конус выделен жирным пунктиром (обратная постановка).
function cylConeDashSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 540" width="500" height="540" font-family="Arial, sans-serif">` +
    `<rect width="500" height="540" fill="#fff"/>` +
    `<ellipse cx="250" cy="110" rx="150" ry="28" fill="none" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="100" y1="110" x2="100" y2="430" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="400" y1="110" x2="400" y2="430" stroke="#000" stroke-width="1.4"/>` +
    `<path d="M100,430 A150,28 0 0,0 400,430" fill="none" stroke="#000" stroke-width="2.6"/>` +
    `<path d="M100,430 A150,28 0 0,1 400,430" fill="none" stroke="#000" stroke-width="2.6" stroke-dasharray="10 7" pathLength="316"/>` +
    `<line x1="250" y1="110" x2="100" y2="430" stroke="#000" stroke-width="2.6" stroke-dasharray="10 7" pathLength="316"/>` +
    `<line x1="250" y1="110" x2="400" y2="430" stroke="#000" stroke-width="2.6" stroke-dasharray="10 7" pathLength="316"/>` +
    `<line x1="250" y1="110" x2="250" y2="430" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="319"/>` +
    `<line x1="250" y1="430" x2="400" y2="430" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="151"/>` +
    `<polyline points="250,414 266,414 266,430" fill="none" stroke="#000" stroke-width="1.3"/>` +
    `</svg>`
}

// Обратная к t03CylConeVolume: V_цил = 3·V_кон.
function t03CylConeVolInverse() {
  const v = randInt(2, 40)
  return {
    condition_text: Math.random() < 0.5
      ? `Цилиндр и конус имеют общие основание и высоту. Объём конуса равен ${v}. Найдите объём цилиндра.`
      : `Конус и цилиндр имеют общее основание и общую высоту (конус вписан в цилиндр). Вычислите объём цилиндра, если объём конуса равен ${v}.`,
    image_url: svgUrl(cylConeDashSvg()),
    answer: ru(3 * v),
  }
}

// Пирамида A,B,C,D,A₁: апекс над «дальней» (скрытой) вершиной A.
function boxPyramidA1Svg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 470 420" width="470" height="420" font-family="Arial, sans-serif">` +
    `<rect width="470" height="420" fill="#fff"/>` +
    // верхняя грань
    `<line x1="295" y1="90" x2="95" y2="130" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="95" y1="130" x2="200" y2="185" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="200" y1="185" x2="400" y2="145" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="400" y1="145" x2="295" y2="90" stroke="#000" stroke-width="1.3"/>` +
    // вертикальные рёбра
    `<line x1="95" y1="320" x2="95" y2="130" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="200" y1="375" x2="200" y2="185" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="400" y1="335" x2="400" y2="145" stroke="#000" stroke-width="1.3"/>` +
    // скрытое ребро A–A₁
    `<line x1="295" y1="280" x2="295" y2="90" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="189"/>` +
    // нижняя грань
    `<line x1="95" y1="320" x2="200" y2="375" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="200" y1="375" x2="400" y2="335" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="295" y1="280" x2="95" y2="320" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="200"/>` +
    `<line x1="295" y1="280" x2="400" y2="335" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="112"/>` +
    // рёбра пирамиды к A₁
    `<line x1="295" y1="90" x2="95" y2="320" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="299"/>` +
    `<line x1="295" y1="90" x2="200" y2="375" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="299"/>` +
    `<line x1="295" y1="90" x2="400" y2="335" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="266"/>` +
    // подписи
    `<g font-size="17" font-style="italic" fill="#000" text-anchor="middle">` +
    `<text x="313" y="278">A</text><text x="79" y="336">B</text><text x="200" y="396">C</text><text x="416" y="338">D</text>` +
    `<text x="295" y="78">A₁</text><text x="79" y="128">B₁</text><text x="216" y="192">C₁</text><text x="416" y="142">D₁</text>` +
    `</g></svg>`
}

function t03BoxPyramidA1() {
  let a, b, c
  do { a = randInt(2, 9); b = randInt(3, 12); c = randInt(3, 12) } while ((a * b * c) % 3 !== 0)
  return {
    condition_text: `Найдите объём многогранника, вершинами которого являются вершины A, B, C, D, A₁ прямоугольного параллелепипеда ABCDA₁B₁C₁D₁, у которого AB = ${a}, AD = ${b}, AA₁ = ${c}.`,
    image_url: svgUrl(boxPyramidA1Svg()),
    answer: ru(a * b * c / 3),
  }
}

// Обратная к t03ConeInSphere: V_кон = V_шара/4.
function t03ConeInSphereInv() {
  const v = 4 * randInt(2, 30)
  return {
    condition_text: `Конус вписан в шар. Радиус основания конуса равен радиусу шара. Объём шара равен ${v}. Найдите объём конуса.`,
    image_url: svgUrl(coneInSphereSvg()),
    answer: ru(v / 4),
  }
}

// Два цилиндра: первый выше и уже, второй ниже и шире.
function twoCylSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 520" width="700" height="520" font-family="Arial, sans-serif">` +
    `<rect width="700" height="520" fill="#fff"/>` +
    `<ellipse cx="180" cy="120" rx="110" ry="30" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="70" y1="120" x2="70" y2="450" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="290" y1="120" x2="290" y2="450" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M70,450 A110,30 0 0,0 290,450" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M70,450 A110,30 0 0,1 290,450" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="232"/>` +
    `<ellipse cx="490" cy="290" rx="160" ry="43" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="330" y1="290" x2="330" y2="450" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="650" y1="290" x2="650" y2="450" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M330,450 A160,43 0 0,0 650,450" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M330,450 A160,43 0 0,1 650,450" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="8 6" pathLength="344"/>` +
    `</svg>`
}

// V = πR²h: высота ÷a, радиус ×b ⟹ V₂ = V₁·b²/a.
function t03TwoCylinders() {
  const a = randInt(2, 4), b = randInt(2, 4)
  const v1 = a * randInt(2, 15)
  return {
    condition_text: `Дано два цилиндра. Объём первого цилиндра равен ${v1}. У второго цилиндра высота в ${a} ${razWord(a)} меньше, а радиус основания в ${b} ${razWord(b)} больше, чем у первого. Найдите объём второго цилиндра.`,
    image_url: svgUrl(twoCylSvg()),
    answer: ru(v1 / a * b * b),
  }
}

// Обратный набор данных: второй цилиндр выше в a раз и уже в b раз ⟹ V₂ = V₁·a/b².
const RAZ_WORD = { 2: "два", 3: "три", 4: "четыре" }
function t03TwoCylindersTaller() {
  const a = randInt(2, 4), b = randInt(2, 4)
  const v1 = b * b * randInt(2, 12)
  return {
    condition_text: `Дано два цилиндра. Объём первого цилиндра равен ${v1}. У второго цилиндра высота в ${RAZ_WORD[a]} раза больше, а радиус основания в ${RAZ_WORD[b]} раза меньше, чем у первого. Найдите объём второго цилиндра.`,
    image_url: svgUrl(twoCylSvg()),
    answer: ru(v1 * a / (b * b)),
  }
}

// V_шара = 4πR³/3, V_цил = 2πR³ ⟹ V_цил = 1,5·V_шара.
function t03SphereInCylVol() {
  const v = 2 * randInt(2, 30)
  // две формулировки банка: «шар вписан в цилиндр» и «цилиндр описан около шара»
  const text = Math.random() < 0.5
    ? `Шар, объём которого равен ${v}, вписан в цилиндр. Найдите объём цилиндра.`
    : `Цилиндр описан около шара. Объём шара равен ${v}. Найдите объём цилиндра.`
  return { condition_text: text, image_url: svgUrl(sphereInCylSvg()), answer: ru(3 * v / 2) }
}

// Тот же параллелепипед + диагонали сечения AC и A₁C₁ (тело A,B,C,A₁,B₁,C₁).
function boxDiagSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 470 360" width="470" height="360" font-family="Arial, sans-serif">` +
    `<rect width="470" height="360" fill="#fff"/>` +
    // видимые рёбра
    `<line x1="70" y1="250" x2="245" y2="300" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="245" y1="300" x2="395" y2="250" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="70" y1="250" x2="70" y2="100" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="245" y1="300" x2="245" y2="150" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="395" y1="250" x2="395" y2="100" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="70" y1="100" x2="245" y2="150" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="245" y1="150" x2="395" y2="100" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="70" y1="100" x2="220" y2="50" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="220" y1="50" x2="395" y2="100" stroke="#000" stroke-width="1.5"/>` +
    // скрытые рёбра (вершина D)
    `<line x1="70" y1="250" x2="220" y2="200" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    `<line x1="395" y1="250" x2="220" y2="200" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    `<line x1="220" y1="200" x2="220" y2="50" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    // диагонали сечения
    `<line x1="70" y1="100" x2="395" y2="100" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="70" y1="250" x2="395" y2="250" stroke="#000" stroke-width="1.3" stroke-dasharray="5 4"/>` +
    // подписи
    `<g font-size="17" font-style="italic" fill="#000" text-anchor="middle">` +
    `<text x="60" y="270">A</text><text x="240" y="320">B</text><text x="407" y="268">C</text><text x="205" y="216">D</text>` +
    `<text x="55" y="98">A₁</text><text x="245" y="140">B₁</text><text x="410" y="98">C₁</text><text x="214" y="40">D₁</text>` +
    `</g></svg>`
}

function t03BoxTriPrism() {
  let a, b, c
  do { a = randInt(3, 12); b = randInt(2, 9); c = randInt(3, 12) } while ((a * b * c) % 2 !== 0)
  return {
    condition_text: `В прямоугольном параллелепипеде ABCDA₁B₁C₁D₁ известно, что AB = ${a}, BC = ${b}, AA₁ = ${c}. Найдите объём многогранника, вершинами которого являются точки A, B, C, A₁, B₁, C₁.`,
    image_url: svgUrl(boxDiagSvg()),
    answer: ru(a * b * c / 2),
  }
}

function t03BoxPrism() {
  let a, b, c
  do { a = randInt(3, 12); b = randInt(2, 9); c = randInt(3, 12) } while ((a * b * c) % 2 !== 0)
  return {
    condition_text: `В прямоугольном параллелепипеде ABCDA₁B₁C₁D₁ известно, что AB = ${a}, BC = ${b}, AA₁ = ${c}. Найдите объём многогранника, вершинами которого являются точки A, B, C, D, A₁, B₁.`,
    image_url: svgUrl(boxPlainSvg()),
    answer: ru(a * b * c / 2),
  }
}

// Высокий параллелепипед без выделения искомого тела (как в оригинале ФИПИ):
// скрытая вершина — задняя нижняя D (штрих: DA, DC, DD₁).
function boxTallSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 400" width="260" height="400" font-family="Arial, sans-serif">` +
    `<rect width="260" height="400" fill="#fff"/>` +
    // скрытые рёбра
    `<line x1="40" y1="350" x2="95" y2="320" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="63"/>` +
    `<line x1="95" y1="320" x2="215" y2="320" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="120"/>` +
    `<line x1="95" y1="320" x2="95" y2="80" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="240"/>` +
    // видимые рёбра
    `<line x1="40" y1="350" x2="160" y2="350" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="160" y1="350" x2="215" y2="320" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="40" y1="350" x2="40" y2="110" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="160" y1="350" x2="160" y2="110" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="215" y1="320" x2="215" y2="80" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="40" y1="110" x2="160" y2="110" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="160" y1="110" x2="215" y2="80" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="40" y1="110" x2="95" y2="80" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="95" y1="80" x2="215" y2="80" stroke="#000" stroke-width="1.5"/>` +
    // подписи
    `<g font-size="16" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="31" y="372">A</text><text x="163" y="372">B</text><text x="226" y="340">C</text><text x="107" y="337">D</text>` +
    `<text x="23" y="101">A₁</text><text x="176" y="102">B₁</text><text x="84" y="71">D₁</text><text x="227" y="71">C₁</text>` +
    `</g></svg>`
}

// Прямая треугольная призма, в основаниях — прямоугольные треугольники
// (прямые углы отмечены квадратиками), заднее нижнее ребро скрыто.
function prismRightSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 265 330" width="265" height="330" font-family="Arial, sans-serif">` +
    `<rect width="265" height="330" fill="#fff"/>` +
    // скрытое ребро нижнего основания
    `<line x1="40" y1="225" x2="225" y2="253" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="187"/>` +
    // верхнее основание
    `<line x1="40" y1="45" x2="225" y2="73" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="40" y1="45" x2="77" y2="105" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="77" y1="105" x2="225" y2="73" stroke="#000" stroke-width="1.5"/>` +
    // нижнее основание
    `<line x1="40" y1="225" x2="77" y2="285" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="77" y1="285" x2="225" y2="253" stroke="#000" stroke-width="1.5"/>` +
    // боковые рёбра
    `<line x1="40" y1="45" x2="40" y2="225" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="77" y1="105" x2="77" y2="285" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="225" y1="73" x2="225" y2="253" stroke="#000" stroke-width="1.5"/>` +
    // прямые углы
    `<polyline points="68.1,90.5 84.7,86.9 93.6,101.4" fill="none" stroke="#000" stroke-width="1.3"/>` +
    `<polyline points="68.1,270.5 84.7,266.9 93.6,281.4" fill="none" stroke="#000" stroke-width="1.3"/>` +
    `</svg>`
}

// V = (катет·катет/2)·боковое ребро.
function t03PrismRightVol() {
  let a, b
  do { a = randInt(2, 12); b = randInt(2, 12) } while (a === b || (a * b) % 2 !== 0)
  const h = randInt(2, 12)
  return {
    condition_text: `Основанием прямой треугольной призмы является прямоугольный треугольник с катетами ${a} и ${b}, боковое ребро призмы равно ${h}. Найдите объём призмы.`,
    image_url: svgUrl(prismRightSvg()),
    answer: ru(a * b * h / 2),
  }
}

// Обратная: по объёму и катетам — боковое ребро h = 2V/(a·b).
function t03PrismRightEdge() {
  let a, b
  do { a = randInt(2, 12); b = randInt(2, 12) } while (a === b || (a * b) % 2 !== 0)
  const h = randInt(2, 12)
  return {
    condition_text: `Основанием прямой треугольной призмы служит прямоугольный треугольник с катетами ${a} и ${b}, объём призмы равен ${ru(a * b * h / 2)}. Найдите боковое ребро призмы.`,
    image_url: svgUrl(prismRightSvg()),
    answer: ru(h),
  }
}

// Правильная 4-угольная призма с двумя диагоналями DB₁ и CA₁ (жирный штрих —
// как в оригинале ФИПИ); рёбра при скрытой вершине D — тонкие сплошные,
// чтобы не спутать их с диагоналями.
function sqPrismDiagSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 330" width="390" height="330" font-family="Arial, sans-serif">` +
    `<rect width="390" height="330" fill="#fff"/>` +
    // рёбра при вершине D
    `<line x1="45" y1="285" x2="153" y2="229" stroke="#000" stroke-width="1.1"/>` +
    `<line x1="153" y1="229" x2="353" y2="229" stroke="#000" stroke-width="1.1"/>` +
    `<line x1="153" y1="229" x2="153" y2="79" stroke="#000" stroke-width="1.1"/>` +
    // остальные рёбра
    `<line x1="45" y1="285" x2="245" y2="285" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="245" y1="285" x2="353" y2="229" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="45" y1="285" x2="45" y2="135" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="245" y1="285" x2="245" y2="135" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="353" y1="229" x2="353" y2="79" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="45" y1="135" x2="245" y2="135" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="245" y1="135" x2="353" y2="79" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="45" y1="135" x2="153" y2="79" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="153" y1="79" x2="353" y2="79" stroke="#000" stroke-width="1.5"/>` +
    // диагонали CA₁ и DB₁
    `<line x1="353" y1="229" x2="45" y2="135" stroke="#000" stroke-width="2.2" stroke-dasharray="8 6" pathLength="322"/>` +
    `<line x1="153" y1="229" x2="245" y2="135" stroke="#000" stroke-width="2.2" stroke-dasharray="8 6" pathLength="132"/>` +
    // подписи
    `<g font-size="17" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="34" y="308">A</text><text x="248" y="310">B</text><text x="368" y="252">C</text><text x="145" y="258">D</text>` +
    `<text x="27" y="127">A₁</text><text x="223" y="125">B₁</text><text x="146" y="67">D₁</text><text x="371" y="72">C₁</text>` +
    `</g></svg>`
}

// Угол между диагоналями DB₁ и CA₁ считается по координатам: сторона основания 1,
// высота h из условия «диагональ призмы = 2·ребро основания» ⟹ 2 + h² = 4.
function sqPrismDiagAngleDeg(h) {
  const u = [1, -1, h]   // DB₁ = B₁ − D
  const v = [-1, -1, h]  // CA₁ = A₁ − C
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const len = (w) => Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2])
  return Math.round(Math.acos(Math.min(1, Math.abs(dot) / (len(u) * len(v)))) * 180 / Math.PI)
}

function t03SqPrismAngle() {
  const diag = pick(["BD₁", "D₁B"]), edge = pick(["AD", "AB", "BC", "CD"])
  return {
    condition_text: `В правильной четырёхугольной призме ABCDA₁B₁C₁D₁ известно, что ${diag} = 2${edge}. Найдите угол между диагоналями DB₁ и CA₁. Ответ дайте в градусах.`,
    image_url: svgUrl(sqPrismDiagSvg()),
    answer: ru(sqPrismDiagAngleDeg(Math.SQRT2)),
  }
}

// Правильная треугольная призма ABCA₁B₁C₁ «домиком» (как в ФИПИ): передняя грань
// ABB₁A₁ — прямоугольник, задняя вершина C/C₁ смещена вправо-вверх, рёбра при ней
// штрихом.
function triPrismSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 340" width="300" height="340" font-family="Arial, sans-serif">` +
    `<rect width="300" height="340" fill="#fff"/>` +
    // скрытые рёбра при задней вершине C
    `<line x1="50" y1="300" x2="208" y2="260" stroke="#000" stroke-width="1.6" stroke-dasharray="7 5" pathLength="163"/>` +
    `<line x1="208" y1="260" x2="250" y2="300" stroke="#000" stroke-width="1.6" stroke-dasharray="7 5" pathLength="58"/>` +
    `<line x1="208" y1="260" x2="208" y2="55" stroke="#000" stroke-width="1.6" stroke-dasharray="7 5" pathLength="205"/>` +
    // видимые рёбра
    `<line x1="50" y1="300" x2="250" y2="300" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="50" y1="300" x2="50" y2="95" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="250" y1="300" x2="250" y2="95" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="50" y1="95" x2="250" y2="95" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="50" y1="95" x2="208" y2="55" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="208" y1="55" x2="250" y2="95" stroke="#000" stroke-width="1.8"/>` +
    // подписи
    `<g font-size="17" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="42" y="324">A</text><text x="256" y="324">B</text><text x="188" y="254">C</text>` +
    `<text x="33" y="84">A₁</text><text x="272" y="86">B₁</text><text x="203" y="44">C₁</text>` +
    `</g></svg>`
}

// Координаты правильной треугольной призмы с ребром 1 (основание — равносторонний
// треугольник, глубина по y, высота по z). Угол считается кодом.
const TRIPRISM_V = {
  A: [0, 0, 0], B: [1, 0, 0], C: [0.5, Math.sqrt(3) / 2, 0],
  A1: [0, 0, 1], B1: [1, 0, 1], C1: [0.5, Math.sqrt(3) / 2, 1],
}
function linesAngleDeg(V, p, q, r, s) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]]
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const len = (u) => Math.sqrt(dot(u, u))
  const u = sub(V[q], V[p]), w = sub(V[s], V[r])
  return Math.round(Math.acos(Math.min(1, Math.abs(dot(u, w)) / (len(u) * len(w)))) * 180 / Math.PI)
}
// Боковое ребро и диагональ боковой грани (пары из открытого банка + их
// переобозначения по симметрии призмы).
const TRIPRISM_ANGLE_PAIRS = [
  ["A", "A1", "B", "C1"], ["A", "A1", "C", "B1"], ["B", "B1", "A", "C1"],
  ["B", "B1", "C", "A1"], ["C", "C1", "A", "B1"], ["C", "C1", "B", "A1"],
]

function t03TriPrismAngle() {
  const [p, q, r, s] = pick(TRIPRISM_ANGLE_PAIRS), a = randInt(1, 6)
  return {
    condition_text: `В правильной треугольной призме ABCA₁B₁C₁, все рёбра которой равны ${a}, найдите угол между прямыми ${vertName(p)}${vertName(q)} и ${vertName(r)}${vertName(s)}. Ответ дайте в градусах.`,
    image_url: svgUrl(triPrismSvg()),
    answer: ru(linesAngleDeg(TRIPRISM_V, p, q, r, s)),
  }
}

// Правильная 4-угольная пирамида SABCD с центром основания O: пунктиром — рёбра к
// скрытой вершине D, ребро SD, высота SO и диагонали основания.
function pyrSqDiagSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 340" width="320" height="340" font-family="Arial, sans-serif">` +
    `<rect width="320" height="340" fill="#fff"/>` +
    `<line x1="45" y1="290" x2="120" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="106"/>` +
    `<line x1="120" y1="215" x2="270" y2="223" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="150"/>` +
    `<line x1="157.5" y1="55" x2="120" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="164"/>` +
    `<line x1="157.5" y1="55" x2="157.5" y2="256.5" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="202"/>` +
    `<line x1="45" y1="290" x2="270" y2="223" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="235"/>` +
    `<line x1="195" y1="298" x2="120" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="112"/>` +
    `<line x1="157.5" y1="55" x2="45" y2="290" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="157.5" y1="55" x2="195" y2="298" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="45" y1="290" x2="195" y2="298" stroke="#000" stroke-width="2.2"/>` +
    `<line x1="195" y1="298" x2="270" y2="223" stroke="#000" stroke-width="2.2"/>` +
    `<line x1="157.5" y1="55" x2="270" y2="223" stroke="#000" stroke-width="2.2"/>` +
    `<g font-size="17" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="157" y="42">S</text><text x="32" y="310">A</text><text x="196" y="321">B</text><text x="286" y="228">C</text>` +
    `</g><g font-size="15" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="105" y="208">D</text><text x="152" y="277">O</text>` +
    `</g></svg>`
}

// Правильная 4-угольная пирамида без подписей: пунктиром задние рёбра основания,
// ребро к скрытой вершине и высота.
function pyrSqPlainSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 340" width="320" height="340" font-family="Arial, sans-serif">` +
    `<rect width="320" height="340" fill="#fff"/>` +
    `<line x1="45" y1="290" x2="120" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="106"/>` +
    `<line x1="120" y1="215" x2="270" y2="223" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="150"/>` +
    `<line x1="157.5" y1="55" x2="120" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="164"/>` +
    `<line x1="157.5" y1="55" x2="157.5" y2="256.5" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="202"/>` +
    `<line x1="157.5" y1="55" x2="45" y2="290" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="157.5" y1="55" x2="195" y2="298" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="157.5" y1="55" x2="270" y2="223" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="45" y1="290" x2="195" y2="298" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="195" y1="298" x2="270" y2="223" stroke="#000" stroke-width="1.6"/>` +
    `</svg>`
}

// Треугольная пирамида с плоскостью через вершину и среднюю линию основания:
// жирным — отсечённая пирамида, средняя линия и второе ребро сечения штрихом.
function pyrMidlineCutSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 340" width="320" height="340" font-family="Arial, sans-serif">` +
    `<rect width="320" height="340" fill="#fff"/>` +
    `<line x1="45" y1="215" x2="280" y2="252" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="238"/>` +
    `<line x1="70" y1="252.5" x2="162.5" y2="233.5" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="94"/>` +
    `<line x1="140" y1="55" x2="162.5" y2="233.5" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="180"/>` +
    `<line x1="140" y1="55" x2="95" y2="290" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="140" y1="55" x2="280" y2="252" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="70" y1="252.5" x2="95" y2="290" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="95" y1="290" x2="280" y2="252" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="140" y1="55" x2="45" y2="215" stroke="#000" stroke-width="2.4"/>` +
    `<line x1="140" y1="55" x2="70" y2="252.5" stroke="#000" stroke-width="2.4"/>` +
    `<line x1="45" y1="215" x2="70" y2="252.5" stroke="#000" stroke-width="2.4"/>` +
    `</svg>`
}

// Средняя линия отсекает от основания треугольник в ¼ площади, высота та же ⟹ V/4.
function t03PyrMidlineCut() {
  const v = 2 * randInt(3, 60)
  return {
    condition_text: `Объём треугольной пирамиды равен ${v}. Через вершину пирамиды и среднюю линию её основания проведена плоскость (см. рисунок). Найдите объём отсечённой треугольной пирамиды.`,
    image_url: svgUrl(pyrMidlineCutSvg()),
    answer: ru(clean(v / 4)),
  }
}

// Тетраэдр «две нижние вершины + две верхние» правильной треугольной призмы:
// V = ⅙·L·|b×c| = S·L/3 (b, c — стороны основания из общей вершины).
const TRIPRISM_TETRA4 = [["A", "C", "B"], ["A", "B", "C"], ["B", "A", "C"], ["B", "C", "A"], ["C", "A", "B"], ["C", "B", "A"]]
function t03PrismTetra4() {
  const [x, y, z] = pick(TRIPRISM_TETRA4)
  let s, l
  do { s = randInt(2, 14); l = randInt(2, 14) } while ((s * l) % 3 !== 0)
  return {
    condition_text: `Найдите объём многогранника, вершинами которого являются вершины ${x}, ${y}, ${x}₁, ${z}₁ правильной треугольной призмы ABCA₁B₁C₁. Площадь основания призмы равна ${s}, а боковое ребро равно ${l}.`,
    image_url: svgUrl(triPrismSvg()),
    answer: ru(s * l / 3),
  }
}

// Пирамида «целое основание + вершина другого основания» правильной шестиугольной
// призмы: V = S·L/3.
function t03HexPrismPyr() {
  const i = randInt(0, 5), top = Math.random() < 0.5
  const apex = HEX_NAMES[i] + (top ? "" : "1")
  const base = HEX_NAMES.map(n => n + (top ? "1" : ""))
  let S, L
  do { S = randInt(2, 14); L = randInt(2, 14) } while ((S * L) % 3 !== 0)
  const names = top ? [apex, ...base] : [...base, apex]
  return {
    condition_text: `Найдите объём многогранника, вершинами которого являются точки ${hexList(names)} правильной шестиугольной призмы ABCDEFA₁B₁C₁D₁E₁F₁, площадь основания которой равна ${S}, а боковое ребро равно ${L}.`,
    image_url: svgUrl(hexPrismSvg()),
    answer: ru(S * L / 3),
  }
}

// Тетраэдр «вершина + три подряд идущие вершины другого основания» шестиугольной
// призмы: площадь треугольника из трёх подряд вершин — ⅙ основания ⟹ V = S·L/18.
function t03HexPrismTetra() {
  const i = randInt(0, 5), top = Math.random() < 0.5
  const tri = [5, 0, 1].map(k => HEX_NAMES[(i + k) % 6])   // X и два его соседа
  const ratio = hexBaseRatio(tri)                           // = 1/6, считается по координатам
  const sfx = top ? "1" : ""
  const names = [...tri.map(n => n + sfx), HEX_NAMES[i] + (top ? "" : "1")]
  let S, L
  do { S = randInt(2, 18); L = randInt(2, 18) } while (!Number.isInteger(clean(ratio * S * L / 3)))
  return {
    condition_text: `Найдите объём многогранника, вершинами которого являются вершины ${hexList(names)} правильной шестиугольной призмы ABCDEFA₁B₁C₁D₁E₁F₁, площадь основания которой равна ${S}, а боковое ребро равно ${L}.`,
    image_url: svgUrl(hexPrismSvg()),
    answer: ru(clean(ratio * S * L / 3)),
  }
}

// Правильная шестиугольная пирамида: симметричная проекция (без сдвига по x),
// иначе рёбра к задним вершинам ложатся на рёбра к передним.
function pyrHexSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 290 340" width="290" height="340" font-family="Arial, sans-serif">` +
    `<rect width="290" height="340" fill="#fff"/>` +
    `<line x1="245" y1="250" x2="195" y2="206.7" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="66"/>` +
    `<line x1="195" y1="206.7" x2="95" y2="206.7" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="100"/>` +
    `<line x1="95" y1="206.7" x2="45" y2="250" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="66"/>` +
    `<line x1="145" y1="80" x2="195" y2="206.7" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="136"/>` +
    `<line x1="145" y1="80" x2="95" y2="206.7" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="136"/>` +
    `<line x1="145" y1="80" x2="145" y2="250" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="170"/>` +
    `<line x1="45" y1="250" x2="95" y2="293.3" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="95" y1="293.3" x2="195" y2="293.3" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="195" y1="293.3" x2="245" y2="250" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="145" y1="80" x2="245" y2="250" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="145" y1="80" x2="195" y2="293.3" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="145" y1="80" x2="95" y2="293.3" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="145" y1="80" x2="45" y2="250" stroke="#000" stroke-width="1.5"/>` +
    `</svg>`
}

// У правильного шестиугольника радиус описанной окружности равен стороне ⟹
// h = √(l² − a²); (a, h, l) — пифагорова тройка (в банке — половинная: 2,5 / 6 / 6,5).
function t03PyrHexHeight() {
  const [p, q, r] = pick(PYTH_WIDE), t = pick([0.5, 1, 1.5])
  const [a, h] = Math.random() < 0.5 ? [p * t, q * t] : [q * t, p * t]
  return {
    condition_text: `В правильной шестиугольной пирамиде боковое ребро равно ${ru(clean(r * t))}, а сторона основания равна ${ru(clean(a))}. Найдите высоту пирамиды.`,
    image_url: svgUrl(pyrHexSvg()),
    answer: ru(clean(h)),
  }
}

// Шар вписан в куб: V_шара = kπ ⟹ R³ = 3k/4, ребро 2R ⟹ V_куба = 8R³ = 6k.
function t03CubeInSphereVol() {
  const k = randInt(2, 40)
  return {
    condition_text: `Шар, объём которого равен ${k}π, вписан в куб. Найдите объём куба.`,
    image_url: svgUrl(cubeInSphereSvg()),
    answer: ru(6 * k),
  }
}

// Шар вписан в куб с ребром a ⟹ V_шара/π = (4/3)(a/2)³ = a³/6 (в банке — без чертежа).
function t03CubeInSphereVolPi() {
  const a = 3 * randInt(1, 5)
  return {
    condition_text: `В куб с ребром ${a} вписан шар. Найдите объём этого шара, делённый на π.`,
    answer: ru(clean(a * a * a / 6)),
  }
}

// Прямоугольный параллелепипед, описанный около сферы, — куб с ребром 2R ⟹ V = 8R³.
function t03BoxInSphere() {
  const r = clean(randInt(2, 40) / 2)
  return {
    condition_text: `Прямоугольный параллелепипед описан около сферы радиуса ${ru(r)}. Найдите его объём.`,
    image_url: svgUrl(cubeInSphereSvg()),
    answer: ru(clean(8 * r * r * r)),
  }
}

// S_шара = 4πR², S_цил.полн = 6πR² ⟹ S_цил = 1,5·S_шара.
function t03SphereInCylSurfInv() {
  const s = 2 * randInt(2, 40)
  return {
    condition_text: `Шар вписан в цилиндр. Площадь поверхности шара равна ${s}. Найдите площадь полной поверхности цилиндра.`,
    image_url: svgUrl(sphereInCylSvg()),
    answer: ru(3 * s / 2),
  }
}

// Обратная к «цилиндр в параллелепипеде»: V = (2R)²·h ⟹ h = V/(4R²).
function t03BoxCylHeight() {
  const r = randInt(1, 9), h = randInt(1, 12)
  return {
    condition_text: `Прямоугольный параллелепипед описан около цилиндра, радиус основания которого равен ${r}. Объём параллелепипеда равен ${4 * r * r * h}. Найдите высоту цилиндра.`,
    image_url: svgUrl(cylInBoxSvg()),
    answer: ru(h),
  }
}

// Цилиндр, описанный около прямой призмы с прямоугольным треугольником в основании:
// гипотенуза — диаметр ⟹ R² = (a²+b²)/4, боковое ребро k/π ⟹ V = k·(a²+b²)/4.
function cylCircumPrismSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 350" width="300" height="350" font-family="Arial, sans-serif">` +
    `<rect width="300" height="350" fill="#fff"/>` +
    `<path d="M55,260 A95,26 0 0,1 245,260" fill="none" stroke="#000" stroke-width="1.3" stroke-dasharray="8 6" pathLength="198"/>` +
    `<line x1="55" y1="80" x2="245" y2="80" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="190"/>` +
    `<line x1="55" y1="80" x2="182.5" y2="104.4" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="130"/>` +
    `<line x1="182.5" y1="104.4" x2="245" y2="80" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="67"/>` +
    `<line x1="55" y1="260" x2="245" y2="260" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="190"/>` +
    `<line x1="55" y1="260" x2="182.5" y2="284.4" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="130"/>` +
    `<line x1="182.5" y1="284.4" x2="245" y2="260" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="67"/>` +
    `<line x1="182.5" y1="104.4" x2="182.5" y2="284.4" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="180"/>` +
    `<line x1="55" y1="80" x2="55" y2="260" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="245" y1="80" x2="245" y2="260" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M55,260 A95,26 0 0,0 245,260" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<ellipse cx="150" cy="80" rx="95" ry="26" fill="none" stroke="#000" stroke-width="1.7"/>` +
    // прямые углы в обоих основаниях (вершина опирается на диаметр)
    `<polyline points="169.7,102.0 181.8,97.2 194.6,99.7" fill="none" stroke="#000" stroke-width="1.2"/>` +
    `<polyline points="169.7,282.0 181.8,277.2 194.6,279.7" fill="none" stroke="#000" stroke-width="1.2"/>` +
    `</svg>`
}

function t03CylCircumPrism() {
  let a, b, k, v
  do {
    a = randInt(2, 12); b = randInt(2, 12); k = randInt(1, 8)
    v = k * (a * a + b * b) / 4
  } while (a === b || Math.round(v * 100) !== v * 100)
  return {
    condition_text: `В основании прямой призмы лежит прямоугольный треугольник с катетами ${a} и ${b}. Боковые рёбра призмы равны ${fT(k, "π")}. Найдите объём цилиндра, описанного около этой призмы.`,
    image_url: svgUrl(cylCircumPrismSvg()),
    answer: ru(clean(v)),
  }
}

// Два шара разного радиуса (у каждого экватор: передняя дуга сплошная, задняя штрихом).
function twoSpheresSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 270" width="300" height="270" font-family="Arial, sans-serif">` +
    `<rect width="300" height="270" fill="#fff"/>` +
    `<circle cx="110" cy="160" r="75" fill="none" stroke="#000" stroke-width="1.8"/>` +
    `<path d="M35,160 A75,20 0 0,1 185,160" fill="none" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="163"/>` +
    `<path d="M35,160 A75,20 0 0,0 185,160" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<circle cx="250" cy="178" r="34" fill="none" stroke="#000" stroke-width="1.8"/>` +
    `<path d="M216,178 A34,9 0 0,1 284,178" fill="none" stroke="#000" stroke-width="1.2" stroke-dasharray="6 4" pathLength="74"/>` +
    `<path d="M216,178 A34,9 0 0,0 284,178" fill="none" stroke="#000" stroke-width="1.5"/>` +
    `</svg>`
}

// Куб, описанный около сферы: ребро = 2R, сфера кругом радиуса a/2 (точки касания
// с четырьмя гранями попадают на контур, с передней и задней — скрыты сферой).
function cubeInSphereSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 300" width="320" height="300" font-family="Arial, sans-serif">` +
    `<rect width="320" height="300" fill="#fff"/>` +
    `<line x1="115" y1="202" x2="60" y2="240" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="67"/>` +
    `<line x1="115" y1="202" x2="255" y2="202" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="140"/>` +
    `<line x1="115" y1="202" x2="115" y2="62" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="140"/>` +
    `<line x1="60" y1="240" x2="200" y2="240" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="200" y1="240" x2="255" y2="202" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="60" y1="240" x2="60" y2="100" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="200" y1="240" x2="200" y2="100" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="255" y1="202" x2="255" y2="62" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="60" y1="100" x2="200" y2="100" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="200" y1="100" x2="255" y2="62" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="60" y1="100" x2="115" y2="62" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="115" y1="62" x2="255" y2="62" stroke="#000" stroke-width="1.5"/>` +
    `<circle cx="157.5" cy="151" r="70" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `<path d="M87.5,151 A70,19 0 0,1 227.5,151" fill="none" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="152"/>` +
    `<path d="M87.5,151 A70,19 0 0,0 227.5,151" fill="none" stroke="#000" stroke-width="1.4"/>` +
    `</svg>`
}

// Радиус (или диаметр) первого шара в k раз больше ⟹ площадь поверхности ×k².
function t03TwoSpheresSurf() {
  const k = randInt(2, 15), byDiameter = Math.random() < 0.5
  const what = byDiameter ? "Диаметр первого шара" : "Радиус первого шара"
  const of = byDiameter ? "диаметра второго" : "радиуса второго"
  return {
    condition_text: `Дано два шара. ${what} в ${k} ${razWord(k)} больше ${of}. Во сколько раз площадь поверхности первого шара больше площади поверхности второго?`,
    image_url: svgUrl(twoSpheresSvg()),
    answer: ru(k * k),
  }
}

// Радиус первого в k раз больше ⟹ объём ×k³.
function t03TwoSpheresVol() {
  const k = randInt(2, 15)
  return {
    condition_text: `Дано два шара. Радиус первого шара в ${k} ${razWord(k)} больше радиуса второго. Во сколько раз объём первого шара больше объёма второго?`,
    image_url: svgUrl(twoSpheresSvg()),
    answer: ru(k * k * k),
  }
}

// S = 4πR²: сумма площадей ⟹ R = √(R₁² + R₂²) (пифагорова тройка, чертежа в банке нет).
function t03SphereSumSurf() {
  const [p, q] = pick(PYTH_WIDE), t = randInt(1, 6)
  return {
    condition_text: `Радиусы двух шаров равны ${p * t} и ${q * t}. Найдите радиус шара, площадь поверхности которого равна сумме площадей поверхностей двух данных шаров.`,
    answer: ru(Math.sqrt((p * t) ** 2 + (q * t) ** 2)),
  }
}

// Куб описан около сферы радиуса R ⟹ ребро 2R, объём 8R³.
function t03CubeInSphere() {
  const r = clean(randInt(2, 20) / 2)
  return {
    condition_text: `Куб описан около сферы радиуса ${ru(r)}. Найдите объём куба.`,
    image_url: svgUrl(cubeInSphereSvg()),
    answer: ru(clean(8 * r * r * r)),
  }
}

// Шар с большим кругом (сечение через центр залито).
function sphereGreatSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320" font-family="Arial, sans-serif">` +
    `<rect width="320" height="320" fill="#fff"/>` +
    `<ellipse cx="160" cy="160" rx="130" ry="32" fill="#cfe8f7" stroke="none"/>` +
    `<circle cx="160" cy="160" r="130" fill="none" stroke="#000" stroke-width="2"/>` +
    `<path d="M30,160 A130,32 0 0,1 290,160" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="7 5" pathLength="283"/>` +
    `<path d="M30,160 A130,32 0 0,0 290,160" fill="none" stroke="#000" stroke-width="1.6"/>` +
    `</svg>`
}

// S_шара = 4πR², большой круг πR² ⟹ круг = S/4.
function t03SphereGreatCircle() {
  const s = 4 * randInt(1, 25)
  return {
    condition_text: `Площадь поверхности шара равна ${s}. Найдите площадь большого круга шара.`,
    image_url: svgUrl(sphereGreatSvg()),
    answer: ru(s / 4),
  }
}

// Правильная 4-угольная призма ABCDA₁B₁C₁D₁ (ФИПИ): скрытая задняя вершина C —
// рёбра BC, CD, CC₁ штрихом; основание развёрнуто, чтобы вертикали не совпадали.
function sqPrismSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 350" width="300" height="350" font-family="Arial, sans-serif">` +
    `<rect width="300" height="350" fill="#fff"/>` +
    `<line x1="245" y1="275" x2="185" y2="220" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="81"/>` +
    `<line x1="185" y1="220" x2="60" y2="245" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="127"/>` +
    `<line x1="185" y1="220" x2="185" y2="50" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="170"/>` +
    `<line x1="120" y1="300" x2="245" y2="275" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="120" y1="300" x2="60" y2="245" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="120" y1="300" x2="120" y2="130" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="245" y1="275" x2="245" y2="105" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="60" y1="245" x2="60" y2="75" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="120" y1="130" x2="245" y2="105" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="245" y1="105" x2="185" y2="50" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="185" y1="50" x2="60" y2="75" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="60" y1="75" x2="120" y2="130" stroke="#000" stroke-width="1.5"/>` +
    `<g font-size="16" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="114" y="322">A</text><text x="262" y="290">B</text><text x="200" y="213">C</text><text x="46" y="259">D</text>` +
    `<text x="104" y="148">A₁</text><text x="263" y="112">B₁</text><text x="188" y="40">C₁</text><text x="44" y="70">D₁</text>` +
    `</g></svg>`
}

// Три подряд идущие вершины основания + две верхние над первыми двумя: пирамида с
// основанием — боковая грань и вершиной в третьей точке ⟹ V = S·L/3.
const SQ_NAMES = ["A", "B", "C", "D"]
function t03SqPrismPoly() {
  const i = randInt(0, 3)
  const [x, y, z] = [0, 1, 2].map(k => SQ_NAMES[(i + k) % 4])
  let s, l
  do { s = randInt(2, 14); l = randInt(2, 14) } while ((s * l) % 3 !== 0)
  return {
    condition_text: `Дана правильная четырёхугольная призма ABCDA₁B₁C₁D₁, площадь основания которой равна ${s}, а боковое ребро равно ${l}. Найдите объём многогранника, вершинами которого являются точки ${x}, ${y}, ${z}, ${x}₁, ${y}₁.`,
    image_url: svgUrl(sqPrismSvg()),
    answer: ru(s * l / 3),
  }
}

// Пирамида с сечением через середины боковых рёбер: передние стороны сечения
// жирные сплошные, задние — штрихом.
function pyrMidSectSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 340" width="320" height="340" font-family="Arial, sans-serif">` +
    `<rect width="320" height="340" fill="#fff"/>` +
    `<line x1="45" y1="290" x2="120" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="106"/>` +
    `<line x1="120" y1="215" x2="270" y2="223" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="150"/>` +
    `<line x1="157.5" y1="55" x2="120" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="164"/>` +
    `<line x1="157.5" y1="55" x2="157.5" y2="256.5" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="202"/>` +
    `<line x1="213.75" y1="139" x2="138.75" y2="135" stroke="#000" stroke-width="1.5" stroke-dasharray="6 5" pathLength="75"/>` +
    `<line x1="138.75" y1="135" x2="101.25" y2="172.5" stroke="#000" stroke-width="1.5" stroke-dasharray="6 5" pathLength="53"/>` +
    `<line x1="157.5" y1="55" x2="45" y2="290" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="157.5" y1="55" x2="195" y2="298" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="157.5" y1="55" x2="270" y2="223" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="45" y1="290" x2="195" y2="298" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="195" y1="298" x2="270" y2="223" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="101.25" y1="172.5" x2="176.25" y2="176.5" stroke="#000" stroke-width="2.4"/>` +
    `<line x1="176.25" y1="176.5" x2="213.75" y2="139" stroke="#000" stroke-width="2.4"/>` +
    `</svg>`
}

// Середины боковых рёбер дают квадрат со стороной a/2 (средняя линия) ⟹ S = a²/4.
function t03PyrMidSect() {
  const a = 2 * randInt(1, 10)
  return {
    condition_text: `В правильной четырёхугольной пирамиде все рёбра равны ${a}. Найдите площадь сечения пирамиды плоскостью, проходящей через середины боковых рёбер.`,
    image_url: svgUrl(pyrMidSectSvg()),
    answer: ru(a * a / 4),
  }
}

// Правильная треугольная пирамида без подписей: штрихом задняя сторона основания
// и высота.
function pyrTriSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 340" width="320" height="340" font-family="Arial, sans-serif">` +
    `<rect width="320" height="340" fill="#fff"/>` +
    `<line x1="45" y1="215" x2="280" y2="252" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="238"/>` +
    `<line x1="140" y1="55" x2="140" y2="252" stroke="#000" stroke-width="1.3" stroke-dasharray="7 5" pathLength="197"/>` +
    `<line x1="140" y1="55" x2="45" y2="215" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="140" y1="55" x2="95" y2="290" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="140" y1="55" x2="280" y2="252" stroke="#000" stroke-width="1.5"/>` +
    `<line x1="45" y1="215" x2="95" y2="290" stroke="#000" stroke-width="1.6"/>` +
    `<line x1="95" y1="290" x2="280" y2="252" stroke="#000" stroke-width="1.6"/>` +
    `</svg>`
}

// Пары (боковое ребро l, высота h), кратные 0,5, с l² − h² = P (P — квадрат радиуса
// описанной вокруг основания окружности). Разложение 4P = m·n при равной чётности.
function halfIntLegPairs(P) {
  const F = Math.round(4 * P), out = []
  for (let m = 1; m * m < F; m++) {
    if (F % m) continue
    const n = F / m
    if ((n - m) % 2) continue
    const l = (n + m) / 4, h = (n - m) / 4
    if (h >= 1 && l <= 60 && Number.isInteger(l * 2) && Number.isInteger(h * 2)) out.push([l, h])
  }
  return out
}

// Правильная 4-угольная пирамида: R² = a²/2 ⟹ h = √(l² − a²/2).
// Два формата условия из банка: сторона целая (ответ кратен 0,5) или сторона k√2.
function t03PyrSqHeight() {
  if (Math.random() < 0.5) {
    const a = pick([6, 8, 10, 12, 14, 16, 18, 20])
    const pairs = halfIntLegPairs(a * a / 2)
    const [l, h] = pick(pairs)
    return {
      condition_text: `В правильной четырёхугольной пирамиде боковое ребро равно ${ru(l)}, а сторона основания равна ${a}. Найдите высоту пирамиды.`,
      image_url: svgUrl(pyrSqPlainSvg()),
      answer: ru(h),
    }
  }
  const [p, q, r] = pick(PYTH_WIDE), t = randInt(1, 3)
  const [k, h] = Math.random() < 0.5 ? [p * t, q * t] : [q * t, p * t]
  return {
    condition_text: `В правильной четырёхугольной пирамиде боковое ребро равно ${r * t}, а сторона основания равна ${k}${rT(2)}. Найдите высоту пирамиды.`,
    image_url: svgUrl(pyrSqPlainSvg()),
    answer: ru(h),
  }
}

// По высоте и боковому ребру: R² = l² − h², сторона² = 2R² ⟹ V = ⅔·(l² − h²)·h.
function t03PyrSqVolHL() {
  let h, l
  do { h = randInt(2, 12); l = randInt(h + 1, 15) } while ((2 * (l * l - h * h) * h) % 3 !== 0)
  return {
    condition_text: `В правильной четырёхугольной пирамиде высота равна ${h}, боковое ребро равно ${l}. Найдите её объём.`,
    image_url: svgUrl(pyrSqPlainSvg()),
    answer: ru(2 * (l * l - h * h) * h / 3),
  }
}

// Правильная треугольная пирамида: R² = a²/3 ⟹ h = √(l² − a²/3).
// Форматы банка: сторона кратна 1,5 (ответ кратен 0,5) или сторона k√3.
function t03PyrTriHeight() {
  if (Math.random() < 0.5) {
    const u = pick([5, 7, 9, 11, 13]), a = clean(1.5 * u)
    const pairs = halfIntLegPairs(a * a / 3)
    const [l, h] = pick(pairs)
    return {
      condition_text: `В правильной треугольной пирамиде боковое ребро равно ${ru(l)}, а сторона основания равна ${ru(a)}. Найдите высоту пирамиды.`,
      image_url: svgUrl(pyrTriSvg()),
      answer: ru(h),
    }
  }
  const [p, q, r] = pick(PYTH_WIDE), t = randInt(1, 3)
  const [k, h] = Math.random() < 0.5 ? [p * t, q * t] : [q * t, p * t]
  return {
    condition_text: `В правильной треугольной пирамиде боковое ребро равно ${r * t}, а сторона основания равна ${k}${rT(3)}. Найдите высоту пирамиды.`,
    image_url: svgUrl(pyrTriSvg()),
    answer: ru(h),
  }
}

// Та же пирамида без центра O и диагоналей: к скрытой вершине D — штрих (AD, DC, SD).
function pyrSqSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 340" width="320" height="340" font-family="Arial, sans-serif">` +
    `<rect width="320" height="340" fill="#fff"/>` +
    `<line x1="45" y1="290" x2="120" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="106"/>` +
    `<line x1="120" y1="215" x2="270" y2="223" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="150"/>` +
    `<line x1="157.5" y1="55" x2="120" y2="215" stroke="#000" stroke-width="1.3" stroke-dasharray="6 5" pathLength="164"/>` +
    `<line x1="157.5" y1="55" x2="45" y2="290" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="157.5" y1="55" x2="195" y2="298" stroke="#000" stroke-width="1.4"/>` +
    `<line x1="45" y1="290" x2="195" y2="298" stroke="#000" stroke-width="2.2"/>` +
    `<line x1="195" y1="298" x2="270" y2="223" stroke="#000" stroke-width="2.2"/>` +
    `<line x1="157.5" y1="55" x2="270" y2="223" stroke="#000" stroke-width="2.2"/>` +
    `<g font-size="17" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="157" y="42">S</text><text x="32" y="310">A</text><text x="196" y="321">B</text>` +
    `<text x="286" y="228">C</text><text x="137" y="206">D</text>` +
    `</g></svg>`
}

// Сторона основания k√2 ⟹ полудиагональ k; (k, h, SC) — пифагорова тройка,
// V = ⅓·(k√2)²·h = ⅔·k²·h (у любой тройки один катет кратен 3 ⟹ ответ целый).
function t03PyrSqVol() {
  const [p, q, r] = pick(PYTH_WIDE), t = randInt(1, 2)
  const [k, h] = Math.random() < 0.5 ? [p * t, q * t] : [q * t, p * t]
  return {
    condition_text: `В правильной четырёхугольной пирамиде SABCD с основанием ABCD боковое ребро SC равно ${r * t}, сторона основания равна ${k}${rT(2)}. Найдите объём пирамиды.`,
    image_url: svgUrl(pyrSqSvg()),
    answer: ru(2 * k * k * h / 3),
  }
}

// SO, OD и боковое ребро SD — пифагорова тройка; диагональ основания BD = 2·OD.
function t03PyrSqDiagBD() {
  const [p, q, k] = pick(PYTH_WIDE), t = randInt(1, 3)
  const [so, od] = Math.random() < 0.5 ? [p * t, q * t] : [q * t, p * t]
  return {
    condition_text: `В правильной четырёхугольной пирамиде SABCD с вершиной S точка O – центр основания, SO = ${so}, SD = ${k * t}. Найдите длину отрезка BD.`,
    image_url: svgUrl(pyrSqDiagSvg()),
    answer: ru(2 * od),
  }
}

// Обратная: по боковому ребру и диагонали основания — высота SO.
function t03PyrSqDiagSO() {
  const [p, q, k] = pick(PYTH_WIDE), t = randInt(1, 3)
  const [so, od] = Math.random() < 0.5 ? [p * t, q * t] : [q * t, p * t]
  return {
    condition_text: `В правильной четырёхугольной пирамиде SABCD с вершиной S точка O – центр основания, SD = ${k * t}, AC = ${2 * od}. Найдите длину отрезка SO.`,
    image_url: svgUrl(pyrSqDiagSvg()),
    answer: ru(so),
  }
}

// Правильная 4-угольная пирамида SABCD с точкой E — серединой бокового ребра SB.
// Жирным выделен тетраэдр EABC, рёбра к скрытой вершине C — жирным штрихом.
function pyrMidEdgeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 340" width="330" height="340" font-family="Arial, sans-serif">` +
    `<rect width="330" height="340" fill="#fff"/>` +
    // скрытое боковое ребро SC
    `<line x1="157.5" y1="60" x2="125" y2="225" stroke="#000" stroke-width="1.2" stroke-dasharray="6 5" pathLength="168"/>` +
    // рёбра тетраэдра к скрытой вершине C
    `<line x1="190" y1="290" x2="125" y2="225" stroke="#000" stroke-width="2" stroke-dasharray="7 5" pathLength="92"/>` +
    `<line x1="125" y1="225" x2="275" y2="250" stroke="#000" stroke-width="2" stroke-dasharray="7 5" pathLength="152"/>` +
    `<line x1="125" y1="225" x2="216" y2="155" stroke="#000" stroke-width="2" stroke-dasharray="7 5" pathLength="115"/>` +
    // каркас пирамиды
    `<line x1="157.5" y1="60" x2="40" y2="265" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="157.5" y1="60" x2="190" y2="290" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="157.5" y1="60" x2="275" y2="250" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="40" y1="265" x2="190" y2="290" stroke="#000" stroke-width="1.3"/>` +
    `<line x1="40" y1="265" x2="125" y2="225" stroke="#000" stroke-width="1.3"/>` +
    // тетраэдр EABC (видимые рёбра)
    `<line x1="190" y1="290" x2="275" y2="250" stroke="#000" stroke-width="2.4"/>` +
    `<line x1="275" y1="250" x2="216" y2="155" stroke="#000" stroke-width="2.4"/>` +
    `<line x1="216" y1="155" x2="190" y2="290" stroke="#000" stroke-width="2.4"/>` +
    // подписи
    `<g font-size="17" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="157" y="45">S</text><text x="28" y="282">D</text><text x="192" y="313">A</text>` +
    `<text x="292" y="248">B</text><text x="112" y="214">C</text><text x="234" y="146">E</text>` +
    `</g></svg>`
}

// Основание ABC — половина ABCD, высота из E — половина высоты пирамиды ⟹ V_EABC = V/4.
function t03PyrMidEdge() {
  const v = 4 * randInt(2, 50)
  return {
    condition_text: `Объём правильной четырёхугольной пирамиды SABCD равен ${v}. Точка E — середина ребра SB. Найдите объём треугольной пирамиды EABC.`,
    image_url: svgUrl(pyrMidEdgeSvg()),
    answer: ru(v / 4),
  }
}

// Тетраэдр «верхнее основание + одна вершина нижнего» правильной треугольной призмы:
// основание A₁B₁C₁ площади S, высота — боковое ребро L ⟹ V = S·L/3.
function t03PrismTetraTop() {
  const apex = pick(["A", "B", "C"])
  let s, l
  do { s = randInt(2, 14); l = randInt(2, 14) } while ((s * l) % 3 !== 0)
  const names = `${apex}, A₁, B₁, C₁`
  const text = Math.random() < 0.5
    ? `Найдите объём многогранника, вершинами которого являются точки ${names} правильной треугольной призмы ABCA₁B₁C₁, площадь основания которой равна ${s}, а боковое ребро равно ${l}.`
    : `Дана правильная треугольная призма ABCA₁B₁C₁, площадь основания которой равна ${s}, а боковое ребро равно ${l}. Найдите объём многогранника, вершинами которого являются точки ${names}.`
  return { condition_text: text, image_url: svgUrl(triPrismSvg()), answer: ru(s * l / 3) }
}

// Правильная шестиугольная призма ABCDEFA₁B₁C₁D₁E₁F₁ (ФИПИ): задние вершины E и F
// скрыты — рёбра AF, FE, ED и боковые FF₁, EE₁ штрихом; подписи B₁, C₁, E, F внутри.
function hexPrismSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 270 330" width="270" height="330" font-family="Arial, sans-serif">` +
    `<rect width="270" height="330" fill="#fff"/>` +
    // скрытые рёбра
    `<line x1="40" y1="250" x2="121" y2="219" stroke="#000" stroke-width="1.5" stroke-dasharray="7 5" pathLength="87"/>` +
    `<line x1="121" y1="219" x2="221" y2="219" stroke="#000" stroke-width="1.5" stroke-dasharray="7 5" pathLength="100"/>` +
    `<line x1="221" y1="219" x2="240" y2="250" stroke="#000" stroke-width="1.5" stroke-dasharray="7 5" pathLength="36"/>` +
    `<line x1="121" y1="219" x2="121" y2="104" stroke="#000" stroke-width="1.5" stroke-dasharray="7 5" pathLength="115"/>` +
    `<line x1="221" y1="219" x2="221" y2="104" stroke="#000" stroke-width="1.5" stroke-dasharray="7 5" pathLength="115"/>` +
    // нижнее основание (передняя часть)
    `<line x1="40" y1="250" x2="59" y2="281" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="59" y1="281" x2="159" y2="281" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="159" y1="281" x2="240" y2="250" stroke="#000" stroke-width="1.8"/>` +
    // боковые рёбра
    `<line x1="40" y1="250" x2="40" y2="135" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="59" y1="281" x2="59" y2="166" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="159" y1="281" x2="159" y2="166" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="240" y1="250" x2="240" y2="135" stroke="#000" stroke-width="1.8"/>` +
    // верхнее основание
    `<line x1="40" y1="135" x2="59" y2="166" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="59" y1="166" x2="159" y2="166" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="159" y1="166" x2="240" y2="135" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="240" y1="135" x2="221" y2="104" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="221" y1="104" x2="121" y2="104" stroke="#000" stroke-width="1.8"/>` +
    `<line x1="121" y1="104" x2="40" y2="135" stroke="#000" stroke-width="1.8"/>` +
    // подписи
    `<g font-size="16" font-style="italic" fill="#000" stroke="none" text-anchor="middle">` +
    `<text x="26" y="272">A</text><text x="57" y="305">B</text><text x="159" y="305">C</text>` +
    `<text x="254" y="272">D</text><text x="205" y="243">E</text><text x="110" y="243">F</text>` +
    `<text x="24" y="127">A₁</text><text x="78" y="154">B₁</text><text x="140" y="154">C₁</text>` +
    `<text x="256" y="128">D₁</text><text x="224" y="94">E₁</text><text x="118" y="94">F₁</text>` +
    `</g></svg>`
}

// Координаты правильной шестиугольной призмы с ребром 1.
const HEX_NAMES = ["A", "B", "C", "D", "E", "F"]
const HEX_V = (() => {
  const V = {}
  HEX_NAMES.forEach((n, i) => {
    const a = Math.PI * (3 - i) / 3            // A слева, дальше по кругу B, C, D, E, F
    V[n] = [Math.cos(a), Math.sin(a), 0]
    V[n + "1"] = [Math.cos(a), Math.sin(a), 1]
  })
  return V
})()

// Сторона основания и сторона верхнего основания (непараллельная ей) — угол 60°.
function t03HexPrismAngle() {
  const i = randInt(0, 5)
  const j = (i + pick([1, 2, 4, 5])) % 6       // исключены i (та же) и i+3 (параллельная)
  const p = HEX_NAMES[i], q = HEX_NAMES[(i + 1) % 6]
  const r = HEX_NAMES[j] + "1", s = HEX_NAMES[(j + 1) % 6] + "1"
  return {
    condition_text: `В правильной шестиугольной призме ABCDEFA₁B₁C₁D₁E₁F₁, все рёбра которой равны ${randInt(1, 9)}, найдите угол между прямыми ${vertName(p)}${vertName(q)} и ${vertName(r)}${vertName(s)}. Ответ дайте в градусах.`,
    image_url: svgUrl(hexPrismSvg()),
    answer: ru(linesAngleDeg(HEX_V, p, q, r, s)),
  }
}

// Доля площади основания, занимаемая многоугольником из вершин шестиугольника
// (по координатам, формула площади многоугольника): треугольник из трёх подряд
// идущих вершин — 1/6, трапеция через одну — 2/3.
function hexBaseRatio(names) {
  const P = names.map(n => HEX_V[n])
  let s = 0
  for (let i = 0; i < P.length; i++) {
    const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s / 2) / (3 * Math.sqrt(3) / 2)
}
const hexList = (names) => names.map(vertName).join(", ")

// Призма на трёх подряд идущих вершинах основания: V = S·L/6.
function t03HexPrismTri() {
  const i = randInt(0, 5)
  const base = [0, 1, 2].map(k => HEX_NAMES[(i + k) % 6])
  const names = [...base, ...base.map(n => n + "1")]
  let S, L
  do { S = randInt(2, 14); L = randInt(2, 14) } while ((S * L) % 6 !== 0)
  return {
    condition_text: `Найдите объём многогранника, вершинами которого являются точки ${hexList(names)} правильной шестиугольной призмы ABCDEFA₁B₁C₁D₁E₁F₁, площадь основания которой равна ${S}, а боковое ребро равно ${L}.`,
    image_url: svgUrl(hexPrismSvg()),
    answer: ru(clean(hexBaseRatio(base) * S * L)),
  }
}

// Призма на трапеции из четырёх вершин через одну: V = 2S·L/3.
function t03HexPrismTrap() {
  const i = randInt(0, 5)
  const base = [0, 2, 3, 5].map(k => HEX_NAMES[(i + k) % 6])
  const names = [...base, ...base.map(n => n + "1")]
  let S, L
  do { S = randInt(2, 14); L = randInt(2, 14) } while ((S * L) % 3 !== 0)
  return {
    condition_text: `Найдите объём многогранника, вершинами которого являются вершины ${hexList(names)} правильной шестиугольной призмы ABCDEFA₁B₁C₁D₁E₁F₁, площадь основания которой равна ${S}, а боковое ребро равно ${L}.`,
    image_url: svgUrl(hexPrismSvg()),
    answer: ru(clean(hexBaseRatio(base) * S * L)),
  }
}

// Призма с основаниями ADA₁ и BCB₁ (треугольник ADA₁ ⟂ ребру AB):
// V = (AD·AA₁/2)·AB = AB·AD·AA₁/2.
function t03BoxPrismADA1() {
  let a, b, c
  do { a = randInt(2, 9); b = randInt(2, 9); c = randInt(2, 9) } while ((a * b * c) % 2 !== 0)
  return {
    condition_text: `Найдите объём многогранника, вершинами которого являются точки A, D, A₁, B, C, B₁ прямоугольного параллелепипеда ABCDA₁B₁C₁D₁, у которого AB = ${a}, AD = ${b}, AA₁ = ${c}.`,
    image_url: svgUrl(boxTallSvg()),
    answer: ru(a * b * c / 2),
  }
}

// Площадь боковой поверхности: сечение через среднюю линию делит периметр
// основания пополам (все стороны ×½), высота та же → S_бок отсечённой = S/2.
function t03PrismLateral() {
  const s = 2 * randInt(3, 40)
  return {
    condition_text: `Площадь боковой поверхности треугольной призмы равна ${s}. Через среднюю линию основания призмы проведена плоскость, параллельная боковому ребру. Найдите площадь боковой поверхности отсечённой треугольной призмы.`,
    image_url: svgUrl(prismMidlineSvg()),
    answer: ru(s / 2),
  }
}

// Обратная: боковая поверхность отсечённой призмы — половина исходной ⟹ ×2.
function t03PrismLateralInv() {
  const s = randInt(3, 80)
  return {
    condition_text: `Через среднюю линию основания треугольной призмы проведена плоскость, параллельная боковому ребру. Площадь боковой поверхности отсечённой треугольной призмы равна ${s}. Найдите площадь боковой поверхности исходной призмы.`,
    image_url: svgUrl(prismMidlineSvg()),
    answer: ru(2 * s),
  }
}

// ============================================================================
// Реестр и мета-темы
// ============================================================================

export const GENERATORS_EGE_PROF = {
  1: [t01IsoAngle, t01IsoExt, t01Bisector, t01TwoAltitudes, t01TwoBisectors, t01SineTheorem,
    t01RightMedian, t01RightCevians, t01TwoSidesHeight, t01Midline, t01IsoApexArea,
    t01EquilHeight, t01RightTrig, t01RightTwoLegsTrig, t01RightHypTgLeg, t01IsoHeightTrig,
    t01InscribedArc, t01CentralVsInscribed, t01CentralTri, t01ArcsToACB,
    t01InscQuadOpp, t01InscQuadArc, t01InscTriTwo, t01Diameters,
    t01TangentRadius, t01TangentSecantDiam, t01TwoTangents, t01TwoSecants, t01TangentChord,
    t01TangentialQuad, t01TangTrapMidline, t01RightTrapInradius,
    t01IncircleIsoRadius, t01IncircleIsoPerimeter, t01IncircleRight,
    t01ParMidpoint, t01ParAngle, t01ParHeights,
    t01RhombusSideDiag, t01RhombusAngle, t01TrapMidDiag],
  2: [t02DotCoord, t02DotLenAngle, t02LenCombo, t02DotOfCombos, t02GraphLenCombo],
  3: [t03BoxTetra, t03BoxPyramid, t03BoxPyramidC1, t03BoxPyramidA1, t03BoxPrism, t03BoxTriPrism, t03BoxPrismADA1, t03PrismRightVol, t03PrismRightEdge, t03SqPrismAngle, t03TriPrismAngle, t03HexPrismAngle, t03HexPrismTri, t03HexPrismTrap, t03CylLatHeight, t03CylLatDiameter, t03MugRatio, t03TwoCylindersTaller, t03LiquidWider, t03LiquidNarrower, t03Submerge, t03SubmergeAbs, t03ConeHeight, t03ConeDiameter, t03ConeAxialFromBase, t03ConeAxialFromSlant, t03ConeLatScale, t03ConeLatScaleDown, t03ConeParSect, t03ConeFullSurfSect, t03ConeVessel, t03PrismTetraTop, t03PyrMidEdge, t03PyrSqDiagBD, t03PyrSqDiagSO, t03PyrSqVol, t03PyrSqHeight, t03PyrSqVolHL, t03PyrTriHeight, t03PyrMidSect, t03PyrMidlineCut, t03SqPrismPoly, t03PrismTetra4, t03HexPrismPyr, t03HexPrismTetra, t03PyrHexHeight, t03SphereGreatCircle, t03TwoSpheresSurf, t03TwoSpheresVol, t03SphereSumSurf, t03CubeInSphere, t03CubeInSphereVol, t03CubeInSphereVolPi, t03BoxInSphere, t03SphereInCylSurfInv, t03BoxCylHeight, t03CylCircumPrism, t03StepSolidSurface, t03CylSphereVolInv, t03PrismTetraC1, t03PrismTetraB1, t03PrismPenta, t03PrismMidline, t03PrismCut, t03PrismCutRegular, t03PrismLateral, t03PrismLateralInv, t03CylConeLateral, t03CylConeLatInverse, t03CylConeVolume, t03CylConeVolInverse, t03ConeInSphere, t03ConeInSphereInv, t03ConeSphereRadius, t03ConeSphereSlant, t03SphereInCyl, t03SphereInCylVol, t03TwoCylinders, t03CylInBox, t03CubeCut, t03CubeCutInverse, t03CubeDiagonal, t03CubeAngle, t03BoxDiagonal, t03BoxLineSin, t03BoxSection, t03BoxDiagSection, t03StepSolid, t03LSolid, t03TSolidSurface, t03SphereSection, t03ConeScale, t03ConeHeightScale],
  4: [t04ShotPut, t04Gymnastics, t04Diving, t04Tickets, t04Markers, t04Defect, t04Lottery, t04CoinTwice, t04Rooms, t04FootballCoin],
  5: [t05Lamps, t05Between, t05Shooter4, t05Coffee, t05Battery, t05ShooterN, t05DiceCond, t05TwoThemes, t05Exact],
  // Ключи — номера КИМ-2027; имена функций и gen_key хранят старые номера
  // (t06* — уравнения, ныне №7): на gen_key держится аналитика task_attempts,
  // переименовывать их нельзя.
  7: [t06ExpReduce, t06ExpBothSides, t06ExpSqBase, t06LogEqLog, t06LogEqNum, t06LgEqNum,
    t06LogBaseX, t06LogOfPow, t06LogBaseLin, t06PowLog, t06Rational, t06RecipRecip,
    t06Cube, t06Sqrt, t06CubeRoot, t06SqrtEqX, t06LinMixed, t06SqEqSq, t06SqEqLin],
  8: [t07PowPowDiv, t07PowFracExp, t07PowRatioBase, t07PowProdPow, t07PowFactorize,
    t07PowThreeBases, t07PowDecFrac, t07PowLetter,
    t07SqCoefRoot, t07DistribRoot, t07RootProdDiv, t07RootSqSum, t07RootDiffSq,
    t07RootDegrees, t07RootSameDeg,
    t07TrigDouble, t07TrigTableProd, t07TrigTablePi, t07TrigTableNeg, t07TrigQuarter,
    t07TrigQuarterTg, t07TrigSin2Frac, t07TrigCos2Frac, t07TrigSin2FromCos,
    t07TrigCos2Diff, t07TrigCos2Half, t07TrigCos2Minus, t07TrigSin2Prod, t07TrigReduction,
    t07TrigPeriod, t07TrigCofunc, t07TrigTgTg, t07TrigSin2Cofunc, t07TrigSinSqSum,
    t07LogSum, t07LogDiff, t07LogRatio, t07LogAPowLog, t07LogRatioPowBase, t07LogRecipSum,
    t07LogRootBase, t07LogChain, t07LogKRoot, t07LogFracBaseRoot, t07LogRecipProd],
  // №9 — только производная по ГРАФИКУ (старое №8). Аналитическое исследование
  // функции (старое №12) СНЯТО 31.08.2026 по решению владельца, см. комментарий
  // на месте удалённых генераторов t12*.
  9: [
    () => t8fSignCount(true), () => t8fSignCount(false), () => t8fIntSign(true), () => t8fIntSign(false),
    () => t8fDerivExtreme(true), () => t8fDerivExtreme(false),
    t8fZeroCountAll, t8fZeroPointSeg, t8fZeroCountSeg, t8fHorizTangent,
    () => t8dIncDec(true), () => t8dIncDec(false),
    () => t8dExtremaCount("any"), () => t8dExtremaCount("max"), () => t8dExtremaCount("min"),
    t8dExtremumPoint, () => t8dOptPoint("max"), () => t8dOptPoint("min"),
    () => t8dArgOpt(true), () => t8dArgOpt(false),
    () => t8dDerivEqPoint(0), () => t8dDerivEqPoint(3), t8dDerivEqCount,
    t8tangentSlope, t8kinVelocityAt, t8kinTimeForVelocity, t8tangentParabC,
    () => t8Fsign(true), () => t8Fsign(false), t8FzeroCountSeg, t8integralTwoRays, t8areaGivenF,
  ],
  10: GEN9,
  11: [t10SteamboatSpeed, t10SteamboatCurrent, t10SteamboatDist, t10AvgTime, t10AvgDist, t10TwoCyclists,
    t10Barge, t10BoatCurrent, t10BoatSpeed, t10Meeting, t10TwoBoats, t10Alloy, t10Workers, t10Pipes,
    t10JointWork, t10Weed, t10TrainLength],
  // 13 типажей эталона «Задание11 Графики функций» (см. разбор над t11LinValue).
  12: [t11LinValue, t11QuadRoots, t11QuadInt, t11HypPos, t11HypNeg,
    t11ExpUp, t11ExpDown, t11LogUp, t11LogDown,
    t11TwoLines, t11ParabLineK, t11HypLine, t11RootLineK],
  // Модули части 2 названы по старым номерам (файлы и эталоны fipi_bank_ege_prof
  // тоже лежат под ними): GEN13 — тригонометрия (№14), GEN15 — неравенства (№16),
  // GEN16 — экономическая (теперь №13 ЧАСТИ 1), GEN18 — параметр (№19),
  // GEN19 — теория чисел (№20).
  13: GEN16,
  14: GEN13,
  16: GEN15,
  19: GEN18,
  20: GEN19,
}

export const GEN_META_EGE_PROF = {
  1: [["Треугольник: углы", [
    ["iso-angle", "Равнобедр.: дан угол → другой", t01IsoAngle],
    ["iso-ext", "Равнобедр.: внешний угол", t01IsoExt],
    ["bisector", "Биссектриса: C и CAD → B/ADB", t01Bisector],
    ["two-alt", "Две высоты → угол DOE", t01TwoAltitudes],
    ["two-bis", "Две биссектрисы → угол AOB", t01TwoBisectors],
    ["sine-th", "Теорема синусов → R описанной", t01SineTheorem],
  ]],
    ["Прямоугольный: чевианы из прямого угла", [
      ["right-median", "Медиана CD → ACD", t01RightMedian],
      ["right-cevians", "Угол между высотой/бисс./медианой", t01RightCevians],
    ]],
    ["Треугольник: площади, высоты, стороны", [
      ["two-heights", "2 стороны + высота → высота", t01TwoSidesHeight],
      ["midline", "Средняя линия: S(CDE)/трапеции", t01Midline],
      ["iso-apex-area", "Равнобедр.: угол+боковая → площадь", t01IsoApexArea],
      ["equil-height", "Равносторонний: высота → сторона", t01EquilHeight],
      ["right-trig", "Прямоуг.: сторона+триг → сторона/триг", t01RightTrig],
      ["rt-two-legs", "Прямоуг.: два катета с корнем → sin/cos", t01RightTwoLegsTrig],
      ["rt-hyp-tg", "Прямоуг.: гипотенуза+tg → катет", t01RightHypTgLeg],
      ["iso-h-trig", "Равнобедр.+высота → sin/cos/сторона", t01IsoHeightTrig],
    ]],
    ["Окружность: вписанные и центральные углы", [
      ["insc-arc", "Вписанный угол по дуге", t01InscribedArc],
      ["central-vs-insc", "Центр. на N больше вписанного", t01CentralVsInscribed],
      ["central-tri", "Центр. BOC = 2·BAC", t01CentralTri],
      ["arcs-acb", "Дуги AC,BC → ACB", t01ArcsToACB],
      ["insc-quad-opp", "Вписанный ⬜: противоп. углы", t01InscQuadOpp],
      ["insc-quad-arc", "Вписанный ⬜: ABD,CAD → ABC", t01InscQuadArc],
      ["insc-tri-two", "Два вписанных угла → BCD", t01InscTriTwo],
      ["diameters", "Диаметры AC,BD: ACB ↔ AOD", t01Diameters],
    ]],
    ["Окружность: касательные и секущие", [
      ["tan-radius", "Касательная+секущая: ACO ↔ дуга", t01TangentRadius],
      ["tan-sec-diam", "Секущая через центр → дуга AD", t01TangentSecantDiam],
      ["two-tan", "Две касательные → угол ACB", t01TwoTangents],
      ["two-sec", "Две секущие → угол DAE", t01TwoSecants],
      ["tan-chord", "Касательная+хорда → угол", t01TangentChord],
    ]],
    ["Вписанная / описанная окружность", [
      ["tang-quad", "⬜ с вписанной: сторона/периметр", t01TangentialQuad],
      ["tang-trap", "Трапеция описанная: средняя линия", t01TangTrapMidline],
      ["right-trap-r", "Прямоуг. трапеция описанная → r", t01RightTrapInradius],
      ["inc-iso-r", "Равнобедр. → радиус вписанной", t01IncircleIsoRadius],
      ["inc-iso-p", "Отрезки касания → периметр", t01IncircleIsoPerimeter],
      ["inc-right", "Прямоуг.: катеты → r", t01IncircleRight],
    ]],
    ["Параллелограмм / ромб / трапеция", [
      ["par-mid", "Параллелограмм: середина → площадь", t01ParMidpoint],
      ["par-angle", "Параллелограмм: разность углов", t01ParAngle],
      ["par-heights", "Параллелограмм: 2 стороны+высота", t01ParHeights],
      ["rhomb-sidediag", "Ромб: сторона+диагональ → угол", t01RhombusSideDiag],
      ["rhomb-angle", "Ромб: угол → ACB/BDC", t01RhombusAngle],
      ["trap-mid-diag", "Трапеция: диагональ и средняя линия", t01TrapMidDiag],
    ]]],
  2: [["Скалярное произведение", [
    ["dot-coord", "По координатам", t02DotCoord],
    ["dot-angle", "По длинам и углу 60°", t02DotLenAngle],
    ["dot-combos", "Двух комбинаций", t02DotOfCombos],
  ]],
    ["Длина вектора", [
      ["len-combo", "Длина a±kb (координаты в тексте)", t02LenCombo],
      ["len-graph", "Длина m·a+n·b (по чертежу)", t02GraphLenCombo],
    ]]],
  3: [["Параллелепипед: объём части", [
    ["box-tetra", "Тетраэдр A,B,C,B₁ (÷6)", t03BoxTetra],
    ["box-pyramid", "Пирамида A,B,C,D,B₁ (S·h/3)", t03BoxPyramid],
    ["box-pyramid-c1", "Пирамида A,B,C,D,C₁ (S·h/3)", t03BoxPyramidC1],
    ["box-pyramid-a1", "Пирамида A,B,C,D,A₁ (S·h/3)", t03BoxPyramidA1],
    ["box-prism", "Призма A,B,C,D,A₁,B₁ (÷2)", t03BoxPrism],
    ["box-tri-prism", "Призма A,B,C,A₁,B₁,C₁ (÷2)", t03BoxTriPrism],
    ["box-prism-ada1", "Призма A,D,A₁,B,C,B₁ (÷2)", t03BoxPrismADA1],
  ]],
    ["Правильная призма: объём части", [
      ["prism-tetra-c1", "Тетраэдр A,B,C,C₁ (S·L/3)", t03PrismTetraC1],
      ["prism-tetra-b1", "Тетраэдр A,B,C,B₁ (S·L/3)", t03PrismTetraB1],
      ["prism-tetra-top", "Тетраэдр A₁,B₁,C₁ + нижняя вершина (S·L/3)", t03PrismTetraTop],
      ["prism-tetra-4", "Тетраэдр: две нижние + две верхние (S·L/3)", t03PrismTetra4],
      ["prism-penta", "Тело B,C,A₁,B₁,C₁ (2S·L/3)", t03PrismPenta],
    ]],
    ["Пирамида", [
      ["pyr-mid-edge", "Середина бокового ребра: V треугольной пирамиды (÷4)", t03PyrMidEdge],
      ["pyr-sq-diag-bd", "SO + SD → диагональ основания BD", t03PyrSqDiagBD],
      ["pyr-sq-diag-so", "SD + AC → высота SO", t03PyrSqDiagSO],
      ["pyr-sq-vol", "Боковое ребро + сторона k√2 → объём", t03PyrSqVol],
      ["pyr-sq-height", "4-угольная: ребро + сторона → высота", t03PyrSqHeight],
      ["pyr-sq-vol-hl", "4-угольная: высота + ребро → объём", t03PyrSqVolHL],
      ["pyr-tri-height", "Треугольная: ребро + сторона → высота", t03PyrTriHeight],
      ["pyr-hex-height", "6-угольная: ребро + сторона → высота", t03PyrHexHeight],
      ["pyr-mid-sect", "Сечение через середины боковых рёбер (a²/4)", t03PyrMidSect],
      ["pyr-midline-cut", "Плоскость через вершину и среднюю линию (÷4)", t03PyrMidlineCut],
    ]],
    ["Правильная 4-угольная призма", [
      ["sqprism-poly", "Три вершины основания + две верхние (S·L/3)", t03SqPrismPoly],
    ]],
    ["Прямая призма: прямоугольный треугольник", [
      ["prism-rt-vol", "Катеты + боковое ребро → объём", t03PrismRightVol],
      ["prism-rt-edge", "Катеты + объём → боковое ребро", t03PrismRightEdge],
    ]],
    ["Правильная призма: углы", [
      ["sqprism-angle", "4-угольная: угол между диагоналями (60°)", t03SqPrismAngle],
      ["triprism-angle", "Треугольная: ребро и диагональ грани (45°)", t03TriPrismAngle],
      ["hexprism-angle", "6-угольная: угол между сторонами (60°)", t03HexPrismAngle],
    ]],
    ["Шестиугольная призма: объём части", [
      ["hexprism-tri", "Три подряд вершины (S·L/6)", t03HexPrismTri],
      ["hexprism-trap", "Трапеция через одну (2S·L/3)", t03HexPrismTrap],
      ["hexprism-pyr", "Пирамида: основание + вершина (S·L/3)", t03HexPrismPyr],
      ["hexprism-tetra", "Тетраэдр: 3 подряд + вершина (S·L/18)", t03HexPrismTetra],
    ]],
    ["Треугольная призма: сечение", [
      ["prism-midline", "Средняя линия основания → объём (×4)", t03PrismMidline],
      ["prism-cut", "Средняя линия основания → отсечённая (÷4)", t03PrismCut],
      ["prism-cut-reg", "Правильная призма: отсечённая (÷4)", t03PrismCutRegular],
      ["prism-lateral", "Средняя линия основания → S бок. (÷2)", t03PrismLateral],
      ["prism-lateral-inv", "S бок. отсечённой → S бок. исходной (×2)", t03PrismLateralInv],
    ]],
    ["Тела вращения", [
      ["cyl-cone-lat", "Цилиндр и конус (h=R): S бок. цилиндра (×2)", t03CylConeLateral],
      ["cyl-cone-lat-inv", "Цилиндр и конус (h=R): S бок. конуса", t03CylConeLatInverse],
      ["cyl-cone-vol", "Цилиндр и конус: объём конуса (÷3)", t03CylConeVolume],
      ["cyl-cone-vol-inv", "Цилиндр и конус: объём цилиндра (×3)", t03CylConeVolInverse],
      ["cone-in-sphere", "Конус в шаре: объём шара (×4)", t03ConeInSphere],
      ["cone-in-sphere-inv", "Конус в шаре: объём конуса (÷4)", t03ConeInSphereInv],
      ["cone-sph-radius", "Сфера около конуса: радиус сферы", t03ConeSphereRadius],
      ["cone-sph-slant", "Сфера около конуса: образующая", t03ConeSphereSlant],
      ["sphere-in-cyl", "Шар в цилиндре: S поверхности (⅔)", t03SphereInCyl],
      ["sphere-in-cyl-vol", "Шар в цилиндре: объём цилиндра (×1,5)", t03SphereInCylVol],
      ["cyl-sphere-vol-inv", "Объём цилиндра → объём шара (×⅔)", t03CylSphereVolInv],
      ["sphere-in-cyl-surf-inv", "S шара → S полн. цилиндра (×1,5)", t03SphereInCylSurfInv],
      ["sph-section", "Сечение шара через центр: S пов. (×4)", t03SphereSection],
      ["sph-great-circle", "S поверхности → большой круг (÷4)", t03SphereGreatCircle],
      ["two-sph-surf", "Два шара: во сколько раз S больше (k²)", t03TwoSpheresSurf],
      ["two-sph-vol", "Два шара: во сколько раз V больше (k³)", t03TwoSpheresVol],
      ["sph-sum-surf", "Радиус шара с суммарной поверхностью (√)", t03SphereSumSurf],
      ["cube-insphere", "Куб около сферы радиуса R (8R³)", t03CubeInSphere],
      ["cube-insphere-vol", "Шар объёма kπ в кубе → объём куба (6k)", t03CubeInSphereVol],
      ["cube-insphere-volpi", "Куб с ребром a → объём шара ÷π (a³/6)", t03CubeInSphereVolPi],
      ["box-insphere", "Параллелепипед около сферы (8R³)", t03BoxInSphere],
      ["two-cyl", "Два цилиндра: объём второго (b²/a)", t03TwoCylinders],
      ["two-cyl-taller", "Два цилиндра: выше и уже (a/b²)", t03TwoCylindersTaller],
      ["cyl-in-box", "Цилиндр в параллелепипеде (4R²h)", t03CylInBox],
      ["box-cyl-height", "Объём параллелепипеда + радиус → высота", t03BoxCylHeight],
      ["cyl-circum-prism", "Цилиндр около прямой призмы (k(a²+b²)/4)", t03CylCircumPrism],
      ["cyl-lat-h", "S бок. + диаметр → высота цилиндра", t03CylLatHeight],
      ["cyl-lat-d", "S бок. + высота → диаметр основания", t03CylLatDiameter],
      ["mug-ratio", "Две кружки: отношение объёмов (k²/2)", t03MugRatio],
      ["liquid-wider", "Перелив в сосуд шире (уровень ÷k²)", t03LiquidWider],
      ["liquid-narrower", "Перелив в сосуд уже (уровень ×k²)", t03LiquidNarrower],
      ["submerge", "Погружение детали: уровень ×k → объём", t03Submerge],
      ["submerge-abs", "Погружение детали: уровень +Δh → объём", t03SubmergeAbs],
      ["cone-height", "Конус: диаметр + образующая → высота", t03ConeHeight],
      ["cone-diameter", "Конус: высота + образующая → диаметр", t03ConeDiameter],
      ["cone-axial-base", "Конус: S осн. + высота → S осевого сечения", t03ConeAxialFromBase],
      ["cone-axial-slant", "Конус: высота + образующая → S осевого сечения", t03ConeAxialFromSlant],
      ["cone-lat-scale", "Образующая ×k → S бок. ×k", t03ConeLatScale],
      ["cone-lat-scale-down", "Радиус ÷k → S бок. ÷k", t03ConeLatScaleDown],
      ["cone-par-sect", "Сечение ∥ основанию → площадь сечения (k²)", t03ConeParSect],
      ["cone-fullsurf-sect", "S полн. отсечённого конуса (k²)", t03ConeFullSurfSect],
      ["cone-vessel", "Сосуд-конус: сколько долить (k³)", t03ConeVessel],
      ["cone-scale", "Радиус конуса ×k → объём ×k²", t03ConeScale],
      ["cone-h-scale", "Высота конуса ÷k → объём ÷k", t03ConeHeightScale],
    ]],
    ["Куб: объём, сечения, углы", [
      ["cube-cut", "Призма, отсечённая от куба (÷8)", t03CubeCut],
      ["cube-cut-inv", "Отсечённая призма → объём куба (×8)", t03CubeCutInverse],
      ["cube-diag", "Диагональ куба → объём", t03CubeDiagonal],
      ["cube-angle", "Угол между прямыми в кубе", t03CubeAngle],
    ]],
    ["Параллелепипед: диагонали, углы, сечения", [
      ["box-diag", "Диагональ параллелепипеда AC₁", t03BoxDiagonal],
      ["box-line-sin", "Синус угла между DD₁ и B₁C", t03BoxLineSin],
      ["box-section", "Сечение через A, B, C₁ (AB·√(AD²+AA₁²))", t03BoxSection],
      ["box-diag-section", "Сечение через B, B₁, D (AA₁·√(AB²+AD²))", t03BoxDiagSection],
    ]],
    ["Составные многогранники (углы прямые)", [
      ["step-solid", "Ступенчатый: объём", t03StepSolid],
      ["step-solid-surf", "Ступенчатый: площадь поверхности", t03StepSolidSurface],
      ["l-solid", "Г-образный: объём", t03LSolid],
      ["t-solid-surf", "Т-образный: площадь поверхности", t03TSolidSurface],
    ]]],
  4: [["Жребий / порядок", [
    ["shot-put", "Толкание ядра (4 страны)", t04ShotPut],
    ["gymnastics", "Гимнастика («остальные»)", t04Gymnastics],
    ["diving", "Прыжки в воду (n-й)", t04Diving],
    ["lottery", "Жребий / вертолёт", t04Lottery],
    ["rooms", "Олимпиада (запасная ауд.)", t04Rooms],
  ]],
    ["Классическая", [
      ["tickets", "Билеты по теме", t04Tickets],
      ["markers", "Фломастеры (синий+красный)", t04Markers],
      ["defect", "Брак / дефект", t04Defect],
    ]],
    ["Монета", [
      ["coin-twice", "Монета дважды", t04CoinTwice],
      ["football", "Монетка на T матчей", t04FootballCoin],
    ]]],
  5: [["Независимые события", [
    ["lamps", "Три лампы (1−p³)", t05Lamps],
    ["shooter4", "Стрелок, 4 мишени", t05Shooter4],
    ["battery", "Батарейки (контроль)", t05Battery],
    ["shooter-n", "Стрелок до поражения", t05ShooterN],
  ]],
    ["Сложение / вычитание вероятностей", [
      ["between", "Масса/пассажиры между", t05Between],
      ["coffee", "Два автомата кофе", t05Coffee],
      ["two-themes", "Две несовместные темы", t05TwoThemes],
      ["exact", "Ровно k задач", t05Exact],
    ]],
    ["Условная", [["dice-cond", "Кость дважды (условие)", t05DiceCond]]]],
  7: [["Показательные", [
    ["exp-reduce", "Свести к основанию", t06ExpReduce],
    ["exp-both", "Обе части — степени", t06ExpBothSides],
    ["exp-sqbase", "Основание-степень: 36^(x−s)=1/6", t06ExpSqBase],
  ]],
    ["Логарифмические", [
      ["log-log", "log=log", t06LogEqLog],
      ["log-num", "log=число", t06LogEqNum],
      ["lg-num", "lg(f)=k", t06LgEqNum],
      ["log-base-x", "Неизвестное основание logₓN=k", t06LogBaseX],
      ["log-of-pow", "log_{aᵐ}a^(px+q)=k", t06LogOfPow],
      ["log-base-lin", "Основание x−s: log_(x−s)N=2", t06LogBaseLin],
      ["pow-log", "a^(log_{aᵏ}f)=m", t06PowLog],
    ]],
    ["Корни и степени", [
      ["cube", "Степенное (x+s)ⁿ=V", t06Cube],
      ["sqrt", "Квадратный корень", t06Sqrt],
      ["cube-root", "Кубический корень", t06CubeRoot],
      ["sqrt-eq-x", "√(b+ax)=x", t06SqrtEqX],
    ]],
    ["Алгебраические", [
      ["lin-mixed", "(p/q)x = смешанное число", t06LinMixed],
      ["sq-eq-sq", "(ax−b)²=(ax−c)²", t06SqEqSq],
      ["sq-eq-lin", "(x+a)²=4ax", t06SqEqLin],
    ]],
    ["Дробно-рациональные", [
      ["rational", "1/(ax+b)=c", t06Rational],
      ["recip-recip", "1/(ax+b)=1/(cx+d)", t06RecipRecip],
    ]]],
  8: [["Степени", [
    ["pow-div", "Степень степени (частное)", t07PowPowDiv],
    ["pow-frac", "Дробные показатели", t07PowFracExp],
    ["pow-ratio-base", "81^a / 9^b — основания одной степени", t07PowRatioBase],
    ["pow-prod-pow", "(A^p·B^q)^N / (AB)^M", t07PowProdPow],
    ["pow-factorize", "A^a·B^b / (AB)^c", t07PowFactorize],
    ["pow-three", "(AB)^x · P^y : Q^z", t07PowThreeBases],
    ["pow-decfrac", "0,75^(1/8)·4^(1/4)·12^(7/8)", t07PowDecFrac],
    ["pow-letter", "a^p/(a^q·a^r) при a=…", t07PowLetter],
  ]],
    ["Корни", [
      ["sq-coef-root", "((k√A)²)/D", t07SqCoefRoot],
      ["distrib-root", "(√A−√B)·√c", t07DistribRoot],
      ["root-proddiv", "√x·√y/√z", t07RootProdDiv],
      ["root-sqsum", "(√a+√b)²/(s+m√ab)", t07RootSqSum],
      ["root-diffsq", "√(m²−n²)", t07RootDiffSq],
      ["root-degrees", "Корни разных степеней", t07RootDegrees],
      ["root-samedeg", "Корни одной степени", t07RootSameDeg],
    ]],
    ["Логарифмы", [
      ["log-sum", "Сумма логарифмов", t07LogSum],
      ["log-diff", "Разность логарифмов", t07LogDiff],
      ["log-ratio", "Отношение логарифмов", t07LogRatio],
      ["log-apowlog", "a^(log_a m) + …", t07LogAPowLog],
      ["log-ratio-pow", "log_{aᵖ}N / log_{aᑫ}N", t07LogRatioPowBase],
      ["log-recip-sum", "log_cA/log_cB + log_B(1/D)", t07LogRecipSum],
      ["log-rootbase", "log_{ⁿ√a}a", t07LogRootBase],
      ["log-chain", "log_a b · log_b c", t07LogChain],
      ["log-kroot", "k·log_a(ⁿ√a)", t07LogKRoot],
      ["log-fracbase", "log_{1/a}√a", t07LogFracBaseRoot],
      ["log-recip-prod", "k·log_b A · log_A(1/b)", t07LogRecipProd],
    ]],
    ["Тригонометрия", [
      ["trig-double", "Двойной угол cos2α", t07TrigDouble],
      ["trig-table", "k·sinA·cosB (табличные)", t07TrigTableProd],
      ["trig-table-pi", "k√m·tg(π/a)·sin(π/b)", t07TrigTablePi],
      ["trig-table-neg", "k√m·cos(−225°)", t07TrigTableNeg],
      ["trig-quarter", "cosα по sinα и промежутку", t07TrigQuarter],
      ["trig-quarter-tg", "tgα по sinα/cosα", t07TrigQuarterTg],
      ["trig-sin2-frac", "k·sinA·cosA/sin2A", t07TrigSin2Frac],
      ["trig-cos2-frac", "k(sin²A−cos²A)/cos2A", t07TrigCos2Frac],
      ["trig-sin2-cos", "sin2α по cosα", t07TrigSin2FromCos],
      ["trig-cos2-diff", "k·cos²x − k·sin²x", t07TrigCos2Diff],
      ["trig-cos2-half", "2B·cos²x − B", t07TrigCos2Half],
      ["trig-cos2-minus", "B − 2B·sin²x", t07TrigCos2Minus],
      ["trig-sin2-prod", "k·sinx·cosx", t07TrigSin2Prod],
      ["trig-reduction", "Формулы приведения", t07TrigReduction],
      ["trig-period", "k·sin(A+360°)/sinA", t07TrigPeriod],
      ["trig-cofunc", "k·cosA/sin(90°−A) ± c", t07TrigCofunc],
      ["trig-tgtg", "k·tgA·tg(90°−A) + c", t07TrigTgTg],
      ["trig-sin2-cofunc", "k·sin2A/(cosA·cos(90°−A))", t07TrigSin2Cofunc],
      ["trig-sinsq-sum", "N/(sin²A+c+sin²(A+90°))", t07TrigSinSqSum],
    ]]],
  9: [["График f(x): знак производной", [
    ["f-pos", "Сколько точек f′>0", () => t8fSignCount(true)],
    ["f-neg", "Сколько точек f′<0", () => t8fSignCount(false)],
    ["f-int-pos", "Целые точки f′>0", () => t8fIntSign(true)],
    ["f-int-neg", "Целые точки f′<0", () => t8fIntSign(false)],
    ["f-dmax", "Где f′ наибольшее", () => t8fDerivExtreme(true)],
    ["f-dmin", "Где f′ наименьшее", () => t8fDerivExtreme(false)],
  ]],
    ["График f(x): нули f′ / экстремумы", [
      ["f-zero-all", "Количество точек f′=0", t8fZeroCountAll],
      ["f-zero-pt", "Точка f′=0 на отрезке", t8fZeroPointSeg],
      ["f-zero-seg", "Число решений f′=0 на отрезке", t8fZeroCountSeg],
      ["f-horiz", "Касательная ∥ горизонтали", t8fHorizTangent],
    ]],
    ["График f′(x): возрастание / убывание f", [
      ["d-inc", "Точки на возрастании f", () => t8dIncDec(true)],
      ["d-dec", "Точки на убывании f", () => t8dIncDec(false)],
    ]],
    ["График f′(x): экстремумы f", [
      ["d-ext-cnt", "Число экстремумов на отрезке", () => t8dExtremaCount("any")],
      ["d-max-cnt", "Число максимумов на отрезке", () => t8dExtremaCount("max")],
      ["d-min-cnt", "Число минимумов на отрезке", () => t8dExtremaCount("min")],
      ["d-ext-pt", "Точка экстремума на отрезке", t8dExtremumPoint],
      ["d-max-pt", "Точка максимума f", () => t8dOptPoint("max")],
      ["d-min-pt", "Точка минимума f", () => t8dOptPoint("min")],
    ]],
    ["График f′(x): наиб./наим. значение f", [
      ["d-argmax", "Точка наиб. значения f", () => t8dArgOpt(true)],
      ["d-argmin", "Точка наим. значения f", () => t8dArgOpt(false)],
    ]],
    ["График f′(x): касательная ∥ прямой", [
      ["d-eq0", "f′=0: абсцисса", () => t8dDerivEqPoint(0)],
      ["d-eqk", "f′=k: абсцисса", () => t8dDerivEqPoint(3)],
      ["d-eqk-cnt", "f′=k: количество точек", t8dDerivEqCount],
    ]],
    ["Касательная на графике f(x)", [
      ["tan-slope", "Значение f′(x₀) по касательной", t8tangentSlope],
    ]],
    ["Физический смысл производной", [
      ["kin-v", "Скорость v(t₀)", t8kinVelocityAt],
      ["kin-t", "Момент, когда v=V", t8kinTimeForVelocity],
    ]],
    ["Касательная (аналитически)", [
      ["tan-parab", "Прямая касается параболы: найти c", t8tangentParabC],
    ]],
    ["График первообразной F(x)", [
      ["F-pos", "Сколько точек f>0", () => t8Fsign(true)],
      ["F-neg", "Сколько точек f<0", () => t8Fsign(false)],
      ["F-zero", "Число решений f=0 на отрезке", t8FzeroCountSeg],
    ]],
    ["Первообразная и площадь", [
      ["rays", "F(β)−F(α) по ломаной", t8integralTwoRays],
      ["area", "Площадь по первообразной", t8areaGivenF],
    ]]],
  10: META9,
  11: [["Движение по воде", [
    ["steam-speed", "Теплоход: скорость в воде", t10SteamboatSpeed],
    ["steam-current", "Теплоход: скорость течения", t10SteamboatCurrent],
    ["steam-dist", "Теплоход: путь за рейс", t10SteamboatDist],
    ["boat-current", "Лодка: течение", t10BoatCurrent],
    ["boat-speed", "Лодка: скорость в воде", t10BoatSpeed],
    ["barge", "Баржа (обратно +1 км/ч)", t10Barge],
  ]],
    ["Движение по суше", [
      ["avg-time", "Средняя скорость (время)", t10AvgTime],
      ["avg-dist", "Средняя скорость (расстояние)", t10AvgDist],
      ["cyclists", "Два велосипедиста", t10TwoCyclists],
      ["meeting", "Встречное движение", t10Meeting],
      ["two-boats", "Два теплохода (вдогонку)", t10TwoBoats],
      ["train-len", "Длина поезда", t10TrainLength],
    ]],
    ["Работа и смеси", [
      ["alloy", "Сплавы (медь)", t10Alloy],
      ["workers", "Рабочие (детали)", t10Workers],
      ["pipes", "Трубы (резервуар)", t10Pipes],
      ["joint", "Совместная работа", t10JointWork],
      ["weed", "Прополка грядки", t10Weed],
    ]]],
  // 13 типажей эталона ФИПИ «Задание11 Графики функций» (старые gen_key сохранены).
  12: [["Чтение значения f(x₀)", [
    ["lin-val", "Линейная kx+b", t11LinValue],
    ["quad-read", "Парабола ax²+bx+c (по корням)", t11QuadRoots],
    ["quad-int", "Парабола с целыми a, b, c", t11QuadInt],
    ["hyp-basic", "Гипербола k/x, k>0", t11HypPos],
    ["hyp-neg", "Гипербола k/x, k<0", t11HypNeg],
    ["exp-val", "Показательная aˣ, a>1", t11ExpUp],
    ["exp-down", "Показательная aˣ, 0<a<1", t11ExpDown],
    ["log-val", "Логарифм logₐx, a>1", t11LogUp],
    ["log-down", "Логарифм logₐx, 0<a<1", t11LogDown],
  ]],
    ["Пересечения графиков", [
      ["2lines-x", "Две прямые: абсцисса A", t11TwoLines],
      ["par-kx", "Парабола + g=kx: абсцисса B", t11ParabLineK],
      ["hyp-line-x", "Гипербола + g=ax+b: абсцисса B", t11HypLine],
      ["root-kx", "Корень + g=kx: абсцисса B", t11RootLineK],
    ]]],
  13: META16,
  14: META13,
  16: META15,
  19: META18,
  20: META19,
}
