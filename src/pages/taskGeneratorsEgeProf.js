// Генераторы ЕГЭ математика (ПРОФИЛЬНЫЙ уровень) — предмет «ЕГЭ Профиль».
//
// Эталон типажей — открытый банк ФИПИ (fipi_bank_ege_prof/tasks.json). Каждый шаблон
// воспроизводит реальный тип задания банка (та же формулировка, свои числа); правильный
// ответ считается кодом (или РЕШАЕТСЯ из показанных чисел), поэтому гарантированно верен.
//
// Этап 1 — только задания БЕЗ чертежей/схем (короткий ответ, номера 2,4,5,6,7,9,10,12).
// №1 планиметрия и №3 стереометрия без чертежа не бывают → в этот этап не входят.
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
  return `<text x="${lx}" y="${ly}" font-size="17" font-style="italic" font-weight="bold" fill="#1c1c1e" text-anchor="middle">${letter}</text>` +
    `<line x1="${lx - 5}" y1="${ly - 15}" x2="${lx + 6}" y2="${ly - 15}" stroke="#1c1c1e" stroke-width="1.3"/>` +
    `<polygon points="${lx + 7},${ly - 15} ${lx + 2},${ly - 17.4} ${lx + 2},${ly - 12.6}" fill="#1c1c1e"/>`
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
  g += `<text x="${X(gx1) - 3}" y="${Y(0) + 17}" font-size="15" font-style="italic" font-weight="bold" fill="#1c1c1e" text-anchor="end">x</text>`
  g += `<text x="${X(0) + 7}" y="${Y(gy1) + 13}" font-size="15" font-style="italic" font-weight="bold" fill="#1c1c1e">y</text>`
  g += `<text x="${X(0) - 5}" y="${Y(0) + 16}" font-size="13" font-weight="bold" fill="#1c1c1e" text-anchor="end">0</text>`
  g += `<text x="${X(1)}" y="${Y(0) + 16}" font-size="12" fill="#1c1c1e" text-anchor="middle">1</text>`
  g += `<text x="${X(0) - 6}" y="${Y(1) + 4}" font-size="12" fill="#1c1c1e" text-anchor="end">1</text>`
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
  const baseStr = frac ? fT(1, b) : String(b)
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
  const leftBase = sL === -1 ? fT(1, b) : String(b)
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
  // Индекс степени 3 надстрочником + SVG-радикал (rT) с чертой над подкоренным —
  // единый вид с квадратным корнем; сырой юникод ∛ рвёт согласованность и не тянет черту.
  const inner = `x${signed(b)}`.replace("+0", "").replace("−0", "")
  return {
    condition_text: `Найдите корень уравнения ${sup(3)}${rT(inner)}=${c}.`,
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
  g += `<text x="${X(gx1) - 3}" y="${Y(0) + 17}" font-size="15" font-style="italic" font-weight="bold" fill="${G_AX}" text-anchor="end">x</text>`
  g += `<text x="${X(0) + 7}" y="${Y(gy1) + 13}" font-size="15" font-style="italic" font-weight="bold" fill="${G_AX}">y</text>`
  g += `<text x="${X(0) - 5}" y="${Y(0) + 16}" font-size="13" font-weight="bold" fill="${G_AX}" text-anchor="end">0</text>`
  if (xticks) { for (const t of xticks) if (t.x >= gx0 && t.x <= gx1 && t.x !== 0) g += `<text x="${X(t.x)}" y="${Y(0) + 16}" font-size="12" fill="${G_AX}" text-anchor="middle">${t.text}</text>` }
  else if (gx0 <= 1 && gx1 >= 1) g += `<text x="${X(1)}" y="${Y(0) + 16}" font-size="12" fill="${G_AX}" text-anchor="middle">${unitX}</text>`
  if (gy0 <= 1 && gy1 >= 1) g += `<text x="${X(0) - 6}" y="${Y(1) + 4}" font-size="12" fill="${G_AX}" text-anchor="end">1</text>`
  // жирные точки
  for (const [x, y] of dots) g += `<circle cx="${X(x)}" cy="${Y(y)}" r="2.8" fill="${G_AX}"/>`
  // произвольные подписи
  for (const L of labels) g += `<text x="${X(L.x)}" y="${Y(L.y)}" font-size="${L.size || 13}" ${L.italic ? 'font-style="italic" ' : ""}fill="${G_AX}" text-anchor="${L.anchor || "start"}">${L.text}</text>`
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

function t11LinArg() {
  const { k, b, gx0, gx1, gy0, gy1 } = pickLine([0.5, 1.5, -0.5, -1.5, 1, 2, -1, -2])
  let xa
  do { xa = pick([-9, -8, -7, -6, 6, 7, 8, 9]) } while (Math.abs(k * xa + b) > 40)
  const y0 = k * xa + b
  const fn = (x) => k * x + b
  const svg = fnGridSvg({ gx0, gx1, gy0, gy1, plots: [{ fn, xa: gx0, xb: gx1 }], labels: [fLabelAt(fn, gx0, gx1, gy0, gy1, { preferRight: k > 0 })] })
  return {
    condition_text: `На рисунке изображён график функции f(x) = kx + b. Найдите значение x, при котором f(x) = ${ru(y0)}.`,
    image_url: svgUrl(svg),
    answer: ru(xa),
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
// Точка вне окна (для «восстанови коэффициенты и посчитай f(x0)»).
function farNode(P, cap = 260) {
  let x0
  do { x0 = pick([-12, -11, -10, -9, -8, -7, -6, 6, 7, 8, 9, 10, 11, 12]) } while ((x0 >= P.gx0 && x0 <= P.gx1) || Math.abs(P.fn(x0)) > cap)
  return x0
}

// #3/#4 — общая парабола, прочитать f(x0) в окне.
function t11QuadRead(intForm) {
  const P = pickQuad(), x0 = inWindowNode(P)
  const cond = intForm
    ? `На рисунке изображён график функции f(x) = ax² + bx + c, где числа a, b и c — целые. Найдите f(${ru(x0)}).`
    : `На рисунке изображён график функции вида f(x) = ax² + bx + c. Найдите значение f(${ru(x0)}).`
  return { condition_text: cond, image_url: parabSvg(P), answer: ru(P.fn(x0)) }
}

// #5 — целые a,b,c, значение вдалеке.
function t11QuadFar() {
  const P = pickQuad(), x0 = farNode(P)
  return {
    condition_text: `На рисунке изображён график функции вида f(x) = ax² + bx + c, где числа a, b и c — целые. Найдите значение f(${ru(x0)}).`,
    image_url: parabSvg(P), answer: ru(P.fn(x0)),
  }
}

// #6–#11 — один коэффициент задан в формуле, f(x0) вдалеке.
function t11QuadFixed(spec, formula) {
  const P = pickQuad(spec), x0 = farNode(P)
  return { condition_text: `На рисунке изображён график функции f(x) = ${formula}. Найдите f(${ru(x0)}).`, image_url: parabSvg(P), answer: ru(P.fn(x0)) }
}

const t11QuadA2neg = () => t11QuadFixed({ a: -2 }, "−2x² + bx + c")
const t11QuadA2pos = () => t11QuadFixed({ a: 2 }, "2x² + bx + c")
const t11QuadBm4 = () => t11QuadFixed({ b: -4 }, "ax² − 4x + c")
const t11QuadBm3 = () => t11QuadFixed({ b: -3 }, "ax² − 3x + c")
const t11QuadCm3 = () => t11QuadFixed({ c: -3 }, "ax² + bx − 3")
const t11QuadCm6 = () => t11QuadFixed({ c: -6 }, "ax² + bx − 6")

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
// #14 — f(x)=k/x+a, найти f(x0).
function t11HypShiftVValue() {
  const a = pick([1, 2, 3, -1, -2, -3])
  const H = pickHyp(0, a)
  const x0 = hypX0(H)
  return { condition_text: `На рисунке изображён график функции f(x) = ⟦f:k:x⟧ + a. Найдите f(${ru(x0)}).`, image_url: hypSvg(H), answer: ru(clean(H.fn(x0))) }
}
// #15 — f(x)=k/x+a, найти x при f(x)=V.
function t11HypShiftVArg() {
  const a = pick([1, 2, 3, -1, -2, -3])
  const H = pickHyp(0, a)
  const cand = NICE_D.filter((d) => isTerm(H.K, d)).map((d) => d)
  const d = pick(cand); const xAns = d; const V = clean(H.fn(xAns))
  return { condition_text: `На рисунке изображён график функции f(x) = ⟦f:k:x⟧ + a. Найдите значение x, при котором f(x) = ${ru(V)}.`, image_url: hypSvg(H), answer: ru(xAns) }
}
// #16 — f(x)=k/(x+a), найти f(x0).  (p=−a, q=0)
function t11HypShiftHValue() {
  const a = pick([1, 2, 3, -1, -2, -3])
  const H = pickHyp(-a, 0)
  const x0 = hypX0(H)
  return { condition_text: `На рисунке изображён график функции f(x) = ⟦f:k:x${signed(a)}⟧. Найдите f(${ru(x0)}).`, image_url: hypSvg(H), answer: ru(clean(H.fn(x0))) }
}
// #17 — f(x)=k/(x+a), найти x при f(x)=V.
function t11HypShiftHArg() {
  const a = pick([1, 2, 3, -1, -2, -3])
  const H = pickHyp(-a, 0)
  const d = pick(NICE_D.filter((dd) => isTerm(H.K, dd)))
  const xAns = H.p + d; const V = clean(H.fn(xAns))
  return { condition_text: `На рисунке изображён график функции вида f(x) = ⟦f:k:x${signed(a)}⟧. Найдите значение x, при котором f(x) = ${ru(V)}.`, image_url: hypSvg(H), answer: ru(xAns) }
}
// #18/#19 — f(x)=(kx+a)/(x+b): вертик. x=−b, гориз. y=k, K=a−kb.  Найти a или k.
function pickBilinear() {
  for (let t = 0; t < 400; t++) {
    const k = pick([1, 2, 3, -1, -2, -3]), b = pick([1, 2, 3, -1, -2, -3])
    const K = pick(HYP_K.filter((x) => x !== 0))
    const a = K + k * b // из K=a−kb
    const H = makeHyp(K, -b, k)
    if (hypNodes(H) >= 4) return { H, k, a, b }
  }
  const k = 2, b = 1, K = 3, a = K + k * b
  return { H: makeHyp(K, -b, k), k, a, b }
}
function t11BilinearA() {
  const { H, a } = pickBilinear()
  return { condition_text: `На рисунке изображён график функции f(x) = ⟦f:kx+a:x+b⟧. Найдите a.`, image_url: hypSvg(H), answer: ru(a) }
}
function t11BilinearK() {
  const { H, k } = pickBilinear()
  return { condition_text: `На рисунке изображён график функции f(x) = ⟦f:kx+a:x+b⟧. Найдите k.`, image_url: hypSvg(H), answer: ru(k) }
}

// ---- D. Корень f(x)=k√x ----------------------------------------------------
function makeRoot(k) {
  const fn = (x) => (x < 0 ? NaN : k * Math.sqrt(x))
  return { k, fn, gx0: -1, gx1: 9, gy0: k > 0 ? -1 : -8, gy1: k > 0 ? 8 : 1 }
}
function rootSvg(R) {
  return svgUrl(fnGridSvg({
    gx0: R.gx0, gx1: R.gx1, gy0: R.gy0, gy1: R.gy1,
    plots: [{ fn: R.fn, xa: 0, xb: R.gx1 }],
    labels: [fLabelAt(R.fn, R.gx0, R.gx1, R.gy0, R.gy1, { preferRight: true })],
  }))
}
const ROOT_DEC = [1.2, 1.4, 1.6, 1.8, 2.2, 2.4, 2.6, 2.8, 3.2, 3.4] // √x0 — красивые десятичные
// #20 — f(x)=k√x, найти f(x0) (x0=r²).
function t11RootValue() {
  const k = pick([1, 2, 3, -1, -2, -3]), R = makeRoot(k)
  const r = pick(ROOT_DEC), x0 = clean(r * r)
  return { condition_text: `На рисунке изображён график функции f(x) = k${rT("x")}. Найдите f(${ru(x0)}).`, image_url: rootSvg(R), answer: ru(clean(k * r)) }
}
// #21 — f(x)=k√x, найти x при f(x)=V.
function t11RootArg() {
  const k = pick([1, 2, 3, -1, -2, -3]), R = makeRoot(k)
  const root = pick([2, 3, 4, 5, 6, 7]), xAns = root * root, V = k * root
  return { condition_text: `На рисунке изображён график функции f(x) = k${rT("x")}. Найдите значение x, при котором f(x) = ${ru(V)}.`, image_url: rootSvg(R), answer: ru(xAns) }
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
// #24 — f(x)=aˣ+b, найти f(x0).
function t11ExpShiftValue() {
  const { B, dir, a } = pickExpBase(), q = pick([1, 2, 3, -1, -2, -3])
  const x0 = expIntX0(B, dir), E = makeExp(a, 0, q)
  return { condition_text: `На рисунке изображён график функции f(x) = a${supT("x")} + b. Найдите f(${ru(x0)}).`, image_url: expSvg(E), answer: ru(clean(powRat(B, dir, x0) + q)) }
}
// #25 — f(x)=aˣ+b, найти x при f(x)=V.
function t11ExpShiftArg() {
  const { B, dir, a } = pickExpBase(), q = pick([1, 2, 3, -1, -2, -3])
  const xAns = expIntX0(B, dir), E = makeExp(a, 0, q)
  const V = clean(powRat(B, dir, xAns) + q)
  return { condition_text: `На рисунке изображён график функции f(x) = a${supT("x")} + b. Найдите значение x, при котором f(x) = ${ru(V)}.`, image_url: expSvg(E), answer: ru(xAns) }
}
// #26 — f(x)=a^(x+b), найти f(x0).
function t11ExpHShiftValue() {
  const { B, dir, a } = pickExpBase(), s = pick([1, 2, -1, -2])
  let x0; do { x0 = randInt(-3, 3) } while (powRat(B, dir, x0 + s) == null || !Number.isInteger(powRat(B, dir, x0 + s)))
  const E = makeExp(a, s, 0)
  return { condition_text: `На рисунке изображён график функции f(x) = a${supT("x + b")}. Найдите f(${ru(x0)}).`, image_url: expSvg(E), answer: ru(powRat(B, dir, x0 + s)) }
}
// #27 — f(x)=a^(x+b), найти x при f(x)=V.
function t11ExpHShiftArg() {
  const { B, dir, a } = pickExpBase(), s = pick([1, 2, -1, -2])
  let xAns, V
  do { xAns = randInt(-4, 4); V = powRat(B, dir, xAns + s) } while (V == null)
  const E = makeExp(a, s, 0)
  return { condition_text: `На рисунке изображён график функции f(x) = a${supT("x + b")}. Найдите значение x, при котором f(x) = ${ru(clean(V))}.`, image_url: expSvg(E), answer: ru(xAns) }
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
// #30 — f(x)=b+log_a x, найти f(x0).
function t11LogShiftValue() {
  const B = pick([2, 3, 4]), q = pick([1, 2, 3, -1, -2, -3]), L = makeLog(B, 0, q)
  const o = pick(logPow(B, 0))
  return { condition_text: `На рисунке изображён график функции f(x) = b + log${subB("a")}x. Найдите значение f(${ru(o.x0)}).`, image_url: logSvg(L), answer: ru(o.n + q) }
}
// #31 — f(x)=b+log_a x, найти x при f(x)=V. (дробный x — только при основании 2)
function t11LogShiftArg() {
  const B = pick([2, 3, 4]), q = pick([1, 2, 3, -1, -2, -3]), L = makeLog(B, 0, q)
  const n = pick(B === 2 ? [-2, -1, 1, 2, 3] : [1, 2, 3]), xAns = clean(B ** n), V = n + q
  return { condition_text: `На рисунке изображён график функции f(x) = b + log${subB("a")}x. Найдите значение x, при котором f(x) = ${ru(V)}.`, image_url: logSvg(L), answer: ru(xAns) }
}
// #32 — f(x)=log_a(x+b), найти f(x0).
function t11LogHShiftValue() {
  const B = pick([2, 3, 4]), s = pick([1, 2, 3, -1, -2]), L = makeLog(B, s, 0)
  const o = pick(logPow(B, s))
  return { condition_text: `На рисунке изображён график функции f(x) = log${subB("a")}(x${signed(s)}). Найдите значение f(${ru(o.x0)}).`, image_url: logSvg(L), answer: ru(o.n) }
}
// #33 — f(x)=log_a(x+b), найти x при f(x)=V.
function t11LogHShiftArg() {
  const B = pick([2, 3, 4]), s = pick([1, 2, 3, -1, -2]), L = makeLog(B, s, 0)
  const n = pick([1, 2, 3]), xAns = B ** n - s, V = n
  return { condition_text: `На рисунке изображён график функции f(x) = log${subB("a")}(x${signed(s)}). Найдите значение x, при котором f(x) = ${ru(V)}.`, image_url: logSvg(L), answer: ru(xAns) }
}

// ---- G. Тригонометрия f(x)=a·sinx+b / a·cosx+b / a·tgx+b -------------------
// Строим в «u-координатах»: клетка = π/4, x_рад = u·π/4; ось x подписываем π (u=4),
// 2π (u=8). Целые a,b ⇒ max/min/центр лежат на узлах решётки (читаются точно).
const TRIG_TICKS = [{ x: 4, text: "π" }, { x: 8, text: "2π" }]
const RAD = (u) => (u * Math.PI) / 4
function trigSvg(gU, a, b, kind) {
  const gx0 = -1, gx1 = 9, amp = Math.abs(a)
  let gy0, gy1, vdash = []
  if (kind === "tg") { gy0 = Math.min(-1, b - 4); gy1 = Math.max(1, b + 4); vdash = [2, 6] }
  else { gy0 = Math.min(-1, b - amp - 1); gy1 = Math.max(1, b + amp + 1) }
  return svgUrl(fnGridSvg({
    gx0, gx1, gy0, gy1, plots: [{ fn: gU, xa: gx0, xb: gx1, step: (gx1 - gx0) / 700 }],
    vdash, xticks: TRIG_TICKS,
    labels: [fLabelAt(gU, gx0, gx1, gy0, gy1, { preferRight: true, avoidX: [0, ...vdash] })],
  }))
}
function t11TrigSin(findA) {
  const a = pick([2, 3, 4, -2, -3, -4]), b = randInt(-2, 3)
  const gU = (u) => a * Math.sin(RAD(u)) + b
  return { condition_text: `На рисунке изображён график функции f(x) = a sin x + b. Найдите ${findA ? "a" : "b"}.`, image_url: trigSvg(gU, a, b, "sin"), answer: ru(findA ? a : b) }
}
function t11TrigCos(findA) {
  const a = pick([2, 3, 4, -2, -3, -4]), b = randInt(-2, 3)
  const gU = (u) => a * Math.cos(RAD(u)) + b
  return { condition_text: `На рисунке изображён график функции f(x) = a cos x + b. Найдите ${findA ? "a" : "b"}.`, image_url: trigSvg(gU, a, b, "cos"), answer: ru(findA ? a : b) }
}
function t11TrigTan(findA) {
  const a = pick([1, 2, 3, -1, -2, -3]), b = randInt(-3, 3)
  const gU = (u) => a * Math.tan(RAD(u)) + b
  return { condition_text: `На рисунке изображён график функции f(x) = a tg x + b. Найдите ${findA ? "a" : "b"}.`, image_url: trigSvg(gU, a, b, "tg"), answer: ru(findA ? a : b) }
}

// ---- H/I/J/K. Пересечения графиков (#40–#53) -------------------------------
// Строим «назад»: выбираем узлы пересечения A,B, обе кривые проходят через них
// точно ⇒ ответ (абсцисса/ордината) гарантированно верен.

// Формат явного многочлена/прямой в условии.
function polyStr(A, B, C) {
  let s = A === 1 ? "x²" : A === -1 ? "−x²" : `${ru(A)}x²`
  if (B !== 0) s += ` ${B < 0 ? "−" : "+"} ${Math.abs(B) === 1 ? "" : Math.abs(B)}x`
  if (C !== 0) s += ` ${C < 0 ? "−" : "+"} ${Math.abs(C)}`
  return s
}
function lineStr(m, d) { let s = m === 1 ? "x" : m === -1 ? "−x" : `${ru(m)}x`; if (d !== 0) s += ` ${d < 0 ? "−" : "+"} ${Math.abs(d)}`; return s }
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
function t11TwoLines(findY) {
  let px, py, k1, b1, k2, b2
  for (; ;) {
    px = randInt(-3, 3); py = randInt(-3, 4)
    const ks = shuffle([-3, -2, -1, 1, 2, 3]); k1 = ks[0]; k2 = ks[1]
    b1 = py - k1 * px; b2 = py - k2 * px
    if (Math.abs(b1) <= 6 && Math.abs(b2) <= 6) break
  }
  const f1 = (x) => k1 * x + b1, f2 = (x) => k2 * x + b2
  const gx0 = -5, gx1 = 5, gy0 = -6, gy1 = 6
  const svg = fnGridSvg({ gx0, gx1, gy0, gy1, plots: [{ fn: f1, xa: gx0, xb: gx1 }, { fn: f2, xa: gx0, xb: gx1 }], dots: [[px, py]], labels: [markLabel(px, py, "A")] })
  return { condition_text: `На рисунке изображены графики двух линейных функций, пересекающихся в точке A. Найдите ${findY ? "ординату" : "абсциссу"} точки A.`, image_url: svgUrl(svg), answer: ru(findY ? py : px) }
}

// I-a. Парабола + парабола (#44/#45): f задана явно, g=ax²+bx+c. Ответ по точке B.
function t11ParabParab(findY) {
  for (; ;) {
    const Af = pick([1, 2, -1, -2]), Bf = randInt(-6, 6), Cf = randInt(-4, 5)
    const xA = randInt(-3, 3); let xB = randInt(-3, 4); if (xA === xB) continue
    const Ad = pick([1, 2, 3, -1, -2, -3]); if (Af - Ad === 0 || Math.abs(Af - Ad) > 3) continue
    const fF = (x) => Af * x * x + Bf * x + Cf
    const yA = fF(xA), yB = fF(xB)
    if (Math.abs(yA) > 8 || Math.abs(yB) > 8) continue
    const ga = Af - Ad, gb = Bf + Ad * (xA + xB), gc = Cf - Ad * xA * xB
    const gF = (x) => ga * x * x + gb * x + gc
    const W = pairWin([[xA, yA], [xB, yB], [0, Cf]]); if (W.gx1 - W.gx0 > 13 || W.gy1 - W.gy0 > 15) continue
    const svg = fnGridSvg({ ...W, plots: [{ fn: fF, xa: W.gx0, xb: W.gx1 }, { fn: gF, xa: W.gx0, xb: W.gx1 }], dots: [[xA, yA]], labels: [markLabel(xA, yA, "A")] })
    return { condition_text: `На рисунке изображены графики функций f(x) = ${polyStr(Af, Bf, Cf)} и g(x) = ax² + bx + c, которые пересекаются в точках A и B. Найдите ${findY ? "ординату" : "абсциссу"} точки B.`, image_url: svgUrl(svg), answer: ru(findY ? yB : xB) }
  }
}

// I-b. Парабола + прямая через 0 (#46): f=ax²+bx+c, g=kx. Ответ — абсцисса B.
function t11ParabLineK() {
  for (; ;) {
    const k = pick([1, 2, 3, -1, -2, -3]), Af = pick([1, 2, -1, -2])
    const xA = randInt(-3, 3); let xB = randInt(-3, 4); if (xA === xB) continue
    const fF = (x) => Af * x * x + (k - Af * (xA + xB)) * x + Af * xA * xB
    const gF = (x) => k * x
    const yA = k * xA, yB = k * xB
    if (Math.abs(yA) > 8 || Math.abs(yB) > 8 || Math.abs(fF(0)) > 8) continue
    const W = pairWin([[xA, yA], [xB, yB], [0, 0]]); if (W.gx1 - W.gx0 > 13 || W.gy1 - W.gy0 > 15) continue
    const svg = fnGridSvg({ ...W, plots: [{ fn: fF, xa: W.gx0, xb: W.gx1 }, { fn: gF, xa: W.gx0, xb: W.gx1 }], dots: [[xA, yA]], labels: [markLabel(xA, yA, "A")] })
    return { condition_text: `На рисунке изображены графики функций видов f(x) = ax² + bx + c и g(x) = kx, пересекающихся в точках A и B. Найдите абсциссу точки B.`, image_url: svgUrl(svg), answer: ru(xB) }
  }
}

// I-c. Прямая (явно) + парабола (#47/#48): f=mx+d, g=ax²+bx+c. Ответ по точке B.
function t11LineParab(findY) {
  for (; ;) {
    const m = pick([2, 3, 4, 5, -2, -3, -4]), d = randInt(-3, 9)
    const xA = randInt(-3, 3); let xB = randInt(-3, 4); if (xA === xB) continue
    const Ag = pick([1, 2, -1, -2])
    const fF = (x) => m * x + d
    const ga = Ag, gb = m - Ag * (xA + xB), gc = d + Ag * xA * xB
    const gF = (x) => ga * x * x + gb * x + gc
    const yA = fF(xA), yB = fF(xB)
    if (Math.abs(yA) > 9 || Math.abs(yB) > 9 || Math.abs(gc) > 9) continue
    const W = pairWin([[xA, yA], [xB, yB], [0, d], [0, gc]]); if (W.gx1 - W.gx0 > 13 || W.gy1 - W.gy0 > 15) continue
    const svg = fnGridSvg({ ...W, plots: [{ fn: fF, xa: W.gx0, xb: W.gx1 }, { fn: gF, xa: W.gx0, xb: W.gx1 }], dots: [[xA, yA]], labels: [markLabel(xA, yA, "A")] })
    return { condition_text: `На рисунке изображены графики функций f(x) = ${lineStr(m, d)} и g(x) = ax² + bx + c, которые пересекаются в точках A и B. Найдите ${findY ? "ординату" : "абсциссу"} точки B.`, image_url: svgUrl(svg), answer: ru(findY ? yB : xB) }
  }
}

// J. Гипербола + прямая (#49/#50): f=k/x, g=ax+b. A,B на разных ветвях.
function t11HypLine(findY) {
  for (; ;) {
    const k = pick([-8, -6, -4, 4, 6, 8, 12, -12])
    const divs = []; for (let d = -Math.abs(k); d <= Math.abs(k); d++) if (d !== 0 && k % d === 0) divs.push(d)
    const pos = divs.filter((d) => d > 0), neg = divs.filter((d) => d < 0)
    if (!pos.length || !neg.length) continue
    const xA = pick(pos), xB = pick(neg)
    const yA = k / xA, yB = k / xB
    if (Math.abs(yA) > 8 || Math.abs(yB) > 8) continue
    const a = (yB - yA) / (xB - xA), b = yA - a * xA
    if (!Number.isFinite(a) || Math.abs(a) > 6 || Math.abs(b) > 7) continue
    const fF = (x) => k / x, gF = (x) => a * x + b
    const W = pairWin([[xA, yA], [xB, yB]]); if (W.gx1 - W.gx0 > 14 || W.gy1 - W.gy0 > 16) continue
    const svg = fnGridSvg({ ...W, plots: [{ fn: fF, xa: W.gx0, xb: -0.28 }, { fn: fF, xa: 0.28, xb: W.gx1 }, { fn: gF, xa: W.gx0, xb: W.gx1 }], dots: [[xA, yA]], labels: [markLabel(xA, yA, "A")] })
    return { condition_text: `На рисунке изображены графики функций видов f(x) = ⟦f:k:x⟧ и g(x) = ax + b, пересекающихся в точках A и B. Найдите ${findY ? "ординату" : "абсциссу"} точки B.`, image_url: svgUrl(svg), answer: ru(findY ? yB : xB) }
  }
}

// K-a. Корень + прямая через 0 (#51): f=a√x, g=kx. A=(0,0), B=((a/k)²,…).
function t11RootLineK() {
  const combos = [[2, 1, 4], [3, 1, 9], [4, 2, 4], [5, 2, 6.25], [3, 2, 2.25], [6, 2, 9], [4, 1, 16]]
  const [a, k, xB] = pick(combos)
  const fF = (x) => (x < 0 ? NaN : a * Math.sqrt(x)), gF = (x) => k * x
  const yB = k * xB
  const gx1 = Math.max(4, Math.ceil(xB) + 1), gy1 = Math.max(3, Math.ceil(yB) + 1)
  const svg = fnGridSvg({ gx0: -1, gx1, gy0: -1, gy1, plots: [{ fn: fF, xa: 0, xb: gx1 }, { fn: gF, xa: 0, xb: gx1 }], dots: [[0, 0]], labels: [markLabel(0, 0, "A")] })
  return { condition_text: `На рисунке изображены графики функций видов f(x) = a${rT("x")} и g(x) = kx, пересекающихся в точках A и B. Найдите абсциссу точки B.`, image_url: svgUrl(svg), answer: ru(xB) }
}

// K-b. Корень + прямая (#52/#53): f=a√x, g=kx+b, пересечение в точке A (узел).
function t11RootLineB(findY) {
  let a, root, xA, yA, k, b
  for (; ;) {
    a = pick([1, 2, -1, -2]); root = pick([1, 2, 3]); xA = root * root; yA = a * root
    k = pick([1, -1, 2, -2]); b = yA - k * xA
    if (Math.abs(b) <= 8) break
  }
  const fF = (x) => (x < 0 ? NaN : a * Math.sqrt(x)), gF = (x) => k * x + b
  const pts = [[xA, yA], [0, b], [0, 0]]
  const W = pairWin(pts)
  const svg = fnGridSvg({ ...W, plots: [{ fn: fF, xa: 0, xb: W.gx1 }, { fn: gF, xa: W.gx0, xb: W.gx1 }], dots: [[xA, yA]], labels: [markLabel(xA, yA, "A")] })
  return { condition_text: `На рисунке изображены графики функций f(x) = a${rT("x")} и g(x) = kx + b, которые пересекаются в точке A. Найдите ${findY ? "ординату" : "абсциссу"} точки A.`, image_url: svgUrl(svg), answer: ru(findY ? yA : xA) }
}

// ============================================================================
// Реестр и мета-темы
// ============================================================================

export const GENERATORS_EGE_PROF = {
  2: [t02DotCoord, t02DotLenAngle, t02LenCombo, t02DotOfCombos, t02GraphLenCombo],
  4: [t04ShotPut, t04Gymnastics, t04Diving, t04Tickets, t04Markers, t04Defect, t04Lottery, t04CoinTwice, t04Rooms, t04FootballCoin],
  5: [t05Lamps, t05Between, t05Shooter4, t05Coffee, t05Battery, t05ShooterN, t05DiceCond, t05TwoThemes, t05Exact],
  6: [t06ExpReduce, t06ExpBothSides, t06LogEqLog, t06LogEqNum, t06Rational, t06Cube, t06Sqrt, t06CubeRoot],
  7: [t07PowPowDiv, t07PowFracExp, t07SqCoefRoot, t07DistribRoot, t07LogSum, t07LogDiff, t07LogRatio, t07TrigDouble],
  9: [t09MotoAccel, t09CarDist, t09CarAcc, t09Horizon, t09Decay, t09Winding, t09Ball, t09Heater,
    t09Ohm, t09Parallel, t09EMF, t09Doppler, t09DiverWork, t09Collision],
  10: [t10SteamboatSpeed, t10SteamboatCurrent, t10SteamboatDist, t10AvgTime, t10AvgDist, t10TwoCyclists,
    t10Barge, t10BoatCurrent, t10BoatSpeed, t10Meeting, t10TwoBoats, t10Alloy, t10Workers, t10Pipes,
    t10JointWork, t10Weed, t10TrainLength],
  11: [t11LinValue, t11LinArg,
    () => t11QuadRead(false), () => t11QuadRead(true), t11QuadFar,
    t11QuadA2neg, t11QuadA2pos, t11QuadBm4, t11QuadBm3, t11QuadCm3, t11QuadCm6,
    t11HypBasic, t11HypShiftVValue, t11HypShiftVArg, t11HypShiftHValue, t11HypShiftHArg, t11BilinearA, t11BilinearK,
    t11RootValue, t11RootArg,
    t11ExpValue, t11ExpShiftValue, t11ExpShiftArg, t11ExpHShiftValue, t11ExpHShiftArg,
    t11LogValue, t11LogShiftValue, t11LogShiftArg, t11LogHShiftValue, t11LogHShiftArg,
    () => t11TrigSin(true), () => t11TrigSin(false), () => t11TrigCos(true), () => t11TrigCos(false), () => t11TrigTan(true), () => t11TrigTan(false),
    () => t11TwoLines(false), () => t11TwoLines(true),
    () => t11ParabParab(false), () => t11ParabParab(true), t11ParabLineK, () => t11LineParab(false), () => t11LineParab(true),
    () => t11HypLine(false), () => t11HypLine(true), t11RootLineK, () => t11RootLineB(false), () => t11RootLineB(true)],
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
  11: [["Линейная", [
    ["lin-val", "f(x)=kx+b: найти f(x₀)", t11LinValue],
    ["lin-arg", "f(x)=kx+b: найти x", t11LinArg],
  ]],
    ["Парабола", [
      ["quad-read", "ax²+bx+c: прочитать f(x₀)", () => t11QuadRead(false)],
      ["quad-int", "целые a,b,c: f(x₀)", () => t11QuadRead(true)],
      ["quad-far", "целые a,b,c: далёкое f(x₀)", t11QuadFar],
      ["quad-a-2", "−2x²+bx+c", t11QuadA2neg],
      ["quad-a2", "2x²+bx+c", t11QuadA2pos],
      ["quad-b-4", "ax²−4x+c", t11QuadBm4],
      ["quad-b-3", "ax²−3x+c", t11QuadBm3],
      ["quad-c-3", "ax²+bx−3", t11QuadCm3],
      ["quad-c-6", "ax²+bx−6", t11QuadCm6],
    ]],
    ["Гипербола", [
      ["hyp-basic", "k/x: найти f(x₀)", t11HypBasic],
      ["hyp-v-val", "k/x+a: найти f(x₀)", t11HypShiftVValue],
      ["hyp-v-arg", "k/x+a: найти x", t11HypShiftVArg],
      ["hyp-h-val", "k/(x+a): найти f(x₀)", t11HypShiftHValue],
      ["hyp-h-arg", "k/(x+a): найти x", t11HypShiftHArg],
      ["bilin-a", "(kx+a)/(x+b): найти a", t11BilinearA],
      ["bilin-k", "(kx+a)/(x+b): найти k", t11BilinearK],
    ]],
    ["Корень", [
      ["root-val", "k√x: найти f(x₀)", t11RootValue],
      ["root-arg", "k√x: найти x", t11RootArg],
    ]],
    ["Показательная", [
      ["exp-val", "aˣ: найти f(x₀)", t11ExpValue],
      ["exp-b-val", "aˣ+b: найти f(x₀)", t11ExpShiftValue],
      ["exp-b-arg", "aˣ+b: найти x", t11ExpShiftArg],
      ["exp-hb-val", "a^(x+b): найти f(x₀)", t11ExpHShiftValue],
      ["exp-hb-arg", "a^(x+b): найти x", t11ExpHShiftArg],
    ]],
    ["Логарифм", [
      ["log-val", "logₐx: найти f(x₀)", t11LogValue],
      ["log-b-val", "b+logₐx: найти f(x₀)", t11LogShiftValue],
      ["log-b-arg", "b+logₐx: найти x", t11LogShiftArg],
      ["log-hb-val", "logₐ(x+b): найти f(x₀)", t11LogHShiftValue],
      ["log-hb-arg", "logₐ(x+b): найти x", t11LogHShiftArg],
    ]],
    ["Тригонометрия", [
      ["sin-a", "a sin x+b: найти a", () => t11TrigSin(true)],
      ["sin-b", "a sin x+b: найти b", () => t11TrigSin(false)],
      ["cos-a", "a cos x+b: найти a", () => t11TrigCos(true)],
      ["cos-b", "a cos x+b: найти b", () => t11TrigCos(false)],
      ["tg-a", "a tg x+b: найти a", () => t11TrigTan(true)],
      ["tg-b", "a tg x+b: найти b", () => t11TrigTan(false)],
    ]],
    ["Пересечения графиков", [
      ["2lines-x", "Две прямые: абсцисса", () => t11TwoLines(false)],
      ["2lines-y", "Две прямые: ордината", () => t11TwoLines(true)],
      ["par-par-x", "Парабола+парабола: абсцисса B", () => t11ParabParab(false)],
      ["par-par-y", "Парабола+парабола: ордината B", () => t11ParabParab(true)],
      ["par-kx", "Парабола+kx: абсцисса B", t11ParabLineK],
      ["line-par-x", "Прямая+парабола: абсцисса B", () => t11LineParab(false)],
      ["line-par-y", "Прямая+парабола: ордината B", () => t11LineParab(true)],
      ["hyp-line-x", "Гипербола+прямая: абсцисса B", () => t11HypLine(false)],
      ["hyp-line-y", "Гипербола+прямая: ордината B", () => t11HypLine(true)],
      ["root-kx", "Корень+kx: абсцисса B", t11RootLineK],
      ["root-line-x", "Корень+прямая: абсцисса A", () => t11RootLineB(false)],
      ["root-line-y", "Корень+прямая: ордината A", () => t11RootLineB(true)],
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
