// Генераторы заданий ОГЭ по химии (предмет «ОГЭ Химия»).
//
// Как и в остальных банках: из открытого банка ФИПИ (fipi_bank_chem/) берётся СТРУКТУРА
// типажей и точная формулировка, а конкретика (вещества/числа) — своя, причём ПРАВИЛЬНЫЙ
// ОТВЕТ ГЕНЕРАТОР СЧИТАЕТ САМ по построению (молярные массы, степени окисления, класс
// вещества заданы в кураторских таблицах ниже) — значит ключ гарантированно верен и мы
// ничего не заимствуем.
//
// Первый этап (эта версия): переносим только задания БЕЗ картинок. Формулы веществ
// показываем Unicode-подстрочными (H₂O, SO₄) — они проходят экранирование renderTaskMath()
// как обычный текст и корректно печатаются в PDF (html2canvas снимает DOM браузера).

import { matchBlock } from "../utils"

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i);[a[i], a[j]] = [a[j], a[i]] } return a }

// ── Химический движок: атомные массы, парсер формул, отображение ─────────────

// Относительные атомные массы Ar, округлённые как в таблице ФИПИ на ОГЭ
// (Cl = 35,5; остальные — до целых). Используются во всех расчётных генераторах.
const AR = {
  H: 1, He: 4, Li: 7, Be: 9, B: 11, C: 12, N: 14, O: 16, F: 19, Ne: 20,
  Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, Ar: 40, K: 39, Ca: 40,
  Cr: 52, Mn: 55, Fe: 56, Ni: 59, Cu: 64, Zn: 65, Br: 80, Ag: 108, I: 127, Ba: 137,
}

// Парсер химической формулы → { элемент: количество атомов }. Поддерживает вложенные
// скобки и множители: "Al2(SO4)3" → {Al:2,S:3,O:12}, "(NH4)2HPO4" → {N:2,H:9,P:1,O:4}.
function parseFormula(f) {
  let i = 0
  function group() {
    const counts = {}
    while (i < f.length) {
      const ch = f[i]
      if (ch === "(") {
        i++
        const inner = group()            // до закрывающей скобки
        i++                              // пропустить ")"
        const mult = readNumber()
        for (const el in inner) counts[el] = (counts[el] || 0) + inner[el] * mult
      } else if (ch === ")") {
        break
      } else if (/[A-Z]/.test(ch)) {
        let el = ch; i++
        while (i < f.length && /[a-z]/.test(f[i])) { el += f[i]; i++ }
        const n = readNumber()
        counts[el] = (counts[el] || 0) + n
      } else {
        i++                              // проигнорировать посторонний символ
      }
    }
    return counts
  }
  function readNumber() {
    let s = ""
    while (i < f.length && /[0-9]/.test(f[i])) { s += f[i]; i++ }
    return s ? parseInt(s, 10) : 1
  }
  return group()
}

// Молярная масса Mr по формуле.
function molarMass(f) {
  const c = parseFormula(f)
  let m = 0
  for (const el in c) m += (AR[el] ?? NaN) * c[el]
  return m
}

// Число атомов элемента el в формуле.
function atomCount(f, el) { return parseFormula(f)[el] || 0 }

// Подстрочные цифры для отображения формулы (H2SO4 → H₂SO₄). Все цифры в химической
// формуле — индексы, поэтому переводим их в Unicode-подстрочные целиком.
const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" }
const fmt = (f) => f.replace(/[0-9]/g, (d) => SUB[d])

// Число в стиле ФИПИ: десятичная дробь через запятую с фиксированной точностью.
// prec=1 → «до десятых» (36,8), prec=0 → «до целых» (37).
function num(x, prec) {
  return x.toFixed(prec).replace(".", ",")
}

// ── №18 (КЭС 1.4): массовая доля элемента в сложном веществе ─────────────────
// ω(Э) = n·Ar(Э) / Mr(вещества) · 100 %. Ответ считается по построению.
// Пул веществ: {формула, название в предложном падеже («в сульфате цинка»),
// целевой элемент, элемент в родительном падеже («цинка»), точность}.
const COMPOUNDS_18 = [
  { f: "ZnSO4", in: "сульфате цинка", el: "Zn", gen: "цинка" },
  { f: "FeSO4", in: "сульфате железа(II)", el: "Fe", gen: "железа" },
  { f: "MgSO4", in: "сульфате магния", el: "Mg", gen: "магния" },
  { f: "CuSO4", in: "сульфате меди(II)", el: "Cu", gen: "меди" },
  { f: "Al2(SO4)3", in: "сульфате алюминия", el: "Al", gen: "алюминия" },
  { f: "(NH4)2SO4", in: "сульфате аммония", el: "N", gen: "азота" },
  { f: "KMnO4", in: "перманганате калия", el: "K", gen: "калия" },
  { f: "KMnO4", in: "перманганате калия", el: "Mn", gen: "марганца" },
  { f: "K2Cr2O7", in: "дихромате калия", el: "Cr", gen: "хрома" },
  { f: "NH4NO3", in: "нитрате аммония", el: "N", gen: "азота" },
  { f: "KNO3", in: "нитрате калия", el: "N", gen: "азота" },
  { f: "AgNO3", in: "нитрате серебра", el: "Ag", gen: "серебра" },
  { f: "Cu(NO3)2", in: "нитрате меди(II)", el: "Cu", gen: "меди" },
  { f: "CaCO3", in: "карбонате кальция", el: "Ca", gen: "кальция" },
  { f: "Na2CO3", in: "карбонате натрия", el: "Na", gen: "натрия" },
  { f: "K2CO3", in: "карбонате калия", el: "K", gen: "калия" },
  { f: "Ca3(PO4)2", in: "фосфате кальция", el: "P", gen: "фосфора" },
  { f: "Ca3(PO4)2", in: "фосфате кальция", el: "Ca", gen: "кальция" },
  { f: "(NH4)2HPO4", in: "гидрофосфате аммония", el: "N", gen: "азота" },
  { f: "Fe2O3", in: "оксиде железа(III)", el: "Fe", gen: "железа" },
  { f: "Al2O3", in: "оксиде алюминия", el: "Al", gen: "алюминия" },
  { f: "ZnO", in: "оксиде цинка", el: "Zn", gen: "цинка" },
  { f: "CuO", in: "оксиде меди(II)", el: "Cu", gen: "меди" },
  { f: "MgO", in: "оксиде магния", el: "Mg", gen: "магния" },
  { f: "SO2", in: "оксиде серы(IV)", el: "S", gen: "серы" },
  { f: "SO3", in: "оксиде серы(VI)", el: "S", gen: "серы" },
  { f: "NaCl", in: "хлориде натрия", el: "Na", gen: "натрия" },
  { f: "CaCl2", in: "хлориде кальция", el: "Ca", gen: "кальция" },
  { f: "NaOH", in: "гидроксиде натрия", el: "Na", gen: "натрия" },
  { f: "Ca(OH)2", in: "гидроксиде кальция", el: "Ca", gen: "кальция" },
  { f: "Fe(OH)3", in: "гидроксиде железа(III)", el: "Fe", gen: "железа" },
  { f: "H2SO4", in: "серной кислоте", el: "S", gen: "серы" },
  { f: "H3PO4", in: "фосфорной кислоте", el: "P", gen: "фосфора" },
  { f: "HNO3", in: "азотной кислоте", el: "N", gen: "азота" },
]

function t18MassFraction() {
  const c = pick(COMPOUNDS_18)
  const prec = pick([0, 1])
  const mr = molarMass(c.f)
  const omega = atomCount(c.f, c.el) * AR[c.el] / mr * 100
  return {
    condition_text:
      `Вычислите массовую долю (в процентах) ${c.gen} в ${c.in} (${fmt(c.f)}). ` +
      `Запишите число с точностью до ${prec === 1 ? "десятых" : "целых"}.`,
    answer: num(omega, prec),
  }
}

// ── №1 (КЭС 1.2): «элемент» vs «простое вещество» ────────────────────────────
// Для каждого элемента — по 4 утверждения о ПРОСТОМ ВЕЩЕСТВЕ (свойства/реакции самого
// вещества) и 4 о ХИМИЧЕСКОМ ЭЛЕМЕНТЕ (в составе соединений/минералов, строение атома).
// Задание: спрашиваем одну категорию — 2 её утверждения + 3 из другой; ключ по построению.
const ELEMENTS_1 = [
  {
    pre: "о кислороде",
    simple: ["Кислород — газ без цвета и запаха.", "Кислород малорастворим в воде.", "В жидком состоянии кислород имеет голубой цвет.", "Кислород поддерживает горение."],
    element: ["Кислород входит в состав воды.", "Кислород входит в состав всех оксидов.", "Атом кислорода содержит восемь электронов.", "Кислород входит в состав углекислого газа."],
  },
  {
    pre: "о водороде",
    simple: ["Водород — самый лёгкий газ.", "Водород почти не растворяется в воде.", "Смесь водорода с воздухом взрывоопасна.", "Водород горит в кислороде."],
    element: ["Водород входит в состав воды.", "Водород содержится во всех кислотах.", "Атом водорода имеет один электрон.", "Водород входит в состав аммиака."],
  },
  {
    pre: "об азоте",
    simple: ["Азот — газ без цвета и запаха.", "Азот составляет около 78 % воздуха по объёму.", "Азот малоактивен при обычных условиях.", "Температура кипения азота около −196 °C."],
    element: ["Азот входит в состав аммиака.", "Азот содержится в белках.", "Азот входит в состав азотной кислоты.", "Атом азота имеет пять электронов во внешнем слое."],
  },
  {
    pre: "о хлоре",
    simple: ["Хлор — жёлто-зелёный газ.", "Хлор ядовит.", "Хлор тяжелее воздуха.", "Хлор — сильный окислитель."],
    element: ["Хлор входит в состав поваренной соли.", "Хлор содержится в минерале галите.", "Хлор входит в состав соляной кислоты.", "Атом хлора содержит 17 протонов."],
  },
  {
    pre: "о сере",
    simple: ["Сера — твёрдое вещество жёлтого цвета.", "Сера не растворяется в воде.", "Сера плавится при слабом нагревании.", "Сера горит синеватым пламенем."],
    element: ["Сера входит в состав серной кислоты.", "Сера содержится в сульфиде железа.", "Сера входит в состав сульфатов.", "Сера входит в состав некоторых белков."],
  },
  {
    pre: "об углероде",
    simple: ["Углерод существует в виде алмаза и графита.", "Графит проводит электрический ток.", "Углерод в виде сажи имеет чёрный цвет.", "Древесный уголь хорошо поглощает газы."],
    element: ["Углерод входит в состав углекислого газа.", "Углерод содержится в карбонате кальция.", "Углерод входит в состав всех органических веществ.", "Атом углерода имеет четыре электрона во внешнем слое."],
  },
  {
    pre: "о железе",
    simple: ["Железо — серебристо-серый металл.", "Железо притягивается магнитом.", "Железо во влажном воздухе ржавеет.", "Железо пластично и хорошо куётся."],
    element: ["Железо входит в состав ржавчины.", "Железо содержится в гемоглобине крови.", "Железо входит в состав пирита.", "Железо входит в состав железной окалины."],
  },
  {
    pre: "об алюминии",
    simple: ["Алюминий — лёгкий серебристый металл.", "Алюминий хорошо проводит электрический ток.", "Алюминий покрыт прочной оксидной плёнкой.", "Из алюминия изготавливают фольгу и провода."],
    element: ["Алюминий входит в состав глинозёма.", "Алюминий содержится в боксите.", "Алюминий входит в состав многих горных пород.", "Атом алюминия имеет три электрона во внешнем слое."],
  },
  {
    pre: "о меди",
    simple: ["Медь — металл красноватого цвета.", "Медь хорошо проводит электрический ток.", "Медь пластична и тягуча.", "На влажном воздухе медь покрывается зелёным налётом."],
    element: ["Медь входит в состав малахита.", "Медь содержится в медном купоросе.", "Медь входит в состав оксида меди(II).", "В соединениях медь проявляет степени окисления +1 и +2."],
  },
  {
    pre: "о фосфоре",
    simple: ["Белый фосфор светится в темноте.", "Красный фосфор применяют при изготовлении спичек.", "Фосфор существует в виде белой и красной модификаций.", "Белый фосфор ядовит."],
    element: ["Фосфор входит в состав фосфорной кислоты.", "Фосфор содержится в костях человека.", "Фосфор входит в состав фосфатов.", "Фосфор входит в состав минерала апатита."],
  },
  {
    pre: "о кальции",
    simple: ["Кальций — мягкий серебристо-белый металл.", "Кальций энергично реагирует с водой.", "Кальций режется ножом.", "На воздухе кальций быстро тускнеет."],
    element: ["Кальций входит в состав мела и известняка.", "Кальций содержится в костях.", "Кальций входит в состав гипса.", "Кальций входит в состав карбоната кальция."],
  },
  {
    pre: "о натрии",
    simple: ["Натрий — мягкий металл, который режется ножом.", "Натрий хранят под слоем керосина.", "Натрий бурно реагирует с водой.", "Натрий легче воды."],
    element: ["Натрий входит в состав поваренной соли.", "Натрий содержится в питьевой соде.", "Натрий входит в состав сульфата натрия.", "Атом натрия имеет один электрон во внешнем слое."],
  },
  {
    pre: "о магнии",
    simple: ["Магний — лёгкий серебристо-белый металл.", "Магний горит ярким белым пламенем.", "Магний вытесняет водород из разбавленных кислот.", "Магний применяют для получения лёгких сплавов."],
    element: ["Магний входит в состав хлорофилла.", "Содержание магния в морской воде составляет около 0,13 %.", "В соединениях магний проявляет степень окисления +2.", "Магний входит в состав минерала магнезита."],
  },
]

// Общий билдер для №1 (утверждения, КЭС 1.2) и №16 (высказывания, КЭС 1.1) — структура
// одна: 2 фразы спрашиваемой категории + 3 из другой, ключ по построению.
function buildElementSimple(noun) {
  const e = pick(ELEMENTS_1)
  const askSimple = Math.random() < 0.5
  const [askCat, otherCat] = askSimple ? ["simple", "element"] : ["element", "simple"]
  const correct = shuffle(e[askCat]).slice(0, 2)
  const other = shuffle(e[otherCat]).slice(0, 3)
  const list = shuffle([...correct, ...other])
  const answer = correct.map((s) => list.indexOf(s) + 1).sort((a, b) => a - b).join("")
  const numbered = list.map((s, i) => `${i + 1}) ${s}`).join("\n")
  const asWhat = askSimple ? "как о простом веществе" : "как о химическом элементе"
  return {
    condition_text:
      `Выберите два ${noun.plural}, в которых говорится ${e.pre} ${asWhat}.\n\n${numbered}\n\n` +
      `Запишите номера выбранных ${noun.gen}.`,
    answer,
  }
}
const t1ElementSimple = () => buildElementSimple({ plural: "утверждения", gen: "утверждений" })
const t16ElementSimple = () => buildElementSimple({ plural: "высказывания", gen: "высказываний" })

// ── №11 (КЭС 5.1): тип химической реакции по паре веществ ─────────────────────
// Кураторский список реагирующих пар с ТОЧНО известным типом реакции. Задание:
// выбрать две пары заданного типа (2 целевые + 3 других типов; все пары реагируют).
const PAIRS_11 = {
  "соединения": [
    "оксид натрия и вода", "оксид кальция и вода", "оксид серы(IV) и кислород",
    "оксид железа(II) и кислород", "водород и кислород", "сера и кислород",
    "кальций и кислород", "азот и водород", "оксид бария и вода",
  ],
  "замещения": [
    "цинк и соляная кислота", "магний и разбавленная серная кислота",
    "железо и раствор сульфата меди(II)", "барий и разбавленная серная кислота",
    "алюминий и оксид железа(III)", "водород и оксид меди(II)",
    "натрий и вода", "бромид натрия и хлор",
  ],
  "обмена": [
    "гидроксид натрия и соляная кислота", "хлорид бария и сульфат натрия",
    "карбонат натрия и соляная кислота", "нитрат серебра и хлорид натрия",
    "гидроксид железа(II) и соляная кислота", "сульфат меди(II) и гидроксид натрия",
    "гидроксид калия и азотная кислота",
  ],
}

function t11ReactionType() {
  const target = pick(Object.keys(PAIRS_11))
  const two = shuffle(PAIRS_11[target]).slice(0, 2)
  const otherTypes = Object.keys(PAIRS_11).filter((t) => t !== target)
  const distract = []
  const flat = shuffle(otherTypes.flatMap((t) => PAIRS_11[t]))
  for (const p of flat) { if (distract.length < 3 && !two.includes(p)) distract.push(p) }
  const list = shuffle([...two, ...distract])
  const answer = two.map((p) => list.indexOf(p) + 1).sort((a, b) => a - b).join("")
  const numbered = list.map((p, i) => `${i + 1}) ${p}`).join("\n")
  return {
    condition_text:
      `Из предложенного перечня выберите две пары веществ, между которыми протекает ` +
      `реакция ${target}.\n\n${numbered}\n\n` +
      `Запишите номера выбранных пар.`,
    answer,
  }
}

// ── №15 (КЭС 5.3): процесс ОВР — окисление или восстановление ─────────────────
// Схема «Эл^(до) → Эл^(после)». Процесс определяется по построению: степень окисления
// растёт → окисление (отдаёт e⁻), падает → восстановление. Соответствие А,Б,В ↔ 1/2.
const SUPd = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" }
const oxSup = (n) => (n > 0 ? "⁺" : n < 0 ? "⁻" : "") + String(Math.abs(n)).split("").map((c) => SUPd[c]).join("")
// species: коэффициент (если >1), символ, индекс ₂ для двухатомных, надстрочная ст. окисления.
const species = (el, ox, n = 1, di = false) => `${n > 1 ? n : ""}${el}${di ? "₂" : ""}${oxSup(ox)}`

// [левый вид, левая ст.ок.] → [правый вид, правая ст.ок.]; коэф./двухатомность для баланса атомов.
const SCHEMES_15 = [
  [["Mg", 0], ["Mg", 2]], [["Al", 0], ["Al", 3]], [["Zn", 0], ["Zn", 2]],
  [["Ca", 0], ["Ca", 2]], [["Fe", 0], ["Fe", 3]], [["Fe", 0], ["Fe", 2]],
  [["Cl", -1, 2], ["Cl", 0, 1, true]], [["O", -2, 2], ["O", 0, 1, true]],
  [["S", -2], ["S", 0]], [["S", 4], ["S", 6]], [["P", 3], ["P", 5]],
  [["N", 0, 1, true], ["N", -3, 2]], [["H", 1, 2], ["H", 0, 1, true]],
  [["P", 5], ["P", 3]], [["C", 4], ["C", 0]], [["Cu", 2], ["Cu", 0]],
  [["Fe", 3], ["Fe", 2]], [["Mn", 7], ["Mn", 2]], [["Cr", 6], ["Cr", 3]],
  [["N", 5], ["N", 2]], [["Br", 5], ["Br", 7]], [["S", 6], ["S", 4]],
]
const schemeDisp = (s) => `${species(s[0][0], s[0][1], s[0][2] || 1, s[0][3] || false)} → ${species(s[1][0], s[1][1], s[1][2] || 1, s[1][3] || false)}`
const schemeProcess = (s) => (s[1][1] > s[0][1] ? 1 : 2)   // 1 — окисление, 2 — восстановление

function t15RedoxProcess() {
  const three = shuffle(SCHEMES_15).slice(0, 3)
  const answer = three.map((s) => schemeProcess(s)).join("")
  return {
    condition_text:
      `Установите соответствие между схемой процесса, происходящего в ` +
      `окислительно-восстановительной реакции, и названием этого процесса: к каждой позиции, ` +
      `обозначенной буквой, подберите позицию, обозначенную цифрой.\n\n` +
      matchBlock({
        leftHdr: "СХЕМА ПРОЦЕССА", rightHdr: "НАЗВАНИЕ ПРОЦЕССА",
        left: three.map((s) => schemeDisp(s)), right: ["окисление", "восстановление"],
      }),
    answer,
  }
}

// ── №14 (КЭС 5.5): выбор двух ионов, дающих осадок ───────────────────────────
// Модель растворимости. Задание собирается так, что среди 6 ионов РОВНО одна пара
// катион+анион даёт осадок (дистракторы подбираются жадно — не создавая второй осадок).
const IONS_14 = {
  K: { disp: "K⁺", k: "cat" }, Na: { disp: "Na⁺", k: "cat" }, NH4: { disp: "NH₄⁺", k: "cat" },
  Ba: { disp: "Ba²⁺", k: "cat" }, Ca: { disp: "Ca²⁺", k: "cat" }, Mg: { disp: "Mg²⁺", k: "cat" },
  Al: { disp: "Al³⁺", k: "cat" }, Fe2: { disp: "Fe²⁺", k: "cat" }, Fe3: { disp: "Fe³⁺", k: "cat" },
  Cu: { disp: "Cu²⁺", k: "cat" }, Zn: { disp: "Zn²⁺", k: "cat" }, Ag: { disp: "Ag⁺", k: "cat" },
  NO3: { disp: "NO₃⁻", k: "an" }, Cl: { disp: "Cl⁻", k: "an" }, Br: { disp: "Br⁻", k: "an" }, I: { disp: "I⁻", k: "an" },
  SO4: { disp: "SO₄²⁻", k: "an" }, CO3: { disp: "CO₃²⁻", k: "an" }, PO4: { disp: "PO₄³⁻", k: "an" },
  OH: { disp: "OH⁻", k: "an" }, S: { disp: "S²⁻", k: "an" }, SiO3: { disp: "SiO₃²⁻", k: "an" },
}
// Заведомо нерастворимые пары «катион|анион» (образуют осадок).
const INSOL_14 = new Set([
  "Ag|Cl", "Ag|Br", "Ag|I", "Ag|CO3", "Ag|PO4", "Ag|S", "Ag|OH",
  "Ba|SO4", "Ba|CO3", "Ba|PO4", "Ba|SiO3", "Ca|CO3", "Ca|PO4", "Ca|SiO3",
  "Mg|OH", "Mg|CO3", "Mg|PO4", "Mg|SiO3", "Al|OH", "Al|PO4",
  "Fe2|OH", "Fe2|CO3", "Fe2|S", "Fe2|PO4", "Fe2|SiO3", "Fe3|OH", "Fe3|PO4",
  "Cu|OH", "Cu|CO3", "Cu|S", "Cu|PO4", "Cu|SiO3", "Zn|OH", "Zn|CO3", "Zn|S", "Zn|PO4", "Zn|SiO3",
])
// Малорастворимые/пограничные (в т.ч. полностью гидролизующиеся Al³⁺/Fe³⁺ с S²⁻/CO₃²⁻/
// SiO₃²⁻) — не сводим в один перечень, чтобы не появлялся спорный «второй осадок».
const BORDER_14 = new Set(["Ca|SO4", "Ca|OH", "Ag|SO4",
  "Al|S", "Al|SiO3", "Al|CO3", "Fe3|S", "Fe3|SiO3", "Fe3|CO3"])
const mightPrecip14 = (c, a) => INSOL_14.has(`${c}|${a}`) || BORDER_14.has(`${c}|${a}`)

function t14Precipitate() {
  const [cat, an] = pick([...INSOL_14]).split("|")
  const chosen = [cat, an]
  const candidates = shuffle(Object.keys(IONS_14).filter((k) => k !== cat && k !== an))
  for (const cand of candidates) {
    if (chosen.length >= 6) break
    const kind = IONS_14[cand].k
    const clash = chosen.some((ex) => {
      if (IONS_14[ex].k === kind) return false
      const cc = kind === "cat" ? cand : ex
      const aa = kind === "an" ? cand : ex
      return mightPrecip14(cc, aa)
    })
    if (!clash) chosen.push(cand)
  }
  const list = shuffle(chosen)
  const answer = [list.indexOf(cat) + 1, list.indexOf(an) + 1].sort((x, y) => x - y).join("")
  const numbered = list.map((code, i) => `${i + 1}) ${IONS_14[code].disp}`).join("\n")
  return {
    condition_text:
      `Выберите два иона, взаимодействие которых сопровождается образованием осадка.\n\n` +
      `${numbered}\n\n` + `Запишите номера выбранных ионов.`,
    answer,
  }
}

// ── №3 (КЭС 2.1): закономерности в ряду элементов ────────────────────────────
// Истинность утверждения однозначно определяется направлением ряда:
//   period — по периоду слева направо (Z растёт, число слоёв постоянно)
//   group  — по группе сверху вниз (Z растёт, число слоёв растёт)
// Генерируем 2 верных + 3 неверных для выбранного направления → ключ по построению.
const TRENDS_3 = [
  { t: "усиливаются металлические свойства соответствующих им простых веществ", period: false, group: true },
  { t: "ослабевают металлические свойства соответствующих им простых веществ", period: true, group: false },
  { t: "усиливаются неметаллические свойства соответствующих им простых веществ", period: true, group: false },
  { t: "увеличивается электроотрицательность", period: true, group: false },
  { t: "уменьшается электроотрицательность", period: false, group: true },
  { t: "увеличивается радиус атомов", period: false, group: true },
  { t: "уменьшается радиус атомов", period: true, group: false },
  { t: "усиливается кислотный характер образуемых ими высших оксидов", period: true, group: false },
  { t: "усиливается оснóвный характер образуемых ими высших оксидов", period: false, group: true },
  { t: "увеличивается число электронов во внешнем слое атомов", period: true, group: false },
  { t: "увеличивается число электронных слоёв в атомах", period: false, group: true },
  { t: "число электронных слоёв в атомах не изменяется", period: true, group: false },
  { t: "число электронов во внешнем слое атомов не изменяется", period: false, group: true },
  { t: "увеличивается заряд ядер атомов", period: true, group: true },
]
// Ряды с заведомо верным направлением (по периоду слева направо / по группе сверху вниз).
const TRIADS_3 = [
  { row: ["Na", "Mg", "Al"], dir: "period" }, { row: ["Al", "Si", "P"], dir: "period" },
  { row: ["Si", "P", "S"], dir: "period" }, { row: ["P", "S", "Cl"], dir: "period" },
  { row: ["Al", "P", "Cl"], dir: "period" }, { row: ["Li", "Be", "B"], dir: "period" },
  { row: ["B", "C", "N"], dir: "period" }, { row: ["C", "N", "O"], dir: "period" },
  { row: ["N", "O", "F"], dir: "period" },
  { row: ["Li", "Na", "K"], dir: "group" }, { row: ["F", "Cl", "Br"], dir: "group" },
  { row: ["Cl", "Br", "I"], dir: "group" }, { row: ["O", "S", "Se"], dir: "group" },
  { row: ["N", "P", "As"], dir: "group" }, { row: ["C", "Si", "Ge"], dir: "group" },
  { row: ["Si", "Ge", "Sn"], dir: "group" }, { row: ["Be", "Mg", "Ca"], dir: "group" },
  { row: ["B", "Al", "Ga"], dir: "group" },
]

function t3Periodic() {
  const tr = pick(TRIADS_3)
  const correct = shuffle(TRENDS_3.filter((s) => s[tr.dir])).slice(0, 2)
  const wrong = shuffle(TRENDS_3.filter((s) => !s[tr.dir])).slice(0, 3)
  const list = shuffle([...correct, ...wrong])
  const answer = correct.map((s) => list.indexOf(s) + 1).sort((a, b) => a - b).join("")
  const numbered = list.map((s, i) => `${i + 1}) ${s.t}`).join("\n")
  return {
    condition_text:
      `Выберите два верных продолжения для следующего утверждения.\n` +
      `В ряду химических элементов ${tr.row.join(" → ")}\n\n${numbered}\n\n` +
      `Запишите номера выбранных продолжений.`,
    answer,
  }
}

// ── №6 (КЭС 2.1): характеристика элементов (сравнение пары) ───────────────────
// Данные периодической системы для главных подгрупп. Истинность каждого утверждения о
// паре элементов вычисляется по данным → ключ по построению (форма «Как X, так и Y …»).
const EL6 = {
  Li: { nom: "литий", gen: "лития", group: 1, period: 2, EN: 0.98, hox: 1, metal: true, di: false, oxide: "basic" },
  Be: { nom: "бериллий", gen: "бериллия", group: 2, period: 2, EN: 1.57, hox: 2, metal: true, di: false, oxide: "amph" },
  B: { nom: "бор", gen: "бора", group: 3, period: 2, EN: 2.04, hox: 3, metal: false, di: false, oxide: "acidic" },
  C: { nom: "углерод", gen: "углерода", group: 4, period: 2, EN: 2.55, hox: 4, metal: false, di: false, oxide: "acidic" },
  N: { nom: "азот", gen: "азота", group: 5, period: 2, EN: 3.04, hox: 5, metal: false, di: true, oxide: "acidic" },
  Na: { nom: "натрий", gen: "натрия", group: 1, period: 3, EN: 0.93, hox: 1, metal: true, di: false, oxide: "basic" },
  Mg: { nom: "магний", gen: "магния", group: 2, period: 3, EN: 1.31, hox: 2, metal: true, di: false, oxide: "basic" },
  Al: { nom: "алюминий", gen: "алюминия", group: 3, period: 3, EN: 1.61, hox: 3, metal: true, di: false, oxide: "amph" },
  Si: { nom: "кремний", gen: "кремния", group: 4, period: 3, EN: 1.90, hox: 4, metal: false, di: false, oxide: "acidic" },
  P: { nom: "фосфор", gen: "фосфора", group: 5, period: 3, EN: 2.19, hox: 5, metal: false, di: false, oxide: "acidic" },
  S: { nom: "сера", gen: "серы", group: 6, period: 3, EN: 2.58, hox: 6, metal: false, di: false, oxide: "acidic" },
  Cl: { nom: "хлор", gen: "хлора", group: 7, period: 3, EN: 3.16, hox: 7, metal: false, di: true, oxide: "acidic" },
  K: { nom: "калий", gen: "калия", group: 1, period: 4, EN: 0.82, hox: 1, metal: true, di: false, oxide: "basic" },
  Ca: { nom: "кальций", gen: "кальция", group: 2, period: 4, EN: 1.00, hox: 2, metal: true, di: false, oxide: "basic" },
}
const plElectrons = (n) => (n === 1 ? "электрон" : n >= 2 && n <= 4 ? "электрона" : "электронов")

// Кандидаты утверждений о паре (x,y): текст, истинность, «аспект» (для разнообразия — в
// одном задании не более одного утверждения каждого аспекта).
function stmts6(x, y) {
  const c = []
  const push = (aspect, text, truth) => c.push({ aspect, text, truth })
  for (const n of [x.group, y.group, randInt(1, 7)]) push("electrons", `имеют ${n} ${plElectrons(n)} во внешнем электронном слое`, x.group === n && y.group === n)
  push("diatomic", `при обычных условиях образуют двухатомные молекулы простых веществ`, x.di && y.di)
  for (const Z of ["Cl", "N", "S"]) push("EN", `имеют электроотрицательность меньшую, чем у ${EL6[Z].gen}`, x.EN < EL6[Z].EN && y.EN < EL6[Z].EN)
  for (const k of [x.hox, y.hox]) push("hox", `проявляют высшую степень окисления, равную +${k}`, x.hox === k && y.hox === k)
  push("oxide", `образуют высшие оксиды с кислотными свойствами`, x.oxide === "acidic" && y.oxide === "acidic")
  push("oxide", `образуют высшие оксиды с оснóвными свойствами`, x.oxide === "basic" && y.oxide === "basic")
  push("metal", `являются металлами`, x.metal && y.metal)
  push("metal", `являются неметаллами`, !x.metal && !y.metal)
  push("shells", `имеют одинаковое число электронных слоёв в атомах`, x.period === y.period)
  const seen = new Set()
  return c.filter((s) => (seen.has(s.text) ? false : (seen.add(s.text), true)))
}

// Жадно набрать до `k` утверждений с попарно РАЗНЫМИ аспектами (аспекты из usedAspects
// исключаются). Возвращает выбранные; usedAspects мутируется.
function pickDistinctAspect(pool, k, usedAspects) {
  const out = []
  for (const s of pool) {
    if (out.length >= k) break
    if (usedAspects.has(s.aspect)) continue
    out.push(s); usedAspects.add(s.aspect)
  }
  return out
}

function t6Characterize() {
  const keys = Object.keys(EL6)
  for (let attempt = 0; attempt < 60; attempt++) {
    const [kx, ky] = shuffle(keys).slice(0, 2)
    const x = EL6[kx], y = EL6[ky]
    const all = stmts6(x, y)
    const used = new Set()
    const tru = pickDistinctAspect(shuffle(all.filter((s) => s.truth)), 2, used)
    const fal = pickDistinctAspect(shuffle(all.filter((s) => !s.truth)), 3, used)
    if (tru.length < 2 || fal.length < 3) continue
    const chosen = shuffle([...tru, ...fal])
    const answer = tru.map((s) => chosen.indexOf(s) + 1).sort((a, b) => a - b).join("")
    const numbered = chosen.map((s, i) => `${i + 1}) ${s.text}`).join("\n")
    return {
      condition_text:
        `Выберите два верных продолжения для следующего утверждения.\n` +
        `Как ${x.nom}, так и ${y.nom}\n\n${numbered}\n\n` +
        `Запишите номера выбранных продолжений.`,
      answer,
    }
  }
  return null
}

// ── №13 (КЭС 5.4): электролитическая диссоциация ─────────────────────────────
// Типаж А: сколько моль ионов даёт 1 моль вещества (сильный электролит). Число ионов
// на формульную единицу задано явно (кат. + анионы, полиатомные ионы считаются как один).
const IONS_13 = [
  ["хлорид натрия", 2], ["бромид калия", 2], ["нитрат калия", 2], ["хлорид лития", 2],
  ["бромид меди(II)", 3], ["хлорид кальция", 3], ["гидроксид кальция", 3], ["сульфат натрия", 3],
  ["карбонат калия", 3], ["нитрат меди(II)", 3], ["сульфат магния", 2],
  ["хлорид алюминия", 4], ["иодид алюминия", 4], ["нитрат железа(III)", 4],
  ["нитрат алюминия", 4], ["фосфат калия", 4],
  ["сульфат алюминия", 5], ["сульфат хрома(III)", 5], ["сульфат железа(III)", 5],
]

function t13IonCount() {
  const counts = [...new Set(IONS_13.map((x) => x[1]))].filter((n) => IONS_13.filter((x) => x[1] === n).length >= 2)
  const target = pick(counts)
  const two = shuffle(IONS_13.filter((x) => x[1] === target)).slice(0, 2)
  const distract = shuffle(IONS_13.filter((x) => x[1] !== target)).slice(0, 3)
  const list = shuffle([...two, ...distract])
  const answer = two.map((p) => list.indexOf(p) + 1).sort((a, b) => a - b).join("")
  const numbered = list.map((p, i) => `${i + 1}) ${p[0]}`).join("\n")
  return {
    condition_text:
      `При полной диссоциации 1 моль каких двух из представленных веществ образуется ` +
      `${target} моль ионов?\n\n${numbered}\n\n` +
      `Запишите номера выбранных веществ.`,
    answer,
  }
}

// Типаж Б: выбрать два сильных электролита. Кураторские списки.
const ELECTROLYTES = {
  strong: ["соляная кислота", "азотная кислота", "серная кислота", "хлорид лития", "хлорид натрия",
    "сульфат калия", "нитрат натрия", "гидроксид натрия", "гидроксид калия", "гидроксид бария", "бромид калия"],
  weakOrNon: ["сероводородная кислота", "угольная кислота", "сернистая кислота", "уксусная кислота",
    "гидроксид алюминия", "гидроксид меди(II)", "углекислый газ", "кислород", "сахароза", "фосфорная кислота"],
}

function t13Strong() {
  const two = shuffle(ELECTROLYTES.strong).slice(0, 2)
  const distract = shuffle(ELECTROLYTES.weakOrNon).slice(0, 3)
  const list = shuffle([...two, ...distract])
  const answer = two.map((p) => list.indexOf(p) + 1).sort((a, b) => a - b).join("")
  const numbered = list.map((p, i) => `${i + 1}) ${p}`).join("\n")
  return {
    condition_text:
      `Из предложенного перечня веществ выберите два сильных электролита.\n\n${numbered}\n\n` +
      `Запишите номера выбранных веществ.`,
    answer,
  }
}

// ── №10 (КЭС 4.4): соответствие «реагирующие вещества → продукты» ─────────────
// Кураторские реакции: реагенты → продукты (проверены вручную; сохранение элементов
// проверяется машинно). Задание: 3 пары А/Б/В + варианты-продукты (верные + дистрактор).
const REACT_10 = [
  { react: "KOH и HBr", prod: "KBr и H2O" },
  { react: "Al2O3 и KOH (р-р)", prod: "K[Al(OH)4]" },
  { react: "KOH и H2SO4", prod: "K2SO4 и H2O" },
  { react: "NH3 и HCl", prod: "NH4Cl" },
  { react: "CuSO4 и KOH", prod: "Cu(OH)2 и K2SO4" },
  { react: "Na2CO3 и HCl", prod: "NaCl, H2O и CO2" },
  { react: "BaCl2 и Na2SO4", prod: "BaSO4 и NaCl" },
  { react: "Zn и HCl", prod: "ZnCl2 и H2" },
  { react: "Fe и CuSO4", prod: "FeSO4 и Cu" },
  { react: "Ca(OH)2 и CO2", prod: "CaCO3 и H2O" },
  { react: "CuO и H2SO4", prod: "CuSO4 и H2O" },
  { react: "Fe2O3 и HCl", prod: "FeCl3 и H2O" },
  { react: "Na2O и H2O", prod: "NaOH" },
  { react: "SO3 и H2O", prod: "H2SO4" },
  { react: "Mg и H2SO4", prod: "MgSO4 и H2" },
  { react: "AgNO3 и NaCl", prod: "AgCl и NaNO3" },
]

// Общий билдер соответствия «реагенты → продукты» (№9 и №10): 3 пары с разными продуктами
// + 2 дистрактора из того же пула. Ответ по построению.
function buildProducts(pool) {
  let three
  for (let a = 0; a < 40; a++) {
    three = shuffle(pool).slice(0, 3)
    if (new Set(three.map((r) => r.prod)).size === 3) break
  }
  const correct = three.map((r) => r.prod)
  const distract = [...new Set(pool.map((r) => r.prod).filter((p) => !correct.includes(p)))].slice(0, 2)
  const options = shuffle([...correct, ...distract])
  const answer = three.map((r) => options.indexOf(r.prod) + 1).join("")
  return {
    condition_text:
      `Установите соответствие между реагирующими веществами и продуктами их ` +
      `взаимодействия: к каждой позиции, обозначенной буквой, подберите позицию, ` +
      `обозначенную цифрой.\n\n` +
      matchBlock({
        leftHdr: "РЕАГИРУЮЩИЕ ВЕЩЕСТВА", rightHdr: "ПРОДУКТЫ ВЗАИМОДЕЙСТВИЯ",
        left: three.map((r) => fmt(r.react)), right: options.map((p) => fmt(p)),
      }),
    answer,
  }
}
const t10Products = () => buildProducts(REACT_10)

// ── №9 (КЭС 4.2): свойства простых веществ — реагенты → продукты ──────────────
const REACT_9 = [
  { react: "Fe и H2SO4 (разб.)", prod: "FeSO4 и H2" },
  { react: "Fe и H2SO4 (конц., t)", prod: "Fe2(SO4)3, SO2 и H2O" },
  { react: "Cu и H2SO4 (конц., t)", prod: "CuSO4, SO2 и H2O" },
  { react: "Fe и Cl2", prod: "FeCl3" },
  { react: "Fe и HCl", prod: "FeCl2 и H2" },
  { react: "Fe и S", prod: "FeS" },
  { react: "Cu и Cl2", prod: "CuCl2" },
  { react: "Zn и O2", prod: "ZnO" },
  { react: "Al и O2", prod: "Al2O3" },
  { react: "Mg и N2", prod: "Mg3N2" },
  { react: "Ca и H2O", prod: "Ca(OH)2 и H2" },
  { react: "Na и Cl2", prod: "NaCl" },
  { react: "Cu и O2", prod: "CuO" },
  { react: "S и O2", prod: "SO2" },
  { react: "P и O2", prod: "P2O5" },
]
const t9Products = () => buildProducts(REACT_9)

// ── №8 (КЭС 4.2): реакционная способность («реагируют / не реагируют с X») ─────
// Для каждого реагента X — кураторские списки веществ, которые с ним РЕАГИРУЮТ и НЕ
// реагируют (проверены вручную по достоверной химии; машинно ключ здесь не сверить — сам
// факт реакции и есть ответ). Задание: 2 из нужного списка + 3 из противоположного.
const REACT_8 = [
  {
    instr: "гидроксидом натрия",
    react: ["HCl", "H2SO4", "HNO3", "CO2", "SO2", "SO3", "P2O5", "Al2O3", "ZnO", "Al(OH)3", "Zn(OH)2", "CuSO4", "FeCl3", "MgCl2"],
    no: ["Na2O", "K2O", "CaO", "MgO", "NaCl", "K2SO4", "KNO3", "KOH", "BaCl2", "Na2SO4", "CaCO3"],
  },
  {
    instr: "разбавленной серной кислотой",
    react: ["Zn", "Mg", "Fe", "Al", "CuO", "MgO", "Na2O", "CaO", "NaOH", "KOH", "Cu(OH)2", "BaCl2", "Na2CO3", "K2CO3", "Fe2O3"],
    no: ["Cu", "Ag", "CO2", "SO2", "SO3", "NaCl", "NaNO3", "KNO3", "SiO2"],
  },
  {
    instr: "оксидом меди(II)",
    react: ["HCl", "H2SO4", "HNO3", "H2", "CO", "C"],
    no: ["H2O", "NaOH", "KOH", "Na2SO4", "NaCl", "Na2O", "CaO", "O2", "KNO3"],
  },
  {
    instr: "водородом",
    react: ["O2", "Cl2", "N2", "S", "CuO", "Fe2O3", "Fe3O4"],
    no: ["Cu", "Fe", "NaOH", "NaCl", "H2S", "HCl", "H2O", "Na2SO4"],
  },
  {
    instr: "оксидом углерода(IV)",
    react: ["H2O", "NaOH", "KOH", "Ca(OH)2", "Ba(OH)2", "Na2O", "K2O", "CaO", "BaO"],
    no: ["HCl", "H2SO4", "HNO3", "SO2", "SO3", "NaCl", "NaNO3", "P2O5", "CuO"],
  },
]

function t8Reactivity() {
  const x = pick(REACT_8)
  const wantReact = Math.random() < 0.5
  const [yes, other] = wantReact ? [x.react, x.no] : [x.no, x.react]
  const two = shuffle(yes).slice(0, 2)
  const distract = shuffle(other).slice(0, 3)
  const list = shuffle([...two, ...distract])
  const answer = two.map((f) => list.indexOf(f) + 1).sort((a, b) => a - b).join("")
  const numbered = list.map((f, i) => `${i + 1}) ${fmt(f)}`).join("\n")
  const verb = wantReact ? "реагируют" : "не реагируют"
  return {
    condition_text:
      `Какие два из перечисленных веществ ${verb} с ${x.instr}?\n\n${numbered}\n\n` +
      `Запишите номера выбранных веществ.`,
    answer,
  }
}

// ── №12 (КЭС 1.6): выбор окислительно-восстановительных реакций ───────────────
// Реакции размечены: ОВР — есть изменение степеней окисления (соединение простых веществ,
// металл+кислота, замещение, горение); НЕ ОВР — обмен, нейтрализация, реакции оксидов/
// гидроксидов без изменения ст.ок. Задание: 2 ОВР + 3 не-ОВР, ключ по построению.
const REDOX_12 = {
  redox: [
    "взаимодействие кальция и серы", "взаимодействие оксида серы(IV) и кислорода",
    "взаимодействие цинка и соляной кислоты", "взаимодействие железа и хлора",
    "взаимодействие меди и кислорода", "взаимодействие натрия и воды",
    "взаимодействие алюминия и оксида железа(III)", "взаимодействие водорода и оксида меди(II)",
    "горение метана", "взаимодействие магния и кислорода",
  ],
  nonRedox: [
    "разложение гидроксида алюминия", "разложение карбоната магния", "разложение карбоната кальция",
    "взаимодействие оксида цинка и гидроксида калия", "взаимодействие оксида натрия и воды",
    "взаимодействие оксида кальция и воды", "взаимодействие карбоната натрия и соляной кислоты",
    "взаимодействие сульфата меди(II) и гидроксида натрия",
    "взаимодействие гидроксида натрия и азотной кислоты", "взаимодействие хлорида бария и сульфата натрия",
  ],
}

function t12Redox() {
  const two = shuffle(REDOX_12.redox).slice(0, 2)
  const distract = shuffle(REDOX_12.nonRedox).slice(0, 3)
  const list = shuffle([...two, ...distract])
  const answer = two.map((p) => list.indexOf(p) + 1).sort((a, b) => a - b).join("")
  const numbered = list.map((p, i) => `${i + 1}) ${p}`).join("\n")
  return {
    condition_text:
      `Из предложенного перечня выберите две окислительно-восстановительные реакции.\n\n` +
      `${numbered}\n\n` + `Запишите номера выбранных реакций.`,
    answer,
  }
}

// ── №4 (КЭС 1.3): степень окисления элемента в соединении (соответствие) ──────
// Кураторские таблицы: для целевого элемента — вещества с ТОЧНО известной степенью
// окисления. Задание строит 3 вещества с разными степенями, варианты ответа — набор
// степеней (+ иногда лишний дистрактор), ключ — цифры под А, Б, В (по построению верны).
const OXID = {
  "хлора": { el: "Cl", items: [["NH4Cl", -1], ["HCl", -1], ["Ca(ClO)2", 1], ["NaClO", 1], ["KClO3", 5], ["Ba(ClO4)2", 7], ["KClO4", 7]] },
  "меди": { el: "Cu", items: [["Cu2O", 1], ["CuI", 1], ["CuS", 2], ["CuO", 2], ["CuSO4", 2], ["CuCl2", 2]] },
  "серы": { el: "S", items: [["H2S", -2], ["Na2S", -2], ["SO2", 4], ["Na2SO3", 4], ["SO3", 6], ["H2SO4", 6], ["Na2SO4", 6]] },
  "азота": { el: "N", items: [["NH3", -3], ["NH4Cl", -3], ["N2O", 1], ["NO", 2], ["HNO2", 3], ["NO2", 4], ["HNO3", 5], ["KNO3", 5]] },
  "железа": { el: "Fe", items: [["FeO", 2], ["FeCl2", 2], ["FeSO4", 2], ["Fe2O3", 3], ["FeCl3", 3], ["Fe(OH)3", 3]] },
  "марганца": { el: "Mn", items: [["MnO", 2], ["MnCl2", 2], ["MnO2", 4], ["K2MnO4", 6], ["KMnO4", 7]] },
  "хрома": { el: "Cr", items: [["CrCl2", 2], ["Cr2O3", 3], ["CrCl3", 3], ["K2Cr2O7", 6], ["CrO3", 6]] },
  "фосфора": { el: "P", items: [["PH3", -3], ["Ca3P2", -3], ["P2O3", 3], ["P2O5", 5], ["H3PO4", 5], ["K3PO4", 5]] },
}

const OX = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0")

function t4Oxidation() {
  const gen = pick(Object.keys(OXID))
  const pool = OXID[gen].items
  // 3 РАЗНЫХ вещества; степени окисления могут повторяться (как в ФИПИ: две буквы —
  // одна цифра), но не все три одинаковые — гарантируем ≥2 различных степеней.
  const sh = shuffle(pool)
  let chosen = sh.slice(0, 3)
  if (new Set(chosen.map((c) => c[1])).size < 2) {
    const other = sh.find((c) => c[1] !== chosen[0][1])
    if (other) chosen[2] = other
  }
  chosen = shuffle(chosen)
  // Варианты ответа — РАЗЛИЧНЫЕ степени выбранных веществ (две буквы с одинаковой
  // степенью → одна цифра) + иногда лишняя правдоподобная степень.
  const usedOx = chosen.map((c) => c[1])
  const distractPool = [...new Set(pool.map((p) => p[1]))].filter((o) => !usedOx.includes(o))
  const options = [...new Set(usedOx)]
  if (distractPool.length && Math.random() < 0.6) options.push(pick(distractPool))
  options.sort((a, b) => a - b)
  const answer = chosen.map((c) => options.indexOf(c[1]) + 1).join("")
  return {
    condition_text:
      `Установите соответствие между формулой вещества и степенью окисления ${gen} ` +
      `в этом соединении: к каждой позиции, обозначенной буквой, подберите позицию, ` +
      `обозначенную цифрой.\n\n` +
      matchBlock({
        leftHdr: "ФОРМУЛА ВЕЩЕСТВА", rightHdr: "СТЕПЕНЬ ОКИСЛЕНИЯ",
        left: chosen.map((c) => fmt(c[0])), right: options.map((o) => OX(o)),
      }),
    answer,
  }
}

// ── №7 (КЭС 4.1): классификация неорганических веществ ───────────────────────
// Пул формул с ТОЧНО определённым классом. Задание: «выберите X и Y» — в списке из 5
// формул ровно по одной X и Y, остальные — из других классов; ключ = их позиции.
const CLASSES = {
  "соль": ["NaCl", "KNO3", "Na2CO3", "CuSO4", "Mg(NO3)2", "K2CO3", "BaCl2", "AlCl3", "Na2SO4", "FeCl3", "ZnSO4", "K3PO4", "CaCO3"],
  "щёлочь": ["NaOH", "KOH", "Ca(OH)2", "Ba(OH)2", "LiOH"],
  "нерастворимое основание": ["Fe(OH)2", "Fe(OH)3", "Cu(OH)2", "Mg(OH)2"],
  "амфотерный гидроксид": ["Zn(OH)2", "Al(OH)3", "Be(OH)2", "Cr(OH)3"],
  "основный оксид": ["Na2O", "K2O", "CaO", "BaO", "MgO", "CuO", "FeO", "Li2O"],
  "кислотный оксид": ["CO2", "SO2", "SO3", "P2O5", "SiO2", "N2O5"],
  "амфотерный оксид": ["Al2O3", "ZnO", "BeO", "Cr2O3"],
  "кислота": ["HCl", "H2SO4", "HNO3", "H3PO4", "HBr", "H2S", "H2SO3", "H2SiO3", "HNO2"],
}
// Формы для формулировки: [название класса в задании (В.п.), заголовок-подсказка].
const CLASS_LABEL = {
  "соль": "соль", "щёлочь": "щёлочь", "нерастворимое основание": "нерастворимое основание",
  "амфотерный гидроксид": "амфотерный гидроксид", "основный оксид": "основный оксид",
  "кислотный оксид": "кислотный оксид", "амфотерный оксид": "амфотерный оксид", "кислота": "кислоту",
}
// Пары классов, которые реально встречаются в задании №7 ФИПИ.
const CLASS_PAIRS = [
  ["соль", "щёлочь"], ["щёлочь", "амфотерный гидроксид"], ["основный оксид", "кислота"],
  ["кислотный оксид", "соль"], ["щёлочь", "соль"], ["основный оксид", "кислотный оксид"],
  ["кислота", "соль"], ["амфотерный оксид", "щёлочь"], ["основный оксид", "нерастворимое основание"],
  ["кислотный оксид", "кислота"],
]

function t7Classify() {
  const [ca, cb] = pick(CLASS_PAIRS)
  const fa = pick(CLASSES[ca])
  const fb = pick(CLASSES[cb])
  // 3 дистрактора из классов, отличных от обоих целевых (чтобы X и Y были единственными).
  const otherClasses = Object.keys(CLASSES).filter((c) => c !== ca && c !== cb)
  const distract = []
  for (const c of shuffle(otherClasses)) {
    const f = pick(CLASSES[c])
    if (![fa, fb, ...distract].includes(f)) distract.push(f)
    if (distract.length === 3) break
  }
  const list = shuffle([fa, fb, ...distract])
  const posA = list.indexOf(fa) + 1
  const posB = list.indexOf(fb) + 1
  const numbered = list.map((f, i) => `${i + 1}) ${fmt(f)}`).join("\n")
  return {
    condition_text:
      `Из предложенного перечня веществ выберите ${CLASS_LABEL[ca]} и ${CLASS_LABEL[cb]}.\n\n` +
      `${numbered}\n\n` +
      `Запишите в поле ответа сначала номер вещества «${ca}», а затем номер вещества «${cb}».`,
    answer: `${posA}${posB}`,
  }
}

// ── №5 (КЭС 3.1): тип химической связи ───────────────────────────────────────
// Каждое вещество отнесено к одной категории связи. Категории:
//   KNS  — ковалентная неполярная (простые вещества-неметаллы: H₂, N₂…)
//   KPS  — ковалентная полярная (молекулы из разных неметаллов: HCl, CO₂…)
//   ION  — ионная без ковалентной (бинарные металл+неметалл: NaCl, CaO…)
//   SALT — И ионная, И ковалентная (соли/щёлочи/соли аммония: NaOH, Na₂SO₄…)
//   MET  — металлическая (простые вещества-металлы: Fe, Na…)
const BOND = {
  KNS: ["H2", "N2", "O2", "O3", "F2", "Cl2", "Br2", "I2", "P4", "S8", "C60"],
  KPS: ["HCl", "HF", "HBr", "HI", "NH3", "H2O", "CO2", "SO2", "SO3", "PCl3", "PCl5", "CCl4", "SCl2", "H2S", "NO2", "CH4", "N2O", "P2O5", "H2Se"],
  ION: ["NaCl", "KCl", "KF", "NaF", "CaO", "MgO", "Na2S", "K2O", "Li2O", "BaO", "CaCl2", "MgCl2", "KBr", "CaF2", "Na2O", "KI", "AlF3"],
  SALT: ["NaOH", "KOH", "Ca(OH)2", "Ba(OH)2", "Na2SO4", "K2SO4", "Na2CO3", "K2CO3", "KNO3", "NaNO3", "Na3PO4", "(NH4)2S", "NH4Cl", "CaCO3", "K2SO3", "Na2SiO3", "NH4NO3"],
  MET: ["Fe", "Cu", "Na", "Mg", "Al", "Zn", "Ca", "K", "Ba", "Li", "Cr", "Ag"],
}
// Тип задания: [формулировка, категория верных ответов, разрешённые категории дистракторов].
// Дистракторы подобраны так, чтобы НЕ подходить под формулировку (задание однозначно).
// Для КПС соли (SALT) исключены из дистракторов — в них тоже есть полярная ковалентная связь.
const BOND_TASKS = [
  ["с ковалентной неполярной связью", "KNS", ["KPS", "ION", "SALT", "MET"]],
  ["с ковалентной полярной связью", "KPS", ["KNS", "ION", "MET"]],
  ["с ионной связью", "ION", ["KNS", "KPS", "MET"]],
  ["с металлической связью", "MET", ["KNS", "KPS", "ION", "SALT"]],
  ["содержащие как ионную, так и ковалентную связь", "SALT", ["KNS", "KPS", "ION", "MET"]],
]

function t5Bond() {
  const [phrase, target, distractCats] = pick(BOND_TASKS)
  const two = shuffle(BOND[target]).slice(0, 2)
  // 3 дистрактора из разрешённых категорий, без повторов формул.
  const distract = []
  const cats = shuffle(distractCats)
  let ci = 0
  while (distract.length < 3) {
    const cat = cats[ci % cats.length]; ci++
    const f = pick(BOND[cat])
    if (![...two, ...distract].includes(f)) distract.push(f)
    if (ci > 60) break
  }
  const list = shuffle([...two, ...distract])
  const answer = two.map((f) => list.indexOf(f) + 1).sort((a, b) => a - b).join("")
  const numbered = list.map((f, i) => `${i + 1}) ${fmt(f)}`).join("\n")
  // Причастный оборот («содержащие …») обособляется запятой, предложный («с … связью») — нет.
  const sep = phrase.startsWith("содержащие") ? ", " : " "
  return {
    condition_text:
      `Из предложенного перечня выберите два вещества${sep}${phrase}.\n\n${numbered}\n\n` +
      `Запишите номера выбранных веществ.`,
    answer,
  }
}

// ── №21 (КЭС 4.12): генетическая цепочка (развёрнутый ответ) ──────────────────
// Цепочка из 4 веществ; одно промежуточное скрыто как X. Ответ — определить X и записать
// 3 молекулярных уравнения. Уравнения заданы структурно [коэф, формула] → атомный баланс
// проверяется машинно (см. прогон), коэффициенты по построению верны.
const eqSide = (side) => side.map(([c, f]) => `${c > 1 ? c : ""}${fmt(f)}`).join(" + ")
const eqStr = (eq) => `${eqSide(eq.l)} → ${eqSide(eq.r)}`
const CHAINS_21 = [
  { sp: ["Li2O", "LiOH", "LiCl", "LiNO3"], eqs: [
    { l: [[1, "Li2O"], [1, "H2O"]], r: [[2, "LiOH"]] },
    { l: [[1, "LiOH"], [1, "HCl"]], r: [[1, "LiCl"], [1, "H2O"]] },
    { l: [[1, "LiCl"], [1, "AgNO3"]], r: [[1, "LiNO3"], [1, "AgCl"]] }] },
  { sp: ["Cu", "Cu(NO3)2", "Cu(OH)2", "CuO"], eqs: [
    { l: [[1, "Cu"], [4, "HNO3"]], r: [[1, "Cu(NO3)2"], [2, "NO2"], [2, "H2O"]] },
    { l: [[1, "Cu(NO3)2"], [2, "NaOH"]], r: [[1, "Cu(OH)2"], [2, "NaNO3"]] },
    { l: [[1, "Cu(OH)2"]], r: [[1, "CuO"], [1, "H2O"]] }] },
  { sp: ["Al", "AlCl3", "Al(OH)3", "Al2(SO4)3"], eqs: [
    { l: [[2, "Al"], [6, "HCl"]], r: [[2, "AlCl3"], [3, "H2"]] },
    { l: [[1, "AlCl3"], [3, "NaOH"]], r: [[1, "Al(OH)3"], [3, "NaCl"]] },
    { l: [[2, "Al(OH)3"], [3, "H2SO4"]], r: [[1, "Al2(SO4)3"], [6, "H2O"]] }] },
  { sp: ["Na", "Na2O", "NaOH", "Na2SO4"], eqs: [
    { l: [[4, "Na"], [1, "O2"]], r: [[2, "Na2O"]] },
    { l: [[1, "Na2O"], [1, "H2O"]], r: [[2, "NaOH"]] },
    { l: [[2, "NaOH"], [1, "H2SO4"]], r: [[1, "Na2SO4"], [2, "H2O"]] }] },
  { sp: ["S", "SO2", "SO3", "H2SO4"], eqs: [
    { l: [[1, "S"], [1, "O2"]], r: [[1, "SO2"]] },
    { l: [[2, "SO2"], [1, "O2"]], r: [[2, "SO3"]] },
    { l: [[1, "SO3"], [1, "H2O"]], r: [[1, "H2SO4"]] }] },
  { sp: ["Ca", "CaO", "Ca(OH)2", "CaCO3"], eqs: [
    { l: [[2, "Ca"], [1, "O2"]], r: [[2, "CaO"]] },
    { l: [[1, "CaO"], [1, "H2O"]], r: [[1, "Ca(OH)2"]] },
    { l: [[1, "Ca(OH)2"], [1, "CO2"]], r: [[1, "CaCO3"], [1, "H2O"]] }] },
  { sp: ["Fe", "FeCl3", "Fe(OH)3", "Fe2O3"], eqs: [
    { l: [[2, "Fe"], [3, "Cl2"]], r: [[2, "FeCl3"]] },
    { l: [[1, "FeCl3"], [3, "NaOH"]], r: [[1, "Fe(OH)3"], [3, "NaCl"]] },
    { l: [[2, "Fe(OH)3"]], r: [[1, "Fe2O3"], [3, "H2O"]] }] },
  { sp: ["P", "P2O5", "H3PO4", "Na3PO4"], eqs: [
    { l: [[4, "P"], [5, "O2"]], r: [[2, "P2O5"]] },
    { l: [[1, "P2O5"], [3, "H2O"]], r: [[2, "H3PO4"]] },
    { l: [[1, "H3PO4"], [3, "NaOH"]], r: [[1, "Na3PO4"], [3, "H2O"]] }] },
  { sp: ["Zn", "ZnSO4", "Zn(OH)2", "ZnO"], eqs: [
    { l: [[1, "Zn"], [1, "H2SO4"]], r: [[1, "ZnSO4"], [1, "H2"]] },
    { l: [[1, "ZnSO4"], [2, "NaOH"]], r: [[1, "Zn(OH)2"], [1, "Na2SO4"]] },
    { l: [[1, "Zn(OH)2"]], r: [[1, "ZnO"], [1, "H2O"]] }] },
  { sp: ["Mg", "MgO", "MgCl2", "Mg(OH)2"], eqs: [
    { l: [[2, "Mg"], [1, "O2"]], r: [[2, "MgO"]] },
    { l: [[1, "MgO"], [2, "HCl"]], r: [[1, "MgCl2"], [1, "H2O"]] },
    { l: [[1, "MgCl2"], [2, "NaOH"]], r: [[1, "Mg(OH)2"], [2, "NaCl"]] }] },
]

function t21Chain() {
  const c = pick(CHAINS_21)
  const hide = pick([1, 2])
  const shown = c.sp.map((s, i) => (i === hide ? "X" : fmt(s)))
  const answer =
    `X — ${fmt(c.sp[hide])}\n` +
    c.eqs.map((e, i) => `${i + 1}) ${eqStr(e)}`).join("\n")
  return {
    condition_text:
      `Дана схема превращений:\n${shown.join(" → ")}\n` +
      `Напишите молекулярные уравнения реакций, с помощью которых можно осуществить ` +
      `указанные превращения.`,
    answer,
  }
}

// ── №20 (КЭС 5.3): ОВР, метод электронного баланса (развёрнутый ответ) ────────
// Кураторские реакции с готовыми коэффициентами. Проверяется машинно: атомный баланс
// уравнения И равенство отданных/принятых электронов (c_ox·n_ox = c_red·n_red).
// oxid — полуреакция окисления (элемент восстановителя, отдаёт e⁻); redu — восстановления.
const REDOX_20 = [
  { l: [[3, "Cu"], [8, "HNO3"]], r: [[3, "Cu(NO3)2"], [2, "NO"], [4, "H2O"]],
    oxid: { s: "Cu", from: 0, to: 2, n: 2, c: 3 }, redu: { s: "N", from: 5, to: 2, n: 3, c: 2 },
    oxidizer: "HNO3", reducer: "Cu" },
  { l: [[1, "Cu"], [4, "HNO3"]], r: [[1, "Cu(NO3)2"], [2, "NO2"], [2, "H2O"]],
    oxid: { s: "Cu", from: 0, to: 2, n: 2, c: 1 }, redu: { s: "N", from: 5, to: 4, n: 1, c: 2 },
    oxidizer: "HNO3", reducer: "Cu" },
  { l: [[1, "Fe"], [1, "H2SO4"]], r: [[1, "FeSO4"], [1, "H2"]],
    oxid: { s: "Fe", from: 0, to: 2, n: 2, c: 1 }, redu: { s: "H", from: 1, to: 0, n: 1, c: 2 },
    oxidizer: "H2SO4", reducer: "Fe" },
  { l: [[1, "Zn"], [2, "HCl"]], r: [[1, "ZnCl2"], [1, "H2"]],
    oxid: { s: "Zn", from: 0, to: 2, n: 2, c: 1 }, redu: { s: "H", from: 1, to: 0, n: 1, c: 2 },
    oxidizer: "HCl", reducer: "Zn" },
  { l: [[2, "Mg"], [1, "O2"]], r: [[2, "MgO"]],
    oxid: { s: "Mg", from: 0, to: 2, n: 2, c: 2 }, redu: { s: "O", from: 0, to: -2, n: 2, c: 2 },
    oxidizer: "O2", reducer: "Mg" },
  { l: [[2, "Al"], [1, "Fe2O3"]], r: [[1, "Al2O3"], [2, "Fe"]],
    oxid: { s: "Al", from: 0, to: 3, n: 3, c: 2 }, redu: { s: "Fe", from: 3, to: 0, n: 3, c: 2 },
    oxidizer: "Fe2O3", reducer: "Al" },
  { l: [[1, "H2"], [1, "CuO"]], r: [[1, "Cu"], [1, "H2O"]],
    oxid: { s: "H", from: 0, to: 1, n: 1, c: 2 }, redu: { s: "Cu", from: 2, to: 0, n: 2, c: 1 },
    oxidizer: "CuO", reducer: "H2" },
  { l: [[3, "K2S"], [8, "HNO3"]], r: [[3, "K2SO4"], [8, "NO"], [4, "H2O"]],
    oxid: { s: "S", from: -2, to: 6, n: 8, c: 3 }, redu: { s: "N", from: 5, to: 2, n: 3, c: 8 },
    oxidizer: "HNO3", reducer: "K2S" },
  { l: [[1, "Cl2"], [2, "KBr"]], r: [[2, "KCl"], [1, "Br2"]],
    oxid: { s: "Br", from: -1, to: 0, n: 1, c: 2 }, redu: { s: "Cl", from: 0, to: -1, n: 1, c: 2 },
    oxidizer: "Cl2", reducer: "KBr" },
  { l: [[1, "Fe"], [1, "CuSO4"]], r: [[1, "FeSO4"], [1, "Cu"]],
    oxid: { s: "Fe", from: 0, to: 2, n: 2, c: 1 }, redu: { s: "Cu", from: 2, to: 0, n: 2, c: 1 },
    oxidizer: "CuSO4", reducer: "Fe" },
]

function t20Redox() {
  const r = pick(REDOX_20)
  const scheme = `${r.l.map(([, f]) => fmt(f)).join(" + ")} → ${r.r.map(([, f]) => fmt(f)).join(" + ")}`
  const half = (h, sign) => `${h.s}${oxSup(h.from)} ${sign} ${h.n}e⁻ → ${h.s}${oxSup(h.to)}   | ×${h.c}`
  const answer =
    `${eqSide(r.l)} → ${eqSide(r.r)}\n` +
    `Электронный баланс:\n${half(r.oxid, "−")}\n${half(r.redu, "+")}\n` +
    `Окислитель — ${fmt(r.oxidizer)} (${r.redu.s}${oxSup(r.redu.from)} → ${r.redu.s}${oxSup(r.redu.to)}).\n` +
    `Восстановитель — ${fmt(r.reducer)} (${r.oxid.s}${oxSup(r.oxid.from)} → ${r.oxid.s}${oxSup(r.oxid.to)}).`
  return {
    condition_text:
      `Используя метод электронного баланса, расставьте коэффициенты в схеме реакции:\n` +
      `${scheme}\n` +
      `Запишите формулы окислителя и восстановителя, укажите, какое из веществ является ` +
      `окислителем, а какое — восстановителем.`,
    answer,
  }
}

// ── №22 (КЭС 7.1): расчётная задача по уравнению реакции (развёрнутый ответ) ──
// Реагент дан как раствор (масса + ω), второй — в избытке; продукт — осадок. Считаем массу
// осадка по стехиометрии. Числа подбираются «круглыми» (целая масса раствора, чистое n).
// Ответ — полное решение (уравнение + вычисления), как требует ФИПИ.
const numTrim = (x) => {
  const r = Math.round(x * 1000) / 1000
  return (Math.round(r * 100) / 100).toString().replace(".", ",")
}
// Шаблоны: дан(род.п. + формула + M) · избыток(род.п.) · уравнение · продукт(формула + M) ·
// отношение n(продукт)/n(дан) = num/den.
const CALC_22 = [
  { gGen: "нитрата серебра", gF: "AgNO3", Mg: 170, exc: "хлорида натрия", eq: "AgNO₃ + NaCl → AgCl↓ + NaNO₃", pF: "AgCl", Mp: 143.5, num: 1, den: 1 },
  { gGen: "хлорида кальция", gF: "CaCl2", Mg: 111, exc: "карбоната натрия", eq: "CaCl₂ + Na₂CO₃ → CaCO₃↓ + 2NaCl", pF: "CaCO3", Mp: 100, num: 1, den: 1 },
  { gGen: "хлорида бария", gF: "BaCl2", Mg: 208, exc: "сульфата натрия", eq: "BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl", pF: "BaSO4", Mp: 233, num: 1, den: 1 },
  { gGen: "сульфата алюминия", gF: "Al2(SO4)3", Mg: 342, exc: "нитрата бария", eq: "Al₂(SO₄)₃ + 3Ba(NO₃)₂ → 3BaSO₄↓ + 2Al(NO₃)₃", pF: "BaSO4", Mp: 233, num: 3, den: 1 },
  { gGen: "хлорида железа(III)", gF: "FeCl3", Mg: 162.5, exc: "гидроксида натрия", eq: "FeCl₃ + 3NaOH → Fe(OH)₃↓ + 3NaCl", pF: "Fe(OH)3", Mp: 107, num: 1, den: 1 },
  { gGen: "гидроксида натрия", gF: "NaOH", Mg: 40, exc: "сульфата меди(II)", eq: "2NaOH + CuSO₄ → Cu(OH)₂↓ + Na₂SO₄", pF: "Cu(OH)2", Mp: 98, num: 1, den: 2 },
  { gGen: "силиката калия", gF: "K2SiO3", Mg: 154, exc: "нитрата кальция", eq: "K₂SiO₃ + Ca(NO₃)₂ → CaSiO₃↓ + 2KNO₃", pF: "CaSiO3", Mp: 116, num: 1, den: 1 },
  { gGen: "сульфата меди(II)", gF: "CuSO4", Mg: 160, exc: "гидроксида калия", eq: "CuSO₄ + 2KOH → Cu(OH)₂↓ + K₂SO₄", pF: "Cu(OH)2", Mp: 98, num: 1, den: 1 },
]
const N100_22 = [5, 10, 12, 15, 20, 24, 25, 30, 36, 40, 48, 50, 60]
const W_22 = [2, 3, 4, 5, 6, 8, 10, 15, 20, 25]

function t22Calc() {
  const t = pick(CALC_22)
  // подобрать n (n100/100) и ω так, чтобы масса раствора была целой и в разумных пределах.
  let n100, omega, mSol
  outer: for (const nn of shuffle(N100_22)) {
    for (const w of shuffle(W_22)) {
      const m = nn * t.Mg / w
      if (Number.isInteger(m) && m >= 20 && m <= 600) { n100 = nn; omega = w; mSol = m; break outer }
    }
  }
  if (n100 == null) { n100 = 10; omega = 5; mSol = 10 * t.Mg / 5 }
  const nGiven = n100 / 100
  const mGiven = mSol * omega / 100                // = nGiven·Mg
  const nProd = nGiven * t.num / t.den
  const mProd = nProd * t.Mp
  // выражение для n(продукта)
  const ratioExpr = t.num === 1 && t.den === 1 ? `n(${fmt(t.gF)})`
    : t.den === 1 ? `${t.num} · n(${fmt(t.gF)})`
      : `n(${fmt(t.gF)}) / ${t.den}`
  const answer =
    `${t.eq}\n` +
    `m(${fmt(t.gF)}) = ${mSol} · ${numTrim(omega / 100)} = ${numTrim(mGiven)} г\n` +
    `n(${fmt(t.gF)}) = ${numTrim(mGiven)} / ${t.Mg} = ${numTrim(nGiven)} моль\n` +
    `n(${fmt(t.pF)}) = ${ratioExpr} = ${numTrim(nProd)} моль\n` +
    `m(${fmt(t.pF)}) = ${numTrim(nProd)} · ${t.Mp} = ${numTrim(mProd)} г\n` +
    `Ответ: ${numTrim(mProd)} г.`
  return {
    condition_text:
      `К ${mSol} г раствора с массовой долей ${t.gGen} ${omega} % добавили избыток ` +
      `раствора ${t.exc}. Вычислите массу образовавшегося осадка.\n` +
      `В ответе запишите уравнение реакции и приведите все необходимые вычисления ` +
      `(указывайте единицы измерения искомых физических величин).`,
    answer,
  }
}

// ── Регистрация ─────────────────────────────────────────────────────────────

export const GENERATORS_CHEM = {
  1: [t1ElementSimple],
  3: [t3Periodic],
  4: [t4Oxidation],
  5: [t5Bond],
  6: [t6Characterize],
  7: [t7Classify],
  8: [t8Reactivity],
  9: [t9Products],
  10: [t10Products],
  11: [t11ReactionType],
  12: [t12Redox],
  13: [t13IonCount, t13Strong],
  14: [t14Precipitate],
  15: [t15RedoxProcess],
  16: [t16ElementSimple],
  18: [t18MassFraction],
  20: [t20Redox],
  21: [t21Chain],
  22: [t22Calc],
}

export const GEN_META_CHEM = {
  1: [["Элемент и простое вещество", [["element-simple", "Утверждения: элемент vs простое вещество", t1ElementSimple]]]],
  3: [["Закономерности в ряду элементов", [["periodic", "Верные продолжения о ряде элементов", t3Periodic]]]],
  4: [["Степень окисления", [["oxidation", "Соответствие «формула ↔ ст. окисления»", t4Oxidation]]]],
  5: [["Химическая связь", [["bond", "Выбор двух веществ по типу связи", t5Bond]]]],
  6: [["Характеристика элементов", [["characterize", "Общие свойства пары элементов", t6Characterize]]]],
  7: [["Классификация веществ", [["classify", "Выбор двух классов из перечня", t7Classify]]]],
  8: [["Реакционная способность", [["reactivity", "Реагируют / не реагируют с веществом", t8Reactivity]]]],
  9: [["Свойства простых веществ", [["products", "Соответствие «реагенты → продукты»", t9Products]]]],
  10: [["Свойства сложных веществ", [["products", "Соответствие «реагенты → продукты»", t10Products]]]],
  11: [["Тип химической реакции", [["reaction-type", "Выбор двух пар по типу реакции", t11ReactionType]]]],
  12: [["Окислительно-восстановительные реакции", [["redox-select", "Выбор двух ОВР из перечня", t12Redox]]]],
  13: [["Электролитическая диссоциация", [["ion-count", "Сколько моль ионов даёт вещество", t13IonCount], ["strong", "Выбор двух сильных электролитов", t13Strong]]]],
  14: [["Реакции ионного обмена", [["precipitate", "Два иона, дающих осадок", t14Precipitate]]]],
  15: [["Процесс ОВР", [["redox-process", "Окисление или восстановление (соответствие)", t15RedoxProcess]]]],
  16: [["Элемент и простое вещество", [["element-simple", "Высказывания: элемент vs простое вещество", t16ElementSimple]]]],
  18: [["Массовая доля элемента", [["mass-fraction", "ω элемента в веществе", t18MassFraction]]]],
  20: [["ОВР (электронный баланс)", [["redox-balance", "Коэффициенты, окислитель/восстановитель", t20Redox]]]],
  21: [["Генетическая связь", [["chain", "Цепочка превращений (уравнения)", t21Chain]]]],
  22: [["Расчётная задача", [["precip-mass", "Масса осадка по массовой доле", t22Calc]]]],
}
