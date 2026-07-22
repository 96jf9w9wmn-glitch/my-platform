// Генераторы ЕГЭ математика (ПРОФИЛЬНЫЙ уровень) — предмет «ЕГЭ Профиль».
//
// Эталон типажей — открытый банк ФИПИ (fipi_bank_ege_prof/tasks.json). Каждый шаблон
// воспроизводит реальный тип задания банка (та же формулировка, свои числа); правильный
// ответ считается кодом (или РЕШАЕТСЯ из показанных чисел), поэтому гарантированно верен.
//
// Этап 1 — задания без чертежей (номера 2,4,5,6,7,9,10,12) + №3 стереометрия
// со СВОИМИ SVG-чертежами тел (эталон — 49 задач банка ФИПИ, Задание 3).
// №1 планиметрия без чертежа не бывает → пока не входит.
// Формат объекта генератора: { condition_text, answer }.
// Мат-токены: дробь ⟦f:n:d⟧, корень ⟦r:x⟧, индекс ⟦b:x⟧, надстрочник ⟦sup:x⟧ — разворачивает
// renderTaskMath(). Юникод-степени ² ³ — через sup().

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

// Подпись вектора (буква + стрелка над ней) у середины, сдвинута по нормали.
function vecLabel(letter, mx, my, vx, vy) {
  const L = Math.hypot(vx, vy) || 1
  const off = 15
  const lx = clean(mx - (vy / L) * off), ly = clean(my - (vx / L) * off)
  return `<text x="${lx}" y="${ly}" ${HALO} font-size="17" font-style="italic" font-weight="bold" fill="#1c1c1e" text-anchor="middle">${letter}</text>` +
    `<line x1="${lx - 5}" y1="${ly - 19}" x2="${lx + 6}" y2="${ly - 19}" stroke="#1c1c1e" stroke-width="1.3"/>` +
    `<polygon points="${lx + 7},${ly - 19} ${lx + 2},${ly - 21.4} ${lx + 2},${ly - 16.6}" fill="#1c1c1e"/>`
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
  g += vecLabel("a", (X(atx) + X(atx + ax)) / 2, (Y(aty) + Y(aty + ay)) / 2, ax, ay)
  g += vecLabel("b", (X(btx) + X(btx + bx)) / 2, (Y(bty) + Y(bty + by)) / 2, bx, by)
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
  } while (![0, 1, 2, 3].some((j) => isTerm(n[j], total)))
  const i = pick([0, 1, 2, 3].filter((j) => isTerm(n[j], total)))
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
  } while (rest < 3 || !isTerm(rest, total))
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
  do { total = randInt(20, 75); c1 = randInt(3, 24); c2 = randInt(3, 24) } while (c1 + c2 >= total || !isTerm(c1, total))
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
  let n, k; do { n = randInt(20, 60); k = randInt(3, n - 3) } while (!isTerm(k, n))
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
  let c, x0, q, e0, bexp
  let guard = 0
  do {
    c = pick([1, -1]); x0 = randInt(-6, 6); q = randInt(-6, 6)
    e0 = c * x0 + q                            // значение показателя при x0
    bexp = baseSign * e0                       // степень основания b в правой части
    guard++
  } while ((bexp === 0 || Math.abs(bexp) > 3 || b ** Math.abs(bexp) > 999) && guard < 200)
  const expr = c === 1
    ? `x${signed(q)}`.replace("+0", "").replace("−0", "")
    : `${ru(q)}−x`                                // c=−1 → «q−x» (вид ФИПИ: 2−x, −4−x)
  const baseStr = frac ? `(${fT(1, b)})` : String(b)   // дробь-основание в степени — в скобках
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
  const leftBase = sL === -1 ? `(${fT(1, b)})` : String(b)   // дробь-основание в степени — в скобках
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

// Кубическое: (x+s)³=V, V=±m³.
function t06Cube() {
  const s = randInt(-9, 9)
  const m = randInt(2, 6)
  const neg = Math.random() < 0.5
  const V = neg ? -(m ** 3) : m ** 3
  const x0 = -s + (neg ? -m : m)
  return {
    condition_text: `Найдите корень уравнения (x${signed(s)})${sup(3)}=${ru(V)}.`.replace("(x+0)", "(x)"),
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

// ============================================================================
// №9 — ПРИКЛАДНЫЕ ЗАДАЧИ (физические формулы → решить относительно величины)
// ============================================================================
const minPlural = (n) => (n % 10 === 1 && n % 100 !== 11 ? "минуту" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "минуты" : "минут")

// Разгон мотоциклиста: S=v₀t+at²/2, найти t (в минутах).
function t09MotoAccel() {
  let v0, a, th, S, min, g = 0
  do {
    v0 = pick([60, 70, 80, 90]); a = pick([16, 18, 32, 24, 40])
    th = pick([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2])
    S = v0 * th + a * th * th / 2; min = th * 60
    g++
  } while ((!Number.isInteger(S) || !Number.isInteger(min)) && g < 300)
  return {
    condition_text: `Мотоциклист, движущийся по городу со скоростью v₀=${v0} км/ч, выезжает из него и сразу после выезда начинает разгоняться с постоянным ускорением a=${a} км/ч². Расстояние (в км) от мотоциклиста до города вычисляется по формуле S=v₀t+${fT("at²", 2)}, где t — время (в часах), прошедшее после выезда из города. Определите время, прошедшее после выезда мотоциклиста из города, если известно, что за это время он удалился от города на ${S} км. Ответ дайте в минутах.`,
    answer: ru(min),
  }
}
// Разгон автомобиля v=√(2la): найти путь l по скорости.
function t09CarDist() {
  const a = pick([2500, 3500, 4500, 9000, 32000, 8000, 4000])
  const v = pick([50, 60, 70, 80, 90, 120, 160])
  const l = clean(v * v / (2 * a))
  if (!Number.isInteger(l * 100) || l <= 0 || l > 5) return t09CarDist()
  return {
    condition_text: `Автомобиль разгоняется на прямолинейном участке шоссе с постоянным ускорением a=${a} км/ч². Скорость v (в км/ч) вычисляется по формуле v=${rT("2la")}, где l — пройденный автомобилем путь (в км). Найдите, сколько километров проедет автомобиль к моменту, когда он разгонится до скорости ${v} км/ч.`,
    answer: ru(l),
  }
}
// Разгон автомобиля v=√(2la): найти ускорение a по пути и скорости.
function t09CarAcc() {
  const l = pick([0.3, 0.4, 0.5, 1])
  const v = pick([70, 80, 120])
  const a = clean(v * v / (2 * l))
  if (!Number.isInteger(a)) return t09CarAcc()
  return {
    condition_text: `Автомобиль разгоняется на прямолинейном участке шоссе с постоянным ускорением a (в км/ч²). Скорость v (в км/ч) вычисляется по формуле v=${rT("2la")}, где l — пройденный автомобилем путь (в км). Найдите ускорение, с которым должен двигаться автомобиль, чтобы, проехав ${ru(l)} км, развить скорость ${v} км/ч. Ответ дайте в км/ч².`,
    answer: ru(a),
  }
}
// Линия горизонта l=√(2Rh), R=6400 — найти высоту h.
function t09Horizon() {
  const R = 6400
  const l = pick([48, 80, 16, 32, 40, 8])
  const h = clean(l * l / (2 * R))
  return {
    condition_text: `Расстояние от наблюдателя, находящегося на небольшой высоте h (в километрах) над землёй, до наблюдаемой им линии горизонта вычисляется по формуле l=${rT("2Rh")}, где R=${R} км — радиус Земли. С какой высоты горизонт виден на расстоянии ${l} километров? Ответ дайте в километрах.`,
    answer: ru(h),
  }
}
// Радиоактивный распад m=m₀·2^(−t/T): найти время.
function t09Decay() {
  const T = pick([2, 4, 8, 10, 5])
  const n = randInt(2, 4)
  const m = pick([5, 12.5, 39, 49, 25])
  const m0 = clean(m * 2 ** n)
  const t = T * n
  if (!Number.isInteger(m0) && !Number.isInteger(m0 * 10)) return t09Decay()
  return {
    condition_text: `В ходе распада радиоактивного изотопа его масса m (в мг) уменьшается по закону m=m₀·2${supT("−t/T")}, где m₀ — начальная масса изотопа (в мг), t — время (в минутах), прошедшее от начального момента, T — период полураспада (в минутах). В начальный момент времени масса изотопа ${ru(m0)} мг. Период его полураспада составляет ${T} ${minPlural(T)}. Найдите, через сколько минут масса изотопа будет равна ${ru(m)} мг.`,
    answer: ru(t),
  }
}
// Намотка кабеля φ=ωt+βt²/2 — найти время (квадратное).
function t09Winding() {
  let w, b, t, phi, g = 0
  do { w = pick([15, 50, 30, 20]); b = pick([4, 6, 8]); t = randInt(10, 40); phi = w * t + b * t * t / 2; g++ } while (!Number.isInteger(phi) && g < 100)
  return {
    condition_text: `Для сматывания кабеля на заводе используют лебёдку, которая равноускоренно наматывает кабель на катушку. Угол, на который поворачивается катушка, изменяется со временем по закону φ=ωt+${fT("βt²", 2)}, где t — время в минутах, ω=${w} град./мин — начальная угловая скорость, β=${b} град./мин² — угловое ускорение. Определите время, прошедшее после начала работы лебёдки, если за это время угол намотки φ достиг ${phi}°. Ответ дайте в минутах.`,
    answer: ru(t),
  }
}
// Мяч h(t)=h₀+vt−5t², «не менее H метров» — длительность интервала (t₂−t₁).
function t09Ball() {
  let h0, v, H, t1, t2, g = 0
  do {
    v = pick([9, 13, 11, 15, 17]); h0 = pick([1.4, 1.6, 1.2]); H = randInt(3, 7)
    // 5t²−vt+(H−h0)=0
    const A = 5, B = -v, C = H - h0
    const D = B * B - 4 * A * C
    if (D <= 0) { g++; continue }
    const s = Math.sqrt(D)
    t1 = (-B - s) / (2 * A); t2 = (-B + s) / (2 * A)
    g++
    if (t1 > 0 && Number.isInteger(clean(t2 - t1))) break
  } while (g < 400)
  return {
    condition_text: `Высота над землёй подброшенного вверх мяча меняется по закону h(t)=${ru(h0)}+${v}t−5t², где h — высота в метрах, t — время в секундах, прошедшее с момента броска. Сколько секунд мяч будет находиться на высоте не менее ${H} метров?`,
    answer: ru(clean(t2 - t1)),
  }
}
// Нагреватель T(t)=T₀+bt+at² (a<0) — наибольшее t, когда T=Tmax.
function t09Heater() {
  let T0, b, a, Tmax, t, g = 0
  do {
    a = pick([-5, -15, -10]); b = pick([105, 165, 120, 150]); T0 = pick([1600, 1380, 1500])
    t = randInt(4, 30)
    Tmax = T0 + b * t + a * t * t
    g++
  } while ((Tmax <= T0 || Tmax % 1 !== 0) && g < 300)
  return {
    condition_text: `Для нагревательного элемента некоторого прибора получена зависимость температуры (в К) от времени работы: T(t)=T₀+bt+at², где t — время (в мин.), T₀=${T0} К, a=${ru(a)} К/мин², b=${b} К/мин. Известно, что при температуре свыше ${Tmax} К прибор может испортиться, поэтому его нужно отключить. Найдите, через какое наибольшее время после начала работы нужно отключить прибор. Ответ дайте в минутах.`,
    answer: ru(t),
  }
}
// Закон Ома I=U/R, I не должна превышать Imax — наименьшее R=U/Imax.
function t09Ohm() {
  const Imax = pick([5, 4, 8, 10]), U = pick([110, 120, 220, 200, 240])
  const R = clean(U / Imax)
  if (!Number.isInteger(R)) return t09Ohm()
  return {
    condition_text: `Сила тока I (в А) в электросети вычисляется по закону Ома: I=${fT("U", "R")}, где U — напряжение (в В), R — сопротивление прибора (в Ом). Электросеть прекращает работать, если сила тока превышает ${Imax} А. Определите, какое наименьшее сопротивление может быть у прибора, подключаемого к сети с напряжением ${U} В, чтобы сеть продолжала работать. Ответ дайте в омах.`,
    answer: ru(R),
  }
}
// Параллельное соединение R=R₁R₂/(R₁+R₂)≥Rmin — наименьшее R₂.
function t09Parallel() {
  let R1, Rmin, R2, g = 0
  do {
    R1 = pick([21, 36, 30, 24, 40]); Rmin = pick([18, 20, 12, 15])
    // R1R2/(R1+R2)=Rmin → R2=Rmin·R1/(R1−Rmin)
    R2 = clean(Rmin * R1 / (R1 - Rmin))
    g++
  } while ((R1 <= Rmin || !Number.isInteger(R2) || R2 <= 0) && g < 200)
  if (!Number.isInteger(R2) || R2 <= 0) { R1 = 21; Rmin = 18; R2 = 126 }
  const app = pick(["тостера", "электрообогревателя"])
  return {
    condition_text: `В розетку подключена электрическая духовка, сопротивление которой R₁=${R1} Ом. Параллельно с ней предполагается подключить прибор, сопротивление которого R₂ (в Ом). При параллельном соединении общее сопротивление вычисляется по формуле R=${fT("R₁R₂", "R₁+R₂")}. Для нормальной работы сети общее сопротивление должно быть не меньше ${Rmin} Ом. Определите наименьшее возможное сопротивление ${app}. Ответ дайте в омах.`,
    answer: ru(R2),
  }
}
// ЭДС U=εR/(R+r) — найти R.
function t09EMF() {
  let eps, r, U, R, g = 0
  do {
    eps = pick([130, 180, 150, 160]); r = 1; U = eps - pick([10, 20])
    // U=εR/(R+r) → R=Ur/(ε−U)
    R = clean(U * r / (eps - U))
    g++
  } while (!Number.isInteger(R) && g < 100)
  return {
    condition_text: `К источнику с ЭДС ε=${eps} В и внутренним сопротивлением r=${r} Ом хотят подключить нагрузку с сопротивлением R (в Ом). Напряжение (в В) на нагрузке вычисляется по формуле U=${fT("εR", "R+r")}. При каком значении сопротивления нагрузки напряжение на ней будет равно ${U} В? Ответ дайте в омах.`,
    answer: ru(R),
  }
}
// Эффект Доплера f=f₀(c+u)/(c−v) — найти скорость сигнала c.
function t09Doppler() {
  let f0, u, v, f, c, g = 0
  do {
    f0 = pick([140, 160, 150]); u = randInt(6, 16); v = randInt(6, 16); f = f0 + pick([10, 20])
    // f=f0(c+u)/(c−v) → c(f−f0)=f0·u+f·v → c=(f0u+fv)/(f−f0)
    c = clean((f0 * u + f * v) / (f - f0))
    g++
  } while ((!Number.isInteger(c) || c <= v) && g < 300)
  if (!Number.isInteger(c)) { f0 = 140; u = 15; v = 14; f = 150; c = (140 * 15 + 150 * 14) / 10 }
  return {
    condition_text: `При сближении источника и приёмника звуковых сигналов, движущихся навстречу друг другу со скоростями u и v (в м/с), частота сигнала f (в Гц), регистрируемого приёмником, вычисляется по формуле f=f₀·${fT("c+u", "c−v")}, где f₀=${f0} Гц — частота исходного сигнала, c — скорость распространения сигнала в среде (в м/с), u=${u} м/с и v=${v} м/с. При какой скорости распространения сигнала в среде частота сигнала в приёмнике будет равна ${f} Гц? Ответ дайте в м/с.`,
    answer: ru(c),
  }
}
// Работа при сжатии A=αυT·log₂(V₁/V₂) — найти конечный объём V₂.
function t09DiverWork() {
  const alpha = pick([8.7, 9.9, 5.75, 10.9]), nu = pick([2, 3, 6]), T = 300
  const V1 = pick([120, 16, 64, 32])
  const nlog = randInt(2, 4)
  const V2 = clean(V1 / 2 ** nlog)
  const A = clean(alpha * nu * T * nlog)
  if (!Number.isInteger(V2) && !Number.isInteger(V2 * 10)) return t09DiverWork()
  if (!Number.isInteger(A)) return t09DiverWork()
  return {
    condition_text: `Водолазный колокол, содержащий υ=${nu} моль воздуха объёмом V₁=${V1} л, медленно опускают на дно. Происходит изотермическое сжатие воздуха до конечного объёма V₂ (в л). Работа A (в Дж) вычисляется по формуле A=αυT·log${subB(2)}${fT("V₁", "V₂")}, где α=${ru(alpha)} Дж/(моль·К) — постоянная, T=${T} К. Найдите, какой объём V₂ будет занимать воздух, если совершена работа ${A} Дж. Ответ дайте в литрах.`,
    answer: ru(V2),
  }
}
// Абсолютно неупругое соударение Q=mv²sin²α — найти угол 2α (в градусах).
function t09Collision() {
  const pairs = [[6, 9, 30], [9, 6, 30], [6, 9, 90], [4, 9, 90]]
  const [m, v, ang2] = pick(pairs)
  const alpha = ang2 / 2
  const Q = clean(m * v * v * Math.sin(alpha * Math.PI / 180) ** 2)
  if (!Number.isInteger(Q)) return t09Collision()
  return {
    condition_text: `Два тела массой m=${m} кг каждое движутся с одинаковой скоростью v=${v} м/с под углом 2α друг к другу. Энергия (в Дж) при их абсолютно неупругом соударении вычисляется по формуле Q=mv²sin²α. Найдите, под каким углом 2α должны двигаться тела, чтобы выделилась энергия ${Q} Дж. Ответ дайте в градусах.`,
    answer: ru(ang2),
  }
}

// ============================================================================
// №12 — ИССЛЕДОВАНИЕ ФУНКЦИИ (точка экстремума / наиб.-наим. значение)
// Ответ вычисляется из производной → совпадает с показанной функцией.
// ============================================================================
const nice = (x) => Number.isInteger(clean(x * 100)) && Math.abs(x) < 1000

// Кубическая y=x³+bx²+cx+d: точка максимума = меньший корень y′, минимума = больший.
function t12CubicPoint() {
  const maxPt = Math.random() < 0.5
  let b, c, d, r1, r2, g = 0
  do {
    b = randInt(-16, 16); c = randInt(-300, 300); d = randInt(1, 30)
    const D = 4 * b * b - 12 * c            // y′=3x²+2bx+c
    if (D <= 0) { g++; continue }
    const s = Math.sqrt(D)
    r1 = (-2 * b - s) / 6; r2 = (-2 * b + s) / 6
    g++
  } while ((!Number.isInteger(maxPt ? r1 : r2)) && g < 600)
  if (!Number.isInteger(maxPt ? r1 : r2)) return t12CubicPoint()
  const parts = ["x³"]
  if (b) parts.push(`${b > 0 ? "+" : "−"}${Math.abs(b)}x²`)
  if (c) parts.push(`${c > 0 ? "+" : "−"}${Math.abs(c)}x`)
  parts.push(`${d > 0 ? "+" : "−"}${Math.abs(d)}`)
  return {
    condition_text: `Найдите точку ${maxPt ? "максимума" : "минимума"} функции y=${parts.join("")}.`,
    answer: ru(maxPt ? r1 : r2),
  }
}
// Логарифм со сдвигом: y=B·ln(x+s)−c·x+d (концав, максимум) либо c·x−B·ln(x+s)+d (мин).
function t12LnPoint() {
  const maxPt = Math.random() < 0.5
  let B, c, s, x0, g = 0
  do {
    B = randInt(1, 12); c = randInt(1, 12); s = randInt(-11, 11)
    x0 = -s + B / c                       // крит. точка
    g++
  } while (!nice(x0) && g < 300)
  const kInside = Math.random() < 0.35 && B > 1   // ln(x+s)^B вместо B·ln(x+s)
  const arg = `x${signed(s)}`.replace("+0", "")
  const lnPart = kInside ? `ln(${arg})${sup(B)}` : `${B === 1 ? "" : B}·ln(${arg})`
  const linPart = `${c === 1 ? "" : c}x`
  const d = randInt(1, 20), sd = pick([1, -1])
  const body = maxPt
    ? `${lnPart}−${linPart}${sd > 0 ? "+" : "−"}${d}`
    : `${linPart}−${lnPart}${sd > 0 ? "+" : "−"}${d}`
  return {
    condition_text: `Найдите точку ${maxPt ? "максимума" : "минимума"} функции y=${body}.`,
    answer: ru(clean(x0)),
  }
}
// Степенная y=d+p·x−q·x^(3/2) (макс) либо x^(3/2)−p·x+d (мин). Крит √x=2p/(3q).
function t12X32Point() {
  const maxPt = Math.random() < 0.5
  const k = randInt(2, 9)               // √x в критической точке
  const q = maxPt ? pick([1, 2]) : 1
  const p = 1.5 * q * k                  // из 2p/(3q)=k
  if (!Number.isInteger(p)) return t12X32Point()
  const x0 = k * k
  const d = randInt(1, 25)
  const xterm = q === 1 ? "x√x" : `${q}x√x`   // x^(3/2)=x√x
  const body = maxPt ? `${d}+${p}x−${xterm}` : `${xterm}−${p}x+${d}`
  return {
    condition_text: `Найдите точку ${maxPt ? "максимума" : "минимума"} функции y=${body}.`,
    answer: ru(x0),
  }
}
// Квадрат + логарифм y=A·x²+b·x+c·lnx+e. y′=2Ax+b+c/x → 2Ax²+bx+c=0.
function t12QuadLnPoint() {
  const maxPt = Math.random() < 0.5
  let A, b, c, r1, r2, g = 0
  do {
    A = pick([1, 2, 0.5, 3.5]); b = randInt(-40, -8); c = randInt(20, 140)
    const D = b * b - 8 * A * c
    if (D <= 0) { g++; continue }
    const s = Math.sqrt(D)
    r1 = (-b - s) / (4 * A); r2 = (-b + s) / (4 * A)  // r1<r2
    g++
  } while ((!(r1 > 0) || !Number.isInteger(maxPt ? r1 : r2)) && g < 800)
  if (!(r1 > 0) || !Number.isInteger(maxPt ? r1 : r2)) return t12QuadLnPoint()
  const Astr = A === 1 ? "x²" : A === 0.5 ? "0,5x²" : `${ru(A)}x²`
  const e = randInt(1, 90), se = pick([1, -1])
  return {
    condition_text: `Найдите точку ${maxPt ? "максимума" : "минимума"} функции y=${Astr}${b > 0 ? "+" : "−"}${Math.abs(b)}x+${c}·lnx${se > 0 ? "+" : "−"}${e}.`,
    answer: ru(maxPt ? r1 : r2),
  }
}
// Наибольшее значение y=B·ln(x+a)−B·x+c на отрезке (крит. x=1−a внутри). max=B(a−1)+c.
function t12LnMaxValue() {
  const B = randInt(1, 12)
  const a = randInt(3, 11)
  const x0 = 1 - a                       // крит. точка (внутри отрезка, x0<0)
  const sc = pick([1, -1]) * randInt(1, 9)
  const maxVal = B * (a - 1) + sc        // B·ln(1)−B·x0+sc = B(a−1)+sc
  const lo = x0 - 0.5, hi = 0            // область определения: x>−a, а lo=0,5−a>−a
  return {
    condition_text: `Найдите наибольшее значение функции y=${B === 1 ? "" : B}·ln(x+${a})−${B === 1 ? "" : B}x${sc > 0 ? "+" : "−"}${Math.abs(sc)} на отрезке [${ru(clean(lo))}; ${hi}].`,
    answer: ru(maxVal),
  }
}
// Наименьшее значение y=x√x−p·x+c на отрезке [1;N], min при x=(p/1.5)²=k².
function t12X32MinValue() {
  const k = randInt(3, 7)
  const p = 1.5 * k
  if (!Number.isInteger(p)) return t12X32MinValue()
  const x0 = k * k
  const c = randInt(10, 30)
  const minVal = k * k * k - p * x0 + c          // x0√x0 − p·x0 + c = k³ − p·k² + c
  const hi = x0 + randInt(2, 20)
  return {
    condition_text: `Найдите наименьшее значение функции y=x√x−${p % 1 ? ru(p) : p}x+${c} на отрезке [1; ${hi}].`,
    answer: ru(minVal),
  }
}

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
  const rhs = nested ? `(${base2}${sup(c)})${sup(d)}` : `${base2}${sup(e)}`
  return {
    condition_text: `Найдите значение выражения (${base1}${sup(a)})${sup(b)}:${rhs}.`,
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

// ============================================================================
// №11 — ГРАФИКИ ФУНКЦИЙ (чтение графика элементарной функции, короткий ответ)
// ============================================================================
// Каждый график рисуется на координатной сетке (как в ФИПИ): кривая проходит
// через читаемые узлы решётки, чтобы по картинке однозначно восстанавливались
// параметры (k, b, a, c …). Ответ считается кодом — гарантированно верен.

const G_AX = "#1c1c1e", G_GRID = "#d7dbe0", G_CURVE = "#1c1c1e", G_DASH = "#8a9099"
// Белый ореол за подписями — цифры осей и метки читаются, даже если сквозь них идёт кривая.
const HALO = 'paint-order="stroke" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"'

// Путь кривой: сэмплирует fn на [xa,xb], рвёт линию на разрывах и выходе за окно.
function fnPath(fn, xa, xb, X, Y, ylo, yhi, step) {
  step = step || (xb - xa) / 500
  let d = "", pen = false, prevY = null
  for (let x = xa; x <= xb + 1e-9; x += step) {
    const y = fn(x)
    if (!isFinite(y) || y < ylo - 0.7 || y > yhi + 0.7) { pen = false; prevY = null; continue }
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
// unitX — подпись деления по x («1» по умолч.); xticks — свои подписи оси x
// (напр. [{x:4,text:"π"}]) вместо «1» (для тригонометрии, где клетка = π/4).
function fnGridSvg({ gx0, gx1, gy0, gy1, plots = [], vdash = [], hdash = [], dots = [], labels = [], unitX = "1", xticks = null }) {
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
  if (xticks) { for (const t of xticks) if (t.x >= gx0 && t.x <= gx1 && t.x !== 0) g += `<text x="${X(t.x)}" y="${Y(0) + 16}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="middle">${t.text}</text>` }
  else if (gx0 <= 1 && gx1 >= 1) g += `<text x="${X(1)}" y="${Y(0) + 16}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="middle">${unitX}</text>`
  if (gy0 <= 1 && gy1 >= 1) g += `<text x="${X(0) - 6}" y="${Y(1) + 4}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="end">1</text>`
  // жирные точки
  for (const [x, y] of dots) g += `<circle cx="${X(x)}" cy="${Y(y)}" r="2.8" fill="${G_AX}"/>`
  // произвольные подписи
  for (const L of labels) g += `<text x="${X(L.x)}" y="${Y(L.y)}" ${HALO} font-size="${L.size || 13}" ${L.italic ? 'font-style="italic" ' : ""}fill="${G_AX}" text-anchor="${L.anchor || "start"}">${L.text}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`
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
        if (clr <= -hUp) break
      }
      let s = clr + Math.min(cx - gx0, gx1 - cx, cy - gy0, gy1 - cy) * 0.12 + (preferRight ? 1 : -1) * cx * 0.03
      for (const ax of avoidX) s -= Math.max(0, 1.0 - Math.abs(cx - ax)) * 0.7
      for (const ay of avoidY) s -= Math.max(0, 0.8 - Math.abs(cy - ay)) * 0.7
      if (s > bestScore) { bestScore = s; best = { x: clean(cx), y: clean(cy) } }
    }
  }
  return { x: best.x, y: best.y, text: "y = f(x)", italic: true, size: 12, anchor: "middle" }
}

// ---- A. Линейная f(x)=kx+b ------------------------------------------------

// Подобрать прямую (целое или полуцелое k, целое b) с ≥3 читаемыми узлами в окне.
function pickLine(kset) {
  const gx0 = -5, gx1 = 5, gy0 = -6, gy1 = 6
  for (let t = 0; t < 400; t++) {
    const k = pick(kset), b = randInt(-4, 4)
    let nodes = 0
    for (let x = gx0; x <= gx1; x++) { const y = k * x + b; if (Number.isInteger(y) && y >= gy0 && y <= gy1) nodes++ }
    if (nodes >= 3) return { k, b, gx0, gx1, gy0, gy1 }
  }
  return { k: 2, b: 1, gx0, gx1, gy0, gy1 }
}

function t11LinValue() {
  const { k, b, gx0, gx1, gy0, gy1 } = pickLine([1, 2, 3, -1, -2, -3])
  let x0
  do { x0 = pick([-9, -8, -7, -6, 6, 7, 8, 9]) } while (Math.abs(k * x0 + b) > 40)
  const fn = (x) => k * x + b
  const svg = fnGridSvg({ gx0, gx1, gy0, gy1, plots: [{ fn, xa: gx0, xb: gx1 }], labels: [fLabelAt(fn, gx0, gx1, gy0, gy1, { preferRight: k > 0 })] })
  return {
    condition_text: `На рисунке изображён график функции вида f(x) = kx + b. Найдите значение f(${ru(x0)}).`,
    image_url: svgUrl(svg),
    answer: ru(k * x0 + b),
  }
}

// ---- B. Парабола f(x)=ax²+bx+c ---------------------------------------------
// Инвариант: a, b, c — ЦЕЛЫЕ, поэтому f(целое)=целое и кривая проходит через
// узлы решётки (параметры однозначно читаются). Вершина может быть вне узла.

function makeParab(a, b, c) {
  const fn = (x) => a * x * x + b * x + c
  const h = -b / (2 * a), vy = c - (b * b) / (4 * a)
  let gy0, gy1
  if (a > 0) { gy0 = Math.floor(Math.min(vy, 0)) - 1; gy1 = gy0 + 11 }
  else { gy1 = Math.ceil(Math.max(vy, 0)) + 1; gy0 = gy1 - 11 }
  let gx0 = Math.min(Math.floor(h) - 4, -1), gx1 = Math.max(Math.ceil(h) + 4, 1)
  if (gx1 - gx0 > 12) { gx0 = Math.max(gx0, Math.round(h) - 6); gx1 = Math.min(gx1, Math.round(h) + 6) }
  return { a, b, c, fn, h, vy, gx0, gx1, gy0, gy1 }
}

// Подобрать целую параболу под ограничения ({a},{b},{c} — фиксировать коэффициент).
function pickQuad({ a: aFix, b: bFix, c: cFix } = {}) {
  for (let t = 0; t < 900; t++) {
    const a = aFix != null ? aFix : pick([1, -1, 2, -2])
    const b = bFix != null ? bFix : randInt(-8, 8)
    const h = -b / (2 * a)
    if (Math.abs(h) > 3.5) continue
    let c
    if (cFix != null) c = cFix
    else { const vyT = a > 0 ? randInt(-4, -1) : randInt(1, 4); c = Math.round(vyT + (b * b) / (4 * a)) }
    const vy = c - (b * b) / (4 * a)
    if (a > 0 ? !(vy >= -6 && vy <= 0.5) : !(vy <= 6 && vy >= -0.5)) continue
    const P = makeParab(a, b, c)
    if (P.gx1 - P.gx0 > 12) continue
    let nodes = 0
    for (let x = P.gx0; x <= P.gx1; x++) { const y = P.fn(x); if (y >= P.gy0 && y <= P.gy1) nodes++ }
    if (nodes < 3) continue
    if (cFix != null && (P.fn(0) < P.gy0 + 0.5 || P.fn(0) > P.gy1 - 0.5)) continue // c=f(0) виден
    return P
  }
  return makeParab(aFix ?? 1, bFix ?? -2, cFix ?? -3)
}

function parabSvg(P) {
  return svgUrl(fnGridSvg({
    gx0: P.gx0, gx1: P.gx1, gy0: P.gy0, gy1: P.gy1,
    plots: [{ fn: P.fn, xa: P.gx0, xb: P.gx1 }],
    labels: [fLabelAt(P.fn, P.gx0, P.gx1, P.gy0, P.gy1, { preferRight: false })],
  }))
}

// Читаемый узел внутри окна (для «прочитай f(x0)»), не вершина, не 0.
function inWindowNode(P) {
  const cands = []
  for (let x = P.gx0 + 1; x <= P.gx1 - 1; x++) { const y = P.fn(x); if (y >= P.gy0 + 0.5 && y <= P.gy1 - 0.5 && x !== 0) cands.push(x) }
  return cands.length ? pick(cands) : P.gx0 + 1
}
// #3 — парабола ax²+bx+c, прочитать f(x0) в окне.
function t11QuadRead() {
  const P = pickQuad(), x0 = inWindowNode(P)
  return { condition_text: `На рисунке изображён график функции вида f(x) = ax² + bx + c. Найдите значение f(${ru(x0)}).`, image_url: parabSvg(P), answer: ru(P.fn(x0)) }
}

// ---- C. Гипербола f(x)=K/(x−p)+q -------------------------------------------
// Вертикальная асимптота x=p (пунктир при p≠0), горизонтальная y=q (пунктир при
// q≠0). Целые K,p,q ⇒ узлы решётки при (x−p) | K, параметры однозначно читаются.

function makeHyp(K, p, q) {
  const fn = (x) => K / (x - p) + q
  const gx0 = Math.min(-1, Math.round(p) - 5), gx1 = Math.max(1, Math.round(p) + 5)
  const gy0 = Math.min(-1, Math.round(q) - 5), gy1 = Math.max(1, Math.round(q) + 5)
  return { K, p, q, fn, gx0, gx1, gy0, gy1, vdash: p !== 0 ? [p] : [], hdash: q !== 0 ? [q] : [] }
}
function hypNodes(H) { let n = 0; for (let x = H.gx0; x <= H.gx1; x++) { if (x === H.p) continue; const y = H.fn(x); if (Number.isInteger(y) && y >= H.gy0 && y <= H.gy1) n++ } return n }
function hypSvg(H) {
  const eps = 0.28
  return svgUrl(fnGridSvg({
    gx0: H.gx0, gx1: H.gx1, gy0: H.gy0, gy1: H.gy1,
    plots: [{ fn: H.fn, xa: H.gx0, xb: H.p - eps }, { fn: H.fn, xa: H.p + eps, xb: H.gx1 }],
    vdash: H.vdash, hdash: H.hdash,
    labels: [fLabelAt(H.fn, H.gx0, H.gx1, H.gy0, H.gy1, { preferRight: true, avoidX: [0, ...H.vdash], avoidY: [0, ...H.hdash] })],
  }))
}
const HYP_K = [2, 3, 4, 6, 8, -2, -3, -4, -6, -8]
const NICE_D = [1, -1, 2, -2, 4, -4, 5, -5, 10, -10, 20, -20]

// Подобрать гиперболу с ≥4 читаемыми узлами (и заданными p,q при сдвигах).
function pickHyp(p, q, Kset = HYP_K) {
  for (let t = 0; t < 300; t++) { const K = pick(Kset); const H = makeHyp(K, p, q); if (hypNodes(H) >= 4) return H }
  return makeHyp(pick(Kset), p, q)
}
// x0 вне узла p, где (x0−p) делит K терминально; предпочтительно вне окна (нужно вычислить).
function hypX0(H) {
  const cand = NICE_D.map((d) => H.p + d).filter((x) => x !== H.p && isTerm(H.K, x - H.p))
  const far = cand.filter((x) => x < H.gx0 || x > H.gx1)
  return pick(far.length ? far : cand)
}

// #12/#13 — f(x)=k/x, найти f(x0).
function t11HypBasic() {
  const H = pickHyp(0, 0)
  const x0 = hypX0(H)
  return { condition_text: `На рисунке изображён график функции вида f(x) = ⟦f:k:x⟧. Найдите значение f(${ru(x0)}).`, image_url: hypSvg(H), answer: ru(clean(H.fn(x0))) }
}

// ---- E. Показательная f(x)=a^(x+s)+q ---------------------------------------
// Основание a=B^dir, B∈{2,3}, dir=±1 (a>1 возр., a<1 убыв.). Ответы — целые/терм.
function powRat(B, dir, e) {
  const ex = dir * e
  let n = 1, d = 1
  if (ex >= 0) n = B ** ex; else d = B ** (-ex)
  let dd = d; while (dd % 2 === 0) dd /= 2; while (dd % 5 === 0) dd /= 5
  return dd === 1 ? n / d : null // терминальная десятичная?
}
function makeExp(a, s, q) {
  const fn = (x) => Math.pow(a, x + s) + q
  const gx0 = -3, gx1 = 3
  const gy0 = Math.min(-1, Math.floor(q) - 1), gy1 = Math.min(Math.max(2, Math.ceil(q) + 6), Math.ceil(q) + 8)
  return { a, s, q, fn, gx0, gx1, gy0, gy1, hdash: q !== 0 ? [q] : [] }
}
function expSvg(E) {
  return svgUrl(fnGridSvg({
    gx0: E.gx0, gx1: E.gx1, gy0: E.gy0, gy1: E.gy1,
    plots: [{ fn: E.fn, xa: E.gx0, xb: E.gx1 }], hdash: E.hdash,
    labels: [fLabelAt(E.fn, E.gx0, E.gx1, E.gy0, E.gy1, { preferRight: E.a < 1, avoidY: [0, ...E.hdash] })],
  }))
}
function pickExpBase() { const B = pick([2, 3]), dir = pick([1, -1]); return { B, dir, a: dir > 0 ? B : 1 / B } }
// целый x0 на «целой» стороне (dir·x0≥1) → степень целая
function expIntX0(B, dir) { const m = pick([2, 3, dir > 0 && B === 2 ? 4 : 3]); return dir > 0 ? m : -m }

// #22/#23 — f(x)=aˣ, найти f(x0).
function t11ExpValue() {
  const { B, dir, a } = pickExpBase(), s = 0, q = 0
  const x0 = expIntX0(B, dir), E = makeExp(a, s, q)
  return { condition_text: `На рисунке изображён график функции вида f(x) = a${supT("x")}. Найдите значение f(${ru(x0)}).`, image_url: expSvg(E), answer: ru(powRat(B, dir, x0)) }
}

// ---- F. Логарифм f(x)=q+log_a(x+s) -----------------------------------------
function makeLog(B, s, q) {
  const fn = (x) => (x + s <= 0 ? NaN : q + Math.log(x + s) / Math.log(B))
  const gx0 = Math.min(-1, Math.round(-s) - 1)
  let gx1 = Math.max(9, Math.round(-s) + 9); if (gx1 - gx0 > 13) gx1 = gx0 + 13
  const gy0 = Math.min(-1, q - 3), gy1 = Math.max(2, q + 3)
  return { B, s, q, fn, gx0, gx1, gy0, gy1, vdash: s !== 0 ? [-s] : [] }
}
function logSvg(L) {
  return svgUrl(fnGridSvg({
    gx0: L.gx0, gx1: L.gx1, gy0: L.gy0, gy1: L.gy1,
    plots: [{ fn: L.fn, xa: -L.s + 0.02, xb: L.gx1 }], vdash: L.vdash,
    labels: [fLabelAt(L.fn, L.gx0, L.gx1, L.gy0, L.gy1, { preferRight: true, avoidX: [0, ...L.vdash] })],
  }))
}
// x0=B^n − s (целый log = n), n≥1 ⇒ x0 целое; отсекаем слишком большие.
function logPow(B, s) { const ns = []; for (let n = 1; n <= 6; n++) { const x0 = B ** n - s; if (x0 <= 100) ns.push({ x0, n }) } return ns }

// #28/#29 — f(x)=log_a x, найти f(x0).
function t11LogValue() {
  const B = pick([2, 3, 4]), L = makeLog(B, 0, 0)
  const o = pick(logPow(B, 0))
  return { condition_text: `На рисунке изображён график функции вида f(x) = log${subB("a")}x. Найдите значение f(${ru(o.x0)}).`, image_url: logSvg(L), answer: ru(o.n) }
}

// ---- H/I/J/K. Пересечения графиков (#40–#53) -------------------------------
// Строим «назад»: выбираем узлы пересечения A,B, обе кривые проходят через них
// точно ⇒ ответ (абсцисса/ордината) гарантированно верен.

// Окно, охватывающее ключевые точки и начало координат; выравниваем до почти
// квадратного (иначе близкие к 0 точки дают узкое-высокое окно).
function pairWin(pts) {
  const xs = pts.map((p) => p[0]).concat(0), ys = pts.map((p) => p[1]).concat(0)
  let x0 = Math.floor(Math.min(...xs)) - 1, x1 = Math.ceil(Math.max(...xs)) + 1
  let y0 = Math.floor(Math.min(...ys)) - 1, y1 = Math.ceil(Math.max(...ys)) + 1
  const side = Math.min(Math.max(x1 - x0, y1 - y0, 8), 14)
  let gL = 0
  while (x1 - x0 < side) { (gL++ % 2 ? x0-- : x1++) }
  while (y1 - y0 < side) { (gL++ % 2 ? y0-- : y1++) }
  if (x0 > 0) x0 = -1; if (x1 < 0) x1 = 1; if (y0 > 0) y0 = -1; if (y1 < 0) y1 = 1
  return { gx0: x0, gx1: x1, gy0: y0, gy1: y1 }
}
function markLabel(x, y, t) { return { x: x + 0.35, y: y + 0.9, text: t, italic: true, size: 14 } }

// H. Две прямые (#40–#43).
// Точку A берём ПОЛУцелой (обе координаты вида n+0,5) — её нельзя «считать» с узла
// сетки, ответ находят решением системы k1x+b1=k2x+b2. При нечётных наклонах
// (разность чётна) свободные члены b1,b2 остаются целыми ⇒ каждую прямую по-прежнему
// читают по её узлам, но пересечение лежит МЕЖДУ линиями сетки.
function t11TwoLines(findY) {
  let px, py, k1, b1, k2, b2
  for (; ;) {
    px = randInt(-2, 2) + 0.5; py = randInt(-3, 3) + 0.5
    const ks = shuffle([-3, -1, 1, 3]); k1 = ks[0]; k2 = ks[1]
    b1 = py - k1 * px; b2 = py - k2 * px
    if (Number.isInteger(b1) && Number.isInteger(b2) && Math.abs(b1) <= 6 && Math.abs(b2) <= 6) break
  }
  const f1 = (x) => k1 * x + b1, f2 = (x) => k2 * x + b2
  const gx0 = -5, gx1 = 5, gy0 = -6, gy1 = 6
  const svg = fnGridSvg({ gx0, gx1, gy0, gy1, plots: [{ fn: f1, xa: gx0, xb: gx1 }, { fn: f2, xa: gx0, xb: gx1 }], dots: [[px, py]], labels: [markLabel(px, py, "A")] })
  return { condition_text: `На рисунке изображены графики двух линейных функций, пересекающихся в точке A. Найдите ${findY ? "ординату" : "абсциссу"} точки A.`, image_url: svgUrl(svg), answer: ru(findY ? py : px) }
}

// I-b. Парабола + прямая через 0 (#46): f=ax²+bx+c, g=kx. Ответ — абсцисса B.
// B НЕ должна быть очевидной: xB берём ПОЛУцелым (её нельзя «считать» с узла сетки,
// находят решением ax²+bx+c=kx). Ведущий коэффициент чётный (±2) ⇒ b и c целые,
// так что параболу по-прежнему читают как ax²+bx+c. A остаётся в целом узле.
function t11ParabLineK() {
  for (; ;) {
    const k = pick([1, 2, 3, -1, -2, -3]), Af = pick([2, -2])
    const xA = randInt(-3, 3), xB = pick([-2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5])
    const fF = (x) => Af * x * x + (k - Af * (xA + xB)) * x + Af * xA * xB
    const gF = (x) => k * x
    const yA = k * xA, yB = k * xB
    if (Math.abs(yA) > 8 || Math.abs(yB) > 8 || Math.abs(fF(0)) > 8) continue
    const W = pairWin([[xA, yA], [xB, yB], [0, 0]]); if (W.gx1 - W.gx0 > 13 || W.gy1 - W.gy0 > 15) continue
    const svg = fnGridSvg({ ...W, plots: [{ fn: fF, xa: W.gx0, xb: W.gx1 }, { fn: gF, xa: W.gx0, xb: W.gx1 }], dots: [[xA, yA]], labels: [markLabel(xA, yA, "A")] })
    return { condition_text: `На рисунке изображены графики функций видов f(x) = ax² + bx + c и g(x) = kx, пересекающихся в точках A и B. Найдите абсциссу точки B.`, image_url: svgUrl(svg), answer: ru(xB) }
  }
}

// J. Гипербола + прямая (#49/#50): f=k/x, g=ax+b. A,B на разных ветвях.
// B НЕ должна быть очевидной: A ставим в целый узел (делитель k, читается), а xB —
// ПОЛУцелым на другой ветви, поэтому абсциссу B нельзя «считать» с сетки, её находят
// решением k/x=ax+b. Берём только комбинации, где a и b целые (прямая g читается).
function t11HypLine(findY) {
  for (; ;) {
    const k = pick([-12, -10, -8, -6, -4, 4, 6, 8, 10, 12])
    const divs = []; for (let d = -Math.abs(k); d <= Math.abs(k); d++) if (d !== 0 && k % d === 0) divs.push(d)
    const xA = pick(divs), yA = k / xA
    if (Math.abs(yA) > 8) continue
    const halves = [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5].filter((h) => (h > 0) !== (xA > 0))
    const xB = pick(halves), yB = k / xB
    if (Math.abs(yB) > 9) continue
    const a = (yB - yA) / (xB - xA), b = yA - a * xA
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === 0) continue
    if (Math.abs(a) > 6 || Math.abs(b) > 7) continue
    const fF = (x) => k / x, gF = (x) => a * x + b
    const W = pairWin([[xA, yA], [xB, yB]]); if (W.gx1 - W.gx0 > 14 || W.gy1 - W.gy0 > 16) continue
    const svg = fnGridSvg({ ...W, plots: [{ fn: fF, xa: W.gx0, xb: -0.28 }, { fn: fF, xa: 0.28, xb: W.gx1 }, { fn: gF, xa: W.gx0, xb: W.gx1 }], dots: [[xA, yA]], labels: [markLabel(xA, yA, "A")] })
    return { condition_text: `На рисунке изображены графики функций видов f(x) = ⟦f:k:x⟧ и g(x) = ax + b, пересекающихся в точках A и B. Найдите ${findY ? "ординату" : "абсциссу"} точки B.`, image_url: svgUrl(svg), answer: ru(findY ? yB : xB) }
  }
}

// K-a. Корень + прямая через 0 (#51): f=a√x, g=kx. A=(0,0), B=((a/k)²,…).
// B НЕ должна быть очевидной: берём только комбинации, где xB=(a/k)² НЕцелое, —
// тогда абсциссу нельзя «считать» с узла сетки, её находят решением a√x=kx.
// (Целые xB=4/9/16 убраны как читаемые с графика.) Ответы 2,25/6,25 валидны для ФИПИ.
function t11RootLineK() {
  const combos = [[3, 2, 2.25], [5, 2, 6.25], [6, 4, 2.25]]
  const [a, k, xB] = pick(combos)
  const fF = (x) => (x < 0 ? NaN : a * Math.sqrt(x)), gF = (x) => k * x
  const yB = k * xB
  const gx1 = Math.max(4, Math.ceil(xB) + 1), gy1 = Math.max(3, Math.ceil(yB) + 1)
  const svg = fnGridSvg({ gx0: -1, gx1, gy0: -1, gy1, plots: [{ fn: fF, xa: 0, xb: gx1 }, { fn: gF, xa: 0, xb: gx1 }], dots: [[0, 0]], labels: [markLabel(0, 0, "A")] })
  return { condition_text: `На рисунке изображены графики функций видов f(x) = a${rT("x")} и g(x) = kx, пересекающихся в точках A и B. Найдите абсциссу точки B.`, image_url: svgUrl(svg), answer: ru(xB) }
}

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
function wave8Svg({ gx0, gx1, gy0, gy1, fn, xa, xb, label = null, marks = [], markBelow = true,
  dashX = [], shade = null, tangent = null, dots = [], openEnds = true, showUnit = true, tickXvals = null }) {
  const cell = 22, m = 16
  const W = 2 * m + (gx1 - gx0) * cell, H = 2 * m + (gy1 - gy0) * cell
  const X = (u) => m + (u - gx0) * cell
  const Y = (v) => H - m - (v - gy0) * cell
  let g = ""
  for (let i = gx0; i <= gx1; i++) g += `<line x1="${X(i)}" y1="${Y(gy0)}" x2="${X(i)}" y2="${Y(gy1)}" stroke="${G_GRID}" stroke-width="1"/>`
  for (let j = gy0; j <= gy1; j++) g += `<line x1="${X(gx0)}" y1="${Y(j)}" x2="${X(gx1)}" y2="${Y(j)}" stroke="${G_GRID}" stroke-width="1"/>`
  if (shade) {
    let d = `M ${clean(X(shade.a))} ${clean(Y(0))} `
    const st = (shade.b - shade.a) / 160
    for (let x = shade.a; x <= shade.b + 1e-9; x += st) d += `L ${clean(X(x))} ${clean(Y(fn(x)))} `
    d += `L ${clean(X(shade.b))} ${clean(Y(0))} Z`
    g += `<path d="${d}" fill="#c9ced6" stroke="none"/>`
  }
  for (const x of dashX) g += `<line x1="${X(x)}" y1="${Y(0)}" x2="${X(x)}" y2="${clean(Y(fn(x)))}" stroke="${G_DASH}" stroke-width="1.2" stroke-dasharray="4 3"/>`
  if (tangent) {
    const { k, x0, y0 } = tangent
    const ln = (x) => k * (x - x0) + y0
    let xl = null, xr = null
    for (let x = gx0; x <= gx1 + 1e-9; x += 0.02) { const y = ln(x); if (y >= gy0 && y <= gy1) { if (xl === null) xl = x; xr = x } }
    if (xl !== null) g += `<line x1="${clean(X(xl))}" y1="${clean(Y(ln(xl)))}" x2="${clean(X(xr))}" y2="${clean(Y(ln(xr)))}" stroke="${G_AX}" stroke-width="1.7"/>`
  }
  g += `<path d="${fnPath(fn, xa, xb, X, Y, gy0, gy1, (xb - xa) / 600)}" fill="none" stroke="${G_CURVE}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
  g += vecArrow(X(gx0), Y(0), X(gx1), Y(0), G_AX, 1.4)
  g += vecArrow(X(0), Y(gy0), X(0), Y(gy1), G_AX, 1.4)
  // «x» — над осью у стрелки, чтобы не сталкиваться с подписью крайнего деления снизу
  g += `<text x="${X(gx1) - 4}" y="${Y(0) - 6}" ${HALO} font-size="15" font-style="italic" font-weight="bold" fill="${G_AX}" text-anchor="end">x</text>`
  g += `<text x="${X(0) + 7}" y="${Y(gy1) + 13}" ${HALO} font-size="15" font-style="italic" font-weight="bold" fill="${G_AX}">y</text>`
  g += `<text x="${X(0) - 5}" y="${Y(0) + 16}" ${HALO} font-size="12" font-weight="bold" fill="${G_AX}" text-anchor="end">0</text>`
  if (showUnit && gy0 <= 1 && gy1 >= 1) g += `<text x="${X(0) - 6}" y="${Y(1) + 4}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="end">1</text>`
  if (showUnit && !tickXvals && gx0 <= 1 && gx1 >= 1) g += `<text x="${X(1)}" y="${Y(0) + 16}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="middle">1</text>`
  if (tickXvals) for (const t of tickXvals) if (t.x >= gx0 && t.x <= gx1 && t.x !== 0) g += `<text x="${X(t.x)}" y="${Y(0) + 16}" ${HALO} font-size="12" fill="${G_AX}" text-anchor="middle">${t.text}</text>`
  if (openEnds) for (const xe of [xa, xb]) { const ye = fn(xe); if (ye >= gy0 - 0.4 && ye <= gy1 + 0.4) g += `<circle cx="${X(xe)}" cy="${clean(Y(ye))}" r="3" fill="#fff" stroke="${G_CURVE}" stroke-width="1.6"/>` }
  for (const [x, y] of dots) g += `<circle cx="${X(x)}" cy="${clean(Y(y))}" r="3" fill="${G_AX}"/>`
  for (const mk of marks) {
    // подпись — на той стороне оси, где рядом нет кривой (иначе чёрная кривая перечёркивает xᵢ)
    const below = mk.below !== undefined ? mk.below : (fn ? fn(mk.x) >= 0 : markBelow)
    g += `<line x1="${X(mk.x)}" y1="${Y(0) - 4}" x2="${X(mk.x)}" y2="${Y(0) + 4}" stroke="${G_AX}" stroke-width="1.4"/>`
    g += `<text x="${X(mk.x)}" y="${below ? Y(0) + 16 : Y(0) - 8}" ${HALO} font-size="12" font-style="italic" fill="${G_AX}" text-anchor="middle">${mk.label}</text>`
  }
  if (label) g += `<text x="${X(label.x)}" y="${Y(label.y)}" ${HALO} font-size="13" font-style="italic" fill="${G_AX}" text-anchor="${label.anchor || "middle"}">${label.text}</text>`
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${g}</svg>`)
}

// Место для подписи «y = f(x)»: угол с максимальным вертикальным зазором до кривой.
// Центр подписи держим на halfW+margin от оси y (x=0), чтобы текст не наезжал на
// вертикальную ось и её стрелку; по горизонтали подпись целиком внутри поля.
function label8(fn, gx0, gx1, gy0, gy1, text) {
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
      const xx = Math.min(gx1, Math.max(gx0, x)), y = fn(xx)
      if (isFinite(y)) clr = Math.min(clr, Math.abs(y - cy))
    }
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
  for (let x = gx0 + 0.7; x <= gx1 - 0.7; x += 0.25) if (!near(x) && Math.abs(x) > 0.4 && Math.abs(w.fn(x)) >= 0.45) cands.push(clean(x))
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
  for (let x = gx0 + 0.7; x <= gx1 - 0.7; x += 0.25) if (!near(x) && Math.abs(x) > 0.4 && Math.abs(b.fn(x)) >= 0.55) cands.push(clean(x))
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

// #28/#29 — в какой из отмеченных точек значение f′ наибольшее / наименьшее.
function t8fDerivExtreme(greatest) {
  const gx0 = -2, gx1 = 5, gy0 = -3, gy1 = 4
  const marksX = [-1, 1, 2, 3, 4].filter((x) => x > gx0 && x < gx1)
  let w, best, tries = 0
  do {
    w = buildExtremaWave(gx0, gx1, gy0, gy1, randInt(2, 3), pick([1, -1]))
    const vals = marksX.map((x) => ({ x, d: (w.fn(x + 0.03) - w.fn(x - 0.03)) / 0.06 }))
    vals.sort((p, q) => greatest ? q.d - p.d : p.d - q.d)
    best = (Math.abs(vals[0].d - vals[1].d) > 0.4) ? vals[0].x : null
  } while (best === null && ++tries < 80)
  return {
    condition_text: `На рисунке изображён график функции y = f(x). На оси абсцисс отмечены точки ${marksX.map(ru).join(", ")}. В какой из этих точек значение производной функции ${greatest ? "наибольшее" : "наименьшее"}? В ответе укажите эту точку.`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn: w.fn, xa: gx0, xb: gx1, marks: marksX.map((x) => ({ x, label: ru(x) })), showUnit: true, label: label8(w.fn, gx0, gx1, gy0, gy1, "y = f(x)") }),
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
function t8tangentSlope() {
  const gx0 = -6, gx1 = 6, gy0 = -6, gy1 = 8
  const rats = [[1, 2], [1, 4], [2, 5], [3, 2], [1, 1], [2, 1], [3, 1], [3, 4], [4, 5]]  // только конечные десятичные
  const [p0, q] = pick(rats)
  const k = clean(p0 / q * pick([1, -1]))
  // y0 ≥ 2 (точка касания заметно выше оси): касательная, кривая и штриховая линия
  // к точке идут ВВЕРХ от оси, поэтому подпись x₀ под осью ничем не перечёркивается.
  let x0, y0, tries = 0
  do { x0 = randInt(-2, 2); y0 = randInt(2, 4) } while ((Math.abs(x0 + q) > gx1 || Math.abs(y0 + k * q) > gy1) && ++tries < 30)
  const A = 0.2, w = 1
  const fn = (x) => { const u = x - x0; return y0 + k * u + A * (u - Math.sin(w * u) / w) }
  return {
    condition_text: `На рисунке изображены график функции y = f(x) и касательная к нему в точке с абсциссой x₀. Найдите значение производной функции f(x) в точке x₀.`,
    image_url: wave8Svg({ gx0, gx1, gy0, gy1, fn, xa: gx0, xb: gx1, tangent: { k, x0, y0 }, dashX: [x0], dots: [[x0, y0]], marks: [{ x: x0, label: "x" + subU(0) }], openEnds: false, showUnit: true, label: label8(fn, gx0, gx1, gy0, gy1, "y = f(x)") }),
    answer: ru(k),
  }
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

// ============================================================================
// №3 — СТЕРЕОМЕТРИЯ (объёмы и площади; чертёж обязателен)
// Эталон — 49 задач открытого банка ФИПИ (ЕГЭ Профиль, Задание 3) + классический
// реальный тип «многогранник из единичных кубов». Ответ считается кодом.
// ============================================================================

const ST_INK = "#1c1c1e", ST_HI = "#007AFF", ST_FILL = "rgba(0,122,255,0.14)"
const VSUB = { A: "A", B: "B", C: "C", D: "D", A1: "A₁", B1: "B₁", C1: "C₁", D1: "D₁" }
const BOXNAME = "ABCDA₁B₁C₁D₁", PRISMNAME = "ABCA₁B₁C₁"
const R2 = rT(2)  // √2

function stWrap(W, H, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${body}</svg>`
}
function stEdge(p, q, dash) {
  return `<line x1="${clean(p[0])}" y1="${clean(p[1])}" x2="${clean(q[0])}" y2="${clean(q[1])}" stroke="${ST_INK}" stroke-width="1.7"${dash ? ' stroke-dasharray="5 4"' : ""}/>`
}
function stPoly(pts, fill) {
  return `<polygon points="${pts.map(p => clean(p[0]) + "," + clean(p[1])).join(" ")}" fill="${fill}" stroke="${ST_HI}" stroke-width="2" stroke-linejoin="round"/>`
}
// Подпись у точки/ребра, отодвинутая от центроида фигуры наружу.
function stLabelOut(p, cen, text, off, big) {
  const dx = p[0] - cen[0], dy = p[1] - cen[1], L = Math.hypot(dx, dy) || 1
  const x = p[0] + dx / L * off, y = p[1] + dy / L * off + (big ? 5 : 4)
  return `<text x="${clean(x)}" y="${clean(y)}" ${HALO} font-size="${big ? 15 : 13}"${big ? ' font-style="italic" font-weight="bold"' : ""} fill="${ST_INK}" text-anchor="middle">${text}</text>`
}

// ── Прямоугольный параллелепипед / куб ──────────────────────────────────────
// highlight: массив граней (имён вершин); edgeLabels: {AB:"7",...}; cube: квадрат.
function stBox({ highlight = [], edgeLabels = {}, cube = false } = {}) {
  const W = 120, H = cube ? 120 : 95, d = [46, -30]
  const A = [58, cube ? 190 : 195], B = [A[0] + W, A[1]], A1 = [A[0], A[1] - H], B1 = [B[0], B[1] - H]
  const D = [A[0] + d[0], A[1] + d[1]], C = [B[0] + d[0], B[1] + d[1]]
  const D1 = [A1[0] + d[0], A1[1] + d[1]], C1 = [B1[0] + d[0], B1[1] + d[1]]
  const V = { A, B, C, D, A1, B1, C1, D1 }
  const names = Object.keys(V)
  const cen = [names.reduce((s, n) => s + V[n][0], 0) / 8, names.reduce((s, n) => s + V[n][1], 0) / 8]
  let g = ""
  for (const face of highlight) g += stPoly(face.map(n => V[n]), ST_FILL)
  const E = [["A", "B", 0], ["B", "C", 0], ["C", "D", 1], ["D", "A", 1],
  ["A1", "B1", 0], ["B1", "C1", 0], ["C1", "D1", 0], ["D1", "A1", 0],
  ["A", "A1", 0], ["B", "B1", 0], ["C", "C1", 0], ["D", "D1", 1]]
  for (const [p, q, hid] of E) g += stEdge(V[p], V[q], hid)
  for (const [k, t] of Object.entries(edgeLabels)) {
    const m = k.match(/^([A-D]1?)([A-D]1?)$/)
    if (m) { const mid = [(V[m[1]][0] + V[m[2]][0]) / 2, (V[m[1]][1] + V[m[2]][1]) / 2]; g += stLabelOut(mid, cen, t, 13, false) }
  }
  for (const n of names) g += stLabelOut(V[n], cen, VSUB[n], 12, true)
  return stWrap(290, cube ? 230 : 230, g)
}
// грани пирамиды: основание ABCD + боковые треугольники к вершине apex
function stPyrFaces(apex) {
  const base = ["A", "B", "C", "D"]
  const f = [base.slice()]
  for (let i = 0; i < 4; i++) f.push([base[i], base[(i + 1) % 4], apex])
  return f
}

// ── Правильная треугольная призма ABCA₁B₁C₁ ─────────────────────────────────
function stPrism3({ highlight = [], midline = false } = {}) {
  const hgt = 105
  const A = [55, 205], B = [178, 190], C = [120, 156]
  const A1 = [A[0], A[1] - hgt], B1 = [B[0], B[1] - hgt], C1 = [C[0], C[1] - hgt]
  const V = { A, B, C, A1, B1, C1 }
  const names = Object.keys(V)
  const cen = [names.reduce((s, n) => s + V[n][0], 0) / 6, names.reduce((s, n) => s + V[n][1], 0) / 6]
  let g = ""
  for (const face of highlight) g += stPoly(face.map(n => V[n]), ST_FILL)
  if (midline) {
    const M = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2], N = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2]
    const M1 = [M[0], M[1] - hgt], N1 = [N[0], N[1] - hgt]
    g += stPoly([M1, N1, [C[0], C[1] - hgt]], ST_FILL)
    g += stEdge(M, N, 0); g += stEdge(M1, N1, 0); g += stEdge(M, M1, 0); g += stEdge(N, N1, 0)
  }
  const E = [["A", "B", 0], ["B", "C", 0], ["C", "A", 1],
  ["A1", "B1", 0], ["B1", "C1", 0], ["C1", "A1", 0],
  ["A", "A1", 0], ["B", "B1", 0], ["C", "C1", 0]]
  for (const [p, q, hid] of E) g += stEdge(V[p], V[q], hid)
  for (const n of names) g += stLabelOut(V[n], cen, VSUB[n], 12, true)
  return stWrap(250, 235, g)
}

// ── Цилиндр / конус / шар и комбинации ──────────────────────────────────────
function stCone() {
  const rx = 55, ry = 13, cx = 90, apexY = 35, cyb = 170
  let g = `<line x1="${cx - rx}" y1="${cyb}" x2="${cx}" y2="${apexY}" stroke="${ST_INK}" stroke-width="1.7"/><line x1="${cx + rx}" y1="${cyb}" x2="${cx}" y2="${apexY}" stroke="${ST_INK}" stroke-width="1.7"/>`
  g += `<path d="M${cx - rx} ${cyb} A${rx} ${ry} 0 0 0 ${cx + rx} ${cyb}" fill="none" stroke="${ST_INK}" stroke-width="1.7" stroke-dasharray="5 4"/><path d="M${cx - rx} ${cyb} A${rx} ${ry} 0 0 1 ${cx + rx} ${cyb}" fill="none" stroke="${ST_INK}" stroke-width="1.7"/>`
  return stWrap(180, 200, g)
}
function stCylCone() {
  const rx = 55, ry = 13, cx = 95, cyt = 45, cyb = 165
  let g = `<line x1="${cx - rx}" y1="${cyt}" x2="${cx - rx}" y2="${cyb}" stroke="${ST_INK}" stroke-width="1.7"/><line x1="${cx + rx}" y1="${cyt}" x2="${cx + rx}" y2="${cyb}" stroke="${ST_INK}" stroke-width="1.7"/>`
  g += `<path d="M${cx - rx} ${cyb} A${rx} ${ry} 0 0 0 ${cx + rx} ${cyb}" fill="none" stroke="${ST_INK}" stroke-width="1.7" stroke-dasharray="5 4"/><path d="M${cx - rx} ${cyb} A${rx} ${ry} 0 0 1 ${cx + rx} ${cyb}" fill="none" stroke="${ST_INK}" stroke-width="1.7"/>`
  g += `<ellipse cx="${cx}" cy="${cyt}" rx="${rx}" ry="${ry}" fill="none" stroke="${ST_INK}" stroke-width="1.7"/>`
  g += `<line x1="${cx - rx}" y1="${cyb}" x2="${cx}" y2="${cyt}" stroke="${ST_HI}" stroke-width="1.7"/><line x1="${cx + rx}" y1="${cyb}" x2="${cx}" y2="${cyt}" stroke="${ST_HI}" stroke-width="1.7"/>`
  g += `<circle cx="${cx}" cy="${cyt}" r="2.6" fill="${ST_INK}"/>`
  return stWrap(190, 195, g)
}
function stTwoCyl() {
  const c1 = `<g>` + (() => {
    const rx = 38, ry = 12, cx = 60, cyt = 45, cyb = 165
    let g = `<line x1="${cx - rx}" y1="${cyt}" x2="${cx - rx}" y2="${cyb}" stroke="${ST_INK}" stroke-width="1.7"/><line x1="${cx + rx}" y1="${cyt}" x2="${cx + rx}" y2="${cyb}" stroke="${ST_INK}" stroke-width="1.7"/>`
    g += `<path d="M${cx - rx} ${cyb} A${rx} ${ry} 0 0 0 ${cx + rx} ${cyb}" fill="none" stroke="${ST_INK}" stroke-width="1.7" stroke-dasharray="5 4"/><path d="M${cx - rx} ${cyb} A${rx} ${ry} 0 0 1 ${cx + rx} ${cyb}" fill="none" stroke="${ST_INK}" stroke-width="1.7"/><ellipse cx="${cx}" cy="${cyt}" rx="${rx}" ry="${ry}" fill="none" stroke="${ST_INK}" stroke-width="1.7"/>`
    g += `<text x="${cx}" y="185" ${HALO} font-size="13" fill="${ST_INK}" text-anchor="middle">1</text>`
    return g
  })() + `</g>`
  const c2 = (() => {
    const rx = 58, ry = 16, cx = 195, cyt = 125, cyb = 165
    let g = `<line x1="${cx - rx}" y1="${cyt}" x2="${cx - rx}" y2="${cyb}" stroke="${ST_HI}" stroke-width="1.7"/><line x1="${cx + rx}" y1="${cyt}" x2="${cx + rx}" y2="${cyb}" stroke="${ST_HI}" stroke-width="1.7"/>`
    g += `<path d="M${cx - rx} ${cyb} A${rx} ${ry} 0 0 0 ${cx + rx} ${cyb}" fill="none" stroke="${ST_HI}" stroke-width="1.7" stroke-dasharray="5 4"/><path d="M${cx - rx} ${cyb} A${rx} ${ry} 0 0 1 ${cx + rx} ${cyb}" fill="none" stroke="${ST_HI}" stroke-width="1.7"/><ellipse cx="${cx}" cy="${cyt}" rx="${rx}" ry="${ry}" fill="none" stroke="${ST_HI}" stroke-width="1.7"/>`
    g += `<text x="${cx}" y="185" ${HALO} font-size="13" fill="${ST_INK}" text-anchor="middle">2</text>`
    return g
  })()
  return stWrap(275, 200, c1 + c2)
}
function stSphere({ section = false } = {}) {
  const R = 70, cx = 90, cy = 92
  let g = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${ST_INK}" stroke-width="1.7"/>`
  g += `<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${R * 0.28}" fill="${section ? ST_FILL : "none"}" stroke="${section ? ST_HI : ST_INK}" stroke-width="${section ? 1.9 : 1.3}"${section ? "" : ' stroke-dasharray="5 4"'}/>`
  return stWrap(180, 184, g)
}
function stSphereInCyl() {
  // Пропорции как у ФИПИ: почти квадратный силуэт, плоские эллипсы (ФИПИ-вид).
  const R = 56, rx = R, ry = 11, cx = 95, cyt = 26, cyb = cyt + 2 * R, cyc = cyt + R
  let g = `<line x1="${cx - rx}" y1="${cyt}" x2="${cx - rx}" y2="${cyb}" stroke="${ST_INK}" stroke-width="1.7"/><line x1="${cx + rx}" y1="${cyt}" x2="${cx + rx}" y2="${cyb}" stroke="${ST_INK}" stroke-width="1.7"/>`
  g += `<path d="M${cx - rx} ${cyb} A${rx} ${ry} 0 0 0 ${cx + rx} ${cyb}" fill="none" stroke="${ST_INK}" stroke-width="1.7" stroke-dasharray="5 4"/><path d="M${cx - rx} ${cyb} A${rx} ${ry} 0 0 1 ${cx + rx} ${cyb}" fill="none" stroke="${ST_INK}" stroke-width="1.7"/><ellipse cx="${cx}" cy="${cyt}" rx="${rx}" ry="${ry}" fill="none" stroke="${ST_INK}" stroke-width="1.7"/>`
  g += `<circle cx="${cx}" cy="${cyc}" r="${R}" fill="none" stroke="${ST_HI}" stroke-width="1.8"/><ellipse cx="${cx}" cy="${cyc}" rx="${R}" ry="${ry}" fill="none" stroke="${ST_HI}" stroke-width="1.2" stroke-dasharray="4 3"/>`
  g += `<circle cx="${cx}" cy="${cyc}" r="2.2" fill="${ST_INK}"/>`
  return stWrap(190, cyb + ry + 12, g)
}
function stConeInSphere() {
  const R = 64, cx = 90, cy = 92
  let g = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${ST_INK}" stroke-width="1.7"/>`
  // конус целиком внутри шара → образующие и основание скрыты (пунктир, ФИПИ-вид)
  g += `<line x1="${cx - R}" y1="${cy}" x2="${cx}" y2="${cy - R}" stroke="${ST_HI}" stroke-width="1.8" stroke-dasharray="5 4"/><line x1="${cx + R}" y1="${cy}" x2="${cx}" y2="${cy - R}" stroke="${ST_HI}" stroke-width="1.8" stroke-dasharray="5 4"/>`
  g += `<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${R * 0.28}" fill="none" stroke="${ST_HI}" stroke-width="1.5" stroke-dasharray="5 4"/>`
  g += `<circle cx="${cx}" cy="${cy}" r="2.2" fill="${ST_INK}"/><circle cx="${cx}" cy="${cy - R}" r="2.2" fill="${ST_INK}"/>`
  return stWrap(180, 184, g)
}
function stConeCircumSphere() {
  const R = 60, cx = 95, cy = 105, ry = R * 0.28
  let g = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${ST_INK}" stroke-width="1.3"/>`
  g += `<line x1="${cx - R}" y1="${cy}" x2="${cx}" y2="${cy - R}" stroke="${ST_HI}" stroke-width="1.8"/><line x1="${cx + R}" y1="${cy}" x2="${cx}" y2="${cy - R}" stroke="${ST_HI}" stroke-width="1.8"/>`
  g += `<path d="M${cx - R} ${cy} A${R} ${ry} 0 0 0 ${cx + R} ${cy}" fill="none" stroke="${ST_HI}" stroke-width="1.8" stroke-dasharray="4 3"/><path d="M${cx - R} ${cy} A${R} ${ry} 0 0 1 ${cx + R} ${cy}" fill="none" stroke="${ST_HI}" stroke-width="1.8"/>`
  g += `<circle cx="${cx}" cy="${cy}" r="2.6" fill="${ST_INK}"/>`
  return stWrap(190, 190, g)
}
function stCubeCut() {
  const W = 118, H = 118, d = [44, -30]
  const A = [55, 188], B = [A[0] + W, A[1]], A1 = [A[0], A[1] - H], B1 = [B[0], B[1] - H]
  const D = [A[0] + d[0], A[1] + d[1]], C = [B[0] + d[0], B[1] + d[1]]
  const D1 = [A1[0] + d[0], A1[1] + d[1]], C1 = [B1[0] + d[0], B1[1] + d[1]]
  const V = { A, B, C, D, A1, B1, C1, D1 }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const P = mid(A, B), Q = mid(B, C), T = mid(B, B1)
  let g = stPoly([P, Q, T], ST_FILL)
  const E = [["A", "B", 0], ["B", "C", 0], ["C", "D", 1], ["D", "A", 1],
  ["A1", "B1", 0], ["B1", "C1", 0], ["C1", "D1", 0], ["D1", "A1", 0],
  ["A", "A1", 0], ["B", "B1", 0], ["C", "C1", 0], ["D", "D1", 1]]
  for (const [p, q, hid] of E) g += stEdge(V[p], V[q], hid)
  g += stEdge(P, Q, 0); g += stEdge(Q, T, 0); g += stEdge(T, P, 0)
  return stWrap(280, 225, g)
}
// Скошенный (аффинный) эллипс: P(θ)=центр + cosθ·(ax,ay) + sinθ·(bx,by).
// (ax,ay),(bx,by) — сопряжённые полуоси; путём, чтобы толщина штриха не искажалась.
function stShearEllipse(cx, cy, ax, ay, bx, by, dash) {
  let dd = ""
  for (let i = 0; i <= 72; i++) {
    const t = i / 72 * 2 * Math.PI
    const x = cx + Math.cos(t) * ax + Math.sin(t) * bx, y = cy + Math.cos(t) * ay + Math.sin(t) * by
    dd += (i ? "L" : "M") + clean(x) + " " + clean(y) + " "
  }
  return `<path d="${dd}Z" fill="none" stroke="${ST_HI}" stroke-width="1.7"${dash ? ' stroke-dasharray="6 5"' : ""}/>`
}
function stCylInPar() {
  const W = 120, H = 120, d = [46, -30]
  const A = [55, 195], B = [A[0] + W, A[1]], A1 = [A[0], A[1] - H], B1 = [B[0], B[1] - H]
  const D = [A[0] + d[0], A[1] + d[1]], C = [B[0] + d[0], B[1] + d[1]]
  const D1 = [A1[0] + d[0], A1[1] + d[1]], C1 = [B1[0] + d[0], B1[1] + d[1]]
  const V = { A, B, C, D, A1, B1, C1, D1 }
  const ct = [(A1[0] + C1[0]) / 2, (A1[1] + C1[1]) / 2], cb = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2]
  let g = ""
  const E = [["A", "B", 0], ["B", "C", 0], ["C", "D", 1], ["D", "A", 1],
  ["A1", "B1", 0], ["B1", "C1", 0], ["C1", "D1", 0], ["D1", "A1", 0],
  ["A", "A1", 0], ["B", "B1", 0], ["C", "C1", 0], ["D", "D1", 1]]
  for (const [p, q, hid] of E) g += stEdge(V[p], V[q], hid)
  // вписанный эллипс грани = эллипс Штейнера: полуоси = половины сторон параллелограмма
  const ax = W / 2, ay = 0, bx = d[0] / 2, by = d[1] / 2
  const amp = Math.hypot(ax, bx), yo = (ay * ax + by * bx) / amp   // точка силуэта (крайняя по x)
  // образующие — по силуэтным точкам оснований
  g += `<line x1="${clean(cb[0] + amp)}" y1="${clean(cb[1] + yo)}" x2="${clean(ct[0] + amp)}" y2="${clean(ct[1] + yo)}" stroke="${ST_HI}" stroke-width="1.7"/>`
  g += `<line x1="${clean(cb[0] - amp)}" y1="${clean(cb[1] - yo)}" x2="${clean(ct[0] - amp)}" y2="${clean(ct[1] - yo)}" stroke="${ST_HI}" stroke-width="1.7"/>`
  g += stShearEllipse(ct[0], ct[1], ax, ay, bx, by, false)
  g += stShearEllipse(cb[0], cb[1], ax, ay, bx, by, true)
  return stWrap(280, 235, g)
}
// Многогранник из единичных кубов (изометрия). cells: [[x,y,z],...].
function stCubes(cells) {
  const s = 24
  const ux = [s * 0.92, s * 0.5], uy = [-s * 0.92, s * 0.5], uz = [0, -s]
  const P = (x, y, z) => [x * ux[0] + y * uy[0] + z * uz[0], x * ux[1] + y * uy[1] + z * uz[1]]
  const occ = new Set(cells.map(c => c.join(",")))
  const has = (x, y, z) => occ.has([x, y, z].join(","))
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9
  for (const [x, y, z] of cells) for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) {
    const p = P(x + dx, y + dy, z + dz)
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1])
  }
  const ox = 16 - minX, oy = 16 - minY
  const pt = (x, y, z) => { const p = P(x, y, z); return [clean(p[0] + ox), clean(p[1] + oy)] }
  const face = (pts, shade) => `<polygon points="${pts.map(p => p[0] + "," + p[1]).join(" ")}" fill="${shade}" stroke="${ST_INK}" stroke-width="1.3" stroke-linejoin="round"/>`
  const order = cells.slice().sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]))
  let g = ""
  for (const [x, y, z] of order) {
    if (!has(x, y, z + 1)) g += face([pt(x, y, z + 1), pt(x + 1, y, z + 1), pt(x + 1, y + 1, z + 1), pt(x, y + 1, z + 1)], "#f2f4f7")
    if (!has(x, y + 1, z)) g += face([pt(x, y + 1, z), pt(x + 1, y + 1, z), pt(x + 1, y + 1, z + 1), pt(x, y + 1, z + 1)], "#dfe3e8")
    if (!has(x + 1, y, z)) g += face([pt(x + 1, y, z), pt(x + 1, y + 1, z), pt(x + 1, y + 1, z + 1), pt(x + 1, y, z + 1)], "#cbd1d9")
  }
  return stWrap(clean(maxX - minX + 32), clean(maxY - minY + 32), g)
}

// целые a,b,c (2..9) с произведением, кратным k
function stTriple(k) {
  let a, b, c
  do { a = randInt(2, 9); b = randInt(2, 9); c = randInt(2, 9) } while ((a * b * c) % k !== 0)
  return [a, b, c]
}

// ── ГЕНЕРАТОРЫ ──────────────────────────────────────────────────────────────

// Тетраэдр в углу параллелепипеда (A,B,C,B₁): V = abc/6.
function t03BoxTetra() {
  const [a, b, c] = stTriple(6)
  return {
    condition_text: `В прямоугольном параллелепипеде ${BOXNAME} известно, что AB = ${a}, BC = ${b}, AA₁ = ${c}. Найдите объём многогранника, вершинами которого являются точки A, B, C, B₁.`,
    image_url: svgUrl(stBox({ highlight: [["A", "B", "C"], ["A", "B", "B1"], ["B", "C", "B1"], ["A", "C", "B1"]], edgeLabels: { AB: ru(a), BC: ru(b), AA1: ru(c) } })),
    answer: ru(a * b * c / 6),
  }
}
// Пирамида: основание ABCD + верхняя вершина: V = abc/3.
function t03BoxPyr() {
  const [a, b, c] = stTriple(3)
  const apex = pick(["A1", "B1", "C1", "D1"])
  const el = { A1: { e1: "AB", e2: "AD", v: "AA₁" }, B1: { e1: "AB", e2: "BC", v: "BB₁" }, C1: { e1: "BC", e2: "CD", v: "CC₁" }, D1: { e1: "AD", e2: "CD", v: "DD₁" } }[apex]
  const eff = {}; eff[el.e1] = el.e1 === "AB" || el.e1 === "CD" ? ru(a) : ru(b); eff[el.e2] = el.e2 === "AB" || el.e2 === "CD" ? ru(a) : ru(b); eff[el.v.replace("₁", "1")] = ru(c)
  return {
    condition_text: `В прямоугольном параллелепипеде ${BOXNAME} известно, что ${el.e1[0]}${el.e1[1]} = ${el.e1 === "AB" || el.e1 === "CD" ? a : b}, ${el.e2[0]}${el.e2[1]} = ${el.e2 === "AB" || el.e2 === "CD" ? a : b}, ${el.v} = ${c}. Найдите объём многогранника, вершинами которого являются точки A, B, C, D, ${VSUB[apex]}.`,
    image_url: svgUrl(stBox({ highlight: stPyrFaces(apex), edgeLabels: eff })),
    answer: ru(a * b * c / 3),
  }
}
// Половина параллелепипеда (6 вершин, призма): V = abc/2.
function t03BoxHalf() {
  const [a, b, c] = stTriple(2)
  const variant = pick([
    { verts: "A, B, C, D, A₁, B₁", hl: [["A", "B", "B1", "A1"], ["A", "B", "C", "D"], ["A", "D", "A1"], ["B", "C", "B1"]] },
    { verts: "A, B, C, A₁, B₁, C₁", hl: [["A", "B", "B1", "A1"], ["A", "B", "C"], ["A1", "B1", "C1"], ["B", "C", "C1", "B1"], ["A", "C", "C1", "A1"]] },
  ])
  return {
    condition_text: `В прямоугольном параллелепипеде ${BOXNAME} известно, что AB = ${a}, BC = ${b}, AA₁ = ${c}. Найдите объём многогранника, вершинами которого являются точки ${variant.verts}.`,
    image_url: svgUrl(stBox({ highlight: variant.hl, edgeLabels: { AB: ru(a), BC: ru(b), AA1: ru(c) } })),
    answer: ru(a * b * c / 2),
  }
}
// Правильная треугольная призма: тетраэдр «основание + верхняя вершина»: V = S·L/3.
function t03PrismTetra() {
  let S, L; do { S = randInt(2, 12); L = randInt(3, 12) } while ((S * L) % 3 !== 0)
  const apex = pick(["A1", "B1", "C1"])
  const base = ["A", "B", "C"]
  return {
    condition_text: `Найдите объём многогранника, вершинами которого являются вершины A, B, C, ${VSUB[apex]} правильной треугольной призмы ${PRISMNAME}, площадь основания которой равна ${S}, а боковое ребро равно ${L}.`,
    image_url: svgUrl(stPrism3({ highlight: [base, [base[0], base[2], apex], [base[1], base[2], apex], [base[0], base[1], apex]] })),
    answer: ru(S * L / 3),
  }
}
// Правильная треугольная призма: 5-вершинный кусок (призма минус тетраэдр): V = 2·S·L/3.
function t03PrismBig() {
  let S, L; do { S = randInt(2, 12); L = randInt(3, 12) } while ((S * L) % 3 !== 0)
  // убираем тетраэдр с вершиной в одной нижней точке; берём A → часть B,C,A₁,B₁,C₁
  const drop = pick([["A", "B, C, A₁, B₁, C₁", [["B", "C", "C1", "B1"], ["A1", "B1", "C1"], ["B", "C", "A1"]]],
  ["B", "A, C, A₁, B₁, C₁", [["A", "C", "C1", "A1"], ["A1", "B1", "C1"], ["A", "C", "B1"]]]])
  return {
    condition_text: `Дана правильная треугольная призма ${PRISMNAME}, площадь основания которой равна ${S}, а боковое ребро равно ${L}. Найдите объём многогранника, вершинами которого являются точки ${drop[1]}.`,
    image_url: svgUrl(stPrism3({ highlight: drop[2] })),
    answer: ru(2 * S * L / 3),
  }
}
// Средняя линия основания призмы: объём отсечённой = ¼ исходной.
function t03MidVolCut() {
  const reg = pick(["", "правильной "])
  const V = randInt(2, 25) * 4
  return {
    condition_text: `Через среднюю линию основания ${reg}треугольной призмы, объём которой равен ${V}, проведена плоскость, параллельная боковому ребру. Найдите объём отсечённой треугольной призмы.`,
    image_url: svgUrl(stPrism3({ midline: true })),
    answer: ru(V / 4),
  }
}
function t03MidVolWhole() {
  const W = randInt(3, 30)
  return {
    condition_text: `Через среднюю линию основания треугольной призмы проведена плоскость, параллельная боковому ребру. Найдите объём этой призмы, если объём отсечённой треугольной призмы равен ${W}.`,
    image_url: svgUrl(stPrism3({ midline: true })),
    answer: ru(4 * W),
  }
}
// Средняя линия: площадь боковой поверхности отсечённой = ½ исходной.
function t03MidLatCut() {
  const S = randInt(4, 30) * 2
  return {
    condition_text: `Площадь боковой поверхности треугольной призмы равна ${S}. Через среднюю линию основания призмы проведена плоскость, параллельная боковому ребру. Найдите площадь боковой поверхности отсечённой треугольной призмы.`,
    image_url: svgUrl(stPrism3({ midline: true })),
    answer: ru(S / 2),
  }
}
function t03MidLatWhole() {
  const S = randInt(4, 40)
  return {
    condition_text: `Через среднюю линию основания треугольной призмы проведена плоскость, параллельная боковому ребру. Площадь боковой поверхности отсечённой треугольной призмы равна ${S}. Найдите площадь боковой поверхности исходной призмы.`,
    image_url: svgUrl(stPrism3({ midline: true })),
    answer: ru(2 * S),
  }
}
// Цилиндр и конус: общие основание и высота. V_конуса = V_цил/3.
function t03CylConeVolCone() {
  const V = randInt(2, 30) * 3
  return {
    condition_text: `Цилиндр и конус имеют общие основание и высоту. Объём цилиндра равен ${V}. Найдите объём конуса.`,
    image_url: svgUrl(stCylCone()),
    answer: ru(V / 3),
  }
}
function t03CylConeVolCyl() {
  const V = randInt(2, 40)
  return {
    condition_text: `Цилиндр и конус имеют общие основание и высоту. Объём конуса равен ${V}. Найдите объём цилиндра.`,
    image_url: svgUrl(stCylCone()),
    answer: ru(3 * V),
  }
}
// Цилиндр/конус, h = R: S_бок цил = √2 · S_бок конуса.
function t03CylConeLatCyl() {
  const k = randInt(2, 12)
  return {
    condition_text: `Цилиндр и конус имеют общие основание и высоту. Высота цилиндра равна радиусу основания. Площадь боковой поверхности конуса равна ${k}${R2}. Найдите площадь боковой поверхности цилиндра.`,
    image_url: svgUrl(stCylCone()),
    answer: ru(2 * k),
  }
}
function t03CylConeLatCone() {
  const k = randInt(2, 12)
  return {
    condition_text: `Цилиндр и конус имеют общие основание и высоту. Высота цилиндра равна радиусу основания. Площадь боковой поверхности цилиндра равна ${k}${R2}. Найдите площадь боковой поверхности конуса.`,
    image_url: svgUrl(stCylCone()),
    answer: ru(k),
  }
}
// Конус вписан в шар, R_осн = R_шара: V_шара = 4·V_конуса.
function t03ConeInSphereBig() {
  const V = randInt(2, 30)
  return {
    condition_text: `Конус вписан в шар. Радиус основания конуса равен радиусу шара. Объём конуса равен ${V}. Найдите объём шара.`,
    image_url: svgUrl(stConeInSphere()),
    answer: ru(4 * V),
  }
}
function t03ConeInSphereSmall() {
  const V = randInt(2, 25) * 4
  return {
    condition_text: `Конус вписан в шар. Радиус основания конуса равен радиусу шара. Объём шара равен ${V}. Найдите объём конуса.`,
    image_url: svgUrl(stConeInSphere()),
    answer: ru(V / 4),
  }
}
// Шар вписан в цилиндр: S_шара = ⅔·S_полн цилиндра.
function t03SphereInCylSurf() {
  const S = randInt(2, 20) * 3
  return {
    condition_text: `Шар вписан в цилиндр. Площадь полной поверхности цилиндра равна ${S}. Найдите площадь поверхности шара.`,
    image_url: svgUrl(stSphereInCyl()),
    answer: ru(2 * S / 3),
  }
}
// Шар вписан в цилиндр (объёмы): V_цил = 1,5·V_шара; и «цилиндр описан около шара».
function t03SphereCylVolFromSphere() {
  const V = randInt(2, 30) * 2
  return {
    condition_text: `Шар, объём которого равен ${V}, вписан в цилиндр. Найдите объём цилиндра.`,
    image_url: svgUrl(stSphereInCyl()),
    answer: ru(3 * V / 2),
  }
}
function t03SphereCylVolFromCyl() {
  const V = randInt(2, 20) * 3
  return {
    condition_text: `Цилиндр, объём которого равен ${V}, описан около шара. Найдите объём шара.`,
    image_url: svgUrl(stSphereInCyl()),
    answer: ru(2 * V / 3),
  }
}
// Во сколько раз изменится объём конуса при изменении радиуса/высоты.
function t03ConeScale() {
  const n = randInt(2, 12)
  if (Math.random() < 0.5) {
    return { condition_text: `Во сколько раз увеличится объём конуса, если радиус его основания увеличится в ${n} раз, а высота останется прежней?`, image_url: svgUrl(stCone()), answer: ru(n * n) }
  }
  return { condition_text: `Во сколько раз уменьшится объём конуса, если его высота уменьшится в ${n} раз, а радиус основания останется прежним?`, image_url: svgUrl(stCone()), answer: ru(n) }
}
// Два цилиндра: V₂ = V₁ · q²/p (высота в p раз меньше, радиус в q раз больше).
function t03TwoCyl() {
  const p = pick([2, 3, 4]), q = pick([2, 3])
  const base = randInt(2, 12), V1 = base * p // делится на p
  const V2 = V1 * q * q / p
  return {
    condition_text: `Даны два цилиндра. Объём первого цилиндра равен ${V1}. У второго цилиндра высота в ${p} раза меньше, а радиус основания в ${q} раза больше, чем у первого. Найдите объём второго цилиндра.`,
    image_url: svgUrl(stTwoCyl()),
    answer: ru(V2),
  }
}
// Сфера описана около конуса, центр в центре основания: l = R·√2.
function t03ConeCircumR() {
  const k = randInt(2, 20)
  return {
    condition_text: `Около конуса описана сфера (сфера содержит окружность основания конуса и его вершину). Центр сферы находится в центре основания конуса. Образующая конуса равна ${k}${R2}. Найдите радиус сферы.`,
    image_url: svgUrl(stConeCircumSphere()),
    answer: ru(k),
  }
}
function t03ConeCircumL() {
  const k = randInt(2, 90)
  return {
    condition_text: `Около конуса описана сфера (сфера содержит окружность основания конуса и его вершину). Центр сферы находится в центре основания конуса. Радиус сферы равен ${k}${R2}. Найдите длину образующей конуса.`,
    image_url: svgUrl(stConeCircumSphere()),
    answer: ru(2 * k),
  }
}
// Цилиндр вписан в прямоугольный параллелепипед: V = 4·r²·h (при r = h).
function t03CylInPar() {
  const r = randInt(2, 9)
  return {
    condition_text: `Цилиндр вписан в прямоугольный параллелепипед. Радиус основания и высота цилиндра равны ${r}. Найдите объём параллелепипеда.`,
    image_url: svgUrl(stCylInPar()),
    answer: ru(4 * r * r * r),
  }
}
// Куб: отсечённая угловая треугольная призма: V = V_куба/8.
function t03CubeCut() {
  const V = randInt(2, 30) * 8
  return {
    condition_text: `Объём куба равен ${V}. Найдите объём треугольной призмы, отсекаемой от куба плоскостью, проходящей через середины двух рёбер, выходящих из одной вершины, и параллельной третьему ребру, выходящему из этой же вершины.`,
    image_url: svgUrl(stCubeCut()),
    answer: ru(V / 8),
  }
}
// Сечение шара через центр: S_шара = 4·S_сечения.
function t03SphereSection() {
  const S = randInt(2, 40)
  return {
    condition_text: `Площадь сечения шара плоскостью, проходящей через центр шара, равна ${S}. Найдите площадь поверхности шара.`,
    image_url: svgUrl(stSphere({ section: true })),
    answer: ru(4 * S),
  }
}
// Случайный связный поликуб (5..9 кубиков) для типажей «объём/площадь из кубиков».
function stRandPolycube() {
  const cells = [[0, 0, 0]]
  const key = (c) => c.join(",")
  const set = new Set([key([0, 0, 0])])
  const n = randInt(5, 9)
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
  let guard = 0
  while (cells.length < n && guard++ < 400) {
    const base = pick(cells), d = pick(dirs)
    const nc = [base[0] + d[0], base[1] + d[1], base[2] + d[2]]
    if (nc[2] < 0) continue
    if (!set.has(key(nc))) { set.add(key(nc)); cells.push(nc) }
  }
  return cells
}
function t03CubesVolume() {
  const cells = stRandPolycube()
  return {
    condition_text: `На рисунке изображён многогранник, составленный из одинаковых кубов с ребром 1. Найдите его объём.`,
    image_url: svgUrl(stCubes(cells)),
    answer: ru(cells.length),
  }
}
function t03CubesSurface() {
  const cells = stRandPolycube()
  const set = new Set(cells.map(c => c.join(",")))
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
  let faces = 0
  for (const c of cells) for (const d of dirs) if (!set.has([c[0] + d[0], c[1] + d[1], c[2] + d[2]].join(","))) faces++
  return {
    condition_text: `На рисунке изображён многогранник, составленный из одинаковых кубов с ребром 1. Найдите площадь его поверхности.`,
    image_url: svgUrl(stCubes(cells)),
    answer: ru(faces),
  }
}

// ============================================================================
// Реестр и мета-темы
// ============================================================================

export const GENERATORS_EGE_PROF = {
  2: [t02DotCoord, t02DotLenAngle, t02LenCombo, t02DotOfCombos, t02GraphLenCombo],
  3: [t03BoxTetra, t03BoxPyr, t03BoxHalf, t03PrismTetra, t03PrismBig,
    t03MidVolCut, t03MidVolWhole, t03MidLatCut, t03MidLatWhole,
    t03CylConeVolCone, t03CylConeVolCyl, t03CylConeLatCyl, t03CylConeLatCone,
    t03ConeInSphereBig, t03ConeInSphereSmall, t03SphereInCylSurf,
    t03SphereCylVolFromSphere, t03SphereCylVolFromCyl, t03ConeScale, t03TwoCyl,
    t03ConeCircumR, t03ConeCircumL, t03CylInPar, t03CubeCut, t03SphereSection,
    t03CubesVolume, t03CubesSurface],
  4: [t04ShotPut, t04Gymnastics, t04Diving, t04Tickets, t04Markers, t04Defect, t04Lottery, t04CoinTwice, t04Rooms, t04FootballCoin],
  5: [t05Lamps, t05Between, t05Shooter4, t05Coffee, t05Battery, t05ShooterN, t05DiceCond, t05TwoThemes, t05Exact],
  6: [t06ExpReduce, t06ExpBothSides, t06LogEqLog, t06LogEqNum, t06Rational, t06Cube, t06Sqrt, t06CubeRoot],
  7: [t07PowPowDiv, t07PowFracExp, t07SqCoefRoot, t07DistribRoot, t07LogSum, t07LogDiff, t07LogRatio, t07TrigDouble],
  8: [
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
  9: [t09MotoAccel, t09CarDist, t09CarAcc, t09Horizon, t09Decay, t09Winding, t09Ball, t09Heater,
    t09Ohm, t09Parallel, t09EMF, t09Doppler, t09DiverWork, t09Collision],
  10: [t10SteamboatSpeed, t10SteamboatCurrent, t10SteamboatDist, t10AvgTime, t10AvgDist, t10TwoCyclists,
    t10Barge, t10BoatCurrent, t10BoatSpeed, t10Meeting, t10TwoBoats, t10Alloy, t10Workers, t10Pipes,
    t10JointWork, t10Weed, t10TrainLength],
  // Только задания с источником ФИПИ (старый банк). Прочие (MATHEGE/Демо) исключены.
  11: [t11LinValue, t11QuadRead, t11HypBasic, t11ExpValue, t11LogValue,
    () => t11TwoLines(false), t11ParabLineK, () => t11HypLine(false), t11RootLineK],
  12: [t12CubicPoint, t12LnPoint, t12X32Point, t12QuadLnPoint, t12LnMaxValue, t12X32MinValue],
}

export const GEN_META_EGE_PROF = {
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
    ["box-pyr", "Пирамида на основании ABCD (÷3)", t03BoxPyr],
    ["box-half", "Половина параллелепипеда (÷2)", t03BoxHalf],
  ]],
    ["Правильная треугольная призма: объём части", [
      ["prism-tetra", "Тетраэдр A,B,C,C₁ (S·L/3)", t03PrismTetra],
      ["prism-big", "5 вершин (2·S·L/3)", t03PrismBig],
    ]],
    ["Средняя линия призмы", [
      ["mid-vol-cut", "Объём отсечённой (÷4)", t03MidVolCut],
      ["mid-vol-whole", "Объём исходной (×4)", t03MidVolWhole],
      ["mid-lat-cut", "Бок. пов. отсечённой (÷2)", t03MidLatCut],
      ["mid-lat-whole", "Бок. пов. исходной (×2)", t03MidLatWhole],
    ]],
    ["Цилиндр и конус (общие осн. и высота)", [
      ["cc-vol-cone", "Объём конуса (÷3)", t03CylConeVolCone],
      ["cc-vol-cyl", "Объём цилиндра (×3)", t03CylConeVolCyl],
      ["cc-lat-cyl", "Бок. пов. цилиндра (h=R)", t03CylConeLatCyl],
      ["cc-lat-cone", "Бок. пов. конуса (h=R)", t03CylConeLatCone],
    ]],
    ["Тела вращения: вписанные", [
      ["cone-sph-big", "Конус в шаре → объём шара (×4)", t03ConeInSphereBig],
      ["cone-sph-small", "Конус в шаре → объём конуса (÷4)", t03ConeInSphereSmall],
      ["sph-cyl-surf", "Шар в цилиндре → пов. шара (⅔)", t03SphereInCylSurf],
      ["sph-cyl-vol-s", "Шар в цилиндре → объём цил. (×1,5)", t03SphereCylVolFromSphere],
      ["sph-cyl-vol-c", "Цил. около шара → объём шара (⅔)", t03SphereCylVolFromCyl],
    ]],
    ["Тела вращения: прочее", [
      ["cone-scale", "Во сколько раз изменится объём конуса", t03ConeScale],
      ["two-cyl", "Два цилиндра (q²/p)", t03TwoCyl],
      ["cone-circ-r", "Сфера около конуса → радиус", t03ConeCircumR],
      ["cone-circ-l", "Сфера около конуса → образующая", t03ConeCircumL],
      ["cyl-in-par", "Цилиндр в параллелепипеде", t03CylInPar],
      ["sph-section", "Сечение шара через центр (×4)", t03SphereSection],
    ]],
    ["Куб и многогранники из кубиков", [
      ["cube-cut", "Отсечённая призма от куба (÷8)", t03CubeCut],
      ["cubes-vol", "Объём фигуры из кубиков", t03CubesVolume],
      ["cubes-surf", "Площадь поверхности из кубиков", t03CubesSurface],
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
  6: [["Показательные", [
    ["exp-reduce", "Свести к основанию", t06ExpReduce],
    ["exp-both", "Обе части — степени", t06ExpBothSides],
  ]],
    ["Логарифмические", [
      ["log-log", "log=log", t06LogEqLog],
      ["log-num", "log=число", t06LogEqNum],
    ]],
    ["Корни и степени", [
      ["cube", "Кубическое (x+s)³=V", t06Cube],
      ["sqrt", "Квадратный корень", t06Sqrt],
      ["cube-root", "Кубический корень", t06CubeRoot],
    ]],
    ["Дробно-рациональные", [["rational", "1/(ax+b)=c", t06Rational]]]],
  7: [["Степени", [
    ["pow-div", "Степень степени (частное)", t07PowPowDiv],
    ["pow-frac", "Дробные показатели", t07PowFracExp],
  ]],
    ["Корни", [
      ["sq-coef-root", "((k√A)²)/D", t07SqCoefRoot],
      ["distrib-root", "(√A−√B)·√c", t07DistribRoot],
    ]],
    ["Логарифмы", [
      ["log-sum", "Сумма логарифмов", t07LogSum],
      ["log-diff", "Разность логарифмов", t07LogDiff],
      ["log-ratio", "Отношение логарифмов", t07LogRatio],
    ]],
    ["Тригонометрия", [["trig-double", "Двойной угол cos2α", t07TrigDouble]]]],
  8: [["График f(x): знак производной", [
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
  9: [["Кинематика", [
    ["moto", "Разгон мотоциклиста (t)", t09MotoAccel],
    ["car-dist", "Разгон авто: путь", t09CarDist],
    ["car-acc", "Разгон авто: ускорение", t09CarAcc],
    ["horizon", "Линия горизонта", t09Horizon],
    ["ball", "Мяч (высота ≥ H)", t09Ball],
    ["winding", "Намотка кабеля", t09Winding],
  ]],
    ["Тепло и распад", [
      ["decay", "Радиоактивный распад", t09Decay],
      ["heater", "Нагреватель (Tmax)", t09Heater],
      ["diver", "Сжатие воздуха (log₂)", t09DiverWork],
      ["collision", "Неупругое соударение", t09Collision],
    ]],
    ["Электричество", [
      ["ohm", "Закон Ома (min R)", t09Ohm],
      ["parallel", "Параллельное соединение", t09Parallel],
      ["emf", "ЭДС и нагрузка", t09EMF],
      ["doppler", "Эффект Доплера", t09Doppler],
    ]]],
  10: [["Движение по воде", [
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
  // Только типажи с источником ФИПИ (старый банк) — 9 шт.
  11: [["Чтение значения f(x₀)", [
    ["lin-val", "Линейная kx+b", t11LinValue],
    ["quad-read", "Парабола ax²+bx+c", t11QuadRead],
    ["hyp-basic", "Гипербола k/x", t11HypBasic],
    ["exp-val", "Показательная aˣ", t11ExpValue],
    ["log-val", "Логарифм logₐx", t11LogValue],
  ]],
    ["Пересечения графиков", [
      ["2lines-x", "Две прямые: абсцисса", () => t11TwoLines(false)],
      ["par-kx", "Парабола + g=kx: абсцисса B", t11ParabLineK],
      ["hyp-line-x", "Гипербола + g=ax+b: абсцисса B", () => t11HypLine(false)],
      ["root-kx", "Корень + g=kx: абсцисса B", t11RootLineK],
    ]]],
  12: [["Точка экстремума", [
    ["cubic", "Кубическая", t12CubicPoint],
    ["ln-point", "Логарифм со сдвигом", t12LnPoint],
    ["x32-point", "Степенная x√x", t12X32Point],
    ["quad-ln", "Квадрат + логарифм", t12QuadLnPoint],
  ]],
    ["Наибольшее / наименьшее значение", [
      ["ln-max", "Логарифм (наибольшее)", t12LnMaxValue],
      ["x32-min", "Степенная (наименьшее)", t12X32MinValue],
    ]]],
}
