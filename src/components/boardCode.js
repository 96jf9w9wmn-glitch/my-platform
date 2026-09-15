// Код на доске — тот же ТЕКСТОВЫЙ штрих, только набранный моноширинным и
// разложенный по цветам. Отдельного инструмента у него нет и не нужно: код на
// доску попадает вставкой (⌘V) — его копируют из редактора, из разбора, из
// переписки, а не набирают заново у доски.
//
// ПОЧЕМУ ТЕКСТ, А НЕ КАРТИНКА. Скриншот кода весит сотни килобайт, мылится на
// увеличении и не правится; строка весит десяток байт, остаётся чёткой на любом
// зуме и правится повторным вводом. А раз это обычный текстовый штрих с
// пометкой `code`, то выделение, перенос, поворот, размер, отмена, копирование
// и сохранение работают уже написанным кодом доски, без единого исключения.
//
// ПОДСВЕТКА СЧИТАЕТСЯ ЗДЕСЬ И КЭШИРУЕТСЯ: разбор идёт один раз на текст, а не
// на каждый кадр — доска перерисовывается десятки раз в секунду.

// Моноширинный набор. Отдельный от TEXT_FONT: у кода столбцы обязаны стоять
// друг под другом, на этом держится и отрисовка (позиция символа считается
// умножением, а не измерением каждого куска строки).
export const CODE_FONT = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'

// Кегль вставляемого кода — в ЭКРАННЫХ точках: доску держат на любом
// увеличении, и код, вставленный на отдалённой доске, иначе оказался бы
// нечитаемой крошкой (или во весь экран на приближённой).
export const CODE_SCREEN_SIZE = 19
export const CODE_MIN = 9, CODE_MAX = 80

// Поля карточки и скругление — долями кегля, чтобы карточка оставалась собой
// при растягивании за ручку.
export const CODE_PAD_K = 0.85
export const CODE_RADIUS_K = 0.55

// Карточка тёмная в ОБЕИХ темах доски, как в редакторе кода: цветная подсветка
// на светлой подложке блёкнет, а код на занятии читают с проектора и с телефона.
// Это не «серая заливка» из правила интерфейса, а содержимое — как лист задания.
export const CODE_BG = "#13161d"
export const CODE_BORDER = "rgba(255,255,255,.12)"

// Цвета разрядов. Палитра одна на все языки: ключевое слово всюду ключевое.
export const CODE_INK = {
  plain: "#dfe6f2",
  kw: "#c792ea",        // def, for, if, return, break
  builtin: "#82aaff",   // print, range, all
  func: "#82aaff",      // имя объявляемой функции и любой вызов
  param: "#f78c6c",     // имена в скобках объявления
  num: "#89ddff",
  str: "#c3e88d",
  comment: "#7f8ca6",
  const: "#ff9d61",     // True/False/None
  punct: "#a7b4cc",
  deco: "#ffcb6b",      // @decorator
}

const PY_KW = ["and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif",
  "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
  "not", "or", "pass", "raise", "return", "try", "while", "with", "yield", "match", "case"]
const PY_BUILTIN = ["abs", "all", "any", "bin", "bool", "chr", "dict", "divmod", "enumerate", "filter", "float",
  "format", "hex", "input", "int", "isinstance", "len", "list", "map", "max", "min", "oct", "open", "ord",
  "pow", "print", "range", "reversed", "round", "set", "slice", "sorted", "str", "sum", "tuple", "type", "zip"]

const CPP_KW = ["auto", "bool", "break", "case", "char", "class", "const", "continue", "default", "delete", "do",
  "double", "else", "enum", "false", "float", "for", "friend", "goto", "if", "inline", "int", "long", "namespace",
  "new", "nullptr", "operator", "private", "protected", "public", "return", "short", "signed", "sizeof", "static",
  "struct", "switch", "template", "this", "throw", "true", "try", "typedef", "typename", "union", "unsigned",
  "using", "virtual", "void", "while"]
const CPP_BUILTIN = ["cin", "cout", "endl", "string", "vector", "map", "set", "pair", "sort", "printf", "scanf",
  "size", "push_back", "begin", "end", "abs", "max", "min", "swap"]

const PAS_KW = ["and", "array", "begin", "case", "const", "div", "do", "downto", "else", "end", "false", "for",
  "function", "if", "mod", "not", "of", "or", "procedure", "program", "record", "repeat", "then", "to", "true",
  "type", "until", "uses", "var", "while", "xor"]
const PAS_BUILTIN = ["writeln", "write", "readln", "read", "integer", "real", "boolean", "string", "char",
  "length", "abs", "sqrt", "trunc", "round", "inc", "dec"]

// КуМир: школьный алгоритмический язык, он в КЕГЭ и ОГЭ наравне с питоном.
const KUM_KW = ["алг", "нач", "кон", "если", "то", "иначе", "все", "нц", "кц", "пока", "для", "от", "до",
  "выбор", "при", "утв", "дано", "надо", "знач", "и", "или", "не", "да", "нет", "использовать"]
const KUM_BUILTIN = ["цел", "вещ", "лог", "сим", "лит", "таб", "вывод", "ввод", "нс", "вправо", "влево",
  "вверх", "вниз", "закрасить", "Робот", "слева", "справа", "сверху", "снизу", "стена", "свободно"]

const set = (words) => new Set(words)
const LANGS = {
  python: { line: ["#"], block: [], str: ['"""', "'''", '"', "'"], esc: true, sig: true,
    kw: set(PY_KW), builtin: set(PY_BUILTIN), konst: set(["True", "False", "None"]) },
  cpp: { line: ["//", "#"], block: [["/*", "*/"]], str: ['"', "'"], esc: true, sig: false,
    kw: set(CPP_KW), builtin: set(CPP_BUILTIN), konst: set(["true", "false", "NULL", "nullptr"]) },
  pascal: { line: ["//"], block: [["{", "}"], ["(*", "*)"]], str: ["'"], esc: false, sig: false, fold: true,
    kw: set(PAS_KW), builtin: set(PAS_BUILTIN), konst: set(["true", "false", "nil"]) },
  kumir: { line: ["|"], block: [], str: ['"', "'"], esc: false, sig: false,
    kw: set(KUM_KW), builtin: set(KUM_BUILTIN), konst: set(["да", "нет"]) },
}

const WORD_START = /[A-Za-zА-Яа-яЁё_@]/
const WORD_REST = /[A-Za-z0-9А-Яа-яЁё_]/
const DIGIT = /[0-9]/

// --- Что считать кодом ----------------------------------------------------
// Вставка обычного текста (условие, фамилия, ссылка) кодом становиться не
// должна: чёрная карточка вместо подписи выглядела бы поломкой. Поэтому
// признаков требуется НЕСКОЛЬКО, а одиночного «=» или скобки мало.
// Сильные признаки — те, что в обычной речи не встречаются вовсе.
const CODE_STRONG = [
  /^\s*(def|class|for|while|if|elif|else|return|import|from|print|input)\b/m,
  /^\s*(#include|using namespace|int main|cout|cin)\b/m,
  // \b в JS знает только латиницу, поэтому у слов КуМира граница ставится руками:
  // с \b «алг» в конце строки не опознавалось вовсе.
  /^\s*(алг|нач|кон|нц|кц)(?![А-Яа-яЁё])/mi,
  /^\s*(program|begin|procedure|function|var)\b/mi,
  /\b(range|len|print|input|append|format)\s*\(/,
  /[;{}]\s*$/m,
  /(==|!=|<=|>=|\+=|-=|\*=|\/\/|:=|&&|\|\||->|=>)/,
]
// Слабые — сами по себе ничего не значат: отступ есть у любого списка, двоеточие
// у любого заголовка, «x = 5» пишут и в условии задачи.
const CODE_WEAK = [
  /^\s{2,}\S/m,
  /^\s*[\w.]+\s*=\s*[^=]/m,
  /:\s*$/m,
]

// Огороженный блок ```python … ``` — код без гаданий, и язык назван прямо.
const FENCE = /^\s*```([A-Za-zА-Яа-я+#]*)\s*\n([\s\S]*?)\n?\s*```\s*$/

export function readFence(text) {
  const m = FENCE.exec(String(text ?? ""))
  return m ? { lang: langByName(m[1]), code: m[2] } : null
}

function langByName(name) {
  const n = String(name || "").toLowerCase()
  if (!n) return null
  if (n.startsWith("py")) return "python"
  if (n === "c" || n === "cpp" || n === "c++" || n === "cxx" || n === "java" || n === "js" || n === "javascript") return "cpp"
  if (n.startsWith("pas") || n === "delphi") return "pascal"
  if (n.startsWith("кум") || n === "kumir") return "kumir"
  return null
}

export function looksLikeCode(text) {
  const s = String(text ?? "")
  if (!s.trim()) return false
  if (readFence(s)) return true
  if (s.length > 20000) return false           // это уже не фрагмент кода, а файл
  let strong = 0, weak = 0
  for (const re of CODE_STRONG) if (re.test(s)) strong++
  for (const re of CODE_WEAK) if (re.test(s)) weak++
  // Признаков нужно ДВА, и хотя бы один — сильный. Без этого «Задание 5:» с
  // отступом под ним (двоеточие + отступ) уезжало бы в чёрную карточку, а «//»
  // из любой ссылки сходило бы за оператор.
  return strong >= 2 || (strong >= 1 && weak >= 1)
}

export function detectLang(text) {
  const s = String(text ?? "")
  if (/^\s*(#include|using namespace|int\s+main|cout\s*<<|cin\s*>>)/m.test(s)) return "cpp"
  if (/^\s*(алг|нач|кон|нц|кц|использовать)(?![А-Яа-яЁё])/m.test(s)) return "kumir"
  if (/\b(:=)/.test(s) && /\b(begin|end|program|var)\b/i.test(s)) return "pascal"
  return "python"
}

// Табуляция раскрывается ЗДЕСЬ, один раз: холст рисует «\t» нулевой шириной, и
// отступы слиплись бы. Заодно снимаются пустые хвосты и общий отступ куска,
// скопированного из середины функции.
export function normalizeCode(text) {
  let s = String(text ?? "").replace(/\r\n?/g, "\n").replace(/\t/g, "    ")
  s = s.replace(/[ ]+$/gm, "").replace(/^\n+/, "").replace(/\n+$/, "")
  const lines = s.split("\n").filter((l) => l.trim())
  let common = Infinity
  for (const l of lines) common = Math.min(common, l.length - l.trimStart().length)
  if (common > 0 && Number.isFinite(common)) s = s.split("\n").map((l) => l.slice(common)).join("\n")
  return s
}

// --- Разбор на разряды ----------------------------------------------------
// Ответ: массив строк, каждая — массив кусков {t: текст, k: разряд, c: колонка}.
// Колонка нужна отрисовке: шрифт моноширинный, поэтому место символа считается
// умножением на ширину знака, а не измерением каждого куска на каждом кадре.
const cache = new Map()
const CACHE_MAX = 40

export function codeTokens(text, lang) {
  const key = `${lang} ${text}`
  const hit = cache.get(key)
  if (hit) return hit
  const res = tokenize(String(text ?? ""), LANGS[lang] || LANGS.python)
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
  cache.set(key, res)
  return res
}

function tokenize(src, cfg) {
  const lines = [[]]
  let col = 0
  const put = (s, k) => {
    const parts = s.split("\n")
    for (let i = 0; i < parts.length; i++) {
      if (i) { lines.push([]); col = 0 }
      if (parts[i]) {
        if (k !== "space") lines[lines.length - 1].push({ t: parts[i], k, c: col })
        col += parts[i].length
      }
    }
  }
  let i = 0
  const n = src.length
  let sigDepth = 0        // глубина скобок в объявлении функции (там имена — параметры)
  let awaitSig = false    // только что прошло имя функции после def/procedure
  let prevWord = ""       // последнее значимое слово — по нему узнаётся объявление
  while (i < n) {
    const ch = src[i]
    if (ch === "\n") { lines.push([]); col = 0; i++; continue }
    if (ch === " ") { let j = i; while (j < n && src[j] === " ") j++; put(src.slice(i, j), "space"); i = j; continue }

    const lc = cfg.line.find((p) => src.startsWith(p, i))
    // Решётка в C++ — это не комментарий, а директива; красим её как ключевое слово
    if (lc) {
      let j = src.indexOf("\n", i); if (j < 0) j = n
      put(src.slice(i, j), lc === "#" && cfg !== LANGS.python ? "kw" : "comment")
      i = j; continue
    }
    const bc = cfg.block.find(([o]) => src.startsWith(o, i))
    if (bc) {
      let j = src.indexOf(bc[1], i + bc[0].length)
      j = j < 0 ? n : j + bc[1].length
      put(src.slice(i, j), "comment")
      i = j; continue
    }
    const q = cfg.str.find((p) => src.startsWith(p, i))
    if (q) {
      let j = i + q.length
      while (j < n) {
        if (cfg.esc && src[j] === "\\") { j += 2; continue }
        if (src.startsWith(q, j)) { j += q.length; break }
        // Одиночная кавычка не тянется через строки: незакрытая (апостроф в
        // комментарии, «don't») иначе выкрасила бы в зелёное весь остаток кода.
        if (src[j] === "\n" && q.length === 1) break
        j++
      }
      put(src.slice(i, j), "str")
      i = j; continue
    }
    if (DIGIT.test(ch) || (ch === "." && DIGIT.test(src[i + 1] || ""))) {
      let j = i
      while (j < n && /[0-9a-fA-FxXoObB._]/.test(src[j])) j++
      put(src.slice(i, j), "num")
      i = j; continue
    }
    if (WORD_START.test(ch)) {
      let j = i + 1
      while (j < n && WORD_REST.test(src[j])) j++
      const w = src.slice(i, j)
      let k = "plain"
      const low = cfg.fold ? w.toLowerCase() : w
      let after = j
      while (after < n && src[after] === " ") after++
      const call = src[after] === "("
      if (w[0] === "@") k = "deco"
      else if (cfg.kw.has(low)) k = "kw"
      else if (cfg.konst.has(low)) k = "const"
      else if (/^(def|class|function|procedure|алг)$/i.test(prevWord)) { k = "func"; awaitSig = cfg.sig }
      else if (cfg.builtin.has(low)) k = "builtin"
      else if (sigDepth > 0) k = "param"
      else if (call) k = "func"
      put(w, k)
      if (!/^\s*$/.test(w)) prevWord = low
      i = j; continue
    }
    if (ch === "(" && awaitSig) { sigDepth = 1; awaitSig = false; put(ch, "punct"); i++; continue }
    if (sigDepth > 0) {
      if (ch === "(") sigDepth++
      else if (ch === ")") sigDepth--
    }
    if (ch === "\\" || ch === ":" || ch === ";") awaitSig = false
    put(ch, "punct")
    prevWord = ""
    i++
  }
  return lines
}
