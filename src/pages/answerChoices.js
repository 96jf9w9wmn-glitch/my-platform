// Варианты ответа для задания части 2: правильный + три правдоподобных дистрактора.
//
// Вынесено из taskBankApi.js отдельным файлом: тот тянет supabase и все генераторы
// (~3,3 МБ), а разбор ответа нужен и кабинету ученика — чтобы подписать, к какому
// пункту относится выбор, и сверить выбранное с правильным.

const NUM_RE = /[−-]?\d+(?:[.,]\d+)?/g

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Шаг возмущения числа в ответе: у десятичных — последний разряд («0,6» → ±0,1),
// у целых — 1, у крупных целых (скорости, площади) — 5, чтобы дистрактор был правдоподобен.
function perturbStep(tok) {
  const frac = (tok.split(/[.,]/)[1] || "").length
  if (frac > 0) return Math.pow(10, -frac)
  return Math.abs(parseFloat(tok.replace(",", ".").replace("−", "-"))) >= 30 ? 5 : 1
}

// Сдвигает числовой токен на delta, сохраняя формат: десятичную запятую, число знаков
// после запятой и стиль минуса исходного ответа (в №20 — математический U+2212).
function perturbToken(tok, delta, minus) {
  const frac = (tok.split(/[.,]/)[1] || "").length
  const comma = tok.includes(",")
  const v = parseFloat(tok.replace(",", ".").replace("−", "-")) + delta
  let out = Math.abs(v).toFixed(frac)
  if (comma) out = out.replace(".", ",")
  return (v < 0 ? minus : "") + out
}

// Дистрактор не должен выдавать себя: отсеиваем вырожденные варианты — двойное неравенство
// с перевёрнутыми границами («2 < m < 1» — пустое множество) и повтор части составного
// ответа («m = −5; m = −5»).
function plausibleChoice(cand) {
  for (const m of cand.matchAll(/([−-]?\d+(?:[.,]\d+)?)\s*[<⩽≤]\s*[a-zа-яё]+\s*[<⩽≤]\s*([−-]?\d+(?:[.,]\d+)?)/gi)) {
    const a = parseFloat(m[1].replace(",", ".").replace("−", "-"))
    const b = parseFloat(m[2].replace(",", ".").replace("−", "-"))
    if (!(a < b)) return false
  }
  // Корень из 0 или 1 в дистракторе выдаёт подмену: так ответы не записывают.
  if (/√\s*[01](?!\d)/.test(cand)) return false
  const parts = cand.split(/;\s*/)
  if (parts.length > 1 && new Set(parts.map((p) => p.trim())).size !== parts.length) return false
  return true
}

const PART_RE = /(?:^|\n)\s*([абвг])\)\s*/g

// По какой части ответа строится выбор. Задания части 2 у ЕГЭ почти всегда
// двухчастные: «а) серия корней, n ∈ ℤ» + «б) корни на отрезке». Выбирать
// имеет смысл только пункт б): он конечный и короткий, а у серии с параметром
// правдоподобных дистракторов не построить. Однопунктовый ответ («7 %») идёт
// целиком, part при этом null — подписывать пункт нечем и незачем.
export function choiceBaseOf(answer) {
  const src = String(answer ?? "").trim()
  const marks = [...src.matchAll(PART_RE)]
  // Ответ из одного подпункта — так устроен №15 профиля (стереометрия части 2):
  // пункт а — доказательство, ответ есть только у пункта б. Метку снимаем, иначе
  // ученик выбирал бы из «б) 26 / б) 27», а лист ответов дублировал бы её.
  if (marks.length === 1 && marks[0].index === 0) {
    return { text: src.slice(marks[0][0].length).trim(), part: marks[0][1] }
  }
  if (marks.length < 2) return { text: src, part: null }
  const last = marks[marks.length - 1]
  return { text: src.slice(last.index + last[0].length).trim(), part: last[1] }
}

// Четыре варианта ответа для задания части 2: правильный + три правдоподобных дистрактора
// (возмущение чисел правильного ответа). Работает и для составных ответов («−4; 1», «12/5»,
// «3√2», «6 и 4»). Текстовые ответы без чисел (доказательства №24) вариантов не получают — null.
export function makeAnswerChoices(answer) {
  const src = choiceBaseOf(answer).text
  if (!src || src.length > 60) return null
  // Словесный ответ вариантами не подменяем. Возмущение чисел в «36 6/7; например
  // 1, 3, 5, 7, 95, 97, 99» портит не ответ, а пример к нему: дистрактор выходит
  // неотличимым, а выбирать ученику там нечего. Единица измерения при числе
  // («259 200 рублей») этому не мешает, поэтому режем по словам-маркерам
  // рассуждения и по второму слову подряд, а не по любой кириллице.
  if (/(например|поэтому|значит|если|нельзя|можно|верно|^\s*(да|нет)\b)/i.test(src)) return null
  if ((src.match(/[а-яё]{2,}/gi) || []).length > 1) return null
  const tokens = [...src.matchAll(NUM_RE)]
  if (!tokens.length) return null
  const minus = src.includes("−") ? "−" : "-"
  const seen = new Set([src])
  const cands = []
  outer: for (const k of [1, -1, 2, -2, 3, -3]) {
    for (const m of tokens) {
      const orig = parseFloat(m[0].replace(",", ".").replace("−", "-"))
      const shifted = orig + k * perturbStep(m[0])
      // положительное число (длина, скорость, площадь) не делаем отрицательным — такой
      // дистрактор неправдоподобен и выдаёт себя
      if (orig >= 0 && shifted < 0) continue
      const next = perturbToken(m[0], k * perturbStep(m[0]), minus)
      let cand = src.slice(0, m.index) + next + src.slice(m.index + m[0].length)
      // «1√6/3» выдаёт дистрактор с головой: единичный множитель перед корнем не пишут.
      // Приводим к обычной записи «√6/3» — это по-прежнему неверный, но правдоподобный ответ.
      cand = cand.replace(/(^|[^\d.,])1√/g, "$1√")
      if (cand !== src && !seen.has(cand) && plausibleChoice(cand)) { seen.add(cand); cands.push(cand) }
      if (cands.length >= 6) break outer
    }
  }
  if (cands.length < 3) return null
  return shuffle([src, ...shuffle(cands).slice(0, 3)])
}
