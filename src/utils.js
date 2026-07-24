// Ширина строки в долях em (надстрочные ⁰¹²…⁻ уже) — для длины черты радикала.
const glyphW = (s) => { let w = 0; for (const ch of s) w += /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/.test(ch) ? 0.42 : 0.58; return w }

// Радикал одним НЕПРЕРЫВНЫМ SVG-path (знак √ + верхняя черта — единый штрих, стыка нет
// по построению). Инлайновый SVG (не <img>): stroke/fill = currentColor → адаптируется к
// тёмной теме; размер в em → масштабируется вместе со шрифтом. Геометрия совпадает с
// rootSvg в variantPdf.js (там <img> с жёстким цветом — в PDF фон всегда светлый).
// index — показатель степени корня (∛ → index="3"): цифра сидит В КРЮЧКЕ радикала
// (как у ФИПИ), а не висит высоким надстрочником слева. Радикал сдвигается вправо на ox,
// освобождая слева место под индекс.
function rootMarkup(content, index = "") {
  const FS = 14
  const idxFS = 10
  const ox = index ? Math.ceil(glyphW(String(index)) * idxFS) + 1 : 0
  const W = Math.ceil(13 + glyphW(content) * FS + 2.5) + ox, H = 22
  const d = `M${1.5 + ox},13 L${4 + ox},11.5 L${7.5 + ox},19 L${11.5 + ox},2.8 L${W - 1.5},2.8`
  const idx = index
    ? `<text x="${ox - 1}" y="10.5" font-size="${idxFS}" text-anchor="middle" fill="currentColor">${index}</text>`
    : ""
  return `<svg class="tmath-radical" viewBox="0 0 ${W} ${H}" width="${(W / FS).toFixed(3)}em" height="${(H / FS).toFixed(3)}em" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>` +
    idx +
    `<text x="${13 + ox}" y="17" font-size="${FS}" fill="currentColor">${content}</text></svg>`
}

// Корень НАД дробью одним SVG: знак √, верхняя черта и черта дроби — единый stroke-width
// (равная толщина всех палочек), √ не искажается. num/den/pre/post — уже экранированный текст.
function rootFracMarkup(pre, num, den, post) {
  const FS = 14, fs = 12.4, SW = 1.2
  const preW = glyphW(pre) * FS, postW = glyphW(post) * FS
  const fracW = Math.max(glyphW(num), glyphW(den)) * fs + 8
  const signW = 10, x0 = signW + 3, bar = 20
  const fcx = x0 + preW + fracW / 2
  const W = Math.ceil(signW + preW + fracW + postW + 7), H = 38
  const d = `M0.8 24 L3.4 26 L6 36 L${signW} 2 L${W - 1} 2`   // √ + верхняя черта — единый путь
  let g = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linejoin="miter" stroke-linecap="butt"/>`
  if (pre) g += `<text x="${x0}" y="${bar + 4}" font-size="${FS}" fill="currentColor">${pre}</text>`
  g += `<text x="${fcx}" y="${bar - 3}" font-size="${fs}" text-anchor="middle" fill="currentColor">${num}</text>`
  g += `<line x1="${x0 + preW + 1}" y1="${bar}" x2="${x0 + preW + fracW - 1}" y2="${bar}" stroke="currentColor" stroke-width="${SW}"/>`
  g += `<text x="${fcx}" y="${bar + 12}" font-size="${fs}" text-anchor="middle" fill="currentColor">${den}</text>`
  if (post) g += `<text x="${x0 + preW + fracW + 1}" y="${bar + 4}" font-size="${FS}" fill="currentColor">${post}</text>`
  return `<svg class="tmath-rootfrac" viewBox="0 0 ${W} ${H}" width="${(W / FS).toFixed(3)}em" height="${(H / FS).toFixed(3)}em" xmlns="http://www.w3.org/2000/svg">${g}</svg>`
}

// ── Задания «на соответствие» (единый вид во всех предметах) ──────────────────
// Генераторы собирают токен ⟦match⟧ через matchBlock(), а рендер разворачивает его в
// компактную таблицу: левый столбец (А, Б, В…) и правый (1, 2, 3…) стоят РЯДОМ, а не
// стопкой друг под другом — так ученику проще соотносить. Ниже — сетка для ответа.
// left/right — «сырые» пункты БЕЗ меток; метки А)/1) добавляет рендер. Разделители
// ‖ (между полями) и ⁞ (между пунктами) в контенте не встречаются.
const MATCH_LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж"]
export function matchBlock({ leftHdr, rightHdr, left, right, letters }) {
  const L = (letters || MATCH_LETTERS).slice(0, left.length)
  return `⟦match⟧${leftHdr}‖${rightHdr}‖${L.join("")}‖${left.join("⁞")}‖${right.join("⁞")}⟦endmatch⟧`
}

// ── Нумерованный список вариантов (задания «на последовательность» и «вставьте элементы») ──
// Раньше номер и текст стояли на РАЗНЫХ строках (`n)\nтекст`) — большие пустые отступы.
// Теперь единый компактный список: синий номер и текст в одну строку (как ключи в таблице
// соответствия). items — «сырые» пункты; нумерацию 1…n (= порядок показа) даёт рендер.
export function listBlock(items) {
  return `⟦list⟧${items.join("⁞")}⟦endlist⟧`
}
function orderedListHtml(body) {
  const items = body.split("⁞")
  return `<ol class="tmath-list">` +
    items.map((t, i) => `<li><b class="tmath-key">${i + 1})</b> ${t}</li>`).join("") +
    `</ol>`
}

// HTML-таблица соответствия. body уже ЭКРАНИРОВАН (вызывается из renderTaskMath после
// escape), внутренние мат-токены в ячейках остаются и разворачиваются следующими .replace.
function matchTableHtml(body) {
  const [lh = "", rh = "", letters = "", lRaw = "", rRaw = ""] = body.split("‖")
  const L = lRaw ? lRaw.split("⁞") : []
  const R = rRaw ? rRaw.split("⁞") : []
  const la = letters.split("")
  const rows = Math.max(L.length, R.length)
  let trs = ""
  for (let i = 0; i < rows; i++) {
    const lc = i < L.length ? `<b class="tmath-key">${la[i] || ""})</b> ${L[i]}` : ""
    const rc = i < R.length ? `<b class="tmath-key">${i + 1})</b> ${R[i]}` : ""
    trs += `<tr><td>${lc}</td><td>${rc}</td></tr>`
  }
  const ansHead = la.map((c) => `<th>${c}</th>`).join("")
  const ansBlank = la.map(() => "<td></td>").join("")
  return `<table class="tmath-match"><thead><tr><th>${lh}</th><th>${rh}</th></tr></thead><tbody>${trs}</tbody></table>` +
    `<table class="tmath-answer"><thead><tr>${ansHead}</tr></thead><tbody><tr>${ansBlank}</tr></tbody></table>`
}

// Условие задания рендерится как HTML, чтобы дроби были СТОЛБИКОМ (не «в строчку»),
// а корень — с верхней чертой над подкоренным. Генераторы вставляют токены
// ⟦f:n:d⟧ (дробь) и ⟦r:x⟧ (корень); здесь текст сначала ЭКРАНИРУЕТСЯ (защита от XSS
// в задачах, введённых репетитором), и только потом токены разворачиваются в разметку.
export function renderTaskMath(text) {
  if (!text) return ""
  const esc = String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  // корень внутри числителя/знаменателя дроби записывается маркером √{X} (не токеном ⟦r⟧,
  // т.к. ⟦r⟧ содержит «⟧» и рвёт захват дроби) — разворачиваем его в настоящий радикал.
  const rootIn = (s) => s.replace(/√\{([^}]+)\}/g, (_, x) => rootMarkup(x))
  return esc
    // ⟦match⟧…⟦endmatch⟧ — задание «на соответствие»: два столбца РЯДОМ (таблица) +
    // сетка для ответа. Разворачиваем ПЕРВЫМ, оставляя внутри ячеек мат-токены (⟦f⟧,
    // ⟦b⟧…) — их развернут следующие .replace ниже по цепочке уже внутри таблицы.
    .replace(/⟦match⟧([\s\S]*?)⟦endmatch⟧/g, (_, body) => matchTableHtml(body))
    // ⟦list⟧…⟦endlist⟧ — компактный нумерованный список вариантов (номер + текст в строку).
    .replace(/⟦list⟧([\s\S]*?)⟦endlist⟧/g, (_, body) => orderedListHtml(body))
    // ⟦code:…⟧ — моноширинный код-блок (примеры КуМира в №15 и т.п.). \n внутри станут <br>
    // ниже по цепочке, а .tmath-code (white-space:pre-wrap) сохранит ведущие отступы строк.
    .replace(/⟦code:([^⟧]*)⟧/g, (_, x) => `<code class="tmath-code">${x}</code>`)
    // ⟦rf:pre¦num¦den¦post⟧ — корень НАД дробью: знак √ с чертой, растянутой на всю
    // высоту дроби (SVG-галочка тянется по высоте flex-строки, как скобка системы).
    .replace(/⟦rf:([^⟧]*)⟧/g, (_, b) => {
      const [pre, num, den, post] = b.split("¦")
      return rootFracMarkup(pre || "", num || "", den || "", post || "")
    })
    // ⟦pf:n:d⟧ — дробь в скобках, растянутых по её высоте (основание степени: (1/4)^x).
    // Скобки — отдельные глиф-спаны крупнее строки; раскрываем ДО ⟦f⟧, т.к. содержат ⟦f⟧ внутри.
    .replace(/⟦pf:([^:⟧]+):([^:⟧]+)⟧/g,
      (_, n, d) => `<span class="tmath-paren">(</span><span class="tmath-frac"><span class="tmath-num">${rootIn(n)}</span><span class="tmath-den">${rootIn(d)}</span></span><span class="tmath-paren">)</span>`)
    // числитель/знаменатель — любой текст без «:» (числа, степени вида 7⁴), уже экранированный
    .replace(/⟦f:([^:⟧]+):([^:⟧]+)⟧/g,
      (_, n, d) => `<span class="tmath-frac"><span class="tmath-num">${rootIn(n)}</span><span class="tmath-den">${rootIn(d)}</span></span>`)
    // ⟦rn:i:x⟧ — корень степени i (∛ → i=3): индекс сидит в крючке радикала
    .replace(/⟦rn:([^:⟧]+):([^⟧]+)⟧/g, (_, i, x) => rootMarkup(x, i))
    .replace(/⟦r:([^⟧]+)⟧/g, (_, x) => rootMarkup(x))
    .replace(/⟦b:([^⟧]+)⟧/g, (_, x) => `<sub class="tmath-sub">${x}</sub>`)
    // ⟦sup:x⟧ — надстрочник (степень с переменным показателем, напр. 2^(1−4x))
    .replace(/⟦sup:([^⟧]+)⟧/g, (_, x) => `<sup class="tmath-sup">${x}</sup>`)
    // ⟦iso:A:Z:Sym⟧ — символ нуклида: массовое число A над зарядовым Z (стопкой),
    // прижаты вправо и стоят слева от символа элемента (¹⁴₇N).
    .replace(/⟦iso:([^:⟧]+):([^:⟧]+):([^⟧]+)⟧/g, (_, a, z, s) =>
      `<span class="tmath-iso"><span class="tmath-iso-nums"><span>${a}</span><span>${z}</span></span>${s}</span>`)
    // ⟦cases:строка⁞строка…⟧ — система (фигурная скобка) для кусочно-заданных функций;
    // раскрываем ПОСЛЕ дробей, чтобы внутренние ⟦f⟧ уже стали <span> (без ⟧ внутри)
    .replace(/⟦cases:([^⟧]+)⟧/g, (_, b) =>
      `<span class="tmath-cases"><svg class="tmath-brace" viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true"><path d="M9 1C5 1 5 6 5 25C5 44 4 49 1 50C4 51 5 56 5 75C5 94 5 99 9 99" fill="none" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg><span class="tmath-lines">${b.split("⁞").map((l) => `<span>${l}</span>`).join("")}</span></span>`)
    .replace(/\n/g, "<br>")
}

// Плоский вид тех же токенов (n/d, √x) — для узких усечённых превью, где столбик не нужен.
export function plainTaskMath(text) {
  if (!text) return ""
  return String(text)
    // ⟦match⟧ в плоском виде (для узких усечённых превью-строк): столбцы через «; ».
    .replace(/⟦match⟧([\s\S]*?)⟦endmatch⟧/g, (_, body) => {
      const [lh = "", rh = "", letters = "", lRaw = "", rRaw = ""] = body.split("‖")
      const la = letters.split("")
      const L = (lRaw ? lRaw.split("⁞") : []).map((x, i) => `${la[i] || ""}) ${x}`)
      const R = (rRaw ? rRaw.split("⁞") : []).map((x, i) => `${i + 1}) ${x}`)
      return `${lh}: ${L.join("; ")} — ${rh}: ${R.join("; ")}`
    })
    .replace(/⟦list⟧([\s\S]*?)⟦endlist⟧/g, (_, body) =>
      body.split("⁞").map((t, i) => `${i + 1}) ${t}`).join("; "))
    .replace(/⟦rf:([^⟧]*)⟧/g, (_, b) => { const [pre, n, d, post] = b.split("¦"); return `√(${pre || ""}${n}/${d}${post || ""})` })
    .replace(/√\{([^}]+)\}/g, "√$1")
    .replace(/⟦pf:([^:⟧]+):([^:⟧]+)⟧/g, "($1/$2)")
    .replace(/⟦f:([^:⟧]+):([^:⟧]+)⟧/g, "$1/$2")
    .replace(/⟦rn:([^:⟧]+):([^⟧]+)⟧/g, (_, i, x) => `${i}√(${x})`)
    .replace(/⟦r:([^⟧]+)⟧/g, "√$1")
    .replace(/⟦b:([^⟧]+)⟧/g, "$1")
    .replace(/⟦sup:([^⟧]+)⟧/g, "^($1)")
    .replace(/⟦iso:([^:⟧]+):([^:⟧]+):([^⟧]+)⟧/g, (_, a, z, s) =>
      a.replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]) + z.replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[+d]) + s)
    .replace(/⟦cases:([^⟧]+)⟧/g, (_, b) => b.split("⁞").join("; "))
}

// Разворачивает мат-токены в SVG-РАЗМЕТКУ (корень — √ с чертой над подкоренным, дробь —
// «в строчку», нижний индекс). Используется и при генерации чертежа, и для «лечения» старых
// картинок из банка, сохранённых до появления этого разворота (иначе в подписи виден «4⟦r:2⟧»).
export function expandSvgMathTokens(svg) {
  return String(svg)
    .replace(/⟦rf:([^⟧]*)⟧/g, (_, b) => { const [pre, n, d, post] = b.split("¦"); return `√(${pre || ""}${n}/${d}${post || ""})` })
    .replace(/√\{([^}]+)\}/g, (_, x) => `√<tspan text-decoration="overline">${x}</tspan>`)
    .replace(/⟦pf:([^:⟧]+):([^:⟧]+)⟧/g, "($1/$2)")
    .replace(/⟦f:([^:⟧]+):([^:⟧]+)⟧/g, "$1/$2")
    .replace(/⟦r:([^⟧]+)⟧/g, (_, x) => `√<tspan text-decoration="overline">${x}</tspan>`)
    .replace(/⟦b:([^⟧]+)⟧/g, (_, x) => `<tspan baseline-shift="sub" font-size="0.75em">${x}</tspan>`)
    .replace(/⟦sup:([^⟧]+)⟧/g, (_, x) => `<tspan baseline-shift="super" font-size="0.75em">${x}</tspan>`)
    .replace(/⟦iso:([^:⟧]+):([^:⟧]+):([^⟧]+)⟧/g, (_, a, z, s) =>
      `<tspan baseline-shift="super" font-size="0.7em">${a}</tspan><tspan baseline-shift="sub" font-size="0.7em">${z}</tspan>${s}`)
}

// Нормализует уже готовый data:image/svg+xml URL задания (напр. сохранённый в банке до фикса):
// декодирует, разворачивает оставшиеся токены и кодирует обратно. Идемпотентна — если сырых
// токенов нет, возвращает URL без изменений.
export function normalizeTaskImage(url) {
  if (!url || typeof url !== "string" || !url.startsWith("data:image/svg+xml")) return url
  const comma = url.indexOf(",")
  if (comma < 0) return url
  let svg
  try { svg = decodeURIComponent(url.slice(comma + 1)) } catch { return url }
  if (!/⟦[frb]:/.test(svg)) return url
  return url.slice(0, comma + 1) + encodeURIComponent(expandSvgMathTokens(svg))
}

export function plural(n, one, few, many) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

// Превращает «плоские» степени из свободного текста (в т.ч. от ИИ-генерации ДЗ)
// в надстрочные символы Юникода: x^2 → x², a^{10} → a¹⁰, x^n → xⁿ.
// Работает над обычным текстом (не над токенами банка заданий).
const SUPERSCRIPT_MAP = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵",
  "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻",
  "=": "⁼", "(": "⁽", ")": "⁾", "n": "ⁿ", "i": "ⁱ",
}
function toSup(str) {
  return Array.from(str).map((c) => SUPERSCRIPT_MAP[c] || c).join("")
}
export function superscriptPowers(text) {
  if (!text) return text
  return text
    .replace(/\^\{([^}]*)\}/g, (_, g) => toSup(g))
    .replace(/\^(-?[0-9]+|[nix])/g, (_, g) => toSup(g))
}

// Читает сбалансированную группу {...}, начиная с позиции i (s[i] === "{").
function takeBrace(s, i) {
  if (s[i] !== "{") return null
  let depth = 0
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++
    else if (s[j] === "}") { depth--; if (depth === 0) return { content: s.slice(i + 1, j), next: j + 1 } }
  }
  return null
}

// \frac{a}{b} → стоячая дробь, \sqrt{x} / \sqrt[3]{x} → радикал. Скобки считаются
// сбалансированно, поэтому \frac{\sqrt{2}}{2} тоже разбирается. Вход уже экранирован.
function convFracRoot(s) {
  let out = ""
  for (let i = 0; i < s.length;) {
    if (s.startsWith("\\frac", i) || s.startsWith("\\dfrac", i)) {
      const start = i + (s.startsWith("\\dfrac", i) ? 6 : 5)
      const a = takeBrace(s, start)
      const b = a && takeBrace(s, a.next)
      if (a && b) {
        out += `<span class="tmath-frac"><span class="tmath-num">${convFracRoot(a.content)}</span><span class="tmath-den">${convFracRoot(b.content)}</span></span>`
        i = b.next
        continue
      }
    }
    if (s.startsWith("\\sqrt", i)) {
      let j = i + 5, idx = ""
      if (s[j] === "[") { const e = s.indexOf("]", j); if (e !== -1) { idx = s.slice(j + 1, e); j = e + 1 } }
      const a = takeBrace(s, j)
      if (a) { out += rootMarkup(superscriptPowers(a.content), idx); i = a.next; continue }
    }
    out += s[i]
    i++
  }
  return out
}

// Красивый рендер описания ДЗ (в т.ч. сгенерированного ИИ): дроби столбиком, корни с
// чертой, степени/индексы, базовые операторы LaTeX. Текст сначала ЭКРАНИРУЕТСЯ, затем
// разворачивается в разметку — вставляется через dangerouslySetInnerHTML безопасно.
export function renderHomeworkMath(text) {
  if (!text) return ""
  let s = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  s = convFracRoot(s)
  s = s
    // корни без \ (юникод от модели): √{x}, √(x), √2, √x
    .replace(/√\{([^{}]+)\}/g, (_, x) => rootMarkup(superscriptPowers(x)))
    .replace(/√\(([^()]+)\)/g, (_, x) => rootMarkup(superscriptPowers(x)))
    .replace(/√\s*(-?\d+(?:[.,]\d+)?|[A-Za-zА-Яа-я])/g, (_, x) => rootMarkup(x))
    // степени/индексы с фигурными скобками (переменный показатель)
    .replace(/\^\{([^{}]*)\}/g, (_, x) => `<sup class="tmath-sup">${x}</sup>`)
    .replace(/_\{([^{}]*)\}/g, (_, x) => `<sub class="tmath-sub">${x}</sub>`)
    .replace(/_([0-9A-Za-zА-Яа-я])/g, (_, x) => `<sub class="tmath-sub">${x}</sub>`)
    // операторы LaTeX → символы
    .replace(/\\left|\\right/g, "")
    .replace(/\\cdot/g, "·").replace(/\\times/g, "×").replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±").replace(/\\mp/g, "∓")
    .replace(/\\leq\b|\\le\b/g, "≤").replace(/\\geq\b|\\ge\b/g, "≥")
    .replace(/\\neq\b/g, "≠").replace(/\\approx\b/g, "≈")
    .replace(/\\,|\\;|\\!|\\quad/g, " ")
    .replace(/\$/g, "")
  s = superscriptPowers(s)          // оставшиеся ^2, ^n → ², ⁿ
  return s.replace(/\n/g, "<br>")
}

// new Date("YYYY-MM-DD") parses as UTC midnight, which shifts a day back in
// timezones behind UTC — this constructs the date from local components instead.
export function parseLocalDate(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function isLessonConducted(lesson, now = new Date()) {
  if (!lesson.date) return false
  const [y, m, d] = lesson.date.split("-").map(Number)
  const [h, min] = (lesson.time || "00:00").split(":").map(Number)
  return new Date(y, m - 1, d, h, min + (lesson.duration || 60)) < now
}

export function getInitials(name) {
  if (!name) return "?"
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}

// Единый формат телефона для показа во всём приложении: "+7 (XXX) XXX-XX-XX".
// В базе номер хранится каноничным "+7XXXXXXXXXX" — форматируем только при выводе.
// Если строка не похожа на российский номер (11 цифр с 7/8) — возвращаем как есть.
export function formatPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "")
  const body = d.length === 11 && (d[0] === "7" || d[0] === "8") ? d.slice(1)
    : d.length === 10 ? d
    : null
  if (!body) return raw || ""
  return `+7 (${body.slice(0, 3)}) ${body.slice(3, 6)}-${body.slice(6, 8)}-${body.slice(8, 10)}`
}

// Tutor's onboarding answer (exam_focus) suggests which exam type to
// pre-select in Variants/TaskBank instead of always defaulting to ОГЭ.
export function defaultExamType(examFocus) {
  if (examFocus?.includes("ОГЭ")) return "ОГЭ"
  if (examFocus?.includes("ЕГЭ")) return "ЕГЭ"
  return "ОГЭ"
}
